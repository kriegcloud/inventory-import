// The rules of every step `DecidingGroup` takes. Each is written as it was in the decision's file, with its type on its
// name: the lock keeps a rule's text, and this is that text.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../Actor/Actor.context.ts"
import * as GroupState from "../Group/Group.state.ts"
import * as GroupDecided from "../Group/GroupDecided.event.ts"
import * as GroupCounted from "../Import/events/GroupCounted.event.ts"
import * as ImportState from "../Import/Import.state.ts"
import { ImportEvent } from "../Import/events/ImportEvent.union.ts"
import * as DecideGroup from "./DecideGroup.command.ts"

/** What `DecidingGroup` reads, before a step or after it: the import, and the group. */
type States = { readonly life: ImportState.State; readonly group: GroupState.State }
/** One step `DecidingGroup` takes: the states it read, the command, the events it recorded, and the states after. */
type Step = {
  readonly before: States
  readonly after: States
  readonly command: DecideGroup.Command
  readonly events: ReadonlyArray<GroupDecided.Event | GroupCounted.Event>
}
/** A rule of every step, answered from the step alone. */
type Rule = (step: Step) => boolean
/** A rule of every step that asks who is acting. */
type Asked = (step: Step) => Effect.Effect<boolean, never, CurrentActor>

/**
 * A group is decided only on an import that is open.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupIsDecidedOnlyOnAnOpenImport: Rule = ({ before }) => ImportState.guards.Open(before.life)

/**
 * A group is decided only in the opening it was made in: one made before a confirm is not taken after a reopen.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupIsOfThisOpening: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.opening === before.life.confirms

/**
 * Its screen had every change: the rows it names are the ones the act fits.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupIsMadeOnEveryChange: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.seen === before.life.changes

/**
 * A group is decided only on the import's matching now.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupIsMadeOnTheMatchingNow: Rule = ({ before, command }) =>
  ImportState.guards.Open(before.life) && command.madeOn === before.life.matching

/**
 * A step decides one group: the group it names was untouched before.
 *
 * @category rules
 * @since 0.0.0
 */
export const AStepDecidesOneGroup: Rule = ({ before }) => GroupState.guards.Untouched(before.group)

/**
 * It is recorded whole: every row it names, what it does to them, as its sender's, in force.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupIsRecorded: Rule = ({ after }) => GroupState.guards.Decided(after.group)

/**
 * The group recorded names the rows the command names.
 *
 * @category rules
 * @since 0.0.0
 */
export const WithEveryRowItNames: Rule = ({ after, command }) =>
  !GroupState.guards.Decided(after.group) || after.group.rows === command.rows

/**
 * The group recorded does to each row what the command says.
 *
 * @category rules
 * @since 0.0.0
 */
export const WithWhatItDoes: Rule = ({ after, command }) =>
  !GroupState.guards.Decided(after.group) || after.group.patch === command.patch

/**
 * The group recorded keeps the command's count of rows.
 *
 * @category rules
 * @since 0.0.0
 */
export const WithItsCount: Rule = ({ after, command }) =>
  !GroupState.guards.Decided(after.group) || after.group.count === command.count

/**
 * The group recorded holds the matching it was made on.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnItsMatching: Rule = ({ after, command }) =>
  !GroupState.guards.Decided(after.group) || after.group.madeOn === command.madeOn

/**
 * The group recorded is in force: its `undoneAt` is 0.
 *
 * @category rules
 * @since 0.0.0
 */
export const InForce: Rule = ({ after }) => !GroupState.guards.Decided(after.group) || after.group.undoneAt === 0

/**
 * The group recorded is its sender's: it is by the member who acts.
 *
 * @category rules
 * @since 0.0.0
 */
export const AsItsSenders: Asked = Effect.fn("DecidingGroup.AsItsSenders")(function* ({ after }) {
  if (!GroupState.guards.Decided(after.group)) return true
  const actor = yield* CurrentActor
  return after.group.by === actor.memberId
})

/**
 * It is one change of the import, whatever the number of its rows, with the same number on the group.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupIsOneChange: Rule = ({ before, after }) =>
  !ImportState.guards.Open(before.life) ||
  !ImportState.guards.Open(after.life) ||
  after.life.changes === before.life.changes + 1

/**
 * The group carries that same number: the change the import counted last.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnTheGroupToo: Rule = ({ after }) =>
  !ImportState.guards.Open(after.life) ||
  !GroupState.guards.Decided(after.group) ||
  after.group.change === after.life.changes

/**
 * The import holds it as its last act on a group: `lastGroup` is the change it counted last.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportHoldsItAsItsLastGroupAct: Rule = ({ after }) =>
  !ImportState.guards.Open(after.life) || after.life.lastGroup === after.life.changes

/**
 * It is now the last group in force, and keeps which one was before it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupDecidedIsTheLastInForce: Rule = ({ after }) =>
  !ImportState.guards.Open(after.life) || after.life.topGroup === after.life.changes

/**
 * The group keeps, as `under`, the import's last group in force before it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AndKeepsWhichOneWasBeforeIt: Rule = ({ before, after }) =>
  !ImportState.guards.Open(before.life) ||
  !GroupState.guards.Decided(after.group) ||
  after.group.under === before.life.topGroup

/**
 * The import's event says how many rows the group covers: the command's count.
 *
 * @category rules
 * @since 0.0.0
 */
export const TheImportsEventSaysHowManyRows: Rule = ({ command, events }) =>
  A.every(events, (e) => !ImportEvent.guards.GroupCounted(e) || e.rows === command.count)

/**
 * Who may change a group. The group has no command of its own, so these are rules of the decisions that record
 * on it: only its own organization changes it, and a viewer changes none. "Nobody undoes another person's
 * group" is the undo's rule and not stated here: deciding a group never takes one back, so it could not fail
 * in this decision.
 *
 * @category rules
 * @since 0.0.0
 */
export const OnlyItsOwnOrganizationChangesTheGroup: Asked = Effect.fn(
  "DecidingGroup.OnlyItsOwnOrganizationChangesTheGroup"
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
export const AViewerChangesNoGroup: Asked = Effect.fn("DecidingGroup.AViewerChangesNoGroup")(function* () {
  const actor = yield* CurrentActor
  return actor.role !== "viewer"
})
