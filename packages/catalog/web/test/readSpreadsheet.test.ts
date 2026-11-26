import { assertDefined } from "@effect/vitest/utils"
// Reads real files from test/fixtures/spreadsheet (generated outside the repo; invented fabrication-shop stock) and
// public/samples through the same entry point the browser uses. Each case is listed in docs/patterns.md section 7.
import { readBytes } from "./support/fixture.ts"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import {
  type Note,
  type NoteKind,
  type Row,
  type SpreadsheetTable,
  CsvFormat,
  WorkbookFormat
} from "@inventory/catalog-model/Spreadsheet"
import { FileProblem } from "@inventory/catalog-contract/FileProblem"
import { sayError } from "@inventory/client/SayError"
import { readSpreadsheet } from "@inventory/catalog-web/Spreadsheet"

const bytesOf = (path: string): Uint8Array<ArrayBuffer> => readBytes(new URL(`./${path}`, import.meta.url))
const fixture = (name: string, as: string): File => new File([bytesOf(`fixtures/spreadsheet/${name}`)], as)
const textFile = (text: string, name: string): File => new File([text], name)

const noteOf = (table: SpreadsheetTable, kind: NoteKind): O.Option<Note> =>
  A.findFirst(table.notes, (note) => note.kind === kind)
const rowAt = (table: SpreadsheetTable, rowNumber: number): Row => {
  const row = A.filter(table.rows, (r) => r.rowNumber === rowNumber)[0]
  assertDefined(row)
  return row
}
const texts = (row: Row): ReadonlyArray<string> => A.map(row.cells, (cell) => cell.text)
const rowNumbers = (table: SpreadsheetTable): ReadonlyArray<number> => A.map(table.rows, (row) => row.rowNumber)

