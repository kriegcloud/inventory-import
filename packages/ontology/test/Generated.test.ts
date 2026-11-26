// Gates 1, 2 and 3 on the three generated files (report 14 sections 6.1 to 6.3).
//
// Gate 1: what the projector and the writer make now is, byte for byte, what is committed under `generated/`.
// Gate 2: each committed text, read back with N3.js, holds exactly the triples the writer was given.
// Gate 3: each committed text states only what its file may: its predicates, its types, the namespaces it may name,
// and no blank node.
//
// Each gate has its planted mistake, and gates 2 and 3 the further negatives the report and SPEC name. The files
// under `fixtures/negative/` are hand-written Turtle that exists to be refused here; nothing else reads them. A
// refused IRI is named as a namespace of the registry followed by a local name, never as one text, so the source law
// that scans code for forbidden constructs is silent on this file.
//
// The party slice's constructs (PLAN, step 2) are tried on an in-memory copy of the kernel's literal that holds each
// of them (`support/constructs.ts`): what the projector writes for each, that the writer's text reads back, and what
// gate 3 refuses. Since step 9 the kernel's module holds the constructs that step brings (category parents, the two
// gist properties and their subPropertyOf links, boolean ranges), and the committed files carry them; the copy still
// tries the ones the kernel lacks, such as the retirements and the planted attribute.
import { describe, expect, it } from "@effect/vitest"
import { ClassTerm, IdentityCriterion, Vocabulary } from "@beep/vocabulary/Model"
import { RdfVocab } from "@beep/vocabulary/Rdf"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import unescaped from "../fixtures/negative/gate2-unescaped.ttl?raw"
import hasKey from "../fixtures/negative/gate3-hasKey.ttl?raw"
import host from "../fixtures/negative/gate3-host.ttl?raw"
import inverseFunctional from "../fixtures/negative/gate3-inverseFunctional.ttl?raw"
import sameAs from "../fixtures/negative/gate3-sameAs.ttl?raw"
import subclass from "../fixtures/negative/gate3-subclass.ttl?raw"
import restriction from "../fixtures/negative/gate3-type.ttl?raw"
import committedGraph from "../generated/fixtures/CQ-P06.graph.ttl?raw"
import committedOwl from "../generated/inventory.owl.ttl?raw"
import committedSkos from "../generated/inventory.skos.ttl?raw"
import {
  constructFindings,
  differenceSentence,
  firstDifference,
  reparse,
  type ConstructFinding,
  type FileKind
} from "../src/Constructs.rules.ts"
import { generatedFiles } from "../src/Generated.ts"
import { byCodePoint, Iri, lineOf, link, literal, objectLine, TextNode, type Triple } from "../src/Graph.schema.ts"
import { graphProjection, owlProjection, skosProjection, triplesOf, type ProjectContext } from "../src/Project.ts"
import { threadContext } from "../src/Thread.ts"
import { parseTurtle, readTurtle } from "../src/Turtle.ts"
import { writeTurtle } from "../src/Write.ts"
import { vocabulary as kernelVocabulary } from "@inventory/kernel/Terms"
import { constructsVocabulary } from "./support/constructs.ts"

const committed: Readonly<Record<FileKind, string>> = { owl: committedOwl, skos: committedSkos, graph: committedGraph }

const source = "packages/kernel/src/Terms.vocab.ts"

/** A finding as its rule and what it refuses, so a changed sentence does not fail the gate's test. */
const named = (findings: ReadonlyArray<ConstructFinding>) => A.map(findings, (found) => [found.rule, found.about])

/** Gate 3 on a hand-written text, given as the OWL file. */
const refusedAsOwl = Effect.fn("refusedAsOwl")(function* (text: string) {
  const { vocabulary } = yield* threadContext
  const statements = yield* parseTurtle(vocabulary.base, text)
  return named(constructFindings({ kind: "owl", vocabulary, statements }))
})

