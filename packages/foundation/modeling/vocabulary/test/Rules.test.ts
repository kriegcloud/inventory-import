// Gate 4's rules on a small vocabulary of an example library, not this repository's: the valid one gives no finding,
// and each copy changed to break one rule gives that rule's findings and no other. The decision log is text handed
// in, so C12's planted number 999 changes no committed file. The party slice's constructs (a category, a retirement,
// a gist property, an identity criterion's basis) are planted on copies too, each beside a near miss that passes; the
// gist properties C9 compares with are written on planted gist lists only, never read from gist's file, one of them as
// decision 153 read gist 14.1.0: no domain and no range.
import { describe, expect, it } from "@effect/vitest"
import { IdentityCriterion, Vocabulary } from "@beep/vocabulary/Model"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as HashSet from "effect/HashSet"
import * as Num from "effect/Number"
import * as O from "effect/Option"
import * as R from "effect/Record"
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

/** The rule and key of each finding the gate reports for a copy of the vocabulary and an exception list. */
const findingsWith = Effect.fn("findingsWith")(function* (vocabulary: unknown, list: unknown) {
  const decoded = yield* decodeVocabulary(vocabulary)
  const entries = yield* decodeExceptions(list)
  return A.map(
    coherenceFindings({ vocabulary: decoded, exceptions: entries, decisions: decisionHeadings(log) }),
    (finding) => [finding.rule, finding.kind, finding.key]
  )
})

/** The same, with the library's own exception list. */
const findingsOf = (vocabulary: unknown) => findingsWith(vocabulary, exceptions)

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
      const found = yield* findingsWith(valid, list)
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
      const found = yield* findingsWith(copy, list)
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

// ---------------------------------------------------------------------------------------------------------------
// Categories (decision 12): C3's walk, C7's absent criterion and C14
// ---------------------------------------------------------------------------------------------------------------

const lenderReason = "A category over libraries and members who lend; it supplies no identity of its own."

/** A category over the kinds that lend, with no identity criterion and no gist parent. */
const lender = {
  prefLabel: "Lender",
  definition: "Anything that lends books, whether a library or one of its members.",
  tag: "category",
  parent: { kind: "none", reason: lenderReason },
  ratification: accepted
} as const

const withLender = {
  ...valid,
  classes: { ...valid.classes, Lender: lender, Library: { ...library, categoryParents: ["Lender"] } }
} as const satisfies typeof Vocabulary.Encoded

/** A phase of a book, which inherits the book's criterion (V17). */
const onLoan = {
  prefLabel: "On loan",
  definition: "A book in the stage of being out with a member.",
  tag: "phase",
  parent: { kind: "local", key: "Book" },
  identity: { kind: "inherited" },
  ratification: accepted
} as const

/** An event, which states its own criterion. */
const bookReturn = {
  prefLabel: "Return",
  definition: "The handing back of a lent book at a branch's desk.",
  tag: "event",
  parent: { kind: "gist", name: "TemporalRelation" },
  identity: { kind: "stated", criterion: "The loan it ends, each loan being returned once." },
  ratification: accepted
} as const

/** A value, which states its own criterion. */
const fee = {
  prefLabel: "Fee",
  definition: "An amount a member owes for a book kept past its due date.",
  tag: "value",
  parent: { kind: "gist", name: "Content" },
  identity: { kind: "stated", criterion: "The amount and its currency, equal amounts being one value." },
  ratification: accepted
} as const

const lenderExceptions = [...exceptions, { class: "Lender", reason: lenderReason, ratification: { decision: 2 } }]

/** The findings of a copy of the library with the category, its exception entry beside the library's own. */
const findingsWithLender = (classes: object) =>
  findingsWith({ ...withLender, classes: { ...withLender.classes, ...classes } }, lenderExceptions)

