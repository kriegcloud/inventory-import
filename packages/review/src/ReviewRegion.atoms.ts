// One review region's atoms, made once per region by `RegionScope` from the atoms its caller gives it: the rows, the
// columns, the re-check and the decisions with their undo. What the region owns (the tab, the kind on screen, the
// folds, the search, where focus goes next) is state here; everything worked out from that and from the caller's atoms
// (the rows as they stand, the counts, the work list, the list on screen, the facets) is derived here, and so is what
// follows from the table's order (`TableScope`: the lines drawn, the stops of "Next problem"). The rule this file
// protects: nothing the region shows is kept anywhere but an atom, so two parts of it can never disagree about what
// the person decided.
//
// The table itself stays TanStack's (its sort, its hidden columns, its search). Its state is a store outside React:
// `ordered` listens to it as any atom listens to something outside, and the facets the person ticked reach it as its
// own controlled state (`tableFilters`).
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"
import { type ColumnFiltersState, createColumnHelper, type Table } from "@tanstack/react-table"
import { createAtom } from "@tanstack/store"
import * as A from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as MutableHashMap from "effect/MutableHashMap"
import * as MutableHashSet from "effect/MutableHashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { toast } from "sonner"
import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { createPlainFilter } from "@inventory/ui/components/data-table/data-table-utils"
import { contentWidth } from "@inventory/ui/ContentWidth"
import {
  Action,
  act,
  appliedGroups,
  count,
  decisionsLeft,
  entries as entriesOf,
  fixableBy,
  kindCount,
  nextKind,
  sections as sectionsOf,
  viewRows,
  visible,
  waitingGroups,
  workList
} from "@inventory/review/ReviewDraft"
import type {
  Counts,
  Entry,
  FilterId,
  FixGroup,
  Problem,
  ProblemKind,
  ReviewColumn,
  ReviewRegionProps,
  ReviewRow,
  ReviewState,
  ReviewWords,
  RowView
} from "@inventory/review/ReviewTypes"
import { reviewWords } from "@inventory/review/ReviewWords"
import { type Layout, regionLayout } from "./internal/parts.tsx"

/** 36 px rows, or 44 px with more air between them. */
export type Density = "compact" | "comfortable"

/** The caller's rule for a row whose value the person typed: what is still wrong with it, or nothing. */
export type Recheck = (input: { row: ReviewRow; cells: Readonly<Record<string, string>> }) => Problem | undefined

/** What a region is made from: the caller's atoms, and what stays the same for as long as the region is on screen. */
export interface RegionInput {
  readonly rows: Atom.Atom<ReadonlyArray<ReviewRow>>
  readonly columns: Atom.Atom<ReadonlyArray<ReviewColumn>>
  /** None when the caller has no rule to check a typed value with. */
  readonly recheck: Atom.Atom<O.Option<Recheck>>
  /** The person's decisions with their undo history: the caller's atom, which the region writes with every action. */
  readonly decisions: Atom.Writable<ReviewState>
  readonly problemKinds: ReadonlyArray<ProblemKind>
  /** Where the rules' fixes arrive in force, one the person undid or turned down stays turned down. */
  readonly rejects: boolean
  /** The caller's words over the defaults: every tab, tag and count says these. */
  readonly words: ReviewRegionProps["words"]
  /** Names the region's section on the page, so its actions find their own rows where a page has two regions. */
  readonly id: string
}

/** A place "Next problem" stops at: a row that needs the person, or a folded kind standing for its rows. */
export type Stop = { readonly rowId: string; readonly kindId?: string; readonly among?: ReadonlyArray<string> }

/** Where focus goes once the next draw is on screen: a row, a folded kind's rows, or on down the work list. */
export type Wanted = {
  readonly rowId: string | undefined
  readonly among?: { readonly ids: ReadonlyArray<string>; readonly last: boolean }
  /** The kind on screen has nothing left: go down the work list to the next kind with rows. */
  readonly advance?: boolean
  /** A new kind was just put on screen: its first row that needs the person. */
  readonly first?: boolean
  /** Frames waited for the row to come into the list. */
  readonly waited?: number
  /** After a decision: a row under a group's heading hands the focus to the heading's accept. */
  readonly toGroup?: boolean
}

/** What the region owns and draws besides the decisions: where the person is in the review. */
export type RegionUi = {
  readonly picked: FilterId | undefined
  readonly kind: string | undefined
  readonly activityOpen: boolean
  readonly whyOpen: boolean
  readonly confirmOpen: boolean
  readonly search: string
  /** Rows the person took out of their group's one action, and kinds whose rows they folded or unfolded. */
  readonly excluded: HashSet.HashSet<string>
  readonly folded: HashSet.HashSet<string>
  /** The last thing that happened, for a screen reader. */
  readonly said: string
  /** Groups the person chose to go through row by row on a phone: each of their rows is then a decision of its own. */
  readonly split: HashSet.HashSet<string>
  readonly facetPicked: Readonly<Record<string, ReadonlyArray<string>>>
  /** None until the person picks one: the browser's remembered choice stands until then. */
  readonly density: O.Option<Density>
}

