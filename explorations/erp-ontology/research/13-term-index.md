---
type: Research
title: Term index
description: Every key of reports 04 to 12 after reconciliation, and the three audit properties report 14 holds, with its owner, tag, gist parent and status.
---

# Term index

Reports 04 to 12 were written in parallel by designers who did not see each other's work. On 2026-11-22 they were
read together and reconciled: where one key was defined twice, where two keys named one thing, where a key was used
and defined nowhere, the owning report was edited with the smallest change, and every choice that was Benjamin's
became a numbered open decision in [DECISIONS.md](../DECISIONS.md) (8 to 91: 8 to 87 that day, and 88 to 91 added after the sceptic review the same day). This report is the result: one index of
every key, the counts, and the list of what was changed. It is generated from the reports' own tables, so a report is
the home of each row and this index is a view of them.

Benjamin answered nineteen decisions the same day: 8 to 11, 13 to 16, 20, 21, 23, 25, 32, 34, 39, 40, 41 and 43, and a
new one, 93. He then answered seven more: 22, 26, 38 and 46, and three new ones the carried-through reports raised, 94
to 96. He then answered six more: 24, and five the second review and report 14 raised, 97 to 101. This index is
revised to those answers (section "The thin thread and the slices"). 62 stay open: 12, 17 to
19, 27 to 31, 33, 35 to 37, 42, 44, 45 and 47 to 92. By his ruling each is put to him when the slice that needs it
is specified, its recommendation is the agent's until then, and nothing is built on it.

[Report 14](14-thin-thread.md) is the one specification of the thin thread. Where this index and report 14 differ
about the thread, report 14 holds. This index stays the view of every key, for the thread and the later slices.

Nothing here is built. No term is ratified: decision 32 makes the name of a `rat-` record the mark of a ratified term,
and no `rat-` record exists, so every row is a proposal for the foundational auditor and Benjamin. The ruling on a
scheme covers the concepts its proposal lists (decision 101), so the thread needs 18 rulings: seven classes, nine
properties and two schemes (report 14 section 1.5).

## How the index was made

