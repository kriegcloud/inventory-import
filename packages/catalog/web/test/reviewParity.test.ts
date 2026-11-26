import type { ReviewColumn } from "@inventory/review/ReviewTypes"
import { defaultReviewWords } from "@inventory/review/ReviewWords"
import { fixableBy } from "@inventory/review/ReviewDraft"
import { assertDefined, assertTrue } from "@effect/vitest/utils"
// The server applies the person's decisions with `review` (src/domain); the screen applies them with the review
// region's own logic (src/web/components/review). These must agree, or the button would say "Import 9 items" and
// the server would write a different number. This test drives the region's logic the way the screen does, through
// the same adapter, and compares the two after every step.
// @effect-diagnostics nodeBuiltinImport:off
import { readFileSync } from "node:fs"
import { cost } from "./support/cost.ts"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as S from "effect/Schema"
import { firstDecisions, itemsOfRow, noHistory, recheckRow, review } from "@inventory/catalog-model/Review"
import { changeToStored } from "@inventory/catalog-contract/Change"
import { decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { type StagedTable } from "@inventory/catalog-contract/Staged"
import { readSpreadsheet } from "@inventory/catalog-web/Spreadsheet"
import {
  act,
  columnFor,
  count,
  Action,
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

/** These rule-only cases declare no drawing columns; the same domain is reused between decisions. */
const reviewColumns: ReadonlyArray<ReviewColumn> = []

/** A file from `public/samples/`, as the browser would hold it after the person chose it. */
const sample = (name: string): File =>
  new File([new Uint8Array(readFileSync(new URL(`./fixtures/samples/${name}`, import.meta.url)))], name)

/** Reads and stages a file exactly as the upload screen does. */
const stage = (file: File): Effect.Effect<StagedTable> =>
  Effect.orDie(
    Effect.map(readSpreadsheet({ onProgress: () => {}, sheet: O.none(), file }), (table) => stageTable({ table }))
  )

/** One screen: the decisions the server would be sent, and the region's own state, kept in step. */
const screen = (table: StagedTable, mode: "propose" | "apply", storedItems: ReadonlyArray<ItemFields>) => {
  const input = { ...noHistory, table, choices: [], storedItems }
  const check = recheckRow(input)
  const recheck = (asked: { row: ReviewRow; cells: Readonly<Record<string, string>> }) => {
    const problem = check({ id: asked.row.id, values: asked.cells })
    const answered = asked.cells[storedChoice] === "keep" || asked.cells[storedChoice] === "replace"
    if (O.exists(problem, (open) => open.kind === "changed") && answered) return asked.row.problem
    return O.map(problem, (problem) => toRegionProblem(problem, { withoutRivals: false }))
  }
  // As the review step holds them: the server's shape, and the region's state restored from the region's shape.
  let decisions: SavedDecisions = firstDecisions({ table, choices: [], mode, itemsOf: itemsOfRow })
  let state: ReviewState = restored(toRegionDecisions(decisions))
  const derive = () => {
    const current = review({ ...input, decisions })
    const rows = toRegionRows(current, decisions)
    return {
      current,
      rows,
      views: viewRows({
        columns: reviewColumns,
        fixable: fixableBy([]),
        rejects: false,
        rows,
        state,
        recheck: O.some(recheck)
      })
    }
  }
  return {
    derive,
    get decisions() {
      return decisions
    },
    /** One action of the person's, then what the screen does next: keep the decisions and derive the rows again. */
    press(action: Action) {
      const { rows } = derive()
      state = act({
        columns: reviewColumns,
        fixable: fixableBy([]),
        rejects: false,
        rows,
        state,
        action,
        recheck: O.some(recheck)
      }).state
      decisions = toServerDecisions(saved(state))
    },
    /** Every row stands the same in the region and in the domain. */
    agree() {
      const { current, views } = derive()
      // The region's word for a row that is already there is `stored`.
      const region = A.map(views, (view) => [view.row.line, view.status === "stored" ? "already" : view.status])
      const domain = A.map(current.rows, (row) => [row.rowNumber, row.status])
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
        const s = screen(table, mode, [])
        const opened = s.agree()
        expect(opened.current.counts.rows).toBe(200)

        // Take every group that is not a question, as the person would with "Use BX for the 2 ticked", until
        // none is left. Each accept can uncover the next problem of the same rows.
        const acceptGroups = (rounds: number): void => {
          if (rounds === 0) return
          const groups = A.filter(
            waitingGroups({ kind: O.none(), views: s.derive().views }),
            (candidate) => !O.contains(candidate.confidence, "low")
          )
          A.match(groups, {
            onEmpty: () => {},
            onNonEmpty: (groups) => {
              const group = A.headNonEmpty(groups)
              s.press({ type: "acceptGroup" as const, groupId: group.id, except: [] })
              s.agree()
              acceptGroups(rounds - 1)
            }
          })
        }
        acceptGroups(60)
        // What is left are the rows only a person can settle. One of each answer the screen offers, on real rows.
        const left = A.filter(s.derive().views, (view) => view.status === "needs")
        expect(left.length).toBeGreaterThan(0)
        const typed = A.findFirst(left, (view) =>
          O.exists(view.problem, (problem) => O.contains(problem.column, "sku") && O.isNone(problem.rivals))
        )
        O.match(typed, {
          onNone: () => {},
          onSome: (typed) => {
            s.press({ type: "edit" as const, rowId: typed.row.id, column: "sku", value: "ZZZ-9999" })
            s.agree()
          }
        })
        const picked = A.findFirst(
          s.derive().views,
          (view) =>
            view.status === "needs" &&
            O.exists(view.problem, (problem) => O.isSome(problem.choices) && O.isSome(problem.column))
        )
        O.map(
          O.flatMap(picked, (picked) =>
            O.all({
              rowId: O.some(picked.row.id),
              choice: O.flatMap(
                O.flatMap(picked.problem, (problem) => problem.choices),
                A.head
              ),
              column: O.flatMap(picked.problem, (problem) => problem.column)
            })
          ),
          ({ rowId, choice, column }) => {
            s.press({ type: "edit" as const, rowId, column, value: choice.value })
            s.agree()
          }
        )
        const rivals = A.findFirst(
          s.derive().views,
          (view) => view.status === "needs" && O.exists(view.problem, (problem) => O.isSome(problem.rivals))
        )
        O.match(rivals, {
          onNone: () => {},
          onSome: (rivals) => {
            s.press({ type: "keep" as const, rowId: rivals.row.id })
            s.agree()
            // Only the first kept row may win: keeping its rival too must not make both ready.
            O.map(
              O.flatMap(
                O.flatMap(rivals.problem, (problem) => problem.rivals),
                A.head
              ),
              (rival) => {
                s.press({ type: "keep" as const, rowId: rival })
                s.agree()
              }
            )
          }
        })
        const out = A.findFirst(s.derive().views, (view) => view.status === "needs")
        O.match(out, {
          onNone: () => {},
          onSome: (out) => {
            s.press({ type: "leaveOut" as const, rowIds: [out.row.id] })
            s.agree()
            s.press({ type: "undo" as const })
            s.agree()
            s.press({ type: "redo" as const })
          }
        })
        const { current, views } = s.agree()
        const { counts } = current
        expect(counts.ready + counts.needs + counts.out + counts.already).toBe(counts.rows)
        expect(counts.decision + counts.cannot).toBe(counts.needs)
        // The tabs say the domain's numbers: Needs a decision and Cannot import, counted by the region.
        const tabs = count(views)
        expect([tabs.needs, tabs.cannot, tabs.ready]).toEqual([counts.decision, counts.cannot, counts.ready])

        // What the screen would hand over is what the server would write: the same rows, values and provenance.
        const handed = result({ words: defaultReviewWords, views, problemKinds: regionKinds })
        const ready = A.filter(current.rows, (row) => row.status === "ready")
        expect(A.map(handed.ready, (row) => row.line)).toEqual(A.map(ready, (row) => row.rowNumber))
        expect(A.map(handed.ready, (row) => row.cells)).toEqual(A.map(ready, (row) => row.values))
        type Line = { column: string; from: string; to: string; source: string; decidedBy: string; how: string }
        const byColumn = (list: ReadonlyArray<Line>) =>
          A.sort(
            list,
            Order.mapInput(Order.String, (line: Line) => line.column)
          )
        expect(
          A.map(handed.ready, (row) =>
            byColumn(
              A.map(row.changes, (change) => ({
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
          A.map(ready, (row) =>
            byColumn(
              // In the stored words, which are the region's own: who proposed, who decided, and how.
              A.map(A.map(row.changes, changeToStored), (change) => ({
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
          A.map(
            A.filter(handed.ready, (row) => row.kept),
            (row) => row.line
          )
        ).toEqual(
          A.map(
            A.filter(ready, (row) => row.kept),
            (row) => row.rowNumber
          )
        )
        const held = A.filter(current.rows, (row) => row.status !== "ready")
        expect(A.map(handed.held, (row) => [row.line, row.decidedBy])).toEqual(
          A.map(held, (row) => [row.rowNumber, row.status === "out" ? "person" : "nobody"])
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
        const s = screen(table, "apply", [])
        const proposed = O.flatMap(
          A.findFirst(s.derive().views, (candidate) => candidate.row.id === "row-45"),
          (view) => O.flatMap(view.problem, (problem) => problem.fix)
        )
        expect(O.map(proposed, (fix) => fix.why.labels)).toEqual(O.some(["Not active", "No discontinued date"]))
        expect(O.map(proposed, (fix) => fix.why.alternatives)).toEqual(O.some([""]))
        assertTrue(O.isSome(proposed), "expected row 45 to carry a proposal")
        const fix = proposed.value
        const value = answer === "Not active" ? fix.to : ""
        s.press(
          value === fix.to
            ? { type: "accept" as const, rowIds: ["row-45"] }
            : { type: "edit" as const, rowId: "row-45", column: columnFor(fix, value), value }
        )
        const { current, views } = s.agree()
        const row = A.filter(current.rows, (candidate) => candidate.id === "row-45")[0]
        assertDefined(row)
        expect(row.status, answer).toBe("ready")
        expect(A.filter(views, (candidate) => candidate.row.id === "row-45")[0]?.status, answer).toBe("ready")
        expect(
          O.map(
            O.flatMap(O.fromUndefinedOr(row), (found) => found.item),
            (item) => item.stocking
          ),
          answer
        ).toEqual(O.some(answer === "Not active" ? { kind: "discontinued", on: "2025-06-30" } : { kind: "active" }))
        // Undone, the row asks again on both sides.
        s.press({ type: "undo" as const })
        expect(A.filter(s.agree().current.rows, (candidate) => candidate.id === "row-45")[0]?.outcome).toBe("decision")
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
      const decisions = firstDecisions({ table, choices: [], mode: "propose", itemsOf: itemsOfRow })
      const current = review({ ...noHistory, table, choices: [], decisions, storedItems: [] })
      const rows = toRegionRows(current, decisions)
      const picks = A.filter(rows, (row) => O.exists(row.problem, (problem) => O.contains(problem.column, "category")))
      expect(picks.length).toBe(1)
      for (const row of picks) {
        expect(O.flatMap(row.problem, (problem) => problem.fix)).toEqual(O.none())
        expect(
          O.map(
            O.flatMap(row.problem, (problem) => problem.choices),
            (choices) => A.map(choices, (choice) => choice.value)
          )
        ).toEqual(O.some(["raw-materials", "components", "finished-goods", "packaging", "supplies"]))
        expect(
          O.exists(
            O.flatMap(row.problem, (problem) => problem.choices),
            (choices) => A.some(choices, (choice) => choice.suggested)
          )
        ).toBe(false)
      }
    })
  )

  it.effect("spaces round a SKU are one group per column, named by the fix, each row keeping its own value", () =>
    Effect.gen(function* () {
      const table = yield* stage(
        new File([`${heading}\n ABC-0001,One,packaging,EA,1.00\nABC-0002 ,Two,packaging,EA,1.00\n`], "items.csv")
      )
      const s = screen(table, "propose", [])
      const groups = A.filter(
        waitingGroups({ kind: O.none(), views: s.derive().views }),
        (group) => group.kind === "spaces"
      )
      expect(A.map(groups, (group) => [group.id, group.label, group.rowIds.length > 1])).toEqual([
        ["sku:trim", O.some("the value without its spaces"), true]
      ])
      const group = groups[0]
      assertDefined(group)
      s.press({ type: "acceptGroup" as const, groupId: group.id, except: [] })
      const { current } = s.agree()
      const trimmed = A.filter(current.rows, (row) => A.contains(group.rowIds, row.id))
      const expectedSkus = yield* Effect.forEach(trimmed, (row) => S.decodeEffect(S.Trim)(row.file.sku), {
        concurrency: 1
      })
      expect(A.map(trimmed, (row) => row.values.sku)).toEqual(expectedSkus)
      expect(A.dedupe(A.map(trimmed, (row) => row.values.sku)).length).toBe(trimmed.length)
    })
  )

  it.effect("a stored item that differs waits for keep or replace, and either answer reaches the server", () =>
    Effect.gen(function* () {
      const table = yield* stage(new File([`${heading}\nABC-0001,One,packaging,EA,2.00\n`], "items.csv"))
      const stored: ItemFields = {
        sku: "ABC-0001",
        name: "One",
        description: O.none(),
        category: "packaging",
        uom: "EA",
        unitCost: cost("1"),
        quantityOnHand: 0,
        reorderPoint: O.none(),
        stocking: active,
        lotTracked: false,
        tags: [],
        firstReceivedOn: O.none(),
        dimensions: O.none(),
        vendors: []
      }
      for (const answer of ["keep", "replace"] as const) {
        const s = screen(table, "apply", [stored])
        const opened = s.agree()
        const view = opened.views[0]
        assertDefined(view)
        expect(view.status).toBe("needs")
        expect(O.flatMap(view.problem, (problem) => problem.column)).toEqual(O.some(storedChoice))
        // The button says what the choice is, not the SKU column the problem sits on.
        expect(O.flatMap(view.problem, (problem) => problem.ask)).toEqual(O.some("Keep or replace"))
        expect(
          O.map(
            O.flatMap(view.problem, (problem) => problem.choices),
            (choices) => A.map(choices, (choice) => choice.value)
          )
        ).toEqual(O.some(["keep", "replace"]))
        s.press({ type: "edit" as const, rowId: "row-2", column: storedChoice, value: answer })
        // As the server stores it: the one flag, and nothing else said about the row.
        const sent = s.decisions["row-2"]
        expect(sent).toEqual(decisionFromFlags({ stored: answer }))
        const { current } = s.agree()
        expect(current.rows[0]?.status).toBe(answer === "keep" ? "already" : "ready")
        expect(current.rows[0]?.update).toBe(answer === "replace")
        s.press({ type: "undo" as const })
        expect(s.agree().current.rows[0]?.status).toBe("needs")
      }
    })
  )
})
