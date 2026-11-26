import * as MutableRef from "effect/MutableRef"
import { assertTrue } from "@effect/vitest/utils"
import { identity } from "effect/Function"
// Two tabs of one person on one import (Benjamin, 2026-11-20, "Each tab keeps its own"): each keeps and sends only
// its own waiting rows, a tab opened later takes up rows only from a tab that is gone (closed or crashed), never from
// one still open, and no tab writes over or erases another tab's entry. Each tab is a page of its own: here, the
// app's modules loaded afresh, on the browser's one storage and one set of locks. And a reload asks before leaving
// while its rows wait, before their import is opened again.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
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
import type { ImportView } from "@inventory/catalog-contract/Import"
import { ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import * as Order from "effect/Order"
import { noticeWords } from "../src/internal/notices.ts"

// The browser: storage every tab shares, the storage of the tab being loaded, the locks, the leave question, and the
// server every tab reads the import from. A lock is held until its callback's promise settles, and a callback runs
// after the request returns, as a browser's does.
const session: MutableRef.MutableRef<{ readonly now: Record<string, string> }> = MutableRef.make<{
  readonly now: Record<string, string>
}>({ now: {} })
const server: MutableRef.MutableRef<{
  readonly revision: number
  readonly decisions: Record<string, unknown>
  readonly removed: boolean
}> = MutableRef.make<{
  readonly revision: number
  readonly decisions: Record<string, unknown>
  readonly removed: boolean
}>({
  revision: 4,
  decisions: {},
  removed: false
})

const browser = vi.hoisted(() => {
  const kept: Record<string, string> = {}

  const held: Array<{ readonly name: string; readonly mode: "exclusive" | "shared" }> = []
  // The requests that wait for a lock, oldest first: each is tried again whenever one is let go.
  const queued: Array<{ readonly name: string; readonly tryNow: () => boolean }> = []
  // Set by a test: the next answer of what is held is worked out when it is asked and given when the test says.
  const queryNow = (locks: ReadonlyArray<{ readonly name: string }>) => Promise.resolve({ held: locks })
  const gate = { answer: queryNow }
  const listeners: Record<string, Array<(event: unknown) => void>> = {}

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
      sessionStorage: storage(() => session.current.now),
      addEventListener: (name: string, listener: (event: unknown) => void) => {
        listeners[name] = [...O.match(R.get(listeners, name), { onNone: A.empty, onSome: identity }), listener]
      },
      removeEventListener: () => undefined
    }
  })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: (
          name: string,
          options: { readonly mode?: "exclusive" | "shared"; readonly ifAvailable?: boolean },
          callback: (lock: unknown) => Promise<unknown>
        ) =>
          Promise.resolve().then(() => {
            const mode = options.mode ?? "exclusive"
            // As a browser grants: a shared lock beside shared ones, an exclusive one alone, and never past a request
            // that waits for the same lock already.
            const free = (): boolean => {
              for (const lock of held) {
                if (lock.name === name && (mode === "exclusive" || lock.mode === "exclusive")) return false
              }
              return true
            }
            const given = () => {
              const lock = { name, mode }
              held.push(lock)
              return callback(lock).then((answer) => {
                const index = held.indexOf(lock)
                if (index >= 0) held.splice(index, 1)
                for (const waits of [...queued]) if (waits.tryNow()) queued.splice(queued.indexOf(waits), 1)
                return answer
              })
            }
            let waited = false
            for (const waits of queued) waited = waited || waits.name === name
            if (!waited && free()) return given()
            if (options.ifAvailable === true) return callback(null)
            const { promise, resolve } = Promise.withResolvers<unknown>()
            queued.push({
              name,
              tryNow: () => {
                if (!free()) return false
                resolve(given())
                return true
              }
            })
            return promise
          }),
        query: () => {
          const locks: Array<{ readonly name: string }> = []
          for (const lock of held) locks.push({ name: lock.name })
          return gate.answer(locks)
        }
      }
    }
  })
  return {
    kept,
    get session() {
      return session
    },
    held,
    listeners,
    get server() {
      return server
    },
    closed,
    gate,
    queryNow
  }
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
const tab = (own: Record<string, string>, signedIn: O.Option<Member>) =>
  Effect.promise(() => {
    vi.resetModules()
    browser.session.current = { ...browser.session.current, now: own }
    return Promise.all([
      import("../src/Draft.atoms.ts"),
      import("../src/ReviewDraft.atoms.ts"),
      import("../src/Imports.atoms.ts"),
      import("../src/Draft.machine.ts"),
      import("@inventory/client/TabAtoms"),
      import("./support/catalog.ts"),
      import("../src/Notices.atoms.ts")
    ])
  }).pipe(
    Effect.map(([drafts, review, imports, machine, tabs, support, noticed]) => {
      const saves: Array<SaveRequest> = []
      const registry = support.registryFor({
        ...support.registryStart,
        endpoints: {
          imports: {
            // The server answers a read with what it holds.
            get: (request: { readonly params: { readonly id: ImportId } }) =>
              Effect.suspend((): Effect.Effect<ImportView, ImportNotFound> =>
                browser.server.current.removed
                  ? Effect.fail(
                      ImportNotFound.make({
                        reason: "It is gone.",
                        organizationId: OrganizationId.make("org_prairie")
                      })
                    )
                  : Effect.succeed(view(request.params.id))
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
        signedIn: signedIn.pipe((who) => Atom.make(who), O.some)
      })
      registry.mount(tabs.thisTab)
      const view = (id: ImportId) =>
        support.viewAt({
          id,
          revision: browser.server.current.revision,
          decisions: browser.server.current.decisions as SavedDecisions,
          status: browser.closed ? "imported" : "open",
          fileName: "items_messy.csv"
        })
      registry.mount(noticed.notices)
      return {
        /** This tab's id once it is its own (empty before): a copy of an open tab takes another once it finds the lock held. */
        get id() {
          return O.getOrElse(registry.get(tabs.thisTab), () => "")
        },
        session: browser.session.current.now,
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
        decide: (id: ImportId, rowId: string, to: typeof out) =>
          registry.set(review.draftEvents(id), machine.DraftEvent.Decided({ changes: { [rowId]: O.some(to) } })),
        /** The lines above the review, each row's: its sides, as decision and whether this tab's, and theirs. */
        lines: (id: ImportId) =>
          R.map(registry.get(review.reviewLines(id)), (line) => ({
            sides: A.map(line.sides, (side) => [side.decision, side.here] as const),
            going: line.going,
            theirs: line.theirs
          })),
        /** What this tab says of unsaved decisions, as the person reads it; and the first of it dismissed. */
        says: () => A.map(registry.get(noticed.notices), (one) => noticeWords(one).text),
        dismiss: () => {
          const requiredEntry1 = A.get(registry.get(noticed.notices), 0)
          assertTrue(O.isSome(requiredEntry1), "expected registry.get(noticed.notices)[0]")
          return registry.set(noticed.dismissNotice, requiredEntry1.value)
        },
        /** The import is read again. */
        /** The import page is open on this import's address, with no step drawn yet. */
        openAddress: (id: ImportId) => {
          registry.mount(imports.importViewShown(id))
          registry.mount(imports.followRemoval(id))
        },
        readsAgain: (id: ImportId) => imports.importView(id).askAgain(registry, O.none()),
        asks: () => {
          registry.mount(drafts.askBeforeLeaving)
          let asked = false
          for (const listener of O.match(R.get(browser.listeners, "beforeunload"), {
            onNone: A.empty,
            onSome: identity
          })) {
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
          O.map(registry.get(tabs.thisTab), (tab) => {
            const own = `inventory-tab:${tab}`
            O.map(
              A.findFirstIndex(browser.held, (lock) => lock.name === own),
              (index) => browser.held.splice(index, 1)
            )
          })
        }
      }
    })
  )

/** A new import's server: nothing decided, open, at revision 4. */
const freshServer = (): void => {
  browser.server.current = { ...browser.server.current, revision: 4 }
  browser.server.current = { ...browser.server.current, decisions: {} }
  browser.server.current = { ...browser.server.current, removed: false }
  browser.closed = false
}

describe("two tabs of one person", () => {
  it.live("each keeps its own entry: a decision in one never writes over or erases the other's", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000a1" as ImportId
      const first = yield* tab({}, dana)
      yield* settle
      first.open(id)
      yield* settle
      first.decide(id, "row-2", out)
      yield* settle
      const second = yield* tab({}, dana)
      yield* settle
      expect(second.id).not.toBe(first.id)
      second.open(id)
      yield* settle
      second.decide(id, "row-3", out)
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
      const first = yield* tab({}, dana)
      yield* settle
      first.open(id)
      yield* settle
      first.decide(id, "row-2", out)
      yield* settle
      // The first tab is still open: a new tab sends nothing of its rows, and leaves its entry.
      const second = yield* tab({}, dana)
      yield* settle
      second.open(id)
      yield* settle
      expect([second.saves, A.length(R.keys(entriesOf(id)))]).toEqual([[], 1])
      // The first tab is closed. The next tab that opens the import takes its row up, checks it against the import as
      // the server has it now (nobody decided it otherwise), sends it, and its entry goes.
      const firstId = first.id
      first.close()
      const third = yield* tab({}, dana)
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
    "rows taken up from a tab that is gone, that the picture shows somebody decided since, are on a line with theirs and not sent while it asks",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000a4" as ImportId
        const gone = yield* tab({}, dana)
        yield* settle
        gone.open(id)
        yield* settle
        gone.decide(id, "row-5", out)
        yield* settle
        gone.close()
        // Marcus keeps row 5: the server is at revision 5.
        browser.server.current = { ...browser.server.current, revision: 5 }
        browser.server.current = { ...browser.server.current, decisions: { "row-5": kept } }
        const later = yield* tab({}, dana)
        yield* settle
        later.open(id)
        yield* settle
        expect(later.saves).toEqual([])
        expect(later.lines(id)).toEqual({
          "row-5": { sides: [[O.some(out), false]], going: O.none(), theirs: O.some(O.some(kept)) }
        })
      })
  )

  it.live("two tabs that open the import together never both take up a gone tab's entry", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000a5" as ImportId
      const gone = yield* tab({}, dana)
      yield* settle
      gone.open(id)
      yield* settle
      gone.decide(id, "row-2", out)
      yield* settle
      gone.close()
      const one = yield* tab({}, dana)
      const other = yield* tab({}, dana)
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
    "a row this tab decided otherwise than a tab that is gone is one line with both sides; it is never dropped unnamed",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000a6" as ImportId
        const first = yield* tab({}, dana)
        yield* settle
        first.open(id)
        yield* settle
        first.decide(id, "row-12", out)
        yield* settle
        const second = yield* tab({}, dana)
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
        // This tab's decision is on its way (the server has not answered): the line has the closed tab's beside it.
        expect(second.lines(id)).toEqual({
          "row-12": { sides: [[O.some(out), false]], going: O.some(O.some(kept)), theirs: O.none() }
        })
        // Kept in this tab's entry as that line, until the person picks.
        const own = A.filter(R.toEntries(entriesOf(id)), ([key]) => Str.endsWith(second.id)(key))
        expect(A.map(own, ([, text]) => Str.includes('"lines":{"row-12":{"sides"')(text))).toEqual([true])
      })
  )

  it.live("a gone tab's rows for an import confirmed since are named on the result, never erased unnamed", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000a7" as ImportId
      const gone = yield* tab({}, dana)
      yield* settle
      gone.open(id)
      yield* settle
      gone.decide(id, "row-7", out)
      yield* settle
      gone.close()
      // Somebody confirmed the import without row 7.
      browser.server.current = { ...browser.server.current, revision: 5 }
      browser.closed = true
      const result = yield* tab({}, dana)
      yield* settle
      result.open(id)
      yield* settle
      expect(result.registry.get(result.review.rowsLeftOver(id))).toEqual(
        O.some({ rows: { "row-7": O.some(out) }, beside: {}, theirs: {} })
      )
    })
  )

  it.live("a copy of an open tab (its storage copied, the id with it) takes an id of its own", () =>
    Effect.gen(function* () {
      const first = yield* tab({}, dana)
      yield* settle
      const copy = yield* tab({ ...first.session }, dana)
      yield* settle
      expect(copy.id).not.toBe(first.id)
    })
  )

  it.live("a copy of an open tab asks nothing before leaving for the rows the original keeps", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000a8" as ImportId
      const first = yield* tab({}, dana)
      yield* settle
      first.open(id)
      yield* settle
      first.decide(id, "row-2", out)
      yield* settle
      browser.listeners["beforeunload"] = []
      const copy = yield* tab({ ...first.session }, dana)
      // The copy counts its rows as the page starts, before its lock has answered.
      expect(copy.asks()).toBe(false)
      yield* settle
      expect(copy.asks()).toBe(false)
    })
  )

  it.live("a tab on the sign-in page still holds its lock: nobody takes up its rows", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000a9" as ImportId
      const first = yield* tab({}, dana)
      yield* settle
      first.open(id)
      yield* settle
      first.decide(id, "row-2", out)
      yield* settle
      // Signed out: the tab loads the sign-in page, the same tab, and nobody is signed in there.
      first.close()
      const signInPage = yield* tab(first.session, O.none())
      yield* settle
      const other = yield* tab({}, dana)
      yield* settle
      other.open(id)
      yield* settle
      expect([signInPage.id, other.saves]).toEqual([first.id, []])
    })
  )
})

