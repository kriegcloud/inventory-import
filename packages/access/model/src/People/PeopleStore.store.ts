/**
 * Where an organization's people are read and changed. Every write carries its audit line, which is written in the
 * same atomic write as the change or not at all, and every write is scoped by that line's organization.
 *
 * @packageDocumentation
 */
import { Person } from "@inventory/access-contract/Person"
import type { AccountEmail } from "@inventory/access-contract/SessionState"
import type { Activity } from "@inventory/kernel/Activity"
import { type MemberId, type OrganizationId, UserId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import type { Role } from "@inventory/kernel/Role"
import { DisplayName } from "@inventory/kernel/Text"
import { Context, Effect, Layer, Ref } from "effect"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { $AccessModelId } from "../internal/identity.ts"
import { AccessMemoryRef, type AccessMemoryState, type MemoryMembership } from "../internal/memory.ts"
import { keepsAnAdmin } from "./LastAdmin.rules.ts"

const $I = $AccessModelId.create("People/PeopleStore")

/**
 * A sign-in account an email found: who to add, and the name they signed up with.
 *
 * @category schemas
 */
export class Account extends S.Opaque<Account, { readonly brand: unique symbol }>()(
  S.Struct({ userId: UserId, name: DisplayName }).pipe(
    $I.annoteSchema("Account", { description: "A sign-in account: who it is and the name they signed up with" })
  )
) {}

/**
 * What an add wrote: the person added, or nothing because the account is already a member (`existing` is them, none
 * if they left between the write and the read).
 *
 * @category schemas
 */
export const AddWrite = S.TaggedUnion({
  added: { person: Person },
  alreadyMember: { existing: S.Option(Person) }
}).pipe($I.annoteSchema("AddWrite", { description: "What an add wrote: the person, or that they were already there" }))

/**
 * The decoded value of `AddWrite`.
 *
 * @category models
 */
export type AddWrite = typeof AddWrite.Type

/**
 * What a change of role wrote: the person with the new role, nothing because it would leave no admin, or nothing
 * because the member is gone.
 *
 * @category schemas
 */
export const RoleWrite = S.TaggedUnion({ changed: { person: Person }, lastAdmin: {}, missing: {} }).pipe(
  $I.annoteSchema("RoleWrite", { description: "What a change of role wrote" })
)

/**
 * The decoded value of `RoleWrite`.
 *
 * @category models
 */
export type RoleWrite = typeof RoleWrite.Type

/**
 * What a removal wrote: the member removed, nothing because it would leave no admin, or nothing because they are gone.
 *
 * @category schemas
 */
export const RemoveWrite = S.TaggedUnion({ removed: {}, lastAdmin: {}, missing: {} }).pipe(
  $I.annoteSchema("RemoveWrite", { description: "What a removal wrote" })
)

/**
 * The decoded value of `RemoveWrite`.
 *
 * @category models
 */
export type RemoveWrite = typeof RemoveWrite.Type

/**
 * The members of an organization.
 *
 * @category ports
 */
export class PeopleStore extends Context.Service<
  PeopleStore,
  {
    /** Everyone in the organization, by name. */
    readonly list: (organization: OrganizationId) => Effect.Effect<ReadonlyArray<Person>>
    readonly find: (scope: {
      readonly organization: OrganizationId
      readonly member: MemberId
    }) => Effect.Effect<O.Option<Person>>
    /** The account that signed up with this email, matched whatever its case (the email given is lower-cased). */
    readonly accountByEmail: (email: AccountEmail) => Effect.Effect<O.Option<Account>>
    /** Adds the account as `member` with `role`; the audit line is written only if the member is. */
    readonly add: (write: {
      readonly member: MemberId
      readonly account: Account
      readonly role: Role
      readonly audit: Activity
    }) => Effect.Effect<AddWrite>
    /** Gives `member` the role, unless that would leave no admin; the audit line is written only if the role changed. */
    readonly setRole: (write: {
      readonly member: MemberId
      readonly role: Role
      readonly before: Role
      readonly audit: Activity
    }) => Effect.Effect<RoleWrite>
    /**
     * Removes `member`, unless that would leave no admin. The row stays (the audit trail and their imports point at
     * it); unlinking the account ends their access at once.
     */
    readonly remove: (write: { readonly member: MemberId; readonly audit: Activity }) => Effect.Effect<RemoveWrite>
  }
>()($I`PeopleStore`) {
  /** The people over the shared in-memory state, deciding the last-admin rule by `keepsAnAdmin`. */
  static readonly memory: Layer.Layer<PeopleStore, never, AccessMemoryRef> = Layer.effect(
    PeopleStore,
    Effect.gen(function* () {
      const ref = yield* AccessMemoryRef

      const personOf = (state: AccessMemoryState, row: MemoryMembership): Person => {
        const account = O.flatMap(row.userId, (userId) => A.findFirst(state.accounts, (a) => a.userId === userId))
        return Person.make({
          memberId: row.member.id,
          // The account's current name wins; the membership's own is the fallback for a member with no account.
          name: O.match(account, { onNone: () => row.member.name, onSome: (a) => a.name }),
          email: O.map(account, (a) => a.email),
          role: row.member.role,
          joinedAt: row.joinedAt
        })
      }
      const inOrganization = (state: AccessMemoryState, organization: OrganizationId) =>
        A.filter(state.memberships, (row) => !row.removed && row.member.organizationId === organization)
      const candidates = (state: AccessMemoryState, organization: OrganizationId) =>
        A.map(
          A.filter(state.memberships, (row) => row.member.organizationId === organization),
          (row) => ({ memberId: row.member.id, role: row.member.role, linked: O.isSome(row.userId) })
        )
      const found = (state: AccessMemoryState, organization: OrganizationId, member: MemberId) =>
        A.findFirst(inOrganization(state, organization), (row) => row.member.id === member)

      return PeopleStore.of({
        list: Effect.fn("PeopleStore.list")(function* (organization: OrganizationId) {
          const state = yield* Ref.get(ref)
          return A.map(inOrganization(state, organization), (row) => personOf(state, row))
        }),
        find: Effect.fn("PeopleStore.find")(function* (scope) {
          const state = yield* Ref.get(ref)
          return O.map(found(state, scope.organization, scope.member), (row) => personOf(state, row))
        }),
        accountByEmail: Effect.fn("PeopleStore.accountByEmail")(function* (email: AccountEmail) {
          const state = yield* Ref.get(ref)
          return O.map(
            A.findFirst(state.accounts, (account) => Str.toLowerCase(account.email) === email),
            (account) => Account.make({ userId: account.userId, name: account.name })
          )
        }),
        add: Effect.fn("PeopleStore.add")(function* (write) {
          const organization = write.audit.organizationId
          return yield* Ref.modify(ref, (state): readonly [AddWrite, AccessMemoryState] => {
            const mine = inOrganization(state, organization)
            const existing = A.findFirst(
              mine,
              (row) => O.isSome(row.userId) && row.userId.value === write.account.userId
            )
            if (O.isSome(existing)) {
              return [AddWrite.cases.alreadyMember.make({ existing: O.some(personOf(state, existing.value)) }), state]
            }
            const organizationName = O.match(
              A.findFirst(state.memberships, (row) => row.member.organizationId === organization),
              { onNone: () => write.audit.actorName, onSome: (row) => row.member.organizationName }
            )
            const row: MemoryMembership = {
              member: Member.make({
                id: write.member,
                name: write.account.name,
                role: write.role,
                organizationId: organization,
                organizationName
              }),
              userId: O.some(write.account.userId),
              joinedAt: O.some(write.audit.createdAt),
              removed: false
            }
            const next = {
              ...state,
              memberships: A.append(state.memberships, row),
              lines: A.append(state.lines, write.audit)
            }
            return [AddWrite.cases.added.make({ person: personOf(next, row) }), next]
          })
        }),
        setRole: Effect.fn("PeopleStore.setRole")(function* (write) {
          const organization = write.audit.organizationId
          return yield* Ref.modify(ref, (state): readonly [RoleWrite, AccessMemoryState] => {
            const row = found(state, organization, write.member)
            if (O.isNone(row)) return [RoleWrite.cases.missing.make({}), state]
            const allowed = keepsAnAdmin({
              members: candidates(state, organization),
              member: write.member,
              next: O.some(write.role)
            })
            if (!allowed) return [RoleWrite.cases.lastAdmin.make({}), state]
            const changed: MemoryMembership = {
              ...row.value,
              member: Member.make({ ...row.value.member, role: write.role })
            }
            const next = {
              ...state,
              memberships: A.map(state.memberships, (each) => (each === row.value ? changed : each)),
              // Asked for the role they have: nothing changed, so nothing is recorded.
              lines: write.before === write.role ? state.lines : A.append(state.lines, write.audit)
            }
            return [RoleWrite.cases.changed.make({ person: personOf(next, changed) }), next]
          })
        }),
        remove: Effect.fn("PeopleStore.remove")(function* (write) {
          const organization = write.audit.organizationId
          return yield* Ref.modify(ref, (state): readonly [RemoveWrite, AccessMemoryState] => {
            const row = found(state, organization, write.member)
            if (O.isNone(row)) return [RemoveWrite.cases.missing.make({}), state]
            const allowed = keepsAnAdmin({
              members: candidates(state, organization),
              member: write.member,
              next: O.none()
            })
            if (!allowed) return [RemoveWrite.cases.lastAdmin.make({}), state]
            const gone: MemoryMembership = { ...row.value, userId: O.none(), removed: true }
            return [
              RemoveWrite.cases.removed.make({}),
              {
                ...state,
                memberships: A.map(state.memberships, (each) => (each === row.value ? gone : each)),
                lines: A.append(state.lines, write.audit)
              }
            ]
          })
        })
      })
    })
  )
}