describe("gate 1, byte-compare", () => {
  it.effect("the three committed files are what the projector writes now", () =>
    Effect.gen(function* () {
      const files = yield* generatedFiles()
      expect(A.map(files, (file) => file.path)).toStrictEqual([
        "generated/inventory.owl.ttl",
        "generated/inventory.skos.ttl",
        "generated/fixtures/CQ-P06.graph.ttl"
      ])
      for (const file of files) {
        const difference = firstDifference(file.text, committed[file.kind])
        expect(O.map(difference, (found) => differenceSentence(file.path, found))).toStrictEqual(O.none())
      }
    })
  )

  it.effect(
    "each file is LF, ends in one newline, opens with two comment lines and holds no tab or trailing space",
    () =>
      Effect.gen(function* () {
        const files = yield* generatedFiles()
        for (const file of files) {
          const lines = Str.split("\n")(file.text)
          expect(Str.includes("\r")(file.text) || Str.includes("\t")(file.text)).toBe(false)
          expect(Str.endsWith("\n")(file.text) && !Str.endsWith("\n\n")(file.text)).toBe(true)
          expect(A.filter(lines, Str.startsWith("#"))).toHaveLength(2)
          expect(A.map(A.take(lines, 3), Str.startsWith("#"))).toStrictEqual([true, true, false])
          expect(A.filter(lines, (line) => Str.endsWith(" ")(line))).toStrictEqual([])
          expect(Str.includes("@base")(file.text)).toBe(false)
        }
      })
  )

  it.effect("planted: a label changed in the committed text is reported with its line and the command", () =>
    Effect.gen(function* () {
      const [owl] = yield* generatedFiles()
      const planted = Str.replace('"Member"@en', '"Members"@en')(committedOwl)
      expect(planted).not.toBe(committedOwl)
      const difference = firstDifference(owl.text, planted)
      const line = A.findFirstIndex(Str.split("\n")(committedOwl), Str.includes('"Member"@en'))
      expect(O.map(difference, (found) => found.line)).toStrictEqual(O.map(line, (index) => index + 1))
      const sentence = O.map(difference, (found) => differenceSentence(owl.path, found))
      expect(O.exists(sentence, Str.includes("bun run ontology:write"))).toBe(true)
      expect(O.exists(sentence, Str.includes('"Members"@en'))).toBe(true)
    })
  )

  it.effect("a class that stores no id, a criterion's basis and a designation change no byte (decision 19)", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const { classes, datatypeProperties } = kernelVocabulary
      const variant = yield* S.decodeEffect(Vocabulary, { onExcessProperty: "error", errors: "all" })({
        ...kernelVocabulary,
        classes: {
          ...classes,
          Grant: { ...classes.Grant, storesId: false },
          Member: { ...classes.Member, identity: { ...classes.Member.identity, restsOn: ["membershipIn"] } }
        },
        datatypeProperties: { ...datatypeProperties, action: { ...datatypeProperties.action, designation: "name" } }
      })
      const varied = { ...context, vocabulary: variant }
      const owl = yield* writeTurtle(owlProjection(context, source))
      const skos = yield* writeTurtle(skosProjection(context, source))
      const variedOwl = yield* writeTurtle(owlProjection(varied, source))
      const variedSkos = yield* writeTurtle(skosProjection(varied, source))
      expect([variedOwl, variedSkos]).toStrictEqual([owl, skos])
      expect(variant.classes).not.toStrictEqual(context.vocabulary.classes)
    })
  )

  it("a text with a line more, or without its final newline, differs at that line", () => {
    expect(O.map(firstDifference("a\nb\n", "a\nb\nc\n"), (found) => found.line)).toStrictEqual(O.some(3))
    expect(O.map(firstDifference("a\nb\n", "a\nb"), (found) => found.line)).toStrictEqual(O.some(3))
    expect(firstDifference("a\nb\n", "a\nb\n")).toStrictEqual(O.none())
  })
})

describe("gate 2, re-parse", () => {
  it.effect("each committed text holds exactly the triples the writer was given", () =>
    Effect.gen(function* () {
      const { vocabulary } = yield* threadContext
      const files = yield* generatedFiles()
      for (const file of files) {
        const readBack = yield* readTurtle(vocabulary.base, committed[file.kind])
        const result = reparse(file.triples, readBack)
        expect([file.path, result.missing, result.extra]).toStrictEqual([file.path, [], []])
        expect(readBack).toHaveLength(file.triples.length)
      }
    })
  )

  it.effect("a definition holding a quote, a backslash, a newline and a tab survives the round trip", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const definition = 'A "human" being, \\ written on\ntwo lines\twith a tab\rand a return.'
      const person = yield* O.match(R.get(context.vocabulary.classes, "Person"), {
        onNone: () => Effect.die("the vocabulary has no Person"),
        onSome: Effect.succeed
      })
      const variant = Vocabulary.make({
        ...context.vocabulary,
        classes: { ...context.vocabulary.classes, Person: ClassTerm.make({ ...person, definition }) }
      })
      const projection = owlProjection({ ...context, vocabulary: variant }, source)
      const text = yield* writeTurtle(projection)
      const readBack = yield* readTurtle(variant.base, text)
      const result = reparse(triplesOf(projection), readBack)
      expect([result.missing, result.extra]).toStrictEqual([[], []])
      expect(A.some(A.map(readBack, lineOf), Str.includes('\\"human\\"'))).toBe(true)
      // Each is written escaped: a raw tab or return would also read back, so the text itself is asserted.
      const written = A.findFirst(Str.split("\n")(text), Str.includes('\\"human\\"'))
      expect(
        O.map(written, (line) => A.map(['\\"', "\\\\", "\\n", "\\t", "\\r"], (escape) => Str.includes(escape)(line)))
      ).toStrictEqual(O.some([true, true, true, true, true]))
      expect(Str.includes("\t")(text) || Str.includes("\r")(text)).toBe(false)
      // The newline is escaped, so the definition is still one line of the file.
      expect(A.filter(Str.split("\n")(text), Str.includes('\\"human\\"'))).toHaveLength(1)
    })
  )

  it.effect("planted: an unescaped quote is a parse error that names its line", () =>
    Effect.gen(function* () {
      const { vocabulary } = yield* threadContext
      const refusal = yield* Effect.flip(readTurtle(vocabulary.base, unescaped))
      expect(refusal.reason).toContain("does not parse")
      expect(refusal.reason).toContain("line 3")
    })
  )

  it.effect("a text written from the triples less one is reported as missing that one, with no parse error", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const projection = owlProjection(context, source)
      const given = triplesOf(projection)
      const dropped = link(
        `${context.vocabulary.namespace}Tenant`,
        `${RdfVocab.rdfs.iri}subClassOf`,
        `${context.vocabulary.namespace}Organization`
      )
      const less = {
        ...projection,
        sections: A.map(
          projection.sections,
          A.filter((triple) => lineOf(triple) !== lineOf(dropped))
        )
      }
      expect(triplesOf(less)).toHaveLength(given.length - 1)
      const text = yield* writeTurtle(less)
      const readBack = yield* readTurtle(context.vocabulary.base, text)
      const result = reparse(given, readBack)
      expect([result.missing, result.extra]).toStrictEqual([[lineOf(dropped)], []])
    })
  )
})

