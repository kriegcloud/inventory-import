import { identity } from "effect/Function"
// The person's waiting rows as this browser keeps them, wired: kept under the member who decided them, whoever is
// signed in when the server answers; read for nobody else; erased with a removed import; named, then dropped, when
// the import turns out to be closed; and the question before the page is left, asked wherever the person is while
// rows wait to be sent, never for rows that are only to be named, never once the app itself leaves.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import * as HttpApiError from "effect/http-api/HttpApiError"
import { vi } from "vitest"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"
import { progressKey } from "@inventory/review/SavedProgress"
import { leavingApp } from "@inventory/ui/Route"
import { decisionFromFlags, type SaveRequest } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { type ImportView, MatchTakeBack } from "@inventory/catalog-contract/Import"
import { DraftBusy, ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import * as S from "effect/Schema"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { DraftEvent } from "../src/Draft.machine.ts"
import { askBeforeLeaving, importView, importViewShown, removeImport } from "../src/Imports.atoms.ts"
import {
  dismissTakeBack,
  takeBacksNamed,
  draftEvents,
  followDraft,
  namingLeftOver,
  reviewLocal,
  rowsLeftOver,
  rowsNotSaved,
  reviewLines,
  shownDecisions
} from "../src/ReviewDraft.atoms.ts"
import { noticeWords } from "../src/internal/notices.ts"
import { dismissNotice, notices } from "../src/Notices.atoms.ts"
import { importNo, registryFor, viewAt } from "./support/catalog.ts"
import { memberStart, memberOf, sessionStandIn } from "./support/session.ts"

// The browser: its storage, which outlives a page, the tab's own storage (every page here is one tab, loaded again),
// and the listeners a page adds to its window. It has no locks: a page loaded again is one whose old page is gone.
const browser = vi.hoisted(() => {
  const kept: Record<string, string> = {}
  const tab: Record<string, string> = {}
  const listeners: Record<string, Array<(event: unknown) => void>> = {}
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} })
  Object.assign(globalThis, {
    window: {
      location: { pathname: "/", search: "" },
      localStorage: {
        getItem: (key: string) => kept[key] ?? null,
        setItem: (key: string, value: string) => {
          kept[key] = value
        },
        removeItem: (key: string) => {
          delete kept[key]
        },
        key: (index: number) => {
          let at = 0
          for (const key in kept) {
            if (at === index) return key
            at += 1
          }
          return null
        },
        get length() {
          let count = 0
          for (const key in kept) if (key !== "") count += 1
          return count
        }
      },
      sessionStorage: {
        getItem: (key: string) => tab[key] ?? null,
        setItem: (key: string, value: string) => {
          tab[key] = value
        }
      },
      addEventListener: (name: string, listener: (event: unknown) => void) => {
        listeners[name] = [...O.match(R.get(listeners, name), { onNone: A.empty, onSome: identity }), listener]
      },
      removeEventListener: (name: string, listener: (event: unknown) => void) => {
        const others: Array<(event: unknown) => void> = []
        for (const each of O.match(R.get(listeners, name), { onNone: A.empty, onSome: identity }))
          if (each !== listener) others.push(each)
        listeners[name] = others
      }
    }
  })
  return { kept, tab, listeners, said: [] as Array<string> }
})

// What is said to the person, by title.
vi.mock("sonner", () => ({
  toast: Object.assign((title: string) => browser.said.push(title), {
    dismiss: () => undefined,
    success: () => 0,
    loading: () => 0,
    error: (title: string) => browser.said.push(title)
  })
}))

/** How a test fails a save the server took: a refusal, the server's own failure (which may pass), or a busy draft. */
type SaveFailure = ImportNotFound | HttpApiError.InternalServerErrorProblem | DraftBusy

/** A browser that kept nothing yet: what earlier tests left in its storage is gone. */
const emptyStorage = (): void => {
  for (const key of R.keys(browser.kept)) delete browser.kept[key]
}

/** The page is about to be left: true when something asked the person first. */
const leaving = (): boolean => {
  let asked = false
  for (const listener of O.match(R.get(browser.listeners, "beforeunload"), { onNone: A.empty, onSome: identity })) {
    listener({
      preventDefault: () => {
        asked = true
      }
    })
  }
  return asked
}

const settle = Effect.sleep("15 millis")
const out = decisionFromFlags({ out: true })

const person = (id: string, organizationId: string) =>
  O.some(
    Member.make({
      id: MemberId.make(id),
      name: DisplayName.make(id),
      role: "admin",
      organizationId: OrganizationId.make(organizationId),
      organizationName: DisplayName.make(organizationId)
    })
  )
const dana = person("mem_dana", "org_prairie")

