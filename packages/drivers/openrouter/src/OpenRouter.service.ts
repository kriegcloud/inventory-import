/**
 * Structured answers from OpenRouter through `effect/ai`. Rules this service keeps so callers do not have to:
 *
 * - The key stays here, redacted. With no key, or AI turned off, every call fails with `noKey` and no request is made;
 *   the caller takes its non-AI path.
 * - One retry policy (`ModelPolicy`), and only for transient failures; a refused key or an answer that does not fit is
 *   never tried again. OpenRouter's own `models` list is the fallback inside one call.
 * - Answers are decoded with the caller's Schema; one that does not fit is `badAnswer`.
 * - Every attempt has a timeout and the call a deadline; an interrupted request cancels the call.
 *
 * A daily allowance of calls, and the words a screen shows, are the host's.
 *
 * @packageDocumentation
 */
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import type * as HttpClient from "effect/http/HttpClient"
import { ModelPolicy, type OpenRouterSettings } from "./OpenRouter.config.ts"
import { ModelUnavailable } from "./OpenRouter.errors.ts"
import { ModelAccess, modelAccessOf, type ModelPrompt, type ModelStatus, modelStatusOf } from "./OpenRouter.schema.ts"
import { $OpenrouterId } from "./internal/identity.ts"
import { type AnswerSchema, ask, type ModelAnswer } from "./internal/plan.ts"

export type { AnswerSchema, ModelAnswer } from "./internal/plan.ts"

const $I = $OpenrouterId.create("OpenRouter")

/** The cap on an answer's length, per call, as OpenRouter's request field. */
const withMaxTokens = <A, E, R>(effect: Effect.Effect<A, E, R>, maxOutputTokens: O.Option<number>) =>
  O.match(maxOutputTokens, {
    onNone: () => effect,
    onSome: (max_tokens) => OpenRouterLanguageModel.withConfigOverride(effect, { max_tokens })
  })

/**
 * One structured answer from a model, or why none came.
 *
 * @category services
 */
export class OpenRouter extends Context.Service<
  OpenRouter,
  {
    /** What will answer, for a status screen. */
    readonly status: ModelStatus
    /** One structured answer. Pass an `S.Struct`: models answer with a JSON object. */
    readonly generateObject: <Sc extends AnswerSchema>(
      prompt: ModelPrompt,
      schema: Sc
    ) => Effect.Effect<ModelAnswer<Sc["Type"]>, ModelUnavailable>
  }
>()($I`OpenRouter`) {
  /**
   * The service from the settings: on, it builds an `OpenRouterClient` with the key over the given `HttpClient`; off,
   * it builds nothing and every call fails with `noKey`.
   */
  static readonly layer = (
    settings: OpenRouterSettings,
    policy: ModelPolicy = ModelPolicy.default
  ): Layer.Layer<OpenRouter, never, HttpClient.HttpClient> =>
    Layer.effect(
      OpenRouter,
      Effect.gen(function* () {
        const access = modelAccessOf(settings)
        const status = modelStatusOf(access)
        if (ModelAccess.guards.off(access)) {
          return OpenRouter.of({
            status,
            generateObject: Effect.fn("OpenRouter.generateObject")(function* () {
              return yield* ModelUnavailable.make({ trouble: "noKey", retryable: false })
            })
          })
        }
        const models = yield* Layer.build(
          OpenRouterLanguageModel.model(access.model, {
            models: [access.model, ...access.fallbackModels],
            // Without it the provider sends Anthropic models the schema with `strict: null`, OpenRouter does not enforce
            // it, and Claude answers in a ```json fence the decoder refuses (seen live: every answer was badAnswer).
            strictJsonSchema: true
          }).pipe(Layer.provide(OpenRouterClient.layer({ apiKey: access.apiKey })))
        )
        return OpenRouter.of({
          status,
          generateObject: Effect.fn("OpenRouter.generateObject")(function* <Sc extends AnswerSchema>(
            prompt: ModelPrompt,
            schema: Sc
          ) {
            yield* Effect.annotateCurrentSpan("ai.model", access.model)
            return yield* ask({
              models,
              model: access.model,
              fallbackModels: access.fallbackModels,
              policy,
              prompt,
              schema,
              withConfig: withMaxTokens
            })
          })
        })
      })
    )

  /** `layer` over the platform's `fetch`: what a Worker uses. */
  static readonly layerFetch = (settings: OpenRouterSettings, policy: ModelPolicy = ModelPolicy.default) =>
    OpenRouter.layer(settings, policy).pipe(Layer.provide(FetchHttpClient.layer))
}
