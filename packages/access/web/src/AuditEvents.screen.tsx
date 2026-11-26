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
  {
    title: O.none(),
    cell: O.none(),
    id: "action",
    label: "What",
    width: O.some(220),
    value: O.some((event) => event.action),
    facet: true
  },
  {
    title: O.none(),
    cell: O.none(),
    id: "who",
    label: "Who",
    width: O.some(200),
    value: O.some((event) => event.actorName),
    facet: true
  },
  {
    title: O.none(),
    cell: O.none(),
    width: O.none(),
    id: "detail",
    label: "Detail",
    value: O.some((event) => event.detail),
    sortable: false,
    wrap: true
  },
  // The same short form as the decisions' column, so the lists on the Activity page read alike.
  {
    id: "when",
    label: "When",
    width: O.some(150),
    cell: O.some((event) => whenShort(event.createdAt)),
    title: O.some((event) => when(event.createdAt)),
    value: O.some((event) => DateTime.formatIso(event.createdAt)),
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
  O.match(answer, { onNone: A.empty<AuditEvent>, onSome: identity })
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
