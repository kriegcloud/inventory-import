// Gate 8, the question suite (report 14 sections 5 and 6.8; decision 120): CQ-P06 and CQ-P11 asked of
// `threadGraph()` in Oxigraph, with no reasoner, and the party slice's CQ-P01, CQ-P02, CQ-P09, CQ-P04, the CQ-P05 ASK,
// CQ-P07 and CQ-P03 asked of their hand-written fixtures, which no record holds (report 18 section 10). Every question walks
// `rdf:type/rdfs:subClassOf*` and is asked of its graph with the committed OWL file beside it (decision 27), so a node
// typed by a subclass is found.
//
// The expected rows below are the lock on each question's answer (decision 118): there is no lock file and no update
// flag. A commit that changes them says so, and the release notes name the question with its old and its new answer.
// Every expected IRI is built from the vocabulary's base and namespace, never written out.
//
// Each must-fail case changes one thing and shows the answer change: M1 to M3 the graph after the lift, M4 the
// record's value, M5 the query, M6 and M7 the mark on the record. Two of them are forbidden conclusions of the goal's
// SPEC: ban 3 is M5 and ban 4 is M3. The three guards of section 4.4 keep the hand-written part from answering for
// the lift.
import { describe, expect, it } from "@effect/vitest"
import { RdfVocab } from "@beep/vocabulary/Rdf"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import { aboutClass, aboutPath, noTerm } from "@inventory/kernel/TermsPointer"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import mutantThroughPerson from "../fixtures/cq/CQ-P06.M5.rq?raw"
import membersAndRoles from "../fixtures/cq/CQ-P06.rq?raw"
import rolesAtScope from "../fixtures/cq/CQ-P11.rq?raw"
import { overreach, unshown } from "../src/Fixture.rules.ts"
import { byCodePoint, linesOf, link, literal, ObjectNode, without, type Triple } from "../src/Graph.schema.ts"
import { lift } from "../src/Lift.ts"
import { graphOf, threadContext, threadGraph, threadHandWritten, threadRows } from "../src/Thread.ts"
import { readTurtle } from "../src/Turtle.ts"
import { ask, askWhether } from "./support/ask.ts"
import {
  bareType,
  bareTypeQuery,
  contacts,
  handWrittenFixtures,
  identity,
  ontology,
  roleless,
  sameness,
  stewardship,
  suttonParty,
  tenancy,
  trading
} from "./support/fixtures.ts"

const type = `${RdfVocab.rdf.iri}type`
const subClassOf = `${RdfVocab.rdfs.iri}subClassOf`

const membersVariables = ["tenant", "person", "name", "member", "email", "role"]
const scopeVariables = ["member", "role", "scope"]

/** The names of the fixture, built from the vocabulary. */
const names = Effect.map(threadContext, ({ vocabulary }) => {
  const inv = (local: string) => `${vocabulary.namespace}${local}`
  const data = (organization: string, key: string, id: string) => `${vocabulary.base}/data/${organization}/${key}/${id}`
  return {
    inv,
    data,
    person: `${vocabulary.base}/fixture/Person/test_Ravi`,
    works: data("test_ExampleWorks", "Tenant", "test_ExampleWorks"),
    second: data("test_SecondOrg", "Tenant", "test_SecondOrg"),
    raviWorks: data("test_ExampleWorks", "Member", "test_RaviWorks"),
    raviSecond: data("test_SecondOrg", "Member", "test_RaviSecond"),
    admin: inv("MemberRoleScheme-admin"),
    editor: inv("MemberRoleScheme-editor"),
    viewer: inv("MemberRoleScheme-viewer"),
    organizationScope: inv("GrantScopeKindScheme-organization"),
    account: `${vocabulary.base}/fixture/SignInAccount/test_RaviAccount`
  }
})

const raviEmail = "test_ravi@example.org"

/** One row of CQ-P06 for Ravi: the person's name and the sign-in email the fixture writes by hand (decisions 133, 134). */
const raviRow = (person: string, tenant: string, member: string, role: string, email: string) => [
  tenant,
  person,
  "Ravi Example",
  member,
  email,
  role
]

/** Section 5.3: exactly these two rows, in this order. One person, twice, with two roles. */
const expectedMembers = Effect.map(names, (n) => [
  raviRow(n.person, n.works, n.raviWorks, n.admin, raviEmail),
  raviRow(n.person, n.second, n.raviSecond, n.viewer, raviEmail)
])

/** Decision 120: both of the person's grants, each at the organization's scope. */
const expectedScopes = Effect.map(names, (n) => [
  [n.raviWorks, n.admin, n.organizationScope],
  [n.raviSecond, n.viewer, n.organizationScope]
])

/** The thread's graph in its two parts: what the text states, and what the lift wrote. */
const parts = Effect.gen(function* () {
  const context = yield* threadContext
  const graph = yield* threadGraph()
  const written = yield* readTurtle(context.vocabulary.base, threadHandWritten)
  return { context, graph, written, lifted: without(graph, written) }
})

const withPredicate = (predicate: string) => (triple: Triple) => triple.predicate === predicate

const iriOf = (triple: Triple): string => (ObjectNode.guards.iri(triple.object) ? triple.object.iri : "")

/** The committed OWL file as a graph: what a question's walk down `rdfs:subClassOf*` reads. */
const ontologyGraph = Effect.flatMap(threadContext, ({ vocabulary }) => readTurtle(vocabulary.base, ontology))

/** A SELECT asked of `graph` with the OWL file beside it, as every question is (decision 27). */
const asked = Effect.fnUntraced(function* (
  graph: ReadonlyArray<Triple>,
  query: string,
  variables: ReadonlyArray<string>
) {
  const owl = yield* ontologyGraph
  return yield* ask([...graph, ...owl], query, variables)
})

/** `Member`'s fields with `role` built afresh from `Role`, pointed at `inv:Member`: never enrolled. */
const memberWithRole = (mark: S.Annotations.Key<Role>) =>
  S.Struct({ ...Member.fields, role: Role.pipe(S.annotateKey(mark)) }).pipe(S.annotate(aboutClass("inv:Member")))

const tradingVariables = ["tenant", "organization"]
const tenancyVariables = ["record", "tenants"]
const identityVariables = ["tenant", "a", "b", "decider", "at", "evidence"]
const stewardshipVariables = ["tenant"]
const contactsVariables = ["tenant", "account", "person", "purpose", "value"]

/** A party question's hand-written fixture as a graph: no record holds what it states, so nothing is lifted. */
const fixtureGraph = (text: string) =>
  Effect.flatMap(threadContext, ({ vocabulary }) => readTurtle(vocabulary.base, text))

/** The names of the party fixtures, built from the vocabulary: the thread's two tenants and the fixture's nodes. */
const partyNames = Effect.gen(function* () {
  const { vocabulary } = yield* threadContext
  const n = yield* names
  const fixture = (key: string) => (name: string) => `${vocabulary.base}/fixture/${key}/${name}`
  return {
    ...n,
    record: fixture("SourceRecord"),
    organization: fixture("Organization"),
    individual: fixture("Person"),
    decision: fixture("IdentityDecision"),
    member: fixture("Member"),
    grant: fixture("Grant"),
    evidence: fixture("IdentityEvidence"),
    instant: (value: string) => literal(n.inv("eventTime"), value, `${RdfVocab.xsd.iri}dateTime`)
  }
})

/** `graph` less the triples of `subject` with `predicate`. */
const dropped = (graph: ReadonlyArray<Triple>, subject: string, predicate: string) =>
  A.filter(graph, (triple) => !(triple.subject === subject && triple.predicate === predicate))

describe("gate 8, the questions", () => {
  it.effect("CQ-P06: the two members of the two organizations, each with the role its grant gives", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const expected = yield* expectedMembers
      const rows = yield* asked(graph, membersAndRoles, membersVariables)
      expect(rows).toStrictEqual(expected)
    })
  )

  it.effect("CQ-P06 for one organization is the rows with that tenant: Ravi is admin of the first only", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const n = yield* names
      const rows = yield* asked(graph, membersAndRoles, membersVariables)
      expect(A.filter(rows, ([tenant]) => tenant === n.second)).toStrictEqual([
        raviRow(n.person, n.second, n.raviSecond, n.viewer, raviEmail)
      ])
    })
  )

  // Decisions 133 and 134: the name is read on the person, required; the email on the member's sign-in account,
  // optional, since the People page lists a member with no account.
  it.effect("CQ-P06 lists a member with no account with no email, and no member whose person has no name", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const n = yield* names
      const noAccount = dropped(graph, n.raviSecond, n.inv("memberAccount"))
      expect(noAccount).toHaveLength(graph.length - 1)
      const unaccounted = yield* asked(noAccount, membersAndRoles, membersVariables)
      expect(unaccounted).toStrictEqual([
        raviRow(n.person, n.works, n.raviWorks, n.admin, raviEmail),
        raviRow(n.person, n.second, n.raviSecond, n.viewer, "")
      ])
      // Planted: the account untyped, so the email is read from nothing the vocabulary calls an account.
      const untypedAccount = A.filter(graph, (triple) => !(triple.subject === n.account && triple.predicate === type))
      expect(untypedAccount).toHaveLength(graph.length - 1)
      const unsigned = yield* asked(untypedAccount, membersAndRoles, membersVariables)
      expect(unsigned).toStrictEqual([
        raviRow(n.person, n.works, n.raviWorks, n.admin, ""),
        raviRow(n.person, n.second, n.raviSecond, n.viewer, "")
      ])
      // Planted: the person's name left out. The tenants' lifted names do not stand in for it.
      const nameless = dropped(graph, n.person, n.inv("name"))
      expect(nameless).toHaveLength(graph.length - 1)
      expect(A.some(nameless, withPredicate(n.inv("name")))).toBe(true)
      const unnamed = yield* asked(nameless, membersAndRoles, membersVariables)
      expect(unnamed).toStrictEqual([])
      // Planted: the person's type left out. A node with a name that the vocabulary calls no person gives no row.
      const untypedPerson = A.filter(graph, (triple) => !(triple.subject === n.person && triple.predicate === type))
      expect(untypedPerson).toHaveLength(graph.length - 1)
      const unpersoned = yield* asked(untypedPerson, membersAndRoles, membersVariables)
      expect(unpersoned).toStrictEqual([])
    })
  )

  it.effect("CQ-P11: each member's role with the scope it is held at", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const expected = yield* expectedScopes
      const rows = yield* asked(graph, rolesAtScope, scopeVariables)
      expect(rows).toStrictEqual(expected)
    })
  )

  it.effect("the committed query files name the vocabulary's namespace, and RDF's and RDFS's for the walk", () =>
    Effect.gen(function* () {
      const { vocabulary } = yield* threadContext
      for (const query of [
        membersAndRoles,
        mutantThroughPerson,
        rolesAtScope,
        bareTypeQuery,
        trading.query,
        roleless.query,
        tenancy.query,
        identity.query,
        stewardship.query,
        contacts.query
      ]) {
        expect(query).toContain(`PREFIX inv: <${vocabulary.namespace}>`)
        expect(query).toContain(`PREFIX rdf: <${RdfVocab.rdf.iri}>`)
        expect(query).toContain(`PREFIX rdfs: <${RdfVocab.rdfs.iri}>`)
      }
      // CQ-P05 reads no type, so it walks nothing: it names OWL's namespace alone.
      expect(sameness.query).toContain(`PREFIX owl: <${RdfVocab.owl.iri}>`)
      expect(sameness.query).not.toContain("rdf:type")
    })
  )
})

/** The walk every question makes from a node to its class, and the bare step it replaces. */
const walk = "rdf:type/rdfs:subClassOf*"
const bareStep = (query: string) => Str.replaceAll(walk, "a")(query)

/**
 * `graph` with each typed node moved one subclass down: every `rdf:type` to a class becomes a type to a class made
 * here, stated a subclass of it. A question that walks the subclasses gives the same rows over the result.
 */
const movedDown = (graph: ReadonlyArray<Triple>): ReadonlyArray<Triple> => {
  const isTyping = (triple: Triple) => triple.predicate === type && ObjectNode.guards.iri(triple.object)
  const typed = A.filter(graph, isTyping)
  const classes = A.dedupe(A.map(typed, iriOf))
  return [
    ...A.filter(graph, (triple) => !isTyping(triple)),
    ...A.map(typed, (triple) => link(triple.subject, type, `${iriOf(triple)}-below`)),
    ...A.map(classes, (given) => link(`${given}-below`, subClassOf, given))
  ]
}

