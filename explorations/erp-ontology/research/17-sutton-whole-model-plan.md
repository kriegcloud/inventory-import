---
type: Research
title: A plan for modelling Sutton whole
description: Sutton's 200 record types placed against the packet (a term the packet has, a new term, a part, a view, or nothing), eight slices that would build the model with what each waits on and which pointers run forward, the 45 findings where the schema and the packet's design disagree, the 24 new questions, and what a review of the plan disputed.
---

# A plan for modelling Sutton whole

Decision 124 takes back the brief's rule against modelling Sutton whole. This report says what "whole" comes to and
in what order it could be built. It is a plan and a reading. No term was added to the vocabulary module, and no
decision here is answered. Decision 1 stands throughout: the model of record is this repository's, and each slice
builds the repository's own records first, with Sutton's records as the mapping beside them.

## 1. How it was made, and what that is worth

Sutton's GraphQL schema was read by introspection on 2026-11-26 ([report 16](16-sutton-schema-check.md)). Its record
types were sorted into six families by name, and one reader per family read every type of its family against the
packet's design for that area (reports 06 to 10 and the term index, 13) and the decision log. Each returned a
verdict for every type and enum, the places where the schema and the packet disagree, and the questions that are
Benjamin's. Their full output, with a sentence of reasoning for each type, is
[assets/sutton/readings.json](../assets/sutton/readings.json). Four reviewers then tried to refute this report;
what they found is corrected here or named in sections 4 and 5.

- 199 types were read, and each has exactly one verdict: the lists were compared by script. A two-hundredth,
  `RutterConnection`, was dropped by the sort because its name ends like a page of results. No reader read it. It
  is a tenant's connection to an accounting or sales platform, pointed at by `ExternalOrder`, `ExternalInvoice`
  and `Organization`, and belongs with slice 8's integration links.
- Each family had one reader. Where two families touch the same thing they can disagree, and section 5 names the
  three places they do.
- The verdicts are proposals. A "new term" is a name a reader suggested, not a term: a term enters the vocabulary
  module only by Benjamin's ruling (decision 32; for the thread's terms, decision 107).
- Only the types and the enums their fields use were read: 86 of the 152 enums. Most of the other 66 are sort
  orders and filter arguments, but not all: `WorkOrderStatus` holds a work order's states (the record's own field
  is plain text), and `FileCategory`, `RutterConnectionStatus` and `CreatedThroughType` carry values too.
- The 301 inputs and the mutations were not read, apart from four inputs and a few mutation names that some
  findings rest on. No record of the demo organization was read.

## 2. What "whole" comes to

The readers' verdicts, with one change from the review: seven helper types that list why a delete was refused
(`…DeletionBlockingLinkedRecords`) were counted as computed views and are moved to "no term".

| Family | Record types | Term in the packet | New term | Part of another record | Computed view | No term | Findings |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Party and access | 13 | 8 | 2 | 1 | 2 | 0 | 8 |
| Catalog and how things are made | 29 | 15 | 4 | 6 | 2 | 2 | 9 |
| Places and stock | 11 | 5 | 0 | 3 | 3 | 0 | 8 |
| Commitments and money documents | 17 | 11 | 5 | 1 | 0 | 0 | 10 |
| Execution | 20 | 14 | 1 | 5 | 0 | 0 | 5 |
| Tenant lists, custom fields, settings and layouts | 109 | 3 | 26 | 5 | 0 | 75 | 5 |
| All | 199 | 56 | 38 | 21 | 7 | 77 | 45 |

So 122 of the 199 types read carry something to model, and 77 were given no term. Of those 77, 64 are print and
label layouts, generated PDFs, navigation, pictures of a record, bulk-operation results and helper types, and 11
are settings that hold a tenant's business rules (Appendix B lists them apart; decision 128 gives them no term).
Six of the "part of another record" verdicts are disputed (section 5).

The 38 types marked "new term" come to 18 new terms, because 19 custom-field value types are one term, two
option types are one, and `File` and `FileAttachment` are one.

Of the 86 enums read, 7 match a scheme of report 10 as it stands, 19 match one with different
values, 31 need a new scheme and 29 are not domain things.

The proposed new terms:

| Proposed term | Family | From Sutton's |
| --- | --- | --- |
| `OrderApproval` | Party and access | `Approval` |
| `PermissionGroup` | Party and access | `PermissionGroupDetails` |
| `CustomerItem` | Catalog and how things are made | `ItemCustomer` |
| `StandardOperation` | Catalog and how things are made | `Operation` |
| `Tool` | Catalog and how things are made | `Tool` |
| `ToolSetup` | Catalog and how things are made | `ToolSetupConfiguration` |
| `InvoiceLine` | Commitments and money documents | `InvoiceLineItemNode` |
| `SupplierBillLine` | Commitments and money documents | `BillLineItemNode` |
| `ThreeWayMatchResult` | Commitments and money documents | `BillMatchLine` |
| `ReturnAuthorization` | Commitments and money documents | `OrderReturn` |
| `ReturnLine` | Commitments and money documents | `OrderReturnLineItem` |
| `OperationOutputReport` | Execution | `WorkOrderBatch` |
| `CustomFieldValue` | Tenant lists, custom fields, settings and layouts | `AddressCustomFieldValue`, `CompanyCustomFieldValue`, `ContactCustomFieldValue` and 16 more |
| `CustomFieldDefinition` | Tenant lists, custom fields, settings and layouts | `CustomField` |
| `TenantCode` | Tenant lists, custom fields, settings and layouts | `CustomFieldOption`, `DynamicFieldOption` |
| `TenantCodeList` | Tenant lists, custom fields, settings and layouts | `DynamicField` |
| `Attachment` | Tenant lists, custom fields, settings and layouts | `File`, `FileAttachment` |
| `PackagingType` | Tenant lists, custom fields, settings and layouts | `PackagingTypeDynamicFieldOption` |

## 3. The slices

The brief's Map has slice 1 (party), slice 2 (catalog, with SHACL over the stored sample), slice 3 (the import's
terms), the alignment file, pointers on the Alchemy blocks, the rest of the warehouse and stock terms, the
commitment, execution and accounting terms, and a Sutton description from the same vocabulary. This plan keeps the
brief's slices 1 and 2 first, splits the brief's slice 2 in two, splits and reorders the later parts, and leaves the
import's terms, the Alchemy pointers and the alignment file where the brief has them.

A slice is done as the thin thread was: its terms in the vocabulary module, the projector grown to them, gates 1 to
9 passing, the repository's own records of that area enrolled as the brief says (gate 11 over the stored sample
stays with the item slice), and its competency questions on fixtures. One alignment row for every Sutton type the
slice covers is part of done once the alignment file exists, which waits on open decisions 28 to 31.

