// One review region's atoms, made once per region by `RegionScope` from the atoms its caller gives it: the rows, the
// columns, the re-check and the decisions with their undo. What the region owns (the tab, the kind on screen, the
// folds, the search, where focus goes next) is state here; everything worked out from that and from the caller's atoms
// (the rows as they stand, the counts, the work list, the list on screen, the facets) is derived here, and so is what
// follows from the table's order (`TableScope`: the lines drawn, the stops of "Next problem"). The rule this file
// protects: nothing the region shows is kept anywhere but an atom, so two parts of it can never disagree about what
// the person decided.
//
// The table itself stays TanStack's, for its sort, its hidden columns and its search only. Its state is a store
// outside React: `ordered` listens to it as any atom listens to something outside. The facets the person ticked are
// not the table's: they filter the rows here, in a derived atom, before the table is given them (Benjamin, 2026-11-19:
// "Effect atoms only"), so no state library but atoms holds anything of the region's.
import { query, closest, data, refCallback } from "./internal/browser.ts"
import { CellMark, Entry } from "@inventory/review/ReviewTypes"
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"
import { createColumnHelper, type Table } from "@tanstack/react-table"
import { table_setOptions } from "@tanstack/react-table/static-functions"
import * as A from "effect/Array"
import * as Data from "effect/Data"
import { identity } from "effect/Function"
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
import { contentWidth } from "@inventory/ui/ContentWidth"
import { stringify } from "@inventory/ui/Json"
import {
  Action,
  act,
  appliedGroups,
  count,
  decisionsLeft,
  entries as entriesOf,
  fixableBy,
  heldCsv,
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
  FilterId,
  FixGroup,
  Problem,
  ProblemKind,
  ReviewColumn,
  ReviewRow,
  ReviewState,
  ReviewWords,
  RowView
} from "@inventory/review/ReviewTypes"
import type { RowAction } from "@inventory/review/ReviewTypes"
import { reviewWords } from "@inventory/review/ReviewWords"
import { Density, density } from "./Density.atoms.ts"
import { type Layout, regionLayout } from "./internal/parts.tsx"

// Each enum's own guard, made once: these run for every row and every cell.
const isCellMarkApplied = CellMark.guards.applied
const isActionUndo = Action.guards.undo
const isActionRedo = Action.guards.redo

/** The caller's rule for a row whose value the person typed: what is still wrong with it, or nothing. */
export type Recheck = (input: { row: ReviewRow; cells: Readonly<Record<string, string>> }) => O.Option<Problem>

/** The caller's own answer on a row that needs the person, or nothing for a row it does not fit. */
export type RowActionFor = (row: ReviewRow) => O.Option<RowAction>

/**
 * What a region is made from: the caller's atoms. Everything the region's atoms work from is one of these, so
 * nothing the caller says is taken once and kept; only the section's name stays the same.
 */
export interface RegionInput {
  readonly rows: Atom.Atom<ReadonlyArray<ReviewRow>>
  readonly columns: Atom.Atom<ReadonlyArray<ReviewColumn>>
  /** None when the caller has no rule to check a typed value with. */
  readonly recheck: Atom.Atom<O.Option<Recheck>>
  /** The person's decisions with their undo history: the caller's atom, which the region writes with every action. */
  readonly decisions: Atom.Writable<ReviewState>
  readonly problemKinds: Atom.Atom<ReadonlyArray<ProblemKind>>
  /** "apply" where the rules' fixes arrive in force: one the person undid or turned down stays turned down. */
  readonly ruleFixes: Atom.Atom<"propose" | "apply">
  /** The caller's words over the defaults: every tab, tag and count says these. */
  readonly words: Atom.Atom<Partial<ReviewWords>>
  /** The caller's own answer per row; none where there is no such answer. */
  readonly rowAction: Atom.Atom<O.Option<RowActionFor>>
  /** True while the person may look but not decide. */
  readonly readOnly: Atom.Atom<boolean>
  /** Names the region's section on the page, so its actions find their own rows where a page has two regions. */
  readonly id: string
}

