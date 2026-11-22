---
type: Research
title: The term model of the vocabulary module
description: The vocabulary module's metamodel as Effect Schema sketches, with its rules, IRI and version forms, and where it could live.
---

# The term model of the vocabulary module

Report 02 decided that one hand-written TypeScript module owns every term fact, that record schemas carry a typed
pointer to a term, and that all Turtle is generated (decisions 2 and 5). This report designs the module's own shape:
the kinds of entry it holds, the fields of each, the rules a check can hold them to, and how a record points at a
term. It is a proposal for Benjamin to argue with. Nothing here is built, and no code file was written.

What this report does not own: the domain terms themselves. Parties and access are report 06's (`Organization`,
`Person`, `isCustomer`), items and values report 07's (`ItemSpecification`, `QuantityValue`), stock report 08's,
commitments and events report 09's, the schemes' contents report 10's (`ItemRoleScheme`), the list of projected gist
terms and the alignment rows' contents report 11's, the projector and the checks that run the rules below report
12's, and the competency questions report 04's. Their terms appear here by the keys report 13 settled.

On 2026-11-22 the model was widened so it can hold every row 04 and 06 to 12 wrote (section 10 lists what each
needed), and its open questions moved to the packet's [DECISIONS.md](../DECISIONS.md) ("Questions for Benjamin" maps
each Qn to its decision number).

Inputs: the project profile, the packet's decisions 1 to 7, reports 01 and 02, `gist-categories.md`,
`naming-conventions.md`, `anti-patterns.md` and `foundational-analysis.md`, the architecture seed (its sections on
the namespace contract, taxonomy governance and the correspondence register), the API design report (its namespace
and taxonomy sections), the vendored `@beep/identity` (`Vocab.ts`, `Curie.ts`), the contract packages of catalog and
access, `docs/standards/schema-first.md` and `effect-imports.md`, the repository's `laws boundaries` rule, and the
installed Effect 4.1.5 source. Every Effect name in the sketches was found in `node_modules/effect/src`; no sketch
was compiled.

## 1. Three things that must stay apart

Report 01 separates the referent, the record and the representation. The module adds a fourth thing and a join:

