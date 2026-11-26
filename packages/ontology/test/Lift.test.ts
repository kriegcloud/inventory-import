// The lift, `graphOf` and `threadGraph` (report 14 section 4), in memory. The seventeen triples of section 4.4 are
// asserted on the value `threadGraph()` returns, and every expected IRI is built from the vocabulary's `base` and
// namespace, never written out.
//
// The planted cases hold the lift to its marks: a copy of `Member` whose `role` mark is changed gives other triples,
// so a lift that wrote a grant for every member, whatever the mark said, fails here.
//
// The literals (party slice, step 4): the kernel's `Activity` gives a string and an instant in its encoded ISO text;
// planted structs give an absent and a present `Option`, and a boolean on step 2's copy, since no record of the kernel
// has a boolean field; each value its datatype does not write is planted and refused. The People page's `Person`
// names no tenant, so its caller gives one beside the rows, and a tenant given to a record that names its own is
// refused (PLAN, "Choices made").
import { describe, expect, it } from "@effect/vitest"
import { assertSome } from "@effect/vitest/utils"
import { Vocabulary } from "@beep/vocabulary/Model"
import { pointerFor } from "@beep/vocabulary/Pointer"
import { RdfVocab } from "@beep/vocabulary/Rdf"
import { Person } from "@inventory/access-contract/Person"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import { aboutClass, aboutPath, aboutProperty, noTerm } from "@inventory/kernel/TermsPointer"
import { Instant } from "@inventory/kernel/Text"
import { absentAsNone, nullAsNone } from "@inventory/kernel/Wire"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { IriNode, linesOf, link, literal, without, type Triple } from "../src/Graph.schema.ts"
import { lift, type LiftContext } from "../src/Lift.ts"
import { graphOf, threadContext, threadGraph, threadHandWritten, threadRows } from "../src/Thread.ts"
import { readTurtle } from "../src/Turtle.ts"
import { constructsVocabulary } from "./support/constructs.ts"

const type = `${RdfVocab.rdf.iri}type`
const xsd = (local: string) => `${RdfVocab.xsd.iri}${local}`

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

/** An audit entry of the thread's tenant with the fields given beside its id and tenant: a struct planted in `Activity`'s place. */
const entryWith = (fields: S.Struct.Fields) =>
  S.Struct({
    id: ActivityId.pipe(S.annotateKey(aboutClass("inv:AuditEntry"))),
    organizationId: OrganizationId.pipe(S.annotateKey(aboutProperty("inv:inTenant"))),
    ...fields
  }).pipe(S.annotate(aboutClass("inv:AuditEntry")))

const entryId = "4f1c2a3b-5d6e-4f70-8a9b-0c1d2e3f4a5b"

/** The subject and tenant triples every planted entry gives, and the IRIs its literals hang on. */
const entryNames = Effect.map(names, ({ inv, data }) => {
  const entry = data("test_ExampleWorks", "AuditEntry", entryId)
  const head = [
    link(entry, type, inv("AuditEntry")),
    link(entry, inv("inTenant"), data("test_ExampleWorks", "Tenant", "test_ExampleWorks"))
  ]
  return { entry, head }
})

/** A planted entry lifted in the thread's context: its triples, or the lift's refusal. Its context and row always decode. */
const liftEntry = Effect.fn("liftEntry")(function* (fields: S.Struct.Fields, values: object) {
  const context = yield* Effect.orDie(threadContext)
  const record = entryWith(fields)
  const value = yield* Effect.orDie(
    S.decodeEffect(record)({ id: entryId, organizationId: "test_ExampleWorks", ...values })
  )
  return yield* lift(context, record, value)
})

// Step 2's copy, whose `onHold` is a boolean of `Member`: its keys bound to the kernel's pointer helper, as in
// `Pointers.test.ts`, since the kernel's own helpers know no `onHold`.
type Copy = typeof constructsVocabulary
const copyProperty = pointerFor<{
  readonly inv: {
    readonly iri: Copy["namespace"]
    readonly terms: ReadonlyArray<(keyof Copy["objectProperties"] | keyof Copy["datatypeProperties"]) & string>
  }
}>()

/** The thread's context on step 2's copy. */
const copyContext = Effect.gen(function* () {
  const context = yield* threadContext
  const vocabulary = yield* S.decodeEffect(Vocabulary, { onExcessProperty: "error", errors: "all" })(
    constructsVocabulary
  )
  return { ...context, vocabulary } satisfies LiftContext
})

