// How a grid of cells (from a CSV or one sheet of a workbook) becomes a table: which row holds the column names,
// which rows are data, and a Note for everything set aside or worth a look. Pure, so the same rules hold in the
// browser, in a Worker and in tests. Do not break: a row is never dropped or a value changed without a Note.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  type Cell,
  CellType,
  type Column,
  CsvFormat,
  type ExtraCell,
  type Note,
  type NoteKind,
  Row,
  SheetChoiceReason,
  type SheetSummary,
  type SpreadsheetTable,
  WorkbookFormat,
  formulaOf,
  shownOf
} from "./Spreadsheet.rules.ts"
import { plural } from "../Words.rules.ts"
import { fileProblem } from "@inventory/catalog-contract/FileProblem"
/** One row of the grid as read, before the header is known. `cells[i]` is spreadsheet column `i` (0 = A). */
export interface GridRow {
  readonly rowNumber: number
  readonly cells: ReadonlyArray<Cell>
  readonly hidden: boolean
}

/** A block of merged cells. Rows are 1-based as in Excel, columns 0-based. */
export interface MergedRange {
  readonly firstRow: number
  readonly lastRow: number
  readonly firstColumn: number
  readonly lastColumn: number
}

/** One sheet's cells in file order, plus what Excel knows about them that the cells do not say. */
export interface SheetGrid {
  readonly rows: ReadonlyArray<GridRow>
  readonly merges: ReadonlyArray<MergedRange>
  readonly hiddenColumns: ReadonlyArray<number>
}

/** A workbook sheet handed to `describeWorkbook`. */
export interface WorkbookSheet {
  readonly name: string
  readonly visibility: SheetSummary["visibility"]
  readonly grid: SheetGrid
}

/**
 * How far down a sheet the column names are looked for: the first 20 rows that hold anything. Title blocks above a
 * table are rarely longer; a header further down is reported (`fileProblem.noHeaderRow`) rather than guessed.
 */
export const headerSearchRows = 20

/** The empty cell, shared by every blank position: a 50,000-row sheet has many, and one object serves them all. */
export const emptyCell: Cell = { type: "empty", text: "" }

const plainNumber = new Intl.NumberFormat("en-US", { useGrouping: false, maximumSignificantDigits: 15 })

/**
 * A stored number as plain decimal text at the 15 significant digits Excel keeps and shows: no exponent and no
 * floating-point noise, so money can be read as cents from the digits.
 * @example numberText(0.30000000000000004) // "0.3"
 * @example numberText(123456789012345680) // "123456789012346000"
 */
export const numberText = (value: number): string => (value === 0 ? "0" : plainNumber.format(value))

const two = (n: number): string => Str.padStart(2, "0")(String(n))

/**
 * A spreadsheet date as ISO 8601 text, from its stored parts, so day and month are never guessed from a display
 * format. A whole day is `2026-03-04`; with a time `2026-03-04T14:30:00`; a time alone (day 0) is `14:30:00`.
 * @example dateText({ day: 46085, y: 2026, m: 3, d: 4, H: 0, M: 0, S: 0 }) // "2026-03-04"
 * @example dateText({ day: 0, y: 1899, m: 12, d: 30, H: 14, M: 30, S: 0 }) // "14:30:00"
 */
export const dateText = (parts: {
  readonly day: number
  readonly y: number
  readonly m: number
  readonly d: number
  readonly H: number
  readonly M: number
  readonly S: number
}): string => {
  const time = `${two(parts.H)}:${two(parts.M)}:${two(parts.S)}`
  if (parts.day === 0) return time
  const date = `${Str.padStart(4, "0")(String(parts.y))}-${two(parts.m)}-${two(parts.d)}`
  return parts.H === 0 && parts.M === 0 && parts.S === 0 ? date : `${date}T${time}`
}

/**
 * The spreadsheet's column letter for a zero-based index.
 * @example columnLetter(0) // "A"
 * @example columnLetter(27) // "AB"
 */
