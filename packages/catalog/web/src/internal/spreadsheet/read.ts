// Decides what a chosen file really is from its bytes, not its name, then hands it to the CSV or workbook reader.
// Each reader is its own lazily loaded chunk, so choosing a CSV never downloads the workbook reader.
import * as A from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { type FileProblem, fileProblem } from "@inventory/catalog-contract/FileProblem"
import type { XlsxContainer } from "@beep/xlsx/XlsxDiagnostic"
import { maxFileBytes, type Note, type SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"

/**
 * How far a read has got: rows of the file read so far, and how many it has (`exact` once counted; an estimate from
 * how much text was read for a CSV; null while a workbook is still being opened).
 */
export interface ReadProgress {
  readonly rowsRead: number
  readonly rowsAbout: number | null
  readonly exact: boolean
}

/**
 * What the person chose, the sheet they picked in the chooser (absent the first time), and who to tell how far the
 * read has got. The upload screen reads in a worker and passes `onProgress`; tests call it without.
 */
export interface ReadSpreadsheetInput {
  readonly file: File
  readonly sheet?: string
  readonly onProgress?: (progress: ReadProgress) => void
}

/**
 * What a chosen file is, from its bytes: CSV text, a workbook, an archive the workbook reader still has to look inside,
 * or a file refused with the sentence that says what it is instead.
 */
type Sniffed = Data.TaggedEnum<{
  Csv: {}
  Xlsx: {}
  Archive: {}
  Refuse: { readonly error: FileProblem }
}>
const Sniffed = Data.taggedEnum<Sniffed>()

const startsWith = (bytes: Uint8Array, prefix: ReadonlyArray<number>): boolean =>
  prefix.every((byte, i) => bytes[i] === byte)

/** True when `bytes` contain `text` as ASCII (a zip entry's name). */
const contains = (bytes: Uint8Array, text: string): boolean => {
  const needle = [...text].map((ch) => ch.charCodeAt(0))
  const first = needle[0]
  outer: for (
    let i = bytes.indexOf(first ?? 0);
    i !== -1 && i <= bytes.length - needle.length;
    i = bytes.indexOf(first ?? 0, i + 1)
  ) {
    for (let j = 1; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

const zip = [0x50, 0x4b, 0x03, 0x04]
const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const others: ReadonlyArray<readonly [ReadonlyArray<number>, string]> = [
  [[0x25, 0x50, 0x44, 0x46], "a PDF"],
  [[0x89, 0x50, 0x4e, 0x47], "a PNG image"],
  [[0xff, 0xd8, 0xff], "a JPEG image"],
  [[0x47, 0x49, 0x46, 0x38], "a GIF image"],
  [[0x50, 0x4b, 0x05, 0x06], "an empty zip archive"]
]

const refuse = (fileName: string, what: string, how?: string): Sniffed =>
  Sniffed.Refuse({
    error: fileProblem.notASpreadsheet({ fileName, is: what, ...(how === undefined ? {} : { todo: how }) })
  })

/**
 * The file's real format from its first bytes: text to read as CSV, a file that is plainly something else, or an
 * archive (a zip file or an older Office file), which the workbook reader looks inside.
 */
export const sniff = (fileName: string, bytes: Uint8Array): Sniffed => {
  if (startsWith(bytes, zip) || startsWith(bytes, ole)) return Sniffed.Archive()
  for (const [magic, what] of others) if (startsWith(bytes, magic)) return refuse(fileName, what)
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 512)).trimStart().toLowerCase()
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<table"))
    return refuse(
      fileName,
      "a web page saved with a spreadsheet name",
      "Open it in Excel and save it as .xlsx or CSV UTF-8."
    )
  if (bytes.subarray(0, 4096).includes(0)) return refuse(fileName, "a binary file")
  return Sniffed.Csv()
}

/** What an archive is to the person: a workbook to read, or the sentence that says what it is instead. */
const archiveKind = (fileName: string, bytes: Uint8Array, container: XlsxContainer): Sniffed => {
  switch (container) {
    case "workbook":
    case "macroWorkbook":
      return Sniffed.Xlsx()
    case "binaryWorkbook":
      return refuse(fileName, "an Excel binary workbook (.xlsb)", "Open it in Excel and save it as .xlsx or CSV UTF-8.")
    case "openDocument":
      return refuse(
        fileName,
        "an OpenDocument spreadsheet (.ods)",
        "Save it as .xlsx or CSV UTF-8 and choose it again."
      )
    case "word":
      return refuse(fileName, "a Word document")
    case "otherZip":
      // An Office file cut short (a failed download, a full disk) loses the list of its parts at the end.
      return contains(bytes, "[Content_Types].xml") || /\.xls[xm]$/i.test(fileName)
        ? Sniffed.Refuse({ error: fileProblem.unreadable({ fileName, why: ": it looks damaged or incomplete" }) })
        : refuse(fileName, "a zip archive")
    case "encrypted":
      return Sniffed.Refuse({ error: fileProblem.protectedWorkbook({ fileName }) })
    case "legacyXls":
      return Sniffed.Refuse({ error: fileProblem.oldExcel({ fileName }) })
    case "otherOle":
    case "notAnArchive":
      return refuse(fileName, "an older Office document")
  }
}

/**
 * The reader a sniffed file goes to, or the problem that says why it goes to none. Every case is named: a new kind
 * of file is a compile error here, never a file read by the wrong reader.
 */
const formatOf = (fileName: string, sniffed: Sniffed): Effect.Effect<"csv" | "xlsx", FileProblem> =>
  Sniffed.$match(sniffed, {
    Csv: (): Effect.Effect<"csv" | "xlsx", FileProblem> => Effect.succeed("csv"),
    Xlsx: (): Effect.Effect<"csv" | "xlsx", FileProblem> => Effect.succeed("xlsx"),
    // Still an archive after the workbook reader looked inside: it could not tell what it is.
    Archive: () => Effect.fail(fileProblem.unreadable({ fileName, why: ": it looks damaged or incomplete" })),
    Refuse: ({ error }) => Effect.fail(error)
  })

const extensionOf = (fileName: string): string => /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? ""

/**
 * Whether text read as CSV holds a table: at least two columns, headings short enough to be names, and most rows
 * with as many cells as the heading row. A letter with commas in it has none of these.
 *
 * @example looksLikeTable(readOf("Dear Sam, thanks for the order, see you soon\nBest, Pat")) // false
 */
const looksLikeTable = (table: SpreadsheetTable): boolean => {
  const width = table.columns.length
  if (table.rows.length === 0 || width < 2) return false
  if (table.columns.some((column) => column.label.trim().length > 60)) return false
  // Rows come padded to the heading's width; the reader's notes name the ones that were short or too long.
  const ragged = A.dedupe(
    table.notes.filter((note) => note.kind === "shortRows" || note.kind === "extraCells").flatMap((note) => note.rows)
  )
  return (table.rows.length - ragged.length) * 2 > table.rows.length
}

/**
 * Reads a chosen .csv or .xlsx into one table the rest of the app imports from. Fails with a `FileProblem` that
 * says what is wrong with the file and what to do. Format comes from the bytes; a misleading extension gets a Note.
 */
export const readSpreadsheet = Effect.fn("readSpreadsheet")(function* (
  input: ReadSpreadsheetInput
): Effect.fn.Return<SpreadsheetTable, FileProblem> {
  const { file } = input
  const fileName = file.name
  if (file.size > maxFileBytes.csv) {
    return yield* Effect.fail(
      fileProblem.tooManyBytes({ fileName, bytes: file.size, limitBytes: maxFileBytes.csv, what: "files" })
    )
  }
  if (file.size === 0) return yield* Effect.fail(fileProblem.noValues({ fileName }))
  const buffer = yield* Effect.promise(() => file.arrayBuffer())
  const bytes = new Uint8Array(buffer)
  const first = sniff(fileName, bytes)
  // An archive is looked inside by the workbook reader, which is fetched only now: a CSV never downloads it.
  const sniffed = Sniffed.$is("Archive")(first)
    ? archiveKind(fileName, bytes, (yield* Effect.promise(() => import("./xlsx.ts"))).containerOf(bytes))
    : first
  const format = yield* formatOf(fileName, sniffed)
  const limit = maxFileBytes[format]
  if (file.size > limit) {
    const what = format === "csv" ? "CSV files" : "workbooks"
    return yield* Effect.fail(fileProblem.tooManyBytes({ fileName, bytes: file.size, limitBytes: limit, what }))
  }
  const extension = extensionOf(fileName)
  const notes: Array<Note> =
    extension === format || (format === "xlsx" && extension === "xlsm") || (format === "csv" && extension === "txt")
      ? []
      : [
          {
            kind: "wrongExtension",
            level: "warning",
            message: `The file is named ".${extension}" but holds ${format === "csv" ? "CSV text" : "an Excel workbook"}; it was read as ${format === "csv" ? "CSV" : ".xlsx"}.`,
            rows: []
          }
        ]
  const onProgress = input.onProgress ?? (() => {})
  if (format === "csv") {
    const { readCsv } = yield* Effect.promise(() => import("./csv.ts"))
    const table = yield* readCsv({ fileName, bytes, notes, onProgress })
    // A .txt is read as CSV only when it holds a table: short column names over rows of as many cells. Notes or a
    // letter saved as text (its commas make ragged "rows") are said to be what they are, instead of a Match screen
    // with nothing matched.
    if (extension === "txt" && !looksLikeTable(table)) {
      return yield* Effect.fail(
        fileProblem.notASpreadsheet({ fileName, is: "plain text, not a table of rows under column names" })
      )
    }
    return table
  }
  // Opening a workbook is one step with nothing to count until it is done.
  onProgress({ rowsRead: 0, rowsAbout: null, exact: false })
  const { readXlsx } = yield* Effect.promise(() => import("./xlsx.ts"))
  return yield* readXlsx({ fileName, bytes, notes, sheet: O.fromUndefinedOr(input.sheet), onProgress })
})
