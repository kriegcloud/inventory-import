// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// A row's ref callback, which files its element by index for the grid, is made once for each index of each grid and
// kept (`rowRefOf`), so React sees the same function across draws and calls it anew only when the row's index changes,
// as upstream's `useCallback` did; composing it with a caller's own ref is kept the same way (`composedRefOf`), in place
// of Radix's internal `useComposedRefs`. The utility cell's focus handler goes to a plain element, so it is a plain
// function. `DataGridRowContext` stays React context, read with `useContext`: it carries what the grid was drawn with
// down to its rows, which an atom could hold only if written during that draw or after it (batch 1, `faceted.tsx`).
"use client"

import type { VirtualItem } from "@tanstack/react-virtual"

import {
  type Cell,
  type CellSelectionBounds,
  type Column,
  type ColumnPinningPosition,
  flexRender,
  type Row,
  type RowData,
  Subscribe,
  type Table,
  type TableState
} from "@tanstack/react-table"
import { cn } from "cn"
import {
  type ComponentProps,
  createContext,
  memo,
  type Ref,
  type RefCallback,
  // oxlint-disable-next-line no-restricted-imports -- the rows read what the grid was drawn with (file header)
  useContext
} from "react"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { CellPresence, ColumnWindow, RowHeightValue } from "@inventory/ui/components/data-grid/data-grid-types"

import {
  CELL_TINTS,
  getCellLayoutStyle,
  getColumnBorderVisibility,
  getFocusedCellPosition,
  getIsDataColumn,
  getRowCellSelectionKey,
  getRowHeightValue,
  getWindowedColumns
} from "@inventory/ui/components/data-grid/data-grid-utils"
import { DataGridDataCell } from "@inventory/ui/components/data-grid/data-grid-data-cell"

const EMPTY_CELL_SELECTION_BOUNDS: CellSelectionBounds[] = []

interface DataGridRowContextValue {
  stretchColumns: boolean
  adjustLayout: boolean
  readOnlyColumnIds: Set<string>
  /** The grid's rows by index: a `useRef`, or any object of the grid's own whose `current` is that map. */
  rowMapRef: RowMapRef
}

interface RowMapRef {
  readonly current: Map<number, HTMLDivElement>
}

export const DataGridRowContext = createContext<DataGridRowContextValue | null>(null)

type RowRef = (node: HTMLDivElement | null) => void

const rowRefs = new WeakMap<RowMapRef, Map<number, RowRef>>()

/** The ref callback that files row `index`'s element in the grid's map, the same function for each index of a grid. */
function rowRefOf(rowMapRef: RowMapRef, index: number): RowRef {
  const byIndex = rowRefs.get(rowMapRef) ?? new Map<number, RowRef>()
  rowRefs.set(rowMapRef, byIndex)
  const kept = byIndex.get(index)
  if (kept !== undefined) return kept
  const ref: RowRef = (node) => {
    if (node) {
      rowMapRef.current.set(index, node)
    } else {
      rowMapRef.current.delete(index)
    }
  }
  byIndex.set(index, ref)
  return ref
}

type Cleanup = () => void

function setRef(ref: Ref<HTMLDivElement>, value: HTMLDivElement | null): Cleanup | undefined {
  if (typeof ref === "function") {
    const cleanup = ref(value)
    return typeof cleanup === "function" ? cleanup : undefined
  }
  if (ref !== null) ref.current = value
  return undefined
}

const composedRefs = new WeakMap<RowRef, WeakMap<object, RefCallback<HTMLDivElement>>>()

/**
 * The row's own ref and the caller's, as one ref callback: the same function while both are, as Radix's
 * `useComposedRefs` gave. A cleanup one of them returns runs when the row goes; a ref that returned none is set to null.
 */
function composedRefOf(ref: Ref<HTMLDivElement> | undefined, own: RowRef): Ref<HTMLDivElement> {
  if (ref === null || ref === undefined) return own
  const byRef = composedRefs.get(own) ?? new WeakMap<object, RefCallback<HTMLDivElement>>()
  composedRefs.set(own, byRef)
  const kept = byRef.get(ref)
  if (kept !== undefined) return kept
  const refs: ReadonlyArray<Ref<HTMLDivElement>> = [ref, own]
  const composed: RefCallback<HTMLDivElement> = (node) => {
    const set = refs.map((each) => ({ ref: each, cleanup: setRef(each, node) }))
    if (!set.some(({ cleanup }) => cleanup !== undefined)) return undefined
    return () => {
      for (const { ref: each, cleanup } of set) {
        if (cleanup !== undefined) cleanup()
        else setRef(each, null)
      }
    }
  }
  byRef.set(ref, composed)
  return composed
}

interface DataGridRowProps<TData extends RowData> extends ComponentProps<"div"> {
  row: Row<DataGridFeatures, TData>
  leafColumns: Column<DataGridFeatures, TData>[]
  virtualItem: VirtualItem
  columnWindow: ColumnWindow | null
  isScrolling: boolean
}

