// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Change, ImportKey } from "../Review/Change.schema.ts"
import { NotPermitted, ReviewMovedOn } from "./Import.rejection.ts"
import * as ImportState from "./Import.state.ts"
import * as ImportReopened from "./ImportReopened.event.ts"

/** The import is open: only a confirmed or taken-back one is opened again. */
export class NotClosed extends Domain.Rejection("NotClosed", {}, { description: "The import is still open" }) {}

/** Open a confirmed or taken-back import again. */
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

/** What the import decides of `ReopenImport`. */
export const decide = Effect.fn("Import.ReopenImport")(function* (s: ImportState.State, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Imported(s) && !ImportState.guards.TakenBack(s)) return yield* NotClosed.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  return [ImportReopened.Event.make({ change: s.changes + 1, by: actor.memberId })]
})
