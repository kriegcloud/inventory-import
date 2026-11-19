/**
 * The review of a file of inventory items: one pure function that turns the staged table, the column choices and the
 * person's decisions into rows that are ready, need a decision, cannot be imported as written, are left out or are
 * already there. The screen and the commit both call `review`, so the server can never write a row the screen
 * refused. The one thing a reader must not break: nothing here changes a value without saying so. A different reading
 * of a cell is in force only through a decision the person made or, with `ruleFixes` set to "apply", through a
 * form-only rule with one reading (spaces, capitals, a "$", yes for true), which is listed as a change, counted in
 * `fixed` and undone by one decision.
 *
 * Each rule is one kind of problem (`problemKinds`), one check (`fault`) and at most one proposal (`proposeFor`).
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import { Array as Arr, HashMap, HashSet, Option, Record as Rec, String as Str, Tuple } from "effect"
import { type FileProblem, fileProblem } from "./FileProblem.ts"
import {
  categories,
  costDigits,
  decimalUnits,
  type Dimensions,
  discontinuedOn,
  isActive,
  isoDate,
  type ItemFields,
  maxNameLength,
  readCount,
  readDate,
  readDecimal,
  readUnitCost,
  skuKey,
  skuPattern,
  stockingOf,
  unitsToDecimal,
  uoms,
  type Vendor
} from "./Item.ts"
import type { SpreadsheetTable } from "./Spreadsheet.ts"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { nullAsNone } from "@inventory/kernel/Wire"

/**
 * Whether the rules' form-only fixes (spaces round a SKU or a name, "bx" for BX, a "$" before a cost, yes for true,
 * a date written out, tags in capitals, a category in capitals) wait for the person ("propose") or arrive in force,
 * listed and undoable ("apply"). One line to switch: the review screen and the server both read it.
 */
export const ruleFixes: "propose" | "apply" = "apply"

/** The fields of an item, in the order the screens list them. */
export const fields = [
  "sku",
  "name",
  "description",
  "category",
  "uom",
  "unitCost",
  "quantityOnHand",
  "reorderPoint",
  "isActive",
  "lotTracked",
  "tags",
  "firstReceivedOn",
  "discontinuedOn",
  "dimensions",
  "vendors"
] as const

/** One field of an item that a file column can be matched to. */
export const Field = S.Literals(fields).annotate({
  description: "One field of an item that a file column can be matched to"
})
/** The decoded value of `Field`: one field of an item that a file column can be matched to. */
export type Field = typeof Field.Type

/** The words the screens use for each field. Every reason uses these, never the property name. */
export const fieldLabels: Record<Field, string> = {
  sku: "SKU",
  name: "Name",
  description: "Description",
  category: "Category",
  uom: "Unit of measure",
  unitCost: "Unit cost",
  quantityOnHand: "Quantity on hand",
  reorderPoint: "Reorder point",
  isActive: "Active",
  lotTracked: "Lot tracked",
  tags: "Tags",
  firstReceivedOn: "First received",
  discontinuedOn: "Discontinued on",
  dimensions: "Dimensions",
  vendors: "Vendors"
}

/** Fields an item must have. A file with no column for one of these cannot produce a ready row. */
export const requiredFields: ReadonlyArray<Field> = ["sku", "name", "category", "uom", "unitCost"]

const bounded = (max: number) => S.String.check(S.isMaxLength(max))

/** One cell as the reader found it: `text` with nothing coerced, and `shown` when Excel displays it differently. */
export const StagedCell = S.Struct({
  text: bounded(32767).annotateKey({ description: "The cell's value as text, nothing coerced", examples: ["120"] }),
  shown: S.optionalKey(bounded(32767)).annotateKey({
    description: "What Excel displays, when that differs from the value; left out otherwise"
  })
}).annotate({
  identifier: "StagedCell",
  description:
    "One cell as the reader found it: `text` with nothing coerced, and `shown` when Excel displays it differently"
})
/** The decoded value of `StagedCell`: one cell as the reader found it. */
export type StagedCell = typeof StagedCell.Type

/**
 * One data row of the file. `rowNumber` is the row the person sees in Excel: a row's identity, and, with its part,
 * the identity of each item the row holds (`rowId`). Never offset to tell a row's items apart.
 */
export const StagedRow = S.Struct({
  rowNumber: S.Int.annotateKey({ description: "The row number Excel shows, so 'row 56' on a screen is findable" }),
  cells: S.Array(StagedCell).annotateKey({ description: "The row's cells, in the order of the file's columns" })
}).annotate({ identifier: "StagedRow", description: "One data row of the file" })
/** The decoded value of `StagedRow`: one data row of the file. */
export type StagedRow = typeof StagedRow.Type

/** A column of the file: its position, Excel's letter and the heading as shown. */
export const StagedColumn = S.Struct({
  index: S.Int.annotateKey({ description: "The column's position in the file, from 0", examples: [3] }),
  letter: bounded(8).annotateKey({ description: "The column's letter in Excel: A, B, AA", examples: ["D"] }),
  label: bounded(32767).annotateKey({ description: "The heading as the file shows it", examples: ["Unit"] })
}).annotate({
  identifier: "StagedColumn",
  description: "A column of the file: its position, Excel's letter and the heading as shown"
})
/** The decoded value of `StagedColumn`: a column of the file. */
export type StagedColumn = typeof StagedColumn.Type

/** Something the reader did, skipped or noticed, as the sentence it wrote. */
export const StagedNote = S.Struct({
  kind: bounded(40).annotateKey({ description: "What kind of note it is, as the reader names it" }),
  level: S.Literals(["info", "warning"]).annotateKey({ description: "warning: something the person should look at" }),
  message: bounded(4000).annotateKey({ description: "The sentence the reader wrote" }),
  rows: S.Array(S.Int).annotateKey({
    description: "The rows of the file it is about, as Excel numbers them; empty when it is about the whole file"
  })
}).annotate({
  identifier: "StagedNote",
  description: "Something the reader did, skipped or noticed, as the sentence it wrote"
})
/** The decoded value of `StagedNote`: something the reader did, skipped or noticed, as the sentence it wrote. */
export type StagedNote = typeof StagedNote.Type

/**
 * An uploaded file as the server keeps it until the person confirms: the reader's table, trimmed to what the
 * review needs. Nothing in it is an item yet.
 */
export const StagedTable = S.Struct({
  fileName: bounded(255).annotateKey({ description: "The file's name as it was chosen", examples: ["items.csv"] }),
  kind: S.Literals(["csv", "xlsx"]).annotateKey({ description: "What kind of file it was read as" }),
  sheet: bounded(200).pipe(nullAsNone({ description: "The sheet the table came from; null for a CSV" })),
  headerRowNumber: S.Int.annotateKey({
    description: "The row the headings are on, as Excel numbers it",
    examples: [1]
  }),
  columns: S.Array(StagedColumn).annotateKey({ description: "The file's columns, in order" }),
  rows: S.Array(StagedRow).annotateKey({ description: "The data rows, in file order" }),
  notes: S.Array(StagedNote).annotateKey({ description: "What the reader did, skipped or noticed" })
}).annotate({
  identifier: "StagedTable",
  description:
    "An uploaded file as the server keeps it until the person confirms: the reader's table, trimmed to what the review needs"
})
/** The decoded value of `StagedTable`: an uploaded file as the server keeps it until the person confirms. */
export type StagedTable = typeof StagedTable.Type

const { rows: _rows, ...headFields } = StagedTable.fields

/**
 * A staged file without its rows: name, sheet, columns and the reader's notes. An upload sends it first and the rows
 * after it in chunks, and the server stores it beside the rows, so the rows never travel with it.
 */
export const StagedHead = S.Struct(headFields).annotate({
  identifier: "StagedHead",
  description: "A staged file without its rows: name, sheet, columns and the reader's notes"
})
/** The decoded value of `StagedHead`: a staged file without its rows. */
export type StagedHead = typeof StagedHead.Type

/**
 * Trims the reader's table to what the server stages. Nothing is coerced: each cell keeps its stored text, and
 * what Excel displays when that differs.
 */
export const stageTable = (input: { readonly table: SpreadsheetTable }): StagedTable => {
  const { table } = input
  return {
    fileName: table.fileName,
    kind: table.kind,
    sheet: table.format._tag === "xlsx" ? Option.some(table.format.chosen.name) : Option.none(),
    headerRowNumber: table.headerRowNumber,
    columns: Arr.map(table.columns, (column) => ({ index: column.index, letter: column.letter, label: column.label })),
    rows: Arr.map(table.rows, (row) => ({
      rowNumber: row.rowNumber,
      cells: Arr.map(row.cells, (cell) =>
        cell.shown === undefined || cell.shown === cell.text
          ? { text: cell.text }
          : { text: cell.text, shown: cell.shown }
      )
    })),
    notes: Arr.map(table.notes, (note) => ({
      kind: note.kind,
      level: note.level,
      message: note.message,
      rows: note.rows
    }))
  }
}

/**
 * The most rows one import stages. Past it the person is asked to split the file. Measured on a local D1
 * (`SCALE=50000 bun run test test/server/Scale.http.test.ts`): 50,000 rows stage in 6 to 16 s, review in 0.7 s
 * and confirm in about 11 s, in 200 statements of two bound values each. Larger files were not measured.
 */
export const maxStagedRows = 50000

/**
 * Why a file cannot be staged, as a `FileProblem` for the person, or null when it can. It takes counts, not rows, so
 * the reader asks before anything is sent, the server asks again when an upload begins (before any row arrives) and
 * once more when it finishes, and the words are the same wherever it is refused.
 *
 * @example stagingProblem({ fileName: "items.csv", rowCount: 50001, columnCount: 10 })?.problem
 * // '"items.csv" has 50001 rows. Up to 50000 can be imported at a time.'
 */
export const stagingProblem = (input: {
  readonly fileName: string
  readonly rowCount: number
  readonly columnCount: number
}): FileProblem | null => {
  const { fileName, rowCount, columnCount } = input
  if (rowCount <= 0) return fileProblem.noRows({ fileName })
  if (rowCount > maxStagedRows) return fileProblem.tooManyRows({ fileName, rows: rowCount, limit: maxStagedRows })
  if (columnCount > 200) return fileProblem.tooManyColumns({ fileName, columns: columnCount })
  return null
}

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

/** How sure a proposal's source is, in a word. Code sets it from the file's own rows. */
export const Confidence = S.Literals(["high", "medium", "low"]).annotate({
  description: "How sure a proposal's source is, in a word"
})
/** The decoded value of `Confidence`: how sure a proposal's source is, in a word. */
export type Confidence = typeof Confidence.Type

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

const suggestionId = S.String.pipe(S.annotateKey({ description: "The suggestion's id" }))
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
  rowId: bounded(40).pipe(
    S.annotateKey({ description: "The row it is for, as the review keys rows (`row-7`)", examples: ["row-7"] })
  ),
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
      readonly rowId: string
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
export const storedSuggestion = (input: { readonly id: string; readonly made: NewSuggestion }): Suggestion => {
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
  readonly id: string
  readonly kind: SuggestionKind
  readonly rowId: string
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
export const suggestionFromStored = (row: StoredSuggestionRow): Option.Option<Suggestion> => {
  const by =
    row.by === "model" && row.model !== null && row.model !== "" ? suggestedByModel(row.model) : suggestedByRule
  const said = { by, confidence: row.confidence, basis: row.basis }
  if (row.kind === "column") {
    return row.column === null
      ? Option.none()
      : Option.some(
          storedSuggestion({
            id: row.id,
            made: { kind: "column", field: row.field, column: row.column, heading: row.to, ...said }
          })
        )
  }
  return row.rowId === "" || row.rowNumber === null
    ? Option.none()
    : Option.some(
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
      Arr.contains(categories as ReadonlyArray<string>, input.to) &&
      !Arr.contains(categories as ReadonlyArray<string>, input.file.category)
    )
  }
  return false
}

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
export const rowId = (input: { readonly rowNumber: number; readonly part?: number | undefined }): string =>
  input.part === undefined || input.part === 0 ? `row-${input.rowNumber}` : `row-${input.rowNumber}.${input.part}`