describe("gate 3, forbidden constructs and the namespace guard", () => {
  it.effect("each committed file states only what it may", () =>
    Effect.gen(function* () {
      const { vocabulary } = yield* threadContext
      const files = yield* generatedFiles()
      for (const file of files) {
        const statements = yield* parseTurtle(vocabulary.base, committed[file.kind])
        expect([file.path, named(constructFindings({ kind: file.kind, vocabulary, statements }))]).toStrictEqual([
          file.path,
          []
        ])
      }
    })
  )

  it.effect("planted, and ban 5: sameness between two terms is refused by the predicate list", () =>
    Effect.gen(function* () {
      const found = yield* refusedAsOwl(sameAs)
      expect(found).toStrictEqual([["predicate", `${RdfVocab.owl.iri}${"sameAs"}`]])
    })
  )

  it.effect("a restriction as a type is refused by the type list", () =>
    Effect.gen(function* () {
      const found = yield* refusedAsOwl(restriction)
      expect(found).toStrictEqual([["type", `${RdfVocab.owl.iri}${"Restriction"}`]])
    })
  )

  it.effect("a class under another host is refused by the namespace guard", () =>
    Effect.gen(function* () {
      const subject = "https://example.com/ontology/Member"
      const found = yield* refusedAsOwl(host)
      expect(found).toStrictEqual([
        ["namespace", subject],
        ["namespace", subject]
      ])
    })
  )

  it.effect("ban 5: membershipOf made inverse functional is refused by the type list", () =>
    Effect.gen(function* () {
      const found = yield* refusedAsOwl(inverseFunctional)
      expect(found).toStrictEqual([["type", `${RdfVocab.owl.iri}${"InverseFunctionalProperty"}`]])
    })
  )

  it.effect("ban 5: a key on Tenant is refused by the predicate list, and its list by the blank-node guard", () =>
    Effect.gen(function* () {
      const findings = yield* refusedAsOwl(hasKey)
      expect(A.filter(findings, ([rule]) => rule === "predicate")).toContainEqual([
        "predicate",
        `${RdfVocab.owl.iri}${"hasKey"}`
      ])
      expect(A.some(findings, ([rule]) => rule === "blank")).toBe(true)
    })
  )

  it.effect("ban 5's near miss: Tenant as a subclass of Organization passes", () =>
    Effect.gen(function* () {
      const found = yield* refusedAsOwl(subclass)
      expect(found).toStrictEqual([])
    })
  )

  it.effect(
    "a W3C construct named as an object, not stated, is refused: a property under sameness, a class under a restriction",
    () =>
      Effect.gen(function* () {
        const { vocabulary } = yield* threadContext
        const refusedObject = Effect.fn("refusedObject")(function* (
          subject: string,
          predicate: string,
          object: string
        ) {
          const statements = yield* parseTurtle(vocabulary.base, `<${subject}> <${predicate}> <${object}> .\n`)
          return named(constructFindings({ kind: "owl", vocabulary, statements }))
        })
        const sameness = `${RdfVocab.owl.iri}${"sameAs"}`
        const restricted = `${RdfVocab.owl.iri}${"Restriction"}`
        const underSameness = yield* refusedObject(
          `${vocabulary.namespace}membershipIn`,
          `${RdfVocab.rdfs.iri}subPropertyOf`,
          sameness
        )
        const underRestriction = yield* refusedObject(
          `${vocabulary.namespace}Tenant`,
          `${RdfVocab.rdfs.iri}subClassOf`,
          restricted
        )
        const ranged = yield* refusedObject(
          `${vocabulary.namespace}recordedAt`,
          `${RdfVocab.rdfs.iri}range`,
          `${RdfVocab.xsd.iri}dateTime`
        )
        expect(underSameness).toStrictEqual([["namespace", sameness]])
        expect(underRestriction).toStrictEqual([["namespace", restricted]])
        expect(ranged).toStrictEqual([])
      })
  )

  it.effect("the source of the OWL file is gist's version and no other host", () =>
    Effect.gen(function* () {
      const { vocabulary } = yield* threadContext
      const sourced = Effect.fn("sourced")(function* (object: string) {
        const statements = yield* parseTurtle(
          vocabulary.base,
          `<${vocabulary.base}/ontology> <${RdfVocab.dcterms.iri}source> <${object}> .\n`
        )
        return named(constructFindings({ kind: "owl", vocabulary, statements }))
      })
      const other = "https://acme.example/gist"
      const fromGist = yield* sourced(vocabulary.gist.versionIri)
      const fromElsewhere = yield* sourced(other)
      expect(fromGist).toStrictEqual([])
      expect(fromElsewhere).toStrictEqual([["namespace", other]])
    })
  )

  it.effect("a file's lists are its own: the OWL file's statements are refused as the SKOS file and as the graph", () =>
    Effect.gen(function* () {
      const { vocabulary } = yield* threadContext
      const statements = yield* parseTurtle(vocabulary.base, committedOwl)
      const asSkos = constructFindings({ kind: "skos", vocabulary, statements })
      const asGraph = constructFindings({ kind: "graph", vocabulary, statements })
      expect(A.some(asSkos, (found) => found.rule === "predicate")).toBe(true)
      expect(A.some(asSkos, (found) => found.rule === "namespace")).toBe(true)
      expect(A.some(asGraph, (found) => found.rule === "type")).toBe(true)
    })
  )
})

