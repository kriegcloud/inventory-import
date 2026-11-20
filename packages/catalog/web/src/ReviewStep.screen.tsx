import { useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as Atom from "effect/reactivity/Atom"
import { useDeferredValue } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { ReviewSkeleton } from "@inventory/ui/Skeletons"
import { ReviewRegion } from "@inventory/review/ReviewRegion"
import { Activity } from "@inventory/review/ReviewTypes"
import type { Problem, ReviewColumn, ReviewRow } from "@inventory/review/ReviewTypes"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { isNarrow } from "@inventory/ui/ContentWidth"
import { Button } from "@inventory/ui/components/button"
import { Spinner } from "@inventory/ui/components/spinner"
import { member } from "@inventory/client/MemberAtoms"
import { hasRole } from "@inventory/kernel/Role"
import { perKey } from "@inventory/client/Api"
import {
  confirmHeldBack,
  confirmHeldForLines,
  confirmingImport,
  dismissTakeBack,
  rowsNotSaved,
  rowsOnHold,
  takeBacksNamed,
  draftEvents,
  followDraft,
  regionEpoch,
  reviewInput,
  reviewLocal,
  reviewStateAt,
  shownDecisions,
  whileCurrent
} from "./ReviewDraft.atoms.ts"
import { acceptsWords } from "./ReviewDraft.atoms.ts"
import { DraftEvent, type HeldBack, type HeldRows } from "./Draft.machine.ts"
import { holdLine, takeBackWords } from "./internal/leftOver.ts"
import { matchColumn, suggestFixes } from "./Imports.atoms.ts"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "./internal/route.ts"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import type { ImportView, MatchTakeBack } from "@inventory/catalog-contract/Import"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { recheckRow, review, ruleFixes } from "@inventory/catalog-model/Review"
import { readerWarnings } from "@inventory/catalog-model/Staging"
import { matchedColumn } from "@inventory/catalog-contract/Mapping"
import { type Field, fieldLabels, fields, type StagedTable } from "@inventory/catalog-contract/Staged"
import { type Suggestion } from "@inventory/catalog-contract/Suggestion"
import { WhyFlagged } from "./internal/WhyFlagged.tsx"
import { DimensionsForm, VendorsForm } from "./internal/CellForms.tsx"
import { heldBackSentence, notImportedColumn, reviewStepWords } from "./internal/format.tsx"
import { totalText } from "./internal/itemText.ts"
import { regionColumns, regionKinds, storedChoice, toRegionProblem, toRegionRows } from "./ImportReview.controller.ts"
import { toastError } from "@inventory/client/SayError"
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

// What the region is given that never changes, each as the atom it takes.
const kindsAtom = Atom.make(regionKinds)
const wordsAtom = Atom.make(reviewStepWords)
const ruleFixesAtom = Atom.make(ruleFixes)
/** True while the person signed in may look at an import but not decide on it: the page's own rule, as an atom. */
const lookingOnly = Atom.map(member, (signedIn) => !O.exists(signedIn, (actor) => hasRole(actor.role, "editor")))

const noRows: ReadonlyArray<ReviewRow> = []
const noColumns: ReadonlyArray<ReviewColumn> = []

/** The review's rows and columns as a region takes them: atoms it follows, empty until the review is worked out. */
const rowsOf = perKey((id: ImportId) =>
  Atom.map(currentReview(id), (worked) => O.match(worked, { onNone: () => noRows, onSome: (now) => now.rows }))
)
const columnsOf = perKey((id: ImportId) =>
  Atom.map(currentReview(id), (worked) => O.match(worked, { onNone: () => noColumns, onSome: (now) => now.columns }))
)

/** The check the region runs on a row as the person types: the review's own, for one row. */
const recheckOf = perKey((id: ImportId) =>
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
 * What the region drawn at one epoch of the draft is given. Each follows the review while that epoch is the draft's
 * and keeps its last value after, so a region about to be drawn again is not first handed the newer draft.
 */
const regionGiven = perKey((id: ImportId) =>
  perKey((epoch: number) => ({
    rows: whileCurrent({ id, epoch, source: rowsOf(id) }),
    columns: whileCurrent({ id, epoch, source: columnsOf(id) }),
    recheck: whileCurrent({ id, epoch, source: recheckOf(id) }),
    decisions: reviewStateAt(id)(epoch)
  }))
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
  const happened = useAtomSet(draftEvents(view.id))
  const epoch = useAtomValue(regionEpoch(view.id))
  const worked = useAtomValue(currentReview(view.id))
  const recheckRead = useAtomValue(recheckOf(view.id))
  const given = regionGiven(view.id)(epoch)

  // Follows the import's draft while this screen is open (`followDraft`): where it starts, and a newer draft.
  useAtomMount(followDraft(view.id))

  // The person picked a file column for a field the headings left without one, from inside the review.
  const matching = useAtomValue(matchColumn).waiting
  const matchOne = useAtomSet(matchColumn, { mode: "promiseExit" })
  const match = (pick: { field: Field; column: number }, done?: () => void) => {
    // True between a match made on this screen and the new view it returns, so the update is not announced as
    // someone else's.
    happened(DraftEvent.MatchStarted())
    void matchOne({ id: view.id, field: pick.field, column: O.some(pick.column) }).then((exit) => {
      happened(DraftEvent.MatchEnded())
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

  // The confirm is the draft's to send (`ReviewDraft.atoms.ts`): it names the picture this screen holds and carries
  // the person's rows not saved yet. Made on a picture somebody has changed since, it is refused and nothing is
  // written; the screen then takes the newer picture and says so above the review, until the person confirms again.
  const committing = useAtomValue(confirmingImport(view.id))
  const heldBack = useAtomValue(confirmHeldBack(view.id))
  const heldForLines = useAtomValue(confirmHeldForLines(view.id))
  const notSaved = useAtomValue(rowsNotSaved(view.id))
  const onHold = useAtomValue(rowsOnHold(view.id))
  const takenBack = useAtomValue(takeBacksNamed(view.id))
  const dismiss = useAtomSet(dismissTakeBack(view.id))
  const commit = () => happened(DraftEvent.ConfirmPressed())

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
      : AnsweredBy.match(suggested.answeredBy, {
          Model: (by) => `Answered by the model ${by.model}.`,
          Rules: (by) => `Answered by the fixed rules, not a model: ${by.reason}`
        })
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
  const activity: Activity = Activity.make({
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
  })

  return (
    <>
      <ReaderWarnings table={table} />
      <NotImportedYet why={heldBack} />
      <NotSavedYet rows={notSaved} onSaveAgain={() => happened(DraftEvent.SaveAgain())} />
      <OnHold
        rows={onHold}
        onSettle={(rowId, keep) => happened(DraftEvent.HoldSettled({ rowId, keep }))}
        canDecide={props.canImport}
      />
      <NotImportedForLines held={heldForLines} />
      <MatchTakeBacks taken={takenBack} onDismiss={dismiss} />
      <ReviewRegion
        key={`${view.id}:${epoch}`}
        title={`Review ${view.fileName}`}
        noun={["item", "items"]}
        columns={given.columns}
        rows={given.rows}
        // The decisions with their undo are this import's own atom: the region writes it, and the write saves them.
        decisions={given.decisions}
        problemKinds={kindsAtom}
        words={wordsAtom}
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
        recheck={given.recheck}
        cellEditor={cellEditor}
        explain={(flagged) => <WhyFlagged rows={flagged} current={current} />}
        ruleFixes={ruleFixesAtom}
        readOnly={lookingOnly}
        readOnlyNote="View only. An editor can import."
        importNote="Each row becomes a new item. A SKU already there is skipped; if its values differ, you choose to keep or replace it."
        // Reopened after it created its items: with nothing more to add, the person can still close it again.
        {...(view.createdRows.length > 0 ? { closingLabel: "Close this import" } : {})}
        importing={committing}
        onMatchColumn={(columnId, source) => {
          const column = table.columns.find((candidate) => candidate.label === source)
          const field = fields.find((candidate) => candidate === columnId)
          if (column === undefined || field === undefined) return
          // The server decides what a new match takes back (accepts, keep-or-replace answers, rows kept of two and
          // undone fixes that rest on the column): the review starts again from its answer, and names them above.
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
 * Said above the review while decisions wait after a save that failed: they are on the screen and kept in this
 * browser, not on the server yet. It stays until they are saved; the button sends them now.
 */
function NotSavedYet(props: { rows: number; onSaveAgain: () => void }) {
  const narrow = useAtomValue(isNarrow)
  if (props.rows === 0) return null
  return (
    <Alert role="status" className={narrow ? "mx-4 mt-3 w-auto" : "mx-6 mt-4 w-auto"}>
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>
        {props.rows === 1 ? "1 decision is not saved yet" : `${props.rows} decisions are not saved yet`}
      </AlertTitle>
      <AlertDescription>
        <p>
          The server did not take {props.rows === 1 ? "it" : "them"}. {props.rows === 1 ? "It is" : "They are"} kept in
          this browser and sent again once this screen has read the import again and nobody decided{" "}
          {props.rows === 1 ? "that row" : "those rows"} otherwise meanwhile.
        </p>
        <Button variant="outline" size="xs" onClick={props.onSaveAgain}>
          Save again
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/**
 * The person's decisions held instead of sent, one line each, above the review: refused by the server (with its
 * sentence; dismissed, or settled by deciding the row again), decided otherwise since by someone else or another tab
 * while they waited, or decided otherwise by a tab of theirs that is gone (both said; the person picks which stands).
 * Nothing here is sent until the person says so.
 */
function OnHold(props: {
  rows: HeldRows
  onSettle: (rowId: string, keep: "mine" | "theirs") => void
  canDecide: boolean
}) {
  const narrow = useAtomValue(isNarrow)
  // In the file's order: row 9 before row 10.
  const lines = A.sort(
    R.toEntries(props.rows),
    Order.mapInput(Order.Number, ([rowId]: readonly [string, unknown]) =>
      Number(Str.replace(/^row-(\d+).*$/, "$1")(rowId))
    )
  )
  if (!A.isReadonlyArrayNonEmpty(lines)) return null
  return (
    <Alert role="status" className={narrow ? "mx-4 mt-3 w-auto" : "mx-6 mt-4 w-auto"}>
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>
        {A.length(lines) === 1
          ? "1 decision of yours is not saved"
          : `${A.length(lines)} decisions of yours are not saved`}
      </AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-2">
          {A.map(lines, ([rowId, held]) => {
            // "Keep theirs" sends nothing, so anyone may settle a line with it; only an editor can send theirs.
            const line = holdLine({ rowId, held, canDecide: props.canDecide })
            return (
              <li key={rowId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0">{line.text}</span>
                <span className="flex gap-2">
                  {A.map(line.actions, (action) => (
                    <Button
                      key={action.keep}
                      variant="outline"
                      size="xs"
                      onClick={() => props.onSettle(rowId, action.keep)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

/**
 * What matches took back from decisions already saved, one line each, above the review: who matched which field again,
 * how many decisions of which kind, on which rows. The review below already shows each row as it reads now; the line
 * stays until the person dismisses it.
 */
function MatchTakeBacks(props: { taken: ReadonlyArray<MatchTakeBack>; onDismiss: (taken: MatchTakeBack) => void }) {
  const narrow = useAtomValue(isNarrow)
  if (!A.isReadonlyArrayNonEmpty(props.taken)) return null
  return (
    <Alert role="status" className={narrow ? "mx-4 mt-3 w-auto" : "mx-6 mt-4 w-auto"}>
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>
        {A.length(props.taken) === 1 ? "A match took decisions back" : "Matches took decisions back"}
      </AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-2">
          {A.map(props.taken, (taken) => (
            <li
              key={`${taken.revision}:${taken.field}:${taken.kind}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="min-w-0">{takeBackWords(taken)} Each row shows what it reads now, to decide again.</span>
              <Button variant="outline" size="xs" onClick={() => props.onDismiss(taken)}>
                Dismiss
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Said above the review when a confirm was not made because the import had changed on another screen: nothing was
 * imported, the review below already shows the import as it is now, and the person confirms again.
 */
function NotImportedYet(props: { why: O.Option<HeldBack> }) {
  const narrow = useAtomValue(isNarrow)
  if (O.isNone(props.why)) return null
  return (
    <Alert role="alert" className={narrow ? "mx-4 mt-3 w-auto" : "mx-6 mt-4 w-auto"}>
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>Nothing was imported</AlertTitle>
      <AlertDescription>
        <p>{heldBackSentence({ why: props.why.value, accepts: acceptsWords(props.why.value.accepts) })}</p>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Said above the review when a confirm was not made because a line above it asks which of two decisions of a row
 * stands (one from a tab of the person's that is gone): nothing was imported; the person settles those lines, then
 * imports. It goes once they are settled.
 */
function NotImportedForLines(props: { held: boolean }) {
  const narrow = useAtomValue(isNarrow)
  if (!props.held) return null
  return (
    <Alert role="alert" className={narrow ? "mx-4 mt-3 w-auto" : "mx-6 mt-4 w-auto"}>
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>Nothing was imported</AlertTitle>
      <AlertDescription>
        <p>
          A row is listed above with a decision from your other tab beside this tab's own. Pick which one stands on each
          of those lines, then import.
        </p>
      </AlertDescription>
    </Alert>
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
