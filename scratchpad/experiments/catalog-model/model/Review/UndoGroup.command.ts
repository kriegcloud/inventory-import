// One command of the review: the rejections only it returns, and what its decision decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Group } from "../Group/Group.aggregate.ts"
import * as GroupState from "../Group/Group.state.ts"
import * as GroupUndone from "../Group/GroupUndone.event.ts"
import * as GroupCounted from "../Import/events/GroupCounted.event.ts"
import { Import } from "../Import/Import.aggregate.ts"
import { ConfirmedSince, NotOpen, NotPermitted, ReviewMovedOn } from "../Import/Import.rejection.ts"
import * as ImportState from "../Import/Import.state.ts"
import { Change, ImportKey, Step } from "./Change.schema.ts"
import { DecidedBeforeTheConfirm, GroupedAfter, NotYourStep } from "./Review.rejection.ts"

/**
 * **Details**
 *
 * `step` names the group; `undo` is the change that recorded it; `opening` is how many times the import had been
 * confirmed when the undo was made; `seen`: the screen has received every change of the import up to this number, as a
 * group's act says.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "UndoGroup",
  {
    middleware: [Session],
    input: { importId: ImportKey, step: Step, undo: Change, opening: S.Int, seen: Change },
    events: [GroupUndone.Event, GroupCounted.Event],
    rejects: [NotOpen, NotPermitted, ConfirmedSince, NotYourStep, DecidedBeforeTheConfirm, GroupedAfter, ReviewMovedOn]
  },
  { description: "Take back the sender's own act on a group of rows, while it is the last group in force" }
) {}

/** What the decision reads for `UndoGroup`: the import, and the group the command names. */
type Reads = {
  readonly life: Domain.Decision.Read<typeof Import>
  readonly group: Domain.Decision.Read<typeof Group>
}

/**
 * What `UndoingGroup` decides of `UndoGroup`: the events to record on the import and on the group, or a refusal.
 *
 * **Details**
 *
 * It refuses an import that is not open (`NotOpen`), a sender of another organization or a viewer (`NotPermitted`),
 * an undo of another opening (`ConfirmedSince`), and a group of another import (`NotPermitted`). It refuses a group
 * that is not decided, is not the sender's, was not recorded by `undo`, or was taken back already (`NotYourStep`),
 * one a standing confirm wrote (`DecidedBeforeTheConfirm`), one under a later group in force (`GroupedAfter`), and a
 * screen that has not received every change (`ReviewMovedOn`). Otherwise the import's event names the group that was
 * under this one as the last in force.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("UndoingGroup.decide")(function* ({ life, group }: Reads, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(life.state)) return yield* NotOpen.make({})
  if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
    return yield* NotPermitted.make({})
  }
  if (cmd.opening !== life.state.confirms) return yield* ConfirmedSince.make({})
  if (!GroupState.guards.Decided(group.state)) return yield* NotYourStep.make({})
  // A group instance belongs to one import of one organization, for good.
  if (group.state.importId !== cmd.importId || group.state.organizationId !== life.state.organizationId) {
    return yield* NotPermitted.make({})
  }
  if (group.state.by !== actor.memberId || group.state.change !== cmd.undo || group.state.undoneAt !== 0) {
    return yield* NotYourStep.make({})
  }
  // What a standing confirm wrote is taken back with the import, not here.
  if (group.state.change <= life.state.confirmedAt) return yield* DecidedBeforeTheConfirm.make({})
  // A later group is still in force: what that one did was drawn on a screen that had this one. Once it is taken
  // back, this one is the last in force again.
  if (group.state.change !== life.state.topGroup) return yield* GroupedAfter.make({ last: life.state.topGroup })
  // The sender's screen has not received every change. The model keeps no reading of a group's rows, so it cannot
  // say whether what landed since is on one of them: a row another person decided since keeps that whole decision
  // when the group goes, and the sender would learn it only after. Refused with the import's last change and
  // held, as a group's act is; taken once the screen has it.
  if (cmd.seen !== life.state.changes) return yield* ReviewMovedOn.make({ last: life.state.changes })
  const change = life.state.changes + 1
  return [
    group.record(GroupUndone.Event.make({ change })),
    life.record(
      GroupCounted.Event.make({
        change,
        step: cmd.step,
        rows: group.state.count,
        label: "undo",
        by: actor.memberId,
        top: group.state.under
      })
    )
  ]
})
