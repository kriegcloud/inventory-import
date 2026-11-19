// What the person decided for one row of a file, as code holds it and as it is stored and sent (its flags), the
// id of one item of a file, and the change to the saved decisions a screen sends.
import { Record as Rec, Tuple } from "effect"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { RowId } from "../Catalog.id.ts"
import { fields } from "../Staging/Staged.read.ts"

const bounded = (max: number) => S.String.check(S.isMaxLength(max))

/**
 * A row's decision as it is stored and sent, the flags a draft has always held: left out, kept over
 * another row with the same SKU, proposals accepted or undone by field, values typed by field, and, for a row whose
 * SKU is stored with other values, whether the stored item stays or the file's row replaces it.
 */
export const RowDecisionFlags = S.Struct({
  out: S.optionalKey(S.Boolean).annotateKey({
    description: "True: the person left the row out. Leave the key out for a row that stays in",
    examples: [true]
  }),
  kept: S.optionalKey(S.Boolean).annotateKey({
    description:
      "True: the person kept this row over another with the same SKU (rows 4 and 10 both say YDR-8742). Leave it out otherwise",
    examples: [true]
  }),
  accepted: S.optionalKey(S.Array(bounded(40)).check(S.isMaxLength(fields.length))).annotateKey({
    description:
      "Fields whose proposal the person accepted: a rule's, or a stored suggestion's. Leave it out when none was accepted",
    examples: [["unitCost"]]
  }),
  reverted: S.optionalKey(S.Array(bounded(40)).check(S.isMaxLength(fields.length))).annotateKey({
    description:
      "Fields whose fix or proposal the person undid: the file's value stands. Leave it out when nothing was undone",
    examples: [["uom"]]
  }),
  edits: S.optionalKey(S.Record(bounded(40), bounded(32767)).check(S.isMaxProperties(fields.length))).annotateKey({
    description: "Values the person typed, by field. Leave it out when nothing was typed",
    examples: [{ name: "Steel Tube 1in" }]
  }),
  stored: S.optionalKey(S.Literals(["keep", "replace"])).annotateKey({
    description:
      "For a row whose SKU is stored with other values: keep the stored item (the row is skipped) or replace it with the file's row"
  })
}).annotate({
  identifier: "RowDecision",
  description:
    "What the person has decided about one row: left out, kept over another row with the same SKU, proposals accepted or undone by field, values typed by field, and stored item kept or replaced"
})
/** The stored form of a row's decision: every key left out when it says nothing. */
export type RowDecisionFlags = typeof RowDecisionFlags.Type

/** Where a row stands by the person's own word. */
export const RowPlaceKind = LiteralKit(["open", "kept", "leftOut"]).annotate({
  identifier: "RowPlaceKind",
  description: "open: nothing said. kept: kept over the rows that share its SKU. leftOut: left out"
})

class PlaceOpen extends S.Opaque<PlaceOpen, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("open") }).annotate({
    identifier: "PlaceOpen",
    description: "The person has not placed the row"
  })
) {}

class PlaceKept extends S.Opaque<PlaceKept, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("kept") }).annotate({
    identifier: "PlaceKept",
    description: "Kept over the other rows that share its SKU"
  })
) {}

class PlaceLeftOut extends S.Opaque<PlaceLeftOut, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("leftOut"),
    wasKept: S.Boolean.pipe(
      S.annotateKey({ description: "True when the row had been kept before it was left out: putting it back keeps it" })
    )
  }).annotate({ identifier: "PlaceLeftOut", description: "Left out by the person" })
) {}

/**
 * Where a row stands by the person's own word: open, kept over its rivals, or left out (remembering a keep made
 * before). The same rule as the review region's own (`@inventory/review/ReviewDecision`), which this module cannot
 * import.
 */
export const RowPlace = RowPlaceKind.mapMembers(() => Tuple.make(PlaceOpen, PlaceKept, PlaceLeftOut)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "RowPlace", description: "Where a row stands by the person's own word" })
)
/** The decoded value of `RowPlace`. */
export type RowPlace = typeof RowPlace.Type

/** Nothing said about the row's place. */
export const placeOpen: RowPlace = PlaceOpen.make({})
/** Kept over its rivals. */
export const placeKept: RowPlace = PlaceKept.make({})
/** Left out; `wasKept` remembers a keep made before. */
export const placeLeftOut = (wasKept: boolean): RowPlace => PlaceLeftOut.make({ wasKept })

