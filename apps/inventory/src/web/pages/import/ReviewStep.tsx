import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Equal, Option } from "effect"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ReviewSkeleton } from "@inventory/ui/Skeletons"
import { ReviewRegion } from "@inventory/review/ReviewRegion"
import type { Activity, Problem, ReviewRow } from "@inventory/review/ReviewTypes"
import { Button } from "@inventory/ui/components/button"
import { Spinner } from "@inventory/ui/components/spinner"
import { useActor } from "@/lib/actor"
import { call } from "@/lib/api"
import { useDecisionSaver } from "@/lib/draft"
import { importViewQuery, useImportCache } from "@/lib/imports"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "@/lib/route"
import { restoredDecisions, storedReview } from "@inventory/review/SavedProgress"
import { useSavedProgress } from "@inventory/review/SavedProgressHook"
import type { SavedDecisions as RegionDecisions } from "@inventory/review/ReviewTypes"
import { browserRuntime } from "@/lib/runtime"
import type { ImportView, SuggestOutcome } from "../../../api/v1/Api.ts"
import {
  type Field,
  fieldLabels,
  fields,
  recheckRow,
  review,
  rowId,
  ruleFixes,
  type SavedDecisions,
  type StagedTable
} from "../../../domain/ItemImport.ts"
import { WhyFlagged } from "./WhyFlagged.tsx"
import { DimensionsForm, VendorsForm } from "./CellForms.tsx"
import { notImportedColumn, reviewStepWords } from "./format.tsx"
import { totalText } from "./itemText.ts"
import {
  regionColumns,
  regionKinds,
  storedChoice,
  toRegionDecisions,
  toRegionProblem,
  toRegionRows,
  toServerDecisions
} from "./reviewAdapter.ts"
import { toastError } from "@/lib/errors"
import { queryKeys } from "@/lib/queries"

const whole = new Intl.NumberFormat("en-US")

/**
 * False for the first frame, then true. Working out a review of 50,000 rows takes the browser most of a second in
 * one go; drawing the skeleton first means the person sees what is coming instead of the last screen standing still.
 */
function usePainted() {
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    let timer = 0
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setPainted(true))
    })
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [])
  return painted
}

/** The two cells that hold JSON are fixed in a form of their own, not as raw text in one box. */
const cellEditor = (input: { row: ReviewRow; column: string; value: string }) =>
  input.column === "dimensions"
    ? {
        label: "Fix dimensions",
        title: `Dimensions, row ${input.row.label ?? input.row.line}`,
        render: (save: (value: string) => void) => <DimensionsForm value={input.value} onSave={save} />
      }
    : input.column === "vendors"
      ? {
          label: "Fix vendors",
          title: `Vendors, row ${input.row.label ?? input.row.line}`,
          render: (save: (value: string) => void) => <VendorsForm value={input.value} onSave={save} />
        }
      : undefined

/**
 * The review: every row that needs the person, what the rules propose for it, and one button that says what it
 * will import. The rows and proposals come from the same pure review the server runs at the confirm.
 */
export function ReviewStep(props: { view: ImportView; table: StagedTable; canImport: boolean }) {
  const painted = usePainted()
  return painted ? <ReviewBody {...props} /> : <ReviewSkeleton title={`Review ${props.view.fileName}`} />
}

