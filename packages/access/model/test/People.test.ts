// Who may add, promote and remove people, over the in-memory twins: the rules the People page relies on. The same
// scenario runs on D1 through HTTP in the app's People.slow.test.ts.
import { describe, expect, layer } from "@effect/vitest"
import { AddPerson, ChangeRole } from "@inventory/access-contract/PeopleCommand"
import { accessMemory } from "@inventory/access-model/Memory"
import { addPerson, changeRole, listPeople, removePerson } from "@inventory/access-model/PeopleHandler"
import { recentActivity } from "@inventory/access-model/ActivityHandler"
import { actorOf } from "@inventory/access-model/SessionHandler"
import { SignedInUser } from "@inventory/access-model/MemberDirectory"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { OrganizationId, UserId } from "@inventory/kernel/Ids"
import { Effect, Layer } from "effect"
import { SecureRandom } from "effect/crypto"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { as, dana, elena, marcus, priya, seed } from "./support.ts"

const App = Layer.mergeAll(accessMemory(seed), SecureRandom.layerWebCrypto)
const add = (email: string, role: "viewer" | "editor" | "admin") =>
  Effect.flatMap(S.decodeEffect(AddPerson)({ email, role }), addPerson)
const tag = <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.flip(effect), (error) => error._tag)
/** Runs `effect` and expects what it answers. */
const reads = <A, E, R>(effect: Effect.Effect<A, E, R>, expected: unknown) =>
  Effect.map(effect, (answer) => {
    expect(answer).toEqual(expected)
  })
const lines = Effect.map(recentActivity(), (found) => A.map(found, (line) => `${line.action}: ${line.detail}`))

describe("people", () => {
  layer(App)("adding", (it) => {
    it.effect("everyone sees the list; only an admin adds, and an add is one audit line", () =>
      Effect.gen(function* () {
        const seen = yield* listPeople().pipe(as(priya))
        expect(A.map(seen, (person) => [person.name, person.role, O.getOrNull(person.email)])).toEqual([
          ["Dana Whitfield", "admin", "dana@example-works.test"],
          ["Marcus Oyelaran", "editor", "marcus@example-works.test"],
          ["Priya Raman", "viewer", null]
        ])
        yield* reads(tag(add("sam@example.test", "editor").pipe(as(priya))), "Forbidden")
        yield* reads(tag(add("sam@example.test", "editor").pipe(as(marcus))), "Forbidden")

        // Typed with spaces and capitals, found whatever the case the account was made with.
        const sam = yield* add("  SAM@example.TEST ", "editor").pipe(as(dana), Effect.flatMap(Effect.fromResult))
        expect([sam.name, sam.role, O.getOrNull(sam.email)]).toEqual(["Sam Okafor", "editor", "Sam@Example.test"])
        // A second press is the same add: the person comes back and nothing more is written.
        const again = yield* add("sam@example.test", "editor").pipe(as(dana), Effect.flatMap(Effect.fromResult))
        expect(again).toEqual(sam)
        yield* reads(lines.pipe(as(dana)), ["Added a person: Sam Okafor as editor"])

        const other = yield* add("sam@example.test", "viewer").pipe(as(dana))
        expect(Result.isFailure(other) ? other.failure : undefined).toMatchObject({
          kind: "alreadyMember",
          problem: "Sam Okafor is already in Example Works (test) as an editor.",
          todo: "Change their role in the list instead."
        })
        const nobody = yield* add(" Nobody@Example.test", "viewer").pipe(as(dana))
        expect(Result.isFailure(nobody) ? nobody.failure : undefined).toMatchObject({
          kind: "noAccount",
          problem: "Nobody has signed up with nobody@example.test yet.",
          todo: "Ask them to create an account, then add them here."
        })
        yield* reads(lines.pipe(as(dana)), ["Added a person: Sam Okafor as editor"])
        // The other organization saw none of it.
        yield* reads(lines.pipe(as(elena)), [])
      })
    )
  })

  layer(App)("the last admin", (it) => {
    it.effect("cannot be demoted or removed; with a second admin the first steps down", () =>
      Effect.gen(function* () {
        const role = (role: "viewer" | "editor" | "admin") => ChangeRole.make({ role })
        const self = dana.member.id
        yield* reads(tag(changeRole({ member: self, command: role("editor") }).pipe(as(dana))), "LastAdmin")
        yield* reads(tag(removePerson(self).pipe(as(dana))), "LastAdmin")
        // A refused change writes no audit line.
        yield* reads(lines.pipe(as(dana)), [])
        // Asked for the role they have, nothing changes and nothing is recorded.
        const same = yield* changeRole({ member: self, command: role("admin") }).pipe(as(dana))
        expect(same.role).toBe("admin")
        yield* reads(lines.pipe(as(dana)), [])

        const promoted = yield* changeRole({ member: marcus.member.id, command: role("admin") }).pipe(as(dana))
        expect(promoted.role).toBe("admin")
        const stepped = yield* changeRole({ member: self, command: role("editor") }).pipe(as(dana))
        expect(stepped.role).toBe("editor")
        // An admin who has no account does not count: Marcus is now the only admin who can sign in.
        yield* changeRole({ member: priya.member.id, command: role("admin") }).pipe(as(marcus))
        yield* reads(
          tag(changeRole({ member: marcus.member.id, command: role("viewer") }).pipe(as(marcus))),
          "LastAdmin"
        )

        // Dana is an editor now and can no longer manage people.
        yield* reads(tag(removePerson(priya.member.id).pipe(as(dana))), "Forbidden")

        yield* removePerson(self).pipe(as(marcus))
        const left = yield* listPeople().pipe(as(marcus))
        expect(A.map(left, (person) => person.name)).toEqual(["Marcus Oyelaran", "Priya Raman"])
        // Removed: their account no longer opens this organization, and they cannot be removed twice.
        const user = SignedInUser.make({
          userId: UserId.make("usr_dana"),
          email: AccountEmail.make("dana@example-works.test"),
          active: O.some(OrganizationId.make("org_prairie"))
        })
        const refused = yield* Effect.flip(actorOf(O.some(user)))
        expect(refused.reason).toBe("You are no longer a member of that organization.")
        yield* reads(tag(removePerson(self).pipe(as(marcus))), "PersonNotFound")
        yield* reads(lines.pipe(as(marcus)), [
          "Removed a person: Dana Whitfield (editor)",
          "Changed a role: Priya Raman: viewer to admin",
          "Changed a role: Dana Whitfield: admin to editor",
          "Changed a role: Marcus Oyelaran: editor to admin"
        ])
      })
    )
  })
})
