// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Change, ImportKey } from "../Review/Change.schema.ts"
import { NotPermitted, ReviewMovedOn } from "./Import.rejection.ts"
import * as ImportState from "./Import.state.ts"
import * as ImportTakenBack from "./ImportTakenBack.event.ts"

/** No confirm of this import stands, so there is nothing to take back. */
export class NotImported extends Domain.Rejection(
  "NotImported",
  {},
  { description: "No confirm of this import stands" }
) {}

/** A take-back says it keeps more items than are in force. */
export class MoreKeptThanInForce extends Domain.Rejection(
  "MoreKeptThanInForce",
  {},
  { description: "A take-back keeps more items than the import has in force" }
) {}

/** Take back everything the import has in force, saying how many changed items are kept. */
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

/** What the import decides of `TakeBackImport`. */
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
