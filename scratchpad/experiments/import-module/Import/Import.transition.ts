// The rules of every step of an import: what a command may make of the state before it. Each is written as it was
// in the aggregate's file, with its type on its name: the lock keeps a rule's text, and this is that text.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import * as ImportState from "./Import.state.ts"
import { ImportCommand, ImportEvent } from "./Import.union.ts"

/** One step of an import: the states around a command, and the events it recorded. */
type Step = {
  readonly before: ImportState.State
  readonly after: ImportState.State
  readonly command: ImportCommand
  readonly events: ReadonlyArray<ImportEvent>
}
/** A rule of every step, answered from the step alone. */
type Rule = (step: Step) => boolean
/** A rule of every step that asks who is acting. */
type Asked = (step: Step) => Effect.Effect<boolean, never, CurrentActor>

/** The status becomes Imported only by a confirm. */
export const NothingIsWrittenBeforeConfirm: Rule = ({ before, after, command }) =>
  !ImportState.guards.Imported(after) ||
  ImportState.guards.Imported(before) ||
  ImportCommand.guards.ConfirmImport(command)

/**
 * A confirm leaves the status of an import that is not open as it was. It says no more: what stops a second
 * confirm from writing is that one on a closed import is refused, and "every change has its own number".
 */
export const AConfirmLeavesAClosedImportsStatusAsItWas: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.ConfirmImport(command) || ImportState.guards.Open(before) || after.status === before.status

/**
 * Nothing is confirmed that was not on screen: the confirm names the last change, as the last of every one its
 * screen received; its plan is of that change; and the plan does what the screen said it would.
 */
export const AConfirmNamesEveryChange: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.seen === before.changes

/** A rule of every step of an import. */
export const APlanIsOfEveryChange: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.planAt === before.changes

/** A rule of every step of an import. */
export const APlanDoesWhatWasShown: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.plan === command.shown

/**
 * Nor is an import taken back, opened again or removed by someone who has not received its last change.
 */
export const TheRestNameEveryChangeToo: Rule = ({ before, after, command }) =>
  !ImportCommand.isAnyOf(["TakeBackImport", "ReopenImport", "RemoveImport"])(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  command.seen === before.changes

/**
 * Every change has a number of its own: each raises the import's number by exactly one, and nothing else moves it.
 */
export const EveryChangeHasItsOwnNumber: Rule = ({ before, after, command }) =>
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  ImportState.guards.Removed(after) ||
  after.changes === before.changes + (ImportCommand.guards.RecordSuggestion(command) ? 0 : 1)

/** A rule of every step of an import. */
export const OnlyAnImportWithAConfirmStandingIsTakenBack: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.TakeBackImport(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  before.standing >= 1

/**
 * A take-back is of everything in force: what was removed and what was kept add up to it, and nothing stands
 * after.
 */
export const ATakeBackIsOfEverythingInForce: Rule = ({ before, after, command, events }) =>
  !ImportCommand.guards.TakeBackImport(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  ImportState.guards.Removed(after) ||
  (after.standing === 0 &&
    after.replaced === 0 &&
    after.inForce === command.kept &&
    A.every(events, (e) => !ImportEvent.guards.ImportTakenBack(e) || e.removed + e.kept === before.inForce))

/** What its confirms replaced is put back or kept, and nothing is left out of the two counts. */
export const AndOfEverythingReplaced: Rule = ({ before, command, events }) =>
  !ImportCommand.guards.TakeBackImport(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  A.every(events, (e) => !ImportEvent.guards.ImportTakenBack(e) || e.restored + e.keptReplaced === before.replaced)

/** Every event of the import says whose it is. */
export const EveryEventSaysWhose: Asked = Effect.fn("Import.EveryEventSaysWhose")(function* ({ events }) {
  const actor = yield* CurrentActor
  return A.every(events, (e) =>
    ImportEvent.guards.ActCounted(e) ? e.actor === actor.memberId : e.by === actor.memberId
  )
})

/** A match is made in this opening of the import. */
export const AMatchIsOfThisOpening: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  command.opening === before.confirms

/** A rule of every step of an import. */
export const ASuggestionWritesNothing: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.RecordSuggestion(command) ||
  !ImportState.guards.Open(before) ||
  (ImportState.guards.Open(after) && after.matching === before.matching && after.changes === before.changes)

/**
 * A match is made by someone who saw the last one, whatever field it moved; it raises the matching by one and
 * holds the columns it says. The same columns again are no match.
 */
export const AMatchIsMadeOnTheLastOne: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  command.saw === before.matching

/** A rule of every step of an import. */
export const AMatchHoldsTheColumnsItSays: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  after.columns === command.columns

/** A rule of every step of an import. */
export const AMatchIsTheNextOne: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  after.matching === before.matching + 1

/**
 * The matching moves only on an open import. It reads the matching alone: that no row or group act lands on a
 * closed import is each decision's own rule ("a row is decided only on an open import" and its like).
 */
export const TheMatchingMovesOnlyOnAnOpenImport: Rule = ({ before, after }) =>
  ImportState.guards.Open(before) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Removed(after) ||
  ImportState.guards.Unstaged(after) ||
  after.matching === before.matching

/** A rule of every step of an import. */
export const AnImportIsOpenedAgainOnlyByReopen: Rule = ({ before, after, command }) =>
  !ImportState.guards.Open(after) ||
  ImportState.guards.Open(before) ||
  ImportState.guards.Unstaged(before) ||
  (ImportCommand.guards.ReopenImport(command) &&
    (ImportState.guards.Imported(before) || ImportState.guards.TakenBack(before)))

/** A rule of every step of an import. */
export const ARemovedImportStaysRemoved: Rule = ({ before, after }) =>
  !ImportState.guards.Removed(before) || ImportState.guards.Removed(after)

/** A rule of every step of an import. */
export const OnlyAnImportWithNothingInForceIsRemoved: Rule = ({ before, after }) =>
  !ImportState.guards.Removed(after) ||
  ImportState.guards.Removed(before) ||
  (ImportState.guards.Open(before) && before.inForce === 0 && before.standing === 0)

/** A rule of every step of an import. */
export const AnImportNeverChangesOrganization: Rule = ({ before, after }) =>
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Unstaged(after) ||
  before.organizationId === after.organizationId

/** A rule of every step of an import. */
export const OnlyItsOwnOrganizationChangesAnImport: Asked = Effect.fn("Import.OnlyItsOwnOrganizationChangesAnImport")(
  function* ({ before }) {
    if (ImportState.guards.Unstaged(before)) return true
    const actor = yield* CurrentActor
    return actor.organizationId === before.organizationId
  }
)

/** A rule of every step of an import. */
export const AViewerChangesNothing: Asked = Effect.fn("Import.AViewerChangesNothing")(function* () {
  const actor = yield* CurrentActor
  return actor.role !== "viewer"
})
