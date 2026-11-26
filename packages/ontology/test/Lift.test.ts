// The lift, `graphOf` and `threadGraph` (report 14 section 4), in memory. The thread's twenty-four triples (section 4.4,
// with step 11's tenant names and hand-written person's name and account) are asserted on the value `threadGraph()` returns, and every expected IRI is built from the vocabulary's `base` and
// namespace, never written out.
//
// The planted cases hold the lift to its marks: a copy of `Member` whose `role` mark is changed gives other triples,
// so a lift that wrote a grant for every member, whatever the mark said, fails here.
//
// The literals (party slice, step 4): the kernel's `Activity` gives a string and an instant in its encoded ISO text;
// planted structs give an absent and a present `Option`, and a boolean on step 2's copy, since no record of the kernel
// has a boolean field; each value its datatype does not write is planted and refused. The People page's `Person`
// names no tenant, so its caller gives one beside the rows, and a tenant given to a record that names its own is
// refused (decision 149), as is a record that names its tenant in two fields.
//
// A path that ends in an attribute (party slice, step 11; decisions 155 and 161): it states nothing, and the record still
// lifts, unless its node step is a relation another field fills, whose object then carries the literal, untyped. Each
// branch is planted on a struct beside the kernel's records: the reuse with a fixed concept and two fields filling the
// relation, each stating nothing for that field while the rest of the record lifts (decision 178), a reverse step, and a
// node step no field fills, each with the near miss that differs from it by one step.
//
// A class that stores no id (party slice, step 7; decision 135): on copies of the kernel's terms with one class's
// records storing no id, the lift makes no node of it as a record, as a path's node or as a link's object, and the
// same record lifts on a copy where another class stores none.
import { describe, expect, it } from "@effect/vitest"
import { assertSome } from "@effect/vitest/utils"
import { Vocabulary } from "@beep/vocabulary/Model"
import { pointerFor } from "@beep/vocabulary/Pointer"
import { RdfVocab } from "@beep/vocabulary/Rdf"
import { Person } from "@inventory/access-contract/Person"
import { Activity } from "@inventory/kernel/Activity"
import { AgentRun } from "@inventory/kernel/AgentRun"
import { ActivityId, MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import { vocabulary as kernelTerms } from "@inventory/kernel/Terms"
import { aboutClass, aboutPath, aboutProperty, noTerm } from "@inventory/kernel/TermsPointer"
import { DisplayName, Instant } from "@inventory/kernel/Text"
import { absentAsNone, nullAsNone } from "@inventory/kernel/Wire"
import * as A from "effect/Array"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
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

/** The thread's tenants by organization id, with the name each member row gives its organization. */
const tenantNames = { test_ExampleWorks: "Example Works (test)", test_SecondOrg: "Second Org (test)" } as const

/**
 * The seven triples one member lifts to: section 4.2's six, then its tenant's name on the tenant (decision 161), and
 * the names its fixture triples use.
 */
const names = Effect.map(threadContext, ({ vocabulary }) => {
  const inv = (local: string) => `${vocabulary.namespace}${local}`
  const data = (organization: string, key: string, id: string) => `${vocabulary.base}/data/${organization}/${key}/${id}`
  const person = `${vocabulary.base}/fixture/Person/test_Ravi`
  const account = `${vocabulary.base}/fixture/SignInAccount/test_RaviAccount`
  const tenantName = (organization: keyof typeof tenantNames) =>
    literal(data(organization, "Tenant", organization), inv("name"), tenantNames[organization], xsd("string"))
  const lifted = (organization: keyof typeof tenantNames, id: string, role: string) => {
    const member = data(organization, "Member", id)
    const grant = `${member}/role`
    return [
      link(member, type, inv("Member")),
      link(member, inv("membershipIn"), data(organization, "Tenant", organization)),
      link(grant, type, inv("Grant")),
      link(grant, inv("grantScope"), inv("GrantScopeKindScheme-organization")),
      link(grant, inv("grantedTo"), member),
      link(grant, inv("grantsRole"), inv(`MemberRoleScheme-${role}`)),
      tenantName(organization)
    ]
  }
  const works = data("test_ExampleWorks", "Member", "test_RaviWorks")
  const second = data("test_SecondOrg", "Member", "test_RaviSecond")
  const written = [
    link(person, type, inv("Person")),
    literal(person, inv("name"), "Ravi Example", xsd("string")),
    link(data("test_ExampleWorks", "Tenant", "test_ExampleWorks"), type, inv("Tenant")),
    link(data("test_SecondOrg", "Tenant", "test_SecondOrg"), type, inv("Tenant")),
    link(works, inv("membershipOf"), person),
    link(second, inv("membershipOf"), person),
    link(account, type, inv("SignInAccount")),
    literal(account, inv("accountEmail"), "test_ravi@example.org", xsd("string")),
    link(works, inv("memberAccount"), account),
    link(second, inv("memberAccount"), account)
  ]
  return { inv, data, lifted, tenantName, written }
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
  it.effect("gives one Member section 4.2's six triples and its tenant's name, and nothing for its person's name", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const member = yield* ravi
      const { lifted } = yield* names
      const triples = yield* lift(context, Member, member)
      expect(triples).toHaveLength(7)
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
      const all = lifted("test_ExampleWorks", "test_RaviWorks", "admin")
      expect(linesOf(triples)).toStrictEqual(linesOf([...A.take(all, 2), ...A.takeRight(all, 1)]))
    })
  )

  it.effect("follows the mark it is given: a path with no fixed scope and no reverse writes those triples", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const person = yield* ravi
      const { inv, data, tenantName } = yield* names
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
          link(`${member}/role`, inv("grantsRole"), inv("MemberRoleScheme-admin")),
          tenantName("test_ExampleWorks")
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
      const seven = lifted("test_ExampleWorks", "test_RaviWorks", "admin")
      const held = yield* S.decodeUnknownEffect(heldMember)({ ...raviRow, onHold: true })
      const free = yield* S.decodeUnknownEffect(heldMember)({ ...raviRow, onHold: false })
      const heldTriples = yield* lift(context, heldMember, held)
      const freeTriples = yield* lift(context, heldMember, free)
      expect(linesOf(heldTriples)).toStrictEqual(
        linesOf([...seven, literal(member, inv("onHold"), "true", xsd("boolean"))])
      )
      expect(linesOf(freeTriples)).toStrictEqual(
        linesOf([...seven, literal(member, inv("onHold"), "false", xsd("boolean"))])
      )
      const worded = yield* S.decodeUnknownEffect(wordedMember)({ ...raviRow, onHold: "true" })
      const refusal = yield* Effect.flip(lift(context, wordedMember, worded))
      expect(refusal.field).toStrictEqual(O.some("onHold"))
      expect(refusal.reason).toBe("the field's value is no xsd:boolean the lift writes")
    })
  )

  it.effect("refuses a record its own schema cannot encode, naming no field, and lifts one it can", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const { head } = yield* entryNames
      // A field that stands for no term: the record is encoded whole, before any mark is read.
      const record = S.Struct({
        id: ActivityId.pipe(S.annotateKey(aboutClass("inv:AuditEntry"))),
        organizationId: OrganizationId.pipe(S.annotateKey(aboutProperty("inv:inTenant"))),
        elapsed: S.BigInt.pipe(
          S.decodeTo(S.Duration, SchemaTransformation.durationFromNanos),
          S.annotateKey(noTerm("screen"))
        )
      }).pipe(S.annotate(aboutClass("inv:AuditEntry")))
      const timed = yield* S.decodeEffect(record)({
        id: entryId,
        organizationId: "test_ExampleWorks",
        elapsed: 5_000_000_000n
      })
      const encodable = yield* lift(context, record, timed)
      expect(linesOf(encodable)).toStrictEqual(linesOf(head))
      // Built in code, not decoded: an endless duration has no count of nanoseconds to encode to.
      const endless = yield* Effect.flip(lift(context, record, { ...timed, elapsed: Duration.infinity }))
      expect(endless.field).toStrictEqual(O.none())
      expect(endless.reason).toBe("the value does not encode through the record's schema")
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
        const { inv, data, lifted, tenantName } = yield* names
        const row = yield* person
        const triples = yield* lift({ ...context, organization: O.some("test_ExampleWorks") }, Person, row)
        const member = data("test_ExampleWorks", "Member", "test_RaviWorks")
        const tenant = link(member, inv("membershipIn"), data("test_ExampleWorks", "Tenant", "test_ExampleWorks"))
        // Member's seven triples less the two its organization's fields state: Person names no tenant, so it states
        // neither the link nor the tenant's name, and its name's path, whose person no field fills, states nothing.
        expect(triples).toHaveLength(5)
        expect(linesOf(triples)).toStrictEqual(
          linesOf(
            without(lifted("test_ExampleWorks", "test_RaviWorks", "admin"), [tenant, tenantName("test_ExampleWorks")])
          )
        )
      })
  )

  it.effect("writes Person's joinedAt on the member, and nothing for its email, whose account no field fills", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const { inv, data, lifted, tenantName } = yield* names
      const row = yield* S.decodeEffect(Person)({
        memberId: "test_RaviWorks",
        name: "Ravi Example",
        email: "test_ravi@example.org",
        role: "admin",
        joinedAt: "2026-11-01T09:00:00.000Z"
      })
      const triples = yield* lift({ ...context, organization: O.some("test_ExampleWorks") }, Person, row)
      const member = data("test_ExampleWorks", "Member", "test_RaviWorks")
      const tenant = link(member, inv("membershipIn"), data("test_ExampleWorks", "Tenant", "test_ExampleWorks"))
      expect(linesOf(triples)).toStrictEqual(
        linesOf([
          ...without(lifted("test_ExampleWorks", "test_RaviWorks", "admin"), [tenant, tenantName("test_ExampleWorks")]),
          literal(member, inv("joinedAt"), "2026-11-01T09:00:00.000Z", xsd("dateTime"))
        ])
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

  // Both fields hold an id, so only the count of tenant fields refuses: taking the first would write the member under
  // one organization and say nothing of the other.
  const twoTenants = (mark: S.Annotations.Key<OrganizationId>) =>
    S.Struct({ ...Member.fields, workspaceId: OrganizationId.pipe(S.annotateKey(mark)) }).pipe(
      S.annotate(aboutClass("inv:Member"))
    )

  it.effect("refuses a record that names its tenant in two fields, naming no field", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const record = twoTenants(aboutProperty("inv:inTenant"))
      const row = yield* S.decodeUnknownEffect(record)({ ...raviRow, workspaceId: "test_SecondOrg" })
      const refusal = yield* Effect.flip(lift(context, record, row))
      expect(refusal.field).toStrictEqual(O.none())
      expect(refusal.reason).toBe("2 fields name a property ranging over the tenant; the lift needs one")
    })
  )

  it.effect("near miss: the same record with the second field marked as no term lifts Member's seven triples", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const { lifted } = yield* names
      const record = twoTenants(noTerm("screen"))
      const row = yield* S.decodeUnknownEffect(record)({ ...raviRow, workspaceId: "test_SecondOrg" })
      const triples = yield* lift(context, record, row)
      expect(linesOf(triples)).toStrictEqual(linesOf(lifted("test_ExampleWorks", "test_RaviWorks", "admin")))
    })
  )
})

