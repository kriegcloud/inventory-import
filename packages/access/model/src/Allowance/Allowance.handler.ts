/**
 * The daily model allowance, as the gateway other parts of the app ask.
 *
 * @packageDocumentation
 */
import {
  dailyModelCalls,
  ModelAllowanceGateway,
  type ModelCallPurpose,
  taken,
  usedUp
} from "@inventory/access-contract/ModelAllowance"
import { CurrentActor } from "@inventory/kernel/Actor"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { usedUpSentence } from "./Allowance.rules.ts"
import { AllowanceStore, Reservation } from "./AllowanceStore.port.ts"

/**
 * Takes one call from the actor's organization's allowance, before the call is made.
 *
 * @category handlers
 */
export const takeModelCall = Effect.fnUntraced(function* (purpose: ModelCallPurpose) {
  const actor = yield* CurrentActor
  const store = yield* AllowanceStore
  const random = yield* SecureRandom.SecureRandom
  const id = yield* random.uuidV4()
  const now = yield* DateTime.now
  const left = yield* store.take(
    Reservation.make({
      id,
      organization: actor.organizationId,
      actor: actor.id,
      purpose,
      at: now,
      limit: dailyModelCalls
    })
  )
  return left ? taken : usedUp(usedUpSentence)
})

/**
 * The gateway over the allowance store.
 *
 * @category layers
 */
export const ModelAllowanceGatewayLive: Layer.Layer<
  ModelAllowanceGateway,
  never,
  AllowanceStore | SecureRandom.SecureRandom
> = Layer.effect(
  ModelAllowanceGateway,
  Effect.gen(function* () {
    const store = yield* AllowanceStore
    const random = yield* SecureRandom.SecureRandom
    return ModelAllowanceGateway.of({
      take: Effect.fnUntraced(function* (purpose: ModelCallPurpose) {
        return yield* takeModelCall(purpose).pipe(
          Effect.provideService(AllowanceStore, store),
          Effect.provideService(SecureRandom.SecureRandom, random)
        )
      })
    })
  })
)
