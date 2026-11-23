// The Result screen's numbers are an import's result: the five counts are the rows of each outcome and add up to the
// rows of the file, and the values a rule changed sit in no fewer cells than rows. All data is generated from the
// schemas; the oracle counts the rows itself.
import { describe, expect, it } from "@effect/vitest"
import { rowId } from "@inventory/catalog-contract/Decision"
import { ImportResult, type OutcomeKind, RowOutcome } from "@inventory/catalog-contract/Import"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 200 } }

/** How many of the rows have this outcome, counted here and not by the schema. */
const rowsOf = (result: ImportResult, outcome: OutcomeKind): number =>
  A.filter(result.rows, RowOutcome.isAnyOf([outcome])).length

describe("an import's result", () => {
  it.prop(
    "counts each outcome as the rows that have it, and the five counts add up to the rows",
    [Arbitrary.schema(ImportResult)],
    ([result]) => {
      expect([result.created, result.updated, result.already, result.notImported, result.takenBack]).toEqual([
        rowsOf(result, "created"),
        rowsOf(result, "updated"),
        rowsOf(result, "already"),
        rowsOf(result, "notImported"),
        rowsOf(result, "takenBack")
      ])
      expect(result.created + result.updated + result.already + result.notImported + result.takenBack).toBe(
        result.rows.length
      )
    },
    runs
  )

  it.prop(
    "says values a rule changed sit in at least as many cells as rows, and never a negative number",
    [Arbitrary.schema(ImportResult)],
    ([result]) => {
      expect(result.fixed.rows).toBeGreaterThanOrEqual(0)
      expect(result.fixed.cells).toBeGreaterThanOrEqual(result.fixed.rows)
    },
    runs
  )

  it.prop(
    "names every row by a row id, its part when it has one",
    [Arbitrary.schema(ImportResult)],
    ([result]) => {
      for (const row of result.rows) {
        const part = O.getOrUndefined(row.part)
        expect(rowId({ rowNumber: row.rowNumber, part })).toBe(
          part === undefined ? `row-${row.rowNumber}` : `row-${row.rowNumber}.${part}`
        )
      }
    },
    runs
  )

  it.prop(
    "is refused when one count is off by one from its rows",
    [Arbitrary.schema(ImportResult)],
    ([result]) => {
      expect(S.is(ImportResult)({ ...result, created: result.created + 1 })).toBe(false)
      expect(S.is(ImportResult)({ ...result, takenBack: result.takenBack + 1 })).toBe(false)
    },
    runs
  )

  it.effect.prop(
    "reads back from the wire as it was sent",
    [Arbitrary.schema(ImportResult)],
    ([result]) =>
      Effect.gen(function* () {
        const wire = yield* S.encodeEffect(ImportResult)(result)
        const back = yield* S.decodeEffect(ImportResult)(wire)
        expect(back).toEqual(result)
      }),
    runs
  )
})
