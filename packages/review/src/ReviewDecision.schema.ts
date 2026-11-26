/**
 * What the person decided about one row of a review, as the region holds it and as a saved draft stores it. The one
 * thing not to break: the stored form is the flag object drafts have always held (`{ out?, kept?, accepted?,
 * reverted?, edits? }`), so a draft saved by an older build still restores; only the decoded side is a tagged union.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { identity } from "effect/Function"
import * as Effect from "effect/Effect"
import * as Tuple from "effect/Tuple"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as O from "effect/Option"
import * as SchemaGetter from "effect/SchemaGetter"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { $ReviewId } from "./internal/identity.ts"

const $I = $ReviewId.create("ReviewDecision")

/**
 * A row's id as the caller gives it ("row-56"). Plain bounded text, not a brand: the region keys its maps and its
 * props by the ids the screen hands it.
 *
 * @category schemas
 */
export const RowKey = S.String.check(S.isMinLength(1), S.isMaxLength(64)).pipe(
  $I.annoteSchema("RowKey", { description: "A row's id as the screen gives it", examples: ["row-56"] })
)

/**
 * The decoded value of `RowKey`.
 *
 * @category models
 */
export type RowKey = typeof RowKey.Type

/**
 * A column's id as the caller gives it ("unitCost").
 *
 * @category schemas
 */
export const ColumnKey = S.String.check(S.isMinLength(1), S.isMaxLength(64)).pipe(
  $I.annoteSchema("ColumnKey", { description: "A column's id as the screen gives it", examples: ["unitCost"] })
)

/**
 * The decoded value of `ColumnKey`.
 *
 * @category models
 */
export type ColumnKey = typeof ColumnKey.Type

/**
 * A value the person typed, as text: at most a spreadsheet cell's 32,767 characters.
 *
 * @category schemas
 */
export const CellText = S.String.check(S.isMaxLength(32767)).pipe(
  $I.annoteSchema("CellText", { description: "A value the person typed, as text" })
)

/**
 * The decoded value of `CellText`.
 *
 * @category models
 */
export type CellText = typeof CellText.Type

/**
 * Where a row stands by the person's own word: open (nothing said), kept over the rows that share its key, or left
 * out. A left-out row remembers whether it had been kept, so putting it back returns it to "kept".
 *
 * @category schemas
 */
export const RowPlaceKind = LiteralKit(["open", "kept", "leftOut"]).pipe(
  $I.annoteSchema("RowPlaceKind", { description: "open, kept over its rivals, or left out" })
)

class Open extends S.Opaque<Open, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("open") }).pipe($I.annoteSchema("Open", { description: "The person has not placed the row" }))
) {}

class Kept extends S.Opaque<Kept, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("kept") }).pipe(
    $I.annoteSchema("Kept", { description: "Kept over the other rows that share its key" })
  )
) {}

class LeftOut extends S.Opaque<LeftOut, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("leftOut"),
    wasKept: S.Boolean.pipe(
      S.annotateKey({ description: "True when the row had been kept before it was left out: putting it back keeps it" })
    )
  }).pipe($I.annoteSchema("LeftOut", { description: "Left out by the person" }))
) {}

/**
 * Where a row stands by the person's own word. Branch with `RowPlace.match`.
 *
 * @category schemas
 */
export const RowPlace = RowPlaceKind.mapMembers(() => Tuple.make(Open, Kept, LeftOut)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("RowPlace", { description: "Where a row stands by the person's own word" })
)

/**
 * The decoded value of `RowPlace`.
 *
 * @category models
 */
export type RowPlace = typeof RowPlace.Type

/** Nothing said about the row's place. */
export const open: RowPlace = Open.make({ kind: "open" })
/** Kept over its rivals. */
export const kept: RowPlace = Kept.make({ kind: "kept" })
/** Left out; `wasKept` remembers a keep made before. */
export const leftOut = (wasKept: boolean): RowPlace => LeftOut.make({ kind: "leftOut", wasKept })

/**
 * The place a row returns to when it is put back: kept when it had been kept, otherwise open; a row that is not left
 * out stays where it is.
 *
 * @example putBack(leftOut(true)).kind // "kept"
 */
export const putBack: (place: RowPlace) => RowPlace = RowPlace.match({
  open: identity<RowPlace>,
  kept: identity<RowPlace>,
  leftOut: (place) => (place.wasKept ? kept : open)
})

/** True when the row is left out. */
export const isLeftOut = (place: RowPlace): boolean => place.kind === "leftOut"

/** True when the row is kept over its rivals (and not left out). */
export const isKept = (place: RowPlace): boolean => place.kind === "kept"

/**
 * What the person decided about one row: its place, the fixes they accepted or undid by column, and the values they
 * typed by column. Built with `ReviewDecision.make`; every part but none starts empty.
 *
 * @category schemas
 */
export class ReviewDecision extends S.Opaque<ReviewDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    place: RowPlace.pipe(
      S.annotateKey({ description: "Where the row stands by the person's own word" }),
      S.withConstructorDefault(Effect.succeed(open))
    ),
    accepted: S.Array(ColumnKey).pipe(
      S.annotateKey({ description: "Columns whose proposed fix the person accepted" }),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    reverted: S.Array(ColumnKey).pipe(
      S.annotateKey({ description: "Columns whose applied fix the person undid" }),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    edits: S.Record(ColumnKey, CellText).pipe(
      S.annotateKey({ description: "Values the person typed, by column" }),
      S.withConstructorDefault(Effect.succeed({}))
    )
  }).pipe($I.annoteSchema("ReviewDecision", { description: "What the person decided about one row" }))
) {
  /** True when the decision says nothing: open, nothing accepted, undone or typed. */
  static readonly isEmpty = (decision: ReviewDecision): boolean =>
    RowPlace.guards.open(decision.place) &&
    A.isReadonlyArrayEmpty(decision.accepted) &&
    A.isReadonlyArrayEmpty(decision.reverted) &&
    R.isEmptyRecord(decision.edits)

  /** Whether the person has said anything about the row: proposals and group actions leave such rows alone. */
  static readonly decidedByPerson = (decision: O.Option<ReviewDecision>): boolean =>
    O.exists(decision, (decision) => !ReviewDecision.isEmpty(decision))
}

