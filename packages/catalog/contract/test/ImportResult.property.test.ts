// The Result screen's numbers are an import's result: the five counts are the rows of each outcome and add up to the
// rows of the file, and the values a rule changed sit in no fewer cells than rows. Results are generated from the
// schema, then broken one way at a time; each broken copy must be refused, so every rule of the check is seen to hold.
import { describe, expect, it } from "@effect/vitest"
import { rowId } from "@inventory/catalog-contract/Decision"
import { ImportResult } from "@inventory/catalog-contract/Import"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 200 } }

const counts = ["created", "updated", "already", "notImported", "takenBack"] as const

describe("an import's result", () => {
  it.prop(
    "is refused when any one count is off by one from its rows, either way",
    [Arbitrary.schema(ImportResult)],
    ([result]) => {
      expect(S.is(ImportResult)(result)).toBe(true)
      for (const name of counts) {
        expect(S.is(ImportResult)({ ...result, [name]: result[name] + 1 })).toBe(false)
        if (result[name] > 0) expect(S.is(ImportResult)({ ...result, [name]: result[name] - 1 })).toBe(false)
      }
    },
    runs
  )

  it.prop(
    "is refused when a count moves to another outcome, though the five still add up to the rows",
    [Arbitrary.schema(ImportResult)],
    ([result]) => {
      for (const from of counts) {
        for (const to of counts) {
          if (from !== to && result[from] > 0) {
            expect(S.is(ImportResult)({ ...result, [from]: result[from] - 1, [to]: result[to] + 1 })).toBe(false)
          }
        }
      }
    },
    runs
  )

  it.prop(
    "is refused when the values a rule changed sit in fewer cells than rows",
    [Arbitrary.schema(ImportResult)],
    ([result]) => {
      const { rows } = result.fixed
      if (rows > 0) expect(S.is(ImportResult)({ ...result, fixed: { rows, cells: rows - 1 } })).toBe(false)
      expect(S.is(ImportResult)({ ...result, fixed: { rows, cells: rows } })).toBe(true)
    },
    runs
  )

  it.prop(
    "names every row by a row id, its part when it has one",
    [Arbitrary.schema(ImportResult)],
    ([result]) => {
      for (const row of result.rows) {
        expect(rowId({ rowNumber: row.rowNumber, part: row.part })).toBe(
          O.match(row.part, {
            onNone: () => `row-${row.rowNumber}`,
            onSome: (part) => `row-${row.rowNumber}.${part}`
          })
        )
      }
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
