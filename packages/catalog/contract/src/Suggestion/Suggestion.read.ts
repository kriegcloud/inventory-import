// A suggestion for something the fixed rules cannot settle: a name, a category, or a file column for a field. It
// never applies itself; the person accepts or rejects it. Its table's columns are read and written by the two
// mappers here, so the stored rows keep their shape.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { RowId, SuggestionId } from "../Catalog.id.ts"
import { categories, maxNameLength } from "../Item/Item.read.ts"
import { Field } from "../Staging/Staged.read.ts"

/** Who made a suggestion: a language model, or a fixed rule. */
export const SuggestionByKind = LiteralKit(["model", "rule"]).annotate({
  identifier: "SuggestionByKind",
  description: "Who suggested it: a language model, or a rule"
})
/** The decoded value of `SuggestionByKind`. */
export type SuggestionByKind = typeof SuggestionByKind.Type

class SuggestedByModel extends S.Opaque<SuggestedByModel, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("model"),
    model: S.String.check(S.isMinLength(1), S.isMaxLength(200)).pipe(
      S.annotateKey({ description: "The model that suggested it, as the provider reported it" })
    )
  }).annotate({ identifier: "SuggestedByModel", description: "A language model suggested it" })
) {}

class SuggestedByRule extends S.Opaque<SuggestedByRule, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("rule") }).annotate({
    identifier: "SuggestedByRule",
    description: "A fixed rule suggested it"
  })
) {}

/** Who made a suggestion: a model, named, or a rule. */
export const SuggestionBy = SuggestionByKind.mapMembers(() => Tuple.make(SuggestedByModel, SuggestedByRule)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "SuggestionBy", description: "Who suggested it: a model, named, or a rule" })
)
/** The decoded value of `SuggestionBy`. */
export type SuggestionBy = typeof SuggestionBy.Type

/** Suggested by `model`. */
export const suggestedByModel = (model: string): SuggestionBy => SuggestedByModel.make({ model })
/** Suggested by a rule. */
export const suggestedByRule: SuggestionBy = SuggestedByRule.make({})

/** The three things a suggestion can be for. */
export const SuggestionKind = LiteralKit(["name", "category", "column"]).annotate({
  identifier: "SuggestionKind",
  description: "A name for a row with none, a category for a row whose category is not listed, or a column for a field"
})
/** The decoded value of `SuggestionKind`. */
export type SuggestionKind = typeof SuggestionKind.Type

const suggestionId = SuggestionId.pipe(S.annotateKey({ description: "The suggestion's id" }))
const suggestionConfidence = LiteralKit(["medium", "low"]).pipe(
  S.annotateKey({
    description: "How sure it is, set by the guard from the file's rows, never by the model: medium at most"
  })
)
const suggestionBasis = S.String.pipe(
  S.annotateKey({ description: "One sentence of evidence, written by code from the file's rows" })
)
// What a suggestion for one row's cell says: the row, the cell as the file has it, and the value suggested.
const rowSuggestion = {
  id: suggestionId,
  rowId: RowId.pipe(S.annotateKey({ description: "The row it is for, as the review keys rows (`row-7`)" })),
  rowNumber: S.Int.pipe(S.annotateKey({ description: "That row's number in the file" })),
  from: S.String.pipe(S.annotateKey({ description: "The cell exactly as the file has it" })),
  to: S.String.pipe(S.annotateKey({ description: "The suggested value", examples: ["Nylon Coil"] })),
  by: SuggestionBy,
  confidence: suggestionConfidence,
  basis: suggestionBasis
}

class NameSuggestion extends S.Opaque<NameSuggestion, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("name"), ...rowSuggestion }).annotate({
    identifier: "NameSuggestion",
    description: "A name for a row whose name is empty, from its description"
  })
) {}

class CategorySuggestion extends S.Opaque<CategorySuggestion, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("category"), ...rowSuggestion }).annotate({
    identifier: "CategorySuggestion",
    description: "A listed category for a row whose category is not one of them"
  })
) {}

class ColumnSuggestion extends S.Opaque<ColumnSuggestion, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("column"),
    id: suggestionId,
    field: Field,
    column: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.annotateKey({ description: "The file column's position from 0: what `match` takes" })
    ),
    heading: S.String.pipe(S.annotateKey({ description: "That file column's heading" })),
    by: SuggestionBy,
    confidence: suggestionConfidence,
    basis: suggestionBasis
  }).annotate({
    identifier: "ColumnSuggestion",
    description: "A file column for a field no heading matched"
  })
) {}

/**
 * A stored suggestion for something the fixed rules cannot settle: a name for a row with none (`name`), a category
 * for a row whose category is not on the list (`category`), or a file column for a field no heading matched
 * (`column`). A model or a rule made it and the guard in Suggest.ts checked it before it was stored. It never
 * applies itself: a name or a category becomes a proposal in `review` that the person accepts or rejects, and a
 * column is offered for the person to match.
 */
