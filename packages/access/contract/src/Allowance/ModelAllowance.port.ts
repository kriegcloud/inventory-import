/**
 * The daily allowance of model calls, as another part of the app may ask for it. Every feature that asks a model
 * takes one call from its organization's allowance first; this is the only way in.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import type { CurrentActor } from "@inventory/kernel/Actor"
import { aboutScheme } from "@inventory/kernel/TermsPointer"
import { Sentence } from "@inventory/kernel/Text"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"
import { $AccessContractId } from "../internal/identity.ts"

const $I = $AccessContractId.create("Allowance/ModelAllowance")

/** How many model calls one organization may make in any 24 hours. Past it the rules answer until calls come back. */
export const dailyModelCalls = 40

/**
 * What a model call is for: the table assistant reading a request (`view`), the check that the key works, or
 * suggestions for an import's rows the rules cannot fix (`suggest`). The same three words the `modelCall` table's
 * check allows, and each the notation of a concept of `inv:ModelCallPurposeScheme` (report 18 section 5).
 *
 * @category schemas
 */
export const ModelCallPurpose = LiteralKit(["view", "check", "suggest"]).pipe(
  $I.annoteSchema("ModelCallPurpose", {
    description:
      "What a model call is for: the table assistant reading a request, the check that the key works, or suggestions for an import",
    ...aboutScheme("inv:ModelCallPurposeScheme")
  })
)

/**
 * The decoded value of `ModelCallPurpose`.
 *
 * @category models
 */
export type ModelCallPurpose = typeof ModelCallPurpose.Type

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
     * One call from the actor's organization's allowance, taken before the call is made. The calls of the last 24
     * hours count, so the allowance comes back by itself a day later.
     */
    readonly take: (purpose: ModelCallPurpose) => Effect.Effect<AllowanceAnswer, never, CurrentActor>
  }
>()($I`ModelAllowanceGateway`) {}
