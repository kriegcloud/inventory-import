// The undo of one act, decided across the import and the row. It takes back only its sender's own decision while that
// is what the row holds, puts back exactly the decision that was under it, whose it was, and leaves under that exactly
// what was recorded: the level it brings is taken only when it seals to the text the row holds, so nothing its sender
// wrote can stand there (Benjamin, 2026-11-22: "Every step, sealed history"; "Yes, exactly what was under"). It does
// not reach past a confirm that stands ("No, refused for both"), nor into another opening of the import ("No, name it
// and drop it"), and it is taken only from a screen that has the import's last act on a group ("Yes, refuse and
// show"): a group that landed since may cover the row. The one thing not to break: every check in
// `UndoRowStep.decide` (`UndoRowStep.command.ts`) that refuses an undo has its rule in `Undoing.transition.ts`.
import * as Domain from "@alchemy.run/domain"
import { Row } from "../Row/Row.aggregate.ts"
import { Import } from "../Import/Import.aggregate.ts"
import * as UndoRowStep from "./UndoRowStep.command.ts"
import {
  AndNoneWhenNoneWas,
  AndTheStepItWasPressedIn,
  AndWhoPressed,
  AnUndoDoesNotReachPastAConfirm,
  AnUndoIsMadeOnAScreenThatHasTheRowsLastUndo,
  AnUndoIsMadeOnTheMatchingNow,
  AnUndoIsNumbered,
  AnUndoIsOfARowOfTheImportItNames,
  AnUndoIsOfThisOpening,
  AnUndoLeavesADecisionWhenOneWasUnder,
  AnUndoPutsBackTheDecisionThatWasThere,
  AnUndoStopsWhereTheHistoryWasLetGo,
  AnUndoTakesBackOnlyItsSendersOwnStep,
  ARowsUndoSawTheLastGroupAct,
  ARowsUndoSaysNoLaterGroupCoversIt,
  AsTheirsWhoMadeIt,
  AViewerChangesNoRow,
  NobodyClearsAnotherPersonsDecision,
  NothingIsBelowWhatWasTheLastKept,
  OnItsMatchingAsItWas,
  OnlyItsOwnOrganizationChangesTheRow,
  TheImportsEventSaysItsText,
  TheImportsEventSaysWhichDecisionTheRowHolds,
  TheImportsEventSaysWhoActed,
  TheImportsEventSaysWhose,
  TheRowKeepsWhichChangeWasTakenBack,
  UnderItsStepAsItWas,
  WhatLiesUnderIsWhatWasRecorded,
  WithItsTextAsItWas
} from "./Undoing.transition.ts"

/**
 * **Details**
 *
 * It reads the import and the row the command names. The row's instance is keyed by the import's id and the row's, as
 * `<importId>/<row>`.
 *
 * @category decisions
 * @since 0.0.0
 */
export class Undoing extends Domain.Decision(
  UndoRowStep.Command,
  {
    reads: { life: Import, row: Row },
    keyOf: (cmd: UndoRowStep.Command) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
    decide: UndoRowStep.decide,
    transitions: {
      AnUndoTakesBackOnlyItsSendersOwnStep,
      AnUndoIsOfThisOpening,
      ARowsUndoSawTheLastGroupAct,
      AnUndoIsMadeOnAScreenThatHasTheRowsLastUndo,
      AnUndoIsMadeOnTheMatchingNow,
      ARowsUndoSaysNoLaterGroupCoversIt,
      TheRowKeepsWhichChangeWasTakenBack,
      AndTheStepItWasPressedIn,
      AndWhoPressed,
      AnUndoIsOfARowOfTheImportItNames,
      AnUndoStopsWhereTheHistoryWasLetGo,
      AnUndoDoesNotReachPastAConfirm,
      AnUndoLeavesADecisionWhenOneWasUnder,
      AndNoneWhenNoneWas,
      AnUndoPutsBackTheDecisionThatWasThere,
      AsTheirsWhoMadeIt,
      WithItsTextAsItWas,
      OnItsMatchingAsItWas,
      UnderItsStepAsItWas,
      NothingIsBelowWhatWasTheLastKept,
      WhatLiesUnderIsWhatWasRecorded,
      TheImportsEventSaysWhichDecisionTheRowHolds,
      TheImportsEventSaysWhose,
      TheImportsEventSaysItsText,
      TheImportsEventSaysWhoActed,
      AnUndoIsNumbered,
      NobodyClearsAnotherPersonsDecision,
      OnlyItsOwnOrganizationChangesTheRow,
      AViewerChangesNoRow
    }
  },
  { description: "The undo of one act, recorded on the import and on the row, or on neither" }
) {}
