/**
 * Who a signed-in user acts as. Only the identity seam reads it: unlike every other port, it is not scoped to one
 * organization, because it is what finds the organization.
 *
 * @packageDocumentation
 */
import { AccountEmail, Membership, OrganizationChoice, TestAccount } from "@inventory/access-contract/SessionState"
import { type MemberId, OrganizationId, UserId } from "@inventory/kernel/Ids"
import type { Member } from "@inventory/kernel/Member"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { $AccessModelId } from "../internal/identity.ts"
import { AccessMemoryRef, type AccessMemoryState, type MemoryMembership } from "../internal/memory.ts"

// Spans of this port are named `Members.<method>`, in memory as on D1: the names the traces have always carried.
const $I = $AccessModelId.create("Session/MemberDirectory")

/**
 * What a valid session says: whose it is, and the organization they last chose.
 *
 * @category schemas
 */
export class SignedInUser extends S.Opaque<SignedInUser, { readonly brand: unique symbol }>()(
  S.Struct({
    userId: UserId.pipe(S.annotateKey({ description: "Who signed in" })),
    email: AccountEmail.pipe(S.annotateKey({ description: "The email they signed in with" })),
    active: S.Option(OrganizationId).pipe(
      S.annotateKey({ description: "The organization they last chose. None until they choose one" })
    )
  }).pipe($I.annoteSchema("SignedInUser", { description: "What a valid session says: whose it is, and where" }))
) {}

/**
 * People and their organizations, for the identity seam.
 *
 * @category ports
 */
export class MemberDirectory extends Context.Service<
  MemberDirectory,
  {
    /**
     * The member a signed-in user acts as: in the organization they chose, or, with none chosen, their earliest
     * membership. Removed from the chosen one: none, so the session stays and the access does not.
     */
    readonly actorFor: (user: SignedInUser) => Effect.Effect<O.Option<Member>>
    /** The organizations a user belongs to, earliest membership first. */
    readonly organizationsOf: (user: UserId) => Effect.Effect<ReadonlyArray<OrganizationChoice>>
    /** One organization's people, by name. */
    readonly inOrganization: (organization: OrganizationId) => Effect.Effect<ReadonlyArray<Member>>
    /** Those of these users that have an account here, in the order given, each with their memberships. */
    readonly testAccounts: (users: ReadonlyArray<UserId>) => Effect.Effect<ReadonlyArray<TestAccount>>
    /** One member by id, whatever their organization: the test identity's lookup, where a header names the member. */
    readonly byId: (member: MemberId) => Effect.Effect<O.Option<Member>>
  }
>()($I`MemberDirectory`) {
  /** The directory over the shared in-memory state. */
  static readonly memory: Layer.Layer<MemberDirectory, never, AccessMemoryRef> = Layer.effect(
    MemberDirectory,
    Effect.gen(function* () {
      const ref = yield* AccessMemoryRef
      const current = (state: AccessMemoryState): ReadonlyArray<MemoryMembership> =>
        A.filter(state.memberships, (row) => !row.removed)
      const of = (state: AccessMemoryState, user: UserId): ReadonlyArray<MemoryMembership> =>
        A.filter(current(state), (row) => O.isSome(row.userId) && row.userId.value === user)
      return MemberDirectory.of({
        actorFor: Effect.fn("Members.findByUser")(function* (user: SignedInUser) {
          const state = yield* Ref.get(ref)
          const mine = of(state, user.userId)
          return O.match(user.active, {
            onNone: () => O.map(A.head(mine), (row) => row.member),
            onSome: (organization) =>
              O.map(
                A.findFirst(mine, (row) => row.member.organizationId === organization),
                (row) => row.member
              )
          })
        }),
        organizationsOf: Effect.fn("Members.organizationsOf")(function* (user: UserId) {
          const state = yield* Ref.get(ref)
          return A.map(of(state, user), (row) =>
            OrganizationChoice.make({ id: row.member.organizationId, name: row.member.organizationName })
          )
        }),
        inOrganization: Effect.fn("Members.inOrganization")(function* (organization: OrganizationId) {
          const state = yield* Ref.get(ref)
          return A.map(
            A.filter(state.memberships, (row) => row.member.organizationId === organization),
            (row) => row.member
          )
        }),
        testAccounts: Effect.fn("Members.testAccounts")(function* (users: ReadonlyArray<UserId>) {
          const state = yield* Ref.get(ref)
          return A.getSomes(
            A.map(users, (user) =>
              O.map(
                A.findFirst(state.accounts, (account) => account.userId === user),
                (account) =>
                  TestAccount.make({
                    email: account.email,
                    name: account.name,
                    memberships: A.map(of(state, user), (row) =>
                      Membership.make({ organizationName: row.member.organizationName, role: row.member.role })
                    )
                  })
              )
            )
          )
        }),
        byId: Effect.fn("Members.findById")(function* (member: MemberId) {
          const state = yield* Ref.get(ref)
          return O.map(
            A.findFirst(state.memberships, (row) => row.member.id === member),
            (row) => row.member
          )
        })
      })
    })
  )
}