describe("gate 8, every question walks the subclasses (decision 27)", () => {
  it.effect("planted: the query written `a inv:Organization` misses the node typed only a Tenant", () =>
    Effect.gen(function* () {
      const { vocabulary } = yield* threadContext
      const fixture = yield* readTurtle(vocabulary.base, bareType)
      const node = `${vocabulary.base}/fixture/Tenant/test_TenantOnly`
      expect(linesOf(fixture)).toStrictEqual(linesOf([link(node, type, `${vocabulary.namespace}Tenant`)]))
      const bare = yield* asked(fixture, bareTypeQuery, ["organization"])
      expect(bare).toStrictEqual([])
      // The near miss: the same query with its one type step walked finds the tenant through the OWL file.
      const walked = Str.replace("?organization a inv:", `?organization ${walk} inv:`)(bareTypeQuery)
      expect(bareStep(walked)).toBe(bareTypeQuery)
      const found = yield* asked(fixture, walked, ["organization"])
      expect(found).toStrictEqual([[node]])
    })
  )

  it.effect("the walk reads the OWL file: without it no organization is found, with it the tenant is", () =>
    Effect.gen(function* () {
      const { vocabulary } = yield* threadContext
      const fixture = yield* readTurtle(vocabulary.base, bareType)
      const owl = yield* ontologyGraph
      const query = `PREFIX inv: <${vocabulary.namespace}>
PREFIX rdf: <${RdfVocab.rdf.iri}>
PREFIX rdfs: <${RdfVocab.rdfs.iri}>
ASK { ?organization ${walk} inv:Organization }`
      const alone = yield* askWhether(fixture, query)
      const beside = yield* askWhether([...fixture, ...owl], query)
      expect([alone, beside]).toStrictEqual([false, true])
    })
  )

  it.effect("each question gives the same rows with every typed node one subclass down, its bare twin none", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      expect(movedDown(graph)).toHaveLength(graph.length + 5)
      const tradingGraph = yield* fixtureGraph(trading.fixture)
      const rolelessGraph = yield* fixtureGraph(roleless.fixture)
      const tenancyGraph = yield* fixtureGraph(tenancy.fixture)
      const identityGraph = yield* fixtureGraph(identity.fixture)
      const stewardshipGraph = yield* fixtureGraph(stewardship.fixture)
      const questions: ReadonlyArray<readonly [ReadonlyArray<Triple>, string, ReadonlyArray<string>]> = [
        [graph, membersAndRoles, membersVariables],
        [graph, mutantThroughPerson, membersVariables],
        [graph, rolesAtScope, scopeVariables],
        [stewardshipGraph, stewardship.query, stewardshipVariables],
        [tradingGraph, trading.query, tradingVariables],
        [rolelessGraph, roleless.query, tradingVariables],
        [tenancyGraph, tenancy.query, tenancyVariables],
        [identityGraph, identity.query, identityVariables]
      ]
      for (const [given, query, variables] of questions) {
        const moved = movedDown(given)
        expect(query).toContain(walk)
        const rows = yield* asked(given, query, variables)
        const below = yield* asked(moved, query, variables)
        expect(rows).not.toStrictEqual([])
        expect(below).toStrictEqual(rows)
        // Planted: the same question with bare type steps answers the graph as typed, and nothing one class down.
        const bare = bareStep(query)
        expect(bare).not.toContain(walk)
        const bareRows = yield* asked(given, bare, variables)
        const bareBelow = yield* asked(moved, bare, variables)
        expect(bareRows).toStrictEqual(rows)
        expect(bareBelow).toStrictEqual([])
      }
    })
  )
})

describe("gate 8, the must-fail cases of CQ-P06", () => {
  it.effect("M1: the hand-written fixture cannot answer alone", () =>
    Effect.gen(function* () {
      const { written } = yield* parts
      expect(written).toHaveLength(10)
      const rows = yield* asked(written, membersAndRoles, membersVariables)
      expect(rows).toStrictEqual([])
    })
  )

  it.effect("M2, planted: with the two grantsRole triples removed, both expected rows are missing", () =>
    Effect.gen(function* () {
      const { graph } = yield* parts
      const n = yield* names
      const less = A.filter(graph, (triple) => !withPredicate(n.inv("grantsRole"))(triple))
      expect(less).toHaveLength(graph.length - 2)
      const rows = yield* asked(less, membersAndRoles, membersVariables)
      expect(rows).toStrictEqual([])
    })
  )

  it.effect("M3, ban 4: a role written on the member, with no grant, is no answer", () =>
    Effect.gen(function* () {
      const { graph, lifted } = yield* parts
      const n = yield* names
      const grants = A.map(A.filter(lifted, withPredicate(n.inv("grantedTo"))), (triple) => ({
        grant: triple.subject,
        member: iriOf(triple)
      }))
      const direct = A.flatMap(grants, ({ grant, member }) =>
        A.map(
          A.filter(lifted, (triple) => triple.subject === grant && withPredicate(n.inv("grantsRole"))(triple)),
          (triple) => link(member, n.inv("grantsRole"), iriOf(triple))
        )
      )
      const ungranted = [
        ...A.filter(graph, (triple) => !A.some(grants, ({ grant }) => grant === triple.subject)),
        ...direct
      ]
      // Each grant's four triples are gone and one triple a member stands in their place.
      expect(grants).toHaveLength(2)
      expect(direct).toHaveLength(2)
      expect(ungranted).toHaveLength(graph.length - 8 + 2)
      const rows = yield* asked(ungranted, membersAndRoles, membersVariables)
      const scoped = yield* asked(ungranted, rolesAtScope, scopeVariables)
      expect(rows).toStrictEqual([])
      expect(scoped).toStrictEqual([])
    })
  )

  it.effect("M4: the answer comes from the record's value: an editor in the row is an editor in the answer", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const n = yield* names
      const rows = yield* S.decodeUnknownEffect(S.Array(S.Record(S.String, S.String)))(threadRows)
      const changed = A.map(rows, (row) => (row["id"] === "test_RaviWorks" ? { ...row, role: "editor" } : row))
      expect(changed).not.toStrictEqual(rows)
      const graph = yield* graphOf(context, Member, changed, threadHandWritten)
      const answer = yield* asked(graph, membersAndRoles, membersVariables)
      expect(answer).toStrictEqual([
        raviRow(n.person, n.works, n.raviWorks, n.editor, raviEmail),
        raviRow(n.person, n.second, n.raviSecond, n.viewer, raviEmail)
      ])
    })
  )

  it.effect("M5, ban 3: asked through the person, a role held in one organization shows in the other", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const n = yield* names
      const rows = yield* asked(graph, mutantThroughPerson, membersVariables)
      const asWritten = yield* asked(graph, membersAndRoles, membersVariables)
      const wrong = raviRow(n.person, n.second, n.raviSecond, n.admin, raviEmail)
      // The mutant differs from the question by its join alone, so its four rows are compared whatever their order.
      const sorted = A.sort(A.map(rows, A.join(" ")), byCodePoint)
      expect(sorted).toStrictEqual(
        A.sort(
          A.map(
            [
              raviRow(n.person, n.works, n.raviWorks, n.admin, raviEmail),
              raviRow(n.person, n.works, n.raviWorks, n.viewer, raviEmail),
              wrong,
              raviRow(n.person, n.second, n.raviSecond, n.viewer, raviEmail)
            ],
            A.join(" ")
          ),
          byCodePoint
        )
      )
      // It reports Ravi as admin of the second organization; the question as written, asked of the same graph, does not.
      expect(rows).toContainEqual(wrong)
      expect(asWritten).not.toContainEqual(wrong)
    })
  )

  it.effect("M6: a role field that stands for no term gives no grant, in the graph and from the lift itself", () =>
    Effect.gen(function* () {
      const { context, written } = yield* parts
      const n = yield* names
      const copy = memberWithRole(noTerm("screen"))
      const graph = yield* graphOf(context, copy, threadRows, threadHandWritten)
      const rows = yield* asked(graph, membersAndRoles, membersVariables)
      expect(rows).toStrictEqual([])
      const membersOnly = [
        link(n.raviWorks, type, n.inv("Member")),
        link(n.raviWorks, n.inv("membershipIn"), n.works),
        literal(n.works, n.inv("name"), "Example Works (test)", `${RdfVocab.xsd.iri}string`),
        link(n.raviSecond, type, n.inv("Member")),
        link(n.raviSecond, n.inv("membershipIn"), n.second),
        literal(n.second, n.inv("name"), "Second Org (test)", `${RdfVocab.xsd.iri}string`)
      ]
      expect(linesOf(without(graph, written))).toStrictEqual(linesOf(membersOnly))
      const decoded = yield* Effect.forEach(threadRows, (row) => S.decodeUnknownEffect(copy)(row), { concurrency: 1 })
      const direct = yield* Effect.forEach(decoded, (value) => lift(context, copy, value), { concurrency: 1 })
      expect(linesOf(A.flatten(direct))).toStrictEqual(linesOf(membersOnly))
    })
  )

  it.effect("M7: a path without its fixed scope writes no scope, so neither question has an answer", () =>
    Effect.gen(function* () {
      const { context, written, lifted } = yield* parts
      const n = yield* names
      const copy = memberWithRole(
        aboutPath([
          { property: "inv:grantedTo", reverse: true, node: "inv:Grant", fixed: [] },
          { property: "inv:grantsRole" }
        ])
      )
      const graph = yield* graphOf(context, copy, threadRows, threadHandWritten)
      const rows = yield* asked(graph, membersAndRoles, membersVariables)
      const scoped = yield* asked(graph, rolesAtScope, scopeVariables)
      expect(rows).toStrictEqual([])
      expect(scoped).toStrictEqual([])
      const unscoped = A.filter(lifted, (triple) => !withPredicate(n.inv("grantScope"))(triple))
      expect(unscoped).toHaveLength(lifted.length - 2)
      expect(linesOf(without(graph, written))).toStrictEqual(linesOf(unscoped))
      const decoded = yield* Effect.forEach(threadRows, (row) => S.decodeUnknownEffect(copy)(row), { concurrency: 1 })
      const direct = yield* Effect.forEach(decoded, (value) => lift(context, copy, value), { concurrency: 1 })
      expect(linesOf(A.flatten(direct))).toStrictEqual(linesOf(unscoped))
    })
  )
})

describe("gate 8, what CQ-P06 asks of a node's type", () => {
  it.effect("a member that is not typed a Member, or a grant not typed a Grant, is no row", () =>
    Effect.gen(function* () {
      const { graph } = yield* parts
      const n = yield* names
      const expected = yield* expectedMembers
      const untyped = (subject: string, given: string) =>
        A.filter(
          graph,
          (triple) => !(triple.subject === subject && triple.predicate === type && iriOf(triple) === given)
        )
      const noMember = untyped(n.raviWorks, n.inv("Member"))
      const noGrant = untyped(`${n.raviSecond}/role`, n.inv("Grant"))
      expect([noMember.length, noGrant.length]).toStrictEqual([graph.length - 1, graph.length - 1])
      const withoutMember = yield* asked(noMember, membersAndRoles, membersVariables)
      const withoutGrant = yield* asked(noGrant, membersAndRoles, membersVariables)
      expect(withoutMember).toStrictEqual(A.drop(expected, 1))
      expect(withoutGrant).toStrictEqual(A.take(expected, 1))
      // CQ-P11 asks for the grant's type too.
      const scoped = yield* asked(noGrant, rolesAtScope, scopeVariables)
      expect(scoped).toStrictEqual([[n.raviWorks, n.admin, n.organizationScope]])
    })
  )
})

describe("gate 8, the must-fail case of CQ-P11", () => {
  it.effect("with the two grantScope triples removed there is no row: a scope needs a grant that states it", () =>
    Effect.gen(function* () {
      const { graph } = yield* parts
      const n = yield* names
      const less = A.filter(graph, (triple) => !withPredicate(n.inv("grantScope"))(triple))
      expect(less).toHaveLength(graph.length - 2)
      const rows = yield* asked(less, rolesAtScope, scopeVariables)
      expect(rows).toStrictEqual([])
    })
  )
})

/** CQ-P07 as committed with one clause changed: each plant below is checked to change the text. */
const plantedStewardship = (from: string, to: string) => {
  const planted = Str.replace(from, to)(stewardship.query)
  expect(planted).not.toBe(stewardship.query)
  return planted
}

