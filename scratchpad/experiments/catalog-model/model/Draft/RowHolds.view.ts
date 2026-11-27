// What each row of a review holds now, folded by the row's own evolves, so the draft projection reads a row's state
// and not only its events. A trial block of the module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as RowState from "../Row/Row.state.ts"
import { Row } from "../Row/Row.aggregate.ts"
import * as RowDecided from "../Row/RowDecided.event.ts"
import * as StepUndone from "../Row/StepUndone.event.ts"

/**
 * **Details**
 *
 * Keyed by the row, with the row's own state, initial value and evolves, so its state after an event is the row's. A
 * projection of an aggregate is given its events alone; one of a view is given the view's state after each, and
 * `StepUndone` does not carry the decision it puts back, so `DraftRows` reads this view. No Api serves it, so it
 * declares no middleware and has no Live.
 *
 * @category views
 * @since 0.0.0
 */
export class RowHolds extends Domain.View(
  "RowHolds",
  {
    from: [Row],
    key: Row,
    state: RowState.State,
    initial: RowState.Untouched.make({ undone: RowState.noUndo }),
    evolve: { RowDecided: RowDecided.evolve, StepUndone: StepUndone.evolve }
  },
  { description: "What each row of a review holds now, as the row itself does" }
) {}
