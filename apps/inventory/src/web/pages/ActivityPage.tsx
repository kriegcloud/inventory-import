import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react"
import * as Cause from "effect/Cause"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { PageHeader, Views } from "@inventory/ui/PageHeader"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { TableSkeleton } from "@inventory/ui/Skeletons"
import { Button } from "@inventory/ui/components/button"
import { AuditEvents, auditEventColumns, auditEvents, auditEventsCaption } from "@inventory/access-web/AuditEvents"
import {
  importDecisionColumns,
  ImportDecisions,
  importDecisionsCaption,
  useImportDecisions
} from "@inventory/catalog-web/ImportDecisions"
import { sayError } from "@inventory/client/SayError"
import { usePastImports } from "@inventory/catalog-web/Imports"
import { pastImportColumns, pastImportsCaption, PastImportsList } from "@inventory/catalog-web/PastImports"

/** The list the person chose; none until they choose, and the page opens on the one with something in it. */
const chosenView = Atom.make<O.Option<"decisions" | "events" | "imports">>(O.none())

/**
 * Who decided what: the shell over three lists. "Decisions" is the catalog screens' list of every value an import
 * wrote that differs from the file (`@inventory/catalog-web/ImportDecisions`). "Events" is the audit trail (the access screens' list, `@inventory/access-web/AuditEvents`).
 * "Imports" lists every confirmed import, a clean file's too, each a link back to its result.
 */
export function ActivityPage() {
  const [chosen, choose] = useAtom(chosenView)
  const setView = (view: "decisions" | "events" | "imports") => choose(O.some(view))
  const changes = useImportDecisions()
  const eventsRead = useAtomValue(auditEvents)
  const askEventsAgain = useAtomRefresh(auditEvents)
  // The audit trail in the shape of the two lists still read through the catalog screens' cache (goals/atoms, step 6).
  const events = {
    data: eventsRead.pipe(AsyncResult.value, O.getOrUndefined),
    error: eventsRead._tag === "Failure" && !eventsRead.waiting ? Cause.squash(eventsRead.cause) : null,
    updating: eventsRead.waiting,
    refetch: () => {
      askEventsAgain()
      return Promise.resolve()
    }
  }
  const past = usePastImports()
  // Until the person chooses, the page opens on the list that has something in it: an empty "Decisions" beside
  // nine events read as "nothing has happened here".
  const view =
    O.getOrUndefined(chosen) ?? (changes.data?.length === 0 && (events.data?.length ?? 0) > 0 ? "events" : "decisions")
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
          <TableSkeleton caption={pastImportsCaption} columns={pastImportColumns} />
        ) : (
          <TableSkeleton
            caption={view === "decisions" ? importDecisionsCaption : auditEventsCaption}
            columns={view === "decisions" ? importDecisionColumns : auditEventColumns}
          />
        )
      ) : view === "imports" ? (
        <PastImportsList rows={past.data?.imports ?? []} older={older} />
      ) : view === "decisions" ? (
        <ImportDecisions rows={changes.data ?? []} />
      ) : (
        <AuditEvents rows={events.data ?? []} updating={events.updating} />
      )}
    </div>
  )
}
