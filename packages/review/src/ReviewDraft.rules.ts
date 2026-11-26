/**
 * The review region's rules as pure functions, so they can be tested without a browser: how a row stands after the
 * person's decisions, the counts that must add up, what one accept may touch, and what the import button says.
 * The one thing a reader must not break: a proposal never replaces a decision the person already made.
 *
 * Collections are Effect's: `HashMap` and `HashSet` for what a step hands on (the decisions, an undo step, the
 * counts), `MutableHashMap` and `MutableHashSet` for what one function fills and reads. One `WeakMap` stays, where an
 * entry must go when its key does (the view of an untouched row): Effect has no weak collection.
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import { isKept, isLeftOut, kept, leftOut, putBack, ReviewDecision, RowPlace } from "@inventory/review/ReviewDecision"
import * as Data from "effect/Data"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as MutableHashMap from "effect/MutableHashMap"
import * as MutableHashSet from "effect/MutableHashSet"
import * as O from "effect/Option"
import {
  CellMark,
  ColumnMatch,
  DraftStep,
  Entry,
  Fix,
  HeldRow,
  ImportChange,
  ImportResult,
  Problem,
  ReadyRow,
  ReviewDraft
} from "@inventory/review/ReviewTypes"
import type {
  Choice,
  Counts,
  QueueEntry,
  FilterId,
  FixGroup,
  ProblemKind,
  ReviewColumn,
  ReviewRow,
  ReviewState,
  RowAction,
  RowDecision,
  ReviewWords,
  RowView,
  SavedDecisions,
  UndoStep,
  Why,
  Decided
} from "@inventory/review/ReviewTypes"
import * as A from "effect/Array"
import * as S from "effect/Schema"
import * as R from "effect/Record"
import { $ReviewId } from "./internal/identity.ts"

const $I = $ReviewId.create("ReviewDraft")

// Each enum's own guard, made once: these run for every row and every cell.
const isCellMarkApplied = CellMark.guards.applied
const isCellMarkProposed = CellMark.guards.proposed
const isColumnMatchUnmatched = ColumnMatch.guards.unmatched

/**
 * How a sentence names a row after "row": its label when the caller gave one ("8 · Feb", one of several records on
 * line 8), otherwise its line.
 *
 * @example rowName({ id: "row-8.2", line: 8, label: "8 · Feb", cells: {} }) // "8 · Feb"
 */
export const rowName = (row: Pick<ReviewRow, "line" | "label">): string =>
  O.match(row.label, { onNone: () => String(row.line), onSome: (label) => label })

/**
 * Two fixes that say the same thing. A rule's fix held back as a proposal is a checked copy of the row's own
 * (`Problem.make`), so the two are told to be one by what they say, never by being one object.
 */
const sameFix = S.toEquivalence(Fix)

/** A decision that says nothing yet: what a row without one starts from. */
const undecided = ReviewDecision.make({})

/** Kept over its rivals, now or before it was left out: what today's rows read as the `kept` flag. */
const keptFlag = (decision: RowDecision): boolean =>
  isKept(decision.place) || (RowPlace.guards.leftOut(decision.place) && decision.place.wasKept)

/** True when the person left the row out. */
const leftOutRow = (decision: O.Option<RowDecision>): boolean => O.isSome(decision) && isLeftOut(decision.value.place)

/** The decision with the row left out, remembering whether it had been kept. */
const leaveOut = (decision: O.Option<RowDecision>): RowDecision =>
  ReviewDecision.make({
    ...O.getOrElse(decision, () => undecided),
    place: leftOut(O.exists(decision, keptFlag))
  })

export const emptyState: ReviewState = { decisions: HashMap.empty(), undo: [], redo: [] }

/**
 * Where a review starts when the rules' own fixes must be asked first (the default): every `row.applied` fix is
 * held back as a proposal, so nothing from the file is changed until the person takes it.
 */
export function proposing(rows: ReadonlyArray<ReviewRow>): ReviewState {
  const decisions: Array<readonly [string, RowDecision]> = []
  for (const row of rows) {
    if (row.applied.length > 0) {
      decisions.push([row.id, ReviewDecision.make({ reverted: row.applied.map((fix) => fix.column) })])
    }
  }
  return { decisions: HashMap.fromIterable(decisions), undo: [], redo: [] }
}

/** The decisions as plain data, for whoever keeps them: the state's decisions and nothing of its undo history. */
export const saved = (state: ReviewState): SavedDecisions => Object.fromEntries(state.decisions)

/** A review started from decisions kept as plain data: the same decisions, and a new undo history. */
export const restored = (decisions: SavedDecisions): ReviewState => ({
  decisions: HashMap.fromIterable(Object.entries(decisions)),
  undo: [],
  redo: []
})

const toDraftStep = (step: UndoStep): DraftStep =>
  DraftStep.make({
    label: step.label,
    before: [...step.before].map(([rowId, decision]) => [rowId, decision] as const),
    focus: step.focus
  })

const fromDraftStep = (step: DraftStep): UndoStep => ({
  label: step.label,
  before: HashMap.fromIterable(step.before.map(([rowId, decision]) => [rowId, decision] as const)),
  focus: step.focus
})

/**
 * The decisions with their undo and redo history, as plain data that survives JSON: what a page keeps in the browser
 * so a refresh or a closed tab loses neither a decision nor "Undo last step".
 */
export const toDraft = (state: ReviewState): ReviewDraft =>
  ReviewDraft.make({
    decisions: saved(state),
    undo: state.undo.map(toDraftStep),
    redo: state.redo.map(toDraftStep)
  })

/**
 * The review a `toDraft` draft was made from, its undo and redo history with it: undoing after a refresh takes back
 * the last step taken before it.
 */
export const fromDraft = (draft: ReviewDraft): ReviewState => ({
  decisions: HashMap.fromIterable(Object.entries(draft.decisions)),
  undo: draft.undo.map(fromDraftStep),
  redo: draft.redo.map(fromDraftStep)
})

type Recheck = (input: { row: ReviewRow; cells: Readonly<Record<string, string>> }) => O.Option<Problem>

/** Whether a problem kind can be settled on this screen, from the caller's kinds (`ProblemKind.fixable`). */
type Fixable = (kind: string) => boolean

const allFixable: Fixable = () => true

/** The kinds nothing on this screen can settle, as a test on a kind's id. */
export const fixableBy = (kinds: ReadonlyArray<ProblemKind>): Fixable => {
  const not = kinds.filter((kind) => kind.fixable === false).map((kind) => kind.id)
  return not.length === 0 ? allFixable : (kind) => !not.includes(kind)
}

// ---------------------------------------------------------------------------------------------------------------
// How a row stands
// ---------------------------------------------------------------------------------------------------------------

const untouched = new WeakMap<ReviewRow, { fixable: Fixable; view: RowView }>()

/** A row nobody has decided on: the rules' applied fixes are in force and its problem, if any, is open. */
function viewUntouched(row: ReviewRow, fixable: Fixable): RowView {
  const known = untouched.get(row)
  if (known !== undefined && known.fixable === fixable) return known.view
  const view = build(row, O.none(), () => false, O.none(), fixable, false)
  untouched.set(row, { fixable, view })
  return view
}

const sourceOf = (fix: Fix): "rule" | "model" | "unknown" =>
  O.match(fix.by, { onNone: () => "unknown", onSome: (by) => by })

