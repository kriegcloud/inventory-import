import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { assertDefined, assertTrue } from "@effect/vitest/utils"
// The review region with no screen: its atoms in a registry, a table made and drawn as the screen's hook makes and
// draws one, the grid's own virtual list in a frame, and the person's actions called as a button, a key or a toast calls
// them. The rules here are the ones a wrong result breaks without a word: a decision that is not undone or brought
// back, a caller told twice or not at all, a second search that shows the first one's rows, a filled button on a
// heading that is not on screen, and a region that has left the page still writing the decisions of the one that took
// its place.
import { constructTable, functionalUpdate, type SortingState, type Updater } from "@tanstack/react-table"
// The table's own store, driven as the table drives it: a devDependency for this test, refused in src by the atoms lint.
// oxlint-disable-next-line no-restricted-imports
import { batch, createAtom, shallow } from "@tanstack/store"
import { createRenderPhaseSource, renderPhaseReactivity } from "@tanstack/table-core/reactivity"
import { table_publishExternalState, table_setOptions } from "@tanstack/table-core/static-functions"
import * as A from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { describe, expect, it, vi } from "vitest"
import { dataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { choicesOf, proposing, saved, waitingGroups } from "@inventory/review/ReviewDraft"
import { Entry, type ProblemKind, type ReviewRow, type ReviewState, type RowView } from "@inventory/review/ReviewTypes"
import { gridAtom } from "../src/internal/ReviewGrid.tsx"
import { regionAtom, regionTableAtom, Wanted } from "../src/ReviewRegion.atoms.ts"
import { columns, makeRows, problemKinds, recheck } from "./fixtures/fabrication.ts"

/** A key as the page hears it. */
type Key = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  defaultPrevented: boolean
  target: null
  preventDefault: () => void
}