describe("gate 8, CQ-P07 and its must-fail cases", () => {
  // Report 04 section 3.1 with decision 136: a tenant whose only admin is not active and a tenant with no members are
  // the rows; test_FlourMill, an organization that is no tenant, is none; test_ExampleWorks keeps an active admin.
  it.effect("CQ-P07: the tenant whose only admin is revoked and the tenant with no members keep no admin", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(stewardship.fixture)
      const rows = yield* asked(graph, stewardship.query, stewardshipVariables)
      const empty = n.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")
      expect(rows).toStrictEqual([[empty], [n.second]])
      // The companion: the tenants that keep one, which shows the fixture holds the rule's other side.
      const keeping = plantedStewardship("FILTER NOT EXISTS {", "FILTER EXISTS {")
      const kept = yield* asked(graph, keeping, stewardshipVariables)
      expect(kept).toStrictEqual([[n.works]])
    })
  )

  it.effect("the answer comes from the stage: the revoked admin made active keeps test_SecondOrg out of the rows", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(stewardship.fixture)
      const former = n.member("test_SecondFormerAdmin")
      const status = n.inv("membershipStatus")
      const restored = [...dropped(graph, former, status), link(former, status, n.inv("MembershipStatusScheme-active"))]
      expect(restored).toHaveLength(graph.length)
      const rows = yield* asked(restored, stewardship.query, stewardshipVariables)
      expect(rows).toStrictEqual([[n.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")]])
    })
  )

  // Decision 136: only an active admin counts. With the active admin's stage left out, test_ExampleWorks keeps only
  // test_WorksInvitee, whose stage is pending, and becomes a row; read as "any stage but revoked", it would stay out.
  it.effect("the pending stage counts for nothing: test_ExampleWorks with only its pending admin is a row", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(stewardship.fixture)
      const unstaged = dropped(graph, n.member("test_WorksAdmin"), n.inv("membershipStatus"))
      expect(unstaged).toHaveLength(graph.length - 1)
      const rows = yield* asked(unstaged, stewardship.query, stewardshipVariables)
      expect(rows).toStrictEqual([[n.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")], [n.works], [n.second]])
      // Planted: the stage read as "any stage but revoked", the reading decision 136 rejects. The pending admin
      // then counts, and test_ExampleWorks is no row.
      const notRevoked = plantedStewardship(
        "inv:membershipStatus inv:MembershipStatusScheme-active .",
        `inv:membershipStatus ?stage .
    FILTER (?stage != inv:MembershipStatusScheme-revoked)`
      )
      const lenient = yield* asked(unstaged, notRevoked, stewardshipVariables)
      expect(lenient).toStrictEqual([[n.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")], [n.second]])
    })
  )

  // The member and the grant are each found by their type: a node that states a member's or a grant's properties and
  // no type is neither. The revoked admin made active is the near miss, typed, which keeps test_SecondOrg out.
  it.effect(
    "a node with a member's properties and no Member type, or a grant's and no Grant type, is not counted",
    () =>
      Effect.gen(function* () {
        const n = yield* partyNames
        const graph = yield* fixtureGraph(stewardship.fixture)
        const former = n.member("test_SecondFormerAdmin")
        const formerGrant = n.grant("test_SecondFormerAdminGrant")
        const status = n.inv("membershipStatus")
        const restored = [
          ...dropped(graph, former, status),
          link(former, status, n.inv("MembershipStatusScheme-active"))
        ]
        const kept = yield* asked(restored, stewardship.query, stewardshipVariables)
        expect(kept).toStrictEqual([[n.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")]])
        const memberless = dropped(restored, former, type)
        const grantless = dropped(restored, formerGrant, type)
        expect([memberless.length, grantless.length]).toStrictEqual([graph.length - 1, graph.length - 1])
        const withoutMember = yield* asked(memberless, stewardship.query, stewardshipVariables)
        const withoutGrant = yield* asked(grantless, stewardship.query, stewardshipVariables)
        const expected = [[n.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")], [n.second]]
        expect([withoutMember, withoutGrant]).toStrictEqual([expected, expected])
      })
  )

  it.effect("planted: without the stage, the revoked admin still counts, and test_SecondOrg is no row", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(stewardship.fixture)
      const stageless = plantedStewardship(
        `inv:membershipIn ?tenant ;
            inv:membershipStatus inv:MembershipStatusScheme-active .`,
        "inv:membershipIn ?tenant ."
      )
      const rows = yield* asked(graph, stageless, stewardshipVariables)
      expect(rows).toStrictEqual([[n.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")]])
    })
  )

  it.effect("planted: started from the memberships, the tenant with no members is missed", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(stewardship.fixture)
      const fromMemberships = plantedStewardship(
        "?tenant rdf:type/rdfs:subClassOf* inv:Tenant .",
        "?anyone inv:membershipIn ?tenant ."
      )
      const rows = yield* asked(graph, fromMemberships, stewardshipVariables)
      expect(A.dedupe(A.map(rows, A.join(" ")))).toStrictEqual([n.second])
    })
  )

  it.effect("planted: started from the organizations, test_FlourMill, which is no tenant, is a row", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(stewardship.fixture)
      const fromOrganizations = plantedStewardship(
        "?tenant rdf:type/rdfs:subClassOf* inv:Tenant .",
        "?tenant rdf:type/rdfs:subClassOf* inv:Organization ."
      )
      const rows = yield* asked(graph, fromOrganizations, stewardshipVariables)
      expect(rows).toContainEqual([n.organization("test_FlourMill")])
      expect(rows).toHaveLength(3)
    })
  )

  it.effect("planted: any role counts, so test_SecondOrg's active editor stands in for an admin", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(stewardship.fixture)
      const anyRole = plantedStewardship("inv:grantsRole inv:MemberRoleScheme-admin .", "inv:grantsRole ?role .")
      const rows = yield* asked(graph, anyRole, stewardshipVariables)
      expect(rows).toStrictEqual([[n.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")]])
    })
  )

  it.effect("planted: an admin of any tenant counts for every tenant once the membership's tenant is not read", () =>
    Effect.gen(function* () {
      const graph = yield* fixtureGraph(stewardship.fixture)
      const anyTenant = plantedStewardship(
        `inv:membershipIn ?tenant ;
            inv:membershipStatus`,
        "inv:membershipStatus"
      )
      const rows = yield* asked(graph, anyTenant, stewardshipVariables)
      expect(rows).toStrictEqual([])
    })
  )
})

/** The clause CQ-P06, its mutant M5 and CQ-P07 share, which leaves out a membership that names a workspace. */
const workspaceClause = "FILTER NOT EXISTS { ?member inv:membershipWorkspace ?workspace }"

/** A question as committed, with the workspace clause taken out: checked to change the text. */
const withoutWorkspaceClause = (query: string) => {
  const planted = Str.replace(workspaceClause, "")(query)
  expect(planted).not.toBe(query)
  return planted
}

// Decision 154: a Sutton membership names the workspace it lets its person act in, and CQ-P06 and CQ-P07 leave it out.
// A Sutton member holds no grant (decision 131), so the membership below, naming a workspace beside a grant, is a plant
// made in the test, as report 18 section 10 says of CQ-P07's; the same membership naming none is the near miss.
describe("gate 8, a membership that names a source's workspace (decision 154)", () => {
  it.effect("CQ-P06: test_RaviWorks naming a workspace is no row; without the clause, or the link, it is one", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const n = yield* names
      const p = yield* partyNames
      const expected = yield* expectedMembers
      const named = [...graph, link(n.raviWorks, n.inv("membershipWorkspace"), p.record("test_SuttonWorkspace"))]
      const rows = yield* asked(named, membersAndRoles, membersVariables)
      expect(rows).toStrictEqual(A.drop(expected, 1))
      const planted = yield* asked(named, withoutWorkspaceClause(membersAndRoles), membersVariables)
      expect(planted).toStrictEqual(expected)
      const nearMiss = yield* asked(graph, membersAndRoles, membersVariables)
      expect(nearMiss).toStrictEqual(expected)
      // M5 leaves it out as the question does, so it still differs from it by its join alone.
      const mutant = yield* asked(named, mutantThroughPerson, membersVariables)
      expect(A.filter(mutant, (row) => A.contains(row, n.raviWorks))).toStrictEqual([])
      const plantedMutant = yield* asked(named, withoutWorkspaceClause(mutantThroughPerson), membersVariables)
      expect(A.filter(plantedMutant, (row) => A.contains(row, n.raviWorks))).toHaveLength(2)
    })
  )

  it.effect(
    "CQ-P07: an active admin naming a workspace keeps test_SecondOrg a row; without the clause, or the link, it is none",
    () =>
      Effect.gen(function* () {
        const p = yield* partyNames
        const graph = yield* fixtureGraph(stewardship.fixture)
        const empty = p.data("test_EmptyOrg", "Tenant", "test_EmptyOrg")
        const member = p.member("test_SecondSuttonAdmin")
        const grant = p.grant("test_SecondSuttonAdminGrant")
        const admin = [
          link(member, type, p.inv("Member")),
          link(member, p.inv("membershipIn"), p.second),
          link(member, p.inv("membershipStatus"), p.inv("MembershipStatusScheme-active")),
          link(grant, type, p.inv("Grant")),
          link(grant, p.inv("grantedTo"), member),
          link(grant, p.inv("grantsRole"), p.admin)
        ]
        const naming = [
          ...graph,
          ...admin,
          link(member, p.inv("membershipWorkspace"), p.record("test_SuttonWorkspace"))
        ]
        const rows = yield* asked(naming, stewardship.query, stewardshipVariables)
        expect(rows).toStrictEqual([[empty], [p.second]])
        const planted = yield* asked(naming, withoutWorkspaceClause(stewardship.query), stewardshipVariables)
        expect(planted).toStrictEqual([[empty]])
        const nearMiss = yield* asked([...graph, ...admin], stewardship.query, stewardshipVariables)
        expect(nearMiss).toStrictEqual([[empty]])
      })
  )
})

/** CQ-P03 as committed with one clause changed: each plant below is checked to change the text. */
const plantedContacts = (from: string, to: string) => {
  const planted = Str.replace(from, to)(contacts.query)
  expect(planted).not.toBe(contacts.query)
  return planted
}

/** CQ-P03's purpose clause, read from the assignment itself. */
const ownPurpose = "OPTIONAL { ?assignment inv:servesPurpose ?purpose }"

/** The names of CQ-P03's fixture, built from the vocabulary. */
const contactNames = Effect.gen(function* () {
  const p = yield* partyNames
  const { vocabulary } = yield* threadContext
  const assignment = (name: string) => `${vocabulary.base}/fixture/ContactAssignment/${name}`
  return {
    ...p,
    assignment,
    bakery: p.organization("test_Bakery"),
    mill: p.organization("test_Mill"),
    pat: p.individual("test_Pat"),
    sam: p.individual("test_Sam"),
    patRecord: p.record("test_PatRecord"),
    samRecord: p.record("test_SamRecord"),
    patPoint: `${p.record("test_PatRecord")}/email`,
    samPoint: `${p.record("test_SamRecord")}/email`,
    billing: p.inv("ContactPurposeScheme-billing"),
    receiving: p.inv("ContactPurposeScheme-receiving")
  }
})

/** CQ-P03's three rows on its fixture: each purpose at its own account, and test_Sam's assignment with none. */
const contactRows = Effect.map(contactNames, (c) => ({
  patBilling: [c.works, c.bakery, c.pat, c.billing, "test_pat@example.org"],
  samUnstated: [c.works, c.bakery, c.sam, "", "test_sam@example.org"],
  patReceiving: [c.works, c.mill, c.pat, c.receiving, "test_pat@example.org"]
}))

describe("gate 8, CQ-P03: the people a tenant reaches at each account, for which purpose", () => {
  it.effect("test_Pat billing at test_Bakery and receiving at test_Mill, test_Sam at test_Bakery with no purpose", () =>
    Effect.gen(function* () {
      const r = yield* contactRows
      const graph = yield* fixtureGraph(contacts.fixture)
      const rows = yield* asked(graph, contacts.query, contactsVariables)
      expect(rows).toStrictEqual([r.patBilling, r.samUnstated, r.patReceiving])
    })
  )

  // Report 04: joining the purpose on the person or on the point alone mixes the accounts, since both of test_Pat's
  // assignments name one person and one point.
  it.effect("must-fail: the purpose read through the person, or through the point, lists each at both accounts", () =>
    Effect.gen(function* () {
      const c = yield* contactNames
      const r = yield* contactRows
      const graph = yield* fixtureGraph(contacts.fixture)
      const mixed = [
        r.patBilling,
        [c.works, c.bakery, c.pat, c.receiving, "test_pat@example.org"],
        r.samUnstated,
        [c.works, c.mill, c.pat, c.billing, "test_pat@example.org"],
        r.patReceiving
      ]
      const throughPerson = plantedContacts(
        ownPurpose,
        "OPTIONAL { ?other inv:contactPerson ?person ; inv:servesPurpose ?purpose }"
      )
      const throughPoint = plantedContacts(
        ownPurpose,
        "OPTIONAL { ?other inv:assignmentPoint ?point ; inv:servesPurpose ?purpose }"
      )
      const byPerson = yield* asked(graph, throughPerson, contactsVariables)
      const byPoint = yield* asked(graph, throughPoint, contactsVariables)
      expect([byPerson, byPoint]).toStrictEqual([mixed, mixed])
    })
  )

  it.effect("an assignment with no purpose is listed under none; with the purpose required it is missing", () =>
    Effect.gen(function* () {
      const r = yield* contactRows
      const graph = yield* fixtureGraph(contacts.fixture)
      const required = plantedContacts(ownPurpose, "?assignment inv:servesPurpose ?purpose .")
      const rows = yield* asked(graph, required, contactsVariables)
      expect(rows).toStrictEqual([r.patBilling, r.patReceiving])
    })
  )

  // Each type step: the node left untyped loses its rows, and the query with that step taken out lists them again.
  it.effect("an assignment, account, person or point that is not typed so is no row, each by its own type step", () =>
    Effect.gen(function* () {
      const c = yield* contactNames
      const r = yield* contactRows
      const graph = yield* fixtureGraph(contacts.fixture)
      const all = [r.patBilling, r.samUnstated, r.patReceiving]
      const cases: ReadonlyArray<readonly [string, string, string, ReadonlyArray<ReadonlyArray<string>>]> = [
        [
          c.assignment("test_PatBilling"),
          "?assignment rdf:type/rdfs:subClassOf* inv:ContactAssignment ;",
          "?assignment",
          [r.samUnstated, r.patReceiving]
        ],
        [c.bakery, "  ?account rdf:type/rdfs:subClassOf* inv:Party .\n", "", [r.patReceiving]],
        [c.pat, "  ?person rdf:type/rdfs:subClassOf* inv:Person .\n", "", [r.samUnstated]],
        [c.patPoint, "?point rdf:type/rdfs:subClassOf* inv:ContactPoint ;", "?point", [r.samUnstated]]
      ]
      for (const [subject, step, replacement, left] of cases) {
        const untyped = dropped(graph, subject, type)
        expect(untyped).toHaveLength(graph.length - 1)
        const rows = yield* asked(untyped, contacts.query, contactsVariables)
        expect(rows).toStrictEqual(left)
        const stepless = yield* asked(untyped, plantedContacts(step, replacement), contactsVariables)
        expect(stepless).toStrictEqual(all)
      }
    })
  )

  it.effect("must-fail: an assignment that states no tenant is no row", () =>
    Effect.gen(function* () {
      const c = yield* contactNames
      const r = yield* contactRows
      const graph = yield* fixtureGraph(contacts.fixture)
      const untenanted = dropped(graph, c.assignment("test_SamUnstated"), c.inv("inTenant"))
      expect(untenanted).toHaveLength(graph.length - 1)
      const rows = yield* asked(untenanted, contacts.query, contactsVariables)
      expect(rows).toStrictEqual([r.patBilling, r.patReceiving])
    })
  )

  // Decision 159: the tenant's record of the person gives the point, which both of test_Pat's assignments name; the
  // query reads neither the record nor its link (report 18 section 10). Decision 140: each record is one of a source
  // that records a contact's purpose, test_Ledger, never Sutton's.
  it.effect("the point is the email field of the person's record, and the answer stands without the records", () =>
    Effect.gen(function* () {
      const c = yield* contactNames
      const r = yield* contactRows
      const graph = yield* fixtureGraph(contacts.fixture)
      const records: ReadonlyArray<readonly [string, string]> = [
        [c.patRecord, "C0001"],
        [c.samRecord, "C0002"]
      ]
      for (const [record, id] of records) {
        expect(objectsOf(graph, record, c.inv("sourceSystem"))).toStrictEqual(["test_Ledger"])
        expect(objectsOf(graph, record, c.inv("sourceType"))).toStrictEqual(["Contact"])
        expect(objectsOf(graph, record, c.inv("sourceId"))).toStrictEqual([id])
      }
      expect(objectsOf(graph, c.patRecord, c.inv("recordOf"))).toStrictEqual([c.pat])
      expect(objectsOf(graph, c.patRecord, c.inv("hasContactPoint"))).toStrictEqual([c.patPoint])
      expect(objectsOf(graph, c.samRecord, c.inv("hasContactPoint"))).toStrictEqual([c.samPoint])
      expect(objectsOf(graph, c.assignment("test_PatBilling"), c.inv("assignmentPoint"))).toStrictEqual([c.patPoint])
      expect(objectsOf(graph, c.assignment("test_PatReceiving"), c.inv("assignmentPoint"))).toStrictEqual([c.patPoint])
      const recordless = withoutSubjects(graph, [c.patRecord, c.samRecord])
      expect(recordless.length).toBeLessThan(graph.length)
      const rows = yield* asked(recordless, contacts.query, contactsVariables)
      expect(rows).toStrictEqual([r.patBilling, r.samUnstated, r.patReceiving])
    })
  )

  // Decisions 126 and 140: no contact assignment is made for a Sutton record, so sutton-party.ttl, which states a
  // contact, its company and its points, gives CQ-P03 no row.
  it.effect("must-fail: sutton-party.ttl, a source that records no contact's purpose, gives no row", () =>
    Effect.gen(function* () {
      const c = yield* contactNames
      const graph = yield* fixtureGraph(suttonParty)
      expect(A.some(graph, withPredicate(c.inv("contactAt")))).toBe(true)
      expect(A.some(graph, withPredicate(c.inv("hasContactPoint")))).toBe(true)
      const rows = yield* asked(graph, contacts.query, contactsVariables)
      expect(rows).toStrictEqual([])
    })
  )

  // Decision 12: Party is never typed directly, so the account's type step needs the walk even on the graph as typed.
  it.effect("the walk: the same rows one subclass down, and its bare twin finds no account typed a Party", () =>
    Effect.gen(function* () {
      const graph = yield* fixtureGraph(contacts.fixture)
      const rows = yield* asked(graph, contacts.query, contactsVariables)
      const below = yield* asked(movedDown(graph), contacts.query, contactsVariables)
      expect(rows).not.toStrictEqual([])
      expect(below).toStrictEqual(rows)
      const bare = bareStep(contacts.query)
      expect(bare).not.toContain(walk)
      const bareRows = yield* asked(graph, bare, contactsVariables)
      expect(bareRows).toStrictEqual([])
    })
  )
})

/** The records of sutton-party.ttl, built from the vocabulary. */
const suttonNames = Effect.gen(function* () {
  const p = yield* partyNames
  const { vocabulary } = yield* threadContext
  return {
    ...p,
    company: p.record("test_HarborCompany"),
    contact: p.record("test_HarborContact"),
    workspace: p.record("test_SuttonWorkspace"),
    suttonMember: p.member("test_SuttonMember"),
    address: `${vocabulary.base}/fixture/PostalAddress/test_HarborDock`,
    user: `${vocabulary.base}/fixture/SignInAccount/test_SuttonUser`
  }
})

/**
 * What sutton-party.ttl places on each record against report 18's coverage table (sections 4 and 9), each fault a
 * sentence: a property the table puts on a record that the record leaves off, one the table leaves off that the record
 * states (neither flag on the contact or the workspace, decision 168; no `sourceSystem`, section 12; no person on the
 * member, decision 133), a contact point with no kind or value, and a grant, which no Sutton field places (decision
 * 131). None for the committed file.
 */
const placementFaults = (
  graph: ReadonlyArray<Triple>,
  s: Effect.Success<typeof suttonNames>
): ReadonlyArray<string> => {
  const keys = ["inTenant", "sourceType", "sourceId", "recordOf", "name"]
  const noFlag = ["isCustomer", "isVendor", "sourceSystem"]
  const table: ReadonlyArray<readonly [string, ReadonlyArray<string>, ReadonlyArray<string>]> = [
    [s.company, [...keys, "isCustomer", "isVendor"], ["sourceSystem"]],
    [s.contact, [...keys, "hasContactPoint"], noFlag],
    [s.workspace, keys, noFlag],
    [
      s.suttonMember,
      ["membershipIn", "membershipWorkspace", "memberAccount", "membershipStatus", "name", "memberContactPoint"],
      ["membershipOf"]
    ],
    [s.address, ["inTenant", "name"], []],
    [s.user, ["accountEmail"], []]
  ]
  const stated = (subject: string, key: string) => A.length(objectsOf(graph, subject, s.inv(key))) > 0
  const points = [
    ...objectsOf(graph, s.contact, s.inv("hasContactPoint")),
    ...objectsOf(graph, s.suttonMember, s.inv("memberContactPoint"))
  ]
  const grants = A.dedupe([
    ...typedAs(graph, s.inv("Grant")),
    ...A.map(A.filter(graph, withPredicate(s.inv("grantedTo"))), (triple) => triple.subject)
  ])
  return [
    ...A.flatMap(table, ([subject, placed, left]) => [
      ...A.map(
        A.filter(placed, (key) => !stated(subject, key)),
        (key) => `${subject} does not state ${key}`
      ),
      ...A.map(
        A.filter(left, (key) => stated(subject, key)),
        (key) => `${subject} states ${key}, which the table leaves off`
      )
    ]),
    ...A.flatMap(points, (point) =>
      A.map(
        A.filter(["contactPointKind", "contactValue"], (key) => !stated(point, key)),
        (key) => `${point} does not state ${key}`
      )
    ),
    ...A.map(grants, (grant) => `${grant} is a grant, which no Sutton field places`)
  ]
}

describe("gate 8, sutton-party.ttl: each record states what the coverage table places on it", () => {
  it.effect("near miss: the committed file has no fault", () =>
    Effect.gen(function* () {
      const s = yield* suttonNames
      const graph = yield* fixtureGraph(suttonParty)
      expect(placementFaults(graph, s)).toStrictEqual([])
    })
  )

  it.effect("planted: each misplacement is one fault, a flag on the contact's record first (decision 168)", () =>
    Effect.gen(function* () {
      const s = yield* suttonNames
      const graph = yield* fixtureGraph(suttonParty)
      const flag = (subject: string, key: string, value: string) =>
        literal(subject, s.inv(key), value, `${RdfVocab.xsd.iri}boolean`)
      const words = (subject: string, key: string, value: string) =>
        literal(subject, s.inv(key), value, `${RdfVocab.xsd.iri}string`)
      const email = `${s.contact}/email`
      const grant = s.grant("test_SuttonGrant")
      const added: ReadonlyArray<readonly [Triple, string]> = [
        [flag(s.contact, "isCustomer", "true"), `${s.contact} states isCustomer, which the table leaves off`],
        [flag(s.workspace, "isVendor", "false"), `${s.workspace} states isVendor, which the table leaves off`],
        [
          words(s.company, "sourceSystem", "test_Sutton"),
          `${s.company} states sourceSystem, which the table leaves off`
        ],
        [
          link(s.suttonMember, s.inv("membershipOf"), s.individual("test_Kim")),
          `${s.suttonMember} states membershipOf, which the table leaves off`
        ],
        [link(grant, s.inv("grantedTo"), s.suttonMember), `${grant} is a grant, which no Sutton field places`]
      ]
      const removed: ReadonlyArray<readonly [string, string]> = [
        [s.company, "isCustomer"],
        [s.company, "recordOf"],
        [s.workspace, "recordOf"],
        [s.contact, "name"],
        [s.suttonMember, "membershipIn"],
        [s.suttonMember, "memberAccount"],
        [s.suttonMember, "name"],
        [s.address, "inTenant"],
        [s.address, "name"],
        [s.user, "accountEmail"]
      ]
      for (const [triple, fault] of added) {
        expect(placementFaults([...graph, triple], s)).toStrictEqual([fault])
      }
      for (const [subject, key] of removed) {
        const less = dropped(graph, subject, s.inv(key))
        expect(less).toHaveLength(graph.length - 1)
        expect(placementFaults(less, s)).toStrictEqual([`${subject} does not state ${key}`])
      }
      const valueless = dropped(graph, email, s.inv("contactValue"))
      expect(valueless).toHaveLength(graph.length - 1)
      expect(placementFaults(valueless, s)).toStrictEqual([`${email} does not state contactValue`])
    })
  )
})

/** CQ-P01 as committed, with each flag read from any record of the organization instead of the tenant's own. */
const flagsFromAnyRecord = Str.replace(
  `inv:recordOf ?organization ;
          inv:isCustomer true ;
          inv:isVendor true .`,
  `inv:recordOf ?organization .
  ?buying inv:recordOf ?organization ;
          inv:isCustomer true .
  ?selling inv:recordOf ?organization ;
           inv:isVendor true .`
)

/** A question as committed, with its organization type step left out. */
const untypedOrganization = Str.replace("  ?organization rdf:type/rdfs:subClassOf* inv:Organization .\n", "")

/** CQ-P02 as committed, with a flag that is not stated true read as false. */
const absentAsFalse = Str.replace(
  `inv:recordOf ?organization ;
          inv:isCustomer false ;
          inv:isVendor false .`,
  `inv:recordOf ?organization .
  FILTER NOT EXISTS { ?record inv:isCustomer true }
  FILTER NOT EXISTS { ?record inv:isVendor true }`
)

/** CQ-P02 as committed, asking only that the record states isVendor false. */
const vendorFlagOnly = Str.replace("          inv:isCustomer false ;\n", "")

describe("gate 8, CQ-P01: the organizations a tenant both buys from and sells to", () => {
  it.effect("each tenant's co-packer, read on its own record; for one tenant, its rows alone", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(trading.fixture)
      const rows = yield* asked(graph, trading.query, tradingVariables)
      expect(rows).toStrictEqual([
        [n.works, n.organization("test_CoPacker")],
        [n.second, n.organization("test_OtherCoPacker")]
      ])
      expect(A.filter(rows, ([tenant]) => tenant === n.works)).toStrictEqual([
        [n.works, n.organization("test_CoPacker")]
      ])
    })
  )

  it.effect("must-fail: with isCustomer removed from test_CoPacker's record, its row is missing", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(trading.fixture)
      const less = dropped(graph, n.record("test_WorksCoPacker"), n.inv("isCustomer"))
      expect(less).toHaveLength(graph.length - 1)
      const rows = yield* asked(less, trading.query, tradingVariables)
      expect(rows).toStrictEqual([[n.second, n.organization("test_OtherCoPacker")]])
    })
  )

  it.effect("must-fail: test_SharedCo, a customer of one tenant and a vendor of the other, is listed for neither", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(trading.fixture)
      const shared = n.organization("test_SharedCo")
      const rows = yield* asked(graph, trading.query, tradingVariables)
      expect(A.filter(rows, ([, organization]) => organization === shared)).toStrictEqual([])
      // Planted: each flag read from any record of the organization lists it for both tenants (decision 34).
      const mutant = flagsFromAnyRecord(trading.query)
      expect(mutant).not.toBe(trading.query)
      const wrong = yield* asked(graph, mutant, tradingVariables)
      expect(wrong).toStrictEqual([
        [n.works, n.organization("test_CoPacker")],
        [n.works, shared],
        [n.second, n.organization("test_OtherCoPacker")],
        [n.second, shared]
      ])
    })
  )

  it.effect("must-fail: the record of a person, both flags true, is never listed as an organization", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(trading.fixture)
      const trader = n.individual("test_SoleTrader")
      const rows = yield* asked(graph, trading.query, tradingVariables)
      expect(A.filter(rows, ([, organization]) => organization === trader)).toStrictEqual([])
      // Planted: without the organization type step, the person is listed beside the co-packer.
      const mutant = untypedOrganization(trading.query)
      expect(mutant).not.toBe(trading.query)
      const wrong = yield* asked(graph, mutant, tradingVariables)
      expect(wrong).toContainEqual([n.works, trader])
    })
  )

  it.effect("its fixture states each record's three source keys and one capturedAt, its latest read", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(trading.fixture)
      const records = A.map(
        A.filter(graph, (triple) => triple.predicate === type && iriOf(triple) === n.inv("SourceRecord")),
        (triple) => triple.subject
      )
      expect(records).toHaveLength(6)
      const keys = ["sourceSystem", "sourceType", "sourceId", "capturedAt"]
      for (const record of records) {
        const counts = A.map(keys, (key) =>
          A.length(A.filter(graph, (triple) => triple.subject === record && triple.predicate === n.inv(key)))
        )
        expect(counts).toStrictEqual([1, 1, 1, 1])
      }
      // SourceRecord's criterion: an id is kept as written, leading zeros included, and the same id in two tenants
      // is two records.
      const idOf = (record: string) =>
        A.map(
          A.filter(graph, (triple) => triple.subject === record && triple.predicate === n.inv("sourceId")),
          (triple) => triple.object
        )
      const works = n.record("test_WorksCoPacker")
      const second = n.record("test_SecondOtherCoPacker")
      expect(records).toContain(works)
      expect(records).toContain(second)
      expect(works).not.toBe(second)
      expect(idOf(works)).toMatchObject([{ kind: "literal", value: "0001" }])
      expect(idOf(second)).toStrictEqual(idOf(works))
    })
  )
})

