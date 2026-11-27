// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Columns } from "../../Review/Change.schema.ts"
import * as ImportState from "../Import.state.ts"

/**
 * A file was staged for review: how many rows it has and which column fills each field by its heading.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "ImportStaged",
  { organizationId: S.String, rows: S.Natural, columns: Columns, by: S.String },
  { description: "A file was staged for review" }
) {}

/**
 * Makes an open import of the staged file, its organization, rows and columns, with every count at zero.
 *
 * **Gotchas**
 *
 * It does not read the state before: `StageImport` refuses an import that was staged already, so only an unstaged
 * one reaches it.
 *
 * **Example** (Stage a file)
 *
 * ```ts
 * import * as ImportState from "../Import.state.ts"
 * import * as ImportStaged from "./ImportStaged.event.ts"
 *
 * const staged = ImportStaged.Event.make({ organizationId: "org-1", rows: 120, columns: "sku=A", by: "member-1" })
 * const after = ImportStaged.evolve(ImportState.Unstaged.make({}), staged)
 *
 * if (ImportState.guards.Open(after)) {
 *   after.rows // => 120
 *   after.changes // => 0
 *   after.inForce // => 0
 * }
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve: {
  (e: Event): (s: ImportState.State) => ImportState.State
  (s: ImportState.State, e: Event): ImportState.State
} = dual(2, (_: ImportState.State, e: Event): ImportState.State =>
  ImportState.Open.make({ organizationId: e.organizationId, rows: e.rows, columns: e.columns })
)
