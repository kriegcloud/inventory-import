// Gate 4's rules on a small vocabulary of an example library, not this repository's: the valid one gives no finding,
// and each copy changed to break one rule gives that rule's findings and no other. The decision log is text handed
// in, so C12's planted number 999 changes no committed file.
import { describe, expect, it } from "@effect/vitest"
import { Vocabulary } from "@beep/vocabulary/Model"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as Num from "effect/Number"
import * as S from "effect/Schema"
import { coherenceFindings, decisionHeadings, ExceptionList } from "../src/Rules.rules.ts"

const strict = { onExcessProperty: "error", errors: "all" } as const
const decodeVocabulary = S.decodeUnknownEffect(Vocabulary, strict)
const decodeExceptions = S.decodeUnknownEffect(ExceptionList, strict)

const log = A.join(
  [
    "# Decisions",
    "",
    "### 2. Genres have no gist parent (2026-01-02)",
    "",
    "### 3. The library's terms are accepted (2026-01-03)",
    "",
    "### 39 and 43. A combined entry (2026-01-04)",
    "",
    "## Open",
    "",
    "| 50 | Whether a shelf is a place | open |"
  ],
  "\n"
)

const genreReason = "Its individuals are the concepts of GenreScheme; no gist class fits yet."
const accepted = { decision: 3 } as const

const book = {
  prefLabel: "Book",
  definition: "A written work published as one volume, read by a library's members.",
  tag: "kind",
  parent: { kind: "gist", name: "Content" },
  identity: { kind: "stated", criterion: "The edition's ISBN, the same book being the same edition." },
  ratification: accepted
} as const

const library = {
  prefLabel: "Library",
  definition: "An organization that lends books to the members it registers.",
  tag: "kind",
  parent: { kind: "gist", name: "Organization" },
  identity: { kind: "stated", criterion: "The registration number the library was given." },
  ratification: accepted
} as const

const branch = {
  prefLabel: "Branch",
  definition: "A library in its role as one of the places a lending network runs.",
  tag: "role",
  parent: { kind: "local", key: "Library" },
  identity: { kind: "inherited" },
  ratification: accepted
} as const

const loan = {
  prefLabel: "Loan",
  definition: "A relationship between one member and one book for the time it is out.",
  tag: "relator",
  parent: { kind: "gist", name: "TemporalRelation" },
  identity: { kind: "stated", criterion: "The loan number, kept after the book is returned." },
  ratification: accepted
} as const

const genre = {
  prefLabel: "Genre",
  definition: "A kind of writing a library shelves its books by.",
  tag: "information",
  parent: { kind: "none", reason: genreReason },
  identity: { kind: "stated", criterion: "The genre's notation in GenreScheme." },
  ratification: accepted
} as const

const loanOf = {
  prefLabel: "loan of",
  definition: "Links a loan to the book that is lent.",
  domain: "Loan",
  range: { kind: "class", key: "Book" },
  ratification: accepted
} as const

const loanStatus = {
  prefLabel: "loan status",
  definition: "Links a loan to the stage of lending it is at.",
  domain: "Loan",
  range: { kind: "scheme", key: "LoanStatusScheme" },
  ratification: accepted
} as const

const heldAt = {
  prefLabel: "held at",
  definition: "Links anything a library keeps to the branch that keeps it.",
  range: { kind: "class", key: "Branch" },
  ratification: accepted
} as const

const publishedAt = {
  prefLabel: "published at",
  definition: "The instant at which a book's edition was first offered for sale.",
  domain: "Book",
  datatype: "xsd:dateTime",
  ratification: accepted
} as const

const concept = (prefLabel: string) =>
  ({ prefLabel, definition: `A stage of lending: the book is ${prefLabel}.`, ratification: accepted }) as const

const fiction = {
  prefLabel: "fiction",
  definition: "Writing that tells of people and events that are invented.",
  ratification: accepted,
  alsoInstanceOf: "Genre"
} as const

const loanStatusScheme = {
  prefLabel: "Loan status",
  definition: "The stages of lending a loan moves through.",
  closed: true,
  concepts: { "on-loan": concept("on loan"), returned: concept("returned") },
  ratification: accepted
} as const

