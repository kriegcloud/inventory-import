/**
 * The model for tests, with no key and no spend: off; a scripted model whose replies (or failures) are played in
 * order through the real call path, so the policy, the timeouts and the trouble mapping are the driver's own; and the
 * real OpenRouter client over a scripted HTTP transport, for what is sent and how statuses map.
 *
 * @packageDocumentation
 */
import type * as AiError from "effect/ai/AiError"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import { identity } from "effect/Function"
import * as Stream from "effect/Stream"
import * as HttpClient from "effect/http/HttpClient"
import type * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import type { ModelPolicy, OpenRouterSettings } from "./OpenRouter.config.ts"
import { ModelUnavailable } from "./OpenRouter.errors.ts"
import { type ModelId, type ModelStatus, ModelStatus as Status, type OffReason } from "./OpenRouter.schema.ts"
import { OpenRouter } from "./OpenRouter.service.ts"
import { type AnswerSchema, ask } from "./internal/plan.ts"

/**
 * One scripted reply: the text the model answers (JSON for a structured answer), no answer at all (`hang`, for the
 * timeouts), or the failure it fails with.
 *
 * @category models
 */
export type ScriptedReply =
  | { readonly text: string; readonly modelId: O.Option<string> }
  | { readonly hang: true }
  | AiError.AiError

/**
 * Model test layers.
 *
 * @category layers
 */
export class OpenRouterTest {
  private constructor() {}

  /** AI off: the status says why, and every call fails with `noKey` without a request. */
  static readonly off = (why: typeof OffReason.Type, model: ModelId): Layer.Layer<OpenRouter> =>
    Layer.succeed(
      OpenRouter,
      OpenRouter.of({
        status: Status.cases.off.make({ kind: "off", why, model }),
        generateObject: Effect.fn("OpenRouter.generateObject")(function* () {
          return yield* ModelUnavailable.make({ trouble: "noKey", retryable: false })
        })
      })
    )

  /**
   * A model that plays `replies` in order, one per attempt, through the real call path; past the end the last reply
   * plays again. `calls` reads how many attempts reached the model.
   */
  static readonly scripted = (
    replies: ReadonlyArray<ScriptedReply>,
    options: {
      readonly model: ModelId
      readonly fallbackModels: ReadonlyArray<ModelId>
      readonly policy: ModelPolicy
    }
  ): { readonly layer: Layer.Layer<OpenRouter>; readonly calls: () => number } => {
    const count = MutableRef.make(0)
    const layer = Layer.effect(
      OpenRouter,
      Effect.gen(function* () {
        const { fallbackModels, policy } = options
        const status: ModelStatus = Status.cases.on.make({ kind: "on", model: options.model, fallbackModels })
        const languageModel = yield* LanguageModel.make({
          generateText: Effect.fnUntraced(function* () {
            const index = MutableRef.getAndIncrement(count)
            // Past the end of the script, the last reply plays again: a test that asks many times scripts it once.
            const reply = A.get(replies, Math.min(index, replies.length - 1))
            if (O.isNone(reply)) return yield* Effect.die("The script has no replies")
            if ("hang" in reply.value) return yield* Effect.never
            if ("text" in reply.value) {
              return [
                {
                  type: "response-metadata" as const,
                  modelId: O.match(reply.value.modelId, { onNone: () => options.model, onSome: identity })
                },
                { type: "text" as const, text: reply.value.text }
              ]
            }
            return yield* reply.value
          }),
          streamText: () => Stream.empty
        })
        const models = Context.make(LanguageModel.LanguageModel, languageModel)
        return OpenRouter.of({
          status,
          generateObject: Effect.fn("OpenRouter.generateObject")(function* <Sc extends AnswerSchema>(
            prompt: Parameters<OpenRouter["Service"]["generateObject"]>[0],
            schema: Sc
          ) {
            return yield* ask({
              models,
              model: options.model,
              fallbackModels,
              policy,
              prompt,
              schema,
              withConfig: (effect) => effect
            })
          })
        })
      })
    )
    return { layer, calls: () => MutableRef.get(count) }
  }

  /**
   * The real service over a scripted HTTP transport: `respond` answers each request OpenRouter's client sends.
   */
  static readonly overHttp = (
    settings: OpenRouterSettings,
    respond: (request: HttpClientRequest.HttpClientRequest) => Response,
    policy: ModelPolicy
  ): Layer.Layer<OpenRouter> =>
    OpenRouter.layer(settings, policy).pipe(
      Layer.provide(
        Layer.succeed(
          HttpClient.HttpClient,
          HttpClient.make((request) => Effect.sync(() => HttpClientResponse.fromWeb(request, respond(request))))
        )
      )
    )
}
