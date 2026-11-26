// A mark placed in each position of report 14 section 3.1 is read back as written, a position with no mark reads as
// none, and a name outside the registry a maker was bound to is a type error. The vocabulary is an example library's,
// not this repository's: the package names no term of any one vocabulary.
import { describe, expect, it } from "@effect/vitest"
import { assertDefined } from "@effect/vitest/utils"
import type { Curie, VocabShape } from "@beep/identity/Vocab"
import * as Arbitrary from "effect/Arbitrary"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Model from "effect/schema/Model"
import { $VocabularyId } from "../src/internal/identity.ts"
import {
  FieldMark,
  LiftPathRead,
  MarkReading,
  NoTermRead,
  NoTermReason,
  noTermFor,
  NoTermReading,
  pathFor,
  pointerFor,
  readKeyMark,
  readMarks,
  readSchemaMark,
  SchemaMarks,
  TermReading,
  Unmarked
} from "../src/Pointer.mark.ts"

const $I = $VocabularyId.create("PointerTest")
const iri = "https://example.org/library/ontology/"

const LibraryClasses = { lib: { iri, terms: ["Book", "Loan"] } } as const satisfies VocabShape
const LibraryProperties = {
  lib: { iri, terms: ["title", "loanOf", "loanStatus", "loanScope"] }
} as const satisfies VocabShape
const LibrarySchemes = { lib: { iri, terms: ["LoanStatusScheme", "LoanScopeScheme"] } } as const satisfies VocabShape
type LibraryConcept = "lib:LoanScopeScheme-branch" | "lib:LoanStatusScheme-open"

const aboutClass = pointerFor<typeof LibraryClasses>()
const aboutProperty = pointerFor<typeof LibraryProperties>()
const aboutScheme = pointerFor<typeof LibrarySchemes>()
const aboutPath = pathFor<Curie<typeof LibraryClasses>, Curie<typeof LibraryProperties>, LibraryConcept>()
const noTerm = noTermFor<"party">()

const term = (name: string) => TermReading.make({ term: name })
const none = Unmarked.make({})

// A branded id, a union of literals pointing at a scheme, and a struct with a mark in every field position.
const BookId = S.String.check(S.isPattern(/^[a-z0-9-]{1,40}$/)).pipe(S.brand("BookId"))

const LoanStatus = S.Literals(["open", "closed"]).pipe(
  $I.annoteSchema("LoanStatus", { description: "Whether a loan is open", ...aboutScheme("lib:LoanStatusScheme") })
)

const loanPath = aboutPath([
  {
    property: "lib:loanOf",
    reverse: true,
    node: "lib:Loan",
    fixed: [{ property: "lib:loanScope", concept: "lib:LoanScopeScheme-branch" }]
  },
  { property: "lib:loanStatus" }
])

const Book = S.Struct({
  id: BookId.pipe(S.annotateKey({ description: "The book's id", ...aboutClass("lib:Book") })),
  title: S.String.pipe(S.annotateKey({ description: "The title on the cover", ...aboutProperty("lib:title") })),
  status: LoanStatus.pipe(S.annotateKey({ description: "Whether the book is out", ...loanPath })),
  note: S.optionalKey(S.String).pipe(S.annotateKey({ description: "A remark for the screen", ...noTerm("screen") })),
  shelf: S.optionalKey(S.String).pipe(
    S.annotateKey({ description: "Where it stands", ...noTerm("deferred", "party") })
  ),
  isbn: S.String
}).pipe($I.annoteSchema("Book", { description: "A book the library holds", ...aboutClass("lib:Book") }))

const fieldsOf = (marks: SchemaMarks): Record<string, MarkReading> =>
  R.fromEntries(
    O.match(marks.fields, {
      onNone: (): ReadonlyArray<readonly [string, MarkReading]> => [],
      onSome: A.map((field: FieldMark) => [field.name, field.mark] as const)
    })
  )

