import { it as fx } from "@effect/vitest"
import { Array as Arr, Effect, HashMap, HashSet, Option, Schema, String as Str } from "effect"
import { describe, expect, it } from "vitest"
import {
  act,
  type Action,
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
  primary,
  proposing,
  restored,
  queue,
  sections,
  result,
  saved,
  viewRows,
  visible,
  waitingGroups,
  weakGuess,
  whyWords
} from "../../src/web/components/review/logic.ts"
import type { ReviewRow, ReviewState, SavedDecisions } from "../../src/web/components/review/types.ts"
import { columns, columnsUnmatched, makeRows, problemKinds, recheck } from "../../src/web/pages/gallery/fabrication.ts"
import { lineKinds, makeJobs, questionRows, recheckLine, reviewJobs } from "../../src/web/pages/gallery/jobs.ts"

// The gallery's made-up stock file drives these tests: 178 rows, 136 ready, 42 that need the person.
const rows = makeRows({ size: 178 })
const noun = ["item", "items"] as const

const views = (state: ReviewState) => viewRows({ rows, state, recheck })
const run = (state: ReviewState, action: Action) => act({ rows, state, action, recheck })
const after = (...actions: ReadonlyArray<Action>): ReviewState =>
  Arr.reduce(actions, emptyState, (state, action) => run(state, action).state)
const firstOf = (kind: string): ReviewRow => {
  const row = Arr.findFirst(rows, (candidate) => candidate.problem?.kind === kind)
  if (row._tag === "None") throw new Error(`no ${kind} row in the gallery file`)
  return row.value
}
const viewOf = (state: ReviewState, rowId: string) => {
  const view = Arr.findFirst(views(state), (candidate) => candidate.row.id === rowId)
  if (view._tag === "None") throw new Error(`no row ${rowId}`)
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
      after({ type: "accept", rowIds: [unit.id] }),
      after({ type: "acceptGroup", groupId: "unit:each" }, { type: "leaveOut", rowIds: [cost.id] }),
      after({ type: "keep", rowId: copy.id }, { type: "revertGroup", groupId: "unit:case:kg" }),
      after({ type: "edit", rowId: cost.id, column: "cost", value: "$4.10" }, { type: "undo" })
    ]
    for (const state of states) {
      const counts = count(views(state))
      expect(counts.needs + counts.ready + counts.out).toBe(counts.total)
      expect(Arr.reduce([...HashMap.values(counts.kinds)], 0, (sum, n) => sum + n)).toBe(counts.needs)
    }
  })

  it("the button's number is the Ready count, and the held line is everything else", () => {
    const state = after(
      { type: "acceptGroup", groupId: "unit:each" },
      { type: "leaveOut", rowIds: [firstOf("cost").id] }
    )
    const counts = count(views(state))
    expect(primary({ columns, counts, noun })).toEqual({ label: `Import ${counts.ready} items`, blocked: false })
    expect(counts.ready).toBe(145)
    // Each count under the word its tab says, so the line and the tabs never disagree.
    expect(heldLine(counts)).toBe("33 won't be imported: Needs a decision 32, Left out 1")
    expect(confirmLine({ counts, noun })).toBe(
      "33 items won't be imported (Needs a decision 32, Left out 1). Your file is not changed."
    )
    expect(result({ views: views(state), problemKinds }).ready).toHaveLength(145)
  })

  it("says so when nothing is held", () => {
    const clean = viewRows({ rows: makeRows({ size: 178, clean: true }), state: emptyState })
    expect(heldLine(count(clean))).toBe("All 178 ready")
    expect(primary({ columns, counts: count(clean), noun }).label).toBe("Import 178 items")
  })
})

