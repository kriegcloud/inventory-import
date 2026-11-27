// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// Whether a cell is drawn as a preview while the grid scrolls is worked out by the cell's own atom (upstream kept it in
// state set during the draw); a written cell writes its value through a ref callback that subscribes to the table's
// cell and lets go when the node goes (upstream's layout effect); a custom cell is drawn again on each update of its
// cell by an atom that subscribes (upstream's reducer and effect). The `memo` compare functions are upstream's.
"use client"

import { type Cell, flexRender, type RowData } from "@tanstack/react-table"
import { useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"
import { type ComponentType, memo, type RefCallback, useId } from "react"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { DataGridCellProps } from "@inventory/ui/components/data-grid/data-grid-types"

import {
  ColumnVariants,
  getCellKey,
  getHasCustomCell,
  getHasCustomDisplay,
  parseCellKey
} from "@inventory/ui/components/data-grid/data-grid-utils"
import { DataGridCell } from "@inventory/ui/components/data-grid/data-grid-cell"
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

/**
 * What one cell on screen keeps between draws: the row it last showed in full, and its ref callback, made again only
 * when what it closes over changes.
 */
interface CellKept {
  readonly isPreview: (rowId: string, isScrolling: boolean) => boolean
  readonly ref: (deps: ReadonlyArray<unknown>, make: () => RefCallback<HTMLDivElement>) => RefCallback<HTMLDivElement>
}

/** A cell's `CellKept`, made for each instance (its `useId`) and let go when the cell leaves the screen. */
const cellKept = Atom.family((_instance: string) =>
  Atom.readable((): CellKept => {
    let shownInFull: string | undefined
    let kept: { readonly deps: ReadonlyArray<unknown>; readonly ref: RefCallback<HTMLDivElement> } | undefined
    return {
      // Upstream: a preview from the first draw while scrolling, a full cell once scrolling ends, and a preview again
      // only when the cell is drawn for another row while scrolling. Saying which row was last shown in full is the
      // same answer for the same draw, however often React draws it.
      isPreview: (rowId, isScrolling) => {
        if (!isScrolling) {
          shownInFull = rowId
          return false
        }
        return shownInFull !== rowId
      },
      ref: (deps, make) => {
        if (
          kept !== undefined &&
          kept.deps.length === deps.length &&
          kept.deps.every((dep, index) => Object.is(dep, deps[index]))
        ) {
          return kept.ref
        }
        const ref = make()
        kept = { deps, ref }
        return ref
      }
    }
  }).pipe(Atom.setIdleTTL(0))
)

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
  const isPreview = useAtomValue(cellKept(useId())).isPreview(rowId, isScrolling)

  if (writeCell) {
    return <DataGridWrittenCell key={rowId} {...props} writeCell={writeCell} />
  }

  if (isPreview && !props.isFocused && !props.isEditing && !hasCustomCell && !hasCustomDisplay) {
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

function DataGridWrittenCell<TData extends RowData>({ writeCell, ...props }: DataGridWrittenCellProps<TData>) {
  const { table } = props.cell
  const rowId = props.cell.row.id
  const columnId = props.cell.column.id
  // The node is written when it comes and on each update of its cell, until it goes: upstream's layout effect on the
  // same four.
  const ref = useAtomValue(cellKept(useId())).ref([table, rowId, columnId, writeCell], () => (element) => {
    if (element === null) return
    const write = () => {
      const row = table.getRowModel().rowsById[rowId]
      writeCell(element, row?.getValue(columnId))
    }
    write()
    return table.subscribeCell(rowId, columnId, write)
  })

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

// How many times each cell of a table on screen was updated, as an atom that subscribes to the table's cell while
// something reads it and lets go with its finalizer: one family per table, keyed by the cell's key.
const cellUpdates = new WeakMap<object, (cellKey: string) => Atom.Atom<number>>()

function cellUpdatesOf<TData extends RowData>(
  table: Cell<DataGridFeatures, TData>["table"],
  rowId: string,
  columnId: string
) {
  let family = cellUpdates.get(table)
  if (family === undefined) {
    family = Atom.family((cellKey: string) => {
      const position = parseCellKey(cellKey)
      return Atom.readable((get) => {
        let count = 0
        get.addFinalizer(table.subscribeCell(position.rowId, position.columnId, () => get.setSelf(++count)))
        return count
      })
    })
    cellUpdates.set(table, family)
  }
  return family(getCellKey(rowId, columnId))
}

// Live updates patch rows in place, so the `cell` prop never changes; this
// re-renders on each update and skips the compiler, which would cache on it.
function useUpdatedCell<TData extends RowData>(cell: Cell<DataGridFeatures, TData>) {
  "use no memo"
  const { table } = cell
  const rowId = cell.row.id
  const columnId = cell.column.id
  const updateCount = useAtomValue(cellUpdatesOf(table, rowId, columnId))

  if (updateCount === 0) return cell

  return table.getRowModel().rowsById[rowId]?.getAllCellsByColumnId()[columnId] ?? cell
}
