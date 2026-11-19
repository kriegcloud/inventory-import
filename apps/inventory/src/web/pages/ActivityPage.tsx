import { useQuery } from "@tanstack/react-query"
import { DateTime } from "effect"
import { useState } from "react"
import { Code } from "@inventory/ui/Code"
import { importAddress } from "@/lib/route"
import { PageHeader, Views } from "@inventory/ui/PageHeader"
import { ProposedValue } from "@inventory/ui/ProposedValue"
import { type ListColumn, ListTable } from "@inventory/ui/ListTable"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { TableSkeleton } from "@inventory/ui/Skeletons"
import { Button } from "@inventory/ui/components/button"
import { call } from "@/lib/api"
import type { ChangeRecord } from "../../api/v1/Api.ts"
import type { Activity } from "@inventory/kernel/Activity"
import { fieldLabels } from "../../domain/ItemImport.ts"
import { whenShort } from "@/lib/dates"
import { when } from "./import/format.tsx"
import { sayError } from "@inventory/client/SayError"
import { queryKeys } from "@/lib/queries"
import { usePastImports } from "@/lib/imports"
import { pastImportColumns } from "./import/pastImports.tsx"

type Event = (typeof Activity.json)["Type"]

const sourceWords = { rule: "Rule", model: "Model", person: "Person" } as const

const proposedBy = (change: ChangeRecord): string => sourceWords[change.source]
const decidedBy = (change: ChangeRecord): string =>
  change.decidedBy === "rule" ? "Rule" : (change.decidedByName ?? "Person")

const changeColumns: ReadonlyArray<ListColumn<ChangeRecord>> = [
  {
    id: "sku",
    label: "Item",
    width: 112,
    // A value whose import was taken back is kept still; the item it went into is gone.
    cell: (change) =>
      change.takenBack ? (
        <>
          <Code>{change.sku}</Code> <span className="font-normal text-muted-foreground">taken back</span>
        </>
      ) : (
        <Code>{change.sku}</Code>
      ),
    title: (change) => (change.takenBack ? `${change.sku}, taken back with its import` : change.sku),
    value: (change) => change.sku
  },
  {
    id: "row",
    label: "Row",
    width: 64,
    align: "right",
    cell: (change) => (change.part === undefined ? change.rowNumber : `${change.rowNumber} · ${change.part}`),
    value: (change) => change.rowNumber,
    searchable: false
  },
  {
    id: "field",
    label: "Field",
    width: 124,
    value: (change) => fieldLabels[change.field],
    facet: true
  },
  {
    id: "change",
    label: "Was, now",
    width: 150,
    cell: (change) => <ProposedValue from={change.from === "" ? "empty" : change.from} to={change.to} />,
    // Searched by both values; a pair has no one order to sort by.
    value: (change) => `${change.from} ${change.to}`,
    sortable: false
  },
  {
    id: "source",
    label: "Proposed by",
    width: 112,
    // Who proposed it and how sure they were, in one column: beside the sidebar ten columns did not fit, and the
    // table ran past its frame with the file and the time out of sight.
    cell: (change) => (
      <>
        {proposedBy(change)}
        {change.confidence === null ? null : <span className="text-muted-foreground"> · {change.confidence}</span>}
      </>
    ),
    title: (change) => `${proposedBy(change)}${change.confidence === null ? "" : `, confidence ${change.confidence}`}`,
    value: proposedBy,
    facet: true
  },
  {
    id: "decided",
    label: "Decided by",
    width: 112,
    value: decidedBy,
    facet: true
  },
  {
    id: "basis",
    label: "Basis",
    value: (change) => change.basis ?? change.how,
    sortable: false,
    wrap: true
  },
  {
    id: "file",
    label: "File",
    width: 100,
    // The way back to a confirmed import: its result, with the rows not imported and the take-back.
    cell: (change) => (
      <a className="underline underline-offset-4" href={importAddress(change.importId, "result")}>
        {change.fileName}
      </a>
    ),
    title: (change) => change.fileName,
    value: (change) => change.fileName,
    facet: true
  },
  {
    id: "when",
    label: "When",
    width: 124,
    cell: (change) => whenShort(change.createdAt),
    title: (change) => when(change.createdAt),
    value: (change) => change.createdAt,
    searchable: false
  }
]

