import * as A from "effect/Array"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as DateTime from "effect/DateTime"
import * as Atom from "effect/reactivity/Atom"
import { answerOf } from "@inventory/client/Api"
import type { Activity } from "@inventory/kernel/Activity"
import { when, whenShort } from "@inventory/ui/Dates"
import { type ListColumn, ListTable } from "@inventory/ui/ListTable"
import { accessApi, accessKeys } from "./Access.runtime.ts"

type AuditEvent = (typeof Activity.json)["Type"]

/** The columns of the audit trail's list: what was done, who did it, the sentence, and when. */
export const auditEventColumns: ReadonlyArray<ListColumn<AuditEvent>> = [
  { id: "action", label: "What", width: 220, value: (event) => event.action, facet: true },
  { id: "who", label: "Who", width: 200, value: (event) => event.actorName, facet: true },
  { id: "detail", label: "Detail", value: (event) => event.detail, sortable: false, wrap: true },
  // The same short form as the decisions' column, so the lists on the Activity page read alike.
  {
    id: "when",
    label: "When",
    width: 150,
    cell: (event) => whenShort(event.createdAt),
    title: (event) => when(event.createdAt),
    value: (event) => DateTime.formatIso(event.createdAt),
    searchable: false
  }
]

/** What the audit trail's list is called, for its table and for the placeholder shown while it loads. */
export const auditEventsCaption = "Uploads and imports"

/**
 * The audit trail of the signed-in member's organization, newest first, fetched once and shared. Anything that writes
 * an audit line says `accessKeys.activity` changed, and it is asked again.
 */
export const auditEvents = accessApi.query((api) => api.activity.recent(), {
  keep: "unwatched",
  reactivityKeys: O.some(accessKeys.activity)
})

const auditEventAnswer = answerOf(auditEvents)
/** The audit trail's rows and columns as the list follows them: empty until the trail has been read. */
const auditEventRows = Atom.map(auditEventAnswer, (answer) =>
  O.match(O.fromNullishOr(answer), { onNone: A.empty<AuditEvent>, onSome: identity })
)
const auditEventColumnsAtom = Atom.make(auditEventColumns)

/** The audit trail as a list a person searches and filters: every upload, import, take-back and change of role. */
export function AuditEvents({ updating = false }: { updating?: boolean }) {
  return (
    <ListTable
      key="events"
      caption={auditEventsCaption}
      searchLabel="Search events"
      columns={auditEventColumnsAtom}
      rows={auditEventRows}
      rowKey={(event) => event.id}
      empty="Nothing has happened yet."
      updating={updating}
    />
  )
}