/**
 * Where an item is, as a sentence names it after "row": the row's number, and the file's word for the item when
 * the row holds several. A row that is one item reads as it always did.
 *
 * @example
 * rowPlace({ rowNumber: 8 }) // "8"
 * rowPlace({ rowNumber: 8, label: "Feb" }) // "8 · Feb"
 */
export const rowPlace = (input: { readonly rowNumber: number; readonly label?: string | null | undefined }): string =>
  input.label === undefined || input.label === null || input.label === ""
    ? `${input.rowNumber}`
    : `${input.rowNumber} · ${input.label}`

/**
 * One item a row of the file holds: which of the row's items it is, the file's own word for it, and its values
 * by field. A row that is one item has part 0 and no label.
 */
export type RowItem = {
  /** 0 when the row is one item; 1, 2, ... for each of several, in the row's own order. */
  readonly part: number
  /** The value that tells the row's items apart, in the file's words ("Feb", a lot number); null for part 0. */
  readonly label: string | null
  /** The item's values by field, read from the row. */
  readonly file: Readonly<Record<Field, string>>
}

/**
 * How one row of the file becomes items: given the row as staged and its values by field as the columns read
 * them, the items it holds. A file with a quantity column per month, or a row that lists two lots, returns one
 * item per month or lot (parts 1, 2, ...). A row that holds none returns nothing and is still one entry, part 0,
 * with the reason its values give: never dropped.
 */
export type ItemsOfRow = (input: {
  readonly row: StagedRow
  readonly file: Readonly<Record<Field, string>>
}) => ReadonlyArray<RowItem>

/** The example's file: each row is one item. */
export const oneItemPerRow: ItemsOfRow = ({ file }) => [{ part: 0, label: null, file }]

/**
 * How this project's files turn rows into items. One line to change, like `ruleFixes`: the review screen and the
 * server both review with it (the server through `ItemsOfRow` in `src/server/ImportShape.ts`, which defaults to it).
 */
export const itemsOfRow: ItemsOfRow = oneItemPerRow

/**
 * The kinds of problem a row can have. The label is the tag on screen: one or two words, because every kind with
 * rows is a filter above the table and the screen has a budget of words. The full sentence is `Problem.message`.
 * `tone` is the kind's usual one; each problem carries its own (`Problem.tone`), since a SKU in lower case is a
 * decision and a SKU "ab-12" is a blocker.
 */
export const problemKinds = [
  { id: "missing", label: "Missing", tone: "blocker" },
  { id: "column", label: "No column", tone: "blocker" },
  { id: "stored", label: "SKU in use", tone: "blocker" },
  { id: "sku", label: "SKU", tone: "blocker" },
  { id: "name", label: "Name", tone: "blocker" },
  { id: "category", label: "Category", tone: "blocker" },
  { id: "uom", label: "Unit", tone: "blocker" },
  { id: "cost", label: "Cost", tone: "blocker" },
  { id: "number", label: "Number", tone: "blocker" },
  { id: "dimensions", label: "Dimensions", tone: "blocker" },
  { id: "vendors", label: "Vendors", tone: "blocker" },
  { id: "boolean", label: "True or false", tone: "decision" },
  { id: "date", label: "Date", tone: "decision" },
  { id: "discontinued", label: "Discontinued", tone: "decision" },
  { id: "tags", label: "Tags", tone: "decision" },
  { id: "spaces", label: "Spaces", tone: "decision" },
  { id: "changed", label: "Stored differs", tone: "decision" },
  { id: "clash", label: "SKU clash", tone: "decision" },
  { id: "duplicate", label: "Copy", tone: "decision" }
] as const
/** The id of one kind of problem (`problemKinds`): what a row's problem is filed under on the screen and in the API. */
export type ProblemKindId = (typeof problemKinds)[number]["id"]

/** A change to one cell that a rule proposes, with who proposes it, how sure it is and the evidence. */
export type Proposal = {
  readonly field: Field
  /** The kind of problem this change settles. */
  readonly kind: ProblemKindId
  readonly to: string
  /** Who proposes it: a fixed rule, or a language model whose suggestion the guard checked and stored. */
  readonly by: "rule" | "model"
  /**
   * The id of the stored suggestion behind it (`Suggestion.id`), when it came from one. Such a proposal is a guess
   * at a value the file does not hold: it never changes the row's outcome until the person accepts it.
   */
  readonly suggestionId?: string
  /**
   * True when the change is one of form only and has one reading: another way of writing the same value. Only these
   * are in force without the person (with `ruleFixes` "apply"), and only these are "safe" to take all at once.
   */
  readonly lossless: boolean
  /** high: form only, one reading. medium: a likely reading to accept or reject. low: a question, nothing preselected. */
  readonly confidence: Confidence
  /** One sentence of evidence, with counts from the file's rows. */
  readonly basis: string
  /** The other values the person may pick when the proposal is a question (`confidence` low). */
  readonly alternatives: ReadonlyArray<string>
  /**
   * Words for `to` and then each of `alternatives`, in that order, when the values do not speak for themselves
   * ("2024-04-06 (month first)", "Acme Industrial preferred"); empty when they do.
   */
  readonly labels: ReadonlyArray<string>
  /**
   * The field each pick writes, for `to` and then each of `alternatives`, in that order, when a question's readings
   * are not all values of `field`: a row discontinued yet active is settled by Active false or by an empty
   * Discontinued on. Empty when every pick is a value of `field`.
   */
  readonly targets: ReadonlyArray<Field>
  /** Changes of one kind share a group, so one accept can settle them all. */
  readonly group: string
}

/** Why a row is not ready, in words for the person. */
export type Problem = {
  readonly kind: ProblemKindId
  /** blocker: only a typed or chosen value settles it (Cannot import). decision: there is a proposal or a choice to take. */
  readonly tone: "blocker" | "decision"
  readonly field: Field | null
  /** A full sentence naming the column and the value: the reason in the not-imported file. */
  readonly message: string
  /** What the edit button says when typing is the only honest option. */
  readonly ask: string | null
  /** The values the field may take, when it is one of a list (a category, a unit, true or false); empty otherwise. */
  readonly choices: ReadonlyArray<string>
  /** A few words beside the tag ("also row 31"). */
  readonly note: string | null
  readonly proposal: Proposal | null
  /** The ids (`rowId`) of the other rows that share this row's SKU. */
  readonly rivals: ReadonlyArray<string>
}

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
  S.toTaggedUnion("how"),
  S.annotate({
    identifier: "Change",
    description: "One value that differs from the file, and how it came to stand"
  })
)
/** The decoded value of `Change`: one value that differs from the file, and how it came to stand. */
export type Change = typeof Change.Type

/** Where the new value came from: a rule, a model's suggestion, or the person. */
export const changeSource = (change: Change): ChangeSource =>
  change.how === "appliedByRule" ? "rule" : change.how === "acceptedProposal" ? change.source : "person"

/** Who put the value in force: the rule that applied it, or the person who accepted or typed it. */
export const changeDecidedBy = (change: Change): "rule" | "person" =>
  change.how === "appliedByRule" ? "rule" : "person"

/** What a proposal rested on; none for a value the person typed. */
export const changeBasis = (change: Change): Option.Option<string> =>
  change.how === "typed" ? Option.none() : Option.some(change.basis)

/** How sure a proposal's source was; none for a value the person typed. */
export const changeConfidence = (change: Change): Option.Option<Confidence> =>
  change.how === "typed" ? Option.none() : Option.some(change.confidence)

/** The words `importChange.how` has always held for each case, and the activity view shows where there is no basis. */
export const changeHowWords = {
  appliedByRule: "applied by a rule",
  acceptedProposal: "accepted a proposal",
  typed: "typed or chose a value"
} as const satisfies Record<ChangeHow, string>

/** A change as the columns of `importChange` store it. */
export type StoredChange = {
  readonly field: Field
  readonly from: string
  readonly to: string
  readonly source: ChangeSource
  readonly how: (typeof changeHowWords)[ChangeHow]
  readonly basis: string | null
  readonly confidence: Confidence | null
}

/**
 * The change the stored columns say. A row of an older build with no basis or confidence on a proposal reads with an
 * empty basis and low confidence, the least it can claim.
 */
export const changeFromStored = (stored: StoredChange): Change => {
  const core = { field: stored.field, from: stored.from, to: stored.to }
  const basis = stored.basis ?? ""
  const confidence = stored.confidence ?? "low"
  return stored.how === "typed or chose a value"
    ? TypedValue.make(core)
    : stored.how === "applied by a rule"
      ? AppliedByRule.make({ ...core, basis, confidence })
      : AcceptedProposal.make({ ...core, source: stored.source === "model" ? "model" : "rule", basis, confidence })
}

/** A change as `importChange`'s columns: the inverse of `changeFromStored`, with who put it in force. */
export const changeToStored = (change: Change): StoredChange & { readonly decidedBy: "rule" | "person" } => ({
  field: change.field,
  from: change.from,
  to: change.to,
  source: changeSource(change),
  decidedBy: changeDecidedBy(change),
  how: changeHowWords[change.how],
  basis: Option.getOrNull(changeBasis(change)),
  confidence: Option.getOrNull(changeConfidence(change))
})

/** A value a form-only rule wrote. */
export const appliedByRule = (change: Omit<AppliedByRule, "how" | "brand">): Change => AppliedByRule.make(change)
/** A proposal the person accepted. */
export const acceptedProposal = (change: Omit<AcceptedProposal, "how" | "brand">): Change =>
  AcceptedProposal.make(change)
/** A value the person typed or chose. */
export const typedChange = (change: Omit<TypedValue, "how" | "brand">): Change => TypedValue.make(change)

/** Where a row stands. The four counts add up to the rows of the file. `needs` splits into decision and cannot (`RowOutcome`). */
export type RowStatus = "ready" | "needs" | "out" | "already"

/**
 * The outcome of a row in the brief's words: Ready, Needs a decision (a proposal or a choice is open), Cannot import
 * (a value must be typed first), left out by the person, or already there. A row with both kinds of problem cannot
 * be imported: offering a fix beside a blocker does not change that.
 */
export type RowOutcome = "ready" | "decision" | "cannot" | "out" | "already"

/** One field where the stored item and the file's row say different things, each as the text a cell would hold. */
export type StoredDifference = { readonly field: Field; readonly stored: string; readonly file: string }

/** One item of the file as the review reads it: a row of the file, or one of the items a row holds. */
export type ReviewedRow = {
  /** Excel's number of the row it came from, never offset: two items of one row share it. */
  readonly rowNumber: number
  /** Which of its row's items it is, when the row holds several (1, 2, ...); absent for a row that is one item. */
  readonly part?: number
  /** The file's word for it among its row's items, when the row holds several. */
  readonly partLabel?: string
  /** `rowId` of its row and part: what decisions, rivals and outcomes are keyed on. */
  readonly id: string
  /** The file's text by field. */
  readonly file: Readonly<Record<Field, string>>
  /** The values after the rules' fixes and the person's decisions: what would be imported. */
  readonly values: Readonly<Record<Field, string>>
  /** Every proposal for this row, whether or not it is in force. */
  readonly proposals: ReadonlyArray<Proposal>
  /** What is still open, values that need a real decision first, then the form-only fixes. */
  readonly problems: ReadonlyArray<Problem>
  readonly status: RowStatus
  /** `status` with `needs` told apart: a decision to take, or a value to type. */
  readonly outcome: RowOutcome
  readonly kept: boolean
  /** Every value that differs from the file: applied by a rule, accepted or typed by the person. */
  readonly changes: ReadonlyArray<Change>
  /** The item this row becomes; null unless it is ready. */
  readonly item: ItemFields | null
  /** True when the row is ready and replaces a stored item with the same SKU, as the person chose. */
  readonly update: boolean
  /** Where the stored item with this SKU differs from the row; empty unless it is stored with other values. */
  readonly stored: ReadonlyArray<StoredDifference>
  /** Why it would not be imported, as its first problem says it; null when ready. */
  readonly reason: string | null
  /**
   * Every reason it would not be imported, one sentence per problem, the first being `reason`; empty when ready. A
   * row with two problems (two preferred vendors, and a SKU another row has) names both: the not-imported rows
   * store these joined, and the screen shows them all or says how many more there are.
   */
  readonly reasons: ReadonlyArray<string>
}

