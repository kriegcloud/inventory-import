// What a confirm stores for each item of the file, and what the result reads back from it. Every plan the review can
// make is written: a row that is left out or already there with its reason, only a left-out row saying who left it
// out, and a row whose item was written with no reason and nobody. What is stored is read back as any version of the
// app wrote it, so a past import's result and its download of left-out rows still open.
import { describe, expect, it } from "@effect/vitest"
import { DecidedBy, outcomeReasonOf, RowOutcome } from "@inventory/catalog-contract/Import"
import {
  OutcomeInsert,
  OutcomeRow,
  outcomeInsertOf,
  Part,
  RowNumber,
  storedOutcome
} from "@inventory/catalog-host/ImportRows"
import { PlannedRow } from "@inventory/catalog-model/Confirm"
import { DisplayName } from "@inventory/kernel/Text"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 300 } }

/**
 * A row of `importOutcome` as any version of the app may have written it: the table's own columns and checks, with a
 * reason of any form, and who decided and their name in any combination the columns allow.
 */
const StoredByAnyVersion = S.Struct({
  rowNumber: RowNumber,
  part: Part,
  sku: S.String,
  name: S.String,
  outcome: S.Literals(["created", "updated", "already", "notImported", "takenBack"]),
  reason: S.Union([S.Literal(""), S.Literal("  "), S.String.check(S.isMaxLength(4000))]),
  decidedBy: S.NullOr(S.Literals(["person", "nobody"])),
  decidedByName: S.NullOr(S.Union([DisplayName, S.Literal(""), S.Literal(" "), S.String]))
})

/** A name a person can read, as the result shows one: some character that is not a space, and at most 200. */
const readable = (name: string | null): name is string => P.isString(name) && /\S/.test(name) && name.length <= 200

describe("the outcome rows a confirm stores", () => {
  it.effect.prop(
    "every planned row is written, with a reason exactly when its item is not, and a name exactly when a person left it out",
    [Arbitrary.schema(PlannedRow)],
    ([plan]) =>
      Effect.gen(function* () {
        const row = yield* S.encodeEffect(OutcomeInsert)(outcomeInsertOf(plan))
        expect([row.rowNumber, row.part, row.sku, row.name]).toEqual([plan.rowNumber, plan.part, plan.sku, plan.name])
        PlannedRow.match(plan, {
          ready: () => expect([row.status, row.reason, row.decidedBy]).toEqual(["ready", "", null]),
          update: () => expect([row.status, row.reason, row.decidedBy]).toEqual(["update", "", null]),
          already: (already) =>
            expect([row.status, row.reason, row.decidedBy]).toEqual(["already", already.reason, null]),
          notImported: (out) =>
            expect([row.status, row.reason, row.decidedBy, row.decidedByName]).toEqual([
              "notImported",
              out.reason,
              out.decidedBy.kind,
              DecidedBy.guards.person(out.decidedBy) ? out.decidedBy.name : null
            ])
        })
      }),
    runs
  )

  it.effect.prop(
    "a stored row of any version is read: its outcome and reason as stored, and a person named only by a name one can read",
    [Arbitrary.schema(StoredByAnyVersion)],
    ([stored]) =>
      Effect.gen(function* () {
        const read = yield* S.decodeEffect(OutcomeRow)(stored)
        const shown = storedOutcome(read)
        expect([shown.outcome, shown.rowNumber, shown.sku, shown.name]).toEqual([
          stored.outcome,
          stored.rowNumber,
          stored.sku,
          stored.name
        ])
        expect(shown.part).toEqual(stored.part === 0 ? O.none() : O.some(stored.part))
        const hasReason = stored.outcome === "already" || stored.outcome === "notImported"
        expect(outcomeReasonOf(shown)).toEqual(hasReason ? O.some(stored.reason) : O.none())
        if (RowOutcome.guards.notImported(shown)) {
          const named = DecidedBy.guards.person(shown.decidedBy) ? shown.decidedBy.name : null
          expect(named).toBe(
            stored.decidedBy === "person" && readable(stored.decidedByName) ? stored.decidedByName : null
          )
        }
      }),
    runs
  )
})
