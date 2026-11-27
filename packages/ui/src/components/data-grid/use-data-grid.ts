// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// One grid on screen is one instance, made for its `useId` (`gridInstance`): what upstream kept in refs (the table, the
// two virtualizers, the rows by index, the focus waiting for a row, the pending edit) is that instance's own, and its
// handlers are made once with it and read, when they run, the props of the last commit, as upstream's refs did. The
// listeners upstream's effects added are added when React gives the grid its element (`dataGridRef` starts them as
// its node is set, `onScreenRef`) and removed when it takes the element back; what upstream ran after a commit runs
// after a commit of the table (`afterEachCommit`, `afterCommitOf`); what upstream did on unmount is the finalizer of
// `gridMounted`.
//
// The rule this file protects: the handlers handed to the rows and cells keep one identity for the grid's life (the
// rows are `React.memo` with identity compares), and every value upstream memoized keeps its identity exactly while
// what it was worked out from does (`keepOne`).
import { useAtomMount, useAtomValue } from "@effect/atom-react"
import type { Virtualizer, VirtualizerOptions } from "@tanstack/react-virtual"

import {
  type CellSelectionState,
  type ColumnDef,
  type ColumnVisibilityState,
  functionalUpdate,
  makeStateUpdater,
  type ReactTable,
  type RowData,
  type RowSelectionState,
  type Table,
  type TableOptions,
  type TableState,
  type Updater,
  useTable
} from "@tanstack/react-table"
import * as Match from "effect/Match"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
// Local change: `Result`, for the `try` statement upstream has here (none in this repository).
import * as Result from "effect/Result"
import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SyntheticEvent,
  useId
} from "react"
import { toast } from "sonner"

import type {
  CellPosition,
  ClipboardNotice,
  CreateRowDetails,
  DataChangeDetails,
  NavigationDirection
} from "@inventory/ui/components/data-grid/data-grid-types"

