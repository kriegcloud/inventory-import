"use client"
// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// The viewport of one grid on screen is one instance, made for its `useId` (`viewportOf`): the insets it measures are
// its atom, written by a ResizeObserver it starts from its own ref callbacks; where the last scroll left the rows is
// recorded when the row virtualizer reports a change (after the commit a scroll makes); the virtualizers are handed to
// the hook's boxes as they are drawn and taken back when the viewport leaves; the columns are measured again a frame
// after the table's column state changes (`viewportListeners`).
//
// The rule this file protects: what the rows and the header are given keeps its identity exactly while upstream's
// memos did (`keepOne`), so a draw of the viewport draws no row whose props did not change.
import { useAtomMount, useAtomValue } from "@effect/atom-react"
import { type Column, flexRender, type HeaderGroup, type RowData, type TableState } from "@tanstack/react-table"
import { defaultRangeExtractor, type Range, useVirtualizer, type Virtualizer } from "@tanstack/react-virtual"
import { cn } from "cn"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import {
  type ComponentProps,
  type KeyboardEvent,
  memo,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useDeferredValue,
  useId
} from "react"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { ColumnWindow } from "@inventory/ui/components/data-grid/data-grid-types"
import type { useDataGrid } from "@inventory/ui/components/data-grid/use-data-grid"

import { type Keep, keepOne } from "@inventory/ui/components/data-grid/data-grid-state"
import {
  getColumnBorderVisibility,
  getColumnPinningStyle,
  getHeaderSizeVar,
  getWindowedColumns
} from "@inventory/ui/components/data-grid/data-grid-utils"
import { DataGridColumnHeader } from "@inventory/ui/components/data-grid/data-grid-column-header"
import { DataGridContextMenu } from "@inventory/ui/components/data-grid/data-grid-context-menu"
import { DataGridPasteDialog } from "@inventory/ui/components/data-grid/data-grid-paste-dialog"
import { DataGridRow, DataGridRowContext } from "@inventory/ui/components/data-grid/data-grid-row"
import { DataGridSearch } from "@inventory/ui/components/data-grid/data-grid-search"
import { Plus } from "lucide-react"

const VIEWPORT_OFFSET = 1
const COLUMN_OVERSCAN = 2
const SCROLL_JUMP_EXIT_ROWS_PER_COMMIT = 2

interface DataGridProps<TData extends RowData>
  extends ReturnType<typeof useDataGrid<TData>>, Omit<ComponentProps<"div">, "dir"> {
  height?: number
  stretchColumns?: boolean
  actionBar?: ReactNode
}

export function DataGrid<TData extends RowData>({
  table,
  dataGridRef,
  headerRef,
  footerRef,
  rowMapRef,
  rowVirtualizerRef,
  columnVirtualizerRef,
  rowVirtualizerOptions,
  dataGridBodyProps,
  columnSizeVars,
  dir,
  adjustLayout,
  height = 600,
  stretchColumns = false,
  actionBar,
  onRowAdd,
  className,
  ...props
}: DataGridProps<TData>) {
  return (
    <div data-slot="data-grid-wrapper" dir={dir} {...props} className={cn("relative flex w-full flex-col", className)}>
      {table.options.enableSearch && <DataGridSearch table={table} />}
      <DataGridContextMenu table={table} dataGridRef={dataGridRef} />
      <DataGridPasteDialog table={table} />
      <DataGridViewport
        table={table}
        dataGridRef={dataGridRef}
        headerRef={headerRef}
        footerRef={footerRef}
        rowMapRef={rowMapRef}
        rowVirtualizerRef={rowVirtualizerRef}
        columnVirtualizerRef={columnVirtualizerRef}
        rowVirtualizerOptions={rowVirtualizerOptions}
        dataGridBodyProps={dataGridBodyProps}
        columnSizeVars={columnSizeVars}
        dir={dir}
        adjustLayout={adjustLayout}
        height={height}
        stretchColumns={stretchColumns}
        onRowAdd={onRowAdd}
      />
      {actionBar ? <DataGridActionBar table={table} actionBar={actionBar} /> : null}
    </div>
  )
}

