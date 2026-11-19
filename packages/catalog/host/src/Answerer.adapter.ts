// Asking the model, as the catalog's features do: one call through the one retry policy, its answer decoded through a
// schema, who answered said in the contract's words, and the rules' answer when no model could.
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { ModelStatus, ModelAnswered, ModelPrompt } from "@beep/openrouter/OpenRouterModel"
import { ModelUnavailable } from "@beep/openrouter/OpenRouterError"
import { AiUnavailable, aiUnavailable } from "@inventory/catalog-contract/AiUnavailable"
import { Effect, Option } from "effect"
import type * as S from "effect/Schema"
import { OpenRouter } from "@beep/openrouter/OpenRouter"

/** A schema a model answers with: an object on the wire, decoded with no services. */
type AnswerSchema = S.Codec<unknown, Record<string, unknown>, never, never>

/** A structured answer, and which model gave it (the screen says which one answered). */
export interface AiAnswer<A> {
  readonly value: A
  readonly answeredBy: Extract<AnsweredBy, { readonly _tag: "Model" }>
}

/** True when a model can be asked; with none, a feature goes straight to its rules and takes no call. */
export const modelIsOn = (status: ModelStatus): boolean =>
  ModelStatus.match(status, { on: () => true, off: () => false })

/** Who answered, in the contract's words. */
export const answeredByModel = (answered: ModelAnswered): AiAnswer<unknown>["answeredBy"] => ({
  _tag: "Model",
  provider: "openrouter",
  model: answered.model,
  fallback: answered.fallback
})

/** A failure as the contract words it: the trouble, its sentence (`modelSentences`), and whether trying again helps. */
export const aiUnavailableOf = (error: ModelUnavailable): AiUnavailable =>
  aiUnavailable({ kind: error.trouble, retryable: error.retryable })

/** One structured answer from the model, worded for the contract. Pass a `S.Struct`: models answer with an object. */
export const askModel = Effect.fn("Model.ask")(function* <Sc extends AnswerSchema>(
  openRouter: OpenRouter["Service"],
  options: {
    readonly name: string
    readonly prompt: string
    readonly system?: string
    readonly schema: Sc
    readonly maxOutputTokens?: number
  }
) {
  const prompt = ModelPrompt.make({
    name: options.name,
    prompt: options.prompt,
    system: Option.fromUndefinedOr(options.system),
    maxOutputTokens: Option.fromUndefinedOr(options.maxOutputTokens)
  })
  const answer = yield* openRouter.generateObject(prompt, options.schema).pipe(Effect.mapError(aiUnavailableOf))
  const result: AiAnswer<Sc["Type"]> = { value: answer.value, answeredBy: answeredByModel(answer.answered) }
  return result
})

/**
 * The last step of every feature: when no model could answer, the caller's non-AI result, marked as the rules' answer
 * with the reason, so the screen can say which one answered.
 */
export const answeredByRules =
  <B>(rules: (error: AiUnavailable) => B) =>
  <A, R>(
    self: Effect.Effect<AiAnswer<A>, AiUnavailable, R>
  ): Effect.Effect<{ readonly value: A | B; readonly answeredBy: AnsweredBy }, never, R> =>
    self.pipe(
      Effect.map((answer): { readonly value: A | B; readonly answeredBy: AnsweredBy } => answer),
      Effect.catchTag("AiUnavailable", (error) =>
        Effect.succeed({ value: rules(error), answeredBy: { _tag: "Rules" as const, reason: error.reason } })
      )
    )
