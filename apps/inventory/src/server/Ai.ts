import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createGateway, generateText, jsonSchema, type LanguageModel, Output } from "ai"
import {
  Array as Arr,
  Context,
  Duration,
  Effect,
  ExecutionPlan,
  Exit,
  Layer,
  Option,
  Predicate,
  Redacted,
  Schedule,
  Schema,
  String as Str
} from "effect"
import {
  type AiProvider,
  AiRoute,
  AiStatus,
  AiTrouble,
  type AiUnavailable,
  aiUnavailable,
  type AnsweredBy
} from "../api/v1/Api.ts"
import { type AiSettings, aiSettings } from "./Settings.ts"

/** A schema whose decoding needs no services: anything built from plain Schema combinators. */
type AnswerSchema = Schema.Top & { readonly DecodingServices: never }

/**
 * The one retry policy for model calls. The AI SDK's own retries are off (`maxRetries: 0` on every call), so this is
 * the only place a call is tried again: up to `retries` more times, with exponential backoff and jitter, and only
 * while the failure says it is retryable (busy, down, unreachable). A refused key or an answer that does not fit is
 * never retried on the same model. Each attempt has its own timeout, and the whole call, fallbacks included, a
 * deadline, so a request never waits on a model for long.
 */
export const aiPolicy = {
  attemptTimeout: Duration.seconds(15),
  retries: 2,
  backoff: Schedule.exponential("500 millis").pipe(Schedule.jittered),
  deadline: Duration.seconds(40)
} as const

/**
 * `aiPolicy` as a combinator, for a tool loop or a stream written directly with the AI SDK (`ai.languageModel`):
 * pass `maxRetries: 0` to the SDK call and pipe the Effect through this, so there is still one policy, not two.
 */
export const retryModelCall = <A, R>(call: Effect.Effect<A, AiUnavailable, R>) =>
  call.pipe(Effect.retry({ schedule: aiPolicy.backoff, times: aiPolicy.retries, while: (error) => error.retryable }))

/** One provider's model, ready to call: a step of the execution plan. */
export interface ModelRoute {
  readonly provider: AiProvider
  readonly model: string
  readonly fallbackModels: ReadonlyArray<string>
  readonly languageModel: LanguageModel
}

/** The route the current attempt uses. Each step of the execution plan provides one. */
class CurrentRoute extends Context.Service<CurrentRoute, ModelRoute & { readonly first: boolean }>()(
  "inventory/server/Ai/CurrentRoute"
) {}

/** A structured answer, what it used, and which model gave it (the screen says which one answered). */
export interface AiAnswer<A> {
  readonly value: A
  readonly answeredBy: Extract<AnsweredBy, { readonly _tag: "Model" }>
  readonly inputTokens: number
  readonly outputTokens: number
  /** Dollars times a million, when the provider reports cost (OpenRouter does); otherwise 0. */
  readonly costMicroUsd: number
}

/**
 * One failed attempt, with the provider's own words kept for the log. Never leaves this file: callers see
 * `AiUnavailable`, worded for the person by its kind (`modelSentences`).
 */
class ModelCallFailed extends Schema.TaggedError<ModelCallFailed, { readonly brand: unique symbol }>()(
  "ModelCallFailed",
  {
    kind: AiTrouble,
    retryable: Schema.Boolean,
    detail: Schema.String
  }
) {}

const statusOf = (cause: unknown): number | undefined =>
  Predicate.hasProperty(cause, "statusCode") && Predicate.isNumber(cause.statusCode) ? cause.statusCode : undefined

const nameOf = (cause: unknown): string =>
  Predicate.hasProperty(cause, "name") && Predicate.isString(cause.name) ? cause.name : typeof cause

const messageOf = (cause: unknown): string =>
  Predicate.hasProperty(cause, "message") && Predicate.isString(cause.message) ? cause.message : String(cause)

/** The AI SDK's names for an answer that came back but could not be read as the schema asked. */
const unusableAnswer = [
  "AI_NoObjectGeneratedError",
  "AI_NoOutputGeneratedError",
  "AI_TypeValidationError",
  "AI_JSONParseError"
]

/**
 * What one failed model call means, in three parts: which of the five troubles it is (`modelSentences` words it for
 * the person, with no provider text and no codes), whether trying again may help, and the provider's own words for
 * the log.
 *
 * @example
 * describeModelFailure(new APICallError({ message: "Rate limit exceeded", statusCode: 429, url, requestBodyValues }))
 * // { kind: "busy", retryable: true, detail: "AI_APICallError 429: Rate limit exceeded" }
 */
export const describeModelFailure = (cause: unknown): ModelCallFailed => {
  const status = statusOf(cause)
  const name = nameOf(cause)
  const detail = Str.slice(0, 300)(`${name}${status === undefined ? "" : ` ${status}`}: ${messageOf(cause)}`)
  const failure = (kind: AiTrouble, retryable: boolean) => ModelCallFailed.make({ kind, retryable, detail })
  if (status === 429) return failure("busy", true)
  // A refused key (401, 403) or an account with no credit left (402): asking again will not help.
  if (status === 401 || status === 402 || status === 403) return failure("refused", false)
  // The provider could not use this request or this model: the log says which.
  if (status !== undefined && status >= 400 && status < 500) return failure("down", false)
  if (Arr.contains(unusableAnswer, name)) return failure("badAnswer", false)
  const flagged = Predicate.hasProperty(cause, "isRetryable") && cause.isRetryable === true
  if (flagged || (status !== undefined && status >= 500)) return failure("down", true)
  return failure("down", false)
}

