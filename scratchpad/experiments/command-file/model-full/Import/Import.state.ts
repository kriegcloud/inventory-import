// Where an import is in its life, and the rules that hold of every state of it.
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

/**
 * Where an import is in its life. Whatever its status, a staged import holds the number of its last act on a group
 * and of the last group still in force.
 */
export const ImportState = S.Union([
  S.Struct({ status: S.tag("Unstaged") }),
  S.Struct({
    status: S.tag("Open"),
    ...kept,
    suggestions: S.Int
  }),
  S.Struct({
    status: S.tag("Imported"),
    ...kept,
    created: S.Natural,
    updated: S.Natural,
    already: S.Natural,
    notImported: S.Natural
  }),
  S.Struct({ status: S.tag("TakenBack"), ...kept, removed: S.Natural, kept: S.Natural }),
  S.Struct({ status: S.tag("Removed"), organizationId: S.String })
])
  .annotate({ description: "Where one import is in its life, with its counts and the number of its last change" })
  .pipe(S.toTaggedUnion("status"))
/** The decoded value of `ImportState`. */
export type ImportState = typeof ImportState.Type
/** An import that is open for review. */
export type OpenImport = typeof ImportState.cases.Open.Type

// A confirm's four outcomes add up to the rows in the file: of the counts its command states.
/** A rule of every state of an import. */
export const OutcomesAddUpToTheRows = (s: ImportState): boolean =>
  !ImportState.guards.Imported(s) || s.created + s.updated + s.already + s.notImported === s.rows

// An import never has more items in force than the file has rows.
/** A rule of every state of an import. */
export const NoMoreInForceThanRows = (s: ImportState): boolean =>
  ImportState.guards.Unstaged(s) || ImportState.guards.Removed(s) || s.inForce <= s.rows

// What says "taken back" has no confirm standing.
/** A rule of every state of an import. */
export const NothingStandsThatWasTakenBack = (s: ImportState): boolean => !ImportState.guards.TakenBack(s) || s.standing === 0

/** A rule of every state of an import. */
export const WhatIsInForceThenIsWhatWasKept = (s: ImportState): boolean => !ImportState.guards.TakenBack(s) || s.inForce === s.kept
