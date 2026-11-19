/**
 * An organization's people on D1. Sign-in keeps people in the `user` table and memberships in `member` (shared with
 * Better Auth's organization plugin); this adapter only reads and writes `member`, always inside the organization
 * its audit line names. The rule not to break: an organization never ends up without an admin, and the check and
 * the write are one statement, so two admins demoting each other at the same moment cannot both succeed.
 *
 * @packageDocumentation
 */
import { D1 } from "@beep/d1/D1"
import { Person } from "@inventory/access-contract/Person"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { Account, AddWrite, PeopleStore, RemoveWrite, RoleWrite } from "@inventory/access-model/PeopleStore"
import { MemberId, OrganizationId, UserId } from "@inventory/kernel/Ids"
import { Role } from "@inventory/kernel/Role"
import { DisplayName, Instant } from "@inventory/kernel/Text"
import { Effect, Layer, Option } from "effect"
import * as S from "effect/Schema"
import { SqlClient, SqlSchema } from "effect/sql"
import { auditLine } from "./internal/auditLine.ts"

const Scope = S.Struct({ org: OrganizationId, id: MemberId }).annotate({
  description: "One member of one organization, by id"
})
const Ids = S.Array(S.Struct({ id: S.String })).annotate({ description: "The ids a write returned" })

/**
 * `PeopleStore` over `member` and `user`, each write one atomic batch with its audit line.
 *
 * @category layers
 */