function ReviewBody(props: { view: ImportView; table: StagedTable; canImport: boolean }) {
  const { view, table } = props
  const cache = useImportCache()
  const queryClient = useQueryClient()
  const input = useMemo(
    () => ({
      table,
      choices: view.choices,
      storedItems: view.storedItems,
      // A server that sends only the row numbers: each row is then one item.
      createdIds: view.createdIds ?? view.createdRows.map((rowNumber) => rowId({ rowNumber })),
      // The stored suggestions, as the server reads them at the confirm: each is a proposal on its row.
      suggestions: view.suggestions
    }),
    [table, view.choices, view.storedItems, view.createdIds, view.createdRows, view.suggestions]
  )
  // The decisions are the server's; the undo history behind them is kept in this browser, per person and import, so
  // a refresh brings "Undo last step" back too. It is used only while it ends at the decisions the server holds: a
  // change made on another screen since starts a new history from the server's.
  const { actor } = useActor()
  const progress = useSavedProgress(
    actor === undefined
      ? undefined
      : { organizationId: actor.organizationId, memberId: actor.id, screen: `import:${view.id}` },
    browserRuntime
  )
  const kept = progress.saved === undefined ? null : Option.getOrNull(progress.saved.review)
  // Where the person starts: the draft the server holds, with its undo history when this browser kept it.
  // The region holds a keep-or-replace answer as a value of its own column; the server keeps it apart
  // (`toServerDecisions`, `toRegionDecisions`). `start` is the region's shape, `decisions` the server's.
  const [start, setStart] = useState<RegionDecisions>(() =>
    kept !== null && Equal.equals(toServerDecisions(kept.decisions), view.decisions)
      ? restoredDecisions(kept)
      : toRegionDecisions(view.decisions)
  )
  const [decisions, setDecisions] = useState<SavedDecisions>(view.decisions)
  // The draft's revision as far as this screen has caught up with it, and a count that remounts the region.
  const known = useRef(view.revision)
  const typedCodes = useRef("")
  const [epoch, setEpoch] = useState(0)
  // Set once the saver exists (below): the region starts again from the decisions the server holds.
  const putBack = useRef<(server: { decisions: SavedDecisions; revision: number }) => void>(() => undefined)
  const setServerDecisions = (server: { decisions: SavedDecisions; revision: number }) => putBack.current(server)
  const saver = useDecisionSaver({
    importId: view.id,
    start: view.decisions,
    onSaved: useCallback(
      (revision: number, saved: SavedDecisions) => {
        // A jump of more than one means someone else saved in between: fetch their decisions too.
        const alone = revision === known.current + 1
        known.current = revision
        // A SKU the person typed may belong to an item that is already there: ask the server which are.
        const typed = Object.values(saved)
          .map((decision) => decision.edits?.sku ?? "")
          .join("|")
        const retyped = typed !== typedCodes.current
        typedCodes.current = typed
        queryClient.setQueryData<ImportView>(queryKeys.import(view.id), (old) =>
          old === undefined ? old : { ...old, decisions: saved, revision }
        )
        if (!alone || retyped) void queryClient.invalidateQueries({ queryKey: queryKeys.import(view.id) })
      },
      [queryClient, view.id]
    ),
    // Refused: the screen goes back to the decisions the server holds, and the toast says why.
    onRefused: useCallback(
      (error: unknown) => {
        toastError(error, { lead: "Your last decision was not saved, so the review shows what was saved." })
        void queryClient.fetchQuery({ ...importViewQuery(view.id), staleTime: 0 }).then(
          (now) => setServerDecisions({ decisions: now.decisions, revision: now.revision }),
          () => undefined
        )
      },
      [queryClient, view.id]
    )
  })
  // True between a match made on this screen and the new view it returns, so the update is not announced as
  // someone else's.
  const matching = useRef(false)
  const { reset, change } = saver
  putBack.current = (server) => {
    known.current = server.revision
    reset(server.decisions)
    setStart(toRegionDecisions(server.decisions))
    setDecisions(server.decisions)
    setEpoch((count) => count + 1)
  }
  const { save, clear } = progress
  // Stable on purpose: the region calls this from an effect that lists it as a dependency, so a new function on
  // every render would make it call again, and again.
  const decided = useCallback(
    (next: RegionDecisions) => {
      const server = toServerDecisions(next)
      setDecisions(server)
      change(server)
      save({ step: "review", review: Option.some(storedReview(next)), decided: Object.keys(next).length })
    },
    [change, save]
  )
  // The draft moved on somewhere else (another tab, another person): show their decisions with ours.
  useEffect(() => {
    if (view.revision <= known.current) return
    known.current = view.revision
    reset(view.decisions)
    setStart(toRegionDecisions(view.decisions))
    setDecisions(view.decisions)
    setEpoch((count) => count + 1)
    if (!matching.current) toast("Updated with what changed on another screen")
    matching.current = false
  }, [view.revision, view.decisions, reset])
  const current = useMemo(() => review({ ...input, decisions }), [input, decisions])
  const rows = useMemo(() => toRegionRows(current, decisions), [current, decisions])
  const columns = useMemo(
    () => regionColumns(current.mapping, current.unusedColumns, table),
    [current.mapping, current.unusedColumns, table]
  )
  // The person picked a file column for a field the headings left without one, from inside the review.
  const match = useMutation({
    mutationFn: (pick: { field: Field; column: number }) =>
      call((api) => api.imports.match({ params: { id: view.id }, payload: pick })),
    // The draft's revision moves with the match; the effect below then starts the region from the new columns.
    onSuccess: (next) => cache.setView(next),
    onError: (error) => toastError(error)
  })
  // Asks for suggestions where the rules have none. Nothing it returns changes a row: each waits for the person.
  const [suggested, setSuggested] = useState<SuggestOutcome | undefined>(undefined)
  const suggest = useMutation({
    mutationFn: () => call((api) => api.imports.suggest({ params: { id: view.id } })),
    onSuccess: (outcome) => {
      setSuggested(outcome)
      queryClient.setQueryData<ImportView>(queryKeys.import(view.id), (old) =>
        old === undefined ? old : { ...old, suggestions: outcome.suggestions }
      )
    },
    onError: (error) => toastError(error, { lead: "No suggestions were made." })
  })
  const recheck = useMemo(() => {
    const check = recheckRow(input)
    return (asked: { row: ReviewRow; cells: Readonly<Record<string, string>> }): Problem | undefined => {
      const problem = check({ id: asked.row.id, values: asked.cells })
      // The check knows the typed values and not the keep-or-replace answer: once that is given, what is still open
      // is what the review of every decision says (the row's own problem).
      const answered = asked.cells[storedChoice] === "keep" || asked.cells[storedChoice] === "replace"
      if (problem?.kind === "changed" && answered) return asked.row.problem
      return problem === undefined ? undefined : toRegionProblem(problem)
    }
  }, [input])

  const commit = useMutation({
    mutationFn: () =>
      call((api) => api.imports.commit({ params: { id: view.id }, payload: { set: decisions, clear: [] } })),
    onSuccess: (done) => {
      // The confirm saved this screen's own decisions: not a change made somewhere else. Confirm ends the undo
      // history: nothing of it comes back on the next visit.
      known.current = done.revision
      clear()
      cache.setView(done)
      void queryClient.invalidateQueries({ queryKey: queryKeys.items })
      void queryClient.invalidateQueries({ queryKey: queryKeys.changes })
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity })
      void queryClient.invalidateQueries({ queryKey: queryKeys.openImports })
      void queryClient.invalidateQueries({ queryKey: queryKeys.pastImports })
      navigate(importAddress(done.id, "result"))
    },
    onError: (error) => {
      toastError(error)
      // Someone else confirmed it meanwhile: fetch what happened, which moves this screen to the result.
      void queryClient.invalidateQueries({ queryKey: queryKeys.import(view.id) })
    }
  })

  const { sums, counts, fixed } = current
  // How many are already there is the region's to say (its tag and its count, in `importWords`), once.
  // Rows are what the person finds in the file, items what they decide on: two counts when a row holds several.
  const read =
    counts.rows === counts.fileRows
      ? `${counts.rows} rows read`
      : `${counts.fileRows} rows in the file, ${counts.rows} items`
  // What the form-only rules changed without the person, each listed on its row and undoable there.
  // A column of the file no field reads is said here, with how many rows hold a value: it is left out, never stored.
  const summary = [
    read,
    ...(fixed.cells === 0 ? [] : [`${fixed.cells} values fixed for you`]),
    ...current.unusedColumns.map(notImportedColumn)
  ]
  // A file column suggested for a field that still has none: offered, matched only when the person presses it.
  const columnSuggestions = view.suggestions.filter(
    (suggestion) =>
      suggestion.kind === "column" &&
      suggestion.column !== null &&
      current.mapping.some((matched) => matched.field === suggestion.field && matched.header === null)
  )
  const answered =
    suggested === undefined
      ? undefined
      : suggested.answeredBy._tag === "Model"
        ? `Answered by the model ${suggested.answeredBy.model}.`
        : `Answered by the fixed rules, not a model: ${suggested.answeredBy.reason}`
  const summaryAction =
    !props.canImport || (counts.cannot === 0 && columnSuggestions.length === 0 && suggested === undefined) ? null : (
      <>
        {counts.cannot === 0 ? null : (
          <Button variant="outline" size="xs" disabled={suggest.isPending} onClick={() => suggest.mutate()}>
            {suggest.isPending ? <Spinner aria-hidden /> : null}
            {suggest.isPending ? "Suggesting fixes" : "Suggest fixes"}
          </Button>
        )}
        {columnSuggestions.map((suggestion) => (
          <Button
            key={suggestion.id}
            variant="outline"
            size="xs"
            disabled={match.isPending}
            onClick={() => {
              if (suggestion.column === null) return
              matching.current = true
              match.mutate({ field: suggestion.field, column: suggestion.column })
            }}
          >
            Use column “{suggestion.to}” for {fieldLabels[suggestion.field]}
          </Button>
        ))}
        {suggested === undefined || suggest.isPending ? null : (
          <span role="status" className="min-w-0 text-foreground">
            {[...(suggested.lines.length === 0 ? ["Suggested nothing new"] : suggested.lines), answered].join(". ")}
          </span>
        )}
      </>
    )
  const activity: Activity = {
    steps: [
      ...table.notes.map((note, index) => ({ id: `note-${index}`, by: "read" as const, label: note.message })),
      // A column of the file no field of an item reads: said here, never stored.
      ...current.unusedColumns.map((column) => ({
        id: `unused-${column.index}`,
        by: "read" as const,
        label: notImportedColumn(column)
      }))
    ],
    allowed: [
      "Read the file: its headings, rows and notes",
      "Fix a value written another way: spaces, capitals, a $ sign, yes for true, a date written out",
      "Propose a reading of a value that has more than one",
      "Save each decision as you make it",
      "Never import a row you have not settled"
    ],
    facts: [
      { label: "File", value: view.fileName },
      ...(table.sheet === null ? [] : [{ label: "Sheet", value: table.sheet }]),
      { label: "Uploaded by", value: view.startedBy },
      { label: "Prepared by", value: "The fixed rules" },
      { label: "Stock value in the file", value: totalText(sums.fileStockValue) }
    ]
  }

  return (
    <>
      <ReviewRegion
        key={`${view.id}:${epoch}`}
        title={`Review ${view.fileName}`}
        noun={["item", "items"]}
        columns={columns}
        rows={rows}
        problemKinds={regionKinds}
        words={reviewStepWords}
        summary={summary}
        summaryAction={summaryAction}
        // The sums of the rows that will be imported, as the domain reads them from the digits: unit cost times
        // quantity on hand, and each unit of measure's quantity on its own (quantities in different units are never
        // added). The same value over every row of the file is in the activity.
        totals={[
          { label: "Stock value", value: totalText(sums.readyStockValue) },
          ...sums.readyQuantities.map((total) => ({ label: total.unit, value: whole.format(total.quantity) }))
        ]}
        activity={activity}
        recheck={recheck}
        cellEditor={cellEditor}
        explain={(flagged) => <WhyFlagged rows={flagged} current={current} />}
        ruleFixes={ruleFixes}
        savedDecisions={start}
        onDecisionsChange={decided}
        readOnly={!props.canImport}
        readOnlyNote="View only. An editor can import."
        importNote="Each row becomes a new item. A SKU already there is skipped; if its values differ, you choose to keep or replace it."
        // Reopened after it created its items: with nothing more to add, the person can still close it again.
        {...(view.createdRows.length > 0 ? { closingLabel: "Close this import" } : {})}
        importing={commit.isPending}
        onMatchColumn={(columnId, source) => {
          const column = table.columns.find((candidate) => candidate.label === source)
          const field = fields.find((candidate) => candidate === columnId)
          if (column === undefined || field === undefined) return
          matching.current = true
          // The server decides what a new match drops (the accepts of that field): it says so while
          // it works, and the review starts again from its answer.
          const working = toast.loading(`Matching ${column.label}`)
          match.mutate({ field, column: column.index }, { onSettled: () => toast.dismiss(working) })
        }}
        onShowMatching={() => navigate(importAddress(view.id, "match"))}
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => navigate(importAddress(view.id, "upload"))}>
            Choose another file
          </Button>
        }
        onImport={() => commit.mutate()}
      />
    </>
  )
}
