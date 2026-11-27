// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change } from "../../Review/Change.schema.ts"
import * as ImportState from "../Import.state.ts"

/**
 * The import was confirmed: what became of its rows, as the four outcomes that add up to them.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "ImportConfirmed",
  { change: Change, created: S.Natural, updated: S.Natural, already: S.Natural, notImported: S.Natural, by: S.String },
  { description: "The import was confirmed: how many rows were created, updated, already there and not imported" }
) {}

/**
 * Turns an open import into an imported one with the confirm's four outcomes; any other state is left as it was.
 *
 * **Details**
 *
 * The confirm counts once more and stands, `confirmedAt` becomes its change, what it created is added to what is in
 * force, and what it updated to what was replaced.
 *
 * **Example** (Confirm an open import)
 *
 * ```ts
 * import * as ImportState from "../Import.state.ts"
 * import * as ImportConfirmed from "./ImportConfirmed.event.ts"
 *
 * const before = ImportState.Open.make({ organizationId: "org-1", rows: 3, columns: "sku=A" })
 * const confirm = ImportConfirmed.Event.make({
 *   change: 1,
 *   created: 2,
 *   updated: 1,
 *   already: 0,
 *   notImported: 0,
 *   by: "member-1"
 * })
 * const after = ImportConfirmed.evolve(before, confirm)
 *
 * if (ImportState.guards.Imported(after)) {
 *   after.confirms // => 1
 *   after.confirmedAt // => 1
 *   after.inForce // => 2
 *   after.replaced // => 1
 *   after.standing // => 1
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
    ? ImportState.Imported.make({
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