/** A quantity added up in one unit of measure: totals never add different units. */
export type UnitTotal = { readonly unit: string; readonly quantity: number }

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

/** The whole review of one file. */
export type Review = {
  readonly mapping: ReadonlyArray<ColumnMatch>
  /** The file's columns no field reads ("Internal Notes"), each with how many rows hold a value. Never stored. */
  readonly unusedColumns: ReadonlyArray<UnusedColumn>
  readonly rows: ReadonlyArray<ReviewedRow>
  /** Rows the file uses to add itself up. A check, never an item. */
  readonly totalRows: ReadonlyArray<number>
  readonly counts: {
    /** Items reviewed: one per row of the file. ready + needs + out + already add up to it. */
    readonly rows: number
    /** Rows of the file behind them, total rows not counted. */
    readonly fileRows: number
    readonly ready: number
    /** decision + cannot. */
    readonly needs: number
    /** Rows that wait for a proposal or a choice to be taken: Needs a decision. */
    readonly decision: number
    /** Rows that wait for a typed value: Cannot import. */
    readonly cannot: number
    readonly out: number
    readonly already: number
    /** Ready rows that replace a stored item, as the person chose; counted in `ready` too. */
    readonly updates: number
  }
  /**
   * What the form-only rules changed without the person ("fixed for you"): how many rows, and how many cells, among
   * the rows not left out and not already there. Each is listed in its row's `changes` with `how` "applied by a rule".
   */
  readonly fixed: { readonly rows: number; readonly cells: number }
  readonly sums: {
    /** Unit cost times quantity on hand over every row whose two values read, in US dollars as a decimal string. */
    readonly fileStockValue: string
    /** The same over the rows that would be imported. */
    readonly readyStockValue: string
    /** The quantities on hand of the rows that would be imported, one total per unit of measure. */
    readonly readyQuantities: ReadonlyArray<UnitTotal>
  }
}

/** Fields read from a cell's stored text, not from what Excel shows: a cost from the digits, a date cell as ISO. */
const storedTextFields: ReadonlyArray<Field> = ["unitCost", "firstReceivedOn", "discontinuedOn"]

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Maps and keeps the values that exist. Effect 4's `Arr.filterMap` takes a Result, not an Option. */
const keepSome = <A, B>(list: ReadonlyArray<A>, f: (a: A, index: number) => Option.Option<B>): Array<B> =>
  Arr.getSomes(Arr.map(list, f))

const headingKey = (heading: string): string => Str.toLowerCase(Str.replace(/[^a-z0-9]/gi, "")(heading))

/** The headings each field answers to, compared without case, spaces or punctuation ("Unit Cost ($)" is "unitcost"). */
export const headingWords: Record<Field, ReadonlyArray<string>> = {
  sku: ["sku", "code", "itemcode", "itemsku", "partnumber", "partno"],
  name: ["name", "itemname", "item", "title"],
  description: ["description", "desc", "details"],
  category: ["category", "cat", "itemcategory"],
  uom: ["uom", "unit", "unitofmeasure", "units"],
  unitCost: ["unitcost", "cost", "unitprice", "price"],
  quantityOnHand: ["quantityonhand", "qtyonhand", "quantity", "qty", "onhand", "stock"],
  reorderPoint: ["reorderpoint", "reorderpt", "reorder", "reorderlevel"],
  isActive: ["isactive", "active"],
  lotTracked: ["lottracked", "lottracking", "islottracked"],
  tags: ["tags", "tag", "labels"],
  firstReceivedOn: ["firstreceivedon", "firstreceived", "receivedon", "received"],
  discontinuedOn: ["discontinuedon", "discontinued"],
  dimensions: ["dimensions", "dimensionsjson", "dims", "size"],
  vendors: ["vendors", "vendorsjson", "vendor", "suppliers"]
}

/**
 * The text of a cell as the review reads it. A cost is read from the stored digits, so a cost Excel shows as
 * "$3.65" but stores as 3.6549 is held, not rounded, and a date cell from its stored date (ISO), whatever format
 * Excel shows it in. Everything else is what the person sees: a SKU stored as 123 with a five-digit format is
 * "00123". Spaces round a value are kept: trimming them is a proposal.
 */
const cellText = (field: Field, cell: StagedCell | undefined): string => {
  const text = cell === undefined ? "" : Arr.contains(storedTextFields, field) ? cell.text : (cell.shown ?? cell.text)
  // A cell holding only spaces is an empty cell: the screen then says "Empty" instead of showing nothing.
  return Str.trim(text) === "" ? "" : text
}

const shownText = (cell: StagedCell | undefined): string => (cell === undefined ? "" : (cell.shown ?? cell.text))

const isTotalText = (text: string): boolean => /^(grand\s+)?totals?:?$/i.test(Str.trim(text))

/**
 * The rows that add the file up: the ones the reader named, and any row with a cell that says only "Total", and of
 * those only the rows with no SKU. A row with a SKU is an item, whatever its name: an item called "Total" is counted.
 * `skuColumn` is the column the SKU is read from; with none, no row has a SKU.
 */
const totalRowNumbers = (table: StagedTable, skuColumn: number | null): ReadonlyArray<number> => {
  const noted = Arr.flatMap(table.notes, (note: StagedNote): ReadonlyArray<number> =>
    note.kind === "totalRow" ? note.rows : []
  )
  const noSku = (row: StagedRow): boolean => skuColumn === null || Str.trim(shownText(row.cells[skuColumn])) === ""
  return Arr.map(
    Arr.filter(
      table.rows,
      (row) =>
        noSku(row) &&
        (Arr.contains(noted, row.rowNumber) || Arr.some(row.cells, (cell) => isTotalText(shownText(cell))))
    ),
    (row) => row.rowNumber
  )
}

/**
 * Which file column fills which field. Headings are matched by name, ignoring case, spaces and punctuation; a
 * choice the person made overrides that. A field with no column stays empty and its rows say so, instead of the app
 * guessing from the data.
 */
export const matchColumns = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
}): ReadonlyArray<ColumnMatch> => {
  const { table } = input
  // A column a person gave to one field is not also matched to another by its heading.
  const taken = keepSome(input.choices, (choice) => Option.fromNullishOr(choice.column))
  const picked = Arr.map(fields, (field) => {
    const choice = Arr.findLast(input.choices, (candidate) => candidate.field === field)
    const byName = Arr.findFirst(
      table.columns,
      (column) => Arr.contains(headingWords[field], headingKey(column.label)) && !Arr.contains(taken, column.index)
    )
    const column = Option.isSome(choice)
      ? Option.flatMap(Option.fromNullishOr(choice.value.column), (index) =>
          Arr.findFirst(table.columns, (candidate) => candidate.index === index)
        )
      : byName
    const how = Option.isSome(choice)
      ? Option.isNone(column)
        ? ("none" as const)
        : choice.value.by
      : Option.isSome(byName)
        ? ("heading" as const)
        : ("none" as const)
    return { field, column, how }
  })
  // Which rows are totals depends on the SKU's column, so the columns are picked before the examples are read.
  const skuColumn = Option.getOrNull(
    Option.flatMap(
      Arr.findFirst(picked, (match) => match.field === "sku"),
      (match) => Option.map(match.column, (found) => found.index)
    )
  )
  const totals = totalRowNumbers(table, skuColumn)
  const itemRows = Arr.filter(table.rows, (row) => !Arr.contains(totals, row.rowNumber))
  const pick = (column: StagedColumn): ColumnPick => ({
    index: column.index,
    header: column.label,
    examples: Arr.take(
      Arr.dedupe(
        Arr.filter(
          Arr.map(itemRows, (row) => Str.trim(shownText(row.cells[column.index]))),
          (text) => text !== ""
        )
      ),
      3
    )
  })
  return Arr.map(picked, ({ field, column, how }): ColumnMatch => {
    const found = Option.map(column, pick)
    // A heading that named a column always has one; without it the field is simply not matched.
    return how === "person"
      ? MatchedByPerson.make({ field, column: found })
      : Option.match(found, {
          onNone: (): ColumnMatch => NotMatched.make({ field }),
          onSome: (chosen): ColumnMatch => MatchedByHeading.make({ field, column: chosen })
        })
  })
}

const isCategory = (text: string): boolean => Arr.contains(categories as ReadonlyArray<string>, text)
const isUom = (text: string): boolean => Arr.contains(uoms as ReadonlyArray<string>, text)

/** A category as people write it, reduced to the list's own form: lower case, hyphens for spaces and underscores. */
const categoryKey = (text: string): string => Str.replace(/[\s_]+/g, "-")(Str.toLowerCase(Str.trim(text)))
/** A category without its hyphens and its plural s, so "Finished Good" meets "finished-goods". */
const categoryStem = (text: string): string => Str.replace(/s$/, "")(Str.replaceAll("-", "")(categoryKey(text)))

const trueWords: ReadonlyArray<string> = ["true", "yes", "y", "1", "t"]
const falseWords: ReadonlyArray<string> = ["false", "no", "n", "0", "f"]

/** "true" or "false" for a word that can only mean one of them ("Yes", "Y", "1", "TRUE"), or none. */
const booleanWord = (text: string): Option.Option<"true" | "false"> => {
  const key = Str.toLowerCase(Str.trim(text))
  return Arr.contains(trueWords, key)
    ? Option.some("true" as const)
    : Arr.contains(falseWords, key)
      ? Option.some("false" as const)
      : Option.none()
}

/**
 * Tags as an item stores them, in one cell: split at "|", trimmed, lower case, each once, empty ones dropped.
 *
 * @example canonicalTags("Metal|metal| METAL") // "metal"
 */
export const canonicalTags = (text: string): string =>
  Arr.join(
    Arr.dedupe(
      Arr.filter(
        Arr.map(Str.split("|")(text), (tag) => Str.toLowerCase(Str.trim(tag))),
        (tag) => tag !== ""
      )
    ),
    "|"
  )

const tagsOf = (text: string): ReadonlyArray<string> => Arr.filter(Str.split("|")(text), (tag) => tag !== "")

// The dimensions cell as the file writes it: JSON with the brief's own keys. Each measurement may be missing here, so
// the review can say which one is, instead of only "not readable".
const DimensionsCell = S.fromJsonString(
  S.Struct({
    length: S.optionalKey(S.Finite),
    width: S.optionalKey(S.Finite),
    height: S.optionalKey(S.Finite),
    unit: S.optionalKey(S.String)
  })
)
const decodeDimensions = S.decodeUnknownOption(DimensionsCell)
const encodeDimensions = S.encodeOption(DimensionsCell)

// One vendor as the file writes it, in the brief's own keys. A cost is a JSON number there, or the same digits in
// quotes ("7.50"): both are read from the digits by `readDecimal`, so a quoted cost is not a cell "cut off".
const VendorCell = S.Struct({
  vendor_name: S.optionalKey(S.String),
  vendor_sku: S.String.pipe(S.NullOr, S.optionalKey),
  unit_cost: S.optionalKey(S.Union([S.Finite, S.String])),
  lead_time_days: S.Finite.pipe(S.NullOr, S.optionalKey),
  is_preferred: S.optionalKey(S.Boolean)
})
const VendorsCell = VendorCell.pipe(S.Array, S.fromJsonString)
const decodeVendors = S.decodeUnknownOption(VendorsCell)
const encodeVendors = S.encodeOption(VendorsCell)

