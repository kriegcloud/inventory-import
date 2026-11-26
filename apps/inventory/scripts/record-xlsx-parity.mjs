// Explicit snapshot recording uses the current reader; review its diff against the historical reader's snapshots.
import { readFileSync, writeFileSync } from "node:fs"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as Runtime from "effect/Runtime"
import * as S from "effect/Schema"
import { SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"
import { readXlsx } from "../../../packages/catalog/web/src/internal/spreadsheet/xlsx.ts"
import { xlsxParityCases } from "../../../packages/catalog/web/test/xlsxParityCases.ts"

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
    const bytesOf = (name) =>
      readFileSync(new URL(`../../../packages/catalog/web/test/fixtures/spreadsheet/${name}`, import.meta.url))
    for (const item of xlsxParityCases(bytesOf)) {
      const bytes = yield* item.bytes
      const name = item.name
      const result = yield* readXlsx({
        onProgress: () => {},
        fileName: name,
        bytes,
        sheet: item.sheet,
        notes: []
      }).pipe(Effect.result)
      const wire = yield* Result.match(result, {
        onSuccess: (table) => Effect.map(S.encodeEffect(SpreadsheetTable)(table), (table) => ({ table })),
        onFailure: (problem) => Effect.succeed({ problem })
      })
      const text = yield* S.encodeEffect(Json)(wire)
      yield* Effect.sync(() =>
        writeFileSync(
          new URL(`../../../packages/catalog/web/test/fixtures/xlsx-expected/${name}.json`, import.meta.url),
          `${text}\n`
        )
      )
    }
  })
)
