---
type: Research
title: Taxonomies of the ERP ontology
description: Every SKOS concept scheme the ERP ontology needs, its concepts, and the record field that takes its values.
---

# Taxonomies of the ERP ontology

This is a design to argue with, not a decision. It is the conceptualizer's step for code lists: which SKOS concept
schemes the vocabulary module holds, what each concept means, and which record field takes its allowed values from
which scheme. No term in it is ratified: decisions 1 to 7 ratify no term by name and no `rat-` record exists, so every
row below is a proposal that goes through the foundational auditor and Benjamin before the architect writes it into
the vocabulary module (which is not built). TypeScript and Turtle below are sketches, not code.

Inputs: the project profile and the packet's `DECISIONS.md`; reports 01 and 02; the shared gist, naming, anti-pattern
and foundational files; the two seed reports ("the architecture seed" and "the API design report"); the catalog and
access contract packages, `packages/kernel/src/Role.schema.ts`, the review package's word and status files,
`docs/glossary.md`, the root `DECISIONS.md`, the alchemy-domain packet, and both sample files. Where the seeds disagree,
report 01 section 5 decides. Sutton facts are from Sutton's public help pages and feature pages only, each marked
"Sutton public", read 2026-11-22 through a page fetch that summarised them.

## 1. Rules every scheme here follows

1. **A code list is a SKOS scheme, never subclasses** (enum-is-taxonomy, `foundational-analysis.md`), unless the
   values carry different identity or different properties; then they are classes owned by the term documents, and
   the record's tag literals equal those class keys (item kind, section 4.2).
2. **The notation is the record's literal, exactly.** `EA`, `raw-materials`, `takenBack`: the string a record schema
   holds today, or will hold. The vocabulary owns what a value means (label, definition, broader, alignment); the
   record schema owns which values a field allows (decision 2: a change to an allowed value is a change to a record
   schema). A check, once built, fails when a record literal is not a notation of the scheme its `term` names. A
   field may allow a subset of a scheme (`Dimensions.unit` allows `cm` and `in` only).
3. **A concept's IRI is `inv:<SchemeKey>-<notation>`** (`inv:ItemRoleScheme-buy`, `inv:UnitOfMeasureCodeScheme-EA`),
   under the `example.org` placeholder (decision 7); every scheme key ends in `Scheme`, 05's rule V3. The form is open
   in the profile (pending Q1). A slash would need escaping in a Turtle local name; a hyphen does not.
4. **Identity of a concept** is its scheme and its notation. A notation is never reused for another meaning: a change
   of meaning is a new concept and a deprecation (the architecture seed, section 6), which the curator plans.
