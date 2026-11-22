"use client"
// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 2); no longer as its registry has it.
// The viewport's own values are atoms of its grid (made for the grid's `useId`): the measured insets, the scroll the
// last draw was made at, and `viewportLayout`, which holds the ref callbacks of the grid's element and its footer
// (they put the grid's listeners on, measure it with a ResizeObserver and have the virtualizers measure again when the
// columns, filters or sort change) and the range functions TanStack Virtual is given, kept while the row height is the
// same. Upstream did this in layout effects and kept its values in refs. The rows share one object (`shared`), kept
// while it says the same, where upstream had a context. The rule this file protects: the virtualizer is given the same
// functions from draw to draw, so 50,000 rows scroll as fast as they did.
import { useAtomValue } from "@effect/atom-react"
import {
  type Column,
  flexRender,
  type HeaderGroup,
  type RowData,
  type Table,
  type TableState
} from "@tanstack/react-table"
import { defaultRangeExtractor, type Range, useVirtualizer, type Virtualizer } from "@tanstack/react-virtual"
import { cn } from "cn"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import {
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefCallback,
  useDeferredValue
} from "react"

import type { DataGridFeatures } from "@inventory/ui/components/data-grid/data-grid-features"
import type { ColumnWindow } from "@inventory/ui/components/data-grid/data-grid-types"

import {
  columnVirtualizerOf,
  emptyKept,
  gridController,
  gridTableOf,
  type Kept,
  kept,
  rowVirtualizerOf,
  type useDataGrid
} from "@inventory/ui/components/data-grid/use-data-grid"
import {
  getColumnBorderVisibility,
  getColumnPinningStyle,
  getHeaderSizeVar,
  getWindowedColumns
} from "@inventory/ui/components/data-grid/data-grid-utils"
import { DataGridColumnHeader } from "@inventory/ui/components/data-grid/data-grid-column-header"
import { DataGridContextMenu } from "@inventory/ui/components/data-grid/data-grid-context-menu"
import { DataGridPasteDialog } from "@inventory/ui/components/data-grid/data-grid-paste-dialog"
import { DataGridRow, type DataGridRowShared } from "@inventory/ui/components/data-grid/data-grid-row"
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
  gridId,
  dataGridRef,
  headerRef,
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
      {table.options.enableSearch && <DataGridSearch table={table} gridId={gridId} />}
      <DataGridContextMenu table={table} dataGridRef={dataGridRef} />
      <DataGridPasteDialog table={table} />
      <DataGridViewport
        table={table}
        gridId={gridId}
        headerRef={headerRef}
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
  start: number
  end: number
  headerHeight: number
}

const EMPTY_VIEWPORT_INSETS: ViewportInsets = {
  start: 0,
  end: 0,
  headerHeight: 0
}

/** The insets one grid's viewport measured: the header above the rows and the footer below them. */
const viewportInsets = Atom.family((_grid: string) => Atom.make<ViewportInsets>(EMPTY_VIEWPORT_INSETS))

/** The scroll the last draw of one grid's viewport was made at, and whether it was jumping. */
const scrollCommitted = Atom.family((_grid: string) =>
  Atom.make<{ readonly offset: number; readonly isJumping: boolean } | null>(null)
)

/** The columns between the pinned ones, as one grid's viewport draws them, for its column range. */
const centerColumnsOf = Atom.family((_grid: string) => Atom.make<ReadonlyArray<{ readonly id: string }>>([]))

/**
 * What one grid's viewport keeps for its whole life: its ref callbacks, its range functions, its memo slots, and the
 * registry and per-grid atoms its draw reads, looked up once rather than on every draw (an arrow key draws it again).
 */
