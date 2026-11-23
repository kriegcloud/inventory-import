// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// Each grid on screen has atoms of its own, made for its `useId` (`gridController` and the values below it), where
// upstream kept refs, `useCallback`s and effects. The controller is made once per grid: its handlers are the same
// functions for the grid's whole life, its window and document listeners go with its finalizer, and the listeners on the
// grid's element and its subscriptions to the table come and go with that element (the viewport's ref callback). What a
// handler needs from the last draw (the props, the data, the direction) is the controller's `drawn` atom, written in the
// draw as TanStack's `useTable` writes the table's options in the draw; upstream's value refs were written after it.
// The rule this file protects: a handler reads the table, the props and the grid's element as they are now, so every
// key, every press and where focus lands afterwards are what they were with the hooks.
import type { Virtualizer } from "@tanstack/react-virtual"

import { useAtomValue } from "@effect/atom-react"
import {
  type CellSelectionState,
  type ColumnDef,
  type ColumnVisibilityState,
  functionalUpdate,
  makeStateUpdater,
  type RowData,
  type RowSelectionState,
  type Table,
  type TableOptions,
  type TableState,
  type Updater,
  useTable
} from "@tanstack/react-table"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
// Local change: adding a row is an Effect, run with `Effect.runFork`, where upstream has an async function with a `try`
// statement; `Result` reads how the caller's `createRow` went.
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
  Direction,
  NavigationDirection
} from "@inventory/ui/components/data-grid/data-grid-types"

import { type DataGridFeatures, dataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
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
  scrollCellIntoView
} from "@inventory/ui/components/data-grid/data-grid-utils"
import { atomRegistry } from "@inventory/ui/components/data-table/data-table-state"
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

type GridProps<TData extends RowData> = Omit<UseDataGridProps<TData>, "data" | "columns" | "overscan" | "dir">

/** What one grid was last drawn with: what upstream's value refs held, for the handlers made once. */
interface GridDrawn<TData extends RowData> {
  readonly props: GridProps<TData>
  readonly data: readonly TData[]
  readonly columns: readonly unknown[]
  readonly dir: Direction
}

/**
 * A value kept from one draw to the next while what it was made from is the same: a memo's answer, held by its owner.
 * Nothing until the first draw; the slot is the one thing that changes, so it is a `MutableRef`.
 */
export type Kept<V> = MutableRef.MutableRef<O.Option<{ readonly deps: ReadonlyArray<unknown>; readonly value: V }>>

export function emptyKept<V>(): Kept<V> {
  return MutableRef.make(O.none())
}

/** The value `slot` holds when `deps` are the same as the last time (each compared with `Object.is`), or a new one. */
export function kept<V>(slot: Kept<V>, deps: ReadonlyArray<unknown>, make: () => V): V {
  const last = MutableRef.get(slot)
  if (
    O.isSome(last) &&
    last.value.deps.length === deps.length &&
    last.value.deps.every((dep, index) => Object.is(dep, deps[index]))
  ) {
    return last.value.value
  }
  const value = make()
  MutableRef.set(slot, O.some({ deps, value }))
  return value
}

/** A ref's shape over an atom, for code written against `ref.current`: it reads and writes the atom now. */
function atomRef<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Writable<A>): RefObject<A> {
  return {
    get current() {
      return registry.get(atom)
    },
    set current(value) {
      registry.set(atom, value)
    }
  }
}

/** The first table one grid was drawn with (upstream's `tableRef`): its methods act on the table as it is now. */
export const gridTableOf = Atom.family((_grid: string) => Atom.make<unknown>(null))

/** The data an edit made, until the caller draws the grid with data of its own (upstream's `pendingEdit` state). */
const pendingEdits = Atom.family((_grid: string) =>
  Atom.make<{ readonly from: unknown; readonly to: ReadonlyArray<any> } | null>(null)
)

/** A cell to focus once it is drawn. */
const pendingFocus = Atom.family((_grid: string) =>
  Atom.make<{ readonly cell: CellPosition; readonly shouldScroll: boolean } | null>(null)
)