5. **"Closed"** means the scheme lists every value that may occur in this repository's records; a record schema then
   generates `sh:in`. "Open" means more values are expected (an unverified Sutton list, a tenant's own), and an
   unknown source literal goes to a person to map, never to the nearest label (the architecture seed, section 6).
6. **"One" or "several"** is said of one record: one value per field, or a set.
7. **An altLabel is a word, not a licence.** A file that writes `bx` or `Finished Good` still gets the import's
   proposal and the person's decision ("The person decides; the app proposes"); the altLabel is evidence for the
   proposal, never an automatic mapping.
8. **No `owl:inverseOf`, no `owl:sameAs`, no `skos:exactMatch` between two tenants' records.** `skos:broader` is
   written one way only; `skos:narrower` is a `^skos:broader` path. Mapping predicates are the `skos:*Match` family.
9. **Labels and definitions** are written as `skos:prefLabel` and `skos:definition`; which properties they project
   as is open in the profile.
10. **Overlap is not hierarchy.** Inventory measures overlap (Reserved is counted inside Committed, by Sutton's public
    words); that is a fact about quantities, said in a scope note, not a `skos:broader` link (report 01 section 5).

## 2. The schemes as terms

Each scheme is a term of its own. Its concepts are listed in section 4. On 2026-11-22 the keys were matched with the
other documents (report 13): every key now ends in `Scheme`, `IdentifierScheme` became `IdentifierKindScheme` (one
scheme for the item, party and tracking codes of 06, 07 and 08), `QualityResult` became `QualityOutcomeScheme` (09's
name, since `QualityResult` is 09's class), and the schemes 06, 08 and 09 named without concepts were added (sections
4.29 to 4.31). Open choices are numbered decisions in [DECISIONS.md](../DECISIONS.md), mapped from each Qn here under
"Questions for Benjamin".

| Key | Label | Definition | Tag | gist parent | Identity | Source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ItemRoleScheme | Item role | A controlled vocabulary of the parts a business plays in an item's flow, buying, making or selling it, several of which one item may hold at once. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key in the vocabulary module | the architecture seed 5.1 and section 6; Sutton public items article | Sutton only |
| ItemCategoryScheme | Item category | A controlled vocabulary of the stock groups an item is filed under, by what the stock is for. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | packages/catalog/contract/src/Item/Item.read.ts (`categories`) | in the repository today |
| ItemLifecycleScheme | Item lifecycle | A controlled vocabulary of the phases an item record passes through, from drafted to no longer stocked. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | Item.read.ts (`StockingKind`); the architecture seed section 6; Sutton public items article | in the repository today (three of five concepts) |
| TrackingMethodScheme | Tracking method | A controlled vocabulary of the ways an item's stock is told apart, from one pooled quantity to one identifier per unit. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | Item.read.ts (`lotTracked`); the architecture seed section 6; Sutton public tracking article | in the repository today (two of four concepts) |
| UnitOfMeasureCodeScheme | Unit of measure code | A controlled vocabulary of the units an item's quantities and sizes are written in, each named by the code a record holds. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | Item.read.ts (`uoms`, `Dimensions.unit`); both samples | in the repository today |
| MeasurementDimensionScheme | Measurement dimension | A controlled vocabulary of the kinds of amount a unit measures, such as count, mass, length and volume. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | NEW: a unit's dimension decides which conversions need an item factor (docs/glossary.md "Conversion factor"; the architecture seed 7.3) | later |
| ContactPurposeScheme | Contact purpose | A controlled vocabulary of what a party's contact point is used for, such as billing, shipping or receiving goods. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | report 01 section 3 | later |
| IdentifierKindScheme | Identifier kind | A controlled vocabulary of the systems that issue identifiers, each saying who assigns the identifier's text and what it identifies. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | report 01 section 3; Item.read.ts (`sku`, `vendorSku`); docs/glossary.md "Barcode"; the architecture seed 7.1 | in the repository today (two concepts) |
| GrantScopeKindScheme | Grant scope kind | A controlled vocabulary of the extents a grant of access covers: a whole organization, one location, or one field. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | report 01 section 3; the architecture seed 5.7 | in the repository today (one concept) |
| MemberRoleScheme | Member role | A controlled vocabulary of the access levels a member holds in an organization, ranked by what each may do. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | packages/kernel/src/Role.schema.ts (`Role`) | in the repository today |
| ReviewOutcomeScheme | Review outcome | A controlled vocabulary of where a row of an imported file stands before the confirm, which add up to the rows reviewed. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | packages/catalog/model/src/Review/Review.rules.ts (`RowOutcome`); packages/review/src/ReviewWords.words.ts | in the repository today |
| ImportResultOutcomeScheme | Import result outcome | A controlled vocabulary of what a confirmed import did with each row, read back from what is stored. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | packages/catalog/contract/src/Import/Import.read.ts (`OutcomeKind`); packages/catalog/web/src/internal/format.tsx (`importWords`) | in the repository today |
| ImportLifecycleScheme | Import lifecycle | A controlled vocabulary of the phases of one import of a file, from under review to confirmed or taken back. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | Import.read.ts (`status`, lines 340 and 456); packages/catalog/web/src/PastImports.screen.tsx | in the repository today |
| ValueChangeSourceScheme | Value change source | A controlled vocabulary of who produced a stored value that differs from its file: a rule, a model or a person. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | packages/catalog/contract/src/Import/Change.read.ts (`ChangeSource`) | in the repository today |
| ValueChangeMethodScheme | Value change method | A controlled vocabulary of how a value that differs from its file came to stand: applied by a rule, accepted from a proposal, or typed. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | Change.read.ts (`ChangeHow`) | in the repository today |
| OrderLifecycleScheme | Order lifecycle | A controlled vocabulary of the phases a commitment passes through from drafted to finished or cancelled, shared by every kind of order. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | the architecture seed section 6 ("Workflow"); Sutton public order articles (pending Q9) | Sutton only |
| FulfilmentProgressScheme | Fulfilment progress | A controlled vocabulary of how much of an order's quantity has been delivered against it, shipped or received. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | NEW: the architecture seed 5.5 and 5.6 (partial receipts, orders shipped in portions); Sutton public order articles (pending Q9) | Sutton only |
| PaymentProgressScheme | Payment progress | A controlled vocabulary of how much of an order's amount the business has been told is paid. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | Sutton public sales order article; the architecture seed 5.6 (pending Q9) | Sutton only |
| InvoicingProgressScheme | Invoicing progress | A controlled vocabulary of how much of an order has been invoiced. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | Sutton public sales order article; the API design report (`hasPartialSuffix`) (pending Q9) | Sutton only |
| QualityOutcomeScheme | Quality outcome | A controlled vocabulary of the verdicts a quality check records on what it checked. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | Sutton public quality check article; the architecture seed 5.7 | Sutton only |
| QualityDispositionScheme | Quality disposition | A controlled vocabulary of the decisions on whether stock may be used, held or refused. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | the architecture seed section 6 ("Inventory disposition"); Sutton public receiving article; docs/glossary.md "Quarantine" (pending Q8) | Sutton only |
| StockConditionScheme | Stock condition | A controlled vocabulary of observed physical states of stock that bear on its use, several of which may hold at once. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | the architecture seed section 6 (Damaged, Expired); docs/glossary.md "Expiry date" (pending Q8) | later |
| LabelLifecycleScheme | Label lifecycle | A controlled vocabulary of the phases an inventory label passes through, from holding a quantity to holding none. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | the architecture seed section 6; Sutton public inventory article (pending Q8) | Sutton only |
| InventoryMeasureKindScheme | Inventory measure kind | A controlled vocabulary of the meanings a stock quantity can have at a place and time, which overlap and are never summed together. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | the architecture seed 5.2 and section 6; Sutton public inventory article; Item.read.ts (`quantityOnHand`); docs/glossary.md "On hand, committed, available" | in the repository today (one concept) |
| BusinessStepScheme | Business step | A controlled vocabulary of the business activities a stock event records, aligned to GS1 CBV business steps. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | the architecture seed section 6 and 7.1; GS1 CBV 2.0.0 ontology | later |
| CostBasisScheme | Cost basis | A controlled vocabulary of the ways a unit cost is arrived at, such as from actual purchases and production or from a set standard. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | the architecture seed section 6 ("Valuation"); Sutton public costing article; docs/glossary.md "Valuation" | later |
| CostFinalityScheme | Cost finality | A controlled vocabulary of whether a cost observation may still change as the transactions behind it finish. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | the architecture seed 5.8; Sutton public costing article | Sutton only |
| AccountingSyncStateScheme | Accounting sync state | A controlled vocabulary of where a document stands in being sent to an outside accounting system. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | NEW: report 01 section 4 names the accounting boundary and no state; no Sutton public list was found (pending Q12) | later |
| AccountStatusScheme | Account status | A controlled vocabulary of whether the tenant still trades with an account organization or has set its record aside. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 06; Sutton public accounts article (Active, Archived) | Sutton only |
| ContactPointKindScheme | Contact point kind | A controlled vocabulary of the kinds of electronic address at which a party is reached. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 06; schema.org `email`, `telephone` (fetched by 06) | Sutton only |
| IdentityOutcomeScheme | Identity outcome | A controlled vocabulary of what an identity decision finds about two parties a tenant holds. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 06; report 01 section 3 | later |
| EvidenceKindScheme | Evidence kind | A controlled vocabulary of the likenesses and differences between two parties a tenant holds that an identity decision may rest on. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 06; IBM MDM suspected duplicate processing (fetched by 06) | later |
| MembershipStatusScheme | Membership status | A controlled vocabulary of where a person's membership of a tenant stands, from invited to removed. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 06; the `member` table (`removedAt`); Sutton public user accounts article | in the repository today (two of four concepts) |
| PortalModuleScheme | Portal module | A controlled vocabulary of the parts of a tenant's records a customer or vendor portal may show. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 06; Sutton public portals article | Sutton only |
| ModelCallPurposeScheme | Model call purpose | A controlled vocabulary of what a call to a language model is made for, each call drawn from the day's allowance. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 06; `packages/access/contract/src/Allowance/ModelAllowance.gateway.ts` (`ModelCallPurpose`) | in the repository today |
| PositionBasisScheme | Position basis | A controlled vocabulary of how the quantities of a stock position were obtained. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 08 (book, counted, reported) | in the repository today (one concept: reported) |
| AdjustmentReasonScheme | Adjustment reason | A controlled vocabulary of why a book quantity was changed by an adjustment. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 08; the API design report (inventory adjustments) | Sutton only |
| HoldReasonScheme | Hold reason | A controlled vocabulary of why stock is put on a quality hold. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 09; 08 (its worked example); the architecture seed (`holdReason`) | Sutton only |
| ReceivingRejectReasonScheme | Reject reason | A controlled vocabulary of why received goods are refused, which a tenant extends with its own reasons. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 09; the API design report 1.3 (custom supplier reject reasons) | Sutton only |
| AccountingSyncDirectionScheme | Sync direction | A controlled vocabulary of the two directions a document travels between the tenant and an outside accounting system. | information | none: a `skos:ConceptScheme`, not an OWL class (pending Q3) | its key | 09; the architecture seed 2.1 ("Model each synchronization direction ... separately") | later |

## 3. Who owns what around these schemes

The classes and records that carry a value from a scheme belong to the other documents, under their likely keys:
`ItemSpecification` and its kinds, `UnitOfMeasure`, `CostObservation` (07); `ContactPoint`, `PartyIdentifier`, `Grant`,
`Role`, `Organization` and its role flags (06); `StockPosition`, `InventoryMeasure`, `InventoryLabel`, `TrackingCode`
(08); the orders and their lines under `gist:Intention`, the events under `gist:Event`, `QualityInspection`,
`AccountingSyncRecord`, and the import's `ItemImport`, `FileRow`, `RowOutcome`, `ValueChange`
(09). When a term document names a property that carries one of these schemes, its key wins (section 6). The gist
projection, gist parents and every alignment row are 11's; the candidate rows in this document are input to 11, not a
second home. The check that a record literal is a notation is 12's to specify.

## 4. The schemes and their concepts

### 4.1 ItemRoleScheme (Item role)

- Applies: several at once. An inventory item may be bought, made and sold.
- Closed: yes. Concepts are roles of an item, not kinds: no disjointness between them.
- Record field: none today. Later the item specification record's `roles` (an array, at least one), owned by 07.
  Sutton public: an inventory item takes any combination; a service item takes buy, sell or both; an alias item takes
  sell only. Those are record rules of the item kinds (SHACL from the record), not concept facts.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| buy | Buy | Purchased | none | An item role in which the business obtains the item from a vendor. | the architecture seed section 6; Sutton public items article |
| make | Make | Manufactured, Produced | none | An item role in which the business produces the item from components or ingredients. | the architecture seed section 6; Sutton public items article |
| sell | Sell | Sold | none | An item role in which the business supplies the item to a customer for payment. | the architecture seed section 6; Sutton public items article |

### 4.2 Item kind: not a scheme (pending Q6)

Sutton public: an item is Inventory (physical goods), Service (work, no stock) or Alias (sold under another name or
SKU and fulfilled by another item). These differ in identity-bearing structure (an alias points at its fulfilment
item; a service has no stock). gist separates product and service specifications too, but the projection takes
neither class: decision 12 gives the item kinds one identity-bearing parent, `ItemSpecification`, and either gist
class would be a second. So they are rigid subkinds owned by 07, and the item record's kind tag takes its
literals from those class keys; no `ItemKind` scheme is emitted. The table lists the tag values only, to show the
field.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| inventory | Inventory item | Stock item | none | The tag value of an item specification that describes physical goods held as stock; points at 07's class. | the architecture seed 5.1; Sutton public items article |
| service | Service item | Non-stock item | none | The tag value of an item specification that describes work done, with no stock; points at 07's class. | the architecture seed 5.1; docs/glossary.md "Non-stock item"; Sutton public items article |
| alias | Alias item | none | none | The tag value of an item specification sold under its own name and fulfilled by another item's stock; points at 07's class. | the architecture seed 5.1; Sutton public items article |

Record field: none today (every stored item is a physical good). Later, 07's item record tag. The glossary's "Kit"
(picked from stock and sold together) and the API design report's bundled item are a fourth candidate for 07, not a
tag value here.

### 4.3 ItemCategoryScheme (Item category)

- Applies: one per item.
- Closed: yes, in this repository; another tenant's category list is its own scheme or a `gist:Category`, not new
  concepts here.
- Concepts are categories; under Q3's recommended answer they are SKOS concepts only, not `gist:ProductCategory`.
- Record field: `ItemFields.category` and `ItemEdit.category` (`Category`, Item.read.ts), and the import's
  `category` field.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| raw-materials | Raw materials | Raw material | none | An item category for stock bought to be used up in making other items. | Item.read.ts `categories`; items_messy.csv (44 rows) |
| components | Components | Component | none | An item category for stock built into another item and still identifiable in it. | Item.read.ts; items_messy.csv (38 rows, plus 1 "Component", a proposal per the root DECISIONS.md) |
| finished-goods | Finished goods | Finished Good | none | An item category for stock ready to be sold to a customer. | Item.read.ts; items_messy.csv (29 rows, plus 2 "Finished Good", a proposal) |
| packaging | Packaging | none | none | An item category for stock that holds, protects or carries other items and goes out with them. | Item.read.ts; items_messy.csv (33 rows, plus 1 "Packaging", a form-only fix) |
| supplies | Supplies | Consumables | none | An item category for stock used up in running the business that never becomes part of a product. | Item.read.ts; items_messy.csv (50 rows) |

The prefLabels are NEW: the screen shows the notation today. "Misc" (2 rows) is not an altLabel: it is a Cannot
import row with a model suggestion (root DECISIONS.md). The API design report's stage list (raw material, ingredient,
supply, work in progress, subassembly, finished good) is a candidate alignment for 11, not more concepts here: no
record or competency question needs work in progress yet.

### 4.4 ItemLifecycleScheme (Item lifecycle)

- Applies: one per item.
- Closed: no. Sutton's three public words do not map one to one onto the repository's three (see below).
- Concepts are phases of an item specification.
- Record field: `ItemFields.stocking` and `ItemEdit.stocking` (`Stocking`, tagged by `StockingKind`, Item.read.ts).
  The discontinued date stays on the record (`Discontinued.on`); the concept carries no date.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| active | Active | In use | none | An item lifecycle phase in which the item is in use and may be stocked, bought, made or sold. | Item.read.ts `StockingKind`; Sutton public items article ("Active") |
