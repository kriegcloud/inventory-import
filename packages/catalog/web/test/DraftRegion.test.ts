import type { ReviewColumn } from "@inventory/review/ReviewTypes"
// The review region's own state beside the draft, wired: the region holds its decisions with their undo history
// (`reviewState`), and the draft says when it must start again from what is shown now. What is held here is that the
// region really does: after another person's row arrives, what the region reads is what the screen shows, said once
// as a change from another screen, and not said for the person's own match; and a return inside the idle time, when
// the view changed meanwhile, does not find the region as it was.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as A from "effect/Array"
import { assertTrue } from "@effect/vitest/utils"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as HttpApiError from "effect/http-api/HttpApiError"
import { vi } from "vitest"
import { act, saved } from "@inventory/review/ReviewDraft"
import { ReviewRow } from "@inventory/review/ReviewTypes"
import {
  type DecisionDelta,
  type SavedDecisions,
  type SaveRequest,
  decisionFromFlags
} from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { draftOf } from "../src/Draft.atoms.ts"
import { DraftEvent } from "../src/Draft.machine.ts"
import { importView, importViewShown } from "../src/Imports.atoms.ts"
import {
  draftEvents,
  followDraft,
  regionEpoch,
  reviewLocal,
  reviewState,
  reviewStateAt,
  rowsNotSaved
} from "../src/ReviewDraft.atoms.ts"
import { importNo, registryFor, viewAt, registryStart } from "./support/catalog.ts"

/** These rule-only cases declare no drawing columns; the same domain is reused between decisions. */
const reviewColumns: ReadonlyArray<ReviewColumn> = []

// What is said to the person.
const page = vi.hoisted(() => ({
  said: [] as Array<string>,
  descriptions: [] as Array<O.Option<string>>,
  actions: [] as Array<() => void>
}))
vi.mock("sonner", () => ({
  toast: Object.assign((title: string) => page.said.push(title), {
    dismiss: () => undefined,
    success: () => 0,
    loading: () => 0,
    error: (title: string, options?: { description?: string; action?: { onClick: () => void } }) => {
      page.said.push(title)
      page.descriptions.push(O.fromUndefinedOr(options?.description))
      O.map(O.fromUndefinedOr(options?.action), (action) => page.actions.push(action.onClick))
      return 0
    }
  })
}))

const settle = Effect.sleep("15 millis")
const out = decisionFromFlags({ out: true })
const rows = [ReviewRow.make({ id: "row-2", line: 2, cells: {} }), ReviewRow.make({ id: "row-5", line: 5, cells: {} })]

/**
 * One import with a server that takes every save and answers the next revision; the app's idle time is 120 ms here.
 * With `reads`, the server answers a read of the import with what it holds; otherwise a read never answers.
 */
const networkStart = { down: false }
const world = (id: ImportId, network: { down: boolean }, reads: boolean) => {
  const saves: Array<DecisionDelta> = []
  const revision = { now: 10 }
  const stored: Record<string, SavedDecisions[string]> = {}
  const at = (parts: Partial<ImportView> & { readonly revision: number }) => viewAt({ id, ...parts })
  const registry = registryFor({
    ...registryStart,
    endpoints: {
      imports: {
        get: () => (reads ? Effect.sync(() => at({ revision: revision.now, decisions: { ...stored } })) : Effect.never),
        decide: (request: { readonly payload: SaveRequest }) =>
          Effect.suspend(() => {
            const { madeOn: _madeOn, ...delta } = request.payload
            saves.push(delta)
            // The server's own failure, as the API says it: the request was fine, so it may pass when sent again.
            if (network.down) return Effect.fail(HttpApiError.InternalServerErrorProblem.make({}))
            revision.now += 1
            Object.assign(stored, delta.set)
            for (const rowId of delta.clear) delete stored[rowId]
            return Effect.succeed({ revision: revision.now, changed: true, notApplied: [], decidedSince: [] })
          })
      }
    },
    idleTTL: O.some(120)
  })
  registry.set(importView(id), at({ revision: 10 }))
  return {
    registry,
    at,
    saves,
    /** The Review step is drawn: what it mounts, and the region of the epoch it is drawn at. */
    open: () => {
      const stops = [
        registry.mount(importViewShown(id)),
        registry.mount(reviewLocal(id)),
        registry.mount(followDraft(id)),
        registry.mount(reviewStateAt(id)(registry.get(regionEpoch(id))))
      ]
      return () => {
        for (const stop of stops) stop()
        registry.mount(importView(id))
      }
    },
    /** The person leaves a row out, in the region. */
    leaveOut: (rowId: string) =>
      registry.set(
        reviewState(id),
        act({
          columns: reviewColumns,
          rows,
          state: registry.get(reviewState(id)),
          action: { type: "leaveOut" as const, rowIds: [rowId] },
          recheck: O.none(),
          fixable: () => false,
          rejects: false
        }).state
      ),
    /** The rows the region holds a decision for, and how many steps its Undo can take back. */
    region: () => {
      const state = registry.get(reviewState(id))
      return [R.keys(saved(state)), state.undo.length] as const
    },
    give: (view: ImportView) => registry.set(importView(id), view),
    happened: (event: DraftEvent) => registry.set(draftEvents(id), event),
    /** Which region the draft is at: one more each time the region must start again. */
    epoch: () => registry.get(regionEpoch(id))
  }
}