describe("the writer", () => {
  it.effect("refuses a predicate its file's order does not hold", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const projection = owlProjection(context, source)
      const stray = link(
        `${context.vocabulary.namespace}Tenant`,
        `${RdfVocab.owl.iri}${"sameAs"}`,
        `${context.vocabulary.namespace}Organization`
      )
      const refusal = yield* Effect.flip(writeTurtle({ ...projection, sections: [...projection.sections, [stray]] }))
      expect(refusal.reason).toContain("is not a predicate this file writes")
    })
  )

  it.effect("refuses a header line that holds a line break, which would end the comment", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const projection = owlProjection(context, source)
      const stated = "<https://example.org/s> <https://example.org/p> <https://example.org/o> ."
      const feed = yield* Effect.flip(writeTurtle({ ...projection, header: ["GENERATED", `x\n${stated}`] }))
      const carriage = yield* Effect.flip(writeTurtle({ ...projection, header: ["GENERATED", `x\r${stated}`] }))
      expect([feed.reason, carriage.reason]).toStrictEqual([
        "a header line holds a line break",
        "a header line holds a line break"
      ])
    })
  )

  it.effect("refuses a prefix Turtle does not read: `_` would write a blank node", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const projection = owlProjection(context, source)
      const refusal = yield* Effect.flip(
        writeTurtle({ ...projection, prefixes: { ...projection.prefixes, _: context.vocabulary.namespace } })
      )
      expect(refusal.reason).toContain("is no prefix Turtle reads")
    })
  )

  it("orders by code point, not by UTF-16 unit: U+FFFD comes before a character outside the basic plane", () => {
    const replacement = "\uFFFD"
    const beyond = "\u{1F600}"
    expect(replacement < beyond).toBe(false)
    expect(A.sort([beyond, replacement, "a", ""], byCodePoint)).toStrictEqual(["", "a", replacement, beyond])
  })

  it("an IRI holds no control character, and a language tag is lower case", () => {
    const iri = S.decodeUnknownOption(Iri)
    const words = S.decodeUnknownOption(TextNode)
    expect(O.isNone(iri("https://example.org/a\u0001b"))).toBe(true)
    expect(O.isSome(iri("https://example.org/a-b"))).toBe(true)
    expect(O.map(words({ kind: "text", value: "Hi", language: "en-US" }), (text) => text.language)).toStrictEqual(
      O.some("en-us")
    )
    expect(O.isSome(words({ kind: "text", value: "Hi", language: "en-us" }))).toBe(true)
    expect(O.isNone(words({ kind: "text", value: "Hi", language: "english_us" }))).toBe(true)
  })

  it.effect("the reader lowers a language tag written in capitals, as the writer writes it", () =>
    Effect.gen(function* () {
      const read = yield* parseTurtle(
        "https://example.org/thing",
        '<a> <http://www.w3.org/2000/01/rdf-schema#label> "Hi"@EN-us .'
      )
      expect(A.map(read, (triple) => triple.object)).toStrictEqual([
        TextNode.make({ kind: "text", value: "Hi", language: "en-us" })
      ])
    })
  )

  it.effect("writes the same text whatever order it is given the triples in", () =>
    Effect.gen(function* () {
      const context = yield* threadContext
      const projection = owlProjection(context, source)
      const reversed = { ...projection, sections: A.map(projection.sections, A.reverse) }
      const straight = yield* writeTurtle(projection)
      const turned = yield* writeTurtle(reversed)
      expect(turned).toBe(straight)
    })
  )
})

// ---------------------------------------------------------------------------------------------------------------
// The party slice's constructs, on an in-memory copy of the kernel's literal
// ---------------------------------------------------------------------------------------------------------------

const strict = { onExcessProperty: "error", errors: "all" } as const

/** The copy decoded strictly, with the prefix the files write its terms with. */
const constructsContext = Effect.map(
  S.decodeEffect(Vocabulary, strict)(constructsVocabulary),
  (vocabulary): ProjectContext => ({ vocabulary, prefix: "inv" })
)

/** What the triples state of one subject, as each predicate and object line, sorted. */
const statedOf = (triples: ReadonlyArray<Triple>, subject: string): ReadonlyArray<string> =>
  A.sort(
    A.map(
      A.filter(triples, (triple) => triple.subject === subject),
      (triple) => `<${triple.predicate}> ${objectLine(triple.object)}`
    ),
    byCodePoint
  )

const at = (prefix: keyof typeof RdfVocab, local: string): string => `<${RdfVocab[prefix].iri}${local}>`

