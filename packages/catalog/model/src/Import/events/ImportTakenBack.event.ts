// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change } from "../../Review/Change.schema.ts"
import * as ImportState from "../Import.state.ts"

/**
 * The import was taken back. Of the items its confirms created: how many were removed, and kept because someone
 * changed them. Of the replacements they made (a count of replacements, as the confirms said them, not of items):
 * how many were put back, and kept for the same reason.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "ImportTakenBack",
  { change: Change, removed: S.Natural, kept: S.Natural, restored: S.Natural, keptReplaced: S.Natural, by: S.String },
  { description: "The import was taken back: what was removed, put back and kept" }
) {}

/**
 * Takes back what a confirmed or reopened import has in force: nothing stands after, and what is in force is what was
 * kept. Any other state is left as it was.
 *
 * **Details**
 *
 * Taken back from its result, an import says so: it becomes `TakenBack` with what was removed and kept. Taken back
 * while it is open again, it stays open.
 *
 * **Example** (Take back a confirmed import)
 *
 * ```ts
 * import * as ImportState from "../Import.state.ts"
 * import * as ImportConfirmed from "./ImportConfirmed.event.ts"
 * import * as ImportTakenBack from "./ImportTakenBack.event.ts"
 *
 * const confirmed = ImportConfirmed.evolve(
 *   ImportState.Open.make({ organizationId: "org-1", rows: 3, columns: "sku=A" }),
 *   ImportConfirmed.Event.make({ change: 1, created: 3, updated: 0, already: 0, notImported: 0, by: "member-1" })
 * )
 * const takeBack = ImportTakenBack.Event.make({
 *   change: 2,
 *   removed: 2,
 *   kept: 1,
 *   restored: 0,
 *   keptReplaced: 0,
 *   by: "member-1"
 * })
 * const after = ImportTakenBack.evolve(confirmed, takeBack)
 *
 * if (ImportState.guards.TakenBack(after)) {
 *   after.removed // => 2
 *   after.inForce // => 1
 *   after.standing // => 0
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
    ? ImportState.Open.make({ ...s, changes: e.change, confirmedAt: 0, inForce: e.kept, replaced: 0, standing: 0 })
    : ImportState.guards.Imported(s)
      ? ImportState.TakenBack.make({
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
