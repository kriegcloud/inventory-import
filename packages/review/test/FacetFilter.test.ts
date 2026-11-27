// The filter control of one facet, drawn on a table that holds rows. The rule a wrong result breaks without a word:
// the column handed to the control must keep its table. When it lost it (a spread of the column drops `table`, which
// is not an own property), the control threw as it was drawn and the Review step showed nothing.
import { assertDefined } from "@effect/vitest/utils"
import { constructTable, type ColumnDef } from "@tanstack/react-table"
// The table's own store, as the screen's hook gives it one: a devDependency for this test, refused in src by the atoms lint.
// oxlint-disable-next-line no-restricted-imports
import { batch, createAtom } from "@tanstack/store"
import { renderPhaseReactivity } from "@tanstack/table-core/reactivity"
import { DataTableFacetedFilter } from "@inventory/ui/components/data-table/data-table-faceted-filter"
import { dataTableFeatures, type DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { facetColumn } from "../src/internal/facetColumn.ts"

type Line = { readonly id: string; readonly kind: string }

const lines: ReadonlyArray<Line> = [
  { id: "row-2", kind: "Unit" },
  { id: "row-3", kind: "Unit" },
  { id: "row-4", kind: "Date" }
]

const columns: Array<ColumnDef<DataTableFeatures, Line>> = [{ id: "kind", accessorKey: "kind", header: "Problem" }]

const options = [
  { label: "Unit", value: "Unit", count: 2 },
  { label: "Date", value: "Date", count: 1 }
]

// The reactivity React's adapter gives a table, beside the data table's own features.
const features = { coreReactivityFeature: renderPhaseReactivity({ createAtom, batch }), ...dataTableFeatures }

describe("the filter control of a facet", () => {
  const table = constructTable<DataTableFeatures, Line>({
    features,
    data: [...lines],
    columns,
    getRowId: (line) => line.id
  })
  const column = table.getColumn("kind")
  assertDefined(column)
  const draw = (handed: typeof column) =>
    renderToStaticMarkup(
      createElement(DataTableFacetedFilter<Line, unknown>, {
        column: handed,
        title: "Problem",
        options,
        multiple: true
      })
    )

  it("is drawn on a table with rows, with what is picked and a way to pick", () => {
    const picks: Array<unknown> = []
    const handed = facetColumn({ table, column, picked: ["Unit"], pick: (next) => picks.push(next) })
    expect(handed.table).toBe(table)
    expect(handed.getFilterValue()).toEqual(["Unit"])
    handed.setFilterValue(["Date"])
    expect(picks).toEqual([["Date"]])
    const drawn = draw(handed)
    expect(drawn).toContain("Problem")
    // The picked value is shown on the control itself.
    expect(drawn).toContain("Unit")
  })

  it("cannot be drawn from a spread of the column alone: the table is not an own property", () => {
    expect(() => draw({ ...column })).toThrow()
  })
})
