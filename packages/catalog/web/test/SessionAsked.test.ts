// The review while who is signed in is asked again, on the page the app has: one session everything derives from. The
// step stays drawn and goes on being decided; its saves and its confirm wait for the answer, and go as the member who
// pressed them or not at all. Anybody else: the page is left, their rows stay kept in this browser for them alone, and
// the page loaded after it has nothing of theirs. And an import not found asks who is signed in once at most, never in a
// loop, and is never drawn again from what was read before.
import { beforeEach, describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as HttpApiError from "effect/http-api/HttpApiError"
import { vi } from "vitest"
import { memberKey } from "@inventory/client/MemberAtoms"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { OrganizationId } from "@inventory/kernel/Ids"
import { decisionFromFlags, type SaveRequest } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import { DraftEvent } from "../src/Draft.machine.ts"
import { importView, importViewShown } from "../src/Imports.atoms.ts"
import { draftEvents, draftOf, followDraft, reviewLocal, shownDecisions } from "../src/ReviewDraft.atoms.ts"
import { openedOf } from "../src/internal/result.ts"
import { importNo, registryFor, viewAt } from "./support/catalog.ts"
import { memberOf, sessionStandIn } from "./support/session.ts"

// The browser: its storage, which outlives a page, and the tab's own.
const browser = vi.hoisted(() => {
  const kept: Record<string, string> = {}
  const tab: Record<string, string> = {}
  const storage = (of: Record<string, string>) => ({
    getItem: (key: string) => of[key] ?? null,
    setItem: (key: string, value: string) => {
      of[key] = value
    },
    removeItem: (key: string) => {
      delete of[key]
    },
    key: () => null,
    length: 0
  })
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} })
  Object.assign(globalThis, {
    document: Object.assign(new EventTarget(), { visibilityState: "visible" }),
    window: Object.assign(new EventTarget(), {
      location: { pathname: "/", search: "" },
      localStorage: storage(kept),
      sessionStorage: storage(tab)
    })
  })
  return { kept, tab }
})

// Each test is a new browser: a test run again (a retry) never finds what an earlier run of it left kept.
beforeEach(() => {
  for (const key of R.keys(browser.kept)) delete browser.kept[key]
  for (const key of R.keys(browser.tab)) delete browser.tab[key]
})
vi.mock("sonner", () => ({
  toast: Object.assign(() => 0, { dismiss: () => undefined, success: () => 0, loading: () => 0, error: () => 0 })
}))

const settle = Effect.sleep("20 millis")

/** Settles until `done` holds, a hundred times at most: for what must happen, however busy the machine is. */
const until = (done: () => boolean, left = 100): Effect.Effect<void> =>
  done() || left === 0
    ? Effect.void
    : Effect.andThen(
        settle,
        Effect.suspend(() => until(done, left - 1))
      )
const out = decisionFromFlags({ out: true })
const dana = memberOf({ id: "mem_dana" })
const marcus = memberOf({ id: "mem_marcus" })

/** How a save fails: nobody signed in, or the server's own failure, which may pass. */
type SaveFailure = NotSignedIn | HttpApiError.InternalServerErrorProblem

/** The keys kept for one import's waiting rows, by whose they are. */
const keptOf = (id: ImportId, member: string) =>
  R.keys(R.filter(browser.kept, (_text, key) => Str.includes(`${id}%3Awaiting`)(key) && Str.includes(member)(key)))