const genreScheme = {
  prefLabel: "Genre",
  definition: "The kinds of writing a library shelves its books by.",
  closed: false,
  concepts: { fiction },
  ratification: accepted
} as const

const gist = {
  version: "14.1.0",
  namespace: "https://w3id.org/semanticarts/ns/ontology/gist/",
  versionIri: "https://w3id.org/semanticarts/ontology/gistCore14.1.0",
  classes: { Content: {}, Organization: {}, TemporalRelation: {} },
  disjointPairs: [["Organization", "Content"]]
} as const

const valid = {
  base: "https://example.org/library",
  namespace: "https://example.org/library/ontology/",
  version: "0.1.0",
  gist,
  classes: { Book: book, Library: library, Branch: branch, Loan: loan, Genre: genre },
  objectProperties: { loanOf, loanStatus, heldAt },
  datatypeProperties: { publishedAt },
  schemes: { LoanStatusScheme: loanStatusScheme, GenreScheme: genreScheme }
} as const satisfies typeof Vocabulary.Encoded

const exceptions = [{ class: "Genre", reason: genreReason, ratification: { decision: 2 } }] as const

/** The rule and key of each finding the gate reports for a copy of the vocabulary and the exception list. */
const findingsOf = Effect.fn("findingsOf")(function* (vocabulary: unknown, list: unknown = exceptions) {
  const decoded = yield* decodeVocabulary(vocabulary)
  const entries = yield* decodeExceptions(list)
  return A.map(
    coherenceFindings({ vocabulary: decoded, exceptions: entries, decisions: decisionHeadings(log) }),
    (finding) => [finding.rule, finding.kind, finding.key]
  )
})

const withClasses = (classes: object): unknown => ({ ...valid, classes: { ...valid.classes, ...classes } })

describe("decisionHeadings", () => {
  it("reads the number of each `### <n>. ` heading and nothing else", () => {
    expect(A.sort(A.fromIterable(decisionHeadings(log)), Num.Order)).toEqual([2, 3])
  })

  it("does not match a combined heading, a deeper heading, an indented one or one with no space after the dot", () => {
    const text = A.join(["### 39 and 43. Both", "#### 5. Deeper", " ### 6. Indented", "### 7.No space", "### 8."], "\n")
    expect(HashSet.size(decisionHeadings(text))).toBe(0)
  })

  it("reads a heading on a line ended by a carriage return", () => {
    expect(HashSet.has(decisionHeadings("intro\r\n### 97. A class with no gist parent\r\n"), 97)).toBe(true)
  })
})

