// The undo of one act, decided across the import and the row. It takes back only its sender's own decision while that
// is what the row holds, puts back exactly the decision that was under it, whose it was, and leaves under that exactly
// what was recorded: the level it brings is taken only when it seals to the text the row holds, so nothing its sender
// wrote can stand there (Benjamin, 2026-11-22: "Every step, sealed history"; "Yes, exactly what was under"). It does
// not reach past a confirm that stands ("No, refused for both"), nor into another opening of the import ("No, name it
// and drop it"), and it is taken only from a screen that has the import's last act on a group ("Yes, refuse and
// show"): a group that landed since may cover the row. The one thing not to break: every check here
// that refuses an undo has its rule below.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import * as ActCounted from "../Import/ActCounted.event.ts"
import { ConfirmedSince, MatchedSince, NotOpen, NotPermitted } from "../Import/Import.rejection.ts"
import { Import, ImportEvent } from "../Import/Import.aggregate.ts"
import { ImportState } from "../Import/Import.state.ts"
import {
  CUT,
  letGo,
  Level,
  MOST_BELOW,
  noLevel,
  Row,
  seal,
  sizesAreTrue,
  StepUndone,
  RowState
} from "../Row/Row.aggregate.ts"
import { Change, ImportKey, RowKey, Step } from "./Change.schema.ts"
import { GroupedAfter, GroupedSince, UndoneSince } from "./Deciding.decision.ts"

/** The row does not hold the change named as its sender's own decision. */
export class NotYourStep extends Domain.Rejection(
  "NotYourStep",
  {},
  { description: "The row does not hold that change as the sender's own decision" }
) {}
/** A confirm that stands was made after it: the row is decided again, the item edited, or the import taken back. */
export class DecidedBeforeTheConfirm extends Domain.Rejection(
  "DecidedBeforeTheConfirm",
  {},
  { description: "The decision was made before a confirm that stands, so it is not undone here" }
) {}
/** What was brought to go under the decision put back is not what was under it. */
export class NotWhatWasUnder extends Domain.Rejection(
  "NotWhatWasUnder",
  {},
  { description: "The level brought to go under the decision put back is not the one recorded" }
) {}
/** The decisions below it are no longer kept. */
export class HistoryEnds extends Domain.Rejection(
  "HistoryEnds",
  {},
  { description: "The decisions below this one are no longer kept" }
) {}

/**
 * Take back one change on one row. `undo` is the change taken back; `step` is this act's own; `sawGroup` is the
 * import's last act on a group as the sender's screen has it; `covered` says a group in force, decided after the
 * decision taken back, covers the row (the sender's word, from a screen that has every group act: `sawGroup`);
 * `madeOn` is the import's matching the undo was pressed on; `sawUndone` is the change the row's last undo took back,
 * as the sender's screen has it, or 0 for none; `next`, with `below` under it, goes under the decision put back.
 */
export class UndoRowStep extends Domain.Command(
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
      // A history is sealed only while it is at most `MOST_BELOW` long, so no true `below` is longer.
      below: S.String.check(S.isMaxLength(MOST_BELOW))
    },
    events: [StepUndone, ActCounted.Event],
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

/** The row's last undo is this one: the same change taken back, in the same step, by the same person. */
const tookThisUndo = (act: {
  readonly row: RowState
  readonly undo: number
  readonly step: string
  readonly by: string
}): boolean => act.row.undone.change === act.undo && act.row.undone.step === act.step && act.row.undone.by === act.by

