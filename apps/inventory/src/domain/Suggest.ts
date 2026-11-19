/**
 * "Suggest what the rules cannot": what is sent to a model about an import, and the guard on what comes back. Three
 * kinds only: a name for a row with an empty name, from its description; a category for a row whose category is not
 * one of the listed ones, from the item's name and description; a file column for a field no heading matched. The
 * one thing a reader must not break: every answer, a model's or a rule's, passes `guard` before it is stored, and
 * the guard, never the model, sets the confidence (medium at most) and writes the evidence from the file's own rows.
 * Nothing here changes a row: a suggestion is a proposal the person accepts or rejects in the review.
 */
import { Array as Arr, Option, String as Str } from "effect"
import { categories, maxNameLength } from "@inventory/catalog-contract/Item"
import * as S from "effect/Schema"
import { type Review, type ReviewedRow } from "./ItemImport.ts"
import { matchedColumn } from "@inventory/catalog-contract/Mapping"
import { type Field, fieldLabels, fields, type StagedTable } from "@inventory/catalog-contract/Staged"
import {
  type NewSuggestion,
  type Suggestion,
  type SuggestionBy,
  type SuggestionKind,
  suggestionFits
} from "@inventory/catalog-contract/Suggestion"
/** The most rows of one kind a single request asks about; the rest wait for the next press. */
export const suggestCap = 20

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** What a model answers with: a value per row it was shown, and a heading per field. No rating: the guard rates. */
export const SuggestAnswer = S.Struct({
  names: S.Array(
    S.Struct({
      rowNumber: S.Int.annotateKey({ description: "A rowNumber from rowsWithoutName" }),
      name: S.String.annotateKey({
        description: "A short name for the item, taken from its description: the thing itself, in title case"
      })
    })
  ),
  categories: S.Array(
    S.Struct({
      rowNumber: S.Int.annotateKey({ description: "A rowNumber from rowsWithoutCategory" }),
      category: S.String.annotateKey({ description: "One value copied from the categories list, exactly as written" })
    })
  ),
  columns: S.Array(
    S.Struct({
      field: S.String.annotateKey({ description: "A field from fieldsWithoutColumn" }),
      heading: S.String.annotateKey({ description: "A heading from unusedHeadings, exactly as written" })
    })
  )
}).annotate({ description: "A model's suggestions for an import: names, categories and columns, with no rating" })
/** The decoded value of `SuggestAnswer`. */
export type SuggestAnswer = typeof SuggestAnswer.Type

/** The import as the suggestions see it: the staged file, its review as it stands, and what was suggested before. */
export type SuggestSource = {
  readonly table: StagedTable
  readonly review: Review
  readonly suggestions: ReadonlyArray<Suggestion>
}

const has = (source: SuggestSource, row: ReviewedRow, field: Field): boolean =>
  Arr.some(source.suggestions, (s) => s.kind !== "column" && s.rowId === row.id && s.kind === field)

const open = (row: ReviewedRow, kind: "missing" | "category", field: Field): boolean =>
  Arr.some(row.problems, (problem) => problem.kind === kind && problem.field === field && problem.proposal === null)

/**
 * What a model is sent instead of the file: the few rows it must answer for, each with only the cells that bear on
 * the answer, the list a category must come from, and the fields and headings left without a match. Rows that
 * already have a suggestion, are left out or are settled are not in it, so asking twice asks nothing twice. A row
 * with no name and no description is not in it either: there is nothing to suggest a name from.
 */
