// One command of the review: the rejections only it returns, what its decision decides of it, and what the decision's
// rules ask of an act of it (`changesNothing`).
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import * as ActCounted from "../Import/events/ActCounted.event.ts"
import { Import } from "../Import/Import.aggregate.ts"
import { ConfirmedSince, MatchedSince, NotOpen, NotPermitted } from "../Import/Import.rejection.ts"
import * as ImportState from "../Import/Import.state.ts"
import { Row } from "../Row/Row.aggregate.ts"
import * as RowState from "../Row/Row.state.ts"
import * as RowDecided from "../Row/RowDecided.event.ts"
import { Change, Flags, ImportKey, Label, RowKey, Step } from "./Change.schema.ts"
import { GroupedSince, UndoneSince, whose } from "./Review.rejection.ts"

/**
 * **Details**
 *
 * The row holds a decision its sender did not see: `by` is whose it is and `change` is the change that recorded it.
 *
 * @category rejections
 * @since 0.0.0
 */
export class DecidedSince extends Domain.Rejection(
  "DecidedSince",
  whose,
  { description: "Someone decided the row since the sender last saw it: whose decision is there" }
) {}

/**
 * **Details**
 *
 * `by` is whose the older decision is and `change` is the change that recorded it. Nobody decided the row since; the
 * one who made the decision the sender saw took it back.
 *
 * @category rejections
 * @since 0.0.0
 */
export class PutBackSince extends Domain.Rejection(
  "PutBackSince",
  whose,
  { description: "The decision the sender saw was taken back, and an older one is there again: whose" }
) {}

/**
 * **Details**
 *
 * The row has no decision now.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NoLongerThere extends Domain.Rejection(
  "NoLongerThere",
  {},
  { description: "The decision the sender saw on the row was taken back" }
) {}

/**
 * **Details**
 *
 * `sawGroup`: the import's last act on a group as the sender's screen has it. `covered`: a group in force on this row
 * was decided after the row's own decision, so the row is not as its own instance has it. `asItReads`: on such a row,
 * the act leaves it reading as it reads now through its groups, so it changes nothing. Both are the sender's word,
 * worked out by the screen from what it received. `opening`: how many times the import had been confirmed when the act
 * was made. `saw`: the change that recorded the decision the sender saw on the row, or 0 for none. `sawUndone`: the
 * change the row's last undo took back, as the sender's screen has it, or 0 for none. `madeOn`: the import's matching
 * the act was made on, whatever it decides.
 *
 * @category commands
 * @since 0.0.0
 */
export class Command extends Domain.Command(
  "DecideRow",
  {
    middleware: [Session],
    input: {
      importId: ImportKey,
      row: RowKey,
      step: Step,
      sawGroup: Change,
      covered: S.Boolean,
      asItReads: S.Boolean,
      opening: S.Int,
      saw: Change,
      sawUndone: Change,
      flags: Flags,
      madeOn: S.Int,
      label: Label
    },
    events: [RowDecided.Event, ActCounted.Event],
    rejects: [
      NotOpen,
      NotPermitted,
      ConfirmedSince,
      GroupedSince,
      DecidedSince,
      PutBackSince,
      NoLongerThere,
      MatchedSince,
      UndoneSince
    ]
  },
  { description: "Decide one row of an import's review, naming the decision the sender saw there" }
) {}

