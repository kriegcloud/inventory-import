// THE TEXT A FILE CELL GIVES: what the review, the match's examples, the suggester and the download of the rows not
// imported read from a cell of the file. A cell's spaces are the person's to keep or take off (a trim is a proposal
// shown as before and after), so the clean-ups here are a reader's, never a decode. This file is on the defaults law's
// `exemptions` for clean-ups only (Benjamin, 2026-11-23); an absence or a fallback here counts as anywhere else.
import * as A from "effect/Array"
import { dual, identity } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { maxNameLength, skuPattern } from "@inventory/catalog-contract/Item"
import { Field, fields, shownText, type StagedCell, type StagedRow } from "@inventory/catalog-contract/Staged"
import {
  booleanWord,
  canonicalTags,
  categoryKey,
  dateReadings,
  isCategory,
  isUom,
  readDate,
  readDecimal,
  twoDigitYear
} from "./CellReading.rules.ts"

/**
 * The text of an empty cell, and of a cell its row ends before: a row of a CSV may stop short of the last column, and
 * what it leaves out reads as empty, as a spreadsheet shows it.
 */
export const emptyText = ""

/**
 * The cell at a column of a row, when the row reaches that column.
 *
 * @example cellAt({ rowNumber: 2, cells: [{ text: "BLT-0042", shown: O.none() }] }, 3) // O.none()
 */
export const cellAt: {
  (index: number): (row: StagedRow) => O.Option<StagedCell>
  (row: StagedRow, index: number): O.Option<StagedCell>
} = dual(2, (row: StagedRow, index: number): O.Option<StagedCell> => A.get(row.cells, index))

/**
 * What a cell shows, as the person reads it in the file: what Excel displays, else its text; empty for a cell the row
 * ends before.
 */
export const shownAt: {
  (index: number): (row: StagedRow) => string
  (row: StagedRow, index: number): string
} = dual(2, (row: StagedRow, index: number): string =>
  O.match(cellAt(row, index), { onNone: () => emptyText, onSome: shownText })
)

/**
 * What a cell shows with the spaces round it taken off, when that is anything: none for a cell the row ends before,
 * an empty one, or one holding only spaces. For counting filled cells and for showing a few values of a column.
 *
 * @example filledAt({ rowNumber: 2, cells: [{ text: "  EA ", shown: O.none() }] }, 0) // O.some("EA")
 */
export const filledAt: {
  (index: number): (row: StagedRow) => O.Option<string>
  (row: StagedRow, index: number): O.Option<string>
} = dual(2, (row: StagedRow, index: number): O.Option<string> =>
  O.filter(
    O.map(cellAt(row, index), (cell) => Str.trim(shownText(cell))),
    Str.isNonEmpty
  )
)

/**
 * Whether a cell says only that its row adds the file up: "Total", "Totals", "Grand total", with a colon or not.
 *
 * @example isTotalCell({ text: " Grand Total: ", shown: O.none() }) // true
 */
export const isTotalCell = (cell: StagedCell): boolean => /^(grand\s+)?totals?:?$/i.test(Str.trim(shownText(cell)))

/** Whether a text is blank: empty, or only spaces. */
export const isBlank = (text: string): boolean => Str.isEmpty(Str.trim(text))

/** Fields read from a cell's stored text, not from what Excel shows: a cost from the digits, a date cell as ISO. */
const storedTextFields: ReadonlyArray<Field> = ["unitCost", "firstReceivedOn", "discontinuedOn"]

/**
 * The text of a cell as the review reads it for a field. A cost is read from the stored digits, so a cost Excel shows
 * as "$3.65" but stores as 3.6549 is held, not rounded, and a date cell from its stored date (ISO), whatever format
 * Excel shows it in. Everything else is what the person sees: a SKU stored as 123 with a five-digit format is
 * "00123". Spaces round a value are kept: trimming them is a proposal. A cell holding only spaces reads as empty, so
 * the screen says "Empty" instead of showing nothing.
 *
 * @example reviewText(O.some({ text: "123", shown: O.some("00123") }), "sku") // "00123"
 */
