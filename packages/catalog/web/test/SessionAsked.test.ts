// The review while who is signed in is asked again, on the page the app has: one session everything derives from. The
// step stays drawn and goes on being decided; its saves and its confirm wait for the answer, and go as the member who
// pressed them or not at all. Anybody else: the page is left, their rows stay kept in this browser for them alone, and
// the page loaded after it has nothing of theirs. And an import not found asks who is signed in once at most, never in a
// loop, and is never drawn again from what was read before.
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
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
import { memberStart, memberOf, sessionStandIn } from "./support/session.ts"

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

// Each test is a new browser: a test run again (a retry) never finds what an earlier run of it left kept. And the page's
// clock is the test's: its timers and its dates move only when the test lets time pass, so what a test waits for, and
// what it says never happens, rest on the page's own steps and never on how busy the machine is.
beforeEach(() => {
  for (const key of R.keys(browser.kept)) delete browser.kept[key]
  for (const key of R.keys(browser.tab)) delete browser.tab[key]
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
})
afterEach(() => {
  vi.useRealTimers()
})
vi.mock("sonner", () => ({
  toast: Object.assign(() => 0, { dismiss: () => undefined, success: () => 0, loading: () => 0, error: () => 0 })
}))

/** Lets the page do all it can with no time passing: each yield lets one more of its steps run. */
const drained = (left: number): Effect.Effect<void> =>
  left === 0
    ? Effect.void
    : Effect.andThen(
        Effect.yieldNow,
        Effect.suspend(() => drained(left - 1))
      )

/** Ten milliseconds of the page's time pass, and what fell due in them has run. */
const tick = Effect.andThen(
  Effect.promise(() => vi.advanceTimersByTimeAsync(10)),
  Effect.suspend(() => drained(20))
)

/** `span` milliseconds of the page's time pass, ten at a time, with all the page did in them run. */
const passes = (span: number): Effect.Effect<void> =>
  span <= 0
    ? Effect.void
    : Effect.andThen(
        tick,
        Effect.suspend(() => passes(span - 10))
      )

/**
 * How long a test lets the page go on before it says something was never sent. A chosen bound, not every wait the
 * page has: it is past the longest a save is tried again (1.44 s), a read's second of freshness and the idle sweep, and
 * short of the half-minute check of the connection and the five minutes an unwatched read is held. A save or a confirm
 * sent later than this is not seen here.
 */
const longEnough = 2_000

/** Waits until `done` holds, ten seconds of the page's time at most; fails naming `what` when it never does. */
const until = (what: string, done: () => boolean, left: number): Effect.Effect<void> =>
  done()
    ? Effect.void
    : left === 0
      ? Effect.sync(() => expect.fail(`Waited ten seconds of the page's time for ${what}, and it never happened.`))
      : Effect.andThen(
          tick,
          Effect.suspend(() => until(what, done, left - 1))
        )
const out = decisionFromFlags({ out: true })
const dana = memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" })
const marcus = memberOf({ ...memberStart, account: "mem_marcus", id: "mem_marcus" })

/** How a save fails: nobody signed in, or the server's own failure, which may pass. */
type SaveFailure = NotSignedIn | HttpApiError.InternalServerErrorProblem

/** The keys kept for one import's waiting rows, by whose they are. */
const keptOf = (id: ImportId, member: string) =>
  R.keys(R.filter(browser.kept, (_text, key) => Str.includes(`${id}%3Awaiting`)(key) && Str.includes(member)(key)))

/** A page of the app on one import's review: the server answers a save as the test says. */
const page = (id: ImportId, who: typeof dana) => {
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
  const t = page(id, dana)
  // The review is drawn once its read has landed; a decision made before that is not the case here.
  yield* until("the review drawn", t.onScreen, 1_000)
  t.server.signedOut = true
  t.decide("row-2")
  yield* until("who is signed in asked again", () => t.session.times() > 0, 1_000)
  expect([t.sent(), t.session.times(), t.registry.get(t.session.asked)]).toEqual([[["row-2"]], 1, true])
  t.server.signedOut = false
  return t
})

