// Who may add, promote and remove people, checked through the real handlers and SQL. The users are written
// straight into the `user` table the way sign-up would, because this file is about membership, not passwords
// (those are in Auth.http.test.ts).
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import * as SqlClient from "effect/sql/SqlClient"
import { Api } from "../../src/api/v1/Api.ts"
import { AddPerson, ChangeRole } from "@inventory/access-contract/PeopleCommand"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { MemberId } from "@inventory/kernel/Ids"
import { as, TypedApp } from "./support/app.ts"

const signedUp = Effect.fn("signedUp")(function* (id: string, name: string, email: string, memberId: string | null) {
  const sql = yield* SqlClient.SqlClient
  yield* sql`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES (${id}, ${name}, ${email}, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
  if (memberId !== null) yield* sql`UPDATE member SET userId = ${id} WHERE id = ${memberId}`
}, Effect.orDie)

layer(TypedApp)("people", (it) => {
  it.effect("an admin adds a person who has signed up; nobody else can, and no organization loses its last admin", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["people", "activity"])
      yield* signedUp("usr_dana", "Dana Whitfield", "dana@example-works.test", "mem_dana")
      yield* signedUp("usr_marcus", "Marcus Oyelaran", "marcus@example-works.test", "mem_marcus")
      yield* signedUp("usr_sam", "Sam Okafor", "Sam@Example.test", null)
      const dana = as("mem_dana")

      // Everyone in the organization can see who is in it; only an admin can change it.
      const seen = yield* client.people.list().pipe(as("mem_priya"))
      expect(A.map(seen, (person) => [person.name, person.role, O.getOrNull(person.email)])).toEqual([
        ["Dana Whitfield", "admin", "dana@example-works.test"],
        ["Marcus Oyelaran", "editor", "marcus@example-works.test"],
        ["Priya Raman", "viewer", null]
      ])
      const add = { payload: AddPerson.make({ email: AccountEmail.make("sam@example.test"), role: "editor" }) }
      expect((yield* client.people.add(add).pipe(as("mem_priya"), Effect.flip))._tag).toBe("Forbidden")
      expect((yield* client.people.add(add).pipe(as("mem_marcus"), Effect.flip))._tag).toBe("Forbidden")

      // The email is matched whatever its case. An email nobody signed up with is refused in a sentence.
      const sam = yield* client.people.add(add).pipe(dana, Effect.flatMap(Effect.fromResult))
      expect([sam.name, sam.role, O.getOrNull(sam.email)]).toEqual(["Sam Okafor", "editor", "Sam@Example.test"])
      // Adding them again with the same role is the same add (a second press); with another role it is the email's
      // problem, answered as data the form shows.
      const again = yield* client.people.add(add).pipe(dana, Effect.flatMap(Effect.fromResult))
      expect(again).toEqual(sam)
      const otherRole = { payload: AddPerson.make({ email: AccountEmail.make("sam@example.test"), role: "viewer" }) }
      const refused = yield* client.people.add(otherRole).pipe(dana)
      expect(refused).toMatchObject({
        _tag: "Failure",
        failure: {
          kind: "alreadyMember",
          problem: "Sam Okafor is already in Example Works (test) as an editor.",
          todo: "Change their role in the list instead."
        }
      })
      // As typed, with spaces and capitals: the command's schema drops the spaces and lower-cases it, and the
      // sentence names it that way.
      const typed = yield* S.decodeEffect(AddPerson)({ email: "  Nobody@Example.test ", role: "viewer" })
      const unknown = yield* client.people.add({ payload: typed }).pipe(dana)
      expect(unknown).toMatchObject({
        _tag: "Failure",
        failure: {
          kind: "noAccount",
          problem: "Nobody has signed up with nobody@example.test yet.",
          todo: "Ask them to create an account, then add them here."
        }
      })

      // The only admin cannot be demoted or removed, by themselves or by anyone.
      const self = { params: { memberId: MemberId.make("mem_dana") } }
      expect(
        (yield* client.people
          .setRole({ ...self, payload: ChangeRole.make({ role: "editor" }) })
          .pipe(dana, Effect.flip))._tag
      ).toBe("LastAdmin")
      expect((yield* client.people.remove(self).pipe(dana, Effect.flip))._tag).toBe("LastAdmin")
      // With a second admin, the first can step down.
      const promoted = yield* client.people
        .setRole({ params: { memberId: sam.memberId }, payload: ChangeRole.make({ role: "admin" }) })
        .pipe(dana)
      expect(promoted.role).toBe("admin")
      const stepped = yield* client.people.setRole({ ...self, payload: ChangeRole.make({ role: "editor" }) }).pipe(dana)
      expect(stepped.role).toBe("editor")
      // Now Dana is an editor and can no longer manage people.
      expect(
        (yield* client.people.remove({ params: { memberId: MemberId.make("mem_priya") } }).pipe(dana, Effect.flip))._tag
      ).toBe("Forbidden")

      // Sam (now the admin) removes Marcus, who has not acted yet, and then Dana, whose name is on audit lines.
      // The lines stay; the people are gone from the list and their accounts no longer open this organization.
      const samIs = as(sam.memberId)
      yield* client.people.remove({ params: { memberId: MemberId.make("mem_marcus") } }).pipe(samIs)
      yield* client.people.remove({ params: { memberId: MemberId.make("mem_dana") } }).pipe(samIs)
      const left = yield* client.people.list().pipe(samIs)
      expect(A.map(left, (person) => person.name)).toEqual(["Priya Raman", "Sam Okafor"])
      const sql = yield* SqlClient.SqlClient
      const gone = yield* sql<{ userId: string | null; removedAt: string | null }>`
        SELECT userId, removedAt FROM member WHERE id = 'mem_dana'`.pipe(Effect.orDie)
      expect([gone[0]?.userId, gone[0]?.removedAt === null]).toEqual([null, false])
      // A removed member cannot be removed twice, and the last admin still cannot remove themselves.
      expect(
        (yield* client.people.remove({ params: { memberId: MemberId.make("mem_dana") } }).pipe(samIs, Effect.flip))._tag
      ).toBe("PersonNotFound")
      expect((yield* client.people.remove({ params: { memberId: sam.memberId } }).pipe(samIs, Effect.flip))._tag).toBe(
        "LastAdmin"
      )

      // Another organization's admin cannot see or touch these members.
      const elena = as("mem_elena")
      const theirs = yield* client.people.list().pipe(elena)
      expect(A.some(theirs, (person) => person.name === "Sam Okafor")).toBe(false)
      expect((yield* client.people.remove({ params: { memberId: sam.memberId } }).pipe(elena, Effect.flip))._tag).toBe(
        "PersonNotFound"
      )

      // Each change is in the audit trail, under the name of who made it.
      const trail = yield* client.activity.recent().pipe(samIs)
      expect(A.map(trail, (row) => [row.action, row.detail, row.actorName])).toEqual(
        expect.arrayContaining([
          ["Added a person", "Sam Okafor as editor", "Dana Whitfield"],
          ["Changed a role", "Sam Okafor: editor to admin", "Dana Whitfield"],
          ["Changed a role", "Dana Whitfield: admin to editor", "Dana Whitfield"]
        ])
      )
    })
  )
})
