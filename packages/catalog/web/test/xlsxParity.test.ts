// @effect-diagnostics nodeBuiltinImport:off
// The definition of done for moving workbook reading onto @beep/xlsx: the reader gives exactly the table (cells with
// their type, text, displayed text and formula, row numbers, Notes, the sheet list and the sheet chosen) or exactly
// the problem the SheetJS reader gave, for every workbook fixture and every sheet of it, and for files built by
// hand. The SheetJS reader's results were recorded in test/fixtures/xlsx-expected/ while it was still installed;
// the comparison reads those. XLSX_RECORD=true writes them again from the reader as it is now, which is only for a
// change of the table's shape that is meant.
import { readFileSync, writeFileSync } from "node:fs"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Config from "effect/Config"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"
import { readXlsx } from "../src/internal/spreadsheet/xlsx.ts"
import { builtCases, fixtureNames, lyingExtent, type XlsxCase } from "./xlsxCorpus.ts"

const bytesOf = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`./fixtures/spreadsheet/${name}`, import.meta.url)))
const Json = S.fromJsonString(S.Unknown)
const expectedUrl = (name: string) => new URL(`./fixtures/xlsx-expected/${name}.json`, import.meta.url)

// Historical snapshots are the wire form: schema defaults stay omitted there.
const plain = (result: Result.Result<SpreadsheetTable, unknown>) =>
  result.pipe(
    Result.match({
      onSuccess: (table) => Effect.map(S.encodeEffect(SpreadsheetTable)(table), (table) => ({ table })),
      onFailure: (problem) => Effect.succeed({ problem: { ...(problem as object) } })
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
  ...A.flatMap(fixtureNames, (name) => [
    { name, bytes: Effect.sync(() => bytesOf(name)), sheet: O.none<string>() },
    ...A.map(sheetsOf[name] ?? [], (sheet) => ({
      name: `${name} sheet ${sheet}`,
      bytes: Effect.sync(() => bytesOf(name)),
      sheet: O.some(sheet)
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
          const old = yield* readXlsx({ fileName, bytes, sheet: item.sheet, notes: [] }).pipe(Effect.result)
          const text = yield* old.pipe(plain, Effect.flatMap(S.encodeEffect(Json)))
          writeFileSync(expectedUrl(item.name), `${text}\n`)
        }
        const expected = yield* S.decodeEffect(Json)(readFileSync(expectedUrl(item.name), "utf8"))
        const next = yield* readXlsx({ fileName, bytes, sheet: item.sheet, notes: [] }).pipe(Effect.result)
        const nextText = yield* next.pipe(plain, Effect.flatMap(S.encodeEffect(Json)))
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
      const table = yield* readXlsx({ fileName: "lying.xlsx", bytes, sheet: O.none(), notes: [] })
      expect(A.map(table.rows, (row) => row.rowNumber)).toEqual([2, 3, 4, 5])
    })
  )
})