describe("the makers", () => {
  it("write one annotation key each", () => {
    expect(aboutClass("lib:Book")).toEqual({ term: "lib:Book" })
    expect(noTerm("screen")).toEqual({ noTerm: { reason: "screen" } })
    expect(noTerm("deferred", "party")).toEqual({ noTerm: { reason: "deferred", slice: "party" } })
    expect(R.keys(loanPath)).toEqual(["path"])
  })

  it("refuse, at compile time, a name outside the registry they were bound to", () => {
    // @ts-expect-error a property is not a class
    const propertyAsClass = aboutClass("lib:title")
    // @ts-expect-error a term the registry does not hold
    const unknownClass = aboutClass("lib:Periodical")
    // @ts-expect-error a class is not a scheme
    const classAsScheme = aboutScheme("lib:Book")
    // @ts-expect-error a closed reason takes no slice
    const closedWithSlice = noTerm("screen", "party")
    // @ts-expect-error deferred names its slice
    const deferredAlone = noTerm("deferred")
    // @ts-expect-error a slice the caller did not name
    const otherSlice = noTerm("deferred", "catalogue")
    // @ts-expect-error a reason outside the closed list
    const openReason = noTerm("convenience")
    expect([
      propertyAsClass,
      unknownClass,
      classAsScheme,
      closedWithSlice,
      deferredAlone,
      otherSlice,
      openReason
    ]).toHaveLength(7)
  })

  it("refuse, at compile time, a path that does not end in one value step or names an unknown term", () => {
    // @ts-expect-error a node step cannot end a path
    const endsInNode = aboutPath([{ property: "lib:loanOf", node: "lib:Loan" }])
    // @ts-expect-error a path needs its value step
    const empty = aboutPath([])
    // @ts-expect-error a node step names a class
    const nodeIsProperty = aboutPath([{ property: "lib:loanOf", node: "lib:title" }, { property: "lib:loanStatus" }])
    // @ts-expect-error a fixed concept the caller's concepts lack
    const wrongConcept = aboutPath([
      { property: "lib:loanOf", node: "lib:Loan", fixed: [{ property: "lib:loanScope", concept: "lib:Nowhere" }] },
      { property: "lib:loanStatus" }
    ])
    expect([endsInNode, empty, nodeIsProperty, wrongConcept]).toHaveLength(4)
  })
})

describe("reading a struct", () => {
  const marks = readMarks(Book.ast)
  const fields = fieldsOf(marks)

  it("reads the record's class pointer from its schema annotations, written through annoteSchema's extras", () => {
    expect(marks.mark).toEqual(term("lib:Book"))
    const annotations = S.resolveAnnotations(Book)
    assertDefined(annotations)
    expect(annotations["description"]).toBe("A book the library holds")
  })

  it("reads the subject's id on a branded field", () => {
    expect(R.get(fields, "id")).toEqual(O.some(term("lib:Book")))
  })

  it("reads a property pointer", () => {
    expect(R.get(fields, "title")).toEqual(O.some(term("lib:title")))
  })

  it("reads a path, with the reverse step and its fixed concept", () => {
    expect(R.get(fields, "status")).toEqual(
      O.some({
        kind: "path",
        path: [
          {
            property: "lib:loanOf",
            reverse: O.some(true),
            node: "lib:Loan",
            fixed: [{ property: "lib:loanScope", concept: "lib:LoanScopeScheme-branch" }]
          },
          { property: "lib:loanStatus" }
        ]
      })
    )
  })

  it("keeps the scheme pointer and the field's path in their two stores", () => {
    expect(readSchemaMark(Book.fields.status.ast)).toEqual(term("lib:LoanStatusScheme"))
    expect(readKeyMark(Book.fields.status.ast).kind).toBe("path")
  })

  it("reads a closed noTerm and a deferred one on optional fields", () => {
    expect(R.get(fields, "note")).toEqual(O.some(NoTermReading.make({ noTerm: { reason: "screen" } })))
    expect(R.get(fields, "shelf")).toEqual(
      O.some(NoTermReading.make({ noTerm: { reason: "deferred", slice: "party" } }))
    )
  })

  it("reads a field with no mark as none", () => {
    expect(R.get(fields, "isbn")).toEqual(O.some(none))
  })

  it("lists every field in declaration order", () => {
    expect(R.keys(fields)).toEqual(["id", "title", "status", "note", "shelf", "isbn"])
  })
})

describe("reading a schema that is not a record", () => {
  it("reads a scheme pointer on a union of literals, which has no fields", () => {
    const marks = readMarks(LoanStatus.ast)
    expect(marks.mark).toEqual(term("lib:LoanStatusScheme"))
    expect(marks.fields).toEqual(O.none())
  })

  it("reads a noTerm on a schema that stands for no term", () => {
    const RequestKey = S.String.check(S.isMaxLength(64)).pipe(
      S.annotate({ description: "A retry key", ...noTerm("request") })
    )
    expect(readSchemaMark(RequestKey.ast)).toEqual(NoTermReading.make({ noTerm: { reason: "request" } }))
  })

  it("reads an unmarked schema as none", () => {
    expect(readMarks(S.String.ast)).toEqual(SchemaMarks.make({ mark: none, fields: O.none() }))
  })
})

