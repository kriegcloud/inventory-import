/**
 * Reads of the actor's organization's audit trail.
 *
 * @packageDocumentation
 */
import { CurrentActor } from "@inventory/kernel/Actor"
import * as Effect from "effect/Effect"
import { AuditTrailStore } from "./AuditTrailStore.port.ts"

/**
 * Who did what in the actor's organization, newest first. Any member may read it.
 *
 * @category handlers
 */
export const recentActivity = Effect.fnUntraced(function* () {
  const actor = yield* CurrentActor
  const store = yield* AuditTrailStore
  return yield* store.recent(actor.organizationId)
})

/**
 * How many audit lines the actor's organization has.
 *
 * @category handlers
 */
export const activityCount = Effect.fnUntraced(function* () {
  const actor = yield* CurrentActor
  const store = yield* AuditTrailStore
  return yield* store.count(actor.organizationId)
})
