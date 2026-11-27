// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"
import { ImportState } from "./Import.state.ts"

/** A closed import was opened again, to fix rows it did not import. */
export class Event extends Domain.Event(
  "ImportReopened",
  { change: Change, by: S.String },
  { description: "A confirmed or taken-back import was opened again" }
) {}

/** What an import is after `ImportReopened`. */
export const evolve: {
  (e: Event): (s: ImportState) => ImportState
  (s: ImportState, e: Event): ImportState
} = dual(2, (s: ImportState, e: Event): ImportState =>
  ImportState.guards.Imported(s) || ImportState.guards.TakenBack(s)
    ? ImportState.cases.Open.make({
        status: "Open",
        organizationId: s.organizationId,
        rows: s.rows,
        confirms: s.confirms,
        matching: s.matching,
        columns: s.columns,
        changes: e.change,
        confirmedAt: s.confirmedAt,
        inForce: s.inForce,
        replaced: s.replaced,
        standing: s.standing,
        lastGroup: s.lastGroup,
        topGroup: s.topGroup,
        suggestions: 0
      })
    : s
)