/** Where one member's waiting rows of one import are kept, by this tab (its id is in the tab's own storage). */
const keyOf = (id: ImportId, memberId: string, organizationId: string) =>
  progressKey({ organizationId, memberId, screen: `import:${id}:waiting:${browser.tab["inventory:tab"] ?? ""}` })

/**
 * One page of the app, on the shared storage: the server answers each save only when the test says, and refuses it as
 * nobody signed in while `server.signedOut`; a read of the import never answers, unless the import was removed. Asking
 * who is signed in again is counted (`asked`); the test says who is. With `server.askHangs`, the question stays out
 * (`asking` true) until the test answers it. With `session`, who is signed in is the app's own session stand-in
 * (`support/session.ts`), asked and answered by its rules.
 */
const serverStart = { signedOut: false, removed: false }
const page = (
  id: ImportId,
  signedIn: typeof dana,
  server: {
    signedOut: boolean
    removed: boolean
    /** The organization a read that answers not found looked in: the session's, which another tab may have switched. */
    in?: string
    view?: ImportView
    askHangs?: boolean
  },
  session: ReturnType<typeof sessionStandIn> | undefined
) => {
  const saves: Array<{ readonly payload: SaveRequest; readonly answer: Deferred.Deferred<unknown, SaveFailure> }> = []
  // The confirms sent; the server never answers one.
  const commits: Array<SaveRequest & { readonly revision: number }> = []
  const who = Atom.make(signedIn)
  const asking = Atom.make(false).pipe(Atom.keepAlive)
  const asked = { times: 0 }
  const held: { registry: AtomRegistry.AtomRegistry | undefined } = { registry: undefined }
  const registry = registryFor({
    endpoints: {
      imports: {
        get: () =>
          server.removed
            ? Effect.fail(
                ImportNotFound.make({
                  reason: "It is gone.",
                  organizationId: OrganizationId.make(server.in ?? "org_prairie")
                })
              )
            : server.view === undefined
              ? Deferred.await(Deferred.makeUnsafe<ImportView>())
              : Effect.succeed(server.view),
        decide: (request: { readonly payload: SaveRequest }) =>
          Effect.suspend((): Effect.Effect<unknown, SaveFailure | NotSignedIn> => {
            const answer = Deferred.makeUnsafe<unknown, SaveFailure>()
            saves.push({ payload: request.payload, answer })
            if (server.signedOut) return Effect.fail(NotSignedIn.make({ reason: "Sign in to continue." }))
            return Deferred.await(answer)
          }),
        commit: (request: { readonly payload: SaveRequest & { readonly revision: number } }) =>
          Effect.suspend(() => {
            commits.push(request.payload)
            return Deferred.await(Deferred.makeUnsafe<ImportView>())
          }),
        open: () => Effect.succeed({ views: [], older: 0 }),
        remove: () => Effect.void
      }
    },
    signedIn:
      session === undefined
        ? Atom.readable(
            (get) => get(who),
            () => {
              asked.times += 1
              if (server.askHangs === true) held.registry?.set(asking, true)
            }
          )
        : session.signedIn,
    asked: session === undefined ? asking : session.asked
  })
  held.registry = registry
  return {
    registry,
    saves,
    commits,
    who,
    asking,
    asked,
    /** The Review step is drawn over this view. */
    open: (view: ImportView) => {
      registry.set(importView(id), view)
      registry.mount(importViewShown(id))
      registry.mount(reviewLocal(id))
      return registry.mount(followDraft(id))
    },
    decide: (rowId: string) => registry.set(draftEvents(id), DraftEvent.Decided({ changes: { [rowId]: O.some(out) } })),
    answer: (n: number, revision: number) =>
      Deferred.succeed(saves[n]!.answer, { revision, changed: true, notApplied: [], decidedSince: [] })
  }
}

