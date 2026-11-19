// How a grid of cells (from a CSV or one sheet of a workbook) becomes a table: which row holds the column names,
// which rows are data, and a Note for everything set aside or worth a look. Pure, so the same rules hold in the
// browser, in a Worker and in tests. Do not break: a row is never dropped or a value changed without a Note.
import { Array as Arr, Effect, Option, Order, Record as Rec, String as Str } from "effect"
import {
  type Cell,
  type Column,
  type ExtraCell,
  type Note,
  type NoteKind,
  type Row,
  type SheetChoice,
  type SheetSummary,
  type SpreadsheetTable
} from "./Spreadsheet.rules.ts"
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

const isBlank = (row: GridRow): boolean => Arr.every(row.cells, (cell) => cell.type === "empty")
const filledCount = (row: GridRow): number => Arr.reduce(row.cells, 0, (n, cell) => (cell.type === "empty" ? n : n + 1))
const numberLike = /^[\s\d.,+\-$€£%()]*$/
const hasDigit = /\d/
/** A header cell is words: text that is not a number in disguise. */
const isLabel = (cell: Cell): boolean =>
  cell.type === "empty" || (cell.type === "text" && !(numberLike.test(cell.text) && hasDigit.test(cell.text)))
const totalWord = /^\s*(grand\s+|sub-?)?totals?\b/i

/**
 * Row numbers as words for a message, at most three of them named, so a long list stays one readable sentence.
 * @example describeRows([9]) // "row 9"
 * @example describeRows([9, 12]) // "rows 9 and 12"
 * @example describeRows([9, 12, 15, 21, 30, 31, 40]) // "rows 9, 12, 15 and 4 more"
 */
export const describeRows = (rows: ReadonlyArray<number>): string => {
  const shown = Arr.map(Arr.take(rows, 3), String)
  const more = rows.length - shown.length
  if (rows.length === 1) return `row ${rows[0]}`
  if (more > 0) return `rows ${Arr.join(shown, ", ")} and ${more} more`
  return `rows ${Arr.join(Arr.take(shown, shown.length - 1), ", ")} and ${shown[shown.length - 1]}`
}

/** "Row 9", "Rows 9 and 12": `describeRows` at the start of a sentence. */
const Rows = (rows: ReadonlyArray<number>): string => Str.capitalize(describeRows(rows))

const listOf = (items: ReadonlyArray<string>, limit = 3): string => {
  const shown = Arr.take(items, limit)
  const more = items.length - shown.length
  if (items.length === 1) return shown[0] ?? ""
  if (more > 0) return `${Arr.join(shown, ", ")} and ${more} more`
  return `${Arr.join(Arr.take(shown, shown.length - 1), ", ")} and ${shown[shown.length - 1]}`
}

const note = (kind: NoteKind, level: Note["level"], message: string, rows: ReadonlyArray<number> = []): Note => ({
  kind,
  level,
  message,
  rows
})

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
const quote = (text: string, max = 60): string =>
  `"${text.length > max ? `${Str.trimEnd(Str.slice(0, max)(text))}...` : text}"`

/** The header row, the columns it names and the data rows under it, with Notes. Shared by CSV and workbook. */
interface Layout {
  readonly headerRowNumber: number
  readonly columns: ReadonlyArray<Column>
  readonly rows: ReadonlyArray<Row>
  readonly notes: ReadonlyArray<Note>
}

