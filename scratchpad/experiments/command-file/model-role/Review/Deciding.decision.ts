// One act of the review, decided across the import and the row it names, and recorded on both or on neither. The
// import says whether it is open, what its matching is, which act on a group was its last and what number the act
// gets; the row says what decision it holds. An act is taken only from a screen that has the import's last group act
// (2026-11-22: "Yes, refuse and show"): a group that landed since may cover the row, and the screen has not drawn it.
// An act names the decision its sender saw on the row, by the change that recorded it, and is refused over any other
// (Benjamin, 2026-11-22: "Same: hold, show both"). An act that would leave the row reading as it reads records nothing,
// and it stays whose it was (2026-11-19: "Answer says 'no change'"; 2026-11-22: "No, it stays Dana's"). On a row no
// group in force covers since its own decision, that is the row's own instance holding the act's text; on a row one
// covers, it is what the row reads as through its groups, which only the screen knows, so the sender says it
// (`asItReads`), and a group taken back then gives the row nothing (2026-11-22: "No change, Ana's undo applies").
// `covered` and `asItReads` are the sender's word: the model cannot check them, so the screen must work them out from
// what it has received, as the fold does. So a covered act that reads so is no change only once `saw` and the
// matching pass: from a screen that is behind it is refused and held, not lost. The one thing not to break: every
// check here that stands between an act and its record has its rule below, so one that is removed breaks a named rule
// under Verify. The checks that choose between "no change" and a refusal, for an act that records nothing either way
// (a press from a screen that is behind, a press sent twice), have none: a rule is checked only where something is
// recorded. Each of those is held by a story and a mutant (mutants/README.md).
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
  leavesAsItIs,
  MOST_BELOW,
  NO_DECISION,
  onItsMatching,
  Row,
  RowDecided,
  seal,
  RowState
} from "../Row/Row.aggregate.ts"
import { Change, Flags, ImportKey, RowKey, Step } from "./Change.schema.ts"

/** The row holds a decision its sender did not see: whose it is and the change that recorded it. */
export class DecidedSince extends Domain.Rejection(
  "DecidedSince",
  { by: S.String, change: Change },
  { description: "Someone decided the row since the sender last saw it: whose decision is there" }
) {}
/**
 * The decision its sender saw was taken back, and the row holds an older one again: whose it is and the change that
 * recorded it. Nobody decided the row since; the one who made the decision the sender saw took it back.
 */
export class PutBackSince extends Domain.Rejection(
  "PutBackSince",
  { by: S.String, change: Change },
  { description: "The decision the sender saw was taken back, and an older one is there again: whose" }
) {}
/** The decision its sender saw is no longer there, and the row has none. */
export class NoLongerThere extends Domain.Rejection(
  "NoLongerThere",
  {},
  { description: "The decision the sender saw on the row was taken back" }
) {}
/**
 * An undo was taken on the row that the sender's screen has not received: who took it, and the change it took back.
 * A press drawn before the undo may name exactly what the row holds again, so the number of the row's decision does
 * not tell it from a press made after: the last undo the screen has received does.
 */
export class UndoneSince extends Domain.Rejection(
  "UndoneSince",
  { by: S.String, change: Change },
  { description: "An undo landed on the row that the sender's screen had not received: whose, and of which change" }
) {}
/**
 * An act on a group of rows was recorded that the sender's screen has not received. It hands back no number: the
 * screen learns the last group act only by receiving it, so nothing it is told here lets the same act pass.
 */
export class GroupedSince extends Domain.Rejection(
  "GroupedSince",
  {},
  { description: "An act on a group of rows landed that the sender's screen had not received" }
) {}
/**
 * A later act on a group is still in force over what is being taken back. `last` is the import's last group in
 * force, the one to take back first: groups are taken back last first. For a group's undo it is the group over this
 * one. For a row's undo, whose sender says a group covers the row since its decision, it is that group or one made
 * after it: the model keeps no reading of a group's rows, so it cannot say which. In both, the later act was drawn on
 * a screen that had this one.
 */
export class GroupedAfter extends Domain.Rejection(
  "GroupedAfter",
  { last: Change },
  { description: "A later act on a group is still in force: the number of the import's last group in force" }
) {}

/** What an act is called on screen, kept with it for the history. */
export const Label = S.String.check(S.isMaxLength(200)).annotate({ description: "What an act is called on screen" })

/**
 * Decide one row. `sawGroup`: the import's last act on a group as the sender's screen has it. `covered`: a group in
 * force on this row was decided after the row's own decision, so the row is not as its own instance has it.
 * `asItReads`: on such a row, the act leaves it reading as it reads now through its groups, so it changes nothing.
 * Both are the sender's word, worked out by the screen from what it received. `opening`: how many times the import
 * had been confirmed when the act was made. `saw`: the change that recorded the decision the sender saw on the row,
 * or 0 for none. `sawUndone`: the change the row's last undo took back, as the sender's screen has it, or 0 for
 * none. `madeOn`: the import's matching the act was made on, whatever it decides.
 */