/** A problem with its proposal taken off: what is left once the person rejected it. */
const withoutFix = (problem: Problem): Problem => ({ ...problem, fix: O.none() })

/** What a row with no decision has accepted, undone and typed: nothing, the same two objects for every such row. */
const noColumns: ReadonlyArray<string> = []
const noEdits: Readonly<Record<string, string>> = {}

function build(
  row: ReviewRow,
  decision: O.Option<RowDecision>,
  settled: (rowId: string, column: O.Option<string>) => boolean,
  recheck: O.Option<Recheck>,
  fixable: Fixable,
  rejects: boolean
): RowView {
  if (row.stored === true)
    return { row, status: "stored", cells: row.cells, marks: {}, problem: O.none(), blocked: false, decided: O.none() }
  const cells: Record<string, string> = { ...row.cells }
  const marks: Record<string, CellMark> = {}
  const reverted = O.isSome(decision) ? decision.value.reverted : noColumns
  // Where a fix the person undid or rejected stays rejected (`rejects`), its problem is left without the proposal:
  // the file's value stands and the row waits for a typed value.
  const gone = (fix: O.Option<Fix>): boolean => rejects && O.exists(fix, (fix) => reverted.includes(fix.column))
  const open: Array<Problem> = A.map(O.toArray(row.problem), (problem) =>
    gone(problem.fix) ? withoutFix(problem) : problem
  )
  const accepted = O.isSome(decision) ? decision.value.accepted : noColumns
  const edits = O.isSome(decision) ? decision.value.edits : noEdits
  let auto = false
  let took = false

  for (const fix of row.applied) {
    if (reverted.includes(fix.column))
      open.push(
        Problem.make({
          kind: fix.kind,
          column: O.some(fix.column),
          fix: rejects ? O.none() : O.some(fix),
          reason: fix.reason
        })
      )
    else {
      if (accepted.includes(fix.column)) took = true
      else auto = true
      marks[fix.column] = {
        state: "applied" as const,
        from: row.cells[fix.column] ?? "",
        to: fix.to,
        by: sourceOf(fix),
        fix: O.some(fix),
        accepted: accepted.includes(fix.column)
      }
      cells[fix.column] = fix.to
    }
  }

  let problem: O.Option<Problem> = O.none()
  for (const candidate of open) {
    const column = candidate.column
    if (O.exists(column, (column) => Object.hasOwn(edits, column))) continue
    if (O.isSome(candidate.fix) && accepted.includes(candidate.fix.value.column)) {
      const fix = candidate.fix.value
      marks[fix.column] = {
        state: "applied" as const,
        from: row.cells[fix.column] ?? "",
        to: fix.to,
        by: sourceOf(fix),
        fix: O.some(fix),
        accepted: true
      }
      cells[fix.column] = fix.to
      took = true
      continue
    }
    if (O.isSome(candidate.rivals)) {
      if (O.isSome(decision) && keptFlag(decision.value)) continue
      if (candidate.rivals.value.every((rival) => settled(rival, column))) continue
    }
    if (O.isNone(problem)) problem = O.some(candidate)
  }

  let typed = false
  for (const [column, value] of R.toEntries(edits)) {
    marks[column] = {
      state: "applied" as const,
      from: row.cells[column] ?? "",
      to: value,
      by: "you",
      fix: O.none(),
      accepted: false
    }
    cells[column] = value
    typed = true
  }
  // The caller's rules never saw a typed value, so they look at the row again. Accepted fixes came from them.
  // What the rules say then stands, a row they find nothing wrong with included: a pick written to another column
  // (an empty Discontinued on) settles a question asked on this one. Only a copy's problem is kept when they find
  // nothing, since whether it was kept is a decision they do not see.
  if (typed && O.isSome(recheck))
    problem = O.orElse(recheck.value({ row, cells }), () => O.filter(problem, (problem) => O.isSome(problem.rivals)))
  problem = O.map(problem, (problem) => (gone(problem.fix) ? withoutFix(problem) : problem))

  const proposal = O.flatMap(problem, (problem) => problem.fix)
  if (O.isSome(proposal) && !leftOutRow(decision)) {
    const fix = proposal.value
    marks[fix.column] = {
      state: "proposed" as const,
      from: cells[fix.column] ?? "",
      to: fix.to,
      by: sourceOf(fix),
      fix
    }
  }

  // A problem nothing here can settle is counted apart from the ones the person can decide.
  const status = leftOutRow(decision)
    ? "out"
    : O.match(problem, {
        onNone: () => "ready" as const,
        onSome: (problem) => (fixable(problem.kind) ? ("needs" as const) : ("cannot" as const))
      })
  if (O.isSome(problem)) {
    const blocked =
      status === "needs" &&
      O.match(row.blocked, { onNone: () => O.contains(problem.value.tone, "blocker"), onSome: (blocked) => blocked })
    return { row, status, cells, marks, problem, blocked, decided: O.none() }
  }
  const decided: O.Option<Decided> = typed
    ? O.some("edited")
    : O.isSome(decision) && keptFlag(decision.value)
      ? O.some("kept")
      : took
        ? O.some("accepted")
        : auto
          ? O.some("auto")
          : O.none()
  return {
    row,
    status,
    cells,
    marks,
    problem: O.none(),
    blocked: false,
    decided: status === "ready" ? decided : O.none()
  }
}

/** Every row as it stands now, in file order. Rows without a decision reuse one cached answer. */
export function viewRows(input: {
  rows: ReadonlyArray<ReviewRow>
  state: ReviewState
  recheck: O.Option<Recheck>
  /** The caller's kinds: a row whose problem is of a kind marked `fixable: false` is `cannot`, not `needs`. */
  fixable: Fixable
  /**
   * A fix whose column is in `RowDecision.reverted` is rejected, not offered again: the file's value stands and the
   * row waits for the person. Without it (rule fixes held back as proposals) a reverted fix is a proposal to take.
   */
  rejects: boolean
}): ReadonlyArray<RowView> {
  const fixable = input.fixable
  const decisions = input.state.decisions
  const none = HashMap.isEmpty(decisions)
  // Read once into a record, then looked up per row: at 50,000 rows a HashMap lookup per row (twice per decision
  // press, once in `act` and once for the screen) made a press measurably slower. Row ids are the region's own. Each
  // decision is wrapped once here, so a row with none is the one shared `none` and no row allocates on its lookup.
  const byRow: Readonly<Record<string, O.Option<RowDecision>>> = Object.fromEntries(
    HashMap.map(decisions, (decision) => O.some(decision))
  )
  const noDecision = O.none<RowDecision>()
  const decisionOf = (rowId: string): O.Option<RowDecision> =>
    Object.hasOwn(byRow, rowId) ? byRow[rowId]! : noDecision
  // A copy is settled once it is left out, or once the person typed a new value into the cell they shared.
  const settled = (rowId: string, column: O.Option<string>): boolean => {
    const decision = decisionOf(rowId)
    if (O.isNone(decision)) return false
    if (isLeftOut(decision.value.place)) return true
    return O.exists(column, (column) => Object.hasOwn(decision.value.edits, column))
  }
  return input.rows.map((row) => {
    const decision = none ? noDecision : decisionOf(row.id)
    if (O.isNone(decision) && (!O.exists(row.problem, (problem) => O.isSome(problem.rivals)) || none)) {
      return viewUntouched(row, fixable)
    }
    return build(row, decision, settled, input.recheck, fixable, input.rejects === true)
  })
}