describe("coherenceFindings", () => {
  it.effect("finds nothing in a coherent vocabulary", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(valid)
      expect(found).toEqual([])
    })
  )

  it.effect("C1: a key used by an object property and a datatype property", () =>
    Effect.gen(function* () {
      const copy = { ...valid, datatypeProperties: { ...valid.datatypeProperties, loanOf: publishedAt } }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C1", "datatypeProperty", "loanOf"]])
    })
  )

  it.effect("C1: a key used by a class and a scheme", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(withClasses({ GenreScheme: library }))
      expect(found).toEqual([["C1", "scheme", "GenreScheme"]])
    })
  )

  it.effect("C3: a gist parent not on the gist list", () =>
    Effect.gen(function* () {
      const copy = withClasses({ Book: { ...book, parent: { kind: "gist", name: "Event" } } })
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C3", "class", "Book"]])
    })
  )

  it.effect("C3: a local parent that is not a class of the vocabulary", () =>
    Effect.gen(function* () {
      const copy = withClasses({ Branch: { ...branch, parent: { kind: "local", key: "Network" } } })
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C3", "class", "Branch"]])
    })
  )

  it.effect("C3: two classes that are each other's parent", () =>
    Effect.gen(function* () {
      const shelf = { ...library, prefLabel: "Shelf", parent: { kind: "local", key: "Branch" } }
      const copy = withClasses({ Branch: { ...branch, parent: { kind: "local", key: "Shelf" } }, Shelf: shelf })
      const found = yield* findingsOf(copy)
      expect(found).toEqual([
        ["C3", "class", "Branch"],
        ["C3", "class", "Shelf"]
      ])
    })
  )

  it.effect("C4: the planted mistake, a class given no parent that the list does not name", () =>
    Effect.gen(function* () {
      const copy = withClasses({ Loan: { ...loan, parent: { kind: "none", reason: "planted, with no entry" } } })
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C4", "class", "Loan"]])
    })
  )

  it.effect("C4: a reason that differs from the list's", () =>
    Effect.gen(function* () {
      const copy = withClasses({ Genre: { ...genre, parent: { kind: "none", reason: `${genreReason} Later.` } } })
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C4", "class", "Genre"]])
    })
  )

  it.effect("C4: an entry for a class that has a parent, and an entry written twice", () =>
    Effect.gen(function* () {
      const list = [...exceptions, { class: "Book", reason: genreReason, ratification: { decision: 2 } }, ...exceptions]
      const found = yield* findingsOf(valid, list)
      expect(found).toEqual([
        ["C4", "exception", "Book"],
        ["C4", "exception", "Genre"]
      ])
    })
  )

  it.effect("C5: a gist class whose gist parent is not on the list", () =>
    Effect.gen(function* () {
      const copy = { ...valid, gist: { ...gist, classes: { ...gist.classes, Person: { parent: "LivingThing" } } } }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C5", "gist", "Person"]])
    })
  )

  it.effect("C6: a disjoint pair naming a class not on the gist list", () =>
    Effect.gen(function* () {
      const copy = { ...valid, gist: { ...gist, disjointPairs: [...gist.disjointPairs, ["Organization", "Place"]] } }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C6", "gist", "Place"]])
    })
  )

  it.effect("C5: a gist class that is its own gist parent", () =>
    Effect.gen(function* () {
      const copy = { ...valid, gist: { ...gist, classes: { ...gist.classes, Content: { parent: "Content" } } } }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C5", "gist", "Content"]])
    })
  )

  it.effect("C5: two gist classes that are each other's gist parent", () =>
    Effect.gen(function* () {
      const classes = { ...gist.classes, Person: { parent: "LivingThing" }, LivingThing: { parent: "Person" } }
      const found = yield* findingsOf({ ...valid, gist: { ...gist, classes } })
      expect(found).toEqual([
        ["C5", "gist", "Person"],
        ["C5", "gist", "LivingThing"]
      ])
    })
  )

  it.effect("C6: a disjoint pair that names one class twice", () =>
    Effect.gen(function* () {
      const copy = { ...valid, gist: { ...gist, disjointPairs: [...gist.disjointPairs, ["Content", "Content"]] } }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C6", "gist", "Content"]])
    })
  )

  it.effect("C6: a disjoint pair repeated in reverse", () =>
    Effect.gen(function* () {
      const copy = { ...valid, gist: { ...gist, disjointPairs: [...gist.disjointPairs, ["Content", "Organization"]] } }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C6", "gist", "Content"]])
    })
  )

  it.effect("C7: an inherited identity with a gist parent", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(withClasses({ Book: { ...book, identity: { kind: "inherited" } } }))
      expect(found).toEqual([["C7", "class", "Book"]])
    })
  )

  it.effect("C8: a domain, a class range and a scheme range the vocabulary lacks", () =>
    Effect.gen(function* () {
      const copy = {
        ...valid,
        objectProperties: {
          ...valid.objectProperties,
          loanOf: { ...loanOf, range: { kind: "class", key: "Periodical" } },
          loanStatus: { ...loanStatus, range: { kind: "scheme", key: "ReturnScheme" } }
        },
        datatypeProperties: { publishedAt: { ...publishedAt, domain: "Periodical" } }
      }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([
        ["C8", "objectProperty", "loanOf"],
        ["C8", "objectProperty", "loanStatus"],
        ["C8", "datatypeProperty", "publishedAt"]
      ])
    })
  )

  it.effect("C10: a scheme with no concept", () =>
    Effect.gen(function* () {
      const copy = { ...valid, schemes: { ...valid.schemes, GenreScheme: { ...genreScheme, concepts: {} } } }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C10", "scheme", "GenreScheme"]])
    })
  )

  it.effect("C10: a concept that is an individual of a class the vocabulary lacks", () =>
    Effect.gen(function* () {
      const copy = {
        ...valid,
        schemes: {
          ...valid.schemes,
          GenreScheme: { ...genreScheme, concepts: { fiction: { ...fiction, alsoInstanceOf: "Category" } } }
        }
      }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C10", "concept", "GenreScheme-fiction"]])
    })
  )

  it.effect("C11: a role class with a gist parent", () =>
    Effect.gen(function* () {
      const copy = withClasses({
        Branch: { ...branch, parent: { kind: "gist", name: "Organization" }, identity: library.identity }
      })
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C11", "class", "Branch"]])
    })
  )

  it.effect("C12: a term naming decision 999, which has no heading", () =>
    Effect.gen(function* () {
      const copy = withClasses({ Book: { ...book, ratification: { decision: 999 } } })
      const found = yield* findingsOf(copy)
      expect(found).toEqual([["C12", "class", "Book"]])
    })
  )

  it.effect("C12: an object property, a datatype property and a scheme naming decision 999", () =>
    Effect.gen(function* () {
      const unanswered = { decision: 999 }
      const copy = {
        ...valid,
        objectProperties: { ...valid.objectProperties, loanOf: { ...loanOf, ratification: unanswered } },
        datatypeProperties: {
          ...valid.datatypeProperties,
          publishedAt: { ...publishedAt, ratification: unanswered }
        },
        schemes: { ...valid.schemes, GenreScheme: { ...genreScheme, ratification: unanswered } }
      }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([
        ["C12", "objectProperty", "loanOf"],
        ["C12", "datatypeProperty", "publishedAt"],
        ["C12", "scheme", "GenreScheme"]
      ])
    })
  )

  it.effect("C12: a concept and an exception entry naming a decision with no heading of its own", () =>
    Effect.gen(function* () {
      const copy = {
        ...valid,
        schemes: {
          ...valid.schemes,
          GenreScheme: { ...genreScheme, concepts: { fiction: { ...fiction, ratification: { decision: 39 } } } }
        }
      }
      const list = [{ ...exceptions[0], ratification: { decision: 43 } }]
      const found = yield* findingsOf(copy, list)
      expect(found).toEqual([
        ["C12", "concept", "GenreScheme-fiction"],
        ["C12", "exception", "Genre"]
      ])
    })
  )

  it.effect("C13: a third number before publication, and a pre-release part", () =>
    Effect.gen(function* () {
      const patched = yield* findingsOf({ ...valid, version: "0.1.1" })
      expect(patched).toEqual([["C13", "vocabulary", "https://example.org/library/ontology/"]])
      const prerelease = yield* findingsOf({ ...valid, version: "0.2.0-rc.1" })
      expect(prerelease).toEqual([["C13", "vocabulary", "https://example.org/library/ontology/"]])
      const published = yield* findingsOf({ ...valid, version: "1.0.3" })
      expect(published).toEqual([])
    })
  )
})

describe("what the decode holds before any rule runs", () => {
  it.effect("refuses a scheme key that does not end in Scheme (C1)", () =>
    Effect.gen(function* () {
      const refusal = yield* Effect.flip(decodeVocabulary({ ...valid, schemes: { Genres: genreScheme } }))
      expect(refusal.message).toContain("Genres")
    })
  )

  it.effect("refuses an empty label (C2)", () =>
    Effect.gen(function* () {
      const refusal = yield* Effect.flip(decodeVocabulary(withClasses({ Book: { ...book, prefLabel: "" } })))
      expect(refusal.message).toContain("prefLabel")
    })
  )

  it.effect("refuses an exception entry that names a CURIE instead of a class key", () =>
    Effect.gen(function* () {
      const refusal = yield* Effect.flip(decodeExceptions([{ ...exceptions[0], class: "ex:Genre" }]))
      expect(refusal.message).toContain("class")
    })
  )
})
