// The pure part of applying an assistant's answer: a request's changes land in the table's own state, removing one
// change takes back only that change, and undoing the request puts the view back as it was before it.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import type { CatalogColumn, ColumnCatalog, ViewChange } from "@inventory/catalog-contract/TableView"
import {
  applyAll,
  describe as say,
  overtaken,
  revert,
  revertAll,
  takeBack,
  type ViewState
} from "@inventory/catalog-web/TableViewState"

const column = (input: Partial<CatalogColumn> & Pick<CatalogColumn, "id" | "label" | "type">): CatalogColumn => ({
  sortable: true,
  hideable: true,
  operators: [],
  values: [],
  ...input
})

/** The Records table's columns, as the page hands them over. */
const records: ColumnCatalog = [
  column({ id: "name", label: "Name", type: "text", hideable: false, operators: ["iLike", "notILike"] }),
  column({ id: "code", label: "Code", type: "text", operators: ["iLike"] }),
  column({ id: "unit", label: "Unit", type: "select", operators: ["inArray", "notInArray"], values: ["Each", "Box"] }),
  column({ id: "price", label: "Price", type: "number", operators: ["lt", "gt", "isEmpty"] }),
  column({ id: "note", label: "Note", type: "text", sortable: false, operators: ["iLike"] })
]

const opened: ViewState = { sorting: [], filters: [], visibility: { note: false }, search: "" }
const before: ViewState = {
  sorting: [{ id: "code", desc: false }],
  filters: [{ id: "code", value: "BRK-", variant: "text", operator: "iLike", filterId: "code-0" }],
  visibility: { note: false },
  search: ""
}
const changes: ReadonlyArray<ViewChange> = [
  { kind: "sort", column: "name", direction: "desc" },
  { kind: "filter", column: "unit", operator: "inArray", values: ["Box"] },
  { kind: "show", column: "note" }
]

describe("applying an answer to a table's view", () => {
  it("sets the sort, the filter and the column in the table's own shapes", () => {
    const after = applyAll({ state: before, changes, columns: records, opened })
    expect(after.state).toEqual({
      sorting: [{ id: "name", desc: true }],
      filters: [
        { id: "code", value: "BRK-", variant: "text", operator: "iLike", filterId: "code-0" },
        { id: "unit", value: ["Box"], variant: "select", operator: "inArray", filterId: "unit-0" }
      ],
      visibility: { note: true },
      search: ""
    })
    expect(A.map(changes, (change) => say(records, change))).toEqual([
      "Sorted by Name, Z to A",
      "Filtered: Unit is Box",
      "Showed Note"
    ])
  })

  it("removing one change takes back only that one; undoing the request ends where it started", () => {
    const after = applyAll({ state: before, changes, columns: records, opened })
    const withoutFilter = revert(after.state, after.patches[1] ?? {})
    expect(withoutFilter.filters).toEqual(before.filters)
    expect(withoutFilter.sorting).toEqual([{ id: "name", desc: true }])
    expect(withoutFilter.visibility).toEqual({ note: true })
    expect(revertAll(after.state, after.patches)).toEqual(before)
  })

  it("clear returns to the view the table opens with, and its undo brings back what was cleared", () => {
    const after = applyAll({
      state: before,
      changes: [{ kind: "clear", what: "everything" }],
      columns: records,
      opened
    })
    expect(after.state).toEqual(opened)
    expect(revertAll(after.state, after.patches)).toEqual(before)
  })
})

describe("a search the assistant puts in the box", () => {
  it("is listed, and removing it gives the box back what it held before", () => {
    const searching: ViewState = { ...before, search: "bracket" }
    const search: ViewChange = { kind: "search", text: "steel brackets" }
    const after = applyAll({ state: searching, changes: [search], columns: records, opened })
    expect(after.state.search).toBe("steel brackets")
    expect(say(records, search)).toBe("Searched for “steel brackets”")
    expect(revert(after.state, after.patches[0] ?? {})).toEqual(searching)
    const cleared = applyAll({
      state: after.state,
      changes: [{ kind: "clear", what: "everything" }],
      columns: records,
      opened
    })
    expect(cleared.state.search).toBe("")
    expect(overtaken(search, [{ kind: "clear", what: "search" }])).toBe(true)
  })
})

describe("a change a later one overtook", () => {
  it("is overtaken by a later change to the same part of the view, and only by that", () => {
    const sortByName: ViewChange = { kind: "sort", column: "name", direction: "asc" }
    expect(overtaken(sortByName, [{ kind: "sort", column: "code", direction: "desc" }])).toBe(true)
    expect(overtaken(sortByName, [{ kind: "hide", column: "code" }])).toBe(false)
    const unit: ViewChange = { kind: "filter", column: "unit", operator: "inArray", values: ["Box"] }
    expect(overtaken(unit, [{ kind: "filter", column: "price", operator: "lt", values: ["10"] }])).toBe(false)
    expect(overtaken(unit, [{ kind: "clear", what: "filters" }])).toBe(true)
    expect(overtaken({ kind: "clear", what: "everything" }, [{ kind: "show", column: "code" }])).toBe(true)
  })
})

describe("taking a change back", () => {
  it("never brings back a change the person removed since", () => {
    const byName: ViewChange = { kind: "sort", column: "name", direction: "asc" }
    const byCode: ViewChange = { kind: "sort", column: "code", direction: "desc" }
    const first = applyAll({ state: opened, changes: [byName], columns: records, opened })
    const second = applyAll({ state: first.state, changes: [byCode], columns: records, opened })
    const removedFirst = { change: byName, patch: first.patches[0] ?? {}, removed: true }
    const back = takeBack(second.state, { change: byCode, patch: second.patches[0] ?? {}, removed: false }, [
      removedFirst
    ])
    expect(back.sorting).toEqual([])
    const kept = takeBack(second.state, { change: byCode, patch: second.patches[0] ?? {}, removed: false }, [
      { ...removedFirst, removed: false }
    ])
    expect(kept.sorting).toEqual([{ id: "name", desc: false }])
  })
})
