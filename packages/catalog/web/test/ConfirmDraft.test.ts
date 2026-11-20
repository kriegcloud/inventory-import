// A confirm, wired to the import's read and to the server, without the screen. The machine (`Draft.machine.ts`) says
// when a confirm goes and what it carries; what is held here is that the request is that and nothing more (the
// revision the screen holds, the person's rows not saved yet), that a refusal because the draft moved on writes
// nothing here either, asks for the newer picture and is said on the screen, and that a confirm the server made puts
// the result in place and takes the person to it.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { vi } from "vitest"
import {
  type ConfirmRequest,
  type DecisionDelta,
  decisionFromFlags,
  type SaveRequest
} from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { AcceptsTakenBack, DraftMoved } from "@inventory/catalog-contract/ImportRejection"
import { DraftEvent } from "../src/Draft.machine.ts"
import { importView, importViewShown } from "../src/Imports.atoms.ts"
import {
  confirmHeldBack,
  confirmingImport,
  draftEvents,
  draftOf,
  followDraft,
  reviewLocal,
  shownDecisions
} from "../src/ReviewDraft.atoms.ts"
import { importNo, registryWith, viewAt } from "./support/catalog.ts"

// The page: where the person is taken, and what is said to them.
const page = vi.hoisted(() => {
  const state = { went: [] as Array<string>, said: [] as Array<string> }
  Object.assign(globalThis, {
    window: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      location: { pathname: "/", search: "" },
      history: {
        pushState: (_state: unknown, _title: string, to: string) => state.went.push(to),
        replaceState: () => undefined
      }
    }
  })
  return state
})
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

/** What the server refuses a confirm with. */
type Refusal = DraftMoved | AcceptsTakenBack | { readonly _tag: "AlreadyImported" }

/** A server for one import: every request answers only when the test says so, and is kept as it was sent. */
const world = (id: ImportId) => {
  const gets: Array<Deferred.Deferred<ImportView>> = []
  const saves: Array<{
    readonly delta: DecisionDelta
    readonly madeOn: Readonly<Record<string, number>>
    readonly answer: Deferred.Deferred<Saved, { readonly _tag: "InternalServerErrorProblem" }>
  }> = []
  const confirms: Array<{ readonly payload: ConfirmRequest; readonly answer: Deferred.Deferred<ImportView, Refusal> }> =
    []
  const registry = registryWith({
    imports: {
      get: () => {
        const answer = Deferred.makeUnsafe<ImportView>()
        gets.push(answer)
        return Deferred.await(answer)
      },
      decide: (request: { readonly payload: SaveRequest }) => {
        const answer = Deferred.makeUnsafe<Saved, { readonly _tag: "InternalServerErrorProblem" }>()
        // What it was made on is kept beside the rows, so a test of the rows reads the rows.
        const { madeOn, ...delta } = request.payload
        saves.push({ delta, madeOn, answer })
        return Deferred.await(answer)
      },
      commit: (request: { readonly payload: ConfirmRequest }) => {
        const answer = Deferred.makeUnsafe<ImportView, Refusal>()
        confirms.push({ payload: request.payload, answer })
        return Deferred.await(answer)
      }
    }
  })
  const at = (parts: Partial<ImportView> & { readonly revision: number }) => viewAt({ id, ...parts })
  registry.set(importView(id), at({ revision: 10, decisions: { "row-7": kept } }))
  registry.mount(importViewShown(id))
  registry.mount(reviewLocal(id))
  registry.mount(followDraft(id))
  const happened = (event: DraftEvent) => registry.set(draftEvents(id), event)
  return {
    registry,
    at,
    gets,
    saves,
    confirms,
    sent: () => A.map(confirms, (confirm) => confirm.payload),
    decide: (rowId: string) => happened(DraftEvent.Decided({ changes: { [rowId]: O.some(out) } })),
    press: () => happened(DraftEvent.ConfirmPressed()),
    confirming: () => registry.get(confirmingImport(id)),
    heldBack: () => registry.get(confirmHeldBack(id)),
    shown: () => O.getOrThrow(registry.get(shownDecisions(id))),
    held: () => registry.get(importView(id)).pipe(AsyncResult.value, O.getOrThrow),
    draft: () => registry.get(draftOf(id))
  }
}

