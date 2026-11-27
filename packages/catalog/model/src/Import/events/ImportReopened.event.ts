// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change } from "../../Review/Change.schema.ts"
import * as ImportState from "../Import.state.ts"

/**
 * A closed import was opened again, to fix rows it did not import.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "ImportReopened",
  { change: Change, by: S.String },
  { description: "A confirmed or taken-back import was opened again" }
) {}

/**
 * Opens a confirmed or taken-back import again at the reopen's change number; any other state is left as it was.
 *
 * **Details**
 *
 * What is in force, what was replaced and what stands carry over, so a later take-back is still of them.
 * `suggestions` is not carried: it counts one opening, and starts again at zero.
 *
 * **Example** (Reopen a confirmed import)
 *
 * ```ts
 * import * as ImportState from "../Import.state.ts"
 * import * as ImportConfirmed from "./ImportConfirmed.event.ts"
 * import * as ImportReopened from "./ImportReopened.event.ts"
 *
 * const open = ImportState.Open.make({ organizationId: "org-1", rows: 2, columns: "sku=A", suggestions: 3 })
 * const confirmed = ImportConfirmed.evolve(
 *   open,
 *   ImportConfirmed.Event.make({ change: 1, created: 1, updated: 0, already: 0, notImported: 1, by: "member-1" })
 * )
 * const reopened = ImportReopened.evolve(confirmed, ImportReopened.Event.make({ change: 2, by: "member-1" }))
 *
 * if (ImportState.guards.Open(reopened)) {
 *   reopened.changes // => 2
 *   reopened.inForce // => 1
 *   reopened.standing // => 1
 *   reopened.suggestions // => 0
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
  ImportState.guards.Imported(s) || ImportState.guards.TakenBack(s)
    ? ImportState.Open.make({
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
        topGroup: s.topGroup
      })
    : s
)
