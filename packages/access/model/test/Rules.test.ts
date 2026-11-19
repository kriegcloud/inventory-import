// The last-admin rule, by property and by case, and the purity type that keeps handlers on the ports.
import { describe, expect, it } from "@effect/vitest"
import { handlersOf } from "@inventory/access-model/Ports"
import { type AdminCandidate, keepsAnAdmin } from "@inventory/access-model/LastAdmin"
import { listPeople } from "@inventory/access-model/PeopleHandler"
import { MemberId } from "@inventory/kernel/Ids"
import { Role } from "@inventory/kernel/Role"
import { Context, Effect } from "effect"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 100 } }
const Candidates = S.Array(S.Struct({ role: Role, linked: S.Boolean })).check(S.isMinLength(1), S.isMaxLength(6))
const NextRole = S.Option(Role)
const named = (rows: typeof Candidates.Type): ReadonlyArray<AdminCandidate> =>
  A.map(rows, (row, index) => ({ memberId: MemberId.make(`mem_${index}`), role: row.role, linked: row.linked }))
const admins = (members: ReadonlyArray<AdminCandidate>) =>
  A.filter(members, (member) => member.role === "admin" && member.linked).length

describe("keepsAnAdmin", () => {
  it.prop(
    "a change it allows never takes the last admin who can sign in",
    [Arbitrary.schema(Candidates), Arbitrary.schema(NextRole)],
    ([rows, next]) => {
      const members = named(rows)
      const member = MemberId.make("mem_0")
      const after = A.filter(
        A.map(members, (each) =>
          each.memberId === member ? O.map(next, (role) => ({ ...each, role })) : O.some(each)
        ),
        O.isSome
      )
      const allowed = keepsAnAdmin({ members, member, next })
      if (allowed && admins(members) > 0) expect(admins(A.getSomes(after))).toBeGreaterThan(0)
    },
    runs
  )

  it("a member who is not an admin can always change or go; the only admin cannot", () => {
    const dana = MemberId.make("mem_dana")
    const sam = MemberId.make("mem_sam")
    const one: ReadonlyArray<AdminCandidate> = [
      { memberId: dana, role: "admin", linked: true },
      { memberId: sam, role: "editor", linked: true }
    ]
    expect(keepsAnAdmin({ members: one, member: sam, next: O.none() })).toBe(true)
    expect(keepsAnAdmin({ members: one, member: dana, next: O.some("editor") })).toBe(false)
    expect(keepsAnAdmin({ members: one, member: dana, next: O.none() })).toBe(false)
    expect(keepsAnAdmin({ members: one, member: dana, next: O.some("admin") })).toBe(true)
    // A second admin with no account cannot sign in, so does not count.
    const unlinked: ReadonlyArray<AdminCandidate> = [
      ...one,
      { memberId: MemberId.make("mem_x"), role: "admin", linked: false }
    ]
    expect(keepsAnAdmin({ members: unlinked, member: dana, next: O.none() })).toBe(false)
  })
})

describe("handlersOf", () => {
  class Elsewhere extends Context.Service<Elsewhere, { readonly n: number }>()(
    "@inventory/access-model/test/Rules.test/Elsewhere"
  ) {}
  const outside = Effect.fnUntraced(function* () {
    const elsewhere = yield* Elsewhere
    return elsewhere.n
  })
  /** Whether `handlersOf` takes these handlers, decided by the compiler. */
  type Fits<Handlers> = [Handlers] extends [Parameters<typeof handlersOf>[0]] ? "fits" : "refused"

  it("takes a handler that stays on the ports, and refuses one that reaches for another service", () => {
    // Each line compiles only with the word the type gives: swap them and the check fails.
    const onThePorts: Fits<{ readonly listPeople: typeof listPeople }> = "fits"
    const reachesOut: Fits<{ readonly outside: typeof outside }> = "refused"
    expect([onThePorts, reachesOut]).toEqual(["fits", "refused"])
    expect(R.keys(handlersOf({ listPeople }))).toEqual(["listPeople"])
  })
})
