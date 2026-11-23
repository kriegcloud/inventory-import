// A saved decision is what the person said about a row, and the review reads it to settle the row's outcome: so it
// names only fields of an item, each once, never one both accepted and undone, and only rows a row id can name. A
// value that names nothing (a junk field, a junk row) is never read as something the person said. All data here is
// generated from the schemas; the oracle is the list of fields and the row number a row id spells.
import { describe, expect, it } from "@effect/vitest"
import {
  ConfirmRequest,
  decisionFromFlags,
  DecisionDelta,
  RowDecision,
  RowDecisionFlags,
  rowId,
  SaveRequest,
  SavedDecisions
} from "@inventory/catalog-contract/Decision"
import { fields } from "@inventory/catalog-contract/Staged"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const runs = { arbitrary: { runs: 200 } }

const isField = (name: string): boolean => A.contains(fields, name)

/** The row id a key spells, read back from its number and part: the same text only for a key that is a row id. */
const respelled = (key: string): string => {
  const [row, part] = Str.split(".")(Str.slice(4)(key))
  return rowId({ rowNumber: Number(row), ...(part === undefined ? {} : { part: Number(part) }) })
}

// A text that is no field of an item: a schema of its own, so the junk is generated like everything else.
const junkField = Arbitrary.schema(
  S.String.check(S.makeFilter((text: string) => !isField(text), { expected: "a text that names no field" }))
)

describe("a row's decision", () => {
  it.prop(
    "names only fields of an item, each once, and none both accepted and undone",
    [Arbitrary.schema(RowDecision)],
    ([decision]) => {
      for (const listed of [decision.accepted, decision.reverted]) {
        expect(A.every(listed, isField)).toBe(true)
        expect(A.dedupe(listed).length).toBe(listed.length)
      }
      expect(A.intersection(decision.accepted, decision.reverted)).toEqual([])
      expect(A.every(R.keys(decision.edits), isField)).toBe(true)
    },
    runs
  )

  it.effect.prop(
    "reads a field both accepted and undone as accepted, as the review does",
    [Arbitrary.schema(RowDecisionFlags)],
    ([flags]) =>
      Effect.gen(function* () {
        const accepted = flags.accepted ?? []
        const both = { ...flags, reverted: A.dedupe([...(flags.reverted ?? []), ...accepted]) }
        const read = yield* S.decodeEffect(RowDecision)(both)
        expect(read.accepted).toEqual(accepted)
        expect(A.intersection(read.reverted, accepted)).toEqual([])
        expect(decisionFromFlags(both)).toEqual(read)
      }),
    runs
  )

  it.effect.prop(
    "read from its flags in code is what decoding them reads, a value typed under no field left out by both",
    [Arbitrary.schema(RowDecisionFlags), junkField, Arbitrary.schema(S.String.check(S.isMaxLength(100)))],
    ([flags, junk, value]) =>
      Effect.gen(function* () {
        const withJunk = { ...flags, edits: { ...flags.edits, [junk]: value } }
        const decoded = yield* S.decodeEffect(RowDecision)(withJunk)
        expect(decisionFromFlags(withJunk)).toEqual(decoded)
        expect(R.has(decisionFromFlags(withJunk).edits, junk)).toBe(false)
      }),
    runs
  )

  it.prop(
    "refuses an accept or an undo of something that is no field",
    [Arbitrary.schema(RowDecisionFlags), junkField],
    ([flags, junk]) => {
      expect(S.is(RowDecisionFlags)({ ...flags, accepted: [...(flags.accepted ?? []), junk] })).toBe(false)
      expect(S.is(RowDecisionFlags)({ ...flags, reverted: [...(flags.reverted ?? []), junk] })).toBe(false)
    },
    runs
  )

  it.effect.prop(
    "is not changed by a value typed under something that is no field",
    [Arbitrary.schema(RowDecisionFlags), junkField, Arbitrary.schema(S.String.check(S.isMaxLength(100)))],
    ([flags, junk, value]) =>
      Effect.gen(function* () {
        const plain = yield* S.decodeEffect(RowDecision)(flags)
        const withJunk = yield* S.decodeEffect(RowDecision)({
          ...flags,
          edits: { ...flags.edits, [junk]: value }
        })
        expect(withJunk).toEqual(plain)
      }),
    runs
  )
})

describe("the decisions of a draft", () => {
  it.prop(
    "are keyed by row ids, each spelling its row's number and part",
    [Arbitrary.schema(SavedDecisions)],
    ([decisions]) => {
      for (const key of R.keys(decisions)) expect(respelled(key)).toBe(key)
    },
    runs
  )

  it.prop(
    "a save names its rows and their revisions by row ids, each spelling its row's number and part",
    [Arbitrary.schema(SaveRequest)],
    ([save]) => {
      for (const key of [...save.clear, ...R.keys(save.set), ...R.keys(save.madeOn), ...R.keys(save.over ?? {})]) {
        expect(respelled(key)).toBe(key)
      }
    },
    runs
  )

  // Each is generated valid, then given a row it also sets to clear, or a row it already clears to clear again.
  for (const [name, schema] of [
    ["a save", SaveRequest],
    ["a change of decisions", DecisionDelta],
    ["a confirm", ConfirmRequest]
  ] as const) {
    it.prop(
      `${name} that clears a row it also sets, or clears one twice, is refused`,
      [Arbitrary.schema(schema)],
      ([request]) => {
        expect(S.is(schema)(request)).toBe(true)
        const set = A.head(R.keys(request.set))
        if (O.isSome(set)) expect(S.is(schema)({ ...request, clear: [...request.clear, set.value] })).toBe(false)
        const cleared = A.head(request.clear)
        if (O.isSome(cleared))
          expect(S.is(schema)({ ...request, clear: [...request.clear, cleared.value] })).toBe(false)
      },
      runs
    )
  }
})
