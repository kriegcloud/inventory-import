---
type: Research
title: Scope and competency questions
description: What the ERP ontology is for, who asks it questions, and fifty competency questions traced to the designs.
---

# Scope and competency questions

This is a proposal to argue with, written before the first vocabulary module exists, as the `ontology-requirements`
skill asks. Nothing here was run against an ontology: there is no generated Turtle, no fixture graph and no
competency-question suite yet, so every query below is "drafted; run: not built". Section 4 sketches ten questions in fourteen SPARQL blocks.
Earlier drafts were parsed with rdflib (see "Not checked").

Inputs: the packet's `DECISIONS.md` (answers and ruling of 2026-11-22), reports 01 and 02, the skills' `_shared/project-profile.md`,
the two seed reports (cited as "the architecture seed" and "the API design report"), the catalog and access contract
packages, `docs/glossary.md`, the product `DECISIONS.md`, `CLAUDE.md` ("Rules for an import") and the Alchemy domain
brief. Where the two seeds disagree, report 01 section 5 is followed: SKU optional, overlapping inventory measures,
an `example.org` namespace, BOM acyclicity on a resolved expansion, Unknown machine state kept apart from Running.

A term owned by another design document is named here by its likely key with the document in brackets, for example
`Organization` (06). The keys were matched against 05 to 12 on 2026-11-22 ([report 13](13-term-index.md) lists
every key and its owner); where this report first named a term of its own that 09 also defines (the import's terms),
09's key is used, as section 5 said it would be. The traceability table at the end says which document must answer
each question. Open choices are numbered decisions in the packet's [DECISIONS.md](../DECISIONS.md); a "(pending Qn)"
mark here is mapped to its decision under "Questions for Benjamin".

## 1. What the ontology is for

Decision 1: the ontology is the model of record for this repository's contexts (catalog and access today, the ones to
come next), and Sutton is a mapping onto it. So the questions come first from what this repository records, shows and
refuses, and second from what a Sutton mapping would have to carry. A question that only Sutton motivates is marked
"Sutton only" and ranked below one the repository needs today (pending Q9).

Upper ontology: gist (projection), decision 4. IOF, ISA-95, EPCIS, QUDT, schema.org, W3C ORG and FIBO are alignment
rows only.

An answer comes from the generated T-box plus instance data (stored rows or named `test_` fixtures), never from the
T-box alone. Record rules (required, datatype, pattern, allowed values, uniqueness) belong to the record schemas and
are projected to SHACL (decision 2, report 02). A constraint question and its must-fail case use a violation query
over its fixture. Gate 11 checks record shapes separately over lifted stored rows, never over a question's fixture.

### Who asks it questions

| Asker | What it needs from the ontology | Where it lives today |
| --- | --- | --- |
| The import review (Upload, Match, Review, Result) | What a row of a file is, what an item is, what a match key is, which outcomes there are and that they add up, what a proposal is and who decided | `packages/catalog/web/src/`, `packages/catalog/model/src/Review/Review.rules.ts`, `packages/catalog/contract/src/Import/` |
| The Items table and its assistant | What an item is and which of its values are money, quantities with a unit, lifecycle and tracking codes | `packages/catalog/web/src/ItemsPage.screen.tsx`, `packages/catalog/contract/src/Item/Item.read.ts` |
| Tenancy and roles (People, sign-in, every write) | What an organization, a member and a role are; that every record belongs to one organization; who may see and change what | `packages/access/contract/src/`, `packages/kernel/src/Role.schema.ts`, `docs/auth.md` |
| The future Alchemy domain layer | A term IRI for every aggregate, command, event and view, and an identity criterion for every aggregate key (report 01 section 6) | `explorations/alchemy-domain/BRIEF.md` ("Every single thing") |
| A Sutton mapping | Terms for parties with role flags, items with optional SKU, stock positions and measures, lots and labels, orders, receipts, shipments and traceability events, each with a place to cite Sutton's public name | the architecture seed sections 5 and 7; the API design report section 4 |

### Use cases

Each use case comes from a screen, an import rule or a seed section. The competency questions in section 3 name the
use case they serve in their Source column through the same source.

| Id | Use case | Actor | What the actor gets |
| --- | --- | --- | --- |
| UC-01 | Review and confirm a file of items | Operations admin (editor) | Every row's outcome, every value fixed for them, the match against stored items, nothing written before Confirm |
| UC-02 | Read what an import did, and take it back | Editor, viewer | Counts read from what is stored, the left-out rows with reasons, a take-back that keeps and names changed records |
| UC-03 | Look after the organization's people | Admin | Members, roles, who did what, an admin always kept |
| UC-04 | Find and edit items | Viewer, editor | Items with their codes, units, money and lifecycle; vendors per item |
| UC-05 | Point the domain layer's classes at terms | The repository's own checks | One term per aggregate, event and view, with an identity criterion for each key |
| UC-06 | Map a Sutton tenant's records | An integration, later | Parties with role flags, items, locations, stock measures, orders and events, without claiming Sutton's schema |
| UC-07 | Trace a questioned lot forward and back | Quality lead, Sutton only | Every lot, shipment and customer it may have reached, every input and vendor it may have come from |

## 2. Scope

### In scope

The thin thread comes first (decision 8) and answers CQ-P06 alone. `Tenant` is a role class under `Organization`, keyed
by `OrganizationId`; `membershipIn` links a `Member` to a `Tenant` (decision 38). `Person` falls under `gist:Person`
(decision 94). The thread also takes `Role`, `Grant`, `MemberRoleScheme`, `GrantScopeKindScheme` and `AuditEntry`
(alternative label "Activity", decision 46) through the vocabulary module, typed record pointers and generated OWL
and SKOS. It admits only the gist parents those terms need and their named ancestors (decisions 13 and 14).
Every field of a pointed record carries a pointer or `noTerm` with a reason. Its SHACL shape is closed (decision 22).

The thread builds gates 1 to 9 and must show each failing once on a planted mistake. Gates 5 and 7 cover only the
access contract and the four kernel records (decision 95). N3.js re-parses the Turtle, Oxigraph runs CQ-P06
(decision 26), and ROBOT/HermiT runs the reasoner check (decision 25). Gate 11 adds shacl-engine with the stored
sample; gate 12 waits for the alignment slice. Gate 10 belongs to open decision 27. Slice 1, the party slice,
follows the thread.

- The terms the repository's records stand for today: item, vendor offer, unit, money, lifecycle, tracking flag, the
  import and its rows, outcomes, value changes, proposals and decisions, organization, member, role, audit entry.
- The party model of report 01 section 3: a Sutton Account is the organization itself. Its customer and vendor flags
  belong to the tenant's `SourceRecord`, not to the shared organization (decision 3 as amended by 34).
- The stock and commitment distinctions the architecture seed keeps: item specification against stock, lot against
  label against unit serial, order against execution, reservation against consumption, packing against transformation,
  source assertion against inference.
- Identity and provenance: which row of which file a record came from, who decided, which values differ from the file,
  and which facts a Sutton source record asserted.

### Out of scope (non-goals)

| Not covered | Why |
| --- | --- |
| A reconstruction of Sutton's GraphQL schema | The architecture seed says its packet is not one; Sutton's schema is behind a token; decision 7 forbids minting under Sutton's name |
| A general ledger, AP or AR | Sutton has none (public, via both seeds); invoices and bills are documents that leave for accounting systems |
| FSMA 204 compliance or certification | The architecture seed: a validation result is not compliance; no repository record |
| Machine telemetry, OEE and planning (MRP runs, capacity) | Vendor capability claims with no public schema (the architecture seed 5.3, 5.4); no repository record |
| Record rules (required fields, patterns, uniqueness, defaults) | The record schemas own them and SHACL is projected from them (decision 2); the ontology does not restate them |
| How a screen shows a total or a sentence | Product rules in `CLAUDE.md`; a question here only checks the data a total is made of |
| Probability or confidence of a match | Beyond OWL; a confidence stays a stored value with its source |
| `owl:sameAs`, `owl:inverseOf`, RDF 1.2 triple terms, SHACL 1.2 UI | Rules from reports 01 and 02 and the profile; the drafts stay out of the production lane (the architecture seed 3.1) |

### Constraints the questions assume

- OWL 2 DL; no `owl:inverseOf` (a reverse walk is a SPARQL `^p` path); no `owl:sameAs`.
- All Turtle generated from one TypeScript vocabulary module (decision 2); the namespace is the `example.org`
  placeholder (decision 7): queries use `inv:` as `namespaces.json` gives it.
- Terms have an English `skos:prefLabel` and `skos:definition` (decision 11). An instance's name is a value from its
  record field, written `inv:name` here.
- A coded field stores the notation and lifts to its scheme's concept IRI (decision 23). The IRI is the namespace
  followed by the scheme key, a hyphen and the notation, as in `inv:MemberRoleScheme-admin` (decision 10).
- No query relies on a reasoner: a question that needs a subclass walks `rdf:type/rdfs:subClassOf*` itself (pending
  Q5).

## 3. Competency questions

