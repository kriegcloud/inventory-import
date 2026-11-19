// The five ways a model call can fail that the screens have words for, and those words. Plain values, with no import:
// the browser's one place for failure sentences (@inventory/client/SayError, which the app hands these sentences at start) is on the first page, which must stay light,
// and the server words every `AiUnavailable` with the same sentences (`AiTrouble` and `aiUnavailable` in Api.ts).

/** The five troubles, in the order the contract lists them (`AiTrouble` in Api.ts is their Schema). */
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
