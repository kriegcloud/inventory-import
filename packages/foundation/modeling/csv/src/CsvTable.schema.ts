/**
 * The canonical decoded side of every CSV codec: records of cells, each cell exactly as written, and one record with
 * where it was, for streams.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { CsvIndex, CsvRecordEnd, CsvTextSpan, MAX_TEXT_UNITS } from "./CsvPosition.schema.ts"
import { $CsvId } from "./internal/identity.ts"

const $I = $CsvId.create("CsvTable")

/**
 * The most cells one record may have; it bounds generation and sits above every configurable limit.
 *
 * @category constants
 */
export const MAX_FIELDS = 1_000_000

/**
 * One cell's text as written in the file, never coerced: what "12" or "03/04/2026" means is the reader's business.
 *
 * @category schemas
 */
export const CsvCell = S.String.check(S.isMaxLength(MAX_TEXT_UNITS)).pipe(
  $I.annoteSchema("CsvCell", { description: "One cell's text, as written, never coerced" })
)

/**
 * Runtime type of {@link CsvCell}.
 *
 * @category models
 */
export type CsvCell = typeof CsvCell.Type

/**
 * Whether a cell must be quoted to read back unchanged: it holds the delimiter, a quote, a carriage return or a line
 * feed, or starts with a byte-order mark (which a reader strips at the start of a file).
 *
 * **Example** (Cells that need quotes)
 *
 * ```ts
 * import { needsQuotes } from "@beep/csv/CsvTable"
 *
 * needsQuotes("Bracket, 40 mm", ",") // => true
 * needsQuotes("Bolt", ",") // => false
 * ```
 *
 * @category utilities
 */
export const needsQuotes: {
  (delimiter: string): (cell: CsvCell) => boolean
  (cell: CsvCell, delimiter: string): boolean
} = dual(
  2,
  (cell: CsvCell, delimiter: string): boolean =>
    Str.includes(delimiter)(cell) ||
    Str.includes('"')(cell) ||
    Str.includes("\r")(cell) ||
    Str.includes("\n")(cell) ||
    Str.startsWith("\uFEFF")(cell)
)

/**
 * One record's cells, never empty: a blank line reads as one empty cell.
 *
 * @category schemas
 */
export const CsvRecord = S.NonEmptyArray(CsvCell.annotateKey({ description: "One cell" }))
  .check(S.isMaxLength(MAX_FIELDS))
  .pipe($I.annoteSchema("CsvRecord", { description: "One record's cells; a blank line is one empty cell" }))

/**
 * Runtime type of {@link CsvRecord}.
 *
 * @category models
 */
export type CsvRecord = typeof CsvRecord.Type

/**
 * Whether a record is a blank line's: exactly one empty cell.
 *
 * @category utilities
 */
export const isBlankRecord = (record: CsvRecord): boolean => record.length === 1 && record[0] === ""

/**
 * The records of a CSV file in file order: the canonical decoded side of every codec.
 *
 * **Example** (A table and its width)
 *
 * ```ts
 * import { CsvTable } from "@beep/csv/CsvTable"
 * import * as O from "effect/Option"
 *
 * const table = CsvTable.make({ records: [["SKU", "Name"], ["BRK-040", "Bracket"]] })
 * O.getOrElse(CsvTable.width(table), () => 0) // => 2
 * ```
 *
 * @category models
 */
export class CsvTable extends S.Opaque<CsvTable, { readonly brand: unique symbol }>()(
  S.Struct({
    records: S.Array(CsvRecord.annotateKey({ description: "One record" })).pipe(
      S.annotateKey({ description: "The records in file order" })
    )
  }).pipe($I.annoteSchema("CsvTable", { description: "The canonical decoded side of every CSV codec" }))
) {
  /** Cells in the first record, when there is one. */
  static readonly width = (table: CsvTable): O.Option<number> => O.map(A.head(table.records), (record) => record.length)

  /** The 0-based indexes of the records whose width differs from the first record's. */
  static readonly ragged = (table: CsvTable): ReadonlyArray<number> =>
    O.match(CsvTable.width(table), {
      onNone: () => [],
      onSome: (width) =>
        A.getSomes(A.map(table.records, (record, index) => (record.length === width ? O.none() : O.some(index))))
    })
}

/**
 * One record in a stream, with where it was and how it ended.
 *
 * @category models
 */
export class CsvRecordSlice extends S.Opaque<CsvRecordSlice, { readonly brand: unique symbol }>()(
  S.Struct({
    cells: CsvRecord.pipe(S.annotateKey({ description: "The record's cells" })),
    record: CsvIndex.pipe(S.annotateKey({ description: "0-based record number, blank lines counted" })),
    span: CsvTextSpan.pipe(S.annotateKey({ description: "Where the record is in the decoded text" })),
    end: CsvRecordEnd.pipe(S.annotateKey({ description: "How the record ended" }))
  }).pipe($I.annoteSchema("CsvRecordSlice", { description: "One record in a stream and where it was" }))
) {}
