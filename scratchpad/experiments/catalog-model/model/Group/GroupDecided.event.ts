// One event of an act on a group, and what it makes of a group.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import { Change } from "../Review/Change.schema.ts"
import * as GroupState from "./Group.state.ts"

/**
 * **Details**
 *
 * It says which rows the act names and what it does to each, as which change of its import, by whom and on which
 * matching. `under` is the last group in force on the import when this one was decided (0 for none), so that taking
 * this one back makes that one the last in force again.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "GroupDecided",
  { ...GroupState.act, under: Change },
  { description: "One act on a group of rows was recorded: its rows, what it does to each, and whose it is" }
) {}

/**
 * What a group is after `GroupDecided`: the act, in force.
 *
 * **Details**
 *
 * Only a group no act was decided for takes it. A group that is already decided is left as it is, so a step decides
 * one group, once.
 *
 * **Example** (Decide an untouched group)
 *
 * ```ts
 * import * as Change from "../Review/Change.schema.ts"
 * import * as GroupState from "./Group.state.ts"
 * import * as GroupDecided from "./GroupDecided.event.ts"
 *
 * const decided = GroupDecided.evolve(
 *   GroupState.Untouched.make({}),
 *   GroupDecided.Event.make({
 *     importId: Change.ImportKey.make("imp-1"),
 *     organizationId: "org-1",
 *     change: 5,
 *     by: "ana",
 *     step: "s-4",
 *     patch: '{"brand":"Acme"}',
 *     rows: '["row-1","row-2"]',
 *     count: 2,
 *     madeOn: 1,
 *     label: "Fill brand",
 *     under: 0
 *   })
 * )
 *
 * GroupState.guards.Decided(decided) && decided.undoneAt // => 0
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve: {
  (e: Event): (s: GroupState.State) => GroupState.State
  (s: GroupState.State, e: Event): GroupState.State
} = dual(2, (s: GroupState.State, e: Event): GroupState.State =>
  GroupState.guards.Untouched(s)
    ? GroupState.Decided.make({
        importId: e.importId,
        organizationId: e.organizationId,
        change: e.change,
        by: e.by,
        step: e.step,
        patch: e.patch,
        rows: e.rows,
        count: e.count,
        madeOn: e.madeOn,
        label: e.label,
        under: e.under
      })
    : s
)
