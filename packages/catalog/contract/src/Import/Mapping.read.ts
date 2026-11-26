// Which file column fills which field: a choice the person made, a match as the review found or was given it, and
// a file column no field reads.
import * as O from "effect/Option"
import * as Tuple from "effect/Tuple"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { Field, StagedColumn } from "../Staging/Staged.read.ts"
import { absentAsNone, nullAsNone } from "@inventory/kernel/Wire"

/** A column the person chose for a field. `column` none (null on the wire) means none, on purpose. */
export const MappingChoice = S.Struct({
  field: Field,
  column: S.Int.pipe(nullAsNone({ description: "The file column's position, from 0; null for none, on purpose" })),
  by: S.Literals(["person"]).annotateKey({ description: "Who chose it: always a person" }),
  at: S.Int.pipe(S.withDecodingDefaultKey(Effect.succeed(0))).annotateKey({
    description:
      "The first revision of the draft on which the field read this column by a person's choice: a decision made on an earlier revision was made before the field read this column, so a decision that rests on the field's column (an accept, an undone fix, and for the SKU a Replace, a Keep-stored or a keep-one-of-two) is not applied. Choosing the column the field already reads changes nothing: the choice keeps the revision it had, 0 when the field read the column by its heading"
  })
}).annotate({
  identifier: "MappingChoice",
  description: "A column the person chose for a field; column null means none, on purpose"
})
/** The decoded value of `MappingChoice`: the column chosen for a field, or none. */
export type MappingChoice = typeof MappingChoice.Type

const ColumnIndex = S.Int.check(S.isGreaterThanOrEqualTo(0))

/**
 * A field that began to read another column at a match: the field matched by hand, when its column changed, and any
 * field the match moved off its column (a field read by its heading moves to its next heading match when a person gives
 * that column to another field). A pick of the column a field already reads is no move (Benjamin, 2026-11-21, "Only
 * when it changes"). Stored with the draft, oldest first, never sent to a screen. It is how the server knows, exactly and after
 * any number of matches, which column a field read at a past revision: the `was` of the first move after that
 * revision, or the column it reads now when there is none; and when a field last moved, so a decision made before
 * that is not applied (Benjamin, 2026-11-20: "Server refuses, says so", "Refuse if it changes the row").
 *
 * @example
 * // Unit cost read column 5 ("Cost") until revision 12, when a person matched it to column 7 ("Price").
 * { field: "unitCost", at: 12, was: 5, column: 7 }
 */
export const ColumnMove = S.Struct({
  field: Field.annotateKey({ description: "The field that moved" }),
  at: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({
    description: "The revision the match moved the draft to: the first revision on which the field reads `column`"
  }),
  was: ColumnIndex.pipe(nullAsNone({ description: "The column the field read before the match; null for none" })),
  column: ColumnIndex.pipe(nullAsNone({ description: "The column the field reads from `at` on; null for none" })),
  knownFrom: S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(
    absentAsNone({
      description:
        "Only on the first move of a field matched before moves were kept: the revision of that match, the first one `was` is known for. Absent when `was` is known for every revision since the move before"
    })
  )
}).annotate({
  identifier: "ColumnMove",
  description: "A field that began to read another column at a match, and the column it read before"
})
/** The decoded value of `ColumnMove`. */
export type ColumnMove = typeof ColumnMove.Type

/** A file column that fills a field: where it is, what it is headed, and a few of its values. */
export const ColumnPick = S.Struct({
  index: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
    S.annotateKey({ description: "The file column's position, from 0" })
  ),
  header: S.String.pipe(S.annotateKey({ description: "That column's heading" })),
  examples: S.Array(S.String)
    .check(S.isMaxLength(5))
    .pipe(S.annotateKey({ description: "A few values from that column, to check the match by eye" }))
}).annotate({ identifier: "ColumnPick", description: "A file column that fills a field" })
/** The decoded value of `ColumnPick`. */
export type ColumnPick = typeof ColumnPick.Type

/** The three ways a field's column was settled. */
export const MatchHow = LiteralKit(["heading", "person", "none"]).annotate({
  identifier: "MatchHow",
  description: "Matched by its heading, chosen by a person, or not matched"
})

class MatchedByHeading extends S.Opaque<MatchedByHeading, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("heading"), field: Field, column: ColumnPick }).annotate({
    identifier: "MatchedByHeading",
    description: "The field is filled by the column whose heading names it"
  })
) {}

class MatchedByPerson extends S.Opaque<MatchedByPerson, { readonly brand: unique symbol }>()(
  S.Struct({
    how: S.tag("person"),
    field: Field,
    column: ColumnPick.pipe(nullAsNone({ description: "The column the person chose; null for none, on purpose" }))
  }).annotate({
    identifier: "MatchedByPerson",
    description: "A person chose the field's column, or chose that no column fills it"
  })
) {}

class NotMatched extends S.Opaque<NotMatched, { readonly brand: unique symbol }>()(
  S.Struct({ how: S.tag("none"), field: Field }).annotate({
    identifier: "NotMatched",
    description: "No heading names the field, and nobody has chosen a column for it"
  })
) {}

/**
 * How one field is filled, by how that was settled: by a heading (with its column), by a person (with the column
 * they chose, or none on purpose), or not at all. `matchedColumn` answers the column whatever settled it.
 */
export const ColumnMatch = MatchHow.mapMembers(() => Tuple.make(MatchedByHeading, MatchedByPerson, NotMatched)).pipe(
  S.annotate({
    identifier: "ColumnMatch",
    description: "How one field is filled: from which file column, and how that was settled"
  }),
  S.toTaggedUnion("how")
)
/** The decoded value of `ColumnMatch`: how one field is filled. */
export type ColumnMatch = typeof ColumnMatch.Type

/**
 * The file column that fills the field, when one does, however it was settled.
 *
 * @example matchedColumn(match) // O.some({ index: 3, header: "Unit", examples: ["EA", "BX"] })
 */
export const matchedColumn = (match: ColumnMatch): O.Option<ColumnPick> =>
  ColumnMatch.match(match, {
    heading: (byHeading) => O.some(byHeading.column),
    person: (byPerson) => byPerson.column,
    none: () => O.none()
  })

/** A file column no field reads, and how many rows hold a value in it: said on screen, never stored. */
export const UnusedColumn = S.Struct({
  ...StagedColumn.fields,
  filled: S.Int.annotateKey({ description: "How many rows of the file hold a value in this column", examples: [20] })
}).annotate({
  identifier: "UnusedColumn",
  description: "A file column no field reads, and how many rows hold a value in it"
})
/** The decoded value of `UnusedColumn`. */
export type UnusedColumn = typeof UnusedColumn.Type

/** A field filled by the column whose heading names it. */
export const matchedByHeading = (match: { readonly field: Field; readonly column: ColumnPick }): ColumnMatch =>
  MatchedByHeading.make(match)

/** A field whose column a person chose, or chose to leave without one. */
export const matchedByPerson = (match: { readonly field: Field; readonly column: O.Option<ColumnPick> }): ColumnMatch =>
  MatchedByPerson.make(match)

/** A field no heading names and nobody has chosen a column for. */
export const notMatched = (match: { readonly field: Field }): ColumnMatch => NotMatched.make(match)