/** A place "Next problem" stops at: a row that needs the person, or a folded kind standing for its rows. */
export type Stop = Data.TaggedEnum<{
  Row: { readonly rowId: string }
  /** The kind to unfold, its first row, and its rows to choose among once they are drawn. */
  Folded: { readonly rowId: string; readonly kindId: string; readonly among: ReadonlyArray<string> }
}>
export const Stop = Data.taggedEnum<Stop>()
const isStopRow = Stop.$is("Row")

/** Where focus goes once the next draw is on screen. */
export type Wanted = Data.TaggedEnum<{
  /**
   * A row (none: the one action left on the screen). `toGroup`: after a decision, a row under a group's heading hands
   * the focus to the heading's accept. `waited`: frames waited for the row to come into the list.
   */
  Row: { readonly rowId: O.Option<string>; readonly toGroup: boolean; readonly waited: number }
  /** A kind was just unfolded to step into it: its first row as drawn among these (its last, stepping backwards). */
  Among: { readonly rowId: O.Option<string>; readonly ids: ReadonlyArray<string>; readonly last: boolean }
  /** The kind that was on screen has nothing left: on down the work list from it, to the next kind with rows. */
  Advance: { readonly from: O.Option<string> }
  /** A new kind was just put on screen: its first row that needs the person. */
  First: {}
}>
export const Wanted = Data.taggedEnum<Wanted>()

/** What the region owns and draws besides the decisions: where the person is in the review. */
export type RegionUi = {
  readonly picked: O.Option<FilterId>
  readonly kind: O.Option<string>
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
  /** The row height: the browser's remembered choice, read once when the region is made, then what the person picks. */
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
  readonly stepped: O.Option<string>
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
        // A facet is not the table's filter: the region filters the rows before the table has them (`shown`).
        enableColumnFilter: false,
        enableGlobalFilter: index === 0 || column.search === true,
        sortFn: "alphanumeric",
        meta: { label: column.label }
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
  readonly activeKind: Atom.Atom<O.Option<string>>
  /** The rows of the view on screen, before the table sorts and searches them. */
  readonly list: Atom.Atom<ReadonlyArray<RowView>>
  /** `list` with the facets the person ticked applied: a row shows when each ticked facet lists its value. */
  readonly shown: Atom.Atom<ReadonlyArray<RowView>>
  /** `shown` as the array the table holds, the same array while the rows shown are. */
  readonly tableData: Atom.Atom<Array<RowView>>
  readonly columnDefs: Atom.Atom<ReturnType<typeof defsOf>>
  readonly hiddenAtFirst: Atom.Atom<{ readonly columnVisibility: Record<string, boolean> }>
  readonly kinds: Atom.Atom<HashMap.HashMap<string, ProblemKind>>
  readonly words: Atom.Atom<ReviewWords>
  /** Whether a kind can be settled on this screen: one test for the region and its table, made once per kinds. */
  readonly fixable: Atom.Atom<ReturnType<typeof fixableBy>>
  /** True where the rules' fixes arrive in force, so a row offers "Reject". */
  readonly rejects: Atom.Atom<boolean>
  readonly facets: Atom.Atom<ReadonlyArray<Facet>>
  readonly groups: Atom.Atom<ReadonlyArray<FixGroup>>
  /** The columns the problems on screen are about: they stay in the table. */
  readonly subjects: Atom.Atom<HashSet.HashSet<string>>
  /** The work list beside the table on a desk, a row of chips above it on a tablet; only while deciding. */
  readonly listMode: Atom.Atom<O.Option<"rail" | "chips">>
  /** The table's room: the page's, less the card's margins and border, and the rail beside it. */
  readonly gridRoom: Atom.Atom<number>
  readonly nav: Atom.Writable<Nav>
  /** The row the table is asked to bring into view; the count makes each ask a new value. */
  readonly reveal: Atom.Writable<O.Option<{ readonly rowId: string; readonly n: number }>>
  /**
   * True from when the region's section appears until it goes. A region that has gone does nothing: a toast's Undo,
   * a key or a late callback that still holds its actions reaches neither the caller's decisions nor the screen.
   */
  readonly present: Atom.Atom<boolean>
  /** The toasts the region has put up for a bulk step, each with an Undo: they go when the region goes. */
  readonly toasts: Atom.Writable<ReadonlyArray<string | number>>
  /** For the region's section: marks the region present while its node is on the page. */
  readonly attach: (node: HTMLElement | null) => undefined | (() => void)
  /** Changes what the region owns: a patch worked out from what it owns now. */
  readonly change: (update: (before: RegionUi) => Partial<RegionUi>) => void
  /** The rows that will not be imported, as a CSV with a reason on each line: built when it is asked for. */
  readonly notImported: () => string
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
      const spelling = value.trim()
      entry.spellings[spelling] = (entry.spellings[spelling] ?? 0) + 1
      MutableHashMap.set(found, key, entry)
    }
    for (const view of list) {
      O.map(MutableHashMap.get(found, keyOf(view.cells[column.id] ?? "")), (entry) => {
        entry.n += 1
      })
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
    const picked = O.match(R.get(facetPicked, column.id), { onNone: A.empty<string>, onSome: identity }).filter((key) =>
      MutableHashMap.has(found, key)
    )
    return { column, options, picked }
  })