interface ViewportInsets {
  readonly start: number
  readonly end: number
  readonly headerHeight: number
}

const EMPTY_VIEWPORT_INSETS: ViewportInsets = {
  start: 0,
  end: 0,
  headerHeight: 0
}

type DataGridViewportProps<TData extends RowData> = Pick<
  DataGridProps<TData>,
  | "table"
  | "dataGridRef"
  | "headerRef"
  | "footerRef"
  | "rowMapRef"
  | "rowVirtualizerRef"
  | "columnVirtualizerRef"
  | "rowVirtualizerOptions"
  | "dataGridBodyProps"
  | "columnSizeVars"
  | "dir"
  | "adjustLayout"
  | "onRowAdd"
> &
  Required<Pick<DataGridProps<TData>, "height" | "stretchColumns">>

/** What the latest draw of a viewport was given, for its ref callbacks, its range extractors and its listeners. */
interface ViewportDraw<TData extends RowData> {
  readonly table: DataGridProps<TData>["table"]
  readonly dataGridRef: DataGridProps<TData>["dataGridRef"]
  readonly headerRef: DataGridProps<TData>["headerRef"]
  readonly footerRef: DataGridProps<TData>["footerRef"]
  readonly rowVirtualizerRef: DataGridProps<TData>["rowVirtualizerRef"]
  readonly columnVirtualizerRef: DataGridProps<TData>["columnVirtualizerRef"]
  readonly centerColumns: ReadonlyArray<Column<DataGridFeatures, TData>>
  readonly rowSize: number
  readonly onRowAdd: DataGridProps<TData>["onRowAdd"]
}

/** Where the rows were when the last scroll was drawn, and whether they were pinned for a jump. */
interface CommittedScroll {
  readonly offset: number
  readonly isJumping: boolean
}

/** One viewport on screen: its boxes, its insets, its ref callbacks and handlers (made once) and what it keeps. */
interface Viewport<TData extends RowData> {
  readonly latest: RefObject<ViewportDraw<TData> | null>
  readonly virtualizers: RefObject<{
    readonly row: Virtualizer<HTMLDivElement, Element>
    readonly column: Virtualizer<HTMLDivElement, Element>
  } | null>
  readonly scroll: RefObject<CommittedScroll>
  readonly insets: Atom.Writable<ViewportInsets>
  readonly gridRef: (node: HTMLDivElement | null) => (() => void) | undefined
  readonly footerRef: (node: HTMLDivElement | null) => (() => void) | undefined
  readonly onRowVirtualizerChange: (virtualizer: Virtualizer<HTMLDivElement, Element>) => void
  readonly onRowAdd: (event: MouseEvent<HTMLDivElement>) => void
  readonly onFooterCellKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  readonly keep: {
    readonly rowRangeExtractor: Keep<(range: Range) => number[]>
    readonly getRowKey: Keep<(index: number) => string>
    readonly columnRangeExtractor: Keep<(range: Range) => number[]>
    readonly columnWindow: Keep<ColumnWindow | null>
    readonly readOnlyColumnIds: Keep<Set<string>>
    readonly rowContext: Keep<ComponentProps<typeof DataGridRowContext>["value"]>
  }
}

/** Whether the rows are pinned for a jump: the scroll moved further since the last scroll drawn than the rows kept. */
function getIsScrollJumping(input: {
  readonly isScrolling: boolean
  readonly offset: number
  readonly committed: CommittedScroll
  readonly rowSize: number
  readonly overscan: number
}) {
  const scrollDelta = Math.abs(input.offset - input.committed.offset)
  return (
    input.isScrolling &&
    scrollDelta > input.rowSize * (input.committed.isJumping ? SCROLL_JUMP_EXIT_ROWS_PER_COMMIT : input.overscan * 2)
  )
}