A throwaway script, kept outside the repository, read every table under the term-table header (Key, Label, Definition,
Tag, gist parent, Identity, Source, Status) and the property-table header (Key, Label, Definition, Domain, Range,
Source) in reports 04 and 06 to 12, after the edits. It found 169 term rows and 270 property rows, no key
defined twice, and no key used both as a term and as a property. After a sceptic's review the same day (section
"Changes after the sceptic review"), a second throwaway script read the reports' tables again and found 164 term rows
and 269 property rows, each equal to a row below in key, owner and tag. A later review of the packet removed two of
those property rows by hand, `decidedAt` and `recordedAt` (section "Collisions resolved"), which left 267. Decisions 39
and 43 then changed the tables by hand: one term row came in, `ContactAssignment`, and three property rows,
`contactPerson`, `contactAccount` and `assignmentPoint`, and the property row `isContactOf` went out, which left 269.
Decision 98 then changed the audit entry's rows by hand: `action` and `recordedAt` came in, both with the domain
`AuditEntry` (report 14 section 2.2), and four went out, `auditAction`, which `action` replaces, and `actorNameThen`,
`auditDetail` and `actingAgentName`, whose fields are marked `noTerm` (report 14 section 3.5). The tables below
have 165 term rows and 267 property rows.
The property table includes `termCategory`, which decision 19 (a) does not mint, so the minted count under that answer is 266. Report 05's metamodel entries are listed apart
(they mint no IRI under decision 19's recommended answer). "Entry" says whether a row is an OWL class, a concept
scheme or a concept; "gist parent" is shortened to the class, or to the local parent for a subclass; "Owner" is the
report that holds the row. A gist parent says "(pending)" for one of two reasons: its gist name is not yet admitted,
since decision 13 admits a name only when a term in the slice being built needs it, or the placement waits on an open
decision. A parent with no mark is in `gist-categories.md` already or is admitted with the thin thread.

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
| ContactAssignment | class | relator | `gist:Assignment` | 06 | party and access | Sutton only (slice 1; decisions 39 and 43) |
| ContactPoint | class | information | `gist:ElectronicAddress` | 06 | party and access | Sutton only |
| ContactPointKindScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| ContactPurposeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| Container | class | kind | `gist:PhysicalIdentifiableItem` | 08 | warehouse and stock | later |
| CostBasisScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| CostFinalityScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| CostObservation | class | information | `gist:Content` | 07 | catalog | in the repository today |
| Currency | class | kind | `gist:UnitOfMeasure` (pending) | 07 | catalog | in the repository today (a documented USD; no currency field is stored, and projecting it is decision 88) |
| DecisionUndo | class | event | `gist:Event` | 09 | import | in the repository today |
| DisaggregationEvent | class | event | `gist:PhysicalEvent` (pending) | 09 | execution | Sutton only |
| EventLine | class | event | `gist:Event` | 09 | execution | Sutton only |
| EvidenceKindScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| FileProblem | class | information | `gist:Content` | 09 | import | in the repository today |
| FileRow | class | information | `gist:Content` | 09 | import | in the repository today |
| FileUpload | class | event | `gist:Event` | 09 | import | in the repository today |
| FulfilmentProgressScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| Grant | class | relator | `gist:Assignment` (decision 13) | 06 | party and access | in the repository today (the thin thread: the record's role field read as one grant at organization scope, stated by `grantScope`, decisions 40 and 96); Sutton only (site scope); later (field scope) |
| GrantScopeKindScheme | scheme | not applicable: scheme | none: a scheme (pending) | 10 | taxonomy | in the repository today (the organization scope, implied by every record; no other scope is stored; the thin thread ships the scheme with that one concept, decision 96) |
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
| ItemEdit | class | event | `gist:Event` | 09 | import | later |
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
| Member | class | relator | `gist:TemporalRelation` (decision 13) | 06 | party and access | in the repository today |
| MemberRoleScheme | scheme | not applicable: scheme | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| MembershipStatusScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | not proposed (the `member` table stores `removedAt` and no status: active is `removedAt` being null, removed is its being set; invited and suspended are not stored) |
| ModelCall | class | event | `gist:Event` | 06 | party and access | later |
| ModelCallPurposeScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | in the repository today |
| MoneyAmount | class | value | `gist:Magnitude` | 07 | catalog | in the repository today |
| ObjectObservation | class | event | `gist:PhysicalEvent` (pending) | 09 | execution | Sutton only |
| OperationDefinition | class | kind | `gist:TaskTemplate` (pending) | 07 | catalog | Sutton only |
| OperationExecution | class | event | `gist:Task` (pending) | 09 | execution | Sutton only |
| OrderLifecycleScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| Organization | class | kind | `gist:Organization` | 06 | party and access | Sutton only (an account's record; the thin thread takes the class as `Tenant`'s parent, and no thread record holds it: report 14 section 2.1) |
| PackagingUnit | class | subkind | `UnitOfMeasure` (pending) | 07 | catalog | in the repository today |
| Party | class | category | none (pending) | 06 | party and access | later |
| PartyIdentifier | class | information | `gist:ID` | 06 | party and access | later |
| PaymentProgressScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | Sutton only |
| Permission | class | information | `gist:Permission` (pending) | 06 | party and access | Sutton only |
| Person | class | kind | `gist:Person` | 06 | party and access | Sutton only (contacts, whose evidence is external or a fixture); the human a membership refers to has no distinct stored Person record today, and the thin thread takes the class with one link from `Member` and no name or email paths (decision 94) |
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
| Role | class | information | none in the thin thread, a stated exception (decision 97); `gist:Permission` waits for slice 1 (decisions 13 and 41) | 06 | party and access | in the repository today (the thin thread: viewer, editor and admin, each a concept of `MemberRoleScheme` and under the same IRI an individual of `Role`, decision 41); Sutton only (custom roles) |
| Routing | class | kind | `gist:TaskTemplate` (pending) | 07 | catalog | Sutton only |
| RoutingRevision | class | kind | `gist:TaskTemplate` (pending) | 07 | catalog | Sutton only |
| RowDecision | class | event | `gist:Event` | 09 | import | in the repository today |
| RowOutcome | class | information | `gist:Content` | 09 | import | in the repository today (the latest outcome of a row only; an identity for each confirmation waits on decision 53) |
| SalesOrder | class | kind | `gist:Agreement` (pending) | 09 | commitments | Sutton only |
| SalesOrderLine | class | subkind | `CommitmentLine` | 09 | commitments | Sutton only |
| SerialUnit | class | kind | `gist:PhysicalIdentifiableItem` | 08 | warehouse and stock | Sutton only |
| ServiceItemSpecification | class | subkind | `ItemSpecification` (pending) | 07 | catalog | Sutton only |
| Shipment | class | event | `gist:Transaction` | 09 | execution | Sutton only |
| SignInAccount | class | information | `gist:Content` | 06 | party and access | later |
| Site | class | subkind | `gist:GeoLocation` through `Location` (pending) | 08 | warehouse and stock | Sutton only |
| SourceRecord | class | information | `gist:Content` | 04 | import | later |
| StagedFile | class | information | `gist:FormattedContent` (pending) | 09 | import | in the repository today |
| StockConditionScheme | scheme | information | none: a scheme (pending) | 10 | taxonomy | later |
| StockCount | class | event | `gist:Determination` | 08 | warehouse and stock | later |
| StockMovement | class | event | `gist:Event` | 08 | warehouse and stock | Sutton only |
| StockPosition | class | information | `gist:Content` | 08 | warehouse and stock | Sutton only |
| SupplierBill | class | information | `gist:Content` | 09 | accounting | Sutton only |
| SuspectedDuplicate | class | information | `gist:Content` | 06 | party and access | later |
| Tenant | class | role | `Organization` (decision 38) | 06 | party and access | in the repository today |
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
| party and access | 20 | 0 | 0 | 20 |
| catalog | 25 | 0 | 0 | 25 |
| warehouse and stock | 19 | 0 | 10 | 29 |
| commitments | 14 | 0 | 0 | 14 |
| execution | 16 | 0 | 0 | 16 |
| accounting | 3 | 0 | 0 | 3 |
| import | 18 | 0 | 0 | 18 |
| taxonomy | 0 | 40 | 0 | 40 |
| All | 115 | 40 | 10 | 165 |

The ten concepts are 08's inventory measure kinds and position bases, which 08 lists as terms because it holds their
definitions and arithmetic; every other concept is in report 10's scheme tables and is counted there, not here.

By tag, classes only (115; a scheme or a concept carries no kind tag in 05's model, though 08 and 10 wrote one
in their Tag column). `MemberRoleScheme` and `GrantScopeKindScheme` read `not applicable: scheme` above, because
report 14 section 2.3 gives a scheme no kind tag. Every other scheme, and the ten concepts, keeps the tag its
owner wrote:

| Tag | Classes |
| --- | --- |
| kind | 29 |
| subkind | 15 |
| role | 1 |
| phase | 0 |
| relator | 6 |
| event | 31 |
| information | 30 |
| category | 1 |
| value | 2 |

Every class's tag is one 05's rule V25 admits for the gist class it reaches (checked by a script over the table
above, before Benjamin's answers). Two rows changed since, by hand: `ContactAssignment` is a relator under
`gist:Assignment`, as `Grant` is, and `Role` reaches no gist class in the thin thread. V25 as written let only a
category class be parentless and would have rejected it. Decision 97 allows it as a stated exception on a committed
list, and for the thread report 14's rule C4 replaces V25 (section 6.4). The six relators are `Member` (gist's temporal relation), `Grant` and
`ContactAssignment` (assignments), `InventoryReservation` (a commitment) and `VendorItem` and `PriceListEntry` (offers,
which gist makes contingent commitments).

No class is tagged phase: every state is a concept (state-is-kind avoided), and the one role class is `Tenant`.

By status, counting a row once for each status it names, whatever the row adds in brackets: in the repository today 50,
Sutton only 90, later 27. `Grant` names all three and `Role` two. One row, `MembershipStatusScheme`, names none of the
three: it is not proposed.

Properties by owner:

| Owner | Properties |
| --- | --- |
| 04 requirements | 8 |
| 06 party and access | 57 |
| 07 catalog and value | 76 |
| 08 warehouse and stock | 32 |
| 09 commitment and event | 83 |
| 10 taxonomies | 7 |
| 12 projection and checks | 1 |
| 14 the thin thread | 3 |

Report 14's three are the audit entry's `action`, `recordedAt` and `recordedActor`, whose rows report 06 no longer
holds (decision 98). The thread's other six properties keep their owner, and report 14 section 2.2 holds the wording
the thread ships for all nine.

## Properties

Domain and range are shortened: "none declared" where the row keeps them broad, "datatype" where the record field
gives the datatype, "concept of" a scheme where the values are concepts. One direction each; no inverse is defined.
"Super-property" is the gist property a row sits under, as decision 16 allows: our property's own domain and range
fall under the gist property's, and gist's domain and range are never copied. A row with no fifth cell states
none. `recordedActor`'s range is `Member` in the thin thread (decision 98; report 14 section 2.2). Slice 1 emits `Member` too, because `PortalAccess` is not proposed,
and widening the range is open decision 44, a change that under decision 24 advances the version.
The audit entry has four properties, `recordedActor`, `action`, `recordedAt` and `inTenant` (decision 98). Its copied
actor name and its detail sentence are `noTerm`, reason screen, and its agent field is `noTerm`, reason deferred,
until the party slice places it with `AgentRun`, so none of the three has a row. `recordedAt` is not 09's
`recordTime`, whose domain is `gist:Event`: an audit entry is a record, not an event (report 14 section 3.5).
`membershipOf` is filled by the fixture only in the thread, since no record holds a human's id (report 14 section
3.3).
These answers changed rows here. The customer and vendor flags sit on the tenant's `SourceRecord` (decision 34), and
the two properties that compare records for identity point at a `SourceRecord` too. A contact is a
`ContactAssignment` with `contactPerson`, `contactAccount`, `assignmentPoint` and `servesPurpose`; `isContactOf` is
not a row (decisions 39 and 43). `membershipIn` points at the `Tenant`, in the thin thread as in slice 1 (decision 38).

| Key | Owner | Domain | Range | Super-property |
| --- | --- | --- | --- | --- |
| acceptsProposal | 09 | none declared | `ValueProposal` |
| acceptsQuote | 09 | `SalesOrder` | `Quote` |
| accountEmail | 06 | `SignInAccount` | datatype |
| accountOf | 06 | `SignInAccount` | `Person` |
| accountStatus | 06 | `Organization` | concept of `AccountStatusScheme` |
| action | 14 | `AuditEntry` | datatype, stated `xsd:string` (decision 98) |
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
| assignmentPoint | 06 | `ContactAssignment` | `ContactPoint` |
| atLocation | 08 | none declared | `Location` |
| attemptedAt | 09 | `AccountingSyncRecord` | datatype |
| atWorkCenter | 07 | none declared | `WorkCenter` |
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
| contactAccount | 06 | `ContactAssignment` | `Organization` |
| contactPerson | 06 | `ContactAssignment` | `Person` |
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
| decidedBy | 06 | `IdentityDecision` | `Member` |
| decidedIn | 09 | `ValueChange` | `gist:Event` |
| decidesOn | 06 | `IdentityDecision` | `SourceRecord` |
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
| eventTime | 09 | `gist:Event` | datatype | `gist:atDateTime` |
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
| hasDimension | 10 | `UnitOfMeasure` | concept of `MeasurementDimensionScheme` | `gist:hasAspect` |
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
| identifierText | 07 | `gist:ID` | datatype | `gist:idText` |
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
| isCustomer | 06 | `SourceRecord` | datatype |
| isOptional | 07 | `BomLine` | datatype |
| isPreferred | 07 | `VendorItem` | datatype |
| issuedBy | 07 | `gist:ID` | `Organization` |
| isVendor | 06 | `SourceRecord` | datatype |
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
| membershipIn | 06 | `Member` | `Tenant` (decision 38) |
| membershipOf | 06 | `Member` | `Person` |
| membershipStatus | 06 | `Member` | concept of `MembershipStatusScheme` |
| minimumQuantity | 07 | `PriceListEntry` | `QuantityValue` |
| minorUnits | 07 | `MoneyAmount` | datatype |
| minorUnitScale | 07 | `MoneyAmount` | datatype |
| name | 06 | none declared | datatype | `gist:name` |
| nodeOf | 07 | `BomExpansionNode` | `BomExpansion` |
| numericValue | 07 | `QuantityValue` | datatype, stated `xsd:decimal` | `gist:numericValue` |
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
| permits | 06 | `Role` | `Permission` (not in the thin thread, decision 41) |
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
| recordedActor | 14 | `AuditEntry` | `Member` (decision 98; widening it is pending decision 44) |
| recordedAt | 14 | `AuditEntry` | datatype, stated `xsd:dateTime` (decision 98) |
| recordedBy | 09 | none declared | `gist:Event` |
| recordedFromRow | 04 | `ItemSpecification` | `FileRow` |
| recordOf | 04 | `SourceRecord` | none declared |
| recordTime | 09 | `gist:Event` | datatype | `gist:isRecordedAt` |
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
| servesPurpose | 06 | `ContactAssignment` | concept of `ContactPurposeScheme` |
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
| startedAt | 09 | none declared: an event that lasts, or a `Grant`; never a `Member`, whose interval is `joinedAt` and `removedAt` | datatype |
| stepOf | 07 | `OperationDefinition` | `RoutingRevision` |
| stockCondition | 10 | none declared | concept of `StockConditionScheme` |
| subOrderOf | 09 | `ManufacturingOrder` | `ManufacturingOrder` |
| supersedes | 06 | none declared | none declared |
| suspects | 06 | `SuspectedDuplicate` | `SourceRecord` |
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
| unit | 07 | `QuantityValue` | `UnitOfMeasure` | `gist:hasUnitOfMeasure` |
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

For the thread, report 14 says where these live and what shape they take (sections 2.6, 3.2 and 7.1). Four points
correct what the entries were taken to mean. `NoTermReason` has six values, not five: decision 98 added deferred,
which names the slice that will place the field. The type of a `LiftPath` cannot name this repository's terms in the
foundation package, which may not import the kernel: the foundation package's maker is generic in the three name
types and the kernel binds it (sections 3.2 and 7.2). A `ParentLink` may say none with a reason, for a class on the
exception list (decision 97; section 6.4). The version a `VocabularyVersion` holds is a semantic version string
written in the module, `0.y` before publication and never taken from the clock (decision 24; section 8).

## Collisions resolved

Each row names what collided, which key or report stands now, and where the edit was made. A choice that was not a
matter of one report's own rule became a decision instead, and the row names it. Of the decisions named below, 10, 13,
16, 21, 23, 41 and 98 are answered and their rows state the answer. Every other one is open: its row states the agent's
recommendation, which the reports carry as a pending design and nothing is built on.

| What collided | Now | Edited |
| --- | --- | --- |
| The import's terms, claimed by 04 and by 09: `Import` and `ItemImport`, `SourceFile` and `StagedFile`, `ImportRow` and `FileRow`, `ImportRowResult` and `RowOutcome`, `ReviewDecision` and `RowDecision`, `Suggestion` and `ValueProposal`, and `ImportConfirmation`, `ImportTakeBack`, `ValueChange` in both | 09's keys, as 04 said its rows would yield (decision 52) | 04 section 5, its questions and queries |
| Eighteen import properties of 04 against 09's (`confirms`, `ofSourceFile`, `resultOfRow` and the rest) | 09's keys; 04 keeps `resultItem`, `leftOutReason`, `recordedFromRow` and the source record's four | 04 |
| `QualityHold` defined by 08 and by 09, with different gist parents | 08's row; parent `gist:Restriction` since the sceptic review (decision 77) | 09 row removed, 08 parent |
| `WorkCenter` defined by 07 and by 08 | 07's row (decision 67) | 08 row removed |
| `Machine` used by 09 and 11, defined nowhere | added to 08 under `gist:Equipment` | 08 |
| `identifiedBy` in 06 and 07; `gist:isIdentifiedBy` used directly by 08 | 07's, domain none declared, range `gist:ID` | 06, 07, 08 |
| `identifierText` (07), `identifierValue` (06), `gist:idText` (08) | one fact with one home, `gist:idText`: 07's `identifierText` stands only as a stored sub-property of it (the super-property column; decision 16), never as a local alias with no parent. The same holds for `numericValue` under `gist:numericValue` and `name` under `gist:name` | 06, 07, 08 |
| `issuedBy` in 06 and 07; `gist:isAllocatedBy` (08) | 07's, domain `gist:ID` | 06, 08 |
| `identifierKind` (07), `identifierScheme` (06 and 10), `codeScheme` (08), and their schemes `IdentifierScheme`, `ItemIdentifierKind` and a tracking-code scheme | `identifierKind` with 10's `IdentifierKindScheme` | 06, 07, 08, 10 |
| `supersedes` in 06 and 07 | 06's, domain and range none declared | 07 row removed |
| `lineOf` in 07 (BOM line) and 09 (order line) | 09's, domain and range `gist:Intention` | 07 row removed |
| `lifecycleState` in 07, 09 and 10, and 09's `importLifecycleState` | 10's, domain none declared | 07 and 09 rows removed |
| `atWorkCenter` in 07 and 09 | 07's, domain none declared | 09 row removed |
| `endedAt` in 06 and 09; 06's `grantedAt` beside 09's `startedAt` | 09's, domain admits a `Grant` and excludes a `Member`, which keeps `joinedAt` and `removedAt` as its one interval | 06 rows removed |
| 06's `decidedAt` beside 09's `eventTime`: an `IdentityDecision` is a `gist:Determination`, which is an event | 09's `eventTime`; the decided-at field points at it | 06 row removed |
| 06's `recordedAt` beside 09's `recordTime`, both labelled "recorded at" | 09's `recordTime` for an event. Decision 98 then brought `recordedAt` back for the audit entry alone, with the domain `AuditEntry`: the entry's written-at field points at it, never at `recordTime`, whose domain is `gist:Event` (report 14 sections 2.2 and 3.5). Both are still labelled "recorded at" | 06 row removed; the row here is report 14's |
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
| `notATerm` (05) beside `noTerm` with a closed list (12) | `noTerm` (decision 21), its closed list six reasons long since decision 98 added deferred | 05 |
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
| `Role` as a class (06) or `MemberRole` as a scheme (10); units as a class (07) or a scheme (10) | for roles, decided: each is a concept of `MemberRoleScheme` and under the same IRI an individual of `Role`, with one identity criterion, the concept's scheme and notation (decision 41). For units, the same shape is the recommendation (pending decision 61) | 05, 06, 07, 10 |
| Cost basis `stated` (07) or none (10) | `stated` (decision 60) | 10 |
| `Party` with two parents (06) against one parent (05) | one identity-bearing parent and category parents (decision 12) | 05 |
| gist names not in `gist-categories.md` used by 06, 07, 09 and recommended by 11 | not added at once: a name is admitted, and added to `gist-categories.md`, only when a term in the slice being built needs it (decision 13). `gist:TemporalRelation` and `gist:Assignment` enter with the thin thread; the other rows stay marked pending | 06, 07, 09, 11 |
| 04's CQ-C04 asking for offers known only by a vendor's name, with no property for it | `vendorName` added to 07 | 07 |
| 09's `LineAllocation` row with no parent while its own question recommended `gist:Content` | the recommendation | 09 |
| Whether Sutton counts reserved inside committed: "not public" (08), read from Sutton's article (10, 11) | 10's and 11's reading, marked unchecked | 08 |
| 09 tagged its event classes `kind`, where 06 and 08 tagged theirs `event` | `event`, as 05's kind tag defines it | 09 |

## Not proposed (the brief's rule)

The brief's rule: a Sutton-only term enters the vocabulary module when a competency question of rank must or should
needs it, never to complete a picture. Decision 87 does not state this rule: it only asks how the competency
questions are ranked. A throwaway script read 04's must and should questions, took every key their
"Terms it needs" column names, and closed that set over this index: a needed property brings the classes and schemes
of its domain and range, a needed class its local parent, a needed scheme its concepts. A class the closure keeps,
and a repository term, also brings the schemes and event classes a recommended decision makes it depend on:
`QualityHold` brings `HoldPlacement`, `HoldRelease` and `HoldReasonScheme` (decision 77), and `CostObservation` brings
`CostBasisScheme` with its concept `CostBasisScheme-stated`, which the `unitCost` lift writes under decision 60 (a).
Decision 60 is open, so that admission is conditional: under its no-basis answer `CostBasisScheme` and `costBasis` are
not proposed. It is not in the list below and not in its count.

After the packet's review the closure was redone by hand for two should questions whose term cells 04 corrected.
CQ-E01 reads the pallet's positive balance at shipment, so it needs `DisaggregationEvent` with `unpacks` and
`unpackedFrom` (their ranges `EventLine` and `LogisticUnit` were already kept), and its customer branch needs
`SalesOrder`, `SalesOrderLine` and `CommitmentLine`, the line's parent and the range of `allocatesLine`. CQ-W03's
scope tests name `forSerialUnit`, whose range is `SerialUnit`, and it selects the book basis,
`PositionBasisScheme-book`. Those six left the list. Two joined it: the same review made `SignInAccount` and
`ModelCall` later, since no schema binds either, and no must or should question names them.

The 65 terms below are
Sutton only or later and no must or should question reaches them, so they are **not proposed**: their rows stay in
their reports as design notes, the curator does not treat them as part of the vocabulary, and each enters only when a
question of that rank needs it. Repository terms (in the repository today) are proposed whether or not a question
reaches them, since a record already points at them. That status says a record supports the term's meaning, not that
a record stores every notation: `GrantScopeKindScheme` rests on the organization scope every record implies, and
`Currency` on a documented USD with no currency field (its projection is decision 88). `MembershipStatusScheme` fails
that test and no must or should question names it, so it is not proposed either, as a sixty-sixth term: the `member`
table stores `removedAt` and no status, and `removedAt` stays the only removal fact.

`AccountStatusScheme`, `AccountingSyncDirectionScheme`, `AccountingSyncRecord`, `AccountingSyncStateScheme`,
`AdjustmentReasonScheme`, `AliasItemSpecification`, `Bom`, `BomExpansion`, `BomExpansionNode`, `BomLine`, `BomRevision`,
`BusinessStepScheme`, `ContactPointKindScheme`, `Container`, `CostFinalityScheme`,
`EvidenceKindScheme`, `FulfilmentProgressScheme`,
`InventoryAdjustment`, `InventoryReservation`, `Invoice`, `InvoicingProgressScheme`, `ItemRevision`,
`ItemUnitConversion`, `Machine`, `ManufacturingOrder`, `ManufacturingOrderLine`, `ModelCall`, `ObjectObservation`,
`OperationDefinition`, `OperationExecution`, `PartyIdentifier`, `PaymentProgressScheme`, `Permission`, `Pick`,
`PortalAccess`, `PortalModuleScheme`, `PositionBasisScheme-counted`, `PostalAddress`,
`PriceList`, `PriceListEntry`, `PurchaseOrder`, `PurchaseOrderLine`, `Putaway`, `QualityInspection`,
`QualityOutcomeScheme`, `QualityResult`, `Quote`, `QuoteLine`, `RecallCase`, `ReceivingRejectReasonScheme`,
`ReceivingRejection`, `Routing`, `RoutingRevision`,
`ServiceItemSpecification`, `SignInAccount`, `StockCount`, `StockMovement`, `SupplierBill`, `SuspectedDuplicate`, `TrackingCode`,
`TransferOrder`, `TransferOrderLine`, `WorkCenter`, `WorkOrder`, `WorkOrderLine`.

The property table above is the full catalog, not the admitted set. A property is emitted only when its own domain
and range are admitted: a proposed class or scheme, a projected gist class, a datatype, or none declared. Five
properties of 06 have an admitted subject and a target that is not: `accountStatus` (`AccountStatusScheme`),
`contactPointKind` (`ContactPointKindScheme`), `evidenceKind` (`EvidenceKindScheme`), `citesIdentifier`
(`PartyIdentifier`) and `permits` (`Permission`). Each target stays not proposed, so none of the five is emitted, and
a subject being in scope does not promote its target. `membershipStatus` is held back the same way, and so is every
property whose domain or range is `SignInAccount` or `ModelCall`. Decision 41 keeps `permits` and `Permission` out of
the thin thread and has them wait for slice 1; whether slice 1 admits them is settled when it is specified.

`ContactAssignment` is proposed, with `contactPerson`, `contactAccount` and `assignmentPoint`: 04's CQ-P03 reads the
purpose and the contact point from the assignment (decisions 39 and 43). The list above still has 65 terms.

## The thin thread and the slices (decision 8)

The thin thread is the first deliverable, and [report 14](14-thin-thread.md) is its one specification. This section
says only which rows of this index the thread takes; everything else about the thread is in report 14, at the
sections named. Slice 1 stays the party slice and follows it; no slice is renumbered.

The thread takes nine term rows of this index: the classes `Organization`, `Tenant`, `Person`, `Member`, `Role`,
`Grant` and `AuditEntry`, and the schemes `MemberRoleScheme` (viewer, editor, admin) and `GrantScopeKindScheme` (the
one concept organization). It takes nine property rows: `membershipOf`, `membershipIn`, `grantedTo`, `grantsRole`,
`grantScope`, `recordedActor`, `action`, `recordedAt` and `inTenant` (decisions 96 and 98). Their labels, definitions,
tags, parents and identity criteria as the thread ships them are report 14 sections 2.1 to 2.4, and where a row here
is shorter or differs, that text holds. The Tag cells of `MemberRoleScheme` and `GrantScopeKindScheme` read
`not applicable: scheme`, because section 2.3 gives a scheme no kind tag. Their gist parent stays
`none: a scheme (pending)`: whether a scheme is also typed by gist is open decision 17, and this index does not
answer it. `Grant` has one identity criterion there, the member and the field it is read
from, and no pair is stated between `inv:` classes (section 2.1). `Role` has no gist parent, by the stated exception
of decision 97, and ships without `permits` (decision 41). The gist names the thread admits are seven classes, five
parents and the two ancestors `gist:LivingThing` and `gist:PhysicalIdentifiableItem`, with the three
`owl:disjointWith` pairs gist states between them (decisions 13 to 15; section 2.5).

The marks on the records are report 14 section 3. Records are enrolled by name, not by folder (decision 99): the
kernel's `Member`, `Role` and `Activity`, and the access contract's `Person` and `AuditTrail` (sections 3.6 and 3.7).
Every field of an enrolled record is placed (decision 22). The `Member` record has five fields and no email: its two
copied names are `noTerm`, reason screen (decision 93; section 3.3), so the thread uses no `name`. The email and the
joining date are on the People page's `Person` record, which is a view of a membership, and both are `noTerm`, reason
deferred, naming the party slice (decision 100; section 3.6), so the thread uses neither `accountEmail` nor
`joinedAt`. Slice 1 places them, the email through `SignInAccount` and `joinedAt` on `Member`, with the name through
`Person` and the audit entry's agent field through `AgentRun` (decision 98).

The one lift, of `Member.role` to a `Grant`, is section 4. The one question, 04's CQ-P06, with its query, fixture,
expected rows and must-fail cases, is section 5. Gates 1 to 9 (decision 95), each with its rules and its one planted
mistake, and the turbo inputs, are section 6; gates 11 and 12 wait for their slices and gate 10 is open decision
27's. The packages and the rows in `laws boundaries` are section 7. The version is `0.1.0`, a string written in the
module (decision 24), and the header of each generated file is section 8. What the thread still owes from Benjamin,
the reasoner download and the 18 `rat-` records (decisions 25 and 101), is section 1.5. The thread waits on none of
the 62 open decisions (section 1.4).

Slice 1 brings what the thread leaves out: `SourceRecord` with `recordOf` and the customer and vendor flags,
which CQ-P01 reads on the tenant's record (decision 34), `ContactAssignment` with its purpose and contact point
(decisions 39 and 43), and the terms its other questions need. Each open decision a slice needs is put to Benjamin
when that slice is specified, with a concrete record.

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
| Decision 34's recommendation made a record an instance of `gist:Organization` and `gist:Person`, which gist disjoins from `gist:Content`, and gave `Person` two identity criteria | `Person` and `Organization` name the party, identity `unresolved` with one criterion; 04's `SourceRecord` and its new `recordOf` hold the reidentification key (decision 34, answered as the changed recommendation; the customer and vendor flags sit on the tenant's `SourceRecord`) | 06, 04, 11, DECISIONS |
| `InventoryMeasure` under `QuantityValue` inherited a value identity and stated a second | information under `gist:Content`, pointing at a `QuantityValue` by `hasQuantity` (decision 74, recommendation changed) | 08, 04, 07, 11 |
| `QualityHold` under bare `gist:Intention` while gist 14.1.0 has `gist:Restriction` | information under `gist:Restriction` (decision 77, recommendation changed and still open; under decision 13 `gist:Restriction` is admitted only when a slice needs `QualityHold`) | 08, 11, DECISIONS |
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
| The record's `Literals` built from the scheme, against decision 2 | the record writes its literals and gate 4 compares (decision 23): each literal must be one of the scheme's notations, and the two lists must be equal only for a schema that is the whole scheme. 10's section 4.12 had still said the `Role` literals come from the scheme's notations; that sentence is withdrawn | 05, 10, DECISIONS |
| `ItemIdentifier`'s identity needed an issuer a name-only vendor cannot give; `Bin` stated an identity as a subkind; definitions that repeated their label; `defaultRevision` and `primaryBom` as second homes | each row corrected | 07, 08, 06 |
| Alignment rows for the dormant `ContactAssignment`; `accountNumberAtParty` with no source; `duns` missing from 10 | rows removed then; `duns` added to 10. Decisions 39 and 43 make `ContactAssignment` the model, so its four alignment rows return to 11 (Sutton "Contact", `org:Membership`, FIBO's Contact, schema.org's `ContactPoint`) | 11, 06, 10 |
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
- After the packet's review, by hand and by search, with no script run: two property rows removed (267 left, the
  owners' counts summing to it), the status totals recounted from the Status column, and the not-proposed list
  recounted (65).
- After Benjamin's answers of 2026-11-22, by hand and by search, with no script run: the rows changed here were read
  against report 06's tables as revised (`ContactAssignment`, `Grant`, `Member`, `Role`, and the properties
  `contactPerson`, `contactAccount`, `assignmentPoint`, `servesPurpose`, `isCustomer`, `isVendor`, `decidesOn`,
  `suspects`, `membershipIn`, `permits`); the term rows recounted (165, 115 of them classes), the property rows (269,
  the owners' counts summing to it), the tags and the status totals.
- After his seven further answers the same day (22, 26, 38, 46 and 94 to 96), by hand, with no script run: no row came
  in or went out and no row's tag or status word changed, so the counts stand (165 term rows, 269 property rows, the
  status totals, 65 not proposed). The rows changed here (`Tenant`, `Person`, `Grant`, `GrantScopeKindScheme`,
  `membershipIn`) were read against the answers in DECISIONS.md, not against report 06, which was being revised at the
  same time.
- After his six further answers (24 and 97 to 101) and report 14, by hand and by search, with no script run: no term
  row came in or went out and no term row's tag or status word changed (165 term rows, the status totals, 65 not
  proposed). The property rows changed as the section "How the index was made" says: four out, two in, 267 left, the
  owners' counts summing to it. The thread's nine term rows and nine property rows were read against report 14
  sections 2.1 to 2.3, and the audit entry's rows against report 06 as it stood during its own revision, where no row
  for `auditAction`, `actorNameThen`, `auditDetail`, `actingAgentName` or `recordedActor` was found.
- After the third review of report 14, by hand, with no script run: the Tag cells of `MemberRoleScheme` and
  `GrantScopeKindScheme` were `information`, which report 14 section 2.3 refuses (a scheme has no kind tag). Both now
  read `not applicable: scheme`. No row came in or went out, no gist parent and no status word changed, and the
  by-tag table counts classes only, so the counts stand (165 term rows, 40 schemes, 115 classes, 267 property rows,
  the status totals, 65 not proposed). Every other scheme keeps the tag its owner wrote. Decision 17 stays open.

## Not checked

- The script read tables only. Prose in a report that names a key in passing was read by hand for the keys renamed,
  and could still name an old key where no search found it.
- Neither seed report was read whole for this reconciliation: their headings were read, and every fact from them is as
  reports 01 and 04 to 12 cite it.
- No term was re-checked against gist 14.1.0, Sutton's public pages or any external file; rows moved between reports
  keep the evidence their first author gave.
- The counts by status count words in the Status column, which several rows fill with more than one status.
