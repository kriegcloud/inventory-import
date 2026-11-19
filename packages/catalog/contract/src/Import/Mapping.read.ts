// Which file column fills which field: a choice the person made, a match as the review found or was given it, and
// a file column no field reads.
import { Option, Tuple } from "effect"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { Field, StagedColumn } from "../Staging/Staged.read.ts"
import { nullAsNone } from "@inventory/kernel/Wire"

/** A column the person chose for a field. `column` null means none, on purpose. */
export const MappingChoice = S.Struct({
  field: Field,
  column: S.NullOr(S.Int).annotateKey({
    description: "The file column's position, from 0; null for none, on purpose"
  }),
  by: S.Literals(["person"]).annotateKey({ description: "Who chose it: always a person" })
}).annotate({
  identifier: "MappingChoice",
  description: "A column the person chose for a field; column null means none, on purpose"
})
/** The decoded value of `MappingChoice`: the column chosen for a field, or none. */
export type MappingChoice = typeof MappingChoice.Type

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
  S.toTaggedUnion("how"),
  S.annotate({
    identifier: "ColumnMatch",
    description: "How one field is filled: from which file column, and how that was settled"
  })
)
/** The decoded value of `ColumnMatch`: how one field is filled. */
export type ColumnMatch = typeof ColumnMatch.Type

/**
 * The file column that fills the field, when one does, however it was settled.
 *
 * @example matchedColumn(match) // Option.some({ index: 3, header: "Unit", examples: ["EA", "BX"] })
 */
export const matchedColumn = (match: ColumnMatch): Option.Option<ColumnPick> =>
  match.how === "heading" ? Option.some(match.column) : match.how === "person" ? match.column : Option.none()

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
export const matchedByPerson = (match: {
  readonly field: Field
  readonly column: Option.Option<ColumnPick>
}): ColumnMatch => MatchedByPerson.make(match)

/** A field no heading names and nobody has chosen a column for. */
export const notMatched = (match: { readonly field: Field }): ColumnMatch => NotMatched.make(match)