describe("CSV", () => {
  it.effect("reads UTF-8 with a byte-order mark, dropping only the mark", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("utf8-bom.csv", "utf8-bom.csv")
      })
      expect(table.format).toEqual(CsvFormat.make({ delimiter: ",", encoding: "utf-8" }))
      expect(table.columns[0]?.header).toBe("SKU")
      expect(texts(rowAt(table, 5))).toEqual(["RD-12", "Round bar Ø 12 mm", "m", "36", "4.80"])
    })
  )

  it.effect("reads UTF-8 without a mark the same way", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: textFile("SKU,Item\nBRK-040,Steel bracket\n", "items.csv")
      })
      expect(table.format).toEqual(CsvFormat.make({ delimiter: ",", encoding: "utf-8" }))
      expect(texts(rowAt(table, 2))).toEqual(["BRK-040", "Steel bracket"])
    })
  )

  it.effect("reads a non-UTF-8 file as Windows-1252 and says so, naming the rows to check", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("windows-1252.csv", "windows-1252.csv")
      })
      expect(table.format).toEqual(CsvFormat.make({ delimiter: ",", encoding: "windows-1252" }))
      expect(texts(rowAt(table, 5))[1]).toBe("Round bar Ø 12 mm")
      expect(texts(rowAt(table, 6))[1]).toBe("Washer ½ inch")
      const note = noteOf(table, "notUtf8")
      expect(O.map(note, (n) => [n.level, n.rows])).toEqual(O.some(["warning", [5, 6]]))
    })
  )

  it.effect("detects semicolons with CRLF line ends and keeps decimal commas as text", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("semicolon-crlf.csv", "semicolon-crlf.csv")
      })
      expect(table.format).toEqual(CsvFormat.make({ delimiter: ";", encoding: "utf-8" }))
      expect(texts(rowAt(table, 2))).toEqual(["BRK-040", "Steel bracket 40 mm", "Each", "120", "2,35"])
      expect(O.isSome(noteOf(table, "delimiter"))).toBe(true)
    })
  )

  it.effect("detects tabs", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("tab.csv", "tab.csv")
      })
      expect(table.format).toEqual(CsvFormat.make({ delimiter: "\t", encoding: "utf-8" }))
      expect(table.columns.length).toBe(5)
    })
  )

  it.effect("keeps quoted commas, doubled quotes and line breaks, and counts rows as Excel shows them", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("quoted.csv", "quoted.csv")
      })
      expect(texts(rowAt(table, 2))[1]).toBe("Angle iron 40 x 40 x 4, galvanised")
      expect(texts(rowAt(table, 3))[1]).toBe('Plate 6 mm "mild steel"')
      expect(texts(rowAt(table, 4))[4]).toBe("Two lines:\r\nkeep dry")
      // The line break inside quotes does not start a new row: the next record is row 5, as in Excel.
      expect(texts(rowAt(table, 5))[0]).toBe("CD-125")
      // The trailing blank line is a blank row; the final line break is not a row at all.
      expect(rowNumbers(table)).toEqual([2, 3, 4, 5])
    })
  )

  it.effect("reads LF and CRLF files to the same rows", () =>
    Effect.gen(function* () {
      const lf = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: textFile("SKU,Qty\nBRK-040,12\nFW-M8,3\n", "items.csv")
      })
      const crlf = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: textFile("SKU,Qty\r\nBRK-040,12\r\nFW-M8,3\r\n", "items.csv")
      })
      expect(lf.rows).toEqual(crlf.rows)
      expect(lf.notes).toEqual([])
    })
  )

  it.effect("names duplicate and empty headers, keeps spaces, pads short rows and keeps extra cells apart", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("ragged.csv", "ragged.csv")
      })
      expect(A.map(table.columns, (c) => c.label)).toEqual([
        "SKU",
        "Item",
        "Quantity",
        "Column D",
        "Quantity (column E)",
        "Location"
      ])
      expect(table.columns[0]?.header).toBe(" SKU ")
      expect(texts(rowAt(table, 2))[1]).toBe(" Steel bracket 40 mm ")
      expect(texts(rowAt(table, 3))).toEqual(["HB-M8-30", "Hex bolt M8 x 30", "1500", "", "", ""])
      expect(rowAt(table, 5).extra).toEqual([
        { letter: "G", cell: { type: "text", text: "extra one" } },
        { letter: "H", cell: { type: "text", text: "extra two" } }
      ])
      const kinds = A.map(table.notes, (n) => n.kind)
      expect(kinds).toEqual([
        "duplicateHeader",
        "emptyHeader",
        "headerSpaces",
        "blankRows",
        "shortRows",
        "extraCells",
        "cellSpaces"
      ])
      expect(O.map(noteOf(table, "blankRows"), (n) => n.rows)).toEqual(O.some([4]))
    })
  )

  it.effect("fails on a quote that never closes, naming the row", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readSpreadsheet({
          onProgress: () => {},
          sheet: O.none(),
          file: textFile('SKU,Item\nBRK-040,"Steel bracket\nFW-M8,x\n', "items.csv")
        })
      )
      expect(error.kind).toBe("unreadable")
      expect(error.problem).toContain("row 2")
      expect(error.todo).toBe("Fix that row in the file and choose it again.")
    })
  )

  it.effect("keeps a quote in the middle of an unquoted field as it is", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: textFile('SKU,Item\nBRK-040,Steel "bracket"\nFW-M8,x\n', "items.csv")
      })
      expect(texts(rowAt(table, 2))).toEqual(["BRK-040", 'Steel "bracket"'])
      expect(rowNumbers(table)).toEqual([2, 3])
    })
  )

  it.effect("cells are text or empty: a CSV has no types, and nothing is converted", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: textFile("SKU,Qty,Counted\n00123,12.50,03/04/2026\n", "items.csv")
      })
      expect(rowAt(table, 2).cells).toEqual([
        { type: "text", text: "00123" },
        { type: "text", text: "12.50" },
        { type: "text", text: "03/04/2026" }
      ])
    })
  )
})

