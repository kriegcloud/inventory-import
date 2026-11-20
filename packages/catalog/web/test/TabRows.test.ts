// Two tabs of one person on one import (Benjamin, 2026-11-20, "Each tab keeps its own"): each keeps and sends only
// its own waiting rows, a tab opened later takes up rows only from a tab that is gone (closed or crashed), never from
// one still open, and no tab writes over or erases another tab's entry. Each tab is a page of its own: here, the
// app's modules loaded afresh, on the browser's one storage and one set of locks. And a reload asks before leaving
// while its rows wait, before their import is opened again.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as Atom from "effect/reactivity/Atom"
import { vi } from "vitest"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"
import { decisionFromFlags, type SavedDecisions, type SaveRequest } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import { Hold } from "../src/Draft.machine.ts"

// The browser: storage every tab shares, the storage of the tab being loaded, the locks, the leave question, and the
// server every tab reads the import from. A lock is held until its callback's promise settles, and a callback runs
// after the request returns, as a browser's does.
const browser = vi.hoisted(() => {
  const kept: Record<string, string> = {}
  const session: { now: Record<string, string> } = { now: {} }
  const held: Array<string> = []
  const listeners: Record<string, Array<(event: unknown) => void>> = {}
  const server: { revision: number; decisions: Record<string, unknown> } = { revision: 4, decisions: {} }
  const closed = false
  // An erase reaches the storage every tab reads a moment later, as another tab's copy lags behind it in a browser.
  const storage = (of: () => Record<string, string>) => ({
    getItem: (key: string) => of()[key] ?? null,
    setItem: (key: string, value: string) => {
      of()[key] = value
    },
    removeItem: (key: string) => {
      const from = of()
      const was = from[key]
      void Promise.resolve()
        .then(() => undefined)
        .then(() => {
          // Written again since: the later write stands.
          if (from[key] === was) delete from[key]
        })
    },
    key: (index: number) => {
      let at = 0
      for (const key in of()) {
        if (at === index) return key
        at += 1
      }
      return null
    },
    get length() {
      let count = 0
      for (const key in of()) if (key !== "") count += 1
      return count
    }
  })
  Object.assign(globalThis, {
    window: {
      location: { pathname: "/", search: "" },
      localStorage: storage(() => kept),
      sessionStorage: storage(() => session.now),
      addEventListener: (name: string, listener: (event: unknown) => void) => {
        listeners[name] = [...(listeners[name] ?? []), listener]
      },
      removeEventListener: () => undefined
    }
  })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: (name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) =>
          Promise.resolve().then(() => {
            if (held.includes(name)) return callback(null)
            held.push(name)
            return callback({ name }).then((answer) => {
              const index = held.indexOf(name)
              if (index >= 0) held.splice(index, 1)
              return answer
            })
          }),
        query: () => {
          const locks: Array<{ readonly name: string }> = []
          for (const name of held) locks.push({ name })
          return Promise.resolve({ held: locks })
        }
      }
    }
  })
  return { kept, session, held, listeners, server, closed }
})

const settle = Effect.sleep("20 millis")
const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })
const dana = O.some(
  Member.make({
    id: MemberId.make("mem_dana"),
    name: DisplayName.make("Dana"),
    role: "admin",
    organizationId: OrganizationId.make("org_prairie"),
    organizationName: DisplayName.make("Prairie")
  })
)

/** The kept entries of one import's waiting rows, by key: one per tab. */
const entriesOf = (id: ImportId) => R.filter(browser.kept, (_value, key) => Str.includes(`${id}%3Awaiting`)(key))

/**
 * A tab: the app's modules loaded afresh, with this tab's own storage (empty for a new tab, kept for a reload). As the
 * app does at page start, it reads its id and holds its lock, whoever is signed in (`signedIn` none: the sign-in page).
 */
