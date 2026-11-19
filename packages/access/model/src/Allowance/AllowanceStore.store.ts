/**
 * Where the day's model calls are counted and taken. The count and the taking are one step, so two requests cannot
 * both take the last call, and a call is taken before it is made, so one that fails has still been counted.
 *
 * @packageDocumentation
 */
import { ModelCallPurpose } from "@inventory/access-contract/ModelAllowance"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Context, DateTime, Effect, Layer, Ref } from "effect"
import * as A from "effect/Array"
import * as S from "effect/Schema"
import { $AccessModelId } from "../internal/identity.ts"
import { AccessMemoryRef } from "../internal/memory.ts"

const $I = $AccessModelId.create("Allowance/AllowanceStore")

/**
 * One call asked of an organization's allowance: who asks, for what, when, and the window and limit that decide.
 *
 * @category schemas
 */
export class Reservation extends S.Opaque<Reservation, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.check(S.isUUID()).pipe(S.annotateKey({ description: "The id of the call's row" })),
    organization: OrganizationId,
    actor: MemberId,
    purpose: ModelCallPurpose,
    at: S.DateTimeUtc.pipe(S.annotateKey({ description: "When the call is taken" })),
    since: S.DateTimeUtc.pipe(S.annotateKey({ description: "Calls from this moment on count against the limit" })),
    limit: S.Int.check(S.isBetween({ minimum: 1, maximum: 10_000 })).pipe(
      S.annotateKey({ description: "How many calls the window allows" })
    )
  }).pipe($I.annoteSchema("Reservation", { description: "One call asked of an organization's allowance" }))
) {}

/**
 * The organization's count of model calls.
 *
 * @category ports
 */
export class AllowanceStore extends Context.Service<
  AllowanceStore,
  {
    /** Takes the call when fewer than `limit` were taken since `since`: true when it was taken. */
    readonly take: (reservation: Reservation) => Effect.Effect<boolean>
  }
>()($I`AllowanceStore`) {
  /** The allowance over the shared in-memory state. */
  static readonly memory: Layer.Layer<AllowanceStore, never, AccessMemoryRef> = Layer.effect(
    AllowanceStore,
    Effect.gen(function* () {
      const ref = yield* AccessMemoryRef
      return AllowanceStore.of({
        take: Effect.fn("AllowanceStore.take")(function* (reservation: Reservation) {
          return yield* Ref.modify(ref, (state) => {
            const counted = A.filter(
              state.calls,
              (call) =>
                call.organization === reservation.organization &&
                DateTime.isGreaterThanOrEqualTo(call.at, reservation.since)
            )
            if (counted.length >= reservation.limit) return [false, state] as const
            const call = {
              organization: reservation.organization,
              actor: reservation.actor,
              purpose: reservation.purpose,
              at: reservation.at
            }
            return [true, { ...state, calls: A.append(state.calls, call) }] as const
          })
        })
      })
    })
  )
}
