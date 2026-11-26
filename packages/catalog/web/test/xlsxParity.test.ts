// The definition of done for moving workbook reading onto @beep/xlsx: the reader gives exactly the table (cells with
// their type, text, displayed text and formula, row numbers, Notes, the sheet list and the sheet chosen) or exactly
// the problem the SheetJS reader gave, for every workbook fixture and every sheet of it, and for files built by
// hand. The SheetJS reader's results were recorded in test/fixtures/xlsx-expected/ while it was still installed;
// the comparison reads those. `bun apps/inventory/scripts/record-xlsx-parity.mjs` writes current-reader snapshots
// only for an intentional change of the table's wire shape.
import { readBytes, readText } from "./support/fixture.ts"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"
import { readXlsx } from "../src/internal/spreadsheet/xlsx.ts"
import { lyingExtent } from "./xlsxCorpus.ts"
import { xlsxParityCases } from "./xlsxParityCases.ts"

const bytesOf = (name: string): Uint8Array => readBytes(new URL(`./fixtures/spreadsheet/${name}`, import.meta.url))
const Json = S.fromJsonString(S.Unknown)
const expectedUrl = (name: string) => new URL(`./fixtures/xlsx-expected/${name}.json`, import.meta.url)

// Historical snapshots are the wire form: schema defaults stay omitted there.
const plain = (result: Result.Result<SpreadsheetTable, unknown>) =>
  result.pipe(
    Result.match({
      onSuccess: (table) => Effect.map(S.encodeEffect(SpreadsheetTable)(table), (table) => ({ table })),
      onFailure: (problem) => Effect.succeed({ problem: problem })
    })
  )

const cases = xlsxParityCases(bytesOf)

describe("@beep/xlsx reads every workbook as the SheetJS reader did", () => {
  for (const item of cases) {
    it.effect(item.name, () =>
      Effect.gen(function* () {
        const bytes = yield* item.bytes
        const fileName = item.name
        const expected = yield* S.decodeEffect(Json)(readText(expectedUrl(item.name)))
        const next = yield* readXlsx({ onProgress: () => {}, fileName, bytes, sheet: item.sheet, notes: [] }).pipe(
          Effect.result
        )
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
      const table = yield* readXlsx({ onProgress: () => {}, fileName: "lying.xlsx", bytes, sheet: O.none(), notes: [] })
      expect(A.map(table.rows, (row) => row.rowNumber)).toEqual([2, 3, 4, 5])
    })
  )
})
