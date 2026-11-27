// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"
import { ImportState } from "./Import.state.ts"

/** The import was confirmed: what became of its rows, as the four outcomes that add up to them. */
export class Event extends Domain.Event(
  "ImportConfirmed",
  { change: Change, created: S.Natural, updated: S.Natural, already: S.Natural, notImported: S.Natural, by: S.String },
  { description: "The import was confirmed: how many rows were created, updated, already there and not imported" }
) {}

/** What an import is after `ImportConfirmed`. */
export const evolve: {
  (e: Event): (s: ImportState) => ImportState
  (s: ImportState, e: Event): ImportState
} = dual(2, (s: ImportState, e: Event): ImportState =>
  ImportState.guards.Open(s)
    ? ImportState.cases.Imported.make({
        status: "Imported",
        organizationId: s.organizationId,
        rows: s.rows,
        confirms: s.confirms + 1,
        matching: s.matching,
        columns: s.columns,
        changes: e.change,
        confirmedAt: e.change,
        inForce: s.inForce + e.created,
        replaced: s.replaced + e.updated,
        standing: s.standing + 1,
        lastGroup: s.lastGroup,
        topGroup: s.topGroup,
        created: e.created,
        updated: e.updated,
        already: e.already,
        notImported: e.notImported
      })
    : s
)
