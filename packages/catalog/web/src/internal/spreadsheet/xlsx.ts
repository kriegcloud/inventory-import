// .xlsx bytes -> the grid of one sheet, with @beep/xlsx. The upload screen runs this inside its own module worker.
// Every sheet is counted (the chooser lists each one's rows, and the sheet with the most data is read), and only
// the chosen sheet's rows are built. The package keeps each cell as the file holds it; here a cell becomes the
// app's `Cell`: its type, its text without coercion and the text Excel would display.
import { Xlsx } from "@beep/xlsx/Xlsx"
import { columnLetters } from "@beep/xlsx/XlsxAddress"
import { XlsxCell, XlsxNumberFormat, type XlsxValue } from "@beep/xlsx/XlsxCell"
import type { XlsxContainer } from "@beep/xlsx/XlsxDiagnostic"
import type { XlsxParseError } from "@beep/xlsx/XlsxError"
import { XlsxLimits, XlsxReadOptions } from "@beep/xlsx/XlsxOptions"
import { XlsxCalendar, type XlsxDateSystem } from "@beep/xlsx/XlsxSerial"
import type { XlsxRow } from "@beep/xlsx/XlsxWorkbook"
import * as A from "effect/Array"
import * as ByteSize from "effect/ByteSize"
import * as Effect from "effect/Effect"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as Stream from "effect/Stream"
import { type FileProblem, fileProblem } from "@inventory/catalog-contract/FileProblem"
import {
  dateText,
  describeSheets,
  emptyCell,
  numberText,
  type GridRow,
  type MergedRange
} from "@inventory/catalog-model/SheetLayout"
import { maxFileBytes, maxWorkbookInflatedBytes, type Cell, type Note } from "@inventory/catalog-model/Spreadsheet"
import type { ReadProgress } from "./read.ts"

const options = XlsxReadOptions.make({
  limits: XlsxLimits.make({
    maxInputBytes: ByteSize.bytes(maxFileBytes.xlsx),
    maxInflatedBytes: ByteSize.bytes(maxWorkbookInflatedBytes)
  })
})

const withShown = (cell: Cell, shown: O.Option<string>, formula: O.Option<string>): Cell => {
  const display = O.filter(shown, (text) => text !== cell.text)
  return {
    ...cell,
    ...(O.isSome(display) ? { shown: display.value } : {}),
    ...(O.isSome(formula) ? { formula: `=${formula.value}` } : {})
  }
}

/** One cell of the package as the app's cell: its type, its text without coercion, and its displayed text. */
const toCell = (cell: XlsxRow["cells"][number], system: XlsxDateSystem): Cell => {
  const value: XlsxValue = cell.value
  switch (value.kind) {
    case "Text":
      return withShown(value.text === "" ? emptyCell : { type: "text", text: value.text }, O.none(), cell.formula)
    case "Boolean":
      return withShown({ type: "boolean", text: value.value ? "TRUE" : "FALSE" }, O.none(), cell.formula)
    case "Error":
      return withShown({ type: "error", text: value.code }, O.none(), cell.formula)
    case "Number":
      return withShown({ type: "number", text: numberText(value.value) }, XlsxCell.shown(cell, system), cell.formula)
    case "Date": {
      const at = XlsxCalendar.fromSerial(value.serial, system)
      const text = dateText({
        day: Math.floor(value.serial),
        y: at.year,
        m: at.month,
        d: at.day,
        H: at.hour,
        M: at.minute,
        S: at.second
      })
      return withShown({ type: "date", text }, XlsxCell.shown(cell, system), cell.formula)
    }
    case "Blank":
    case "Unreadable":
      return withShown(emptyCell, O.none(), cell.formula)
  }
}

/** Why the package stopped, as the problem the person is told. */
const problemOf = (fileName: string, bytes: number, error: XlsxParseError): FileProblem => {
  const finding = error.fatal.finding
  if (finding.kind === "LimitExceeded" && finding.limit === "inputBytes") {
    return fileProblem.tooManyBytes({ fileName, bytes, limitBytes: maxFileBytes.xlsx, what: "workbooks" })
  }
  if (finding.kind === "LimitExceeded" && (finding.limit === "inflatedBytes" || finding.limit === "partBytes")) {
    return fileProblem.unreadable({
      fileName,
      why: `: it unpacks to more than ${Math.round(maxWorkbookInflatedBytes / (1024 * 1024))} MB`,
      todo: "Split it into smaller files, or delete sheets and columns that are not needed, and choose it again."
    })
  }
  return fileProblem.unreadable({ fileName, why: ": it looks damaged or incomplete" })
}

/**
 * What an archive is, from its first bytes and the names inside: a workbook this reader takes, or which other kind of
 * file. Asked only of a file that starts as a zip archive or an older Office file does.
 */
export const containerOf = (bytes: Uint8Array): XlsxContainer => Xlsx.container(bytes)

