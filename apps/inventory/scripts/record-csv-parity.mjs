// Explicit snapshot recording uses the current reader; review its diff against the historical reader's snapshots.
import { readFileSync, writeFileSync } from "node:fs"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as Runtime from "effect/Runtime"
import * as S from "effect/Schema"
import { SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"
import { readCsv } from "@inventory/catalog-web/SpreadsheetCsv"
import { csvCorpus } from "../../../packages/catalog/web/test/csvCorpus.ts"

const Json = S.fromJsonString(S.Unknown)
const runMain = Runtime.makeRunMain(({ fiber, teardown }) => {
  fiber.addObserver((exit) =>
    teardown(exit, (code) => {
      process.exitCode = code
    })
  )
})

runMain(
  Effect.gen(function* () {
    for (const { name, bytes } of csvCorpus(readFileSync)) {
      const result = yield* readCsv({
        fileName: name,
        bytes,
        notes: [],
        pieceChars: 256 * 1024,
        onProgress: () => {}
      }).pipe(Effect.result)
      const wire = yield* Result.match(result, {
        onSuccess: (table) => Effect.map(S.encodeEffect(SpreadsheetTable)(table), (table) => ({ table })),
        onFailure: (problem) => Effect.succeed({ problem })
      })
      const text = yield* S.encodeEffect(Json)(wire)
      yield* Effect.sync(() =>
        writeFileSync(
          new URL(`../../../packages/catalog/web/test/fixtures/csv-expected/${name}.json`, import.meta.url),
          `${text}\n`
        )
      )
    }
  })
)
