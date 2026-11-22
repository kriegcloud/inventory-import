// What the Items table writes into the address when the person sorts, filters or changes page: the same text as when
// the table's state was React state (goals/atoms, "The kit on atoms"). A sort, a search or a filter goes back to page
// one; a typed filter waits for a pause of 300 ms before it is written, and a change of page writes a waiting filter
// first. The table here is the kit's own store, driven as the table drives it, on the Items page's config.
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { vi } from "vitest"
import type { ColumnFilterItem } from "@inventory/ui/components/data-table/data-table-types"
import { dataTableAtoms, dataTableStore } from "@inventory/ui/hooks/use-data-table"
import { location } from "@inventory/ui/Route"
import { itemsTableConfig, searchedItemsTableConfig } from "../src/ItemsPage.screen.tsx"

// The browser's address and history, as the app's navigation uses them.
const browser = vi.hoisted(() => {
  const at = { pathname: "/items", search: "" }
  const go = (_state: unknown, _title: string, to: string) => {
    const url = new URL(to, "http://localhost")
    at.pathname = url.pathname
    at.search = url.search
  }
  Object.assign(globalThis, {
    // The page's module asks for the sidebar's cookie and the window's width when it is first read.
    document: { cookie: "" },
    window: {
      innerWidth: 1440,
      location: at,
      history: { pushState: go, replaceState: go },
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }
  })
  return { at, go }
})

vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { dismiss: () => undefined, error: () => 0 }) }))

// The Items page's own two configs: a change to the page's columns, page size or address keys is a change here.
const itemsTable = itemsTableConfig

const here = () => `${browser.at.pathname}${decodeURIComponent(browser.at.search)}`

/** One Items table on screen, mounted as `useDataTable` mounts it. */
const table = (urlState: boolean, config: typeof itemsTableConfig = itemsTable) => {
  // As the app's registry is made: an atom nobody reads is kept 400 ms before it is let go.
  const registry = AtomRegistry.make({ defaultIdleTTL: 400 })
  const atoms = dataTableAtoms("items-table")
  const unmount = [
    registry.mount(location),
    registry.mount(atoms.query),
    registry.mount(atoms.filters),
    registry.mount(atoms.draft),
    registry.mount(atoms.pause)
  ]
  const store = dataTableStore({ registry, instance: "items-table", config, urlState })
  return { store, leave: () => A.forEach(unmount, (off) => off()) }
}

const typed = (value: string): ColumnFilterItem => ({
  id: "name",
  value,
  variant: "text",
  operator: "iLike",
  filterId: "name-0"
})

beforeEach(() => {
  vi.useFakeTimers()
  browser.go(null, "", "/items?page=3")
})

afterEach(() => {
  vi.useRealTimers()
})

describe("the Items table's address", () => {
  it("a sort writes the order and goes back to page one", () => {
    const { store, leave } = table(true)
    store.onSortingChange([{ id: "unitCost", desc: true }])
    expect(here()).toBe("/items?sort=unitCost.desc")
    expect(store.now().sorting).toEqual([{ id: "unitCost", desc: true }])
    expect(store.now().pagination.pageIndex).toBe(0)
    leave()
  })

  it("the same order again writes nothing", () => {
    const { store, leave } = table(true)
    store.onSortingChange([{ id: "sku", desc: false }])
    expect(here()).toBe("/items?page=3")
    leave()
  })

  it("while a search is on, the SKU order is one she chose and is written", () => {
    const { store, leave } = table(true, searchedItemsTableConfig)
    store.onSortingChange([{ id: "sku", desc: false }])
    expect(here()).toBe("/items?sort=sku.asc")
    leave()
  })

  it("a change of page and of page size each land in the address", () => {
    const { store, leave } = table(true)
    store.onPaginationChange((page) => ({ ...page, pageIndex: page.pageIndex + 1 }))
    expect(here()).toBe("/items?page=4")
    store.onPaginationChange({ pageIndex: 3, pageSize: 50 })
    expect(here()).toBe("/items?page=4&perPage=50")
    leave()
  })

  it("a search goes back to page one at once", () => {
    const { store, leave } = table(true)
    store.onGlobalFilterChange("washer")
    expect(here()).toBe("/items?search=washer")
    leave()
  })

  it("a filter chosen from a list is written at once and goes back to page one", () => {
    const { store, leave } = table(true)
    store.onColumnFiltersChange([
      { id: "category", value: ["components"], variant: "select", operator: "inArray", filterId: "category-0" }
    ])
    expect(here()).toBe("/items?category=components")
    leave()
  })

  it("a typed filter waits for a pause of 300 ms, showing what was typed meanwhile", () => {
    const { store, leave } = table(true)
    store.onColumnFiltersChange([typed("was")])
    store.onColumnFiltersChange([typed("wash")])
    expect(here()).toBe("/items?page=3")
    expect(store.now().columnFilters).toEqual([typed("wash")])
    vi.advanceTimersByTime(299)
    expect(here()).toBe("/items?page=3")
    vi.advanceTimersByTime(1)
    expect(here()).toBe("/items?name=wash")
    expect(store.now().columnFilters).toEqual([typed("wash")])
    leave()
  })

  it("a change of page writes a waiting filter first, then the page", () => {
    const { store, leave } = table(true)
    store.onColumnFiltersChange([typed("wash")])
    store.onPaginationChange({ pageIndex: 1, pageSize: 20 })
    expect(here()).toBe("/items?name=wash&page=2")
    vi.advanceTimersByTime(1000)
    expect(here()).toBe("/items?name=wash&page=2")
    leave()
  })

  it("a filter waiting when the table leaves the screen is never written", () => {
    const { store, leave } = table(true)
    store.onColumnFiltersChange([typed("wash")])
    leave()
    vi.advanceTimersByTime(1000)
    expect(here()).toBe("/items?page=3")
  })

  it("kept in the table's own atoms, the store's changes each start from the one before and the address is left alone", () => {
    const { store, leave } = table(false)
    store.onPaginationChange({ pageIndex: 2, pageSize: 20 })
    store.onSortingChange([{ id: "name", desc: false }])
    store.onGlobalFilterChange("brass")
    expect(store.now().sorting).toEqual([{ id: "name", desc: false }])
    expect(store.now().search).toBe("brass")
    expect(store.now().pagination.pageIndex).toBe(0)
    expect(here()).toBe("/items?page=3")
    leave()
  })
})
