import {
  type ColumnFiltersState,
  functionalUpdate,
  type PaginationState,
  type RowData,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  useTable
} from "@tanstack/react-table"
import { Array as Arr } from "effect"
import * as React from "react"

import type { ColumnFilterItem, JoinOperator } from "@/components/ui/data-table/data-table-types"

import {
  applyColumnConfig,
  createConfigFromInputKey,
  type DataTableConfigInput,
  getConfigInputKey,
  getIsDataTableConfig,
  getUnmatchedConfigIds
} from "@/components/ui/data-table/data-table-config"
import { type DataTableFeatures, dataTableFeatures } from "@/components/ui/data-table/data-table-features"
import {
  getColumnFilters,
  getColumnFiltersKey,
  sortColumnFiltersByIds
} from "@/components/ui/data-table/data-table-parsers"
import { useTableStates } from "@/components/ui/data-table/data-table-state"
import { asFilterItems, getActiveFilters } from "@/components/ui/data-table/data-table-utils"
import { useDebouncedCallback } from "@/hooks/use-debounced-callback"

interface FiltersDraft {
  filters: ColumnFiltersState
  urlFiltersKey: string
  /** True while a typed value waits to be written: the field shows the draft, the address still has the old value. */
  waiting: boolean
}

/** How long a typed filter value waits for the next keystroke before it is written, as upstream's `debounceMs`. */
const typingPause = 300

/** The filters a person types into. A choice from a list or a switch is written at once. */
const typedVariants: ReadonlyArray<string> = ["text", "number", "range"]

type InitialTableState = Partial<TableState<DataTableFeatures>>

type UseDataTableProps<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "onPaginationChange"
  | "onSortingChange"
  | "onColumnFiltersChange"
  | "onGlobalFilterChange"
  | "onJoinOperatorChange"
  | "pageCount"
  | "features"
  | "initialState"
  | "enableGlobalFilter"
  | "pageSizeOptions"
  | "manualFiltering"
  | "manualPagination"
  | "autoResetPageIndex"
  | "manualSorting"
> & {
  config?: DataTableConfigInput
  /**
   * Keep the page, the order and the filters in the address (as the upstream table does) instead of in React
   * state: a refresh or a copied link shows the same rows. For a table that is the page; not for one inside a step.
   */
  urlState?: boolean
  initialState?: Omit<InitialTableState, "columnFilters" | "globalFilter" | "sorting" | "pagination" | "joinOperator">
} & (
    | {
        mode?: "server"
        pageCount: number
      }
    | {
        mode: "client"
        pageCount?: never
      }
  )

