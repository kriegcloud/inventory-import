// One act on a group of rows as its own instance: which rows, what it does to each, who made it and the number of the
// change that recorded it (Benjamin, 2026-11-22: "One unit per group"). It is recorded whole or not at all, and never
// changes after; its undo records only when. The group decides nothing alone: `DecidingGroup` and `UndoingGroup`
// record its events. A row's decision is read from the row's own instance and from the groups that name it; no
// instance holds that reading. The one thing not to break: a group taken back gives no row anything again, and stays
// taken back ("Undecided: Ana took it back").
//
// Verify reads this file's code, not only its types. A case is told by its schema's own guard (`GroupState.guards`),
// which the prover reads through the repository's patch to it (docs/patches.md): the union is exported, because the
// prover takes a schema from what the file exports. It reads a state built by its case's own `make`, with each field
// left out taken from its constructor default through the same patch.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as GroupState from "./Group.state.ts"
import {
  ADecidedGroupStaysDecided,
  AGroupKeepsItsCount,
  AGroupKeepsItsMaker,
  AGroupKeepsItsNumber,
  AGroupKeepsItsPatch,
  AGroupKeepsItsRows,
  AGroupKeepsWhatWasUnderIt,
  AGroupNeverChangesImportOrOrganization,
  AGroupTakenBackStaysTakenBack
} from "./Group.transition.ts"
import * as GroupDecided from "./GroupDecided.event.ts"
import * as GroupUndone from "./GroupUndone.event.ts"

/**
 * **Details**
 *
 * A group has no command of its own, so the rules about who may change a group are rules of the two decisions that
 * record on it (`DecidingGroup` and `UndoingGroup`): an aggregate's rule may read only what its own commands'
 * middleware provides.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Group extends Domain.Aggregate(
  "Group",
  {
    id: S.String,
    state: GroupState.State,
    initial: GroupState.Untouched.make({}),
    transitions: {
      AGroupKeepsItsRows,
      AGroupKeepsItsCount,
      AGroupKeepsItsPatch,
      AGroupKeepsItsNumber,
      AGroupKeepsWhatWasUnderIt,
      AGroupKeepsItsMaker,
      ADecidedGroupStaysDecided,
      AGroupTakenBackStaysTakenBack,
      AGroupNeverChangesImportOrOrganization
    },
    events: [GroupDecided.Event, GroupUndone.Event],
    evolve: { GroupDecided: GroupDecided.evolve, GroupUndone: GroupUndone.evolve }
  },
  { description: "One act on a group of rows: its rows, what it does to each, whose it is, and when it was taken back" }
) {}