/**
 * The act would leave the row reading as it reads: on a row a group in force covers since its own decision, as its
 * sender says (`asItReads`); on any other, its text and its matching are what the row's own instance holds.
 *
 * **Example** (The row's own text, and the sender's word)
 *
 * ```ts
 * import * as Change from "./Change.schema.ts"
 * import * as Level from "../Row/Level.schema.ts"
 * import * as RowState from "../Row/Row.state.ts"
 * import * as DecideRow from "./DecideRow.command.ts"
 *
 * const row = RowState.Decided.make({
 *   importId: Change.ImportKey.make("imp-1"),
 *   organizationId: "org-1",
 *   change: 4,
 *   by: "dana",
 *   step: "s-1",
 *   flags: '{"kept":true}',
 *   madeOn: 1,
 *   label: "Keep",
 *   under: Level.noLevel,
 *   below: "",
 *   undone: RowState.noUndo
 * })
 * const act = (flags: string, covered: boolean, asItReads: boolean) => ({
 *   row,
 *   command: { flags, madeOn: 1, covered, asItReads }
 * })
 *
 * DecideRow.changesNothing(act('{"kept":true}', false, false)) // => true
 * DecideRow.changesNothing(act('{"kept":false}', false, false)) // => false
 * DecideRow.changesNothing(act('{"kept":false}', true, true)) // => true
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const changesNothing = (act: {
  readonly row: RowState.State
  readonly command: {
    readonly flags: string
    readonly madeOn: number
    readonly covered: boolean
    readonly asItReads: boolean
  }
}): boolean =>
  act.command.covered
    ? act.command.asItReads
    : RowState.leavesAsItIs({ row: act.row, flags: act.command.flags, madeOn: act.command.madeOn })

/** What the decision reads for `DecideRow`: the import, and the row the command names. */
type Reads = {
  readonly life: Domain.Decision.Read<typeof Import>
  readonly row: Domain.Decision.Read<typeof Row>
}

/**
 * What `Deciding` decides of `DecideRow`: the events to record on the import and on the row, or a refusal.
 *
 * **Details**
 *
 * It returns no events for an act it answers as no change, a copy of a press the row holds already among them,
 * whatever landed on the import between the two sendings. A recorded act is written on both with the import's next
 * change number.
 *
 * @category behavior
 * @since 0.0.0
 */
