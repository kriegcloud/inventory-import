// The pure part of applying an assistant's answer to a table: the view before, a change, the view after, and the patch
// that takes back just that change. The table's own state is read and written by `useTableView`, so the sort and filter
// menus show exactly what the assistant set: it is the same state, never a copy beside it.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { ViewChange } from "@inventory/catalog-contract/TableView"
import type { CatalogColumn, ColumnCatalog, ViewOperator } from "@inventory/catalog-contract/TableView"
const Sort = S.Struct({ id: S.String, desc: S.Boolean })
const FilterItem = S.Struct({
  id: S.String,
  value: S.Union([S.String, S.Array(S.String)]).pipe(S.withConstructorDefault(Effect.succeed(""))),
  variant: S.String.pipe(S.withConstructorDefault(Effect.succeed("text"))),
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
  sorting: Sort.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  column: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  columnFilters: FilterItem.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  filters: FilterItem.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  visibility: S.Record(S.String, S.Boolean).pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  search: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone))
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

const labelOf = (columns: ColumnCatalog, id: string) =>
  O.match(
    A.findFirst(columns, (column) => column.id === id),
    { onNone: () => id, onSome: (column) => column.label }
  )

const valueWords = (column: O.Option<CatalogColumn>, values: ReadonlyArray<string>): O.Option<string> => {
  if (O.exists(column, (column) => column.type === "boolean")) return O.some(values[0] === "true" ? "Yes" : "No")
  if (values.length > 1) return O.some(`${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`)
  return A.head(values)
}

/**
 * The change in the past tense, for the list of applied changes.
 *
 * @example describe(columns, { kind: "sort", column: "name", direction: "desc" }) // "Sorted by Name, Z to A"
 */
export const describe = (columns: ColumnCatalog, change: ViewChange): string =>
  ViewChange.match(change, {
    sort: (change) => {
      const column = A.findFirst(columns, (c) => c.id === change.column)
      const words = O.exists(column, (column) => column.type === "number")
        ? change.direction === "desc"
          ? "high to low"
          : "low to high"
        : change.direction === "desc"
          ? "Z to A"
          : "A to Z"
      return `Sorted by ${labelOf(columns, change.column)}, ${words}`
    },
    filter: (change) => {
      const column = A.findFirst(columns, (c) => c.id === change.column)
      const leading = `Filtered: ${labelOf(columns, change.column)} ${operatorWords[change.operator]}`
      if (change.operator === "isEmpty" || change.operator === "isNotEmpty") return leading
      return O.match(valueWords(column, change.values), {
        onNone: () => `${leading} `,
        onSome: (values) => `${leading} ${values}`
      })
    },
    search: (change) => (change.text === "" ? "Stopped searching" : `Searched for “${change.text}”`),
    hide: (change) => `Hid ${labelOf(columns, change.column)}`,
    show: (change) => `Showed ${labelOf(columns, change.column)}`,
    clear: (change) =>
      change.what === "everything"
        ? "Cleared the search, the filters, the order and the hidden columns"
        : change.what === "sorting"
          ? "Cleared the order"
          : `Cleared the ${change.what}`
  })

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
  const { state, columns, opened } = input
  // Hiding and showing a column are one change to its visibility: the patch remembers how it stood.
  const visible = (column: string, shown: boolean): { readonly state: ViewState; readonly patch: Patch } => ({
    state: { ...state, visibility: { ...state.visibility, [column]: shown } },
    patch: Patch.make({
      visibility: O.some({
        [column]: O.match(O.fromUndefinedOr(state.visibility[column]), { onNone: () => true, onSome: (shown) => shown })
      })
    })
  })
  return ViewChange.match(input.change, {
    sort: (change) => ({
      state: { ...state, sorting: [{ id: change.column, desc: change.direction === "desc" }] },
      patch: Patch.make({ sorting: O.some(state.sorting) })
    }),
    filter: (change) => {
      const column = A.findFirst(columns, (c) => c.id === change.column)
      const initial = FilterItem.make({ id: change.column, operator: change.operator, filterId: `${change.column}-0` })
      const typed = O.match(column, {
        onNone: () => initial,
        onSome: (column) => FilterItem.make({ ...initial, variant: column.type })
      })
      const filter = O.exists(column, (column) => column.type === "select")
        ? FilterItem.make({ ...typed, value: change.values })
        : O.match(A.head(change.values), {
            onNone: () => typed,
            onSome: (value) => FilterItem.make({ ...typed, value })
          })
      const others = A.filter(state.filters, (f) => f.id !== change.column)
      return {
        state: { ...state, filters: [...others, filter] },
        patch: Patch.make({
          column: O.some(change.column),
          columnFilters: O.some(A.filter(state.filters, (f) => f.id === change.column))
        })
      }
    },
    search: (change) => ({
      state: { ...state, search: change.text },
      patch: Patch.make({ search: O.some(state.search) })
    }),
    hide: (change) => visible(change.column, false),
    show: (change) => visible(change.column, true),
    clear: (change) => {
      const all = change.what === "everything"
      return {
        state: {
          sorting: all || change.what === "sorting" ? [] : state.sorting,
          filters: all || change.what === "filters" ? [] : state.filters,
          search: all || change.what === "search" ? "" : state.search,
          visibility: all || change.what === "columns" ? opened.visibility : state.visibility
        },
        patch: Patch.make({
          sorting: O.liftPredicate(state.sorting, () => all || change.what === "sorting"),
          filters: O.liftPredicate(state.filters, () => all || change.what === "filters"),
          search: O.liftPredicate(state.search, () => all || change.what === "search"),
          visibility: O.liftPredicate(state.visibility, () => all || change.what === "columns")
        })
      }
    }
  })
}

