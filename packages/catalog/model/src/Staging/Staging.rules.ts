// Staging a file that was read: the reader's table trimmed to what the review needs, and the two reasons a table is
// not staged at all (no rows, too many).
/**
 * Trims the reader's table to what the server stages. Nothing is coerced: each cell keeps its stored text, and
 * what Excel displays when that differs.
 */
import { SpreadsheetTable } from "../Reading/Spreadsheet.rules.ts"
import { StagedTable, maxColumns, maxNotes, maxStagedRows } from "@inventory/catalog-contract/Staged"
import * as A from "effect/Array"
import * as Match from "effect/Match"
import * as O from "effect/Option"
import { FileProblem, fileProblem } from "@inventory/catalog-contract/FileProblem"
export const stageTable = (input: { readonly table: SpreadsheetTable }): StagedTable => {
  const { table } = input
  return {
    fileName: table.fileName,
    kind: table.kind,
    sheet: Match.valueTags(table.format, {
      xlsx: (format) => O.some(format.chosen.name),
      csv: () => O.none<string>()
    }),
    headerRowNumber: table.headerRowNumber,
    columns: A.map(table.columns, (column) => ({ index: column.index, letter: column.letter, label: column.label })),
    rows: A.map(table.rows, (row) => ({
      rowNumber: row.rowNumber,
      cells: A.map(row.cells, (cell) =>
        cell.shown === undefined || cell.shown === cell.text
          ? { text: cell.text }
          : { text: cell.text, shown: cell.shown }
      )
    })),
    notes: keptNotes(table.notes)
  }
}

/**
 * The reader's notes as staged: all of them when they fit `maxNotes`. Past it, they are kept in three tiers, each in
 * the reader's order: the warnings (a total row, a second table, a hidden sheet; the review reads the total row's),
 * then the information notes on how the sheet was laid out (rows above the heading, blank rows), then those on a
 * number format Excel shows another way, which a workbook can have thousands of. One more note says how many were not
 * kept. It is a warning when a warning was among them, so the person is shown it on the Review step; else it is
 * information, as the notes it counts were.
 *
 * @example keptNotes(notes).length // at most maxNotes
 */
const keptNotes = (notes: SpreadsheetTable["notes"]): StagedTable["notes"] => {
  const staged = A.map(notes, (note) => ({
    kind: note.kind,
    level: note.level,
    message: note.message,
    rows: note.rows
  }))
  if (staged.length <= maxNotes) return staged
  const warnings = A.filter(staged, isWarning)
  const room = maxNotes - 1
  const kept = A.take(
    [
      ...warnings,
      ...A.filter(staged, (note) => !isWarning(note) && !isFormatNote(note)),
      ...A.filter(staged, (note) => !isWarning(note) && isFormatNote(note))
    ],
    room
  )
  const left = staged.length - kept.length
  const warningsLeft = warnings.length - A.filter(kept, isWarning).length
  return A.append(
    kept,
    warningsLeft > 0
      ? {
          kind: "notesNotKept",
          level: "warning",
          message: `${left} more notes about how the file was read were not kept, ${warningsLeft} of them warnings: look the file over in Excel before importing it.`,
          rows: []
        }
      : {
          kind: "notesNotKept",
          level: "info",
          message: `${left} more notes about how the file was read were not kept.`,
          rows: []
        }
  )
}

const isWarning = (note: { readonly level: "info" | "warning" }): boolean => note.level === "warning"

// The reader writes one of these for each number format Excel shows another way: the notes a file can have most of.
const isFormatNote = (note: { readonly kind: string }): boolean => note.kind === "formatNotShown"

/**
 * Why a file cannot be staged, as a `FileProblem` for the person, or null when it can. It takes counts, not rows, so
 * the reader asks before anything is sent, the server asks again when an upload begins (before any row arrives) and
 * once more when it finishes, and the words are the same wherever it is refused.
 *
 * @example stagingProblem({ fileName: "items.csv", rowCount: 50001, columnCount: 10 })?.problem
 * // '"items.csv" has 50001 rows. Up to 50000 can be imported at a time.'
 */
export const stagingProblem = (input: {
  readonly fileName: string
  readonly rowCount: number
  readonly columnCount: number
}): FileProblem | null => {
  const { fileName, rowCount, columnCount } = input
  if (rowCount <= 0) return fileProblem.noRows({ fileName })
  if (rowCount > maxStagedRows) return fileProblem.tooManyRows({ fileName, rows: rowCount, limit: maxStagedRows })
  if (columnCount > maxColumns) return fileProblem.tooManyColumns({ fileName, columns: columnCount })
  return null
}

/**
 * The reader's Notes the person is shown on the Review step before they import: the warnings. A warning says the
 * reader could not take the file at its word (a cell it could not read, a quote in an odd place, a hidden sheet
 * with data); an information Note says how the file was read and stays behind the Activity button. Benjamin's
 * decision "where a reader's warning shows": the rows' outcomes and counts are not changed by a warning.
 *
 * @example readerWarnings({ notes: [{ kind: "delimiter", level: "info", message: "Columns are separated by tabs.", rows: [] }] }) // []
 */
export const readerWarnings = (table: Pick<StagedTable, "notes">): ReadonlyArray<StagedTable["notes"][number]> =>
  A.filter(table.notes, isWarning)