/** Makes one region's atoms from what its caller gives it. */
const makeRegion = (input: RegionInput, registry: AtomRegistry.AtomRegistry): Region => {
  const { problemKinds } = input
  const fixable = Atom.map(problemKinds, fixableBy)
  const rejects = Atom.map(input.ruleFixes, (how) => how === "apply")
  const kinds = Atom.map(problemKinds, (now) => HashMap.fromIterable(now.map((entry) => [entry.id, entry] as const)))
  const words = Atom.map(input.words, reviewWords)
  const id = input.id

  const ui = Atom.make<RegionUi>({
    picked: O.none(),
    kind: O.none(),
    activityOpen: false,
    whyOpen: false,
    confirmOpen: false,
    search: "",
    excluded: HashSet.empty(),
    folded: HashSet.empty(),
    said: "",
    split: HashSet.empty(),
    facetPicked: {}
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
      recheck: get(input.recheck),
      fixable: get(fixable),
      rejects: get(rejects)
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
  const filter = Atom.readable((get): FilterId =>
    O.match(get(picked), {
      onNone: () => O.match(get(opened), { onNone: () => "needs", onSome: (opened) => opened.filter }),
      onSome: (picked) => picked
    })
  )
  // The work list: every kind that has had rows since the review opened stays on it, ticked once done.
  const seenKinds: Atom.Atom<HashSet.HashSet<string>> = Atom.readable((get) => {
    const now = get(counts)
    const before = O.getOrElse(get.self<HashSet.HashSet<string>>(), () => HashSet.empty<string>())
    const more = get(problemKinds).filter((entry) => kindCount(now, entry.id) > 0 && !HashSet.has(before, entry.id))
    return more.length === 0 ? before : more.reduce((seen, entry) => HashSet.add(seen, entry.id), before)
  })
  const work = Atom.readable((get) =>
    workList({ counts: get(counts), problemKinds: get(problemKinds), seen: get(seenKinds) })
  )
  // On a desk and a tablet "Needs you" shows one kind at a time, the one picked on the work list (at first, the
  // first with rows left). A phone goes through every decision in turn.
  const activeKind = Atom.readable((get): O.Option<string> => {
    if (get(filter) !== "needs" || get(regionLayout) === "narrow") return O.none()
    const list = get(work)
    const chosen = O.filter(get(kind), (chosen) => A.some(list, (item) => item.kind.id === chosen))
    return O.orElse(chosen, () =>
      O.map(
        O.orElse(
          A.findFirst(list, (item) => item.left > 0),
          () => A.head(list)
        ),
        (item) => item.kind.id
      )
    )
  })
  const list = Atom.readable((get) => visible({ views: get(views), filter: get(filter), kind: get(activeKind) }))
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
  // The ticked choices filter the rows here, before the table is given them: for each facet with a choice ticked,
  // the file's values behind the ticked choices (two spellings of one choice both count).
  const ticked = Atom.map(facets, (now) =>
    A.flatMap(now, (facet) => {
      const picked = A.filter(facet.options, (option) => A.contains(facet.picked, option.key))
      const values = HashSet.fromIterable(A.flatMap(picked, (option): ReadonlyArray<string> => option.values))
      return HashSet.size(values) === 0 ? [] : [{ column: facet.column.id, values }]
    })
  )
  const shown = Atom.readable((get): ReadonlyArray<RowView> => {
    const rows = get(list)
    const wanted = get(ticked)
    // Nothing ticked: the very list, so nothing that follows it is worked out again.
    return wanted.length === 0
      ? rows
      : A.filter(rows, (view) => A.every(wanted, (facet) => HashSet.has(facet.values, view.cells[facet.column] ?? "")))
  })
  const tableData = Atom.map(shown, (rows) => [...rows])
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
      now === "needs" && O.isSome(get(activeKind))
        ? A.getSomes(A.map(rows, (view) => O.flatMap(view.problem, (problem) => problem.column)))
        : now === "auto"
          ? // The fixes made for the person are what this view is about: their cells stay in the row.
            rows.flatMap((view) => Object.keys(view.marks).filter((column) => isCellMarkApplied(view.marks[column])))
          : []
    )
  })
  const listMode = Atom.readable((get): O.Option<"rail" | "chips"> => {
    const layout: Layout = get(regionLayout)
    // The phone's drawers (vaul) are their own chunk, fetched here, where the review turns out to be narrow, so the
    // first press opens them at once; never on a desk. Asked for again, the browser hands back the one it has.
    if (layout === "narrow") void import("./internal/PhoneDrawer.tsx")
    return layout === "narrow" || get(filter) !== "needs" || get(work).length === 0
      ? O.none()
      : O.some(layout === "wide" ? "rail" : "chips")
  })
  const gridRoom = Atom.readable((get) => {
    const room = get(contentWidth)
    return room - (room < 640 ? 32 : 48) - 2 - (O.contains(get(listMode), "rail") ? railWidth : 0)
  })

  const nav = Atom.make<Nav>({ wanted: O.none(), stepped: O.none() })
  const reveal = Atom.make<O.Option<{ readonly rowId: string; readonly n: number }>>(O.none())
  const present = Atom.make(false)
  const toasts = Atom.make<ReadonlyArray<string | number>>([])
  const attach = refCallback((node: O.Option<HTMLElement>) => {
    if (O.isNone(node)) return undefined
    registry.set(present, true)
    return () => {
      registry.set(present, false)
      // A toast outlives the screen that put it up: the region takes its own with it, so no Undo is left standing
      // on the next screen (the result of the import, the region drawn again from a newer draft).
      for (const id of registry.get(toasts)) toast.dismiss(id)
      registry.set(toasts, [])
    }
  })

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
    words,
    fixable,
    rejects,
    facets,
    shown,
    groups,
    subjects,
    listMode,
    gridRoom,
    nav,
    reveal,
    present,
    toasts,
    attach,
    // A change that changes nothing is no change: the region is not drawn again for it.
    change: (update) =>
      registry.update(ui, (before) => {
        const patch = update(before)
        const now: Readonly<Record<string, unknown>> = before
        const same = A.every(R.toEntries<string, unknown>(patch), ([key, value]) => Object.is(now[key], value))
        return same ? before : { ...before, ...patch }
      }),
    notImported: () =>
      heldCsv({
        views: registry.get(views),
        columns: registry.get(input.columns),
        problemKinds: registry.get(problemKinds),
        words: registry.get(words)
      })
  }
}

