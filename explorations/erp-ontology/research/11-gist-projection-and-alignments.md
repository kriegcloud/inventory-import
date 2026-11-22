---
type: Research
title: The gist projection and the alignments
description: Which gist 14.1.0 names the vocabulary takes and leaves, and the alignment rows to other vocabularies.
---

# The gist projection and the alignments

Design only: nothing here is built. This document mints no `inv:` class or property. It owns two lists that every term
document reads: (a) the gist projection, the gist names the vocabulary module may use as parents, and (b) the
alignment rows from `inv:` terms to other vocabularies. Every subject below is a term owned by another document of this
round, written as its likely Key (04 requirements, 05 term-model, 06 party-and-access, 07 catalog-and-value,
08 warehouse-and-stock, 09 commitment-and-event, 10 taxonomies, 12 projection-and-checks). Where that document chooses
another Key or another parent, its choice wins and the row here follows it: on 2026-11-22 every subject and placement
below was matched to the owners' keys (report 13). Answered choices are decisions 13, 14, 15 and 16 (this report's Q3,
Q4, Q1 and Q2), and 8, 34, 38, 39, 40, 41, 43, 46, 93, 94 and 96 where they change a parent, a flag, an alignment or
what the thin thread admits. Open choices stay
numbered decisions in [DECISIONS.md](../DECISIONS.md), mapped from each remaining Qn under "Questions for Benjamin".

The vocabulary module, the projector and the generated Turtle do not exist. TypeScript and Turtle below are sketches,
not code.

## What was read

Every external name in this document was found in the file named here, read on 2026-11-22 by streaming it from its
publisher and searching it for the subject line; nothing but the pinned gist copy is kept on disk. "Fetched" in a
row means that file; "from memory, unchecked" means no file was read for it.

| Short name | What | Version and checksum |
| --- | --- | --- |
| [gist] | Semantic Arts gist, `ontologies/gistCore.ttl` at tag `v14.1.0` of `semanticarts/gist` | 14.1.0, 3,421 lines, sha256 `0d8230f3a4df9aa7782ec79bfa83def34a13a066f60d5f5ef0f00b9cecce08b1`, fetched at the tag and equal to the copy pinned in `project-profile.md` |
| [IOF] | IOF Core, `core/Core.rdf` | versionIRI `.../ontology/202603/core/Core/`. Two copies read: the architecture seed's pinned commit `cbb4fe62` (sha256 `7e44642681ded2b24a3a3d316df05144c3661e2ed594f31491ea61bfda8f9be8`, 90 construct classes) and a copy read earlier today (sha256 `bdd9271a6ed190e6c0ac8a01d2728ccd517ad33913c436b3882679dfcf94cfde`, 91). Every IOF name below is in both |
| [B2MML] | MESA B2MML, the XML Schema binding of ISA-95 (`MESAInternational/B2MML-BatchML`) | Version 0701, commit `65cc6653` (2023-07-11). Files read: Material, Equipment, OperationalLocation, Personnel, OperationsSchedule, OperationsPerformance, OperationsDefinition, OperationsEvent, WorkDefinition, Common. The ISA-95 text itself is licensed and was not read |
| [SDO] | schema.org, `schemaorg-current-https.ttl` | V30.1, sha256 `7f15ca89398c4f235f478a4b3b8d1f975d63c5a860b77c8a8fce01f791b7ae2f` |
| [ORG] | W3C Organization Ontology, `org.ttl` | sha256 `3e01f89a17475a88f8b1606ca0fae04800d34dbbf93adc6db12dc30929848729` |
| [FIBO] | FIBO modules, RDF/XML, `master/latest` | FND ProductsAndServices, CurrencyAmount, Addresses, AgentsAndPeople/People, Parties, FormalOrganizations; FBC ClientsAndAccounts. Not hashed |
| [CMNS] | OMG Commons, which FIBO now imports for parties and organizations | Organizations `20250801`, PartiesAndSituations `20250801`, Identifiers `20221101`. Not hashed |
| [EPCIS] | GS1 EPCIS 2.0.0 ontology | `owl:versionInfo "2.0"`, sha256 `19172571d4c61c8afec682a1ec7946c85ce6bcb9e862bd1228020a3c0673b33f` |
| [CBV] | GS1 CBV 2.0.0 ontology | sha256 `2ed64d1170d4615c0eb7d36c3a1ae4c9e29e015ac19fc8688726143ed1f2db12` |
| [GS1] | GS1 Web Vocabulary, `gs1Voc.ttl` | 1.18, sha256 `b6039ed1b3229853a0aed1eb8568527f2d393925fd163d6fce5fddefe7ea1aa7` |
| [QUDT] | QUDT schema, units, quantity kinds | schema 3.5.3 (sha256 `932af97d35a913f3ed708f971b133d10a51ab93436c7aafbb8053608b4f7d0aa`), units (`8fb6405ef0eef5764e748e302111ffece79b61804c41573c8eedf31a6f2f6712`), quantity kinds (`8c9c7b88b06e1b67172331ad22e75c3c3d6f636cc8b17505c6b1e0fbe483474f`) |
| [PROV] | PROV-O, `w3.org/ns/prov-o` as Turtle | sha256 `7d203989f67b38bca572253942acc5a1bf24ce3ccfece16f072dcb4be2b79a96` |
| [TIME] | OWL-Time, `time.ttl` | versionIRI `time#2016`, sha256 `251bd6970b0d7a5efa97ff681afe81a297df85deab3d860fa4f8eeba72d8f16c` |
| [S-accounts] ... | Sutton's public help center (public source), one short name per article | "Accounts & Contacts: key features" [S-accounts]; "Items: creating and managing items" [S-items]; "When to use standard vs serialized inventory tracking" [S-serialized]; "Bin tracking" [S-bins]; "Inventory: key features" [S-inventory]; "Manufacturing & work orders: key features" [S-mo]; "Shipping: key features" [S-shipping]; "Receiving: key features" [S-receiving]; the help center's search listing [S-titles], read for article titles only (Quotes, Sales orders, Purchase orders) |

Also read: the architecture seed (its gist foundation view, its core class list, its alignment register), the API
design report (its class tables and alignment claims), reports 01 and 02, `project-profile.md`, `gist-categories.md`,
`naming-conventions.md`, `anti-patterns.md`, `foundational-analysis.md`, `namespaces.json`, the ontology-mapper skill,
`packages/catalog/contract/src`, `packages/access/contract/src`, `packages/kernel/src/Activity.schema.ts`,
`Member.schema.ts`, `Role.schema.ts`, `AgentRun.schema.ts`, `docs/glossary.md`, `DECISIONS.md` and
`explorations/alchemy-domain/README.md`.

### What the reading changed in the shared files

These are facts for the owners of `_shared/`, not edits made here:

- `namespaces.json` binds `iof-core` to IOF Core's ontology IRI. IOF's classes are not under it: they are under
  `https://spec.industrialontologies.org/ontology/construct/`, which the Core file binds to `iof-constr`. Every IOF row
  below uses `iof-constr:`. An `iof-core:Organization` would name nothing.
- FIBO moved its party and organization classes to OMG Commons. The module behind `fibo-fnd-org-fm` now defines only
  `Employee`, `Employer`, `Employment` and `Group`; `FormalOrganization`, `Organization`, `LegalPerson` and `Membership`
  are `cmns-org:` (`https://www.omg.org/spec/Commons/Organizations/`), `Party` and `PartyRole` are `cmns-pts:`
  (`.../Commons/PartiesAndSituations/`), `Identifier` is `cmns-id:` (`.../Commons/Identifiers/`). The other FIBO rows
  use the prefixes the modules declare: `fibo-fnd-pas-pas`, `fibo-fnd-acc-cur`, `fibo-fnd-plc-adr`, `fibo-fnd-aap-ppl`,
  `fibo-fbc-pas-caa`.
- `gist-categories.md` is right on every name it lists. It gives `gist:GeoRegion` the parent `gist:GeoLocation`: gist
  states that as an operand of an intersection in `rdfs:subClassOf`, not in `owl:equivalentClass`, so a projector that
  reads only equivalent-class intersections finds no parent for it.
- The API design report names four things that do not exist in the files read: `gist:DeliverableSpecification` and
  `gist:BundledDeliverableSpecification` (not in gist 14.1.0; `gist:CatalogItem` and `gist:BundledCatalogItem` are),
  `gs1:IndividualObject` (not in GS1 Web Vocabulary 1.18) and an `isa95:` namespace (ISA-95 publishes none). It also
  uses `gs1:Place`, `prov:Entity` and `epcis:ObjectEvent` as parents, which decision 4 rules out.

## (a) The gist projection

### The rules

1. **Names and links only.** The projection copies a gist class's IRI, `skos:prefLabel`, `skos:definition` (decision 11)
   and its named gist parents, and a gist property's IRI, label, definition and named parent property (decision 16). It
   copies no `owl:equivalentClass`, no restriction, no `owl:inverseOf` (gist has 18, all inside restrictions), no property
   characteristic and no `rdfs:domain` or `rdfs:range`. An `inv:` property may be a sub-property of a gist property only
   where its own domain and range fall under that gist property's (decision 16). gist's `owl:disjointWith` is copied only
   for pairs whose two classes the projection has already admitted, and the set grows as classes are admitted (decision
   15). Section D's 24 pairs are that set for the whole design of reports 04 to 12.
2. **The original IRIs stay.** A projected class is `gist:Organization`, not a local copy. Our terms are
   `rdfs:subClassOf` it in the vocabulary module, and the generated OWL declares only the projected names, so the
   reasoner never loads gist whole. This is the architecture seed's resolution (its section 4.3) and follows decision 4.
3. **Closed upward** (decision 14). A projected class brings each named gist ancestor it has, as names and links only,
   so no generated `rdfs:subClassOf` points at an undeclared class. Under decision 13 an ancestor enters with the gist
   name that needs it, not before. Ancestors taken only for this are marked "link".
4. **One gist parent per local top class** (`gist-categories.md`). A local class with two plausible gist parents is a
   question for its owner document, not a second link.
5. **Only what a record, a seed or a public Sutton document needs, and only in the slice that builds the term**
   (decision 13). Each row says which. A gist name is added to `gist-categories.md` when that slice admits it. Not all
   of table B at once. The thin thread (decision 8) is the first deliverable, before the party slice. Its terms are
   `Organization`, `Tenant` (a role class under `Organization`; `membershipIn` ranges over it, decision 38), `Person`
   (under `gist:Person`, one link `membershipOf` from `Member` to the person, no name or email paths, decisions 93 and
   94), `Member`, `Role` (no gist parent, and no `permits`, decisions 13 and 41), `Grant` (`grantedTo`, `grantsRole`,
   `grantScope`), `AuditEntry` (alternative label "Activity", decision 46; the page and the record keep their name),
   and the schemes `MemberRoleScheme` (viewer, editor, admin) and `GrantScopeKindScheme` (the one concept organization,
   decision 96). Their gist parents and those parents' ancestors come with them (decisions 13 and 14). The gist classes
   are `gist:Organization`, `gist:Person`, `gist:LivingThing`, `gist:PhysicalIdentifiableItem`, `gist:Content`,
   `gist:TemporalRelation` and `gist:Assignment`. `LivingThing` and `PhysicalIdentifiableItem` enter only as ancestors
   of `Person`. `Assignment`'s parent is `TemporalRelation`, which `Member` already needs. `Tenant` adds no gist class.
6. **A parent is `rdfs:subClassOf` and nothing else.** No other vocabulary is ever a parent (decision 4); see (b).

