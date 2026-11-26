import { totalCells } from "@inventory/review/ReviewDraft"
import { identity } from "effect/Function"
import { defaultReviewWords } from "@inventory/review/ReviewWords"
import { fixableBy } from "@inventory/review/ReviewDraft"
import { assertDefined, assertTrue } from "@effect/vitest/utils"
import { it as fx } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as S from "effect/Schema"
import { describe, expect, it } from "vitest"
import { CellMark, Entry } from "@inventory/review/ReviewTypes"
import {
  act,
  Action,
  OtherAnswer,
  appliedGroups,
  choicesOf,
  choiceText,
  confirmLine,
  count,
  emptyState,
  entries,
  groupUse,
  heldCsv,
  heldLine,
  importSummary,
  nextProblem,
  otherAnswers,
  pickedChoice,
  Primary,
  primary,
  proposing,
  restored,
  queue,
  sections,
  result,
  saved,
  shownWith,
  toDraft,
  fromDraft,
  viewRows,
  visible,
  waitingGroups,
  weakGuess,
  whyWords
} from "@inventory/review/ReviewDraft"
import { Choice } from "@inventory/review/ReviewTypes"
import type { ReviewRow, ReviewState, SavedDecisions } from "@inventory/review/ReviewTypes"
import { columns, columnsUnmatched, makeRows, problemKinds, recheck } from "./fixtures/fabrication.ts"
import { lineColumns, lineKinds, makeJobs, questionRows, recheckLine, reviewJobs } from "./fixtures/jobs.ts"

// The gallery's made-up stock file drives these tests: 178 rows, 136 ready, 42 that need the person.
const rows = makeRows({ size: 178 })
const noun = ["item", "items"] as const

const views = (state: ReviewState) =>
  viewRows({ columns, fixable: fixableBy([]), rejects: false, rows, state, recheck: O.some(recheck) })
const run = (state: ReviewState, action: Action) =>
  act({ columns, fixable: fixableBy([]), rejects: false, rows, state, action, recheck: O.some(recheck) })
const after = (...actions: ReadonlyArray<Action>): ReviewState =>
  A.reduce(actions, emptyState, (state, action) => run(state, action).state)
const firstOf = (kind: string): ReviewRow => {
  const row = A.findFirst(rows, (candidate) => O.exists(candidate.problem, (problem) => problem.kind === kind))
  assertTrue(O.isSome(row), `no ${kind} row in the gallery file`)
  return row.value
}
const viewOf = (state: ReviewState, rowId: string) => {
  const view = A.findFirst(views(state), (candidate) => candidate.row.id === rowId)
  assertTrue(O.isSome(view), `no row ${rowId}`)
  return view.value
}

describe("counts", () => {
  it("opens with 42 needing the person, 136 ready and 17 rule fixes in force", () => {
    const counts = count(views(emptyState))
    expect([counts.total, counts.needs, counts.ready, counts.out, counts.applied]).toEqual([178, 42, 136, 0, 17])
  })

  it("adds up after every kind of decision: needs + ready + out = total, kinds = needs", () => {
    const unit = firstOf("unit")
    const copy = firstOf("copy")
    const cost = firstOf("cost")
    const states = [
      emptyState,
      after({ type: "accept" as const, rowIds: [unit.id] }),
      after(
        { type: "acceptGroup" as const, groupId: "unit:each", except: [] },
        { type: "leaveOut" as const, rowIds: [cost.id] }
      ),
      after({ type: "keep" as const, rowId: copy.id }, { type: "revertGroup" as const, groupId: "unit:case:kg" }),
      after({ type: "edit" as const, rowId: cost.id, column: "cost", value: "$4.10" }, { type: "undo" as const })
    ]
    for (const state of states) {
      const counts = count(views(state))
      expect(counts.needs + counts.ready + counts.out).toBe(counts.total)
      expect(A.reduce([...HashMap.values(counts.kinds)], 0, (sum, n) => sum + n)).toBe(counts.needs)
    }
  })

  it("the button's number is the Ready count, and the held line is everything else", () => {
    const state = after(
      { type: "acceptGroup" as const, groupId: "unit:each", except: [] },
      { type: "leaveOut" as const, rowIds: [firstOf("cost").id] }
    )
    const counts = count(views(state))
    expect(primary({ closing: O.none(), words: defaultReviewWords, columns, counts, noun })).toEqual(
      Primary.Import({ label: `Import ${counts.ready} items` })
    )
    expect(counts.ready).toBe(145)
    // Each count under the word its tab says, so the line and the tabs never disagree.
    expect(heldLine(counts, defaultReviewWords)).toBe("33 won't be imported: Needs a decision 32, Left out 1")
    expect(confirmLine({ words: defaultReviewWords, counts, noun })).toBe(
      "33 items won't be imported (Needs a decision 32, Left out 1). Your file is not changed."
    )
    expect(result({ words: defaultReviewWords, views: views(state), problemKinds }).ready).toHaveLength(145)
  })

  it("says so when nothing is held", () => {
    const clean = viewRows({
      columns,
      recheck: O.none(),
      fixable: fixableBy([]),
      rejects: false,
      rows: makeRows({ size: 178, clean: true }),
      state: emptyState
    })
    expect(heldLine(count(clean), defaultReviewWords)).toBe("All 178 ready")
    expect(primary({ closing: O.none(), words: defaultReviewWords, columns, counts: count(clean), noun }).label).toBe(
      "Import 178 items"
    )
  })
})

