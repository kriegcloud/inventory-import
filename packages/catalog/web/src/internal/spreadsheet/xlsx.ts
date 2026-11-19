// .xlsx bytes -> one grid per sheet, with SheetJS CE (the 0.20.3 "mini" build: XLSX and CSV only, 279 KB).
// Chosen over read-excel-file 9.3.15, whose every entry point starts a blob: Worker for sheets over 512 KiB (blocked
// by our content security policy, and the read then never finishes) and which turns error cells into empty ones.
// SheetJS keeps each cell's type, number format, formula and error code, and reports hidden sheets, rows, columns
// and merged cells. It starts no worker and uses no eval; the upload screen runs it inside its own module worker
// (packages/catalog/web/src/Upload.controller.ts), a file from our own origin.
import { Effect, Option } from "effect"
import { read, SSF, type CellObject, type WorkSheet } from "xlsx/dist/xlsx.mini.min.js"
import {
  dateText,
  describeWorkbook,
  emptyCell,
  numberText,
  type GridRow,
  type MergedRange,
  type WorkbookSheet
} from "@inventory/catalog-model/SheetLayout"
import { fileProblem } from "@inventory/catalog-contract/FileProblem"
import type { Cell, Note } from "@inventory/catalog-model/Spreadsheet"
import type { ReadProgress } from "./read.ts"

interface DateCode {
  D: number
  y: number
  m: number
  d: number
  H: number
  M: number
  S: number
}
const ssf = SSF as {
  is_date: (format: string) => boolean
  parse_date_code: (value: number, options: { date1904: boolean }) => DateCode | null
}

const withShown = (cell: Cell, shown: string | undefined): Cell =>
  shown === undefined || shown === cell.text ? cell : { ...cell, shown }

/** One SheetJS cell as the file holds it: its type, its text without coercion, and its displayed text. */
const toCell = (raw: CellObject | undefined, date1904: boolean): Cell => {
  if (raw === undefined) return emptyCell
  const formula = raw.f === undefined ? {} : { formula: `=${raw.f}` }
  switch (raw.t) {
    case "s": {
      const text = String(raw.v ?? "")
      return text === "" ? { type: "empty", text: "", ...formula } : { type: "text", text, ...formula }
    }
    case "b":
      return { type: "boolean", text: raw.v === true ? "TRUE" : "FALSE", ...formula }
    case "e":
      return { type: "error", text: raw.w ?? "#ERROR", ...formula }
    case "n": {
      const value = typeof raw.v === "number" ? raw.v : Number(raw.v)
      if (typeof raw.z === "string" && ssf.is_date(raw.z)) {
        const code = ssf.parse_date_code(value, { date1904 })
        if (code !== null) {
          const text = dateText({
            day: Math.floor(value),
            y: code.y,
            m: code.m,
            d: code.d,
            H: code.H,
            M: code.M,
            S: code.S
          })
          return withShown({ type: "date", text, ...formula }, raw.w)
        }
      }
      return withShown({ type: "number", text: numberText(value), ...formula }, raw.w)
    }
    case "d":
      // Only when a file stores an ISO date string (t="d"); SheetJS hands it over as a Date at UTC midnight.
      if (!(raw.v instanceof Date)) return { type: "text", text: String(raw.w ?? raw.v ?? ""), ...formula }
      return withShown(
        {
          type: "date",
          text: dateText({
            day: 1,
            y: raw.v.getUTCFullYear(),
            m: raw.v.getUTCMonth() + 1,
            d: raw.v.getUTCDate(),
            H: raw.v.getUTCHours(),
            M: raw.v.getUTCMinutes(),
            S: raw.v.getUTCSeconds()
          }),
          ...formula
        },
        raw.w
      )
    default:
      return { type: "empty", text: "", ...formula }
  }
}

