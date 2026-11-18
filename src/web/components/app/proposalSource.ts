// Who is behind a proposed value, in words the person reads. The one thing a reader must not break: nothing here says
// "model" unless the caller said a model made the suggestion. A suggestion whose source the caller did not name is
// called a suggestion, never a guess by anyone in particular.

/** Who prepared a change: a fixed rule, a model, or the person. `undefined` when the caller did not say. */
export type ProposalSource = "rule" | "model" | "person"

/** The words for one source: a short tag, the hidden words beside a mark, and the tooltip on it. */
export type SourceWords = {
  /** One word after a value or on a badge ("Rule", "Model"). */
  tag: string
  /** Read by a screen reader after the value ("suggested by the model"). */
  hidden: string
  /** The tooltip on the mark beside a value. */
  tip: string
}

const known: Readonly<Record<ProposalSource, SourceWords>> = {
  rule: {
    tag: "Rule",
    hidden: "read by a rule",
    tip: "Read by a fixed rule from the file. Check it before you accept"
  },
  model: { tag: "Model", hidden: "suggested by the model", tip: "Suggested by the model, not by a fixed rule" },
  person: { tag: "You", hidden: "typed or chosen by you", tip: "Typed or chosen by you" }
}

/** The words when the caller did not say who made the suggestion: true whoever it was. */
export const unknownSource: SourceWords = {
  tag: "Suggested",
  hidden: "a suggestion",
  tip: "A suggestion. Check it before you accept"
}

/**
 * The words for a suggestion's source.
 *
 * @example sourceWordsFor("rule").tag // "Rule"
 * @example sourceWordsFor(undefined).tip // "A suggestion. Check it before you accept"
 */
export const sourceWordsFor = (source: ProposalSource | undefined): SourceWords =>
  source === undefined ? unknownSource : known[source]

/**
 * The lead of a "Why?" answer: who is behind the change and, for anything but a fixed rule's sure reading, how sure.
 * Never a percentage.
 *
 * @example sourceLead({ by: "rule" }) // "Rule"
 * @example sourceLead({ by: "rule", confidence: "low" }) // "Rule, low confidence"
 * @example sourceLead({ by: "model", confidence: "medium" }) // "Model's suggestion, medium confidence"
 * @example sourceLead({}) // "Suggestion, medium confidence"
 */
/**
 * Who made a proposal and how sure it is, as the "Why?" card opens: the source's word, a dot, the confidence word.
 * Never a percentage; with no confidence given, the source alone.
 *
 * @example sourceAndConfidence({ by: "rule", confidence: "high" }) // "Rule · High"
 * @example sourceAndConfidence({ by: "model", confidence: "medium" }) // "Model · Medium"
 * @example sourceAndConfidence({}) // "Suggested"
 */
export const sourceAndConfidence = (fix: {
  by?: ProposalSource | undefined
  confidence?: "high" | "medium" | "low" | undefined
}): string => {
  const who = sourceWordsFor(fix.by).tag
  if (fix.confidence === undefined) return who
  return `${who} · ${fix.confidence.charAt(0).toUpperCase()}${fix.confidence.slice(1)}`
}

export const sourceLead = (fix: {
  by?: ProposalSource | undefined
  confidence?: "high" | "medium" | "low" | undefined
}): string => {
  if (fix.by === "rule") return fix.confidence === "low" ? "Rule, low confidence" : "Rule"
  if (fix.by === "person") return "You"
  const who = fix.by === "model" ? "Model's suggestion" : "Suggestion"
  return `${who}, ${fix.confidence ?? "medium"} confidence`
}