describe("a proposal never overwrites the person's decision", () => {
  it("a group accept skips a row the person typed a value into, and a row they left out", () => {
    const group = A.findFirst(
      waitingGroups({ kind: O.none(), views: views(emptyState) }),
      (candidate) => candidate.id === "unit:each"
    )
    assertTrue(O.isSome(group), "no group")
    const [typed, left] = group.value.rowIds
    assertDefined(typed)
    assertDefined(left)
    const state = after(
      { type: "edit" as const, rowId: typed, column: "unit", value: "kg" },
      { type: "leaveOut" as const, rowIds: [left] },
      { type: "acceptGroup" as const, groupId: "unit:each", except: [] }
    )
    expect(viewOf(state, typed).cells.unit).toBe("kg")
    const typedMark = viewOf(state, typed).marks.unit
    expect(CellMark.guards.applied(typedMark)).toBe(true)
    expect(typedMark).toMatchObject({ by: "you", to: "kg" })
    expect(viewOf(state, left).status).toBe("out")
    const leftDecision = HashMap.get(state.decisions, left)
    assertTrue(O.isSome(leftDecision), "expected a present test value")
    expect(leftDecision.value.accepted).toEqual([])
    const lastStep = A.last(state.undo)
    assertTrue(O.isSome(lastStep), "expected a present test value")
    expect(lastStep.value.label).toBe("7 fixes accepted")
  })

  it("keeping one copy leaves its twin out, but not a twin the person already gave a new SKU", () => {
    const copy = firstOf("copy")
    const rival = O.flatMap(
      O.flatMap(copy.problem, (problem) => problem.rivals),
      A.head
    )
    const hasRival = O.isSome(rival)
    assertTrue(hasRival)
    const twin = rival.value
    const kept = after({ type: "keep" as const, rowId: copy.id })
    expect(viewOf(kept, copy.id).status).toBe("ready")
    expect(viewOf(kept, twin).status).toBe("out")

    const renamed = after(
      { type: "edit" as const, rowId: twin, column: "sku", value: "NEW-1" },
      { type: "keep" as const, rowId: copy.id }
    )
    expect(viewOf(renamed, twin).status).toBe("ready")
    expect(viewOf(renamed, twin).cells.sku).toBe("NEW-1")
  })

  it("leaving one copy out settles the other without asking again", () => {
    const copy = firstOf("copy")
    const rival = O.flatMap(
      O.flatMap(copy.problem, (problem) => problem.rivals),
      A.head
    )
    const hasRival = O.isSome(rival)
    assertTrue(hasRival)
    const twin = rival.value
    const state = after({ type: "leaveOut" as const, rowIds: [twin] })
    expect(viewOf(state, copy.id).status).toBe("ready")
  })

  it("a typed value is checked again by the caller's rule", () => {
    const cost = firstOf("cost")
    expect(
      viewOf(after({ type: "edit" as const, rowId: cost.id, column: "cost", value: "soon" }), cost.id).status
    ).toBe("needs")
    expect(
      viewOf(after({ type: "edit" as const, rowId: cost.id, column: "cost", value: "$4.10" }), cost.id).status
    ).toBe("ready")
  })
})

