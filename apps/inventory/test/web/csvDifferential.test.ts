// @effect-diagnostics nodeBuiltinImport:off
// The definition of done for moving CSV reading onto @beep/csv: the reader gives exactly the table (cells, row
// numbers, Notes, format) or exactly the problem the papaparse reader gave, for every CSV fixture, both samples and
// generated text with stray quotes, quoted line breaks and an unclosed quote, read whole and in pieces of any size.
// The papaparse reader's results were recorded in test/fixtures/csv-expected/ while it was still installed (run with
// CSV_RECORD=true to write them); the comparison now reads those.
import { readFileSync, writeFileSync } from "node:fs"
import { describe, expect, it } from "@effect/vitest"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { readCsv } from "@inventory/catalog-web/SpreadsheetCsv"
import { csvCorpus } from "./csvCorpus.ts"

const pieces = [5, 37, 64, 255, 1000, 4096, 256 * 1024]
const Json = S.fromJsonString(S.Unknown)
const expectedUrl = (name: string) => new URL(`../fixtures/csv-expected/${name}.json`, import.meta.url)

const plain = (result: Result.Result<unknown, unknown>): unknown =>
  result.pipe(
    Result.match({
      onSuccess: (table) => ({ table }),
      onFailure: (problem) => ({ problem: { ...(problem as object) } })
    })
  )

describe("@beep/csv reads every CSV as the papaparse reader did", () => {
  for (const { name, bytes } of csvCorpus(readFileSync)) {
    it.effect(name, () =>
      Effect.gen(function* () {
        const record = yield* Config.Boolean("CSV_RECORD").pipe(Config.withDefault(false))
        if (record) {
          const old = yield* readCsv({ fileName: name, bytes, notes: [] }).pipe(Effect.result)
          const text = yield* old.pipe(plain, S.encodeEffect(Json))
          writeFileSync(expectedUrl(name), `${text}\n`)
        }
        const expected = yield* S.decodeEffect(Json)(readFileSync(expectedUrl(name), "utf8"))
        for (const pieceChars of pieces) {
          const next = yield* readCsv({ fileName: name, bytes, notes: [], pieceChars }).pipe(Effect.result)
          const nextText = yield* next.pipe(plain, S.encodeEffect(Json))
          const nextJson = yield* S.decodeEffect(Json)(nextText)
          expect(nextJson, `${name} in pieces of ${pieceChars}`).toEqual(expected)
        }
      })
    )
  }
})
