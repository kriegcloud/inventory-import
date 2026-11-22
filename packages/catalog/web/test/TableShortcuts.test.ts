// The table's two keyboard shortcuts (Ctrl+Shift+F for the filter menu, Ctrl+Shift+S for the sort menu) listen on the
// window only while their menu is on screen: the moment it leaves, the listener is gone, whatever time the app keeps an
// atom nobody reads, so the keys are left alone on the page the person went to.
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { vi } from "vitest"
import { menuShortcut as filterShortcut } from "@inventory/ui/components/data-table/data-table-filter-menu"
import { menuShortcut as sortShortcut } from "@inventory/ui/components/data-table/data-table-sort-menu"

const browser = vi.hoisted(() => {
  const listening: Array<unknown> = []
  Object.assign(globalThis, {
    document: { cookie: "" },
    window: {
      innerWidth: 1440,
      addEventListener: (_type: string, listener: unknown) => {
        listening.push(listener)
      },
      removeEventListener: (_type: string, listener: unknown) => {
        listening.splice(listening.indexOf(listener), 1)
      }
    }
  })
  return { listening }
})

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("a table menu's shortcut", () => {
  for (const [name, shortcut] of [
    ["the filter menu's", filterShortcut],
    ["the sort menu's", sortShortcut]
  ] as const) {
    it(`${name} listener is on the window while the menu is drawn and off it the moment the menu leaves`, () => {
      // As the app's registry is made: an atom nobody reads is kept 400 ms before it is let go.
      const registry = AtomRegistry.make({ defaultIdleTTL: 400 })
      const before = browser.listening.length
      const leave = registry.mount(shortcut("menu"))
      expect(browser.listening.length).toBe(before + 1)
      leave()
      // A hundred milliseconds on: well inside the 400 the registry would have kept it.
      vi.advanceTimersByTime(100)
      expect(browser.listening.length).toBe(before)
    })
  }
})