describe("the projector, for the party slice's constructs", () => {
  it.effect("writes one rdfs:subClassOf per category parent, beside the one parent", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { namespace, gist } = context.vocabulary
      const owl = triplesOf(owlProjection(context, source))
      const parentsOf = (key: string) =>
        A.filter(statedOf(owl, `${namespace}${key}`), Str.startsWith(at("rdfs", "subClassOf")))
      expect(parentsOf("Person")).toStrictEqual([
        `${at("rdfs", "subClassOf")} <${namespace}Party>`,
        `${at("rdfs", "subClassOf")} <${gist.namespace}Person>`
      ])
      expect(parentsOf("Organization")).toStrictEqual([
        `${at("rdfs", "subClassOf")} <${namespace}Party>`,
        `${at("rdfs", "subClassOf")} <${gist.namespace}Organization>`
      ])
      // A category with no parent, on the exception list, states none.
      expect(parentsOf("Party")).toStrictEqual([])
    })
  )

  it.effect("states a retired class's three, keeps its words and drops its parent and its category parent", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { namespace } = context.vocabulary
      const owl = triplesOf(owlProjection(context, source))
      expect(statedOf(owl, `${namespace}Workspace`)).toStrictEqual([
        `${at("dcterms", "isReplacedBy")} <${namespace}Tenant>`,
        `${at("rdf", "type")} ${at("owl", "Class")}`,
        `${at("owl", "deprecated")} "true"^^${at("xsd", "boolean")}`,
        `${at("skos", "definition")} "${constructsVocabulary.classes.Workspace.definition}"@en`,
        `${at("skos", "historyNote")} "Deprecated in 0.1.0."@en`,
        `${at("skos", "prefLabel")} "Workspace"@en`
      ])
    })
  )

  it.effect("states a withdrawn property's reason in its history note, with no domain, range or gist link", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { namespace } = context.vocabulary
      const owl = triplesOf(owlProjection(context, source))
      const reason = constructsVocabulary.datatypeProperties.action.deprecation.reason
      expect(statedOf(owl, `${namespace}action`)).toStrictEqual([
        `${at("rdf", "type")} ${at("owl", "DatatypeProperty")}`,
        `${at("owl", "deprecated")} "true"^^${at("xsd", "boolean")}`,
        `${at("skos", "definition")} "${constructsVocabulary.datatypeProperties.action.definition}"@en`,
        `${at("skos", "historyNote")} "Deprecated in 0.1.0. ${reason}"@en`,
        `${at("skos", "prefLabel")} "action"@en`
      ])
    })
  )

  it.effect("drops a retired relation's domain, class range and gist link, and a retired attribute's too", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { namespace } = context.vocabulary
      const owl = triplesOf(owlProjection(context, source))
      const relation = constructsVocabulary.objectProperties.workspaceMembership
      const attribute = constructsVocabulary.datatypeProperties.loggedAt
      expect(statedOf(owl, `${namespace}workspaceMembership`)).toStrictEqual([
        `${at("dcterms", "isReplacedBy")} <${namespace}membershipIn>`,
        `${at("rdf", "type")} ${at("owl", "ObjectProperty")}`,
        `${at("owl", "deprecated")} "true"^^${at("xsd", "boolean")}`,
        `${at("skos", "definition")} "${relation.definition}"@en`,
        `${at("skos", "historyNote")} "Deprecated in 0.1.0."@en`,
        `${at("skos", "prefLabel")} "${relation.prefLabel}"@en`
      ])
      expect(statedOf(owl, `${namespace}loggedAt`)).toStrictEqual([
        `${at("dcterms", "isReplacedBy")} <${namespace}recordedAt>`,
        `${at("rdf", "type")} ${at("owl", "DatatypeProperty")}`,
        `${at("owl", "deprecated")} "true"^^${at("xsd", "boolean")}`,
        `${at("skos", "definition")} "${attribute.definition}"@en`,
        `${at("skos", "historyNote")} "Deprecated in 0.1.0."@en`,
        `${at("skos", "prefLabel")} "${attribute.prefLabel}"@en`
      ])
    })
  )

  it.effect("drops a retired concept's class assertion and keeps a live one's (decision 33)", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { namespace } = context.vocabulary
      const owl = triplesOf(owlProjection(context, source))
      expect(statedOf(owl, `${namespace}MemberRoleScheme-owner`)).toStrictEqual([
        `${at("dcterms", "isReplacedBy")} <${namespace}MemberRoleScheme-admin>`,
        `${at("rdf", "type")} ${at("owl", "NamedIndividual")}`,
        `${at("owl", "deprecated")} "true"^^${at("xsd", "boolean")}`,
        `${at("skos", "historyNote")} "Deprecated in 0.1.0."@en`
      ])
      // The near miss: its live successor is still typed by the class it is an instance of.
      expect(statedOf(owl, `${namespace}MemberRoleScheme-admin`)).toStrictEqual([
        `${at("rdf", "type")} ${at("owl", "NamedIndividual")}`,
        `${at("rdf", "type")} <${namespace}Role>`
      ])
    })
  )

  it.effect("states a retired scheme's and concept's three in the taxonomy, keeping notation and scheme", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { namespace } = context.vocabulary
      const skos = triplesOf(skosProjection(context, source))
      const owl = triplesOf(owlProjection(context, source))
      const whole = `${namespace}GrantScopeKindScheme-whole`
      const retired = [
        `${at("dcterms", "isReplacedBy")} <${namespace}GrantScopeKindScheme-organization>`,
        `${at("owl", "deprecated")} "true"^^${at("xsd", "boolean")}`,
        `${at("skos", "historyNote")} "Deprecated in 0.1.0."@en`
      ]
      const inTaxonomy = statedOf(skos, whole)
      expect(A.filter(retired, (line) => !A.contains(inTaxonomy, line))).toStrictEqual([])
      expect(A.filter(inTaxonomy, Str.startsWith(at("skos", "notation")))).toStrictEqual([
        `${at("skos", "notation")} "whole"^^${at("xsd", "string")}`
      ])
      expect(A.filter(inTaxonomy, Str.startsWith(at("skos", "inScheme")))).toStrictEqual([
        `${at("skos", "inScheme")} <${namespace}GrantScopeKindScheme>`
      ])
      // The concept is an individual of the OWL file too, and says it is retired there.
      expect(statedOf(owl, whole)).toStrictEqual([
        retired[0],
        `${at("rdf", "type")} ${at("owl", "NamedIndividual")}`,
        retired[1],
        retired[2]
      ])
      expect(
        A.filter(statedOf(skos, `${namespace}AccessLevelScheme`), (line) =>
          A.some([at("owl", "deprecated"), at("dcterms", "isReplacedBy")], (predicate) =>
            Str.startsWith(predicate)(line)
          )
        )
      ).toStrictEqual([
        `${at("dcterms", "isReplacedBy")} <${namespace}MemberRoleScheme>`,
        `${at("owl", "deprecated")} "true"^^${at("xsd", "boolean")}`
      ])
    })
  )

  it.effect("declares the two annotation properties of a retirement only in a file that states one", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const thread = yield* threadContext
      const declared = (projected: ReadonlyArray<Triple>) =>
        A.filter(
          A.map(
            A.filter(
              projected,
              (triple) =>
                lineOf(triple) === `<${triple.subject}> ${at("rdf", "type")} ${at("owl", "AnnotationProperty")}`
            ),
            (triple) => triple.subject
          ),
          (subject) => A.contains([`${RdfVocab.skos.iri}historyNote`, `${RdfVocab.dcterms.iri}isReplacedBy`], subject)
        )
      expect(declared(triplesOf(owlProjection(context, source)))).toStrictEqual([
        `${RdfVocab.skos.iri}historyNote`,
        `${RdfVocab.dcterms.iri}isReplacedBy`
      ])
      expect(declared(triplesOf(owlProjection(thread, source)))).toStrictEqual([])
      // A vocabulary whose only retired term is a scheme: the OWL file writes no scheme, so it declares neither, and
      // the SKOS file alone states the retirement.
      const schemeOnly = yield* S.decodeEffect(
        Vocabulary,
        strict
      )({
        ...kernelVocabulary,
        schemes: {
          ...kernelVocabulary.schemes,
          AccessLevelScheme: {
            ...constructsVocabulary.schemes.AccessLevelScheme,
            concepts: {
              full: {
                prefLabel: constructsVocabulary.schemes.AccessLevelScheme.concepts.full.prefLabel,
                definition: constructsVocabulary.schemes.AccessLevelScheme.concepts.full.definition,
                ratification: { decision: 33 }
              }
            }
          }
        }
      })
      const retiredScheme = { ...thread, vocabulary: schemeOnly }
      expect(declared(triplesOf(owlProjection(retiredScheme, source)))).toStrictEqual([])
      expect(
        A.filter(
          statedOf(triplesOf(skosProjection(retiredScheme, source)), `${schemeOnly.namespace}AccessLevelScheme`),
          Str.startsWith(at("owl", "deprecated"))
        )
      ).toStrictEqual([`${at("owl", "deprecated")} "true"^^${at("xsd", "boolean")}`])
    })
  )

  it.effect("writes rdfs:subPropertyOf to a gist property and declares that property, with nothing more", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { namespace, gist } = context.vocabulary
      const owl = triplesOf(owlProjection(context, source))
      const under = (key: string) =>
        A.filter(statedOf(owl, `${namespace}${key}`), Str.startsWith(at("rdfs", "subPropertyOf")))
      expect(under("grantScope")).toStrictEqual([`${at("rdfs", "subPropertyOf")} <${gist.namespace}isCategorizedBy>`])
      expect(under("recordedAt")).toStrictEqual([`${at("rdfs", "subPropertyOf")} <${gist.namespace}plantedAttribute>`])
      // Decision 16: the gist property is declared, and its domain and range, which the list holds, are not written.
      expect(statedOf(owl, `${gist.namespace}isCategorizedBy`)).toStrictEqual([
        `${at("rdf", "type")} ${at("owl", "ObjectProperty")}`
      ])
      expect(statedOf(owl, `${gist.namespace}plantedAttribute`)).toStrictEqual([
        `${at("rdf", "type")} ${at("owl", "DatatypeProperty")}`
      ])
    })
  )

  it.effect("writes no kind tag, identity criterion or ratification, in either file (decision 19)", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { vocabulary } = context
      const criteria = A.getSomes(
        A.map(R.values(vocabulary.classes), (entry) =>
          O.flatMap(entry.identity, (identity) =>
            IdentityCriterion.guards.stated(identity) ? O.some(identity.criterion) : O.none()
          )
        )
      )
      const tags = A.dedupe(A.map(R.values(vocabulary.classes), (entry) => entry.tag))
      const values = A.map(
        [...triplesOf(owlProjection(context, source)), ...triplesOf(skosProjection(context, source))],
        lineOf
      )
      expect(A.length(criteria)).toBeGreaterThan(0)
      expect(A.filter(values, (line) => A.some(criteria, (criterion) => Str.includes(criterion)(line)))).toStrictEqual(
        []
      )
      expect(A.filter(values, (line) => A.some(tags, (tag) => Str.endsWith(`/${tag}>`)(line)))).toStrictEqual([])
      expect(A.filter(values, Str.includes("atification"))).toStrictEqual([])
    })
  )

  it.effect("writes each file of the copy as text that reads back whole and that gate 3 finds nothing in", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { vocabulary } = context
      for (const [kind, projection] of [
        ["owl", owlProjection(context, source)],
        ["skos", skosProjection(context, source)]
      ] as const) {
        const written = yield* writeTurtle(projection)
        const readBack = yield* readTurtle(vocabulary.base, written)
        const result = reparse(triplesOf(projection), readBack)
        expect([kind, result.missing, result.extra]).toStrictEqual([kind, [], []])
        const statements = yield* parseTurtle(vocabulary.base, written)
        expect([kind, named(constructFindings({ kind, vocabulary, statements }))]).toStrictEqual([kind, []])
        // Turtle's own boolean, as decision 33 writes it.
        expect(Str.includes("owl:deprecated true")(written)).toBe(true)
      }
    })
  )

  it.effect("writes a boolean and a date-time of a graph so that they read back as written", () =>
    Effect.gen(function* () {
      const context = yield* constructsContext
      const { vocabulary } = context
      const member = `${vocabulary.base}/fixture/Member/test_Held`
      const entry = `${vocabulary.base}/fixture/AuditEntry/test_Entry`
      const graph = [
        literal(member, `${vocabulary.namespace}onHold`, "false", `${RdfVocab.xsd.iri}boolean`),
        literal(entry, `${vocabulary.namespace}recordedAt`, "2026-11-01T09:00:00Z", `${RdfVocab.xsd.iri}dateTime`),
        literal(
          entry,
          `${vocabulary.namespace}recordedAt`,
          "2026-11-02T10:30:00.250+01:00",
          `${RdfVocab.xsd.iri}dateTime`
        )
      ]
      const projection = graphProjection(context, "a planted graph", graph)
      const written = yield* writeTurtle(projection)
      expect(Str.includes("inv:onHold false")(written)).toBe(true)
      expect(Str.includes('"2026-11-01T09:00:00Z"^^xsd:dateTime')(written)).toBe(true)
      const readBack = yield* readTurtle(vocabulary.base, written)
      const result = reparse(graph, readBack)
      expect([result.missing, result.extra]).toStrictEqual([[], []])
      const statements = yield* parseTurtle(vocabulary.base, written)
      expect(named(constructFindings({ kind: "graph", vocabulary, statements }))).toStrictEqual([])
    })
  )

  it.effect(
    "planted: the writer refuses a boolean that is neither true nor false, and a day given as a date-time",
    () =>
      Effect.gen(function* () {
        const context = yield* constructsContext
        const { vocabulary } = context
        const member = `${vocabulary.base}/fixture/Member/test_Held`
        const refusal = Effect.fn("refusal")(function* (predicate: string, value: string, datatype: string) {
          const projection = graphProjection(context, "a planted graph", [
            literal(member, `${vocabulary.namespace}${predicate}`, value, `${RdfVocab.xsd.iri}${datatype}`)
          ])
          const refused = yield* Effect.flip(writeTurtle(projection))
          return refused.reason
        })
        const word = yield* refusal("onHold", "yes", "boolean")
        const digit = yield* refusal("onHold", "1", "boolean")
        const day = yield* refusal("recordedAt", "2026-11-01", "dateTime")
        const hour = yield* refusal("recordedAt", "2026-11-01T9:00:00Z", "dateTime")
        expect([word, digit]).toStrictEqual([
          `a value of ${member} is no boolean the files write: "yes" is neither true nor false`,
          `a value of ${member} is no boolean the files write: "1" is neither true nor false`
        ])
        expect([day, hour]).toStrictEqual([
          `a value of ${member} is no xsd:dateTime: "2026-11-01"`,
          `a value of ${member} is no xsd:dateTime: "2026-11-01T9:00:00Z"`
        ])
        // XML Schema 1.1 part 2, section 3.3.7.2: a day past its month's end, and 29 February outside a leap year.
        const pastEnd = A.make(
          "2026-02-30T00:00:00Z",
          "2026-04-31T00:00:00Z",
          "2026-02-29T00:00:00Z",
          "1900-02-29T00:00:00Z"
        )
        const refused = yield* Effect.forEach(pastEnd, (value) => refusal("recordedAt", value, "dateTime"), {
          concurrency: 1
        })
        expect(refused).toStrictEqual(A.map(pastEnd, (value) => `a value of ${member} is no xsd:dateTime: "${value}"`))
        // The near miss: the last day of each, and 29 February of a leap year, a year of 400 among them.
        const lastDays = A.make(
          "2026-04-30T00:00:00Z",
          "2026-12-31T23:59:59Z",
          "2024-02-29T00:00:00Z",
          "2000-02-29T00:00:00Z"
        )
        const written = yield* writeTurtle(
          graphProjection(
            context,
            "a planted graph",
            A.map(lastDays, (value) =>
              literal(member, `${vocabulary.namespace}recordedAt`, value, `${RdfVocab.xsd.iri}dateTime`)
            )
          )
        )
        expect(A.filter(lastDays, (value) => !Str.includes(`"${value}"^^xsd:dateTime`)(written))).toStrictEqual([])
      })
  )
})