export const columnLetter = (index: number): string => {
  let n = index + 1
  let letters = ""
  while (n > 0) {
    const rest = (n - 1) % 26
    letters = String.fromCharCode(65 + rest) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

const isBlank = (row: GridRow): boolean => A.every(row.cells, (cell) => CellType.is.empty(cell.type))
const filledCount = (row: GridRow): number =>
  A.reduce(row.cells, 0, (n, cell) => (CellType.is.empty(cell.type) ? n : n + 1))
const numberLike = /^[\s\d.,+\-$€£%()]*$/
const hasDigit = /\d/
/** A header cell is words: text that is not a number in disguise. */
const isLabel = (cell: Cell): boolean =>
  CellType.is.empty(cell.type) ||
  (CellType.is.text(cell.type) && !(numberLike.test(cell.text) && hasDigit.test(cell.text)))
const totalWord = /^\s*(grand\s+|sub-?)?totals?\b/i

/**
 * Row numbers as words for a message, at most three of them named, so a long list stays one readable sentence.
 * @example describeRows([9]) // "row 9"
 * @example describeRows([9, 12]) // "rows 9 and 12"
 * @example describeRows([9, 12, 15, 21, 30, 31, 40]) // "rows 9, 12, 15 and 4 more"
 */
export const describeRows = (rows: ReadonlyArray<number>): string =>
  `${rows.length === 1 ? "row" : "rows"} ${listUpTo(A.map(rows, String), shownInList)}`

/** "Row 9", "Rows 9 and 12": `describeRows` at the start of a sentence. */
const Rows = (rows: ReadonlyArray<number>): string => Str.capitalize(describeRows(rows))

/**
 * Items as words for a message, at most `limit` of them named and the rest counted: "a, b and c", "a, b, c and 4
 * more". A message names a list only when it has something in it; an empty one reads "none".
 *
 * @example listUpTo(["C5", "C9"], 3) // "C5 and C9"
 */
const listUpTo = (items: ReadonlyArray<string>, limit: number): string => {
  const shown = A.take(items, limit)
  const more = items.length - shown.length
  if (more > 0) return `${A.join(shown, ", ")} and ${more} more`
  return A.matchRight(shown, {
    onEmpty: () => "none",
    onNonEmpty: (init, last) => (A.isReadonlyArrayNonEmpty(init) ? `${A.join(init, ", ")} and ${last}` : last)
  })
}

/** How many items a message names before it counts the rest. */
const shownInList = 3

/** `listUpTo` with the usual three named. */
const listOf = (items: ReadonlyArray<string>): string => listUpTo(items, shownInList)

/** The rows a note about a column, a sheet or the whole file names: none. */
const noRows: ReadonlyArray<number> = []

const note = (kind: NoteKind, level: Note["level"], message: string, rows: ReadonlyArray<number>): Note => ({
  kind,
  level,
  message,
  rows
})

/** How much of a cell a message quotes before it cuts the text. */
const quotedLength = 60

/** A text in quotes for a message, cut at `max` characters with "...". */
const quoteUpTo = (text: string, max: number): string =>
  `"${text.length > max ? `${Str.trimEnd(Str.slice(0, max)(text))}...` : text}"`

/** `quoteUpTo` at the usual length. */
const quote = (text: string): string => quoteUpTo(text, quotedLength)

/** The header row, the columns it names and the data rows under it, with Notes. Shared by CSV and workbook. */
interface Layout {
  readonly headerRowNumber: number
  readonly columns: ReadonlyArray<Column>
  readonly rows: ReadonlyArray<Row>
  readonly notes: ReadonlyArray<Note>
}

const layoutSheet = Effect.fn("SheetLayout.layoutSheet")(function* (input: {
  readonly fileName: string
  readonly sheetName: O.Option<string>
  readonly grid: SheetGrid
}) {
  const { grid } = input
  const where = O.match(input.sheetName, { onNone: () => "the file", onSome: (name) => `the sheet "${name}"` })
  const filled = A.filter(grid.rows, (row) => !isBlank(row))
  if (filled.length === 0) {
    return yield* Effect.fail(fileProblem.noValues({ fileName: input.fileName, where: `in ${where}` }))
  }
  const widest = A.reduce(A.take(filled, 50), 0, (n, row) => Math.max(n, filledCount(row)))
  const need = widest === 1 ? 1 : Math.max(2, Math.ceil(widest / 2))
  const header = A.findFirst(
    A.take(filled, headerSearchRows),
    (row) => filledCount(row) >= need && A.every(row.cells, isLabel)
  )
  if (O.isNone(header)) {
    return yield* Effect.fail(
      fileProblem.noHeaderRow({
        fileName: input.fileName,
        rows: headerSearchRows,
        sheet: input.sheetName
      })
    )
  }
  const headerRow = header.value
  const notes: Array<Note> = []

  // Columns run from the header's first named cell to its last; letters stay the file's own.
  // The header row was chosen for its named cells, so it has a first and a last one.
  const span = O.all({
    first: A.findFirstIndex(headerRow.cells, (cell) => !CellType.is.empty(cell.type)),
    last: A.findLastIndex(headerRow.cells, (cell) => !CellType.is.empty(cell.type))
  })
  if (O.isNone(span)) return yield* Effect.die("the header row has no named cell")
  const firstColumn = span.value.first
  const lastColumn = span.value.last
  const seen: Record<string, number> = {}
  const columns: Array<Column> = []
  const duplicates: Array<string> = []
  const unnamed: Array<string> = []
  const spaced: Array<string> = []
  A.forEach(A.take(A.drop(headerRow.cells, firstColumn), lastColumn - firstColumn + 1), (cell, offset) => {
    const i = firstColumn + offset
    const text = cell.text
    const letter = columnLetter(i)
    const trimmed = Str.trim(text)
    const key = Str.toLowerCase(trimmed)
    const before = R.get(seen, key)
    let label = trimmed
    if (trimmed === "") {
      label = `Column ${letter}`
      unnamed.push(letter)
    } else if (O.isSome(before)) {
      label = `${trimmed} (column ${letter})`
      duplicates.push(`${quote(trimmed)} (columns ${columnLetter(before.value)} and ${letter})`)
    } else {
      seen[key] = i
    }
    if (trimmed !== "" && trimmed !== text) spaced.push(quote(text))
    columns.push({ index: offset, letter, header: text, label })
  })
  if (duplicates.length > 0) {
    notes.push(
      note(
        "duplicateHeader",
        "warning",
        `More than one column has the same name: ${listOf(duplicates)}. They are kept apart by column letter.`,
        [headerRow.rowNumber]
      )
    )
  }
  if (unnamed.length > 0) {
    notes.push(
      note(
        "emptyHeader",
        "warning",
        `${unnamed.length === 1 ? "Column" : "Columns"} ${listOf(unnamed)} ${unnamed.length === 1 ? "has" : "have"} no name in row ${headerRow.rowNumber}; ${unnamed.length === 1 ? "its cells are" : "their cells are"} kept under "Column ${unnamed[0]}".`,
        [headerRow.rowNumber]
      )
    )
  }
  if (spaced.length > 0) {
    notes.push(
      note(
        "headerSpaces",
        "info",
        `${plural(spaced.length, "column name has", "column names have")} spaces at the start or end (${listOf(spaced)}); kept as found.`,
        [headerRow.rowNumber]
      )
    )
  }

  // Rows above the header: titles and notes. Their text is shown, because it often holds a rule for the import.
  const above = A.filter(filled, (row) => row.rowNumber < headerRow.rowNumber)
  if (above.length > 0) {
    const texts = A.map(above, (row) =>
      quote(
        A.join(
          A.filter(
            A.map(row.cells, (cell) => cell.text),
            (t) => t !== ""
          ),
          " · "
        )
      )
    )
    notes.push(
      note(
        "rowsAboveHeader",
        "info",
        `${Rows(A.map(above, (row) => row.rowNumber))}, above the column names, ${above.length === 1 ? "was" : "were"} not read as data: ${listOf(texts)}.`,
        A.map(above, (row) => row.rowNumber)
      )
    )
  }

  // Data rows.
  const rows: Array<Row> = []
  const blankInside: Array<number> = []
  let pendingBlank: Array<number> = []
  const short: Array<number> = []
  const withExtra: Array<number> = []
  const totals: Array<number> = []
  const hiddenRows: Array<number> = []
  const spacedCells: Array<number> = []
  const formulaColumns: Array<string> = []
  let formulaCount = 0
  const noResult: Array<string> = []
  const errors: Array<string> = []
  const errorRows: Array<number> = []
  const dateColumns: Array<string> = []
  let dateExample = ""
  const zeroCells: Array<string> = []
  const zeroRows: Array<number> = []
  const longCells: Array<string> = []
  const longRows: Array<number> = []
  let secondTable: O.Option<{ readonly first: number; readonly last: number; readonly names: string }> = O.none()
  // The header row is one of the grid's rows, so it has a place among them.
  const start = A.findFirstIndex(grid.rows, (row) => row.rowNumber === headerRow.rowNumber)
  if (O.isNone(start)) return yield* Effect.die("the header row is not in the grid")
  const width = lastColumn - firstColumn + 1
  const under = A.drop(grid.rows, start.value + 1)
  let at = -1
  for (const row of under) {
    at++
    if (isBlank(row)) {
      pendingBlank.push(row.rowNumber)
      continue
    }
    if (
      pendingBlank.length > 0 &&
      filledCount(row) >= 2 &&
      A.every(
        row.cells,
        (cell) => CellType.is.empty(cell.type) || (CellType.is.text(cell.type) && !hasDigit.test(cell.text))
      )
    ) {
      const rest = A.prepend(
        A.filter(A.drop(under, at + 1), (other) => !isBlank(other)),
        row
      )
      secondTable = O.some({
        first: row.rowNumber,
        last: A.lastNonEmpty(rest).rowNumber,
        names: listUpTo(
          A.map(
            A.filter(row.cells, (cell) => !CellType.is.empty(cell.type)),
            (cell) => quoteUpTo(cell.text, 30)
          ),
          4
        )
      })
      break
    }
    for (const n of pendingBlank) blankInside.push(n)
    pendingBlank = []

    // A row that stops before the last column reads as empty cells there, as a spreadsheet shows it.
    const cells: Array<Cell> = A.makeBy(width, (k) =>
      O.match(A.get(row.cells, firstColumn + k), { onNone: () => emptyCell, onSome: identity })
    )
    const extra: Array<ExtraCell> = []
    A.forEach(row.cells, (cell, c) => {
      if ((c < firstColumn || c > lastColumn) && !CellType.is.empty(cell.type)) {
        extra.push({ letter: columnLetter(c), cell })
      }
    })
    if (row.cells.length < lastColumn + 1) short.push(row.rowNumber)
    if (extra.length > 0) withExtra.push(row.rowNumber)
    if (row.hidden) hiddenRows.push(row.rowNumber)
    const first = A.findFirst(cells, (cell) => !CellType.is.empty(cell.type))
    if (O.isSome(first) && CellType.is.text(first.value.type) && totalWord.test(first.value.text)) {
      totals.push(row.rowNumber)
    }
    let rowHasSpaces = false
    A.forEach(cells, (cell, c) => {
      const letter = columnLetter(c + firstColumn)
      const ref = `${letter}${row.rowNumber}`
      if (CellType.is.text(cell.type) && cell.text !== Str.trim(cell.text)) rowHasSpaces = true
      if (O.isSome(formulaOf(cell))) {
        if (CellType.is.empty(cell.type)) noResult.push(ref)
        else formulaCount++
        if (!A.contains(formulaColumns, letter)) formulaColumns.push(letter)
      }
      if (CellType.is.error(cell.type)) {
        errors.push(`${ref} (${cell.text})`)
        if (!A.contains(errorRows, row.rowNumber)) errorRows.push(row.rowNumber)
      }
      if (CellType.is.date(cell.type)) {
        if (!A.contains(dateColumns, letter)) dateColumns.push(letter)
        const shown = shownOf(cell)
        if (dateExample === "" && O.isSome(shown)) dateExample = `${quote(shown.value)} is ${cell.text}`
      }
      const zeroLed = O.filter(shownOf(cell), (shown) => /^0\d/.test(shown))
      if (CellType.is.number(cell.type) && O.isSome(zeroLed)) {
        zeroCells.push(`${ref} shows ${zeroLed.value}, stored as ${cell.text}`)
        zeroRows.push(row.rowNumber)
      }
      if (CellType.is.number(cell.type) && /^-?\d{16,}/.test(cell.text)) {
        longCells.push(`${ref} (${cell.text})`)
        longRows.push(row.rowNumber)
      }
    })
    if (rowHasSpaces) spacedCells.push(row.rowNumber)
    rows.push(
      Row.make({
        rowNumber: row.rowNumber,
        cells,
        extra,
        hidden: row.hidden
      })
    )
  }

  if (blankInside.length > 0) {
    notes.push(
      note(
        "blankRows",
        "info",
        `Skipped ${plural(blankInside.length, "blank row", "blank rows")}: ${describeRows(blankInside)}.`,
        blankInside
      )
    )
  }
  if (O.isSome(secondTable)) {
    const t = secondTable.value
    const range = A.map(
      A.filter(grid.rows, (row) => row.rowNumber >= t.first && row.rowNumber <= t.last),
      (row) => row.rowNumber
    )
    notes.push(
      note(
        "secondTable",
        "warning",
        `A second table starts at row ${t.first} (${t.names}). Rows ${t.first} to ${t.last} were not read; put that table on its own sheet to import it.`,
        range
      )
    )
  }
  if (totals.length > 0) {
    notes.push(
      note(
        "totalRow",
        "warning",
        `${Rows(totals)} ${totals.length === 1 ? "looks" : "look"} like a total. ${totals.length === 1 ? "It is" : "They are"} kept as ${totals.length === 1 ? "a row" : "rows"}: use ${totals.length === 1 ? "it" : "them"} to check the sums, not as items.`,
        totals
      )
    )
  }
  if (short.length > 0) {
    notes.push(
      note(
        "shortRows",
        "warning",
        `${Rows(short)} ${short.length === 1 ? "has" : "have"} fewer cells than there are column names (${width}); the missing cells are read as empty.`,
        short
      )
    )
  }
  if (withExtra.length > 0) {
    notes.push(
      note(
        "extraCells",
        "warning",
        `${Rows(withExtra)} ${withExtra.length === 1 ? "has values" : "have values"} beyond the named columns; they are kept apart, not under any column.`,
        withExtra
      )
    )
  }
  if (spacedCells.length > 0) {
    notes.push(
      note(
        "cellSpaces",
        "info",
        `${Rows(spacedCells)} ${spacedCells.length === 1 ? "has" : "have"} values with spaces at the start or end; kept as found.`,
        spacedCells
      )
    )
  }
  if (formulaCount > 0) {
    notes.push(
      note(
        "formulas",
        "info",
        `${plural(formulaCount, "cell holds a formula", "cells hold formulas")} (${formulaColumns.length === 1 ? "column" : "columns"} ${listOf(A.sort(formulaColumns, Order.String))}); the result saved in the file was read.`,
        noRows
      )
    )
  }
  if (noResult.length > 0) {
    notes.push(
      note(
        "formulaWithoutResult",
        "warning",
        `${plural(noResult.length, "formula has", "formulas have")} no saved result (${listOf(noResult)}), so ${noResult.length === 1 ? "it reads" : "they read"} as empty. Open the file in Excel, save it, and choose it again.`,
        noRows
      )
    )
  }
  if (errors.length > 0) {
    notes.push(
      note(
        "errorCells",
        "warning",
        `${plural(errors.length, "cell holds", "cells hold")} a spreadsheet error: ${listOf(errors)}.`,
        errorRows
      )
    )
  }
  if (dateColumns.length > 0) {
    notes.push(
      note(
        "dates",
        "info",
        `Dates in ${dateColumns.length === 1 ? "column" : "columns"} ${listOf(dateColumns)} were read from the date stored in the file, not from how it is displayed${dateExample === "" ? "" : ` (${dateExample})`}, so day and month are not guessed.`,
        noRows
      )
    )
  }
  if (zeroCells.length > 0) {
    notes.push(
      note(
        "leadingZeros",
        "warning",
        `${plural(zeroCells.length, "number is", "numbers are")} displayed with leading zeros: ${listOf(zeroCells)}. For codes such as SKUs, use the displayed text.`,
        zeroRows
      )
    )
  }
  if (longCells.length > 0) {
    notes.push(
      note(
        "longNumbers",
        "warning",
        `${plural(longCells.length, "number has", "numbers have")} more than 15 digits: ${listOf(longCells)}. Excel keeps only 15, so the last digits were lost before the file was saved. If ${longCells.length === 1 ? "it is a code" : "they are codes"}, format the column as Text in Excel and type ${longCells.length === 1 ? "it" : "them"} again.`,
        longRows
      )
    )
  }
  if (hiddenRows.length > 0) {
    notes.push(
      note(
        "hiddenRows",
        "warning",
        `${Rows(hiddenRows)} ${hiddenRows.length === 1 ? "is" : "are"} hidden in Excel and ${hiddenRows.length === 1 ? "was" : "were"} read like any other row. Check ${hiddenRows.length === 1 ? "it belongs" : "they belong"} in the import.`,
        hiddenRows
      )
    )
  }
  const hiddenColumns = A.filter(grid.hiddenColumns, (c) => c >= firstColumn && c <= lastColumn)
  if (hiddenColumns.length > 0) {
    notes.push(
      note(
        "hiddenColumns",
        "warning",
        `${hiddenColumns.length === 1 ? "Column" : "Columns"} ${listOf(A.map(hiddenColumns, columnLetter))} ${hiddenColumns.length === 1 ? "is" : "are"} hidden in Excel and ${hiddenColumns.length === 1 ? "was" : "were"} read like any other column.`,
        noRows
      )
    )
  }
  if (grid.merges.length > 0) {
    const ranges = A.map(grid.merges, (m) => {
      const from = `${columnLetter(m.firstColumn)}${m.firstRow}`
      const to = `${columnLetter(m.lastColumn)}${m.lastRow}`
      return m.lastRow > headerRow.rowNumber
        ? `${from}:${to} (only ${from} has the value; the other cells are empty in the file)`
        : `${from}:${to}`
    })
    const inData = A.some(grid.merges, (m) => m.lastRow > headerRow.rowNumber)
    notes.push(
      note(
        "mergedCells",
        inData ? "warning" : "info",
        `Merged cells: ${listOf(ranges)}. Nothing was filled in.`,
        A.dedupe(A.flatMap(grid.merges, (m) => A.range(m.firstRow, m.lastRow)))
      )
    )
  }
  return { headerRowNumber: headerRow.rowNumber, columns, rows, notes } satisfies Layout
})

/**
 * A CSV read into a table. The adapter has decoded the bytes and split the items; this finds the header and
 * explains the rest. `notes` are the adapter's own (encoding, delimiter, stray quotes) and come first.
 */
export const describeCsv = Effect.fn("SheetLayout.describeCsv")(function* (input: {
  readonly fileName: string
  readonly delimiter: "," | ";" | "\t" | "|"
  readonly encoding: "utf-8" | "windows-1252"
  readonly grid: SheetGrid
  readonly notes: ReadonlyArray<Note>
}) {
  const layout = yield* layoutSheet({ fileName: input.fileName, sheetName: O.none(), grid: input.grid })
  return {
    fileName: input.fileName,
    kind: "csv",
    format: CsvFormat.make({ delimiter: input.delimiter, encoding: input.encoding }),
    headerRowNumber: layout.headerRowNumber,
    columns: layout.columns,
    rows: layout.rows,
    notes: [...input.notes, ...layout.notes]
  } satisfies SpreadsheetTable
})

const filledCells = (grid: SheetGrid): number => A.reduce(grid.rows, 0, (n, row) => n + filledCount(row))

/** What is known of one sheet before its cells are laid out: enough to list it and to choose among the sheets. */
export interface SheetCount {
  readonly name: string
  readonly visibility: SheetSummary["visibility"]
  /** Rows with at least one non-empty cell. */
  readonly rowCount: number
  /** Non-empty cells: what "the sheet with the most data" is measured by. */
  readonly filledCells: number
}

/**
 * A workbook as the table of one of its sheets, from what is known of every sheet and the grid of the one that is
 * read. `sheet` is the person's choice; without it the visible sheet with the most data is read. Only the chosen
 * sheet's grid is asked for, so a reader need not hold the others.
 */
export const describeSheets = Effect.fn("SheetLayout.describeSheets")(function* <E>(input: {
  readonly fileName: string
  readonly sheets: ReadonlyArray<SheetCount>
  readonly sheet: O.Option<string>
  readonly notes: ReadonlyArray<Note>
  readonly grid: (index: number) => Effect.Effect<{ readonly grid: SheetGrid; readonly notes: ReadonlyArray<Note> }, E>
}) {
  // Each sheet with its place and its summary, so a choice among them carries all three.
  const entries = A.map(input.sheets, (sheet, index) => ({
    index,
    sheet,
    summary: {
      name: sheet.name,
      position: index + 1,
      visibility: sheet.visibility,
      rowCount: sheet.rowCount
    } satisfies SheetSummary
  }))
  type Entry = (typeof entries)[number]
  const summaries: Array<SheetSummary> = A.map(entries, (entry) => entry.summary)
  const withData = A.filter(entries, (entry) => entry.sheet.filledCells > 0)
  const visibleWithData = A.filter(withData, (entry) => entry.sheet.visibility === "visible")
  // The first of the sheets holding the most cells.
  const largest = (among: A.NonEmptyReadonlyArray<Entry>): Entry =>
    A.reduce(A.tailNonEmpty(among), A.headNonEmpty(among), (best, entry) =>
      entry.sheet.filledCells > best.sheet.filledCells ? entry : best
    )
  const asked = O.flatMap(input.sheet, (name) => A.findFirst(entries, (entry) => entry.sheet.name === name))
  if (!A.isReadonlyArrayNonEmpty(withData)) {
    return yield* Effect.fail(fileProblem.noValues({ fileName: input.fileName, where: "on any sheet" }))
  }
  const chosen = O.match(asked, {
    onNone: () => largest(A.isReadonlyArrayNonEmpty(visibleWithData) ? visibleWithData : withData),
    onSome: identity
  })
  const { index, sheet, summary } = chosen
  const others = A.filter(visibleWithData, (entry) => entry.index !== index)
  const othersText = listOf(
    A.map(others, (entry) => `"${entry.summary.name}" (${plural(entry.summary.rowCount, "row", "rows")})`)
  )
  const reason: SheetChoiceReason = O.isSome(asked)
    ? "chosenByPerson"
    : visibleWithData.length === 0
      ? "onlyHiddenSheetsHaveData"
      : visibleWithData.length === 1
        ? "onlySheetWithData"
        : "mostData"
  const read = yield* input.grid(index)
  const layout = yield* layoutSheet({ fileName: input.fileName, sheetName: O.some(sheet.name), grid: read.grid })
  const explanation = SheetChoiceReason.match(reason, {
    chosenByPerson: () => "You chose this sheet.",
    onlySheetWithData: () => "It is the only sheet with data.",
    onlyHiddenSheetsHaveData: () => "Only hidden sheets have data; this one has the most.",
    mostData: () =>
      `It has the most data (${plural(summary.rowCount, "row", "rows")}, ${plural(layout.columns.length, "column", "columns")}). ${others.length === 1 ? "Another sheet also has" : "Other sheets also have"} data: ${othersText}.`
  })

  const hidden = A.filter(withData, (entry) => entry.index !== index && entry.sheet.visibility !== "visible")
  const notes: Array<Note> = [...input.notes, ...read.notes]
  if (hidden.length > 0) {
    const names = A.map(hidden, ({ summary: s }) => {
      const how = s.visibility === "veryHidden" ? "hidden so that only a macro can show it" : "hidden"
      return `"${s.name}" (${how}, ${plural(s.rowCount, "row", "rows")})`
    })
    notes.push(
      note(
        "hiddenSheets",
        "warning",
        `${hidden.length === 1 ? "A hidden sheet holds" : "Hidden sheets hold"} data that was not read: ${listOf(names)}. Choose ${hidden.length === 1 ? "it" : "one"} if it holds what you meant to import.`,
        noRows
      )
    )
  }
  return {
    fileName: input.fileName,
    kind: "xlsx",
    format: WorkbookFormat.make({
      sheets: summaries,
      chosen: {
        name: sheet.name,
        position: index + 1,
        sheetCount: input.sheets.length,
        reason,
        explanation
      }
    }),
    headerRowNumber: layout.headerRowNumber,
    columns: layout.columns,
    rows: layout.rows,
    notes: [...notes, ...layout.notes]
  } satisfies SpreadsheetTable
})

/**
 * A workbook read into a table from one sheet: the one the person chose, otherwise the visible sheet holding the
 * most data. Notes name hidden sheets that hold data, because they were not read.
 */
export const describeWorkbook = Effect.fn("SheetLayout.describeWorkbook")(function* (input: {
  readonly fileName: string
  readonly sheets: ReadonlyArray<WorkbookSheet>
  readonly sheet: O.Option<string>
  readonly notes: ReadonlyArray<Note>
}) {
  return yield* describeSheets({
    fileName: input.fileName,
    sheets: A.map(input.sheets, (sheet) => ({
      name: sheet.name,
      visibility: sheet.visibility,
      rowCount: A.reduce(sheet.grid.rows, 0, (n, row) => (isBlank(row) ? n : n + 1)),
      filledCells: filledCells(sheet.grid)
    })),
    sheet: input.sheet,
    notes: input.notes,
    grid: (index) =>
      O.match(A.get(input.sheets, index), {
        onNone: () => Effect.die("sheet index out of range"),
        onSome: (sheet) => Effect.succeed({ grid: sheet.grid, notes: [] })
      })
  })
})