describe("Workbook", () => {
  it.effect("picks the visible sheet with the most data, says why, and lists every sheet", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("sheets.xlsx", "sheets.xlsx")
      })
      if (!S.is(WorkbookFormat)(table.format)) throw new Error("expected a workbook")
      expect(A.map(table.format.sheets, (s) => [s.name, s.visibility, s.rowCount])).toEqual([
        ["Read me", "visible", 2],
        ["Empty", "visible", 0],
        ["Items", "visible", 7],
        ["Lookup", "hidden", 8],
        ["Old prices", "veryHidden", 2],
        ["Bay 2", "visible", 3]
      ])
      expect(table.format.chosen).toMatchObject({ name: "Items", position: 3, sheetCount: 6, reason: "mostData" })
      expect(table.format.chosen.explanation).toContain('"Bay 2" (3 rows)')
      expect(O.map(noteOf(table, "hiddenSheets"), (n) => n.message)).toEqual(
        O.some(
          'Hidden sheets hold data that was not read: "Lookup" (hidden, 8 rows) and "Old prices" (hidden so that only a macro can show it, 2 rows). Choose one if it holds what you meant to import.'
        )
      )
    })
  )

  it.effect("reads the sheet the person chose, even a hidden one", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        file: fixture("sheets.xlsx", "sheets.xlsx"),
        sheet: O.some("Lookup")
      })
      if (!S.is(WorkbookFormat)(table.format)) throw new Error("expected a workbook")
      expect(table.format.chosen).toMatchObject({ name: "Lookup", reason: "chosenByPerson" })
      expect(texts(rowAt(table, 2))).toEqual(["Each", "One piece"])
    })
  )

  it.effect("an empty sheet, if chosen, is an empty file naming the sheet", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        readSpreadsheet({ onProgress: () => {}, file: fixture("sheets.xlsx", "sheets.xlsx"), sheet: O.some("Empty") })
      )
      expect(error.kind).toBe("empty")
      expect(error.problem).toContain('the sheet "Empty"')
    })
  )

  const messy = readSpreadsheet({ onProgress: () => {}, sheet: O.none(), file: fixture("messy.xlsx", "messy.xlsx") })

  it.effect("finds the header under title rows and a merged title, and shows the title text", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(table.headerRowNumber).toBe(4)
      const above = noteOf(table, "rowsAboveHeader")
      expect(O.map(above, (n) => n.message)).toEqual(
        O.some(
          'Rows 1 and 2, above the column names, were not read as data: "Stock count - Bay 4" and "Counted 4 March 2026 by the night shift".'
        )
      )
      expect(O.map(noteOf(table, "mergedCells"), (n) => n.message)).toEqual(
        O.some("Merged cells: A1:H1. Nothing was filled in.")
      )
    })
  )

  it.effect("returns dates as ISO text from the stored value, never guessing day and month", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(rowAt(table, 5).cells[5]).toEqual({ type: "date", text: "2026-03-04" })
      expect(rowAt(table, 6).cells[5]).toEqual({ type: "date", text: "2026-03-04", shown: "3/4/2026" })
      expect(rowAt(table, 7).cells[5]).toEqual({ type: "date", text: "2026-04-03", shown: "03/04/2026" })
      expect(rowAt(table, 8).cells[5]).toEqual({ type: "date", text: "2026-03-04T14:30:00", shown: "2026-03-04 14:30" })
    })
  )

  it.effect("reads 1904-based workbooks to the same dates", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("date-1904.xlsx", "date-1904.xlsx")
      })
      expect(rowAt(table, 2).cells[1]).toEqual({ type: "date", text: "2026-03-04" })
    })
  )

  it.effect("keeps text that looks like a number, and shows a number formatted with leading zeros", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(rowAt(table, 5).cells[7]).toEqual({ type: "text", text: "00123" })
      expect(rowAt(table, 7).cells[2]).toEqual({ type: "text", text: "2000" })
      expect(rowAt(table, 7).cells[7]).toEqual({ type: "text", text: "4006381333931" })
      expect(rowAt(table, 6).cells[7]).toEqual({ type: "number", text: "123", shown: "00123" })
      expect(O.map(noteOf(table, "leadingZeros"), (n) => n.rows)).toEqual(O.some([6]))
    })
  )

  it.effect("returns numbers as plain decimals without floating-point noise, and money with its display", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(rowAt(table, 5).cells[3]).toEqual({ type: "number", text: "12.5", shown: "$12.50" })
      expect(rowAt(table, 6).cells[3]).toEqual({ type: "number", text: "0.3", formula: "=0.1+0.2" })
      expect(rowAt(table, 6).cells[4]).toEqual({ type: "number", text: "450", shown: "$450.00", formula: "=C6*D6" })
      expect(rowAt(table, 7).cells[4]).toEqual({ type: "number", text: "123456789012346000", shown: "1.23457E+17" })
      expect(O.map(noteOf(table, "longNumbers"), (n) => n.rows)).toEqual(O.some([7]))
    })
  )

  it.effect("reads formulas as their stored result, with a note", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(rowAt(table, 5).cells[4]).toEqual({ type: "number", text: "1500", shown: "$1,500.00", formula: "=C5*D5" })
      expect(O.map(noteOf(table, "formulas"), (n) => n.message)).toEqual(
        O.some("9 cells hold formulas (columns C, D and E); the result saved in the file was read.")
      )
    })
  )

  it.effect("keeps error cells as errors, never as blanks", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(rowAt(table, 8).cells[2]).toEqual({ type: "error", text: "#N/A", formula: "=NA()" })
      expect(rowAt(table, 8).cells[4]).toEqual({ type: "error", text: "#DIV/0!", formula: "=C8/0" })
      expect(O.map(noteOf(table, "errorCells"), (n) => [n.level, n.rows])).toEqual(O.some(["warning", [8]]))
    })
  )

  it.effect("drops a blank row inside the data with a note, and keeps Excel's row numbers after it", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(rowNumbers(table)).toEqual([5, 6, 7, 8, 10, 11, 12])
      expect(O.map(noteOf(table, "blankRows"), (n) => n.rows)).toEqual(O.some([9]))
    })
  )

  it.effect("reads a hidden row like any other and marks it", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(rowAt(table, 10).hidden).toBe(true)
      expect(O.map(noteOf(table, "hiddenRows"), (n) => n.rows)).toEqual(O.some([10]))
    })
  )

  it.effect("keeps a total row as a row, flagged, and stops at a second table further down", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(texts(rowAt(table, 12))[0]).toBe("Total")
      expect(O.map(noteOf(table, "totalRow"), (n) => n.rows)).toEqual(O.some([12]))
      expect(O.map(noteOf(table, "secondTable"), (n) => [n.level, n.rows])).toEqual(O.some(["warning", [15, 16, 17]]))
    })
  )

  it.effect("ignores trailing empty rows and columns that only carry formatting", () =>
    Effect.gen(function* () {
      const table = yield* messy
      expect(table.columns.length).toBe(8)
      expect(A.every(table.rows, (row) => A.isReadonlyArrayEmpty(row.extra))).toBe(true)
    })
  )

  it.effect("reads a workbook written by LibreOffice as well", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("libreoffice.xlsx", "libreoffice.xlsx")
      })
      expect(rowAt(table, 5).cells).toEqual([
        { type: "text", text: "RD-12" },
        { type: "text", text: "Round bar Ø 12 mm" },
        { type: "text", text: "m" },
        { type: "number", text: "36" },
        { type: "number", text: "4.8" }
      ])
    })
  )
})

