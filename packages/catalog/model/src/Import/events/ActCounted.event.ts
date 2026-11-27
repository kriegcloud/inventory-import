// An event of the import that only a decision records, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change, Label, RowKey, Step } from "../../Review/Change.schema.ts"
import * as ImportState from "../Import.state.ts"

/**
 * One act on one row, numbered by its import and recorded by the decision that also records the row. It says what the
 * row holds after it: the change that recorded the decision (0 when the row has none), whose it is, and its flags.
 * `actor` is who acted; after an undo the decision the row then holds can be another person's.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "ActCounted",
  {
    change: Change,
    step: Step,
    row: RowKey,
    label: Label,
    holds: Change,
    by: S.String,
    actor: S.String,
    flags: S.String,
    madeOn: S.Int
  },
  { description: "One act on one row was taken: what the row now holds, whose it is, and who acted" }
) {}

/**
 * Moves an open import's change number to the act's; any other state is left as it was.
 *
 * **Details**
 *
 * The import keeps no row: what the row holds is recorded with the row's own instance.
 *
 * **Example** (Count an act on a row)
 *
 * ```ts
 * import * as Change from "../../Review/Change.schema.ts"
 * import * as ActCounted from "./ActCounted.event.ts"
 * import * as ImportState from "../Import.state.ts"
 *
 * const before = ImportState.Open.make({ organizationId: "org-1", rows: 3, columns: "sku=A" })
 * const act = ActCounted.Event.make({
 *   change: 1,
 *   step: "press-1",
 *   row: Change.RowKey.make("row-1"),
 *   label: "Skip row",
 *   holds: 1,
 *   by: "member-1",
 *   actor: "member-1",
 *   flags: "skip",
 *   madeOn: 0
 * })
 * const after = ActCounted.evolve(before, act)
 *
 * if (ImportState.guards.Open(after)) {
 *   after.changes // => 1
 * }
 * ActCounted.evolve(ImportState.Unstaged.make({}), act).status // => "Unstaged"
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve: {
  (e: Event): (s: ImportState.State) => ImportState.State
  (s: ImportState.State, e: Event): ImportState.State
} = dual(2, (s: ImportState.State, e: Event): ImportState.State =>
  ImportState.guards.Open(s) ? ImportState.Open.make({ ...s, changes: e.change }) : s
)
