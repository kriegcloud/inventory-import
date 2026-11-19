// THE MODEL. One structured answer at a time from OpenRouter, through @beep/openrouter: the key, the one retry policy
// and the five troubles are the driver's. This file is where the app meets it: the settings it is built from, and the
// contract's words for what will answer (`AiStatus`). Asking, who answered and the rules' answer when no model could
// are the catalog host's (`@inventory/catalog-host/Model`).
// The day's allowance is not here: every feature takes a call from it (the access context's `ModelAllowanceGateway`) before it asks.
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { OpenRouterSettings } from "@beep/openrouter/OpenRouterConfig"
import { ModelId, ModelStatus, OffReason } from "@beep/openrouter/OpenRouterModel"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as S from "effect/Schema"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import type * as HttpClient from "effect/http/HttpClient"
import { AiRoute, AiStatus } from "../api/v1/Api.ts"
import { aiSettings } from "./Settings.ts"

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

/** What will answer a model call, in the contract's words, for `/api/v1/system/status`. */
export const aiStatusOf = (status: ModelStatus): AiStatus =>
  ModelStatus.match(status, {
    on: ({ model, fallbackModels }) =>
      AiStatus.make({
        available: true,
        provider: "openrouter",
        model,
        routes: [AiRoute.make({ provider: "openrouter", model, fallbackModels })],
        reason: `Answers come from OpenRouter (${A.join([model, ...fallbackModels], ", then ")}); then the non-AI path.`
      }),
    off: ({ why, model }) =>
      AiStatus.make({
        available: false,
        provider: "none",
        model,
        routes: [],
        reason: OffReason.match(why, {
          disabled: () => "AI suggestions are off: AI_ENABLED is set to false.",
          noKey: () => "AI suggestions are off: no AI key is set."
        })
      })
  })