// ---------------------------------------------------------------------------------------------------------------
// Counts, filters, groups
// ---------------------------------------------------------------------------------------------------------------

/** Needs + cannot + ready + out + stored = total, and the kinds add up to needs. */
export function count(views: ReadonlyArray<RowView>): Counts {
  const kinds = MutableHashMap.empty<string, number>()
  let needs = 0
  let cannot = 0
  let blocked = 0
  let ready = 0
  let out = 0
  let stored = 0
  let applied = 0
  for (const view of views) {
    if (view.status === "out") out += 1
    else if (view.status === "stored") stored += 1
    else if (view.status === "ready") ready += 1
    else if (view.status === "cannot") cannot += 1
    else if (view.blocked === true) {
      cannot += 1
      blocked += 1
    } else {
      needs += 1
      const kind = O.match(view.problem, { onNone: () => "", onSome: (problem) => problem.kind })
      MutableHashMap.set(kinds, kind, O.getOrElse(MutableHashMap.get(kinds, kind), () => 0) + 1)
    }
    for (const fix of view.row.applied) {
      const mark = view.marks[fix.column]
      if (mark !== undefined && isCellMarkApplied(mark) && mark.by !== "you" && !mark.accepted) applied += 1
    }
  }
  return {
    total: views.length,
    needs,
    cannot,
    blocked,
    ready,
    out,
    stored,
    kinds: HashMap.fromIterable(kinds),
    applied
  }
}

/** Undecided rows of one problem kind: none when the kind has no row waiting. */
export const kindCount = (counts: Counts, kind: string): number => O.getOrElse(HashMap.get(counts.kinds, kind), () => 0)

/** The rows a filter shows, in file order. A problem kind narrows the needs view only. */
export function visible(input: {
  views: ReadonlyArray<RowView>
  filter: FilterId
  kind: O.Option<string>
}): ReadonlyArray<RowView> {
  if (input.filter === "all") return input.views
  if (input.filter === "auto") return input.views.filter((view) => O.contains(view.decided, "auto"))
  // A row that must have a value typed first is listed under "cannot", though it still takes answers.
  if (input.filter === "cannot") return input.views.filter((view) => view.status === "cannot" || view.blocked === true)
  return input.views.filter(
    (view) =>
      view.status === input.filter &&
      view.blocked !== true &&
      (input.filter !== "needs" ||
        O.isNone(input.kind) ||
        O.exists(view.problem, (problem) => O.contains(input.kind, problem.kind)))
  )
}

/** A group being gathered: its fix, its rows and the file's spelling on each. */
type Gathered = { fix: Fix; rowIds: Array<string>; froms: Array<string>; mixed: boolean }

/** Adds a row's fix to its group, noting when it ends in another value than the group's first. */
const gather = (group: Gathered, rowId: string, from: string, fix: Fix): Gathered => {
  group.rowIds.push(rowId)
  group.froms.push(from)
  if (fix.to !== group.fix.to) group.mixed = true
  return group
}

/** One value named for rows that get different ones would be false: such a group says so, unless it has a label. */
const mixedOf = (group: Gathered): { mixed: boolean } => ({ mixed: group.mixed && O.isNone(group.fix.label) })

const variantsOf = (froms: ReadonlyArray<string>): ReadonlyArray<{ from: string; count: number }> => {
  const tally = MutableHashMap.empty<string, number>()
  for (const from of froms) MutableHashMap.set(tally, from, O.getOrElse(MutableHashMap.get(tally, from), () => 0) + 1)
  return [...tally].map(([from, n]) => ({ from, count: n })).sort((a, b) => b.count - a.count)
}

/**
 * The grouped fixes still waiting, largest first. Only undecided rows whose open problem carries a grouped fix are
 * in a group, so accepting one can never touch a row the person already decided.
 */
export function waitingGroups(input: {
  views: ReadonlyArray<RowView>
  kind: O.Option<string>
}): ReadonlyArray<FixGroup> {
  const found = MutableHashMap.empty<string, Gathered>()
  for (const view of input.views) {
    const proposed = O.flatMap(view.problem, (problem) => problem.fix)
    // A row that cannot be imported as written is never part of a one-press group.
    if (view.status !== "needs" || view.blocked === true || O.isNone(proposed) || O.isNone(proposed.value.group))
      continue
    if (O.isSome(input.kind) && !O.exists(view.problem, (problem) => O.contains(input.kind, problem.kind))) continue
    const fix = proposed.value
    const groupId = proposed.value.group.value
    const group = O.getOrElse(MutableHashMap.get(found, groupId), (): Gathered => ({
      fix,
      rowIds: [],
      froms: [],
      mixed: false
    }))
    MutableHashMap.set(found, groupId, gather(group, view.row.id, view.row.cells[fix.column] ?? "", fix))
  }
  return [...found]
    .map(([id, group]) => ({
      id,
      kind: group.fix.kind,
      column: group.fix.column,
      to: group.fix.to,
      label: group.fix.label,
      ...mixedOf(group),
      by: group.fix.by,
      confidence: group.fix.confidence,
      variants: variantsOf(group.froms),
      rowIds: group.rowIds,
      why: group.fix.why
    }))
    .sort((a, b) => b.rowIds.length - a.rowIds.length)
}

/** The rule fixes in force, grouped the same way, so a group can be undone at once. */
export function appliedGroups(views: ReadonlyArray<RowView>): ReadonlyArray<FixGroup> {
  const found = MutableHashMap.empty<string, Gathered>()
  for (const view of views) {
    for (const fix of view.row.applied) {
      const mark = view.marks[fix.column]
      if (mark === undefined || !isCellMarkApplied(mark) || mark.by === "you") continue
      const id = O.match(fix.group, { onNone: () => `${fix.column}:${fix.to}`, onSome: (group) => group })
      const group = O.getOrElse(MutableHashMap.get(found, id), (): Gathered => ({
        fix,
        rowIds: [],
        froms: [],
        mixed: false
      }))
      MutableHashMap.set(found, id, gather(group, view.row.id, mark.from, fix))
    }
  }
  return [...found].map(([id, group]) => ({
    id,
    kind: group.fix.kind,
    column: group.fix.column,
    to: group.fix.to,
    label: group.fix.label,
    ...mixedOf(group),
    by: group.fix.by,
    confidence: group.fix.confidence,
    variants: variantsOf(group.froms),
    rowIds: group.rowIds,
    why: group.fix.why
  }))
}

/** "ea (6) · each (3)": the spellings in a group with their row counts. */
export const variantsText = (group: FixGroup, display: (value: string) => string): string =>
  group.variants
    .map((variant) => `${variant.from === "" ? spellingOf(variant.from) : display(variant.from)} (${variant.count})`)
    .join(" · ")

/**
 * A value from the file as the person can tell it apart: "empty" for nothing, and quotation marks around a value
 * with spaces at its ends, because `Foot ` beside `Foot` otherwise reads as no change at all.
 */
export const spellingOf = (from: string): string => (from === "" ? "empty" : from !== from.trim() ? `“${from}”` : from)

// ---------------------------------------------------------------------------------------------------------------
// The person's actions. Each is one undo step.
// ---------------------------------------------------------------------------------------------------------------

