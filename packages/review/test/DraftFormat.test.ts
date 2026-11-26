import { assertDefined, assertTrue } from "@effect/vitest/utils"
import { fixableBy } from "@inventory/review/ReviewDraft"
// A draft saved before the review region became a package, and before its decision became a tagged union, still
// restores. The fixture is the exact localStorage text that build wrote, kept as .txt so no formatter touches it. The
// rule that would hurt if wrong: a person's unfinished review is never thrown away by a new build.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { putBack, ReviewDecision, ReviewDecisionFromFlags } from "@inventory/review/ReviewDecision"
import { act } from "@inventory/review/ReviewDraft"
import { ReviewRow } from "@inventory/review/ReviewTypes"
import { restoredReview, SavedProgress } from "@inventory/review/SavedProgress"
import before from "./fixtures/draft-before-the-move.txt?raw"

const asText = S.fromJsonString(SavedProgress)

describe("a draft saved by the build before the move", () => {
  it.effect("decodes, and encodes back to the same bytes", () =>
    Effect.gen(function* () {
      const progress = yield* S.decodeEffect(asText)(before)
      expect(progress.step).toBe("review")
      const again = yield* S.encodeEffect(asText)(progress)
      expect(again).toBe(before)
    })
  )

  it.effect("gives the region the same decisions and the same undo and redo history", () =>
    Effect.gen(function* () {
      const progress = yield* S.decodeEffect(asText)(before)
      assertTrue(O.isSome(progress.review), "expected a present test value")
      const review = progress.review.value
      const state = restoredReview(review)
      expect(A.sort([...HashMap.keys(state.decisions)], Order.String)).toEqual(["row-148", "row-195"])
      expect(O.map(HashMap.get(state.decisions, "row-148"), (d) => d.accepted)).toEqual(O.some(["sku"]))
      expect(A.map(state.undo, (step) => step.label)).toEqual(["2 fixes accepted"])
      expect(A.map(state.redo, (step) => step.label)).toEqual(["2 rows left out"])
      // The redo step holds the two rows as they were when it was undone: left out, not kept before.
      const redo = state.redo[0]
      assertDefined(redo)
      const redone = redo.before
      expect(O.map(O.flatten(HashMap.get(redone, "row-55")), (d) => d.place)).toEqual(
        O.some({ kind: "leftOut", wasKept: false })
      )
      // Redo after the restore puts the two rows back out.
      const rows: ReadonlyArray<ReviewRow> = A.map(["row-55", "row-191", "row-148", "row-195"], (id, i) =>
        ReviewRow.make({
          id,
          line: i + 2,
          cells: {}
        })
      )
      const after = act({
        recheck: O.none(),
        fixable: fixableBy([]),
        rejects: false,
        rows,
        state,
        action: { type: "redo" }
      }).state
      expect(O.map(R.get(R.fromEntries(after.decisions), "row-191"), (d) => d.place.kind)).toEqual(O.some("leftOut"))
    })
  )
})

describe("the row place", () => {
  it.effect("reads a kept row the person then left out, and putting it back keeps it", () =>
    Effect.gen(function* () {
      const decision = yield* S.decodeEffect(ReviewDecisionFromFlags)({ out: true, kept: true })
      expect(decision.place).toEqual({ kind: "leftOut", wasKept: true })
      expect(putBack(decision.place).kind).toBe("kept")
      const flags = yield* S.encodeEffect(ReviewDecisionFromFlags)(decision)
      expect(flags).toEqual({ out: true, kept: true })
    })
  )

  it.effect("writes an empty decision as an empty object, as drafts always held it", () =>
    Effect.gen(function* () {
      const flags = yield* S.encodeEffect(ReviewDecisionFromFlags)(ReviewDecision.make({}))
      expect(flags).toEqual({})
    })
  )
})
