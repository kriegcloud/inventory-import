// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Columns } from "../Review/Change.schema.ts"
import { ImportState } from "./Import.state.ts"

/** A file was staged for review: how many rows it has and which column fills each field by its heading. */
export class Event extends Domain.Event(
  "ImportStaged",
  { organizationId: S.String, rows: S.Natural, columns: Columns, by: S.String },
  { description: "A file was staged for review" }
) {}

/** What an import is after `ImportStaged`. */
export const evolve: {
  (e: Event): (s: ImportState) => ImportState
  (s: ImportState, e: Event): ImportState
} = dual(2, (_: ImportState, e: Event): ImportState =>
  ImportState.cases.Open.make({
    status: "Open",
    organizationId: e.organizationId,
    rows: e.rows,
    confirms: 0,
    matching: 0,
    columns: e.columns,
    changes: 0,
    confirmedAt: 0,
    inForce: 0,
    replaced: 0,
    standing: 0,
    lastGroup: 0,
    topGroup: 0,
    suggestions: 0
  })
)
