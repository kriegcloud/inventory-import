import { ColumnMatch } from "@inventory/review/ReviewTypes"
import type { Column } from "@tanstack/react-table"
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
  Undo2Icon,
  XIcon
} from "lucide-react"
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import { useAtomMount, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react"
import * as Atom from "effect/reactivity/Atom"
import { lazy, type ReactNode, Suspense, useId, useRef } from "react"
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
import { contentBelow } from "@inventory/ui/ContentWidth"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@inventory/ui/components/sheet"
import { Skeleton } from "@inventory/ui/components/skeleton"
import { Spinner } from "@inventory/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@inventory/ui/components/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@inventory/ui/components/tooltip"
import { useDataTable } from "@inventory/ui/hooks/use-data-table"
import { saveCsv } from "@inventory/ui/SaveFile"
import { confirmLine, heldLine, importSummary, Primary, primary, result } from "@inventory/review/ReviewDraft"
import { regionLayout } from "./internal/parts.tsx"
import { GridScope, ReviewGrid } from "./internal/ReviewGrid.tsx"
import { ReviewQueue } from "./internal/ReviewQueue.tsx"
import { WorkList } from "./internal/WorkList.tsx"
import {
  type Density,
  density as keptDensity,
  type Region,
  type RegionInput,
  type RegionTable,
  RegionScope,
  type RegionUi,
  TableScope
} from "./ReviewRegion.atoms.ts"
import type { Activity, FilterId, ReviewRegionProps, RowView } from "@inventory/review/ReviewTypes"

// Each union's own guard, made once: these run for every row and every cell.
const isColumnMatchUnmatched = ColumnMatch.guards.unmatched
const isPrimaryImport = Primary.$is("Import")
const isPrimaryIdle = Primary.$is("Idle")
const isPrimaryDone = Primary.$is("Done")

// The phone's drawers (vaul) are their own chunk: fetched on a phone once the review is drawn, never on a desk.
const PhoneDrawer = lazy(() => import("./internal/PhoneDrawer.tsx").then((module) => ({ default: module.PhoneDrawer })))

const whole = new Intl.NumberFormat("en-US")
/** The keys for undo and redo as the person's keyboard says them: Command on a Mac, Ctrl elsewhere. */
const onMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
const undoKeys = onMac ? "\u2318Z" : "Ctrl+Z"
const redoKeys = onMac ? "\u21e7\u2318Z" : "Ctrl+Shift+Z"
const searchKeys = onMac ? "\u2318K" : "Ctrl+K"

/**
 * The page's own width (the sidebar already taken off) from which the toolbar is one line: the search's icon, the
 * history and the words beside Undo, the view's tools, the download, "Why flagged?", the views and Import. Measured
 * in Chrome on the messy sample (items_messy.csv: the four views with Cannot import, "Import 155, skip 45"): the
 * line's fixed parts take 1,397 px of the page with the card's margins, and the words beside Undo want 80 px or more
 * (two lines of small text). So from 1,490 px it is one line (a 1,541 px window with the sidebar folded); below, it
 * folds to two: the search, the history and Import, then the views and the tools.
 */
const oneLineFrom = 1490
/** How much wider the open search's field (`w-48`) is than its icon: an open search needs that much more. */
const searchFieldExtra = 160
/**
 * Folded, the views and the filters with words (View, Category, Unit of measure) share the second line from this
 * width of the page: measured on the messy sample, the views take 475 px and the filters 350, so with the card's
 * margins and the gaps they need 920 px. Below it the filters take a third line, at its right end.
 */
const filtersBesideViewsFrom = 920
const stepTag = { read: "Read", rule: "Rule", model: "Model" } as const
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

/** No keys while the region is only looking. */
const noKeys: Atom.Atom<void> = Atom.readable(() => undefined)

// What a caller that says nothing is taken to say, each an atom as the caller's own would be.
/** No rule to check a typed value with. */
const noRecheck: RegionInput["recheck"] = Atom.make(O.none())
/** No answer of the caller's own on a row. */
const noRowAction: RegionInput["rowAction"] = Atom.make(O.none())
/** The person may decide. */
const deciding: RegionInput["readOnly"] = Atom.make(false)
/** The rules' fixes are proposals. */
const proposes: RegionInput["ruleFixes"] = Atom.make<"propose" | "apply">("propose")
/** The region's own words. */
const ownWords: RegionInput["words"] = Atom.make({})

/** Where the rows that will not be imported are saved. */
const heldFileName = "not-imported.csv"

/**
 * The review step of an import as one region that fills its frame: counts that filter, the rows with each problem
 * and what each button would do about it, and one button that says what it will import. A table on a desk, a
 * shorter table on a tablet, one decision at a time on a phone. It decides nothing about the data: rows, columns,
 * problem words, proposals and the re-check all come from the caller, as atoms, and the decisions are the caller's
 * atom too: the region writes it with every action, and whoever keeps the decisions reads it there.
 */
export function ReviewRegion(props: ReviewRegionProps) {
  const id = useId()
  return (
    <RegionScope.Provider
      value={{
        rows: props.rows,
        columns: props.columns,
        recheck: props.recheck ?? noRecheck,
        decisions: props.decisions,
        problemKinds: props.problemKinds,
        ruleFixes: props.ruleFixes ?? proposes,
        words: props.words ?? ownWords,
        rowAction: props.rowAction ?? noRowAction,
        readOnly: props.readOnly ?? deciding,
        id
      }}
    >
      <RegionWithTable {...props} />
    </RegionScope.Provider>
  )
}

/** One table instance: sorting, hidden columns, faceted filters and search come from the data-table parts. */
function RegionWithTable(props: ReviewRegionProps) {
  const region = useAtomValue(RegionScope.use())
  const { table } = useDataTable({
    data: useAtomValue(region.tableData),
    columns: useAtomValue(region.columnDefs),
    mode: "client",
    initialState: useAtomValue(region.hiddenAtFirst),
    getRowId: (view) => view.row.id
  })
  return (
    <TableScope.Provider value={{ region, table }}>
      <RegionWithGrid {...props} region={region} table={table} />
    </TableScope.Provider>
  )
}

type WithTable = ReviewRegionProps & { region: Region; table: ReturnType<typeof useDataTable<RowView>>["table"] }

/** The grid's atoms are made here, above the region's body: its footer reads from them which group's accept leads. */
function RegionWithGrid(props: WithTable) {
  const regionTable = useAtomValue(TableScope.use())
  return (
    <GridScope.Provider value={{ region: props.region, table: regionTable }}>
      <RegionBody {...props} regionTable={regionTable} />
    </GridScope.Provider>
  )
}

function RegionBody(props: WithTable & { regionTable: RegionTable }) {
  const { region, table, regionTable } = props
  const grid = useAtomValue(GridScope.use())
  const layout = useAtomValue(regionLayout)
  const narrow = layout === "narrow"
  const titleId = useId()
  const loading = props.state === "loading"
  const failed = props.state === "error"
  const readOnly = useAtomValue(region.input.readOnly)
  const embedded = props.embedded === true
  useAtomMount(readOnly ? noKeys : regionTable.keys)
  useAtomMount(narrow ? noKeys : regionTable.searchKeys)
  // An open search takes its field's width more than its icon: the line needs that much more room to stay one.
  const roomy = !useAtomValue(contentBelow(oneLineFrom))
  const roomyWithField = !useAtomValue(contentBelow(oneLineFrom + searchFieldExtra))
  const filtersBeside = !useAtomValue(contentBelow(filtersBesideViewsFrom))
  const chips = useAtomValue(region.chips)
  // After a decision focus goes to the next row that needs one; after an undo, back to the row.
  useAtomSubscribe(regionTable.moves, regionTable.settleSoon)

  const own = useAtomValue(region.ui)
  const change = region.change
  const state = useAtomValue(region.input.decisions)
  const { activityOpen, whyOpen, confirmOpen, search, searchOpen, said } = own
  const setPicked = (next: FilterId | undefined) => change(() => ({ picked: next }))
  const setKind = (next: string | undefined) => change(() => ({ kind: next }))
  const setActivityOpen = (next: boolean) => change(() => ({ activityOpen: next }))
  const setWhyOpen = (next: boolean) => change(() => ({ whyOpen: next }))
  const setConfirmOpen = (next: boolean) => change(() => ({ confirmOpen: next }))
  const setSearch = (next: string) => change(() => ({ search: next }))
  const setSplit = (update: (before: HashSet.HashSet<string>) => HashSet.HashSet<string>) =>
    change((before) => ({ split: update(before.split) }))
  const setFacetPicked = (update: (before: RegionUi["facetPicked"]) => RegionUi["facetPicked"]) =>
    change((before) => ({ facetPicked: update(before.facetPicked) }))

  const problemKinds = useAtomValue(region.input.problemKinds)
  const rows = useAtomValue(region.input.rows)
  const columns = useAtomValue(region.input.columns)
  const words = useAtomValue(region.words)
  const views = useAtomValue(region.views)
  const counts = useAtomValue(region.counts)
  const left = useAtomValue(region.left)
  const openedOn = useAtomValue(region.opened)
  const opened = O.getOrUndefined(openedOn)
  const filter = useAtomValue(region.filter)
  const work = useAtomValue(region.work)
  const activeKind = useAtomValue(region.activeKind)
  const ordered = useAtomValue(regionTable.ordered)
  const facets = useAtomValue(region.facets)
  const leadInView = useAtomValue(grid.leadInView)
  const listMode = useAtomValue(region.listMode)
  // On the other tabs Import waits too while a decision is open: filled there, it invited skipping every row
  // that still needs the person.
  const waits = narrow
    ? filter === "needs" && counts.needs > 0
    : !readOnly && (filter === "needs" ? leadInView : counts.needs > 0)
  // Compact (36 px rows) or comfortable (44 px), remembered in this browser: a preference, not progress.
  const density = useAtomValue(keptDensity)
  const chooseDensity = useAtomSet(keptDensity)
  const main = primary({ columns, counts, noun: props.noun, closing: props.closingLabel, words })

  const importButton = useRef<HTMLButtonElement>(null)
  const activityReturn = useRef<HTMLButtonElement>(null)
  const searchButton = useRef<HTMLButtonElement>(null)
  const { run, step } = regionTable

  const chooseFilter = (next: FilterId) => {
    setPicked(next)
    setKind(undefined)
  }
  // A kind picked on the work list: the table shows it; focus stays on the list, where the arrow keys go on.
  const pickKind = (kindId: string) => {
    setPicked("needs")
    setKind(kindId)
  }
  const pressMain = () =>
    Primary.$match(main, {
      Import: () => {
        if (counts.needs + counts.cannot + counts.out > 0) setConfirmOpen(true)
        else props.onImport(result({ views, problemKinds, words }))
      },
      // Never offered as a press: an idle button is disabled, and a finished review shows words instead.
      Idle: () => undefined,
      Done: () => undefined,
      Blocked: ({ columnId }) => {
        // On a desk the choice is in the column's own header; on a phone it is in the columns sheet.
        const select = document.getElementById(`review-match-${columnId}`)
        if (select !== null) select.focus()
        else props.onShowMatching?.()
      }
    })
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
  const lastStep = A.last(state.undo)
  const nextRedo = A.last(state.redo)
  const held = counts.needs + counts.cannot + counts.out + counts.stored

  const showAll = (
    <Button variant="link" size="sm" onClick={() => chooseFilter("all")}>
      Show all {whole.format(counts.total)}
    </Button>
  )
  const empty: ReactNode =
    rows.length === 0 ? (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No rows in this file</EmptyTitle>
          <EmptyDescription>The file has a header and nothing under it.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{props.emptyAction}</EmptyContent>
      </Empty>
    ) : chips.length > 0 ? (
      // Narrowed by a search or a filter: that is why nothing shows, not that nothing is left.
      <span className="inline-flex items-center gap-1">
        No {noun} match{" "}
        {A.join(
          A.map(chips, (chip) => chip.label),
          ", "
        )}
        .
        <Button variant="link" size="sm" onClick={() => A.forEach(chips, region.clearChip)}>
          {words.clear} {chips.length === 1 ? "it" : "them"}
        </Button>
      </span>
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

  // What the last action did, in words beside Undo, which takes it back. Always in the page, so a screen reader hears
  // each new sentence (`aria-live` polite); never a toast over the table.
  const saidLine = (
    <span
      role="status"
      aria-live="polite"
      // Read whole, on as many short lines as it needs where the line is tight: never cut with an ellipsis.
      className="min-w-24 flex-1 text-xs leading-4 text-muted-foreground"
    >
      {said}
    </span>
  )

  // Undo and redo, each saying the step it would take back or bring back, and its keys. With nothing to do they stay
  // in place, dimmed, and say so.
  const undoButton = readOnly ? null : (
    <>
      <ToolButton
        label={O.match(lastStep, { onNone: () => "Undo", onSome: (step) => `Undo: ${step.label}` })}
        tip={O.match(lastStep, {
          onNone: () => "Nothing to undo",
          onSome: (step) => `Undo: ${step.label.toLowerCase()} (${undoKeys})`
        })}
        narrow={narrow}
        disabled={O.isNone(lastStep)}
        onClick={() => run({ type: "undo" as const })}
      >
        <Undo2Icon aria-hidden />
      </ToolButton>
      <ToolButton
        label={O.match(nextRedo, { onNone: () => "Redo", onSome: (step) => `Redo: ${step.label}` })}
        tip={O.match(nextRedo, {
          onNone: () => "Nothing to redo",
          onSome: (step) => `Redo: ${step.label.toLowerCase()} (${redoKeys})`
        })}
        narrow={narrow}
        disabled={O.isNone(nextRedo)}
        onClick={() => run({ type: "redo" as const })}
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
  const unmatched = columns.filter((column) => isColumnMatchUnmatched(column.match)).length
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

  // The data table's own filter control, one per facet, with the review's filter state behind it: the component
  // reads and sets a column's filter value, so it is handed those two over `facetPicked`. The rows are filtered by the
  // region's own atom (`shown`), not by the table.
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

  // The rows that will not be imported, as a file with a reason on each line: written out when the person asks for
  // it, never while they decide. Nothing to download while none is held.
  const saveHeld = () => saveCsv(heldFileName, region.notImported())
  const heldWords = `Download the ${whole.format(held)} ${held === 1 ? "row" : "rows"} not imported (CSV)`
  const download =
    held === 0 ? (
      <ToolButton label="Download the rows not imported" tip="Every row will be imported" narrow={narrow} disabled>
        <DownloadIcon aria-hidden />
      </ToolButton>
    ) : (
      <ToolButton label={heldWords} narrow={narrow} onClick={saveHeld}>
        <DownloadIcon aria-hidden />
      </ToolButton>
    )

  // "Why flagged?": every reason of every flagged row on screen, in the caller's words, in a side panel.
  const flaggedOnScreen = useAtomValue(regionTable.flagged)
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
      : counts.ready > 0 && skipped > 0 && isPrimaryImport(main)
        ? `Import ${whole.format(counts.ready)}, skip ${whole.format(skipped)}`
        : main.label
  // With nothing to import and nothing to decide there is no button to press: the words say so, and the caller's
  // next step (`emptyAction`, "Choose another file") stands beside them.
  const finished = isPrimaryDone(main)
  const idle = isPrimaryIdle(main)
  const importButtonNode =
    readOnly || loading || rows.length === 0 || embedded ? null : finished ? (
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
        data-import-button=""
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
          onClick={() => chooseFilter(filter === "auto" ? (opened?.filter ?? "needs") : "auto")}
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
      <Button variant="outline" size={narrow ? "touch" : "sm"} onClick={saveHeld}>
        <DownloadIcon aria-hidden />
        {heldWords}
      </Button>
    </div>
  ) : null

  // The search: an icon until it is opened (a click, "/" or Ctrl+K), then the field. It stays open while it holds
  // text, and Escape on an empty field closes it and hands the focus back to the icon. The table follows the region's
  // search (`RegionTable`), so the field writes only that.
  const searchShown = searchOpen || search !== ""
  const oneLine = searchShown ? roomyWithField : roomy
  const closeSearch = () => {
    change(() => ({ searchOpen: false }))
    requestAnimationFrame(() => searchButton.current?.focus())
  }
  const searchField = searchShown ? (
    <InputGroup className={oneLine ? "h-8 w-48 flex-none" : "h-8 max-w-72 min-w-0 flex-1"}>
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        id={regionTable.searchFieldId}
        type="search"
        aria-label={`${words.search} ${noun}`}
        placeholder={words.search}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          // With text the field stays as it is (its chip clears it); empty, it closes.
          event.preventDefault()
          if (search === "") closeSearch()
        }}
        onBlur={() => {
          if (search === "") change(() => ({ searchOpen: false }))
        }}
      />
    </InputGroup>
  ) : (
    <ToolButton
      ref={searchButton}
      label={`${words.search} ${noun}`}
      tip={`${words.search} ${noun} (/ or ${searchKeys})`}
      narrow={false}
      onClick={regionTable.openSearch}
    >
      <SearchIcon aria-hidden />
    </ToolButton>
  )

  // What narrows the table, each a chip with a cross: worked out from the same atoms the search and the filters write.
  const chipLine =
    chips.length === 0 ? null : (
      <div className="flex flex-none flex-wrap items-center gap-1.5 border-b px-3 py-1.5">
        {A.map(chips, (chip) => (
          <Button
            key={chip.label}
            variant="outline"
            size="xs"
            onClick={() => {
              region.clearChip(chip)
              // The chip goes with what it said: the focus goes to the search's icon, or to the table.
              requestAnimationFrame(() =>
                (
                  searchButton.current ??
                  document.querySelector<HTMLElement>(
                    `[data-review-region="${region.id}"] [data-slot="sticky-table-frame"]`
                  )
                )?.focus()
              )
            }}
          >
            <span className="sr-only">{words.clear} </span>
            {chip.label}
            <XIcon aria-hidden />
          </Button>
        ))}
      </div>
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
    <ReviewGrid
      table={table}
      framed
      loading={loading}
      caption={caption}
      empty={empty}
      onMatch={readOnly ? undefined : props.onMatchColumn}
      cellEditor={props.cellEditor}
    />
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

  // The toolbar's groups, each in one place, by what it is about.
  const historyGroup = (
    <span className="flex flex-none items-center gap-1">
      {activityButton}
      {undoButton}
    </span>
  )
  // The view's tools: its icons (matched columns, row height) and its filters with words (View, Category, Unit of
  // measure). On one line they stand together; folded, the icons stay up with the history and the filters go down
  // beside the views, the line with room for their words.
  const viewIcons = (
    <span className="flex flex-none items-center gap-1">
      {matchButton}
      {densityMenu}
    </span>
  )
  const viewFilters = (
    <span className="flex flex-none items-center gap-1">
      <DataTableViewOptions table={table} align="end" />
      {filterMenu}
    </span>
  )
  const fileTools = (
    <>
      <Separator orientation="vertical" className="mx-1 h-6" />
      {download}
      {whyButton}
    </>
  )
  const toolGroups = loading ? null : (
    <>
      <Separator orientation="vertical" className="mx-1 h-6" />
      {viewIcons}
      {viewFilters}
      {fileTools}
    </>
  )
  const foldedTools = loading ? null : (
    <>
      <Separator orientation="vertical" className="mx-1 h-6" />
      {viewIcons}
      {fileTools}
    </>
  )
  const importNode = importButtonNode === null ? null : <span className="flex flex-none">{importButtonNode}</span>

  // The footer's counts as parts the line may fold between, never inside: what will not be imported, then each of the
  // caller's sums. The same words as `tally`.
  const tallyParts: ReadonlyArray<{ readonly text: string; readonly before: string }> =
    loading || embedded || (readOnly && props.readOnlyNote !== undefined)
      ? tally === ""
        ? []
        : [{ text: tally, before: "" }]
      : [
          ...(heldLine(counts, words) === "" ? [] : [{ text: heldLine(counts, words), before: "" }]),
          ...(props.totals === undefined || counts.ready === 0
            ? []
            : A.map(props.totals, (total, at) => ({
                text:
                  at === 0
                    ? `${whole.format(counts.ready)} to import: ${total.label} ${total.value}`
                    : `${total.label} ${total.value}`,
                before: at === 0 ? " · " : ", "
              })))
        ]

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
      <>
        <section
          ref={region.attach}
          data-review-region={region.id}
          aria-labelledby={titleId}
          className="flex h-full min-h-0 flex-col"
        >
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
                deciding={filter === "needs" || (filter === "cannot" && counts.blocked > 0)}
                blocked={filter === "cannot"}
                progress={
                  filter === "cannot"
                    ? { total: counts.blocked, left: counts.blocked }
                    : { total: O.match(openedOn, { onNone: () => left, onSome: (on) => on.decisions }), left }
                }
                onSplit={(groupId) => setSplit((before) => HashSet.add(before, groupId))}
                undo={undoButton}
                loading={loading}
                caption={caption}
                empty={empty}
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
      </>
    )
  }

  return (
    <>
      <section
        ref={region.attach}
        data-review-region={region.id}
        aria-labelledby={titleId}
        className="flex h-full min-h-0 flex-col"
      >
        <div className="flex flex-none flex-col px-4 pt-3 pb-2 sm:px-6">
          {heading}
          {loading ? <Skeleton className="mt-1 h-4 w-48" /> : titleLine}
        </div>
        <div className="mx-4 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border sm:mx-6">
          {failed ? (
            failure
          ) : (
            <>
              {/* One toolbar, its icons grouped by what they are about: the search; the history (Activity, Undo,
                  Redo) with the words of the last action beside Undo and Redo; the view (matched columns, row height, the
                  columns shown, the filters); the download; "Why flagged?"; then the views and Import, the one filled
                  button, at the right end. The words beside Undo take the line's slack, so a new sentence moves
                  nothing under the pointer. With less room than the page's area has from `oneLineFrom` it folds,
                  never inside a group: the search, the history, the view's icons, the download, "Why flagged?" and
                  Import; then the views, and the filters at that line's right end (below `filtersBesideViewsFrom`
                  they take a third line of their own). */}
              <div className="flex flex-none flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-1">
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  {loading ? <Skeleton className="h-8 w-8" /> : searchField}
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  {historyGroup}
                  {saidLine}
                  {oneLine ? toolGroups : foldedTools}
                  {oneLine ? null : importNode}
                </div>
                {oneLine ? (
                  <div className="flex flex-none items-center gap-2">
                    {loading ? <Skeleton className="h-8 w-72" /> : filterGroup}
                    {importNode}
                  </div>
                ) : (
                  <>
                    <div className="flex w-full min-w-0 items-center gap-2">
                      {loading ? <Skeleton className="h-8 w-72" /> : filterGroup}
                      {loading || !filtersBeside ? null : <span className="ml-auto flex flex-none">{viewFilters}</span>}
                    </div>
                    {loading || filtersBeside ? null : <div className="flex w-full justify-end">{viewFilters}</div>}
                  </>
                )}
              </div>
              {chipLine}
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
                {/* Folded only between totals, never inside one ("L 8,804" stays whole). */}
                <p role="status" className="min-w-0 flex-1 text-muted-foreground tabular-nums">
                  {A.map(tallyParts, (part, at) => (
                    <span key={part.text}>
                      {at === 0 ? null : part.before}
                      <span className="whitespace-nowrap">{part.text}</span>
                    </span>
                  ))}
                </p>
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
    </>
  )
}
