// Where the app meets the model (src/server/Model.ts): the settings decide what will answer and the status says so in
// the contract's words; a model's answer names who gave it; every failure reaches the screen as one of the five
// sentences, never the provider's own words; and with no model the feature's rules answer. The driver's own rules
// (retries, timeouts, a bad answer asked once) are tested in packages/drivers/openrouter.
import { describe, expect, layer } from "@effect/vitest"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Formatter from "effect/Formatter"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as S from "effect/Schema"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import { modelSentences } from "@inventory/catalog-contract/AiUnavailable"
import { askModel } from "@inventory/catalog-host/Model"
import { answeredByRules } from "@inventory/catalog-model/Answerer"
import { aiStatusOf, modelLayer } from "../../src/server/Model.ts"
import { settingsLayer } from "./support/app.ts"

const Greeting = S.Struct({ greeting: S.String })
const ask = OpenRouter.pipe(
  Effect.flatMap((openRouter) => askModel(openRouter, { name: "greeting", prompt: "Say hello.", schema: Greeting }))
)

const keyed = {
  AI_MODEL: "anthropic/claude-haiku-5.5",
  AI_FALLBACK_MODELS: " google/gemini-3.8-flash , ",
  OPENROUTER_API_KEY: "test-key-not-a-real-key"
}

const sent = MutableRef.make<ReadonlyArray<string>>([])

/** OpenRouter answering every request with `status` and `body`, recording what was sent. */
const openRouterAnswering = (status: number, body: string) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        if (request.body._tag === "Uint8Array") {
          const text = new TextDecoder().decode(request.body.body)
          MutableRef.update(sent, (all) => [...all, text])
        }
        return HttpClientResponse.fromWeb(
          request,
          new Response(body, { status, headers: { "content-type": "application/json" } })
        )
      })
    )
  )

const fromFallback = `{"id":"gen-1","model":"google/gemini-3.8-flash","created":1,"object":"chat.completion",
  "system_fingerprint":null,"choices":[{"index":0,"finish_reason":"stop",
  "message":{"role":"assistant","content":"{\\"greeting\\":\\"Hello from the fallback\\"}"}}],
  "usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"cost":0.00002}}`

const modelOn = (status: number, body: string, settings: Record<string, string> = keyed) =>
  modelLayer.pipe(Layer.provide(openRouterAnswering(status, body)), Layer.provide(settingsLayer(settings)))

describe("the model, as the app sees it", () => {
  layer(modelOn(200, "{}", { AI_MODEL: "test/model" }))("with no key", (it) => {
    it.effect("reports itself off and why, fails with the noKey sentence, and the rules answer", () =>
      Effect.gen(function* () {
        const openRouter = yield* OpenRouter
        const status = aiStatusOf(openRouter.status)
        expect([status.available, status.provider, status.reason]).toEqual([
          false,
          "none",
          "AI suggestions are off: no AI key is set."
        ])
        const error = yield* ask.pipe(Effect.flip)
        expect([error._tag, error.kind, error.retryable, error.reason]).toEqual([
          "AiUnavailable",
          "noKey",
          false,
          modelSentences.noKey
        ])
        const ruled = yield* ask.pipe(answeredByRules(() => ({ greeting: "Hello (from the rules)" })))
        expect(ruled).toEqual({
          value: { greeting: "Hello (from the rules)" },
          answeredBy: { _tag: "Rules", reason: modelSentences.noKey }
        })
      })
    )
  })

  layer(modelOn(200, "{}", { ...keyed, AI_ENABLED: "false" }))("AI_ENABLED=false", (it) => {
    it.effect("turns AI off even with a key set, and says so", () =>
      Effect.gen(function* () {
        const status = aiStatusOf((yield* OpenRouter).status)
        expect([status.available, status.reason]).toEqual([
          false,
          "AI suggestions are off: AI_ENABLED is set to false."
        ])
      })
    )
  })

  layer(modelOn(200, fromFallback))("OpenRouter with a fallback model", (it) => {
    it.effect("is sent the models list, and the answer names the fallback that answered", () =>
      Effect.gen(function* () {
        const status = aiStatusOf((yield* OpenRouter).status)
        expect(A.map(status.routes, (route) => [route.provider, route.model, route.fallbackModels])).toEqual([
          ["openrouter", "anthropic/claude-haiku-5.5", ["google/gemini-3.8-flash"]]
        ])
        expect(status.reason).toBe(
          "Answers come from OpenRouter (anthropic/claude-haiku-5.5, then google/gemini-3.8-flash); then the non-AI path."
        )
        const answer = yield* ask
        expect(answer.value.greeting).toBe("Hello from the fallback")
        expect(MutableRef.get(sent)[0]).toContain('"models":["anthropic/claude-haiku-5.5","google/gemini-3.8-flash"]')
        expect(answer.answeredBy).toEqual({
          _tag: "Model",
          provider: "openrouter",
          model: "google/gemini-3.8-flash",
          fallback: true
        })
      })
    )
  })

  layer(modelOn(402, '{"error":{"code":402,"message":"Insufficient credits"}}'))("an empty credit", (it) => {
    it.effect("is refused, worded as the refused sentence, not retried", () =>
      Effect.gen(function* () {
        const error = yield* ask.pipe(Effect.flip)
        expect([error.kind, error.retryable, error.reason]).toEqual(["refused", false, modelSentences.refused])
      })
    )
  })

  layer(modelOn(400, '{"error":{"code":400,"message":"upstream exploded"}}'))("a provider's own words", (it) => {
    it.effect("never reach the error a screen shows", () =>
      Effect.gen(function* () {
        const error = yield* ask.pipe(Effect.flip)
        expect(error.kind).toBe("down")
        expect(Formatter.format(error)).not.toContain("upstream exploded")
      })
    )
  })
})
