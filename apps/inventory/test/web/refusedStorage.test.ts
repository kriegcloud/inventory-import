// A browser that refuses its storage (a private window refuses even to hand it over; blocked site data refuses every
// call) costs the frame only what was to be kept. The rule that would hurt if wrong: a refusal that reached the page as
// a throw would leave the person on a blank page before the session answers, or with no theme at all. What is drawn
// before the answer is the placeholder (nobody signed in here, nobody signed out, no session ended), the theme is
// light, and a theme chosen lasts until the page is loaded again.
import { describe, expect, it } from "@effect/vitest"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { vi } from "vitest"
import { sessionEnded, signedOutHere, wasSignedIn } from "@inventory/access-web/Session"
import { theme } from "@inventory/ui/Theme"

const refused = (): never => {
  throw new DOMException("The operation is insecure.", "SecurityError")
}

const refusing = { getItem: refused, setItem: refused, removeItem: refused, key: refused, clear: refused }

const inWindow = (storage: () => unknown) =>
  vi.stubGlobal("window", {
    get localStorage() {
      return storage()
    },
    get sessionStorage() {
      return storage()
    }
  })

describe.each([
  ["the storage itself is refused", refused],
  ["each call on the storage is refused", () => refusing]
] as const)("when %s", (_, storage) => {
  it("nobody was signed in here, nobody signed out here, and no session ended here", () => {
    inWindow(storage)
    expect([wasSignedIn(), signedOutHere(), sessionEnded()]).toEqual([false, false, false])
    vi.unstubAllGlobals()
  })

  it("the theme is light, and a theme chosen is held for the page", () => {
    inWindow(storage)
    const registry = AtomRegistry.make()
    expect(registry.get(theme)).toBe("light")
    registry.set(theme, "dark")
    expect(registry.get(theme)).toBe("dark")
    registry.dispose()
    vi.unstubAllGlobals()
  })
})