/** One facet column's choices: spellings that read the same are one choice, with the rows it has in the view on screen. */
export interface Facet {
  readonly column: ReviewColumn
  readonly options: ReadonlyArray<{
    readonly key: string
    readonly label: string
    readonly values: ReadonlyArray<string>
    readonly n: number
  }>
  readonly picked: ReadonlyArray<string>
}

/** What the region opened on: the first view with something in it, and how much there was to decide. */
export interface Opened {
  readonly filter: FilterId
  readonly needs: number
  readonly decisions: number
}

/** Where focus is going: the move wanted once the list has changed, and the row "Next problem" last went to. */
export interface Nav {
  readonly wanted: O.Option<Wanted>
  readonly stepped: string | undefined
}

/** The set with `id` taken out when it was in, put in when it was not: a tick or a fold pressed again. */
const flip = (set: HashSet.HashSet<string>, id: string): HashSet.HashSet<string> =>
  HashSet.has(set, id) ? HashSet.remove(set, id) : HashSet.add(set, id)

const col = createColumnHelper<DataTableFeatures, RowView>()

/** The table's column definitions for the caller's columns: the first is the record's own and cannot be hidden. */
const defsOf = (columns: ReadonlyArray<ReviewColumn>) =>
  col.columns(
    columns.map((column, index) =>
      col.accessor((view) => view.cells[column.id] ?? "", {
        id: column.id,
        header: column.label,
        enableHiding: index !== 0,
        enableColumnFilter: column.facet === true,
        enableGlobalFilter: index === 0 || column.search === true,
        sortFn: "alphanumeric",
        // A facet column is filtered by a list of values (`multiple`): a row shows when its value is in the list.
        meta:
          column.facet === true
            ? { label: column.label, variant: "select" as const, options: [], multiple: true }
            : { label: column.label }
      })
    )
  )

/** The work list's rail beside the table (`w-44`). */
const railWidth = 176

/** Everything one region is given, owns and works out, before the table has a say. */
export interface Region {
  /** Names the region's section on the page (`data-review-region`), so focus can be put inside it. */
  readonly id: string
  readonly input: RegionInput
  readonly ui: Atom.Writable<RegionUi>
  readonly views: Atom.Atom<ReadonlyArray<RowView>>
  readonly counts: Atom.Atom<Counts>
  /** Decisions left, a split group counting row by row. */
  readonly left: Atom.Atom<number>
  readonly opened: Atom.Atom<O.Option<Opened>>
  readonly filter: Atom.Atom<FilterId>
  readonly work: Atom.Atom<ReturnType<typeof workList>>
  /** The kind the table shows under "Needs you" on a desk and a tablet; none on a phone and in every other view. */
  readonly activeKind: Atom.Atom<string | undefined>
  /** The rows of the view on screen, before the table sorts and searches them. */
  readonly list: Atom.Atom<ReadonlyArray<RowView>>
  /** `list` as the array the table holds, the same array while the list is. */
  readonly tableData: Atom.Atom<Array<RowView>>
  readonly columnDefs: Atom.Atom<ReturnType<typeof defsOf>>
  readonly hiddenAtFirst: Atom.Atom<{ readonly columnVisibility: Record<string, boolean> }>
  readonly kinds: HashMap.HashMap<string, ProblemKind>
  readonly words: ReviewWords
  readonly facets: Atom.Atom<ReadonlyArray<Facet>>
  /**
   * The table's own column filters, as TanStack holds controlled state: what `facets` has ticked, written here
   * whenever it changes (`followFacets`) and by nothing else.
   */
  readonly tableFilters: ReturnType<typeof createAtom<ColumnFiltersState>>
  /** Mounted while the region is drawn: keeps `tableFilters` at what the facets say. */
  readonly followFacets: Atom.Atom<void>
  readonly groups: Atom.Atom<ReadonlyArray<FixGroup>>
  /** The columns the problems on screen are about: they stay in the table. */
  readonly subjects: Atom.Atom<HashSet.HashSet<string>>
  /** The work list beside the table on a desk, a row of chips above it on a tablet; only while deciding. */
  readonly listMode: Atom.Atom<"rail" | "chips" | undefined>
  /** The table's room: the page's, less the card's margins and border, and the rail beside it. */
  readonly gridRoom: Atom.Atom<number>
  readonly nav: Atom.Writable<Nav>
  /** The row the table is asked to bring into view; the count makes each ask a new value. */
  readonly reveal: Atom.Writable<O.Option<{ readonly rowId: string; readonly n: number }>>
  /** True while a rule group's accept is in view: it is then the screen's one filled button and Import waits. */
  readonly leadInView: Atom.Atom<boolean>
  /** For the lead group's accept: says it is in view from when its node appears until it goes. */
  readonly markLead: (node: HTMLElement | null) => undefined | (() => void)
  /**
   * True from when the region's section appears until it goes. A region that has gone does nothing: a toast's Undo,
   * a key or a late callback that still holds its actions reaches neither the caller's decisions nor the screen.
   */
  readonly present: Atom.Atom<boolean>
  /** For the region's section: marks the region present while its node is on the page. */
  readonly attach: (node: HTMLElement | null) => undefined | (() => void)
  /** Changes what the region owns: a patch worked out from what it owns now. */
  readonly change: (update: (before: RegionUi) => Partial<RegionUi>) => void
}

