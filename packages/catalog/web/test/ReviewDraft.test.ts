// The review's draft while its screen is open, without the screen: the machine (`Draft.machine.ts`, tested on its own
// against every ordering) wired to the import's read and to the server. What is held here is the wiring: that a save
// sends the rows the person changed and nothing else, that its answer goes into the view held, that the server is
// asked again when it must be and the ask is not lost, and that leaving and coming back loses nothing.
import { describe, expect, it } from "@effect/vitest"
import { vi } from "vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { act, saved } from "@inventory/review/ReviewDraft"
import { ReviewRow } from "@inventory/review/ReviewTypes"
import {
  type DecisionDelta,
  type SaveRequest,
  decisionFromFlags,
  type SavedDecisions
} from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { DraftEvent, type RowChanges, settled } from "../src/Draft.machine.ts"
import { giveView, importTable, importView, importViewShown } from "../src/Imports.atoms.ts"
import {
  draftEvents,
  draftOf,
  followDraft,
  regionEpoch,
  reviewInput,
  reviewLocal,
  reviewState,
  reviewStateAt,
  shownDecisions,
  whileCurrent
} from "../src/ReviewDraft.atoms.ts"
import { importNo, registryFor, viewAt } from "./support/catalog.ts"

// What is said to the person.
const page = vi.hoisted(() => ({ said: [] as Array<string> }))
vi.mock("sonner", () => ({
  toast: Object.assign((title: string) => page.said.push(title), {
    dismiss: () => undefined,
    success: () => 0,
    loading: () => 0,
    error: (title: string) => page.said.push(title)
  })
}))

/** What the server answers a save with. */
type Saved = {
  readonly revision: number
  readonly changed: boolean
  readonly notApplied: ReadonlyArray<{ readonly rowId: string; readonly field: string }>
}

const settle = Effect.sleep("15 millis")
const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })

/** The server's refusal of a save (the import is no longer open), or its own failure, which is sent again. */
type Refusal = { readonly _tag: "AlreadyImported" } | { readonly _tag: "InternalServerErrorProblem" }

/** A server for one import: `get` and `decide` answer only when the test says so, and keep what they were sent. */
const world = (id: ImportId) => {
  const gets: Array<Deferred.Deferred<ImportView>> = []
  const saves: Array<{
    readonly delta: DecisionDelta
    readonly madeOn: Readonly<Record<string, number>>
    readonly answer: Deferred.Deferred<Saved, Refusal>
  }> = []
  const registry = registryFor({
    writesRetried: true,
    endpoints: {
      imports: {
        get: () => {
          const answer = Deferred.makeUnsafe<ImportView>()
          gets.push(answer)
          return Deferred.await(answer)
        },
        // Each time the request is sent (a retry too) is a save of its own, answered on its own.
        decide: (request: { readonly payload: SaveRequest }) =>
          Effect.suspend(() => {
            const answer = Deferred.makeUnsafe<Saved, Refusal>()
            // What it was made on is kept beside the rows, so a test of the rows reads the rows.
            const { madeOn, ...delta } = request.payload
            saves.push({ delta, madeOn, answer })
            return Deferred.await(answer)
          })
      }
    }
  })

  const at = (parts: Partial<ImportView> & { readonly revision: number }) => viewAt({ id, ...parts })
  return {
    registry,
    at,
    saves,
    deltas: () => A.map(saves, (save) => save.delta),
    /** The Review step is drawn: the import's read and the follower are mounted, as the step mounts them. */
    open: () => {
      const stopShown = registry.mount(importViewShown(id))
      const stopLocal = registry.mount(reviewLocal(id))
      const stopFollow = registry.mount(followDraft(id))
      // Leaving lets the screen's own state go; the import's read stays, as the import page keeps it.
      return () => {
        stopFollow()
        stopLocal()
        stopShown()
        registry.mount(importView(id))
      }
    },
    give: (view: ImportView) => registry.set(importView(id), view),
    answerGet: (n: number, view: ImportView) => Deferred.succeed(gets[n]!, view),
    /** The server answers a save: at this revision, and (unless the test says otherwise) as the save that moved it. */
    answerSave: (n: number, revision: number, changed = true) =>
      Deferred.succeed(saves[n]!.answer, { revision, changed, notApplied: [] }),
    refuseSave: (n: number) => Deferred.fail(saves[n]!.answer, { _tag: "AlreadyImported" } as const),
    /** The server fails the save itself: the client sends it again, later. */
    failSave: (n: number) => Deferred.fail(saves[n]!.answer, { _tag: "InternalServerErrorProblem" } as const),
    gets: () => gets.length,
    held: () => registry.get(importView(id)).pipe(AsyncResult.value, O.getOrThrow),
    draft: () => registry.get(draftOf(id)),
    shown: () => O.getOrThrow(registry.get(shownDecisions(id))),
    epoch: () => registry.get(regionEpoch(id))
  }
}

