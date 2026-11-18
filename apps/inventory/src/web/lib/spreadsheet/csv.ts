// CSV bytes -> a grid of text cells, with papaparse. The upload screen runs this inside its own module worker
// (src/web/lib/upload); never papaparse's `worker: true`, which starts a blob: Worker that the content security policy
// blocks. A CSV has no types, so every cell is text or empty; the app decides what "12" or "03/04/2026" means.
import Papa from "papaparse"
import { Effect } from "effect"
import { describeCsv, describeRows, type GridRow } from "../../../domain/SheetLayout.ts"
import { fileProblem } from "../../../domain/FileProblem.ts"
import type { Cell, Note } from "../../../domain/Spreadsheet.ts"
import { rowsAbout } from "../../../domain/Upload.ts"
import type { ReadProgress } from "./read.ts"

const delimiters = [",", ";", "\t", "|"] as const
type Delimiter = (typeof delimiters)[number]
const delimiterName: Record<Delimiter, string> = {
  ",": "commas",
  ";": "semicolons",
  "\t": "tabs",
  "|": "vertical bars"
}

/** UTF-8 when the bytes are valid UTF-8 (a byte-order mark is dropped), otherwise Windows-1252, with a Note. */
const decode = (bytes: Uint8Array): { text: string; encoding: "utf-8" | "windows-1252" } => {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" }
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" }
  }
}

const textCell = (text: string): Cell => (text === "" ? { type: "empty", text: "" } : { type: "text", text })

/** Characters of text papaparse reads at a time: about 3,000 rows of a usual item list, a few milliseconds each. */
export const pieceChars = 256 * 1024

/**
 * Parses CSV text in pieces of `chars` characters, telling `onPiece` after each how many records and characters are
 * done. The records, errors and delimiter are those of parsing the text at once (`test/web/readInPieces.test.ts`):
 * papaparse carries the row cut by a piece's end over to the next piece; the line ending is guessed once, from the
 * same first megabyte papaparse would look at; an error is kept only once its row is complete, because papaparse also
 * reports errors for the cut row it holds back; and error rows are counted from the start of the file.
 */
export const parseCsv = (
  text: string,
  options: { readonly chars?: number; readonly onPiece?: (records: number, charsRead: number) => void } = {}
): { data: Array<Array<string>>; errors: Array<Papa.ParseError>; delimiter: string } => {
  const data: Array<Array<string>> = []
  const errors: Array<Papa.ParseError> = []
  let delimiter = ""
  const newline = Papa.parse<Array<string>>(text.slice(0, 1024 * 1024), { preview: 1 }).meta.linebreak
  const config = {
    // delimiter "" = detect among , ; tab | (papaparse's guess, from the first rows; reported back, and named in a
    // Note when not a comma).
    delimiter: "",
    newline,
    skipEmptyLines: false,
    header: false,
    chunkSize: options.chars ?? pieceChars,
    chunk: (results: Papa.ParseResult<Array<string>>) => {
      const before = data.length
      for (const record of results.data) data.push(record)
      for (const error of results.errors) {
        const row = error.row ?? 0
        if (row < results.data.length) errors.push({ ...error, row: row + before })
      }
      if (delimiter === "") delimiter = results.meta.delimiter
      options.onPiece?.(data.length, results.meta.cursor)
    }
  }
  // papaparse reads a string in pieces when given `chunkSize` and `chunk` (its StringStreamer); its type definitions
  // offer those options only for files and workers, so the config goes in as the plain string overload's type.
  Papa.parse<Array<string>>(text, config as Papa.ParseConfig<Array<string>>)
  return { data, errors, delimiter }
}

/** Reads a CSV the person chose into a table. `bytes` are the whole file. */
export const readCsv = Effect.fn("readCsv")(function* (input: {
  fileName: string
  bytes: Uint8Array
  notes: ReadonlyArray<Note>
  onProgress?: (progress: ReadProgress) => void
}) {
  const { text, encoding } = decode(input.bytes)
  const report = input.onProgress
  const parsed = parseCsv(text, {
    ...(report === undefined
      ? {}
      : {
          onPiece: (records: number, charsRead: number) => {
            // A file that ends with a line break has one empty record after it, which is no row (dropped below).
            const end = charsRead >= text.length
            const rowsRead = end && /\r?\n$/.test(text) ? records - 1 : records
            report({
              rowsRead,
              rowsAbout: rowsAbout({ rowsRead, charsRead, charsTotal: text.length }),
              exact: end
            })
          }
        })
  })
  const unclosed = parsed.errors.find((e) => e.code === "MissingQuotes")
  if (unclosed !== undefined) {
    const row = (unclosed.row ?? 0) + 1
    return yield* Effect.fail(
      fileProblem.unreadable({
        fileName: input.fileName,
        why: ` past row ${row}: a quote (") there is never closed, so the rest of the file would run into one cell`,
        todo: "Fix that row in the file and choose it again."
      })
    )
  }
  const records = parsed.data
  // A file that ends with a line break has one empty record after it; Excel shows no row there.
  const last = records[records.length - 1]
  if (/\r?\n$/.test(text) && last !== undefined && last.length === 1 && last[0] === "") records.pop()

  const grid: Array<GridRow> = records.map((fields, i) => ({
    rowNumber: i + 1,
    cells: fields.map(textCell),
    hidden: false
  }))
  const found = parsed.delimiter as Delimiter
  const delimiter: Delimiter = delimiters.includes(found) ? found : ","

  const notes: Array<Note> = [...input.notes]
  if (delimiter !== ",") {
    notes.push({
      kind: "delimiter",
      level: "info",
      message: `Columns are separated by ${delimiterName[delimiter]}.`,
      rows: []
    })
  }
  if (encoding === "windows-1252") {
    const rows = grid
      .filter((row) => row.cells.some((cell) => /[^\x00-\x7f]/.test(cell.text)))
      .map((row) => row.rowNumber)
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
  const stray = parsed.errors.filter((e) => e.code === "InvalidQuotes").map((e) => (e.row ?? 0) + 1)
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
