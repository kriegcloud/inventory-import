---
type: Research
title: Projection and checks
description: The projector's inputs, mapping rules and determinism, and the gates of decision 6 with what each catches.
---

# Projection and checks

Design only: nothing here is built. No projector, no generated file, no gate and no reasoner exists today
(`project-profile.md`, "What exists"); every gate below would report "not built". TypeScript and Turtle in this
document are sketches, not code. Inputs are decisions 2, 5, 6 and 7, reports 01 and 02, the architecture seed, the API
design report (where they disagree, report 01 section 5 is followed), the contract packages, the alchemy-domain packet
and Effect 4.1.5 as installed. Modelling choices that are Benjamin's are rows in "Questions for Benjamin"; rows that
rest on one are marked "(pending Qn)"; the questions are now numbered decisions in [DECISIONS.md](../DECISIONS.md),
mapped under "Questions for Benjamin". The keys were matched with 04 to 11 on 2026-11-22 (report 13), and section 3.1
was added then so this mapping covers every construct of 05's term model.

## 1. What goes in and what comes out

### 1.1 Inputs

Two inputs, both TypeScript values in memory, read by one pure function:

1. The vocabulary module's values (decision 2): every term's key, label, definition, parent, disjointness, category
   tag, scheme, alignments and deprecation. Its entry shape is 05's (`Vocabulary`, `ClassTerm`, `ObjectPropertyTerm`,
   `DatatypePropertyTerm`, `ConceptScheme`, `DisjointGroup`, `AlignmentRow`); this document only reads it.
2. The record schemas that carry a term pointer: every exported Effect Schema of a contract package
   (`packages/catalog/contract/src`, `packages/access/contract/src`; about 150 exported values, counted by a grep for
   `export const|class` with a capital name, not each checked to be a schema) and the Alchemy domain blocks
   (section 7). The projector reads their AST.

What the Effect 4.1.5 AST gives the projector (all paths under `node_modules/effect/src/`):

