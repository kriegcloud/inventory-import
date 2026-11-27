// One row of one import's review as its own instance. The row decides nothing alone: `Deciding` and `Undoing` record
// its events. It holds its decision with the number of the change that recorded it, the decision under it in full, and
// every decision below that one sealed into one text, which the row compares and never reads. An undo at any depth has
// to bring the level it uncovers, and the row takes it only when it seals to exactly the text it holds (Benjamin,
// 2026-11-22: "Every step, sealed history"). The one thing not to break: `seal` writes the sizes of a level's texts
// before the texts, so two different levels never seal to the same text.
//
// Verify reads this file's code, not only its types. A case is told by its schema's own guard (`RowState.guards`),
// which the prover reads through the repository's patch to it (docs/patches.md): the union is exported, because the
// prover takes a schema from what the file exports. It reads a state built by its case's own `make`, with each field
// left out taken from its constructor default through the same patch.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as RowState from "./Row.state.ts"
import { ARowIsUndecidedOnlyWhenNothingWasUnder, ARowNeverChangesImportOrOrganization } from "./Row.transition.ts"
import * as RowDecided from "./RowDecided.event.ts"
import * as StepUndone from "./StepUndone.event.ts"

/**
 * **Details**
 *
 * A row has no command of its own, so the rules about who may change a row are rules of the two decisions that record
 * on it (`Deciding` and `Undoing`): an aggregate's rule may read only what its own commands' middleware provides.
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Row extends Domain.Aggregate(
  "Row",
  {
    id: S.String,
    state: RowState.State,
    initial: RowState.Untouched.make({ undone: RowState.noUndo }),
    invariants: {
      TheSizeOfByIsTrue: RowState.TheSizeOfByIsTrue,
      TheSizeOfStepIsTrue: RowState.TheSizeOfStepIsTrue,
      TheSizeOfFlagsIsTrue: RowState.TheSizeOfFlagsIsTrue,
      TheSizeOfLabelIsTrue: RowState.TheSizeOfLabelIsTrue
    },
    transitions: { ARowIsUndecidedOnlyWhenNothingWasUnder, ARowNeverChangesImportOrOrganization },
    events: [RowDecided.Event, StepUndone.Event],
    evolve: { RowDecided: RowDecided.evolve, StepUndone: StepUndone.evolve }
  },
  { description: "One row of one import's review: its decision, the one under it, and the rest sealed" }
) {}
