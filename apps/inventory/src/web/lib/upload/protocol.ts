// What the upload screen and its reader worker say to each other. Both are built from this repository in one build,
// so the messages are plain structured-clone values typed here, not decoded: nothing outside the page sends them.
import type { FileProblem } from "@inventory/catalog-contract/FileProblem"
import type { StagedHead, StagedRow } from "@inventory/catalog-contract/Staged"
import type { SheetChoice, SheetSummary } from "../../../domain/Spreadsheet.ts"

/** What the page asks the reader: one file, and the sheet the person chose (null the first time). */
export type ReadRequest = { readonly file: File; readonly sheet: string | null }

/** A staged head as the copy between threads carries it: `sheet` as its name, or null for a CSV. */
export type PlainHead = Omit<StagedHead, "sheet"> & { readonly sheet: string | null }

/**
 * What the reader tells the page, in this order: `Progress` any number of times, then either `Refused` (the file
 * cannot be staged), `Crashed` (the reader itself failed), or `Head`, every `Chunk` in order, and `Done`.
 */
export type ReadMessage =
  | { readonly _tag: "Progress"; readonly rowsRead: number; readonly rowsAbout: number | null; readonly exact: boolean }
  | {
      readonly _tag: "Head"
      /** The head as plain fields: an `Option` does not survive the copy between threads, so the sheet is its name or null. */
      readonly head: PlainHead
      /** Rows in each chunk that follows, in order: what the server is told to expect. */
      readonly chunkSizes: ReadonlyArray<number>
      /** Every sheet of a workbook and the one that was read, so the person can pick another; null for a CSV. */
      readonly workbook: { readonly sheets: ReadonlyArray<SheetSummary>; readonly chosen: SheetChoice } | null
    }
  | { readonly _tag: "Chunk"; readonly seq: number; readonly rows: ReadonlyArray<StagedRow> }
  | { readonly _tag: "Done" }
  /** The file's problem as plain fields: a class does not survive the copy between threads. */
  | { readonly _tag: "Refused"; readonly problem: typeof FileProblem.Encoded }
  | { readonly _tag: "Crashed"; readonly message: string }
