// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../../Actor/Actor.context.ts"
import { Session } from "../../Actor/Session.middleware.ts"
import { Change, ImportKey } from "../../Review/Change.schema.ts"
import { NotOpen, NotPermitted, ReviewMovedOn } from "../Import.rejection.ts"
import * as ImportState from "../Import.state.ts"
import * as ImportRemoved from "../events/ImportRemoved.event.ts"

/**
 * **Details**
 *
 * Items it created are in force, or a confirm of it was not taken back: it stays with them.
 *
 * @category rejections
 * @since 0.0.0
 */
export class HasItemsInForce extends Domain.Rejection(
  "HasItemsInForce",
  {},
  { description: "The import has items in force, so it is not removed" }
) {}

/**
 * **Details**
 *
 * `seen` is the last change the sender's screen received.
 *
 * **Gotchas**
 *
 * A confirmed import is removed only after a take-back that kept nothing, and only while it is open: a take-back of
 * a confirmed import closes it, so it is opened again first.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "RemoveImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change },
    events: [ImportRemoved.Event],
    rejects: [NotPermitted, NotOpen, ReviewMovedOn, HasItemsInForce]
  },
  { description: "Remove an open import with nothing in force, naming its last change" }
) {}

/**
 * Removes an open import with nothing in force, recording one `ImportRemoved` at the next change number.
 *
 * **Details**
 *
 * The checks run in this order, and the first that fails is the rejection: `NotOpen` for an import that is not open;
 * `NotPermitted` for a viewer or someone in another organization; `ReviewMovedOn` when `seen` is not the last change;
 * `HasItemsInForce` when an item it created is in force or a confirm of it stands.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("Import.RemoveImport")(function* (s: ImportState.State, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  if (s.inForce !== 0 || s.standing !== 0) return yield* HasItemsInForce.make({})
  return [ImportRemoved.Event.make({ change: s.changes + 1, by: actor.memberId })]
})