/** `Member` with a boolean `onHold` beside its fields: a struct planted where no record has a boolean. */
const heldMember = S.Struct({
  ...Member.fields,
  onHold: S.Boolean.pipe(S.annotateKey(copyProperty("inv:onHold")))
}).pipe(S.annotate(aboutClass("inv:Member")))

/** The same, its `onHold` a text: the planted mistake, a boolean's words where its value belongs. */
const wordedMember = S.Struct({
  ...Member.fields,
  onHold: S.String.pipe(S.annotateKey(copyProperty("inv:onHold")))
}).pipe(S.annotate(aboutClass("inv:Member")))

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

const raviRow = {
  id: "test_RaviWorks",
  name: "Ravi Example",
  role: "admin",
  organizationId: "test_ExampleWorks",
  organizationName: "Example Works (test)"
}

describe("the lift's literals", () => {
  it.effect("gives the kernel's Activity its words as a string and its instant in the ISO text it encodes to", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const { inv, data } = yield* names
      const { entry, head } = yield* entryNames
      // Written without its fraction: the literal is the schema's encoded text, which writes the milliseconds.
      const activity = yield* S.decodeEffect(Activity)({
        id: entryId,
        organizationId: "test_ExampleWorks",
        actorId: "test_RaviWorks",
        actorName: "Ravi Example",
        action: "Imported items",
        detail: "Created 11 items from items.csv",
        agent: null,
        createdAt: "2026-11-01T09:00:00Z"
      })
      const triples = yield* lift(context, Activity, activity)
      expect(linesOf(triples)).toStrictEqual(
        linesOf([
          ...head,
          link(entry, inv("recordedActor"), data("test_ExampleWorks", "Member", "test_RaviWorks")),
          literal(entry, inv("action"), "Imported items", xsd("string")),
          literal(entry, inv("recordedAt"), "2026-11-01T09:00:00.000Z", xsd("dateTime"))
        ])
      )
    })
  )

  it.effect("states nothing for an absent Option and one literal for a present one", () =>
    Effect.gen(function* () {
      const { inv } = yield* names
      const { entry, head } = yield* entryNames
      const mark = { description: "When it was written, if known", ...aboutProperty("inv:recordedAt") }
      const fromNull = { createdAt: Instant.pipe(nullAsNone(mark)) }
      const fromLeftOut = { createdAt: Instant.pipe(absentAsNone(mark)) }
      const absent = yield* liftEntry(fromNull, { createdAt: null })
      const leftOut = yield* liftEntry(fromLeftOut, {})
      const present = yield* liftEntry(fromNull, { createdAt: "2026-11-01T09:00:00.000Z" })
      const given = yield* liftEntry(fromLeftOut, { createdAt: "2026-11-01T09:00:00.000Z" })
      const stated: ReadonlyArray<Triple> = [
        ...head,
        literal(entry, inv("recordedAt"), "2026-11-01T09:00:00.000Z", xsd("dateTime"))
      ]
      expect(linesOf(absent)).toStrictEqual(linesOf(head))
      expect(linesOf(leftOut)).toStrictEqual(linesOf(head))
      expect(linesOf(present)).toStrictEqual(linesOf(stated))
      expect(linesOf(given)).toStrictEqual(linesOf(stated))
    })
  )

  it.effect("refuses a string attribute fed a number, and writes the same field fed words", () =>
    Effect.gen(function* () {
      const { inv } = yield* names
      const { entry, head } = yield* entryNames
      const mark = S.annotateKey(aboutProperty("inv:action"))
      const counted = yield* Effect.flip(liftEntry({ action: S.Int.pipe(mark) }, { action: 12 }))
      expect(counted.field).toStrictEqual(O.some("action"))
      expect(counted.reason).toBe("the field's value is no xsd:string the lift writes")
      const worded = yield* liftEntry({ action: S.String.pipe(mark) }, { action: "Imported items" })
      expect(linesOf(worded)).toStrictEqual(
        linesOf([...head, literal(entry, inv("action"), "Imported items", xsd("string"))])
      )
    })
  )

  it.effect("refuses an instant's text past its month's end, and writes the leap day", () =>
    Effect.gen(function* () {
      const { inv } = yield* names
      const { entry, head } = yield* entryNames
      const fields = { createdAt: S.String.pipe(S.annotateKey(aboutProperty("inv:recordedAt"))) }
      const past = yield* Effect.flip(liftEntry(fields, { createdAt: "2026-02-29T09:00:00Z" }))
      expect(past.field).toStrictEqual(O.some("createdAt"))
      expect(past.reason).toBe('the field\'s value is no xsd:dateTime: "2026-02-29T09:00:00Z"')
      const leap = yield* liftEntry(fields, { createdAt: "2024-02-29T09:00:00Z" })
      expect(linesOf(leap)).toStrictEqual(
        linesOf([...head, literal(entry, inv("recordedAt"), "2024-02-29T09:00:00Z", xsd("dateTime"))])
      )
    })
  )

  it.effect("writes a boolean as true or false, and refuses a text where the boolean belongs", () =>
    Effect.gen(function* () {
      const context = yield* copyContext
      const { inv, lifted } = yield* names
      const member = `${context.vocabulary.base}/data/test_ExampleWorks/Member/test_RaviWorks`
      const six = lifted("test_ExampleWorks", "test_RaviWorks", "admin")
      const held = yield* S.decodeUnknownEffect(heldMember)({ ...raviRow, onHold: true })
      const free = yield* S.decodeUnknownEffect(heldMember)({ ...raviRow, onHold: false })
      const heldTriples = yield* lift(context, heldMember, held)
      const freeTriples = yield* lift(context, heldMember, free)
      expect(linesOf(heldTriples)).toStrictEqual(
        linesOf([...six, literal(member, inv("onHold"), "true", xsd("boolean"))])
      )
      expect(linesOf(freeTriples)).toStrictEqual(
        linesOf([...six, literal(member, inv("onHold"), "false", xsd("boolean"))])
      )
      const worded = yield* S.decodeUnknownEffect(wordedMember)({ ...raviRow, onHold: "true" })
      const refusal = yield* Effect.flip(lift(context, wordedMember, worded))
      expect(refusal.field).toStrictEqual(O.some("onHold"))
      expect(refusal.reason).toBe("the field's value is no xsd:boolean the lift writes")
    })
  )
})

