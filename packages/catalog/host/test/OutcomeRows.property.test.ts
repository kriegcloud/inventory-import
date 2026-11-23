// What a confirm stores for each item of the file, and what the result reads back from it. Every row that is left
// out or already there has a reason a person can act on; only a left-out row says who left it out, and a person is
// named exactly when one did. A row whose item was written has no reason and nobody who decided it.
import { describe, expect, it } from "@effect/vitest"
import { DecidedBy, outcomeReasonOf, RowOutcome } from "@inventory/catalog-contract/Import"
import { OutcomeInsert, OutcomeRow, storedOutcome } from "@inventory/catalog-host/ImportRows"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 300 } }

/** Text a person can read: at least one character that is not a space. */
const said = (text: unknown): boolean => P.isString(text) && /\S/.test(text)

describe("the outcome rows a confirm stores", () => {
  it.effect.prop(
    "a row is written with a reason exactly when it is not written as an item, and a name exactly when a person left it out",
    [Arbitrary.schema(OutcomeInsert)],
    ([outcome]) =>
      Effect.gen(function* () {
        const row = yield* S.encodeEffect(OutcomeInsert)(outcome)
        const leftOut = row.status === "notImported"
        const written = row.status === "ready" || row.status === "update"
        expect(written ? row.reason === "" : said(row.reason)).toBe(true)
        expect(row.decidedBy !== null).toBe(leftOut)
        expect(row.decidedBy === "person" ? said(row.decidedByName) : row.decidedByName === null).toBe(true)
      }),
    runs
  )

  it.effect.prop(
    "the result reads every stored row left out or already there with a reason, and names who left it out as stored",
    [Arbitrary.schema(OutcomeRow)],
    ([stored]) =>
      Effect.gen(function* () {
        const row = yield* S.encodeEffect(OutcomeRow)(stored)
        const shown = storedOutcome(stored)
        const reason = outcomeReasonOf(shown)
        expect(O.isSome(reason) ? said(reason.value) : row.reason === "").toBe(true)
        expect(RowOutcome.guards.notImported(shown)).toBe(row.decidedBy !== null)
        if (RowOutcome.guards.notImported(shown)) {
          // The person the column names is the one the result names, never "nobody" for a person who left it out.
          const named = DecidedBy.guards.person(shown.decidedBy) ? shown.decidedBy.name : null
          expect(named).toBe(row.decidedBy === "person" ? row.decidedByName : null)
        }
      }),
    runs
  )
})