// A desk-wide page with no sidebar cookie (the region asks the page how much room it has when it is first read), the
// page's key listeners and its next frames kept so the test can raise a key and let a frame pass, and the toasts
// kept, so the test can press the Undo a bulk step offers.
const page = vi.hoisted(() => {
  const keys: Array<(event: Key) => void> = []
  const frames: Array<() => void> = []
  Object.assign(globalThis, {
    document: {
      cookie: "",
      activeElement: null,
      addEventListener: (_type: string, heard: (event: Key) => void) => keys.push(heard),
      removeEventListener: (_type: string, heard: (event: Key) => void) => {
        const at = keys.indexOf(heard)
        if (at !== -1) keys.splice(at, 1)
      },
      querySelector: () => null,
      getElementById: () => null,
      // No canvas: a text's width is then its length, which is all a width needs to be here.
      createElement: () => ({ getContext: () => null })
    },
    window: { innerWidth: 1440, addEventListener: () => undefined, removeEventListener: () => undefined },
    HTMLElement: class {},
    requestAnimationFrame: (next: () => void) => frames.push(next)
  })
  return {
    keys,
    frames,
    toasts: [] as Array<{ id: number; label: string; undo: () => void }>,
    dismissed: [] as Array<unknown>
  }
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

/** Lets every frame asked for so far pass, and the ones those ask for. */
const passFrames = () => {
  for (let round = 0; round < 8 && page.frames.length > 0; round += 1) {
    for (const frame of page.frames.splice(0)) frame()
  }
}

/** Raises a key on the page; says whether somebody took it. */
const noModifiers = { ctrl: false, shift: false }
const press = (key: string, held: { ctrl: boolean; shift: boolean }): boolean => {
  const event: Key = {
    key,
    ctrlKey: held.ctrl === true,
    metaKey: false,
    altKey: false,
    shiftKey: held.shift === true,
    defaultPrevented: false,
    target: null,
    preventDefault: () => {
      event.defaultPrevented = true
    }
  }
  for (const heard of [...page.keys]) heard(event)
  return event.defaultPrevented
}

/** A node to hand the region's section callback: the region only asks whether it was given one. */
const node = {} as HTMLElement

/** One region in a registry of its own, with the caller's decisions atom counting every write it is sent. */
const SearchName = S.String.pipe(S.decodeTo(S.String, SchemaTransformation.toLowerCase()))

const startWorld = { kinds: problemKinds, rows: makeRows({ size: 178 }) }
const world = (given: { readonly kinds: ReadonlyArray<ProblemKind>; readonly rows: ReadonlyArray<ReviewRow> }) => {
  // The registry as the app makes it: an atom nobody mounts is kept for its idle time, unless it has none of its own.
  const tasks: Array<() => void> = []
  const registry = AtomRegistry.make({
    defaultIdleTTL: 400,
    scheduleTask: (task) => {
      tasks.push(task)
      return () => {
        const at = tasks.indexOf(task)
        if (at !== -1) tasks.splice(at, 1)
      }
    }
  })
  /** Lets the registry do what it put off to after the change at hand. */
  const settle = () => {
    for (const task of tasks.splice(0)) task()
  }
  const rows = given.rows
  const held = Atom.make<ReviewState>(proposing(rows))
  const told: Array<ReviewState> = []
  const decisions = Atom.writable(
    (get) => get(held),
    (ctx, next: ReviewState) => {
      told.push(next)
      ctx.set(held, next)
    }
  )
  const readOnly = Atom.make(false)
  const region = registry.get(
    regionAtom({
      rows: Atom.make(rows),
      columns: Atom.make(columns),
      recheck: Atom.make(O.some(recheck)),
      decisions,
      problemKinds: Atom.make(given.kinds),
      ruleFixes: Atom.make<"propose" | "apply">("propose"),
      words: Atom.make({}),
      rowAction: Atom.make(O.none()),
      readOnly,
      id: "test"
    })
  )
  // The table as the screen's hook makes it: the reactivity React's adapter uses (options are plain data, staged when
  // the table is drawn; state is published after the draw), and the sort and the search held by the caller, as the
  // data table's hook holds them, and handed back as the table's controlled state.
  const features = {
    coreReactivityFeature: renderPhaseReactivity({ createAtom, batch }),
    ...dataTableFeatures
  } as typeof dataTableFeatures
  const state = { sorting: [] as SortingState, globalFilter: "" }
  const options = () => ({
    features,
    data: registry.get(region.tableData),
    columns: registry.get(region.columnDefs),
    getRowId: (view: RowView) => view.row.id,
    state: { sorting: state.sorting, globalFilter: state.globalFilter },
    // As React state: the handler keeps the new value, and the table hears of it when the screen is next drawn.
    onSortingChange: (updater: Updater<SortingState>) => {
      state.sorting = functionalUpdate(updater, state.sorting)
    },
    onGlobalFilterChange: (updater: Updater<unknown>) => {
      const next: unknown = functionalUpdate(updater, state.globalFilter)
      state.globalFilter = typeof next === "string" ? next : ""
    }
  })
  const core = constructTable<typeof dataTableFeatures, RowView>(options())
  const source = createRenderPhaseSource(core.store, shallow)
  /** One draw of the screen's hook: the options staged, and after it (its layout effect) the state published. */
  const draw = () => {
    table_setOptions(core, (before) => ({ ...before, ...options() }), { syncExternalState: false })
    const controlled = core.options.state
    const snapshot = source.get()
    // What the region's parts read while they are drawn.
    registry.get(regionTable.ordered)
    source.markCommitted(snapshot)
    assertDefined(controlled)
    table_publishExternalState(core, controlled, shallow)
  }
  // The hook hands the screen a copy of the table, made when it is first drawn: the region is given that.
  const table = { ...core, options: options() }
  // The region's table and its grid are atoms the screen keeps mounted while the region is drawn.
  const tableAtom = regionTableAtom({ region, table })
  const keepTable = registry.mount(tableAtom)
  const regionTable = registry.get(tableAtom)
  draw()
  const gridOf = gridAtom({ region, table: regionTable })
  const keepGrid = registry.mount(gridOf)
  const grid = registry.get(gridOf)
  // What the screen keeps mounted while the region is drawn.
  const release = [
    keepTable,
    keepGrid,
    registry.mount(regionTable.moves),
    registry.mount(region.views),
    registry.mount(region.ui),
    registry.subscribe(regionTable.moves, regionTable.settleSoon)
  ]
  const needs = () => registry.get(region.counts).needs
  const ordered = () => A.map(registry.get(regionTable.ordered), (view) => view.row.id)
  /** The person searches or sorts: the table's own setter, then the screen drawn again. */
  const search = (text: string) => {
    table.setGlobalFilter(text)
    draw()
  }
  const sort = (sorting: SortingState) => {
    table.setSorting(sorting)
    draw()
  }
  return {
    registry,
    region,
    regionTable,
    grid,
    table,
    core,
    told,
    needs,
    ordered,
    release,
    readOnly,
    rows,
    settle,
    search,
    sort
  }
}

/** A world whose region's section is on the page, as it is once the region is drawn. */
const onPage = (given: Parameters<typeof world>[0]) => {
  const at = world(given)
  const leave = at.region.attach(node)
  return { ...at, leave }
}

/** The first group of identical fixes waiting under "Needs you". */
const firstGroup = (at: ReturnType<typeof world>) => {
  const group = waitingGroups({ views: at.registry.get(at.region.views), kind: O.none() })[0]
  assertDefined(group)
  return group
}

describe("the review region's atoms", () => {
  it("undoes and brings back a decision on the caller's atom, telling the caller once per change", () => {
    const at = onPage(startWorld)
    const before = at.needs()
    const group = firstGroup(at)
    const start = saved(at.registry.get(at.region.input.decisions))

    at.regionTable.run({ type: "acceptGroup" as const, groupId: group.id, except: [] }, O.none())
    expect(at.needs()).toBe(before - group.rowIds.length)
    expect(at.told).toHaveLength(1)
    expect(at.registry.get(at.region.input.decisions)).toBe(at.told[0])

    at.regionTable.run({ type: "undo" as const }, O.none())
    expect(at.needs()).toBe(before)
    expect(at.told).toHaveLength(2)
    expect(saved(at.told[1] as ReviewState)).toEqual(start)

    at.regionTable.run({ type: "redo" as const }, O.none())
    expect(at.needs()).toBe(before - group.rowIds.length)
    expect(at.told).toHaveLength(3)

    // With nothing to bring back, the caller is told nothing.
    at.regionTable.run({ type: "redo" as const }, O.none())
    expect(at.told).toHaveLength(3)
  })

  it("hears the undo key while it is on the page, and nothing once its section has left", () => {
    const at = onPage(startWorld)
    const group = firstGroup(at)
    const heard = page.keys.length
    const stopKeys = at.registry.mount(at.regionTable.keys)
    expect(page.keys).toHaveLength(heard + 1)

    at.regionTable.run({ type: "acceptGroup" as const, groupId: group.id, except: [] }, O.none())
    expect(at.told).toHaveLength(1)
    // On the page, Ctrl+Z is the region's: it takes the key and undoes the step.
    expect(press("z", { ...noModifiers, ctrl: true })).toBe(true)
    expect(at.told).toHaveLength(2)
    expect(press("z", { ctrl: true, shift: true })).toBe(true)
    expect(at.told).toHaveLength(3)

    const ui = at.registry.get(at.region.ui)
    const nav = at.registry.get(at.region.nav)
    // The bulk step's toast is still up when the region goes (the import was confirmed, or the region was drawn
    // again from a newer draft): the region takes it down, and its Undo, pressed all the same, reaches nobody.
    const offered = page.toasts[page.toasts.length - 1]
    assertDefined(at.leave)
    at.leave()
    assertDefined(offered)
    expect(page.dismissed).toContain(offered.id)
    offered.undo()
    // A key raised while the listener is still there reaches nobody either, and is left for whoever is on the page:
    // the region does not take it.
    expect(press("z", { ...noModifiers, ctrl: true })).toBe(false)
    expect(press("y", { ...noModifiers, ctrl: true })).toBe(false)
    expect(press("j", noModifiers)).toBe(false)
    at.regionTable.run({ type: "undo" as const }, O.none())
    const rowId = group.rowIds[0]
    assertDefined(rowId)
    at.regionTable.actions.leaveOut(rowId)
    at.regionTable.groupActions.toggle(rowId)
    at.regionTable.step(false)

    expect(at.told).toHaveLength(3)
    expect(at.registry.get(at.region.ui)).toBe(ui)
    expect(at.registry.get(at.region.nav)).toBe(nav)

    // And the listener goes as soon as nothing mounts the keys: with the change at hand, not after the registry's
    // idle time, in which a key would still reach a region that has gone.
    stopKeys()
    at.settle()
    expect(page.keys).toHaveLength(heard)
  })

  it("does nothing before its section is on the page either", () => {
    const at = world(startWorld)
    at.regionTable.run({ type: "acceptGroup" as const, groupId: firstGroup(at).id, except: [] }, O.none())
    const rowId = firstGroup(at).rowIds[0]
    assertDefined(rowId)
    at.regionTable.groupActions.toggle(rowId)
    expect(at.told).toHaveLength(0)
    expect(at.registry.get(at.region.ui).excluded.pipe((set) => [...set])).toEqual([])
  })

  it("works the rows out once per change of the decisions, and not for a change that is not theirs", () => {
    const at = onPage(startWorld)
    let worked = 0
    at.release.push(at.registry.subscribe(at.region.views, () => (worked += 1)))
    const first = at.registry.get(at.region.views)

    // Reading again, a tab, a search and a change that changes nothing work nothing out.
    at.region.change(() => ({ search: "bolt" }))
    at.region.change(() => ({ picked: O.some("all") }))
    at.region.change(() => ({ picked: O.some("all") }))
    expect(at.registry.get(at.region.views)).toBe(first)
    expect(worked).toBe(0)

    at.regionTable.run({ type: "acceptGroup" as const, groupId: firstGroup(at).id, except: [] }, O.none())
    expect(worked).toBe(1)
  })

  it("keeps the view of every row a decision did not touch, where a kind cannot be settled here", () => {
    // One kind nothing on this screen can settle: the test of that is made once for the region and its table. Made
    // twice, each decision built every undecided row again and handed every row a new view.
    const kinds = A.map(problemKinds, (kind) => (kind.id === "below" ? { ...kind, fixable: false } : kind))
    const at = onPage({ ...startWorld, kinds })
    const group = firstGroup(at)
    const before = at.registry.get(at.region.views)
    const decided = at.registry.get(at.region.input.decisions).decisions
    at.regionTable.run({ type: "acceptGroup" as const, groupId: group.id, except: [] }, O.none())
    const after = at.registry.get(at.region.views)
    // The rows nobody has decided anything on, not even to hold a rule's fix back as a proposal; a row that shares
    // its SKU with another is read again with every decision, since the other's may settle it.
    const untouched = A.filter(
      before,
      (view) =>
        !group.rowIds.includes(view.row.id) &&
        !HashMap.has(decided, view.row.id) &&
        !O.exists(view.row.problem, (problem) => O.isSome(problem.rivals))
    )
    expect(untouched.length).toBeGreaterThan(100)
    const kept = A.filter(untouched, (view) => after.includes(view))
    expect(kept).toHaveLength(untouched.length)
  })

  it("draws nothing for a change that changes nothing", () => {
    const at = onPage(startWorld)
    let drawn = 0
    at.release.push(at.registry.subscribe(at.region.ui, () => (drawn += 1)))
    at.region.change(() => ({}))
    at.region.change((before) => ({ search: before.search, folded: before.folded }))
    expect(drawn).toBe(0)
    at.region.change(() => ({ search: "nut" }))
    expect(drawn).toBe(1)
  })

  it("filters the rows by the facets the person ticked before the table has them, and counts each choice", () => {
    const at = onPage(startWorld)
    at.region.change(() => ({ picked: O.some("all") }))
    const all = at.registry.get(at.regionTable.ordered).length
    const facet = at.registry.get(at.region.facets)[0]
    assertDefined(facet)
    const option = facet.options[0]
    assertDefined(option)

    at.region.change(() => ({ facetPicked: { [facet.column.id]: [option.key] } }))
    const shown = at.registry.get(at.regionTable.ordered)
    expect(shown.length).toBe(option.n)
    expect(shown.length).toBeLessThan(all)
    // The table is given the filtered rows; it holds no filter of its own.
    expect(at.registry.get(at.region.tableData)).toHaveLength(option.n)
    expect(at.table.atoms.columnFilters.get()).toEqual([])
    for (const view of shown) {
      const value: string | undefined = view.cells[facet.column.id]
      assertDefined(value)
      expect(A.contains(option.values, value)).toBe(true)
    }
    // The choices and their counts are of the view showing, not of what is ticked: every choice is still offered.
    const currentFacet = at.registry.get(at.region.facets)[0]
    assertDefined(currentFacet)
    expect(currentFacet.options).toEqual(facet.options)
    // A search narrows what the facet left, and the tab's own list is untouched.
    expect(at.registry.get(at.region.list)).toHaveLength(all)

    at.region.change(() => ({ facetPicked: {} }))
    expect(at.registry.get(at.regionTable.ordered).length).toBe(all)
    // Nothing ticked: the table holds the very rows of the list.
    expect(at.registry.get(at.region.shown)).toBe(at.registry.get(at.region.list))
  })

  it("gives the table the rows in the change that works them out, so no read of the order writes its options", () => {
    const at = onPage(startWorld)
    // Only the region's table stays: nothing reads the order until the reads below, the first since the change.
    for (const stop of at.release.splice(1)) stop()
    at.region.change(() => ({ picked: O.some("all") }))
    const options = at.core.options
    expect(options.data).toBe(at.registry.get(at.region.tableData))

    const ordered = at.registry.get(at.regionTable.ordered)
    at.registry.get(at.regionTable.lines)
    at.registry.get(at.regionTable.flagged)
    expect(at.core.options).toBe(options)
    // And the order read is of these rows, not of the ones the table held before.
    expect(ordered).toHaveLength(at.registry.get(at.region.tableData).length)
    expect(A.map(ordered, (view) => view.row.id)).toEqual(
      A.map(at.registry.get(at.region.tableData), (view) => view.row.id)
    )
  })

  it("shows the rows of each search and sort in turn: the second search is not the first one's rows", () => {
    const at = onPage(startWorld)
    at.region.change(() => ({ picked: O.some("all") }))
    const all = at.ordered()
    const nameOf = (id: string) => {
      const row = A.findFirst(at.rows, (row) => row.id === id)
      assertTrue(O.isSome(row), "expected a present test value")
      const name = row.value.cells.name
      assertDefined(name)
      const read = O.getSuccess(S.decodeResult(SearchName)(name))
      assertTrue(O.isSome(read), "a fixture name is search text")
      return read.value
    }
    // Two words from the file's own names that find different rows.
    const words = A.dedupe(A.flatMap(all, (id) => Str.split(nameOf(id), " ")))
    const found = (word: string) =>
      A.join(
        A.filter(all, (id) => Str.includes(word)(nameOf(id))),
        ","
      )
    const narrows = (word: string) => word.length > 3 && found(word) !== "" && found(word) !== A.join(all, ",")
    const firstWord = A.findFirst(words, narrows)
    assertTrue(O.isSome(firstWord), "expected a present test value")
    const first = firstWord.value
    const secondWord = A.findFirst(words, (word) => narrows(word) && found(word) !== found(first))
    assertTrue(O.isSome(secondWord), "expected a present test value")
    const second = secondWord.value

    at.search(first)
    const afterFirst = at.ordered()
    expect(afterFirst.length).toBeGreaterThan(0)
    expect(afterFirst.length).toBeLessThan(all.length)
    expect(A.join(afterFirst, ",")).toBe(found(first))

    at.search(second)
    const afterSecond = at.ordered()
    expect(afterSecond).not.toEqual(afterFirst)
    expect(afterSecond.length).toBeGreaterThan(0)
    expect(A.join(afterSecond, ",")).toBe(found(second))

    at.search("")
    expect(at.ordered()).toEqual(all)

    at.sort([{ id: "name", desc: false }])
    const sorted = at.ordered()
    expect(sorted).not.toEqual(all)
    expect([...sorted].sort()).toEqual([...all].sort())
    at.sort([{ id: "name", desc: true }])
    const backwards = at.ordered()
    expect(backwards).not.toEqual(sorted)
    const firstBackwards = backwards[0]
    const lastSorted = sorted[sorted.length - 1]
    assertDefined(firstBackwards)
    assertDefined(lastSorted)
    expect(nameOf(firstBackwards)).toBe(nameOf(lastSorted))
    at.sort([])
    expect(at.ordered()).toEqual(all)
  })

  it("goes to the next kind on the work list when the kind the table chose by itself is finished", () => {
    const at = onPage(startWorld)
    // Nothing is picked on the work list: the table shows the first kind with rows left.
    const work = at.registry.get(at.region.work)
    const onScreen = at.registry.get(at.region.activeKind)
    expect(onScreen).toEqual(O.map(A.head(work), (item) => item.kind.id))
    expect(at.registry.get(at.region.ui).kind).toEqual(O.none())
    const waiting = A.filter(work, (item) => item.left > 0)
    const next = waiting[1]
    const after = waiting[2]
    assertDefined(next)
    assertDefined(after)

    // Every row of the kind on screen is settled in one step.
    const mine = A.filter(at.registry.get(at.region.list), (view) => view.status === "needs")
    at.regionTable.groupActions.leaveOut(A.map(mine, (view) => view.row.id))
    // The move carries the kind the person was on, not the one the table has moved on to by itself.
    expect(at.registry.get(at.region.nav).wanted).toEqual(O.some(Wanted.Advance({ from: onScreen })))
    passFrames()
    expect(at.registry.get(at.region.ui).kind).toEqual(O.some(next.kind.id))
    expect(at.registry.get(at.region.activeKind)).toEqual(O.some(next.kind.id))
    expect(at.registry.get(at.region.activeKind)).not.toEqual(O.some(after.kind.id))
  })
})

describe("the review grid's atoms", () => {
  /** A frame 400 px tall, scrolled where the test says, that tells the list when it is scrolled. */
  const framed = () => {
    const heard: Array<() => void> = []
    const frame = {
      offsetWidth: 1000,
      offsetHeight: 400,
      scrollTop: 0,
      scrollLeft: 0,
      scrollHeight: 100000,
      clientHeight: 400,
      ownerDocument: { defaultView: { setTimeout: () => 0, clearTimeout: () => undefined } },
      addEventListener: (type: string, listener: () => void) => {
        if (type === "scroll") heard.push(listener)
      },
      removeEventListener: () => undefined,
      scrollTo: () => undefined
    }
    return {
      frame,
      scrollTo: (top: number) => {
        frame.scrollTop = top
        for (const listener of heard) listener()
      }
    }
  }

  /** The grid's own virtual list, given its frame as the grid's draw gives it one, and never drawn again. */
  const listed = (at: ReturnType<typeof world>) => {
    const { frame, scrollTo } = framed()
    at.grid.frame(frame as unknown as HTMLDivElement)
    return { virtual: at.grid.list, scrollTo }
  }

  const leadable = (line: Entry) => Entry.guards.group(line) && !line.applied && O.isNone(choicesOf(line.group))

  it("keeps the columns' parts while a decision changes no width, so the rows drawn are not drawn again", () => {
    const at = onPage(startWorld)
    at.release.push(at.registry.mount(at.grid.parts), at.registry.mount(at.grid.plan))
    const parts = at.registry.get(at.grid.parts)
    const plan = at.registry.get(at.grid.plan)
    const row = A.findFirst(at.registry.get(at.region.list), (view) => view.status === "needs")
    assertTrue(O.isSome(row), "expected a present test value")
    at.regionTable.actions.leaveOut(row.value.row.id)
    expect(at.told).toHaveLength(1)
    expect(at.registry.get(at.grid.parts)).toBe(parts)
    expect(at.registry.get(at.grid.plan)).toBe(plan)
    at.regionTable.run({ type: "undo" as const }, O.none())
    expect(at.registry.get(at.grid.parts)).toBe(parts)
    // A new width is a new plan: the table's room changed.
    at.region.change(() => ({ picked: O.some("all") }))
    expect(at.registry.get(at.grid.parts)).not.toBe(parts)
  })

  it("names the lead from the lines in view, and follows the list, the lines and what the person may do", () => {
    const at = onPage(startWorld)
    at.release.push(at.registry.mount(at.grid.lead), at.registry.mount(at.grid.leadInView))
    // Before the list has a frame nothing is in view, and nothing leads.
    expect(at.registry.get(at.grid.lead)).toEqual(O.none())

    const { scrollTo, virtual } = listed(at)
    const lines = () => at.registry.get(at.grid.entries) as ReadonlyArray<Entry>
    const groupsAt = () => A.filter(lines(), leadable)
    const first = groupsAt()[0]
    assertDefined(first)
    assertTrue(Entry.guards.group(first), "the fixture has a rule group waiting")
    // The first rule group waiting is in view: its accept is the screen's filled button, and Import waits.
    expect(at.registry.get(at.grid.lead)).toEqual(O.some(first.group.id))
    expect(at.registry.get(at.grid.leadInView)).toBe(true)

    // Scrolled far past every heading, nothing in view can lead: the role goes back to Import.
    scrollTo(60000)
    expect(O.map(at.registry.get(at.grid.seen), (seen) => seen.startIndex > 20)).toEqual(O.some(true))
    const far = at.registry.get(at.grid.seen)
    const inView = O.match(far, {
      onNone: A.empty,
      onSome: (seen) => lines().slice(seen.startIndex, seen.endIndex + 1)
    })
    expect(at.registry.get(at.grid.lead)).toEqual(
      O.map(O.filter(A.findFirst(inView, leadable), Entry.guards.group), (line) => line.group.id)
    )
    scrollTo(0)
    expect(at.registry.get(at.grid.lead)).toEqual(O.some(first.group.id))

    // The group is accepted: the lines are fewer, and the list is not drawn again (it says nothing of a range that
    // changes because the number of lines did). The lead is the next group in view all the same.
    const before = lines().length
    at.regionTable.groupActions.accept(first.group.id)
    expect(lines().length).toBeLessThan(before)
    const next = A.head(groupsAt())
    assertTrue(O.isSome(next), "expected a present test value")
    expect(at.registry.get(at.grid.lead)).toEqual(O.map(O.filter(next, Entry.guards.group), (line) => line.group.id))
    expect(virtual.options.count).toBe(lines().length)

    // While the confirm step is open its own button is the filled one; someone only looking is offered none.
    at.region.change(() => ({ confirmOpen: true }))
    expect(at.registry.get(at.grid.leadInView)).toBe(false)
    at.region.change(() => ({ confirmOpen: false }))
    expect(at.registry.get(at.grid.leadInView)).toBe(true)
    at.registry.set(at.readOnly, true)
    expect(at.registry.get(at.grid.leadInView)).toBe(false)
    at.registry.set(at.readOnly, false)
    // On another tab no heading leads.
    at.region.change(() => ({ picked: O.some("all") }))
    expect(at.registry.get(at.grid.lead)).toEqual(O.none())
  })

  it("gives the virtual list its lines' number in the decision that changes them, so no read of the view writes it", () => {
    const at = onPage(startWorld)
    const { virtual } = listed(at)
    // Nothing mounts the lead or the lines drawn: the reads below are the first to ask since the decision.
    const lines = () => at.registry.get(at.grid.entries) as ReadonlyArray<Entry>
    const found = A.findFirst(lines(), leadable)
    assertTrue(O.isSome(found), "expected a present test value")
    const first = found.value
    assertDefined(first)
    assertTrue(Entry.guards.group(first), "the fixture has a rule group waiting")
    const setOptions = vi.spyOn(virtual, "setOptions")
    const before = lines().length

    at.regionTable.groupActions.accept(first.group.id)
    // Given the new number in the decision itself, before anything read what is in view.
    expect(setOptions).toHaveBeenCalled()
    expect(lines().length).toBeLessThan(before)
    expect(virtual.options.count).toBe(lines().length)

    setOptions.mockClear()
    const options = virtual.options
    at.registry.get(at.grid.leadInView)
    at.registry.get(at.grid.seen)
    const drawn = at.registry.get(at.grid.drawn)
    expect(setOptions).not.toHaveBeenCalled()
    expect(virtual.options).toBe(options)
    // What is read is of these lines: the lead is the first rule group in view among them, and every line drawn is one.
    const next = A.findFirst(lines(), leadable)
    expect(at.registry.get(at.grid.lead)).toEqual(O.map(O.filter(next, Entry.guards.group), (line) => line.group.id))
    expect(drawn.items.length).toBeGreaterThan(0)
    expect(A.every(drawn.items, (item) => item.index < lines().length)).toBe(true)
    setOptions.mockRestore()
  })

  it("scrolls the list to the row the region asks to see, with one function for the grid's life", () => {
    const at = onPage(startWorld)
    const { virtual } = listed(at)
    const asked: Array<number> = []
    virtual.scrollToIndex = (index) => {
      asked.push(index)
    }
    at.release.push(at.registry.subscribe(at.region.reveal, at.grid.bring))
    const row = A.findLast(at.registry.get(at.region.list), (view) => view.status === "needs")
    assertTrue(O.isSome(row), "expected a present test value")
    const rowId = row.value.row.id
    at.registry.set(at.region.reveal, O.some({ rowId, n: 1 }))
    expect(asked).toEqual(O.toArray(at.grid.indexOf(rowId)))
    // The same row asked for again is a new ask.
    at.registry.set(at.region.reveal, O.some({ rowId, n: 2 }))
    expect(asked).toHaveLength(2)
    // A row that is not among the lines is not scrolled to.
    at.registry.set(at.region.reveal, O.some({ rowId: "no-such-row", n: 3 }))
    expect(asked).toHaveLength(2)
  })
})
