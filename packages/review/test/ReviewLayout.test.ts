// The review table's newer rules, each tested where it would hurt: a column that must not be cut being cut, a redo
// that brings back something other than what was undone, a work list whose counts do not add up, a button that reads
// "Type a item #", and a row already in the system offered "Leave out".
import { describe, expect, it } from "@effect/vitest"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import {
  act,
  Action,
  askFor,
  count,
  decisionsLeft,
  emptyState,
  heldCsv,
  nextKind,
  result,
  viewRows,
  visible,
  workList
} from "@inventory/review/ReviewDraft"
import { planColumns, priorityOf, type SizedColumn } from "../src/internal/sizing.ts"
import { ReviewRow } from "@inventory/review/ReviewTypes"
import type { ReviewState } from "@inventory/review/ReviewTypes"
import { defaultReviewWords } from "@inventory/review/ReviewWords"
import { columns, makeRows, problemKinds, recheck } from "./fixtures/fabrication.ts"

const rows = makeRows({ size: 178 })
const views = (state: ReviewState) => viewRows({ rows, state, recheck })
const plain = (state: ReviewState) => R.fromEntries(state.decisions)

describe("column sizing", () => {
  const name: SizedColumn = { id: "name", size: "fill", need: 200, priority: 9, keep: true }
  const sku: SizedColumn = { id: "sku", size: "fit", need: 120, priority: 2, keep: false }
  const unit: SizedColumn = { id: "unit", size: "fit", need: 90, priority: 3, keep: false }
  const buy: SizedColumn = { id: "buy", size: "fit", need: 60, priority: 0, keep: false }
  const make: SizedColumn = { id: "make", size: "fit", need: 60, priority: 0, keep: false }

  it("gives every fit column its measured width and the fill columns what is left", () => {
    const plan = planColumns({ columns: [name, sku, unit, buy], fixed: 240, room: 1000 })
    expect(plan.folded).toEqual([])
    expect(plan.scrolls).toBe(false)
    expect(plan.shown).toEqual([
      { id: "name", width: 200 + (1000 - 240 - 200 - 120 - 90 - 60) },
      { id: "sku", width: 120 },
      { id: "unit", width: 90 },
      { id: "buy", width: 60 }
    ])
    expect(plan.flex).toBe("name")
  })

  it("moves the lowest priority into the detail first, and between equals the one furthest right", () => {
    const plan = planColumns({ columns: [name, sku, unit, buy, make], fixed: 240, room: 710 })
    // 240 + 200 + 120 + 90 + 60 + 60 = 770: one 60 px column must go, and Make is right of Buy.
    expect(plan.folded).toEqual(["make"])
    const tighter = planColumns({ columns: [name, sku, unit, buy, make], fixed: 240, room: 560 })
    // Both priority-0 columns, then the SKU (2) before the unit (3).
    expect(tighter.folded).toEqual(["sku", "buy", "make"])
  })

  it("never cuts a fit column: what must stay and does not fit scrolls sideways instead", () => {
    const plan = planColumns({
      columns: [name, { ...sku, keep: true }, { ...unit, keep: true }],
      fixed: 240,
      room: 500
    })
    expect(plan.folded).toEqual([])
    expect(plan.scrolls).toBe(true)
    expect(plan.minWidth).toBe(240 + 200 + 120 + 90)
    expect(A.findFirst(plan.shown, (column) => column.id === "sku").pipe(O.map((column) => column.width))).toEqual(
      O.some(120)
    )
  })

  it.prop(
    "every fit column shown keeps its measured width, and the table fits the room unless it must scroll",
    {
      needs: S.Array(S.Int.check(S.isBetween({ minimum: 20, maximum: 400 }))).check(
        S.isMinLength(1),
        S.isMaxLength(10)
      ),
      room: S.Int.check(S.isBetween({ minimum: 300, maximum: 2400 }))
    },
    ({ needs, room }) => {
      const sized = A.map(needs, (need, index): SizedColumn => ({
        id: `c${index}`,
        size: index === 0 ? "fill" : "fit",
        need,
        priority: index % 3,
        keep: index === 0
      }))
      const plan = planColumns({ columns: sized, fixed: 200, room })
      for (const shown of plan.shown) {
        const column = O.getOrUndefined(A.findFirst(sized, (candidate) => candidate.id === shown.id))
        if (column?.size === "fit") expect(shown.width).toBe(column.need)
        else expect(shown.width).toBeGreaterThanOrEqual(column?.need ?? 0)
      }
      if (!plan.scrolls) expect(plan.minWidth).toBeLessThanOrEqual(room)
      // A column moves only while the table is short of room: one more shown would not have fitted.
      expect(plan.shown.length + plan.folded.length).toBe(sized.length)
    }
  )

  it("reads a column's priority from its number, else from core", () => {
    expect([priorityOf({ priority: 5 }), priorityOf({ core: true }), priorityOf({})]).toEqual([5, 1, 0])
  })
})