const describeRoutes = (routes: ReadonlyArray<ModelRoute>) =>
  Arr.join(
    Arr.map(routes, (route) =>
      route.provider === "openrouter"
        ? `OpenRouter (${Arr.join([route.model, ...route.fallbackModels], ", then ")})`
        : `the Vercel AI Gateway (${route.model})`
    ),
    "; then "
  )

/**
 * The one place the app talks to a language model. Model I/O is the Vercel AI SDK; this service wraps it so the rest
 * of the app sees an Effect with a typed failure.
 *
 * Rules this service enforces so callers do not have to:
 * - Keys stay on the server, as redacted settings. The browser never sees them.
 * - No key, or AI_ENABLED=false, is a normal state, not a crash: every call fails with `AiUnavailable` and the
 *   caller takes its non-AI path, the last step of the plan (`answeredByRules`).
 * - One retry policy (`aiPolicy`), then the next model: OpenRouter's `models` list falls back inside one call, and
 *   an `ExecutionPlan` moves to the second provider when a second key is set. The answer says which one answered.
 * - Answers are validated against an Effect Schema. A reply that does not fit is `AiUnavailable` too.
 * - Every attempt has a timeout and is cancelled if the request is.
 */
export class Ai extends Context.Service<
  Ai,
  {
    /** What will answer, for `/api/v1/system/status`. */
    readonly status: AiStatus
    /**
     * The first route's AI SDK model, for what this service does not wrap: streaming text or a tool-calling loop
     * written directly with `streamText`. `undefined` when AI is off. Such a call is outside the plan: give it
     * `maxRetries: 0` and pipe it through `retryModelCall`.
     */
    readonly languageModel: LanguageModel | undefined
    /** One structured answer. Pass a `Schema.Struct`: models answer with a JSON object. */
    generateObject<S extends AnswerSchema>(options: {
      readonly name: string
      readonly prompt: string
      readonly system?: string
      readonly schema: S
      readonly maxOutputTokens?: number
    }): Effect.Effect<AiAnswer<S["Type"]>, AiUnavailable>
  }