interface ViewportLayout {
  readonly registry: AtomRegistry.AtomRegistry
  readonly atoms: {
    readonly insets: Atom.Writable<ViewportInsets>
    readonly scrollCommitted: Atom.Writable<{ readonly offset: number; readonly isJumping: boolean } | null>
    readonly centerColumns: Atom.Writable<ReadonlyArray<{ readonly id: string }>>
    readonly rowVirtualizer: Atom.Writable<Virtualizer<HTMLDivElement, Element> | null>
    readonly columnVirtualizer: Atom.Writable<Virtualizer<HTMLDivElement, Element> | null>
  }
  /** The grid's element, which both virtualizers scroll. */
  readonly scrollElement: () => HTMLDivElement | null
  readonly gridRef: RefCallback<HTMLDivElement>
  readonly footerRef: RefCallback<HTMLDivElement>
  readonly columnRangeExtractor: (range: Range) => number[]
  readonly kept: {
    readonly rowRange: Kept<(range: Range) => number[]>
    readonly rowKey: Kept<(index: number) => string>
    readonly columnWindow: Kept<ColumnWindow | null>
    readonly readOnlyColumnIds: Kept<Set<string>>
    readonly shared: Kept<DataGridRowShared>
  }
}

const viewportLayout = Atom.family((grid: string) =>
  Atom.readable((get): ViewportLayout => {
    const registry = get.registry
    const controller = get(gridController(grid))
    get.mount(viewportInsets(grid))
    get.mount(scrollCommitted(grid))
    get.mount(centerColumnsOf(grid))

    function measure() {
      const dataGrid = controller.dataGridRef.current
      if (!dataGrid) return
      const header = controller.headerRef.current
      const footer = controller.footerRef.current
      const gridRect = dataGrid.getBoundingClientRect()
      const next: ViewportInsets = {
        start: (header?.getBoundingClientRect().bottom ?? gridRect.top) - gridRect.top,
        end: gridRect.bottom - (footer?.getBoundingClientRect().top ?? gridRect.bottom),
        headerHeight: header?.offsetHeight ?? 0
      }
      const prev = registry.get(viewportInsets(grid))
      if (prev.start !== next.start || prev.end !== next.end || prev.headerHeight !== next.headerHeight) {
        registry.set(viewportInsets(grid), next)
      }
    }

    const observer = new ResizeObserver(measure)
    get.addFinalizer(() => observer.disconnect())

    // The virtualizers measure their items again a frame after the columns, filters or sort change.
    let measureFrame = 0
    function measureVirtualizers() {
      cancelAnimationFrame(measureFrame)
      measureFrame = requestAnimationFrame(() => {
        registry.get(rowVirtualizerOf(grid))?.measure()
        registry.get(columnVirtualizerOf(grid))?.measure()
      })
    }

    const gridRef: RefCallback<HTMLDivElement> = (dataGrid) => {
      if (!dataGrid) return
      const detach = controller.attachGrid(dataGrid)
      measure()
      observer.observe(dataGrid)
      const header = controller.headerRef.current
      if (header) observer.observe(header)

      const unsubscribes: Array<() => void> = []
      const table = getGridTable(registry, grid)
      if (table) {
        const { columnFilters, columnOrder, columnPinning, columnSizing, columnVisibility, sorting } = table.atoms
        const followed: ReadonlyArray<{ subscribe: (listener: () => void) => { unsubscribe: () => void } }> = [
          columnFilters,
          columnOrder,
          columnPinning,
          columnSizing,
          columnVisibility,
          sorting
        ]
        for (const atom of followed) {
          const subscription = atom.subscribe(measureVirtualizers)
          unsubscribes.push(() => subscription.unsubscribe())
        }
      }
      measureVirtualizers()

      return () => {
        for (const unsubscribe of unsubscribes) unsubscribe()
        cancelAnimationFrame(measureFrame)
        observer.unobserve(dataGrid)
        if (header) observer.unobserve(header)
        detach()
      }
    }

    const footerRef: RefCallback<HTMLDivElement> = (footer) => {
      if (!footer) return
      controller.footerRef.current = footer
      observer.observe(footer)
      measure()
      return () => {
        observer.unobserve(footer)
        if (controller.footerRef.current === footer) controller.footerRef.current = null
        // Measured again once the footer has left the page.
        queueMicrotask(measure)
      }
    }

    function columnRangeExtractor(range: Range) {
      const indexes = defaultRangeExtractor(range)
      const table = getGridTable(registry, grid)
      const activeColumnIds = [table?.getFocusedCell()?.column.id, table?.atoms.editingCell.get()?.columnId]
      const centerColumns = registry.get(centerColumnsOf(grid))
      for (const columnId of activeColumnIds) {
        if (!columnId) continue
        const index = centerColumns.findIndex((column) => column.id === columnId)
        if (index !== -1 && !indexes.includes(index)) indexes.push(index)
      }
      return indexes.sort((a, b) => a - b)
    }

    return {
      registry,
      atoms: {
        insets: viewportInsets(grid),
        scrollCommitted: scrollCommitted(grid),
        centerColumns: centerColumnsOf(grid),
        rowVirtualizer: rowVirtualizerOf(grid),
        columnVirtualizer: columnVirtualizerOf(grid)
      },
      scrollElement: () => controller.dataGridRef.current,
      gridRef,
      footerRef,
      columnRangeExtractor,
      kept: {
        rowRange: emptyKept(),
        rowKey: emptyKept(),
        columnWindow: emptyKept(),
        readOnlyColumnIds: emptyKept(),
        shared: emptyKept()
      }
    }
  }).pipe(Atom.setIdleTTL(0))
)

