// An event of the import that only a decision records, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change, Label, Step } from "../../Review/Change.schema.ts"
import * as ImportState from "../Import.state.ts"

/**
 * One act on a group of rows, or its undo, numbered by its import and recorded by the decision that also records the
 * group: how many rows it is of, and who acted. `top` is the last act on a group still in force after this one: itself
 * when it decides a group, the one that was under it when it takes one back (0 for none).
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "GroupCounted",
  { change: Change, step: Step, rows: S.Natural, label: Label, by: S.String, top: Change },
  {
    description:
      "One act on a group of rows, or its undo, was taken: how many rows, who acted, which group is last in force"
  }
) {}

/**
 * Makes the act an open import's last group act and its change number, and `top` the last group still in force; any
 * other state is left as it was.
 *
 * **Example** (Count an act on a group)
 *
 * ```ts
 * import * as GroupCounted from "./GroupCounted.event.ts"
 * import * as ImportState from "../Import.state.ts"
 *
 * const before = ImportState.Open.make({ organizationId: "org-1", rows: 40, columns: "sku=A", changes: 1 })
 * const group = GroupCounted.Event.make({
 *   change: 2,
 *   step: "press-2",
 *   rows: 40,
 *   label: "Skip 40 rows",
 *   by: "member-1",
 *   top: 2
 * })
 * const after = GroupCounted.evolve(before, group)
 *
 * if (ImportState.guards.Open(after)) {
 *   after.lastGroup // => 2
 *   after.topGroup // => 2
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
    ? ImportState.Open.make({ ...s, changes: e.change, lastGroup: e.change, topGroup: e.top })
    : s
)