export const DataGridRow = memo(
  DataGridRowImpl,
  (prev, next) =>
    prev.row.id === next.row.id &&
    prev.row.original === next.row.original &&
    prev.leafColumns === next.leafColumns &&
    prev.virtualItem.index === next.virtualItem.index &&
    prev.virtualItem.start === next.virtualItem.start &&
    prev.columnWindow === next.columnWindow &&
    prev.isScrolling === next.isScrolling
) as typeof DataGridRowImpl

function DataGridRowImpl<TData extends RowData>({
  row,
  leafColumns: _leafColumns,
  virtualItem,
  ...props
}: DataGridRowProps<TData>) {
  // Re-renders on `leafColumns` changes so the selector re-reads the row's cells.
  "use no memo"
  const table = row.table
  const rowIndex = virtualItem.index

  return (
    <Subscribe source={table.store} selector={(state) => selectRowState(table, state, row, rowIndex)}>
      {(rowState) => <DataGridRowContent virtualItem={virtualItem} rowState={rowState} {...props} />}
    </Subscribe>
  )
}

interface RowState<TData extends RowData> {
  visibleCells: Cell<DataGridFeatures, TData>[]
  columnSizing: TableState<DataGridFeatures>["columnSizing"]
  rowHeight: RowHeightValue
  focusedColumnId: string | null
  editingColumnId: string | null
  cellSelectionKey: string
  searchMatchColumns: Set<string> | null
  activeSearchColumnId: string | null
  presenceColumns: Map<string, CellPresence> | null
  isRowSelected: boolean
}

function selectRowState<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
  state: TableState<DataGridFeatures>,
  row: Row<DataGridFeatures, TData>,
  rowIndex: number
): RowState<TData> {
  const rowId = row.id
  const activeRange = state.cellSelection[state.cellSelection.length - 1]
  const editingCell = state.editingCell
  const activeSearchMatch = table.getActiveSearchMatch()
  const cellSelectionBounds =
    table.options.enableSingleCellSelection || table.getHasCellRangeSelection()
      ? table.getCellSelectionBounds()
      : EMPTY_CELL_SELECTION_BOUNDS
  const isRowSelected = !!state.rowSelection[rowId]
  const currentRow = table.getRowModel().rows[rowIndex]

  return {
    visibleCells: (currentRow?.id === rowId ? currentRow : row).getVisibleCells(),
    columnSizing: state.columnSizing,
    rowHeight: state.rowHeight,
    focusedColumnId:
      state.focusedHeaderColumnId === null && activeRange?.anchorRowId === rowId ? activeRange.anchorColumnId : null,
    editingColumnId: editingCell?.rowId === rowId ? editingCell.columnId : null,
    cellSelectionKey:
      !isRowSelected && getHasKeys(state.rowSelection) ? "" : getRowCellSelectionKey(cellSelectionBounds, rowIndex),
    searchMatchColumns: table.getSearchMatchesByRowId().get(rowId) ?? null,
    activeSearchColumnId: activeSearchMatch?.rowId === rowId ? activeSearchMatch.columnId : null,
    presenceColumns: table.getCellPresenceByRowId().get(rowId) ?? null,
    isRowSelected
  }
}

function getHasKeys(object: object) {
  for (const _ in object) return true
  return false
}

interface DataGridRowContentProps<TData extends RowData> extends Omit<DataGridRowProps<TData>, "row" | "leafColumns"> {
  rowState: RowState<TData>
}

