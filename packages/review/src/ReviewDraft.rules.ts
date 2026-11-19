/**
 * The review region's rules as pure functions, so they can be tested without a browser: how a row stands after the
 * person's decisions, the counts that must add up, what one accept may touch, and what the import button says.
 * The one thing a reader must not break: a proposal never replaces a decision the person already made.
 *
 * Collections are Effect's: `HashMap` and `HashSet` for what a step hands on (the decisions, an undo step, the
 * counts), `MutableHashMap` and `MutableHashSet` for what one function fills and reads. A `WeakMap` stays where an
 * entry must go when its key does (the undo history beside a draft, the view of an untouched row): Effect has no weak
 * collection.
 */
import { isKept, isLeftOut, kept, leftOut, putBack, ReviewDecision } from "@inventory/review/ReviewDecision"
import { HashMap, HashSet, MutableHashMap, MutableHashSet, Option } from "effect"
import type {
  CellMark,
  DraftStep,
  Choice,
  Counts,
  Entry,
  QueueEntry,
  FilterId,
  Fix,
  FixGroup,
  ImportChange,
  ImportResult,
  Problem,
  ProblemKind,
  ReviewColumn,
  ReviewDraft,
  ReviewRow,
  ReviewState,
  RowAction,
  RowDecision,
  ReviewWords,
  RowView,
  SavedDecisions,
  UndoStep
} from "@inventory/review/ReviewTypes"
import { defaultReviewWords } from "@inventory/review/ReviewWords"

/**
 * How a sentence names a row after "row": its label when the caller gave one ("8 · Feb", one of several records on
 * line 8), otherwise its line.
 *
 * @example rowName({ id: "row-8.2", line: 8, label: "8 · Feb", cells: {} }) // "8 · Feb"
 */
export const rowName = (row: Pick<ReviewRow, "line" | "label">): string => row.label ?? String(row.line)

/** A decision that says nothing yet: what a row without one starts from. */
const undecided = ReviewDecision.make({})

/** Kept over its rivals, now or before it was left out: what today's rows read as the `kept` flag. */
const keptFlag = (decision: RowDecision): boolean =>
  isKept(decision.place) || (decision.place.kind === "leftOut" && decision.place.wasKept)

/** True when the person left the row out. */
const leftOutRow = (decision: RowDecision | undefined): boolean => decision !== undefined && isLeftOut(decision.place)

/** The decision with the row left out, remembering whether it had been kept. */
const leaveOut = (decision: RowDecision | undefined): RowDecision =>
  ReviewDecision.make({ ...(decision ?? undecided), place: leftOut(decision !== undefined && keptFlag(decision)) })

export const emptyState: ReviewState = { decisions: HashMap.empty(), undo: [], redo: [] }

/**
 * Where a review starts when the rules' own fixes must be asked first (the default): every `row.applied` fix is
 * held back as a proposal, so nothing from the file is changed until the person takes it.
 */
export function proposing(rows: ReadonlyArray<ReviewRow>): ReviewState {
  const decisions: Array<readonly [string, RowDecision]> = []
  for (const row of rows) {
    if (row.applied !== undefined && row.applied.length > 0) {
      decisions.push([row.id, ReviewDecision.make({ reverted: row.applied.map((fix) => fix.column) })])
    }
  }
  return { decisions: HashMap.fromIterable(decisions), undo: [], redo: [] }
}

/**
 * The state behind each object `saved` handed out, while the page is open. A page that shows another view unmounts
 * the region; handing the same object back brings the undo history with it. Held weakly: a dropped draft is freed.
 */
const histories = new WeakMap<SavedDecisions, ReviewState>()

/** The decisions as plain data, for a draft. The object itself is plain; the undo history is remembered beside it. */
export const saved = (state: ReviewState): SavedDecisions => {
  const data: SavedDecisions = Object.fromEntries(state.decisions)
  histories.set(data, state)
  return data
}

/**
 * A review restored from `saved` data. The very object `saved` returned comes back as it was, undo history and all
 * (the region drawn again after the page showed another view, or `fromDraft` after a refresh); a plain copy or
 * another device starts a new history from the same decisions.
 */
export const restored = (decisions: SavedDecisions): ReviewState =>
  histories.get(decisions) ?? { decisions: HashMap.fromIterable(Object.entries(decisions)), undo: [], redo: [] }

const toDraftStep = (step: UndoStep): DraftStep => ({
  label: step.label,
  before: [...step.before].map(([rowId, decision]) => [rowId, decision ?? null] as const),
  focus: step.focus ?? null
})

const fromDraftStep = (step: DraftStep): UndoStep => ({
  label: step.label,
  before: HashMap.fromIterable(step.before.map(([rowId, decision]) => [rowId, decision ?? undefined] as const)),
  focus: step.focus ?? undefined
})

/**
 * The decisions `saved` handed out, with their undo history, as plain data that survives JSON: what a page keeps in
 * the browser so a refresh or a closed tab loses neither a decision nor "Undo last step". An object `saved` did not
 * hand out (a copy) has no history to give, and its draft starts with none.
 */
export const toDraft = (decisions: SavedDecisions): ReviewDraft => ({
  decisions: { ...decisions },
  undo: (histories.get(decisions)?.undo ?? []).map(toDraftStep),
  redo: (histories.get(decisions)?.redo ?? []).map(toDraftStep)
})

