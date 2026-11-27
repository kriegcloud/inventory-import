// One import's lifecycle as its own instance, with no list in its state: staged, matched, confirmed, taken back,
// opened again, removed. It numbers every change. A confirm, a take-back, a reopen and a remove each name the last
// change their sender's screen has received, with none before it missing, and are refused on any other (Benjamin,
// 2026-11-19: "nothing is confirmed that was not on screen"; 2026-11-22: "Refuse, show, confirm again", "Yes, refuse
// and show"). An act on a group of rows is one change (2026-11-22: "One unit per group"), recorded with the group's own
// instance; the import holds its number as the last group act, and the number of the last group still in force, the
// only one that may be taken back ("Only the last group act"). Rows and groups are not here: each decided row is its
// own instance (`Row`), each group act its own (`Group`), and the four decisions record an act on the import and on
// one of them, or on neither. The one thing not to break: a rule is one comparison. The prover takes both sides of
// every `&&`, `||` and `?:` it cannot settle, in the code and in every rule a decision reads, and past 4,096 paths it
// proves nothing.
//
// Verify reads this file's code, not only its types. A case is told by its schema's own guard (`ImportState.guards`,
// `ImportCommand.guards`, `ImportEvent.guards`, `isAnyOf`), which the prover reads through the repository's patch to it
// (docs/patches.md): the unions are exported, because the prover takes a schema from what the file exports. It reads a
// state built by its case's own `make` with the status written out, so every `make` of a state names its status, and
// an event or a rejection built with `make` as the instance it builds, through the same patch: no file here turns a
// diagnostic off.
import * as Domain from "@alchemy.run/domain"
import { ImportKey } from "../Review/Change.schema.ts"
import { ActCounted, evolveActCounted } from "./ActCounted.event.ts"
import { ConfirmImport, decideConfirmImport, evolveImportConfirmed } from "./ConfirmImport.command.ts"
import { evolveGroupCounted, GroupCounted } from "./GroupCounted.event.ts"
import { AConfirmLeavesAClosedImportsStatusAsItWas, AConfirmNamesEveryChange, AMatchHoldsTheColumnsItSays, AMatchIsMadeOnTheLastOne, AMatchIsOfThisOpening, AMatchIsTheNextOne, AndOfEverythingReplaced, AnImportIsOpenedAgainOnlyByReopen, AnImportNeverChangesOrganization, APlanDoesWhatWasShown, APlanIsOfEveryChange, ARemovedImportStaysRemoved, ASuggestionWritesNothing, ATakeBackIsOfEverythingInForce, AViewerChangesNothing, EveryChangeHasItsOwnNumber, EveryEventSaysWhose, NothingIsWrittenBeforeConfirm, OnlyAnImportWithAConfirmStandingIsTakenBack, OnlyAnImportWithNothingInForceIsRemoved, OnlyItsOwnOrganizationChangesAnImport, TheMatchingMovesOnlyOnAnOpenImport, TheRestNameEveryChangeToo } from "./Import.rules.ts"
import { ImportState, NoMoreInForceThanRows, NothingStandsThatWasTakenBack, OutcomesAddUpToTheRows, WhatIsInForceThenIsWhatWasKept } from "./Import.state.ts"
import { decideMatchColumn, evolveColumnMatched, MatchColumn } from "./MatchColumn.command.ts"
import { decideRecordSuggestion, evolveSuggestionRecorded, RecordSuggestion } from "./RecordSuggestion.command.ts"
import { decideRemoveImport, evolveImportRemoved, RemoveImport } from "./RemoveImport.command.ts"
import { decideReopenImport, evolveImportReopened, ReopenImport } from "./ReopenImport.command.ts"
import { decideStageImport, evolveImportStaged, StageImport } from "./StageImport.command.ts"
import { decideTakeBackImport, evolveImportTakenBack, TakeBackImport } from "./TakeBackImport.command.ts"

/**
 * One import's lifecycle: staged, matched, confirmed, taken back, opened again, removed, with the number of its last
 * change. Every act of the review goes through it, so it can order a confirm among them.
 */
export class Import extends Domain.Aggregate(
  "Import",
  {
    id: ImportKey,
    state: ImportState,
    initial: ImportState.cases.Unstaged.make({ status: "Unstaged" }),
    invariants: {
      OutcomesAddUpToTheRows,
      NoMoreInForceThanRows,
      NothingStandsThatWasTakenBack,
      WhatIsInForceThenIsWhatWasKept
    },
    transitions: {
      NothingIsWrittenBeforeConfirm,
      AConfirmLeavesAClosedImportsStatusAsItWas,
      AConfirmNamesEveryChange,
      APlanIsOfEveryChange,
      APlanDoesWhatWasShown,
      TheRestNameEveryChangeToo,
      EveryChangeHasItsOwnNumber,
      OnlyAnImportWithAConfirmStandingIsTakenBack,
      ATakeBackIsOfEverythingInForce,
      AndOfEverythingReplaced,
      EveryEventSaysWhose,
      AMatchIsOfThisOpening,
      ASuggestionWritesNothing,
      AMatchIsMadeOnTheLastOne,
      AMatchHoldsTheColumnsItSays,
      AMatchIsTheNextOne,
      TheMatchingMovesOnlyOnAnOpenImport,
      AnImportIsOpenedAgainOnlyByReopen,
      ARemovedImportStaysRemoved,
      OnlyAnImportWithNothingInForceIsRemoved,
      AnImportNeverChangesOrganization,
      OnlyItsOwnOrganizationChangesAnImport,
      AViewerChangesNothing
    },
    commands: [StageImport, MatchColumn, RecordSuggestion, ConfirmImport, TakeBackImport, ReopenImport, RemoveImport],
    events: [ActCounted, GroupCounted],
    keyOf: (cmd) => cmd.importId,
    decide: {
      StageImport: decideStageImport,
      MatchColumn: decideMatchColumn,
      RecordSuggestion: decideRecordSuggestion,
      ConfirmImport: decideConfirmImport,
      TakeBackImport: decideTakeBackImport,
      ReopenImport: decideReopenImport,
      RemoveImport: decideRemoveImport
    },
    evolve: {
      ImportStaged: evolveImportStaged,
      ColumnMatched: evolveColumnMatched,
      ActCounted: evolveActCounted,
      GroupCounted: evolveGroupCounted,
      SuggestionRecorded: evolveSuggestionRecorded,
      ImportConfirmed: evolveImportConfirmed,
      ImportTakenBack: evolveImportTakenBack,
      ImportReopened: evolveImportReopened,
      ImportRemoved: evolveImportRemoved
    }
  },
  { description: "One import's lifecycle, which numbers every change of its review" }
) {}