export const Suggestion = SuggestionKind.mapMembers(() =>
  Tuple.make(NameSuggestion, CategorySuggestion, ColumnSuggestion)
).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({
    identifier: "Suggestion",
    description: "A stored suggestion for something the fixed rules cannot settle; the person accepts or rejects it"
  })
)
/** The decoded value of `Suggestion`. */
export type Suggestion = typeof Suggestion.Type

/** A suggestion before it is stored: everything but its id. */
export type NewSuggestion =
  | {
      readonly kind: "name" | "category"
      readonly rowId: RowId
      readonly rowNumber: number
      readonly from: string
      readonly to: string
      readonly by: SuggestionBy
      readonly confidence: "medium" | "low"
      readonly basis: string
    }
  | {
      readonly kind: "column"
      readonly field: Field
      readonly column: number
      readonly heading: string
      readonly by: SuggestionBy
      readonly confidence: "medium" | "low"
      readonly basis: string
    }

/** The field a suggestion is for: its own for a column, and the one its kind names for a row's cell. */
export const suggestionField = (suggestion: NewSuggestion): Field =>
  suggestion.kind === "column" ? suggestion.field : suggestion.kind

/** A new suggestion as it is stored, with its id. */
export const storedSuggestion = (input: { readonly id: SuggestionId; readonly made: NewSuggestion }): Suggestion => {
  const { id, made } = input
  if (made.kind === "column") {
    const { kind: _kind, ...column } = made
    return ColumnSuggestion.make({ id, ...column })
  }
  const { kind, ...cell } = made
  return kind === "name" ? NameSuggestion.make({ id, ...cell }) : CategorySuggestion.make({ id, ...cell })
}

/** A suggestion as the columns of `importSuggestion` hold it: the row id is empty, not null, for a column. */
export type StoredSuggestionRow = {
  readonly id: SuggestionId
  readonly kind: SuggestionKind
  readonly rowId: RowId | ""
  readonly rowNumber: number | null
  readonly field: Field
  readonly from: string
  readonly to: string
  readonly column: number | null
  readonly by: SuggestionByKind
  readonly model: string | null
  readonly confidence: "medium" | "low"
  readonly basis: string
}

/** A suggestion as its table's columns: a column suggestion stores its heading as the value suggested. */
export const suggestionToStored = (suggestion: Suggestion): StoredSuggestionRow => {
  const shared = {
    id: suggestion.id,
    kind: suggestion.kind,
    field: suggestionField(suggestion),
    by: suggestion.by.kind,
    model: suggestion.by.kind === "model" ? suggestion.by.model : null,
    confidence: suggestion.confidence,
    basis: suggestion.basis
  }
  return suggestion.kind === "column"
    ? { ...shared, rowId: "", rowNumber: null, from: "", to: suggestion.heading, column: suggestion.column }
    : {
        ...shared,
        rowId: suggestion.rowId,
        rowNumber: suggestion.rowNumber,
        from: suggestion.from,
        to: suggestion.to,
        column: null
      }
}

/**
 * The suggestion the stored columns say, or none for a row that says no whole suggestion (a column with no
 * position, a row's suggestion with no row): such a row is never shown.
 */
export const suggestionFromStored = (row: StoredSuggestionRow): O.Option<Suggestion> => {
  const by =
    row.by === "model" && row.model !== null && row.model !== "" ? suggestedByModel(row.model) : suggestedByRule
  const said = { by, confidence: row.confidence, basis: row.basis }
  if (row.kind === "column") {
    return row.column === null
      ? O.none()
      : O.some(
          storedSuggestion({
            id: row.id,
            made: { kind: "column", field: row.field, column: row.column, heading: row.to, ...said }
          })
        )
  }
  return row.rowId === "" || row.rowNumber === null
    ? O.none()
    : O.some(
        storedSuggestion({
          id: row.id,
          made: { kind: row.kind, rowId: row.rowId, rowNumber: row.rowNumber, from: row.from, to: row.to, ...said }
        })
      )
}

/**
 * Whether a suggestion still fits its row: a name only for a row whose name is empty, at most 120 characters; a
 * category only one of the listed ones, for a row whose category is not listed. The guard asks before storing and
 * the review asks again before showing, so a stored row that no longer fits is never proposed.
 */
export const suggestionFits = (input: {
  readonly kind: SuggestionKind
  readonly to: string
  readonly file: Readonly<Record<Field, string>>
}): boolean => {
  const to = Str.trim(input.to)
  if (input.kind === "name") {
    return Str.trim(input.file.name) === "" && to !== "" && to === input.to && to.length <= maxNameLength
  }
  if (input.kind === "category") {
    return (
      A.contains(categories as ReadonlyArray<string>, input.to) &&
      !A.contains(categories as ReadonlyArray<string>, input.file.category)
    )
  }
  return false
}
