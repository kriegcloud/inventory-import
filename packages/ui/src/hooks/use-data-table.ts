// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
// The table's page, order, search and filters live in the address (`urlState`) or in atoms of this table's own, and a
// typed filter waits for a pause in an atom's timer. The rule this file protects: a change reads the state as it is
// now (the registry), never as the last draw saw it, so two changes in one tick both land and the address after a
// sort, a filter or a page is what it was when this was React state.
import { useAtomMount, useAtomValue } from "@effect/atom-react"
import {
  type ColumnDef,
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
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { useId } from "react"

import { stringify } from "@inventory/ui/Json"
import { location } from "@inventory/ui/Route"

import type { ColumnFilterItem, JoinOperator } from "@inventory/ui/components/data-table/data-table-types"

import {
  applyColumnConfig,
  createConfigFromInputKey,
  type DataTableConfig,
  type DataTableConfigInput,
  getConfigInputKey,
  getIsDataTableConfig,
  getUnmatchedConfigIds
} from "@inventory/ui/components/data-table/data-table-config"
import { type DataTableFeatures, dataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import {
  getColumnFilters,
  getColumnFiltersKey,
  sortColumnFiltersByIds
} from "@inventory/ui/components/data-table/data-table-parsers"
import {
  atomRegistry,
  localTableState,
  oneTimer,
  type ParserUpdate,
  type TableStateRecord,
  tableStateFromAddress,
  tableStateKeys,
  tableStateValues,
  updateTableState,
  writeTableState
} from "@inventory/ui/components/data-table/data-table-state"
import { asFilterItems, getActiveFilters } from "@inventory/ui/components/data-table/data-table-utils"

/** The filters as the field shows them while what is in the address may still be older. */
interface FiltersDraft {
  readonly filters: ColumnFiltersState
  readonly urlFiltersKey: string
  /** The typed filters waiting to be written, while a typed value waits: the address still has the old value. */
  readonly waiting: ColumnFilterItem[] | null
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
   * Keep the page, the order and the filters in the address (as the upstream table does) instead of in the table's
   * own atoms: a refresh or a copied link shows the same rows. For a table that is the page; not for one inside a step.
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

/** What the table's state is worked out from: the parts of its config that read and write the state. */
type DataTableStateConfig = Pick<
  DataTableConfig,
  "stateParsers" | "filterParsers" | "urlKeys" | "filterVariants" | "enableGlobalFilter"
>

/** The table's state as one draw, or one change, sees it. */
interface DataTableNow {
  readonly pagination: PaginationState
  readonly sorting: SortingState
  readonly joinOperator: JoinOperator
  readonly search: string
  readonly globalFilter: string
  readonly urlFilters: ColumnFilterItem[]
  readonly urlFiltersKey: string
  readonly columnFilters: ColumnFiltersState
}

/** The typed filters of one table on screen not yet in the address, made for each instance (its `useId`). */
const filtersDraft = Atom.family((_instance: string) => Atom.make<FiltersDraft | null>(null))

/** The atoms one table on screen keeps: its state when not in the address, its draft and its typing pause. */
export const dataTableAtoms = (instance: string) => ({
  query: localTableState(`${instance}/query`),
  filters: localTableState(`${instance}/filters`),
  draft: filtersDraft(instance),
  pause: oneTimer(instance)
})

// One config per config input, so a table built from its columns keeps the same config while they say the same.
const configs = MutableHashMap.empty<string, ReturnType<typeof createConfigFromInputKey>>()

function configFor(key: string) {
  const kept = O.getOrUndefined(MutableHashMap.get(configs, key))
  if (kept !== undefined) return kept
  const made = createConfigFromInputKey(key)
  MutableHashMap.set(configs, key, made)
  return made
}

// The columns with their config applied, kept while the columns and the config are the same objects.
const configured = new WeakMap<object, WeakMap<object, unknown>>()

function configuredColumns<TData extends RowData>(
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
  builtConfig: { readonly columns: DataTableConfig["columns"] }
): readonly ColumnDef<DataTableFeatures, TData>[] {
  const byConfig = configured.get(columns) ?? new WeakMap<object, unknown>()
  configured.set(columns, byConfig)
  const kept = byConfig.get(builtConfig)
  if (kept !== undefined) return kept as readonly ColumnDef<DataTableFeatures, TData>[]
  const made = columns.map((column) => applyColumnConfig(column, builtConfig.columns))
  byConfig.set(builtConfig, made)
  return made
}

// The column sets already checked against their config, so a development warning is said once for each.
const checked = new WeakMap<object, WeakSet<object>>()
const noConfig = {}

function warnOfConfig<TData extends RowData>(
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
  configProp: DataTableConfigInput | undefined,
  builtConfig: { readonly columns: DataTableConfig["columns"] } | undefined
) {
  if (!import.meta.env.DEV) return
  const against = builtConfig ?? configProp ?? noConfig
  const seen = checked.get(columns) ?? new WeakSet<object>()
  checked.set(columns, seen)
  if (seen.has(against)) return
  seen.add(against)
  if (configProp !== undefined && builtConfig === undefined && "columns" in configProp) {
    Effect.runSync(
      Effect.logWarning(
        "useDataTable: an inline config ignores `columns`. Pass the config through createDataTableConfig, or set the filter and sorting on the column defs."
      )
    )
  }
  if (builtConfig === undefined) return
  const unmatchedIds = getUnmatchedConfigIds(builtConfig.columns, columns)
  if (unmatchedIds.length === 0) return
  Effect.runSync(
    Effect.logWarning(
      `useDataTable: the config has no matching column for ${unmatchedIds.map((columnId) => `"${columnId}"`).join(", ")}. Rename the config key or add the column.`
    )
  )
}

const filterIdsKept = new WeakMap<object, string[]>()

function filterableIdsOf(config: DataTableStateConfig): string[] {
  const kept = filterIdsKept.get(config.filterVariants)
  if (kept !== undefined) return kept
  const ids = Object.keys(config.filterVariants)
  filterIdsKept.set(config.filterVariants, ids)
  return ids
}

// The page as the table holds it: the same object while the page and its size are the same.
const lastPagination = new WeakMap<object, PaginationState>()

function paginationOf(config: DataTableStateConfig, page: number, perPage: number): PaginationState {
  const last = lastPagination.get(config.stateParsers)
  if (last !== undefined && last.pageIndex === page - 1 && last.pageSize === perPage) return last
  const next = { pageIndex: page - 1, pageSize: perPage }
  lastPagination.set(config.stateParsers, next)
  return next
}

// Filters keep the order they were added in, as upstream's URL keys did; kept while the filter state is the same.
const urlFiltersKept = new WeakMap<TableStateRecord, WeakMap<object, ColumnFilterItem[]>>()

function urlFiltersOf(config: DataTableStateConfig, filterState: TableStateRecord): ColumnFilterItem[] {
  const byParsers = urlFiltersKept.get(filterState) ?? new WeakMap<object, ColumnFilterItem[]>()
  urlFiltersKept.set(filterState, byParsers)
  const kept = byParsers.get(config.filterParsers)
  if (kept !== undefined) return kept
  const filterParams = tableStateValues(config.filterParsers, filterState)
  const made = sortColumnFiltersByIds(
    getColumnFilters(filterableIdsOf(config), filterParams),
    tableStateKeys(filterState)
  )
  byParsers.set(config.filterParsers, made)
  return made
}

/**
 * The table's state from what it is kept in: the address when `urlState` is on, the table's own atoms otherwise, and
 * the draft of a filter being typed.
 */
function dataTableNow(input: {
  readonly config: DataTableStateConfig
  readonly urlState: boolean
  readonly params: URLSearchParams
  readonly query: TableStateRecord
  readonly filters: TableStateRecord
  readonly draft: FiltersDraft | null
}): DataTableNow {
  const { config, urlState, params, draft } = input
  const queryState = urlState ? tableStateFromAddress(config.stateParsers, config.urlKeys, params) : input.query
  const filterState = urlState ? tableStateFromAddress(config.filterParsers, config.urlKeys, params) : input.filters
  const { page, perPage, sort, joinOperator, search } = tableStateValues(config.stateParsers, queryState)
  const urlFilters = urlFiltersOf(config, filterState)
  const urlFiltersKey = getColumnFiltersKey(urlFilters)
  const columnFilters =
    draft !== null && (draft.waiting !== null || draft.urlFiltersKey === urlFiltersKey) ? draft.filters : urlFilters
  return {
    pagination: paginationOf(config, page, perPage),
    sorting: sort,
    joinOperator,
    search,
    globalFilter: config.enableGlobalFilter ? search : "",
    urlFilters,
    urlFiltersKey,
    columnFilters
  }
}

/**
 * What a change to one table on screen does, read and written through the registry: each handler starts from the
 * state as it is now. `useDataTable` hands these to the table; a test drives them the same way.
 */
export function dataTableStore(input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly instance: string
  readonly config: DataTableStateConfig
  readonly urlState: boolean
}) {
  const { registry, config, urlState } = input
  const atoms = dataTableAtoms(input.instance)
  const filterVariants: Record<string, string> = config.filterVariants
  const filterableIds = filterableIdsOf(config)

  const now = () =>
    dataTableNow({
      config,
      urlState,
      params: registry.get(location).params,
      query: registry.get(atoms.query),
      filters: registry.get(atoms.filters),
      draft: registry.get(atoms.draft)
    })

  const setQueryState = (update: ParserUpdate<DataTableStateConfig["stateParsers"]>) => {
    if (urlState) {
      writeTableState(config.stateParsers, config.urlKeys, update)
      return
    }
    registry.set(atoms.query, updateTableState(config.stateParsers, registry.get(atoms.query), update))
  }

  const setFilterParams = (update: Record<string, ColumnFilterItem[] | null>) => {
    if (urlState) {
      writeTableState(config.filterParsers, config.urlKeys, update)
      return
    }
    registry.set(atoms.filters, updateTableState(config.filterParsers, registry.get(atoms.filters), update))
  }

  const setDraft = (draft: FiltersDraft | null) => registry.set(atoms.draft, draft)

  function writeFilters(activeFilters: ColumnFilterItem[]) {
    const params: Record<string, ColumnFilterItem[] | null> = {}
    for (const filter of activeFilters) {
      params[filter.id] = [...(params[filter.id] ?? []), filter]
    }
    for (const id of filterableIds) params[id] ??= null

    setFilterParams(params)
    setQueryState({ page: null })
    const draft = registry.get(atoms.draft)
    setDraft(draft === null ? null : { ...draft, waiting: null })
  }

  // A typed filter still waiting is written first: written afterwards it would put the table back on page one and
  // undo a change of page.
  function writeWaitingFilters() {
    const waiting = registry.get(atoms.draft)?.waiting ?? null
    if (waiting === null) return
    registry.get(atoms.pause).cancel()
    writeFilters(waiting)
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
        (id) => typedVariants.includes(String(filterVariants[id])) && next.some((filter) => filter.id === id)
      )
    )
  }

  return {
    now,

    onPaginationChange(updater: Updater<PaginationState>) {
      const { pagination } = now()
      const next = functionalUpdate(updater, pagination)
      writeWaitingFilters()
      if (next.pageIndex !== pagination.pageIndex) {
        setQueryState({ page: next.pageIndex + 1 })
      }
      if (next.pageSize !== pagination.pageSize) {
        setQueryState({ perPage: next.pageSize })
      }
    },

    onSortingChange(updater: Updater<SortingState>) {
      const { sorting } = now()
      const next = functionalUpdate(updater, sorting)
      if (stringify(next) === stringify(sorting)) return
      setQueryState({ sort: next, page: null })
    },

    onJoinOperatorChange(updater: Updater<JoinOperator>) {
      const { joinOperator } = now()
      const next = functionalUpdate(updater, joinOperator)
      if (next === joinOperator) return
      setQueryState({ joinOperator: next, page: null })
    },

    onGlobalFilterChange(updater: Updater<unknown>) {
      if (!config.enableGlobalFilter) return
      const { globalFilter, search } = now()
      const value = getGlobalFilterValue(functionalUpdate(updater, globalFilter))
      if (value === search) return
      setQueryState({ search: value, page: null })
    },

    onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
      const { columnFilters, urlFilters, urlFiltersKey } = now()
      const filters = functionalUpdate(updater, columnFilters)
      const activeFilters = getActiveFilters(asFilterItems(filters)).filter((filter) =>
        Object.hasOwn(filterVariants, filter.id)
      )
      const nextUrlFiltersKey = getColumnFiltersKey(activeFilters)

      registry.get(atoms.pause).cancel()
      if (
        nextUrlFiltersKey === urlFiltersKey &&
        getFilterColumnOrder(activeFilters) === getFilterColumnOrder(urlFilters)
      ) {
        setDraft({ filters, urlFiltersKey: nextUrlFiltersKey, waiting: null })
        return
      }

      // Each keystroke in a filter field would otherwise be one write to the address and, for a table the server
      // filters, one request. The field shows the draft at once; the write waits for a pause in the typing.
      if (isTyping(urlFilters, activeFilters)) {
        setDraft({ filters, urlFiltersKey: nextUrlFiltersKey, waiting: activeFilters })
        registry.get(atoms.pause).start(() => writeFilters(activeFilters), typingPause)
        return
      }
      setDraft({ filters, urlFiltersKey: nextUrlFiltersKey, waiting: null })
      writeFilters(activeFilters)
    }
  }
}

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
  const config = builtConfig ?? configFor(getConfigInputKey(columns, configProp))
  const { enableGlobalFilter, pageSizeOptions } = config
  const tableColumns = builtConfig === undefined ? columns : configuredColumns(columns, builtConfig)
  warnOfConfig(columns, configProp, builtConfig)

  // Upstream keeps this state in the URL with nuqs. Here it is the table's own atoms unless `urlState` asks for the
  // address, which goes through the app's own router and not a second state library.
  const instance = useId()
  const atoms = dataTableAtoms(instance)
  const registry = useAtomValue(atomRegistry)
  const { params } = useAtomValue(location)
  const query = useAtomValue(atoms.query)
  const filters = useAtomValue(atoms.filters)
  const draft = useAtomValue(atoms.draft)
  useAtomMount(atoms.pause)

  const state = dataTableNow({ config, urlState, params, query, filters, draft })
  const store = dataTableStore({ registry, instance, config, urlState })

  const table = useTable(
    {
      ...props,
      features: dataTableFeatures,
      columns: tableColumns,
      enableGlobalFilter,
      pageSizeOptions,
      // The table reads its initial state once, when it is made (table-core keeps the first), as upstream's
      // `useState` initializer did.
      initialState: {
        ...initialState,
        sorting: config.defaultSorting,
        pagination: { pageIndex: 0, pageSize: config.defaultPageSize },
        joinOperator: config.defaultJoinOperator
      },
      ...(isServer && pageCount !== undefined ? { pageCount } : {}),
      state: {
        pagination: state.pagination,
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        joinOperator: state.joinOperator,
        globalFilter: state.globalFilter
      },
      onPaginationChange: store.onPaginationChange,
      onSortingChange: store.onSortingChange,
      onColumnFiltersChange: store.onColumnFiltersChange,
      onJoinOperatorChange: store.onJoinOperatorChange,
      onGlobalFilterChange: store.onGlobalFilterChange,
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
  return stringify(A.dedupe(filters.map((filter) => filter.id)))
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

export { useDataTable, type UseDataTableProps }
