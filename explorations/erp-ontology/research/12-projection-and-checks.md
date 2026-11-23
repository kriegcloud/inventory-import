---
type: Research
title: Projection and checks
description: The projector's inputs, mapping rules and determinism, and the gates of decision 6 with what each catches.
---

# Projection and checks

Design only: nothing here is built. No projector, no generated file, no gate and no reasoner exists today
(`project-profile.md`, "What exists"); every gate below would report "not built". TypeScript and Turtle in this
document are sketches, not code. Inputs are decisions 2, 5, 6 and 7, the decisions answered on 2026-11-22 (8 to 11,
13 to 16, 20 to 26, 32, 34, 38 to 41, 43, 46 and 93 to 101), reports 01, 02 and 14, the architecture seed, the API
design report (where they disagree, report 01 section 5 is followed), the contract packages, the alchemy-domain packet
and Effect 4.1.5 as installed. Modelling choices that are Benjamin's are rows in "Questions for Benjamin"; rows that
rest on one still open are marked "(pending Qn)"; the questions are now numbered decisions in
[DECISIONS.md](../DECISIONS.md), mapped under "Questions for Benjamin". An open decision is put to Benjamin with the
slice that needs it, and nothing is built on its recommendation until then. The keys were matched with 04 to 11 on
2026-11-22 (report 13), and section 3.1 was added then so this mapping covers every construct of 05's term model.

The first deliverable is the thin thread (decision 8). Its one specification is
[report 14](14-thin-thread.md), written against the repository's real code: seven classes, nine properties, two
schemes and four concepts (14 section 2), the marks on five enrolled records (14 section 3), one lift (14 section 4),
one question (14 section 5), gates 1 to 9 with one planted mistake each (14 section 6), the packages (14 section 7)
and the version header (14 section 8). This report keeps the general projection and the gates for every slice; where
it and report 14 differ about the thread, report 14 holds. The thread waits on no open decision. Slice 1, the party
slice, follows it.

## 1. What goes in and what comes out

### 1.1 Inputs

Two inputs, both TypeScript values in memory, read by one pure function:

1. The vocabulary module's values (decision 2): every term's key, label, definition, parent, disjointness, category
   tag, scheme, alignments and deprecation, and the gist projection (the field 05 gives `Vocabulary` for it: the
   names of 11's list admitted so far, as data, with its classes, their parents, its properties, their parents and
   the copied disjoint pairs; decision 13 admits a gist name only when a term of the slice being built needs it). Its
   entry shape is 05's (`Vocabulary`, `ClassTerm`, `ObjectPropertyTerm`, `DatatypePropertyTerm`, `ConceptScheme`,
   `DisjointGroup`, `AlignmentRow`); this document only reads it.
2. The record schemas that carry a term pointer: the Effect Schemas named on the enrolment list (section 6,
   Enrolment), which is a list of records, never of folders (decision 99). The thin thread enrols five: the kernel's
   `Member`, `Role` and `Activity` and the access contract's `Person` and `AuditTrail`, and no catalog record (14
   sections 3.6 and 3.7). Each later slice adds its records. The two contract packages (`packages/catalog/contract/src`,
   `packages/access/contract/src`) hold about 150 exported values, counted by a grep for `export const|class` with a
   capital name, not each checked to be a schema. The Alchemy domain blocks (section 7) come later. The projector
   reads their AST.

These are the ontology package's runtime inputs: values it imports, so each is a workspace dependency that the
boundary rows of decision 9 must allow. The paths the `laws ontology-terms` command scans (section 6.4) are a different
thing: files the CLI inspects as text, never workspace dependencies of the CLI, so the CLI needs no boundary exception.
The domain blocks have a third reader. A block's annotations are static values of its class (section 7), which no
syntax scan and no contract AST supplies, so when blocks are enrolled the ontology package's composition imports the
designated blocks from the model package, hands their values to the projector, and names the model's files as inputs
of its tasks.

What the Effect 4.1.5 AST gives the projector (all paths under `node_modules/effect/src/`):

