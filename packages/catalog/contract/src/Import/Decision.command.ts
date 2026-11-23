// What the person decided for one row of a file, as code holds it and as it is stored and sent (its flags), the
// id of one item of a file, and the change to the saved decisions a screen sends.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { RowId, rowIdPattern } from "../Catalog.id.ts"
import { fields } from "../Staging/Staged.read.ts"
import { nullAsNone } from "@inventory/kernel/Wire"

const bounded = (max: number) => S.String.check(S.isMaxLength(max))

// A field of an item as text: the type a decision has always held, checked against the list of fields (`Field`), so
// a decision can name nothing else. Text, not the literal type, because the screens and the server build decisions
// from columns they hold as text.
const fieldName = S.String.check(S.isPattern(new RegExp(`^(${A.join(fields, "|")})$`)))

// Fields a decision names: each one once.
const fieldList = S.Array(fieldName).check(S.isUnique(), S.isMaxLength(fields.length))

// A row id as text: the key a draft has always held, checked against the row id's form (`RowId`). A key of any other
// form names no row, so a record drops it and a list refuses it.
const rowKey = S.String.check(S.isPattern(rowIdPattern))

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
  accepted: S.optionalKey(fieldList).annotateKey({
    description:
      "Fields whose proposal the person accepted: a rule's, or a stored suggestion's. Leave it out when none was accepted",
    examples: [["unitCost"]]
  }),
  reverted: S.optionalKey(fieldList).annotateKey({
    description:
      "Fields whose fix or proposal the person undid: the file's value stands. Leave it out when nothing was undone. A field also in `accepted` is read as accepted: it was taken again after it was undone",
    examples: [["uom"]]
  }),
  edits: S.optionalKey(S.Record(fieldName, bounded(32767)).check(S.isMaxProperties(fields.length))).annotateKey({
    description:
      "Values the person typed, by field. Leave it out when nothing was typed. A key that is no field is not read",
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
  S.annotate({ identifier: "RowPlace", description: "Where a row stands by the person's own word" }),
  S.toTaggedUnion("kind")
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
export const isLeftOut = (decision: { readonly place: RowPlace }): boolean => RowPlace.guards.leftOut(decision.place)

/** True when the person kept the row over its rivals, whether or not they then left it out (the stored `kept` flag). */
export const hasKeep = (decision: { readonly place: RowPlace }): boolean =>
  RowPlace.guards.kept(decision.place) || (RowPlace.guards.leftOut(decision.place) && decision.place.wasKept)

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
  S.annotate({
    identifier: "StoredChoice",
    description: "What to do with a row whose SKU is stored with other values"
  }),
  S.toTaggedUnion("kind")
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

/**
 * The flags of a decision: the stored form, every part that says nothing left out. It reads the parts' `kind` as the
 * data the encoding turns into flags (either side of the schema), not a decoded value's case: so by its field.
 */
const flagsOf = (parts: DecisionShape): RowDecisionFlags => ({
  ...(parts.place.kind === "leftOut" ? { out: true } : {}),
  ...(parts.place.kind === "kept" || (parts.place.kind === "leftOut" && parts.place.wasKept) ? { kept: true } : {}),
  ...(parts.accepted.length === 0 ? {} : { accepted: parts.accepted }),
  ...(parts.reverted.length === 0 ? {} : { reverted: parts.reverted }),
  ...(R.isEmptyRecord(parts.edits) ? {} : { edits: parts.edits }),
  ...(parts.stored.kind === "undecided" ? {} : { stored: parts.stored.kind })
})

/**
 * The fields undone that the person did not take again: a field both accepted and undone was accepted after it was
 * undone (the review region keeps an undone proposal in `reverted` when it is taken), and the review reads it as
 * accepted (`inForce` in the model's review), so a decision holds it once, as accepted.
 */
const undoneOnly = (accepted: ReadonlyArray<string>, reverted: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(reverted, (field) => !A.contains(accepted, field))

// A decision as code holds it. Every part is there, empty when the person said nothing about it, and no field is
// both accepted and undone.
const RowDecisionParts = S.Struct({
  place: RowPlace,
  stored: StoredChoice,
  accepted: fieldList,
  reverted: fieldList,
  edits: S.Record(fieldName, bounded(32767)).check(S.isMaxProperties(fields.length))
}).check(
  S.makeFilter((parts) => A.isReadonlyArrayEmpty(A.intersection(parts.accepted, parts.reverted)), {
    expected: "a decision with no field both accepted and undone"
  })
)

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
        reverted: undoneOnly(flags.accepted ?? [], flags.reverted ?? []),
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
    ...(flags.reverted === undefined ? {} : { reverted: undoneOnly(flags.accepted ?? [], flags.reverted) }),
    ...(flags.edits === undefined ? {} : { edits: flags.edits })
  })

/** Every row's decision by row id (`row-56`). This is the draft the server keeps while the person reviews. */
export const SavedDecisions = S.Record(rowKey, RowDecision)
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

// A row is either decided again or taken back in one change, never both: the screens make a change from one record
// of rows, so a row that is in both names two things at once.
const clearsNoRowItSets = S.makeFilter(
  (delta: { readonly set: SavedDecisions; readonly clear: ReadonlyArray<string> }) =>
    A.every(delta.clear, (row) => !R.has(delta.set, row)),
  { expected: "no row both in `set` and in `clear`" }
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
  clear: S.Array(rowKey)
    .check(S.isUnique(), S.isMaxLength(50000))
    .annotate({
      description: "Row ids (`row-7`) whose decision was taken back: they go back to what the file says",
      examples: [["row-18"]]
    })
    .annotateKey({
      description: "The rows whose decision was undone since the last save",
      messageMissingKey: "Send `clear`: the row ids whose decision was taken back, or [] for none."
    })
})
  .check(clearsNoRowItSets)
  .annotate({
    identifier: "DecisionDelta",
    description:
      "What changed in the draft since the last save: the rows whose decision is new or different, and the rows whose decision was taken back"
  })