| # | Slice | Sutton records it covers | Needs first | Open decisions it waits on |
| --- | --- | --- | --- | --- |
| 0 | Scope | none | nothing | None: P20 was answered on 2026-11-26 (decision 128): the business things get terms, the settings and layouts do not |
| 1 | Party | `Company`, `Contact`, `Address` on a company or contact, the tenant `Organization`, `OrganizationMember` with `UserProfile`, `User` | Report 04's `SourceRecord`; the thin thread | The brief's slice 1 list (12, 17 to 19, 27, 33, 35 to 37, 44, 45, 47, 87, 89, 125, 126); 28 to 31 for its alignment rows; P1, P2 |
| 2 | Tenant lists and values | `DynamicField` and its options (20 lists a tenant fills, and the packaging-type list: categories, tags, payment terms, carriers, reasons), `UoM`, `CurrencyDetails`, `Cost`, `Measurement` | Slice 1's tenant | 59, 61, 62, 88; P21 |
| 3 | Items and offers | `Item`, `ItemVendor`, `ItemCustomer`, `PriceList` with its items and customers, `VariantTemplate` | Slices 1 and 2 | The brief's slice 2 list less 59, 61, 62 and 88, which slice 2 takes (48 to 51, 54, 55, 60, 63 to 66, 74, 76, 90, 92), and 73; P7 |
| 4 | Places, stock and access by place | The tenant's `Address` as a site, `WarehouseLocation`, `Inventory`, reservations, `InventoryAdjustment`, `InventoryLedger`, lot traceability; then `RoleDetails`, `Permission`, `PermissionGroupDetails` and a member's assigned locations | Slice 3's items; slice 1's members | 42, 67 to 72, 75, 77 to 79, 116, 127; P3, P4, P8 to P11 |
| 5 | How things are made | `Bom` and `BomItem`, `ItemRouting` and its operations, `Operation`, `Equipment`, `Tool` and its set-ups | Slice 4's places, because Sutton's work center is a location | P5, P6 (66 and 67 are answered by slices 3 and 4) |
| 6 | Commitments | `Quote`, `Order`, `PurchaseOrder`, `TransferOrder` and their lines, `Approval`, order charges | Slices 1, 3 and 4 | 80 to 84; P15, P16, P23 (the carrier is first met on an order) |
| 7 | Execution | `Job`, `WorkOrder` with its logs and batches, `QualityCheck`, `ReceivingTicket`, `Shipment`, picking, packing, a transfer's arrival | Slices 4, 5 and 6 | 85; P17 to P19 (79, 80, 82 and 89 are answered by slices 1, 4 and 6 and are read again here) |
| 8 | Money documents, returns, and what a tenant adds | `Invoice`, `Bill` and their lines, the three-way match, `OrderReturn`, `RutterConnection` and the sync status with an accounting platform; then `CustomField` and its values, `File` | Slices 6 and 7; every record that can carry a custom field | 86; P12 to P14, P22, P24 |

A decision listed for one slice and met again by a later one is answered by the first.

**Pointers that run forward.** Sutton's records point at each other in both directions, so no order has every
target built before its source. The rule this plan proposes: a field that points at a record of a later slice is
not mapped in its own slice. It is mapped when the later slice lands, and each slice's specification lists the
fields it leaves. The ones the review found:

| Field | Its slice | Waits for |
| --- | --- | --- |
| `UserProfile.role`, `UserProfile.assignedLocations` | 1 | 4 (roles, sites). Until then slice 1 has members with no Sutton grant |
| `Organization.defaultCurrency`, `Organization.defaultUom`, `Address.customerPaymentTerm`, `Address.vendorPaymentTerm` | 1 | 2 |
| `Item.defaultWarehouseLocation` | 3 | 4 |
| `Item.itemRouting`, `Item.boms` | 3 | 5 |
| `Inventory.purchaseOrderItem`, `Inventory.reservedForOrderItem`, `ReservedItem.orderItem` | 4 | 6 |
| `ReservedItem.bomItem` and `job`, `Inventory.jobBatchLogs`, `InventoryLedger.source` | 4 | 5, 6 and 7 |
| `PurchaseOrder.job`, `PurchaseOrderItem.job` and `workOrder` | 6 | 7 |

Slices 3 and 4, and 6 and 7, point at each other most. Merging each pair is the alternative; it makes two slices
twice the size, and the plan keeps them apart so that each ends in something checked.

Three more things about the order:

- **Slice 1 is where the work starts**, and it is the brief's slice 1 with Sutton's records in view. Every other
  family names a member (who created a record), a company (whose order it is) or an address (which site).
- **Tenant lists come second because five families point at them.** An item's category, an adjustment's reason, a
  shipment's carrier and a quality check's checkpoint are all an option a tenant typed into a list. Until P21 says
  what such an option is, those fields have nowhere to land.
- **Roles and permissions sit in slice 4, not slice 1**, because a Sutton member's access is limited by site, and a
  site is a place. The cost is the first row of the table above.

## 4. Where the schema and the packet disagree

The readers returned 45 findings where a definition, an identity criterion or an answered decision in the packet
does not hold for Sutton's records. Two pairs are the same finding from two readers (the `Invoice` definition, and
`carriedBy`), so there are 43 places. A few are the packet disagreeing with itself, which the schema only makes
concrete. None is fixed here: a definition in the vocabulary module changes by a ruling, and a design report is
corrected when its slice is specified.

The table is the readers' text, with question numbers changed to this report's. A row marked † says more than its
source shows; the corrections follow the table.

