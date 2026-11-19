// @effect-diagnostics nodeBuiltinImport:off
// The workbook reader over @beep/xlsx against the SheetJS reader it replaces, both run here: on every fixture and
// every sheet of it, on files built by hand, and on workbooks SheetJS writes from generated tables. This file goes
// when the SheetJS reader does; xlsxParity.test.ts keeps the comparison against its recorded tables.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema as S } from "effect"
import * as Arbitrary from "effect/Arbitrary"
import { utils, write, type CellObject } from "xlsx/dist/xlsx.mini.min.js"
import { readWorkbook } from "../src/internal/spreadsheet/workbook.ts"
import { readXlsx } from "../src/internal/spreadsheet/xlsx.ts"
import { builtCases, fixtureNames, lyingExtent } from "./xlsxCorpus.ts"

const bytesOf = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`./fixtures/spreadsheet/${name}`, import.meta.url)))

const both = (fileName: string, bytes: Uint8Array, sheet: Option.Option<string>) =>
  Effect.all(
    [
      Effect.result(readXlsx({ fileName, bytes, sheet, notes: [] })),
      Effect.result(readWorkbook({ fileName, bytes, sheet, notes: [] }))
    ],
    { concurrency: 1 }
  )

describe("the new workbook reader reads what the old one read", () => {
  for (const name of fixtureNames) {
    it.effect(name, () =>
      Effect.gen(function* () {
        const bytes = bytesOf(name)
        const [old, next] = yield* both(name, bytes, Option.none())
        expect(next).toEqual(old)
        const sheets = old._tag === "Success" && old.success.format._tag === "xlsx" ? old.success.format.sheets : []
        for (const sheet of sheets) {
          const [oldSheet, nextSheet] = yield* both(name, bytes, Option.some(sheet.name))
          expect([sheet.name, nextSheet]).toEqual([sheet.name, oldSheet])
        }
        expect(Arr.length(sheets)).toBeGreaterThanOrEqual(old._tag === "Success" ? 1 : 0)
      })
    )
  }
})

describe("on files built by hand", () => {
  for (const item of builtCases(bytesOf)) {
    it.effect(item.name, () =>
      Effect.gen(function* () {
        const bytes = yield* item.bytes
        const [old, next] = yield* both(`${item.name}.xlsx`, bytes, item.sheet)
        expect(next).toEqual(old)
      })
    )
  }

  // The one place the two readers differ on purpose. The old reader took a sheet's declared extent as the truth and
  // dropped every cell outside it without a word; the new one reads the cells the sheet holds.
  it.effect("a declared extent that leaves rows out: the old reader lost them, the new one reads them", () =>
    Effect.gen(function* () {
      const bytes = yield* lyingExtent
      const [old, next] = yield* both("lying.xlsx", bytes, Option.none())
      const numbers = (read: typeof old) =>
        read._tag === "Success" ? Arr.map(read.success.rows, (row) => row.rowNumber) : []
      expect(numbers(old)).toEqual([2, 3])
      expect(numbers(next)).toEqual([2, 3, 4, 5])
    })
  )
})

