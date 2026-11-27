// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"
import * as ImportState from "./Import.state.ts"

/**
 * The import was taken back. Of the items its confirms created: how many were removed, and kept because someone
 * changed them. Of the replacements they made (a count of replacements, as the confirms said them, not of items):
 * how many were put back, and kept for the same reason.
 */
export class Event extends Domain.Event(
  "ImportTakenBack",
  { change: Change, removed: S.Natural, kept: S.Natural, restored: S.Natural, keptReplaced: S.Natural, by: S.String },
  { description: "The import was taken back: what was removed, put back and kept" }
) {}

// Taken back from its result it says so; taken back while it is open again it stays open.

/** What an import is after `ImportTakenBack`. */
export const evolve: {
  (e: Event): (s: ImportState.State) => ImportState.State
  (s: ImportState.State, e: Event): ImportState.State
} = dual(2, (s: ImportState.State, e: Event): ImportState.State =>
  ImportState.guards.Open(s)
    ? { ...s, changes: e.change, confirmedAt: 0, inForce: e.kept, replaced: 0, standing: 0 }
    : ImportState.guards.Imported(s)
      ? ImportState.TakenBack.make({
          status: "TakenBack",
          organizationId: s.organizationId,
          rows: s.rows,
          confirms: s.confirms,
          matching: s.matching,
          columns: s.columns,
          changes: e.change,
          confirmedAt: 0,
          inForce: e.kept,
          replaced: 0,
          standing: 0,
          lastGroup: s.lastGroup,
          topGroup: s.topGroup,
          removed: e.removed,
          kept: e.kept
        })
      : s
)