describe("one undo step per accept", () => {
  it("a group accept is one step, and undo restores every row it touched", () => {
    const accepted = run(emptyState, { type: "acceptGroup" as const, groupId: "unit:each", except: [] })
    expect(accepted.label).toBe("9 fixes accepted")
    expect(accepted.state.undo).toHaveLength(1)
    expect(count(views(accepted.state)).needs).toBe(33)
    const undone = run(accepted.state, { type: "undo" as const })
    expect(undone.state.undo).toHaveLength(0)
    expect(HashMap.size(undone.state.decisions)).toBe(0)
    expect(undone.changed).toHaveLength(9)
    expect(count(views(undone.state)).needs).toBe(42)
  })

  it("undo after keep puts the twin back as well", () => {
    const copy = firstOf("copy")
    const state = after({ type: "keep" as const, rowId: copy.id }, { type: "undo" as const })
    expect(count(views(state)).needs).toBe(42)
    expect(count(views(state)).out).toBe(0)
  })

  it("an action that fits no row adds no step", () => {
    const ready = A.findFirst(rows, (row) => O.isNone(row.problem))
    assertTrue(O.isSome(ready), "no ready row")
    expect(run(emptyState, { type: "accept" as const, rowIds: [ready.value.id] }).state).toBe(emptyState)
    expect(run(emptyState, { type: "undo" as const }).label).toBe("")
  })
})

describe("groups", () => {
  it("a group holds one change only, with a count per spelling", () => {
    const groups = waitingGroups({ views: views(emptyState), kind: O.some("unit") })
    expect(A.map(groups, (group) => [group.id, group.rowIds.length, group.by])).toEqual([
      ["unit:each", 9, O.some("rule")],
      ["unit:length", 3, O.some("model")]
    ])
    const firstGroup = A.head(groups)
    assertTrue(O.isSome(firstGroup), "expected a present test value")
    expect(firstGroup.value.variants).toEqual([
      { from: "ea", count: 6 },
      { from: "each", count: 3 }
    ])
  })

  it("accepting a group touches only its rows", () => {
    const before = views(emptyState)
    const outcome = run(emptyState, { type: "acceptGroup" as const, groupId: "unit:length", except: [] })
    const now = views(outcome.state)
    const moved = A.filter(now, (view, index) => {
      const previous = before[index]
      assertDefined(previous)
      return view.status !== previous.status
    })
    expect(
      A.map(moved, (view) =>
        O.flatMap(
          O.flatMap(view.row.problem, (problem) => problem.fix),
          (fix) => fix.group
        )
      )
    ).toEqual([O.some("unit:length"), O.some("unit:length"), O.some("unit:length")])
    expect(waitingGroups({ views: now, kind: O.some("unit") })).toHaveLength(1)
  })

  it("undoing a group of rule fixes turns its rows back into proposals, and accepting restores them", () => {
    const reverted = run(emptyState, { type: "revertGroup" as const, groupId: "unit:case:kg" })
    expect(reverted.label).toBe("8 fixes undone")
    const counts = count(views(reverted.state))
    expect([counts.needs, counts.ready, counts.applied]).toEqual([50, 128, 9])
    const again = run(reverted.state, { type: "acceptGroup" as const, groupId: "unit:case:kg", except: [] })
    // Taken back by the person, they count as the person's decisions, not as the rule's.
    expect(count(views(again.state)).applied).toBe(9)
    expect(A.filter(views(again.state), (view) => O.contains(view.decided, "accepted"))).toHaveLength(8)
    expect(count(views(again.state)).ready).toBe(136)
    expect(appliedGroups(views(again.state))).toHaveLength(2)
  })
})

describe("the import button and the queue", () => {
  it("names the blocker when a column has no match", () => {
    const counts = count(
      viewRows({
        columns,
        recheck: O.none(),
        fixable: fixableBy([]),
        rejects: false,
        rows: makeRows({ size: 178, withoutUnit: true }),
        state: emptyState
      })
    )
    expect(primary({ closing: O.none(), words: defaultReviewWords, columns: columnsUnmatched, counts, noun })).toEqual(
      Primary.Blocked({ label: "Match Unit to import", columnId: "unit" })
    )
  })

  it("moves to the next undecided row and wraps round", () => {
    const list = visible({ kind: O.none(), views: views(emptyState), filter: "all" })
    const first = nextProblem({ afterId: O.none(), back: false, list })
    const second = nextProblem({ back: false, list, afterId: first })
    expect(first).not.toEqual(second)
    expect(nextProblem({ list, afterId: second, back: true })).toEqual(first)
    const needs = visible({ kind: O.none(), views: views(emptyState), filter: "needs" })
    expect(nextProblem({ back: false, list: needs, afterId: O.map(A.last(needs), (view) => view.row.id) })).toEqual(
      O.map(A.head(needs), (view) => view.row.id)
    )
  })

  it("a problem kind narrows Needs you only", () => {
    const all = views(emptyState)
    expect(visible({ views: all, filter: "needs", kind: O.some("cost") })).toHaveLength(9)
    expect(visible({ views: all, filter: "ready", kind: O.some("cost") })).toHaveLength(136)
  })

  it("every answer to Why? in the gallery is 25 words or fewer", () => {
    const longest = A.reduce(rows, 0, (most, row) =>
      Math.max(
        most,
        ...A.map([...A.getSomes([O.flatMap(row.problem, (problem) => problem.fix)]), ...row.applied], (fix) =>
          whyWords(fix.why)
        )
      )
    )
    expect(longest).toBeLessThanOrEqual(25)
    expect(longest).toBeGreaterThan(0)
  })

  it("scales: 5,000 rows keep the same proportions", () => {
    const counts = count(
      viewRows({
        columns,
        recheck: O.none(),
        fixable: fixableBy([]),
        rejects: false,
        rows: makeRows({ size: 5000 }),
        state: emptyState
      })
    )
    expect(counts.needs + counts.ready).toBe(5000)
    expect(counts.needs).toBeGreaterThan(1100)
  })
})

