// What the upload screen and its reader worker say to each other. Requests cross in the schema's encoded form and
// are decoded by the worker. Heads and chunks are likewise encoded before the clone and decoded by the page.
// Both sides are built together; native File values cross through the browser's structured-clone API.
import type { FileProblem } from "@inventory/catalog-contract/FileProblem"
import type { StagedHead, StagedRow } from "@inventory/catalog-contract/Staged"
import { SheetChoice, SheetSummary } from "@inventory/catalog-model/Spreadsheet"
import * as Data from "effect/Data"
import * as S from "effect/Schema"

/** What the page asks the reader: one file, and the sheet the person chose (null the first time). */
export const ReadRequest = S.Struct({
  file: S.instanceOf(File).annotateKey({ description: "The browser file chosen by the person" }),
  sheet: S.OptionFromNullOr(S.String).annotateKey({
    description: "Chosen sheet, or null on the wire for the first read"
  })
}).annotate({ description: "A file and sheet crossing to the reader worker" })
export type ReadRequest = typeof ReadRequest.Type

/** A workbook behind the upload, decoded once from the worker's nullable metadata. */
export const ReaderWorkbook = S.Struct({
  sheets: S.Array(SheetSummary).annotateKey({ description: "Sheets listed by the reader" }),
  chosen: SheetChoice.annotateKey({ description: "Which sheet was read and why" })
})
  .pipe(S.OptionFromNullOr)
  .annotate({ description: "Workbook metadata, or null on the worker wire for a CSV" })
export type ReaderWorkbook = typeof ReaderWorkbook.Type

/** Canonical progress at worker receipt; the worker wire uses null while the total is unknown. */
export const ReaderProgress = S.Struct({
  rowsRead: S.Int.annotateKey({ description: "Rows read, including the heading" }),
  rowsAbout: S.OptionFromNullOr(S.Int).annotateKey({
    description: "Estimated or counted rows, unknown while opening a workbook"
  }),
  exact: S.Boolean.annotateKey({ description: "The total was counted rather than estimated" })
}).annotate({ description: "Progress decoded from the reader worker" })
export type ReaderProgress = typeof ReaderProgress.Type

/** A staged head as the copy between threads carries it: `sheet` as its name, or null for a CSV. */
export type PlainHead = typeof StagedHead.Encoded

/**
 * What the reader tells the page, in this order: `Progress` any number of times, then either `Refused` (the file
 * cannot be staged), `Crashed` (the reader itself failed), or `Head`, every `Chunk` in order, and `Done`.
 */
export type ReadMessage = Data.TaggedEnum<{
  readonly Progress: typeof ReaderProgress.Encoded
  readonly Head: {
    /** The head as plain fields: an `Option` does not survive the copy between threads, so the sheet is its name or null. */
    readonly head: PlainHead
    /** Rows in each chunk that follows, in order: what the server is told to expect. */
    readonly chunkSizes: ReadonlyArray<number>
    /** Every sheet of a workbook and the one that was read, so the person can pick another; null for a CSV. */
    readonly workbook: typeof ReaderWorkbook.Encoded
  }
  /** The rows in the form the wire carries them: a cell's `shown` is an `Option`, which does not survive the copy. */
  readonly Chunk: { readonly seq: number; readonly rows: ReadonlyArray<typeof StagedRow.Encoded> }
  readonly Done: {}
  /** The file's problem as its plain fields: a class does not survive the copy between threads. */
  readonly Refused: { readonly problem: Pick<FileProblem, "kind" | "fileName" | "problem" | "todo"> }
  readonly Crashed: { readonly message: string }
}>

/**
 * The messages' constructors, matcher (`ReadMessage.$match`) and guards. The reader builds each message with its
 * constructor; what crosses the threads is a structured clone of its fields, which `$match` reads as it reads the value.
 */
export const ReadMessage = Data.taggedEnum<ReadMessage>()
