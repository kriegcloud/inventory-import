// Every schema the package exports generates only values it accepts (SF-7), and every stored form round-trips.
import { describe, expect, it } from "@effect/vitest"
import * as ByteSize from "effect/ByteSize"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
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
import {
  Activity,
  ActivityStep,
  CellMark,
  Choice,
  ColumnMatch,
  Counts,
  DraftStep,
  Entry,
  Fix,
  FixGroup,
  ImportChange,
  ImportResult,
  Problem,
  ProblemKind,
  QueueEntry,
  ReviewDraft,
  ReviewRow,
  ReviewState,
  ReviewWords,
  RowView,
  SavedDecisions,
  UndoStep,
  Why
} from "@inventory/review/ReviewTypes"

const runs = { arbitrary: { runs: 50 } }
const schemas: Record<string, S.Top> = {
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
  SavedProgress,
  // The region's own shapes. `ReviewColumn` is not here: its `display` is a function, which nothing generates.
  ProblemKind,
  ColumnMatch,
  Why,
  Fix,
  Choice,
  Problem,
  ReviewRow,
  UndoStep,
  ReviewState,
  CellMark,
  RowView,
  FixGroup,
  Entry,
  QueueEntry,
  Counts,
  ActivityStep,
  Activity,
  ImportChange,
  ImportResult,
  SavedDecisions,
  DraftStep,
  ReviewDraft,
  ReviewWords
}

describe("every exported schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true)
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
        expect(S.is(S.toEncoded(DecisionFlags))(flags)).toBe(true)
        const back = yield* S.decodeEffect(ReviewDecisionFromFlags)(flags)
        const again = yield* S.encodeEffect(ReviewDecisionFromFlags)(back)
        expect(again).toEqual(flags)
      }),
    runs
  )

  // A file's size as the browser gives it is a safe integer; the decoded ByteSize admits more, which the stored
  // number cannot hold, so the round trip is asked of sizes a File can have.
  const fileSized = Arbitrary.filter(Arbitrary.schema(SavedProgress), (progress) =>
    O.match(progress.file, {
      onNone: () => true,
      onSome: (file) => O.isSome(ByteSize.toNumber(file.size))
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
