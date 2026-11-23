// A cell can hold 32,767 characters, and a reason quotes the cell it is about. A row with a long cell is left out with
// its reason, and the confirm and the Result answer: the write takes the plan's reason as it is, and a reason longer
// than the result reads (a past version quoted whole cells) is read cut short. On the real handlers and SQL, a fresh D1.
import { layer } from "@effect/vitest"
import { assertSome } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import * as SqlClient from "effect/sql/SqlClient"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { type ImportView, outcomeReasonOf } from "@inventory/catalog-contract/Import"
import { resultReasonLength } from "@inventory/catalog-host/ImportRows"
import { Api } from "../../src/api/v1/Api.ts"
import { as, TypedApp } from "./support/app.ts"
import { upload } from "./support/upload.ts"

const headings = ["sku", "name", "category", "uom", "unit_cost", "quantity_on_hand"]
const columns = A.map(headings, (label, index) => ({
  index,
  letter: Str.charAt(index)("ABCDEF").pipe(O.getOrElse(() => "A")),
  label
}))
const longCategory = Str.repeat(4000)("x")
const table: StagedTable = {
  fileName: "long.csv",
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns,
  notes: [],
  rows: [
    {
      rowNumber: 2,
      cells: A.map(["AAA-0001", "Oak Crate", longCategory, "EA", "12.50", "10"], (text) => ({ text }))
    },
    { rowNumber: 3, cells: A.map(["AAA-0002", "Steel Bolt", "packaging", "EA", "3", "4"], (text) => ({ text })) }
  ]
}
const marcus = as("mem_marcus")

/** The result's reason for row 2 of the file, as the import's view reads it back. */
const reasonOfRow2 = (view: ImportView): O.Option<string> =>
  O.flatMap(view.result, (result) =>
    O.flatMap(
      A.findFirst(result.rows, (row) => row.rowNumber === 2),
      outcomeReasonOf
    )
  )

layer(TypedApp)("a row whose cell is thousands of characters long", (it) => {
  it.effect("is left out with a reason that quotes the cell, and the confirm and the Result answer", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["imports"])
      const staged = yield* upload({ client, table }).pipe(marcus)
      yield* client.imports
        .commit({ params: { id: staged.id }, payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] } })
        .pipe(marcus)
      const view = yield* client.imports.get({ params: { id: staged.id } }).pipe(marcus)
      assertSome(
        O.map(view.result, (result) => [result.created, result.notImported]),
        [1, 1]
      )
      const reason = reasonOfRow2(view)
      assertSome(O.map(reason, Str.startsWith('Category "xxxx')), true)
      assertSome(
        O.map(reason, (text) => text.length <= resultReasonLength),
        true
      )
    })
  )

  it.effect("a reason a past version stored longer than the result reads is read cut short", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["imports"])
      const staged = yield* upload({ client, table }).pipe(marcus)
      yield* client.imports
        .commit({ params: { id: staged.id }, payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] } })
        .pipe(marcus)
      const sql = yield* SqlClient.SqlClient
      const stored = Str.repeat(6000)("y")
      yield* sql`UPDATE importOutcome SET reason = ${stored} WHERE importId = ${staged.id} AND rowNumber = 2`
      const view = yield* client.imports.get({ params: { id: staged.id } }).pipe(marcus)
      const reason = reasonOfRow2(view)
      assertSome(
        O.map(reason, (text) => text.length),
        resultReasonLength
      )
      assertSome(O.map(reason, Str.endsWith("y…")), true)
    })
  )
})
