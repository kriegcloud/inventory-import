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
import { describe, expect, it } from "@effect/vitest"
import { ClassTerm, Vocabulary } from "@beep/vocabulary/Model"
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
import { byCodePoint, Iri, lineOf, link, TextNode } from "../src/Graph.schema.ts"
import { owlProjection, triplesOf } from "../src/Project.ts"
import { threadContext } from "../src/Thread.ts"
import { parseTurtle, readTurtle } from "../src/Turtle.ts"
import { writeTurtle } from "../src/Write.ts"

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

  it.effect("planted: sameness between two terms is refused by the predicate list", () =>
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
    expect(O.isNone(words({ kind: "text", value: "Hi", language: "en-US" }))).toBe(true)
    expect(O.isSome(words({ kind: "text", value: "Hi", language: "en-us" }))).toBe(true)
  })

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