| Family | The packet says | The schema says | What follows |
| --- | --- | --- | --- |
| Party | DECISIONS.md decision 3, 'What it gives up': "a person cannot be an Account"; decision 34: "the Sutton Account is the organization" | Company.kind is company or individual, and individual is "a person modelled as a company — a sole trader or a retail customer", fixed at creation | The Organization ↔ Sutton Account mapping holds only for kind company; open decision 125 resolves it, and decision 3's sentence would be struck. |
| Party | DECISIONS.md decisions 39 and 43: "a contact purpose sits on the assignment, not on the address or contact point alone" | Purpose is on Address.type (billing, shipping, ship_from, manufacturing, other) with is*Default flags; Contact has one optional company and a type of customer, marketing, sales or vendor, never a purpose at a point | No ContactAssignment can be read from Sutton without making up pairs; open decision 126 keeps 39 and 43 for other sources only. † |
| Party | Terms.vocab.ts Organization identity (decision 103): "the same organization being the same legal entity"; Tenant: "An organization for which this application keeps a workspace", told apart in the repository by OrganizationId (decision 38) | Sutton's Organization is a workspace with accountType customer, internal, sandbox, trial or unassigned, so one company can have several | A Sutton Organization cannot be minted as a Tenant per row: two workspaces of one legal entity would be two tenants, or their records would merge under one inTenant. It has to be read as a SourceRecord of the body (P1). † |
| Party | Terms.vocab.ts Role identity: "the concept's scheme and notation (decision 41)"; definition "A named level of access ... such as viewer, editor or admin" | A custom RoleDetails has name null (no MemberRole notation), only an id, an editable displayName and the permission groups it grants; built-in roles MANAGER and SHOP_FLOOR_OPERATOR are functions, not ranked levels | A custom role has no notation for the stated criterion to use, and 'level' fits Sutton's roles poorly. The criterion needs a tenant-and-id form for custom roles (P3). † |
| Party | Terms.vocab.ts Grant definition: "An assignment of one role to one member at one scope"; identity "the member it is granted to and the record field it is read from" | UserProfile has one role and a list assignedLocations (null for all), plus includesUnassignedLocations for records with no location | One Sutton field gives one role over several locations and over 'no location', which no GrantScopeKindScheme concept covers. Either a grant per location is lifted from one field, which breaks the identity criterion, or a grant has many scopes, which breaks the definition (open 42 and 116). |
| Party | Terms.vocab.ts Member definition: "lets the person act in the tenant's workspace from the day it is made until it is removed" | OrganizationMember and UserProfile exist for pending and revoked members (MemberStatus), and RoleDetails.memberCount counts "invited and suspended members as well as active ones" | A pending invitee is a Sutton member who cannot yet act, so the definition is false of it (P2). |
| Party | Report 06 properties table: accountStatus, domain Organization | CompanyStatus is on Company, the tenant's record of the party; report 10 section 4.29 already says "one per account's SourceRecord ... not the shared organization" | Report 06's domain contradicts decision 34 and report 10. The domain should be SourceRecord, as decision 34 put the flags there. † |
| Party | Report 06 properties table: hasPostalAddress, domain Party | Sutton addresses on a Company carry tenant-specific customerPaymentTerm, vendorPaymentTerm and default flags | These are the tenant's assertions, which decision 34 puts on the tenant's SourceRecord, not on the shared body. Hanging the address on the Party mixes one tenant's terms into another's view. |
| Catalog | 07 section 3, `BomRevision`: "lists, for one bill of materials from a stated date, the component lines needed to make a stated output quantity"; `defaultRevision`: "the version used when an order names none" | A `Bom` version has no date. The latest version is current and `boms` always returns it. `BomItem.quantity` is "for one unit of the parent item". `isDefault` marks the item's default bill, not a default version. | `effectiveFrom` and `outputQuantity` stay empty for Sutton, or `outputQuantity` is fixed at one unit. `defaultRevision` has no Sutton source: the latest revision is the one in force. |
| Catalog | 07 section 3, `WorkCenter`: "a grouping of equipment, people and capacity ... which need not be one machine or one place" (decision 67 open, recommending not a `Location`) | `Equipment.workCenter` and `OperationConfiguration.warehouseLocation` are a `WarehouseLocation!`, and `WarehouseLocationType.workCenter` is a location that stock can sit in. | Sutton's work center is a place. Under 67 (a) one row makes two individuals. See open decision 67. |
| Catalog | Decision 3: "terms, price lists and portal access sit on the organization, not on the relationship"; 07's `assignedPriceList` domain `Organization` (06) | `PriceListCustomer.customer` is a `Company`, which may be of kind `individual`, "a person modelled as a company" | An `Organization` domain cannot hold a retail customer's price list. Decision 34's reason also puts the assignment on the tenant's record. See P7, and 125. † |
| Catalog | 10 section 4.5: "Sutton public: an item is Standard or Serialized"; 4.2 treats item kind and tracking as separate fields | `TrackingMethod` is `alias`, `serialized`, `service`, `standard`, one field | Section 4.5's source line is wrong for the API. The mapping needs a split rule (open decision 65). |
| Catalog | 07 section 3, `OperationDefinition`: "one planned step of a routing revision: the work center it needs and the setup and run time" | `ItemRoutingOperation` has times, a position and instructions but no work center. The work center is on the reusable `Operation` (`defaultWarehouseLocation`, `operationConfigurations`). | A Sutton step reaches its work center only through the operation it names. The definition or the mapping must change (P6). |
| Catalog | 07 section 3, `ItemUnitConversion`: "how many of one unit make one of another unit for one item, from a stated date"; identity "not the item and its two units, since a factor changes over time" | Conversions have no date. One sits on the vendor item (`unitConversionRate`, `unitConversionRateInverted`, `vendorPurchaseUoM`). One sits on the item (`numberOfUnitsPerDefaultPackageType` for `defaultPackagingType`). | `conversionFor` ranges over `ItemSpecification` only, so a vendor-scoped factor has no subject. `effectiveFrom` has no Sutton source. † |
| Catalog | 07 section 3, `PriceList`: "for a period"; `PriceListEntry`: "the price of one item per unit, from a minimum quantity" | `PriceList` has no dates. `PriceListItem` has no minimum quantity. Without `overridePrice` an entry's price is derived from the item's default sales price by the list's markup, discount or set_to rule. | `minimumQuantity` and the period stay empty for Sutton. A derived price is a computed view, not a stated `unitPrice`, and the list-level rule needs properties. † |
| Catalog | 08, `Machine`: "a piece of equipment that performs production operations and whose running state a detector or an operator records over time" | `Equipment` has a status (active, inactive, maintenance, retired), a serial number and a warranty, but no running state. Machine telemetry is will-not in 04. | Sutton equipment fits `Machine` only if its definition drops the running-state clause, or a broader equipment term is added. |
| Catalog | 07 section 3, `VendorItem` identity: "not the pair of vendor and item, since one vendor may sell one item in two pack sizes" | `itemVendor(itemAndVendorIds)` returns one `ItemVendor` per item, vendor and optional vendor address | Identity by source id still holds. The stated reason does not hold for Sutton, and the vendor address is part of what tells two Sutton vendor items apart. † |
| Places | 08, Places: `Bin` "A location within a warehouse that is the smallest slot..."; `hasParentLocation` "The location that immediately contains this one" | `WarehouseLocation` has no parent-location field, only `address: Address` (nullable). Report 16 D maps the address to Warehouse, while 16 J calls the same addresses sites. | A Sutton bin is either not "within a warehouse" or its address must be a Warehouse with no Site above it. Report 16 contradicts itself on which one; P9 settles it. † |
| Places | 08, Places: "this document keeps only `sitedAt` ... and the answer that a work center is not a place" (pending decision 67 (a)) | `WarehouseLocationType.workCenter` is a stock-holding location (ledger `warehouseLocation`, `stockItems`); `Equipment.workCenter: WarehouseLocation!`; a work order always has one `WarehouseLocation`. | Sutton's work center is a place. Under 67 (a) one Sutton record must lift two individuals (a Location and a WorkCenter). |
| Places | 08, properties: `expiresOn` "The last day a lot may be used", domain `MaterialLot`; decision 127 (a) recommended: no lot is minted for Sutton | `Inventory.expirationDate` is stated per label. | Under 127 (a), Sutton's expiry has no property to land in. |
| Places | 08, terms: `InventoryLabel` "A portion of the stock of one item specification, of at most one lot" | `Inventory.item` is optional, `isMixed: Boolean`, `nestedInventory`, `storageType: nested`. | A nested mixed Inventory is not an InventoryLabel by the packet's definition. The record needs a term chosen per row (P8). |
| Places | 08, terms: `InventoryAdjustment` "An event that changes a book quantity at a scope by a signed amount, for a stated reason"; identity "Tenant and source id" | `InventoryAdjustment` has `status: draft \| completed`, one `adjustmentReason` and many `lineItems`, each with its own `inventory` and `quantityChange`. | A draft is the same record but no event has happened, and the one signed amount is per line. The amount and label move to 09 EventLines, and a draft either points at no term or needs a lifecycle scheme. |
| Places | 08, terms: `LabelSplit` identity "Tenant and source id"; section 3: "`splitFromLabel` is not a stored property here: it is the path `^inv:splitResult/inv:splitSource`" | Sutton stores `Inventory.splitFromInventory` directly. `splitSerializedInventory` returns only the new and original labels, and no split record with its own id exists. | A LabelSplit lifted from Sutton has no source id. Its identity must come from the new label (one split per new label) and its time from that label's `createdAt`. |
| Places | 08 section 2: "'Quarantined' as a Sutton label status ... is read as 'a quality hold in force covers this label'"; 10 4.30: "A count kind and a reservation status are not designed" | `ReceivingItemStatus` is one field, one value at a time: `active \| depleted \| quarantined \| reserved`. | Sutton states both quarantine and reservation as label phases. `quarantined` replaces `active`, so the packet's reading is a re-modelling (16 L). `reserved` has no concept: it lifts as nothing beside the `ReservedItem` rows, or needs one. |
| Places | 08 section 5: available "May be negative (overcommitted)"; "Sutton's formula is not public"; 10 4.21 `committed` "reservations included" (from the public article) | `Item.quantityAvailable` is "`quantityInStock` less `quantityQuarantined` and `quantityReserved`, never below 0"; `quantityCommitted` is a separate field that the formula does not use. | Sutton's rule is A = max(0, H − Q − R), which is none of decision 75's options (c) or (d). Under 75 (a) it is kept as a `reported` measure under that rule's name. The O = R reading of Sutton's Committed is not supported by the schema. |
| Commitments | 09, Accounting boundary, `Invoice` definition: "Content that asks a customer to pay ... sent to an outside accounting system" | `hasAccountingIntegration`: "Without one, invoices and bills are created without being pushed anywhere"; `Bill.status` is "Null for bills created without an accounting integration" | An invoice or a bill exists with no accounting system. Drop "sent to an outside accounting system" from the definition, and leave sending to `AccountingSyncRecord`. |
| Commitments | 09, `SupplierBill` definition: "Content in which a vendor asks the organization to pay" | `Bill.documentNumber`: "The vendor invoice number if one was provided when billing; otherwise the Digit-generated PO document number" | A Sutton bill can be made with no vendor document. It is the organization's record of what it owes a vendor under a PO, so the definition and 11's row should say so. † |
| Commitments | Decision 84's Why (open): "Sutton's public three-way matching refuses billing beyond receipt"; 09's Alchemy table gives `QuantityBeyondReceived` as the invoice's rejection | `quantityExceedsReceived` is a `BillMatchExceptionReason` recorded on the bill line and overridable (`Bill.overrideReason`); `allowInvoiceBillOverQuantity` is a tenant setting; `enableThreeWayMatching` says bills must match "before they can be paid", not before they are created | Billing beyond receipt is recorded with an exception, not refused. The rejection example is wrong, and 84's reasoning needs this source. † |
| Commitments | 09 property `matchesReceipt`: "Relates a vendor bill to a receipt it was matched against" (`SupplierBill` to `Receipt`) | `BillMatchLine` compares against `receivedQuantity` on the `purchaseOrderItem`; no field links a `Bill` or a bill line to a `ReceivingTicket` | Sutton matches per PO line against a received total, not against a receipt, so `matchesReceipt` has no Sutton source. The match becomes the new match result's quantities. |
| Commitments | 09 property `raisedFor`: range `CommitmentLine` ("Relates a commitment to a line of another commitment it was raised to supply") | `PurchaseOrder.sourceOrder: Order`, `PurchaseOrder.job: Job`, `Order.convertedPurchaseOrders` link whole orders | An order-level link has no target under the current range (P16). † |
| Commitments | 09 `Quote` definition "to one customer"; `PurchaseOrder` definition "commits to pay a vendor"; decision 81 (open) recommends a draft is an instance of its class | `Quote.customer: Company` and `PurchaseOrder.vendor: Company` are both nullable | A quote or PO with no counterparty (presumably a draft) fails the definitions. Either the definitions allow it before the phase that binds, or SHACL requires the counterparty only past draft. |
| Commitments | 09 `Receipt` definition: goods arrive "from a vendor, a carrier or another of its sites" | `OrderReturnReceiptItem` records goods received from a customer; `CreatedThroughType` includes `rma` | A customer return's arrival is not a `Receipt` as defined. Widen the definition or add an event (P12). |
| Commitments | Report 10, 4.17 applicability table: PurchaseOrder has InvoicingProgressScheme "no" and PaymentProgressScheme "no"; Quote has both "no" | `PurchaseOrder.billStatus: BillStatus` (the same five values as `InvoiceStatus`); `Quote.paymentStatus: PaymentStatus` | Billing progress applies to POs, and payment status to quotes. The table needs rows for both, or a reason for leaving them out. † |
| Commitments | 09 Lifecycle schemes: "A line's state (open, partly met, met) is not a scheme ... worked out by a View", against report 10's `FulfilmentProgressScheme` "applies: one per order or line" | `OrderItem.fulfillmentStatus`, `pickingStatus` and `packingStatus` are stored per line | The packet contradicts itself, and Sutton stores the line state. Settle it as a view on the line, with Sutton's value kept as a source word checked against it. |
| Commitments | 09 `CommitmentLine` definition: "one quantity of one item by one date" | `TransferOrderLineItem` has no date (dates are on `TransferOrder`); `OrderItem.deliverBy` and `QuoteItem.deliverBy` are nullable; `OrderItem.item` and `QuoteItem.item` are nullable | A line can have no date and no item. The definition should make the date optional (or inherited from the order), and say what a line with no item is. |
| Execution | Report 09, Properties, `carriedBy`: range `Organization` (06), source "decisions 3 and 34: the carrier is the organization" | `Shipment.shippingCarrierField` and `ReceivingTicket.shippingCarrierField` are `DynamicFieldOption`, a tenant's picked option. No carrier is a `Company` (report 16 B). | `carriedBy` cannot be filled from Sutton unless an `Organization` is minted from an option, which is identity from a name unless the option is first made a record of a party (P23). |
| Execution | Report 09, Execution events, `Shipment`: "A transaction in which goods leave a site of the organization and pass out of its custody" (tag event) | `ShippingStatus` is `awaiting_carrier`, `awaiting_drop_off`, `awaiting_pickup`, `cancelled` or `shipped`. The record exists before anything leaves and can be cancelled. | A Sutton shipment in any status other than `shipped` is not an instance of `Shipment` as defined. A 1:1 alignment row is wrong until P17 is answered. |
| Execution | Report 09, Commitments, `WorkOrder`: "A commitment, part of one manufacturing order"; property `workOrderOf` from `WorkOrder` to `ManufacturingOrder` | `WorkOrder.job: Job` is optional, and a work order can carry a `purchaseOrderItem`. `Job.hasFullAccess` speaks of reaching a job "only through one of its work orders". | A work order with no job fails the definition and any record rule requiring `workOrderOf`. Either the definition drops "part of one manufacturing order" or such work orders get no term. |
| Execution | Report 09, Commitments, `ManufacturingOrderLine`: "names one material to consume or one output to produce"; property `plannedOutputOf` | A `Job` has one output on its header (`item`, `targetQuantity`). Its only lines are components (`itemsToPick`). | `plannedOutputOf` has no Sutton line to read. An output line would have to be made up from the header, so the mapping should point the output at the order itself. |
| Execution | Report 09, Execution events, `QualityResult`: "kept by revision when edited"; identity "the check it is of and the result's revision" | `QualityCheck` holds its own result (`status`, `notes`, `files`), has no revision field, and `updateQualityCheck` edits it in place. | A `QualityResult` from Sutton has no revision to be identified by. Only the latest result can be stated, as with `RowOutcome` under open decision 53. |
| Tenant lists | Report 09 property table, `carriedBy`: "Relates a receipt or a shipment to the organization that carried the goods", range `Organization`, citing decisions 3 and 34: "the carrier is the organization" | The carrier on Shipment, Order, PurchaseOrder, ReceivingTicket and Invoice is `shippingCarrierField: DynamicFieldOption`, an entry of the tenant's `OrganizationDynamicFields.shippingCarriers` list; `scacCodes` is a separate list; Company.type is only customer or vendor | No Sutton carrier can fill carriedBy without minting an Organization from a list entry; a person's mapping step or a change to the range is needed (P23). |
| Tenant lists | Report 09 term table, `Invoice`: "Content that asks a customer to pay ... sent to an outside accounting system" | `Invoice.externalInvoice: ExternalInvoice` is nullable and `RutterAccountingProperties.allowCreateInvoice` is a setting: an invoice exists in Sutton with no outside copy (report 16 section 2: sent 'when one is connected') | Being sent is not part of what an invoice is; the definition should say 'which may be sent', or every local Sutton invoice falls outside the class. |
| Tenant lists | Report 09 term table, `SupplierBill`: "Content in which a vendor asks the organization to pay ... under a purchase order, matched against what was received" | `RutterAccountingProperties.enableThreeWayMatching` is a per-connection setting, and `ExternalBill.isLocal` marks bills created with no accounting integration | Matching is a tenant's option, not a defining trait; a bill from a tenant with matching off would contradict the definition. † |
| Tenant lists | Report 09 term table, `AccountingSyncRecord`: "records one attempt ... with the outside id, the outcome and any error", identity "the document, the direction and the attempt's time" | `ObjectSyncStatus` (id, status: String, timestamp, errorMessage) has no direction, and Sutton holds one `lastSync` per Bill or ExternalInvoice, not each attempt | The identity's direction cannot be read from Sutton and earlier attempts are not in the source; the identity must accept a stated or fixed direction (P24). |
| Tenant lists | Report 16 section 3: "custom fields on twenty kinds of record" | `CustomFieldContext` has 20 values, but only 19 `*CustomFieldValue` types exist; `deal` has none, and no `Deal` type appears in the schema | Nineteen host records carry custom fields as far as the schema shows; `deal` cannot be mapped until Sutton's deal record is found. |

