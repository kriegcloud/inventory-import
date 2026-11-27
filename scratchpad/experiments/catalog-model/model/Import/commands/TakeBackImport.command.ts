// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../../Actor/Actor.context.ts"
import { Session } from "../../Actor/Session.middleware.ts"
import { Change, ImportKey } from "../../Review/Change.schema.ts"
import { NotPermitted, ReviewMovedOn } from "../Import.rejection.ts"
import * as ImportState from "../Import.state.ts"
import * as ImportTakenBack from "../events/ImportTakenBack.event.ts"

/**
 * **Details**
 *
 * There is nothing to take back. An import that is neither confirmed nor open gets it, and so does one with no
 * confirm standing.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotImported extends Domain.Rejection(
  "NotImported",
  {},
  { description: "No confirm of this import stands" }
) {}

/**
 * **Details**
 *
 * A take-back also gets it when it says it keeps more replacements than its confirms made.
 *
 * @category rejections
 * @since 0.0.0
 */
export class MoreKeptThanInForce extends Domain.Rejection(
  "MoreKeptThanInForce",
  {},
  { description: "A take-back keeps more items than the import has in force" }
) {}

/**
 * **Details**
 *
 * `kept` is how many of the items its confirms created are kept, because someone changed them; `keptReplaced` is
 * the same count of the replacements they made. `seen` is the last change the sender's screen received.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "TakeBackImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change, kept: S.Natural, keptReplaced: S.Natural },
    events: [ImportTakenBack.Event],
    rejects: [NotPermitted, NotImported, ReviewMovedOn, MoreKeptThanInForce]
  },
  { description: "Take back everything the import has in force, keeping the items someone changed" }
) {}

/**
 * Takes back everything a confirmed or reopened import has in force, recording one `ImportTakenBack` at the next
 * change number: it removes what was not kept, and puts back what was replaced and not kept.
 *
 * **Details**
 *
 * The checks run in this order, and the first that fails is the rejection: `NotImported` for an import that is
 * neither confirmed nor open; `NotPermitted` for a viewer or someone in another organization; `NotImported` when no
 * confirm stands; `ReviewMovedOn` when `seen` is not the last change; `MoreKeptThanInForce` when `kept` is more than
 * is in force or `keptReplaced` more than was replaced.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("Import.TakeBackImport")(function* (s: ImportState.State, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Imported(s) && !ImportState.guards.Open(s)) return yield* NotImported.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (s.standing < 1) return yield* NotImported.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  if (cmd.kept > s.inForce || cmd.keptReplaced > s.replaced) return yield* MoreKeptThanInForce.make({})
  return [
    ImportTakenBack.Event.make({
      change: s.changes + 1,
      removed: s.inForce - cmd.kept,
      kept: cmd.kept,
      restored: s.replaced - cmd.keptReplaced,
      keptReplaced: cmd.keptReplaced,
      by: actor.memberId
    })
  ]
})