describe("the waiting rows this browser keeps", () => {
  it.live("are cleared under the member who decided them when the save answers after a switch of organization", () =>
    Effect.gen(function* () {
      const id = importNo(61)
      const t = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      t.open(viewAt({ id, revision: 12 }))
      yield* settle
      t.decide("row-31")
      yield* settle
      expect(R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))).toBe(true)
      // Dana picks her other organization before the answer comes.
      t.registry.set(t.who, person("mem_dana", "org_northline"))
      yield* t.answer(0, 13)
      yield* settle
      // The server took the row: nothing of it is kept under her Example Works key, or under the other one.
      expect([
        R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie")),
        R.has(browser.kept, keyOf(id, "mem_dana", "org_northline"))
      ]).toEqual([false, false])
    })
  )

  it.live("are one member's: another member opening the same import in this browser sends none and shows none", () =>
    Effect.gen(function* () {
      const id = importNo(62)
      const first = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      first.open(viewAt({ id, revision: 4 }))
      yield* settle
      first.decide("row-2")
      yield* settle
      // Dana's save never answers: the row waits, kept for her.
      expect(R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))).toBe(true)
      const other = page(
        id,
        person("mem_lee", "org_prairie"),
        { ...serverStart, signedOut: false, removed: false },
        undefined
      )
      other.open(viewAt({ id, revision: 4 }))
      yield* settle
      expect([other.saves.length, R.has(browser.kept, keyOf(id, "mem_lee", "org_prairie"))]).toEqual([0, false])
    })
  )

  it.live("are erased with the import when it is removed", () =>
    Effect.gen(function* () {
      const id = importNo(63)
      const t = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      const view = viewAt({ id, revision: 4, fileName: "a.csv" })
      const leave = t.open(view)
      yield* settle
      t.decide("row-2")
      yield* settle
      leave()
      expect(R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))).toBe(true)
      t.registry.mount(removeImport(id))
      t.registry.set(removeImport(id), view)
      yield* settle
      expect(R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))).toBe(false)
    })
  )

  it.live("of an import found closed are sent nowhere, named by the result, and dropped once it has named them", () =>
    Effect.gen(function* () {
      const id = importNo(64)
      const t = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      t.open(viewAt({ id, revision: 4 }))
      yield* settle
      t.decide("row-2")
      yield* t.answer(0, 5)
      yield* settle
      t.decide("row-3")
      yield* settle
      // Somebody else confirmed it: the view this tab reads next says so.
      t.registry.set(importView(id), viewAt({ id, revision: 6, status: "imported", decisions: { "row-2": out } }))
      yield* settle
      expect(t.saves.length).toBe(2)
      expect(t.registry.get(rowsLeftOver(id))).toEqual(
        O.some({ rows: { "row-3": O.some(out) }, beside: {}, theirs: {} })
      )
      expect(R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))).toBe(true)
      // The result names them; when it is left, nothing of them is kept.
      const naming = t.registry.mount(namingLeftOver(id))
      yield* settle
      naming()
      yield* settle
      expect([t.registry.get(rowsLeftOver(id)), R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))]).toEqual([
        O.none(),
        false
      ])
    })
  )
})

describe("the question before the page is left", () => {
  it.live("is asked while rows wait to be sent, wherever the person is, and not once the app leaves on purpose", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(65)
      const t = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      t.registry.mount(askBeforeLeaving)
      const leave = t.open(viewAt({ id, revision: 4 }))
      yield* settle
      expect(leaving()).toBe(false)
      t.decide("row-2")
      yield* settle
      expect(leaving()).toBe(true)
      // The person goes to the Items page: the rows still wait, and the question still comes.
      leave()
      yield* settle
      expect(leaving()).toBe(true)
      // A sign-out leaves the page on purpose: nothing asks after the session has ended.
      for (const listener of O.match(R.get(browser.listeners, leavingApp), { onNone: A.empty, onSome: identity }))
        listener({})
      expect(leaving()).toBe(false)
    })
  )

  it.live("is not asked for rows that are only to be named: they are never sent", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(66)
      const t = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      t.registry.mount(askBeforeLeaving)
      t.open(viewAt({ id, revision: 4 }))
      yield* settle
      t.decide("row-2")
      yield* settle
      expect(leaving()).toBe(true)
      t.registry.set(importView(id), viewAt({ id, revision: 5, status: "imported" }))
      yield* settle
      expect([O.isSome(t.registry.get(rowsLeftOver(id))), leaving()]).toEqual([true, false])
      expect(A.length(t.saves)).toBe(1)
    })
  )

  it.live("is not asked for rows of an import removed meanwhile: they are erased at page start", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(67)
      const first = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      first.open(viewAt({ id, revision: 4 }))
      yield* settle
      first.decide("row-2")
      yield* settle
      expect(R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))).toBe(true)
      // A colleague removes the import; the page is loaded again.
      browser.listeners["beforeunload"] = []
      const again = page(id, dana, { ...serverStart, signedOut: false, removed: true }, undefined)
      again.registry.mount(askBeforeLeaving)
      yield* settle
      expect([leaving(), R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))]).toEqual([false, false])
    })
  )
})