| Need | Where | What it holds |
| --- | --- | --- |
| The node kinds | `SchemaAST.ts:54-75` | Declaration, Null, Undefined, Void, Never, Unknown, Any, String, Number, Boolean, BigInt, Symbol, Literal, UniqueSymbol, ObjectKeyword, Enum, TemplateLiteral, Arrays, Objects, Union, Suspend |
| What every node carries | `SchemaAST.ts:686-694` | `annotations`, `checks`, `encoding`, `context` |
| A field's own annotations and whether it may be left out | `SchemaAST.ts:626-631` (`Context`), `SchemaAST.ts:4692-4694` (`isOptional`) | `annotateKey` lands in `context.annotations`; `isOptional` reads `context.isOptional`. A field's mark is read from the outer node's `context.annotations` only; 05 section 4.8 requires it to be the last step of the field's pipe, after `nullAsNone`, `absentAsNone` or `OptionFromOptionalKey`. A record's own pointer, and a `Literals` schema's scheme pointer, is a schema annotation in the other store, read with `S.resolveAnnotations`; a `Model.Class` field built as a `Field` takes its mark on each variant (14 sections 3.1 and 3.5) |
| The way to the encoded side | `SchemaAST.ts:425-430` (`Link`), `SchemaAST.ts:476` (`Encoding`), `SchemaAST.ts:4752` (`toType`), `SchemaAST.ts:4801` (`toEncoded`) | a chain of links whose last `to` is the wire form |
| Fields, lists, choices, literals | `SchemaAST.ts:2838-2842` (`Objects`), `2670-2673` (`PropertySignature`), `2316-2321` (`Arrays`: `elements`, `rest`), `3717-3721` (`Union`), `1767-1769` (`Literal`) | name and type per field; tuple elements against a rest element |
| Opaque types | `SchemaAST.ts:745-760` (`Declaration`); `Schema.ts:10964-10984` (`BigDecimal`, representation id `effect/schema/BigDecimal`) | a declaration is told by its `representation.id` |
| Checks | `SchemaAST.ts:4118-4128` (`Filter`), `4193-4203` (`FilterGroup`) | each check's `annotations.representation` is `{ id, payload }`. A `FilterGroup` is walked into its member checks; the group has no id of its own |
| A check's identity | `SchemaAST.ts:4352-4374` (`isPattern`: payload `source`, `flags`), `Schema.ts:8026-8048` (`isInt`), `Schema.ts:7806-7817` (`isGreaterThan`), `Schema.ts:8548-8576` (`isMinLength`, one id for strings and lists) | the projector maps by id, never by the `expected` text |
| Open annotations | `Schema.ts:19313-19315` (`readonly [x: string]: unknown`), `19286-19300` (augmentation example), `19364-19369` (`Key`), `19410` (`identifier`), `19527-19528` (a filter's `representation`) | the `term`, `path` and `noTerm` keys need no change to Effect and no augmentation of `effect/Schema`; the typed helpers carry the typing (decision 20; 14 section 3.2) |
| Resolvers | `SchemaAST.ts:5172` (`resolve`), `5203` (`resolveIdentifier`), `5229` (`resolveDescription`) | |
| Brands | `Schema.ts:5371-5374` (`make(schema.ast, ...)`: the AST is unchanged); `SchemaRepresentation.ts:2628` ("distinctions such as those added by `Schema.brand` are absent from the AST") | an `ItemId` field is a plain UUID string to the projector |
| A portable form | `SchemaRepresentation.ts:2637` (`toRepresentation`, the encoded side), `554-559` (`Filter`), `463-469` (`PropertySignature`) | the same facts as JSON; a check made by `makeFilter` without `representation` carries none |

Two consequences shape every rule below:

- A custom check made with `S.makeFilter` and only an `expected` text has no representation id, so it cannot be
  projected. Two exist on the item today: the shortest-digits rule on `UnitCost`
  (`packages/catalog/contract/src/Item/Item.read.ts:66`) and the calendar-day rule on `IsoDate` (`Item.read.ts:105`).
- A reference between records cannot be read from the AST, because brands vanish. It comes from the property term's
  range in the vocabulary (report 02's "Object property range on an id field ... `references`").

### 1.2 Which side of a record is read

Structure from the encoded side, datatype from the type side. The projector walks the node, follows its `encoding`
links to the wire form for structure and lexical checks (pattern, length: what a literal's text must look like), and
reads the type side's declaration for the datatype. `UnitCost` is then a string with a pattern on the wire and a
`BigDecimal` in code: the literal is the wire digits, typed `xsd:decimal`. `nullAsNone`
(`packages/kernel/src/Wire.schema.ts:27-34`) is `NullOr` on the wire, so the field is optional in the shape.

### 1.3 Outputs

Four generated files, each committed with a GENERATED header and byte-compared (decision 6). Decision 9 puts the
projector and the generated files in a new package, `@inventory/ontology`; the folder and file names inside it are
this report's. Of these four the thin thread writes the first two only (decision 8), and beside them one generated
file this table does not hold: the graph of its one question, `packages/ontology/generated/fixtures/CQ-P06.graph.ttl`,
written by the same writer and byte-compared (14 sections 1.1 and 4.4). The SHACL file comes with the slice that
lifts stored rows and the alignment file with the slice that writes alignments.

| File (decision 9) | Holds | Read by |
| --- | --- | --- |
| `packages/ontology/generated/inventory.owl.ttl` | The ontology header, annotation property declarations, local classes and properties, and the gist projection (the names of 11's list admitted so far, decision 13) | the reasoner, the CQ suite |
| `packages/ontology/generated/inventory.skos.ttl` | Concept schemes and concepts (10's) | the CQ suite, the SKOS checks; never the reasoner |
| `packages/ontology/generated/inventory.shacl.ttl` | Node and property shapes from the record schemas | the SHACL slow test |
| `packages/ontology/generated/inventory.align.ttl` | `skos:*Match` triples from the vocabulary's alignment rows (11's) | people and mappers; never merged into the reasoner's closure (Q15) |

A fifth output, not Turtle: the SSSOM table of the alignment rows, named external terms included (decisions 29 and
31), written with the alignment file in the later slice and held by gates 1 and 12 like the others.

The projector's shape, in the repository's order (schema, then the service contract, then the implementation):

```ts
// sketch, not code
export class ProjectedFile extends S.Opaque<ProjectedFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String.pipe(S.annotateKey({ description: "Repository-relative path, never a home path" })),
    text: S.String.pipe(S.annotateKey({ description: "The exact bytes, UTF-8" })),
    triples: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.annotateKey({ description: "How many triples the file holds" })
    ),
    notProjected: S.Array(S.String).pipe(
      S.annotateKey({
        description: 'One line per thing left out: "StoredItem.firstReceivedOn: custom filter, no representation"'
      })
    )
  }).pipe(
    $I.annoteSchema("ProjectedFile", {
      description: "One generated file: its path, exact bytes, triple count and what was not projected"
    })
  )
) {}
export class ProjectionRefused extends S.TaggedError<ProjectionRefused, { readonly brand: unique symbol }>(
  "@inventory/ontology/errors/ProjectionRefused"
)(
  "ProjectionRefused",
  {
    at: S.String.pipe(S.annotateKey({ description: 'The term key or "Record.field" the refusal is about' })),
    reason: S.String.pipe(S.annotateKey({ description: "Why the projection was refused, as a sentence" }))
  },
  $I.annoteError<ProjectionRefused>("@inventory/ontology/errors/ProjectionRefused", {
    description: "The projection stopped: a term or a record field cannot be written as stated"
  })
) {}
export class OntologyProjector extends Context.Service<OntologyProjector, {
  readonly project: (input: {
    readonly vocabulary: Vocabulary // 05's decoded module value
    readonly records: ReadonlyArray<RecordSource> // { exportPath, ast } sorted by exportPath
  }) => Effect.Effect<ReadonlyArray<ProjectedFile>, ProjectionRefused>
}>()("@inventory/ontology/OntologyProjector") {}
```

The function is pure: no file, clock, random or network. A thin command (`bun run ontology:write`, in `@inventory/ontology` under decision 9) writes
the files; the fast test calls `project` and compares.

## 2. Terms this document owns

No class. The projector, the files and the gates denote nothing in the business: the null hypothesis holds for every
one of them (`foundational-analysis.md`, "Every symbol may denote nothing"). The one term this document would add is
the annotation property that carries the category tag into OWL, so that a competency question could read a term's
category from the generated file. Under decision 19's recommended answer (05's Q1) the tag stays in the module, gate 4
reads it there, and this property is not minted; the row is the other answer, kept so the choice is visible.

| Key | Label | Definition | Domain | Range | Source |
| --- | --- | --- | --- | --- | --- |
| termCategory | term category | An annotation property that links a class or property of this vocabulary to the concept naming its category in the term model, such as kind, role or phase, so that checks and queries read the category from the generated ontology (pending Q5; minted only under decision 19's other answer) | none: an annotation property, no `rdfs:domain` is emitted | a concept of a `TermCategoryScheme` that 05 would add under that answer (pending Q5) | NEW: decision 2 puts the kind or role tag in the vocabulary and projects it to OWL; no published annotation property for it exists in gist |

IRIs the projector mints that are not terms (they name documents and shapes, not things in the business):

| IRI form (decision 10) | Names | Why not a term |
| --- | --- | --- |
| `https://example.org/inventory-import/ontology` with `owl:versionIRI .../ontology/<version>` | the OWL document | an `owl:Ontology` individual |
| `.../taxonomy`, `.../shapes`, `.../alignments`, each with a version IRI | the other three documents | the same |
| `https://example.org/inventory-import/shape/<Record>`, `.../shape/<Record>-<field>`, `.../shape/<Record>-<field>-Node` and `.../shape/<Record>-<field>-<Member>` | a node shape, its property shapes, a nested record's node shape, a union member's node shape | SHACL individuals; named so no blank node is written |
| `https://example.org/inventory-import/data/<organizationId>/<TermKey>/<id>` | a node lifted from a record: a stored row, in tests only, or one of the thread's two decoded `Member` values | A-box; a stored row is never written to a generated file. The thread's graph file holds its two lifted members (14 sections 4.1 and 4.4) |
| `https://example.org/inventory-import/fixture/<TermKey>/<name>` | an individual only a fixture names (the thread's `test_Ravi`) | A-box; a person belongs to no tenant, so it is not under `data/<organizationId>/` (decision 34; 14 section 4.1) |
| `<parent IRI>/<field path>`, and `<parent IRI>/<field path>/<index>` for a member of a list (`.../item/<id>/vendors/0`, `.../item/<id>/sku`, `.../item/<id>/unitCost`) | a node a lift path creates: an item's `ItemIdentifier`, each `VendorItem`, the `CostObservation` and `MoneyAmount` of `unitCost`, a dimension's `QuantityValue`, a reported position's `InventoryMeasure` | A-box, in tests only. Positional on purpose: the record gives these values no id of their own, so the field path and the list index are the only stable name. Reordering a list renames its members, and the byte-compare never sees it because no generated file holds a list member (the thread's graph file holds one created node per member, `<member IRI>/role`, and no list; 14 section 4.1); two equal list members stay two nodes, as two file rows that look alike stay two records (`CLAUDE.md`) |

The four families (terms, the documents with their version IRIs, shapes, test data in its `data/` and `fixture/`
layers) are derived from one base value in
the vocabulary module, `https://example.org/inventory-import` today, each by its own suffix; none is made by appending
to `.../ontology/`. A cutover rehearsal is one fast test: it projects on a different test base and checks that every
term, document, version, shape and test-data IRI moved with it, that no IRI of the old base is left, and that the
competency questions' local prefix (04 binds it literally) resolves on the test base. The rehearsal changes nothing
about today's placeholder check (gate 3; law rule 5).

## 3. Mapping rules: vocabulary to OWL, SKOS and alignments

The label and definition properties are `skos:prefLabel` and `skos:definition`, in English (decision 11); these rules
write both with `@en`.

| Source construct | Triples | File | Rule |
| --- | --- | --- | --- |
| The module's version | `<ontology> a owl:Ontology ; owl:versionIRI <ontology/V> ; owl:versionInfo "V" ; dcterms:source <gist 14.1.0 version IRI>` | owl | V is a semantic version string written in the module, never the clock; before publication it stays `0.y`, and the thread's is `0.1.0` (decision 24; 14 section 8). No `owl:imports`: gist is projected into the file, not imported (the architecture seed does the same) |
| Annotation properties used | `skos:prefLabel a owl:AnnotationProperty` (and `skos:definition`, `skos:altLabel`, `skos:scopeNote`, `skos:historyNote`, `dcterms:source`, the replacement property of Q14; `inv:termCategory` only under decision 19's other answer) | owl | Declared, so the file is in the OWL 2 DL profile without importing SKOS (the seed keeps the SKOS schema out of its closure) |
| Class entry | `inv:K a owl:Class ; skos:prefLabel "L"@en ; skos:definition "D"@en` plus `skos:altLabel` and `skos:scopeNote` when given | owl | One prefLabel and one definition per language; missing either refuses the projection |
| Parent | `inv:K rdfs:subClassOf <P>` | owl | P is a local key or a projected gist class (decision 4). An IOF, ISA-95, schema.org or other external parent refuses. A local class whose identity-bearing parent chain reaches neither a projected gist class nor a `none` link with a reason refuses (orphan). A `none` link writes no `rdfs:subClassOf` and is allowed for a class on the committed exception list, which gives its reason and is ratified by Benjamin (decision 97; in the thread `Role` alone, 14 section 6.4, rule C4, which replaces 05's V25 there), and for a class tagged category if decision 12, which is open, admits category classes (05's V1 and V2; 06's `Party`). The chain is walked on the links that are emitted: a retired class emits no parent (deprecated term, below), so a live class whose parent is retired has no emitted path and refuses |
| Projected gist class | `gist:X a owl:Class ; rdfs:subClassOf gist:Y` only where both are projected; gist's copied pairs as `gist:X owl:disjointWith gist:Y` (decision 15: the pairs gist states between the classes taken and no others; 24 for the whole design of reports 04 to 12, fewer while fewer classes are admitted) | owl | Read from the vocabulary's gist projection (classes, parents, properties, disjoint pairs); 11 owns the list the names come from. A gist class is in the projection only once a term of the slice being built needs it (decision 13), and its named gist ancestors enter with it (decision 14); the thin thread admits seven gist classes, five parents and two ancestors, with three copied pairs (14 sections 2.1 and 2.5). The rule writes names, subclass links and the copied pairs only, the named operand of an `owl:equivalentClass` written as a plain parent (`gist-categories.md`) |
| Projected gist property | `gist:p a owl:ObjectProperty` (or `owl:DatatypeProperty`) and its named `rdfs:subPropertyOf` where both are projected; never its domain or range | owl | Read from the vocabulary's gist projection; 11 section E owns the list the names come from; a property is taken only when a term of the slice being built needs it (decisions 13 and 16) |
| Sub-property link (a property's gist parent) | `inv:p rdfs:subPropertyOf gist:q`, with `gist:q` declared by the row above | owl | Only where the vocabulary entry states it, for an object or a datatype property (decision 16). Refuses when the entry's domain or range does not fall under the gist property's own, or when `gist:q` is not projected. Written in the OWL file, never in the alignment file |
| Disjointness | `inv:A owl:disjointWith inv:B`, once per unordered pair, subject the smaller IRI | owl | Never `owl:AllDisjointClasses` (it needs a list, so a blank node); pairwise is in OWL 2 EL, RL and DL alike |
| Category tag | nothing under decision 19's recommended answer; under its other answer `inv:K inv:termCategory <concept>` | owl | (pending Q5). Either way gate 4 reads the tag in the module and refuses a role- or phase-tagged class in any disjointness pair, and a kind-tagged class under a role- or phase-tagged one (`anti-patterns.md` sections 2 and 4) |
| Object property | `inv:p a owl:ObjectProperty ; rdfs:domain inv:A ; rdfs:range inv:B` plus label and definition, and `rdfs:subPropertyOf` when the entry states a gist parent (sub-property link, above) | owl | Domain and range only as the vocabulary states them, kept broad (`anti-patterns.md` section 10). The vocabulary entry can carry that one link to a gist property and still has no field for an inverse, a characteristic (functional, transitive, symmetric) or a chain, so none can be written |
| Datatype property | `inv:p a owl:DatatypeProperty ; rdfs:range xsd:T`, and `rdfs:subPropertyOf` when the entry states a gist parent | owl | T read from the record field that fills it (report 02), by the table in section 4; two fields filling p with different T refuse. A property with no field takes the vocabulary's stated datatype, or no range |
| Our own annotation property | `inv:termCategory a owl:AnnotationProperty` | owl | |
| Deprecated term | `owl:deprecated true` (xsd:boolean), the label and definition kept, the replacement (pending Q14); no `rdfs:subClassOf`, `rdfs:subPropertyOf`, disjointness, domain or range | owl | An IRI is never reused. A current schema annotation that points at a deprecated term refuses the projection; a stored value is not an annotation, so a stored row that holds a retired code still lifts and resolves (pending Q14). The replacement written is the immediate edge the entry states, with the entry's own `since`: when B, the replacement of A, is later retired for C, A keeps A to B and its date, B gains B to C, and A's current successor is found by walking the edges to C. A cycle of replacements refuses. A fixture of two releases holds this |
| Retired concept or scheme | in the taxonomy: `owl:deprecated true`, the replacement (pending Q14) when there is one, `skos:historyNote` with the version; `skos:inScheme`, `skos:notation` and the labels kept | skos | Under decision 33 (a) (pending Q14), so the taxonomy alone says which codes are retired. A concept that is also an individual (`alsoInstanceOf`) gets the same three in the OWL file. A SKOS-only check: the old notation still resolves in its scheme, its replacement can be found when there is one, and a query for the live choices (no `owl:deprecated`) leaves it out |
| Concept scheme | `inv:S a skos:ConceptScheme ; skos:prefLabel ; skos:definition` | skos | Concept IRI `inv:<SchemeKey>-<notation>`, every scheme key ending in `Scheme` (decision 10): `inv:MemberRoleScheme-admin` |
| Concept | `<c> a skos:Concept ; skos:inScheme inv:S ; skos:notation "n" ; skos:prefLabel ; skos:definition` plus `skos:altLabel` | skos | Notation unique per scheme |
| Narrower concept | `<c> skos:broader <b>` | skos | One direction only: never `skos:narrower`; walk down with `^skos:broader` |
| Top concept | `<c> skos:topConceptOf inv:S` | skos | Never `skos:hasTopConcept`, the inverse direction of the same fact |
| Alignment row with an IRI target | `inv:K skos:closeMatch|exactMatch|broadMatch|narrowMatch|relatedMatch <target>`, and each used predicate declared `owl:AnnotationProperty` | align | Only `skos:*Match` (`project-profile.md`); never `owl:equivalentClass`, `owl:sameAs` or `rdfs:subClassOf` to an external class. Which rows are emitted (ratified only) is 11's |
| Alignment row naming a term with no namespace (ISA-95; Sutton, which publishes no namespace) | none | align | Listed in the file's header as "not projected: name only" |

### 3.1 Every construct of 05's term model, and what it becomes

05 defines the entries and fields below (its sections 2 to 4, widened on 2026-11-22); each row says where the rules
above or below place it, or that it reaches no generated file.

| 05 construct | Generated as | File | Rule here |
| --- | --- | --- | --- |
| `Vocabulary.namespace`, `version` | the ontology header, `owl:versionIRI`, `owl:versionInfo` | owl, and each file's header | section 3, first row; section 5, rule 11 |
| `PrefixEntry` | `@prefix` lines, only those used, sorted | every file | section 5, rule 4 |
| `ClassTerm` with `prefLabel`, `altLabels`, `definition`, `scopeNote` | `owl:Class` and its annotations | owl | section 3, class entry |
| `ParentLink` (`gist` or `local`) | one `rdfs:subClassOf` | owl | section 3, parent |
| `Vocabulary`'s gist projection (the names of 11's list admitted so far, with their ancestors, as data) | the gist class and property declarations, their named `rdfs:subClassOf` and `rdfs:subPropertyOf`, the copied `owl:disjointWith` pairs | owl | section 3, projected gist class and projected gist property; decisions 13 to 16 |
| `ParentLink` (`none` with a reason) | nothing; the reason stays in the module | | gate 4 accepts it for a class on the exception list (decision 97) and compares the two; a category-tagged class is decision 12's, which is open |
| `categoryParents` | one more `rdfs:subClassOf` per category class | owl | section 3, parent; gate 4 checks 05's V21 |
| `kindTag`, `identity`, `source`, `scope`, `ratification` | nothing under decision 19's recommended answer | | gate 4 reads them in the module |
| `DisjointGroup` | `owl:disjointWith` once per unordered pair | owl | section 3, disjointness; section 5, rule 10 |
| `ObjectPropertyTerm` with a `ClassTarget` domain or range (`local`, `gist`) | `rdfs:domain`, `rdfs:range` that class | owl | section 3, object property |
| a `ClassTarget` of kind `none` | no `rdfs:domain` or `rdfs:range` triple | owl | anti-pattern 10: kept broad |
| The sub-property field 05 adds to `ObjectPropertyTerm` and `DatatypePropertyTerm` (a gist parent property) | one `rdfs:subPropertyOf` | owl | section 3, sub-property link and projected gist property; decision 16 |
| `RangeTarget` of kind `schemes` | no `rdfs:range` in OWL (as 10 section 6 says), so `skos:Concept` never needs declaring in the reasoner's closure; the scheme is held by the record's SHACL `sh:in` over concept IRIs | shacl | section 4, the literal union row |
| `DatatypePropertyTerm` with no stated `datatype` | `rdfs:range` from the fields' leaf, by section 4's table | owl | section 3, datatype property |
| `DatatypePropertyTerm.datatype` (stated) | `rdfs:range` that xsd type; each field's literal converted to it | owl, shacl | section 5, rule 8; 05's V11 |
| `ConceptScheme` (`closed` included) | `skos:ConceptScheme`; `closed` emits nothing | skos | section 3, concept scheme |
| `Concept` with `notation`, `broader` | `skos:Concept`, `skos:inScheme`, `skos:notation`, `skos:broader` or `skos:topConceptOf` | skos | section 3 |
| `Concept.alsoInstanceOf` | `<concept> a owl:NamedIndividual , <the class's IRI>` in the OWL file, beside `a skos:Concept` in the SKOS file | owl, skos | a local class as `inv:K`, a projected gist class as `gist:X` (the dimension concepts are `gist:Aspect`). The concept is the individual, so one IRI is a concept and an individual and never a class. The thin thread's case is decision 41: viewer, editor and admin are concepts of `MemberRoleScheme` and, under the same IRIs, individuals of `Role`, each with one identity criterion, the concept's scheme and notation (14 section 2.4, which also declares a concept with no `alsoInstanceOf` as `owl:NamedIndividual` with no class when a graph the reasoner reads uses it as an object: the thread's scope concept). The typing goes in the OWL file because the SKOS file stays out of the reasoner's closure (pending decision 28): only there do `Currency`/`UnitOfMeasure` disjointness (pending decision 62) and gist's `gist:Aspect` pairs meet these individuals |
| `Concept.links` | one triple per link, from the concept to the linked concept (`hasDimension`), in the OWL file beside the typing above | owl | 05's V22 |
| `AlignmentRow` with a CURIE object | one `skos:*Match` triple | align | section 3; 11's rules |
| `AlignmentRow` with a named object (`NamedExternalTerm`) | a header line "not projected: name only", and a row of the generated SSSOM | align | section 3, last row; decision 29 |
| `AlignmentRow.justification`, `confidence` | nothing in Turtle; columns of the generated SSSOM | | 11 |
| `Deprecation` (`replacedBy`, `since`, `reason`) | `owl:deprecated true`, the replacement property, `skos:historyNote` with the version; no logical axioms. `replacedBy` is written as the immediate edge, never rewritten when the replacement is itself retired | owl; skos for a concept or scheme | section 3, deprecated term and retired concept or scheme; decision 33 |
| `TermPointer.term` on a record or a field | a node shape or a property shape | shacl | section 4 |
| `TermPointer.path` (`LiftPath`), its own annotation key, `path`, apart from `term` (decision 20 as corrected; 14 section 3.1) | a property shape on the first step with nested node shapes | shacl | section 4, lift path row |
| `TermPointer.noTerm` (`NoTermReason`) | nothing | | gate 5 and the law's rule 1 accept it; the reason is one of six: transport, request, screen, error, bookkeeping (decision 21) and deferred, which names the slice that will place the field (decision 98; 14 section 3.1) |
| `TermBinding` | nothing: the projector's join | | gate 5 |

## 4. Mapping rules: record schemas to SHACL

One node shape per record schema that carries a `term`, named after its `identifier`. Several records may point at one
class (`ItemFields` and `StoredItem` both describe an item); each gets its own shape and only one targets
the class (pending Q10). `ItemEdit` is the body of a change request, so it takes `noTerm` with the reason request and
gets no item shape. Shapes are SHACL 1.0 Core only: both seeds keep SHACL 1.2 drafts out of the production lane.

| AST construct | Shape triples | Rule |
| --- | --- | --- |
| Record (`Objects`) with `term` naming a class | `shape:R a sh:NodeShape ; sh:name "R" ; sh:description "<description>"@en` and `sh:targetClass <term>` on the one stored record (pending Q10) | `sh:closed true ; sh:ignoredProperties ( rdf:type )` on every node shape (decision 22): every field of a pointed record carries a pointer or `noTerm` with a reason, and a `noTerm` field lifts to nothing. A property the lift supplies from context and no field holds (`inTenant`) gets its own property shape on the stored record's node shape, min and max count 1, by a rule named "context properties", so the closed shape accepts it and tenancy is validated |
| Record with `term` naming a property, or a field with `term` naming a class other than its record's own | none | refused: a record is a thing, a field is a relation. A field whose `term` is its record's own class is the subject's id (14 section 3.1; the id row below) |
| Field with `term` naming a property | `shape:R-f a sh:PropertyShape ; sh:path <term>` and `shape:R sh:property shape:R-f` | Description from the key's `description`; `messageMissingKey` becomes `sh:message` |
| Scalar field (not `Arrays`) neither optional (`context.isOptional`) nor `NullOr` nor `UndefinedOr` | `sh:minCount 1` | A required key is not a required value: a required list may be empty (the `Arrays` row) |
| Optional key, `nullAsNone`, `absentAsNone` | no `sh:minCount` | In RDF "null" is the absence of a triple |
| Scalar field (not `Arrays`) | `sh:maxCount 1` | |
| `Arrays` with a rest element | no `sh:maxCount` and no `sh:minCount`; `isMinLength(n)` with n above 0 (or a non-empty array schema) gives `sh:minCount n`, `isMaxLength(n)` gives `sh:maxCount n` | A required key holding an empty list lifts to zero triples and conforms: `vendors: []` and `tags: []` conform. `vendors` gets `sh:maxCount 3`: zero members conform, four otherwise valid members violate it. A list of objects lifts to one node per member, named by position (section 2), so two equal members are two nodes and count twice; a list of scalars is a set, and two equal members are one triple (section 6.5) |
| Tuple (`Arrays` with `elements`) | none | refused: order has no SHACL Core form |
| `String` | `sh:datatype xsd:string` | unless a declaration or `format` below says otherwise |
| `Boolean` | `sh:datatype xsd:boolean` | |
| `Number` with `isInt` | `sh:datatype xsd:integer` | never `xsd:int` (32 bits) for a safe integer; `isInt32` is a group of `isInt` and `isBetween` with no id (`Schema.ts:8110-8121`), so it projects as `xsd:integer` with `sh:minInclusive -2147483648` and `sh:maxInclusive 2147483647`; `xsd:int` is never written |
| `Number` without `isInt` (`S.Finite`) | `sh:datatype xsd:double` (pending Q6) | never `xsd:integer`: report 02 found beep-effect's shapes map every number to `xsd:integer` |
| `BigInt` | `sh:datatype xsd:integer` | |
| Type side `effect/schema/BigDecimal` over a digits string | `sh:datatype xsd:decimal` plus the encoded side's pattern | the literal's text is the stored digits, never a float; "1.005" stays "1.005" |
| Money (07's `unitCost`, lifted to a `CostObservation` and its `MoneyAmount`) | under decision 59's (a), the lift's last step `minorUnits` with `sh:datatype xsd:integer`, its literal the field's digits at the field's scale ("12.3300" at scale 4 is 123300), a conversion 05's V11 names (`digitsAtScale`), plus `minorUnitScale` fixed at the field's scale; under 59's (c), an `xsd:decimal` amount holding the digits | one rule, never both. The digits are read from the `BigDecimal` string, never a float. The currency is decision 88's (a rule of the item record, never a field's description text), never folded into the number |
| Type side `DateTimeUtc`, or `format: "date-time"` | `sh:datatype xsd:dateTime ; sh:pattern "Z$"` | UTC is stated, as the record writes `DateTime.formatIso` |
| `format: "date"` | `sh:datatype xsd:date` | `IsoDate` carries no format today, so it projects as `xsd:string` with its pattern (Q16) |
| `Union` whose members are all `Literal` nodes (what `S.Literals` and `LiteralKit` build; `Schema.ts:5092-5096`) | `sh:in ( "a" "b" ... )` in member order, each literal typed as its value | This row wins over "`Union` of scalars"; the literals are read from the members' `literal` values in member order. A `LiteralKit` schema is this same node; the kernel's `Role` is the thin thread's case and `ModelCallPurpose` slice 1's; `hasRole`'s rank of the roles is the record's and no part of the scheme. A field whose term is a scheme lifts each of its own literals to its concept IRI and gets `sh:in ( inv:S-a inv:S-b ... )` with `sh:nodeKind sh:IRI`: the list holds only the codes this field decodes, in the field's declared order, never every code of the scheme (decision 23: the record keeps storing the notation and the projector lifts it to the concept's IRI). Gate 5 requires each literal to be a notation of the scheme (05's V12; 14 section 6.5, rule P8: gate 4 reads no record); a subset is allowed (05 section 7), since the record owns which codes a field allows (decision 2). `Uom` (five of the unit scheme's seven notations) and `Dimensions.unit` (`cm` and `in`) are proper subsets and pass; a literal the scheme does not hold fails. A literal whose concept is retired still lifts and resolves under decision 33 (a) (pending Q14); which codes a command may newly assign is that command's own schema, not this row |
| One `Literal` | `sh:hasValue` | a union's tag (`kind: "active"`) |
| `Enum` | `sh:in` of its values | |
| `TemplateLiteral` | `sh:pattern` of the template | |
| `isPattern` | `sh:pattern` from the payload's `source` | Rewritten: `\d` becomes `[0-9]` (SHACL's XPath regex `\d` matches any Unicode digit, JavaScript's without `u` only ASCII) and `(?:` becomes `(`. Lookaround and backreference refuse. Flags other than `i`, `m`, `s` refuse. The SKU pattern projects as `^[A-Z]{3}-[0-9]{4}$` |
| `isMinCodePoints`, `isMaxCodePoints` | `sh:minLength`, `sh:maxLength` | exact: SHACL counts characters |
| `isMinLength(n)`, `isMaxLength(n)` on a string | `sh:minLength ceil(n/2)`, `sh:maxLength n` | Effect counts UTF-16 units, SHACL characters; these bounds never refuse what Effect accepts (Effect's JSON Schema does the same, `Schema.ts:8550`) |
| `isGreaterThan`, `isGreaterThanOrEqualTo`, `isLessThan`, `isLessThanOrEqualTo`, `isBetween` (number, BigInt, BigDecimal) | `sh:minExclusive`, `sh:minInclusive`, `sh:maxExclusive`, `sh:maxInclusive` | bound typed with the field's datatype: `quantityOnHand` gets `"0"^^xsd:integer` and `"999999999999"^^xsd:integer` |
| A field marked as its record's subject id: its `term` is the record's own class (decision 10; 14 section 3.1) | none on a property; the focus node's IRI is minted from it | an id is the node, not a value of it. It is told by the mark, never by `isUUID` or any shape of the value: `MemberId` and `OrganizationId` are `IdText`, not UUIDs (`packages/kernel/src/Ids.id.ts`; 14 section 3.1). Exactly one such field in a record that points at a class |
| A field with `term` naming an object property | `sh:class <range of the term> ; sh:nodeKind sh:IRI` | the range is the vocabulary's; the AST has no brand to say it |
| A field that fills a datatype property whose vocabulary entry states a datatype | `sh:datatype` the stated type, whatever the leaf rows above give | the literal is converted to it (section 5, rule 8; 05's V11): `quantityOnHand` (`S.Int`) filling 07's `numericValue` (stated `xsd:decimal`, decision 50) gets `sh:datatype xsd:decimal`, never `xsd:integer`, since `sh:datatype` compares the literal's datatype IRI exactly |
| Nested `Objects` under an object property (`dimensions`, `vendors`) | `sh:node shape:R-f-Node`, that node shape built by the same rules | nested shapes are named by path, never by the nested schema's bare identifier (`Active` would collide across records) |
| `Union` of records (`Stocking`) | `sh:xone ( shape:R-f-Active shape:R-f-Inactive shape:R-f-Discontinued )` | each member a node shape with its tag as `sh:hasValue`. Where the union's pointer maps its tag to a scheme concept (07's `stocking`), the tag lifts to that concept on the stated property of the same subject (`lifecycleState`), member fields lift as their own properties of that subject (`discontinuedOn`), and `sh:xone` lists one node shape per member, applied to the same focus node, each with `sh:hasValue` the concept IRI. The nested-node form with a literal tag stays for a union with no such pointer |
| `Union` of scalars, not all `Literal` | `sh:or` of datatype constraints | |
| `Suspend` (recursion) | none | refused: SHACL 1.0 leaves recursive shapes undefined |
| A field whose pointer carries a lift path (05's `TermPointer.path`) | `sh:path` the first step (`[ sh:inversePath p ]` for a reversed step), `sh:node shape:R-f-Node`, that node shape holding `sh:class` of the step's node class, one `sh:hasValue` property shape per `fixed` value, and the field's own constraints on the last step | each step must pass 05's V23 as rewritten: the last step is a datatype property, a scheme-ranged object property, a class-ranged object property fed by a `Literals` field whose scheme's concepts, for every literal the field allows, state `alsoInstanceOf` that class (14 section 4.3, case (c); the object is the concept's IRI), or a class node whose nested fields supply the node's own properties; a `fixed` value is a concept CURIE, a datatype literal, the tenant or a sibling field, each checked against the fixed property's range. The `vendors` path in the sketch below (one reversed `offeredItem` step ending at a `VendorItem` node filled by the member's fields) satisfies it. A path of more than one node step nests one node shape per step, named by path as above; the thread's projector refuses such a path, since no thread field needs a second created node (14 section 4.3). The thin thread has one lift path, `Member.role` to one `Grant`, and it is the case (c) above: its steps, its six triples per member and the rule are 14 sections 3.3 and 4. The thread writes no SHACL, so this row makes no shape from it until the SHACL slice. `Member` has five fields and holds no email and no person id; its two copied names, `name` and `organizationName`, take `noTerm` with the reason screen in the thread and carry no path (decision 93; 14 section 3.3). The access contract's `Person` record is enrolled in the thread as a view of a membership, pointing at `inv:Member`, with the same role path, and its `email` and `joinedAt` are `noTerm`, reason deferred, naming the party slice (decisions 99 and 100; 14 section 3.6). Slice 1 replaces those marks with paths: the name through the person and the email through the sign-in account, each path reusing the one identified node of that person or account, never a new node per display field |
| Declaration not in this table (`Option`, `Redacted`, `File`, our own) | none | refused, naming record and field |
| A check on a whole record, `makeFilter` without representation, `isMultipleOf`, `isUnique`, `isUniqueKey` | none | written in the file header as "not projected", one line each |
| `examples`, `default`, `readOnly`, `writeOnly`, `title` | none | not data constraints |

What the item would project to, with 07's keys guessed:

```turtle
# sketch, not code: 07's keys; sku and vendors carry lift paths (05)
shape:StoredItem a sh:NodeShape ;
  sh:targetClass inv:InventoryItemSpecification ;
  sh:property shape:StoredItem-inTenant, shape:StoredItem-sku, shape:StoredItem-vendors .
shape:StoredItem-inTenant a sh:PropertyShape ; # context property: no field holds it, the lift supplies it
  sh:path inv:inTenant ; sh:nodeKind sh:IRI ; sh:minCount 1 ; sh:maxCount 1 .
shape:StoredItem-sku a sh:PropertyShape ;
  sh:path inv:identifiedBy ; sh:node shape:StoredItem-sku-Node ; sh:minCount 1 ; sh:maxCount 1 .
shape:StoredItem-sku-Node a sh:NodeShape ;
  sh:class inv:ItemIdentifier ;
  sh:property shape:StoredItem-sku-Node-kind, shape:StoredItem-sku-Node-text .
shape:StoredItem-sku-Node-kind a sh:PropertyShape ;
  sh:path inv:identifierKind ; sh:hasValue inv:IdentifierKindScheme-sku .
shape:StoredItem-sku-Node-text a sh:PropertyShape ;
  sh:path inv:identifierText ; sh:datatype xsd:string ; sh:minCount 1 ; sh:maxCount 1 ;
  sh:pattern "^[A-Z]{3}-[0-9]{4}$" .
shape:StoredItem-vendors a sh:PropertyShape ;
  sh:path [ sh:inversePath inv:offeredItem ] ; sh:node shape:StoredItem-vendors-Node ; sh:maxCount 3 .
```

### 4.1 The lift (tests only)

This section is the lift of stored rows. The lift function itself is a thread deliverable: `lift(record, value)`
reads a record's marks and returns triples, and the thread runs it on two decoded `Member` values to build the graph
of its one question, which `bun run ontology:write` writes as a generated file (14 section 4). What follows is its
later use. The lift turns stored rows into the data graph gate 11 validates. On stored rows it runs in the slow test
only and writes no generated file. Its input is three things: the organization's id, the confirmation that created the rows, and each row
encoded by `StoredItem`. `StoredItem` holds neither the organization nor the confirmation
(`packages/catalog/contract/src/Item/Item.read.ts`), so the slow test supplies both from the import it ran. Each item
node is typed with the class the stored record's pointer names (`inv:InventoryItemSpecification`). Paths, properties
and fixed values are 07's (its section 1 table) and are pending the decisions named.

| `StoredItem` field | Lifted as | Sibling or context value | Literal |
| --- | --- | --- | --- |
| `id` | the node's IRI, with the organization's id (section 2) | the organization, from context | none: an id is the node |
| `sku` | 05's two-step path: an `ItemIdentifier` node with its kind fixed to the SKU concept, then its text | none | `xsd:string` |
| `name`, `description`, `firstReceivedOn`, `reorderPoint` | 07's property for each, on the item | none | the property's stated datatype (`firstReceivedOn` pending decision 51) |
| `category`, `uom` | the notation lifted to its concept IRI (decision 23) | none | none: an IRI |
| `unitCost` | a `CostObservation` and its `MoneyAmount` (section 4, money row; pending decision 59) | the currency by decision 88's record rule; `costPerUnit` from the sibling `uom` | under 59 (a) `minorUnits` as `xsd:integer`, the digits at the field's scale |
| `quantityOnHand` | decision 76's reported position (pending) | `asOf` and `reportedIn` from the context's confirmation; the unit from the sibling `uom` | 07's `numericValue`, `xsd:decimal` (pending decision 50) |
| `stocking` | `lifecycleState` as a concept, plus `discontinuedOn`, both on the item (section 4, union of records) | none | `discontinuedOn` as `firstReceivedOn` |
| `lotTracked` | `true` to `TrackingMethodScheme-lot`, `false` to `TrackingMethodScheme-untracked` | none | none: an IRI |
| `tags` | one `taggedWith` each | none | `xsd:string` |
| `dimensions` | `length`, `width` and `height`, each a `QuantityValue` | each one's unit is the sibling `unit` | `numericValue` as above |
| `vendors` | one `VendorItem` per member, by position, with `vendorName`, `vendorSku`, `unitPrice`, `leadTime` in days and `isPreferred` | `unitPrice` as `unitCost` | each property's stated datatype |
| `createdAt`, `createdBy`, `revision` | nothing: `noTerm` | | |
| (context) | `inTenant` on the item node and on every node the lift creates | the organization, from context | none: an IRI |

The lift types each literal from the stored value and the property's stated datatype, by a function it does not share
with the shape writer, so a datatype error in the shape writer shows as violations and is not repeated on both sides.
While a field's lift waits on terms a later slice brings (`quantityOnHand` under decision 76, whose stock terms are
08's), the test lists that field as not validated.

The access records have lift paths too (section 4, lift path row): `Member`'s role lift in the thin thread, the rest
of `Member` and `Person` in slice 1. No stored access row is lifted in the thread or in slice 1, but the thread's
role lift does run: the `inv:Member` and `inv:Grant` triples of its question's graph come from the lift of two
decoded `Member` values and from nowhere else, with two guards and five must-fail cases that keep a hand-written
`Grant` from answering (14 sections 4.4 and 5.4; gate 8). The pointer gates (5 and 7, decision 95) hold the marks,
and slice 1's paths too. Both are a different check from this slow test.

## 5. Determinism: what makes a byte-compare mean something

A byte-compare is a check only if the same inputs always give the same bytes, on any machine, under any locale, and
after a dependency upgrade that changes no meaning.

1. One writer, the projector's own. No library serializer writes the files, so a serializer's new formatting cannot
   change bytes. N3.js is used only to parse them back, a different code path, which is the point of the re-parse.
2. UTF-8 without a byte-order mark, LF line ends, one final LF, no trailing space, every text NFC-normalized.
3. A fixed header: `# GENERATED by bun run ontology:write from <repository-relative module path>. Do not edit.`,
   the version, then the "not projected" lines sorted. No date, time, user, host, absolute path or git commit: a commit
   hash would change on the commit that adds it. The thread's files open with exactly two comment lines, this one
   and `# inventory-import ontology 0.1.0`; its graph file names its two sources in the first (14 section 8).
4. Prefixes: only those used, sorted by prefix, taken from one table in the vocabulary module. Never `@base`. A
   local name that is not a valid Turtle local name is written as a full IRI in angle brackets. 05 says a prefix
   entry's prefix and its IRI are each unique; the writer refuses a prefix table that fails that rule, and never
   emits two `@prefix` lines for one prefix.
5. Subjects in fixed sections (in the OWL file, in 14 section 6.1's order: header, annotation property
   declarations, gist classes, local classes, object properties, datatype properties, a projected gist property
   among those of its kind, then named individuals (concepts with `alsoInstanceOf`, and a concept declared for a
   graph, section 3.1) and their links; in the SKOS file the header, schemes then concepts; in the SHACL file node shapes then property shapes; in the
   alignment file header, annotation property declarations, then match triples by subject), and within a section
   sorted by full IRI in code-point order, never `localeCompare`, which depends on ICU and the locale.
6. Predicates per subject in one fixed table per file. OWL: `rdf:type`, `owl:versionIRI`, `owl:versionInfo`,
   `dcterms:source`, `skos:prefLabel`, `skos:altLabel`, `skos:definition`, `skos:scopeNote`, `rdfs:subClassOf`,
   `rdfs:subPropertyOf`, `owl:disjointWith`, `rdfs:domain`, `rdfs:range`, `inv:termCategory`, `owl:deprecated`, the
   replacement property, `skos:historyNote` and, for concept individuals, the object properties named by
   `Concept.links`. SKOS: `rdf:type`, `owl:versionIRI`, `owl:versionInfo`, `skos:prefLabel`, `skos:altLabel`, `skos:definition`, `skos:inScheme`,
   `skos:notation`, `skos:broader`, `skos:topConceptOf` and, for a retired concept or scheme, `owl:deprecated`, the
   replacement property and `skos:historyNote`. Alignment: `rdf:type` and the five `skos:*Match`. SHACL:
   `sh:targetClass`, `sh:path`, `sh:datatype`, `sh:class`, `sh:node`, `sh:nodeKind`, `sh:minCount`, `sh:maxCount`,
   the four bounds, `sh:minLength`, `sh:maxLength`, `sh:pattern`, `sh:flags`, `sh:in`, `sh:hasValue`, `sh:xone`,
   `sh:or`, `sh:closed`, `sh:ignoredProperties`, `sh:property`, `sh:name`, `sh:description`, `sh:message`, with
   `rdf:type` and, inside an inline path, `sh:inversePath`. A predicate not in its file's table refuses the
   projection, so a new one is a reviewed change. Each file has a second list, apart from this table: the allowed
   objects of `rdf:type`. The thread's two lists per file, for its three files, are 14 section 6.3; they are the
   part of these tables the thread uses, and the graph file's are the vocabulary's own properties and classes.
7. Several objects of one predicate sorted by their N-Triples form, one per line.
8. One escaping function for strings (`\\`, `\"`, `\n`, `\r`, `\t`, other control characters as `\uXXXX`); never
   long strings in triple quotes. Numbers typed and written by one function per datatype: `xsd:integer` with no sign
   or leading zero, `xsd:decimal` by `BigDecimal.format` as the record does, always in plain notation: `BigDecimal.format` writes an
   exponent when the normalised scale is 16 or more in absolute value (`BigDecimal.ts:2454-2458`), so such a value
   refuses the projection, naming the record and field; an integer filling a property whose stated
   datatype is `xsd:decimal` (05's V11) as its digits, a float filling one as ECMAScript's Number-to-String result
   (the shortest digits that read back as the same float) written in plain decimal notation, never with an exponent,
   which is not always the float's exact binary value; `xsd:boolean` as `true` or `false`. This rule governs the
   writer of the generated files; the test's lift writes its literals by its own function (section 4.1), so the two
   do not share a datatype mistake.
9. No labeled blank node. Every node written has an IRI, property shapes included. The only blank nodes are Turtle
   lists `( ... )` for `sh:in`, `sh:xone`, `sh:or` and `sh:ignoredProperties`, in source order (the order of a
   literal union's members, of a union's members), and the one-predicate path `[ sh:inversePath p ]` of a reversed lift step,
   written inline where it is used.
10. Disjointness pairwise, once per pair (section 3), so no list is needed in OWL.
11. The version from the module's constant only (decision 24); never `Clock`, `Date`, git or `package.json` read at
    run time.
12. Effect's `HashMap` and `HashSet` iterate in hash order, which is not an order: every collection becomes a sorted
    array before writing. Records are taken from the enrolment list (decision 99), never discovered from a folder's
    exports, and sorted by file path, then export name.
13. Graph identity checked beside the bytes: the re-parse's sorted N-Triples, with list nodes named by their
    position, equal the projector's own triple list. Bytes catch formatting drift; this catches a writer that drops or
    adds a triple while staying stable.

## 6. Gates

Decision 6: byte-compare and re-parse in `bun run check`, an OWL reasoner in `bun run check:full`, SHACL over the
stored rows of the messy sample as a slow test. `bun run check` must not need Java, Python or a network. The other
gates are added where their cost fits.

| # | Gate | Runs in | What it does | What it catches | One bad change it stops |
| --- | --- | --- | --- | --- | --- |
| 1 | Byte-compare | `check` (fast test of the ontology package, turbo `test`) | `project` in memory; each file's bytes equal the committed file, and the SSSOM table once it is written | a hand edit; a vocabulary or record change not regenerated; a non-deterministic projector | someone adds `inv:Pallet a owl:Class` to `inventory.owl.ttl` by hand |
| 2 | Re-parse | `check` | N3.js parses each file; triple count and graph identity (rule 13) equal the projector's | invalid Turtle; an escaping bug; a writer that loses a triple | a definition with a double quote written unescaped |
| 3 | Forbidden constructs and namespace | `check` (fast test; law rules 4 and 5 below hold the same for code files) | on the parsed triples, never on text: every predicate of each generated file is in that file's table and every `rdf:type` object in that file's own list of allowed types (section 5, rule 6; 14 section 6.3), so none of `owl:inverseOf`, `owl:sameAs`, `owl:equivalentClass`, `owl:imports`, `owl:hasKey`, `owl:Restriction` and the cardinality predicates, `owl:AllDisjointClasses`, `skos:narrower` or `skos:hasTopConcept` can appear; no `rdfs:subClassOf` object outside `inv:` and the projected gist classes; every minted IRI (term, document and version, shape) under the `example.org` placeholder and derived from the module's one base (section 2) | a projector change or a vocabulary row that breaks decisions 4 and 7 or report 01's and 02's rules | an `iof-core:` parent given to an item class; a `skos:narrower` written beside `skos:broader` |
| 4 | Vocabulary coherence | `check` (fast test, TypeScript) | a pure function over the vocabulary value, the exception list and the `rat-` records; it reads no record (14 section 6.4, whose rules C1 to C13 are the thread's). Every local class reaches a projected gist class or ends at a `none` link with a reason; the classes ending at `none` must be exactly the entries of the committed exception list, with the same reason, each entry ratified by Benjamin (decision 97; `Role` alone in the thread), so a new one is a reviewed change; a category-tagged class ending at `none` waits on decision 12, which is open. The walk is made on the hierarchy that is emitted, the live classes with their documented `none` waivers: a retired class emits no parent and need not have one, and a live class whose only path runs through a retired class fails. No subclass cycle; no class with two disjoint ancestors; category tags agree with axioms (section 3) and each tag is one 05's V25 admits for the gist class the class reaches; category parents are category-tagged classes (05's V21); no identity criterion rests on a name or a SKU (05's V18; 04's CQ-I08); one prefLabel and definition `@en`, no empty text; SKOS notation unique per scheme, `skos:broader` acyclic and inside one scheme; a concept's `alsoInstanceOf` and `links` pass 05's V22, and such an individual states one identity criterion, the concept's scheme and notation (decision 41); every `ratification`, and every exception entry's, names a `rat-` record that exists and reads accept (decision 32: the module holds ratified entries only), a concept naming its scheme's record when the scheme's proposal listed it (decision 101: 18 records for the thread); the version has the form decision 24 gives it; a vocabulary-variant must-fail case a question assigns to this gate (section 6.3) fails it | unsatisfiable classes from named subclass links and disjointness, orphans, role-as-kind by tag, a parentless class nobody allowed | `Grant` given a `none` parent with no entry on the exception list (the thread's planted mistake, 14 section 6.4); `MaterialLot` placed under two classes 08 declares disjoint, which needs a second parent and so a category parent (decision 12, open): a class has one `parent`, and the thread cannot write this case; `Organization` retired with its annotations updated while `Tenant` still names it as parent, which fails here even though the ontology stays consistent |
| 5 | Record pointers on the AST | `check` (fast test) | every `record` and `scheme` entry of the enrolment list (Enrolment, below; decision 99) resolves `term` in its schema annotations, never `noTerm`, and a `collection` entry carries no mark and is checked against the record it is a collection of; every field of a pointed record resolves exactly one of `term`, `path` and `noTerm` in its key annotations (decisions 21 and 22), lift paths included (the thread's role lift and the slice 1 access fields, section 4), and `Member`'s two copied names resolve `noTerm` with the reason screen until slice 1 gives them paths (decision 93); a record's term is a class, a field's a property, or the record's own class on the one field that is the subject's id; every literal of a schema or field that points at a scheme is a notation of that scheme, a subset allowed, so the check is membership of the codes the field decodes and never equality with the taxonomy (05's V12; decision 23); every field of each variant of a `Model.Class` carries its class field's mark. The thread's rules are P1 to P12 of 14 section 6.5. No current schema annotation points at a deprecated term (a stored value is not read here); one datatype per datatype property. For a domain block, once blocks are enrolled, the block's static annotations are read where the AST carries none (section 7) | a helper that drops an annotation; a pointer written before an Option wrapper (it resolves to nothing, so the field fails as unpointed); a datatype clash; a field's literals drifting from its scheme; a record whose annotation points at a retired term | `Vendor.isPreferred` (a boolean) pointed at the date property `inv:discontinuedOn`; in the thin thread, a copy of `Member` whose `name` field carries no mark (14 section 6.5) |
| 6 | Type-check | `check` (`tsc`, `Curie<V>`) | under decision 20 the argument of a pointer helper must be a CURIE of the vocabulary (report 02; 05). A raw `term` property is not held by the type-check, since Effect's annotations accept any string key (`Schema.ts:19313-19315`): that is gate 7's. A domain block's `term` is typed by the augmentation of section 7 | a term that does not exist | `aboutClass("inv:Organisation")` |
| 7 | `laws ontology-terms` | `check` (root script, section 6.4) | static scan of the declarations on the enrolment list and of every code file's helper calls, independent of gate 5's runtime read | an enrolled export with no helper call; a helper call on a declaration that is not enrolled, a mark no gate checks; a raw `term`, `path` or `noTerm` key or an untyped lookalike of a helper (decision 20) | an enrolled `CarrierAccount` schema whose helper call is deleted; a raw `term: "inv:Member"`, spelt right, which gates 5 and 6 accept (the thread's planted mistake, 14 section 6.7) |
| 8 | CQ suite, no reasoning | `check` (fast test) | each CQ's query over OWL plus SKOS plus its fixture (the thread's one question reads asserted types only and runs over its graph alone, 14 section 6.8); rows equal the expected rows; each CQ also run on each of its must-fail cases, in the forms of section 6.3. The loader and the query keep the tenant of a fact that holds relative to a tenant (section 6.3) | a renamed or re-parented term that a question still names; a constraint that passes on empty data; a customer flag on one tenant's record of an organization joined with a vendor flag on another tenant's record of it (decision 34) | renaming `inv:isVendor` while CQ queries still use it: zero rows, fail |
| 9 | Reasoner | `check:full` (package turbo task `reason`; ROBOT with HermiT, decision 25); whether `check:ci` runs it too is part of Benjamin's approval of the download (14 sections 1.5 and 9.2) | OWL 2 DL profile validation of the OWL file; consistency and unsatisfiable classes of the OWL file alone, then of OWL plus each CQ fixture; and each vocabulary-variant must-fail case a question names (section 6.3) must be reported inconsistent. In the thin thread the negative case is one fixture triple that types the fixture's person as an `inv:Tenant`, which must be reported inconsistent: the pair `gist:Organization` and `gist:PhysicalIdentifiableItem` is copied, and `Person` reaches the second through the ancestors decision 14 admits; no `Person` and `Organization` pair is copied, and no local pair is in the thread (decisions 14, 15 and 94; 14 sections 2.1 and 6.9). From the slice that brings an event class, beside the consistent vocabulary, one negative fixture types a single node as both an `AuditEntry` and an event class and must be reported inconsistent, by the module's own disjoint pairs (06), which must then hold one for the two: the copied gist pairs give no disjointness of event and content (11) | a profile violation; an inconsistency that needs instances (domain or range typing meeting disjointness; a concept typed by `alsoInstanceOf` whose links or class meet a disjointness); for the compatibility review of a release, previously valid fixture data that a change makes inconsistent | a fixture `test_Acme inv:baseUnit ...` whose domain types an organization as an item specification, which gist's `Organization` and `Intention` disjointness forbids (decision 15) |
| 10 | CQ suite, reasoned | `check:full` | Only under decision 27 (b). Under the recommended (a) no manifest names a reasoning step, this gate has nothing to run and is not built, and a re-parented class is a zero-row failure of gate 8. Under (b): CQs whose manifest names a reasoning step, run over the reasoner's inferred output; an expected answer lost after a change is evidence for the compatibility review of a release | a missing subclass path a question depends on | a class re-parented so it no longer falls under the class a question counts |
| 11 | SHACL over the stored messy sample | slow test in the app (`apps/inventory/test/server/*.slow.test.ts`, run by `test:slow` in `check:full`); it cannot live in the ontology package, since a package never reaches into `apps/` (`laws boundaries`). The app would import the ontology package's shapes, lift and engines, which the thread's boundary row refuses: `allowed` in `laws boundaries` reads `devDependencies` too and has no notion of a test import, so nothing may import `@inventory/ontology` (14 section 7.2). The SHACL slice settles it, by a test-only row in the law or by another home for the test; it is not the thread's | a fresh D1; `items_messy.csv` imported through Confirm (155 items, as `test/server/Imports.slow.test.ts:69-78` already checks); the rows read back through the item store, encoded by `StoredItem`, lifted (pending Q11) by the lift of section 4.1, from the organization, the confirmation and each encoded row; each item node typed with the class the stored record's pointer names (`inv:InventoryItemSpecification`), so the 155 focus nodes do not depend on subclass triples in the data graph; validated: conforms, and exactly 155 focus nodes (non-vacuous); then each projected constraint broken once in an in-memory copy must give a violation, among them a fourth otherwise valid vendor (`sh:maxCount 3`), while an item with no vendors and no tags conforms. While a field's lift waits on terms a later slice brings (`quantityOnHand` under decision 76), the test lists that field as not validated; when it is lifted, one lifted quantity is compared with its stored value | shapes stricter than real data; shapes looser than the schema; a target that selects nothing; a required list wrongly given `sh:minCount 1` (an item with no vendors) | the projector maps `S.Int` to `xsd:string`, or writes the unlifted cost digits ("35.82") as the `minorUnits` literal, or types `minorUnits` `xsd:double`: a violation on every item that has a cost. The recommended lift of decision 59 (a), the digits at the field's scale as `xsd:integer`, conforms |
| 12 | Alignment file | `check` (fast test), from the slice that writes the alignment file | every target's namespace is in the prefix table; only `skos:*Match`; every subject is a live `inv:` term; and the SSSOM table once it is written | an alignment to a retired term; an unknown prefix | a row aligning a deprecated class |

Enrolment. Gate 5, gate 7 and the projector's discovery of bindings read one cumulative list of enrolled records,
and nothing outside it. Enrolment is by record, never by folder (decision 99, which replaces decision 95's "the
access contract and the four kernel records"). Under decisions 8 and 95 the thin thread comes first and enrols five:
the kernel's `Member`, `Role` and `Activity` (the last at `AuditEntry`, decision 46) and the access contract's two
views of them, `Person` (a record of `inv:Member`, decision 100) and `AuditTrail` (a collection of `Activity.json`).
Which contract exports are views, every mark on every field of the five, and how a mark sits on a `Model.Class`, are
14 sections 3.3 to 3.6; `noTerm` does not satisfy the check on a record itself. An export that is not enrolled
carries no mark at all, `noTerm` included: `AgentRun`, `Membership`, `OrganizationChoice`, `ModelCallPurpose`, the
kernel's other exports and every catalog declaration are reported as "not enrolled", never failed and never given
a placeholder mark for a term that does not exist yet. That is not an exemption: the slice that owns a record's term
enrols it. Slice 1 keeps the thread's five, adds its own records and replaces the thread's deferred marks
(`Activity.agent`, `Person.email`, `Person.joinedAt`; decisions 98 and 100). This list is the first coverage of
gates 5 and 7, which start in the thread. Slice 2 adds the catalog contract's item records; slice 3 adds the rest of
the catalog contract's, the import's declarations; the model's blocks are enrolled only at the separate
alchemy-domain milestone (section 6.4, rule 2). The list is one committed file, `packages/ontology/enrolment.json`,
which the law reads as text, beside `packages/ontology/src/Enrolled.ts`, which maps each entry to its schema value
for gate 5; gate 5's first check is that the two name the same set (14 section 3.7). It only grows.

The thin thread's gates (decisions 8 and 95). The thread builds every gate that needs no stored row: gates 1 to 8 in
`check`, gate 8 with its one question (section 6.3) and gates 5 and 7 enrolled as above, and gate 9 in `check:full`.
Each of the nine has one committed test that plants one mistake and asserts that the gate reports it, so "shown
failing once" is a permanent test. Where each gate runs, what it reads, the rules it runs in the thread and its
planted mistake, chosen so that no other gate sees it, are 14 sections 6.1 to 6.9, which replace the list this
paragraph held. Gates 11 and 12 wait for their slices, and gate 10 is decision 27's, which is open.

Stored rows are never changed to reach a must-fail case: the mutation is made to the lifted graph in memory, so the
D1 database holds only what a real import wrote (`CLAUDE.md`, "Look at it").

### 6.1 Reasoner candidates (Q2)

The projector emits named `rdfs:subClassOf`, pairwise `owl:disjointWith` (the module's and the gist pairs of
decision 15, 24 when every class of the design is taken), `rdfs:domain`, `rdfs:range`, `rdfs:subPropertyOf` (decision 16), annotations, and for concepts with
`alsoInstanceOf` a class assertion and their `links` as property assertions. For that set, gate 4's TypeScript check
already finds every unsatisfiable class of the T-box (with no restriction, only two disjoint ancestors can make a
class empty); an inconsistency that needs an individual (a concept typed by `alsoInstanceOf` whose links or class
meet a disjointness) is the reasoner's, gate 9. Every axiom is in OWL 2 RL,
so an RL rule engine is complete for the consistency of the ontology with instance data. A DL reasoner adds the profile
check, and it stays right when restrictions or unions are added later.

| Candidate | Runs as | Needs installed | Can check here | Cannot check |
| --- | --- | --- | --- | --- |
| ROBOT jar with HermiT | `java -jar robot.jar validate-profile --profile DL`, then `reason --reasoner hermit` (the seed notes ROBOT's default reasoner is ELK, so HermiT is named) | a Java runtime (this machine has OpenJDK 27 through mise, not pinned by the repository) and the ROBOT jar pinned by SHA-256 (the architecture seed pins 1.9.11; its size was not read) | DL, EL and RL profile reports (undeclared or punned entities, a property used both as object and datatype property); consistency; unsatisfiable classes; inconsistency with each CQ fixture; the seed ran this route on its 959-triple closure | missing values (open world); what the projector refused; whether ROBOT runs on Java 27 (not tried) |
| HermiT standalone jar | `java -jar` | Java and the jar | consistency, classification | profile validation; an older release line, not checked |
| Openllet CLI | Java distribution | Java | consistency, with explanations | profile validation not checked |
| ELK (through ROBOT) | as ROBOT | as ROBOT | OWL 2 EL axioms only | everything outside EL is ignored (validator skill), so a green run says nothing of the rest |
| EYE (`eyereasoner`, WASM) with OWL 2 RL rules in N3 | Vitest on Node | the npm package and a rule file we keep | RL entailments and clashes with fixtures; unsatisfiable classes by giving each class one test individual; complete for consistency while every axiom stays RL | DL profile validation; anything outside RL; the rule file's own correctness |
| owlrl or reasonable (Python) | `uvx` in a turbo task | uv (installed) | as EYE | as EYE; Python in CI |
| The TypeScript coherence check (gate 4) | Vitest | nothing | every unsatisfiable class of today's T-box | instances, restrictions; it is not an OWL reasoner, so it does not meet decision 6 alone |

Decided (decision 25): ROBOT with HermiT in `check:full`, for the OWL 2 DL profile check and consistency, with gate 4
in `check`. `reason` is a package task of the ontology package,
never a `//#` root task (config-sync puts every root task in `bun run check`, which must not need Java). It is named
in the root `check:full` script. If `check:ci` names it too, CI's main job runs it on every pull request, with a
pinned Java set up in that job and the jar fetched by the script that checks its SHA-256 and keeps it outside the
repository; that is not decided, since CI would fetch the same jar (14 sections 1.5 and 9.2).
When Java or the jar is missing the task fails with the command to run; it never passes by skipping. The Java pin and
the jar download are still Benjamin's to approve, with the file, its source and its size named first; nothing is
fetched until then. The task's two runs in the thread, its inputs and its pin file are 14 sections 6.9 and 6.10.

### 6.2 Parser, SPARQL and SHACL engines for Vitest on Node (Q3)

None is installed (`node_modules` has no `n3`, `oxigraph`, `@comunica`, `shacl-engine` or `rdf-validate-shacl`).
Versions are chosen at install.

| Engine | Parses | SPARQL 1.1 | SHACL | Notes |
| --- | --- | --- | --- | --- |
| N3.js (`n3`) | Turtle, N-Triples, TriG, N3 | no | no | the re-parse of gate 2; an RDF/JS store the others read |
| Oxigraph (`oxigraph`, Rust compiled to WASM) | yes | query and update | no | one package; the CQ runner of gates 8 and 10 |
| Comunica (`@comunica/query-sparql-rdfjs`) | through parsers | query | no | many dependencies; a fallback CQ runner |
| shacl-engine | over RDF/JS | its SPARQL-constraint plugin needs an engine | Core | the slow test's validator; Core is all the shapes use |
| rdf-validate-shacl | over RDF/JS | no | Core | an older alternative |
| pySHACL through `uvx` | yes | yes | Core and SPARQL | the seed's engine; from Vitest it needs a child process, a Node built-in the check refuses outside an annotated file, so for use by hand |

Decided (decision 26): N3.js for the re-parse, Oxigraph for SPARQL and shacl-engine for SHACL Core, each held to the
Effect rules at its edge (`Effect.tryPromise` with a typed error). The thin thread uses N3.js and Oxigraph;
shacl-engine is added with the SHACL slice.

### 6.3 The competency-question suite's form

04 writes the questions (`assets/requirements/competency-questions.yaml`); this is the form the runner reads, decoded
by a Schema in the test.

The thread keeps its one question inside the ontology package (`packages/ontology/fixtures/cq/`: the query, the
hand-written fixture and the member rows), so the package's own files cover them and no `assets/**` input is named.
Its `turbo.json` names one input outside the package for `test`, the `rat-` records under
`explorations/erp-ontology/assets/audit/*/governance/ratifications/**`, and gives `reason` its own list of
committed files (14 section 6.10). For the later questions, the fixtures, queries, expected rows and the manifest
stay under `explorations/erp-ontology/assets/requirements/` unless their slice moves them into the package as the
thread did; while they stay, the package's `turbo.json` names that folder as an input of `test` and of `reason`, as
`packages/catalog/model/turbo.json` names what its proofs read; without it a changed fixture replays a cached pass.
That is the cache contract of gates 8 to 10: each task's hash covers the manifest and
every file it names that the runner consumes, the queries, the fixtures of the passing run and of each must-fail
case, the expected answers and the antecedent queries. For gate 9 it covers which fixtures are chosen and their
bytes, beside the OWL file and the reasoner's own inputs, so a changed fixture never replays an earlier consistency
result. The tests read the files with `?raw` imports or `import.meta.glob`, never `node:fs`. The manifest is decoded
by a Schema; if it stays YAML, its parser is a declared dependency of the ontology package (not tried).

```yaml
# sketch, not code
- id: CQ-012
  question: Which organizations does one tenant hold as both a customer and a vendor?
  kind: select # select | ask | count | constraint
  query: CQ-012.rq
  fixture: CQ-012.ttl # named test_ individuals only, hand-written instance data, no term facts
  expected: CQ-012.csv # header plus rows, compared without the header and sorted
  reasoning: none # none under decision 27 (a); rl or dl only under (b), run in check:full over the reasoner's output
  mustFail: # one or more cases, each with one form and what failing means
    - remove: ["test_AcmeRecord inv:isVendor true"] # triples taken out of the fixture; the flag is on the tenant's SourceRecord (decision 34)
      expect: rows-differ
    - add: ["test_AcmeRecord inv:isVendor false"] # triples added to the fixture
      expect: rows-differ
    - fixture: CQ-012.two-tenants.ttl # a variant fixture file, instance data only
      expect: { rows: CQ-012.two-tenants.csv } # the wrong rows the case states
    - query: CQ-012.mutant.rq # a mutant query run over the unchanged fixture
      expect: rows-differ
  antecedent: null # constraint kind only: a query that must return rows, or the pass is vacuous
```

The forms of a must-fail case are closed: remove triples from the fixture, add triples to it, a variant fixture file,
or a mutant query file run over the unchanged fixture. What failing means follows the question's kind. For `select`
and `count`, the rows differ from `expected`, or equal the wrong rows the case states. For `constraint`, the stated
number of violation rows appears. For `ask`, the answer flips. A question may carry several cases. A case with no
form, or one the runner cannot apply, fails the suite and is never skipped.

A must-fail that changes the vocabulary (disjoint subclasses, a property's scope narrowed) is not a gate 8 case,
since no fixture states a term (the brief's no-gos). It is a case of gate 4 (coherence over a variant module value
built in the test) or of gate 9 (the variant projected and reasoned with the fixture), and the manifest names which.

The A-box of a question is its fixture, never the stored rows (those belong to gate 11). No gate runs the generated
shapes over a fixture, so a must-fail case never rests on a SHACL shape: it is a row mismatch or a violation row of a
SPARQL query (04). A question about parties uses `test_` fixtures, since the messy sample stores items only
(`project-profile.md`).

A fact that holds relative to a tenant keeps its tenant in the fixture. Under decision 34 the customer and vendor
flags sit on the tenant's `SourceRecord`, which is linked to the organization by `recordOf`, never on the shared
organization. CQ-P01 reads them there: the query reads both flags from one record and binds that record to the tenant
it selects, as it does `inTenant`. If the fixture uses one named graph per tenant, the generated OWL and SKOS load
into the default graph and each tenant's assertions into that tenant's own graph, and the loader never merges them
before the query. The two-tenant must-fail case gives one organization a customer flag on one tenant's record and a
vendor flag on the other tenant's record, and must return no row.

The thin thread's one question (decision 8; 04's CQ-P06): who belongs to this organization and with which role. Its
query, its fixture of two tenants and one person with two memberships, the two expected rows and the five must-fail
cases are 14 section 5. The graph is seventeen triples: five hand-written, for what no record holds, and twelve
lifted from two `Member` rows (14 section 4.4). The suite compares the whole result, and the answer for one
organization is the rows with that tenant. The thread reads no manifest; the form above is for the later questions.
The graph holds no name and no email (decision 93), and no contact: a `ContactAssignment` with its purpose and
contact point is slice 1's (decisions 39 and 43), where the same rule holds, that a purpose at one account is never
reported at another.

### 6.4 The `laws ontology-terms` rule

A new command of `@beep/repo-cli`, `bun run beep laws ontology-terms`, with a root task `//#ontology-terms:check` in
all three checks, written like the other laws (oxc syntax tree, files git would commit, the scratchpad left out, a
refusal at the line with the line to write). What it scans are source paths, files the CLI reads as text, and
`packages/ontology/enrolment.json`; the CLI imports neither the kernel nor a contract package and needs no boundary
exception for them. Rules 1 to 3 follow decision 20, the typed helpers. The command is part of the thin thread
(decision 95), on the thread's enrolment. Which rules run in the thread, and the three rules 14 adds to the five
below (1b, 6 and 7), are 14 section 6.7.

1. Every export on the enrolment list (section 6, Enrolment; decision 99) whose value is a schema (a call chain from
   `S.` or `Schema.`, a `LiteralKit(...)` call such as `Role`, a wrapped declaration, a class extending one, or
   `class X extends Model.Class<X>("X")(fields, annotations)` with the helper in the second argument) carries a
   helper call in its own declaration; a `collection` entry is exempt. A pointer is
   the spread of the imported helper that fits the position (`aboutClass` on a record and on the field that is its
   subject's id, `aboutScheme` on a `Literals` schema, `aboutProperty` or `aboutPath` on a field). A raw `term`,
   `path` or `noTerm` key, or a local function that only looks like a helper, is refused. An enrolled record is
   refused with `noTerm`; a field of one may take it, as `Member`'s two copied names do until their paths are written
   (decision 93). A helper call in a declaration that is not enrolled is refused too (14's rule 1b). In
   `packages/kernel/src` only the enrolled declarations are read; the vocabulary module, the pointer
   helpers and the context and middleware files are not record schemas and are not read.
2. Every `Domain.Event`, `Rejection`, `Command`, `Aggregate`, `Decision`, `View`, `Projection`, `Query` and `Stream`
   declared in `packages/*/model/src` carries `term` or `noTerm` in its last argument (section 7). A block's
   annotations are typed by the augmentation of `@alchemy.run/domain`, so this rule reads the `term` key there and
   asks for no Effect helper. Not part of the command until the alchemy-domain build declares blocks with
   annotations on main (the brief's Map); until then the existing blocks in `packages/catalog/model/src`, which
   already declare events and rejections with no term, are not scanned.
3. A helper's term arguments are string literals, so the type-check holds them to `Curie<V>`; a computed value is
   refused.
4. No code file (`.ts`, `.tsx` or `.mjs` that git would commit) contains `owl:inverseOf`, `owl:sameAs`,
   `owl:equivalentClass`, `owl:imports`, `owl:hasKey`, `skos:narrower` or `skos:hasTopConcept`, as a CURIE or as a
   full IRI, outside this law's own source and its tests. It scans code files only: the generated Turtle is gate 3's,
   on parsed triples, and the suite's query and fixture files are not code files, so CQ-P05's ASK may name
   `owl:sameAs` and its must-fail fixture may state one such triple, and gate 3's planted mistake, a Turtle fixture,
   does not trip this rule (14 sections 6.3 and 6.7).
5. Every namespace written in the vocabulary module is the `example.org` placeholder or an external prefix of the
   namespace table; none names Sutton. The module writes the placeholder once, as the one base every IRI family is
   derived from (section 2), and the literal appears in no other code file: in the thread that one file is
   `packages/kernel/src/Terms.vocab.ts` (14 sections 2.6 and 6.7).

Not its job: whether a term exists (gate 6), whether a field's pointer survives helpers (gate 5), whether the pointer
is the right term (nobody's but the reviewer's).

### 6.5 What no gate catches

- A definition that is false, or a parent that is wrong but consistent: every gate checks form, not meaning.
- A term nobody needs, or one missing that no CQ asks for.
- The record rules that have no representation: the shortest-digits cost, the calendar day, any record-wide check,
  uniqueness in a list. They are listed in the header and held by the record schema at decode, not by SHACL.
- A duplicate in a list of scalars: RDF properties are sets, so `["fragile", "fragile"]` lifts to one triple. A list of
  objects (`vendors`) lifts one node per member, by position (section 2), so its duplicates stay and count.
- Open-world gaps: an absent role flag reads as unknown to the reasoner and as a violation only where a shape
  requires it (`project-profile.md`, closed or open flags, is open).
- Whether two records are one party: identity decisions are records, never axioms (report 01).
- Rows of any organization other than the one the slow test imports, and any file other than the messy sample.
- A version that should have been raised: the byte-compare sees the change, nothing checks the number moved, and a
  byte-compare alone cannot tell that the right number was chosen. Gates 9 and 10 give evidence for the compatibility
  review (previously valid data made inconsistent, an expected answer lost); they do not enforce a release number.
- Identifier continuity, which is a different thing from the version number. Gates 1 and 5 compare this module with
  this generated snapshot and with today's pointers, so a notation removed with every current reference updated
  passes them all. What would hold 05's no-rename rule is a release comparison against the previous accepted
  inventory of term keys and scheme-qualified notations: an old identifier may be marked retired, and may not
  disappear or be given a new meaning. Its failing example is removing `editor` from the role scheme and adding a
  fresh spelling. The first release sets the baseline. No gate above is that comparison.
- The shapes of records other than the stored item (`Member`, `AuditEntry` and the rest): they are byte-compared and
  re-parsed, but no stored row is validated against them until a slow test lifts those rows.
- Drift between the ontology and what Sutton's live API exposes: Sutton's schema is behind a token (report 01).

## 7. How the Alchemy domain layer carries the pointer

Report 01 section 6: every domain class carries the IRI of the term it represents, and a check fails when a class has
none or points at a term that does not exist. Read at the pin, installed from
`vendor/alchemy/alchemy.run-domain-734c27a.tgz` (`node_modules/@alchemy.run/domain/src/`, version 2.0.0-beta.87 by its
`package.json`):

| Block | Where its annotations go | `term` on the Schema AST | How gates 5 and 7 read it |
| --- | --- | --- | --- |
| `Domain.Event` | passed to `Schema.TaggedClass` and kept as the static `annotations` (`Event.ts:74-91`) | yes | AST, or `X.annotations.term` |
| `Domain.Rejection` | passed to `Schema.TaggedError` and kept as static (`Rejection.ts:64-81`) | yes | as an event |
| `Domain.Command` | static only; its schema is built from the tag and input alone (`Command.ts:140-148`) | no | `X.annotations.term` |
| `Domain.Aggregate` | static (`Aggregate.ts:892-904`); its state is its own schema (`Aggregate.ts:147-148`) | the state schema's own, if annotated | the aggregate by static; its state schema by AST |
| `Domain.Decision` | static (`Decision.ts:396-401`) | no | static |
| `Domain.Relation` | none (`Relation.ts` takes no annotations) | no | cannot carry one; a relation is a rule, not a term, so it is left out of rule 2 by kind |
| View, Projection, Query, Stream, Policy, Saga | static (the packet's `research/concepts/annotations.md`) | no | static; most are reads and take `noTerm` |

"Static" in this table means a value of the class at run time, not something a syntax scan supplies. The reader of
those values is the ontology package's later composition (section 1.1): it imports the designated blocks, gives the
projector their annotations, and its tasks name the model's files as inputs. Gate 5 reads a block's static
annotations where the AST carries none; gate 7 inspects the source syntax on its own. Neither the CLI's scan nor the
list of contract ASTs supplies a block's binding. None of this is built before the alchemy-domain milestone (section
6.4, rule 2).

Typing needs an augmentation of `@alchemy.run/domain`, whose `Annotations` interface has no index signature, before
any block carries a term. Decision 20 chose both parts: contract schemas use the typed helpers, bound in the kernel
from generic makers in `@beep/vocabulary` (14 section 3.2): `aboutClass`, `aboutProperty` and `aboutScheme` write the
annotation key `term`, `aboutPath` writes `path` and `noTerm` writes `noTerm` (14 section 3.1); and
`@alchemy.run/domain`'s `Annotations` is augmented. The thread enrols no block, so it does not write the
augmentation; the slice that enrols the first block does (14 section 1.3). `effect/Schema` is not augmented:

```ts
// sketch, not code
declare module "@alchemy.run/domain" {
  interface Annotations {
    readonly term?: Curie<InvClassVocab> // one registry per kind of term (14 section 2.6); which a block uses is 09's
    readonly noTerm?: NoTermReason // decision 21's closed list; decision 98's deferred carries its slice
  }
}
```

Effect's interface has an index signature (`Schema.ts:19313-19315`), so any `term` string type-checks there, which is
why the helpers carry the typing; `Domain.Annotations` has none (`Annotations.ts:27-53`), so without the augmentation
a `term` key is a type error. Which
term an event or an aggregate points at is 09's (likely gist `Event` subclasses for events, an information term for the
import); whether a command points at a term or takes `noTerm: "request"` is 09's too.

## Questions for Benjamin

Moved on 2026-11-22 to the packet's [DECISIONS.md](../DECISIONS.md), merged with the other reports' questions. The
mapping: Q1 is decision 9, Q2 is 25, Q3 is 26, Q4 is 11, Q5 is 19, Q6 is 50, Q7 is 22, Q8 is 21, Q9 is 10, Q10 is
48, Q11 is 49, Q12 is 23, Q13 is 24, Q14 is 33, Q15 is 28, Q16 is 51.

Nine of the sixteen were answered on 2026-11-22 and are cited above by decision number: Q1 (9), Q2 (25), Q3 (26), Q4
(11), Q7 (22), Q8 (21), Q9 (10), Q12 (23) and Q13 (24). Seven are open and keep their "(pending Qn)" marks: Q5 (19),
Q6 (50), Q10 (48), Q11 (49), Q14 (33), Q15 (28) and Q16 (51). Each is put to Benjamin with the slice that needs it;
the thin thread waits on none of them. Decisions 97 to 101, answered the same day, came from the second review and
from report 14 and have no Qn here: 97 is cited at the parent rule and gate 4, 98 at the `noTerm` reasons, 99 at
Enrolment, 100 at the lift path row and 101 at gate 4.

## Not checked

- No projector, writer, shape, query or gate was written or run. Every gate here is "not built".
- Whether `S.toTaggedUnion` keeps member identifiers; whether `toRepresentation` would be a simpler input than the
  live AST.
- Whether a `?raw` import that leaves the package passes `laws boundaries`; whether Vitest imports the text of
  `.rq`, `.ttl`, `.csv` and `.yaml` files from a folder outside the package was not tried.
- Whether the Alchemy augmentation in section 7 type-checks beside the helpers' `term` annotation on an event's
  annotations, and
  whether a `term` key in a block's annotations changes what Verify reads.
- Whether ROBOT runs on Java 27; the size of the ROBOT jar; whether ELK, HermiT or Openllet versions named in the seeds
  are current. Nothing was downloaded.
- Whether N3.js, Oxigraph, shacl-engine, EYE or Comunica run under this repository's Vitest and Effect rules; none is
  installed. shacl-engine's SHACL Core coverage is its own claim, not checked.
- The XPath against JavaScript regex claims (`\d`, `(?:`) were not tried on an engine.
- The contract export count (about 150) is a grep, not a list of schemas.
- 04 to 11 were being written at the same time and were not read by this report's author; the keys were matched with
  them on 2026-11-22 (report 13), and section 3.1 was added from 05 as it stands after that date. No rule here was run.
- The edits of 2026-11-22 that make this report defer to report 14 took report 14's statements about the code as
  written there; no file it names was reopened for this report, and what report 14 did not check is its section 10.
- The beep-effect fold's `xsd:integer` mapping is report 02's finding, not opened again.
- No public Sutton document was read for this report; no Sutton fact is used beyond report 01's.
