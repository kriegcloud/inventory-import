import { expect, layer } from "@effect/vitest"
import { APICallError } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { Array as Arr, Effect, Fiber, Formatter, Layer, Schema, String as Str } from "effect"
import { TestClock, TestConsole } from "effect/testing"
import { modelSentences } from "../../src/api/v1/ModelTrouble.ts"
import { Ai, answeredByRules, type ModelRoute, routesFrom } from "../../src/server/Ai.ts"
import { aiSettings } from "../../src/server/Settings.ts"
import { settingsLayer } from "./support/app.ts"

// The model call's one retry policy and its fallbacks, with scripted models. The SDK's own retries are off, so each
// scripted failure is one attempt: the call counts below are the policy's, not the SDK's.

const Greeting = Schema.Struct({ greeting: Schema.String })
const ask = Effect.gen(function* () {
  const ai = yield* Ai
  return yield* ai.generateObject({ name: "greeting", prompt: "Say hello.", schema: Greeting })
})

const reply = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: {
    inputTokens: { total: 12, noCache: 12, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 6, text: 6, reasoning: undefined }
  },
  warnings: []
})

const apiError = (statusCode: number, message: string) =>
  new APICallError({
    message,
    url: "https://provider.example/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    isRetryable: statusCode === 429 || statusCode >= 500
  })

/** A model that plays its script one step per call: an error to fail with, or a reply. The last step repeats. */
const scripted = (modelId: string, script: ReadonlyArray<Error | string>) => {
  const model: MockLanguageModelV4 = new MockLanguageModelV4({
    modelId,
    doGenerate: () => {
      // The mock items the call before it asks for the answer, so the first call reads step 0.
      const step = script[Math.min(model.doGenerateCalls.length, script.length) - 1] ?? "{}"
      return step instanceof Error ? Promise.reject(step) : Promise.resolve(reply(step))
    }
  })
  return model
}

const route = (provider: ModelRoute["provider"], languageModel: MockLanguageModelV4): ModelRoute => ({
  provider,
  model: languageModel.modelId,
  fallbackModels: [],
  languageModel
})

/**
 * Runs `effect` and moves the test clock a second at a time until it ends. Retries wait on the clock (TestClock: no
 * real waiting), and the scripted model answers on a real promise, so each step first lets that promise settle.
 */
const settle = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const fiber = yield* Effect.forkChild(effect)
  while (fiber.pollUnsafe() === undefined) {
    yield* TestClock.withLive(Effect.sleep("1 millis"))
    yield* TestClock.adjust("1 second")
  }
  return yield* Fiber.join(fiber)
})

const busyThenAnswers = scripted("scripted/primary", [
  apiError(503, "upstream overloaded"),
  '{"greeting":"Hello there"}'
])

layer(Ai.layerFor({ routes: [route("openrouter", busyThenAnswers)], model: "scripted/primary" }))(
  "a busy provider",
  (it) => {
    it.effect("is tried again with backoff, then answers", () =>
      Effect.gen(function* () {
        const answer = yield* settle(ask)
        expect(answer.value.greeting).toBe("Hello there")
        expect(answer.answeredBy).toEqual({
          _tag: "Model",
          provider: "openrouter",
          model: "scripted/primary",
          fallback: false
        })
        // One failure, one retry: two calls. With the SDK's own retries on as well there would be more.
        expect(busyThenAnswers.doGenerateCalls.length).toBe(2)
      })
    )
  }
)

const refusesKey = scripted("scripted/primary", [apiError(401, "Invalid API key")])
const noCredit = scripted("scripted/primary", [apiError(402, "Insufficient credits on account 9f3a")])
const gatewayAnswers = scripted("scripted/secondary", ['{"greeting":"Hi from the gateway"}'])

layer(
  Ai.layerFor({
    routes: [route("openrouter", refusesKey), route("gateway", gatewayAnswers)],
    model: "scripted/primary"
  })
)("a refused key", (it) => {
  it.effect("is not tried again, and the second provider answers", () =>
    Effect.gen(function* () {
      const answer = yield* settle(ask)
      expect(answer.answeredBy).toEqual({
        _tag: "Model",
        provider: "gateway",
        model: "scripted/secondary",
        fallback: true
      })
      expect([refusesKey.doGenerateCalls.length, gatewayAnswers.doGenerateCalls.length]).toEqual([1, 1])
    })
  )
})

const keepsFailing = scripted("scripted/primary", [apiError(503, "upstream exploded: shard 7")])
const keepsLimiting = scripted("scripted/secondary", [apiError(429, "rate limited for key ending 9f3a")])

