// Removing an import while the address names it (its own Upload step, or its review in another tab of the same page):
// the page leaves that address first, or it would go on asking the server for an import that is gone. An address that
// names another import, or none, is left as it is.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { vi } from "vitest"
import { openImports, removeImport } from "../src/Imports.atoms.ts"
import { importAddress } from "../src/internal/route.ts"
import { importNo, registryWith, viewAt } from "./support/catalog.ts"

// The browser's address and history, as the app's navigation uses them.
const browser = vi.hoisted(() => {
  const at = { pathname: "/", search: "" }
  const go = (_state: unknown, _title: string, to: string) => {
    const url = new URL(to, "http://localhost")
    at.pathname = url.pathname
    at.search = url.search
  }
  Object.assign(globalThis, {
    window: {
      location: at,
      history: { pushState: go, replaceState: go },
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }
  })
  return { at, go }
})
vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { dismiss: () => undefined, error: () => 0 }) }))

const settle = Effect.sleep("40 millis")
const here = () => `${browser.at.pathname}${browser.at.search}`

const world = () => {
  const first = viewAt({ id: importNo(31), revision: 1, fileName: "a.csv" })
  const second = viewAt({ id: importNo(32), revision: 1, fileName: "b.csv" })
  const registry = registryWith({
    imports: { open: () => Effect.succeed({ views: [first, second], older: 0 }), remove: () => Effect.void }
  })
  registry.mount(openImports)
  const press = (view: typeof first) => {
    registry.mount(removeImport(view.id))
    registry.set(removeImport(view.id), view)
    return Effect.promise(() => Effect.runPromiseExit(AtomRegistry.getResult(registry, removeImport(view.id))))
  }
  return { registry, first, second, press }
}

describe("removing an import the address names", () => {
  it.live("leaves that address for the first screen", () =>
    Effect.gen(function* () {
      const t = world()
      browser.go(null, "", importAddress(t.first.id, "upload"))
      yield* settle
      yield* t.press(t.first)
      expect(here()).toBe("/")
    })
  )

  it.live("stays on an address that names another import", () =>
    Effect.gen(function* () {
      const t = world()
      const other = importAddress(t.second.id, "review")
      browser.go(null, "", other)
      yield* settle
      yield* t.press(t.first)
      expect(here()).toBe(other)
    })
  )
})