describe("a tab taken up from that comes back", () => {
  it.live(
    "and is gone again is taken up again, by the page that took it up before: the claim is let go once the take-up is done",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000c1" as ImportId
        const gone = yield* tab({}, dana)
        yield* settle
        gone.open(id)
        yield* settle
        gone.decide(id, "row-2", out)
        yield* settle
        const goneSession = { ...gone.session }
        gone.close()
        const later = yield* tab({}, dana)
        yield* settle
        const leave = later.open(id)
        yield* settle
        expect(A.map(later.saves, (save) => R.keys(save.set))).toEqual([["row-2"]])
        // The gone tab is loaded again (the same tab), decides row 3, and is closed again.
        const back = yield* tab(goneSession, dana)
        // Loaded while the take-up's claim lasts: it has its id, and reads what it kept, once that is let go.
        yield* Effect.sleep("600 millis")
        back.open(id)
        yield* settle
        back.decide(id, "row-3", out)
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

const marcus = O.some(
  Member.make({
    id: MemberId.make("mem_marcus"),
    name: DisplayName.make("Marcus"),
    role: "admin",
    organizationId: OrganizationId.make("org_prairie"),
    organizationName: DisplayName.make("Prairie")
  })
)

/** A promise that settles once the test answers. */
const held = (answer: Deferred.Deferred<void>): Promise<void> => answer.pipe(Deferred.await, Effect.runPromise)

/** What a tab says when it loads and finds its waiting rows 12 and 31 taken up. */
const taken12And31 =
  "Row 12, row 31 of items_messy.csv: another tab of yours has your decisions now, and this tab no longer does."

describe("a tab the browser discarded (or had not loaded yet), taken up from, that loads again", () => {
  it.live(
    "says so, naming the import and the rows, until dismissed; restores and sends none of them; and nobody else is told",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000d1" as ImportId
        const discarded = yield* tab({}, dana)
        yield* settle
        discarded.open(id)
        yield* settle
        discarded.decide(id, "row-31", out)
        discarded.decide(id, "row-12", out)
        yield* settle
        const session = discarded.session
        discarded.close()
        const taker = yield* tab({}, dana)
        yield* settle
        taker.open(id)
        yield* settle
        // The tab that took them up sends them, and says nothing of it.
        expect([
          A.sort(
            A.flatMap(taker.saves, (save) => R.keys(save.set)),
            Order.String
          ),
          taker.says()
        ]).toEqual([["row-12", "row-31"], []])
        yield* Effect.sleep("600 millis")
        // Marcus signs in on the discarded tab first: Dana's rows are not his to be told of.
        const asMarcus = yield* tab(session, marcus)
        yield* settle
        expect([asMarcus.id, asMarcus.says()]).toEqual([discarded.id, []])
        asMarcus.close()
        // Dana loads it: it says so, and it has nothing of them, on the screen, in the browser or on their way.
        const back = yield* tab(session, dana)
        yield* settle
        expect([back.id, back.says()]).toEqual([discarded.id, [taken12And31]])
        back.open(id)
        yield* settle
        const own = A.filter(R.keys(entriesOf(id)), (key) => Str.endsWith(back.id)(key))
        expect([back.saves, back.lines(id), back.registry.get(back.review.rowsNotSaved(id)), own]).toEqual([
          [],
          {},
          0,
          []
        ])
        // Not dismissed: said again when it loads again. Dismissed: never again.
        back.close()
        const again = yield* tab(session, dana)
        yield* settle
        expect(again.says()).toEqual([taken12And31])
        again.dismiss()
        yield* settle
        expect(again.says()).toEqual([])
        again.close()
        const last = yield* tab(session, dana)
        yield* settle
        expect([last.says(), A.filter(R.keys(browser.kept), Str.endsWith(`notices%3A${last.id}`))]).toEqual([[], []])
      })
  )

  it.live(
    "loading while the other tab is in the middle of taking its rows up: one of the two sends them, never both",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000d2" as ImportId
        const discarded = yield* tab({}, dana)
        yield* settle
        discarded.open(id)
        yield* settle
        discarded.decide(id, "row-2", out)
        yield* settle
        const session = discarded.session
        discarded.close()
        const taker = yield* tab({}, dana)
        yield* settle
        // The taker has asked the browser which locks are held (the discarded tab's is not), and has not read yet.
        const answer = Deferred.makeUnsafe<void>()
        const wait = held(answer)
        browser.gate.answer = (locks) => wait.then(() => ({ held: locks }))
        taker.open(id)
        yield* settle
        // The discarded tab loads at that moment, and its step is drawn.
        const back = yield* tab(session, dana)
        back.open(id)
        yield* settle
        browser.gate.answer = browser.queryNow
        yield* Deferred.succeed(answer, undefined)
        yield* Effect.sleep("700 millis")
        const all = [...taker.saves, ...back.saves]
        expect(A.map(all, (save) => R.keys(save.set))).toEqual([["row-2"]])
        // The taker's, here: the tab that loaded keeps its id, has nothing of the row, and says so.
        expect([taker.saves.length, back.id, back.registry.get(back.review.rowsNotSaved(id)), back.says()]).toEqual([
          1,
          discarded.id,
          0,
          ["Row 2 of items_messy.csv: another tab of yours has your decision now, and this tab no longer does."]
        ])
        const holding = A.filter(R.values(entriesOf(id)), (text) => Str.includes('"row-2"')(text))
        expect(A.length(holding)).toBe(1)
      })
  )

  it.live(
    "loaded before the other tab looked: it is open, nothing is taken from it, and it sends its rows itself",
    () =>
      Effect.gen(function* () {
        freshServer()
        const id = "00000000-0000-4000-8000-0000000000d3" as ImportId
        const discarded = yield* tab({}, dana)
        yield* settle
        discarded.open(id)
        yield* settle
        discarded.decide(id, "row-2", out)
        yield* settle
        const session = discarded.session
        discarded.close()
        const taker = yield* tab({}, dana)
        yield* settle
        const back = yield* tab(session, dana)
        yield* settle
        taker.open(id)
        back.open(id)
        yield* settle
        expect([taker.saves, A.map(back.saves, (save) => R.keys(save.set)), back.says()]).toEqual([[], [["row-2"]], []])
      })
  )

  it.live("never coming back: the records left for such tabs are bounded, by how many and by age", () =>
    Effect.gen(function* () {
      freshServer()
      for (const key of R.keys(browser.kept)) delete browser.kept[key]
      const record = (n: string) => `progress:v1:org_prairie:mem_dana:notices%3A${n}`
      const left = (at: number) => `[{"_tag":"TakenUp","importId":"i","fileName":null,"rows":["row-1"],"at":${at}}]`
      const now = DateTime.toEpochMillis(DateTime.nowUnsafe())
      const day = 24 * 60 * 60 * 1000
      // Thirty tabs taken up from within the month, one longer ago than that, and one of another member's.
      for (const n of A.range(1, 30)) browser.kept[record(`tab-${n}`)] = left(now - n * 60_000)
      browser.kept[record("old")] = left(now - 31 * day)
      browser.kept["progress:v1:org_prairie:mem_marcus:notices%3Atheirs"] = left(now - 31 * day)
      const id = "00000000-0000-4000-8000-0000000000d4" as ImportId
      const gone = yield* tab({}, dana)
      yield* settle
      gone.open(id)
      yield* settle
      gone.decide(id, "row-2", out)
      yield* settle
      gone.close()
      const taker = yield* tab({}, dana)
      yield* settle
      taker.open(id)
      yield* settle
      const ofDana = A.filter(R.keys(browser.kept), Str.startsWith(record("")))
      // The newest twenty: the one just left, and the nineteen before it. Nothing of another member's is touched.
      expect([
        A.length(ofDana),
        A.contains(ofDana, record(gone.id)),
        A.contains(ofDana, record("tab-19")),
        A.contains(ofDana, record("tab-20")),
        A.contains(ofDana, record("old")),
        R.has(browser.kept, "progress:v1:org_prairie:mem_marcus:notices%3Atheirs")
      ]).toEqual([20, true, true, false, false, true])
      // Fewer than twenty: one from longer ago than a month still goes when the next is left.
      for (const n of A.range(1, 30)) delete browser.kept[record(`tab-${n}`)]
      browser.kept[record("old")] = left(now - 31 * day)
      taker.decide(id, "row-5", out)
      yield* settle
      taker.close()
      const next = yield* tab({}, dana)
      yield* settle
      next.open(id)
      yield* settle
      const few = A.filter(R.keys(browser.kept), Str.startsWith(record("")))
      expect(A.sort(few, Str.Order)).toEqual(A.sort([record(gone.id), record(taker.id)], Str.Order))
    })
  )
})