describe("undo and redo", () => {
  const ready = A.filter(rows, (row) => row.problem === undefined)
  const needing = A.filter(rows, (row) => row.problem !== undefined)
  const PickKind = LiteralKit(["leaveOut", "edit", "accept", "undo", "redo"])
  const Pick = S.Struct({
    kind: PickKind,
    at: S.Int.check(S.isBetween({ minimum: 0, maximum: 40 }))
  })
  const actionOf = (pick: typeof Pick.Type): Action => {
    const one = ready[pick.at % ready.length] ?? ready[0]!
    const open = needing[pick.at % needing.length] ?? needing[0]!
    return PickKind.match(pick.kind, {
      leaveOut: (): Action => ({ type: "leaveOut", rowIds: [one.id] }),
      edit: (): Action => ({
        type: "edit",
        rowId: open.id,
        column: open.problem?.column ?? "name",
        value: `v${pick.at}`
      }),
      accept: (): Action => ({ type: "accept", rowIds: [open.id] }),
      undo: (): Action => ({ type: "undo" }),
      redo: (): Action => ({ type: "redo" })
    })
  }
  const play = (picks: ReadonlyArray<typeof Pick.Type>): ReviewState =>
    A.reduce(picks, emptyState, (state, pick) => act({ rows, state, action: actionOf(pick), recheck }).state)

  it.prop(
    "a redo right after an undo brings back exactly the decisions that were undone",
    { picks: S.Array(Pick).check(S.isMaxLength(15)) },
    ({ picks }) => {
      const state = play(picks)
      if (state.undo.length === 0) return
      const undone = act({ rows, state, action: { type: "undo" as const }, recheck }).state
      const redone = act({ rows, state: undone, action: { type: "redo" as const }, recheck }).state
      expect(plain(redone)).toEqual(plain(state))
      expect(redone.undo.length).toBe(state.undo.length)
      expect(redone.redo?.length ?? 0).toBe(state.redo?.length ?? 0)
    }
  )

  it.prop(
    "an undo right after a redo takes the same decisions back again",
    { picks: S.Array(Pick).check(S.isMaxLength(15)) },
    ({ picks }) => {
      const state = play(picks)
      if ((state.redo ?? []).length === 0) return
      const redone = act({ rows, state, action: { type: "redo" as const }, recheck }).state
      expect(plain(act({ rows, state: redone, action: { type: "undo" as const }, recheck }).state)).toEqual(
        plain(state)
      )
    }
  )

  it.prop("any new decision empties the redo stack", { picks: S.Array(Pick).check(S.isMaxLength(15)) }, ({ picks }) => {
    const state = play(picks)
    const row = ready[0]!
    const outcome = act({ rows, state, action: { type: "edit" as const, rowId: row.id, column: "name", value: "New" } })
    expect(outcome.state.redo ?? []).toEqual([])
  })

  it("undo moves a step to redo, redo moves it back, and each says what it did", () => {
    const row = ready[0]!
    const left = act({ rows, state: emptyState, action: { type: "leaveOut" as const, rowIds: [row.id] } })
    const undone = act({ rows, state: left.state, action: { type: "undo" as const } })
    expect([undone.state.undo.length, undone.state.redo.length]).toEqual([0, 1])
    expect(undone.label).toBe("Undone: 1 row left out")
    const redone = act({ rows, state: undone.state, action: { type: "redo" as const } })
    expect([redone.state.undo.length, redone.state.redo.length]).toEqual([1, 0])
    expect(redone.label).toBe("Redone: 1 row left out")
    expect(redone.focus).toEqual(O.some(row.id))
    // Nothing to redo: nothing happens.
    expect(act({ rows, state: redone.state, action: { type: "redo" as const } }).label).toBe("")
  })
})

