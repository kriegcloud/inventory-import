// One event of a row, and what it makes of a row.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change, Step } from "../Review/Change.schema.ts"
import { Level } from "./Level.schema.ts"
import * as RowState from "./Row.state.ts"

/**
 * **Details**
 *
 * `next` goes under the decision put back, with `below` under it. `undo`, `step` and `by` say which change was taken
 * back, in which step and by whom: the row keeps them as its last undo.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "StepUndone",
  { next: Level, below: S.String, undo: Change, step: Step, by: S.String },
  { description: "A row's decision was taken back, and the one under it put back" }
) {}

/**
 * What a row is after `StepUndone`: the decision under the one taken back, or none.
 *
 * **Details**
 *
 * When nothing was under the decision taken back, the row is `Undecided`. Either way the undo becomes the row's last.
 * A row that holds no decision is left as it is.
 *
 * **Example** (Put back the decision under)
 *
 * ```ts
 * import * as Change from "../Review/Change.schema.ts"
 * import * as Level from "./Level.schema.ts"
 * import * as RowState from "./Row.state.ts"
 * import * as StepUndone from "./StepUndone.event.ts"
 *
 * const decided = RowState.Decided.make({
 *   importId: Change.ImportKey.make("imp-1"),
 *   organizationId: "org-1",
 *   change: 4,
 *   by: "dana",
 *   step: "s-2",
 *   flags: '{"kept":false}',
 *   madeOn: 1,
 *   label: "Leave out",
 *   under: Level.Level.make({
 *     change: 3,
 *     by: "ana",
 *     step: "s-1",
 *     flags: '{"kept":true}',
 *     madeOn: 1,
 *     label: "Keep",
 *     bySize: 3,
 *     stepSize: 3,
 *     flagsSize: 13,
 *     labelSize: 4
 *   }),
 *   below: "",
 *   undone: RowState.noUndo
 * })
 *
 * const after = StepUndone.evolve(
 *   decided,
 *   StepUndone.Event.make({ next: Level.noLevel, below: "", undo: 4, step: "s-3", by: "dana" })
 * )
 *
 * RowState.guards.Decided(after) && after.by // => "ana"
 * after.undone.change // => 4
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve: {
  (e: Event): (s: RowState.State) => RowState.State
  (s: RowState.State, e: Event): RowState.State
} = dual(2, (s: RowState.State, e: Event): RowState.State =>
  !RowState.guards.Decided(s)
    ? s
    : s.under.change !== 0
      ? RowState.Decided.make({
          importId: s.importId,
          organizationId: s.organizationId,
          change: s.under.change,
          by: s.under.by,
          step: s.under.step,
          flags: s.under.flags,
          madeOn: s.under.madeOn,
          label: s.under.label,
          under: e.next,
          below: e.below,
          undone: RowState.Undone.make({ change: e.undo, step: e.step, by: e.by })
        })
      : RowState.Undecided.make({
          importId: s.importId,
          organizationId: s.organizationId,
          undone: RowState.Undone.make({ change: e.undo, step: e.step, by: e.by })
        })
)
