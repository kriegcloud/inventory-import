// The rules of every step of an import: what a command may make of the state before it. Each is written as it was
// in the aggregate's file, with its type on its name: the lock keeps a rule's text, and this is that text.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import * as ImportState from "./Import.state.ts"
import { ImportCommand } from "./commands/ImportCommand.union.ts"
import { ImportEvent } from "./events/ImportEvent.union.ts"

/** One step of an import: the states around a command, and the events it recorded. */
type Transition = {
  readonly before: ImportState.State
  readonly after: ImportState.State
  readonly command: ImportCommand
  readonly events: ReadonlyArray<ImportEvent>
}
/** A rule of every step, answered from the step alone. */
type Rule = (transition: Transition) => boolean
/** A rule of every step that asks who is acting. */
type Asked = (transition: Transition) => Effect.Effect<boolean, never, CurrentActor>

/**
 * The status becomes Imported only by a confirm.
 *
 * @category rules
 * @since 0.0.0
 */
export const NothingIsWrittenBeforeConfirm: Rule = ({ before, after, command }) =>
  !ImportState.guards.Imported(after) ||
  ImportState.guards.Imported(before) ||
  ImportCommand.guards.ConfirmImport(command)

/**
 * A confirm leaves the status of an import that is not open as it was. It says no more: what stops a second
 * confirm from writing is that one on a closed import is refused, and "every change has its own number".
 *
 * @category rules
 * @since 0.0.0
 */
export const AConfirmLeavesAClosedImportsStatusAsItWas: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.ConfirmImport(command) || ImportState.guards.Open(before) || after.status === before.status

/**
 * Nothing is confirmed that was not on screen: a confirm that closes an open import names its last change, as the
 * last of every one its screen received.
 *
 * @category rules
 * @since 0.0.0
 */
export const AConfirmNamesEveryChange: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.seen === before.changes

/**
 * A confirm's plan is of the import's last change: the handler built it from rows written up to that number.
 *
 * @category rules
 * @since 0.0.0
 */
export const APlanIsOfEveryChange: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.planAt === before.changes

/**
 * A confirm's plan does what the screen said it would: its digest is the one the screen showed.
 *
 * @category rules
 * @since 0.0.0
 */