const tab = (own: Record<string, string> = {}, signedIn: O.Option<Member> = dana) =>
  Effect.promise(() => {
    vi.resetModules()
    browser.session.now = own
    return Promise.all([
      import("../src/Draft.atoms.ts"),
      import("../src/ReviewDraft.atoms.ts"),
      import("../src/Imports.atoms.ts"),
      import("../src/Draft.machine.ts"),
      import("@inventory/client/TabAtoms"),
      import("./support/catalog.ts")
    ])
  }).pipe(
    Effect.map(([drafts, review, imports, machine, tabs, support]) => {
      const saves: Array<SaveRequest> = []
      const registry = support.registryFor({
        endpoints: {
          imports: {
            // The server answers a read with what it holds.
            get: (request: { readonly params: { readonly id: ImportId } }) =>
              Effect.sync(() =>
                support.viewAt({
                  id: request.params.id,
                  revision: browser.server.revision,
                  decisions: browser.server.decisions as SavedDecisions,
                  status: browser.closed ? "imported" : "open"
                })
              ),
            // The server never answers a save: every row this tab sends stays waiting, kept.
            decide: (request: { readonly payload: SaveRequest }) =>
              Effect.suspend(() => {
                saves.push(request.payload)
                return Deferred.await(Deferred.makeUnsafe<unknown>())
              }),
            open: () => Effect.succeed({ views: [], older: 0 }),
            remove: () => Effect.void
          }
        },
        signedIn: Atom.make(signedIn)
      })
      registry.mount(tabs.thisTab)
      const view = (id: ImportId) =>
        support.viewAt({
          id,
          revision: browser.server.revision,
          decisions: browser.server.decisions as SavedDecisions,
          status: browser.closed ? "imported" : "open"
        })
      return {
        /** This tab's id once it is its own (empty before): a copy of an open tab takes another once it finds the lock held. */
        get id() {
          return O.getOrElse(registry.get(tabs.thisTab), () => "")
        },
        session: browser.session.now,
        saves,
        registry,
        review,
        /** The import's step is drawn over the server's view: the Review step, or the Result once it is confirmed. */
        open: (id: ImportId) => {
          registry.set(imports.importView(id), view(id))
          registry.mount(imports.importViewShown(id))
          registry.mount(review.reviewLocal(id))
          return registry.mount(review.followDraft(id))
        },
        decide: (id: ImportId, rowId: string, to = out) =>
          registry.set(review.draftEvents(id), machine.DraftEvent.Decided({ changes: { [rowId]: O.some(to) } })),
        onHold: (id: ImportId) => registry.get(review.rowsOnHold(id)),
        asks: () => {
          registry.mount(drafts.askBeforeLeaving)
          let asked = false
          for (const listener of browser.listeners["beforeunload"] ?? []) {
            listener({
              preventDefault: () => {
                asked = true
              }
            })
          }
          return asked
        },
        mountsAskAgain: () => registry.mount(drafts.askBeforeLeaving),
        /** The person removes the import, from this tab. */
        remove: (id: ImportId) => {
          registry.mount(imports.removeImport(id))
          registry.set(imports.removeImport(id), view(id))
        },
        /** The tab is closed: its lock goes with it. */
        close: () => {
          const index = browser.held.indexOf(`inventory-tab:${O.getOrElse(registry.get(tabs.thisTab), () => "")}`)
          if (index >= 0) browser.held.splice(index, 1)
        }
      }
    })
  )

/** A new import's server: nothing decided, open, at revision 4. */
const freshServer = (): void => {
  browser.server.revision = 4
  browser.server.decisions = {}
  browser.closed = false
}