layer(Ai.layerFor({ routes: [route("openrouter", noCredit)], model: "scripted/primary" }))(
  "an account with no credit",
  (it) => {
    it.effect('is its own kind, not tried again, and its words are not "try again"', () =>
      Effect.gen(function* () {
        const error = yield* settle(ask).pipe(Effect.flip)
        expect([error._tag, error.kind, error.retryable]).toEqual(["AiUnavailable", "refused", false])
        // The contract's sentence for its kind, the one every screen shows: not "try again".
        expect(error.reason).toBe(modelSentences.refused)
        expect(noCredit.doGenerateCalls.length).toBe(1)
        // The provider's own words are in the log only.
        expect(Formatter.format(error)).not.toContain("9f3a")
      })
    )
  }
)

layer(
  Ai.layerFor({
    routes: [route("openrouter", keepsFailing), route("gateway", keepsLimiting)],
    model: "scripted/primary"
  })
)("every provider down", (it) => {
  it.effect("gives up after the bounded retries on each, with a plain reason and no provider text", () =>
    Effect.gen(function* () {
      const error = yield* settle(ask).pipe(Effect.flip)
      expect([error._tag, error.kind, error.retryable]).toEqual(["AiUnavailable", "busy", true])
      expect(error.reason).toBe(modelSentences.busy)
      // Three attempts on each provider: the first and two retries.
      expect([keepsFailing.doGenerateCalls.length, keepsLimiting.doGenerateCalls.length]).toEqual([3, 3])
      // The provider's own words are in the log, one line per failed attempt, and nowhere in the error.
      const lines = yield* TestConsole.logLines
      const logged = Formatter.format(lines)
      expect(logged).toContain("upstream exploded: shard 7")
      expect(Str.split("Model call failed")(logged).length - 1).toBe(6)
      expect(Formatter.format(error)).not.toContain("upstream exploded")
    })
  )
})

layer(Ai.layerFor({ routes: [], model: "test/model" }))("Ai without a key", (it) => {
  it.effect("reports itself off and why, and fails calls with AiUnavailable", () =>
    Effect.gen(function* () {
      const ai = yield* Ai
      expect([ai.status.available, ai.status.provider, ai.status.reason]).toEqual([
        false,
        "none",
        "AI suggestions are off: no AI key is set."
      ])
      const error = yield* ask.pipe(Effect.flip)
      expect([error._tag, error.kind, error.retryable]).toEqual(["AiUnavailable", "noKey", false])
      // The last step of every plan: the feature's own rules answer, and the result says so.
      const ruled = yield* ask.pipe(answeredByRules(() => ({ greeting: "Hello (from the rules)" })))
      expect(ruled).toEqual({
        value: { greeting: "Hello (from the rules)" },
        answeredBy: { _tag: "Rules", reason: modelSentences.noKey }
      })
    })
  )
})

const keyed = {
  AI_MODEL: "anthropic/claude-haiku-5.5",
  AI_FALLBACK_MODELS: " google/gemini-3.8-flash , ",
  OPENROUTER_API_KEY: "test-key-not-a-real-key"
}

layer(Ai.layer.pipe(Layer.provide(settingsLayer({ ...keyed, AI_ENABLED: "false" }))))("AI_ENABLED=false", (it) => {
  it.effect("turns AI off even with a key set, and says so", () =>
    Effect.gen(function* () {
      const ai = yield* Ai
      expect([ai.status.available, ai.status.reason]).toEqual([
        false,
        "AI suggestions are off: AI_ENABLED is set to false."
      ])
    })
  )
})

const sent: Array<string> = []

/** What OpenRouter answers when its first model failed and the fallback answered: the response names the fallback. */
const openRouter: typeof globalThis.fetch = (input, init) => {
  void input
  sent.push(String(init?.body))
  return Promise.resolve(
    Response.json({
      id: "gen-1",
      model: "google/gemini-3.8-flash",
      created: 1,
      object: "chat.completion",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: '{"greeting":"Hello from the fallback"}' },
          finish_reason: "stop"
        }
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.00002 }
    })
  )
}

const OpenRouterAi = Layer.unwrap(
  Effect.map(aiSettings, (settings) =>
    Ai.layerFor({ routes: routesFrom({ settings, fetch: openRouter }), model: settings.model })
  )
).pipe(Layer.provide(settingsLayer(keyed)))

layer(OpenRouterAi)("OpenRouter with a fallback model", (it) => {
  it.effect("is sent the models list, and the answer names the model that answered", () =>
    Effect.gen(function* () {
      const ai = yield* Ai
      expect(Arr.map(ai.status.routes, (route) => [route.provider, route.model, route.fallbackModels])).toEqual([
        ["openrouter", "anthropic/claude-haiku-5.5", ["google/gemini-3.8-flash"]]
      ])
      const answer = yield* ask
      expect(sent.length).toBe(1)
      expect(sent[0]).toContain('"models":["anthropic/claude-haiku-5.5","google/gemini-3.8-flash"]')
      expect(answer.answeredBy).toEqual({
        _tag: "Model",
        provider: "openrouter",
        model: "google/gemini-3.8-flash",
        fallback: true
      })
      expect(answer.costMicroUsd).toBe(20)
    })
  )
})
