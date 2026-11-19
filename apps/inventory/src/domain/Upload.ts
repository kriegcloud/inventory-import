/**
 * A file on its way to the server: the states the screen shows while it is read and saved, and the rules for the
 * pieces it travels in. The one thing a reader must not break: an upload is not an import. Its rows are kept apart
 * until every piece has arrived and been checked, and only then become an import, whole, in one step; a cancelled or
 * failed upload never leaves rows anyone could confirm.
 */
import { Array as Arr } from "effect"
import { FileProblem, fileProblem } from "./FileProblem.ts"
import { ImportId } from "./Ids.ts"
import { maxStagedRows, type StagedRow } from "./ItemImport.ts"
import * as S from "effect/Schema"

/** Rows in one piece of an upload, and in one stored chunk of an import: the two are the same chunks. */
export const chunkRows = 500

/**
 * The most characters of JSON one stored chunk may hold. D1 refuses a value over 2 MB; past this the person is told
 * which cells are too long instead.
 */
export const maxChunkChars = 1_500_000

/** An upload that started this long ago and never finished is deleted by the next upload of its organization. */
export const abandonedAfterMinutes = 60

/**
 * Whether `chunkCount` pieces can carry `rowCount` rows: at least one row a piece and at most `chunkRows`. Anything
 * else is a client mistake, refused when the upload begins.
 *
 * @example
 * fitsChunks({ rowCount: 1200, chunkCount: 3 }) // true: pieces of 500, 500 and 200 rows
 * fitsChunks({ rowCount: 2, chunkCount: 3 }) // false: a piece would be empty
 */
export const fitsChunks = (input: { readonly rowCount: number; readonly chunkCount: number }): boolean =>
  input.chunkCount >= 1 &&
  input.chunkCount <= input.rowCount &&
  input.chunkCount >= Math.ceil(input.rowCount / chunkRows) &&
  input.rowCount <= maxStagedRows

/**
 * Where one upload stands, as the screen shows it. Each state carries only what is needed to say so in words and
 * numbers; `progressOf` turns it into a bar.
 */
export const UploadState = S.TaggedUnion({
  /** Nothing chosen, or the last upload finished, failed or was cancelled. */
  Idle: {},
  Reading: {
    fileName: S.String,
    rowsRead: S.Int.annotateKey({ description: "Rows of the file read so far, heading and blank rows included" }),
    rowsAbout: S.NullOr(S.Int).annotateKey({
      description:
        "How many rows the file has: worked out from how much of a CSV has been read (an estimate), counted for a " +
        "workbook once it is open (exact), and null while a workbook is still being opened"
    }),
    exact: S.Boolean.annotateKey({ description: "True when rowsAbout is a count, not an estimate" })
  },
  Saving: {
    fileName: S.String,
    uploadId: ImportId,
    rowsSaved: S.Int.annotateKey({ description: "Rows in the pieces the server has acknowledged, each piece once" }),
    rows: S.Int.annotateKey({ description: "Data rows in the file: what will be staged" })
  },
  /** Every piece arrived; the server is turning the upload into an import and preparing its review. */
  Preparing: { fileName: S.String, uploadId: ImportId, rows: S.Int },
  /** The person pressed Cancel: the reader is stopped and the server is deleting what arrived. */
  Cancelling: { fileName: S.String, uploadId: S.NullOr(ImportId) },
  /** The file itself cannot be staged, found by the reader or by the server: what is wrong and what to do. */
  Refused: { problem: FileProblem },
  /** Something that is not the file stopped it (the network, the server, the browser): the sentence says what to do. */
  Failed: {
    fileName: S.String,
    step: S.Literals(["read", "save"]).annotateKey({ description: "Reading the file, or saving it" }),
    message: S.String.annotateKey({ description: "What happened and what to do, for the person" })
  }
}).annotate({ description: "Where one upload stands, as the screen shows it" })
/** The decoded value of `UploadState`: where one upload stands, as the screen shows it. */
export type UploadState = typeof UploadState.Type