/** A value of a cell that holds JSON: read, or the sentence that says what is wrong with it. */
type Read<A> = { readonly _tag: "ok"; readonly value: A } | { readonly _tag: "bad"; readonly message: string }
const ok = <A>(value: A): Read<A> => ({ _tag: "ok", value })
const bad = <A>(message: string): Read<A> => ({ _tag: "bad", message })

/**
 * The dimensions a cell holds: none for an empty cell, the three measurements and their unit, or what is wrong, in a
 * sentence that names the missing measurement.
 *
 * @example readDimensions('{"length":31.2,"width":41.4,"unit":"cm"}') // bad: "Dimensions has no height. ..."
 */
export const readDimensions = (text: string): Read<Dimensions | null> => {
  if (Str.trim(text) === "") return ok(null)
  const cell = decodeDimensions(text)
  if (Option.isNone(cell)) {
    return bad("Dimensions cannot be read: the cell is cut off or is not length, width, height and unit.")
  }
  const { length, width, height, unit } = cell.value
  const missing = Arr.getSomes([
    length === undefined ? Option.some("length") : Option.none(),
    width === undefined ? Option.some("width") : Option.none(),
    height === undefined ? Option.some("height") : Option.none()
  ])
  if (length === undefined || width === undefined || height === undefined) {
    return bad(`Dimensions has no ${Arr.join(missing, " and no ")}. Give all three measurements together, or none.`)
  }
  if (length <= 0 || width <= 0 || height <= 0) return bad("Dimensions has a measurement that is not above zero.")
  if (unit !== undefined && unit !== "cm" && unit !== "in")
    return bad(`Dimensions has the unit "${unit}", not cm or in.`)
  return ok({ length, width, height, unit: unit === "in" ? "in" : "cm" })
}

/**
 * The vendors a cell holds: none for an empty cell, up to three with a name and a cost each, or what is wrong, in a
 * sentence. More than one preferred vendor is read here and asked about by the review (`preferredCount`).
 */
export const readVendors = (text: string): Read<ReadonlyArray<Vendor>> => {
  if (Str.trim(text) === "") return ok([])
  const cell = decodeVendors(text)
  if (Option.isNone(cell)) return bad("Vendors cannot be read: the cell is cut off or is not a list of vendors.")
  if (cell.value.length > 3) return bad(`Vendors lists ${cell.value.length} vendors. An item has at most 3.`)
  const read = Arr.map(cell.value, (vendor, index): Read<Vendor> => {
    const place = `Vendor ${index + 1}`
    const name = Str.trim(vendor.vendor_name ?? "")
    if (name === "") return bad(`${place} has no name.`)
    if (vendor.unit_cost === undefined) return bad(`${place} (${name}) has no unit cost.`)
    const cost = readUnitCost(`${vendor.unit_cost}`)
    if (Option.isNone(cost)) {
      return bad(`${place} (${name}) has the unit cost ${vendor.unit_cost}, not 0 or more with up to 4 decimals.`)
    }
    const lead = vendor.lead_time_days ?? null
    if (lead !== null && (!Number.isInteger(lead) || lead < 0)) {
      return bad(`${place} (${name}) has the lead time ${lead}, not a whole number of days.`)
    }
    return ok({
      vendorName: name,
      vendorSku: Option.fromNullishOr(vendor.vendor_sku),
      unitCost: cost.value,
      leadTimeDays: Option.fromNullOr(lead),
      isPreferred: vendor.is_preferred === true
    })
  })
  const wrong = Arr.findFirst(read, (entry) => entry._tag === "bad")
  if (Option.isSome(wrong) && wrong.value._tag === "bad") return bad(wrong.value.message)
  return ok(Arr.flatMap(read, (entry) => (entry._tag === "ok" ? [entry.value] : [])))
}

const preferredOf = (vendors: ReadonlyArray<Vendor>): ReadonlyArray<Vendor> =>
  Arr.filter(vendors, (vendor) => vendor.isPreferred)

/** The vendors cell again with only the vendor at `keep` preferred: one reading of a cell that marks several. */
const withPreferred = (text: string, keep: number): Option.Option<string> =>
  Option.flatMap(decodeVendors(text), (cell) =>
    encodeVendors(Arr.map(cell, (vendor, index) => ({ ...vendor, is_preferred: index === keep })))
  )

/**
 * An item's values as the text a file's cells would hold, field by field: what a stored item is compared with a row
 * in, and shown beside it.
 *
 * @example itemText(item).tags // "fragile|imported"
 */
export const itemText = (item: ItemFields): Readonly<Record<Field, string>> => ({
  sku: item.sku,
  name: item.name,
  description: Option.getOrElse(item.description, () => ""),
  category: item.category,
  uom: item.uom,
  unitCost: costDigits(item.unitCost),
  quantityOnHand: `${item.quantityOnHand}`,
  reorderPoint: Option.match(item.reorderPoint, { onNone: () => "", onSome: (point) => `${point}` }),
  isActive: `${isActive(item.stocking)}`,
  lotTracked: `${item.lotTracked}`,
  tags: Arr.join(item.tags, "|"),
  firstReceivedOn: Option.getOrElse(item.firstReceivedOn, () => ""),
  discontinuedOn: Option.getOrElse(discontinuedOn(item.stocking), () => ""),
  dimensions: Option.getOrElse(Option.flatMap(item.dimensions, encodeDimensions), () => ""),
  vendors:
    item.vendors.length === 0
      ? ""
      : Option.getOrElse(
          encodeVendors(
            Arr.map(item.vendors, (vendor) => ({
              vendor_name: vendor.vendorName,
              ...Option.match(vendor.vendorSku, { onNone: () => ({}), onSome: (vendor_sku) => ({ vendor_sku }) }),
              unit_cost: Number(costDigits(vendor.unitCost)),
              ...Option.match(vendor.leadTimeDays, {
                onNone: () => ({}),
                onSome: (lead_time_days) => ({ lead_time_days })
              }),
              is_preferred: vendor.isPreferred
            }))
          ),
          () => ""
        )
})

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

const monthOf = (word: string): number => {
  const at = Arr.findFirstIndex(monthNames, (name) => Str.startsWith(name)(Str.toLowerCase(word)))
  return Option.isSome(at) && word.length >= 3 ? at.value + 1 : 0
}

const fullYear = (text: string): number => (text.length === 2 ? 2000 + Number(text) : Number(text))

/**
 * The readings of a date written another way than year-month-day: one for "4 Mar 2026", "Jun 19, 2024" or
 * "13/04/2026", two for "03/04/2026" (day first, then month first), none for text that is not a date. A two-digit
 * year is read as 20xx.
 *
 * @example dateReadings("13/04/2026") // { dayFirst: Some("2026-04-13"), monthFirst: None }
 * @example dateReadings("03/04/2026") // { dayFirst: Some("2026-04-03"), monthFirst: Some("2026-03-04") }
 */
export const dateReadings = (
  text: string
): { readonly dayFirst: Option.Option<string>; readonly monthFirst: Option.Option<string> } => {
  const trimmed = Str.trim(text)
  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/.exec(trimmed)
  if (numeric !== null) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    const year = fullYear(numeric[3] ?? "")
    return {
      dayFirst: isoDate({ year, month: b, day: a }),
      monthFirst: a === b ? Option.none() : isoDate({ year, month: a, day: b })
    }
  }
  const dayMonth = /^(\d{1,2})[\s-]+([a-z]+)\.?,?[\s-]+(\d{4})$/i.exec(trimmed)
  if (dayMonth !== null) {
    const day = isoDate({ year: Number(dayMonth[3]), month: monthOf(dayMonth[2] ?? ""), day: Number(dayMonth[1]) })
    return { dayFirst: day, monthFirst: Option.none() }
  }
  const monthDay = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(trimmed)
  if (monthDay !== null) {
    const day = isoDate({ year: Number(monthDay[3]), month: monthOf(monthDay[1] ?? ""), day: Number(monthDay[2]) })
    return { dayFirst: day, monthFirst: Option.none() }
  }
  return { dayFirst: Option.none(), monthFirst: Option.none() }
}

/** True for a date in numbers whose year has two digits ("13/04/98"): which century it means is a guess. */
const twoDigitYear = (text: string): boolean => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2}$/.test(Str.trim(text))

/** Digits grouped in thousands by commas, with a point for decimals: "1,250" or "12,000.5". */
const thousandsComma = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/
/** One comma between digits: "35,82" or "2,5". */
const decimalComma = /^\d+,\d+$/

type DateField = "firstReceivedOn" | "discontinuedOn"
const isDateField = (field: Field): field is DateField => field === "firstReceivedOn" || field === "discontinuedOn"
const isCountField = (field: Field): field is "quantityOnHand" | "reorderPoint" =>
  field === "quantityOnHand" || field === "reorderPoint"
const isBooleanField = (field: Field): field is "isActive" | "lotTracked" =>
  field === "isActive" || field === "lotTracked"

/**
 * What a typed value is stored as. A person who types "bx" means BX and one who types "yes" means true, so their own
 * typing is read through the same word lists; a value from the file is changed only through a proposal that says so.
 */
const canonical = (field: Field, text: string): string => {
  const trimmed = Str.trim(text)
  if (field === "description") return text
  if (field === "sku") return skuPattern.test(Str.toUpperCase(trimmed)) ? Str.toUpperCase(trimmed) : trimmed
  if (field === "uom") return isUom(Str.toUpperCase(trimmed)) ? Str.toUpperCase(trimmed) : trimmed
  if (field === "category") return isCategory(categoryKey(trimmed)) ? categoryKey(trimmed) : trimmed
  if (isBooleanField(field)) return Option.getOrElse(booleanWord(trimmed), () => trimmed)
  if (field === "tags") return canonicalTags(trimmed)
  return trimmed
}

/** True when the row says it is discontinued and active at once: a date that reads, and Active true or left empty. */
const discontinuedYetActive = (values: Readonly<Record<Field, string>>): boolean =>
  Option.isSome(readDate(values.discontinuedOn)) && (Str.trim(values.isActive) === "" || values.isActive === "true")

/**
 * The fixed rules' form-only reading of one cell that does not read as written, or none: spaces round a SKU or a
 * name, a listed unit or category in other capitals, a "$" before a cost, a word that can only mean true or false,
 * tags in capitals or repeated, a date written out with one reading. Each says the same thing in the form an item
 * stores, and has no second reading.
 *
 * @example ruleFor({ field: "uom", text: "bx" }) // Some({ to: "BX", rule: "the same unit in capitals" })
 */
export const ruleFor = (input: {
  readonly field: Field
  readonly text: string
}): Option.Option<{ readonly to: string; readonly rule: string }> => {
  const { field, text } = input
  const trimmed = Str.trim(text)
  if (trimmed === "") return Option.none()
  if (field === "sku") {
    return text !== trimmed && skuPattern.test(trimmed)
      ? Option.some({ to: trimmed, rule: "spaces around the value" })
      : Option.none()
  }
  if (field === "name") {
    return text !== trimmed && trimmed.length <= maxNameLength
      ? Option.some({ to: trimmed, rule: "spaces around the value" })
      : Option.none()
  }
  if (field === "uom") {
    const upper = Str.toUpperCase(trimmed)
    return !isUom(text) && isUom(upper) ? Option.some({ to: upper, rule: "the same unit in capitals" }) : Option.none()
  }
  if (field === "category") {
    const key = categoryKey(text)
    return !isCategory(text) && isCategory(key)
      ? Option.some({ to: key, rule: "the same category in the list's own form" })
      : Option.none()
  }
  if (field === "unitCost") {
    const bare = Str.trim(Str.replace(/^\$/, "")(trimmed))
    return Str.startsWith("$")(trimmed) && Option.isSome(readDecimal(bare))
      ? Option.some({ to: bare, rule: "the same amount without the $" })
      : Option.none()
  }
  if (isBooleanField(field)) {
    return text === "true" || text === "false"
      ? Option.none()
      : Option.map(booleanWord(text), (to) => ({ to, rule: `a usual way to write ${to}` }))
  }
  if (field === "tags") {
    const to = canonicalTags(text)
    return to !== text && to !== "" ? Option.some({ to, rule: "lower case, each tag once" }) : Option.none()
  }
  // A year written with two digits is a guess at the century: never a form-only fix, and never proposed at all.
  if (isDateField(field) && Option.isNone(readDate(text)) && !twoDigitYear(text)) {
    const { dayFirst, monthFirst } = dateReadings(text)
    if (Option.isSome(dayFirst) && Option.isNone(monthFirst)) {
      return Option.some({ to: dayFirst.value, rule: "the same date written year-month-day" })
    }
    if (Option.isNone(dayFirst) && Option.isSome(monthFirst)) {
      return Option.some({ to: monthFirst.value, rule: "the same date written year-month-day" })
    }
  }
  return Option.none()
}