/** The rows a sheet's grid will have: up to its last used row, as its `!ref` says. */
const lastRowOf = (sheet: WorkSheet | undefined): number => {
  const end = /([A-Z]+)(\d+)$/.exec(sheet?.["!ref"] ?? "")
  return end === null ? 0 : Number(end[2])
}

/** Rows between two progress reports while a sheet's grid is built. */
const reportEvery = 2000

/**
 * A worksheet as a grid: every row from 1 to the last used row, every column from A to the last used column.
 * `onRow` hears how many rows are done, every few thousand, out of how many.
 */
const toGrid = (
  sheet: WorkSheet | undefined,
  date1904: boolean,
  onRow: (done: number, of: number) => void = () => {}
): WorkbookSheet["grid"] => {
  const ref = sheet?.["!ref"]
  if (sheet === undefined || ref === undefined) return { rows: [], merges: [], hiddenColumns: [] }
  const [, endRef = ref] = ref.split(":")
  const end = /^([A-Z]+)(\d+)$/.exec(endRef)
  const lastColumn = end === null ? 0 : [...(end[1] ?? "A")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
  const lastRow = end === null ? 0 : Number(end[2]) - 1
  const data = sheet["!data"] ?? []
  const rowInfo = sheet["!rows"] ?? []
  const rows: Array<GridRow> = []
  for (let r = 0; r <= lastRow; r++) {
    const source = data[r] ?? []
    const cells: Array<Cell> = []
    for (let c = 0; c <= lastColumn; c++) cells.push(toCell(source[c], date1904))
    rows.push({ rowNumber: r + 1, cells, hidden: rowInfo[r]?.hidden === true })
    if ((r + 1) % reportEvery === 0) onRow(r + 1, lastRow + 1)
  }
  onRow(lastRow + 1, lastRow + 1)
  const merges: Array<MergedRange> = (sheet["!merges"] ?? []).map((m) => ({
    firstRow: m.s.r + 1,
    lastRow: m.e.r + 1,
    firstColumn: m.s.c,
    lastColumn: m.e.c
  }))
  const hiddenColumns = (sheet["!cols"] ?? []).flatMap((col, c) => (col?.hidden === true ? [c] : []))
  return { rows, merges, hiddenColumns }
}

/** Reads a workbook the person chose into a table from one sheet (`sheet`, or the one with the most data). */
export const readXlsx = Effect.fn("readXlsx")(function* (input: {
  fileName: string
  bytes: Uint8Array
  sheet: Option.Option<string>
  notes: ReadonlyArray<Note>
  onProgress?: (progress: ReadProgress) => void
}) {
  const workbook = yield* Effect.try({
    // cellStyles is needed for hidden rows and columns; cellNF keeps number formats (dates, leading zeros).
    try: () =>
      read(input.bytes, {
        type: "array",
        dense: true,
        cellFormula: true,
        cellNF: true,
        cellStyles: true,
        cellDates: false
      }),
    catch: () => fileProblem.unreadable({ fileName: input.fileName, why: ": it looks damaged or incomplete" })
  })
  const date1904 = workbook.Workbook?.WBProps?.date1904 === true
  // Every sheet is laid out (the chooser shows each one's rows), so progress counts the rows of all of them.
  const totalRows = workbook.SheetNames.reduce((sum, name) => sum + lastRowOf(workbook.Sheets[name]), 0)
  let before = 0
  const sheets: Array<WorkbookSheet> = workbook.SheetNames.map((name, i) => {
    const hidden = workbook.Workbook?.Sheets?.[i]?.Hidden
    const grid = toGrid(workbook.Sheets[name], date1904, (done) =>
      input.onProgress?.({ rowsRead: before + done, rowsAbout: totalRows, exact: true })
    )
    before += grid.rows.length
    return { name, visibility: hidden === 1 ? "hidden" : hidden === 2 ? "veryHidden" : "visible", grid }
  })
  return yield* describeWorkbook({ fileName: input.fileName, sheets, sheet: input.sheet, notes: input.notes })
})
