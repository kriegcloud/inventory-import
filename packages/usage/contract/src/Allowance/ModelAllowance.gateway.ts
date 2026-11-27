/**
 * The daily allowance of model calls, as another part of the app may ask for it: every feature that asks a model
 * takes one call from its organization's allowance first, and this is the only way in. It moved here from the access
 * contract at move 2's hosted half (Benjamin, 2026-11-27: "packages/usage/contract, which also takes the
 * `ModelAllowance` gateway"), when its Layer became a `TakeCall` sent to the usage model's server Api over the service binding
 * (the site's Worker, `apps/inventory/src/server/Models.ts`). Its shape did not change, so the catalog's port and the three askers
 * (the table assistant, the suggestions, the check that the key works) did not either.
 *
 * The one thing not to break: the 40 come back together at midnight UTC (decision 25), and the sentence a person reads
 * when they are used says so; a feature with a path by the rules answers by its rules instead of failing.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import type { CurrentActor } from "@inventory/kernel/Actor"
import { Sentence } from "@inventory/kernel/Text"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import { $UsageContractId } from "../internal/identity.ts"
import { dailyModelCalls, type ModelCallPurpose } from "./ModelCall.payload.ts"

const $I = $UsageContractId.create("Allowance/ModelAllowance")

/**
 * The two answers to "may I make a model call": one was taken, or the day's are used up.
 *
 * @category schemas
 */
export const AllowanceAnswerKind = LiteralKit(["taken", "usedUp"]).pipe(
  $I.annoteSchema("AllowanceAnswerKind", { description: "A call was taken, or the day's calls are used up" })
)

class Taken extends S.Opaque<Taken, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("taken") }).pipe(
    $I.annoteSchema("Taken", { description: "One call was taken from the day's allowance: make the call" })
  )
) {}

class UsedUp extends S.Opaque<UsedUp, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("usedUp"),
    reason: Sentence.pipe(
      S.annotateKey({ description: "That the day's calls are used and when they come back, for the person" })
    )
  }).pipe($I.annoteSchema("UsedUp", { description: "The day's calls are used: the model must not be asked" }))
) {}

/**
 * What asking for a model call comes to. Branch with `AllowanceAnswer.match`.
 *
 * @category schemas
 */
export const AllowanceAnswer = AllowanceAnswerKind.mapMembers(() => Tuple.make(Taken, UsedUp)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("AllowanceAnswer", { description: "A call was taken, or the day's calls are used up" })
)

/**
 * The decoded value of `AllowanceAnswer`.
 *
 * @category models
 */
export type AllowanceAnswer = typeof AllowanceAnswer.Type

/** One call was taken. */
export const taken: AllowanceAnswer = Taken.make({})
/** The day's calls are used; `reason` says so for the person. */
export const usedUp = (reason: Sentence): AllowanceAnswer => UsedUp.make({ reason })

/** The words for an allowance that is used up, the start of every sentence that says so. */
export const usedUpWords = `The day's ${dailyModelCalls} AI calls are used`

/**
 * The sentence a person reads when the day's calls are used and nothing answers by its rules instead (the check that
 * the key works): when they come back, at midnight UTC (decision 25; the sentence decided for move 2).
 */
export const usedUpSentence: Sentence = `${usedUpWords}. They come back at midnight UTC.`

/**
 * The organization has used the day's model calls: nothing was asked. Every model feature draws on the same
 * allowance; a feature with a non-AI path answers by its rules instead of failing with this.
 *
 * @category errors
 */
export class ModelCallsUsedUp extends S.TaggedError<ModelCallsUsedUp, { readonly brand: unique symbol }>(
  $I`ModelCallsUsedUp`
)(
  "ModelCallsUsedUp",
  { reason: Sentence.pipe(S.annotateKey({ description: "What happened, in words for the person." })) },
  $I.annoteError<ModelCallsUsedUp>("ModelCallsUsedUp", {
    description: "The day's model calls are used: the model was not asked.",
    httpApiStatus: 429
  })
) {}

/**
 * The organization's daily allowance of model calls, shared by every feature that asks a model.
 *
 * @category services
 */
export class ModelAllowanceGateway extends Context.Service<
  ModelAllowanceGateway,
  {
    /**
     * One call from the actor's organization's allowance, taken before the call is made, so a call that fails still
     * counts. The day is a UTC day: the 40 come back together at midnight UTC.
     */
    readonly take: (purpose: ModelCallPurpose) => Effect.Effect<AllowanceAnswer, never, CurrentActor>
  }
>()($I`ModelAllowanceGateway`) {}