Corrections to the rows marked †, from the review:

- **Contact assignment.** An address can sit on a contact as well as on a company (`Contact.addresses`), and it
  carries a type. So where a contact has a company and a typed address of its own, an assignment with a purpose and
  a point can be read; only otherwise would one be made up. Open decision 126's reasoning has the same gap.
- **Workspaces.** That one company can hold several Sutton organizations is an inference from the account types
  `sandbox` and `trial`. The schema links no two organizations. P1's reasoning rests on the same inference.
- **Roles.** A custom role also has a description and its permissions. The schema does not say whether roles are
  ranked; `CurrentUser.canManageRoles` is "tied to the built-in admin role", which hints that one is above the rest.
- **Unit conversions.** A third factor sits on each purchase order line (`PurchaseOrderItem.unitConversionRate`),
  dated by its order.
- **Price lists** have no validity period; they do have `createdAt` and an active or inactive status.
- **Vendor items.** That there is one per item, vendor and address is read from the shape of a lookup. The schema
  states no uniqueness.
- **Report 16** does not contradict itself: its finding D leaves the level open ("a site or warehouse") and maps it
  to Warehouse, and its finding J reads it as a site. P9 settles it.
- **Account status and price list assignment.** Decision 34 placed only the customer and vendor flags on the
  tenant's record. Putting status there is report 10's, and putting the price list assignment there is the
  reader's recommendation (P7). Report 06 against report 10 on status is the packet disagreeing with itself.