export const digest = (source: SuggestSource) => {
  const rows = source.review.rows
  const nameless = Arr.filter(
    rows,
    (row) => open(row, "missing", "name") && Str.trim(row.file.description) !== "" && !has(source, row, "name")
  )
  const uncategorised = Arr.filter(rows, (row) => open(row, "category", "category") && !has(source, row, "category"))
  const unmatched = Arr.filter(
    source.review.mapping,
    (match) =>
      Option.isNone(matchedColumn(match)) &&
      !Arr.some(source.suggestions, (s) => s.kind === "column" && s.field === match.field)
  )
  return {
    rowsWithoutName: Arr.map(Arr.take(nameless, suggestCap), (row) => ({
      rowNumber: row.rowNumber,
      sku: Str.slice(0, 40)(Str.trim(row.file.sku)),
      description: Str.slice(0, 200)(Str.trim(row.file.description)),
      category: Str.slice(0, 40)(row.values.category)
    })),
    rowsWithoutCategory: Arr.map(Arr.take(uncategorised, suggestCap), (row) => ({
      rowNumber: row.rowNumber,
      written: Str.slice(0, 60)(Str.trim(row.file.category)),
      name: Str.slice(0, 120)(Str.trim(row.values.name)),
      description: Str.slice(0, 200)(Str.trim(row.file.description))
    })),
    categories,
    fieldsWithoutColumn: Arr.map(unmatched, (match) => ({ field: match.field, label: fieldLabels[match.field] })),
    unusedHeadings:
      unmatched.length === 0
        ? []
        : Arr.map(Arr.take(source.review.unusedColumns, 30), (column) => ({
            heading: Str.slice(0, 80)(column.label),
            filled: column.filled,
            examples: Arr.take(
              Arr.dedupe(
                Arr.filter(
                  Arr.map(source.table.rows, (row) =>
                    Str.slice(0, 40)(Str.trim(row.cells[column.index]?.shown ?? row.cells[column.index]?.text ?? ""))
                  ),
                  (text) => text !== ""
                )
              ),
              3
            )
          }))
  }
}
/** What `digest` returns: what a model is sent about one import. */
export type SuggestDigest = ReturnType<typeof digest>

/** How many questions a digest holds: with none, nobody is asked. */
export const questions = (input: SuggestDigest): number =>
  input.rowsWithoutName.length +
  input.rowsWithoutCategory.length +
  (input.unusedHeadings.length === 0 ? 0 : input.fieldsWithoutColumn.length)

const words = (text: string): ReadonlyArray<string> =>
  Arr.filter(Str.split(/[^a-z0-9/]+/)(Str.toLowerCase(text)), (word) => word !== "")

/**
 * A name read from a description by rule: its words before " for ", a comma or a full stop, each starting with a
 * capital. None when that leaves nothing or more than a name holds.
 *
 * @example nameFromDescription("Nylon coil for general use.") // Option.some("Nylon Coil")
 */
export const nameFromDescription = (description: string): Option.Option<string> => {
  const lead = Str.trim(Str.split(/\s+for\s+|[,.;:](?:\s|$)/i)(Str.trim(description))[0] ?? "")
  const name = Arr.join(
    Arr.map(
      Arr.filter(Str.split(/\s+/)(lead), (word) => word !== ""),
      (word) => `${Str.toUpperCase(Str.slice(0, 1)(word))}${Str.slice(1)(word)}`
    ),
    " "
  )
  return name === "" || name.length > maxNameLength ? Option.none() : Option.some(name)
}

/**
 * The fixed rules' own answer, for when no model can be asked: a name from each description, and nothing else. A
 * rule does not guess a category or a column.
 */
export const answerByRules = (input: SuggestDigest): SuggestAnswer => ({
  names: Arr.getSomes(
    Arr.map(input.rowsWithoutName, (row) =>
      Option.map(nameFromDescription(row.description), (name) => ({ rowNumber: row.rowNumber, name }))
    )
  ),
  categories: [],
  columns: []
})

/** One answer the guard turned down, and why, in a sentence. */
export type Refused = { readonly what: string; readonly why: string }

/**
 * Checks every answer before it is stored, and keeps only what the file supports: a name for a row that was asked
 * about, not empty and at most 120 characters; a category copied from the list of five; a column the file has and
 * nothing reads, for a field that has none. The confidence is set here from the file's rows and is never above
 * medium: a model's own rating is not asked for and would not be used. The basis is counted here too.
 *
 * @example
 * guard({ source, answer: { names: [], categories: [{ rowNumber: 40, category: "widgets" }], columns: [] }, by: suggestedByModel("m") })
 * // { suggestions: [], refused: [{ what: 'Category "widgets" for row 40', why: "It is not one of the 5 categories." }] }
 */
