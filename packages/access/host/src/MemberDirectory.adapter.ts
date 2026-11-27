/**
 * People and their organizations on D1, for the identity seam: the one adapter whose reads are not scoped to an
 * organization, because it is what finds the organization.
 *
 * @packageDocumentation
 */
import { AccountEmail, Membership, OrganizationChoice, TestAccount } from "@inventory/access-contract/SessionState"
import { MemberDirectory, type SignedInUser } from "@inventory/access-model/MemberDirectory"
import { MemberId, OrganizationId, UserId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import { DisplayName } from "@inventory/kernel/Text"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as SqlClient from "effect/sql/SqlClient"
import * as SqlSchema from "effect/sql/SqlSchema"

/** One membership row of a test account, as the database holds it. */
const AccountRow = S.Struct({
  userId: UserId,
  email: AccountEmail,
  name: DisplayName,
  organizationName: DisplayName,
  role: Role
}).annotate({ description: "A test account's membership, read from user, member and organization." })

/** A user and, when they chose one, the organization they act in. */
const Chosen = S.Struct({ userId: UserId, organizationId: S.OptionFromNullOr(OrganizationId) }).annotate({
  description: "A user and the organization they chose, or null for their earliest"
})

/** A member and the organization they are asked about. */
const MemberIn = S.Struct({ id: MemberId, organizationId: OrganizationId }).annotate({
  description: "A member's id and the organization a guarded read asks whether they are still in"
})

/**
 * `MemberDirectory` over `member`, `organization` and `user`.
 *
 * @category layers
 */
export const MemberDirectoryD1: Layer.Layer<MemberDirectory, never, SqlClient.SqlClient> = Layer.effect(
  MemberDirectory,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    // The user's current name wins; `member.name` is the fallback for a member with no account.
    const select = sql`
      SELECT m.id, COALESCE(u.name, m.name) AS name, m.role, m.organizationId, o.name AS organizationName
      FROM member m JOIN organization o ON o.id = m.organizationId LEFT JOIN "user" u ON u.id = m.userId
    `

    const findOne = SqlSchema.findOneOption({
      Request: MemberId,
      Result: Member,
      execute: (id) => sql`${select} WHERE m.id = ${id}`
    })

    const findMembership = SqlSchema.findOneOption({
      Request: Chosen,
      Result: Member,
      execute: ({ organizationId, userId }) => sql`${select}
        WHERE m.userId = ${userId} AND m.organizationId = coalesce(${organizationId}, m.organizationId)
        ORDER BY m.createdAt, m.id LIMIT 1`
    })

    // A removed member keeps their row, with `removedAt` set and no account: they are not in it any more.
    const findStillIn = SqlSchema.findOneOption({
      Request: MemberIn,
      Result: Member,
      execute: ({ id, organizationId }) =>
        sql`${select} WHERE m.id = ${id} AND m.organizationId = ${organizationId} AND m.removedAt IS NULL`
    })

    const findInOrganization = SqlSchema.findAll({
      Request: OrganizationId,
      Result: Member,
      execute: (organizationId) => sql`${select} WHERE m.organizationId = ${organizationId} ORDER BY name`
    })

    const findOrganizations = SqlSchema.findAll({
      Request: UserId,
      Result: OrganizationChoice,
      execute: (userId) => sql`
        SELECT o.id, o.name FROM member m JOIN organization o ON o.id = m.organizationId
        WHERE m.userId = ${userId} ORDER BY m.createdAt, m.id`
    })

    const findAccounts = SqlSchema.findAll({
      Request: S.Array(UserId),
      Result: AccountRow,
      execute: (userIds) => sql`
        SELECT u.id AS userId, u.email, u.name, o.name AS organizationName, m.role
        FROM "user" u JOIN member m ON m.userId = u.id JOIN organization o ON o.id = m.organizationId
        WHERE u.id IN ${sql.in(userIds)}
        ORDER BY m.createdAt, m.id`
    })

    return MemberDirectory.of({
      byId: Effect.fn("Members.findById")(function* (id: MemberId) {
        return yield* findOne(id).pipe(Effect.orDie)
      }),
      stillIn: Effect.fn("Members.stillIn")(function* (member: Pick<Member, "id" | "organizationId">) {
        return yield* findStillIn({ id: member.id, organizationId: member.organizationId }).pipe(Effect.orDie)
      }),
      actorFor: Effect.fn("Members.findByUser")(function* (user: SignedInUser) {
        return yield* findMembership({
          userId: user.userId,
          organizationId: user.active
        }).pipe(Effect.orDie)
      }),
      inOrganization: Effect.fn("Members.inOrganization")(function* (organizationId: OrganizationId) {
        return yield* findInOrganization(organizationId).pipe(Effect.orDie)
      }),
      organizationsOf: Effect.fn("Members.organizationsOf")(function* (userId: UserId) {
        return yield* findOrganizations(userId).pipe(Effect.orDie)
      }),
      testAccounts: Effect.fn("Members.testAccounts")(function* (userIds: ReadonlyArray<UserId>) {
        if (!A.isReadonlyArrayNonEmpty(userIds)) return []
        const rows = yield* findAccounts(A.copy(userIds)).pipe(Effect.orDie)
        // In the order asked for, each with its memberships, earliest first.
        return A.getSomes(
          A.map(userIds, (userId) => {
            const mine = A.filter(rows, (row) => row.userId === userId)
            return O.map(A.head(mine), (first) =>
              TestAccount.make({
                email: first.email,
                name: first.name,
                memberships: A.map(mine, (row) =>
                  Membership.make({ organizationName: row.organizationName, role: row.role })
                )
              })
            )
          })
        )
      })
    })
  })
)