/** One item of the file before any decision: where it is, and its values by field. */
type FileRow = {
  readonly rowNumber: number
  readonly part: number
  readonly label: string | null
  readonly id: string
  /** Its position among the file's items, so "the first one kept" follows the file's order. */
  readonly order: number
  readonly file: Readonly<Record<Field, string>>
}

/** What the review knows about the file before any decision: the items by field, and counts to quote as evidence. */
type Context = {
  readonly mapping: ReadonlyArray<ColumnMatch>
  readonly rows: ReadonlyArray<FileRow>
  /** Rows of the file the items come from, total rows not counted. */
  readonly fileRows: number
  /** The item the organization already has under this SKU key, if any. A hash lookup: a file can hold 50,000 rows. */
  readonly storedOf: (key: string) => Option.Option<ItemFields>
  /** How many rows have exactly this text in this field. */
  readonly countOf: (field: Field, text: string) => number
  /** How many rows have a value in this field at all. */
  readonly filledOf: (field: Field) => number
  /** How each date column's own rows settle "03/04": rows that can only be day first, and only month first. */
  readonly dateOrder: Readonly<Record<DateField, { readonly dayFirst: number; readonly monthFirst: number }>>
  /** How many costs write a point for decimals ("12.33"): evidence that a lone comma is a decimal one. */
  readonly pointCosts: number
  /** The stored suggestions for this import: each answers only where no rule does. */
  readonly suggestions: ReadonlyArray<Suggestion>
}

const makeContext = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly storedItems: ReadonlyArray<ItemFields>
  readonly itemsOf?: ItemsOfRow | undefined
  readonly suggestions?: ReadonlyArray<Suggestion> | undefined
}): Context & { readonly totals: ReadonlyArray<StagedRow>; readonly unusedColumns: ReadonlyArray<UnusedColumn> } => {
  const mapping = matchColumns(input)
  const columnOf = (field: Field): number | null =>
    Option.getOrNull(
      Option.map(
        Option.flatMap(
          Arr.findFirst(mapping, (match) => match.field === field),
          matchedColumn
        ),
        (column) => column.index
      )
    )
  const totalNumbers = totalRowNumbers(input.table, columnOf("sku"))
  const columns = Rec.fromEntries(Arr.map(fields, (field) => [field, columnOf(field)] as const))
  const read = (row: StagedRow): Readonly<Record<Field, string>> =>
    Rec.fromEntries(
      Arr.map(fields, (field) => {
        const column = columns[field]
        return [field, column === null || column === undefined ? "" : cellText(field, row.cells[column])] as const
      })
    ) as Record<Field, string>
  const itemsOf = input.itemsOf ?? itemsOfRow
  const fileRows = Arr.filter(input.table.rows, (row) => !Arr.contains(totalNumbers, row.rowNumber))
  // Each row of the file is behind at least one item: a row that holds none is one entry, part 0, never dropped.
  const parts = Arr.flatMap(fileRows, (row) => {
    const file = read(row)
    const found = itemsOf({ row, file })
    const held: ReadonlyArray<RowItem> = found.length > 0 ? found : [{ part: 0, label: null, file }]
    return Arr.map(held, (item) => ({ row, item }))
  })
  const rows = Arr.map(parts, ({ row, item }, order): FileRow => ({
    rowNumber: row.rowNumber,
    part: item.part,
    label: item.part === 0 ? null : item.label,
    id: rowId({ rowNumber: row.rowNumber, part: item.part }),
    order,
    file: item.file
  }))
  // Counted once per field and text, so evidence for 5,000 rows is not 5,000 passes over the file.
  const tallies = Rec.fromEntries(
    Arr.map(fields, (field) => [field, Arr.groupBy(rows, (row) => `v:${row.file[field]}`)] as const)
  )
  const countOf = (field: Field, text: string): number =>
    Option.getOrElse(
      Option.map(
        Option.flatMap(Rec.get(tallies, field), (tally) => Rec.get(tally, `v:${text}`)),
        (group) => group.length
      ),
      () => 0
    )
  const filledOf = (field: Field): number => rows.length - countOf(field, "")
  const orderOf = (field: DateField) => {
    // Only dates written in numbers say which comes first: "Jun 19, 2024" has one reading and settles nothing.
    const readings = Arr.map(
      Arr.filter(rows, (row) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(Str.trim(row.file[field]))),
      (row) => dateReadings(row.file[field])
    )
    return {
      dayFirst: Arr.filter(readings, (r) => Option.isSome(r.dayFirst) && Option.isNone(r.monthFirst)).length,
      monthFirst: Arr.filter(readings, (r) => Option.isNone(r.dayFirst) && Option.isSome(r.monthFirst)).length
    }
  }
  const used = keepSome(mapping, (match) => Option.map(matchedColumn(match), (column) => column.index))
  const stored = HashMap.fromIterable(Arr.map(input.storedItems, (item) => [skuKey(item), item] as const))
  return {
    mapping,
    rows,
    fileRows: fileRows.length,
    storedOf: (key) => HashMap.get(stored, key),
    countOf,
    filledOf,
    dateOrder: { firstReceivedOn: orderOf("firstReceivedOn"), discontinuedOn: orderOf("discontinuedOn") },
    pointCosts: Arr.filter(rows, (row) => /^\d+\.\d+$/.test(Str.trim(row.file.unitCost))).length,
    suggestions: input.suggestions ?? [],
    totals: Arr.filter(input.table.rows, (row) => Arr.contains(totalNumbers, row.rowNumber)),
    unusedColumns: Arr.map(
      Arr.filter(input.table.columns, (column) => !Arr.contains(used, column.index)),
      (column) => ({
        ...column,
        filled: Arr.filter(fileRows, (row) => Str.trim(shownText(row.cells[column.index])) !== "").length
      })
    )
  }
}

const quoted = (text: string): string => (text === "" ? "An empty cell" : `"${text}"`)

const proposal = (
  parts: Omit<Proposal, "by" | "alternatives" | "labels" | "targets"> & {
    readonly alternatives?: ReadonlyArray<string>
    readonly labels?: ReadonlyArray<string>
    readonly targets?: ReadonlyArray<Field>
  }
): Proposal => ({
  ...parts,
  by: "rule",
  alternatives: parts.alternatives ?? [],
  labels: parts.labels ?? [],
  targets: parts.targets ?? []
})

/** The kind a form-only fix is filed under, by its field. */
const ruleKind = (field: Field): ProblemKindId =>
  field === "sku" || field === "name"
    ? "spaces"
    : field === "uom"
      ? "uom"
      : field === "category"
        ? "category"
        : field === "unitCost"
          ? "cost"
          : field === "tags"
            ? "tags"
            : isBooleanField(field)
              ? "boolean"
              : "date"

/**
 * The one proposal for a field of a row, or none, read from the file's own values. Every `basis` is counted from the
 * file's rows. Confidence says what it is: high, a form-only fix with one reading (in force unless undone); medium, a
 * likely reading to accept or reject; low, a question with the other reading in `alternatives` and nothing
 * preselected, unless the column's own rows settle it, and then the whole column is one medium proposal.
 */
const proposeFor = (ctx: Context, row: FileRow, field: Field): Option.Option<Proposal> =>
  Option.orElse(proposeByRule(ctx, row, field), () => proposeStored(ctx, row, field))

/**
 * The stored suggestion for a field of a row as a proposal, where no rule answers: only for the exact cell it was
 * made for, and only while it still fits the row (`suggestionFits`). Never lossless, so it is in force only once
 * the person accepts it, and its group is the row's own, so one accept settles one row.
 */
const proposeStored = (ctx: Context, row: FileRow, field: Field): Option.Option<Proposal> =>
  Option.map(
    Arr.findLast(
      ctx.suggestions,
      // A row's suggestion for this very cell: a column's is offered beside the review, not on a row.
      (s): s is Exclude<Suggestion, { readonly kind: "column" }> =>
        s.kind !== "column" &&
        s.kind === field &&
        s.rowId === row.id &&
        s.from === row.file[field] &&
        suggestionFits({ kind: s.kind, to: s.to, file: row.file })
    ),
    (s): Proposal => ({
      field,
      kind: s.kind === "name" ? "missing" : "category",
      to: s.to,
      by: s.by.kind,
      suggestionId: s.id,
      lossless: false,
      confidence: s.confidence,
      basis: s.basis,
      alternatives: [],
      labels: [],
      targets: [],
      group: `${field}:suggested:${row.id}`
    })
  )