/** Rows between two progress reports while a sheet's grid is built. */
const reportEvery = 2000

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
const listed = (items: ReadonlyArray<string>, limit = 5): string =>
  items.length <= limit ? A.join(items, ", ") : `${A.join(A.take(items, limit), ", ")} and ${items.length - limit} more`

/** Reads a workbook the person chose into a table from one sheet (`sheet`, or the one with the most data). */
export const readXlsx = Effect.fn("readXlsx")(function* (input: {
  fileName: string
  bytes: Uint8Array
  sheet: O.Option<string>
  notes: ReadonlyArray<Note>
  onProgress?: (progress: ReadProgress) => void
}) {
  const { fileName, bytes } = input
  const failed = (error: XlsxParseError): FileProblem => problemOf(fileName, bytes.length, error)
  const outline = yield* Effect.mapError(Xlsx.outline(bytes, options), failed)
  const system = outline.dateSystem
  return yield* describeSheets({
    fileName,
    sheets: A.map(outline.sheets, (sheet) => ({
      name: sheet.count.info.name,
      visibility: sheet.count.info.state,
      rowCount: sheet.count.rowsWithValues,
      filledCells: sheet.count.cellsWithValues
    })),
    sheet: input.sheet,
    notes: input.notes,
    grid: Effect.fnUntraced(function* (index: number) {
      const sheet = outline.sheets[index]
      if (sheet === undefined) return yield* Effect.die("sheet index out of range")
      const total = sheet.count.rows
      const kept: Array<XlsxRow> = []
      let lastColumn = -1
      let lastRow = 0
      yield* Xlsx.rows(bytes, sheet.count.info.name, options).pipe(
        Stream.mapError(failed),
        Stream.runForEach((row) =>
          Effect.sync(() => {
            kept.push(row)
            const last = row.cells[row.cells.length - 1]
            if (last !== undefined) {
              lastRow = Math.max(lastRow, row.number)
              lastColumn = Math.max(lastColumn, last.column)
            }
            if (kept.length % reportEvery === 0) {
              input.onProgress?.({ rowsRead: kept.length, rowsAbout: total, exact: true })
            }
          })
        )
      )
      input.onProgress?.({ rowsRead: total, rowsAbout: total, exact: true })
      // The grid runs from A1 to the last cell the sheet writes, whatever extent the file declares for itself.
      const width = lastColumn + 1
      const blank = (): Array<Cell> => A.makeBy(width, () => emptyCell)
      const rows: Array<GridRow> = A.makeBy(lastRow, (i) => ({ rowNumber: i + 1, cells: blank(), hidden: false }))
      const filled = MutableHashMap.empty<number, true>()
      const unreadable: Array<string> = []
      const unreadableRows: Array<number> = []
      const notShown = MutableHashMap.empty<string, number>()
      for (const row of kept) {
        if (row.number > lastRow || MutableHashMap.has(filled, row.number)) continue
        MutableHashMap.set(filled, row.number, true)
        const cells = blank()
        for (const cell of row.cells) {
          cells[cell.column] = toCell(cell, system)
          if (cell.value.kind === "Unreadable") {
            unreadable.push(`${columnLetters(cell.column)}${row.number}`)
            if (!A.contains(unreadableRows, row.number)) unreadableRows.push(row.number)
          } else if (
            (cell.value.kind === "Number" || cell.value.kind === "Date") &&
            O.isNone(XlsxCell.shown(cell, system)) &&
            XlsxNumberFormat.kind(cell.format).kind !== "General"
          ) {
            const code = cell.format.code
            MutableHashMap.set(notShown, code, O.getOrElse(MutableHashMap.get(notShown, code), () => 0) + 1)
          }
        }
        rows[row.number - 1] = { rowNumber: row.number, cells, hidden: row.hidden }
      }
      const notes: Array<Note> = []
      if (unreadable.length > 0) {
        notes.push({
          kind: "unreadableCells",
          level: "warning",
          message: `${plural(unreadable.length, "cell", "cells")} could not be read and ${unreadable.length === 1 ? "was" : "were"} left empty: ${listed(unreadable)}. The file itself holds no usable value there; open it in Excel and retype ${unreadable.length === 1 ? "it" : "them"} if ${unreadable.length === 1 ? "it matters" : "they matter"}.`,
          rows: unreadableRows
        })
      }
      for (const [code, cells] of notShown) {
        notes.push({
          kind: "formatNotShown",
          level: "info",
          message: `${plural(cells, "cell has", "cells have")} the number format ${code}, which is not shown here as Excel shows it; the stored ${cells === 1 ? "value was" : "values were"} read.`,
          rows: []
        })
      }
      const merges: Array<MergedRange> = A.map(sheet.merges, (range) => ({
        firstRow: range.first.row,
        lastRow: range.last.row,
        firstColumn: range.first.column,
        lastColumn: range.last.column
      }))
      return { grid: { rows, merges, hiddenColumns: sheet.hiddenColumns }, notes }
    })
  })
})