describe("a category and its category parents", () => {
  it.effect("near miss: a category with no criterion, under which a class with its own gist parent falls, passes", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithLender({})
      expect(found).toEqual([])
    })
  )

  it.effect("near miss: a subkind that inherits its local parent's criterion passes", () =>
    Effect.gen(function* () {
      const paperback = {
        ...book,
        prefLabel: "Paperback",
        tag: "subkind",
        parent: { kind: "local", key: "Book" },
        identity: { kind: "inherited" }
      }
      const found = yield* findingsOf(withClasses({ Paperback: paperback }))
      expect(found).toEqual([])
    })
  )

  it.effect("C3: a category parent that is not a class of the vocabulary", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithLender({ Library: { ...library, categoryParents: ["Borrower"] } })
      expect(found).toEqual([["C3", "class", "Library"]])
    })
  )

  it.effect("C3: a category that is its own category parent, a cycle only the category link closes", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithLender({ Lender: { ...lender, categoryParents: ["Lender"] } })
      expect(found).toEqual([["C3", "class", "Lender"]])
    })
  )

  it.effect("C7: a category that states an identity criterion", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithLender({ Lender: { ...lender, identity: library.identity } })
      expect(found).toEqual([["C7", "class", "Lender"]])
    })
  )

  it.effect("C7: a kind with no identity criterion", () =>
    Effect.gen(function* () {
      const noCriterion = {
        prefLabel: book.prefLabel,
        definition: book.definition,
        tag: book.tag,
        parent: book.parent,
        ratification: accepted
      }
      const found = yield* findingsOf(withClasses({ Book: noCriterion }))
      expect(found).toEqual([["C7", "class", "Book"]])
    })
  )

  it.effect("C7: a subkind that inherits its criterion but has a gist parent, not a local one", () =>
    Effect.gen(function* () {
      const paperback = { ...book, prefLabel: "Paperback", tag: "subkind", identity: { kind: "inherited" } }
      const found = yield* findingsOf(withClasses({ Paperback: paperback }))
      expect(found).toEqual([["C7", "class", "Paperback"]])
    })
  )

  it.effect("C7: a role under a local parent that states its own criterion instead of inheriting it", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(withClasses({ Branch: { ...branch, identity: library.identity } }))
      expect(found).toEqual([["C7", "class", "Branch"]])
    })
  )

  it.effect("near miss: a phase that inherits from its local parent, and an event and a value that state theirs", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(withClasses({ OnLoan: onLoan, Return: bookReturn, Fee: fee }))
      expect(found).toEqual([])
    })
  )

  it.effect("C7: a phase that states its criterion, and an event and a value that inherit theirs", () =>
    Effect.gen(function* () {
      const local = { kind: "local", key: "Loan" } as const
      const found = yield* findingsOf(
        withClasses({
          OnLoan: { ...onLoan, identity: library.identity },
          Return: { ...bookReturn, parent: local, identity: { kind: "inherited" } },
          Fee: { ...fee, parent: local, identity: { kind: "inherited" } }
        })
      )
      expect(found).toEqual([
        ["C7", "class", "OnLoan"],
        ["C7", "class", "Return"],
        ["C7", "class", "Fee"]
      ])
    })
  )

  it.effect("C14: a category parent that is not tagged category", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithLender({ Library: { ...library, categoryParents: ["Book"] } })
      expect(found).toEqual([["C14", "class", "Library"]])
    })
  )

  it.effect("C14: a category parent named twice", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithLender({ Library: { ...library, categoryParents: ["Lender", "Lender"] } })
      expect(found).toEqual([["C14", "class", "Library"]])
    })
  )

  it.effect("C14: a category as a class's one identity-bearing parent", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithLender({ Branch: { ...branch, parent: { kind: "local", key: "Lender" } } })
      expect(found).toEqual([["C14", "class", "Branch"]])
    })
  )
})

// ---------------------------------------------------------------------------------------------------------------
// Retirement (decision 33, report 05's V14): C15
// ---------------------------------------------------------------------------------------------------------------

const replaced = (by: string, since: string) => ({ kind: "replaced", replacedBy: by, since }) as const
const withdrawn = { kind: "withdrawn", reason: "No longer kept in any branch's catalogue.", since: "0.1.0" } as const

/** A copy of the library whose loan status scheme holds the given concepts beside its own. */
const withStatuses = (concepts: object): unknown => ({
  ...valid,
  schemes: {
    ...valid.schemes,
    LoanStatusScheme: { ...loanStatusScheme, concepts: { ...loanStatusScheme.concepts, ...concepts } }
  }
})