describe("a proposal never overwrites the person's decision", () => {
  it("a group accept skips a row the person typed a value into, and a row they left out", () => {
    const group = Arr.findFirst(
      waitingGroups({ views: views(emptyState) }),
      (candidate) => candidate.id === "unit:each"
    )
    if (group._tag === "None") throw new Error("no group")
    const [typed, left] = group.value.rowIds
    if (typed === undefined || left === undefined) throw new Error("group too small")
    const state = after(
      { type: "edit", rowId: typed, column: "unit", value: "kg" },
      { type: "leaveOut", rowIds: [left] },
      { type: "acceptGroup", groupId: "unit:each" }
    )
    expect(viewOf(state, typed).cells.unit).toBe("kg")
    expect(viewOf(state, typed).marks.unit).toMatchObject({ state: "applied", by: "you", to: "kg" })
    expect(viewOf(state, left).status).toBe("out")
    expect(Option.getOrUndefined(HashMap.get(state.decisions, left))?.accepted).toBeUndefined()
    expect(state.undo[state.undo.length - 1]?.label).toBe("7 fixes accepted")
  })

  it("keeping one copy leaves its twin out, but not a twin the person already gave a new SKU", () => {
    const copy = firstOf("copy")
    const twin = copy.problem?.rivals?.[0] ?? ""
    const kept = after({ type: "keep", rowId: copy.id })
    expect(viewOf(kept, copy.id).status).toBe("ready")
    expect(viewOf(kept, twin).status).toBe("out")

    const renamed = after(
      { type: "edit", rowId: twin, column: "sku", value: "NEW-1" },
      { type: "keep", rowId: copy.id }
    )
    expect(viewOf(renamed, twin).status).toBe("ready")
    expect(viewOf(renamed, twin).cells.sku).toBe("NEW-1")
  })

  it("leaving one copy out settles the other without asking again", () => {
    const copy = firstOf("copy")
    const twin = copy.problem?.rivals?.[0] ?? ""
    const state = after({ type: "leaveOut", rowIds: [twin] })
    expect(viewOf(state, copy.id).status).toBe("ready")
  })

  it("a typed value is checked again by the caller's rule", () => {
    const cost = firstOf("cost")
    expect(viewOf(after({ type: "edit", rowId: cost.id, column: "cost", value: "soon" }), cost.id).status).toBe("needs")
    expect(viewOf(after({ type: "edit", rowId: cost.id, column: "cost", value: "$4.10" }), cost.id).status).toBe(
      "ready"
    )
  })
})

describe("one undo step per accept", () => {
  it("a group accept is one step, and undo restores every row it touched", () => {
    const accepted = run(emptyState, { type: "acceptGroup", groupId: "unit:each" })
    expect(accepted.label).toBe("9 fixes accepted")
    expect(accepted.state.undo).toHaveLength(1)
    expect(count(views(accepted.state)).needs).toBe(33)
    const undone = run(accepted.state, { type: "undo" })
    expect(undone.state.undo).toHaveLength(0)
    expect(HashMap.size(undone.state.decisions)).toBe(0)
    expect(undone.changed).toHaveLength(9)
    expect(count(views(undone.state)).needs).toBe(42)
  })

  it("undo after keep puts the twin back as well", () => {
    const copy = firstOf("copy")
    const state = after({ type: "keep", rowId: copy.id }, { type: "undo" })
    expect(count(views(state)).needs).toBe(42)
    expect(count(views(state)).out).toBe(0)
  })

  it("an action that fits no row adds no step", () => {
    const ready = Arr.findFirst(rows, (row) => row.problem === undefined)
    if (ready._tag === "None") throw new Error("no ready row")
    expect(run(emptyState, { type: "accept", rowIds: [ready.value.id] }).state).toBe(emptyState)
    expect(run(emptyState, { type: "undo" }).label).toBe("")
  })
})

describe("groups", () => {
  it("a group holds one change only, with a count per spelling", () => {
    const groups = waitingGroups({ views: views(emptyState), kind: "unit" })
    expect(Arr.map(groups, (group) => [group.id, group.rowIds.length, group.by])).toEqual([
      ["unit:each", 9, "rule"],
      ["unit:length", 3, "model"]
    ])
    expect(groups[0]?.variants).toEqual([
      { from: "ea", count: 6 },
      { from: "each", count: 3 }
    ])
  })

  it("accepting a group touches only its rows", () => {
    const before = views(emptyState)
    const outcome = run(emptyState, { type: "acceptGroup", groupId: "unit:length" })
    const now = views(outcome.state)
    const moved = Arr.filter(now, (view, index) => view.status !== before[index]?.status)
    expect(Arr.map(moved, (view) => view.row.problem?.fix?.group)).toEqual([
      "unit:length",
      "unit:length",
      "unit:length"
    ])
    expect(waitingGroups({ views: now, kind: "unit" })).toHaveLength(1)
  })

  it("undoing a group of rule fixes turns its rows back into proposals, and accepting restores them", () => {
    const reverted = run(emptyState, { type: "revertGroup", groupId: "unit:case:kg" })
    expect(reverted.label).toBe("8 fixes undone")
    const counts = count(views(reverted.state))
    expect([counts.needs, counts.ready, counts.applied]).toEqual([50, 128, 9])
    const again = run(reverted.state, { type: "acceptGroup", groupId: "unit:case:kg" })
    // Taken back by the person, they count as the person's decisions, not as the rule's.
    expect(count(views(again.state)).applied).toBe(9)
    expect(Arr.filter(views(again.state), (view) => view.decided === "accepted")).toHaveLength(8)
    expect(count(views(again.state)).ready).toBe(136)
    expect(appliedGroups(views(again.state))).toHaveLength(2)
  })
})

