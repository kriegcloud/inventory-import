// Why no model answered: the five troubles the screens have words for, those words, and the failure an endpoint
// answers with (503). Plain values first, so the browser can take the sentences without the schema.
import * as S from "effect/Schema"

export const aiTroubles = ["noKey", "refused", "busy", "badAnswer", "down"] as const

/** One of the five troubles: see `aiTroubles`. */
export type ModelTrouble = (typeof aiTroubles)[number]

/**
 * The five model failures, each with what happened and what to do: the one place they are worded. A refused key or an
 * empty credit is not "try again", since trying again will not help; the exact cause is in the server's log. The
 * server words every `AiUnavailable` with these, and so does the line that says the rules answered instead.
 *
 * @example modelSentences.busy // "The model is busy right now. Try again in a minute."
 */
export const modelSentences: Readonly<Record<ModelTrouble, string>> = {
  noKey: "No AI key is set up, so the model was not asked. Everything else works without it.",
  refused: "AI is not available on this copy of the app. Everything else works without it.",
  busy: "The model is busy right now. Try again in a minute.",
  badAnswer: "The model answered, but its answer could not be used. Nothing it said was kept; try again.",
  down: "The model is not answering right now. Try again later."
}

/** Why no model answered, in the five cases the screens have words for (`modelSentences`). */
export const AiTrouble = S.Literals(aiTroubles).annotate({
  description:
    "noKey: no key, or AI turned off. refused: the key was refused or its account has no credit left (trying again " +
    "will not help). busy: rate-limited. badAnswer: an answer that did not fit. down: anything else."
})

/** One of the `AiTrouble` names. */
export type AiTrouble = typeof AiTrouble.Type

/**
 * The model could not be used: no key, AI turned off, a provider that is down or busy, a timeout, or an answer that
 * did not fit. `reason` is `modelSentences[kind]`, a sentence for the person (`aiUnavailable` makes it); the
 * provider's own text goes to the log, never to the screen.
 */
export class AiUnavailable extends S.TaggedError<AiUnavailable, { readonly brand: unique symbol }>()(
  "AiUnavailable",
  {
    reason: S.String.annotateKey({ description: "What happened, in words for the person. No provider text." }),
    kind: AiTrouble,
    retryable: S.Boolean.annotateKey({
      description: "True when trying again later may work (busy, down). False for no key, a refused key, a bad answer."
    })
  },
  { httpApiStatus: 503, description: "No model could answer. Features fall back to their non-AI path." }
) {}

/**
 * The failure of a model call of this kind, worded by `modelSentences`.
 *
 * @example
 * aiUnavailable({ kind: "busy", retryable: true }).reason // "The model is busy right now. Try again in a minute."
 */
export const aiUnavailable = (input: { readonly kind: AiTrouble; readonly retryable: boolean }): AiUnavailable =>
  AiUnavailable.make({ reason: modelSentences[input.kind], kind: input.kind, retryable: input.retryable })