/** The table one grid was first drawn with: its methods and atoms act on the table as it is now. */
function getGridTable(registry: AtomRegistry.AtomRegistry, grid: string) {
  return registry.get(gridTableOf(grid)) as Table<DataGridFeatures, RowData> | null
}

type DataGridViewportProps<TData extends RowData> = Pick<
  DataGridProps<TData>,
  | "table"
  | "gridId"
  | "headerRef"
  | "rowVirtualizerOptions"
  | "dataGridBodyProps"
  | "columnSizeVars"
  | "dir"
  | "adjustLayout"
  | "onRowAdd"
> &
  Required<Pick<DataGridProps<TData>, "height" | "stretchColumns">>

function DataGridViewport<TData extends RowData>({
  table,
  gridId,
  headerRef,
  rowVirtualizerOptions,
  dataGridBodyProps,
  columnSizeVars,
  dir,
  adjustLayout,
  height,
  stretchColumns,
  onRowAdd: onRowAddProp
}: DataGridViewportProps<TData>) {
  const layout = useAtomValue(viewportLayout(gridId))
  const { registry, atoms } = layout
  const insets = useAtomValue(atoms.insets)
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
  if (registry.get(atoms.centerColumns) !== centerColumns) registry.set(atoms.centerColumns, centerColumns)

  const isColumnVirtualizationEnabled = !stretchColumns && headerGroups.length === 1
  const enableCellEditing = table.options.enableCellEditing
  const hasFooter = !readOnly && !!onRowAddProp

  const rowRangeExtractor = kept(
    layout.kept.rowRange,
    [rowSize],
    () =>
      ({ startIndex, endIndex, overscan: overscanProp, count }: Range) => {
        const overscan = registry.get(atoms.scrollCommitted)?.isJumping === true ? 0 : overscanProp
        const rowVirtualizer = registry.get(atoms.rowVirtualizer)
        const direction = rowVirtualizer?.scrollDirection ?? null
        const before =
          direction === "forward"
            ? Math.ceil(overscan / 3)
            : direction === "backward"
              ? overscan * 2 - Math.ceil(overscan / 3)
              : overscan
        const viewportHeight = rowVirtualizer?.scrollRect?.height ?? 0
        const visibleCount = viewportHeight > 0 ? Math.ceil(viewportHeight / rowSize) + 1 : endIndex - startIndex + 1
        const total = Math.min(count, visibleCount + overscan * 2)
        const start = Math.max(0, Math.min(startIndex - before, count - total))
        const indexes: number[] = []
        for (let index = start; index < start + total; index++) {
          indexes.push(index)
        }
        return indexes
      }
  )

  const getRowKey = kept(layout.kept.rowKey, [rowSize], () => (index: number) => `${index}:${rowSize}`)

  const rowVirtualizer = useVirtualizer({
    ...rowVirtualizerOptions,
    rangeExtractor: rowRangeExtractor,
    count: rows.length,
    getScrollElement: layout.scrollElement,
    getItemKey: getRowKey,
    estimateSize: () => rowSize,
    scrollPaddingStart: VIEWPORT_OFFSET,
    scrollPaddingEnd: insets.start + insets.end + VIEWPORT_OFFSET
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    enabled: isColumnVirtualizationEnabled,
    isRtl: dir === "rtl",
    count: centerColumns.length,
    getScrollElement: layout.scrollElement,
    estimateSize: (index) => centerColumns[index]?.getSize() ?? 0,
    getItemKey: (index) => centerColumns[index]?.id ?? index,
    overscan: COLUMN_OVERSCAN,
    paddingStart: startWidth,
    scrollPaddingStart: startWidth + VIEWPORT_OFFSET,
    scrollPaddingEnd: endWidth + VIEWPORT_OFFSET,
    rangeExtractor: layout.columnRangeExtractor
  })

  // TanStack Virtual keeps one virtualizer per viewport: it is handed to the grid's handlers the first time it is drawn.
  if (registry.get(atoms.rowVirtualizer) !== rowVirtualizer) registry.set(atoms.rowVirtualizer, rowVirtualizer)
  if (registry.get(atoms.columnVirtualizer) !== columnVirtualizer) {
    registry.set(atoms.columnVirtualizer, columnVirtualizer)
  }

  const scrollOffset = rowVirtualizer.scrollOffset ?? 0
  const committedScroll = registry.get(atoms.scrollCommitted) ?? { offset: scrollOffset, isJumping: false }
  const scrollDelta = Math.abs(scrollOffset - committedScroll.offset)
  const isScrolling = rowVirtualizer.isScrolling || columnVirtualizer.isScrolling
  const isScrollJumping =
    rowVirtualizer.isScrolling &&
    scrollDelta >
      rowSize * (committedScroll.isJumping ? SCROLL_JUMP_EXIT_ROWS_PER_COMMIT : rowVirtualizer.options.overscan * 2)
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

  const columnWindow = kept(layout.kept.columnWindow, [columnWindowKey], () => parseColumnWindowKey(columnWindowKey))

  const readOnlyColumnIds = kept(
    layout.kept.readOnlyColumnIds,
    // `getCanEdit` reads these table options, so they make the set again.
    [leafColumns, readOnly, enableCellEditing],
    () => new Set(leafColumns.filter((column) => !column.getCanEdit()).map((column) => column.id))
  )

  const shared = kept(layout.kept.shared, [stretchColumns, adjustLayout, readOnlyColumnIds], () => ({
    stretchColumns,
    adjustLayout,
    readOnlyColumnIds
  }))

  function onRowAdd(event: ReactMouseEvent<HTMLDivElement>) {
    void onRowAddProp?.(event)
  }

  function onFooterCellKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!onRowAddProp) return

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      void onRowAddProp(event)
    }
  }

  const drawn = (
    <div
      role="grid"
      aria-label="Data grid"
      aria-rowcount={rows.length + 1 + (hasFooter ? 1 : 0)}
      aria-colcount={visibleColumnCount}
      aria-multiselectable="true"
      data-slot="data-grid"
      tabIndex={0}
      ref={layout.gridRef}
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
                shared={shared}
              />
            )
          })}
        </div>
      </div>
      {hasFooter && (
        <div
          role="rowgroup"
          data-slot="data-grid-footer"
          ref={layout.footerRef}
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
              onClick={onRowAdd}
              onKeyDown={onFooterCellKeyDown}
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

  // What the next draw and the range functions compare with: this draw's scroll, once the rows above have been drawn
  // with the last one's (upstream wrote it in a layout effect after the draw).
  const committed = registry.get(atoms.scrollCommitted)
  if (committed?.offset !== scrollOffset || committed.isJumping !== isScrollJumping) {
    registry.set(atoms.scrollCommitted, { offset: scrollOffset, isJumping: isScrollJumping })
  }

  return drawn
}

function onDataGridContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
  event.preventDefault()
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

function onHeaderCellMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
  if (!event.currentTarget.querySelector("button, input, a[href]")) {
    event.preventDefault()
  }
}