// Workbooks SheetJS writes from generated tables, as a stock export would look: a heading row, then rows of text,
// numbers, dates and formulas under the formats decision X3 covers, with hidden rows, merged cells, a second sheet
// and either date system. Numbers are whole or of two decimals, and times are whole seconds: on a rounding tie and
// on a time that rounds up to midnight the old reader's displayed text was wrong (see @beep/xlsx's oracle test).
const cents = (maximum: number) => S.Int.check(S.isBetween({ minimum: -maximum, maximum }))
const Value = S.Union([
  S.Struct({ kind: S.tag("text"), text: S.String.check(S.isPattern(/^[ -~]{0,24}$/)) }),
  S.Struct({ kind: S.tag("code"), digits: S.String.check(S.isPattern(/^[0-9]{1,13}$/)) }),
  S.Struct({ kind: S.tag("number"), cents: cents(99_999_999), format: S.Literals(["General", "0.00", "$#,##0.00"]) }),
  S.Struct({
    kind: S.tag("whole"),
    value: S.Int.check(S.isBetween({ minimum: 0, maximum: 999_999 })),
    format: S.Literals(["General", "#,##0", "0%", "00000"])
  }),
  S.Struct({ kind: S.tag("float"), value: S.Finite.check(S.isBetween({ minimum: -1e12, maximum: 1e12 })) }),
  S.Struct({
    kind: S.tag("date"),
    day: S.Int.check(S.isBetween({ minimum: 1, maximum: 70_000 })),
    seconds: S.Int.check(S.isBetween({ minimum: 0, maximum: 86_399 })),
    format: S.Literals(["yyyy-mm-dd", "m/d/yy", "m/d/yy h:mm", "h:mm:ss"])
  }),
  S.Struct({ kind: S.tag("boolean"), value: S.Boolean }),
  S.Struct({ kind: S.tag("formula"), cents: S.Int.check(S.isBetween({ minimum: 0, maximum: 9_999_999 })) }),
  S.Struct({ kind: S.tag("empty") })
])
const Book = S.Struct({
  date1904: S.Boolean,
  rows: S.Array(S.Array(Value).check(S.isMinLength(4), S.isMaxLength(4))).check(S.isMaxLength(12)),
  hiddenRow: S.Int.check(S.isBetween({ minimum: 0, maximum: 12 })),
  merge: S.Boolean,
  second: S.Literals(["none", "visible", "hidden", "veryHidden"]),
  headings: S.Boolean
})

const cellOf = (value: typeof Value.Type): CellObject | undefined => {
  switch (value.kind) {
    case "text":
      return { t: "s", v: value.text }
    case "code":
      return { t: "s", v: value.digits }
    case "number":
      return { t: "n", v: value.cents / 100, z: value.format }
    case "whole":
      return { t: "n", v: value.value, z: value.format }
    case "float":
      return { t: "n", v: value.value }
    case "date": {
      const dayOnly = value.format === "yyyy-mm-dd" || value.format === "m/d/yy"
      return { t: "n", v: dayOnly ? value.day : value.day + value.seconds / 86_400, z: value.format }
    }
    case "boolean":
      return { t: "b", v: value.value }
    case "formula":
      return { t: "n", v: value.cents / 100, f: `${value.cents}/100`, z: "0.00" }
    case "empty":
      return undefined
  }
}

describe("on workbooks SheetJS writes from generated tables", () => {
  it.effect.prop(
    "the same table and the same sheet list, whichever sheet is chosen",
    [Arbitrary.schema(Book)],
    ([book]) =>
      Effect.gen(function* () {
        const headings: Array<CellObject> = Arr.map(["SKU", "Name", "Quantity", "Counted"], (v) => ({ t: "s", v }))
        const body = Arr.map(book.rows, (row) => Arr.map(row, cellOf))
        const sheet = utils.aoa_to_sheet(book.headings ? [headings, ...body] : body, { dense: true })
        if (book.hiddenRow > 0) {
          sheet["!rows"] = Arr.makeBy(book.hiddenRow + 1, (i) => (i === book.hiddenRow ? { hidden: true } : {}))
        }
        if (book.merge) sheet["!merges"] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }]
        const workbook = utils.book_new()
        utils.book_append_sheet(workbook, sheet, "Items")
        if (book.second !== "none") {
          const lookup = utils.aoa_to_sheet(
            [
              ["Code", "Bay"],
              ["A-1", 4],
              ["A-2", 5]
            ],
            { dense: true }
          )
          utils.book_append_sheet(workbook, lookup, "Lookup")
        }
        workbook.Workbook = {
          WBProps: { date1904: book.date1904 },
          Sheets: [{ Hidden: 0 }, { Hidden: book.second === "hidden" ? 1 : book.second === "veryHidden" ? 2 : 0 }]
        }
        const bytes = new Uint8Array(
          write(workbook, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer
        )
        for (const chosen of [Option.none(), Option.some("Items"), Option.some("Lookup")]) {
          const [old, next] = yield* both("generated.xlsx", bytes, chosen)
          expect(next).toEqual(old)
        }
      }),
    { arbitrary: { runs: 150 } }
  )
})