export const reviewText: {
  (field: Field): (cell: O.Option<StagedCell>) => string
  (cell: O.Option<StagedCell>, field: Field): string
} = dual(2, (cell: O.Option<StagedCell>, field: Field): string =>
  O.match(
    O.filter(
      O.map(cell, (found) => (A.contains(storedTextFields, field) ? found.text : shownText(found))),
      (text) => !isBlank(text)
    ),
    { onNone: () => emptyText, onSome: identity }
  )
)

/** The two date fields: a cell of either reads as a day, written year-month-day once it is stored. */
export const DateField = Field.pick(["firstReceivedOn", "discontinuedOn"])
/** The decoded value of `DateField`. */
export type DateField = typeof DateField.Type
/** Whether a field holds a date. */
export const isDateField = S.is(DateField)
/** Whether a field holds a whole count: a quantity on hand or a reorder point. */
export const isCountField = S.is(Field.pick(["quantityOnHand", "reorderPoint"]))
/** Whether a field holds true or false. */
export const isBooleanField = S.is(Field.pick(["isActive", "lotTracked"]))

/**
 * The value a cell holds without the spaces round it: what a check of the value reads, what its message quotes, and
 * what a trim proposes. The cell itself keeps its spaces until the person takes the proposal.
 *
 * @example cellValue(" BLT-0042 ") // "BLT-0042"
 */
export const cellValue = (text: string): string => Str.trim(text)

/**
 * Whether a value has spaces round it: a SKU or a name with them is the same value written another way.
 *
 * @example hasSpacesRound(" BLT-0042") // true
 */
export const hasSpacesRound = (text: string): boolean => text !== Str.trim(text)

/**
 * A SKU or a unit in capitals, the form the list and the pattern hold: what a cell in other capitals is compared as,
 * and what is proposed for it.
 *
 * @example inCapitals("blt-0042") // "BLT-0042"
 */
export const inCapitals = (text: string): string => Str.toUpperCase(text)

/**
 * The words of a name or a description, in lower case: how two cells are told to say the same thing, whatever their
 * capitals and punctuation.
 *
 * @example wordsIn("Nylon Coil, 50 m") // ["nylon", "coil", "50", "m"]
 */
export const wordsIn = (text: string): ReadonlyArray<string> =>
  A.filter(Str.split(/[^a-z0-9/]+/)(Str.toLowerCase(text)), Str.isNonEmpty)

/**
 * A name read from a description by rule: its words before " for ", a comma or a full stop, each starting with a
 * capital. None when that leaves nothing or more than a name holds.
 *
 * @example nameFromDescription("Nylon coil for general use.") // O.some("Nylon Coil")
 */
export const nameFromDescription = (description: string): O.Option<string> => {
  const lead = Str.trim(A.headNonEmpty(Str.split(/\s+for\s+|[,.;:](?:\s|$)/i)(Str.trim(description))))
  const name = A.join(
    A.map(
      A.filter(Str.split(/\s+/)(lead), Str.isNonEmpty),
      (word) => `${Str.toUpperCase(Str.slice(0, 1)(word))}${Str.slice(1)(word)}`
    ),
    " "
  )
  return name === "" || name.length > maxNameLength ? O.none() : O.some(name)
}

/**
 * What a typed value is stored as. A person who types "bx" means BX and one who types "yes" means true, so their own
 * typing is read through the same word lists; a value from the file is changed only through a proposal that says so.
 *
 * @example canonical("uom", " bx ") // "BX"
 */
