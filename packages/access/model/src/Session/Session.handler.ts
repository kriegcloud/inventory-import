/**
 * Who a request acts as, and the session answer the browser asks for once per page.
 *
 * @packageDocumentation
 */
import type { SignInFeatures } from "@inventory/access-contract/SessionState"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { CurrentActor } from "@inventory/kernel/Actor"
import { Effect } from "effect"
import * as O from "effect/Option"
import { MemberDirectory, type SignedInUser } from "./MemberDirectory.store.ts"
import { noActorSentence, sessionStateOf, signInSentence } from "./Session.rules.ts"

/**
 * The member a request acts as, or `NotSignedIn` with what to do: sign in, or join an organization. The identity
 * middleware's rule.
 *
 * @category handlers
 */
export const actorOf = Effect.fnUntraced(function* (user: O.Option<SignedInUser>) {
  if (O.isNone(user)) return yield* NotSignedIn.make({ reason: signInSentence })
  const directory = yield* MemberDirectory
  const member = yield* directory.actorFor(user.value)
  if (O.isNone(member)) {
    const chose = O.isSome(user.value.active)
    return yield* NotSignedIn.make({ reason: noActorSentence(chose) })
  }
  return member.value
})

/**
 * The session as the browser needs it, in one answer: the same membership rule as `actorOf`, never a failure.
 *
 * @category handlers
 */
export const sessionState = Effect.fnUntraced(function* (asked: {
  readonly user: O.Option<SignedInUser>
  readonly features: SignInFeatures
}) {
  if (O.isNone(asked.user)) {
    return sessionStateOf({ email: O.none(), actor: O.none(), organizations: [], features: asked.features })
  }
  const directory = yield* MemberDirectory
  const organizations = yield* directory.organizationsOf(asked.user.value.userId)
  const actor = yield* directory.actorFor(asked.user.value)
  return sessionStateOf({ email: O.some(asked.user.value.email), actor, organizations, features: asked.features })
})

/**
 * Every member of the actor's organization. Any member may read it.
 *
 * @category handlers
 */
export const membersOfActor = Effect.fnUntraced(function* () {
  const actor = yield* CurrentActor
  const directory = yield* MemberDirectory
  return yield* directory.inOrganization(actor.organizationId)
})
