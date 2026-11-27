/**
 * Where the day's model calls are counted and taken. The count and the taking are one step, so two requests cannot
 * both take the last call, and a call is taken before it is made, so one that fails has still been counted.
 *
 * @packageDocumentation
 */
import { ModelCallPurpose } from "@inventory/access-contract/ModelAllowance"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as A from "effect/Array"
import * as S from "effect/Schema"
import { $AccessModelId } from "../internal/identity.ts"
import { AccessMemoryRef } from "../internal/memory.ts"
import { windowStart } from "./Allowance.rules.ts"

// Spans of this port are named `ModelCalls.<method>`, in memory as on D1: the names the traces have always carried.
const $I = $AccessModelId.create("Allowance/AllowanceStore")

const isBetweenMoments = S.makeIsBetween({ order: DateTime.Order })

/**
 * When a call is taken: a moment whose 24 hours before it fall in the years a store holds as text that sorts as time
 * (0000 to 9999), so the window it is counted in is one the store can compare.
 *
 * @category schemas
 */
export const CallMoment = S.DateTimeUtc.check(
  isBetweenMoments(
    {
      minimum: DateTime.makeUnsafe("0000-01-02T00:00:00.000Z"),
      maximum: DateTime.makeUnsafe("9999-12-31T23:59:59.999Z")
    },
    {
      identifier: "CallMoment",
      title: "A moment a day into year 0 or later, before year 10000",
      description: "When a call is taken, with the day before it inside the years a store compares"
    }
  )
).annotate({ description: "When a model call is taken" })

/**
 * One call asked of an organization's allowance: who asks, for what, when, and the limit that decides. The window it
 * is counted in is not the caller's to say: the store works it out from `at` (`windowStart`), so no caller can widen it.
 *
 * @category schemas
 */
export class Reservation extends S.Opaque<Reservation, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String.check(S.isUUID()).pipe(S.annotateKey({ description: "The id of the call's row" })),
    organization: OrganizationId,
    actor: MemberId,
    purpose: ModelCallPurpose,
    at: CallMoment.pipe(S.annotateKey({ description: "When the call is taken" })),
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
    /** Takes the call when fewer than `limit` were taken in the 24 hours up to its moment: true when it was taken. */
    readonly take: (reservation: Reservation) => Effect.Effect<boolean>
  }
>()($I`AllowanceStore`) {
  /** The allowance over the shared in-memory state. */
  static readonly memory: Layer.Layer<AllowanceStore, never, AccessMemoryRef> = Layer.effect(
    AllowanceStore,
    Effect.gen(function* () {
      const ref = yield* AccessMemoryRef
      return AllowanceStore.of({
        take: Effect.fn("ModelCalls.take")(function* (reservation: Reservation) {
          const since = windowStart(reservation.at)
          return yield* Ref.modify(ref, (state) => {
            const counted = A.filter(
              state.calls,
              (call) =>
                call.organization === reservation.organization && DateTime.isGreaterThanOrEqualTo(call.at, since)
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
