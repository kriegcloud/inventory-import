import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
// Who is behind a proposed value, in words the person reads. The one thing a reader must not break: nothing here says
// "model" unless the caller said a model made the suggestion. A suggestion whose source the caller did not name is
// called a suggestion, never a guess by anyone in particular.

/** Who prepared a change: a fixed rule, a model, or the person. `undefined` when the caller did not say. */
export type ProposalSource = "rule" | "model" | "person"

/** The words for one source: a short tag, the hidden words beside a mark, and the tooltip on it. */
export type SourceWords = {
  /** One word after a value or on a badge ("Rule", "Model"). */
  readonly tag: string
  /** Read by a screen reader after the value ("suggested by the model"). */
  readonly hidden: string
  /** The tooltip on the mark beside a value. */
  readonly tip: string
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

/** The source and confidence carried by a suggestion's presentation. */
export const ProposalAttribution = S.Struct({
  by: S.Literals(["rule", "model", "person"]).pipe(
    S.annotateKey({ description: "Who made the suggestion" }),
    S.OptionFromOptionalKey
  ),
  confidence: S.Literals(["high", "medium", "low"]).pipe(
    S.annotateKey({ description: "How sure its source is" }),
    S.OptionFromOptionalKey
  )
}).annotate({ description: "Attribution without inventing a source or confidence." })
export type ProposalAttribution = typeof ProposalAttribution.Type

const ProposalLead = S.Struct({
  by: ProposalAttribution.fields.by,
  confidence: S.Literals(["high", "medium", "low"]).pipe(
    S.annotateKey({ description: "Confidence said in the lead; medium when unstated, awaiting a decision" }),
    S.withConstructorDefault(Effect.succeed("medium" as const))
  )
}).annotate({ description: "The existing confidence policy for the lead sentence." })

/** Words for an explicitly known or unknown source. */
export const sourceWordsFor = (source: O.Option<ProposalSource>): SourceWords =>
  O.match(source, { onNone: () => unknownSource, onSome: (source) => known[source] })

const confidenceWords = { high: "High", medium: "Medium", low: "Low" } as const

/** Source and confidence on the Why card; without confidence, the source alone. */
export const sourceAndConfidence = (fix: ProposalAttribution): string => {
  const who = sourceWordsFor(fix.by).tag
  return O.match(fix.confidence, {
    onNone: () => who,
    onSome: (confidence) => `${who} · ${confidenceWords[confidence]}`
  })
}

/** The lead of a Why answer, retaining the existing unstated-confidence policy. */
export const sourceLead = (fix: ProposalAttribution): string => {
  const lead = ProposalLead.make({ by: fix.by, ...R.getSomes({ confidence: fix.confidence }) })
  if (O.contains(lead.by, "rule")) return lead.confidence === "low" ? "Rule, low confidence" : "Rule"
  if (O.contains(lead.by, "person")) return "You"
  const who = O.contains(lead.by, "model") ? "Model's suggestion" : "Suggestion"
  return `${who}, ${lead.confidence} confidence`
}
