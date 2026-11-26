/**
 * Gates 1, 2 and 3 on the generated files (report 14 sections 6.1 to 6.3), as pure functions: the first line where
 * a committed text differs from the projected one; the triples a text holds and the writer was not given, and the
 * other way round; and every statement of a file that is outside what that file may hold.
 *
 * Do not break: gate 3's two lists per file are its own, written here and not taken from the projector's order of
 * predicates, so a predicate or a type the projector starts to write is refused until it is added here on purpose.
 * The lists hold no sameness, no key, no inverse, no characteristic and no restriction: those are the constructs by
 * which a reasoner could conclude that two tenants are one organization (the fifth forbidden conclusion), and each is
 * a finding the moment a file states it. The gate works on parsed statements, never on text.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import type { Vocabulary } from "@beep/vocabulary/Model"
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import { dual, identity } from "effect/Function"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { lineOf, type Iri, type Triple } from "./Graph.schema.ts"
import { $OntologyId } from "./internal/identity.ts"
import { ontologyIri, taxonomyIri, term, w3 } from "./Project.ts"
import { ParsedNode, type ParsedTriple } from "./Turtle.ts"

const $I = $OntologyId.create("Constructs")

/** Which of the three generated files a text is: each has its own lists. */
export const FileKind = LiteralKit(["owl", "skos", "graph"]).pipe(
  $I.annoteSchema("FileKind", { description: "Which generated file a text is" })
)
/** Runtime type of {@link FileKind}. */
export type FileKind = typeof FileKind.Type

// ---------------------------------------------------------------------------------------------------------------
// Gate 1, byte-compare
// ---------------------------------------------------------------------------------------------------------------

/** The first line at which two texts differ, counted from one, with each text's line there. */
export class Difference extends S.Opaque<Difference, { readonly brand: unique symbol }>()(
  S.Struct({
    line: S.Int.pipe(S.annotateKey({ description: "The line's number, from one" })),
    projected: S.String.pipe(
      S.annotateKey({ description: "The line as the projector writes it now; empty past its end" })
    ),
    committed: S.String.pipe(S.annotateKey({ description: "The line as committed; empty past its end" }))
  }).pipe($I.annoteSchema("Difference", { description: "The first line at which two texts differ" }))
) {}

/**
 * Gate 1: none when the committed text is the projected one byte for byte, else the first line that differs. A text
 * that ends without its final newline, or with one more, differs at that line.
 *
 * @example firstDifference(projected, committed) // None when equal
 */
export const firstDifference: {
  (committed: string): (projected: string) => O.Option<Difference>
  (projected: string, committed: string): O.Option<Difference>
} = dual(2, (projected: string, committed: string): O.Option<Difference> => {
  if (projected === committed) {
    return O.none()
  }
  const ours = Str.split("\n")(projected)
  const theirs = Str.split("\n")(committed)
  // A file that ends before the other has no line there: it reads as empty text in the difference.
  const lineAt = (lines: ReadonlyArray<string>, index: number): string =>
    O.match(A.get(lines, index), { onNone: () => "", onSome: identity })
  return O.map(
    A.findFirstIndex(
      A.makeBy(Math.max(ours.length, theirs.length), (at) => at),
      (at) => !Eq.equals(A.get(ours, at), A.get(theirs, at))
    ),
    (index) => Difference.make({ line: index + 1, projected: lineAt(ours, index), committed: lineAt(theirs, index) })
  )
})

/**
 * What gate 1 tells the person who changed a term: the file, the first line that differs, and the command that
 * writes the files again.
 *
 * @example differenceSentence("generated/inventory.owl.ttl", difference) // "… differs at line 51 …"
 */
export const differenceSentence: {
  (difference: Difference): (path: string) => string
  (path: string, difference: Difference): string
} = dual(
  2,
  (path: string, difference: Difference): string =>
    `packages/ontology/${path} differs from what the projector writes at line ${difference.line}: committed \`${difference.committed}\`, projected \`${difference.projected}\`. Run \`bun run ontology:write\` and commit the files.`
)

// ---------------------------------------------------------------------------------------------------------------
// Gate 2, re-parse
// ---------------------------------------------------------------------------------------------------------------

/** How a text read back differs from what the writer was given, each triple as its line. */
export class Reparse extends S.Opaque<Reparse, { readonly brand: unique symbol }>()(
  S.Struct({
    missing: S.Array(S.String).pipe(S.annotateKey({ description: "Given to the writer and not in the text" })),
    extra: S.Array(S.String).pipe(S.annotateKey({ description: "In the text and not given to the writer" }))
  }).pipe($I.annoteSchema("Reparse", { description: "How a text read back differs from what was written" }))
) {}

/**
 * Gate 2: the triples a text holds, read back, against the triples the writer was given. Both lists are empty when
 * the round trip holds.
 *
 * @example reparse(given, readBack) // { missing: [], extra: [] }
 */