describe("the work list", () => {
  it("lists each kind with rows left, keeps a finished one ticked, and its counts add up to Needs you", () => {
    const counts = count(views(emptyState))
    const seen = HashSet.fromIterable(A.map(problemKinds, (kind) => kind.id))
    const list = workList({ counts, problemKinds, seen })
    expect(A.reduce(list, 0, (sum, item) => sum + item.left)).toBe(counts.needs)
    // Leave every row of the first kind out: it stays on the list, ticked, with none left.
    const first = list[0]!
    const ids = A.map(
      A.filter(rows, (row) => row.problem?.kind === first.kind.id),
      (row) => row.id
    )
    const state = act({ rows, state: emptyState, action: { type: "leaveOut" as const, rowIds: ids } }).state
    const after = workList({ counts: count(views(state)), problemKinds, seen })
    expect(after[0]).toEqual({ kind: first.kind, left: 0, done: true })
    expect(A.reduce(after, 0, (sum, item) => sum + item.left)).toBe(count(views(state)).needs)
    // A kind that never had rows is not listed.
    expect(A.every(workList({ counts, problemKinds, seen: HashSet.empty() }), (item) => item.left > 0)).toBe(true)
  })

  it("next problem goes down the list to the next kind with rows left, then from the top", () => {
    const counts = count(views(emptyState))
    const list = workList({ counts, problemKinds, seen: HashSet.empty() })
    const [a, b] = list
    expect(nextKind({ list, from: a?.kind.id })).toBe(b?.kind.id)
    expect(nextKind({ list, from: list[list.length - 1]?.kind.id })).toBe(a?.kind.id)
    const done = A.map(list, (item) => ({ ...item, left: 0, done: true }))
    expect(nextKind({ list: done, from: a?.kind.id })).toBeUndefined()
  })

  it("counts a group of identical fixes as one decision", () => {
    const all = views(emptyState)
    const needs = count(all).needs
    expect(decisionsLeft(all)).toBeLessThan(needs)
    expect(decisionsLeft(all)).toBeGreaterThan(0)
  })
})

describe("words for a typed value", () => {
  it("names the column after Set, so no article is guessed", () => {
    expect(askFor("Item #")).toBe("Set item #")
    expect(askFor("Why")).toBe("Set why")
    expect(askFor("SKU")).toBe("Set SKU")
    expect(askFor("Name")).toBe("Set name")
    expect(askFor("Purchase price")).toBe("Set purchase price")
    expect(askFor("eBay ID")).toBe("Set eBay ID")
    for (const label of ["Item #", "Why", "Unit", "Owner", "SKU"]) expect(askFor(label)).not.toMatch(/\ban? /)
  })
})

describe("a row already in the system", () => {
  const stored: ReviewRow = ReviewRow.make({
    id: "row-900",
    line: 900,
    cells: { name: "Hex bolt M6", sku: "HB-M6" },
    stored: true
  })
  const all = [...rows, stored]
  const viewsOf = (state: ReviewState) => viewRows({ rows: all, state, recheck })

  it("counts apart, shows under All only, and is held with its own reason", () => {
    const counts = count(viewsOf(emptyState))
    expect(counts.stored).toBe(1)
    expect(counts.needs + counts.ready + counts.out + counts.stored).toBe(counts.total)
    const shows = (filter: "all" | "needs" | "ready" | "out") =>
      A.some(visible({ views: viewsOf(emptyState), filter }), (view) => view.row.id === stored.id)
    expect(shows("all")).toBe(true)
    for (const filter of ["needs", "ready", "out"] as const) expect(shows(filter)).toBe(false)
    const held = A.findFirst(result({ views: viewsOf(emptyState), problemKinds }).held, (row) => row.id === stored.id)
    expect(held).toEqual(O.some({ id: stored.id, line: 900, reason: "Already there", decidedBy: "stored" }))
    expect(
      heldCsv({ views: viewsOf(emptyState), columns, problemKinds, words: { ...defaultReviewWords, stored: "Stored" } })
    ).toContain("900,Stored,Hex bolt M6")
  })

  it("cannot be left out or edited: there is nothing to decide", () => {
    expect(
      act({ rows: all, state: emptyState, action: { type: "leaveOut" as const, rowIds: [stored.id] } }).label
    ).toBe("")
    expect(
      act({
        rows: all,
        state: emptyState,
        action: { type: "edit" as const, rowId: stored.id, column: "name", value: "X" }
      }).label
    ).toBe("")
  })
})