export class DecideRow extends Domain.Command(
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
    events: [RowDecided, ActCounted.Event],
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
 */
const changesNothing = (act: {
  readonly row: RowState
  readonly command: {
    readonly flags: string
    readonly madeOn: number
    readonly covered: boolean
    readonly asItReads: boolean
  }
}): boolean =>
  act.command.covered
    ? act.command.asItReads
    : leavesAsItIs({ row: act.row, flags: act.command.flags, madeOn: act.command.madeOn })

/** The act's sender has seen what the row holds: its decision, by the number of the change, or that it has none. */
const sawIt = (act: { readonly row: RowState; readonly command: { readonly saw: number } }): boolean =>
  RowState.guards.Decided(act.row) ? act.command.saw === act.row.change : act.command.saw === 0

/**
 * The row holds this very act already: this step, from this person, with this text on the matching it was made on. A
 * copy of a press that was recorded is known by it, and is answered as the first time, with nothing new.
 */
const holdsThisAct = (act: {
  readonly row: RowState
  readonly step: string
  readonly by: string
  readonly flags: string
  readonly madeOn: number
}): boolean =>
  RowState.guards.Decided(act.row) &&
  act.row.step === act.step &&
  act.row.by === act.by &&
  onItsMatching(act.row) === onItsMatching(act)

/** One act of the review: read from the import and the row, recorded on both or on neither. */
export class Deciding extends Domain.Decision(
  DecideRow,
  {
    reads: { life: Import, row: Row },
    keyOf: (cmd: DecideRow) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
    decide: Effect.fn("Deciding.decide")(function* ({ life, row }, cmd) {
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
          holdsThisAct({ row: row.state, step: cmd.step, by: actor.memberId, flags: cmd.flags, madeOn: cmd.madeOn })
        ) {
          return []
        }
        return yield* ConfirmedSince.make({})
      }
      if (cmd.sawGroup !== life.state.lastGroup) {
        if (
          holdsThisAct({ row: row.state, step: cmd.step, by: actor.memberId, flags: cmd.flags, madeOn: cmd.madeOn })
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
            onItsMatching(row.state) === onItsMatching(cmd)
          ) {
            return []
          }
          return yield* MatchedSince.make({ matching: life.state.matching })
        }
        if (RowState.guards.Decided(row.state)) {
          if (cmd.saw !== row.state.change) {
            if (onItsMatching(row.state) === onItsMatching(cmd) && row.state.change > life.state.lastGroup) return []
            if (cmd.saw > row.state.change) {
              return yield* PutBackSince.make({ by: row.state.by, change: row.state.change })
            }
            return yield* DecidedSince.make({ by: row.state.by, change: row.state.change })
          }
          if (onItsMatching(row.state) === onItsMatching(cmd)) return []
        } else {
          if (cmd.saw !== 0) {
            if (cmd.flags === NO_DECISION && life.state.lastGroup === 0) return []
            return yield* NoLongerThere.make({})
          }
          if (cmd.flags === NO_DECISION) return []
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
          RowDecided.make({
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
    }),
    transitions: {
      ARowIsDecidedOnlyOnAnOpenImport: ({ before }) => ImportState.guards.Open(before.life),
      // An act is taken only in the opening it was made in: one made before a confirm is not taken after a reopen.
      AnActIsOfThisOpening: ({ before, command }) =>
        ImportState.guards.Open(before.life) && command.opening === before.life.confirms,
      // A row's act is made on a screen that has the import's last act on a group.
      ARowsActSawTheLastGroupAct: ({ before, command }) =>
        ImportState.guards.Open(before.life) && command.sawGroup === before.life.lastGroup,
      // A decision is replaced only by an act whose sender saw it, by the number of the change that recorded it.
      ADecisionIsReplacedOnlyByAnActThatSawIt: ({ before, command }) => sawIt({ row: before.row, command }),
      // And only by one whose sender has the row's last undo: the change it took back names it.
      ADecisionIsMadeOnAScreenThatHasTheRowsLastUndo: ({ before, command }) =>
        command.sawUndone === before.row.undone.change,
      // Whatever it decides, an act is made on the import's matching now; one made on an older matching is not
      // applied.
      AnActIsMadeOnTheMatchingNow: ({ before, command }) =>
        ImportState.guards.Open(before.life) && command.madeOn === before.life.matching,
      // An act that would leave the row's decision as it is records nothing: the row and the import are unchanged.
      AnActThatChangesNothingLeavesTheImport: ({ before, after, command }) =>
        !changesNothing({ row: before.row, command }) ||
        !ImportState.guards.Open(before.life) ||
        !ImportState.guards.Open(after.life) ||
        after.life.changes === before.life.changes,
      AnActThatChangesNothingLeavesTheRow: ({ before, after, command }) =>
        !changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(before.row) ||
        !RowState.guards.Decided(after.row) ||
        after.row.change === before.row.change,
      // Any other act is recorded as its sender said, and gets the import's next number on the row and on the import.
      AnyOtherActIsRecorded: ({ before, after, command }) =>
        changesNothing({ row: before.row, command }) || RowState.guards.Decided(after.row),
      WithItsText: ({ before, after, command }) =>
        changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(after.row) ||
        after.row.flags === command.flags,
      OnItsMatching: ({ before, after, command }) =>
        changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(after.row) ||
        after.row.madeOn === command.madeOn,
      UnderItsStep: ({ before, after, command }) =>
        changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(after.row) ||
        after.row.step === command.step,
      AsItsSenders: Effect.fn("Deciding.AsItsSenders")(function* ({ before, after, command }) {
        if (changesNothing({ row: before.row, command }) || !RowState.guards.Decided(after.row)) return true
        const actor = yield* CurrentActor
        return after.row.by === actor.memberId
      }),
      AndGetsTheNextNumber: ({ before, after, command }) =>
        changesNothing({ row: before.row, command }) ||
        !ImportState.guards.Open(before.life) ||
        !ImportState.guards.Open(after.life) ||
        after.life.changes === before.life.changes + 1,
      OnTheRowToo: ({ before, after, command }) =>
        changesNothing({ row: before.row, command }) ||
        !ImportState.guards.Open(after.life) ||
        !RowState.guards.Decided(after.row) ||
        after.row.change === after.life.changes,
      // The import's event says what the row now holds, and whose it is.
      TheImportsEventSaysWhichDecisionTheRowHolds: ({ after, events }) =>
        A.every(
          events,
          (e) =>
            !ImportEvent.guards.ActCounted(e) || !RowState.guards.Decided(after.row) || e.holds === after.row.change
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
      // And who acted.
      TheImportsEventSaysWhoActed: Effect.fn("Deciding.TheImportsEventSaysWhoActed")(function* ({ events }) {
        const actor = yield* CurrentActor
        return A.every(events, (e) => !ImportEvent.guards.ActCounted(e) || e.actor === actor.memberId)
      }),
      // The decision an act replaces is kept under it.
      AnActKeepsWhichDecisionItReplaces: ({ before, after, command }) =>
        !RowState.guards.Decided(before.row) ||
        changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(after.row) ||
        after.row.under.change === before.row.change,
      AndWhose: ({ before, after, command }) =>
        !RowState.guards.Decided(before.row) ||
        changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(after.row) ||
        after.row.under.by === before.row.by,
      AndItsText: ({ before, after, command }) =>
        !RowState.guards.Decided(before.row) ||
        changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(after.row) ||
        after.row.under.flags === before.row.flags,
      AndItsMatching: ({ before, after, command }) =>
        !RowState.guards.Decided(before.row) ||
        changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(after.row) ||
        after.row.under.madeOn === before.row.madeOn,
      // What was below that stays below it, sealed, unless the history is let go.
      AndWhatWasBelowStaysBelow: ({ before, after, command }) =>
        !RowState.guards.Decided(before.row) ||
        changesNothing({ row: before.row, command }) ||
        !RowState.guards.Decided(after.row) ||
        after.row.below ===
          (before.row.under.change === 0
            ? ""
            : before.row.below.length > MOST_BELOW
              ? CUT
              : seal({ level: before.row.under, below: before.row.below })),
      // Who may change a row. The row has no command of its own, so these are rules of the decisions that record on it.
      // "Nobody clears another person's decision" is the undo's rule and not stated here: an act always leaves a
      // decision on the row, so it could not fail in this decision. Who may replace one is the rule above: whoever
      // saw it.
      OnlyItsOwnOrganizationChangesTheRow: Effect.fn("Deciding.OnlyItsOwnOrganizationChangesTheRow")(function* ({
        before
      }) {
        if (RowState.guards.Untouched(before.row)) return true
        const actor = yield* CurrentActor
        return actor.organizationId === before.row.organizationId
      }),
      AViewerChangesNoRow: Effect.fn("Deciding.AViewerChangesNoRow")(function* () {
        const actor = yield* CurrentActor
        return actor.role !== "viewer"
      })
    }
  },
  { description: "One act of the review, recorded on the import and on the row, or on neither" }
) {}
