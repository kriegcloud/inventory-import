/**
 * The model path's data: which model, whether AI is on, what a call asks, what came back, and the five troubles a
 * failed call is one of.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import type * as AiError from "effect/ai/AiError"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import type * as Redacted from "effect/Redacted"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import type { OpenRouterSettings } from "./OpenRouter.config.ts"
import { $OpenrouterId } from "./internal/identity.ts"

const $I = $OpenrouterId.create("OpenRouterModel")

/**
 * A vendor/model id as OpenRouter names models (`anthropic/claude-haiku-5.5`).
 *
 * @category schemas
 */
export const ModelId = S.String.check(S.isMaxLength(200), S.isPattern(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._:~-]+$/)).pipe(
  S.brand("ModelId"),
  $I.annoteSchema("ModelId", { description: "A vendor/model id, as OpenRouter names models" })
)

/**
 * The decoded value of `ModelId`.
 *
 * @category models
 */
export type ModelId = typeof ModelId.Type

/**
 * The name of the model that answered, as the provider reported it.
 *
 * @category schemas
 */
export const ModelName = S.String.check(S.isMinLength(1), S.isMaxLength(200)).pipe(
  $I.annoteSchema("ModelName", { description: "The model that answered, as the provider reported it" })
)

/**
 * Why AI is off: no key is set, or it was turned off with a key set.
 *
 * @category schemas
 */
export const OffReason = LiteralKit(["noKey", "disabled"]).pipe(
  $I.annoteSchema("OffReason", { description: "noKey: no key is set. disabled: turned off with a key set" })
)

class AccessOn extends S.Opaque<AccessOn, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("on"),
    apiKey: S.Redacted(S.String).pipe(S.annotateKey({ description: "The OpenRouter key" })),
    model: ModelId.pipe(S.annotateKey({ description: "The model asked first" })),
    fallbackModels: S.Array(ModelId).pipe(S.annotateKey({ description: "OpenRouter's in-call fallback list" }))
  }).pipe($I.annoteSchema("AccessOn", { description: "AI is on: the key, the model and its fallbacks" }))
) {}

class AccessOff extends S.Opaque<AccessOff, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("off"),
    why: OffReason.pipe(S.annotateKey({ description: "Why AI is off" })),
    model: ModelId.pipe(S.annotateKey({ description: "The model that would be asked" }))
  }).pipe($I.annoteSchema("AccessOff", { description: "AI is off, and why" }))
) {}

/**
 * Whether the driver can call a model: on, with the key, or off, with why.
 *
 * @category schemas
 */
export const ModelAccess = LiteralKit(["on", "off"])
  .mapMembers(() => Tuple.make(AccessOn, AccessOff))
  .pipe(
    S.toTaggedUnion("kind"),
    $I.annoteSchema("ModelAccess", { description: "Whether a model can be called, and with what" })
  )

/**
 * The decoded value of `ModelAccess`.
 *
 * @category models
 */
export type ModelAccess = typeof ModelAccess.Type

/**
 * The access the settings give: on only when enabled and a key is set.
 *
 * @category behaviour
 */
export const modelAccessOf = (settings: OpenRouterSettings): ModelAccess => {
  if (!settings.enabled) return AccessOff.make({ kind: "off", why: "disabled", model: settings.model })
  return O.match(settings.apiKey, {
    onNone: () => AccessOff.make({ kind: "off", why: "noKey", model: settings.model }),
    onSome: (apiKey: Redacted.Redacted<string>) =>
      AccessOn.make({ kind: "on", apiKey, model: settings.model, fallbackModels: settings.fallbackModels })
  })
}

class StatusOn extends S.Opaque<StatusOn, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("on"),
    model: ModelId.pipe(S.annotateKey({ description: "The model asked first" })),
    fallbackModels: S.Array(ModelId).pipe(S.annotateKey({ description: "OpenRouter's in-call fallback list" }))
  }).pipe($I.annoteSchema("StatusOn", { description: "AI is on: the model and its fallbacks" }))
) {}

class StatusOff extends S.Opaque<StatusOff, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("off"),
    why: OffReason.pipe(S.annotateKey({ description: "Why AI is off" })),
    model: ModelId.pipe(S.annotateKey({ description: "The model that would be asked" }))
  }).pipe($I.annoteSchema("StatusOff", { description: "AI is off, and why" }))
) {}

/**
 * What will answer a model call, without the key: what a status screen may show.
 *
 * @category schemas
 */
export const ModelStatus = LiteralKit(["on", "off"])
  .mapMembers(() => Tuple.make(StatusOn, StatusOff))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("ModelStatus", { description: "What will answer a model call" }))

/**
 * The decoded value of `ModelStatus`.
 *
 * @category models
 */
export type ModelStatus = typeof ModelStatus.Type

/**
 * The status an access shows: the same, without the key.
 *
 * @category behaviour
 */
