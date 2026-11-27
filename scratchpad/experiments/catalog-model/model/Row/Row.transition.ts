// The rules of every step of a row: what a decision may make of the state before it. Each is written as it was in
// the aggregate's file, with its type on its name: the lock keeps a rule's text, and this is that text.
import * as RowState from "./Row.state.ts"

/** One step of a row: the states around what a decision recorded on it. */
type Step = { readonly before: RowState.State; readonly after: RowState.State }
/** A rule of every step, answered from the step alone. */
type Rule = (step: Step) => boolean

/**
 * A row has no decision again only when nothing was under the one taken back.
 *
 * @category rules
 * @since 0.0.0
 */
export const ARowIsUndecidedOnlyWhenNothingWasUnder: Rule = ({ before, after }) =>
  !RowState.guards.Decided(before) || !RowState.guards.Undecided(after) || before.under.change === 0

/**
 * A row an act has reached keeps its import and its organization: no step between two reached states changes either.
 *
 * @category rules
 * @since 0.0.0
 */
export const ARowNeverChangesImportOrOrganization: Rule = ({ before, after }) =>
  RowState.guards.Untouched(before) ||
  RowState.guards.Untouched(after) ||
  (before.organizationId === after.organizationId && before.importId === after.importId)
