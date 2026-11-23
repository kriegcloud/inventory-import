// A cell can hold 32,767 characters, and a reason quotes the cell it is about. A row with a long cell and a second
// problem is left out with a reason that names both, and the confirm and the Result answer: the write takes the plan's
// reason as it is, and a reason longer than the result reads (a version that quoted whole cells) is read with its long
// quoted values shortened, so every problem still reads. A SKU and a name a full cell long are stored and read back whole:
// the outcome's place has no bound of its own, and the pieces it travels in are cut by their bytes. On the real handlers
// and SQL, a fresh D1.
import { layer } from "@effect/vitest"
import { assertSome } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import * as SqlClient from "effect/sql/SqlClient"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { type ImportView, maxReason, outcomeReasonOf } from "@inventory/catalog-contract/Import"
import { Api } from "../../src/api/v1/Api.ts"
import { as, TypedApp } from "./support/app.ts"
import { upload } from "./support/upload.ts"

const columns = A.map(
  [
    ["A", "sku"],
    ["B", "name"],
    ["C", "category"],
    ["D", "uom"],
    ["E", "unit_cost"],
    ["F", "quantity_on_hand"]
  ] as const,
  ([letter, label], index) => ({ index, letter, label })
)
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
      cells: A.map(["AAA-0001", "Oak Crate", longCategory, "XX", "12.50", "10"], (text) => ({ text }))
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
      // Both problems of the row still read: the long category's sentence to its end, and the unit after it.
      assertSome(
        O.map(reason, (text) => [
          Str.startsWith('Category "xxxx')(text),
          Str.includes("is not one of the")(text),
          Str.includes('Unit of measure "XX" is not one of')(text),
          text.length <= maxReason
        ]),
        [true, true, true, true]
      )
    })
  )

  it.effect(
    "a reason a past version stored longer than the result reads keeps each problem, its long value shortened",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports"])
        const staged = yield* upload({ client, table }).pipe(marcus)
        yield* client.imports
          .commit({ params: { id: staged.id }, payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] } })
          .pipe(marcus)
        const sql = yield* SqlClient.SqlClient
        const stored = `Category "${Str.repeat(6000)("y")}" is not one of the 5 categories. Unit of measure "XX" is not one of EA, KG.`
        yield* sql`UPDATE importOutcome SET reason = ${stored} WHERE importId = ${staged.id} AND rowNumber = 2`
        const view = yield* client.imports.get({ params: { id: staged.id } }).pipe(marcus)
        assertSome(
          reasonOfRow2(view),
          `Category "${Str.repeat(80)("y")}…" (6,000 characters) is not one of the 5 categories. Unit of measure "XX" is not one of EA, KG.`
        )
      })
  )

  it.effect(
    "a row whose SKU and name are each a full cell long is left out, and the confirm and the Result answer",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports"])
        const [longSku, longName] = [Str.repeat(32_767)("S"), Str.repeat(32_767)("é")]
        const staged = yield* upload({
          client,
          table: {
            ...table,
            fileName: "long-place.csv",
            rows: [
              { rowNumber: 2, cells: A.map([longSku, longName, "packaging", "XX", "1", "1"], (text) => ({ text })) },
              {
                rowNumber: 3,
                cells: A.map(["AAA-0003", "Steel Nut", "packaging", "EA", "3", "4"], (text) => ({ text }))
              }
            ]
          }
        }).pipe(marcus)
        yield* client.imports
          .commit({ params: { id: staged.id }, payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] } })
          .pipe(marcus)
        const view = yield* client.imports.get({ params: { id: staged.id } }).pipe(marcus)
        assertSome(
          O.flatMap(view.result, (result) =>
            O.map(
              A.findFirst(result.rows, (row) => row.rowNumber === 2),
              (row) => [
                result.created,
                result.notImported,
                row.sku.length,
                row.name.length,
                O.exists(outcomeReasonOf(row), (reason) => reason.length > 0 && reason.length <= maxReason)
              ]
            )
          ),
          [1, 1, 32_767, 32_767, true]
        )
      })
  )
})
