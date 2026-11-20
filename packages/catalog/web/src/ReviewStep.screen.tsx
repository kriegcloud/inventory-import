import { useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { useDeferredValue } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { ReviewSkeleton } from "@inventory/ui/Skeletons"
import { ReviewRegion } from "@inventory/review/ReviewRegion"
import type { Activity, Problem, ReviewColumn, ReviewRow } from "@inventory/review/ReviewTypes"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { isNarrow } from "@inventory/ui/ContentWidth"
import { Button } from "@inventory/ui/components/button"
import { Spinner } from "@inventory/ui/components/spinner"
import { member } from "@inventory/client/MemberAtoms"
import { invalidate, perKey } from "@inventory/client/Api"
import { followDraft, reviewInput, reviewLocal, reviewState, shownDecisions } from "./ReviewDraft.atoms.ts"
import { confirmImport, matchColumn, suggestFixes } from "./Imports.atoms.ts"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "./internal/route.ts"
import { useSavedProgress } from "@inventory/review/SavedProgressHook"
import { catalogRuntime } from "./Catalog.runtime.ts"
import type { ImportView } from "@inventory/catalog-contract/Import"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { recheckRow, review, ruleFixes } from "@inventory/catalog-model/Review"
import { readerWarnings } from "@inventory/catalog-model/Staging"
import { matchedColumn } from "@inventory/catalog-contract/Mapping"
import { type Field, fieldLabels, fields, type StagedTable } from "@inventory/catalog-contract/Staged"
import { type Suggestion } from "@inventory/catalog-contract/Suggestion"
import { WhyFlagged } from "./internal/WhyFlagged.tsx"
import { DimensionsForm, VendorsForm } from "./internal/CellForms.tsx"
import { notImportedColumn, reviewStepWords } from "./internal/format.tsx"
import { totalText } from "./internal/itemText.ts"
import { regionColumns, regionKinds, storedChoice, toRegionProblem, toRegionRows } from "./ImportReview.controller.ts"
import { toastError } from "@inventory/client/SayError"
import { catalogKeys } from "./Catalog.keys.ts"
import { offersSuggestions } from "@inventory/catalog-model/Suggest"

const whole = new Intl.NumberFormat("en-US")

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

/** The review of every row with the decisions shown: the same pure review the server runs at the confirm. */
const currentReview = perKey((id: ImportId) =>
  Atom.readable((get) => {
    const input = get(reviewInput(id))
    const decisions = get(shownDecisions(id))
    if (O.isNone(input) || O.isNone(decisions)) return O.none()
    const current = review({ ...input.value, decisions: decisions.value })
    return O.some({
      current,
      rows: toRegionRows(current, decisions.value),
      columns: regionColumns(current.mapping, current.unusedColumns, input.value.table)
    })
  })
)

const noRows: ReadonlyArray<ReviewRow> = []
const noColumns: ReadonlyArray<ReviewColumn> = []

/** The review's rows and columns as the region takes them: atoms it follows, empty until the review is worked out. */
const regionRows = perKey((id: ImportId) =>
  Atom.map(currentReview(id), (worked) => O.match(worked, { onNone: () => noRows, onSome: (now) => now.rows }))
)
const regionColumnsOf = perKey((id: ImportId) =>
  Atom.map(currentReview(id), (worked) => O.match(worked, { onNone: () => noColumns, onSome: (now) => now.columns }))
)

/** The check the region runs on a row as the person types: the review's own, for one row. */
const rowRecheck = perKey((id: ImportId) =>
  Atom.readable((get) =>
    O.map(get(reviewInput(id)), (input) => {
      const check = recheckRow(input)
      return (asked: { row: ReviewRow; cells: Readonly<Record<string, string>> }): Problem | undefined => {
        const problem = check({ id: asked.row.id, values: asked.cells })
        // The check knows the typed values and not the keep-or-replace answer: once that is given, what is still open
        // is what the review of every decision says (the row's own problem).
        const answered = asked.cells[storedChoice] === "keep" || asked.cells[storedChoice] === "replace"
        if (problem?.kind === "changed" && answered) return asked.row.problem
        return problem === undefined ? undefined : toRegionProblem(problem)
      }
    })
  )
)

/**
 * The review: every row that needs the person, what the rules propose for it, and one button that says what it
 * will import. The rows and proposals come from the same pure review the server runs at the confirm. Working out a
 * review of 50,000 rows takes the browser most of a second in one go: the skeleton is drawn first (a deferred value),
 * so the person sees what is coming instead of the last screen standing still.
 */
export function ReviewStep(props: { view: ImportView; table: StagedTable; canImport: boolean }) {
  const painted = useDeferredValue(true, false)
  return painted ? <ReviewBody {...props} /> : <ReviewSkeleton title={`Review ${props.view.fileName}`} />
}

function ReviewBody(props: { view: ImportView; table: StagedTable; canImport: boolean }) {
  const { view, table } = props
  const [local, setLocal] = useAtom(reviewLocal(view.id))
  // The decisions are the server's; the undo history behind them is kept in this browser, per person and import, so
  // a refresh brings "Undo last step" back too. It is used only while it ends at the decisions the server holds: a
  // change made on another screen since starts a new history from the server's.
  const signedIn = useAtomValue(member)
  const actor = O.getOrUndefined(signedIn)
  const progress = useSavedProgress(
    actor === undefined
      ? undefined
      : { organizationId: actor.organizationId, memberId: actor.id, screen: `import:${view.id}` },
    catalogRuntime()
  )
  const shownRead = useAtomValue(shownDecisions(view.id))
  const decisions = O.getOrElse(shownRead, () => view.decisions)
  const worked = useAtomValue(currentReview(view.id))
  const recheckRead = useAtomValue(rowRecheck(view.id))

  // Follows the import's draft while this screen is open (`followDraft`): where it starts, and a newer draft.
  useAtomMount(followDraft(view.id))

  // The person picked a file column for a field the headings left without one, from inside the review.
  const matching = useAtomValue(matchColumn).waiting
  const matchOne = useAtomSet(matchColumn, { mode: "promiseExit" })
  const match = (pick: { field: Field; column: number }, done?: () => void) => {
    // True between a match made on this screen and the new view it returns, so the update is not announced as
    // someone else's.
    setLocal((now) => ({ ...now, matching: true }))
    void matchOne({ id: view.id, field: pick.field, column: O.some(pick.column) }).then((exit) => {
      done?.()
      if (Exit.isFailure(exit)) toastError(exit.cause.pipe(Cause.squash))
    })
  }
  // Asks for suggestions where the rules have none. Nothing it returns changes a row: each waits for the person.
  const suggesting = useAtomValue(suggestFixes).waiting
  const suggestNow = useAtomSet(suggestFixes, { mode: "promiseExit" })
  const suggest = () =>
    void suggestNow(view.id).then((exit) => {
      if (Exit.isSuccess(exit)) setLocal((now) => ({ ...now, suggested: O.some(exit.value) }))
      else toastError(exit.cause.pipe(Cause.squash), { lead: "No suggestions were made." })
    })
  const suggested = O.getOrUndefined(local.suggested)

  const committing = useAtomValue(confirmImport).waiting
  const commitNow = useAtomSet(confirmImport, { mode: "promiseExit" })
  const commit = () =>
    void commitNow({ id: view.id, decisions }).then((exit) => {
      if (Exit.isFailure(exit)) {
        toastError(exit.cause.pipe(Cause.squash))
        // Someone else confirmed it meanwhile: ask what happened, which moves this screen to the result.
        invalidate(catalogKeys.import(view.id))
        return
      }
      // The confirm saved this screen's own decisions: not a change made somewhere else. Confirm ends the undo
      // history: nothing of it comes back on the next visit.
      setLocal((now) => ({ ...now, known: O.some(exit.value.revision) }))
      progress.clear()
      navigate(importAddress(exit.value.id, "result"))
    })

  if (O.isNone(worked) || O.isNone(recheckRead)) return <ReviewSkeleton title={`Review ${view.fileName}`} />
  const { current } = worked.value
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
    (suggestion): suggestion is Extract<Suggestion, { readonly kind: "column" }> =>
      suggestion.kind === "column" &&
      current.mapping.some((matched) => matched.field === suggestion.field && O.isNone(matchedColumn(matched)))
  )
  const answered =
    suggested === undefined
      ? undefined
      : suggested.answeredBy._tag === "Model"
        ? `Answered by the model ${suggested.answeredBy.model}.`
        : `Answered by the fixed rules, not a model: ${suggested.answeredBy.reason}`
  // Offered for a row that cannot be imported, and for a heading no field reads while a field has no column.
  const canSuggest = offersSuggestions({
    cannot: counts.cannot,
    mapping: current.mapping,
    unusedColumns: current.unusedColumns
  })
  const summaryAction =
    !props.canImport || (!canSuggest && columnSuggestions.length === 0 && suggested === undefined) ? null : (
      <>
        {!canSuggest ? null : (
          <Button variant="outline" size="xs" disabled={suggesting} onClick={suggest}>
            {suggesting ? <Spinner aria-hidden /> : null}
            {suggesting ? "Suggesting fixes" : "Suggest fixes"}
          </Button>
        )}
        {columnSuggestions.map((suggestion) => (
          <Button
            key={suggestion.id}
            variant="outline"
            size="xs"
            disabled={matching}
            onClick={() => match({ field: suggestion.field, column: suggestion.column })}
          >
            Use column “{suggestion.heading}” for {fieldLabels[suggestion.field]}
          </Button>
        ))}
        {suggested === undefined || suggesting ? null : (
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
      ...O.match(table.sheet, { onNone: () => [], onSome: (sheet) => [{ label: "Sheet", value: sheet }] }),
      { label: "Uploaded by", value: view.startedBy },
      { label: "Prepared by", value: "The fixed rules" },
      { label: "Stock value in the file", value: totalText(sums.fileStockValue) }
    ]
  }

  return (
    <>
      <ReaderWarnings table={table} />
      <ReviewRegion
        key={`${view.id}:${local.epoch}`}
        title={`Review ${view.fileName}`}
        noun={["item", "items"]}
        columns={regionColumnsOf(view.id)}
        rows={regionRows(view.id)}
        // The decisions with their undo are this import's own atom: the region writes it, and the write saves them.
        decisions={reviewState(view.id)}
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
        recheck={rowRecheck(view.id)}
        cellEditor={cellEditor}
        explain={(flagged) => <WhyFlagged rows={flagged} current={current} />}
        ruleFixes={ruleFixes}
        readOnly={!props.canImport}
        readOnlyNote="View only. An editor can import."
        importNote="Each row becomes a new item. A SKU already there is skipped; if its values differ, you choose to keep or replace it."
        // Reopened after it created its items: with nothing more to add, the person can still close it again.
        {...(view.createdRows.length > 0 ? { closingLabel: "Close this import" } : {})}
        importing={committing}
        onMatchColumn={(columnId, source) => {
          const column = table.columns.find((candidate) => candidate.label === source)
          const field = fields.find((candidate) => candidate === columnId)
          if (column === undefined || field === undefined) return
          // The server decides what a new match drops (the accepts of that field): it says so while
          // it works, and the review starts again from its answer.
          const working = toast.loading(`Matching ${column.label}`)
          match({ field, column: column.index }, () => toast.dismiss(working))
        }}
        onShowMatching={() => navigate(importAddress(view.id, "match"))}
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => navigate(importAddress(view.id, "upload"))}>
            Choose another file
          </Button>
        }
        onImport={commit}
      />
    </>
  )
}

/**
 * What the reader could not take at the file's word, said above the table before the person imports: each warning
 * in the sentence the reader wrote, with the cells or rows it names. Nothing here changes a row's outcome.
 */
function ReaderWarnings(props: { table: Pick<StagedTable, "notes"> }) {
  const warnings = readerWarnings(props.table)
  // The same side room the review below takes, from the room the page has (the sidebar is already taken off).
  const narrow = useAtomValue(isNarrow)
  if (warnings.length === 0) return null
  return (
    <Alert className={narrow ? "mx-4 mt-3 w-auto" : "mx-6 mt-4 w-auto"}>
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>
        {warnings.length === 1
          ? "Check this before you import"
          : `Check these ${warnings.length} things before you import`}
      </AlertTitle>
      <AlertDescription>
        {warnings.length === 1 ? (
          <p>{warnings[0]?.message}</p>
        ) : (
          <ul className="list-disc pl-4">
            {A.map(warnings, (warning) => (
              <li key={warning.message}>{warning.message}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}