/** The decoded value of `DecisionDelta`: what changed in the draft since the last save. */
export type DecisionDelta = typeof DecisionDelta.Type

/** A draft's revision: 0 for a draft nobody has changed, one more for every change. Never negative. */
const Revision = S.Int.check(S.isGreaterThanOrEqualTo(0))

// As bounded as the rows it speaks of: one key per row of `set` (or cleared row of a save's `over`), each a row id.
const madeOn = S.Record(rowKey, Revision)
  .check(S.isMaxProperties(50000))
  .annotate({
    description:
      "For each row in `set`, and each row in `over`, the draft's revision the screen held when that row was last decided (`ImportView.revision` as it was read then)",
    examples: [{ "row-55": 11, "row-9": 12 }]
  })
  .annotateKey({
    description:
      "The revision each row's decision was made on. A part of it that rests on a column matched again after that revision is not applied, and the answer names it: an accept or an undone fix of that field, a Replace, Keep-stored or keep-one-of-two after the SKU's column, and a Replace or Keep-stored after another field's column when that changed how the row compares with the stored item. A row of `set` left out counts as made on revision 0, and so does a cleared row named in a save's `over`. A revision later than the draft's is refused",
    messageMissingKey:
      "Send `madeOn`: for each row in `set`, the import's revision as the screen held it when that row was decided."
  })

/**
 * What kind of decision a re-match took back. accept: an accept of a field's proposal. stored: a Replace or a
 * Keep-stored. twin: a keep-one-of-two over the rows that share a SKU. undo: an undone fix of a field.
 */
export const TakenBackKind = LiteralKit(["accept", "stored", "twin", "undo"]).annotate({
  identifier: "TakenBackKind",
  description:
    "accept: an accepted proposal. stored: a Replace or Keep-stored. twin: a keep-one-of-two. undo: an undone fix"
})
/** The decoded value of `TakenBackKind`. */
export type TakenBackKind = typeof TakenBackKind.Type

/**
 * A decision the server did not apply because a column it rests on was matched again after it was made (Benjamin,
 * 2026-11-20, group 3: "Server refuses, says so"). An accept or an undone fix rests on its field's column; a Replace,
 * a Keep-stored and a keep-one-of-two rest on the SKU's column, and a Replace or Keep-stored also on another field's
 * column when the re-match changed how the row compares with the stored item. `field` is the field whose column was
 * matched again. Stored answers from before `kind` existed decode as accepts.
 */
