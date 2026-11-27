// One command of the import, and what the import decides of it; it returns no rejection of its own.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../../Actor/Actor.context.ts"
import { Session } from "../../Actor/Session.middleware.ts"
import { ImportKey } from "../../Review/Change.schema.ts"
import { ImportNotFound, NoImportThere, NotOpen, NotPermitted } from "../Import.rejection.ts"
import * as ImportState from "../Import.state.ts"
import * as SuggestionRecorded from "../events/SuggestionRecorded.event.ts"

/**
 * **Details**
 *
 * It names only the import: the suggestion itself is not recorded, only that one was asked for.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "RecordSuggestion",
  {
    middleware: [Session],
    input: { importId: ImportKey },
    events: [SuggestionRecorded.Event],
    rejects: [NotPermitted, ImportNotFound, NotOpen]
  },
  { description: "Record that a suggestion was asked for; it changes no decision" }
) {}

/**
 * Records one `SuggestionRecorded` on an open import, refusing `NotOpen` first and then `NotPermitted` for a viewer
 * or someone in another organization.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("Import.RecordSuggestion")(function* (s: ImportState.State) {
  const actor = yield* CurrentActor
  if (actor.role === "viewer") return yield* NotPermitted.make({ required: "editor" })
  if (ImportState.guards.Unstaged(s) || actor.organizationId !== s.organizationId) {
    return yield* ImportNotFound.make({ reason: NoImportThere })
  }
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  return [SuggestionRecorded.Event.make({ by: actor.memberId })]
})
