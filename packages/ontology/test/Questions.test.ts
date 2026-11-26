// Gate 8, the question suite (report 14 sections 5 and 6.8; decision 120): CQ-P06 and CQ-P11 asked of
// `threadGraph()` in Oxigraph, with no reasoner, and the party slice's CQ-P01, CQ-P02, CQ-P09, CQ-P04 and the CQ-P05
// ASK asked of their hand-written fixtures, which no record holds (report 18 section 10). Every question walks `rdf:type/rdfs:subClassOf*`
// and is asked of its graph with the committed OWL file beside it (decision 27), so a node typed by a subclass is found.
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
  handWrittenFixtures,
  identity,
  ontology,
  roleless,
  sameness,
  tenancy,
  trading
} from "./support/fixtures.ts"

const type = `${RdfVocab.rdf.iri}type`
const subClassOf = `${RdfVocab.rdfs.iri}subClassOf`

const membersVariables = ["tenant", "person", "member", "role"]
const scopeVariables = ["member", "role", "scope"]

/** The names of the fixture, built from the vocabulary. */
const names = Effect.map(threadContext, ({ vocabulary }) => {
  const inv = (local: string) => `${vocabulary.namespace}${local}`
  const data = (organization: string, key: string, id: string) => `${vocabulary.base}/data/${organization}/${key}/${id}`
  return {
    inv,
    person: `${vocabulary.base}/fixture/Person/test_Ravi`,
    works: data("test_ExampleWorks", "Tenant", "test_ExampleWorks"),
    second: data("test_SecondOrg", "Tenant", "test_SecondOrg"),
    raviWorks: data("test_ExampleWorks", "Member", "test_RaviWorks"),
    raviSecond: data("test_SecondOrg", "Member", "test_RaviSecond"),
    admin: inv("MemberRoleScheme-admin"),
    editor: inv("MemberRoleScheme-editor"),
    viewer: inv("MemberRoleScheme-viewer"),
    organizationScope: inv("GrantScopeKindScheme-organization")
  }
})

/** Section 5.3: exactly these two rows, in this order. One person, twice, with two roles. */
const expectedMembers = Effect.map(names, (n) => [
  [n.works, n.person, n.raviWorks, n.admin],
  [n.second, n.person, n.raviSecond, n.viewer]
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
        [n.second, n.person, n.raviSecond, n.viewer]
      ])
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
        identity.query
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
      expect(movedDown(graph)).toHaveLength(graph.length + 4)
      const tradingGraph = yield* fixtureGraph(trading.fixture)
      const rolelessGraph = yield* fixtureGraph(roleless.fixture)
      const tenancyGraph = yield* fixtureGraph(tenancy.fixture)
      const identityGraph = yield* fixtureGraph(identity.fixture)
      const questions: ReadonlyArray<readonly [ReadonlyArray<Triple>, string, ReadonlyArray<string>]> = [
        [graph, membersAndRoles, membersVariables],
        [graph, mutantThroughPerson, membersVariables],
        [graph, rolesAtScope, scopeVariables],
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
      expect(written).toHaveLength(5)
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
        [n.works, n.person, n.raviWorks, n.editor],
        [n.second, n.person, n.raviSecond, n.viewer]
      ])
    })
  )

  it.effect("M5, ban 3: asked through the person, a role held in one organization shows in the other", () =>
    Effect.gen(function* () {
      const graph = yield* threadGraph()
      const n = yield* names
      const rows = yield* asked(graph, mutantThroughPerson, membersVariables)
      const asWritten = yield* asked(graph, membersAndRoles, membersVariables)
      const wrong = [n.second, n.person, n.raviSecond, n.admin]
      // The mutant differs from the question by its join alone, so its four rows are compared whatever their order.
      const sorted = A.sort(A.map(rows, A.join(" ")), byCodePoint)
      expect(sorted).toStrictEqual(
        A.sort(
          A.map(
            [
              [n.works, n.person, n.raviWorks, n.admin],
              [n.works, n.person, n.raviWorks, n.viewer],
              wrong,
              [n.second, n.person, n.raviSecond, n.viewer]
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
        link(n.raviSecond, type, n.inv("Member")),
        link(n.raviSecond, n.inv("membershipIn"), n.second)
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
      expect(lifted).toHaveLength(12)
      expect(linesOf(overreach(written, lifted))).toStrictEqual([])
      // And it states what section 5.2 says no record holds: the person, the two tenants, the two links to the person.
      const n = yield* names
      expect(linesOf(written)).toStrictEqual(
        linesOf([
          link(n.person, type, n.inv("Person")),
          link(n.works, type, n.inv("Tenant")),
          link(n.second, type, n.inv("Tenant")),
          link(n.raviWorks, n.inv("membershipOf"), n.person),
          link(n.raviSecond, n.inv("membershipOf"), n.person)
        ])
      )
    })
  )

  it.effect("guard 1 reports a hand-written grant, a hand-written tenant link and a hand-written member type", () =>
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

  // The forward plant of step 5 (PLAN, Steps 9 and 10): the party fixtures state thirteen properties no other text
  // states, so guard 3 fed CQ-P06's text alone, as before step 5, reports them; and CQ-P04's fixture alone states the
  // six of step 10, so with it left out guard 3 reports those six.
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
          "CQ-P05.fixture.ttl"
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
          "sourceSystem",
          "sourceType",
          "sourceId",
          "capturedAt",
          "isCustomer",
          "isVendor",
          "eventTime",
          "evidenceText"
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