describe("a step drawn before this tab's id is its own", () => {
  it.live("reads the rows the tab kept before a reload once its id is, and writes nothing over them before", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000c2" as ImportId
      const before = yield* tab({}, dana)
      yield* settle
      before.open(id)
      yield* settle
      before.decide(id, "row-2", out)
      yield* settle
      before.close()
      // The reload draws the step at once, before the tab's lock has answered.
      const after = yield* tab(before.session, dana)
      after.open(id)
      yield* settle
      // The row kept came back, was checked by an answer of the import, and was sent.
      expect(A.map(after.saves, (save) => R.keys(save.set))).toEqual([["row-2"]])
      const own = A.filter(R.toEntries(entriesOf(id)), ([key]) => Str.endsWith(after.id)(key))
      expect(A.map(own, ([, text]) => Str.includes('"row-2"')(text))).toEqual([true])
    })
  )

  it.live("keeps a row decided meanwhile as soon as its id is", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000c3" as ImportId
      // Another tab is in the middle of taking up what this one kept for some import: its id waits for that.
      const over = Deferred.makeUnsafe<void>()
      void navigator.locks.request("inventory-taking:tab-early", { mode: "shared" }, () => held(over))
      const early = yield* tab({ "inventory:tab": "tab-early" }, dana)
      early.open(id)
      yield* settle
      early.decide(id, "row-2", out)
      yield* settle
      expect([early.id, R.keys(entriesOf(id))]).toEqual(["", []])
      yield* Deferred.succeed(over, undefined)
      yield* settle
      expect(early.id).toBe("tab-early")
      const own = A.filter(R.toEntries(entriesOf(id)), ([key]) => Str.endsWith(early.id)(key))
      expect(A.map(own, ([, text]) => Str.includes('"row-2"')(text))).toEqual([true])
    })
  )
})

