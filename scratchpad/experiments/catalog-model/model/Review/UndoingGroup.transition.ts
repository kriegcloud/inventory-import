// The rules of every step `UndoingGroup` takes. Each is written as it was in the decision's file, with its type on its
// name: the lock keeps a rule's text, and this is that text.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import * as GroupState from "../Group/Group.state.ts"
import * as GroupUndone from "../Group/GroupUndone.event.ts"
import * as GroupCounted from "../Import/events/GroupCounted.event.ts"
import * as ImportState from "../Import/Import.state.ts"
import { ImportEvent } from "../Import/events/ImportEvent.union.ts"
import * as UndoGroup from "./UndoGroup.command.ts"

/** What `UndoingGroup` reads, before a step or after it: the import, and the group. */
type States = { readonly life: ImportState.State; readonly group: GroupState.State }
/** One step `UndoingGroup` takes: the states it read, the command, the events it recorded, and the states after. */
type Step = {
  readonly before: States
  readonly after: States
  readonly command: UndoGroup.Command
  readonly events: ReadonlyArray<GroupUndone.Event | GroupCounted.Event>
}
/** A rule of every step, answered from the step alone. */
type Rule = (step: Step) => boolean
/** A rule of every step that asks who is acting. */
type Asked = (step: Step) => Effect.Effect<boolean, never, CurrentActor>

/**
 * A group's undo is taken only on an open import, of a decided group that `undo` recorded and its sender made.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupsUndoTakesBackOnlyItsSendersOwn: Asked = Effect.fn(
  "UndoingGroup.AGroupsUndoTakesBackOnlyItsSendersOwn"
)(function* ({ before, command }) {
  if (!ImportState.guards.Open(before.life) || !GroupState.guards.Decided(before.group)) return false
  const actor = yield* CurrentActor
  return before.group.change === command.undo && actor.memberId === before.group.by
})

/**
 * A group's undo is taken only in the opening it was made in: one made before a confirm is not taken after a reopen.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupsUndoIsOfThisOpening: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.opening === before.life.confirms

/**
 * It is an undo of a group of the import it names: the group's key is built from the import's id and the step,
 * and two pairs can build the same key.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupsUndoIsOfAGroupOfTheImportItNames: Rule = ({ before, command }) =>
  GroupState.guards.Decided(before.group) && before.group.importId === command.importId

/**
 * Only the last group still in force is taken back; then the one that was under it is the last in force.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnlyTheLastGroupInForceIsTakenBack: Rule = ({ before }) =>
  ImportState.guards.Open(before.life) &&
  GroupState.guards.Decided(before.group) &&
  before.group.change === before.life.topGroup

/**
 * Then the group that was under it is the import's last group in force.
 *
 * @category rules
 * @since 0.0.0
 */
export const ThenTheOneUnderItIsTheLastInForce: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before.group) ||
  !ImportState.guards.Open(after.life) ||
  after.life.topGroup === before.group.under

/**
 * And only from a screen that has every change of the import, as a group is made on one.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupsUndoIsMadeOnEveryChange: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.seen === before.life.changes

/**
 * A group is taken back once: it is in force when its undo is taken.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupIsTakenBackOnce: Rule = ({ before }) =>
  GroupState.guards.Decided(before.group) && before.group.undoneAt === 0

/**
 * A group's undo does not reach past a confirm that stands: the group was recorded after it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupsUndoDoesNotReachPastAConfirm: Rule = ({ before }) =>
  ImportState.guards.Open(before.life) &&
  GroupState.guards.Decided(before.group) &&
  before.group.change > before.life.confirmedAt

/**
 * It is one change, whatever the number of rows, and the group says when.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupsUndoIsOneChange: Rule = ({ before, after }) =>
  ImportState.guards.Open(before.life) &&
  ImportState.guards.Open(after.life) &&
  after.life.changes === before.life.changes + 1

/**
 * The group's `undoneAt` is that change: the one the import counted last.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndTheGroupSaysWhen: Rule = ({ after }) =>
  !ImportState.guards.Open(after.life) ||
  !GroupState.guards.Decided(after.group) ||
  after.group.undoneAt === after.life.changes

/**
 * The import holds the undo as its last act on a group: `lastGroup` is the change it counted last.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportHoldsItAsItsLastGroupAct: Rule = ({ after }) =>
  !ImportState.guards.Open(after.life) || after.life.lastGroup === after.life.changes

/**
 * The import's event says how many rows the group covered: its count.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportsEventSaysHowManyRows: Rule = ({ before, events }) =>
  A.every(
    events,
    (e) =>
      !ImportEvent.guards.GroupCounted(e) || !GroupState.guards.Decided(before.group) || e.rows === before.group.count
  )

/**
 * Who may change a group. The group has no command of its own, so these are rules of the decisions that record
 * on it: only its maker takes it back, only its own organization changes it, and a viewer changes none.
 *
 * @category rules
 * @since 0.0.0
 */
export const NobodyUndoesAnotherPersonsGroup: Asked = Effect.fn("UndoingGroup.NobodyUndoesAnotherPersonsGroup")(
  function* ({ before, after }) {
    if (
      !GroupState.guards.Decided(before.group) ||
      !GroupState.guards.Decided(after.group) ||
      after.group.undoneAt === before.group.undoneAt
    ) {
      return true
    }
    const actor = yield* CurrentActor
    return actor.memberId === before.group.by
  }
)

/**
 * Once an act was decided for a group, only a member of the group's organization changes it.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnlyItsOwnOrganizationChangesTheGroup: Asked = Effect.fn(
  "UndoingGroup.OnlyItsOwnOrganizationChangesTheGroup"
)(function* ({ before }) {
  if (GroupState.guards.Untouched(before.group)) return true
  const actor = yield* CurrentActor
  return actor.organizationId === before.group.organizationId
})

/**
 * A viewer changes no group: the member who acts is not a viewer.
 *
 * @category rules
 * @since 0.0.0
 */
export const AViewerChangesNoGroup: Asked = Effect.fn("UndoingGroup.AViewerChangesNoGroup")(function* () {
  const actor = yield* CurrentActor
  return actor.role !== "viewer"
})