/**
 * Decisions to hand the region back after a refresh (`savedDecisions`): the very object it restores with its undo
 * history, rebuilt from a `toDraft` draft. Undoing after the refresh then takes back the last step taken before it.
 */
export const fromDraft = (draft: ReviewDraft): SavedDecisions =>
  saved({
    decisions: HashMap.fromIterable(Object.entries(draft.decisions)),
    undo: draft.undo.map(fromDraftStep),
    redo: (draft.redo ?? []).map(fromDraftStep)
  })

type Recheck = ((input: { row: ReviewRow; cells: Readonly<Record<string, string>> }) => Problem | undefined) | undefined

/** Whether a problem kind can be settled on this screen, from the caller's kinds (`ProblemKind.fixable`). */
type Fixable = (kind: string) => boolean

const allFixable: Fixable = () => true

/** The kinds nothing on this screen can settle, as a test on a kind's id. */
export const fixableBy = (kinds: ReadonlyArray<ProblemKind> | undefined): Fixable => {
  const not = (kinds ?? []).filter((kind) => kind.fixable === false).map((kind) => kind.id)
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
  const view = build(row, undefined, () => false, undefined, fixable)
  untouched.set(row, { fixable, view })
  return view
}

const sourceOf = (fix: Fix): "rule" | "model" | "unknown" => fix.by ?? "unknown"

/** A problem with its proposal taken off: what is left once the person rejected it. */
const withoutFix = (problem: Problem): Problem => {
  const { fix: _fix, ...rest } = problem
  return rest
}

function build(
  row: ReviewRow,
  decision: RowDecision | undefined,
  settled: (rowId: string, column: string | undefined) => boolean,
  recheck: Recheck,
  fixable: Fixable,
  rejects = false
): RowView {
  if (row.stored === true) return { row, status: "stored", cells: row.cells, marks: {} }
  const cells: Record<string, string> = { ...row.cells }
  const marks: Record<string, CellMark> = {}
  const reverted = decision?.reverted ?? []
  // Where a fix the person undid or rejected stays rejected (`rejects`), its problem is left without the proposal:
  // the file's value stands and the row waits for a typed value.
  const gone = (fix: Fix | undefined): boolean => rejects && fix !== undefined && reverted.includes(fix.column)
  const open: Array<Problem> =
    row.problem === undefined ? [] : [gone(row.problem.fix) ? withoutFix(row.problem) : row.problem]
  const accepted = decision?.accepted ?? []
  const edits = decision?.edits ?? {}
  let auto = false
  let took = false

  for (const fix of row.applied ?? []) {
    if (reverted.includes(fix.column))
      open.push({
        kind: fix.kind,
        column: fix.column,
        ...(rejects ? {} : { fix }),
        ...(fix.reason === undefined ? {} : { reason: fix.reason })
      })
    else {
      if (accepted.includes(fix.column)) took = true
      else auto = true
      marks[fix.column] = {
        state: "applied",
        from: row.cells[fix.column] ?? "",
        to: fix.to,
        by: sourceOf(fix),
        fix,
        ...(accepted.includes(fix.column) ? { accepted: true } : {})
      }
      cells[fix.column] = fix.to
    }
  }

  let problem: Problem | undefined
  for (const candidate of open) {
    const column = candidate.column
    if (column !== undefined && Object.hasOwn(edits, column)) continue
    if (candidate.fix !== undefined && accepted.includes(candidate.fix.column)) {
      const fix = candidate.fix
      marks[fix.column] = {
        state: "applied",
        from: row.cells[fix.column] ?? "",
        to: fix.to,
        by: sourceOf(fix),
        fix,
        accepted: true
      }
      cells[fix.column] = fix.to
      took = true
      continue
    }
    if (candidate.rivals !== undefined) {
      if (decision !== undefined && keptFlag(decision)) continue
      if (candidate.rivals.every((rival) => settled(rival, column))) continue
    }
    problem ??= candidate
  }

  let typed = false
  for (const column of Object.keys(edits)) {
    const value = edits[column] ?? ""
    marks[column] = { state: "applied", from: row.cells[column] ?? "", to: value, by: "you" }
    cells[column] = value
    typed = true
  }
  // The caller's rules never saw a typed value, so they look at the row again. Accepted fixes came from them.
  // What the rules say then stands, a row they find nothing wrong with included: a pick written to another column
  // (an empty Discontinued on) settles a question asked on this one. Only a copy's problem is kept when they find
  // nothing, since whether it was kept is a decision they do not see.
  if (typed && recheck !== undefined)
    problem = recheck({ row, cells }) ?? (problem?.rivals === undefined ? undefined : problem)
  if (problem !== undefined && gone(problem.fix)) problem = withoutFix(problem)

  if (problem?.fix !== undefined && !leftOutRow(decision)) {
    const fix = problem.fix
    marks[fix.column] = { state: "proposed", from: cells[fix.column] ?? "", to: fix.to, by: sourceOf(fix), fix }
  }

  // A problem nothing here can settle is counted apart from the ones the person can decide.
  const status = leftOutRow(decision)
    ? "out"
    : problem === undefined
      ? "ready"
      : fixable(problem.kind)
        ? "needs"
        : "cannot"
  if (problem !== undefined) {
    // The caller's word first (it knows every problem of the row), else the tone of the one that shows.
    const blocked = status === "needs" && (row.blocked ?? problem.tone === "blocker")
    return blocked ? { row, status, cells, marks, problem, blocked } : { row, status, cells, marks, problem }
  }
  const decided = typed
    ? "edited"
    : decision !== undefined && keptFlag(decision)
      ? "kept"
      : took
        ? "accepted"
        : auto
          ? "auto"
          : undefined
  return decided === undefined || status !== "ready"
    ? { row, status, cells, marks }
    : { row, status, cells, marks, decided }
}

