// What a refresh brings back. The rules that would hurt if wrong: progress saved for one person in one organization is
// never read for anyone else; the decisions and the undo history come back exactly as they were left; and a draft
// that no longer decodes is dropped, never shown half.
import { it } from "@effect/vitest"
import * as A from "effect/Array"
import * as ByteSize from "effect/ByteSize"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { describe, expect, it as plain } from "vitest"
import { ReviewDecision } from "@inventory/review/ReviewDecision"
import { Action, act, emptyState } from "@inventory/review/ReviewDraft"
import type { ReviewRow, ReviewState } from "@inventory/review/ReviewTypes"
import {
  clearProgress,
  progressKey,
  type ProgressStorage,
  readProgress,
  restoredReview,
  SavedProgress,
  StoredFile,
  storedReview,
  StoredReview,
  writeProgress
} from "@inventory/review/SavedProgress"

const memory = (): ProgressStorage & { readonly items: Record<string, string> } => {
  const items: Record<string, string> = {}
  return {
    items,
    getItem: (key) => R.get(items, key).pipe((found) => (found._tag === "Some" ? found.value : null)),
    setItem: (key, value) => {
      items[key] = value
    },
    removeItem: (key) => {
      delete items[key]
    }
  }
}

const progress = (step: string): SavedProgress =>
  SavedProgress.make({
    version: 1,
    step,
    file: O.some(
      StoredFile.make({
        name: "items.csv",
        size: ByteSize.bytes(1797),
        lastModified: DateTime.makeUnsafe(1_763_000_000_000),
        sheet: O.none()
      })
    ),
    review: O.some(
      StoredReview.make({ decisions: { "row-9": ReviewDecision.make({ edits: { qty: "2000" } }) }, undo: [] })
    ),
    decided: 1,
    needed: 4,
    savedAt: DateTime.makeUnsafe("2026-11-17T12:00:00.000Z")
  })

const Scope = S.Struct({ organizationId: S.String, memberId: S.String, screen: S.String })

describe("saved progress", () => {
  it.prop(
    "gives two different people, organizations or screens two different keys",
    { a: Scope, b: Scope },
    ({ a, b }) => {
      const same = a.organizationId === b.organizationId && a.memberId === b.memberId && a.screen === b.screen
      expect(progressKey(a) === progressKey(b)).toBe(same)
    }
  )

  plain("never reads one member's progress for another member or another organization", () => {
    const storage = memory()
    const dana = { organizationId: "org_prairie", memberId: "mem_dana", screen: "import" }
    expect(writeProgress(storage, dana, progress("review"))).toBe(true)
    expect(readProgress(storage, dana)?.step).toBe("review")
    expect(readProgress(storage, { ...dana, memberId: "mem_marcus" })).toBeUndefined()
    expect(readProgress(storage, { ...dana, organizationId: "org_northline" })).toBeUndefined()
    clearProgress(storage, dana)
    expect(readProgress(storage, dana)).toBeUndefined()
  })

  plain("drops a stored draft that does not decode, and does not offer it again", () => {
    const storage = memory()
    const scope = { organizationId: "org_prairie", memberId: "mem_dana", screen: "import" }
    storage.setItem(progressKey(scope), '{"version":0,"step":"review"}')
    expect(readProgress(storage, scope)).toBeUndefined()
    expect(R.keys(storage.items)).toEqual([])
  })

  // Rows with a problem in one column; the person types values and leaves rows out in any order.
  const rows: ReadonlyArray<ReviewRow> = A.makeBy(6, (i) => ({
    id: `row-${i + 2}`,
    line: i + 2,
    cells: { name: `Item ${i}`, qty: "" },
    problem: { kind: "blank", column: "qty" }
  }))
  const Step = S.Struct({
    row: S.Int.check(S.isBetween({ minimum: 0, maximum: 5 })),
    leaveOut: S.Boolean,
    value: S.String.check(S.isMaxLength(12))
  })

  const asText = S.fromJsonString(StoredReview)

  it.effect.prop(
    "brings back every decision and the whole undo and redo history after a trip through storage",
    {
      steps: S.Array(Step).check(S.isMaxLength(12)),
      undos: S.Int.check(S.isBetween({ minimum: 0, maximum: 3 }))
    },
    ({ steps, undos }) =>
      Effect.gen(function* () {
        let state: ReviewState = emptyState
        for (const step of steps) {
          const row = rows[step.row]
          if (row === undefined) continue
          const action = step.leaveOut
            ? Action.LeaveOut({ rowIds: [row.id] })
            : Action.Edit({ rowId: row.id, column: "qty", value: step.value })
          state = act({ rows, state, action }).state
        }
        for (let i = 0; i < undos; i++) state = act({ rows, state, action: Action.Undo() }).state
        // And one redo, so the redo history makes the trip too.
        if (undos > 1) state = act({ rows, state, action: Action.Redo() }).state
        // What a refresh does: the decisions handed out, kept as JSON text, decoded and handed back.
        const text = yield* S.encodeEffect(asText)(storedReview(state))
        const stored = yield* S.decodeEffect(asText)(text)
        const back = restoredReview(stored)
        const plainOf = (decisions: ReviewState["decisions"]) => R.fromEntries(decisions)
        const history = (of: ReviewState) =>
          A.map(of.undo, (step) => [step.label, R.fromEntries(step.before), step.focus])
        expect(plainOf(back.decisions)).toEqual(plainOf(state.decisions))
        expect(history(back)).toEqual(history(state))
        const redoHistory = (of: ReviewState) =>
          A.map(of.redo ?? [], (step) => [step.label, R.fromEntries(step.before), step.focus])
        expect(redoHistory(back)).toEqual(redoHistory(state))
        // Undo after the refresh takes back the same step it would have taken before it.
        if (state.undo.length > 0) {
          expect(plainOf(act({ rows, state: back, action: Action.Undo() }).state.decisions)).toEqual(
            plainOf(act({ rows, state, action: Action.Undo() }).state.decisions)
          )
        }
      })
  )
})
