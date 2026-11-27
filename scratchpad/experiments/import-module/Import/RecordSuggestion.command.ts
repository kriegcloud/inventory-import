// One command of the import: the events it records and what each makes of an import, the rejections only it
// returns, and what the import decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { ImportKey } from "../Review/Change.schema.ts"
import { NotOpen, NotPermitted } from "./Import.rejection.ts"
import { ImportState } from "./Import.state.ts"

/** A suggestion was asked for. It changes nothing a person decided. */
export class SuggestionRecorded extends Domain.Event(
  "SuggestionRecorded",
  { by: S.String },
  { description: "A suggestion was recorded; it writes nothing" }
) {}

/** What an import is after `SuggestionRecorded`. */
export const evolve = (s: ImportState): ImportState =>
  ImportState.guards.Open(s) ? { ...s, suggestions: s.suggestions + 1 } : s

/** Record that a suggestion was asked for. */
export class RecordSuggestion extends Domain.Command(
  "RecordSuggestion",
  {
    middleware: [Session],
    input: { importId: ImportKey },
    events: [SuggestionRecorded],
    rejects: [NotPermitted, NotOpen]
  },
  { description: "Record that a suggestion was asked for; it changes no decision" }
) {}

/** What the import decides of `RecordSuggestion`. */
export const decide = Effect.fn("Import.RecordSuggestion")(function* (s: ImportState) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(s)) return yield* NotOpen.make({})
  if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* NotPermitted.make({})
  return [SuggestionRecorded.make({ by: actor.memberId })]
})