describe("gate 8, CQ-P02: the organizations a tenant's record says hold no trading role", () => {
  it.effect("only a record that states both flags false: the dormant company here, the open company there", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(roleless.fixture)
      const rows = yield* asked(graph, roleless.query, tradingVariables)
      // No row for the record with one flag, the buyer, the retired person or the tenant's own workspace.
      expect(rows).toStrictEqual([
        [n.works, n.organization("test_DormantCo")],
        [n.second, n.organization("test_OpenCo")]
      ])
    })
  )

  it.effect(
    "must-fail: the open reading, no flag stated, is not listed, whatever the other tenant's record states",
    () =>
      Effect.gen(function* () {
        const n = yield* partyNames
        const graph = yield* fixtureGraph(roleless.fixture)
        const open = n.organization("test_OpenCo")
        const rows = yield* asked(graph, roleless.query, tradingVariables)
        expect(rows).not.toContainEqual([n.works, open])
        // Planted: a flag not stated true read as false lists the open reading, the half-known record and the workspace.
        const mutant = absentAsFalse(roleless.query)
        expect(mutant).not.toBe(roleless.query)
        const wrong = yield* asked(graph, mutant, tradingVariables)
        expect(wrong).toStrictEqual([
          [n.works, n.works],
          [n.works, n.organization("test_DormantCo")],
          [n.works, n.organization("test_HalfKnownCo")],
          [n.works, open],
          [n.second, open]
        ])
      })
  )

  it.effect(
    "must-fail: with the dormant company's isVendor false removed, its record is open and its row is gone",
    () =>
      Effect.gen(function* () {
        const n = yield* partyNames
        const graph = yield* fixtureGraph(roleless.fixture)
        const less = dropped(graph, n.record("test_WorksDormantCo"), n.inv("isVendor"))
        expect(less).toHaveLength(graph.length - 1)
        const rows = yield* asked(less, roleless.query, tradingVariables)
        expect(rows).toStrictEqual([[n.second, n.organization("test_OpenCo")]])
      })
  )

  it.effect("must-fail: the record of a person, both flags false, is never listed as an organization", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(roleless.fixture)
      const retiree = n.individual("test_Retiree")
      const rows = yield* asked(graph, roleless.query, tradingVariables)
      expect(A.filter(rows, ([, organization]) => organization === retiree)).toStrictEqual([])
      // Planted: without the organization type step, the retired person is listed beside the dormant company.
      const mutant = untypedOrganization(roleless.query)
      expect(mutant).not.toBe(roleless.query)
      const wrong = yield* asked(graph, mutant, tradingVariables)
      expect(wrong).toStrictEqual([
        [n.works, n.organization("test_DormantCo")],
        [n.works, retiree],
        [n.second, n.organization("test_OpenCo")]
      ])
    })
  )

  it.effect("must-fail: the buyer, isCustomer true and isVendor false, holds a trading role and is not listed", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(roleless.fixture)
      const buyer = n.organization("test_BuyerCo")
      const rows = yield* asked(graph, roleless.query, tradingVariables)
      expect(A.filter(rows, ([, organization]) => organization === buyer)).toStrictEqual([])
      // Planted: a question that asks only for isVendor false lists the buyer.
      const mutant = vendorFlagOnly(roleless.query)
      expect(mutant).not.toBe(roleless.query)
      const wrong = yield* asked(graph, mutant, tradingVariables)
      expect(wrong).toStrictEqual([
        [n.works, buyer],
        [n.works, n.organization("test_DormantCo")],
        [n.second, n.organization("test_OpenCo")]
      ])
    })
  )
})

