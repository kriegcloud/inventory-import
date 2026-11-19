// What reading an uploaded spreadsheet (.csv or .xlsx) produces. Every way it can fail is a `FileProblem`
// (FileProblem.ts): what is wrong with the file and what to do, data the screen shows.
// The rule this file protects: nothing in a file is coerced on the way in. A cell keeps its own text and says what
// type it was in the file; anything the reader skipped or noticed is a Note the screen can show, never a console line.

import * as S from "effect/Schema"

/** The two formats the importer reads. `.xls` (Excel 97-2003) is refused with a way out (`fileProblem.oldExcel`). */
export const FileKind = S.Literals(["csv", "xlsx"]).annotate({
  description: "The file's format, from its contents rather than its name: csv or xlsx."
})
/** One of the two `FileKind` names. */
export type FileKind = typeof FileKind.Type

/**
 * What a cell was in the file. A CSV has no types, so its cells are `text` or `empty`; a workbook's cells keep the
 * type the spreadsheet stored. The app decides what a text "12" means, never the reader.
 */
export const CellType = S.Literals(["text", "number", "date", "boolean", "empty", "error"]).annotate({
  description: "What the cell was in the file. A CSV's cells are text or empty; a workbook keeps its stored type."
})
/** One of the `CellType` names. */
export type CellType = typeof CellType.Type

/** One cell, as the file holds it. A plain struct, not a class: a 50,000-row file has hundreds of thousands. */
export const Cell = S.Struct({
  type: CellType,
  text: S.String.annotateKey({
    description:
      "The value as text, with nothing coerced. text: exactly as stored, spaces kept. number: plain decimal at the " +
      "15 significant digits Excel keeps, no exponent and no floating-point noise (0.1+0.2 is 0.3, 12.5 stays 12.5). " +
      "date: ISO 8601 from the stored date value, so day and month are never guessed (2026-03-04, 2026-03-04T14:30:00, " +
      "or 14:30:00 for a time alone). boolean: TRUE or FALSE. error: the spreadsheet's code (#N/A). empty: ''."
  }),
  shown: S.optionalKey(S.String).annotateKey({
    description:
      "What the spreadsheet displays with the cell's number format ($12.50, 00123, 3/4/2026), when that differs " +
      "from text. Workbooks only. Use it for codes: a SKU stored as 123 with format 00000 is shown as 00123."
  }),
  formula: S.optionalKey(S.String).annotateKey({
    description: "The cell's formula (=C5*D5) when it has one. `text` is the result the file stored for it."
  })
}).annotate({
  description: "One cell as the file holds it: its type, its text with nothing coerced, and how it shows."
})
/** A decoded `Cell`, as the reader hands it to the review. */
export type Cell = typeof Cell.Type

/** A column of the table, named by the header row. Columns are positions; two may share a name. */
export const Column = S.Struct({
  index: S.Int.annotateKey({ description: "Zero-based position among the table's columns." }),
  letter: S.String.annotateKey({
    description: "The spreadsheet's own column letter (C), so a message can say where."
  }),
  header: S.String.annotateKey({ description: "The header cell's text exactly as found, spaces kept; '' if empty." }),
  label: S.String.annotateKey({
    description:
      "A name to show: the header trimmed, 'Column D' when it is empty, and 'Quantity (column E)' for the second of " +
      "two columns with the same name. Unique within the table."
  })
}).annotate({ description: "A column of the table: where it is in the file, its header as found, and a unique label." })
/** A decoded `Column`. Match columns by `label` or position, never by `header`, which may repeat or be empty. */
export type Column = typeof Column.Type

/** A non-empty cell outside the named columns, kept so nothing in the file disappears. */
export const ExtraCell = S.Struct({
  letter: S.String.annotateKey({
    description: "The spreadsheet's column letter of the cell (H), past the last named column."
  }),
  cell: Cell
}).annotate({ description: "A non-empty cell to the right of the named columns, kept so nothing in the file is lost." })
/** A decoded `ExtraCell`. */
export type ExtraCell = typeof ExtraCell.Type

/** One data row. Blank rows are not rows; they are listed in a Note. */
export const Row = S.Struct({
  rowNumber: S.Int.annotateKey({
    description:
      "The row number the person sees when they open the file in Excel, so 'row 56' in a message is findable. For a " +
      "CSV it counts items: a line break inside quotes stays in its row, as Excel shows it."
  }),
  cells: S.Array(Cell).annotateKey({ description: "One cell per column, in column order." }),
  extra: ExtraCell.pipe(S.Array, S.optionalKey).annotateKey({
    description: "Non-empty cells beyond the named columns, when the row has any."
  }),
  hidden: S.optionalKey(S.Boolean).annotateKey({ description: "True when the row is hidden in Excel." })
}).annotate({ description: "One data row, numbered as the person sees it in Excel, with one cell per column." })
/** A decoded `Row`. Cite `rowNumber` in every message about it, so the person can find it in their file. */
export type Row = typeof Row.Type

/** A sheet of a workbook, for the sheet chooser. */
export const SheetSummary = S.Struct({
  name: S.String,
  position: S.Int.annotateKey({ description: "1-based position among the workbook's sheets, hidden ones included." }),
  visibility: S.Literals(["visible", "hidden", "veryHidden"]).annotateKey({
    description: "veryHidden sheets are not listed by Excel's Unhide; only a macro shows them."
  }),
  rowCount: S.Int.annotateKey({ description: "Rows with at least one non-empty cell, title rows included." })
}).annotate({ description: "One sheet of a workbook, as the sheet chooser lists it." })
/** A decoded `SheetSummary`. */
export type SheetSummary = typeof SheetSummary.Type

