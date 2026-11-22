// A tab whose storage the browser refuses (a private window refuses even to hand it over; blocked site data refuses
// every call) still has an id of its own: only a reload of it counts as another tab. The rule that would hurt if
// wrong: without an id, nothing the tab keeps or sends is told apart from another tab's.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { vi } from "vitest"
import { thisTab } from "../src/Tab.atoms.ts"

const refused = (): never => {
  throw new DOMException("The operation is insecure.", "SecurityError")
}

const refusing = { getItem: refused, setItem: refused, removeItem: refused, key: refused, clear: refused }

describe.each([
  ["the storage itself is refused", refused],
  ["each call on the storage is refused", () => refusing]
] as const)("when %s", (_, storage) => {
  it("the tab has an id of its own", () => {
    vi.stubGlobal("window", {
      get sessionStorage() {
        return storage()
      }
    })
    // No locks: the id is the tab's own at once.
    vi.stubGlobal("navigator", {})
    const registry = AtomRegistry.make()
    expect(O.isSome(registry.get(thisTab))).toBe(true)
    registry.dispose()
    vi.unstubAllGlobals()
  })
})
