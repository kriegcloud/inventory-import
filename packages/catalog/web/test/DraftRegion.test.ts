// The review region's own state beside the draft, wired: the region holds its decisions with their undo history
// (`reviewState`), and the draft says when it must start again from what is shown now. What is held here is that the
// region really does: after another person's row arrives, what the region reads is what the screen shows, said once
// as a change from another screen, and not said for the person's own match; and a return inside the idle time, when
// the view changed meanwhile, does not find the region as it was.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import { vi } from "vitest"
import { act, saved } from "@inventory/review/ReviewDraft"
import { ReviewRow } from "@inventory/review/ReviewTypes"
import { type DecisionDelta, type SaveRequest, decisionFromFlags } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
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
import { importNo, registryFor, viewAt } from "./support/catalog.ts"

// What is said to the person.
const page = vi.hoisted(() => ({ said: [] as Array<string>, actions: [] as Array<() => void> }))
vi.mock("sonner", () => ({
  toast: Object.assign((title: string) => page.said.push(title), {
    dismiss: () => undefined,
    success: () => 0,
    loading: () => 0,
    error: (title: string, options?: { action?: { onClick: () => void } }) => {
      page.said.push(title)
      if (options?.action !== undefined) page.actions.push(options.action.onClick)
      return 0
    }
  })
}))

const settle = Effect.sleep("15 millis")
const out = decisionFromFlags({ out: true })
const rows = [ReviewRow.make({ id: "row-2", line: 2, cells: {} }), ReviewRow.make({ id: "row-5", line: 5, cells: {} })]

/** One import with a server that takes every save and answers the next revision; the app's idle time is 120 ms here. */
const world = (id: ImportId, network: { down: boolean } = { down: false }) => {
  const saves: Array<DecisionDelta> = []
  const revision = { now: 10 }
  const registry = registryFor({
    endpoints: {
      imports: {
        get: () => Effect.never,
        decide: (request: { readonly payload: SaveRequest }) => {
          const { madeOn: _madeOn, ...delta } = request.payload
          saves.push(delta)
          // The server's own failure, as the API says it: the request was fine, so it may pass when sent again.
          if (network.down) return Effect.fail({ _tag: "InternalServerErrorProblem" } as const)
          revision.now += 1
          return Effect.succeed({ revision: revision.now, changed: true, notApplied: [] })
        }
      }
    },
    idleTTL: 120
  })
  const at = (parts: Partial<ImportView> & { readonly revision: number }) => viewAt({ id, ...parts })
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
          rows,
          state: registry.get(reviewState(id)),
          action: { type: "leaveOut" as const, rowIds: [rowId] },
          recheck: undefined,
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
    happened: (event: DraftEvent) => registry.set(draftEvents(id), event)
  }
}

describe("the region beside the draft", () => {
  it.live("starts again from what is shown when another person's row arrives, and says so once", () =>
    Effect.gen(function* () {
      const id = importNo(41)
      const t = world(id)
      t.open()
      yield* settle
      page.said.length = 0
      t.leaveOut("row-2")
      yield* settle
      expect([t.saves, t.region()]).toEqual([[{ set: { "row-2": out }, clear: [] }], [["row-2"], 1]])
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
      const t = world(id)
      const leave = t.open()
      yield* settle
      t.leaveOut("row-2")
      yield* settle
      expect(t.region()).toEqual([["row-2"], 1])
      leave()
      // The step is gone (the draft was let go) before anything changes: what follows is not seen by a step on screen.
      yield* settle
      // Away for less than the idle time: somebody else leaves row 5 out, and the tab's view is told.
      t.give(t.at({ revision: 12, decisions: { "row-2": out, "row-5": out } }))
      yield* settle
      t.open()
      yield* settle
      // The region starts from what is shown, with a history of its own: not the region it was when the step left.
      expect(t.region()).toEqual([["row-2", "row-5"], 0])
    })
  )

  it.live("keeps a row whose save failed, says so once with Save again, and that button sends the same row", () =>
    Effect.gen(function* () {
      const id = importNo(43)
      const network = { down: true }
      const t = world(id, network)
      t.open()
      yield* settle
      page.said.length = 0
      page.actions.length = 0
      t.leaveOut("row-2")
      yield* settle
      // Sent once, failed: the row is still what the region shows, and the person is told it is not saved yet.
      expect([t.saves, t.region()[0], page.said]).toEqual([
        [{ set: { "row-2": out }, clear: [] }],
        ["row-2"],
        ["Not saved yet"]
      ])
      expect(t.registry.get(rowsNotSaved(id))).toBe(1)
      // The network is back, and the person presses Save again on what was said.
      network.down = false
      page.actions[0]?.()
      yield* settle
      expect(t.saves).toEqual([
        { set: { "row-2": out }, clear: [] },
        { set: { "row-2": out }, clear: [] }
      ])
      expect([t.registry.get(rowsNotSaved(id)), page.said]).toEqual([0, ["Not saved yet"]])
    })
  )
})
