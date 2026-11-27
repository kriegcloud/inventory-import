// One event of an act on a group, and what it makes of a group.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import { Change } from "../Review/Change.schema.ts"
import * as GroupState from "./Group.state.ts"

/**
 * **Details**
 *
 * `change` is the change of its import that took the act back.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "GroupUndone",
  { change: Change },
  { description: "An act on a group of rows was taken back" }
) {}

/**
 * What a group is after `GroupUndone`: the act, taken back by that change.
 *
 * **Details**
 *
 * Everything else the act decided stays as it was. A group no act was decided for is left as it is.
 *
 * **Example** (Take back a decided group)
 *
 * ```ts
 * import * as GroupState from "./Group.state.ts"
 * import * as GroupUndone from "./GroupUndone.event.ts"
 *
 * const decided = GroupState.Decided.make({
 *   importId: "imp-1",
 *   organizationId: "org-1",
 *   change: 5,
 *   by: "ana",
 *   step: "s-4",
 *   patch: '{"brand":"Acme"}',
 *   rows: '["row-1","row-2"]',
 *   count: 2,
 *   madeOn: 1,
 *   label: "Fill brand",
 *   under: 0
 * })
 * const undone = GroupUndone.evolve(decided, GroupUndone.Event.make({ change: 7 }))
 *
 * GroupState.guards.Decided(undone) && undone.undoneAt // => 7
 * GroupState.guards.Decided(undone) && undone.rows // => '["row-1","row-2"]'
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve: {
  (e: Event): (s: GroupState.State) => GroupState.State
  (s: GroupState.State, e: Event): GroupState.State
} = dual(2, (s: GroupState.State, e: Event): GroupState.State =>
  GroupState.guards.Decided(s) ? GroupState.Decided.make({ ...s, undoneAt: e.change }) : s
)
