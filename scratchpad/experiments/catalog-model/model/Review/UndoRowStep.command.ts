// One command of the review: the rejections only it returns, and what its decision decides of it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import * as ActCounted from "../Import/events/ActCounted.event.ts"
import { Import } from "../Import/Import.aggregate.ts"
import { ConfirmedSince, MatchedSince, NotOpen, NotPermitted } from "../Import/Import.rejection.ts"
import * as ImportState from "../Import/Import.state.ts"
import { Below, CUT, letGo, Level, noLevel, seal, sizesAreTrue } from "../Row/Level.schema.ts"
import { Row } from "../Row/Row.aggregate.ts"
import * as RowState from "../Row/Row.state.ts"
import * as StepUndone from "../Row/StepUndone.event.ts"
import { Change, ImportKey, RowKey, Step, UNDO_LABEL } from "./Change.schema.ts"
import { DecidedBeforeTheConfirm, GroupedAfter, GroupedSince, NotYourStep, UndoneSince } from "./Review.rejection.ts"

/**
 * **Details**
 *
 * The level brought is taken only when its sizes are true and it seals, with the `below` brought under it, to exactly
 * the text the row holds.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotWhatWasUnder extends Domain.Rejection(
  "NotWhatWasUnder",
  {},
  { description: "The level brought to go under the decision put back is not the one recorded" }
) {}

/**
 * **Details**
 *
 * The level under the row's decision is one that was let go (`letGo`): the history past `MOST_BELOW` characters was
 * cut, and an undo stops there.
 *
 * @category rejections
 * @since 0.0.0
 */
export class HistoryEnds extends Domain.Rejection(
  "HistoryEnds",
  {},
  { description: "The decisions below this one are no longer kept" }
) {}

/**
 * **Details**
 *
 * `undo` is the change taken back; `step` is this act's own; `sawGroup` is the import's last act on a group as the
 * sender's screen has it; `covered` says a group in force, decided after the decision taken back, covers the row (the
 * sender's word, from a screen that has every group act: `sawGroup`); `madeOn` is the import's matching the undo was
 * pressed on; `sawUndone` is the change the row's last undo took back, as the sender's screen has it, or 0 for none;
 * `next`, with `below` under it, goes under the decision put back.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "UndoRowStep",
  {
    middleware: [Session],
    input: {
      importId: ImportKey,
      row: RowKey,
      undo: Change,
      step: Step,
      sawGroup: Change,
      covered: S.Boolean,
      madeOn: S.Int,
      sawUndone: Change,
      opening: S.Int,
      next: Level,
      below: Below
    },
    events: [StepUndone.Event, ActCounted.Event],
    rejects: [
      NotOpen,
      NotPermitted,
      ConfirmedSince,
      GroupedSince,
      NotYourStep,
      UndoneSince,
      MatchedSince,
      GroupedAfter,
      DecidedBeforeTheConfirm,
      HistoryEnds,
      NotWhatWasUnder
    ]
  },
  { description: "Take back the sender's own decision on one row, bringing the level it uncovers" }
) {}

/** What the decision reads for `UndoRowStep`: the import, and the row the command names. */
type Reads = {
  readonly life: Domain.Decision.Read<typeof Import>
  readonly row: Domain.Decision.Read<typeof Row>
}