function makeViewport<TData extends RowData>(registry: AtomRegistry.AtomRegistry): Viewport<TData> {
  const latest: RefObject<ViewportDraw<TData> | null> = { current: null }
  const insets = Atom.make(EMPTY_VIEWPORT_INSETS).pipe(Atom.setIdleTTL(0))
  const scroll: RefObject<CommittedScroll> = { current: { offset: 0, isJumping: false } }
  let observer: ResizeObserver | null = null

  // What the header and the footer take of the grid's height, as upstream's layout effect measured it.
  function measure() {
    const draw = latest.current
    const dataGrid = draw?.dataGridRef.current
    if (!draw || !dataGrid) return
    const header = draw.headerRef.current
    const footer = draw.footerRef.current
    const gridRect = dataGrid.getBoundingClientRect()
    const next: ViewportInsets = {
      start: (header?.getBoundingClientRect().bottom ?? gridRect.top) - gridRect.top,
      end: gridRect.bottom - (footer?.getBoundingClientRect().top ?? gridRect.bottom),
      headerHeight: header?.offsetHeight ?? 0
    }
    const prev = registry.get(insets)
    if (prev.start === next.start && prev.end === next.end && prev.headerHeight === next.headerHeight) return
    registry.set(insets, next)
  }

  function observe(node: Element) {
    observer ??= new ResizeObserver(measure)
    observer.observe(node)
  }

  return {
    latest,
    virtualizers: { current: null },
    scroll,
    insets,
    // The grid and its header are measured from when the grid is attached, the footer from when it appears: each is
    // observed while it is on screen, where upstream measured them again when the footer or the row count changed.
    gridRef: (node) => {
      const draw = latest.current
      if (!draw || !node) return undefined
      const { dataGridRef } = draw
      const header = draw.headerRef.current
      dataGridRef.current = node
      observe(node)
      if (header) observe(header)
      measure()
      return () => {
        observer?.unobserve(node)
        if (header) observer?.unobserve(header)
        if (dataGridRef.current === node) dataGridRef.current = null
      }
    },
    footerRef: (node) => {
      const draw = latest.current
      if (!draw || !node) return undefined
      const { footerRef } = draw
      footerRef.current = node
      observe(node)
      measure()
      return () => {
        observer?.unobserve(node)
        if (footerRef.current === node) footerRef.current = null
        measure()
      }
    },
    // Called by the row virtualizer after the draw a scroll caused (it draws that one at once): what that draw worked
    // out is what the next draw compares with, as upstream's layout effect recorded it after each commit.
    onRowVirtualizerChange: (virtualizer) => {
      const draw = latest.current
      if (!draw) return
      const offset = virtualizer.scrollOffset ?? 0
      scroll.current = {
        offset,
        isJumping: getIsScrollJumping({
          isScrolling: virtualizer.isScrolling,
          offset,
          committed: scroll.current,
          rowSize: draw.rowSize,
          overscan: virtualizer.options.overscan
        })
      }
    },
    onRowAdd: (event) => {
      void latest.current?.onRowAdd?.(event)
    },
    onFooterCellKeyDown: (event) => {
      const onRowAdd = latest.current?.onRowAdd
      if (!onRowAdd) return

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        void onRowAdd(event)
      }
    },
    keep: {
      rowRangeExtractor: keepOne(),
      getRowKey: keepOne(),
      columnRangeExtractor: keepOne(),
      columnWindow: keepOne(),
      readOnlyColumnIds: keepOne(),
      rowContext: keepOne()
    }
  }
}

/** The viewport of one grid on screen, made for its `useId`, and let go the moment nothing reads it. */
const viewportOf = Atom.family((_instance: string) =>
  Atom.readable((get) => {
    const viewport: Viewport<any> = makeViewport<any>(get.registry)
    get.addFinalizer(() => {
      const draw = viewport.latest.current
      const virtualizers = viewport.virtualizers.current
      if (!draw || !virtualizers) return
      if (draw.rowVirtualizerRef.current === virtualizers.row) draw.rowVirtualizerRef.current = null
      if (draw.columnVirtualizerRef.current === virtualizers.column) draw.columnVirtualizerRef.current = null
    })
    return viewport
  }).pipe(Atom.setIdleTTL(0))
)

/**
 * While a viewport is mounted: both virtualizers measure again a frame after the table's columns, order, pinning,
 * sizes, visibility or sorting change, and once when it mounts, as upstream's layout effect did.
 */
