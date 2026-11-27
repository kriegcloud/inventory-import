// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as ImportState from "../Import.state.ts"

/**
 * **Details**
 *
 * A suggestion was asked for. It changes nothing a person decided and takes no change number.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "SuggestionRecorded",
  { by: S.String },
  { description: "A suggestion was recorded; it writes nothing" }
) {}

/**
 * Counts one more suggestion in an open import's opening; any other state is left as it was.
 *
 * **Details**
 *
 * It reads the state alone, and moves neither the change number nor the matching.
 *
 * **Example** (Count a suggestion)
 *
 * ```ts
 * import * as ImportState from "../Import.state.ts"
 * import * as SuggestionRecorded from "./SuggestionRecorded.event.ts"
 *
 * const before = ImportState.Open.make({ organizationId: "org-1", rows: 3, columns: "sku=A" })
 * const after = SuggestionRecorded.evolve(before)
 *
 * if (ImportState.guards.Open(after)) {
 *   after.suggestions // => 1
 *   after.changes // => 0
 * }
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve = (s: ImportState.State): ImportState.State =>
  ImportState.guards.Open(s) ? ImportState.Open.make({ ...s, suggestions: s.suggestions + 1 }) : s