describe("the review while who is signed in is asked again", () => {
  it.live("stays drawn, and what is decided meanwhile waits; the same member's goes once they are known", () =>
    Effect.gen(function* () {
      const t = yield* askedAgain(importNo(91))
      t.decide("row-7")
      yield* passes(longEnough)
      expect([t.onScreen(), t.drew, A.length(t.saves)]).toEqual([true, ["skeleton", "review"], 1])
      yield* t.session.answer(dana)
      yield* until("row 7 sent", () => A.contains(A.flatten(A.drop(t.sent(), 1)), "row-7"), 1_000)
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
      yield* passes(longEnough)
      yield* t.session.answer(marcus)
      yield* until("the page left", () => t.session.left.times > 0, 1_000)
      yield* passes(longEnough)
      expect([t.session.left.times, t.registry.get(memberKey), A.length(t.saves), t.commits]).toEqual([
        1,
        "mem_dana/org_prairie",
        1,
        []
      ])
      expect([A.length(keptOf(id, "mem_dana")), keptOf(id, "mem_marcus")]).toEqual([1, []])
      // Marcus's own page, in the same browser and tab.
      const his = page(id, marcus)
      yield* until("his page's decisions shown", () => O.isSome(his.registry.get(shownDecisions(id))), 1_000)
      yield* passes(longEnough)
      expect([his.registry.get(shownDecisions(id)), his.saves, A.length(keptOf(id, "mem_dana"))]).toEqual([
        O.some({}),
        [],
        1
      ])
      // Dana signs in again: her rows come back with her page, and are sent.
      const hers = page(id, dana)
      // Her page sends once its reads have landed: waited for. A try that looked too early also left her rows kept, and
      // every further try then failed.
      yield* until("her two rows sent", () => A.length(A.flatten(hers.sent())) >= 2, 1_000)
      expect(A.sort(A.flatten(hers.sent()), Str.Order)).toEqual(["row-2", "row-7"])
    })
  )

  it.live("not answered: nothing is sent on what the page last knew, and it goes once it is answered", () =>
    Effect.gen(function* () {
      const t = yield* askedAgain(importNo(93))
      t.decide("row-7")
      yield* t.session.fail()
      yield* passes(longEnough)
      expect([t.onScreen(), A.length(t.saves)]).toEqual([true, 1])
      // Asked again: answered once that question is out, not one already failed.
      const asked = t.session.times()
      t.registry.refresh(t.session.signedIn)
      yield* until("who is signed in asked once more", () => t.session.times() > asked, 1_000)
      yield* t.session.answer(dana)
      yield* until("row 7 sent", () => A.contains(A.flatten(A.drop(t.sent(), 1)), "row-7"), 1_000)
      expect(A.contains(A.flatten(A.drop(t.sent(), 1)), "row-7")).toBe(true)
    })
  )

  it.live("a confirm pressed meanwhile is not made until it is known, and then as the member who pressed it", () =>
    Effect.gen(function* () {
      const id = importNo(94)
      const t = page(id, dana)
      yield* until("the review drawn", t.onScreen, 1_000)
      t.registry.refresh(t.session.signedIn)
      yield* until("who is signed in asked again", () => t.session.times() > 0, 1_000)
      t.registry.set(draftEvents(id), DraftEvent.ConfirmPressed())
      yield* passes(longEnough)
      expect([t.registry.get(t.session.asked), t.commits]).toEqual([true, []])
      yield* t.session.answer(dana)
      yield* until("the confirm made", () => A.length(t.commits) > 0, 1_000)
      expect(A.length(t.commits)).toBe(1)
    })
  )

  it.live(
    "another organization she chose here: the review of the one left is not drawn there, and nothing is sent",
    () =>
      Effect.gen(function* () {
        const id = importNo(95)
        const t = page(id, dana)
        yield* until("the review drawn", t.onScreen, 1_000)
        t.decide("row-2")
        yield* until("row 2 sent", () => A.length(t.saves) > 0, 1_000)
        yield* Deferred.fail(t.saves[0]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        // The failure lands, and the row waits to be sent again.
        yield* passes(100)
        t.session.choose("org_northline")
        t.registry.refresh(t.session.signedIn)
        yield* until("who is signed in asked again", () => t.session.times() > 0, 1_000)
        t.server.notFoundIn = "org_northline"
        yield* t.session.answer(
          memberOf({ ...memberStart, id: "mem_dana_northline", organization: "org_northline", account: "mem_dana" })
        )
        yield* until("the import drawn as gone", () => t.drew[t.drew.length - 1] === "gone", 1_000)
        yield* passes(longEnough)
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
      yield* passes(60)
      if (t.session.times() > 0 && t.session.times() === before) yield* t.session.answer(dana)
      yield* passes(40)
    }
  })

  it.live("removed: says so once, asks nobody who is signed in, and is never drawn again", () =>
    Effect.gen(function* () {
      const id = importNo(96)
      const t = page(id, dana)
      yield* until("the review drawn", t.onScreen, 1_000)
      const { reads } = t.server
      t.server.notFoundIn = "org_prairie"
      importView(id).askAgain(t.registry, O.none())
      yield* answering(t, 5)
      expect([t.drew, t.session.times(), t.server.reads - reads]).toEqual([["skeleton", "review", "gone"], 0, 1])
    })
  )

  it.live("in another organization: asked once for each answer that said so, with no loop and no redraw", () =>
    Effect.gen(function* () {
      const id = importNo(97)
      const t = page(id, dana)
      // Read more than a second ago: shown again, it would be asked again behind it.
      yield* passes(1_100)
      const { reads } = t.server
      t.server.notFoundIn = "org_northline"
      importView(id).askAgain(t.registry, O.none())
      yield* answering(t, 6)
      expect([t.drew, t.session.times(), t.server.reads - reads]).toEqual([["skeleton", "review", "gone"], 1, 1])
      expect(t.registry.get(t.session.asked)).toBe(false)
      // Asked once more, and still not found: what was read before is not drawn meanwhile.
      importView(id).askAgain(t.registry, O.none())
      yield* answering(t, 3)
      expect(t.drew).toEqual(["skeleton", "review", "gone"])
    })
  )
})