function DataGridRowContent<TData extends RowData>({
  ref,
  virtualItem,
  columnWindow,
  rowState,
  isScrolling,
  className,
  style,
  ...props
}: DataGridRowContentProps<TData>) {
  const { stretchColumns, adjustLayout, readOnlyColumnIds, rowMapRef } = useDataGridRowContext()
  const virtualRowIndex = virtualItem.index
  const {
    visibleCells,
    rowHeight,
    focusedColumnId,
    editingColumnId,
    cellSelectionKey,
    searchMatchColumns,
    activeSearchColumnId,
    presenceColumns,
    isRowSelected
  } = rowState

  const rowRef = composedRefOf(ref, rowRefOf(rowMapRef, virtualRowIndex))

  return (
    <div
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      aria-selected={isRowSelected}
      data-index={virtualRowIndex}
      data-slot="data-grid-row"
      tabIndex={-1}
      {...props}
      ref={rowRef}
      className={cn("absolute flex w-full border-b", className)}
      style={{
        height: `${getRowHeightValue(rowHeight)}px`,
        ...(adjustLayout ? { top: `${virtualItem.start}px` } : { transform: `translateY(${virtualItem.start}px)` }),
        ...style
      }}
    >
      {getWindowedColumns(visibleCells, columnWindow).map((entry) => {
        if (entry.type === "spacer") {
          return <div key={entry.key} aria-hidden="true" className="shrink-0" style={{ width: entry.size }} />
        }

        const { item: cell, colIndex: columnIndex } = entry
        const columnId = cell.column.id

        const isCellFocused = focusedColumnId === columnId
        const isCellEditing = editingColumnId === columnId
        const isCellSelected = cellSelectionKey !== "" && cell.getIsSelected()
        const isUtilityCell = !getIsDataColumn(cell.column)

        const isSearchMatch = searchMatchColumns?.has(columnId) ?? false
        const isActiveSearchMatch = activeSearchColumnId === columnId

        const nextCell = visibleCells[columnIndex + 1]
        const { showEndBorder, showStartBorder } = getColumnBorderVisibility({
          column: cell.column,
          nextColumn: nextCell?.column
        })

        const pinned = cell.column.getIsPinned()
        const pinnedOffset =
          pinned === "start" ? cell.column.getStart("start") : pinned === "end" ? cell.column.getAfter("end") : 0

        if (isUtilityCell) {
          const isSelectColumn = columnId === "select"

          return (
            <DataGridUtilityCell
              key={columnId}
              cell={cell}
              columnIndex={columnIndex}
              width={cell.column.getSize()}
              isFocused={isCellFocused}
              isRowSelected={isRowSelected}
              pinned={pinned}
              pinnedOffset={pinnedOffset}
              grow={stretchColumns && !isSelectColumn}
              showStartBorder={showStartBorder && !isSelectColumn}
              showEndBorder={showEndBorder && !isSelectColumn}
            />
          )
        }

        return (
          <DataGridDataCell
            key={columnId}
            cell={cell}
            columnIndex={columnIndex}
            width={cell.column.getSize()}
            rowHeight={rowHeight}
            isFocused={isCellFocused}
            isEditing={isCellEditing}
            isSelected={isCellSelected}
            isSearchMatch={isSearchMatch}
            isActiveSearchMatch={isActiveSearchMatch}
            presence={presenceColumns?.get(columnId) ?? null}
            readOnly={readOnlyColumnIds.has(columnId)}
            pinned={pinned}
            pinnedOffset={pinnedOffset}
            grow={stretchColumns}
            showStartBorder={showStartBorder}
            showEndBorder={showEndBorder}
            isScrolling={isScrolling}
          />
        )
      })}
    </div>
  )
}

function useDataGridRowContext() {
  const context = useContext(DataGridRowContext)
  if (!context) {
    throw new Error("`DataGridRow` must be rendered within `DataGrid`")
  }
  return context
}

interface DataGridUtilityCellProps<TData extends RowData> {
  cell: Cell<DataGridFeatures, TData>
  columnIndex: number
  width: number
  isFocused: boolean
  isRowSelected: boolean
  pinned: ColumnPinningPosition
  pinnedOffset: number
  grow: boolean
  showStartBorder: boolean
  showEndBorder: boolean
}

const DataGridUtilityCell = memo(DataGridUtilityCellImpl) as typeof DataGridUtilityCellImpl

function DataGridUtilityCellImpl<TData extends RowData>({
  cell,
  columnIndex,
  width,
  isFocused,
  isRowSelected,
  pinned,
  pinnedOffset,
  grow,
  showStartBorder,
  showEndBorder
}: DataGridUtilityCellProps<TData>) {
  // Utility renderers read row state, like selection, through the stable `cell`.
  "use no memo"
  function onFocus() {
    const { table, row, column } = cell
    const ranges = table.atoms.cellSelection.get()
    const focusedCell = getFocusedCellPosition(ranges)
    if (focusedCell?.rowId === row.id && focusedCell.columnId === column.id) {
      return
    }

    if (table.getHasRowSelection()) {
      table.setCellSelection([
        ...ranges.slice(0, -1),
        {
          anchorRowId: row.id,
          anchorColumnId: column.id,
          focusRowId: row.id,
          focusColumnId: column.id
        }
      ])
      return
    }

    table.setFocusedCell(row.id, column.id)
  }

  return (
    <div
      role="gridcell"
      aria-colindex={columnIndex + 1}
      data-slot="data-grid-cell"
      data-utility=""
      data-row-id={cell.row.id}
      data-column-id={cell.column.id}
      data-focused={isFocused ? "" : undefined}
      tabIndex={-1}
      onFocus={onFocus}
      className={cn("h-full px-3 pt-1.75 pb-2 outline-none", {
        grow,
        "border-s": showStartBorder,
        "border-e": showEndBorder,
        "bg-background": !isRowSelected,
        [CELL_TINTS.tinted]: isRowSelected,
        [CELL_TINTS.selected]: isRowSelected,
        "ring-1 ring-ring ring-inset": isFocused
      })}
      style={getCellLayoutStyle({ width, pinned, pinnedOffset })}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  )
}