describe("a retired term", () => {
  it.effect(
    "near miss: an earlier replacement stands when its successor retires in turn, and a withdrawn successor",
    () =>
      Effect.gen(function* () {
        const found = yield* findingsOf(
          withStatuses({
            lent: { ...concept("lent"), deprecation: replaced("out", "0.1.0") },
            out: { ...concept("out"), deprecation: replaced("on-loan", "0.1.0") },
            kept: { ...concept("kept"), deprecation: replaced("lost", "0.1.0") },
            lost: { ...concept("lost"), deprecation: withdrawn }
          })
        )
        expect(found).toEqual([])
      })
  )

  it.effect("near miss: a retired class whose parent is retired too; only a live range naming it is found", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(
        withClasses({
          Library: { ...library, deprecation: withdrawn },
          Branch: { ...branch, deprecation: replaced("Book", "0.1.0") }
        })
      )
      expect(found).toEqual([["C15", "objectProperty", "heldAt"]])
    })
  )

  it.effect("near miss: retired properties whose domain or range is a retired class", () =>
    Effect.gen(function* () {
      const copy = {
        ...valid,
        classes: { ...valid.classes, Book: { ...book, deprecation: withdrawn } },
        objectProperties: { ...valid.objectProperties, loanOf: { ...loanOf, deprecation: withdrawn } },
        datatypeProperties: { publishedAt: { ...publishedAt, deprecation: withdrawn } }
      }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([])
    })
  )

  it.effect("C15: a successor that is not a term of the same table", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(
        withStatuses({ lent: { ...concept("lent"), deprecation: replaced("missing", "0.1.0") } })
      )
      expect(found).toEqual([["C15", "concept", "LoanStatusScheme-lent"]])
      const crossed = yield* findingsOf(withClasses({ Genre: { ...genre, deprecation: replaced("loanOf", "0.1.0") } }))
      expect(crossed).toEqual([["C15", "class", "Genre"]])
    })
  )

  it.effect("C15: two concepts that replace each other", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(
        withStatuses({
          lent: { ...concept("lent"), deprecation: replaced("out", "0.1.0") },
          out: { ...concept("out"), deprecation: replaced("lent", "0.1.0") }
        })
      )
      expect(found).toEqual([
        ["C15", "concept", "LoanStatusScheme-lent"],
        ["C15", "concept", "LoanStatusScheme-out"]
      ])
    })
  )

  it.effect("C15: a retirement dated after the vocabulary's version", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(
        withStatuses({ lent: { ...concept("lent"), deprecation: replaced("on-loan", "0.2.0") } })
      )
      expect(found).toEqual([["C15", "concept", "LoanStatusScheme-lent"]])
    })
  )

  it.effect("C15: live properties whose domain or range is a retired class or scheme", () =>
    Effect.gen(function* () {
      const copy = {
        ...valid,
        classes: { ...valid.classes, Book: { ...book, deprecation: withdrawn } },
        schemes: { ...valid.schemes, LoanStatusScheme: { ...loanStatusScheme, deprecation: withdrawn } }
      }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([
        ["C15", "objectProperty", "loanOf"],
        ["C15", "objectProperty", "loanStatus"],
        ["C15", "datatypeProperty", "publishedAt"]
      ])
    })
  )

  it.effect("C15: live object properties whose domain is a retired class", () =>
    Effect.gen(function* () {
      // Loan is the domain of loanOf and loanStatus and the range of nothing, so only the domain link is found.
      const found = yield* findingsOf(withClasses({ Loan: { ...loan, deprecation: withdrawn } }))
      expect(found).toEqual([
        ["C15", "objectProperty", "loanOf"],
        ["C15", "objectProperty", "loanStatus"]
      ])
    })
  )

  it.effect("C15: a live class whose parent or category parent is retired", () =>
    Effect.gen(function* () {
      const parent = yield* findingsOf(withClasses({ Library: { ...library, deprecation: withdrawn } }))
      expect(parent).toEqual([["C15", "class", "Branch"]])
      const category = yield* findingsWithLender({ Lender: { ...lender, deprecation: withdrawn } })
      expect(category).toEqual([["C15", "class", "Library"]])
    })
  )
})

// ---------------------------------------------------------------------------------------------------------------
// A property under a gist property (decision 16): C9, on planted gist lists
// ---------------------------------------------------------------------------------------------------------------