function useDataTable<TData extends RowData>({
  config: configProp,
  columns,
  mode = "server",
  pageCount,
  initialState,
  urlState = false,
  ...props
}: UseDataTableProps<TData>) {
  const isServer = mode === "server"
  const builtConfig = getIsDataTableConfig(configProp) ? configProp : undefined
  const configInputKey = builtConfig ? "" : getConfigInputKey(columns, configProp)
  const config = React.useMemo(
    () => builtConfig ?? createConfigFromInputKey(configInputKey),
    [builtConfig, configInputKey]
  )
  const { enableGlobalFilter, pageSizeOptions, filterVariants } = config

  const [initialTableState] = React.useState<InitialTableState>(() => ({
    ...initialState,
    sorting: config.defaultSorting,
    pagination: { pageIndex: 0, pageSize: config.defaultPageSize },
    joinOperator: config.defaultJoinOperator
  }))

  const tableColumns = React.useMemo(
    () => (builtConfig ? columns.map((column) => applyColumnConfig(column, builtConfig.columns)) : columns),
    [columns, builtConfig]
  )

  const hasInlineColumns = configProp !== undefined && !builtConfig && "columns" in configProp

  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    if (hasInlineColumns) {
      console.warn(
        "useDataTable: an inline config ignores `columns`. Pass the config through createDataTableConfig, or set the filter and sorting on the column defs."
      )
    }
    if (!builtConfig) return
    const unmatchedIds = getUnmatchedConfigIds(builtConfig.columns, columns)
    if (unmatchedIds.length === 0) return
    console.warn(
      `useDataTable: the config has no matching column for ${unmatchedIds.map((columnId) => `"${columnId}"`).join(", ")}. Rename the config key or add the column.`
    )
  }, [hasInlineColumns, builtConfig, columns])

  const filterableIds = React.useMemo(() => Object.keys(filterVariants), [filterVariants])

  // Upstream keeps this state in the URL with nuqs. Here it is React state unless `urlState` asks for the address,
  // which goes through the app's own router and not a second state library.
  const stateOptions = React.useMemo(() => (urlState ? { urlKeys: config.urlKeys } : {}), [urlState, config.urlKeys])
  const [{ page, perPage, sort: sorting, joinOperator, search }, setQueryState] = useTableStates(
    config.stateParsers,
    stateOptions
  )
  const [filterParams, setFilterParams, filterOrder] = useTableStates(config.filterParsers, stateOptions)

  const pagination = React.useMemo<PaginationState>(() => ({ pageIndex: page - 1, pageSize: perPage }), [page, perPage])

  const getNextPagination = useChainedUpdate(pagination)

  // The typed filter value that is waiting to be written, if any.
  const waitingFilters = React.useRef<ColumnFilterItem[] | null>(null)

  function onPaginationChange(updater: Updater<PaginationState>) {
    const next = getNextPagination(updater)
    // A typed filter still waiting is written first: written afterwards it would put the table back on page one
    // and undo this change of page.
    writeWaitingFilters()
    if (next.pageIndex !== pagination.pageIndex) {
      void setQueryState({ page: next.pageIndex + 1 })
    }
    if (next.pageSize !== pagination.pageSize) {
      void setQueryState({ perPage: next.pageSize })
    }
  }

  const getNextSorting = useChainedUpdate(sorting)

  function onSortingChange(updater: Updater<SortingState>) {
    const next = getNextSorting(updater)
    if (JSON.stringify(next) === JSON.stringify(sorting)) return
    void setQueryState({ sort: next, page: null })
  }

  const getNextJoinOperator = useChainedUpdate(joinOperator)

  function onJoinOperatorChange(updater: Updater<JoinOperator>) {
    const next = getNextJoinOperator(updater)
    if (next === joinOperator) return
    void setQueryState({ joinOperator: next, page: null })
  }

  const globalFilter = enableGlobalFilter ? search : ""
  const getNextGlobalFilter = useChainedUpdate<unknown>(globalFilter)

  function onGlobalFilterChange(updater: Updater<unknown>) {
    if (!enableGlobalFilter) return
    const value = getGlobalFilterValue(getNextGlobalFilter(updater))
    if (value === search) return
    void setQueryState({ search: value, page: null })
  }

  // Filters keep the order they were added in, as upstream's URL keys did.
  const urlFilters = React.useMemo(
    () => sortColumnFiltersByIds(getColumnFilters(filterableIds, filterParams), filterOrder),
    [filterableIds, filterParams, filterOrder]
  )
  const urlFiltersKey = getColumnFiltersKey(urlFilters)

  const [filtersDraft, setFiltersDraft] = React.useState<FiltersDraft | null>(null)
  const columnFilters =
    filtersDraft !== null && (filtersDraft.waiting || filtersDraft.urlFiltersKey === urlFiltersKey)
      ? filtersDraft.filters
      : urlFilters

  function writeFilters(activeFilters: ColumnFilterItem[]) {
    const params: Record<string, ColumnFilterItem[] | null> = {}
    for (const filter of activeFilters) {
      params[filter.id] = [...(params[filter.id] ?? []), filter]
    }
    for (const id of filterableIds) params[id] ??= null

    waitingFilters.current = null
    void setFilterParams(params)
    void setQueryState({ page: null })
    setFiltersDraft((draft) => (draft === null ? null : { ...draft, waiting: false }))
  }

  // Each keystroke in a filter field would otherwise be one write to the address and, for a table the server
  // filters, one request. The field shows the draft at once; the write waits for a pause in the typing.
  const writeFiltersAfterPause = useDebouncedCallback(writeFilters, typingPause)

  function writeWaitingFilters() {
    const waiting = waitingFilters.current
    if (waiting === null) return
    writeFiltersAfterPause.cancel()
    writeFilters(waiting)
  }

  const getNextColumnFilters = useChainedUpdate(columnFilters)

  function onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
    const filters = getNextColumnFilters(updater)
    const activeFilters = getActiveFilters(asFilterItems(filters)).filter((filter) =>
      Object.hasOwn(filterVariants, filter.id)
    )
    const nextUrlFiltersKey = getColumnFiltersKey(activeFilters)

    writeFiltersAfterPause.cancel()
    waitingFilters.current = null
    if (
      nextUrlFiltersKey === urlFiltersKey &&
      getFilterColumnOrder(activeFilters) === getFilterColumnOrder(urlFilters)
    ) {
      setFiltersDraft({ filters, urlFiltersKey: nextUrlFiltersKey, waiting: false })
      return
    }

    if (isTyping(urlFilters, activeFilters)) {
      setFiltersDraft({ filters, urlFiltersKey: nextUrlFiltersKey, waiting: true })
      waitingFilters.current = activeFilters
      writeFiltersAfterPause(activeFilters)
      return
    }
    setFiltersDraft({ filters, urlFiltersKey: nextUrlFiltersKey, waiting: false })
    writeFilters(activeFilters)
  }

  /**
   * Whether the only difference between the filters in the address and the next ones is a value being typed: every
   * column that changed is a typed kind and still has a value. Clearing a field, or choosing from a list, is not.
   */
  function isTyping(current: ColumnFilterItem[], next: ColumnFilterItem[]) {
    const changed = filterableIds.filter((id) => {
      const before = current.filter((filter) => filter.id === id)
      const after = next.filter((filter) => filter.id === id)
      return getColumnFiltersKey(before) !== getColumnFiltersKey(after)
    })
    return (
      changed.length > 0 &&
      changed.every(
        (id) =>
          typedVariants.includes(String((filterVariants as Record<string, string>)[id])) &&
          next.some((filter) => filter.id === id)
      )
    )
  }

  const table = useTable(
    {
      ...props,
      features: dataTableFeatures,
      columns: tableColumns,
      enableGlobalFilter,
      pageSizeOptions,
      initialState: initialTableState,
      ...(isServer && pageCount !== undefined ? { pageCount } : {}),
      state: {
        pagination,
        sorting,
        columnFilters,
        joinOperator,
        globalFilter
      },
      onPaginationChange,
      onSortingChange,
      onColumnFiltersChange,
      onJoinOperatorChange,
      onGlobalFilterChange,
      manualPagination: isServer,
      autoResetPageIndex: false,
      manualSorting: isServer,
      manualFiltering: isServer
    },
    selectTableState
  )

  return { table }
}

function getFilterColumnOrder(filters: ColumnFilterItem[]) {
  return JSON.stringify(Arr.dedupe(filters.map((filter) => filter.id)))
}

function getGlobalFilterValue(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  return ""
}

function selectTableState(state: TableState<DataTableFeatures>) {
  return {
    columnFilters: state.columnFilters,
    globalFilter: state.globalFilter,
    joinOperator: state.joinOperator,
    pagination: state.pagination,
    sorting: state.sorting
  }
}

function useChainedUpdate<TValue>(value: TValue) {
  const pendingRef = React.useRef<{ base: TValue; next: TValue } | null>(null)

  return (updater: Updater<TValue>) => {
    const pending = pendingRef.current
    const next = functionalUpdate(updater, pending?.base === value ? pending.next : value)
    pendingRef.current = { base: value, next }
    return next
  }
}

export { useDataTable, type UseDataTableProps }
