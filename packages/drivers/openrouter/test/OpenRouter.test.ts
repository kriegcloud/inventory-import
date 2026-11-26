import { assertDefined } from "@effect/vitest/utils"
// The model path's rules, with no key and no spend: an answer is decoded and says who gave it; a transient failure is
// tried again within the policy and a bad answer never is; each attempt and the whole call are bounded in time; AI
// off makes no request; and what OpenRouter is sent, and how its statuses map, through its real client.
import { describe, expect, it, layer } from "@effect/vitest"
import * as AiError from "effect/ai/AiError"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as S from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import * as HttpBody from "effect/http/HttpBody"
import { OpenRouter } from "@beep/openrouter/OpenRouter"
import { ModelUnavailable } from "@beep/openrouter/OpenRouterError"
import { ModelPolicy, OpenRouterSettings } from "@beep/openrouter/OpenRouterConfig"
import { ModelId, ModelPrompt } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest, type ScriptedReply } from "@beep/openrouter/OpenRouterTest"

const Greeting = S.Struct({ greeting: S.String })
const model = ModelId.make("scripted/primary")
const prompt = ModelPrompt.make({ name: "greeting", prompt: "Say hello." })
const fast = ModelPolicy.make({ backoff: Duration.zero })
const hello: ScriptedReply = { text: '{"greeting":"Hello"}', modelId: O.none() }
const busy = () => AiError.make({ module: "test", method: "generateText", reason: AiError.RateLimitError.make({}) })
const refused = () =>
  AiError.make({
    module: "test",
    method: "generateText",
    reason: AiError.AuthenticationError.make({ kind: "InvalidKey" })
  })

const greet = OpenRouter.pipe(Effect.flatMap((openRouter) => openRouter.generateObject(prompt, Greeting)))
const failure = greet.pipe(Effect.flip)

describe("a scripted model", () => {
  {
    const run = OpenRouterTest.scripted([hello], { model, fallbackModels: [], policy: ModelPolicy.default })
    const calls = run.calls
    layer(run.layer)("an answer", (it) => {
      it.effect("is decoded and names the model that gave it", () =>
        Effect.gen(function* () {
          const answer = yield* greet
          expect(answer.value).toEqual({ greeting: "Hello" })
          expect(answer.answered.model).toBe("scripted/primary")
          expect(answer.answered.usage.inputTokens).toBe(0)
          expect(answer.answered.usage.outputTokens).toBe(0)
          expect(answer.answered.fallback).toBe(false)
          expect(calls()).toBe(1)
        })
      )
    })
  }

  {
    const run = OpenRouterTest.scripted([{ text: '{"greeting":"Hi"}', modelId: O.some("scripted/backup-2026") }], {
      model,
      fallbackModels: [ModelId.make("scripted/backup")],
      policy: ModelPolicy.default
    })
    layer(run.layer)("a fallback", (it) => {
      it.effect("is said to be one", () =>
        Effect.gen(function* () {
          const answer = yield* greet
          expect(answer.answered.fallback).toBe(true)
        })
      )
    })
  }

  {
    const run = OpenRouterTest.scripted([busy(), hello], { model, fallbackModels: [], policy: fast })
    const calls = run.calls
    layer(run.layer)("busy, then an answer", (it) => {
      it.effect("answers on the second attempt", () =>
        Effect.gen(function* () {
          const answer = yield* greet
          expect(answer.value.greeting).toBe("Hello")
          expect(calls()).toBe(2)
        })
      )
    })
  }

  {
    const run = OpenRouterTest.scripted([busy(), busy(), busy(), busy()], { model, fallbackModels: [], policy: fast })
    const calls = run.calls
    layer(run.layer)("busy every time", (it) => {
      it.effect("gives up after the policy's retries, as busy", () =>
        Effect.gen(function* () {
          const error = yield* failure
          expect(S.is(ModelUnavailable)(error)).toBe(true)
          expect(error).toMatchObject({ trouble: "busy", retryable: true })
          expect(calls()).toBe(3)
        })
      )
    })
  }

  {
    const run = OpenRouterTest.scripted([{ text: '{"wrong":1}', modelId: O.none() }, hello], {
      model,
      fallbackModels: [],
      policy: fast
    })
    const calls = run.calls
    layer(run.layer)("an answer that does not fit", (it) => {
      it.effect("is asked for once, and never again", () =>
        Effect.gen(function* () {
          const error = yield* failure
          expect(error).toMatchObject({ trouble: "badAnswer", retryable: false })
          expect(calls()).toBe(1)
        })
      )
    })
  }

  {
    const run = OpenRouterTest.scripted([refused(), hello], { model, fallbackModels: [], policy: fast })
    const calls = run.calls
    layer(run.layer)("a refused key", (it) => {
      it.effect("is not tried again", () =>
        Effect.gen(function* () {
          const error = yield* failure
          expect(error).toMatchObject({ trouble: "refused", retryable: false })
          expect(calls()).toBe(1)
        })
      )
    })
  }

  {
    const run = OpenRouterTest.scripted([{ hang: true }, hello], {
      model,
      fallbackModels: [],
      policy: ModelPolicy.default
    })
    const calls = run.calls
    layer(run.layer)("a model that never answers", (it) => {
      it.effect("is cut off by the attempt's timeout and not tried again", () =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(failure)
          yield* TestClock.adjust(Duration.seconds(16))
          const error = yield* Fiber.join(fiber)
          expect(error).toMatchObject({ trouble: "down" })
          expect(calls()).toBe(1)
        })
      )
    })
  }

  {
    const run = OpenRouterTest.scripted([{ hang: true }], {
      model,
      fallbackModels: [],
      policy: ModelPolicy.make({ attemptTimeout: Duration.minutes(5) })
    })
    layer(run.layer)("a call longer than the deadline", (it) => {
      it.effect("is cut off by the deadline", () =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(failure)
          yield* TestClock.adjust(Duration.seconds(41))
          const error = yield* Fiber.join(fiber)
          expect(error).toMatchObject({ trouble: "down", retryable: true })
        })
      )
    })
  }
})