export const decide = Effect.fn("Deciding.decide")(function* ({ life, row }: Reads, cmd: Command) {
  const actor = yield* CurrentActor
  if (!ImportState.guards.Open(life.state)) return yield* NotOpen.make({})
  if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
    return yield* NotPermitted.make({})
  }
  // A row instance belongs to one import of one organization, for good.
  if (
    !RowState.guards.Untouched(row.state) &&
    (row.state.importId !== cmd.importId || row.state.organizationId !== life.state.organizationId)
  ) {
    return yield* NotPermitted.make({})
  }
  // The same press sent again: the row holds this very act already, and it is written once. Its sender is answered
  // as the first time, with nothing new, whatever landed on the import between the two sendings: a confirm and a
  // reopening, or an act on a group, which the copy cannot have seen (2026-11-22, by the rule on a press from a
  // screen that is behind; a row's undo sent twice is answered the same way). It is asked inside each refusal, so
  // that its comparisons are not taken on every way through this `decide` by the prover.
  if (cmd.opening !== life.state.confirms) {
    if (
      RowState.holdsThisAct({
        row: row.state,
        step: cmd.step,
        by: actor.memberId,
        flags: cmd.flags,
        madeOn: cmd.madeOn
      })
    ) {
      return []
    }
    return yield* ConfirmedSince.make({})
  }
  if (cmd.sawGroup !== life.state.lastGroup) {
    if (
      RowState.holdsThisAct({
        row: row.state,
        step: cmd.step,
        by: actor.memberId,
        flags: cmd.flags,
        madeOn: cmd.madeOn
      })
    ) {
      return []
    }
    return yield* GroupedSince.make({})
  }
  // `covered` is asked once, and each side makes its own checks: the prover takes both sides of every question it
  // cannot settle, each time it is asked, and with `covered` asked again after the checks the relation of a row
  // to its import's organization is past 4,096 paths and no longer proved.
  if (cmd.covered) {
    // A group in force covers the row: what it reads as is the sender's word, so the act is no change only from
    // a screen that has seen the row's decision and the matching now. From one that is behind it is refused and
    // held, not lost as "no change" (2026-11-22: "Same: hold, show both").
    if (RowState.guards.Decided(row.state)) {
      if (cmd.saw !== row.state.change) {
        // The same press sent again: the row holds this very act already, and it is written once.
        if (row.state.step === cmd.step && row.state.by === actor.memberId && row.state.flags === cmd.flags) {
          return []
        }
        // What the sender saw was taken back and an older decision is there again, or someone decided since.
        if (cmd.saw > row.state.change) {
          return yield* PutBackSince.make({ by: row.state.by, change: row.state.change })
        }
        return yield* DecidedSince.make({ by: row.state.by, change: row.state.change })
      }
    } else if (cmd.saw !== 0) {
      return yield* NoLongerThere.make({})
    }
    if (cmd.madeOn !== life.state.matching) return yield* MatchedSince.make({ matching: life.state.matching })
    if (cmd.asItReads) return []
  } else {
    // No group covers the row, by its sender's word: what the row's own instance says already, made on the same
    // matching, is no change, whoever decided it. From a screen that has not seen what is there, that holds only
    // while no group was made since: after one, the row may read through the group again (its later decision
    // undone), and the press would put the row's own decision over the group. That one is refused and held
    // (2026-11-22: "Hold it when behind"). Whatever it decides, an act made on an older matching is refused, and
    // first, so the check is made once for the prover's paths; the same text made on a newer matching than the
    // row's is a change. `saw` is asked once in each case of the row.
    if (cmd.madeOn !== life.state.matching) {
      // The same press sent again after a match landed: the row holds this very act already (this step, from
      // this person, with this text on the matching it was made on). It is answered as the first time, with
      // nothing new, not told it was made on an older matching.
      if (
        RowState.guards.Decided(row.state) &&
        row.state.step === cmd.step &&
        row.state.by === actor.memberId &&
        RowState.onItsMatching(row.state) === RowState.onItsMatching(cmd)
      ) {
        return []
      }
      return yield* MatchedSince.make({ matching: life.state.matching })
    }
    if (RowState.guards.Decided(row.state)) {
      if (cmd.saw !== row.state.change) {
        if (
          RowState.onItsMatching(row.state) === RowState.onItsMatching(cmd) &&
          row.state.change > life.state.lastGroup
        )
          return []
        if (cmd.saw > row.state.change) {
          return yield* PutBackSince.make({ by: row.state.by, change: row.state.change })
        }
        return yield* DecidedSince.make({ by: row.state.by, change: row.state.change })
      }
      if (RowState.onItsMatching(row.state) === RowState.onItsMatching(cmd)) return []
    } else {
      if (cmd.saw !== 0) {
        if (cmd.flags === RowState.NO_DECISION && life.state.lastGroup === 0) return []
        return yield* NoLongerThere.make({})
      }
      if (cmd.flags === RowState.NO_DECISION) return []
    }
  }
  // An undo landed on the row that the sender's screen has not received. After an undo the row holds exactly what
  // it held before the decision taken back, so a press drawn before it (a late copy of the very press that was
  // taken back, too) names what the row holds and would be written again. It is refused and held.
  if (cmd.sawUndone !== row.state.undone.change) {
    return yield* UndoneSince.make({ by: row.state.undone.by, change: row.state.undone.change })
  }
  const change = life.state.changes + 1
  return [
    row.record(
      RowDecided.Event.make({
        importId: cmd.importId,
        organizationId: life.state.organizationId,
        change,
        by: actor.memberId,
        step: cmd.step,
        flags: cmd.flags,
        madeOn: cmd.madeOn,
        label: cmd.label
      })
    ),
    life.record(
      ActCounted.Event.make({
        change,
        step: cmd.step,
        row: cmd.row,
        label: cmd.label,
        holds: change,
        by: actor.memberId,
        actor: actor.memberId,
        flags: cmd.flags,
        madeOn: cmd.madeOn
      })
    )
  ]
})
