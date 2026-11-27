// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../../Actor/Actor.context.ts"
import { Session } from "../../Actor/Session.middleware.ts"
import { Change, ImportKey } from "../../Review/Change.schema.ts"
import { NotPermitted, ReviewMovedOn } from "../Import.rejection.ts"
import * as ImportState from "../Import.state.ts"
import * as ImportReopened from "../events/ImportReopened.event.ts"

/**
 * **Details**
 *
 * Only a confirmed or taken-back import is opened again.
 *
 * **Gotchas**
 *
 * An import that was never staged, or was removed, gets it too, though it is not open.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotClosed extends Domain.Rejection("NotClosed", {}, { description: "The import is still open" }) {}

/**
 * **Details**
 *
 * `seen` is the last change the sender's screen received. The import opens again to fix rows its confirm did not
 * import; what is in force and what stands carry over.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "ReopenImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change },
    events: [ImportReopened.Event],
    rejects: [NotPermitted, NotClosed, ReviewMovedOn]
  },
  { description: "Open a confirmed or taken-back import again, naming its last change" }
) {}

/**
 * Opens a confirmed or taken-back import again, recording one `ImportReopened` at the next change number.
 *
 * **Details**
 *
 * The checks run in this order, and the first that fails is the rejection: `NotClosed` for any other state;
 * `NotPermitted` for a viewer or someone in another organization; `ReviewMovedOn` when `seen` is not the last change.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("Import.ReopenImport")(function* (s: ImportState.State, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Imported(s) && !ImportState.guards.TakenBack(s)) return yield* NotClosed.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  return [ImportReopened.Event.make({ change: s.changes + 1, by: actor.memberId })]
})