export const guard = (input: {
  readonly source: SuggestSource
  readonly answer: SuggestAnswer
  readonly by: SuggestionBy
}): { readonly suggestions: ReadonlyArray<NewSuggestion>; readonly refused: ReadonlyArray<Refused> } => {
  const { source, by } = input
  const asked = digest(source)
  const rows = source.review.rows
  const rowOf = (rowNumber: number): Option.Option<ReviewedRow> =>
    Arr.findFirst(rows, (row) => row.rowNumber === rowNumber)
  type Judged = { readonly kept: Option.Option<NewSuggestion>; readonly refused: Option.Option<Refused> }
  const no = (what: string, why: string): Judged => ({ kept: Option.none(), refused: Option.some({ what, why }) })
  const yes = (kept: NewSuggestion): Judged => ({ kept: Option.some(kept), refused: Option.none() })

  const names = Arr.map(
    Arr.dedupeWith(input.answer.names, (a, b) => a.rowNumber === b.rowNumber),
    (entry): Judged => {
      const to = Str.trim(entry.name)
      const what = `Name "${Str.slice(0, 60)(to)}" for row ${entry.rowNumber}`
      const row = Option.filter(rowOf(entry.rowNumber), (found) =>
        Arr.some(asked.rowsWithoutName, (shown) => shown.rowNumber === found.rowNumber)
      )
      if (Option.isNone(row)) return no(what, "It is not a row with an empty name and a description.")
      if (to === "") return no(what, "It is empty.")
      if (to.length > maxNameLength) {
        return no(what, `It is ${to.length} characters long. A name has at most ${maxNameLength}.`)
      }
      if (!suggestionFits({ kind: "name", to, file: row.value.file })) return no(what, "The row has a name.")
      const description = Str.trim(row.value.file.description)
      const told = words(description)
      // Medium only when every word of the name is a word of the description: then it says nothing the file does not.
      const drawn = by.kind === "model" && Arr.every(words(to), (word) => Arr.contains(told, word))
      return yes({
        kind: "name",
        rowId: row.value.id,
        rowNumber: row.value.rowNumber,
        from: row.value.file.name,
        to,
        by,
        confidence: drawn ? "medium" : "low",
        basis: `Name is empty on row ${row.value.rowNumber}; its description says "${Str.slice(0, 200)(description)}"${
          by.kind === "rule"
            ? ", and the name is its first words."
            : drawn
              ? ", and every word of the name is in it."
              : ", and the name uses words that are not in it."
        }`
      })
    }
  )

  const cats = Arr.map(
    Arr.dedupeWith(input.answer.categories, (a, b) => a.rowNumber === b.rowNumber),
    (entry): Judged => {
      const what = `Category "${Str.slice(0, 60)(entry.category)}" for row ${entry.rowNumber}`
      const row = Option.filter(rowOf(entry.rowNumber), (found) =>
        Arr.some(asked.rowsWithoutCategory, (shown) => shown.rowNumber === found.rowNumber)
      )
      if (Option.isNone(row)) return no(what, "It is not a row whose category is off the list.")
      const to = Arr.findFirst(categories, (category) => category === Str.trim(entry.category))
      if (Option.isNone(to) || !suggestionFits({ kind: "category", to: to.value, file: row.value.file })) {
        return no(what, `It is not one of the ${categories.length} categories.`)
      }
      // The evidence a person would look at: the other rows whose name starts with the same word, and what they say.
      const first = words(row.value.values.name)[0] ?? ""
      const kin = Arr.filter(
        rows,
        (other) =>
          other.id !== row.value.id &&
          first !== "" &&
          words(other.values.name)[0] === first &&
          Arr.contains(categories as ReadonlyArray<string>, other.values.category)
      )
      const agree = Arr.filter(kin, (other) => other.values.category === to.value).length
      const written = Str.trim(row.value.file.category)
      return yes({
        kind: "category",
        rowId: row.value.id,
        rowNumber: row.value.rowNumber,
        from: row.value.file.category,
        to: to.value,
        by,
        confidence: kin.length >= 2 && agree * 2 > kin.length ? "medium" : "low",
        basis:
          kin.length === 0
            ? `"${written}" on row ${row.value.rowNumber} is not one of the ${categories.length} categories, and no other row's name starts with the same word.`
            : `"${written}" on row ${row.value.rowNumber} is not one of the ${categories.length} categories; ${agree} of ${plural(kin.length, "other row", "other rows")} whose name starts with "${first}" ${agree === 1 ? "says" : "say"} ${to.value}.`
      })
    }
  )

  const columns = Arr.map(
    Arr.dedupeWith(input.answer.columns, (a, b) => a.field === b.field),
    (entry): Judged => {
      const what = `Column "${Str.slice(0, 60)(entry.heading)}" for ${entry.field}`
      const field = Arr.findFirst(fields, (candidate) => candidate === entry.field)
      if (Option.isNone(field) || !Arr.some(asked.fieldsWithoutColumn, (open) => open.field === field.value)) {
        return no(what, "That field already has a column, or is not a field.")
      }
      const column = Arr.findFirst(source.review.unusedColumns, (candidate) => candidate.label === entry.heading)
      if (Option.isNone(column)) return no(what, "That heading is not in the file, or a field already reads it.")
      const shown = Arr.findFirst(
        asked.unusedHeadings,
        (heading) => heading.heading === Str.slice(0, 80)(entry.heading)
      )
      const total = source.review.counts.fileRows
      return yes({
        kind: "column",
        field: field.value,
        column: column.value.index,
        heading: column.value.label,
        by,
        confidence: column.value.filled * 2 > total ? "medium" : "low",
        basis: `No heading matched ${fieldLabels[field.value]}; "${column.value.label}" has a value on ${column.value.filled} of ${plural(total, "row", "rows")}${Option.match(
          shown,
          {
            onNone: () => "",
            onSome: (heading) => (heading.examples.length === 0 ? "" : `, such as ${Arr.join(heading.examples, ", ")}`)
          }
        )}.`
      })
    }
  )

  const judged = [...names, ...cats, ...columns]
  return {
    suggestions: Arr.getSomes(Arr.map(judged, (entry) => entry.kept)),
    refused: Arr.getSomes(Arr.map(judged, (entry) => entry.refused))
  }
}