describe("gate 8, CQ-P09's party half: a party record held by no tenant, or by two", () => {
  it.effect("one violation each for the record held by none and the record held by two", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(tenancy.fixture)
      const rows = yield* asked(graph, tenancy.query, tenancyVariables)
      expect(rows).toStrictEqual([
        [n.record("test_HeldNowhere"), "0"],
        [n.record("test_HeldTwice"), "2"]
      ])
    })
  )

  it.effect("must-fail: with the only inTenant of the record held once removed, it is a violation too", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(tenancy.fixture)
      const less = dropped(graph, n.record("test_HeldOnce"), n.inv("inTenant"))
      expect(less).toHaveLength(graph.length - 1)
      const rows = yield* asked(less, tenancy.query, tenancyVariables)
      expect(rows).toStrictEqual([
        [n.record("test_HeldNowhere"), "0"],
        [n.record("test_HeldOnce"), "0"],
        [n.record("test_HeldTwice"), "2"]
      ])
    })
  )

  it.effect("near miss: each record given exactly one tenant gives no row, beside the three records it reads", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(tenancy.fixture)
      const twice = n.record("test_HeldTwice")
      const repaired = [
        ...A.filter(graph, (triple) => !(triple.subject === twice && iriOf(triple) === n.second)),
        link(n.record("test_HeldNowhere"), n.inv("inTenant"), n.works)
      ]
      expect(repaired).toHaveLength(graph.length)
      const rows = yield* asked(repaired, tenancy.query, tenancyVariables)
      expect(rows).toStrictEqual([])
      // The companion: the same graph holds the three source records the constraint reads.
      const records = yield* asked(
        repaired,
        `PREFIX inv: <${n.inv("")}>
PREFIX rdf: <${RdfVocab.rdf.iri}>
PREFIX rdfs: <${RdfVocab.rdfs.iri}>
SELECT ?record WHERE { ?record ${walk} inv:SourceRecord } ORDER BY ?record`,
        ["record"]
      )
      expect(records).toStrictEqual([[n.record("test_HeldNowhere")], [n.record("test_HeldOnce")], [twice]])
    })
  )
})

/** CQ-P04's clause that keeps a pair only while no later decision of the tenant about it exists. */
const laterDecision = `  FILTER NOT EXISTS {
    ?later rdf:type/rdfs:subClassOf* inv:IdentityDecision ;
           inv:inTenant ?tenant ;
           inv:decidesOn ?a , ?b ;
           inv:eventTime ?laterAt .
    FILTER (?laterAt > ?at)
  }
`

/** CQ-P04 as committed, with no later decision read: every sameParty decision is in force. */
const everyDecision = Str.replace(laterDecision, "")

/** CQ-P04 as committed, with a later decision read whatever tenant holds it. */
const laterOfAnyTenant = Str.replace(
  `?later rdf:type/rdfs:subClassOf* inv:IdentityDecision ;
           inv:inTenant ?tenant ;`,
  "?later rdf:type/rdfs:subClassOf* inv:IdentityDecision ;"
)

/** CQ-P04 as committed, with the pair's records read whatever tenant holds them. */
const recordsOfAnyTenant = Str.replaceAll(
  `inv:SourceRecord ;
     inv:inTenant ?tenant .`,
  "inv:SourceRecord ."
)

/** CQ-P04 as committed, with the record `?a` read whatever tenant holds it, and `?b` still the tenant's. */
const firstOfAnyTenant = Str.replace(
  `?a rdf:type/rdfs:subClassOf* inv:SourceRecord ;
     inv:inTenant ?tenant .`,
  "?a rdf:type/rdfs:subClassOf* inv:SourceRecord ."
)

/** CQ-P04 as committed, with the record `?b` read whatever tenant holds it, and `?a` still the tenant's. */
const secondOfAnyTenant = Str.replace(
  `?b rdf:type/rdfs:subClassOf* inv:SourceRecord ;
     inv:inTenant ?tenant .`,
  "?b rdf:type/rdfs:subClassOf* inv:SourceRecord ."
)

/** CQ-P04 as committed, with a later decision about `?a` taken as one about the pair, whatever its other record. */
const laterAboutFirst = Str.replace(
  `inv:decidesOn ?a , ?b ;
           inv:eventTime ?laterAt .`,
  `inv:decidesOn ?a ;
           inv:eventTime ?laterAt .`
)

/** CQ-P04 as committed, with a later decision about `?b` taken as one about the pair, whatever its other record. */
const laterAboutSecond = Str.replace(
  `inv:decidesOn ?a , ?b ;
           inv:eventTime ?laterAt .`,
  `inv:decidesOn ?b ;
           inv:eventTime ?laterAt .`
)

/** CQ-P04 as committed, with any node that states a decision's properties read as a decision, typed or not. */
const decisionOfAnyType = Str.replace(
  `?decision rdf:type/rdfs:subClassOf* inv:IdentityDecision ;
            inv:inTenant ?tenant ;`,
  "?decision inv:inTenant ?tenant ;"
)

