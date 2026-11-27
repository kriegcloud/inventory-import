// One command of the import: the rejections only it returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { ImportKey } from "../Review/Change.schema.ts"
import { NotOpen, NotPermitted } from "./Import.rejection.ts"
import { ImportState } from "./Import.state.ts"
import * as SuggestionRecorded from "./SuggestionRecorded.event.ts"

/** Record that a suggestion was asked for. */
export class Command extends Domain.Command(
  "RecordSuggestion",
  {
    middleware: [Session],
    input: { importId: ImportKey },
    events: [SuggestionRecorded.Event],
    rejects: [NotPermitted, NotOpen]
  },
  { description: "Record that a suggestion was asked for; it changes no decision" }
) {}

/** What the import decides of `RecordSuggestion`. */
export const decide = Effect.fn("Import.RecordSuggestion")(function* (s: ImportState) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  return [SuggestionRecorded.Event.make({ by: actor.memberId })]
})