/**
 * What a request for suggestions did, in past-tense lines with real counts, for the person: what was suggested,
 * what the guard turned down, and what the rules left for them.
 *
 * @example suggestLines({ made, refused: 0, asked, by: "model" }) // ["Suggested 2 names", "Suggested 2 categories"]
 */
export const suggestLines = (input: {
  readonly made: ReadonlyArray<NewSuggestion>
  readonly refused: number
  readonly asked: SuggestDigest
  readonly by: "model" | "rule"
}): ReadonlyArray<string> => {
  const count = (kind: SuggestionKind): number => Arr.filter(input.made, (s) => s.kind === kind).length
  const made = [
    { n: count("name"), words: ["name", "names"] as const, from: " from the description" },
    { n: count("category"), words: ["category", "categories"] as const, from: "" },
    { n: count("column"), words: ["column", "columns"] as const, from: "" }
  ]
  const lines = Arr.map(
    Arr.filter(made, (entry) => entry.n > 0),
    (entry) => `Suggested ${plural(entry.n, entry.words[0], entry.words[1])}${input.by === "rule" ? entry.from : ""}`
  )
  const left = input.asked.rowsWithoutCategory.length - count("category")
  return [
    ...(lines.length === 0 ? ["Suggested nothing: there was nothing left to suggest from"] : lines),
    ...(input.refused > 0
      ? [`Turned down ${plural(input.refused, "suggestion", "suggestions")} that did not pass the checks`]
      : []),
    ...(input.by === "rule" && left > 0
      ? [`Left ${plural(left, "category", "categories")} for you: a rule does not guess a category`]
      : [])
  ]
}