describe("what the table and the phone show", () => {
  it("marks why a ready row is ready: fixed by a rule, or decided by the person", () => {
    const unit = firstOf("unit")
    const copy = firstOf("copy")
    const cost = firstOf("cost")
    const state = after(
      { type: "accept" as const, rowIds: [unit.id] },
      { type: "keep" as const, rowId: copy.id },
      { type: "edit" as const, rowId: cost.id, column: "cost", value: "$4.10" }
    )
    expect(viewOf(state, unit.id).decided).toEqual(O.some("accepted"))
    expect(viewOf(state, copy.id).decided).toEqual(O.some("kept"))
    expect(viewOf(state, cost.id).decided).toEqual(O.some("edited"))
    expect(A.filter(views(state), (view) => O.contains(view.decided, "auto"))).toHaveLength(17)
    expect(visible({ kind: O.none(), views: views(state), filter: "auto" })).toHaveLength(17)
  })

  it("puts each group's heading directly above its rows, and only its rows", () => {
    const all = views(emptyState)
    const list = visible({ views: all, filter: "needs", kind: O.some("unit") })
    const lines = entries({ applied: false, list, groups: waitingGroups({ views: all, kind: O.some("unit") }) })
    expect(
      A.join(
        A.map(lines, (line) => (Entry.guards.group(line) ? line.group.id : "row")),
        " "
      )
    ).toBe(A.join(["unit:each", ...A.makeBy(9, () => "row"), "unit:length", "row", "row", "row"], " "))
    expect(entries({ applied: false, list, groups: [] })).toHaveLength(12)
  })

  it("a low-confidence guess is a question with choices, and choosing for a group is one undo step", () => {
    const group = A.findFirst(
      waitingGroups({ kind: O.none(), views: views(emptyState) }),
      (candidate) => candidate.id === "unit:length"
    )
    assertTrue(O.isSome(group), "no group")
    expect(choicesOf(group.value)).toEqual(O.some(["m", "pcs"]))
    expect(group.value.why.basis).toMatch(/^\d+ other Bar rows in this file use m; 0 use pcs\.$/)
    const each = A.findFirst(
      waitingGroups({ kind: O.none(), views: views(emptyState) }),
      (candidate) => candidate.id === "unit:each"
    )
    assertTrue(O.isSome(each), "expected a present test value")
    expect(choicesOf(each.value)).toEqual(O.none())

    const chosen = run(emptyState, { type: "chooseGroup" as const, groupId: "unit:length", value: "pcs", except: [] })
    expect(chosen.label).toBe("3 rows set to pcs")
    expect(chosen.state.undo).toHaveLength(1)
    const firstRow = group.value.rowIds[0]
    assertDefined(firstRow)
    const row = viewOf(chosen.state, firstRow)
    expect([row.status, row.cells.unit, row.decided]).toEqual(["ready", "pcs", O.some("edited")])
    const proposed = run(emptyState, { type: "chooseGroup" as const, groupId: "unit:length", value: "m", except: [] })
    expect(viewOf(proposed.state, firstRow).decided).toEqual(O.some("accepted"))
  })

  it("the phone asks each thing once: a group is one decision until the person splits it", () => {
    const all = views(emptyState)
    const decisions = queue({ blocked: false, views: all, split: HashSet.empty() })
    expect(decisions).toHaveLength(2 + 30)
    expect(A.map(A.take(decisions, 2), (entry) => entry.type)).toEqual(["group", "group"])
    const split = queue({ blocked: false, views: all, split: HashSet.make("unit:length") })
    expect(split).toHaveLength(1 + 33)
  })
})