const proposeByRule = (ctx: Context, row: FileRow, field: Field): Option.Option<Proposal> => {
  const text = row.file[field]
  const trimmed = Str.trim(text)
  const label = fieldLabels[field]
  const rows = plural(ctx.countOf(field, text), "row", "rows")
  const rule = ruleFor({ field, text })
  if (Option.isSome(rule)) {
    const { to } = rule.value
    const others = plural(ctx.countOf(field, to), "row says", "rows say")
    const basis =
      field === "sku" || field === "name"
        ? `${quoted(text)} has spaces around it on ${rows}; the text itself is kept.`
        : isDateField(field)
          ? `${quoted(trimmed)} on ${rows} is ${to} written another way; it has no other reading.`
          : field === "tags"
            ? `${quoted(trimmed)} on ${rows} becomes "${to}": tags are lower case, each once.`
            : field === "unitCost"
              ? `${quoted(trimmed)} on ${rows} carries a "$"; costs are in US dollars already, and ${plural(ctx.pointCosts, "row writes", "rows write")} the digits alone.`
              : `${quoted(trimmed)} on ${rows}; ${others} ${to}.`
    return Option.some(
      proposal({
        field,
        kind: ruleKind(field),
        to,
        lossless: true,
        confidence: "high",
        basis,
        group: isDateField(field) || field === "tags" || field === "unitCost" ? `${field}:form` : `${field}:${to}:form`
      })
    )
  }
  if (trimmed === "" && field !== "isActive") return Option.none()
  if (field === "sku") {
    const upper = Str.toUpperCase(trimmed)
    if (!skuPattern.test(trimmed) && skuPattern.test(upper)) {
      const also = ctx.countOf("sku", upper)
      return Option.some(
        proposal({
          field,
          kind: "sku",
          to: upper,
          lossless: false,
          confidence: "medium",
          basis: `"${trimmed}" is ${upper} in capitals, the form a SKU has${also > 0 ? `; ${plural(also, "other row already has", "other rows already have")} ${upper}, so the two would then share it` : ""}.`,
          group: "sku:capitals"
        })
      )
    }
  }
  if (field === "category" && !isCategory(text)) {
    const near = Arr.findFirst(categories, (category) => categoryStem(category) === categoryStem(text))
    if (Option.isSome(near)) {
      return Option.some(
        proposal({
          field,
          kind: "category",
          to: near.value,
          lossless: false,
          confidence: "medium",
          basis: `"${trimmed}" on ${rows} is close to ${near.value}, one of the ${categories.length} categories; ${plural(ctx.countOf(field, near.value), "row says", "rows say")} ${near.value}.`,
          group: `category:${near.value}:near`
        })
      )
    }
  }
  if (field === "unitCost" && Option.isNone(readDecimal(text))) {
    const bare = Str.trim(Str.replace(/^\$/, "")(trimmed))
    if (thousandsComma.test(bare)) {
      const digits = Str.replaceAll(",", "")(bare)
      const asDecimal = Str.replace(",", ".")(bare)
      const once = Str.split(",")(bare).length === 2 && !Str.includes(".")(bare)
      if (once && Option.isSome(readDecimal(asDecimal))) {
        return Option.some(
          proposal({
            field,
            kind: "cost",
            to: digits,
            lossless: false,
            confidence: "low",
            basis: `"${trimmed}" is ${digits} with a comma between thousands or ${asDecimal} with a decimal comma; the file does not say which.`,
            alternatives: [asDecimal],
            group: `unitCost:ask:${trimmed}`
          })
        )
      }
      if (Option.isSome(readDecimal(digits))) {
        return Option.some(
          proposal({
            field,
            kind: "cost",
            to: digits,
            lossless: false,
            confidence: "medium",
            basis: `"${trimmed}" reads as ${digits} with a comma between thousands.`,
            group: "unitCost:thousands"
          })
        )
      }
    }
    if (decimalComma.test(bare)) {
      const asDecimal = Str.replace(",", ".")(bare)
      if (Option.isSome(readDecimal(asDecimal))) {
        return Option.some(
          proposal({
            field,
            kind: "cost",
            to: asDecimal,
            lossless: false,
            confidence: "medium",
            basis: `"${trimmed}" reads as ${asDecimal} with a decimal comma: a comma between thousands is followed by three digits. ${plural(ctx.pointCosts, "cost", "costs")} of ${ctx.filledOf(field)} in this file write a point.`,
            group: "unitCost:decimal-comma"
          })
        )
      }
    }
  }
  if (isCountField(field) && /^\d{1,3}(?:,\d{3})+$/.test(trimmed)) {
    const digits = Str.replaceAll(",", "")(trimmed)
    return Option.some(
      proposal({
        field,
        kind: "number",
        to: digits,
        lossless: false,
        confidence: "medium",
        basis: `"${trimmed}" on ${rows} reads as ${digits} with a comma between thousands: ${Str.toLowerCase(label)} is a whole number, so the comma is not a decimal one.`,
        group: `${field}:thousands`
      })
    )
  }
  if (isBooleanField(field) && trimmed !== "" && text !== "true" && text !== "false") {
    return Option.some(
      proposal({
        field,
        kind: "boolean",
        to: "true",
        lossless: false,
        confidence: "low",
        basis: `"${trimmed}" on ${rows} is neither true nor false; ${plural(ctx.countOf(field, "true"), "row says", "rows say")} true and ${ctx.countOf(field, "false")} false. Only you know which this is.`,
        alternatives: ["false"],
        group: `${field}:ask:${trimmed}`
      })
    )
  }
  if (isDateField(field) && trimmed !== "" && Option.isNone(readDate(text))) {
    const { dayFirst, monthFirst } = dateReadings(text)
    // A year written with two digits is never proposed: which century it means is the person's to say.
    if (twoDigitYear(text)) return Option.none()
    if (Option.isSome(dayFirst) && Option.isSome(monthFirst)) {
      const { dayFirst: byDay, monthFirst: byMonth } = ctx.dateOrder[field]
      // The column's own rows settle the order only when they all point one way.
      if (byDay > 0 && byMonth === 0) {
        return Option.some(
          proposal({
            field,
            kind: "date",
            to: dayFirst.value,
            lossless: false,
            confidence: "medium",
            basis: `${plural(byDay, "date in this column can", "dates in this column can")} only be day first (as 13/04), and none can only be month first.`,
            group: `${field}:day-first`
          })
        )
      }
      if (byMonth > 0 && byDay === 0) {
        return Option.some(
          proposal({
            field,
            kind: "date",
            to: monthFirst.value,
            lossless: false,
            confidence: "medium",
            basis: `${plural(byMonth, "date in this column can", "dates in this column can")} only be month first (as 04/13), and none can only be day first.`,
            group: `${field}:month-first`
          })
        )
      }
      return Option.some(
        proposal({
          field,
          kind: "date",
          to: monthFirst.value,
          lossless: false,
          confidence: "low",
          basis: `"${trimmed}" is ${monthFirst.value} with the month first or ${dayFirst.value} with the day first, and no other date in this column says which.`,
          alternatives: [dayFirst.value],
          labels: [`${monthFirst.value} (month first)`, `${dayFirst.value} (day first)`],
          group: `${field}:ask:${trimmed}`
        })
      )
    }
  }
  // Discontinued and active at once: one question on the row, asked on Active, with two ways out and neither taken
  // for the person. The second reading is a value of another cell (an empty Discontinued on), so `targets` names it.
  if (field === "isActive" && discontinuedYetActive(row.file)) {
    const date = Str.trim(row.file.discontinuedOn)
    return Option.some(
      proposal({
        field,
        kind: "discontinued",
        to: "false",
        lossless: false,
        confidence: "low",
        basis: `The row is discontinued on ${date} and ${trimmed === "" ? "says nothing about Active, which means true" : "active"}; a discontinued item is not active. Either it is not active, or it has no discontinued date.`,
        alternatives: [""],
        labels: ["Not active", "No discontinued date"],
        targets: ["isActive", "discontinuedOn"],
        group: `discontinued:ask:${row.id}`
      })
    )
  }
  if (field === "vendors") {
    const read = readVendors(text)
    if (read._tag === "ok") {
      const preferred = preferredOf(read.value)
      if (preferred.length > 1) {
        const picks = keepSome(read.value, (vendor, index) =>
          vendor.isPreferred
            ? Option.map(withPreferred(text, index), (to) => ({ to, label: `${vendor.vendorName} preferred` }))
            : Option.none()
        )
        const head = picks[0]
        if (head !== undefined) {
          return Option.some(
            proposal({
              field,
              kind: "vendors",
              to: head.to,
              lossless: false,
              confidence: "low",
              basis: `${preferred.length} vendors are marked preferred (${Arr.join(
                Arr.map(preferred, (vendor) => vendor.vendorName),
                ", "
              )}); an item has at most one.`,
              alternatives: Arr.map(Arr.drop(picks, 1), (pick) => pick.to),
              labels: Arr.map(picks, (pick) => pick.label),
              group: `vendors:preferred:${row.id}`
            })
          )
        }
      }
    }
  }
  return Option.none()
}

type Wrong = {
  readonly kind: ProblemKindId
  readonly message: string
  readonly ask: string | null
  readonly choices?: ReadonlyArray<string>
}

/** What is wrong with one value of a row, with no proposal attached yet. Undefined when it reads as an item stores it. */
const fault = (ctx: Context, field: Field, values: Readonly<Record<Field, string>>): Wrong | undefined => {
  const text = values[field]
  const label = fieldLabels[field]
  const lower = Str.toLowerCase(label)
  // What the edit button names: "SKU" keeps its capitals.
  const asked = field === "sku" ? label : lower
  const hasColumn = Arr.some(ctx.mapping, (match) => match.field === field && Option.isSome(matchedColumn(match)))
  const empty = Str.trim(text) === ""
  const required = Arr.contains(requiredFields, field)
  if (!hasColumn && required && empty) {
    return { kind: "column", message: `The file has no column for ${label}.`, ask: `Type the ${asked}` }
  }
  if (empty && required) return { kind: "missing", message: `${label} is empty.`, ask: `Type the ${asked}` }
  // One problem for the row, filed on Active: the two cells contradict each other, and that is one question.
  if (field === "isActive" && (empty || text === "true") && discontinuedYetActive(values)) {
    return {
      kind: "discontinued",
      message: `Discontinued on ${Str.trim(values.discontinuedOn)}, yet Active is ${empty ? "empty, which means true" : "true"}. A discontinued item is not active.`,
      ask: "Choose not active",
      choices: ["true", "false"]
    }
  }
  if (empty) return undefined
  if (field === "sku") {
    if (skuPattern.test(text)) return undefined
    return text !== Str.trim(text) && skuPattern.test(Str.trim(text))
      ? { kind: "spaces", message: `SKU "${text}" has spaces around it.`, ask: null }
      : {
          kind: "sku",
          message: `SKU "${Str.trim(text)}" is not three capital letters, a hyphen and four digits, like BLT-0042.`,
          ask: "Type the SKU"
        }
  }
  if (field === "name") {
    if (text !== Str.trim(text)) return { kind: "spaces", message: `Name "${text}" has spaces around it.`, ask: null }
    return text.length > maxNameLength
      ? {
          kind: "name",
          message: `Name is ${text.length} characters long. A name has at most ${maxNameLength}.`,
          ask: "Shorten the name"
        }
      : undefined
  }
  if (field === "category") {
    return isCategory(text)
      ? undefined
      : {
          kind: "category",
          message: `Category "${text}" is not one of the ${categories.length} categories.`,
          ask: "Pick a category",
          choices: categories
        }
  }
  if (field === "uom") {
    return isUom(text)
      ? undefined
      : {
          kind: "uom",
          message: `Unit of measure "${text}" is not one of ${Arr.join(uoms, ", ")}.`,
          ask: "Pick a unit",
          choices: uoms
        }
  }
  if (field === "unitCost") {
    if (Option.isSome(readDecimal(text))) return undefined
    const shown = Str.trim(text)
    return {
      kind: "cost",
      message: /^-\s*\$?[\d.,]+$/.test(shown)
        ? `Unit cost "${shown}" is below zero. A cost is 0 or more.`
        : /^\$?\d+\.\d{5,}$/.test(shown)
          ? `Unit cost "${shown}" has more than 4 decimals.`
          : `Unit cost "${shown}" is not an amount in dollars written as digits.`,
      ask: "Type the unit cost"
    }
  }
  if (isCountField(field)) {
    if (Option.isSome(readCount(text))) return undefined
    const shown = Str.trim(text)
    return {
      kind: "number",
      message: /^\d+\.\d+$/.test(shown)
        ? `${label} "${shown}" is not a whole number.`
        : /^-\d/.test(shown)
          ? `${label} "${shown}" is below zero.`
          : `${label} "${shown}" is not a whole number written as digits.`,
      ask: `Type the ${lower}`
    }
  }
  if (isBooleanField(field)) {
    return text === "true" || text === "false"
      ? undefined
      : {
          kind: "boolean",
          message: `${label} "${Str.trim(text)}" is not true or false.`,
          ask: "Choose true or false",
          choices: ["true", "false"]
        }
  }
  if (field === "tags") {
    // A cell of separators only ("|") holds no tag: it is empty, not badly written.
    return canonicalTags(text) === text || canonicalTags(text) === ""
      ? undefined
      : { kind: "tags", message: `Tags "${text}" are not lower case, each once.`, ask: "Type the tags" }
  }
  if (isDateField(field)) {
    return Option.isSome(readDate(text))
      ? undefined
      : {
          kind: "date",
          message: /^\d{4}-\d{2}-\d{2}$/.test(Str.trim(text))
            ? `${label} "${Str.trim(text)}" is not a day on the calendar.`
            : twoDigitYear(text)
              ? `${label} “${Str.trim(text)}” has a two-digit year; type it as year-month-day.`
              : `${label} "${Str.trim(text)}" is not written as year-month-day.`,
          ask: "Type the date"
        }
  }
  if (field === "dimensions") {
    const read = readDimensions(text)
    return read._tag === "ok"
      ? undefined
      : { kind: "dimensions", message: read.message, ask: "Correct the dimensions, or clear them" }
  }
  if (field === "vendors") {
    const read = readVendors(text)
    if (read._tag === "bad") {
      return { kind: "vendors", message: read.message, ask: "Correct the vendors, or clear them" }
    }
    const preferred = preferredOf(read.value)
    return preferred.length > 1
      ? {
          kind: "vendors",
          message: `${preferred.length} vendors are marked preferred (${Arr.join(
            Arr.map(preferred, (vendor) => vendor.vendorName),
            ", "
          )}). An item has at most one.`,
          ask: "Choose the preferred vendor"
        }
      : undefined
  }
  return undefined
}

