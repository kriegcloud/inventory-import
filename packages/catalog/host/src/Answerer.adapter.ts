// Asking the model, as the catalog's features do: one call through the one retry policy, its answer decoded through a
// schema, and who answered said in the contract's words. `AnswererOpenRouter` is the catalog's `Answerer` on it.
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { ModelStatus, ModelAnswered, ModelPrompt } from "@beep/openrouter/OpenRouterModel"
import { ModelUnavailable } from "@beep/openrouter/OpenRouterError"
import { AiUnavailable, aiUnavailable } from "@inventory/catalog-contract/AiUnavailable"
import { Effect, Layer, Option } from "effect"
import type * as S from "effect/Schema"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { ModelAvailability, Answerer, type ModelQuestion } from "@inventory/catalog-model/Answerer"

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

/** Whether a model can be asked, in the catalog's words. */
const availabilityOf = (status: ModelStatus): ModelAvailability => (modelIsOn(status) ? "on" : "off")

/** `Answerer` on the app's model service: OpenRouter, through the driver's one retry policy. */
export const AnswererOpenRouter = Layer.effect(
  Answerer,
  Effect.gen(function* () {
    const openRouter = yield* OpenRouter
    return Answerer.of({
      status: availabilityOf(openRouter.status),
      ask: Effect.fnUntraced(function* <Sc extends AnswerSchema>(question: ModelQuestion, schema: Sc) {
        return yield* askModel(openRouter, {
          name: question.name,
          prompt: question.prompt,
          schema,
          ...Option.match(question.system, { onNone: () => ({}), onSome: (system) => ({ system }) }),
          ...Option.match(question.maxOutputTokens, {
            onNone: () => ({}),
            onSome: (maxOutputTokens) => ({ maxOutputTokens })
          })
        })
      })
    })
  })
)
