// A file as it is staged for review: the fields of an item a column can fill, and the table of typed cells, its
// columns and its notes. The one thing not to break: a staged cell is what the file said, never a corrected value.
import * as S from "effect/Schema"
import { nullAsNone } from "@inventory/kernel/Wire"
import { MAX_COLUMN } from "@beep/xlsx/XlsxAddress"

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
export const fieldLabels: Readonly<Record<Field, string>> = {
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

/**
 * The most rows one import stages. Past it the person is asked to split the file. Measured on a local D1
 * (`SCALE=50000 bun run test test/server/Scale.http.test.ts`): 50,000 rows stage in 6 to 16 s, review in 0.7 s
 * and confirm in about 11 s, in 200 statements of two bound values each. Larger files were not measured.
 */
export const maxStagedRows = 50000

/**
 * The most columns a staged file may have. A wider file is refused before anything is sent (`stagingProblem`), so a
 * staged row never has more cells than this, nor a staged head more columns.
 */
export const maxColumns = 200

/** Excel's last column, XFD, from 0: a column's place in a file is never past it. The workbook reader's own bound. */
export const lastColumnIndex = MAX_COLUMN

/**
 * The most notes a staged file may carry. A reader writes a few notes about the file and at most one for each number
 * format it could not show, and a workbook holds about 250 formats, so this is far past any file and still a bound.
 */
export const maxNotes = 1000

/**
 * The highest row number a row id can carry (`row-9999999`): a staged row numbered past it could not be named by
 * the review, so it is refused as the request it is instead of failing the review later.
 */
export const maxRowNumber = 9_999_999

/**
 * A row of the file as Excel numbers it: from 1, and no higher than a row id can carry. Row 0 does not exist in a
 * spreadsheet, and a row id of it would be refused (`RowId`), so it is refused here.
 */
export const RowNumber = S.Int.check(S.isBetween({ minimum: 1, maximum: maxRowNumber })).annotate({
  identifier: "RowNumber",
  description: "A row of the file as Excel numbers it: from 1",
  examples: [7]
})
/** The decoded value of `RowNumber`: a row of the file as Excel numbers it. */
export type RowNumber = typeof RowNumber.Type

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
  rowNumber: RowNumber.annotateKey({ description: "The row number Excel shows, so 'row 56' on a screen is findable" }),
  cells: S.Array(StagedCell)
    .check(S.isMaxLength(maxColumns))
    .annotateKey({ description: `The row's cells, in the order of the file's columns: at most ${maxColumns}` })
}).annotate({ identifier: "StagedRow", description: "One data row of the file" })
/** The decoded value of `StagedRow`: one data row of the file. */
export type StagedRow = typeof StagedRow.Type

/** A column of the file: its position, Excel's letter and the heading as shown. */
export const StagedColumn = S.Struct({
  index: S.Int.check(S.isBetween({ minimum: 0, maximum: lastColumnIndex })).annotateKey({
    description: "The column's position in the file, from 0; never past Excel's last column, XFD",
    examples: [3]
  }),
  letter: S.String.check(S.isPattern(/^[A-Z]{1,3}$/)).annotateKey({
    description: "The column's letter in Excel: A, B, AA, one to three capitals",
    examples: ["D"]
  }),
  label: bounded(32767).annotateKey({ description: "The heading as the file shows it", examples: ["Unit"] })
}).annotate({
  identifier: "StagedColumn",
  description: "A column of the file: its position, Excel's letter and the heading as shown"
})
/** The decoded value of `StagedColumn`: a column of the file. */
export type StagedColumn = typeof StagedColumn.Type

/** Something the reader did, skipped or noticed, as the sentence it wrote. */
export const StagedNote = S.Struct({
  kind: S.String.check(S.isPattern(/^[a-z][A-Za-z0-9]{0,39}$/)).annotateKey({
    description:
      "What kind of note it is, as the reader names it: one word in camel case (blankRows). Not a closed list, so a note a later reader writes still stages",
    examples: ["blankRows"]
  }),
  level: S.Literals(["info", "warning"]).annotateKey({ description: "warning: something the person should look at" }),
  message: S.String.check(S.isMinLength(1), S.isMaxLength(4000)).annotateKey({
    description: "The sentence the reader wrote: never empty"
  }),
  rows: S.Array(RowNumber).check(S.isMaxLength(maxStagedRows)).annotateKey({
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
  headerRowNumber: RowNumber.annotateKey({
    description: "The row the headings are on, as Excel numbers it",
    examples: [1]
  }),
  columns: S.Array(StagedColumn)
    .check(S.isMinLength(1), S.isMaxLength(maxColumns))
    .annotateKey({ description: `The file's columns, in order: one to ${maxColumns}` }),
  rows: S.Array(StagedRow)
    .check(S.isMaxLength(maxStagedRows))
    .annotateKey({ description: `The data rows, in file order: at most ${maxStagedRows}` }),
  notes: S.Array(StagedNote)
    .check(S.isMaxLength(maxNotes))
    .annotateKey({ description: `What the reader did, skipped or noticed: at most ${maxNotes} notes` })
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