describe("the region beside the draft", () => {
  it.live("starts again from what is shown when another person's row arrives, and says so once", () =>
    Effect.gen(function* () {
      const id = importNo(41)
      const t = world(id, { ...networkStart, down: false }, false)
      t.open()
      yield* settle
      page.said.length = 0
      t.leaveOut("row-2")
      yield* settle
      expect([t.saves, t.region()]).toEqual([[{ over: {}, set: { "row-2": out }, clear: [] }], [["row-2"], 1]])
      // Somebody else left row 5 out.
      t.give(t.at({ revision: 12, decisions: { "row-2": out, "row-5": out } }))
      yield* settle
      // The region reads both rows now, with a new history: its own state did not go on saying one.
      expect(t.region()).toEqual([["row-2", "row-5"], 0])
      expect(page.said).toEqual(["Updated with what changed on another screen"])

      // The person's own match brings a new view too: the region follows it, and nothing is said of another screen.
      t.happened(DraftEvent.MatchStarted())
      t.give(t.at({ revision: 13, decisions: { "row-5": out } }))
      yield* settle
      t.happened(DraftEvent.MatchEnded())
      expect([t.region()[0], page.said.length]).toEqual([["row-5"], 1])
    })
  )

  it.live("is not found as it was on a return inside the idle time, when the view changed meanwhile", () =>
    Effect.gen(function* () {
      const id = importNo(42)
      const t = world(id, { ...networkStart, down: false }, false)
      const leave = t.open()
      yield* settle
      t.leaveOut("row-2")
      yield* settle
      expect(t.region()).toEqual([["row-2"], 1])
      page.said.length = 0
      const before = t.epoch()
      leave()
      // The step is gone (the draft was let go) before anything changes: what follows is not seen by a step on screen.
      yield* settle
      // Away for less than the idle time: somebody else leaves row 5 out, and the tab's view is told.
      t.give(t.at({ revision: 12, decisions: { "row-2": out, "row-5": out } }))
      yield* settle
      t.open()
      yield* settle
      // The region starts from what is shown, with a history of its own: not the region it was when the step left. It
      // was started again once, by the let-go, and nothing was said of another screen.
      expect([t.region(), t.epoch(), page.said]).toEqual([[["row-2", "row-5"], 0], before + 1, []])
    })
  )

  it.live(
    "keeps a row whose save failed, says so once with Save again, and that button sends the same row once the import is read",
    () =>
      Effect.gen(function* () {
        const id = importNo(43)
        const network = { down: true }
        const t = world(id, network, true)
        const leave = t.open()
        yield* settle
        page.said.length = 0
        page.actions.length = 0
        t.leaveOut("row-2")
        yield* settle
        // Sent once, failed: the row is still what the region shows, and the person is told it is not saved yet.
        expect([t.saves, t.region()[0], page.said]).toEqual([
          [{ over: {}, set: { "row-2": out }, clear: [] }],
          ["row-2"],
          ["Not saved yet"]
        ])
        expect(t.registry.get(rowsNotSaved(id))).toBe(1)
        // The button says what it does: it sends the row now, wherever the person is.
        const description = A.last(page.descriptions)
        assertTrue(O.isSome(description), "the refusal toast was recorded")
        assertTrue(O.isSome(description.value), "the refusal toast has its description")
        expect(description.value.value).toContain("Save again sends it now")
        // The network is back, the person has gone to another page, and presses Save again on what was said: the row
        // goes, as one that waited, over what the server may hold of it (nothing, when it was decided, or itself).
        leave()
        yield* Effect.sleep("300 millis")
        expect(t.registry.get(draftOf(id)).onScreen).toBe(false)
        network.down = false
        page.actions[0]?.()
        yield* settle
        expect(t.saves).toEqual([
          { over: {}, set: { "row-2": out }, clear: [] },
          { over: { "row-2": [O.none(), O.some(out)] }, set: { "row-2": out }, clear: [] }
        ])
        expect([t.registry.get(rowsNotSaved(id)), page.said]).toEqual([0, ["Not saved yet"]])
      })
  )
})
