---
type: Research
title: The term model of the vocabulary module
description: The vocabulary module's metamodel as Effect Schema sketches, with its rules, IRI and version forms, and where it lives.
---

# The term model of the vocabulary module

Report 02 decided that one hand-written TypeScript module owns every term fact, that record schemas carry a typed
pointer to a term, and that all Turtle is generated (decisions 2 and 5). This report designs the module's own shape:
the kinds of entry it holds, the fields of each, the rules a check can hold them to, and how a record points at a
term. The answers of 2026-11-22 that this shape waited on are written below as decided. A question still open stays
marked pending, and nothing is built on it. Nothing here is built, and no code file was written.

What this report does not own: the domain terms themselves. Parties and access are report 06's (`Organization`,
`Person`). The customer and vendor flags sit on the tenant's `SourceRecord`, and CQ-P01 reads them there (decision
34). This report does not put those flags on `Organization`. A contact is a `ContactAssignment`: it links one `Person`
to one account and carries the purpose and the contact point (decisions 39 and 43). `isContactOf` alone is not the
model. Report 06 owns that class. This metamodel holds it as an ordinary class term, and this report adds no contact
table. Items and values are report 07's (`ItemSpecification`, `QuantityValue`), stock report 08's, commitments and
events report 09's, the schemes' contents report 10's (`ItemRoleScheme`), the gist names a slice admits and the
alignment rows' contents report 11's, the projector and the checks that run the rules below report 12's, and the
competency questions report 04's. Their terms appear here by the keys report 13 settled.

The thin thread is the first deliverable (decision 8). It has seven classes and two schemes. The classes are
`Organization`, `Tenant` (a role class under `Organization`, keyed by `OrganizationId`; `membershipIn` ranges over
it, decision 38), `Person` (under `gist:Person`, with one link from `Member` to the person and no name or email
paths, decisions 93 and 94), `Member`, `Role` (no gist parent and no `permits`, decisions 13 and 41), `Grant`
(`grantedTo`, `grantsRole` and `grantScope`, decisions 40 and 96) and `AuditEntry`, whose alternative label is
"Activity" (the page and the record keep their name, decision 46). The schemes are `MemberRoleScheme` (viewer,
editor and admin) and `GrantScopeKindScheme` (the one concept organization, decision 96). Their gist parents, and
those parents' ancestors, come with them (decisions 13 and 14). It answers one question, who belongs to this
organization and with which role, on a fixture where one person is an admin in one organization and a viewer in
another. It builds gates 1 to 9: byte-compare (1), re-parse (2), forbidden constructs and the namespace guard (3),
vocabulary coherence (4), record pointers on the AST (5), the type-check (6), `laws ontology-terms` (7), the
question suite (8) and the reasoner (9). Gates 5 and 7 are enrolled on the access contract and the four kernel
records only (`Member`, `Role`, `Activity` and `AgentRun`; decision 95). Each of those gates is shown failing once
on a planted mistake. Gates 11 and 12 wait for their slices, and gate 10 is open decision 27's. The engines in the
thread are N3.js for the re-parse and Oxigraph for SPARQL; shacl-engine is added with the SHACL slice (decision
26). Every field of a pointed record carries a pointer or `noTerm` with a reason, and the SHACL shapes are closed
(decision 22). The thread waits on no open decision. Slice 1 stays the party slice and follows the thread. This
report does not renumber slices.

On 2026-11-22 the model was widened so it can hold every row 04 and 06 to 12 wrote (section 10 lists what each
needed), and its open questions moved to the packet's [DECISIONS.md](../DECISIONS.md) ("Questions for Benjamin" maps
each Qn to its decision number). The same day's answers are applied in this revision, including decisions 22, 26, 38, 46 and 94 to 96, which settle
the thin thread.

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
| Pointer | The annotation on a record or a field that names the one term it stands for | the record schema | `term: "inv:InventoryItemSpecification"` on `StoredItem` |
| Binding | The pair of a term and a record whose pointer names it | computed by the projector, never written | (`InventoryItemSpecification`, `StoredItem`) |

The pointer is the only hand-written home of "which record stands for which term". A term entry never lists its
records, so renaming a record changes one file, and a term with no record is an ordinary entry with no bindings.

The entries below describe the ontology; they are not classes of it. Under the recommended answer to Q1 they mint no
IRI: each projects onto an OWL, SKOS or SSSOM built-in (`owl:Class`, `skos:Concept`, a mapping row). The Key column
of the terms table is the schema's name in the module; it would become an IRI local name only under Q1's option B.

## 2. Terms of the metamodel