/** Whether a fix taken out of force was one made for the person (`undo`) or a proposal they turned down (`reject`). */
export const RevertHow = LiteralKit(["undo", "reject"]).annotate({
  description: "How a fix left force: undone after it was made, or rejected while it was proposed."
})
export type RevertHow = typeof RevertHow.Type

/** The eleven things a person can do on the review. */
export const ActionType = LiteralKit([
  "accept",
  "acceptGroup",
  "chooseGroup",
  "keep",
  "leaveOut",
  "putBack",
  "edit",
  "revertGroup",
  "revert",
  "undo",
  "redo"
]).pipe($I.annoteSchema("ActionType", { description: "What a person can do on the review" }))

/** The decoded value of `ActionType`. */
export type ActionType = typeof ActionType.Type

const rowIds = S.Array(S.String).pipe(S.annotateKey({ description: "The rows it is done to" }))
const except = S.Array(S.String).pipe(
  S.annotateKey({ description: "Rows of the group the person unticked: left as they are" })
)

/**
 * One thing the person did, by `type`: an object written as it is (`{ type: "keep", rowId }`). Branch with
 * `Action.match`. `chooseGroup` is the person's own value for every row of a group: it accepts where that is the
 * proposed value and types it elsewhere. `revert` takes one fix on one row out of force: a fix made for the person
 * undone, or a proposal rejected. `redo` puts the last step taken back in force again.
 */
export const Action = ActionType.toTaggedUnion("type")({
  accept: { rowIds },
  acceptGroup: { groupId: S.String, except },
  chooseGroup: { groupId: S.String, value: S.String, except },
  keep: { rowId: S.String },
  leaveOut: { rowIds },
  putBack: { rowId: S.String },
  edit: { rowId: S.String, column: S.String, value: S.String },
  revertGroup: { groupId: S.String },
  revert: { rowId: S.String, column: S.String, how: S.Literals(["undo", "reject"]) },
  undo: {},
  redo: {}
}).pipe($I.annoteSchema("Action", { description: "One thing the person did on the review" }))

/** The decoded value of `Action`. */
export type Action = typeof Action.Type

export type Outcome = {
  readonly state: ReviewState
  /** What to announce ("12 fixes accepted"). Empty when nothing changed. */
  readonly label: string
  /** The rows whose decision changed. */
  readonly changed: ReadonlyArray<string>
  /** After an undo or a redo: the row to return focus to; none otherwise. */
  readonly focus: O.Option<string>
}

/** Nothing changed: the state as it was, nothing to announce. */
const unchanged = (state: ReviewState): Outcome => ({ state, label: "", changed: [], focus: O.none() })

/**
 * Takes `step` off one stack and puts its mirror on the other: the rows go back to the decisions `step` holds, and
 * the mirror holds the decisions they had a moment ago, so the opposite press brings them back exactly.
 */
const swap = (
  decisions: HashMap.HashMap<string, RowDecision>,
  step: UndoStep
): { decisions: HashMap.HashMap<string, RowDecision>; mirror: UndoStep } => {
  const mirror: UndoStep = {
    label: step.label,
    before: HashMap.map(step.before, (_, rowId) => HashMap.get(decisions, rowId)),
    focus: step.focus
  }
  const next = HashMap.mutate(decisions, (draft) => {
    for (const [rowId, before] of step.before) {
      if (O.isNone(before)) HashMap.remove(draft, rowId)
      else HashMap.set(draft, rowId, before.value)
    }
  })
  return { decisions: next, mirror }
}