export const reparse: {
  (readBack: ReadonlyArray<Triple>): (given: ReadonlyArray<Triple>) => Reparse
  (given: ReadonlyArray<Triple>, readBack: ReadonlyArray<Triple>): Reparse
} = dual(2, (given: ReadonlyArray<Triple>, readBack: ReadonlyArray<Triple>): Reparse => {
  const written = A.dedupe(A.map(given, lineOf))
  const read = A.dedupe(A.map(readBack, lineOf))
  return Reparse.make({ missing: A.difference(written, read), extra: A.difference(read, written) })
})

// ---------------------------------------------------------------------------------------------------------------
// Gate 3, forbidden constructs and the namespace guard
// ---------------------------------------------------------------------------------------------------------------

/** What gate 3 holds a statement to: the predicate list, the type list, the namespace guard, or no blank node. */
export const ConstructRule = LiteralKit(["predicate", "type", "namespace", "blank"]).pipe(
  $I.annoteSchema("ConstructRule", { description: "The list or guard of gate 3 a statement is outside" })
)
/** Runtime type of {@link ConstructRule}. */
export type ConstructRule = typeof ConstructRule.Type

/** One statement a file may not hold: which list or guard refuses it, and the IRI or node it refuses. */
export class ConstructFinding extends S.Opaque<ConstructFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    rule: ConstructRule.pipe(S.annotateKey({ description: "The list or guard that refuses it" })),
    about: S.String.pipe(S.annotateKey({ description: "The IRI or blank node that is refused" })),
    detail: S.String.pipe(S.annotateKey({ description: "What is wrong, in one sentence" }))
  }).pipe($I.annoteSchema("ConstructFinding", { description: "One statement a generated file may not hold" }))
) {}

/** What gate 3 reads beside the statements: the decoded vocabulary. */
export type ConstructInput = {
  readonly kind: FileKind
  readonly vocabulary: Vocabulary
  readonly statements: ReadonlyArray<ParsedTriple>
}

const found = (rule: ConstructRule, about: string, detail: string): ConstructFinding =>
  ConstructFinding.make({ rule, about, detail })

/** Section 6.3's table, first column: the predicates each file may state. */
const allowedPredicates = (kind: FileKind, vocabulary: Vocabulary): ReadonlyArray<Iri> =>
  FileKind.match(kind, {
    owl: () => [
      term("rdf", "type"),
      term("rdfs", "subClassOf"),
      term("rdfs", "subPropertyOf"),
      term("rdfs", "domain"),
      term("rdfs", "range"),
      term("owl", "disjointWith"),
      term("owl", "versionIRI"),
      term("owl", "versionInfo"),
      term("dcterms", "source"),
      term("skos", "prefLabel"),
      term("skos", "altLabel"),
      term("skos", "definition")
    ],
    skos: () => [
      term("rdf", "type"),
      term("owl", "versionIRI"),
      term("owl", "versionInfo"),
      term("skos", "prefLabel"),
      term("skos", "altLabel"),
      term("skos", "definition"),
      term("skos", "notation"),
      term("skos", "inScheme"),
      term("skos", "topConceptOf")
    ],
    graph: () => [
      term("rdf", "type"),
      ...A.map(
        [...R.keys(vocabulary.objectProperties), ...R.keys(vocabulary.datatypeProperties)],
        (key) => `${vocabulary.namespace}${key}`
      )
    ]
  })

/** Section 6.3's table, second column: what each file may give as the object of `rdf:type`. */
const allowedTypes = (kind: FileKind, vocabulary: Vocabulary): ReadonlyArray<Iri> =>
  FileKind.match(kind, {
    owl: () => [
      term("owl", "Ontology"),
      term("owl", "Class"),
      term("owl", "ObjectProperty"),
      term("owl", "DatatypeProperty"),
      term("owl", "AnnotationProperty"),
      term("owl", "NamedIndividual"),
      ...A.dedupe(
        A.flatMap(R.values(vocabulary.schemes), (scheme) =>
          A.getSomes(
            A.map(R.values(scheme.concepts), (concept) =>
              O.map(concept.alsoInstanceOf, (key) => `${vocabulary.namespace}${key}`)
            )
          )
        )
      )
    ],
    skos: () => [term("owl", "Ontology"), term("skos", "ConceptScheme"), term("skos", "Concept")],
    graph: () => A.map(R.keys(vocabulary.classes), (key) => `${vocabulary.namespace}${key}`)
  })

/** Every local name the vocabulary holds: its classes, properties and schemes, and each concept. */
const termsOf = (vocabulary: Vocabulary): ReadonlyArray<string> => [
  ...R.keys(vocabulary.classes),
  ...R.keys(vocabulary.objectProperties),
  ...R.keys(vocabulary.datatypeProperties),
  ...R.keys(vocabulary.schemes),
  ...A.flatMap(R.toEntries(vocabulary.schemes), ([scheme, entry]) =>
    A.map(R.keys(entry.concepts), (notation) => `${scheme}-${notation}`)
  )
]

/**
 * Gate 3: every statement of one file that is outside its predicate list, its type list or the namespace guard, and
 * every blank node. None when the file holds only what it may.
 *
 * @example constructFindings({ kind: "owl", vocabulary, statements }) // []
 */
