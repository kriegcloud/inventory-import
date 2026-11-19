import { Array as Arr } from "effect"
import { FileProblem, fileProblem } from "@inventory/catalog-contract/FileProblem"
import { maxStagedRows, type StagedRow } from "@inventory/catalog-contract/Staged"
import { chunkRows } from "@inventory/catalog-contract/Upload"

/**
 * A file on its way to the server: the states the screen shows while it is read and saved, and the rules for the
 * pieces it travels in. The one thing a reader must not break: an upload is not an import. Its rows are kept apart
 * until every piece has arrived and been checked, and only then become an import, whole, in one step; a cancelled or
 * failed upload never leaves rows anyone could confirm.
 */

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