Kind is one of enumerative (list what holds), constraint (list what breaks a rule: passes with zero rows, beside a
companion query that shows the fixture holds the rule's antecedent) and reachability (follow a path of any length).
"Sutton public" marks a fact from Sutton's public documents as the architecture seed cites them; none was fetched in
this session. A dagger (†) marks one of the ten questions in section 4. Must-fail cells use 12 section 6.3's forms:
remove, add, variant fixture or mutant query; a vocabulary variant belongs to gate 4 or 9. Unless marked otherwise,
a described fixture is a variant fixture and a changed reading is a mutant query.

### 3.1 Party and access

| Id | Question | Terms it needs | Kind | Must-fail case | Source | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| CQ-P01 † | Which organizations does our tenant both buy from and sell to? | `SourceRecord`, `recordOf` (here), `Organization`, `isCustomer`, `isVendor`, `inTenant` (06) | enumerative | Remove `isCustomer` from the tenant's record of `test_CoPacker`: the expected row is missing. Variant fixture: one shared company is only a customer here and only a vendor in the second tenant. Select the tenant before reading flags: neither tenant buys from and sells to that company. Disjoint customer and vendor classes would make the co-packer inconsistent, but decision 3 uses flags instead | Decision 3; report 01 section 3 (a co-packer buys packaging and sells finished goods); Sutton public: "Accounts represent customers and vendors" (quoted in report 01) | must (decision 34) |
| CQ-P02 | Which of our organizations hold no trading role at all? | `SourceRecord`, `recordOf` (here), `Organization`, `inTenant`, the record's role flags (06: `isCustomer` and `isVendor` while decision 89 is open) | enumerative | Variant fixture, slice 1: select the tenant/account before reading its flags. No flag stated there means unknown, not roleless, regardless of what another tenant states | Profile ("whether a role flag is always stated true or false"); foundational law "negative inference requires declared closure" | should (pending Q2) |
| CQ-P03 | Which people are contacts at an organization, for which purpose (billing, shipping, receiving), and is a person who is a contact at two organizations one person? | `Person`, `Organization`, `ContactAssignment`, `ContactPoint`, `servesPurpose` (06), `ContactPurposeScheme` (10), `SourceRecord`, `recordOf`, `sourceSystem`, `sourceType`, `sourceId` (here) | enumerative | Add a second `recordOf` person to one source record (tenant, system, type, opaque id): one violation. The same id "001" in another system on a record about another person: zero. Equal ids never join people; that takes CQ-P04's decision. Variant fixture: one person uses the same contact point for billing at A and receiving at B. Expect only those two rows. Read the purpose and contact point from each assignment; joining on the person or point alone mixes the accounts | Decisions 39 and 43; report 01 section 3; Sutton public: accounts "have associated contacts" (quoted in report 01) | should |
| CQ-P04 † | Which two source records a tenant holds were decided to be about one party, by whom, when, and on what evidence? | `IdentityDecision`, `decidesOn`, `identityOutcome`, `decidedBy`, `citesEvidence`, `Member`, `inTenant` (06), `eventTime` (09), `IdentityOutcomeScheme` (10) | enumerative | Variant fixture: neither a shared name nor a reversed decision returns a pair. Decisions about another tenant's own records of those parties neither appear nor hide this tenant's decision. Add `owl:sameAs` and remove the decision: CQ-P04 loses its row and CQ-P05 answers true | Report 01 section 3; the architecture seed 4.2 ("store the match evidence, reviewer, confidence"); profile rule "no `owl:sameAs`" | must (decision 34) |
| CQ-P05 | Does any party, item or record stand in `owl:sameAs` with another? | no term: `owl:sameAs` itself, read by the ASK in section 4 | constraint | Add one `owl:sameAs` triple between two fixture organizations: the ASK answers true. With distinct source records and only the shared name "Acme Industrial", the ASK answers false. Whether an identity criterion rests on a name or a SKU is CQ-I08, which gate 4 answers over the module | Profile rules; report 02 (planned `laws ontology-terms` rule); `docs/glossary.md` ("Supplier: matched by name") | must |
| CQ-P06 | Who are the members of this organization and which role does each hold? | `Tenant`, `Member`, `membershipIn`, `membershipOf`, `Person`, `Grant`, `grantedTo`, `grantsRole`, `grantScope`, `Role` (06), `MemberRoleScheme`, `GrantScopeKindScheme` (10) | enumerative | Select the organization's members and read their lifted roles through an OPTIONAL grant (decision 40). Remove `grantsRole` from Ravi's admin grant: the member remains but the expected role is missing; the companion query finds one non-removed member without a grant carrying a role. The role shape is a separate slice-2 SHACL check over lifted stored records, not gate 8 | `packages/access/contract/src/People/Person.read.ts`; `packages/kernel/src/Role.schema.ts` | must |
| CQ-P07 | Does every tenant keep at least one admin who is not removed? | `Tenant`, `Member`, `membershipIn`, `grantedTo`, `grantsRole`, `removedAt` (06), `MemberRoleScheme` (10) | constraint | Start from each Tenant, never from memberships. Variant fixtures: a tenant whose only admin is removed and a tenant with no members each give one violation. A non-tenant vendor with no members (`test_FlourMill`) gives none. Companion: a tenant has a non-removed admin from the scalar-role lift below | `CLAUDE.md` ("the organization always keeps an admin"); the Alchemy brief (`Organization`, `Member` aggregates) | must |
| CQ-P08 † | Who may see the stock held at one site? | `Grant`, `grantedTo`, `grantScope`, `Member`, `membershipIn` (06), `GrantScopeKindScheme` (10), `atLocation`, `Site`, `Location`, `hasParentLocation` (08), `startedAt`, `endedAt` (09) | reachability | Mutant queries: walking down admits a bin grant; an optional location admits an unlocated grant; ignoring the period admits `test_Noor` and `test_Ada`. A tenant grant covers the site. Vocabulary variant, gate 4: organization-only scope cannot express the site grant | Report 01 section 3 (a grant is a role at a scope; Siebel access control); Sutton public: custom roles and location permissions, October and November 2026 releases (via both seeds) | should (pending Q8, Q9) |
| CQ-P09 | Does any record belong to no organization, or to two, or point at a record of another organization? | `inTenant` (06) on every tenant-held class | constraint | Slice 1: remove a party record's only `inTenant` or add a second: one violation in either case. Warehouse variant fixture: a stock position whose item is in the second organization gives one violation | `CLAUDE.md` ("Every table that holds customer data has `organizationId`"); `apps/inventory/test/` `Tenancy.slow.test.ts` (named in `CLAUDE.md`) | must |
| CQ-P10 | Who did each recorded act, did an agent act for them, and is a removed member still named on what they did? | `AuditEntry`, `recordedActor`, `actingAgentName`, `AgentRun`, `actsFor`, `Member`, `removedAt` (06), `RowDecision`, `ImportConfirmation`, `performedBy` (09) | enumerative | Variant fixture: a decision whose member was removed must still return that member; an agent act must name the person it acted for, and fails if it names only the agent | `packages/kernel/src/Activity.schema.ts` (`agent`); `docs/auth.md` ("Agents act for a person"); the `member` table's comment in `apps/inventory/migrations/0001_init.sql`; the architecture seed 5.7 (suspension keeps attribution) | should |

In CQ-P06's fixture, `test_RaviWorks` and `test_RaviSecond` each link by `membershipOf` to the same `Person`,
`test_Ravi` (decision 94). Ask for `test_ExampleWorks`: expect only (`test_RaviWorks`, `inv:MemberRoleScheme-admin`).
Ask for `test_SecondOrg`: expect only (`test_RaviSecond`, `inv:MemberRoleScheme-viewer`). Each record's role field
becomes one `Grant`: `grantedTo` names the membership, `grantsRole` the role (decision 40), and `grantScope` the one
concept in `GrantScopeKindScheme`, `organization` (decision 96). `MemberRoleScheme` contains `viewer`, `editor` and
`admin`. Each concept is a `Role` individual at the same IRI, identified only by scheme and notation. `Role` has no
gist parent and the thread has no `permits` (decision 41). Neither a name nor an email supplies a path: the person's
name, organization's name and sign-in email are `noTerm` with reason `screen` (decision 93). Put `grantsRole` directly on the member instead and CQ-P06
loses the expected role. Slice 1 reuses the lift for CQ-P07; that misplaced link leaves the tenant without its admin.

### 3.2 Catalog

| Id | Question | Terms it needs | Kind | Must-fail case | Source | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| CQ-C01 | Which item specifications does this organization hold, with name and SKU where it has one? | `ItemSpecification`, `identifiedBy`, `ItemIdentifier`, `identifierText`, `identifierKind` (07), `name`, `inTenant` (06) | enumerative | Variant fixture: an item with no SKU must still appear; a query that requires a SKU drops it and fails | `packages/catalog/contract/src/Item/Item.read.ts`; Sutton public: an item may have no SKU (Items article, via the architecture seed 5.1); report 01 section 5 | must |
| CQ-C02 | Which items are bought, made and sold, several roles at once? | `ItemSpecification`, `itemRole` (07), `ItemRoleScheme` (10) | enumerative | Vocabulary variant, gate 9: Buy, Make and Sell as disjoint subclasses: an item with Buy and Sell is inconsistent; the expected item missing fails | Sutton public: overlapping Buy, Make and Sell (Items article, via the architecture seed 5.1, 6) | should |
| CQ-C03 | Which items are service or alias items, which stock item does each alias fulfil, and does any alias reach itself or hold stock of its own? | `ServiceItemSpecification`, `AliasItemSpecification`, `fulfilledBy` (07), `StockPosition` (08) | reachability | Variant fixture: an alias whose fulfilment chain returns to it: one violation row; an alias with its own stock position: one violation row | Sutton public: Inventory, Service and Alias items (via the architecture seed 5.1); the architecture seed's alias shapes | could |
| CQ-C04 | Which vendors offer this item, at what unit cost and lead time, which one is preferred, and which offers name a vendor known only by name? | `VendorItem`, `offeredBy`, `offeredItem`, `vendorName`, `unitPrice`, `leadTime`, `isPreferred`, `MoneyAmount` (07), `Organization` (06) | enumerative | Variant fixture: a vendor kept only as a text name must be listed as "name only", not as an organization; an offer with no `unitPrice` is one row of the companion violation query | `Item.read.ts` (`Vendor`: name, vendor SKU, unit cost, lead time, preferred); profile ("vendors are names inside `item.vendors`"); `docs/glossary.md` ("Supplier") | must (pending Q4) |
| CQ-C05 | Does any item have more than one preferred vendor offer? | `VendorItem`, `isPreferred` (07) | constraint | Variant fixture: an item with two preferred offers: one violation row; companion: items with offers exist | `Item.read.ts` ("at most one per item"); product `DECISIONS.md` ("At most one vendor", two preferred vendors asked) | must |
| CQ-C06 | Which items are discontinued and since when, and is any discontinued item still active? | `ItemSpecification`, `discontinuedOn` (07), `lifecycleState`, `ItemLifecycleScheme` (10) | constraint | Variant fixture: an item discontinued yet active: one violation row | `Item.read.ts` (`Stocking`); the `item` table's check in `0001_init.sql`; product `DECISIONS.md` (rows 45, 164) | must |
| CQ-C07 | Which items are tracked by lot, and does any stock of a lot-tracked item name no lot? | `ItemSpecification`, `trackingMethod` (07), `TrackingMethodScheme` (10), `StockPosition`, `forItem`, `forLot` (08) | constraint | Variant fixture: a position of a lot-tracked item without a lot: one violation row | `Item.read.ts` (`lotTracked`); `docs/glossary.md` ("Lot, serial"); Sutton public: standard against serialized tracking (via the architecture seed 5.2) | should |
| CQ-C08 † | Does a resolved BOM expansion hold a component that requires itself, or an edge that crosses expansions? | `BomExpansion`, `BomExpansionNode`, `requiresComponent`, `nodeOf` (07) | reachability | Variant fixture: a three-node cycle in one expansion: three rows, one per node; two historical alternatives that would form a cycle only when unioned: zero rows | The architecture seed 5.1 and its BOM shapes; report 01 section 5 (depth is a product setting, not a meaning); Sutton public: BOM versions (via the architecture seed 5.1) | could |

### 3.3 Values and units

| Id | Question | Terms it needs | Kind | Must-fail case | Source | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| CQ-V01 | What is each item's unit cost as an exact amount in a named currency? | `CostObservation`, `costOf`, `costAmount`, `MoneyAmount`, `minorUnits`, `minorUnitScale`, `currency`, `Currency` (07; pending decision 59); only under 60(a), `costBasis` (07) and `CostBasisScheme`'s `stated` (10). The no-basis option requires no costing method | enumerative | Variant fixture: a cost "1.005" stored as `xsd:double`: one row of the amount datatype violation query. A money amount with no currency: one row of a second violation query | `CLAUDE.md` ("Money is whole cents read from the digits"); `Item.read.ts` (`UnitCost`, a decimal string); report 02 (beep-effect's projection maps every number to `xsd:integer`) | must |
| CQ-V02 | What is the stock value per currency, never summed across currencies? | `MoneyAmount`, `Currency`, `QuantityValue` (07) | enumerative | Variant fixture: two items priced in USD and EUR: the expected answer is two rows; one summed row fails | `CLAUDE.md` ("Counts mean what they sit on": money per currency); `docs/glossary.md` ("Currency") | must |
| CQ-V03 | Is every quantity and every measurement stated with its unit, and an item's three dimensions with one unit together? | `QuantityValue`, `UnitOfMeasure` (07), `length`, `width`, `height` (07) | constraint | Variant fixture: a quantity with no unit: one row; dimensions with length and width but no height: one row | `docs/glossary.md` ("Quantity with its unit"); `Item.read.ts` (`Uom`, `Dimensions`: "three measurements together") | must |
| CQ-V04 | Which quantities of an item counted in eaches are not whole numbers? | `QuantityValue`, `unit`, `UnitOfMeasure` (07), `hasDimension` and the `count` concept of `MeasurementDimensionScheme` (10) | constraint | Variant fixture: a "12.5 EA": one violation row; "12.5 KG": zero rows | `CLAUDE.md` ("a quantity of 21.5 is a number and still wrong for an item counted in Each"); product `DECISIONS.md` (quantity 12.5 cannot import) | must |
| CQ-V05 | Which unit conversions apply to an item (case to each), with which factor, since when? | `ItemUnitConversion`, `conversionFor`, `fromUnit`, `toUnit`, `conversionFactor`, `effectiveFrom`, `UnitOfMeasure` (07) | enumerative | Variant fixture: a conversion with its factor inverted (1/12): the factor's direction check fails; a conversion with no start date must not apply to older stock | `docs/glossary.md` ("Conversion factor"); the architecture seed 7.3; Sutton public: units editable on existing items, October 15 2026 release (via the architecture seed 2.4) | could |

### 3.4 Warehouse and stock

| Id | Question | Terms it needs | Kind | Must-fail case | Source | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| CQ-W01 | Which locations does a site hold, at any depth (warehouse, aisle, bin)? | `Site`, `Warehouse`, `Bin`, `Location`, `hasParentLocation` (08) | reachability | Variant fixture: a bin two levels down must appear; a bin of another site must not | The architecture seed 5.2; Sutton public: bin tracking and binless sites (via the architecture seed 5.2) | should |
| CQ-W02 | Is any location its own ancestor? | `Location`, `hasParentLocation` | constraint | Variant fixture: a bin whose parent chain returns to it: one row | The architecture seed's location shape | should |
| CQ-W03 † | For one item at one site, what are its in-stock, available, committed and reserved quantities, each as its own measure, with no position counted twice? | `StockPosition`, `InventoryMeasure`, `measureKind`, `forItem`, `forLot`, `forLabel`, `forSerialUnit`, `inLogisticUnit`, `atLocation`, `asOf`, `hasMeasure`, `positionBasis`, `reportedIn` (08), `PositionBasisScheme`, `InventoryMeasureKindScheme` (10), `QuantityValue`, `hasQuantity` (07) | enumerative | Variant fixtures: neither a subtotal, a narrowed position nor a reported position beside a book one may inflate on hand. A later report cannot hide book stock; a later on-hand-only position cannot hide reserved. Available is read at the site, not summed from bins | Profile ("measures overlap and are not one enum"); report 01 section 5; Sutton public: six stock measures (Inventory key features, via both seeds); `docs/glossary.md` ("committed subtracted twice") | should (pending Q6, Q9) |
| CQ-W04 | Does any measure carry two kinds, or any position carry two current measures of one kind? | `StockPosition`, `InventoryMeasure`, `hasMeasure`, `asOf`, `measureKind` (08), `InventoryMeasureKindScheme` (10) | constraint | Vocabulary variant, gate 9: measure kinds as disjoint subclasses of one state (the API design report's `hasInventoryState`): a position cannot state both Committed and Available, and the W03 fixture fails to load | Report 01 section 5 (the API design report's one state per balance rejected) | should |
| CQ-W05 | How much of a lot is at a location, which labels cover it, and which label was split from which? | `MaterialLot`, `InventoryLabel`, `portionOfLot`, `StockPosition`, `forLabel`, `LabelSplit`, `splitSource`, `splitResult` (08) | reachability | Variant fixture: a label covering two pallets of one lot must not be read as one unit serial; a split label must reach its first label | The architecture seed 5.2 (lot, label and serial kept apart); Sutton public: a label may identify a batch, pallet, part or unit, and labels split (via the architecture seed 5.2); label history, November 10 2026 release | should |
| CQ-W06 | Which stock is quarantined or on quality hold, and is any of it counted as available? | `qualityDisposition`, `QualityDispositionScheme`, `StockConditionScheme` (10), `QualityHold` (08), `InventoryMeasure` (08) | constraint | Variant fixture: a quarantined lot inside an Available measure: one violation row | `docs/glossary.md` ("Quarantine: counted as available"); Sutton public: receiving rejection and quarantine (via the architecture seed 5.5) | should (pending Q6) |
| CQ-W07 † | What did a pallet hold, lot by lot, at the moment a shipment left? | `LogisticUnit`, `forLot` (08), `AggregationEvent`, `DisaggregationEvent`, `packedInto`, `unpackedFrom`, `packs`, `unpacks`, `EventLine`, `Shipment`, `observes`, `involvesLogisticUnit`, `eventTime` (09), `hasQuantity` (07) | reachability | Variant fixture: a lot unpacked before the shipment must not appear; a lot packed after it must not appear; reading today's contents instead of replaying events fails | The architecture seed 7.1 (replay association events at the shipment time) | could (pending Q7) |

### 3.5 Commitments

| Id | Question | Terms it needs | Kind | Must-fail case | Source | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| CQ-K01 | Which sales order lines are not yet fully shipped and by how much, and which shipments served more than one order? | `SalesOrder`, `SalesOrderLine`, `lineOf`, `Shipment`, `observes`, `EventLine`, `LineAllocation`, `allocatesLine`, `allocatedTo` (09), `hasQuantity`, `QuantityValue` (07) | enumerative | Variant fixture: one shipment line split across two orders recorded as one order link: the second order shows unshipped and fails | The architecture seed 5.6 (line allocations); Sutton public: single- and multi-order shipping (via the architecture seed 5.6) | could |
| CQ-K02 | Which purchase order lines were received in part, and how much of each receipt was accepted or rejected? | `PurchaseOrderLine`, `Receipt`, `ReceivingRejection`, `rejectsPartOf`, `observes`, `EventLine`, `LineAllocation` (09) | enumerative | Variant fixture: a receipt whose rejected part is folded into its received quantity fails the accepted total | Sutton public: partial receiving, rejection (via the architecture seed 5.5); the API design report section 4.1 | could |
| CQ-K03 | Is any ordered but unreceived quantity counted as stock on hand? | `PurchaseOrderLine` (09), `StockPosition`, `InventoryMeasure`, `positionBasis`, `workedOutFrom` (08) | constraint | Variant fixture: a in-stock measure whose only support is an open purchase order line: one violation row | `docs/glossary.md` ("Purchase order: an order counted as stock"; "Incoming added into on hand") | could |
| CQ-K04 | Which reservations hold stock for which order lines, and was any reservation read as consumption? | `InventoryReservation`, `reservesFor`, `drawsOnReservation` (08), `SalesOrderLine`, `ManufacturingOrder`, `TransformationEvent`, `consumes` (09) | constraint | Variant fixture: a manufacturing order with a reservation and no execution input: any consumption it shows is one violation row | The architecture seed 1 ("a planned reservation versus actual consumption") and 5.4 (no consumption inferred from a scheduled work order) | could |

### 3.6 Execution and traceability

| Id | Question | Terms it needs | Kind | Must-fail case | Source | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| CQ-E01 † | Given a questioned input lot, which lots may contain it, through any number of transformations, and which shipments to which customers carried them, loose or on a pallet? | `MaterialLot`, `forLot` (08), `TransformationEvent`, `EventLine`, `consumes`, `produces`, `AggregationEvent`, `DisaggregationEvent`, `packs`, `packedInto`, `unpacks`, `unpackedFrom`, `eventTime`, `Shipment`, `observes`, `involvesLogisticUnit`, `SalesOrder`, `SalesOrderLine`, `LineAllocation`, `allocatesLine`, `allocatedTo`, `lineOf`, `counterparty` (09), `LogisticUnit` (08), `hasQuantity`, `numericValue`, `unit` (07), `Organization`, `inTenant` (06) | reachability | Variant fixture: a lot only packed alongside the questioned lot and another tenant's lot are not derived. Remove the transformation output: the second-tier lot is missing. Of 30 kg packed, unpack 10: LotD still lists Shipment1 and Customer1; unpack all 30: LotD remains with neither. Remove Shipment2's allocation: LotG keeps Shipment2 with no customer | The architecture seed 7.1 (forward recall, possible contribution); the API design report 4.2; Sutton public: traceability feature page (via the architecture seed 5.7) | should (pending Q7, Q9) |
| CQ-E02 † | Given a finished lot, which input lots and which vendors' receipts may have contributed to it? | `MaterialLot`, `forLot` (08), `TransformationEvent`, `EventLine`, `consumes`, `produces`, `Receipt`, `observes`, `LineAllocation`, `counterparty` (09), `Organization` (06) | reachability | Variant fixture: an output lot of the same transformation (a sibling) must not be listed as an input; with the input allocation removed, the vendor is missing | The architecture seed 7.1 (backward trace) | should (pending Q7, Q9) |
| CQ-E03 | Does any lot derive from itself, and does any transformation lack inputs or outputs? | `TransformationEvent`, `consumes`, `produces`, `EventLine` (09) | constraint | Variant fixture: a lot on both sides of one transformation: one row; a transformation with outputs only: one row | The architecture seed's `traceability.py` (refuses a self-cycle and a one-sided transformation) | should |
| CQ-E04 | Which quality inspections passed for a lot, and was any held stock released without a release decision? | `QualityInspection`, `inspectionOutcome`, `QualityOutcomeScheme`, `HoldRelease`, `releasesHold` (09), `QualityHold`, `heldAfterInspection` (08), `QualityDispositionScheme`, `StockConditionScheme` (10) | constraint | Variant fixture: a passing inspection with no release, read as releasing the hold: one violation row | The architecture seed 5.7 ("an inspection passing does not release stock"); Sutton public: quality checks on manufacturing orders (via the architecture seed 5.7) | could |
| CQ-E05 | Do two effective state intervals of one machine overlap? | `MachineStateInterval`, `machineState` (09), `MachineStateScheme` (10) | constraint | Variant fixture: two overlapping intervals: one row | The architecture seed's machine interval shape | will-not: telemetry is a vendor capability claim with no public schema and no repository record (the architecture seed 5.4) |
| CQ-E06 | Does each receiving, shipping and transformation record carry the FSMA key data elements? | `FsmaTraceabilityRecord` (the architecture seed) | constraint | Variant fixture: a receiving record with no traceability lot code: one row | The architecture seed 8.3, 8.4 | will-not: regulatory, and the architecture seed itself says a validation result is not compliance |

### 3.7 Identity and provenance

| Id | Question | Terms it needs | Kind | Must-fail case | Source | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| CQ-I01 | Which stored item came from which row of which file, in which import, confirmed by whom and when? | `ItemSpecification` (07), `recordedFromRow` (here), `ItemImport`, `StagedFile`, `FileRow`, `rowOf`, `importsFile`, `ImportConfirmation`, `partOfImport`, `performedBy`, `eventTime` (09), `Member` (06) | enumerative | Variant fixture: an item whose row is in another import's file must not be attributed to this one; with the confirmation's `performedBy` removed, the confirmer is missing | The `item` table (`importId`, `batchId`, `sourceRow`, `sourcePart`, `createdById`) in `0001_init.sql`; `docs/glossary.md` ("Audit trail") | must |
| CQ-I02 † | Do the outcomes of one confirmation's rows add up to the rows in its file, each row counted once? | `ImportConfirmation`, `RowOutcome`, `FileRow`, `partOfImport`, `importsFile`, `rowOf`, `outcomeFor`, `recordedBy`, `outcomeKind` (09), `ImportResultOutcomeScheme` (10) | constraint | Compare FileRow identities including part in both directions, not just counts. Remove one result: its row is missing. Add a second distinct result on one row: one duplicate. Move one of Confirm1's 200 results to Import2's file: the count query reads 200 against 199; the two membership queries each name one row, foreign and missing respectively | `CLAUDE.md` ("The outcomes, and they add up"); `docs/standards/after-confirm.md`; product `DECISIONS.md` (200 rows: 155 imported, 45 not imported) | must (pending Q11) |
| CQ-I03 † | When the same file is imported again, does the second confirmation create any item, and which rows does it count as already there, by their normalised match key? | `RowOutcome`, `ImportConfirmation`, `ImportTakeBack`, `takesBack`, `removesItem`, `keepsItem`, `eventTime`, `outcomeKind` (09), `resultItem` (here), `ItemSpecification`, `ItemIdentifier`, `identifiedBy`, `identifierKey`, `identifierKind` (07) | constraint | Variant fixture: a second confirmation that created an item whose key the first already stored: one violation row; the same key in the second test organization: zero rows | `CLAUDE.md` ("A second import of the same file adds nothing"; "Keys are normalised before comparing"); product `DECISIONS.md` (clean file: 25 already there; messy: 155 already there); `UNIQUE (organizationId, skuKey)` in `0001_init.sql` | must (pending Q3) |
| CQ-I04 | Which values did an import write that differ from the file, by which method (rule, accepted proposal, typed), and who decided each? | `ValueChange`, `changedField`, `fileValue`, `writtenValue`, `changeIn`, `changeHow`, `decidedIn`, `RowDecision`, `decidesRow`, `performedBy` (09), `ValueChangeMethodScheme` (10), `Member` (06) | enumerative | Variant fixture: a typed value with no deciding member must fail; a value written equal to the file must not be listed | `packages/catalog/contract/src/Import/Change.read.ts`; `Import.read.ts` (`ChangeRecord`); `CLAUDE.md` ("Never change a value silently") | must |
| CQ-I05 | Does every row left out of an import carry a reason that names the column and the value? | `RowOutcome`, `outcomeKind` (09), `leftOutReason` (here), `ImportResultOutcomeScheme` (10) | constraint | Variant fixture: a not-imported row with an empty reason: one violation row; companion: left-out rows exist | `CLAUDE.md` ("Every row that is left out has a reason"; "No empty reason cells") | must |
| CQ-I06 | Which proposals came from a model and which from rules, and was any applied without a member's accept? | `ValueProposal`, `proposedBy`, `proposedField`, `ValueChange`, `decidedIn`, `RowDecision`, `GroupDecision`, `acceptsProposal` (09), `ValueChangeSourceScheme` (10) | constraint | Variant fixture: a value change by an accepted proposal with no accepting decision: one violation row | `packages/catalog/contract/src/Suggestion/Suggestion.read.ts`; `Answer/AnsweredBy.read.ts`; `CLAUDE.md` ("A model proposes; it never writes") | must |
| CQ-I07 | Which items did a take-back remove, and which did it keep and name because they had changed since? | `ImportTakeBack`, `takesBack`, `removesItem`, `keepsItem` (09), `ItemSpecification` (07) | enumerative | Variant fixture: a changed item (revision above 1) listed as removed fails | `CLAUDE.md` ("A confirmed import can be taken back"); `takeBack` in `packages/catalog/host/src/ImportStore.adapter.ts`; `Item.read.ts` (`revision`) | should |
| CQ-I08 | Does any class take its identity from a SKU or a name? | the identity criteria of the vocabulary module (05's `IdentityCriterion`, its `restsOn`), never a triple: under the proposal for open decision 19 they stay out of the Turtle, so no SPARQL could read them | constraint, answered by gate 4 over the module, not by SPARQL | Vocabulary variant, gate 4: `ItemSpecification`'s criterion written as resting on `identifierKey`, or `Organization`'s on `name`: gate 4 fails it (05's V18); the data half (two items with key "SHH-9574" in two organizations read as one) is CQ-I03's second organization | Profile ("identity never from SKU or name"); report 01 sections 1, 3; the architecture seed 4.2 | must (pending Q3) |
| CQ-I09 | When one file holds the same SKU on two rows, are they still two rows with their own results, neither merged nor dropped without a decision? | `FileRow`, `RowOutcome`, `outcomeFor`, `RowDecision` (09) | constraint | Variant fixture: a pair of rows with one SKU and one result between them: one violation row | `CLAUDE.md` ("two rows that look alike are still two records"); product `DECISIONS.md` (six pairs, "keep one, or type a SKU") | must |
| CQ-I10 | Which facts came from which Sutton source record (system, record type, opaque id, captured when), and which were inferred here? | `SourceRecord`, `recordOf`, `sourceSystem`, `sourceType`, `sourceId`, `capturedAt` (here) | enumerative | Variant fixture: an inferred lineage edge presented with a source record must fail; a source id with its leading zeros lost must fail the identity check | The architecture seed 4.2 (tenant, source type, opaque id), 10.1 (evidence and derived facts) | could |

Fifty questions: 10 party and access, 8 catalog, 5 values and units, 7 warehouse and stock, 4 commitments, 6
execution and traceability, 10 identity and provenance. By priority: 22 must, 16 should, 10 could, 2 will-not.

### 3.8 Closure assumptions

A question that reads an absence as false needs a declared closure (foundational law 5). These are the ones, each
for 12 to carry as a contract and for Benjamin to confirm:

| Question | What it reads as complete | Needed contract |
| --- | --- | --- |
| CQ-P02 | All trading flags in the same tenant/account context | Slice 1 reads missing as unknown. Requiring explicit true or false in a stored record is pending decision 35 and slice 2's SHACL |
| CQ-P07 | The members of a tenant and their roles | The member list of one tenant is complete in the snapshot |
| CQ-I02, CQ-I05, CQ-I09 | All file row identities (RowId including part) and outcomes for the confirmation tested | Historical fixtures retain every outcome by confirmation. Today's `importOutcome` holds the latest result per row/part; a batch write does not preserve superseded results |
| CQ-I03, CQ-I07 | The take-backs of a confirmation | Every take-back records its time, the confirmation it reverses and each item it removed or kept |
| CQ-W03, CQ-W06 | The measures in the requested observation series | Compare instants only within one tenant, item, scope, kind, basis and authority. For reports, group by the declared reporting authority, not the id of an individual report. Keep competing sources separate; ties need evidence, not a preferred source (pending Q6) |
| CQ-E01, CQ-E02, CQ-W07 | The events of a lot or a pallet | Every packing, unpacking and transformation in the window is present; an answer is "possible contribution" (pending Q7) |

## 4. Drafted queries for the ten hardest

Each query is drafted, not run, and a sketch, not code. Keys from other documents are guesses. Every fixture is a
named `test_` graph that would sit under `explorations/erp-ontology/assets/`; none is written yet. A constraint
query passes with zero rows only beside its companion query, which shows the fixture holds the rule's antecedent.
CQ-P06 is written in the thin thread; slice 1 writes CQ-P02, P03 and P07. None of those four queries is drafted here. Literal `example.org` prefixes illustrate
today's binding. Executable queries and fixtures take the local binding from the module.

### CQ-P01: an organization that is both customer and vendor

Fixture: `test_ExampleWorks` holds a `SourceRecord` of `test_CoPacker` with both flags true and one of
`test_FlourMill` with only vendor true. `test_SecondOrg` holds a record of `test_OtherCoPacker` with both true.
Each tenant also holds a record of the same `test_SharedCo`: only customer is true on the first record and only
vendor on the second. Neither qualifies. Expect only `test_CoPacker` here; substituting the module base keeps that
local name. Remove `isCustomer` from its record: the expected row is missing. Reading one flag from each tenant's
record would wrongly return `test_SharedCo` (decision 34).

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-P01. Drafted, not run; sketch, not code.
SELECT DISTINCT ?org WHERE {
  VALUES ?tenant { inv:test_ExampleWorks }
  ?record a inv:SourceRecord ; inv:inTenant ?tenant ; inv:recordOf ?org ; inv:isCustomer true ; inv:isVendor true .
  ?org a inv:Organization .
}
```

### CQ-P04: two parties decided to be one party

Fixture: `test_AcmeA` to `test_AcmeF` are `SourceRecord`s held by `test_ExampleWorks`, not organizations. At
`2026-11-01T09:00:00Z`, `test_Decision1` says A and B record the same party, by `test_Dana`, with evidence "same tax id".
C and D share a name and have no decision. On the same day `test_Decision2` at 10:00 UTC joins E and F;
`test_Decision3` at 11:00 UTC reverses it. In `test_SecondOrg`, `test_Kim` makes `test_Decision4` at noon UTC
(same party) and `test_Decision5` at 13:00 UTC (different parties) about that tenant's own two records of the parties.
Expected: (`test_AcmeA`, `test_AcmeB`, `test_Dana`, `2026-11-01T09:00:00Z`, "same tax id"). The second tenant's
decisions neither add a row nor suppress this one; asking for the second tenant gives no row. Add `owl:sameAs`
between A and B and remove `test_Decision1`: no row here, and the ASK below answers true.

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
# CQ-P04. Drafted, not run; sketch, not code. The latest decision of this tenant about a pair is the one in force.
SELECT ?a ?b ?decider ?at ?evidence WHERE {
  VALUES ?tenant { inv:test_ExampleWorks }
  ?decision a inv:IdentityDecision ; inv:inTenant ?tenant ;
            inv:decidesOn ?a , ?b ;
            inv:identityOutcome ?outcome ;
            inv:decidedBy ?decider ;
            inv:eventTime ?at .
  ?a a inv:SourceRecord ; inv:inTenant ?tenant .
  ?b a inv:SourceRecord ; inv:inTenant ?tenant .
  ?outcome skos:inScheme inv:IdentityOutcomeScheme ; skos:notation "sameParty" .
  FILTER (STR(?a) < STR(?b))
  OPTIONAL { ?decision inv:citesEvidence/inv:evidenceText ?evidence }
  FILTER NOT EXISTS {
    ?later a inv:IdentityDecision ; inv:inTenant ?tenant ;
           inv:decidesOn ?a , ?b ;
           inv:eventTime ?laterAt .
    FILTER (?laterAt > ?at)
  }
}
```

```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
# CQ-P05 companion of CQ-P04: no identity is stated by owl:sameAs. Expected: false.
ASK { ?x owl:sameAs ?y . FILTER (?x != ?y) }
```

### CQ-P08: who may see a site's stock

Fixture: `test_ExampleWorks` with `test_SiteNorth` (warehouse `test_WhN1`, bin `test_BinN1` under it) and
`test_SiteSouth`. Members: `test_Dana`, grant at the organization; `test_Ravi`, grant at `test_SiteNorth`;
`test_Lee`, grant at `test_BinN1`; `test_Sam`, grant at `test_SiteSouth`; `test_Pat`, removed, grant at the
organization; `test_Kim`, member of `test_SecondOrg` with a grant there; `test_Jo`, a grant of location scope that
names no location. Evaluate at noon UTC on 2026-11-01. Every grant starts at 09:00 UTC that day except `test_Ada`'s,
which starts at 13:00. `test_Noor`'s ends at 11:00. Both are non-removed members with only that grant at North.
Expected: `test_Dana`, `test_Ravi`. Vocabulary variant, gate 4: organization-only scope cannot state Ravi's grant.
Mutant queries: walking down admits `test_Lee`; making the location optional admits `test_Jo`; ignoring the grant's
period admits `test_Noor` and `test_Ada`.

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
# CQ-P08. Drafted, not run; sketch, not code. A grant covers its location and everything beneath it (pending Q8).
# The scope kind is stated on the grant (06's grantScope); a location grant names its place with 08's atLocation.
SELECT DISTINCT ?member WHERE {
  VALUES (?site ?now) { (inv:test_SiteNorth "2026-11-01T12:00:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>) }
  ?site inv:inTenant ?org .
  ?member a inv:Member ;
          inv:membershipIn ?org .
  FILTER NOT EXISTS { ?member inv:removedAt ?gone }
  ?grant a inv:Grant ;
         inv:grantedTo ?member ;
         inv:grantScope ?scopeKind ; inv:startedAt ?start .
  FILTER (?start <= ?now)
  FILTER NOT EXISTS { ?grant inv:endedAt ?end . FILTER (?end <= ?now) }
  { ?scopeKind skos:notation "organization" }
  UNION
  { ?scopeKind skos:notation "location" .
    ?grant inv:atLocation ?scope .
    ?site inv:hasParentLocation* ?scope . }
}
```

### CQ-C08: a resolved BOM expansion is acyclic

Fixture: `test_Expansion1` with nodes A, B, C where A requires B, B requires C, C requires A; `test_Expansion2`
and `test_Expansion3`, two historical alternatives where X requires Y in one and Y requires X in the other.
Expected: A, B and C as "reaches itself"; nothing from the alternatives. Must fail: the query run over a union of
all historical BOM lines as one expansion reports X and Y (the false cycle the architecture seed warns of).

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-C08. Drafted, not run; sketch, not code. Violation query: zero rows passes.
SELECT ?node ?problem WHERE {
  {
    ?node a inv:BomExpansionNode ;
          inv:requiresComponent+ ?node .
    BIND ("reaches itself" AS ?problem)
  }
  UNION
  {
    ?node inv:nodeOf ?expansion ;
          inv:requiresComponent ?other .
    ?other inv:nodeOf ?otherExpansion .
    FILTER (?expansion != ?otherExpansion)
    BIND ("crosses expansions" AS ?problem)
  }
}
```

### CQ-W03: available against committed against reserved, without double counting

Fixture: the book of `test_ExampleWorks` has one series for `test_ItemFlour`, in kg. `test_BinN1` and `test_BinN2`
are the declared disjoint partition of `test_SiteNorth`. At 09:00 they hold 130 and 100 on hand, with 20 reserved
each. At 10:00 a book position at N1 states only on hand, 150. Read committed (60, including 30 reserved) and
available (250 − 0 − (60 + 40 − 30) = 180) at the site only. Expected: `onHand` 250 kg, `reserved` 40 kg,
`committed` 60 kg, `available` 180 kg. All these positions have basis book. Decision 74(a)'s quantity path is used.

Variant fixtures, separately: a warehouse subtotal of 250; a simultaneous count of 150 at N1; book positions narrowed
by lot, label, serial or pallet at either bin, including newer ones. None changes any row. A 10:00 reported 150 at
N1 (`reportedIn` `test_Confirm1`) makes a query without basis selection read 400 on hand. A later report at N2 from
another authority must not hide its book 100. Bin-level available of 130 and 80 must not replace the site's 180
with 210. Remove the committed kind: its row is missing. For a reported answer name the authority first and compare
only reports attributed to it; report ids alone do not identify that series. This book fixture has one observation
per instant, scope and kind. If that check fails, report the tie rather than summing or choosing one.

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
# CQ-W03. Each kind uses the latest item-level position of one basis at each location that states that kind.
SELECT ?kind ?unit (SUM(?value) AS ?quantity) WHERE {
  VALUES (?tenant ?item ?site ?basisCode) { (inv:test_ExampleWorks inv:test_ItemFlour inv:test_SiteNorth "book") }
  VALUES ?location { inv:test_BinN1 inv:test_BinN2 inv:test_SiteNorth }
  ?basis skos:inScheme inv:PositionBasisScheme ; skos:notation ?basisCode .
  ?position a inv:StockPosition ; inv:inTenant ?tenant ; inv:positionBasis ?basis ;
            inv:forItem ?item ; inv:atLocation ?location ; inv:asOf ?at ; inv:hasMeasure ?measure .
  ?measure inv:measureKind ?kindConcept .
  FILTER NOT EXISTS { ?position (inv:forLot|inv:forLabel|inv:forSerialUnit|inv:inLogisticUnit) ?detail }
  FILTER NOT EXISTS {
    ?newer a inv:StockPosition ; inv:inTenant ?tenant ; inv:positionBasis ?basis ;
           inv:forItem ?item ; inv:atLocation ?location ; inv:asOf ?later ; inv:hasMeasure/inv:measureKind ?kindConcept .
    FILTER NOT EXISTS { ?newer (inv:forLot|inv:forLabel|inv:forSerialUnit|inv:inLogisticUnit) ?otherDetail }
    FILTER (?later > ?at)
  }
  ?measure inv:hasQuantity ?q .
  ?q inv:numericValue ?value ;
     inv:unit ?unit .
  ?kindConcept skos:notation ?kind .
  FILTER ((?location != ?site && ?kind IN ("onHand", "quarantined", "reserved", "inTransit"))
       || (?location = ?site && ?kind IN ("committed", "available")))
}
GROUP BY ?kind ?unit
```

### CQ-W07: a pallet's contents at the moment it shipped

Fixture: pallet `test_Pallet7`; at 09:00 lots `test_LotC` (40 kg) and `test_LotD` (30 kg) packed; at 10:00 10 kg
of `test_LotD` unpacked; `test_Shipment1` leaves at 11:00 with the pallet; at 12:00 `test_LotE` packed. Expected:
`test_LotC` 40 kg, `test_LotD` 20 kg. Must fail: the pallet's contents read at 12:00 (`test_LotE` appears); the
unpacking event's type removed (`test_LotD` reads 30); a variant shipment with two event lines that name the pallet
must still read 40 and 20, and a query that joins each line to the events reads 80 and 40.

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-W07. Drafted, not run; sketch, not code. Replays packing and unpacking up to the shipment time.
SELECT ?lot ?unit (SUM(?signed) AS ?quantity) WHERE {
  {
    SELECT DISTINCT ?shippedAt ?pallet WHERE {
      VALUES ?shipment { inv:test_Shipment1 }
      ?shipment inv:eventTime ?shippedAt ;
                inv:observes ?line .
      ?line inv:involvesLogisticUnit ?pallet .
    }
  }
  {
    ?event a inv:AggregationEvent ; inv:packedInto ?pallet ; inv:packs ?moved .
    BIND (1 AS ?sign)
  }
  UNION
  {
    ?event a inv:DisaggregationEvent ; inv:unpackedFrom ?pallet ; inv:unpacks ?moved .
    BIND (-1 AS ?sign)
  }
  ?event inv:eventTime ?t .
  FILTER (?t <= ?shippedAt)
  ?moved inv:forLot ?lot ;
         inv:hasQuantity ?q .
  ?q inv:numericValue ?v ;
     inv:unit ?unit .
  BIND (?sign * ?v AS ?signed)
}
GROUP BY ?lot ?unit
HAVING (SUM(?signed) > 0)
```

### CQ-E01: forward genealogy across transformation and aggregation

Fixture: transformation `test_T1` consumes `test_LotA` and `test_LotB` and outputs `test_LotC` and `test_LotD`;
transformation `test_T2` consumes `test_LotC` and outputs `test_LotG`; 30 kg of `test_LotD` is packed on `test_Pallet7`,
which ships in `test_Shipment1` to `test_Customer1`; `test_LotG` ships loose in `test_Shipment2` to
`test_Customer2`; `test_LotH` is packed on the same pallet but comes from no transformation of `test_LotA`; a lot of
`test_SecondOrg` consumes a lot whose code equals `test_LotA`'s. Expected: `test_LotA` itself, `test_LotC`,
`test_LotD`, `test_LotG`, with `test_Shipment1` and `test_Customer1` for `test_LotD` and `test_Shipment2` and
`test_Customer2` for `test_LotG`; never `test_LotH`. Every answer is a possible contribution (pending Q7). A shipment
names no ship-to of its own in 09: its customer is the counterparty of the order line its event line is allocated to.
`test_SalesOrder1` and `test_SalesOrder2` each have one line and counterparties `test_Customer1` and `test_Customer2`
respectively. Each shipment's event line has an allocation to its corresponding order line. Remove `test_T2`'s
`produces` line: `test_LotG` is missing. Remove Shipment2's allocation instead: LotG keeps Shipment2, with no
customer. Variant fixtures: unpack 10 kg before Shipment1 and LotD keeps Shipment1 and Customer1; unpack all 30 kg
and LotD is still reached, with neither shipment nor customer.

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-E01. Drafted, not run; sketch, not code. Lot to lot through transformations only; a pallet joins a lot to a
# shipment while CQ-W07's replay leaves a positive quantity of the lot on the pallet at shipment time.
SELECT DISTINCT ?lot ?shipment ?customer WHERE {
  VALUES ?questioned { inv:test_LotA }
  ?questioned inv:inTenant ?org ;
              (^inv:forLot/^inv:consumes/inv:produces/inv:forLot)* ?lot .
  ?lot inv:inTenant ?org .
  OPTIONAL {
    {
      ?shipment a inv:Shipment ;
                inv:observes ?line .
      ?line inv:forLot ?lot .
    }
    UNION
    {
      {
        SELECT ?shipment ?pallet ?lot ?unit WHERE {
          { SELECT DISTINCT ?shipment ?pallet ?shippedAt WHERE {
              ?shipment a inv:Shipment ; inv:eventTime ?shippedAt ; inv:observes/inv:involvesLogisticUnit ?pallet .
          } }
          { ?event a inv:AggregationEvent ; inv:packedInto ?pallet ; inv:packs ?moved . BIND (1 AS ?sign) }
          UNION
          { ?event a inv:DisaggregationEvent ; inv:unpackedFrom ?pallet ; inv:unpacks ?moved . BIND (-1 AS ?sign) }
          ?event inv:eventTime ?at . FILTER (?at <= ?shippedAt)
          ?moved inv:forLot ?lot ; inv:hasQuantity ?quantity .
          ?quantity inv:numericValue ?value ; inv:unit ?unit .
        } GROUP BY ?shipment ?pallet ?lot ?unit HAVING (SUM(?sign * ?value) > 0)
      }
      ?shipment inv:observes ?line . ?line inv:involvesLogisticUnit ?pallet .
    }
    OPTIONAL {
      ?allocation inv:allocatedTo ?line ; inv:allocatesLine/inv:lineOf/inv:counterparty ?customer .
    }
  }
}
```

### CQ-E02: backward genealogy to inputs and vendors

Fixture: the CQ-E01 fixture, plus receipt `test_Receipt1` of `test_LotA` from `test_FlourMill` and receipt
`test_Receipt2` of `test_LotB` from `test_SugarCo`. Expected for `test_LotG`: `test_LotC` (no receipt),
`test_LotA` with `test_Receipt1` and `test_FlourMill`, `test_LotB` with `test_Receipt2` and `test_SugarCo`; never
`test_LotD`, the sibling output. The vendor is read through the receipt line's allocation to a purchase order line
and that order's counterparty (09). Must fail: with `test_T1`'s `consumes` line for `test_LotB` removed,
`test_SugarCo` is missing.

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-E02. Drafted, not run; sketch, not code. One or more steps back through transformations.
SELECT DISTINCT ?inputLot ?receipt ?vendor WHERE {
  VALUES ?finished { inv:test_LotG }
  ?finished inv:inTenant ?org ;
            (^inv:forLot/^inv:produces/inv:consumes/inv:forLot)+ ?inputLot .
  ?inputLot inv:inTenant ?org .
  OPTIONAL {
    ?receipt a inv:Receipt ;
             inv:observes ?receiptLine .
    ?receiptLine inv:forLot ?inputLot .
    OPTIONAL {
      ?allocation inv:allocatedTo ?receiptLine ;
                  inv:allocatesLine/inv:lineOf/inv:counterparty ?vendor .
    }
  }
}
```

### CQ-I02: outcomes add up to the rows in the file

Fixture: `test_Import1` of the messy sample's 200 rows, confirmed by `test_Confirm1` with 155 created and 45 not
imported results; `test_Import2` of the clean sample's 25 rows, one row given no result; `test_Import3`, one row
given two results. Expected: zero rows for `test_Confirm1`; one row for `test_Import2`'s confirmation from the first
query, and one row for `test_Import3`'s from the second, which finds the doubled row. Companion: every confirmation
in the fixture has rows. Row identity includes part on both sides. These are complete per-confirmation fixtures,
not a reconstruction of an overwritten batch from today's latest outcomes. Remove one created result: 200 against
199. Move it to a row of `test_Import2`'s file instead: still 200 results, only 199 for this file. The first query
reports 200 against 199; the third returns the foreign row and the fourth the missing row.

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-I02. Count distinct file members, not all rows named by results.
SELECT ?confirmation ?rows ?results WHERE {
  {
    SELECT ?confirmation (COUNT(DISTINCT ?row) AS ?rows) WHERE {
      ?confirmation a inv:ImportConfirmation ;
                    inv:partOfImport ?import .
      ?import inv:importsFile ?file .
      ?row inv:rowOf ?file .
    }
    GROUP BY ?confirmation
  }
  OPTIONAL {
    SELECT ?confirmation (COUNT(DISTINCT ?row) AS ?results) WHERE {
      ?confirmation inv:partOfImport/inv:importsFile ?file .
      ?row inv:rowOf ?file .
      ?result inv:recordedBy ?confirmation ;
              inv:outcomeFor ?row ;
              inv:outcomeKind ?outcome .
    }
    GROUP BY ?confirmation
  }
  FILTER (!BOUND(?results) || ?rows != ?results)
}
```

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-I02, second block. Drafted, not run; sketch, not code. A row given two results by one confirmation.
SELECT DISTINCT ?confirmation ?row WHERE {
  ?first inv:recordedBy ?confirmation ;
         inv:outcomeFor ?row .
  ?second inv:recordedBy ?confirmation ;
          inv:outcomeFor ?row .
  FILTER (?first != ?second)
}
```

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-I02. A result outside the confirmation's file.
SELECT DISTINCT ?confirmation ?row WHERE {
  ?confirmation a inv:ImportConfirmation ; inv:partOfImport/inv:importsFile ?file .
  ?result inv:recordedBy ?confirmation ; inv:outcomeFor ?row .
  FILTER NOT EXISTS { ?row inv:rowOf ?file }
}
```

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
# CQ-I02. A file member with no outcome of this confirmation.
SELECT DISTINCT ?confirmation ?row WHERE {
  ?confirmation a inv:ImportConfirmation ; inv:partOfImport/inv:importsFile ?file .
  ?row inv:rowOf ?file .
  FILTER NOT EXISTS { ?result inv:recordedBy ?confirmation ; inv:outcomeFor ?row ; inv:outcomeKind ?kind }
}
```

### CQ-I03: a re-import adds nothing

Fixture: `test_Confirm1` creates three items whose SKU identifiers have the keys `SHH-9574`, `OAK-0012` and
`TIN-0400` (the key is `skuKey`'s: no spaces, upper case, the hyphen kept; decision 90); `test_Confirm2`, a later
import of the same file, gives the three rows "already there"; `test_Confirm3` in `test_SecondOrg` creates an item
with key `SHH-9574`; `test_Confirm4` in the first organization comes after a take-back of `test_Confirm1` and creates
`OAK-0012` again. Expected: zero rows. Companion: `test_Confirm2` has three "already" results. Must fail: a
`test_Confirm2` that compared the raw SKU "shh-9574 " (lower case, a trailing space) and created
`test_ItemDuplicate` with key `SHH-9574` gives one row. The fixtures retain their historical outcomes. On
2026-11-01 UTC Confirm1 is at 09:00, Confirm2 at 10:00, the take-back at 11:00 and Confirm4 at noon. The take-back
removes the `OAK-0012` and `SHH-9574` items and keeps the changed `TIN-0400` item. The later removal cannot hide
Confirm2's duplicate. If Confirm4 creates `TIN-0400` again it gives one violation; recreating `OAK-0012` gives none.

```sparql
PREFIX inv: <https://example.org/inventory-import/ontology/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
# CQ-I03. Drafted, not run; sketch, not code. Violation query: an item created under a key that an earlier
# confirmation of the same organization created, where no take-back had removed that item before this confirmation.
SELECT ?confirmation ?row ?item WHERE {
  ?confirmation a inv:ImportConfirmation ;
                inv:partOfImport ?import ;
                inv:eventTime ?confirmedAt .
  ?import inv:inTenant ?org .
  ?result inv:recordedBy ?confirmation ;
          inv:outcomeFor ?row ;
          inv:outcomeKind ?outcome ;
          inv:resultItem ?item .
  ?outcome skos:notation "created" .
  ?item inv:identifiedBy ?identifier .
  ?identifier inv:identifierKind ?kind ;
              inv:identifierKey ?key .
  ?kind skos:notation "sku" .
  ?earlierResult inv:recordedBy ?earlier ;
                 inv:outcomeKind ?earlierOutcome ;
                 inv:resultItem ?earlierItem .
  ?earlierOutcome skos:notation "created" .
  ?earlier inv:partOfImport ?earlierImport ;
           inv:eventTime ?earlierAt .
  ?earlierImport inv:inTenant ?org .
  ?earlierItem inv:identifiedBy ?earlierIdentifier .
  ?earlierIdentifier inv:identifierKind ?kind ;
                     inv:identifierKey ?key .
  FILTER (?earlierAt < ?confirmedAt && ?earlierItem != ?item)
  FILTER NOT EXISTS {
    ?takeBack inv:takesBack ?earlier ; inv:removesItem ?earlierItem ; inv:eventTime ?removedAt .
    FILTER (?removedAt < ?confirmedAt)
  }
}
```

## 5. Terms this document introduces

The identity and provenance questions need terms for the import itself. This report first claimed ten of them, and
said that where 05, 07 or 09 listed one, theirs would win and the row would become a pointer. 09 lists nine of them,
so they are 09's now (pending decision 52, whether the import's terms are ontology terms at all):

| Claimed here as | 09's key | Note |
| --- | --- | --- |
| `Import` | `ItemImport` | 09 names it for the item import only (its anti-pattern 9) |
| `SourceFile` | `StagedFile` | |
| `ImportRow` | `FileRow` | |
| `ImportConfirmation` | `ImportConfirmation` | the same key |
| `ImportTakeBack` | `ImportTakeBack` | the same key |
| `ImportRowResult` | `RowOutcome` | whether it is per confirmation or per import is decision 53 |
| `ReviewDecision` | `RowDecision` (and `GroupDecision`) | 09 places it under `gist:Event`, not `gist:Determination` |
| `Suggestion` | `ValueProposal` | |
| `ValueChange` | `ValueChange` | the same key |

One term stays here, because no other report defines it. Its gist parent is in `gist-categories.md`. Decision 34 places the reidentification key on the tenant's record, not the party. Slice 1 needs it for CQ-P01; the thin thread does not.

| Key | Label | Definition | Tag | gist parent | Identity | Source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SourceRecord | Source record | Content that an external system holds about one thing as captured at one time, named by the system, the record's type and its opaque id. | information | gist:Content | The tenant, the source system, the record's type and its opaque id, each kept as written (case, leading zeros, punctuation) | The architecture seed 4.2 and its `core:SourceRecord`; decision 34 (the reidentification key of the tenant's record) | slice 1 (party) |

Account `0007` and contact `0007` in one tenant and source system resolve to two source records. Neither `recordOf`
link may be obtained from the other record's id alone; the two records do not prove two distinct referents.

The match key a second import compares is 07's `ItemIdentifier` with its `identifierKey`, not a term of this
document: it reidentifies a stored record and is never the identity criterion of the item specification (profile;
CQ-I08). Its uniqueness per organization is a record rule, projected to SHACL, not an OWL key.

### Properties

One direction each; the reverse walk is a `^p` path. Eighteen properties first written here are 09's under
these keys: `ofSourceFile` is `importsFile`, `rowOf` is `rowOf`, `confirms` is `partOfImport`, `confirmedBy` and
`madeBy` are `performedBy`, `confirmedAt` is `eventTime`, `takesBack` is `takesBack`, `resultOfConfirmation` and
`writtenIn` are `recordedBy`, `resultOfRow` is `outcomeFor`, `decidesRow` is `decidesRow`, `acceptsSuggestion` is
`acceptsProposal`, `suggestsFor` is `proposesFor`, `suggestedBy` is `proposedBy`, `changeOfRow` is `changeIn`,
`changedField` and `fileValue` keep their keys, and `storedValue` is `writtenValue`. These stay here, because no other
report has them:

| Key | Label | Definition | Domain | Range | Source |
| --- | --- | --- | --- | --- | --- |
| resultItem | result item | The item record a row outcome created, updated or found already there. | RowOutcome (09) | ItemSpecification (07) | `Import.read.ts` (`RowCreated`, `RowUpdated`, `RowAlready`); 09's `writesItem` joins a confirm to an item, not a row to one |
| leftOutReason | left-out reason | The sentence, naming the column and the value, that says why a row was not imported. | RowOutcome (09) | datatype from the record field | `CLAUDE.md` ("Every row that is left out has a reason") |
| recordedFromRow | recorded from row | The file row whose confirmation first created an item record. | ItemSpecification (07) | FileRow (09) | the `item` table (`importId`, `sourceRow`, `sourcePart`) |
| recordOf | record of | The party, item or other thing a source record was captured about. | SourceRecord | none declared: any referent a tenant holds (kept broad) | The architecture seed 4.2; decision 34; CQ-P01 and CQ-I10 follow this link. Slice 1 admits `gist:isAbout` as its parent: `SourceRecord` falls under `gist:Content`. The projection copies no gist domain or range (decisions 13 and 16) |
| sourceSystem | source system | The external system a source record was read from. | SourceRecord | datatype from the record field | The architecture seed 4.2 |
| sourceType | source type | The record type the external system gives a source record. | SourceRecord | datatype from the record field | The architecture seed 4.2 |
| sourceId | source id | The opaque id the external system gives a source record, kept exactly as written. | SourceRecord | datatype from the record field | The architecture seed 4.2 |
| capturedAt | captured at | The instant a source record was read from its system. | SourceRecord | datatype from the record field | The architecture seed 10.1 |

## 6. Traceability

Which design document must answer each question. "Here" is this document's own terms. 12 appears wherever a query,
fixture, closure contract or violation query must exist for the question to be tested.

| Question | Must answer it | Also needed |
| --- | --- | --- |
| CQ-P01 | 06 party and access | here (`SourceRecord`, `recordOf`), 11 (gist:Organization, Sutton citation), 12 |
| CQ-P02 | 06 | 12 (closure contract) |
| CQ-P03 | 06 | 10 (contact purposes), 05 (identity of a person), 11 (Sutton Contact, `org:Membership`, FIBO Contact and schema.org `ContactPoint` alignment rows) |
| CQ-P04 | 06 | 10 (identity verdicts), 12 |
| CQ-P05 | 05 term model (identity criteria) | 11 (no `owl:sameAs` in alignments), 12 (`laws ontology-terms`) |
| CQ-P06 | 06 (thin thread) | 10 (member roles and organization scope), 12 (role lift and one person in two tenants) |
| CQ-P07 | 06 | 12 |
| CQ-P08 | 06 | 08 (location hierarchy), 12 |
| CQ-P09 | 06 | 05 (tenancy on every record term), 12 |
| CQ-P10 | 06 | here (decisions, confirmations) |
| CQ-C01 | 07 catalog and value | 11 (gist:CatalogItem) |
| CQ-C02 | 07 | 10 (item roles) |
| CQ-C03 | 07 | 08 (stock positions), 12 |
| CQ-C04 | 07 | 06 (vendor organizations), 09 (an offer as a commitment, if 09 claims it) |
| CQ-C05 | 07 | 12 |
| CQ-C06 | 07 | 10 (item lifecycle) |
| CQ-C07 | 07 | 08, 10 (tracking method) |
| CQ-C08 | 07 | 12 |
| CQ-V01 | 07 | 12 (decimal datatype from the record field) |
| CQ-V02 | 07 | 12 |
| CQ-V03 | 07 | 12 |
| CQ-V04 | 07 | 11 (gist:Aspect, QUDT alignment), 12 |
| CQ-V05 | 07 | 11 (QUDT alignment) |
| CQ-W01 | 08 warehouse and stock | 11 (no gist place class: profile) |
| CQ-W02 | 08 | 12 |
| CQ-W03 | 08 | 10 (measure kinds), 12 |
| CQ-W04 | 08 | 10, 12 |
| CQ-W05 | 08 | 10 (label lifecycle) |
| CQ-W06 | 08 | 09 (quality hold), 10 (dispositions) |
| CQ-W07 | 08 | 09 (aggregation events, shipments) |
| CQ-K01 | 09 commitment and event | 07 (quantities) |
| CQ-K02 | 09 | 07 |
| CQ-K03 | 09 | 08 |
| CQ-K04 | 09 | 08 (reservations) |
| CQ-E01 | 09 | 08 (lots, logistic units), 06 (customers), 12 |
| CQ-E02 | 09 | 06 (vendors), 12 |
| CQ-E03 | 09 | 12 |
| CQ-E04 | 09 | 10 (dispositions) |
| CQ-E05 | none: will-not | 09, 10 if it is ever reopened |
| CQ-E06 | none: will-not | none |
| CQ-I01 | 09 (import terms), here (provenance) | 07 (item specification), 06 (member) |
| CQ-I02 | 09 (import terms), here (provenance) | 10 (row outcomes), 12 |
| CQ-I03 | 09 (import terms), here (provenance) | 07 (item identifier and its key), 12 |
| CQ-I04 | 09 (import terms), here (provenance) | 10 (change methods), 06 |
| CQ-I05 | 09 (import terms), here (provenance) | 12 |
| CQ-I06 | 09 (import terms), here (provenance) | 10 (proposal sources) |
| CQ-I07 | 09 (import terms), here (provenance) | 07 |
| CQ-I08 | 05 term model | 07, 06, 12 |
| CQ-I09 | 09 (import terms), here (provenance) | 12 |
| CQ-I10 | here | 05 (record against referent), 11 (how a Sutton term is cited) |

## Questions for Benjamin

Decision 34 answers Q1. The remaining marks refer to the packet's [DECISIONS.md](../DECISIONS.md): Q2 is 35,
Q3 is 54, Q4 is 36, Q5 is 27, Q6 is 75, Q7 is 85, Q8 is 42, Q9 is 87, Q10 is 52, Q11 is 53. Each open decision
goes to Benjamin with a concrete record when its slice is specified. None blocks the thin thread.

## Not checked

- The vocabulary module, generated Turtle, fixture files and CQ suite are not built. The earlier twelve blocks were
  parsed by rdflib's `prepareQuery`. The revised sketches and new cases have not been parsed or run.
- Keys of other documents: those of 07, 08 and 10 were matched to their drafts as they stood partway through this
  run (`VendorItem`, `ItemIdentifier`, `BomExpansionNode`, `hasParentLocation`, `hasMeasure`, `asOf`,
  `resultOutcome`, `changeMethod`, the scheme names); 05 was read for its term list only. 06, 09, 11 and 12 did not
  exist yet, so every key marked (06) or (09) is a guess, and so is any later change to the others.
- 08 and 10 disagree on the inventory measure notations (`OnHand`, `OnHold`, `InTransit`, `Incoming` against
  `onHand`, `acquired`, `quarantined`); CQ-W03 uses 10's `onHand`, `available`, `committed` and `reserved`.
- No Sutton page was fetched. Every "Sutton public" fact is as the architecture seed or report 01 cites it, with the
  article it names; the API design report's own Sutton claims were read only where the architecture seed agrees.
- The architecture seed was read in sections 1 to 8, its class and property lists and its `traceability.py`; its
  shapes were read as names and messages only, and sections 9 to 13 were read as headings. The API design report was
  read in sections 1, 3, 4.1, 4.2, 5.1, 8.2 and 8.3.
- The Alchemy domain brief was read in its opening, "Every single thing", the read and contract tables and decisions 17
  to 19; its trial pages and `DECISIONS.md` were read as headings only.
- `docs/standards/after-confirm.md`, `docs/auth.md` and `Tenancy.slow.test.ts` are cited from `CLAUDE.md`'s
  description of them, not opened.
- `skuKey` was read in `Item.read.ts` (2026-11-22): it removes whitespace and upper-cases, and keeps punctuation, while
  `CLAUDE.md` says keys are normalised for "case, spaces, punctuation" (decision 90). `Review.rules.ts` calls it and
  was not read further.
- The skill's fixed outputs (`assets/requirements/scope.md`, `competency-questions.yaml`, `pre-glossary.csv`,
  `traceability-matrix.csv`, `use-cases.yaml`) are not written: this run was asked for one report. They are meant to
  be written from these tables for each slice once Benjamin has answered the questions that slice needs.
- The keys were reconciled with 05 to 12 on 2026-11-22 (report 13). The ten drafted queries were re-parsed after
  that edit. After the sceptic review the same day, CQ-W03, CQ-W07 and CQ-P08 were rewritten and run with rdflib over
  throwaway fixtures built from their text, kept outside the repository: each returned its expected rows, and the
  must-fail variants (bin-level available, a shipment with two lines naming the pallet, a location grant naming no
  location) did not change them. The other nine blocks were parsed only. Those runs do not cover the later revisions
  to stock selection, grant periods, recall or confirmation history.
