---
type: Research
title: Term index
description: Every key of reports 04 to 12 after reconciliation, with its owner, tag, gist parent and status.
---

# Term index

Reports 04 to 12 were written in parallel by designers who did not see each other's work. On 2026-11-22 they were
read together and reconciled: where one key was defined twice, where two keys named one thing, where a key was used
and defined nowhere, the owning report was edited with the smallest change, and every choice that was Benjamin's
became a numbered open decision in [DECISIONS.md](../DECISIONS.md) (8 to 87). This report is the result: one index of
every key, the counts, and the list of what was changed. It is generated from the reports' own tables, so a report is
the home of each row and this index is a view of them.

Nothing here is built. No term is ratified: no `rat-` record exists, so every row is a proposal for the foundational
auditor and Benjamin.

## How the index was made

A throwaway script, kept outside the repository, read every table under the term-table header (Key, Label, Definition,
Tag, gist parent, Identity, Source, Status) and the property-table header (Key, Label, Definition, Domain, Range,
Source) in reports 04 and 06 to 12, after the edits. It found 169 term rows and 270 property rows, no key
defined twice, and no key used both as a term and as a property. After a sceptic's review the same day (section
"Changes after the sceptic review"), a second throwaway script read the reports' tables again and found 164 term rows
and 269 property rows, each equal to a row below in key, owner and tag. Report 05's metamodel entries are listed apart
(they mint no IRI under decision 19's recommended answer). "Entry" says whether a row is an OWL class, a concept
scheme or a concept; "gist parent" is shortened to the class, or to the local parent for a subclass, and says
"(pending)" when its row does; "Owner" is the report that holds the row.

## Terms

| Key | Entry | Tag | gist parent | Owner | Context | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AccountingSyncDirectionScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| AccountingSyncRecord | class | information | `gist:Content` | 09 | accounting | Sutton only |
| AccountingSyncStateScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| AccountStatusScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| AdjustmentReasonScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| AgentRun | class | event | `gist:Event` | 06 | party and access | in the repository today |
| AggregationEvent | class | event | `gist:PhysicalEvent` (pending) | 09 | execution | Sutton only |
| AliasItemSpecification | class | subkind | `ItemSpecification` (pending) | 07 | catalog | Sutton only |
| AuditEntry | class | information | `gist:Content` | 06 | party and access | in the repository today |
| Bin | class | subkind | `gist:GeoLocation` through `Location` (pending) | 08 | warehouse and stock | Sutton only |
| Bom | class | kind | `gist:Specification` | 07 | catalog | Sutton only |
| BomExpansion | class | information | `gist:Content` | 07 | catalog | later |
| BomExpansionNode | class | information | `gist:Content` | 07 | catalog | later |
| BomLine | class | kind | `gist:Specification` | 07 | catalog | Sutton only |
| BomRevision | class | kind | `gist:Specification` | 07 | catalog | Sutton only |
| BusinessStepScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| ColumnMatching | class | event | `gist:Event` | 09 | import | in the repository today |
| CommitmentLine | class | kind | `gist:Commitment` | 09 | commitments | Sutton only |
| ContactPoint | class | information | `gist:ElectronicAddress` | 06 | party and access | Sutton only |
| ContactPointKindScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| ContactPurposeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| Container | class | kind | `gist:PhysicalIdentifiableItem` | 08 | warehouse and stock | later |
| CostBasisScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| CostFinalityScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| CostObservation | class | information | `gist:Content` | 07 | catalog | in the repository today |
| Currency | class | kind | `gist:UnitOfMeasure` (pending) | 07 | catalog | in the repository today |
| DecisionUndo | class | event | `gist:Event` | 09 | import | in the repository today |
| DisaggregationEvent | class | event | `gist:PhysicalEvent` (pending) | 09 | execution | Sutton only |
| EventLine | class | event | `gist:Event` | 09 | execution | Sutton only |
| EvidenceKindScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| FileProblem | class | information | `gist:Content` | 09 | import | in the repository today |
| FileRow | class | information | `gist:Content` | 09 | import | in the repository today |
| FileUpload | class | event | `gist:Event` | 09 | import | in the repository today |
| FulfilmentProgressScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| Grant | class | relator | `gist:Assignment` (pending) | 06 | party and access | in the repository today; Sutton only; later |
| GrantScopeKindScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| GroupDecision | class | event | `gist:Event` | 09 | import | in the repository today |
| HoldPlacement | class | event | `gist:Event` | 09 | execution | Sutton only |
| HoldReasonScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| HoldRelease | class | event | `gist:Event` | 09 | execution | Sutton only |
| IdentifierKindScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| IdentityDecision | class | event | `gist:Determination` | 06 | party and access | later |
| IdentityEvidence | class | information | `gist:Content` | 06 | party and access | later |
| IdentityOutcomeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| ImportConfirmation | class | event | `gist:Event` | 09 | import | in the repository today |
| ImportLifecycleScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| ImportRemoval | class | event | `gist:Event` | 09 | import | in the repository today |
| ImportReopening | class | event | `gist:Event` | 09 | import | in the repository today |
| ImportResultOutcomeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| ImportTakeBack | class | event | `gist:Event` | 09 | import | in the repository today |
| InventoryAdjustment | class | event | `gist:Event` | 08 | warehouse and stock | Sutton only |
| InventoryItemSpecification | class | subkind | `ItemSpecification` (pending) | 07 | catalog | in the repository today |
| InventoryLabel | class | kind | `gist:PhysicalSubstance` (pending) | 08 | warehouse and stock | Sutton only |
| InventoryMeasure | class | information | `gist:Content` (pending) | 08 | warehouse and stock | in the repository today |
| InventoryMeasureKindScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| InventoryMeasureKindScheme-acquired | concept | category | none: a concept | 08 | warehouse and stock | Sutton only |
| InventoryMeasureKindScheme-available | concept | category | none: a concept | 08 | warehouse and stock | Sutton only |
| InventoryMeasureKindScheme-committed | concept | category | none: a concept | 08 | warehouse and stock | Sutton only |
| InventoryMeasureKindScheme-inTransit | concept | category | none: a concept | 08 | warehouse and stock | later |
| InventoryMeasureKindScheme-onHand | concept | category | none: a concept | 08 | warehouse and stock | in the repository today |
| InventoryMeasureKindScheme-quarantined | concept | category | none: a concept | 08 | warehouse and stock | Sutton only |
| InventoryMeasureKindScheme-reserved | concept | category | none: a concept | 08 | warehouse and stock | Sutton only |
| InventoryReservation | class | relator | `gist:Commitment` | 08 | warehouse and stock | Sutton only |
| Invoice | class | information | `gist:Content` | 09 | accounting | Sutton only |
| InvoicingProgressScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| ItemCategoryScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| ItemEdit | class | event | `gist:Event` | 09 | import | in the repository today |
| ItemIdentifier | class | information | `gist:ID` | 07 | catalog | in the repository today |
| ItemImport | class | event | `gist:Event` | 09 | import | in the repository today |
| ItemLifecycleScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| ItemRevision | class | kind | `gist:Specification` | 07 | catalog | later |
| ItemRoleScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| ItemSpecification | class | kind | `gist:CatalogItem` | 07 | catalog | in the repository today |
| ItemUnitConversion | class | kind | `gist:Specification` | 07 | catalog | Sutton only |
| LabelLifecycleScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| LabelSplit | class | event | `gist:Event` | 08 | warehouse and stock | Sutton only |
| LineAllocation | class | information | `gist:Content` (pending) | 09 | commitments | Sutton only |
| Location | class | kind | `gist:GeoLocation` (pending) | 08 | warehouse and stock | Sutton only |
| LogisticUnit | class | kind | `gist:PhysicalIdentifiableItem` | 08 | warehouse and stock | Sutton only |
| Machine | class | kind | `gist:Equipment` | 08 | warehouse and stock | Sutton only |
| ManufacturingOrder | class | kind | `gist:Commitment` (pending) | 09 | commitments | Sutton only |
| ManufacturingOrderLine | class | subkind | `CommitmentLine` | 09 | commitments | Sutton only |
| MaterialLot | class | kind | `gist:PhysicalSubstance` (pending) | 08 | warehouse and stock | Sutton only |
| MeasurementDimensionScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| Member | class | relator | `gist:TemporalRelation` (pending) | 06 | party and access | in the repository today |
| MemberRoleScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| MembershipStatusScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| ModelCall | class | event | `gist:Event` | 06 | party and access | in the repository today |
| ModelCallPurposeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| MoneyAmount | class | value | `gist:Magnitude` | 07 | catalog | in the repository today |
| ObjectObservation | class | event | `gist:PhysicalEvent` (pending) | 09 | execution | Sutton only |
| OperationDefinition | class | kind | `gist:TaskTemplate` (pending) | 07 | catalog | Sutton only |
| OperationExecution | class | event | `gist:Task` (pending) | 09 | execution | Sutton only |
| OrderLifecycleScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| Organization | class | kind | `gist:Organization` | 06 | party and access | in the repository today; Sutton only |
| PackagingUnit | class | subkind | `UnitOfMeasure` (pending) | 07 | catalog | in the repository today |
| Party | class | category | none (pending) | 06 | party and access | later |
| PartyIdentifier | class | information | `gist:ID` | 06 | party and access | later |
| PaymentProgressScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| Permission | class | information | `gist:Permission` (pending) | 06 | party and access | Sutton only |
| Person | class | kind | `gist:Person` | 06 | party and access | in the repository today; Sutton only |
| Pick | class | subkind | `StockMovement` (pending) | 09 | execution | Sutton only |
| PortalAccess | class | information | `gist:Permission` (pending) | 06 | party and access | Sutton only |
| PortalModuleScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| PositionBasisScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| PositionBasisScheme-book | concept | category | none: a concept | 08 | warehouse and stock | later |
| PositionBasisScheme-counted | concept | category | none: a concept | 08 | warehouse and stock | later |
| PositionBasisScheme-reported | concept | category | none: a concept | 08 | warehouse and stock | in the repository today |
| PostalAddress | class | information | `gist:PhysicalAddress` | 06 | party and access | Sutton only |
| PriceList | class | kind | `gist:Offer` | 07 | catalog | Sutton only |
| PriceListEntry | class | relator | `gist:Offer` | 07 | catalog | Sutton only |
| PurchaseOrder | class | kind | `gist:Agreement` (pending) | 09 | commitments | Sutton only |
| PurchaseOrderLine | class | subkind | `CommitmentLine` | 09 | commitments | Sutton only |
| Putaway | class | subkind | `StockMovement` (pending) | 09 | execution | Sutton only |
| QualityDispositionScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| QualityHold | class | information | `gist:Restriction` (pending) | 08 | warehouse and stock | Sutton only |
| QualityInspection | class | event | `gist:Determination` | 09 | execution | Sutton only |
| QualityOutcomeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| QualityResult | class | information | `gist:Content` | 09 | execution | Sutton only |
| QuantityValue | class | value | `gist:Magnitude` | 07 | catalog | in the repository today |
| Quote | class | kind | `gist:Offer` | 09 | commitments | Sutton only |
| QuoteLine | class | subkind | `CommitmentLine` | 09 | commitments | Sutton only |
| RecallCase | class | event | `gist:Event` | 09 | execution | Sutton only |
| Receipt | class | event | `gist:Transaction` | 09 | execution | Sutton only |
| ReceivingRejection | class | event | `gist:Event` | 09 | execution | Sutton only |
| ReceivingRejectReasonScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| ReviewOutcomeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| Role | class | information | `gist:Permission` (pending) | 06 | party and access | in the repository today; Sutton only |
| Routing | class | kind | `gist:TaskTemplate` (pending) | 07 | catalog | Sutton only |
| RoutingRevision | class | kind | `gist:TaskTemplate` (pending) | 07 | catalog | Sutton only |
| RowDecision | class | event | `gist:Event` | 09 | import | in the repository today |
| RowOutcome | class | information | `gist:Content` | 09 | import | in the repository today |
| SalesOrder | class | kind | `gist:Agreement` (pending) | 09 | commitments | Sutton only |
| SalesOrderLine | class | subkind | `CommitmentLine` | 09 | commitments | Sutton only |
| SerialUnit | class | kind | `gist:PhysicalIdentifiableItem` | 08 | warehouse and stock | Sutton only |
| ServiceItemSpecification | class | subkind | `ItemSpecification` (pending) | 07 | catalog | Sutton only |
| Shipment | class | event | `gist:Transaction` | 09 | execution | Sutton only |
| SignInAccount | class | information | `gist:Content` | 06 | party and access | in the repository today |
| Site | class | subkind | `gist:GeoLocation` through `Location` (pending) | 08 | warehouse and stock | Sutton only |
| SourceRecord | class | information | `gist:Content` | 04 | import | later |
| StagedFile | class | information | `gist:FormattedContent` (pending) | 09 | import | in the repository today |
| StockConditionScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| StockCount | class | event | `gist:Determination` | 08 | warehouse and stock | later |
| StockMovement | class | event | `gist:Event` | 08 | warehouse and stock | Sutton only |
| StockPosition | class | information | `gist:Content` | 08 | warehouse and stock | Sutton only |
| SupplierBill | class | information | `gist:Content` | 09 | accounting | Sutton only |
| SuspectedDuplicate | class | information | `gist:Content` | 06 | party and access | later |
| Tenant | class | role | `Organization` (pending) | 06 | party and access | in the repository today |
| TrackingCode | class | information | `gist:ID` | 08 | warehouse and stock | Sutton only |
| TrackingMethodScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| TransferOrder | class | kind | `gist:Commitment` (pending) | 09 | commitments | Sutton only |
| TransferOrderLine | class | subkind | `CommitmentLine` | 09 | commitments | Sutton only |
| TransformationEvent | class | event | `gist:PhysicalEvent` (pending) | 09 | execution | Sutton only |
| UnitOfMeasure | class | kind | `gist:UnitOfMeasure` (pending) | 07 | catalog | in the repository today |
| UnitOfMeasureCodeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| ValueChange | class | information | `gist:Content` | 09 | import | in the repository today |
| ValueChangeMethodScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| ValueChangeSourceScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| ValueProposal | class | information | `gist:Content` | 09 | import | in the repository today |
| VendorItem | class | relator | `gist:Offer` (pending) | 07 | catalog | in the repository today |
| Warehouse | class | subkind | `gist:GeoLocation` through `Location` (pending) | 08 | warehouse and stock | Sutton only |
| WorkCenter | class | kind | `gist:Collection` (pending) | 07 | catalog | Sutton only |
| WorkOrder | class | kind | `gist:Commitment` (pending) | 09 | commitments | Sutton only |
| WorkOrderLine | class | subkind | `CommitmentLine` | 09 | commitments | Sutton only |

## Counts

By context (the owner's area; report 09 split by its sections):

| Context | Classes | Schemes | Concepts | All |
| --- | --- | --- | --- | --- |
| party and access | 19 | 0 | 0 | 19 |
| catalog | 25 | 0 | 0 | 25 |
| warehouse and stock | 19 | 0 | 10 | 29 |
| commitments | 14 | 0 | 0 | 14 |
| execution | 16 | 0 | 0 | 16 |
| accounting | 3 | 0 | 0 | 3 |
| import | 18 | 0 | 0 | 18 |
| taxonomy | 0 | 40 | 0 | 40 |
| All | 114 | 40 | 10 | 164 |

The ten concepts are 08's inventory measure kinds and position bases, which 08 lists as terms because it holds their
definitions and arithmetic; every other concept is in report 10's scheme tables and is counted there, not here.

By tag, classes only (114; a scheme or a concept carries no kind tag in 05's model, though 08 and 10 wrote one
in their Tag column):

| Tag | Classes |
| --- | --- |
| kind | 29 |
| subkind | 15 |
| role | 1 |
| phase | 0 |
| relator | 5 |
| event | 31 |
| information | 30 |
| category | 1 |
| value | 2 |

Every class's tag is one 05's rule V25 admits for the gist class it reaches (checked by a script over the table
above). The five relators are `Member` and `Grant` (gist's temporal relation and assignment), `InventoryReservation`
(a commitment) and `VendorItem` and `PriceListEntry` (offers, which gist makes contingent commitments).

No class is tagged phase: every state is a concept (state-is-kind avoided), and the one role class is `Tenant`.

By status, counting a row once for each status it names: in the repository today 56,
Sutton only 89, later 24.

Properties by owner:

| Owner | Properties |
| --- | --- |
| 04 requirements | 8 |
| 06 party and access | 62 |
| 07 catalog and value | 76 |
| 08 warehouse and stock | 32 |
| 09 commitment and event | 83 |
| 10 taxonomies | 7 |
| 12 projection and checks | 1 |

## Properties

Domain and range are shortened: "none declared" where the row keeps them broad, "datatype" where the record field
gives the datatype, "concept of" a scheme where the values are concepts. One direction each; no inverse is defined.

| Key | Owner | Domain | Range |
| --- | --- | --- | --- |
| acceptsProposal | 09 | none declared | `ValueProposal` |
| acceptsQuote | 09 | `SalesOrder` | `Quote` |
| accountEmail | 06 | `SignInAccount` | datatype |
| accountOf | 06 | `SignInAccount` | `Person` |
| accountStatus | 06 | `Organization` | concept of `AccountStatusScheme` |
| actingAgentName | 06 | `AuditEntry` | datatype |
| actorNameThen | 06 | `AuditEntry` | datatype |
| actsFor | 06 | `AgentRun` | `Member` |
| addressLines | 06 | `PostalAddress` | datatype |
| adjustmentReason | 08 | `InventoryAdjustment` | concept of `AdjustmentReasonScheme` |
| affectsShipment | 09 | `RecallCase` | `Shipment` |
| agentName | 06 | `AgentRun` | datatype |
| agreedUnitPrice | 09 | `CommitmentLine` | `MoneyAmount` |
| allocatedTo | 09 | `LineAllocation` | `EventLine` |
| allocatesLine | 09 | `LineAllocation` | `CommitmentLine` |
| arrivedAt | 08 | `StockMovement` | datatype |
| asOf | 08 | `StockPosition` | datatype |
| assignedPriceList | 07 | `Organization` | `PriceList` |
| atLocation | 08 | none declared | `Location` |
| attemptedAt | 09 | `AccountingSyncRecord` | datatype |
| atWorkCenter | 07 | none declared | `WorkCenter` |
| auditAction | 06 | `AuditEntry` | datatype |
| auditDetail | 06 | `AuditEntry` | datatype |
| availabilityRule | 08 | `InventoryMeasure` | datatype |
| baseUnit | 07 | `ItemSpecification` | `UnitOfMeasure` |
| billsOrder | 09 | `SupplierBill` | `PurchaseOrder` |
| builtOnContainer | 08 | `LogisticUnit` | `Container` |
| businessStep | 09 | `gist:Event` | concept of `BusinessStepScheme` |
| byConversion | 07 | `QuantityValue` | `ItemUnitConversion` |
| calledAt | 06 | `ModelCall` | datatype |
| calledFor | 06 | `ModelCall` | `Member` |
| callPurpose | 06 | `ModelCall` | concept of `ModelCallPurposeScheme` |
| capturedAt | 04 | `SourceRecord` | datatype |
| carriedBy | 09 | `gist:Transaction` | `Organization` |
| changedField | 09 | `ValueChange` | datatype |
| changeHow | 09 | `ValueChange` | concept of `ValueChangeMethodScheme` |
| changeIn | 09 | `ValueChange` | `FileRow` |
| citesEvidence | 06 | none declared | `IdentityEvidence` |
| citesIdentifier | 06 | `IdentityEvidence` | `PartyIdentifier` |
| closedAt | 06 | `PortalAccess` | datatype |
| componentItem | 07 | `BomLine` | `ItemSpecification` |
| consumes | 09 | `TransformationEvent` | `EventLine` |
| contactPointKind | 06 | `ContactPoint` | concept of `ContactPointKindScheme` |
| contactValue | 06 | `ContactPoint` | datatype |
| conversionFactor | 07 | `ItemUnitConversion` | datatype |
| conversionFor | 07 | `ItemUnitConversion` | `ItemSpecification` |
| convertedFrom | 07 | `QuantityValue` | `QuantityValue` |
| correctsEvent | 09 | `gist:Event` | `gist:Event` |
| costAmount | 07 | `CostObservation` | `MoneyAmount` |
| costBasis | 07 | `CostObservation` | concept of `CostBasisScheme` |
| costFinality | 07 | `CostObservation` | concept of `CostFinalityScheme` |
| costOf | 07 | `CostObservation` | `ItemSpecification` |
| costPerUnit | 07 | `CostObservation` | `UnitOfMeasure` |
| counterparty | 09 | `gist:Intention` | `Organization` |
| countryCode | 06 | `PostalAddress` | datatype |
| currency | 07 | `MoneyAmount` | `Currency` |
| currencyCode | 07 | `Currency` | datatype |
| decidedAt | 06 | `IdentityDecision` | datatype |
| decidedBy | 06 | `IdentityDecision` | `Member` |
| decidedIn | 09 | `ValueChange` | `gist:Event` |
| decidesOn | 06 | `IdentityDecision` | `Party` |
| decidesRow | 09 | none declared | `FileRow` |
| defaultFor | 06 | `PostalAddress` | concept of `ContactPurposeScheme` |
| defaultRevision | 07 | none declared | none declared |
| description | 07 | `ItemSpecification` | datatype |
| destinationLocation | 09 | none declared | `Location` |
| determinedByCount | 08 | `StockPosition` | `StockCount` |
| discontinuedOn | 07 | `ItemSpecification` | datatype |
| drawsOnReservation | 08 | `EventLine` | `InventoryReservation` |
| dueOn | 09 | `CommitmentLine` | datatype |
| duringRun | 09 | `TransformationEvent` | `OperationExecution` |
| edits | 09 | `ItemEdit` | `ItemSpecification` |
| effectiveFrom | 07 | none declared | datatype |
| effectiveUntil | 07 | none declared | datatype |
| endedAt | 09 | none declared | datatype |
| entryOf | 07 | `PriceListEntry` | `PriceList` |
| eventTime | 09 | `gist:Event` | datatype |
| evidenceKind | 06 | `IdentityEvidence` | concept of `EvidenceKindScheme` |
| evidenceText | 06 | `IdentityEvidence` | datatype |
| executesWorkOrder | 09 | `OperationExecution` | `WorkOrder` |
| expandedForSite | 07 | `BomExpansion` | `Site` |
| expandedOn | 07 | `BomExpansion` | datatype |
| expansionOf | 07 | `BomExpansion` | `BomRevision` |
| expectedYield | 07 | `BomRevision` | datatype |
| expiresOn | 08 | `MaterialLot` | datatype |
| externalDocumentId | 09 | `AccountingSyncRecord` | datatype |
| fileValue | 09 | `ValueChange` | datatype |
| firstReceivedOn | 07 | `ItemSpecification` | datatype |
| followsOperation | 09 | `WorkOrder` | `OperationDefinition` |
| forItem | 08 | none declared | `ItemSpecification` |
| forLabel | 08 | none declared | `InventoryLabel` |
| forLot | 08 | none declared | `MaterialLot` |
| forSerialUnit | 08 | none declared | `SerialUnit` |
| fromUnit | 07 | `ItemUnitConversion` | `UnitOfMeasure` |
| fulfilledBy | 07 | `AliasItemSpecification` | `ItemSpecification` |
| fulfilmentProgress | 10 | `gist:Intention` | concept of `FulfilmentProgressScheme` |
| grantedBy | 06 | `Grant` | `Member` |
| grantedTo | 06 | `Grant` | `Member` |
| grantScope | 06 | `Grant` | concept of `GrantScopeKindScheme` |
| grantsRole | 06 | `Grant` | `Role` |
| hasContactPoint | 06 | `Party` | `ContactPoint` |
| hasDimension | 10 | `UnitOfMeasure` | concept of `MeasurementDimensionScheme` |
| hasMeasure | 08 | `StockPosition` | `InventoryMeasure` |
| hasParentLocation | 08 | `Location` | `Location` |
| hasPostalAddress | 06 | `Party` | `PostalAddress` |
| hasQuantity | 07 | none declared | `QuantityValue` |
| hasReason | 09 | none declared | concept of `HoldReasonScheme`, `ReceivingRejectReasonScheme` |
| height | 07 | `ItemSpecification` | `QuantityValue` |
| heldAfterInspection | 08 | `QualityHold` | `QualityInspection` |
| identifiedBy | 07 | none declared | `gist:ID` |
| identifierKey | 07 | `ItemIdentifier` | datatype |
| identifierKind | 07 | `gist:ID` | concept of `IdentifierKindScheme` |
| identifierText | 07 | `gist:ID` | datatype |
| identityOutcome | 06 | `IdentityDecision` | concept of `IdentityOutcomeScheme` |
| importsFile | 09 | `ItemImport` | `StagedFile` |
| includesRole | 06 | `Role` | `Role` |
| inLogisticUnit | 08 | `StockPosition` | `LogisticUnit` |
| inspectionOutcome | 09 | `QualityInspection` | concept of `QualityOutcomeScheme` |
| inTenant | 06 | none declared | `Tenant` |
| invoicesOrder | 09 | `Invoice` | `SalesOrder` |
| invoicesShipment | 09 | `Invoice` | `Shipment` |
| invoicingProgress | 10 | `gist:Intention` | concept of `InvoicingProgressScheme` |
| involvesLogisticUnit | 09 | `EventLine` | `LogisticUnit` |
| isContactOf | 06 | `Person` | `Organization` |
| isCustomer | 06 | `Organization` | datatype |
| isOptional | 07 | `BomLine` | datatype |
| isPreferred | 07 | `VendorItem` | datatype |
| issuedBy | 07 | `gist:ID` | `Organization` |
| isVendor | 06 | `Organization` | datatype |
| itemCategory | 07 | `ItemSpecification` | concept of `ItemCategoryScheme` |
| itemRole | 07 | `ItemSpecification` | concept of `ItemRoleScheme` |
| joinedAt | 06 | `Member` | datatype |
| keepsItem | 09 | `ImportTakeBack` | `ItemSpecification` |
| leadTime | 07 | `VendorItem` | `QuantityValue` |
| leftOutReason | 04 | `RowOutcome` | datatype |
| length | 07 | `ItemSpecification` | `QuantityValue` |
| lifecycleState | 10 | none declared | concept of `ItemLifecycleScheme`, `LabelLifecycleScheme`, `OrderLifecycleScheme`, `ImportLifecycleScheme` |
| lineOf | 09 | `gist:Intention` | `gist:Intention` |
| locality | 06 | `PostalAddress` | datatype |
| matchedColumn | 09 | `ColumnMatching` | datatype |
| matchedField | 09 | `ColumnMatching` | datatype |
| matchesReceipt | 09 | `SupplierBill` | `Receipt` |
| matchScore | 06 | `SuspectedDuplicate` | datatype |
| maxRole | 06 | `AgentRun` | `Role` |
| measureKind | 08 | `InventoryMeasure` | concept of `InventoryMeasureKindScheme` |
| membershipIn | 06 | `Member` | `Tenant` |
| membershipOf | 06 | `Member` | `Person` |
| membershipStatus | 06 | `Member` | concept of `MembershipStatusScheme` |
| minimumQuantity | 07 | `PriceListEntry` | `QuantityValue` |
| minorUnits | 07 | `MoneyAmount` | datatype |
| minorUnitScale | 07 | `MoneyAmount` | datatype |
| name | 06 | none declared | datatype |
| nodeOf | 07 | `BomExpansionNode` | `BomExpansion` |
| numericValue | 07 | `QuantityValue` | datatype, stated `xsd:decimal` |
| observedAt | 07 | `gist:Content` | datatype |
| observes | 09 | `gist:Event` | `EventLine` |
| occursAt | 09 | `gist:Event` | `Location` |
| offeredBy | 07 | `gist:Offer` | `Organization` |
| offeredItem | 07 | `gist:Offer` | `ItemSpecification` |
| onField | 06 | `Grant` | datatype |
| openedAt | 06 | `PortalAccess` | datatype |
| opensModule | 06 | `PortalAccess` | concept of `PortalModuleScheme` |
| operatedBy | 08 | `Site` | `Organization` |
| originatedIn | 08 | `MaterialLot` | `gist:Event` |
| outcomeFor | 09 | `RowOutcome` | `FileRow` |
| outcomeKind | 09 | `RowOutcome` | concept of `ImportResultOutcomeScheme` |
| outputItem | 07 | none declared | `ItemSpecification` |
| outputQuantity | 07 | `BomRevision` | `QuantityValue` |
| packedInto | 09 | `AggregationEvent` | `LogisticUnit` |
| packs | 09 | `AggregationEvent` | `EventLine` |
| partOfImport | 09 | `gist:Event` | `ItemImport` |
| paymentProgress | 10 | `gist:Intention` | concept of `PaymentProgressScheme` |
| performedBy | 09 | `gist:Event` | none declared (pending) |
| permits | 06 | `Role` | `Permission` |
| placesHold | 09 | `HoldPlacement` | `QualityHold` |
| portalFor | 06 | `PortalAccess` | `Organization` |
| portalPriceList | 06 | `PortalAccess` | `PriceList` |
| portionOfLot | 08 | `InventoryLabel` | `MaterialLot` |
| positionBasis | 08 | `StockPosition` | concept of `PositionBasisScheme` |
| postalCode | 06 | `PostalAddress` | datatype |
| pricesIncludeTax | 07 | `PriceList` | datatype |
| priceUnit | 07 | `gist:Offer` | `UnitOfMeasure` |
| primaryBom | 07 | `ItemSpecification` | `Bom` |
| produces | 09 | `TransformationEvent` | `EventLine` |
| promisedItem | 09 | `CommitmentLine` | `ItemSpecification` |
| proposedBy | 09 | none declared | concept of `ValueChangeSourceScheme` |
| proposedByRun | 06 | `SuspectedDuplicate` | `AgentRun` |
| proposedField | 09 | `ValueProposal` | datatype |
| proposesFor | 09 | `ValueProposal` | `FileRow` |
| purchaseUnit | 07 | `ItemSpecification` | `UnitOfMeasure` |
| qualityDisposition | 10 | none declared | concept of `QualityDispositionScheme` |
| quantityPer | 07 | `BomLine` | `QuantityValue` |
| questionsLot | 09 | `RecallCase` | `MaterialLot` |
| raisedFor | 09 | `gist:Intention` | `CommitmentLine` |
| recordedActor | 06 | `AuditEntry` | `Member` |
| recordedAt | 06 | `AuditEntry` | datatype |
| recordedBy | 09 | none declared | `gist:Event` |
| recordedFromRow | 04 | `ItemSpecification` | `FileRow` |
| recordOf | 04 | `SourceRecord` | none declared |
| recordTime | 09 | `gist:Event` | datatype |
| region | 06 | `PostalAddress` | datatype |
| rejectsPartOf | 09 | `ReceivingRejection` | `Receipt` |
| releasesHold | 09 | `HoldRelease` | `QualityHold` |
| removedAt | 06 | `Member` | datatype |
| removesItem | 09 | `ImportTakeBack` | `ItemSpecification` |
| reorderPoint | 07 | `ItemSpecification` | `QuantityValue` |
| reportedIn | 08 | `StockPosition` | none declared |
| reportsProblemWith | 09 | `FileProblem` | `FileUpload` |
| representsItem | 07 | `BomExpansionNode` | `ItemSpecification` |
| requiresComponent | 07 | `BomExpansionNode` | `BomExpansionNode` |
| requiresPermission | 06 | `Permission` | `Permission` |
| reservedUntil | 08 | `InventoryReservation` | datatype |
| reservesFor | 08 | `InventoryReservation` | `gist:Commitment` |
| resolves | 06 | `IdentityDecision` | `SuspectedDuplicate` |
| restoresItem | 09 | `ImportTakeBack` | `ItemSpecification` |
| resultingDisposition | 09 | `gist:Event` | concept of `QualityDispositionScheme` |
| resultItem | 04 | `RowOutcome` | `ItemSpecification` |
| resultOf | 09 | `QualityResult` | `QualityInspection` |
| reviewOutcome | 09 | `FileRow` | concept of `ReviewOutcomeScheme` |
| revisionCode | 07 | none declared | datatype |
| revisionOf | 07 | none declared | none declared |
| rowOf | 09 | `FileRow` | `StagedFile` |
| runTime | 07 | `OperationDefinition` | `QuantityValue` |
| salesUnit | 07 | `ItemSpecification` | `UnitOfMeasure` |
| scrapRatio | 07 | `BomLine` | datatype |
| selectedRevision | 07 | `BomExpansionNode` | `BomRevision` |
| sequence | 07 | none declared | datatype |
| servesPurpose | 06 | none declared | concept of `ContactPurposeScheme` |
| settlesCount | 08 | `InventoryAdjustment` | `StockCount` |
| setupTime | 07 | `OperationDefinition` | `QuantityValue` |
| sitedAt | 08 | `WorkCenter` | `Location` |
| sourceId | 04 | `SourceRecord` | datatype |
| sourceLocation | 09 | none declared | `Location` |
| sourceSystem | 04 | `SourceRecord` | datatype |
| sourceType | 04 | `SourceRecord` | datatype |
| splitResult | 08 | `LabelSplit` | `InventoryLabel` |
| splitSource | 08 | `LabelSplit` | `InventoryLabel` |
| stagedFrom | 09 | `StagedFile` | `FileUpload` |
| startedAt | 09 | none declared | datatype |
| stepOf | 07 | `OperationDefinition` | `RoutingRevision` |
| stockCondition | 10 | none declared | concept of `StockConditionScheme` |
| subOrderOf | 09 | `ManufacturingOrder` | `ManufacturingOrder` |
| supersedes | 06 | none declared | none declared |
| suspects | 06 | `SuspectedDuplicate` | `Party` |
| syncDirection | 09 | `AccountingSyncRecord` | concept of `AccountingSyncDirectionScheme` |
| syncOutcome | 09 | `AccountingSyncRecord` | concept of `AccountingSyncStateScheme` |
| syncsDocument | 09 | `AccountingSyncRecord` | `gist:Content` |
| taggedWith | 07 | `ItemSpecification` | `gist:Tag` |
| takesBack | 09 | `ImportTakeBack` | `ImportConfirmation` |
| termCategory | 12 | none declared | concept of `TermCategoryScheme` |
| toUnit | 07 | `ItemUnitConversion` | `UnitOfMeasure` |
| trackingMethod | 07 | `ItemSpecification` | concept of `TrackingMethodScheme` |
| underTransferOrder | 08 | `StockMovement` | `TransferOrder` |
| undoes | 09 | `DecisionUndo` | `gist:Event` |
| unit | 07 | `QuantityValue` | `UnitOfMeasure` |
| unitOfLot | 08 | `SerialUnit` | `MaterialLot` |
| unitPrice | 07 | `gist:Offer` | `MoneyAmount` |
| unpackedFrom | 09 | `DisaggregationEvent` | `LogisticUnit` |
| unpacks | 09 | `DisaggregationEvent` | `EventLine` |
| usesBomRevision | 09 | `ManufacturingOrder` | `BomRevision` |
| usesMachine | 09 | `OperationExecution` | `Machine` |
| usesRoutingRevision | 09 | `ManufacturingOrder` | `RoutingRevision` |
| vendorName | 07 | `VendorItem` | datatype |
| width | 07 | `ItemSpecification` | `QuantityValue` |
| withRouting | 07 | `BomRevision` | `RoutingRevision` |
| workedOutFrom | 08 | `StockPosition` | none declared |
| workOrderOf | 09 | `WorkOrder` | `ManufacturingOrder` |
| writesItem | 09 | `ImportConfirmation` | `ItemSpecification` |
| writtenValue | 09 | `ValueChange` | datatype |

## The term model's own entries (05)

`Vocabulary`, `Term`, `ClassTerm`, `ObjectPropertyTerm`, `DatatypePropertyTerm`, `ConceptScheme`, `Concept`,
`DisjointGroup`, `AlignmentRow`, `AlignmentPredicate`, `KindTag`, `ParentLink`, `CategoryParent`, `ClassTarget`,
`RangeTarget`, `IdentityCriterion`, `Deprecation`, `TermSource`, `TermScope`, `Ratification`, `PrefixEntry`,
`NamedExternalTerm`, `TermPointer`, `LiftPath`, `NoTermReason`, `TermBinding`, `VocabularyVersion`: 27 entries of the
metamodel, none an IRI under decision 19's recommended answer. Five were added on 2026-11-22 so the model can hold every
row above (05, section 10).

## Collisions resolved

Each row names what collided, which key or report stands now, and where the edit was made. A choice that was not a
matter of one report's own rule became a decision instead, and the row names it.

| What collided | Now | Edited |
| --- | --- | --- |
| The import's terms, claimed by 04 and by 09: `Import` and `ItemImport`, `SourceFile` and `StagedFile`, `ImportRow` and `FileRow`, `ImportRowResult` and `RowOutcome`, `ReviewDecision` and `RowDecision`, `Suggestion` and `ValueProposal`, and `ImportConfirmation`, `ImportTakeBack`, `ValueChange` in both | 09's keys, as 04 said its rows would yield (decision 52) | 04 section 5, its questions and queries |
| Eighteen import properties of 04 against 09's (`confirms`, `ofSourceFile`, `resultOfRow` and the rest) | 09's keys; 04 keeps `resultItem`, `leftOutReason`, `recordedFromRow` and the source record's four | 04 |
| `QualityHold` defined by 08 and by 09, with different gist parents | 08's row; parent `gist:Restriction` since the sceptic review (decision 77) | 09 row removed, 08 parent |
| `WorkCenter` defined by 07 and by 08 | 07's row (decision 67) | 08 row removed |
| `Machine` used by 09 and 11, defined nowhere | added to 08 under `gist:Equipment` | 08 |
| `identifiedBy` in 06 and 07; `gist:isIdentifiedBy` used directly by 08 | 07's, domain none declared, range `gist:ID` | 06, 07, 08 |
| `identifierText` (07), `identifierValue` (06), `gist:idText` (08) | 07's `identifierText` | 06, 08 |
| `issuedBy` in 06 and 07; `gist:isAllocatedBy` (08) | 07's, domain `gist:ID` | 06, 08 |
| `identifierKind` (07), `identifierScheme` (06 and 10), `codeScheme` (08), and their schemes `IdentifierScheme`, `ItemIdentifierKind` and a tracking-code scheme | `identifierKind` with 10's `IdentifierKindScheme` | 06, 07, 08, 10 |
| `supersedes` in 06 and 07 | 06's, domain and range none declared | 07 row removed |
| `lineOf` in 07 (BOM line) and 09 (order line) | 09's, domain and range `gist:Intention` | 07 row removed |
| `lifecycleState` in 07, 09 and 10, and 09's `importLifecycleState` | 10's, domain none declared | 07 and 09 rows removed |
| `atWorkCenter` in 07 and 09 | 07's, domain none declared | 09 row removed |
| `endedAt` in 06 and 09; 06's `grantedAt` beside 09's `startedAt` | 09's, domain admits a `Grant` | 06 rows removed |
| 09's `validUntil` beside 07's `effectiveUntil` for a quote | 07's | 09 row removed |
| 06's `displayName` beside `name` used by 04 and 07 | `name`, 06's, domain none declared | 06 |
| `description` (07, said to be 05's) and `hasQuantity` (09, said to be 07's), defined nowhere; 04's `quantity`; 08's `reservedQuantity`, `movedQuantity`, `adjustmentQuantity` | both added to 07; `hasQuantity` serves all | 07, 08, 04 |
| 09's `involvesItem`, `involvesLot`, `involvesLabel`, `involvesSerialUnit` beside 08's `forItem` and its kin | 08's | 09 rows removed |
| 08's `movedFrom`, `movedTo` beside 09's `sourceLocation`, `destinationLocation` | 09's, domain admits `StockMovement` | 08 rows removed |
| 08's `holdReason` beside 09's `hasReason`; 08's `heldFrom`, `releasedAt` beside the `eventTime` of 09's hold events | `hasReason`; the hold's interval read from the events | 08 rows removed |
| 06's `atSite` (range `Site`) beside 08's `atLocation`, and 04's fixture granting at a bin | 08's `atLocation` | 06 row removed |
| 04's `inOrganization` beside 06's `inTenant` | `inTenant` | 04 |
| Properties 10 defined under its own key where a term report had one: `contactPurpose`, `scopeKind`, `memberRole`, `resultOutcome`, `changeSource`, `changeMethod`, `qualityResult`, `syncState`, and nine of the same key | the term reports' keys, as 10's own rule says | 10 (eighteen rows removed), 04 |
| Scheme keys without the `Scheme` suffix (06, 07, 10) against 05's rule V3 and 09's names | every scheme key ends in `Scheme` | 06, 07, 10 |
| Schemes named differently in 09 and 10 (`RowOutcomeScheme`, `ChangeHowScheme`, `ChangeSourceScheme`, `AccountingSyncOutcomeScheme`, `QualityOutcomeScheme`) and the same scheme named in both | 10's keys, except `QualityOutcomeScheme`, 09's name, since `QualityResult` is 09's class | 09 rows removed, 10 |
| Schemes named in 06, 08 and 09 with no concepts in 10 (thirteen), 08's `inTransit`, 07's `stated` cost basis | added to 10 (4.29 to 4.31, 4.21, 4.24) | 10 |
| 09's six per-order lifecycle schemes beside 10's one order lifecycle | 10's (decision 82) | 09 table removed |
| 09's `FileProblemKindScheme` beside 10's "no scheme" for file problems | 10's (decision 52) | 09 row removed |
| Measure-kind notations: 08's `OnHold`, `Incoming` against 10's `quarantined`, `acquired` | 10's notations, 08's definitions | 08 rows rekeyed |
| Concept notations `orders` (06) and `ordering` (10); grant scopes `tenant`, `site` (06) and `organization`, `location` (10) | 10's | 06 |
| `ModelCallPurpose`: a scheme for 06, a code list with no scheme for 10 | a scheme | 10 |
| Concept IRI as `ItemRoleScheme/buy` (05) or `ItemRole-buy` (10) | `inv:ItemRoleScheme-buy` (decision 10) | 05, 10 |
| Disjointness written as `owl:AllDisjointClasses` (05) or pairwise (12) | pairwise, no blank node | 05 |
| `notATerm` (05) beside `noTerm` with a closed list (12) | `noTerm` (decision 21) | 05 |
| A scheme value lifted as a notation literal (12) or a concept IRI (04, 05, 10) | the concept IRI (decision 23) | 12 |
| The kind tag kept in the module (05) or emitted as `inv:termCategory` (12) | kept in the module (decision 19) | 12 |
| Alignment triples in the OWL file (11) or a separate file (12) | separate (decision 28) | 11 |
| 11's subjects and placements written before the term reports: `Membership`, `ActivityRecord`, `Import`, `SourceFile`, `occurredAt`, `recordedAt`, `Uom`, `DimensionUnit`, and the parents of `InventoryLabel`, `PurchaseOrder`, `SalesOrder`, `WorkOrder`, `Grant` | the owners' keys and parents | 11 |
| 07's staged row pointing at `SourceRecord` (said to be 05's), and 05 counting it as an item binding | 09's `FileRow` | 07, 05 |
| 07's provenance "terms (05)" that 05 does not define | `noTerm` bookkeeping (decision 21); 04's `recordedFromRow` | 07 |
| 12's sketch keys `skuText`, `unitCost`, `hasVendorOffer`, defined nowhere | 05's lift paths over 07's keys | 12, 05 |
| `numericValue` filled by integer and float fields, which 05's V11 would refuse | a stated `xsd:decimal` (decision 50) | 05, 07, 12 |
| `Putaway`, `Pick` (09) beside 08's `StockMovement` | subkinds of `StockMovement` (decision 79) | 09 |
| Scheme typing `gist:ControlledVocabulary` (10) beside none (05, 11) | SKOS only (decision 17) | 10 |
| `Role` as a class (06) or `MemberRole` as a scheme (10); units as a class (07) or a scheme (10) | concepts that are also individuals (decisions 41, 61) | 05, 06, 07, 10 |
| Cost basis `stated` (07) or none (10) | `stated` (decision 60) | 10 |
| `Party` with two parents (06) against one parent (05) | one identity-bearing parent and category parents (decision 12) | 05 |
| gist names not in `gist-categories.md` used by 06, 07, 09 and recommended by 11 | added under decision 13, rows marked pending | 06, 07, 09, 11 |
| 04's CQ-C04 asking for offers known only by a vendor's name, with no property for it | `vendorName` added to 07 | 07 |
| 09's `LineAllocation` row with no parent while its own question recommended `gist:Content` | the recommendation | 09 |
| Whether Sutton counts reserved inside committed: "not public" (08), read from Sutton's article (10, 11) | 10's and 11's reading, marked unchecked | 08 |
| 09 tagged its event classes `kind`, where 06 and 08 tagged theirs `event` | `event`, as 05's kind tag defines it | 09 |

## Not proposed (decision 87)

The brief's rule: a Sutton-only term enters the vocabulary module when a competency question of rank must or should
needs it, never to complete a picture. A throwaway script read 04's must and should questions, took every key their
"Terms it needs" column names, and closed that set over this index: a needed property brings the classes and schemes
of its domain and range, a needed class its local parent, a needed scheme its concepts. The 73 terms below are
Sutton only or later and no must or should question reaches them, so they are **not proposed**: their rows stay in
their reports as design notes, the curator does not treat them as part of the vocabulary, and each enters only when a
question of that rank needs it. Repository terms (in the repository today) are proposed whether or not a question
reaches them, since a record already points at them.

`AccountStatusScheme`, `AccountingSyncDirectionScheme`, `AccountingSyncRecord`, `AccountingSyncStateScheme`,
`AdjustmentReasonScheme`, `AliasItemSpecification`, `Bom`, `BomExpansion`, `BomExpansionNode`, `BomLine`, `BomRevision`,
`BusinessStepScheme`, `CommitmentLine`, `ContactPointKindScheme`, `Container`, `CostBasisScheme`, `CostFinalityScheme`,
`DisaggregationEvent`, `EvidenceKindScheme`, `FulfilmentProgressScheme`, `HoldPlacement`, `HoldReasonScheme`,
`HoldRelease`, `InventoryAdjustment`, `InventoryReservation`, `Invoice`, `InvoicingProgressScheme`, `ItemRevision`,
`ItemUnitConversion`, `Machine`, `ManufacturingOrder`, `ManufacturingOrderLine`, `ObjectObservation`,
`OperationDefinition`, `OperationExecution`, `PartyIdentifier`, `PaymentProgressScheme`, `Permission`, `Pick`,
`PortalAccess`, `PortalModuleScheme`, `PositionBasisScheme-book`, `PositionBasisScheme-counted`, `PostalAddress`,
`PriceList`, `PriceListEntry`, `PurchaseOrder`, `PurchaseOrderLine`, `Putaway`, `QualityInspection`,
`QualityOutcomeScheme`, `QualityResult`, `Quote`, `QuoteLine`, `RecallCase`, `ReceivingRejectReasonScheme`,
`ReceivingRejection`, `Routing`, `RoutingRevision`, `SalesOrder`, `SalesOrderLine`, `SerialUnit`,
`ServiceItemSpecification`, `StockCount`, `StockMovement`, `SupplierBill`, `SuspectedDuplicate`, `TrackingCode`,
`TransferOrder`, `TransferOrderLine`, `WorkCenter`, `WorkOrder`, `WorkOrderLine`.

Removed from the index altogether (not just not proposed), since the brief's no-gos rule them out (04's CQ-E05 and
CQ-E06 are will-not): the machine telemetry terms `MachineStateInterval`, `MachineObservation`, `MachineStateScheme`
and `MachineStopReasonScheme` with the properties `stateOf`, `machineState` and `readFrom`, and the FSMA scheme
`CriticalTrackingEventScheme` with `criticalTrackingEvent`. Each is a note in its report (09, 10). `Machine` stays a
row: it is equipment an operation run uses, not telemetry, and it is in the list above.

## Changes after the sceptic review (2026-11-22)

A sceptic read the whole design and listed problems; each was checked against the reports, gist 14.1.0 and the
repository. What changed, with the decision that now holds the choice:

| What was wrong | Now | Edited |
| --- | --- | --- |
| Decision 34's recommendation made a record an instance of `gist:Organization` and `gist:Person`, which gist disjoins from `gist:Content`, and gave `Person` two identity criteria | `Person` and `Organization` name the party, identity `unresolved` with one criterion; 04's `SourceRecord` and its new `recordOf` hold the reidentification key (decision 34, recommendation changed) | 06, 04, 11, DECISIONS |
| `InventoryMeasure` under `QuantityValue` inherited a value identity and stated a second | information under `gist:Content`, pointing at a `QuantityValue` by `hasQuantity` (decision 74, recommendation changed) | 08, 04, 07, 11 |
| `QualityHold` under bare `gist:Intention` while gist 14.1.0 has `gist:Restriction` | information under `gist:Restriction` (decision 77, recommendation changed; decision 13's table B) | 08, 11, DECISIONS |
| Relator tags on a specification, a permission and content (`BomLine`, `ItemUnitConversion`, `PortalAccess`, `LineAllocation`) | kind or information, and 05's new rule V25 maps each gist class to the tags it admits | 05, 06, 07, 09, 12 |
| `Party` in disjoint pairs, against V21 | the pairs are stated against `Person` and `Organization` | 06 |
| Routings under `gist:TaskTemplate` defined as specifications, with properties whose domain is `gist:Specification` | defined as templates; `revisionOf`, `revisionCode`, `defaultRevision`, `outputItem`, `sequence`, `effectiveFrom`, `effectiveUntil` declare no domain (decision 13) | 07, 11 |
| `baseUnit`, `costPerUnit`, `priceUnit` under `gist:hasUnitOfMeasure`, whose domain is `gist:Magnitude` | only `unit` sits under it (decision 16 now requires the domains to fit) | 07, 11 |
| `gist:ProductSpecification` and `gist:ServiceSpecification` taken as second identity-bearing parents of the item kinds | not taken (decision 12) | 11, 10, 04 |
| `gist:ReferenceValue` taken for a term 07 does not have | not taken | 11, 10 |
| No property for who decided a changed value, a proposal's field, a record's source, a book position's basis | `decidedIn`, `proposedField` (09), `recordOf` (04), `workedOutFrom` and `reportedIn` (08) | 04, 08, 09 |
| `StockPosition`'s identity merged two sources' figures for one scope and instant | what stated a counted or reported position is part of its identity | 08 |
| `qualityDisposition` and `stockCondition` on a stock position, whose measures overlap | on the stock itself (labels, lots, serial units); the quarantined measure is read from holds only | 10, DECISIONS |
| Carrier and contract manufacturer flags added without a decision | held back (decision 89, new) | 06, 10, 04 |
| `performedBy` ranged over `Party` | no range declared (decision 91, new) | 09 |
| A stored cost's currency read from a description string | decision 88, new | 07, 12 |
| The SKU key's punctuation: code and `CLAUDE.md` disagree | decision 90, new; CQ-I03 keys keep the hyphen | 04, 07 |
| CQ-I08 and half of CQ-P05 asked SPARQL about identity criteria that never reach Turtle | gate 4 over the module (05's V18 now fails on `restsOn`) | 04, 05, 12 |
| CQ-W03's fixture summed site-level measures from bins; CQ-W07 and CQ-P08 over-counted on plausible data | rewritten, with must-fail cases for each | 04 |
| No rule named the nodes a lift path creates; two datatype rules clashed on `numericValue`; concept typing sat outside the reasoner's closure; scheme ranges written two ways | positional IRIs for lifted nodes; a stated datatype wins in SHACL; `alsoInstanceOf` typing in the OWL file; no OWL range for a scheme | 12, 05, DECISIONS |
| The record's `Literals` built from the scheme, against decision 2 | the record writes its literals and gate 4 compares (decision 23) | 05, 10, DECISIONS |
| `ItemIdentifier`'s identity needed an issuer a name-only vendor cannot give; `Bin` stated an identity as a subkind; definitions that repeated their label; `defaultRevision` and `primaryBom` as second homes | each row corrected | 07, 08, 06 |
| Alignment rows for the dormant `ContactAssignment`; `accountNumberAtParty` with no source; `duns` missing from 10 | rows removed; `duns` added to 10 | 11, 06, 10 |
| Vocabulary sketches in shapes 05 rejects; `TermRef` undefined | sketches in 05's shapes; `TermRef` defined in 05 section 4.1 | 05 to 10 |

## Checks run

- Every key a competency question of 04 names in its "Terms it needs" column is defined by a row above, except three
  that are not keys: the notation `count`, the will-not `FsmaTraceabilityRecord`, and the law name in CQ-P05's cell.
- Every `inv:` key in 04's twelve SPARQL blocks is defined above (fixture names aside), and the twelve blocks parse
  with rdflib's `prepareQuery` after the edits. None was run against data: there is no fixture or generated Turtle.
- Every property's domain and range names a key defined above, a projected gist class, a scheme of 10, or none
  declared, except 12's `termCategory` range (`TermCategoryScheme`), which exists only under decision 19's other answer.
- No table row was left split across lines by the edits (checked by a script over every report).
- After the sceptic review: the reports' term and property tables equal this index in keys, owners and tags (164 and
  269); every class's tag passes 05's V25; 04's twelve SPARQL blocks parse with rdflib's `prepareQuery`, and CQ-W03,
  CQ-W07 and CQ-P08 return their expected rows over throwaway fixtures built from their text (kept outside the
  repository), the must-fail variants included.

## Not checked

- The script read tables only. Prose in a report that names a key in passing was read by hand for the keys renamed,
  and could still name an old key where no search found it.
- Neither seed report was read whole for this reconciliation: their headings were read, and every fact from them is as
  reports 01 and 04 to 12 cite it.
- No term was re-checked against gist 14.1.0, Sutton's public pages or any external file; rows moved between reports
  keep the evidence their first author gave.
- The counts by status count words in the Status column, which several rows fill with more than one status.
