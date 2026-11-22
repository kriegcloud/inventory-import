"use client"
// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// A cell drawn while the grid scrolls is its preview, unless its last draw was in full (`drawnInFull`): a cell drawn in
// full before the scroll stays in full when it is drawn again during it (it lost the focus, its selection changed), as
// upstream's state kept it, and is not swapped for its preview and back when the scroll ends. A written cell writes
// itself through a ref callback kept per cell of the table, which writes again when the table says the value changed; a
// custom cell is drawn again on each change through `cellChanges`. Upstream had state, a layout effect and an effect
// for these.
import { useAtomValue } from "@effect/atom-react"
import { type Cell, flexRender, type RowData, type Table } from "@tanstack/react-table"
import * as Atom from "effect/reactivity/Atom"
import { type ComponentType, memo, type RefCallback } from "react"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { DataGridCellProps } from "@inventory/ui/components/data-grid/data-grid-types"

import {
  ColumnVariants,
  getCellKey,
  getHasCustomCell,
  getHasCustomDisplay,
  parseCellKey
} from "@inventory/ui/components/data-grid/data-grid-utils"
import { cellChangesOf, DataGridCell } from "@inventory/ui/components/data-grid/data-grid-cell"
import { DataGridCellPreview } from "@inventory/ui/components/data-grid/data-grid-cell-preview"
import {
  BooleanCell,
  DateCell,
  FileCell,
  LongTextCell,
  MultiSelectCell,
  NumberCell,
  SelectCell,
  ShortTextCell,
  UrlCell
} from "@inventory/ui/components/data-grid/data-grid-cell-variants"

interface DataGridDataCellProps<TData extends RowData> extends DataGridCellProps<TData> {
  isScrolling: boolean
}

// The cells (one row's cell of one column, the same object while the row is) whose last draw was in full.
const drawnInFull = new WeakSet<object>()

export const DataGridDataCell = memo(DataGridDataCellImpl, (prev, next) => {
  // Only the end of a scroll matters, when previews switch to full cells.
  if (prev.isScrolling && !next.isScrolling) return false
  if (prev.columnIndex !== next.columnIndex) return false
  if (prev.isFocused !== next.isFocused) return false
  if (prev.isEditing !== next.isEditing) return false
  if (prev.isSelected !== next.isSelected) return false
  if (prev.isSearchMatch !== next.isSearchMatch) return false
  if (prev.isActiveSearchMatch !== next.isActiveSearchMatch) return false
  if (prev.presence?.color !== next.presence?.color) return false
  if (prev.presence?.name !== next.presence?.name) return false
  if (prev.readOnly !== next.readOnly) return false
  if (prev.rowHeight !== next.rowHeight) return false
  if (prev.width !== next.width) return false
  if (prev.pinned !== next.pinned) return false
  if (prev.pinnedOffset !== next.pinnedOffset) return false
  if (prev.grow !== next.grow) return false
  if (prev.showStartBorder !== next.showStartBorder) return false
  if (prev.showEndBorder !== next.showEndBorder) return false
  if (prev.cell.row.id !== next.cell.row.id) return false
  if (prev.cell.column.id !== next.cell.column.id) return false
  if (prev.cell.column.columnDef.cell !== next.cell.column.columnDef.cell) {
    return false
  }
  if (prev.cell.column.columnDef.meta !== next.cell.column.columnDef.meta) {
    return false
  }
  // Written cells take their values straight from `updateCells`.
  if (next.cell.column.columnDef.meta?.writeCell) return true
  if (getHasCustomCell(next.cell.column) || getHasCustomDisplay(next.cell.column)) {
    return prev.cell.row.original === next.cell.row.original
  }
  return prev.cell.getValue() === next.cell.getValue()
}) as typeof DataGridDataCellImpl