- **`raisedFor`.** Sutton states the link at both levels. `Job.salesOrderItem` fills `raisedFor` as it is defined;
  only the order-level fields (`PurchaseOrder.sourceOrder`, `PurchaseOrder.job`) lack a target (P16).
- **Three-way match.** Sutton records a match on every bill. The setting decides only whether a bill must be
  matched before it can be paid, so the `SupplierBill` definition is not contradicted.
- **Billing beyond receipt** is made only with an override whose reason is recorded. `allowInvoiceBillOverQuantity`
  is about exceeding the ordered quantity, and is a setting of the accounting connection, not of the tenant.
- **`SupplierBill`** has no row in report 11; the places to correct are report 09's term table and report 13.
- **Bill status** has five values parallel to the invoice status, not the same five.

## 5. Disagreements

Between two readers:

- **A work center (open decision 67).** The catalog reader recommends 67 (c), a subkind of `Location`, and the
  stock reader 67 (a). Both saw the same fact: Sutton's work center is a `WarehouseLocation` of type `workCenter`
  that holds stock, and equipment and work orders point at it.
- **A tenant's option lists (P21).** The catalog reader would make each option a `gist:Category` individual in the
  tenant's data. The reader of the lists themselves would keep each list as the tenant's own code list, keyed by
  tenant and option id, mapped by a person to a concept of ours where one exists. They agree that an option never
  becomes a concept of the vocabulary; they differ on the class it is given. P21 is the two questions merged.
- **The carrier (P23, and open decision 89).** The execution reader would mint a record of an organization for
  each carrier option, and holds that 89 asks this. The reader of the lists would write no carrier until a person
  has mapped the option to an organization once, and holds that 89 asks only about carrier flags. P23 is put as a
  new question; if Benjamin reads 89 as holding it, P23 folds into 89.

Between the review and a reader's verdict. The verdicts stand in Appendix A, marked:

- **`UserProfile`** is called part of the member record, yet other records name it as who did something
  (`assignedTo`, `receiveProfiles`). A part cannot be what an actor property points at: either it is the member
  record, or the plan must say which of the two an actor is.
- **`MultiOrderShipmentGroup`** is called part of a shipment. Shipments, picks and orders point at it, so it reads
  as a record of its own: several orders shipped together.
- **`PackedItem`** is called a line of a packing event, and no record of the event exists above it.
- **`WorkOrderLog`** is called part of an operation run, while P18 recommends that the interval built from two log
  rows is the run. The log row is the stored record.
- **`PackagingTypeDynamicField`** is one of the tenant's lists, an instance of the proposed `TenantCodeList`, not
  a part of one.
- **`ExternalBill`** is reached only from a refused delete, so it is a view of a bill, not a part of one.
- **`ItemImage` and `ToolImage`** get no term while a file of a record is the proposed `Attachment`. Either a
  picture is an attachment, or the difference needs stating.

## 6. The questions the plan raises

Twenty-four questions that the readers held no open decision asks. None has a row in the packet's Open table
(decision 124 names P20): each is moved there when the slice that needs it is specified, as the brief's rule has
it, and is then put to Benjamin with a record from the demo in front of him. The recommendation and the reason
are the reader's, uncorrected; section 4's corrections apply to P1.

