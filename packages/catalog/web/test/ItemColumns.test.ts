// The Items table's columns against the filters' answer. A save that changes a category, a unit or a count changes
// the answer, and the filters must offer the new values; but every cell, heading and pencil must stay the very same
// component, or React would draw each anew and an open row editor would close under the person. The columns are read
// as the table reads them: through `applyColumnConfig` with the page's own config, which is what the Filter menu's
// controls are given; the two toolbar filters read `quickFilterOptions`.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { vi } from "vitest"
import { applyColumnConfig } from "@inventory/ui/components/data-table/data-table-config"
import type { UseDataTableProps } from "@inventory/ui/hooks/use-data-table"
import type { StoredItem } from "@inventory/catalog-contract/Item"
import { itemColumns, itemFacets, itemsTableConfig, quickFilterOptions } from "../src/ItemsPage.screen.tsx"
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
  it.live("keep every cell and heading when the filters' answer differs, and the filters offer the new values", () =>
    Effect.gen(function* () {
      let answer = facets([["components", 2]], [1.2, 9.6])
      const registry = registryWith({ items: { facets: () => Effect.sync(() => answer) } })
      registry.mount(itemFacets)
      registry.mount(itemColumns(true))
      registry.mount(quickFilterOptions)
      yield* Effect.sleep("20 millis")
      // What the table holds: the page's columns as `useDataTable` takes them.
      const taken = () => {
        const columns: UseDataTableProps<StoredItem>["columns"] = registry.get(itemColumns(true))
        return A.map(columns, (column) => applyColumnConfig(column, itemsTableConfig.columns))
      }
      const before = taken()
      const column = (id: string) => (columns: typeof before) =>
        O.getOrThrow(A.findFirst(columns, (candidate) => candidate.id === id))
      expect(registry.get(quickFilterOptions)).toEqual({
        category: [{ label: "components", value: "components", count: 2 }],
        uom: [{ label: "EA", value: "EA", count: 3 }]
      })
      expect([column("category")(before).enableColumnFilter, column("category")(before).meta?.variant]).toEqual([
        true,
        "select"
      ])
      expect(column("category")(before).meta).toMatchObject({
        options: [{ label: "components", value: "components", count: 2 }]
      })
      expect(column("unitCost")(before).meta).toMatchObject({ min: 1, max: 10 })

      // Asked again with the same answer: the very same columns.
      const held = registry.get(itemColumns(true))
      registry.refresh(itemFacets)
      yield* Effect.sleep("20 millis")
      expect(registry.get(itemColumns(true))).toBe(held)

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
      const after = taken()
      expect(registry.get(quickFilterOptions).category).toEqual([
        { label: "components", value: "components", count: 1 },
        { label: "packaging", value: "packaging", count: 1 }
      ])
      expect(column("category")(after).meta).toMatchObject({
        options: [
          { label: "components", value: "components", count: 1 },
          { label: "packaging", value: "packaging", count: 1 }
        ]
      })
      expect(column("unitCost")(after).meta).toMatchObject({ min: 1, max: 42 })
      // What a cell is drawn with is the same component in every column, the pencil's too.
      expect(A.map(after, (now) => now.cell)).toEqual(A.map(before, (was) => was.cell))
      expect(A.map(after, (now) => now.header)).toEqual(A.map(before, (was) => was.header))
      expect(column("edit")(after).cell).toBe(column("edit")(before).cell)
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
