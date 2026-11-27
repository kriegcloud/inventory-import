// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Change, Digest, ImportKey } from "../Review/Change.schema.ts"
import { NotOpen, NotPermitted, ReviewMovedOn } from "./Import.rejection.ts"
import * as ImportState from "./Import.state.ts"
import * as ImportConfirmed from "./ImportConfirmed.event.ts"

/** The plan was built at a change that is no longer the last: the handler builds it again. */
export class PlanBehind extends Domain.Rejection(
  "PlanBehind",
  { last: Change },
  { description: "The confirm's plan was built before the import's last change" }
) {}

/** What the plan would do is not what the button said: the stored items changed, with no change of this import between. */
export class NotWhatWasShown extends Domain.Rejection(
  "NotWhatWasShown",
  {},
  { description: "The confirm would do something else than its button said" }
) {}

/** The confirm's four outcomes do not add up to the rows in the file. */
export class CountsDoNotAddUp extends Domain.Rejection(
  "CountsDoNotAddUp",
  {},
  { description: "The confirm's outcomes do not add up to the rows in the file" }
) {}

/**
 * Confirm the import. `seen`: the screen has received every change up to this number, its own acts' included.
 * `planAt`: the handler built the plan from rows written up to this number. `shown` and `plan`: what every row
 * becomes, as one digest, as the screen had it and as the plan has it.
 */
export class Command extends Domain.Command(
  "ConfirmImport",
  {
    middleware: [Session],
    input: {
      importId: ImportKey,
      seen: Change,
      planAt: Change,
      shown: Digest,
      plan: Digest,
      created: S.Natural,
      updated: S.Natural,
      already: S.Natural,
      notImported: S.Natural
    },
    events: [ImportConfirmed.Event],
    rejects: [NotPermitted, NotOpen, ReviewMovedOn, PlanBehind, NotWhatWasShown, CountsDoNotAddUp]
  },
  { description: "Confirm the import, naming the last change the screen received and what its button said" }
) {}

/** What the import decides of `ConfirmImport`. */
export const decide = Effect.fn("Import.ConfirmImport")(function* (s: ImportState.State, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  if (cmd.planAt !== s.changes) return yield* PlanBehind.make({ last: s.changes })
  if (cmd.plan !== cmd.shown) return yield* NotWhatWasShown.make({})
  if (cmd.created + cmd.updated + cmd.already + cmd.notImported !== s.rows) {
    return yield* CountsDoNotAddUp.make({})
  }
  // No more is ever in force than the file has rows.
  if (s.inForce + cmd.created > s.rows) return yield* CountsDoNotAddUp.make({})
  return [
    ImportConfirmed.Event.make({
      change: s.changes + 1,
      created: cmd.created,
      updated: cmd.updated,
      already: cmd.already,
      notImported: cmd.notImported,
      by: actor.memberId
    })
  ]
})
