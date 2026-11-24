// THE TEXT A FILE CELL GIVES: what the review, the match's examples, the suggester and the download of the rows not
// imported read from a cell of the file. A cell's spaces are the person's to keep or take off (a trim is a proposal
// shown as before and after), so the clean-ups here are a reader's, never a decode. This file is on the defaults law's
// `exemptions` for clean-ups only (Benjamin, 2026-11-23); an absence or a fallback here counts as anywhere else.
import * as A from "effect/Array"
import { dual, identity } from "effect/Function"
import * as O from "effect/Option"
import * as Str from "effect/String"
import { type Field, shownText, type StagedCell, type StagedRow } from "@inventory/catalog-contract/Staged"

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
