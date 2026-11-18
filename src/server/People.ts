// Who is in an organization, and the three things an admin can do about it. Sign-in keeps people in the `user`
// table and memberships in `member` (shared with Better Auth's organization plugin); this file only reads and
// writes `member`, always inside the actor's own organization. The rule not to break: an organization never ends
// up without an admin, and the check and the write are one statement, so two admins demoting each other at the
// same moment cannot both succeed.
import { D1Client } from "@effect/sql-d1"
import { Context, DateTime, Effect, Layer, Option, Result, Schema, String as Str } from "effect"
import { SecureRandom } from "effect/crypto"
import { SqlClient, SqlSchema, type Statement } from "effect/sql"
import { LastAdmin, Person, PersonNotFound } from "../api/v1/People.ts"
import { AddPersonProblem, type Member, MemberId, OrganizationId, Role } from "../domain/Identity.ts"
import { batchOn, NoRows, statement } from "./Sql.ts"

const Scope = Schema.Struct({ org: OrganizationId, id: Schema.String }).annotate({
  description: "One member of one organization, by id"
})
const Ids = Schema.Array(Schema.Struct({ id: Schema.String })).annotate({ description: "The ids a write returned" })
/** Who is acting and where: every write here is scoped to the actor's organization and names them in the audit line. */
const Acting = { org: OrganizationId, actor: MemberId, name: Schema.String }