import { type DataGridFeatures, dataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import {
  afterCommitOf,
  afterEachCommit,
  getIsFirefox,
  type Keep,
  keepOne,
  onScreenRef
} from "@inventory/ui/components/data-grid/data-grid-state"
import {
  getCellElement,
  getCellFocusTarget,
  getCellKey,
  getFocusedCellPosition,
  getHasCellRangeSelection,
  getIsDataColumn,
  getIsEditableTarget,
  getIsEventOnScrollbar,
  getIsInPopover,
  getRowDisplayIndex,
  getSelectionEdgePosition,
  renderDefaultCell,
  revokeFileObjectUrls,
  scrollCellIntoView,
  // Local change: `settle`, for the `try` statement upstream has here.
  settle
} from "@inventory/ui/components/data-grid/data-grid-utils"
import { useDirection } from "@inventory/ui/components/direction"

const OVERSCAN = 6
const VIEWPORT_OFFSET = 1
const MIN_COLUMN_SIZE = 60
const MAX_COLUMN_SIZE = 800
const COLUMN_RESIZE_STEP = 10
const AUTO_SCROLL_EDGE_ZONE = 50
const AUTO_SCROLL_SPEED_RAMP_ZONE = AUTO_SCROLL_EDGE_ZONE * 3
const AUTO_SCROLL_MIN_SPEED = 8
const AUTO_SCROLL_MAX_SPEED = 40
const AUTO_SCROLL_SELECTION_THROTTLE_MS = 32
const UTILITY_COLUMN_IDS = new Set(["select", "actions"])
const SEARCH_SHORTCUT_KEY = "f"

interface UseDataGridProps<TData extends RowData> extends Omit<TableOptions<DataGridFeatures, TData>, "features"> {
  overscan?: number
  autoFocus?: boolean | Partial<CellPosition>
  onEscapeKeyDown?: (event: KeyboardEvent) => void
}

type Direction = ReturnType<typeof useDirection>

/** The props the hook hands on to the table as they are (everything but what it reads itself). */
type GridRestProps<TData extends RowData> = Omit<
  UseDataGridProps<TData>,
  "data" | "columns" | "overscan" | "dir" | "onEscapeKeyDown"
>

/** What one draw of the grid's owner was given, and worked out from it before the table. */
interface GridDraw<TData extends RowData> {
  readonly props: GridRestProps<TData>
  readonly dataProp: TableOptions<DataGridFeatures, TData>["data"]
  readonly data: TableOptions<DataGridFeatures, TData>["data"]
  readonly columns: TableOptions<DataGridFeatures, TData>["columns"]
  readonly dir: Direction
  readonly onEscapeKeyDown: ((event: KeyboardEvent) => void) | undefined
}

/** An edit the grid made that the caller's `data` has not caught up with yet: shown until the caller's data moves. */
interface PendingEdit<TData extends RowData> {
  readonly from: TableOptions<DataGridFeatures, TData>["data"]
  readonly to: TableOptions<DataGridFeatures, TData>["data"]
}

type SelectedTableState = ReturnType<typeof selectTableState>

/** What `useDataGrid` hands `DataGrid`, as upstream's hook returned it. */
interface DataGridState<TData extends RowData> {
  readonly table: ReactTable<DataGridFeatures, TData, SelectedTableState>
  readonly dataGridRef: RefObject<HTMLDivElement | null>
  readonly headerRef: RefObject<HTMLDivElement | null>
  readonly footerRef: RefObject<HTMLDivElement | null>
  readonly rowMapRef: RefObject<Map<number, HTMLDivElement>>
  readonly rowVirtualizerRef: RefObject<Virtualizer<HTMLDivElement, Element> | null>
  readonly columnVirtualizerRef: RefObject<Virtualizer<HTMLDivElement, Element> | null>
  readonly rowVirtualizerOptions: Pick<VirtualizerOptions<HTMLDivElement, Element>, "overscan">
  readonly dataGridBodyProps: ComponentProps<"div"> & { readonly style: CSSProperties }
  readonly columnSizeVars: { readonly [key: string]: number }
  readonly dir: Direction
  readonly adjustLayout: boolean
  readonly onRowAdd: Grid<TData>["handlers"]["onRowAdd"] | undefined
}

/** One grid on screen: its boxes, its handlers (made once) and the slots that keep what upstream memoized. */
interface Grid<TData extends RowData> {
  readonly registry: AtomRegistry.AtomRegistry
  readonly dataGridRef: RefObject<HTMLDivElement | null>
  readonly headerRef: RefObject<HTMLDivElement | null>
  readonly footerRef: RefObject<HTMLDivElement | null>
  readonly rowMapRef: RefObject<Map<number, HTMLDivElement>>
  readonly rowVirtualizerRef: RefObject<Virtualizer<HTMLDivElement, Element> | null>
  readonly columnVirtualizerRef: RefObject<Virtualizer<HTMLDivElement, Element> | null>
  /** The table as it was first drawn, as upstream's `tableRef` held it. */
  readonly tableRef: RefObject<Table<DataGridFeatures, TData> | null>
  readonly pendingFocusRef: RefObject<{ readonly cell: CellPosition; readonly shouldScroll: boolean } | null>
  /** What the latest draw was given; `committed` is it once committed, which the handlers read, as upstream's refs. */
  readonly rendered: RefObject<GridDraw<TData> | null>
  readonly committed: RefObject<GridDraw<TData> | null>
  readonly pendingEdit: Atom.Writable<PendingEdit<TData> | null>
  readonly handlers: ReturnType<typeof gridHandlers<TData>>
  readonly keep: {
    readonly stableProps: Keep<GridRestProps<TData>>
    readonly columns: Keep<TableOptions<DataGridFeatures, TData>["columns"]>
    readonly options: Keep<TableOptions<DataGridFeatures, TData>>
    readonly sizes: Keep<{ readonly [key: string]: number }>
    readonly virtualizer: Keep<Pick<VirtualizerOptions<HTMLDivElement, Element>, "overscan">>
    readonly body: Keep<ComponentProps<"div"> & { readonly style: CSSProperties }>
    readonly result: Keep<DataGridState<TData>>
  }
}

function makeGrid<TData extends RowData>(registry: AtomRegistry.AtomRegistry): Grid<TData> {
  // The listeners start once React has drawn the grid's element and set it here, and stop when it takes it back.
  let self: Grid<TData> | null = null
  const boxes = {
    registry,
    dataGridRef: onScreenRef((node) => (self === null ? () => undefined : startOnScreen(self, node))),
    headerRef: { current: null },
    footerRef: { current: null },
    rowMapRef: { current: new Map<number, HTMLDivElement>() },
    rowVirtualizerRef: { current: null },
    columnVirtualizerRef: { current: null },
    tableRef: { current: null },
    pendingFocusRef: { current: null },
    rendered: { current: null },
    committed: { current: null },
    pendingEdit: Atom.make<PendingEdit<TData> | null>(null).pipe(Atom.setIdleTTL("1 second"))
  } satisfies Omit<Grid<TData>, "handlers" | "keep">
  const grid: Grid<TData> = {
    ...boxes,
    handlers: gridHandlers(boxes),
    keep: {
      stableProps: keepOne(),
      columns: keepOne(),
      options: keepOne(),
      sizes: keepOne(),
      virtualizer: keepOne(),
      body: keepOne(),
      result: keepOne()
    }
  }
  self = grid
  return grid
}

/**
 * One grid on screen, made for its `useId` (a new one for each mount), and let go a second after nothing reads it:
 * long enough that the time between a draw and its commit never makes it anew, which would hand the rows a second
 * instance's boxes.
 */
const gridInstance = Atom.family((_instance: string) =>
  Atom.readable((get): Grid<any> => makeGrid<any>(get.registry)).pipe(Atom.setIdleTTL("1 second"))
)

/**
 * While the grid's owner is mounted, whether or not the grid's element is on screen (the same table may be shown as
 * cards): what the handlers read is what the last commit drew, as upstream's refs held it. When it leaves, what is
 * being edited is written and the files it made let go.
 */
const gridMounted = Atom.family((instance: string) =>
  Atom.readable((get) => {
    const grid = get(gridInstance(instance))
    const owned = grid.tableRef.current
    if (owned !== null) {
      grid.committed.current = grid.rendered.current
      get.addFinalizer(
        afterEachCommit(owned, () => {
          grid.committed.current = grid.rendered.current
        })
      )
    }
    get.addFinalizer(() => {
      const table = grid.tableRef.current
      if (table === null) return
      table.commitCellUpdates()
      revokeFileObjectUrls(table, grid.committed.current?.dataProp)
    })
  }).pipe(Atom.setIdleTTL(0))
)

/** Starts what upstream's effects did on the grid's element and the page, and returns what stops it all. */
function startOnScreen<TData extends RowData>(grid: Grid<TData>, container: HTMLDivElement): () => void {
  const finalizers: (() => void)[] = []
  listenOnScreen(grid, container, (finalizer) => {
    finalizers.push(finalizer)
  })
  return () => {
    for (const finalizer of finalizers) finalizer()
  }
}

function addRowOf<TData extends RowData>(grid: Omit<Grid<TData>, "handlers" | "keep">, focusCell: FocusCell) {
  return async (trigger: CreateRowDetails, columnId: string | undefined) => {
    const { readOnly, createRow } = grid.committed.current?.props ?? {}
    if (readOnly || !createRow) return

    // Local change: `settle` where upstream has a `try` statement; a refused new row says why, as upstream's did.
    const created = await settle(
      () => createRow(trigger),
      (error) => (error instanceof Error ? error.message : "Failed to add row")
    )
    if (Result.isFailure(created)) {
      toast.error(created.failure)
      return
    }
    const row: TData | null = created.success
    const currentTable = grid.tableRef.current
    if (!row || !currentTable) return

    const [rowId] = currentTable.addRows(
      [row],
      trigger.reason === "insert-below" ? { afterRowId: trigger.afterRowId } : undefined
    )
    if (!rowId || !columnId) return

    currentTable.clearSelection()
    focusCell(rowId, columnId)
  }
}

type FocusCell = (rowId: string, columnId: string) => void

/**
 * What the grid does with a press, a key or a change of the table, made once per grid: each reads the table and the
 * props as they are when it runs, so none has to be made again when they change.
 */
function gridHandlers<TData extends RowData>(grid: Omit<Grid<TData>, "handlers" | "keep">) {
  const { tableRef, dataGridRef, headerRef, rowVirtualizerRef, columnVirtualizerRef, pendingFocusRef } = grid
  const props = () => grid.committed.current?.props
  const isRtl = () => grid.committed.current?.dir === "rtl"

  function onDataChange(nextData: TData[], details: DataChangeDetails<TData>) {
    const dataProp = grid.committed.current?.dataProp ?? nextData
    grid.registry.set(grid.pendingEdit, { from: dataProp, to: nextData })
    props()?.onDataChange?.(nextData, details)
  }

  function getRowIdAtDisplayIndex(displayIndex: number) {
    return tableRef.current?.getRowModel().rows[displayIndex]?.id
  }

  function getCellSelection(): CellSelectionState {
    return tableRef.current?.atoms.cellSelection.get() ?? []
  }

  function getFocusedCell() {
    return getFocusedCellPosition(getCellSelection())
  }

  function revealCell(
    cell: CellPosition,
    { shouldFocus, shouldScroll }: { readonly shouldFocus: boolean; readonly shouldScroll: boolean }
  ) {
    const currentTable = tableRef.current
    const container = dataGridRef.current
    if (!currentTable || !container) return false

    const rowIndex = getRowDisplayIndex(currentTable, cell.rowId)
    if (rowIndex === -1) return false

    if (shouldScroll) {
      rowVirtualizerRef.current?.scrollToIndex(rowIndex, { align: "auto" })
    }

    const cellElement = getCellElement(container, cell.rowId, cell.columnId)
    if (!cellElement) {
      const centerIndex = currentTable.getCenterVisibleLeafColumns().findIndex((column) => column.id === cell.columnId)
      if (shouldScroll && centerIndex !== -1) {
        columnVirtualizerRef.current?.scrollToIndex(centerIndex, {
          align: "auto"
        })
      }
      return false
    }

    if (shouldScroll) {
      scrollCellIntoView({
        container,
        targetCell: cellElement,
        tableRef,
        viewportOffset: VIEWPORT_OFFSET,
        isRtl: isRtl()
      })
    }
    if (shouldFocus) {
      getCellFocusTarget(cellElement).focus({ preventScroll: true })
    }
    return true
  }

  function focusCellElement(cell: CellPosition, shouldScroll = true) {
    if (tableRef.current?.getSearchOpen()) return

    if (revealCell(cell, { shouldFocus: true, shouldScroll })) {
      pendingFocusRef.current = null
      return
    }

    pendingFocusRef.current = { cell, shouldScroll }
    const container = dataGridRef.current
    if (container && document.activeElement !== container) {
      container.focus({ preventScroll: true })
    }
  }

  function focusCell(rowId: string, columnId: string) {
    tableRef.current?.setFocusedCell(rowId, columnId)
    tableRef.current?.setEditingCell(null)
    focusCellElement({ rowId, columnId })
  }

  function getColumnIds() {
    return tableRef.current?.getVisibleLeafColumns().map((column) => column.id) ?? []
  }

  function getIsDataColumnId(columnId: string) {
    return getIsDataColumn(tableRef.current?.getAllFlatColumnsById()[columnId])
  }

  function getNavigableColumnIds() {
    return getColumnIds().filter(getIsDataColumnId)
  }

  function selectRange(start: CellPosition, end: CellPosition) {
    tableRef.current?.selectCellRange({
      anchorRowId: start.rowId,
      anchorColumnId: start.columnId,
      focusRowId: end.rowId,
      focusColumnId: end.columnId
    })
  }

  function onRowsDelete(rowIds: string[]) {
    tableRef.current?.deleteRows(rowIds)
    tableRef.current?.endCellDrag()
  }

  function startEditing(rowId: string, columnId: string) {
    const cellsByColumnId = tableRef.current?.getCoreRowModel().rowsById[rowId]?.getAllCellsByColumnId()
    cellsByColumnId?.[columnId]?.startEditing()
  }

  function blurCell() {
    if (tableRef.current?.getEditingCell() && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    tableRef.current?.resetCellSelection(true)
    tableRef.current?.setEditingCell(null)
  }

  function onCellClick(rowId: string, columnId: string, event?: ReactMouseEvent) {
    if (event?.button === 2) return

    const currentTable = tableRef.current
    if (!currentTable) return

    const ranges = currentTable.atoms.cellSelection.get()
    const currentFocused = getFocusedCellPosition(ranges)

    if (event) {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        currentTable.selectCellRange(
          {
            anchorRowId: rowId,
            anchorColumnId: columnId,
            focusRowId: rowId,
            focusColumnId: columnId
          },
          {
            mode: currentTable.getIsCellSelected(rowId, columnId) ? "exclude" : "include"
          }
        )
        currentTable.setEditingCell(null)
        focusCellElement({ rowId, columnId })
        return
      }

      if (event.shiftKey && currentFocused) {
        event.preventDefault()
        currentTable.extendCellSelectionTo({ rowId, columnId })
        focusCellElement(currentFocused, false)
        return
      }
    }

    if (columnId !== "select") currentTable.clearRowSelection()

    if (!getHasCellRangeSelection(ranges) && currentFocused?.rowId === rowId && currentFocused?.columnId === columnId) {
      startEditing(rowId, columnId)
    } else {
      focusCell(rowId, columnId)
    }
  }

  function onCellDoubleClick(rowId: string, columnId: string, event?: ReactMouseEvent) {
    if (event?.defaultPrevented) return

    startEditing(rowId, columnId)
  }

  function onCellMouseDown(rowId: string, columnId: string, event: ReactMouseEvent) {
    if (event.button === 2) return

    event.preventDefault()

    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
      tableRef.current?.startCellDrag({ rowId, columnId })
    }
  }

  function onCellMouseEnter(rowId: string, columnId: string) {
    const dragStartCell = tableRef.current?.getCellDragAnchor()
    if (!dragStartCell) return

    const currentFocused = getFocusedCell()
    if (currentFocused?.rowId !== dragStartCell.rowId || currentFocused?.columnId !== dragStartCell.columnId) {
      tableRef.current?.setEditingCell(null)
      focusCellElement(dragStartCell, false)
    }

    selectRange(dragStartCell, { rowId, columnId })
  }

  function onCellMouseUp() {
    tableRef.current?.endCellDrag()
  }

  function onCellContextMenu(rowId: string, columnId: string, event: ReactMouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    const currentTable = tableRef.current
    if (!currentTable) return
    if (!currentTable.getIsCellSelected(rowId, columnId)) {
      currentTable.setFocusedCell(rowId, columnId)
    }
    currentTable.openContextMenu({ x: event.clientX, y: event.clientY })
  }

  function onColumnVisibilityChange(updater: Updater<ColumnVisibilityState>) {
    const currentTable = tableRef.current
    if (!currentTable) return
    makeStateUpdater("columnVisibility", currentTable)(updater)

    const focusedColumnId = getFocusedCell()?.columnId
    if (focusedColumnId && currentTable.atoms.columnVisibility.get()[focusedColumnId] === false) {
      currentTable.resetCellSelection(true)
      currentTable.setEditingCell(null)
    }

    props()?.onColumnVisibilityChange?.(updater)
  }

  function onRowSelectionChange(updater: Updater<RowSelectionState>) {
    const currentTable = tableRef.current
    if (!currentTable) return
    const newRowSelection = functionalUpdate(updater, currentTable.atoms.rowSelection.get())

    const firstColumnId = getNavigableColumnIds()[0]
    const lastColumnId = getNavigableColumnIds().at(-1)
    const rows = currentTable.getRowModel().rows
    const ranges: CellSelectionState = []

    if (firstColumnId && lastColumnId) {
      let runStartRowId: string | null = null
      for (let rowIndex = 0; rowIndex <= rows.length; rowIndex++) {
        const row = rows[rowIndex]
        const isSelected = row ? !!newRowSelection[row.id] : false

        if (isSelected && row && runStartRowId === null) {
          runStartRowId = row.id
        } else if (!isSelected && runStartRowId !== null) {
          const runEndRowId = rows[rowIndex - 1]?.id ?? runStartRowId
          ranges.push({
            anchorRowId: runStartRowId,
            anchorColumnId: firstColumnId,
            focusRowId: runEndRowId,
            focusColumnId: lastColumnId
          })
          runStartRowId = null
        }
      }
    }

    const focusedCell = getFocusedCell()
    const isUtilityCellFocused = focusedCell !== null && !getIsDataColumnId(focusedCell.columnId)
    // The focused cell stays the active range so selecting rows elsewhere doesn't move focus and scroll to them.
    if (focusedCell) {
      ranges.push({
        anchorRowId: focusedCell.rowId,
        anchorColumnId: focusedCell.columnId,
        focusRowId: focusedCell.rowId,
        focusColumnId: focusedCell.columnId
      })
    }

    makeStateUpdater("rowSelection", currentTable)(newRowSelection)
    currentTable.setCellSelection(ranges)
    if (!isUtilityCellFocused) {
      currentTable.setEditingCell(null)
    }

    props()?.onRowSelectionChange?.(updater)
  }

  // The body's handlers, made once: the hovered cell is this grid's own.
  let hoveredCellKey: string | null = null

  function getEventCell(event: SyntheticEvent) {
    const container = dataGridRef.current
    const target = event.target
    if (!container || !(target instanceof Element)) return null
    if (!container.contains(target)) return null

    // Utility cells manage their own pointer and focus events.
    const cellElement = target.closest<HTMLElement>('[data-slot="data-grid-cell"]:not([data-utility])')
    if (!cellElement) return null

    const { rowId, columnId } = cellElement.dataset
    if (!rowId || !columnId) return null

    const editingCell = tableRef.current?.getEditingCell()
    if (editingCell?.rowId === rowId && editingCell.columnId === columnId) {
      return null
    }
    return { rowId, columnId }
  }

  function getPressedCell(event: ReactMouseEvent<HTMLElement>) {
    if (getIsEventOnScrollbar(event)) return null
    return getEventCell(event)
  }

  const dataGridBodyEventHandlers: ComponentProps<"div"> = {
    onClick: (event) => {
      const cell = getPressedCell(event)
      if (!cell) return
      event.preventDefault()
      onCellClick(cell.rowId, cell.columnId, event)
    },
    onDoubleClick: (event) => {
      const cell = getPressedCell(event)
      if (!cell) return
      event.preventDefault()
      onCellDoubleClick(cell.rowId, cell.columnId)
    },
    onMouseDown: (event) => {
      const cell = getPressedCell(event)
      if (cell) onCellMouseDown(cell.rowId, cell.columnId, event)
    },
    onMouseOver: (event) => {
      const cell = getEventCell(event)
      const cellKey = cell ? getCellKey(cell.rowId, cell.columnId) : null
      if (cellKey === hoveredCellKey) return
      hoveredCellKey = cellKey
      if (cell) onCellMouseEnter(cell.rowId, cell.columnId)
    },
    onMouseLeave: () => {
      hoveredCellKey = null
    },
    onMouseUp: (event) => {
      if (getEventCell(event)) onCellMouseUp()
    },
    onContextMenu: (event) => {
      const cell = getEventCell(event)
      if (cell) onCellContextMenu(cell.rowId, cell.columnId, event)
    }
  }

  function skipDataGridTabStop() {
    const container = dataGridRef.current
    if (!container) return

    container.tabIndex = -1
    requestAnimationFrame(() => {
      container.tabIndex = 0
    })
  }

  const addRow = addRowOf(grid, focusCell)

  function onRowAdd(event?: ReactMouseEvent<HTMLDivElement> | ReactKeyboardEvent<HTMLDivElement>) {
    return addRow({ reason: "add-row-press", event }, getNavigableColumnIds().find(getIsDataColumnId))
  }

  function getColumnHeaderTrigger(columnId: string) {
    return (
      headerRef.current?.querySelector<HTMLElement>(
        `[data-slot="data-grid-header-cell"][data-column-id="${CSS.escape(columnId)}"] :is(button, [role="checkbox"])`
      ) ?? null
    )
  }

  function focusColumnHeader(columnId: string) {
    const trigger = getColumnHeaderTrigger(columnId)
    if (!trigger) return false

    tableRef.current?.resetCellSelection(true)
    tableRef.current?.clearRowSelection()
    tableRef.current?.setEditingCell(null)
    trigger.focus()
    return true
  }

  function onColumnHeaderKeyDown(event: KeyboardEvent, columnId: string) {
    const { key, shiftKey, ctrlKey, metaKey, altKey } = event
    const isHorizontalArrow = key === "ArrowLeft" || key === "ArrowRight"
    if (ctrlKey || metaKey || (altKey && (shiftKey || !isHorizontalArrow))) {
      return false
    }

    const headerColumnIds = getColumnIds().filter((id) => getColumnHeaderTrigger(id))
    const headerIndex = headerColumnIds.indexOf(columnId)
    if (headerIndex === -1) return false

    const rtl = isRtl()

    function focusColumnHeaderAt(index: number) {
      const targetColumnId = headerColumnIds[index]
      if (targetColumnId) focusColumnHeader(targetColumnId)
    }

    function resizeColumnBy(delta: number) {
      const currentTable = tableRef.current
      const column = currentTable?.getColumn(columnId)
      if (!currentTable || !column?.getCanResize()) return

      const defaultColumnDef = currentTable.getDefaultColumnDef()
      const minSize = column.columnDef.minSize ?? defaultColumnDef.minSize ?? 0
      const maxSize = column.columnDef.maxSize ?? defaultColumnDef.maxSize ?? Number.POSITIVE_INFINITY
      const size = Math.min(Math.max(column.getSize() + delta, minSize), maxSize)
      currentTable.setColumnSizing((prev) => ({ ...prev, [columnId]: size }))
    }

    // Local change: the key is read with `effect/Match` instead of a `switch`. Each key answers what the handler
    // does with the event: "prevent" (handled, and the browser's own action is stopped), "keep" (handled, the
    // browser's action stands) or "ignore" (not a key the header takes).
    type Handled = "prevent" | "keep" | "ignore"
    const handled = Match.value(key).pipe(
      Match.when(Match.is("ArrowLeft", "ArrowRight"), (arrow): Handled => {
        const step = (arrow === "ArrowRight") !== rtl ? 1 : -1
        if (altKey) {
          resizeColumnBy(step * COLUMN_RESIZE_STEP)
        } else if (shiftKey) {
          const column = tableRef.current?.getColumn(columnId)
          column?.move(step)
        } else {
          focusColumnHeaderAt(headerIndex + step)
        }
        return "prevent"
      }),
      Match.when("Home", (): Handled => {
        focusColumnHeaderAt(0)
        return "prevent"
      }),
      Match.when("End", (): Handled => {
        focusColumnHeaderAt(headerColumnIds.length - 1)
        return "prevent"
      }),
      Match.when("ArrowUp", (): Handled => "prevent"),
      Match.when("ArrowDown", (): Handled => {
        // Stops the menu trigger from opening its menu.
        event.stopPropagation()
        const firstRowId = getRowIdAtDisplayIndex(0)
        if (!firstRowId) return "prevent"
        tableRef.current?.clearRowSelection()
        focusCell(firstRowId, columnId)
        return "prevent"
      }),
      Match.when("Escape", (): Handled => {
        dataGridRef.current?.focus()
        return "prevent"
      }),
      Match.when("Tab", (): Handled => {
        if (shiftKey) {
          if (headerIndex === 0) {
            skipDataGridTabStop()
            return "keep"
          }
          focusColumnHeaderAt(headerIndex - 1)
        } else if (headerIndex < headerColumnIds.length - 1) {
          focusColumnHeaderAt(headerIndex + 1)
        } else {
          const firstRowId = getRowIdAtDisplayIndex(0)
          const firstColumnId = getNavigableColumnIds()[0]
          if (!firstRowId || !firstColumnId) return "keep"
          tableRef.current?.clearRowSelection()
          focusCell(firstRowId, firstColumnId)
        }
        return "prevent"
      }),
      Match.orElse((): Handled => "ignore")
    )
    if (handled === "ignore") return false
    if (handled === "keep") return true

    event.preventDefault()
    return true
  }

  function onDataGridKeyDown(event: KeyboardEvent) {
    const currentTable = tableRef.current
    if (!currentTable) return
    const gridProps = props()

    const cellSelection = currentTable.atoms.cellSelection.get()
    const focusedCell = getFocusedCellPosition(cellSelection)
    const hasCellRangeSelection = getHasCellRangeSelection(cellSelection)
    const { key, ctrlKey, metaKey, shiftKey, altKey } = event
    const isCtrlPressed = ctrlKey || metaKey

    if (currentTable.options.enableSearch && isCtrlPressed && !shiftKey && key === SEARCH_SHORTCUT_KEY) {
      event.preventDefault()
      currentTable.openSearch()
      return
    }

    if (currentTable.getSearchOpen() && !currentTable.getEditingCell()) {
      if (key === "Enter") {
        event.preventDefault()
        if (shiftKey) {
          currentTable.goToPrevSearchMatch()
        } else {
          currentTable.goToNextSearchMatch()
        }
        return
      }
      if (key === "Escape") {
        event.preventDefault()
        currentTable.closeSearch()
        return
      }
      return
    }

    if (currentTable.getEditingCell()) return

    const headerCell =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-slot="data-grid-header-cell"]') : null
    const headerColumnId = headerCell?.dataset.columnId
    if (headerColumnId && onColumnHeaderKeyDown(event, headerColumnId)) {
      return
    }

    if (
      isCtrlPressed &&
      (key === "Backspace" || key === "Delete") &&
      !gridProps?.readOnly &&
      gridProps?.enableRowDeletion
    ) {
      const rowIds = new Set<string>()

      if (currentTable.getHasRowSelection()) {
        const rowSelection = currentTable.atoms.rowSelection.get()
        for (const row of currentTable.getRowModel().rows) {
          if (rowSelection[row.id]) rowIds.add(row.id)
        }
      } else if (hasCellRangeSelection) {
        for (const { rowId } of currentTable.getSelectedCells()) {
          rowIds.add(rowId)
        }
      } else if (focusedCell) {
        rowIds.add(focusedCell.rowId)
      }

      if (rowIds.size > 0) {
        event.preventDefault()
        onRowsDelete(Array.from(rowIds))
      }
      return
    }

    if (!focusedCell) return

    if (!headerColumnId && (key === "ContextMenu" || (shiftKey && key === "F10"))) {
      event.preventDefault()
      const container = dataGridRef.current
      const cellElement = container && getCellElement(container, focusedCell.rowId, focusedCell.columnId)
      if (!cellElement) return
      const rect = cellElement.getBoundingClientRect()
      currentTable.openContextMenu({
        x: isRtl() ? rect.right : rect.left,
        y: rect.bottom
      })
      return
    }

    let direction: NavigationDirection | null = null

    const isUtilityCellFocused = !getIsDataColumnId(focusedCell.columnId)

    if (
      isUtilityCellFocused &&
      shiftKey &&
      (key.startsWith("Arrow") || key === "Home" || key === "End" || key === "PageUp" || key === "PageDown")
    ) {
      event.preventDefault()
      return
    }

    const canCopyCells = !isUtilityCellFocused || currentTable.getHasRowSelection()

    if (isCtrlPressed && !shiftKey && key === "a") {
      event.preventDefault()
      currentTable.selectAllDataCells()
      return
    }

    if (isCtrlPressed && !shiftKey && key === "c" && canCopyCells) {
      event.preventDefault()
      void currentTable.copySelectedCells()
      return
    }

    if (isCtrlPressed && !shiftKey && key === "x" && canCopyCells && !gridProps?.readOnly) {
      event.preventDefault()
      void currentTable.cutSelectedCells()
      return
    }

    if (
      gridProps?.enablePaste &&
      isCtrlPressed &&
      !shiftKey &&
      key === "v" &&
      !isUtilityCellFocused &&
      !gridProps.readOnly
    ) {
      event.preventDefault()
      void currentTable.pasteCells()
      return
    }

    if ((key === "Delete" || key === "Backspace") && !isCtrlPressed && !isUtilityCellFocused && !gridProps?.readOnly) {
      const cellsToClear = currentTable.getSelectedCells()

      if (cellsToClear.length > 0) {
        event.preventDefault()

        currentTable.clearCells(cellsToClear)

        if (hasCellRangeSelection) {
          currentTable.clearSelection()
        }

        if (currentTable.getCutCellGrid().length) {
          currentTable.resetCutCellGrid(true)
        }
      }
      return
    }

    if (key === "Enter" && shiftKey && !gridProps?.readOnly && gridProps?.createRow) {
      event.preventDefault()
      const currentColumnId = isUtilityCellFocused ? getNavigableColumnIds()[0] : focusedCell.columnId

      void addRow({ reason: "insert-below", event, afterRowId: focusedCell.rowId }, currentColumnId)
      return
    }

    const rtl = isRtl()

    // Local change: the key is read with `effect/Match` instead of a `switch`. Each key answers the direction to
    // move in, or null when it moves nowhere (the key was handled another way, or is not one the grid takes).
    type Move = NavigationDirection | null
    direction = Match.value(key).pipe(
      Match.when("ArrowUp", (): Move => {
        if (altKey && !isCtrlPressed && !shiftKey) return "pageup"
        if (isCtrlPressed) return "ctrl+up"
        if (
          !shiftKey &&
          getRowDisplayIndex(currentTable, focusedCell.rowId) === 0 &&
          focusColumnHeader(focusedCell.columnId)
        ) {
          event.preventDefault()
          return null
        }
        return "up"
      }),
      Match.when("ArrowDown", (): Move => {
        if (altKey && !isCtrlPressed && !shiftKey) return "pagedown"
        return isCtrlPressed ? "ctrl+down" : "down"
      }),
      Match.when("ArrowLeft", (): Move => {
        if (isCtrlPressed) return rtl ? "end" : "home"
        return "left"
      }),
      Match.when("ArrowRight", (): Move => {
        if (isCtrlPressed) return rtl ? "home" : "end"
        return "right"
      }),
      Match.when("Home", (): Move => (isCtrlPressed ? "ctrl+home" : "home")),
      Match.when("End", (): Move => (isCtrlPressed ? "ctrl+end" : "end")),
      Match.when("PageUp", (): Move => (altKey ? "pageleft" : "pageup")),
      Match.when("PageDown", (): Move => (altKey ? "pageright" : "pagedown")),
      Match.when("Escape", (): Move => {
        if (event.defaultPrevented) return null
        event.preventDefault()
        if (hasCellRangeSelection || currentTable.getHasRowSelection()) {
          currentTable.clearSelection()
        } else {
          blurCell()
          dataGridRef.current?.focus()
        }
        return null
      }),
      Match.when("Tab", (): Move => {
        // Local patch: Tab leaves the grid, as the ARIA grid pattern expects; arrow keys move between cells.
        // Upstream moves cell by cell, so the action bar (portalled after the grid) was out of keyboard reach.
        if (shiftKey) skipDataGridTabStop()
        return null
      }),
      Match.orElse((): Move => null)
    )

    if (!direction) return
    event.preventDefault()

    const extend = shiftKey && key !== "Tab"
    const pageSize = rowVirtualizerRef.current?.getVirtualItems().length

    if (!extend && hasCellRangeSelection) currentTable.clearSelection()
    currentTable.navigate(direction, { extend, pageSize })
  }

  function onGlobalKeyDown(event: KeyboardEvent) {
    const dataGridElement = dataGridRef.current
    if (!dataGridElement) return

    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const { key, ctrlKey, metaKey, shiftKey } = event
    const isCommandPressed = ctrlKey || metaKey

    const currentTable = tableRef.current
    if (currentTable?.options.enableSearch && isCommandPressed && !shiftKey && key === SEARCH_SHORTCUT_KEY) {
      const isInInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA"
      const isInDataGrid = dataGridElement.contains(target)
      const isInSearchInput = target.closest('[role="search"]') !== null

      if (isInDataGrid || isInSearchInput || !isInInput) {
        event.preventDefault()
        event.stopPropagation()

        const nextSearchOpen = !currentTable.getSearchOpen()
        if (nextSearchOpen) currentTable.openSearch()
        else currentTable.closeSearch()

        if (nextSearchOpen && !isInDataGrid && !isInSearchInput) {
          requestAnimationFrame(() => {
            dataGridElement.focus()
          })
        }
        return
      }
    }

    const isInDataGrid = dataGridElement.contains(target)

    // Works from anywhere but text fields, editors and another grid, like an app's undo.
    const undoRedoKey = key.toLowerCase()
    if (
      currentTable &&
      isCommandPressed &&
      (undoRedoKey === "z" || undoRedoKey === "y") &&
      (currentTable.options.enableUndoRedo ?? !currentTable.options.readOnly) &&
      !getIsEditableTarget(target) &&
      !(getIsInPopover(target) && !target.closest('[role="toolbar"]')) &&
      (isInDataGrid || !target.closest('[role="grid"]'))
    ) {
      event.preventDefault()
      const isRedo = undoRedoKey === "y" || shiftKey
      const count = isRedo ? currentTable.redo() : currentTable.undo()
      if (count === 0) {
        toast.info(isRedo ? "No actions to redo" : "No actions to undo")
      } else {
        toast.success(`${count} action${count === 1 ? "" : "s"} ${isRedo ? "redone" : "undone"}`)
      }
      return
    }

    if (!isInDataGrid) return

    if (key === "Escape") {
      const hasSelections = tableRef.current?.getHasCellRangeSelection() || tableRef.current?.getHasRowSelection()

      if (hasSelections) {
        grid.committed.current?.onEscapeKeyDown?.(event)
        if (event.defaultPrevented) return

        event.preventDefault()
        event.stopPropagation()
        tableRef.current?.clearSelection()
      }
    }
  }

  return {
    onDataChange,
    getFocusedCell,
    getNavigableColumnIds,
    getColumnIds,
    revealCell,
    focusCellElement,
    focusCell,
    selectRange,
    blurCell,
    onColumnVisibilityChange,
    onRowSelectionChange,
    dataGridBodyEventHandlers,
    onRowAdd,
    onDataGridKeyDown,
    onGlobalKeyDown,
    onCellScroll: (cell: CellPosition) => revealCell(cell, { shouldFocus: false, shouldScroll: true }),
    onCellFocus: (cell: CellPosition) => focusCellElement(cell),
    onClipboardNotice: (notice: ClipboardNotice) => (props()?.onClipboardNotice ?? toastClipboardNotice)(notice)
  }
}