/**
 * What `Undoing` decides of `UndoRowStep`: the events to record on the import and on the row, or a refusal.
 *
 * **Details**
 *
 * A copy of an undo the row took already returns no events. The level put under the decision put back is the one the
 * command brings only when the row kept a history below; otherwise it is `noLevel`, or `letGo` when the history was
 * cut. The import's event says what the row holds afterwards and whose it is.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("Undoing.decide")(function* ({ life, row }: Reads, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(life.state)) return yield* NotOpen.make({})
  if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
    return yield* NotPermitted.make({})
  }
  if (
    !RowState.guards.Untouched(row.state) &&
    (row.state.importId !== cmd.importId || row.state.organizationId !== life.state.organizationId)
  ) {
    return yield* NotPermitted.make({})
  }
  // The same undo sent again: the row took this very act already (this change, in this step, from this person),
  // and it is written once. Its sender is answered as the first time, with nothing new, whatever was decided on
  // the row since, and whatever landed on the import between the two sendings: a confirm and a reopening, or an
  // act on a group, which the copy cannot have seen (2026-11-22, by the rule on a press from a screen that is
  // behind). It is asked inside each refusal, and worked out there: worked out once before them, its three
  // comparisons multiply every way through this `decide` for the prover (814 paths then, where this form had 362;
  // 364 now). The row keeps its last undo only: a copy that arrives after another undo on the same row is not known,
  // and is refused as not its sender's step.
  if (cmd.opening !== life.state.confirms) {
    if (RowState.tookThisUndo({ row: row.state, undo: cmd.undo, step: cmd.step, by: actor.memberId })) return []
    return yield* ConfirmedSince.make({})
  }
  if (cmd.sawGroup !== life.state.lastGroup) {
    if (RowState.tookThisUndo({ row: row.state, undo: cmd.undo, step: cmd.step, by: actor.memberId })) return []
    return yield* GroupedSince.make({})
  }
  if (!RowState.guards.Decided(row.state) || row.state.by !== actor.memberId || row.state.change !== cmd.undo) {
    if (RowState.tookThisUndo({ row: row.state, undo: cmd.undo, step: cmd.step, by: actor.memberId })) return []
    return yield* NotYourStep.make({})
  }
  // An undo landed on the row that the sender's screen has not received: another person decided over the sender's
  // decision and took that back, so the row holds the sender's decision again, as the screen that is behind shows
  // it. The press names what the row holds and would be applied from a screen that has neither act. It is refused
  // with who took that undo and of which change, and held (2026-11-22, by the rule on a press from a screen that
  // is behind), as a row's act is.
  if (cmd.sawUndone !== row.state.undone.change) {
    return yield* UndoneSince.make({ by: row.state.undone.by, change: row.state.undone.change })
  }
  // An undo puts back the decision under the one taken back, another person's included, on the matching that one
  // was made on. Pressed on a screen that has not received a match, it is refused and held as a row's act is.
  if (cmd.madeOn !== life.state.matching) return yield* MatchedSince.make({ matching: life.state.matching })
  // A group in force was decided after this decision and covers the row: it was drawn on a screen that had the
  // decision, as a later group was on one that had an earlier group. Refused and shown; once the group is taken
  // back, the decision can be (2026-11-22, by the rule on a press from a screen that is behind).
  if (cmd.covered) return yield* GroupedAfter.make({ last: life.state.topGroup })
  // What a standing confirm wrote is taken back with the import, not here.
  if (row.state.change <= life.state.confirmedAt) return yield* DecidedBeforeTheConfirm.make({})
  if (row.state.under.change === -1) return yield* HistoryEnds.make({})
  // What goes under the decision put back must be what was under it, to the letter; nothing, when nothing was, and
  // a level let go when the rest was let go.
  const kept = row.state.below !== "" && row.state.below !== CUT
  if (kept && (!sizesAreTrue(cmd.next) || seal({ level: cmd.next, below: cmd.below }) !== row.state.below)) {
    return yield* NotWhatWasUnder.make({})
  }
  const next = kept ? cmd.next : row.state.below === CUT ? letGo : noLevel
  const under = row.state.under
  return [
    row.record(
      StepUndone.Event.make({ next, below: kept ? cmd.below : "", undo: cmd.undo, step: cmd.step, by: actor.memberId })
    ),
    life.record(
      ActCounted.Event.make({
        change: life.state.changes + 1,
        step: cmd.step,
        row: cmd.row,
        label: UNDO_LABEL,
        holds: under.change,
        by: under.by,
        actor: actor.memberId,
        flags: under.flags,
        madeOn: under.madeOn
      })
    )
  ]
})