/** Puts back what one patch holds, leaving every other part of the view as it is now. */
export const revert = (state: ViewState, patch: Patch): ViewState => ({
  sorting: O.match(patch.sorting, { onNone: () => state.sorting, onSome: (sorting) => sorting }),
  filters: O.match(patch.filters, {
    onSome: (filters) => filters,
    onNone: () =>
      O.match(patch.column, {
        onNone: () => state.filters,
        onSome: (column) => [
          ...A.filter(state.filters, (f) => f.id !== column),
          ...O.match(patch.columnFilters, { onNone: A.empty, onSome: (filters) => filters })
        ]
      })
  }),
  visibility: O.match(patch.visibility, {
    onNone: () => state.visibility,
    onSome: (visibility) => ({ ...state.visibility, ...visibility })
  }),
  search: O.match(patch.search, { onNone: () => state.search, onSome: (search) => search })
})

/** Applies changes in order, returning the view after them and one patch per change. */
export const applyAll = (input: {
  readonly state: ViewState
  readonly changes: ReadonlyArray<ViewChange>
  readonly columns: ColumnCatalog
  readonly opened: ViewState
}): {
  readonly state: ViewState
  readonly patches: ReadonlyArray<Patch>
  readonly applied: ReadonlyArray<{ readonly change: ViewChange; readonly patch: Patch }>
} => {
  let state = input.state
  const patches: Array<Patch> = []
  const applied: Array<{ readonly change: ViewChange; readonly patch: Patch }> = []
  for (const change of input.changes) {
    const next = applyChange({ state, change, columns: input.columns, opened: input.opened })
    state = next.state
    patches.push(next.patch)
    applied.push({ change, patch: next.patch })
  }
  return { state, patches, applied }
}

/** Takes back several changes, the last one first, so the view ends as it was before the first. */
export const revertAll = (state: ViewState, patches: ReadonlyArray<Patch>): ViewState =>
  A.reduceRight(patches, state, (view, patch) => revert(view, patch))

const targets: (change: ViewChange) => ReadonlyArray<string> = ViewChange.match({
  sort: () => ["sorting"],
  filter: (change) => [`filter:${change.column}`],
  search: () => ["search"],
  hide: (change) => [`column:${change.column}`],
  show: (change) => [`column:${change.column}`],
  clear: (change) =>
    change.what === "everything"
      ? ["sorting", "filter:*", "search", "column:*"]
      : change.what === "filters"
        ? ["filter:*"]
        : change.what === "columns"
          ? ["column:*"]
          : [change.what]
})

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
  A.some(later, (next) => A.some(targets(change), (a) => A.some(targets(next), (b) => touches(a, b))))

/** A change as the conversation keeps it: what it was, what takes it back, and whether the person removed it. */
export type Kept = { readonly change: ViewChange; readonly patch: Patch; readonly removed: boolean }

/**
 * Takes one change back. What it replaced is put back, unless that was itself a change the person removed since:
 * then what that one replaced is put back too, so a removed change never returns.
 */
export const takeBack = (state: ViewState, kept: Kept, earlier: ReadonlyArray<Kept>): ViewState => {
  const patches: Array<Patch> = [kept.patch]
  for (const before of A.reverse(earlier)) {
    if (!overtaken(kept.change, [before.change])) continue
    if (!before.removed) break
    patches.unshift(before.patch)
  }
  return revertAll(state, patches)
}