describe("a confirm", () => {
  it.live("waits for the save that is out, then names the revision that save left and carries nothing else", () =>
    Effect.gen(function* () {
      const id = importNo(31)
      const t = world(id)
      yield* settle
      t.decide("row-1")
      yield* settle
      t.press()
      yield* settle
      expect([t.sent(), t.confirming()]).toEqual([[], true])
      yield* Deferred.succeed(t.saves[0]!.answer, { revision: 11, changed: true, notApplied: [] })
      yield* settle
      // Row 1 is saved; the confirm carries no row at all, only the revision the screen now holds.
      expect(t.sent()).toEqual([{ revision: 11, madeOn: {}, set: {}, clear: [] }])
      expect(t.saves.length).toBe(1)
    })
  )

  it.live(
    "refused because the draft moved on is said on the screen, asks for the newer picture, and is not sent again",
    () =>
      Effect.gen(function* () {
        const id = importNo(32)
        const t = world(id)
        yield* settle
        page.went.length = 0
        page.said.length = 0
        t.press()
        yield* settle
        expect(t.sent()).toEqual([{ revision: 10, madeOn: {}, set: {}, clear: [] }])
        const asked = t.gets.length
        yield* Deferred.fail(
          t.confirms[0]!.answer,
          DraftMoved.make({ reason: "Someone else changed this import.", revision: 11 })
        )
        yield* settle
        // Nothing was imported and the screen says so above the review, not in a toast that goes away; the button
        // waits while the newer picture is read.
        expect([t.confirming(), t.heldBack(), page.said, page.went]).toEqual([
          true,
          O.some({ read: false, apart: 0, accepts: [] }),
          [],
          []
        ])
        expect([t.gets.length, t.confirms.length]).toEqual([asked + 1, 1])
        // The newer picture: somebody else left row 5 out.
        yield* Deferred.succeed(
          O.getOrThrow(A.last(t.gets)),
          t.at({ revision: 11, decisions: { "row-7": kept, "row-5": out } })
        )
        yield* settle
        expect([t.shown(), t.heldBack(), t.confirming()]).toEqual([
          { "row-7": kept, "row-5": out },
          O.some({ read: true, apart: 1, accepts: [] }),
          false
        ])

        // The person has seen it and confirms again: on the newer revision, and the server makes it.
        t.press()
        yield* settle
        expect([O.map(A.last(t.sent()), (sent) => sent.revision), t.heldBack()]).toEqual([O.some(11), O.none()])
        const result = { created: 3 } as unknown as ImportView["result"]
        yield* Deferred.succeed(t.confirms[1]!.answer, t.at({ revision: 12, status: "imported", result }))
        yield* settle
        expect([t.held().revision, t.held().status]).toEqual([12, "imported"])
        // The draft ends on the confirmed picture: nothing held, nothing left over (every row was in the confirm).
        expect([t.draft().ended, t.draft().leftOver, O.isNone(t.draft().held), t.draft().unsent]).toEqual([
          true,
          O.none(),
          true,
          {}
        ])
        expect(page.went).toEqual([`/?import=${id}&step=result`])
      })
  )

  it.live("refused because somebody else confirmed it is said, and the import is asked again", () =>
    Effect.gen(function* () {
      const id = importNo(33)
      const t = world(id)
      yield* settle
      t.decide("row-1")
      yield* settle
      yield* Deferred.succeed(t.saves[0]!.answer, { revision: 11, changed: true, notApplied: [] })
      yield* settle
      page.said.length = 0
      page.went.length = 0
      t.press()
      yield* settle
      const asked = t.gets.length
      yield* Deferred.fail(t.confirms[0]!.answer, { _tag: "AlreadyImported" } as const)
      yield* settle
      expect([t.confirming(), t.heldBack(), page.said.length, page.went]).toEqual([false, O.none(), 1, []])
      expect(t.gets.length).toBe(asked + 1)
    })
  )

  it.live("a save answered without an accept says so, and the row shows its proposal open again", () =>
    Effect.gen(function* () {
      const id = importNo(35)
      const t = world(id)
      yield* settle
      page.said.length = 0
      const accepted = decisionFromFlags({ accepted: ["unitCost"] })
      t.registry.set(draftEvents(id), DraftEvent.Decided({ changes: { "row-55": O.some(accepted) } }))
      yield* settle
      expect(t.saves[0]?.madeOn).toEqual({ "row-55": 10 })
      yield* Deferred.succeed(t.saves[0]!.answer, {
        revision: 11,
        changed: true,
        notApplied: [{ rowId: "row-55", field: "unitCost" }]
      })
      yield* settle
      expect(page.said).toEqual(["An accept was taken back"])
      expect(t.shown()["row-55"]).toEqual(decisionFromFlags({}))
    })
  )

  it.live(
    "refused for an accept made before its column was matched again: nothing was imported, the accept is named once the newer picture is read, and the row is saved without it",
    () =>
      Effect.gen(function* () {
        const id = importNo(36)
        const t = world(id)
        yield* settle
        page.said.length = 0
        const accepted = decisionFromFlags({ accepted: ["unitCost"] })
        t.registry.set(draftEvents(id), DraftEvent.Decided({ changes: { "row-55": O.some(accepted) } }))
        yield* settle
        // The save fails: the row waits, and rides with the confirm.
        yield* Deferred.fail(t.saves[0]!.answer, { _tag: "InternalServerErrorProblem" } as const)
        yield* settle
        t.press()
        yield* settle
        expect(t.sent()).toEqual([{ revision: 10, madeOn: { "row-55": 10 }, set: { "row-55": accepted }, clear: [] }])
        const asked = t.gets.length
        yield* Deferred.fail(
          t.confirms[0]!.answer,
          AcceptsTakenBack.make({
            reason: "A column was matched again.",
            accepts: [{ rowId: "row-55", field: "unitCost" }]
          })
        )
        yield* settle
        // Nothing was imported, said above the review, while the newer picture is read; the row goes without the accept.
        expect([t.heldBack(), t.confirming(), t.gets.length]).toEqual([
          O.some({ read: false, apart: 0, accepts: [{ rowId: "row-55", field: "unitCost" }] }),
          true,
          asked + 1
        ])
        expect(A.map(t.saves, (save) => save.delta)[1]).toEqual({ set: { "row-55": decisionFromFlags({}) }, clear: [] })
        expect(page.said).toEqual(["Not saved yet", "An accept was taken back"])
        yield* Deferred.succeed(O.getOrThrow(A.last(t.gets)), t.at({ revision: 11, decisions: { "row-7": kept } }))
        yield* settle
        expect([t.heldBack(), t.confirming()]).toEqual([
          O.some({ read: true, apart: 0, accepts: [{ rowId: "row-55", field: "unitCost" }] }),
          false
        ])
      })
  )
})