/**
 * What upstream's effects did while the grid was on screen, added at once when React gives the grid its element and
 * each removed by `addFinalizer` when it takes the element back. Each reads the table and the props as they are when
 * it runs. The table is set by the draw that handed this element its ref, so it is there.
 */
function listenOnScreen<TData extends RowData>(
  grid: Grid<TData>,
  container: HTMLDivElement,
  addFinalizer: (finalizer: () => void) => void
) {
  const { tableRef, dataGridRef, headerRef, rowMapRef, pendingFocusRef, handlers } = grid
  const { getFocusedCell, getNavigableColumnIds, revealCell, focusCellElement, focusCell, blurCell } = handlers
  const table = tableRef.current
  if (table === null) return

  container.addEventListener("keydown", handlers.onDataGridKeyDown)
  addFinalizer(() => container.removeEventListener("keydown", handlers.onDataGridKeyDown))

  window.addEventListener("keydown", handlers.onGlobalKeyDown, true)
  addFinalizer(() => window.removeEventListener("keydown", handlers.onGlobalKeyDown, true))

  // The first cell is focused when the grid opens with `autoFocus`, and again when its rows or columns change while
  // nothing is focused. It reads the draw being committed (`rendered`), as upstream's effect read that draw's values.
  let autoFocusFrame = 0
  function focusFirstCell() {
    cancelAnimationFrame(autoFocusFrame)
    const draw = grid.rendered.current
    const autoFocus = draw?.props.autoFocus
    if (!draw || !autoFocus || draw.data.length === 0 || draw.columns.length === 0 || getFocusedCell()) return
    if (getNavigableColumnIds().length === 0) return
    autoFocusFrame = requestAnimationFrame(() => {
      const firstRowId = tableRef.current?.getRowModel().rows[0]?.id

      if (typeof autoFocus === "object") {
        const rowId = autoFocus.rowId ?? firstRowId
        if (rowId && autoFocus.columnId) {
          focusCell(rowId, autoFocus.columnId)
        }
        return
      }

      const firstColumnId = getNavigableColumnIds()[0]
      if (firstRowId && firstColumnId) {
        focusCell(firstRowId, firstColumnId)
      }
    })
  }
  focusFirstCell()
  addFinalizer(
    afterCommitOf(table, () => [grid.rendered.current?.data, grid.rendered.current?.columns], focusFirstCell)
  )
  addFinalizer(() => cancelAnimationFrame(autoFocusFrame))

  {
    let isPointerFocus = false

    function onPointerDown() {
      isPointerFocus = true
    }

    function onPointerUp() {
      isPointerFocus = false
    }

    function getFirstVisibleRowIndex() {
      const currentContainer = dataGridRef.current
      if (!currentContainer) return 0

      const viewportTop =
        currentContainer.getBoundingClientRect().top + (headerRef.current?.getBoundingClientRect().height ?? 0)

      let firstRowIndex: number | null = null
      for (const [rowIndex, rowElement] of rowMapRef.current) {
        if (
          rowElement.getBoundingClientRect().top >= viewportTop - 1 &&
          (firstRowIndex === null || rowIndex < firstRowIndex)
        ) {
          firstRowIndex = rowIndex
        }
      }
      return firstRowIndex ?? 0
    }

    function onFocus(event: FocusEvent) {
      const wasPointerFocus = isPointerFocus
      isPointerFocus = false
      if (wasPointerFocus) return

      const currentContainer = dataGridRef.current
      const relatedTarget = event.relatedTarget
      if (!currentContainer || !(relatedTarget instanceof Node) || currentContainer.contains(relatedTarget)) {
        return
      }

      if (tableRef.current?.getEditingCell() || tableRef.current?.getSearchOpen()) return

      const focusedCell = getFocusedCell()
      if (focusedCell) {
        focusCellElement(focusedCell)
        return
      }

      const firstColumnId = getNavigableColumnIds()[0]
      const firstVisibleRowId = tableRef.current?.getRowModel().rows[getFirstVisibleRowIndex()]?.id
      if (!firstColumnId || !firstVisibleRowId) return

      focusCell(firstVisibleRowId, firstColumnId)
    }

    container.addEventListener("pointerdown", onPointerDown)
    container.addEventListener("pointerup", onPointerUp)
    container.addEventListener("focus", onFocus)
    addFinalizer(() => {
      container.removeEventListener("pointerdown", onPointerDown)
      container.removeEventListener("pointerup", onPointerUp)
      container.removeEventListener("focus", onFocus)
    })
  }

  function onFocusIn(event: FocusEvent) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (!dataGridRef.current?.contains(target)) return

    const columnId = target.closest<HTMLElement>('[data-slot="data-grid-header-cell"]')?.dataset.columnId ?? null
    if (tableRef.current?.getFocusedHeaderColumnId() === columnId) return
    tableRef.current?.setFocusedHeaderColumnId(columnId)
  }

  document.addEventListener("focusin", onFocusIn)
  addFinalizer(() => document.removeEventListener("focusin", onFocusIn))

  {
    let focusOutFrame = 0

    function onFocusOut(event: FocusEvent) {
      if (event.relatedTarget || tableRef.current?.getEditingCell()) return

      cancelAnimationFrame(focusOutFrame)
      focusOutFrame = requestAnimationFrame(() => {
        const focusedCell = getFocusedCell()
        if (!focusedCell || !document.hasFocus()) return
        if (document.activeElement && document.activeElement !== document.body) return

        focusCellElement(focusedCell, false)
      })
    }

    container.addEventListener("focusout", onFocusOut)
    addFinalizer(() => {
      cancelAnimationFrame(focusOutFrame)
      container.removeEventListener("focusout", onFocusOut)
    })
  }

  {
    let prevFocusKey: string | null = null
    let prevEdgeKey: string | null = null

    const subscription = table.atoms.cellSelection.subscribe(() => {
      const ranges = table.atoms.cellSelection.get()
      const focusedCell = getFocusedCellPosition(ranges)
      const edgeCell = getSelectionEdgePosition(ranges)
      const focusKey = focusedCell ? getCellKey(focusedCell.rowId, focusedCell.columnId) : null
      const edgeKey = edgeCell ? getCellKey(edgeCell.rowId, edgeCell.columnId) : null
      const isFocusChanged = focusKey !== prevFocusKey
      const isEdgeChanged = edgeKey !== prevEdgeKey
      prevFocusKey = focusKey
      prevEdgeKey = edgeKey

      if (isFocusChanged && focusedCell) {
        if (table.getSearchOpen()) {
          revealCell(focusedCell, { shouldFocus: false, shouldScroll: true })
        } else if (table.getFocusedHeaderColumnId() === null && dataGridRef.current?.contains(document.activeElement)) {
          focusCellElement(focusedCell)
        }
        return
      }

      if (isEdgeChanged && edgeCell && !table.atoms.cellDragAnchor.get() && !table.getHasRowSelection()) {
        revealCell(edgeCell, { shouldFocus: false, shouldScroll: true })
      }
    })

    let prevEditingCell = table.atoms.editingCell.get()
    const editingSubscription = table.atoms.editingCell.subscribe(() => {
      const editingCell = table.atoms.editingCell.get()
      const wasEditing = !!prevEditingCell
      prevEditingCell = editingCell
      if (!wasEditing || editingCell) return

      const focusedCell = getFocusedCellPosition(table.atoms.cellSelection.get())
      if (focusedCell) focusCellElement(focusedCell, false)
    })

    let prevSearchOpen = table.atoms.searchOpen.get()
    const searchOpenSubscription = table.atoms.searchOpen.subscribe(() => {
      const searchOpen = table.atoms.searchOpen.get()
      const wasSearchOpen = prevSearchOpen
      prevSearchOpen = searchOpen
      if (!wasSearchOpen || searchOpen) return

      const focusedCell = getFocusedCellPosition(table.atoms.cellSelection.get())
      if (focusedCell) focusCellElement(focusedCell)
      else dataGridRef.current?.focus()
    })

    addFinalizer(() => {
      subscription.unsubscribe()
      editingSubscription.unsubscribe()
      searchOpenSubscription.unsubscribe()
    })
  }

  {
    const { pasteDialog: pasteDialogAtom, cellSelection: cellSelectionAtom } = table.atoms
    let prevPasteDialogOpen = pasteDialogAtom.get().open
    let pasteFrame = 0

    const subscription = pasteDialogAtom.subscribe(() => {
      const isPasteDialogOpen = pasteDialogAtom.get().open
      const wasPasteDialogOpen = prevPasteDialogOpen
      prevPasteDialogOpen = isPasteDialogOpen
      if (!wasPasteDialogOpen || isPasteDialogOpen) return

      cancelAnimationFrame(pasteFrame)
      pasteFrame = requestAnimationFrame(() => {
        const focusedCell = getFocusedCellPosition(cellSelectionAtom.get())
        if (focusedCell) focusCellElement(focusedCell)
      })
    })

    addFinalizer(() => {
      cancelAnimationFrame(pasteFrame)
      subscription.unsubscribe()
    })
  }

  // A focus that waited for its row to be drawn is given after the commit that drew it, as upstream's layout effect did.
  addFinalizer(
    afterEachCommit(table, () => {
      const pending = pendingFocusRef.current
      if (!pending) return

      const focusedCell = getFocusedCell()
      const isStale =
        !focusedCell ||
        focusedCell.rowId !== pending.cell.rowId ||
        focusedCell.columnId !== pending.cell.columnId ||
        !!tableRef.current?.getEditingCell() ||
        !dataGridRef.current?.contains(document.activeElement)

      if (
        isStale ||
        revealCell(pending.cell, {
          shouldFocus: true,
          shouldScroll: pending.shouldScroll
        })
      ) {
        pendingFocusRef.current = null
      }
    })
  )

  function onOutsideClick(event: MouseEvent) {
    if (event.button === 2) {
      return
    }

    const target = event.target
    if (dataGridRef.current && !(target instanceof Node && dataGridRef.current.contains(target))) {
      const elements = document.elementsFromPoint(event.clientX, event.clientY)

      const isInsidePopover = elements.some((element) => getIsInPopover(element))

      if (!isInsidePopover) {
        const hasSelections = tableRef.current?.getHasCellRangeSelection() || tableRef.current?.getHasRowSelection()
        blurCell()
        if (hasSelections) tableRef.current?.clearSelection()
      }
    }
  }

  document.addEventListener("mousedown", onOutsideClick)
  addFinalizer(() => document.removeEventListener("mousedown", onOutsideClick))

  {
    function onSelectStart(event: Event) {
      event.preventDefault()
    }

    function onContextMenu(event: Event) {
      event.preventDefault()
    }

    function onCleanup() {
      document.removeEventListener("selectstart", onSelectStart)
      document.removeEventListener("contextmenu", onContextMenu)
      document.body.style.userSelect = ""
    }

    const subscription = table.atoms.cellDragAnchor.subscribe(() => {
      if (table.atoms.cellDragAnchor.get()) {
        document.addEventListener("selectstart", onSelectStart)
        document.addEventListener("contextmenu", onContextMenu)
        document.body.style.userSelect = "none"
      } else {
        onCleanup()
      }
    })

    addFinalizer(() => {
      onCleanup()
      subscription.unsubscribe()
    })
  }

  autoScrollWhileDragging(grid, table, addFinalizer)
}

