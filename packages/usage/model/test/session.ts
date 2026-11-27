// The session the Api tests run behind: the server half of `Session`, which in a test reads who is signed in from one
// header naming a person below, and refuses a call with none or with a name it does not know. The hosted half is the
// kernel's session port, implemented once in the access context's host (Benjamin, 2026-11-26, "A port in the kernel").
// And the usage model in memory, with its view's `validate` over a member record the test keeps, in which a person can
// be removed.
import * as Domain from "@alchemy.run/domain"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { SessionLookup } from "@inventory/kernel/SessionLookup"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as Headers from "effect/http/Headers"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Ref from "effect/Ref"
import { type Actor, CurrentActor } from "../src/Actor/Actor.context.ts"
import { Session } from "../src/Actor/Session.middleware.ts"
import { AllowanceTodayLive } from "../src/Allowance/AllowanceToday.view.ts"
import { Usage } from "../src/Usage.model.ts"

/** Three people: an editor and a viewer of one organization, and an admin of another. */
export const ana: Actor = { organizationId: "org_prairie", memberId: "ana", role: "editor" }
export const vic: Actor = { organizationId: "org_prairie", memberId: "vic", role: "viewer" }
export const hal: Actor = { organizationId: "org_harbor", memberId: "hal", role: "admin" }

const people = HashMap.make(["ana", ana], ["vic", vic], ["hal", hal])

/** The header a test call names its person in. */
const header = "x-test-person"

/** The headers of a call made as `actor`. */
export const as = (actor: Actor) => ({ headers: { [header]: actor.memberId } })

/** `Session` as the tests run it: the person the header names, or `NotSignedIn`. */
export const SessionTest = Layer.succeed(Session, (effect, { headers }) =>
  O.match(
    O.flatMap(Headers.get(headers, header), (name) => HashMap.get(people, name)),
    {
      onNone: () => Effect.fail(NotSignedIn.make({ reason: "The test names no person of this model." })),
      onSome: (actor) => Effect.provideService(effect, CurrentActor, actor)
    }
  )
)

/** The member record as the kernel's `Member`, for a person the tests name: their ids and role, and made-up names. */
const recordOf = (member: { readonly id: string; readonly organizationId: string; readonly role: Actor["role"] }) =>
  Member.make({
    id: MemberId.make(member.id),
    name: `Member ${member.id}`,
    role: member.role,
    organizationId: OrganizationId.make(member.organizationId),
    organizationName: `Organization ${member.organizationId}`
  })

/**
 * The organization's record as the tests keep it: who is still in, and a way to remove somebody, which a guarded read
 * notices at its key's next change.
 */
export class Roster extends Context.Service<
  Roster,
  { readonly remove: (actor: Actor) => Effect.Effect<void>; readonly stillIn: Ref.Ref<HashSet.HashSet<string>> }
>()("@inventory/usage-model/test/session/Roster") {}

/** The three people of `people`, all still in, and nobody else. */
export const RosterTest = Layer.effect(
  Roster,
  Effect.gen(function* () {
    const stillIn = yield* Ref.make(people.pipe(HashMap.keys, HashSet.fromIterable))
    return Roster.of({
      stillIn,
      remove: Effect.fn("Roster.remove")(function* (actor: Actor) {
        yield* Ref.update(stillIn, HashSet.remove(actor.memberId))
      })
    })
  })
)

/** A refusal for every session a test asks to read: the test session names who acts. */
const noSession = Effect.fn("SessionLookup.verdictOf")(function* () {
  return yield* NotSignedIn.make({ reason: "The test reads no session." })
})

/**
 * The kernel's `SessionLookup` over `Roster`: a member is still in while the roster holds them, in the organization
 * the test named them in. Its `verdictOf` refuses every call: the test session (`SessionTest`) names who acts.
 */
export const SessionLookupTest = Layer.effect(
  SessionLookup,
  Effect.gen(function* () {
    const roster = yield* Roster
    return SessionLookup.of({
      verdictOf: noSession,
      memberNow: Effect.fn("SessionLookup.memberNow")(function* (asked) {
        const inNow = yield* Ref.get(roster.stillIn)
        return O.filter(
          HashMap.get(people, asked.id),
          (actor) => actor.organizationId === asked.organizationId && HashSet.has(inNow, actor.memberId)
        ).pipe(
          O.map((actor) => recordOf({ id: actor.memberId, organizationId: actor.organizationId, role: actor.role }))
        )
      })
    })
  })
)

/**
 * The kernel's `SessionLookup` for a story and for Verify, where any person may act and no read is guarded by a
 * session: every member asked about is still in. Its `verdictOf` refuses every call.
 */
export const EveryoneStillIn = Layer.succeed(
  SessionLookup,
  SessionLookup.of({
    verdictOf: noSession,
    memberNow: Effect.fn("SessionLookup.memberNow")(function* (asked) {
      return yield* Effect.succeedSome(recordOf({ ...asked, role: "viewer" }))
    })
  })
)

/** The view's `validate`, on a member record where everyone is still in: what a story and Verify are given. */
export const AllowanceTodayAnyone = AllowanceTodayLive.pipe(Layer.provide(EveryoneStillIn))

/** The usage model in memory, its view's `validate` given, and the test session in front of it. */
export const UsageTest = SessionTest.pipe(
  Layer.provideMerge(
    Usage.layer(AllowanceTodayLive).pipe(
      Layer.provide(Domain.InMemory),
      Layer.provide(SessionLookupTest),
      Layer.provideMerge(RosterTest)
    )
  )
)
