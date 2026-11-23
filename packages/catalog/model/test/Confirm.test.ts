// The plan of a confirm is the review's verdict and nothing else: whatever a file holds and whatever was decided,
// the plan has one row per item of the file, in the review's order, and its statuses add up to the review's.
import { describe, expect, it } from "@effect/vitest"
import { decisionFromFlags, rowId, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { ImportId, ItemId } from "@inventory/catalog-contract/Ids"
import { DecidedBy } from "@inventory/catalog-contract/Import"
import { ConfirmPlan, confirmPlan, maxReason, PlannedRow } from "@inventory/catalog-model/Confirm"
import { ConfirmWrite } from "@inventory/catalog-model/ImportStore"
import { review } from "@inventory/catalog-model/Review"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
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
// Every field of a write but its plan and its ids, which the tests below put together themselves.
const { plan: _plan, itemIds: _itemIds, ...others } = ConfirmWrite.fields
const draft = ImportId.make("00000000-0000-4000-8000-000000000001")

describe("confirmPlan", () => {
  it.prop(
    "has one row per item of the file, and its statuses add up to the review's",
    [S.Array(Line).check(S.isMaxLength(12)), S.Struct(others), S.Array(ItemId).check(S.isMinLength(12))],
    ([lines, rest, ids]) => {
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
      // The plan is one a store can be handed with an id for each row it creates, and with one id short it is not.
      const itemIds = A.take(ids, count("ready"))
      expect(itemIds.length).toBe(count("ready"))
      expect(S.is(ConfirmWrite)({ ...rest, plan, itemIds })).toBe(true)
      expect(S.is(ConfirmWrite)({ ...rest, plan, itemIds: A.drop(itemIds, 1) })).toBe(count("ready") === 0)
    },
    { arbitrary: { runs: 60 } }
  )
})

// Generated from the plan's own schema, so a plan the schema lets through is one a store can be handed.
describe("a plan a confirm can be handed", () => {
  it.prop(
    "places every row on a row of the file: the contract's row id can be made from its row and part",
    [ConfirmPlan],
    ([plan]) => {
      for (const row of plan.rows) {
        expect(rowId({ rowNumber: row.rowNumber, part: row.part })).toBe(
          row.part === 0 ? `row-${row.rowNumber}` : `row-${row.rowNumber}.${row.part}`
        )
      }
    }
  )

  it.prop(
    "says why for every row it leaves out or skips: no reason is blank, or longer than a store writes",
    [ConfirmPlan],
    ([plan]) => {
      const said = A.filter(plan.rows, PlannedRow.isAnyOf(["notImported", "already"]))
      expect(A.filter(said, (row) => O.isNone(Str.match(/\S/)(row.reason)) || row.reason.length > maxReason)).toEqual(
        []
      )
    }
  )

  it("refuses a reason of spaces alone, and one past what a store writes", () => {
    const at = { status: "already", rowNumber: 2, part: 0, sku: "AAA-0001", name: "Oak Crate" }
    expect(S.is(PlannedRow)({ ...at, reason: "SKU AAA-0001 is already there." })).toBe(true)
    expect(S.is(PlannedRow)({ ...at, reason: "   " })).toBe(false)
    expect(S.is(PlannedRow)({ ...at, reason: Str.repeat(maxReason)("x") })).toBe(true)
    expect(S.is(PlannedRow)({ ...at, reason: Str.repeat(maxReason + 1)("x") })).toBe(false)
  })
})

// Generated from the schemas of a write, a plan and a list of item ids, each drawn on its own: nothing makes the
// number of ids agree with the number of rows the plan creates, so they agree only by chance (most often with none
// of either), and the test holds whichever way a draw falls. Both stores pair the rows a plan creates with the ids by `A.zip`, which stops at the shorter
// list: a write with an id missing would leave a ready row out without a word.
describe("a confirm as it is written", () => {
  it.prop(
    "is a write only with one id for each row its plan creates, and then none is left unpaired",
    [S.Struct(others), ConfirmPlan, S.Array(ItemId)],
    ([rest, plan, itemIds]) => {
      const creates = A.filter(plan.rows, PlannedRow.guards.ready)
      const accepted = S.is(ConfirmWrite)({ ...rest, plan, itemIds })
      expect(accepted).toBe(itemIds.length === creates.length)
      if (accepted) expect(A.zip(creates, itemIds).length).toBe(creates.length)
    }
  )
})