/**
 * A decision as drafts have always stored it: flags and lists whose keys are left out when they say nothing.
 *
 * @category schemas
 */
export const DecisionFlags = S.Struct({
  out: S.Boolean.pipe(
    S.annotateKey({ description: "True: left out" }),
    S.optionalKey,
    S.decodeTo(S.Boolean, {
      decode: SchemaGetter.withDefault(Effect.succeed(false)),
      encode: SchemaGetter.transformOptional(O.filter((value) => value))
    }),
    S.withConstructorDefault(Effect.succeed(false))
  ),
  kept: S.Boolean.pipe(
    S.annotateKey({ description: "True: kept over its rivals (or before being left out)" }),
    S.optionalKey,
    S.decodeTo(S.Boolean, {
      decode: SchemaGetter.withDefault(Effect.succeed(false)),
      encode: SchemaGetter.transformOptional(O.filter((value) => value))
    }),
    S.withConstructorDefault(Effect.succeed(false))
  ),
  accepted: S.Array(ColumnKey).pipe(
    S.annotateKey({ description: "Columns whose fix was accepted" }),
    S.optionalKey,
    S.decodeTo(S.Array(ColumnKey), {
      decode: SchemaGetter.withDefault<ReadonlyArray<string>>(Effect.succeed([])),
      encode: SchemaGetter.transformOptional(O.filter((value) => !A.isReadonlyArrayEmpty(value)))
    }),
    S.withConstructorDefault(Effect.succeed([]))
  ),
  reverted: S.Array(ColumnKey).pipe(
    S.annotateKey({ description: "Columns whose fix was undone" }),
    S.optionalKey,
    S.decodeTo(S.Array(ColumnKey), {
      decode: SchemaGetter.withDefault<ReadonlyArray<string>>(Effect.succeed([])),
      encode: SchemaGetter.transformOptional(O.filter((value) => !A.isReadonlyArrayEmpty(value)))
    }),
    S.withConstructorDefault(Effect.succeed([]))
  ),
  edits: S.Record(ColumnKey, CellText).pipe(
    S.annotateKey({ description: "Values typed, by column" }),
    S.optionalKey,
    S.decodeTo(S.Record(ColumnKey, CellText), {
      decode: SchemaGetter.withDefault(Effect.succeed({})),
      encode: SchemaGetter.transformOptional(O.filter((value) => !R.isEmptyRecord(value)))
    }),
    S.withConstructorDefault(Effect.succeed({}))
  )
}).pipe($I.annoteSchema("DecisionFlags", { description: "A decision as drafts store it" }))

/**
 * The stored form of a decision. `{ out: true, kept: true }` is a kept row the person then left out.
 *
 * @category models
 */
export type DecisionFlags = typeof DecisionFlags.Type

/** A decision's parts, as both its decoded and its encoded side have them. */
type DecisionParts = {
  readonly place: { readonly kind: "open" | "kept" } | { readonly kind: "leftOut"; readonly wasKept: boolean }
  readonly accepted: ReadonlyArray<string>
  readonly reverted: ReadonlyArray<string>
  readonly edits: { readonly [column: string]: string }
}

/** The flags of a decision: the stored form, every empty part left out. */
export const toFlags = (decision: DecisionParts): typeof DecisionFlags.Encoded => ({
  ...(RowPlace.guards.leftOut(decision.place) ? { out: true } : {}),
  ...(RowPlace.guards.kept(decision.place) || (RowPlace.guards.leftOut(decision.place) && decision.place.wasKept)
    ? { kept: true }
    : {}),
  ...(A.isReadonlyArrayEmpty(decision.accepted) ? {} : { accepted: decision.accepted }),
  ...(A.isReadonlyArrayEmpty(decision.reverted) ? {} : { reverted: decision.reverted }),
  ...(R.isEmptyRecord(decision.edits) ? {} : { edits: decision.edits })
})

/** The decision stored flags say. */
export const fromFlags = (flags: DecisionFlags): ReviewDecision =>
  ReviewDecision.make({
    place: flags.out === true ? leftOut(flags.kept === true) : flags.kept === true ? kept : open,
    accepted: flags.accepted,
    reverted: flags.reverted,
    edits: flags.edits
  })

/**
 * A decision read from and written to its stored flags: the codec a saved draft uses.
 *
 * @category schemas
 */
export const ReviewDecisionFromFlags = DecisionFlags.pipe(
  S.decodeTo(
    ReviewDecision,
    SchemaTransformation.transform({
      decode: (flags): (typeof ReviewDecision)["Encoded"] => ({
        place:
          flags.out === true
            ? { kind: "leftOut", wasKept: flags.kept === true }
            : flags.kept === true
              ? { kind: "kept" }
              : { kind: "open" },
        accepted: flags.accepted,
        reverted: flags.reverted,
        edits: flags.edits
      }),
      encode: (decision) => ({
        out: RowPlace.guards.leftOut(decision.place),
        kept:
          RowPlace.guards.kept(decision.place) || (RowPlace.guards.leftOut(decision.place) && decision.place.wasKept),
        accepted: decision.accepted,
        reverted: decision.reverted,
        edits: decision.edits
      })
    })
  ),
  $I.annoteSchema("ReviewDecisionFromFlags", { description: "A decision, stored as the flags drafts hold" })
)