/** True when the row is left out. */
export const isLeftOut = (decision: { readonly place: RowPlace }): boolean => decision.place.kind === "leftOut"

/** True when the person kept the row over its rivals, whether or not they then left it out (the stored `kept` flag). */
export const hasKeep = (decision: { readonly place: RowPlace }): boolean =>
  decision.place.kind === "kept" || (decision.place.kind === "leftOut" && decision.place.wasKept)

/** What to do with a row whose SKU is stored with other values. */
export const StoredChoiceKind = LiteralKit(["undecided", "keep", "replace"]).annotate({
  identifier: "StoredChoiceKind",
  description:
    "undecided: the person has not said. keep: the stored item stays and the row is skipped. replace: the file's row replaces it"
})

class StoredUndecided extends S.Opaque<StoredUndecided, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("undecided") }).annotate({
    identifier: "StoredUndecided",
    description: "The person has not said what happens to the stored item"
  })
) {}

class StoredKeep extends S.Opaque<StoredKeep, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("keep") }).annotate({
    identifier: "StoredKeep",
    description: "The stored item stays; the row is skipped"
  })
) {}

class StoredReplace extends S.Opaque<StoredReplace, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("replace") }).annotate({
    identifier: "StoredReplace",
    description: "The file's row replaces the stored item"
  })
) {}

/** For a row whose SKU is stored with other values: keep the stored item, replace it, or not said yet. */
export const StoredChoice = StoredChoiceKind.mapMembers(() =>
  Tuple.make(StoredUndecided, StoredKeep, StoredReplace)
).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "StoredChoice", description: "What to do with a row whose SKU is stored with other values" })
)
/** The decoded value of `StoredChoice`. */
export type StoredChoice = typeof StoredChoice.Type

/** The person has not said. */
export const storedUndecided: StoredChoice = StoredUndecided.make({})
/** The stored item stays. */
export const storedKeep: StoredChoice = StoredKeep.make({})
/** The file's row replaces it. */
export const storedReplace: StoredChoice = StoredReplace.make({})

/** A decision's parts as its decoded and its encoded side both have them. */
type DecisionShape = {
  readonly place: { readonly kind: "open" | "kept" } | { readonly kind: "leftOut"; readonly wasKept: boolean }
  readonly stored: { readonly kind: "undecided" | "keep" | "replace" }
  readonly accepted: ReadonlyArray<string>
  readonly reverted: ReadonlyArray<string>
  readonly edits: { readonly [field: string]: string }
}

/** The flags of a decision: the stored form, every part that says nothing left out. */
const flagsOf = (parts: DecisionShape): RowDecisionFlags => ({
  ...(parts.place.kind === "leftOut" ? { out: true } : {}),
  ...(parts.place.kind === "kept" || (parts.place.kind === "leftOut" && parts.place.wasKept) ? { kept: true } : {}),
  ...(parts.accepted.length === 0 ? {} : { accepted: parts.accepted }),
  ...(parts.reverted.length === 0 ? {} : { reverted: parts.reverted }),
  ...(Rec.isEmptyRecord(parts.edits) ? {} : { edits: parts.edits }),
  ...(parts.stored.kind === "undecided" ? {} : { stored: parts.stored.kind })
})

// A decision as code holds it. Every part is there, empty when the person said nothing about it.
const RowDecisionParts = S.Struct({
  place: RowPlace,
  stored: StoredChoice,
  accepted: S.Array(bounded(40)).check(S.isMaxLength(fields.length)),
  reverted: S.Array(bounded(40)).check(S.isMaxLength(fields.length)),
  edits: S.Record(bounded(40), bounded(32767)).check(S.isMaxProperties(fields.length))
})

/**
 * What the person has decided about one row: where it stands, what happens to a stored item with its SKU, the
 * proposals accepted or undone by field, and the values typed by field. Stored and sent as the flags a draft has
 * always held (`RowDecisionFlags`), so a decision saved by an older build still reads.
 */
export const RowDecision = RowDecisionFlags.pipe(
  S.decodeTo(
    RowDecisionParts,
    SchemaTransformation.transform({
      decode: (flags): (typeof RowDecisionParts)["Encoded"] => ({
        place:
          flags.out === true
            ? { kind: "leftOut", wasKept: flags.kept === true }
            : flags.kept === true
              ? { kind: "kept" }
              : { kind: "open" },
        stored: { kind: flags.stored ?? "undecided" },
        accepted: flags.accepted ?? [],
        reverted: flags.reverted ?? [],
        edits: flags.edits ?? {}
      }),
      encode: (parts): RowDecisionFlags => flagsOf(parts)
    })
  )
)
/** The decoded value of `RowDecision`: what the person decided about one row. */
export type RowDecision = typeof RowDecision.Type

