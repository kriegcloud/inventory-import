// A hand-written vocabulary literal decodes through `Vocabulary` strictly, and a ratification that names a `rat-`
// record, or a field the metamodel does not have, is refused. The literal is an example library's, not this
// repository's: the package names no term of any one vocabulary.
import { describe, expect, it } from "@effect/vitest"
import type { Curie } from "@beep/identity/Vocab"
import { ClassTerm, Ratification, Vocabulary } from "@beep/vocabulary/Model"
import { RdfVocab, type RdfCurie, type XsdTerm } from "@beep/vocabulary/Rdf"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"

const strict = { onExcessProperty: "error", errors: "all" } as const
const decodeStrict = S.decodeUnknownEffect(Vocabulary, strict)

const book = {
  prefLabel: "Book",
  definition: "A written work published as one volume, read by a library's members.",
  tag: "kind",
  parent: { kind: "gist", name: "Content" },
  identity: { kind: "stated", criterion: "The edition's ISBN, the same book being the same edition." },
  ratification: { decision: 3 }
} as const

const twoTerms = {
  base: "https://example.org/library",
  namespace: "https://example.org/library/ontology/",
  version: "0.1.0",
  gist: {
    version: "14.1.0",
    namespace: "https://w3id.org/semanticarts/ns/ontology/gist/",
    versionIri: "https://w3id.org/semanticarts/ontology/gistCore14.1.0",
    classes: { Content: {} },
    disjointPairs: []
  },
  classes: { Book: book },
  objectProperties: {},
  datatypeProperties: {
    publishedAt: {
      prefLabel: "published at",
      definition: "The instant at which a book's edition was first offered for sale.",
      domain: "Book",
      datatype: "xsd:dateTime",
      ratification: { decision: 3 }
    }
  },
  schemes: {}
} as const satisfies typeof Vocabulary.Encoded

describe("Vocabulary", () => {
  it.effect("decodes a two-term literal written against its encoded side", () =>
    Effect.gen(function* () {
      const vocabulary = yield* decodeStrict(twoTerms)
      expect(R.keys(vocabulary.classes)).toEqual(["Book"])
      expect(R.keys(vocabulary.datatypeProperties)).toEqual(["publishedAt"])
      const decodedBook = R.get(vocabulary.classes, "Book")
      expect(O.map(decodedBook, (term) => term.ratification.decision)).toEqual(O.some(3))
      expect(O.map(decodedBook, (term) => term.altLabels)).toEqual(O.some([]))
      const publishedAt = R.get(vocabulary.datatypeProperties, "publishedAt")
      expect(O.flatMap(publishedAt, (term) => term.domain)).toEqual(O.some("Book"))
      expect(O.flatMap(publishedAt, (term) => term.evidence)).toEqual(O.none())
      expect(O.flatMap(publishedAt, (term) => term.subPropertyOf)).toEqual(O.none())
      expect(O.map(decodedBook, (term) => term.categoryParents)).toEqual(O.some([]))
      expect(O.flatMap(decodedBook, (term) => term.deprecation)).toEqual(O.none())
      expect(O.map(decodedBook, (term) => O.isSome(term.identity))).toEqual(O.some(true))
      expect(vocabulary.gist.properties).toEqual({})
    })
  )

  it.effect("decodes an attribute written as xsd:boolean, the datatype the party slice's flags need", () =>
    Effect.gen(function* () {
      const flag = {
        prefLabel: "is lent",
        definition: "Whether a book may leave the library on a loan.",
        domain: "Book",
        datatype: "xsd:boolean",
        ratification: { decision: 3 }
      } as const
      const vocabulary = yield* decodeStrict({ ...twoTerms, datatypeProperties: { isLent: flag } })
      expect(O.map(R.get(vocabulary.datatypeProperties, "isLent"), (term) => term.datatype)).toEqual(
        O.some("xsd:boolean")
      )
    })
  )

  it.effect("refuses a ratification that names a rat- record", () =>
    Effect.gen(function* () {
      const named: unknown = { ...twoTerms, classes: { Book: { ...book, ratification: "rat-x" } } }
      const refusal = yield* Effect.flip(decodeStrict(named))
      expect(refusal.message).toContain("ratification")
    })
  )

  it.effect("refuses a field the metamodel does not have", () =>
    Effect.gen(function* () {
      const extra: unknown = {
        ...twoTerms,
        classes: { Book: { ...book, scopeNote: "Read in the reading room only." } }
      }
      const refusal = yield* Effect.flip(decodeStrict(extra))
      expect(refusal.message).toContain("scopeNote")
    })
  )

  it.effect("refuses a class key in the wrong case instead of dropping it", () =>
    Effect.gen(function* () {
      const misspelt: unknown = { ...twoTerms, classes: { Book: book, periodical: book } }
      const refusal = yield* Effect.flip(decodeStrict(misspelt))
      expect(refusal.message).toContain("periodical")
    })
  )

  it.effect("refuses a relation with no range: decision 145 keeps an object property's range required", () =>
    Effect.gen(function* () {
      const unranged: unknown = {
        ...twoTerms,
        objectProperties: {
          lentTo: {
            prefLabel: "lent to",
            definition: "Links a book to whoever it is lent to, with no range written.",
            domain: "Book",
            ratification: { decision: 3 }
          }
        }
      }
      const refusal = yield* Effect.flip(decodeStrict(unranged))
      expect(refusal.message).toContain("range")
    })
  )

  it.effect("refuses a ratification that is not a whole number", () =>
    Effect.gen(function* () {
      const fraction: unknown = { ...twoTerms, classes: { Book: { ...book, ratification: { decision: 3.5 } } } }
      const refusal = yield* Effect.flip(decodeStrict(fraction))
      expect(refusal.message).toContain("decision")
    })
  )
})

describe("the types a vocabulary module leans on", () => {
  it("rejects a rat- string on the encoded side at compile time", () => {
    // @ts-expect-error a ratification is { decision }, never the name of a rat- record
    const wrong: typeof Ratification.Encoded = "rat-x"
    expect(S.is(Ratification)(wrong)).toBe(false)
  })

  it.effect("keeps an Opaque class's fields, so a struct can be built from them", () =>
    Effect.gen(function* () {
      const copy = S.Struct({ ...ClassTerm.fields })
      const decoded = yield* S.decodeEffect(copy, strict)(book)
      expect(decoded.ratification.decision).toBe(3)
    })
  )

  it("keeps the merged registry's literal terms, rdf:type included", () => {
    const written: ReadonlyArray<RdfCurie> = [
      "rdf:type",
      "owl:disjointWith",
      "owl:versionIRI",
      "xsd:dateTime",
      "xsd:boolean"
    ]
    const leaf: XsdTerm = "string"
    // @ts-expect-error a datatype the registry lacks is not a CURIE of it
    const missing: Curie<typeof RdfVocab> = "xsd:integer"
    expect(written).toHaveLength(5)
    expect(RdfVocab.xsd.terms).toContain(leaf)
    expect(RdfVocab.owl.terms).toContain("disjointWith")
    expect(RdfVocab.rdf.terms).toContain("type")
    expect(missing).toBe("xsd:integer")
  })
})
