// The review's draft while its screen is open, without the screen: what a saved decision puts into the import's view,
// when the region starts again, and what the saver may be made to forget. Each rule is one where a wrong result loses
// a decision without a word: the person's own, or one somebody else made on the same import.
import { describe, expect, it } from "@effect/vitest"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { type DecisionDelta, decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { importView, importViewShown } from "../src/Imports.atoms.ts"
import { decideRows, followDraft, reviewLocal, shownDecisions } from "../src/ReviewDraft.atoms.ts"
import { importNo, registryWith, viewAt } from "./support/catalog.ts"

const settle = Effect.sleep("15 millis")
const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })

/** A server for one import: `get` and `decide` answer only when the test says so, and keep what they were sent. */
const world = (id: ImportId) => {
  const gets: Array<Deferred.Deferred<ImportView>> = []
  const saves: Array<{
    readonly delta: DecisionDelta
    readonly answer: Deferred.Deferred<{ readonly revision: number }>
  }> = []
  const registry = registryWith({
    imports: {
      get: () => {
        const answer = Deferred.makeUnsafe<ImportView>()
        gets.push(answer)
        return Deferred.await(answer)
      },
      decide: (request: { readonly payload: DecisionDelta }) => {
        const answer = Deferred.makeUnsafe<{ readonly revision: number }>()
        saves.push({ delta: request.payload, answer })
        return Deferred.await(answer)
      }
    }
  })
  const at = (parts: Partial<ImportView> & { readonly revision: number }) => viewAt({ id, ...parts })
  return {
    registry,
    at,
    saves,
    /** The screen opens: the import's read and the follower are mounted, as the Review step mounts them. */
    open: () => {
      registry.mount(importViewShown(id))
      const stopLocal = registry.mount(reviewLocal(id))
      const stopFollow = registry.mount(followDraft(id))
      const stopDecide = registry.mount(decideRows(id))
      // Leaving lets the screen's own state go; the import's read stays, as the import page keeps it.
      return () => {
        stopDecide()
        stopFollow()
        stopLocal()
      }
    },
    give: (view: ImportView) => registry.set(importView(id), view),
    askAgain: () => registry.refresh(importView(id)),
    answerGet: (n: number, view: ImportView) => Deferred.succeed(gets[n]!, view),
    answerSave: (n: number, revision: number) => Deferred.succeed(saves[n]!.answer, { revision }),
    gets: () => gets.length,
    held: () => registry.get(importView(id)).pipe(AsyncResult.value, O.getOrThrow),
    local: () => registry.get(reviewLocal(id))
  }
}

/** The person changes the screen's decisions. */
const decide = (registry: AtomRegistry.AtomRegistry, id: ImportId, decisions: SavedDecisions) =>
  registry.set(decideRows(id), decisions)

describe("a saved decision", () => {
  it.live("changes only the decisions and the revision of the view held when the save answers", () =>
    Effect.gen(function* () {
      const id = importNo(1)
      const t = world(id)
      t.give(t.at({ revision: 10 }))
      t.open()
      yield* settle
      decide(t.registry, id, { "row-1": out })
      yield* settle
      // Suggestions arrive while the save is out.
      const suggestions = [{ rowId: "row-3" }] as unknown as ImportView["suggestions"]
      t.give(t.at({ revision: 10, suggestions }))
      yield* t.answerSave(0, 11)
      yield* settle
      const held = t.held()
      expect([held.revision, held.decisions, held.suggestions]).toEqual([11, { "row-1": out }, suggestions])
      // The next revision of this screen's own save: nothing to ask the server for.
      expect(t.gets()).toBe(0)
    })
  )

  it.live("that finds someone else saved in between brings their decisions onto the screen", () =>
    Effect.gen(function* () {
      const id = importNo(2)
      const t = world(id)
      t.give(t.at({ revision: 10 }))
      t.open()
      yield* settle
      decide(t.registry, id, { "row-1": out })
      yield* settle
      // The server answers revision 13: two other saves landed before this one.
      yield* t.answerSave(0, 13)
      yield* settle
      expect(t.gets()).toBe(1)
      const theirs = { "row-1": out, "row-7": kept, "row-8": kept }
      yield* t.answerGet(0, t.at({ revision: 13, decisions: theirs }))
      yield* settle
      // The region starts again from everything the server holds, and the saver from the same.
      expect([t.local().epoch, O.getOrNull(t.local().decisions), O.getOrNull(t.local().known)]).toEqual([1, theirs, 13])
      decide(t.registry, id, { ...theirs, "row-9": out })
      yield* settle
      expect(t.saves[1]!.delta).toEqual({ set: { "row-9": out }, clear: [] })
    })
  )
})

