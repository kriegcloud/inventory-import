/**
 * Every handler of the access context, registered through `handlersOf`: this is where a handler that reaches past
 * the ports stops compiling. The host calls them from here.
 *
 * @packageDocumentation
 */
import { handlersOf } from "./Access.ports.ts"
import { activityCount, recentActivity } from "./Activity/Activity.handler.ts"
import { addPerson, changeRole, listPeople, removePerson } from "./People/People.handler.ts"
import { actorOf, membersOfActor, sessionState } from "./Session/Session.handler.ts"

/**
 * The access context's handlers, by name.
 *
 * @category handlers
 */
export const accessHandlers = handlersOf({
  listPeople,
  addPerson,
  changeRole,
  removePerson,
  actorOf,
  sessionState,
  membersOfActor,
  recentActivity,
  activityCount
})