describe("the import button and the queue", () => {
  it("names the blocker when a column has no match", () => {
    const counts = count(viewRows({ rows: makeRows({ size: 178, withoutUnit: true }), state: emptyState }))
    expect(primary({ columns: columnsUnmatched, counts, noun })).toEqual({
      label: "Match Unit to import",
      blocked: true,
      columnId: "unit"
    })
  })

  it("moves to the next undecided row and wraps round", () => {
    const list = visible({ views: views(emptyState), filter: "all" })
    const first = nextProblem({ list })
    const second = nextProblem({ list, afterId: first })
    expect(first).not.toBe(second)
    expect(nextProblem({ list, afterId: second, back: true })).toBe(first)
    const needs = visible({ views: views(emptyState), filter: "needs" })
    expect(nextProblem({ list: needs, afterId: needs[needs.length - 1]?.row.id })).toBe(needs[0]?.row.id)
  })

  it("a problem kind narrows Needs you only", () => {
    const all = views(emptyState)
    expect(visible({ views: all, filter: "needs", kind: "cost" })).toHaveLength(9)
    expect(visible({ views: all, filter: "ready", kind: "cost" })).toHaveLength(136)
  })

  it("every answer to Why? in the gallery is 25 words or fewer", () => {
    const longest = Arr.reduce(rows, 0, (most, row) =>
      Math.max(
        most,
        ...Arr.map([row.problem?.fix, ...(row.applied ?? [])], (fix) => (fix === undefined ? 0 : whyWords(fix.why)))
      )
    )
    expect(longest).toBeLessThanOrEqual(25)
    expect(longest).toBeGreaterThan(0)
  })

  it("scales: 5,000 rows keep the same proportions", () => {
    const counts = count(viewRows({ rows: makeRows({ size: 5000 }), state: emptyState }))
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
      { type: "accept", rowIds: [unit.id] },
      { type: "keep", rowId: copy.id },
      { type: "edit", rowId: cost.id, column: "cost", value: "$4.10" }
    )
    expect(viewOf(state, unit.id).decided).toBe("accepted")
    expect(viewOf(state, copy.id).decided).toBe("kept")
    expect(viewOf(state, cost.id).decided).toBe("edited")
    expect(Arr.filter(views(state), (view) => view.decided === "auto")).toHaveLength(17)
    expect(visible({ views: views(state), filter: "auto" })).toHaveLength(17)
  })

  it("puts each group's heading directly above its rows, and only its rows", () => {
    const all = views(emptyState)
    const list = visible({ views: all, filter: "needs", kind: "unit" })
    const lines = entries({ list, groups: waitingGroups({ views: all, kind: "unit" }) })
    expect(
      Arr.join(
        Arr.map(lines, (line) => (line.type === "group" ? line.group.id : "row")),
        " "
      )
    ).toBe(Arr.join(["unit:each", ...Arr.makeBy(9, () => "row"), "unit:length", "row", "row", "row"], " "))
    expect(entries({ list, groups: [] })).toHaveLength(12)
  })

  it("a low-confidence guess is a question with choices, and choosing for a group is one undo step", () => {
    const group = Arr.findFirst(
      waitingGroups({ views: views(emptyState) }),
      (candidate) => candidate.id === "unit:length"
    )
    if (group._tag === "None") throw new Error("no group")
    expect(choicesOf(group.value)).toEqual(["m", "pcs"])
    expect(group.value.why.basis).toMatch(/^\d+ other Bar rows in this file use m; 0 use pcs\.$/)
    const each = Arr.findFirst(waitingGroups({ views: views(emptyState) }), (candidate) => candidate.id === "unit:each")
    expect(each._tag === "Some" ? choicesOf(each.value) : "missing").toBeUndefined()

    const chosen = run(emptyState, { type: "chooseGroup", groupId: "unit:length", value: "pcs" })
    expect(chosen.label).toBe("3 rows set to pcs")
    expect(chosen.state.undo).toHaveLength(1)
    const row = viewOf(chosen.state, group.value.rowIds[0] ?? "")
    expect([row.status, row.cells.unit, row.decided]).toEqual(["ready", "pcs", "edited"])
    const proposed = run(emptyState, { type: "chooseGroup", groupId: "unit:length", value: "m" })
    expect(viewOf(proposed.state, group.value.rowIds[0] ?? "").decided).toBe("accepted")
  })

  it("the phone asks each thing once: a group is one decision until the person splits it", () => {
    const all = views(emptyState)
    const decisions = queue({ views: all, split: HashSet.empty() })
    expect(decisions).toHaveLength(2 + 30)
    expect(Arr.map(Arr.take(decisions, 2), (entry) => entry.type)).toEqual(["group", "group"])
    const split = queue({ views: all, split: HashSet.make("unit:length") })
    expect(split).toHaveLength(1 + 33)
  })
})

