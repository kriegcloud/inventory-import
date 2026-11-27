// The rules of every step of an import: what a command may make of the state before it. They read every command
// and every event of the import, so they sit above the commands' files and not beside the state.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { ActCounted } from "./ActCounted.event.ts"
import { ConfirmImport, ImportConfirmed } from "./ConfirmImport.command.ts"
import { GroupCounted } from "./GroupCounted.event.ts"
import { ImportState } from "./Import.state.ts"
import { ColumnMatched, MatchColumn } from "./MatchColumn.command.ts"
import { RecordSuggestion, SuggestionRecorded } from "./RecordSuggestion.command.ts"
import { ImportRemoved, RemoveImport } from "./RemoveImport.command.ts"
import { ImportReopened, ReopenImport } from "./ReopenImport.command.ts"
import { ImportStaged, StageImport } from "./StageImport.command.ts"
import { ImportTakenBack, TakeBackImport } from "./TakeBackImport.command.ts"

/** A command the import itself decides, told by its `_tag`. */
export const ImportCommand = S.Union([
  StageImport,
  MatchColumn,
  RecordSuggestion,
  ConfirmImport,
  TakeBackImport,
  ReopenImport,
  RemoveImport
])
  .annotate({ description: "A command the import itself decides" })
  .pipe(S.toTaggedUnion("_tag"))
/** The decoded value of `ImportCommand`. */
export type ImportCommand = typeof ImportCommand.Type

/** An event the import folds: its own commands', and `ActCounted` and `GroupCounted`, which only a decision records. */
export const ImportEvent = S.Union([
  ImportStaged,
  ColumnMatched,
  ActCounted,
  GroupCounted,
  SuggestionRecorded,
  ImportConfirmed,
  ImportTakenBack,
  ImportReopened,
  ImportRemoved
])
  .annotate({ description: "An event the import folds, its own or one a decision records on it" })
  .pipe(S.toTaggedUnion("_tag"))
/** The decoded value of `ImportEvent`. */
export type ImportEvent = typeof ImportEvent.Type

/** One step of an import: the states around a command, and the events it recorded. */
export type Moved = {
  readonly before: ImportState
  readonly after: ImportState
  readonly command: ImportCommand
  readonly events: ReadonlyArray<ImportEvent>
}

// The status becomes Imported only by a confirm.
/** A rule of every step of an import. */
export const NothingIsWrittenBeforeConfirm = ({ before, after, command }: Moved): boolean =>
  !ImportState.guards.Imported(after) ||
  ImportState.guards.Imported(before) ||
  ImportCommand.guards.ConfirmImport(command)

// A confirm leaves the status of an import that is not open as it was. It says no more: what stops a second
// confirm from writing is that one on a closed import is refused, and "every change has its own number".
/** A rule of every step of an import. */
export const AConfirmLeavesAClosedImportsStatusAsItWas = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.ConfirmImport(command) ||
  ImportState.guards.Open(before) ||
  after.status === before.status

// Nothing is confirmed that was not on screen: the confirm names the last change, as the last of every one its
// screen received; its plan is of that change; and the plan does what the screen said it would.
/** A rule of every step of an import. */
export const AConfirmNamesEveryChange = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.seen === before.changes

/** A rule of every step of an import. */
export const APlanIsOfEveryChange = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.planAt === before.changes

/** A rule of every step of an import. */
export const APlanDoesWhatWasShown = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.plan === command.shown