export const PeopleStoreD1: Layer.Layer<PeopleStore, never, SqlClient.SqlClient | D1> = Layer.effect(
  PeopleStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const { batch } = yield* D1

    const select = sql`SELECT m.id AS memberId, COALESCE(u.name, m.name) AS name, u.email AS email, m.role AS role,
        m.createdAt AS joinedAt
      FROM member m LEFT JOIN user u ON u.id = m.userId`
    const findAll = SqlSchema.findAll({
      Request: OrganizationId,
      Result: Person,
      execute: (org) => sql`${select} WHERE m.organizationId = ${org} AND m.removedAt IS NULL ORDER BY name, m.id`
    })
    const findOne = SqlSchema.findOneOption({
      Request: Scope,
      Result: Person,
      execute: ({ org, id }) => sql`${select} WHERE m.organizationId = ${org} AND m.id = ${id} AND m.removedAt IS NULL`
    })
    // Matched whatever its case, through the index on lower(email) (part 5 of the migration).
    const findUser = SqlSchema.findOneOption({
      Request: AccountEmail,
      Result: Account,
      execute: (email) => sql`SELECT id AS userId, name FROM user WHERE lower(email) = ${email}`
    })
    const findMembership = SqlSchema.findOneOption({
      Request: S.Struct({ org: OrganizationId, userId: UserId }),
      Result: Person,
      execute: ({ org, userId }) =>
        sql`${select} WHERE m.organizationId = ${org} AND m.userId = ${userId} AND m.removedAt IS NULL`
    })

    // True while the organization would still have an admin other than this member.
    const anotherAdmin = (org: string, memberId: string) =>
      sql`EXISTS (SELECT 1 FROM member WHERE organizationId = ${org} AND role = 'admin' AND id != ${memberId}
        AND userId IS NOT NULL)`

    const insertMember = D1.statement({
      Request: S.Struct({
        org: OrganizationId,
        id: MemberId,
        userId: UserId,
        name: DisplayName,
        role: Role,
        at: Instant
      }),
      Result: Ids,
      execute: (r) => sql`INSERT INTO member (id, organizationId, userId, name, role, createdAt)
        VALUES (${r.id}, ${r.org}, ${r.userId}, ${r.name}, ${r.role}, ${r.at})
        ON CONFLICT (organizationId, userId) DO NOTHING RETURNING id`
    })
    const addedLine = auditLine({
      sql,
      guard: (r) => sql`EXISTS (SELECT 1 FROM member WHERE organizationId = ${r.org} AND id = ${r.member})`
    })

    const updateRole = D1.statement({
      Request: S.Struct({ org: OrganizationId, member: MemberId, role: Role }),
      Result: Ids,
      execute: (r) => sql`UPDATE member SET role = ${r.role}
        WHERE organizationId = ${r.org} AND id = ${r.member}
          AND (role != 'admin' OR ${r.role === "admin" ? sql`1 = 1` : anotherAdmin(r.org, r.member)})
        RETURNING id`
    })
    const roleLine = (role: Role, before: Role) =>
      auditLine({
        sql,
        guard: (
          r
        ) => sql`EXISTS (SELECT 1 FROM member WHERE organizationId = ${r.org} AND id = ${r.member} AND role = ${role})
          AND ${before} != ${role}`
      })

    // A member may be removed while they are not the last admin: the audit line and the removal share it.
    const removable = (r: { readonly org: string; readonly member: string }) =>
      sql`EXISTS (SELECT 1 FROM member WHERE organizationId = ${r.org} AND id = ${r.member} AND removedAt IS NULL
        AND (role != 'admin' OR ${anotherAdmin(r.org, r.member)}))`
    const removedLine = auditLine({ sql, guard: removable })
    const unlinkMember = D1.statement({
      Request: S.Struct({ org: OrganizationId, member: MemberId, at: Instant }),
      Result: Ids,
      execute: (r) => sql`UPDATE member SET userId = NULL, removedAt = ${r.at}
        WHERE organizationId = ${r.org} AND id = ${r.member} AND removedAt IS NULL
          AND (role != 'admin' OR ${anotherAdmin(r.org, r.member)})
        RETURNING id`
    })

    const find = Effect.fn("People.one")(function* (scope: {
      readonly organization: OrganizationId
      readonly member: MemberId
    }) {
      return yield* findOne({ org: scope.organization, id: scope.member }).pipe(Effect.orDie)
    })

    return PeopleStore.of({
      find,
      list: Effect.fn("People.list")(function* (organization: OrganizationId) {
        return yield* findAll(organization).pipe(Effect.orDie)
      }),
      accountByEmail: Effect.fn("People.accountByEmail")(function* (email: AccountEmail) {
        return yield* findUser(email).pipe(Effect.orDie)
      }),
      add: Effect.fn("People.add")(function* (write) {
        const org = write.audit.organizationId
        const [inserted] = yield* batch([
          insertMember({
            org,
            id: write.member,
            userId: write.account.userId,
            name: write.account.name,
            role: write.role,
            at: write.audit.createdAt
          }),
          addedLine({ line: write.audit, member: write.member })
        ]).pipe(Effect.orDie)
        if (inserted.length === 0) {
          const existing = yield* findMembership({ org, userId: write.account.userId }).pipe(Effect.orDie)
          return AddWrite.cases.alreadyMember.make({ existing })
        }
        const person = yield* find({ organization: org, member: write.member })
        // Removed again between the write and the read: reported as a member who is no longer there.
        return Option.match(person, {
          onNone: (): AddWrite => AddWrite.cases.alreadyMember.make({ existing: Option.none() }),
          onSome: (added): AddWrite => AddWrite.cases.added.make({ person: added })
        })
      }),
      setRole: Effect.fn("People.setRole")(function* (write) {
        const org = write.audit.organizationId
        const [updated] = yield* batch([
          updateRole({ org, member: write.member, role: write.role }),
          roleLine(write.role, write.before)({ line: write.audit, member: write.member })
        ]).pipe(Effect.orDie)
        const person = yield* find({ organization: org, member: write.member })
        if (Option.isNone(person)) return RoleWrite.cases.missing.make({})
        return updated.length === 0
          ? RoleWrite.cases.lastAdmin.make({})
          : RoleWrite.cases.changed.make({ person: person.value })
      }),
      remove: Effect.fn("People.remove")(function* (write) {
        const org = write.audit.organizationId
        const [, unlinked] = yield* batch([
          // The audit line first, under the same condition as the removal, so it is written only if the removal is.
          removedLine({ line: write.audit, member: write.member }),
          // The row stays: the audit trail and the imports this person made point at it. Unlinking the account
          // ends their access at once; the stamp keeps them out of every list.
          unlinkMember({ org, member: write.member, at: write.audit.createdAt })
        ]).pipe(Effect.orDie)
        if (unlinked.length > 0) return RemoveWrite.cases.removed.make({})
        const still = yield* find({ organization: org, member: write.member })
        return Option.isSome(still) ? RemoveWrite.cases.lastAdmin.make({}) : RemoveWrite.cases.missing.make({})
      })
    })
  })
)