/** Compact (36 px rows) or comfortable (44 px), remembered in this browser: a preference, not progress. */
const densityKey = "review-density"
export const storedDensity = (): Density => {
  try {
    return window.localStorage.getItem(densityKey) === "comfortable" ? "comfortable" : "compact"
  } catch {
    return "compact"
  }
}
/** Remembers the row height the person chose; a private window refuses, and the choice lasts for the visit. */
export const keepDensity = (next: Density): void => {
  try {
    window.localStorage.setItem(densityKey, next)
  } catch {
    // Refused: nothing to do.
  }
}

const facetsOf = (
  facetColumns: ReadonlyArray<ReviewColumn>,
  facetPicked: RegionUi["facetPicked"],
  views: ReadonlyArray<RowView>,
  list: ReadonlyArray<RowView>
): ReadonlyArray<Facet> =>
  facetColumns.map((column) => {
    // Spellings that differ only by spaces around them or by capitals ("Packaging" and "packaging") read the
    // same: one choice that holds both, named by the spelling most rows have.
    const found = MutableHashMap.empty<
      string,
      { values: MutableHashSet.MutableHashSet<string>; n: number; spellings: Record<string, number> }
    >()
    const keyOf = (value: string): string => value.trim().toLowerCase()
    for (const view of views) {
      const value = view.cells[column.id] ?? ""
      const key = keyOf(value)
      if (key === "") continue
      const entry = O.getOrElse(MutableHashMap.get(found, key), () => ({
        values: MutableHashSet.empty<string>(),
        n: 0,
        spellings: {} as Record<string, number>
      }))
      MutableHashSet.add(entry.values, value)
      entry.spellings[value.trim()] = (entry.spellings[value.trim()] ?? 0) + 1
      MutableHashMap.set(found, key, entry)
    }
    for (const view of list) {
      const entry = O.getOrUndefined(MutableHashMap.get(found, keyOf(view.cells[column.id] ?? "")))
      if (entry !== undefined) entry.n += 1
    }
    const options = [...found]
      .map(([key, entry]) => ({
        key,
        label: Object.entries(entry.spellings).sort((a, b) => b[1] - a[1])[0]?.[0] ?? key,
        values: [...entry.values],
        n: entry.n
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
    // A choice whose value is no longer in the file (the person fixed the last row that had it) is dropped.
    const picked = (facetPicked[column.id] ?? []).filter((key) => MutableHashMap.has(found, key))
    return { column, options, picked }
  })

/** Makes one region's atoms from what its caller gives it. */
const makeRegion = (input: RegionInput, registry: AtomRegistry.AtomRegistry): Region => {
  const { problemKinds, rejects } = input
  const fixable = fixableBy(problemKinds)
  const kinds = HashMap.fromIterable(problemKinds.map((entry) => [entry.id, entry] as const))
  const id = input.id

  const ui = Atom.make<RegionUi>({
    picked: undefined,
    kind: undefined,
    activityOpen: false,
    whyOpen: false,
    confirmOpen: false,
    search: "",
    excluded: HashSet.empty(),
    folded: HashSet.empty(),
    said: "",
    split: HashSet.empty(),
    facetPicked: {},
    density: O.none()
  })
  // One part of what the region owns each, so what is worked out from one is not worked out again for another.
  const picked = Atom.map(ui, (now) => now.picked)
  const kind = Atom.map(ui, (now) => now.kind)
  const split = Atom.map(ui, (now) => now.split)
  const facetPicked = Atom.map(ui, (now) => now.facetPicked)

  const views = Atom.readable((get) =>
    viewRows({
      rows: get(input.rows),
      state: get(input.decisions),
      recheck: O.getOrUndefined(get(input.recheck)),
      fixable,
      rejects
    })
  )
  const counts = Atom.map(views, count)
  const left = Atom.readable((get) => decisionsLeft(get(views), get(split)))
  // Open on what needs the person; a file with nothing to decide opens on everything. Said once, from the first
  // rows there are, and kept: the view does not jump when the last decision is taken.
  const opened: Atom.Atom<O.Option<Opened>> = Atom.readable((get) => {
    const before = O.flatten(get.self<O.Option<Opened>>())
    if (O.isSome(before)) return before
    if (get(input.rows).length === 0) return O.none()
    const now = get(counts)
    return O.some({
      filter: now.needs > 0 ? "needs" : now.blocked > 0 ? "cannot" : "all",
      needs: now.needs,
      decisions: get(left)
    })
  })
  const filter = Atom.readable((get): FilterId => get(picked) ?? O.getOrUndefined(get(opened))?.filter ?? "needs")
  // The work list: every kind that has had rows since the review opened stays on it, ticked once done.
  const seenKinds: Atom.Atom<HashSet.HashSet<string>> = Atom.readable((get) => {
    const now = get(counts)
    const before = O.getOrElse(get.self<HashSet.HashSet<string>>(), () => HashSet.empty<string>())
    const more = problemKinds.filter((entry) => kindCount(now, entry.id) > 0 && !HashSet.has(before, entry.id))
    return more.length === 0 ? before : more.reduce((seen, entry) => HashSet.add(seen, entry.id), before)
  })
  const work = Atom.readable((get) => workList({ counts: get(counts), problemKinds, seen: get(seenKinds) }))
  // On a desk and a tablet "Needs you" shows one kind at a time, the one picked on the work list (at first, the
  // first with rows left). A phone goes through every decision in turn.
  const activeKind = Atom.readable((get): string | undefined => {
    if (get(filter) !== "needs" || get(regionLayout) === "narrow") return undefined
    const list = get(work)
    const chosen = get(kind)
    return chosen !== undefined && list.some((item) => item.kind.id === chosen)
      ? chosen
      : (list.find((item) => item.left > 0)?.kind.id ?? list[0]?.kind.id)
  })
  const list = Atom.readable((get) => visible({ views: get(views), filter: get(filter), kind: get(activeKind) }))
  const tableData = Atom.map(list, (rows) => [...rows])
  const columnDefs = Atom.map(input.columns, defsOf)
  // The columns hidden until the person turns them on, as the table is first drawn; later columns do not change it.
  const hiddenAtFirst = Atom.readable((get) => ({
    columnVisibility: Object.fromEntries(
      get
        .once(input.columns)
        .filter((column) => column.hidden === true)
        .map((column) => [column.id, false])
    )
  }))
  // -- The Filter panel: for each facet column, the values the file has, as the person reads them. Two spellings
  // that differ only by spaces around them ("Serialized" and "Serialized ") read the same, so they are one choice
  // that shows both. `n` counts rows in the view that is showing (Needs you, Ready, All).
  const facetColumns = Atom.map(input.columns, (columns) => columns.filter((column) => column.facet === true))
  const facets = Atom.readable((get) => facetsOf(get(facetColumns), get(facetPicked), get(views), get(list)))
  // The table does the filtering: its column filters are the file's values behind the ticked choices.
  const facetFilters = Atom.map(facets, (now): ColumnFiltersState =>
    now.flatMap((facet) => {
      const values = facet.options
        .filter((option) => facet.picked.includes(option.key))
        .flatMap((option) => option.values)
      // The filter as the data table writes one for a list of values: a row shows when its value is in the list.
      const filter = createPlainFilter(facet.column.id, "select", values)
      return filter === null ? [] : [filter]
    })
  )
  const tableFilters = createAtom<ColumnFiltersState>([])
  const followFacets = Atom.readable((get) => {
    get.subscribe(facetFilters, (next) => tableFilters.set(next), { immediate: true })
  })
  const groups = Atom.readable((get): ReadonlyArray<FixGroup> => {
    const now = get(filter)
    return now === "auto"
      ? appliedGroups(get(views))
      : now === "needs"
        ? waitingGroups({ views: get(views), kind: get(activeKind) })
        : []
  })
  const subjects = Atom.readable((get) => {
    const now = get(filter)
    const rows = get(list)
    return HashSet.fromIterable(
      now === "needs" && get(activeKind) !== undefined
        ? rows.flatMap((view) => (view.problem?.column === undefined ? [] : [view.problem.column]))
        : now === "auto"
          ? // The fixes made for the person are what this view is about: their cells stay in the row.
            rows.flatMap((view) => Object.keys(view.marks).filter((column) => view.marks[column]?._tag === "Applied"))
          : []
    )
  })
  const listMode = Atom.readable((get): "rail" | "chips" | undefined => {
    const layout: Layout = get(regionLayout)
    // The phone's drawers (vaul) are their own chunk, fetched here, where the review turns out to be narrow, so the
    // first press opens them at once; never on a desk. Asked for again, the browser hands back the one it has.
    if (layout === "narrow") void import("./internal/PhoneDrawer.tsx")
    return layout === "narrow" || get(filter) !== "needs" || get(work).length === 0
      ? undefined
      : layout === "wide"
        ? "rail"
        : "chips"
  })
  const gridRoom = Atom.readable((get) => {
    const room = get(contentWidth)
    return room - (room < 640 ? 32 : 48) - 2 - (get(listMode) === "rail" ? railWidth : 0)
  })

  const nav = Atom.make<Nav>({ wanted: O.none(), stepped: undefined })
  const reveal = Atom.make<O.Option<{ readonly rowId: string; readonly n: number }>>(O.none())
  const leadInView = Atom.make(false)
  const markLead = (node: HTMLElement | null) => {
    if (node === null) return undefined
    registry.set(leadInView, true)
    return () => registry.set(leadInView, false)
  }
  const present = Atom.make(false)
  const attach = (node: HTMLElement | null) => {
    if (node === null) return undefined
    registry.set(present, true)
    return () => registry.set(present, false)
  }

  return {
    id,
    input,
    ui,
    views,
    counts,
    left,
    opened,
    filter,
    work,
    activeKind,
    list,
    tableData,
    columnDefs,
    hiddenAtFirst,
    kinds,
    words: reviewWords(input.words),
    facets,
    tableFilters,
    followFacets,
    groups,
    subjects,
    listMode,
    gridRoom,
    nav,
    reveal,
    leadInView,
    markLead,
    present,
    attach,
    // A change that changes nothing is no change: the region is not drawn again for it.
    change: (update) =>
      registry.update(ui, (before) => {
        const patch = update(before)
        const now: Readonly<Record<string, unknown>> = before
        const same = A.every(R.toEntries<string, unknown>(patch), ([key, value]) => Object.is(now[key], value))
        return same ? before : { ...before, ...patch }
      })
  }
}

/**
 * One region's atoms, made when the region is first drawn and let go with it: its parts (the table, the phone's
 * queue) read the same atoms from here, not from props handed down.
 */
export const RegionScope = ScopedAtom.make((input: RegionInput) =>
  Atom.readable((get) => makeRegion(input, get.registry))
)

// ---------------------------------------------------------------------------------------------------------------
// With the table: its order as an atom, the lines drawn, the stops of "Next problem", and the person's actions
// ---------------------------------------------------------------------------------------------------------------

/** What a row can ask the region to do. The same functions for the life of the region, so rows keep their memo. */
export type RowActions = {
  accept: (rowId: string) => void
  keep: (rowId: string) => void
  leaveOut: (rowId: string) => void
  putBack: (rowId: string) => void
  edit: (rowId: string, column: string, value: string) => void
  /** Takes a fix that is in force on one cell out again ("Undo this fix"). */
  undoFix: (rowId: string, column: string) => void
  /** Turns a proposal down: the file's value stands and the row waits. Absent where a turned-down fix is offered again. */
  reject?: (rowId: string, column: string) => void
  /** The row as it stands now, for comparing two rows that cannot both be imported. */
  peek: (rowId: string) => RowView | undefined
}

/** What a group heading can ask for. Each is one undo step. */
export type GroupActions = {
  accept: (groupId: string) => void
  choose: (groupId: string, value: string) => void
  /** Take a row out of its group's action, or put it back. */
  toggle: (rowId: string) => void
  /** Take the rules' lossless fixes for these rows in one step. */
  acceptRows: (rowIds: ReadonlyArray<string>) => void
  /** Show or hide the rows under a problem kind's heading. */
  fold: (kindId: string) => void
  leaveOut: (rowIds: ReadonlyArray<string>) => void
  revert: (groupId: string) => void
}

/** The region's table: what follows from the order it shows the rows in, and what the person can do there. */
export interface RegionTable {
  /** The rows in the order the table shows them: sorted, searched and filtered by the table itself. */
  readonly ordered: Atom.Atom<ReadonlyArray<RowView>>
  /** The table's hidden and shown columns: `false` is off, `true` is one the person turned on, absent is untouched. */
  readonly visibility: Atom.Atom<Readonly<Record<string, boolean>>>
  /**
   * The lines the table draws. "Needs you" shows the kind picked on the work list: its heading (what its rows need,
   * and its bulk answers), each group of identical fixes above its rows, then the rows settled one at a time.
   */
  readonly lines: Atom.Atom<ReadonlyArray<Entry>>
  /**
   * The rows that need the person in the order the table shows them, sections and all. A folded kind is one stop: its
   * rows are not drawn, and once it is opened they come in the table's order (groups first), which is not the order
   * the kind lists them in. So the stop carries the kind to unfold and its rows to choose among.
   */
  readonly stops: Atom.Atom<ReadonlyArray<Stop>>
  /** A new value whenever a move may have to be settled: the lines changed, or a move was asked for. */
  readonly moves: Atom.Atom<number>
  /** For `moves`: settles the wanted move once the change is on screen. */
  readonly settleSoon: () => void
  readonly run: (action: Action, from?: string) => void
  readonly step: (back: boolean) => void
  readonly actions: RowActions
  /** Where the rules' fixes are proposals there is nothing in force to turn down: the rows offer no "Reject". */
  readonly plainActions: RowActions
  readonly groupActions: GroupActions
  /** The undo, redo and stepping keys, heard on the page while this is mounted. */
  readonly keys: Atom.Atom<void>
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest("[role=dialog], [role=alertdialog], [role=menu]") !== null)

/** Makes what a region has once its table exists. */
const makeRegionTable = (
  input: { readonly region: Region; readonly table: Table<DataTableFeatures, RowView> },
  registry: AtomRegistry.AtomRegistry
): RegionTable => {
  const { region, table } = input
  const { problemKinds, rejects } = region.input
  const fixable = fixableBy(problemKinds)
  const folded = Atom.map(region.ui, (now) => now.folded)

  // The table's sort, search and column filters are its own store's: a new value here whenever one of them changes.
  const sorted = Atom.readable((get) => {
    const again = () => get.setSelf(O.getOrElse(get.self<number>(), () => 0) + 1)
    for (const slice of [table.atoms.sorting, table.atoms.globalFilter, table.atoms.columnFilters]) {
      const subscription = slice.subscribe(again)
      get.addFinalizer(() => subscription.unsubscribe())
    }
    return 0
  })
  const ordered = Atom.readable((get): ReadonlyArray<RowView> => {
    const data = get(region.tableData)
    get(sorted)
    // The table is given the same rows when the region is drawn. It is given them here first, so the order read now
    // is of these rows and not of the ones it was last drawn with.
    table.setOptions((before) => (before.data === data ? before : { ...before, data }))
    return table.getPrePaginatedRowModel().rows.map((row) => row.original)
  })
  const visibility = Atom.readable((get): Readonly<Record<string, boolean>> => {
    const subscription = table.atoms.columnVisibility.subscribe((next) => get.setSelf(next))
    get.addFinalizer(() => subscription.unsubscribe())
    return table.atoms.columnVisibility.get()
  })
  const lines = Atom.readable((get): ReadonlyArray<Entry> => {
    const filter = get(region.filter)
    const active = get(region.activeKind)
    const closed = get(folded)
    return filter === "needs"
      ? sectionsOf({
          list: get(ordered),
          groups: get(region.groups),
          problemKinds: problemKinds.filter((entry) => active === undefined || entry.id === active),
          collapsed: (entry) => HashSet.has(closed, entry.id)
        })
      : entriesOf({ list: get(ordered), groups: get(region.groups), applied: filter === "auto" })
  })
  const stops = Atom.map(lines, (now): ReadonlyArray<Stop> => {
    const found: Array<Stop> = []
    for (const entry of now) {
      if (entry._tag === "Row") {
        if (entry.view.status === "needs") found.push({ rowId: entry.view.row.id })
      } else if (entry._tag === "Kind" && entry.collapsed) {
        const first = entry.rowIds[0]
        if (first !== undefined) found.push({ rowId: first, kindId: entry.kind.id, among: entry.rowIds })
      }
    }
    return found
  })
  const moves = Atom.readable((get) => {
    get(lines)
    get(region.nav)
    // Held here so the region's presence is kept for as long as its moves are followed.
    get(region.present)
    return O.getOrElse(get.self<number>(), () => 0) + 1
  })

  const want = (wanted: O.Option<Wanted>) => registry.update(region.nav, (before) => ({ ...before, wanted }))
  const section = (): HTMLElement | null => document.querySelector<HTMLElement>(`[data-review-region="${region.id}"]`)

  // With nothing left to go to, focus goes to the one action that is left: the import button, or, where the region
  // has none (embedded, or only looking), the table itself. Never to the page's body, from where the person had to
  // press Shift+Tab ninety-nine times to get back.
  const focusLast = () => {
    const root = section()
    const button = root?.querySelector<HTMLElement>("[data-import-button]") ?? null
    if (button !== null && button.checkVisibility()) button.focus()
    else root?.querySelector<HTMLElement>('[data-slot="sticky-table-frame"]')?.focus()
  }
  const focusRow = (rowId: string | undefined, toGroup = false) => {
    if (rowId === undefined || !registry.get(ordered).some((view) => view.row.id === rowId)) {
      focusLast()
      return
    }
    registry.update(region.reveal, (before) =>
      O.some({ rowId, n: O.match(before, { onNone: () => 1, onSome: (asked) => asked.n + 1 }) })
    )
    requestAnimationFrame(() => {
      const root = section()
      const row = root?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(rowId)}"]`)
      // A row under a group's heading is decided by the heading: its accept takes the focus, not the row's tick.
      const group = toGroup ? row?.dataset.group : undefined
      const target =
        (group === undefined
          ? undefined
          : root?.querySelector<HTMLElement>(`[data-group-id="${CSS.escape(group)}"] [data-group-accept]`)) ??
        row?.querySelector<HTMLElement>("[data-first-action]")
      if (target === null || target === undefined) focusLast()
      else target.focus()
    })
  }

  const onPage = (): boolean => registry.get(region.present)

  const run = (action: Action, from?: string) => {
    if (!onPage()) return
    const outcome = act({
      rows: registry.get(region.input.rows),
      state: registry.get(region.input.decisions),
      action,
      recheck: O.getOrUndefined(registry.get(region.input.recheck)),
      fixable,
      rejects
    })
    if (outcome.label === "") return
    const narrow = registry.get(regionLayout) === "narrow"
    let unfold: string | undefined
    // On a phone the queue moves focus to the card that takes the decided one's place.
    let move: O.Option<Wanted> = O.none()
    if (narrow) move = O.none()
    else if (Action.$is("Undo")(action) || Action.$is("Redo")(action))
      move = O.some({ rowId: O.getOrUndefined(outcome.focus) })
    else {
      // The next place on screen that still needs a decision after this one, in the order the table shows them
      // (a folded kind is opened to reach its rows); failing that, the row itself when it still needs one.
      const changed = MutableHashSet.fromIterable(outcome.changed)
      const origin = from ?? outcome.changed[0]
      const places = registry.get(stops)
      const at = places.findIndex((stop) => stop.rowId === origin || stop.among?.includes(origin ?? "") === true)
      const ahead = [...places.slice(at + 1), ...places.slice(0, Math.max(0, at))]
      const next = ahead.find((stop) =>
        (stop.among ?? [stop.rowId]).some((rowId) => !MutableHashSet.has(changed, rowId))
      )
      const stays = from !== undefined && !MutableHashSet.has(changed, from) ? from : undefined
      if (next?.kindId !== undefined) {
        const ids = (next.among ?? [next.rowId]).filter((rowId) => !MutableHashSet.has(changed, rowId))
        move = O.some({ rowId: ids[0], among: { ids, last: false } })
        unfold = next.kindId
      } else if (next === undefined && stays === undefined && registry.get(region.activeKind) !== undefined) {
        // The kind on screen is done: on to the next one on the work list.
        move = O.some({ rowId: undefined, advance: true })
      } else move = O.some({ rowId: next?.rowId ?? stays, toGroup: true })
    }
    Atom.batch(() => {
      want(move)
      region.change((before) => ({
        said: outcome.label,
        ...(unfold === undefined ? {} : { folded: flip(before.folded, unfold) })
      }))
      // The caller's atom: whoever keeps the decisions (a server draft, the browser) follows it.
      registry.set(region.input.decisions, outcome.state)
    })
    // A step that settled several rows at once can be taken back from where the eye is: a toast with Undo. It takes
    // back that step only, and only while it is still the last one.
    const bulk = !Action.$is("Undo")(action) && !Action.$is("Redo")(action) && outcome.changed.length > 1
    const step = outcome.state.undo[outcome.state.undo.length - 1]
    if (bulk && step !== undefined && !narrow) {
      toast(outcome.label, {
        action: {
          label: "Undo",
          onClick: () => {
            const undo = registry.get(region.input.decisions).undo
            if (undo[undo.length - 1] === step) run(Action.Undo())
          }
        }
      })
    }
  }

  const step = (back: boolean) => {
    if (!onPage()) return
    const active = document.activeElement
    const focused =
      active instanceof HTMLElement ? active.closest<HTMLElement>("[data-row-id]")?.dataset.rowId : undefined
    // In the order on screen, from the row that has focus or, after a click on "Next problem" (which took the
    // focus), from the row the last step went to. Stepping by row number skipped every section drawn above.
    const places = registry.get(stops)
    const here = focused ?? registry.get(region.nav).stepped
    const at = here === undefined ? -1 : places.findIndex((entry) => entry.rowId === here)
    const next = back ? (at === -1 ? places[places.length - 1] : (places[at - 1] ?? places[at])) : places[at + 1]
    if (next === undefined) {
      // Past the last row of the kind on screen: down the work list to the next kind with rows left.
      if (!back && registry.get(region.activeKind) !== undefined) want(O.some({ rowId: undefined, advance: true }))
      else if (places[at] !== undefined) focusRow(places[at].rowId)
      return
    }
    if (next.kindId === undefined) {
      registry.update(region.nav, (before) => ({ ...before, stepped: next.rowId }))
      focusRow(next.rowId)
      return
    }
    // The row is under a folded heading: open it, and take the focus there once it is drawn.
    const kindId = next.kindId
    Atom.batch(() => {
      registry.set(region.nav, {
        stepped: next.rowId,
        wanted: O.some({ rowId: next.rowId, among: { ids: next.among ?? [next.rowId], last: back } })
      })
      region.change((before) => ({ folded: flip(before.folded, kindId) }))
    })
  }

  // After a decision focus goes to the next row that needs one; after an undo, back to the row.
  const settle = () => {
    const wanted = registry.get(region.nav).wanted
    if (O.isNone(wanted) || !onPage()) return
    const move = wanted.value
    const places = registry.get(stops)
    if (move.advance === true) {
      // "Next problem" goes down the work list: the next kind with rows left, its first row once it is drawn.
      const from = registry.get(region.activeKind)
      const next = nextKind({ list: registry.get(region.work), from })
      if (next === undefined || next === from) {
        want(O.none())
        focusRow(places[0]?.rowId)
        return
      }
      Atom.batch(() => {
        want(O.some({ rowId: undefined, first: true }))
        region.change(() => ({ kind: next }))
      })
      return
    }
    if (move.first === true) {
      const first = places[0]?.rowId
      registry.set(region.nav, { wanted: O.none(), stepped: first })
      focusRow(first, true)
      return
    }
    if (move.among === undefined) {
      // A caller whose rows follow the decisions a little later: after an undo the row may not be in the list yet.
      // Wait for two frames before falling back.
      const waited = move.waited ?? 0
      const rowId = move.rowId
      if (rowId !== undefined && waited < 2 && !registry.get(ordered).some((view) => view.row.id === rowId)) {
        want(O.some({ ...move, waited: waited + 1 }))
        return
      }
      want(O.none())
      focusRow(rowId, move.toGroup === true)
      return
    }
    // A kind was just unfolded to step into it: its first row as drawn (its last, stepping backwards).
    const among = move.among
    const drawn = places.filter((stop) => stop.kindId === undefined && among.ids.includes(stop.rowId))
    const target = (among.last ? drawn[drawn.length - 1] : drawn[0])?.rowId ?? move.rowId
    registry.set(region.nav, { wanted: O.none(), stepped: target })
    focusRow(target)
  }
  // The atoms change before the rows are drawn: the move is settled a frame later, when they are on screen.
  const settleSoon = () => {
    if (O.isSome(registry.get(region.nav).wanted)) requestAnimationFrame(settle)
  }

  const excluded = () => [...registry.get(region.ui).excluded]
  const actions: RowActions = {
    accept: (rowId) => run(Action.Accept({ rowIds: [rowId] }), rowId),
    keep: (rowId) => run(Action.Keep({ rowId }), rowId),
    leaveOut: (rowId) => run(Action.LeaveOut({ rowIds: [rowId] }), rowId),
    putBack: (rowId) => run(Action.PutBack({ rowId }), rowId),
    edit: (rowId, column, value) => run(Action.Edit({ rowId, column, value }), rowId),
    undoFix: (rowId, column) => run(Action.Revert({ rowId, column, how: "undo" }), rowId),
    reject: (rowId, column) => run(Action.Revert({ rowId, column, how: "reject" }), rowId),
    peek: (rowId) => registry.get(region.views).find((view) => view.row.id === rowId)
  }
  const groupActions: GroupActions = {
    accept: (groupId) => run(Action.AcceptGroup({ groupId, except: excluded() })),
    choose: (groupId, value) => run(Action.ChooseGroup({ groupId, value, except: excluded() })),
    leaveOut: (rowIds) => run(Action.LeaveOut({ rowIds })),
    revert: (groupId) => run(Action.RevertGroup({ groupId })),
    acceptRows: (rowIds) => run(Action.Accept({ rowIds })),
    toggle: (rowId) => {
      if (onPage()) region.change((before) => ({ excluded: flip(before.excluded, rowId) }))
    },
    fold: (kindId) => {
      if (onPage()) region.change((before) => ({ folded: flip(before.folded, kindId) }))
    }
  }
  const { reject: _reject, ...plainActions } = actions

  // Let go the moment nothing mounts it: a region that has gone must not hear a key meant for the one after it.
  const keys = Atom.setIdleTTL(
    Atom.readable((get) => {
      const onKey = (event: KeyboardEvent) => {
        // Inside a text field the browser's own undo applies.
        if (!onPage() || event.defaultPrevented || isTyping(event.target)) return
        const key = event.key.toLowerCase()
        if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "z") {
          event.preventDefault()
          run(event.shiftKey ? Action.Redo() : Action.Undo())
          return
        }
        if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && key === "y") {
          event.preventDefault()
          run(Action.Redo())
          return
        }
        if (event.ctrlKey || event.metaKey || event.altKey || registry.get(regionLayout) === "narrow") return
        if (event.key === "j" || event.key === "J") step(false)
        else if (event.key === "k" || event.key === "K") step(true)
      }
      document.addEventListener("keydown", onKey)
      get.addFinalizer(() => document.removeEventListener("keydown", onKey))
    }),
    0
  )

  return {
    ordered,
    visibility,
    lines,
    stops,
    moves,
    settleSoon,
    run,
    step,
    actions,
    plainActions,
    groupActions,
    keys
  }
}

/** What a region has once its table exists, made once from the table the region was first drawn with. */
export const TableScope = ScopedAtom.make(
  (input: { readonly region: Region; readonly table: Table<DataTableFeatures, RowView> }) =>
    Atom.readable((get) => makeRegionTable(input, get.registry))
)