/** The grid whose search box takes the focus after one Ctrl+F, with the press it came from. */
export interface SearchFocusClaim {
  readonly press: object
  readonly grid: string
}

/**
 * Which grid's search box takes the focus when the boxes open. One Ctrl+F opens the search of every grid on the page,
 * and each open box asks for the focus a frame later: the box of the grid the key was pressed in (in a cell, or in its
 * own search box) takes it, whichever box is drawn last and under StrictMode's second call of each ref; for a press
 * outside every grid, the first grid's, as upstream's passive effects had it. None once the press's frame is over.
 */
export const searchFocusClaim = Atom.keepAlive(Atom.make<O.Option<SearchFocusClaim>>(O.none()))

/**
 * The claim after one grid's Ctrl+F listener has seen `press`: this grid's when the key was pressed in it; the claim
 * another grid made for this same press otherwise; and this grid's when it is the first to see a press made outside
 * every grid (the listeners run in the order the grids were put on the page).
 *
 * @example
 * claimSearchFocus(O.none(), press, "first", false) // O.some({ press, grid: "first" })
 * claimSearchFocus(O.some({ press, grid: "first" }), press, "second", true) // O.some({ press, grid: "second" })
 * claimSearchFocus(O.some({ press, grid: "second" }), press, "first", false) // still "second"
 */
export function claimSearchFocus(
  claim: O.Option<SearchFocusClaim>,
  press: object,
  grid: string,
  isPressedHere: boolean
): O.Option<SearchFocusClaim> {
  if (!isPressedHere && O.isSome(claim) && claim.value.press === press) return claim
  return O.some({ press, grid })
}

/** Whether one grid's newly opened search box takes the focus: when its grid holds the claim, or nobody does. */
export function takesSearchFocus(claim: O.Option<SearchFocusClaim>, grid: string): boolean {
  return O.isNone(claim) || claim.value.grid === grid
}

/** The rows' and the columns' virtualizers of one grid, handed over by its viewport when TanStack Virtual makes them. */
export const rowVirtualizerOf = Atom.family((_grid: string) =>
  Atom.make<Virtualizer<HTMLDivElement, Element> | null>(null)
)
export const columnVirtualizerOf = Atom.family((_grid: string) =>
  Atom.make<Virtualizer<HTMLDivElement, Element> | null>(null)
)

/** What one grid on screen is: its elements, its handlers and its listeners, made once for its `useId`. */
export interface GridController<TData extends RowData> {
  readonly dataGridRef: RefObject<HTMLDivElement | null>
  readonly headerRef: RefObject<HTMLDivElement | null>
  readonly footerRef: RefObject<HTMLDivElement | null>
  /** Puts the grid's element on screen: its listeners and the table's subscriptions, undone by what it returns. */
  readonly attachGrid: (element: HTMLDivElement) => () => void
  readonly bodyHandlers: ComponentProps<"div">
  readonly revealCell: (
    cell: CellPosition,
    options: { readonly shouldFocus: boolean; readonly shouldScroll: boolean }
  ) => boolean
  readonly focusCellElement: (cell: CellPosition, shouldScroll?: boolean) => void
  readonly onDataChange: (nextData: TData[], details: DataChangeDetails<TData>) => void
  readonly onRowSelectionChange: (updater: Updater<RowSelectionState>) => void
  readonly onColumnVisibilityChange: (updater: Updater<ColumnVisibilityState>) => void
  readonly onClipboardNotice: (notice: ClipboardNotice) => void
  /** What the grid was last drawn with: written in the draw, read by the handlers made once. */
  readonly drawn: Atom.Writable<GridDrawn<TData> | null>
  /** The first table the grid was drawn with (upstream's `tableRef`): its methods act on the table as it is now. */
  readonly table: Atom.Writable<Table<DataGridFeatures, TData> | null>
  /** Adds a row as the caller's `createRow` makes it, and focuses it; a refused row says why. */
  readonly onRowAdd: (event?: ReactMouseEvent<HTMLDivElement> | ReactKeyboardEvent<HTMLDivElement>) => void
  /** Memo slots of the draw: the stable props, the columns, the table's options, the column sizes. */
  readonly kept: {
    readonly props: PropsKept<GridProps<TData>>
    readonly columns: Kept<ReadonlyArray<ColumnDef<DataGridFeatures, TData>>>
    readonly options: Kept<TableOptions<DataGridFeatures, TData>>
    readonly sizes: Kept<Record<string, number>>
  }
}

