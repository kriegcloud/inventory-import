import { useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { followDraft, namingLeftOver, rowsLeftOver } from "./ReviewDraft.atoms.ts"
import { leftOverLines } from "./internal/leftOver.ts"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { toast } from "sonner"
import { Code } from "@inventory/ui/Code"
import { PageHeader, Views } from "@inventory/ui/PageHeader"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@inventory/ui/components/alert-dialog"
import { Button } from "@inventory/ui/components/button"
import { type RecordColumn, RecordsTable } from "@inventory/ui/components/data-table/data-table-records"
import { whenShort } from "@inventory/ui/Dates"
import { importView, reopenImport, takeBackImport } from "./Imports.atoms.ts"
import { answerOf, invalidate, perKey } from "@inventory/client/Api"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "./internal/route.ts"
import {
  type ChangedItem,
  ImportEvent,
  type ImportResult,
  type ImportView,
  outcomeReasonOf,
  type RowOutcome
} from "@inventory/catalog-contract/Import"
import { rowPlace } from "@inventory/catalog-model/Review"
import { rowId } from "@inventory/catalog-contract/Decision"
import { type StagedTable } from "@inventory/catalog-contract/Staged"
import { download, importWords, notImportedColumn, OutcomePill, Text, when } from "./internal/format.tsx"
import { toastError } from "@inventory/client/SayError"
import { catalogKeys } from "./Catalog.keys.ts"
import { notImportedCsv } from "@inventory/catalog-model/NotImported"

type Filter = "all" | RowOutcome["outcome"]

const columns: ReadonlyArray<RecordColumn<RowOutcome>> = [
  { id: "name", label: "Name", width: 300, cell: (row) => <Text value={row.name} />, sort: (row) => row.name },
  {
    id: "status",
    label: "Status",
    width: 140,
    cell: (row) => <OutcomePill outcome={row.outcome} />,
    sort: (row) => row.outcome
  },
  {
    id: "reason",
    label: "Reason",
    blank: (row) => O.match(outcomeReasonOf(row), { onNone: () => true, onSome: (reason) => reason === "" }),
    // Why, for a row that was already there or not imported; and who left it out, when someone did.
    cell: (row) =>
      row.outcome === "notImported" && row.decidedBy.kind === "person"
        ? `${row.reason} (${row.decidedBy.name})`
        : O.getOrElse(outcomeReasonOf(row), () => "")
  },
  {
    id: "sku",
    label: "SKU",
    width: 190,
    cell: (row) => (
      <Code>
        <Text value={row.sku} />
      </Code>
    ),
    title: (row) => row.sku,
    sort: (row) => row.sku
  },
  {
    id: "row",
    label: "Row",
    width: 80,
    align: "right",
    // One of several items on its row says which ("8 · 2"); a row that is one item shows its number alone.
    cell: (row) => rowPlace({ rowNumber: row.rowNumber, label: O.getOrUndefined(O.map(row.part, String)) }),
    sort: (row) => row.rowNumber * 1000 + O.getOrElse(row.part, () => 0)
  }
]

const items = (n: number) => `${n} ${n === 1 ? "item" : "items"}`

/** An item someone changed, in words: its SKU and name, who changed it and when. */
function Changed(props: { item: ChangedItem }) {
  return (
    <>
      <Code>{props.item.sku}</Code> {props.item.name}
      {O.match(props.item.changedBy, { onNone: () => ", changed since", onSome: (who) => `, changed by ${who}` })}
      {/* The moment is said when it was stored. */}
      {O.match(props.item.changedAt, { onNone: () => "", onSome: (at) => ` on ${whenShort(at)}` })}
    </>
  )
}

/** The items named one after another, and how many more there are than the list shows. */
function ChangedList(props: { items: ReadonlyArray<ChangedItem>; count: number }) {
  return (
    <ul className="mt-1 flex flex-col gap-0.5">
      {props.items.map((item) => (
        <li key={item.sku}>
          <Changed item={item} />
        </li>
      ))}
      {props.count > props.items.length ? <li>and {props.count - props.items.length} more</li> : null}
    </ul>
  )
}

/** One line of the import's history, from what its confirms and take-backs stored. */
const eventLine: (event: ImportEvent) => string = ImportEvent.match({
  Confirmed: (event) =>
    `Imported ${items(event.created)}${event.updated === 0 ? "" : `, updated ${event.updated}`}, ${event.by}, ${whenShort(event.at)}`,
  TakenBack: (event) =>
    `Took back ${items(event.removed)}${event.restored === 0 ? "" : `, restored ${event.restored}`}${event.kept === 0 ? "" : `, kept ${event.kept}`}, ${event.by}, ${whenShort(event.at)}`
})

/** The view the person chose on one import's result; none until they choose, and the step opens on its own. */
const chosenFilter = perKey((_id: ImportId) => Atom.make<O.Option<Filter>>(O.none()))

/** The view the result opens on until the person picks one: what was taken back, else what was left out, else all. */
const filterOf = (input: {
  readonly view: ImportView
  readonly result: ImportResult
  readonly chosen: O.Option<Filter>
}): Filter =>
  O.getOrElse(input.chosen, () =>
    input.view.status === "takenBack" ? "takenBack" : input.result.notImported > 0 ? "notImported" : "all"
  )

const noResultRows: ImportResult["rows"] = []

/**
 * One import as the server last answered it, not the read itself: the read is a new object when it starts asking
 * again and another when it has answered (every return to the tab asks again), and the rows would be filtered, and
 * the table worked out, for each. From the answer they are worked out once per answer.
 */
const viewAnswer = perKey((id: ImportId) => answerOf(importView(id)))

/** The rows the view on screen shows: the same rows while the result and the view are the same, so the table keeps its state. */
export const shownRows = perKey((id: ImportId) =>
  Atom.readable((get): ImportResult["rows"] => {
    const view = get(viewAnswer(id))
    if (view === undefined || O.isNone(view.result)) return noResultRows
    const result = view.result.value
    const filter = filterOf({ view, result, chosen: get(chosenFilter(id)) })
    return A.filter(result.rows, (row) => filter === "all" || row.outcome === filter)
  })
)

/**
 * What the import did, row by row: imported, updated, already there, not imported with the reason, or taken back. The rows
 * that were not imported can be downloaded with their reasons. While its items are as it created them, the import
 * can be taken back: the confirm says what it will remove and keep, and once every item has changed the screen says
 * it can no longer be done. After a take-back the review comes back with every decision, so nothing is done twice.
 */
export function ResultStep(props: { view: ImportView; result: ImportResult; table: StagedTable; canImport: boolean }) {
  const { view, result, table } = props
  const [chosen, choose] = useAtom(chosenFilter(view.id))
  const filter = filterOf({ view, result, chosen })
  const setFilter = (next: Filter) => choose(O.some(next))
  const reopening = useAtomValue(reopenImport).waiting
  const reopenNow = useAtomSet(reopenImport, { mode: "promiseExit" })
  const reopen = () =>
    void reopenNow(view.id).then((exit) => {
      if (Exit.isSuccess(exit)) navigate(importAddress(exit.value.id, "review"))
      else toastError(exit.cause.pipe(Cause.squash))
    })
  const takingBack = useAtomValue(takeBackImport).waiting
  const takeBackNow = useAtomSet(takeBackImport, { mode: "promiseExit" })
  const takeBack = () =>
    void takeBackNow(view).then((exit) => {
      if (Exit.isFailure(exit)) {
        toastError(exit.cause.pipe(Cause.squash))
        invalidate(catalogKeys.import(view.id))
        return
      }
      const done = exit.value
      const last = O.filter(A.last(done.history), ImportEvent.guards.TakenBack)
      toast.success(
        O.match(last, {
          // The event's numbers are the whole take-back's, over every confirm it undid.
          onSome: (event) =>
            `Took back ${items(event.removed)} from ${done.fileName}${event.restored === 0 ? "" : `, restored ${event.restored}`}${event.kept === 0 ? "" : `, kept ${event.kept}`}`,
          onNone: () => `${done.fileName} has nothing left to take back`
        })
      )
      setFilter("takenBack")
    })
  const shown = useAtomValue(shownRows(view.id))
  const views: ReadonlyArray<readonly [Filter, string, number]> = [
    ...(result.takenBack > 0 || filter === "takenBack"
      ? [["takenBack", importWords.takenBack, result.takenBack] as const]
      : []),
    ["notImported", importWords.notImported, result.notImported],
    ["created", importWords.created, result.created],
    // Rows that replaced a stored item, as the person chose in the review: shown only when there are any.
    ...(result.updated > 0 || filter === "updated" ? [["updated", importWords.updated, result.updated] as const] : []),
    ["already", importWords.already, result.already],
    ["all", importWords.all, result.rows.length]
  ]

  // The draft is followed here too: rows this browser kept, waiting, for an import somebody else then confirmed are
  // found by it, named below, and let go when this screen leaves.
  useAtomMount(followDraft(view.id))
  useAtomMount(namingLeftOver(view.id))
  const leftOver = useAtomValue(rowsLeftOver(view.id))

  const { removable, restorable, changed, changedCount, kept, keptCount, confirms } = view.takeBack
  const takenBack = view.status === "takenBack"
  const lastTakeBack = O.getOrUndefined(A.findLast(view.history, ImportEvent.guards.TakenBack))
  // A take-back is possible while a confirm is in force and one of its items is as it created or replaced it.
  const canTakeBack = props.canImport && !takenBack && confirms.length > 0 && (removable > 0 || restorable > 0)
  const noLonger = !takenBack && confirms.length > 0 && removable === 0 && restorable === 0 && changedCount > 0
  // What a take-back does now: removes the items the import created and puts back the ones it replaced.
  const undoes = [
    ...(removable === 0 ? [] : [`removes the ${items(removable)} that ${view.fileName} created`]),
    ...(restorable === 0
      ? []
      : [`puts back the ${items(restorable)} it replaced as ${restorable === 1 ? "it was" : "they were"} before`])
  ].join(" and ")
  const replaced = result.updated
  const putsBack =
    takenBack || replaced === 0
      ? null
      : `A take-back puts back the ${items(replaced)} this import replaced as ${replaced === 1 ? "it was" : "they were"} before, unless changed since.`

  const downloadButton =
    result.notImported === 0 ? null : (
      <Button
        variant="outline"
        onClick={() =>
          download(
            `not-imported-${view.fileName.replace(/\.[^.]+$/, "")}.csv`,
            notImportedCsv({
              table,
              rows: result.rows.flatMap((row) =>
                row.outcome === "notImported"
                  ? [
                      {
                        rowNumber: row.rowNumber,
                        ...O.match(row.part, { onNone: () => ({}), onSome: (part) => ({ label: String(part) }) }),
                        reason: row.reason
                      }
                    ]
                  : []
              )
            })
          )
        }
      >
        Download {result.notImported} not imported
      </Button>
    )

  const takeBackButton = canTakeBack ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={takingBack}>
          {takingBack ? "Taking back" : "Take back this import"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Take back this import?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              <p>
                This {undoes}.
                {changedCount === 0
                  ? null
                  : ` It keeps the ${changedCount === 1 ? "item" : `${changedCount} items`} someone changed since:`}
              </p>
              {changedCount === 0 ? null : <ChangedList items={changed} count={changedCount} />}
              <p>Your decisions in the review are kept, so you can review the file again and confirm it.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep the items</AlertDialogCancel>
          <AlertDialogAction onClick={() => takeBack()}>
            {restorable === 0 ? `Take back ${items(removable)}` : "Take back this import"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={takenBack ? `Took back ${view.fileName}` : `Imported ${view.fileName}`}
        line={
          takenBack && lastTakeBack !== undefined
            ? `${lastTakeBack.by} · ${when(lastTakeBack.at)} · removed ${items(lastTakeBack.removed)}${lastTakeBack.restored > 0 ? ` · restored ${lastTakeBack.restored}` : ""}`
            : // What the form-only rules changed without the person, counted from what the confirms stored.
              `${result.importedBy} · ${when(result.importedAt)}${result.fixed.cells === 0 ? "" : ` · ${result.fixed.cells} values fixed for you in ${result.fixed.rows} ${result.fixed.rows === 1 ? "row" : "rows"}`}`
        }
        actions={
          takenBack ? (
            <>
              <Button variant="outline" onClick={() => navigate("/items")}>
                View items
              </Button>
              {props.canImport ? (
                <Button disabled={reopening} onClick={() => reopen()}>
                  {reopening ? "Opening the review" : "Review again"}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {downloadButton}
              {result.notImported === 0 || !props.canImport ? null : (
                <Button variant="outline" disabled={reopening} onClick={() => reopen()}>
                  {reopening ? "Opening the review" : `Fix ${result.notImported} not imported`}
                </Button>
              )}
              {takeBackButton}
              <Button onClick={() => navigate("/items")}>View items</Button>
            </>
          )
        }
      />
      {O.match(O.map(leftOver, leftOverLines), {
        onNone: () => null,
        onSome: (lines) => (
          <div className="px-4 pb-3 sm:px-9">
            <Alert role="alert">
              <AlertTitle>
                {lines.length === 1
                  ? "1 decision of yours was not part of this import"
                  : `${lines.length} decisions of yours were not part of this import`}
              </AlertTitle>
              <AlertDescription>
                <p>
                  The import was confirmed before {lines.length === 1 ? "it was" : "they were"} saved, so the rows were
                  imported as the review stood without {lines.length === 1 ? "it" : "them"}:
                </p>
                <ul className="list-disc pl-4">
                  {A.map(lines, (line) => (
                    <li key={line.id}>
                      {line.row}: you {line.decided}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )
      })}
      {changedCount > 0 && !takenBack ? (
        <div className="px-4 pb-3 sm:px-9">
          <Alert>
            <AlertTitle>
              {noLonger
                ? "This import can no longer be taken back"
                : `${changedCount === 1 ? "One item" : `${changedCount} items`} changed after this import`}
            </AlertTitle>
            <AlertDescription>
              <p>
                {noLonger
                  ? "Every item it created or replaced has been changed since:"
                  : `Taking it back ${undoes} and keeps ${changedCount === 1 ? "this one" : "these"}:`}
              </p>
              <ChangedList items={changed} count={changedCount} />
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {takenBack && keptCount > 0 ? (
        <div className="px-4 pb-3 sm:px-9">
          <Alert>
            <AlertTitle>
              Kept {items(keptCount)} that {keptCount === 1 ? "was" : "were"} changed after the import
            </AlertTitle>
            <AlertDescription>
              <ChangedList items={kept} count={keptCount} />
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {putsBack === null && view.unusedColumns.length === 0 ? null : (
        <p className="px-4 pb-2 text-sm text-muted-foreground sm:px-9">
          {[...(putsBack === null ? [] : [putsBack]), ...view.unusedColumns.map(notImportedColumn)].join(" · ")}
        </p>
      )}
      {view.history.length > 1 ? (
        <ol
          aria-label="History of this import"
          className="flex flex-wrap gap-x-4 gap-y-0.5 px-4 pb-2 text-sm text-muted-foreground sm:px-9"
        >
          {view.history.map((event, index) => (
            <li key={`${event.batchId}:${event._tag}`} className="tabular-nums">
              {index === 0 ? "" : "Then: "}
              {eventLine(event)}
            </li>
          ))}
        </ol>
      ) : null}
      <Views label="Rows to show">
        {views.map(([id, label, n]) => (
          <Button key={id} variant="ghost" size="sm" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label} {n}
          </Button>
        ))}
      </Views>
      <RecordsTable
        key={filter}
        caption={`What happened to each row of ${view.fileName}`}
        columns={columns}
        rows={shown}
        rowKey={(row) =>
          rowId({
            rowNumber: row.rowNumber,
            ...O.match(row.part, { onNone: () => ({}), onSome: (part) => ({ part }) })
          })
        }
        empty={
          <>
            No rows here.{" "}
            <Button variant="link" size="sm" onClick={() => setFilter("all")}>
              Show all {result.rows.length}
            </Button>
          </>
        }
      />
    </div>
  )
}