describe("reading classes", () => {
  class Loan extends S.Class<Loan, { readonly brand: unique symbol }>("Loan")(
    {
      id: BookId.pipe(S.annotateKey({ description: "The loan's id", ...aboutClass("lib:Loan") })),
      book: Book,
      status: LoanStatus.pipe(S.annotateKey({ description: "Open or closed", ...aboutProperty("lib:loanStatus") }))
    },
    { description: "One loan of one book", ...aboutClass("lib:Loan") }
  ) {}

  it("reads an S.Class's pointer from its second argument and its fields from the struct inside", () => {
    const marks = readMarks(Loan.ast)
    expect(marks.mark).toEqual(term("lib:Loan"))
    const fields = fieldsOf(marks)
    expect(R.get(fields, "id")).toEqual(O.some(term("lib:Loan")))
    expect(R.get(fields, "status")).toEqual(O.some(term("lib:loanStatus")))
  })

  it("reads a field whose schema is a marked record as none: the record's pointer is not the field's mark", () => {
    expect(R.get(fieldsOf(readMarks(Loan.ast)), "book")).toEqual(O.some(none))
  })

  it("reads an opaque class over an annotated struct, a field marked last after its OptionFromNullOr included", () => {
    class Reader extends S.Opaque<Reader, { readonly brand: unique symbol }>()(
      S.Struct({
        id: BookId.pipe(S.annotateKey({ description: "The reader's id", ...aboutClass("lib:Loan") })),
        title: S.OptionFromNullOr(S.String).pipe(
          S.annotateKey({ description: "The title last borrowed; null for none", ...aboutProperty("lib:title") })
        ),
        card: S.String
      }).pipe($I.annoteSchema("Reader", { description: "A reader of the library", ...aboutClass("lib:Loan") }))
    ) {}
    const marks = readMarks(Reader.ast)
    expect(marks.mark).toEqual(term("lib:Loan"))
    expect(fieldsOf(marks)).toEqual({ id: term("lib:Loan"), title: term("lib:title"), card: none })
  })

  it("reads no fields on a declaration over a struct that is not a class: S.Option(Book) is not a book", () => {
    expect(readMarks(S.Option(Book).ast).fields).toEqual(O.none())
  })

  it("loses a mark that a wrapper is built around: S.optional over a marked schema reads as none", () => {
    const Wrapped = S.Struct({
      title: S.optional(S.String.pipe(S.annotateKey({ description: "The title", ...aboutProperty("lib:title") })))
    })
    expect(fieldsOf(readMarks(Wrapped.ast))).toEqual({ title: none })
  })
})

