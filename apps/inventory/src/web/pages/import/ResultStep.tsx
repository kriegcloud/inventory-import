import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
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
import { call } from "@/lib/api"
import { whenShort } from "@inventory/ui/Dates"
import { useImportCache } from "@/lib/imports"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "@/lib/route"
import type { ChangedItem, ImportEvent, ImportResult, ImportView, RowOutcome } from "../../../api/v1/Api.ts"
import { notImportedCsv, rowId, rowPlace, type StagedTable } from "../../../domain/ItemImport.ts"
import { download, importWords, notImportedColumn, OutcomePill, Text, when } from "./format.tsx"
import { toastError } from "@inventory/client/SayError"
import { queryKeys } from "@/lib/queries"

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
    blank: (row) => row.reason === "",
    cell: (row) => (row.decidedByName === null ? row.reason : `${row.reason} (${row.decidedByName})`)
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
    cell: (row) => rowPlace({ rowNumber: row.rowNumber, label: row.part === undefined ? undefined : String(row.part) }),
    sort: (row) => row.rowNumber * 1000 + (row.part ?? 0)
  }
]

const items = (n: number) => `${n} ${n === 1 ? "item" : "items"}`

/** An item someone changed, in words: its SKU and name, who changed it and when. */
function Changed(props: { item: ChangedItem }) {
  return (
    <>
      <Code>{props.item.sku}</Code> {props.item.name}, changed by {props.item.changedBy} on{" "}
      {whenShort(props.item.changedAt)}
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
const eventLine = (event: ImportEvent): string =>
  event._tag === "Confirmed"
    ? `Imported ${items(event.created)}${event.updated === 0 ? "" : `, updated ${event.updated}`}, ${event.by}, ${whenShort(event.at)}`
    : `Took back ${items(event.removed)}${event.restored === 0 ? "" : `, restored ${event.restored}`}${event.kept === 0 ? "" : `, kept ${event.kept}`}, ${event.by}, ${whenShort(event.at)}`

/**
 * What the import did, row by row: imported, updated, already there, not imported with the reason, or taken back. The rows
 * that were not imported can be downloaded with their reasons. While its items are as it created them, the import
 * can be taken back: the confirm says what it will remove and keep, and once every item has changed the screen says
 * it can no longer be done. After a take-back the review comes back with every decision, so nothing is done twice.
 */
export function ResultStep(props: { view: ImportView; result: ImportResult; table: StagedTable; canImport: boolean }) {
  const { view, result, table } = props
  const cache = useImportCache()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>(
    view.status === "takenBack" ? "takenBack" : result.notImported > 0 ? "notImported" : "all"
  )
  const reopen = useMutation({
    mutationFn: () => call((api) => api.imports.reopen({ params: { id: view.id } })),
    onSuccess: (opened) => {
      cache.setView(opened)
      void queryClient.invalidateQueries({ queryKey: queryKeys.openImports })
      void queryClient.invalidateQueries({ queryKey: queryKeys.pastImports })
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity })
      navigate(importAddress(opened.id, "review"))
    },
    onError: (error) => toastError(error)
  })
  const takeBack = useMutation({
    mutationFn: () =>
      call((api) => api.imports.takeBack({ params: { id: view.id }, payload: { confirms: view.takeBack.confirms } })),
    onSuccess: (done) => {
      cache.setView(done)
      const last = done.history.at(-1)
      toast.success(
        last?._tag === "TakenBack"
          ? // The event's numbers are the whole take-back's, over every confirm it undid.
            `Took back ${items(last.removed)} from ${done.fileName}${last.restored === 0 ? "" : `, restored ${last.restored}`}${last.kept === 0 ? "" : `, kept ${last.kept}`}`
          : `${done.fileName} has nothing left to take back`
      )
      setFilter("takenBack")
      void queryClient.invalidateQueries({ queryKey: queryKeys.items })
      void queryClient.invalidateQueries({ queryKey: queryKeys.changes })
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity })
      void queryClient.invalidateQueries({ queryKey: queryKeys.openImports })
      void queryClient.invalidateQueries({ queryKey: queryKeys.pastImports })
    },
    onError: (error) => {
      toastError(error)
      void queryClient.invalidateQueries({ queryKey: queryKeys.import(view.id) })
    }
  })
  const shown = useMemo(() => result.rows.filter((row) => filter === "all" || row.outcome === filter), [result, filter])
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

  const { removable, restorable, changed, changedCount, kept, keptCount, confirms } = view.takeBack
  const takenBack = view.status === "takenBack"
  const lastTakeBack = view.history.findLast((event) => event._tag === "TakenBack")
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
              rows: result.rows
                .filter((row) => row.outcome === "notImported")
                .map((row) => ({
                  rowNumber: row.rowNumber,
                  ...(row.part === undefined ? {} : { label: String(row.part) }),
                  reason: row.reason
                }))
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
        <Button variant="outline" disabled={takeBack.isPending}>
          {takeBack.isPending ? "Taking back" : "Take back this import"}
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
          <AlertDialogAction onClick={() => takeBack.mutate()}>
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
            ? `${lastTakeBack.by} · ${when(lastTakeBack.at)} · removed ${items(lastTakeBack._tag === "TakenBack" ? lastTakeBack.removed : 0)}${lastTakeBack._tag === "TakenBack" && lastTakeBack.restored > 0 ? ` · restored ${lastTakeBack.restored}` : ""}`
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
                <Button disabled={reopen.isPending} onClick={() => reopen.mutate()}>
                  {reopen.isPending ? "Opening the review" : "Review again"}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {downloadButton}
              {result.notImported === 0 || !props.canImport ? null : (
                <Button variant="outline" disabled={reopen.isPending} onClick={() => reopen.mutate()}>
                  {reopen.isPending ? "Opening the review" : `Fix ${result.notImported} not imported`}
                </Button>
              )}
              {takeBackButton}
              <Button onClick={() => navigate("/items")}>View items</Button>
            </>
          )
        }
      />
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
        rowKey={(row) => rowId(row)}
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