/** An undo or a redo: the last step of one stack taken off and its mirror put on the other. */
const travel = (state: ReviewState, way: "undo" | "redo"): Outcome => {
  const from = way === "undo" ? state.undo : state.redo
  const step = from[from.length - 1]
  if (step === undefined) return unchanged(state)
  const { decisions, mirror } = swap(state.decisions, step)
  return {
    state:
      way === "undo"
        ? { decisions, undo: state.undo.slice(0, -1), redo: [...state.redo, mirror] }
        : { decisions, undo: [...state.undo, mirror], redo: state.redo.slice(0, -1) },
    label: `${way === "undo" ? "Undone" : "Redone"}: ${step.label}`,
    changed: [...HashMap.keys(step.before)],
    focus: step.focus
  }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

const without = (list: ReadonlyArray<string>, item: string): ReadonlyArray<string> =>
  list.filter((entry) => entry !== item)

/** Whether the person has said anything about this row. Proposals and group actions leave such rows alone. */
const decidedByPerson = (decision: O.Option<RowDecision>): boolean =>
  O.exists(decision, (d) => isLeftOut(d.place) || keptFlag(d) || Object.keys(d.edits).length > 0)

/** What one decision being taken has to hand: the rows as they stand, and the decisions it writes. */
interface Deciding {
  readonly views: ReadonlyArray<RowView>
  readonly viewOf: (rowId: string) => O.Option<RowView>
  readonly decisionOf: (rowId: string) => O.Option<RowDecision>
  readonly has: (rowId: string) => boolean
  readonly set: (rowId: string, decision: RowDecision) => void
  readonly written: () => number
  /** Accepting a fix: an undone rule fix goes back into force, a proposal is marked accepted. */
  readonly accept: (view: RowView) => void
}

type ActInput = {
  rows: ReadonlyArray<ReviewRow>
  state: ReviewState
  action: Action
  recheck: O.Option<Recheck>
  fixable: Fixable
  rejects: boolean
}

/**
 * One decision taken: `write` sets the rows it changes and returns the label; the rows' old decisions become the undo
 * step, focused on `focus` or else the first row changed.
 */
const decide = (input: ActInput, focus: O.Option<string>, write: (deciding: Deciding) => string): Outcome => {
  const { state } = input
  const views = viewRows({
    rows: input.rows,
    state,
    recheck: input.recheck,
    fixable: input.fixable,
    rejects: input.rejects
  })
  const byId = MutableHashMap.fromIterable(views.map((view) => [view.row.id, view] as const))
  const decisionOf = (rowId: string): O.Option<RowDecision> => HashMap.get(state.decisions, rowId)
  const next = MutableHashMap.empty<string, RowDecision>()
  const set = (rowId: string, decision: RowDecision): void => {
    MutableHashMap.set(next, rowId, decision)
  }
  const accept = (view: RowView): void => {
    const proposed = O.flatMap(view.problem, (problem) => problem.fix)
    if (view.status !== "needs" || O.isNone(proposed)) return
    const fix = proposed.value
    const decision = O.getOrElse(decisionOf(view.row.id), () => undecided)
    const wasApplied = view.row.applied.some((applied) => applied.column === fix.column)
    set(
      view.row.id,
      wasApplied
        ? ReviewDecision.make({
            ...decision,
            reverted: without(decision.reverted, fix.column),
            accepted: [...without(decision.accepted, fix.column), fix.column]
          })
        : ReviewDecision.make({ ...decision, accepted: [...without(decision.accepted, fix.column), fix.column] })
    )
  }
  const label = write({
    views,
    viewOf: (rowId) => MutableHashMap.get(byId, rowId),
    decisionOf,
    has: (rowId) => MutableHashMap.has(byId, rowId),
    set,
    written: () => MutableHashMap.size(next),
    accept
  })
  if (MutableHashMap.isEmpty(next)) return unchanged(state)
  const changes = [...next]
  const decisions = HashMap.setMany(state.decisions, changes)
  const before = HashMap.fromIterable(changes.map(([rowId]) => [rowId, decisionOf(rowId)] as const))
  const step: UndoStep = { label, before, focus: O.orElse(focus, () => O.fromUndefinedOr(changes[0]?.[0])) }
  // A new decision starts a new future: what was taken back can no longer be redone.
  return {
    state: { decisions, undo: [...state.undo, step], redo: [] },
    label,
    changed: changes.map(([rowId]) => rowId),
    focus: O.none()
  }
}

/** A fix's column taken out of force on one decision: no longer accepted, and undone. */
const reverting = (decision: RowDecision, column: string): RowDecision =>
  ReviewDecision.make({
    ...decision,
    reverted: [...without(decision.reverted, column), column],
    accepted: without(decision.accepted, column)
  })

/** Applies one action. Unknown rows and rows the action does not fit are skipped, never guessed at. */
export function act(input: ActInput): Outcome {
  const { state } = input
  return Action.match(input.action, {
    undo: () => travel(state, "undo"),
    redo: () => travel(state, "redo"),
    accept: ({ rowIds }) =>
      decide(input, O.none(), (d) => {
        for (const rowId of rowIds) {
          O.map(d.viewOf(rowId), d.accept)
        }
        return `${plural(d.written(), "fix", "fixes")} accepted`
      }),
    acceptGroup: ({ groupId, except }) =>
      decide(input, O.none(), (d) => {
        const group = A.findFirst(
          waitingGroups({ kind: O.none(), views: d.views }),
          (candidate) => candidate.id === groupId
        )
        if (O.isNone(group)) return ""
        for (const rowId of group.value.rowIds) {
          if (except.includes(rowId)) continue
          O.map(d.viewOf(rowId), d.accept)
        }
        return `${plural(d.written(), "fix", "fixes")} accepted`
      }),
    keep: ({ rowId }) =>
      decide(input, O.some(rowId), (d) => {
        const foundView = d.viewOf(rowId)
        if (O.isNone(foundView) || foundView.value.status !== "needs") return ""
        const view = foundView.value
        const rivals = O.flatMap(view.problem, (problem) => problem.rivals)
        if (O.isNone(rivals)) return ""
        d.set(rowId, ReviewDecision.make({ ...O.getOrElse(d.decisionOf(rowId), () => undecided), place: kept }))
        let left = 0
        for (const rival of rivals.value) {
          const decision = d.decisionOf(rival)
          if (!d.has(rival) || decidedByPerson(decision)) continue
          d.set(rival, leaveOut(decision))
          left += 1
        }
        return left === 0 ? "Row kept" : `Row kept, ${plural(left, "copy", "copies")} left out`
      }),
    chooseGroup: ({ groupId, value, except }) =>
      decide(input, O.none(), (d) => {
        const foundGroup = A.findFirst(
          waitingGroups({ kind: O.none(), views: d.views }),
          (candidate) => candidate.id === groupId
        )
        if (O.isNone(foundGroup)) return ""
        const group = foundGroup.value
        for (const rowId of group.rowIds) {
          if (except.includes(rowId)) continue
          const foundView = d.viewOf(rowId)
          if (O.isNone(foundView)) continue
          const view = foundView.value
          // Each row's own proposal: under a `label` the rows of one group end in different values.
          if (
            O.exists(
              O.flatMap(view.problem, (problem) => problem.fix),
              (fix) => value === fix.to
            )
          )
            d.accept(view)
          else {
            const decision = O.getOrElse(d.decisionOf(rowId), () => undecided)
            const column = O.match(
              O.flatMap(view.problem, (problem) => problem.fix),
              { onNone: () => group.column, onSome: (fix) => columnFor(fix, value) }
            )
            d.set(rowId, ReviewDecision.make({ ...decision, edits: { ...decision.edits, [column]: value } }))
          }
        }
        return `${plural(d.written(), "row", "rows")} set to ${value}`
      }),
    leaveOut: ({ rowIds }) =>
      decide(input, O.none(), (d) => {
        for (const rowId of rowIds) {
          const foundView = d.viewOf(rowId)
          if (O.isNone(foundView)) continue
          const view = foundView.value
          // A row already in the system, or one nothing here can fix, is not imported whatever the person does:
          // there is nothing to leave out.
          if (view.status === "out" || view.status === "stored" || view.status === "cannot") continue
          d.set(rowId, leaveOut(d.decisionOf(rowId)))
        }
        return `${plural(d.written(), "row", "rows")} left out`
      }),
    putBack: ({ rowId }) =>
      decide(input, O.some(rowId), (d) => {
        const decision = d.decisionOf(rowId)
        if (O.isNone(decision) || !isLeftOut(decision.value.place)) return ""
        d.set(rowId, ReviewDecision.make({ ...decision.value, place: putBack(decision.value.place) }))
        return "Row put back"
      }),
    edit: ({ rowId, column, value }) =>
      decide(input, O.some(rowId), (d) => {
        const foundView = d.viewOf(rowId)
        if (O.isNone(foundView) || foundView.value.status === "stored" || foundView.value.status === "cannot") return ""
        const decision = O.getOrElse(d.decisionOf(rowId), () => undecided)
        d.set(rowId, ReviewDecision.make({ ...decision, edits: { ...decision.edits, [column]: value } }))
        return "Value changed"
      }),
    revert: ({ rowId, column, how }) =>
      decide(input, O.some(rowId), (d) => {
        const view = d.viewOf(rowId)
        const mark = O.flatMap(view, (view) => R.get(view.marks, column))
        // Only a fix that is in force or waiting, and not a value the person typed themselves.
        if (O.isNone(view) || O.isNone(mark) || mark.value.by === "you" || view.value.status === "stored") return ""
        d.set(
          rowId,
          reverting(
            O.getOrElse(d.decisionOf(rowId), () => undecided),
            column
          )
        )
        return RevertHow.match(how, { undo: () => "Fix undone", reject: () => "Proposal rejected" })
      }),
    revertGroup: ({ groupId }) =>
      decide(input, O.none(), (d) => {
        const foundGroup = A.findFirst(appliedGroups(d.views), (candidate) => candidate.id === groupId)
        if (O.isNone(foundGroup)) return ""
        const group = foundGroup.value
        for (const rowId of group.rowIds) {
          d.set(
            rowId,
            reverting(
              O.getOrElse(d.decisionOf(rowId), () => undecided),
              group.column
            )
          )
        }
        return `${plural(d.written(), "fix", "fixes")} undone`
      })
  })
}

// ---------------------------------------------------------------------------------------------------------------
// The footer
// ---------------------------------------------------------------------------------------------------------------

/** What the footer's one button is, by what pressing it would do. */
export type Primary = Data.TaggedEnum<{
  /** Pressing it imports (or, reopened with nothing to add, closes the import). */
  Import: { readonly label: string }
  /** The label names what stands in the way; pressing the button goes there instead of importing. */
  Blocked: { readonly label: string; readonly columnId: string }
  /** Decisions are open and nothing is ready yet: the button says so and cannot be pressed. */
  Idle: { readonly label: string }
  /** Nothing in the file can be imported, and nothing is left to decide: words stand where the button was. */
  Done: { readonly label: string }
}>
export const Primary = Data.taggedEnum<Primary>()

/**
 * The primary button: a verb, the number that will be written, and the noun. A blocker replaces the label. A button
 * that could do nothing is never offered: with decisions open and nothing ready it is idle, and with nothing to
 * import and nothing to decide it gives way to words saying so (`nothingNew` when every row is already there).
 */
export function primary(input: {
  columns: ReadonlyArray<ReviewColumn>
  counts: Counts
  noun: readonly [string, string]
  /** What the button says when nothing is ready and nothing waits for a decision, if that may be confirmed. */
  closing: O.Option<string>
  words: ReviewWords
}): Primary {
  const words = input.words
  const unmatched = input.columns.find((column) => O.exists(column.match, isColumnMatchUnmatched))
  if (unmatched !== undefined) {
    return Primary.Blocked({ label: `Match ${unmatched.label} to import`, columnId: unmatched.id })
  }
  const { counts } = input
  if (counts.ready === 0) {
    // Reopened to look, with every remaining row left out: there is nothing to add, and the way out is to close.
    if (O.isSome(input.closing) && counts.needs === 0) return Primary.Import({ label: input.closing.value })
    if (counts.needs + counts.blocked > 0) return Primary.Idle({ label: `No ${input.noun[1]} ready yet` })
    return Primary.Done({
      label: counts.total > 0 && counts.stored === counts.total ? words.nothingNew : words.nothingToImport
    })
  }
  return Primary.Import({ label: `Import ${plural(counts.ready, input.noun[0], input.noun[1])}` })
}

/** "Needs you 6, Left out 2": the counts that are not zero, each under the word its tab says. */
const tabTally = (counts: Counts, words: ReviewWords): string =>
  [
    [words.needs, counts.needs],
    [words.cannot, counts.cannot],
    [words.out, counts.out],
    [words.stored, counts.stored]
  ]
    .filter(([, n]) => n !== 0)
    .map(([word, n]) => `${word} ${n}`)
    .join(", ")

/** The status line beside the button: what will not be imported, or that everything will. */
export function heldLine(counts: Counts, words: ReviewWords): string {
  if (counts.total === 0) return ""
  const held = counts.needs + counts.cannot + counts.out
  if (held === 0) return counts.stored === 0 ? `All ${counts.total} ${words.ready.toLowerCase()}` : ""
  // Every row that is not imported is in the number, the ones already there too: it is the download's count.
  return `${held + counts.stored} won't be imported: ${tabTally(counts, words)}`
}

/** The sentence in the confirm step: what will not be written, and why. 25 words at most. */
export function confirmLine(input: { counts: Counts; noun: readonly [string, string]; words: ReviewWords }): string {
  const { counts } = input
  const held = counts.needs + counts.cannot + counts.out + counts.stored
  return `${plural(held, input.noun[0], input.noun[1])} won't be imported (${tabTally(counts, input.words)}). Your file is not changed.`
}

/** What the import will carry, by how each row got ready: the lines of the confirm step. */
export function importSummary(views: ReadonlyArray<RowView>): ReadonlyArray<{ label: string; count: number }> {
  const tally = { accepted: 0, kept: 0, edited: 0, auto: 0, plain: 0 }
  for (const view of views)
    if (view.status === "ready")
      O.match(view.decided, {
        onNone: () => {
          tally.plain += 1
        },
        onSome: (decided) => {
          tally[decided] += 1
        }
      })
  return [
    { label: "With a fix you accepted", count: tally.accepted },
    { label: "Kept over a row with the same key", count: tally.kept },
    { label: "With a value you typed or chose", count: tally.edited },
    { label: "Fixed by a rule", count: tally.auto },
    { label: "Unchanged from the file", count: tally.plain }
  ].filter((line) => line.count > 0)
}

/** The caller's kinds by id. */
export const kindsOf = (kinds: ReadonlyArray<ProblemKind>): HashMap.HashMap<string, ProblemKind> =>
  HashMap.fromIterable(kinds.map((kind) => [kind.id, kind] as const))

/**
 * Why a row is where it is, in one sentence for the person: the caller's reason for a row with a problem (whatever
 * its kind, with a fix or none), else its fix's evidence, else the kind's `help`, else its label; the status word for
 * a row left out or already there; nothing for a ready row.
 */
export const reasonOf = (input: {
  view: RowView
  kinds: HashMap.HashMap<string, ProblemKind>
  words: ReviewWords
}): string => {
  const { view } = input
  const words = input.words
  if (view.status === "out") return words.out
  if (view.status === "stored") return words.stored
  return O.match(view.problem, {
    onNone: () => "",
    onSome: (problem) => {
      if (O.isSome(problem.reason) && problem.reason.value !== "") return problem.reason.value
      // A fix carries the evidence for itself: the next best sentence when the caller gave no reason.
      if (O.isSome(problem.fix) && problem.fix.value.why.basis !== "") return problem.fix.value.why.basis
      return O.match(HashMap.get(input.kinds, problem.kind), {
        onNone: () => problem.kind,
        onSome: (kind) => O.match(kind.help, { onNone: () => kind.label, onSome: (help) => help })
      })
    }
  })
}

const csvField = (text: string): string => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text)

