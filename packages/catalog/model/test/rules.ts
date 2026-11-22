// Every rule of the review's model by name, in the order its report gives them. The Prove and Verify tests compare a
// report with these lists, so a rule that is added, renamed, dropped or no longer proved fails its test by name.
// 135 rules are proved for every state and every input; 7 more, over every instance at once, are only searched; and
// 11 say only that some sequence of commands gets somewhere.

/** The import's own rules: 14 invariants, then 23 transitions. */
export const importRules = [
  "OutcomesAddUpToTheRows",
  "RowsAreNotNegative",
  "InForceIsNotNegative",
  "ReplacedIsNotNegative",
  "StandingIsNotNegative",
  "CreatedIsNotNegative",
  "UpdatedIsNotNegative",
  "AlreadyIsNotNegative",
  "NotImportedIsNotNegative",
  "RemovedIsNotNegative",
  "KeptIsNotNegative",
  "NoMoreInForceThanRows",
  "NothingStandsThatWasTakenBack",
  "WhatIsInForceThenIsWhatWasKept",
  "NothingIsWrittenBeforeConfirm",
  "AConfirmOfAClosedImportWritesNothing",
  "AConfirmNamesEveryChange",
  "APlanIsOfEveryChange",
  "APlanDoesWhatWasShown",
  "TheRestNameEveryChangeToo",
  "EveryChangeHasItsOwnNumber",
  "OnlyAnImportWithAConfirmStandingIsTakenBack",
  "ATakeBackIsOfEverythingInForce",
  "AndOfEverythingReplaced",
  "EveryEventSaysWhose",
  "AMatchIsOfThisOpening",
  "ASuggestionWritesNothing",
  "AMatchIsMadeOnTheLastOne",
  "AMatchHoldsTheColumnsItSays",
  "AMatchIsTheNextOne",
  "OnlyAnOpenImportIsReviewed",
  "AnImportIsOpenedAgainOnlyByReopen",
  "ARemovedImportStaysRemoved",
  "OnlyAnImportWithNothingInForceIsRemoved",
  "AnImportNeverChangesOrganization",
  "OnlyItsOwnOrganizationChangesAnImport",
  "AViewerChangesNothing"
] as const

/** The row's own rules: 4 invariants, then 2 transitions. */
export const rowRules = [
  "TheSizeOfByIsTrue",
  "TheSizeOfStepIsTrue",
  "TheSizeOfFlagsIsTrue",
  "TheSizeOfLabelIsTrue",
  "ARowIsUndecidedOnlyWhenNothingWasUnder",
  "ARowNeverChangesImportOrOrganization"
] as const

/** The rules of one act on a group: 1 invariant, then 8 transitions. */
export const groupRules = [
  "AGroupHasRows",
  "AGroupKeepsItsRows",
  "AGroupKeepsItsPatch",
  "AGroupKeepsItsNumber",
  "AGroupKeepsWhatWasUnderIt",
  "AGroupKeepsItsMaker",
  "ADecidedGroupStaysDecided",
  "AGroupTakenBackStaysTakenBack",
  "AGroupNeverChangesImportOrOrganization"
] as const

/** The rules of `Deciding`, the decision behind `DecideRow`. */
export const decidingRules = [
  "ARowIsDecidedOnlyOnAnOpenImport",
  "AnActIsOfThisOpening",
  "ARowsActSawTheLastGroupAct",
  "ADecisionIsReplacedOnlyByAnActThatSawIt",
  "AnActIsMadeOnTheMatchingNow",
  "AnActThatChangesNothingLeavesTheImport",
  "AnActThatChangesNothingLeavesTheRow",
  "AnyOtherActIsRecorded",
  "WithItsText",
  "OnItsMatching",
  "UnderItsStep",
  "AsItsSenders",
  "AndGetsTheNextNumber",
  "OnTheRowToo",
  "TheImportsEventSaysWhichDecisionTheRowHolds",
  "TheImportsEventSaysWhose",
  "TheImportsEventSaysItsText",
  "TheImportsEventSaysWhoActed",
  "AnActKeepsWhichDecisionItReplaces",
  "AndWhose",
  "AndItsText",
  "AndItsMatching",
  "AndWhatWasBelowStaysBelow",
  "NobodyClearsAnotherPersonsDecision",
  "OnlyItsOwnOrganizationChangesTheRow",
  "AViewerChangesNoRow"
] as const