/** CQ-P04's one row on its fixture: the pair test_Dana decided at 09:00, with the evidence it cites. */
const pairInForce = Effect.map(partyNames, (n) => [
  n.works,
  n.record("test_AcmeA"),
  n.record("test_AcmeB"),
  n.member("test_Dana"),
  "2026-11-01T09:00:00Z",
  "same tax id"
])

/** `graph` less every triple whose subject is one of `subjects`. */
const withoutSubjects = (graph: ReadonlyArray<Triple>, subjects: ReadonlyArray<string>) =>
  A.filter(graph, (triple) => !A.contains(subjects, triple.subject))

/** The triples of one identity decision, written in the test: never a fixture's, so a plant adds what it says. */
const decisionTriples = Effect.fnUntraced(function* (given: {
  readonly name: string
  readonly tenant: string
  readonly pair: readonly [string, string]
  readonly outcome: string
  readonly decider: string
  readonly at: string
}) {
  const n = yield* partyNames
  const decision = n.decision(given.name)
  return [
    link(decision, type, n.inv("IdentityDecision")),
    link(decision, n.inv("inTenant"), given.tenant),
    link(decision, n.inv("decidesOn"), n.record(given.pair[0])),
    link(decision, n.inv("decidesOn"), n.record(given.pair[1])),
    link(decision, n.inv("identityOutcome"), n.inv(`IdentityOutcomeScheme-${given.outcome}`)),
    link(decision, n.inv("decidedBy"), n.member(given.decider)),
    n.instant(given.at)(decision)
  ]
})

/** The objects `graph` states of `subject` by `predicate`: each an IRI, or a value as written. */
const objectsOf = (graph: ReadonlyArray<Triple>, subject: string, predicate: string) =>
  A.map(
    A.filter(graph, (triple) => triple.subject === subject && triple.predicate === predicate),
    (triple) =>
      ObjectNode.match(triple.object, {
        iri: (node) => node.iri,
        literal: (node) => node.value,
        text: (node) => node.value
      })
  )

/** The subjects `graph` types as `kind`, with no walk: a fixture states its nodes' own classes. */
const typedAs = (graph: ReadonlyArray<Triple>, kind: string) =>
  A.map(
    A.filter(graph, (triple) => triple.predicate === type && iriOf(triple) === kind),
    (triple) => triple.subject
  )

/**
 * What CQ-P04's fixture states beside what the question reads (report 18 section 10), each fault a sentence: every
 * record, piece of evidence and decision typed and stating one tenant, every record its three source keys, every
 * decider a member of the decision's tenant, and every tenant typed. None for the committed fixture.
 */
const holdingFaults = (graph: ReadonlyArray<Triple>, inv: (local: string) => string): ReadonlyArray<string> => {
  const held = A.flatMap(["SourceRecord", "IdentityEvidence", "IdentityDecision"], (key) => typedAs(graph, inv(key)))
  const members = typedAs(graph, inv("Member"))
  const tenants = typedAs(graph, inv("Tenant"))
  const subjectsOf = (predicate: string) =>
    A.dedupe(A.map(A.filter(graph, withPredicate(predicate)), (triple) => triple.subject))
  const objectsBy = (predicate: string) =>
    A.flatMap(subjectsOf(predicate), (subject) => objectsOf(graph, subject, predicate))
  const once = (subject: string, predicate: string) =>
    A.length(objectsOf(graph, subject, predicate)) === 1
      ? []
      : [`${subject} states ${predicate} ${String(A.length(objectsOf(graph, subject, predicate)))} times`]
  return [
    ...A.map(A.difference(subjectsOf(inv("inTenant")), held), (node) => `${node} states a tenant and holds no type`),
    ...A.flatMap(held, (node) => once(node, inv("inTenant"))),
    ...A.flatMap(typedAs(graph, inv("SourceRecord")), (record) =>
      A.flatMap(["sourceSystem", "sourceType", "sourceId"], (key) => once(record, inv(key)))
    ),
    ...A.flatMap(A.dedupe([...subjectsOf(inv("membershipIn")), ...members]), (member) =>
      once(member, inv("membershipIn"))
    ),
    ...A.flatMap(typedAs(graph, inv("IdentityDecision")), (decision) =>
      A.flatMap(objectsOf(graph, decision, inv("decidedBy")), (member) =>
        A.contains(members, member) &&
        A.every(objectsOf(graph, decision, inv("inTenant")), (tenant) =>
          A.contains(objectsOf(graph, member, inv("membershipIn")), tenant)
        )
          ? []
          : [`${decision} is decided by ${member}, no member of its tenant`]
      )
    ),
    ...A.flatMap(A.dedupe([...objectsBy(inv("inTenant")), ...objectsBy(inv("membershipIn"))]), (tenant) =>
      A.contains(tenants, tenant) ? [] : [`${tenant} is named as a tenant and not typed one`]
    )
  ]
}

/** The source ids of the records `graph` gives `tenant`, in code point order. */
const idsHeld = (graph: ReadonlyArray<Triple>, inv: (local: string) => string, tenant: string) => {
  const records = A.filter(typedAs(graph, inv("SourceRecord")), (record) =>
    A.contains(objectsOf(graph, record, inv("inTenant")), tenant)
  )
  return A.sort(
    A.flatMap(records, (record: string) => objectsOf(graph, record, inv("sourceId"))),
    byCodePoint
  )
}

