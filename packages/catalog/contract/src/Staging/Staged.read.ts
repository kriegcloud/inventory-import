// A file as it is staged for review: the fields of an item a column can fill, and the table of typed cells, its
// columns and its notes. The one thing not to break: a staged cell is what the file said, never a corrected value.
import * as S from "effect/Schema"
import { nullAsNone } from "@inventory/kernel/Wire"

/** The fields of an item, in the order the screens list them. */
export const fields = [
  "sku",
  "name",
  "description",
  "category",
  "uom",
  "unitCost",
  "quantityOnHand",
  "reorderPoint",
  "isActive",
  "lotTracked",
  "tags",
  "firstReceivedOn",
  "discontinuedOn",
  "dimensions",
  "vendors"
] as const

/** One field of an item that a file column can be matched to. */
export const Field = S.Literals(fields).annotate({
  description: "One field of an item that a file column can be matched to"
})
/** The decoded value of `Field`: one field of an item that a file column can be matched to. */
export type Field = typeof Field.Type

/** The words the screens use for each field. Every reason uses these, never the property name. */
export const fieldLabels: Record<Field, string> = {
  sku: "SKU",
  name: "Name",
  description: "Description",
  category: "Category",
  uom: "Unit of measure",
  unitCost: "Unit cost",
  quantityOnHand: "Quantity on hand",
  reorderPoint: "Reorder point",
  isActive: "Active",
  lotTracked: "Lot tracked",
  tags: "Tags",
  firstReceivedOn: "First received",
  discontinuedOn: "Discontinued on",
  dimensions: "Dimensions",
  vendors: "Vendors"
}

/** Fields an item must have. A file with no column for one of these cannot produce a ready row. */
export const requiredFields: ReadonlyArray<Field> = ["sku", "name", "category", "uom", "unitCost"]

const bounded = (max: number) => S.String.check(S.isMaxLength(max))

/** One cell as the reader found it: `text` with nothing coerced, and `shown` when Excel displays it differently. */
export const StagedCell = S.Struct({
  text: bounded(32767).annotateKey({ description: "The cell's value as text, nothing coerced", examples: ["120"] }),
  shown: S.optionalKey(bounded(32767)).annotateKey({
    description: "What Excel displays, when that differs from the value; left out otherwise"
  })
}).annotate({
  identifier: "StagedCell",
  description:
    "One cell as the reader found it: `text` with nothing coerced, and `shown` when Excel displays it differently"
})
/** The decoded value of `StagedCell`: one cell as the reader found it. */
export type StagedCell = typeof StagedCell.Type

/**
 * One data row of the file. `rowNumber` is the row the person sees in Excel: a row's identity, and, with its part,
 * the identity of each item the row holds (`rowId`). Never offset to tell a row's items apart.
 */
export const StagedRow = S.Struct({
  rowNumber: S.Int.annotateKey({ description: "The row number Excel shows, so 'row 56' on a screen is findable" }),
  cells: S.Array(StagedCell).annotateKey({ description: "The row's cells, in the order of the file's columns" })
}).annotate({ identifier: "StagedRow", description: "One data row of the file" })
/** The decoded value of `StagedRow`: one data row of the file. */
export type StagedRow = typeof StagedRow.Type

/** A column of the file: its position, Excel's letter and the heading as shown. */
export const StagedColumn = S.Struct({
  index: S.Int.annotateKey({ description: "The column's position in the file, from 0", examples: [3] }),
  letter: bounded(8).annotateKey({ description: "The column's letter in Excel: A, B, AA", examples: ["D"] }),
  label: bounded(32767).annotateKey({ description: "The heading as the file shows it", examples: ["Unit"] })
}).annotate({
  identifier: "StagedColumn",
  description: "A column of the file: its position, Excel's letter and the heading as shown"
})
/** The decoded value of `StagedColumn`: a column of the file. */
export type StagedColumn = typeof StagedColumn.Type

/** Something the reader did, skipped or noticed, as the sentence it wrote. */
export const StagedNote = S.Struct({
  kind: bounded(40).annotateKey({ description: "What kind of note it is, as the reader names it" }),
  level: S.Literals(["info", "warning"]).annotateKey({ description: "warning: something the person should look at" }),
  message: bounded(4000).annotateKey({ description: "The sentence the reader wrote" }),
  rows: S.Array(S.Int).annotateKey({
    description: "The rows of the file it is about, as Excel numbers them; empty when it is about the whole file"
  })
}).annotate({
  identifier: "StagedNote",
  description: "Something the reader did, skipped or noticed, as the sentence it wrote"
})
/** The decoded value of `StagedNote`: something the reader did, skipped or noticed, as the sentence it wrote. */
export type StagedNote = typeof StagedNote.Type

/**
 * An uploaded file as the server keeps it until the person confirms: the reader's table, trimmed to what the
 * review needs. Nothing in it is an item yet.
 */
export const StagedTable = S.Struct({
  fileName: bounded(255).annotateKey({ description: "The file's name as it was chosen", examples: ["items.csv"] }),
  kind: S.Literals(["csv", "xlsx"]).annotateKey({ description: "What kind of file it was read as" }),
  sheet: bounded(200).pipe(nullAsNone({ description: "The sheet the table came from; null for a CSV" })),
  headerRowNumber: S.Int.annotateKey({
    description: "The row the headings are on, as Excel numbers it",
    examples: [1]
  }),
  columns: S.Array(StagedColumn).annotateKey({ description: "The file's columns, in order" }),
  rows: S.Array(StagedRow).annotateKey({ description: "The data rows, in file order" }),
  notes: S.Array(StagedNote).annotateKey({ description: "What the reader did, skipped or noticed" })
}).annotate({
  identifier: "StagedTable",
  description:
    "An uploaded file as the server keeps it until the person confirms: the reader's table, trimmed to what the review needs"
})
/** The decoded value of `StagedTable`: an uploaded file as the server keeps it until the person confirms. */
export type StagedTable = typeof StagedTable.Type

const { rows: _rows, ...headFields } = StagedTable.fields

/**
 * A staged file without its rows: name, sheet, columns and the reader's notes. An upload sends it first and the rows
 * after it in chunks, and the server stores it beside the rows, so the rows never travel with it.
 */
export const StagedHead = S.Struct(headFields).annotate({
  identifier: "StagedHead",
  description: "A staged file without its rows: name, sheet, columns and the reader's notes"
})
/** The decoded value of `StagedHead`: a staged file without its rows. */
export type StagedHead = typeof StagedHead.Type

/**
 * The most rows one import stages. Past it the person is asked to split the file. Measured on a local D1
 * (`SCALE=50000 bun run test test/server/Scale.http.test.ts`): 50,000 rows stage in 6 to 16 s, review in 0.7 s
 * and confirm in about 11 s, in 200 statements of two bound values each. Larger files were not measured.
 */
export const maxStagedRows = 50000