describe("two tabs of one person", () => {
  it.live("each keeps its own entry: a decision in one never writes over or erases the other's", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000a1" as ImportId
      const first = yield* tab()
      yield* settle
      first.open(id)
      yield* settle
      first.decide(id, "row-2")
      yield* settle
      const second = yield* tab()
      yield* settle
      expect(second.id).not.toBe(first.id)
      second.open(id)
      yield* settle
      second.decide(id, "row-3")
      yield* settle
      // Two entries, each with its own tab's row: neither replaced the other.
      const kept = R.values(entriesOf(id))
      expect(A.length(kept)).toBe(2)
      expect(A.map(kept, (text) => [Str.includes('"row-2"')(text), Str.includes('"row-3"')(text)])).toEqual([
        [true, false],
        [false, true]
      ])
      // And each sent only its own.
      expect([A.map(first.saves, (save) => R.keys(save.set)), A.map(second.saves, (save) => R.keys(save.set))]).toEqual(
        [[["row-2"]], [["row-3"]]]
      )
    })
  )

  it.live("a tab opened later takes up nothing from a tab still open, and takes up the rows of one that is gone", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000a2" as ImportId
      const first = yield* tab()
      yield* settle
      first.open(id)
      yield* settle
      first.decide(id, "row-2")
      yield* settle
      // The first tab is still open: a new tab sends nothing of its rows, and leaves its entry.
      const second = yield* tab()
      yield* settle
      second.open(id)
      yield* settle
      expect([second.saves, A.length(R.keys(entriesOf(id)))]).toEqual([[], 1])
      // The first tab is closed. The next tab that opens the import takes its row up, checks it against the import as
      // the server has it now (nobody decided it otherwise), sends it, and its entry goes.
      const firstId = first.id
      first.close()
      const third = yield* tab()
      yield* settle
      third.open(id)
      yield* settle
      expect(A.map(third.saves, (save) => R.keys(save.set))).toEqual([["row-2"]])
      expect(A.filter(R.keys(entriesOf(id)), (key) => Str.endsWith(firstId)(key))).toEqual([])
      // The rows are this tab's now, kept under its own key until the server takes them: never neither.
      const own = A.filter(R.toEntries(entriesOf(id)), ([key]) => Str.endsWith(third.id)(key))
      expect(A.map(own, ([, text]) => Str.includes('"row-2"')(text))).toEqual([true])
    })
  )

  it.live(
    "rows taken up from a tab that is gone are held, not sent, where someone decided them otherwise since (takenup-sends-without-g2)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000a4" as ImportId
        const gone = yield* tab()
        yield* settle
        gone.open(id)
        yield* settle
        gone.decide(id, "row-5")
        yield* settle
        gone.close()
        // Marcus keeps row 5: the server is at revision 5.
        browser.server.revision = 5
        browser.server.decisions = { "row-5": kept }
        const later = yield* tab()
        yield* settle
        later.open(id)
        yield* settle
        expect(later.saves).toEqual([])
        expect(later.onHold(id)).toEqual({
          "row-5": { mine: O.some(out), madeOn: 4, why: Hold.Elsewhere({ theirs: O.some(kept) }) }
        })
      })
  )

  it.live(
    "two tabs that open the import together never both take up a gone tab's entry (two-tabs-take-up-same-orphan)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000a5" as ImportId
        const gone = yield* tab()
        yield* settle
        gone.open(id)
        yield* settle
        gone.decide(id, "row-2")
        yield* settle
        gone.close()
        const one = yield* tab()
        const other = yield* tab()
        yield* settle
        // Opened at the same moment, before either has done anything with what it found.
        one.open(id)
        other.open(id)
        yield* settle
        // The row is in one tab's entry, and sent once.
        const holding = A.filter(R.values(entriesOf(id)), (text) => Str.includes('"row-2"')(text))
        expect([A.length(holding), A.length(one.saves) + A.length(other.saves)]).toEqual([1, 1])
      })
  )

  it.live(
    "a row this tab decided otherwise than a tab that is gone is held, both said; it is never dropped unnamed (takeup-drops-gone-tab-decision-unnamed)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000a6" as ImportId
        const first = yield* tab()
        yield* settle
        first.open(id)
        yield* settle
        first.decide(id, "row-12", out)
        yield* settle
        const second = yield* tab()
        yield* settle
        const leave = second.open(id)
        yield* settle
        second.decide(id, "row-12", kept)
        yield* settle
        first.close()
        // The second tab draws the step again: it takes up the first tab's entry.
        leave()
        yield* settle
        second.open(id)
        yield* settle
        expect(second.onHold(id)).toEqual({
          "row-12": { mine: O.some(out), madeOn: 4, why: Hold.OtherTab({ thisTab: O.some(kept) }) }
        })
        // Kept in this tab's entry, with its own row, until the person picks.
        const own = A.filter(R.toEntries(entriesOf(id)), ([key]) => Str.endsWith(second.id)(key))
        expect(A.map(own, ([, text]) => Str.includes("othertab")(text))).toEqual([true])
      })
  )

  it.live(
    "a gone tab's rows for an import confirmed since are named on the result, never erased unnamed (takenup-into-ended-draft-dropped)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000a7" as ImportId
        const gone = yield* tab()
        yield* settle
        gone.open(id)
        yield* settle
        gone.decide(id, "row-7")
        yield* settle
        gone.close()
        // Somebody confirmed the import without row 7.
        browser.server.revision = 5
        browser.closed = true
        const result = yield* tab()
        yield* settle
        result.open(id)
        yield* settle
        expect(result.registry.get(result.review.rowsLeftOver(id))).toEqual(O.some({ "row-7": O.some(out) }))
      })
  )

  it.live("a copy of an open tab (its storage copied, the id with it) takes an id of its own", () =>
    Effect.gen(function* () {
      const first = yield* tab()
      yield* settle
      const copy = yield* tab({ ...first.session })
      yield* settle
      expect(copy.id).not.toBe(first.id)
    })
  )

  it.live(
    "a copy of an open tab asks nothing before leaving for the rows the original keeps (copied-tab-and-removed-import-leave-question)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000a8" as ImportId
        const first = yield* tab()
        yield* settle
        first.open(id)
        yield* settle
        first.decide(id, "row-2")
        yield* settle
        browser.listeners["beforeunload"] = []
        const copy = yield* tab({ ...first.session })
        // The copy counts its rows as the page starts, before its lock has answered.
        expect(copy.asks()).toBe(false)
        yield* settle
        expect(copy.asks()).toBe(false)
      })
  )

  it.live(
    "a tab on the sign-in page still holds its lock: nobody takes up its rows (signed-out-tab-counts-as-gone)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000a9" as ImportId
        const first = yield* tab()
        yield* settle
        first.open(id)
        yield* settle
        first.decide(id, "row-2")
        yield* settle
        // Signed out: the tab loads the sign-in page, the same tab, and nobody is signed in there.
        first.close()
        const signInPage = yield* tab(first.session, O.none())
        yield* settle
        const other = yield* tab()
        yield* settle
        other.open(id)
        yield* settle
        expect([signInPage.id, other.saves]).toEqual([first.id, []])
      })
  )
})