describe("the review's follower", () => {
  it.live("starts the region again when a view newer than the one it was drawn from arrives", () =>
    Effect.gen(function* () {
      const id = importNo(3)
      const t = world(id)
      t.give(t.at({ revision: 20 }))
      const stop = t.registry.mount(importViewShown(id))
      yield* settle
      // The person comes back to the tab: the import is asked again, and the Review opens before it answers.
      t.askAgain()
      yield* settle
      expect(t.held().revision).toBe(20)
      const stopFollow = t.open()
      yield* settle
      // Someone else decided five rows meanwhile.
      const theirs = { "row-1": kept, "row-2": kept, "row-3": kept, "row-4": kept, "row-5": kept }
      yield* t.answerGet(0, t.at({ revision: 25, decisions: theirs }))
      yield* settle
      expect([t.local().epoch, O.getOrNull(t.local().decisions), O.getOrNull(t.local().known)]).toEqual([1, theirs, 25])
      // The next decision is sent on top of theirs: nothing of theirs is cleared.
      decide(t.registry, id, { ...theirs, "row-9": out })
      yield* settle
      expect(t.saves[0]!.delta).toEqual({ set: { "row-9": out }, clear: [] })
      stopFollow()
      stop()
    })
  )

  it.live("coming back while a save is out keeps the person's decision on screen and in the saver", () =>
    Effect.gen(function* () {
      const id = importNo(4)
      const t = world(id)
      t.give(t.at({ revision: 10 }))
      const leave = t.open()
      yield* settle
      decide(t.registry, id, { "row-12": out })
      yield* settle
      // To Match and back: the screen's own state is let go, the save is still out.
      leave()
      yield* settle
      t.open()
      yield* settle
      // The view held does not have row 12 yet; the screen shows it all the same.
      expect(t.held().decisions).toEqual({})
      expect(O.getOrNull(t.local().decisions)).toEqual({ "row-12": out })
      yield* t.answerSave(0, 11)
      yield* settle
      // Nothing more is sent: no request that takes row 12 back.
      expect(t.saves).toHaveLength(1)
      expect(t.held().decisions).toEqual({ "row-12": out })
    })
  )
})

describe("the decisions the review is worked out from", () => {
  it.live("stay the same object while the view answers the same and the screen's own state changes", () =>
    Effect.gen(function* () {
      const id = importNo(5)
      const t = world(id)
      const decisions = { "row-1": out }
      t.give(t.at({ revision: 10, decisions }))
      let worked = 0
      const stop = t.registry.subscribe(shownDecisions(id), () => worked++, { immediate: true })
      t.open()
      yield* settle
      const first = t.registry.get(shownDecisions(id))
      // The tab comes back: the import is asked again and answers the same.
      t.askAgain()
      yield* settle
      yield* t.answerGet(0, t.at({ revision: 10, decisions }))
      yield* settle
      // A match made on this screen is on its way.
      t.registry.set(reviewLocal(id), { ...t.local(), matching: true })
      yield* settle
      expect(t.registry.get(shownDecisions(id))).toBe(first)
      expect(worked).toBe(1)
      stop()
    })
  )
})