/** The rows that will not be imported, as CSV with the reason for each, for the person to fix elsewhere. */
export function heldCsv(input: {
  views: ReadonlyArray<RowView>
  columns: ReadonlyArray<ReviewColumn>
  problemKinds: ReadonlyArray<ProblemKind>
  words: ReviewWords
}): string {
  const kinds = kindsOf(input.problemKinds)
  const lines = [["Row", "Reason", ...input.columns.map((column) => column.label)]]
  for (const view of input.views) {
    if (view.status === "ready") continue
    const reason = reasonOf({ view, kinds, words: input.words })
    lines.push([rowName(view.row), reason, ...input.columns.map((column) => view.row.cells[column.id] ?? "")])
  }
  return lines.map((line) => line.map(csvField).join(",")).join("\n")
}

/**
 * The table's lines while one kind of problem (or the rules' own fixes) is on screen: each group of identical fixes
 * as a heading with its rows under it, then the rows that belong to no group.
 */
export function entries(input: {
  list: ReadonlyArray<RowView>
  groups: ReadonlyArray<FixGroup>
  applied: boolean
}): ReadonlyArray<Entry> {
  const rows = (views: ReadonlyArray<RowView>): ReadonlyArray<Entry> =>
    views.map((view) => ({ type: "row" as const, view }))
  if (input.groups.length === 0) return rows(input.list)
  const owner = MutableHashMap.empty<string, string>()
  for (const group of input.groups) for (const rowId of group.rowIds) MutableHashMap.set(owner, rowId, group.id)
  const ownerOf = (view: RowView): O.Option<string> => MutableHashMap.get(owner, view.row.id)
  const out: Array<Entry> = []
  for (const group of input.groups) {
    out.push({ type: "group" as const, group, applied: input.applied === true })
    out.push(...rows(input.list.filter((view) => O.contains(ownerOf(view), group.id))))
  }
  out.push(...rows(input.list.filter((view) => !MutableHashMap.has(owner, view.row.id))))
  return out
}

/**
 * "Needs you" as the table shows it: one heading per problem kind in the caller's order, then that kind's groups of
 * identical fixes (each a decision of its own, above its rows), then its other rows. A collapsed kind keeps its
 * heading and count and hides its rows.
 */