const layoutSheet = Effect.fn("SheetLayout.layoutSheet")(function* (input: {
  readonly fileName: string
  readonly sheetName: Option.Option<string>
  readonly grid: SheetGrid
}) {
  const { grid } = input
  const where = Option.match(input.sheetName, { onNone: () => "the file", onSome: (name) => `the sheet "${name}"` })
  const filled = Arr.filter(grid.rows, (row) => !isBlank(row))
  if (filled.length === 0) {
    return yield* Effect.fail(fileProblem.noValues({ fileName: input.fileName, where: `in ${where}` }))
  }
  const widest = Arr.reduce(Arr.take(filled, 50), 0, (n, row) => Math.max(n, filledCount(row)))
  const need = widest === 1 ? 1 : Math.max(2, Math.ceil(widest / 2))
  const header = Arr.findFirst(
    Arr.take(filled, headerSearchRows),
    (row) => filledCount(row) >= need && Arr.every(row.cells, isLabel)
  )
  if (Option.isNone(header)) {
    return yield* Effect.fail(
      fileProblem.noHeaderRow({
        fileName: input.fileName,
        rows: headerSearchRows,
        ...Option.match(input.sheetName, { onNone: () => ({}), onSome: (sheet) => ({ sheet }) })
      })
    )
  }
  const headerRow = header.value
  const notes: Array<Note> = []

  // Columns run from the header's first named cell to its last; letters stay the file's own.
  const firstColumn = Option.getOrElse(
    Arr.findFirstIndex(headerRow.cells, (cell) => cell.type !== "empty"),
    () => 0
  )
  const lastColumn = Option.getOrElse(
    Arr.findLastIndex(headerRow.cells, (cell) => cell.type !== "empty"),
    () => 0
  )
  const seen: Record<string, number> = {}
  const columns: Array<Column> = []
  const duplicates: Array<string> = []
  const unnamed: Array<string> = []
  const spaced: Array<string> = []
  for (let i = firstColumn; i <= lastColumn; i++) {
    const text = headerRow.cells[i]?.text ?? ""
    const letter = columnLetter(i)
    const trimmed = Str.trim(text)
    const key = Str.toLowerCase(trimmed)
    let label = trimmed
    if (trimmed === "") {
      label = `Column ${letter}`
      unnamed.push(letter)
    } else if (Option.isSome(Rec.get(seen, key))) {
      label = `${trimmed} (column ${letter})`
      duplicates.push(
        `${quote(trimmed)} (columns ${columnLetter(Option.getOrElse(Rec.get(seen, key), () => i))} and ${letter})`
      )
    } else {
      seen[key] = i
    }
    if (trimmed !== "" && trimmed !== text) spaced.push(quote(text))
    columns.push({ index: i - firstColumn, letter, header: text, label })
  }
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
  const above = Arr.filter(filled, (row) => row.rowNumber < headerRow.rowNumber)
  if (above.length > 0) {
    const texts = Arr.map(above, (row) =>
      quote(
        Arr.join(
          Arr.filter(
            Arr.map(row.cells, (cell) => cell.text),
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
        `${Rows(Arr.map(above, (row) => row.rowNumber))}, above the column names, ${above.length === 1 ? "was" : "were"} not read as data: ${listOf(texts)}.`,
        Arr.map(above, (row) => row.rowNumber)
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
  let secondTable: Option.Option<{ readonly first: number; readonly last: number; readonly names: string }> =
    Option.none()
  const start = Option.getOrElse(
    Arr.findFirstIndex(grid.rows, (row) => row.rowNumber === headerRow.rowNumber),
    () => 0
  )
  const width = lastColumn - firstColumn + 1
  for (let r = start + 1; r < grid.rows.length; r++) {
    const row = grid.rows[r]
    if (row === undefined) continue
    if (isBlank(row)) {
      pendingBlank.push(row.rowNumber)
      continue
    }
    if (
      pendingBlank.length > 0 &&
      filledCount(row) >= 2 &&
      Arr.every(row.cells, (cell) => cell.type === "empty" || (cell.type === "text" && !hasDigit.test(cell.text)))
    ) {
      const rest = Arr.filter(grid.rows.slice(r), (other) => !isBlank(other))
      secondTable = Option.some({
        first: row.rowNumber,
        last: rest[rest.length - 1]?.rowNumber ?? row.rowNumber,
        names: listOf(
          Arr.map(
            Arr.filter(row.cells, (cell) => cell.type !== "empty"),
            (cell) => quote(cell.text, 30)
          ),
          4
        )
      })
      break
    }
    for (const n of pendingBlank) blankInside.push(n)
    pendingBlank = []

    const cells: Array<Cell> = []
    for (let c = firstColumn; c <= lastColumn; c++) cells.push(row.cells[c] ?? emptyCell)
    const extra: Array<ExtraCell> = []
    for (let c = 0; c < row.cells.length; c++) {
      const cell = row.cells[c]
      if ((c < firstColumn || c > lastColumn) && cell !== undefined && cell.type !== "empty") {
        extra.push({ letter: columnLetter(c), cell })
      }
    }
    if (row.cells.length < lastColumn + 1) short.push(row.rowNumber)
    if (extra.length > 0) withExtra.push(row.rowNumber)
    if (row.hidden) hiddenRows.push(row.rowNumber)
    const first = Arr.findFirst(cells, (cell) => cell.type !== "empty")
    if (Option.isSome(first) && first.value.type === "text" && totalWord.test(first.value.text)) {
      totals.push(row.rowNumber)
    }
    let rowHasSpaces = false
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]
      if (cell === undefined) continue
      const letter = columnLetter(c + firstColumn)
      const ref = `${letter}${row.rowNumber}`
      if (cell.type === "text" && cell.text !== Str.trim(cell.text)) rowHasSpaces = true
      if (cell.formula !== undefined) {
        if (cell.type === "empty") noResult.push(ref)
        else formulaCount++
        if (!Arr.contains(formulaColumns, letter)) formulaColumns.push(letter)
      }
      if (cell.type === "error") {
        errors.push(`${ref} (${cell.text})`)
        if (!Arr.contains(errorRows, row.rowNumber)) errorRows.push(row.rowNumber)
      }
      if (cell.type === "date") {
        if (!Arr.contains(dateColumns, letter)) dateColumns.push(letter)
        if (dateExample === "" && cell.shown !== undefined) dateExample = `${quote(cell.shown)} is ${cell.text}`
      }
      if (cell.type === "number" && cell.shown !== undefined && /^0\d/.test(cell.shown)) {
        zeroCells.push(`${ref} shows ${cell.shown}, stored as ${cell.text}`)
        zeroRows.push(row.rowNumber)
      }
      if (cell.type === "number" && /^-?\d{16,}/.test(cell.text)) {
        longCells.push(`${ref} (${cell.text})`)
        longRows.push(row.rowNumber)
      }
    }
    if (rowHasSpaces) spacedCells.push(row.rowNumber)
    rows.push({
      rowNumber: row.rowNumber,
      cells,
      ...(extra.length > 0 ? { extra } : {}),
      ...(row.hidden ? { hidden: true } : {})
    })
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
  if (Option.isSome(secondTable)) {
    const t = secondTable.value
    const range = Arr.map(
      Arr.filter(grid.rows, (row) => row.rowNumber >= t.first && row.rowNumber <= t.last),
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
        `${plural(formulaCount, "cell holds a formula", "cells hold formulas")} (${formulaColumns.length === 1 ? "column" : "columns"} ${listOf(Arr.sort(formulaColumns, Order.String))}); the result saved in the file was read.`
      )
    )
  }
  if (noResult.length > 0) {
    notes.push(
      note(
        "formulaWithoutResult",
        "warning",
        `${plural(noResult.length, "formula has", "formulas have")} no saved result (${listOf(noResult)}), so ${noResult.length === 1 ? "it reads" : "they read"} as empty. Open the file in Excel, save it, and choose it again.`
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
        `Dates in ${dateColumns.length === 1 ? "column" : "columns"} ${listOf(dateColumns)} were read from the date stored in the file, not from how it is displayed${dateExample === "" ? "" : ` (${dateExample})`}, so day and month are not guessed.`
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
  const hiddenColumns = Arr.filter(grid.hiddenColumns, (c) => c >= firstColumn && c <= lastColumn)
  if (hiddenColumns.length > 0) {
    notes.push(
      note(
        "hiddenColumns",
        "warning",
        `${hiddenColumns.length === 1 ? "Column" : "Columns"} ${listOf(Arr.map(hiddenColumns, columnLetter))} ${hiddenColumns.length === 1 ? "is" : "are"} hidden in Excel and ${hiddenColumns.length === 1 ? "was" : "were"} read like any other column.`
      )
    )
  }
  if (grid.merges.length > 0) {
    const ranges = Arr.map(grid.merges, (m) => {
      const from = `${columnLetter(m.firstColumn)}${m.firstRow}`
      const to = `${columnLetter(m.lastColumn)}${m.lastRow}`
      return m.lastRow > headerRow.rowNumber
        ? `${from}:${to} (only ${from} has the value; the other cells are empty in the file)`
        : `${from}:${to}`
    })
    const inData = Arr.some(grid.merges, (m) => m.lastRow > headerRow.rowNumber)
    notes.push(
      note(
        "mergedCells",
        inData ? "warning" : "info",
        `Merged cells: ${listOf(ranges)}. Nothing was filled in.`,
        Arr.dedupe(Arr.flatMap(grid.merges, (m) => Arr.range(m.firstRow, m.lastRow)))
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
  const layout = yield* layoutSheet({ fileName: input.fileName, sheetName: Option.none(), grid: input.grid })
  return {
    fileName: input.fileName,
    kind: "csv",
    format: { _tag: "csv", delimiter: input.delimiter, encoding: input.encoding },
    headerRowNumber: layout.headerRowNumber,
    columns: layout.columns,
    rows: layout.rows,
    notes: [...input.notes, ...layout.notes]
  } satisfies SpreadsheetTable
})

const filledCells = (grid: SheetGrid): number => Arr.reduce(grid.rows, 0, (n, row) => n + filledCount(row))

/**
 * A workbook read into a table from one sheet: the one the person chose, otherwise the visible sheet holding the
 * most data. Notes name hidden sheets that hold data, because they were not read.
 */
export const describeWorkbook = Effect.fn("SheetLayout.describeWorkbook")(function* (input: {
  readonly fileName: string
  readonly sheets: ReadonlyArray<WorkbookSheet>
  readonly sheet: Option.Option<string>
  readonly notes: ReadonlyArray<Note>
}) {
  const summaries: Array<SheetSummary> = Arr.map(input.sheets, (sheet, i) => ({
    name: sheet.name,
    position: i + 1,
    visibility: sheet.visibility,
    rowCount: Arr.reduce(sheet.grid.rows, 0, (n, row) => (isBlank(row) ? n : n + 1))
  }))
  const sizes = Arr.map(input.sheets, (sheet) => filledCells(sheet.grid))
  const withData = Arr.filter(Arr.range(0, input.sheets.length - 1), (i) => (sizes[i] ?? 0) > 0)
  const visibleWithData = Arr.filter(withData, (i) => input.sheets[i]?.visibility === "visible")
  const largest = (indexes: ReadonlyArray<number>): number =>
    Arr.reduce(indexes, indexes[0] ?? 0, (best, i) => ((sizes[i] ?? 0) > (sizes[best] ?? 0) ? i : best))
  const asked = Option.flatMap(input.sheet, (name) => Arr.findFirstIndex(input.sheets, (sheet) => sheet.name === name))
  if (withData.length === 0 || input.sheets.length === 0) {
    return yield* Effect.fail(fileProblem.noValues({ fileName: input.fileName, where: "on any sheet" }))
  }
  const index = Option.isSome(asked) ? asked.value : largest(visibleWithData.length > 0 ? visibleWithData : withData)
  const sheet = input.sheets[index]
  const summary = summaries[index]
  if (sheet === undefined || summary === undefined) return yield* Effect.die("sheet index out of range")
  const others = Arr.filter(visibleWithData, (i) => i !== index)
  const othersText = listOf(
    Arr.map(others, (i) => `"${summaries[i]?.name}" (${plural(summaries[i]?.rowCount ?? 0, "row", "rows")})`)
  )
  const reason: SheetChoice["reason"] = Option.isSome(asked)
    ? "chosenByPerson"
    : visibleWithData.length === 0
      ? "onlyHiddenSheetsHaveData"
      : visibleWithData.length === 1
        ? "onlySheetWithData"
        : "mostData"
  const layout = yield* layoutSheet({ fileName: input.fileName, sheetName: Option.some(sheet.name), grid: sheet.grid })
  const explanation =
    reason === "chosenByPerson"
      ? "You chose this sheet."
      : reason === "onlySheetWithData"
        ? "It is the only sheet with data."
        : reason === "onlyHiddenSheetsHaveData"
          ? "Only hidden sheets have data; this one has the most."
          : `It has the most data (${plural(summary.rowCount, "row", "rows")}, ${plural(layout.columns.length, "column", "columns")}). ${others.length === 1 ? "Another sheet also has" : "Other sheets also have"} data: ${othersText}.`

  const hidden = Arr.filter(withData, (i) => i !== index && input.sheets[i]?.visibility !== "visible")
  const notes: Array<Note> = [...input.notes]
  if (hidden.length > 0) {
    const names = Arr.map(hidden, (i) => {
      const s = summaries[i]
      const how = s?.visibility === "veryHidden" ? "hidden so that only a macro can show it" : "hidden"
      return `"${s?.name}" (${how}, ${plural(s?.rowCount ?? 0, "row", "rows")})`
    })
    notes.push(
      note(
        "hiddenSheets",
        "warning",
        `${hidden.length === 1 ? "A hidden sheet holds" : "Hidden sheets hold"} data that was not read: ${listOf(names)}. Choose ${hidden.length === 1 ? "it" : "one"} if it holds what you meant to import.`
      )
    )
  }
  return {
    fileName: input.fileName,
    kind: "xlsx",
    format: {
      _tag: "xlsx",
      sheets: summaries,
      chosen: {
        name: sheet.name,
        position: index + 1,
        sheetCount: input.sheets.length,
        reason,
        explanation
      }
    },
    headerRowNumber: layout.headerRowNumber,
    columns: layout.columns,
    rows: layout.rows,
    notes: [...notes, ...layout.notes]
  } satisfies SpreadsheetTable
})