export const StaleAccept = S.Struct({
  rowId: S.String.annotateKey({ description: "The row (`row-7`)" }),
  field: S.String.annotateKey({
    description: "The field whose column was matched again (`unitCost`); for an accept, the field accepted"
  }),
  kind: TakenBackKind.pipe(S.withDecodingDefaultKey(Effect.succeed("accept" as const))).annotateKey({
    description: "What was taken back: an accept, a Replace or Keep-stored, a keep-one-of-two, or an undone fix"
  })
}).annotate({
  identifier: "StaleAccept",
  description: "A decision made before a column it rests on was matched again: not applied"
})
/** The decoded value of `StaleAccept`. */
export type StaleAccept = typeof StaleAccept.Type

/**
 * For each row of a save that waited (its first save failed, it was kept across a reload, or a closed tab kept it),
 * the decisions this tab knows the server may hold of it: what the server held when the person began deciding the
 * row, and each decision this tab sent whose fate it does not know; null for no decision, the same as a decision that
 * says nothing. Such a row is written only while what is stored is one of them, or one of them with the parts a match
 * took back since removed, so a decision made elsewhere since is never overwritten unasked (Benjamin, 2026-11-20: "Hold
 * it, show both, ask"). A row not named here is a live press: the last one stands. A key naming no row of `set` or
 * `clear` is not read.
 */
const over = S.Record(rowKey, RowDecision.pipe(S.OptionFromNullOr, S.Array, S.check(S.isMaxLength(50))))
  .check(S.isMaxProperties(50000))
  .annotate({
    description:
      "For each row of the save that waited, the decisions the sender knows the server may hold of it (null for none): the row is written only while one of them is stored"
  })

/** A row of a save that was not written: it waited, and what is stored of it is none of the decisions named in `over`. */
export const DecidedSince = S.Struct({
  rowId: S.String.annotateKey({ description: "The row (`row-7`)" }),
  theirs: RowDecision.pipe(nullAsNone({ description: "The decision stored of it now; null for none" }))
}).annotate({
  identifier: "DecidedSince",
  description: "A row that waited and was decided otherwise since: not written, with what is stored of it"
})
/** The decoded value of `DecidedSince`. */
export type DecidedSince = typeof DecidedSince.Type

/**
 * What a save sends: the decisions made since the last save, and the revision of the draft they were made on. The
 * difference only, so two screens deciding different rows do not collide; what they were made on, so a decision made
 * before a column it rests on was matched again is not applied; and for rows that waited, what they may be written over.
 */
export const SaveRequest = S.Struct({ madeOn, over: over.pipe(S.optionalKey), ...DecisionDelta.fields })
  .check(clearsNoRowItSets)
  .annotate({
    identifier: "SaveRequest",
    description:
      "A save of decisions: the revision of the draft they were made on, the rows whose decision is new or different, and the rows whose decision was taken back"
  })
/** The decoded value of `SaveRequest`. */
export type SaveRequest = typeof SaveRequest.Type

/**
 * What a confirm sends: the revision of the draft its screen shows, and the person's own decisions that screen
 * holds and the server has not been sent yet, with the revision those were made on. Never anybody else's decision,
 * and never one the screen did not show.
 */
export const ConfirmRequest = S.Struct({
  revision: Revision.annotate({
    description:
      "The draft's revision as the confirming screen last read it: `ImportView.revision`, or the `revision` a save of this screen's answered with, but only when that save answered `changed: true` with exactly one more than the revision the screen held. Otherwise somebody else's decision may be in it, and the screen reads the import again before it confirms",
    examples: [12]
  }).annotateKey({
    description:
      "The revision of the draft the screen shows. The confirm is written only while the stored draft is still at this revision",
    messageMissingKey: "Send `revision`: the import's revision as this screen last read it."
  }),
  madeOn,
  ...DecisionDelta.fields
})
  .check(clearsNoRowItSets)
  .annotate({
    identifier: "ConfirmRequest",
    description:
      "A confirm: the draft's revision as the screen shows it, and the decisions made on that screen that are not saved yet (new or different in `set`, taken back in `clear`)"
  })
/** The decoded value of `ConfirmRequest`. */
export type ConfirmRequest = typeof ConfirmRequest.Type
