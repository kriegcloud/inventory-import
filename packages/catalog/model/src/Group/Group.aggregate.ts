// One act on a group of rows as its own instance: which rows, what it does to each, who made it and the number of the
// change that recorded it (Benjamin, 2026-11-22: "One unit per group"). It is recorded whole or not at all, and never
// changes after; its undo records only when. The group decides nothing alone: `DecidingGroup` and `UndoingGroup`
// record its events. A row's decision is read from the row's own instance and from the groups that name it; no
// instance holds that reading. The one thing not to break: a group taken back gives no row anything again, and stays
// taken back ("Undecided: Ana took it back").
//
// Verify reads this file's code, not only its types. It reads a case told with `effect/Match` and a state built by its
// case's own `make` with the status written out; it does not read a schema's `guards` or `match`. So the guards below
// are written with Match, and every `make` of a state names its status.
import * as Domain from "@alchemy.run/domain"
import * as Match from "effect/Match"
import * as S from "effect/Schema"
import { Change, Patch, Rows, Step } from "../Review/Change.schema.ts"

/**
 * A group of rows was decided as one act: its rows and what it does to each, as which change of its import, by whom,
 * on which matching. `under` is the last group in force on the import when this one was decided (0 for none), so that
 * taking this one back makes that one the last in force again.
 */
export class GroupDecided extends Domain.Event(
  "GroupDecided",
  {
    importId: S.String,
    organizationId: S.String,
    change: Change,
    by: S.String,
    step: Step,
    patch: Patch,
    rows: Rows,
    count: S.Int,
    madeOn: S.Int,
    label: S.String,
    under: Change
  },
  { description: "One act on a group of rows was recorded: its rows, what it does to each, and whose it is" }
) {}

/** The act on a group was taken back: by which change of its import. */
export class GroupUndone extends Domain.Event(
  "GroupUndone",
  { change: Change },
  { description: "An act on a group of rows was taken back" }
) {}

/**
 * What one group act holds: nothing yet, or the act as it was decided. `undoneAt` is the change that took it back, or
 * 0 while it is in force.
 */
export const GroupState = S.Union([
  S.Struct({ status: S.tag("Untouched") }),
  S.Struct({
    status: S.tag("Decided"),
    importId: S.String,
    organizationId: S.String,
    change: Change,
    by: S.String,
    step: S.String,
    patch: S.String,
    rows: S.String,
    count: S.Int,
    madeOn: S.Int,
    label: S.String,
    undoneAt: Change,
    under: Change
  })
])
  .annotate({ description: "What one act on a group of rows holds" })
  .pipe(S.toTaggedUnion("status"))
/** The decoded value of `GroupState`. */
export type GroupState = typeof GroupState.Type
/** A group act that was decided, in force or taken back. */
export type DecidedGroup = typeof GroupState.cases.Decided.Type

const yes = (): boolean => true
const no = (): boolean => false
const byStatus = Match.discriminatorsExhaustive("status")

/** True for a step no group act was decided under. */
export const isUntouchedGroup = (group: GroupState): group is typeof GroupState.cases.Untouched.Type =>
  Match.value(group).pipe(byStatus({ Untouched: yes, Decided: no }))
/** True for a group act that was decided, whether it is in force or was taken back. */
export const isDecidedGroup = (group: GroupState): group is DecidedGroup =>
  Match.value(group).pipe(byStatus({ Untouched: no, Decided: yes }))

/**
 * One act on a group of rows. It has no command of its own, so the rules about who may change a group are rules of
 * the two decisions that record on it: an aggregate's rule may read only what its own commands' middleware provides.
 */
export class Group extends Domain.Aggregate(
  "Group",
  {
    id: S.String,
    state: GroupState,
    initial: GroupState.cases.Untouched.make({ status: "Untouched" }),
    invariants: {
      // That its number is one its import gave, and that its undo comes after it, need the import: they are rules
      // over every import and group in the model, searched and not proved.
      // The count is its sender's word: the model reads no row out of a group's rows, so nothing ties it to them.
      AGroupSaysAtLeastOneRow: (s) => !isDecidedGroup(s) || s.count >= 1
    },
    transitions: {
      // What a group decided never changes: its rows, what it does to them, its number, whose it is.
      AGroupKeepsItsRows: ({ before, after }) =>
        !isDecidedGroup(before) || !isDecidedGroup(after) || after.rows === before.rows,
      AGroupKeepsItsCount: ({ before, after }) =>
        !isDecidedGroup(before) || !isDecidedGroup(after) || after.count === before.count,
      AGroupKeepsItsPatch: ({ before, after }) =>
        !isDecidedGroup(before) || !isDecidedGroup(after) || after.patch === before.patch,
      AGroupKeepsItsNumber: ({ before, after }) =>
        !isDecidedGroup(before) || !isDecidedGroup(after) || after.change === before.change,
      AGroupKeepsWhatWasUnderIt: ({ before, after }) =>
        !isDecidedGroup(before) || !isDecidedGroup(after) || after.under === before.under,
      AGroupKeepsItsMaker: ({ before, after }) =>
        !isDecidedGroup(before) || !isDecidedGroup(after) || after.by === before.by,
      ADecidedGroupStaysDecided: ({ before, after }) => !isDecidedGroup(before) || isDecidedGroup(after),
      // A group taken back stays so.
      AGroupTakenBackStaysTakenBack: ({ before, after }) =>
        !isDecidedGroup(before) ||
        !isDecidedGroup(after) ||
        before.undoneAt === 0 ||
        after.undoneAt === before.undoneAt,
      AGroupNeverChangesImportOrOrganization: ({ before, after }) =>
        isUntouchedGroup(before) ||
        isUntouchedGroup(after) ||
        (before.organizationId === after.organizationId && before.importId === after.importId)
    },
    events: [GroupDecided, GroupUndone],
    evolve: {
      GroupDecided: (s, e) =>
        isUntouchedGroup(s)
          ? GroupState.cases.Decided.make({
              status: "Decided",
              importId: e.importId,
              organizationId: e.organizationId,
              change: e.change,
              by: e.by,
              step: e.step,
              patch: e.patch,
              rows: e.rows,
              count: e.count,
              madeOn: e.madeOn,
              label: e.label,
              undoneAt: 0,
              under: e.under
            })
          : s,
      GroupUndone: (s, e) => (isDecidedGroup(s) ? { ...s, undoneAt: e.change } : s)
    }
  },
  { description: "One act on a group of rows: its rows, what it does to each, whose it is, and when it was taken back" }
) {}
