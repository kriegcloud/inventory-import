// What each row of a review holds now, folded by the row's own evolves, so the draft projection reads a row's state
// and not only its events; a person reads it only of their own organization. A trial block of the module-taxonomy
// exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { NotPermitted } from "../Import/Import.rejection.ts"
import * as RowState from "./Row.state.ts"
import { Row } from "./Row.aggregate.ts"
import * as RowDecided from "./RowDecided.event.ts"
import * as StepUndone from "./StepUndone.event.ts"

/**
 * **Details**
 *
 * Keyed by the row, with the row's own state, initial value and evolves, so its state after an event is the row's. A
 * projection of an aggregate is given its events alone; one of a view is given the view's state after each, and
 * `StepUndone` does not carry the decision it puts back, so `DraftRows` reads this view. An Api serves every view of
 * its model it does not leave out, so this one is guarded as the others are: `Session` provides who asks, and
 * `RowHoldsLive` judges each read against the row's organization.
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
    evolve: { RowDecided: RowDecided.evolve, StepUndone: StepUndone.evolve },
    middleware: [Session],
    rejects: [NotPermitted]
  },
  { description: "What each row of a review holds now, as the row itself does" }
) {}

/**
 * Refuses `NotPermitted` to a person when the row belongs to an import of another organization than the one they act
 * in.
 *
 * **Details**
 *
 * A row no act has reached names no organization and reads as it is to everyone, as an import nobody staged does in
 * `ImportStatus`.
 *
 * @category layers
 * @since 0.0.0
 */
export const RowHoldsLive = RowHolds.toLayer(
  Effect.succeed(
    Effect.fn("RowHolds.validate")(function* (_request, held) {
      const actor = yield* CurrentActor
      const owner = O.map(
        O.filter(O.fromNullOr(held), RowState.isAnyOf(["Decided", "Undecided"])),
        (row) => row.organizationId
      )
      if (O.exists(owner, (organizationId) => organizationId !== actor.organizationId)) {
        return yield* NotPermitted.make({})
      }
    })
  )
)