| Key | Label | Definition | Tag | gist parent | Identity | Source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Vocabulary | Vocabulary | A hand-written TypeScript module that states one namespace, its version, the prefixes it may cite and every term under that namespace. | information | none: metamodel element, projected as the `owl:Ontology` header, never a class of the domain (pending Q1) | its namespace IRI: one module per namespace | `explorations/erp-ontology/research/02-schema-as-source.md` (verdict); the home is decision 9 | later (pending Q1) |
| Term | Term | An entry of a Vocabulary that names one thing the ontology speaks of and holds its label, definition, source, scope and ratification. | category | none: metamodel element (pending Q1) | n/a | report 02 ("A term exists: IRI, label, definition") | later |
| ClassTerm | Class term | A Term that names one OWL class and gives it exactly one parent link, a kind tag and an identity criterion. | information | none: projects to `owl:Class` (pending Q1) | its key within the Vocabulary's namespace | report 02; project profile, decision 2 | later |
| ObjectPropertyTerm | Object property term | A Term that names a relation, stated in one direction only, from instances of one class to instances of a class or to concepts of one scheme. It may name one property it sits under (`subPropertyOf`): a projected gist property or a local property (decision 16). Absent, it emits no parent. The link is allowed only where its own domain and range fall under the gist property's, and that gist domain and range are not copied. | information | none: projects to `owl:ObjectProperty` (pending Q1) | its key | report 02 ("Object property domain and range"); project profile (no `owl:inverseOf`) | later |
| DatatypePropertyTerm | Datatype property term | A Term that names an attribute of instances of one class, whose literal datatype is read from the record fields that fill it. It may name one property it sits under, the same optional `subPropertyOf` as an object property (decision 16). | information | none: projects to `owl:DatatypeProperty` (pending Q1) | its key | report 02 ("A datatype property's range is read from the field that fills it") | later |
| ConceptScheme | Concept scheme | A Term that names one closed code list: an ordered, non-empty list of Concepts whose notations a record stores. | information | none: projects to `skos:ConceptScheme`; a code list is never a class (`gist-categories.md`, step 8) | its key | report 02; the architecture seed, section 6 | later |
| Concept | Concept | A Term held inside one ConceptScheme that gives one code its notation, label, definition, at most one broader code of the same scheme, and, where the code is also a thing a class counts, that class and its links to concepts of other schemes. | information | none: projects to `skos:Concept`, an individual, also typed by its class when it has one | its scheme's key and its notation (decision 10: the IRI is that scheme key, a hyphen and the notation) | the architecture seed, section 6; the API design report, section 5 (the notation binds the enum string) | later |
| DisjointGroup | Disjoint group | A Vocabulary entry that lists two or more ClassTerms of which no instance can belong to two at once. | information | none: projects to pairwise `owl:disjointWith` | the set of its member keys, in any order | the architecture seed (`owl:AllDisjointClasses` over the item definitions); project profile (disjointness is the module's) | later |
| AlignmentRow | Alignment row | A Vocabulary entry that records one reviewed correspondence from a local Term to a term of another vocabulary, with its predicate, source, confidence and ratification. | information | none: projects to one SKOS mapping triple; an alignment is never a parent | its subject, predicate and object together | report 02 (beep-effect's `ConceptAlignment`, "take"); the architecture seed (`MappingAssertion`, the correspondence register) | later |
| AlignmentPredicate | Alignment predicate | A value from the closed list of SKOS mapping relations an AlignmentRow may state. | value | none: a code of the metamodel | the literal | project profile ("`skos:*Match` predicates only") | later |
| KindTag | Kind tag | A value from a closed list that records which ontological category the instances of a ClassTerm fall under. | value | none: a code of the metamodel | the literal | project profile ("kind or role tag"); `foundational-analysis.md` | later (pending Q12) |
| ParentLink | Parent link | A value that gives a ClassTerm its one identity-bearing parent: a projected gist class, a local ClassTerm, or no parent with the reason. | value | none: a code of the metamodel | its contents | `gist-categories.md` ("Every local top class has one parent") | later (pending Q8) |
| CategoryParent | Category parent | A value that names a local ClassTerm tagged category under which a ClassTerm also falls, beside its one parent link, without taking an identity from it. | value | none: a code of the metamodel | the key it names | NEW: 06's `Party` sits over `Person` and `Organization`, which keep their gist parents (pending Q8) | later (pending Q8) |
| ClassTarget | Class target | A value that names the class whose instances a property relates: a local ClassTerm, a projected gist class, or none declared with the reason. | value | none: a code of the metamodel | its contents | NEW: 06 to 10 write domains of all three kinds (`gist:Intention`, `gist:Event`, "none declared: shared by several records") | later |
| RangeTarget | Range target | A value that names what an object property's values are: instances of a class target, or concepts of one or more named schemes. | value | none: a code of the metamodel | its contents | NEW: 09's `hasReason` and 10's `lifecycleState` range over concepts of several schemes | later |
| LiftPath | Lift path | A value, carried by a field's term pointer, that says how one flat field becomes a small graph: the properties walked in order, each forward or reversed, the class of each node passed, and the values fixed on it. | value | none: a code of the metamodel | its steps | NEW: 07 and 08 point fields at paths (`sku` through `identifiedBy` to `identifierText` with the kind `sku`; `vendors` through the reverse of `offeredItem`; `quantityOnHand` to an `InventoryMeasure`). Decision 20 adopts the path. The thin thread's one path is `Member.role` to `Grant`, and that `Grant` carries `grantScope` (decisions 40 and 96). The link from `Member` to `Person` is not a path (decision 94). | later (decision 20) |
| NoTermReason | No-term reason | A value from a closed list that says why an exported record schema, or one of its fields, stands for no term: transport, request, screen, error or bookkeeping. | value | none: a code of the metamodel | the literal | report 12 (its Q8, the closed list); decision 21. Decision 22: every field of a record that points at a term carries a pointer or `noTerm` with a reason. Decision 93 uses `screen` on the `Member` record's copied name and email fields in the thin thread. | later |
| IdentityCriterion | Identity criterion | A value that says what makes two instances of a ClassTerm the same one, that it is inherited from the parent, that it does not apply, or that it is open and names the question. | value | none: a code of the metamodel | its contents | project profile (identity card, `unresolved`); report 01, section 3 | later |
| Deprecation | Deprecation | A value that marks a Term as retired from a given version, with the Term that replaces it or the reason none does. | value | none: a code of the metamodel | its contents | the architecture seed, section 4.2 ("Deprecate a term when its meaning is replaced"); `naming-conventions.md` | later (pending Q4) |
| TermSource | Term source | A value that names where a Term's meaning comes from. Foundation holds the shape: a seed, a repository file, a public document, a named standard, or a new need with its reason. The inventory module closes the seed names, the standard names and the Sutton case. | value | none: a code of the metamodel | its contents | this packet's term-table rule (the Source column); 06 and 11 cite W3C ORG, schema.org, IBM MDM, EPCIS and QUDT pages they fetched | later |
| TermScope | Term scope | A non-empty set of scope tokens, not one exclusive choice. `repository` means a TermBinding names the term, and a TermBinding is a schema pointer, not a SQL table. `sutton` and `later` may be members as well, and a missing binding implies neither. Foundation holds the set; the inventory module closes the tokens to those three. | value | none: a code of the metamodel | the set of tokens | NEW: turns the Status column of every term table into a fact a check can compare with the bindings | later |
| Ratification | Ratification | A value that names the ratification record in which the steward accepted a Term or an AlignmentRow. The module holds ratified entries only, and the value is that `rat-` record's name (decision 32). | value | none: a code of the metamodel | the record's name | project profile ("A ratification is Benjamin's answer, scribed in a `rat-` file"); decision 32. The answers dated 2026-11-22 are the first that need those records. | later (decision 32) |
| PrefixEntry | Prefix entry | The use of one prefix already in the one `VocabShape` registry: local, projected from gist, or cited by alignment only. The prefix is a bounded token. The namespace IRI is not stored again here; it lives once on that registry, and it is an absolute IRI. | information | none: `@prefix` lines and Curie types are generated from that one registry | its prefix | `packages/foundation/modeling/identity/src/Vocab.ts` (`VocabEntry`); `.agents/skills/_shared/namespaces.json` | in the repository today (as `VocabEntry`, without the use) |
| NamedExternalTerm | Named external term | A value that cites a term of a standard with no RDF namespace by the standard's name, the term's name and a public document. Foundation names a standard; the inventory module closes the standard names. | value | none: has no IRI to project | its standard and term name | project profile (no prefix for ISA-95 or Sutton; how a Sutton term is cited is open) | later (pending Q11) |
| TermPointer | Term pointer | A value carried in the annotations of a record schema or of one of its fields that names, by a CURIE the type-check knows, the one Term the record or field stands for. The helpers are `aboutClass`, `aboutProperty`, `aboutScheme` and `aboutPath` (decision 20). | value | none: never projected as a triple; read by the projector and the checks | its CURIE | report 02 (`term` annotation typed by `Curie<V>`); decision 20 | later (decision 20) |
| TermBinding | Term binding | A derived pair of one Term and one record schema or field whose TermPointer names it, computed from the contract packages and never written by hand. | information | none: never projected; the projector's join | its Term key with the record's identifier and field path | NEW: the one place where "one term, several records" and "a term with no record" are both visible | later |
| VocabularyVersion | Vocabulary version | A value that numbers one state of a Vocabulary as major, minor and patch, written in the module and never read from the clock. | value | none: a code of the metamodel | its three numbers | project profile (the header's version "never the clock"); decision 6 (byte-compare) | later (pending Q5) |
| GistProjection | Gist projection | The gist classes the slice being built needs, each with its label, definition and named gist ancestors as names and links only (decisions 13 and 14). A name nothing in that slice uses is not admitted, so report 11's table B is not taken whole. The taken gist properties, each with its named parent and never its domain or range (decision 16). The disjoint pairs gist states between classes already admitted, and no others (decision 15). The whole design of reports 04 to 12 is 24 pairs. The thin thread copies only the pairs among the classes it admits. It also holds the pinned release and its sha256. | information | none: metamodel element. For the thin thread, `Person` is under `gist:Person` (decision 94), `Member` and `Grant` under `TemporalRelation` and `Assignment` (decision 13), and `Organization` and `AuditEntry` bring the gist parents report 11 gives them (decision 46). `Tenant`'s parent is the local class `Organization` (decision 38). `Role` has no gist parent and ships without `permits`, so `Permission` waits (decisions 13 and 41). Each admitted class brings its named ancestors (decision 14). | the pinned release | report 11 section (a); decisions 13 to 16 | later (decisions 13 to 16) |

## 3. Properties of the metamodel

Each row is a field of a schema in section 4. "Datatype from the record field" names the metamodel schema that
holds it.

| Key | Label | Definition | Domain | Range | Source |
| --- | --- | --- | --- | --- | --- |
| key | key | The local name a Term's IRI ends with, written as the entry's key in the module. | Term | datatype from the record field (`ClassKey`, `PropertyKey` or `SchemeKey`) | report 02; `naming-conventions.md` |
| prefLabel | preferred label | The one English name of a Term for people, written by hand and never derived from its key. | Term | datatype from the record field (`Label`) | `naming-conventions.md`; decision 11 (`skos:prefLabel`, English) |
| altLabel | alternative label | Another English name people use for a Term, such as a trade word or an expanded abbreviation. | Term | datatype from the record field (`Label`) | `naming-conventions.md` ("Synonyms") |
| definition | definition | The sentence that says what a Term means, its genus first and then its difference. | Term | datatype from the record field (`Definition`) | `naming-conventions.md`; decision 11 (`skos:definition`, English) |
| scopeNote | scope note | A sentence that says where a Term applies, or how it must not be read. | Term | datatype from the record field (`Definition`) | the architecture seed, section 6 ("definition or scope note") |
| source | source | Where a Term's meaning comes from. | Term | TermSource | this packet's term-table rule |
| scope | scope | The non-empty set of scope tokens a Term carries. `repository` means a TermBinding names it. `sutton` and `later` are independent of that. | Term | TermScope | NEW: makes the Status column checkable |
| ratification | ratification | The record in which the steward accepted a Term or an AlignmentRow. | Term | Ratification | project profile; decision 32 |
| deprecation | deprecation | The retirement of a Term, when it is retired. | Term | Deprecation | the architecture seed, section 4.2 |
| parent | parent | The one class a ClassTerm's class is a subclass of, or the stated reason it has none. | ClassTerm | ParentLink | `gist-categories.md` (pending Q8) |
| categoryParents | category parents | The local category classes a ClassTerm's class also falls under, beside its one parent. | ClassTerm | CategoryParent | NEW: 06's `Party` (pending Q8) |
| kindTag | kind tag | The ontological category a ClassTerm's instances fall under. | ClassTerm | KindTag | project profile (pending Q12) |
| identity | identity criterion | What makes two instances of a ClassTerm the same one. | ClassTerm | IdentityCriterion | project profile (identity card) |
| member | member | A ClassTerm a DisjointGroup lists. | DisjointGroup | ClassTerm | the architecture seed (`owl:members`) |
| domain | domain | The class whose instances are the subjects of a property, or none declared with the reason. | ObjectPropertyTerm or DatatypePropertyTerm | ClassTarget | report 02; 06, 08 and 09 ("none declared: shared") |
| range | range | The class whose instances, or the schemes whose concepts, are the values of an object property. | ObjectPropertyTerm | RangeTarget | report 02; 09 and 10 (several schemes) |
| datatype | datatype | The literal datatype of a datatype property: read from the leaf of every field that fills it, or stated in the module when the property's fields have different leaves that each convert to it without loss, or while no field fills it. | DatatypePropertyTerm | datatype from the record field (derived, or stated) | report 02; 07 (`numericValue` is filled by integers and by floats; "no record yet: an exact decimal") |
| subPropertyOf | sub-property of | The one property this property sits under, when it has one: a projected gist property the slice has admitted, or a local property. Absent, nothing is emitted. It is `rdfs:subPropertyOf` (decision 16). An `inv:` property may sit under a gist property only where its own domain and range fall under that gist property's. The projection never copies the gist property's domain or range. | ObjectPropertyTerm or DatatypePropertyTerm | a projected gist property or a local property key | decision 16 |
| gist | gist projection | The projected gist classes, properties and copied disjoint pairs this vocabulary cites. The shape is foundation's. The inventory module admits a gist name only when a term in the slice being built needs it, and then its ancestors (decisions 13 and 14). | Vocabulary | GistProjection | report 11 section (a); decisions 13 to 16 |
| concept | concept | A Concept a ConceptScheme holds, in the order a screen lists them. | ConceptScheme | Concept | the architecture seed, section 6 |
| notation | notation | The code a record stores for a Concept, unique in its scheme and never changed. | Concept | datatype from the record field (`Notation`) | the API design report, section 5 |
| alsoInstanceOf | also instance of | The class of which a Concept is also an individual, such as a unit of measure, a member role, or `gist:Aspect`. Viewer, editor and admin are concepts of `MemberRoleScheme` and, under the same IRI, individuals of `Role`. That individual has one identity criterion, the concept's: its scheme and its notation (decision 41). Units stay open (pending decision 61). | Concept | a local ClassTerm or a projected gist class | NEW: 07, 06 and 10. Decision 41 for `Role`. Units pending decision 61. |
| conceptLinks | concept links | Values of object properties that a Concept holds as an individual of its class, each naming a concept of another scheme. | Concept | Concept | NEW: 10's `hasDimension` from a unit to its measurement dimension |
| closed | closed | Whether a scheme lists every value a record of this repository may hold, so an unknown value goes to a person. | ConceptScheme | datatype from the record field (`S.Boolean`) | 10, rule 5 |
| broader | broader | The one Concept of the same scheme that a Concept narrows. | Concept | Concept | the architecture seed, section 6 |
| alignmentSubject | subject | The local Term an AlignmentRow speaks of. | AlignmentRow | Term | report 02 (`ConceptAlignment`) |
| alignmentPredicate | predicate | The SKOS mapping relation an AlignmentRow states. | AlignmentRow | AlignmentPredicate | project profile |
| alignmentObject | object | The external term an AlignmentRow points at: a CURIE under a known prefix, or a named external term. | AlignmentRow | NamedExternalTerm, or datatype from the record field (`AlignmentCurie`) | project profile (pending Q11) |
| alignmentSource | justification | The document that shows an AlignmentRow's correspondence holds. | AlignmentRow | TermSource | the architecture seed ("Store the match evidence, reviewer, confidence") |
| confidence | confidence | How sure the proposer was that an AlignmentRow's correspondence holds. | AlignmentRow | datatype from the record field (`Confidence`, pending Q9) | the architecture seed; SSSOM's `confidence` column |
| replacedBy | replaced by | The Term of the same metatype that is the immediate successor at retirement, not a promise that the successor stays live. | Deprecation | Term | the architecture seed, section 6 ("replacement policy") |
| since | deprecated since | The version from which a Term is deprecated. | Deprecation | VocabularyVersion | NEW: a deprecation must say when, and the clock is not allowed |
| reason | reason | Why a Term is retired, required when nothing replaces it. | Deprecation | datatype from the record field (`Definition`) | `naming-conventions.md` ("status note") |
| term | term | The Term a record schema or a field stands for. | TermPointer | Term | report 02 |
| path | path | The lift path a field's value follows into the graph, when it is not the value of one property of the record's subject. One field may carry several paths when it fans out (`dimensions`). | TermPointer | LiftPath, or a non-empty list of them | NEW: 07, 08; decision 20. The thin thread lifts only `Member.role`, to a `Grant` that carries `grantScope` (decisions 8, 40 and 96). The link from `Member` to `Person` is not a lift (decision 94). |
| noTerm | no term | The reason an exported record schema, or one field of it, stands for no term. | TermPointer | NoTermReason | report 12; decision 21. On a field, decisions 22 and 93. |
| storedForm | stored form | Whether this record is the one stored form of its class. At most one record of a class may set it, and the projector targets only that record. Shown on `StoredItem` only as the illustration of decision 48(a), not as a choice. | TermPointer | datatype from the record field (optional `S.Boolean`) | NEW (pending decision 48) |
| record | record | The identifier of the record schema, with the field path for a field, that carries a TermPointer. | TermBinding | datatype from the record field (derived from the schema's `identifier` annotation) | NEW: names the record side of a binding |
| namespace | namespace | The IRI every local key is appended to, derived from the one project base. Foundation checks that it is an absolute IRI. The inventory module, before publication, still requires the placeholder host. | Vocabulary | datatype from the record field (`Namespace`) | decision 7; naming-conventions.md |
| version | version | The VocabularyVersion a Vocabulary is at. | Vocabulary | VocabularyVersion | project profile (pending Q5) |
| prefix | prefix | The short name a CURIE starts with: a bounded token. Its namespace IRI is not stored on this entry. | PrefixEntry | datatype from the record field (`Prefix`) | `Vocab.ts` (`VocabShape` keys) |
| prefixUse | use | Whether a prefix's terms are local, projected from gist, or alignment-only. Recorded beside the one registry, not in a second entry that stores the IRI again. | PrefixEntry | datatype from the record field (`PrefixUse`) | decision 4 (gist is the only parent) |

What each field becomes in the generated Turtle (the projector is report 12's; this is the contract it reads):

| Field | Emitted as | Never emitted |
| --- | --- | --- |
| `Vocabulary.namespace`, `version` | the `owl:Ontology` header with `owl:versionIRI` and `owl:versionInfo` (pending Q5) | a clock date, `prov:generatedAtTime` |
| `ClassTerm` | `inv:K a owl:Class` | |
| `prefLabel`, `definition` | `skos:prefLabel "…"@en`, `skos:definition "…"@en` (decision 11) | `rdfs:label`. The reverse of decision 11 would write it with the same text. It is not written. |
| `altLabel`, `scopeNote` | `skos:altLabel`, `skos:scopeNote` | |
| `parent`, `categoryParents` | `rdfs:subClassOf` the gist class or the local class, one triple each; nothing for a `none` link | the reason, which stays in the module |
| `kindTag`, `identity`, `source`, `scope`, `ratification` | nothing under Q1's recommended answer (they would need annotation properties with IRIs; report 12's `inv:termCategory` is the other answer) | |
| `DisjointGroup` | `owl:disjointWith` once per unordered pair of its members (report 12, section 5, rules 9 and 10: no blank node but a list) | `owl:AllDisjointClasses`, which needs a blank subject |
| `ObjectPropertyTerm` | `owl:ObjectProperty`, `rdfs:domain` and `rdfs:range` when declared (a local or gist class; a scheme range writes no `rdfs:range`, and the record's SHACL `sh:in` lists the concept IRIs, decision 23, as 10 section 6 and 12 say) | `owl:inverseOf`, any characteristic; a domain or range written "none declared" |
| `DatatypePropertyTerm` | `owl:DatatypeProperty`, `rdfs:domain` when declared, `rdfs:range` the xsd type of its fields' leaf or its stated datatype | `rdfs:range` when no field fills it and none is stated |
| `Vocabulary.gist` | `gist:X a owl:Class` for a name the slice needs and for that class's named ancestors (decisions 13 and 14), `rdfs:subClassOf` between projected classes, gist property declarations with `rdfs:subPropertyOf`, and one `owl:disjointWith` per pair gist states between admitted classes (decision 15) | a gist property's domain or range (decision 16); a gist name no term in the slice needs, including the rest of report 11's table B; `gist:Permission` in the thin thread, because `Role` ships without `permits` (decisions 13 and 41) |
| `subPropertyOf` | one `rdfs:subPropertyOf` triple when the field is set; nothing when it is absent | |
| `ConceptScheme`, `Concept` | `skos:ConceptScheme`; `skos:Concept`, `skos:inScheme`, `skos:notation`, `skos:broader`, and `skos:topConceptOf` when it has no broader | `skos:narrower`, `skos:hasTopConcept` (one direction only) |
| `alsoInstanceOf`, `conceptLinks` | `<concept> a owl:NamedIndividual` and the resolved class IRI (`inv:K` or `gist:X`), and one triple per link, in the OWL file. For `Role` the concept IRI is the individual, and it has one identity criterion, the concept's (decision 41). Whether the SKOS file stays out of the reasoner's closure is pending decision 28. Whether decision 62's disjointness, and gist's `gist:Aspect` pairs, must meet these individuals is pending decision 62. | a second IRI for the individual: the concept is the individual |
| `closed` | nothing: it guides the import and the review. The record schema's `sh:in` lists the concept IRIs of the field's own literals (decision 23) | |
| `TermPointer.path` | nothing in OWL; SHACL property shapes along the path (report 12, section 3.1) | |
| `AlignmentRow` with a CURIE object | one `skos:*Match` triple | `owl:sameAs`, `owl:equivalentClass` |
| `AlignmentRow` with a named object | nothing in Turtle; a row in the generated SSSOM (report 11) | a minted IRI under Sutton's or ISA-95's name |
| `Deprecation` | `owl:deprecated true`, the replacement and the version (pending Q4). The SKOS file carries the same status for a concept or a scheme, so a stored code stays identifiable and is not current | |
| `TermPointer`, `TermBinding` | nothing: the projector's join. `storedForm` is not a triple; it names the one record the projector targets (pending decision 48) | |

## 4. The schemas

All of this section is a sketch, not code. The paths are decision 9's: the metamodel and its reusable rules in a new
foundation package `@beep/vocabulary`, this repository's terms in `@inventory/kernel` under `./Terms` and
`./TermsPointer`, and the projector with the generated files in `@inventory/ontology`. `$I` is the package's identity
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
/** A scheme key: a class-shaped key that ends in "Scheme"; uniqueness against class keys is rule V3. */
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

/** A non-empty set of scope tokens. Foundation does not close the list. The inventory module closes it to
 *  repository, sutton and later, and those three are not exclusive (V15). */
export const TermScope = S.NonEmptyArray(S.String.check(S.isMinLength(1), S.isMaxLength(40))).pipe(
  $I.annoteSchema("TermScope", { description: "A non-empty set of scope tokens" })
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
    term: GistCurie.pipe(S.annotateKey({ description: "A gist class the slice has admitted (decision 13), not every name in report 11's table B" }))
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

// The same form, cases only. Foundation holds the shapes. The inventory module closes the names.
// TermSource:        seed { seed, section } | repository { path } | publicDocument { url, title }
//                    | standard { name, document } | new { reason }
//   Inventory: seed is architectureSeed or apiDesignReport. A Sutton citation is a publicDocument
//   the seed names, not a foundation literal.
// IdentityCriterion: stated { criterion, restsOn: Array<PropertyKey> } | inherited {} | notApplicable {}
//                    | unresolved { question, reidentifiedBy }
//   V18 reads restsOn, and also unresolved.question and unresolved.reidentifiedBy.
//   reidentifiedBy is the key a record is found again by (the project profile's reidentification key).
// AlignmentObject:   curie { curie: AlignmentCurie } | named { standard, name, document }
//   Inventory closes standard to ISA-95 and Sutton. Those two names are the inventory specialization.
```

`GistCurie` is the generic shape `gist:` plus an UpperCamel name at this level; the module narrows it to the keys of
`Vocabulary.gist.classes`, so `{ kind: "gist", term: "gist:Organisation" }` is a type error there. A gist property
curie is narrowed the same way, to the keys of `Vocabulary.gist.properties`.

The same form gives the targets a property names (sketch, not code):

```ts
// ClassTarget:  local { key: ClassKey } | gist { term: GistCurie } | none { reason }
// InstanceClass: ClassTarget's local and gist cases, without none (alsoInstanceOf)
// RangeTarget:  ClassTarget's three cases | schemes { keys: NonEmptyArray<SchemeKey> }
// PropertyParent: local { key: PropertyKey } | gist { term: GistPropertyCurie }
//   subPropertyOf is PropertyParent or absent. Absent emits no rdfs:subPropertyOf.
//   It is that predicate (decision 16). An inv: property may sit under a gist property only where its own
//   domain and range fall under the gist property's. Those gist domain and range axioms are not copied.
// CategoryParent: a ClassKey whose entry is tagged "category" (rule V21)
// TermRef:      class { key: ClassKey } | property { key: PropertyKey } | scheme { key: SchemeKey }
//               | concept { scheme: SchemeKey, notation: Notation }
//   The concept case is Curie<InvConceptVocab> (inv:<SchemeKey>-<notation>). It is not a class,
//   property or scheme key. AlignmentRow.subject and a lift path's concept fixed value use it.
//
// LiftPath: a non-empty list of steps. aboutPath, beside aboutClass, returns { readonly path }, not { readonly term }.
// Step: { property, reverse?, node?, iterate?, fixed?, valueMap?, fromSibling?, fromContext? }
//   iterate: one node per array element, named by list position (decision 10).
//   valueMap: a boolean or a tag literal to a named concept of the property's range scheme.
//   fromSibling: a value taken from a sibling field.
//   fromContext: "tenant" | "confirmation" | "instant".
// fixed is a list of { property, value }. value is FixedValue, checked against that property's range:
//   concept { curie: Curie<InvConceptVocab> }
//   individual { curie }     // a named individual of the range class (decision 88's currency)
//   literal { value }        // a datatype literal, such as minorUnitScale's integer
//   ref { ref }              // the tenant, a sibling field, the confirmation, or its instant
// One field may carry several paths when it fans out (dimensions).
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
  scope: TermScope.pipe(S.annotateKey({ description: "A non-empty set: repository when a binding names it; sutton and later are independent" })),
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
    range: RangeTarget.pipe(S.annotateKey({ description: "The class of its values, or the schemes they come from" })),
    subPropertyOf: PropertyParent.pipe(
      S.annotateKey({ description: "The gist or local property this sits under (decision 16); absent emits none" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    )
  }).pipe($I.annoteSchema("ObjectPropertyTerm", { description: "A relation, stated in one direction only" }))
) {}

export class DatatypePropertyTerm extends S.Opaque<DatatypePropertyTerm, { readonly brand: unique symbol }>()(
  S.Struct({
    ...termFields,
    domain: ClassTarget.pipe(S.annotateKey({ description: "The class whose instances have this attribute" })),
    subPropertyOf: PropertyParent.pipe(
      S.annotateKey({ description: "The gist or local property this sits under (decision 16); absent emits none" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
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
allows it. `subPropertyOf` is optional. A property with no parent emits none. An `inv:` property may sit under a
taken gist property only where its own domain and range fall under that gist property's (decision 16). The projection
copies the gist property's named parent and never its domain or range. A field whose
value is a notation of a scheme fills an object property with a scheme range: the record stores `"buy"`, the
projector writes the concept's IRI (decision 23). That replaces report 02's separate `references` annotation for id fields too: an
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
    alsoInstanceOf: InstanceClass.pipe(
      S.annotateKey({ description: "The local or projected gist class this code is also an individual of" }),
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
    subject: TermRef.pipe(S.annotateKey({ description: "The local term: a key, or a concept CURIE of InvConceptVocab" })),
    predicate: AlignmentPredicate.pipe(S.annotateKey({ description: "The mapping relation" })),
    object: AlignmentObject.pipe(S.annotateKey({ description: "A CURIE under a known prefix, or a named term" })),
    justification: TermSource.pipe(S.annotateKey({ description: "The document that shows it holds" })),
    confidence: Confidence.pipe(S.annotateKey({ description: "How sure the proposer was" })),
    ratification: Ratification.pipe(S.annotateKey({ description: "The record of the steward's acceptance" }))
  }).pipe($I.annoteSchema("AlignmentRow", { description: "One reviewed correspondence to another vocabulary" }))
) {}
```

`owl:sameAs` and `owl:equivalentClass` are not in the predicate list, so neither can be written. A gist parent is the
class's `parent`, never an alignment row (project profile). Decisions 39 and 43 bring back the four alignment rows
report 11 had removed (Sutton "Contact", `org:Membership`, FIBO's Contact, schema.org's `ContactPoint`). They are
ordinary rows of this shape. This report does not restate them.

### 4.6 Vocabulary

```ts
// sketch, not code: packages/foundation/modeling/vocabulary/src/Vocabulary.schema.ts
/** Foundation: an absolute https IRI ending in /, with no query. It does not know the placeholder host.
 *  External vocabulary namespaces stay on their own prefixes. Nothing here mints under Sutton or a customer domain. */
export const Namespace = S.String.check(S.isPattern(/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9-]+)+\/$/)).pipe(
  $I.annoteSchema("Namespace", { description: "The IRI every local key is appended to" })
)
/** Inventory profile, not foundation: one project base, and the term namespace derived from it.
 *  Before publication the host is still https://example.org/ (decision 7). Changing that guard does not edit foundation. */
export const InventoryNamespace = Namespace.check(
  S.isPattern(/^https:\/\/example\.org\/[a-z0-9-]+(\/[a-z0-9-]+)*\/$/)
).pipe($I.annoteSchema("InventoryNamespace", { description: "The placeholder namespace until publication" }))
// PrefixEntry, beside the one registry, stores no IRI: { prefix: bounded token, use: "local" | "gist" | "alignment" }
// GistProjection, decisions 13 to 16. Not all of report 11's table B.
// { release: { version, sha256 }, classes: { label, definition, parents, linkOnly },
//   properties: { parent }, disjoint: pairs gist states between classes already admitted }
// properties.parent is the named rdfs:subPropertyOf. Domain and range are not stored (decision 16).
// classes.parents includes named ancestors, as names and links only (decision 14).
// The thin thread admits gist:Person (decision 94), TemporalRelation and Assignment, and the gist parents
// of Organization and AuditEntry (decision 46). Each brings its ancestors (decisions 13 and 14). Tenant's
// parent is the local class Organization (decision 38). Role has no gist parent. Permission waits (decisions 13 and 41).

export class Vocabulary extends S.Opaque<Vocabulary, { readonly brand: unique symbol }>()(
  S.Struct({
    namespace: Namespace.pipe(S.annotateKey({ description: "Foundation shape. The inventory module decodes with InventoryNamespace" })),
    version: S.SemVerFromString.pipe(S.annotateKey({ description: "The version, written by hand (pending Q5)" })),
    gist: GistProjection.pipe(S.annotateKey({ description: "Gist names the slice needs, their ancestors, and the disjoint pairs among them (decisions 13 to 16)" })),
    prefixes: S.Array(PrefixEntry).pipe(S.annotateKey({ description: "The use of each prefix, beside the one registry; the IRI is not stored again" })),
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
filter that stops at the first. A fast test decodes the module's value through `Vocabulary` with
`{ onExcessProperty: "error", errors: "all" }` and requires `violations` to be empty. Effect 4.1.5 filters a record's
keys by the key schema's checks and by default drops a key that fails (`SchemaAST.ts` 2636-2640 and 3083-3089), so a
misspelt key such as `partyRecord` would otherwise disappear. The strict decode reports it as an unexpected key. A
negative fixture is an otherwise valid, unreferenced class under that wrongly cased key: the decode must fail.

### 4.7 How the module is written, and the Curie type

The hand-written value is a literal kept `as const`, so its keys are literal types, and checked with `satisfies`
against the schema's encoded side. It is decoded in a test, not built with `.make`, because `.make` returns the
decoded type and its keys widen to `string`.

```ts
// sketch, not code: packages/kernel/src/internal/terms/Terms.vocab.ts (decision 9, public entry ./Terms)
import type { CoreVocab, Curie } from "@beep/identity/Vocab"

export const namespace = "https://example.org/inventory-import/ontology/" as const   // decision 10; host stays the placeholder (decision 7)

export const classes = defineClasses({
  Organization: {                                         // report 06's term, shown only for the form. In the thin thread (decision 8).
    prefLabel: "Organization",
    definition: "…",
    parent: { kind: "gist", term: "gist:Organization" },  // the form. The thread admits the parent report 11 gives Organization (decisions 8 and 13)
    tag: "kind",
    identity: { kind: "stated", criterion: "The organization itself, the real body, not a tenant's record of it.", restsOn: [] },
    // Decision 34. The tenant's SourceRecord is a different class, reidentified by tenant, source system, source type and exact source id.
    source: { kind: "repository", path: "explorations/erp-ontology/research/01-starting-model.md" },
    scope: ["repository"],                                  // once the thread's pointer names it (V15)
    ratification: "rat-organization"                        // the rat- record's name (decision 32); the form only
  }
})
export type ClassKey = keyof typeof classes & string

export const objectProperties = defineProperties<ClassKey, SchemeKey>()({ /* domain and range typed by the keys */ })
export const datatypeProperties = defineProperties<ClassKey, SchemeKey>()({ /* same key pattern as object properties */ })
export type PropertyKey = (keyof typeof objectProperties | keyof typeof datatypeProperties) & string
export const schemes = defineSchemes({
  MemberRoleScheme: { /* viewer, editor, admin: the thin thread, decision 41 */ },
  GrantScopeKindScheme: { /* the one concept organization: the thin thread, decision 96 */ }
})
export type SchemeKey = keyof typeof schemes & string
export type ConceptName = `${SchemeKey}-${string}` // each scheme's own notations; not tried under tsrs

/** One stored registry, one IRI. The four Curie views below are slices of it (`{ iri, terms }`), not four copies
 *  of the namespace and not a second list of hand-written keys. Concept names are in `concepts`, or a concept CURIE
 *  fails `makeCurieFromIri`. The projector decodes with the slice for that position, not with the union. */
export const InvVocabValue = {
  inv: {
    iri: namespace,
    classes: [] as ReadonlyArray<ClassKey>,       // R.keys(classes)
    properties: [] as ReadonlyArray<PropertyKey>, // R.keys of both property tables
    schemes: [] as ReadonlyArray<SchemeKey>,
    concepts: [] as ReadonlyArray<ConceptName>
  }
}
export type InvClassVocab = { readonly inv: { readonly iri: typeof namespace; readonly terms: ReadonlyArray<ClassKey> } }
export type InvPropertyVocab = { readonly inv: { readonly iri: typeof namespace; readonly terms: ReadonlyArray<PropertyKey> } }
export type InvSchemeVocab = { readonly inv: { readonly iri: typeof namespace; readonly terms: ReadonlyArray<SchemeKey> } }
export type InvConceptVocab = { readonly inv: { readonly iri: typeof namespace; readonly terms: ReadonlyArray<ConceptName> } }
export type InvVocab = { readonly inv: { readonly iri: typeof namespace; readonly terms: ReadonlyArray<ClassKey | PropertyKey | SchemeKey | ConceptName> } }
export type InvCurie = Curie<InvVocab>
export type InvClassCurie = Extract<InvCurie, `inv:${ClassKey}`>
```

The public entry `./Terms` is this one vocabulary value. `Terms.pointer.ts` is the public entry `./TermsPointer`.
Runtime pointer construction imports neither the value nor a barrel that loads it. The inventory profile, not foundation,
closes scope tokens to `repository`, `sutton` and `later`, closes source and standard names, and checks
`InventoryNamespace`. Sutton and `example.org` in the examples above are that profile.

`defineClasses` is an identity function with an F-bounded `const` type parameter,
`<const C extends Record<string, ClassTermInput<Extract<keyof C, string>>>>(c: C) => c`, so a `local` parent or a
property's domain inside one object literal is checked against the keys of that same literal. If the type-checker
does not infer through that bound, the fallback is one object per level of the hierarchy, each typed against the keys
of the ones before, with the same rule also held at run time by `violations`. Neither was tried.

`Curie<V>` in `Vocab.ts` reads only `V[Prefix]["terms"][number]`, a union, so the registry's `terms` need not be a
tuple; `R.keys` is typed `Array<K & string>`, which keeps the union. `@prefix` lines and those Curie types are generated
from this one registry. A prefix's use (local, gist or alignment) sits beside it. `mergeVocab` replaces a whole prefix
of the base, so it is used only when the prefix is new, not to recopy `owl` or `xsd`. `CoreVocab` has no `xsd` or `gist`
prefix and no `owl:disjointWith`, `owl:AllDisjointClasses`, `owl:members` or `owl:versionIRI`: those terms are added to
the one vendored term list, in one place. `CoreVocab` also writes `https://schema.org/` where `namespaces.json` writes
`http://schema.org/`; report 11 picks one. Prefixes are unique, namespace IRIs are unique, exactly one prefix has use
`local`, and that prefix's IRI equals `Vocabulary.namespace` (V8). A duplicate, or a local prefix that points elsewhere,
fails `violations`.

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

/** A lift path. Returns `{ path }`, not `{ term }` (decision 20 includes this helper). */
export const aboutPath = (path: LiftPath): { readonly path: LiftPath } => ({ path })

/** A stated absence. Decision 21. A field may carry it (decision 93). */
export const noTerm = (reason: NoTermReason): { readonly noTerm: NoTermReason } => ({ noTerm: reason })

// sketch, not code: packages/kernel/src/Terms.pointer.ts, public entry ./TermsPointer
// Types only. Runtime construction imports neither the inventory value nor a barrel that loads it.
import type { InvClassVocab, InvPropertyVocab, InvSchemeVocab, InvConceptVocab } from "./internal/terms/Terms.vocab.ts"
export const aboutClass = pointerFor<InvClassVocab>()        // on a record schema
export const aboutProperty = pointerFor<InvPropertyVocab>()  // on a field
export const aboutScheme = pointerFor<InvSchemeVocab>()      // on a Literals schema: the scheme, not the class

// sketch, not code: in a contract package
export const StoredItem = S.Struct({ /* … */ }).annotate({
  identifier: "StoredItem",
  description: "An item as stored for one organization",
  ...aboutClass("inv:InventoryItemSpecification")            // 07 section 1: every stored item is one
  // storedForm: true illustrates decision 48(a) only. It is not a choice. At most one record of the class may set it.
})
// aboutClass("inv:ItemSpecifcation") does not compile: the argument is not in Curie<InvClassVocab>.
// aboutClass("inv:identifierText") does not compile either: a property cannot stand for a record.
// The same known property CURIE written by hand into the annotation, with no helper, is the projector's negative case.
```

Two slots. A Literals schema carries `aboutScheme` of its scheme: `Role` carries `aboutScheme("inv:MemberRoleScheme")`,
and `Uom` carries `aboutScheme("inv:UnitOfMeasureCodeScheme")`. The field carries `aboutProperty` of the property, which
may be class-ranged. `aboutProperty("inv:baseUnit")` on `uom` is that property pointer, not the scheme pointer.

Why a helper and not a declaration that adds `term` to Effect's `Annotations` interface: that interface has the index
signature `readonly [x: string]: unknown` (`Schema.ts`, `Annotations.Annotations`), so a misspelt annotation name
(`trem`) would still compile, and a module augmentation is one type for the whole program, which every package sees.
The helper writes the name itself and is typed per position. Decision 20 also augments `@alchemy.run/domain`'s
`Annotations` with that same `term` annotation. The augmentation is not Effect's `Annotations` interface, and it does
not replace the helpers. At run time the projector reads the annotation with
`S.resolveAnnotations` or `S.resolveAnnotationsKey`, gets `unknown`, and decodes it with the registry for that position
(class, property or scheme), or checks the resolved term's kind after decoding. `makeCurieFromIri` on one combined
registry is not the twin of that kind check: it fails only with "Unknown CURIE", so a known property CURIE written by
hand on a record annotation would decode.

A field's pointer is the last step of the field's pipe: `X.pipe(nullAsNone({ ... }), S.annotateKey({ ...aboutProperty("inv:p") }))`.
`S.resolveAnnotationsKey` reads the outer node's context only (`Schema.ts` 19232-19234). `nullAsNone`, `absentAsNone`
and `S.OptionFromOptionalKey` build a new outer node, so a pointer written before them stays on the wire side and is
not found, and `nullAsNone`'s argument takes only a description and `messageMissingKey`. A later `annotateKey` merges
with the wrapper's own key annotations (`SchemaAST.ts` 4546-4555). This is the one exception to SF-1's order
(description first): the description still goes first or inside the wrapper, the pointer last.

A record that stands for no term says so rather than leaving it out: `noTerm("transport")` for a transport payload
such as `UploadChunk` (report 01's representation layer), with the reason from report 12's closed list (transport,
request, screen, error, bookkeeping; decision 21), so a forgotten pointer can be told from a stated absence. Decision 22 requires every field of a record that points
at a term to carry a pointer or `noTerm` with a reason, and the SHACL shapes are closed. The thread's gates 5 and 7
are enrolled on the access contract and the four kernel records only (`Member`, `Role`, `Activity` and `AgentRun`;
decision 95). A catalog declaration, and a kernel schema outside those four, is not a missing pointer. The terms
placed there are `Organization`, `Tenant`, `Person`, `Member`, `Role`, `Grant`, `AuditEntry` (decision 46),
`MemberRoleScheme` and `GrantScopeKindScheme` (decision 96). `Role` is a Literals schema, so its pointer is
`aboutScheme("inv:MemberRoleScheme")`, which a class-annotation scan does not see. The `Member` record stands for
the membership. Its copied fields, the person's name, the organization's name and the sign-in email, are `noTerm`
with reason `screen` (decision 93). Only `role` is lifted, to its `Grant`, and that grant carries `grantScope`
(decisions 40 and 96). `organizationId` fills `membershipIn`, whose range is `Tenant` (decision 38). The link from
`Member` to `Person` is not a name or email path (decision 94). The party slice follows and adds the name path
through the person and the email path through the sign-in account.

A field whose value is not one property of its record's subject carries a lift path. The record's subject and the
subject reached before the last step are different. The thin thread's one lift is `Member.role` (decisions 8, 40 and 96).
Catalog and stock use the same steps later (sketch, not code):

```ts
// Thin thread. The record subject is Member. The subject before the last step is Grant (decisions 40 and 96).
// grantsRole is class-ranged over Role. The role concepts are also Role individuals (decision 41), so this is not a scheme leaf.
// The thread ships Role without permits, so this path has no permits step (decisions 13 and 41).
// The Grant carries grantScope, fixed to the one concept organization of GrantScopeKindScheme (decision 96).
role: RoleLiterals.pipe(S.annotateKey({ ...aboutPath([
  { property: "inv:grantedTo", reverse: true, node: "inv:Grant",
    fixed: [{ property: "inv:grantScope", value: { kind: "concept", curie: "inv:GrantScopeKindScheme-organization" } }] },
  { property: "inv:grantsRole", node: "inv:Role" }
]) }))
// Decision 38: membershipIn ranges over Tenant, not over every Organization.
organizationId: OrganizationId.pipe(S.annotateKey({ ...aboutProperty("inv:membershipIn") }))
// Decision 94: one link from Member to Person. It is not a path, and the name and email fields stay noTerm (decision 93).
// Decision 93, thin thread: copied fields are not facts about the membership.
personName: PersonName.pipe(S.annotateKey({ ...noTerm("screen") }))
organizationName: OrganizationName.pipe(S.annotateKey({ ...noTerm("screen") }))
email: Email.pipe(S.annotateKey({ ...noTerm("screen") }))
// Later slices, not the thread. The party slice writes the email path through SignInAccount. It is not drawn here.
sku: Sku.pipe(S.annotateKey({ ...aboutPath([
  { property: "inv:identifiedBy", node: "inv:ItemIdentifier",
    fixed: [
      { property: "inv:identifierKind", value: { kind: "concept", curie: "inv:IdentifierKindScheme-sku" } },
      { property: "inv:issuedBy", value: { kind: "ref", ref: "tenant" } }
    ] },
  { property: "inv:identifierText" }
]) }))
vendors: Vendors.pipe(S.annotateKey({ ...aboutPath([
  { property: "inv:offeredItem", reverse: true, node: "inv:VendorItem", iterate: true }
]) })) // ends on the class; nested fields carry their own paths
uom: Uom.pipe(S.annotateKey({ ...aboutProperty("inv:baseUnit") })) // property pointer; the Literals schema has aboutScheme
```

A step's `node` names the class of the node it reaches. `fixed` is a concept CURIE (`inv:<SchemeKey>-<notation>`, a
term of `InvConceptVocab`, not a class, property or scheme key), a named individual of the range class, a datatype
literal, or a reference to the tenant or a sibling field, checked against that property's range. `issuedBy` may be the
tenant (range `Organization`). `minorUnitScale` may be an integer. A value map sends a boolean or a tag literal to a
named concept of the range scheme (`lotTracked`, stocking). A sibling field supplies the unit of `quantityOnHand`,
`reorderPoint` and `unitCost` (from `uom`) and of the three dimensions (from `Dimensions.unit`). The lift's context
supplies the tenant, the confirmation and its instant. One field may fan out to several paths (`dimensions`). `reverse`
walks a property against its one direction, so the record never needs the inverse the vocabulary refuses (V5). `iterate`
makes one node per array element, named by list position (decision 10). These four constructs (value map, sibling,
context, fan-out) were not tried.

## 5. The rules

None of these checks is built. "Type-check" means the repository's `tsrs` run in `bun run check`; "decode" the fast
test that decodes the module through `Vocabulary`; "rules" the `violations` function in that test; "projector" and
"laws" are report 12's.

| # | Rule | Checked by | Fails as |
| --- | --- | --- | --- |
| V1 | Every ClassTerm has a `prefLabel`, a `definition` and one `parent`; a `none` parent carries a reason | type-check (required fields), decode | a missing-key error naming the class |
| V2 | Following live `local` parents and category parents from any class ends at a `gist` or `none` parent, with no cycle and no missing key (`Graph.directed`, `Graph.isAcyclic`, `Graph.findCycle` from `effect/Graph`). Under decision 33(a), which is open, a retained historical entry is not a live parent: a live parent or category parent whose target has retired is retargeted or removed. A historical replacement edge is not a parent | rules | the cycle or the missing key |
| V3 | Keys are unique within a kind by the object literal (a duplicate property is a compile error), and no key appears in two of the four tables (classes, schemes, objectProperties, datatypeProperties), checked by `violations`. A class key may itself end in `Scheme`, and the two property tables share one key pattern, so the patterns do not prevent a collision. A property key is lowerCamel and so differs from a class or scheme key. Notations are unique within their scheme. Negative examples: `MemberRoleScheme` as both a class and a scheme, and one key in both property tables (one IRI declared `owl:ObjectProperty` and `owl:DatatypeProperty`, outside OWL 2 DL) | type-check, decode, rules | the duplicate |
| V4 | Keys and notations match their patterns, and no property key is an RDF keyword. A negative fixture with an otherwise valid, unreferenced class under a wrongly cased key (`partyRecord`) must fail the decode | decode | an unexpected-key error naming the key (the strict decode); the pattern is not named |
| V5 | No inverse: the metamodel has no field for one, and the generated Turtle contains no `owl:inverseOf`; two object properties whose domain and range are swapped are listed for review, not failed | type-check (no field), projector (text check), rules (review list) | the property pair |
| V6 | No identity by mapping: the predicate list has no `owl:sameAs` or `owl:equivalentClass`; two local terms may not both `exactMatch` one external term, since that states they are one | type-check, rules | the two subjects and the object |
| V7 | `broader` names a notation of the same scheme, and the `broader` links of a scheme form no cycle | rules | the scheme and the cycle |
| V8 | An alignment row's subject resolves to a local term; its CURIE object's prefix is in the one registry and its use is gist or alignment, never the local namespace; a gist object is not also its subject's gist parent; no two rows share subject, predicate and object. Prefixes are unique, namespace IRIs are unique, there is exactly one prefix whose use is local, and that prefix's IRI equals `Vocabulary.namespace`. A prefix is a bounded token and its IRI is an absolute IRI. A duplicate, or a local prefix that points elsewhere, fails `violations` | type-check (prefix in the template literal type), rules | the row |
| V9 | A pointer resolves to a term of the kind its position needs: a record to a class, a field to a property, a Literals schema (on the AST: a `Union` whose members are all `Literal`; the check reads the members' `literal` values) to a scheme. The projector decodes with the registry for that position, or checks the resolved term's kind after decoding. `makeCurieFromIri` on one combined registry is not that check: a known property CURIE written by hand on a record would decode there. A field marked `noTerm` is not a property pointer (decision 93) | type-check (`aboutClass`, `aboutProperty`, `aboutScheme`), projector (the registry for that position) | the record and the CURIE, including that known property |
| V10 | Every exported schema of an enrolled set carries a pointer or a stated `noTerm`, and every field of a record that points at a term carries a pointer or `noTerm` with a reason (decision 22). For the thin thread that set is the access contract and the four kernel records only (`Member`, `Role`, `Activity`, `AgentRun`; gates 5 and 7, decision 95). The terms placed there are `Organization`, `Tenant`, `Person`, `Member`, `Role`, `Grant`, `AuditEntry` (decision 46), `MemberRoleScheme` and `GrantScopeKindScheme` (decision 96). `Member`'s copied name and email fields are `noTerm` with reason `screen` (decision 93). A catalog declaration, and a kernel schema outside those four, is not a missing pointer | laws (report 12's `laws ontology-terms`) | the schema's identifier |
| V11 | Datatype compatibility uses the type side and the numeric checks, as report 12 section 1.2: `isInt` is `xsd:integer`, a number that is not `isInt` is `xsd:double`, and representation id `effect/schema/BigDecimal` is `xsd:decimal`. The encoded side is used for lexical form and constraints (pattern, length), not for the datatype. `UnitCost`'s type side is `BigDecimal` even though the wire leaf is string. An integer and a float filling one property still need the stated `xsd:decimal` conversion of decision 50 (an integer as its digits; a float as its shortest round-trip digits; a decimal digits string to `xsd:integer` minor units by `digitsAtScale(n)`, decision 59). Checks such as patterns may differ | projector | the property and the two fields with their leaves |
| V12 | A field that carries `aboutScheme` is checked whether or not the filled property's range is a scheme. It is a Literals schema (on the AST: a `Union` whose members are all `Literal`; the check reads the members' `literal` values) each of whose literals is a notation of that scheme; a field may allow a subset (section 7). A missing scheme notation is an error only when the binding is declared to cover the whole scheme, and then the two sets are equal. The failure names the field and each literal that is not a notation, not an unused scheme concept. A field with a value map need not be a Literals schema. When the filled property is class-ranged, each of those notations is also a concept whose `alsoInstanceOf` resolves to that class or a subclass (`baseUnit` and `unit` over `UnitOfMeasure`; `grantsRole` and `maxRole` over `Role`). Those properties keep their class ranges. A retired notation may stay in the decoding literals so a stored code still reads (decision 33, open); that is not a live assignment. A schema annotation that names a retired term is a different case (V14) | gate 4 (report 12), over the bindings | the field and each literal that is not a notation of the scheme |
| V13 | A direct `aboutProperty` field is checked only when that property's domain is a declared local or gist class, and then the record's `aboutClass` must name that domain or a subclass of it. A property whose domain is the `none` case is not checked here; the record's own shape says where it may sit. A field whose pointer is a lift path is not checked here; V23 checks the path. The record's subject and the subject reached before the path's last step differ: `Member.role` is stored on a member and fills `grantsRole` only after a reversed step to `Grant` | projector | the field, its record's class and the domain |
| V14 | `replacedBy` names the immediate same-metatype successor at retirement. The successor exists, and replacement edges form no cycle; the check does not require each target to stay live. Following the chain to a live term is not the same case as a retirement with a reason and no successor. A deprecated term keeps its label and definition. `since` is not later than the module's version. A term with no replacement has a reason. No pointer names a deprecated term. A historical notation that still resolves through a live scheme or property is not that pointer. Under decision 33(a), which is open, a live parent, category parent, domain, range or active disjointness reference to a retired term is retargeted or removed; a historical replacement edge is not such a dependency | rules, projector | the term |
| V15 | A term's `scope` is a non-empty set. In the inventory profile the only tokens are `repository`, `sutton` and `later`. `repository` is a member if and only if at least one TermBinding names that term. A TermBinding is a schema pointer, not a SQL table. `sutton` and `later` are independent, and a missing binding does not imply them. Scope is compared with the active slice's bindings, not with every schema the vocabulary will one day cover. The thin thread's bindings are the records and fields it places: `Organization`, `Tenant` (decision 38), `Person` (decision 94), `Member`, `Role` by `aboutScheme("inv:MemberRoleScheme")`, the `role` path to `Grant` with `grantScope` (decisions 40 and 96), `GrantScopeKindScheme` and `AuditEntry` (decision 46). `Member`'s copied name and email fields are `noTerm`, not bindings (decision 93). The link to the person is a binding, and a name or email path is not (decision 94). A catalog declaration, and a kernel schema outside the four records decision 95 enrols, is not a missing pointer | rules, given the bindings | the term and its bindings |
| V16 | A disjoint group has two or more members, each a class whose tag is rigid (kind, subkind, relator, event, information, value), none an ancestor of another, and no two groups list the same members | rules | the group |
| V17 | Tag and identity agree: kind, relator, event, information and value carry `stated` or `unresolved`; subkind and phase carry `inherited`; a role whose parent link is a local class carries `inherited` (the bearer's criterion); a role with no local parent, and every category, carry `notApplicable`. `Tenant` is the inherited case, and the thread ships it under `Organization`, keyed by `OrganizationId` (decision 38). `Role` is the exception decision 41 states: its individuals are the concepts of `MemberRoleScheme` under the same IRI, and that individual has one identity criterion, the concept's, its scheme and its notation. That criterion is `stated` on `Role`. It is not the bearer's and it is not `notApplicable`. The thin thread ships `Role` without `permits` | rules | the class |
| V18 | On a `stated` criterion, and on `unresolved.question` and `unresolved.reidentifiedBy`, a `restsOn` that names `name`, `identifierText`, `identifierKey`, `email` or `accountEmail` fails, and a sentence that mentions a SKU, a name or an email is listed for review (project profile; 04's CQ-I08; the brief's no-go). Writing the criterion only under `unresolved` does not escape the check. A class under `gist:ID` may rest on `identifierText` or `identifierKey` when the criterion also includes the issuer and the kind or the scheme (`ItemIdentifier`, `TrackingCode`, `PartyIdentifier`). The thing the identifier refers to may not (`ItemSpecification`, `Person`, `Organization`, lots, labels) | rules (a failure on `restsOn`; a review list on the sentence, since a word match cannot judge meaning) | the class and the property or sentence |
| V19 | A definition does not contain its own label, and no two classes or two schemes share a label | rules (review list) | the term |
| V20 | Foundation checks that a namespace is an absolute IRI. The inventory module derives the term namespace from one configured project base and, before publication, still requires the host `https://example.org/` (`InventoryNamespace`, decision 7). External vocabulary namespaces stay on their own prefixes. No IRI is minted under Sutton's domain or a customer's subdomain. Changing the host guard is an inventory-module change, not a foundation edit | decode (inventory `InventoryNamespace`), projector | the IRI |
| V21 | A category parent is a local class tagged `category`; a category class names no identity (`notApplicable`), is in no disjoint group, and is never a class's `parent` link (pending Q8) | rules | the class |
| V22 | A concept's `alsoInstanceOf` names a local class or a projected gist class (`InstanceClass`: `ClassTarget`'s `local` and `gist` cases, not `none`). A local target is allowed when its tag is kind, value or information, or when its tag is subkind and following local parents reaches a class with one of those tags (`PackagingUnit` under `UnitOfMeasure`). A gist target is allowed when the slice has admitted it (`gist:Aspect` only once a term needs it, decision 13, not the whole of report 11's table B). The check reads the resolved class, not only the immediate tag. Concepts of `MemberRoleScheme` are individuals of `Role` even if `Role`'s tag is `role` (decision 41). This does not answer decision 61. Each `links` entry names an object property whose domain covers that resolved class, local or gist, and whose range is the scheme of the linked concept | rules | the concept and the link |
| V23 | Each step of a lift path names an existing property. A forward step's domain covers the node it leaves and a reversed step's range does. The node a step leaves is not always the record's subject. A path may end on a class node when nested fields carry their own paths (`vendors` ends on `VendorItem`). The last step is a datatype property, or an object property with a scheme range, only when the field's own value is that leaf. A class-ranged last step is allowed when each notation is a concept whose `alsoInstanceOf` resolves to that class or a subclass (`grantsRole` and `maxRole` over `Role`; `baseUnit` and `unit` over `UnitOfMeasure`); V12 checks the notations. A `fixed` value is a concept CURIE of the range scheme (`inv:<SchemeKey>-<notation>`, a term of `InvConceptVocab`, not a class, property or scheme key), a named individual of the range class (the currency of decision 88), a datatype literal (`minorUnitScale` as an integer), or a reference to the tenant or a sibling field (`issuedBy` as the tenant, range `Organization`), checked against that property's range. A value map sends a boolean or a tag literal to a named concept of the range scheme (`lotTracked`, stocking). A value may come from a sibling field (the unit of `quantityOnHand`, `reorderPoint` and `unitCost` from `uom`; the three dimensions from `Dimensions.unit`) or from the lift's context (tenant, confirmation, its instant). One field may fan out to several paths (`dimensions`). The thin thread's one lift is that case, not a conditional reading (decisions 8, 40 and 96): `Member.role` reverses `grantedTo` onto `Grant`, fixes `grantScope` to `inv:GrantScopeKindScheme-organization`, then follows `grantsRole`. There is no `permits` step in the thread (decision 41). `Member`'s copied name and email fields are `noTerm` with reason `screen` and are not paths (decision 93). The link from `Member` to `Person` is not a path (decision 94) | type-check (property CURIEs by `InvPropertyVocab`, node classes by `InvClassVocab`, a `fixed` concept by `InvConceptVocab`), projector (domain and range cover, the last step's kind) | the record, the field and the step |
| V24 | A stated `datatype` on a property that a field fills agrees with V11; a stated datatype that every field now matches exactly is listed for removal | rules (review list) | the property |
| V25 | A class's tag is one the gist class it first reaches admits: `gist:Event` and its subclasses, event; `gist:Content` and its subclasses, information; `gist:Magnitude`, value; `gist:TemporalRelation` and `gist:Assignment`, relator; `gist:Commitment`, `gist:Agreement` and `gist:Offer`, relator or kind; `gist:Specification`, `gist:CatalogItem`, `gist:TaskTemplate`, `gist:Permission` and `gist:Restriction`, kind or information; any other gist class, kind; a `none` parent, category. A subkind, role or phase is checked through its local parent | rules | the class, its tag and the gist class |
| V26 | Every gist parent on a class, every `ClassTarget` of kind gist and every gist `subPropertyOf` names a gist entry the slice has admitted (decision 13), not a name from report 11's table B that nothing in the slice uses. A gist property parent is one report 11's section E names and that a taken property needs. Admitting a class admits its named gist ancestors, as names and links only (decision 14). A local `subPropertyOf` names a local property key. Each copied disjoint pair names two admitted classes, and only pairs gist states between those classes are copied (decision 15). The whole design of reports 04 to 12 is 24 such pairs. The thin thread copies only the pairs among the classes it admits. A sub-property is emitted only when its domain and range fall under the gist property's domain and range (decision 16). Those gist domain and range axioms are read from the pinned release and are not copied. A property with no parent emits none. The thin thread admits `gist:Person` (decision 94), `TemporalRelation` and `Assignment`, and the gist parents report 11 gives `Organization` and `AuditEntry` (decision 46), each with its named ancestors (decisions 13 and 14). `Tenant` is under the local class `Organization` (decision 38). It does not admit `gist:Permission`, and it does not parent `Role` under anything, because `Role` has no gist parent and ships without `permits` (decisions 13 and 41) | rules | the property or class, and the missing gist entry |

V19 is a review list, and V18 is one for its sentence part, because a word match cannot tell a circular definition
from a quoted one; the rest fail the check. V25 was added on 2026-11-22 after a review found relator tags on
descriptions and content (07's `BomLine`, 06's `PortalAccess`, 09's `LineAllocation`) that no other rule caught.
V26 holds the gist projection and `subPropertyOf` together. Decisions 13 to 16 are answered. A gist name is admitted
when a term in the slice needs it (13), its named ancestors come with it as names and links only (14), disjointness is
the pairs gist states between admitted classes and no others (15), and a sub-property link copies no gist domain or
range (16). There are twenty-six rules, V1 to V26.

## 6. One term with several records, and a term with none

Both are the same thing seen from the binding table: a term has zero or more bindings, and the projector emits every
term whatever its count.

Several records. Report 07's item term is today stood for by `ItemFields` (what an item needs before it is stored) and
`StoredItem` (which spreads `ItemFields.fields` and adds `id`, `createdAt`, `createdBy`, `revision`). Each carries
`aboutClass("inv:InventoryItemSpecification")` (07 section 1: every stored item is an inventory item specification).
V13 still passes, because the item properties' domain `ItemSpecification` is that class's parent. The projector finds
two bindings and emits one `owl:Class`. The import's staged row is not a third: it is what the file said, and points at
09's `FileRow` (report 07, section 1). The `sku` field object is shared by the spread, so its lift path to
`inv:identifierText` (07's) has two field bindings with one leaf, and V11 passes. The contract `ItemEdit` is `noTerm`
with reason `request`. Its fields do not carry the item's `aboutProperty` pointers: a request is not an item, and those
fields would fail V13. `storedForm` on a term pointer is pending decision 48. At most one record of a class may set it,
and the projector targets only that record. `StoredItem` is the illustration of decision 48(a), not a choice made here.
Which record's shape SHACL aims at the class is report 12's.

No record. A class met only in Sutton (a sales order, report 09's) is an entry with `scope: ["sutton"]` and no
binding. It is emitted with its label, definition and parent; it has no SHACL shape, because there is no stored row to
check. A datatype property with no field is emitted with its domain and no `rdfs:range`, which OWL allows; it gains
its range on the day a field fills it. An object property is complete with no record, since its range is in the
module.

A record with no term is the opposite case and is refused by V10 unless it says `noTerm`.

## 7. A record's literals and a scheme's notations

Decision 2 gives each fact one home: the vocabulary owns what a code means (its label, definition, broader code and
alignments); the record schema owns which codes a field allows. So a record writes its own `Literals`. Decision 23
chooses the concept: the record keeps storing the notation, the projector lifts it to the concept's IRI, and `sh:in`
lists the concept IRIs of the field's own literals. Every code a field allows must be a notation of its scheme. A field
may allow fewer than the scheme has. `Uom` allows five of the seven units, and `Dimensions.unit` allows two (`cm` and
`in`). A missing scheme member is an error only for a field explicitly required to cover the whole scheme. The failure
names each literal that is not a notation, not an unused scheme concept. A schema that is declared to be the whole
scheme must be equal. The thin thread's `MemberRoleScheme` holds viewer, editor and admin, and `GrantScopeKindScheme` holds the one concept organization (decision 96). A tenant's custom role is
another individual of `Role`, with the same identity criterion (decision 41). Historical decoding of a code the field
used to store is decision 33, which is open, and is not a live assignment.

```ts
// sketch, not code: in a contract package; the literals are the record's, the pointer names the scheme
export const ItemRole = LiteralKit(["buy", "make", "sell"]).pipe(
  S.annotate({ ...aboutScheme("inv:ItemRoleScheme") })
)
// gate 4 (V12): each of ItemRole's literals is a notation of inv:ItemRoleScheme; "steal" fails as the field and that
// literal, not as an unused scheme concept. ItemRole is not declared to be the whole scheme, so a notation the field
// leaves out is not a failure. A new concept changes no record until the record schema adds it.
```

A first sketch built the literals from the scheme (`notationsOf(schemes.ItemRoleScheme.concepts)`), so that a new
concept reached every record at once. That gave the vocabulary module a home for which values a field allows, which
decision 2 gives the record schema; it is withdrawn here. If Benjamin wants the codes to have that one home instead,
decision 2's wording changes ("a change to an allowed value is a proposed change to a record schema") and that is his
call, not a design choice.

Before this is trusted, try, under this repository's `tsrs` (TypeScript 7.1 beta here, not `tsc` 5):

1. A schema whose literal is not a notation of its scheme fails gate 4 with the field and that literal. A notation the
   field does not list is an error only when the field is declared to cover the whole scheme.
2. A deprecated concept, conditional on decision 33, which is open. Distinguish a schema annotation that names a retired
   term (V14 refuses that pointer) from a historical notation that still resolves through a live scheme or property.
   Take one hypothetical retired role notation. A stored member still reads it. Saving the member without changing the
   role keeps it. The role picker does not list it. A command that sets the role to it is refused. The decoding
   `Literals` may still contain it while a `LiteralKit.omit` subset is what a screen offers.
3. The one vocabulary value is the public entry `./Terms`. `./TermsPointer` builds pointers and imports neither that
   value nor a barrel that loads it. `bun run --cwd apps/inventory build:report` shows the definitions' text is not in
   the browser's bundle. If decision 58(a) is selected, run the same report with the catalog screen that consumes the
   labels. Selected labels may be present; term definitions and the full registry must not be.
4. The type-check time of a module with a few hundred keys, against today's.

## 8. Names, IRIs and versions

Keys and local names:

- A key is the IRI's local name exactly: `Organization` is `inv:Organization`, `isCustomer` is `inv:isCustomer`.
  Classes and schemes are UpperCamelCase, properties lowerCamelCase, letters and digits only. Decision 34 puts the
  customer and vendor flags on the tenant's `SourceRecord`, not on `Organization`. CQ-P01 reads them there. The key
  shape does not choose the subject.
- Acronyms are written as words (`BomLine`, `GtinCode`, `itemId`), as the repository's identifiers already are
  (`ItemId`, `ImportId`). The API design report's exception for an all-capital `ID` is not followed: the records and
  the terms would then spell one word two ways.
- A scheme key ends in `Scheme` (`ItemRoleScheme`), as both seeds write it; report 02's sketch wrote `inv:ItemRole`.
  A record's Literals schema may still be called `ItemRole` in code.
- No key is an RDF keyword (`domain`, `range`, `label`, `type`), per `naming-conventions.md`.
- A label is written by hand, sentence case as the module writes it ("Item roles"), and may change in a patch; a key
  never changes. A notation is the stored value and never changes either; a label correction is compatible, a change
  of meaning is a new term and a deprecation (the architecture seed, section 6). A rename creates a new identifier and
  leaves the original retired. Report 12's historical inventory comparison detects a disappearance against the previous
  release; it does not detect every change of meaning. A major number is not permission to rewrite a stored key.

IRIs (decision 10):

- One configured project base is written once, and the term namespace is derived from it. The placeholder is
  `https://example.org/inventory-import/ontology/`, which `namespaces.json` gives (decision 7). The host restriction is
  the inventory module's prepublication guard (V20), not a foundation rule. External vocabulary namespaces stay on
  their own prefixes. Nothing is minted under Sutton's domain or a customer's subdomain.
- Classes, properties and schemes sit directly under it: `inv:Organization`, `inv:isCustomer`, `inv:MemberRoleScheme`.
- A concept is its scheme's key, a hyphen and its notation, under the same namespace:
  `inv:MemberRoleScheme-admin`, `https://example.org/inventory-import/ontology/MemberRoleScheme-admin` (decision 10).
  This report first proposed `ItemRoleScheme/buy`, and report 10 proposed the hyphen. Decision 10 chooses the hyphen.
  The scheme qualifies it, so `active` of one lifecycle is not `active` of another (the architecture seed's flat
  `tax:Buy` form collides there), and the notation, which never changes, is the last part, not the label. A hyphen
  needs no escape in a Turtle or SPARQL prefixed name, so fixtures, queries and alignment rows write concepts as
  CURIEs; a notation is letters, digits, `.`, `_` and `-` (the `Notation` pattern), all legal in a local name.
- The ontology IRI is the namespace without its last `/`; its version IRI appends the version
  (`…/ontology/0.1.0`), as the architecture seed does.

Versions (pending Q5): the module states its version as a literal, and the header reads it from there, never from the
clock, so the byte-compare of decision 6 holds. The proposal: semantic versions, `0.x` until something is published.
Classify a bump by what already conforming data and already answered questions do, not by the kind of edit. A patch
changes wording only (a label, a definition, a scope note, an alternative label) or adds an alignment row. Adding a
term or a concept that no existing data must already satisfy is a minor. Adding a disjoint group is not always a minor:
an individual that is already both of the new members stops conforming, and that is major. Deprecating a term is not
always a minor either. Reparenting, or no longer emitting a retired parent's axiom, can remove a competency-question
answer the previous release gave; when the answer is lost, that is major. Narrowing a domain or a range, or changing
the namespace, is major. Do not give every disjoint addition, every retirement or every reparent the same bump. A key
and a stored notation never change in place. A major number is not permission to rewrite one. Meaning is never changed
in place. Whether a check refuses a change to the generated Turtle with no change of version is report 12's; release
notes are the curator's.

Deprecation (pending Q4): a deprecated entry stays in the module for good. `replacedBy` is the immediate successor of
the same metatype at the moment of retirement. The check requires that successor to exist and the replacement edges to
form no cycle. It does not require each target to stay live: when B replaces A and C later replaces B, A's edge to B
remains the fact of that retirement. Following the chain to a live term is a different question from a retirement that
has a reason and no successor. `owl:deprecated true` and `dcterms:isReplacedBy` (already in `CoreVocab`) go in the OWL
file, and the version as `skos:historyNote` ("Deprecated in 0.4.0."). The SKOS file carries the same Deprecation value
as the status of a concept or a scheme, so a stored code stays identifiable and is not treated as current. Under
decision 33(a), which is open, the entry's logical axioms (parent, disjointness, domain, range) are no longer emitted,
as report 12 writes it. A live parent, category parent, domain, range or active disjointness that still names the
retired term must be retargeted or removed. A historical replacement edge is not such a dependency. The entry is never
deleted, because a stored IRI or notation may still name it.

## 9. Where the module lives

What the repository's rules allow today (`packages/tooling/tool/cli/src/commands/Laws/Boundaries.rules.ts`,
`allowed` and `contextMay`): a context's contract may import only the kernel and the foundation; the kernel may
import only the foundation; and a tooling package, where a `bun run beep` command such as a projector would live, may
import only the foundation. So a vocabulary in the kernel can be pointed at by every contract, but the repository's
command line cannot import it without a new row in that rule. Decision 9 chooses the three homes, and does not add
that command-line row. The metamodel and its reusable rules live in `@beep/vocabulary`. This repository's terms live
in `@inventory/kernel`, under `./Terms` (the vocabulary value, for the projector and tests) and `./TermsPointer` (the
pointer helpers, importing the registry as types only). The projector and the generated files live in
`@inventory/ontology`, which the app, the kernel, the contexts and tooling do not import in production code. Each gets
its row in `laws boundaries`. The writer belongs to the ontology workspace, and no product import is added to the
repository CLI. File names take a role suffix outside `internal/`
(decision "file naming" of the ideal-architecture exploration); `.vocab.ts` and `.pointer.ts` would be new suffixes.

## 10. What the term documents needed that this model first lacked

Read from 04 and 06 to 12 on 2026-11-22; each is now a field, a value or a rule above.

| Need | Who wrote it | Now |
| --- | --- | --- |
| A class under a local category and its own gist parent | 06 (`Party` over `Person` and `Organization`) | `categoryParents`, `CategoryParent`, V21 (pending Q8) |
| A domain or range that is a projected gist class | 07 (`gist:Specification`, `gist:Offer`, `gist:Intention`, `gist:Content`), 08 (`gist:Event`, `gist:Commitment`), 09 (`gist:Event`, `gist:Intention`) | `ClassTarget` with a `gist` case |
| A domain left undeclared with a reason | 06 (`inTenant`), 08 (`forItem` and its kin), 09 (`sourceLocation`, `hasReason`), 10 (`lifecycleState`) | `ClassTarget` with a `none` case; V13 does not apply to that case |
| A range over concepts of several schemes | 09 (`hasReason`), 10 (`lifecycleState`) | `RangeTarget` with a `schemes` case |
| A datatype stated before any record field fills it | 07 ("no record yet: an exact decimal"), 09 ("moves to the record schema") | `DatatypePropertyTerm.datatype`, V11, V24 |
| One property filled by fields of different leaves | 07 (`numericValue` from integers and floats) | V11 with a stated datatype (pending decision 50) |
| A code that is also an individual of a class | 07 and 10 (units), 06 and 10 (member roles) | `alsoInstanceOf`, V22. `Role` is decided (decision 41). Units stay pending decision 61. |
| A fact on a concept that points at another scheme | 10 (`hasDimension: count` on a unit) | `links`, V22 |
| Whether a scheme is closed | 10 (rule 5) | `ConceptScheme.closed` |
| A flat field that becomes a node or a path | 07 (`sku`, `unitCost`, `vendors`), 08 (`quantityOnHand`); the thin thread lifts only `Member.role` to a `Grant` that carries `grantScope` (decisions 8, 40 and 96); the link to `Person` is not a path (decision 94) | `TermPointer.path`, `LiftPath`, V23, including a value map, a sibling value, a context value and a fan-out |
| A record with no term, and why | 12 (`noTerm`, closed list); decision 93 on three fields of `Member`; decision 22 on every field of a pointed record | `NoTermReason`, including reason `screen` on a field |
| A source that is a published standard, or Sutton as a seed cites it | 06, 09, 11 | `TermSource` |
| Disjointness written without a blank node | 12 (section 5, rules 9 and 10) | `DisjointGroup` emitted pairwise |

Not taken into the model: 12's `inv:termCategory` (the other answer of Q1, decision 19), and a tag on properties
(Q12's option C).

## Questions for Benjamin

Moved on 2026-11-22 to the packet's [DECISIONS.md](../DECISIONS.md), "Open", merged with the other reports'
questions. A "(pending Qn)" mark in this report means: Q1 is decision 19, Q2 is 10, Q3 is 11, Q4 is 33, Q5 is 24,
Q6 is 20, Q7 is 9, Q8 is 12, Q9 is 31, Q10 is 32, Q11 is 29, Q12 is 18, Q13 is 33. Q2, Q3, Q6, Q7 and Q10 were
answered the same day (decisions 10, 11, 20, 9 and 32), and those pending marks are gone. Decisions 22, 26, 38, 46
and 94 to 96 are decided too; this report never marked them pending. The marks that remain are open. An open
recommendation is the agent's, and nothing is built on it. The thin thread waits on none of them.

## Not checked

- No sketch was compiled or run. Every Effect name used was found in `node_modules/effect/src` (Effect 4.1.5):
  `S.Literals`, `S.TemplateLiteral`, `S.NonEmptyArray`, `S.OptionFromOptionalKey`, `S.withConstructorDefault`,
  `S.withDecodingDefaultTypeKey`, `S.toTaggedUnion`, `S.tag`, `S.SemVerFromString`, `S.Trimmed`, `S.isMinLength`,
  `S.isMaxLength`, `S.isPattern`, `S.isBetween`, `S.Finite`, `S.resolveAnnotations`, `S.resolveAnnotationsKey`, the
  `Annotations.Annotations` interface, `Tuple.make`, `Tuple.map`, `R.keys`, and `effect/Graph`'s `directed`,
  `isAcyclic` and `findCycle` (marked unstable). Their behaviour in these sketches was not tried.
- The section 7 list was not tried, nor the F-bounded `defineClasses`, nor the Turtle rule on `/` in a prefixed name
  against an N3 parser. Decision 26 chooses N3.js for the re-parse and Oxigraph for SPARQL in the thread, and shacl-engine with the SHACL slice; none of that was run here. Whether `annotateKey` on a field that already has a pointer keeps it was read in the source
  (`SchemaAST.ts` 4546-4555: a later `annotateKey` merges), not run. The strict decode's behaviour on the nested
  `Concept.links` record was read in the source, not run. The four lift constructs (value map, sibling value, context
  value, fan-out) were not tried. The per-kind registries and the template-literal concept union were not tried under
  `tsrs`.
- `tsrs` (TypeScript 7.1 beta) inference of `const` type parameters and `satisfies` was assumed from TypeScript 5.
- Report 02's beep-effect paths (`VocabularySeed`, `ConceptAlignment`) were not opened here.
- The seed reports were read in their sections on namespaces, gist, taxonomy governance, the core header, the
  governance classes, the taxonomy file's opening and the correspondence register; the rest was not read for this
  report. The API design report's claim that gist renamed `CatalogItem` and deleted `Magnitude` disagrees with
  `gist-categories.md`, which found both in 14.1.0; this report follows `gist-categories.md` and did not re-check.
- The other designers' reports (04, 06 to 12) did not exist when this was first written; the keys used here were
  matched to them on 2026-11-22 (report 13). The fields added in section 10 were not compiled either.
- `bun run docs:check` passed before this revision (92 files under `explorations/` then). This revision was not run through it, and nothing else was run.
