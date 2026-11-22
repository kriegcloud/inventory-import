"use client"
// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// What every row of one grid shares (whether columns stretch, the Firefox layout, the columns nobody may edit) comes in
// the `shared` prop, kept as one object by the grid while it says the same, where upstream handed it down in a React
// context. Rows no longer register their elements: the grid reads the drawn rows from the page when it needs the first
// one in view. A row is still drawn again only when its row, place or columns change, or `shared` does.

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
import { type ComponentProps, memo } from "react"

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

/** What every row of one grid is drawn with, the same object while none of it changes. */
export interface DataGridRowShared {
  stretchColumns: boolean
  adjustLayout: boolean
  readOnlyColumnIds: Set<string>
}

interface DataGridRowProps<TData extends RowData> extends ComponentProps<"div"> {
  row: Row<DataGridFeatures, TData>
  leafColumns: Column<DataGridFeatures, TData>[]
  virtualItem: VirtualItem
  columnWindow: ColumnWindow | null
  isScrolling: boolean
  shared: DataGridRowShared
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
    prev.isScrolling === next.isScrolling &&
    prev.shared === next.shared
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
  virtualItem,
  columnWindow,
  rowState,
  isScrolling,
  shared,
  className,
  style,
  ...props
}: DataGridRowContentProps<TData>) {
  const { stretchColumns, adjustLayout, readOnlyColumnIds } = shared
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

  return (
    <div
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      aria-selected={isRowSelected}
      data-index={virtualRowIndex}
      data-slot="data-grid-row"
      tabIndex={-1}
      {...props}
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
