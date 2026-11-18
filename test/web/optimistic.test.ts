// The rule every optimistic write rolls back by (src/web/lib/rollback.ts, used by optimistic.ts), on a change of one
// value in a cached list: a member's role set at once, put back when the server refuses. Inputs are drawn from the
// app's Role schema.
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Schema } from "effect"
import { Role } from "../../src/domain/Identity.ts"
import { rollback } from "../../src/web/lib/rollback.ts"

type Person = { readonly memberId: string; readonly role: Role }

/** What a role change does to a cached list of members. */
const setRole = (list: ReadonlyArray<Person>, memberId: string, role: Role): ReadonlyArray<Person> =>
  Arr.map(list, (person) => (person.memberId === memberId ? { ...person, role } : person))

/** Its undo: that person's role as it was before, put into the list as it is now. */
const undoRole =
  (memberId: string) =>
  (now: ReadonlyArray<Person>, before: ReadonlyArray<Person>): ReadonlyArray<Person> => {
    const was = Arr.findFirst(before, (person) => person.memberId === memberId)
    return was._tag === "None" ? now : setRole(now, memberId, was.value.role)
  }

const people: ReadonlyArray<Person> = [
  { memberId: "mem_dana", role: "admin" },
  { memberId: "mem_marcus", role: "editor" },
  { memberId: "mem_priya", role: "viewer" }
]
const Member = Schema.Literals(["mem_dana", "mem_marcus", "mem_priya"])

describe("rolling back an optimistic write", () => {
  it.prop(
    "puts back the entry exactly as it was when nothing wrote to it since",
    { member: Member, role: Role },
    ({ member, role }) => {
      const written = setRole(people, member, role)
      expect(rollback({ before: people, written, now: written, undo: undoRole(member) })).toBe(people)
    }
  )

  it.prop(
    "takes out only its own change when another write came after it, which stays",
    { first: Member, second: Member, firstRole: Role, secondRole: Role },
    ({ first, second, firstRole, secondRole }) => {
      if (first === second) return
      const written = setRole(people, first, firstRole)
      const now = setRole(written, second, secondRole)
      // As if only the second write had been made.
      expect(rollback({ before: people, written, now, undo: undoRole(first) })).toEqual(
        setRole(people, second, secondRole)
      )
    }
  )

  it("leaves an entry dropped meanwhile dropped", () => {
    const written = setRole(people, "mem_priya", "editor")
    expect(rollback({ before: people, written, now: undefined, undo: undoRole("mem_priya") })).toBeUndefined()
  })
})
