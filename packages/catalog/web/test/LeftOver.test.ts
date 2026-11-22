// The rows a confirm did not include, as the result names them: the row as the person knows it, what they decided.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import { leftOverLines } from "../src/internal/leftOver.ts"

describe("the rows left over", () => {
  it("are named in the file's order, each with what the person had decided", () => {
    expect(
      leftOverLines({
        rows: {
          "row-12": O.some(decisionFromFlags({ out: true })),
          "row-3": O.some(decisionFromFlags({ accepted: ["unitCost"], edits: { name: "Steel Tube 1in" } })),
          "row-55": O.none(),
          "row-7": O.some(decisionFromFlags({ stored: "replace", reverted: ["uom"] }))
        },
        beside: { "row-12": [O.some(decisionFromFlags({ stored: "keep" })), O.none()] }
      })
    ).toEqual([
      { id: "row-3", row: "Row 3", decided: "accepted the proposal for Unit cost; typed Name: Steel Tube 1in" },
      { id: "row-7", row: "Row 7", decided: "replaced the stored item; undid the fix for Unit of measure" },
      { id: "row-12", row: "Row 12", decided: "left out" },
      { id: "row-12:0", row: "Row 12", decided: "kept the stored item, in another tab of yours" },
      { id: "row-12:1", row: "Row 12", decided: "took your decision back, in another tab of yours" },
      { id: "row-55", row: "Row 55", decided: "took your decision back" }
    ])
  })
})
