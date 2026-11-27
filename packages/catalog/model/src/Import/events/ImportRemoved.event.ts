// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Change } from "../../Review/Change.schema.ts"
import * as ImportState from "../Import.state.ts"

/**
 * **Details**
 *
 * Only an open import is removed, and only once no item it created is in force and no confirm of it stands.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "ImportRemoved",
  { change: Change, by: S.String },
  { description: "An import with nothing in force was removed" }
) {}

/**
 * Turns an open import into a removed one that keeps only its organization; any other state is left as it was.
 *
 * **Details**
 *
 * It reads the state alone: nothing of the event stays with a removed import.
 *
 * **Example** (Remove an open import)
 *
 * ```ts
 * import * as ImportState from "../Import.state.ts"
 * import * as ImportRemoved from "./ImportRemoved.event.ts"
 *
 * const before = ImportState.Open.make({ organizationId: "org-1", rows: 3, columns: "sku=A" })
 * const after = ImportRemoved.evolve(before)
 *
 * after.status // => "Removed"
 * ImportRemoved.evolve(ImportState.Unstaged.make({})).status // => "Unstaged"
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve = (s: ImportState.State): ImportState.State =>
  ImportState.guards.Open(s) ? ImportState.Removed.make({ organizationId: s.organizationId }) : s
