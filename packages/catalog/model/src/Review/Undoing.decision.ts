// @effect-diagnostics newSchemaClass:off
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
import * as Match from "effect/Match"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../Actor/Actor.context.ts"
import { ActCounted, ConfirmedSince, Import, isOpen, NotOpen, NotPermitted } from "../Import/Import.aggregate.ts"
import {
  CUT,
  isDecided,
  isUndecided,
  isUntouched,
  letGo,
  Level,
  MOST_BELOW,
  noLevel,
  Row,
  seal,
  sizesAreTrue,
  StepUndone
} from "../Row/Row.aggregate.ts"
import { Change, ImportKey, RowKey, Step } from "./Change.schema.ts"
import { GroupedSince } from "./Deciding.decision.ts"

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
 * import's last act on a group as the sender's screen has it; `next`, with `below` under it, goes under the decision
 * put back.
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
      opening: S.Int,
      next: Level,
      // A history is sealed only while it is at most `MOST_BELOW` long, so no true `below` is longer.
      below: S.String.check(S.isMaxLength(MOST_BELOW))
    },
    events: [StepUndone, ActCounted],
    rejects: [
      NotOpen,
      NotPermitted,
      ConfirmedSince,
      GroupedSince,
      NotYourStep,
      DecidedBeforeTheConfirm,
      HistoryEnds,
      NotWhatWasUnder
    ]
  },
  { description: "Take back the sender's own decision on one row, bringing the level it uncovers" }
) {}

type UndoingEvent = StepUndone | ActCounted
const yes = (): boolean => true
const no = (): boolean => false
const isActCounted = (event: UndoingEvent): event is ActCounted =>
  Match.value(event).pipe(Match.tag("ActCounted", yes), Match.orElse(no))