/** Data access for the members of an organization. */
export class People extends Context.Service<
  People,
  {
    list(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<Person>>
    /** Adds the person who signed up with `email` to the actor's organization. */
    add(actor: Member, email: string, role: Role): Effect.Effect<Result.Result<Person, AddPersonProblem>>
    setRole(actor: Member, memberId: string, role: Role): Effect.Effect<Person, PersonNotFound | LastAdmin>
    remove(actor: Member, memberId: string): Effect.Effect<void, PersonNotFound | LastAdmin>
  }
>()("inventory/server/People") {
  static readonly layer = Layer.effect(
    People,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const d1 = yield* D1Client.D1Client
      const batch = batchOn(d1)
      const random = yield* SecureRandom.SecureRandom
      const now = DateTime.now.pipe(Effect.map(DateTime.formatIso))

      const select = sql`SELECT m.id AS memberId, COALESCE(u.name, m.name) AS name, u.email AS email, m.role AS role,
          m.createdAt AS joinedAt
        FROM member m LEFT JOIN user u ON u.id = m.userId`
      const findAll = SqlSchema.findAll({
        Request: Schema.String,
        Result: Person,
        execute: (org) => sql`${select} WHERE m.organizationId = ${org} AND m.removedAt IS NULL ORDER BY name, m.id`
      })
      const findOne = SqlSchema.findOneOption({
        Request: Scope,
        Result: Person,
        execute: ({ org, id }) =>
          sql`${select} WHERE m.organizationId = ${org} AND m.id = ${id} AND m.removedAt IS NULL`
      })
      // Matched whatever its case, through the index on lower(email) (part 5 of migrations/0001_init.sql).
      const findUser = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: Schema.Struct({ id: Schema.String, name: Schema.String }),
        execute: (email) => sql`SELECT id, name FROM user WHERE lower(email) = ${email}`
      })
      const findMembership = SqlSchema.findOneOption({
        Request: Schema.Struct({ org: Schema.String, userId: Schema.String }),
        Result: Person,
        execute: ({ org, userId }) =>
          sql`${select} WHERE m.organizationId = ${org} AND m.userId = ${userId} AND m.removedAt IS NULL`
      })

      const acting = (actor: Member) => ({ org: actor.organizationId, actor: actor.id, name: actor.name })

      // The audit line of a change, written only when `guard` holds: the same condition as the change it records.
      const auditLine = (guard: (r: { readonly org: string; readonly member: string }) => Statement.Fragment) =>
        statement({
          Request: Schema.Struct({
            ...Acting,
            id: Schema.String,
            member: Schema.String,
            action: Schema.String,
            detail: Schema.String,
            at: Schema.String
          }),
          Result: NoRows,
          execute: (r) => sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
            SELECT ${r.id}, ${r.org}, ${r.actor}, ${r.name}, ${r.action}, ${r.detail}, ${r.at}
            WHERE ${guard(r)}`
        })

      // True while the organization would still have an admin other than this member.
      const anotherAdmin = (org: string, memberId: string) =>
        sql`EXISTS (SELECT 1 FROM member WHERE organizationId = ${org} AND role = 'admin' AND id != ${memberId}
          AND userId IS NOT NULL)`

      const insertMember = statement({
        Request: Schema.Struct({
          org: OrganizationId,
          id: Schema.String,
          userId: Schema.String,
          name: Schema.String,
          role: Role,
          at: Schema.String
        }),
        Result: Ids,
        execute: (r) => sql`INSERT INTO member (id, organizationId, userId, name, role, createdAt)
          VALUES (${r.id}, ${r.org}, ${r.userId}, ${r.name}, ${r.role}, ${r.at})
          ON CONFLICT (organizationId, userId) DO NOTHING RETURNING id`
      })
      const addedLine = auditLine(
        (r) => sql`EXISTS (SELECT 1 FROM member WHERE organizationId = ${r.org} AND id = ${r.member})`
      )

      const updateRole = statement({
        Request: Schema.Struct({ org: OrganizationId, member: Schema.String, role: Role }),
        Result: Ids,
        execute: (r) => sql`UPDATE member SET role = ${r.role}
          WHERE organizationId = ${r.org} AND id = ${r.member}
            AND (role != 'admin' OR ${r.role === "admin" ? sql`1 = 1` : anotherAdmin(r.org, r.member)})
          RETURNING id`
      })
      const roleLine = (role: Role, before: Role) =>
        auditLine(
          (
            r
          ) => sql`EXISTS (SELECT 1 FROM member WHERE organizationId = ${r.org} AND id = ${r.member} AND role = ${role})
            AND ${before} != ${role}`
        )

      // A member may be removed while they are not the last admin: the audit line and the removal share it.
      const removable = (r: { readonly org: string; readonly member: string }) =>
        sql`EXISTS (SELECT 1 FROM member WHERE organizationId = ${r.org} AND id = ${r.member} AND removedAt IS NULL
          AND (role != 'admin' OR ${anotherAdmin(r.org, r.member)}))`
      const removedLine = auditLine(removable)
      const unlinkMember = statement({
        Request: Schema.Struct({ org: OrganizationId, member: Schema.String, at: Schema.String }),
        Result: Ids,
        execute: (r) => sql`UPDATE member SET userId = NULL, removedAt = ${r.at}
          WHERE organizationId = ${r.org} AND id = ${r.member} AND removedAt IS NULL
            AND (role != 'admin' OR ${anotherAdmin(r.org, r.member)})
          RETURNING id`
      })

      const one = Effect.fn("People.one")(function* (organizationId: OrganizationId, memberId: string) {
        const found = yield* findOne({ org: organizationId, id: memberId }).pipe(Effect.orDie)
        if (Option.isNone(found)) {
          return yield* PersonNotFound.make({ reason: "That person is not a member of your organization." })
        }
        return found.value
      })

      const add = Effect.fn("People.add")(function* (actor: Member, email: string, role: Role) {
        const user = yield* findUser(Str.toLowerCase(email)).pipe(Effect.orDie)
        if (Option.isNone(user)) {
          return Result.fail(
            AddPersonProblem.make({
              kind: "noAccount",
              problem: `Nobody has signed up with ${email} yet.`,
              todo: "Ask them to create an account, then add them here."
            })
          )
        }
        const id = yield* random.uuidV4()
        const activityId = yield* random.uuidV4()
        const at = yield* now
        const org = actor.organizationId
        const [inserted] = yield* batch([
          insertMember({ org, id, userId: user.value.id, name: user.value.name, role, at }),
          addedLine({
            ...acting(actor),
            id: activityId,
            member: id,
            action: "Added a person",
            detail: `${user.value.name} as ${role}`,
            at
          })
        ]).pipe(Effect.orDie)
        if (inserted.length === 0) {
          // Already a member. Asked again for the role they have (a second press, a retry), that is the same add:
          // the person comes back and nothing is written. Asked for another role, it is a role change, made on purpose.
          const existing = yield* findMembership({ org, userId: user.value.id }).pipe(Effect.orDie)
          if (Option.isSome(existing) && existing.value.role === role) return Result.succeed(existing.value)
          return Result.fail(
            AddPersonProblem.make({
              kind: "alreadyMember",
              problem: `${user.value.name} is already in ${actor.organizationName}${Option.match(existing, { onNone: () => "", onSome: (p) => ` as ${p.role === "viewer" ? "a" : "an"} ${p.role}` })}.`,
              todo: "Change their role in the list instead."
            })
          )
        }
        return yield* one(org, id).pipe(Effect.map(Result.succeed), Effect.orDie)
      })

      const setRole = Effect.fn("People.setRole")(function* (actor: Member, memberId: string, role: Role) {
        const before = yield* one(actor.organizationId, memberId)
        const activityId = yield* random.uuidV4()
        const at = yield* now
        const org = actor.organizationId
        const [updated] = yield* batch([
          updateRole({ org, member: memberId, role }),
          roleLine(
            role,
            before.role
          )({
            ...acting(actor),
            id: activityId,
            member: memberId,
            action: "Changed a role",
            detail: `${before.name}: ${before.role} to ${role}`,
            at
          })
        ]).pipe(Effect.orDie)
        if (updated.length === 0) {
          return yield* LastAdmin.make({
            reason: `${before.name} is the only admin of ${actor.organizationName}. Make someone else an admin first.`
          })
        }
        return yield* one(org, memberId)
      })

      const remove = Effect.fn("People.remove")(function* (actor: Member, memberId: string) {
        const before = yield* one(actor.organizationId, memberId)
        const activityId = yield* random.uuidV4()
        const at = yield* now
        const org = actor.organizationId
        const [, unlinked] = yield* batch([
          // The audit line first, under the same condition as the removal, so it is written only if the removal is.
          removedLine({
            ...acting(actor),
            id: activityId,
            member: memberId,
            action: "Removed a person",
            detail: `${before.name} (${before.role})`,
            at
          }),
          // The row stays: the audit trail and the imports this person made point at it. Unlinking the account
          // ends their access at once; the stamp keeps them out of every list.
          unlinkMember({ org, member: memberId, at })
        ]).pipe(Effect.orDie)
        if (unlinked.length === 0) {
          return yield* LastAdmin.make({
            reason: `${before.name} is the only admin of ${actor.organizationName}. Make someone else an admin first.`
          })
        }
      })

      return People.of({
        add,
        setRole,
        remove,
        list: Effect.fn("People.list")(function* (organizationId: OrganizationId) {
          return yield* findAll(organizationId).pipe(Effect.orDie)
        })
      })
    })
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto))
}