describe("rows that wait after a save refused for nobody signed in (G3)", () => {
  it.live(
    "wait, kept under the member who decided them; are never sent as whoever signs in next; and go once that member is signed in again",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(68)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = {
          signedOut: true,
          removed: false,
          view: viewAt({ id, revision: 4 })
        }
        const t = page(id, dana, server, undefined)
        const leave = t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        // Through the runner: the server's refusal is not a refusal of the row. Nothing is on hold, the row waits, kept
        // under Dana's key, and who is signed in is asked again (the tab then shows the sign-in page).
        expect([
          A.length(t.saves),
          t.registry.get(reviewLines(id)),
          t.registry.get(rowsNotSaved(id)),
          R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie")),
          t.asked.times
        ]).toEqual([1, {}, 1, true, 1])
        // Signed out: the workspace goes. Marcus signs in on this page, and opens the import.
        leave()
        t.registry.set(t.who, O.none())
        yield* settle
        server.signedOut = false
        t.registry.set(t.who, person("mem_marcus", "org_prairie"))
        const asMarcus = t.open(viewAt({ id, revision: 4 }))
        yield* settle
        // Nothing of Dana's is sent as Marcus, or kept under his key; hers stays kept for her.
        expect([
          A.length(t.saves),
          R.has(browser.kept, keyOf(id, "mem_marcus", "org_prairie")),
          R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))
        ]).toEqual([1, false, true])
        // Dana signs in again and opens the import: the picture the step reads checks the row, and it is sent.
        asMarcus()
        t.registry.set(t.who, O.none())
        yield* settle
        t.registry.set(t.who, dana)
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        expect(A.map(t.saves, (save) => R.keys(save.payload.set))).toEqual([["row-2"], ["row-2"]])
      })
  )
})

/** Two take-backs of one match, as the view carries them, read through the contract's schema. */
// @effect-diagnostics-next-line schemaSync:off
const taken = S.decodeSync(S.Array(MatchTakeBack))([
  { revision: 5, by: "Marcus", field: "sku", kind: "stored", count: 2, rows: ["row-4", "row-9"] },
  { revision: 5, by: "Marcus", field: "sku", kind: "twin", count: 1, rows: ["row-10"] }
])

describe("what a match took back from saved decisions", () => {
  it.live(
    "is named from the view until the person dismisses it; the dismissal is kept per person and import in this browser",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(70)
        const view = viewAt({ id, revision: 5, takenBack: taken })
        const t = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
        t.open(view)
        t.registry.mount(takeBacksNamed(id))
        yield* settle
        expect(t.registry.get(takeBacksNamed(id))).toEqual(taken)
        t.registry.set(dismissTakeBack(id), taken[0]!)
        expect(t.registry.get(takeBacksNamed(id))).toEqual([taken[1]])
        // The page loaded again: still dismissed for Dana; named to Lee, who has not dismissed it.
        const again = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
        again.open(view)
        again.registry.mount(takeBacksNamed(id))
        const lee = page(
          id,
          person("mem_lee", "org_prairie"),
          { ...serverStart, signedOut: false, removed: false },
          undefined
        )
        lee.open(view)
        lee.registry.mount(takeBacksNamed(id))
        yield* settle
        expect([again.registry.get(takeBacksNamed(id)), lee.registry.get(takeBacksNamed(id))]).toEqual([
          [taken[1]],
          taken
        ])
      })
  )
})

describe("rows on hold and the values seen, through the browser's storage", () => {
  it.live(
    "come back after a reload: a waiting row the picture shows decided elsewhere meanwhile is on a line with theirs, a refused row keeps its reason, and nothing is sent while they ask",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(69)
        const first = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
        first.open(viewAt({ id, revision: 4 }))
        yield* settle
        // Row 3's save is refused; row 2's then fails on the network.
        first.decide("row-3")
        yield* settle
        yield* Deferred.fail(
          first.saves[0]!.answer,
          ImportNotFound.make({ reason: "It is gone.", organizationId: OrganizationId.make("org_prairie") })
        )
        yield* settle
        first.decide("row-2")
        yield* settle
        yield* Deferred.fail(first.saves[1]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        const refused = R.get(first.registry.get(reviewLines(id)), "row-3")
        expect(O.isSome(refused)).toBe(true)
        // The page is loaded again; Lee has kept row 2 meanwhile (revision 5).
        const kept = decisionFromFlags({ kept: true })
        const later = viewAt({ id, revision: 5, decisions: { "row-2": kept } })
        const again = page(id, dana, { ...serverStart, signedOut: false, removed: false, view: later }, undefined)
        again.open(later)
        yield* settle
        const lines = again.registry.get(reviewLines(id))
        expect([R.get(lines, "row-3"), O.map(R.get(lines, "row-2"), (one) => one.theirs)]).toEqual([
          refused,
          O.some(kept).pipe(O.some, O.some)
        ])
        expect(again.saves).toEqual([])
      })
  )
})