/** A page of the app on one import's review: the server answers a save as the test says. */
const page = (id: ImportId, who = dana) => {
  const session = sessionStandIn(who)
  const server: { signedOut: boolean; view: ImportView; notFoundIn: string | undefined; reads: number } = {
    signedOut: false,
    view: viewAt({ id, revision: 4 }),
    notFoundIn: undefined,
    reads: 0
  }
  const saves: Array<{ readonly payload: SaveRequest; readonly answer: Deferred.Deferred<unknown, SaveFailure> }> = []
  const commits: Array<unknown> = []
  const registry = registryFor({
    endpoints: {
      imports: {
        get: () =>
          Effect.suspend(() => {
            server.reads += 1
            const { notFoundIn, view } = server
            return Effect.sleep("5 millis").pipe(
              Effect.andThen((): Effect.Effect<ImportView, ImportNotFound> =>
                notFoundIn === undefined
                  ? Effect.succeed(view)
                  : Effect.fail(
                      ImportNotFound.make({ reason: "It is gone.", organizationId: OrganizationId.make(notFoundIn) })
                    )
              )
            )
          }),
        decide: (request: { readonly payload: SaveRequest }) =>
          Effect.suspend((): Effect.Effect<unknown, SaveFailure> => {
            const answer = Deferred.makeUnsafe<unknown, SaveFailure>()
            saves.push({ payload: request.payload, answer })
            if (server.signedOut) return Effect.fail(NotSignedIn.make({ reason: "Sign in to continue." }))
            return Deferred.await(answer)
          }),
        commit: (request: { readonly payload: unknown }) =>
          Effect.suspend(() => {
            commits.push(request.payload)
            return Deferred.await(Deferred.makeUnsafe<ImportView>())
          })
      }
    },
    idleTTL: 20,
    signedIn: session.signedIn,
    asked: session.asked
  })
  // The page as it draws: while there is a member it reads the import, and while there is a view to draw the review
  // follows the draft. What was drawn is told in order, each once in a row.
  const drew: Array<string> = []
  session.drawn(registry, () => {
    const step: { leave: (() => void) | undefined } = { leave: undefined }
    const draw = () => {
      const view = openedOf({ read: registry.get(importViewShown(id)), isGone: S.is(ImportNotFound) })
      const now = view.gone ? "gone" : view.data === undefined ? "skeleton" : "review"
      if (drew[drew.length - 1] !== now) drew.push(now)
      if (now === "review") step.leave ??= registry.mount(followDraft(id))
      else {
        step.leave?.()
        step.leave = undefined
      }
    }
    const stops = [
      registry.mount(reviewLocal(id)),
      registry.subscribe(importViewShown(id), () => draw()),
      () => step.leave?.()
    ]
    draw()
    return () => A.forEach(stops, (stop) => stop())
  })
  return {
    session,
    server,
    registry,
    saves,
    commits,
    drew,
    onScreen: () => registry.get(draftOf(id)).onScreen,
    decide: (rowId: string) => registry.set(draftEvents(id), DraftEvent.Decided({ changes: { [rowId]: O.some(out) } })),
    /** The rows of every save sent, in order. */
    sent: () => A.map(saves, (save) => R.keys(save.payload.set))
  }
}

/** A page whose save of row 2 was refused for nobody signed in, so who is signed in is being asked again. */
const askedAgain = Effect.fnUntraced(function* (id: ImportId) {
  const t = page(id)
  // The review is drawn once its read has landed; a decision made before that is not the case here.
  yield* until(t.onScreen)
  t.server.signedOut = true
  t.decide("row-2")
  yield* until(() => t.session.times() > 0)
  expect([t.sent(), t.session.times(), t.registry.get(t.session.asked)]).toEqual([[["row-2"]], 1, true])
  t.server.signedOut = false
  return t
})