export const modelStatusOf = (access: ModelAccess): ModelStatus =>
  ModelAccess.match(access, {
    on: ({ model, fallbackModels }): ModelStatus => StatusOn.make({ kind: "on", model, fallbackModels }),
    off: ({ why, model }): ModelStatus => StatusOff.make({ kind: "off", why, model })
  })

/**
 * The five ways a model call can fail that a product can word: no key (or AI off), refused (the key or its credit),
 * busy (rate-limited), a bad answer (one that did not fit), and down (anything else).
 *
 * @category schemas
 */
export const ModelTrouble = LiteralKit(["noKey", "refused", "busy", "badAnswer", "down"]).pipe(
  $I.annoteSchema("ModelTrouble", { description: "noKey, refused, busy, badAnswer or down" })
)

/**
 * The decoded value of `ModelTrouble`.
 *
 * @category models
 */
export type ModelTrouble = typeof ModelTrouble.Type

/**
 * A failure transient enough to try again: a rate limit, a provider error, or a broken connection. A bad answer is
 * not: `AiError.isRetryable` says it is, and it is deliberately not used.
 *
 * @category behaviour
 */
export const isTransient = (error: AiError.AiError): boolean => {
  const reason = error.reason
  return (
    reason._tag === "RateLimitError" ||
    reason._tag === "InternalProviderError" ||
    (reason._tag === "NetworkError" && reason.reason === "TransportError")
  )
}

/**
 * What one failed call means: which trouble it is, and whether trying again later may help. OpenRouter answers an
 * empty credit with HTTP 402, which reaches here as an `UnknownError` carrying that status.
 *
 * @category behaviour
 */
export const troubleOf = (error: AiError.AiError): { readonly trouble: ModelTrouble; readonly retryable: boolean } => {
  const reason = error.reason
  switch (reason._tag) {
    case "AuthenticationError":
    case "QuotaExhaustedError":
      return { trouble: "refused", retryable: false }
    case "RateLimitError":
      return { trouble: "busy", retryable: true }
    case "StructuredOutputError":
    case "InvalidOutputError":
    case "InvalidResponseError":
    case "UnsupportedSchemaError":
      return { trouble: "badAnswer", retryable: false }
    case "UnknownError":
      return reason.http?.response?.status === 402
        ? { trouble: "refused", retryable: false }
        : { trouble: "down", retryable: false }
    case "InternalProviderError":
      return { trouble: "down", retryable: true }
    case "NetworkError":
      return { trouble: "down", retryable: reason.reason === "TransportError" }
    default:
      return { trouble: "down", retryable: false }
  }
}

/**
 * One structured question: its name (the object the model is asked for), an optional system message, the prompt, and
 * an optional cap on the answer's length.
 *
 * @category schemas
 */
export class ModelPrompt extends S.Opaque<ModelPrompt, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9_]{0,63}$/)).pipe(
      S.annotateKey({ description: "The name of the object the model is asked for" })
    ),
    system: S.String.check(S.isMinLength(1), S.isMaxLength(100_000)).pipe(
      S.annotateKey({ description: "The system message, when there is one" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    prompt: S.String.check(S.isMinLength(1), S.isMaxLength(100_000)).pipe(
      S.annotateKey({ description: "What the model is asked" })
    ),
    maxOutputTokens: S.Int.check(S.isBetween({ minimum: 1, maximum: 32_000 })).pipe(
      S.annotateKey({ description: "The most tokens the answer may take, when capped" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    )
  }).pipe($I.annoteSchema("ModelPrompt", { description: "One structured question to a model" }))
) {}

const TokenCount = S.Int.check(S.isGreaterThanOrEqualTo(0))

/**
 * What a call used: tokens in and out, and what it cost in millionths of a dollar when the provider said.
 *
 * @category schemas
 */
export class ModelUsage extends S.Opaque<ModelUsage, { readonly brand: unique symbol }>()(
  S.Struct({
    inputTokens: TokenCount.pipe(S.annotateKey({ description: "Tokens sent" })),
    outputTokens: TokenCount.pipe(S.annotateKey({ description: "Tokens answered" })),
    costMicroUsd: TokenCount.pipe(
      S.annotateKey({ description: "The cost in millionths of a dollar, when the provider reported it" }),
      S.OptionFromOptionalKey
    )
  }).pipe($I.annoteSchema("ModelUsage", { description: "What a model call used" }))
) {}

/**
 * Which model answered, whether it was a fallback, and what the call used.
 *
 * @category schemas
 */
export class ModelAnswered extends S.Opaque<ModelAnswered, { readonly brand: unique symbol }>()(
  S.Struct({
    model: ModelName.pipe(S.annotateKey({ description: "The model that answered, as the provider reported it" })),
    fallback: S.Boolean.pipe(S.annotateKey({ description: "True when a fallback model answered" })),
    usage: ModelUsage.pipe(S.annotateKey({ description: "What the call used" }))
  }).pipe($I.annoteSchema("ModelAnswered", { description: "Which model answered, and what the call used" }))
) {}
