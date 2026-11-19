import { useQuery } from "@tanstack/react-query"
import { DateTime } from "effect"
import type { Activity } from "@inventory/kernel/Activity"
import { when, whenShort } from "@inventory/ui/Dates"
import { type ListColumn, ListTable } from "@inventory/ui/ListTable"
import { accessKeys, useAccess } from "./Access.runtime.ts"

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

/** The audit trail of the signed-in member's organization, newest first, fetched once and shared. */
export const useAuditEvents = () => {
  const { call } = useAccess()
  return useQuery({ queryKey: accessKeys.activity, queryFn: () => call((api) => api.activity.recent()) })
}

/** The audit trail as a list a person searches and filters: every upload, import, take-back and change of role. */
export function AuditEvents(props: { rows: ReadonlyArray<AuditEvent> }) {
  return (
    <ListTable
      key="events"
      caption={auditEventsCaption}
      searchLabel="Search events"
      columns={auditEventColumns}
      rows={props.rows}
      rowKey={(event) => event.id}
      empty="Nothing has happened yet."
    />
  )
}
