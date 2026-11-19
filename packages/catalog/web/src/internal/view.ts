// The pure part of applying an assistant's answer to a table: the view before, a change, the view after, and the patch
// that takes back just that change. The table's own state is read and written by `useTableView`, so the sort and filter
// menus show exactly what the assistant set: it is the same state, never a copy beside it.
import * as S from "effect/Schema"
import type { CatalogColumn, ColumnCatalog, ViewChange, ViewOperator } from "@inventory/catalog-contract/TableView"
const Sort = S.Struct({ id: S.String, desc: S.Boolean })
const FilterItem = S.Struct({
  id: S.String,
  value: S.Union([S.String, S.Array(S.String)]),
  variant: S.String,
  operator: S.String,
  filterId: S.String
})

/** A filter as the data table holds it. */
export type ViewFilter = {
  readonly id: string
  readonly value: string | ReadonlyArray<string>
  readonly variant: string
  readonly operator: string
  readonly filterId: string
}

/** The parts of a table's state the assistant may change. A column missing from `visibility` is shown. */
export type ViewState = {
  readonly sorting: ReadonlyArray<{ readonly id: string; readonly desc: boolean }>
  readonly filters: ReadonlyArray<ViewFilter>
  readonly visibility: Readonly<Record<string, boolean>>
  readonly search: string
}

/** What takes one change back: each part it holds is put back as it was before the change. */
export const Patch = S.Struct({
  sorting: Sort.pipe(S.Array, S.optionalKey),
  column: S.optionalKey(S.String),
  columnFilters: FilterItem.pipe(S.Array, S.optionalKey),
  filters: FilterItem.pipe(S.Array, S.optionalKey),
  visibility: S.optionalKey(S.Record(S.String, S.Boolean)),
  search: S.optionalKey(S.String)
})
/** The decoded value of `Patch`. */
export type Patch = typeof Patch.Type

const operatorWords: Record<ViewOperator, string> = {
  iLike: "contains",
  notILike: "does not contain",
  eq: "is",
  ne: "is not",
  inArray: "is",
  notInArray: "is not",
  lt: "is below",
  lte: "is at most",
  gt: "is above",
  gte: "is at least",
  isEmpty: "is not set",
  isNotEmpty: "is set"
}

const labelOf = (columns: ColumnCatalog, id: string) => columns.find((column) => column.id === id)?.label ?? id

