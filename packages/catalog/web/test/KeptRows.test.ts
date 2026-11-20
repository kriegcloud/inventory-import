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
import { DraftEvent, Hold } from "../src/Draft.machine.ts"
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
  rowsOnHold
} from "../src/ReviewDraft.atoms.ts"
import { importNo, registryFor, viewAt } from "./support/catalog.ts"

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
        listeners[name] = [...(listeners[name] ?? []), listener]
      },
      removeEventListener: (name: string, listener: (event: unknown) => void) => {
        const others: Array<(event: unknown) => void> = []
        for (const each of listeners[name] ?? []) if (each !== listener) others.push(each)
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
  for (const listener of browser.listeners["beforeunload"] ?? []) {
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
const keyOf = (id: ImportId, memberId: string, organizationId = "org_prairie") =>
  progressKey({ organizationId, memberId, screen: `import:${id}:waiting:${browser.tab["inventory:tab"] ?? ""}` })

/**
 * One page of the app, on the shared storage: the server answers each save only when the test says, and refuses it as
 * nobody signed in while `server.signedOut`; a read of the import never answers, unless the import was removed. Asking
 * who is signed in again is counted (`asked`); the test says who is.
 */
const page = (
  id: ImportId,
  signedIn = dana,
  server: { signedOut: boolean; removed: boolean; view?: ImportView } = { signedOut: false, removed: false }
) => {
  const saves: Array<{ readonly payload: SaveRequest; readonly answer: Deferred.Deferred<unknown, SaveFailure> }> = []
  // The confirms sent; the server never answers one.
  const commits: Array<SaveRequest & { readonly revision: number }> = []
  const who = Atom.make(signedIn)
  const asked = { times: 0 }
  const registry = registryFor({
    endpoints: {
      imports: {
        get: () =>
          server.removed
            ? Effect.fail(ImportNotFound.make({ reason: "It is gone." }))
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
    signedIn: Atom.readable(
      (get) => get(who),
      () => {
        asked.times += 1
      }
    )
  })
  return {
    registry,
    saves,
    commits,
    who,
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
      Deferred.succeed(saves[n]!.answer, { revision, changed: true, notApplied: [] })
  }
}

describe("the waiting rows this browser keeps", () => {
  it.live("are cleared under the member who decided them when the save answers after a switch of organization", () =>
    Effect.gen(function* () {
      const id = importNo(61)
      const t = page(id)
      t.open(viewAt({ id, revision: 12 }))
      yield* settle
      t.decide("row-31")
      yield* settle
      expect(R.has(browser.kept, keyOf(id, "mem_dana"))).toBe(true)
      // Dana picks her other organization before the answer comes.
      t.registry.set(t.who, person("mem_dana", "org_northline"))
      yield* t.answer(0, 13)
      yield* settle
      // The server took the row: nothing of it is kept under her Example Works key, or under the other one.
      expect([
        R.has(browser.kept, keyOf(id, "mem_dana")),
        R.has(browser.kept, keyOf(id, "mem_dana", "org_northline"))
      ]).toEqual([false, false])
    })
  )

  it.live("are one member's: another member opening the same import in this browser sends none and shows none", () =>
    Effect.gen(function* () {
      const id = importNo(62)
      const first = page(id)
      first.open(viewAt({ id, revision: 4 }))
      yield* settle
      first.decide("row-2")
      yield* settle
      // Dana's save never answers: the row waits, kept for her.
      expect(R.has(browser.kept, keyOf(id, "mem_dana"))).toBe(true)
      const other = page(id, person("mem_lee", "org_prairie"))
      other.open(viewAt({ id, revision: 4 }))
      yield* settle
      expect([other.saves.length, R.has(browser.kept, keyOf(id, "mem_lee"))]).toEqual([0, false])
    })
  )

  it.live("are erased with the import when it is removed", () =>
    Effect.gen(function* () {
      const id = importNo(63)
      const t = page(id)
      const view = viewAt({ id, revision: 4, fileName: "a.csv" })
      const leave = t.open(view)
      yield* settle
      t.decide("row-2")
      yield* settle
      leave()
      expect(R.has(browser.kept, keyOf(id, "mem_dana"))).toBe(true)
      t.registry.mount(removeImport(id))
      t.registry.set(removeImport(id), view)
      yield* settle
      expect(R.has(browser.kept, keyOf(id, "mem_dana"))).toBe(false)
    })
  )

  it.live("of an import found closed are sent nowhere, named by the result, and dropped once it has named them", () =>
    Effect.gen(function* () {
      const id = importNo(64)
      const t = page(id)
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
      expect(t.registry.get(rowsLeftOver(id))).toEqual(O.some({ "row-3": O.some(out) }))
      expect(R.has(browser.kept, keyOf(id, "mem_dana"))).toBe(true)
      // The result names them; when it is left, nothing of them is kept.
      const naming = t.registry.mount(namingLeftOver(id))
      yield* settle
      naming()
      yield* settle
      expect([t.registry.get(rowsLeftOver(id)), R.has(browser.kept, keyOf(id, "mem_dana"))]).toEqual([O.none(), false])
    })
  )
})

describe("the question before the page is left", () => {
  it.live("is asked while rows wait to be sent, wherever the person is, and not once the app leaves on purpose", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(65)
      const t = page(id)
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
      for (const listener of browser.listeners[leavingApp] ?? []) listener({})
      expect(leaving()).toBe(false)
    })
  )

  it.live("is not asked for rows that are only to be named: they are never sent", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(66)
      const t = page(id)
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

  it.live(
    "is not asked for rows of an import removed meanwhile: they are erased at page start (copied-tab-and-removed-import-leave-question)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(67)
        const first = page(id)
        first.open(viewAt({ id, revision: 4 }))
        yield* settle
        first.decide("row-2")
        yield* settle
        expect(R.has(browser.kept, keyOf(id, "mem_dana"))).toBe(true)
        // A colleague removes the import; the page is loaded again.
        browser.listeners["beforeunload"] = []
        const again = page(id, dana, { signedOut: false, removed: true })
        again.registry.mount(askBeforeLeaving)
        yield* settle
        expect([leaving(), R.has(browser.kept, keyOf(id, "mem_dana"))]).toEqual([false, false])
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
        const t = page(id, dana, server)
        const leave = t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        // Through the runner: the server's refusal is not a refusal of the row. Nothing is on hold, the row waits, kept
        // under Dana's key, and who is signed in is asked again (the tab then shows the sign-in page).
        expect([
          A.length(t.saves),
          t.registry.get(rowsOnHold(id)),
          t.registry.get(rowsNotSaved(id)),
          R.has(browser.kept, keyOf(id, "mem_dana")),
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
          R.has(browser.kept, keyOf(id, "mem_marcus")),
          R.has(browser.kept, keyOf(id, "mem_dana"))
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
    "is named from the view until the person dismisses it; the dismissal is kept per person and import in this browser (match-taken-back-not-named)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(70)
        const view = viewAt({ id, revision: 5, takenBack: taken })
        const t = page(id)
        t.open(view)
        t.registry.mount(takeBacksNamed(id))
        yield* settle
        expect(t.registry.get(takeBacksNamed(id))).toEqual(taken)
        t.registry.set(dismissTakeBack(id), taken[0]!)
        expect(t.registry.get(takeBacksNamed(id))).toEqual([taken[1]])
        // The page loaded again: still dismissed for Dana; named to Lee, who has not dismissed it.
        const again = page(id)
        again.open(view)
        again.registry.mount(takeBacksNamed(id))
        const lee = page(id, person("mem_lee", "org_prairie"))
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
    "come back after a reload: a waiting row decided elsewhere meanwhile is held, a refused row keeps its reason, and nothing is sent (kept-codec-untested)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(69)
        const first = page(id)
        first.open(viewAt({ id, revision: 4 }))
        yield* settle
        // Row 3's save is refused; row 2's then fails on the network.
        first.decide("row-3")
        yield* settle
        yield* Deferred.fail(first.saves[0]!.answer, ImportNotFound.make({ reason: "It is gone." }))
        yield* settle
        first.decide("row-2")
        yield* settle
        yield* Deferred.fail(first.saves[1]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        const refused = R.get(first.registry.get(rowsOnHold(id)), "row-3")
        expect(O.isSome(refused)).toBe(true)
        // The page is loaded again; Lee has kept row 2 meanwhile (revision 5).
        const kept = decisionFromFlags({ kept: true })
        const later = viewAt({ id, revision: 5, decisions: { "row-2": kept } })
        const again = page(id, dana, { signedOut: false, removed: false, view: later })
        again.open(later)
        yield* settle
        const held = again.registry.get(rowsOnHold(id))
        expect([R.get(held, "row-3"), O.map(R.get(held, "row-2"), (one) => one.why)]).toEqual([
          refused,
          O.some(Hold.Elsewhere({ theirs: O.some(kept) }))
        ])
        expect(again.saves).toEqual([])
      })
  )
})

const marcus = person("mem_marcus", "org_prairie")
const keptDecision = decisionFromFlags({ kept: true })

describe("the third check of round one, through the runner", () => {
  it.live(
    "a row that waits is not checked by the view the step finds when drawn again: the import is asked, and its answer holds a decision made since (redraw-skips-g2)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(71)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = {
          signedOut: false,
          removed: false,
          view: viewAt({ id, revision: 4 })
        }
        const t = page(id, dana, server)
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
        // Back to Review: the step is drawn again over the view the tab held, through `importViewShown`.
        t.registry.mount(followDraft(id))
        yield* settle
        expect(A.length(t.saves)).toBe(1)
        expect(O.map(R.get(t.registry.get(rowsOnHold(id)), "row-2"), (one) => one.why)).toEqual(
          O.some(Hold.Elsewhere({ theirs: O.some(keptDecision) }))
        )
      })
  )

  it.live(
    "a confirm pressed by someone else signed in on this page never carries the rows of the member who decided them (confirm-sends-anothers-rows)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(72)
        // The import, as the server answers it for whoever is signed in.
        const t = page(id, dana, { signedOut: false, removed: false, view: viewAt({ id, revision: 4 }) })
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        yield* Deferred.fail(t.saves[0]!.answer, HttpApiError.InternalServerErrorProblem.make({}))
        yield* settle
        // Marcus signs in on this page, and presses the confirm.
        t.registry.set(t.who, marcus)
        yield* settle
        t.registry.set(draftEvents(id), DraftEvent.ConfirmPressed())
        yield* settle
        expect(A.map(t.commits, (commit) => [commit.revision, R.keys(commit.set)])).toEqual([[4, []]])
        // Dana's row stays kept for her.
        expect(R.has(browser.kept, keyOf(id, "mem_dana"))).toBe(true)
      })
  )

  it.live(
    "a decision by someone else signed in on this page is made on the picture the screen shows, never on none (decided-after-let-go)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(73)
        const t = page(id, dana, { signedOut: false, removed: false, view: viewAt({ id, revision: 4 }) })
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
    "a read of the import that answers not found erases nothing kept: the import may be another organization's now (notfound-erases-rows)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(74)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = { signedOut: false, removed: false }
        const t = page(id, dana, server)
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        expect(R.has(browser.kept, keyOf(id, "mem_dana"))).toBe(true)
        // Another tab switched the session's organization: this one's read of the import answers not found.
        server.removed = true
        importView(id).askAgain(t.registry)
        yield* settle
        expect([R.has(browser.kept, keyOf(id, "mem_dana")), t.asked.times > 0]).toEqual([true, true])
      })
  )

  it.live(
    "a save answered that the import was too busy waits to be sent again: it is never held as refused (draft-busy)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        const id = importNo(75)
        const t = page(id)
        t.open(viewAt({ id, revision: 4 }))
        yield* settle
        t.decide("row-2")
        yield* settle
        yield* Deferred.fail(t.saves[0]!.answer, DraftBusy.make({ reason: "The import kept changing." }))
        yield* settle
        expect([t.registry.get(rowsOnHold(id)), t.registry.get(rowsNotSaved(id))]).toEqual([{}, 1])
      })
  )

  it.live(
    "rows that wait for their member are said as not sent because someone else is signed in, when someone else is (signedout-words)",
    () =>
      Effect.gen(function* () {
        emptyStorage()
        browser.said.length = 0
        const id = importNo(76)
        const server: { signedOut: boolean; removed: boolean; view?: ImportView } = { signedOut: false, removed: false }
        const t = page(id, dana, server)
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

  it.live("the take-backs a person dismissed go with the import when it is removed (dismissals-outlive-import)", () =>
    Effect.gen(function* () {
      emptyStorage()
      const id = importNo(77)
      const view = viewAt({ id, revision: 5, takenBack: taken })
      const t = page(id)
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
})