/**
 * How far an upload is, for a bar: `done` of `total`, where `total` is null while nobody can know it. `done` never
 * passes `total`: a CSV's estimate is raised to the rows already read, and saved rows are capped at the file's rows.
 *
 * @example progressOf({ state: { _tag: "Reading", fileName: "items.csv", rowsRead: 52000, rowsAbout: 50000, exact: false } })
 * // { done: 52000, total: 52000 }
 */
export const progressOf = (input: { readonly state: UploadState }): { done: number; total: number | null } => {
  const { state } = input
  switch (state._tag) {
    case "Reading":
      return {
        done: Math.max(0, state.rowsRead),
        total: state.rowsAbout === null ? null : Math.max(state.rowsAbout, state.rowsRead, 0)
      }
    case "Saving":
      return { done: Math.min(Math.max(0, state.rowsSaved), state.rows), total: state.rows }
    case "Preparing":
      return { done: state.rows, total: state.rows }
    default:
      return { done: 0, total: null }
  }
}

/**
 * How many rows a CSV probably has, from how far its text has been read: never fewer than the rows already read, and
 * exactly those rows once all the text has been read.
 *
 * @example rowsAbout({ rowsRead: 12400, charsRead: 1_100_000, charsTotal: 4_400_000 }) // 49600
 */
export const rowsAbout = (input: {
  readonly rowsRead: number
  readonly charsRead: number
  readonly charsTotal: number
}) =>
  input.charsRead <= 0 || input.charsRead >= input.charsTotal
    ? input.rowsRead
    : Math.max(input.rowsRead, Math.round((input.rowsRead * input.charsTotal) / input.charsRead))

/**
 * Rows the server holds: the pieces it acknowledged, each counted once however often it was sent, so a piece sent
 * again after a lost answer never counts twice.
 *
 * @example savedRows({ chunkSizes: [500, 500, 200], acknowledged: [0, 0, 2] }) // 700
 */
export const savedRows = (input: {
  readonly chunkSizes: ReadonlyArray<number>
  readonly acknowledged: ReadonlyArray<number>
}): number => Arr.reduce(Arr.dedupe(input.acknowledged), 0, (sum, seq) => sum + (input.chunkSizes[seq] ?? 0))

/**
 * The rows of a staged file in the pieces they travel and are stored in, in order.
 *
 * @example
 * uploadChunks({ rows }) // 1,200 rows: pieces of 500, 500 and 200, in file order
 */
export const uploadChunks = (input: {
  readonly rows: ReadonlyArray<StagedRow>
}): ReadonlyArray<ReadonlyArray<StagedRow>> => Arr.chunksOf(input.rows, chunkRows)

/**
 * Why the pieces that arrived do not make the whole file, as a `FileProblem`, or null when they do: every piece from
 * 0 to `chunkCount - 1` once, the rows adding up to `rowCount`, and row numbers rising from one piece to the next (a
 * row sent twice, in two pieces, would otherwise become two rows).
 *
 * @example
 * chunkProblem({ fileName: "items.csv", rowCount: 2, chunkCount: 1, chunks: [{ seq: 0, rows: [{ rowNumber: 2 }, { rowNumber: 3 }] }] }) // null
 * chunkProblem({ fileName: "items.csv", rowCount: 2, chunkCount: 2, chunks: [{ seq: 0, rows: [{ rowNumber: 2 }] }] })?.problem
 * // "Part of \"items.csv\" did not reach the server."
 */
export const chunkProblem = (input: {
  readonly fileName: string
  readonly rowCount: number
  readonly chunkCount: number
  readonly chunks: ReadonlyArray<{ readonly seq: number; readonly rows: ReadonlyArray<{ readonly rowNumber: number }> }>
}): FileProblem | null => {
  const { fileName, rowCount, chunkCount, chunks } = input
  const missing = fileProblem.incomplete({ fileName, how: "missing" })
  if (chunks.length !== chunkCount) return missing
  if (!Arr.every(chunks, (chunk, index) => chunk.seq === index)) return missing
  const rows = Arr.flatMap(chunks, (chunk) => chunk.rows)
  if (rows.length !== rowCount) return missing
  const rising = Arr.every(rows, (row, index) => index === 0 || (rows[index - 1]?.rowNumber ?? 0) < row.rowNumber)
  return rising ? null : fileProblem.incomplete({ fileName, how: "order" })
}
