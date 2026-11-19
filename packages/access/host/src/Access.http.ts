/**
 * What each endpoint of the access context's three API groups does, as the objects the app hands to
 * `handlers.handleAll(...)`. The group's Layer is built in the app, against the assembled `Api`: its prefix and its
 * middleware make the group's type the app's own, so a function typed against this package's group does not fit it.
 * Each constructor resolves the ports once, when the group is built; an endpoint then needs only the actor, which
 * the identity middleware provides per request.
 *
 * @packageDocumentation
 */
import type { AddPerson, ChangeRole } from "@inventory/access-contract/PeopleCommand"
import { AuditTrailStore } from "@inventory/access-model/AuditTrailStore"
import { accessHandlers } from "@inventory/access-model/Handlers"
import { MemberDirectory } from "@inventory/access-model/MemberDirectory"
import { PeopleStore } from "@inventory/access-model/PeopleStore"
import { CurrentActor } from "@inventory/kernel/Actor"
import type { MemberId } from "@inventory/kernel/Ids"
import { Effect } from "effect"
import { SecureRandom } from "effect/crypto"
import { HttpServerRequest } from "effect/http"
import { Sessions } from "./SessionIdentity.adapter.ts"

/**
 * The identity group: the session answer (open), the people of the actor's organization and the actor.
 *
 * @category handlers
 */
export const identityEndpoints = Effect.gen(function* () {
  const sessions = yield* Sessions
  const directory = yield* MemberDirectory
  return {
    session: Effect.fn("identity.session")(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      return yield* sessions.state(new Headers(request.headers))
    }),
    members: Effect.fn("identity.members")(function* () {
      return yield* accessHandlers.membersOfActor().pipe(Effect.provideService(MemberDirectory, directory))
    }),
    me: Effect.fn("identity.me")(function* () {
      return yield* CurrentActor
    })
  }
})

/**
 * The people group. Every write starts with `requireRole("admin")`, in the handler it calls.
 *
 * @category handlers
 */
export const peopleEndpoints = Effect.gen(function* () {
  const ports = yield* Effect.context<PeopleStore | SecureRandom.SecureRandom>()
  return {
    list: Effect.fn("people.list")(function* () {
      return yield* accessHandlers.listPeople().pipe(Effect.provideContext(ports))
    }),
    add: Effect.fn("people.add")(function* (request: { readonly payload: AddPerson }) {
      return yield* accessHandlers.addPerson(request.payload).pipe(Effect.provideContext(ports))
    }),
    setRole: Effect.fn("people.setRole")(function* (request: {
      readonly params: { readonly memberId: MemberId }
      readonly payload: ChangeRole
    }) {
      return yield* accessHandlers
        .changeRole({ member: request.params.memberId, command: request.payload })
        .pipe(Effect.provideContext(ports))
    }),
    remove: Effect.fn("people.remove")(function* (request: { readonly params: { readonly memberId: MemberId } }) {
      return yield* accessHandlers.removePerson(request.params.memberId).pipe(Effect.provideContext(ports))
    })
  }
})

/**
 * The activity group: the audit trail of the actor's organization.
 *
 * @category handlers
 */
export const activityEndpoints = Effect.gen(function* () {
  const store = yield* AuditTrailStore
  return {
    recent: Effect.fn("activity.recent")(function* () {
      return yield* accessHandlers.recentActivity().pipe(Effect.provideService(AuditTrailStore, store))
    })
  }
})

/**
 * How many audit lines the actor's organization has, for the system status: its proof that the database answers
 * for this tenant. Resolved once, like the endpoints.
 *
 * @category handlers
 */
export const activityCount = Effect.gen(function* () {
  const store = yield* AuditTrailStore
  return Effect.fn("activity.count")(function* () {
    return yield* accessHandlers.activityCount().pipe(Effect.provideService(AuditTrailStore, store))
  })
})
