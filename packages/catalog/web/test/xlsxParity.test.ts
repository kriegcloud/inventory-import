// @effect-diagnostics nodeBuiltinImport:off
// The definition of done for moving workbook reading onto @beep/xlsx: the reader gives exactly the table (cells with
// their type, text, displayed text and formula, row numbers, Notes, the sheet list and the sheet chosen) or exactly
// the problem the SheetJS reader gave, for every workbook fixture and every sheet of it, and for files built by
// hand. The SheetJS reader's results were recorded in test/fixtures/xlsx-expected/ while it was still installed
// (XLSX_RECORD=true writes them from the reader named below); the comparison reads those.
import { readFileSync, writeFileSync } from "node:fs"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"
import * as Config from "effect/Config"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { readWorkbook } from "../src/internal/spreadsheet/workbook.ts"
import { readXlsx as recorded } from "../src/internal/spreadsheet/xlsx.ts"
import { builtCases, fixtureNames, lyingExtent, type XlsxCase } from "./xlsxCorpus.ts"

const bytesOf = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`./fixtures/spreadsheet/${name}`, import.meta.url)))
const Json = S.fromJsonString(S.Unknown)
const expectedUrl = (name: string) => new URL(`./fixtures/xlsx-expected/${name}.json`, import.meta.url)

const plain = (result: Result.Result<unknown, unknown>): unknown =>
  result.pipe(
    Result.match({
      onSuccess: (table) => ({ table }),
      onFailure: (problem) => ({ problem: { ...(problem as object) } })
    })
  )

/** The sheets of each fixture, as the fixtures hold them: every one is a case of its own. */
const sheetsOf: { readonly [name: string]: ReadonlyArray<string> } = {
  "date-1904.xlsx": ["Sheet1"],
  "empty.xlsx": ["Sheet1"],
  "libreoffice.xlsx": ["items"],
  "messy.xlsx": ["Stock"],
  "no-header.xlsx": ["Sheet1"],
  "sheets.xlsx": ["Read me", "Empty", "Items", "Lookup", "Old prices", "Bay 2"]
}

const cases: ReadonlyArray<XlsxCase> = [
  ...Arr.flatMap(fixtureNames, (name) => [
    { name, bytes: Effect.sync(() => bytesOf(name)), sheet: Option.none<string>() },
    ...Arr.map(sheetsOf[name] ?? [], (sheet) => ({
      name: `${name} sheet ${sheet}`,
      bytes: Effect.sync(() => bytesOf(name)),
      sheet: Option.some(sheet)
    }))
  ]),
  ...builtCases(bytesOf)
]

describe("@beep/xlsx reads every workbook as the SheetJS reader did", () => {
  for (const item of cases) {
    it.effect(item.name, () =>
      Effect.gen(function* () {
        const bytes = yield* item.bytes
        const fileName = item.name
        const record = yield* Config.Boolean("XLSX_RECORD").pipe(Config.withDefault(false))
        if (record) {
          const old = yield* recorded({ fileName, bytes, sheet: item.sheet, notes: [] }).pipe(Effect.result)
          const text = yield* old.pipe(plain, S.encodeEffect(Json))
          writeFileSync(expectedUrl(item.name), `${text}\n`)
        }
        const expected = yield* S.decodeEffect(Json)(readFileSync(expectedUrl(item.name), "utf8"))
        const next = yield* readWorkbook({ fileName, bytes, sheet: item.sheet, notes: [] }).pipe(Effect.result)
        const nextText = yield* next.pipe(plain, S.encodeEffect(Json))
        const nextJson = yield* S.decodeEffect(Json)(nextText)
        expect(nextJson).toEqual(expected)
      })
    )
  }

  // Not recorded, because here the SheetJS reader was wrong: it took a sheet's declared extent as the truth and
  // dropped the rows outside it without a word (rows 4 and 5 of this file). The new reader reads what the sheet holds.
  it.effect("and reads the rows a sheet's declared extent leaves out", () =>
    Effect.gen(function* () {
      const bytes = yield* lyingExtent
      const table = yield* readWorkbook({ fileName: "lying.xlsx", bytes, sheet: Option.none(), notes: [] })
      expect(Arr.map(table.rows, (row) => row.rowNumber)).toEqual([2, 3, 4, 5])
    })
  )
})