/** While a selection is dragged past the grid's edge, the grid scrolls towards the pointer and the selection follows. */
function autoScrollWhileDragging<TData extends RowData>(
  grid: Grid<TData>,
  table: Table<DataGridFeatures, TData>,
  addFinalizer: (finalizer: () => void) => void
) {
  const { tableRef, dataGridRef, headerRef, footerRef, handlers } = grid
  let rafId: number | null = null
  let mouseX = 0
  let mouseY = 0
  let mouseReady = false
  let active = false
  let lastSelectionTime = 0
  let resizeObserver: ResizeObserver | null = null

  let cachedRect: DOMRect | null = null
  let cachedHdrH = 0
  let cachedFtrH = 0
  let cachedLpw = 0
  let cachedRpw = 0

  function getAutoScrollSpeed(dist: number): number {
    const t = Math.min(dist / AUTO_SCROLL_SPEED_RAMP_ZONE, 1)
    return Math.round(AUTO_SCROLL_MIN_SPEED + (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED) * t)
  }

  function cacheLayout(container: HTMLDivElement) {
    cachedRect = container.getBoundingClientRect()
    cachedHdrH = headerRef.current?.getBoundingClientRect().height ?? 0
    cachedFtrH = footerRef.current?.getBoundingClientRect().height ?? 0
    const tbl = tableRef.current
    if (tbl) {
      cachedLpw = tbl.getStartVisibleLeafColumns().reduce((s, c) => s + c.getSize(), 0)
      cachedRpw = tbl.getEndVisibleLeafColumns().reduce((s, c) => s + c.getSize(), 0)
    }
  }

  function tick() {
    if (!active) return
    const container = dataGridRef.current
    const tbl = tableRef.current

    if (!container || !tbl) {
      onAutoScrollStop()
      return
    }

    if (!mouseReady || !cachedRect) {
      rafId = requestAnimationFrame(tick)
      return
    }

    const rect = cachedRect
    const dir = grid.committed.current?.dir
    const hasNegativeScroll = container.scrollLeft < 0
    const isActuallyRtl = dir === "rtl" || hasNegativeScroll

    const dataTop = rect.top + cachedHdrH
    const dataBottom = rect.bottom - cachedFtrH

    const scrollAreaLeft = isActuallyRtl ? rect.left + cachedRpw : rect.left + cachedLpw
    const scrollAreaRight = isActuallyRtl ? rect.right - cachedLpw : rect.right - cachedRpw

    let dy = 0
    let dx = 0

    if (mouseY < dataTop) dy = -getAutoScrollSpeed(dataTop - mouseY)
    else if (mouseY > dataBottom) dy = getAutoScrollSpeed(mouseY - dataBottom)

    if (mouseX < scrollAreaLeft) dx = -getAutoScrollSpeed(scrollAreaLeft - mouseX)
    else if (mouseX > scrollAreaRight) dx = getAutoScrollSpeed(mouseX - scrollAreaRight)

    if (dx === 0 && dy === 0) {
      rafId = requestAnimationFrame(tick)
      return
    }

    container.scrollTop += dy
    container.scrollLeft += dx

    const now = performance.now()
    if (now - lastSelectionTime < AUTO_SCROLL_SELECTION_THROTTLE_MS) {
      rafId = requestAnimationFrame(tick)
      return
    }

    // Local change: the row height is read from the table here, where upstream read the one its last commit drew.
    const rh = tbl.getRowSize()
    const columnIds = handlers.getColumnIds()
    if (columnIds.length === 0) {
      rafId = requestAnimationFrame(tick)
      return
    }

    const rows = tbl.getRowModel().rows
    const clampedY = Math.max(dataTop, Math.min(mouseY, dataBottom))
    const absY = container.scrollTop + (clampedY - dataTop)
    const rowId = rows[Math.max(0, Math.min(Math.floor(absY / rh), rows.length - 1))]?.id

    if (!rowId) {
      rafId = requestAnimationFrame(tick)
      return
    }

    const dragStartCell = tbl.atoms.cellDragAnchor.get()
    const selectionEdge = getSelectionEdgePosition(tbl.atoms.cellSelection.get())

    let columnId: string | undefined

    if (dx !== 0) {
      const clampedX = Math.max(rect.left, Math.min(mouseX, rect.right))
      const relX = clampedX - rect.left

      const leftZoneWidth = isActuallyRtl ? cachedRpw : cachedLpw
      const rightZoneWidth = isActuallyRtl ? cachedLpw : cachedRpw

      if (relX < leftZoneWidth) {
        const columns = isActuallyRtl ? tbl.getEndVisibleLeafColumns() : tbl.getStartVisibleLeafColumns()
        columnId = columns[0]?.id ?? columnIds[0] ?? ""
        let cx = 0
        for (const col of columns) {
          if (relX < cx + col.getSize()) {
            columnId = col.id
            break
          }
          cx += col.getSize()
        }
      } else if (relX > rect.width - rightZoneWidth) {
        const columns = isActuallyRtl ? tbl.getStartVisibleLeafColumns() : tbl.getEndVisibleLeafColumns()
        columnId = columns[0]?.id ?? columnIds[columnIds.length - 1] ?? ""
        let cx = rect.width - rightZoneWidth
        for (const col of columns) {
          if (relX < cx + col.getSize()) {
            columnId = col.id
            break
          }
          cx += col.getSize()
        }
      } else {
        const center = tbl.getCenterVisibleLeafColumns()
        const centerZoneWidth = rect.width - leftZoneWidth - rightZoneWidth
        const distFromVisualLeft = relX - leftZoneWidth

        let absX: number
        if (isActuallyRtl) {
          const scrollFromRight = hasNegativeScroll
            ? -container.scrollLeft
            : container.scrollWidth - container.clientWidth - container.scrollLeft
          absX = scrollFromRight + (centerZoneWidth - distFromVisualLeft)
        } else {
          absX = container.scrollLeft + distFromVisualLeft
        }

        columnId = center[center.length - 1]?.id ?? columnIds[columnIds.length - 1] ?? ""
        let cw = 0
        for (const col of center) {
          cw += col.getSize()
          if (absX < cw) {
            columnId = col.id
            break
          }
        }
      }
    }

    if (!columnId) {
      columnId = selectionEdge?.columnId ?? columnIds[0] ?? ""
    }

    if (dragStartCell && (rowId !== selectionEdge?.rowId || columnId !== selectionEdge?.columnId)) {
      handlers.selectRange(dragStartCell, { rowId, columnId })
      lastSelectionTime = now
    }

    rafId = requestAnimationFrame(tick)
  }

  function onMove(event: MouseEvent) {
    mouseX = event.clientX
    mouseY = event.clientY
    mouseReady = true
  }

  function onUp() {
    onAutoScrollStop()
    tableRef.current?.endCellDrag()
  }

  function onAutoScrollStart() {
    if (active) return

    const container = dataGridRef.current
    if (!container) return

    active = true
    mouseReady = false
    cachedRect = null
    lastSelectionTime = 0
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    resizeObserver = new ResizeObserver(() => {
      const currentContainer = dataGridRef.current
      if (currentContainer) cacheLayout(currentContainer)
    })
    resizeObserver.observe(container)
    rafId = requestAnimationFrame(() => {
      const currentContainer = dataGridRef.current
      if (currentContainer) cacheLayout(currentContainer)
      rafId = requestAnimationFrame(tick)
    })
  }

  function onAutoScrollStop() {
    if (!active) return
    active = false
    cachedRect = null
    document.removeEventListener("mousemove", onMove)
    document.removeEventListener("mouseup", onUp)
    resizeObserver?.disconnect()
    resizeObserver = null
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  if (table.atoms.cellDragAnchor.get()) onAutoScrollStart()

  const subscription = table.atoms.cellDragAnchor.subscribe(() => {
    const isDragging = table.atoms.cellDragAnchor.get() !== null
    if (isDragging && !active) onAutoScrollStart()
    else if (!isDragging && active) onAutoScrollStop()
  })

  // A drag the grid leaves in the middle of ends there, its selection kept: no button is down when it comes back.
  addFinalizer(() => {
    subscription.unsubscribe()
    onAutoScrollStop()
    table.endCellDrag()
  })
}

const defaultColumn: Partial<ColumnDef<DataGridFeatures, any>> = {
  minSize: MIN_COLUMN_SIZE,
  maxSize: MAX_COLUMN_SIZE,
  cell: renderDefaultCell
}

function useDataGrid<TData extends RowData>({
  data: dataProp,
  columns,
  overscan = OVERSCAN,
  dir: dirProp,
  onEscapeKeyDown,
  ...props
}: UseDataGridProps<TData>): DataGridState<TData> {
  const instance = useId()
  const grid: Grid<TData> = useAtomValue(gridInstance(instance))
  const pendingEdit = useAtomValue(grid.pendingEdit)
  const data = pendingEdit !== null && pendingEdit.from === dataProp ? pendingEdit.to : dataProp
  const contextDir = useDirection()
  const dir = dirProp ?? contextDir
  const { handlers } = grid

  const tableColumns = grid.keep.columns([columns], () =>
    columns.map((column) =>
      column.id && UTILITY_COLUMN_IDS.has(column.id)
        ? {
            ...column,
            enableCellSelection: column.enableCellSelection ?? false,
            enableOrdering: column.enableOrdering ?? false
          }
        : column
    )
  )

  // What this draw was given, for the handlers once it is committed (the first draw's at once, as upstream's refs).
  const draw: GridDraw<TData> = { props, dataProp, data, columns: tableColumns, dir, onEscapeKeyDown }
  grid.rendered.current = draw
  if (grid.committed.current === null) grid.committed.current = draw

  const stableProps = grid.keep.stableProps([stablePropsKey(props)], () => stablePropsOf(props, grid))

  const enableCellEditing = !props.readOnly && props.enableCellEditing !== false
  const hasRowAdd = !!props.createRow

  const tableOptions = grid.keep.options(
    [stableProps, data, tableColumns, enableCellEditing, dir],
    (): TableOptions<DataGridFeatures, TData> => ({
      ...stableProps,
      onCellScroll: handlers.onCellScroll,
      onCellFocus: handlers.onCellFocus,
      onClipboardNotice: handlers.onClipboardNotice,
      features: dataGridFeatures,
      data,
      onDataChange: handlers.onDataChange,
      columns: tableColumns,
      defaultColumn,
      autoResetCellSelection: false,
      enableCellEditing,
      onRowSelectionChange: handlers.onRowSelectionChange,
      onColumnVisibilityChange: handlers.onColumnVisibilityChange,
      columnResizeMode: "onChange",
      columnResizeDirection: dir,
      dir
    })
  )

  const table = useTable(tableOptions, selectTableState)

  if (grid.tableRef.current === null) {
    grid.tableRef.current = table
  }

  useAtomMount(gridMounted(instance))

  // The table is the same object across draws, so its columns and sizing state are what change the sizes.
  const columnSizeVars = grid.keep.sizes([tableColumns, table.state.columnResizing, table.state.columnSizing], () => {
    const headers = table.getFlatHeaders()
    const colSizes: { [key: string]: number } = {}
    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize()
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize()
    }
    return colSizes
  })

  const columnPinning = table.state.columnPinning
  const adjustLayout =
    getIsFirefox() && ((columnPinning.start?.length ?? 0) > 0 || (columnPinning.end?.length ?? 0) > 0)

  const rowVirtualizerOptions = grid.keep.virtualizer([overscan], () => ({ overscan }))

  const dataGridBodyProps = grid.keep.body([adjustLayout], () => ({
    ...handlers.dataGridBodyEventHandlers,
    style: {
      contain: adjustLayout ? "layout paint" : "strict"
    } satisfies CSSProperties
  }))

  return grid.keep.result(
    [table, rowVirtualizerOptions, dataGridBodyProps, columnSizeVars, dir, adjustLayout, hasRowAdd],
    () => ({
      table,
      dataGridRef: grid.dataGridRef,
      headerRef: grid.headerRef,
      footerRef: grid.footerRef,
      rowMapRef: grid.rowMapRef,
      rowVirtualizerRef: grid.rowVirtualizerRef,
      columnVirtualizerRef: grid.columnVirtualizerRef,
      rowVirtualizerOptions,
      dataGridBodyProps,
      columnSizeVars,
      dir,
      adjustLayout,
      onRowAdd: hasRowAdd ? handlers.onRowAdd : undefined
    })
  )
}