describe("the review while who is signed in is asked again", () => {
  it.live("stays drawn, and what is decided meanwhile waits; the same member's goes once they are known", () =>
    Effect.gen(function* () {
      const t = yield* askedAgain(importNo(91))
      t.decide("row-7")
      yield* settle
      expect([t.onScreen(), t.drew, A.length(t.saves)]).toEqual([true, ["skeleton", "review"], 1])
      yield* t.session.answer(dana)
      yield* until(() => A.contains(A.flatten(A.drop(t.sent(), 1)), "row-7"))
      // The row decided meanwhile goes; the one refused goes once the import's picture has checked it.
      expect([t.onScreen(), t.drew, A.contains(A.flatten(A.drop(t.sent(), 1)), "row-7")]).toEqual([
        true,
        ["skeleton", "review"],
        true
      ])
    })
  )

  it.live("somebody else: the page is left, nothing of hers is sent, and the page they load has nothing of hers", () =>
    Effect.gen(function* () {
      const id = importNo(92)
      const t = yield* askedAgain(id)
      t.decide("row-7")
      t.registry.set(draftEvents(id), DraftEvent.SaveAgain())
      t.registry.set(draftEvents(id), DraftEvent.ConfirmPressed())
      yield* settle
      yield* t.session.answer(marcus)
      yield* until(() => t.session.left.times > 0)
      expect([t.session.left.times, t.registry.get(memberKey), A.length(t.saves), t.commits]).toEqual([
        1,
        "mem_dana/org_prairie",
        1,
        []
      ])
      expect([A.length(keptOf(id, "mem_dana")), keptOf(id, "mem_marcus")]).toEqual([1, []])
      // Marcus's own page, in the same browser and tab.
      const his = page(id, marcus)
      yield* until(() => O.isSome(his.registry.get(shownDecisions(id))))
      expect([his.registry.get(shownDecisions(id)), his.saves, A.length(keptOf(id, "mem_dana"))]).toEqual([
        O.some({}),
        [],
        1
      ])
      // Dana signs in again: her rows come back with her page, and are sent.
      const hers = page(id, dana)
      // Her page sends once its reads have landed, which on a busy machine is later than one settle: waited for,
      // two seconds at most. A try that looked too early also left her rows kept, and every further try then failed.
      yield* until(() => A.length(A.flatten(hers.sent())) >= 2)
      expect(A.sort(A.flatten(hers.sent()), Str.Order)).toEqual(["row-2", "row-7"])
    })
  )

  it.live("not answered: nothing is sent on what the page last knew, and it goes once it is answered", () =>
    Effect.gen(function* () {
      const t = yield* askedAgain(importNo(93))
      t.decide("row-7")
      yield* t.session.fail()
      yield* settle
      expect([t.onScreen(), A.length(t.saves)]).toEqual([true, 1])
      // Asked again: answered once that question is out, not one already failed.
      const asked = t.session.times()
      t.registry.refresh(t.session.signedIn)
      yield* until(() => t.session.times() > asked)
      yield* t.session.answer(dana)
      yield* until(() => A.contains(A.flatten(A.drop(t.sent(), 1)), "row-7"))
      expect(A.contains(A.flatten(A.drop(t.sent(), 1)), "row-7")).toBe(true)
    })
  )

  it.live("a confirm pressed meanwhile is not made until it is known, and then as the member who pressed it", () =>
    Effect.gen(function* () {
      const id = importNo(94)
      const t = page(id)
      yield* until(t.onScreen)
      t.registry.refresh(t.session.signedIn)
      yield* until(() => t.session.times() > 0)
      t.registry.set(draftEvents(id), DraftEvent.ConfirmPressed())
      yield* settle
      expect([t.registry.get(t.session.asked), t.commits]).toEqual([true, []])
      yield* t.session.answer(dana)
      yield* until(() => A.length(t.commits) > 0)
      expect(A.length(t.commits)).toBe(1)
    })
  )

  it.live(
    "another organization she chose here: the review of the one left is not drawn there, and nothing is sent",
    () =>
      Effect.gen(function* () {
        const id = importNo(95)
        const t = page(id)
        yield* until(t.onScreen)
        t.decide("row-2")
        yield* until(() => A.length(t.saves) > 0)
        yield* Deferred.fail(t.saves[0]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        t.session.choose("org_northline")
        t.registry.refresh(t.session.signedIn)
        yield* until(() => t.session.times() > 0)
        t.server.notFoundIn = "org_northline"
        yield* t.session.answer(
          memberOf({ id: "mem_dana_northline", organization: "org_northline", account: "mem_dana" })
        )
        yield* until(() => t.drew[t.drew.length - 1] === "gone")
        expect([t.session.left.times, t.drew[t.drew.length - 1], A.length(t.saves)]).toEqual([0, "gone", 1])
        expect(A.length(keptOf(id, "mem_dana"))).toBe(1)
      })
  )
})

describe("an import not found while it is open", () => {
  /** The session answers each question it is asked, as Dana, a while after it was: slower than an unread atom is kept. */
  const answering = Effect.fnUntraced(function* (t: ReturnType<typeof page>, times: number) {
    for (const _ of A.range(1, times)) {
      const before = t.session.times()
      yield* Effect.sleep("60 millis")
      if (t.session.times() > 0 && t.session.times() === before) yield* t.session.answer(dana)
      yield* Effect.sleep("40 millis")
    }
  })

  it.live("removed: says so once, asks nobody who is signed in, and is never drawn again", () =>
    Effect.gen(function* () {
      const id = importNo(96)
      const t = page(id)
      yield* settle
      const { reads } = t.server
      t.server.notFoundIn = "org_prairie"
      importView(id).askAgain(t.registry)
      yield* answering(t, 5)
      expect([t.drew, t.session.times(), t.server.reads - reads]).toEqual([["skeleton", "review", "gone"], 0, 1])
    })
  )

  it.live("in another organization: asked once for each answer that said so, with no loop and no redraw", () =>
    Effect.gen(function* () {
      const id = importNo(97)
      const t = page(id)
      // Read more than a second ago: shown again, it would be asked again behind it.
      yield* Effect.sleep("1100 millis")
      const { reads } = t.server
      t.server.notFoundIn = "org_northline"
      importView(id).askAgain(t.registry)
      yield* answering(t, 6)
      expect([t.drew, t.session.times(), t.server.reads - reads]).toEqual([["skeleton", "review", "gone"], 1, 1])
      expect(t.registry.get(t.session.asked)).toBe(false)
      // Asked once more, and still not found: what was read before is not drawn meanwhile.
      importView(id).askAgain(t.registry)
      yield* answering(t, 3)
      expect(t.drew).toEqual(["skeleton", "review", "gone"])
    })
  )
})