/** Every row as it stands now, in file order. Rows without a decision reuse one cached answer. */
export function viewRows(input: {
  rows: ReadonlyArray<ReviewRow>
  state: ReviewState
  recheck?: Recheck
  /** The caller's kinds: a row whose problem is of a kind marked `fixable: false` is `cannot`, not `needs`. */
  fixable?: Fixable
  /**
   * A fix whose column is in `RowDecision.reverted` is rejected, not offered again: the file's value stands and the
   * row waits for the person. Without it (rule fixes held back as proposals) a reverted fix is a proposal to take.
   */
  rejects?: boolean
}): ReadonlyArray<RowView> {
  const fixable = input.fixable ?? allFixable
  const decisions = input.state.decisions
  const none = HashMap.isEmpty(decisions)
  // Read once into a record, then looked up per row: at 50,000 rows a HashMap lookup per row (twice per decision
  // press, once in `act` and once for the screen) made a press measurably slower. Row ids are the region's own.
  const byRow: Readonly<Record<string, RowDecision>> = Object.fromEntries(decisions)
  const decisionOf = (rowId: string): RowDecision | undefined =>
    Object.hasOwn(byRow, rowId) ? byRow[rowId] : undefined
  // A copy is settled once it is left out, or once the person typed a new value into the cell they shared.
  const settled = (rowId: string, column: string | undefined): boolean => {
    const decision = decisionOf(rowId)
    if (decision === undefined) return false
    if (isLeftOut(decision.place)) return true
    return column !== undefined && Object.hasOwn(decision.edits, column)
  }
  return input.rows.map((row) => {
    const decision = none ? undefined : decisionOf(row.id)
    if (decision === undefined && (row.problem?.rivals === undefined || none)) {
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
      const kind = view.problem?.kind ?? ""
      MutableHashMap.set(kinds, kind, Option.getOrElse(MutableHashMap.get(kinds, kind), () => 0) + 1)
    }
    for (const fix of view.row.applied ?? []) {
      const mark = view.marks[fix.column]
      if (mark !== undefined && mark.state === "applied" && mark.by !== "you" && mark.accepted !== true) applied += 1
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
export const kindCount = (counts: Counts, kind: string): number =>
  Option.getOrElse(HashMap.get(counts.kinds, kind), () => 0)

/** The rows a filter shows, in file order. A problem kind narrows the needs view only. */
export function visible(input: {
  views: ReadonlyArray<RowView>
  filter: FilterId
  kind?: string | undefined
}): ReadonlyArray<RowView> {
  if (input.filter === "all") return input.views
  if (input.filter === "auto") return input.views.filter((view) => view.decided === "auto")
  // A row that must have a value typed first is listed under "cannot", though it still takes answers.
  if (input.filter === "cannot") return input.views.filter((view) => view.status === "cannot" || view.blocked === true)
  return input.views.filter(
    (view) =>
      view.status === input.filter &&
      view.blocked !== true &&
      (input.filter !== "needs" || input.kind === undefined || view.problem?.kind === input.kind)
  )
}

/** A group being gathered: its fix, its rows and the file's spelling on each. */
type Gathered = { fix: Fix; rowIds: Array<string>; froms: Array<string>; mixed?: boolean }

/** Adds a row's fix to its group, noting when it ends in another value than the group's first. */
const gather = (group: Gathered, rowId: string, from: string, fix: Fix): Gathered => {
  group.rowIds.push(rowId)
  group.froms.push(from)
  if (fix.to !== group.fix.to) group.mixed = true
  return group
}

/** One value named for rows that get different ones would be false: such a group says so, unless it has a label. */
const mixedOf = (group: Gathered): { mixed?: boolean } =>
  group.mixed === true && group.fix.label === undefined ? { mixed: true } : {}

const variantsOf = (froms: ReadonlyArray<string>): ReadonlyArray<{ from: string; count: number }> => {
  const tally = MutableHashMap.empty<string, number>()
  for (const from of froms)
    MutableHashMap.set(tally, from, Option.getOrElse(MutableHashMap.get(tally, from), () => 0) + 1)
  return [...tally].map(([from, n]) => ({ from, count: n })).sort((a, b) => b.count - a.count)
}

/**
 * The grouped fixes still waiting, largest first. Only undecided rows whose open problem carries a grouped fix are
 * in a group, so accepting one can never touch a row the person already decided.
 */
export function waitingGroups(input: {
  views: ReadonlyArray<RowView>
  kind?: string | undefined
}): ReadonlyArray<FixGroup> {
  const found = MutableHashMap.empty<string, Gathered>()
  for (const view of input.views) {
    const fix = view.problem?.fix
    // A row that cannot be imported as written is never part of a one-press group.
    if (view.status !== "needs" || view.blocked === true || fix === undefined || fix.group === undefined) continue
    if (input.kind !== undefined && view.problem?.kind !== input.kind) continue
    const group = Option.getOrElse(MutableHashMap.get(found, fix.group), (): Gathered => ({
      fix,
      rowIds: [],
      froms: []
    }))
    MutableHashMap.set(found, fix.group, gather(group, view.row.id, view.row.cells[fix.column] ?? "", fix))
  }
  return [...found]
    .map(([id, group]) => ({
      id,
      kind: group.fix.kind,
      column: group.fix.column,
      to: group.fix.to,
      ...(group.fix.label === undefined ? {} : { label: group.fix.label }),
      ...mixedOf(group),
      by: sourceOf(group.fix),
      ...(group.fix.confidence === undefined ? {} : { confidence: group.fix.confidence }),
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
    for (const fix of view.row.applied ?? []) {
      const mark = view.marks[fix.column]
      if (mark === undefined || mark.state !== "applied" || mark.by === "you") continue
      const id = fix.group ?? `${fix.column}:${fix.to}`
      const group = Option.getOrElse(MutableHashMap.get(found, id), (): Gathered => ({ fix, rowIds: [], froms: [] }))
      MutableHashMap.set(found, id, gather(group, view.row.id, mark.from, fix))
    }
  }
  return [...found].map(([id, group]) => ({
    id,
    kind: group.fix.kind,
    column: group.fix.column,
    to: group.fix.to,
    ...(group.fix.label === undefined ? {} : { label: group.fix.label }),
    ...mixedOf(group),
    by: sourceOf(group.fix),
    ...(group.fix.confidence === undefined ? {} : { confidence: group.fix.confidence }),
    variants: variantsOf(group.froms),
    rowIds: group.rowIds,
    why: group.fix.why
  }))
}

/** "ea (6) · each (3)": the spellings in a group with their row counts. */
export const variantsText = (group: FixGroup, display?: (value: string) => string): string =>
  group.variants
    .map(
      (variant) =>
        `${display === undefined || variant.from === "" ? spellingOf(variant.from) : display(variant.from)} (${variant.count})`
    )
    .join(" · ")

/**
 * A value from the file as the person can tell it apart: "empty" for nothing, and quotation marks around a value
 * with spaces at its ends, because `Foot ` beside `Foot` otherwise reads as no change at all.
 */
export const spellingOf = (from: string): string => (from === "" ? "empty" : from !== from.trim() ? `“${from}”` : from)

// ---------------------------------------------------------------------------------------------------------------
// The person's actions. Each is one undo step.
// ---------------------------------------------------------------------------------------------------------------

export type Action =
  | { type: "accept"; rowIds: ReadonlyArray<string> }
  | { type: "acceptGroup"; groupId: string; except?: ReadonlyArray<string> }
  /** The person's own value for every row of a group: accepts where it is the proposed value, types it elsewhere. */
  | { type: "chooseGroup"; groupId: string; value: string; except?: ReadonlyArray<string> }
  | { type: "keep"; rowId: string }
  | { type: "leaveOut"; rowIds: ReadonlyArray<string> }
  | { type: "putBack"; rowId: string }
  | { type: "edit"; rowId: string; column: string; value: string }
  | { type: "revertGroup"; groupId: string }
  /** One fix on one row taken out of force: a fix made for the person undone, or a proposal rejected. */
  | { type: "revert"; rowId: string; column: string; how: "undo" | "reject" }
  | { type: "undo" }
  /** Puts the last step taken back in force again. */
  | { type: "redo" }

export type Outcome = {
  state: ReviewState
  /** What to announce ("12 fixes accepted"). Empty when nothing changed. */
  label: string
  /** The rows whose decision changed. */
  changed: ReadonlyArray<string>
  /** After an undo or a redo: the row to return focus to. */
  focus?: string | undefined
}

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
    before: HashMap.map(step.before, (_, rowId) => Option.getOrUndefined(HashMap.get(decisions, rowId))),
    focus: step.focus
  }
  const next = HashMap.mutate(decisions, (draft) => {
    for (const [rowId, before] of step.before) {
      if (before === undefined) HashMap.remove(draft, rowId)
      else HashMap.set(draft, rowId, before)
    }
  })
  return { decisions: next, mirror }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

const without = (list: ReadonlyArray<string> | undefined, item: string): ReadonlyArray<string> =>
  (list ?? []).filter((entry) => entry !== item)

/** Whether the person has said anything about this row. Proposals and group actions leave such rows alone. */
const decidedByPerson = (decision: RowDecision | undefined): boolean =>
  decision !== undefined && (isLeftOut(decision.place) || keptFlag(decision) || Object.keys(decision.edits).length > 0)

/** Applies one action. Unknown rows and rows the action does not fit are skipped, never guessed at. */
export function act(input: {
  rows: ReadonlyArray<ReviewRow>
  state: ReviewState
  action: Action
  recheck?: Recheck
  fixable?: Fixable
  rejects?: boolean
}): Outcome {
  const { state, action } = input
  const redo = state.redo ?? []
  if (action.type === "undo") {
    const step = state.undo[state.undo.length - 1]
    if (step === undefined) return { state, label: "", changed: [] }
    const { decisions, mirror } = swap(state.decisions, step)
    return {
      state: { decisions, undo: state.undo.slice(0, -1), redo: [...redo, mirror] },
      label: `Undone: ${step.label}`,
      changed: [...HashMap.keys(step.before)],
      focus: step.focus
    }
  }
  if (action.type === "redo") {
    const step = redo[redo.length - 1]
    if (step === undefined) return { state, label: "", changed: [] }
    const { decisions, mirror } = swap(state.decisions, step)
    return {
      state: { decisions, undo: [...state.undo, mirror], redo: redo.slice(0, -1) },
      label: `Redone: ${step.label}`,
      changed: [...HashMap.keys(step.before)],
      focus: step.focus
    }
  }

  const views = viewRows({
    rows: input.rows,
    state,
    recheck: input.recheck,
    ...(input.fixable === undefined ? {} : { fixable: input.fixable }),
    ...(input.rejects === undefined ? {} : { rejects: input.rejects })
  })
  const byId = MutableHashMap.fromIterable(views.map((view) => [view.row.id, view] as const))
  const viewOf = (rowId: string): RowView | undefined => Option.getOrUndefined(MutableHashMap.get(byId, rowId))
  const decisionOf = (rowId: string): RowDecision | undefined =>
    Option.getOrUndefined(HashMap.get(state.decisions, rowId))
  const next = MutableHashMap.empty<string, RowDecision>()
  let label = ""

  /** Accepting a fix: an undone rule fix goes back into force, a proposal is marked accepted. */
  const accept = (view: RowView): void => {
    const fix = view.problem?.fix
    if (view.status !== "needs" || fix === undefined) return
    const decision = decisionOf(view.row.id) ?? undecided
    const wasApplied = (view.row.applied ?? []).some((applied) => applied.column === fix.column)
    MutableHashMap.set(
      next,
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

  switch (action.type) {
    case "accept": {
      for (const rowId of action.rowIds) {
        const view = viewOf(rowId)
        if (view !== undefined) accept(view)
      }
      label = `${plural(MutableHashMap.size(next), "fix", "fixes")} accepted`
      break
    }
    case "acceptGroup": {
      const group = waitingGroups({ views }).find((candidate) => candidate.id === action.groupId)
      for (const rowId of group?.rowIds ?? []) {
        if (action.except?.includes(rowId) === true) continue
        const view = viewOf(rowId)
        if (view !== undefined) accept(view)
      }
      label = `${plural(MutableHashMap.size(next), "fix", "fixes")} accepted`
      break
    }
    case "keep": {
      const view = viewOf(action.rowId)
      if (view === undefined || view.status !== "needs" || view.problem?.rivals === undefined) break
      MutableHashMap.set(
        next,
        action.rowId,
        ReviewDecision.make({ ...(decisionOf(action.rowId) ?? undecided), place: kept })
      )
      let left = 0
      for (const rival of view.problem.rivals) {
        const decision = decisionOf(rival)
        if (!MutableHashMap.has(byId, rival) || decidedByPerson(decision)) continue
        MutableHashMap.set(next, rival, leaveOut(decision))
        left += 1
      }
      label = left === 0 ? "Row kept" : `Row kept, ${plural(left, "copy", "copies")} left out`
      break
    }
    case "chooseGroup": {
      const group = waitingGroups({ views }).find((candidate) => candidate.id === action.groupId)
      for (const rowId of group?.rowIds ?? []) {
        if (action.except?.includes(rowId) === true) continue
        const view = viewOf(rowId)
        if (view === undefined) continue
        // Each row's own proposal: under a `label` the rows of one group end in different values.
        if (action.value === view.problem?.fix?.to) accept(view)
        else {
          const decision = decisionOf(rowId) ?? undecided
          const column = view.problem?.fix === undefined ? group!.column : columnFor(view.problem.fix, action.value)
          MutableHashMap.set(
            next,
            rowId,
            ReviewDecision.make({ ...decision, edits: { ...decision.edits, [column]: action.value } })
          )
        }
      }
      label = `${plural(MutableHashMap.size(next), "row", "rows")} set to ${action.value}`
      break
    }
    case "leaveOut": {
      for (const rowId of action.rowIds) {
        const view = viewOf(rowId)
        // A row already in the system, or one nothing here can fix, is not imported whatever the person does: there
        // is nothing to leave out.
        if (view === undefined || view.status === "out" || view.status === "stored" || view.status === "cannot")
          continue
        MutableHashMap.set(next, rowId, leaveOut(decisionOf(rowId)))
      }
      label = `${plural(MutableHashMap.size(next), "row", "rows")} left out`
      break
    }
    case "putBack": {
      const decision = decisionOf(action.rowId)
      if (decision === undefined || !isLeftOut(decision.place)) break
      MutableHashMap.set(next, action.rowId, ReviewDecision.make({ ...decision, place: putBack(decision.place) }))
      label = "Row put back"
      break
    }
    case "edit": {
      const view = viewOf(action.rowId)
      if (view === undefined || view.status === "stored" || view.status === "cannot") break
      const decision = decisionOf(action.rowId) ?? undecided
      MutableHashMap.set(
        next,
        action.rowId,
        ReviewDecision.make({ ...decision, edits: { ...decision.edits, [action.column]: action.value } })
      )
      label = "Value changed"
      break
    }
    case "revert": {
      const view = viewOf(action.rowId)
      const mark = view?.marks[action.column]
      // Only a fix that is in force or waiting, and not a value the person typed themselves.
      if (view === undefined || mark === undefined || mark.by === "you" || view.status === "stored") break
      const decision = decisionOf(action.rowId) ?? undecided
      MutableHashMap.set(
        next,
        action.rowId,
        ReviewDecision.make({
          ...decision,
          reverted: [...without(decision.reverted, action.column), action.column],
          accepted: without(decision.accepted, action.column)
        })
      )
      label = action.how === "undo" ? "Fix undone" : "Proposal rejected"
      break
    }
    case "revertGroup": {
      const group = appliedGroups(views).find((candidate) => candidate.id === action.groupId)
      for (const rowId of group?.rowIds ?? []) {
        const decision = decisionOf(rowId) ?? undecided
        MutableHashMap.set(
          next,
          rowId,
          ReviewDecision.make({
            ...decision,
            reverted: [...without(decision.reverted, group!.column), group!.column],
            accepted: without(decision.accepted, group!.column)
          })
        )
      }
      label = `${plural(MutableHashMap.size(next), "fix", "fixes")} undone`
      break
    }
  }

  if (MutableHashMap.isEmpty(next)) return { state, label: "", changed: [] }
  const changes = [...next]
  const decisions = HashMap.setMany(state.decisions, changes)
  const before = HashMap.fromIterable(changes.map(([rowId]) => [rowId, decisionOf(rowId)] as const))
  const focus =
    action.type === "keep" || action.type === "putBack" || action.type === "edit" || action.type === "revert"
      ? action.rowId
      : undefined
  const step: UndoStep = { label, before, focus: focus ?? changes[0]?.[0] }
  // A new decision starts a new future: what was taken back can no longer be redone.
  return {
    state: { decisions, undo: [...state.undo, step], redo: [] },
    label,
    changed: changes.map(([rowId]) => rowId)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The footer
// ---------------------------------------------------------------------------------------------------------------

export type Primary =
  | { label: string; blocked: false }
  /** The label names what stands in the way; pressing the button goes there instead of importing. */
  | { label: string; blocked: true; columnId?: string }
  /** Decisions are open and nothing is ready yet: the button says so and cannot be pressed. */
  | { label: string; blocked: true; idle: true }
  /** Nothing in the file can be imported, and nothing is left to decide: words stand where the button was. */
  | { label: string; blocked: true; done: true }

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
  closing?: string | undefined
  words?: ReviewWords | undefined
}): Primary {
  const words = input.words ?? defaultReviewWords
  const unmatched = input.columns.find((column) => column.match?.state === "unmatched")
  if (unmatched !== undefined) {
    return { label: `Match ${unmatched.label} to import`, blocked: true, columnId: unmatched.id }
  }
  const { counts } = input
  if (counts.ready === 0) {
    // Reopened to look, with every remaining row left out: there is nothing to add, and the way out is to close.
    if (input.closing !== undefined && counts.needs === 0) return { label: input.closing, blocked: false }
    if (counts.needs + counts.blocked > 0) return { label: `No ${input.noun[1]} ready yet`, blocked: true, idle: true }
    return {
      label: counts.total > 0 && counts.stored === counts.total ? words.nothingNew : words.nothingToImport,
      blocked: true,
      done: true
    }
  }
  return { label: `Import ${plural(counts.ready, input.noun[0], input.noun[1])}`, blocked: false }
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
export function heldLine(counts: Counts, words: ReviewWords = defaultReviewWords): string {
  if (counts.total === 0) return ""
  const held = counts.needs + counts.cannot + counts.out
  if (held === 0) return counts.stored === 0 ? `All ${counts.total} ${words.ready.toLowerCase()}` : ""
  // Every row that is not imported is in the number, the ones already there too: it is the download's count.
  return `${held + counts.stored} won't be imported: ${tabTally(counts, words)}`
}

/** The sentence in the confirm step: what will not be written, and why. 25 words at most. */
export function confirmLine(input: {
  counts: Counts
  noun: readonly [string, string]
  words?: ReviewWords | undefined
}): string {
  const { counts } = input
  const held = counts.needs + counts.cannot + counts.out + counts.stored
  return `${plural(held, input.noun[0], input.noun[1])} won't be imported (${tabTally(counts, input.words ?? defaultReviewWords)}). Your file is not changed.`
}

/** What the import will carry, by how each row got ready: the lines of the confirm step. */
export function importSummary(views: ReadonlyArray<RowView>): ReadonlyArray<{ label: string; count: number }> {
  const tally = { accepted: 0, kept: 0, edited: 0, auto: 0, plain: 0 }
  for (const view of views) if (view.status === "ready") tally[view.decided ?? "plain"] += 1
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
  words?: ReviewWords | undefined
}): string => {
  const { view } = input
  const words = input.words ?? defaultReviewWords
  if (view.status === "out") return words.out
  if (view.status === "stored") return words.stored
  const problem = view.problem
  if (problem === undefined) return ""
  if (problem.reason !== undefined && problem.reason !== "") return problem.reason
  // A fix carries the evidence for itself: the next best sentence when the caller gave no reason.
  if (problem.fix !== undefined && problem.fix.why.basis !== "") return problem.fix.why.basis
  const kind = Option.getOrUndefined(HashMap.get(input.kinds, problem.kind))
  return kind?.help ?? kind?.label ?? problem.kind
}

const csvField = (text: string): string => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text)

/** The rows that will not be imported, as CSV with the reason for each, for the person to fix elsewhere. */
export function heldCsv(input: {
  views: ReadonlyArray<RowView>
  columns: ReadonlyArray<ReviewColumn>
  problemKinds: ReadonlyArray<ProblemKind>
  words?: ReviewWords | undefined
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
  applied?: boolean
}): ReadonlyArray<Entry> {
  const rows = (views: ReadonlyArray<RowView>): ReadonlyArray<Entry> => views.map((view) => ({ type: "row", view }))
  if (input.groups.length === 0) return rows(input.list)
  const owner = MutableHashMap.empty<string, string>()
  for (const group of input.groups) for (const rowId of group.rowIds) MutableHashMap.set(owner, rowId, group.id)
  const ownerOf = (view: RowView): string | undefined => Option.getOrUndefined(MutableHashMap.get(owner, view.row.id))
  const out: Array<Entry> = []
  for (const group of input.groups) {
    out.push({ type: "group", group, applied: input.applied === true })
    out.push(...rows(input.list.filter((view) => ownerOf(view) === group.id)))
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
    const rows = input.list.filter((view) => view.problem?.kind === kind.id)
    if (rows.length === 0) continue
    const groups = input.groups.filter((group) => group.kind === kind.id)
    const collapsed = input.collapsed(kind, groups.length > 0)
    const safe = rows
      .filter((view) => view.problem?.fix !== undefined && (view.row.applied ?? []).includes(view.problem.fix))
      .map((view) => view.row.id)
    out.push({ type: "kind", kind, rowIds: rows.map((view) => view.row.id), safe, collapsed })
    if (collapsed) continue
    const lines = entries({ list: rows, groups })
    // The rows of no group come last. Straight after a group's rows they read as part of it ("1 row" over six),
    // so a line of their own says where the group ends.
    const grouped = MutableHashSet.fromIterable(groups.flatMap((group) => group.rowIds))
    const loose = rows.filter((view) => !MutableHashSet.has(grouped, view.row.id)).length
    if (groups.length === 0 || loose === 0) out.push(...lines)
    else out.push(...lines.slice(0, -loose), { type: "rest", count: loose }, ...lines.slice(-loose))
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
  blocked?: boolean
}): ReadonlyArray<QueueEntry> {
  if (input.blocked === true) {
    return input.views
      .filter((view) => view.status === "needs" && view.blocked === true)
      .map((view): QueueEntry => ({ type: "row", view }))
  }
  const split = HashSet.fromIterable(input.split)
  const groups = waitingGroups({ views: input.views }).filter((group) => !HashSet.has(split, group.id))
  const covered = MutableHashSet.fromIterable(groups.flatMap((group) => group.rowIds))
  return [
    ...groups.map((group): QueueEntry => ({ type: "group", group, applied: false })),
    ...input.views
      .filter((view) => view.status === "needs" && view.blocked !== true && !MutableHashSet.has(covered, view.row.id))
      .map((view): QueueEntry => ({ type: "row", view }))
  ]
}

/**
 * A model's guess its guard rated low: a value the file does not hold, on evidence that does not back it (a name
 * with words its description lacks). It is never a row's one-press answer: the row asks the person to type the
 * value, and the guess is offered beside the box with its evidence.
 */
export const weakGuess = (fix: { by?: string | undefined; confidence?: string | undefined }): boolean =>
  fix.by === "model" && fix.confidence === "low"

/** A `low` fix is a question for the person, not something to accept. Its choices are `to` and the alternatives. */
export const choicesOf = (fix: {
  to: string
  confidence?: string | undefined
  why: { alternatives?: ReadonlyArray<string> }
}): ReadonlyArray<string> | undefined =>
  fix.confidence === "low" ? [fix.to, ...(fix.why.alternatives ?? [])] : undefined

/** What the caller writes, and what it holds with a reason for each row. */
export function result(input: {
  views: ReadonlyArray<RowView>
  problemKinds: ReadonlyArray<ProblemKind>
  words?: ReviewWords | undefined
}): ImportResult {
  const kinds = kindsOf(input.problemKinds)
  const ready: Array<ImportResult["ready"][number]> = []
  const held: Array<ImportResult["held"][number]> = []
  for (const view of input.views) {
    if (view.status === "ready") {
      const changes: Array<ImportChange> = []
      for (const [column, mark] of Object.entries(view.marks)) {
        if (mark.state !== "applied" || mark.from === mark.to) continue
        const person = mark.by === "you"
        changes.push({
          column,
          from: mark.from,
          to: mark.to,
          source: mark.by === "you" ? "person" : mark.by,
          decidedBy: person || mark.accepted === true ? "person" : "rule",
          how: person ? "typed or chose a value" : mark.accepted === true ? "accepted a proposal" : "applied by a rule",
          ...(mark.fix === undefined ? {} : { basis: mark.fix.why.basis }),
          ...(mark.fix?.confidence === undefined ? {} : { confidence: mark.fix.confidence })
        })
      }
      ready.push({ id: view.row.id, line: view.row.line, cells: view.cells, changes, kept: view.decided === "kept" })
    } else {
      const reason = reasonOf({ view, kinds, words: input.words })
      held.push({
        id: view.row.id,
        line: view.row.line,
        reason,
        decidedBy: view.status === "out" ? "person" : view.status === "stored" ? "stored" : "nobody"
      })
    }
  }
  return { ready, held }
}

/** The next undecided row after `afterId` in `list`, wrapping round; undefined when none is left. */
export function nextProblem(input: {
  list: ReadonlyArray<RowView>
  afterId?: string | undefined
  back?: boolean
}): string | undefined {
  const list = input.list
  const start = input.afterId === undefined ? -1 : list.findIndex((view) => view.row.id === input.afterId)
  for (let step = 1; step <= list.length; step += 1) {
    const index = input.back === true ? start - step : start + step
    const view = list[((index % list.length) + list.length) % list.length]
    if (view !== undefined && view.status === "needs" && view.row.id !== input.afterId) return view.row.id
  }
  return undefined
}

/** What a button that takes `value` says for it: the fix's own words for the value (`why.labels`), else the value. */
export const valueWords = (
  fix: { to: string; why: { alternatives?: ReadonlyArray<string>; labels?: ReadonlyArray<string> } },
  value: string
): string => {
  const at = [fix.to, ...(fix.why.alternatives ?? [])].indexOf(value)
  return (at === -1 ? undefined : fix.why.labels?.[at]) ?? value
}

/**
 * The column a pick of `value` writes: the fix's own column, or the one its `why.targets` names for that value.
 *
 * @example columnFor({ column: "isActive", to: "false", why: { alternatives: [""], targets: ["isActive", "discontinuedOn"] } }, "") // "discontinuedOn"
 */
export const columnFor = (
  fix: { column: string; to: string; why: { alternatives?: ReadonlyArray<string>; targets?: ReadonlyArray<string> } },
  value: string
): string => {
  const at = [fix.to, ...(fix.why.alternatives ?? [])].indexOf(value)
  return (at === -1 ? undefined : fix.why.targets?.[at]) ?? fix.column
}

/**
 * A cell's text as its column draws it: through `display`, then with the row's unit after a plain number when the
 * column takes its unit from another (`unitFrom`). Empty stays empty.
 *
 * @example shownWith({ id: "quantityOnHand", label: "On hand", unitFrom: "uom" }, "120", { uom: "EA" }) // "120 EA"
 */
export const shownWith = (
  column: { display?: ((value: string) => string) | undefined; unitFrom?: string | undefined },
  text: string,
  cells: Readonly<Record<string, string>>
): string => {
  if (text === "") return text
  const shown = column.display === undefined ? text : column.display(text)
  const unit = column.unitFrom === undefined ? "" : (cells[column.unitFrom] ?? "").trim()
  return unit !== "" && /^-?\d[\d,]*(\.\d+)?$/.test(shown.trim()) ? `${shown} ${unit}` : shown
}

/** Words in a "Why?" answer, heading excluded. The region's budget is 25. */
export const whyWords = (why: { basis: string; detail?: string }): number =>
  `${why.basis} ${why.detail ?? ""}`.split(/\s+/).filter((word) => word !== "").length

/** "1 row", "5 rows". */
export const rowsWord = (n: number): string => `${n} ${n === 1 ? "row" : "rows"}`

// ---------------------------------------------------------------------------------------------------------------
// Picks with no default, group words, and the caller's own answer on a row
// ---------------------------------------------------------------------------------------------------------------

/** A choice's words on its button: the label, its note after a comma, and "(suggested)" when the caller suggests it. */
export const choiceText = (choice: Choice): string =>
  `${choice.label}${choice.note === undefined ? "" : `, ${choice.note}`}${choice.suggested === true ? " (suggested)" : ""}`

/** The choice the person picked on a row with `problem.choices`, while the row's value is one of them. */
export const pickedChoice = (view: RowView): Choice | undefined => {
  const column = view.row.problem?.column
  const choices = view.row.problem?.choices
  if (column === undefined || choices === undefined || view.marks[column]?.by !== "you") return undefined
  return choices.find((choice) => choice.value === view.cells[column])
}

/**
 * A group heading's button: the change by its `label` (rows that end in different values) or by its value, for the
 * rows ticked under it or, where each row keeps its own answers (`rowAction`) and has no tick, for all of them.
 */
export const groupUse = (input: { group: FixGroup; n: number; ticks: boolean }): string =>
  `${input.group.mixed === true ? "Accept" : `Use ${input.group.label ?? valueWords(input.group, input.group.to)}`} ${input.ticks ? `for the ${input.n} ticked` : `for all ${input.n}`}`

/** One entry of "Other answers": typing a value, leaving the row out, or the caller's own answer. */
export type OtherAnswer = { type: "type" } | { type: "leaveOut"; label: string } | { type: "action"; label: string }

/**
 * What "Other answers" holds on a row that needs the person when the caller has an answer of its own for it
 * (`rowAction`): typing a value when the row's own answer is a proposal (typing is the row's own answer when there is
 * none, and a pick has none), leaving the row out, then the caller's answer, each in full. Undefined when the caller
 * has none for this row: the row then shows "Leave out" as any row does.
 */
export function otherAnswers(input: {
  view: RowView
  extra: RowAction | undefined
}): ReadonlyArray<OtherAnswer> | undefined {
  const { view, extra } = input
  const problem = view.status === "needs" ? view.problem : undefined
  if (problem === undefined || extra === undefined) return undefined
  const subject = problem.column
  const proposed = subject === undefined ? undefined : view.marks[subject]
  const typing = problem.choices === undefined && proposed?.state === "proposed"
  return [
    ...(typing ? [{ type: "type" } as const] : []),
    { type: "leaveOut", label: `Leave row ${rowName(view.row)} out` },
    { type: "action", label: extra.label }
  ]
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
export function nextKind(input: { list: ReadonlyArray<WorkItem>; from: string | undefined }): string | undefined {
  const at = input.list.findIndex((item) => item.kind.id === input.from)
  const order = [...input.list.slice(at + 1), ...input.list.slice(0, at + 1)]
  return order.find((item) => item.left > 0)?.kind.id
}

/**
 * How many decisions are left: one per group of identical fixes, one per other row that needs the person. The same
 * number the phone counts its cards by, so "Decision 2 of 60" and "59 decisions left" agree.
 */
export const decisionsLeft = (views: ReadonlyArray<RowView>, split: Iterable<string> = []): number =>
  queue({ views, split }).length
