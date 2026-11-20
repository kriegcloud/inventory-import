// An accept made before its field's column was matched again is not applied: the person accepted what the field
// read before, and the row now has another proposal or none. The rest of the row's decision is applied.
import { describe, expect, it } from "@effect/vitest"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import type { MappingChoice } from "@inventory/catalog-contract/Mapping"
import { withoutStaleAccepts } from "@inventory/catalog-model/ImportsHandler"

const choices: ReadonlyArray<MappingChoice> = [
  { field: "unitCost", column: 7, by: "person", at: 12 },
  { field: "uom", column: 4, by: "person", at: 3 }
]
const set = {
  "row-55": decisionFromFlags({ accepted: ["unitCost", "uom"], edits: { name: "Steel Tube 1in" } }),
  "row-18": decisionFromFlags({ reverted: ["uom"] })
}

describe("accepts made before a column was matched again", () => {
  it("are taken out and named; the rest of the decision, and every other row, is applied", () => {
    const made = withoutStaleAccepts({ choices, madeOn: 11, set })
    expect(made.notApplied).toEqual([{ rowId: "row-55", field: "unitCost" }])
    expect(made.applied).toEqual({
      "row-55": decisionFromFlags({ accepted: ["uom"], edits: { name: "Steel Tube 1in" } }),
      "row-18": set["row-18"]
    })
  })

  it("are applied when the decision was made on the revision that has the match, or a later one", () => {
    expect(withoutStaleAccepts({ choices, madeOn: 12, set })).toEqual({ applied: set, notApplied: [] })
  })

  it("names every accept of every field matched since, on a decision made before any match", () => {
    expect(withoutStaleAccepts({ choices, madeOn: 2, set }).notApplied).toEqual([
      { rowId: "row-55", field: "unitCost" },
      { rowId: "row-55", field: "uom" }
    ])
  })
})
