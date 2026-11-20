// The review region with no screen: its atoms in a registry, a table made as the screen makes one, and the person's
// actions called as a button, a key or a toast calls them. The rules here are the ones a wrong result breaks without a
// word: a decision that is not undone or brought back, a caller told twice or not at all, and a region that has left
// the page still writing the decisions of the one that took its place.
import { constructTable } from "@tanstack/react-table"
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { describe, expect, it, vi } from "vitest"
import { dataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { Action, proposing, saved, waitingGroups } from "@inventory/review/ReviewDraft"
import type { ReviewState, RowView } from "@inventory/review/ReviewTypes"
import { regionAtom, regionTableAtom } from "../src/ReviewRegion.atoms.ts"
import { columns, makeRows, problemKinds, recheck } from "./fixtures/fabrication.ts"

// A desk-wide page with no sidebar cookie (the region asks the page how much room it has when it is first read), and
// the toasts kept, so the test can press the Undo a bulk step offers.
const page = vi.hoisted(() => {
  Object.assign(globalThis, {
    document: { cookie: "", activeElement: null },
    window: { innerWidth: 1440, addEventListener: () => undefined, removeEventListener: () => undefined }
  })
  return { toasts: [] as Array<{ id: number; label: string; undo: () => void }>, dismissed: [] as Array<unknown> }
})
vi.mock("sonner", () => ({
  toast: Object.assign(
    (label: string, options?: { action?: { onClick: () => void } }) => {
      const id = page.toasts.length + 1
      page.toasts.push({ id, label, undo: () => options?.action?.onClick() })
      return id
    },
    { dismiss: (id: unknown) => page.dismissed.push(id) }
  )
}))

/** A node to hand the region's section callback: the region only asks whether it was given one. */
const node = {} as HTMLElement

/** One region in a registry of its own, with the caller's decisions atom counting every write it is sent. */
const world = () => {
  const registry = AtomRegistry.make()
  const rows = makeRows({ size: 178 })
  const held = Atom.make<ReviewState>(proposing(rows))
  const told: Array<ReviewState> = []
  const decisions = Atom.writable(
    (get) => get(held),
    (ctx, next: ReviewState) => {
      told.push(next)
      ctx.set(held, next)
    }
  )
  const region = registry.get(
    regionAtom({
      rows: Atom.make(rows),
      columns: Atom.make(columns),
      recheck: Atom.make(O.some(recheck)),
      decisions,
      problemKinds,
      rejects: false,
      words: undefined,
      id: "test"
    })
  )
  // The table the screen's hook makes, with the store's own reactivity in place of React's.
  // One more feature than the screen's table names in its type: the reactivity React's hook adds for itself.
  const features = {
    ...dataTableFeatures,
    coreReactivityFeature: storeReactivityBindings()
  } as typeof dataTableFeatures
  const table = constructTable<typeof dataTableFeatures, RowView>({
    features,
    data: registry.get(region.tableData),
    columns: registry.get(region.columnDefs),
    getRowId: (view) => view.row.id,
    atoms: { columnFilters: region.tableFilters }
  })
  const regionTable = registry.get(regionTableAtom({ region, table }))
  // What the screen keeps mounted while the region is drawn.
  const release = [
    registry.mount(regionTable.moves),
    registry.mount(region.followFacets),
    registry.mount(region.views),
    registry.mount(region.ui)
  ]
  const leave = region.attach(node)
  const needs = () => registry.get(region.counts).needs
  return { registry, region, regionTable, told, needs, leave, release }
}

/** The first group of identical fixes waiting under "Needs you". */
const firstGroup = (at: ReturnType<typeof world>) => {
  const group = waitingGroups({ views: at.registry.get(at.region.views), kind: undefined })[0]
  if (group === undefined) throw new Error("the fixture has no group of fixes waiting")
  return group
}

describe("the review region's atoms", () => {
  it("undoes and brings back a decision on the caller's atom, telling the caller once per change", () => {
    const at = world()
    const before = at.needs()
    const group = firstGroup(at)
    const start = saved(at.registry.get(at.region.input.decisions))

    at.regionTable.run(Action.AcceptGroup({ groupId: group.id, except: [] }))
    expect(at.needs()).toBe(before - group.rowIds.length)
    expect(at.told).toHaveLength(1)
    expect(at.registry.get(at.region.input.decisions)).toBe(at.told[0])

    at.regionTable.run(Action.Undo())
    expect(at.needs()).toBe(before)
    expect(at.told).toHaveLength(2)
    expect(saved(at.told[1] as ReviewState)).toEqual(start)

    at.regionTable.run(Action.Redo())
    expect(at.needs()).toBe(before - group.rowIds.length)
    expect(at.told).toHaveLength(3)

    // With nothing to bring back, the caller is told nothing.
    at.regionTable.run(Action.Redo())
    expect(at.told).toHaveLength(3)
  })

  it("does nothing once its section has left the page: a toast's Undo or a key reaches nobody", () => {
    const at = world()
    const group = firstGroup(at)
    at.regionTable.run(Action.AcceptGroup({ groupId: group.id, except: [] }))
    expect(at.told).toHaveLength(1)
    const ui = at.registry.get(at.region.ui)
    const nav = at.registry.get(at.region.nav)

    // The bulk step's toast is still up when the region goes (the import was confirmed, or the region was drawn
    // again from a newer draft): the region takes it down, and its Undo, pressed all the same, reaches nobody.
    const offered = page.toasts[page.toasts.length - 1]
    at.leave?.()
    expect(page.dismissed).toContain(offered?.id)
    offered?.undo()
    expect(offered?.label).toBe(at.registry.get(at.region.ui).said)
    at.regionTable.run(Action.Undo())
    at.regionTable.actions.leaveOut(group.rowIds[0] ?? "")
    at.regionTable.groupActions.toggle(group.rowIds[0] ?? "")
    at.regionTable.step(false)

    expect(at.told).toHaveLength(1)
    expect(at.registry.get(at.region.ui)).toBe(ui)
    expect(at.registry.get(at.region.nav)).toBe(nav)
  })

  it("does nothing before its section is on the page either", () => {
    const at = world()
    at.leave?.()
    at.regionTable.run(Action.AcceptGroup({ groupId: firstGroup(at).id, except: [] }))
    expect(at.told).toHaveLength(0)
  })

  it("works the rows out once per change of the decisions, and not for a change that is not theirs", () => {
    const at = world()
    let worked = 0
    at.release.push(at.registry.subscribe(at.region.views, () => (worked += 1)))
    const first = at.registry.get(at.region.views)

    // Reading again, a tab, a search and a change that changes nothing work nothing out.
    at.region.change(() => ({ search: "bolt" }))
    at.region.change(() => ({ picked: "all" }))
    at.region.change(() => ({ picked: "all" }))
    expect(at.registry.get(at.region.views)).toBe(first)
    expect(worked).toBe(0)

    at.regionTable.run(Action.AcceptGroup({ groupId: firstGroup(at).id, except: [] }))
    expect(worked).toBe(1)
  })

  it("draws nothing for a change that changes nothing", () => {
    const at = world()
    let drawn = 0
    at.release.push(at.registry.subscribe(at.region.ui, () => (drawn += 1)))
    at.region.change(() => ({}))
    at.region.change((before) => ({ search: before.search, folded: before.folded }))
    expect(drawn).toBe(0)
    at.region.change(() => ({ search: "nut" }))
    expect(drawn).toBe(1)
  })

  it("filters the table by the facets the person ticked, as the table's own column filters", () => {
    const at = world()
    at.region.change(() => ({ picked: "all" }))
    const all = at.registry.get(at.regionTable.ordered).length
    const facet = at.registry.get(at.region.facets)[0]
    const option = facet?.options[0]
    if (facet === undefined || option === undefined) throw new Error("the fixture has no facet")

    at.region.change(() => ({ facetPicked: { [facet.column.id]: [option.key] } }))
    const shown = at.registry.get(at.regionTable.ordered)
    expect(shown.length).toBe(option.n)
    expect(shown.length).toBeLessThan(all)
    expect(at.region.tableFilters.get()).toHaveLength(1)

    at.region.change(() => ({ facetPicked: {} }))
    expect(at.registry.get(at.regionTable.ordered).length).toBe(all)
    expect(at.region.tableFilters.get()).toEqual([])
  })
})
