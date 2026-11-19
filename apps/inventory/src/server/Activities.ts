import { Context, Effect, Layer, Option } from "effect"
import * as S from "effect/Schema"
import { SqlClient, SqlSchema } from "effect/sql"
import { Activity } from "@inventory/kernel/Activity"
import { OrganizationId } from "@inventory/kernel/Ids"

/** How many lines of the audit trail one organization has, as the count query answers it. */
const ActivityCount = S.Struct({ n: S.Int }).annotate({
  description: "COUNT(*) of an organization's audit lines"
})

/**
 * Reads of the audit trail. Lines are written by the services that do the thing a line items, in the same
 * batch as that thing (an upload, an import, a change of role), never on their own: see `Imports` and `People`.
 * Every method takes the organization explicitly, so a query cannot forget its tenant.
 */
export class Activities extends Context.Service<
  Activities,
  {
    /** The organization's newest 500 lines, newest first. */
    recent(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<Activity>>
    /** How many lines the organization has: the status endpoint's proof that the database answers for this tenant. */
    count(organizationId: OrganizationId): Effect.Effect<number>
  }
>()("@inventory/app/server/Activities") {
  static readonly layer = Layer.effect(
    Activities,
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

      // Inside an agent run (`asAgent`, @inventory/kernel/Agent) the row names the agent; the actor is still the person it acted for.
      const recent = Effect.fn("Activities.recent")(function* (organizationId: OrganizationId) {
        return yield* findRecent(organizationId)
      }, Effect.orDie)

      const count = Effect.fn("Activities.count")(function* (organizationId: OrganizationId) {
        const found = yield* countOf(organizationId)
        return Option.match(found, { onNone: () => 0, onSome: (row) => row.n })
      }, Effect.orDie)

      return Activities.of({ recent, count })
    })
  )
}
