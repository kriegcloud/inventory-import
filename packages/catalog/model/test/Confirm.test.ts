// The plan of a confirm is the review's verdict and nothing else: whatever a file holds and whatever was decided,
// the plan has one row per item of the file, in the review's order, and its statuses add up to the review's.
import { describe, expect, it } from "@effect/vitest"
import { decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { DecidedBy } from "@inventory/catalog-contract/Import"
import { confirmPlan, PlannedRow } from "@inventory/catalog-model/Confirm"
import { review } from "@inventory/catalog-model/Review"
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { marcus, tableOf } from "./support.ts"

const Line = S.Struct({
  sku: S.Literals(["AAA-0001", "AAA-0002", "aaa-0003", "AAA-0004", ""]),
  name: S.Literals(["Oak Crate", "Steel Bolt", ""]),
  category: S.Literals(["packaging", "components", "Misc"]),
  uom: S.Literals(["EA", "bx", "KG"]),
  unit_cost: S.Literals(["12.50", "3", "-2", "about 4"]),
  quantity_on_hand: S.Literals(["10", "1.5", ""]),
  out: S.Boolean
})
const draft = ImportId.make("00000000-0000-4000-8000-000000000001")

describe("confirmPlan", () => {
  it.prop(
    "has one row per item of the file, and its statuses add up to the review's",
    [S.Array(Line).check(S.isMaxLength(12))],
    ([lines]) => {
      const table = tableOf({ fileName: "any.csv", lines })
      const decisions: SavedDecisions = R.fromEntries(
        A.flatMap(lines, (line, index) =>
          line.out ? [[`row-${index + 2}`, decisionFromFlags({ out: true })] as const] : []
        )
      )
      const current = review({ table, choices: [], decisions, storedItems: [] })
      const plan = confirmPlan({ draft, review: current, authors: {}, actor: marcus })
      const count = (status: PlannedRow["status"]) => A.filter(plan.rows, PlannedRow.isAnyOf([status])).length
      const reviewed = (status: string) => A.filter(current.rows, (row) => row.status === status).length
      expect(A.map(plan.rows, (row) => row.rowNumber)).toEqual(A.map(current.rows, (row) => row.rowNumber))
      expect(count("ready") + count("update")).toBe(reviewed("ready"))
      expect(count("already")).toBe(reviewed("already"))
      expect(count("notImported")).toBe(reviewed("needs") + reviewed("out"))
      // A row the person left out says who; a row nobody settled says nobody.
      const deciders = A.map(A.filter(plan.rows, PlannedRow.guards.notImported), (row) => row.decidedBy)
      expect(A.filter(deciders, DecidedBy.guards.person).length).toBe(reviewed("out"))
      // A row that is written carries an item; nothing else does.
      expect(A.every(plan.rows, (row) => PlannedRow.isAnyOf(["ready", "update"])(row) === "item" in row)).toBe(true)
    },
    { arbitrary: { runs: 60 } }
  )
})