/** A planted gist list: two gist classes over the library's, and gist properties with the domains and ranges C9 reads. */
const gistWithProperties = {
  ...gist,
  classes: { ...gist.classes, TemporalRelation: { parent: "Thing" }, Thing: {} },
  properties: {
    isCategorizedBy: { kind: "object" },
    categorizedAs: { kind: "object", range: "Content" },
    occursIn: { kind: "object", domain: "Thing", range: "Content" },
    servedBy: { kind: "object", domain: "Organization" },
    startDateTime: { kind: "datatype", range: "xsd:dateTime" },
    registeredAt: { kind: "datatype", domain: "Organization", range: "xsd:dateTime" },
    description: { kind: "datatype" },
    name: { kind: "datatype", range: "xsd:string" }
  }
} as const

/** A datatype property of a branch, whose domain reaches gist's `Organization` through its local parent. */
const openedAt = {
  prefLabel: "opened at",
  definition: "The instant at which a branch first lent a book.",
  domain: "Branch",
  datatype: "xsd:dateTime",
  ratification: accepted
} as const

/** A datatype property of a book, written as text. */
const blurb = {
  prefLabel: "blurb",
  definition: "The short text that tells a reader what a book is about.",
  domain: "Book",
  datatype: "xsd:string",
  ratification: accepted
} as const

/** A category over what a library lends, with a gist parent a book reaches through it alone. */
const lendable = {
  prefLabel: "Lendable",
  definition: "Anything a library lends, whatever kind of thing it is.",
  tag: "category",
  parent: { kind: "gist", name: "Thing" },
  ratification: accepted
} as const

/** A copy of the library on the planted gist list, one object property and one datatype property changed. */
const onGistList = (objectProperties: object, datatypeProperties: object): unknown => ({
  ...valid,
  gist: gistWithProperties,
  objectProperties: { ...valid.objectProperties, ...objectProperties },
  datatypeProperties: { ...valid.datatypeProperties, ...datatypeProperties }
})

const gistParent = (name: string) => ({ subPropertyOf: { kind: "gist", name } }) as const

describe("a property under a gist property", () => {
  it.effect(
    "near miss: domains and ranges that fall under the gist property's, through gist ancestors and local parents",
    () =>
      Effect.gen(function* () {
        const found = yield* findingsOf(
          onGistList(
            {
              loanOf: { ...loanOf, ...gistParent("occursIn") },
              loanStatus: { ...loanStatus, ...gistParent("isCategorizedBy") },
              heldAt: {
                ...heldAt,
                domain: "Branch",
                range: { kind: "class", key: "Branch" },
                ...gistParent("servedBy")
              }
            },
            {
              publishedAt: { ...publishedAt, ...gistParent("startDateTime") },
              openedAt: { ...openedAt, ...gistParent("registeredAt") },
              blurb: { ...blurb, ...gistParent("description") }
            }
          )
        )
        expect(found).toEqual([])
      })
  )

  it.effect("near miss: a domain that falls under the gist property's only through a category parent", () =>
    Effect.gen(function* () {
      const copy = {
        ...valid,
        gist: gistWithProperties,
        classes: { ...valid.classes, Lendable: lendable, Book: { ...book, categoryParents: ["Lendable"] } },
        objectProperties: {
          ...valid.objectProperties,
          loanOf: { ...loanOf, domain: "Book", ...gistParent("occursIn") }
        }
      }
      const found = yield* findingsOf(copy)
      expect(found).toEqual([])
    })
  )

  it.effect("C9: a datatype property whose domain does not fall under its gist attribute's", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(
        onGistList({}, { publishedAt: { ...publishedAt, ...gistParent("registeredAt") } })
      )
      expect(found).toEqual([["C9", "datatypeProperty", "publishedAt"]])
    })
  )

  it.effect("C9: a gist property whose domain or class range is not on the gist list", () =>
    Effect.gen(function* () {
      const properties = {
        ...gistWithProperties.properties,
        // One fault each, so a finding is told by its term: the domain alone, the class range alone, the domain of
        // a datatype property.
        heldBy: { kind: "object", domain: "Agent", range: "Content" },
        heldIn: { kind: "object", domain: "Thing", range: "Place" },
        issuedAt: { kind: "datatype", domain: "Event", range: "xsd:dateTime" }
      }
      const found = yield* findingsOf({ ...valid, gist: { ...gistWithProperties, properties } })
      expect(found).toEqual([
        ["C9", "gist", "heldBy"],
        ["C9", "gist", "heldIn"],
        ["C9", "gist", "issuedAt"]
      ])
    })
  )

  it.effect("C9: a gist parent that is not on the gist list", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(
        onGistList(
          { loanOf: { ...loanOf, ...gistParent("hasPart") } },
          { publishedAt: { ...publishedAt, ...gistParent("startedAt") } }
        )
      )
      expect(found).toEqual([
        ["C9", "objectProperty", "loanOf"],
        ["C9", "datatypeProperty", "publishedAt"]
      ])
    })
  )

  it.effect("C9: a relation under a gist attribute, and an attribute under a gist relation", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(
        onGistList(
          { loanOf: { ...loanOf, ...gistParent("name") } },
          { publishedAt: { ...publishedAt, ...gistParent("occursIn") } }
        )
      )
      expect(found).toEqual([
        ["C9", "objectProperty", "loanOf"],
        ["C9", "datatypeProperty", "publishedAt"]
      ])
    })
  )

  it.effect("C9: a domain that does not fall under the gist property's, and one left undeclared", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(
        onGistList(
          {
            loanOf: { ...loanOf, domain: "Book", ...gistParent("occursIn") },
            heldAt: { ...heldAt, ...gistParent("servedBy") }
          },
          {}
        )
      )
      expect(found).toEqual([
        ["C9", "objectProperty", "loanOf"],
        ["C9", "objectProperty", "heldAt"]
      ])
    })
  )

  it.effect(
    "C9: a class range outside the gist range, and a scheme range under a gist property with a class range",
    () =>
      Effect.gen(function* () {
        const found = yield* findingsOf(
          onGistList(
            {
              loanOf: { ...loanOf, range: { kind: "class", key: "Library" }, ...gistParent("occursIn") },
              loanStatus: { ...loanStatus, ...gistParent("categorizedAs") }
            },
            {}
          )
        )
        expect(found).toEqual([
          ["C9", "objectProperty", "loanOf"],
          ["C9", "objectProperty", "loanStatus"]
        ])
      })
  )

  it.effect("C9: a datatype that is not the gist property's", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf(onGistList({}, { publishedAt: { ...publishedAt, ...gistParent("name") } }))
      expect(found).toEqual([["C9", "datatypeProperty", "publishedAt"]])
    })
  )
})

