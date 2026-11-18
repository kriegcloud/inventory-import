import { Array as Arr, Context, Effect, Layer, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"
import { OrganizationChoice, TestAccount } from "../api/v1/Identity.ts"
import { Member, MemberId, OrganizationId, Role } from "../domain/Identity.ts"

/** One membership row of a test account, as the database holds it. */
const AccountRow = Schema.Struct({
  userId: Schema.String,
  email: Schema.String,
  name: Schema.String,
  organizationName: Schema.String,
  role: Role
}).annotate({ description: "A test account's membership, read from user, member and organization." })

/**
 * People and their organizations. Only the identity seam reads it: unlike every other service, `all`, `findById`,
 * `findByUser`, `organizationsOf` and `testAccounts` are not scoped to one organization. `findByUser` turns a
 * signed-in user and their active organization into the member they act as (with no active organization, their
 * earliest membership); `inOrganization` lists one organization's people.
 */
export class Members extends Context.Service<
  Members,
  {
    readonly all: Effect.Effect<ReadonlyArray<Member>>
    findById(id: MemberId): Effect.Effect<Option.Option<Member>>
    findByUser(userId: string, organizationId: OrganizationId | null): Effect.Effect<Option.Option<Member>>
    inOrganization(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<Member>>
    /** The organizations a user belongs to, earliest membership first. */
    organizationsOf(userId: string): Effect.Effect<ReadonlyArray<OrganizationChoice>>
    /** Those of these users that have an account here, in the order given, each with their memberships. */
    testAccounts(userIds: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<TestAccount>>
  }
>()("takehome/server/Members") {
  static readonly layer = Layer.effect(
    Members,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      // The user's current name wins; `member.name` is the fallback for a member with no account.
      const select = sql`
        SELECT m.id, COALESCE(u.name, m.name) AS name, m.role, m.organizationId, o.name AS organizationName
        FROM member m JOIN organization o ON o.id = m.organizationId LEFT JOIN "user" u ON u.id = m.userId
      `

      const findAll = SqlSchema.findAll({
        Request: Schema.Void,
        Result: Member,
        execute: () => sql`${select} ORDER BY o.name, m.name`
      })

      const findOne = SqlSchema.findOneOption({
        Request: MemberId,
        Result: Member,
        execute: (id) => sql`${select} WHERE m.id = ${id}`
      })

      const findMembership = SqlSchema.findOneOption({
        Request: Schema.Struct({ userId: Schema.String, organizationId: Schema.NullOr(OrganizationId) }),
        Result: Member,
        execute: ({ organizationId, userId }) =>
          organizationId === null
            ? sql`${select} WHERE m.userId = ${userId} ORDER BY m.createdAt, m.id LIMIT 1`
            : sql`${select} WHERE m.userId = ${userId} AND m.organizationId = ${organizationId}`
      })

      const findInOrganization = SqlSchema.findAll({
        Request: OrganizationId,
        Result: Member,
        execute: (organizationId) => sql`${select} WHERE m.organizationId = ${organizationId} ORDER BY name`
      })

      const findOrganizations = SqlSchema.findAll({
        Request: Schema.String,
        Result: OrganizationChoice,
        execute: (userId) => sql`
          SELECT o.id, o.name FROM member m JOIN organization o ON o.id = m.organizationId
          WHERE m.userId = ${userId} ORDER BY m.createdAt, m.id`
      })

      const findAccounts = SqlSchema.findAll({
        Request: Schema.Array(Schema.String),
        Result: AccountRow,
        execute: (userIds) => sql`
          SELECT u.id AS userId, u.email, u.name, o.name AS organizationName, m.role
          FROM "user" u JOIN member m ON m.userId = u.id JOIN organization o ON o.id = m.organizationId
          WHERE u.id IN ${sql.in(userIds)}
          ORDER BY m.createdAt, m.id`
      })

      return Members.of({
        all: findAll(undefined).pipe(Effect.orDie, Effect.withSpan("Members.all")),
        findById: Effect.fn("Members.findById")(function* (id: MemberId) {
          return yield* findOne(id).pipe(Effect.orDie)
        }),
        findByUser: Effect.fn("Members.findByUser")(function* (userId: string, organizationId: OrganizationId | null) {
          return yield* findMembership({ userId, organizationId }).pipe(Effect.orDie)
        }),
        inOrganization: Effect.fn("Members.inOrganization")(function* (organizationId: OrganizationId) {
          return yield* findInOrganization(organizationId).pipe(Effect.orDie)
        }),
        organizationsOf: Effect.fn("Members.organizationsOf")(function* (userId: string) {
          return yield* findOrganizations(userId).pipe(Effect.orDie)
        }),
        testAccounts: Effect.fn("Members.testAccounts")(function* (userIds: ReadonlyArray<string>) {
          if (!Arr.isReadonlyArrayNonEmpty(userIds)) return []
          const rows = yield* findAccounts(Arr.copy(userIds)).pipe(Effect.orDie)
          // In the order asked for, each with its memberships, earliest first.
          return Arr.getSomes(
            Arr.map(userIds, (userId) => {
              const mine = Arr.filter(rows, (row) => row.userId === userId)
              return Option.map(Arr.head(mine), (first) =>
                TestAccount.make({
                  email: first.email,
                  name: first.name,
                  memberships: Arr.map(mine, (row) => ({ organizationName: row.organizationName, role: row.role }))
                })
              )
            })
          )
        })
      })
    })
  )
}
