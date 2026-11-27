// One command of the review: the rejections only it returns, and what its decision decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Group } from "../Group/Group.aggregate.ts"
import * as GroupState from "../Group/Group.state.ts"
import * as GroupDecided from "../Group/GroupDecided.event.ts"
import { Size } from "../Group/Size.schema.ts"
import * as GroupCounted from "../Import/events/GroupCounted.event.ts"
import { Import } from "../Import/Import.aggregate.ts"
import { ConfirmedSince, MatchedSince, NotOpen, NotPermitted, ReviewMovedOn } from "../Import/Import.rejection.ts"
import * as ImportState from "../Import/Import.state.ts"
import { Change, ImportKey, Label, Patch, Rows, Step } from "./Change.schema.ts"

/**
 * **Details**
 *
 * A step decides one group, once.
 *
 * @category rejections
 * @since 0.0.0
 */
export class StepTaken extends Domain.Rejection(
  "StepTaken",
  {},
  { description: "A group was already decided under this step" }
) {}

/**
 * **Details**
 *
 * `seen`: the screen has received every change of the import up to this number. `opening`: how many times the import
 * had been confirmed when the act was made. `madeOn`: the import's matching it was made on. `rows` and `patch`: which
 * rows, and what the act does to each; `count`: how many rows that is.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "DecideGroup",
  {
    middleware: [Session],
    input: {
      importId: ImportKey,
      step: Step,
      opening: S.Int,
      seen: Change,
      madeOn: S.Int,
      patch: Patch,
      rows: Rows,
      count: Size,
      label: Label
    },
    events: [GroupDecided.Event, GroupCounted.Event],
    rejects: [NotOpen, NotPermitted, StepTaken, ConfirmedSince, ReviewMovedOn, MatchedSince]
  },
  { description: "Decide a group of rows as one act, from a screen that has every change of the import" }
) {}

/** What the decision reads for `DecideGroup`: the import, and the group the command names. */
type Reads = {
  readonly life: Domain.Decision.Read<typeof Import>
  readonly group: Domain.Decision.Read<typeof Group>
}

/**
 * What `DecidingGroup` decides of `DecideGroup`: the events to record on the import and on the group, or a refusal.
 *
 * **Details**
 *
 * It refuses, in this order: an import that is not open (`NotOpen`), a sender of another organization or a viewer
 * (`NotPermitted`), a step that has decided a group already (`StepTaken`), an act of another opening
 * (`ConfirmedSince`), a screen that has not received every change (`ReviewMovedOn`), and an older matching
 * (`MatchedSince`). Otherwise both events carry the import's next change number, and the group keeps the import's last
 * group in force as `under`.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("DecidingGroup.decide")(function* ({ life, group }: Reads, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(life.state)) return yield* NotOpen.make({})
  if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
    return yield* NotPermitted.make({})
  }
  if (!GroupState.guards.Untouched(group.state)) return yield* StepTaken.make({})
  if (cmd.opening !== life.state.confirms) return yield* ConfirmedSince.make({})
  if (cmd.seen !== life.state.changes) return yield* ReviewMovedOn.make({ last: life.state.changes })
  if (cmd.madeOn !== life.state.matching) return yield* MatchedSince.make({ matching: life.state.matching })
  const change = life.state.changes + 1
  return [
    group.record(
      GroupDecided.Event.make({
        importId: cmd.importId,
        organizationId: life.state.organizationId,
        change,
        by: actor.memberId,
        step: cmd.step,
        patch: cmd.patch,
        rows: cmd.rows,
        count: cmd.count,
        madeOn: cmd.madeOn,
        label: cmd.label,
        under: life.state.topGroup
      })
    ),
    life.record(
      GroupCounted.Event.make({
        change,
        step: cmd.step,
        rows: cmd.count,
        label: cmd.label,
        by: actor.memberId,
        top: change
      })
    )
  ]
})
