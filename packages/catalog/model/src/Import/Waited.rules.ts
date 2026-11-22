// Which rows of a save that waited are written, and which were decided otherwise since (Benjamin, 2026-11-20: "Hold it,
// show both, ask"). A row that waited (its first save failed, it was kept across a reload, a closed tab kept it) names
// the decisions the sender knows the server may hold of it (`SaveRequest.over`). The one thing not to break: such a row
// is written only while what is stored of it is one of those, as it was named or as a match since left it, judged by
// the very rule the match itself was judged by. Anything else is somebody's decision made since, and is never written
// over unasked.
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { type DecidedSince, decisionOf, RowDecision, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import type { ColumnMove, MappingChoice } from "@inventory/catalog-contract/Mapping"
import {
  type ComparisonChanged,
  type ComparisonQuestion,
  comparisonQuestions,
  withoutStaleDecisions
} from "./Rematch.rules.ts"

/** For each row that waited, the decisions the server may hold of it; none for no decision. */
export type Over = Readonly<Record<string, ReadonlyArray<O.Option<RowDecision>>>>

/**
 * A save's `over` for the rows it sets or clears, and only those: a key that names no row of the save says nothing about
 * any decision, and is not read.
 *
 * @example overOfSave({ over: { "row-2": [O.none()], "row-9": [O.none()] }, set: { "row-2": decision }, clear: [] }) // { "row-2": [O.none()] }
 */
export const overOfSave = (save: {
  readonly over?: Over
  readonly set: SavedDecisions
  readonly clear: ReadonlyArray<string>
}): Over => {
  const cleared = HashSet.fromIterable(save.clear)
  return R.filter(save.over ?? {}, (_named, rowId) => R.has(save.set, rowId) || HashSet.has(cleared, rowId))
}

const sameDecision = S.toEquivalence(RowDecision)
const nothingSaid = decisionOf()
// A decision that says nothing (a row put back, or one a match took everything of) and no decision are the same.
const said = (decision: O.Option<RowDecision>): RowDecision => O.getOrElse(decision, () => nothingSaid)
const alike = (a: O.Option<RowDecision>, b: O.Option<RowDecision>): boolean => sameDecision(said(a), said(b))

// The decisions named, as sets with each row once: the first named of every row, then the second of those with two.
const layersOf = (over: Over): ReadonlyArray<SavedDecisions> => {
  const longest = R.reduce(over, 0, (most, named) => Math.max(most, named.length))
  return longest === 0
    ? []
    : A.makeBy(longest, (index) => R.getSomes(R.map(over, (named) => O.flatten(A.get(named, index)))))
}

/** What the rows that waited are judged by: the draft's columns, and the revision each row was decided on. */
type Judging = {
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly madeOn: Readonly<Record<string, number>>
  readonly over: Over
  readonly stored: SavedDecisions
}

// The named decisions of a set as a match since left them: judged as the rows themselves are, on the rows' `madeOn`.
const leftByMatches = (
  input: Judging,
  layer: SavedDecisions,
  changed: ReadonlyArray<ComparisonChanged>
): SavedDecisions =>
  withoutStaleDecisions({ choices: input.choices, moves: input.moves, madeOn: input.madeOn, set: layer, changed })
    .applied

// The questions of a named set whose answer decides a row: what is stored of it is the named decision with its Replace
// or Keep-stored gone, which is the match's doing only where the match changed how the row compares.
const questionsOfLayer = (input: Judging, layer: SavedDecisions): ReadonlyArray<ComparisonQuestion> => {
  const questions = comparisonQuestions({
    choices: input.choices,
    moves: input.moves,
    madeOn: input.madeOn,
    set: layer
  })
  const allTaken = leftByMatches(
    input,
    layer,
    A.flatMap(questions, ({ rowId, fields }) => A.map(fields, ({ field }) => ({ rowId, field })))
  )
  return A.filter(questions, ({ rowId }) => alike(R.get(allTaken, rowId), R.get(input.stored, rowId)))
}

/**
 * What the file's review has to be asked before it can be said which rows were decided otherwise since: one list for
 * each set of named decisions (each row at most once in a list), empty where nothing of it rests on how a row compares.
 * Hand `decidedSince` the answers in the same order.
 */
export const waitedQuestions = (input: Judging): ReadonlyArray<ReadonlyArray<ComparisonQuestion>> =>
  A.map(layersOf(input.over), (layer) => questionsOfLayer(input, layer))

/**
 * The rows that waited and were decided otherwise since, each with what is stored of it (none for nothing said): not to
 * be written. A row is written when what is stored of it is one of the decisions it names, as named or with the parts a
 * match since took back removed (`withoutStaleDecisions`, on the row's `madeOn`), or is already what the save leaves
 * (`left`): the same save sent again after a lost answer finds its own.
 *
 * @example
 * // Row 12 waits over no decision; Marcus has left it out since. Row 3's Replace went with the SKU's match: nobody's.
 * decidedSince({ choices, moves, madeOn, over: { "row-12": [O.none()], "row-3": [O.some(replace)] }, stored: { "row-12": out, "row-3": nothing }, left, changed })
 * // [{ rowId: "row-12", theirs: O.some(out) }]
 */
export const decidedSince = (
  input: Judging & {
    readonly left: (rowId: string) => O.Option<RowDecision>
    readonly changed: ReadonlyArray<ReadonlyArray<ComparisonChanged>>
  }
): ReadonlyArray<DecidedSince> => {
  const layers = A.map(layersOf(input.over), (layer, index) =>
    leftByMatches(
      input,
      layer,
      O.getOrElse(A.get(input.changed, index), () => [])
    )
  )
  return A.getSomes(
    A.map(R.toEntries(input.over), ([rowId, named]) => {
      const stored = R.get(input.stored, rowId)
      const known =
        alike(stored, input.left(rowId)) ||
        A.some(named, (one) => alike(stored, one)) ||
        A.some(layers, (layer) => O.exists(R.get(layer, rowId), (one) => alike(stored, O.some(one))))
      return known
        ? O.none<DecidedSince>()
        : O.some({ rowId, theirs: O.filter(stored, (decision) => !sameDecision(decision, nothingSaid)) })
    })
  )
}