| # | Family | Question | Recommended by the reader | Why |
| --- | --- | --- | --- | --- |
| P1 | Party | Is a Sutton Organization the Tenant, or a record of the tenant's body? | (a) A SourceRecord whose recordOf is the tenant's Organization; inTenant stays the repository's tenant; a sandbox or trial workspace is another record of the same body, never a second Tenant | Decision 103 makes an organization the legal entity, and Sutton keeps sandbox, trial and internal workspaces of one company; (c) breaks 103, and (b) changes the range of the thread's inTenant, a breaking change under decision 24. |
| P2 | Party | Is an invited (pending) or revoked Sutton member a Member? | (a) Yes: a Member from the invitation, its stage a MembershipStatusScheme concept, the Member definition widened from 'lets the person act' to include the invited stage | Sutton gives a pending member an id, a role and locations, and RoleDetails.memberCount counts invited members; (b) drops grants Sutton states; (c) leaves the accepted definition false of invitees. Changing a thread definition is recorded as breaking (decision 24). |
| P3 | Party | How are Sutton's roles written, built-in and custom? | (a) Role individuals of their own, concepts of a new Sutton role scheme, aligned to MemberRoleScheme by SSSOM only; a custom role identified by its tenant and its Sutton id | They are another app's roles and not ranked; (b) mixes two apps' roles in one closed scheme, and (c) loses what a Sutton role permits. A custom role has no notation, so Role's identity criterion (decision 41) needs a second form either way. |
| P4 | Party | Which Sutton level is the packet's Permission? | (a) Both: Permission is one DigitPermission action, a new PermissionGroup is what a role grants, with requiresPermission moved to the groups | RoleDetails lists both permissionGroups and permissions, Sutton's dependencies are between groups, and every field's access rule names a single action, which a question such as 'may member M read company details' needs. |
| P5 | Catalog | What does one Sutton `Bom` row denote, given that every update makes a new row and `versionId` stays the same? | (a) A `BomRevision`; `versionId` mints the enduring `Bom`; `isDefault` is the item's `primaryBom`; a job's own BOM is a revision bound by 09's `usesBomRevision` | Sutton says that `id` names one version and `versionId` the lineage, which is the packet's own split. Under (b) a job bound to an older version points at nothing. It fits decision 66 (a), alternates as second bills. |
| P6 | Catalog | Is Sutton's reusable `Operation` a term of its own beside the routing step that uses it? | (a) Yes: a new `StandardOperation` task template; `ItemRoutingOperation` is `OperationDefinition` and points at it | One operation is shared by many items' routings and carries its own work center, equipment, tools, type and service item. Under (b) a change to it has no single home, which breaks decision 2. |
| P7 | Catalog | What do a tenant's terms with one company hang on: a price list assignment, a customer item, a vendor item? | (a) The tenant's `SourceRecord` of that company, so `assignedPriceList` and the offers' counterparty range over it and a company of kind `individual` works too | Decision 34's reason (one tenant's vendor is another's customer) applies to prices just as it does to flags. Sutton's `PriceListCustomer.customer` can be a person (decision 125), which an `Organization` domain refuses. |
| P8 | Places | What does a Sutton `Inventory` record denote, given that one can hold others (`nestedInventory`, `storageType: nested`) and hold several items (`isMixed`, `item` optional)? | (a) `single` points at InventoryLabel and `nested` at LogisticUnit, the term chosen by `storageType` as decision 125 (a) chooses by `kind` | InventoryLabel is "of one item specification", which a mixed nested record breaks. LogisticUnit ("contents may change while it stays the same unit") is what 08 already aligns to Sutton's container. (c) mixes up the vessel and the load, which 08 keeps disjoint. |
| P9 | Places | What is the tenant's organization `Address` in stock terms, given that `WarehouseLocation` sits directly under one with no parent location? | (a) A Site, with Sutton's bins directly under it and Bin's definition widened to "within a warehouse or, where the source has no warehouse level, a site" | 08 defines a site by its one address, which is exactly Sutton's address, and report 16 J already calls addresses sites for grants (decision 42). (b) contradicts J and leaves `operatedBy` with no subject. (c) states a level nobody recorded. |
| P10 | Places | What does a Sutton `InventoryLedger` entry denote? | (a) An 09 EventLine of the event its `source` names: `type` picks the event class, `quantityTotal` is lifted as a book StockPosition of the label as of `createdAt`, and `costAdjustment` entries become CostObservations | A move by hand (`moveBulkInventory`), a split and a starting balance leave no record except the ledger entry. Under (c) those events are lost, and (b) puts a second home beside 09's event lines. |
| P11 | Places | How are Sutton's system locations `transit` and `unassigned` read? | (a) `transit` is no Location: stock there is lifted as the `inTransit` measure for its transfer order's destination, never as `onHand`. `unassigned` is no Location: its stock is at the address's site | 08 keeps T out of H at both ends so that a transfer is never counted twice or not at all. A transit place counted as on hand brings that double count back. `unassigned` means only "no bin". |
| P12 | Commitments | What is a Sutton order return (`OrderReturn` with its lines and receipt items)? | (a) A seventh commitment kind, `ReturnAuthorization` under `gist:Commitment`, whose lines are `ReturnLine` under `CommitmentLine` and whose receipt items are `EventLine`s of a `Receipt`, with `Receipt`'s definition widened to goods coming from a customer | Sutton keeps expected quantities per sales order line before anything arrives, with an open or finished status, which is promise then performance as 09 splits them. Under (b) a return with nothing received yet does not exist. (c) is a false is-a, since a return is not a sale. It changes the disjoint set of commitment kinds (six to seven), the `Receipt` definition and two new schemes (return disposition, return progress). |
| P13 | Commitments | Are invoice and bill lines terms of their own? | (a) Yes: `InvoiceLine` and `SupplierBillLine` under `gist:Content`, each part of its document, billing one commitment line (a new `billsLine`) with a quantity and a unit amount | Invoicing and billing progress, `quantityAvailableToBill/Invoice` and the three-way match are all counted per order line from these lines. An invoice line outlives its sales order line (`orderItem` is nullable, `item` is kept). `InvoiceLineItemNode` has no `id` in the API, so under (a) its identity is the invoice and its order line, which is a record rule to state. |
| P14 | Commitments | Is a three-way match a stored result or only a view? | (a) A stored `ThreeWayMatchResult` (content) per bill line, with a `BillMatchExceptionScheme` and a `ThreeWayMatchOutcomeScheme`; the bill-level and PO-level `matchStatus` are views over it | Sutton's `BillMatchLine` is a snapshot taken at billing, and a person can set it to `manuallyVerified` while the exceptions stay. A view would lose both once receipts or the PO change. The match also decides whether a bill can be paid when the tenant turns matching on. |
| P15 | Commitments | How are an order's own money amounts (shipping fees, freight, tax, discount, `PaymentAdjustment`) modelled? | (a) One part record, say `OrderCharge`, with a `MoneyAmount` and a charge kind (shipping, freight, tax, discount, or a tenant's adjustment option), so the lines and charges add up to the order total | `Order.currency` lists "lines, shipping, tax, discount, payment adjustments" as the order's costs, so a payment adjustment reads as a charge, not a payment received, though its meaning was not checked against a record. One shape lets a total be checked against its parts (CLAUDE.md: show the totals). (b) gives about ten properties that differ between quote, order and PO for one idea. |
| P16 | Commitments | What may `raisedFor` point at, given that Sutton links a purchase order to a whole sales order or job? | (a) Widen its range to `gist:Intention`: an order or a line | Sutton records both levels (`PurchaseOrderItem.job` and `workOrder` at line level, `sourceOrder` and `job` at order level). (c) states pairs nobody recorded, as decision 126's reasoning rejects for contacts, and (b) loses the link from a sales order to the purchase orders made from it. |
| P17 | Execution | Is a Sutton `Shipment` the event of goods leaving, or a planned shipment whose `shipped` status marks that event? | (a) Keep 09's `Shipment` as the event; mint it from a Sutton record only once `shippingStatus` is `shipped` (event time `shippedOn`); awaiting and cancelled records stay records with no event | It needs no new term and keeps 09's split between promise and performance. Under (c) a cancelled shipment would be an event that never happened. (b) is right only if a competency question asks about shipments not yet gone. |
| P18 | Execution | What is one operation run (`OperationExecution`) in Sutton? | (a) One `WorkOrderLogInterval`: one person from start to stop on one work order; the `WorkOrderLog` rows give `startedAt` and `endedAt` | The interval is Sutton's own record, with an id, a person and an open end. Under (b) a work order paused and resumed by three people becomes one run with no single performer, which `performedBy` cannot state. |
| P19 | Execution | Is a transfer's arrival (`ReceivedTransferItem`) the end of one 08 `StockMovement`, or a 09 `Receipt`? | (a) One `StockMovement` per transfer pick (`underTransferOrder`, `arrivedAt` from `receivedAt`); 09's `Receipt` and `Shipment` drop "another of its sites" from their definitions | 08 already says "one dispatch and its arrival are one movement", and Sutton links each arrival to its pick (`ReceivedTransferItem.pickedItem`). Under (b) the in-transit quantity is counted from two events that do not know each other. |
| P20 | Tenant lists | Decision 124 left open whether modelling Sutton 'all' includes document layouts, settings and integrations. For this family of 109 types, which do get terms? | (a) Business content only: tenant code lists, custom fields, attachments and integration links (external orders, platform locations, sync status) get terms; layouts, PDFs, navigation, skills, features, sign-up options and bulk responses get none; settings that change a record rule are read as the tenant's rules, not terms | About 60 of the 109 types are print layouts, PDFs, UI and API responses that describe no business thing; a term for a sidebar section or a label's alignment would answer no competency question. Under (b) decision 21's closed noTerm reasons (transport, request, screen, error, bookkeeping, deferred) have none for a tenant setting or a print layout, so the list would need widening. Under (a) roughly 30 types map to 6 new terms (TenantCodeList, TenantCode, CustomFieldDefinition, CustomFieldValue, PackagingType, Attachment) plus existing SourceRecord, AccountingSyncRecord and SupplierBill. |
| P21 | Tenant lists | How are a Sutton tenant's own option lists (21 DynamicFields, plus custom-field select options) represented? | (a) Each list is the tenant's own code list kept as data, each option keyed by tenant and Sutton's option id with its text as label; a person maps an option to a concept of our scheme where one exists (ItemCategoryScheme, AdjustmentReasonScheme, ReceivingRejectReasonScheme), never automatically | Report 10 section 4.3 already says another tenant's category list is 'its own scheme ..., not new concepts here'. Decision 10's concept IRI (scheme key, hyphen, notation) would collide across tenants under (b). Sutton options are renamed and soft-deleted (`deleted`), so their identity is the id, and under (c) a rename would split one category in two. Example: Item.category points at one DynamicFieldOption of itemCategories. |
| P22 | Tenant lists | How are Sutton's custom fields (CustomField and 19 value types) modelled? | (a) A tenant's field definition and each value are content records (CustomFieldDefinition, CustomFieldValue) pointing at the record described, typed by the field's kind, with select values pointing at a TenantCode; a person may map a definition to one of our properties, and then its values lift to that property | Under (a) nothing a tenant recorded is lost, and a field that turns out to mean one of ours (for example an expiry date) can still reach it. (b) puts tenant-made properties beside the hand-written vocabulary, against decision 2's one module owning every term fact. (c) drops data the person moving off Sutton expects to bring along. One term covers the 19 value types (report 05 section 6). |
| P23 | Tenant lists | Sutton's carrier is an option from the tenant's shippingCarriers list (SCAC codes are a second list), never a Company. What does 09's carriedBy point at for Sutton data? | (a) A person maps each carrier option to an Organization once (a SourceRecord with recordOf), and carriedBy keeps its Organization range; until the option is mapped, no carrier triple is written and the option's text is kept | Option (b) would let a list entry stand where 09 and decisions 3 and 34 put a party. Option (c) loses the carrier on every Sutton shipment, receiving ticket and purchase order. Under (a) each tenant maps a carrier once, not once per shipment. This is related to open decision 89, which asks about carrier flags, not this range. Under (a), scacCode becomes an identifier of that organization, which needs a new IdentifierKindScheme concept, scac. |
| P24 | Tenant lists | Sutton keeps only the last sync attempt per invoice or bill (ObjectSyncStatus), with no direction and a free-text status. What identifies an AccountingSyncRecord made from Sutton? | (a) Keep 09's identity: the last attempt is imported as one attempt at its timestamp, the direction is set to accounting only where Sutton created the document there (allowCreateInvoice, allowCreateBill), and the status word is kept as stated for a person to map to AccountingSyncStateScheme | (a) keeps 09's identity (document, direction and attempt time) and the history that later attempts add. (b) loses every earlier attempt by design. (c) drops the outside id and URL a person needs to find the copy on the platform. The states are open decision 86, which this does not settle. |