const eventColumns: ReadonlyArray<ListColumn<Event>> = [
  { id: "action", label: "What", width: 220, value: (event) => event.action, facet: true },
  { id: "who", label: "Who", width: 200, value: (event) => event.actorName, facet: true },
  { id: "detail", label: "Detail", value: (event) => event.detail, sortable: false, wrap: true },
  // The same short form as the decisions' column, so the two lists on this page read alike.
  {
    id: "when",
    label: "When",
    width: 150,
    cell: (event) => whenShort(DateTime.formatIso(event.createdAt)),
    title: (event) => when(DateTime.formatIso(event.createdAt)),
    value: (event) => DateTime.formatIso(event.createdAt),
    searchable: false
  }
]

/**
 * Who decided what. "Decisions" lists every value an import wrote that differs from the file: what it was, what
 * it became, who proposed it and who accepted or typed it. "Events" is the audit trail of uploads and imports.
 * "Imports" lists every confirmed import, a clean file's too, each a link back to its result.
 */
export function ActivityPage() {
  const [chosen, setView] = useState<"decisions" | "events" | "imports">()
  const changes = useQuery({ queryKey: queryKeys.changes, queryFn: () => call((api) => api.imports.changes()) })
  const events = useQuery({ queryKey: queryKeys.activity, queryFn: () => call((api) => api.activity.recent()) })
  const past = usePastImports()
  // Until the person chooses, the page opens on the list that has something in it: an empty "Decisions" beside
  // nine events read as "nothing has happened here".
  const view = chosen ?? (changes.data?.length === 0 && (events.data?.length ?? 0) > 0 ? "events" : "decisions")
  const shown = view === "decisions" ? changes : view === "events" ? events : past
  const failed = shown.error
  const loading = shown.data === undefined
  const older = past.data?.older ?? 0
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Activity" />
      <Views label="What to show">
        <Button variant="ghost" size="sm" aria-pressed={view === "decisions"} onClick={() => setView("decisions")}>
          Decisions {changes.data?.length ?? ""}
        </Button>
        <Button variant="ghost" size="sm" aria-pressed={view === "events"} onClick={() => setView("events")}>
          Events {events.data?.length ?? ""}
        </Button>
        <Button variant="ghost" size="sm" aria-pressed={view === "imports"} onClick={() => setView("imports")}>
          Imports {past.data === undefined ? "" : past.data.imports.length + past.data.older}
        </Button>
      </Views>
      {failed !== null ? (
        <div className="px-4 sm:px-9">
          <Alert variant="destructive">
            <AlertTitle>The activity could not be loaded</AlertTitle>
            <AlertDescription>
              {sayError(failed).sentence}
              <Button variant="outline" size="sm" onClick={() => void shown.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : loading ? (
        view === "imports" ? (
          <TableSkeleton caption="Imports that were confirmed" columns={pastImportColumns} />
        ) : (
          <TableSkeleton
            caption={view === "decisions" ? "Values that imports changed, and who decided each" : "Uploads and imports"}
            columns={view === "decisions" ? changeColumns : eventColumns}
          />
        )
      ) : view === "imports" ? (
        <>
          <ListTable
            key="imports"
            caption="Imports that were confirmed"
            searchLabel="Search imports"
            columns={pastImportColumns}
            rows={past.data?.imports ?? []}
            rowKey={(entry) => entry.id}
            empty="No import has been confirmed yet. Each one confirmed appears here, with a link to its result."
          />
          {older === 0 ? null : (
            <p className="px-4 py-2 text-sm text-muted-foreground sm:px-9">
              {older} older {older === 1 ? "import is" : "imports are"} not listed.
            </p>
          )}
        </>
      ) : view === "decisions" ? (
        <ListTable
          key="decisions"
          caption="Values that imports changed, and who decided each"
          searchLabel="Search decisions"
          columns={changeColumns}
          rows={changes.data ?? []}
          rowKey={(change) =>
            `${change.importId}:${change.rowNumber}.${change.part ?? 0}:${change.field}:${change.createdAt}`
          }
          empty="No decisions yet. They appear here once an import with accepted or typed values is confirmed."
        />
      ) : (
        <ListTable
          key="events"
          caption="Uploads and imports"
          searchLabel="Search events"
          columns={eventColumns}
          rows={events.data ?? []}
          rowKey={(event) => event.id}
          empty="Nothing has happened yet."
        />
      )}
    </div>
  )
}