export const canonical: {
  (text: string): (field: Field) => string
  (field: Field, text: string): string
} = dual(2, (field: Field, text: string): string => {
  const trimmed = Str.trim(text)
  if (field === "description") return text
  if (field === "sku") return skuPattern.test(Str.toUpperCase(trimmed)) ? Str.toUpperCase(trimmed) : trimmed
  if (field === "uom") return isUom(Str.toUpperCase(trimmed)) ? Str.toUpperCase(trimmed) : trimmed
  if (field === "category") return isCategory(categoryKey(trimmed)) ? categoryKey(trimmed) : trimmed
  if (isBooleanField(field)) return O.match(booleanWord(trimmed), { onNone: () => trimmed, onSome: identity })
  if (field === "tags") return canonicalTags(trimmed)
  return trimmed
})

/**
 * True when the row says it is discontinued and active at once: a date that reads, and Active true or left empty.
 *
 * @example discontinuedYetActive({ ...values, discontinuedOn: "2024-03-01", isActive: "" }) // true
 */
export const discontinuedYetActive = (values: Readonly<Record<Field, string>>): boolean =>
  O.isSome(readDate(values.discontinuedOn)) && (isBlank(values.isActive) || values.isActive === "true")

/**
 * Whether two items of the file say the same in every field, spaces round a value apart: such rows are copies, and
 * rows that share only a SKU clash.
 *
 * @example sameValues(row31.file, row32.file) // true for a row copied with a trailing space
 */
export const sameValues: {
  (b: Readonly<Record<Field, string>>): (a: Readonly<Record<Field, string>>) => boolean
  (a: Readonly<Record<Field, string>>, b: Readonly<Record<Field, string>>): boolean
} = dual(2, (a: Readonly<Record<Field, string>>, b: Readonly<Record<Field, string>>): boolean =>
  A.every(fields, (field) => Str.trim(a[field]) === Str.trim(b[field]))
)

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
}): O.Option<{ readonly to: string; readonly rule: string }> => {
  const { field, text } = input
  const trimmed = Str.trim(text)
  if (trimmed === "") return O.none()
  if (field === "sku") {
    return text !== trimmed && skuPattern.test(trimmed)
      ? O.some({ to: trimmed, rule: "spaces around the value" })
      : O.none()
  }
  if (field === "name") {
    return text !== trimmed && trimmed.length <= maxNameLength
      ? O.some({ to: trimmed, rule: "spaces around the value" })
      : O.none()
  }
  if (field === "uom") {
    const upper = Str.toUpperCase(trimmed)
    return !isUom(text) && isUom(upper) ? O.some({ to: upper, rule: "the same unit in capitals" }) : O.none()
  }
  if (field === "category") {
    const key = categoryKey(text)
    return !isCategory(text) && isCategory(key)
      ? O.some({ to: key, rule: "the same category in the list's own form" })
      : O.none()
  }
  if (field === "unitCost") {
    const bare = Str.trim(Str.replace(/^\$/, "")(trimmed))
    return Str.startsWith("$")(trimmed) && O.isSome(readDecimal(bare))
      ? O.some({ to: bare, rule: "the same amount without the $" })
      : O.none()
  }
  if (isBooleanField(field)) {
    return text === "true" || text === "false"
      ? O.none()
      : O.map(booleanWord(text), (to) => ({ to, rule: `a usual way to write ${to}` }))
  }
  if (field === "tags") {
    const to = canonicalTags(text)
    return to !== text && to !== "" ? O.some({ to, rule: "lower case, each tag once" }) : O.none()
  }
  // A year written with two digits is a guess at the century: never a form-only fix, and never proposed at all.
  if (isDateField(field) && O.isNone(readDate(text)) && !twoDigitYear(text)) {
    const { dayFirst, monthFirst } = dateReadings(text)
    if (O.isSome(dayFirst) && O.isNone(monthFirst)) {
      return O.some({ to: dayFirst.value, rule: "the same date written year-month-day" })
    }
    if (O.isNone(dayFirst) && O.isSome(monthFirst)) {
      return O.some({ to: monthFirst.value, rule: "the same date written year-month-day" })
    }
  }
  return O.none()
}
