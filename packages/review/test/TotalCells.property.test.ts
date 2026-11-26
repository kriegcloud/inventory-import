// A complete drawing row must never change the sparse cells sent back to the caller or stored in a draft.
import { describe, expect, it } from "@effect/vitest"
import { assertDefined, assertNone, assertSome } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { identity } from "effect/Function"
import {
  act,
  emptyState,
  fixableBy,
  fromDraft,
  result,
  restored,
  saved,
  toDraft,
  viewRows
} from "@inventory/review/ReviewDraft"
import { Fix, Problem, ReviewColumn, ReviewRow, RowView, Why } from "@inventory/review/ReviewTypes"
import type { ReviewState } from "@inventory/review/ReviewTypes"
import { defaultReviewWords } from "@inventory/review/ReviewWords"
import { TotalCells, totalCells } from "@inventory/review/ReviewDraft"

const columns = A.map(["name", "missing", "toString", "constructor", "__proto__"], (id) =>
  ReviewColumn.make({ id, label: id, display: identity })
)
const fixable = fixableBy([])

it.prop(
  "complete cells generate only values admitted by the owned schema",
  [Arbitrary.schema(TotalCells)],
  ([cells]) => {
    expect(S.is(TotalCells)(cells)).toBe(true)
  }
)

describe("row completion at entry", () => {
  it("fills declared columns, retains file-only and reserved keys, and rejects sparse construction through nested codecs", () => {
    const source = { name: "File", extra: "Kept", ["__proto__"]: "Own proto", constructor: "Own constructor" }
    const cells = totalCells(columns, source)
    assertSome(TotalCells.text(cells, "missing"), "")
    assertSome(TotalCells.text(cells, "extra"), "Kept")
    expect(totalCells(columns, source)).toBe(cells)
    const replaced = totalCells(columns, { ...source, name: "Changed" })
    assertSome(TotalCells.text(replaced, "name"), "Changed")
    assertSome(TotalCells.text(cells, "name"), "File")
    assertSome(TotalCells.text(cells, "__proto__"), "Own proto")
    assertSome(TotalCells.text(cells, "constructor"), "Own constructor")
    assertSome(TotalCells.text(cells, "toString"), "")
    assertNone(TotalCells.text(cells, "valueOf"))
    expect(S.is(TotalCells)(source)).toBe(false)
    expect(O.isNone(S.decodeUnknownOption(TotalCells)(source))).toBe(true)
    const row = ReviewRow.make({ id: "one", line: 2, cells: source })
    const view = viewRows({ columns, rows: [row], state: emptyState, recheck: O.none(), fixable, rejects: false })[0]
    assertDefined(view)
    expect(S.is(RowView)({ ...view, cells: source })).toBe(false)
    expect(O.isNone(S.decodeUnknownOption(RowView)({ ...view, cells: source }))).toBe(true)
    expect(source).toEqual({ name: "File", extra: "Kept", ["__proto__"]: "Own proto", constructor: "Own constructor" })
  })

  it("completes proposal, typed, undone, redone and restored views without adding sparse output keys", () => {
    const fix = Fix.make({
      column: "missing",
      confidence: O.none(),
      to: "Proposed",
      kind: "fix",
      why: Why.make({ basis: "From the file" })
    })
    const row = ReviewRow.make({
      id: "one",
      line: 2,
      cells: { name: "File" },
      problem: Problem.makeOption({
        kind: "fix",
        column: O.some("missing"),
        fix: O.some(fix)
      })
    })
    const rows = [row]
    const rechecks: Array<Readonly<Record<string, string>>> = []
    const recheck = O.some(({ cells }: { readonly cells: Readonly<Record<string, string>> }) => {
      rechecks.push(cells)
      return O.none<Problem>()
    })
    const input = { columns, rows, recheck, fixable, rejects: false }
    const read = (state: ReviewState) => {
      const views = viewRows({ ...input, state })
      const view = views[0]
      assertDefined(view)
      expect(R.keys<string, string>(view.cells)).toEqual(A.map(columns, (column) => column.id))
      expect(row.cells).toEqual({ name: "File" })
      assertSome(TotalCells.text(view.original, "missing"), "")
      return { view, views }
    }
    const open = read(emptyState)
    assertSome(TotalCells.text(open.view.cells, "missing"), "")
    expect(open.view.written).toEqual({ name: "File" })
    expect(read(emptyState).view).toBe(open.view)
    const accepted = act({ ...input, state: emptyState, action: { type: "accept", rowIds: [row.id] } }).state
    const proposed = read(accepted)
    assertSome(TotalCells.text(proposed.view.cells, "missing"), "Proposed")
    expect(proposed.view.written).toEqual({ name: "File", missing: "Proposed" })
    const typed = act({
      ...input,
      state: accepted,
      action: { type: "edit", rowId: row.id, column: "missing", value: "Typed" }
    }).state
    const changed = read(typed)
    assertSome(TotalCells.text(changed.view.cells, "missing"), "Typed")
    expect(rechecks).toEqual([{ name: "File", missing: "Typed" }])
    const undone = act({ ...input, state: typed, action: { type: "undo" } }).state
    assertSome(TotalCells.text(read(undone).view.cells, "missing"), "Proposed")
    const redone = act({ ...input, state: undone, action: { type: "redo" } }).state
    assertSome(TotalCells.text(read(redone).view.cells, "missing"), "Typed")
    assertSome(TotalCells.text(read(restored(saved(redone))).view.cells, "missing"), "Typed")
    assertSome(TotalCells.text(read(fromDraft(toDraft(redone))).view.cells, "missing"), "Typed")
    const imported = result({ views: changed.views, problemKinds: [], words: defaultReviewWords }).ready[0]
    assertDefined(imported)
    expect(imported.cells).toEqual({ name: "File", missing: "Typed" })
  })
})