describe("gate 3, for the party slice's constructs", () => {
  /** Gate 3 on one Turtle text, read as the `kind` file of `vocabulary`. */
  const refusedIn = Effect.fn("refusedIn")(function* (kind: FileKind, text: string, vocabulary: Vocabulary) {
    const statements = yield* parseTurtle(vocabulary.base, text)
    return named(constructFindings({ kind, vocabulary, statements }))
  })

  it.effect("planted: a retirement's three predicates are refused in the graph file, whose list lacks them", () =>
    Effect.gen(function* () {
      const { vocabulary: copy } = yield* constructsContext
      const { namespace } = copy
      const subject = `<${namespace}Workspace>`
      const retirement = A.join(
        [
          `${subject} ${at("owl", "deprecated")} true .`,
          `${subject} ${at("dcterms", "isReplacedBy")} <${namespace}Tenant> .`,
          `${subject} ${at("skos", "historyNote")} "Deprecated in 0.1.0."@en .`,
          ""
        ],
        "\n"
      )
      const asGraph = yield* refusedIn("graph", retirement, copy)
      const asOwl = yield* refusedIn("owl", retirement, copy)
      const asSkos = yield* refusedIn("skos", retirement, copy)
      expect(asGraph).toStrictEqual([
        ["predicate", `${RdfVocab.owl.iri}deprecated`],
        ["predicate", `${RdfVocab.dcterms.iri}isReplacedBy`],
        ["predicate", `${RdfVocab.skos.iri}historyNote`]
      ])
      // The near miss: the OWL file and the SKOS file each hold all three.
      expect([asOwl, asSkos]).toStrictEqual([[], []])
    })
  )

  it.effect(
    "planted: a gist subject typed a property is refused while the gist list lacks it, or holds the other kind",
    () =>
      Effect.gen(function* () {
        const { vocabulary: copy } = yield* constructsContext
        const { vocabulary: kernel } = yield* threadContext
        const { gist } = copy
        const typed = (name: string, kind: string) =>
          `<${gist.namespace}${name}> ${at("rdf", "type")} ${at("owl", kind)} .\n`
        const relation = `${gist.namespace}isCategorizedBy`
        const attribute = `${gist.namespace}plantedAttribute`
        // The kernel's list holds `isCategorizedBy` and `isAbout` (decision 176), not the copy's planted attribute.
        const unlisted = yield* refusedIn("owl", typed("plantedAttribute", "DatatypeProperty"), kernel)
        const asAttribute = yield* refusedIn("owl", typed("isCategorizedBy", "DatatypeProperty"), copy)
        const asRelation = yield* refusedIn("owl", typed("plantedAttribute", "ObjectProperty"), copy)
        expect([unlisted, asAttribute, asRelation]).toStrictEqual([
          [["namespace", attribute]],
          [["namespace", relation]],
          [["namespace", attribute]]
        ])
        // The near miss: each declared as the kind the copy's list gives it, and the kernel's relation as the kernel's.
        const relationDeclared = yield* refusedIn("owl", typed("isCategorizedBy", "ObjectProperty"), copy)
        const attributeDeclared = yield* refusedIn("owl", typed("plantedAttribute", "DatatypeProperty"), copy)
        const kernelDeclared = yield* refusedIn("owl", typed("isCategorizedBy", "ObjectProperty"), kernel)
        expect([relationDeclared, attributeDeclared, kernelDeclared]).toStrictEqual([[], [], []])
      })
  )

  it.effect("planted: a listed gist property's domain, range or own gist parent is refused (decision 16)", () =>
    Effect.gen(function* () {
      const { vocabulary: copy } = yield* constructsContext
      const attribute = `${copy.gist.namespace}plantedAttribute`
      const ranged = `<${attribute}> ${at("rdfs", "range")} ${at("xsd", "dateTime")} .\n`
      const domained = `<${attribute}> ${at("rdfs", "domain")} <${copy.gist.namespace}Content> .\n`
      // Decision 16 copies a gist property's own gist parent, but the metamodel has no field for one yet, so the
      // projector writes none and the gate refuses one until the step that builds the field (PLAN, step 2).
      const parented = `<${attribute}> ${at("rdfs", "subPropertyOf")} <${copy.gist.namespace}atDateTime> .\n`
      const range = yield* refusedIn("owl", ranged, copy)
      const domain = yield* refusedIn("owl", domained, copy)
      const parent = yield* refusedIn("owl", parented, copy)
      // Each is refused twice: the gist name is no class on the list, and a gist subject carries no domain, range or
      // property parent.
      expect([range, domain, parent]).toStrictEqual([
        [
          ["namespace", attribute],
          ["namespace", attribute]
        ],
        [
          ["namespace", attribute],
          ["namespace", attribute]
        ],
        [
          ["namespace", attribute],
          ["namespace", attribute]
        ]
      ])
    })
  )
})
