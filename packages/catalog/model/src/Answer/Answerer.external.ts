// The model, as the catalog needs it: whether one can be asked, and one structured answer to one question. Which
// provider answers, with which key and how often it is tried again is the host's (`AnswererOpenRouter`). The one
// thing not to break: a feature that asks ends with `answeredByRules`, so it always answers and says who did.
import { type AiUnavailable, aiUnavailable, type AiTrouble } from "@inventory/catalog-contract/AiUnavailable"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Ref from "effect/Ref"
import * as S from "effect/Schema"

/** Whether a model can be asked. With none, a feature goes straight to its rules and takes no call. */
export const ModelAvailability = LiteralKit(["on", "off"]).annotate({
  identifier: "ModelAvailability",
  description: "Whether a model can be asked now"
})
/** The decoded value of `ModelAvailability`. */
export type ModelAvailability = typeof ModelAvailability.Type

/** One question for the model: what it is asked, under what name it is traced, and how long its answer may be. */
export class ModelQuestion extends S.Opaque<ModelQuestion, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.check(S.isMinLength(1), S.isMaxLength(40)).pipe(
      S.annotateKey({ description: "What the call is, in one word, for its trace", examples: ["suggest"] })
    ),
    prompt: S.String.pipe(S.annotateKey({ description: "What the model is asked" })),
    system: S.Option(S.String).pipe(
      S.annotateKey({ description: "What the model is told about its job; none for none" })
    ),
    maxOutputTokens: S.Option(S.Int).pipe(
      S.annotateKey({ description: "The longest answer it may give; none for the provider's own limit" })
    )
  }).annotate({ identifier: "ModelQuestion", description: "One question for the model" })
) {}

/** A schema a model answers with: an object on the wire, decoded with no services. */
export type AnswerSchema = S.Codec<unknown, Record<string, unknown>, never, never>

/** A structured answer, and which model gave it (the screen says which one answered). */
export interface ModelAnswered<A> {
  readonly value: A
  readonly answeredBy: Extract<AnsweredBy, { readonly _tag: "Model" }>
}

/** What a twin answers one question with: a value (decoded through the question's schema), or a trouble. */
export type ScriptedAnswer =
  | { readonly kind: "answer"; readonly value: unknown }
  | { readonly kind: "trouble"; readonly trouble: AiTrouble; readonly retryable: boolean }

/** The model service of the catalog. */
export class Answerer extends Context.Service<
  Answerer,
  {
    /** Whether a model can be asked now. */
    readonly status: ModelAvailability
    /** One structured answer, decoded through `schema`; a model that cannot answer is an `AiUnavailable`. */
    readonly ask: <Sc extends AnswerSchema>(
      question: ModelQuestion,
      schema: Sc
    ) => Effect.Effect<ModelAnswered<Sc["Type"]>, AiUnavailable>
  }
>()("@inventory/catalog-model/Answer/Answerer.external/Answerer") {
  /** A twin with no model: `status` is off, and asking it anyway is the trouble "no key". */
  static readonly off: Layer.Layer<Answerer> = Layer.succeed(
    Answerer,
    Answerer.of({
      status: "off",
      ask: Effect.fnUntraced(function* () {
        return yield* aiUnavailable({ kind: "noKey", retryable: false })
      })
    })
  )

  /**
   * A twin that answers from a script, one entry per question in order, as the model named `model`. An answer that
   * does not fit the question's schema is the trouble "bad answer", as a real model's is; past the script's end it
   * is "down".
   */
  static readonly scripted = (input: {
    readonly model: string
    readonly answers: ReadonlyArray<ScriptedAnswer>
  }): Layer.Layer<Answerer> =>
    Layer.effect(
      Answerer,
      Effect.gen(function* () {
        const left = yield* Ref.make(input.answers)
        const ask = Effect.fnUntraced(function* <Sc extends AnswerSchema>(_question: ModelQuestion, schema: Sc) {
          const script = yield* Ref.getAndUpdate(left, (answers) => answers.slice(1))
          const next = O.fromUndefinedOr(script[0])
          if (O.isNone(next)) return yield* aiUnavailable({ kind: "down", retryable: true })
          if (next.value.kind === "trouble") {
            return yield* aiUnavailable({ kind: next.value.trouble, retryable: next.value.retryable })
          }
          const value: Sc["Type"] = yield* S.decodeUnknownEffect(schema)(next.value.value).pipe(
            Effect.mapError(() => aiUnavailable({ kind: "badAnswer", retryable: true }))
          )
          const answered: ModelAnswered<Sc["Type"]> = {
            value,
            answeredBy: AnsweredBy.cases.Model.make({ provider: "openrouter", model: input.model, fallback: false })
          }
          return answered
        })
        return Answerer.of({ status: "on", ask })
      })
    )
}

/** True when a model can be asked. */
export const modelIsOn = (status: ModelAvailability): boolean => status === "on"

/**
 * The last step of every feature: when no model could answer, the caller's non-AI result, marked as the rules' answer
 * with the reason, so the screen can say which one answered.
 */
export const answeredByRules =
  <B>(rules: (error: AiUnavailable) => B) =>
  <A, R>(
    self: Effect.Effect<ModelAnswered<A>, AiUnavailable, R>
  ): Effect.Effect<{ readonly value: A | B; readonly answeredBy: AnsweredBy }, never, R> =>
    self.pipe(
      Effect.map((answer): { readonly value: A | B; readonly answeredBy: AnsweredBy } => answer),
      Effect.catchTag("AiUnavailable", (error) =>
        Effect.succeed({ value: rules(error), answeredBy: AnsweredBy.cases.Rules.make({ reason: error.reason }) })
      )
    )