const marcus = person("mem_marcus", "org_prairie")
const keptDecision = decisionFromFlags({ kept: true })

describe("a waiting row, whose it is and when it may go, through the runner", () => {
  it.live(
    "a row that waits is sent with what it may be written over when the step is drawn again, and the server's word that somebody decided it since puts it on a line with theirs",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(71)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = {
          signedOut: false,
          removed: false,
          view: viewAt({ id, revision: 4 })
        }
        const t = page(id, dana, server, undefined)
        const leave = t.open(viewAt({ id, revision: 4 }))
        yield* settle
        // Row 2 left out; its save fails on the server: it waits, at revision 4.
        t.decide("row-2")
        yield* settle
        yield* Deferred.fail(t.saves[0]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        // To the Match step: the Review step leaves; the import page keeps the view of revision 4.
        leave()
        yield* settle
        // Lee keeps row 2 meanwhile (revision 5).
        server.view = viewAt({ id, revision: 5, decisions: { "row-2": keptDecision } })
        // Back to Review: the step is drawn again over the view the tab held. Nothing is judged before it goes: the row
        // goes, written only over what the server may hold of it (nothing, when it was decided, or the save that failed).
        t.registry.mount(followDraft(id))
        yield* settle
        expect(A.map(t.saves, (save) => save.payload.over)).toEqual([{}, { "row-2": [O.none(), O.some(out)] }])
        // The server holds Lee's decision, which is none of those: it writes nothing, and says so.
        yield* Deferred.succeed(t.saves[1]!.answer, {
          revision: 5,
          changed: false,
          notApplied: [],
          decidedSince: [{ rowId: "row-2", theirs: O.some(keptDecision) }]
        })
        yield* settle
        expect(O.map(R.get(t.registry.get(reviewLines(id)), "row-2"), (one) => one.theirs)).toEqual(
          O.some(keptDecision).pipe(O.some, O.some)
        )
        expect(A.length(t.saves)).toBe(2)
      })
  )

  it.live(
    "a confirm pressed by someone else signed in on this page never carries the rows of the member who decided them",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(72)
        // The import, as the server answers it for whoever is signed in.
        const t = page(
          id,
          dana,
          { ...serverStart, signedOut: false, removed: false, view: viewAt({ id, revision: 4 }) },
          undefined
        )
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        yield* Deferred.fail(t.saves[0]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        // Marcus signs in on this page, and presses the confirm on a screen that still shows Dana's row 2 left out.
        t.registry.set(t.who, marcus)
        yield* settle
        browser.said.length = 0
        t.registry.set(draftEvents(id), DraftEvent.ConfirmPressed())
        yield* settle
        // The button said what that screen showed: nothing is confirmed, row 2 is not imported unseen. The screen is
        // drawn again for Marcus (row 2 as the server holds it), and says why.
        expect([t.commits, t.registry.get(shownDecisions(id)), browser.said]).toEqual([
          [],
          O.some({}),
          ["Nothing was imported"]
        ])
        // Dana's row stays kept for her.
        expect(R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))).toBe(true)
        // Marcus presses again, on what he now sees: that is confirmed.
        t.registry.set(draftEvents(id), DraftEvent.ConfirmPressed())
        yield* settle
        expect(A.map(t.commits, (commit) => [commit.revision, R.keys(commit.set)])).toEqual([[4, []]])
      })
  )

  it.live(
    "a decision by someone else signed in on this page is made on the picture the screen shows, never on none",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(73)
        const t = page(
          id,
          dana,
          { ...serverStart, signedOut: false, removed: false, view: viewAt({ id, revision: 4 }) },
          undefined
        )
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        yield* Deferred.fail(t.saves[0]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        t.registry.set(t.who, marcus)
        yield* settle
        t.decide("row-3")
        yield* settle
        const last = t.saves[A.length(t.saves) - 1]!.payload
        expect([R.keys(last.set), last.madeOn]).toEqual([["row-3"], { "row-3": 4 }])
      })
  )

  it.live(
    "a read of the import that answers not found erases nothing kept: the import may be another organization's now",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(74)
        const server = { signedOut: false, removed: false, in: "org_northline" }
        const t = page(id, dana, server, undefined)
        t.open(viewAt({ id, revision: 4 }))
        t.registry.mount(notices)
        yield* settle
        t.decide("row-2")
        yield* settle
        expect(R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))).toBe(true)
        // Another tab switched the session's organization: this one's read of the import answers not found there.
        server.removed = true
        importView(id).askAgain(t.registry, O.none())
        yield* settle
        // Everything stays, the row and its place on the screen; only who is signed in is asked.
        expect([
          R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie")),
          t.asked.times > 0,
          t.registry.get(shownDecisions(id)),
          t.registry.get(notices)
        ]).toEqual([true, true, O.some({ "row-2": out }), []])
      })
  )

  it.live("a save answered that the import was too busy waits to be sent again: it is never held as refused", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(75)
      const t = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      t.open(viewAt({ id, revision: 4 }))
      yield* settle
      t.decide("row-2")
      yield* settle
      yield* Deferred.fail(t.saves[0]!.answer, DraftBusy.make({ reason: "The import kept changing." }))
      yield* settle
      expect([t.registry.get(reviewLines(id)), t.registry.get(rowsNotSaved(id))]).toEqual([{}, 1])
    })
  )

  it.live(
    "rows that wait for their member are said as not sent because someone else is signed in, when someone else is",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        browser.said.length = 0
        const id = importNo(76)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = { signedOut: false, removed: false }
        const t = page(id, dana, server, undefined)
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        yield* Deferred.fail(t.saves[0]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        // Marcus signs in on this page; the import read for him finds Dana's row waiting.
        server.view = viewAt({ id, revision: 4 })
        t.registry.set(t.who, marcus)
        yield* settle
        expect(A.length(t.saves)).toBe(1)
        expect(A.filter(browser.said, (title) => Str.startsWith("Not saved")(title))).toEqual([
          "Not saved yet",
          "Not saved: someone else is signed in"
        ])
      })
  )

  it.live("the take-backs a person dismissed go with the import when it is removed", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(77)
      const view = viewAt({ id, revision: 5, takenBack: taken })
      const t = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      const leave = t.open(view)
      t.registry.mount(takeBacksNamed(id))
      yield* settle
      t.registry.set(dismissTakeBack(id), taken[0]!)
      const key = progressKey({ organizationId: "org_prairie", memberId: "mem_dana", screen: `import:${id}:takenBack` })
      yield* settle
      expect(R.has(browser.kept, key)).toBe(true)
      leave()
      t.registry.mount(removeImport(id))
      t.registry.set(removeImport(id), view)
      yield* settle
      expect(R.has(browser.kept, key)).toBe(false)
    })
  )

  it.live(
    "a new owner's rows are kept under their key from the first one, and their own entry this page had not read is taken in, never erased",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(78)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = {
          signedOut: false,
          removed: false,
          view: viewAt({ id, revision: 4 })
        }
        // Marcus left row 5 out on this tab earlier; its save failed, and it is kept for him.
        const before = page(id, marcus, server, undefined)
        before.open(viewAt({ id, revision: 4 }))
        yield* settle
        before.decide("row-5")
        yield* settle
        yield* Deferred.fail(before.saves[0]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        // The page is loaded again: Dana opens the Review step, with nothing of hers pending.
        const t = page(id, dana, server, undefined)
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        // Marcus signs in on the page and leaves row 3 out; its save fails.
        t.registry.set(t.who, marcus)
        yield* settle
        t.decide("row-3")
        yield* settle
        const rowsKept = () => Str.includes('"row-3"')(browser.kept[keyOf(id, "mem_marcus", "org_prairie")] ?? "")
        const fiveKept = () => Str.includes('"row-5"')(browser.kept[keyOf(id, "mem_marcus", "org_prairie")] ?? "")
        expect([rowsKept(), fiveKept()]).toEqual([true, true])
        for (const save of t.saves) yield* Deferred.fail(save.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        expect([rowsKept(), fiveKept()]).toEqual([true, true])
        // A reload, as Marcus: both rows come back, and are sent once the import's picture has checked them.
        const again = page(id, marcus, server, undefined)
        again.open(viewAt({ id, revision: 4 }))
        yield* settle
        expect(A.map(again.saves, (save) => A.sort(R.keys(save.payload.set), Str.Order))).toEqual([["row-3", "row-5"]])
      })
  )

  it.live(
    "a confirm that waited on a save goes as the member who pressed it or not at all, when someone else signed in meanwhile",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        browser.said.length = 0
        const id = importNo(79)
        const t = page(
          id,
          dana,
          { ...serverStart, signedOut: false, removed: false, view: viewAt({ id, revision: 4 }) },
          undefined
        )
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        // Dana leaves row 2 out, and presses the confirm while its save is out: the confirm waits.
        t.decide("row-2")
        yield* settle
        t.registry.set(draftEvents(id), DraftEvent.ConfirmPressed())
        yield* settle
        // Marcus signs in on this page; then Dana's save answers, and the confirm that waited for it is due.
        t.registry.set(t.who, marcus)
        yield* settle
        yield* t.answer(0, 5)
        yield* settle
        expect([t.commits, A.contains(browser.said, "Not imported: someone else is signed in")]).toEqual([[], true])
      })
  )

  it.live(
    "while who is signed in is asked again after a save refused for nobody signed in, nothing of the draft is sent: the answer decides",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(80)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = {
          signedOut: true,
          removed: false,
          view: viewAt({ id, revision: 4 })
        }
        const session = sessionStandIn(memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" }))
        const t = page(id, dana, server, session)
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        // Refused for nobody signed in: who is signed in is asked again, and has not answered.
        expect([A.length(t.saves), session.times(), t.registry.get(session.asked)]).toEqual([1, 1, true])
        // The cookie is Marcus's now; the page still says Dana. She presses Save again: the save waits for the answer.
        server.signedOut = false
        t.registry.set(draftEvents(id), DraftEvent.SaveAgain())
        yield* settle
        expect(A.length(t.saves)).toBe(1)
        // The answer: Marcus. The page is left, never his; nothing of Dana's goes as him, and her row stays kept for her.
        yield* session.answer(memberOf({ ...memberStart, account: "mem_marcus", id: "mem_marcus" }))
        yield* settle
        expect([
          A.length(t.saves),
          session.left.times,
          R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))
        ]).toEqual([1, 1, true])
      })
  )

  it.live("a save held while who is signed in is asked again goes once the answer is its member", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(81)
      const server: { signedOut: boolean; removed: boolean; view?: ImportView } = {
        signedOut: true,
        removed: false,
        view: viewAt({ id, revision: 4 })
      }
      const session = sessionStandIn(memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" }))
      const t = page(id, dana, server, session)
      t.open(viewAt({ id, revision: 4 }))
      yield* settle
      t.decide("row-2")
      yield* settle
      server.signedOut = false
      t.registry.set(draftEvents(id), DraftEvent.SaveAgain())
      yield* settle
      expect(A.length(t.saves)).toBe(1)
      // The answer: Dana is still signed in. The held save goes.
      yield* session.answer(memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" }))
      yield* settle
      expect(A.map(t.saves, (save) => R.keys(save.payload.set))).toEqual([["row-2"], ["row-2"]])
    })
  )

  it.live(
    "a confirm pressed while who is signed in is asked again waits for the answer, and is not made as someone else",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(82)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = {
          signedOut: true,
          removed: false,
          view: viewAt({ id, revision: 4 })
        }
        const session = sessionStandIn(memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" }))
        const t = page(id, dana, server, session)
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        server.signedOut = false
        t.registry.set(draftEvents(id), DraftEvent.ConfirmPressed())
        yield* settle
        expect(t.commits).toEqual([])
        yield* session.answer(memberOf({ ...memberStart, account: "mem_marcus", id: "mem_marcus" }))
        yield* settle
        expect([t.commits, R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie"))]).toEqual([[], true])
      })
  )
})

