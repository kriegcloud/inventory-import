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
import { decisionFromFlags, type SaveRequest } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"

// The browser: storage every tab shares, the storage of the tab being loaded, the locks, and the leave question.
const browser = vi.hoisted(() => {
  const kept: Record<string, string> = {}
  const session: { now: Record<string, string> } = { now: {} }
  const held: Array<string> = []
  const listeners: Record<string, Array<(event: unknown) => void>> = {}
  const storage = (of: () => Record<string, string>) => ({
    getItem: (key: string) => of()[key] ?? null,
    setItem: (key: string, value: string) => {
      of()[key] = value
    },
    removeItem: (key: string) => {
      delete of()[key]
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
        request: (name: string, _options: unknown, callback: (lock: unknown) => Promise<unknown>) => {
          if (held.includes(name)) return callback(null)
          held.push(name)
          return callback({ name })
        },
        query: () => {
          const locks: Array<{ readonly name: string }> = []
          for (const name of held) locks.push({ name })
          return Promise.resolve({ held: locks })
        }
      }
    }
  })
  return { kept, session, held, listeners }
})

const settle = Effect.sleep("20 millis")
const out = decisionFromFlags({ out: true })
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

/** A tab: the app's modules loaded afresh, with this tab's own storage (empty for a new tab, kept for a reload). */
const tab = (own: Record<string, string> = {}) =>
  Effect.promise(() => {
    vi.resetModules()
    browser.session.now = own
    return Promise.all([
      import("../src/Draft.atoms.ts"),
      import("../src/ReviewDraft.atoms.ts"),
      import("../src/Imports.atoms.ts"),
      import("../src/Draft.machine.ts"),
      import("./support/catalog.ts")
    ])
  }).pipe(
    Effect.map(([drafts, review, imports, machine, support]) => {
      const saves: Array<SaveRequest> = []
      const registry = support.registryFor({
        endpoints: {
          imports: {
            get: () => Deferred.await(Deferred.makeUnsafe<ImportView>()),
            // The server never answers: every row this tab sends stays waiting, kept.
            decide: (request: { readonly payload: SaveRequest }) =>
              Effect.suspend(() => {
                saves.push(request.payload)
                return Deferred.await(Deferred.makeUnsafe<unknown>())
              })
          }
        },
        signedIn: Atom.make(dana)
      })
      drafts.holdThisTab()
      return {
        /** This tab's id as it is now: a copy of an open tab changes it once its lock is found held. */
        get id() {
          return drafts.tabId()
        },
        session: browser.session.now,
        saves,
        registry,
        open: (id: ImportId) => {
          registry.set(imports.importView(id), support.viewAt({ id, revision: 4 }))
          registry.mount(imports.importViewShown(id))
          registry.mount(review.reviewLocal(id))
          return registry.mount(review.followDraft(id))
        },
        decide: (id: ImportId, rowId: string) =>
          registry.set(review.draftEvents(id), machine.DraftEvent.Decided({ changes: { [rowId]: O.some(out) } })),
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
        /** The tab is closed: its lock goes with it. */
        close: () => {
          const index = browser.held.indexOf(`inventory-tab:${drafts.tabId()}`)
          if (index >= 0) browser.held.splice(index, 1)
        }
      }
    })
  )

describe("two tabs of one person", () => {
  it.live("each keeps its own entry: a decision in one never writes over or erases the other's", () =>
    Effect.gen(function* () {
      const id = "00000000-0000-4000-8000-0000000000a1" as ImportId
      const first = yield* tab()
      first.open(id)
      yield* settle
      first.decide(id, "row-2")
      yield* settle
      const second = yield* tab()
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
      const id = "00000000-0000-4000-8000-0000000000a2" as ImportId
      const first = yield* tab()
      first.open(id)
      yield* settle
      first.decide(id, "row-2")
      yield* settle
      // The first tab is still open: a new tab sends nothing of its rows, and leaves its entry.
      const second = yield* tab()
      second.open(id)
      yield* settle
      expect([second.saves, A.length(R.keys(entriesOf(id)))]).toEqual([[], 1])
      // The first tab is closed. The next tab that opens the import takes its row up, sends it, and its entry goes.
      first.close()
      const third = yield* tab()
      third.open(id)
      yield* settle
      expect(A.map(third.saves, (save) => R.keys(save.set))).toEqual([["row-2"]])
      expect(A.filter(R.keys(entriesOf(id)), (key) => Str.endsWith(first.id)(key))).toEqual([])
    })
  )

  it.live("a copy of an open tab (its storage copied, the id with it) takes an id of its own", () =>
    Effect.gen(function* () {
      const first = yield* tab()
      const copy = yield* tab({ ...first.session })
      yield* settle
      expect(copy.id).not.toBe(first.id)
    })
  )
})

describe("after a reload", () => {
  it.live("the question before leaving is asked while this tab's rows wait, before their import is opened again", () =>
    Effect.gen(function* () {
      const id = "00000000-0000-4000-8000-0000000000a3" as ImportId
      const before = yield* tab()
      before.open(id)
      yield* settle
      before.decide(id, "row-2")
      yield* settle
      // The reload: the same tab (its own storage kept), on another page; its lock was let go with the old page.
      before.close()
      browser.listeners["beforeunload"] = []
      const after = yield* tab(before.session)
      expect(after.id).toBe(before.id)
      expect(after.asks()).toBe(true)
    })
  )
})