/** The person changes rows on the screen. */
const decide = (registry: AtomRegistry.AtomRegistry, id: ImportId, changes: RowChanges) =>
  registry.set(draftEvents(id), DraftEvent.Decided({ changes }))

describe("a saved decision", () => {
  it.live(
    "sends the rows the person changed and nothing else, and changes only the decisions and the revision of the view held",
    () =>
      Effect.gen(function* () {
        const id = importNo(1)
        const t = world(id)
        t.give(t.at({ revision: 10, decisions: { "row-7": kept } }))
        t.open()
        yield* settle
        decide(t.registry, id, { "row-1": O.some(out) })
        yield* settle
        expect(t.deltas()).toEqual([{ set: { "row-1": out }, clear: [] }])
        // Suggestions arrive while the save is out.
        const suggestions = [{ rowId: "row-3" }] as unknown as ImportView["suggestions"]
        t.give(t.at({ revision: 10, decisions: { "row-7": kept }, suggestions }))
        yield* t.answerSave(0, 11)
        yield* settle
        const held = t.held()
        expect([held.revision, held.decisions, held.suggestions]).toEqual([
          11,
          { "row-7": kept, "row-1": out },
          suggestions
        ])
        // The next revision of this screen's own save: nothing to ask the server for.
        expect(t.gets()).toBe(0)
        expect(settled(t.draft())).toBe(true)
      })
  )

  it.live(
    "that finds someone else saved in between asks again, keeps the person's row on screen, and never sends theirs",
    () =>
      Effect.gen(function* () {
        const id = importNo(2)
        const t = world(id)
        t.give(t.at({ revision: 10 }))
        t.open()
        yield* settle
        decide(t.registry, id, { "row-1": O.some(out) })
        yield* settle
        // Two revisions on: somebody else saved between.
        yield* t.answerSave(0, 12)
        yield* settle
        expect(t.gets()).toBe(1)
        expect(t.shown()).toEqual({ "row-1": out })
        const theirs: SavedDecisions = { "row-1": out, "row-5": kept }
        yield* t.answerGet(0, t.at({ revision: 12, decisions: theirs }))
        yield* settle
        expect([t.epoch(), t.shown(), O.map(t.draft().held, (held) => held.revision)]).toEqual([1, theirs, O.some(12)])
        // The next decision carries its own row only.
        decide(t.registry, id, { "row-9": O.some(out) })
        yield* settle
        expect(t.deltas()[1]).toEqual({ set: { "row-9": out }, clear: [] })
      })
  )

  it.live("that typed a SKU asks which items are already there, and the next save's answer does not end that ask", () =>
    Effect.gen(function* () {
      const id = importNo(3)
      const t = world(id)
      t.give(t.at({ revision: 10 }))
      t.open()
      yield* settle
      const typed = decisionFromFlags({ edits: { sku: "AB-1" } })
      decide(t.registry, id, { "row-1": O.some(typed) })
      yield* settle
      yield* t.answerSave(0, 11)
      yield* settle
      // Asked, and still out.
      expect(t.gets()).toBe(1)
      decide(t.registry, id, { "row-2": O.some(out) })
      yield* settle
      yield* t.answerSave(1, 12)
      yield* settle
      // The second save's answer is put into the view while the ask is out, and does not end it: one ask, still out.
      expect([t.gets(), t.held().revision]).toEqual([1, 12])
      const stored = [{ sku: "AB-1" }] as unknown as ImportView["storedItems"]
      // The ask lands with what the server held when it left. The view keeps the later picture the save put in place,
      // and the server is asked once more, for what that save changed.
      yield* t.answerGet(0, t.at({ revision: 11, decisions: { "row-1": typed }, storedItems: stored }))
      yield* settle
      expect([t.gets(), t.held().revision]).toEqual([2, 12])
      yield* t.answerGet(1, t.at({ revision: 12, decisions: { "row-1": typed, "row-2": out }, storedItems: stored }))
      yield* settle
      expect(t.held().storedItems).toEqual(stored)
      expect(t.shown()).toEqual({ "row-1": typed, "row-2": out })
    })
  )

  it.live(
    "that finds someone else saved, while a read that left after the save is out, asks once more: that read may have been served before the save was written",
    () =>
      Effect.gen(function* () {
        const id = importNo(11)
        const t = world(id)
        t.give(t.at({ revision: 10 }))
        t.open()
        yield* settle
        decide(t.registry, id, { "row-1": O.some(out) })
        yield* settle
        // The import is read again after the save left (the person came back to the tab), and is still out.
        t.registry.refresh(importView(id))
        yield* settle
        expect(t.gets()).toBe(1)
        // Two revisions on: somebody else saved between. The read left before this answer, so it may not have it.
        yield* t.answerSave(0, 12)
        yield* settle
        expect(t.gets()).toBe(1)
        // It was: the server read the import before it wrote the save. It is asked once more, and that one has both.
        yield* t.answerGet(0, t.at({ revision: 10 }))
        yield* settle
        expect(t.gets()).toBe(2)
        const theirs: SavedDecisions = { "row-1": out, "row-5": kept }
        yield* t.answerGet(1, t.at({ revision: 12, decisions: theirs }))
        yield* settle
        expect([t.gets(), t.shown(), O.map(t.draft().held, (held) => held.revision)]).toEqual([2, theirs, O.some(12)])
      })
  )

  it.live(
    "sent again after the server failed it, and answered while a read that left after the first try is out, asks once more",
    () =>
      Effect.gen(function* () {
        const id = importNo(13)
        const t = world(id)
        t.give(t.at({ revision: 10 }))
        t.open()
        yield* settle
        decide(t.registry, id, { "row-1": O.some(out) })
        yield* settle
        // The first try fails on the server; the client sends it again after a pause.
        yield* t.failSave(0)
        // Meanwhile the import is read again, and the server answers that read before it writes the second try.
        t.registry.refresh(importView(id))
        yield* settle
        expect([t.gets(), t.saves.length]).toEqual([1, 1])
        yield* Effect.sleep("1500 millis")
        expect(t.saves.length).toBe(2)
        // The second try answers: somebody else saved between. The read out left before this answer.
        yield* t.answerSave(1, 12)
        yield* settle
        yield* t.answerGet(0, t.at({ revision: 10 }))
        yield* settle
        // Asked once more, and that one has the person's row and the other person's.
        expect(t.gets()).toBe(2)
        const theirs: SavedDecisions = { "row-1": out, "row-5": kept }
        yield* t.answerGet(1, t.at({ revision: 12, decisions: theirs }))
        yield* settle
        expect([t.shown(), O.map(t.draft().held, (held) => held.revision)]).toEqual([theirs, O.some(12)])
      })
  )

  it.live("that finds someone else saved, while a read that left before the save is out, asks once more after it", () =>
    Effect.gen(function* () {
      const id = importNo(12)
      const t = world(id)
      t.give(t.at({ revision: 10 }))
      t.open()
      yield* settle
      t.registry.refresh(importView(id))
      yield* settle
      expect(t.gets()).toBe(1)
      // The save leaves while that read is out, and its answer says somebody else saved between.
      decide(t.registry, id, { "row-1": O.some(out) })
      yield* settle
      yield* t.answerSave(0, 12)
      yield* settle
      // The read is not ended: it lands with what the server held before the save, and only then is asked once more.
      expect(t.gets()).toBe(1)
      yield* t.answerGet(0, t.at({ revision: 10 }))
      yield* settle
      expect(t.gets()).toBe(2)
      expect(t.shown()).toEqual({ "row-1": out })
      const theirs: SavedDecisions = { "row-1": out, "row-5": kept }
      yield* t.answerGet(1, t.at({ revision: 12, decisions: theirs }))
      yield* settle
      expect([t.gets(), t.shown(), O.map(t.draft().held, (held) => held.revision)]).toEqual([2, theirs, O.some(12)])
    })
  )

  it.live("is not followed by a request when no SKU was typed, however many rows were decided", () =>
    Effect.gen(function* () {
      const id = importNo(4)
      const t = world(id)
      t.give(t.at({ revision: 10 }))
      t.open()
      yield* settle
      decide(t.registry, id, { "row-1": O.some(out), "row-2": O.some(out), "row-3": O.some(out) })
      yield* settle
      yield* t.answerSave(0, 11)
      yield* settle
      expect(t.gets()).toBe(0)
    })
  )

  it.live("the server refuses puts the screen back, asks again, and is not shown or sent again on the next visit", () =>
    Effect.gen(function* () {
      const id = importNo(5)
      const t = world(id)
      t.give(t.at({ revision: 10, decisions: { "row-7": kept } }))
      const leave = t.open()
      yield* settle
      decide(t.registry, id, { "row-1": O.some(out) })
      yield* settle
      page.said.length = 0
      yield* t.refuseSave(0)
      yield* settle
      expect([t.shown(), t.gets(), t.epoch()]).toEqual([{ "row-7": kept }, 1, 1])
      // The refusal is said as such, once; the region starting again is not said as another screen's change.
      expect(page.said).toEqual(["Your last decision was not saved"])
      leave()
      yield* settle
      t.open()
      yield* settle
      expect(t.shown()).toEqual({ "row-7": kept })
      decide(t.registry, id, { "row-2": O.some(out) })
      yield* settle
      expect(t.deltas()[1]).toEqual({ set: { "row-2": out }, clear: [] })
    })
  )
})