const viewportListeners = Atom.family((instance: string) =>
  Atom.readable((get) => {
    const viewport = get(viewportOf(instance))
    const draw = viewport.latest.current
    if (!draw) return
    const { atoms } = draw.table
    let frame = 0
    const measureSoon = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        viewport.virtualizers.current?.row.measure()
        viewport.virtualizers.current?.column.measure()
      })
    }
    measureSoon()
    const subscriptions = [
      atoms.columnFilters.subscribe(measureSoon),
      atoms.columnOrder.subscribe(measureSoon),
      atoms.columnPinning.subscribe(measureSoon),
      atoms.columnSizing.subscribe(measureSoon),
      atoms.columnVisibility.subscribe(measureSoon),
      atoms.sorting.subscribe(measureSoon)
    ]
    get.addFinalizer(() => {
      cancelAnimationFrame(frame)
      for (const subscription of subscriptions) subscription.unsubscribe()
    })
  }).pipe(Atom.setIdleTTL(0))
)

function DataGridViewport<TData extends RowData>({
  table,
  dataGridRef,
  headerRef,
  footerRef,
  rowMapRef,
  rowVirtualizerRef,
  columnVirtualizerRef,
  rowVirtualizerOptions,
  dataGridBodyProps,
  columnSizeVars,
  dir,
  adjustLayout,
  height,
  stretchColumns,
  onRowAdd: onRowAddProp
}: DataGridViewportProps<TData>) {
  const instance = useId()
  const viewport: Viewport<TData> = useAtomValue(viewportOf(instance))
  const insets = useAtomValue(viewport.insets)
  const rows = table.getRowModel().rows
  const rowSize = table.getRowSize()
  const readOnly = table.getIsReadOnly()
  const leafColumns = table.getAllLeafColumns()
  const visibleColumnCount = table.getVisibleLeafColumns().length
  const headerGroups = table.getHeaderGroups()
  const startColumns = table.getStartVisibleLeafColumns()
  const centerColumns = table.getCenterVisibleLeafColumns()
  const startWidth = getColumnsWidth(startColumns)
  const centerWidth = getColumnsWidth(centerColumns)
  const endWidth = getColumnsWidth(table.getEndVisibleLeafColumns())

  viewport.latest.current = {
    table,
    dataGridRef,
    headerRef,
    footerRef,
    rowVirtualizerRef,
    columnVirtualizerRef,
    centerColumns,
    rowSize,
    onRowAdd: onRowAddProp
  }

  const isColumnVirtualizationEnabled = !stretchColumns && headerGroups.length === 1
  const enableCellEditing = table.options.enableCellEditing
  const hasFooter = !readOnly && !!onRowAddProp

  const rowRangeExtractor = viewport.keep.rowRangeExtractor([rowVirtualizerRef, rowSize], () => {
    return ({ startIndex, endIndex, overscan: overscanProp, count }: Range) => {
      const overscan = viewport.scroll.current.isJumping ? 0 : overscanProp
      const direction = rowVirtualizerRef.current?.scrollDirection ?? null
      const before =
        direction === "forward"
          ? Math.ceil(overscan / 3)
          : direction === "backward"
            ? overscan * 2 - Math.ceil(overscan / 3)
            : overscan
      const viewportHeight = rowVirtualizerRef.current?.scrollRect?.height ?? 0
      const visibleCount = viewportHeight > 0 ? Math.ceil(viewportHeight / rowSize) + 1 : endIndex - startIndex + 1
      const total = Math.min(count, visibleCount + overscan * 2)
      const start = Math.max(0, Math.min(startIndex - before, count - total))
      const indexes: number[] = []
      for (let index = start; index < start + total; index++) {
        indexes.push(index)
      }
      return indexes
    }
  })

  const getRowKey = viewport.keep.getRowKey([rowSize], () => (index: number) => `${index}:${rowSize}`)

  const rowVirtualizer = useVirtualizer({
    ...rowVirtualizerOptions,
    rangeExtractor: rowRangeExtractor,
    count: rows.length,
    getScrollElement: () => dataGridRef.current,
    getItemKey: getRowKey,
    estimateSize: () => rowSize,
    scrollPaddingStart: VIEWPORT_OFFSET,
    scrollPaddingEnd: insets.start + insets.end + VIEWPORT_OFFSET,
    onChange: viewport.onRowVirtualizerChange
  })

  // Local change: reads the center columns of the latest draw, where upstream's ref held those of the last commit.
  const columnRangeExtractor = viewport.keep.columnRangeExtractor([table], () => (range: Range) => {
    const indexes = defaultRangeExtractor(range)
    const activeColumnIds = [table.getFocusedCell()?.column.id, table.atoms.editingCell.get()?.columnId]
    const columnsNow = viewport.latest.current?.centerColumns ?? []
    for (const columnId of activeColumnIds) {
      if (!columnId) continue
      const index = columnsNow.findIndex((column) => column.id === columnId)
      if (index !== -1 && !indexes.includes(index)) indexes.push(index)
    }
    return indexes.sort((a, b) => a - b)
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    enabled: isColumnVirtualizationEnabled,
    isRtl: dir === "rtl",
    count: centerColumns.length,
    getScrollElement: () => dataGridRef.current,
    estimateSize: (index) => centerColumns[index]?.getSize() ?? 0,
    getItemKey: (index) => centerColumns[index]?.id ?? index,
    overscan: COLUMN_OVERSCAN,
    paddingStart: startWidth,
    scrollPaddingStart: startWidth + VIEWPORT_OFFSET,
    scrollPaddingEnd: endWidth + VIEWPORT_OFFSET,
    rangeExtractor: columnRangeExtractor
  })

  // Each virtualizer is the same object for the viewport's life: the hook's boxes hold them from the first draw.
  viewport.virtualizers.current = { row: rowVirtualizer, column: columnVirtualizer }
  rowVirtualizerRef.current = rowVirtualizer
  columnVirtualizerRef.current = columnVirtualizer
  useAtomMount(viewportListeners(instance))

  const scrollOffset = rowVirtualizer.scrollOffset ?? 0
  const isScrolling = rowVirtualizer.isScrolling || columnVirtualizer.isScrolling
  const isScrollJumping = getIsScrollJumping({
    isScrolling: rowVirtualizer.isScrolling,
    offset: scrollOffset,
    committed: viewport.scroll.current,
    rowSize,
    overscan: rowVirtualizer.options.overscan
  })
  const deferredIsScrolling = useDeferredValue(isScrolling)

  const columnWindowKey = isColumnVirtualizationEnabled
    ? getColumnWindowKey({
        virtualizer: columnVirtualizer,
        startCount: startColumns.length,
        centerCount: centerColumns.length,
        centerStart: startWidth,
        centerEnd: startWidth + centerWidth
      })
    : ""

  const columnWindow = viewport.keep.columnWindow([columnWindowKey], () => parseColumnWindowKey(columnWindowKey))

  // `getCanEdit` reads these table options, so they make the set anew.
  const readOnlyColumnIds = viewport.keep.readOnlyColumnIds(
    [leafColumns, readOnly, enableCellEditing],
    () => new Set(leafColumns.filter((column) => !column.getCanEdit()).map((column) => column.id))
  )

  const rowContext = viewport.keep.rowContext([stretchColumns, adjustLayout, readOnlyColumnIds, rowMapRef], () => ({
    stretchColumns,
    adjustLayout,
    readOnlyColumnIds,
    rowMapRef
  }))

  return (
    <div
      role="grid"
      aria-label="Data grid"
      aria-rowcount={rows.length + 1 + (hasFooter ? 1 : 0)}
      aria-colcount={visibleColumnCount}
      aria-multiselectable="true"
      data-slot="data-grid"
      tabIndex={0}
      ref={viewport.gridRef}
      className="relative isolate grid overflow-auto overscroll-x-contain rounded-md border tabular-nums select-none focus:outline-none"
      style={{
        ...columnSizeVars,
        maxHeight: `${height}px`
      }}
      onContextMenu={onDataGridContextMenu}
    >
      <DataGridHeader
        table={table}
        headerRef={headerRef}
        headerGroups={headerGroups}
        columnWindow={columnWindow}
        stretchColumns={stretchColumns}
      />
      <div
        role="rowgroup"
        data-slot="data-grid-body"
        {...dataGridBodyProps}
        className="relative grid"
        style={{
          ...dataGridBodyProps.style,
          height: `${rowVirtualizer.getTotalSize()}px`
        }}
      >
        <div
          data-slot="data-grid-rows"
          data-pinned={isScrollJumping ? "" : undefined}
          className="relative h-0 data-pinned:sticky"
          style={
            isScrollJumping
              ? {
                  top: insets.headerHeight,
                  transform: `translateY(${-scrollOffset}px)`
                }
              : undefined
          }
        >
          <DataGridRowContext value={rowContext}>
            {rowVirtualizer.getVirtualItems().map((virtualItem, _, items) => {
              const row = rows[virtualItem.index]
              if (!row) return null

              return (
                <DataGridRow
                  key={virtualItem.index % items.length}
                  row={row}
                  leafColumns={leafColumns}
                  virtualItem={virtualItem}
                  columnWindow={columnWindow}
                  isScrolling={isScrolling || deferredIsScrolling}
                />
              )
            })}
          </DataGridRowContext>
        </div>
      </div>
      {hasFooter && (
        <div
          role="rowgroup"
          data-slot="data-grid-footer"
          ref={viewport.footerRef}
          className="sticky bottom-0 z-30 grid border-t bg-background"
        >
          <div
            role="row"
            aria-rowindex={rows.length + 2}
            data-slot="data-grid-add-row"
            tabIndex={-1}
            className="flex w-full"
          >
            <div
              role="gridcell"
              tabIndex={0}
              className="relative flex h-9 grow items-center bg-muted/30 transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
              style={{
                width: table.getTotalSize(),
                minWidth: table.getTotalSize()
              }}
              onClick={viewport.onRowAdd}
              onKeyDown={viewport.onFooterCellKeyDown}
            >
              <div className="sticky inset-s-0 flex items-center gap-2 px-3 text-muted-foreground">
                <Plus className="size-3.5" />
                <span className="text-sm">Add row</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getColumnsWidth<TData extends RowData>(columns: Column<DataGridFeatures, TData>[]) {
  let width = 0
  for (const column of columns) width += column.getSize()
  return width
}

function getColumnWindowKey(params: {
  virtualizer: Virtualizer<HTMLDivElement, Element>
  startCount: number
  centerCount: number
  centerStart: number
  centerEnd: number
}) {
  const { virtualizer, startCount, centerCount, centerStart, centerEnd } = params
  const items = virtualizer.getVirtualItems()
  if (centerCount > 0 && items.length === 0) return ""
  let key = `${startCount}|${centerCount}|${centerStart}|${centerEnd}|`
  for (const item of items) {
    key += `${item.index}:${item.start}:${item.end},`
  }
  return key
}

function parseColumnWindowKey(key: string): ColumnWindow | null {
  if (!key) return null
  const [startCount, centerCount, centerStart, centerEnd, items = ""] = key.split("|")
  return {
    startCount: Number(startCount),
    centerCount: Number(centerCount),
    centerStart: Number(centerStart),
    centerEnd: Number(centerEnd),
    items: items
      .split(",")
      .filter(Boolean)
      .map((item) => {
        const [index, start, end] = item.split(":").map(Number)
        return { index: index ?? 0, start: start ?? 0, end: end ?? 0 }
      })
  }
}

interface DataGridActionBarProps<TData extends RowData> extends Pick<DataGridProps<TData>, "table"> {
  actionBar: ReactNode
}

function DataGridActionBar<TData extends RowData>({ table, actionBar }: DataGridActionBarProps<TData>) {
  return (
    <table.Subscribe selector={() => table.getHasRowSelection() || table.getHasCellRangeSelection()}>
      {(hasSelection) => (hasSelection ? actionBar : null)}
    </table.Subscribe>
  )
}

interface DataGridHeaderProps<TData extends RowData>
  extends Pick<DataGridProps<TData>, "table" | "headerRef">, Required<Pick<DataGridProps<TData>, "stretchColumns">> {
  headerGroups: HeaderGroup<DataGridFeatures, TData>[]
  columnWindow: ColumnWindow | null
}

const DataGridHeader = memo(
  DataGridHeaderImpl,
  (prev, next) =>
    prev.table.atoms === next.table.atoms &&
    prev.headerGroups === next.headerGroups &&
    prev.columnWindow === next.columnWindow &&
    prev.headerRef === next.headerRef &&
    prev.stretchColumns === next.stretchColumns
) as typeof DataGridHeaderImpl

function DataGridHeaderImpl<TData extends RowData>({
  table,
  headerRef,
  headerGroups,
  columnWindow,
  stretchColumns
}: DataGridHeaderProps<TData>) {
  return (
    <table.Subscribe selector={selectHeaderState}>
      {({ sorting }) => (
        <div
          role="rowgroup"
          data-slot="data-grid-header"
          ref={headerRef}
          className="sticky top-0 z-30 grid border-b bg-background"
        >
          {headerGroups.map((headerGroup, rowIndex) => (
            <div
              key={headerGroup.id}
              role="row"
              aria-rowindex={rowIndex + 1}
              data-slot="data-grid-header-row"
              tabIndex={-1}
              className="flex w-full overflow-x-clip"
            >
              {getWindowedColumns(headerGroup.headers, columnWindow).map((entry) => {
                if (entry.type === "spacer") {
                  return <div key={entry.key} aria-hidden="true" className="shrink-0" style={{ width: entry.size }} />
                }

                const { item: header, colIndex: columnIndex } = entry
                const primarySort = sorting[0]?.id === header.column.id ? sorting[0] : null

                const nextHeader = headerGroup.headers[columnIndex + 1]
                const isLastColumn = columnIndex === headerGroup.headers.length - 1

                const { showEndBorder, showStartBorder } = getColumnBorderVisibility({
                  column: header.column,
                  nextColumn: nextHeader?.column
                })

                const cornerClassName = cn(
                  rowIndex === 0 && {
                    "rounded-ss-[calc(var(--radius-md)-1px)]": columnIndex === 0,
                    "rounded-se-[calc(var(--radius-md)-1px)]": isLastColumn
                  }
                )

                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-colindex={columnIndex + 1}
                    aria-sort={primarySort ? (primarySort.desc ? "descending" : "ascending") : undefined}
                    data-slot="data-grid-header-cell"
                    data-column-id={header.column.id}
                    tabIndex={-1}
                    onMouseDown={onHeaderCellMouseDown}
                    className={cn("group/header relative", {
                      grow: stretchColumns && header.column.id !== "select",
                      "border-e": showEndBorder && header.column.id !== "select",
                      "border-s": showStartBorder && header.column.id !== "select"
                    })}
                    style={{
                      ...getColumnPinningStyle(header.column),
                      width: getHeaderSizeVar(header.id)
                    }}
                  >
                    {header.isPlaceholder ? null : header.column.columnDef.header !== undefined &&
                      typeof header.column.columnDef.header !== "string" ? (
                      <div
                        className={cn(
                          "size-full px-3 py-1.5 group-focus-within/header:ring-1 group-focus-within/header:ring-ring group-focus-within/header:ring-inset",
                          cornerClassName
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    ) : (
                      <DataGridColumnHeader table={table} header={header} className={cornerClassName} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </table.Subscribe>
  )
}

function selectHeaderState(state: TableState<DataGridFeatures>) {
  return {
    sorting: state.sorting,
    columnVisibility: state.columnVisibility,
    columnPinning: state.columnPinning,
    columnOrder: state.columnOrder,
    columnSizing: state.columnSizing,
    columnResizing: state.columnResizing
  }
}

function onDataGridContextMenu(event: MouseEvent<HTMLDivElement>) {
  event.preventDefault()
}

function onHeaderCellMouseDown(event: MouseEvent<HTMLDivElement>) {
  if (!event.currentTarget.querySelector("button, input, a[href]")) {
    event.preventDefault()
  }
}