describe("the first screen and the confirm step", () => {
  it("opens grouped by problem kind: kinds with a fix to take are open, the others are one line", () => {
    const all = views(emptyState)
    const lines = sections({
      list: visible({ views: all, filter: "needs" }),
      groups: waitingGroups({ views: all }),
      problemKinds,
      collapsed: (_kind, hasGroups) => !hasGroups
    })
    expect(
      Arr.map(
        Arr.filter(lines, (line) => line.type === "kind"),
        (line) => (line.type === "kind" ? `${line.kind.id} ${line.rowIds.length} ${line.collapsed}` : "")
      )
    ).toEqual(["unit 12 false", "cost 9 true", "copy 8 true", "below 7 true", "name 6 true"])
    expect(Arr.filter(lines, (line) => line.type === "row")).toHaveLength(12)
    expect(Arr.filter(lines, (line) => line.type === "group")).toHaveLength(2)
  })

  it("a group accept leaves out the rows the person unticked", () => {
    const group = Arr.findFirst(
      waitingGroups({ views: views(emptyState) }),
      (candidate) => candidate.id === "unit:each"
    )
    if (group._tag === "None") throw new Error("no group")
    const unticked = group.value.rowIds[0] ?? ""
    const outcome = run(emptyState, { type: "acceptGroup", groupId: "unit:each", except: [unticked] })
    expect(outcome.label).toBe("8 fixes accepted")
    expect(viewOf(outcome.state, unticked).status).toBe("needs")
  })

  it("the confirm step counts what the import carries, and the file of held rows has a reason on every line", () => {
    const state = after(
      { type: "acceptGroup", groupId: "unit:each" },
      { type: "leaveOut", rowIds: [firstOf("cost").id] }
    )
    const summary = importSummary(views(state))
    expect(Arr.reduce(summary, 0, (sum, line) => sum + line.count)).toBe(145)
    expect(Arr.findFirst(summary, (line) => line.label === "Fixed by a rule")._tag).toBe("Some")
    const csv = Str.split(heldCsv({ views: views(state), columns, problemKinds }), "\n")
    expect(csv).toHaveLength(1 + 33)
    expect(csv[0]).toBe("Row,Reason,Item,SKU,Category,Unit,On hand,Reorder at,Cost,Supplier,Bin,Lead time")
    expect(Arr.every(Arr.drop(csv, 1), (line) => (Str.split(line, ",")[1] ?? "") !== "")).toBe(true)
  })
})

