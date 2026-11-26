// Gate 8, the question suite (report 14 sections 5 and 6.8; decision 120): CQ-P06 and CQ-P11 asked of
// `threadGraph()` in Oxigraph, with no reasoner. Every question walks `rdf:type/rdfs:subClassOf*` and is asked of its
// graph with the committed OWL file beside it (decision 27), so a node typed by a subclass is found.
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
import { byCodePoint, linesOf, link, ObjectNode, without, type Triple } from "../src/Graph.schema.ts"
import { lift } from "../src/Lift.ts"
import { graphOf, threadContext, threadGraph, threadHandWritten, threadRows } from "../src/Thread.ts"
import { readTurtle } from "../src/Turtle.ts"
import { ask, askWhether } from "./support/ask.ts"
import { bareType, bareTypeQuery, handWrittenFixtures, ontology } from "./support/fixtures.ts"

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
      for (const query of [membersAndRoles, mutantThroughPerson, rolesAtScope, bareTypeQuery]) {
        expect(query).toContain(`PREFIX inv: <${vocabulary.namespace}>`)
        expect(query).toContain(`PREFIX rdf: <${RdfVocab.rdf.iri}>`)
        expect(query).toContain(`PREFIX rdfs: <${RdfVocab.rdfs.iri}>`)
      }
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
      const moved = movedDown(graph)
      expect(moved).toHaveLength(graph.length + 4)
      const questions: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
        [membersAndRoles, membersVariables],
        [mutantThroughPerson, membersVariables],
        [rolesAtScope, scopeVariables]
      ]
      for (const [query, variables] of questions) {
        expect(query).toContain(walk)
        const rows = yield* asked(graph, query, variables)
        const below = yield* asked(moved, query, variables)
        expect(rows).not.toStrictEqual([])
        expect(below).toStrictEqual(rows)
        // Planted: the same question with bare type steps answers the graph as typed, and nothing one class down.
        const bare = bareStep(query)
        expect(bare).not.toContain(walk)
        const bareRows = yield* asked(graph, bare, variables)
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

  // No plant here fails if guard 3 reads CQ-P06's text alone: `bare-type.fixture.ttl` states only `rdf:type`. The
  // first fixture that states a property no other text states brings that plant (PLAN, Step 5).
  it.effect("guard 3 reads every hand-written fixture text: with CQ-P06's left out, its property is unshown", () =>
    Effect.gen(function* () {
      const { context } = yield* parts
      expect(A.map(handWrittenFixtures, ([name]) => name)).toStrictEqual([
        "CQ-P06.fixture.ttl",
        "bare-type.fixture.ttl"
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
    })
  )

  it.effect("guard 3: every property whose evidence is the fixture is stated by the hand-written text", () =>
    Effect.gen(function* () {
      const { context, written } = yield* parts
      const n = yield* names
      expect(unshown(context.vocabulary, written)).toStrictEqual([])
      // Without its two membershipOf links the text shows the property nowhere.
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