| inactive | Inactive | Not in use | none | An item lifecycle phase in which the item is out of use with no day given on which it stopped being stocked. | Item.read.ts `Inactive` |
| discontinued | Discontinued | No longer stocked | none | An item lifecycle phase in which the item stopped being stocked on a stated day and is out of use. | Item.read.ts `Discontinued`; docs/glossary.md |
| draft | Draft | none | none | An item lifecycle phase in which the item record is still being written and is not yet offered for use. | Sutton public items article; the architecture seed section 6 |
| archived | Archived | none | none | An item lifecycle phase in which the item is withdrawn from lists and kept only so past records still refer to it. | Sutton public items article; the architecture seed section 6 |

No broader: `discontinued` is not narrower than `inactive`, because the repository defines inactive as "nobody said
it was discontinued". Whether Sutton's Archived is the repository's discontinued is not known from public sources; no
mapping is asserted until a person maps real source records.

### 4.5 TrackingMethodScheme (Tracking method)

- Applies: one per item. Sutton public: an item is Standard or Serialized; the repository stores one boolean.
- Closed: no.
- Concepts are categories of an item specification. A tracking method is hard to change once stock exists
  (docs/glossary.md), which is a record rule, not a concept fact.
- Record field: `ItemFields.lotTracked` and `ItemEdit.lotTracked` (Item.read.ts), a boolean today: `true` reads as
  `lot`, `false` as `untracked`. Later a `tracking` field on 07's item record, a change to a record schema that is
  Benjamin's.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| untracked | Not tracked | Standard | none | A tracking method in which stock of the item is one interchangeable quantity per place, with no lot, label or serial. | Item.read.ts `lotTracked: false`; Sutton public tracking article ("Standard") |
| lot | By lot | Lot tracked, Batch | none | A tracking method in which stock is told apart by the lot it was made or received in, each lot holding a quantity. | Item.read.ts `lotTracked: true`; docs/glossary.md "Lot (batch)"; the architecture seed section 6 |
| label | By label | Serialized | none | A tracking method in which stock is told apart by labels, each label standing for a quantity that may be one unit, a batch or a split part. | the architecture seed section 6 ("Label-based serialized tracking"); Sutton public tracking article |
| serial | By serial number | Unit serial | none | A tracking method in which each single unit of stock has its own identifier and a quantity of one. | the architecture seed section 6; docs/glossary.md "serial number" |