describe("the first screen and the confirm step", () => {
  it("opens grouped by problem kind: kinds with a fix to take are open, the others are one line", () => {
    const all = views(emptyState)
    const lines = sections({
      list: visible({ kind: O.none(), views: all, filter: "needs" }),
      groups: waitingGroups({ kind: O.none(), views: all }),
      problemKinds,
      collapsed: (_kind, hasGroups) => !hasGroups
    })
    expect(
      A.map(A.filter(lines, Entry.guards.kind), (line) =>
        Entry.guards.kind(line) ? `${line.kind.id} ${line.rowIds.length} ${line.collapsed}` : ""
      )
    ).toEqual(["unit 12 false", "cost 9 true", "copy 8 true", "below 7 true", "name 6 true"])
    expect(A.filter(lines, Entry.guards.row)).toHaveLength(12)
    expect(A.filter(lines, Entry.guards.group)).toHaveLength(2)
  })

  it("a group accept leaves out the rows the person unticked", () => {
    const group = A.findFirst(
      waitingGroups({ kind: O.none(), views: views(emptyState) }),
      (candidate) => candidate.id === "unit:each"
    )
    assertTrue(O.isSome(group), "no group")
    const unticked = group.value.rowIds[0]
    assertDefined(unticked)
    const outcome = run(emptyState, { type: "acceptGroup" as const, groupId: "unit:each", except: [unticked] })
    expect(outcome.label).toBe("8 fixes accepted")
    expect(viewOf(outcome.state, unticked).status).toBe("needs")
  })

  it("the confirm step counts what the import carries, and the file of held rows has a reason on every line", () => {
    const state = after(
      { type: "acceptGroup" as const, groupId: "unit:each", except: [] },
      { type: "leaveOut" as const, rowIds: [firstOf("cost").id] }
    )
    const summary = importSummary(views(state))
    expect(A.reduce(summary, 0, (sum, line) => sum + line.count)).toBe(145)
    expect(O.isSome(A.findFirst(summary, (line) => line.label === "Fixed by a rule"))).toBe(true)
    const csv = Str.split(heldCsv({ words: defaultReviewWords, views: views(state), columns, problemKinds }), "\n")
    expect(csv).toHaveLength(1 + 33)
    expect(csv[0]).toBe("Row,Reason,Item,SKU,Category,Unit,On hand,Reorder at,Cost,Supplier,Bin,Lead time")
    for (const line of A.drop(csv, 1)) {
      const reason = Str.split(line, ",")[1]
      assertDefined(reason)
      expect(reason).not.toBe("")
    }
  })
})

