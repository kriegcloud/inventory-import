// The rules of every step of an act on a group: what a decision may make of the state before it. Each is written as
// it was in the aggregate's file, with its type on its name: the lock keeps a rule's text, and this is that text.
import * as GroupState from "./Group.state.ts"

/** One step of a group: the states around what a decision recorded on it. */
type Step = { readonly before: GroupState.State; readonly after: GroupState.State }
/** A rule of every step, answered from the step alone. */
type Rule = (step: Step) => boolean

/**
 * A decided group keeps the rows it names. What a group decided never changes: its rows, what it does to them, its
 * number, whose it is.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupKeepsItsRows: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before) || !GroupState.guards.Decided(after) || after.rows === before.rows

/**
 * A decided group keeps how many rows it says it covers.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupKeepsItsCount: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before) || !GroupState.guards.Decided(after) || after.count === before.count

/**
 * A decided group keeps what it does to each of its rows.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupKeepsItsPatch: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before) || !GroupState.guards.Decided(after) || after.patch === before.patch

/**
 * A decided group keeps the number of the change that recorded it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupKeepsItsNumber: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before) || !GroupState.guards.Decided(after) || after.change === before.change

/**
 * A decided group keeps which group was the last in force on the import when it was decided.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupKeepsWhatWasUnderIt: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before) || !GroupState.guards.Decided(after) || after.under === before.under

/**
 * A decided group keeps the member who made it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupKeepsItsMaker: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before) || !GroupState.guards.Decided(after) || after.by === before.by

/**
 * A decided group stays decided: no step makes it untouched again, and taking it back only sets `undoneAt`.
 *
 * @category rules
 * @since 0.0.0
 */
export const ADecidedGroupStaysDecided: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before) || GroupState.guards.Decided(after)

/**
 * A group taken back stays so: once `undoneAt` names a change, no step changes it.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupTakenBackStaysTakenBack: Rule = ({ before, after }) =>
  !GroupState.guards.Decided(before) ||
  !GroupState.guards.Decided(after) ||
  before.undoneAt === 0 ||
  after.undoneAt === before.undoneAt

/**
 * A group an act was decided for keeps its import and its organization: no step between two decided states changes
 * either.
 *
 * @category rules
 * @since 0.0.0
 */
export const AGroupNeverChangesImportOrOrganization: Rule = ({ before, after }) =>
  GroupState.guards.Untouched(before) ||
  GroupState.guards.Untouched(after) ||
  (before.organizationId === after.organizationId && before.importId === after.importId)
