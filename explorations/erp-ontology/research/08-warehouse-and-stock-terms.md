---
type: Research
title: Warehouse and stock terms
description: Warehouse and stock terms, their gist parents and identities, measure arithmetic and a worked example.
---

# Warehouse and stock terms

A design to argue with, written with the `ontology-conceptualizer` skill for the `explorations/erp-ontology` packet. No
term here is ratified: the packet holds no `rat-` record yet, so every row is a proposal that goes through the
`ontology-foundational-auditor` and Benjamin before the `ontology-architect` turns it into a vocabulary-module diff.
Nothing in it is built: no vocabulary module, no projector, no generated Turtle, no SHACL, no competency-question suite.

Scope: where stock is (sites, warehouses, locations, bins, work centers), what the stock physically is (lots, labels,
serial units, containers, logistic units, and the codes on them), what is said about it (stock positions and inventory
measures), and what changes or restricts it (reservations, quality holds, movements, label splits, counts and
adjustments). Item specifications, quantities and units belong to 07, parties to 06, orders and execution events to
09, the SKOS schemes to 10, the gist projection and alignments to 11, the checks to 12. A term owned there is named by
its key and owner. The keys were matched with the other eight documents on 2026-11-22 (report 13); open choices are
numbered decisions in [DECISIONS.md](../DECISIONS.md), mapped from each Qn here under "Questions for Benjamin".

Two seeds feed this document: the architecture seed and the API design report. Where they disagree this document
follows report 01, section 5 (the architecture seed). Sutton facts are from Sutton's public documents only, as the
architecture seed's source register cites them (S08, S09 and so on); none was fetched again for this document.

## 1. The three distinctions this area keeps

| Distinction | The two sides | Rule here | Mistake it prevents |
| --- | --- | --- | --- |
| Specification against stock | `ItemSpecification` (07) says what a kind of good is; `MaterialLot`, `InventoryLabel`, `SerialUnit` are the goods | Stock links to its specification with `gist:conformsTo`; a stock number is a statement about stock (`StockPosition`), never a field of the specification's meaning | Report 01 section 1: "a CSV column `sku` is not the class `Item`"; the repository's `quantityOnHand` sits on the item record today (Q9) |
| Lot against label against serial unit | A lot is the material of one batch; a label is a marked portion of it; a serial unit is one countable object | Three kinds, pairwise disjoint, each with its own identity; a label that covers one unit is not thereby a serial unit | The architecture seed: "a lot versus a label; a label versus a unit serial"; Sutton's serialized tracking "can identify a batch, pallet, partial quantity, or individual item" (S08, public) |
| Measure against status | On hand, on hold, reserved, committed, available, in transit and incoming are quantities that overlap | Separate measures on one stock position, related by the arithmetic of section 5; never one status enum per balance | The API design report's `hasInventoryState` (1..1) per balance, which sums to more stock than exists |

## 2. The terms

Keys are the IRI local names under `inv:` (`https://example.org/inventory-import/ontology/`, the placeholder of decision
7). The SKOS concept rows (tag category) are keyed `<SchemeKey>-<notation>`, the form decision 10 recommends; 10 holds
their scheme, notation, label and alternative labels, and this document holds their definitions and their arithmetic,
which 10's rows point to. The notations are 10's: this document first wrote `OnHold` for 10's `quarantined` and
`Incoming` for 10's `acquired` (prefLabel Acquired, altLabel Incoming), and 10 gains `inTransit` and the position
bases from here.

### Places

| Key | Label | Definition | Tag | gist parent | Identity | Source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Location` | Location | A place that an organization designates for keeping, moving or working on material, and that sits within at most one larger place it designates. | kind | `gist:GeoLocation` (pending Q1) | The place as the organization designates it: the same location while its designation and parent stand, whatever its code or name becomes; a record reidentifies it by tenant and source id, never by its code or name | The architecture seed, section 5.2 (`Location`, "may be logical"); public Sutton document "Bin tracking: choosing how your organization manages inventory locations" (S20) | Sutton only |
| `Site` | Site | A location at the top of an organization's location hierarchy that gathers what the organization, or a contract manufacturer for it, operates at one address. | subkind | `gist:GeoLocation`, through `Location` (pending Q1, Q2) | As `Location` | The architecture seed, section 5.2 (`Site`); the API design report (`WarehouseSite`, "owned or contractor-operated") | Sutton only |
| `Warehouse` | Warehouse | A location within a site where stock is received, stored and shipped. | subkind | `gist:GeoLocation`, through `Location` (pending Q1, Q2) | As `Location` | The architecture seed, section 5.2 (`Warehouse`); `docs/glossary.md` ("Warehouse, bin") | Sutton only |
| `Bin` | Bin | A location within a warehouse that is the smallest slot stock is put away in, picked from and counted by. | subkind | `gist:GeoLocation`, through `Location` (pending Q1, Q2) | Inherited from `Location` | The architecture seed, section 5.2 (`Bin`, "codes are scoped to their containing location"); public Sutton document S20 (bins are optional by policy) | Sutton only |

A bin's code is an identifier scoped to its parent location, so two warehouses may each have a bin "A-01" (the
architecture seed: "codes are scoped to their containing location"). That is a scope note on the bin's code, an
identifier the tenant issues, never the bin's identity, which `Bin` inherits from `Location` (05's V17).

A work center is 07's `WorkCenter` (under `gist:Collection`, pending Q3); this document keeps only `sitedAt`, from
the work center to the location where its production takes place, and the answer that a work center is not a place.

### Physical stock and its codes

| Key | Label | Definition | Tag | gist parent | Identity | Source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Machine` | Machine | A piece of equipment that performs production operations and whose running state a detector or an operator records over time. | kind | `gist:Equipment` | The machine itself, from installation to disposal, whatever work center it is grouped in; a record reidentifies it by tenant and source id, never by its name | The architecture seed, section 5.4 (a machine is not a work center or a bin); 11, table A (`gist:Equipment`); NEW as a row: 09 ranges `usesMachine`, `stateOf` and `readFrom` over it and no document defined it | Sutton only |
| `MaterialLot` | Material lot | A physical amount of material of one item specification that its issuer made or received as one batch and gave one lot code, tracked as one through every split and move. | kind | `gist:PhysicalSubstance` (pending Q4) | The batch its issuer made or assigned the code to, for one item specification (pending Q10): two suppliers that both print "L-221" have two lots; one lot under the supplier's code and ours is one lot. Never the code text alone | The architecture seed, section 5.2 ("a material grouping with lot identity and genealogy"; "its code alone is not globally unique"); `docs/glossary.md` ("Lot (batch)"); `packages/catalog/contract/src/Item/Item.read.ts` (`lotTracked`, the only lot fact recorded today) | Sutton only |
| `InventoryLabel` | Inventory label | A portion of the stock of one item specification, of at most one lot, that the organization marks with one label code so it can be moved, split, held and counted as one. | kind | `gist:PhysicalSubstance` (pending Q5) | The labelling that designated it: the same label while any material remains under its code, though a split makes it smaller; the portion split off is a new label | The architecture seed, section 5.2 (`InventoryLabel`, "may cover multiple units"); public Sutton document "When to use standard vs serialized inventory tracking" (S08); report 01, section 1 (the label row is a record of this referent) | Sutton only |
| `SerialUnit` | Serial unit | A discrete physical unit of one item specification that carries a serial number confirmed to name that unit alone. | kind | `gist:PhysicalIdentifiableItem` | The unit itself, from making to scrapping; a record reidentifies it by serial number within its issuer and item specification. A label that covers one unit is not thereby a serial unit | The architecture seed, section 5.2 ("only when verified"); the API design report (`SerializedUnit`); `docs/glossary.md` ("serial number") | Sutton only |
| `Container` | Container | A physical object made to hold or carry material, such as a pallet base, tote, drum or box, reusable or used once. | kind | `gist:PhysicalIdentifiableItem` | The object itself, from making to disposal; its asset tag, when it has one, reidentifies it | The architecture seed, section 5.2 (`Container`: "do not equate it with a lot, label, bin or aggregation event") | later |
| `LogisticUnit` | Logistic unit | A physical unit built for handling, storing or shipping, such as a loaded pallet or a packed case, whose contents may change while it stays the same unit. | kind | `gist:PhysicalIdentifiableItem` | The build that made it, kept by its assigned code (an SSCC when GS1 is used) while its contents change; never its contents | The architecture seed, sections 5.2 and 7.1 ("content changes over time"); public Sutton documents "GS1-128 barcodes in Sutton" (S35) and the November 10, 2026 release (S12, container operations) | Sutton only |
| `TrackingCode` | Tracking code | An identifier that one organization assigns, in one coding scheme, to a lot, a label, a serial unit or a logistic unit. | information | `gist:ID` | Its text, its scheme and the organization that assigned it: the same text from two issuers is two codes | NEW: keeps a lot apart from the code printed on it (two suppliers print "L-221"), and holds lot codes, label barcodes, serial numbers, SSCCs and traceability lot codes in one place; the architecture seed, section 7.1 (identifiers resolved before an EPCIS export) | Sutton only |

