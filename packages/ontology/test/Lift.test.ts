// The lift, `graphOf` and `threadGraph` (report 14 section 4), in memory. The seventeen triples of section 4.4 are
// asserted on the value `threadGraph()` returns, and every expected IRI is built from the vocabulary's `base` and
// namespace, never written out.
//
// The planted cases hold the lift to its marks: a copy of `Member` whose `role` mark is changed gives other triples,
// so a lift that wrote a grant for every member, whatever the mark said, fails here.
import { describe, expect, it } from "@effect/vitest"
import { RdfVocab } from "@beep/vocabulary/Rdf"
import { OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import { aboutClass, aboutPath, noTerm } from "@inventory/kernel/TermsPointer"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { linesOf, link, without } from "../src/Graph.schema.ts"
import { lift } from "../src/Lift.ts"
import { graphOf, threadContext, threadGraph, threadHandWritten, threadRows } from "../src/Thread.ts"
import { readTurtle } from "../src/Turtle.ts"

const type = `${RdfVocab.rdf.iri}type`

/** `Member`'s fields with one replaced, pointed at `inv:Member`: a struct handed to the lift in `Member`'s place. */
const memberWith = (fields: Partial<typeof Member.fields>) =>
  S.Struct({ ...Member.fields, ...fields }).pipe(S.annotate(aboutClass("inv:Member")))

/** The six triples section 4.2 gives one member, and the names its fixture triples use. */
const names = Effect.map(threadContext, ({ vocabulary }) => {
  const inv = (local: string) => `${vocabulary.namespace}${local}`
  const data = (organization: string, key: string, id: string) => `${vocabulary.base}/data/${organization}/${key}/${id}`
  const person = `${vocabulary.base}/fixture/Person/test_Ravi`
  const lifted = (organization: string, id: string, role: string) => {
    const member = data(organization, "Member", id)
    const grant = `${member}/role`
    return [
      link(member, type, inv("Member")),
      link(member, inv("membershipIn"), data(organization, "Tenant", organization)),
      link(grant, type, inv("Grant")),
      link(grant, inv("grantScope"), inv("GrantScopeKindScheme-organization")),
      link(grant, inv("grantedTo"), member),
      link(grant, inv("grantsRole"), inv(`MemberRoleScheme-${role}`))
    ]
  }
  const written = [
    link(person, type, inv("Person")),
    link(data("test_ExampleWorks", "Tenant", "test_ExampleWorks"), type, inv("Tenant")),
    link(data("test_SecondOrg", "Tenant", "test_SecondOrg"), type, inv("Tenant")),
    link(data("test_ExampleWorks", "Member", "test_RaviWorks"), inv("membershipOf"), person),
    link(data("test_SecondOrg", "Member", "test_RaviSecond"), inv("membershipOf"), person)
  ]
  return { inv, data, lifted, written }
})

const ravi = S.decodeEffect(Member)({
  id: "test_RaviWorks",
  name: "Ravi Example",
  role: "admin",
  organizationId: "test_ExampleWorks",
  organizationName: "Example Works (test)"
})

describe("the lift", () => {
  it.effect("gives one Member the six triples of section 4.2", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const member = yield* ravi
      const { lifted } = yield* names
      const triples = yield* lift(context, Member, member)
      expect(triples).toHaveLength(6)
      expect(linesOf(triples)).toStrictEqual(linesOf(lifted("test_ExampleWorks", "test_RaviWorks", "admin")))
    })
  )

  it.effect("writes no grant when role's mark says the field stands for no term", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const member = yield* ravi
      const { lifted } = yield* names
      const unmarked = memberWith({ role: Role.pipe(S.annotateKey(noTerm("screen"))) })
      const triples = yield* lift(context, unmarked, member)
      expect(linesOf(triples)).toStrictEqual(linesOf(A.take(lifted("test_ExampleWorks", "test_RaviWorks", "admin"), 2)))
    })
  )

  it.effect("follows the mark it is given: a path with no fixed scope and no reverse writes those triples", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const person = yield* ravi
      const { inv, data } = yield* names
      const other = memberWith({
        role: Role.pipe(
          S.annotateKey(
            aboutPath([{ property: "inv:grantedTo", node: "inv:Grant", fixed: [] }, { property: "inv:grantsRole" }])
          )
        )
      })
      const member = data("test_ExampleWorks", "Member", "test_RaviWorks")
      const triples = yield* lift(context, other, person)
      expect(linesOf(triples)).toStrictEqual(
        linesOf([
          link(member, type, inv("Member")),
          link(member, inv("membershipIn"), data("test_ExampleWorks", "Tenant", "test_ExampleWorks")),
          link(`${member}/role`, type, inv("Grant")),
          link(member, inv("grantedTo"), `${member}/role`),
          link(`${member}/role`, inv("grantsRole"), inv("MemberRoleScheme-admin"))
        ])
      )
    })
  )

  it.effect("refuses a record with a field it cannot follow, naming the field", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const member = yield* ravi
      const bare = memberWith({ name: S.String })
      const refusal = yield* Effect.flip(lift(context, bare, member))
      expect(refusal.field).toStrictEqual(O.some("name"))
    })
  )

  it.effect("refuses a record with no field naming the tenant: the thread does not lift one", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const member = yield* ravi
      const noTenant = memberWith({
        organizationId: OrganizationId.pipe(S.annotateKey(noTerm("screen")))
      })
      const refusal = yield* Effect.flip(lift(context, noTenant, member))
      expect(refusal.reason).toContain("0 fields name a property ranging over the tenant")
    })
  )
})

describe("the thread's graph", () => {
  it.effect("is the seventeen triples of section 4.4: twelve lifted, five hand-written", () =>
    Effect.gen(function* () {
      const { lifted, written } = yield* names
      const graph = yield* threadGraph()
      expect(graph).toHaveLength(17)
      expect(linesOf(graph)).toHaveLength(17)
      expect(linesOf(graph)).toStrictEqual(
        linesOf([
          ...lifted("test_ExampleWorks", "test_RaviWorks", "admin"),
          ...lifted("test_SecondOrg", "test_RaviSecond", "viewer"),
          ...written
        ])
      )
    })
  )

  it.effect("reads the hand-written fixture as its five triples", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const { written } = yield* names
      const read = yield* readTurtle(context.vocabulary.base, threadHandWritten)
      expect(linesOf(read)).toStrictEqual(linesOf(written))
    })
  )

  it.effect("less the hand-written triples, is what lift returns for the two decoded rows", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const graph = yield* threadGraph()
      const written = yield* readTurtle(context.vocabulary.base, threadHandWritten)
      const rows = yield* Effect.forEach(threadRows, (row) => S.decodeUnknownEffect(Member)(row), {
        concurrency: 1
      })
      const lifted = yield* Effect.forEach(rows, (row) => lift(context, Member, row), { concurrency: 1 })
      expect(linesOf(without(graph, written))).toStrictEqual(linesOf(A.flatten(lifted)))
    })
  )

  it.effect("refuses a row that is no Member, and a text that is no graph", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const badRow = yield* Effect.flip(graphOf(context, Member, [{ id: "test_x" }], threadHandWritten))
      expect(S.isSchemaError(badRow)).toBe(true)
      const blank = yield* Effect.flip(graphOf(context, Member, threadRows, "[] a <https://example.org/x> ."))
      expect(blank).toHaveProperty("_tag", "TurtleRefused")
      const broken = yield* Effect.flip(graphOf(context, Member, threadRows, "<a> <b"))
      expect(broken).toHaveProperty("_tag", "TurtleRefused")
    })
  )
})
