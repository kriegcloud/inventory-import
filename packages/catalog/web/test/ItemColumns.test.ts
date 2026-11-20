// The Items table's columns against the filters' answer: the columns are made once, and what a filter offers is read
// from the answer when it is asked for. A save that changes a category, a unit or a count changes the answer; if the
// columns were made from it, every cell would be made anew and an open row editor would close under the person.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { vi } from "vitest"
import { itemColumns, itemFacets } from "../src/ItemsPage.screen.tsx"
import { registryWith } from "./support/catalog.ts"

// The page's module asks how wide the window is when it is first read, and its toasts want a document: a desk-wide
// page with no sidebar cookie, and toasts that say nothing.
vi.hoisted(() => {
  Object.assign(globalThis, {
    document: { cookie: "" },
    window: { innerWidth: 1440, addEventListener: () => undefined, removeEventListener: () => undefined }
  })
})
vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { dismiss: () => undefined, error: () => 0 }) }))

const listed = (values: ReadonlyArray<readonly [string, number]>) =>
  A.map(values, ([value, count]) => ({ value, count }))
const nothing = { min: O.none<number>(), max: O.none<number>() }

/** A filters' answer with these categories; the rest is what an empty organization has. */
const facets = (categories: ReadonlyArray<readonly [string, number]>, cost: readonly [number, number]) => ({
  category: listed(categories),
  uom: listed([["EA", 3]]),
  isActive: listed([["true", 3]]),
  lotTracked: listed([]),
  unitCost: { min: O.some(cost[0]), max: O.some(cost[1]) },
  quantityOnHand: nothing
})

describe("the Items table's columns", () => {
  it.live("stay the same objects when the filters' answer differs, and the filters offer the new values", () =>
    Effect.gen(function* () {
      let answer = facets([["components", 2]], [1.2, 9.6])
      const registry = registryWith({ items: { facets: () => Effect.sync(() => answer) } })
      registry.mount(itemFacets)
      registry.mount(itemColumns(true))
      yield* Effect.sleep("20 millis")
      const before = registry.get(itemColumns(true))
      const column = (id: string) => (columns: typeof before) =>
        O.getOrThrow(A.findFirst(columns, (candidate) => candidate.id === id))
      const category = column("category")(before)
      const cost = column("unitCost")(before)
      expect(category.meta).toMatchObject({ options: [{ label: "components", value: "components", count: 2 }] })
      expect(cost.meta).toMatchObject({ min: 1, max: 10 })

      // A save moved an item to a new category and raised the highest cost: the filters are asked again.
      answer = facets(
        [
          ["components", 1],
          ["packaging", 1]
        ],
        [1.2, 41.5]
      )
      registry.refresh(itemFacets)
      yield* Effect.sleep("20 millis")
      const after = registry.get(itemColumns(true))
      expect(after).toBe(before)
      expect(column("edit")(after)).toBe(column("edit")(before))
      expect(category.meta).toMatchObject({
        options: [
          { label: "components", value: "components", count: 1 },
          { label: "packaging", value: "packaging", count: 1 }
        ]
      })
      expect(cost.meta).toMatchObject({ min: 1, max: 42 })
    })
  )

  it.live("a viewer's have no pencil", () =>
    Effect.gen(function* () {
      const registry = registryWith({ items: { facets: () => Effect.succeed(facets([], [0, 0])) } })
      registry.mount(itemFacets)
      registry.mount(itemColumns(false))
      yield* Effect.sleep("20 millis")
      expect(A.some(registry.get(itemColumns(false)), (column) => column.id === "edit")).toBe(false)
    })
  )
})