The readers also asked eleven questions that they held ten open decisions already ask. The schema gives each a
concrete record to be asked with: 125, 126 and 127 (report 16), 65 (item kind and tracking in one field), 67 (the
work center), 79 (a pick that names no destination), 82 (an order's seven status fields), 84 (over-receipt and
over-billing as a setting), 85 (consumption and output recorded apart) and 89 (the carrier, which P23 also asks).

P20 decided the size of everything else and is answered: decision 128.

## 7. What is proposed beside the slices

Not built, and Benjamin's to accept or refuse:

- **A coverage list.** A file in the packet with one row per Sutton type: its family, its verdict and its term.
  A test fails when a slice claims to be done while a type it covers has no alignment row. Appendices A and B
  together hold that list as it stands today, without the family.
- **One goal per slice.** The thin thread was one goal (`goals/erp-vocabulary`). Each slice above is the size of a
  goal, and slice 1 can be specified once its own decisions are answered.
- **The schema re-read before each slice.** Sutton changes its API. The reading here is of 2026-11-26.

## 8. Not checked

- No reader's finding was checked by a second reader. The review read section 4 against the schema and the packet
  and sampled the verdicts; it did not re-read the 56 "term in the packet" verdicts one by one.
- The inputs and mutations: what a caller may change says which fields identify a record.
- Any record. Whether a field is filled in practice, what `requested` or `gap` mean, the sign of a payment
  adjustment and whether picking status is stored or derived are all unread.
- The 66 enums no record field uses.
- The app's screens, and Sutton's MCP server.
- `CustomFieldContext` names a `deal`, and orders and quotes carry a `dealId`, but no deal type is in the schema.

## Appendix A. Every type that carries something

The 122 types with a verdict other than "no term". The reasoning for each is in
[readings.json](../assets/sutton/readings.json), which keeps the seven moved types under their first verdict.