describe("the approved standards", () => {
  it("asks first by default: the rules' own fixes wait as proposals, and the counts still add up", () => {
    const start = proposing(rows)
    const counts = count(views(start))
    expect([counts.needs, counts.ready, counts.out, counts.applied]).toEqual([59, 119, 0, 0])
    const lines = sections({
      list: visible({ views: views(start), filter: "needs" }),
      groups: waitingGroups({ views: views(start) }),
      problemKinds,
      collapsed: () => false
    })
    const safe = Arr.flatMap(lines, (line) => (line.type === "kind" ? line.safe : []))
    expect(safe).toHaveLength(17)
    const taken = act({ rows, state: start, action: { type: "accept", rowIds: safe }, recheck })
    expect(taken.label).toBe("17 fixes accepted")
    expect(taken.state.undo).toHaveLength(1)
    const now = count(views(taken.state))
    expect([now.needs, now.ready, now.out, now.applied]).toEqual([42, 136, 0, 0])
    expect(Arr.filter(views(taken.state), (view) => view.decided === "accepted")).toHaveLength(17)
    // "apply" mode is the empty state: the same 17 are in force on arrival and marked as the rule's.
    expect(Arr.filter(views(emptyState), (view) => view.decided === "auto")).toHaveLength(17)
  })

  it("the import result says who decided each change, with the basis and confidence of a fix", () => {
    const unit = firstOf("unit")
    const cost = firstOf("cost")
    const out = firstOf("below")
    const state = after(
      { type: "accept", rowIds: [unit.id] },
      { type: "edit", rowId: cost.id, column: "cost", value: "$4.10" },
      { type: "leaveOut", rowIds: [out.id] }
    )
    const outcome = result({ views: views(state), problemKinds })
    const changesOf = (rowId: string) => Arr.flatMap(outcome.ready, (row) => (row.id === rowId ? row.changes : []))
    expect(changesOf(unit.id)).toEqual([
      {
        column: "unit",
        from: unit.cells.unit,
        to: "pcs",
        source: "rule",
        decidedBy: "person",
        how: "accepted a proposal",
        basis: unit.problem?.fix?.why.basis,
        confidence: "high"
      }
    ])
    expect(changesOf(cost.id)).toEqual([
      { column: "cost", from: "", to: "$4.10", source: "person", decidedBy: "person", how: "typed or chose a value" }
    ])
    const byRule = Arr.filter(
      Arr.flatMap(outcome.ready, (row) => row.changes),
      (change) => change.decidedBy === "rule"
    )
    expect(byRule).toHaveLength(17)
    expect(Arr.every(byRule, (change) => change.how === "applied by a rule" && change.basis !== undefined)).toBe(true)
    expect(Arr.filter(outcome.held, (row) => row.decidedBy === "person")).toHaveLength(1)
    expect(Arr.filter(outcome.held, (row) => row.decidedBy === "nobody")).toHaveLength(39)
  })

  fx.effect("decisions survive a refresh: saved as plain data, through JSON, restored to the same screen state", () =>
    Effect.gen(function* () {
      const copy = firstOf("copy")
      const state = Arr.reduce(
        [
          { type: "acceptGroup", groupId: "unit:each" },
          { type: "keep", rowId: copy.id },
          { type: "edit", rowId: firstOf("cost").id, column: "cost", value: "$4.10" },
          { type: "leaveOut", rowIds: [firstOf("below").id] }
        ] satisfies ReadonlyArray<Action>,
        proposing(rows),
        (before, action) => act({ rows, state: before, action, recheck }).state
      )
      const Json = Schema.fromJsonString(Schema.Unknown)
      const text = yield* Schema.encodeEffect(Json)(saved(state))
      expect(typeof text).toBe("string")
      const back = restored((yield* Schema.decodeEffect(Json)(text)) as SavedDecisions)
      const shape = (given: ReviewState) =>
        Arr.map(views(given), (view) => [
          view.row.id,
          view.status,
          view.decided ?? "",
          view.problem?.kind ?? "",
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
  const lineViews = (state: ReviewState) => viewRows({ rows: lines, state, recheck: recheckLine })
  const lineRun = (state: ReviewState, action: Action) => act({ rows: lines, state, action, recheck: recheckLine })
  const lineOf = (kind: string): ReviewRow => {
    const row = Arr.findFirst(lines, (candidate) => candidate.problem?.kind === kind)
    if (row._tag === "None") throw new Error(`no ${kind} line in the gallery's jobs`)
    return row.value
  }
  const lineView = (state: ReviewState, rowId: string) => {
    const view = Arr.findFirst(lineViews(state), (candidate) => candidate.row.id === rowId)
    if (view._tag === "None") throw new Error(`no line ${rowId}`)
    return view.value
  }
  const extra = { label: "Leave job J-2045 out", onSelect: () => undefined }

  it("the sample has three kinds of question on its lines", () => {
    expect(lines).toHaveLength(9)
    expect(Arr.map(lineKinds, (kind) => Arr.filter(lines, (row) => row.problem?.kind === kind.id).length)).toEqual([
      3, 3, 3
    ])
  })

  it("label: a group whose rows end in different values is named by its label, and each row takes its own value", () => {
    const group = Arr.findFirst(waitingGroups({ views: lineViews(emptyState) }), (found) => found.id === "qty:comma")
    if (group._tag === "None") throw new Error("no comma group")
    expect([group.value.label, group.value.rowIds.length]).toEqual(["a decimal point", 3])
    expect(groupUse({ group: group.value, n: 3, ticks: true })).toBe("Use a decimal point for the 3 ticked")
    // Where each row keeps its own answers (`rowAction`) there is no tick: the button acts on all of them.
    expect(groupUse({ group: group.value, n: 3, ticks: false })).toBe("Use a decimal point for all 3")
    const unit = Arr.findFirst(waitingGroups({ views: views(emptyState) }), (found) => found.id === "unit:each")
    if (unit._tag === "None") throw new Error("no unit group")
    expect(groupUse({ group: unit.value, n: 9, ticks: true })).toBe("Use pcs for the 9 ticked")

    const taken = lineRun(emptyState, { type: "acceptGroup", groupId: "qty:comma" })
    expect(taken.state.undo).toHaveLength(1)
    expect(Arr.map(group.value.rowIds, (rowId) => lineView(taken.state, rowId).cells.qty)).toEqual([
      "1.5",
      "2.25",
      "0.75"
    ])
    // One value typed for the whole group is that value on every row: accepted where it is the row's own proposal.
    const chosen = lineRun(emptyState, { type: "chooseGroup", groupId: "qty:comma", value: "1.5" })
    expect(
      Arr.map(group.value.rowIds, (rowId) => {
        const view = lineView(chosen.state, rowId)
        return `${view.cells.qty} ${view.decided ?? ""}`
      })
    ).toEqual(["1.5 accepted", "1.5 edited", "1.5 edited"])
  })

  it("choices: nothing is proposed or picked for the person, and a pick is the person's own value", () => {
    const unit = lineOf("unit")
    const before = lineView(emptyState, unit.id)
    expect([before.status, before.cells.unit, before.marks.unit]).toEqual(["needs", "length", undefined])
    expect(HashMap.size(proposing(lines).decisions)).toBe(0)
    // A pick is never one of the group decisions, so it is never the screen's one filled button.
    expect(Arr.some(waitingGroups({ views: lineViews(emptyState) }), (group) => group.rowIds.includes(unit.id))).toBe(
      false
    )
    const picked = lineRun(emptyState, { type: "edit", rowId: unit.id, column: "unit", value: "pcs" })
    const after = lineView(picked.state, unit.id)
    expect([after.status, after.cells.unit, after.decided, pickedChoice(after)?.value]).toEqual([
      "ready",
      "pcs",
      "edited",
      "pcs"
    ])
    const change = Arr.findFirst(
      result({ views: lineViews(picked.state), problemKinds: lineKinds }).ready,
      (row) => row.id === unit.id
    )
    expect(change._tag === "Some" ? change.value.changes : []).toEqual([
      {
        column: "unit",
        from: "length",
        to: "pcs",
        source: "person",
        decidedBy: "person",
        how: "typed or chose a value"
      }
    ])
    // A typed value that is not one of the choices is an edit, not a pick.
    const typed = lineRun(emptyState, { type: "edit", rowId: unit.id, column: "unit", value: "kg" })
    expect(pickedChoice(lineView(typed.state, unit.id))).toBeUndefined()
  })

  it("a suggested choice says so in words, with its reason, and is the only thing that marks it", () => {
    const choices = lineOf("unit").problem?.choices ?? []
    expect(Arr.map(choices, choiceText)).toEqual(["m, as 13 of 13 lines with this SKU say (suggested)", "pcs"])
    expect(Arr.filter(choices, (choice) => choice.suggested === true)).toHaveLength(1)
    expect(choiceText({ value: "40", label: "40 L", note: "as 6 of 7 lines say", suggested: true })).toBe(
      "40 L, as 6 of 7 lines say (suggested)"
    )
    expect(choiceText({ value: "40", label: "40 L", suggested: true })).toBe("40 L (suggested)")
  })

  it("rowAction: a row keeps its own answer, then typing (beside a fix), leaving the row out and the page's answer", () => {
    const at = (kind: string) => lineView(emptyState, lineOf(kind).id)
    expect(otherAnswers({ view: at("comma"), extra })).toEqual([
      { type: "type" },
      { type: "leaveOut", label: `Leave row ${lineOf("comma").line} out` },
      { type: "action", label: "Leave job J-2045 out" }
    ])
    // A pick and a row with nothing proposed have no typing among the others: the first is chosen, the second typed.
    expect(Arr.map(otherAnswers({ view: at("unit"), extra }) ?? [], (answer) => answer.type)).toEqual([
      "leaveOut",
      "action"
    ])
    expect(Arr.map(otherAnswers({ view: at("stock"), extra }) ?? [], (answer) => answer.type)).toEqual([
      "leaveOut",
      "action"
    ])
    // Without the page's answer, and on a row that is ready, there is nothing more: "Leave out" as before.
    expect(otherAnswers({ view: at("comma"), extra: undefined })).toBeUndefined()
    const done = lineRun(emptyState, { type: "acceptGroup", groupId: "qty:comma" }).state
    expect(otherAnswers({ view: lineView(done, lineOf("comma").id), extra })).toBeUndefined()
  })

  it("undo survives the region being drawn again from the object onDecisionsChange gave", () => {
    const state = Arr.reduce(
      [
        { type: "acceptGroup", groupId: "qty:comma" },
        { type: "edit", rowId: lineOf("unit").id, column: "unit", value: "m" }
      ] satisfies ReadonlyArray<Action>,
      emptyState,
      (before, action) => lineRun(before, action).state
    )
    const kept: SavedDecisions = saved(state)
    // The page switched views and back: the region starts again from what the page kept.
    const again = restored(kept)
    expect(again.undo).toHaveLength(2)
    const undone = lineRun(again, { type: "undo" })
    expect(undone.label).toBe("Undone: Value changed")
    expect(lineView(undone.state, lineOf("unit").id).status).toBe("needs")
    expect(lineView(undone.state, lineOf("comma").id).cells.qty).toBe("1.5")
    // A copy is new data: the same decisions, and a new history.
    const copy = restored({ ...kept })
    expect([HashMap.size(copy.decisions), copy.undo.length]).toEqual([HashMap.size(state.decisions), 0])
  })

  it("the page counts the jobs from the person's answers, not the region", () => {
    const tally = (state: ReviewState, leftOut: ReadonlyArray<string>) =>
      Arr.map(reviewJobs({ jobs, decisions: saved(state), leftOut }), (review) => review.status)
    const statuses = (list: ReadonlyArray<string>) => [
      Arr.filter(list, (status) => status === "ready").length,
      Arr.filter(list, (status) => status === "waiting").length
    ]
    expect(statuses(tally(emptyState, []))).toEqual([16, 8])
    const comma = lineRun(emptyState, { type: "acceptGroup", groupId: "qty:comma" }).state
    expect(statuses(tally(comma, []))).toEqual([19, 5])
    const out = tally(emptyState, ["J-2045"])
    expect([...statuses(out), Arr.filter(out, (status) => status === "out").length]).toEqual([16, 7, 1])
    expect(questionRows(jobs, ["J-2045"])).toHaveLength(7)
  })
})

describe("a model's weak guess", () => {
  it("is never a row's one-press answer: only a model's low guess is held back for typing", () => {
    expect(weakGuess({ by: "model", confidence: "low" })).toBe(true)
    expect(weakGuess({ by: "model", confidence: "medium" })).toBe(false)
    // A rule's low proposal is a question with two readings, answered by a press: it stays one.
    expect(weakGuess({ by: "rule", confidence: "low" })).toBe(false)
  })
})
