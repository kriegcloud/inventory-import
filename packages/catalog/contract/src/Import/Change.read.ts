// A value an import wrote that differs from its file: by a rule, by a proposal the person accepted, or typed. The
// stored columns are read and written by the two mappers here.
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { Field } from "../Staging/Staged.read.ts"

/** How sure a proposal's source is, in a word. Code sets it from the file's own rows. */
export const Confidence = S.Literals(["high", "medium", "low"]).annotate({
  description: "How sure a proposal's source is, in a word"
})
/** The decoded value of `Confidence`: how sure a proposal's source is, in a word. */
export type Confidence = typeof Confidence.Type

/** Where a written value came from: a rule, a model's suggestion, or the person. */
export const ChangeSource = LiteralKit(["rule", "model", "person"]).annotate({
  identifier: "ChangeSource",
  description: "Where the new value came from: a rule, a model's suggestion the person accepted, or the person"
})
/** The decoded value of `ChangeSource`. */
export type ChangeSource = typeof ChangeSource.Type

/** The three ways a value that differs from the file came to stand. */
export const ChangeHow = LiteralKit(["appliedByRule", "acceptedProposal", "typed"]).annotate({
  identifier: "ChangeHow",
  description:
    "appliedByRule: a form-only rule wrote it and nobody undid it. acceptedProposal: the person accepted a rule's or a model's proposal. typed: the person typed or chose it"
})
/** The decoded value of `ChangeHow`. */
export type ChangeHow = typeof ChangeHow.Type

// What every change says: the field, the file's value and the value written in its place.
const changed = {
  field: Field,
  from: S.String.pipe(S.annotateKey({ description: "The value as the file gives it", examples: ["bx"] })),
  to: S.String.pipe(S.annotateKey({ description: "The value the import wrote in its place", examples: ["BX"] }))
}
const proposalBasis = S.String.pipe(S.annotateKey({ description: "What the proposal rested on, in a sentence" }))
const proposalConfidence = Confidence.pipe(S.annotateKey({ description: "How sure the proposal's source was" }))

class AppliedByRule extends S.Opaque<AppliedByRule, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("appliedByRule"), ...changed, basis: proposalBasis, confidence: proposalConfidence }).annotate({
    identifier: "AppliedByRule",
    description: "A form-only rule wrote the value, and nobody undid it"
  })
) {}

class AcceptedProposal extends S.Opaque<AcceptedProposal, { readonly brand: unique symbol }>()(
  S.Struct({
    how: S.tag("acceptedProposal"),
    ...changed,
    source: LiteralKit(["rule", "model"]).pipe(
      S.annotateKey({ description: "Who proposed it: a rule, or a model's suggestion" })
    ),
    basis: proposalBasis,
    confidence: proposalConfidence
  }).annotate({ identifier: "AcceptedProposal", description: "The person accepted a rule's or a model's proposal" })
) {}

class TypedValue extends S.Opaque<TypedValue, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("typed"), ...changed }).annotate({
    identifier: "TypedValue",
    description: "The person typed or chose the value"
  })
) {}

/**
 * One value that differs from the file, by how it came to stand: a rule applied it, the person accepted a proposal,
 * or the person typed it. Only a value that came from a proposal has a basis and a confidence; `changeSource` and
 * `changeDecidedBy` answer who was behind it in each case.
 */
export const Change = ChangeHow.mapMembers(() => Tuple.make(AppliedByRule, AcceptedProposal, TypedValue)).pipe(
  S.annotate({
    identifier: "Change",
    description: "One value that differs from the file, and how it came to stand"
  }),
  S.toTaggedUnion("how")
)
/** The decoded value of `Change`: one value that differs from the file, and how it came to stand. */
export type Change = typeof Change.Type

/** Where the new value came from: a rule, a model's suggestion, or the person. */
export const changeSource = (change: Change): ChangeSource =>
  Change.match(change, {
    appliedByRule: (): ChangeSource => "rule",
    acceptedProposal: (accepted): ChangeSource => accepted.source,
    typed: (): ChangeSource => "person"
  })

/** Who put the value in force: the rule that applied it, or the person who accepted or typed it. */
export const changeDecidedBy = (change: Change): "rule" | "person" =>
  Change.guards.appliedByRule(change) ? "rule" : "person"

/** What a proposal rested on; none for a value the person typed. */
export const changeBasis = (change: Change): O.Option<string> =>
  Change.guards.typed(change) ? O.none() : O.some(change.basis)

/** How sure a proposal's source was; none for a value the person typed. */
export const changeConfidence = (change: Change): O.Option<Confidence> =>
  Change.guards.typed(change) ? O.none() : O.some(change.confidence)

/** The words `importChange.how` has always held for each case, and the activity view shows where there is no basis. */
export const changeHowWords = {
  appliedByRule: "applied by a rule",
  acceptedProposal: "accepted a proposal",
  typed: "typed or chose a value"
} as const satisfies Record<ChangeHow, string>

/** A change as the columns of `importChange` store it; `basis` and `confidence` are null for a typed value. */
export type StoredChange = {
  readonly field: Field
  readonly from: string
  readonly to: string
  readonly source: ChangeSource
  readonly how: (typeof changeHowWords)[ChangeHow]
  readonly basis: O.Option<string>
  readonly confidence: O.Option<Confidence>
}

/**
 * What a proposal stored by an older build, with no basis or confidence, reads as: no basis, and low confidence, the
 * least it can claim. No recorded decision backs these two values; they are listed for Benjamin's ruling in
 * goals/defaults-at-boundaries (SPEC, "Defaults nobody decided"). A row of the current build always has both.
 */
const unrecorded: { readonly basis: string; readonly confidence: Confidence } = { basis: "", confidence: "low" }

/** The change the stored columns say. */
export const changeFromStored = (stored: StoredChange): Change => {
  const core = { field: stored.field, from: stored.from, to: stored.to }
  const said = {
    basis: O.match(stored.basis, { onNone: () => unrecorded.basis, onSome: identity }),
    confidence: O.match(stored.confidence, { onNone: () => unrecorded.confidence, onSome: identity })
  }
  return stored.how === "typed or chose a value"
    ? TypedValue.make(core)
    : stored.how === "applied by a rule"
      ? AppliedByRule.make({ ...core, ...said })
      : AcceptedProposal.make({ ...core, source: stored.source === "model" ? "model" : "rule", ...said })
}

/** A change as `importChange`'s columns: the inverse of `changeFromStored`, with who put it in force. */
export const changeToStored = (change: Change): StoredChange & { readonly decidedBy: "rule" | "person" } => ({
  field: change.field,
  from: change.from,
  to: change.to,
  source: changeSource(change),
  decidedBy: changeDecidedBy(change),
  how: changeHowWords[change.how],
  basis: changeBasis(change),
  confidence: changeConfidence(change)
})

/** A value a form-only rule wrote. */
export const appliedByRule = (change: Omit<AppliedByRule, "how" | "brand">): Change => AppliedByRule.make(change)
/** A proposal the person accepted. */
export const acceptedProposal = (change: Omit<AcceptedProposal, "how" | "brand">): Change =>
  AcceptedProposal.make(change)
/** A value the person typed or chose. */
export const typedChange = (change: Omit<TypedValue, "how" | "brand">): Change => TypedValue.make(change)
