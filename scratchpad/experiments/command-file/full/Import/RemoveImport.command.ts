// One command of the import: the events it records and what each makes of an import, the rejections only it
// returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Change, ImportKey } from "../Review/Change.schema.ts"
import { NotOpen, NotPermitted, ReviewMovedOn } from "./Import.rejection.ts"
import { ImportState } from "./Import.state.ts"

/** An open import with nothing in force was removed. */
export class ImportRemoved extends Domain.Event(
  "ImportRemoved",
  { change: Change, by: S.String },
  { description: "An import with nothing in force was removed" }
) {}

/** What an import is after `ImportRemoved`. */
export const evolveImportRemoved = (s: ImportState): ImportState =>
  ImportState.guards.Open(s)
    ? ImportState.cases.Removed.make({ status: "Removed", organizationId: s.organizationId })
    : s

/** Items it created are in force, or a confirm of it was not taken back: it stays with them. */
export class HasItemsInForce extends Domain.Rejection(
  "HasItemsInForce",
  {},
  { description: "The import has items in force, so it is not removed" }
) {}

/** Remove an open import that has nothing in force. */
export class RemoveImport extends Domain.Command(
  "RemoveImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change },
    events: [ImportRemoved],
    rejects: [NotPermitted, NotOpen, ReviewMovedOn, HasItemsInForce]
  },
  { description: "Remove an open import with nothing in force, naming its last change" }
) {}

/** What the import decides of `RemoveImport`. */
export const decideRemoveImport = Effect.fn("Import.RemoveImport")(function* (s: ImportState, cmd: RemoveImport) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
  if (s.inForce !== 0 || s.standing !== 0) return yield* HasItemsInForce.make({})
  return [ImportRemoved.make({ change: s.changes + 1, by: actor.memberId })]
})
