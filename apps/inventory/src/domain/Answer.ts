// WHO ANSWERED. Every result a model may have helped with says which one produced it: a model (and whether it was a
// fallback), or the rules, with the reason no model was used. One shape for every feature, so the screen says it the
// same way everywhere and the table assistant does not keep a second one.
import * as S from "effect/Schema"

/** The model provider the server can reach. A union of one, so the wire keeps naming it. */
export const AiProvider = S.Literals(["openrouter"]).annotate({
  description: "The model provider: OpenRouter (OPENROUTER_API_KEY)."
})
/** One of the `AiProvider` names. */
export type AiProvider = typeof AiProvider.Type

/**
 * Who produced a result that a model may have helped with: a model (which provider and model, and whether it was a
 * fallback) or the rules (the non-AI path, with the reason the model was not used). The screen says which.
 */
export const AnsweredBy = S.Union([
  S.TaggedStruct("Model", {
    provider: AiProvider,
    model: S.String.annotateKey({ description: "The model that answered, as the provider reported it." }),
    fallback: S.Boolean.annotateKey({
      description: "True when it was not the first model of the first provider: a fallback answered."
    })
  }),
  S.TaggedStruct("Rules", {
    reason: S.String.annotateKey({ description: "Why no model answered, in words for the person." })
  })
]).annotate({ identifier: "AnsweredBy", description: "Which one answered: a model, or the rules when no model could." })
/** An `AnsweredBy` value. */
export type AnsweredBy = typeof AnsweredBy.Type