/**
 * A decision from the parts that say something; the rest are empty.
 *
 * @example decisionOf({ accepted: ["uom"] }).place.kind // "open"
 */
export const decisionOf = (parts: Partial<RowDecision> = {}): RowDecision => ({
  place: parts.place ?? placeOpen,
  stored: parts.stored ?? storedUndecided,
  accepted: parts.accepted ?? [],
  reverted: parts.reverted ?? [],
  edits: parts.edits ?? {}
})

/**
 * A decision as its stored flags: the inverse of `decisionFromFlags`.
 *
 * @example decisionToFlags(decisionOf({ accepted: ["uom"] })) // { accepted: ["uom"] }
 */
export const decisionToFlags = (decision: RowDecision): RowDecisionFlags => flagsOf(decision)

/**
 * The decision the stored flags say: what a test or a caller holding the wire form uses.
 *
 * @example decisionFromFlags({ out: true, kept: true }).place // { kind: "leftOut", wasKept: true }
 */
export const decisionFromFlags = (flags: RowDecisionFlags): RowDecision =>
  decisionOf({
    place: flags.out === true ? placeLeftOut(flags.kept === true) : flags.kept === true ? placeKept : placeOpen,
    stored: flags.stored === "keep" ? storedKeep : flags.stored === "replace" ? storedReplace : storedUndecided,
    ...(flags.accepted === undefined ? {} : { accepted: flags.accepted }),
    ...(flags.reverted === undefined ? {} : { reverted: flags.reverted }),
    ...(flags.edits === undefined ? {} : { edits: flags.edits })
  })

/** Every row's decision by row id (`row-56`). This is the draft the server keeps while the person reviews. */
export const SavedDecisions = S.Record(bounded(40), RowDecision)
  .check(S.isMaxProperties(50000))
  .annotate({ description: "Every row's decision by row id (`row-56`)" })
/** The decoded value of `SavedDecisions`: every row's decision by row id (`row-56`). */
export type SavedDecisions = typeof SavedDecisions.Type

/**
 * The id the review screen, the saved decisions and the commit use for one item of the file: its row's number,
 * and its part when the row holds several items. A row that is one item (no part, or part 0) is "row-56", as it
 * always was; the second item of row 8 is "row-8.2", well inside the 40 characters a decision's key may have.
 *
 * @example
 * rowId({ rowNumber: 56 }) // "row-56"
 * rowId({ rowNumber: 8, part: 2 }) // "row-8.2"
 */
export const rowId = (input: { readonly rowNumber: number; readonly part?: number | undefined }): RowId =>
  RowId.make(
    input.part === undefined || input.part === 0 ? `row-${input.rowNumber}` : `row-${input.rowNumber}.${input.part}`
  )

/**
 * What changed in the draft since the last save: the rows whose decision is new or different, and the rows whose
 * decision was taken back. Only the difference travels, so two screens deciding different rows do not collide.
 */
export const DecisionDelta = S.Struct({
  set: SavedDecisions.annotate({
    description: "Decisions that are new or different, by row id (`row-7`)",
    examples: [
      {
        "row-55": decisionOf({ accepted: ["unitCost"] }),
        "row-142": decisionOf({ edits: { name: "Steel Tube 1in" } })
      }
    ]
  }).annotateKey({
    description: "The rows decided since the last save, each with its whole decision",
    messageMissingKey: "Send `set`: the decisions that are new, by row id, or {} for none."
  }),
  clear: S.Array(S.String.check(S.isMaxLength(40)))
    .check(S.isMaxLength(50000))
    .annotate({
      description: "Row ids (`row-7`) whose decision was taken back: they go back to what the file says",
      examples: [["row-18"]]
    })
    .annotateKey({
      description: "The rows whose decision was undone since the last save",
      messageMissingKey: "Send `clear`: the row ids whose decision was taken back, or [] for none."
    })
}).annotate({
  identifier: "DecisionDelta",
  description:
    "What changed in the draft since the last save: the rows whose decision is new or different, and the rows whose decision was taken back"
})
/** The decoded value of `DecisionDelta`: what changed in the draft since the last save. */
export type DecisionDelta = typeof DecisionDelta.Type
