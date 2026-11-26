// The definition of done for moving CSV reading onto @beep/csv: the reader gives exactly the table (cells, row
// numbers, Notes, format) or exactly the problem the papaparse reader gave, for every CSV fixture, both samples and
// generated text with stray quotes, quoted line breaks and an unclosed quote, read whole and in pieces of any size.
// The papaparse reader's results were recorded in test/fixtures/csv-expected/ while it was still installed;
// `bun apps/inventory/scripts/record-csv-parity.mjs` writes current-reader snapshots for an intentional wire-shape change.
// The comparison only reads the recorded snapshots.
import { readBytes, readText } from "./support/fixture.ts"
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"
import { readCsv } from "@inventory/catalog-web/SpreadsheetCsv"
import { csvCorpus } from "./csvCorpus.ts"

const pieces = [5, 37, 64, 255, 1000, 4096, 256 * 1024]
const Json = S.fromJsonString(S.Unknown)
const expectedUrl = (name: string) => new URL(`./fixtures/csv-expected/${name}.json`, import.meta.url)

// Compare the historical wire form, where empty Row keys stay omitted.
const plain = (result: Result.Result<SpreadsheetTable, unknown>) =>
  result.pipe(
    Result.match({
      onSuccess: (table) => Effect.map(S.encodeEffect(SpreadsheetTable)(table), (table) => ({ table })),
      onFailure: (problem) => Effect.succeed({ problem: problem })
    })
  )

describe("@beep/csv reads every CSV as the papaparse reader did", () => {
  for (const { name, bytes } of csvCorpus(readBytes)) {
    it.effect(name, () =>
      Effect.gen(function* () {
        const expected = yield* S.decodeEffect(Json)(readText(expectedUrl(name)))
        for (const pieceChars of pieces) {
          const next = yield* readCsv({ fileName: name, bytes, notes: [], pieceChars, onProgress: () => {} }).pipe(
            Effect.result
          )
          const nextText = yield* next.pipe(plain, Effect.flatMap(S.encodeEffect(Json)))
          const nextJson = yield* S.decodeEffect(Json)(nextText)
          expect(nextJson, `${name} in pieces of ${pieceChars}`).toEqual(expected)
        }
      })
    )
  }
})