describe("reading a Model.Class", () => {
  const LoanId = S.String.pipe(S.brand("LoanId"))
  const subject = aboutClass("lib:Loan")
  const deferred = { description: "Who lent it, when that is not the reader", ...noTerm("deferred", "party") }
  const at = aboutProperty("lib:title")

  class LoanRow extends Model.Class<LoanRow>("LoanRow")(
    {
      id: Model.fieldEvolve(Model.UuidV4Insert(LoanId), {
        select: (s) => s.annotateKey(subject),
        insert: (s) => s.annotateKey(subject),
        update: (s) => s.annotateKey(subject),
        json: (s) => s.annotateKey(subject)
      }),
      status: LoanStatus.pipe(S.annotateKey({ description: "Open or closed", ...aboutProperty("lib:loanStatus") })),
      lender: Model.fieldEvolve(Model.FieldOption(S.String), {
        select: (s) => s.annotateKey(deferred),
        insert: (s) => s.annotateKey(deferred),
        update: (s) => s.annotateKey(deferred),
        json: (s) => s.annotateKey(deferred),
        jsonCreate: (s) => s.annotateKey(deferred),
        jsonUpdate: (s) => s.annotateKey(deferred)
      }),
      hidden: Model.FieldOption(S.String.pipe(S.annotateKey({ ...noTerm("screen") }))),
      createdAt: Model.fieldEvolve(Model.DateTimeInsert, {
        select: (s) => s.annotateKey(at),
        insert: (s) => s.annotateKey(at),
        json: (s) => s.annotateKey(at)
      })
    },
    { description: "One stored loan", ...aboutClass("lib:Loan") }
  ) {}

  const expected: Record<string, MarkReading> = {
    id: term("lib:Loan"),
    status: term("lib:loanStatus"),
    lender: NoTermReading.make({ noTerm: { reason: "deferred", slice: "party" } }),
    hidden: none,
    createdAt: term("lib:title")
  }

  it("reads the pointer from the second argument and each field's mark, fieldEvolve's included", () => {
    const marks = readMarks(LoanRow.ast)
    expect(marks.mark).toEqual(term("lib:Loan"))
    expect(fieldsOf(marks)).toEqual(expected)
  })

  it("finds no mark written inside FieldOption's argument: it is on the encoded side", () => {
    expect(R.get(fieldsOf(readMarks(LoanRow.ast)), "hidden")).toEqual(O.some(none))
  })

  it("reads the same mark on every variant a field has, and no class pointer on a variant", () => {
    // Each variant's fields are named first: a variant read with no fields, or one short, would otherwise compare
    // nothing and pass.
    const variants = [
      [LoanRow.insert, ["id", "status", "lender", "hidden", "createdAt"]],
      [LoanRow.update, ["id", "status", "lender", "hidden"]],
      [LoanRow.json, ["id", "status", "lender", "hidden", "createdAt"]],
      [LoanRow.jsonCreate, ["status", "lender", "hidden"]],
      [LoanRow.jsonUpdate, ["status", "lender", "hidden"]]
    ] as const
    for (const [variant, names] of variants) {
      const marks = readMarks(variant.ast)
      expect(marks.mark).toEqual(none)
      expect(R.keys(fieldsOf(marks))).toEqual(names)
      for (const [name, mark] of R.toEntries(fieldsOf(marks))) {
        expect(O.some(mark)).toEqual(R.get(expected, name))
      }
    }
  })

  it("keeps the insert variant's generated id: make still takes a row with no id", () => {
    const row = LoanRow.insert.make({ status: "open", lender: O.none(), hidden: O.none() })
    expect(row.status).toBe("open")
  })
})

describe("reading marks that are not well formed", () => {
  it("reports two keys at one position", () => {
    const both = S.String.pipe(S.annotateKey({ ...aboutProperty("lib:title"), ...noTerm("screen") }))
    expect(readKeyMark(both.ast)).toEqual({ kind: "several", keys: ["term", "noTerm"] })
  })

  it("reports a hand-written term that is not a CURIE", () => {
    const reading = readKeyMark(S.String.pipe(S.annotateKey({ term: 5 })).ast)
    expect(reading.kind).toBe("malformed")
  })

  it("reports a closed reason with a slice, and deferred with none", () => {
    const withSlice = readKeyMark(S.String.pipe(S.annotateKey({ noTerm: { reason: "screen", slice: "party" } })).ast)
    const noSlice = readKeyMark(S.String.pipe(S.annotateKey({ noTerm: { reason: "deferred" } })).ast)
    expect([withSlice.kind, noSlice.kind]).toEqual(["malformed", "malformed"])
  })

  it("reports a path that ends in a node step, or has a value step before one", () => {
    const endsInNode = readKeyMark(
      S.String.pipe(S.annotateKey({ path: [{ property: "lib:loanOf", node: "lib:Loan" }] })).ast
    )
    const valueFirst = readKeyMark(
      S.String.pipe(
        S.annotateKey({ path: [{ property: "lib:loanStatus" }, { property: "lib:loanOf", node: "lib:Loan" }] })
      ).ast
    )
    expect([endsInNode.kind, valueFirst.kind]).toEqual(["malformed", "malformed"])
  })

  it("reads a key set to undefined as absent, as Effect does", () => {
    expect(readKeyMark(S.String.pipe(S.annotateKey({ term: undefined })).ast)).toEqual(none)
  })
})

describe("the no-term reasons, read", () => {
  it("every reason of the closed list decodes as a case of NoTermRead", () => {
    for (const reason of NoTermReason.literals) {
      expect(S.is(NoTermRead)({ reason })).toBe(true)
    }
  })
})

describe("every reading schema generates only valid values", () => {
  const schemas = { MarkReading, NoTermRead, LiftPathRead, FieldMark, SchemaMarks }
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true)
      },
      { arbitrary: { runs: 30 } }
    )
  }
})
