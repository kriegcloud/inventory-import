// Decides what a chosen file really is from its bytes, not its name, then hands it to the CSV or workbook reader.
// Each reader is its own lazily loaded chunk, so choosing a CSV never downloads the workbook library.
import { Array as Arr, Effect, Option } from "effect"
import { type FileProblem, fileProblem } from "@inventory/catalog-contract/FileProblem"
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

type Sniffed =
  | { readonly kind: "csv" }
  | { readonly kind: "xlsx" }
  | { readonly kind: "refuse"; readonly error: FileProblem }

const startsWith = (bytes: Uint8Array, prefix: ReadonlyArray<number>): boolean =>
  prefix.every((byte, i) => bytes[i] === byte)

/** True when `bytes` contain `text` as ASCII (zip entry names) or, with `utf16`, as UTF-16LE (OLE stream names). */
const contains = (bytes: Uint8Array, text: string, utf16 = false): boolean => {
  const needle = utf16 ? [...text].flatMap((ch) => [ch.charCodeAt(0), 0]) : [...text].map((ch) => ch.charCodeAt(0))
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

/** The file's real format, from its first bytes and, for zip and OLE containers, the names inside. */
export const sniff = (fileName: string, bytes: Uint8Array): Sniffed => {
  const refuse = (what: string, how?: string): Sniffed => ({
    kind: "refuse",
    error: fileProblem.notASpreadsheet({ fileName, is: what, ...(how === undefined ? {} : { todo: how }) })
  })
  if (startsWith(bytes, zip)) {
    if (contains(bytes, "xl/workbook.xml")) return { kind: "xlsx" }
    if (contains(bytes, "xl/workbook.bin"))
      return refuse("an Excel binary workbook (.xlsb)", "Open it in Excel and save it as .xlsx or CSV UTF-8.")
    if (contains(bytes, "opendocument.spreadsheet"))
      return refuse("an OpenDocument spreadsheet (.ods)", "Save it as .xlsx or CSV UTF-8 and choose it again.")
    if (contains(bytes, "word/document.xml")) return refuse("a Word document")
    // An Office file cut short (a failed download, a full disk) loses the list of its parts at the end.
    if (contains(bytes, "[Content_Types].xml") || /\.xls[xm]$/i.test(fileName)) {
      return { kind: "refuse", error: fileProblem.unreadable({ fileName, why: ": it looks damaged or incomplete" }) }
    }
    return refuse("a zip archive")
  }
  if (startsWith(bytes, ole)) {
    if (contains(bytes, "EncryptedPackage", true)) {
      return { kind: "refuse", error: fileProblem.protectedWorkbook({ fileName }) }
    }
    if (contains(bytes, "Workbook", true) || contains(bytes, "Book", true)) {
      return { kind: "refuse", error: fileProblem.oldExcel({ fileName }) }
    }
    return refuse("an older Office document")
  }
  for (const [magic, what] of others) if (startsWith(bytes, magic)) return refuse(what)
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 512)).trimStart().toLowerCase()
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<table"))
    return refuse("a web page saved with a spreadsheet name", "Open it in Excel and save it as .xlsx or CSV UTF-8.")
  if (bytes.subarray(0, 4096).includes(0)) return refuse("a binary file")
  return { kind: "csv" }
}

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
  const ragged = Arr.dedupe(
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
  const sniffed = sniff(fileName, bytes)
  if (sniffed.kind === "refuse") return yield* Effect.fail(sniffed.error)
  const limit = maxFileBytes[sniffed.kind]
  if (file.size > limit) {
    const what = sniffed.kind === "csv" ? "CSV files" : "workbooks"
    return yield* Effect.fail(fileProblem.tooManyBytes({ fileName, bytes: file.size, limitBytes: limit, what }))
  }
  const extension = extensionOf(fileName)
  const notes: Array<Note> =
    extension === sniffed.kind ||
    (sniffed.kind === "xlsx" && extension === "xlsm") ||
    (sniffed.kind === "csv" && extension === "txt")
      ? []
      : [
          {
            kind: "wrongExtension",
            level: "warning",
            message: `The file is named ".${extension}" but holds ${sniffed.kind === "csv" ? "CSV text" : "an Excel workbook"}; it was read as ${sniffed.kind === "csv" ? "CSV" : ".xlsx"}.`,
            rows: []
          }
        ]
  const onProgress = input.onProgress ?? (() => {})
  if (sniffed.kind === "csv") {
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
  return yield* readXlsx({ fileName, bytes, notes, sheet: Option.fromUndefinedOr(input.sheet), onProgress })
})