describe("leaving the Review step and coming back", () => {
  it.live(
    "while a save is out keeps the person's decision on screen; its answer is the person's own and starts nothing again",
    () =>
      Effect.gen(function* () {
        const id = importNo(6)
        const t = world(id)
        t.give(t.at({ revision: 10 }))
        const leave = t.open()
        yield* settle
        decide(t.registry, id, { "row-12": O.some(out) })
        yield* settle
        leave()
        yield* settle
        const before = t.epoch()
        yield* t.answerSave(0, 11)
        yield* settle
        expect([t.held().revision, t.held().decisions]).toEqual([11, { "row-12": out }])
        // The answer moved the view by the person's own row, and let the draft go (nobody looks): one new epoch, for
        // the let-go alone. Back on the step the region is drawn once, from the view as the save left it.
        expect(t.epoch()).toBe(before + 1)
        t.open()
        yield* settle
        expect([t.shown(), t.epoch()]).toEqual([{ "row-12": out }, before + 1])
      })
  )

  it.live("keeps nothing of the draft once the server has everything", () =>
    Effect.gen(function* () {
      const id = importNo(7)
      const t = world(id)
      t.give(t.at({ revision: 10 }))
      const leave = t.open()
      yield* settle
      decide(t.registry, id, { "row-1": O.some(out) })
      yield* settle
      yield* t.answerSave(0, 11)
      yield* settle
      leave()
      yield* settle
      expect(O.isNone(t.draft().held)).toBe(true)
      expect(R.isEmptyReadonlyRecord(t.draft().unsent)).toBe(true)
    })
  )
})