### What is said about stock

| Key | Label | Definition | Tag | gist parent | Identity | Source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `StockPosition` | Stock position | A statement of how much material of one item specification is at one location, narrowed optionally to a lot, a label, a serial unit or a logistic unit, as of one instant and on one basis. | information | `gist:Content` | Its scope (item specification, location and each narrowing), its instant, its basis and, for a counted or reported position, what stated it (`determinedByCount`, `reportedIn`): two statements alike in all of these are one, so a file's and Sutton's reported on-hand for one scope and instant are two positions | The architecture seed, section 5.2 ("an observed item/lot/label/location scope"); `packages/catalog/contract/src/Item/Item.read.ts` (`quantityOnHand`: a position flattened onto the item, pending Q9) | Sutton only |
| `InventoryMeasure` | Inventory measure | A statement within one stock position that gives one kind of inventory quantity and points at the quantity it gives. | information | `gist:Content` (pending Q7) | Its position and its kind: a position has at most one measure of each kind; the number and unit belong to the 07 `QuantityValue` it reaches by `hasQuantity`, never to the measure | The architecture seed, section 5.2 ("a qualified quantity meaning at that position and time"); `packages/catalog/contract/src/Item/Item.read.ts` (`quantityOnHand`) | in the repository today |
| `InventoryMeasureKindScheme-onHand` | On hand | A measure kind for the quantity physically present in a position's scope at its instant, whatever holds or reservations lie on it. | category | none: a concept of 10's `InventoryMeasureKindScheme`, not a class | n/a | `docs/glossary.md` ("On hand"); `packages/catalog/contract/src/Item/Item.read.ts` (`quantityOnHand`, "How many are in stock"); public Sutton document "Inventory key features" (S09, "In stock") | in the repository today |
| `InventoryMeasureKindScheme-quarantined` | Quarantined | A measure kind for the part of the on-hand quantity that at least one quality hold in force covers. | category | none: a SKOS concept, as above | n/a | `docs/glossary.md` ("Quarantine (on hold)": "counted as available" is the mistake); public Sutton document S09 ("Quarantined") | Sutton only |
| `InventoryMeasureKindScheme-reserved` | Reserved | A measure kind for the part of the usable on-hand quantity that inventory reservations in force set aside. | category | none: a SKOS concept, as above | n/a | The architecture seed, section 5.2; public Sutton document S09 ("Reserved") | Sutton only |
| `InventoryMeasureKindScheme-committed` | Committed | A measure kind for the quantity that open commitment lines for the item still require at a position's site, reserved or not, before it is consumed or shipped. | category | none: a SKOS concept, as above | n/a | `docs/glossary.md` ("committed": "subtracted twice" is the mistake); public Sutton document S09 ("Committed") | Sutton only |
| `InventoryMeasureKindScheme-available` | Available | A measure kind for what remains of the on-hand quantity after held, committed and reserved quantities are each taken away once, by a named availability rule. | category | none: a SKOS concept, as above | n/a | `docs/glossary.md` ("available ... usually calculated"); the architecture seed, sections 5.3 and 6 ("compute only from a verified source formula"); public Sutton document S09 ("Available") | Sutton only |
| `InventoryMeasureKindScheme-inTransit` | In transit | A measure kind for quantity that a stock movement has dispatched toward a position's site and that has not yet arrived. | category | none: a SKOS concept, as above | n/a | `docs/glossary.md` ("Transfer, in transit": "counted at both ends, or at neither"); the API design report (`TransferOrder`) | later |
| `InventoryMeasureKindScheme-acquired` | Acquired | A measure kind for quantity expected from open purchase or manufacturing orders and not yet received. | category | none: a SKOS concept, as above | n/a | `docs/glossary.md` ("Incoming (on order)": "added into on hand" is the mistake); public Sutton document S09 ("Acquired"); the API design report (`Acquired`: "incoming stock ... via open Purchase Orders or in-flight Manufacturing Orders") | Sutton only |
| `PositionBasisScheme-book` | Book | A position basis for a quantity worked out from the recorded receipts, movements, consumptions and adjustments. | category | none: a concept of 10's `PositionBasisScheme` | n/a | NEW: a book quantity and a counted one for the same scope and instant are two statements, never one | later |
| `PositionBasisScheme-counted` | Counted | A position basis for a quantity that a stock count established. | category | none: a SKOS concept, as above | n/a | NEW: `docs/glossary.md` ("Stock count": "counts from different days taken as one") | later |
| `PositionBasisScheme-reported` | Reported | A position basis for a quantity that a source system or a file stated, kept as stated and not worked out again. | category | none: a SKOS concept, as above | n/a | NEW: the architecture seed, section 6 (an available quantity is the source's, from its formula); the import's `quantityOnHand` is a reported position (Q9) | in the repository today |

### What changes or restricts stock

| Key | Label | Definition | Tag | gist parent | Identity | Source | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `InventoryReservation` | Inventory reservation | A commitment by the organization to keep a quantity of usable stock at a scope for one demand line, until the stock is consumed, the reservation released or its time runs out. | relator | `gist:Commitment` | The act of setting aside: one reservation per such act, which stays the same reservation while its quantity is drawn down; two reservations of the same 10 kg for two lines are two (and the second is refused when stock does not cover both) | The architecture seed, section 5.2 ("an allocation/commitment record, not an intrinsic item property"); public Sutton document "Sales orders key features" (S30, reservations) | Sutton only |
| `QualityHold` | Quality hold | A restriction in force over an interval that keeps the stock in its scope from being used, shipped or reserved, for a stated reason, until someone releases it. | information | `gist:Restriction` (pending Q8: gist's "description of things one is prevented from doing"; this document first wrote `gist:Event`, then `gist:Intention`) | The decision that placed it: one hold per placing, whatever scope it covers; a release ends it and it is never reused | The architecture seed, section 5.7 ("a hold scope and reason with lifecycle; not a universal item status"); public Sutton documents "Receiving key features" (S27, quarantine) and "Logging quality checks on manufacturing orders" (S28); 09 (its `HoldPlacement` and `HoldRelease` begin and end it) | Sutton only |
| `StockMovement` | Stock movement | An event in which material is taken from one of the organization's locations and put at another, with its lot and labels unchanged. | event | `gist:Event` | Tenant and source id: one dispatch and its arrival are one movement | NEW: needed by the worked example and by `inTransit`; `docs/glossary.md` ("Transfer, in transit"); the API design report (`TransferOrder`, barcode transfers) | Sutton only |
| `LabelSplit` | Label split | An event in which part of a label's material is put under a new label code and the rest stays under the old one, with the lot unchanged. | event | `gist:Event` | Tenant and source id | The architecture seed, section 5.2 (`splitFromLabel`: "same material lot may persist"); public Sutton documents S08 (splitting a label) and the November 10, 2026 release (S12, label history) | Sutton only |
| `StockCount` | Stock count | A determination in which people count the material at a set of locations or labels and record what they found as of one instant. | event | `gist:Determination` | Tenant and source id | `docs/glossary.md` ("Stock count"); `.agents/skills/_shared/gist-categories.md` ("A cycle count" is its example of `gist:Determination`) | later |
| `InventoryAdjustment` | Inventory adjustment | An event that changes a book quantity at a scope by a signed amount, for a stated reason that no recorded receipt, movement or consumption explains. | event | `gist:Event` | Tenant and source id | The API design report ("Inventory adjustments" among Sutton's API workflows); the architecture seed's quantity shape ("availability or accounting adjustment quantities can be negative"); `docs/glossary.md` ("Negative stock") | Sutton only |

Two overlaps with 07, settled on 2026-11-22 (report 13). `WorkCenter` is 07's, and this document's part is only
whether a work center is a place (Q3) and the `sitedAt` link. 07's `ItemIdentifier` is the item-side sibling of
`TrackingCode`; both are `gist:ID`, and both are reached by 07's `identifiedBy`, read by `identifierText`, sorted by
`identifierKind` (a concept of 10's `IdentifierKindScheme`: `lotCode`, `labelCode`, `serialNumber`, `sscc`) and given
an issuer by `issuedBy`, instead of gist's `isIdentifiedBy`, `idText` and `isAllocatedBy` used directly.

"Cycle count" is an alternative label of `StockCount`; whether a count is a cycle, full or spot count would be a concept
of a count-kind scheme, not a subclass; none is designed until a question needs one. "Quarantined" as a Sutton label
status is not a phase of the label here: it is read as "a quality hold in force covers this label". "Depleted" is read
as "the label's book on-hand quantity is zero". Both are derived, so the label lifecycle scheme in 10 records the
source's word and maps it, rather than stating a second home for the fact.

## 3. The properties

One direction each; the reverse is a SPARQL `^p` path. Where a range is a class owned elsewhere, the owner is named.
Domains stay broad (anti-pattern 10): a property shared by several scoped records states no domain, and the record
schema constrains it.

| Key | Label | Definition | Domain | Range | Source |
| --- | --- | --- | --- | --- | --- |
| `hasParentLocation` | parent location | The location that immediately contains this one. | `Location` | `Location` | The architecture seed (`parentLocation`, "no inverse or transitive property axiom") |
| `operatedBy` | operated by | The organization that runs a site day to day: the tenant itself, or a contract manufacturer for it. | `Site` | `Organization` (06) | The API design report (`isContractorSite`) |
| `sitedAt` | sited at | The location where a work center's production takes place. | `WorkCenter` | `Location` | The architecture seed, section 5.2 |
| `originatedIn` | originated in | The receipt or production run in which a lot's material was made or first received under its code. | `MaterialLot` | `gist:Event` (09's `Receipt` and `TransformationEvent` fall under it) | NEW: carries the lot's identity criterion (pending Q10) |
| `portionOfLot` | portion of lot | The lot whose material a label covers. | `InventoryLabel` | `MaterialLot` | The architecture seed (`forLot` on a label); the API design report (`tracksLot`, 0..1) |
| `unitOfLot` | unit of lot | The lot a serial unit was made or received in. | `SerialUnit` | `MaterialLot` | The API design report (`InventoryLot & SerializedUnit`) |
| `builtOnContainer` | built on container | The container a logistic unit is built on, such as the pallet base under a load. | `LogisticUnit` | `Container` | NEW: keeps the wooden pallet apart from the load it carries |
| `expiresOn` | expires on | The last day a lot may be used, as its issuer states it. | `MaterialLot` | datatype from the record field | The API design report (`expirationDate`); `docs/glossary.md` ("Expiry date") |
| `forItem` | for item | The item specification a stock position, reservation, hold, count, adjustment, movement or event line (09) is about. | none: shared by `StockPosition`, `InventoryReservation`, `QualityHold`, `StockCount`, `InventoryAdjustment`, `StockMovement` and 09's `EventLine` (its `involvesItem` folded into this); each record schema constrains it | `ItemSpecification` (07) | The architecture seed (`forItem`) |
| `atLocation` | at location | The location a stock position, reservation, hold, count or adjustment is scoped to. | none: shared, as `forItem` | `Location` | The architecture seed (`atLocation`) |
| `forLot` | for lot | The lot a stock position, reservation, hold, count, adjustment or event line (09) is narrowed to. | none: shared, as `forItem` | `MaterialLot` | The architecture seed (`forLot`) |
| `forLabel` | for label | The label a stock position, reservation, hold, count, adjustment, movement or event line (09) is narrowed to. | none: shared, as `forItem` | `InventoryLabel` | The architecture seed (`forLabel`) |
| `forSerialUnit` | for serial unit | The serial unit a stock position, hold, movement or event line (09) is narrowed to. | none: shared, as `forItem` | `SerialUnit` | The architecture seed (`forSerialUnit`) |
| `inLogisticUnit` | in logistic unit | The logistic unit a stock position's material was in at the position's instant. | `StockPosition` | `LogisticUnit` | NEW: containment as of an instant, read from 09's aggregation events, never from today's contents (the architecture seed, section 7.1) |
| `asOf` | as of | The instant a stock position states its quantities for. | `StockPosition` | datatype from the record field | The architecture seed (`observedAt`) |
| `positionBasis` | position basis | How a stock position's quantities were obtained: worked out from the book, counted, or reported. | `StockPosition` | a concept of `PositionBasisScheme` (10): `book`, `counted` or `reported` | NEW |
| `determinedByCount` | determined by count | The stock count whose finding a counted stock position records. | `StockPosition` | `StockCount` | NEW |
| `reportedIn` | reported in | The source record or import confirmation in which a source stated a reported stock position. | `StockPosition` | none declared: 04's `SourceRecord` or 09's `ImportConfirmation` (kept broad) | NEW: part of a reported position's identity, so two sources' figures for one scope and instant stay two positions |
| `workedOutFrom` | worked out from | An event or commitment line whose quantity a book stock position's figures were worked out from. | `StockPosition` | none declared: 09's receipts, movements, consumptions and lines, and this document's adjustments (kept broad) | NEW: CQ-K03 asks whether an on-hand figure rests only on an open purchase order line |
| `hasMeasure` | has measure | One measure that a stock position gives. | `StockPosition` | `InventoryMeasure` | The architecture seed (`hasInventoryMeasure`) |
| `measureKind` | measure kind | Which inventory quantity a measure gives. | `InventoryMeasure` | a concept of `InventoryMeasureKindScheme` (10) | The architecture seed (`measureKind`) |
| `availabilityRule` | availability rule | The named, versioned rule an available measure was worked out by. | `InventoryMeasure` | datatype from the record field | The architecture seed, section 5.3 ("store ... source availability formula versions") |
| `reservesFor` | reserves for | The demand line a reservation keeps stock for. | `InventoryReservation` | `gist:Commitment` (09's order and requirement lines fall under it) | The architecture seed, section 5.2; the API design report (`allocatedInventory`) |
| `reservedUntil` | reserved until | The instant a reservation lapses if it has not been consumed or released. | `InventoryReservation` | datatype from the record field | NEW: the third way a reservation ends |
| `drawsOnReservation` | draws on reservation | The reservation that a consumption of stock uses up, wholly or in part. | `EventLine` (09): a consumed or shipped line | `InventoryReservation` | NEW: keeps reservation and consumption apart (section 6) |
| `heldAfterInspection` | held after inspection | The quality inspection whose result led to a hold. | `QualityHold` | `QualityInspection` (09) | The architecture seed, section 5.7 |
| `underTransferOrder` | under transfer order | The transfer order a stock movement carries out. | `StockMovement` | `TransferOrder` (09) | The API design report (`TransferOrder`) |
| `arrivedAt` | arrived at | The instant moved material reached its destination; absent while it is in transit. | `StockMovement` | datatype from the record field | NEW: `inTransit` is the quantity between dispatch and arrival |
| `splitSource` | split source | The label a split took material from. | `LabelSplit` | `InventoryLabel` | The architecture seed (`splitFromLabel`) |
| `splitResult` | split result | A new label that a split put material under. | `LabelSplit` | `InventoryLabel` | The architecture seed (`splitFromLabel`) |
| `adjustmentReason` | adjustment reason | Why an adjustment was made: a count difference, damage, a write-off or material found. | `InventoryAdjustment` | a concept of `AdjustmentReasonScheme` (10) | NEW |
| `settlesCount` | settles count | The stock count whose difference from the book an adjustment puts right. | `InventoryAdjustment` | `StockCount` | NEW |

Used here and owned elsewhere since the 2026-11-22 reconciliation (report 13), so one key carries each relation:
a tracking code's scheme is 07's `identifierKind`; a hold's reason is 09's `hasReason`, which also serves receiving
rejections and machine states; a movement's places are 09's `sourceLocation` and `destinationLocation`, whose domain
admits `StockMovement`; a reservation's, a movement's and an adjustment's amount is 07's `hasQuantity` (a signed amount
for an adjustment). A hold's start and end are not stored on the hold: they are the `eventTime` of 09's
`HoldPlacement` and `HoldRelease`, read as `^inv:placesHold/inv:eventTime`, for the same reason as the next paragraph.

The seed's `splitFromLabel` is not a stored property here: it is the path `^inv:splitResult/inv:splitSource`, so the
split's instant, place and person live on one event and the direct link is never a second home for the same fact.

gist properties this design uses, if 11 projects them (their names exist in `gist-categories.md`; their gist meaning
was not read again here):

| gist property | Used from | To | For |
| --- | --- | --- | --- |
| `gist:conformsTo` | `MaterialLot`, `InventoryLabel`, `SerialUnit` | `ItemSpecification` (07) | Specification against stock: the goods conform to the description |
| 07's `identifiedBy` (under `gist:isIdentifiedBy`, pending decision 16) | `MaterialLot`, `InventoryLabel`, `SerialUnit`, `LogisticUnit` | `TrackingCode` | A code names a thing and never settles its identity |
| 07's `identifierText` (under `gist:idText`) | `TrackingCode` | the code's text | "L-221" |
| 07's `issuedBy` (under `gist:isAllocatedBy`) | `TrackingCode` | `Organization` (06) | Who assigned the code: the supplier or the tenant |
| none: 07's `hasQuantity` | `InventoryMeasure` | `QuantityValue` (07) | Under Q7's recommended answer the measure is a statement that points at its quantity; the `numericValue` and `unit` are the `QuantityValue`'s, so a measure never has a value identity of its own |

## 4. The hierarchy and the axioms planned

```text
gist:GeoLocation                       (pending Q1)
  Location                             kind
    Site                               subkind
    Warehouse                          subkind
    Bin                                subkind
gist:PhysicalSubstance
  MaterialLot                          kind (pending Q4)
  InventoryLabel                       kind (pending Q5)
gist:PhysicalIdentifiableItem
  SerialUnit                           kind
  Container                            kind
  LogisticUnit                         kind
gist:Equipment
  Machine                              kind
gist:ID
  TrackingCode                         information
gist:Content
  StockPosition                        information
  InventoryMeasure                     information (pending Q7)
gist:Magnitude
  QuantityValue                        value (07)
gist:Commitment
  InventoryReservation                 relator
gist:Restriction                       (pending Q8)
  QualityHold                          information
gist:Event
  StockMovement                        event
  LabelSplit                           event
  InventoryAdjustment                  event
gist:Determination
  StockCount                           event
```

Disjointness the vocabulary module states itself (gist's own disjointness is not copied unless 11 and Benjamin say so):

| Disjoint set | Why they cannot overlap |
| --- | --- |
| `Site`, `Warehouse`, `Bin` | Rigid subkinds of one kind at different levels; a one-building company has a site and a warehouse, two places (pending Q2) |
| `MaterialLot`, `InventoryLabel`, `SerialUnit` | Different identity criteria even when they coincide: a label that covers a whole lot, or one unit, is still a second thing |
| `Container`, `LogisticUnit` | The vessel against the load built on it |
| `Location` and each physical stock class | A place is not material |
| `Location` and `Organization` (06) | A bin is not its operator; gist states no disjointness for `gist:GeoLocation`, so the vocabulary states it (11, pending Q1) |
| `StockPosition`, `InventoryMeasure`, `TrackingCode` and each physical stock class | A statement, an amount and a code are not goods (information-physical conflation) |
| `StockMovement`, `LabelSplit`, `StockCount`, `InventoryAdjustment` | A move, a split, a count and a correction are different occurrences; a count never changes the book by itself |

No `owl:sameAs`, no `owl:inverseOf`, no HasKey, no transitive `hasParentLocation` (the cycle check is a SPARQL path,
12's), no cardinality in OWL. Required fields and cardinalities live in the record schemas and are projected to SHACL.

A sketch, not code, of a few entries in 05's shapes (section 4.7: a `parent` link, a `DisjointGroup`, a scheme as a
tuple of concepts); definitions as in the tables above:

```ts
// sketch, not code
export const classes = defineClasses({
  Location: { prefLabel: "Location", definition: "…", tag: "kind", // gist parent pending Q1
    parent: { kind: "gist", term: "gist:GeoLocation" },
    identity: { kind: "stated", criterion: "the place as the organization designates it",
      restsOn: ["hasParentLocation"] } },
  Bin: { prefLabel: "Bin", definition: "…", tag: "subkind", parent: { kind: "local", key: "Location" },
    identity: { kind: "inherited" } },
  StockPosition: { prefLabel: "Stock position", definition: "…", tag: "information",
    parent: { kind: "gist", term: "gist:Content" }, identity: { kind: "stated", criterion: "…", restsOn: [] } },
  InventoryMeasure: { prefLabel: "Inventory measure", definition: "…", tag: "information", // pending Q7
    parent: { kind: "gist", term: "gist:Content" }, identity: { kind: "stated", criterion: "…", restsOn: [] } },
})
export const disjointGroups = [
  { members: ["Site", "Warehouse", "Bin"], ratification: "rat-…" },
  { members: ["MaterialLot", "InventoryLabel", "SerialUnit"], ratification: "rat-…" },
]
export const objectProperties = defineProperties<ClassKey, SchemeKey>()({
  hasParentLocation: { domain: { kind: "local", key: "Location" }, range: { kind: "local", key: "Location" } },
  forLot: { domain: { kind: "none", reason: "shared by several scoped records" },
    range: { kind: "local", key: "MaterialLot" } },
  measureKind: { domain: { kind: "local", key: "InventoryMeasure" },
    range: { kind: "schemes", keys: ["InventoryMeasureKindScheme"] } },
})
export const schemes = defineSchemes({ // 10's
  InventoryMeasureKindScheme: { prefLabel: "Inventory measure kind", definition: "…", closed: false,
    concepts: [{ notation: "onHand", prefLabel: "On hand", definition: "…" },
      { notation: "quarantined", prefLabel: "Quarantined", definition: "…" }] },
})
```

## 5. Why the inventory measures are not one enum

An enum gives each kilogram one state, so the states add up to the stock. These quantities do not: on-hand stock
includes what is held and what is reserved, a reservation is usually for a committed line, and committed demand may
exceed what is on hand. They are measures that overlap, each a number of its own on one stock position.

The arithmetic, for one item specification at one scope, one instant and one unit (all quantities in that unit):

| Symbol | Measure | Rule |
| --- | --- | --- |
| H | `onHand` | What is physically there |
| Q | `quarantined` | The part of H covered by at least one hold in force, counted once however many holds cover it: 0 ≤ Q ≤ H |
| R | `reserved` | The part of H that reservations in force set aside, drawn from usable stock only: 0 ≤ R ≤ H − Q |
| C | `committed` | Open commitment lines' remaining need at the site, reserved or not: C ≥ 0, and C may exceed H |
| O | overlap | Reserved quantity whose reservation is for a line counted in C: 0 ≤ O ≤ min(R, C) |
| A | `available` | A = H − Q − (C + R − O): held, committed and reserved stock each taken away once. May be negative (overcommitted) |
| T | `inTransit` | Dispatched toward the site and not yet arrived; never part of H at the origin or the destination |
| I | `acquired` | Expected from open purchase and manufacturing orders; not part of H or T until received |

Four double counts this prevents, each a mistake the glossary names:

1. **Summing states as if they partitioned stock.** The architecture seed's own fixture states In stock 100 kg,
   Available 60 kg, Reserved 40 kg for one position. Read as states of an enum, the position holds 200 kg. Read as
   measures, it holds 100 kg, of which 40 are reserved and 60 are left.
2. **Subtracting committed and reserved both.** A reservation made for a committed line is in C and in R. Taking both
   away subtracts it twice ("committed subtracted twice", `docs/glossary.md`); the O term takes it back once.
3. **Counting held stock as available, or a hold twice.** Q is a union over holds, so two holds on one label take it
   away once, and held stock never reaches A ("counted as available", `docs/glossary.md`).
4. **Counting a transfer at both ends, or at neither.** T is its own measure: total owned stock is Σ H over every
   location plus Σ T over every movement under way, and neither end's H holds it while it travels.

Roll-up rule: H, Q, R and T add across disjoint scopes (two bins of one warehouse). C and O do not: commitment lines
are at the site, not on a bin, so A is worked out at the scope where C is defined (item and site, or item and
organization) and never summed from bin-level figures. A bin has an on-hand measure and no committed one.

The formula itself is a product rule, not a meaning: which demand counts as committed, whether a quote's reservation
counts, how safety stock enters. So an available measure always names its `availabilityRule`, and an available
quantity read from Sutton is a `reported` position kept as Sutton stated it, never worked out again from Sutton's other
numbers: the architecture seed says to "compute only from a verified source formula", and Sutton's formula is not
public. The house rule above is pending Q6.

How Sutton's six public measures (S09) line up, as candidates for 11: "In stock" with `onHand`, "Quarantined" with
`quarantined`, "Reserved" with `reserved`, "Committed" with `committed`, "Available" with `available`, "Acquired" with
`acquired`. 10 and 11 read Sutton's public inventory article as defining Committed to include reservations, so for
Sutton O = R; that reading came through a summarising fetch and was not checked here. The API design report's two
definitions suggest beside it (reserved "against pending quotes", committed to "confirmed Sales Orders"). The arithmetic
above holds either way, because O is stated rather than assumed.

## 6. Reservation against consumption, count against adjustment

| Pair | First | Second | Rule |
| --- | --- | --- | --- |
| Reservation, consumption | An `InventoryReservation` sets usable stock aside for a demand line; H does not change | A consumption (09: an `EventLine` that a transformation `consumes`, or that a shipment `observes`) takes stock away; H falls | A consumption may draw on a reservation (`drawsOnReservation`) or on unreserved stock; a reservation ends by consumption, release or lapse (`reservedUntil`), read from the lines that drew on it; no status scheme is designed until a question needs one. A scheduled work order consumes nothing (the architecture seed, section 5.4) |
| Reservation, hold | A reservation draws on usable stock only | A hold placed later on reserved stock leaves the reservation unsatisfiable | The conflict is reported (R > H − Q fails a check of 12's), never hidden by shrinking either |
| Count, adjustment | A `StockCount` establishes a `counted` position; the book does not change | An `InventoryAdjustment` changes the book by a signed amount for a reason, and names the count it settles | The variance is counted H minus book H for the same scope and instant; who approves an adjustment is a permission (06's `Grant`), not a term |
| Movement, aggregation | A `StockMovement` changes where material is | An aggregation event (09) changes what it is packed in | Packing a label onto a pallet moves nothing; moving a pallet moves every label in it, read from the aggregation events at that instant |
| Label split, transformation | A `LabelSplit` divides a label; the lot is unchanged | A transformation (09) makes new material, under a new lot | The architecture seed's fixture models a split of a lot as a transformation (new lots out); a split of a label is not one |

## 7. Worked example: a pallet of 40 kg of flour, lot L-221, split across two bins

The story, on invented test data. Mill Co ships Example Works a pallet with 40 kg of bread flour from its lot L-221.
It is received at dock 1 and labelled LBL-500. The pallet is broken down: 15 kg are split off onto a new label,
LBL-501, and the two labels are put away in bins A-01 and A-02. LBL-501 is held until the certificate of analysis
arrives. A sales order line needs 10 kg and reserves it on LBL-500; a manufacturing order needs 12 kg, committed but
not reserved. The next day a cycle count of bin A-01 finds 24.5 kg, and an adjustment of −0.5 kg settles it.

Every instance involved:

| Instance | Class | Owner | Facts |
| --- | --- | --- | --- |
| `test_ExampleWorks` | `Organization` | 06 | The tenant; `operatedBy` of the site |
| `test_MillCo` | `Organization` | 06 | Vendor flag true; issues lot code L-221 |
| `test_BreadFlour` | `ItemSpecification` | 07 | Stock unit kg; lot tracked. The specification, not the flour |
| `test_SiteMain` | `Site` | 08 | `operatedBy test_ExampleWorks`; no parent |
| `test_WarehouseA` | `Warehouse` | 08 | `hasParentLocation test_SiteMain` |
| `test_Dock1` | `Location` | 08 | `hasParentLocation test_WarehouseA`; a plain location, not a bin |
| `test_BinA01`, `test_BinA02` | `Bin` | 08 | `hasParentLocation test_WarehouseA`; codes "A-01", "A-02" |
| `test_PurchaseOrder4` and its line | `PurchaseOrder`, line | 09 | 40 kg of `test_BreadFlour` from Mill Co; gives I = 40 kg until received |
| `test_Receipt7` | `Receipt` | 09 | Received at `test_Dock1`, 2026-11-02T08:00Z |
| `test_LotL221` | `MaterialLot` | 08 | `gist:conformsTo test_BreadFlour`; `originatedIn` Mill Co's batch, reached through `test_Receipt7` (pending Q10); `identifiedBy test_CodeL221` |
| `test_CodeL221` | `TrackingCode` | 08 | `identifierText` "L-221"; `identifierKind` `lotCode`; `issuedBy test_MillCo` |
| `test_PalletBase9` | `Container` | 08 | The wooden pallet itself |
| `test_Pallet1` | `LogisticUnit` | 08 | `builtOnContainer test_PalletBase9`; identified by an SSCC `TrackingCode` from Mill Co |
| `test_Label500` | `InventoryLabel` | 08 | `portionOfLot test_LotL221`; code "LBL-500" from Example Works; 40 kg when made, 25 kg after the split |
| `test_Pack1`, `test_Unpack1` | aggregation, disaggregation events | 09 | `test_Label500` in `test_Pallet1` from receipt until 08:15Z |
| `test_Split1` | `LabelSplit` | 08 | 08:20Z at `test_Dock1`; `splitSource test_Label500`; `splitResult test_Label501` |
| `test_Label501` | `InventoryLabel` | 08 | `portionOfLot test_LotL221`; code "LBL-501"; 15 kg |
| `test_Move1`, `test_Move2` | `StockMovement` | 08 | 08:30Z: `forLabel test_Label500` from `test_Dock1` to `test_BinA01`, 25 kg; `forLabel test_Label501` to `test_BinA02`, 15 kg; both arrived at once, so T stays 0 |
| `test_Hold1` | `QualityHold` | 08 | `forLabel test_Label501`; `hasReason` certificate of analysis pending (10's `HoldReasonScheme`); placed by `test_HoldPlaced1`, 09's `HoldPlacement`, at 09:00Z |
| `test_SalesLine1` | sales order line | 09 | Needs 10 kg of `test_BreadFlour` at the site |
| `test_Res1` | `InventoryReservation` | 08 | `reservesFor test_SalesLine1`; `forLabel test_Label500`; `hasQuantity` 10 kg |
| `test_MoLine1` | manufacturing order component line | 09 | Needs 12 kg; not reserved |
| `test_PosA01`, `test_PosA02`, `test_PosSite` | `StockPosition` | 08 | Book positions at 2026-11-02T10:00Z, below |
| `test_Count1` | `StockCount` | 08 | 2026-11-03T07:00Z, `atLocation test_BinA01` |
| `test_PosA01c` | `StockPosition` | 08 | `positionBasis Counted`; `determinedByCount test_Count1`; on hand 24.5 kg |
| `test_Adj1` | `InventoryAdjustment` | 08 | `forLabel test_Label500` at `test_BinA01`; `hasQuantity` −0.5 kg; `adjustmentReason` count difference; `settlesCount test_Count1` |

No `SerialUnit` takes part: flour is not serialized. Had the 40 kg come as 16 bags of 2.5 kg, each with its own serial
number, each bag would be a `SerialUnit` with `unitOfLot test_LotL221`, and the labels would still be portions of the
lot that contain bags. The specification `test_BreadFlour` holds no quantity in any of this.

The positions and their measures at 2026-11-02T10:00Z (book basis, kg):

| Position | Scope | H | Q | R | C | O | A | T |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `test_PosA01` | flour, `test_BinA01`, lot L-221, label LBL-500 | 25 | 0 | 10 | (not at a bin) | | | 0 |
| `test_PosA02` | flour, `test_BinA02`, lot L-221, label LBL-501 | 15 | 15 | 0 | (not at a bin) | | | 0 |
| `test_PosSite` | flour, `test_SiteMain`, lot L-221 | 40 | 15 | 10 | 22 | 10 | 3 | 0 |

A = 40 − 15 − (22 + 10 − 10) = 3 kg. The three wrong readings section 5 prevents give: 90 kg of "stock" when the
measures are summed as states (40 + 15 + 10 + 22 + 3); −7 kg, falsely overcommitted, when committed and reserved are
both subtracted (40 − 15 − 22 − 10); −19 kg when available is worked out per bin against the site's commitments and
summed (25 − 22 plus 15 − 15 − 22). After `test_Adj1` the book reads 24.5 kg in bin A-01, 39.5 kg at the site, and
A = 2.5 kg; `test_PosA01c` and the book position for the same instant are two statements with different bases.

A sketch, not code, of part of it in Turtle (instance data for a competency-question fixture, not a term fact):

```turtle
# sketch, not code: the placeholder namespace of decision 7
@prefix inv: <https://example.org/inventory-import/ontology/> .
@prefix ex:  <https://example.org/inventory-import/fixture/> .
@prefix gist: <https://w3id.org/semanticarts/ns/ontology/gist/> .

ex:test_BinA01 a inv:Bin ; inv:hasParentLocation ex:test_WarehouseA .
ex:test_LotL221 a inv:MaterialLot ; gist:conformsTo ex:test_BreadFlour ; inv:identifiedBy ex:test_CodeL221 .
ex:test_Label500 a inv:InventoryLabel ; inv:portionOfLot ex:test_LotL221 .
ex:test_Split1 a inv:LabelSplit ; inv:splitSource ex:test_Label500 ; inv:splitResult ex:test_Label501 .
ex:test_PosSite a inv:StockPosition ; inv:forItem ex:test_BreadFlour ; inv:atLocation ex:test_SiteMain ;
  inv:forLot ex:test_LotL221 ; inv:positionBasis inv:PositionBasisScheme-book ; inv:asOf "2026-11-02T10:00:00Z" ;
  inv:hasMeasure ex:test_PosSite-onHand , ex:test_PosSite-available .
ex:test_PosSite-onHand a inv:InventoryMeasure ; inv:measureKind inv:InventoryMeasureKindScheme-onHand ;
  inv:hasQuantity ex:test_PosSite-onHand-q .
ex:test_PosSite-onHand-q a inv:QuantityValue ; inv:numericValue 40.0 ; inv:unit inv:UnitOfMeasureCodeScheme-KG .
ex:test_PosSite-available a inv:InventoryMeasure ; inv:measureKind inv:InventoryMeasureKindScheme-available ;
  inv:hasQuantity ex:test_PosSite-available-q ;
  inv:availabilityRule "house-v1 (pending Q6)" .
ex:test_PosSite-available-q a inv:QuantityValue ; inv:numericValue 3.0 ; inv:unit inv:UnitOfMeasureCodeScheme-KG .
```

One thing the repository could not store today: 24.5 kg. `quantityOnHand` is an integer from 0 up (`Count` in
`packages/catalog/contract/src/Item/Item.read.ts`), and the import refuses "quantity 12.5" as "integer" for every unit,
KG and L included (`DECISIONS.md`). That is a record-schema rule and the term `onHand` does not change it; it is named
here because the first lot-tracked import of a mass item would meet it.

## 8. Questions these terms must answer

Proposed for 04, which owns the competency-question suite; none has a query, a fixture or a must-fail case yet.

| Question | Terms it needs |
| --- | --- |
| How much of an item is on hand at a site as of an instant, and how much of it is available, by which rule? | `StockPosition`, `InventoryMeasure`, `onHand`, `available`, `availabilityRule`, `Site` |
| Where is lot L-221 now: in which bins, under which labels, how much in each? | `MaterialLot`, `InventoryLabel`, `portionOfLot`, `StockPosition`, `Bin` |
| Which labels came from label LBL-500, and when? | `LabelSplit`, `splitSource`, `splitResult` |
| How much of a lot is on hold, under which holds, and why? | `QualityHold`, `hasReason` (09), `quarantined`, `forLot`, `forLabel` |
| Which reservations draw on a lot, for which demand lines, and which were consumed? | `InventoryReservation`, `reservesFor`, `drawsOnReservation` |
| What did the last count of a bin find against the book, and which adjustment settled it? | `StockCount`, `counted`, `book`, `determinedByCount`, `InventoryAdjustment`, `settlesCount` |
| How much of an item is in transit to a site? | `StockMovement`, `arrivedAt`, `inTransit` |
| Which logistic unit held a label at an instant? | `LogisticUnit`, `inLogisticUnit`, 09's aggregation events |
| Which serial units belong to a lot? | `SerialUnit`, `unitOfLot` |
| Must fail: a reservation on held stock; a location that is its own ancestor; a label with two lots | `R ≤ H − Q`, `hasParentLocation`, `portionOfLot`, checks of 12's |

## 9. How the terms meet the Alchemy domain layer

Report 01, section 6, as applied to this area; every block carries the IRI of its term. A sketch of shape, not a
design of the aggregates.

| Ontology term | Alchemy block | Example |
| --- | --- | --- |
| `InventoryLabel`, `InventoryReservation`, `QualityHold`, `StockCount` | An aggregate keyed by tenant and id | `SplitLabel` refused with a rejection when the split quantity exceeds the label's on hand |
| `LabelSplit`, `StockMovement`, `InventoryAdjustment` | Events, append-only | `LabelSplit` with the source, the new label and the quantity |
| `QualityHold` placed, released | Commands and events on the hold | `ReleaseHold` refused when the hold is already released |
| `StockPosition`, `InventoryMeasure` | A projection and its view rows, worked out from the events | The site's on-hand, on-hold and available figures for one item and lot |
| `R ≤ H − Q`, no location its own ancestor | A decision across instances, or a check on the projection | A reservation refused when it would draw on held stock |

## 10. Anti-pattern review

| # | Anti-pattern | Finding |
| --- | --- | --- |
| 1 | Singleton hierarchy | None: `Location` has three subkinds; the gist parents with one local child are expected |
| 2 | Role as kind | No roles here; "contract manufacturer" stays a flag on `Organization` (decision 3), used through `operatedBy` |
| 3 | Process and object | Movements, splits, counts and adjustments are events; lots, labels and units are physical; `QualityHold` under `gist:Restriction`, begun and ended by 09's events, is pending Q8 |
| 4 | Missing disjointness | Stated in section 4 for the rigid siblings; the measure kinds are concepts and need none |
| 5 | Circular definition | None; definitions use gist genera and no term defines itself |
| 6 | Quality as class | Avoided: measure kinds, hold reasons, position bases and code schemes are SKOS concepts, not subclasses (`OnHandMeasure` is not minted) |
| 7 | Information and physical conflation | The point of the area: a label code (`TrackingCode`) against the labelled portion (`InventoryLabel`, pending Q5), a stock position against the stock, the specification against the goods |
| 8 | Orphan class | None here: `WorkCenter`, the one orphan first listed, is 07's, under `gist:Collection` (pending Q3) |
| 9 | Polysemy | "Label" (tag, code, portion) and "container" (Sutton's word against our vessel) split into separate terms; Q5 and the alignment note in section 11 |
| 10 | Domain and range overcommitment | Shared scope properties state no domain; ranges are broad gist classes where another document owns the leaf |
| 11 | Individuals in the T-box | The worked example is fixture data, `test_` named, never in the vocabulary |
| 12 | Negative universals | None |
| 13 | False is-a from inheritance | None |
| 14 | System blueprint | `StockPosition` is a statement about stock, not a table row; Sutton's label row and our item row are records pointing at terms |
| 15 | Technical perspective | `splitFromLabel` dropped as stored fact in favour of the event, for the domain's reason (one home), not for query speed |
| 16 | Individuals mixed with classes | None |

## 11. Alignment candidates, for 11

Every row is a candidate, not checked against the target's file or document in this session. Predicates are the
`skos:*Match` set (project profile).

| Term | Target | Predicate | Note |
| --- | --- | --- | --- |
| `Site` | ISA-95 Site | `skos:closeMatch` | ISA-95 has no recorded namespace; cite the term name |
| `WorkCenter` | ISA-95 Work center | `skos:closeMatch` | The architecture seed: "a work center is a capacity/execution grouping" |
| `Bin` | ISA-95 Storage unit | `skos:closeMatch` | Name not checked against the standard |
| `MaterialLot` | ISA-95 Material lot | `skos:closeMatch` | The API design report names it |
| `InventoryLabel` | ISA-95 Material sublot | `skos:relatedMatch` | The architecture seed: "do not assert that every Sutton label implements the ISA-95 sublot semantics" |
| `Container` | IOF core Container | `skos:closeMatch` | The API design report says IOF moved Container into Core; not checked |
| `LogisticUnit` | GS1 logistic unit (SSCC) | `skos:closeMatch` | No `gs1:` IRI checked |
| `QualityHold` | `cbv:Disp-non_sellable_other` | `skos:relatedMatch` | The architecture seed: closer only with evidence the hold prevents sale |
| `StockCount` | CBV business step cycle counting | `skos:closeMatch` | IRI not checked |
| `InventoryLabel` | Sutton label (S08) | `skos:closeMatch` | How a Sutton term is cited is open (project profile) |
| `LogisticUnit` | Sutton container (S12) | `skos:closeMatch` | Sutton's public container holds labels and nests; whether it is our `Container` instead needs Sutton's records |
| Measure kinds | Sutton's six measures (S09) | `skos:closeMatch` | Section 5; Acquired to `acquired` |

## Questions for Benjamin

Moved on 2026-11-22 to the packet's [DECISIONS.md](../DECISIONS.md), "Open", merged with the other reports'
questions. A "(pending Qn)" mark in this report means: Q1 is decision 68, Q2 is 69, Q3 is 67, Q4 is 70, Q5 is 71,
Q6 is 75, Q7 is 74, Q8 is 77, Q9 is 76, Q10 is 72.

## Not checked

- No term here has a ratification record; the conceptualizer skill's input rule ("refuse any term lacking its
  ratification record") is met only by treating every row as a proposal for the auditor.
- Sutton's public documents (S08, S09, S12, S20, S27, S28, S30, S35) were not fetched in this session; every Sutton fact
  is as the architecture seed and the API design report state it. Whether Sutton's public documents say anything about
  work centers or cycle counts was not checked.
- gist 14.1.0 was not read again: every gist name is taken from `gist-categories.md`, and the meaning of the gist
  properties in section 3 (`gist:isAllocatedBy` in particular) was not re-read.
- The ISA-95, IOF, GS1 and CBV names in section 11 were not checked against any file or standard.
- The architecture seed was read in its sections 1 to 7, its warehouse, foundation, planning and traceability Turtle,
  its object and datatype property lists, its taxonomy's label, disposition and measure schemes, its location, lot and
  measure shapes and its fixture; its sections 8 to 13 and its bridge files were not read. The API design report was
  read in its sections 1, 3, 4.1, its spatial Turtle and its inventory-state scheme only.
- The other designers' documents (04 to 07, 09 to 12) were not available when this was written; the keys were
  matched with them on 2026-11-22 (report 13), which moved nine property rows to their owners, added `Machine` and
  moved `WorkCenter` to 07.
- `packages/catalog/contract/src/Item/Item.read.ts` was read whole; the other contract files were searched for stock
  words only. The access contract holds no stock term.
- `bun run docs:check` passed on 2026-11-22 with this document in place (91 files under `explorations/`, warnings on
  other packets' `status` values only), while the other designers were still writing theirs.