describe("an import removed", () => {
  it.live("takes with it the rows a tab that is gone kept for it, and leaves a tab still open its own", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000b1" as ImportId
      const gone = yield* tab({}, dana)
      yield* settle
      gone.open(id)
      yield* settle
      gone.decide(id, "row-2", out)
      yield* settle
      // Another tab has its own row of the import, opened while the first was still open (it took nothing up).
      const open = yield* tab({}, dana)
      yield* settle
      open.open(id)
      yield* settle
      open.decide(id, "row-3", out)
      yield* settle
      const goneId = gone.id
      gone.close()
      // A third tab removes the import before taking anything up.
      const remover = yield* tab({}, dana)
      yield* settle
      remover.remove(id)
      yield* settle
      expect(A.map(R.keys(entriesOf(id)), (key) => [Str.endsWith(goneId)(key), Str.endsWith(open.id)(key)])).toEqual([
        [false, true]
      ])
    })
  )

  it.live("found gone by a tab still open: its rows and those of her closed tabs are named there, and let go", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000b2" as ImportId
      const open = yield* tab({}, dana)
      yield* settle
      open.open(id)
      yield* settle
      open.decide(id, "row-3", out)
      yield* settle
      // Another tab opened meanwhile decides row 12 otherwise than nobody, and row 3 otherwise; then it is closed.
      const closed = yield* tab({}, dana)
      yield* settle
      closed.open(id)
      yield* settle
      closed.decide(id, "row-12", out)
      closed.decide(id, "row-3", kept)
      yield* settle
      closed.close()
      // A colleague removes the import.
      browser.server.current = { ...browser.server.current, removed: true }
      open.readsAgain(id)
      yield* settle
      expect([open.says(), R.keys(entriesOf(id))]).toEqual([
        [
          "Your decisions on it that were not saved went with it. Row 3: you left out; Row 3: you kept over the other row with its SKU, in another tab of yours; Row 12: you left out."
        ],
        []
      ])
    })
  )
})