/** The undo of one act: read from the import and the row, recorded on both or on neither. */
export class Undoing extends Domain.Decision(
  UndoRowStep,
  {
    reads: { life: Import, row: Row },
    keyOf: (cmd: UndoRowStep) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
    decide: Effect.fn("Undoing.decide")(function* ({ life, row }, cmd) {
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
      // comparisons multiply every way through this `decide` for the prover (814 paths then, where this form had 362; 364 now).
      // The row keeps its last undo only: a copy that arrives after another undo on the same row is not known, and
      // is refused as not its sender's step.
      if (cmd.opening !== life.state.confirms) {
        if (tookThisUndo({ row: row.state, undo: cmd.undo, step: cmd.step, by: actor.memberId })) return []
        return yield* ConfirmedSince.make({})
      }
      if (cmd.sawGroup !== life.state.lastGroup) {
        if (tookThisUndo({ row: row.state, undo: cmd.undo, step: cmd.step, by: actor.memberId })) return []
        return yield* GroupedSince.make({})
      }
      if (!RowState.guards.Decided(row.state) || row.state.by !== actor.memberId || row.state.change !== cmd.undo) {
        if (tookThisUndo({ row: row.state, undo: cmd.undo, step: cmd.step, by: actor.memberId })) return []
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
          StepUndone.make({ next, below: kept ? cmd.below : "", undo: cmd.undo, step: cmd.step, by: actor.memberId })
        ),
        life.record(
          ActCounted.Event.make({
            change: life.state.changes + 1,
            step: cmd.step,
            row: cmd.row,
            label: "undo",
            holds: under.change,
            by: under.by,
            actor: actor.memberId,
            flags: under.flags,
            madeOn: under.madeOn
          })
        )
      ]
    }),
    transitions: {
      // An undo is taken only on an open import, for its sender's own change, while it is the row's decision.
      AnUndoTakesBackOnlyItsSendersOwnStep: Effect.fn("Undoing.AnUndoTakesBackOnlyItsSendersOwnStep")(function* ({
        before,
        command
      }) {
        if (!ImportState.guards.Open(before.life) || !RowState.guards.Decided(before.row)) return false
        const actor = yield* CurrentActor
        return before.row.change === command.undo && actor.memberId === before.row.by
      }),
      AnUndoIsOfThisOpening: ({ before, command }) =>
        ImportState.guards.Open(before.life) && command.opening === before.life.confirms,
      // A row's undo is made on a screen that has the import's last act on a group.
      ARowsUndoSawTheLastGroupAct: ({ before, command }) =>
        ImportState.guards.Open(before.life) && command.sawGroup === before.life.lastGroup,
      // And on one that has the row's last undo: the change it took back names it.
      AnUndoIsMadeOnAScreenThatHasTheRowsLastUndo: ({ before, command }) =>
        command.sawUndone === before.row.undone.change,
      // And on the import's matching now.
      AnUndoIsMadeOnTheMatchingNow: ({ before, command }) =>
        ImportState.guards.Open(before.life) && command.madeOn === before.life.matching,
      // A decision a later group in force covers is not taken back from under it. Whether one covers the row is its
      // sender's word, from a screen that has every group act: the model keeps no reading of a group's rows, so this
      // rule says only that an undo taken is one whose sender said none does.
      ARowsUndoSaysNoLaterGroupCoversIt: ({ command }) => !command.covered,
      // The row keeps which undo it took: the change taken back, the step it was pressed in, and who pressed. The
      // same undo sent again is known by these three, so each is what the act itself said.
      TheRowKeepsWhichChangeWasTakenBack: ({ after, command }) =>
        !RowState.guards.Untouched(after.row) && after.row.undone.change === command.undo,
      AndTheStepItWasPressedIn: ({ after, command }) =>
        !RowState.guards.Untouched(after.row) && after.row.undone.step === command.step,
      AndWhoPressed: Effect.fn("Undoing.AndWhoPressed")(function* ({ after }) {
        if (RowState.guards.Untouched(after.row)) return false
        const actor = yield* CurrentActor
        return after.row.undone.by === actor.memberId
      }),
      // It is an undo of a row of the import it names: the row's key is built from the import's id and the row's, and
      // two pairs can build the same key.
      AnUndoIsOfARowOfTheImportItNames: ({ before, command }) =>
        RowState.guards.Untouched(before.row) || before.row.importId === command.importId,
      // It stops where the history was let go: a level that was let go is no decision to put back.
      AnUndoStopsWhereTheHistoryWasLetGo: ({ before }) =>
        !RowState.guards.Decided(before.row) || before.row.under.change !== -1,
      // It does not reach past a confirm that stands.
      AnUndoDoesNotReachPastAConfirm: ({ before }) =>
        ImportState.guards.Open(before.life) &&
        RowState.guards.Decided(before.row) &&
        before.row.change > before.life.confirmedAt,
      // An undo puts back exactly the decision under the one taken back, another person's included.
      AnUndoLeavesADecisionWhenOneWasUnder: ({ before, after }) =>
        !RowState.guards.Decided(before.row) || before.row.under.change === 0 || RowState.guards.Decided(after.row),
      AndNoneWhenNoneWas: ({ before, after }) =>
        !RowState.guards.Decided(before.row) || before.row.under.change !== 0 || RowState.guards.Undecided(after.row),
      AnUndoPutsBackTheDecisionThatWasThere: ({ before, after }) =>
        !RowState.guards.Decided(before.row) ||
        before.row.under.change === 0 ||
        !RowState.guards.Decided(after.row) ||
        after.row.change === before.row.under.change,
      AsTheirsWhoMadeIt: ({ before, after }) =>
        !RowState.guards.Decided(before.row) ||
        before.row.under.change === 0 ||
        !RowState.guards.Decided(after.row) ||
        after.row.by === before.row.under.by,
      WithItsTextAsItWas: ({ before, after }) =>
        !RowState.guards.Decided(before.row) ||
        before.row.under.change === 0 ||
        !RowState.guards.Decided(after.row) ||
        after.row.flags === before.row.under.flags,
      OnItsMatchingAsItWas: ({ before, after }) =>
        !RowState.guards.Decided(before.row) ||
        before.row.under.change === 0 ||
        !RowState.guards.Decided(after.row) ||
        after.row.madeOn === before.row.under.madeOn,
      UnderItsStepAsItWas: ({ before, after }) =>
        !RowState.guards.Decided(before.row) ||
        before.row.under.change === 0 ||
        !RowState.guards.Decided(after.row) ||
        after.row.step === before.row.under.step,
      // Nothing lies below a decision that had nothing more kept under it.
      NothingIsBelowWhatWasTheLastKept: ({ before, after }) =>
        !RowState.guards.Decided(before.row) ||
        !RowState.guards.Decided(after.row) ||
        (before.row.below !== "" && before.row.below !== CUT) ||
        after.row.below === "",
      // What lies under it afterwards seals to exactly the text the row held: nothing its sender wrote can stand there.
      WhatLiesUnderIsWhatWasRecorded: ({ before, after }) =>
        !RowState.guards.Decided(before.row) ||
        before.row.under.change === 0 ||
        !RowState.guards.Decided(after.row) ||
        (before.row.below === ""
          ? after.row.under.change === 0
          : before.row.below === CUT
            ? after.row.under.change === -1
            : seal({ level: after.row.under, below: after.row.below }) === before.row.below),
      // The import's event says what the row now holds, and whose it is.
      TheImportsEventSaysWhichDecisionTheRowHolds: ({ after, events }) =>
        A.every(
          events,
          (e) =>
            !ImportEvent.guards.ActCounted(e) || e.holds === (RowState.guards.Decided(after.row) ? after.row.change : 0)
        ),
      TheImportsEventSaysWhose: ({ after, events }) =>
        A.every(
          events,
          (e) => !ImportEvent.guards.ActCounted(e) || !RowState.guards.Decided(after.row) || e.by === after.row.by
        ),
      TheImportsEventSaysItsText: ({ after, events }) =>
        A.every(
          events,
          (e) => !ImportEvent.guards.ActCounted(e) || !RowState.guards.Decided(after.row) || e.flags === after.row.flags
        ),
      TheImportsEventSaysWhoActed: Effect.fn("Undoing.TheImportsEventSaysWhoActed")(function* ({ events }) {
        const actor = yield* CurrentActor
        return A.every(events, (e) => !ImportEvent.guards.ActCounted(e) || e.actor === actor.memberId)
      }),
      AnUndoIsNumbered: ({ before, after }) =>
        ImportState.guards.Open(before.life) &&
        ImportState.guards.Open(after.life) &&
        after.life.changes === before.life.changes + 1,
      // Who may change a row. The row has no command of its own, so these are rules of the decisions that record on it.
      NobodyClearsAnotherPersonsDecision: Effect.fn("Undoing.NobodyClearsAnotherPersonsDecision")(function* ({
        before,
        after
      }) {
        if (!RowState.guards.Decided(before.row) || RowState.guards.Decided(after.row)) return true
        const actor = yield* CurrentActor
        return actor.memberId === before.row.by
      }),
      OnlyItsOwnOrganizationChangesTheRow: Effect.fn("Undoing.OnlyItsOwnOrganizationChangesTheRow")(function* ({
        before
      }) {
        if (RowState.guards.Untouched(before.row)) return true
        const actor = yield* CurrentActor
        return actor.organizationId === before.row.organizationId
      }),
      AViewerChangesNoRow: Effect.fn("Undoing.AViewerChangesNoRow")(function* () {
        const actor = yield* CurrentActor
        return actor.role !== "viewer"
      })
    }
  },
  { description: "The undo of one act, recorded on the import and on the row, or on neither" }
) {}