describe("the approved standards", () => {
  it("asks first by default: the rules' own fixes wait as proposals, and the counts still add up", () => {
    const start = proposing(rows)
    const counts = count(views(start))
    expect([counts.needs, counts.ready, counts.out, counts.applied]).toEqual([59, 119, 0, 0])
    const lines = sections({
      list: visible({ kind: O.none(), views: views(start), filter: "needs" }),
      groups: waitingGroups({ kind: O.none(), views: views(start) }),
      problemKinds,
      collapsed: () => false
    })
    const safe = A.flatMap(lines, (line) => (Entry.guards.kind(line) ? line.safe : []))
    expect(safe).toHaveLength(17)
    const taken = act({
      columns,
      fixable: fixableBy([]),
      rejects: false,
      rows,
      state: start,
      action: { type: "accept" as const, rowIds: safe },
      recheck: O.some(recheck)
    })
    expect(taken.label).toBe("17 fixes accepted")
    expect(taken.state.undo).toHaveLength(1)
    const now = count(views(taken.state))
    expect([now.needs, now.ready, now.out, now.applied]).toEqual([42, 136, 0, 0])
    expect(A.filter(views(taken.state), (view) => O.contains(view.decided, "accepted"))).toHaveLength(17)
    // "apply" mode is the empty state: the same 17 are in force on arrival and marked as the rule's.
    expect(A.filter(views(emptyState), (view) => O.contains(view.decided, "auto"))).toHaveLength(17)
  })

  it("the import result says who decided each change, with the basis and confidence of a fix", () => {
    const unit = firstOf("unit")
    const cost = firstOf("cost")
    const out = firstOf("below")
    const state = after(
      { type: "accept" as const, rowIds: [unit.id] },
      { type: "edit" as const, rowId: cost.id, column: "cost", value: "$4.10" },
      { type: "leaveOut" as const, rowIds: [out.id] }
    )
    const outcome = result({ words: defaultReviewWords, views: views(state), problemKinds })
    const changesOf = (rowId: string) => A.flatMap(outcome.ready, (row) => (row.id === rowId ? row.changes : []))
    expect(changesOf(unit.id)).toEqual([
      {
        column: "unit",
        from: unit.cells.unit,
        to: "pcs",
        source: "rule",
        decidedBy: "person",
        how: "accepted a proposal",
        basis: O.map(
          O.flatMap(unit.problem, (problem) => problem.fix),
          (fix) => fix.why.basis
        ),
        confidence: O.some("high")
      }
    ])
    expect(changesOf(cost.id)).toEqual([
      {
        column: "cost",
        from: "",
        to: "$4.10",
        source: "person",
        decidedBy: "person",
        how: "typed or chose a value",
        basis: O.none(),
        confidence: O.none()
      }
    ])
    const byRule = A.filter(
      A.flatMap(outcome.ready, (row) => row.changes),
      (change) => change.decidedBy === "rule"
    )
    expect(byRule).toHaveLength(17)
    expect(A.every(byRule, (change) => change.how === "applied by a rule" && O.isSome(change.basis))).toBe(true)
    expect(A.filter(outcome.held, (row) => row.decidedBy === "person")).toHaveLength(1)
    expect(A.filter(outcome.held, (row) => row.decidedBy === "nobody")).toHaveLength(39)
  })

  fx.effect("decisions survive a refresh: saved as plain data, through JSON, restored to the same screen state", () =>
    Effect.gen(function* () {
      const copy = firstOf("copy")
      const state = A.reduce(
        [
          { type: "acceptGroup" as const, groupId: "unit:each", except: [] },
          { type: "keep" as const, rowId: copy.id },
          { type: "edit" as const, rowId: firstOf("cost").id, column: "cost", value: "$4.10" },
          { type: "leaveOut" as const, rowIds: [firstOf("below").id] }
        ] satisfies ReadonlyArray<Action>,
        proposing(rows),
        (before, action) =>
          act({
            columns,
            fixable: fixableBy([]),
            rejects: false,
            rows,
            state: before,
            action,
            recheck: O.some(recheck)
          }).state
      )
      const Json = S.fromJsonString(S.Unknown)
      const text = yield* S.encodeEffect(Json)(saved(state))
      expect(typeof text).toBe("string")
      const back = restored((yield* S.decodeEffect(Json)(text)) as SavedDecisions)
      const shape = (given: ReviewState) =>
        A.map(views(given), (view) => [
          view.row.id,
          view.status,
          view.decided,
          O.map(view.problem, (problem) => problem.kind),
          view.cells
        ])
      expect(shape(back)).toEqual(shape(state))
      expect(count(views(back))).toEqual(count(views(state)))
      expect(back.undo).toHaveLength(0)
    })
  )
})