describe("gate 8, CQ-P04: the pairs of a tenant's records decided to be one party", () => {
  it.effect(
    'test_AcmeA and test_AcmeB, by test_Dana at 09:00, on the evidence "same tax id"; the second tenant none',
    () =>
      Effect.gen(function* () {
        const n = yield* partyNames
        const graph = yield* fixtureGraph(identity.fixture)
        const inForce = yield* pairInForce
        const rows = yield* asked(graph, identity.query, identityVariables)
        expect(rows).toStrictEqual([inForce])
        expect(A.filter(rows, ([tenant]) => tenant === n.second)).toStrictEqual([])
      })
  )

  it.effect("must-fail: a reversed decision gives no row, and the reversal alone hides test_AcmeE and test_AcmeF", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(identity.fixture)
      const reversed = [n.record("test_AcmeE"), n.record("test_AcmeF")]
      const rows = yield* asked(graph, identity.query, identityVariables)
      expect(A.filter(rows, ([, a, b]) => A.contains(reversed, a) || A.contains(reversed, b))).toStrictEqual([])
      // Planted: with no later decision read, every sameParty decision is in force, reversed or not.
      const mutant = everyDecision(identity.query)
      expect(mutant).not.toBe(identity.query)
      const wrong = yield* asked(graph, mutant, identityVariables)
      expect(A.map(wrong, A.take(4))).toStrictEqual([
        [n.works, n.record("test_AcmeA"), n.record("test_AcmeB"), n.member("test_Dana")],
        [n.works, n.record("test_AcmeE"), n.record("test_AcmeF"), n.member("test_Dana")],
        [n.second, n.record("test_SecondAcmeA"), n.record("test_SecondAcmeB"), n.member("test_Kim")]
      ])
      // Near miss: with test_Decision3 gone, nothing reverses test_Decision2 and the committed question lists E and F.
      const inForce = yield* pairInForce
      const unreversed = withoutSubjects(graph, [n.decision("test_Decision3")])
      expect(unreversed).toHaveLength(graph.length - 7)
      const restored = yield* asked(unreversed, identity.query, identityVariables)
      expect(restored).toStrictEqual([
        inForce,
        [n.works, ...reversed, n.member("test_Dana"), "2026-11-01T10:00:00Z", ""]
      ])
    })
  )

  it.effect("must-fail: the second tenant's decisions add no row to the first's answer and hide none of it", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(identity.fixture)
      const rows = yield* asked(graph, identity.query, identityVariables)
      const seconds = [
        n.record("test_SecondAcmeA"),
        n.record("test_SecondAcmeB"),
        n.decision("test_Decision4"),
        n.decision("test_Decision5"),
        n.member("test_Kim")
      ]
      const alone = withoutSubjects(graph, seconds)
      // Two records of five triples, two decisions of seven and the member's two.
      expect(alone).toHaveLength(graph.length - 26)
      const firstAlone = yield* asked(alone, identity.query, identityVariables)
      expect(firstAlone).toStrictEqual(rows)
      // Near miss: with test_Decision5 gone, test_Decision4 is in force, and the second tenant's answer is its own row.
      const unreversed = withoutSubjects(graph, [n.decision("test_Decision5")])
      const both = yield* asked(unreversed, identity.query, identityVariables)
      expect(both).toStrictEqual([
        ...rows,
        [
          n.second,
          n.record("test_SecondAcmeA"),
          n.record("test_SecondAcmeB"),
          n.member("test_Kim"),
          "2026-11-01T12:00:00Z",
          ""
        ]
      ])
    })
  )

  it.effect(
    "must-fail: a decision the other tenant holds neither reverses this tenant's pair nor joins its records",
    () =>
      Effect.gen(function* () {
        const n = yield* partyNames
        const graph = yield* fixtureGraph(identity.fixture)
        const rows = yield* asked(graph, identity.query, identityVariables)
        // Planted: test_SecondOrg holds a later decision about the first tenant's A and B, and a sameParty decision
        // about the first tenant's C and D. Neither is that tenant's to make about those records.
        const reversal = yield* decisionTriples({
          name: "test_ForeignReversal",
          tenant: n.second,
          pair: ["test_AcmeA", "test_AcmeB"],
          outcome: "differentParties",
          decider: "test_Kim",
          at: "2026-11-01T14:00:00Z"
        })
        const joining = yield* decisionTriples({
          name: "test_ForeignJoin",
          tenant: n.second,
          pair: ["test_AcmeC", "test_AcmeD"],
          outcome: "sameParty",
          decider: "test_Kim",
          at: "2026-11-01T14:00:00Z"
        })
        const crossed = [...graph, ...reversal, ...joining]
        const answer = yield* asked(crossed, identity.query, identityVariables)
        expect(answer).toStrictEqual(rows)
        // Without the later decision's tenant, the other tenant's reversal hides A and B.
        const anyLater = laterOfAnyTenant(identity.query)
        expect(anyLater).not.toBe(identity.query)
        const hidden = yield* asked(crossed, anyLater, identityVariables)
        expect(hidden).toStrictEqual([])
        // Without the records' tenant, the other tenant's decision joins C and D for it.
        const anyRecords = recordsOfAnyTenant(identity.query)
        expect(anyRecords).not.toBe(identity.query)
        const joined = yield* asked(crossed, anyRecords, identityVariables)
        expect(joined).toContainEqual([
          n.second,
          n.record("test_AcmeC"),
          n.record("test_AcmeD"),
          n.member("test_Kim"),
          "2026-11-01T14:00:00Z",
          ""
        ])
      })
  )

  it.effect("must-fail: test_AcmeC and test_AcmeD, two records with no decision, give no pair", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(identity.fixture)
      const undecided = [n.record("test_AcmeC"), n.record("test_AcmeD")]
      const rows = yield* asked(graph, identity.query, identityVariables)
      expect(A.filter(rows, ([, a, b]) => A.contains(undecided, a) || A.contains(undecided, b))).toStrictEqual([])
      // Planted: given a sameParty decision of the tenant's about them, they are a pair; the decision is the answer.
      const decided = yield* decisionTriples({
        name: "test_DecisionCD",
        tenant: n.works,
        pair: ["test_AcmeC", "test_AcmeD"],
        outcome: "sameParty",
        decider: "test_Dana",
        at: "2026-11-01T14:00:00Z"
      })
      const inForce = yield* pairInForce
      const joined = yield* asked([...graph, ...decided], identity.query, identityVariables)
      expect(joined).toStrictEqual([
        inForce,
        [n.works, ...undecided, n.member("test_Dana"), "2026-11-01T14:00:00Z", ""]
      ])
    })
  )

  it.effect("must-fail: test_Decision1 finding different parties gives no row", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(identity.fixture)
      const decision = n.decision("test_Decision1")
      const turned = [
        ...dropped(graph, decision, n.inv("identityOutcome")),
        link(decision, n.inv("identityOutcome"), n.inv("IdentityOutcomeScheme-differentParties"))
      ]
      expect(turned).toHaveLength(graph.length)
      const rows = yield* asked(turned, identity.query, identityVariables)
      expect(rows).toStrictEqual([])
    })
  )

  it.effect("the evidence is read through citesEvidence and evidenceText; without the link the row has none", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(identity.fixture)
      const evidence = n.evidence("test_SameTaxId")
      const reworded = [
        ...dropped(graph, evidence, n.inv("evidenceText")),
        literal(evidence, n.inv("evidenceText"), "same bank account", `${RdfVocab.xsd.iri}string`)
      ]
      const rewordedRows = yield* asked(reworded, identity.query, identityVariables)
      expect(A.map(rewordedRows, A.drop(5))).toStrictEqual([["same bank account"]])
      const unlinked = dropped(graph, n.decision("test_Decision1"), n.inv("citesEvidence"))
      expect(unlinked).toHaveLength(graph.length - 1)
      const rows = yield* asked(unlinked, identity.query, identityVariables)
      expect(rows).toStrictEqual([
        [n.works, n.record("test_AcmeA"), n.record("test_AcmeB"), n.member("test_Dana"), "2026-11-01T09:00:00Z", ""]
      ])
    })
  )

  it.effect("must-fail: a decision pairing a record of one tenant with a record of the other gives no row", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(identity.fixture)
      const rows = yield* asked(graph, identity.query, identityVariables)
      // Planted: each tenant decides that its own record and the other tenant's are one party. test_AcmeC sorts before
      // test_SecondAcmeA, so the second tenant's decision has the other's record as ?a, the first tenant's as ?b.
      const foreign = yield* decisionTriples({
        name: "test_ForeignPair",
        tenant: n.second,
        pair: ["test_SecondAcmeA", "test_AcmeC"],
        outcome: "sameParty",
        decider: "test_Kim",
        at: "2026-11-01T14:00:00Z"
      })
      const mixed = yield* decisionTriples({
        name: "test_MixedPair",
        tenant: n.works,
        pair: ["test_AcmeC", "test_SecondAcmeA"],
        outcome: "sameParty",
        decider: "test_Dana",
        at: "2026-11-01T14:00:00Z"
      })
      const crossed = [...graph, ...foreign, ...mixed]
      const answer = yield* asked(crossed, identity.query, identityVariables)
      expect(answer).toStrictEqual(rows)
      const crossing = [n.record("test_AcmeC"), n.record("test_SecondAcmeA")]
      // Without ?a's tenant, the second tenant's decision lists the first tenant's test_AcmeC.
      const firstFree = firstOfAnyTenant(identity.query)
      expect(firstFree).not.toBe(identity.query)
      const firstRows = yield* asked(crossed, firstFree, identityVariables)
      expect(firstRows).toStrictEqual([
        ...rows,
        [n.second, ...crossing, n.member("test_Kim"), "2026-11-01T14:00:00Z", ""]
      ])
      // Without ?b's tenant, the first tenant's decision lists the second tenant's test_SecondAcmeA.
      const secondFree = secondOfAnyTenant(identity.query)
      expect(secondFree).not.toBe(identity.query)
      const secondRows = yield* asked(crossed, secondFree, identityVariables)
      expect(secondRows).toStrictEqual([
        ...rows,
        [n.works, ...crossing, n.member("test_Dana"), "2026-11-01T14:00:00Z", ""]
      ])
      // Near miss: the second tenant's decision about its own two records, later than its reversal, is its row.
      const own = yield* decisionTriples({
        name: "test_OwnPair",
        tenant: n.second,
        pair: ["test_SecondAcmeA", "test_SecondAcmeB"],
        outcome: "sameParty",
        decider: "test_Kim",
        at: "2026-11-01T14:00:00Z"
      })
      const owned = yield* asked([...graph, ...own], identity.query, identityVariables)
      expect(owned).toStrictEqual([
        ...rows,
        [
          n.second,
          n.record("test_SecondAcmeA"),
          n.record("test_SecondAcmeB"),
          n.member("test_Kim"),
          "2026-11-01T14:00:00Z",
          ""
        ]
      ])
    })
  )

  it.effect("must-fail: a later decision about one record of the pair and a third leaves the pair in force", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(identity.fixture)
      const inForce = yield* pairInForce
      // Planted: at noon test_Dana finds test_AcmeA and test_AcmeC two parties, and test_AcmeB and test_AcmeC two.
      // Neither is about the pair test_Decision1 joined.
      const withA = yield* decisionTriples({
        name: "test_DecisionAC",
        tenant: n.works,
        pair: ["test_AcmeA", "test_AcmeC"],
        outcome: "differentParties",
        decider: "test_Dana",
        at: "2026-11-01T12:00:00Z"
      })
      const withB = yield* decisionTriples({
        name: "test_DecisionBC",
        tenant: n.works,
        pair: ["test_AcmeB", "test_AcmeC"],
        outcome: "differentParties",
        decider: "test_Dana",
        at: "2026-11-01T12:00:00Z"
      })
      const aside = [...graph, ...withA, ...withB]
      const rows = yield* asked(aside, identity.query, identityVariables)
      expect(rows).toStrictEqual([inForce])
      // A later decision read as the pair's when it names ?a alone, or ?b alone, hides the pair.
      const aboutFirst = laterAboutFirst(identity.query)
      expect(aboutFirst).not.toBe(identity.query)
      const firstRows = yield* asked([...graph, ...withA], aboutFirst, identityVariables)
      expect(firstRows).toStrictEqual([])
      const aboutSecond = laterAboutSecond(identity.query)
      expect(aboutSecond).not.toBe(identity.query)
      const secondRows = yield* asked([...graph, ...withB], aboutSecond, identityVariables)
      expect(secondRows).toStrictEqual([])
      // Near miss: on the fixture alone, which has no such decision, each reading gives the committed answer.
      const fixtureRows = yield* asked(graph, identity.query, identityVariables)
      const firstOnFixture = yield* asked(graph, aboutFirst, identityVariables)
      const secondOnFixture = yield* asked(graph, aboutSecond, identityVariables)
      expect(firstOnFixture).toStrictEqual(fixtureRows)
      expect(secondOnFixture).toStrictEqual(fixtureRows)
    })
  )

  it.effect("must-fail: a node that states a decision's properties and no type is no decision", () =>
    Effect.gen(function* () {
      const n = yield* partyNames
      const graph = yield* fixtureGraph(identity.fixture)
      const rows = yield* asked(graph, identity.query, identityVariables)
      // Planted: every property of a sameParty decision about test_AcmeC and test_AcmeD, and no type.
      const decided = yield* decisionTriples({
        name: "test_UntypedDecision",
        tenant: n.works,
        pair: ["test_AcmeC", "test_AcmeD"],
        outcome: "sameParty",
        decider: "test_Dana",
        at: "2026-11-01T14:00:00Z"
      })
      const untyped = A.filter(decided, (triple) => triple.predicate !== type)
      expect(untyped).toHaveLength(decided.length - 1)
      const answer = yield* asked([...graph, ...untyped], identity.query, identityVariables)
      expect(answer).toStrictEqual(rows)
      // Without the decision's type step, the untyped node joins C and D.
      const anyType = decisionOfAnyType(identity.query)
      expect(anyType).not.toBe(identity.query)
      const joined = yield* asked([...graph, ...untyped], anyType, identityVariables)
      expect(joined).toStrictEqual([
        ...rows,
        [n.works, n.record("test_AcmeC"), n.record("test_AcmeD"), n.member("test_Dana"), "2026-11-01T14:00:00Z", ""]
      ])
      // Near miss: the same node typed a decision is one, and the committed question lists it.
      const typed = yield* asked([...graph, ...decided], identity.query, identityVariables)
      expect(typed).toStrictEqual(joined)
    })
  )

  it.effect(
    "the fixture states what the question does not read: tenants, source keys and deciders (report 18 section 10)",
    () =>
      Effect.gen(function* () {
        const n = yield* partyNames
        const graph = yield* fixtureGraph(identity.fixture)
        expect(holdingFaults(graph, n.inv)).toStrictEqual([])
        // The two tenants' records reuse the ids A0001 and A0002 and stay four records (decision 34).
        expect(idsHeld(graph, n.inv, n.works)).toStrictEqual(["A0001", "A0002", "A0003", "A0004", "A0005", "A0006"])
        expect(idsHeld(graph, n.inv, n.second)).toStrictEqual(["A0001", "A0002"])
        // Planted, one at a time: the evidence's tenant dropped, its type dropped, test_Decision3 decided by
        // test_Kim, test_Dana's membership dropped, and test_AcmeC's source id dropped. Each is one fault.
        const evidence = n.evidence("test_SameTaxId")
        const third = n.decision("test_Decision3")
        const dana = n.member("test_Dana")
        const acmeC = n.record("test_AcmeC")
        const plants = [
          dropped(graph, evidence, n.inv("inTenant")),
          dropped(graph, evidence, type),
          [...dropped(graph, third, n.inv("decidedBy")), link(third, n.inv("decidedBy"), n.member("test_Kim"))],
          dropped(graph, dana, n.inv("membershipIn")),
          dropped(graph, acmeC, n.inv("sourceId"))
        ]
        expect(A.map(plants, (planted) => holdingFaults(planted, n.inv))).toStrictEqual([
          [`${evidence} states ${n.inv("inTenant")} 0 times`],
          [`${evidence} states a tenant and holds no type`],
          [`${third} is decided by ${n.member("test_Kim")}, no member of its tenant`],
          [
            `${dana} states ${n.inv("membershipIn")} 0 times`,
            `${n.decision("test_Decision1")} is decided by ${dana}, no member of its tenant`,
            `${n.decision("test_Decision2")} is decided by ${dana}, no member of its tenant`,
            `${third} is decided by ${dana}, no member of its tenant`
          ],
          [`${acmeC} states ${n.inv("sourceId")} 0 times`]
        ])
        // test_SecondAcmeA's id changed is no fault of its own: the ids it holds say it.
        const secondA = n.record("test_SecondAcmeA")
        const renumbered = [
          ...dropped(graph, secondA, n.inv("sourceId")),
          literal(secondA, n.inv("sourceId"), "A0009", `${RdfVocab.xsd.iri}string`)
        ]
        expect(holdingFaults(renumbered, n.inv)).toStrictEqual([])
        expect(idsHeld(renumbered, n.inv, n.second)).toStrictEqual(["A0002", "A0009"])
        // Near miss: the evidence's text reworded is no holding, and no fault.
        const reworded = [
          ...dropped(graph, evidence, n.inv("evidenceText")),
          literal(evidence, n.inv("evidenceText"), "same bank account", `${RdfVocab.xsd.iri}string`)
        ]
        expect(holdingFaults(reworded, n.inv)).toStrictEqual([])
      })
  )
})

describe("gate 8, CQ-P05: no identity is stated by the construct CQ-P05 asks for", () => {
  it.effect("on CQ-P04's fixture the ASK answers false: two records with no decision are two records", () =>
    Effect.gen(function* () {
      const graph = yield* fixtureGraph(identity.fixture)
      const owl = yield* ontologyGraph
      const answer = yield* askWhether([...graph, ...owl], sameness.query)
      expect(answer).toBe(false)
    })
  )

  it.effect(
    "must-fail: CQ-P05's statement added and test_Decision1 removed, CQ-P04 has no row and the ASK is true",
    () =>
      Effect.gen(function* () {
        const n = yield* partyNames
        const graph = yield* fixtureGraph(identity.fixture)
        const stated = yield* fixtureGraph(sameness.fixture)
        const owl = yield* ontologyGraph
        // The file holds one statement, from test_AcmeA to test_AcmeB, by a predicate CQ-P04's fixture never uses.
        expect(A.map(stated, (triple) => [triple.subject, iriOf(triple)])).toStrictEqual([
          [n.record("test_AcmeA"), n.record("test_AcmeB")]
        ])
        expect(A.some(graph, (triple) => A.some(stated, (given) => given.predicate === triple.predicate))).toBe(false)
        const swapped = [...withoutSubjects(graph, [n.decision("test_Decision1")]), ...stated]
        const rows = yield* asked(swapped, identity.query, identityVariables)
        expect(rows).toStrictEqual([])
        const answer = yield* askWhether([...swapped, ...owl], sameness.query)
        expect(answer).toBe(true)
        // Near miss: a record stated the same as itself says nothing, and the ASK answers false.
        const reflexive = [...graph, ...A.map(stated, (given) => link(given.subject, given.predicate, given.subject))]
        const itself = yield* askWhether([...reflexive, ...owl], sameness.query)
        expect(itself).toBe(false)
      })
  )
})

