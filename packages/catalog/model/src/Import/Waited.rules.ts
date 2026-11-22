// Which rows of a save that waited are written, and which were decided otherwise since (Benjamin, 2026-11-20: "Hold it,
// show both, ask"). A row that waited (its first save failed, it was kept across a reload, a closed tab kept it) names
// the decisions the sender knows the server may hold of it (`SaveRequest.over`). The one thing not to break: such a row
// is written only while what is stored of it is one of those, as it was named or as a match since left it, and what a
// match left is read from what each match recorded it took back (the draft's take-backs), never worked out again from
// the items as they are now: an item stocked or taken back since the match says nothing of what the match did. Where
// the record does not say, the row is not written. Anything else is somebody's decision made since, and is never
// written over unasked.
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import {
  type DecidedSince,
  decisionOf,
  RowDecision,
  type SavedDecisions,
  StoredChoice
} from "@inventory/catalog-contract/Decision"
import type { MatchTakeBack } from "@inventory/catalog-contract/Import"
import type { ColumnMove, MappingChoice } from "@inventory/catalog-contract/Mapping"
import { type Field, fields } from "@inventory/catalog-contract/Staged"
import { type ComparisonChanged, matchedAfter, withoutStaleDecisions } from "./Rematch.rules.ts"

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

/**
 * What the rows that waited are judged by: the draft's columns, the revision each row was decided on, what is stored,
 * and what each match recorded it took back (`takenBack`), kept for every match after `takenBackFrom` and for none
 * before.
 */
type Judging = {
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly madeOn: Readonly<Record<string, number>>
  readonly over: Over
  readonly stored: SavedDecisions
  readonly takenBack: ReadonlyArray<MatchTakeBack>
  readonly takenBackFrom: number
}

const otherFields = A.filter(fields, (field) => field !== "sku")
const keyOf = (field: string, rowId: string): string => `${field}:${rowId}`

// The latest revision at which a match recorded taking back each row's Replace or Keep-stored, keyed by field and row.
const latestTakeBacks = (entries: ReadonlyArray<MatchTakeBack>): Readonly<Record<string, number>> =>
  R.fromEntries(
    A.map(
      R.toEntries(
        A.groupBy(
          A.flatMap(entries, (entry) =>
            A.map(entry.rows, (rowId) => ({ key: keyOf(entry.field, rowId), at: entry.revision }))
          ),
          (one) => one.key
        )
      ),
      ([key, found]) => [key, A.reduce(found, 0, (latest, one) => Math.max(latest, one.at))] as const
    )
  )

/**
 * The named decisions of a set as the matches since left them, each row judged on its `madeOn`: the parts no comparison
 * decides (accepts and undone fixes of a field matched again, and with the SKU matched again every Replace, Keep-stored
 * and keep of one of two) by the rule the match applied, and a Replace or a Keep-stored across a match of another field
 * only where a match after the row's revision recorded it took that row's back. A row whose Replace or Keep-stored rests
 * on a match the record does not cover (one at or before `takenBackFrom`, one made before moves were kept, or one whose
 * entry names only its first rows and not this one) is not known, and is left out: it is never taken as left by a match.
 */
const leftByMatches = (input: Judging, layer: SavedDecisions): SavedDecisions => {
  const stored = A.filter(input.takenBack, (entry) => entry.kind === "stored" && entry.field !== "sku")
  // Looked up once a row: the latest match that recorded taking back a row's Replace or Keep-stored, by field.
  const latest = latestTakeBacks(stored)
  const partial = A.filter(stored, (entry) => entry.count > entry.rows.length)
  // A match of `field` at revision `at` whose take-backs are kept: after `takenBackFrom`, and with a move kept for it.
  const recorded = (field: Field, at: number): boolean =>
    at > input.takenBackFrom && A.some(input.moves, (move) => move.field === field && move.at === at)
  const matchesAfter = (field: Field, made: number): ReadonlyArray<number> => [
    ...A.map(
      A.filter(input.moves, (move) => move.field === field && move.at > made),
      (move) => move.at
    ),
    ...A.map(
      A.filter(input.choices, (choice) => choice.field === field && choice.at > made),
      (choice) => choice.at
    )
  ]
  const judged = A.map(R.toEntries(layer), ([rowId, decision]) => {
    const made = O.getOrElse(R.get(input.madeOn, rowId), () => 0)
    const stale = matchedAfter(input)(made)
    const asked = !StoredChoice.guards.undecided(decision.stored) && !stale("sku")
    const moved: ReadonlyArray<Field> = asked ? A.filter(otherFields, (field) => stale(field)) : []
    const changed = A.filter(moved, (field) => O.exists(R.get(latest, keyOf(field, rowId)), (at) => at > made))
    const unknown =
      changed.length === 0 &&
      (A.some(moved, (field) => A.some(matchesAfter(field, made), (at) => !recorded(field, at))) ||
        A.some(partial, (entry) => entry.revision > made && A.contains(moved, entry.field)))
    return { rowId, unknown, changed: A.map(changed, (field): ComparisonChanged => ({ rowId, field })) }
  })
  const unknown = HashSet.fromIterable(
    A.map(
      A.filter(judged, (row) => row.unknown),
      (row) => row.rowId
    )
  )
  const { applied } = withoutStaleDecisions({
    choices: input.choices,
    moves: input.moves,
    madeOn: input.madeOn,
    set: layer,
    changed: A.flatMap(judged, (row) => row.changed)
  })
  return R.filter(applied, (_decision, rowId) => !HashSet.has(unknown, rowId))
}

/**
 * The rows that waited and were decided otherwise since, each with what is stored of it (none for nothing said): not to
 * be written. A row is written when what is stored of it is one of the decisions it names, as named or with the parts
 * the matches since took back removed (from what each match recorded, on the row's `madeOn`), or is already what the
 * save leaves (`left`): the same save sent again after a lost answer finds its own. Nothing here asks the file's
 * review, so it costs the same however many decisions a row names.
 *
 * @example
 * // Row 12 waits over no decision; Marcus has left it out since. Row 3's Replace went with the SKU's match: nobody's.
 * decidedSince({ choices, moves, madeOn, over: { "row-12": [O.none()], "row-3": [O.some(replace)] }, stored: { "row-12": out, "row-3": nothing }, takenBack, takenBackFrom: 0, left })
 * // [{ rowId: "row-12", theirs: O.some(out) }]
 */
export const decidedSince = (
  input: Judging & { readonly left: (rowId: string) => O.Option<RowDecision> }
): ReadonlyArray<DecidedSince> => {
  const layers = A.map(layersOf(input.over), (layer) => leftByMatches(input, layer))
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
