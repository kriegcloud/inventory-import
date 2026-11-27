// The rules of every step `Undoing` takes. Each is written as it was in the decision's file, with its type on its
// name: the lock keeps a rule's text, and this is that text.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import * as ActCounted from "../Import/events/ActCounted.event.ts"
import * as ImportState from "../Import/Import.state.ts"
import { ImportEvent } from "../Import/events/ImportEvent.union.ts"
import { CUT, seal } from "../Row/Level.schema.ts"
import * as RowState from "../Row/Row.state.ts"
import * as StepUndone from "../Row/StepUndone.event.ts"
import * as UndoRowStep from "./UndoRowStep.command.ts"

/** What `Undoing` reads, before a step or after it: the import, and the row. */
type States = { readonly life: ImportState.State; readonly row: RowState.State }
/** One step `Undoing` takes: the states it read, the command, the events it recorded, and the states after. */
type Step = {
  readonly before: States
  readonly after: States
  readonly command: UndoRowStep.Command
  readonly events: ReadonlyArray<StepUndone.Event | ActCounted.Event>
}
/** A rule of every step, answered from the step alone. */
type Rule = (step: Step) => boolean
/** A rule of every step that asks who is acting. */
type Asked = (step: Step) => Effect.Effect<boolean, never, CurrentActor>

/**
 * An undo is taken only on an open import, for its sender's own change, while it is the row's decision.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoTakesBackOnlyItsSendersOwnStep: Asked = Effect.fn("Undoing.AnUndoTakesBackOnlyItsSendersOwnStep")(
  function* ({ before, command }) {
    if (!ImportState.guards.Open(before.life) || !RowState.guards.Decided(before.row)) return false
    const actor = yield* CurrentActor
    return before.row.change === command.undo && actor.memberId === before.row.by
  }
)

/**
 * An undo is taken only in the opening it was made in: one made before a confirm is not taken after a reopen.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoIsOfThisOpening: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.opening === before.life.confirms

/**
 * A row's undo is made on a screen that has the import's last act on a group.
 *
 * @category rules
 * @since 0.0.0
 */
export const ARowsUndoSawTheLastGroupAct: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.sawGroup === before.life.lastGroup

/**
 * And on one that has the row's last undo: the change it took back names it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoIsMadeOnAScreenThatHasTheRowsLastUndo: Rule = ({ before, command }) =>
  command.sawUndone === before.row.undone.change

/**
 * And on the import's matching now.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoIsMadeOnTheMatchingNow: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.madeOn === before.life.matching

/**
 * A decision a later group in force covers is not taken back from under it. Whether one covers the row is its
 * sender's word, from a screen that has every group act: the model keeps no reading of a group's rows, so this
 * rule says only that an undo taken is one whose sender said none does.
 *
 * @category rules
 * @since 0.0.0
 */
export const ARowsUndoSaysNoLaterGroupCoversIt: Rule = ({ command }) => !command.covered

/**
 * The row keeps which undo it took: the change taken back, the step it was pressed in, and who pressed. The
 * same undo sent again is known by these three, so each is what the act itself said.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheRowKeepsWhichChangeWasTakenBack: Rule = ({ after, command }) =>
  !RowState.guards.Untouched(after.row) && after.row.undone.change === command.undo

/**
 * And the step the undo was pressed in.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndTheStepItWasPressedIn: Rule = ({ after, command }) =>
  !RowState.guards.Untouched(after.row) && after.row.undone.step === command.step

/**
 * And who pressed it: the member who acts.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndWhoPressed: Asked = Effect.fn("Undoing.AndWhoPressed")(function* ({ after }) {
  if (RowState.guards.Untouched(after.row)) return false
  const actor = yield* CurrentActor
  return after.row.undone.by === actor.memberId
})

/**
 * It is an undo of a row of the import it names: the row's key is built from the import's id and the row's, and
 * two pairs can build the same key.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoIsOfARowOfTheImportItNames: Rule = ({ before, command }) =>
  RowState.guards.Untouched(before.row) || before.row.importId === command.importId

/**
 * It stops where the history was let go: a level that was let go is no decision to put back.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoStopsWhereTheHistoryWasLetGo: Rule = ({ before }) =>
  !RowState.guards.Decided(before.row) || before.row.under.change !== -1

/**
 * It does not reach past a confirm that stands.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoDoesNotReachPastAConfirm: Rule = ({ before }) =>
  ImportState.guards.Open(before.life) &&
  RowState.guards.Decided(before.row) &&
  before.row.change > before.life.confirmedAt

/**
 * An undo puts back exactly the decision under the one taken back, another person's included. When a decision was under
 * it, the row holds a decision afterwards.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoLeavesADecisionWhenOneWasUnder: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) || before.row.under.change === 0 || RowState.guards.Decided(after.row)

/**
 * And none when none was: the row is undecided afterwards.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndNoneWhenNoneWas: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) || before.row.under.change !== 0 || RowState.guards.Undecided(after.row)

/**
 * The decision the row holds afterwards is the one that was under, by the change that recorded it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoPutsBackTheDecisionThatWasThere: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) ||
  before.row.under.change === 0 ||
  !RowState.guards.Decided(after.row) ||
  after.row.change === before.row.under.change

/**
 * It is put back as theirs who made it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AsTheirsWhoMadeIt: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) ||
  before.row.under.change === 0 ||
  !RowState.guards.Decided(after.row) ||
  after.row.by === before.row.under.by

/**
 * It is put back with its text as it was.
 *
 * @category rules
 * @since 0.0.0
 */
