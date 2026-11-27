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
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { ImportKey } from "../Review/Change.schema.ts"
import * as ActCounted from "./ActCounted.event.ts"
import * as ColumnMatched from "./ColumnMatched.event.ts"
import * as ConfirmImport from "./ConfirmImport.command.ts"
import * as GroupCounted from "./GroupCounted.event.ts"
import * as ImportState from "./Import.state.ts"
import * as ImportConfirmed from "./ImportConfirmed.event.ts"
import * as ImportRemoved from "./ImportRemoved.event.ts"
import * as ImportReopened from "./ImportReopened.event.ts"
import * as ImportStaged from "./ImportStaged.event.ts"
import * as ImportTakenBack from "./ImportTakenBack.event.ts"
import * as MatchColumn from "./MatchColumn.command.ts"
import * as RecordSuggestion from "./RecordSuggestion.command.ts"
import * as RemoveImport from "./RemoveImport.command.ts"
import * as ReopenImport from "./ReopenImport.command.ts"
import * as StageImport from "./StageImport.command.ts"
import * as SuggestionRecorded from "./SuggestionRecorded.event.ts"
import * as TakeBackImport from "./TakeBackImport.command.ts"

/** A command the import itself decides, told by its `_tag`. */
export const ImportCommand = S.Union([
  StageImport.Command,
  MatchColumn.Command,
  RecordSuggestion.Command,
  ConfirmImport.Command,
  TakeBackImport.Command,
  ReopenImport.Command,
  RemoveImport.Command
])
  .annotate({ description: "A command the import itself decides" })
  .pipe(S.toTaggedUnion("_tag"))
/** The decoded value of `ImportCommand`. */
export type ImportCommand = typeof ImportCommand.Type

/** An event the import folds: its own commands', and `ActCounted` and `GroupCounted`, which only a decision records. */
export const ImportEvent = S.Union([
  ImportStaged.Event,
  ColumnMatched.Event,
  ActCounted.Event,
  GroupCounted.Event,
  SuggestionRecorded.Event,
  ImportConfirmed.Event,
  ImportTakenBack.Event,
  ImportReopened.Event,
  ImportRemoved.Event
])
  .annotate({ description: "An event the import folds, its own or one a decision records on it" })
  .pipe(S.toTaggedUnion("_tag"))
/** The decoded value of `ImportEvent`. */
export type ImportEvent = typeof ImportEvent.Type

/**
 * One import's lifecycle: staged, matched, confirmed, taken back, opened again, removed, with the number of its last
 * change. Every act of the review goes through it, so it can order a confirm among them.
 */