describe("what the decode holds for the party slice's constructs", () => {
  it.effect("decodes each of decision 18's nine tags and refuses a tenth", () =>
    Effect.gen(function* () {
      for (const tag of ["kind", "subkind", "role", "phase", "relator", "event", "information", "category", "value"]) {
        const decoded = yield* Effect.exit(decodeVocabulary(withClasses({ Book: { ...book, tag } })))
        expect(Exit.isSuccess(decoded)).toBe(true)
      }
      const refusal = yield* Effect.flip(decodeVocabulary(withClasses({ Book: { ...book, tag: "mixin" } })))
      expect(refusal.message).toContain("tag")
    })
  )

  it.effect("refuses a withdrawn term with no reason", () =>
    Effect.gen(function* () {
      const noReason = { kind: "withdrawn", since: withdrawn.since }
      const refusal = yield* Effect.flip(decodeVocabulary(withClasses({ Genre: { ...genre, deprecation: noReason } })))
      expect(refusal.message).toContain("reason")
    })
  )
})

// ---------------------------------------------------------------------------------------------------------------
// What an identity criterion rests on (decision 146, report 05's V18): C16
// ---------------------------------------------------------------------------------------------------------------

/** The name a library is known by: a label, not what tells one library from another. */
const libraryName = {
  prefLabel: "library name",
  definition: "The name a library is known by on its signs and its cards.",
  domain: "Library",
  datatype: "xsd:string",
  designation: "name",
  ratification: accepted
} as const

/** The address a library answers mail at, which it may change. */
const libraryEmail = {
  prefLabel: "library email",
  definition: "The email address at which a library answers its members.",
  domain: "Library",
  datatype: "xsd:string",
  designation: "email",
  ratification: accepted
} as const

/** The number a library is registered under, which tells one library from another. */
const registrationNumber = {
  prefLabel: "registration number",
  definition: "The number under which a library is registered with its authority.",
  domain: "Library",
  datatype: "xsd:string",
  ratification: accepted
} as const

const withBases = {
  ...valid,
  datatypeProperties: { ...valid.datatypeProperties, libraryName, libraryEmail, registrationNumber }
} as const satisfies typeof Vocabulary.Encoded

/** A stated criterion with the sentence of `term`'s and the basis given. */
const restingOn = (term: typeof library | typeof book | typeof loan, restsOn: ReadonlyArray<string>) => ({
  ...term,
  identity: { ...term.identity, restsOn }
})