No broader links. `lot` and `serial` are not narrower than `label`: lot tracking exists without labels (this
repository's `lotTracked`), and Sutton public says a serialized label can stand for one item, a batch, or part of a
container, so one Sutton item's labels are not all lots or all serials. A Sutton "Serialized" item reads as `label`;
whether its labels are lots or single units is decided per item by a person (pending Q11).

### 4.6 UnitOfMeasureCodeScheme (Unit of measure code)

- Applies: one per field. An item has one counting unit; a dimensions value has one length unit.
- Closed: the scheme is open (case, pallet and inner are expected, docs/glossary.md); each field's subset is closed by
  its record schema.
- Concepts are units: each is also an individual of 07's `UnitOfMeasure` class, under `gist:UnitOfMeasure`
  (05's `alsoInstanceOf`; pending decision 61).
- Record fields: `ItemFields.uom` and `ItemEdit.uom` (`Uom`: EA, BX, KG, M, L) and `Dimensions.unit` (cm, in), all in
  Item.read.ts. Each unit's dimension is a vocabulary fact, `hasDimension` (section 6).

Counts in the samples: items_messy.csv has EA 78, BX 58, KG 24, M 21, L 17 and `bx` 2 (a form-only fix to BX);
items_clean.csv has EA 10, KG 6, BX 4, M 3, L 2. Dimension units: messy cm 108, in 19, 73 empty; clean cm 17, in 1,
7 empty.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| EA | Each | each, piece | none | A unit of measure of count that counts single pieces of an item. | Item.read.ts `uoms` ("EA (each)"); both samples |
| BX | Box | box, bx | none | A unit of measure of count that counts boxes, whose number of pieces is set per item by a conversion. | Item.read.ts ("BX (box)"); both samples (`bx` in 2 messy rows) |
| KG | Kilogram | kg | none | A unit of measure of mass equal to one thousand grams. | Item.read.ts; both samples |
| M | Metre | m, meter | none | A unit of measure of length equal to one metre (pending Q10). | Item.read.ts (written only as "M"); both samples |
| L | Litre | l, liter | none | A unit of measure of volume equal to one cubic decimetre. | Item.read.ts; docs/glossary.md ("litre"); both samples |
| cm | Centimetre | centimeter | none | A unit of measure of length equal to one hundredth of a metre. | Item.read.ts `Dimensions.unit`; both samples |
| in | Inch | inch | none | A unit of measure of length equal to 2.54 centimetres. | Item.read.ts `Dimensions.unit`; both samples |

No broader: `BX` is not narrower than `EA`, because how many eaches a box holds is a fact about one item (07's
`ItemUnitConversion`), not about the unit. The record's labels are spelled in British English to match the glossary
("litre"); the American spellings are altLabels.

Candidate alignment rows for 11 (not checked against QUDT or UN/CEFACT here): KG `skos:exactMatch unit:KiloGM`,
M `unit:M`, L `unit:L`, cm `unit:CentiM`, in `unit:IN`; EA and BX have no QUDT unit checked (UN/CEFACT Rec 20 has
EA and BX, from memory).

### 4.7 MeasurementDimensionScheme (Measurement dimension)

- Applies: one per unit.
- Closed: no.
- Concepts are aspects: also individuals of `gist:Aspect` (05's `alsoInstanceOf`, with the projected gist class;
  pending decision 61).
- Record field: none. It is a vocabulary fact on each unit (`hasDimension`), read by the conversion rules: within one
  dimension a fixed factor converts (cm to in); across dimensions, or from a pack count to each, an item-specific
  factor is needed (the architecture seed 7.3; docs/glossary.md "Conversion factor").

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| count | Count | Number of pieces | none | A measurement dimension of how many discrete pieces or packs there are. | NEW: EA and BX need it (Item.read.ts) |
| mass | Mass | Weight | none | A measurement dimension of how much matter there is, measured on a scale. | NEW: KG needs it |
| length | Length | none | none | A measurement dimension of extent along one line. | NEW: M, cm and in need it |
| volume | Volume | none | none | A measurement dimension of how much three-dimensional space something fills. | NEW: L needs it |

### 4.8 Party role labels: flags, not a scheme (pending Q7)

Decision 3 makes customer and vendor flags on `Organization` (06's `isCustomer`, `isVendor`); carrier and contract
manufacturer are held back by decision 89. A second home for the same meanings as concepts would break decision 2's
"no fact with two homes". So no `PartyRole` scheme is emitted: the labels below are the prefLabel and altLabels of
06's two properties, listed here so a file column ("Type: Customer; Vendor") has words to propose from.
Several apply at once; the set is closed under decision 3.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| isCustomer | Customer | Client, Buyer | none | The label of the flag that says an organization buys from the business. | report 01 section 3; decision 3 |
| isVendor | Vendor | Supplier | none | The label of the flag that says an organization sells to the business. | report 01; docs/glossary.md "Supplier"; Item.read.ts `Vendor` |

Record field: none today (vendors are names inside `ItemFields.vendors`). Later 06's organization record.

### 4.9 ContactPurposeScheme (Contact purpose)

- Applies: several at once (one address may be both billing and shipping).
- Closed: no.
- Concepts are categories of a contact point.
- Record field: none today. Later 06's `ContactPoint` record, `purposes`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| billing | Billing | Bill-to | none | A contact purpose for which invoices and payment questions are sent to the contact point. | report 01 section 3 |
| shipping | Shipping | Ship-to | none | A contact purpose for which goods sent to the party are delivered to the contact point. | report 01 section 3 ("a ship-to address is not the customer") |
| receiving | Receiving | Receiving dock | none | A contact purpose for which the contact point is where goods arriving at the party's site are taken in. | report 01 section 3 |
| ordering | Ordering | Purchase orders | none | A contact purpose for which purchase orders and order questions are sent to the contact point. | NEW: a purchase order is sent to a vendor somewhere (the API design report's PO email recipients) |

### 4.10 IdentifierKindScheme (Identifier scheme)

- Applies: one per identifier.
- Closed: no.
- Concepts are categories of an identifier (`gist:ID`). An identifier never settles identity (report 01; the
  architecture seed 2.4 and 5.1: SKU is optional and never the identity).
- Record field: none as a field today: `ItemFields.sku` and `Vendor.vendorSku` are identifiers of a fixed scheme,
  stored in their own columns. Later 06's `PartyIdentifier.scheme` and any item identifier record of 07.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| sku | SKU | Item code, Stock keeping unit | none | An identifier scheme in which the business assigns a code to each of its items, unique in its organization. | Item.read.ts `ItemFields.sku`; docs/glossary.md "Item code" |
| vendorSku | Vendor part number | Supplier part number, Manufacturer part number | none | An identifier scheme in which a vendor assigns its own code to an item it sells. | Item.read.ts `Vendor.vendorSku`; docs/glossary.md |
| sourceRecordId | Source record id | Source id | none | An identifier scheme in which a source system assigns the id of its own record, the key a record is re-identified by. | report 01 section 3 ("the source system's id"); project profile (reidentification key) |
| gtin | GTIN | Barcode, EAN, UPC | none | An identifier scheme in which GS1 member companies number trade items for barcodes. | docs/glossary.md "Barcode"; the architecture seed 7.1 |
| gln | GLN | Global location number | none | An identifier scheme in which GS1 member companies number parties and locations. | report 01 section 3 |
| sscc | SSCC | Serial shipping container code | none | An identifier scheme in which GS1 member companies number logistic units such as pallets. | the architecture seed 7.1 ("a bin code into an SSCC") |
| lotCode | Lot code | Batch number, Traceability lot code | none | An identifier scheme in which the maker or receiver numbers a lot. | docs/glossary.md "Lot"; the API design report (TLC) |
| serialNumber | Serial number | none | none | An identifier scheme in which the maker numbers each single unit. | docs/glossary.md "serial number" |
| labelCode | Label code | Label barcode | none | An identifier scheme in which the business numbers its inventory labels. | the API design report (`labelCode`); Sutton public tracking article |
| taxId | Tax id | Tax identification number | none | An identifier scheme in which a tax authority numbers taxpayers. | report 01 section 3 |
| lei | LEI | Legal entity identifier | none | An identifier scheme in which GLEIF-accredited issuers number legal entities. | report 01 section 3 |
| duns | DUNS number | D-U-N-S | none | An identifier scheme in which Dun & Bradstreet numbers business establishments. | 06 (schema.org `duns`, fetched there) |

No broader. The EAN and UPC forms are lengths of GTIN; they become narrower concepts only if a record needs to tell
them apart.

### 4.11 GrantScopeKindScheme (Grant scope kind)

- Applies: one per grant.
- Closed: no.
- Concepts are categories of a grant's scope.
- Record field: none today. In this repository a member's role applies to the whole organization (`Role`, packages/
  kernel/src/Role.schema.ts; `Person.read.ts`, `People.command.ts`), which is `organization`. Later 06's `Grant`,
  `grantScope`; a location grant names its place with 08's `atLocation`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| organization | Whole organization | Tenant | none | A grant scope kind in which the grant covers every record of one organization. | report 01 section 3; Role.schema.ts (the only scope today) |
| location | One location | Site, Location permission | none | A grant scope kind in which the grant covers the records of one site or location and the places inside it. | report 01 section 3 (Sutton's location permissions, as report 01 reads them; not seen in the Sutton public user accounts article) |
| field | One field | Field permission | none | A grant scope kind in which the grant covers reading or writing one field of a kind of record. | report 01 section 3; the architecture seed 5.7 |

The architecture seed's app visibility is left out: it says app visibility cannot stand in for authorization.

### 4.12 MemberRoleScheme (Member role)

- Applies: one per member per organization.
- Closed: yes.
- Concepts are roles a member holds; they are ranked (an editor may do what a viewer may), and the rank is a rule in
  `hasRole`, not `skos:broader`: an editor is not a kind of viewer.
- Record field: `Role` in packages/kernel/src/Role.schema.ts, used by `Person.read.ts`, `People.command.ts`
  (`AddPerson`, `ChangeRole`) and `SessionState.read.ts`. 06 keeps `Role` as a class; under decision 41's recommended
  answer each concept here is also an individual of 06's `Role`, and the record's `Role` literals come from these
  notations.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| viewer | Viewer | Read only | none | A member role whose holder may read the organization's records and write none. | Role.schema.ts |
| editor | Editor | none | none | A member role whose holder may read and write the organization's records but not manage its people. | Role.schema.ts |
| admin | Admin | Administrator | none | A member role whose holder may read and write the organization's records and add, change and remove its people. | Role.schema.ts; packages/access/contract/src/People/People.command.ts |

### 4.13 ReviewOutcomeScheme (Review outcome)

- Applies: one per reviewed row.
- Closed: yes (pending Q15 on how many concepts).
- Concepts are phases of an import row under review.
- Record field: `ReviewedRow.outcome` (`RowOutcome`, packages/catalog/model/src/Review/Review.rules.ts), a TypeScript
  type today, not an Effect Schema; it gets a `term` when it becomes a schema. The words are set in
  `defaultReviewWords` (packages/review/src/ReviewWords.words.ts) and overridden for the import by `reviewStepWords`
  (packages/catalog/web/src/internal/format.tsx), which takes "Already there" from `importWords.already`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| ready | Ready | none | none | A review outcome of a row whose values were all read without doubt and would be imported by the confirm. | Review.rules.ts `RowOutcome`; ReviewWords.words.ts `ready` |
| decision | Needs a decision | Needs you | none | A review outcome of a row that waits for the person to take a proposal or a choice before it can be imported. | Review.rules.ts; ReviewWords.words.ts `needs` |
| cannot | Cannot import | Can't fix here | none | A review outcome of a row that cannot be imported as written until the person types or picks a value. | Review.rules.ts; ReviewWords.words.ts `cannot` |
| out | Left out | none | none | A review outcome of a row the person chose not to import. | Review.rules.ts; ReviewWords.words.ts `out` |
| already | Already there | none | none | A review outcome of a row whose SKU, compared after normalising, is already stored with the same values. | Review.rules.ts; format.tsx `importWords.already` |

Two notation sets for these meanings exist today: the catalog model's `RowOutcome` (above) and the review region's
`RowStatus` (`needs`, `cannot`, `ready`, `out`, `stored`, packages/review/src/ReviewRegion.types.ts), and the model's
own `RowStatus` uses `needs` for decision and cannot together. The scheme takes the catalog model's notations because
the review region is product-neutral and takes its words from its caller; the region's `RowStatus` gets no `term`.
The altLabels "Needs you" and "Can't fix here" are the region's tab words for the same views (CLAUDE.md "UI").

### 4.14 ImportResultOutcomeScheme (Import result outcome)

- Applies: one per row result.
- Closed: yes.
- Concepts are categories of a row's result, each counted from what is stored.
- Record field: `OutcomeKind` (packages/catalog/contract/src/Import/Import.read.ts). Words set in `importWords`
  (packages/catalog/web/src/internal/format.tsx); `PastImports.screen.tsx` spells "Taken back" a second time.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| created | Imported (pending Q5) | Created | none | An import result outcome in which the confirm created a new item from the row. | Import.read.ts `OutcomeKind`; format.tsx `importWords.created` = "Imported"; CLAUDE.md "UI" says "Created" |
| updated | Updated | Replaced | none | An import result outcome in which the confirm replaced a stored item with the row's values, as the person chose. | Import.read.ts; format.tsx `importWords.updated` |
| already | Already there | none | none | An import result outcome in which the row's SKU was already stored, so the confirm wrote nothing for it. | Import.read.ts; format.tsx `importWords.already` |
| notImported | Not imported | Left out, Rejected row | none | An import result outcome in which the confirm wrote nothing for the row and gave a reason naming the column and value. | Import.read.ts; format.tsx `importWords.notImported` |
| takenBack | Taken back | none | none | An import result outcome in which a later take-back removed the item the row created or put back the item it replaced. | Import.read.ts; format.tsx `importWords.takenBack`; PastImports.screen.tsx |

`importWords.all` ("All") is a filter over the outcomes, not an outcome, and gets no concept.

### 4.15 ImportLifecycleScheme (Import lifecycle)

- Applies: one per import.
- Closed: yes.
- Concepts are phases of an import.
- Record field: `status` in Import.read.ts (the import view, line 340, and the past import, line 456).

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| open | Open | Under review, Opened again | none | An import lifecycle phase in which the file is staged and under review and nothing it holds is stored. | Import.read.ts; PastImports.screen.tsx ("Opened again" for one confirmed once and reopened) |
| imported | Imported | Confirmed | none | An import lifecycle phase in which the person confirmed the import and its rows were stored. | Import.read.ts; PastImports.screen.tsx |
| takenBack | Taken back | none | none | An import lifecycle phase in which a confirmed import was undone in one atomic write. | Import.read.ts; PastImports.screen.tsx |

Lifecycle transitions are Alchemy decisions (explorations/alchemy-domain), not SKOS facts: a concept does not say
which phase may follow it.

### 4.16 ValueChangeSourceScheme and ValueChangeMethodScheme

Both apply one per change, are closed, and are categories of 09's `ValueChange` (a stored value that differs from its
file). Record fields: `ChangeSource` and `ChangeHow` (Change.read.ts). The audit trail needs both ("which file, row
and decision made each change", docs/glossary.md "Audit trail"), and the AI rules need the source on screen
(CLAUDE.md "AI features").

ValueChangeSourceScheme:

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| rule | Rule | none | none | A value change source in which a fixed rule of the import produced the value. | Change.read.ts `ChangeSource` |
| model | Model | AI suggestion | none | A value change source in which a language model's suggestion, accepted by the person, produced the value. | Change.read.ts |
| person | Person | none | none | A value change source in which the person typed or chose the value. | Change.read.ts |

ValueChangeMethodScheme:

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| appliedByRule | Fixed for you | Auto-fixed | none | A value change method in which a form-only rule wrote the value and nobody undid it. | Change.read.ts `ChangeHow`; ReviewStep.screen.tsx ("values fixed for you"); ReviewWords.words.ts `auto` |
| acceptedProposal | Accepted | none | none | A value change method in which the person accepted a rule's or a model's proposal. | Change.read.ts; ReviewWords.words.ts `accepted` |
| typed | Typed | Edited, Chosen | none | A value change method in which the person typed or chose the value. | Change.read.ts; ReviewWords.words.ts `edited`, `chosen` |

### 4.17 Order lifecycles (pending Q9)

Recommended design: one `OrderLifecycleScheme` scheme for the phase of every commitment, and three schemes beside it for
the progress dimensions that vary independently (fulfilment, payment, invoicing). One enum per order type that mixes
them (Sutton public: a new sales order shows "Unfulfilled", a new purchase order "Awaiting shipment") cannot say
"released, half shipped, not paid". The source's own status word is kept with the record beside its mapped concept (the
architecture seed section 6).

Which schemes apply to which order (09's classes):

| Order (09) | OrderLifecycleScheme | FulfilmentProgressScheme | PaymentProgressScheme | InvoicingProgressScheme | Sutton public words |
| --- | --- | --- | --- | --- | --- |
| PurchaseOrder | yes | yes (received) | no | no | Draft; Awaiting shipment; partial receipt (50 of 100) |
| SalesOrder | yes | yes (shipped) | yes | yes | Draft; Unfulfilled; Not paid; Paid in full; not invoiced |
| ManufacturingOrder | yes | no | no | no | Not started; In progress; Completed; reopened |
| WorkOrder | yes | no | no | no | none named |
| TransferOrder | yes | yes (received at the destination) | no | no | none read |
| Quote | no: an offer, its own phases are later | no | no | no | none read |

OrderLifecycleScheme (applies: one per order; closed: no; concepts are phases of a commitment; record field: 09's order
records, `lifecycle`; none in the repository):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| draft | Draft | none | none | An order lifecycle phase in which the order is being written and commits nobody yet. | the architecture seed section 6; Sutton public PO and SO articles |
| planned | Planned | Not started, Scheduled | none | An order lifecycle phase in which the order is agreed and scheduled and no work or movement has started. | the architecture seed section 6; Sutton public MO article ("Not started", unmapped until a source record is mapped) |
| released | Released | Issued | none | An order lifecycle phase in which the order is authorised to be carried out. | the architecture seed section 6 |
| inProgress | In progress | Running | none | An order lifecycle phase in which work or movement under the order has started and not finished. | the architecture seed section 6; Sutton public MO article |
| complete | Complete | Completed, Closed | none | An order lifecycle phase in which the order is finished under its process; it may be reopened. | the architecture seed section 6; Sutton public MO and costing articles (an MO can be reopened) |
| cancelled | Cancelled | Void | none | An order lifecycle phase in which the order was stopped before completion, without implying its effects were reversed. | the architecture seed section 6 |

FulfilmentProgressScheme (applies: one per order or line; closed: yes; record field: 09's orders, `fulfilment`):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| none | Not fulfilled | Unfulfilled, Awaiting shipment, Not received | none | A fulfilment progress in which nothing has been shipped or received against the order. | Sutton public SO ("Unfulfilled") and PO ("Awaiting shipment") articles |
| partial | Partly fulfilled | Partially received, Partially shipped | none | A fulfilment progress in which some but not all of the order's quantity has been shipped or received. | the architecture seed 5.5 and 5.6; Sutton public receiving article (partial receipt) |
| full | Fulfilled | Received, Shipped | none | A fulfilment progress in which the order's whole quantity has been shipped or received. | the architecture seed 5.5 and 5.6 |

PaymentProgressScheme (applies: one per order; closed: no, Sutton public says more statuses exist without naming them;
record field: 09's sales order, `payment`; an observed attribute, not proof of a ledger, per the architecture seed 5.6):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| notPaid | Not paid | Unpaid | none | A payment progress in which no payment against the order has been recorded. | Sutton public SO article ("Not paid", the default) |
| partlyPaid | Partly paid | none | none | A payment progress in which some but not all of the order's amount has been recorded as paid. | NEW: between the two Sutton public words |
| paidInFull | Paid in full | Paid | none | A payment progress in which the order's whole amount has been recorded as paid. | Sutton public SO article |

InvoicingProgressScheme (applies: one per order; closed: yes; record field: 09's sales order, `invoicing`):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| notInvoiced | Not invoiced | none | none | An invoicing progress in which no invoice has been raised for the order. | Sutton public SO article |
| partlyInvoiced | Partly invoiced | none | none | An invoicing progress in which invoices cover some but not all of the order. | the API design report (`hasPartialSuffix`: an invoice for part of an order) |
| fullyInvoiced | Invoiced | none | none | An invoicing progress in which invoices cover the whole order. | the API design report |

### 4.18 QualityOutcomeScheme (Quality result)

- Applies: one per check result.
- Closed: no (Sutton public names Pass and Fail only; a tenant may add more).
- Concepts are categories of a quality check's result; a pass does not release stock by itself (the architecture seed
  5.7).
- Record field: none in the repository. Later 09's `QualityInspection`, `inspectionOutcome`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| pass | Pass | Conformant | none | A quality result in which what was checked met the checkpoint's criteria. | Sutton public quality check article |
| fail | Fail | Non-conformant | none | A quality result in which what was checked did not meet the checkpoint's criteria. | Sutton public quality check article |

### 4.19 QualityDispositionScheme and StockConditionScheme (pending Q8)

The architecture seed puts Unrestricted, Quality hold, Damaged, Expired and Rejected in one disposition scheme. Two
of them are decisions a person makes (hold, reject, release) and two are observations of the stock (damaged,
expired), which can hold together and independently of the decision. The recommended design splits them.

QualityDispositionScheme (applies: one per label, lot or serial unit at a time, the stock itself and never a stock
position, whose measures overlap; closed: no; concepts are phases of stock under a quality decision; record field:
none today, later 08's label, lot or serial unit records, `disposition`). A disposition records what a source or a
person stated about the stock; 08's quarantined measure is worked out from the holds in force only, never from it:

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| unrestricted | Unrestricted | Released | none | A quality disposition in which no quality restriction applies to the stock; it does not by itself make the stock available. | the architecture seed section 6 |
| onHold | On hold | Quarantine, Quarantined, Quality hold | none | A quality disposition in which the stock is present but may not be used until a person decides. | the architecture seed section 6; docs/glossary.md "Quarantine (on hold)"; Sutton public receiving article |
| rejected | Rejected | Reject | onHold | A quality disposition in which a person refused the stock and it is held for return to the vendor or for disposal. | the architecture seed section 6; Sutton public receiving article (rejected material is quarantined and flagged for return) |

`rejected` is narrower than `onHold` because Sutton public says rejected material is set to quarantine automatically:
rejected stock is held stock with a decision taken. A recall hold is `onHold` with 09's `RecallCase` as its reason.

StockConditionScheme (applies: several at once, to a label, lot or serial unit; closed: no; concepts are categories
of observed stock; record field: none today, later 08's label, lot or serial unit records, `conditions`):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| damaged | Damaged | none | none | A stock condition in which the stock or its packaging was observed to be physically harmed. | the architecture seed section 6; Sutton public receiving article (reject reason "packaging was damaged") |
| expired | Expired | Past expiry | none | A stock condition in which the stock is past the last usable date of its lot. | the architecture seed section 6; docs/glossary.md "Expiry date" |

### 4.20 LabelLifecycleScheme (Label lifecycle) (pending Q8)

- Applies: one per label.
- Closed: no.
- Concepts are phases of 08's `InventoryLabel`, never of the item (the architecture seed 5.2).
- Record field: none in the repository. Later 08's label record, `lifecycle`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| active | Active | none | none | A label lifecycle phase in which the label still stands for a quantity of stock. | Sutton public inventory article; the architecture seed section 6 |
| depleted | Depleted | Used up | none | A label lifecycle phase in which the label stands for no remaining quantity and is kept for genealogy. | Sutton public inventory article; the architecture seed section 6 |

Sutton public lists a third label status, Quarantined. Under the recommended split it is read as `active` with the
disposition `onHold`, so a held label is still a label with stock; the seed's separate `LabelQuarantined` concept is
not emitted.

### 4.21 InventoryMeasureKindScheme (Inventory measure kind)

- Applies: one per measure. A stock position carries several measures at once, each its own 08 `InventoryMeasure`
  with one kind; they overlap and are never summed into one total (report 01 section 5).
- Closed: no.
- Concepts are categories of a quantity's meaning.
- Record field: `ItemFields.quantityOnHand` (Item.read.ts) is the one measure stored today, of kind `onHand`. Later
  08's `InventoryMeasure.kind`. `ItemFields.reorderPoint` is not a measure: it is a level a person sets (07's
  `reorderPoint`, a `QuantityValue`).

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| onHand | On hand | In stock, Quantity on hand, Qty On Hand | none | An inventory measure kind that counts stock physically present at the place, whatever is promised or held. | Item.read.ts `quantityOnHand`; docs/glossary.md; Sutton public inventory article ("In stock"); items_messy.csv heading "Qty On Hand" |
| available | Available | none | none | An inventory measure kind that counts stock free to promise to a new order, computed only by a stated formula. | the architecture seed 5.2 and section 6; docs/glossary.md ("usually calculated"); Sutton public inventory article |
| committed | Committed | Allocated | none | An inventory measure kind that counts stock set aside for sales, manufacturing or transfer orders, reservations included. | Sutton public inventory article (its definition); docs/glossary.md |
| reserved | Reserved | none | none | An inventory measure kind that counts stock reserved against a particular order or need. | the architecture seed section 6; Sutton public inventory article (named, not defined) |
| acquired | Acquired | Incoming, On order | none | An inventory measure kind that counts stock ordered or in production and not yet received. | the API design report (Sutton public names it without a definition); docs/glossary.md "Incoming (on order)" |
| quarantined | Quarantined | On hold | none | An inventory measure kind that counts the part of on-hand stock that at least one quality hold in force covers. | the architecture seed section 6; Sutton public inventory article (named, not defined) |
| inTransit | In transit | none | none | An inventory measure kind that counts stock a movement has dispatched toward a site and that has not arrived. | 08 (its `InTransit`); docs/glossary.md "Transfer, in transit" |

The definitions in this table are short forms of 08's, which hold the arithmetic (section 5 there) and are the home of
each concept's definition; 08 first wrote `OnHold` and `Incoming` for `quarantined` and `acquired`.

No broader links. The API design report puts Available, Committed, Reserved and Quarantined under In stock; that is
quantity inclusion, not concept hierarchy, and it is wrong for Acquired, which is not in stock. The inclusions are
scope notes: Reserved is counted inside Committed (Sutton public's definition of Committed); Committed and
Quarantined are counted inside On hand. "Acquired" means what the API design report says only until a source record
is mapped.

### 4.22 BusinessStepScheme (Business step)

- Applies: one per event.
- Closed: no.
- Concepts are categories of an execution event; each matches one GS1 CBV 2.0.0 business step where the meanings
  coincide. Only the steps this repository's events or Sutton's public workflows need are listed.
- Record field: none today. Later 09's event records, `businessStep`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| receiving | Receiving | none | none | A business step in which goods arriving at a site are taken in and recorded. | the architecture seed section 6; CBV `BizStep-receiving`; Sutton public receiving article |
| accepting | Accepting | Accept | none | A business step in which received goods are accepted as meeting the order. | CBV `BizStep-accepting`; Sutton public receiving article (accept or reject) |
| inspecting | Inspecting | Quality check | none | A business step in which goods are checked against criteria. | the architecture seed section 6; CBV `BizStep-inspecting`; Sutton public quality check article |
| holding | Holding | Quarantining | none | A business step in which goods are put on hold. | CBV `BizStep-holding`; the architecture seed 5.5 (quality hold) |
| commissioning | Commissioning | Labelling | none | A business step in which a new identifier, such as a label or lot code, is first given to goods. | the architecture seed section 6; CBV `BizStep-commissioning` |
| picking | Picking | none | none | A business step in which goods are taken from where they are stored to fill an order. | CBV `BizStep-picking`; the architecture seed 5.6 (picks) |
| packing | Packing | none | none | A business step in which goods are put into a container or logistic unit. | the architecture seed section 6; CBV `BizStep-packing` |
| unpacking | Unpacking | none | none | A business step in which goods are taken out of a container or logistic unit. | the architecture seed section 6; CBV `BizStep-unpacking` |
| shipping | Shipping | none | none | A business step in which goods leave a site for a recipient. | the architecture seed section 6; CBV `BizStep-shipping` |
| cycleCounting | Stock count | Cycle count | none | A business step in which goods at a place are counted to compare with the records. | CBV `BizStep-cycle_counting`; docs/glossary.md "Stock count" |

CBV 2.0.0 has no transforming step (41 `BizStep-` names read in its ontology file, none of them transforming), so a
transformation carries 09's `TransformationEvent` class and, if any, a step chosen from evidence; none is invented
here. Candidate alignment rows for 11: each concept `skos:exactMatch` the CBV step named in its Source cell.

### 4.23 EPCIS disposition: alignment rows, not a scheme

EPCIS dispositions are a target vocabulary for an export, so the meanings stay in this repository's schemes and CBV
is reached by mapping. Candidate rows for 11 (CBV names read in the CBV 2.0.0 ontology file):

| Local concept | CBV disposition | Predicate | Condition |
| --- | --- | --- | --- |
| QualityDispositionScheme-onHold | `cbv:Disp-non_sellable_other` | skos:relatedMatch | only when the hold is shown to prevent sale (the architecture seed 7.1) |
| QualityDispositionScheme-rejected | `cbv:Disp-non_sellable_other` | skos:relatedMatch | as above |
| QualityDispositionScheme-unrestricted | `cbv:Disp-sellable_accessible` | skos:relatedMatch | unrestricted does not mean sellable; per event |
| StockConditionScheme-damaged | `cbv:Disp-damaged` | skos:closeMatch | the architecture seed section 6 |
| StockConditionScheme-expired | `cbv:Disp-expired` | skos:closeMatch | the architecture seed section 6 |
| QualityOutcomeScheme-pass | `cbv:Disp-conformant` | skos:closeMatch | a result of a check, not a disposition of stock: close only |
| QualityOutcomeScheme-fail | `cbv:Disp-non_conformant` | skos:closeMatch | as above |

`cbv:Disp-in_transit` (a transfer between sites) and `cbv:Disp-recalled` need no local concept until 09's transfer
and recall events need a disposition.

### 4.24 CostBasisScheme (Cost basis)

- Applies: one per cost observation.
- Closed: no.
- Concepts are categories of how a cost was arrived at. Including FIFO, LIFO and weighted average does not say Sutton
  supports them: Sutton public says only that its actual costing is label-level and similar to perpetual FIFO.
- Record field: none today. `ItemFields.unitCost` and `Vendor.unitCost` (Item.read.ts) state no basis (pending Q13).
  Later 07's `CostObservation.basis`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| actual | Actual | Actual cost | none | A cost basis in which the cost is built from what materials, labour and overhead actually cost. | Sutton public costing article; the architecture seed section 6 |
| standard | Standard | Standard cost | none | A cost basis in which the cost is a value set in advance and held until someone changes it. | Sutton public costing article (as the contrast); docs/glossary.md "Valuation" |
| specificIdentification | Label level | Specific identification | actual | An actual cost basis in which each label or lot carries the cost of what went into it. | Sutton public costing article ("label-level") |
| fifo | First in, first out | FIFO | actual | An actual cost basis in which units leaving stock take the cost of the oldest units still held. | the architecture seed section 6; docs/glossary.md |
| lifo | Last in, first out | LIFO | actual | An actual cost basis in which units leaving stock take the cost of the newest units held. | the architecture seed section 6 |
| weightedAverage | Weighted average | Average cost | actual | An actual cost basis in which every unit held takes the quantity-weighted mean of what the units cost. | the architecture seed section 6; docs/glossary.md "average" |
| stated | Stated | Given by the file | none | A cost basis in which a file or a person gave the cost and named no method, so how it was reached is unknown. | 07 (its Q2: the import's `unitCost`); pending decision 60, whose other answer is no basis at all (this document's Q13) |

The broader links say that FIFO, LIFO, weighted average and label level are ways of flowing actual cost through
stock; a standard cost has none of them. Physical picking order is not a cost basis (the architecture seed section
6: FIFO valuation is distinct from picking priority).

### 4.25 CostFinalityScheme (Cost finality)

- Applies: one per cost observation.
- Closed: yes (Sutton public names two; final is a process state, not a promise the value never changes).
- Concepts are phases of a cost observation.
- Record field: none today. Later 07's `CostObservation.finality`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| pending | Pending | Provisional | none | A cost finality in which the cost may still change because production behind it is not complete. | Sutton public costing article; the architecture seed 5.8 |
| final | Final | Final cost | none | A cost finality in which the cost is locked because the order that produced it is complete; it returns to pending if that order is reopened. | Sutton public costing article |

### 4.26 MachineStateScheme (Machine state): not proposed

Kept as a note for a reopened CQ-E05 (04, will-not); not in the scheme table above or the index.


- Applies: one per interval.
- Closed: no. Sutton public names Running, Idle, Stopped and Down; "Stopped" is not mapped (below).
- Concepts are categories of 09's `MachineStateInterval`, interpreted under a detector's definition; Running does not
  prove good output, and Unknown is never Running (the architecture seed 5.4; report 01 section 5).
- Record field: none in the repository. Later 09's `MachineStateInterval.state`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| running | Running | Uptime | none | A machine state in which the machine is operating under its detector's definition. | the architecture seed section 6; Sutton public machine monitoring page |
| setup | Setup | Changeover | none | A machine state in which the machine is being prepared for a job. | the architecture seed section 6 |
| idle | Idle | none | none | A machine state in which the machine is available and not operating, with no reason yet given. | the architecture seed section 6; Sutton public machine monitoring page |
| down | Down | Downtime | none | A machine state in which the machine is unavailable to operate. | Sutton public machine monitoring page |
| plannedDowntime | Planned downtime | Scheduled maintenance | down | A down machine state that was planned in advance. | the architecture seed section 6 |
| unplannedDowntime | Unplanned downtime | Breakdown | down | A down machine state that was not planned. | the architecture seed section 6 |
| unknown | Unknown | No signal | none | A machine state in which there is no reliable evidence of what the machine is doing. | the architecture seed section 6; report 01 section 5 |

Sutton public's "Stopped" (a stop the operator tags, or one the system makes while waiting on a job) could be idle or
down; it is left for a person to map from real intervals. The API design report's Uptime and Downtime are coarser
words, kept as altLabels; its Maintenance required and Retired are equipment statuses, not machine states, and are
left out.

### 4.27 AccountingSyncStateScheme (Accounting sync state) (pending Q12)

- Applies: one per sync record.
- Closed: no.
- Concepts are phases of 09's `AccountingSyncRecord`.
- Record field: none. Later 09's `AccountingSyncRecord.state`.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| pending | Waiting to send | Not synced | none | An accounting sync state in which the document is ready to send and has not been accepted by the accounting system. | NEW: report 01 section 4 (documents leave for QuickBooks or Xero) |
| synced | Sent | Synced | none | An accounting sync state in which the accounting system accepted the document as it stands now. | NEW: as above |
| failed | Refused | Sync error | none | An accounting sync state in which the accounting system refused the document and a person must act. | NEW: as above |
| changedSinceSync | Changed since sent | Out of date | none | An accounting sync state in which the document was accepted and then changed here, so the copy there is older. | NEW: the API design report (overridden invoice costs sync outward) |

### 4.28 CriticalTrackingEventScheme (Critical tracking event): not proposed

Kept as a note for a reopened CQ-E06 (04, will-not: no FSMA terms, the brief's no-gos); not in the scheme table
above or the index, and its property `criticalTrackingEvent` is not proposed either.


- Applies: one per event, only under the food traceability profile (the architecture seed 8.3 to 8.4: an
  applicability decision first; the starter fails closed for four of the seven).
- Closed: yes, as the rule lists them.
- Concepts are categories of an execution event, related to CBV steps but never equal to them.
- Record field: none. Later 09's event records under the FSMA overlay.

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| harvesting | Harvesting | none | none | A critical tracking event in which a covered food is harvested. | the architecture seed section 6, citing FDA's public FSMA 204 rule |
| cooling | Cooling | none | none | A critical tracking event in which a covered raw agricultural commodity is cooled before initial packing. | as above |
| initialPacking | Initial packing | none | none | A critical tracking event in which a covered raw agricultural commodity, other than food from a fishing vessel, is first packed. | as above |
| firstLandBasedReceiving | First land-based receiving | none | none | A critical tracking event in which food from a fishing vessel is first received on land. | as above |
| shipping | Shipping | none | none | A critical tracking event in which a covered food is sent from one location to another. | as above; 21 CFR 1.1340 as the seed cites it |
| receiving | Receiving | none | none | A critical tracking event in which a covered food is received at a location. | as above; 21 CFR 1.1345 |
| transformation | Transformation | Transforming | none | A critical tracking event in which a covered food is changed, combined or repacked into a new traceability lot. | as above; 21 CFR 1.1350 |

Candidate rows for 11: shipping and receiving `skos:relatedMatch` the CBV steps of the same name; initialPacking
`skos:relatedMatch cbv:BizStep-packing` (the architecture seed section 6). The API design report's
`exactMatch cbv:BizStep-shipping` is not followed: a regulatory event and a business step are different rule systems.

### 4.29 Schemes the party and access terms use (06)

Concepts and sources are 06's; each scheme is open unless it says closed.

AccountStatusScheme (applies: one per account organization; closed: no; record field: later 06's organization record):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| active | Active | none | none | An account status in which the tenant still trades with the organization. | Sutton public accounts article |
| archived | Archived | none | none | An account status in which the tenant has set the organization's record aside and keeps it only for past records. | Sutton public accounts article |

ContactPointKindScheme (one per contact point; closed: no):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| email | Email address | Email | none | A contact point kind for an address that electronic mail is sent to. | schema.org `email` (fetched by 06) |
| phone | Telephone number | Phone | none | A contact point kind for a number that a call or a text message reaches. | schema.org `telephone` (fetched by 06) |

IdentityOutcomeScheme (one per identity decision; closed: yes):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| sameParty | Same party | Merge | none | An identity outcome in which the two records are found to denote one party. | report 01 section 3; IBM MDM (collapse) |
| differentParties | Different parties | Not a duplicate | none | An identity outcome in which the two records are found to denote two parties. | IBM MDM (persistence) |

EvidenceKindScheme (several per decision or suspicion; closed: no):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| sharedIdentifier | Shared identifier | none | none | An evidence kind in which both records carry an identifier with one scheme and one value. | IBM MDM (identification as critical data) |
| similarName | Similar name | none | none | An evidence kind in which the two records' names differ by little, as a rule measures it. | IBM MDM (name as critical data) |
| sharedPostalAddress | Shared postal address | none | none | An evidence kind in which both records hold one postal address. | IBM MDM (address as critical data) |
| sharedContactPoint | Shared contact point | none | none | An evidence kind in which both records hold one email address or telephone number. | 06 |
| statementByParty | Statement by the party | none | none | An evidence kind in which the party itself said the two records are, or are not, one company. | 06 (NEW) |

MembershipStatusScheme (one per membership; closed: yes):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| invited | Invited | Pending | none | A membership status in which a person was asked to join a tenant and has not yet accepted. | Sutton public user accounts article (Pending) |
| active | Active | none | none | A membership status in which the person may act in the tenant's workspace. | the `member` table; Sutton public |
| suspended | Suspended | none | none | A membership status in which sign-in is blocked and the history is kept. | Sutton public user accounts article |
| removed | Removed | none | none | A membership status in which the membership ended and its row is kept so the audit trail still names it. | the `member` table (`removedAt`); docs/auth.md |

PortalModuleScheme (several per portal access; closed: no):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| items | Items | none | none | A portal module that shows the account the items it may order. | Sutton public portals article |
| salesOrders | Sales orders | none | none | A portal module that shows the account its sales orders and lets it request one. | Sutton public portals article |
| shipments | Shipments | none | none | A portal module that shows the account the shipments sent to it. | Sutton public portals article |
| manufacturingOrders | Manufacturing orders | none | none | A portal module that shows a contract manufacturer the manufacturing orders it works on. | Sutton public portals article |

ModelCallPurposeScheme (one per model call; closed: yes; record field: `ModelCallPurpose` in
`packages/access/contract/src/Allowance/ModelAllowance.gateway.ts`, and the `modelCall` table's `kind`). This document
first listed it among code lists with no scheme (section 5); 06 makes `ModelCall` a term, so its purpose is one:

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| view | Table request | none | none | A model call purpose in which the table assistant reads a request in words. | `ModelAllowance.gateway.ts` |
| check | Key check | none | none | A model call purpose in which the app checks that the model key works. | `ModelAllowance.gateway.ts` |
| suggest | Import suggestions | none | none | A model call purpose in which the app asks for proposals for the rows of an import. | `ModelAllowance.gateway.ts` |

### 4.30 Schemes the warehouse terms use (08)

PositionBasisScheme (one per stock position; closed: yes). The definitions are 08's:

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| book | Book | none | none | A position basis for a quantity worked out from the recorded receipts, movements, consumptions and adjustments. | 08 |
| counted | Counted | none | none | A position basis for a quantity that a stock count established. | 08 |
| reported | Reported | none | none | A position basis for a quantity that a source system or a file stated, kept as stated. | 08; the import's `quantityOnHand` |

AdjustmentReasonScheme (one per adjustment; closed: no):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| countDifference | Count difference | none | none | An adjustment reason in which a stock count found a quantity other than the book. | 08 |
| damage | Damage | none | none | An adjustment reason in which stock was harmed and taken out of the book. | 08 |
| writeOff | Write-off | none | none | An adjustment reason in which stock was declared lost or unusable for another stated cause. | 08 |
| found | Found | none | none | An adjustment reason in which stock no record explains was found and added to the book. | 08 |

The tracking codes 08 names (lot code, label barcode, serial number, SSCC, traceability lot code) are concepts of
`IdentifierKindScheme` (4.10): `lotCode` (with the altLabel Traceability lot code), `labelCode`, `serialNumber`, `sscc`.
A count kind and a reservation status are not designed: no question needs them yet.

### 4.31 Schemes the commitment and event terms use (09)

HoldReasonScheme (one per hold; closed: no; NEW concepts, each from a case another document names):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| awaitingCertificate | Awaiting certificate | Certificate of analysis pending | none | A hold reason in which the stock waits for a document from its vendor that says it meets its specification. | 08 (worked example) |
| failedInspection | Failed inspection | none | none | A hold reason in which a quality check found the stock did not meet its criteria. | 08 (`heldAfterInspection`); 09 (`QualityInspection`) |
| recall | Recall | none | none | A hold reason in which a recall questions the material the stock is made of. | this document, 4.19; 09 (`RecallCase`) |

ReceivingRejectReasonScheme (one per rejection; closed: no; a tenant adds its own):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| damagedPackaging | Damaged packaging | Packaging was damaged | none | A reject reason in which the goods arrived with their packaging harmed. | Sutton public receiving article (as 4.19 reads it) |

MachineStopReasonScheme: not proposed (machine telemetry is will-not); it would be each tenant's own list, which no
public source names.

AccountingSyncDirectionScheme (one per sync record; closed: yes):

| Notation | prefLabel | altLabels | broader | Definition | Source |
| --- | --- | --- | --- | --- | --- |
| toAccounting | To accounting | Outbound | none | A sync direction in which a document is sent from the tenant to the accounting system. | the architecture seed 2.1 |
| fromAccounting | From accounting | Inbound | none | A sync direction in which a document is read from the accounting system into the tenant's records. | the architecture seed 2.1 |

## 5. Repository code lists that get no scheme

| Code list | Where | Why no scheme |
| --- | --- | --- |
| `ItemSortColumn`, `ItemFilterColumn`, `FilterOperator`, `FilterVariant`, `joinOperator` | Item/ItemQuery.command.ts | how a table is viewed, not a fact about the business |
| `ColumnType`, `ViewOperator`, `ViewChangeKind`, `direction`, `what` | Assistant/View.read.ts | the table assistant's request shape |
| `FileProblemKind`, `Staged` `level` and `kind` (csv, xlsx) | Staging/*.read.ts | file reading mechanics; a reason a person reads is text |
| `Confidence`, `MatchHow`, `SuggestionKind`, `SuggestionByKind`, `DecidedByKind` | Import/Change.read.ts, Mapping.read.ts, Suggestion.read.ts, Import.read.ts | the review's working state; `ValueChangeSourceScheme` and `ValueChangeMethodScheme` carry what is stored |
| `RowPlaceKind`, `StoredChoiceKind`, `TakenBackKind`, `stored` (keep, replace) | Import/Decision.command.ts | commands of the review, owned by the Alchemy model |
| `UploadDiscardKind`, `AiTrouble`, `AiProvider`, `AllowanceAnswerKind` | Staging, Answer, Allowance | runtime and quota mechanics (`ModelCallPurpose` has a scheme now, 4.29) |
| `SessionStatus`, `SignUpOffer`, `AddPersonProblemKind` | access contract | sign-in mechanics |
| `tags` | Item.read.ts | a folksonomy a person types (`gist:Tag`), open and per tenant; 07 decides whether tags are terms at all |
| The API design report's shop floor status, pick method, target industry, equipment status, deal stage; the architecture seed's industry profile | the seeds | no record and no competency question here needs them yet: later |

## 6. Properties

Each property points a record at a concept of one scheme. Ranges are written "skos:Concept in <Scheme>" rather than a
class key, because a scheme is not a class (pending Q2); the record schema's SHACL (`sh:in` over the scheme's
notations, or `skos:inScheme`) does the checking, and OWL states no range (anti-pattern 10). Each is proposed as a
sub-property of `gist:isCategorizedBy` (pending Q3). One direction only.

| Key | Label | Definition | Domain | Range | Source |
| --- | --- | --- | --- | --- | --- |
| lifecycleState | lifecycle state | The relation from a record to the phase it is in on its own lifecycle. | none: used on items, labels, orders and imports; each record's SHACL names the scheme | skos:Concept in ItemLifecycleScheme, LabelLifecycleScheme, OrderLifecycleScheme or ImportLifecycleScheme | Item.read.ts `stocking`; Import.read.ts `status`; the architecture seed section 6 |
| hasDimension | has dimension | The relation from a unit of measure to the kind of amount it measures. | UnitOfMeasure (07) | skos:Concept in MeasurementDimensionScheme | NEW: the conversion rule (the architecture seed 7.3) |
| fulfilmentProgress | fulfilment progress | The relation from an order to how much of its quantity has been delivered against it. | `gist:Intention`: 09's orders (kept broad) | skos:Concept in FulfilmentProgressScheme | the architecture seed 5.5, 5.6 |
| paymentProgress | payment progress | The relation from an order to how much of its amount is recorded as paid. | `gist:Intention`: 09's orders | skos:Concept in PaymentProgressScheme | Sutton public SO article |
| invoicingProgress | invoicing progress | The relation from an order to how much of it has been invoiced. | `gist:Intention`: 09's orders | skos:Concept in InvoicingProgressScheme | Sutton public SO article |
| qualityDisposition | quality disposition | The relation from stock to the quality decision a source or a person stated for it. | none declared: 08's `InventoryLabel`, `MaterialLot` and `SerialUnit`, the stock itself; never `StockPosition` | skos:Concept in QualityDispositionScheme | the architecture seed section 6 |
| stockCondition | stock condition | The relation from stock to a physical state observed in it. | none declared: as `qualityDisposition` | skos:Concept in StockConditionScheme | the architecture seed section 6 |

If 06, 07, 08 or 09 name one of these relations under another key, theirs wins and this row is dropped; the key
and the scheme it points at are what must agree. Dropped on 2026-11-22 for that reason (report 13): `itemRole`,
`itemCategory`, `trackingMethod`, `costBasis`, `costFinality` (07's, the same keys); `measureKind` (08's);
`contactPurpose` (06's `servesPurpose`), `identifierScheme` (07's `identifierKind`), `scopeKind` (06's `grantScope`),
`memberRole` (06's `grantsRole`); `reviewOutcome`, `businessStep`, `machineState` (09's, the same keys),
`resultOutcome` (09's `outcomeKind`), `changeSource` (09's `proposedBy`), `changeMethod` (09's `changeHow`),
`qualityResult` (09's `inspectionOutcome`), `syncState` (09's `syncOutcome`). `lifecycleState` stays here as the one
key for every lifecycle; 07's and 09's rows of the same key point to it.

## 7. How it looks in the vocabulary module (sketch, not code)

```ts
// sketch, not code: one scheme in 05's shapes (section 4.4): the concepts are a tuple, each with its notation
export const schemes = defineSchemes({
  UnitOfMeasureCodeScheme: {
    prefLabel: "Unit of measure code",
    definition: "A controlled vocabulary of the units an item's quantities and sizes are written in, ...",
    closed: false,
    concepts: [
      { notation: "EA", prefLabel: "Each", altLabels: ["each", "piece"],
        definition: "A unit of measure of count that ...", alsoInstanceOf: "UnitOfMeasure",
        links: { hasDimension: { kind: "concept", scheme: "MeasurementDimensionScheme", notation: "count" } } },
      { notation: "BX", prefLabel: "Box", altLabels: ["box", "bx"], definition: "...",
        alsoInstanceOf: "PackagingUnit" },
      { notation: "cm", prefLabel: "Centimetre", altLabels: ["centimeter"], definition: "..." },
    ],
  },
})
// sketch, not code: the record keeps its own literals (decision 2) and points at the scheme with 05's helper
export const Uom = S.Literals(["EA", "BX", "KG", "M", "L"]).pipe(
  S.annotate({ ...aboutScheme("inv:UnitOfMeasureCodeScheme") })
)
// gate 4 (05's V12): every literal of a schema that points at a scheme is one of that scheme's notations
```

```turtle
# sketch, not code: what the projector would write for one concept (pending Q1, Q3)
inv:UnitOfMeasureCodeScheme-BX a skos:Concept ;
  skos:inScheme inv:UnitOfMeasureCodeScheme ; skos:topConceptOf inv:UnitOfMeasureCodeScheme ;
  skos:notation "BX" ; skos:prefLabel "Box"@en ; skos:altLabel "box"@en, "bx"@en ;
  skos:definition "A unit of measure of count that counts boxes, ..."@en ;
  inv:hasDimension inv:MeasurementDimensionScheme-count .
inv:QualityDispositionScheme-rejected skos:broader inv:QualityDispositionScheme-onHold .
```

## 8. Anti-pattern review

| Anti-pattern | Found | What this design does |
| --- | --- | --- |
| 6 Quality-as-class, enum-is-taxonomy | Every code list here is a candidate | SKOS schemes; only item kind is classes, with its reason (section 4.2) |
| 9 Polysemy | The seed's disposition scheme mixes decisions with observations; Sutton's label status mixes lifecycle with disposition; the seed's valuation scheme mixes basis with flow; two `RowStatus` notation sets | Split (pending Q8); `CostBasisScheme` with broader links; one notation set (4.13) |
| State-is-kind | Item, label, order, import and machine states | Concepts on `lifecycleState` and `machineState`; no state subclass |
| Role-is-kind | Item roles, party roles, member roles | Concepts or flags, no role classes, no disjointness |
| Hierarchy for overlap | The API design report's inventory states under In stock | No broader; inclusion as scope notes (4.21) |
| 10 Domain/range overcommitment | Concept-valued properties | No OWL range; SHACL from the record |
| 13 False is-a | MemberRoleScheme rank, BX and EA | Rank is a rule in `hasRole`; a pack size is an item conversion |
| `exactMatch` overreach | The seed's CTE to CBV, the report's shipping CTE | relatedMatch only; exactMatch only for the business steps whose meanings coincide |

## Questions for Benjamin

Moved on 2026-11-22 to the packet's [DECISIONS.md](../DECISIONS.md), "Open", merged with the other reports'
questions. A "(pending Qn)" mark in this report means: Q1 is decision 10, Q2 is 23, Q3 is 17, Q4 is 58, Q5 is 57,
Q6 is 65, Q7 is 47, Q8 is 78, Q9 is 82, Q10 is 63, Q11 is 73, Q12 is 86, Q13 is 60, Q14 is 35, Q15 is 56.

## Not checked

- No term here went through the foundational auditor and none is ratified; the conceptualizer's input rule says it
  should work from ratified terms only, so this is a proposal list for the auditor, not a conceptual model.
- Nothing was built or run: no vocabulary module, projector, Turtle, SHACL, check or competency question.
  `bun run docs:check` passed with this file in place (2026-11-22); that checks frontmatter, not content.
- The other eight documents (04 to 09, 11, 12) were being written at the same time and were not read by this
  report's author; the keys were matched with them on 2026-11-22 (report 13), which renamed every scheme key, added
  thirteen schemes from 06, 08 and 09, and dropped eighteen property rows whose keys the term documents own. The
  concepts added in 4.29 to 4.31 were not checked against any Sutton page beyond what 06, 08 and 09 cite.
- Sutton's public pages were read through a fetch that returned a summary, not the page text: the items, tracking,
  inventory, costing, purchase order, sales order, manufacturing order, receiving, quality check and user accounts
  help articles and the machine monitoring feature page. Location permissions and custom roles were not found in the
  user accounts article and rest on report 01. No Sutton page on accounting sync states, quotes, deals or transfer
  order statuses was read. Sutton's GraphQL enums were not seen.
- The CBV 2.0.0 ontology file's `BizStep-` and `Disp-` names were read through the same kind of fetch, not with a
  parser. No QUDT unit IRI and no UN/CEFACT Rec 20 code was checked.
- FDA's FSMA 204 rule was not read; its seven events are as the architecture seed lists them.
- gist 14.1.0 was not opened here: `gist:ControlledVocabulary`, `gist:Category`, `gist:ProductCategory`,
  `gist:Tag`, `gist:Aspect`, `gist:UnitOfMeasure`, `gist:ReferenceValue`, `gist:ID` and `gist:isCategorizedBy` are
  named because `gist-categories.md` lists them; whether `gist:isCategorizedBy` has a range that would type every
  concept as `gist:Category` was not looked up.
- The review region's and the import's screens were not looked at; the words are read from the code only. Where
  "Imported" and "Taken back" are spelled elsewhere in `packages/catalog/web` beyond `format.tsx` and
  `PastImports.screen.tsx` was not searched in full.
- The sample counts were made with a throwaway pandas read of both CSV files; the "Internal Notes" column was read
  (20 rows say "check w/ purchasing", nothing that decides a code list).
