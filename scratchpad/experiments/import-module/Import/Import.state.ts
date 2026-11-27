// Where an import is in its life, and the rules that hold of every state of it. Read as a namespace named
// `ImportState`: `ImportState.State`, `ImportState.Open`, `ImportState.guards.Open`.
import * as S from "effect/Schema"
import { Columns } from "../Review/Change.schema.ts"

// What every import that was staged and not removed keeps, whatever its status.
const kept = {
  organizationId: S.String,
  rows: S.Natural,
  // How many times it was confirmed: an act names it, so one made before a confirm is not taken after a reopen.
  confirms: S.Int,
  matching: S.Int,
  columns: Columns,
  // The number of the last change, and of the last confirm that stands (0 when none does).
  changes: S.Int,
  confirmedAt: S.Int,
  // Items its confirms created that are in force; replacements its confirms made that were not put back (each
  // confirm adds its `updated`, the sender's count, so an item replaced by two confirms counts twice: a count of
  // replacements, not of items, and bounded by nothing but what the senders said); and its confirms not taken back.
  inForce: S.Natural,
  replaced: S.Natural,
  standing: S.Natural,
  // The number of the last act on a group, its undo included (0 when there was none): a row's act names it.
  lastGroup: S.Int,
  // The change of the last group still in force (0 when there is none): only that one is taken back.
  topGroup: S.Int
}

/** An import no file was staged for. */
export const Unstaged = S.Struct({ status: S.tag("Unstaged") })

/** An import that is open for review. */
export const Open = S.Struct({
  status: S.tag("Open"),
  ...kept,
  suggestions: S.Int
})

/** An import that was confirmed: what its confirm did with each row. */
export const Imported = S.Struct({
  status: S.tag("Imported"),
  ...kept,
  created: S.Natural,
  updated: S.Natural,
  already: S.Natural,
  notImported: S.Natural
})

/** An import that was taken back: what was removed and what was kept. */
export const TakenBack = S.Struct({ status: S.tag("TakenBack"), ...kept, removed: S.Natural, kept: S.Natural })

/** An import that was removed. */
export const Removed = S.Struct({ status: S.tag("Removed"), organizationId: S.String })

/**
 * Where an import is in its life. Whatever its status, a staged import holds the number of its last act on a group
 * and of the last group still in force.
 */
export const State = S.Union([Unstaged, Open, Imported, TakenBack, Removed])
  .annotate({ description: "Where one import is in its life, with its counts and the number of its last change" })
  .pipe(S.toTaggedUnion("status"))
/** The decoded value of `State`. */
export type State = typeof State.Type
/** The guards, the cases and `isAnyOf` of `State`: the file read as a namespace reads as the state does. */
export const { guards, cases, isAnyOf } = State
/** An import that is open for review. */
export type OpenImport = typeof Open.Type

// A confirm's four outcomes add up to the rows in the file: of the counts its command states.
/** A rule of every state of an import. */
export const OutcomesAddUpToTheRows = (s: State): boolean =>
  !State.guards.Imported(s) || s.created + s.updated + s.already + s.notImported === s.rows

// An import never has more items in force than the file has rows.
/** A rule of every state of an import. */
export const NoMoreInForceThanRows = (s: State): boolean =>
  State.guards.Unstaged(s) || State.guards.Removed(s) || s.inForce <= s.rows

// What says "taken back" has no confirm standing.
/** A rule of every state of an import. */
export const NothingStandsThatWasTakenBack = (s: State): boolean => !State.guards.TakenBack(s) || s.standing === 0

/** A rule of every state of an import. */
export const WhatIsInForceThenIsWhatWasKept = (s: State): boolean => !State.guards.TakenBack(s) || s.inForce === s.kept