const sent = MutableRef.make(0)
const counted = () => {
  MutableRef.increment(sent)
  return new Response("{}", { status: 500 })
}

describe("AI off", () => {
  layer(OpenRouterTest.overHttp(OpenRouterSettings.make({ model }), counted, ModelPolicy.default))(
    "with no key",
    (it) => {
      it.effect("says noKey, and makes no request", () =>
        Effect.gen(function* () {
          const openRouter = yield* OpenRouter
          const error = yield* failure
          expect(openRouter.status).toMatchObject({ kind: "off", why: "noKey" })
          expect(error.trouble).toBe("noKey")
          expect(MutableRef.get(sent)).toBe(0)
        })
      )
    }
  )
  layer(
    OpenRouterTest.overHttp(
      OpenRouterSettings.make({ model, enabled: false, apiKey: O.some(Redacted.make("test-key")) }),
      counted,
      ModelPolicy.default
    )
  )("turned off with a key", (it) => {
    it.effect("says noKey, and makes no request", () =>
      Effect.gen(function* () {
        const openRouter = yield* OpenRouter
        const error = yield* failure
        expect(openRouter.status).toMatchObject({ kind: "off", why: "disabled" })
        expect(error.trouble).toBe("noKey")
        expect(MutableRef.get(sent)).toBe(0)
      })
    )
  })
})

describe("over OpenRouter's real client", () => {
  const settings = OpenRouterSettings.make({
    model: ModelId.make("anthropic/claude-haiku-5.5"),
    fallbackModels: [ModelId.make("google/gemini-3.8-flash")],
    apiKey: O.some(Redacted.make("test-key"))
  })
  const json = { status: 200, headers: { "content-type": "application/json" } }
  const answer = `{"id":"gen-test","object":"chat.completion","created":1,"model":"anthropic/claude-haiku-5.5",
    "system_fingerprint":null,"choices":[{"index":0,"finish_reason":"stop",
    "message":{"role":"assistant","content":"{\\"greeting\\":\\"Hello\\"}"}}],
    "usage":{"prompt_tokens":12,"completion_tokens":5,"total_tokens":17,"cost":0.000042}}`
  const bodies = MutableRef.make<ReadonlyArray<string>>([])

  layer(
    OpenRouterTest.overHttp(
      settings,
      (request) => {
        if (request.body instanceof HttpBody.Uint8Array) {
          const text = new TextDecoder().decode(request.body.body)
          MutableRef.update(bodies, (all) => [...all, text])
        }
        return new Response(answer, json)
      },
      ModelPolicy.default
    )
  )("an answer", (it) => {
    it.effect("is asked with the fallback list and the length cap, and reports tokens and cost", () =>
      Effect.gen(function* () {
        const openRouter = yield* OpenRouter
        const got = yield* openRouter.generateObject(
          ModelPrompt.make({ name: "greeting", prompt: "Say hello.", maxOutputTokens: O.some(50) }),
          Greeting
        )
        expect(got.value.greeting).toBe("Hello")
        expect(got.answered.usage.inputTokens).toBe(12)
        expect(got.answered.usage.costMicroUsd).toEqual(O.some(42))
        const [first] = MutableRef.get(bodies)
        assertDefined(first)
        const body = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(first)
        expect(body).toMatchObject({
          model: "anthropic/claude-haiku-5.5",
          models: ["anthropic/claude-haiku-5.5", "google/gemini-3.8-flash"],
          max_tokens: 50,
          response_format: { type: "json_schema", json_schema: { name: "greeting", strict: true } }
        })
      })
    )
  })

  for (const [status, trouble] of [
    [402, "refused"],
    [401, "refused"],
    [429, "busy"]
  ] as const) {
    layer(
      OpenRouterTest.overHttp(
        settings,
        () =>
          new Response(`{"error":{"code":${status},"message":"no"}}`, {
            status,
            headers: { "content-type": "application/json" }
          }),
        ModelPolicy.make({ retries: 0 })
      )
    )(`HTTP ${status}`, (it) => {
      it.effect(`is ${trouble}`, () =>
        Effect.gen(function* () {
          const error = yield* failure
          expect(error.trouble).toBe(trouble)
        })
      )
    })
  }
})

it("ModelPolicy's defaults are today's policy", () => {
  expect(Duration.toMillis(ModelPolicy.default.attemptTimeout)).toBe(15_000)
  expect(ModelPolicy.default.retries).toBe(2)
  expect(Duration.toMillis(ModelPolicy.default.deadline)).toBe(40_000)
})
