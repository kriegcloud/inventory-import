/**
 * What the driver is built from: the model settings (key, model, fallbacks, on or off) and the one retry policy.
 *
 * @packageDocumentation
 */
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"
import * as S from "effect/Schema"
import { ModelId } from "./OpenRouter.schema.ts"
import { $OpenrouterId } from "./internal/identity.ts"

const $I = $OpenrouterId.create("OpenRouterConfig")

/**
 * The model settings, as the host reads them. AI is on only when `enabled` is true and a key is set; a blank key is
 * no key.
 *
 * @category schemas
 */
export class OpenRouterSettings extends S.Opaque<OpenRouterSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    enabled: S.Boolean.pipe(
      S.annotateKey({ description: "False turns AI off even with a key set" }),
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    model: ModelId.pipe(S.annotateKey({ description: "The vendor/model id asked first" })),
    fallbackModels: S.Array(ModelId.pipe(S.annotateKey({ description: "One fallback vendor/model id" }))).pipe(
      S.check(S.isMaxLength(3)),
      S.annotateKey({ description: "Models OpenRouter tries, in order, inside one call when the first one fails" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    apiKey: S.Redacted(S.String.check(S.isPattern(/\S/))).pipe(
      S.annotateKey({ description: "The OpenRouter key. None, or only spaces: AI is off" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    )
  }).pipe(
    $I.annoteSchema("OpenRouterSettings", { description: "The model settings: key, model, fallbacks, on or off" })
  )
) {}

/**
 * The one retry policy for model calls: each attempt has a timeout, a transient failure (busy, provider down,
 * unreachable) is tried again up to `retries` more times with exponential, jittered backoff, and the whole call has a
 * deadline. A refused key or an answer that does not fit is never tried again.
 *
 * @category schemas
 */
export class ModelPolicy extends S.Opaque<ModelPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    attemptTimeout: S.Duration.pipe(
      S.annotateKey({ description: "How long one attempt may take" }),
      S.withConstructorDefault(Effect.succeed(Duration.seconds(15))),
      S.withDecodingDefaultTypeKey(Effect.succeed(Duration.seconds(15)))
    ),
    retries: S.Int.check(S.isBetween({ minimum: 0, maximum: 5 })).pipe(
      S.annotateKey({ description: "How many more times a transient failure is tried" }),
      S.withConstructorDefault(Effect.succeed(2)),
      S.withDecodingDefaultTypeKey(Effect.succeed(2))
    ),
    backoff: S.Duration.pipe(
      S.annotateKey({ description: "The first wait before a retry; it doubles, with jitter" }),
      S.withConstructorDefault(Effect.succeed(Duration.millis(500))),
      S.withDecodingDefaultTypeKey(Effect.succeed(Duration.millis(500)))
    ),
    deadline: S.Duration.pipe(
      S.annotateKey({ description: "How long the whole call may take, retries included" }),
      S.withConstructorDefault(Effect.succeed(Duration.seconds(40))),
      S.withDecodingDefaultTypeKey(Effect.succeed(Duration.seconds(40)))
    )
  }).pipe($I.annoteSchema("ModelPolicy", { description: "The one retry policy for model calls" }))
) {
  /** The policy with its usual values: 15 s per attempt, 2 retries from 500 ms, a 40 s deadline. */
  static readonly default: ModelPolicy = ModelPolicy.make({})

  /** The wait between attempts: exponential from `backoff`, jittered. */
  static readonly schedule = (policy: Pick<ModelPolicy, "backoff">) =>
    Schedule.exponential(policy.backoff).pipe(Schedule.jittered)
}
