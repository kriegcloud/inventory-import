// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change, Columns } from "../Review/Change.schema.ts"
import * as ImportState from "./Import.state.ts"

/**
 * Which column fills each field now, every field a match moved included, the number of the match, and who made it:
 * the mapping, and since which match each field reads its column, can be rebuilt from the import's events alone.
 */
export class Event extends Domain.Event(
  "ColumnMatched",
  { change: Change, matching: S.Int, columns: Columns, by: S.String },
  { description: "A column was matched to a field: every field's column after it" }
) {}

/** What an import is after `ColumnMatched`. */
export const evolve: {
  (e: Event): (s: ImportState.State) => ImportState.State
  (s: ImportState.State, e: Event): ImportState.State
} = dual(2, (s: ImportState.State, e: Event): ImportState.State =>
  ImportState.guards.Open(s) ? { ...s, changes: e.change, matching: e.matching, columns: e.columns } : s
)