const findingsWithBases = (classes: object) =>
  findingsOf({ ...withBases, classes: { ...withBases.classes, ...classes } })

describe("what an identity criterion rests on", () => {
  it.effect("near miss: a criterion on a registration number, one on a relation, and a name nothing rests on", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithBases({
        Library: restingOn(library, ["registrationNumber"]),
        Loan: restingOn(loan, ["loanOf"])
      })
      expect(found).toEqual([])
    })
  )

  it.effect("C16: a library told apart by its name, as report 04's CQ-I08 plants it", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithBases({ Library: restingOn(library, ["registrationNumber", "libraryName"]) })
      expect(found).toEqual([["C16", "class", "Library"]])
    })
  )

  it.effect("C16: a library told apart by its email address", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithBases({ Library: restingOn(library, ["libraryEmail"]) })
      expect(found).toEqual([["C16", "class", "Library"]])
    })
  )

  it.effect("C16: a book told apart by a key that is no property of the vocabulary", () =>
    Effect.gen(function* () {
      const found = yield* findingsWithBases({ Book: restingOn(book, ["isbn"]) })
      expect(found).toEqual([["C16", "class", "Book"]])
    })
  )

  it.effect("the decode: a criterion states no basis unless it says one, and an inherited one cannot say one", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(valid)
      const basis = O.flatMap(
        O.flatMap(R.get(decoded.classes, "Library"), (term) => term.identity),
        (identity) => (IdentityCriterion.guards.stated(identity) ? O.some(identity.restsOn) : O.none())
      )
      expect(basis).toEqual(O.some([]))
      const inherited = { ...branch, identity: { kind: "inherited", restsOn: ["registrationNumber"] } }
      const refusal = yield* Effect.flip(
        decodeVocabulary({ ...withBases, classes: { ...withBases.classes, Branch: inherited } })
      )
      expect(refusal.message).toContain("restsOn")
    })
  )
})

// ---------------------------------------------------------------------------------------------------------------
// The gist properties as gist 14.1.0 declares them (decisions 132 and 153): no domain and no range, so no limit
// ---------------------------------------------------------------------------------------------------------------

/** A planted list with the two gist properties decision 153 read: neither declares a domain or a range. */
const gistAsPinned = {
  ...gist,
  properties: { isCategorizedBy: { kind: "object" }, name: { kind: "datatype" } }
} as const

/** A name with no domain of its own, which a gist property with no domain must also take. */
const knownAs = {
  prefLabel: "known as",
  definition: "The name anything a library keeps is known by, whatever it is.",
  datatype: "xsd:string",
  designation: "name",
  ratification: accepted
} as const

describe("a property under a gist property that declares no domain and no range", () => {
  it.effect(
    "near miss: names under gist's name, and a scheme range and a class range under isCategorizedBy, pass C9",
    () =>
      Effect.gen(function* () {
        const found = yield* findingsOf({
          ...withBases,
          gist: gistAsPinned,
          objectProperties: {
            ...valid.objectProperties,
            loanStatus: { ...loanStatus, ...gistParent("isCategorizedBy") },
            heldAt: { ...heldAt, ...gistParent("isCategorizedBy") }
          },
          datatypeProperties: {
            ...withBases.datatypeProperties,
            libraryName: { ...libraryName, ...gistParent("name") },
            knownAs: { ...knownAs, ...gistParent("name") }
          }
        })
        expect(found).toEqual([])
      })
  )

  it.effect("C9: the same names under a gist name that declares a domain and a datatype they miss", () =>
    Effect.gen(function* () {
      const found = yield* findingsOf({
        ...withBases,
        gist: { ...gistAsPinned, properties: { name: { kind: "datatype", domain: "Content", range: "xsd:dateTime" } } },
        datatypeProperties: {
          ...withBases.datatypeProperties,
          libraryName: { ...libraryName, ...gistParent("name") },
          knownAs: { ...knownAs, ...gistParent("name") }
        }
      })
      expect(found).toEqual([
        ["C9", "datatypeProperty", "libraryName"],
        ["C9", "datatypeProperty", "libraryName"],
        ["C9", "datatypeProperty", "knownAs"],
        ["C9", "datatypeProperty", "knownAs"]
      ])
    })
  )
})