const valueWords = (column: CatalogColumn | undefined, values: ReadonlyArray<string>) => {
  if (column?.type === "boolean") return values[0] === "true" ? "Yes" : "No"
  if (values.length > 1) return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`
  return values[0] ?? ""
}

/**
 * The change in the past tense, for the list of applied changes.
 *
 * @example describe(columns, { kind: "sort", column: "name", direction: "desc" }) // "Sorted by Name, Z to A"
 */
export const describe = (columns: ColumnCatalog, change: ViewChange): string => {
  switch (change.kind) {
    case "sort": {
      const column = columns.find((c) => c.id === change.column)
      const words =
        column?.type === "number"
          ? change.direction === "desc"
            ? "high to low"
            : "low to high"
          : change.direction === "desc"
            ? "Z to A"
            : "A to Z"
      return `Sorted by ${labelOf(columns, change.column)}, ${words}`
    }
    case "filter": {
      const column = columns.find((c) => c.id === change.column)
      const values =
        change.operator === "isEmpty" || change.operator === "isNotEmpty" ? "" : ` ${valueWords(column, change.values)}`
      return `Filtered: ${labelOf(columns, change.column)} ${operatorWords[change.operator]}${values}`
    }
    case "search":
      return change.text === "" ? "Stopped searching" : `Searched for “${change.text}”`
    case "hide":
      return `Hid ${labelOf(columns, change.column)}`
    case "show":
      return `Showed ${labelOf(columns, change.column)}`
    case "clear":
      return change.what === "everything"
        ? "Cleared the search, the filters, the order and the hidden columns"
        : change.what === "sorting"
          ? "Cleared the order"
          : `Cleared the ${change.what}`
  }
}

/**
 * Applies one change and returns the view after it, with the patch that takes it back. `opened` is the view as the
 * table opens, which "clear" returns to.
 */
export const applyChange = (input: {
  readonly state: ViewState
  readonly change: ViewChange
  readonly columns: ColumnCatalog
  readonly opened: ViewState
}): { readonly state: ViewState; readonly patch: Patch } => {
  const { state, change, columns, opened } = input
  switch (change.kind) {
    case "sort":
      return {
        state: { ...state, sorting: [{ id: change.column, desc: change.direction === "desc" }] },
        patch: { sorting: state.sorting }
      }
    case "filter": {
      const column = columns.find((c) => c.id === change.column)
      const value = column?.type === "select" ? change.values : (change.values[0] ?? "")
      const filter: ViewFilter = {
        id: change.column,
        value,
        variant: column?.type ?? "text",
        operator: change.operator,
        filterId: `${change.column}-0`
      }
      const others = state.filters.filter((f) => f.id !== change.column)
      return {
        state: { ...state, filters: [...others, filter] },
        patch: { column: change.column, columnFilters: state.filters.filter((f) => f.id === change.column) }
      }
    }
    case "search":
      return { state: { ...state, search: change.text }, patch: { search: state.search } }
    case "hide":
    case "show": {
      const before = state.visibility[change.column] ?? true
      return {
        state: { ...state, visibility: { ...state.visibility, [change.column]: change.kind === "show" } },
        patch: { visibility: { [change.column]: before } }
      }
    }
    case "clear": {
      const all = change.what === "everything"
      return {
        state: {
          sorting: all || change.what === "sorting" ? [] : state.sorting,
          filters: all || change.what === "filters" ? [] : state.filters,
          search: all || change.what === "search" ? "" : state.search,
          visibility: all || change.what === "columns" ? opened.visibility : state.visibility
        },
        patch: {
          ...(all || change.what === "sorting" ? { sorting: state.sorting } : {}),
          ...(all || change.what === "filters" ? { filters: state.filters } : {}),
          ...(all || change.what === "search" ? { search: state.search } : {}),
          ...(all || change.what === "columns" ? { visibility: state.visibility } : {})
        }
      }
    }
  }
}

/** Puts back what one patch holds, leaving every other part of the view as it is now. */
export const revert = (state: ViewState, patch: Patch): ViewState => ({
  sorting: patch.sorting ?? state.sorting,
  filters:
    patch.filters ??
    (patch.column === undefined
      ? state.filters
      : [...state.filters.filter((f) => f.id !== patch.column), ...(patch.columnFilters ?? [])]),
  visibility: patch.visibility === undefined ? state.visibility : { ...state.visibility, ...patch.visibility },
  search: patch.search ?? state.search
})

/** Applies changes in order, returning the view after them and one patch per change. */
export const applyAll = (input: {
  readonly state: ViewState
  readonly changes: ReadonlyArray<ViewChange>
  readonly columns: ColumnCatalog
  readonly opened: ViewState
}): { readonly state: ViewState; readonly patches: ReadonlyArray<Patch> } => {
  let state = input.state
  const patches: Array<Patch> = []
  for (const change of input.changes) {
    const next = applyChange({ state, change, columns: input.columns, opened: input.opened })
    state = next.state
    patches.push(next.patch)
  }
  return { state, patches }
}

/** Takes back several changes, the last one first, so the view ends as it was before the first. */
export const revertAll = (state: ViewState, patches: ReadonlyArray<Patch>): ViewState =>
  patches.reduceRight((view, patch) => revert(view, patch), state)

const targets = (change: ViewChange): ReadonlyArray<string> => {
  switch (change.kind) {
    case "sort":
      return ["sorting"]
    case "filter":
      return [`filter:${change.column}`]
    case "search":
      return ["search"]
    case "hide":
    case "show":
      return [`column:${change.column}`]
    case "clear":
      return change.what === "everything"
        ? ["sorting", "filter:*", "search", "column:*"]
        : change.what === "filters"
          ? ["filter:*"]
          : change.what === "columns"
            ? ["column:*"]
            : [change.what]
  }
}

const touches = (a: string, b: string) => {
  if (a === b) return true
  const [kindA, nameA] = a.split(":")
  const [kindB, nameB] = b.split(":")
  return kindA === kindB && (nameA === "*" || nameB === "*")
}

/**
 * Whether a later change set the same part of the view (the order, one column's filter, one column's visibility):
 * then the earlier change no longer shows, and taking it back must not undo the later one.
 *
 * @example overtaken({ kind: "sort", column: "name", direction: "asc" }, [{ kind: "sort", column: "sku", direction: "asc" }]) // true
 */
export const overtaken = (change: ViewChange, later: ReadonlyArray<ViewChange>): boolean =>
  later.some((next) => targets(change).some((a) => targets(next).some((b) => touches(a, b))))

/** A change as the conversation keeps it: what it was, what takes it back, and whether the person removed it. */
export type Kept = { readonly change: ViewChange; readonly patch: Patch; readonly removed: boolean }

/**
 * Takes one change back. What it replaced is put back, unless that was itself a change the person removed since:
 * then what that one replaced is put back too, so a removed change never returns.
 */
export const takeBack = (state: ViewState, kept: Kept, earlier: ReadonlyArray<Kept>): ViewState => {
  const patches: Array<Patch> = [kept.patch]
  for (const before of [...earlier].reverse()) {
    if (!overtaken(kept.change, [before.change])) continue
    if (!before.removed) break
    patches.unshift(before.patch)
  }
  return revertAll(state, patches)
}