function DataGridDataCellImpl<TData extends RowData>({ isScrolling, ...props }: DataGridDataCellProps<TData>) {
  const { cell } = props
  const writeCell = cell.column.columnDef.meta?.writeCell
  const hasCustomCell = getHasCustomCell(cell.column)
  const hasCustomDisplay = getHasCustomDisplay(cell.column)

  const rowId = cell.row.id
  // Drawn during a scroll: a new row or a cell that just came into view, or one whose last draw was a preview (the memo
  // skips the others while their props stay the same).
  const isPreview = isScrolling && !drawnInFull.has(cell)

  if (writeCell) {
    return <DataGridWrittenCell key={rowId} {...props} writeCell={writeCell} />
  }

  if (isPreview && !props.isFocused && !props.isEditing && !hasCustomCell && !hasCustomDisplay) {
    drawnInFull.delete(cell)
    return (
      <DataGridCellPreview
        cell={cell}
        columnIndex={props.columnIndex}
        width={props.width}
        rowHeight={props.rowHeight}
        isSelected={props.isSelected}
        isSearchMatch={props.isSearchMatch}
        isActiveSearchMatch={props.isActiveSearchMatch}
        readOnly={props.readOnly}
        pinned={props.pinned}
        pinnedOffset={props.pinnedOffset}
        grow={props.grow}
        showStartBorder={props.showStartBorder}
        showEndBorder={props.showEndBorder}
      />
    )
  }

  drawnInFull.add(cell)

  if (hasCustomCell || (hasCustomDisplay && !props.isEditing)) {
    return (
      <DataGridCell key={rowId} {...props}>
        <DataGridCustomCellContent cell={cell} />
      </DataGridCell>
    )
  }

  const variant = cell.column.columnDef.meta?.variant ?? "text"

  type CellComponent = ComponentType<DataGridCellProps<TData>>

  const Comp = ColumnVariants.match(variant, {
    text: (): CellComponent => ShortTextCell,
    "long-text": (): CellComponent => LongTextCell,
    number: (): CellComponent => NumberCell,
    url: (): CellComponent => UrlCell,
    boolean: (): CellComponent => BooleanCell,
    select: (): CellComponent => SelectCell,
    "multi-select": (): CellComponent => MultiSelectCell,
    date: (): CellComponent => DateCell,
    file: (): CellComponent => FileCell
  })

  return <Comp key={rowId} {...props} />
}

interface DataGridWrittenCellProps<TData extends RowData> extends DataGridCellProps<TData> {
  writeCell: (element: HTMLElement, value: unknown) => void
}

// One family of written cells' ref callbacks per table, kept while the table is.
const writtenCellFamilies = new WeakMap<object, (cellKey: string) => Atom.Atom<RefCallback<HTMLDivElement>>>()

/**
 * The ref callback of one written cell: it writes the value into the element when the element is put on the page,
 * writes again each time the table says the value changed, and stops when the element goes.
 */
function writtenCellRef<TData extends RowData>(table: Table<DataGridFeatures, TData>, rowId: string, columnId: string) {
  let family = writtenCellFamilies.get(table)
  if (family === undefined) {
    family = Atom.family((cellKey: string) =>
      Atom.readable((): RefCallback<HTMLDivElement> => {
        const cell = parseCellKey(cellKey)
        return (element) => {
          if (!element) return
          const write = () => {
            const writeCell = table.getAllFlatColumnsById()[cell.columnId]?.columnDef.meta?.writeCell
            const row = table.getRowModel().rowsById[cell.rowId]
            writeCell?.(element, row?.getValue(cell.columnId))
          }
          write()
          return table.subscribeCell(cell.rowId, cell.columnId, write)
        }
      }).pipe(Atom.setIdleTTL(0))
    )
    writtenCellFamilies.set(table, family)
  }
  return family(getCellKey(rowId, columnId))
}

function DataGridWrittenCell<TData extends RowData>({
  writeCell: _writeCell,
  ...props
}: DataGridWrittenCellProps<TData>) {
  const ref = useAtomValue(writtenCellRef(props.cell.table, props.cell.row.id, props.cell.column.id))

  return <DataGridCell {...props} ref={ref} />
}

interface DataGridCustomCellContentProps<TData extends RowData> {
  cell: Cell<DataGridFeatures, TData>
}

const DataGridCustomCellContent = memo(DataGridCustomCellContentImpl) as typeof DataGridCustomCellContentImpl

function DataGridCustomCellContentImpl<TData extends RowData>({
  cell: cellProp
}: DataGridCustomCellContentProps<TData>) {
  "use no memo"
  const cell = useUpdatedCell(cellProp)

  return flexRender(cell.column.columnDef.cell, cell.getContext())
}

// Live updates patch rows in place, so the `cell` prop never changes; this
// re-renders on each update and skips the compiler, which would cache on it.
function useUpdatedCell<TData extends RowData>(cell: Cell<DataGridFeatures, TData>) {
  "use no memo"
  const { table } = cell
  const rowId = cell.row.id
  const columnId = cell.column.id
  const updateCount = useAtomValue(cellChangesOf(cell))

  if (updateCount === 0) return cell

  return table.getRowModel().rowsById[rowId]?.getAllCellsByColumnId()[columnId] ?? cell
}
