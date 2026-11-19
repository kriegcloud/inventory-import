/**
 * The audit trail's read side. Lines are written by the store of the thing a line records, in the same atomic write,
 * never on their own; this port only reads them.
 *
 * @packageDocumentation
 */
import type { Activity } from "@inventory/kernel/Activity"
import type { OrganizationId } from "@inventory/kernel/Ids"
import { Context, Effect, Layer, Ref } from "effect"
import * as A from "effect/Array"
import { $AccessModelId } from "../internal/identity.ts"
import { AccessMemoryRef } from "../internal/memory.ts"

// Spans of this port are named `Activities.<method>`, in memory as on D1: the names the traces have always carried.
const $I = $AccessModelId.create("Activity/AuditTrailStore")

/**
 * Reads of one organization's audit trail.
 *
 * @category ports
 */
export class AuditTrailStore extends Context.Service<
  AuditTrailStore,
  {
    /** The organization's newest 500 lines, newest first. */
    readonly recent: (organization: OrganizationId) => Effect.Effect<ReadonlyArray<Activity>>
    /** How many lines the organization has: the status endpoint's proof that the database answers for this tenant. */
    readonly count: (organization: OrganizationId) => Effect.Effect<number>
  }
>()($I`AuditTrailStore`) {
  /** The audit trail over the shared in-memory state. */
  static readonly memory: Layer.Layer<AuditTrailStore, never, AccessMemoryRef> = Layer.effect(
    AuditTrailStore,
    Effect.gen(function* () {
      const ref = yield* AccessMemoryRef
      const of = Effect.fnUntraced(function* (organization: OrganizationId) {
        const state = yield* Ref.get(ref)
        return A.filter(state.lines, (line) => line.organizationId === organization)
      })
      return AuditTrailStore.of({
        recent: Effect.fn("Activities.recent")(function* (organization: OrganizationId) {
          const lines = yield* of(organization)
          return A.take(A.reverse(lines), 500)
        }),
        count: Effect.fn("Activities.count")(function* (organization: OrganizationId) {
          const lines = yield* of(organization)
          return lines.length
        })
      })
    })
  )
}