/** The undo of one act: read from the import and the row, recorded on both or on neither. */
export class Undoing extends Domain.Decision(
  UndoRowStep,
  {
    reads: { life: Import, row: Row },
    keyOf: (cmd: UndoRowStep) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
    decide: Effect.fn("Undoing.decide")(function* ({ life, row }, cmd) {
      const actor = yield* CurrentActor
      if (!isOpen(life.state)) return yield* new NotOpen({})
      if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
        return yield* new NotPermitted({})
      }
      if (
        !isUntouched(row.state) &&
        (row.state.importId !== cmd.importId || row.state.organizationId !== life.state.organizationId)
      ) {
        return yield* new NotPermitted({})
      }
      if (cmd.opening !== life.state.confirms) return yield* new ConfirmedSince({})
      if (cmd.sawGroup !== life.state.lastGroup) return yield* new GroupedSince({})
      if (!isDecided(row.state) || row.state.by !== actor.memberId || row.state.change !== cmd.undo) {
        return yield* new NotYourStep({})
      }
      // What a standing confirm wrote is taken back with the import, not here.
      if (row.state.change <= life.state.confirmedAt) return yield* new DecidedBeforeTheConfirm({})
      if (row.state.under.change === -1) return yield* new HistoryEnds({})
      // What goes under the decision put back must be what was under it, to the letter; nothing, when nothing was, and
      // a level let go when the rest was let go.
      const kept = row.state.below !== "" && row.state.below !== CUT
      if (kept && (!sizesAreTrue(cmd.next) || seal({ level: cmd.next, below: cmd.below }) !== row.state.below)) {
        return yield* new NotWhatWasUnder({})
      }
      const next = kept ? cmd.next : row.state.below === CUT ? letGo : noLevel
      const under = row.state.under
      return [
        row.record(new StepUndone({ next, below: kept ? cmd.below : "" })),
        life.record(
          new ActCounted({
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
        if (!isOpen(before.life) || !isDecided(before.row)) return false
        const actor = yield* CurrentActor
        return before.row.change === command.undo && actor.memberId === before.row.by
      }),
      AnUndoIsOfThisOpening: ({ before, command }) => isOpen(before.life) && command.opening === before.life.confirms,
      // A row's undo is made on a screen that has the import's last act on a group.
      ARowsUndoSawTheLastGroupAct: ({ before, command }) =>
        isOpen(before.life) && command.sawGroup === before.life.lastGroup,
      // It does not reach past a confirm that stands.
      AnUndoDoesNotReachPastAConfirm: ({ before }) =>
        isOpen(before.life) && isDecided(before.row) && before.row.change > before.life.confirmedAt,
      // An undo puts back exactly the decision under the one taken back, another person's included.
      AnUndoLeavesADecisionWhenOneWasUnder: ({ before, after }) =>
        !isDecided(before.row) || before.row.under.change === 0 || isDecided(after.row),
      AndNoneWhenNoneWas: ({ before, after }) =>
        !isDecided(before.row) || before.row.under.change !== 0 || isUndecided(after.row),
      AnUndoPutsBackTheDecisionThatWasThere: ({ before, after }) =>
        !isDecided(before.row) ||
        before.row.under.change === 0 ||
        !isDecided(after.row) ||
        after.row.change === before.row.under.change,
      AsTheirsWhoMadeIt: ({ before, after }) =>
        !isDecided(before.row) ||
        before.row.under.change === 0 ||
        !isDecided(after.row) ||
        after.row.by === before.row.under.by,
      WithItsTextAsItWas: ({ before, after }) =>
        !isDecided(before.row) ||
        before.row.under.change === 0 ||
        !isDecided(after.row) ||
        after.row.flags === before.row.under.flags,
      OnItsMatchingAsItWas: ({ before, after }) =>
        !isDecided(before.row) ||
        before.row.under.change === 0 ||
        !isDecided(after.row) ||
        after.row.madeOn === before.row.under.madeOn,
      UnderItsStepAsItWas: ({ before, after }) =>
        !isDecided(before.row) ||
        before.row.under.change === 0 ||
        !isDecided(after.row) ||
        after.row.step === before.row.under.step,
      // Nothing lies below a decision that had nothing more kept under it.
      NothingIsBelowWhatWasTheLastKept: ({ before, after }) =>
        !isDecided(before.row) ||
        !isDecided(after.row) ||
        (before.row.below !== "" && before.row.below !== CUT) ||
        after.row.below === "",
      // What lies under it afterwards seals to exactly the text the row held: nothing its sender wrote can stand there.
      WhatLiesUnderIsWhatWasRecorded: ({ before, after }) =>
        !isDecided(before.row) ||
        before.row.under.change === 0 ||
        !isDecided(after.row) ||
        (before.row.below === ""
          ? after.row.under.change === 0
          : before.row.below === CUT
            ? after.row.under.change === -1
            : seal({ level: after.row.under, below: after.row.below }) === before.row.below),
      // The import's event says what the row now holds, and whose it is.
      TheImportsEventSaysWhichDecisionTheRowHolds: ({ after, events }) =>
        A.every(events, (e) => !isActCounted(e) || e.holds === (isDecided(after.row) ? after.row.change : 0)),
      TheImportsEventSaysWhose: ({ after, events }) =>
        A.every(events, (e) => !isActCounted(e) || !isDecided(after.row) || e.by === after.row.by),
      TheImportsEventSaysItsText: ({ after, events }) =>
        A.every(events, (e) => !isActCounted(e) || !isDecided(after.row) || e.flags === after.row.flags),
      TheImportsEventSaysWhoActed: Effect.fn("Undoing.TheImportsEventSaysWhoActed")(function* ({ events }) {
        const actor = yield* CurrentActor
        return A.every(events, (e) => !isActCounted(e) || e.actor === actor.memberId)
      }),
      AnUndoIsNumbered: ({ before, after }) =>
        isOpen(before.life) && isOpen(after.life) && after.life.changes === before.life.changes + 1,
      // Who may change a row. The row has no command of its own, so these are rules of the decisions that record on it.
      NobodyClearsAnotherPersonsDecision: Effect.fn("Undoing.NobodyClearsAnotherPersonsDecision")(function* ({
        before,
        after
      }) {
        if (!isDecided(before.row) || isDecided(after.row)) return true
        const actor = yield* CurrentActor
        return actor.memberId === before.row.by
      }),
      OnlyItsOwnOrganizationChangesTheRow: Effect.fn("Undoing.OnlyItsOwnOrganizationChangesTheRow")(function* ({
        before
      }) {
        if (isUntouched(before.row)) return true
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