>()("inventory/server/Ai") {
  /** The service from the model settings (src/server/Settings.ts): the routes their keys allow, in order. */
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const settings = yield* aiSettings
      return Ai.layerFor({ routes: routesFrom({ settings }), model: settings.model, enabled: settings.enabled })
    })
  )

  /** The service around given routes, or none. Tests pass scripted models here. */
  static readonly layerFor = (config: {
    readonly routes: ReadonlyArray<ModelRoute>
    readonly model: string
    readonly enabled?: boolean
  }) => {
    const routes = config.enabled === false ? [] : config.routes
    const offReason =
      config.enabled === false
        ? "AI suggestions are off: AI_ENABLED is set to false."
        : "AI suggestions are off: no AI key is set."
    const status = AiStatus.make({
      available: Arr.isReadonlyArrayNonEmpty(routes),
      provider: Option.getOrElse(
        Option.map(Arr.head(routes), (route): AiStatus["provider"] => route.provider),
        () => "none" as const
      ),
      model: config.model,
      routes: Arr.map(routes, (route) =>
        AiRoute.make({ provider: route.provider, model: route.model, fallbackModels: route.fallbackModels })
      ),
      reason: Arr.isReadonlyArrayNonEmpty(routes)
        ? `Answers come from ${describeRoutes(routes)}; then the non-AI path.`
        : offReason
    })

    const attempt = Effect.fn("Ai.attempt")(function* <S extends AnswerSchema>(options: {
      readonly name: string
      readonly prompt: string
      readonly system?: string
      readonly schema: S
      readonly maxOutputTokens?: number
    }) {
      const route = yield* CurrentRoute
      yield* Effect.annotateCurrentSpan({ "ai.provider": route.provider, "ai.model": route.model })
      const result = yield* Effect.tryPromise({
        try: (abortSignal) =>
          generateText({
            model: route.languageModel,
            ...(options.system === undefined ? {} : { system: options.system }),
            ...(options.maxOutputTokens === undefined ? {} : { maxOutputTokens: options.maxOutputTokens }),
            prompt: options.prompt,
            output: Output.object({ name: options.name, schema: toAiSchema(options.schema) }),
            abortSignal,
            // Off: `aiPolicy` is the only retry policy.
            maxRetries: 0
          }).then((answer) => ({
            // Read inside the promise: the getter throws when the answer did not fit, and that is a failure here.
            value: answer.output,
            modelId: answer.response.modelId,
            usage: answer.usage,
            providerMetadata: answer.providerMetadata
          })),
        catch: describeModelFailure
      }).pipe(
        Effect.timeoutOrElse({
          duration: aiPolicy.attemptTimeout,
          orElse: () =>
            Effect.fail(
              ModelCallFailed.make({
                kind: "down",
                retryable: false,
                detail: `No answer from ${route.model} within ${Duration.format(aiPolicy.attemptTimeout)}`
              })
            )
        }),
        // The provider's own words go to the log, once per failed attempt, and never to the screen.
        Effect.tapError((failed) =>
          Effect.logWarning("Model call failed").pipe(
            Effect.annotateLogs({
              "ai.provider": route.provider,
              "ai.model": route.model,
              "ai.retryable": failed.retryable,
              "ai.detail": failed.detail
            })
          )
        ),
        Effect.mapError((failed) => aiUnavailable({ kind: failed.kind, retryable: failed.retryable }))
      )
      const cost = (result.providerMetadata as { openrouter?: { usage?: { cost?: unknown } } } | undefined)?.openrouter
        ?.usage?.cost
      const fallback = !route.first || Arr.some(route.fallbackModels, (model) => Str.startsWith(model)(result.modelId))
      const answer: AiAnswer<S["Type"]> = {
        value: result.value,
        answeredBy: { _tag: "Model", provider: route.provider, model: result.modelId, fallback },
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        costMicroUsd: typeof cost === "number" && Number.isFinite(cost) ? Math.round(cost * 1_000_000) : 0
      }
      return answer
    })

    const generateObject = Effect.fn("Ai.generateObject")(function* <S extends AnswerSchema>(options: {
      readonly name: string
      readonly prompt: string
      readonly system?: string
      readonly schema: S
      readonly maxOutputTokens?: number
    }) {
      if (!Arr.isReadonlyArrayNonEmpty(routes)) {
        return yield* aiUnavailable({ kind: "noKey", retryable: false })
      }
      // Each route is one step of the plan: the retry policy runs inside each step, and a step that still fails
      // hands over to the next provider.
      const plan = ExecutionPlan.make(
        ...Arr.map(routes, (route, index) => ({
          provide: Context.make(CurrentRoute, { ...route, first: index === 0 })
        }))
      )
      const answer = yield* attempt(options).pipe(
        retryModelCall,
        Effect.withExecutionPlan(plan),
        Effect.timeoutOrElse({
          duration: aiPolicy.deadline,
          orElse: () => Effect.fail(aiUnavailable({ kind: "down", retryable: true }))
        })
      )
      yield* Effect.annotateCurrentSpan({
        "ai.answered.provider": answer.answeredBy.provider,
        "ai.answered.model": answer.answeredBy.model,
        "ai.answered.fallback": answer.answeredBy.fallback
      })
      return answer
    })

    return Layer.succeed(
      Ai,
      Ai.of({
        status,
        languageModel: Option.getOrUndefined(Option.map(Arr.head(routes), (route) => route.languageModel)),
        generateObject
      })
    )
  }
}

/**
 * The routes the settings allow, in the order they are tried: OpenRouter when its key is set, then the gateway when
 * its key is set. `fetch` is the HTTP client both providers use; a test passes one to see what reaches the provider.
 */
export const routesFrom = (options: {
  readonly settings: AiSettings
  readonly fetch?: typeof globalThis.fetch
}): ReadonlyArray<ModelRoute> => {
  const { settings } = options
  const transport = options.fetch === undefined ? {} : { fetch: options.fetch }
  return Arr.getSomes([
    Option.map(settings.openRouterKey, (key) => ({
      provider: "openrouter" as const,
      model: settings.model,
      fallbackModels: settings.fallbackModels,
      // `models` is OpenRouter's fallback list: it tries them in order inside one call when the first fails.
      // `usage.include` makes it report what each call cost, in dollars, in the provider metadata.
      languageModel: createOpenRouter({ apiKey: Redacted.value(key), ...transport })(settings.model, {
        models: [settings.model, ...settings.fallbackModels],
        usage: { include: true }
      })
    })),
    Option.map(settings.gatewayKey, (key) => ({
      provider: "gateway" as const,
      model: settings.model,
      fallbackModels: [],
      // The gateway takes the same vendor/model ids.
      languageModel: createGateway({ apiKey: Redacted.value(key), ...transport })(settings.model)
    }))
  ])
}

/**
 * The last step of every plan: when no model could answer, the caller's non-AI result, marked as the rules' answer
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

/**
 * One Effect Schema, used twice: its JSON Schema tells the model what shape to answer in,
 * and decoding the answer through it is the validation. A reply that does not decode never reaches the caller.
 */
export const toAiSchema = <S extends AnswerSchema>(schema: S) => {
  const decode = Schema.decodeUnknownExit(schema)
  return jsonSchema<S["Type"]>(
    Schema.toStandardJSONSchemaV1(schema)["~standard"].jsonSchema.input({ target: "draft-07" }),
    {
      validate: (value) => {
        const exit = decode(value)
        return Exit.isSuccess(exit)
          ? { success: true, value: exit.value }
          : { success: false, error: new Error(String(exit.cause)) }
      }
    }
  )
}
