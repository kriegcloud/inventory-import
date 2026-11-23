// What a confirm stores for each item of the file, and what the result reads back from it. Every plan the review can
// make is written: a row that is left out or already there with its reason, only a left-out row saying who left it
// out, and a row whose item was written with no reason and nobody. What is stored is read back as any version of the
// app wrote it, so a past import's result and its download of left-out rows still open.
import { describe, expect, it } from "@effect/vitest"
import { DecidedBy, maxReason, outcomeReasonOf, RowOutcome } from "@inventory/catalog-contract/Import"
import {
  OutcomeInsert,
  OutcomeRow,
  outcomeInsertOf,
  Part,
  StoredReason,
  RowNumber,
  storedOutcome
} from "@inventory/catalog-host/ImportRows"
import { maxSaid } from "@inventory/catalog-model/CellReading"
import { PlannedRow } from "@inventory/catalog-model/Confirm"
import { DisplayName } from "@inventory/kernel/Text"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const runs = { arbitrary: { runs: 300 } }

/**
 * A row of `importOutcome` as any version of the app may have written it: the table's own columns and checks, with a
 * reason of any form the result reads whole (a longer one is the last property's), and who decided and their name in
 * any combination the columns allow, drawn as Options and written as the columns hold them (`NULL` for none).
 */
const StoredByAnyVersion = S.Struct({
  rowNumber: RowNumber,
  part: Part,
  sku: S.String,
  name: S.String,
  outcome: S.Literals(["created", "updated", "already", "notImported", "takenBack"]),
  reason: S.Union([S.Literal(""), S.Literal("  "), S.String.check(S.isMaxLength(maxReason))]),
  decidedBy: S.OptionFromNullOr(S.Literals(["person", "nobody"])),
  decidedByName: S.OptionFromNullOr(S.Union([DisplayName, S.Literal(""), S.Literal(" "), S.String]))
})

/**
 * A name a person can read, as the result shows one: some character that is not a space, and at most 200. Written by
 * hand on purpose: it is the oracle for `DisplayName`, which the read under test uses, so it does not call it.
 */
const readable = (name: string): boolean => /\S/.test(name) && name.length <= 200

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
        const columns = yield* S.encodeEffect(StoredByAnyVersion)(stored)
        const read = yield* S.decodeEffect(OutcomeRow)(columns)
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
          const named = DecidedBy.guards.person(shown.decidedBy) ? O.some(shown.decidedBy.name) : O.none()
          const byAPerson = O.filter(stored.decidedBy, (who) => who === "person")
          expect(named).toEqual(O.flatMap(byAPerson, () => O.filter(stored.decidedByName, readable)))
        }
      }),
    runs
  )
})

// A long stored reason, as a version that quoted whole cells wrote it: one problem after another, each quoting a value
// made of one piece many times. A piece is a character of one or two UTF-16 units, or a value's own quote: an inch
// mark (`12" `) or a quote inside a word (`a"b`), which a version that quoted whole cells wrote as it was.
const Piece = S.Literals(["x", "é", "😀", '12" ', 'a"b'])
const Problem = S.Struct({
  field: S.Literals(["Category", "Unit of measure", "Name"]),
  piece: Piece,
  times: S.Int.check(S.isBetween({ minimum: 1, maximum: 3000 })),
  rest: S.Literals([" is not one of the 5 categories.", " has spaces around it."])
})
const Problems = S.Array(Problem).check(S.isMinLength(1), S.isMaxLength(4))
const Unquoted = S.Struct({
  character: S.Literals(["x", "é", "😀"]),
  times: S.Int.check(S.isBetween({ minimum: 4001, maximum: 6000 }))
})

const readReason = S.decodeEffect(StoredReason)
const thousands = new Intl.NumberFormat("en-US")

/** As many whole copies of `character` as fit in `units` UTF-16 units. */
const copiesWithin: {
  (units: number): (character: string) => string
  (character: string, units: number): string
} = dual(2, (character: string, units: number): string => Str.repeat(Math.floor(units / character.length))(character))

/** The whole characters from the start that fit in `units` UTF-16 units, worked out character by character. */
const firstUnits: {
  (units: number): (text: string) => string
  (text: string, units: number): string
} = dual(
  2,
  (text: string, units: number): string =>
    A.reduce(A.fromIterable(text), { kept: "", full: false }, (cut, character) =>
      cut.full || cut.kept.length + character.length > units
        ? { kept: cut.kept, full: true }
        : { kept: `${cut.kept}${character}`, full: false }
    ).kept
)

describe("a stored reason longer than the result reads", () => {
  it.effect.prop(
    "keeps every problem's sentence whole, each long quoted value cut to its first 80 characters and its length said",
    [Arbitrary.schema(Problems)],
    ([problems]) =>
      Effect.gen(function* () {
        const quoting = (cut: boolean) =>
          A.join(
            A.map(problems, (problem) => {
              const value = Str.repeat(problem.times)(problem.piece)
              return cut && value.length > maxSaid
                ? `${problem.field} "${firstUnits(value, maxSaid)}…" (${thousands.format(value.length)} characters)${problem.rest}`
                : `${problem.field} "${value}"${problem.rest}`
            }),
            " "
          )
        const stored = quoting(false)
        const read = yield* readReason(stored)
        expect(read).toBe(stored.length <= maxReason ? stored : quoting(true))
      }),
    { arbitrary: { runs: 200 } }
  )

  it.effect.prop(
    "with no quoted value to shorten, is cut at its end to the length the result reads",
    [Arbitrary.schema(Unquoted)],
    ([unquoted]) =>
      Effect.gen(function* () {
        const read = yield* readReason(Str.repeat(unquoted.times)(unquoted.character))
        expect(read).toBe(`${copiesWithin(unquoted.character, maxReason - 1)}…`)
      }),
    { arbitrary: { runs: 50 } }
  )
})
