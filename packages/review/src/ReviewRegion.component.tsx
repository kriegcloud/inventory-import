import { parse, stringify } from "@inventory/ui/Json"
import { type Column, createColumnHelper, Subscribe } from "@tanstack/react-table"
import {
  CheckIcon,
  CircleHelpIcon,
  Columns3Icon,
  DownloadIcon,
  HistoryIcon,
  Rows2Icon,
  Rows3Icon,
  Redo2Icon,
  SearchIcon,
  Undo2Icon
} from "lucide-react"
import { toast } from "sonner"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as MutableHashMap from "effect/MutableHashMap"
import * as MutableHashSet from "effect/MutableHashSet"
import * as O from "effect/Option"
import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react"
import { AgentRun } from "@inventory/ui/AgentRun"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@inventory/ui/components/alert-dialog"
import { Button } from "@inventory/ui/components/button"
import { DataTableFacetedFilter } from "@inventory/ui/components/data-table/data-table-faceted-filter"
import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { DataTableViewOptions } from "@inventory/ui/components/data-table/data-table-view-options"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@inventory/ui/components/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@inventory/ui/components/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@inventory/ui/components/input-group"
import { Separator } from "@inventory/ui/components/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@inventory/ui/components/sheet"
import { Skeleton } from "@inventory/ui/components/skeleton"
import { Spinner } from "@inventory/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@inventory/ui/components/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@inventory/ui/components/tooltip"
import { useDataTable } from "@inventory/ui/hooks/use-data-table"
import {
  Action,
  act,
  appliedGroups,
  confirmLine,
  count,
  decisionsLeft,
  nextKind,
  workList,
  emptyState,
  entries as entriesOf,
  fixableBy,
  heldCsv,
  importSummary,
  heldLine,
  kindCount,
  primary,
  proposing,
  restored,
  result,
  saved,
  sections as sectionsOf,
  viewRows,
  visible,
  waitingGroups
} from "@inventory/review/ReviewDraft"
import { useContentWidth } from "@inventory/ui/ContentWidth"
import { LayoutContext, useLayout } from "./internal/parts.tsx"
import {
  actionsFit,
  type Density,
  type GridHandle,
  type GroupActions,
  ReviewGrid,
  type RowActions
} from "./internal/ReviewGrid.tsx"
import { ReviewQueue } from "./internal/ReviewQueue.tsx"
import { WorkList } from "./internal/WorkList.tsx"
import type { Activity, FilterId, ReviewRegionProps, ReviewState, RowView } from "@inventory/review/ReviewTypes"
import { reviewWords } from "@inventory/review/ReviewWords"

// The phone's drawers (vaul) are their own chunk: fetched on a phone once the review is drawn, never on a desk.
const PhoneDrawer = lazy(() => import("./internal/PhoneDrawer.tsx").then((module) => ({ default: module.PhoneDrawer })))

/** The set with `id` taken out when it was in, put in when it was not: a tick or a fold pressed again. */
const flip = (set: HashSet.HashSet<string>, id: string): HashSet.HashSet<string> =>
  HashSet.has(set, id) ? HashSet.remove(set, id) : HashSet.add(set, id)

/** A place "Next problem" stops at: a row that needs the person, or a folded kind standing for its rows. */
type Stop = { rowId: string; kindId?: string; among?: ReadonlyArray<string> }

const whole = new Intl.NumberFormat("en-US")
const densityKey = "review-density"
/** The work list's rail beside the table (`w-44`). */
const railWidth = 176
/** The keys for undo and redo as the person's keyboard says them: Command on a Mac, Ctrl elsewhere. */
const onMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
const undoKeys = onMac ? "\u2318Z" : "Ctrl+Z"
const redoKeys = onMac ? "\u21e7\u2318Z" : "Ctrl+Shift+Z"
const stepTag = { read: "Read", rule: "Rule", model: "Model" } as const
const col = createColumnHelper<DataTableFeatures, RowView>()

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest("[role=dialog], [role=alertdialog], [role=menu]") !== null)

