// The call path both the real service and the test layer run: one plan step with the policy's retries and the
// explicit transient predicate, a timeout per attempt inside it and a deadline around it, failures turned into
// `ModelUnavailable` with the provider's own words logged once per failed attempt.
//
// One step is a rule, not a convenience: a step whose `while` answers false hands over to the NEXT step of an
// ExecutionPlan (effect/src/internal/executionPlan.ts), so a second step would ask another model after a bad answer,
// which is a retry in all but name.
import * as A from "effect/Array"
import * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Prompt from "effect/ai/Prompt"
import type * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as ExecutionPlan from "effect/ExecutionPlan"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import { identity } from "effect/Function"
import * as Str from "effect/String"
import { ModelPolicy } from "../OpenRouter.config.ts"
import { ModelUnavailable } from "../OpenRouter.errors.ts"
import {
  isTransient,
  ModelAnswered,
  type ModelPrompt,
  ModelUsage,
  ReportedTokenTotals,
  troubleOf
} from "../OpenRouter.schema.ts"

/** A schema a model can answer with: an object on the wire, decoded with no services. */
export type AnswerSchema = S.Codec<unknown, Record<string, unknown>, never, never>

/** A structured answer and who gave it. */
export type ModelAnswer<A> = { readonly value: A; readonly answered: ModelAnswered }

/** One attempt took longer than the policy allows: not retried, worded as "down". */
class AttemptTimedOut extends S.TaggedError<AttemptTimedOut, { readonly brand: unique symbol }>()(
  "AttemptTimedOut",
  {}
) {}

const costMicroUsd = (content: ReadonlyArray<{ readonly type: string }>): O.Option<number> =>
  A.findFirst(content, (part) => part.type === "finish").pipe(
    O.flatMap((part) => O.fromNullishOr(P.hasProperty(part, "metadata") ? part.metadata : undefined)),
    O.flatMap((metadata) =>
      P.hasProperty(metadata, "openrouter") && P.hasProperty(metadata.openrouter, "usage")
        ? O.fromNullishOr(metadata.openrouter.usage)
        : O.none()
    ),
    O.flatMap((usage) => (P.hasProperty(usage, "cost") && P.isNumber(usage.cost) ? O.some(usage.cost) : O.none())),
    O.filter((cost) => cost >= 0 && cost < 1_000_000),
    O.map((cost) => Math.round(cost * 1_000_000))
  )

const answeredModel = (content: ReadonlyArray<{ readonly type: string }>): O.Option<string> =>
  A.findFirst(content, (part) => part.type === "response-metadata").pipe(
    O.flatMap((part) => (P.hasProperty(part, "modelId") && P.isString(part.modelId) ? O.some(part.modelId) : O.none())),
    O.filter((name) => name.length > 0 && name.length <= 200)
  )

/**
 * Asks the model in `models` (a `LanguageModel` context) for one object, under `policy`. `model` and `fallbackModels`
 * say which answer was a fallback.
 */
export const ask = <Sc extends AnswerSchema>(options: {
  readonly models: Context.Context<LanguageModel.LanguageModel>
  readonly model: string
  readonly fallbackModels: ReadonlyArray<string>
  readonly policy: ModelPolicy
  readonly prompt: ModelPrompt
  readonly schema: Sc
  readonly withConfig: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    maxOutputTokens: O.Option<number>
  ) => Effect.Effect<A, E, R>
}): Effect.Effect<ModelAnswer<Sc["Type"]>, ModelUnavailable> => {
  const { policy, prompt } = options
  const message = O.match(prompt.system, {
    onNone: () => Prompt.make(prompt.prompt),
    onSome: (system) => Prompt.setSystem(Prompt.make(prompt.prompt), system)
  })
  const plan = ExecutionPlan.make({
    provide: options.models,
    attempts: policy.retries + 1,
    schedule: ModelPolicy.schedule(policy),
    while: (error: AiError.AiError | AttemptTimedOut) => AiError.isAiError(error) && isTransient(error)
  })
  const attempt = options
    .withConfig(
      LanguageModel.generateObject({ prompt: message, schema: options.schema, objectName: prompt.name }),
      prompt.maxOutputTokens
    )
    .pipe(
      Effect.timeoutOrElse({ duration: policy.attemptTimeout, orElse: () => Effect.fail(AttemptTimedOut.make({})) }),
      // The provider's own words go to the log, once per failed attempt, and never to the screen.
      Effect.tapError((error) =>
        Effect.logWarning("Model call failed").pipe(
          Effect.annotateLogs({
            "ai.model": options.model,
            "ai.detail": Str.slice(
              0,
              300
            )(AiError.isAiError(error) ? `${error.reason._tag}: ${error.message}` : "timed out")
          })
        )
      )
    )
  return attempt.pipe(
    Effect.withExecutionPlan(plan),
    Effect.mapError((error): ModelUnavailable => {
      if (AiError.isAiError(error)) {
        const { trouble, retryable } = troubleOf(error)
        return ModelUnavailable.make({ trouble, retryable })
      }
      return ModelUnavailable.make({ trouble: "down", retryable: true })
    }),
    Effect.timeoutOrElse({
      duration: policy.deadline,
      orElse: () => Effect.fail(ModelUnavailable.make({ trouble: "down", retryable: true }))
    }),
    Effect.flatMap((response) =>
      Effect.gen(function* () {
        const model = O.match(answeredModel(response.content), { onNone: () => options.model, onSome: identity })
        const { inputTokens, outputTokens } = yield* S.decodeEffect(ReportedTokenTotals)({
          inputTokens: response.usage.inputTokens.total,
          outputTokens: response.usage.outputTokens.total
        }).pipe(Effect.orDie)
        return {
          value: response.value,
          answered: ModelAnswered.make({
            model,
            fallback: A.some(options.fallbackModels, (fallback) => Str.startsWith(fallback)(model)),
            usage: ModelUsage.make({
              inputTokens,
              outputTokens,
              costMicroUsd: costMicroUsd(response.content)
            })
          })
        }
      })
    )
  )
}
