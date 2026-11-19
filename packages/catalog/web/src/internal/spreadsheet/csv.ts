// CSV bytes -> a grid of text cells, with @beep/csv. The upload screen runs this inside its own module worker
// (src/web/lib/upload). A CSV has no types, so every cell is text or empty; the app decides what "12" or
// "03/04/2026" means. The reader's findings become the same Notes and problems the person saw before.
import { Csv } from "@beep/csv/Csv"
import { CsvReadOptions, delimiterName } from "@beep/csv/CsvOptions"
import { CsvRead } from "@beep/csv/CsvRead"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import { describeCsv, describeRows, type GridRow } from "@inventory/catalog-model/SheetLayout"
import { fileProblem } from "@inventory/catalog-contract/FileProblem"
import type { Cell, Note } from "@inventory/catalog-model/Spreadsheet"
import { rowsAbout } from "@inventory/catalog-model/Upload"
import type { ReadProgress } from "./read.ts"

const textCell = (text: string): Cell => (text === "" ? { type: "empty", text: "" } : { type: "text", text })

/** Characters of text read at a time: about 3,000 rows of a usual item list, a few milliseconds each. */
export const pieceChars = 256 * 1024

/** Reads a CSV the person chose into a table. `bytes` are the whole file. */
export const readCsv = Effect.fn("readCsv")(function* (input: {
  fileName: string
  bytes: Uint8Array
  notes: ReadonlyArray<Note>
  onProgress?: (progress: ReadProgress) => void
  /** Characters per piece; tests vary it to prove pieces never change the result. */
  pieceChars?: number
}) {
  const report = input.onProgress
  const result = Csv.parseBytesInPiecesResult(input.bytes, {
    options: CsvReadOptions.default,
    pieceChars: input.pieceChars ?? pieceChars,
    onPiece: (rowsRead, charsRead, charsTotal) =>
      report?.({ rowsRead, rowsAbout: rowsAbout({ rowsRead, charsRead, charsTotal }), exact: charsRead >= charsTotal })
  })
  if (Result.isFailure(result)) {
    const first = A.headNonEmpty(result.failure.diagnostics).finding
    const why =
      first.kind === "UnterminatedQuote"
        ? ` past row ${first.record + 1}: a quote (") there is never closed, so the rest of the file would run into one cell`
        : `: ${result.failure.message}`
    return yield* Effect.fail(
      fileProblem.unreadable({ fileName: input.fileName, why, todo: "Fix that row in the file and choose it again." })
    )
  }
  const read = result.success
  const grid: Array<GridRow> = A.map(read.table.records, (fields, i) => ({
    rowNumber: i + 1,
    cells: A.map(fields, textCell),
    hidden: false
  }))
  const delimiter = read.delimiter.delimiter
  const encoding =
    read.source.input === "bytes" && read.source.encoding.encoding === "windows-1252" ? "windows-1252" : "utf-8"

  const notes: Array<Note> = [...input.notes]
  if (delimiter !== ",") {
    notes.push({
      kind: "delimiter",
      level: "info",
      message: `Columns are separated by ${delimiterName(delimiter)}.`,
      rows: []
    })
  }
  if (encoding === "windows-1252") {
    const rows = A.map(
      A.filter(grid, (row) => A.some(row.cells, (cell) => /[^\x00-\x7f]/.test(cell.text))),
      (row) => row.rowNumber
    )
    notes.push({
      kind: "notUtf8",
      level: "warning",
      message:
        'The file is not UTF-8, so it was read as Windows-1252, the encoding Excel uses for "CSV (Comma delimited)". ' +
        (rows.length === 0
          ? "No accented letters or symbols were found."
          : `Check accented letters and symbols in ${describeRows(rows)}. Saving as "CSV UTF-8" avoids this.`),
      rows
    })
  }
  // papaparse reported a closing quote followed by text ("InvalidQuotes"); a quote inside an unquoted field it never
  // reported, so that finding gets no Note yet.
  const stray = A.filterMap(CsvRead.warnings(read), (warning) =>
    warning.finding.kind === "TextAfterClosingQuote" ? Result.succeed(warning.finding.record + 1) : Result.failVoid
  )
  if (stray.length > 0) {
    notes.push({
      kind: "strayQuote",
      level: "warning",
      message: `${describeRows(stray).replace(/^r/, "R")} ${stray.length === 1 ? "has" : "have"} a quote (") in an odd place; check how ${stray.length === 1 ? "it was" : "they were"} split into columns.`,
      rows: stray
    })
  }
  return yield* describeCsv({
    fileName: input.fileName,
    delimiter,
    encoding,
    grid: { rows: grid, merges: [], hiddenColumns: [] },
    notes
  })
})