export const constructFindings = (input: ConstructInput): ReadonlyArray<ConstructFinding> => {
  const { kind, vocabulary, statements } = input
  const type = term("rdf", "type")
  const source = term("dcterms", "source")
  const predicates = allowedPredicates(kind, vocabulary)
  const types = allowedTypes(kind, vocabulary)
  const terms = termsOf(vocabulary)
  const under = (namespace: string) => (iri: string) => Str.startsWith(namespace)(iri)
  const underBase = (iri: string): boolean => iri === vocabulary.base || under(`${vocabulary.base}/`)(iri)
  const registry = R.values(w3)
  const known = (iri: string): boolean =>
    underBase(iri) || under(vocabulary.gist.namespace)(iri) || A.some(registry, (namespace) => under(namespace)(iri))
  const annotationHomes = [w3.skos, w3.dcterms]
  const document = FileKind.match(kind, {
    owl: () => O.some(ontologyIri(vocabulary)),
    skos: () => O.some(taxonomyIri(vocabulary)),
    graph: () => O.none<Iri>()
  })
  const isType = (statement: ParsedTriple, object: Iri): boolean =>
    statement.predicate === type && ParsedNode.guards.iri(statement.object) && statement.object.iri === object
  const subjectFindings = (statement: ParsedTriple, subject: Iri): ReadonlyArray<ConstructFinding> => {
    if (under(vocabulary.namespace)(subject)) {
      return A.contains(terms, Str.slice(vocabulary.namespace.length)(subject))
        ? []
        : [found("namespace", subject, "the subject is under the vocabulary's namespace and is no term it holds")]
    }
    if (under(vocabulary.gist.namespace)(subject)) {
      const name = Str.slice(vocabulary.gist.namespace.length)(subject)
      const carries =
        isType(statement, term("owl", "Class")) ||
        statement.predicate === term("rdfs", "subClassOf") ||
        statement.predicate === term("owl", "disjointWith")
      return [
        ...(R.has(vocabulary.gist.classes, name)
          ? []
          : [found("namespace", subject, "the gist subject is not on the vocabulary's projection list")]),
        ...(carries
          ? []
          : [found("namespace", subject, "a gist subject carries a type of class, a parent or a pair only")])
      ]
    }
    if (A.some(annotationHomes, (namespace) => under(namespace)(subject))) {
      return isType(statement, term("owl", "AnnotationProperty"))
        ? []
        : [found("namespace", subject, "a SKOS or Dublin Core subject is declared an annotation property and no more")]
    }
    const placed =
      O.contains(document, subject) ||
      (kind === "graph" &&
        (under(`${vocabulary.base}/data/`)(subject) || under(`${vocabulary.base}/fixture/`)(subject)))
    return placed ? [] : [found("namespace", subject, "the subject is no term, no document and no node of the graph")]
  }
  return A.flatMap(statements, (statement) => {
    const subject = statement.subject
    const object = statement.object
    const blanks = A.map(A.filter([subject, object], ParsedNode.guards.blank), (node) =>
      found("blank", `_:${node.id}`, "the file holds a blank node")
    )
    const predicate = A.contains(predicates, statement.predicate)
      ? []
      : [found("predicate", statement.predicate, "the predicate is not one this file may state")]
    const typed =
      statement.predicate === type && !(ParsedNode.guards.iri(object) && A.contains(types, object.iri))
        ? [found("type", ParsedNode.guards.iri(object) ? object.iri : "", "the type is not one this file may give")]
        : []
    const subjects = ParsedNode.guards.iri(subject) ? subjectFindings(statement, subject.iri) : []
    // Every IRI is under the base, gist's namespace or a registry namespace, except the one object dcterms:source
    // may take: the version of gist the vocabulary projects from. Any other host there is refused like anywhere else.
    const iris = [
      ...(ParsedNode.guards.iri(subject) ? [subject.iri] : []),
      statement.predicate,
      ...(ParsedNode.guards.iri(object) &&
      !(statement.predicate === source && object.iri === vocabulary.gist.versionIri)
        ? [object.iri]
        : []),
      ...(ParsedNode.guards.literal(object) ? [object.datatype] : [])
    ]
    const hosts = A.map(
      A.filter(iris, (iri) => !known(iri)),
      (iri) => found("namespace", iri, "the IRI is under no namespace a generated file may name")
    )
    // A W3C term is named as an object in two places only: the type of a subject, held to the type list above, and
    // a datatype as a range. Anywhere else it makes a term of ours a kind of a construct the file may not state:
    // a property under sameness, a class under a restriction.
    const borrowed =
      ParsedNode.guards.iri(object) &&
      statement.predicate !== type &&
      A.some(registry, (namespace) => under(namespace)(object.iri)) &&
      !(statement.predicate === term("rdfs", "range") && under(w3.xsd)(object.iri))
        ? [
            found(
              "namespace",
              object.iri,
              "a W3C term is an object only as a type, or as a datatype a property ranges over"
            )
          ]
        : []
    return [...blanks, ...predicate, ...typed, ...subjects, ...hosts, ...borrowed]
  })
}