describe("a view put in place from a card's Continue", () => {
  it.live("never replaces a later revision the tab holds, and asks the server for nothing", () =>
    Effect.gen(function* () {
      const id = importNo(8)
      const t = world(id)
      t.registry.mount(giveView)
      // Nothing held: the card's view is the one, with no request.
      t.registry.set(giveView, t.at({ revision: 10 }))
      yield* settle
      expect(t.gets()).toBe(0)
      t.registry.mount(importView(id))
      yield* settle
      expect(t.held().revision).toBe(10)
      // The import's own screens were told of revision 12 since.
      t.give(t.at({ revision: 12, decisions: { "row-1": out } }))
      yield* settle
      t.registry.set(giveView, t.at({ revision: 10 }))
      yield* settle
      expect([t.held().revision, t.held().decisions]).toEqual([12, { "row-1": out }])
    })
  )
})

describe("the review's input", () => {
  it.live("stays the same object when the import is read again and only its draft moved", () =>
    Effect.gen(function* () {
      const id = importNo(9)
      const t = world(id)
      const table = { rows: [] } as unknown as StagedTable
      t.registry.set(importTable(id), table)
      t.registry.mount(importTable(id))
      t.give(t.at({ revision: 10 }))
      t.open()
      t.registry.mount(reviewInput(id))
      yield* settle
      const first = t.registry.get(reviewInput(id))
      expect(O.isSome(first)).toBe(true)
      // The same import decoded anew, one revision on: every part a new object with the same values.
      t.give(t.at({ revision: 11, decisions: { "row-1": out }, suggestions: [], choices: [] }))
      yield* settle
      expect(t.registry.get(reviewInput(id))).toBe(first)
    })
  )
})

describe("the decisions the review is worked out from", () => {
  it.live("stay the same object while the view answers the same and the screen's own state changes", () =>
    Effect.gen(function* () {
      const id = importNo(10)
      const t = world(id)
      t.give(t.at({ revision: 10, decisions: { "row-1": out } }))
      t.open()
      t.registry.mount(shownDecisions(id))
      yield* settle
      const first = t.registry.get(shownDecisions(id))
      // The view is read again and answers the same; a match starts and ends.
      t.give(t.at({ revision: 10, decisions: { "row-1": out } }))
      t.registry.set(draftEvents(id), DraftEvent.MatchStarted())
      t.registry.set(draftEvents(id), DraftEvent.MatchEnded())
      yield* settle
      expect(t.registry.get(shownDecisions(id))).toBe(first)
    })
  )
})