// The gallery's jobs with their lines (records with a parent): 9 lines need the person, on 8 of 24 jobs.
describe("records with a parent: label, choices, rowAction, and undo across views", () => {
  const jobs = makeJobs()
  const lines = questionRows(jobs, [])
  const lineViews = (state: ReviewState) =>
    viewRows({
      columns: lineColumns,
      fixable: fixableBy([]),
      rejects: false,
      rows: lines,
      state,
      recheck: O.some(recheckLine)
    })
  const lineRun = (state: ReviewState, action: Action) =>
    act({
      columns: lineColumns,
      fixable: fixableBy([]),
      rejects: false,
      rows: lines,
      state,
      action,
      recheck: O.some(recheckLine)
    })
  const lineOf = (kind: string): ReviewRow => {
    const row = A.findFirst(lines, (candidate) => O.exists(candidate.problem, (problem) => problem.kind === kind))
    assertTrue(O.isSome(row), `no ${kind} line in the gallery's jobs`)
    return row.value
  }
  const lineView = (state: ReviewState, rowId: string) => {
    const view = A.findFirst(lineViews(state), (candidate) => candidate.row.id === rowId)
    assertTrue(O.isSome(view), `no line ${rowId}`)
    return view.value
  }
  const extra = { label: "Leave job J-2045 out", onSelect: () => undefined }

  it("the sample has three kinds of question on its lines", () => {
    expect(lines).toHaveLength(9)
    expect(
      A.map(
        lineKinds,
        (kind) => A.filter(lines, (row) => O.exists(row.problem, (problem) => problem.kind === kind.id)).length
      )
    ).toEqual([3, 3, 3])
  })

  it("label: a group whose rows end in different values is named by its label, and each row takes its own value", () => {
    const group = A.findFirst(
      waitingGroups({ kind: O.none(), views: lineViews(emptyState) }),
      (found) => found.id === "qty:comma"
    )
    assertTrue(O.isSome(group), "no comma group")
    expect([group.value.label, group.value.rowIds.length]).toEqual([O.some("a decimal point"), 3])
    expect(groupUse({ group: group.value, n: 3, ticks: true })).toBe("Use a decimal point for the 3 ticked")
    // Where each row keeps its own answers (`rowAction`) there is no tick: the button acts on all of them.
    expect(groupUse({ group: group.value, n: 3, ticks: false })).toBe("Use a decimal point for all 3")
    const unit = A.findFirst(
      waitingGroups({ kind: O.none(), views: views(emptyState) }),
      (found) => found.id === "unit:each"
    )
    assertTrue(O.isSome(unit), "no unit group")
    expect(groupUse({ group: unit.value, n: 9, ticks: true })).toBe("Use pcs for the 9 ticked")

    const taken = lineRun(emptyState, { type: "acceptGroup" as const, groupId: "qty:comma", except: [] })
    expect(taken.state.undo).toHaveLength(1)
    expect(A.map(group.value.rowIds, (rowId) => lineView(taken.state, rowId).cells.qty)).toEqual([
      "1.5",
      "2.25",
      "0.75"
    ])
    // One value typed for the whole group is that value on every row: accepted where it is the row's own proposal.
    const chosen = lineRun(emptyState, { type: "chooseGroup" as const, groupId: "qty:comma", value: "1.5", except: [] })
    expect(
      A.map(group.value.rowIds, (rowId) => {
        const view = lineView(chosen.state, rowId)
        assertTrue(O.isSome(view.decided), "a chosen value has a decision")
        return `${view.cells.qty} ${view.decided.value}`
      })
    ).toEqual(["1.5 accepted", "1.5 edited", "1.5 edited"])
  })

  it("choices: nothing is proposed or picked for the person, and a pick is the person's own value", () => {
    const unit = lineOf("unit")
    const before = lineView(emptyState, unit.id)
    expect([before.status, before.cells.unit, before.marks.unit]).toEqual(["needs", "length", undefined])
    expect(HashMap.size(proposing(lines).decisions)).toBe(0)
    // A pick is never one of the group decisions, so it is never the screen's one filled button.
    expect(
      A.some(waitingGroups({ kind: O.none(), views: lineViews(emptyState) }), (group) => group.rowIds.includes(unit.id))
    ).toBe(false)
    const picked = lineRun(emptyState, { type: "edit" as const, rowId: unit.id, column: "unit", value: "pcs" })
    const after = lineView(picked.state, unit.id)
    expect([
      after.status,
      after.cells.unit,
      after.decided,
      O.map(pickedChoice(after), (choice) => choice.value)
    ]).toEqual(["ready", "pcs", O.some("edited"), O.some("pcs")])
    const change = A.findFirst(
      result({ words: defaultReviewWords, views: lineViews(picked.state), problemKinds: lineKinds }).ready,
      (row) => row.id === unit.id
    )
    assertTrue(O.isSome(change), "expected a present test value")
    expect(change.value.changes).toEqual([
      {
        column: "unit",
        from: "length",
        to: "pcs",
        source: "person",
        decidedBy: "person",
        how: "typed or chose a value",
        basis: O.none(),
        confidence: O.none()
      }
    ])
    // A typed value that is not one of the choices is an edit, not a pick.
    const typed = lineRun(emptyState, { type: "edit" as const, rowId: unit.id, column: "unit", value: "kg" })
    expect(pickedChoice(lineView(typed.state, unit.id))).toEqual(O.none())
  })

  it("a suggested choice says so in words, with its reason, and is the only thing that marks it", () => {
    const picked = O.flatMap(lineOf("unit").problem, (problem) => problem.choices)
    const hasChoices = O.isSome(picked)
    assertTrue(hasChoices)
    const choices = picked.value
    expect(A.map(choices, choiceText)).toEqual(["m, as 13 of 13 lines with this SKU say (suggested)", "pcs"])
    expect(A.filter(choices, (choice) => choice.suggested === true)).toHaveLength(1)
    expect(
      choiceText(Choice.make({ value: "40", label: "40 L", note: O.some("as 6 of 7 lines say"), suggested: true }))
    ).toBe("40 L, as 6 of 7 lines say (suggested)")
    expect(choiceText(Choice.make({ value: "40", label: "40 L", suggested: true }))).toBe("40 L (suggested)")
  })

  it("rowAction: a row keeps its own answer, then typing (beside a fix), leaving the row out and the page's answer", () => {
    const at = (kind: string) => lineView(emptyState, lineOf(kind).id)
    expect(otherAnswers({ view: at("comma"), extra: O.some(extra) })).toEqual(
      O.some([
        OtherAnswer.Type(),
        OtherAnswer.LeaveOut({ label: `Leave row ${lineOf("comma").line} out` }),
        OtherAnswer.Extra({ label: "Leave job J-2045 out" })
      ])
    )
    // A pick and a row with nothing proposed have no typing among the others: the first is chosen, the second typed.
    expect(otherAnswers({ view: at("unit"), extra: O.some(extra) })).toEqual(
      O.some([
        OtherAnswer.LeaveOut({ label: `Leave row ${lineOf("unit").line} out` }),
        OtherAnswer.Extra({ label: "Leave job J-2045 out" })
      ])
    )
    expect(otherAnswers({ view: at("stock"), extra: O.some(extra) })).toEqual(
      O.some([
        OtherAnswer.LeaveOut({ label: `Leave row ${lineOf("stock").line} out` }),
        OtherAnswer.Extra({ label: "Leave job J-2045 out" })
      ])
    )
    // Without the page's answer, and on a row that is ready, there is nothing more: "Leave out" as before.
    expect(otherAnswers({ view: at("comma"), extra: O.none() })).toEqual(O.none())
    const done = lineRun(emptyState, { type: "acceptGroup" as const, groupId: "qty:comma", except: [] }).state
    expect(otherAnswers({ view: lineView(done, lineOf("comma").id), extra: O.some(extra) })).toEqual(O.none())
  })

  it("undo survives the decisions being kept as a draft and started from again", () => {
    const state = A.reduce(
      [
        { type: "acceptGroup" as const, groupId: "qty:comma", except: [] },
        { type: "edit" as const, rowId: lineOf("unit").id, column: "unit", value: "m" }
      ] satisfies ReadonlyArray<Action>,
      emptyState,
      (before, action) => lineRun(before, action).state
    )
    // The page kept the review as plain data (a refresh, a closed tab) and starts the region from it again.
    const again = fromDraft(toDraft(state))
    expect(again.undo).toHaveLength(2)
    const undone = lineRun(again, { type: "undo" as const })
    expect(undone.label).toBe("Undone: Value changed")
    expect(lineView(undone.state, lineOf("unit").id).status).toBe("needs")
    expect(lineView(undone.state, lineOf("comma").id).cells.qty).toBe("1.5")
    // The decisions alone are plain data: the same decisions, and a new history.
    const copy = restored(saved(state))
    expect([HashMap.size(copy.decisions), copy.undo.length]).toEqual([HashMap.size(state.decisions), 0])
  })

  it("the page counts the jobs from the person's answers, not the region", () => {
    const tally = (state: ReviewState, leftOut: ReadonlyArray<string>) =>
      A.map(reviewJobs({ jobs, decisions: saved(state), leftOut }), (review) => review.status)
    const statuses = (list: ReadonlyArray<string>) => [
      A.filter(list, (status) => status === "ready").length,
      A.filter(list, (status) => status === "waiting").length
    ]
    expect(statuses(tally(emptyState, []))).toEqual([16, 8])
    const comma = lineRun(emptyState, { type: "acceptGroup" as const, groupId: "qty:comma", except: [] }).state
    expect(statuses(tally(comma, []))).toEqual([19, 5])
    const out = tally(emptyState, ["J-2045"])
    expect([...statuses(out), A.filter(out, (status) => status === "out").length]).toEqual([16, 7, 1])
    expect(questionRows(jobs, ["J-2045"])).toHaveLength(7)
  })
})