describe("an import removed meanwhile (the rows kept for it, named; Benjamin, 2026-11-21)", () => {
  /** What this page says to whoever is signed in, as they read it. */
  const says = (t: ReturnType<typeof page>) => A.map(t.registry.get(notices), noticeWords)

  it.live(
    "page start: its kept rows are let go and named, row by row, to the member they belong to, until dismissed",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(83)
        const first = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
        first.open(viewAt({ id, revision: 4, fileName: "items_messy.csv" }))
        yield* settle
        first.decide("row-31")
        first.decide("row-12")
        yield* settle
        // A colleague removes the import; the page is loaded again.
        browser.listeners["beforeunload"] = []
        const gone = { signedOut: false, removed: true }
        const again = page(id, dana, gone, undefined)
        again.registry.mount(askBeforeLeaving)
        again.registry.mount(notices)
        yield* settle
        const said = [
          {
            title: "items_messy.csv was removed",
            text: "Your decisions on it that were not saved went with it. Row 12: you left out; Row 31: you left out."
          }
        ]
        expect([leaving(), R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie")), says(again)]).toEqual([
          false,
          false,
          said
        ])
        // Not to Marcus, on the same tab; and to Dana again after a reload, until she dismisses it.
        const other = page(id, marcus, gone, undefined)
        other.registry.mount(notices)
        const reloaded = page(id, dana, gone, undefined)
        reloaded.registry.mount(notices)
        yield* settle
        expect([says(other), says(reloaded)]).toEqual([[], said])
        reloaded.registry.set(dismissNotice, reloaded.registry.get(notices)[0]!)
        const after = page(id, dana, gone, undefined)
        after.registry.mount(notices)
        yield* settle
        expect([says(reloaded), says(after)]).toEqual([[], []])
      })
  )

  it.live(
    "page start: not found in another organization than the rows' erases nothing, and the question before leaving stays",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(84)
        const first = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
        first.open(viewAt({ id, revision: 4 }))
        yield* settle
        first.decide("row-2")
        yield* settle
        browser.listeners["beforeunload"] = []
        // Another tab switched the session to Northline after this page's session had answered Prairie.
        const again = page(
          id,
          dana,
          { ...serverStart, signedOut: false, removed: true, in: "org_northline" },
          undefined
        )
        again.registry.mount(askBeforeLeaving)
        again.registry.mount(notices)
        yield* settle
        expect([leaving(), R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie")), says(again)]).toEqual([
          true,
          true,
          []
        ])
      })
  )

  it.live(
    "while its page is open: what waits and what is on hold is named and let go, and nothing asks before the page is left",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        browser.listeners["beforeunload"] = []
        const id = importNo(85)
        const server = {
          signedOut: false,
          removed: false,
          view: viewAt({ id, revision: 4, fileName: "items_messy.csv" })
        }
        const t = page(id, dana, server, undefined)
        t.registry.mount(askBeforeLeaving)
        t.registry.mount(notices)
        t.open(viewAt({ id, revision: 4, fileName: "items_messy.csv" }))
        yield* settle
        // Row 3 is refused (on hold), row 2 waits after a failed save.
        t.decide("row-3")
        yield* settle
        yield* Deferred.fail(
          t.saves[0]!.answer,
          ImportNotFound.make({ reason: "No.", organizationId: OrganizationId.make("org_prairie") })
        )
        yield* settle
        t.decide("row-2")
        yield* settle
        yield* Deferred.fail(t.saves[1]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        expect([leaving(), says(t)]).toEqual([true, []])
        const asked = t.asked.times
        server.removed = true
        importView(id).askAgain(t.registry, O.none())
        yield* settle
        expect([
          leaving(),
          R.has(browser.kept, keyOf(id, "mem_dana", "org_prairie")),
          t.asked.times - asked,
          says(t)
        ]).toEqual([
          false,
          false,
          0,
          [
            {
              title: "items_messy.csv was removed",
              text: "Your decisions on it that were not saved went with it. Row 2: you left out; Row 3: you left out."
            }
          ]
        ])
      })
  )
})

