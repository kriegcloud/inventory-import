// The rules of every step `Deciding` takes. Each is written as it was in the decision's file, with its type on its
// name: the lock keeps a rule's text, and this is that text.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import * as ActCounted from "../Import/events/ActCounted.event.ts"
import * as ImportState from "../Import/Import.state.ts"
import { ImportEvent } from "../Import/events/ImportEvent.union.ts"
import { CUT, MOST_BELOW, seal } from "../Row/Level.schema.ts"
import * as RowState from "../Row/Row.state.ts"
import * as RowDecided from "../Row/RowDecided.event.ts"
import * as DecideRow from "./DecideRow.command.ts"
import { changesNothing, sawIt } from "./DecideRow.command.ts"

/** What `Deciding` reads, before a step or after it: the import, and the row. */
type States = { readonly life: ImportState.State; readonly row: RowState.State }
/** One step `Deciding` takes: the states it read, the command, the events it recorded, and the states after. */
type Step = {
  readonly before: States
  readonly after: States
  readonly command: DecideRow.Command
  readonly events: ReadonlyArray<RowDecided.Event | ActCounted.Event>
}
/** A rule of every step, answered from the step alone. */
type Rule = (step: Step) => boolean
/** A rule of every step that asks who is acting. */
type Asked = (step: Step) => Effect.Effect<boolean, never, CurrentActor>

/**
 * A row is decided only on an import that is open.
 *
 * @category rules
 * @since 0.0.0
 */
export const ARowIsDecidedOnlyOnAnOpenImport: Rule = ({ before }) => ImportState.guards.Open(before.life)

/**
 * An act is taken only in the opening it was made in: one made before a confirm is not taken after a reopen.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnActIsOfThisOpening: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.opening === before.life.confirms

/**
 * A row's act is made on a screen that has the import's last act on a group.
 *
 * @category rules
 * @since 0.0.0
 */
export const ARowsActSawTheLastGroupAct: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.sawGroup === before.life.lastGroup

/**
 * A decision is replaced only by an act whose sender saw it, by the number of the change that recorded it.
 *
 * @category rules
 * @since 0.0.0
 */
export const ADecisionIsReplacedOnlyByAnActThatSawIt: Rule = ({ before, command }) =>
  sawIt({ row: before.row, command })

/**
 * And only by one whose sender has the row's last undo: the change it took back names it.
 *
 * @category rules
 * @since 0.0.0
 */
export const ADecisionIsMadeOnAScreenThatHasTheRowsLastUndo: Rule = ({ before, command }) =>
  command.sawUndone === before.row.undone.change

/**
 * Whatever it decides, an act is made on the import's matching now; one made on an older matching is not
 * applied.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnActIsMadeOnTheMatchingNow: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.madeOn === before.life.matching

/**
 * An act that would leave the row's decision as it is records nothing: the row and the import are unchanged.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnActThatChangesNothingLeavesTheImport: Rule = ({ before, after, command }) =>
  !changesNothing({ row: before.row, command }) ||
  !ImportState.guards.Open(before.life) ||
  !ImportState.guards.Open(after.life) ||
  after.life.changes === before.life.changes

/**
 * And the row: a decided row still holds the change that recorded its decision.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnActThatChangesNothingLeavesTheRow: Rule = ({ before, after, command }) =>
  !changesNothing({ row: before.row, command }) ||
  !RowState.guards.Decided(before.row) ||
  !RowState.guards.Decided(after.row) ||
  after.row.change === before.row.change

/**
 * Any other act is recorded as its sender said, and gets the import's next number on the row and on the import.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnyOtherActIsRecorded: Rule = ({ before, after, command }) =>
  changesNothing({ row: before.row, command }) || RowState.guards.Decided(after.row)

/**
 * A recorded act holds its sender's text: the row's flags are the command's.
 *
 * @category rules
 * @since 0.0.0
 */
export const WithItsText: Rule = ({ before, after, command }) =>
  changesNothing({ row: before.row, command }) ||
  !RowState.guards.Decided(after.row) ||
  after.row.flags === command.flags

/**
 * A recorded act holds the matching it was made on.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnItsMatching: Rule = ({ before, after, command }) =>
  changesNothing({ row: before.row, command }) ||
  !RowState.guards.Decided(after.row) ||
  after.row.madeOn === command.madeOn

/**
 * A recorded act holds the step it was pressed in.
 *
 * @category rules
 * @since 0.0.0
 */
