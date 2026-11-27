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
import { AddPerson, ChangeRole } from "@inventory/access-contract/PeoplePayload"
import { LastAdmin, PersonNotFound } from "@inventory/access-contract/PeopleRejection"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { Forbidden } from "@inventory/kernel/AccessError"
import { MemberId } from "@inventory/kernel/Ids"
import { as, TypedApp } from "./support/app.ts"

const signedUp = Effect.fn("signedUp")(function* (id: string, name: string, email: string, memberId: O.Option<string>) {
  const sql = yield* SqlClient.SqlClient
  yield* sql`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES (${id}, ${name}, ${email}, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
  yield* O.match(memberId, {
    onNone: () => Effect.void,
    onSome: (memberId) => sql`UPDATE member SET userId = ${id} WHERE id = ${memberId}`
  })
}, Effect.orDie)

/** Runs a request that must be refused, and checks that its refusal is one of `refusal`'s class. */
const refusedWith =
  (refusal: S.Top) =>
  <A, E, R>(request: Effect.Effect<A, E, R>) =>
    Effect.flip(request).pipe(Effect.map((error) => expect(S.is(refusal)(error)).toBe(true)))

layer(TypedApp)("people", (it) => {
  it.effect("an admin adds a person who has signed up; nobody else can, and no organization loses its last admin", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["people", "activity"])
      yield* signedUp("usr_dana", "Dana Whitfield", "dana@example-works.test", O.some("mem_dana"))
      yield* signedUp("usr_marcus", "Marcus Oyelaran", "marcus@example-works.test", O.some("mem_marcus"))
      yield* signedUp("usr_sam", "Sam Okafor", "Sam@Example.test", O.none())
      const dana = as("mem_dana")

      // Everyone in the organization can see who is in it; only an admin can change it.
      const seen = yield* client.people.list().pipe(as("mem_priya"))
      expect(A.map(seen, (person) => [person.name, person.role, person.email])).toEqual([
        ["Dana Whitfield", "admin", O.some("dana@example-works.test")],
        ["Marcus Oyelaran", "editor", O.some("marcus@example-works.test")],
        ["Priya Raman", "viewer", O.none()]
      ])
      const add = { payload: AddPerson.make({ email: AccountEmail.make("sam@example.test"), role: "editor" }) }
      yield* client.people.add(add).pipe(as("mem_priya"), refusedWith(Forbidden))
      yield* client.people.add(add).pipe(as("mem_marcus"), refusedWith(Forbidden))

      // The email is matched whatever its case. An email nobody signed up with is refused in a sentence.
      const sam = yield* client.people.add(add).pipe(dana, Effect.flatMap(Effect.fromResult))
      expect([sam.name, sam.role, sam.email]).toEqual(["Sam Okafor", "editor", O.some("Sam@Example.test")])
      // Adding them again with the same role is the same add (a second press); with another role it is the email's
      // problem, answered as data the form shows.
      const again = yield* client.people.add(add).pipe(dana, Effect.flatMap(Effect.fromResult))
      expect(again).toEqual(sam)
      const otherRole = { payload: AddPerson.make({ email: AccountEmail.make("sam@example.test"), role: "viewer" }) }
      const refused = yield* client.people.add(otherRole).pipe(dana, Effect.flatMap(Effect.fromResult), Effect.flip)
      expect(refused).toMatchObject({
        kind: "alreadyMember",
        problem: "Sam Okafor is already in Example Works (test) as an editor.",
        todo: "Change their role in the list instead."
      })
      // As typed, with spaces and capitals: the command's schema drops the spaces and lower-cases it, and the
      // sentence names it that way.
      const typed = yield* S.decodeEffect(AddPerson)({ email: "  Nobody@Example.test ", role: "viewer" })
      const unknown = yield* client.people
        .add({ payload: typed })
        .pipe(dana, Effect.flatMap(Effect.fromResult), Effect.flip)
      expect(unknown).toMatchObject({
        kind: "noAccount",
        problem: "Nobody has signed up with nobody@example.test yet.",
        todo: "Ask them to create an account, then add them here."
      })

      // The only admin cannot be demoted or removed, by themselves or by anyone.
      const self = { params: { memberId: MemberId.make("mem_dana") } }
      yield* client.people
        .setRole({ ...self, payload: ChangeRole.make({ role: "editor" }) })
        .pipe(dana, refusedWith(LastAdmin))
      yield* client.people.remove(self).pipe(dana, refusedWith(LastAdmin))
      // With a second admin, the first can step down.
      const promoted = yield* client.people
        .setRole({ params: { memberId: sam.memberId }, payload: ChangeRole.make({ role: "admin" }) })
        .pipe(dana)
      expect(promoted.role).toBe("admin")
      const stepped = yield* client.people.setRole({ ...self, payload: ChangeRole.make({ role: "editor" }) }).pipe(dana)
      expect(stepped.role).toBe("editor")
      // Now Dana is an editor and can no longer manage people.
      yield* client.people
        .remove({ params: { memberId: MemberId.make("mem_priya") } })
        .pipe(dana, refusedWith(Forbidden))

      // Sam (now the admin) removes Marcus, who has not acted yet, and then Dana, whose name is on audit lines.
      // The lines stay; the people are gone from the list and their accounts no longer open this organization.
      const samIs = as(sam.memberId)
      yield* client.people.remove({ params: { memberId: MemberId.make("mem_marcus") } }).pipe(samIs)
      yield* client.people.remove({ params: { memberId: MemberId.make("mem_dana") } }).pipe(samIs)
      const left = yield* client.people.list().pipe(samIs)
      expect(A.map(left, (person) => person.name)).toEqual(["Priya Raman", "Sam Okafor"])
      const sql = yield* SqlClient.SqlClient
      const gone = yield* sql<{ readonly userId: string | null; readonly removedAt: string | null }>`
        SELECT userId, removedAt FROM member WHERE id = 'mem_dana'`.pipe(Effect.orDie)
      expect(gone[0]?.userId).toBeNull()
      expect(gone[0]?.removedAt).not.toBeNull()
      // A removed member cannot be removed twice, and the last admin still cannot remove themselves.
      yield* client.people
        .remove({ params: { memberId: MemberId.make("mem_dana") } })
        .pipe(samIs, refusedWith(PersonNotFound))
      yield* client.people.remove({ params: { memberId: sam.memberId } }).pipe(samIs, refusedWith(LastAdmin))

      // Another organization's admin cannot see or touch these members.
      const elena = as("mem_elena")
      const theirs = yield* client.people.list().pipe(elena)
      expect(A.some(theirs, (person) => person.name === "Sam Okafor")).toBe(false)
      yield* client.people.remove({ params: { memberId: sam.memberId } }).pipe(elena, refusedWith(PersonNotFound))

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