This value is the `gist` field of 05's `Vocabulary` (section 4.6), whose type is this `GistProjection`. The projector
reads that field from its one vocabulary input (`project`'s `vocabulary`, report 12). It is not a side list outside
`project()`'s input. Sketch, not code:

```ts
// sketch, not code: Vocabulary.gist in 05 section 4.6, the value project() reads
export const GistProjection = {
  source: { release: "14.1.0", file: "ontologies/gistCore.ttl", sha256: "0d8230f3...cce08b1" },
  // thin thread (decisions 8, 13, 14 and 94): these seven classes, and no gist property. The property pair shows the shape only.
  classes: {
    Organization: { parents: [] },
    Person: { parents: ["LivingThing"] },
    LivingThing: { parents: ["PhysicalIdentifiableItem"], link: true },
    PhysicalIdentifiableItem: { parents: [], link: true },
    Content: { parents: [] },
    TemporalRelation: { parents: [] },
    Assignment: { parents: ["TemporalRelation"] },
  },
  properties: { hasParty: { parent: "hasParticipant" }, hasParticipant: { parent: null, link: true } },
  disjoint: [
    ["Organization", "Content"],
    ["Organization", "PhysicalIdentifiableItem"],
    ["PhysicalIdentifiableItem", "Content"],
  ], // decision 15: three pairs in the thin thread; 24 for the whole design
} as const
```

### A. Classes `gist-categories.md` lists

Status: "thin thread" means decision 8 admits it with the first deliverable; "taken" means the whole design places a
term under it, and decision 13 admits the gist name when the slice that builds that term is specified, not before;
"link" means an ancestor, admitted with the class that needs it (decision 14); "not taken" gives the reason. The
`inv:` column names likely Keys and their owner document.

| gist class | gist parent (14.1.0) | Status | Why the projection needs it | `inv:` terms under it (owner) |
| --- | --- | --- | --- | --- |
| `gist:Organization` | none | thin thread | Decision 3, amended by 34: a Sutton Account is the organization itself. Decision 38: `Tenant` is a role class under `Organization`, keyed by the organization id (`packages/kernel/src/Member.schema.ts`, `organizationId`); `membershipIn` ranges over `Tenant`. Customer and vendor flags are not on this class | `Organization` (06, thin thread). `Tenant` specializes `Organization`, not this gist class (decision 38) |
| `gist:Person` | `gist:LivingThing` | thin thread | Decision 94: the human a membership links to, in the thin thread, by `membershipOf`, with no name or email paths (decision 93). A contact at another organization waits for the party slice. `packages/access/contract/src/People/Person.read.ts` is a membership view; its pointer is `inv:Member`, not evidence for typing that record `gist:Person` | `Person` (06, thin thread) |
| `gist:LivingThing` | `gist:PhysicalIdentifiableItem` | link (decision 14), thin thread | Person's parent; enters with `Person` in the thin thread (decisions 14 and 94) | none |
| `gist:PhysicalIdentifiableItem` | none | thin thread | Enters with `Person` as an ancestor (decisions 14 and 94). Countable physical things, apart from their records, come later (report 01 section 1) | `SerialUnit`, `Container`, `LogisticUnit` (08). `Person` is under `gist:Person`, not directly under this class |
| `gist:Equipment` | `gist:PhysicalIdentifiableItem` | taken | A machine is not a work center or a bin (architecture seed section 5.4) | `Machine` (08, Sutton only) |
| `gist:PhysicalSubstance` | none | taken | An amount of material (250 kg of flour), the mass reading of a lot | `MaterialLot`, `InventoryLabel` (08, pending decisions 70 and 71) |
| `gist:Intention` | none | taken | Parent of Agreement, Commitment and Specification; also the domain of 09's `lineOf` and `counterparty`. `gist:Permission` brings it as an ancestor only if the party slice takes `permits` (decisions 13 and 41); `gist:Restriction` only if a slice takes `QualityHold` (decision 77, open) | none directly: `QualityHold` sits under `gist:Restriction` (table B, pending decision 77) |
| `gist:Agreement` | `gist:Intention` | taken | An order accepted by both parties binds two (`gist-categories.md` leaves the stage of an order to Benjamin) | `SalesOrder`, `PurchaseOrder` (09, pending decision 80) |
| `gist:Commitment` | `gist:Intention` | taken | Orders, reservations: a promise by one party (architecture seed section 2.1: an order is not its execution) | `ManufacturingOrder`, `WorkOrder`, `TransferOrder`, `CommitmentLine` (09); `InventoryReservation` (08) |
| `gist:ContingentObligation` | `gist:Commitment` | link (decision 14) | Offer's parent; enters with `Offer`, not in the thin thread | none |
| `gist:Offer` | `gist:ContingentObligation` | taken | A quote; a vendor's price and lead time for an item (`Vendor` in `packages/catalog/contract/src/Item/Item.read.ts`) | `Quote` (09); `VendorItem`, `PriceList`, `PriceListEntry` (07) |
| `gist:Specification` | `gist:Intention` | taken | What a kind of thing is: a BOM revision (architecture seed section 5.1) | `ItemRevision`, `ItemUnitConversion`, `Bom`, `BomRevision`, `BomLine` (07) |
| `gist:CatalogItem` | `gist:Specification` | taken | The item master describes what a buyer pays for, not stock (report 01 section 1) | `ItemSpecification` (07) |
| `gist:ProductSpecification` | `gist:CatalogItem` | not taken (pending decision 92) | The recommendation is one identity-bearing parent, `ItemSpecification`, so this class would be a second. Not decided. Decision 12 does not select it | none |
| `gist:ServiceSpecification` | `gist:CatalogItem` | not taken (pending decision 92) | As `gist:ProductSpecification` | none |
| `gist:Event` | none | taken | The file import and its confirm (`packages/catalog/contract/src/Import/Import.read.ts`, `ImportEvent`) | `ItemImport` and the import's events, `EventLine`, `HoldPlacement`, `HoldRelease` (09); `StockMovement`, `LabelSplit`, `InventoryAdjustment` (08); `AgentRun`, `ModelCall` (06) |
| `gist:Transaction` | `gist:Event` | taken | A receipt and a shipment move goods between parties | `Receipt`, `Shipment` (09) |
| `gist:Determination` | `gist:Event` | taken | An event that settles a result: a count, an inspection, two records found to be one party | `StockCount` (08), `QualityInspection` (09); `IdentityDecision` (06) |
| `gist:GeoLocation` | none | taken (pending Q5) | gist 14.1.0 has no place-of-business class; a site, a warehouse and a bin are places | `Location` (08), and `Site`, `Warehouse`, `Bin` through it |
| `gist:Content` | none | thin thread | Records as against their referents (report 01 section 1). The thread uses it for `AuditEntry` only (alternative label "Activity", decision 46; the page and the record keep their name). The Member record's name, organization name and sign-in email are `noTerm` with reason screen in the thread, not content of the membership (decision 93) | `AuditEntry` (06, thin thread, from `packages/kernel/src/Activity.schema.ts`); later: `SignInAccount` (06); `StockPosition` (08); `RowOutcome`, `ValueChange`, `FileRow` (09); `BomExpansion`, `CostObservation` (07); `SourceRecord` (04); `InventoryMeasure` (08, pending decision 74) |
| `gist:Address` | `gist:Content` | link (decision 14) | Parent of the two address classes; enters with them in the party slice, not in the thin thread | none |
| `gist:PhysicalAddress` | `gist:Address` | taken | A ship-to or billing address is not the customer (report 01 section 3) | `PostalAddress` (06) |
| `gist:ElectronicAddress` | `gist:Address` | taken | A contact email, and in the party slice the sign-in email (`AccountEmail` in `packages/access/contract/src/Session/SessionState.read.ts`). In the thin thread that email on the Member record is `noTerm` with reason screen (decision 93), so this class is not admitted there | `ContactPoint` (06) |
| `gist:ID` | `gist:Content` | taken | Identifiers are not identity (architecture seed section 4.2): SKU, vendor SKU, lot code, label ID | `PartyIdentifier` (06); `ItemIdentifier` (07); `TrackingCode` (08) |
| `gist:Magnitude` | none | taken | A quantity is a number with its unit (glossary, "Quantity with its unit") | `QuantityValue`, `MoneyAmount` (07) |
| `gist:ReferenceValue` | `gist:Magnitude` | not taken | A reorder point is set, not measured, but 07 has no term for its value: `reorderPoint` points at a `QuantityValue`; one line to add if a term is made | none |
| `gist:UnitOfMeasure` | none | taken | `Uom` (EA, BX, KG, M, L) and the dimensions' cm and in | `UnitOfMeasure`, `Currency` (07); the unit concepts as individuals (10, pending decision 61) |
| `gist:Aspect` | none | taken | Mass, count, length, volume, money: what a unit measures | the dimension concepts of 10's `MeasurementDimensionScheme`, as individuals (pending decision 61) |
| `gist:Category` | none | link (decision 14) | Tag's parent; enters with `gist:Tag`, not in the thin thread | none |
| `gist:Tag` | `gist:Category` | taken | The item's `tags`, words a person typed (`Item.read.ts`) | the range of 07's `taggedWith` (no local class) |
| `gist:Contract` | `gist:Agreement` | not taken | No record, seed class or Sutton page needs enforceability by law; one line to add later | none |
| `gist:ScheduledEvent` | `gist:Event` | not taken | Planned dates are fields of an order, not events of their own yet | none |
| `gist:GeoRegion`, `gist:GeoPoint` | `gist:GeoLocation` | not taken | No record holds an area or coordinates | none |
| `gist:UnitGroup` | `gist:Collection` | not taken | QUDT quantity kinds give the grouping as alignment rows | none |
| `gist:ProductCategory` | `gist:Category` | not taken | `Category` in `Item.read.ts` is a fixed code list, so a SKOS scheme (10), not a gist category (`gist-categories.md`, step 8) | none |
| `gist:ControlledVocabulary` | `gist:Collection` | not taken | Every code list is a SKOS `ConceptScheme` from the module (report 02) | none |
| `gist:Text` | `gist:ContentExpression` | not taken | `gist:Content` covers every record named so far | none |

### B. Classes gist 14.1.0 has that `gist-categories.md` does not list (decision 13)

Decision 13 admits a gist name only when a term in the slice being built needs it, and the name is added to
`gist-categories.md` then. Not all twelve rows at once. From this table the thin thread admits `gist:TemporalRelation`
and `gist:Assignment`. It also admits table A's `gist:Organization`, `gist:Person`, `gist:LivingThing`,
`gist:PhysicalIdentifiableItem` and `gist:Content` (decisions 14 and 94). It does not admit `gist:Permission`
(decisions 13 and 41). The other rows wait for the slice that
builds their term. Decision 13 does not decide 67 or 77. The last column is when the name is admitted, not a fallback
for a refused block.

| gist class | gist parent (14.1.0) | Why | `inv:` terms under it (owner) | When admitted |
| --- | --- | --- | --- | --- |
| `gist:Template` | none | link: TaskTemplate's parent (decision 14) | none | with `gist:TaskTemplate`, when the catalog slice builds `Routing` |
| `gist:TaskTemplate` | `gist:Template` | The architecture seed places routing templates here; gist's note: a task links to its template by `gist:isBasedOn`. `gist:TaskTemplate` is not a `gist:Specification`, so 07 defines these as templates and its version, output and sequence properties declare no domain | `Routing`, `RoutingRevision`, `OperationDefinition` (07) | the catalog slice that builds those terms. Not the thin thread |
| `gist:Task` | `gist:Event` | Work proposed, planned, underway or done; the seed's `OperationExecution`; Sutton's work orders, one per routing step [S-mo] | `OperationExecution` (09); `WorkOrder` only under decision 80's other answers (pending decision 80) | the slice that builds `OperationExecution`. Not the thin thread |
| `gist:Permission` | `gist:Intention` | "A description of things one is permitted to do" | `Permission`, `PortalAccess` (06), and `Role` only once it carries `permits` | the party slice, not the thin thread. The thread ships `Role` with no gist parent and no `permits` (decisions 13 and 41). `Role`'s one identity criterion is the concept's: its scheme and its notation |
| `gist:Restriction` | `gist:Intention` | "A description of things one is prevented from doing": a quality hold keeps stock from being used (08); defined through `gist:prevents`, which 14.1.0 deprecates for `gist:prohibits`, and the projection copies the name and parent only | `QualityHold` (08, pending decision 77) | only if the slice that builds `QualityHold` takes it. Decision 13 does not decide 77 |
| `gist:TemporalRelation` | none | A relationship existing for a period: a person's membership of a `Tenant` (`membershipIn` ranges over that role class, decision 38); also Assignment's parent | `Member` (06, thin thread), linked to one `Person` by `membershipOf` (decision 94) | the thin thread (decisions 8 and 13) |
| `gist:Assignment` | `gist:TemporalRelation` | A relationship between an assignee, what is assigned and who assigned it, for a period | `Grant` (06, thin thread): `grantedTo`, `grantsRole` and `grantScope` (decision 96), at the one scope organization. `ContactAssignment` (06) uses the same parent in the party slice (decisions 39 and 43), not in the thread | the thin thread, for `Grant` (decisions 8 and 13). Its ancestor `TemporalRelation` is already admitted for `Member` (decision 14) |
| `gist:PhysicalEvent` | `gist:Event` | An event at a place: the EPCIS views have a read point and a business location | `TransformationEvent`, `AggregationEvent`, `DisaggregationEvent`, `ObjectObservation` (09) | the slice that builds those events. Not the thin thread |
| `gist:ContentExpression` | `gist:Content` | link: FormattedContent's parent (decision 14) | none | with `gist:FormattedContent` |
| `gist:FormattedContent` | `gist:ContentExpression` | Content encoded in a format: the uploaded .csv or .xlsx (`packages/catalog/contract/src/Staging/Staged.read.ts`) | `StagedFile` (09) | the slice that builds `StagedFile`. Not the thin thread |
| `gist:Composite` | none | link: Collection's parent (decision 14) | none | with `gist:Collection`, and only if decision 67 takes it |
| `gist:Collection` | `gist:Composite` | A grouping of members that may change: a work center (07); also the other reading of a lot of counted units, which 08 did not choose | `WorkCenter` (07, pending decision 67) | only if the slice that builds the work center takes it. Decision 13 does not decide 67 |

### C. Classes deliberately not taken

| gist class | Why not |
| --- | --- |
| `gist:Account` | An agreement that has a balance, a financial account. Not the Sutton Account (decision 3). Nothing goes under it |
| `gist:Building`, `gist:Landmark`, `gist:Language`, `gist:SchemaMetaData` | Deprecated in 14.1.0 |
| `gist:HistoricalEvent`, `gist:ContemporaryEvent` | Whether an event has ended is a phase relative to now, not a kind (state-is-kind, `foundational-analysis.md`) |
| `gist:BundledCatalogItem` | A kit (glossary) has no record and no Sutton page read; later |
| `gist:TimeInterval` | Machine-state intervals are Sutton only; note that gist makes `gist:Event` disjoint with it, so an interval record is never also its event |
| `gist:ScheduledTask` | Two gist parents (`ScheduledEvent`, `Task`); rule 4 |
| `gist:EventSpecification`, `gist:ContractTerm`, `gist:Requirement`, `gist:Function`, `gist:Project`, `gist:System`, `gist:Network`, `gist:NetworkNode`, `gist:NetworkLink`, `gist:Component`, `gist:OrderedCollection`, `gist:OrderedMember`, `gist:Message`, `gist:IntellectualProperty`, `gist:KnowledgeConcept`, `gist:GeoVolume`, `gist:GeoRoute`, `gist:GovernedGeoRegion`, `gist:CountryGeoRegion`, the government organization classes | No record, seed class or Sutton page needs them |
| `gist:AddressUsageType`, `gist:Behavior`, `gist:DegreeOfCommitment`, `gist:Discipline`, `gist:ElectronicAddressType`, `gist:EquipmentType`, `gist:GeneralMediaType`, `gist:MediaType`, `gist:Medium`, `gist:PhysicalActionType`, `gist:PhysicalAddressType` | gist categories for code lists; ours are SKOS schemes (10) |

### D. The disjointness that comes with the projection (decision 15)

gist 14.1.0 states 62 named `owl:disjointWith` pairs and no `owl:AllDisjointClasses`. Twenty-three fall inside table A
as the whole design takes it, and one more (`gist:Template` with `gist:UnitOfMeasure`) with table B: 24 pairs, copied
only between classes the projection has admitted. The thin thread admits `Organization`, `Person`, `LivingThing`,
`PhysicalIdentifiableItem`, `Content`, `TemporalRelation` and `Assignment`. Three pairs have both sides:
`gist:Organization` with `gist:Content`, `gist:Organization` with `gist:PhysicalIdentifiableItem`, and
`gist:PhysicalIdentifiableItem` with `gist:Content`. The other 21 wait until both sides are admitted. `Person` and
`LivingThing` are not themselves ends of a copied pair; a person is caught through `PhysicalIdentifiableItem`.
`gist:Template` is not in the thread, so its pair with `gist:UnitOfMeasure` waits with it.

| gist class | Disjoint with (inside the projection) |
| --- | --- |
| `gist:Organization` | `Content`, `Intention`, `Magnitude`, `PhysicalIdentifiableItem`, `PhysicalSubstance`, `UnitOfMeasure` |
| `gist:PhysicalIdentifiableItem` | `Content`, `Intention`, `Magnitude`, `Organization`, `UnitOfMeasure` |
| `gist:PhysicalSubstance` | `Content`, `Intention`, `Magnitude`, `Organization`, `UnitOfMeasure` |
| `gist:Intention` | `Magnitude`, `Organization`, `PhysicalIdentifiableItem`, `PhysicalSubstance`, `UnitOfMeasure` |
| `gist:Event` | `Aspect`, `Category`, `Magnitude`, `UnitOfMeasure` |
| `gist:Content` | `Organization`, `PhysicalIdentifiableItem`, `PhysicalSubstance`, `UnitOfMeasure` |
| `gist:Magnitude` | `Event`, `Intention`, `Organization`, `PhysicalIdentifiableItem`, `PhysicalSubstance`, `UnitOfMeasure` |
| `gist:PhysicalAddress` | `ElectronicAddress` |
| `gist:Template` | `UnitOfMeasure` |

What the 24 catch, once both sides are admitted: an organization typed as a lot, a record or an order; a person typed
as an organization (Person is under PhysicalIdentifiableItem, so decision 3's "a person cannot be an Account" becomes
a reasoner check); a label record typed as the lot it describes; a quantity typed as an event. The thin thread catches
an organization typed as content, a record typed as an organization, a person typed as an organization, and a person
typed as a record: `Organization` with `Content`, and `PhysicalIdentifiableItem` (Person's ancestor) with both
`Organization` and `Content` (decisions 15 and 94). The organization-and-content pair is the one decision 34 relies on,
and `SourceRecord` itself is the party slice, not the thread. What the 24 do not catch: `gist:Event` is disjoint with
neither `gist:Content` nor `gist:Intention`, and `gist:GeoLocation` with nothing, so a record typed as its event, an
order typed as its execution, or a bin typed as its operator passes unless the vocabulary module states that
disjointness itself (05's and 12's call).

### E. Properties

gist properties a term document may put its own properties under (`rdfs:subPropertyOf`, decision 16) or use directly.
gist states no domain or range on most of them; the projection copies none (decision 16). An `inv:` property is a
sub-property of a gist one only where its own domain and range fall under the gist property's. Properties in
`gist-categories.md`'s list are marked "listed". A name that list does not have is admitted when the slice that uses
it is built (decision 13), not as a block. None of the unlisted properties below is in the thin thread.

| gist property | gist parent | In the list | Why | `inv:` properties under it, or used for (owner) |
| --- | --- | --- | --- | --- |
| `gist:hasParticipant` | none | listed | link: parent of the party properties | none |
| `gist:hasParty` | `gist:hasParticipant` | listed | Who an order or agreement binds | the order's customer and vendor (09) |
| `gist:hasGiver` | `gist:hasParticipant` | listed | Who provides: the shipper, the offering vendor | shipment and offer properties (09, 07) |
| `gist:hasRecipient` | `gist:hasParticipant` | listed | Who receives | receipt and shipment properties (09) |
| `gist:offersToProvide`, `gist:offersToReceive` | none | listed | What an offer gives and asks | quote and vendor offer (09, 07) |
| `gist:conformsTo` | none | listed | Stock, a lot, a label conforms to its item specification (`gist-categories.md` step 3) | the "of item" property of stock records (08) |
| `gist:isIdentifiedBy` | none | listed | A thing to its identifier, never its identity | identifier properties (06, 07, 08) |
| `gist:idText` | none | listed | The identifier's text | not linked: 06, 07 and 08 use `gist:idText` itself for the code text (07's `identifierText` is that property) |
| `gist:isAllocatedBy` | none | listed | Who issued an identifier: a vendor's own code for an item (`vendorSku` in `Item.read.ts`) | identifier issuer (07, 06) |
| `gist:isCategorizedBy` | none | listed | A thing to a less formal classification | tags (07); the SKOS scheme properties (10) |
| `gist:hasMagnitude`, `gist:numericValue`, `gist:hasUnitOfMeasure`, `gist:hasAspect` | none | listed | A quantity's amount, unit and aspect | not linked: 07's `numericValue` is `gist:numericValue` itself. 07's `unit` sits under `gist:hasUnitOfMeasure` (a `QuantityValue`'s). Not `baseUnit`, `costPerUnit` or `priceUnit`, whose subjects are not magnitudes, while gist states `gist:hasUnitOfMeasure` from `gist:Magnitude` (decision 16). 10's `hasDimension` under `gist:hasAspect` |
| `gist:isMemberOf` | none | listed | A member in an organization, if 06 keeps a plain link beside `Membership` | (06) |
| `gist:isPartOf` | none | listed | A bin in a warehouse, a warehouse at a site | location hierarchy (08) |
| `gist:isDirectPartOf` | `gist:isPartOf` | decision 13, with the warehouse slice | The immediate parent location, so a check can see one level (the architecture seed's `parentLocation`) | (08) |
| `gist:hasAddress` | none | listed | A party's addresses | 06's `hasContactPoint` and `hasPostalAddress`, kept local, are stored sub-properties of `gist:hasAddress`, not a second unrelated predicate |
| `gist:hasPhysicalLocation` | none | listed | Where stock is | (08) |
| `gist:occursIn` | none | listed | Where an event happened | 09's `occursAt` is a sub-property of `gist:occursIn` (a parent link in this projection, not a mapping) |
| `gist:comesFromPlace`, `gist:goesToPlace` | none | decision 13, with the commitment slice | A transfer's or shipment's origin and destination | (09) |
| `gist:isBasedOn` | none | decision 13, with the slice that builds the work order or the revision | A work order on its routing; a revision on its predecessor | (09, 07) |
| `gist:isAbout` | none | decision 13, with the party slice | A record to what it records (report 01 section 1); gist gives it the domain `gist:Content`, which the projection does not copy (decision 16) | 04's `recordOf`, from a source record to the party or item it was captured about (decision 34). Not in the thin thread: `SourceRecord` follows the thread. CQ-P01 reads the flags on that record, then `recordOf` |
| `gist:isProducedBy` | none | decision 13, with the commitment slice | An output lot to the transformation that made it | (09) |
| `gist:requires` | none | decision 13, with the catalog slice | A BOM line to its component | (07) |
| `gist:precedes` | none | decision 13, with the catalog slice | Routing step order | (07) |
| `gist:name`, `gist:description` | none | `name` listed; `description` with the catalog slice (decision 13) | An item's name and description (`Item.read.ts`), an organization's name | not linked: 06 uses `gist:name` itself, not a second `inv:name`, and 07's item name is that property. 07's `description` states no parent, so this row does not put it under `gist:description`. In the thin thread the Member record's person name, organization name and sign-in email are `noTerm` with reason screen (decision 93): those fields are not `gist:name`, and only the role field is lifted, to its `Grant` (decision 40). Every field of a pointed record carries a pointer or `noTerm` with a reason, and the shapes are closed (decision 22). Decision 94 puts `Person` in the thread by `membershipOf`, with no name or email path, so the name stays out. The party slice adds the name through the person and the email through the sign-in account |
| `gist:atDateTime` | none | decision 13, with the commitment slice | When an event occurred (EPCIS `eventTime`) | 09's `eventTime` is `rdfs:subPropertyOf` `gist:atDateTime` (decisions 16 and 13). A parent link in this projection, not a mapping |
| `gist:startDateTime`, `gist:endDateTime` | `gist:atDateTime` | decision 13, with `gist:atDateTime`; link (decision 14) | link | none |
| `gist:plannedStartDateTime`, `gist:actualStartDateTime` | `gist:startDateTime` | listed | Planned and actual start | (09) |
| `gist:plannedEndDateTime`, `gist:actualEndDateTime` | `gist:endDateTime` | decision 13, with the commitment slice | Planned and actual end | (09) |
| `gist:isRecordedAt` | `gist:atDateTime` | decision 13, with the commitment slice | When a record was written, apart from when the event happened (EPCIS `recordTime`) | 09's `recordTime` is `rdfs:subPropertyOf` `gist:isRecordedAt` (decisions 16 and 13). A parent link in this projection, not a mapping |
| `gist:sequence` | none | decision 13, with the slice that builds the line or the routing | A line's position in an order or a routing | (09, 07) |
| `gist:allows` | none | not in the thin thread (decisions 13 and 41) | What a role permits, once `permits` exists | (06). The thread ships `Role` without `permits`, so this property waits for the party slice |
| `gist:isAssignmentOf`, `gist:isAssignmentTo` | none | decision 13, with the party slice | A membership's person and organization. `Person` is in the thin thread (decision 94): `membershipOf` links `Member` to the person, with no name or email paths (decision 93), and `membershipIn` ranges over `Tenant` (decision 38). Those two links are 06's properties, not these gist properties, so these stay with the party slice | (06) |

Not taken, with the reason: `gist:hasBroader`, `gist:hasDirectBroader`, `gist:hasUniqueBroader`,
`gist:hasNavigationalParent` (SKOS `broader` does it, in 10); `gist:owns` and `gist:uniqueText` (listed in
`gist-categories.md`, but no record needs ownership or a second text property beside `idText`); `gist:comesFromAgent`
and `gist:goesToAgent` (the same as `hasGiver` and `hasRecipient` for our cases; one pair is enough);
`gist:isGeoContainedIn` (domain and range `gist:GeoLocation`; `isPartOf` covers the hierarchy); `gist:conversionFactor`,
`gist:conversionOffset`, the `exponentOf...` family and the unit arithmetic properties (conversion to SI units: QUDT
covers it, and an item's case-to-each factor is item-specific, 07); `gist:prevents` (deprecated); `gist:prohibits`,
`gist:hasIncumbent`, `gist:hasGoal`, `gist:isGovernedBy`, `gist:isRecognizedBy`, `gist:isUnderJurisdictionOf`,
`gist:isTriggeredBy`, `gist:isAffectedBy`, `gist:contributesTo`, `gist:refersTo`, `gist:isExpressedIn`,
`gist:isRenderedOn`, `gist:isMadeUpOf`, `gist:links` and its two subproperties, `gist:isConnectedTo`,
`gist:hasBiologicalParent`, `gist:hasAccuracy`, the minute, year and microsecond precision variants, `gist:birthDate`,
`gist:deathDate`, `gist:latitude`, `gist:longitude`, `gist:symbol`, `gist:containedText`, `gist:encryptedText` (no
record or seed needs them). gist's annotation properties are not taken; `gist:isSupersededBy` is one option for how a
deprecated term names its replacement, beside `dcterms:isReplacedBy` and IAO's, which the curator puts to Benjamin.

Note on ranges: gist's time properties have the range `xsd:dateTime`. The repository's dates (`firstReceivedOn`,
`Discontinued.on`) are year-month-day strings, and the architecture seed keeps calendar dates as strings in the DL core.
Because the projection copies no range, an `inv:` date property under `gist:actualStartDateTime` does not clash in the
generated OWL; its meaning still says "a date and time", so 09 decides whether a date-only field goes under it.

### F. Names a term document is likely to want that gist 14.1.0 lacks

Each was searched for as a subject in gistCore.ttl and found absent.

| Wanted name | What gist offers instead | Who decides |
| --- | --- | --- |
| `Party` | Nothing: no common parent of `gist:Person` and `gist:Organization` (Person is under PhysicalIdentifiableItem, Organization has no parent, and with Q1 they are disjoint). A local `Party` would have "none: gist has no party class" as its gist parent | 06 |
| `Agent`, `SoftwareAgent` (the assistant acting for a person, `AgentRun.schema.ts`) | Nothing. `prov:SoftwareAgent` is an alignment target only | 06 |
| `Role`, `Position` | Nothing as a class. `gist:Permission` fits a role (table B) but is not admitted in the thin thread: `Role` has no gist parent there and no `permits` (decisions 13 and 41). One identity criterion, the concept's: its scheme and its notation. The individuals are 10's `MemberRoleScheme` concepts (viewer, editor, admin) under the same IRI | 06, 10 |
| `Place`, `Location`, `Site`, `Facility`, `Warehouse` | `gist:GeoLocation` (pending Q5); `gist:Building` is deprecated | 08, Q5 |
| `Lot`, `Batch` | `gist:PhysicalSubstance` or `gist:Collection` | 08 |
| `Order`, `OrderLine`, `Obligation` | `gist:Commitment` (a line is a commitment too); `gist:Agreement` | 09 |
| `Inventory`, `Stock`, `StockPosition` | Nothing: a position is a record (`gist:Content`) or a magnitude at a place | 08 |
| `Quantity`, `Unit` | `gist:Magnitude`, `gist:UnitOfMeasure` | 07 |
| `Money`, `MonetaryAmount`, `Currency` | `gist:Magnitude` whose aspect is monetary value (gist names the individual `gistd:_Aspect_monetary_value`, defined outside gistCore.ttl) and whose unit is a currency; no currency class | 07 |
| `Identifier` | `gist:ID` | 06, 07 |
| `Product` | `gist:ProductSpecification` (the description) or `gist:PhysicalIdentifiableItem` (the unit) | 07, 08 |
| `Document`, `Record`, `File` | `gist:Content`; `gist:FormattedContent` when the slice that builds `StagedFile` needs it (decision 13) | 05, 09 |
| `Process`, `Plan` | `gist:Event`, `gist:Task`; `gist:TaskTemplate` when the catalog slice needs it (decision 13) | 07, 09 |
| `Container` | `gist:PhysicalIdentifiableItem` | 08 |
| `hasPart` | none, and none is added: one direction, `gist:isPartOf`, read backwards with `^gist:isPartOf` | all |
| `Account` in Sutton's sense | `gist:Organization` names the body (decision 34); the imported row is the tenant's `SourceRecord`, and the customer and vendor flags sit on that record, which CQ-P01 reads. `gist:Account` is a financial account | 06, 04 |

## (b) The alignments

### The rules

- **The predicates.** `skos:exactMatch`, `skos:closeMatch`, `skos:broadMatch`, `skos:narrowMatch`, `skos:relatedMatch`,
  read from the subject: `A skos:broadMatch B` says B is broader than A. A class's gist parent is `rdfs:subClassOf` and
  appears in the tables below only so each term's placement can be read in one place. A property's gist parent is
  `rdfs:subPropertyOf` (decision 16) and is only in the projection (section E), not in these tables. Either belongs to
  the projection, not to the mappings. Never `owl:sameAs`, `owl:equivalentClass`, `owl:equivalentProperty` or
  `owl:inverseOf`.
- **Exact against close.** A row is `exactMatch` only when all of these hold: (1) both definitions, the target's read in
  the fetched file, pick out the same things in every case the repository's records, the two seeds and the public Sutton
  pages cover; (2) both terms are of the same category (both kinds, both records, both events, both concepts, both
  units); (3) the identity criteria agree, or the target states none that conflicts; (4) the target has no necessary
  condition an instance of ours may fail (IOF's Organization needs a member person and an organization identifier); (5)
  the row was checked against the file, never written from memory; (6) every other `exactMatch` of either side still
  holds when the two are joined, because `exactMatch` is transitive. A row that meets (2) and overlaps on the covered
  cases but fails another test is `closeMatch`. In this document only units of measure pass: a kilogram is fixed by an
  international definition both sides cite.
- **Broad and narrow** are for the same category when one side's instances are all the other's (schema.org's Person
  includes fictional people: `inv:Person skos:broadMatch schema:Person`).
- **Related** is for a different category that a reader moving data must still know about: a record against its
  referent, a commitment against the process that fulfils it, a class against a code (`cbv:BTT-po` is a document type),
  a kind against a role.
- **No alignment is an import or a parent.** Decision 4 makes gist the only parent, and the reasons hold for every
  target, not only IOF and ISA-95: (1) an imported target brings its own upper ontology; IOF brings BFO, whose
  categories do not line up with gist's (IOF's `Agreement` is an information content entity; gist's is an intention),
  and the architecture seed forbids equating them wholesale (its section 7.2). (2) A parent makes the target's axioms
  bind our terms, so the reasoner's answer in `check:full` (decision 6) would change when IOF, schema.org (monthly) or
  FIBO releases. (3) schema.org states `domainIncludes`, not OWL semantics, and ISA-95 and Sutton publish no RDF at all.
  (4) The byte-compare of decision 6 needs every generated triple to come from the vocabulary module; an import pulls in
  bytes nobody here wrote. A mapping row is a statement for a reader and an export adapter, with no entailment
  (pending Q8; decision 28 recommends report 12's separate alignment file, which the reasoner never loads, with the
  five predicates declared annotation properties in it).
- **Targets with no namespace.** ISA-95 and Sutton have no RDF namespace, and decision 7 forbids minting one under
  Sutton's name. Their rows give the object as text, the term's name as the standard or the public page writes it,
  and are projected as a note, not a SKOS mapping triple (pending Q6). B2MML is an XML Schema namespace, not RDF; its
  type names are given beside the ISA-95 term.
- **Concepts.** A concept's IRI is decision 10: the scheme key, a hyphen and the notation
  (`inv:ItemRoleScheme-buy`, `inv:MemberRoleScheme-admin`).

A sketch of one row in the vocabulary module (sketch, not code):

```ts
// sketch, not code
alignments: [
  {
    subject: "inv:Organization",
    predicate: "skos:closeMatch",
    object: "org:Organization",
    justification: "ORG: people organized with a common purpose; no identity rule; expects members",
    checked: { file: "org.ttl", sha256: "3e01f89a...29848729", on: "2026-11-22" },
    confidence: 0.8,
  },
  // pending Q6: a target with no namespace
  { subject: "inv:Bin", predicate: "skos:closeMatch", object: { standard: "Sutton", name: "Bin" }, confidence: 0.8 },
]
```

Confidence is the designer's estimate that a reviewer keeps the row as written, 0 to 1; it is never a lexical score
(oaklib reads no `skos:prefLabel` on gist, `project-profile.md`). Every row is a candidate until Benjamin ratifies it.

### Party and access terms (owned by 06)

| Subject | Predicate | Object CURIE | Justification | Checked | Confidence |
| --- | --- | --- | --- | --- | --- |
| `inv:Organization` | `rdfs:subClassOf` | `gist:Organization` | Decision 3; gist allows an organization with no members, as a vendor known only by name. `Tenant` specializes `Organization` and adds no second gist parent (decision 38) | fetched [gist] | 0.95 |
| `inv:Organization` | `skos:closeMatch` | `org:Organization` | ORG: people organized together with a purpose beyond the members; it expects members and states no identity rule | fetched [ORG] | 0.8 |
| `inv:Organization` | `skos:narrowMatch` | `org:FormalOrganization` | ORG's formal organization is recognized in legal jurisdictions; ours also covers a department or a vendor whose legal form is unknown | fetched [ORG] | 0.7 |
| `inv:Organization` | `skos:closeMatch` | `schema:Organization` | "school, NGO, corporation, club"; no identity rule | fetched [SDO] | 0.8 |
| `inv:Organization` | `skos:narrowMatch` | `iof-constr:Organization` | IOF requires a member person and an organization identifier at all times; ours does not, so IOF's is narrower | fetched [IOF] | 0.7 |
| `inv:Organization` | `skos:closeMatch` | `cmns-org:Organization` | The class FIBO uses: a framework of authority within which people act towards a purpose | fetched [CMNS] | 0.7 |
| `inv:Organization` | `skos:closeMatch` | `prov:Organization` | A social or legal institution, a `prov:Agent`: used when an organization is the agent of an import | fetched [PROV] | 0.7 |
| `inv:Organization` | `skos:closeMatch` | `gs1:Organization` | GS1's is identified by a GLN; no record here has one | fetched [GS1] | 0.5 |
| `inv:Organization` | `skos:relatedMatch` | Sutton "Account" (pending Q6) | Sutton's Account is the organization (decisions 3 and 34); what a tenant imports is 04's `SourceRecord` of it, linked by `recordOf`. The customer and vendor flags sit on that record, and CQ-P01 reads them there, not on the shared organization. Different categories, so related, not close. The Sutton target stays the Account | fetched [S-accounts] | 0.7 |
| `inv:Person` | `rdfs:subClassOf` | `gist:Person` | A human being who is or was alive. In the thin thread (decision 94), reached by `membershipOf`, with no name or email paths (decision 93). Ancestors `gist:LivingThing` and `gist:PhysicalIdentifiableItem` come with it (decision 14) | fetched [gist] | 0.95 |
| `inv:Person` | `skos:broadMatch` | `schema:Person` | schema.org's includes fictional and undead persons | fetched [SDO] | 0.8 |
| `inv:Person` | `skos:closeMatch` | `prov:Person` | A person as an agent | fetched [PROV] | 0.8 |
| `inv:Person` | `skos:closeMatch` | `iof-constr:Person` | An organism of the species; a BFO object | fetched [IOF] | 0.8 |
| `inv:Person` | `skos:closeMatch` | `fibo-fnd-aap-ppl:Person` | An individual human being | fetched [FIBO] | 0.8 |
| `inv:ContactAssignment` | `rdfs:subClassOf` | `gist:Assignment` | The party slice: one person at one account, carrying the purpose and the contact point (decisions 39 and 43). `gist:Assignment` is already admitted in the thin thread for `Grant` (decision 13). A plain `isContactOf` link is not the model | fetched [gist] | 0.6 |
| `inv:ContactAssignment` | `skos:relatedMatch` | Sutton "Contact" (pending Q6) | Sutton's contact is a person tied to a company [S-accounts]. The assignment is that tie and carries the purpose and the point, so one person who bills one account and receives at another is not both at both (decisions 39 and 43). A person is not the assignment, so related, not close | fetched [S-accounts] | 0.6 |
| `inv:ContactAssignment` | `skos:closeMatch` | `org:Membership` | Both are a person in relation to an organization. ORG's membership also carries a role; this assignment carries a purpose and a contact point instead (decisions 39 and 43). Same category, so close, not exact. `Member`'s closeMatch is the tenant membership, not this row | fetched [ORG] | 0.6 |
| `inv:ContactAssignment` | `skos:relatedMatch` | FIBO "Contact" | Decisions 39 and 43 restore this row. The People, Parties, Addresses, FormalOrganizations and ClientsAndAccounts files read on 2026-11-22 were not re-opened for a class IRI, so the object is named in words and is not a SKOS triple until that IRI is checked. Related, not exact | from memory, unchecked | 0.4 |
| `inv:ContactAssignment` | `skos:relatedMatch` | `schema:ContactPoint` | schema.org's contact point is a structured value and can carry a contact type on the point. The purpose here sits on the assignment (decisions 39 and 43). Different categories, so related. The `ContactPoint` row is the electronic address | fetched [SDO] | 0.6 |
| `inv:ContactPoint` | `rdfs:subClassOf` | `gist:ElectronicAddress` | An email or phone reached by software or electronics; 06 decides whether phones and emails are one class | fetched [gist] | 0.6 |
| `inv:ContactPoint` | `skos:broadMatch` | `schema:ContactPoint` | schema.org's includes a postal address and a contact type on the point. Ours is an electronic address only, and the purpose sits on `ContactAssignment` (decisions 39 and 43), so schema.org's class is broader | fetched [SDO] | 0.7 |
| `inv:PostalAddress` | `rdfs:subClassOf` | `gist:PhysicalAddress` | An address of a place in the physical universe | fetched [gist] | 0.9 |
| `inv:PostalAddress` | `skos:closeMatch` | `schema:PostalAddress` | The mailing address | fetched [SDO] | 0.8 |
| `inv:PostalAddress` | `skos:closeMatch` | `fibo-fnd-plc-adr:PhysicalAddress` | Where communications are addressed or papers served | fetched [FIBO] | 0.7 |
| `inv:PartyIdentifier` | `rdfs:subClassOf` | `gist:ID` | An identifier is content, never the party's identity | fetched [gist] | 0.9 |
| `inv:PartyIdentifier` | `skos:broadMatch` | `cmns-id:Identifier` | Commons' identifier of anything | fetched [CMNS] | 0.7 |
| `inv:PartyIdentifier` | `skos:narrowMatch` | `iof-constr:OrganizationIdentifier` | IOF's identifies organizations only; ours also persons | fetched [IOF] | 0.7 |
| `inv:PartyIdentifier` | `skos:relatedMatch` | `schema:PropertyValue` | schema.org writes a scheme-qualified identifier as a property value | fetched [SDO] | 0.4 |
| `inv:Member` | `rdfs:subClassOf` | `gist:TemporalRelation` | Thin thread (decisions 8 and 13): a person's membership of a `Tenant` for a period. `membershipIn` ranges over `Tenant` (decision 38) and `membershipOf` links the one person (decision 94). The role is on `Grant`, not on this class (`Member.schema.ts`). Every field of the pointed record carries a pointer or `noTerm` with a reason (decision 22): the name, organization name and sign-in email are `noTerm` with reason screen (decision 93), and the role field is lifted | fetched [gist] | 0.6 |
| `inv:Member` | `skos:closeMatch` | `org:Membership` | Member supplies the relationship between one `Person` and one `Tenant` (decisions 94 and 38). `Grant` supplies role and scope (decisions 40 and 96). `member.role` (`Member.schema.ts`) is one grant at organization scope, not a second direct ontology role. ORG's Membership is an agent, an organization and a role | fetched [ORG] | 0.8 |
| `inv:Member` | `skos:closeMatch` | `cmns-org:Membership` | A situation in which an organization has a member | fetched [CMNS] | 0.6 |
| `inv:Grant` | `rdfs:subClassOf` | `gist:Assignment` | Thin thread (decisions 8, 13, 40 and 96): an assignee (the member), the role assigned, and the scope. The thread's `Grant` carries `grantedTo`, `grantsRole` and `grantScope`. `GrantScopeKindScheme` has the one concept organization; other scopes wait for the slice that needs them. The lift is from `member.role` to this grant | fetched [gist] | 0.6 |
| `inv:Permission`, `inv:PortalAccess` | `rdfs:subClassOf` | `gist:Permission` | Party slice, not the thin thread (decisions 13 and 41): descriptions of what one may do. `Role` has no gist parent in the thread and no `permits`; its one identity criterion is the concept's scheme and notation | fetched [gist] | 0.6 |
| `inv:Grant` | `skos:relatedMatch` | `org:Membership` | `Grant` supplies the role and the scope, which may be narrower than an organization (a site, a field) (decision 40). The thin thread ships only the organization concept of `GrantScopeKindScheme` (decision 96). `member.role` is evidence for this grant, not a second role triple on Member | fetched [ORG] | 0.5 |
| `inv:IdentityDecision` | `rdfs:subClassOf` | `gist:Determination` | An event that settles a result: two records are, or are not, one party | fetched [gist] | 0.8 |
| `inv:IdentityDecision` | `skos:broadMatch` | `prov:Activity` | A decision occurs over time and generates a record | fetched [PROV] | 0.6 |
| `inv:AuditEntry` | `rdfs:subClassOf` | `gist:Content` | `Activity.schema.ts`: one line of the audit trail, a record of an act, not the act. The key is `AuditEntry`; "Activity" is an alternative label (decision 46). The page and the record keep their name | fetched [gist] | 0.8 |
| `inv:AuditEntry` | `skos:broadMatch` | `prov:Entity` | A record is an entity; the act it records is a `prov:Activity`, which is why the key is not `Activity` (decision 46) | fetched [PROV] | 0.6 |

No row for the role flags `isCustomer` and `isVendor` (nor the two decision 89 holds back): a boolean property has no
class or property in the targets with the same shape. The flags sit on the tenant's `SourceRecord`, not on the shared
organization, and CQ-P01 reads them there (decision 34). There is no `isContactOf` row: the contact is a
`ContactAssignment` (decisions 39 and 43). For a reader, the nearest names are `iof-constr:Customer`,
`iof-constr:Supplier`, `iof-constr:Manufacturer` (roles borne by a person or an organization),
`fibo-fnd-pas-pas:Customer` and `fibo-fnd-pas-pas:Supplier`, and schema.org's `customer` and `seller` properties on an
order (`schema:vendor` is superseded by `seller`). Sutton's public page shows customer and vendor only [S-accounts];
carrier and contract manufacturer come from report 01 and were not seen on a public Sutton page.

### Catalog and value terms (owned by 07)

| Subject | Predicate | Object CURIE | Justification | Checked | Confidence |
| --- | --- | --- | --- | --- | --- |
| `inv:ItemSpecification` | `rdfs:subClassOf` | `gist:CatalogItem` | The architecture seed's ItemDefinition; a description precise enough to tell whether delivery discharged it, never stock | fetched [gist] | 0.9 |
| `inv:ItemSpecification` | `skos:closeMatch` | `gs1:Product` | GS1's trade item: anything, product or service, priced, ordered or invoiced | fetched [GS1] | 0.7 |
| `inv:ItemSpecification` | `skos:closeMatch` | `schema:Product` | "Any offered product or service"; schema.org uses it both for a model and for an instance | fetched [SDO] | 0.5 |
| `inv:ItemSpecification` | `skos:relatedMatch` | `fibo-fnd-pas-pas:Product` | FIBO's product reads as the good itself, not its description | fetched [FIBO] | 0.4 |
| `inv:InventoryItemSpecification` | `skos:closeMatch` | `schema:ProductModel` | A vendor specification of a product, a prototypical description | fetched [SDO] | 0.6 |
| `inv:InventoryItemSpecification` | `skos:closeMatch` | ISA-95 "Material Definition" (B2MML `MaterialDefinitionType`) (pending Q6) | ISA-95's definition of a material; ours adds commercial facts (cost, vendors) | fetched [B2MML] | 0.6 |
| `inv:InventoryItemSpecification` | `skos:relatedMatch` | `iof-constr:DesignSpecification` | IOF's prescribes something man-made; a raw material is not designed | fetched [IOF] | 0.4 |
| `inv:InventoryItemSpecification` | `skos:closeMatch` | Sutton "Inventory item" (pending Q6) | Public: physical goods, Buy, Make or Sell in any combination, SKU optional [S-items] | fetched [S-items] | 0.8 |
| `inv:ServiceItemSpecification` | `skos:closeMatch` | `iof-constr:CommercialServiceSpecification` | A plan specification that prescribes a commercial service | fetched [IOF] | 0.6 |
| `inv:ServiceItemSpecification` | `skos:closeMatch` | `schema:Service` | A service provided by an organization | fetched [SDO] | 0.6 |
| `inv:ServiceItemSpecification` | `skos:closeMatch` | Sutton "Service item" (pending Q6) | Public: non-physical work such as contract labour [S-items] | fetched [S-items] | 0.8 |
| `inv:AliasItemSpecification` | `skos:closeMatch` | Sutton "Alias item" (pending Q6) | Public: sold and picked under another name or SKU while stock stays on one item; enabled by Sutton's support [S-items] | fetched [S-items] | 0.7 |
| `inv:BomRevision` | `rdfs:subClassOf` | `gist:Specification` | What it takes to make one unit or batch | fetched [gist] | 0.7 |
| `inv:BomRevision` | `skos:closeMatch` | ISA-95 "Operations Material Bill" (B2MML `OperationsMaterialBillType`) (pending Q6) | ISA-95's material bill of an operations definition | fetched [B2MML] | 0.5 |
| `inv:RoutingRevision` | `rdfs:subClassOf` | `gist:TaskTemplate` (decision 13, with its slice) | The architecture seed's placement; the template a work order is based on | fetched [gist] | 0.7 |
| `inv:RoutingRevision` | `skos:closeMatch` | `iof-constr:PlanSpecification` | The architecture seed's candidate: an information content entity with action and objective specifications | fetched [IOF] | 0.6 |
| `inv:RoutingRevision` | `skos:closeMatch` | ISA-95 "Work Master" (B2MML `WorkMasterType`) (pending Q6) | ISA-95's template for a job | fetched [B2MML] | 0.5 |
| `inv:QuantityValue` | `rdfs:subClassOf` | `gist:Magnitude` | An amount of a measurable aspect, with its unit | fetched [gist] | 0.9 |
| `inv:QuantityValue` | `skos:closeMatch` | `qudt:QuantityValue` | QUDT 3.5.3 declares `qudt:numericValue` an annotation property; the core keeps its own decimal and unit predicates (architecture seed section 7.3) | fetched [QUDT] | 0.7 |
| `inv:QuantityValue` | `skos:closeMatch` | `schema:QuantitativeValue` | A point value or interval; ours is a point value | fetched [SDO] | 0.7 |
| `inv:QuantityValue` | `skos:closeMatch` | B2MML `QuantityValueType` (pending Q6) | A quantity string with a unit of measure | fetched [B2MML] | 0.6 |
| `inv:QuantityValue` | `skos:relatedMatch` | `iof-constr:MeasuredValueExpression` | IOF's is information content about a measured value; ours is the magnitude | fetched [IOF] | 0.4 |
| `inv:MoneyAmount` | `rdfs:subClassOf` | `gist:Magnitude` | gist treats money as a magnitude whose aspect is monetary value and whose unit is a currency | fetched [gist] | 0.7 |
| `inv:MoneyAmount` | `skos:closeMatch` | `schema:MonetaryAmount` | schema.org's allows a range; ours is an exact point value, not a range. Pending decision 59, whose recommendation (a) is whole counting units at the field's stated scale, 4 for stored unit cost | fetched [SDO] | 0.8 |
| `inv:MoneyAmount` | `skos:closeMatch` | `fibo-fnd-acc-cur:MonetaryAmount` | A measure that is an amount of money in monetary units | fetched [FIBO] | 0.8 |
| `inv:UnitOfMeasureCodeScheme-KG` | `skos:exactMatch` | `unit:KiloGM` | Both are the kilogram | fetched [QUDT] | 0.95 |
| `inv:UnitOfMeasureCodeScheme-M` | `skos:exactMatch` | `unit:M` | The fetched QUDT target `unit:M` is the metre. The local code is written only as M (`Item.read.ts`); reading it as metre, and so this exactMatch, waits on decision 63 | fetched [QUDT] | 0.9 |
| `inv:UnitOfMeasureCodeScheme-L` | `skos:exactMatch` | `unit:L` | Both are the litre | fetched [QUDT] | 0.95 |
| `inv:UnitOfMeasureCodeScheme-EA` | `skos:relatedMatch` | `unit:NUM` | QUDT has no each (searched: EA, EACH, Each, PCE, PIECE); NUM is a dimensionless number, not a count of one item | fetched [QUDT] | 0.4 |
| `inv:UnitOfMeasureCodeScheme-cm` | `skos:exactMatch` | `unit:CentiM` | Both are the centimetre (`Dimensions` in `Item.read.ts`) | fetched [QUDT] | 0.95 |
| `inv:UnitOfMeasureCodeScheme-in` | `skos:exactMatch` | `unit:IN` | Both are the inch | fetched [QUDT] | 0.95 |
| `inv:MeasurementDimensionScheme-mass` | `skos:exactMatch` | `quantitykind:Mass` | The aspect KG measures | fetched [QUDT] | 0.85 |
| `inv:MeasurementDimensionScheme-length` | `skos:exactMatch` | `quantitykind:Length` | The aspect M, cm and in measure | fetched [QUDT] | 0.85 |
| `inv:MeasurementDimensionScheme-volume` | `skos:exactMatch` | `quantitykind:Volume` | The aspect L measures | fetched [QUDT] | 0.85 |
| `inv:MeasurementDimensionScheme-count` | `skos:closeMatch` | `quantitykind:Count` | EA and BX count items; a box is an item-specific pack | fetched [QUDT] | 0.6 |

No row for `BX`: a box holds an item-specific number of eaches (glossary, "Conversion factor"), so it has no unit of its
own in any target.

### Warehouse and stock terms (owned by 08)

| Subject | Predicate | Object CURIE | Justification | Checked | Confidence |
| --- | --- | --- | --- | --- | --- |
| `inv:MaterialLot` | `rdfs:subClassOf` | `gist:PhysicalSubstance` (08, pending decision 70) | Material made or received together; a lot of flour is a substance, a lot of jars a group of units | fetched [gist] | 0.5 |
| `inv:MaterialLot` | `skos:closeMatch` | ISA-95 "Material Lot" (B2MML `MaterialLotType`) (pending Q6) | ISA-95's identified amount of material | fetched [B2MML] | 0.7 |
| `inv:MaterialLot` | `skos:relatedMatch` | Sutton "Label" (pending Q6) | Public: a serialized label may stand for a pallet of one ingredient received together [S-serialized]; a label is not a lot (architecture seed) | fetched [S-serialized] | 0.5 |
| `inv:SerialUnit` | `rdfs:subClassOf` | `gist:PhysicalIdentifiableItem` | One identified physical unit | fetched [gist] | 0.9 |
| `inv:SerialUnit` | `skos:closeMatch` | `schema:IndividualProduct` | A single identifiable product instance, such as a laptop with a serial number | fetched [SDO] | 0.7 |
| `inv:SerialUnit` | `skos:relatedMatch` | Sutton "Label" (pending Q6) | Public: serialized tracking gives each unit a label ID, but a label can also cover a batch [S-serialized] | fetched [S-serialized] | 0.5 |
| `inv:InventoryLabel` | `rdfs:subClassOf` | `gist:PhysicalSubstance` (08, pending decision 71) | 08 reads the label as the labelled portion of material; the architecture seed's reading, a traceability record (`gist:Content`), is decision 71's other answer | fetched [gist] | 0.6 |
| `inv:InventoryLabel` | `skos:relatedMatch` | Sutton "Label" (pending Q6) | Sutton's Label is the record (the Labels screen: label ID, statuses Active, Quarantined, Depleted [S-serialized], [S-inventory]). Under decision 71's recommended (a), `inv:InventoryLabel` is the labelled portion of material, not that record. Different categories, so related, not close. Reassess if 71 changes the referent; the Sutton target stays the Label record | fetched [S-inventory] | 0.8 |
| `inv:InventoryLabel` | `skos:relatedMatch` | ISA-95 "Material Sublot" (B2MML `MaterialSubLotType`) (pending Q6) | The API design report claims a sublot; the architecture seed says not to assert it | fetched [B2MML] | 0.3 |
| `inv:InventoryLabel` | `skos:broadMatch` | `prov:Entity` | Under decision 71's recommended (a) the class is the labelled portion of material, and that portion is not a record, so this is not a match of the portion to `prov:Entity`. The candidate is the other reading, a traceability record under `gist:Content`. Reassess if 71 changes the referent | fetched [PROV] | 0.6 |
| `inv:Container` | `rdfs:subClassOf` | `gist:PhysicalIdentifiableItem` | A pallet or box as a thing | fetched [gist] | 0.9 |
| `inv:Container` | `skos:closeMatch` | `iof-constr:Container` | A material artifact designed to hold material entities | fetched [IOF] | 0.7 |
| `inv:Container` | `skos:closeMatch` | Sutton "Container" (pending Q6) | Named in the 2026-11-10 release per the architecture seed | from memory, unchecked | 0.5 |
| `inv:Site` | `rdfs:subClassOf` | `gist:GeoLocation` (pending Q5) | A place with the earth as frame | fetched [gist] | 0.6 |
| `inv:Site` | `skos:closeMatch` | `org:Site` | An office or other premise at which the organization is located | fetched [ORG] | 0.7 |
| `inv:Site` | `skos:closeMatch` | ISA-95 "Site" (B2MML equipment level `Site`) (pending Q6) | ISA-95's level of the equipment hierarchy | fetched [B2MML] | 0.6 |
| `inv:Site` | `skos:broadMatch` | `schema:Place` | Entities with a somewhat fixed physical extension | fetched [SDO] | 0.7 |
| `inv:Site` | `skos:broadMatch` | `gs1:Place` | Entities with a somewhat fixed physical location | fetched [GS1] | 0.6 |
| `inv:Warehouse` | `rdfs:subClassOf` | `gist:GeoLocation` (pending Q5) | As Site | fetched [gist] | 0.6 |
| `inv:Warehouse` | `skos:broadMatch` | `schema:Place` | schema.org V30.1 has no Warehouse class (searched) | fetched [SDO] | 0.7 |
| `inv:Warehouse` | `skos:closeMatch` | Sutton "Location" (pending Q6) | Public: without bins, inventory is tracked by warehouse location only [S-bins] | fetched [S-bins] | 0.6 |
| `inv:Warehouse` | `skos:closeMatch` | ISA-95 "Storage Zone" (B2MML equipment level `StorageZone`) (pending Q6) | An area for storage in the equipment hierarchy | fetched [B2MML] | 0.4 |
| `inv:Bin` | `rdfs:subClassOf` | `gist:GeoLocation` (pending Q5) | As Site | fetched [gist] | 0.6 |
| `inv:Bin` | `skos:closeMatch` | Sutton "Bin" (pending Q6) | Public: a rack, shelf or slot; bins are an organization-wide setting, off by default [S-bins] | fetched [S-bins] | 0.8 |
| `inv:Bin` | `skos:closeMatch` | ISA-95 "Storage Unit" (B2MML equipment level `StorageUnit`) (pending Q6) | The storage level below a storage zone | fetched [B2MML] | 0.5 |
| `inv:Bin` | `skos:broadMatch` | `schema:Place` | As Site | fetched [SDO] | 0.6 |
| `inv:WorkCenter` | `rdfs:subClassOf` | `gist:Collection` (07, pending decision 67) | A grouping of equipment and people scheduled as one capacity, whose members change. Decision 13 admits `gist:Collection` only if this slice takes it, and does not decide 67 | fetched [gist] | 0.5 |
| `inv:WorkCenter` | `skos:closeMatch` | ISA-95 "Work Center" (B2MML equipment level `WorkCenter`) (pending Q6) | A capacity and execution grouping, not one machine (architecture seed section 7.2) | fetched [B2MML] | 0.6 |
| `inv:Machine` | `rdfs:subClassOf` | `gist:Equipment` | Human-made tangible property used to do a task | fetched [gist] | 0.8 |
| `inv:Machine` | `skos:closeMatch` | `iof-constr:PieceOfEquipment` | The architecture seed's candidate: an artifact with an equipment role | fetched [IOF] | 0.6 |
| `inv:Machine` | `skos:closeMatch` | ISA-95 "Equipment" (B2MML `EquipmentType`) (pending Q6) | ISA-95's equipment resource | fetched [B2MML] | 0.6 |
| `inv:InventoryMeasure` | `rdfs:subClassOf` | `gist:Content` (08, pending decision 74) | A statement of one kind of quantity at a position and time, pointing at its `QuantityValue` | fetched [gist] | 0.6 |
| `inv:InventoryReservation` | `rdfs:subClassOf` | `gist:Commitment` (08) | An allocation is a promise, not a property of the item (architecture seed section 5.2) | fetched [gist] | 0.6 |

### Commitment and event terms (owned by 09)

| Subject | Predicate | Object CURIE | Justification | Checked | Confidence |
| --- | --- | --- | --- | --- | --- |
| `inv:PurchaseOrder` | `rdfs:subClassOf` | `gist:Agreement` (09, pending decision 80) | A promise; the order is not its receipt (architecture seed section 2.1) | fetched [gist] | 0.6 |
| `inv:PurchaseOrder` | `skos:broadMatch` | `schema:Order` | schema.org's order is either direction and reads as a confirmed transaction | fetched [SDO] | 0.6 |
| `inv:PurchaseOrder` | `skos:relatedMatch` | `cbv:BTT-po` | CBV's is the document type that states the order, a code; ours is the commitment | fetched [CBV] | 0.5 |
| `inv:PurchaseOrder` | `skos:relatedMatch` | `iof-constr:BuyingBusinessProcess` | IOF's is the buying process, not the commitment | fetched [IOF] | 0.3 |
| `inv:PurchaseOrder` | `skos:closeMatch` | Sutton "Purchase order" (pending Q6) | Public: receiving is through a PO or without one [S-receiving] | fetched [S-receiving] | 0.8 |
| `inv:PurchaseOrderLine` | `skos:closeMatch` | `schema:OrderItem` | A line of an order with its quantity | fetched [SDO] | 0.6 |
| `inv:SalesOrder` | `rdfs:subClassOf` | `gist:Agreement` (09, pending decision 80) | As PurchaseOrder | fetched [gist] | 0.6 |
| `inv:SalesOrder` | `skos:broadMatch` | `schema:Order` | As PurchaseOrder | fetched [SDO] | 0.6 |
| `inv:SalesOrder` | `skos:relatedMatch` | `iof-constr:SellingBusinessProcess` | The selling process, not the commitment | fetched [IOF] | 0.3 |
| `inv:SalesOrder` | `skos:closeMatch` | Sutton "Sales order" (pending Q6) | Public article title [S-titles]; the committed quantity counts units allocated to sales orders [S-inventory] | fetched [S-inventory] | 0.8 |
| `inv:SalesOrderLine` | `skos:closeMatch` | `schema:OrderItem` | As PurchaseOrderLine | fetched [SDO] | 0.6 |
| `inv:Quote` | `rdfs:subClassOf` | `gist:Offer` | A contingent commitment to exchange, valid for a period | fetched [gist] | 0.8 |
| `inv:Quote` | `skos:closeMatch` | `schema:Offer` | An offer to transfer rights to an item or provide a service. Not `schema:Quotation`, a quoted passage of text | fetched [SDO] | 0.6 |
| `inv:Quote` | `skos:closeMatch` | Sutton "Quote" (pending Q6) | Public article title only [S-titles] | fetched [S-titles] | 0.6 |
| `inv:ManufacturingOrder` | `rdfs:subClassOf` | `gist:Commitment` (09, pending decision 80) | An instruction record, not the work done (architecture seed section 5.4) | fetched [gist] | 0.5 |
| `inv:ManufacturingOrder` | `skos:relatedMatch` | `cbv:BTT-prodorder` | CBV's internal document that starts manufacturing, a code | fetched [CBV] | 0.5 |
| `inv:ManufacturingOrder` | `skos:closeMatch` | ISA-95 "Operations Request" (B2MML `OperationsRequestType`) (pending Q6) | A request for production at level 3 | fetched [B2MML] | 0.5 |
| `inv:ManufacturingOrder` | `skos:relatedMatch` | `iof-constr:ManufacturingProcess` | IOF's is the process, not the order | fetched [IOF] | 0.4 |
| `inv:ManufacturingOrder` | `skos:closeMatch` | Sutton "Manufacturing order" (pending Q6) | Public: a production job that generates one work order per routing step [S-mo] | fetched [S-mo] | 0.8 |
| `inv:WorkOrder` | `rdfs:subClassOf` | `gist:Commitment` (09, pending decision 80); `gist:Task` is this document's other reading | Work promised for one step of a manufacturing order, based on a routing step | fetched [gist] | 0.5 |
| `inv:WorkOrder` | `skos:closeMatch` | ISA-95 "Work Directive" (B2MML `WorkDirectiveType`) (pending Q6) | ISA-95 part 4's instruction for a job | fetched [B2MML] | 0.4 |
| `inv:WorkOrder` | `skos:closeMatch` | Sutton "Work order" (pending Q6) | Public: one per step in the item's routing [S-mo] | fetched [S-mo] | 0.8 |
| `inv:TransferOrder` | `rdfs:subClassOf` | `gist:Commitment` (09, pending decision 80) | A promise to move stock | fetched [gist] | 0.5 |
| `inv:TransferOrder` | `skos:relatedMatch` | `iof-constr:MaterialLocationChangeProcess` | IOF's is the movement, not the order | fetched [IOF] | 0.4 |
| `inv:TransferOrder` | `skos:relatedMatch` | Sutton "transfer" (pending Q6) | Public: the committed quantity counts units allocated to transfers [S-inventory]; no transfer page read | fetched [S-inventory] | 0.5 |
| `inv:Receipt` | `rdfs:subClassOf` | `gist:Transaction` | A transfer of goods | fetched [gist] | 0.7 |
| `inv:Receipt` | `skos:closeMatch` | `schema:ReceiveAction` | Taking delivery of an object transferred from an origin | fetched [SDO] | 0.6 |
| `inv:Receipt` | `skos:relatedMatch` | `epcis:ObjectEvent` | Exported as an object event whose business step is receiving | fetched [EPCIS] | 0.6 |
| `inv:Receipt` | `skos:relatedMatch` | `cbv:BizStep-receiving` | A business step code | fetched [CBV] | 0.6 |
| `inv:Receipt` | `skos:closeMatch` | Sutton "Receiving" (pending Q6) | Public: through a PO or manually, with rejected materials handled [S-receiving] | fetched [S-receiving] | 0.7 |
| `inv:Shipment` | `rdfs:subClassOf` | `gist:Transaction` | A transfer of goods | fetched [gist] | 0.7 |
| `inv:Shipment` | `skos:closeMatch` | `schema:ParcelDelivery` | The delivery of a parcel by post or a carrier | fetched [SDO] | 0.5 |
| `inv:Shipment` | `skos:relatedMatch` | `cbv:BizStep-shipping` | A business step code | fetched [CBV] | 0.6 |
| `inv:Shipment` | `skos:closeMatch` | Sutton "Shipment" (pending Q6) | Public: single-order and multi-order shipments [S-shipping] | fetched [S-shipping] | 0.8 |
| `inv:TransformationEvent` | `rdfs:subClassOf` | `gist:PhysicalEvent` (decision 13, with its slice) | An event at a place | fetched [gist] | 0.6 |
| `inv:TransformationEvent` | `skos:closeMatch` | `epcis:TransformationEvent` | Inputs consumed, outputs produced; not every local event is a valid EPCIS event (architecture seed alignment register) | fetched [EPCIS] | 0.8 |
| `inv:TransformationEvent` | `skos:relatedMatch` | `iof-constr:ManufacturingProcess` | IOF's is a planned process; a transformation record may be unplanned | fetched [IOF] | 0.4 |
| `inv:TransformationEvent` | `skos:broadMatch` | `prov:Activity` | Consuming and generating entities over time | fetched [PROV] | 0.6 |
| `inv:AggregationEvent` | `rdfs:subClassOf` | `gist:PhysicalEvent` (decision 13, with its slice) | As above | fetched [gist] | 0.6 |
| `inv:AggregationEvent` | `skos:closeMatch` | `epcis:AggregationEvent` | Packing with action ADD or OBSERVE | fetched [EPCIS] | 0.8 |
| `inv:DisaggregationEvent` | `skos:broadMatch` | `epcis:AggregationEvent` | EPCIS has no disaggregation class; an aggregation with action DELETE (architecture seed section 7.1) | fetched [EPCIS] | 0.7 |
| `inv:ObjectObservation` | `skos:closeMatch` | `epcis:ObjectEvent` | Observed objects or quantities | fetched [EPCIS] | 0.7 |
| `inv:OperationExecution` | `rdfs:subClassOf` | `gist:Task` (decision 13, with its slice) | The architecture seed's placement: the performed activity | fetched [gist] | 0.7 |
| `inv:OperationExecution` | `skos:closeMatch` | `iof-constr:PlannedProcess` | A process prescribed by a plan specification (architecture seed) | fetched [IOF] | 0.6 |
| `inv:OperationExecution` | `skos:closeMatch` | ISA-95 "Operations Response" (B2MML `OperationsResponseType`) (pending Q6) | What was actually done for a request | fetched [B2MML] | 0.4 |
| `inv:QualityInspection` | `rdfs:subClassOf` | `gist:Determination` | An event to establish an outcome | fetched [gist] | 0.7 |
| `inv:QualityInspection` | `skos:closeMatch` | `iof-constr:MeasurementProcess` | A planned process to determine the value of an attribute | fetched [IOF] | 0.5 |
| `inv:QualityInspection` | `skos:relatedMatch` | `cbv:BizStep-inspecting` | A business step code | fetched [CBV] | 0.6 |
| `inv:QualityInspection` | `skos:closeMatch` | `schema:CheckAction` | An agent inspects an object's quality or condition | fetched [SDO] | 0.4 |
| `inv:QualityHold` | `skos:relatedMatch` | `cbv:Disp-non_sellable_other` | Only when the hold stops sale; a hold may restrict movement instead (architecture seed) | fetched [CBV] | 0.4 |
| `inv:StockCount` | `rdfs:subClassOf` | `gist:Determination` | A count settles a quantity | fetched [gist] | 0.8 |
| `inv:StockCount` | `skos:relatedMatch` | `cbv:BizStep-cycle_counting` | A business step code; CBV's excludes counts for accounting | fetched [CBV] | 0.6 |
| `inv:ItemImport` | `rdfs:subClassOf` | `gist:Event` | The file import, from upload to confirm (`Import.read.ts`) | fetched [gist] | 0.8 |
| `inv:ItemImport` | `skos:broadMatch` | `prov:Activity` | It uses a file and generates items | fetched [PROV] | 0.7 |
| `inv:StagedFile` | `rdfs:subClassOf` | `gist:FormattedContent` (decision 13, with its slice) | The uploaded .csv or .xlsx | fetched [gist] | 0.7 |
| `inv:StagedFile` | `skos:broadMatch` | `prov:Entity` | The entity an import uses | fetched [PROV] | 0.7 |
| `inv:eventTime` (property, 09) | `skos:closeMatch` | `epcis:eventTime` | The time the event took place. Its gist parent, `rdfs:subPropertyOf` `gist:atDateTime`, is in section E, not a mapping | fetched [EPCIS] | 0.7 |
| `inv:recordTime` (property, 09) | `skos:closeMatch` | `epcis:recordTime` | The time the event was captured. Its gist parent, `rdfs:subPropertyOf` `gist:isRecordedAt`, is in section E, not a mapping | fetched [EPCIS] | 0.7 |
| `inv:eventTime` (property, 09) | `skos:relatedMatch` | `time:inXSDDateTimeStamp` | OWL-Time puts the stamp on an instant, not on the event; an export view adds the instant | fetched [TIME] | 0.4 |

### Taxonomy concepts (owned by 10)

| Subject | Predicate | Object CURIE | Justification | Checked | Confidence |
| --- | --- | --- | --- | --- | --- |
| `inv:ItemRoleScheme-buy` | `skos:closeMatch` | Sutton item type "Buy" (pending Q6) | Public: you purchase it; any combination with Make and Sell [S-items] | fetched [S-items] | 0.8 |
| `inv:ItemRoleScheme-make` | `skos:closeMatch` | Sutton item type "Make" (pending Q6) | Public: you produce it [S-items] | fetched [S-items] | 0.8 |
| `inv:ItemRoleScheme-sell` | `skos:closeMatch` | Sutton item type "Sell" (pending Q6) | Public: you sell it [S-items] | fetched [S-items] | 0.8 |
| `inv:TrackingMethodScheme-untracked` | `skos:closeMatch` | Sutton "Standard" tracking (pending Q6) | Public: tracked by quantity in bins; cannot be changed after creation [S-serialized] | fetched [S-serialized] | 0.8 |
| `inv:TrackingMethodScheme-label` | `skos:closeMatch` | Sutton "Serialized" tracking (pending Q6) | Public: each serialized unit gets a label ID, which may be a batch or a pallet [S-serialized]; the architecture seed names it Label | fetched [S-serialized] | 0.7 |
| `inv:LabelLifecycleScheme-active`, `inv:LabelLifecycleScheme-depleted` | `skos:closeMatch` | Sutton label statuses "Active", "Depleted" (pending Q6) | Public label filters [S-inventory]; Sutton's "Quarantined" is 10's `QualityDispositionScheme-onHold` on an active label (10, 4.20), one row each | fetched [S-inventory] | 0.8 |
| `inv:InventoryMeasureKindScheme-committed` | `skos:closeMatch` | Sutton "Committed" (pending Q6) | Public: units allocated to sales orders, manufacturing orders or transfers, including reservations [S-inventory]: it contains Reserved, so the measures overlap | fetched [S-inventory] | 0.8 |
| `inv:InventoryMeasureKindScheme-available`, `-onHand`, `-reserved`, `-acquired`, `-quarantined` | `skos:closeMatch` | Sutton "Available", "In stock", "Reserved", "Acquired", "Quarantined" (pending Q6) | Public list of quantities [S-inventory]; their formulas are not published | fetched [S-inventory] | 0.6 |
| `inv:InventoryMeasureKindScheme-committed`, `-available` | `skos:relatedMatch` | B2MML capability types "Committed", "Available" (pending Q6) | B2MML's are capability types of resources, not stock measures | fetched [B2MML] | 0.3 |
| `inv:BusinessStepScheme-receiving`, `-shipping`, `-packing`, `-unpacking`, `-commissioning`, `-inspecting` | `skos:closeMatch` | `cbv:BizStep-receiving`, `-shipping`, `-packing`, `-unpacking`, `-commissioning`, `-inspecting` | The architecture seed's crosswalk candidates; each exists in CBV 2.0.0, and CBV has no `BizStep-transforming` (searched) | fetched [CBV] | 0.7 |
| `inv:QualityDispositionScheme-onHold` | `skos:relatedMatch` | `cbv:Disp-non_sellable_other` | As QualityHold above | fetched [CBV] | 0.4 |
| `inv:MemberRoleScheme-admin` | `skos:relatedMatch` | Sutton role "Admin" (pending Q6) | The architecture seed reports Admin, Manager and Operator from an October 2026 release | from memory, unchecked | 0.4 |

### Names that look like matches and are not

A reviewer seeing these in a candidate file rejects them:

| Looks like | Is | Why not |
| --- | --- | --- |
| Sutton Account and `gist:Account` | `gist:Account` is an agreement having a balance | Decision 3 |
| Sutton Account and `fibo-fbc-pas-caa:Account`, `fibo-fbc-pas-caa:CustomerAccount` | Financial accounts, containers of records and balances | Same reason |
| `inv:Quote` and `schema:Quotation` | A quoted passage from a written work | Homonym |
| `inv:Organization` and `org:OrganizationalUnit`, `cmns-org:OrganizationalSubUnit` | A department inside an organization | Narrower and of a different use; add only if 06 models departments |
| `inv:MaterialLot` and `epcis:epcClass` | A property holding a class-level identifier (a GTIN with a lot) | A property, not a class; the export adapter uses it |
| `inv:Container` and `epcis:parentID` | The identifier of the parent in an aggregation | A property |
| `inv:ItemSpecification` and `iof-constr:MaterialProduct` | A material entity bearing a product role: the stock, not the description | Specification against stock (report 01 section 1) |
| `inv:Person` and `schema:Person` as exact | schema.org's includes fictional persons | Fails test (1) |
| `inv:UnitOfMeasureCodeScheme-EA` and `unit:NUM` as exact | A pure number | Fails test (1) |

### Coverage and counts

Counted over the alignment tables above (the "Names that look like matches" table excluded). The two property parent
links (`eventTime` under `gist:atDateTime`, `recordTime` under `gist:isRecordedAt`) sit in section E and are not rows
of these tables:

- Rows: 177. By predicate: `rdfs:subClassOf` 42, `skos:exactMatch` 8, `skos:closeMatch` 76, `skos:broadMatch` 16,
  `skos:narrowMatch` 3, `skos:relatedMatch` 32. No `rdfs:subPropertyOf` row remains in these tables. The four rows
  decisions 39 and 43 restore are on `inv:ContactAssignment` (Sutton "Contact", `org:Membership`, FIBO "Contact",
  `schema:ContactPoint`), plus its gist parent.
- By target: gist 42, Sutton 28, schema.org 23, IOF 16, ISA-95/B2MML 15, QUDT 11 (units 6, quantity kinds 4, schema 1),
  CBV 9, PROV-O 8, EPCIS 7, W3C ORG 6, FIBO 5, OMG Commons 3, GS1 3, OWL-Time 1.
- Subjects: 74 distinct subject cells (a cell naming several concepts of one scheme counts once): 11 for 06, 18 for 07,
  11 for 08, 22 for 09, 12 for 10.
- Party, item, lot, location, order and event terms each have rows to at least three targets.
- Checked: every row but three (Sutton "Container", Sutton role "Admin", FIBO "Contact") was checked against a fetched
  file. No `inv:` subject exists yet: the vocabulary module is not built, so subject existence is "not built".
- No `exactMatch` clique has more than two members: each of the 8 exact rows joins one `inv:` concept to one QUDT term,
  and no QUDT term has two.

Recount when the rows become a candidate SSSOM file under `explorations/erp-ontology/assets/mappings/`.

## Questions for Benjamin

Moved on 2026-11-22 to the packet's [DECISIONS.md](../DECISIONS.md), "Open", merged with the other reports'
questions. Q1, Q2, Q3 and Q4 are answered: decisions 15, 16, 13 and 14. A "(pending Qn)" mark that remains means:
Q5 is decision 68, Q6 is 29, Q7 is 30, Q8 is 28. Each of those is still open.

## Not checked

- No `inv:` term exists: the vocabulary module is not built. Subjects were the likely Keys of documents 06 to 10,
  written at the same time as this one; they were matched by hand to those documents on 2026-11-22 (report 13), and no
  row was re-checked against its target file after the rename.
- No SSSOM file was written or validated (`sssom validate` not run), no clique analysis was run, and no reasoner was run
  over the projection with the 24 disjointness pairs.
- The ISA-95 standard text is licensed and was not read; ISA-95 rows rest on B2MML 0701's type and enumeration names,
  not on ISA-95's definitions.
- Sutton: only the eight public articles named, and the search listing for titles. Not read: the Quotes, Sales orders,
  Purchase orders, transfer, container, BOM, quality, roles and release-notes pages. Sutton's GraphQL schema is behind
  a token and was not sought. Carrier and contract manufacturer as account flags were not seen on a public page.
- FIBO and OMG Commons files were parsed but not hashed; FIBO was read at `master/latest`, which moves. The restored
  FIBO "Contact" row names no class IRI: those files were not re-opened for one.
- The thin thread's disjointness was not run in a reasoner. Of the 24 pairs, three have both sides among the seven gist
  classes the thread admits: `gist:Organization` with `gist:Content`, `gist:Organization` with
  `gist:PhysicalIdentifiableItem`, and `gist:PhysicalIdentifiableItem` with `gist:Content`.
- The QUDT units and quantity kinds files were searched for a handful of names only; no each or box unit was found
  under the names tried, which does not prove none exists under another name.
- The schema.org `http` file was not compared with the `https` one.
- gist's data individuals (`gistd:`, such as the monetary value aspect) live outside gistCore.ttl and were not read.
- IOF modules beyond Core (supply chain, maintenance) were not read; a lot or a site class there was not looked for.
- `bun run docs:check` is the only check run on this file.