export const UnderItsStep: Rule = ({ before, after, command }) =>
  changesNothing({ row: before.row, command }) || !RowState.guards.Decided(after.row) || after.row.step === command.step

/**
 * A recorded act is its sender's: the row's decision is by the member who acts.
 *
 * @category rules
 * @since 0.0.0
 */
export const AsItsSenders: Asked = Effect.fn("Deciding.AsItsSenders")(function* ({ before, after, command }) {
  if (changesNothing({ row: before.row, command }) || !RowState.guards.Decided(after.row)) return true
  const actor = yield* CurrentActor
  return after.row.by === actor.memberId
})

/**
 * A recorded act takes the import's next number: the import counts one change more.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndGetsTheNextNumber: Rule = ({ before, after, command }) =>
  changesNothing({ row: before.row, command }) ||
  !ImportState.guards.Open(before.life) ||
  !ImportState.guards.Open(after.life) ||
  after.life.changes === before.life.changes + 1

/**
 * The row's decision carries that same number: the change the import counted last.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnTheRowToo: Rule = ({ before, after, command }) =>
  changesNothing({ row: before.row, command }) ||
  !ImportState.guards.Open(after.life) ||
  !RowState.guards.Decided(after.row) ||
  after.row.change === after.life.changes

/**
 * The import's event says what the row now holds, and whose it is.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportsEventSaysWhichDecisionTheRowHolds: Rule = ({ after, events }) =>
  A.every(
    events,
    (e) => !ImportEvent.guards.ActCounted(e) || !RowState.guards.Decided(after.row) || e.holds === after.row.change
  )

/**
 * The import's event says whose the row's decision is.
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
 * The import's event says the text of the row's decision.
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
 * And who acted: the member who sent the act.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportsEventSaysWhoActed: Asked = Effect.fn("Deciding.TheImportsEventSaysWhoActed")(function* ({
  events
}) {
  const actor = yield* CurrentActor
  return A.every(events, (e) => !ImportEvent.guards.ActCounted(e) || e.actor === actor.memberId)
})

/**
 * The decision an act replaces is kept under it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AnActKeepsWhichDecisionItReplaces: Rule = ({ before, after, command }) =>
  !RowState.guards.Decided(before.row) ||
  changesNothing({ row: before.row, command }) ||
  !RowState.guards.Decided(after.row) ||
  after.row.under.change === before.row.change

/**
 * The decision kept under it is whose it was.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndWhose: Rule = ({ before, after, command }) =>
  !RowState.guards.Decided(before.row) ||
  changesNothing({ row: before.row, command }) ||
  !RowState.guards.Decided(after.row) ||
  after.row.under.by === before.row.by

/**
 * The decision kept under it keeps its text.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndItsText: Rule = ({ before, after, command }) =>
  !RowState.guards.Decided(before.row) ||
  changesNothing({ row: before.row, command }) ||
  !RowState.guards.Decided(after.row) ||
  after.row.under.flags === before.row.flags

/**
 * The decision kept under it keeps the matching it was made on.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndItsMatching: Rule = ({ before, after, command }) =>
  !RowState.guards.Decided(before.row) ||
  changesNothing({ row: before.row, command }) ||
  !RowState.guards.Decided(after.row) ||
  after.row.under.madeOn === before.row.madeOn

/**
 * What was below that stays below it, sealed, unless the history is let go.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndWhatWasBelowStaysBelow: Rule = ({ before, after, command }) =>
  !RowState.guards.Decided(before.row) ||
  changesNothing({ row: before.row, command }) ||
  !RowState.guards.Decided(after.row) ||
  after.row.below ===
    (before.row.under.change === 0
      ? ""
      : before.row.below.length > MOST_BELOW
        ? CUT
        : seal({ level: before.row.under, below: before.row.below }))

/**
 * Who may change a row. The row has no command of its own, so these are rules of the decisions that record on it. Once
 * an act has reached a row, only a member of the row's organization changes it. "Nobody clears another person's
 * decision" is the undo's rule and not stated here: an act always leaves a decision on the row, so it could not fail in
 * this decision. Who may replace one is the rule above: whoever saw it.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnlyItsOwnOrganizationChangesTheRow: Asked = Effect.fn("Deciding.OnlyItsOwnOrganizationChangesTheRow")(
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
export const AViewerChangesNoRow: Asked = Effect.fn("Deciding.AViewerChangesNoRow")(function* () {
  const actor = yield* CurrentActor
  return actor.role !== "viewer"
})