const emptyDecision: RowDecision = decisionOf()

/** Whether a proposal is in force for a row: the person accepted it, or it is a form-only rule fix nobody undid. */
const inForce = (proposed: Proposal, decision: RowDecision): boolean =>
  Arr.contains(decision.accepted, proposed.field) ||
  (proposed.lossless && !Arr.contains(decision.reverted, proposed.field))

const typedValue = (decision: RowDecision, field: Field): Option.Option<string> => Rec.get(decision.edits, field)

type Rival = { readonly id: string; readonly place: string; readonly same: boolean }

const sameValues = (a: Readonly<Record<Field, string>>, b: Readonly<Record<Field, string>>): boolean =>
  Arr.every(fields, (field) => Str.trim(a[field]) === Str.trim(b[field]))

/** Kinds that are a choice between things the screen already shows, even with no proposal attached. */
const choiceKinds: ReadonlyArray<ProblemKindId> = ["clash", "duplicate", "changed", "discontinued"]

// A stored suggestion beside a blocker does not change the row's outcome: a name nobody typed is still missing, and
// the row is counted under Cannot import with the suggestion offered beside it, until the person accepts it.
const toneOf = (kind: ProblemKindId, proposed: Proposal | null): "blocker" | "decision" =>
  (proposed !== null && proposed.suggestionId === undefined) || Arr.contains(choiceKinds, kind) ? "decision" : "blocker"

/**
 * The problems of one row given the values it would be imported with. A value that still reads as the file has it
 * carries its proposal; a value the person typed does not. Values only the person can give come first, then the
 * choices (a stored item that differs, a repeated SKU), the form-only fixes last, so the screen asks for the thing
 * only the person knows before the one-click ones.
 */
const problemsOf = (
  ctx: Context,
  row: FileRow,
  values: Readonly<Record<Field, string>>,
  rivals: ReadonlyArray<Rival>,
  changed: Problem | null
): ReadonlyArray<Problem> => {
  const found = keepSome(fields, (field): Option.Option<Problem> => {
    const wrong = fault(ctx, field, values)
    if (wrong === undefined) return Option.none()
    const proposed =
      values[field] === row.file[field]
        ? Option.getOrNull(Option.filter(proposeFor(ctx, row, field), (p) => p.kind === wrong.kind))
        : null
    return Option.some({
      kind: wrong.kind,
      tone: toneOf(wrong.kind, proposed),
      field,
      message: wrong.message,
      ask: wrong.ask,
      choices: wrong.choices ?? [],
      note: null,
      proposal: proposed,
      rivals: []
    })
  })
  const key = skuKey({ sku: values.sku })
  const taken: ReadonlyArray<Problem> =
    key !== "" && Option.isSome(ctx.storedOf(key)) && skuKey({ sku: row.file.sku }) !== key
      ? [
          {
            kind: "stored",
            tone: "blocker",
            field: "sku",
            message: `SKU ${Str.trim(values.sku)} is already there: an item your organization has uses it.`,
            ask: "Type another SKU",
            choices: [],
            note: null,
            proposal: null,
            rivals: []
          }
        ]
      : []
  const ids = Arr.map(rivals, (rival) => rival.id)
  const where = Arr.join(
    Arr.map(rivals, (rival) => rival.place),
    ", "
  )
  // Rows that agree in every field are copies; rows that share only the SKU are two items clashing over it.
  const copies = Arr.every(rivals, (rival) => rival.same)
  const twice: ReadonlyArray<Problem> =
    rivals.length === 0
      ? []
      : [
          {
            kind: copies ? "duplicate" : "clash",
            tone: "decision",
            field: "sku",
            message: copies
              ? `This row is a copy of row ${where}.`
              : `SKU ${Str.toUpperCase(Str.trim(values.sku))} is also on row ${where} with different values. Keep one row, or leave one out.`,
            ask: "Type another SKU",
            choices: [],
            note: `${copies ? "copy of" : "also"} row ${where}`,
            proposal: null,
            rivals: ids
          }
        ]
  const safe = (problem: Problem): boolean => problem.proposal !== null && problem.proposal.lossless
  return [
    ...Arr.filter(found, (p) => !safe(p)),
    ...taken,
    ...(changed === null ? [] : [changed]),
    ...twice,
    ...Arr.filter(found, safe)
  ]
}

/**
 * The item a row's values make, or null when one of them does not read. Empty optional cells take the brief's
 * defaults: quantity on hand 0, active true, lot tracked false.
 */
const toItem = (values: Readonly<Record<Field, string>>): ItemFields | null => {
  const blank = (field: Field): boolean => Str.trim(values[field]) === ""
  const category = Arr.findFirst(categories, (candidate) => candidate === values.category)
  const uom = Arr.findFirst(uoms, (candidate) => candidate === values.uom)
  const cost = readUnitCost(values.unitCost)
  const quantity = blank("quantityOnHand") ? Option.some(0) : readCount(values.quantityOnHand)
  const reorder = blank("reorderPoint") ? Option.some(null) : readCount(values.reorderPoint)
  const flag = (field: "isActive" | "lotTracked", byDefault: boolean): Option.Option<boolean> =>
    blank(field)
      ? Option.some(byDefault)
      : values[field] === "true"
        ? Option.some(true)
        : values[field] === "false"
          ? Option.some(false)
          : Option.none()
  const active = flag("isActive", true)
  const lot = flag("lotTracked", false)
  const date = (field: DateField): Option.Option<string | null> =>
    blank(field) ? Option.some(null) : readDate(values[field])
  const received = date("firstReceivedOn")
  const discontinued = date("discontinuedOn")
  const dimensions = readDimensions(values.dimensions)
  const vendors = readVendors(values.vendors)
  if (
    !skuPattern.test(values.sku) ||
    values.name === "" ||
    values.name !== Str.trim(values.name) ||
    values.name.length > maxNameLength ||
    Option.isNone(category) ||
    Option.isNone(uom) ||
    Option.isNone(cost) ||
    Option.isNone(quantity) ||
    Option.isNone(reorder) ||
    Option.isNone(active) ||
    Option.isNone(lot) ||
    Option.isNone(received) ||
    Option.isNone(discontinued) ||
    dimensions._tag === "bad" ||
    vendors._tag === "bad" ||
    preferredOf(vendors.value).length > 1 ||
    (canonicalTags(values.tags) !== values.tags && canonicalTags(values.tags) !== "") ||
    (discontinued.value !== null && active.value)
  ) {
    return null
  }
  return {
    sku: values.sku,
    name: values.name,
    description: blank("description") ? Option.none() : Option.some(values.description),
    category: category.value,
    uom: uom.value,
    unitCost: cost.value,
    quantityOnHand: quantity.value,
    reorderPoint: Option.fromNullOr(reorder.value),
    stocking: stockingOf({ isActive: active.value, discontinuedOn: Option.fromNullOr(discontinued.value) }),
    lotTracked: lot.value,
    tags: tagsOf(values.tags),
    firstReceivedOn: Option.fromNullOr(received.value),
    dimensions: Option.fromNullOr(dimensions.value),
    vendors: vendors.value
  }
}

/** Where a stored item and the file's row differ, field by field, as cell text. */
const differences = (stored: ItemFields, item: ItemFields): ReadonlyArray<StoredDifference> => {
  const was = itemText(stored)
  const now = itemText(item)
  return keepSome(fields, (field) =>
    was[field] === now[field] ? Option.none() : Option.some({ field, stored: was[field], file: now[field] })
  )
}

/** Unit cost times quantity on hand over the rows where both read, in ten-thousandths of a dollar. */
const stockValue = (rows: ReadonlyArray<ReviewedRow>): string =>
  unitsToDecimal(
    Arr.reduce(rows, 0n, (total, row) => {
      const cost = readUnitCost(row.values.unitCost)
      const quantity =
        Str.trim(row.values.quantityOnHand) === "" ? Option.some(0) : readCount(row.values.quantityOnHand)
      return Option.isSome(cost) && Option.isSome(quantity)
        ? total + decimalUnits(cost.value) * BigInt(quantity.value)
        : total
    })
  )

/**
 * Reviews the file. Every row lands in exactly one of four places and the counts add up to the rows. A row is ready
 * only when every value reads exactly as an item stores it, through the file's own text, a form-only rule fix nobody
 * undid, or a decision the person made. Two rows with one SKU are both held until the person keeps one. A row whose
 * SKU is stored is already there when it says what is stored; when it says something else it waits for the person to
 * keep the stored item or replace it, and nothing stored changes without that.
 */