describe("what the runner asks for while nobody looks", () => {
  it.live("Save again pressed off the review with no picture held reads the import, then sends what waits on it", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(91)
      // The import is not read yet: the step is drawn, and the person's row waits with no picture under it.
      const server: { signedOut: boolean; removed: boolean; view?: ImportView } = { signedOut: false, removed: false }
      const t = page(id, dana, server, undefined)
      t.registry.mount(importViewShown(id))
      const leave = t.registry.mount(followDraft(id))
      yield* settle
      t.decide("row-2")
      yield* settle
      expect(A.length(t.saves)).toBe(0)
      // She goes to another page; the server can be read now; she presses Save again on what was said.
      leave()
      yield* settle
      server.view = viewAt({ id, revision: 4 })
      t.registry.set(draftEvents(id), DraftEvent.SaveAgain())
      yield* settle
      expect(A.map(t.saves, (save) => save.payload.set)).toEqual([{ "row-2": out }])
    })
  )

  it.live("not found in another organization than the rows': who is signed in is asked once per answer", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(92)
      const server: { signedOut: boolean; removed: boolean; in?: string } = {
        signedOut: false,
        removed: true,
        in: "org_switched"
      }
      const t = page(id, dana, server, undefined)
      t.registry.mount(importViewShown(id))
      t.registry.mount(followDraft(id))
      yield* settle
      expect(t.asked.times).toBe(1)
      // The same answer again (a refresh, the step drawn again): not asked again.
      t.registry.refresh(importView(id))
      yield* settle
      expect(t.asked.times).toBe(1)
      // Not found where the session now looks, another organization again: asked once more.
      server.in = "org_another"
      t.registry.refresh(importView(id))
      yield* settle
      expect(t.asked.times).toBe(2)
    })
  )

  it.live("the question before the page is left counts the rows of every organization this tab kept", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(93)
      const first = page(id, dana, { ...serverStart, signedOut: false, removed: false }, undefined)
      first.open(viewAt({ id, revision: 4 }))
      yield* settle
      first.decide("row-2")
      yield* settle
      // The page is loaded again for her in her other organization: the rows kept for Example Works still wait.
      browser.listeners["beforeunload"] = []
      const again = page(
        id,
        person("mem_dana_north", "org_northline"),
        { ...serverStart, signedOut: false, removed: false },
        undefined
      )
      again.registry.mount(askBeforeLeaving)
      yield* settle
      expect(leaving()).toBe(true)
    })
  )
})