export function sections(input: {
  list: ReadonlyArray<RowView>
  groups: ReadonlyArray<FixGroup>
  problemKinds: ReadonlyArray<ProblemKind>
  collapsed: (kind: ProblemKind, hasGroups: boolean) => boolean
}): ReadonlyArray<Entry> {
  const out: Array<Entry> = []
  for (const kind of input.problemKinds) {
    const rows = input.list.filter((view) => O.exists(view.problem, (problem) => problem.kind === kind.id))
    if (rows.length === 0) continue
    const groups = input.groups.filter((group) => group.kind === kind.id)
    const collapsed = input.collapsed(kind, groups.length > 0)
    const safe = rows
      .filter((view) =>
        O.exists(
          O.flatMap(view.problem, (problem) => problem.fix),
          (fix) => A.containsWith(sameFix)(view.row.applied, fix)
        )
      )
      .map((view) => view.row.id)
    out.push({ type: "kind" as const, kind, rowIds: rows.map((view) => view.row.id), safe, collapsed })
    if (collapsed) continue
    const lines = entries({ applied: false, list: rows, groups })
    // The rows of no group come last. Straight after a group's rows they read as part of it ("1 row" over six),
    // so a line of their own says where the group ends.
    const grouped = MutableHashSet.fromIterable(groups.flatMap((group) => group.rowIds))
    const loose = rows.filter((view) => !MutableHashSet.has(grouped, view.row.id)).length
    if (groups.length === 0 || loose === 0) out.push(...lines)
    else out.push(...lines.slice(0, -loose), { type: "rest" as const, count: loose }, ...lines.slice(-loose))
  }
  return out
}

/**
 * The phone's decisions, one at a time: a group counts as one decision and its rows are not asked again, unless the
 * person chose to go through that group row by row (`split`). Then every other row that needs them, in file order.
 */
export function queue(input: {
  views: ReadonlyArray<RowView>
  split: Iterable<string>
  /** The rows that cannot be imported as written (`RowView.blocked`) instead of the decisions: each one by itself. */
  blocked: boolean
}): ReadonlyArray<QueueEntry> {
  if (input.blocked === true) {
    return input.views
      .filter((view) => view.status === "needs" && view.blocked === true)
      .map((view): QueueEntry => ({ type: "row" as const, view }))
  }
  const split = HashSet.fromIterable(input.split)
  const groups = waitingGroups({ kind: O.none(), views: input.views }).filter((group) => !HashSet.has(split, group.id))
  const covered = MutableHashSet.fromIterable(groups.flatMap((group) => group.rowIds))
  return [
    ...groups.map((group): QueueEntry => ({ type: "group" as const, group, applied: false })),
    ...input.views
      .filter((view) => view.status === "needs" && view.blocked !== true && !MutableHashSet.has(covered, view.row.id))
      .map((view): QueueEntry => ({ type: "row" as const, view }))
  ]
}

/**
 * A model's guess its guard rated low: a value the file does not hold, on evidence that does not back it (a name
 * with words its description lacks). It is never a row's one-press answer: the row asks the person to type the
 * value, and the guess is offered beside the box with its evidence.
 */
export const weakGuess = (fix: { by: O.Option<string>; confidence: O.Option<string> }): boolean =>
  O.contains(fix.by, "model") && O.contains(fix.confidence, "low")

/** A `low` fix is a question for the person, not something to accept. Its choices are `to` and the alternatives. */
export const choicesOf = (fix: {
  to: string
  confidence: O.Option<string>
  why: { alternatives: ReadonlyArray<string> }
}): O.Option<ReadonlyArray<string>> =>
  O.map(
    O.filter(fix.confidence, (confidence) => confidence === "low"),
    () => [fix.to, ...fix.why.alternatives]
  )

/** What the caller writes, and what it holds with a reason for each row. */
export function result(input: {
  views: ReadonlyArray<RowView>
  problemKinds: ReadonlyArray<ProblemKind>
  words: ReviewWords
}): ImportResult {
  const kinds = kindsOf(input.problemKinds)
  const ready: Array<ReadyRow> = []
  const held: Array<HeldRow> = []
  for (const view of input.views) {
    if (view.status === "ready") {
      const changes: Array<ImportChange> = []
      for (const [column, mark] of Object.entries(view.marks)) {
        if (!isCellMarkApplied(mark) || mark.from === mark.to) continue
        const person = mark.by === "you"
        changes.push(
          ImportChange.make({
            column,
            from: mark.from,
            to: mark.to,
            source: mark.by === "you" ? "person" : mark.by,
            decidedBy: person || mark.accepted ? "person" : "rule",
            how: person ? "typed or chose a value" : mark.accepted ? "accepted a proposal" : "applied by a rule",
            basis: O.map(mark.fix, (fix) => fix.why.basis),
            confidence: O.flatMap(mark.fix, (fix) => fix.confidence)
          })
        )
      }
      ready.push(
        ReadyRow.make({
          id: view.row.id,
          line: view.row.line,
          cells: view.cells,
          changes,
          kept: O.contains(view.decided, "kept")
        })
      )
    } else {
      const reason = reasonOf({ view, kinds, words: input.words })
      held.push(
        HeldRow.make({
          id: view.row.id,
          line: view.row.line,
          reason,
          decidedBy: view.status === "out" ? "person" : view.status === "stored" ? "stored" : "nobody"
        })
      )
    }
  }
  return ImportResult.make({ ready, held })
}

/** The next undecided row after `afterId` in `list`, wrapping round; undefined when none is left. */
export function nextProblem(input: {
  list: ReadonlyArray<RowView>
  afterId: O.Option<string>
  back: boolean
}): O.Option<string> {
  const list = input.list
  const start = O.match(
    A.findFirstIndex(list, (view) => O.contains(input.afterId, view.row.id)),
    { onNone: () => -1, onSome: (index) => index }
  )
  for (let step = 1; step <= list.length; step += 1) {
    const index = input.back === true ? start - step : start + step
    const view = list[((index % list.length) + list.length) % list.length]
    if (view !== undefined && view.status === "needs" && !O.contains(input.afterId, view.row.id))
      return O.some(view.row.id)
  }
  return O.none()
}

/** What a button that takes `value` says for it: the fix's own words for the value (`why.labels`), else the value. */
export const valueWords = (
  fix: { to: string; why: { alternatives: ReadonlyArray<string>; labels: ReadonlyArray<string> } },
  value: string
): string => {
  const at = A.findFirstIndex([fix.to, ...fix.why.alternatives], (candidate) => candidate === value)
  return O.match(
    O.flatMap(at, (at) => A.get(fix.why.labels, at)),
    { onNone: () => value, onSome: (label) => label }
  )
}

/**
 * The column a pick of `value` writes: the fix's own column, or the one its `why.targets` names for that value.
 *
 * @example columnFor({ column: "isActive", to: "false", why: { alternatives: [""], targets: ["isActive", "discontinuedOn"] } }, "") // "discontinuedOn"
 */
export const columnFor = (
  fix: { column: string; to: string; why: { alternatives: ReadonlyArray<string>; targets: ReadonlyArray<string> } },
  value: string
): string => {
  const at = A.findFirstIndex([fix.to, ...fix.why.alternatives], (candidate) => candidate === value)
  return O.match(
    O.flatMap(at, (at) => A.get(fix.why.targets, at)),
    { onNone: () => fix.column, onSome: (column) => column }
  )
}