/** What the run did, behind one button: steps tagged Read, Rule or Model, what it was allowed to do, and what it cost. */
function ActivityPanel(props: {
  activity: Activity
  open: boolean
  onOpenChange: (open: boolean) => void
  narrow: boolean
  returnFocus: React.RefObject<HTMLButtonElement | null>
}) {
  const body = (
    <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6 text-sm">
      <AgentRun
        title="Steps"
        producer=""
        steps={props.activity.steps.map((step) => ({
          id: step.id,
          label: step.label,
          status: "done" as const,
          tag: stepTag[step.by],
          ...(step.detail === undefined ? {} : { output: step.detail })
        }))}
      />
      <section aria-label="Allowed to" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Allowed to</h2>
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {props.activity.allowed.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckIcon aria-hidden className="mt-1 size-3.5 shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </section>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t pt-4">
        {props.activity.facts.map((fact) => (
          <div key={fact.label} className="contents">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="text-right tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
  // Opened from a plain button, so the panel has no trigger of its own to give focus back to.
  const giveBack = (event: Event) => {
    event.preventDefault()
    props.returnFocus.current?.focus()
  }
  if (props.narrow) {
    return (
      <Suspense fallback={null}>
        <PhoneDrawer
          open={props.open}
          onOpenChange={props.onOpenChange}
          onCloseAutoFocus={giveBack}
          title="Activity"
          description="What the review did before you saw it"
          quietDescription
        >
          {body}
        </PhoneDrawer>
      </Suspense>
    )
  }
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent onCloseAutoFocus={giveBack}>
        <SheetHeader>
          <SheetTitle>Activity</SheetTitle>
          <SheetDescription className="sr-only">What the review did before you saw it</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}

/**
 * An icon button in the table's toolbar: the icon alone, its words in a tooltip and for a screen reader. `disabled`
 * keeps it in the tab order (`aria-disabled`) so its tooltip can still say why nothing happens.
 */
function ToolButton({
  label,
  tip,
  narrow,
  disabled,
  variant = "ghost",
  onClick,
  children,
  ...rest
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size"> & {
  label: string
  /** The tooltip, when it says more than the label (a shortcut, the step it would undo). */
  tip?: string
  narrow: boolean
  variant?: "ghost" | "attention"
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={narrow ? "icon-touch" : "icon-sm"}
          aria-label={label}
          aria-disabled={disabled === true ? true : undefined}
          onClick={(event) => {
            if (disabled !== true) onClick?.(event)
          }}
          {...rest}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip ?? label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The review step of an import as one region that fills its frame: counts that filter, the rows with each problem
 * and what each button would do about it, and one button that says what it will import. A table on a desk, a
 * shorter table on a tablet, one decision at a time on a phone. It decides nothing about the data: rows, columns,
 * problem words, proposals and the re-check all come from the caller.
 */
export function ReviewRegion(props: ReviewRegionProps) {
  const layout = useLayout()
  const room = useContentWidth()
  const narrow = layout === "narrow"
  // On a phone the confirm and the activity are drawers: their code is fetched once the review is drawn, so the
  // first press opens them at once.
  useEffect(() => {
    if (narrow) void import("./internal/PhoneDrawer.tsx")
  }, [narrow])
  const titleId = useId()
  const loading = props.state === "loading"
  const failed = props.state === "error"
  const readOnly = props.readOnly === true
  const embedded = props.embedded === true

  const [state, setState] = useState<ReviewState>(() =>
    props.savedDecisions !== undefined
      ? restored(props.savedDecisions)
      : props.ruleFixes === "apply"
        ? emptyState
        : proposing(props.rows)
  )
  // The caller keeps the decisions (a server draft, the browser): told after every change, never on the first render.
  // The callback is read from a ref, so a caller that passes a new function on every render
  // (`onDecisionsChange={(next) => setDraft(next)}`) is told once per change: with the callback among the effect's
  // dependencies, each render it caused would have told it again, for ever.
  const told = useRef(props.onDecisionsChange)
  useLayoutEffect(() => {
    told.current = props.onDecisionsChange
  })
  const started = useRef(state)
  useEffect(() => {
    if (started.current !== state) told.current?.(saved(state))
  }, [state])
  const [picked, setPicked] = useState<FilterId | undefined>(undefined)
  const [kind, setKind] = useState<string | undefined>(undefined)
  const [activityOpen, setActivityOpen] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [search, setSearch] = useState("")
  // Rows the person took out of their group's one action, and kinds whose rows they folded or unfolded.
  const [excluded, setExcluded] = useState<HashSet.HashSet<string>>(HashSet.empty)
  const [folded, setFolded] = useState<HashSet.HashSet<string>>(HashSet.empty)
  // The last thing that happened, for a screen reader.
  const [said, setSaid] = useState("")
  // Bumped to run the focus effect when nothing else changed (stepping past the last row of a kind).
  const [tick, setTick] = useState(0)

  const { rows, recheck, problemKinds, columns } = props
  // The caller's words over the defaults: every tab, tag and count below says these. Keyed on the words themselves,
  // so a caller that writes the object inline does not redraw the table on every render.
  const wordsKey = stringify(props.words ?? {})
  const words = useMemo(() => reviewWords(parse(wordsKey) as ReviewRegionProps["words"]), [wordsKey])
  const fixable = useMemo(() => fixableBy(problemKinds), [problemKinds])
  // Where the rules' fixes arrive in force, one the person undid or turned down stays turned down.
  const rejects = props.ruleFixes === "apply"
  const views = useMemo(
    () => viewRows({ rows, state, recheck, fixable, rejects }),
    [rows, state, recheck, fixable, rejects]
  )
  const counts = useMemo(() => count(views), [views])
  // Open on what needs the person; a file with nothing to decide opens on everything.
  // Groups the person chose to go through row by row on a phone: each of their rows is then a decision of its own.
  const [split, setSplit] = useState<HashSet.HashSet<string>>(HashSet.empty)
  const left = useMemo(() => decisionsLeft(views, split), [views, split])
  const opened = useRef<{ filter: FilterId; needs: number; decisions: number } | undefined>(undefined)
  if (opened.current === undefined && rows.length > 0) {
    opened.current = {
      filter: counts.needs > 0 ? "needs" : counts.blocked > 0 ? "cannot" : "all",
      needs: counts.needs,
      decisions: left
    }
  }
  const filter: FilterId = picked ?? opened.current?.filter ?? "needs"
  // The work list: every kind that has had rows since the review opened stays on it, ticked once done.
  const seenKinds = useRef(HashSet.empty<string>())
  for (const entry of problemKinds) {
    if (kindCount(counts, entry.id) > 0 && !HashSet.has(seenKinds.current, entry.id)) {
      seenKinds.current = HashSet.add(seenKinds.current, entry.id)
    }
  }
  const work = useMemo(
    () => workList({ counts, problemKinds, seen: seenKinds.current }),
    // `seenKinds` only grows with the counts.
    [counts, problemKinds]
  )
  // On a desk and a tablet "Needs you" shows one kind at a time, the one picked on the work list (at first, the
  // first with rows left). A phone goes through every decision in turn.
  const activeKind =
    filter !== "needs" || narrow
      ? undefined
      : kind !== undefined && work.some((item) => item.kind.id === kind)
        ? kind
        : (work.find((item) => item.left > 0)?.kind.id ?? work[0]?.kind.id)
  const list = useMemo(() => visible({ views, filter, kind: activeKind }), [views, filter, activeKind])
  const kinds = useMemo(
    () => HashMap.fromIterable(problemKinds.map((entry) => [entry.id, entry] as const)),
    [problemKinds]
  )

  // -- One table instance: sorting, hidden columns, faceted filters and search come from the data-table parts. ---
  const defs = useMemo(
    () =>
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
      ),
    [columns]
  )
  const data = useMemo(() => [...list], [list])
  const [initialState] = useState(() => ({
    columnVisibility: Object.fromEntries(
      columns.filter((column) => column.hidden === true).map((column) => [column.id, false])
    )
  }))
  const { table } = useDataTable({ data, columns: defs, mode: "client", initialState, getRowId: (view) => view.row.id })
  const ordered = table.getPrePaginatedRowModel().rows.map((row) => row.original)

  // -- The Filter panel: for each facet column, the values the file has, as the person reads them. -------------
  // Two spellings that differ only by spaces around them ("Serialized" and "Serialized ") read the same, so they
  // are one choice that shows both. `n` counts rows in the view that is showing (Needs you, Ready, All).
  const facetColumns = useMemo(() => columns.filter((column) => column.facet === true), [columns])
  const [facetPicked, setFacetPicked] = useState<Readonly<Record<string, ReadonlyArray<string>>>>({})
  const facets = useMemo(
    () =>
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
      }),
    [facetColumns, facetPicked, views, list]
  )
  // The table does the filtering; this hands it the values behind the ticked choices whenever they change.
  const facetValues = stringify(
    facets.map((facet) => [
      facet.column.id,
      facet.options.filter((option) => facet.picked.includes(option.key)).flatMap((option) => option.values)
    ])
  )
  // The table object is new on every render, so it is read through a ref: only a change of values runs this, and
  // a column whose filter already holds them is left alone (setting it again would render again, for ever).
  const tableNow = useRef(table)
  tableNow.current = table
  useEffect(() => {
    for (const [id, values] of parse(facetValues) as ReadonlyArray<[string, ReadonlyArray<string>]>) {
      const target = tableNow.current.getColumn(id)
      const next = values.length > 0 ? values : undefined
      if (target !== undefined && stringify(target.getFilterValue()) !== stringify(next)) {
        target.setFilterValue(next)
      }
    }
  }, [facetValues])

  const groups = useMemo(
    () =>
      filter === "auto" ? appliedGroups(views) : filter === "needs" ? waitingGroups({ views, kind: activeKind }) : [],
    [views, filter, activeKind]
  )
  // "Needs you" shows the kind picked on the work list: its heading (what its rows need, and its bulk answers), each
  // group of identical fixes above its rows, then the rows settled one at a time.
  const lines =
    filter === "needs"
      ? sectionsOf({
          list: ordered,
          groups,
          problemKinds: problemKinds.filter((entry) => activeKind === undefined || entry.id === activeKind),
          collapsed: (entry) => HashSet.has(folded, entry.id)
        })
      : entriesOf({ list: ordered, groups, applied: filter === "auto" })
  // While a rule group's accept is in view it is the screen's one filled button and Import waits, outlined.
  const [leadInView, setLeadInView] = useState(false)
  // On the other tabs Import waits too while a decision is open: filled there, it invited skipping every row
  // that still needs the person.
  const waits = narrow
    ? filter === "needs" && counts.needs > 0
    : !readOnly && (filter === "needs" ? leadInView : counts.needs > 0)
  // In the grouped views the headings say the status, so the column would be empty: its width goes to the name.
  // Nor when every row showing would say the same word ("Ready", before anything was decided).
  const showStatus =
    filter !== "auto" &&
    filter !== "needs" &&
    ordered.some((view) => view.status !== "ready" || view.decided !== undefined)
  // The columns the problems on screen are about stay in the table: the person is deciding on their values.
  const subjects = useMemo(
    () =>
      HashSet.fromIterable(
        filter === "needs" && activeKind !== undefined
          ? list.flatMap((view) => (view.problem?.column === undefined ? [] : [view.problem.column]))
          : filter === "auto"
            ? // The fixes made for the person are what this view is about: their cells stay in the row.
              list.flatMap((view) =>
                Object.keys(view.marks).filter((column) => view.marks[column]?.state === "applied")
              )
            : []
      ),
    [filter, activeKind, list]
  )
  // Compact (36 px rows) or comfortable (44 px), remembered in this browser: a preference, not progress.
  const [density, setDensity] = useState<Density>(() => {
    try {
      return window.localStorage.getItem(densityKey) === "comfortable" ? "comfortable" : "compact"
    } catch {
      return "compact"
    }
  })
  const chooseDensity = (next: Density) => {
    setDensity(next)
    try {
      window.localStorage.setItem(densityKey, next)
    } catch {
      // A private window refuses: the choice lasts for this visit.
    }
  }
  const main = primary({ columns, counts, noun: props.noun, closing: props.closingLabel, words })
  // As wide as the widest answers showing (a long pick, "Other answers"), so no button runs under the next.
  const actionsWidth = narrow ? 0 : actionsFit({ entries: lines, columns, readOnly, rowAction: props.rowAction })

  // -- Focus: after a decision it goes to the next row that needs one; after an undo, back to the row. ----------
  const root = useRef<HTMLElement>(null)
  const grid = useRef<GridHandle>(null)
  const importButton = useRef<HTMLButtonElement>(null)
  const activityReturn = useRef<HTMLButtonElement>(null)
  const wanted = useRef<
    | {
        rowId: string | undefined
        among?: { ids: ReadonlyArray<string>; last: boolean }
        /** The kind on screen has nothing left: go down the work list to the next kind with rows. */
        advance?: boolean
        /** A new kind was just put on screen: its first row that needs the person. */
        first?: boolean
        /** Renders waited for the row to come into the list (a caller whose rows follow the decisions is a render late). */
        waited?: number
        /** After a decision: a row under a group's heading hands the focus to the heading's accept. */
        toGroup?: boolean
      }
    | undefined
  >(undefined)
  /** The row "Next problem" last went to. */
  const stepped = useRef<string | undefined>(undefined)
  const latest = useRef({
    rows,
    state,
    recheck,
    fixable,
    rejects,
    list: ordered,
    views,
    narrow,
    sequence: [] as ReadonlyArray<Stop>,
    work,
    activeKind,
    run: (_action: Action): void => undefined
  })
  // The rows that need the person in the order the table shows them, sections and all. A folded kind is one
  // stop: its rows are not drawn, and once it is opened they come in the table's order (groups first), which is
  // not the order the kind lists them in. So the stop carries the kind to unfold and its rows to choose among.
  const sequence: Array<Stop> = []
  for (const entry of lines) {
    if (entry.type === "row") {
      if (entry.view.status === "needs") sequence.push({ rowId: entry.view.row.id })
    } else if (entry.type === "kind" && entry.collapsed) {
      const first = entry.rowIds[0]
      if (first !== undefined) sequence.push({ rowId: first, kindId: entry.kind.id, among: entry.rowIds })
    }
  }
  latest.current = {
    ...latest.current,
    rows,
    state,
    recheck,
    fixable,
    rejects,
    list: ordered,
    views,
    narrow,
    sequence,
    work,
    activeKind
  }

  // With nothing left to go to, focus goes to the one action that is left: the import button, or, where the region
  // has none (embedded, or only looking), the table itself. Never to the page's body, from where the person had to
  // press Shift+Tab ninety-nine times to get back.
  const focusLast = useCallback(() => {
    if (importButton.current !== null && importButton.current.checkVisibility()) importButton.current.focus()
    else grid.current?.focus()
  }, [])
  const focusRow = useCallback(
    (rowId: string | undefined, toGroup = false) => {
      if (rowId === undefined || !latest.current.list.some((view) => view.row.id === rowId)) {
        focusLast()
        return
      }
      grid.current?.reveal(rowId)
      requestAnimationFrame(() => {
        const row = root.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(rowId)}"]`)
        // A row under a group's heading is decided by the heading: its accept takes the focus, not the row's tick.
        const group = toGroup ? row?.dataset.group : undefined
        const target =
          (group === undefined
            ? undefined
            : root.current?.querySelector<HTMLElement>(`[data-group-id="${CSS.escape(group)}"] [data-group-accept]`)) ??
          row?.querySelector<HTMLElement>("[data-first-action]")
        if (target === null || target === undefined) focusLast()
        else target.focus()
      })
    },
    [focusLast]
  )

  useEffect(() => {
    const want = wanted.current
    if (want === undefined) return
    wanted.current = undefined
    const now = latest.current
    if (want.advance === true) {
      // "Next problem" goes down the work list: the next kind with rows left, its first row once it is drawn.
      const next = nextKind({ list: now.work, from: now.activeKind })
      if (next === undefined || next === now.activeKind) {
        focusRow(now.sequence[0]?.rowId)
        return
      }
      wanted.current = { rowId: undefined, first: true }
      setKind(next)
      return
    }
    if (want.first === true) {
      stepped.current = now.sequence[0]?.rowId
      focusRow(now.sequence[0]?.rowId, true)
      return
    }
    if (want.among === undefined) {
      // A caller that works its rows out from the decisions (`onDecisionsChange`) hands the row back a render later:
      // after an undo it may not be in the list yet. Wait for two renders before falling back.
      const waited = want.waited ?? 0
      if (want.rowId !== undefined && waited < 2 && !now.list.some((view) => view.row.id === want.rowId)) {
        wanted.current = { ...want, waited: waited + 1 }
        requestAnimationFrame(() => setTick((tick) => tick + 1))
        return
      }
      focusRow(want.rowId, want.toGroup === true)
      return
    }
    // A kind was just unfolded to step into it: its first row as drawn (its last, stepping backwards).
    const among = want.among
    const drawn = latest.current.sequence.filter((stop) => stop.kindId === undefined && among.ids.includes(stop.rowId))
    const target = (among.last ? drawn[drawn.length - 1] : drawn[0])?.rowId ?? want.rowId
    stepped.current = target
    focusRow(target)
  }, [views, folded, activeKind, tick, focusRow])

  const run = useCallback((action: Action, from?: string) => {
    const now = latest.current
    const outcome = act({
      rows: now.rows,
      state: now.state,
      action,
      recheck: now.recheck,
      fixable: now.fixable,
      rejects: now.rejects
    })
    if (outcome.label === "") return
    // On a phone the queue moves focus to the card that takes the decided one's place.
    if (now.narrow) wanted.current = undefined
    else if (Action.$is("Undo")(action) || Action.$is("Redo")(action))
      wanted.current = { rowId: O.getOrUndefined(outcome.focus) }
    else {
      // The next place on screen that still needs a decision after this one, in the order the table shows them
      // (a folded kind is opened to reach its rows); failing that, the row itself when it still needs one.
      const changed = MutableHashSet.fromIterable(outcome.changed)
      const origin = from ?? outcome.changed[0]
      const stops = now.sequence
      const at = stops.findIndex((stop) => stop.rowId === origin || stop.among?.includes(origin ?? "") === true)
      const ahead = [...stops.slice(at + 1), ...stops.slice(0, Math.max(0, at))]
      const next = ahead.find((stop) =>
        (stop.among ?? [stop.rowId]).some((rowId) => !MutableHashSet.has(changed, rowId))
      )
      const stays = from !== undefined && !MutableHashSet.has(changed, from) ? from : undefined
      if (next?.kindId !== undefined) {
        const kindId = next.kindId
        const ids = (next.among ?? [next.rowId]).filter((rowId) => !MutableHashSet.has(changed, rowId))
        wanted.current = { rowId: ids[0], among: { ids, last: false } }
        setFolded((before) => flip(before, kindId))
      } else if (next === undefined && stays === undefined && now.activeKind !== undefined) {
        // The kind on screen is done: on to the next one on the work list.
        wanted.current = { rowId: undefined, advance: true }
      } else wanted.current = { rowId: next?.rowId ?? stays, toGroup: true }
    }
    setSaid(outcome.label)
    setState(outcome.state)
    // A step that settled several rows at once can be taken back from where the eye is: a toast with Undo. It takes
    // back that step only, and only while it is still the last one.
    const bulk = !Action.$is("Undo")(action) && !Action.$is("Redo")(action) && outcome.changed.length > 1
    const step = outcome.state.undo[outcome.state.undo.length - 1]
    if (bulk && step !== undefined && !now.narrow) {
      toast(outcome.label, {
        action: {
          label: "Undo",
          onClick: () => {
            const undo = latest.current.state.undo
            if (undo[undo.length - 1] === step) latest.current.run(Action.Undo())
          }
        }
      })
    }
  }, [])

  latest.current.run = run

  const actions = useMemo<RowActions>(
    () => ({
      accept: (rowId) => run(Action.Accept({ rowIds: [rowId] }), rowId),
      keep: (rowId) => run(Action.Keep({ rowId }), rowId),
      leaveOut: (rowId) => run(Action.LeaveOut({ rowIds: [rowId] }), rowId),
      putBack: (rowId) => run(Action.PutBack({ rowId }), rowId),
      edit: (rowId, column, value) => run(Action.Edit({ rowId, column, value }), rowId),
      undoFix: (rowId, column) => run(Action.Revert({ rowId, column, how: "undo" }), rowId),
      ...(rejects
        ? { reject: (rowId: string, column: string) => run(Action.Revert({ rowId, column, how: "reject" }), rowId) }
        : {}),
      peek: (rowId) => latest.current.views.find((view) => view.row.id === rowId)
    }),
    [run, rejects]
  )
  const excludedNow = useRef(excluded)
  excludedNow.current = excluded
  const groupActions = useMemo<GroupActions>(
    () => ({
      accept: (groupId) => run(Action.AcceptGroup({ groupId, except: [...excludedNow.current] })),
      choose: (groupId, value) => run(Action.ChooseGroup({ groupId, value, except: [...excludedNow.current] })),
      leaveOut: (rowIds) => run(Action.LeaveOut({ rowIds })),
      revert: (groupId) => run(Action.RevertGroup({ groupId })),
      acceptRows: (rowIds) => run(Action.Accept({ rowIds })),
      toggle: (rowId) => setExcluded((before) => flip(before, rowId)),
      fold: (kindId) => setFolded((before) => flip(before, kindId))
    }),
    [run]
  )

  const step = useCallback(
    (back: boolean) => {
      const active = document.activeElement
      const focused =
        active instanceof HTMLElement ? active.closest<HTMLElement>("[data-row-id]")?.dataset.rowId : undefined
      // In the order on screen, from the row that has focus or, after a click on "Next problem" (which took the
      // focus), from the row the last step went to. Stepping by row number skipped every section drawn above.
      const { sequence: steps } = latest.current
      const here = focused ?? stepped.current
      const at = here === undefined ? -1 : steps.findIndex((entry) => entry.rowId === here)
      const next = back ? (at === -1 ? steps[steps.length - 1] : (steps[at - 1] ?? steps[at])) : steps[at + 1]
      if (next === undefined) {
        // Past the last row of the kind on screen: down the work list to the next kind with rows left.
        if (!back && latest.current.activeKind !== undefined) {
          wanted.current = { rowId: undefined, advance: true }
          setTick((tick) => tick + 1)
        } else if (steps[at] !== undefined) focusRow(steps[at].rowId)
        return
      }
      stepped.current = next.rowId
      if (next.kindId === undefined) {
        focusRow(next.rowId)
        return
      }
      // The row is under a folded heading: open it, and take the focus there once it is drawn.
      const kindId = next.kindId
      wanted.current = { rowId: next.rowId, among: { ids: next.among ?? [next.rowId], last: back } }
      setFolded((before) => flip(before, kindId))
    },
    [focusRow]
  )

  useEffect(() => {
    if (readOnly) return
    const onKey = (event: KeyboardEvent) => {
      // Inside a text field the browser's own undo applies.
      if (event.defaultPrevented || isTyping(event.target)) return
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
      if (event.ctrlKey || event.metaKey || event.altKey || latest.current.narrow) return
      if (event.key === "j" || event.key === "J") step(false)
      else if (event.key === "k" || event.key === "K") step(true)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [readOnly, run, step])

  const chooseFilter = (next: FilterId) => {
    setPicked(next)
    setKind(undefined)
  }
  // A kind picked on the work list: the table shows it; focus stays on the list, where the arrow keys go on.
  const pickKind = (kindId: string) => {
    setPicked("needs")
    setKind(kindId)
  }
  const pressMain = () => {
    if (!main.blocked) {
      if (counts.needs + counts.cannot + counts.out > 0) setConfirmOpen(true)
      else props.onImport(result({ views, problemKinds, words }))
      return
    }
    // Never offered as a press: an idle button is disabled, and a finished review shows words instead.
    if ("idle" in main || "done" in main) return
    if (main.columnId !== undefined) {
      // On a desk the choice is in the column's own header; on a phone it is in the columns sheet.
      const select = document.getElementById(`review-match-${main.columnId}`)
      if (select !== null) select.focus()
      else props.onShowMatching?.()
      return
    }
    step(false)
  }
  // The confirm step is opened by the import button without being its trigger, so it hands focus back itself.
  const backToImport = (event: Event) => {
    event.preventDefault()
    importButton.current?.focus()
  }
  // From the confirm step, straight to the rows an outcome is made of.
  const lookAt = (next: FilterId) => {
    setConfirmOpen(false)
    chooseFilter(next)
  }
  const confirm = () => {
    setConfirmOpen(false)
    props.onImport(result({ views, problemKinds, words }))
  }

  const noun = props.noun[1]
  // The tabs say the caller's words (`words`), and the table's caption follows them.
  const activeLabel = work.find((item) => item.kind.id === activeKind)?.kind.label
  const caption = `${props.title}: ${(filter === "auto" ? words.auto : words[filter]).toLowerCase()}${activeLabel === undefined ? "" : `, ${activeLabel}`}, ${whole.format(ordered.length)} ${ordered.length === 1 ? props.noun[0] : noun}`
  const filters: ReadonlyArray<{ id: FilterId; label: string; n: number }> = [
    { id: "needs", label: words.needs, n: counts.needs },
    // Rows nothing here can fix are not decisions: they have their own tab, shown while there are any.
    ...(counts.cannot > 0 || filter === "cannot"
      ? [{ id: "cannot" as const, label: words.cannot, n: counts.cannot }]
      : []),
    { id: "ready", label: words.ready, n: counts.ready },
    ...(counts.out > 0 || filter === "out" ? [{ id: "out" as const, label: words.out, n: counts.out }] : []),
    // Rows already in the system have their own tab while there are any, so the tabs add up to All.
    ...(counts.stored > 0 || filter === "stored"
      ? [{ id: "stored" as const, label: words.stored, n: counts.stored }]
      : []),
    { id: "all", label: words.all, n: counts.total }
  ]
  const lastStep = state.undo[state.undo.length - 1]
  const nextRedo = state.redo?.[state.redo.length - 1]
  const held = counts.needs + counts.cannot + counts.out + counts.stored
  // The work list sits beside the table on a desk, as a row of chips above it on a tablet; only while deciding.
  const listMode: "rail" | "chips" | undefined =
    narrow || filter !== "needs" || work.length === 0 ? undefined : layout === "wide" ? "rail" : "chips"
  // The table's room: the page's, less the card's margins and border, and the rail beside it.
  const gridRoom = room - (room < 640 ? 32 : 48) - 2 - (listMode === "rail" ? railWidth : 0)

  const showAll = (
    <Button variant="link" size="sm" onClick={() => chooseFilter("all")}>
      Show all {whole.format(counts.total)}
    </Button>
  )
  const empty: ReactNode =
    props.rows.length === 0 ? (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No rows in this file</EmptyTitle>
          <EmptyDescription>The file has a header and nothing under it.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{props.emptyAction}</EmptyContent>
      </Empty>
    ) : (
      <span className="inline-flex items-center gap-1">
        {filter === "needs" && search === ""
          ? counts.needs > 0 && activeLabel !== undefined
            ? `Nothing left under ${activeLabel}.`
            : "Nothing left to decide."
          : `No ${noun} here.`}
        {filter === "needs" && counts.needs > 0 && search === "" ? (
          <Button variant="link" size="sm" onClick={() => step(false)}>
            Next problem
          </Button>
        ) : (
          showAll
        )}
      </span>
    )

  // Undo and redo, each saying the step it would take back or bring back, and its keys. With nothing to do they stay
  // in place, dimmed, and say so.
  const undoButton = readOnly ? null : (
    <>
      <ToolButton
        label={lastStep === undefined ? "Undo" : `Undo: ${lastStep.label}`}
        tip={lastStep === undefined ? "Nothing to undo" : `Undo: ${lastStep.label.toLowerCase()} (${undoKeys})`}
        narrow={narrow}
        disabled={lastStep === undefined}
        onClick={() => run(Action.Undo())}
      >
        <Undo2Icon aria-hidden />
      </ToolButton>
      <ToolButton
        label={nextRedo === undefined ? "Redo" : `Redo: ${nextRedo.label}`}
        tip={nextRedo === undefined ? "Nothing to redo" : `Redo: ${nextRedo.label.toLowerCase()} (${redoKeys})`}
        narrow={narrow}
        disabled={nextRedo === undefined}
        onClick={() => run(Action.Redo())}
      >
        <Redo2Icon aria-hidden />
      </ToolButton>
    </>
  )

  const filterGroup = (
    <ToggleGroup
      type="single"
      variant="outline"
      size={narrow ? "lg" : "sm"}
      aria-label="Show"
      value={filter === "auto" ? "" : filter}
      onValueChange={(next) => {
        if (next !== "") chooseFilter(next as FilterId)
      }}
      // On a phone the tabs stand apart and wrap onto a second line: every one is on screen, none past its edge.
      {...(narrow ? { spacing: 1, className: "w-full flex-wrap" } : {})}
    >
      {filters.map((entry) =>
        narrow ? (
          // On a phone the count goes under its words. A tab is never narrower than its words ("Needs a decision"
          // is read whole); the tabs of a line share its width.
          <ToggleGroupItem key={entry.id} value={entry.id} className="h-11 min-w-fit flex-1">
            <span className="flex flex-col items-center">
              <span className="leading-4 whitespace-nowrap">{entry.label}</span>
              <span className="text-xs leading-4 text-muted-foreground tabular-nums">{whole.format(entry.n)}</span>
            </span>
          </ToggleGroupItem>
        ) : (
          <ToggleGroupItem key={entry.id} value={entry.id}>
            {entry.label}
            <span className="text-muted-foreground tabular-nums">{whole.format(entry.n)}</span>
          </ToggleGroupItem>
        )
      )}
    </ToggleGroup>
  )

  // Which columns show: the data table's own column toggle, on the review's one table instance. Which file column
  // fed each field is the Match step's to say: the button beside it goes there, amber while a field has no column.
  const unmatched = columns.filter((column) => column.match?.state === "unmatched").length
  const matchButton =
    props.onShowMatching === undefined ? null : (
      <ToolButton
        label={
          unmatched > 0
            ? `Matched columns: ${unmatched} ${unmatched === 1 ? "column" : "columns"} to match`
            : "Matched columns"
        }
        tip={unmatched > 0 ? `${unmatched} to match: open the matched columns` : "Which file column fills each field"}
        variant={unmatched > 0 ? "attention" : "ghost"}
        narrow={narrow}
        onClick={props.onShowMatching}
      >
        <Columns3Icon aria-hidden />
      </ToolButton>
    )
  const columnsMenu = (
    <>
      {narrow ? null : <DataTableViewOptions table={table} align="end" />}
      {matchButton}
    </>
  )

  // The data table's own filter, one per facet, with the review's filter state behind it: the component reads and
  // sets a column's filter value, so it is handed those two over `facetPicked` (the effect above then filters).
  const filterMenu =
    facets.length === 0 ? null : (
      <>
        {facets.map((facet) => (
          <DataTableFacetedFilter
            key={facet.column.id}
            column={
              {
                id: facet.column.id,
                table,
                columnDef: { meta: { label: facet.column.label } },
                getFilterValue: () => facet.picked,
                setFilterValue: (next: unknown) =>
                  setFacetPicked((before) => ({
                    ...before,
                    [facet.column.id]: Array.isArray(next) ? (next as ReadonlyArray<string>) : []
                  }))
              } as unknown as Column<DataTableFeatures, RowView, string>
            }
            title={facet.column.label}
            options={facet.options.map((option) => ({ label: option.label, value: option.key, count: option.n }))}
            multiple
          />
        ))}
      </>
    )

  const densityMenu = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Row height: ${density}`}>
              {density === "compact" ? <Rows3Icon aria-hidden /> : <Rows2Icon aria-hidden />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Row height</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={density} onValueChange={(next) => chooseDensity(next as Density)}>
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // The rows that will not be imported, as a file with a reason on each line; nothing to download while none is held.
  const heldFile = `data:text/csv;charset=utf-8,${encodeURIComponent(heldCsv({ views, columns, problemKinds, words }))}`
  const heldWords = `Download the ${whole.format(held)} ${held === 1 ? "row" : "rows"} not imported (CSV)`
  const download =
    held === 0 ? (
      <ToolButton label="Download the rows not imported" tip="Every row will be imported" narrow={narrow} disabled>
        <DownloadIcon aria-hidden />
      </ToolButton>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size={narrow ? "icon-touch" : "icon-sm"} asChild>
            <a download="not-imported.csv" href={heldFile} aria-label={heldWords}>
              <DownloadIcon aria-hidden />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{heldWords}</TooltipContent>
      </Tooltip>
    )

  // "Why flagged?": every reason of every flagged row on screen, in the caller's words, in a side panel.
  const flaggedOnScreen = ordered
    .filter((view) => view.status === "needs" || view.status === "cannot")
    .map((view) => view.row)
  const whyButton =
    props.explain === undefined || loading ? null : (
      <ToolButton
        label="Why flagged?"
        tip={`Why flagged: every reason for the ${flaggedOnScreen.length} flagged ${flaggedOnScreen.length === 1 ? "row" : "rows"} on screen`}
        narrow={narrow}
        onClick={() => setWhyOpen(true)}
      >
        <CircleHelpIcon aria-hidden />
      </ToolButton>
    )
  const whyPanel =
    props.explain === undefined ? null : (
      <Sheet open={whyOpen} onOpenChange={setWhyOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Why flagged?</SheetTitle>
            <SheetDescription>
              {flaggedOnScreen.length === 0
                ? "No row on screen is flagged. Choose another view, or clear the search."
                : `The ${flaggedOnScreen.length} flagged ${flaggedOnScreen.length === 1 ? "row" : "rows"} on screen, each with every reason. Narrow the view or search to ask about fewer.`}
            </SheetDescription>
          </SheetHeader>
          {whyOpen && flaggedOnScreen.length > 0 ? (
            <div className="px-4 pb-6">{props.explain(flaggedOnScreen)}</div>
          ) : null}
        </SheetContent>
      </Sheet>
    )

  const activityButton =
    props.activity === undefined ? null : (
      <ToolButton
        ref={activityReturn}
        label="Activity"
        tip="Activity: what the review did before you saw it"
        narrow={narrow}
        onClick={() => setActivityOpen(true)}
      >
        <HistoryIcon aria-hidden />
      </ToolButton>
    )

  // Every row that is not imported, the ones already there too: the same number the confirm and the download say.
  const skipped = held
  const importLabel =
    props.importing === true
      ? `Importing ${whole.format(counts.ready)}`
      : counts.ready > 0 && skipped > 0 && !main.blocked
        ? `Import ${whole.format(counts.ready)}, skip ${whole.format(skipped)}`
        : main.label
  // With nothing to import and nothing to decide there is no button to press: the words say so, and the caller's
  // next step (`emptyAction`, "Choose another file") stands beside them.
  const finished = main.blocked && "done" in main
  const idle = main.blocked && "idle" in main
  const importButtonNode =
    readOnly || loading || props.rows.length === 0 || embedded ? null : finished ? (
      // On a phone the words take two lines rather than push the next step past the screen's edge.
      <span className="flex min-w-0 items-center gap-2">
        <span role="status" className="min-w-0 text-sm leading-tight font-medium">
          {main.label}
        </span>
        <span className="flex flex-none">{props.emptyAction}</span>
      </span>
    ) : (
      <Button
        ref={importButton}
        variant={waits || idle ? "outline" : "default"}
        size={narrow ? "touch" : "sm"}
        className={confirmOpen ? "invisible flex-none" : "flex-none"}
        disabled={props.importing === true || idle}
        onClick={pressMain}
      >
        {/* The same words on every tab: only the button's weight says whether a decision waits. While the caller
            writes the import, the button says so: what is written is the server's to decide. */}
        {props.importing === true ? <Spinner /> : null}
        {importLabel}
      </Button>
    )

  // The one line under the title: what the run found, and the rules' own fixes when they arrived applied.
  const facts = props.summary.length > 0 ? props.summary : [`${whole.format(counts.total)} rows`]
  const titleLine = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
      <span className="min-w-0">{facts.join(" · ")}</span>
      {counts.applied === 0 ? null : (
        <Button
          variant="quiet"
          size={narrow ? "touch" : "xs"}
          aria-pressed={filter === "auto"}
          onClick={() => chooseFilter(filter === "auto" ? (opened.current?.filter ?? "needs") : "auto")}
        >
          <CheckIcon aria-hidden />
          {whole.format(counts.applied)} auto-fixed
        </Button>
      )}
      {readOnly || loading ? null : props.summaryAction}
    </div>
  )

  // The footer's counts: what will not be imported, what is already there, and the caller's sums.
  const tally = loading
    ? ""
    : readOnly && props.readOnlyNote !== undefined
      ? props.readOnlyNote
      : embedded
        ? ""
        : [
            heldLine(counts, words),
            // The caller's sums are of the rows it will import, so they are said as that.
            // With nothing to import there is nothing to add up.
            ...(props.totals === undefined || props.totals.length === 0 || counts.ready === 0
              ? []
              : [
                  `${whole.format(counts.ready)} to import: ${props.totals.map((total) => `${total.label} ${total.value}`).join(", ")}`
                ])
          ]
            .filter((part) => part !== "")
            .join(" · ")

  // The confirm step's body: what the import carries, by how each row got ready, and the rows it leaves behind as a file.
  const summary = confirmOpen ? (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["needs", counts.needs],
            ["cannot", counts.cannot],
            ["out", counts.out],
            ["stored", counts.stored],
            ["ready", counts.ready]
          ] as const
        ).map(([id, n]) =>
          n === 0 ? null : (
            <Button key={id} variant="outline" size={narrow ? "touch" : "sm"} onClick={() => lookAt(id)}>
              Show {words[id]} {whole.format(n)}
            </Button>
          )
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {importSummary(views).map((line) => (
          <li key={line.label} className="flex justify-between gap-6">
            <span className="text-muted-foreground">{line.label}</span>
            <span className="tabular-nums">{whole.format(line.count)}</span>
          </li>
        ))}
      </ul>
      <Button variant="outline" size={narrow ? "touch" : "sm"} asChild>
        <a download="not-imported.csv" href={heldFile}>
          <DownloadIcon aria-hidden />
          {heldWords}
        </a>
      </Button>
    </div>
  ) : null

  const searchField = (
    <InputGroup className={layout === "wide" ? "h-8 w-56" : "h-8 max-w-72 min-w-0 flex-1"}>
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={`Search ${noun}`}
        placeholder="Search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          table.setGlobalFilter(event.target.value)
        }}
      />
    </InputGroup>
  )

  const heading = embedded ? (
    <h2 id={titleId} className="min-w-0 truncate text-base font-semibold tracking-tight">
      {props.title}
    </h2>
  ) : (
    <h1 id={titleId} className="min-w-0 truncate text-xl font-semibold tracking-tight">
      {props.title}
    </h1>
  )

  const failure = (
    <div className="p-4">
      <Alert variant="destructive" className="max-w-xl">
        <AlertTitle>The review could not be prepared</AlertTitle>
        <AlertDescription>{props.error ?? "Try again, or choose the file again."}</AlertDescription>
      </Alert>
      {props.onRetry === undefined ? null : (
        <Button variant="outline" size={narrow ? "touch" : "sm"} className="mt-3" onClick={props.onRetry}>
          Try again
        </Button>
      )}
    </div>
  )

  const tableNode = (
    <Subscribe source={table.atoms.columnVisibility} selector={(visibility) => visibility}>
      {(visibility) => {
        // The table is worked out from the columns the person is showing. A column they turned on themselves
        // (`true`: off is `false`, untouched is absent) never moves into the row's detail: they asked to see it,
        // so the table scrolls sideways before it goes.
        const turnedOn = Object.keys(visibility).filter((id) => visibility[id] === true)
        return (
          <ReviewGrid
            entries={lines}
            table={table}
            columns={columns.filter((column) => visibility[column.id] !== false)}
            allColumns={columns}
            views={list}
            room={gridRoom}
            framed
            showStatus={showStatus}
            keep={HashSet.union(HashSet.fromIterable(turnedOn), subjects)}
            density={density}
            words={words}
            excluded={excluded}
            // Not while the confirm step is open: its own button is then the screen's filled one.
            canLead={!readOnly && filter === "needs" && !confirmOpen}
            onLead={setLeadInView}
            kinds={kinds}
            actions={actions}
            groupActions={groupActions}
            readOnly={readOnly}
            loading={loading}
            caption={caption}
            empty={empty}
            onMatch={readOnly ? undefined : props.onMatchColumn}
            handle={grid}
            rowAction={props.rowAction}
            cellEditor={props.cellEditor}
            actionsWidth={actionsWidth}
          />
        )
      }}
    </Subscribe>
  )

  const confirmStep = narrow ? (
    <Suspense fallback={null}>
      <PhoneDrawer
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onCloseAutoFocus={backToImport}
        title={`${main.label}?`}
        description={`${confirmLine({ counts, noun: props.noun, words })} ${props.importNote ?? ""}`}
        footer={
          <>
            <Button size="touch" onClick={confirm}>
              {main.label}
            </Button>
            <Button variant="outline" size="touch" onClick={() => setConfirmOpen(false)}>
              Keep reviewing
            </Button>
          </>
        }
      >
        <div className="px-4">{summary}</div>
      </PhoneDrawer>
    </Suspense>
  ) : (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent onCloseAutoFocus={backToImport}>
        <AlertDialogHeader>
          <AlertDialogTitle>{main.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmLine({ counts, noun: props.noun, words })} {props.importNote}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {summary}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>{main.label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  const activityPanel =
    props.activity === undefined ? null : (
      <ActivityPanel
        activity={props.activity}
        returnFocus={activityReturn}
        open={activityOpen}
        onOpenChange={setActivityOpen}
        narrow={narrow}
      />
    )

  if (narrow) {
    return (
      <LayoutContext value={layout}>
        <section ref={root} aria-labelledby={titleId} className="flex h-full min-h-0 flex-col">
          <div className="flex flex-none items-center gap-1 px-4 pt-2 pb-1">
            <div className="min-w-0 flex-1">{heading}</div>
            {loading || failed ? null : columnsMenu}
            {whyButton}
            {activityButton}
          </div>
          {failed ? (
            failure
          ) : (
            <>
              <div className="flex-none px-4 pb-2">{loading ? <Skeleton className="h-11 w-full" /> : filterGroup}</div>
              <ReviewQueue
                views={views}
                list={list}
                deciding={filter === "needs" || (filter === "cannot" && counts.blocked > 0)}
                blocked={filter === "cannot"}
                excluded={excluded}
                columns={columns}
                kinds={kinds}
                actions={actions}
                groupActions={groupActions}
                progress={
                  filter === "cannot"
                    ? { total: counts.blocked, left: counts.blocked }
                    : { total: opened.current?.decisions ?? left, left }
                }
                split={split}
                onSplit={(groupId) => setSplit((before) => HashSet.add(before, groupId))}
                words={words}
                undo={undoButton}
                readOnly={readOnly}
                loading={loading}
                caption={caption}
                empty={empty}
                rowAction={props.rowAction}
                cellEditor={props.cellEditor}
              />
              <div className="flex h-16 flex-none items-center gap-2 px-4">
                <p
                  role="status"
                  // A finished review's words need the line: the counts are then read out only.
                  className={
                    waits || finished
                      ? "sr-only"
                      : "line-clamp-2 min-w-0 flex-1 text-sm leading-tight text-muted-foreground tabular-nums"
                  }
                >
                  {tally}
                </p>
                {finished ? null : <span className="flex-1" />}
                <span role="status" className="sr-only">
                  {said}
                </span>
                {importButtonNode}
              </div>
            </>
          )}
          {activityPanel}
          {whyPanel}
          {confirmStep}
        </section>
      </LayoutContext>
    )
  }

  return (
    <LayoutContext value={layout}>
      <section ref={root} aria-labelledby={titleId} className="flex h-full min-h-0 flex-col">
        <div className="flex flex-none flex-col px-4 pt-3 pb-2 sm:px-6">
          {heading}
          {loading ? <Skeleton className="mt-1 h-4 w-48" /> : titleLine}
        </div>
        <div className="mx-4 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border sm:mx-6">
          {failed ? (
            failure
          ) : (
            <>
              {/* One toolbar. On a desk: the search, then the history and the table's tools at fixed places from the
                  left edge, then the views and the import at the right. A tab that comes or goes ("Left out") or an
                  import button whose count changes moves only what is right of the gap, never Undo, Redo or Columns
                  under the pointer. Short of room (a tablet) it takes two lines: the search and the import, then the
                  views and the tools, the tools at the line's right end. */}
              <div className="flex flex-none flex-wrap items-center gap-2 border-b px-3 py-1">
                {loading ? <Skeleton className="h-8 w-56" /> : searchField}
                {layout === "wide" ? (
                  <>
                    <div className="flex flex-none items-center gap-1">
                      {readOnly ? null : <Separator orientation="vertical" className="mx-1 h-6" />}
                      {undoButton}
                      <Separator orientation="vertical" className="mx-1 h-6" />
                      {loading ? null : columnsMenu}
                      {loading ? null : filterMenu}
                      {densityMenu}
                      {loading ? null : download}
                      {whyButton}
                      {activityButton}
                    </div>
                    <div className="ml-auto flex min-w-0 items-center gap-2">
                      {loading ? <Skeleton className="h-8 w-72" /> : filterGroup}
                      {importButtonNode === null ? null : <span className="flex">{importButtonNode}</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="ml-auto flex flex-none">{importButtonNode}</span>
                    <div className="flex w-full items-center gap-1">
                      {loading ? <Skeleton className="h-8 w-72" /> : filterGroup}
                      <span className="flex-1" />
                      <Separator orientation="vertical" className="mx-1 h-6" />
                      {undoButton}
                      {readOnly ? null : <Separator orientation="vertical" className="mx-1 h-6" />}
                      {loading ? null : columnsMenu}
                      {loading ? null : filterMenu}
                      {densityMenu}
                      {loading ? null : download}
                      {whyButton}
                      {activityButton}
                    </div>
                  </>
                )}
              </div>
              {listMode === "chips" ? (
                <WorkList items={work} active={activeKind} onPick={pickKind} mode="chips" />
              ) : null}
              <div className="flex min-h-0 flex-1">
                {listMode === "rail" ? (
                  <WorkList items={work} active={activeKind} onPick={pickKind} mode="rail" />
                ) : null}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">{tableNode}</div>
              </div>
              <div className="flex min-h-8 flex-none items-center gap-3 border-t px-3 py-1 text-sm">
                <p role="status" className="min-w-0 flex-1 text-muted-foreground tabular-nums">
                  {tally}
                </p>
                <span role="status" className="sr-only">
                  {said}
                </span>
                {readOnly || loading || counts.needs === 0 ? null : (
                  <>
                    <span className="flex-none text-muted-foreground tabular-nums">
                      {/* Rows, as the tab counts them: a group of the same fix settles several in one press. */}
                      {whole.format(counts.needs)} {counts.needs === 1 ? "row" : "rows"} to decide
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="flex-none"
                          onClick={() => {
                            if (filter !== "needs") chooseFilter("needs")
                            requestAnimationFrame(() => step(false))
                          }}
                        >
                          Next problem
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>J goes to the next row that needs a decision, K to the one before</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {activityPanel}
        {whyPanel}
        {confirmStep}
      </section>
    </LayoutContext>
  )
}