/** The rules of `Undoing`, the decision behind `UndoRowStep`. */
export const undoingRules = [
  "AnUndoTakesBackOnlyItsSendersOwnStep",
  "AnUndoIsOfThisOpening",
  "ARowsUndoSawTheLastGroupAct",
  "AnUndoDoesNotReachPastAConfirm",
  "AnUndoLeavesADecisionWhenOneWasUnder",
  "AndNoneWhenNoneWas",
  "AnUndoPutsBackTheDecisionThatWasThere",
  "AsTheirsWhoMadeIt",
  "WithItsTextAsItWas",
  "OnItsMatchingAsItWas",
  "UnderItsStepAsItWas",
  "NothingIsBelowWhatWasTheLastKept",
  "WhatLiesUnderIsWhatWasRecorded",
  "TheImportsEventSaysWhichDecisionTheRowHolds",
  "TheImportsEventSaysWhose",
  "TheImportsEventSaysItsText",
  "TheImportsEventSaysWhoActed",
  "AnUndoIsNumbered",
  "NobodyClearsAnotherPersonsDecision",
  "OnlyItsOwnOrganizationChangesTheRow",
  "AViewerChangesNoRow"
] as const

/** The rules of `DecidingGroup`, the decision behind `DecideGroup`. */
export const decidingGroupRules = [
  "AGroupIsDecidedOnlyOnAnOpenImport",
  "AGroupIsOfThisOpening",
  "AGroupIsMadeOnEveryChange",
  "AGroupIsMadeOnTheMatchingNow",
  "AStepDecidesOneGroup",
  "AGroupIsRecorded",
  "WithEveryRowItNames",
  "WithWhatItDoes",
  "WithItsCount",
  "OnItsMatching",
  "InForce",
  "AsItsSenders",
  "AGroupIsOneChange",
  "OnTheGroupToo",
  "TheImportHoldsItAsItsLastGroupAct",
  "AGroupDecidedIsTheLastInForce",
  "AndKeepsWhichOneWasBeforeIt",
  "TheImportsEventSaysHowManyRows",
  "NobodyUndoesAnotherPersonsGroup",
  "OnlyItsOwnOrganizationChangesTheGroup",
  "AViewerChangesNoGroup"
] as const

/** The rules of `UndoingGroup`, the decision behind `UndoGroup`. */
export const undoingGroupRules = [
  "AGroupsUndoTakesBackOnlyItsSendersOwn",
  "AGroupsUndoIsOfThisOpening",
  "OnlyTheLastGroupInForceIsTakenBack",
  "ThenTheOneUnderItIsTheLastInForce",
  "AGroupIsTakenBackOnce",
  "AGroupsUndoDoesNotReachPastAConfirm",
  "AGroupsUndoIsOneChange",
  "AndTheGroupSaysWhen",
  "TheImportHoldsItAsItsLastGroupAct",
  "TheImportsEventSaysHowManyRows",
  "NobodyUndoesAnotherPersonsGroup",
  "OnlyItsOwnOrganizationChangesTheGroup",
  "AViewerChangesNoGroup"
] as const

/** The model's relations, each between an import and one row or one group: proved, since every decision that records on both keeps it. */
export const relationRules = [
  "Catalog.ARowBelongsToItsImportsOrganization",
  "Catalog.AGroupBelongsToItsImportsOrganization"
] as const

/** The rules over every instance at once, which a search checks and nothing proves. */
export const searchedRules = [
  "Catalog.NoTwoRowsHoldTheSameChange",
  "Catalog.NoRowAndGroupHoldTheSameChange",
  "Catalog.NoTwoGroupsHoldTheSameChange",
  "Catalog.AGroupsChangeIsOneItsImportGave",
  "Catalog.AGroupsUndoComesAfterIt",
  "Catalog.TheLastGroupInForceIsInForce",
  "Catalog.NoGroupActIsLaterThanTheImportsLast"
] as const

/** One for each command: some sequence of commands, from nothing, gets its event recorded. A search, not a proof. */
export const reachedRules = [
  "Catalog.AnImportCanBeStaged",
  "Catalog.AColumnCanBeMatched",
  "Catalog.ASuggestionCanBeRecorded",
  "Catalog.AnImportCanBeConfirmed",
  "Catalog.AnImportCanBeTakenBack",
  "Catalog.AnImportCanBeReopened",
  "Catalog.AnImportCanBeRemoved",
  "Catalog.ARowCanBeDecided",
  "Catalog.ARowsDecisionCanBeUndone",
  "Catalog.AGroupCanBeDecided",
  "Catalog.AGroupCanBeUndone"
] as const

/** The import's seven commands, each of which keeps every rule of the import. */
export const importCommands = [
  "StageImport",
  "MatchColumn",
  "RecordSuggestion",
  "ConfirmImport",
  "TakeBackImport",
  "ReopenImport",
  "RemoveImport"
] as const
