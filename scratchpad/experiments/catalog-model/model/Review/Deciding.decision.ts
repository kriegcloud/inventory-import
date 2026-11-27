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
import { Row } from "../Row/Row.aggregate.ts"
import { Import } from "../Import/Import.aggregate.ts"
import * as DecideRow from "./DecideRow.command.ts"
import {
  ADecisionIsMadeOnAScreenThatHasTheRowsLastUndo,
  ADecisionIsReplacedOnlyByAnActThatSawIt,
  AnActIsMadeOnTheMatchingNow,
  AnActIsOfThisOpening,
  AnActKeepsWhichDecisionItReplaces,
  AnActThatChangesNothingLeavesTheImport,
  AnActThatChangesNothingLeavesTheRow,
  AndGetsTheNextNumber,
  AndItsMatching,
  AndItsText,
  AndWhatWasBelowStaysBelow,
  AndWhose,
  AnyOtherActIsRecorded,
  ARowIsDecidedOnlyOnAnOpenImport,
  ARowsActSawTheLastGroupAct,
  AsItsSenders,
  AViewerChangesNoRow,
  OnItsMatching,
  OnlyItsOwnOrganizationChangesTheRow,
  OnTheRowToo,
  TheImportsEventSaysItsText,
  TheImportsEventSaysWhichDecisionTheRowHolds,
  TheImportsEventSaysWhoActed,
  TheImportsEventSaysWhose,
  UnderItsStep,
  WithItsText
} from "./Deciding.transition.ts"

/**
 * **Details**
 *
 * It reads the import and the row the command names. The row's instance is keyed by the import's id and the row's, as
 * `<importId>/<row>`.
 *
 * @category decisions
 * @since 0.0.0
 */
export class Deciding extends Domain.Decision(
  DecideRow.Command,
  {
    reads: { life: Import, row: Row },
    keyOf: (cmd: DecideRow.Command) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
    decide: DecideRow.decide,
    transitions: {
      ARowIsDecidedOnlyOnAnOpenImport,
      AnActIsOfThisOpening,
      ARowsActSawTheLastGroupAct,
      ADecisionIsReplacedOnlyByAnActThatSawIt,
      ADecisionIsMadeOnAScreenThatHasTheRowsLastUndo,
      AnActIsMadeOnTheMatchingNow,
      AnActThatChangesNothingLeavesTheImport,
      AnActThatChangesNothingLeavesTheRow,
      AnyOtherActIsRecorded,
      WithItsText,
      OnItsMatching,
      UnderItsStep,
      AsItsSenders,
      AndGetsTheNextNumber,
      OnTheRowToo,
      TheImportsEventSaysWhichDecisionTheRowHolds,
      TheImportsEventSaysWhose,
      TheImportsEventSaysItsText,
      TheImportsEventSaysWhoActed,
      AnActKeepsWhichDecisionItReplaces,
      AndWhose,
      AndItsText,
      AndItsMatching,
      AndWhatWasBelowStaysBelow,
      OnlyItsOwnOrganizationChangesTheRow,
      AViewerChangesNoRow
    }
  },
  { description: "One act of the review, recorded on the import and on the row, or on neither" }
) {}