describe("the thread's graph", () => {
  it.effect("is twenty-four triples: fourteen lifted, ten hand-written", () =>
    Effect.gen(function* () {
      const { lifted, written } = yield* names
      const graph = yield* threadGraph()
      expect(graph).toHaveLength(24)
      expect(linesOf(graph)).toHaveLength(24)
      expect(linesOf(graph)).toStrictEqual(
        linesOf([
          ...lifted("test_ExampleWorks", "test_RaviWorks", "admin"),
          ...lifted("test_SecondOrg", "test_RaviSecond", "viewer"),
          ...written
        ])
      )
    })
  )

  it.effect("reads the hand-written fixture as its ten triples", () =>
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

/** The actor's name reached by the path given: a field whose path the reuse may read. */
const actorNamed = (mark: S.Annotations.Key<string>) => DisplayName.pipe(S.annotateKey(mark))

const actorLink = MemberId.pipe(S.annotateKey(aboutProperty("inv:recordedActor")))

describe("a path that ends in an attribute (decisions 155 and 161)", () => {
  it.effect("states nothing for Activity's agent, a run no record identifies, and the entry still lifts", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const row = {
        id: entryId,
        organizationId: "test_ExampleWorks",
        actorId: "test_RaviWorks",
        actorName: "Ravi Example",
        action: "Imported items",
        detail: "Created 11 items from items.csv",
        createdAt: "2026-11-01T09:00:00Z"
      }
      const byPerson = yield* S.decodeEffect(Activity)({ ...row, agent: null })
      const byAgent = yield* S.decodeEffect(Activity)({ ...row, agent: "Table assistant" })
      const alone = yield* lift(context, Activity, byPerson)
      const helped = yield* lift(context, Activity, byAgent)
      expect(alone).toHaveLength(5)
      expect(linesOf(helped)).toStrictEqual(linesOf(alone))
    })
  )

  it.effect("near miss: a field filling the node step's relation takes the literal on its object, untyped", () =>
    Effect.gen(function* () {
      const { inv, data } = yield* names
      const { entry, head } = yield* entryNames
      const actor = data("test_ExampleWorks", "Member", "test_RaviWorks")
      const triples = yield* liftEntry(
        {
          actorId: actorLink,
          actorName: actorNamed(
            aboutPath([{ property: "inv:recordedActor", node: "inv:Member" }, { property: "inv:name" }])
          )
        },
        { actorId: "test_RaviWorks", actorName: "Ravi Example" }
      )
      expect(linesOf(triples)).toStrictEqual(
        linesOf([
          ...head,
          link(entry, inv("recordedActor"), actor),
          literal(actor, inv("name"), "Ravi Example", xsd("string"))
        ])
      )
    })
  )

  it.effect("planted: with no field filling the relation the same path states nothing", () =>
    Effect.gen(function* () {
      const { head } = yield* entryNames
      const triples = yield* liftEntry(
        {
          actorName: actorNamed(
            aboutPath([{ property: "inv:recordedActor", node: "inv:Member" }, { property: "inv:name" }])
          )
        },
        { actorName: "Ravi Example" }
      )
      expect(linesOf(triples)).toStrictEqual(linesOf(head))
    })
  )

  it.effect("planted: a reverse step is not the other field's link, so the path states nothing", () =>
    Effect.gen(function* () {
      const { inv, data } = yield* names
      const { entry, head } = yield* entryNames
      const triples = yield* liftEntry(
        {
          actorId: actorLink,
          actorName: actorNamed(
            aboutPath([{ property: "inv:recordedActor", reverse: true, node: "inv:Member" }, { property: "inv:name" }])
          )
        },
        { actorId: "test_RaviWorks", actorName: "Ravi Example" }
      )
      expect(linesOf(triples)).toStrictEqual(
        linesOf([...head, link(entry, inv("recordedActor"), data("test_ExampleWorks", "Member", "test_RaviWorks"))])
      )
    })
  )

  // Decision 178: two fields filling the relation leave the path's node undecided, so the path's field states nothing
  // and the record still lifts its other fields. The near miss, one field filling it, writes the name.
  it.effect("planted: two fields fill the relation, so the path states nothing and the rest of the entry lifts", () =>
    Effect.gen(function* () {
      const { inv, data } = yield* names
      const { entry, head } = yield* entryNames
      const named = actorNamed(
        aboutPath([{ property: "inv:recordedActor", node: "inv:Member" }, { property: "inv:name" }])
      )
      const actor = data("test_ExampleWorks", "Member", "test_RaviWorks")
      const reviewer = data("test_ExampleWorks", "Member", "test_RaviSecond")
      const triples = yield* liftEntry(
        { actorId: actorLink, reviewerId: actorLink, actorName: named },
        { actorId: "test_RaviWorks", reviewerId: "test_RaviSecond", actorName: "Ravi Example" }
      )
      expect(linesOf(triples)).toStrictEqual(
        linesOf([...head, link(entry, inv("recordedActor"), actor), link(entry, inv("recordedActor"), reviewer)])
      )
      const nearMiss = yield* liftEntry(
        { actorId: actorLink, actorName: named },
        { actorId: "test_RaviWorks", actorName: "Ravi Example" }
      )
      expect(linesOf(nearMiss)).toStrictEqual(
        linesOf([
          ...head,
          link(entry, inv("recordedActor"), actor),
          literal(actor, inv("name"), "Ravi Example", xsd("string"))
        ])
      )
    })
  )

  // Decision 178: a reused node step that fixes a concept would state on the other record's node what no field
  // states, so the path's field states nothing and the record still lifts. The near miss, no fixed concept, writes it.
  it.effect(
    "planted: a reused node step fixes a concept, so the path states nothing and the rest of the entry lifts",
    () =>
      Effect.gen(function* () {
        const { inv, data } = yield* names
        const { entry, head } = yield* entryNames
        const actor = data("test_ExampleWorks", "Member", "test_RaviWorks")
        const triples = yield* liftEntry(
          {
            actorId: actorLink,
            actorName: actorNamed(
              aboutPath([
                {
                  property: "inv:recordedActor",
                  node: "inv:Member",
                  fixed: [{ property: "inv:membershipStatus", concept: "inv:MembershipStatusScheme-active" }]
                },
                { property: "inv:name" }
              ])
            )
          },
          { actorId: "test_RaviWorks", actorName: "Ravi Example" }
        )
        expect(linesOf(triples)).toStrictEqual(linesOf([...head, link(entry, inv("recordedActor"), actor)]))
        expect(A.some(triples, (triple) => triple.predicate === inv("membershipStatus"))).toBe(false)
        const nearMiss = yield* liftEntry(
          {
            actorId: actorLink,
            actorName: actorNamed(
              aboutPath([{ property: "inv:recordedActor", node: "inv:Member", fixed: [] }, { property: "inv:name" }])
            )
          },
          { actorId: "test_RaviWorks", actorName: "Ravi Example" }
        )
        expect(linesOf(nearMiss)).toStrictEqual(
          linesOf([
            ...head,
            link(entry, inv("recordedActor"), actor),
            literal(actor, inv("name"), "Ravi Example", xsd("string"))
          ])
        )
      })
  )
})

/** The thread's context on a copy of the kernel's terms where `local`'s records store no id (decision 135). */
const storingNoId = Effect.fn("storingNoId")(function* (local: keyof typeof kernelTerms.classes) {
  const context = yield* threadContext
  const copy = yield* S.decodeEffect(Vocabulary, { onExcessProperty: "error", errors: "all" })({
    ...kernelTerms,
    classes: { ...kernelTerms.classes, [local]: { ...kernelTerms.classes[local], storesId: false } }
  })
  return { ...context, vocabulary: copy } satisfies LiftContext
})

/** An audit entry whose `actorId` links it to the member who acted, as `Activity`'s does. */
const actedEntry = S.Struct({
  id: ActivityId.pipe(S.annotateKey(aboutClass("inv:AuditEntry"))),
  organizationId: OrganizationId.pipe(S.annotateKey(aboutProperty("inv:inTenant"))),
  actorId: MemberId.pipe(S.annotateKey(aboutProperty("inv:recordedActor")))
}).pipe(S.annotate(aboutClass("inv:AuditEntry")))

const actedValue = S.decodeEffect(actedEntry)({
  id: entryId,
  organizationId: "test_ExampleWorks",
  actorId: "test_RaviWorks"
})

describe("a class that stores no id (decision 135)", () => {
  // Report 18 section 7: AgentRun's enrolment reaches the refusal on the kernel's own terms, with no copy.
  it.effect("refuses the kernel's AgentRun, whose class stores no id, naming no field", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const run = yield* S.decodeEffect(AgentRun)({ agent: "Assistant", maxRole: "editor" })
      const refusal = yield* Effect.flip(lift(context, AgentRun, run))
      expect(refusal.field).toStrictEqual(O.none())
      expect(refusal.reason).toBe("AgentRun stores no id, so the lift makes no node of it (decision 135)")
    })
  )

  it.effect("refuses a Member once Member stores no id, naming no field", () =>
    Effect.gen(function* () {
      const context = yield* storingNoId("Member")
      const member = yield* ravi
      const refusal = yield* Effect.flip(lift(context, Member, member))
      expect(refusal.field).toStrictEqual(O.none())
      expect(refusal.reason).toContain("Member stores no id")
    })
  )

  // Decision 155: Member's name passes through a Person, and the record lifts whatever Person stores.
  it.effect("near miss: the same Member lifts its seven triples where Person stores no id", () =>
    Effect.gen(function* () {
      const context = yield* storingNoId("Person")
      const member = yield* ravi
      const { lifted } = yield* names
      const triples = yield* lift(context, Member, member)
      expect(linesOf(triples)).toStrictEqual(linesOf(lifted("test_ExampleWorks", "test_RaviWorks", "admin")))
    })
  )

  it.effect("refuses the Member's role once Grant, its path's node, stores no id", () =>
    Effect.gen(function* () {
      const context = yield* storingNoId("Grant")
      const member = yield* ravi
      const refusal = yield* Effect.flip(lift(context, Member, member))
      expect(refusal.field).toStrictEqual(O.some("role"))
      expect(refusal.reason).toContain("inv:Grant stores no id")
    })
  )

  it.effect("refuses an audit entry's actor once Member, the link's object, stores no id", () =>
    Effect.gen(function* () {
      const context = yield* storingNoId("Member")
      const value = yield* actedValue
      const refusal = yield* Effect.flip(lift(context, actedEntry, value))
      expect(refusal.field).toStrictEqual(O.some("actorId"))
      expect(refusal.reason).toContain("ranges over Member, which stores no id")
    })
  )

  it.effect("near miss: the same entry links its actor where Grant stores no id", () =>
    Effect.gen(function* () {
      const context = yield* storingNoId("Grant")
      const value = yield* actedValue
      const { inv, data } = yield* names
      const { entry, head } = yield* entryNames
      const triples = yield* lift(context, actedEntry, value)
      expect(linesOf(triples)).toStrictEqual(
        linesOf([...head, link(entry, inv("recordedActor"), data("test_ExampleWorks", "Member", "test_RaviWorks"))])
      )
    })
  )
})