| Sutton type | Verdict | Packet term, or the proposed one |
| --- | --- | --- |
| `Address` | term in the packet | `PostalAddress` |
| `Approval` | new term | `OrderApproval` |
| `Company` | term in the packet | `SourceRecord` |
| `Contact` | term in the packet | `SourceRecord` |
| `CurrentUser` | computed view | `SignInAccount` |
| `CurrentUserOrganization` | computed view | `Member` |
| `Organization` | term in the packet | `Tenant` |
| `OrganizationMember` | term in the packet | `Member` |
| `Permission` | term in the packet | `Permission` |
| `PermissionGroupDetails` | new term | `PermissionGroup` |
| `RoleDetails` | term in the packet | `Role` |
| `User` | term in the packet | `SignInAccount` |
| `UserProfile` | part of another record (disputed, section 5) | `Member` |
| `Bom` | term in the packet | `BomRevision` |
| `BomItem` | term in the packet | `BomLine` |
| `Cost` | term in the packet | `MoneyAmount` |
| `CostSum` | computed view | `MoneyAmount` |
| `CurrencyDetails` | term in the packet | `Currency` |
| `DecimalCost` | term in the packet | `MoneyAmount` |
| `Equipment` | term in the packet | `Machine` |
| `Item` | term in the packet | `ItemSpecification` |
| `ItemCustomer` | new term | `CustomerItem` |
| `ItemRouting` | term in the packet | `RoutingRevision` |
| `ItemRoutingOperation` | term in the packet | `OperationDefinition` |
| `ItemVendor` | term in the packet | `VendorItem` |
| `ItemVendorGtin` | term in the packet | `ItemIdentifier` |
| `Measurement` | term in the packet | `QuantityValue` |
| `Operation` | new term | `StandardOperation` |
| `OperationConfiguration` | part of another record | `StandardOperation` |
| `OperationEquipment` | part of another record | `StandardOperation` |
| `OperationsOutput` | computed view |  |
| `PriceList` | term in the packet | `PriceList` |
| `PriceListCustomer` | part of another record | `assignedPriceList` |
| `PriceListItem` | term in the packet | `PriceListEntry` |
| `Tool` | new term | `Tool` |
| `ToolItem` | part of another record | `Tool` |
| `ToolSetupConfiguration` | new term | `ToolSetup` |
| `ToolSetupConfigurationItem` | part of another record | `ToolSetup` |
| `UoM` | term in the packet | `UnitOfMeasure` |
| `VariantTemplate` | part of another record | `ItemSpecification` |
| `AddressQuantityInStock` | computed view | `StockPosition` |
| `ConvertedInventory` | part of another record | `TransformationEvent (09)` |
| `CreatedThrough` | part of another record | `InventoryLabel` |
| `Inventory` | term in the packet | `InventoryLabel` |
| `InventoryAdjustment` | term in the packet | `InventoryAdjustment` |
| `InventoryAdjustmentLineItem` | part of another record | `EventLine (09), a line of InventoryAdjustment` |
| `InventoryLedger` | term in the packet | `EventLine` |
| `LotTraceability` | computed view |  |
| `ReservedItem` | term in the packet | `InventoryReservation` |
| `StockItem` | computed view | `StockPosition` |
| `WarehouseLocation` | term in the packet | `Location` |
| `Bill` | term in the packet | `SupplierBill` |
| `BillLineItemNode` | new term | `SupplierBillLine` |
| `BillMatchLine` | new term | `ThreeWayMatchResult` |
| `Invoice` | term in the packet | `Invoice` |
| `InvoiceLineItemNode` | new term | `InvoiceLine` |
| `Order` | term in the packet | `SalesOrder` |
| `OrderItem` | term in the packet | `SalesOrderLine` |
| `OrderReturn` | new term | `ReturnAuthorization` |
| `OrderReturnLineItem` | new term | `ReturnLine` |
| `OrderReturnReceiptItem` | term in the packet | `EventLine` |
| `PaymentAdjustment` | part of another record | `SalesOrder / PurchaseOrder / Quote (an order-level MoneyAmount with a tenant-defined kind)` |
| `PurchaseOrder` | term in the packet | `PurchaseOrder` |
| `PurchaseOrderItem` | term in the packet | `PurchaseOrderLine` |
| `Quote` | term in the packet | `Quote` |
| `QuoteItem` | term in the packet | `QuoteLine` |
| `TransferOrder` | term in the packet | `TransferOrder` |
| `TransferOrderLineItem` | term in the packet | `TransferOrderLine` |
| `ItemToPick` | term in the packet | `ManufacturingOrderLine` |
| `Job` | term in the packet | `ManufacturingOrder` |
| `JobBatchLog` | term in the packet | `EventLine` |
| `JobWaste` | part of another record | `ManufacturingOrder` |
| `MultiOrderShipmentGroup` | part of another record (disputed, section 5) | `Shipment` |
| `PackContainer` | term in the packet | `LogisticUnit` |
| `PackedItem` | part of another record (disputed, section 5) | `AggregationEvent` |
| `PickedItem` | term in the packet | `Pick` |
| `PickedJobItem` | term in the packet | `Pick` |
| `PickedTransferItem` | term in the packet | `StockMovement` |
| `QualityCheck` | term in the packet | `QualityInspection` |
| `QualityCheckFile` | part of another record | `QualityResult` |
| `ReceivedTransferItem` | term in the packet | `StockMovement` |
| `ReceivingTicket` | term in the packet | `Receipt` |
| `ReceivingTicketLineItem` | term in the packet | `LineAllocation` |
| `Shipment` | term in the packet | `Shipment` |
| `WorkOrder` | term in the packet | `WorkOrder` |
| `WorkOrderBatch` | new term | `OperationOutputReport` |
| `WorkOrderLog` | part of another record (disputed, section 5) | `OperationExecution` |
| `WorkOrderLogInterval` | term in the packet | `OperationExecution` |
| `AddressCustomFieldValue` | new term | `CustomFieldValue` |
| `CompanyCustomFieldValue` | new term | `CustomFieldValue` |
| `ContactCustomFieldValue` | new term | `CustomFieldValue` |
| `CustomField` | new term | `CustomFieldDefinition` |
| `CustomFieldOption` | new term | `TenantCode` |
| `CustomFieldValueOption` | part of another record | `CustomFieldValue` |
| `DynamicField` | new term | `TenantCodeList` |
| `DynamicFieldOption` | new term | `TenantCode` |
| `ExternalBill` | part of another record (disputed, section 5) | `SupplierBill` |
| `ExternalInvoice` | part of another record | `AccountingSyncRecord` |
| `ExternalOrder` | term in the packet | `SourceRecord` |
| `File` | new term | `Attachment` |
| `FileAttachment` | new term | `Attachment` |
| `InventoryAdjustmentCustomFieldValue` | new term | `CustomFieldValue` |
| `InventoryCustomFieldValue` | new term | `CustomFieldValue` |
| `ItemCustomFieldValue` | new term | `CustomFieldValue` |
| `JobCustomFieldValue` | new term | `CustomFieldValue` |
| `ObjectSyncStatus` | term in the packet | `AccountingSyncRecord` |
| `OrderCustomFieldValue` | new term | `CustomFieldValue` |
| `OrganizationCustomFieldValue` | new term | `CustomFieldValue` |
| `OrganizationMemberCustomFieldValue` | new term | `CustomFieldValue` |
| `PackagingTypeDynamicField` | part of another record (disputed, section 5) | `TenantCodeList` |
| `PackagingTypeDynamicFieldOption` | new term | `PackagingType` |
| `PurchaseOrderCustomFieldValue` | new term | `CustomFieldValue` |
| `QuoteCustomFieldValue` | new term | `CustomFieldValue` |
| `ReceivingTicketCustomFieldValue` | new term | `CustomFieldValue` |
| `RutterCommerceLocation` | term in the packet | `SourceRecord` |
| `RutterCommerceLocationMapping` | part of another record | `SourceRecord` |
| `ShipmentCustomFieldValue` | new term | `CustomFieldValue` |
| `ToolCustomFieldValue` | new term | `CustomFieldValue` |
| `ToolSetupConfigurationCustomFieldValue` | new term | `CustomFieldValue` |
| `TransferOrderCustomFieldValue` | new term | `CustomFieldValue` |
| `WarehouseLocationCustomFieldValue` | new term | `CustomFieldValue` |
| `WorkOrderCustomFieldValue` | new term | `CustomFieldValue` |

## Appendix B. The 77 types given no term

Two in the catalog family: `ItemImage` and `ToolImage`.

Eleven that hold a tenant's business rules or the settings of a connection, such as whether orders need approval
and above what amount, whether over-receiving is refused, how lot numbers are made and which document numbers are
issued: `OrganizationAccountsSettings`, `OrganizationDocumentNumberPrefix`, `OrganizationLocationSettings`, `OrganizationModuleSettings`, `OrganizationProductionSettings`, `OrganizationPurchaseOrderSettings`, `OrganizationReceivingSettings`, `OrganizationSalesOrderSettings`, `OrganizationShippingSettings`, `RutterAccountingProperties`, `RutterCommerceProperties`. They describe no thing, but they are rules; under decision 128 each is written down as a rule of the term it
governs.

Sixty-four layouts, generated documents, navigation, results of bulk operations and helper types. The document and
label configurations among them also hold a few trading terms and barcode choices: `BillOfLadingBillTo`, `BillOfLadingConsignee`, `BillOfLadingDocumentsConfiguration`, `BillOfLadingOption`, `BillOfLadingPdf`, `BillOfLadingSection`, `BillOfLadingShipper`, `BomDeletionBlockingLinkedRecords`, `BulkItemMutationError`, `CreateItemsResultItem`, `CustomDocumentConfigurationDetails`, `CustomLabelAddressConfig`, `CustomLabelConfigurationDetails`, `CustomLabelConfigurations`, `CustomLabelOption`, `DeleteItemsResultItem`, `DeleteJobsResultItem`, `DeleteQuotesResultItem`, `DeleteSalesOrdersResultItem`, `DeleteSerializedInventoriesResultItem`, `FileUploadLink`, `FileUploadLinkField`, `InventoryDeletionBlockingLinkedRecords`, `InventoryLinkedRecord`, `ItemDeletionBlockingLinkedRecords`, `ItemLinkedRecord`, `JobDeletionBlockingLinkedRecords`, `JobTravelerPdf`, `LabelDetails`, `OperationIDOnly`, `OrderDeletionBlockingLinkedRecords`, `OrderIDOnly`, `OrganizationDynamicFieldOptionIdOnly`, `OrganizationDynamicFields`, `OrganizationFeature`, `OrganizationMemberSettings`, `PackingSlipBillTo`, `PackingSlipDocumentsConfiguration`, `PackingSlipOption`, `PackingSlipOrganization`, `PackingSlipPdf`, `PackingSlipSection`, `PackingSlipShipFrom`, `PackingSlipShipTo`, `PurchaseOrderDeletionBlockingLinkedRecords`, `PurchaseOrderPdf`, `QuotePdf`, `ReceivingTicketDeletionBlockingLinkedRecords`, `ReceivingTicketDocumentsConfiguration`, `ReceivingTicketOption`, `ReceivingTicketOrganization`, `ReceivingTicketReceivingLocationInfo`, `ReceivingTicketSection`, `ReceivingTicketSupplierInfo`, `RemovePurchaseOrdersResultItem`, `SalesOrderPdf`, `SharedSidebarNavLayout`, `SidebarNavSection`, `SignupHeardAboutUsOption`, `Skill`, `SkillFile`, `SkillVersion`, `UnionDynamicFieldOption`, `UpdateItemsResultItem`.