describe("a model's weak guess", () => {
  it("is never a row's one-press answer: only a model's low guess is held back for typing", () => {
    expect(weakGuess({ by: O.some("model"), confidence: O.some("low") })).toBe(true)
    expect(weakGuess({ by: O.some("model"), confidence: O.some("medium") })).toBe(false)
    // A rule's low proposal is a question with two readings, answered by a press: it stays one.
    expect(weakGuess({ by: O.some("rule"), confidence: O.some("low") })).toBe(false)
  })
})

describe("a quantity in the review", () => {
  it("is shown in its row's unit, and only a plain number takes one", () => {
    const onHand = { display: identity, unitFrom: O.some("uom") }
    expect(shownWith(onHand, "120", totalCells([], { uom: "EA" }))).toBe("120 EA")
    expect(shownWith(onHand, "1,250", totalCells([], { uom: "BX" }))).toBe("1,250 BX")
    // A value that does not read stays as the file has it, so the person sees what is wrong with it.
    expect(shownWith(onHand, "12 boxes", totalCells([], { uom: "BX" }))).toBe("12 boxes")
    expect(shownWith(onHand, "", totalCells([], { uom: "EA" }))).toBe("")
    expect(shownWith(onHand, "4", totalCells([], { uom: "" }))).toBe("4")
  })
})
