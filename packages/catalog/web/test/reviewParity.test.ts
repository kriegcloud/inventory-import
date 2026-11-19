// The server applies the person's decisions with `review` (src/domain); the screen applies them with the review
// region's own logic (src/web/components/review). These must agree, or the button would say "Import 9 items" and
// the server would write a different number. This test drives the region's logic the way the screen does, through
// the same adapter, and compares the two after every step.
// @effect-diagnostics nodeBuiltinImport:off
import { readFileSync } from "node:fs"
import { cost } from "./support/cost.ts"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Order, String as Str } from "effect"
import { firstDecisions, recheckRow, review } from "@inventory/catalog-model/Review"
import { changeToStored } from "@inventory/catalog-contract/Change"
import { decisionToFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { type StagedTable } from "@inventory/catalog-contract/Staged"
import { readSpreadsheet } from "@inventory/catalog-web/Spreadsheet"
import {
  act,
  columnFor,
  count,
  type Action,
  restored,
  result,
  saved,
  viewRows,
  waitingGroups
} from "@inventory/review/ReviewDraft"
import type { ReviewRow, ReviewState } from "@inventory/review/ReviewTypes"
import { active, type ItemFields } from "@inventory/catalog-contract/Item"
import {
  regionKinds,
  storedChoice,
  toRegionDecisions,
  toRegionProblem,
  toRegionRows,
  toServerDecisions
} from "@inventory/catalog-web/ImportReview"
import { stageTable } from "@inventory/catalog-model/Staging"

/** A file from `public/samples/`, as the browser would hold it after the person chose it. */
const sample = (name: string): File =>
  new File([new Uint8Array(readFileSync(new URL(`./fixtures/samples/${name}`, import.meta.url)))], name)

/** Reads and stages a file exactly as the upload screen does. */
const stage = (file: File): Effect.Effect<StagedTable> =>
  Effect.orDie(Effect.map(readSpreadsheet({ file }), (table) => stageTable({ table })))

/** One screen: the decisions the server would be sent, and the region's own state, kept in step. */
const screen = (table: StagedTable, mode: "propose" | "apply", storedItems: ReadonlyArray<ItemFields> = []) => {
  const input = { table, choices: [], storedItems }
  const check = recheckRow(input)
  const recheck = (asked: { row: ReviewRow; cells: Readonly<Record<string, string>> }) => {
    const problem = check({ id: asked.row.id, values: asked.cells })
    const answered = asked.cells[storedChoice] === "keep" || asked.cells[storedChoice] === "replace"
    if (problem?.kind === "changed" && answered) return asked.row.problem
    return problem === undefined ? undefined : toRegionProblem(problem)
  }
  // As the review step holds them: the server's shape, and the region's state restored from the region's shape.
  let decisions: SavedDecisions = firstDecisions({ table, choices: [], mode })
  let state: ReviewState = restored(toRegionDecisions(decisions))
  const derive = () => {
    const current = review({ ...input, decisions })
    const rows = toRegionRows(current, decisions)
    return { current, rows, views: viewRows({ rows, state, recheck }) }
  }
  return {
    derive,
    get decisions() {
      return decisions
    },
    /** One action of the person's, then what the screen does next: keep the decisions and derive the rows again. */
    press(action: Action) {
      const { rows } = derive()
      state = act({ rows, state, action, recheck }).state
      decisions = toServerDecisions(saved(state))
    },
    /** Every row stands the same in the region and in the domain. */
    agree() {
      const { current, views } = derive()
      // The region's word for a row that is already there is `stored`.
      const region = Arr.map(views, (view) => [view.row.line, view.status === "stored" ? "already" : view.status])
      const domain = Arr.map(current.rows, (row) => [row.rowNumber, row.status])
      expect(region).toEqual(domain)
      return { current, views }
    }
  }
}

describe("the screen and the server apply decisions the same way", () => {
  for (const mode of ["propose", "apply"] as const) {
    it.effect(`on the messy sample, with rule fixes set to ${mode}`, () =>
      Effect.gen(function* () {
        const table = yield* stage(sample("items_messy.csv"))
        const s = screen(table, mode)
        const opened = s.agree()
        expect(opened.current.counts.rows).toBe(200)

        // Take every group that is not a question, as the person would with "Use BX for the 2 ticked", until
        // none is left. Each accept can uncover the next problem of the same rows.
        for (let round = 0; round < 60; round += 1) {
          const group = Arr.findFirst(
            waitingGroups({ views: s.derive().views }),
            (candidate) => candidate.confidence !== "low"
          )
          if (group._tag === "None") break
          s.press({ type: "acceptGroup", groupId: group.value.id })
          s.agree()
        }
        // What is left are the rows only a person can settle. One of each answer the screen offers, on real rows.
        const left = Arr.filter(s.derive().views, (view) => view.status === "needs")
        expect(left.length).toBeGreaterThan(0)
        const typed = Arr.findFirst(left, (view) => view.problem?.column === "sku" && view.problem.rivals === undefined)
        if (typed._tag === "Some") {
          s.press({ type: "edit", rowId: typed.value.row.id, column: "sku", value: "ZZZ-9999" })
          s.agree()
        }
        const picked = Arr.findFirst(
          s.derive().views,
          (view) => view.status === "needs" && view.problem?.choices !== undefined && view.problem.column !== undefined
        )
        if (picked._tag === "Some") {
          const choice = picked.value.problem?.choices?.[0]
          const column = picked.value.problem?.column
          if (choice !== undefined && column !== undefined) {
            s.press({ type: "edit", rowId: picked.value.row.id, column, value: choice.value })
            s.agree()
          }
        }
        const rivals = Arr.findFirst(
          s.derive().views,
          (view) => view.status === "needs" && view.problem?.rivals !== undefined
        )
        if (rivals._tag === "Some") {
          s.press({ type: "keep", rowId: rivals.value.row.id })
          s.agree()
          // Only the first kept row may win: keeping its rival too must not make both ready.
          const rival = rivals.value.problem?.rivals?.[0]
          if (rival !== undefined) {
            s.press({ type: "keep", rowId: rival })
            s.agree()
          }
        }
        const out = Arr.findFirst(s.derive().views, (view) => view.status === "needs")
        if (out._tag === "Some") {
          s.press({ type: "leaveOut", rowIds: [out.value.row.id] })
          s.agree()
          s.press({ type: "undo" })
          s.agree()
          s.press({ type: "redo" })
        }
        const { current, views } = s.agree()
        const { counts } = current
        expect(counts.ready + counts.needs + counts.out + counts.already).toBe(counts.rows)
        expect(counts.decision + counts.cannot).toBe(counts.needs)
        // The tabs say the domain's numbers: Needs a decision and Cannot import, counted by the region.
        const tabs = count(views)
        expect([tabs.needs, tabs.cannot, tabs.ready]).toEqual([counts.decision, counts.cannot, counts.ready])

        // What the screen would hand over is what the server would write: the same rows, values and provenance.
        const handed = result({ views, problemKinds: regionKinds })
        const ready = Arr.filter(current.rows, (row) => row.status === "ready")
        expect(Arr.map(handed.ready, (row) => row.line)).toEqual(Arr.map(ready, (row) => row.rowNumber))
        expect(Arr.map(handed.ready, (row) => row.cells)).toEqual(Arr.map(ready, (row) => row.values))
        type Line = { column: string; from: string; to: string; source: string; decidedBy: string; how: string }
        const byColumn = (list: ReadonlyArray<Line>) =>
          Arr.sort(
            list,
            Order.mapInput(Order.String, (line: Line) => line.column)
          )
        expect(
          Arr.map(handed.ready, (row) =>
            byColumn(
              Arr.map(row.changes, (change) => ({
                column: change.column,
                from: change.from,
                to: change.to,
                source: change.source,
                decidedBy: change.decidedBy,
                how: change.how
              }))
            )
          )
        ).toEqual(
          Arr.map(ready, (row) =>
            byColumn(
              // In the stored words, which are the region's own: who proposed, who decided, and how.
              Arr.map(Arr.map(row.changes, changeToStored), (change) => ({
                column: change.field,
                from: change.from,
                to: change.to,
                source: change.source,
                decidedBy: change.decidedBy,
                how: change.how
              }))
            )
          )
        )
        expect(
          Arr.map(
            Arr.filter(handed.ready, (row) => row.kept),
            (row) => row.line
          )
        ).toEqual(
          Arr.map(
            Arr.filter(ready, (row) => row.kept),
            (row) => row.rowNumber
          )
        )
        const held = Arr.filter(current.rows, (row) => row.status !== "ready")
        expect(Arr.map(handed.held, (row) => [row.line, row.decidedBy])).toEqual(
          Arr.map(held, (row) => [row.rowNumber, row.status === "out" ? "person" : "nobody"])
        )
      })
    )
  }
})

const heading = "sku,name,category,uom,unit_cost"

describe("a row discontinued yet active, on the screen", () => {
  it.effect("offers both answers, and either one makes the row ready on the screen and on the server alike", () =>
    Effect.gen(function* () {
      const table = yield* stage(sample("items_messy.csv"))
      for (const answer of ["Not active", "No discontinued date"]) {
        const s = screen(table, "apply")
        const view = Option.getOrUndefined(
          Arr.findFirst(s.derive().views, (candidate) => candidate.row.id === "row-45")
        )
        const fix = view?.problem?.fix
        expect(fix?.why.labels).toEqual(["Not active", "No discontinued date"])
        expect(fix?.why.alternatives).toEqual([""])
        if (fix === undefined) return
        const value = answer === "Not active" ? fix.to : ""
        s.press(
          value === fix.to
            ? { type: "accept", rowIds: ["row-45"] }
            : { type: "edit", rowId: "row-45", column: columnFor(fix, value), value }
        )
        const { current, views } = s.agree()
        const row = Option.getOrUndefined(Arr.findFirst(current.rows, (candidate) => candidate.id === "row-45"))
        expect(row?.status, answer).toBe("ready")
        expect(
          Option.getOrUndefined(Arr.findFirst(views, (candidate) => candidate.row.id === "row-45"))?.status,
          answer
        ).toBe("ready")
        expect(row?.item?.stocking, answer).toEqual(
          answer === "Not active" ? { kind: "discontinued", on: "2025-06-30" } : { kind: "active" }
        )
        // Undone, the row asks again on both sides.
        s.press({ type: "undo" })
        expect(
          Option.getOrUndefined(Arr.findFirst(s.agree().current.rows, (candidate) => candidate.id === "row-45"))
            ?.outcome
        ).toBe("decision")
      }
    })
  )
})

describe("what the review screen is handed for a pick, for spaces and for a stored item", () => {
  it.effect("a category no rule reads is a pick among the five, none suggested", () =>
    Effect.gen(function* () {
      const table = yield* stage(
        new File([`${heading}\nABC-0001,One,Misc,EA,1.00\nABC-0002,Two,packaging,EA,1.00\n`], "items.csv")
      )
      const decisions = firstDecisions({ table, choices: [], mode: "propose" })
      const current = review({ table, choices: [], decisions, storedItems: [] })
      const rows = toRegionRows(current, decisions)
      const picks = Arr.filter(rows, (row) => row.problem?.column === "category")
      expect(picks.length).toBe(1)
      for (const row of picks) {
        expect(row.problem?.fix).toBeUndefined()
        expect(Arr.map(row.problem?.choices ?? [], (choice) => choice.value)).toEqual([
          "raw-materials",
          "components",
          "finished-goods",
          "packaging",
          "supplies"
        ])
        expect(Arr.some(row.problem?.choices ?? [], (choice) => choice.suggested === true)).toBe(false)
      }
    })
  )

  it.effect("spaces round a SKU are one group per column, named by the fix, each row keeping its own value", () =>
    Effect.gen(function* () {
      const table = yield* stage(
        new File([`${heading}\n ABC-0001,One,packaging,EA,1.00\nABC-0002 ,Two,packaging,EA,1.00\n`], "items.csv")
      )
      const s = screen(table, "propose")
      const groups = Arr.filter(waitingGroups({ views: s.derive().views }), (group) => group.kind === "spaces")
      expect(Arr.map(groups, (group) => [group.id, group.label, group.rowIds.length > 1])).toEqual([
        ["sku:trim", "the value without its spaces", true]
      ])
      const group = groups[0]
      if (group === undefined) return
      s.press({ type: "acceptGroup", groupId: group.id })
      const { current } = s.agree()
      const trimmed = Arr.filter(current.rows, (row) => Arr.contains(group.rowIds, row.id))
      expect(Arr.map(trimmed, (row) => row.values.sku)).toEqual(Arr.map(trimmed, (row) => Str.trim(row.file.sku)))
      expect(Arr.dedupe(Arr.map(trimmed, (row) => row.values.sku)).length).toBe(trimmed.length)
    })
  )

  it.effect("a stored item that differs waits for keep or replace, and either answer reaches the server", () =>
    Effect.gen(function* () {
      const table = yield* stage(new File([`${heading}\nABC-0001,One,packaging,EA,2.00\n`], "items.csv"))
      const stored: ItemFields = {
        sku: "ABC-0001",
        name: "One",
        description: Option.none(),
        category: "packaging",
        uom: "EA",
        unitCost: cost("1"),
        quantityOnHand: 0,
        reorderPoint: Option.none(),
        stocking: active,
        lotTracked: false,
        tags: [],
        firstReceivedOn: Option.none(),
        dimensions: Option.none(),
        vendors: []
      }
      for (const answer of ["keep", "replace"] as const) {
        const s = screen(table, "apply", [stored])
        const opened = s.agree()
        const view = opened.views[0]
        expect(view?.status).toBe("needs")
        expect(view?.problem?.column).toBe(storedChoice)
        // The button says what the choice is, not the SKU column the problem sits on.
        expect(view?.problem?.ask).toBe("Keep or replace")
        expect(Arr.map(view?.problem?.choices ?? [], (choice) => choice.value)).toEqual(["keep", "replace"])
        s.press({ type: "edit", rowId: "row-2", column: storedChoice, value: answer })
        // As the server stores it: the one flag, and nothing else said about the row.
        const sent = s.decisions["row-2"]
        expect(sent === undefined ? sent : decisionToFlags(sent)).toEqual({ stored: answer })
        const { current } = s.agree()
        expect(current.rows[0]?.status).toBe(answer === "keep" ? "already" : "ready")
        expect(current.rows[0]?.update).toBe(answer === "replace")
        s.press({ type: "undo" })
        expect(s.agree().current.rows[0]?.status).toBe("needs")
      }
    })
  )
})
