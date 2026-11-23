// The data grid's own atoms (goals/atoms, "The kit on atoms", batch 2), where a hook kept the same promises before.
// Four rules that would hurt if wrong, and that the browser step `grid:keys` cannot see: a typed long text and the
// grid's search wait for a pause and then run what the latest draw asked for, with one function from draw to draw while
// the pause is the same (the grid's callers list it among what their work depends on); a cell's value is followed only
// while the cell is on screen; what the virtualizer is given stays the same object while what it was made from does,
// so 50,000 rows are not worked out again on every draw; and with two grids on a page, Ctrl+F puts the cursor in the
// search box of the grid it was pressed in. The registry is made as the app's is (`rootRegistry`: an atom nobody reads
// is dropped 400 ms later), since a plain registry drops it at once and hides a timer left running.
import { RegistryContext } from "@effect/atom-react"
import { afterEach, assert, beforeEach, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { createElement, type RefCallback } from "react"
import { prerender } from "react-dom/static"
import { vi } from "vitest"
import { cellChanges } from "@inventory/ui/components/data-grid/data-grid-cell"
import { searchInputRef } from "@inventory/ui/components/data-grid/data-grid-search"
import {
  claimSearchFocus,
  emptyKept,
  kept,
  searchFocusClaim,
  type SearchFocusClaim
} from "@inventory/ui/components/data-grid/use-data-grid"
// The test drives the kit's own debounce, its atoms as the grid does and the hook as a component draws it.
// oxlint-disable-next-line no-restricted-imports
import { debouncedFor, latestCallback, useDebouncedCallback } from "@inventory/ui/hooks/use-debounced-callback"

/**
 * A debounced function as a caller that types text holds it. The kit types its arguments `never[]`, since each caller
 * has its own; a method's parameters are compared both ways, so the function is taken here as one that takes text.
 */
type TextTaker = { send(text: string): void }

/** What `cellChanges` reads of the grid's table: its listeners of one cell. */
const isGridTable = (table: object): table is Parameters<typeof cellChanges>[0] =>
  "subscribeCell" in table && typeof table.subscribeCell === "function"

/**
 * The search box's ref as the test hands it a box: the ref reads only `focus`, and a method's parameters are compared
 * both ways, so a box with `focus` alone is taken where React would hand the input.
 */
type SearchBoxRef = { open(input: { focus(): void } | null): ReturnType<RefCallback<HTMLInputElement>> }

/** A registry as the app makes one (`rootRegistry` in src/web/lib/root.ts). */
const appRegistry = () => AtomRegistry.make({ defaultIdleTTL: 400 })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("a pause runs the callback of the latest draw, through one function while the delay is the same", () => {
  const registry = appRegistry()
  const unmount = registry.mount(debouncedFor("typed"))
  const calls: Array<string> = []
  // The first draw.
  registry.set(latestCallback("typed"), { run: (text: string) => calls.push(`first ${text}`) })
  const first = registry.get(debouncedFor("typed"))(300)
  const typingFirst: TextTaker = { send: first }
  typingFirst.send("a")
  // A second draw before the pause ends hands over its own callback.
  registry.set(latestCallback("typed"), { run: (text: string) => calls.push(`second ${text}`) })
  const second = registry.get(debouncedFor("typed"))(300)
  expect(second).toBe(first)
  const typingSecond: TextTaker = { send: second }
  typingSecond.send("ab")
  vi.advanceTimersByTime(299)
  expect(calls).toEqual([])
  vi.advanceTimersByTime(1)
  expect(calls).toEqual(["second ab"])
  // Another delay is another function.
  expect(registry.get(debouncedFor("typed"))(150)).not.toBe(first)
  unmount()
})

it("a pause still waiting when the component leaves never runs", () => {
  const registry = appRegistry()
  const unmount = registry.mount(debouncedFor("leaving"))
  const calls: Array<string> = []
  registry.set(latestCallback("leaving"), { run: () => calls.push("ran") })
  registry.get(debouncedFor("leaving"))(300)()
  unmount()
  // The callback is still in the registry for 400 ms after the component left, so only the cleared timer keeps it from
  // running at 300 ms.
  vi.advanceTimersByTime(1000)
  expect(calls).toEqual([])
})

it.effect("the hook, drawn again, hands the pause the callback of its latest draw", () => {
  // The two draws are a server's (no effect runs), on one registry, so the component keeps its `useId`.
  vi.useRealTimers()
  const registry = appRegistry()
  const handed: Array<(text: string) => void> = []
  const calls: Array<string> = []
  function Typing({ label }: { readonly label: string }) {
    const debounced = useDebouncedCallback((text: string) => {
      calls.push(`${label} ${text}`)
    }, 300)
    handed.push(debounced)
    return null
  }
  const draw = (label: string) =>
    Effect.promise(() =>
      prerender(createElement(RegistryContext, { value: registry }, createElement(Typing, { label })))
    )
  return Effect.gen(function* () {
    yield* draw("first")
    yield* draw("second")
    vi.useFakeTimers()
    expect(handed.length).toBe(2)
    handed[1]?.("ab")
    vi.advanceTimersByTime(299)
    expect(calls).toEqual([])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual(["second ab"])
  })
})

it("a cell's value is followed while the cell is read, and let go when it is not", () => {
  const listeners: Array<{ readonly cell: string; readonly listener: () => void }> = []
  const table = {
    subscribeCell: (rowId: string, columnId: string, listener: () => void) => {
      const entry = { cell: `${rowId}/${columnId}`, listener }
      listeners.push(entry)
      return () => {
        listeners.splice(listeners.indexOf(entry), 1)
      }
    }
  }
  assert(isGridTable(table))
  const registry = AtomRegistry.make()
  const changes = cellChanges(table, "r1", "text")
  const seen: Array<number> = []
  const stop = registry.subscribe(changes, (count) => seen.push(count), { immediate: true })
  expect(A.map(listeners, (entry) => entry.cell)).toEqual(["r1/text"])
  // The table says the cell changed, twice: each one is a new number, so the cell is drawn again.
  for (const entry of [...listeners]) entry.listener()
  for (const entry of [...listeners]) entry.listener()
  expect(seen).toEqual([0, 1, 2])
  // Another cell of the same table is its own atom; the same cell is the same one.
  expect(cellChanges(table, "r2", "text")).not.toBe(changes)
  expect(cellChanges(table, "r1", "text")).toBe(changes)
  stop()
  // Let go once nobody reads it: the table's listener is taken off.
  vi.runAllTimers()
  expect(listeners).toEqual([])
})

it("what the virtualizer is given stays the same object while what it was made from is the same", () => {
  const slot = emptyKept<(index: number) => string>()
  const made: Array<number> = []
  const rowKey = (rowSize: number) =>
    kept(slot, [rowSize], () => {
      made.push(rowSize)
      return (index: number) => `${index}:${rowSize}`
    })
  const first = rowKey(36)
  expect(rowKey(36)).toBe(first)
  const taller = rowKey(72)
  expect(taller).not.toBe(first)
  expect(taller(3)).toBe("3:72")
  expect(made).toEqual([36, 72])
})

it("with two grids on the page, the search box of the grid Ctrl+F was pressed in takes the focus", () => {
  const frames: Array<(() => void) | null> = []
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => frames.push(run))
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => {
    frames[frame - 1] = null
  })
  vi.stubGlobal("document", { addEventListener: () => undefined, removeEventListener: () => undefined })
  const grids = ["first", "second"]
  const focusAfter = (pressedIn: string | null, drawn: ReadonlyArray<string>) => {
    const registry = appRegistry()
    frames.length = 0
    const focused: Array<string> = []
    // Each grid's Ctrl+F listener sees the press, in the order the grids were put on the page.
    const press = {}
    for (const grid of grids) {
      const claim: O.Option<SearchFocusClaim> = registry.get(searchFocusClaim)
      registry.set(searchFocusClaim, claimSearchFocus(claim, press, grid, grid === pressedIn))
    }
    // Every grid's box opens, in the order given; StrictMode calls each ref twice, with its cleanup between.
    const unmounts = A.map(drawn, (grid) => {
      const unmount = registry.mount(searchInputRef(grid))
      const ref: SearchBoxRef = { open: registry.get(searchInputRef(grid)) }
      const input = { focus: () => focused.push(grid) }
      const cleanup = ref.open(input)
      if (typeof cleanup === "function") cleanup()
      ref.open(input)
      return unmount
    })
    for (const run of [...frames]) run?.()
    for (const unmount of unmounts) unmount()
    return focused
  }
  // The last box drawn would win without the claim.
  expect(focusAfter("first", ["first", "second"])).toEqual(["first"])
  expect(focusAfter("first", ["second", "first"])).toEqual(["first"])
  expect(focusAfter("second", ["first", "second"])).toEqual(["second"])
  expect(focusAfter("second", ["second", "first"])).toEqual(["second"])
  // Pressed outside every grid: the first grid's box, as upstream had it.
  expect(focusAfter(null, ["second", "first"])).toEqual(["first"])
})
