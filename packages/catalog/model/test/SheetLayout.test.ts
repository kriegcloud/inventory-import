import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import {
  columnLetter,
  dateText,
  describeRows,
  describeWorkbook,
  emptyCell,
  numberText,
  type GridRow,
  type SheetGrid
} from "../src/Reading/SheetLayout.rules.ts"
import type { Cell } from "../src/Reading/Spreadsheet.rules.ts"

const t = (text: string): Cell => (text === "" ? emptyCell : { type: "text", text })
const n = (value: number): Cell => ({ type: "number", text: numberText(value) })
const grid = (rows: ReadonlyArray<ReadonlyArray<Cell>>, extra: Partial<SheetGrid> = {}): SheetGrid => ({
  rows: A.map(rows, (cells, i): GridRow => ({ rowNumber: i + 1, cells, hidden: false })),
  merges: [],
  hiddenColumns: [],
  ...extra
})
const sheet = (name: string, g: SheetGrid) => ({ name, visibility: "visible" as const, grid: g })
const items = grid([
  [t("SKU"), t("Qty")],
  [t("BRK-040"), n(12)],
  [t("FW-M8"), n(3)]
])

describe("numberText", () => {
  it("drops floating-point noise at Excel's 15 digits, never uses an exponent", () => {
    expect(numberText(0.1 + 0.2)).toBe("0.3")
    expect(numberText(12.5)).toBe("12.5")
    expect(numberText(450.00000000000006)).toBe("450")
    expect(numberText(1.005)).toBe("1.005")
    expect(numberText(123456789012345678)).toBe("123456789012346000")
    expect(numberText(0.0000001)).toBe("0.0000001")
    expect(numberText(-3)).toBe("-3")
    expect(numberText(-0)).toBe("0")
  })
})

describe("dateText", () => {
  it("is ISO 8601, with a time only when there is one", () => {
    expect(dateText({ day: 46085, y: 2026, m: 3, d: 4, H: 0, M: 0, S: 0 })).toBe("2026-03-04")
    expect(dateText({ day: 46085, y: 2026, m: 3, d: 4, H: 14, M: 30, S: 0 })).toBe("2026-03-04T14:30:00")
    expect(dateText({ day: 0, y: 1899, m: 12, d: 30, H: 7, M: 5, S: 9 })).toBe("07:05:09")
  })
})

describe("columnLetter and describeRows", () => {
  it("names columns and rows the way a person reads them", () => {
    expect(A.map([0, 25, 26, 27, 701, 702], columnLetter)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"])
    expect(describeRows([9])).toBe("row 9")
    expect(describeRows([9, 12])).toBe("rows 9 and 12")
    expect(describeRows([9, 12, 15, 20, 30])).toBe("rows 9, 12, 15 and 2 more")
  })
})

describe("describeWorkbook", () => {
  it.effect("skips an empty first sheet and says which sheet it read", () =>
    Effect.gen(function* () {
      const table = yield* describeWorkbook({
        fileName: "stock.xlsx",
        sheets: [sheet("Sheet1", grid([])), sheet("Items", items)],
        sheet: O.none(),
        notes: []
      })
      if (table.format._tag !== "xlsx") throw new Error("expected a workbook")
      expect(table.format.chosen).toMatchObject({
        name: "Items",
        position: 2,
        sheetCount: 2,
        reason: "onlySheetWithData",
        explanation: "It is the only sheet with data."
      })
    })
  )

  it.effect("prefers a wide table over a longer one-column notes sheet", () =>
    Effect.gen(function* () {
      const notes = grid(A.makeBy(5, (i) => [t(`Note ${i}`)]))
      const table = yield* describeWorkbook({
        fileName: "stock.xlsx",
        sheets: [sheet("Read me", notes), sheet("Items", items)],
        sheet: O.none(),
        notes: []
      })
      if (table.format._tag !== "xlsx") throw new Error("expected a workbook")
      expect(table.format.chosen).toMatchObject({
        name: "Items",
        reason: "mostData",
        explanation: 'It has the most data (3 rows, 2 columns). Another sheet also has data: "Read me" (5 rows).'
      })
    })
  )

  it.effect("flags a formula without a saved result, a hidden column and merged cells inside the data", () =>
    Effect.gen(function* () {
      const g = grid(
        [
          [t("Group"), t("SKU"), t("Qty")],
          [t("Fasteners"), t("HB-M8-30"), { type: "empty", text: "", formula: "=B2*2" }],
          [emptyCell, t("FW-M8"), n(3)]
        ],
        { hiddenColumns: [1], merges: [{ firstRow: 2, lastRow: 3, firstColumn: 0, lastColumn: 0 }] }
      )
      const table = yield* describeWorkbook({
        fileName: "x.xlsx",
        sheets: [sheet("S", g)],
        sheet: O.none(),
        notes: []
      })
      const kinds = A.map(table.notes, (note) => note.kind)
      expect(kinds).toEqual(["formulaWithoutResult", "hiddenColumns", "mergedCells"])
      expect(table.notes[0]?.message).toBe(
        "1 formula has no saved result (C2), so it reads as empty. Open the file in Excel, save it, and choose it again."
      )
      expect(table.notes[2]).toMatchObject({ level: "warning", rows: [2, 3] })
    })
  )

  it.effect("a one-column file still has a header", () =>
    Effect.gen(function* () {
      const table = yield* describeWorkbook({
        fileName: "skus.xlsx",
        sheets: [sheet("S", grid([[t("SKU")], [t("BRK-040")], [t("FW-M8")]]))],
        sheet: O.none(),
        notes: []
      })
      expect(table.headerRowNumber).toBe(1)
      expect(table.rows.length).toBe(2)
    })
  )
})
