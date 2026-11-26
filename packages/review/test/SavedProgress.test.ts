import { fixableBy } from "@inventory/review/ReviewDraft"
// What a refresh brings back. The rules that would hurt if wrong: progress saved for one person in one organization is
// never read for anyone else; the decisions and the undo history come back exactly as they were left; a draft that no
// longer decodes is never shown half; and what this browser kept before the atoms kept it is still read.
import { it } from "@effect/vitest"
import * as A from "effect/Array"
import * as ByteSize from "effect/ByteSize"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { describe, expect, vi } from "vitest"
import { ReviewDecision } from "@inventory/review/ReviewDecision"
import { act, emptyState } from "@inventory/review/ReviewDraft"
import { Problem, ReviewRow } from "@inventory/review/ReviewTypes"
import type { ReviewState } from "@inventory/review/ReviewTypes"
import {
  progressKey,
  restoredReview,
  SavedProgress,
  StoredFile,
  storedReview,
  StoredReview
} from "@inventory/review/SavedProgress"
import { progressOf } from "@inventory/review/SavedProgressHook"
import { density } from "../src/Density.atoms.ts"

// The browser's storage, which outlives a refresh. `refuse` makes it a full disk: every write throws.
const browser = vi.hoisted(() => {
  const state = { items: {} as Record<string, string>, refuse: false }
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => state.items[key] ?? null,
        setItem: (key: string, value: string) => {
          if (state.refuse) throw new Error("QuotaExceededError")
          state.items[key] = value
        },
        removeItem: (key: string) => {
          delete state.items[key]
        }
      }
    }
  })
  return state
})

/** A page: its own registry on the same storage. A refresh is the next page. */
const page = () => AtomRegistry.make()
const settle = Effect.sleep("10 millis")
const fresh = Effect.sync(() => {
  browser.items = {}
  browser.refuse = false
})

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

  it.live(
    "never reads one member's progress for another member or another organization, and a clear leaves nothing",
    () =>
      Effect.gen(function* () {
        yield* fresh
        const dana = { organizationId: "org_prairie", memberId: "mem_dana", screen: "import" }
        // Written with nobody reading it, as a Confirm or a decision made outside any screen writes it.
        page().set(progressOf(O.some(dana)), O.some(progress("review")))
        yield* settle
        expect(R.keys(browser.items)).toEqual([progressKey(dana)])
        const next = page()
        expect(O.map(next.get(progressOf(O.some(dana))), (kept) => kept.step)).toEqual(O.some("review"))
        expect(next.get(progressOf(O.some({ ...dana, memberId: "mem_marcus" })))).toEqual(O.none())
        expect(next.get(progressOf(O.some({ ...dana, organizationId: "org_northline" })))).toEqual(O.none())
        yield* settle
        // Looking at somebody's progress that is not there writes nothing under their key.
        expect(R.keys(browser.items)).toEqual([progressKey(dana)])
        next.set(progressOf(O.some(dana)), O.none())
        yield* settle
        expect(R.keys(browser.items)).toEqual([])
        expect(page().get(progressOf(O.some(dana)))).toEqual(O.none())
      })
  )

  it.live("reads the progress this browser kept before the atom kept it: the same text under the same key", () =>
    Effect.gen(function* () {
      yield* fresh
      const scope = { organizationId: "org_prairie", memberId: "mem_dana", screen: "import" }
      const text = yield* S.encodeEffect(S.fromJsonString(SavedProgress))(progress("review"))
      browser.items[progressKey(scope)] = text
      const read = page().get(progressOf(O.some(scope)))
      expect(O.map(read, (kept) => [kept.step, kept.decided, kept.needed])).toEqual(O.some(["review", 1, 4]))
      // And what the atom writes is that text: an older page of the app still reads it.
      delete browser.items[progressKey(scope)]
      page().set(progressOf(O.some(scope)), read)
      yield* settle
      expect(browser.items[progressKey(scope)]).toBe(text)
    })
  )

  it.live("does not offer a stored draft that no longer decodes, and the next write replaces it", () =>
    Effect.gen(function* () {
      yield* fresh
      const scope = { organizationId: "org_prairie", memberId: "mem_dana", screen: "import" }
      browser.items[progressKey(scope)] = '{"version":0,"step":"review"}'
      const first = page()
      expect(first.get(progressOf(O.some(scope)))).toEqual(O.none())
      first.set(progressOf(O.some(scope)), O.some(progress("match")))
      yield* settle
      expect(O.map(page().get(progressOf(O.some(scope))), (kept) => kept.step)).toEqual(O.some("match"))
    })
  )

  it.live("holds the progress for the visit where the browser keeps nothing, and says nothing", () =>
    Effect.gen(function* () {
      yield* fresh
      browser.refuse = true
      const scope = { organizationId: "org_prairie", memberId: "mem_dana", screen: "import" }
      const here = page()
      const stop = here.mount(progressOf(O.some(scope)))
      here.set(progressOf(O.some(scope)), O.some(progress("review")))
      yield* settle
      expect(O.map(here.get(progressOf(O.some(scope))), (kept) => kept.step)).toEqual(O.some("review"))
      expect(R.keys(browser.items)).toEqual([])
      stop()
    })
  )

  it.live("keeps the row height, and reads the bare word an older page of the app kept", () =>
    Effect.gen(function* () {
      yield* fresh
      browser.items["review-density"] = "comfortable"
      const first = page()
      expect(first.get(density)).toBe("comfortable")
      first.set(density, "compact")
      yield* settle
      expect(page().get(density)).toBe("compact")
      // With nothing kept it is compact, and reading it keeps that.
      yield* fresh
      expect(page().get(density)).toBe("compact")
    })
  )

  // Rows with a problem in one column; the person types values and leaves rows out in any order.
  const rows: ReadonlyArray<ReviewRow> = A.makeBy(6, (i) =>
    ReviewRow.make({
      id: `row-${i + 2}`,
      line: i + 2,
      cells: { name: `Item ${i}`, qty: "" },
      problem: O.some(Problem.make({ kind: "blank", column: O.some("qty") }))
    })
  )
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
            ? { type: "leaveOut" as const, rowIds: [row.id] }
            : { type: "edit" as const, rowId: row.id, column: "qty", value: step.value }
          state = act({ recheck: O.none(), fixable: fixableBy([]), rejects: false, rows, state, action }).state
        }
        for (let i = 0; i < undos; i++)
          state = act({
            recheck: O.none(),
            fixable: fixableBy([]),
            rejects: false,
            rows,
            state,
            action: { type: "undo" as const }
          }).state
        // And one redo, so the redo history makes the trip too.
        if (undos > 1)
          state = act({
            recheck: O.none(),
            fixable: fixableBy([]),
            rejects: false,
            rows,
            state,
            action: { type: "redo" as const }
          }).state
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
          expect(
            plainOf(
              act({
                recheck: O.none(),
                fixable: fixableBy([]),
                rejects: false,
                rows,
                state: back,
                action: { type: "undo" as const }
              }).state.decisions
            )
          ).toEqual(
            plainOf(
              act({
                recheck: O.none(),
                fixable: fixableBy([]),
                rejects: false,
                rows,
                state,
                action: { type: "undo" as const }
              }).state.decisions
            )
          )
        }
      })
  )
})