// Nor is an import taken back, opened again or removed by someone who has not received its last change.
/** A rule of every step of an import. */
export const TheRestNameEveryChangeToo = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.isAnyOf(["TakeBackImport", "ReopenImport", "RemoveImport"])(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  command.seen === before.changes

// Every change has a number of its own: each raises the import's number by exactly one, and nothing else moves it.
/** A rule of every step of an import. */
export const EveryChangeHasItsOwnNumber = ({ before, after, command }: Moved): boolean =>
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  ImportState.guards.Removed(after) ||
  after.changes === before.changes + (ImportCommand.guards.RecordSuggestion(command) ? 0 : 1)

/** A rule of every step of an import. */
export const OnlyAnImportWithAConfirmStandingIsTakenBack = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.TakeBackImport(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  before.standing >= 1

// A take-back is of everything in force: what was removed and what was kept add up to it, and nothing stands
// after.
/** A rule of every step of an import. */
export const ATakeBackIsOfEverythingInForce = ({ before, after, command, events }: Moved): boolean =>
  !ImportCommand.guards.TakeBackImport(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  ImportState.guards.Removed(after) ||
  (after.standing === 0 &&
    after.replaced === 0 &&
    after.inForce === command.kept &&
    A.every(events, (e) => !ImportEvent.guards.ImportTakenBack(e) || e.removed + e.kept === before.inForce))

// What its confirms replaced is put back or kept, and nothing is left out of the two counts.
/** A rule of every step of an import. */
export const AndOfEverythingReplaced = ({ before, command, events }: Moved): boolean =>
  !ImportCommand.guards.TakeBackImport(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  A.every(
    events,
    (e) => !ImportEvent.guards.ImportTakenBack(e) || e.restored + e.keptReplaced === before.replaced
  )

// Every event of the import says whose it is.
/** A rule of every step of an import. */
export const EveryEventSaysWhose = Effect.fn("Import.EveryEventSaysWhose")(function* ({ events }: Moved) {
  const actor = yield* CurrentActor
  return A.every(events, (e) =>
    ImportEvent.guards.ActCounted(e) ? e.actor === actor.memberId : e.by === actor.memberId
  )
})

// A match is made in this opening of the import.
/** A rule of every step of an import. */
export const AMatchIsOfThisOpening = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  command.opening === before.confirms

/** A rule of every step of an import. */
export const ASuggestionWritesNothing = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.RecordSuggestion(command) ||
  !ImportState.guards.Open(before) ||
  (ImportState.guards.Open(after) && after.matching === before.matching && after.changes === before.changes)

// A match is made by someone who saw the last one, whatever field it moved; it raises the matching by one and
// holds the columns it says. The same columns again are no match.
/** A rule of every step of an import. */
export const AMatchIsMadeOnTheLastOne = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  command.saw === before.matching

/** A rule of every step of an import. */
export const AMatchHoldsTheColumnsItSays = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  after.columns === command.columns

/** A rule of every step of an import. */
export const AMatchIsTheNextOne = ({ before, after, command }: Moved): boolean =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  after.matching === before.matching + 1

// The matching moves only on an open import. It reads the matching alone: that no row or group act lands on a
// closed import is each decision's own rule ("a row is decided only on an open import" and its like).
/** A rule of every step of an import. */
export const TheMatchingMovesOnlyOnAnOpenImport = ({ before, after }: Moved): boolean =>
  ImportState.guards.Open(before) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Removed(after) ||
  ImportState.guards.Unstaged(after) ||
  after.matching === before.matching

/** A rule of every step of an import. */
export const AnImportIsOpenedAgainOnlyByReopen = ({ before, after, command }: Moved): boolean =>
  !ImportState.guards.Open(after) ||
  ImportState.guards.Open(before) ||
  ImportState.guards.Unstaged(before) ||
  (ImportCommand.guards.ReopenImport(command) &&
    (ImportState.guards.Imported(before) || ImportState.guards.TakenBack(before)))

/** A rule of every step of an import. */
export const ARemovedImportStaysRemoved = ({ before, after }: Moved): boolean =>
  !ImportState.guards.Removed(before) || ImportState.guards.Removed(after)

/** A rule of every step of an import. */
export const OnlyAnImportWithNothingInForceIsRemoved = ({ before, after }: Moved): boolean =>
  !ImportState.guards.Removed(after) ||
  ImportState.guards.Removed(before) ||
  (ImportState.guards.Open(before) && before.inForce === 0 && before.standing === 0)

/** A rule of every step of an import. */
export const AnImportNeverChangesOrganization = ({ before, after }: Moved): boolean =>
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Unstaged(after) ||
  before.organizationId === after.organizationId

/** A rule of every step of an import. */
export const OnlyItsOwnOrganizationChangesAnImport = Effect.fn("Import.OnlyItsOwnOrganizationChangesAnImport")(function* ({
  before
}: Moved) {
  if (ImportState.guards.Unstaged(before)) return true
  const actor = yield* CurrentActor
  return actor.organizationId === before.organizationId
})

/** A rule of every step of an import. */
export const AViewerChangesNothing = Effect.fn("Import.AViewerChangesNothing")(function* () {
  const actor = yield* CurrentActor
  return actor.role !== "viewer"
})