/** One grid's controller, made for its `useId` and let go the moment the grid leaves the screen. */
export const gridController = Atom.family((grid: string) =>
  Atom.readable((get): GridController<any> => makeGridController(grid, get)).pipe(Atom.setIdleTTL(0))
)

function makeGridController<TData extends RowData>(grid: string, get: Atom.AtomContext): GridController<TData> {
  const registry = get.registry
  // The values the handlers read stay while the grid is on screen. What it was drawn with and its table are this
  // grid's own atoms, typed by its rows; `gridTableOf` holds the table for whoever knows only the grid's id.
  const drawnAtom = Atom.make<GridDrawn<TData> | null>(null)
  const tableAtom = Atom.make<Table<DataGridFeatures, TData> | null>(null)
  get.mount(drawnAtom)
  get.mount(tableAtom)
  get.mount(gridTableOf(grid))
  get.mount(pendingFocus(grid))
  get.mount(rowVirtualizerOf(grid))
  get.mount(columnVirtualizerOf(grid))

  const drawn = () => registry.get(drawnAtom)
  const tableRef = atomRef(registry, tableAtom)
  const rowVirtualizerRef = atomRef(registry, rowVirtualizerOf(grid))
  const columnVirtualizerRef = atomRef(registry, columnVirtualizerOf(grid))
  const pendingFocusRef = atomRef(registry, pendingFocus(grid))
  const propsRef = {
    get current(): GridProps<TData> {
      return drawn()?.props ?? {}
    }
  }
  const getDir = (): Direction => drawn()?.dir ?? "ltr"
  // DOM nodes: the grid's element and its header and footer, set by their ref callbacks.
  const dataGridRef: RefObject<HTMLDivElement | null> = { current: null }
  const headerRef: RefObject<HTMLDivElement | null> = { current: null }
  const footerRef: RefObject<HTMLDivElement | null> = { current: null }

  function onDataChange(nextData: TData[], details: DataChangeDetails<TData>) {
    registry.set(pendingEdits(grid), { from: drawn()?.data, to: nextData })
    propsRef.current.onDataChange?.(nextData, details)
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
        isRtl: getDir() === "rtl"
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

    propsRef.current.onColumnVisibilityChange?.(updater)
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

    propsRef.current.onRowSelectionChange?.(updater)
  }

  // The body's mouse handlers, the same object for the grid's life: the cell under the pointer is read from the event.
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

  const bodyHandlers: ComponentProps<"div"> = {
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

  const addRow = Effect.fnUntraced(function* (trigger: CreateRowDetails, columnId: string | undefined) {
    const { readOnly, createRow } = propsRef.current
    if (readOnly || !createRow) return

    // Local change: `Effect.try`, and `Effect.tryPromise` when the caller answers later, where upstream has a `try`
    // statement; a refused new row says why, as upstream's did.
    const refused = (error: unknown) => (error instanceof Error ? error.message : "Failed to add row")
    const created = yield* Effect.result(
      Effect.flatMap(Effect.try({ try: () => createRow(trigger), catch: refused }), (answer) =>
        P.isPromiseLike(answer) ? Effect.tryPromise({ try: () => answer, catch: refused }) : Effect.succeed(answer)
      )
    )
    if (Result.isFailure(created)) {
      toast.error(created.failure)
      return
    }
    const row: TData | null = created.success
    const currentTable = tableRef.current
    if (!row || !currentTable) return

    const [rowId] = currentTable.addRows(
      [row],
      trigger.reason === "insert-below" ? { afterRowId: trigger.afterRowId } : undefined
    )
    if (!rowId || !columnId) return

    currentTable.clearSelection()
    focusCell(rowId, columnId)
  })

  function onRowAdd(event?: ReactMouseEvent<HTMLDivElement> | ReactKeyboardEvent<HTMLDivElement>) {
    Effect.runFork(addRow({ reason: "add-row-press", event }, getNavigableColumnIds().find(getIsDataColumnId)))
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

    const isRtl = getDir() === "rtl"

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
        const step = (arrow === "ArrowRight") !== isRtl ? 1 : -1
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
      !propsRef.current.readOnly &&
      propsRef.current.enableRowDeletion
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
        x: getDir() === "rtl" ? rect.right : rect.left,
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

    if (isCtrlPressed && !shiftKey && key === "x" && canCopyCells && !propsRef.current.readOnly) {
      event.preventDefault()
      void currentTable.cutSelectedCells()
      return
    }

    if (
      propsRef.current.enablePaste &&
      isCtrlPressed &&
      !shiftKey &&
      key === "v" &&
      !isUtilityCellFocused &&
      !propsRef.current.readOnly
    ) {
      event.preventDefault()
      void currentTable.pasteCells()
      return
    }

    if (
      (key === "Delete" || key === "Backspace") &&
      !isCtrlPressed &&
      !isUtilityCellFocused &&
      !propsRef.current.readOnly
    ) {
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

    if (key === "Enter" && shiftKey && !propsRef.current.readOnly && propsRef.current.createRow) {
      event.preventDefault()
      const currentColumnId = isUtilityCellFocused ? getNavigableColumnIds()[0] : focusedCell.columnId

      Effect.runFork(addRow({ reason: "insert-below", event, afterRowId: focusedCell.rowId }, currentColumnId))
      return
    }

    const isRtl = getDir() === "rtl"

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
        if (isCtrlPressed) return isRtl ? "end" : "home"
        return "left"
      }),
      Match.when("ArrowRight", (): Move => {
        if (isCtrlPressed) return isRtl ? "home" : "end"
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

  // Window and document listeners, for the grid's whole life (upstream's effects with no dependencies that change).
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

        // The search box beside this grid's element (both are in the grid's wrapper) is its own.
        const isInOwnSearchInput = target.closest('[role="search"]')?.parentElement?.contains(dataGridElement) === true
        registry.set(
          searchFocusClaim,
          claimSearchFocus(registry.get(searchFocusClaim), event, grid, isInDataGrid || isInOwnSearchInput)
        )
        // Every box asks in the frame after the press; after that frame the claim is let go, so a search opened later
        // by other means focuses its own box.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const claim = registry.get(searchFocusClaim)
            if (O.isSome(claim) && claim.value.press === event) registry.set(searchFocusClaim, O.none())
          })
        })

        const nextSearchOpen = !currentTable.getSearchOpen()
        // Asked for before the search opens, so the box's own request (made as it is drawn, which can be within
        // `openSearch`) comes after it in the frame, as upstream's passive effect did; and only when no other grid
        // claimed the press, so the grid the person was in keeps the focus.
        if (nextSearchOpen && !isInDataGrid && !isInSearchInput) {
          requestAnimationFrame(() => {
            if (takesSearchFocus(registry.get(searchFocusClaim), grid)) dataGridElement.focus()
          })
        }

        if (nextSearchOpen) currentTable.openSearch()
        else currentTable.closeSearch()
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
        propsRef.current.onEscapeKeyDown?.(event)
        if (event.defaultPrevented) return

        event.preventDefault()
        event.stopPropagation()
        tableRef.current?.clearSelection()
      }
    }
  }

  function onFocusIn(event: FocusEvent) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (!dataGridRef.current?.contains(target)) return

    const columnId = target.closest<HTMLElement>('[data-slot="data-grid-header-cell"]')?.dataset.columnId ?? null
    if (tableRef.current?.getFocusedHeaderColumnId() === columnId) return
    tableRef.current?.setFocusedHeaderColumnId(columnId)
  }

  function onOutsideClick(event: MouseEvent) {
    if (event.button === 2) {
      return
    }

    if (dataGridRef.current && !dataGridRef.current.contains(event.target as Node)) {
      const elements = document.elementsFromPoint(event.clientX, event.clientY)

      const isInsidePopover = elements.some((element) => getIsInPopover(element))

      if (!isInsidePopover) {
        const hasSelections = tableRef.current?.getHasCellRangeSelection() || tableRef.current?.getHasRowSelection()
        blurCell()
        if (hasSelections) tableRef.current?.clearSelection()
      }
    }
  }

  window.addEventListener("keydown", onGlobalKeyDown, true)
  document.addEventListener("focusin", onFocusIn)
  document.addEventListener("mousedown", onOutsideClick)
  get.addFinalizer(() => {
    window.removeEventListener("keydown", onGlobalKeyDown, true)
    document.removeEventListener("focusin", onFocusIn)
    document.removeEventListener("mousedown", onOutsideClick)
    // When the grid leaves the screen (upstream's unmount effect): what is waiting to be written is written, and the
    // files' object URLs are let go.
    const currentTable = tableRef.current
    if (!currentTable) return
    currentTable.commitCellUpdates()
    revokeFileObjectUrls(currentTable, drawn()?.data)
  })

  // After a draw of the grid's owner, a frame later: the cell waiting for focus, and the first cell for `autoFocus`
  // (upstream's layout effect after every draw, and its effect on the data and columns).
  let afterDrawFrame = 0
  let autoFocusFrame = 0
  let autoFocusDrawn: { readonly data: unknown; readonly columns: unknown } | null = null

  function retryPendingFocus() {
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
  }

  function autoFocusFirstCell() {
    const current = drawn()
    const autoFocus = current?.props.autoFocus
    if (!current || !autoFocus || current.data.length === 0 || current.columns.length === 0 || getFocusedCell()) return
    if (getNavigableColumnIds().length === 0) return

    cancelAnimationFrame(autoFocusFrame)
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

  function onDrawn(current: GridDrawn<TData> | null) {
    if (!dataGridRef.current || !current) return
    if (pendingFocusRef.current) {
      cancelAnimationFrame(afterDrawFrame)
      afterDrawFrame = requestAnimationFrame(retryPendingFocus)
    }
    if (autoFocusDrawn === null || autoFocusDrawn.data !== current.data || autoFocusDrawn.columns !== current.columns) {
      autoFocusDrawn = { data: current.data, columns: current.columns }
      autoFocusFirstCell()
    }
  }

  // The grid's element on screen: its own listeners, and what follows the table's state (upstream's effects that
  // depended on the element or the table).
  function attachGrid(container: HTMLDivElement) {
    dataGridRef.current = container
    const table = tableRef.current
    container.addEventListener("keydown", onDataGridKeyDown)

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

      // Local change: the drawn rows are read from the page (upstream kept a map the rows' refs filled).
      let firstRowIndex: number | null = null
      for (const rowElement of currentContainer.querySelectorAll<HTMLElement>('[data-slot="data-grid-row"]')) {
        const rowIndex = Number(rowElement.dataset.index)
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

    container.addEventListener("pointerdown", onPointerDown)
    container.addEventListener("pointerup", onPointerUp)
    container.addEventListener("focus", onFocus)
    container.addEventListener("focusout", onFocusOut)

    const unsubscribes: Array<() => void> = []
    if (table) unsubscribes.push(followTable(table))
    unsubscribes.push(registry.subscribe(drawnAtom, (current) => onDrawn(current)))
    onDrawn(drawn())

    return () => {
      container.removeEventListener("keydown", onDataGridKeyDown)
      container.removeEventListener("pointerdown", onPointerDown)
      container.removeEventListener("pointerup", onPointerUp)
      container.removeEventListener("focus", onFocus)
      container.removeEventListener("focusout", onFocusOut)
      cancelAnimationFrame(focusOutFrame)
      cancelAnimationFrame(afterDrawFrame)
      cancelAnimationFrame(autoFocusFrame)
      autoFocusDrawn = null
      for (const unsubscribe of unsubscribes) unsubscribe()
      if (dataGridRef.current === container) dataGridRef.current = null
    }
  }

  /** What follows the table's own atoms while the grid is on screen; the function it returns stops it. */
  function followTable(table: Table<DataGridFeatures, TData>) {
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

    const { pasteDialog: pasteDialogAtom, cellSelection: cellSelectionAtom } = table.atoms
    let prevPasteDialogOpen = pasteDialogAtom.get().open
    let pasteFrame = 0

    const pasteSubscription = pasteDialogAtom.subscribe(() => {
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

    const stopDrag = followCellDrag(table)
    const stopAutoScroll = followAutoScroll(table)

    return () => {
      subscription.unsubscribe()
      editingSubscription.unsubscribe()
      searchOpenSubscription.unsubscribe()
      cancelAnimationFrame(pasteFrame)
      pasteSubscription.unsubscribe()
      stopDrag()
      stopAutoScroll()
    }
  }

  /** While cells are dragged over, the page's own selection and context menu are kept out. */
  function followCellDrag(table: Table<DataGridFeatures, TData>) {
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

    return () => {
      onCleanup()
      subscription.unsubscribe()
    }
  }

  /** While cells are dragged past an edge of the grid, it scrolls and the selection follows the pointer. */
  function followAutoScroll(table: Table<DataGridFeatures, TData>) {
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
      const dir = getDir()
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

      const rh = tbl.getRowSize()
      const columnIds = getColumnIds()
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
        selectRange(dragStartCell, { rowId, columnId })
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

    return () => {
      onAutoScrollStop()
      subscription.unsubscribe()
    }
  }

  return {
    dataGridRef,
    headerRef,
    footerRef,
    attachGrid,
    bodyHandlers,
    revealCell,
    focusCellElement,
    onDataChange,
    onRowSelectionChange,
    onColumnVisibilityChange,
    onClipboardNotice: (notice) => (propsRef.current.onClipboardNotice ?? toastClipboardNotice)(notice),
    onRowAdd,
    drawn: drawnAtom,
    table: tableAtom,
    kept: {
      props: MutableRef.make(O.none()),
      columns: emptyKept(),
      options: emptyKept(),
      sizes: emptyKept()
    }
  }
}

const defaultColumn: Partial<ColumnDef<DataGridFeatures, any>> = {
  minSize: MIN_COLUMN_SIZE,
  maxSize: MAX_COLUMN_SIZE,
  cell: renderDefaultCell
}

// Firefox needs its own layout for pinned columns; the page has a browser, never a server render.
const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")

/** The columns with the utility columns' defaults (kept by the grid's controller while the columns are the same). */
function getTableColumns<TData extends RowData>(
  columns: readonly ColumnDef<DataGridFeatures, TData>[]
): ColumnDef<DataGridFeatures, TData>[] {
  return columns.map((column) =>
    column.id && UTILITY_COLUMN_IDS.has(column.id)
      ? {
          ...column,
          enableCellSelection: column.enableCellSelection ?? false,
          enableOrdering: column.enableOrdering ?? false
        }
      : column
  )
}

function useDataGrid<TData extends RowData>({
  data: dataProp,
  columns,
  overscan = OVERSCAN,
  dir: dirProp,
  ...props
}: UseDataGridProps<TData>) {
  const grid = useId()
  const registry = useAtomValue(atomRegistry)
  const controller: GridController<TData> = useAtomValue(gridController(grid))
  const pendingEdit = useAtomValue(pendingEdits(grid))
  const data = pendingEdit !== null && pendingEdit.from === dataProp ? pendingEdit.to : dataProp
  const contextDir = useDirection()
  const dir = dirProp ?? contextDir
  // What the handlers read of this draw: written in the draw, as `useTable` below writes the table's options.
  registry.set(controller.drawn, { props, data: dataProp, columns, dir })
  const stableProps = getStableProps(controller.kept.props, props, () => registry.get(controller.drawn)?.props ?? {})

  const tableColumns = kept(controller.kept.columns, [columns], () => getTableColumns(columns))

  const enableCellEditing = !props.readOnly && props.enableCellEditing !== false
  const hasRowAdd = !!props.createRow

  const tableOptions = kept(
    controller.kept.options,
    [stableProps, data, tableColumns, enableCellEditing, dir],
    (): TableOptions<DataGridFeatures, TData> => ({
      ...stableProps,
      onCellScroll: (cell) => controller.revealCell(cell, { shouldFocus: false, shouldScroll: true }),
      onCellFocus: (cell) => controller.focusCellElement(cell),
      onClipboardNotice: controller.onClipboardNotice,
      features: dataGridFeatures,
      data,
      onDataChange: controller.onDataChange,
      columns: tableColumns,
      defaultColumn,
      autoResetCellSelection: false,
      enableCellEditing,
      onRowSelectionChange: controller.onRowSelectionChange,
      onColumnVisibilityChange: controller.onColumnVisibilityChange,
      columnResizeMode: "onChange",
      columnResizeDirection: dir,
      dir
    })
  )

  const table = useTable(tableOptions, selectTableState)

  if (registry.get(controller.table) === null) {
    registry.set(controller.table, table)
    registry.set(gridTableOf(grid), table)
  }

  const columnSizeVars = kept(
    controller.kept.sizes,
    [tableColumns, table.state.columnResizing, table.state.columnSizing],
    () => {
      const headers = table.getFlatHeaders()
      const colSizes: { [key: string]: number } = {}
      for (const header of headers) {
        colSizes[`--header-${header.id}-size`] = header.getSize()
        colSizes[`--col-${header.column.id}-size`] = header.column.getSize()
      }
      return colSizes
    }
  )

  const columnPinning = table.state.columnPinning
  const adjustLayout = isFirefox && ((columnPinning.start?.length ?? 0) > 0 || (columnPinning.end?.length ?? 0) > 0)

  const dataGridBodyProps = {
    ...controller.bodyHandlers,
    style: {
      contain: adjustLayout ? "layout paint" : "strict"
    } satisfies CSSProperties
  }

  return {
    table,
    gridId: grid,
    dataGridRef: controller.dataGridRef,
    headerRef: controller.headerRef,
    rowVirtualizerOptions: { overscan },
    dataGridBodyProps,
    columnSizeVars,
    dir,
    adjustLayout,
    onRowAdd: hasRowAdd ? controller.onRowAdd : undefined
  }
}

/** The stable props of the last draw and the key of the props they were made from: nothing before the first draw. */
type PropsKept<TProps> = MutableRef.MutableRef<O.Option<{ readonly key: string; readonly value: TProps }>>

let nextObjectId = 0
const objectIds = new WeakMap<object, number>()

/**
 * The props with each function in a wrapper that calls the prop of the last draw, made again only when a prop that is
 * not a function changes (upstream's `useStableProps`, its memo held by the grid's controller).
 */
function getStableProps<TProps extends object>(slot: PropsKept<TProps>, props: TProps, latest: () => object): TProps {
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

  const last = MutableRef.get(slot)
  if (O.isSome(last) && last.value.key === propsKey) return last.value.value

  const stableProps = { ...props }
  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== "function") continue
    Reflect.set(stableProps, key, (...args: unknown[]) => {
      const callback: unknown = Reflect.get(latest(), key)
      if (typeof callback === "function") return callback(...args)
    })
  }
  MutableRef.set(slot, O.some({ key: propsKey, value: stableProps }))
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