/** One region's atoms as an atom: made in the registry that first reads it, with that registry to act through. */
export const regionAtom = (input: RegionInput) => Atom.readable((get) => makeRegion(input, get.registry))

/**
 * One region's atoms, made when the region is first drawn and let go with it: its parts (the table, the phone's
 * queue) read the same atoms from here, not from props handed down.
 */
export const RegionScope = ScopedAtom.make(regionAtom)

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
  reject: O.Option<(rowId: string, column: string) => void>
  /** The row as it stands now, for comparing two rows that cannot both be imported. */
  peek: (rowId: string) => O.Option<RowView>
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
  /** The rows on screen that are flagged (they need the person, or cannot be fixed here), for "Why flagged?". */
  readonly flagged: Atom.Atom<ReadonlyArray<ReviewRow>>
  /** A new value whenever a move may have to be settled: the lines changed, or a move was asked for. */
  readonly moves: Atom.Atom<number>
  /** For `moves`: settles the wanted move once the change is on screen. */
  readonly settleSoon: () => void
  readonly run: (action: Action, from: O.Option<string>) => void
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
    O.isSome(closest("[role=dialog], [role=alertdialog], [role=menu]")(target)))

/**
 * Makes what a region has once its table exists, in the atom that holds it (`ctx`): the table is given the region's
 * rows by a subscription that lives as long as that atom.
 */