describe("the tenant given beside the rows", () => {
  const person = S.decodeEffect(Person)({
    memberId: "test_RaviWorks",
    name: "Ravi Example",
    email: null,
    role: "admin",
    joinedAt: null
  })

  it.effect(
    "lifts the People page's Person to its member and the grant its role is, as Member's lift writes them",
    () =>
      Effect.gen(function* () {
        const context = yield* threadContext
        const { inv, data, lifted } = yield* names
        const row = yield* person
        const triples = yield* lift({ ...context, organization: O.some("test_ExampleWorks") }, Person, row)
        const member = data("test_ExampleWorks", "Member", "test_RaviWorks")
        const tenant = link(member, inv("membershipIn"), data("test_ExampleWorks", "Tenant", "test_ExampleWorks"))
        // Member's six triples less the one its organizationId states: Person names no tenant, so it states none.
        expect(triples).toHaveLength(5)
        expect(linesOf(triples)).toStrictEqual(
          linesOf(without(lifted("test_ExampleWorks", "test_RaviWorks", "admin"), [tenant]))
        )
      })
  )

  it.effect("refuses Person with no tenant given, and a given tenant that is no id", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const row = yield* person
      const alone = yield* Effect.flip(lift(context, Person, row))
      expect(alone.reason).toBe(
        "0 fields name a property ranging over the tenant, and none is given beside the record; the lift needs one"
      )
      const spaced = yield* Effect.flip(lift({ ...context, organization: O.some("Example Works") }, Person, row))
      expect(spaced.field).toStrictEqual(O.none())
      expect(spaced.reason).toBe("the organization given beside the record is no id")
    })
  )

  it.effect("refuses a tenant given to a Member, which names its own", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const member = yield* ravi
      const twice = yield* Effect.flip(lift({ ...context, organization: O.some("test_ExampleWorks") }, Member, member))
      expect(twice.field).toStrictEqual(O.some("organizationId"))
      expect(twice.reason).toBe("the record names its tenant here, and another is given beside it")
      const once = yield* lift(context, Member, member)
      const tenant = A.findFirst(once, (triple) => triple.predicate === `${context.vocabulary.namespace}membershipIn`)
      assertSome(
        O.map(tenant, (triple) => triple.object),
        IriNode.make({ kind: "iri", iri: `${context.vocabulary.base}/data/test_ExampleWorks/Tenant/test_ExampleWorks` })
      )
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