export const APlanDoesWhatWasShown: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.ConfirmImport(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Imported(after) ||
  command.plan === command.shown

/**
 * Nor is an import taken back, opened again or removed by someone who has not received its last change.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheRestNameEveryChangeToo: Rule = ({ before, after, command }) =>
  !ImportCommand.isAnyOf(["TakeBackImport", "ReopenImport", "RemoveImport"])(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  command.seen === before.changes

/**
 * Every change has a number of its own: each raises the import's number by exactly one, and nothing else moves it.
 * A recorded suggestion is no change and leaves the number as it was.
 *
 * @category rules
 * @since 0.0.0
 */
export const EveryChangeHasItsOwnNumber: Rule = ({ before, after, command }) =>
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  ImportState.guards.Removed(after) ||
  after.changes === before.changes + (ImportCommand.guards.RecordSuggestion(command) ? 0 : 1)

/**
 * Only an import with at least one confirm standing is taken back.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnlyAnImportWithAConfirmStandingIsTakenBack: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.TakeBackImport(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Unstaged(after) ||
  before.standing >= 1

/**
 * A take-back is of everything in force: what was removed and what was kept add up to it, what stays in force is
 * what was kept, and nothing stands or stays replaced after.
 *
 * @category rules
 * @since 0.0.0
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

/**
 * A take-back is of everything replaced too: what its confirms replaced is put back or kept, and nothing is left
 * out of the two counts.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndOfEverythingReplaced: Rule = ({ before, command, events }) =>
  !ImportCommand.guards.TakeBackImport(command) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  A.every(events, (e) => !ImportEvent.guards.ImportTakenBack(e) || e.restored + e.keptReplaced === before.replaced)

/**
 * Every event of the import says whose it is: it names the person acting, in `by`, or in `actor` for an
 * `ActCounted`, whose `by` is whose decision the row holds.
 *
 * @category rules
 * @since 0.0.0
 */
export const EveryEventSaysWhose: Asked = Effect.fn("Import.EveryEventSaysWhose")(function* ({ events }) {
  const actor = yield* CurrentActor
  return A.every(events, (e) =>
    ImportEvent.guards.ActCounted(e) ? e.actor === actor.memberId : e.by === actor.memberId
  )
})

/**
 * A match is made in this opening of the import: its `opening` is the import's count of confirms, so a match made
 * before a confirm is not taken after a reopen.
 *
 * @category rules
 * @since 0.0.0
 */
export const AMatchIsOfThisOpening: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  command.opening === before.confirms

/**
 * A recorded suggestion writes nothing: an open import stays open, with its matching and its change number as
 * they were.
 *
 * @category rules
 * @since 0.0.0
 */
export const ASuggestionWritesNothing: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.RecordSuggestion(command) ||
  !ImportState.guards.Open(before) ||
  (ImportState.guards.Open(after) && after.matching === before.matching && after.changes === before.changes)

/**
 * A match is made by someone who saw the last one, whatever field it moved: its `saw` is the import's matching.
 *
 * @category rules
 * @since 0.0.0
 */
export const AMatchIsMadeOnTheLastOne: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  command.saw === before.matching

/**
 * A match leaves the import holding the columns it says.
 *
 * @category rules
 * @since 0.0.0
 */
export const AMatchHoldsTheColumnsItSays: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  after.columns === command.columns

/**
 * A match raises the import's matching by exactly one.
 *
 * @category rules
 * @since 0.0.0
 */
export const AMatchIsTheNextOne: Rule = ({ before, after, command }) =>
  !ImportCommand.guards.MatchColumn(command) ||
  !ImportState.guards.Open(before) ||
  !ImportState.guards.Open(after) ||
  after.matching === before.matching + 1

/**
 * The matching moves only on an open import. It reads the matching alone: that no row or group act lands on a
 * closed import is each decision's own rule ("a row is decided only on an open import" and its like).
 *
 * @category rules
 * @since 0.0.0
 */
export const TheMatchingMovesOnlyOnAnOpenImport: Rule = ({ before, after }) =>
  ImportState.guards.Open(before) ||
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Removed(before) ||
  ImportState.guards.Removed(after) ||
  ImportState.guards.Unstaged(after) ||
  after.matching === before.matching

/**
 * An import that is not open becomes open again only by a reopen, and only from confirmed or taken back.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnImportIsOpenedAgainOnlyByReopen: Rule = ({ before, after, command }) =>
  !ImportState.guards.Open(after) ||
  ImportState.guards.Open(before) ||
  ImportState.guards.Unstaged(before) ||
  (ImportCommand.guards.ReopenImport(command) &&
    (ImportState.guards.Imported(before) || ImportState.guards.TakenBack(before)))

/**
 * A removed import stays removed.
 *
 * @category rules
 * @since 0.0.0
 */
export const ARemovedImportStaysRemoved: Rule = ({ before, after }) =>
  !ImportState.guards.Removed(before) || ImportState.guards.Removed(after)

/**
 * An import is removed only while it is open, with no item in force and no confirm standing.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnlyAnImportWithNothingInForceIsRemoved: Rule = ({ before, after }) =>
  !ImportState.guards.Removed(after) ||
  ImportState.guards.Removed(before) ||
  (ImportState.guards.Open(before) && before.inForce === 0 && before.standing === 0)

/**
 * A staged import keeps the organization it was staged in.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnImportNeverChangesOrganization: Rule = ({ before, after }) =>
  ImportState.guards.Unstaged(before) ||
  ImportState.guards.Unstaged(after) ||
  before.organizationId === after.organizationId

/**
 * A staged import is changed only by someone acting in its organization. Staging, which gives it its organization,
 * is not held to it.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnlyItsOwnOrganizationChangesAnImport: Asked = Effect.fn("Import.OnlyItsOwnOrganizationChangesAnImport")(
  function* ({ before }) {
    if (ImportState.guards.Unstaged(before)) return true
    const actor = yield* CurrentActor
    return actor.organizationId === before.organizationId
  }
)

/**
 * A viewer takes no step of an import.
 *
 * @category rules
 * @since 0.0.0
 */
export const AViewerChangesNothing: Asked = Effect.fn("Import.AViewerChangesNothing")(function* () {
  const actor = yield* CurrentActor
  return actor.role !== "viewer"
})