const makeRegionTable = (
  input: { readonly region: Region; readonly table: Table<DataTableFeatures, RowView> },
  ctx: Atom.AtomContext
): RegionTable => {
  const { region, table } = input
  const registry = ctx.registry
  const folded = Atom.map(region.ui, (now) => now.folded)

  // The table's sort and search are its own store's. This is what they say, as one text: the store tells its
  // listeners whenever the table is drawn, and the order is worked out again only when the text is another.
  const said = (): string => stringify([table.atoms.sorting.get(), table.atoms.globalFilter.get()])
  const sorted = Atom.readable((get) => {
    const again = () => get.setSelf(said())
    for (const slice of [table.atoms.sorting, table.atoms.globalFilter]) {
      const subscription = slice.subscribe(again)
      get.addFinalizer(() => subscription.unsubscribe())
    }
    return said()
  })
  // The hook hands the screen a copy of the table; the table itself is the one its columns belong to.
  const core = () => table.getAllLeafColumns()[0]?.table ?? table
  // How many times the table was given rows here: the order is read again after each.
  const given = Atom.make(0)
  ctx.mount(given)
  // The table is given its rows where the region works them out, in the change that changed them, so the order read
  // next is of these rows and not of the ones it was last drawn with: given as the table's own hook gives them, the
  // options alone, with nothing published. No read of an atom writes the table's options. The vendored hook
  // (`useDataTable`, over TanStack's `useTable`) still sets the table's options, the rows among them, in every draw of
  // the region: that is TanStack's React binding, kept by decision A4, and not ours to change without changing the
  // vendored kit.
  ctx.subscribe(region.tableData, (data) => {
    const own = core()
    if (own.options.data !== data) {
      table_setOptions(own, (before) => ({ ...before, data }), { syncExternalState: false })
    }
    registry.update(given, (n) => n + 1)
  })
  const ordered = Atom.readable((get): ReadonlyArray<RowView> => {
    const data = get(region.tableData)
    get(given)
    get(sorted)
    // Between the region working the rows out and the table being given them (the same change), the table still
    // holds the rows before: the order already read is kept, and `given` reads it again a moment later.
    if (core().options.data !== data) return O.getOrElse(get.self<ReadonlyArray<RowView>>(), A.empty)
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
          problemKinds: A.filter(
            get(region.input.problemKinds),
            (entry) => O.isNone(active) || O.contains(active, entry.id)
          ),
          collapsed: (entry) => HashSet.has(closed, entry.id)
        })
      : entriesOf({ list: get(ordered), groups: get(region.groups), applied: filter === "auto" })
  })
  const stops = Atom.map(lines, (now): ReadonlyArray<Stop> => {
    const found: Array<Stop> = []
    // Every kind of line is named, so a new one cannot be drawn without saying whether "Next problem" stops at it.
    for (const entry of now) {
      Entry.match(entry, {
        row: ({ view }) => {
          if (view.status === "needs") found.push(Stop.Row({ rowId: view.row.id }))
        },
        kind: ({ collapsed, kind, rowIds }) => {
          if (collapsed)
            O.map(A.head(rowIds), (rowId) => found.push(Stop.Folded({ rowId, kindId: kind.id, among: rowIds })))
        },
        group: () => undefined,
        rest: () => undefined
      })
    }
    return found
  })
  const flagged = Atom.map(ordered, (rows) =>
    A.map(
      A.filter(rows, (view) => view.status === "needs" || view.status === "cannot"),
      (view) => view.row
    )
  )
  const moves = Atom.readable((get) => {
    get(lines)
    get(region.nav)
    // Held here so the region's presence and its toasts are kept for as long as its moves are followed.
    get(region.present)
    get(region.toasts)
    return O.getOrElse(get.self<number>(), () => 0) + 1
  })

  const want = (wanted: O.Option<Wanted>) => registry.update(region.nav, (before) => ({ ...before, wanted }))
  const section = (): O.Option<HTMLElement> =>
    query({ selector: `[data-review-region="${region.id}"]`, root: document })

  // With nothing left to go to, focus goes to the one action that is left: the import button, or, where the region
  // has none (embedded, or only looking), the table itself. Never to the page's body, from where the person had to
  // press Shift+Tab ninety-nine times to get back.
  const focusLast = () => {
    const root = section()
    const button = O.flatMap(root, (root) => query({ selector: "[data-import-button]", root }))
    if (O.isSome(button) && button.value.checkVisibility()) button.value.focus()
    else
      O.map(
        O.flatMap(root, (root) => query({ selector: '[data-slot="sticky-table-frame"]', root })),
        (frame) => frame.focus()
      )
  }
  const focusRow = (askedRow: O.Option<string>, toGroup: boolean) => {
    if (O.isNone(askedRow) || !A.some(registry.get(ordered), (view) => view.row.id === askedRow.value)) {
      focusLast()
      return
    }
    const rowId = askedRow.value
    registry.update(region.reveal, (before) =>
      O.some({ rowId, n: O.match(before, { onNone: () => 1, onSome: (asked) => asked.n + 1 }) })
    )
    requestAnimationFrame(() => {
      const root = section()
      const row = O.flatMap(root, (root) => query({ selector: `[data-row-id="${CSS.escape(rowId)}"]`, root }))
      // A row under a group's heading is decided by the heading: its accept takes the focus, not the row's tick.
      const group = toGroup ? O.flatMap(row, (row) => data("group")(row)) : O.none<string>()
      const target = O.orElse(
        O.flatMap(group, (group) =>
          O.flatMap(root, (root) =>
            query({ selector: `[data-group-id="${CSS.escape(group)}"] [data-group-accept]`, root })
          )
        ),
        () => O.flatMap(row, (row) => query({ selector: "[data-first-action]", root: row }))
      )
      O.match(target, { onNone: focusLast, onSome: (target) => target.focus() })
    })
  }

  const onPage = (): boolean => registry.get(region.present)

  /** The rows a stop stands for: its own, or every row of the kind it folds. */
  const rowsAt = Stop.$match({ Row: ({ rowId }) => [rowId], Folded: ({ among }) => among })

  const run = (action: Action, from: O.Option<string>) => {
    if (!onPage()) return
    const outcome = act({
      rows: registry.get(region.input.rows),
      state: registry.get(region.input.decisions),
      action,
      recheck: registry.get(region.input.recheck),
      fixable: registry.get(region.fixable),
      rejects: registry.get(region.rejects)
    })
    if (outcome.label === "") return
    const narrow = registry.get(regionLayout) === "narrow"
    const history = isActionUndo(action) || isActionRedo(action)
    let unfold: O.Option<string> = O.none()
    // On a phone the queue moves focus to the card that takes the decided one's place.
    let move: O.Option<Wanted> = O.none()
    if (narrow) move = O.none()
    else if (history) move = O.some(Wanted.Row({ rowId: outcome.focus, toGroup: false, waited: 0 }))
    else {
      // The next place on screen that still needs a decision after this one, in the order the table shows them
      // (a folded kind is opened to reach its rows); failing that, the row itself when it still needs one.
      const changed = MutableHashSet.fromIterable(outcome.changed)
      const left = (rowId: string): boolean => !MutableHashSet.has(changed, rowId)
      const origin = O.orElse(from, () => A.head(outcome.changed))
      const places = registry.get(stops)
      const at = A.findFirstIndex(places, (stop) => O.exists(origin, (origin) => A.contains(rowsAt(stop), origin)))
      const ahead = O.match(at, {
        onNone: () => places,
        onSome: (at) => [...A.drop(places, at + 1), ...A.take(places, Math.max(0, at))]
      })
      const next = A.findFirst(ahead, (stop) => A.some(rowsAt(stop), left))
      const stays = O.filter(from, left)
      // Read before the decision is written: advancing follows the kind the person was on.
      const onScreen = registry.get(region.activeKind)
      move = O.some(
        O.match(next, {
          onNone: () =>
            O.match(stays, {
              onNone: () =>
                O.match(onScreen, {
                  onNone: () => Wanted.Row({ rowId: O.none(), toGroup: true, waited: 0 }),
                  onSome: (from) => Wanted.Advance({ from: O.some(from) })
                }),
              onSome: (rowId) => Wanted.Row({ rowId: O.some(rowId), toGroup: true, waited: 0 })
            }),
          onSome: (next) =>
            Stop.$match(next, {
              Row: ({ rowId }): Wanted => Wanted.Row({ rowId: O.some(rowId), toGroup: true, waited: 0 }),
              Folded: ({ among, kindId }): Wanted => {
                const ids = A.filter(among, left)
                unfold = O.some(kindId)
                return Wanted.Among({ rowId: A.head(ids), ids, last: false })
              }
            })
        })
      )
    }
    Atom.batch(() => {
      want(move)
      region.change((before) => ({
        said: outcome.label,
        folded: O.match(unfold, { onNone: () => before.folded, onSome: (unfold) => flip(before.folded, unfold) })
      }))
      // The caller's atom: whoever keeps the decisions (a server draft, the browser) follows it.
      registry.set(region.input.decisions, outcome.state)
    })
    // A step that settled several rows at once can be taken back from where the eye is: a toast with Undo. It takes
    // back that step only, and only while it is still the last one.
    const bulk = !history && outcome.changed.length > 1
    const step = outcome.state.undo[outcome.state.undo.length - 1]
    if (bulk && step !== undefined && !narrow) {
      const shown = toast(outcome.label, {
        action: {
          label: "Undo",
          onClick: () => {
            const undo = registry.get(region.input.decisions).undo
            if (undo[undo.length - 1] === step) run({ type: "undo" as const }, O.none())
          }
        }
      })
      registry.update(region.toasts, (before) => [...before, shown])
    }
  }

  const step = (back: boolean) => {
    if (!onPage()) return
    const active = document.activeElement
    const focused =
      active instanceof HTMLElement
        ? O.flatMap(closest("[data-row-id]")(active), (row) => data("rowId")(row))
        : O.none<string>()
    const places = registry.get(stops)
    const here = O.orElse(focused, () => registry.get(region.nav).stepped)
    const at = A.findFirstIndex(places, (entry) => O.contains(here, entry.rowId))
    const next = O.match(at, {
      onNone: () => (back ? A.last(places) : A.head(places)),
      onSome: (at) => (back ? O.orElse(A.get(places, at - 1), () => A.get(places, at)) : A.get(places, at + 1))
    })
    if (O.isNone(next)) {
      const onScreen = registry.get(region.activeKind)
      if (!back && O.isSome(onScreen)) want(O.some(Wanted.Advance({ from: onScreen })))
      else
        O.match(
          O.flatMap(at, (at) => A.get(places, at)),
          {
            onNone: () => undefined,
            onSome: (place) => focusRow(O.some(place.rowId), false)
          }
        )
      return
    }
    Stop.$match(next.value, {
      Row: ({ rowId }) => {
        registry.update(region.nav, (before) => ({ ...before, stepped: O.some(rowId) }))
        focusRow(O.some(rowId), false)
      },
      Folded: ({ among, kindId, rowId }) =>
        Atom.batch(() => {
          registry.set(region.nav, {
            stepped: O.some(rowId),
            wanted: O.some(Wanted.Among({ rowId: O.some(rowId), ids: among, last: back }))
          })
          region.change((before) => ({ folded: flip(before.folded, kindId) }))
        })
    })
  }

  // After a decision focus goes to the next row that needs one; after an undo, back to the row.
  const settle = () => {
    const wanted = registry.get(region.nav).wanted
    if (O.isNone(wanted) || !onPage()) return
    const places = registry.get(stops)
    Wanted.$match(wanted.value, {
      // "Next problem" goes down the work list from the kind the person was on: the next kind with rows left, its
      // first row once it is drawn.
      Advance: ({ from }) => {
        const next = nextKind({ list: registry.get(region.work), from })
        if (O.isNone(next) || O.exists(next, (next) => O.contains(from, next))) {
          want(O.none())
          focusRow(
            O.map(A.head(places), (place) => place.rowId),
            false
          )
          return
        }
        Atom.batch(() => {
          want(O.some(Wanted.First()))
          region.change(() => ({ kind: next }))
        })
      },
      First: () => {
        const first = O.map(A.head(places), (place) => place.rowId)
        registry.set(region.nav, { wanted: O.none(), stepped: first })
        focusRow(first, true)
      },
      Row: (move) => {
        // A caller whose rows follow the decisions a little later: after an undo the row may not be in the list yet.
        // Wait for two frames before falling back.
        const { rowId, waited } = move
        if (O.isSome(rowId) && waited < 2 && !A.some(registry.get(ordered), (view) => view.row.id === rowId.value)) {
          want(O.some(Wanted.Row({ ...move, waited: waited + 1 })))
          return
        }
        want(O.none())
        focusRow(rowId, move.toGroup)
      },
      // A kind was just unfolded to step into it: its first row as drawn (its last, stepping backwards).
      Among: (move) => {
        const drawn = A.filter(places, (stop) => isStopRow(stop) && A.contains(move.ids, stop.rowId))
        const target = O.orElse(
          O.map(move.last ? A.last(drawn) : A.head(drawn), (place) => place.rowId),
          () => move.rowId
        )
        registry.set(region.nav, { wanted: O.none(), stepped: target })
        focusRow(target, false)
      }
    })
  }
  // The atoms change before the rows are drawn: the move is settled a frame later, when they are on screen.
  const settleSoon = () => {
    if (O.isSome(registry.get(region.nav).wanted)) requestAnimationFrame(settle)
  }

  const excluded = () => [...registry.get(region.ui).excluded]
  const actions: RowActions = {
    accept: (rowId) => run({ type: "accept" as const, rowIds: [rowId] }, O.some(rowId)),
    keep: (rowId) => run({ type: "keep" as const, rowId }, O.some(rowId)),
    leaveOut: (rowId) => run({ type: "leaveOut" as const, rowIds: [rowId] }, O.some(rowId)),
    putBack: (rowId) => run({ type: "putBack" as const, rowId }, O.some(rowId)),
    edit: (rowId, column, value) => run({ type: "edit" as const, rowId, column, value }, O.some(rowId)),
    undoFix: (rowId, column) => run({ type: "revert" as const, rowId, column, how: "undo" }, O.some(rowId)),
    reject: O.some((rowId: string, column: string) =>
      run({ type: "revert" as const, rowId, column, how: "reject" }, O.some(rowId))
    ),
    peek: (rowId) => A.findFirst(registry.get(region.views), (view) => view.row.id === rowId)
  }
  const groupActions: GroupActions = {
    accept: (groupId) => run({ type: "acceptGroup" as const, groupId, except: excluded() }, O.none()),
    choose: (groupId, value) => run({ type: "chooseGroup" as const, groupId, value, except: excluded() }, O.none()),
    leaveOut: (rowIds) => run({ type: "leaveOut" as const, rowIds }, O.none()),
    revert: (groupId) => run({ type: "revertGroup" as const, groupId }, O.none()),
    acceptRows: (rowIds) => run({ type: "accept" as const, rowIds }, O.none()),
    toggle: (rowId) => {
      if (onPage()) region.change((before) => ({ excluded: flip(before.excluded, rowId) }))
    },
    fold: (kindId) => {
      if (onPage()) region.change((before) => ({ folded: flip(before.folded, kindId) }))
    }
  }
  const plainActions: RowActions = { ...actions, reject: O.none() }

  // Let go the moment nothing mounts it: a region that has gone must not hear a key meant for the one after it.
  const keys = Atom.setIdleTTL(
    Atom.readable((get) => {
      const onKey = (event: KeyboardEvent) => {
        // Inside a text field the browser's own undo applies.
        if (!onPage() || event.defaultPrevented || isTyping(event.target)) return
        const key = event.key.toLowerCase()
        if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "z") {
          event.preventDefault()
          run(event.shiftKey ? { type: "redo" as const } : { type: "undo" as const }, O.none())
          return
        }
        if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && key === "y") {
          event.preventDefault()
          run({ type: "redo" as const }, O.none())
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
    flagged,
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

/** What a region has once its table exists, as an atom made in the registry that first reads it. */
export const regionTableAtom = (input: {
  readonly region: Region
  readonly table: Table<DataTableFeatures, RowView>
}) => Atom.readable((get) => makeRegionTable(input, get))

/** What a region has once its table exists, made once from the table the region was first drawn with. */
export const TableScope = ScopedAtom.make(regionTableAtom)

export { Density, density }