export class Import extends Domain.Aggregate(
  "Import",
  {
    id: ImportKey,
    state: ImportState.State,
    initial: ImportState.Unstaged.make({ status: "Unstaged" }),
    invariants: {
      OutcomesAddUpToTheRows: ImportState.OutcomesAddUpToTheRows,
      NoMoreInForceThanRows: ImportState.NoMoreInForceThanRows,
      NothingStandsThatWasTakenBack: ImportState.NothingStandsThatWasTakenBack,
      WhatIsInForceThenIsWhatWasKept: ImportState.WhatIsInForceThenIsWhatWasKept
    },
    transitions: {
      // The status becomes Imported only by a confirm.
      NothingIsWrittenBeforeConfirm: ({ before, after, command }) =>
        !ImportState.guards.Imported(after) ||
        ImportState.guards.Imported(before) ||
        ImportCommand.guards.ConfirmImport(command),
      // A confirm leaves the status of an import that is not open as it was. It says no more: what stops a second
      // confirm from writing is that one on a closed import is refused, and "every change has its own number".
      AConfirmLeavesAClosedImportsStatusAsItWas: ({ before, after, command }) =>
        !ImportCommand.guards.ConfirmImport(command) ||
        ImportState.guards.Open(before) ||
        after.status === before.status,
      // Nothing is confirmed that was not on screen: the confirm names the last change, as the last of every one its
      // screen received; its plan is of that change; and the plan does what the screen said it would.
      AConfirmNamesEveryChange: ({ before, after, command }) =>
        !ImportCommand.guards.ConfirmImport(command) ||
        !ImportState.guards.Open(before) ||
        !ImportState.guards.Imported(after) ||
        command.seen === before.changes,
      APlanIsOfEveryChange: ({ before, after, command }) =>
        !ImportCommand.guards.ConfirmImport(command) ||
        !ImportState.guards.Open(before) ||
        !ImportState.guards.Imported(after) ||
        command.planAt === before.changes,
      APlanDoesWhatWasShown: ({ before, after, command }) =>
        !ImportCommand.guards.ConfirmImport(command) ||
        !ImportState.guards.Open(before) ||
        !ImportState.guards.Imported(after) ||
        command.plan === command.shown,
      // Nor is an import taken back, opened again or removed by someone who has not received its last change.
      TheRestNameEveryChangeToo: ({ before, after, command }) =>
        !ImportCommand.isAnyOf(["TakeBackImport", "ReopenImport", "RemoveImport"])(command) ||
        ImportState.guards.Unstaged(before) ||
        ImportState.guards.Removed(before) ||
        ImportState.guards.Unstaged(after) ||
        command.seen === before.changes,
      // Every change has a number of its own: each raises the import's number by exactly one, and nothing else moves it.
      EveryChangeHasItsOwnNumber: ({ before, after, command }) =>
        ImportState.guards.Unstaged(before) ||
        ImportState.guards.Removed(before) ||
        ImportState.guards.Unstaged(after) ||
        ImportState.guards.Removed(after) ||
        after.changes === before.changes + (ImportCommand.guards.RecordSuggestion(command) ? 0 : 1),
      OnlyAnImportWithAConfirmStandingIsTakenBack: ({ before, after, command }) =>
        !ImportCommand.guards.TakeBackImport(command) ||
        ImportState.guards.Unstaged(before) ||
        ImportState.guards.Removed(before) ||
        ImportState.guards.Unstaged(after) ||
        before.standing >= 1,
      // A take-back is of everything in force: what was removed and what was kept add up to it, and nothing stands
      // after.
      ATakeBackIsOfEverythingInForce: ({ before, after, command, events }) =>
        !ImportCommand.guards.TakeBackImport(command) ||
        ImportState.guards.Unstaged(before) ||
        ImportState.guards.Removed(before) ||
        ImportState.guards.Unstaged(after) ||
        ImportState.guards.Removed(after) ||
        (after.standing === 0 &&
          after.replaced === 0 &&
          after.inForce === command.kept &&
          A.every(events, (e) => !ImportEvent.guards.ImportTakenBack(e) || e.removed + e.kept === before.inForce)),
      // What its confirms replaced is put back or kept, and nothing is left out of the two counts.
      AndOfEverythingReplaced: ({ before, command, events }) =>
        !ImportCommand.guards.TakeBackImport(command) ||
        ImportState.guards.Unstaged(before) ||
        ImportState.guards.Removed(before) ||
        A.every(
          events,
          (e) => !ImportEvent.guards.ImportTakenBack(e) || e.restored + e.keptReplaced === before.replaced
        ),
      // Every event of the import says whose it is.
      EveryEventSaysWhose: Effect.fn("Import.EveryEventSaysWhose")(function* ({ events }) {
        const actor = yield* CurrentActor
        return A.every(events, (e) =>
          ImportEvent.guards.ActCounted(e) ? e.actor === actor.memberId : e.by === actor.memberId
        )
      }),
      // A match is made in this opening of the import.
      AMatchIsOfThisOpening: ({ before, after, command }) =>
        !ImportCommand.guards.MatchColumn(command) ||
        !ImportState.guards.Open(before) ||
        !ImportState.guards.Open(after) ||
        command.opening === before.confirms,
      ASuggestionWritesNothing: ({ before, after, command }) =>
        !ImportCommand.guards.RecordSuggestion(command) ||
        !ImportState.guards.Open(before) ||
        (ImportState.guards.Open(after) && after.matching === before.matching && after.changes === before.changes),
      // A match is made by someone who saw the last one, whatever field it moved; it raises the matching by one and
      // holds the columns it says. The same columns again are no match.
      AMatchIsMadeOnTheLastOne: ({ before, after, command }) =>
        !ImportCommand.guards.MatchColumn(command) ||
        !ImportState.guards.Open(before) ||
        !ImportState.guards.Open(after) ||
        command.saw === before.matching,
      AMatchHoldsTheColumnsItSays: ({ before, after, command }) =>
        !ImportCommand.guards.MatchColumn(command) ||
        !ImportState.guards.Open(before) ||
        !ImportState.guards.Open(after) ||
        after.columns === command.columns,
      AMatchIsTheNextOne: ({ before, after, command }) =>
        !ImportCommand.guards.MatchColumn(command) ||
        !ImportState.guards.Open(before) ||
        !ImportState.guards.Open(after) ||
        after.matching === before.matching + 1,
      // The matching moves only on an open import. It reads the matching alone: that no row or group act lands on a
      // closed import is each decision's own rule ("a row is decided only on an open import" and its like).
      TheMatchingMovesOnlyOnAnOpenImport: ({ before, after }) =>
        ImportState.guards.Open(before) ||
        ImportState.guards.Unstaged(before) ||
        ImportState.guards.Removed(before) ||
        ImportState.guards.Removed(after) ||
        ImportState.guards.Unstaged(after) ||
        after.matching === before.matching,
      AnImportIsOpenedAgainOnlyByReopen: ({ before, after, command }) =>
        !ImportState.guards.Open(after) ||
        ImportState.guards.Open(before) ||
        ImportState.guards.Unstaged(before) ||
        (ImportCommand.guards.ReopenImport(command) &&
          (ImportState.guards.Imported(before) || ImportState.guards.TakenBack(before))),
      ARemovedImportStaysRemoved: ({ before, after }) =>
        !ImportState.guards.Removed(before) || ImportState.guards.Removed(after),
      OnlyAnImportWithNothingInForceIsRemoved: ({ before, after }) =>
        !ImportState.guards.Removed(after) ||
        ImportState.guards.Removed(before) ||
        (ImportState.guards.Open(before) && before.inForce === 0 && before.standing === 0),
      AnImportNeverChangesOrganization: ({ before, after }) =>
        ImportState.guards.Unstaged(before) ||
        ImportState.guards.Unstaged(after) ||
        before.organizationId === after.organizationId,
      OnlyItsOwnOrganizationChangesAnImport: Effect.fn("Import.OnlyItsOwnOrganizationChangesAnImport")(function* ({
        before
      }) {
        if (ImportState.guards.Unstaged(before)) return true
        const actor = yield* CurrentActor
        return actor.organizationId === before.organizationId
      }),
      AViewerChangesNothing: Effect.fn("Import.AViewerChangesNothing")(function* () {
        const actor = yield* CurrentActor
        return actor.role !== "viewer"
      })
    },
    commands: [
      StageImport.Command,
      MatchColumn.Command,
      RecordSuggestion.Command,
      ConfirmImport.Command,
      TakeBackImport.Command,
      ReopenImport.Command,
      RemoveImport.Command
    ],
    events: [ActCounted.Event, GroupCounted.Event],
    keyOf: (cmd) => cmd.importId,
    decide: {
      StageImport: StageImport.decide,
      MatchColumn: MatchColumn.decide,
      RecordSuggestion: RecordSuggestion.decide,
      ConfirmImport: ConfirmImport.decide,
      TakeBackImport: TakeBackImport.decide,
      ReopenImport: ReopenImport.decide,
      RemoveImport: RemoveImport.decide
    },
    evolve: {
      ImportStaged: ImportStaged.evolve,
      ColumnMatched: ColumnMatched.evolve,
      ActCounted: ActCounted.evolve,
      GroupCounted: GroupCounted.evolve,
      SuggestionRecorded: SuggestionRecorded.evolve,
      ImportConfirmed: ImportConfirmed.evolve,
      ImportTakenBack: ImportTakenBack.evolve,
      ImportReopened: ImportReopened.evolve,
      ImportRemoved: ImportRemoved.evolve
    }
  },
  { description: "One import's lifecycle, which numbers every change of its review" }
) {}