let nextObjectId = 0
const objectIds = new WeakMap<object, number>()

/** The props as one text, functions left out: a change of a function alone does not make the table's props anew. */
function stablePropsKey(props: object): string {
  let propsKey = ""
  for (const [name, value] of Object.entries(props)) {
    let valueKey = `${typeof value}${String(value)}`
    if (typeof value === "function") {
      valueKey = "fn"
    } else if (typeof value === "object" && value !== null) {
      let id = objectIds.get(value)
      if (id === undefined) {
        id = nextObjectId++
        objectIds.set(value, id)
      }
      valueKey = `obj${id}`
    }
    propsKey += `${name}:${valueKey}\u0000`
  }
  return propsKey
}

/** The props with each function replaced by one that calls the function of the last commit's props. */
function stablePropsOf<TData extends RowData>(props: GridRestProps<TData>, grid: Grid<TData>): GridRestProps<TData> {
  const stableProps = { ...props }
  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== "function") continue
    Reflect.set(stableProps, key, (...args: unknown[]) => {
      const callback: unknown = Reflect.get(grid.committed.current?.props ?? props, key)
      if (typeof callback === "function") return callback(...args)
    })
  }
  return stableProps
}

function selectTableState(state: TableState<DataGridFeatures>) {
  return {
    rowHeight: state.rowHeight,
    sorting: state.sorting,
    columnFilters: state.columnFilters,
    columnVisibility: state.columnVisibility,
    columnPinning: state.columnPinning,
    columnOrder: state.columnOrder,
    columnSizing: state.columnSizing,
    columnResizing: state.columnResizing,
    undoRedo: state.undoRedo
  }
}

function toastClipboardNotice({ variant, message }: ClipboardNotice) {
  if (variant === "error") toast.error(message)
  else toast.success(message)
}

export { useDataGrid, type UseDataGridProps }
