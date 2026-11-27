// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as ImportState from "./Import.state.ts"

/** A suggestion was asked for. It changes nothing a person decided. */
export class Event extends Domain.Event(
  "SuggestionRecorded",
  { by: S.String },
  { description: "A suggestion was recorded; it writes nothing" }
) {}

/** What an import is after `SuggestionRecorded`. */
export const evolve = (s: ImportState.State): ImportState.State =>
  ImportState.guards.Open(s) ? { ...s, suggestions: s.suggestions + 1 } : s