describe("a tab taken up from that comes back", () => {
  it.live(
    "and is gone again is taken up again, by the page that took it up before: the claim is let go once the take-up is done (claim-held-for-page-life)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000c1" as ImportId
        const gone = yield* tab()
        yield* settle
        gone.open(id)
        yield* settle
        gone.decide(id, "row-2")
        yield* settle
        const goneSession = { ...gone.session }
        gone.close()
        const later = yield* tab()
        yield* settle
        const leave = later.open(id)
        yield* settle
        expect(A.map(later.saves, (save) => R.keys(save.set))).toEqual([["row-2"]])
        // The gone tab is loaded again (the same tab), decides row 3, and is closed again.
        const back = yield* tab(goneSession)
        yield* settle
        back.open(id)
        yield* settle
        back.decide(id, "row-3")
        yield* settle
        back.close()
        yield* Effect.sleep("700 millis")
        // The page that took it up before draws the step again: it takes row 3 up, kept under its own key.
        leave()
        yield* settle
        later.open(id)
        yield* settle
        const own = A.filter(R.toEntries(entriesOf(id)), ([key]) => Str.endsWith(later.id)(key))
        expect(A.map(own, ([, text]) => Str.includes('"row-3"')(text))).toEqual([true])
      })
  )
})

describe("a step drawn before this tab's id is its own", () => {
  it.live(
    "reads the rows the tab kept before a reload once its id is, and writes nothing over them before (opened-before-tab)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000c2" as ImportId
        const before = yield* tab()
        yield* settle
        before.open(id)
        yield* settle
        before.decide(id, "row-2")
        yield* settle
        before.close()
        // The reload draws the step at once, before the tab's lock has answered.
        const after = yield* tab(before.session)
        after.open(id)
        yield* settle
        // The row kept came back, was checked by an answer of the import, and was sent.
        expect(A.map(after.saves, (save) => R.keys(save.set))).toEqual([["row-2"]])
        const own = A.filter(R.toEntries(entriesOf(id)), ([key]) => Str.endsWith(after.id)(key))
        expect(A.map(own, ([, text]) => Str.includes('"row-2"')(text))).toEqual([true])
      })
  )
})

describe("an import removed", () => {
  it.live(
    "takes with it the rows a tab that is gone kept for it, and leaves a tab still open its own (two-of-49-partly-open)",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000b1" as ImportId
        const gone = yield* tab()
        yield* settle
        gone.open(id)
        yield* settle
        gone.decide(id, "row-2")
        yield* settle
        // Another tab has its own row of the import, opened while the first was still open (it took nothing up).
        const open = yield* tab()
        yield* settle
        open.open(id)
        yield* settle
        open.decide(id, "row-3")
        yield* settle
        const goneId = gone.id
        gone.close()
        // A third tab removes the import before taking anything up.
        const remover = yield* tab()
        yield* settle
        remover.remove(id)
        yield* settle
        expect(A.map(R.keys(entriesOf(id)), (key) => [Str.endsWith(goneId)(key), Str.endsWith(open.id)(key)])).toEqual([
          [false, true]
        ])
      })
  )
})

describe("one tab", () => {
  it.live(
    "keeps one id for its life: the leave question drawn afresh asks for no lock again (tab-id-changes-on-remount)",
    () =>
      Effect.gen(function* () {
        const one = yield* tab()
        yield* settle
        const before = one.id
        const stop = one.mountsAskAgain()
        yield* settle
        stop()
        yield* settle
        one.mountsAskAgain()
        yield* settle
        expect(one.id).toBe(before)
      })
  )
})

describe("after a reload", () => {
  it.live("the question before leaving is asked while this tab's rows wait, before their import is opened again", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000a3" as ImportId
      const before = yield* tab()
      yield* settle
      before.open(id)
      yield* settle
      before.decide(id, "row-2")
      yield* settle
      // The reload: the same tab (its own storage kept), on another page; its lock was let go with the old page.
      before.close()
      browser.listeners["beforeunload"] = []
      const after = yield* tab(before.session)
      yield* settle
      expect(after.id).toBe(before.id)
      expect(after.asks()).toBe(true)
    })
  )
})
