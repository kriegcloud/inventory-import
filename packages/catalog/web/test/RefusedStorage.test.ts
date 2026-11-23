// A browser that refuses its storage (a private window refuses even to hand it over; a full disk or blocked site data
// refuses every call) costs the catalog's screens only what was to be kept, never the page. The rule that would hurt
// if wrong: a refusal that reached the screen as a throw would break the import's review and the table assistant for
// that person. Each reader answers as it does with nothing kept, and each writer keeps nothing; the person's waiting
// decisions are then said to be held by the page only, never to be kept in this browser.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { vi } from "vitest"
import {
  askBeforeLeaving,
  claimDraft,
  keepWaiting,
  keptWaiting,
  takeUpGoneTabs,
  waitingNotKept
} from "../src/Draft.atoms.ts"
import type { Waiting } from "../src/Draft.machine.ts"
import { notImportedToast, notSavedLine, notSavedToast, signedOutToast } from "../src/internal/keptWords.ts"
import { emptyConversation, readConversation, writeConversation } from "../src/Conversation.machine.ts"
import { leaveTakenUp, notices } from "../src/Notices.atoms.ts"
import { importId, registryFor } from "./support/catalog.ts"
import { memberOf } from "./support/session.ts"

const refused = (): never => {
  throw new DOMException("The operation is insecure.", "SecurityError")
}

/** A storage the browser hands over, every call of which it refuses. */
const refusing = {
  getItem: refused,
  setItem: refused,
  removeItem: refused,
  key: refused,
  clear: refused,
  get length(): number {
    return refused()
  }
}

/** The two refusals: the storage itself (a private window), and each call on it (a full disk, blocked site data). */
const windows = [
  ["the storage itself is refused", { storage: refused }],
  ["each call on the storage is refused", { storage: () => refusing }]
] as const

const inWindow = (storage: () => unknown) => {
  vi.stubGlobal("window", {
    get localStorage() {
      return storage()
    },
    get sessionStorage() {
      return storage()
    },
    location: { pathname: "/", search: "" },
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  })
  // The conversation reads the global `localStorage`, the same storage under its other name.
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: storage })
  // No locks: the tab's id is its own at once, so what reads the storage under it runs.
  vi.stubGlobal("navigator", {})
}

const dana = memberOf({ id: "mem_dana" })

/** A decision of the person's that waits to be sent: what is kept is the entry, whatever it holds. */
const decided: Waiting = { rows: {}, lines: {}, confirms: O.some(1), leftOver: O.none() }

type Registry = ReturnType<typeof registryFor>

/** Every sentence the screen says of waiting decisions, as it says them for one import in one registry now. */
const saidOf = (registry: Registry): ReadonlyArray<string> => {
  const kept = !registry.get(waitingNotKept(importId))
  return [
    notSavedLine({ one: true, kept }),
    notSavedLine({ one: false, kept }),
    notSavedToast(kept),
    signedOutToast({ another: false, kept }),
    signedOutToast({ another: true, kept }),
    notImportedToast(kept)
  ]
}

/** Dana's decision on the import, kept as the review keeps it after each event. */
const keepDecision = (registry: Registry): void => {
  claimDraft({ registry, id: importId })
  keptWaiting({ registry, id: importId })
  keepWaiting({ registry, id: importId, waits: O.some(decided), fileName: O.none() })
}

/** A storage that keeps what it is given. */
const keeping = () => {
  const held: Record<string, string> = {}
  return {
    getItem: (key: string) => held[key] ?? null,
    setItem: (key: string, value: string) => {
      held[key] = value
    },
    removeItem: (key: string) => {
      delete held[key]
    },
    key: () => null,
    clear: () => undefined,
    length: 0
  }
}

describe("a browser that keeps what it is given", () => {
  it("says the waiting decisions are kept in this browser", () => {
    const storage = keeping()
    inWindow(() => storage)
    const registry = registryFor({ endpoints: {}, signedIn: Atom.make(dana) })
    keepDecision(registry)
    expect(registry.get(waitingNotKept(importId))).toBe(false)
    for (const said of saidOf(registry)) {
      expect(said).toMatch(/kept in this browser/)
      expect(said).not.toMatch(/could not be kept/)
    }
    registry.dispose()
    vi.unstubAllGlobals()
  })
})

describe.each(windows)("when %s", (_, { storage }) => {
  it("the waiting decisions are said not to be kept, and lost if the page goes before they are sent", () => {
    inWindow(storage)
    const registry = registryFor({ endpoints: {}, signedIn: Atom.make(dana) })
    keepDecision(registry)
    expect(registry.get(waitingNotKept(importId))).toBe(true)
    for (const said of saidOf(registry)) {
      expect(said).toMatch(/could not be kept on this browser/)
      expect(said).toMatch(/lost if this page is closed or loaded again before (it is|they are) sent/)
      expect(said).not.toMatch(/kept in this browser/)
    }
    registry.dispose()
    vi.unstubAllGlobals()
  })

  it("the table assistant's conversation starts empty, and a write is dropped", () => {
    inWindow(storage)
    expect(readConversation("assistant")).toEqual(emptyConversation)
    expect(() => writeConversation("assistant", emptyConversation)).not.toThrow()
    vi.unstubAllGlobals()
  })

  it("no gone tab's rows are taken up, and the question before leaving counts none", () => {
    inWindow(storage)
    const registry = registryFor({ endpoints: {}, signedIn: Atom.make(dana) })
    const taken: Array<unknown> = []
    takeUpGoneTabs({ registry, id: importId, take: (kept) => taken.push(kept) })
    expect(taken).toEqual([])
    expect(() => registry.get(askBeforeLeaving)).not.toThrow()
    registry.dispose()
    vi.unstubAllGlobals()
  })

  it("a notice for another tab is not kept, and this tab's notices are none", () => {
    inWindow(storage)
    const registry = registryFor({ endpoints: {}, signedIn: Atom.make(dana) })
    const of = O.getOrThrow(dana)
    leaveTakenUp({
      registry,
      of,
      tab: "other-tab",
      from: { id: importId, fileName: O.none() },
      rows: ["r1"],
      named: false
    })
    expect(registry.get(notices)).toEqual([])
    registry.dispose()
    vi.unstubAllGlobals()
  })
})
