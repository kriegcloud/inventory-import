// Two organizations and five people, as the app's seed has them, for the tests over the in-memory twins.
import type { AccessSeed, MemoryMembership } from "@inventory/access-model/Memory"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { MemberDirectory } from "@inventory/access-model/MemberDirectory"
import { CurrentActor } from "@inventory/kernel/Actor"
import { MemberId, OrganizationId, UserId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import type { Role } from "@inventory/kernel/Role"
import { DateTime, Effect } from "effect"
import * as O from "effect/Option"

const joined = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z")

const membership = (
  id: string,
  name: string,
  role: Role,
  organization: readonly [string, string],
  user: O.Option<string>
): MemoryMembership => ({
  member: Member.make({
    id: MemberId.make(id),
    name,
    role,
    organizationId: OrganizationId.make(organization[0]),
    organizationName: organization[1]
  }),
  userId: O.map(user, (userId) => UserId.make(userId)),
  joinedAt: O.some(joined),
  removed: false
})

const works = ["org_prairie", "Example Works (test)"] as const
const supply = ["org_northline", "Sample Supply Co. (test)"] as const

export const dana = membership("mem_dana", "Dana Whitfield", "admin", works, O.some("usr_dana"))
export const marcus = membership("mem_marcus", "Marcus Oyelaran", "editor", works, O.some("usr_marcus"))
/** Priya has no account: a member an import named, who cannot sign in. */
export const priya = membership("mem_priya", "Priya Raman", "viewer", works, O.none())
export const elena = membership("mem_elena", "Elena Sokolova", "admin", supply, O.some("usr_elena"))
export const danaAtSupply = membership("mem_dana_northline", "Dana Whitfield", "viewer", supply, O.some("usr_dana"))

const account = (userId: string, name: string, email: string) => ({
  userId: UserId.make(userId),
  name,
  email: AccountEmail.make(email)
})

export const seed: AccessSeed = {
  accounts: [
    account("usr_dana", "Dana Whitfield", "dana@example-works.test"),
    account("usr_marcus", "Marcus Oyelaran", "marcus@example-works.test"),
    account("usr_elena", "Elena Sokolova", "elena@sample-supply.test"),
    // Signed up with capitals, and in no organization yet.
    account("usr_sam", "Sam Okafor", "Sam@Example.test")
  ],
  memberships: [dana, marcus, priya, elena, danaAtSupply]
}

/**
 * Runs an effect as one of the seeded members, as the directory has them now: after a change of role the next
 * request acts with the new one, as a real request does.
 */
export const as =
  (who: MemoryMembership) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, CurrentActor> | MemberDirectory> =>
    Effect.flatMap(MemberDirectory, (directory) =>
      Effect.flatMap(directory.byId(who.member.id), (now) =>
        Effect.provideService(
          effect,
          CurrentActor,
          O.getOrElse(now, () => who.member)
        )
      )
    )
