// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change, Columns } from "../../Review/Change.schema.ts"
import * as ImportState from "../Import.state.ts"

/**
 * Which column fills each field now, every field a match moved included, the number of the match, and who made it:
 * the mapping, and since which match each field reads its column, can be rebuilt from the import's events alone.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "ColumnMatched",
  { change: Change, matching: S.Int, columns: Columns, by: S.String },
  { description: "A column was matched to a field: every field's column after it" }
) {}

/**
 * Gives an open import the match's columns, matching number and change number; any other state is left as it was.
 *
 * **Example** (Match a column)
 *
 * ```ts
 * import * as ColumnMatched from "./ColumnMatched.event.ts"
 * import * as ImportState from "../Import.state.ts"
 *
 * const before = ImportState.Open.make({ organizationId: "org-1", rows: 3, columns: "sku=A" })
 * const match = ColumnMatched.Event.make({ change: 1, matching: 1, columns: "sku=B", by: "member-1" })
 * const after = ColumnMatched.evolve(before, match)
 *
 * if (ImportState.guards.Open(after)) {
 *   after.columns // => "sku=B"
 *   after.matching // => 1
 *   after.changes // => 1
 * }
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve: {
  (e: Event): (s: ImportState.State) => ImportState.State
  (s: ImportState.State, e: Event): ImportState.State
} = dual(2, (s: ImportState.State, e: Event): ImportState.State =>
  ImportState.guards.Open(s)
    ? ImportState.Open.make({ ...s, changes: e.change, matching: e.matching, columns: e.columns })
    : s
)
