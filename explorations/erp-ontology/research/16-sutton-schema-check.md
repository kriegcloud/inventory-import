---
type: Research
title: Sutton's API schema against the packet's Sutton rows
description: What Sutton's GraphQL schema, read by introspection on 2026-11-26, confirms and overturns in the 28 Sutton alignment rows of report 11, which were written from public help pages; the records it has that the packet does not; and three questions on individuals, address purpose and lots.
---

# Sutton's API schema against the packet's Sutton rows

Read on 2026-11-26 from Sutton's GraphQL API by introspection, with Benjamin's demo key: 464 object types (199 of
them records; the rest are `Query`, `Mutation`, responses and pages), 152 enums, 301 inputs. Only the schema was read. No record of the demo
organization was read, and nothing was written.

The schema is behind a token and this repository is public. Decision 123 allows Sutton's type, field and enum names
here and nothing more: the schema file is kept outside the repository, and no record is quoted. Decision 124 takes
back the brief's rule against modelling Sutton whole, so section 3 is now a list of work, not of things left out.

[Report 11](11-gist-projection-and-alignments.md) holds 28 Sutton rows, 26 from eight public help pages and the help center's search listing, 2 ("Container" and the role "Admin") from
memory and unchecked, every one marked "pending Q6" (decision 29). Its
"Not checked" says the schema is behind a token. This is that check.

## 1. What the schema overturns

