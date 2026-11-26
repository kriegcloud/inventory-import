// One line of the audit trail, as a statement a store puts in its batch: the catalog's own copy of the insert the
// access host has (a host may not import another host). The one thing not to break: it is always run in the same
// batch as the write it records, so a line never says something that did not happen.
import * as S from "effect/Schema"
import { OrganizationId, MemberId } from "@inventory/kernel/Ids"
import { Activity } from "@inventory/kernel/Activity"
import * as SqlClient from "effect/sql/SqlClient"
import { D1, NoRows } from "@beep/d1/D1"
import { D1Instant } from "@beep/d1/D1Instant"

const Line = S.Struct({
  id: S.String,
  org: OrganizationId,
  actor: MemberId,
  name: S.String,
  action: S.String,
  detail: S.String,
  agent: S.OptionFromNullOr(S.String),
  at: D1Instant
}).annotate({ description: "One audit line as the activity table holds it" })

/** The audit line's columns, from the `Activity` a handler made. */
export const lineOf = (activity: Activity): typeof Line.Type => ({
  id: activity.id,
  org: activity.organizationId,
  actor: activity.actorId,
  name: activity.actorName,
  action: activity.action,
  detail: activity.detail,
  agent: activity.agent,
  at: activity.createdAt
})

/** The insert of one audit line. */
export const auditLine = (sql: SqlClient.SqlClient) =>
  D1.statement({
    Request: Line,
    Result: NoRows,
    execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt, agent)
      VALUES (${r.id}, ${r.org}, ${r.actor}, ${r.name}, ${r.action}, ${r.detail}, ${r.at}, ${r.agent})`
  })
