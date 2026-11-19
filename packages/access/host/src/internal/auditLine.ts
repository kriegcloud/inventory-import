// The audit line of a change, as the one INSERT every access write sends beside it: written only when `guard` holds,
// which is the same condition as the change it records, so a refused change leaves no line.
import { D1, NoRows } from "@beep/d1/D1"
import { Activity } from "@inventory/kernel/Activity"
import { MemberId } from "@inventory/kernel/Ids"
import * as S from "effect/Schema"
import type * as SqlClient from "effect/sql/SqlClient"
import type * as Statement from "effect/sql/Statement"

/** An audit line and the member its change is about, for the guard. */
const Guarded = S.Struct({ line: Activity, member: MemberId })

/**
 * The statement that writes `line` when `guard` holds for its organization and the member it is about.
 */
export const auditLine = ({
  guard,
  sql
}: {
  readonly sql: SqlClient.SqlClient
  readonly guard: (scope: { readonly org: string; readonly member: string }) => Statement.Fragment
}) =>
  D1.statement({
    Request: Guarded,
    Result: NoRows,
    execute: ({
      line,
      member
    }) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
      SELECT ${line.id}, ${line.organizationId}, ${line.actorId}, ${line.actorName}, ${line.action}, ${line.detail},
        ${line.createdAt}
      WHERE ${guard({ org: line.organizationId, member })}`
  })