| # | The packet says | The schema says | What it touches |
| --- | --- | --- | --- |
| A | Decision 3: "a person cannot be an Account"; decision 34: the Sutton Account is the organization | The record is `Company`, and `Company.kind` is `company` or `individual`. The enum's description: an `individual` is "a person modelled as a company — a sole trader or a retail customer", set at creation and never changed | `inv:Organization` ↔ Sutton "Account" holds only for `kind: company`. An `individual` is a `Person` with a tenant's `SourceRecord`. The `recordOf` target is chosen by `kind` |
| B | Customer and vendor are two flags (decisions 3, 89) | `Company.type` is a list of `customer`, `vendor`. No carrier, no contract manufacturer: a carrier is a picked option on orders, purchase orders, receiving tickets and shipments, never a company | Confirms decision 89 (a): two flags only |
| C | A contact is a person tied to a company, with purpose carried by `ContactAssignment` (39, 43) | `Contact.company` is one company, optional. `Contact.type` is one of `customer`, `marketing`, `sales`, `vendor`. A contact has `owners` (members of the tenant). Billing and shipping are not a property of the contact's tie to a company: they are on `Address.type` (`billing`, `shipping`, `ship_from`, `manufacturing`, `other`), with a default flag for each but `other`, and an address sits on a company or on a contact (`Contact.addresses`) | Sutton cannot say "this person bills account X and receives at account Y". Purpose in Sutton belongs to the address, so the `ContactAssignment` row stays `relatedMatch`, and a new row is needed: purpose ↔ `AddressType` |
| D | `inv:Warehouse` ↔ Sutton "Location", `inv:Bin` ↔ Sutton "Bin" | A site or warehouse is an `Address` of the tenant `Organization`. `WarehouseLocation` is what sits inside one, and its `type` is `bin`, `workCenter`, `transit` (system, stock on the move) or `unassigned` (system, stock with no bin) | `inv:Warehouse` ↔ organization `Address`; `inv:Bin` ↔ `WarehouseLocation` of type `bin`. Two terms the packet lacks a row for: a work center is a location that holds stock, and "in transit" is a location |
| E | `inv:InventoryLabel`, `inv:MaterialLot` and `inv:SerialUnit` each `relatedMatch` Sutton "Label" | The record is `Inventory`: an `inventoryId`, at most one `item` and one `warehouseLocation`, a `lotNumber` (plain text, optional), an expiry date, quantities in stock, available and reserved, `parentInventory` and `nestedInventory`, `splitFromInventory`, `storageType` `single` or `nested` | A lot is not a record in Sutton, only a string, on labels (`Inventory.lotNumber`) and on jobs (`Job.lotNumber`); `LotTraceability` finds labels by that string. So `inv:MaterialLot` has no Sutton record to align to. A label can hold other labels, which is `inv:Container`'s job in the packet |
| F | `inv:Container` ↔ Sutton "Container" (unchecked, from memory) | Two things. `PackContainer` is a packed unit on a shipment, a transfer order or a sales order, of kind `asIs`, `package` or `pallet`, nestable. A nested `Inventory` is a label holding labels in stock | The row was right in name and now has its source; it should say which of the two it means |
| G | `inv:ManufacturingOrder` ↔ "Manufacturing order", `inv:SalesOrder` ↔ "Sales order" | The API names them `Job` and `Order`. `Job.type` is `PRODUCTION`, `CONVERSION`, `QUEUE_CONVERSION`, `SORTING` or `OUTSOURCED`; a job has `children` and a `parent` | Same things, different names in the API than on screen: a row cites both. A job of type `OUTSOURCED`, with purchase orders linked to jobs (as `material` or `service`), is probably how a contract manufacturer appears; the schema does not say so |
| H | `inv:Receipt` ↔ Sutton "Receiving" | `ReceivingTicket` always belongs to one `PurchaseOrder`. Stock arriving another way is an `Inventory` whose `createdThrough` names a job, a purchase order, an order return or a creation by hand; a transfer's arrival is its own record, `ReceivedTransferItem` | `inv:Receipt` is wider than `ReceivingTicket`: `narrowMatch`, not `closeMatch` |
| I | Member roles Admin, Manager, Operator (unchecked) | `MemberRole` is `FULL_ACCESS_USER`, `MANAGER`, `SHOP_FLOOR_OPERATOR`, three built-in roles; with the feature `CUSTOM_ROLES` a tenant adds custom ones. Each role grants permission groups and permissions | The row's names were wrong. The three built-in roles can be aligned to a scheme; a custom role cannot, being a tenant's own set of permissions |
| J | Decision 40: Sutton assigns locations per user. Open decision 42 recommends (a): a grant at a site covers what is beneath it | `UserProfile.assignedLocations` is a list of organization addresses, or null for every location, with a flag for records that have no location | Consistent with 42 (a), which stays open: Sutton's grants sit only at sites |
| K | Item specifications (`Inventory`, `Service`, `Alias`) and the tracking scheme are separate things (report 11's rows for Sutton "Inventory item", "Service item", "Alias item", "Standard" and "Serialized") | One enum, `TrackingMethod`: `standard`, `serialized`, `service`, `alias`. An alias item names its `fulfillmentItem` | Sutton folds what kind of thing an item is and how it is tracked into one field. The packet's split is ours; four Sutton values map across our item specification classes and `TrackingMethodScheme` |
| L | Label statuses Active, Depleted; Quarantined read as a quality hold on an active label (10, 4.20) | `ReceivingItemStatus` is `active`, `depleted`, `quarantined`, `reserved`: one field, four values | The status holds one value at a time, and quarantine replaces active. A reservation is also a quantity held against a label (`quantityReserved`, `reservedItems`). The packet's reading (a hold on an active label) is a re-modelling, and the row should say so |
| M | The formulas of the inventory quantities "are not published" | One is, in the schema: available is in stock less quarantined and reserved, never below 0. Also present: picked, and expected from procurement, production and transfer orders | `InventoryMeasureKindScheme` rows gain a source; "Acquired" does not appear in the schema under that name |

## 2. What the schema confirms

- Item roles: `ItemType` is `buy`, `make`, `sell`, and an item holds a list of them.
- `PurchaseOrder`, `Quote`, `WorkOrder`, `TransferOrder`, `Shipment` exist under those names. A work order has at most
  one job and one routing operation, and always one `WarehouseLocation` (its work center).
- A transfer order runs from one organization address to another: site to site, as report 09 defines it. Report 11's
  row for it was `relatedMatch` from a mention; it can be `closeMatch`.
- A draft is a status of the same record (`OrderStatus.draft`, `PurchaseOrderStatus.draft`): decision 81 (a).
- Fulfilment, payment and invoicing are separate status fields on an order, as open decision 82's three progress
  schemes have it. The order carries more: its own status, picking, packing and return. Whether three is enough is
  82's to settle.
- Sutton holds invoices and bills as its own records with no ledger of accounts, and sends them to an accounting
  platform when one is connected.
- Bin tracking is a setting of the organization that an item can turn off for itself.

## 3. In the schema and nowhere in the packet

Not yet proposed as terms. Decision 124 puts them in scope; which slice takes which is not planned: price lists per customer, an item's vendors (own SKU,
price and GTINs) and customers (own SKU and price), bills of materials kept by version, routings and operations,
equipment and tools at a work center, quality checks on a job (pass or fail), order returns with a disposition
(restock or scrap), order approvals, three-way match on bills, custom fields on twenty kinds of record, units of
measure by kind, and an inventory ledger whose movement types are a ready list of stock events.

## 4. Questions for Benjamin

In the packet's [DECISIONS.md](../DECISIONS.md), "Open": 125 (an individual company), 126 (purpose on the address)
and 127 (a lot with no record). Report 11's rows are not rewritten here: finding A waits on 125, C on 126 and E on
127, and the rest can be corrected in report 11 as they stand above.

## 5. Not checked

- No screen of the app and no record: the demo's data was not read. Whether the screen says "Account" where the API
  says `Company` is from the public help pages, not seen.
- The 301 inputs and the mutations were not read: what Sutton lets a caller change says something about identity
  (which fields cannot change), and only `Company.kind` was read for that.
- Sutton's MCP server (Benjamin gave its address during this work) was not connected.
- Field descriptions exist for 537 fields; the rows above read the types named in them, not all 199.