export const WithItsTextAsItWas: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) ||
  before.row.under.change === 0 ||
  !RowState.guards.Decided(after.row) ||
  after.row.flags === before.row.under.flags

/**
 * It is put back on the matching it was made on.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnItsMatchingAsItWas: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) ||
  before.row.under.change === 0 ||
  !RowState.guards.Decided(after.row) ||
  after.row.madeOn === before.row.under.madeOn

/**
 * It is put back under the step it was made in.
 *
 * @category rules
 * @since 0.0.0
 */
export const UnderItsStepAsItWas: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) ||
  before.row.under.change === 0 ||
  !RowState.guards.Decided(after.row) ||
  after.row.step === before.row.under.step

/**
 * Nothing lies below a decision that had nothing more kept under it.
 *
 * @category rules
 * @since 0.0.0
 */
export const NothingIsBelowWhatWasTheLastKept: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) ||
  !RowState.guards.Decided(after.row) ||
  (before.row.below !== "" && before.row.below !== CUT) ||
  after.row.below === ""

/**
 * What lies under it afterwards seals to exactly the text the row held: nothing its sender wrote can stand there.
 *
 * @category rules
 * @since 0.0.0
 */
export const WhatLiesUnderIsWhatWasRecorded: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before.row) ||
  before.row.under.change === 0 ||
  !RowState.guards.Decided(after.row) ||
  (before.row.below === ""
    ? after.row.under.change === 0
    : before.row.below === CUT
      ? after.row.under.change === -1
      : seal({ level: after.row.under, below: after.row.below }) === before.row.below)

/**
 * The import's event says what the row now holds (0 for none), and whose it is.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportsEventSaysWhichDecisionTheRowHolds: Rule = ({ after, events }) =>
  A.every(
    events,
    (e) => !ImportEvent.guards.ActCounted(e) || e.holds === (RowState.guards.Decided(after.row) ? after.row.change : 0)
  )

/**
 * The import's event says whose the decision the row now holds is.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportsEventSaysWhose: Rule = ({ after, events }) =>
  A.every(
    events,
    (e) => !ImportEvent.guards.ActCounted(e) || !RowState.guards.Decided(after.row) || e.by === after.row.by
  )

/**
 * The import's event says the text of the decision the row now holds.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportsEventSaysItsText: Rule = ({ after, events }) =>
  A.every(
    events,
    (e) => !ImportEvent.guards.ActCounted(e) || !RowState.guards.Decided(after.row) || e.flags === after.row.flags
  )

/**
 * And who acted: the member who pressed the undo, whoever's decision it puts back.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportsEventSaysWhoActed: Asked = Effect.fn("Undoing.TheImportsEventSaysWhoActed")(function* ({
  events
}) {
  const actor = yield* CurrentActor
  return A.every(events, (e) => !ImportEvent.guards.ActCounted(e) || e.actor === actor.memberId)
})

/**
 * An undo is one change of the import: the import counts one change more.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnUndoIsNumbered: Rule = ({ before, after }) =>
  ImportState.guards.Open(before.life) &&
  ImportState.guards.Open(after.life) &&
  after.life.changes === before.life.changes + 1

/**
 * Who may change a row. The row has no command of its own, so these are rules of the decisions that record on it.
 * Nobody clears another person's decision: an undo that leaves the row with no decision is by the member whose decision
 * it took back.
 *
 * @category rules
 * @since 0.0.0
 */
export const NobodyClearsAnotherPersonsDecision: Asked = Effect.fn("Undoing.NobodyClearsAnotherPersonsDecision")(
  function* ({ before, after }) {
    if (!RowState.guards.Decided(before.row) || RowState.guards.Decided(after.row)) return true
    const actor = yield* CurrentActor
    return actor.memberId === before.row.by
  }
)

/**
 * Once an act has reached a row, only a member of the row's organization changes it.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnlyItsOwnOrganizationChangesTheRow: Asked = Effect.fn("Undoing.OnlyItsOwnOrganizationChangesTheRow")(
  function* ({ before }) {
    if (RowState.guards.Untouched(before.row)) return true
    const actor = yield* CurrentActor
    return actor.organizationId === before.row.organizationId
  }
)

/**
 * A viewer changes no row: the member who acts is not a viewer.
 *
 * @category rules
 * @since 0.0.0
 */
export const AViewerChangesNoRow: Asked = Effect.fn("Undoing.AViewerChangesNoRow")(function* () {
  const actor = yield* CurrentActor
  return actor.role !== "viewer"
})
