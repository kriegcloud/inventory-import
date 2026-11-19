// THE MODEL. One structured answer at a time from OpenRouter, through @beep/openrouter: the key, the one retry policy
// and the five troubles are the driver's. This file is where the app meets it: the settings it is built from, the
// contract's words for what will answer (`AiStatus`) and for who did (`AnsweredBy`), the sentences a failure is told in
// (`AiUnavailable`, `modelSentences`), and the last step of every feature, `answeredByRules`, which always answers.
// The day's allowance is not here: every feature takes a call from it (ModelCalls.ts) before it asks.
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { OpenRouterSettings } from "@beep/openrouter/OpenRouterConfig"
import { ModelId, type ModelAnswered, ModelPrompt, type ModelStatus } from "@beep/openrouter/OpenRouterModel"
import type { ModelUnavailable } from "@beep/openrouter/OpenRouterError"
import { Array as Arr, Effect, Layer, Option } from "effect"
import * as S from "effect/Schema"
import { FetchHttpClient, type HttpClient } from "effect/http"
import { AiRoute, AiStatus, type AiUnavailable, aiUnavailable, type AnsweredBy } from "../api/v1/Api.ts"
import { aiSettings } from "./Settings.ts"

/** A schema a model answers with: an object on the wire, decoded with no services. */
type AnswerSchema = S.Codec<unknown, Record<string, unknown>, never, never>

/** A structured answer, and which model gave it (the screen says which one answered). */
export interface AiAnswer<A> {
  readonly value: A
  readonly answeredBy: Extract<AnsweredBy, { readonly _tag: "Model" }>
}

/**
 * The model from the settings (Settings.ts), over a given HTTP client: the Worker's is `fetch` (`ModelLive`); a test
 * passes a scripted one.
 */
export const modelLayer: Layer.Layer<OpenRouter, never, HttpClient.HttpClient> = Layer.unwrap(
  Effect.gen(function* () {
    const settings = yield* aiSettings
    const model = yield* S.decodeEffect(ModelId)(settings.model)
    const fallbackModels = yield* S.decodeEffect(S.Array(ModelId))(settings.fallbackModels)
    return OpenRouter.layer(
      OpenRouterSettings.make({
        enabled: settings.enabled,
        model,
        fallbackModels,
        apiKey: settings.openRouterKey
      })
    )
  })
).pipe(Layer.orDie)

/** The model the Worker uses: `modelLayer` over `fetch`. */
export const ModelLive = modelLayer.pipe(Layer.provide(FetchHttpClient.layer))

/** True when a model can be asked; with none, a feature goes straight to its rules and takes no call. */
export const modelIsOn = (status: ModelStatus): boolean => status.kind === "on"

/** What will answer a model call, in the contract's words, for `/api/v1/system/status`. */
export const aiStatusOf = (status: ModelStatus): AiStatus =>
  status.kind === "on"
    ? AiStatus.make({
        available: true,
        provider: "openrouter",
        model: status.model,
        routes: [AiRoute.make({ provider: "openrouter", model: status.model, fallbackModels: status.fallbackModels })],
        reason: `Answers come from OpenRouter (${Arr.join([status.model, ...status.fallbackModels], ", then ")}); then the non-AI path.`
      })
    : AiStatus.make({
        available: false,
        provider: "none",
        model: status.model,
        routes: [],
        reason:
          status.why === "disabled"
            ? "AI suggestions are off: AI_ENABLED is set to false."
            : "AI suggestions are off: no AI key is set."
      })

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
