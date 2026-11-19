// When the review offers "Suggest fixes": for a row that cannot be imported, and for a heading no field reads while
// a field still has no column. Never for a file with nothing a suggestion could settle.
import { describe, expect, it } from "@effect/vitest"
import { digest, offersSuggestions, questions } from "@inventory/catalog-model/Suggest"
import { review } from "@inventory/catalog-model/Review"
import { fields, type StagedTable } from "@inventory/catalog-contract/Staged"
import { matchedByHeading } from "@inventory/catalog-contract/Mapping"
import * as A from "effect/Array"
import { fiveLines, type Line, tableOf } from "./support.ts"

const ready: ReadonlyArray<Line> = A.take(fiveLines, 3)

/** The table with one heading renamed, so the field it filled has no column and the column no field. */
const renamed = (table: StagedTable, from: string, to: string): StagedTable => ({
  ...table,
  columns: A.map(table.columns, (column) => (column.label === from ? { ...column, label: to } : column))
})

const offered = (table: StagedTable) => {
  const current = review({ table, choices: [], decisions: {}, storedItems: [] })
  return {
    cannot: current.counts.cannot,
    offered: offersSuggestions({
      cannot: current.counts.cannot,
      mapping: current.mapping,
      unusedColumns: current.unusedColumns
    }),
    asks: questions(digest({ table, review: current, suggestions: [] }))
  }
}

describe("Suggest fixes is offered", () => {
  it("for a row that cannot be imported", () => {
    expect(offered(tableOf({ fileName: "five.csv", lines: fiveLines }))).toMatchObject({ cannot: 2, offered: true })
  })

  it("for a heading no field reads while a field has no column, with no row that cannot import", () => {
    const table = renamed(tableOf({ fileName: "ready.csv", lines: ready }), "quantity_on_hand", "Stock now")
    const said = offered(table)
    expect([said.cannot, said.offered]).toEqual([0, true])
    // And pressing it has something to ask: the field and the heading.
    expect(said.asks).toBeGreaterThan(0)
  })

  it("not for a file whose rows are ready and whose every heading is read", () => {
    expect(offered(tableOf({ fileName: "ready.csv", lines: ready }))).toMatchObject({ cannot: 0, offered: false })
  })

  it("for a column nobody reads beside a field with no column, and not once every field has its column", () => {
    const table = tableOf({ fileName: "ready.csv", lines: ready })
    const noted: StagedTable = {
      ...table,
      columns: [...table.columns, { index: table.columns.length, letter: "H", label: "Internal Notes" }],
      rows: A.map(table.rows, (row) => ({ ...row, cells: [...row.cells, { text: "ask purchasing" }] }))
    }
    const current = review({ table: noted, choices: [], decisions: {}, storedItems: [] })
    expect(A.map(current.unusedColumns, (column) => column.label)).toEqual(["Internal Notes"])
    // This small file has no column for tags, vendors and the rest: a heading could be one of them.
    expect(offersSuggestions({ cannot: 0, mapping: current.mapping, unusedColumns: current.unusedColumns })).toBe(true)
    // With every field filled, the notes column is all that is left over, and nothing can be suggested for it.
    const everyField = A.map(fields, (field, index) =>
      matchedByHeading({ field, column: { index, header: field, examples: [] } })
    )
    expect(offersSuggestions({ cannot: 0, mapping: everyField, unusedColumns: current.unusedColumns })).toBe(false)
  })
})