// Each failure is a FileProblem: data the screen shows, with its kind, what is wrong (naming the file) and what to do.
describe("Failures a person can act on", () => {
  const failure = (file: File) => Effect.flip(readSpreadsheet({ onProgress: () => {}, sheet: O.none(), file }))

  it.effect("wrong type: an old .xls says to save it as .xlsx or CSV", () =>
    Effect.gen(function* () {
      const error = yield* failure(fixture("old-format.xls", "old-format.xls"))
      expect(S.is(FileProblem)(error)).toBe(true)
      expect(error).toMatchObject({ kind: "wrongType", fileName: "old-format.xls" })
      expect(error.todo).toContain("save it as")
    })
  )

  it.effect("wrong type: a letter saved as .txt, its commas making ragged rows, is said to be plain text", () =>
    Effect.gen(function* () {
      const error = yield* failure(textFile("Dear Sam, thanks for the order, see you soon\nBest, Pat\n", "letter.txt"))
      expect(error).toMatchObject({ kind: "wrongType", fileName: "letter.txt" })
      expect(error.problem).toContain("plain text")
      // A real table saved as .txt still reads.
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: textFile("sku,name\nBLT-0042,Bolt\nNUT-0001,Nut\n", "items.txt")
      })
      expect(table.rows.length).toBe(2)
    })
  )

  it.effect("unreadable: a password-protected workbook says how to remove the password", () =>
    Effect.gen(function* () {
      const error = yield* failure(fixture("password.xlsx", "password.xlsx"))
      expect(error.kind).toBe("unreadable")
      expect(error.todo).toContain("remove the password")
    })
  )

  it.effect("wrong type: not a spreadsheet at all, whatever its name says", () =>
    Effect.gen(function* () {
      const error = yield* failure(new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], "stock.csv"))
      expect(error).toMatchObject({
        kind: "wrongType",
        problem: '"stock.csv" is not a spreadsheet: it is a PDF.',
        todo: "Choose a .csv or .xlsx file."
      })
      // The screen says it as the problem, then what to do, with nothing technical.
      expect(sayError(error, { fields: {} })).toEqual({
        title: "The file was not read",
        sentence: '"stock.csv" is not a spreadsheet: it is a PDF. Choose a .csv or .xlsx file.',
        problems: []
      })
    })
  )

  it.effect("unreadable: a damaged workbook", () =>
    Effect.gen(function* () {
      const whole = bytesOf("fixtures/spreadsheet/sheets.xlsx")
      const head = yield* failure(new File([whole.subarray(0, 3000)], "cut.xlsx"))
      expect(head).toMatchObject({ kind: "unreadable", problem: expect.stringContaining("damaged or incomplete") })
      const half = yield* failure(new File([whole.subarray(0, Math.floor(whole.length / 2))], "half.xlsx"))
      expect(half.kind).toBe("unreadable")
      const zip = yield* failure(new File([whole.subarray(0, 3000)], "photos.zip"))
      expect(zip.kind).toBe("unreadable")
    })
  )

  it.effect("empty: a file of no bytes, one of blank rows, and a workbook with nothing in it", () =>
    Effect.gen(function* () {
      const nothing = yield* failure(textFile("", "empty.csv"))
      expect(nothing).toMatchObject({
        kind: "empty",
        problem: '"empty.csv" is empty.',
        todo: "Choose the file that holds the rows to import."
      })
      expect((yield* failure(textFile("\n\n,,\n", "blank.csv"))).kind).toBe("empty")
      expect((yield* failure(fixture("empty.xlsx", "empty.xlsx"))).kind).toBe("empty")
    })
  )

  it.effect("too large, before anything is parsed", () =>
    Effect.gen(function* () {
      const error = yield* failure(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "big.xlsx"))
      // 3 MB of zeros is not a workbook; the size guard for .xlsx needs real zip bytes, so check CSV's 10 MB guard.
      expect(error.kind).toBe("wrongType")
      const big = yield* failure(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.csv"))
      expect(big).toMatchObject({ kind: "tooLarge", problem: expect.stringContaining("over 10.0 MB") })
      const zipHead = new Uint8Array(3 * 1024 * 1024 + 1)
      zipHead.set(bytesOf("fixtures/spreadsheet/sheets.xlsx"))
      const workbook = yield* failure(new File([zipHead], "big.xlsx"))
      expect(workbook).toMatchObject({ kind: "tooLarge", problem: expect.stringContaining("workbooks over 3.0 MB") })
    })
  )

  it.effect("no header row, naming the sheet", () =>
    Effect.gen(function* () {
      const error = yield* failure(fixture("no-header.xlsx", "no-header.xlsx"))
      expect(error).toMatchObject({ kind: "noHeaderRow", problem: expect.stringContaining('the sheet "Sheet1"') })
    })
  )
})