describe("the region's decisions for one import", () => {
  it.live("start once: nothing but a decision or a new draft works them out again", () =>
    Effect.gen(function* () {
      const id = importNo(40)
      const t = world(id)
      t.give(t.at({ revision: 10, decisions: { "row-1": out } }))
      t.open()
      let started = 0
      t.registry.subscribe(reviewState(id), () => (started += 1))
      yield* settle
      const first = t.registry.get(reviewState(id))
      expect(R.keys(saved(first))).toEqual(["row-1"])

      // What the screen changes while it is drawn again and again: none of it is the decisions.
      t.registry.update(reviewLocal(id), (now) => ({ ...now, suggested: O.none() }))
      t.registry.set(draftEvents(id), DraftEvent.MatchStarted())
      yield* settle
      expect(t.registry.get(reviewState(id))).toBe(first)
      expect(started).toBe(0)
    })
  )

  it.live("written by the region are shown, and the server is sent the rows the action changed, once", () =>
    Effect.gen(function* () {
      const id = importNo(41)
      const t = world(id)
      t.give(t.at({ revision: 10, decisions: { "row-7": kept } }))
      t.open()
      t.registry.mount(reviewState(id))
      yield* settle
      const before = t.registry.get(reviewState(id))
      const rows = [ReviewRow.make({ id: "row-2", line: 2, cells: {} })]
      const left = act({
        rows,
        state: before,
        action: { type: "leaveOut" as const, rowIds: ["row-2"] },
        recheck: undefined,
        fixable: () => false,
        rejects: false
      }).state

      t.registry.set(reviewState(id), left)
      yield* settle
      expect(t.registry.get(reviewState(id))).toBe(left)
      expect(t.shown()).toEqual({ "row-7": kept, "row-2": out })
      expect(t.deltas()).toEqual([{ set: { "row-2": out }, clear: [] }])

      // The undo takes back exactly the row of the step it undoes, while the first save is still out.
      const undone = act({
        rows,
        state: left,
        action: { type: "undo" as const },
        recheck: undefined,
        fixable: () => false,
        rejects: false
      })
      t.registry.set(reviewState(id), undone.state)
      yield* t.answerSave(0, 11)
      yield* settle
      expect(t.deltas()[1]).toEqual({ set: {}, clear: ["row-2"] })
      expect(t.shown()).toEqual({ "row-7": kept })
    })
  )

  it.live("of a region about to be drawn again from a newer draft are not handed to it first", () =>
    Effect.gen(function* () {
      const id = importNo(42)
      const t = world(id)
      t.give(t.at({ revision: 10, decisions: { "row-1": out } }))
      t.open()
      yield* settle
      const epoch = t.epoch()
      // What the region drawn at this epoch is given: its decisions, and something worked out from the draft (as
      // its rows are), each counted when it is worked out again.
      const mine = reviewStateAt(id)(epoch)
      const rows = whileCurrent({ id, epoch, source: shownDecisions(id) })
      let worked = 0
      t.registry.subscribe(mine, () => (worked += 1))
      t.registry.subscribe(rows, () => (worked += 1))
      const before = [t.registry.get(mine), t.registry.get(rows)]

      // Somebody else left another row out: the draft is newer, and the region is to be drawn again from it.
      t.give(t.at({ revision: 12, decisions: { "row-1": out, "row-5": out } }))
      yield* settle
      expect(t.epoch()).toBe(epoch + 1)
      // The region on its way out holds what it had: every row of it is not worked out again only to leave.
      expect([t.registry.get(mine), t.registry.get(rows)]).toEqual(before)
      expect(t.registry.get(mine)).toBe(before[0])
      expect(worked).toBe(0)
      // The region drawn at the new epoch starts from the newer draft.
      expect(R.keys(saved(t.registry.get(reviewStateAt(id)(epoch + 1))))).toEqual(["row-1", "row-5"])

      // And a write the replaced region still makes reaches nobody.
      const rowsOf = [ReviewRow.make({ id: "row-2", line: 2, cells: {} })]
      const late = act({
        rows: rowsOf,
        state: t.registry.get(mine),
        action: { type: "leaveOut" as const, rowIds: ["row-2"] },
        recheck: undefined,
        fixable: () => false,
        rejects: false
      }).state
      t.registry.set(mine, late)
      yield* settle
      expect(t.deltas()).toEqual([])
      expect(t.shown()).toEqual({ "row-1": out, "row-5": out })
    })
  )
})