describe("an import opened by its address and found removed", () => {
  it.live("names what the person's closed tabs kept for it, and lets it go", () =>
    Effect.gen(function* () {
      freshServer()
      const id = "00000000-0000-4000-8000-0000000000b3" as ImportId
      const closed = yield* tab({}, dana)
      yield* settle
      closed.open(id)
      yield* settle
      closed.decide(id, "row-12", out)
      yield* settle
      closed.close()
      browser.server.current = { ...browser.server.current, removed: true }
      const later = yield* tab({}, dana)
      yield* settle
      later.openAddress(id)
      yield* settle
      expect([later.says(), R.keys(entriesOf(id))]).toEqual([
        ["Your decisions on it that were not saved went with it. Row 12: you left out."],
        []
      ])
    })
  )
})

describe("one tab", () => {
  it.live("keeps one id for its life: the leave question drawn afresh asks for no lock again", () =>
    Effect.gen(function* () {
      const one = yield* tab({}, dana)
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
      const before = yield* tab({}, dana)
      yield* settle
      before.open(id)
      yield* settle
      before.decide(id, "row-2", out)
      yield* settle
      // The reload: the same tab (its own storage kept), on another page; its lock was let go with the old page.
      before.close()
      browser.listeners["beforeunload"] = []
      const after = yield* tab(before.session, dana)
      yield* settle
      expect(after.id).toBe(before.id)
      expect(after.asks()).toBe(true)
    })
  )
})
