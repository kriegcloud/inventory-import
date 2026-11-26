import * as A from "effect/Array"
import * as R from "effect/Record"
import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react"
import * as Cause from "effect/Cause"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { PageHeader, Views } from "@inventory/ui/PageHeader"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import { TableSkeleton } from "@inventory/ui/Skeletons"
import { Button } from "@inventory/ui/components/button"
import { AuditEvents, auditEventColumns, auditEvents, auditEventsCaption } from "@inventory/access-web/AuditEvents"
import {
  importDecisionColumns,
  ImportDecisions,
  importDecisionsCaption,
  importDecisions
} from "@inventory/catalog-web/ImportDecisions"
import { ofMember } from "@inventory/client/MemberAtoms"
import { sayError } from "@inventory/client/SayError"
import { pastImports } from "@inventory/catalog-web/Imports"
import { pastImportColumns, pastImportsCaption, PastImportsList } from "@inventory/catalog-web/PastImports"

/** The list the person chose; none until they choose, and the page opens on the one with something in it. */
export const chosenView = ofMember((): O.Option<"decisions" | "events" | "imports"> => O.none())

/**
 * Who decided what: the shell over three lists. "Decisions" is the catalog screens' list of every value an import
 * wrote that differs from the file (`@inventory/catalog-web/ImportDecisions`). "Events" is the audit trail (the access screens' list, `@inventory/access-web/AuditEvents`).
 * "Imports" lists every confirmed import, a clean file's too, each a link back to its result.
 */
export function ActivityPage() {
  const [chosen, choose] = useAtom(chosenView)
  const setView = (view: "decisions" | "events" | "imports") => choose(O.some(view))
  const changesRead = useAtomValue(importDecisions)
  const askChangesAgain = useAtomRefresh(importDecisions)
  const pastRead = useAtomValue(pastImports)
  const askPastAgain = useAtomRefresh(pastImports)
  // Each list in the same shape, for the one error and skeleton below.
  const shapeOf = <A,>(read: AsyncResult.AsyncResult<A, unknown>, refetch: () => void) => ({
    data: AsyncResult.value(read),
    error: AsyncResult.isFailure(read) && !read.waiting ? read.cause.pipe(Cause.squash, O.fromNullOr) : O.none(),
    updating: read.waiting,
    refetch
  })
  const changes = shapeOf(changesRead, askChangesAgain)
  const eventsRead = useAtomValue(auditEvents)
  const askEventsAgain = useAtomRefresh(auditEvents)
  const events = shapeOf(eventsRead, askEventsAgain)
  const past = shapeOf(pastRead, askPastAgain)
  // Until the person chooses, the page opens on the list that has something in it: an empty "Decisions" beside
  // nine events read as "nothing has happened here".
  const view = O.match(chosen, {
    onSome: (chosen) => chosen,
    onNone: () =>
      O.exists(changes.data, (rows) => rows.length === 0) && O.exists(events.data, (rows) => rows.length > 0)
        ? "events"
        : "decisions"
  })
  const shown = view === "decisions" ? changes : view === "events" ? events : past
  const loading =
    view === "decisions" ? O.isNone(changes.data) : view === "events" ? O.isNone(events.data) : O.isNone(past.data)
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Activity" />
      <Views label="What to show">
        <Button variant="ghost" size="sm" aria-pressed={view === "decisions"} onClick={() => setView("decisions")}>
          Decisions {O.match(changes.data, { onNone: () => "", onSome: (rows) => rows.length })}
        </Button>
        <Button variant="ghost" size="sm" aria-pressed={view === "events"} onClick={() => setView("events")}>
          Events {O.match(events.data, { onNone: () => "", onSome: (rows) => rows.length })}
        </Button>
        <Button variant="ghost" size="sm" aria-pressed={view === "imports"} onClick={() => setView("imports")}>
          Imports {O.match(past.data, { onNone: () => "", onSome: (page) => page.imports.length + page.older })}
        </Button>
      </Views>
      {O.match(shown.error, {
        onSome: (failed) => (
          <div className="px-4 sm:px-9">
            <Alert variant="destructive">
              <AlertTitle>The activity could not be loaded</AlertTitle>
              <AlertDescription>
                {sayError(failed, { fields: {} }).sentence}
                <Button variant="outline" size="sm" onClick={() => shown.refetch()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ),
        onNone: () =>
          loading ? (
            view === "imports" ? (
              <TableSkeleton
                caption={pastImportsCaption}
                columns={A.map(pastImportColumns, (column) => ({
                  label: O.some(column.label),
                  ...R.getSomes({ width: column.width })
                }))}
              />
            ) : (
              <TableSkeleton
                caption={view === "decisions" ? importDecisionsCaption : auditEventsCaption}
                columns={A.map(view === "decisions" ? importDecisionColumns : auditEventColumns, (column) => ({
                  label: O.some(column.label),
                  ...R.getSomes({ width: column.width })
                }))}
              />
            )
          ) : view === "imports" ? (
            O.match(past.data, {
              onNone: () => (
                <TableSkeleton
                  caption={pastImportsCaption}
                  columns={A.map(pastImportColumns, (column) => ({
                    label: O.some(column.label),
                    ...R.getSomes({ width: column.width })
                  }))}
                />
              ),
              onSome: (page) => <PastImportsList older={page.older} />
            })
          ) : view === "decisions" ? (
            <ImportDecisions />
          ) : (
            <AuditEvents updating={events.updating} />
          )
      })}
    </div>
  )
}