/**
 * A cell's text as its column draws it: through `display`, then with the row's unit after a plain number when the
 * column takes its unit from another (`unitFrom`). Empty stays empty.
 *
 * @example shownWith({ id: "quantityOnHand", label: "On hand", unitFrom: "uom" }, "120", { uom: "EA" }) // "120 EA"
 */
export const shownWith = (
  column: { display: ReviewColumn["display"]; unitFrom: ReviewColumn["unitFrom"] },
  text: string,
  cells: Readonly<Record<string, string>>
): string => {
  if (text === "") return text
  const shown = column.display(text)
  return O.match(
    O.flatMap(column.unitFrom, (id) => R.get(cells, id)),
    {
      onNone: () => shown,
      onSome: (text) => {
        const unit = text.trim()
        return unit !== "" && /^-?\d[\d,]*(\.\d+)?$/.test(shown.trim()) ? `${shown} ${unit}` : shown
      }
    }
  )
}

/** Words in a "Why?" answer, heading excluded. The region's budget is 25. */
export const whyWords = (why: { basis: Why["basis"]; detail: Why["detail"] }): number => {
  const count = (text: string) => A.length(A.filter(text.split(/\s+/), (word) => word !== ""))
  return count(why.basis) + O.match(why.detail, { onNone: () => 0, onSome: count })
}

/** "1 row", "5 rows". */
export const rowsWord = (n: number): string => `${n} ${n === 1 ? "row" : "rows"}`

// ---------------------------------------------------------------------------------------------------------------
// Picks with no default, group words, and the caller's own answer on a row
// ---------------------------------------------------------------------------------------------------------------

/** A choice's words on its button: the label, its note after a comma, and "(suggested)" when the caller suggests it. */
export const choiceText = (choice: Choice): string =>
  O.match(choice.note, {
    onNone: () => `${choice.label}${choice.suggested ? " (suggested)" : ""}`,
    onSome: (note) => `${choice.label}, ${note}${choice.suggested ? " (suggested)" : ""}`
  })

/** The choice the person picked on a row with `problem.choices`, while the row's value is one of them. */
export const pickedChoice = (view: RowView): O.Option<Choice> => {
  const column = O.flatMap(view.row.problem, (problem) => problem.column)
  const choices = O.flatMap(view.row.problem, (problem) => problem.choices)
  if (O.isNone(column) || O.isNone(choices) || !O.exists(R.get(view.marks, column.value), (mark) => mark.by === "you"))
    return O.none()
  return A.findFirst(choices.value, (choice) => choice.value === view.cells[column.value])
}

/**
 * A group heading's button: the change by its `label` (rows that end in different values) or by its value, for the
 * rows ticked under it or, where each row keeps its own answers (`rowAction`) and has no tick, for all of them.
 */
export const groupUse = (input: { group: FixGroup; n: number; ticks: boolean }): string =>
  `${input.group.mixed === true ? "Accept" : `Use ${O.match(input.group.label, { onNone: () => valueWords(input.group, input.group.to), onSome: (label) => label })}`} ${input.ticks ? `for the ${input.n} ticked` : `for all ${input.n}`}`

/** One entry of "Other answers": typing a value, leaving the row out, or the caller's own answer. */
export type OtherAnswer = Data.TaggedEnum<{
  /** Type a value instead of taking the proposal. */
  Type: {}
  LeaveOut: { readonly label: string }
  /** The caller's own answer for the row (`rowAction`). */
  Extra: { readonly label: string }
}>
/** Builds and tells apart the entries of "Other answers". */
export const OtherAnswer = Data.taggedEnum<OtherAnswer>()

/**
 * What "Other answers" holds on a row that needs the person when the caller has an answer of its own for it
 * (`rowAction`): typing a value when the row's own answer is a proposal (typing is the row's own answer when there is
 * none, and a pick has none), leaving the row out, then the caller's answer, each in full. Undefined when the caller
 * has none for this row: the row then shows "Leave out" as any row does.
 */
export function otherAnswers(input: {
  view: RowView
  extra: O.Option<RowAction>
}): O.Option<ReadonlyArray<OtherAnswer>> {
  const { view, extra } = input
  const problem = view.status === "needs" ? view.problem : O.none()
  if (O.isNone(problem) || O.isNone(extra)) return O.none()
  const subject = problem.value.column
  const proposed = O.flatMap(subject, (column) => R.get(view.marks, column))
  const typing = O.isNone(problem.value.choices) && O.exists(proposed, isCellMarkProposed)
  return O.some([
    ...(typing ? [OtherAnswer.Type()] : []),
    OtherAnswer.LeaveOut({ label: `Leave row ${rowName(view.row)} out` }),
    OtherAnswer.Extra({ label: extra.value.label })
  ])
}

// ---------------------------------------------------------------------------------------------------------------
// Words for a typed value, the work list, and the decisions left
// ---------------------------------------------------------------------------------------------------------------

/** A column's name inside a sentence: lower case, except a name in capitals ("SKU") or one with a capital inside it. */
export const inSentence = (label: string): string =>
  label === label.toUpperCase() || /.[A-Z]/.test(label) ? label : label.toLowerCase()

/**
 * The button that opens the one field for a value the person types, when the caller gave no `ask`: "Set" and the
 * column's name, so no article has to be guessed ("a item #", "a why" were wrong, and "an SKU" or "a SKU" depends on
 * how it is said). The outcome is named, as every button here names its outcome.
 *
 * @example askFor("Item #") // "Set item #"
 * @example askFor("SKU") // "Set SKU"
 */
export const askFor = (label: string): string => `Set ${inSentence(label.trim())}`

/** One line of the work list: a problem kind, how many of its rows still need the person, and whether it is done. */
export type WorkItem = { kind: ProblemKind; left: number; done: boolean }

/**
 * The work list beside the table: every problem kind that has rows waiting, or had some since the review opened
 * (`seen`), in the caller's order, each with how many are left. A kind that is finished stays, ticked, so the person
 * sees the list go down instead of lines disappearing. The `left` counts add up to `counts.needs`.
 */
export function workList(input: {
  counts: Counts
  problemKinds: ReadonlyArray<ProblemKind>
  seen: HashSet.HashSet<string>
}): ReadonlyArray<WorkItem> {
  return input.problemKinds.flatMap((kind) => {
    const left = kindCount(input.counts, kind.id)
    return left > 0 || HashSet.has(input.seen, kind.id) ? [{ kind, left, done: left === 0 }] : []
  })
}

/**
 * The kind "Next problem" goes to once `from` has no row left: the next kind down the list with rows waiting, then
 * from the top. Undefined when nothing is left anywhere.
 */
export function nextKind(input: { list: ReadonlyArray<WorkItem>; from: O.Option<string> }): O.Option<string> {
  const at = input.list.findIndex((item) => O.contains(input.from, item.kind.id))
  const order = [...input.list.slice(at + 1), ...input.list.slice(0, at + 1)]
  return O.map(
    A.findFirst(order, (item) => item.left > 0),
    (item) => item.kind.id
  )
}

/**
 * How many decisions are left: one per group of identical fixes, one per other row that needs the person. The same
 * number the phone counts its cards by, so "Decision 2 of 60" and "59 decisions left" agree.
 */
export const decisionsLeft = (views: ReadonlyArray<RowView>, split: Iterable<string>): number =>
  queue({ blocked: false, views, split }).length