/** Which sheet the table came from and why, stated so the choice is never silent. */
export const SheetChoice = S.Struct({
  name: S.String,
  position: S.Int.annotateKey({
    description: "1-based position of the chosen sheet among all the workbook's sheets."
  }),
  sheetCount: S.Int.annotateKey({ description: "How many sheets the workbook has, hidden ones included." }),
  reason: S.Literals(["onlySheetWithData", "mostData", "chosenByPerson", "onlyHiddenSheetsHaveData"]).annotateKey({
    description:
      "Why this sheet: the only one with data, the one with the most, the person's choice, or only hidden ones had data."
  }),
  explanation: S.String.annotateKey({ description: "One sentence for the screen: why this sheet." })
}).annotate({ description: "Which sheet the table came from and why, so the choice is never silent." })
/** A decoded `SheetChoice`. */
export type SheetChoice = typeof SheetChoice.Type

/** How a CSV was read. */
export const CsvFormat = S.TaggedStruct("csv", {
  delimiter: S.Literals([",", ";", "\t", "|"]).annotateKey({ description: "The separator found in the file." }),
  encoding: S.Literals(["utf-8", "windows-1252"]).annotateKey({
    description: "windows-1252 only when the bytes are not valid UTF-8; a Note then asks the person to check accents."
  })
}).annotate({ description: "How a CSV was read: its separator and its text encoding." })

/** How a workbook was read: every sheet, and the one the table came from. */
export const WorkbookFormat = S.TaggedStruct("xlsx", {
  sheets: S.Array(SheetSummary),
  chosen: SheetChoice
}).annotate({ description: "How a workbook was read: every sheet, and which one the table came from and why." })

/** What kind of thing a Note reports. The screen may group or filter by it. */
export const NoteKind = S.Literals([
  "rowsAboveHeader",
  "blankRows",
  "secondTable",
  "totalRow",
  "duplicateHeader",
  "emptyHeader",
  "headerSpaces",
  "cellSpaces",
  "shortRows",
  "extraCells",
  "formulas",
  "formulaWithoutResult",
  "errorCells",
  "unreadableCells",
  "formatNotShown",
  "dates",
  "leadingZeros",
  "longNumbers",
  "mergedCells",
  "hiddenRows",
  "hiddenColumns",
  "hiddenSheets",
  "delimiter",
  "notUtf8",
  "strayQuote",
  "wrongExtension"
]).annotate({ description: "What a Note is about, so the screen can group or filter notes." })
/** One of the `NoteKind` names. */
export type NoteKind = typeof NoteKind.Type

/** Something the reader did, skipped or noticed, in a sentence the person can act on. */
export const Note = S.Struct({
  kind: NoteKind,
  level: S.Literals(["info", "warning"]).annotateKey({
    description: "warning: the person should look before importing. info: how the file was read."
  }),
  message: S.String.annotateKey({ description: "One sentence for the screen, written for the person." }),
  rows: S.Array(S.Int).annotateKey({ description: "The row numbers it concerns (as in Excel), if any." })
}).annotate({ description: "Something the reader did, skipped or noticed, in a sentence the person can act on." })
/** A decoded `Note`. */
export type Note = typeof Note.Type

/**
 * An uploaded file read into one table: the shape the rest of the app imports from, whatever the format.
 * `rows.length` plus the blank rows, title rows and second-table rows named in `notes` accounts for every row.
 */
export const SpreadsheetTable = S.Struct({
  fileName: S.String,
  kind: FileKind,
  format: S.Union([CsvFormat, WorkbookFormat]),
  headerRowNumber: S.Int.annotateKey({ description: "The row the column names were found on, as in Excel." }),
  columns: S.Array(Column),
  rows: S.Array(Row),
  notes: S.Array(Note)
}).annotate({ description: "An uploaded file read into one table, whatever its format: columns, rows and notes." })
/** A decoded `SpreadsheetTable`: what the review receives. */
export type SpreadsheetTable = typeof SpreadsheetTable.Type

/**
 * The largest file the browser reads, per format. Measured in Node 26 (vitest) on a 7-column stock export: 50,000
 * rows are 3.3 MB as CSV (read in 0.06 s, about 52 MB of heap at the peak) and 2.1 MB as .xlsx (0.73 s, about
 * 180 MB). A workbook costs about ten times more per row, so its limit is lower. At the limits, by the same
 * measure: 10 MB of CSV is about 150,000 such rows (about 0.2 s, 160 MB) and 3 MB of .xlsx about 70,000 (about 1.1 s,
 * 260 MB), estimated linearly from the 50,000-row runs, not measured. Over the limit the person
 * is told to split the file (a `FileProblem` of kind `tooLarge`), before anything is parsed.
 */
export const maxFileBytes = { csv: 10 * 1024 * 1024, xlsx: 3 * 1024 * 1024 } as const

/**
 * The most a workbook may unpack to. A workbook is a compressed archive, and a small one can be built to unpack
 * without end; an honest file under the size limit is far below this (50,000 rows by 15 columns unpack to 28 MB).
 * Benjamin's decision X5: "Keep 3 MiB, cap 64 MiB inflated".
 */
export const maxWorkbookInflatedBytes = 64 * 1024 * 1024