describe("gate 8, the guards on the fixture's two parts", () => {
  it.effect("guard 1: the hand-written text states nothing the lift states", () =>
    Effect.gen(function* () {
      const { written, lifted } = yield* parts
      expect(lifted).toHaveLength(14)
      expect(linesOf(overreach(written, lifted))).toStrictEqual([])
      // And it states what section 5.2 says no record holds: the person and their name, the two tenants, the two links
      // to the person, and the sign-in account with its email and the two links to it (report 18 section 10).
      const n = yield* names
      expect(linesOf(written)).toStrictEqual(
        linesOf([
          link(n.person, type, n.inv("Person")),
          literal(n.person, n.inv("name"), "Ravi Example", `${RdfVocab.xsd.iri}string`),
          link(n.works, type, n.inv("Tenant")),
          link(n.second, type, n.inv("Tenant")),
          link(n.raviWorks, n.inv("membershipOf"), n.person),
          link(n.raviSecond, n.inv("membershipOf"), n.person),
          link(n.account, type, n.inv("SignInAccount")),
          literal(n.account, n.inv("accountEmail"), "test_ravi@example.org", `${RdfVocab.xsd.iri}string`),
          link(n.raviWorks, n.inv("memberAccount"), n.account),
          link(n.raviSecond, n.inv("memberAccount"), n.account)
        ])
      )
    })
  )

  it.effect(
    "guard 1 reports a hand-written grant, tenant link and type on lifted nodes, and passes a type on another",
    () =>
      Effect.gen(function* () {
        const { written, lifted } = yield* parts
        const n = yield* names
        const grant = `${n.raviWorks}/role`
        const taken = [
          link(grant, n.inv("grantsRole"), n.admin),
          link(n.raviWorks, n.inv("membershipIn"), n.works),
          link(n.raviWorks, type, n.inv("Member")),
          link(grant, type, n.inv("Grant"))
        ]
        expect(linesOf(overreach([...written, ...taken], lifted))).toStrictEqual(linesOf(taken))
        // Near miss (report 18 section 7, "only when"): a member type on a node no record holds is stated by no lifted
        // triple of that subject, so it passes, as CQ-P07's fixture writes its members.
        const p = yield* partyNames
        const unlifted = link(p.member("test_Dana"), type, n.inv("Member"))
        expect(linesOf(overreach([...written, unlifted], lifted))).toStrictEqual([])
      })
  )

  // Decision 171: the lift writes each tenant's name, so a predicate alone would take the person's hand-written name
  // for one the lift states. Subject and predicate together tell them apart.
  it.effect(
    "guard 1 reports a hand-written tenant name and passes the person's, whose predicate the lift uses too",
    () =>
      Effect.gen(function* () {
        const { written, lifted } = yield* parts
        const n = yield* names
        const name = n.inv("name")
        const personName = A.filter(written, (triple) => triple.subject === n.person && triple.predicate === name)
        expect(personName).toHaveLength(1)
        expect(A.filter(lifted, withPredicate(name))).toHaveLength(2)
        expect(linesOf(overreach(personName, lifted))).toStrictEqual([])
        const tenantName = literal(n.works, name, "Example Works (test)", `${RdfVocab.xsd.iri}string`)
        // Planted with another value: the guard reads what a triple is about and by which property, not its value.
        const renamed = literal(n.second, name, "Another name", `${RdfVocab.xsd.iri}string`)
        expect(linesOf(overreach([...written, tenantName, renamed], lifted))).toStrictEqual(
          linesOf([tenantName, renamed])
        )
      })
  )

  it.effect("guard 2: the graph less the hand-written triples is the lift of the two rows, triple for triple", () =>
    Effect.gen(function* () {
      const { context, graph, written, lifted } = yield* parts
      const decoded = yield* Effect.forEach(threadRows, (row) => S.decodeUnknownEffect(Member)(row), { concurrency: 1 })
      const direct = yield* Effect.forEach(decoded, (value) => lift(context, Member, value), { concurrency: 1 })
      expect(decoded).toHaveLength(2)
      expect(linesOf(lifted)).toStrictEqual(linesOf(A.flatten(direct)))
      expect(graph).toHaveLength(A.flatten(direct).length + written.length)
      expect(linesOf(graph)).toHaveLength(graph.length)
    })
  )

  // The forward plant of step 5 (PLAN, Steps 9 to 12): the party fixtures state forty-six properties no other text
  // states, so guard 3 fed CQ-P06's text alone, as before step 5, reports them; CQ-P04's fixture alone states the six
  // of step 10, CQ-P07's and model-call.ttl the four of step 11, and CQ-P03's and sutton-party.ttl twenty-seven of step
  // 12's twenty-nine, so with one left out guard 3 reports its own.
  it.effect(
    "guard 3 reads every hand-written fixture text: with CQ-P06's alone or left out, a property is unshown",
    () =>
      Effect.gen(function* () {
        const { context } = yield* parts
        expect(A.map(handWrittenFixtures, ([name]) => name)).toStrictEqual([
          "CQ-P06.fixture.ttl",
          "bare-type.fixture.ttl",
          "CQ-P01.fixture.ttl",
          "CQ-P02.fixture.ttl",
          "CQ-P09.fixture.ttl",
          "CQ-P04.fixture.ttl",
          "CQ-P05.fixture.ttl",
          "model-call.ttl",
          "CQ-P07.fixture.ttl",
          "CQ-P03.fixture.ttl",
          "sutton-party.ttl"
        ])
        const texts = yield* Effect.forEach(
          handWrittenFixtures,
          ([name, text]) => Effect.map(readTurtle(context.vocabulary.base, text), (graph) => ({ name, graph })),
          { concurrency: 1 }
        )
        expect(
          unshown(
            context.vocabulary,
            A.flatMap(texts, ({ graph }) => graph)
          )
        ).toStrictEqual([])
        const kept = A.filter(texts, ({ name }) => name !== "CQ-P06.fixture.ttl")
        const others = A.flatMap(kept, ({ graph }) => graph)
        expect(others).not.toStrictEqual([])
        expect(unshown(context.vocabulary, others)).toStrictEqual(["membershipOf"])
        const sixes = A.filter(texts, ({ name }) => name === "CQ-P06.fixture.ttl")
        const alone = A.flatMap(sixes, ({ graph }) => graph)
        expect(alone).not.toStrictEqual([])
        expect(unshown(context.vocabulary, alone)).toStrictEqual([
          "recordOf",
          "decidesOn",
          "identityOutcome",
          "decidedBy",
          "citesEvidence",
          "membershipStatus",
          "callPurpose",
          "calledFor",
          "hasPostalAddress",
          "addressPurpose",
          "defaultFor",
          "hasContactPoint",
          "contactPointKind",
          "contactPerson",
          "contactAccount",
          "assignmentPoint",
          "servesPurpose",
          "contactAt",
          "contactType",
          "contactOwner",
          "primaryContact",
          "accountStatus",
          "membershipWorkspace",
          "memberContactPoint",
          "sourceSystem",
          "sourceType",
          "sourceId",
          "capturedAt",
          "isCustomer",
          "isVendor",
          "eventTime",
          "evidenceText",
          "calledAt",
          "addressLines",
          "locality",
          "region",
          "postalCode",
          "countryCode",
          "contactValue",
          "extension",
          "givenName",
          "middleName",
          "familyName",
          "jobTitle",
          "profileImage",
          "profileText"
        ])
        const notIdentity = A.filter(texts, ({ name }) => name !== "CQ-P04.fixture.ttl")
        const withoutIdentity = A.flatMap(notIdentity, ({ graph }) => graph)
        expect(withoutIdentity).not.toStrictEqual([])
        expect(unshown(context.vocabulary, withoutIdentity)).toStrictEqual([
          "decidesOn",
          "identityOutcome",
          "decidedBy",
          "citesEvidence",
          "eventTime",
          "evidenceText"
        ])
        // Step 11's two fixtures: CQ-P07's states the stage, as sutton-party.ttl does from step 12 for the Sutton member
        // (report 18 section 4.1), so with both left out guard 3 reports it, and with CQ-P07's alone left out nothing;
        // model-call.ttl alone states the model call's three.
        const notStewardship = A.filter(texts, ({ name }) => name !== "CQ-P07.fixture.ttl")
        const withoutStewardship = A.flatMap(notStewardship, ({ graph }) => graph)
        expect(withoutStewardship).not.toStrictEqual([])
        expect(unshown(context.vocabulary, withoutStewardship)).toStrictEqual([])
        const unstaged = A.filter(notStewardship, ({ name }) => name !== "sutton-party.ttl")
        const withoutStages = A.flatMap(unstaged, ({ graph }) => graph)
        const allButSutton = A.filter(texts, ({ name }) => name !== "sutton-party.ttl")
        const suttonOnly = unshown(
          context.vocabulary,
          A.flatMap(allButSutton, ({ graph }) => graph)
        )
        expect(
          A.filter(unshown(context.vocabulary, withoutStages), (key) => !A.contains(suttonOnly, key))
        ).toStrictEqual(["membershipStatus"])
        const notCalls = A.filter(texts, ({ name }) => name !== "model-call.ttl")
        const withoutCalls = A.flatMap(notCalls, ({ graph }) => graph)
        expect(withoutCalls).not.toStrictEqual([])
        expect(unshown(context.vocabulary, withoutCalls)).toStrictEqual(["callPurpose", "calledFor", "calledAt"])
        // Step 12's two fixtures: CQ-P03's alone states the assignment's four, and sutton-party.ttl alone the coverage's
        // twenty-three; the point a record gives and its text both state.
        const notContacts = A.filter(texts, ({ name }) => name !== "CQ-P03.fixture.ttl")
        const withoutContacts = A.flatMap(notContacts, ({ graph }) => graph)
        expect(withoutContacts).not.toStrictEqual([])
        expect(unshown(context.vocabulary, withoutContacts)).toStrictEqual([
          "contactPerson",
          "contactAccount",
          "assignmentPoint",
          "servesPurpose"
        ])
        const notSutton = A.filter(texts, ({ name }) => name !== "sutton-party.ttl")
        const withoutSutton = A.flatMap(notSutton, ({ graph }) => graph)
        expect(withoutSutton).not.toStrictEqual([])
        expect(unshown(context.vocabulary, withoutSutton)).toStrictEqual([
          "hasPostalAddress",
          "addressPurpose",
          "defaultFor",
          "contactPointKind",
          "contactAt",
          "contactType",
          "contactOwner",
          "primaryContact",
          "accountStatus",
          "membershipWorkspace",
          "memberContactPoint",
          "addressLines",
          "locality",
          "region",
          "postalCode",
          "countryCode",
          "extension",
          "givenName",
          "middleName",
          "familyName",
          "jobTitle",
          "profileImage",
          "profileText"
        ])
      })
  )

  it.effect("guard 3: every property whose evidence is the fixture is stated by the hand-written texts", () =>
    Effect.gen(function* () {
      const { context } = yield* parts
      const n = yield* names
      const texts = yield* Effect.forEach(
        handWrittenFixtures,
        ([, text]) => readTurtle(context.vocabulary.base, text),
        {
          concurrency: 1
        }
      )
      const written = A.flatten(texts)
      expect(unshown(context.vocabulary, written)).toStrictEqual([])
      // Without CQ-P06's two membershipOf links the texts show the property nowhere.
      const less = A.filter(written, (triple) => !withPredicate(n.inv("membershipOf"))(triple))
      expect(less).toHaveLength(written.length - 2)
      expect(unshown(context.vocabulary, less)).toStrictEqual(["membershipOf"])
    })
  )
})

describe("the question runner", () => {
  it.effect("refuses a query that does not parse, as a value", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const refusal = yield* Effect.flip(ask(graph, "SELECT ?member WHERE {", ["member"]))
      expect(refusal.reason).toContain("error at 1:23")
    })
  )

  it.effect("answers a query that parses and matches nothing with no rows, not with a refusal", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const rows = yield* ask(graph, "SELECT ?member WHERE { ?member <https://example.org/none> ?nothing }", ["member"])
      expect(rows).toStrictEqual([])
    })
  )

  it.effect("refuses an ASK as a table, so a yes is never read as rows", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const refusal = yield* Effect.flip(ask(graph, "ASK { ?member ?p ?o }", ["member"]))
      expect(refusal.reason).toBe("the query returned no table of solutions")
    })
  )
})

describe("the boolean runner", () => {
  const holds = "ASK { ?member ?p ?o }"
  const fails = "ASK { ?member <https://example.org/none> ?nothing }"

  it.effect("answers an ASK with its boolean: true when the pattern has a solution, false when it has none", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const yes = yield* askWhether(graph, holds)
      const no = yield* askWhether(graph, fails)
      expect([yes, no]).toStrictEqual([true, false])
    })
  )

  it.effect("refuses a SELECT, whose rows are no yes or no, and a query that does not parse, as values", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const select = yield* Effect.flip(askWhether(graph, "SELECT ?member WHERE { ?member ?p ?o }"))
      expect(select.reason).toBe("the query returned no boolean: it is not an ASK")
      const unparsed = yield* Effect.flip(askWhether(graph, "ASK {"))
      expect(unparsed.reason).toContain("error at 1:6")
    })
  )
})
