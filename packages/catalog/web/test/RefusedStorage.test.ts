import { assertTrue } from "@effect/vitest/utils"
// A browser that refuses its storage (a private window refuses even to hand it over; a full disk or blocked site data
// refuses every call) costs the catalog's screens only what was to be kept, never the page. The rule that would hurt
// if wrong: a refusal that reached the screen as a throw would break the import's review and the table assistant for
// that person. Each reader answers as it does with nothing kept, and each writer keeps nothing, without a word.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { vi } from "vitest"
import { askBeforeLeaving, takeUpGoneTabs } from "../src/Draft.atoms.ts"
import { emptyConversation, readConversation, writeConversation } from "../src/Conversation.machine.ts"
import { leaveTakenUp, notices } from "../src/Notices.atoms.ts"
import { importId, registryFor, registryStart } from "./support/catalog.ts"
import { memberStart, memberOf } from "./support/session.ts"

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

const dana = memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" })

describe.each(windows)("when %s", (_, { storage }) => {
  it("the table assistant's conversation starts empty, and a write is dropped", () => {
    inWindow(storage)
    expect(readConversation("assistant")).toEqual(emptyConversation)
    expect(() => writeConversation("assistant", emptyConversation)).not.toThrow()
    vi.unstubAllGlobals()
  })

  it("no gone tab's rows are taken up, and the question before leaving counts none", () => {
    inWindow(storage)
    const registry = registryFor({
      ...registryStart,
      endpoints: {},
      signedIn: dana.pipe((who) => Atom.make(who), O.some)
    })
    const taken: Array<unknown> = []
    takeUpGoneTabs({ registry, id: importId, take: (kept) => taken.push(kept) })
    expect(taken).toEqual([])
    expect(() => registry.get(askBeforeLeaving)).not.toThrow()
    registry.dispose()
    vi.unstubAllGlobals()
  })

  it("a notice for another tab is not kept, and this tab's notices are none", () => {
    inWindow(storage)
    const registry = registryFor({
      ...registryStart,
      endpoints: {},
      signedIn: dana.pipe((who) => Atom.make(who), O.some)
    })
    const expectedSome1 = dana
    assertTrue(O.isSome(expectedSome1), "expected dana")
    const of = expectedSome1.value
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
