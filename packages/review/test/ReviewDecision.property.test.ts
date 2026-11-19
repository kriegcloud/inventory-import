// Every schema the package exports generates only values it accepts (SF-7), and every stored form round-trips.
import { describe, expect, it } from "@effect/vitest"
import { ByteSize, Effect, Option } from "effect"
import * as Arbitrary from "effect/Arbitrary"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import {
  CellText,
  ColumnKey,
  DecisionFlags,
  ReviewDecision,
  ReviewDecisionFromFlags,
  RowKey,
  RowPlace
} from "@inventory/review/ReviewDecision"
import { ProgressStep, SavedProgress, StoredFile, StoredReview, StoredStep } from "@inventory/review/SavedProgress"

const runs = { arbitrary: { runs: 50 } }
const schemas = {
  RowKey,
  ColumnKey,
  CellText,
  RowPlace,
  ReviewDecision,
  DecisionFlags,
  ProgressStep,
  StoredStep,
  StoredReview,
  StoredFile,
  SavedProgress
}

describe("every exported schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema as S.Top)],
      ([value]) => {
        expect(S.is(schema as S.Top)(value)).toBe(true)
      },
      runs
    )
  }
})

describe("stored forms round-trip", () => {
  it.effect.prop(
    "a decision through its flags",
    [Arbitrary.schema(ReviewDecision)],
    ([decision]) =>
      Effect.gen(function* () {
        const flags = yield* S.encodeEffect(ReviewDecisionFromFlags)(decision)
        expect(S.is(DecisionFlags)(flags)).toBe(true)
        const back = yield* S.decodeEffect(ReviewDecisionFromFlags)(flags)
        const again = yield* S.encodeEffect(ReviewDecisionFromFlags)(back)
        expect(again).toEqual(flags)
      }),
    runs
  )

  // A file's size as the browser gives it is a safe integer; the decoded ByteSize admits more, which the stored
  // number cannot hold, so the round trip is asked of sizes a File can have.
  const fileSized = Arbitrary.filter(Arbitrary.schema(SavedProgress), (progress) =>
    Option.match(progress.file, {
      onNone: () => true,
      onSome: (file) => Option.isSome(ByteSize.toNumber(file.size))
    })
  )
  it.effect.prop(
    "saved progress through its JSON text",
    [fileSized],
    ([progress]) =>
      Effect.gen(function* () {
        const codec = S.fromJsonString(SavedProgress)
        const text = yield* S.encodeEffect(codec)(progress)
        const back = yield* S.decodeEffect(codec)(text)
        const again = yield* S.encodeEffect(codec)(back)
        expect(again).toBe(text)
      }),
    runs
  )
})
