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
import * as Atom from "effect/reactivity/Atom"
import { vi } from "vitest"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"
import { progressKey } from "@inventory/review/SavedProgress"
import { leavingApp } from "@inventory/ui/Route"
import { decisionFromFlags, type SaveRequest } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { DraftEvent } from "../src/Draft.machine.ts"
import { tabId } from "../src/Draft.atoms.ts"
import { askBeforeLeaving, importView, importViewShown, removeImport } from "../src/Imports.atoms.ts"
import { draftEvents, followDraft, namingLeftOver, reviewLocal, rowsLeftOver } from "../src/ReviewDraft.atoms.ts"
import { importNo, registryFor, viewAt } from "./support/catalog.ts"

// The browser: its storage, which outlives a page, and the listeners a page adds to its window.
const browser = vi.hoisted(() => {
  const kept: Record<string, string> = {}
  const listeners: Record<string, Array<(event: unknown) => void>> = {}
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
  return { kept, listeners }
})

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

/** Where one member's waiting rows of one import are kept, by this tab. */
const keyOf = (id: ImportId, memberId: string, organizationId = "org_prairie") =>
  progressKey({ organizationId, memberId, screen: `import:${id}:waiting:${tabId()}` })

/** One page of the app, on the shared storage: the server answers each save only when the test says. */
const page = (id: ImportId, signedIn = dana) => {
  const saves: Array<{ readonly payload: SaveRequest; readonly answer: Deferred.Deferred<unknown> }> = []
  const who = Atom.make(signedIn)
  const registry = registryFor({
    endpoints: {
      imports: {
        get: () => Deferred.await(Deferred.makeUnsafe<ImportView>()),
        decide: (request: { readonly payload: SaveRequest }) =>
          Effect.suspend(() => {
            const answer = Deferred.makeUnsafe<unknown>()
            saves.push({ payload: request.payload, answer })
            return Deferred.await(answer)
          }),
        open: () => Effect.succeed({ views: [], older: 0 }),
        remove: () => Effect.void
      }
    },
    signedIn: who
  })
  return {
    registry,
    saves,
    who,
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
})