| Thing | What it is | Home | Example |
| --- | --- | --- | --- |
| Term | What the ontology says a thing is: IRI, label, definition, parent, tag, scheme, alignment | the vocabulary module | `inv:Organization` (06's) |
| Record | What the app stores or sends about a thing, with its required fields, datatypes and patterns | a contract package's Effect Schema | `StoredItem`, `Person` |
| Pointer | The annotation on a record or a field that names the one term it stands for | the record schema | `term: "inv:ItemSpecification"` on `StoredItem` |
| Binding | The pair of a term and a record whose pointer names it | computed by the projector, never written | (`ItemSpecification`, `StoredItem`) |

The pointer is the only hand-written home of "which record stands for which term". A term entry never lists its
records, so renaming a record changes one file, and a term with no record is an ordinary entry with no bindings.

The entries below describe the ontology; they are not classes of it. Under the recommended answer to Q1 they mint no
IRI: each projects onto an OWL, SKOS or SSSOM built-in (`owl:Class`, `skos:Concept`, a mapping row). The Key column
of the terms table is the schema's name in the module; it would become an IRI local name only under Q1's option B.

## 2. Terms of the metamodel

| Key | Label | Definition | Tag | gist parent | Identity | Source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Vocabulary | Vocabulary | A hand-written TypeScript module that states one namespace, its version, the prefixes it may cite and every term under that namespace. | information | none: metamodel element, projected as the `owl:Ontology` header, never a class of the domain (pending Q1) | its namespace IRI: one module per namespace | `explorations/erp-ontology/research/02-schema-as-source.md` (verdict) | later (pending Q1, Q7) |
| Term | Term | An entry of a Vocabulary that names one thing the ontology speaks of and holds its label, definition, source, scope and ratification. | category | none: metamodel element (pending Q1) | n/a | report 02 ("A term exists: IRI, label, definition") | later |
| ClassTerm | Class term | A Term that names one OWL class and gives it exactly one parent link, a kind tag and an identity criterion. | information | none: projects to `owl:Class` (pending Q1) | its key within the Vocabulary's namespace | report 02; project profile, decision 2 | later |
| ObjectPropertyTerm | Object property term | A Term that names a relation, stated in one direction only, from instances of one class to instances of a class or to concepts of one scheme. | information | none: projects to `owl:ObjectProperty` (pending Q1) | its key | report 02 ("Object property domain and range"); project profile (no `owl:inverseOf`) | later |
| DatatypePropertyTerm | Datatype property term | A Term that names an attribute of instances of one class, whose literal datatype is read from the record fields that fill it. | information | none: projects to `owl:DatatypeProperty` (pending Q1) | its key | report 02 ("A datatype property's range is read from the field that fills it") | later |
| ConceptScheme | Concept scheme | A Term that names one closed code list: an ordered, non-empty list of Concepts whose notations a record stores. | information | none: projects to `skos:ConceptScheme`; a code list is never a class (`gist-categories.md`, step 8) | its key | report 02; the architecture seed, section 6 | later |
| Concept | Concept | A Term held inside one ConceptScheme that gives one code its notation, label, definition, at most one broader code of the same scheme, and, where the code is also a thing a class counts, that class and its links to concepts of other schemes. | information | none: projects to `skos:Concept`, an individual, also typed by its class when it has one | its scheme's key and its notation (pending Q2) | the architecture seed, section 6; the API design report, section 5 (the notation binds the enum string) | later |
| DisjointGroup | Disjoint group | A Vocabulary entry that lists two or more ClassTerms of which no instance can belong to two at once. | information | none: projects to pairwise `owl:disjointWith` | the set of its member keys, in any order | the architecture seed (`owl:AllDisjointClasses` over the item definitions); project profile (disjointness is the module's) | later |
| AlignmentRow | Alignment row | A Vocabulary entry that records one reviewed correspondence from a local Term to a term of another vocabulary, with its predicate, source, confidence and ratification. | information | none: projects to one SKOS mapping triple; an alignment is never a parent | its subject, predicate and object together | report 02 (beep-effect's `ConceptAlignment`, "take"); the architecture seed (`MappingAssertion`, the correspondence register) | later |
| AlignmentPredicate | Alignment predicate | A value from the closed list of SKOS mapping relations an AlignmentRow may state. | value | none: a code of the metamodel | the literal | project profile ("`skos:*Match` predicates only") | later |
| KindTag | Kind tag | A value from a closed list that records which ontological category the instances of a ClassTerm fall under. | value | none: a code of the metamodel | the literal | project profile ("kind or role tag"); `foundational-analysis.md` | later (pending Q12) |
| ParentLink | Parent link | A value that gives a ClassTerm its one identity-bearing parent: a projected gist class, a local ClassTerm, or no parent with the reason. | value | none: a code of the metamodel | its contents | `gist-categories.md` ("Every local top class has one parent") | later (pending Q8) |
| CategoryParent | Category parent | A value that names a local ClassTerm tagged category under which a ClassTerm also falls, beside its one parent link, without taking an identity from it. | value | none: a code of the metamodel | the key it names | NEW: 06's `Party` sits over `Person` and `Organization`, which keep their gist parents (pending Q8) | later (pending Q8) |
| ClassTarget | Class target | A value that names the class whose instances a property relates: a local ClassTerm, a projected gist class, or none declared with the reason. | value | none: a code of the metamodel | its contents | NEW: 06 to 10 write domains of all three kinds (`gist:Intention`, `gist:Event`, "none declared: shared by several records") | later |
| RangeTarget | Range target | A value that names what an object property's values are: instances of a class target, or concepts of one or more named schemes. | value | none: a code of the metamodel | its contents | NEW: 09's `hasReason` and 10's `lifecycleState` range over concepts of several schemes | later |
| LiftPath | Lift path | A value, carried by a field's term pointer, that says how one flat field becomes a small graph: the properties walked in order, each forward or reversed, the class of each node passed, and the values fixed on it. | value | none: a code of the metamodel | its steps | NEW: 07 and 08 point fields at paths (`sku` through `identifiedBy` to `identifierText` with the kind `sku`; `vendors` through the reverse of `offeredItem`; `quantityOnHand` to an `InventoryMeasure`) | later (pending Q6) |
| NoTermReason | No-term reason | A value from a closed list that says why an exported record schema stands for no term: transport, request, screen, error or bookkeeping. | value | none: a code of the metamodel | the literal | report 12 (its Q8, the closed list) | later |
| IdentityCriterion | Identity criterion | A value that says what makes two instances of a ClassTerm the same one, that it is inherited from the parent, that it does not apply, or that it is open and names the question. | value | none: a code of the metamodel | its contents | project profile (identity card, `unresolved`); report 01, section 3 | later |
| Deprecation | Deprecation | A value that marks a Term as retired from a given version, with the Term that replaces it or the reason none does. | value | none: a code of the metamodel | its contents | the architecture seed, section 4.2 ("Deprecate a term when its meaning is replaced"); `naming-conventions.md` | later (pending Q4) |
| TermSource | Term source | A value that names where a Term's meaning comes from: a seed report, a repository file, a public Sutton document (read directly or as a seed cites it), a published standard, or a new need with its reason. | value | none: a code of the metamodel | its contents | this packet's term-table rule (the Source column); 06 and 11 cite W3C ORG, schema.org, IBM MDM, EPCIS and QUDT pages they fetched | later |
| TermScope | Term scope | A value from a closed list that says whether a Term is held by a record in the repository today, met only in Sutton, or wanted later. | value | none: a code of the metamodel | the literal | NEW: turns the Status column of every term table into a fact a check can compare with the bindings | later |
| Ratification | Ratification | A value that names the ratification record in which the steward accepted a Term or an AlignmentRow. | value | none: a code of the metamodel | the record's name | project profile ("A ratification is Benjamin's answer, scribed in a `rat-` file") | later (pending Q10) |
| PrefixEntry | Prefix entry | A Vocabulary entry that binds a prefix to a namespace IRI and says whether its terms are local, projected from gist, or cited by alignment only. | information | none: projects to a `@prefix` line and nothing else | its prefix; its IRI is unique too | `packages/foundation/modeling/identity/src/Vocab.ts` (`VocabEntry`); `.agents/skills/_shared/namespaces.json` | in the repository today (as `VocabEntry`, without the use) |
| NamedExternalTerm | Named external term | A value that cites a term of a standard with no RDF namespace by the standard's name, the term's name and a public document. | value | none: has no IRI to project | its standard and term name | project profile (no prefix for ISA-95 or Sutton; how a Sutton term is cited is open) | later (pending Q11) |
| TermPointer | Term pointer | A value carried in the annotations of a record schema or of one of its fields that names, by a CURIE the type-check knows, the one Term the record or field stands for. | value | none: never projected as a triple; read by the projector and the checks | its CURIE | report 02 (`term` annotation typed by `Curie<V>`) | later (pending Q6) |
| TermBinding | Term binding | A derived pair of one Term and one record schema or field whose TermPointer names it, computed from the contract packages and never written by hand. | information | none: never projected; the projector's join | its Term key with the record's identifier and field path | NEW: the one place where "one term, several records" and "a term with no record" are both visible | later |
| VocabularyVersion | Vocabulary version | A value that numbers one state of a Vocabulary as major, minor and patch, written in the module and never read from the clock. | value | none: a code of the metamodel | its three numbers | project profile (the header's version "never the clock"); decision 6 (byte-compare) | later (pending Q5) |

## 3. Properties of the metamodel

Each row is a field of a schema in section 4. "Datatype from the record field" names the metamodel schema that
holds it.

| Key | Label | Definition | Domain | Range | Source |
| --- | --- | --- | --- | --- | --- |
| key | key | The local name a Term's IRI ends with, written as the entry's key in the module. | Term | datatype from the record field (`ClassKey`, `PropertyKey` or `SchemeKey`) | report 02; `naming-conventions.md` |
| prefLabel | preferred label | The one English name of a Term for people, written by hand and never derived from its key. | Term | datatype from the record field (`Label`) | `naming-conventions.md` (pending Q3) |
| altLabel | alternative label | Another English name people use for a Term, such as a trade word or an expanded abbreviation. | Term | datatype from the record field (`Label`) | `naming-conventions.md` ("Synonyms") |
| definition | definition | The sentence that says what a Term means, its genus first and then its difference. | Term | datatype from the record field (`Definition`) | `naming-conventions.md` (pending Q3) |
| scopeNote | scope note | A sentence that says where a Term applies, or how it must not be read. | Term | datatype from the record field (`Definition`) | the architecture seed, section 6 ("definition or scope note") |
| source | source | Where a Term's meaning comes from. | Term | TermSource | this packet's term-table rule |
| scope | scope | Whether a Term is held by a record today, met only in Sutton, or wanted later. | Term | TermScope | NEW: makes the Status column checkable |
| ratification | ratification | The record in which the steward accepted a Term or an AlignmentRow. | Term | Ratification | project profile (pending Q10) |
| deprecation | deprecation | The retirement of a Term, when it is retired. | Term | Deprecation | the architecture seed, section 4.2 |
| parent | parent | The one class a ClassTerm's class is a subclass of, or the stated reason it has none. | ClassTerm | ParentLink | `gist-categories.md` (pending Q8) |
| categoryParents | category parents | The local category classes a ClassTerm's class also falls under, beside its one parent. | ClassTerm | CategoryParent | NEW: 06's `Party` (pending Q8) |
| kindTag | kind tag | The ontological category a ClassTerm's instances fall under. | ClassTerm | KindTag | project profile (pending Q12) |
| identity | identity criterion | What makes two instances of a ClassTerm the same one. | ClassTerm | IdentityCriterion | project profile (identity card) |
| member | member | A ClassTerm a DisjointGroup lists. | DisjointGroup | ClassTerm | the architecture seed (`owl:members`) |
| domain | domain | The class whose instances are the subjects of a property, or none declared with the reason. | ObjectPropertyTerm or DatatypePropertyTerm | ClassTarget | report 02; 06, 08 and 09 ("none declared: shared") |
| range | range | The class whose instances, or the schemes whose concepts, are the values of an object property. | ObjectPropertyTerm | RangeTarget | report 02; 09 and 10 (several schemes) |
| datatype | datatype | The literal datatype of a datatype property: read from the leaf of every field that fills it, or stated in the module when the property's fields have different leaves that each convert to it without loss, or while no field fills it. | DatatypePropertyTerm | datatype from the record field (derived, or stated) | report 02; 07 (`numericValue` is filled by integers and by floats; "no record yet: an exact decimal") |
| concept | concept | A Concept a ConceptScheme holds, in the order a screen lists them. | ConceptScheme | Concept | the architecture seed, section 6 |
| notation | notation | The code a record stores for a Concept, unique in its scheme and never changed. | Concept | datatype from the record field (`Notation`) | the API design report, section 5 |
| alsoInstanceOf | also instance of | The class of which a Concept is also an individual, such as a unit of measure or a member role. | Concept | ClassTerm | NEW: 07, 06 and 10 (units and roles, pending decisions 61 and 41) |
| conceptLinks | concept links | Values of object properties that a Concept holds as an individual of its class, each naming a concept of another scheme. | Concept | Concept | NEW: 10's `hasDimension` from a unit to its measurement dimension |
| closed | closed | Whether a scheme lists every value a record of this repository may hold, so an unknown value goes to a person. | ConceptScheme | datatype from the record field (`S.Boolean`) | 10, rule 5 |
| broader | broader | The one Concept of the same scheme that a Concept narrows. | Concept | Concept | the architecture seed, section 6 |
| alignmentSubject | subject | The local Term an AlignmentRow speaks of. | AlignmentRow | Term | report 02 (`ConceptAlignment`) |
| alignmentPredicate | predicate | The SKOS mapping relation an AlignmentRow states. | AlignmentRow | AlignmentPredicate | project profile |
| alignmentObject | object | The external term an AlignmentRow points at: a CURIE under a known prefix, or a named external term. | AlignmentRow | NamedExternalTerm, or datatype from the record field (`AlignmentCurie`) | project profile (pending Q11) |
| alignmentSource | justification | The document that shows an AlignmentRow's correspondence holds. | AlignmentRow | TermSource | the architecture seed ("Store the match evidence, reviewer, confidence") |
| confidence | confidence | How sure the proposer was that an AlignmentRow's correspondence holds. | AlignmentRow | datatype from the record field (`Confidence`, pending Q9) | the architecture seed; SSSOM's `confidence` column |
| replacedBy | replaced by | The Term of the same metatype that takes a deprecated Term's place. | Deprecation | Term | the architecture seed, section 6 ("replacement policy") |
| since | deprecated since | The version from which a Term is deprecated. | Deprecation | VocabularyVersion | NEW: a deprecation must say when, and the clock is not allowed |
| reason | reason | Why a Term is retired, required when nothing replaces it. | Deprecation | datatype from the record field (`Definition`) | `naming-conventions.md` ("status note") |
| term | term | The Term a record schema or a field stands for. | TermPointer | Term | report 02 |
| path | path | The lift path a field's value follows into the graph, when it is not the value of one property of the record's subject. | TermPointer | LiftPath | NEW: 07, 08 (pending Q6) |
| noTerm | no term | The reason an exported record schema stands for no term. | TermPointer | NoTermReason | report 12 |
| record | record | The identifier of the record schema, with the field path for a field, that carries a TermPointer. | TermBinding | datatype from the record field (derived from the schema's `identifier` annotation) | NEW: names the record side of a binding |
| namespace | namespace | The IRI that every local key is appended to, written once. | Vocabulary | datatype from the record field (`Namespace`) | decision 7; naming-conventions.md |
| version | version | The VocabularyVersion a Vocabulary is at. | Vocabulary | VocabularyVersion | project profile (pending Q5) |
| prefix | prefix | The short name a CURIE starts with. | PrefixEntry | datatype from the record field (`Prefix`) | `Vocab.ts` (`VocabShape` keys) |
| prefixUse | use | Whether a prefix's terms are local, projected from gist, or alignment-only. | PrefixEntry | datatype from the record field (`PrefixUse`) | decision 4 (gist is the only parent) |

What each field becomes in the generated Turtle (the projector is report 12's; this is the contract it reads):

| Field | Emitted as | Never emitted |
| --- | --- | --- |
| `Vocabulary.namespace`, `version` | the `owl:Ontology` header with `owl:versionIRI` and `owl:versionInfo` (pending Q5) | a clock date, `prov:generatedAtTime` |
| `ClassTerm` | `inv:K a owl:Class` | |
| `prefLabel`, `definition` | `skos:prefLabel "…"@en`, `skos:definition "…"@en` (pending Q3) | `rdfs:label` while Q3 is open |
| `altLabel`, `scopeNote` | `skos:altLabel`, `skos:scopeNote` | |
| `parent`, `categoryParents` | `rdfs:subClassOf` the gist class or the local class, one triple each; nothing for a `none` link | the reason, which stays in the module |
| `kindTag`, `identity`, `source`, `scope`, `ratification` | nothing under Q1's recommended answer (they would need annotation properties with IRIs; report 12's `inv:termCategory` is the other answer) | |
| `DisjointGroup` | `owl:disjointWith` once per unordered pair of its members (report 12, section 5, rules 9 and 10: no blank node but a list) | `owl:AllDisjointClasses`, which needs a blank subject |
| `ObjectPropertyTerm` | `owl:ObjectProperty`, `rdfs:domain` and `rdfs:range` when declared (a local or gist class; a scheme range writes no `rdfs:range`, and the record's SHACL `sh:in` holds it, as 10 section 6 and 12 say) | `owl:inverseOf`, any characteristic; a domain or range written "none declared" |
| `DatatypePropertyTerm` | `owl:DatatypeProperty`, `rdfs:domain` when declared, `rdfs:range` the xsd type of its fields' leaf or its stated datatype | `rdfs:range` when no field fills it and none is stated |
| `ConceptScheme`, `Concept` | `skos:ConceptScheme`; `skos:Concept`, `skos:inScheme`, `skos:notation`, `skos:broader`, and `skos:topConceptOf` when it has no broader | `skos:narrower`, `skos:hasTopConcept` (one direction only) |
| `alsoInstanceOf`, `conceptLinks` | `<concept> a owl:NamedIndividual , inv:K`, and one triple per link, in the OWL file, so the reasoner's closure holds them (decision 28 keeps the SKOS file out of it, and decision 62's disjointness and gist's `gist:Aspect` pairs must meet these individuals) | a second IRI for the individual: the concept is the individual |
| `closed` | nothing: it guides the import and the review, and the record schema's `sh:in` carries the closure | |
| `TermPointer.path` | nothing in OWL; SHACL property shapes along the path (report 12, section 3.1) | |
| `AlignmentRow` with a CURIE object | one `skos:*Match` triple | `owl:sameAs`, `owl:equivalentClass` |
| `AlignmentRow` with a named object | nothing in Turtle; a row in the generated SSSOM (report 11) | a minted IRI under Sutton's or ISA-95's name |
| `Deprecation` | `owl:deprecated true`, the replacement and the version (pending Q4) | |
| `TermPointer`, `TermBinding` | nothing: the projector's join | |

## 4. The schemas

All of this section is a sketch, not code. The paths assume Q7's recommended answer: the metamodel in a new
foundation package `@beep/vocabulary`, the inventory's terms in `@inventory/kernel`. `$I` is the package's identity
composer, as in `Vocab.ts`. Imports follow `effect-imports.md`.

### 4.1 Keys, text and the small values

```ts
// sketch, not code: packages/foundation/modeling/vocabulary/src/Term.schema.ts
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { $VocabularyId } from "./internal/identity.ts"

const $I = $VocabularyId.create("Term")

/** A class key: the local name of a class IRI, UpperCamelCase, acronyms written as words (Bom, Gtin, Id). */
export const ClassKey = S.String.check(S.isPattern(/^[A-Z][A-Za-z0-9]{0,63}$/)).pipe(
  $I.annoteSchema("ClassKey", { description: "The local name of a class IRI, UpperCamelCase" })
)
/** A scheme key: a class-shaped key that ends in "Scheme", so no scheme can share a class's IRI. */
export const SchemeKey = S.String.check(S.isPattern(/^[A-Z][A-Za-z0-9]{0,57}Scheme$/)).pipe(
  $I.annoteSchema("SchemeKey", { description: "The local name of a concept scheme IRI, ending in Scheme" })
)
/** A property key: lowerCamelCase, never an RDF keyword such as domain, range, label or type. */
export const PropertyKey = S.String.check(
  S.isPattern(/^[a-z][A-Za-z0-9]{0,63}$/),
  S.isPattern(/^(?!(domain|range|label|type|comment|subClassOf)$)/, { expected: "a key that is not an RDF keyword" })
).pipe($I.annoteSchema("PropertyKey", { description: "The local name of a property IRI, lowerCamelCase" }))
/** A notation: the code a record stores, safe in an IRI path, as today's codes are (EA, raw-materials, viewer). */
export const Notation = S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/)).pipe(
  $I.annoteSchema("Notation", { description: "The code a record stores for one concept" })
)
export const Label = S.Trimmed.check(S.isMinLength(1), S.isMaxLength(80)).pipe(
  $I.annoteSchema("Label", { description: "A name for people, in English" })
)
export const Definition = S.Trimmed.check(S.isMinLength(12), S.isMaxLength(400)).pipe(
  $I.annoteSchema("Definition", { description: "One sentence: the genus, then the difference" })
)

export const KindTag = LiteralKit([
  "kind", "subkind", "role", "phase", "relator", "event", "information", "category", "value"
]).pipe($I.annoteSchema("KindTag", { description: "The ontological category a class's instances fall under" }))

export const TermScope = LiteralKit(["repository", "sutton", "later"]).pipe(
  $I.annoteSchema("TermScope", { description: "Held by a record today, met only in Sutton, or wanted later" })
)

/** The steward's acceptance: the name of a rat- record under the auditor's governance folder. */
export const Ratification = S.String.check(S.isPattern(/^rat-[a-z0-9-]{1,80}$/)).pipe(
  $I.annoteSchema("Ratification", { description: "The ratification record in which the steward accepted it" })
)
```

`TermSource`, `ParentLink`, `IdentityCriterion` and the alignment object are finite sets of cases that carry data,
so each is a tagged union closed with `LiteralKit(...).mapMembers(...).pipe(S.toTaggedUnion("kind"))` (SF-6). One is
written out; the others have the same form.

```ts
// sketch, not code: the same file
const ParentKind = LiteralKit(["gist", "local", "none"])

class GistParent extends S.Opaque<GistParent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("gist"),
    term: GistCurie.pipe(S.annotateKey({ description: "A gist class the projection takes (report 11's list)" }))
  }).pipe($I.annoteSchema("GistParent", { description: "A local top class under one projected gist class" }))
) {}
class LocalParent extends S.Opaque<LocalParent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("local"),
    key: ClassKey.pipe(S.annotateKey({ description: "The local class this one narrows" }))
  }).pipe($I.annoteSchema("LocalParent", { description: "A subclass of a local class" }))
) {}
class NoParent extends S.Opaque<NoParent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("none"),
    reason: Definition.pipe(S.annotateKey({ description: "Why no projected gist class fits, as put to Benjamin" }))
  }).pipe($I.annoteSchema("NoParent", { description: "A top class with no gist parent, and why" }))
) {}

export const ParentLink = ParentKind.mapMembers(() => Tuple.make(GistParent, LocalParent, NoParent)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ParentLink", { description: "A class's one parent, or the stated reason it has none" })
)

// The same form, cases only:
// TermSource:        seed { seed: "architectureSeed" | "apiDesignReport", section } | repository { path }
//                    | suttonPublic { url, title } | new { reason }
// IdentityCriterion: stated { criterion, restsOn: Array<PropertyKey> } | inherited {} | notApplicable {}
//                    | unresolved { question, reidentifiedBy }   (restsOn: the facts the criterion reads, for V18;
//                      reidentifiedBy: the key a record is found again by, the project profile's reidentification key)
// AlignmentObject:   curie { curie: AlignmentCurie } | named { standard: "ISA-95" | "Sutton", name, document }
```

`GistCurie` is the generic shape `gist:` plus an UpperCamel name at this level; the module narrows it to the closed
list of projected gist classes (section 4.7), so `{ kind: "gist", term: "gist:Organisation" }` is a type error there.

The same form gives the targets a property names (sketch, not code):

```ts
// ClassTarget:  local { key: ClassKey } | gist { term: GistCurie } | none { reason }
// RangeTarget:  ClassTarget's three cases | schemes { keys: NonEmptyArray<SchemeKey> }
// CategoryParent: a ClassKey whose entry is tagged "category" (rule V21)
// TermRef:      class { key: ClassKey } | property { key: PropertyKey } | scheme { key: SchemeKey }
//               | concept { scheme: SchemeKey, notation: Notation }   (a reference to one local term, used by
//               Concept.links and AlignmentRow.subject)
```

### 4.2 The common fields, ClassTerm and DisjointGroup

```ts
// sketch, not code: the same file
const termFields = {
  prefLabel: Label.pipe(S.annotateKey({ description: "The one name people read" })),
  altLabels: S.Array(Label).pipe(
    S.annotateKey({ description: "Other names people use for it" }),
    S.withConstructorDefault(Effect.succeed([])),
    S.withDecodingDefaultTypeKey(Effect.succeed([]))
  ),
  definition: Definition.pipe(S.annotateKey({ description: "What it means: genus, then difference" })),
  scopeNote: Definition.pipe(
    S.annotateKey({ description: "Where it applies, when that needs saying" }),
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone)
  ),
  source: TermSource.pipe(S.annotateKey({ description: "Where its meaning comes from" })),
  scope: TermScope.pipe(S.annotateKey({ description: "Held by a record today, Sutton only, or later" })),
  ratification: Ratification.pipe(S.annotateKey({ description: "The record of the steward's acceptance" })),
  deprecation: Deprecation.pipe(
    S.annotateKey({ description: "Its retirement, when it is retired" }),
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone)
  )
} as const

export class ClassTerm extends S.Opaque<ClassTerm, { readonly brand: unique symbol }>()(
  S.Struct({
    ...termFields,
    parent: ParentLink.pipe(S.annotateKey({ description: "Its one parent, or why it has none" })),
    categoryParents: S.Array(ClassKey).pipe(
      S.annotateKey({ description: "Local category classes it also falls under (pending Q8)" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    tag: KindTag.pipe(S.annotateKey({ description: "The category its instances fall under" })),
    identity: IdentityCriterion.pipe(S.annotateKey({ description: "What makes two instances the same one" }))
  }).pipe($I.annoteSchema("ClassTerm", { description: "One OWL class of the ontology" }))
) {}

export class DisjointGroup extends S.Opaque<DisjointGroup, { readonly brand: unique symbol }>()(
  S.Struct({
    members: S.Array(ClassKey.pipe(S.annotateKey({ description: "One class of the group" }))).check(
      S.isMinLength(2)
    ).pipe(S.annotateKey({ description: "Classes no instance belongs to two of at once" })),
    ratification: Ratification.pipe(S.annotateKey({ description: "The record of the steward's acceptance" }))
  }).pipe($I.annoteSchema("DisjointGroup", { description: "Classes that share no instance" }))
) {}
```

Disjointness is a group, not a `disjointWith` field on each class: a symmetric fact written on both sides has two
homes, and written on one side it is invisible from the other. The key is not a field: in the module a term is the
value of its key in a record (section 4.6), so two entries with one key cannot both exist.

### 4.3 The two property terms

```ts
// sketch, not code: packages/foundation/modeling/vocabulary/src/Property.schema.ts
// ClassTarget and RangeTarget as in 4.1; XsdLeaf is LiteralKit(["string", "boolean", "integer", "decimal", "double",
// "date", "dateTime"]), the leaves report 12's section 4 maps to.

export class ObjectPropertyTerm extends S.Opaque<ObjectPropertyTerm, { readonly brand: unique symbol }>()(
  S.Struct({
    ...termFields,
    domain: ClassTarget.pipe(S.annotateKey({ description: "The class of the relation's subjects, or none and why" })),
    range: RangeTarget.pipe(S.annotateKey({ description: "The class of its values, or the schemes they come from" }))
  }).pipe($I.annoteSchema("ObjectPropertyTerm", { description: "A relation, stated in one direction only" }))
) {}

export class DatatypePropertyTerm extends S.Opaque<DatatypePropertyTerm, { readonly brand: unique symbol }>()(
  S.Struct({
    ...termFields,
    domain: ClassTarget.pipe(S.annotateKey({ description: "The class whose instances have this attribute" })),
    datatype: XsdLeaf.pipe(
      S.annotateKey({ description: "Stated only when no field fills it, or its fields' leaves differ (V11)" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    )
  }).pipe($I.annoteSchema("DatatypePropertyTerm", {
    description: "An attribute whose datatype is read from the record fields that fill it"
  }))
) {}
```

There is no `inverseOf` field, so none can be written; a datatype property's `datatype` is written only where V11
allows it. A field whose
value is a notation of a scheme fills an object property with a scheme range: the record stores `"buy"`, the
projector writes the concept's IRI. That replaces report 02's separate `references` annotation for id fields too: an
id field fills an object property, and the property already holds its range.

### 4.4 ConceptScheme and Concept

```ts
// sketch, not code: packages/foundation/modeling/vocabulary/src/Scheme.schema.ts
export class Concept extends S.Opaque<Concept, { readonly brand: unique symbol }>()(
  S.Struct({
    notation: Notation.pipe(S.annotateKey({ description: "The code a record stores; never changes" })),
    ...termFields,
    broader: Notation.pipe(
      S.annotateKey({ description: "The concept of the same scheme this one narrows" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    alsoInstanceOf: ClassKey.pipe(
      S.annotateKey({ description: "The class this code is also an individual of, such as UnitOfMeasure" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    links: S.Record(PropertyKey, TermRef).pipe(
      S.annotateKey({ description: "Object property values it holds as that individual (hasDimension: count)" }),
      S.withConstructorDefault(Effect.succeed({})),
      S.withDecodingDefaultTypeKey(Effect.succeed({}))
    )
  }).pipe($I.annoteSchema("Concept", { description: "One code of a concept scheme" }))
) {}

export class ConceptScheme extends S.Opaque<ConceptScheme, { readonly brand: unique symbol }>()(
  S.Struct({
    ...termFields,
    closed: S.Boolean.pipe(S.annotateKey({ description: "Every value a record here may hold is listed" })),
    concepts: S.NonEmptyArray(Concept).pipe(
      S.annotateKey({ description: "Its codes, in the order a screen lists them" })
    )
  }).pipe($I.annoteSchema("ConceptScheme", { description: "One closed code list" }))
) {}
```

`broader` names a notation of the same scheme, never another scheme's concept: a cross-scheme link is an alignment
row or a property, not a hierarchy. A source system's spelling ("each" for `EA`) is not an `altLabel`: reading it is a
record rule of the import (decision 2), and an `altLabel` is a name people use.

### 4.5 AlignmentRow

```ts
// sketch, not code: packages/foundation/modeling/vocabulary/src/Alignment.schema.ts
export const AlignmentPredicate = LiteralKit(["exactMatch", "closeMatch", "broadMatch", "narrowMatch", "relatedMatch"])
  .pipe($I.annoteSchema("AlignmentPredicate", { description: "The SKOS mapping relation a row states" }))

/** 0 to 1, as SSSOM writes it (pending Q9). */
export const Confidence = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })).pipe(
  $I.annoteSchema("Confidence", { description: "How sure the proposer was, from 0 to 1" })
)

export class AlignmentRow extends S.Opaque<AlignmentRow, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: TermRef.pipe(S.annotateKey({ description: "The local term: a key, or a scheme key and a notation" })),
    predicate: AlignmentPredicate.pipe(S.annotateKey({ description: "The mapping relation" })),
    object: AlignmentObject.pipe(S.annotateKey({ description: "A CURIE under a known prefix, or a named term" })),
    justification: TermSource.pipe(S.annotateKey({ description: "The document that shows it holds" })),
    confidence: Confidence.pipe(S.annotateKey({ description: "How sure the proposer was" })),
    ratification: Ratification.pipe(S.annotateKey({ description: "The record of the steward's acceptance" }))
  }).pipe($I.annoteSchema("AlignmentRow", { description: "One reviewed correspondence to another vocabulary" }))
) {}
```

`owl:sameAs` and `owl:equivalentClass` are not in the predicate list, so neither can be written. A gist parent is the
class's `parent`, never an alignment row (project profile).

### 4.6 Vocabulary

```ts
// sketch, not code: packages/foundation/modeling/vocabulary/src/Vocabulary.schema.ts
/** Under example.org until something is published (decision 7): a real domain fails this check on purpose. */
export const Namespace = S.String.check(S.isPattern(/^https:\/\/example\.org\/[a-z0-9-]+(\/[a-z0-9-]+)*\/$/)).pipe(
  $I.annoteSchema("Namespace", { description: "The IRI every local key is appended to" })
)

export class Vocabulary extends S.Opaque<Vocabulary, { readonly brand: unique symbol }>()(
  S.Struct({
    namespace: Namespace.pipe(S.annotateKey({ description: "Written once, here" })),
    version: S.SemVerFromString.pipe(S.annotateKey({ description: "The version, written by hand (pending Q5)" })),
    prefixes: S.Array(PrefixEntry).pipe(S.annotateKey({ description: "Every prefix a term or row may cite" })),
    classes: S.Record(ClassKey, ClassTerm).pipe(S.annotateKey({ description: "The classes, by key" })),
    objectProperties: S.Record(PropertyKey, ObjectPropertyTerm).pipe(S.annotateKey({ description: "Relations" })),
    datatypeProperties: S.Record(PropertyKey, DatatypePropertyTerm).pipe(S.annotateKey({ description: "Attributes" })),
    schemes: S.Record(SchemeKey, ConceptScheme).pipe(S.annotateKey({ description: "The code lists, by key" })),
    disjointGroups: S.Array(DisjointGroup).pipe(S.annotateKey({ description: "Classes that share no instance" })),
    alignments: S.Array(AlignmentRow).pipe(S.annotateKey({ description: "Correspondences to other vocabularies" }))
  }).pipe($I.annoteSchema("Vocabulary", { description: "Every term under one namespace" }))
) {}
```

The rules of section 5 that span entries are one pure function beside it, `violations(vocabulary, bindings)` in
`Vocabulary.rules.ts`, returning every broken rule at once as a `Violation` (`{ rule, term, says }`) rather than a
filter that stops at the first. A fast test decodes the module's value through `Vocabulary` and requires
`violations` to be empty.

### 4.7 How the module is written, and the Curie type

The hand-written value is a literal kept `as const`, so its keys are literal types, and checked with `satisfies`
against the schema's encoded side. It is decoded in a test, not built with `.make`, because `.make` returns the
decoded type and its keys widen to `string`.

```ts
// sketch, not code: packages/kernel/src/internal/terms/Terms.vocab.ts (pending Q7)
import type { CoreVocab, Curie } from "@beep/identity/Vocab"

export const namespace = "https://example.org/inventory-import/ontology/" as const   // pending Q2

export const classes = defineClasses({
  Organization: {                                         // report 06's term, shown only for the form
    prefLabel: "Organization",
    definition: "…",
    parent: { kind: "gist", term: "gist:Organization" },
    tag: "kind",
    identity: { kind: "unresolved", question: "Tenant and source id, or the company itself?" },
    source: { kind: "repository", path: "explorations/erp-ontology/research/01-starting-model.md" },
    scope: "later",
    ratification: "rat-organization"
  }
})
export type ClassKey = keyof typeof classes & string

export const objectProperties = defineProperties<ClassKey, SchemeKey>()({ /* domain and range typed by the keys */ })
export const schemes = defineSchemes({ ItemRoleScheme: { /* report 10's */ } })
export type SchemeKey = keyof typeof schemes & string

/** The registry `Curie<V>` reads: one prefix, every local key. */
export type InvVocab = {
  readonly inv: {
    readonly iri: typeof namespace
    readonly terms: ReadonlyArray<ClassKey | SchemeKey | PropertyKey>
  }
}
export type InvCurie = Curie<InvVocab>                    // "inv:Organization" | "inv:ItemRoleScheme" | …
export type InvClassCurie = Extract<InvCurie, `inv:${ClassKey}`>
```

`defineClasses` is an identity function with an F-bounded `const` type parameter,
`<const C extends Record<string, ClassTermInput<Extract<keyof C, string>>>>(c: C) => c`, so a `local` parent or a
property's domain inside one object literal is checked against the keys of that same literal. If the type-checker
does not infer through that bound, the fallback is one object per level of the hierarchy, each typed against the keys
of the ones before, with the same rule also held at run time by `violations`. Neither was tried.

`Curie<V>` in `Vocab.ts` reads only `V[Prefix]["terms"][number]`, a union, so the registry's `terms` need not be a
tuple; `R.keys` is typed `Array<K & string>`, which keeps the union. `mergeVocab` replaces a prefix of the base
wholesale (its type is `Omit<Base, keyof Extension> & Extension`), and `CoreVocab` has no `xsd` or `gist` prefix and
no `owl:disjointWith`, `owl:AllDisjointClasses`, `owl:members` or `owl:versionIRI`: the projector's own registry has
to list those itself. `CoreVocab` also writes `https://schema.org/` where `namespaces.json` writes
`http://schema.org/`; report 11 picks one.

### 4.8 The term pointer

The pointer is a helper that writes the annotation, typed by the registry, imported by the contracts with no runtime
dependency on the definitions:

```ts
// sketch, not code: packages/foundation/modeling/vocabulary/src/Pointer.schema.ts
import type { Curie, VocabShape } from "@beep/identity/Vocab"

/** The annotation a record or field carries; spread into `.annotate` or `.annotateKey`. */
export const pointerFor =
  <const V extends VocabShape>() =>
  <const C extends Curie<V>>(term: C): { readonly term: C } => ({ term })

// sketch, not code: packages/kernel/src/Terms.pointer.ts
import type { InvClassVocab, InvPropertyVocab, InvSchemeVocab } from "./internal/terms/Terms.vocab.ts"
export const aboutClass = pointerFor<InvClassVocab>()        // on a record schema
export const aboutProperty = pointerFor<InvPropertyVocab>()  // on a field
export const aboutScheme = pointerFor<InvSchemeVocab>()      // on a Literals schema built from a scheme

// sketch, not code: in a contract package
export const StoredItem = S.Struct({ /* … */ }).annotate({
  identifier: "StoredItem",
  description: "An item as stored for one organization",
  ...aboutClass("inv:ItemSpecification")                     // report 07's key
})
// aboutClass("inv:ItemSpecifcation") does not compile: the argument is not in the union Curie<InvClassVocab>.
// aboutClass("inv:identifierText") does not compile either: a property cannot stand for a record.
```

Why a helper and not a declaration that adds `term` to Effect's `Annotations` interface: that interface has the index
signature `readonly [x: string]: unknown` (`Schema.ts`, `Annotations.Annotations`), so a misspelt annotation name
(`trem`) would still compile, and a module augmentation is one type for the whole program, which every package sees.
The helper writes the name itself and is typed per position. At run time the projector reads the annotation with
`S.resolveAnnotations` or `S.resolveAnnotationsKey`, gets `unknown`, and decodes it with
`makeCurieFromIri(InvVocabValue)` from `Curie.ts`, which fails with "Unknown CURIE" for a pointer written without the
helper: the run-time twin of the type error.

A record that stands for no term says so rather than leaving it out: `noTerm("transport")` for a transport payload
such as `UploadChunk` (report 01's representation layer), with the reason from report 12's closed list (transport,
request, screen, error, bookkeeping; decision 21), so report 12's rule that every exported contract schema has a
pointer can tell a forgotten pointer from a stated absence.

A field whose value is not one property of its record's subject carries a lift path (sketch, not code):

```ts
// sketch, not code: the pointer on three of the item's fields (07's terms)
sku: Sku.pipe(S.annotateKey({ ...aboutPath([
  { property: "inv:identifiedBy", node: "inv:ItemIdentifier",
    fixed: { "inv:identifierKind": "inv:IdentifierKindScheme-sku" } },
  { property: "inv:identifierText" }
]) }))
vendors: Vendors.pipe(S.annotateKey({ ...aboutPath([
  { property: "inv:offeredItem", reverse: true, node: "inv:VendorItem" }
]) }))
uom: Uom.pipe(S.annotateKey({ ...aboutProperty("inv:baseUnit") }))      // a scheme notation lifted to its concept
```

A step's `node` names the class of the node it reaches; `fixed` names values every such node holds; `reverse` walks a
property against its one direction, so the record never needs the inverse property the vocabulary refuses (V5).

## 5. The rules

None of these checks is built. "Type-check" means the repository's `tsrs` run in `bun run check`; "decode" the fast
test that decodes the module through `Vocabulary`; "rules" the `violations` function in that test; "projector" and
"laws" are report 12's.

| # | Rule | Checked by | Fails as |
| --- | --- | --- | --- |
| V1 | Every ClassTerm has a `prefLabel`, a `definition` and one `parent`; a `none` parent carries a reason | type-check (required fields), decode | a missing-key error naming the class |
| V2 | Following `local` parents and category parents from any class ends at a `gist` or `none` parent, with no cycle and no missing key (`Graph.directed`, `Graph.isAcyclic`, `Graph.findCycle` from `effect/Graph`) | rules | the cycle or the missing key |
| V3 | Keys are unique: within a kind by the object literal (a duplicate property is a compile error); a class and a scheme cannot share one because a scheme key ends in `Scheme`; a property key is lowerCamel and so differs from both; notations are unique within their scheme | type-check, decode, rules | the duplicate |
| V4 | Keys and notations match their patterns, and no property key is an RDF keyword | decode | the key and the pattern |
| V5 | No inverse: the metamodel has no field for one, and the generated Turtle contains no `owl:inverseOf`; two object properties whose domain and range are swapped are listed for review, not failed | type-check (no field), projector (text check), rules (review list) | the property pair |
| V6 | No identity by mapping: the predicate list has no `owl:sameAs` or `owl:equivalentClass`; two local terms may not both `exactMatch` one external term, since that states they are one | type-check, rules | the two subjects and the object |
| V7 | `broader` names a notation of the same scheme, and the `broader` links of a scheme form no cycle | rules | the scheme and the cycle |
| V8 | An alignment row's subject resolves to a local term; its CURIE object's prefix is a `PrefixEntry` whose use is gist or alignment, never the local namespace; a gist object is not also its subject's gist parent; no two rows share subject, predicate and object | type-check (prefix in the template literal type), rules | the row |
| V9 | A pointer resolves to a term of the kind its position needs: a record to a class, a field to a property, a Literals schema to a scheme | type-check (`aboutClass`, `aboutProperty`, `aboutScheme`), projector (decode with `makeCurieFromIri`) | the record and the CURIE |
| V10 | Every exported contract schema carries a pointer or a stated `noTerm` | laws (report 12's `laws ontology-terms`) | the schema's identifier |
| V11 | Every field that fills one datatype property has the same leaf on its encoded side (the AST node after checks, brands and annotations are stripped), or the property states a datatype that each field's leaf converts to by a named conversion (an integer to `xsd:decimal` as its digits; a float to `xsd:decimal` as its shortest round-trip digits; a decimal digits string to `xsd:integer` minor units by `digitsAtScale(n)`, decision 59); checks such as patterns may differ (pending decision 50) | projector | the property and the two fields with their leaves |
| V12 | A field that fills an object property with a scheme range is a Literals schema whose literals are that scheme's notations (pending Q13 for deprecated ones) | projector | the field, the missing and the extra notations |
| V13 | A field that fills a property sits in a record whose pointer names the property's domain or a subclass of it | projector | the field, its record's class and the domain |
| V14 | A deprecated term keeps its label and definition; `replacedBy` names a term of the same metatype that is not deprecated; `since` is not later than the module's version; a term with no replacement has a reason; no pointer names a deprecated term | rules, projector | the term |
| V15 | A term's scope is `repository` exactly when at least one binding names it | rules, given the bindings | the term and its bindings |
| V16 | A disjoint group has two or more members, each a class whose tag is rigid (kind, subkind, relator, event, information, value), none an ancestor of another, and no two groups list the same members | rules | the group |
| V17 | Tag and identity agree: kind, relator, event, information and value carry `stated` or `unresolved`; subkind and phase carry `inherited`; role and category carry `notApplicable` | rules | the class |
| V18 | A stated identity criterion whose `restsOn` names `name`, `identifierText` or `identifierKey` fails: identity never rests on a name or a SKU (project profile; 04's CQ-I08); one whose sentence mentions a SKU or a name is also listed for review | rules (a failure on `restsOn`; a review list on the sentence, since a word match cannot judge meaning) | the class and the property or sentence |
| V19 | A definition does not contain its own label, and no two classes or two schemes share a label | rules (review list) | the term |
| V20 | The namespace is under `https://example.org/` until Benjamin changes it, and no IRI anywhere names Sutton's domain or a customer's subdomain | decode (`Namespace` pattern), projector | the IRI |
| V21 | A category parent is a local class tagged `category`; a category class names no identity (`notApplicable`), is in no disjoint group, and is never a class's `parent` link (pending Q8) | rules | the class |
| V22 | A concept's `alsoInstanceOf` names a class tagged kind, value or information (06's `Role` is information); each of its `links` names an object property whose domain covers that class and whose range is the scheme of the linked concept | rules | the concept and the link |
| V23 | Each step of a lift path names an existing property; a forward step's domain covers the node it leaves and a reversed step's range does; the last step is a datatype property, or an object property with a scheme range; a `fixed` value is a concept of the property's range scheme | type-check (the helper), projector | the record, the field and the step |
| V24 | A stated `datatype` on a property that a field fills agrees with V11; a stated datatype that every field now matches exactly is listed for removal | rules (review list) | the property |
| V25 | A class's tag is one the gist class it first reaches admits: `gist:Event` and its subclasses, event; `gist:Content` and its subclasses, information; `gist:Magnitude`, value; `gist:TemporalRelation` and `gist:Assignment`, relator; `gist:Commitment`, `gist:Agreement` and `gist:Offer`, relator or kind; `gist:Specification`, `gist:CatalogItem`, `gist:TaskTemplate`, `gist:Permission` and `gist:Restriction`, kind or information; any other gist class, kind; a `none` parent, category. A subkind, role or phase is checked through its local parent | rules | the class, its tag and the gist class |

V19 is a review list, and V18 is one for its sentence part, because a word match cannot tell a circular definition
from a quoted one; the rest fail the check. V25 was added on 2026-11-22 after a review found relator tags on
descriptions and content (07's `BomLine`, 06's `PortalAccess`, 09's `LineAllocation`) that no other rule caught.

## 6. One term with several records, and a term with none

Both are the same thing seen from the binding table: a term has zero or more bindings, and the projector emits every
term whatever its count.

Several records. Report 07's item term is today stood for by `ItemFields` (what an item needs before it is stored),
`StoredItem` (which spreads `ItemFields.fields` and adds `id`, `createdAt`, `createdBy`, `revision`). Each carries
`aboutClass("inv:ItemSpecification")`; the projector finds two bindings and emits one `owl:Class`. The import's staged
row is not a third: it is what the file said, and points at 09's `FileRow` (report 07, section 1). The `sku` field
object is shared by the spread, so its lift path to `inv:identifierText` (07's) has two field bindings with one leaf,
and V11 passes. `ItemEdit` is a request to change an item, not a description of one: it carries no class pointer, and
its `name` field, built as `ItemFields.fields.name.annotateKey({ messageMissingKey })`, keeps the field pointer only if
`annotateKey` merges with the annotations already there (not tried). Which record's shape SHACL aims at the class is
report 12's; the binding table gives it every record to choose from.

No record. A class met only in Sutton (a sales order, report 09's) is an entry with `scope: "sutton"` and no
binding. It is emitted with its label, definition and parent; it has no SHACL shape, because there is no stored row to
check. A datatype property with no field is emitted with its domain and no `rdfs:range`, which OWL allows; it gains
its range on the day a field fills it. An object property is complete with no record, since its range is in the
module.

A record with no term is the opposite case and is refused by V10 unless it says `noTerm`.

## 7. A record's literals and a scheme's notations

Decision 2 gives each fact one home: the vocabulary owns what a code means (its label, definition, broader code and
alignments); the record schema owns which codes a field allows. So a record writes its own `Literals`, and gate 4
holds the two together (V12; decision 23): every literal of a schema that points at a scheme is a notation of that
scheme, and a field may allow a subset (`Dimensions.unit` allows `cm` and `in` only).

```ts
// sketch, not code: in a contract package; the literals are the record's, the pointer names the scheme
export const ItemRole = LiteralKit(["buy", "make", "sell"]).pipe(
  S.annotate({ ...aboutScheme("inv:ItemRoleScheme") })
)
// gate 4 (V12): ItemRole's literals are each a notation of inv:ItemRoleScheme; "steal" fails the check, not the
// type-check, and a new concept in the scheme changes no record until the record schema adds it
```

A first sketch built the literals from the scheme (`notationsOf(schemes.ItemRoleScheme.concepts)`), so that a new
concept reached every record at once. That gave the vocabulary module a home for which values a field allows, which
decision 2 gives the record schema; it is withdrawn here. If Benjamin wants the codes to have that one home instead,
decision 2's wording changes ("a change to an allowed value is a proposed change to a record schema") and that is his
call, not a design choice.

Before this is trusted, try, under this repository's `tsrs` (TypeScript 7.1 beta here, not `tsc` 5):

1. A schema whose literal is not a notation of its scheme fails gate 4 with the field, the literal and the scheme.
2. A deprecated concept: whether its notation stays in the decoding `Literals` while a `LiteralKit.omit` subset is
   what a screen offers (Q13).
3. `bun run --cwd apps/inventory build:report` shows the definitions' text is not in the browser's bundle, since the
   contracts import only the pointer helpers, not the module.
4. The type-check time of a module with a few hundred keys, against today's.

## 8. Names, IRIs and versions

Keys and local names:

- A key is the IRI's local name exactly: `Organization` is `inv:Organization`, `isCustomer` is `inv:isCustomer`.
  Classes and schemes are UpperCamelCase, properties lowerCamelCase, letters and digits only.
- Acronyms are written as words (`BomLine`, `GtinCode`, `itemId`), as the repository's identifiers already are
  (`ItemId`, `ImportId`). The API design report's exception for an all-capital `ID` is not followed: the records and
  the terms would then spell one word two ways.
- A scheme key ends in `Scheme` (`ItemRoleScheme`), as both seeds write it; report 02's sketch wrote `inv:ItemRole`.
  A record's Literals schema may still be called `ItemRole` in code.
- No key is an RDF keyword (`domain`, `range`, `label`, `type`), per `naming-conventions.md`.
- A label is written by hand, sentence case as the module writes it ("Item roles"), and may change in a patch; a key
  never changes. A notation is the stored value and never changes either; a label correction is compatible, a change
  of meaning is a new term and a deprecation (the architecture seed, section 6).

IRIs (pending Q2):

- The namespace is written once, in the module: `https://example.org/inventory-import/ontology/`, the placeholder
  `namespaces.json` gives (decision 7).
- Classes, properties and schemes sit directly under it: `inv:Organization`, `inv:isCustomer`, `inv:ItemRoleScheme`.
- A concept is its scheme's key, a hyphen and its notation, under the same namespace:
  `inv:ItemRoleScheme-buy`, `https://example.org/inventory-import/ontology/ItemRoleScheme-buy` (pending Q2; this
  report first proposed `ItemRoleScheme/buy`, and report 10 proposed the hyphen; decision 10 recommends the hyphen).
  The scheme qualifies it, so `active` of one lifecycle is not `active` of another (the architecture seed's flat
  `tax:Buy` form collides there), and the notation, which never changes, is the last part, not the label. A hyphen
  needs no escape in a Turtle or SPARQL prefixed name, so fixtures, queries and alignment rows write concepts as
  CURIEs; a notation is letters, digits, `.`, `_` and `-` (the `Notation` pattern), all legal in a local name.
- The ontology IRI is the namespace without its last `/`; its version IRI appends the version
  (`…/ontology/0.1.0`), as the architecture seed does.

Versions (pending Q5): the module states its version as a literal, and the header reads it from there, never from the
clock, so the byte-compare of decision 6 holds. The proposal: semantic versions, `0.x` until something is published.
A patch changes wording only (label, definition, scope note, alternative label) or adds an alignment row; a minor
adds a term, a concept or a disjoint group, or deprecates a term; a major changes the namespace or narrows a domain or
range, anything that can make data that conformed before stop conforming. Meaning is never changed in place, so a major
is rare. Whether a check refuses a change to the generated Turtle with no change of version is report 12's; release
notes are the curator's.

Deprecation (pending Q4): a deprecated entry stays in the module for good, with `owl:deprecated true` and the
replacement emitted as `dcterms:isReplacedBy` (already in `CoreVocab`), and the version as `skos:historyNote`
("Deprecated in 0.4.0."); its logical axioms (parent, disjointness, domain, range) are no longer emitted, as report 12
writes it. It is never deleted, because a stored IRI or notation may still name it.

## 9. Where the module lives

What the repository's rules allow today (`packages/tooling/tool/cli/src/commands/Laws/Boundaries.rules.ts`,
`allowed` and `contextMay`): a context's contract may import only the kernel and the foundation; the kernel may
import only the foundation; and a tooling package, where a `bun run beep` command such as a projector would live, may
import only the foundation. So a vocabulary in the kernel can be pointed at by every contract, but the repository's
command line cannot import it without a new row in that rule. File names take a role suffix outside `internal/`
(decision "file naming" of the ideal-architecture exploration); `.vocab.ts` and `.pointer.ts` would be new suffixes.
The options are Q7.

## 10. What the term documents needed that this model first lacked

Read from 04 and 06 to 12 on 2026-11-22; each is now a field, a value or a rule above.

| Need | Who wrote it | Now |
| --- | --- | --- |
| A class under a local category and its own gist parent | 06 (`Party` over `Person` and `Organization`) | `categoryParents`, `CategoryParent`, V21 (pending Q8) |
| A domain or range that is a projected gist class | 07 (`gist:Specification`, `gist:Offer`, `gist:Intention`, `gist:Content`), 08 (`gist:Event`, `gist:Commitment`), 09 (`gist:Event`, `gist:Intention`) | `ClassTarget` with a `gist` case |
| A domain left undeclared with a reason | 06 (`inTenant`), 08 (`forItem` and its kin), 09 (`sourceLocation`, `hasReason`), 10 (`lifecycleState`) | `ClassTarget` with a `none` case |
| A range over concepts of several schemes | 09 (`hasReason`), 10 (`lifecycleState`) | `RangeTarget` with a `schemes` case |
| A datatype stated before any record field fills it | 07 ("no record yet: an exact decimal"), 09 ("moves to the record schema") | `DatatypePropertyTerm.datatype`, V11, V24 |
| One property filled by fields of different leaves | 07 (`numericValue` from integers and floats) | V11 with a stated datatype (pending decision 50) |
| A code that is also an individual of a class | 07 and 10 (units), 06 and 10 (member roles) | `alsoInstanceOf`, V22 (pending decisions 61 and 41) |
| A fact on a concept that points at another scheme | 10 (`hasDimension: count` on a unit) | `links`, V22 |
| Whether a scheme is closed | 10 (rule 5) | `ConceptScheme.closed` |
| A flat field that becomes a node or a path | 07 (`sku`, `unitCost`, `vendors`), 08 (`quantityOnHand`) | `TermPointer.path`, `LiftPath`, V23 |
| A record with no term, and why | 12 (`noTerm`, closed list) | `NoTermReason` |
| A source that is a published standard, or Sutton as a seed cites it | 06, 09, 11 | `TermSource` |
| Disjointness written without a blank node | 12 (section 5, rules 9 and 10) | `DisjointGroup` emitted pairwise |

Not taken into the model: 12's `inv:termCategory` (the other answer of Q1, decision 19), and a tag on properties
(Q12's option C).

## Questions for Benjamin

Moved on 2026-11-22 to the packet's [DECISIONS.md](../DECISIONS.md), "Open", merged with the other reports'
questions. A "(pending Qn)" mark in this report means: Q1 is decision 19, Q2 is 10, Q3 is 11, Q4 is 33, Q5 is 24,
Q6 is 20, Q7 is 9, Q8 is 12, Q9 is 31, Q10 is 32, Q11 is 29, Q12 is 18, Q13 is 33.

## Not checked

- No sketch was compiled or run. Every Effect name used was found in `node_modules/effect/src` (Effect 4.1.5):
  `S.Literals`, `S.TemplateLiteral`, `S.NonEmptyArray`, `S.OptionFromOptionalKey`, `S.withConstructorDefault`,
  `S.withDecodingDefaultTypeKey`, `S.toTaggedUnion`, `S.tag`, `S.SemVerFromString`, `S.Trimmed`, `S.isMinLength`,
  `S.isMaxLength`, `S.isPattern`, `S.isBetween`, `S.Finite`, `S.resolveAnnotations`, `S.resolveAnnotationsKey`, the
  `Annotations.Annotations` interface, `Tuple.make`, `Tuple.map`, `R.keys`, and `effect/Graph`'s `directed`,
  `isAcyclic` and `findCycle` (marked unstable). Their behaviour in these sketches was not tried.
- The section 7 list was not tried, nor the F-bounded `defineClasses`, nor whether `annotateKey` on a field that
  already has a pointer keeps it, nor the Turtle rule on `/` in a prefixed name against an N3 parser.
- `tsrs` (TypeScript 7.1 beta) inference of `const` type parameters and `satisfies` was assumed from TypeScript 5.
- Report 02's beep-effect paths (`VocabularySeed`, `ConceptAlignment`) were not opened here.
- The seed reports were read in their sections on namespaces, gist, taxonomy governance, the core header, the
  governance classes, the taxonomy file's opening and the correspondence register; the rest was not read for this
  report. The API design report's claim that gist renamed `CatalogItem` and deleted `Magnitude` disagrees with
  `gist-categories.md`, which found both in 14.1.0; this report follows `gist-categories.md` and did not re-check.
- The other designers' reports (04, 06 to 12) did not exist when this was first written; the keys used here were
  matched to them on 2026-11-22 (report 13). The fields added in section 10 were not compiled either.
- `bun run docs:check` passed with this file in place (92 files under `explorations/`); nothing else was run.