| Need | Where | What it holds |
| --- | --- | --- |
| The node kinds | `SchemaAST.ts:54-75` | Declaration, Null, Undefined, Void, Never, Unknown, Any, String, Number, Boolean, BigInt, Symbol, Literal, UniqueSymbol, ObjectKeyword, Enum, TemplateLiteral, Arrays, Objects, Union, Suspend |
| What every node carries | `SchemaAST.ts:686-694` | `annotations`, `checks`, `encoding`, `context` |
| A field's own annotations and whether it may be left out | `SchemaAST.ts:626-631` (`Context`), `SchemaAST.ts:4692-4694` (`isOptional`) | `annotateKey` lands in `context.annotations`; `isOptional` reads `context.isOptional` |
| The way to the encoded side | `SchemaAST.ts:425-430` (`Link`), `SchemaAST.ts:476` (`Encoding`), `SchemaAST.ts:4752` (`toType`), `SchemaAST.ts:4801` (`toEncoded`) | a chain of links whose last `to` is the wire form |
| Fields, lists, choices, literals | `SchemaAST.ts:2838-2842` (`Objects`), `2670-2673` (`PropertySignature`), `2316-2321` (`Arrays`: `elements`, `rest`), `3717-3721` (`Union`), `1767-1769` (`Literal`) | name and type per field; tuple elements against a rest element |
| Opaque types | `SchemaAST.ts:745-760` (`Declaration`); `Schema.ts:10964-10984` (`BigDecimal`, representation id `effect/schema/BigDecimal`) | a declaration is told by its `representation.id` |
| Checks | `SchemaAST.ts:4118-4128` (`Filter`), `4193-4203` (`FilterGroup`) | each check's `annotations.representation` is `{ id, payload }` |
| A check's identity | `SchemaAST.ts:4352-4374` (`isPattern`: payload `source`, `flags`), `Schema.ts:8026-8048` (`isInt`), `Schema.ts:7806-7817` (`isGreaterThan`), `Schema.ts:8548-8576` (`isMinLength`, one id for strings and lists) | the projector maps by id, never by the `expected` text |
| Open annotations | `Schema.ts:19313-19315` (`readonly [x: string]: unknown`), `19286-19300` (augmentation example), `19364-19369` (`Key`), `19410` (`identifier`), `19527-19528` (a filter's `representation`) | a `term` key needs no change to Effect; typing it needs an augmentation |
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

Four generated files, each committed with a GENERATED header and byte-compared (decision 6). Names and place are
Benjamin's (Q1); the recommended form:

| File (pending Q1) | Holds | Read by |
| --- | --- | --- |
| `packages/ontology/generated/inventory.owl.ttl` | The ontology header, annotation property declarations, local classes and properties, and the gist projection (11's list) | the reasoner, the CQ suite |
| `packages/ontology/generated/inventory.skos.ttl` | Concept schemes and concepts (10's) | the CQ suite, the SKOS checks; never the reasoner |
| `packages/ontology/generated/inventory.shacl.ttl` | Node and property shapes from the record schemas | the SHACL slow test |
| `packages/ontology/generated/inventory.align.ttl` | `skos:*Match` triples from the vocabulary's alignment rows (11's) | people and mappers; never merged into the reasoner's closure (Q15) |

The projector's shape, in the repository's order (schema, then the service contract, then the implementation):

```ts
// sketch, not code
export class ProjectedFile extends S.Class<ProjectedFile>("ProjectedFile")({
  path: S.String, // repository-relative, never a home path
  text: S.String, // the exact bytes, UTF-8
  triples: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  notProjected: S.Array(S.String) // "StoredItem.firstReceivedOn: custom filter, no representation"
}) {}
export class ProjectionRefused extends S.TaggedError<ProjectionRefused>()("ProjectionRefused", {
  at: S.String, // the term key or "Record.field"
  reason: S.String
}) {}
export class OntologyProjector extends Context.Service<OntologyProjector, {
  readonly project: (input: {
    readonly vocabulary: Vocabulary // 05's decoded module value
    readonly records: ReadonlyArray<RecordSource> // { exportPath, ast } sorted by exportPath
  }) => Effect.Effect<ReadonlyArray<ProjectedFile>, ProjectionRefused>
}>()("@inventory/ontology/OntologyProjector") {}
```

The function is pure: no file, clock, random or network. A thin command (`bun run ontology:write`, pending Q1) writes
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

| IRI form (pending Q9) | Names | Why not a term |
| --- | --- | --- |
| `https://example.org/inventory-import/ontology` with `owl:versionIRI .../ontology/<version>` | the OWL document | an `owl:Ontology` individual |
| `.../taxonomy`, `.../shapes`, `.../alignments`, each with a version IRI | the other three documents | the same |
| `https://example.org/inventory-import/shape/<Record>`, `.../shape/<Record>-<field>`, `.../shape/<Record>-<field>-Node` and `.../shape/<Record>-<field>-<Member>` | a node shape, its property shapes, a nested record's node shape, a union member's node shape | SHACL individuals; named so no blank node is written |
| `https://example.org/inventory-import/data/<organizationId>/<TermKey>/<id>` | a lifted stored row, in tests only | A-box; never written to a generated file |
| `<parent IRI>/<field path>`, and `<parent IRI>/<field path>/<index>` for a member of a list (`.../item/<id>/vendors/0`, `.../item/<id>/sku`, `.../item/<id>/unitCost`) | a node a lift path creates: an item's `ItemIdentifier`, each `VendorItem`, the `CostObservation` and `MoneyAmount` of `unitCost`, a dimension's `QuantityValue`, a reported position's `InventoryMeasure` | A-box, in tests only. Positional on purpose: the record gives these values no id of their own, so the field path and the list index are the only stable name. Reordering a list renames its members, and the byte-compare never sees it because no generated file holds data; two equal list members stay two nodes, as two file rows that look alike stay two records (`CLAUDE.md`) |

## 3. Mapping rules: vocabulary to OWL, SKOS and alignments

The label and definition properties are open (`project-profile.md`); these rules write `skos:prefLabel` and
`skos:definition` with `@en` (pending Q4).

| Source construct | Triples | File | Rule |
| --- | --- | --- | --- |
| The module's version | `<ontology> a owl:Ontology ; owl:versionIRI <ontology/V> ; owl:versionInfo "V" ; dcterms:source <gist 14.1.0 version IRI>` | owl | V is a string constant in the module, never the clock (pending Q13). No `owl:imports`: gist is projected into the file, not imported (the architecture seed does the same) |
| Annotation properties used | `skos:prefLabel a owl:AnnotationProperty` (and `skos:definition`, `skos:altLabel`, `skos:scopeNote`, `skos:historyNote`, `dcterms:source`, the replacement property of Q14; `inv:termCategory` only under decision 19's other answer) | owl | Declared, so the file is in the OWL 2 DL profile without importing SKOS (the seed keeps the SKOS schema out of its closure) |
| Class entry | `inv:K a owl:Class ; skos:prefLabel "L"@en ; skos:definition "D"@en` plus `skos:altLabel` and `skos:scopeNote` when given | owl | One prefLabel and one definition per language; missing either refuses the projection |
| Parent | `inv:K rdfs:subClassOf <P>` | owl | P is a local key or a projected gist class (decision 4). An IOF, ISA-95, schema.org or other external parent refuses. A local class whose parents never reach a projected gist class refuses (orphan) |
| Projected gist class | `gist:X a owl:Class ; rdfs:subClassOf gist:Y` only where both are projected | owl | 11 owns the list and whether gist's disjointness is copied; the rule writes names and subclass links only, the named operand of an `owl:equivalentClass` written as a plain parent (`gist-categories.md`) |
| Disjointness | `inv:A owl:disjointWith inv:B`, once per unordered pair, subject the smaller IRI | owl | Never `owl:AllDisjointClasses` (it needs a list, so a blank node); pairwise is in OWL 2 EL, RL and DL alike |
| Category tag | nothing under decision 19's recommended answer; under its other answer `inv:K inv:termCategory <concept>` | owl | (pending Q5). Either way gate 4 reads the tag in the module and refuses a role- or phase-tagged class in any disjointness pair, and a kind-tagged class under a role- or phase-tagged one (`anti-patterns.md` sections 2 and 4) |
| Object property | `inv:p a owl:ObjectProperty ; rdfs:domain inv:A ; rdfs:range inv:B` plus label and definition | owl | Domain and range only as the vocabulary states them, kept broad (`anti-patterns.md` section 10). The vocabulary entry has no field for an inverse, a characteristic (functional, transitive, symmetric) or a chain, so none can be written |
| Datatype property | `inv:p a owl:DatatypeProperty ; rdfs:range xsd:T` | owl | T read from the record field that fills it (report 02), by the table in section 4; two fields filling p with different T refuse. A property with no field takes the vocabulary's stated datatype, or no range |
| Our own annotation property | `inv:termCategory a owl:AnnotationProperty` | owl | |
| Deprecated term | `owl:deprecated true` (xsd:boolean), the label and definition kept, the replacement (pending Q14); no `rdfs:subClassOf`, disjointness, domain or range | owl | An IRI is never reused. A record pointing at a deprecated term refuses the projection |
| Concept scheme | `inv:S a skos:ConceptScheme ; skos:prefLabel ; skos:definition` | skos | Concept IRI `inv:<SchemeKey>-<notation>` (decision 10's recommended form, from 10) |
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
| `ParentLink` (`none` with a reason) | nothing; the reason stays in the module | | gate 4 lists it as an orphan with its waiver |
| `categoryParents` | one more `rdfs:subClassOf` per category class | owl | section 3, parent; gate 4 checks 05's V21 |
| `kindTag`, `identity`, `source`, `scope`, `ratification` | nothing under decision 19's recommended answer | | gate 4 reads them in the module |
| `DisjointGroup` | `owl:disjointWith` once per unordered pair | owl | section 3, disjointness; section 5, rule 10 |
| `ObjectPropertyTerm` with a `ClassTarget` domain or range (`local`, `gist`) | `rdfs:domain`, `rdfs:range` that class | owl | section 3, object property |
| a `ClassTarget` of kind `none` | no `rdfs:domain` or `rdfs:range` triple | owl | anti-pattern 10: kept broad |
| `RangeTarget` of kind `schemes` | no `rdfs:range` in OWL (as 10 section 6 says), so `skos:Concept` never needs declaring in the reasoner's closure; the scheme is held by the record's SHACL `sh:in` over concept IRIs | shacl | section 4, `Literals` |
| `DatatypePropertyTerm` with no stated `datatype` | `rdfs:range` from the fields' leaf, by section 4's table | owl | section 3, datatype property |
| `DatatypePropertyTerm.datatype` (stated) | `rdfs:range` that xsd type; each field's literal converted to it | owl, shacl | section 5, rule 8; 05's V11 |
| `ConceptScheme` (`closed` included) | `skos:ConceptScheme`; `closed` emits nothing | skos | section 3, concept scheme |
| `Concept` with `notation`, `broader` | `skos:Concept`, `skos:inScheme`, `skos:notation`, `skos:broader` or `skos:topConceptOf` | skos | section 3 |
| `Concept.alsoInstanceOf` | `<concept> a owl:NamedIndividual , inv:K` in the OWL file, beside `a skos:Concept` in the SKOS file | owl, skos | the concept is the individual, so one IRI is a concept and an individual and never a class. The typing goes in the OWL file because the SKOS file stays out of the reasoner's closure (decision 28): only there do decision 62's `Currency`/`UnitOfMeasure` disjointness and gist's `gist:Aspect` pairs meet these individuals |
| `Concept.links` | one triple per link, from the concept to the linked concept (`hasDimension`), in the OWL file beside the typing above | owl | 05's V22 |
| `AlignmentRow` with a CURIE object | one `skos:*Match` triple | align | section 3; 11's rules |
| `AlignmentRow` with a named object (`NamedExternalTerm`) | a header line "not projected: name only", and a row of the generated SSSOM | align | section 3, last row; decision 29 |
| `AlignmentRow.justification`, `confidence` | nothing in Turtle; columns of the generated SSSOM | | 11 |
| `Deprecation` (`replacedBy`, `since`, `reason`) | `owl:deprecated true`, the replacement property, `skos:historyNote` with the version; no logical axioms | owl | section 3, deprecated term; decision 33 |
| `TermPointer.term` on a record or a field | a node shape or a property shape | shacl | section 4 |
| `TermPointer.path` (`LiftPath`) | a property shape on the first step with nested node shapes | shacl | section 4, lift path row |
| `TermPointer.noTerm` (`NoTermReason`) | nothing | | gate 5 and the law's rule 1 accept it |
| `TermBinding` | nothing: the projector's join | | gate 5 |

## 4. Mapping rules: record schemas to SHACL

One node shape per record schema that carries a `term`, named after its `identifier`. Several records may point at one
class (`ItemFields`, `StoredItem` and `ItemEdit` all describe an item); each gets its own shape and only one targets
the class (pending Q10). Shapes are SHACL 1.0 Core only: both seeds keep SHACL 1.2 drafts out of the production lane.

| AST construct | Shape triples | Rule |
| --- | --- | --- |
| Record (`Objects`) with `term` naming a class | `shape:R a sh:NodeShape ; sh:name "R" ; sh:description "<description>"@en` and `sh:targetClass <term>` on the one stored record (pending Q10) | `sh:closed true ; sh:ignoredProperties ( rdf:type )` only when every field is projected (pending Q7) |
| Record with `term` naming a property, or a field with `term` naming a class | none | refused: a record is a thing, a field is a relation |
| Field with `term` naming a property | `shape:R-f a sh:PropertyShape ; sh:path <term>` and `shape:R sh:property shape:R-f` | Description from the key's `description`; `messageMissingKey` becomes `sh:message` |
| Field neither optional (`context.isOptional`) nor `NullOr` nor `UndefinedOr` | `sh:minCount 1` | |
| Optional key, `nullAsNone`, `absentAsNone` | no `sh:minCount` | In RDF "null" is the absence of a triple |
| Scalar field (not `Arrays`) | `sh:maxCount 1` | |
| `Arrays` with a rest element | no `sh:maxCount`; `isMinLength(n)` gives `sh:minCount n`, `isMaxLength(n)` gives `sh:maxCount n` | `vendors` gets `sh:maxCount 3`. A list of objects lifts to one node per member, named by position (section 2), so two equal members are two nodes and count twice; a list of scalars is a set, and two equal members are one triple (section 6.5) |
| Tuple (`Arrays` with `elements`) | none | refused: order has no SHACL Core form |
| `String` | `sh:datatype xsd:string` | unless a declaration or `format` below says otherwise |
| `Boolean` | `sh:datatype xsd:boolean` | |
| `Number` with `isInt` | `sh:datatype xsd:integer` | never `xsd:int` (32 bits) for a safe integer; `isInt32` gives `xsd:int` |
| `Number` without `isInt` (`S.Finite`) | `sh:datatype xsd:double` (pending Q6) | never `xsd:integer`: report 02 found beep-effect's shapes map every number to `xsd:integer` |
| `BigInt` | `sh:datatype xsd:integer` | |
| Type side `effect/schema/BigDecimal` over a digits string | `sh:datatype xsd:decimal` plus the encoded side's pattern | the literal's text is the stored digits, never a float; "1.005" stays "1.005" |
| Money (07's `unitCost`, lifted to a `CostObservation` and its `MoneyAmount`) | under decision 59's (a), the lift's last step `minorUnits` with `sh:datatype xsd:integer`, its literal the field's digits at the field's scale ("12.3300" at scale 4 is 123300), a conversion 05's V11 names (`digitsAtScale`), plus `minorUnitScale` fixed at the field's scale; under 59's (c), an `xsd:decimal` amount holding the digits | one rule, never both. The digits are read from the `BigDecimal` string, never a float. The currency is decision 88's (a rule of the item record, never a field's description text), never folded into the number |
| Type side `DateTimeUtc`, or `format: "date-time"` | `sh:datatype xsd:dateTime ; sh:pattern "Z$"` | UTC is stated, as the record writes `DateTime.formatIso` |
| `format: "date"` | `sh:datatype xsd:date` | `IsoDate` carries no format today, so it projects as `xsd:string` with its pattern (Q16) |
| `Literals` | `sh:in ( "a" "b" ... )` in declared order, each literal typed as its value | a field whose term is a scheme lifts each notation to its concept IRI and gets `sh:in ( inv:S-a inv:S-b ... )` with `sh:nodeKind sh:IRI`; gate 4 still requires the `Literals` to equal the scheme's notations (pending Q12; decision 23 recommends the concept IRI, against this document's first answer) |
| One `Literal` | `sh:hasValue` | a union's tag (`kind: "active"`) |
| `Enum` | `sh:in` of its values | |
| `TemplateLiteral` | `sh:pattern` of the template | |
| `isPattern` | `sh:pattern` from the payload's `source` | Rewritten: `\d` becomes `[0-9]` (SHACL's XPath regex `\d` matches any Unicode digit, JavaScript's without `u` only ASCII) and `(?:` becomes `(`. Lookaround and backreference refuse. Flags other than `i`, `m`, `s` refuse. The SKU pattern projects as `^[A-Z]{3}-[0-9]{4}$` |
| `isMinCodePoints`, `isMaxCodePoints` | `sh:minLength`, `sh:maxLength` | exact: SHACL counts characters |
| `isMinLength(n)`, `isMaxLength(n)` on a string | `sh:minLength ceil(n/2)`, `sh:maxLength n` | Effect counts UTF-16 units, SHACL characters; these bounds never refuse what Effect accepts (Effect's JSON Schema does the same, `Schema.ts:8550`) |
| `isGreaterThan`, `isGreaterThanOrEqualTo`, `isLessThan`, `isLessThanOrEqualTo`, `isBetween` (number, BigInt, BigDecimal) | `sh:minExclusive`, `sh:minInclusive`, `sh:maxExclusive`, `sh:maxInclusive` | bound typed with the field's datatype: `quantityOnHand` gets `"0"^^xsd:integer` and `"999999999999"^^xsd:integer` |
| `isUUID` on a field the record names as its subject (pending Q9) | none on a property; the focus node's IRI is minted from it | an id is the node, not a value of it |
| A field with `term` naming an object property | `sh:class <range of the term> ; sh:nodeKind sh:IRI` | the range is the vocabulary's; the AST has no brand to say it |
| A field that fills a datatype property whose vocabulary entry states a datatype | `sh:datatype` the stated type, whatever the leaf rows above give | the literal is converted to it (section 5, rule 8; 05's V11): `quantityOnHand` (`S.Int`) filling 07's `numericValue` (stated `xsd:decimal`, decision 50) gets `sh:datatype xsd:decimal`, never `xsd:integer`, since `sh:datatype` compares the literal's datatype IRI exactly |
| Nested `Objects` under an object property (`dimensions`, `vendors`) | `sh:node shape:R-f-Node`, that node shape built by the same rules | nested shapes are named by path, never by the nested schema's bare identifier (`Active` would collide across records) |
| `Union` of records (`Stocking`) | `sh:xone ( shape:R-f-Active shape:R-f-Inactive shape:R-f-Discontinued )` | each member a node shape with its tag as `sh:hasValue` |
| `Union` of scalars | `sh:or` of datatype constraints | |
| `Suspend` (recursion) | none | refused: SHACL 1.0 leaves recursive shapes undefined |
| A field whose pointer carries a lift path (05's `TermPointer.path`) | `sh:path` the first step (`[ sh:inversePath p ]` for a reversed step), `sh:node shape:R-f-Node`, that node shape holding `sh:class` of the step's node class, one `sh:hasValue` property shape per `fixed` value, and the field's own constraints on the last step | each step must pass 05's V23; a path of more than one step nests one node shape per step, named by path as above |
| Declaration not in this table (`Option`, `Redacted`, `File`, our own) | none | refused, naming record and field |
| A check on a whole record, `makeFilter` without representation, `isMultipleOf`, `isUnique`, `isUniqueKey` | none | written in the file header as "not projected", one line each |
| `examples`, `default`, `readOnly`, `writeOnly`, `title` | none | not data constraints |

What the item would project to, with 07's keys guessed:

```turtle
# sketch, not code: 07's keys; sku and vendors carry lift paths (05)
shape:StoredItem a sh:NodeShape ;
  sh:targetClass inv:ItemSpecification ;
  sh:property shape:StoredItem-sku, shape:StoredItem-vendors .
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

## 5. Determinism: what makes a byte-compare mean something

A byte-compare is a check only if the same inputs always give the same bytes, on any machine, under any locale, and
after a dependency upgrade that changes no meaning.

1. One writer, the projector's own. No library serializer writes the files, so a serializer's new formatting cannot
   change bytes. N3.js is used only to parse them back, a different code path, which is the point of the re-parse.
2. UTF-8 without a byte-order mark, LF line ends, one final LF, no trailing space, every text NFC-normalized.
3. A fixed header: `# GENERATED by bun run ontology:write from <repository-relative module path>. Do not edit.`,
   the version, then the "not projected" lines sorted. No date, time, user, host, absolute path or git commit: a commit
   hash would change on the commit that adds it.
4. Prefixes: only those used, sorted by prefix, taken from one table in the vocabulary module. Never `@base`. A
   local name that is not a valid Turtle local name is written as a full IRI in angle brackets.
5. Subjects in fixed sections (header, annotation property declarations, classes, object properties, datatype
   properties, gist projection; in the SKOS file schemes then concepts; in the SHACL file node shapes then property
   shapes), and within a section sorted by full IRI in code-point order, never `localeCompare`, which depends on ICU
   and the locale.
6. Predicates per subject in one fixed table (`rdf:type`, `skos:prefLabel`, `skos:altLabel`, `skos:definition`,
   `skos:scopeNote`, `rdfs:subClassOf`, `owl:disjointWith`, `rdfs:domain`, `rdfs:range`, `inv:termCategory`,
   `owl:deprecated`, the replacement property; for shapes `sh:targetClass`, `sh:path`, `sh:datatype`, `sh:class`,
   `sh:node`, `sh:nodeKind`, `sh:minCount`, `sh:maxCount`, the four bounds, `sh:minLength`, `sh:maxLength`,
   `sh:pattern`, `sh:flags`, `sh:in`, `sh:hasValue`, `sh:xone`, `sh:or`, `sh:closed`, `sh:ignoredProperties`,
   `sh:property`, `sh:name`, `sh:description`, `sh:message`). A predicate not in the table refuses the projection, so
   a new one is a reviewed change.
7. Several objects of one predicate sorted by their N-Triples form, one per line.
8. One escaping function for strings (`\\`, `\"`, `\n`, `\r`, `\t`, other control characters as `\uXXXX`); never
   long strings in triple quotes. Numbers typed and written by one function per datatype: `xsd:integer` with no sign
   or leading zero, `xsd:decimal` by `BigDecimal.format` as the record does, an integer filling a property whose stated
   datatype is `xsd:decimal` (05's V11) as its digits, a float filling one as ECMAScript's Number-to-String result
   (the shortest digits that read back as the same float) written in plain decimal notation, never with an exponent,
   which is not always the float's exact binary value; `xsd:boolean` as `true` or `false`.
9. No labeled blank node. Every node written has an IRI, property shapes included. The only blank nodes are Turtle
   lists `( ... )` for `sh:in`, `sh:xone`, `sh:or` and `sh:ignoredProperties`, in source order (the order of a
   `Literals` list, of a union's members), and the one-predicate path `[ sh:inversePath p ]` of a reversed lift step,
   written inline where it is used.
10. Disjointness pairwise, once per pair (section 3), so no list is needed in OWL.
11. The version from the module's constant only (pending Q13); never `Clock`, `Date`, git or `package.json` read at
    run time.
12. Effect's `HashMap` and `HashSet` iterate in hash order, which is not an order: every collection becomes a sorted
    array before writing. Records are discovered from module exports and sorted by package path, then export name.
13. Graph identity checked beside the bytes: the re-parse's sorted N-Triples, with list nodes named by their
    position, equal the projector's own triple list. Bytes catch formatting drift; this catches a writer that drops or
    adds a triple while staying stable.

## 6. Gates

Decision 6: byte-compare and re-parse in `bun run check`, an OWL reasoner in `bun run check:full`, SHACL over the
stored rows of the messy sample as a slow test. `bun run check` must not need Java, Python or a network. The other
gates are added where their cost fits.

| # | Gate | Runs in | What it does | What it catches | One bad change it stops |
| --- | --- | --- | --- | --- | --- |
| 1 | Byte-compare | `check` (fast test of the ontology package, turbo `test`) | `project` in memory; each file's bytes equal the committed file | a hand edit; a vocabulary or record change not regenerated; a non-deterministic projector | someone adds `inv:Pallet a owl:Class` to `inventory.owl.ttl` by hand |
| 2 | Re-parse | `check` | N3.js parses each file; triple count and graph identity (rule 13) equal the projector's | invalid Turtle; an escaping bug; a writer that loses a triple | a definition with a double quote written unescaped |
| 3 | Forbidden constructs and namespace | `check` (fast test, and law rules 3 and 4 below) | no `owl:inverseOf`, `owl:sameAs`, `owl:equivalentClass`, external `rdfs:subClassOf` parent, `owl:imports`; every minted IRI under the `example.org` placeholder | a projector change or a vocabulary row that breaks decisions 4 and 7 or report 01's and 02's rules | an `iof-core:` parent given to an item class; a `skos:narrower` written beside `skos:broader` |
| 4 | Vocabulary coherence | `check` (fast test, TypeScript) | every local class reaches a projected gist class; no subclass cycle; no class with two disjoint ancestors; category tags agree with axioms (section 3) and each tag is one 05's V25 admits for the gist class the class reaches; no identity criterion rests on a name or a SKU (05's V18; 04's CQ-I08); one prefLabel and definition `@en`, no empty text; SKOS notation unique per scheme, `skos:broader` acyclic and inside one scheme | unsatisfiable classes from named subclass links and disjointness, orphans, role-as-kind by tag | `MaterialLot` placed under two classes 08 declares disjoint |
| 5 | Record pointers on the AST | `check` (fast test) | every exported contract schema resolves `term` or `noTerm` (Q8) on its AST; every field of a pointed record does (Q7); a field's term is a property, a record's a class; no pointer at a deprecated term; one datatype per datatype property | a helper that drops an annotation; a datatype clash; a record pointing at a retired term | `Vendor.isPreferred` (a boolean) pointed at the date property `inv:discontinuedOn` |
| 6 | Type-check | `check` (`tsc`, `Curie<V>`) | the `term` value must be a CURIE of the vocabulary (report 02) | a term that does not exist | `term: "inv:Organisation"` |
| 7 | `laws ontology-terms` | `check` (root script, section 6.4) | static scan of declarations | a new export with no pointer at all | a new `CarrierAccount` schema exported with no `term` |
| 8 | CQ suite, no reasoning | `check` (fast test) | each CQ's query over OWL plus SKOS plus its fixture; rows equal the expected rows; each CQ also run on its must-fail case | a renamed or re-parented term that a question still names; a constraint that passes on empty data | renaming `inv:isVendor` while CQ queries still use it: zero rows, fail |
| 9 | Reasoner | `check:full` (turbo task `reason`, pending Q2) | OWL 2 DL profile validation of the OWL file; consistency and unsatisfiable classes of the OWL file alone, then of OWL plus each CQ fixture | a profile violation; an inconsistency that needs instances (domain or range typing meeting disjointness) | a fixture `test_Acme inv:baseUnit ...` whose domain types an organization as an item specification, which gist's `Organization` and `Intention` disjointness forbids (decision 15) |
| 10 | CQ suite, reasoned | `check:full` | CQs whose manifest names a reasoning step, run over the reasoner's inferred output | a missing subclass path a question depends on | a class re-parented so it no longer falls under the class a question counts |
| 11 | SHACL over the stored messy sample | slow test (`*.slow.test.ts`, run by `test:slow` in `check:full`) | a fresh D1; `items_messy.csv` imported through Confirm (155 items, as `test/server/Imports.slow.test.ts:69-78` already checks); the rows read back through the item store, encoded by `StoredItem`, lifted (pending Q11); validated: conforms, and exactly 155 focus nodes (non-vacuous); then each projected constraint broken once in an in-memory copy must give a violation | shapes stricter than real data; shapes looser than the schema; a target that selects nothing | the projector maps `S.Int` to `xsd:string` or `unitCost` to `xsd:integer`: 155 violations |
| 12 | Alignment file | `check` (fast test) | every target's namespace is in the prefix table; only `skos:*Match`; every subject is a live `inv:` term | an alignment to a retired term; an unknown prefix | a row aligning a deprecated class |

Stored rows are never changed to reach a must-fail case: the mutation is made to the lifted graph in memory, so the
D1 database holds only what a real import wrote (`CLAUDE.md`, "Look at it").

### 6.1 Reasoner candidates (Q2)

The projector emits, today, only named `rdfs:subClassOf`, pairwise `owl:disjointWith`, `rdfs:domain`, `rdfs:range`,
datatype ranges and annotations. For that set, gate 4's TypeScript check already finds every unsatisfiable class of
the T-box (with no restriction, only two disjoint ancestors can make a class empty), and every axiom is in OWL 2 RL,
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

Recommended: ROBOT with HermiT in `check:full`, gate 4 in `check`. What it needs: a Java pin in the repository and in
CI, and the jar fetched by a script that checks its SHA-256 and keeps it outside the repository. Nothing is downloaded
before Benjamin answers and is told the file, its source and its size.

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

Recommended: N3.js, Oxigraph and shacl-engine, each held to the Effect rules at its edge (`Effect.tryPromise` with a
typed error).

### 6.3 The competency-question suite's form

04 writes the questions (`assets/requirements/competency-questions.yaml`); this is the form the runner reads, decoded
by a Schema in the test.

```yaml
# sketch, not code
- id: CQ-012
  question: Which organizations are both a customer and a vendor?
  kind: select # select | ask | count | constraint
  query: CQ-012.rq
  fixture: CQ-012.ttl # named test_ individuals only, hand-written instance data, no term facts
  expected: CQ-012.csv # header plus rows, compared without the header and sorted
  reasoning: none # none runs in check; rl or dl runs in check:full over the reasoner's output
  mustFail: { remove: ["test_Acme inv:isVendor true"] } # the run on this copy must fail
  antecedent: null # constraint kind only: a query that must return rows, or the pass is vacuous
```

The A-box of a question is its fixture, never the stored rows (those belong to gate 11). A question about parties
uses `test_` fixtures, since the messy sample stores items only (`project-profile.md`).

### 6.4 The `laws ontology-terms` rule

A new command of `@beep/repo-cli`, `bun run beep laws ontology-terms`, with a root script `ontology-terms:check` in
`bun run check`, written like the other laws (oxc syntax tree, files git would commit, the scratchpad left out, a
refusal at the line with the line to write).

1. Every exported declaration in `packages/*/contract/src` whose value is a schema (a call chain from `S.` or
   `Schema.`, or a class extending one) carries `term` or `noTerm` (Q8) in its own `.annotate`, `.pipe(S.annotate`
   or class annotations.
2. Every `Domain.Event`, `Rejection`, `Command`, `Aggregate`, `Decision`, `View`, `Projection`, `Query` and `Stream`
   declared in `packages/*/model/src` carries `term` or `noTerm` in its last argument (section 7).
3. The `term` value is a string literal, so the type-check holds it to `Curie<V>`; a computed value is refused.
4. No code file and no generated ontology file contains `owl:inverseOf` or `owl:sameAs`, outside this law's own
   source and its tests.
5. Every namespace written in the vocabulary module is the `example.org` placeholder or an external prefix of the
   namespace table; none names Sutton.

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
- A version that should have been raised: the byte-compare sees the change, nothing checks the number moved.
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

Typing needs an augmentation of `@alchemy.run/domain`, whose `Annotations` interface has no index signature, before
any block carries a term. For contract schemas, decision 20 recommends 05's typed helpers (`aboutClass`,
`aboutProperty`, `aboutScheme`, `aboutPath`) instead of the `effect/Schema` augmentation below, which is that
decision's other answer:

```ts
// sketch, not code
declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly term?: Curie<typeof InventoryVocabulary> | undefined
      readonly noTerm?: NoTermReason | undefined // pending Q8
    }
  }
}
declare module "@alchemy.run/domain" {
  interface Annotations {
    readonly term?: Curie<typeof InventoryVocabulary>
    readonly noTerm?: NoTermReason
  }
}
```

Effect's interface has an index signature (`Schema.ts:19313-19315`), so without the augmentation any `term` string
type-checks; `Domain.Annotations` has none (`Annotations.ts:27-53`), so without it a `term` key is a type error. Which
term an event or an aggregate points at is 09's (likely gist `Event` subclasses for events, an information term for the
import); whether a command points at a term or takes `noTerm: "request"` is 09's too.

## Questions for Benjamin

Moved on 2026-11-22 to the packet's [DECISIONS.md](../DECISIONS.md), "Open", merged with the other reports'
questions. A "(pending Qn)" mark in this report means: Q1 is decision 9, Q2 is 25, Q3 is 26, Q4 is 11, Q5 is 19,
Q6 is 50, Q7 is 22, Q8 is 21, Q9 is 10, Q10 is 48, Q11 is 49, Q12 is 23, Q13 is 24, Q14 is 33, Q15 is 28, Q16 is
51.

## Not checked

- No projector, writer, shape, query or gate was written or run. Every gate here is "not built".
- Whether a `term` given with `annotateKey` inside `nullAsNone` and `decodeTo` chains is found where section 1.2 says
  on the AST; whether `S.toTaggedUnion` keeps member identifiers; whether `toRepresentation` would be a simpler input
  than the live AST.
- Whether the Effect and Alchemy augmentations in section 7 type-check together on an event's annotations, and
  whether a `term` key in a block's annotations changes what Verify reads.
- Whether ROBOT runs on Java 27; the size of the ROBOT jar; whether ELK, HermiT or Openllet versions named in the seeds
  are current. Nothing was downloaded.
- Whether N3.js, Oxigraph, shacl-engine, EYE or Comunica run under this repository's Vitest and Effect rules; none is
  installed. shacl-engine's SHACL Core coverage is its own claim, not checked.
- The XPath against JavaScript regex claims (`\d`, `(?:`) were not tried on an engine.
- The contract export count (about 150) is a grep, not a list of schemas.
- 04 to 11 were being written at the same time and were not read by this report's author; the keys were matched with
  them on 2026-11-22 (report 13), and section 3.1 was added from 05 as it stands after that date. No rule here was run.
- The beep-effect fold's `xsd:integer` mapping is report 02's finding, not opened again.
- No public Sutton document was read for this report; no Sutton fact is used beyond report 01's.