describe("A file whose name lies about its content", () => {
  it.effect("a workbook named .csv is read as a workbook, with a note", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("sheets.xlsx", "items.csv")
      })
      expect(table.kind).toBe("xlsx")
      expect(O.map(noteOf(table, "wrongExtension"), (n) => n.message)).toEqual(
        O.some('The file is named ".csv" but holds an Excel workbook; it was read as .xlsx.')
      )
    })
  )

  it.effect("CSV text named .xlsx is read as CSV, with a note", () =>
    Effect.gen(function* () {
      const table = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: fixture("utf8-bom.csv", "items.xlsx")
      })
      expect(table.kind).toBe("csv")
      expect(O.isSome(noteOf(table, "wrongExtension"))).toBe(true)
    })
  )
})

describe("The sample files", () => {
  it.effect("the clean file is 25 items under the schema's own headings, the messy one 16 columns", () =>
    Effect.gen(function* () {
      const clean = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: new File([bytesOf("fixtures/samples/items_clean.csv")], "items_clean.csv")
      })
      const messy = yield* readSpreadsheet({
        onProgress: () => {},
        sheet: O.none(),
        file: new File([bytesOf("fixtures/samples/items_messy.csv")], "items_messy.csv")
      })
      expect(clean.rows.length).toBe(25)
      expect(A.map(clean.columns, (c) => c.header)[0]).toBe("sku")
      expect(clean.columns.length).toBe(15)
      expect(messy.columns.length).toBe(16)
      expect(messy.rows.length).toBe(200)
    })
  )
})
