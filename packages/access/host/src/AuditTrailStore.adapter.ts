/**
 * The audit trail's read side on D1. Lines are written by the adapters that do the thing a line records, in the same
 * batch as that thing (an upload, an import, a change of role), never on their own.
 *
 * @packageDocumentation
 */
import { AuditTrailStore } from "@inventory/access-model/AuditTrailStore"
import { Activity } from "@inventory/kernel/Activity"
import { OrganizationId } from "@inventory/kernel/Ids"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as SqlClient from "effect/sql/SqlClient"
import * as SqlSchema from "effect/sql/SqlSchema"

/** How many lines of the audit trail one organization has, as the count query answers it. */
const ActivityCount = S.Struct({ n: S.Int }).annotate({
  description: "COUNT(*) of an organization's audit lines"
})

/**
 * `AuditTrailStore` over the `activity` table. Every query names the organization, so none can forget its tenant.
 *
 * @category layers
 */
export const AuditTrailStoreD1: Layer.Layer<AuditTrailStore, never, SqlClient.SqlClient> = Layer.effect(
  AuditTrailStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const findRecent = SqlSchema.findAll({
      Request: OrganizationId,
      Result: Activity,
      execute: (organizationId) =>
        sql`SELECT id, organizationId, actorId, actorName, action, detail, agent, createdAt FROM activity
          WHERE organizationId = ${organizationId} ORDER BY createdAt DESC LIMIT 500`
    })
    const countOf = SqlSchema.findOneOption({
      Request: OrganizationId,
      Result: ActivityCount,
      execute: (organizationId) => sql`SELECT COUNT(*) AS n FROM activity WHERE organizationId = ${organizationId}`
    })

    return AuditTrailStore.of({
      recent: Effect.fn("Activities.recent")(function* (organization: OrganizationId) {
        return yield* findRecent(organization)
      }, Effect.orDie),
      count: Effect.fn("Activities.count")(function* (organization: OrganizationId) {
        const found = yield* countOf(organization)
        return yield* O.match(found, {
          onNone: () => Effect.die("COUNT(*) returned no activity count row"),
          onSome: (row) => Effect.succeed(row.n)
        })
      }, Effect.orDie)
    })
  })
)
