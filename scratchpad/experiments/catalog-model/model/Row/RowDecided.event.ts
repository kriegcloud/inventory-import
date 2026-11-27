// One event of a row, and what it makes of a row.
import * as Domain from "@alchemy.run/domain"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { Change, Flags, Step } from "../Review/Change.schema.ts"
import { CUT, Level, MOST_BELOW, noLevel, seal } from "./Level.schema.ts"
import * as RowState from "./Row.state.ts"

/**
 * **Details**
 *
 * It says by whom the row was decided, in which step, as which change of its import, with which flags and on which
 * matching.
 *
 * @category events
 * @since 0.0.0
 */
export class Event extends Domain.Event(
  "RowDecided",
  {
    importId: S.String,
    organizationId: S.String,
    change: Change,
    by: S.String,
    step: Step,
    flags: Flags,
    madeOn: S.Int,
    label: S.String
  },
  { description: "A row's decision was recorded, over the one it replaces" }
) {}

/**
 * What a row is after `RowDecided`: the decision, over the one it replaces.
 *
 * **Details**
 *
 * The decision it replaces goes under it in full, and the one under that is sealed onto `below`. Once `below` is past
 * `MOST_BELOW` characters the history is let go and `below` becomes `CUT`. The row's last undo is carried on.
 *
 * **Example** (A second decision keeps the first under it)
 *
 * ```ts
 * import * as RowState from "./Row.state.ts"
 * import * as RowDecided from "./RowDecided.event.ts"
 *
 * const decided = (change: number, by: string, step: string) =>
 *   RowDecided.Event.make({
 *     importId: "imp-1",
 *     organizationId: "org-1",
 *     change,
 *     by,
 *     step,
 *     flags: "{}",
 *     madeOn: 1,
 *     label: "Keep"
 *   })
 *
 * const first = RowDecided.evolve(RowState.Untouched.make({ undone: RowState.noUndo }), decided(1, "ana", "s-1"))
 * const second = RowDecided.evolve(first, decided(2, "dana", "s-2"))
 *
 * RowState.guards.Decided(second) && second.by // => "dana"
 * RowState.guards.Decided(second) && second.under.by // => "ana"
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const evolve: {
  (e: Event): (s: RowState.State) => RowState.State
  (s: RowState.State, e: Event): RowState.State
} = dual(2, (s: RowState.State, e: Event): RowState.State =>
  RowState.Decided.make({
    importId: e.importId,
    organizationId: e.organizationId,
    change: e.change,
    by: e.by,
    step: e.step,
    flags: e.flags,
    madeOn: e.madeOn,
    label: e.label,
    under: RowState.guards.Decided(s)
      ? Level.make({
          change: s.change,
          by: s.by,
          step: s.step,
          flags: s.flags,
          madeOn: s.madeOn,
          label: s.label,
          bySize: s.by.length,
          stepSize: s.step.length,
          flagsSize: s.flags.length,
          labelSize: s.label.length
        })
      : noLevel,
    below:
      !RowState.guards.Decided(s) || s.under.change === 0
        ? ""
        : s.below.length > MOST_BELOW
          ? CUT
          : seal({ level: s.under, below: s.below }),
    undone: s.undone
  })
)