export const review = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly decisions: SavedDecisions
  /** The organization's items that share a SKU with a row of the file (or with a SKU the person typed). */
  readonly storedItems: ReadonlyArray<ItemFields>
  /**
   * The ids (`rowId`) of rows an earlier confirm of this same import created. They are already there, whatever
   * their SKU.
   */
  readonly createdIds?: ReadonlyArray<string>
  /** How a row becomes items; `itemsOfRow` when not given. */
  readonly itemsOf?: ItemsOfRow
  /**
   * The import's stored suggestions (`ImportView.suggestions`). Each becomes a proposal on its row that waits for
   * the person; the screen and the server pass the same list, so both see the same proposals.
   */
  readonly suggestions?: ReadonlyArray<Suggestion>
}): Review => {
  const ctx = makeContext(input)
  const created = HashSet.fromIterable(input.createdIds ?? [])
  const decisionOf = (row: FileRow): RowDecision =>
    Option.getOrElse(Rec.get(input.decisions, rowId(row)), () => emptyDecision)

  const first = Arr.map(ctx.rows, (row) => {
    const decision = decisionOf(row)
    const proposals = keepSome(fields, (field) => proposeFor(ctx, row, field))
    const changes: Array<Change> = []
    const values = Rec.fromEntries(
      Arr.map(fields, (field) => {
        const typed = typedValue(decision, field)
        const proposed = Arr.findFirst(proposals, (p) => p.field === field)
        const text = row.file[field]
        if (Option.isSome(typed)) {
          const to = canonical(field, typed.value)
          if (to !== text) {
            changes.push(typedChange({ field, from: text, to }))
          }
          return [field, to] as const
        }
        if (Option.isSome(proposed) && inForce(proposed.value, decision)) {
          const p = proposed.value
          const accepted = Arr.contains(decision.accepted, field)
          const proposal = { field, from: text, to: p.to, basis: p.basis, confidence: p.confidence }
          // In force without an accept only when it is a form-only rule's fix: `inForce` says so.
          changes.push(accepted ? acceptedProposal({ ...proposal, source: p.by }) : appliedByRule(proposal))
          return [field, p.to] as const
        }
        return [field, text] as const
      })
    ) as Record<Field, string>
    const key = skuKey({ sku: values.sku })
    const mine = HashSet.has(created, row.id)
    // The file's own SKU is stored. Compared by key, so a SKU whose spaces were trimmed is still the file's SKU.
    const storedItem =
      !mine && key !== "" && skuKey({ sku: row.file.sku }) === key ? ctx.storedOf(key) : Option.none<ItemFields>()
    const item = toItem(values)
    // It differs only when the row reads as an item and that item says something else than what is stored. A row
    // that does not read yet is not compared and is not "already there": it keeps its own problems, and once it
    // reads it is skipped (it says what is stored) or asks (it says something else).
    const stored = Option.isSome(storedItem) && item !== null ? differences(storedItem.value, item) : []
    const differs = stored.length > 0
    const replace = differs && decision.stored.kind === "replace"
    const already =
      mine || (Option.isSome(storedItem) && item !== null && (!differs || decision.stored.kind === "keep"))
    return {
      row,
      decision,
      proposals,
      values,
      changes,
      key,
      item,
      stored,
      differs,
      replace,
      already,
      mine,
      keptStored: differs && decision.stored.kind === "keep",
      out: isLeftOut(decision)
    }
  })

  // One item per SKU: rows that share a key are rivals, whatever the person has done to them so far.
  const groups = Arr.groupBy(
    Arr.filter(first, (entry) => entry.key !== "" && !entry.already),
    (entry) => `sku:${entry.key}`
  )
  const rows = Arr.map(first, (entry): ReviewedRow => {
    const twins = Arr.filter(
      Option.getOrElse(Rec.get(groups, `sku:${entry.key}`), () => []),
      (other) => other.row.id !== entry.row.id
    )
    const live = Arr.filter(twins, (other) => !other.out)
    // Kept wins over a twin still in the file only for the first row the person kept.
    const keptFirst =
      hasKeep(entry.decision) &&
      !Arr.some(live, (other) => hasKeep(other.decision) && other.row.order < entry.row.order)
    const sku = Str.trim(entry.values.sku)
    const changed: Problem | null =
      entry.differs && entry.decision.stored.kind === "undecided"
        ? {
            kind: "changed",
            tone: "decision",
            field: "sku",
            message: `SKU ${sku} is already there with other values (${Arr.join(
              Arr.map(entry.stored, (difference) => fieldLabels[difference.field]),
              ", "
            )}). Keep the stored item, or replace it with this row.`,
            ask: null,
            choices: ["keep", "replace"],
            note: `${plural(entry.stored.length, "value differs", "values differ")}`,
            proposal: null,
            rivals: []
          }
        : null
    const all = problemsOf(
      ctx,
      entry.row,
      entry.values,
      entry.already
        ? []
        : Arr.map(twins, (other) => ({
            id: other.row.id,
            place: rowPlace(other.row),
            same: sameValues(entry.values, other.values)
          })),
      changed
    )
    const twice = (problem: Problem): boolean => problem.kind === "duplicate" || problem.kind === "clash"
    const problems = Arr.filter(all, (problem) => !twice(problem) || !(live.length === 0 || keptFirst))
    const open: RowStatus = entry.out ? "out" : entry.already ? "already" : problems.length > 0 ? "needs" : "ready"
    const item = open === "ready" ? entry.item : null
    const status: RowStatus = open === "ready" && item === null ? "needs" : open
    const head = problems[0]
    const reason =
      status === "out"
        ? "You left this row out."
        : status === "already"
          ? entry.mine
            ? "This row was imported from this file earlier."
            : entry.keptStored
              ? `SKU ${sku} is already there with other values. You kept the stored item.`
              : `SKU ${sku} is already there. It is skipped, not changed.`
          : head !== undefined
            ? head.message
            : item === null
              ? "A value could not be read."
              : null
    const shown = status === "needs" ? problems : []
    return {
      rowNumber: entry.row.rowNumber,
      ...(entry.row.part === 0 ? {} : { part: entry.row.part }),
      ...(entry.row.label === null ? {} : { partLabel: entry.row.label }),
      id: entry.row.id,
      file: entry.row.file,
      values: entry.values,
      proposals: entry.proposals,
      problems: shown,
      status,
      outcome:
        status !== "needs"
          ? status
          : shown.length === 0 || Arr.some(shown, (problem) => problem.tone === "blocker")
            ? "cannot"
            : "decision",
      kept: hasKeep(entry.decision),
      changes: entry.changes,
      item,
      update: status === "ready" && entry.replace,
      stored: entry.stored,
      reason,
      // Every problem of a row that waits, in the order the screen asks them: a row with two names both.
      reasons:
        status === "needs" && problems.length > 0
          ? Arr.dedupe(Arr.map(problems, (problem) => problem.message))
          : reason === null
            ? []
            : [reason]
    }
  })

  const count = (status: RowStatus): number => Arr.filter(rows, (row) => row.status === status).length
  const outcome = (wanted: RowOutcome): number => Arr.filter(rows, (row) => row.outcome === wanted).length
  const ready = Arr.filter(rows, (row) => row.status === "ready")
  const readyItems = keepSome(ready, (row) => Option.fromNullishOr(row.item))
  const readyQuantities = keepSome(uoms, (unit): Option.Option<UnitTotal> => {
    const inUnit = Arr.filter(readyItems, (item) => item.uom === unit)
    return inUnit.length === 0
      ? Option.none()
      : Option.some({ unit, quantity: Arr.reduce(inUnit, 0, (total, item) => total + item.quantityOnHand) })
  })
  const byRule = Arr.map(
    Arr.filter(rows, (row) => row.status === "ready" || row.status === "needs"),
    (row) => Arr.filter(row.changes, (change) => change.how === "appliedByRule").length
  )

  return {
    mapping: ctx.mapping,
    unusedColumns: ctx.unusedColumns,
    rows,
    totalRows: Arr.map(ctx.totals, (row) => row.rowNumber),
    counts: {
      rows: rows.length,
      fileRows: ctx.fileRows,
      ready: count("ready"),
      needs: count("needs"),
      decision: outcome("decision"),
      cannot: outcome("cannot"),
      out: count("out"),
      already: count("already"),
      updates: Arr.filter(rows, (row) => row.update).length
    },
    fixed: {
      rows: Arr.filter(byRule, (cells) => cells > 0).length,
      cells: Arr.reduce(byRule, 0, (total, cells) => total + cells)
    },
    sums: {
      fileStockValue: stockValue(rows),
      readyStockValue: stockValue(ready),
      readyQuantities
    }
  }
}

/**
 * The first open problem of a row for the values on screen, with its proposal when the value is still the file's.
 * The review screen calls this after the person types a value, so the next thing wrong with the row shows at once.
 * It sees one row: a SKU typed to match another row's is caught by `review` on the next pass and by the commit.
 */
export const recheckRow = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly storedItems: ReadonlyArray<ItemFields>
  readonly itemsOf?: ItemsOfRow
  readonly suggestions?: ReadonlyArray<Suggestion>
}): ((row: { readonly id: string; readonly values: Readonly<Record<string, string>> }) => Problem | undefined) => {
  const ctx = makeContext(input)
  const byId = Rec.fromEntries(Arr.map(ctx.rows, (row) => [row.id, row] as const))
  const byKey = Arr.groupBy(
    Arr.filter(ctx.rows, (row) => skuKey({ sku: row.file.sku }) !== ""),
    (row) => `sku:${skuKey({ sku: row.file.sku })}`
  )
  return (row) => {
    const known = Rec.get(byId, row.id)
    if (Option.isNone(known)) return undefined
    const values = Rec.fromEntries(
      Arr.map(fields, (field) => {
        const text = Option.getOrElse(Rec.get(row.values, field), () => "")
        return [field, text === known.value.file[field] ? text : canonical(field, text)] as const
      })
    ) as Record<Field, string>
    const rivals = Arr.map(
      Arr.filter(
        Option.getOrElse(Rec.get(byKey, `sku:${skuKey({ sku: values.sku })}`), () => []),
        (other) => other.id !== row.id
      ),
      (other) => ({ id: other.id, place: rowPlace(other), same: sameValues(values, other.file) })
    )
    return problemsOf(ctx, known.value, values, rivals, null)[0]
  }
}

/**
 * The draft a new import starts with. With `ruleFixes` "propose" every lossless rule fix is held back, so nothing
 * from the file is changed until the person takes it; with "apply" the draft is empty and the fixes are in force.
 *
 * @example
 * // A file whose row 18 has a form-only rule fix for its unit ("bx"): the fix is held back for the person.
 * firstDecisions({ table, choices: [], mode: "propose" }) // { "row-18": decisionOf({ reverted: ["uom"] }) }
 * firstDecisions({ table, choices: [], mode: "apply" }) // {}
 */
export const firstDecisions = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly mode: "propose" | "apply"
  readonly itemsOf?: ItemsOfRow
}): SavedDecisions => {
  if (input.mode === "apply") return {}
  const current = review({ ...input, decisions: {}, storedItems: [] })
  return Rec.fromEntries(
    keepSome(current.rows, (row) => {
      const safe = Arr.map(
        Arr.filter(row.proposals, (proposal) => proposal.lossless),
        (proposal) => proposal.field
      )
      return safe.length === 0 ? Option.none() : Option.some([row.id, decisionOf({ reverted: safe })] as const)
    })
  )
}

/**
 * Carries a draft over a change of columns: a lossless fix that did not exist before is held
 * back the same way the first draft holds them, and what the person already decided is kept as it is.
 */
export const carryDecisions = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly decisions: SavedDecisions
  readonly mode: "propose" | "apply"
  readonly itemsOf?: ItemsOfRow
}): SavedDecisions => {
  const fresh = firstDecisions(input)
  const kept = input.decisions
  const merged = Arr.map(Arr.dedupe([...Rec.keys(fresh), ...Rec.keys(kept)]), (id) => {
    const before = Option.getOrElse(Rec.get(kept, id), () => emptyDecision)
    const held = Option.getOrElse(Rec.get(fresh, id), () => emptyDecision).reverted
    const reverted = Arr.dedupe([
      ...before.reverted,
      ...Arr.filter(held, (field) => !Arr.contains(before.accepted, field))
    ])
    return [id, { ...before, reverted }] as const
  })
  return Rec.fromEntries(merged)
}

/**
 * Takes back acceptances that no longer mean what the person agreed to. An accept is stored as the field's name,
 * so when the proposal behind a field can change (its column was matched again) the accept must go, or a different
 * value would arrive as "accepted". Returns only the rows whose decision changed.
 *
 * @example
 * // Row 24's unit proposal came from a column that was just matched again: the accept of it goes.
 * dropAccepted({ decisions: { "row-24": decisionOf({ accepted: ["uom"] }) }, rows, drop: (p) => p.field === "uom" })
 * // { "row-24": decisionOf() }
 */
export const dropAccepted = (input: {
  readonly decisions: SavedDecisions
  readonly rows: ReadonlyArray<ReviewedRow>
  readonly drop: (proposal: Proposal) => boolean
}): SavedDecisions =>
  Rec.fromEntries(
    keepSome(input.rows, (row) => {
      const decision = Rec.get(input.decisions, row.id)
      if (Option.isNone(decision)) return Option.none()
      const accepted = decision.value.accepted
      const kept = Arr.filter(accepted, (field) =>
        Arr.some(row.proposals, (proposal) => proposal.field === field && !input.drop(proposal))
      )
      if (kept.length === accepted.length) return Option.none()
      return Option.some([row.id, { ...decision.value, accepted: kept }] as const)
    })
  )

const csvCell = (cell: string): string => (/[",\r\n]/.test(cell) ? `"${Str.replaceAll('"', '""')(cell)}"` : cell)

/**
 * The rows that are not in the system, with the reason for each, as a CSV the person can open: the file's own
 * columns as the file has them, then Excel's row number (with the item's word when its row holds several,
 * "8 · Feb") and why. Rows whose SKU is already stored are not in it:
 * they are items, counted on screen as "Already there".
 *
 * @example
 * notImportedCsv({ table, rows: [{ rowNumber: 9, reason: "No name" }] })
 * // "sku,name,Row,Why it was not imported\r\nZZZ-0003,,9,Name is empty."
 */
export const notImportedCsv = (input: {
  readonly table: StagedTable
  readonly rows: ReadonlyArray<{ readonly rowNumber: number; readonly label?: string; readonly reason: string }>
}): string => {
  const head = [...Arr.map(input.table.columns, (column) => column.label), "Row", "Why it was not imported"]
  const byNumber = Rec.fromEntries(Arr.map(input.table.rows, (row) => [`${row.rowNumber}`, row] as const))
  const body = keepSome(input.rows, (held) =>
    Option.map(Rec.get(byNumber, `${held.rowNumber}`), (row) => [
      ...Arr.map(input.table.columns, (column) => shownText(row.cells[column.index])),
      rowPlace(held),
      held.reason
    ])
  )
  return Arr.join(
    Arr.map([head, ...body], (cells) => Arr.join(Arr.map(cells, csvCell), ",")),
    "\r\n"
  )
}
