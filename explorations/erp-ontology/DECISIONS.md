---
type: Decisions
title: ERP ontology decisions
description: Open questions on the ERP ontology in the order they block work, and the answered ones with how to reverse them.
---

# Decisions

## Open

Forty-seven questions are open: 42, 47 to 86, 88, 90 to 92, 116 and 127 (the audit added 116 on 2026-11-23; report 16 added 125 to 127 on 2026-11-26, and 127 is the last row). Nineteen left this table on 2026-11-26, when I took the party slice's and the alignment file's: 12, 17 to 19, 27 to 31, 33, 35 to 37, 44, 45, 87, 89, 125 and 126. The goal party-slice entered 129 to 152 the same day, its rows O1 to O19 and five readings its first steps made, and I answered all of them and 153, which the gist file raised; 154 to 175 answer the questions report 18 and step 7 raised. Decision 176 accepts report 18 as the text of the party slice's terms, and 177 to 179 answer what steps 9 to 12 set aside. They are under Answered. They are what is left
of eighty-five: eighty from reports 04 to 12 and the brief, merged where two reports asked one thing and numbered from
8 in the order they block work, four a sceptic's review of the whole design added on 2026-11-22 (88 to 91), and
decision 92, which a later review of the packet took out of 12 (the item kinds' parent) and which sits after 66 with
the catalog questions. Twenty-three were answered on 2026-11-22 and left this table: 8 to 11, 13 to 16, 20 to 26, 32,
34, 38 to 41, 43 and 46. They are under Answered with nine new ones, 93 to 101, and those answered since, to 124 and 128, with the nineteen of 2026-11-26 and report 17's P1 and P2, which keep their own numbers. No `rat-` record is written, and the thin thread
uses none: its terms name the decision that accepted them (decisions 107 and 111). The gaps
in the numbers below are theirs.

The rows keep their order: what is left of the form of the vocabulary module and its checks (12 to 33), then of the
party questions (35 to 47, without 38 to 41, 43 and 46); 48 to 51 are the item-record SHACL target, the SHACL slow test, the non-integer datatype
and the day datatype, which the brief's Map puts in slice 2; then the import, catalog, stock and commitment terms (52
to 87). Of the rows still open, the sceptic's review changed the recommendation of 74 and 77 and widened 12, 50, 64, 70
and 71; each changed row says so. Row 47 is deferred and offers no choice. Where two reports first recommended
different answers, the row says which one is recommended now and why, and where an answered decision has overtaken
part of a row, the cell says so.

None of these is answered. Each is put to Benjamin when the slice that needs it is being specified, with a concrete
record in front of him (his ruling under Answered). Until then the Recommended column is the agent's and not his, and
nothing is built on it. A report that designs with a recommended answer marks what rests on it "(pending Qn)", and its
section "Questions for Benjamin" maps each Qn to a number here. The thin thread of decision 8 comes first and waits on
none of these rows; slice 1, the party slice, follows it.

| # | Question | Options | Recommended | Why | What it changes | From |
| --- | --- | --- | --- | --- | --- | --- |
| 42 | Does a grant at a location cover the locations beneath it? | (a) Yes: a site grant covers its warehouses and bins, never the other way; (b) a grant names each location | (a) | Sutton's location permissions (public, details not published) and the site hierarchy; (b) needs a grant per bin | CQ-P08; `Grant` with 08's `atLocation` | 04 Q8 |
| 47 | Are the party role flags also a scheme? | Deferred, not an open choice: flags only, on the tenant's `SourceRecord` since decision 34, their labels on 06's flag properties. A `PartyRole` scheme beside the flags is not offered | None to choose | Decisions 2 and 3 already forbid a `PartyRole` scheme: decision 3 chose flags, and report 10 section 4.8 says a second home for customer and vendor would break decision 2. The flags the first module ships are the two decision 3 names | No `PartyRole` scheme is emitted; this row blocks no slice | 10 Q7 |
| 48 | When several records point at one class, which targets it in SHACL? | (a) The one annotated as the stored form; two such refuse; (b) all; (c) none | (a) | Stored rows are encoded by `StoredItem` (decision 49), and under (b) two shapes, `ItemFields` and `StoredItem`, would target one class; both have a SKU, and `ItemEdit` is a request, not a description of an item; (c) validates nothing alone | One annotation key on records, `TermPointer.storedForm`, shown on `StoredItem` only, pending this decision | 12 Q10 |
| 49 | What does the SHACL slow test validate? | (a) Stored rows read through the item store, encoded by `StoredItem`, lifted; `StoredItem` holds no organization and no confirmation, so the slow test supplies the organization's id and the creating confirmation beside the encoded row (12, "The lift"); (b) the raw D1 columns | (a) | The columns are a storage layout with no term; it gives up catching a column a migration wrote wrongly | The lift's input (the organization's id, the creating confirmation and the encoded row); the slow test | 12 Q11 |
| 50 | Which datatype is a number that is not an integer, and how is a property filled by mixed numbers typed? | (a) A float field alone projects as `xsd:double`; a property whose fields mix integers and floats (07's `numericValue`) states `xsd:decimal`, an integer written as its digits and a float as its shortest round-trip decimal (ECMAScript Number-to-String, written without an exponent), which is not always the float's exact binary value; a field that fills a property with a stated datatype gets that datatype in its SHACL shape too; (b) `xsd:decimal` for every non-integer; (c) refuse until the record says | (a) | A binary float alone does not have the exactness `xsd:decimal` claims; one quantity property needs one range | 05's V11; 07's `numericValue` | 12 Q6, 07 section 5 |
| 51 | Should the record's day be stated as a date? | (a) Add `format: "date"` to `IsoDate` (a record change) so it projects as `xsd:date`; (b) keep `xsd:string` with the pattern | (a) | A day typed as a string cannot be compared as a day in SPARQL | One annotation in `Item.read.ts` | 12 Q16 |
| 52 | Are the import's own records and events ontology terms? | (a) Yes, under 09's keys (`ItemImport`, `StagedFile`, `FileRow`, `RowDecision`, `ImportConfirmation`, `RowOutcome`, `ValueChange` and the rest), a file problem a term and its kind no scheme (10 section 5); (b) no: the Alchemy blocks are their only model | (a) | Decision 1 names the catalog context; ten must questions need them; the Activity page and the result step answer questions about them | 09's import terms; 04's provenance terms | 04 Q10, 09 Q7 |
| 53 | Is a row's outcome per confirmation or per import? | (a) Per confirmation, identified by the confirm and the `RowId`; the import's view is the latest of each row; this is the history wanted, not what today's outcome table keeps: a later confirm overwrites a row's outcome there, so complete past batches need an evidence source that retains them; (b) per import (09's identity as first written), which fits the latest-row table and cannot answer a question about an earlier confirmation | (a) | A take-back, a reopen and a second confirm each give a row a new outcome; (a) names each one | `RowOutcome`'s identity; CQ-I02, I03 | 04 Q11, 09 |
| 54 | What does a second import match an item by? | (a) The normalised SKU key as today; an item with no SKU by its source record id; one with neither waits for a person; (b) the SKU only; (c) the source id only | (a) | The repository matches by `skuKey`; Sutton allows an item with no SKU (public, via the architecture seed); the key only reidentifies | CQ-I03, I08, C01; 07's `identifierKey` | 04 Q3 |
| 55 | May an item's SKU change while it stays the same item? | (a) Yes in the ontology; "never changes" stays a record rule; (b) never | (a) | Identity is the tenant and the id (report 01); Sutton allows an item with no SKU | Nothing stored; a re-coding is an edit | 07 Q9 |
| 56 | Does the review outcome scheme have three concepts or five? | (a) Five (Ready, Needs a decision, Cannot import, Left out, Already there), as the code counts; (b) three, as `CLAUDE.md` names | (a) | The code's five add up to the rows; three add up only on a first import with nothing left out | 10's `ReviewOutcomeScheme`; one `CLAUDE.md` sentence | 10 Q15 |
| 57 | Is a created row's outcome called "Imported" or "Created"? | (a) "Imported", "Created" as an alternative label; (b) "Created" | (a) | It is what the person sees ("155 imported"); changing the screen is a product change | One prefLabel; the code or `CLAUDE.md` is corrected | 10 Q5 |
| 58 | Who owns a concept's label when a screen shows the same word? | (a) The vocabulary owns the shared concept labels; catalog web takes a labels-only projection of them for `importWords` and passes the review's through `reviewStepWords`; the review region's generic defaults stay in `@inventory/review`, which never imports the kernel; (b) the word files, with a check that compares their strings with the prefLabels; (c) both, no check | (a) | Decision 2: no fact with two homes; "Taken back" is already spelled twice | Where screen words change | 10 Q4 |
| 59 | How is a money amount written? | (a) A whole number of counting units at a stated scale, with its currency; (b) ISO minor units only; (c) an exact decimal with its currency | (a) | The unit cost holds up to four decimals; `CLAUDE.md` asks for whole units read from the digits; (b) rounds $0.0125 | `minorUnits`, `minorUnitScale`; 12's one money lift rule (under (a), the digits to `minorUnits` at the field's scale, a conversion V11 names; under (c), an `xsd:decimal` amount); the currency is decision 88 | 07 Q1 |
| 60 | What cost basis does an imported unit cost have? | (a) A cost observation whose basis is `stated` (given by a file or a person, method unknown), a concept 10 adds; (b) no basis until a file or tenant says (10's first answer); (c) actual; (d) standard | (a) | The file names no method, and "standard" claims a choice nobody made; (a) keeps every stored field stated (decision 35), where (b) leaves an absence a question must read as unknown | 07's `CostObservation`; 10's `CostBasisScheme-stated` | 07 Q2, 10 Q13 |
| 61 | How are units written? | (a) Concepts of 10's `UnitOfMeasureCodeScheme`, each also an individual of 07's `UnitOfMeasure` (a dimension concept also a `gist:Aspect`), `PackagingUnit` for box, case and pallet; (b) a class with individuals in a reference module, no scheme (07's first answer); (c) a scheme with no class; (d) as (a), pack levels not units | (a) | Each of the record's `Uom` literals (EA, BX, KG, M, L), and each of `Dimensions.unit`'s (cm, in), is a notation of the scheme, a subset of its seven in both cases (gate 4, decision 23), and a quantity and a conversion need the unit as a thing with a dimension; 05's `alsoInstanceOf` holds both | 07's unit rows; 10's 4.6 and 4.7; 11's QUDT rows | 07 Q7, 10 sections 4.6, 4.7 |
| 62 | Under which gist class is `Currency`? | (a) `gist:UnitOfMeasure`, a sibling of `UnitOfMeasure` and disjoint from it; (b) a top class with no gist parent; (c) a scheme of ISO 4217 codes | (a) | QUDT treats currencies as units and gist an amount as a magnitude with a unit; the disjointness keeps money out of quantities | One row, one disjointness | 07 Q10 |
| 63 | Does the unit `M` mean metre? | (a) Metre; (b) something else | (a) | The other codes are SI-style (KG, L) | M's label and QUDT row | 10 Q10 |
| 64 | Is the vendor of an item a term of its own? | (a) `VendorItem` under `gist:Offer`, one per offer: a vendor may make two for one item, in two pack sizes; (b) fields of the item | (a) | Price, lead time and preference belong to the pair; it is not the trading relationship decision 3 rejected | `VendorItem`, `leadTime`, `isPreferred`, `vendorName` | 07 Q8 |
| 65 | Is item kind (inventory, service, alias) classes or a scheme? | (a) Subclasses of `ItemSpecification`, 07's; (b) a scheme | (a) | They differ in structure: an alias has a fulfilment item, a service no stock | 07's hierarchy | 10 Q6 |
| 66 | Is an alternate BOM a second bill or a kind of revision? | (a) A second `Bom` with the same output item, the item pointing at its primary one; (b) a `BomRevision` marked alternate | (a) | Revisions replace one another over time; alternates stand side by side | `primaryBom` | 07 Q6 |
| 92 | Do the item kinds take the one parent `ItemSpecification`, or may an item kind also take the gist class that fits it? | (a) The one parent `ItemSpecification`, so 11 takes neither `gist:ProductSpecification` nor `gist:ServiceSpecification`; (b) an item kind may also take the gist specification class that fits it | (a) | Each gist class would be a second identity-bearing parent, which the one-parent guard keeps out; the guard is the rule decision 12 asks about for parties, applied a second time here, and 12's answer does not select this one | 07's item kinds take no second gist parent; 11's projection list | 07 Q3; split from decision 12 |
| 67 | Who owns the work center, and what is it? | (a) 07, under `gist:Collection` (a name decision 13, now answered, admits only when the slice that builds the work center needs it; that answer does not decide this row), not a `Location`, `sitedAt` a location (08's property); (b) 08, under `gist:Collection`; (c) a subkind of `Location`; (d) under `gist:Equipment` or `gist:Organization` | (a) | The seed makes it a functional grouping linked to a place "without becoming a bin or machine"; a routing step points at it | One `WorkCenter` row (07's; 08's removed) | 07 Q5, 08 Q3 |
| 68 | What is a location's gist parent? | (a) `gist:GeoLocation`, with `Location` stated disjoint with `Organization`; (b) none; (c) `gist:GeoRegion`; (d) `gist:PhysicalIdentifiableItem` | (a) | gist 14.1.0 has no place-of-business class and deprecates `gist:Building`; a bin is a place stock is in; `gist:GeoLocation` carries no disjointness, so the module states it | `Location`, `Site`, `Warehouse`, `Bin`; 08's disjointness | 08 Q1, 11 Q5 |
| 69 | Are site, warehouse and bin subkinds, or one location with a level? | (a) Three disjoint subkinds of `Location`, other levels plain locations; (b) one kind with a level concept | (a) | Rules differ by level (a site is operated at an address; a bin is what bin tracking needs) | A one-building company has two records under (a) | 08 Q2 |
| 70 | What is a material lot's gist parent? | (a) `gist:PhysicalSubstance`; (b) `gist:PhysicalIdentifiableItem`; (c) `gist:Collection`; (d) none; (e) a local `Batch` kind constituted by its substance, with no gist parent | (a) | A lot keeps its identity when divided; a countable object split in two is two. Against (a), a sceptic's reading: 08 says a lot stays one lot through every split, while an amount of matter in the strict sense does not survive losing parts; gist's definition asks only that each part be "indistinguishable in nature from the whole", which a split keeps, so (a) holds under gist's words and not under DOLCE's; (c) or (e) are the choices if the stricter reading is wanted | Disjointness with `SerialUnit`, `Container` | 08 Q4, 11 table A |
| 71 | What does an inventory label denote? | (a) The labelled portion of material, under `gist:PhysicalSubstance`; (b) an information record of tracking, under `gist:Content` (the architecture seed and 11's first placement); (c) the printed tag | (a) | Report 01: classes name referents, and Sutton's label row is a record of the portion, which is what is moved, split, held and counted. The same reading as decision 70 applies: a label that grows smaller through a split stays one label, which holds under gist's definition of a substance and not under a strict amount of matter | The label's parent; 11's placement row | 08 Q5 |
| 72 | What makes two lot records one lot? | (a) The issuer's batch for one item specification, the code an identifier of it; (b) each receipt a lot; (c) tenant, item and code text | (a) | Two suppliers printing "L-221" are two lots; one lot received twice is one batch for a recall; (c) is identity from a code | The lot's identity; `originatedIn` bears identity under one answer only: under (a) a receipt is provenance and two receipts may refer to one lot; under (b) the receipt is what tells two lots apart | 08 Q10 |
| 73 | How is a Sutton "Serialized" item read? | (a) As `label` tracking, lot or single unit decided per item by a person; (b) `lot`; (c) `serial` | (a) | Sutton public says one item's labels can stand for a unit, a batch or a split part | The tracking concepts a mapping produces | 10 Q11 |
| 74 | Is an inventory measure a magnitude, or a statement pointing at one? | (a) A subclass of 07's `QuantityValue` with its own value and unit; (b) information under `gist:Content` that gives one kind of quantity for one position and points at a `QuantityValue` by 07's `hasQuantity` | (b) | Under (a) the measure inherits `QuantityValue`'s identity (the decimal and the unit) and states its own (the position and the kind), so the on-hand 40 kg of two positions would be one individual; (b) keeps one criterion per class, and the "250 kg on hand" of gist's magnitude example is the `QuantityValue` it points at | `InventoryMeasure`'s parent and tag; CQ-W03's query reads `hasQuantity` | 08 Q7; recommendation changed after the sceptic review of 2026-11-22 |
| 75 | Is Available stated by its source or worked out here, and by which rule? | (a) A source's Available is kept as stated, on a `reported` position with its rule's name; a book position's is worked out as A = H − Q − (C + R − O), the overlap of reserved and committed stated; (b) never worked out here; (c) A = H − Q − C; (d) A = H − Q − C − R | (a) | The architecture seed: store the formula version, assume no universal subtraction; (a) holds whichever way a source counts reservations, and (c) and (d) are its special cases | CQ-W03, W04, W06; every available figure shown | 04 Q6, 08 Q6 |
| 76 | What does the item's `quantityOnHand` point at? | (a) The `onHand` measure of a `reported` position for the whole organization, as of the confirm, `reportedIn` that confirmation (08: part of the position's identity); (b) nothing until locations exist; (c) move the number off the item now | (a) | The import reads a stock number with no place or date; (a) names it truthfully and changes nothing; (c) changes the app | The lift path on `quantityOnHand`; under (a) `StockPosition`'s identity must admit a whole-organization scope beside a location (08 gives a position one location, and `atLocation` ranges over `Location`, which is disjoint with `Organization`), and slice 2 takes 08's position and measure terms that the lift writes (BRIEF Map); under (b) `quantityOnHand` has no pointer in slice 2; (c) stays the product change | 08 Q9 |
| 77 | What is a quality hold? | (a) A relator under bare `gist:Intention` ("A goal, desire, or aspiration"); (b) under `gist:Event` with its own start and end (08's first answer); (c) under `gist:Commitment`; (d) information under `gist:Restriction` ("A description of things one is prevented from doing", a subclass of `gist:Intention` in 14.1.0, defined through `gist:prevents`, which gist deprecates for `gist:prohibits`; the projection copies the class name and its parent only), begun and ended by 09's `HoldPlacement` and `HoldRelease`, its interval read from their event times; (e) no class, only the events and a disposition | (d) | 08 defines a hold as what keeps stock from being used, which is gist's own `Restriction`; a restriction is a description, as 06's `Permission` and `Role` are, so the tag is information, not relator; the events still give its start and end one home; (e) loses "which holds are open on lot L-221" | One `QualityHold` row (09's removed), tagged information; `gist:Restriction` is admitted when the slice that builds the hold needs it, not with 11's table B (decision 13, now answered, which does not decide this row); 08's `heldFrom`, `releasedAt` removed | 08 Q8, 09 Q4; recommendation changed after the sceptic review of 2026-11-22 |
| 78 | Are quality decisions and physical conditions one scheme? | (a) Split: `QualityDispositionScheme` (unrestricted, on hold, rejected) and `StockConditionScheme` (damaged, expired), Sutton's "Quarantined" label read as on hold; (b) one scheme as the seed has it | (a) | Damaged stock can be on hold or unrestricted, and one single-valued field cannot say both | Two schemes; 10's two properties, on the stock itself (labels, lots, serial units), never on a stock position | 10 Q8 |
| 79 | Are a putaway and a pick kinds of stock movement? | (a) Yes: 09's `Putaway` and `Pick` are subkinds of 08's `StockMovement`, sharing its identity and 09's `sourceLocation` and `destinationLocation`; (b) separate events beside it | (a) | Each is an event in which material leaves one location for another, which is `StockMovement`'s definition; two unrelated classes would count one move twice | 09's two rows | NEW, report 13 (from 08 and 09) |
| 80 | What is each order in gist's terms? | (a) Sales and purchase orders under `gist:Agreement`; manufacturing, work and transfer orders and every line under `gist:Commitment`; a quote under `gist:Offer`; (b) every order a `gist:Commitment` (11's first placement); (c) the class changes with the stage; (d) a work order under `gist:Task` (11's reading) | (a) | A sales or purchase order binds two parties to each other; an internal order is the organization's own promise; (c) is state-as-kind | Five gist parents; `lineOf`'s range; 11's rows | 09 Q1, 11 |
| 81 | Is a draft order an instance of its order class? | (a) Yes; its lifecycle concept says whether it binds yet; (b) no, a draft is a supply proposal | (a) | Sutton's records are one record through every state; (b) moves records between classes | Six definitions | 09 Q2 |
| 82 | One lifecycle scheme per order kind, or one shared? | (a) One `OrderLifecycleScheme` for every order's phase, beside `FulfilmentProgressScheme`, `PaymentProgressScheme` and `InvoicingProgressScheme`; a quote's phases later; (b) one scheme per order kind, each `skos:broadMatch` the seed's `WorkflowStatus` (09's first answer) | (a) | Sutton's public words mix phase and progress ("Unfulfilled", "Awaiting shipment"), which (b) cannot separate; Late and Paused on the shop floor are progress, not phase | 10's four schemes; 09's six per-kind schemes not designed | 09 Q3, 10 Q9 |
| 83 | Where does a line allocation sit under gist? | (a) `gist:Content`, as the seed's `LotAllocation`; (b) no parent, with a waiver; (c) a new look at gist | (a) | An allocation exists only as the business's statement counting a quantity against a line | `LineAllocation`'s parent | 09 Q5 |
| 84 | May a line be met by more than it promised? | (a) Yes, the fulfilment view shows it as over; (b) no, refused | (a), as a product rule to confirm | Goods arrive in more than ordered; Sutton's public three-way matching refuses billing beyond receipt, not receiving beyond order | A record rule and a rejection only | 09 Q9 |
| 85 | What does a genealogy answer mean with no composition evidence? | (a) Every input may have contributed to every output, said as "possible contribution"; (b) only stated-quantity allocations; (c) proportional shares | (a) | The architecture seed 7.1; a recall that misses a lot is worse than one that names too many | CQ-E01, E02, W07 | 04 Q7 |
| 86 | Which states does an accounting sync have? | (a) Waiting to send, sent, refused, changed since sent, in `AccountingSyncStateScheme`, read by 09's `syncOutcome`; (b) sent or not; (c) wait for a real connection | (a) | No public source names them; these are the ones a person acts on differently | 10's concepts, all NEW | 10 Q12, 09 |
| 88 | What currency is a stored unit cost in? | (a) US dollars for every stored cost, stated once as a rule of the item record that the projector reads (05's fixed individual on a lift step, V23; 12's lift table), never taken from a field's description text; (b) no currency until a record states one, so no cost is projected and CQ-V01 waits; (c) a tenant's currency setting, which does not exist | (a) | `Item.read.ts` describes the cost as "in US dollars" and stores no currency; a `MoneyAmount` with no currency fails a check (07); a description string is documentation, not a fact a projector may read | 07 section 5; the lift of `unitCost`; CQ-V01, V02 | NEW, sceptic review 2026-11-22 (07) |
| 90 | Does the SKU match key drop punctuation? | (a) No: the key is the SKU without spaces, in upper case, as `skuKey` computes it, and `CLAUDE.md`'s "case, spaces, punctuation" is corrected to "case and spaces"; (b) yes: `skuKey` also drops punctuation, so "SHH-9574" and "SHH9574" are one key (a product rule, written in the product `DECISIONS.md`) | (a) | The code and the stored unique index compare `skuKey`, which keeps the hyphen (`Item.read.ts`); 07's `identifierKey` and CQ-I03 follow the code; (b) changes which rows count as "Already there" | 07's `identifierKey` definition; CQ-I03's fixture; one `CLAUDE.md` sentence, or `skuKey` | NEW, sceptic review 2026-11-22 (04 CQ-I03) |
| 91 | What does `performedBy` point at? | (a) No range declared: a member for an act in the app (CQ-I01, I04, P10), an organization or a person for an act outside it (a vendor's shipment), each record's SHACL saying which; (b) `Member` only, with a separate `Party`-ranged property for outside actors; (c) `Party`, as 09 first wrote | (a) | Under (c) a reasoner types every member a party and "who confirmed" loses the membership the audit trail keeps; 06's `decidedBy`, `calledFor` and `actsFor` point at `Member`, and `recordedActor` does in the index, pending decision 44, which does not change this row while `PortalAccess` is not proposed; (a) keeps one key, as anti-pattern 10 advises, and (b) is its narrower form | 09's `performedBy` row; CQ-I01, I04, P10 | NEW, sceptic review 2026-11-22 (09) |
| 116 | When a grant covers one location or one field, how does it say which? | (a) A property from the grant to the thing it covers, beside `grantScope`, which keeps the kind; (b) one concept per location or field in `GrantScopeKindScheme`; (c) the kind only, the thing covered read from another record | (a) | With the kind alone two grants at two sites look the same (the blinded seat, report 15); a concept per site turns data into vocabulary | One property; CQ-P11's answer once a second kind exists; no change while organization is the only kind (decision 115) | NEW, audit 2026-11-23 (15 section 5) |
| 127 | What is a lot when the source is Sutton? | (a) The lot number is a property of the label record and no lot is minted; (b) `MaterialLot` individuals are minted from tenant, item and lot number | (a) | Sutton keeps the lot as text on `Inventory` and finds labels by that text; two receipts with one lot number from two vendors would become one lot under (b), which nobody decided | `inv:MaterialLot` keeps no Sutton alignment row; CQs on lots read the label's lot number for Sutton data | NEW, Sutton schema 2026-11-26 (16 finding E) |

## Answered

How the open ones are taken (my ruling, 2026-11-22): each open decision is put to me when the slice that needs it is
being specified, with a concrete record in front of me. Until then its recommendation is the agent's and not mine, and
nothing is built on it. The thin thread of decision 8 waits on none of them.

Decisions 8 to 11, 13 to 16, 20 to 26, 32, 34, 38 to 41, 43 and 46 were answered on 2026-11-22 after the
review panel and left the Open table, with nine new ones, 93 to 101. Later entries amend earlier ones where they say
so: 94 to 101 widen the thread that 8 and 93 describe, and report 14 holds the thread as it now stands. Where a report disagrees with an entry below, the
entry wins.

### 2. Which artifact is the source of truth (2026-11-22)

I chose one TypeScript vocabulary module that owns every term fact, with record schemas carrying a typed pointer to a
term plus their own rules, and all Turtle generated; the agent recommended the same. It began as my question back:
"If Effect Schema becomes the source of truth wouldn't that be easier and we could treat OWL, SKOS and SHACL as a
projection?" The agent's first recommendation (hand-written Turtle) was withdrawn after report 02.

- Rationale: one language, and no fact with two hand-written homes. The record schemas are not the terms because one
  term has several records (Item) and some terms have none (gist Commitment).
- Reverse: the generated Turtle becomes the hand-written file and the TypeScript term module is generated from it.
  The IRIs do not change.

### 5. How the Turtle is produced (2026-11-22)

I chose a small local projector over the vocabulary and the Schema AST; the agent recommended the same.

- Rationale: beep-effect's fold makes a class of each schema and maps every number to xsd:integer.
- Reverse: vendor `@beep/ontology` and delete the projector; the generated files are compared byte for byte, so any
  difference shows at once.

### 6. Which checks run (2026-11-22)

I chose against the recommendation: an OWL reasoner runs in `check:full` from the start, beside the byte-compare and
re-parse in `check` and SHACL over the stored messy sample as a slow test. The agent recommended adding the reasoner
later.

- Rationale: an inconsistent hierarchy is caught on the day it is written.
- Reverse: remove the reasoner step from `check:full`; nothing else depends on it.
- Owed: which reasoner runs here is not chosen or tried.

### 7. Which namespace (2026-11-22)

I chose against the recommendation: the `example.org` placeholder stays until something is published. The agent
recommended a project-owned permanent path now.

- Rationale: nothing to register before the vocabulary has settled.
- Reverse: a cutover, not one edit. Approve the publication base; switch the guard that holds the placeholder host;
  derive from the new base every local IRI family (terms, documents, shapes, test data) and the prefix the queries
  bind; regenerate every Turtle file and run a competency question on the new base. Source CURIEs and stored notation
  strings do not change. Anything outside the repository that has stored an absolute IRI by then must be rewritten.

### 1. What the ontology is for first (2026-11-22)

I chose the model of record for this repository's contexts, with Sutton as a mapping; the agent recommended the same.
I added a condition: look at how beep-effect handles ontology and taxonomy and see if it is the right shape.

- Rationale: the repository is moving to a domain-aligned architecture, and its classes need terms to point at. A
  description of Sutton alone would have nothing here to check it.
- Reverse: the terms carry no dependency on this repository's tables, so the same vocabulary can be republished as a
  Sutton description by writing the mapping first. Nothing is lost.
- Still owed: the look at beep-effect (report 02).

### 3. What a Sutton Account is (2026-11-22)

I chose against the recommendation: an Account is an Organization with role flags (customer, vendor). The agent
recommended a trading relationship between two parties that holds the roles.

- Rationale: it is how Sutton presents it ("Accounts represent customers and vendors"), and it is one record to
  import, match and review.
- What it gives up: a role has no start and end date of its own; terms, price lists and portal access sit on the
  organization, not on the relationship; a person cannot be an Account.
- Reverse: each flag set to true becomes one positive role record in that tenant, with no known start or end date and
  none of the relationship's own commercial terms. An explicit false is recovered only where negative evidence was
  kept or the account's role set was declared complete; without either, a missing role reads as unknown. Going back
  from roles to flags drops the dates.

### 4. Which upper ontology (2026-11-22)

I chose a small gist projection, with IOF and ISA-95 as alignments only; the agent recommended the same.

- Rationale: everyday enterprise words in OWL 2 DL, small enough to read whole.
- Reverse: the projection is a list of imported terms. Swapping the upper ontology means re-parenting our top classes
  (about a dozen), not renaming anything below them.

### 8. The appetite of the first goal (2026-11-22)

I chose a thin thread before the party slice: `Organization`, `Member`, `Role` and the audit entry, with their gist
parents, carried through the module, the pointer on the record, the generated OWL and SKOS, the byte-compare, the
re-parse and the reasoner, answering one question (who belongs to this organization and with which role, on a fixture
where one person is an admin in one organization and a viewer in another), with each gate shown failing once on a
planted mistake. The party slice (the log's option (a)) follows it. The agent recommended the same, against its own
earlier recommendation of the party slice first.

- Rationale: the party slice waited on about 34 of my answers and nothing in the design had yet been made to fail; the
  thread proves every station with four terms and needs about ten answers.
- Reverse: start from the party slice as reports 04 to 12 describe it; the thread's terms are a subset of it, so
  nothing is thrown away.

### 34. What a Person or an Organization instance stands for (2026-11-22)

I chose the party itself: `Organization` names the real body and `Person` the human. The row a tenant imports, matches
and reviews is a `SourceRecord` linked to it by `recordOf`, reidentified by tenant, source system, source type and
exact source id; two records a tenant holds that may be one party are joined only by an `IdentityDecision`. The agent
recommended the same. This amends decision 3: the Sutton Account is the organization, and what is imported is the
tenant's record of it.

The customer and vendor flags sit on the tenant's `SourceRecord`, not on the shared organization; the agent recommended
the same. CQ-P01 reads them there.

- Rationale: gist 14.1.0 makes content and organizations disjoint, so a record typed as an organization fails the
  reasoner; and a company that is one tenant's vendor and another's customer must be both for neither.
- Reverse: move to a `PartyRecord` under `gist:Content` (the log's option (b)); the source ids stay the keys, and the
  flags are already on the record.

### 39 and 43. How an account's contact and its purpose are modelled (2026-11-22)

I chose a `ContactAssignment`: it links one `Person` to one account and carries the purpose and the contact point.
The agent recommended the same, against the log's earlier recommendation of a plain `isContactOf` link. Decision 43 is
settled by it: a contact purpose sits on the assignment, not on the address or contact point alone.

- Rationale: one person who is the billing contact at one account and the receiving contact at another must not be
  reported with both purposes at both. The four alignment rows report 11 removed (Sutton "Contact", `org:Membership`,
  FIBO's Contact, schema.org's `ContactPoint`) come back.
- Reverse: collapse each assignment to an `isContactOf` link and move the purpose to the contact point; the people and
  accounts do not change.

### 40. Whether a grant is its own record (2026-11-22)

I chose `Grant` as its own relator: it links a member, a role and a scope, and today's `member.role` is read as one
grant at organization scope. The agent recommended the same.

- Rationale: Sutton assigns locations per user, and a grant needs who made it and when; a field of `Member` can carry
  neither. The thin thread therefore has one lift, from the record's role field to a `Grant`.
- Reverse: `grantsRole` takes `Member` as its domain and the lift is removed; no stored row changes either way.

### 13. Which gist 14.1.0 names terms may use (2026-11-22)

I chose to admit a gist name only when a term in the slice being built needs it, and to add it to the profile's
`gist-categories.md` then. For the thin thread that is the parents report 11 gives `Member`, `Grant` and `Role`
(`TemporalRelation`, `Assignment`, and `Permission` only if `permits` comes with `Role`, which decision 41 settles).
The agent recommended the same, against the log's earlier recommendation of taking all twelve names of report 11's
table B at once. It does not decide 67 or 77.

- Rationale: decision 4 asked for a small projection; a name nothing uses is not checked by anything.
- Reverse: add the rest of table B in one change; a name already admitted stays.

### 9. Where the vocabulary module, its metamodel and the projector live (2026-11-22)

I chose three homes: the metamodel and its reusable rules in a new foundation package `@beep/vocabulary`; this
repository's terms in `@inventory/kernel`, under `./Terms` (the vocabulary value, for the projector and tests) and
`./TermsPointer` (the pointer helpers for record declarations, importing the registry as types only); the projector
and the generated files in a new `@inventory/ontology` that the app, the kernel, the contexts and tooling do not
import in production code. Each gets its row in `laws boundaries`, as the log's option (a) set out. The agent
recommended the same.

- Rationale: the kernel stays free of an RDF writer and of read access to every contract, and no browser bundle
  carries the vocabulary.
- Reverse: fold the metamodel and the projector into the kernel; the exports keep their names, so pointers do not
  change.

### 25. Which reasoner runs in `check:full` (2026-11-22)

I chose ROBOT with HermiT: the OWL 2 DL profile check and consistency, with gate 4's TypeScript coherence check in
`check`. The agent recommended the same. The Java pin and the jar download are still mine to approve, with the file,
its source and its size named first; nothing is fetched until then.

- Rationale: decision 6 asked for a reasoner and left which one owed; ROBOT also checks the DL profile, and the
  architecture seed ran it.
- Reverse: replace the `reason` task with a rule-based reasoner in Vitest (EYE with OWL 2 RL rules) and drop the Java
  pin; the profile check goes with it.

### 41. Whether a member role is a class or a code (2026-11-22)

I chose both as one thing: viewer, editor and admin are concepts of `MemberRoleScheme`, and each is, under the same
IRI, an individual of `Role`. Such an individual has one identity criterion, the concept's: its scheme and its
notation. A tenant's custom role is another individual. The thin thread ships `Role` without `permits`, so
`Permission` waits for the party slice. The agent recommended the same.

- Rationale: the record's `Role` literals are checked against a scheme like every other coded field, and the class can
  later carry the permissions and the order of roles without a second IRI.
- Reverse: drop the class and keep the scheme (W3C ORG's shape); the concept IRIs do not change.

### 10. The exact IRIs (2026-11-22)

I chose the namespace `https://example.org/inventory-import/ontology/` with classes, properties and schemes directly
under it, every scheme key ending in `Scheme`, and a concept written `<namespace><SchemeKey>-<notation>`
(`inv:MemberRoleScheme-admin`); the rest as the log's option (a) set out (documents, shapes and lifted test rows under
the same placeholder with the layer in the path, a lifted node named by its parent's IRI and the field path). The
agent recommended the same.

- Rationale: notations repeat across schemes, so the scheme qualifies them, and a hyphen needs no escape in Turtle or
  SPARQL, so fixtures and alignment rows can write short names.
- Reverse: one mechanical rewrite of the concept IRIs in the module; while the namespace is the placeholder of
  decision 7 nothing published depends on them.

### 20. How a record points at its term (2026-11-22)

I chose the typed helpers (`aboutClass`, `aboutProperty`, `aboutScheme`, `aboutPath`) writing one `term` annotation,
each typed so that only a term of the right kind compiles, with an augmentation of `@alchemy.run/domain`'s
`Annotations`. The agent recommended the same.

- Rationale: a misspelt or wrong-kind pointer is a type error, where a plain annotation key on `effect/Schema`
  compiles when misspelt.
- Reverse: write the same annotation by hand; the helpers are a thin layer over it.
- Correction (2026-11-22): in report 05's design `aboutPath` writes a `path` annotation, not `term`; the other three
  write `term`. That is the design I accepted.

### 32. What records that I accepted a term (2026-11-22)

I chose the name of the `rat-` record that holds my answer; the module holds ratified entries only. The agent
recommended the same. The answers in this file dated 2026-11-22 are the first to need their `rat-` records.

- Rationale: the module is code, not a stored row, and the project profile makes the `rat-` file the record the
  ontology skills read; a gate can fail on a term that names none.
- Reverse: cite the decision number instead and change the profile to read this file.

### 23. What a classification property holds (2026-11-22)

I chose the concept: the record keeps storing the notation, the projector lifts it to the concept's IRI, and `sh:in`
lists the concept IRIs of the field's own literals. Every code a field allows must be a notation of its scheme, and a
field may allow fewer than the scheme has: `Uom` allows five of the seven units and `Dimensions.unit` two. The agent
recommended the same.

- Rationale: labels, broader links and outside alignments are reachable from the data; which codes a field admits
  stays the field's own rule (decision 2), so no field is widened.
- Reverse: lift the notation as a literal instead; the stored rows are the same either way.

### 15. How much of gist's disjointness the projection copies (2026-11-22)

I chose the `owl:disjointWith` pairs gist states between classes the projection takes, and no others; the set grows as
classes are admitted (24 pairs for the whole design of reports 04 to 12). The agent recommended the same.

- Rationale: decision 6 runs a reasoner, and with no disjointness nothing is ever inconsistent; these pairs keep a
  person off an organization and a record off the class of what it records.
- Reverse: drop the axioms from the generated file; the reasoner then passes on anything.

### 21. How a schema that stands for no term is marked (2026-11-22)

I chose `noTerm` with a reason from a closed list: transport, request, screen, error, bookkeeping. The agent
recommended the same.

- Rationale: a folder exempts by place, not meaning, and pointing every payload at a term makes the code's shape the
  vocabulary.
- Reverse: replace the marks with a list of exempt folders.

### 93. How the Member record's copied fields are pointed in the thin thread (2026-11-22)

A question the review panel raised: the `Member` record carries the person's name and the organization's name,
neither of them a fact about the membership. (The question as put to me also named a sign-in email; the kernel's
`Member` has no such field, so this answer covers the two names.) I chose `noTerm` with the reason screen for those fields in
the thin thread; only the role field is lifted, to its `Grant` (decision 40). The party slice adds their paths, the
person's name through the person and the organization's name through the tenant. The agent recommended the same.

- Rationale: the thread stays at four terms and the graph says nothing false about a membership.
- Reverse: write each field as a path in the thread (decision 94 already brings `Person` in).

### 11. Which properties carry a term's label and definition (2026-11-22)

I chose `skos:prefLabel` and `skos:definition`, in English; the agent recommended the same.

- Rationale: it is what gist 14.1.0 uses (226 `skos:prefLabel`, 227 `skos:definition`, no `rdfs:label`), so our terms
  and the projected gist terms read alike and the label check reads one property.
- Reverse: the projector also writes `rdfs:label` with the same text; no term changes.

### 14. Whether the projection is closed upward (2026-11-22)

I chose yes: each gist class the projection takes brings its named gist ancestors, as names and links only. Under
decision 13 a gist name enters when a term needs it; its ancestors enter with it. The agent recommended the same.

- Rationale: otherwise a generated `rdfs:subClassOf` points at an undeclared class, and `Person` loses the ancestor
  that decision 15's disjointness rests on.
- Reverse: stop writing the ancestor rows; the terms' own parents stay.

### 16. Gist properties, their parent links, and ours under them (2026-11-22)

I chose to copy each taken gist property's named `rdfs:subPropertyOf` and never its domain or range; an `inv:`
property may be a sub-property of a gist one only where its own domain and range fall under the gist property's. The
agent recommended the same.

- Rationale: a query written in gist's properties finds our data, and gist's `xsd:dateTime` ranges never meet the
  repository's day strings.
- Reverse: drop the sub-property links; the properties keep their names.

### 46. The audit record's key (2026-11-22)

I chose `AuditEntry`, with "Activity" as an alternative label; the page and the record keep their name. The agent
recommended the same.

- Rationale: `prov:Activity` is an event, and this is a record of one.
- Reverse: rename the key to `Activity`; one IRI changes, under the placeholder namespace.

### 38. What the tenant is (2026-11-22)

I chose a role class `Tenant` under `Organization`, keyed by `OrganizationId`; `membershipIn` ranges over it, and the
thin thread ships it. The agent recommended the same.

- Rationale: the `organization` table is the tenant and its id scopes every row; under decision 34 the companies a
  tenant trades with are organizations too, and a membership must not be in one of those.
- Reverse: widen `membershipIn` to `Organization` and drop the class.

### 94. How the thin thread shows one person in two organizations (2026-11-22)

A question the carried-through reports raised: with no `Person` term, the thread's fixture was two `Member` records and
nothing said they were one human. I chose to bring `Person` into the thread, under `gist:Person`, with one link from
`Member` to the person and no name or email paths (decision 93 stands). The agent recommended the same.

- Rationale: the fixture is honest, and the disjointness of person and organization has both sides to act on.
- Reverse: take `Person` and the link out of the thread; the question is then answered per organization only.

### 95. Which gates the thin thread builds (2026-11-22)

I chose every gate that needs no stored row: byte-compare (1), re-parse (2), forbidden constructs and the namespace
guard (3), vocabulary coherence (4), record pointers on the AST (5), the type-check (6), `laws ontology-terms` (7), the
question suite (8) and the reasoner (9), with gates 5 and 7 enrolled on the access contract and the four kernel
records only. Each is shown failing once on a planted mistake. SHACL over the stored sample (11) and the alignment
check (12) wait for their slices; gate 10 is decision 27's. The agent recommended the same.

- Rationale: the thread exists to prove every station, and a forgotten pointer or a stray `owl:sameAs` should fail
  from the first day.
- Reverse: move gates 3, 5 and 7 to the party slice.

### 26. Which RDF engines run in Vitest (2026-11-22)

I chose N3.js for the re-parse, Oxigraph for SPARQL and shacl-engine for SHACL Core; the thread uses the first two and
shacl-engine is added with the SHACL slice. The agent recommended the same.

- Rationale: fewest packages, full SPARQL 1.1, and SHACL Core is all the shapes use.
- Reverse: swap an engine behind the test helpers; the queries, fixtures and shapes are plain SPARQL, Turtle and SHACL.

### 22. Whether every field of a pointed record is placed (2026-11-22)

I chose yes: every field of a record that points at a term carries a pointer or `noTerm` with a reason, and the SHACL
shapes are closed. The agent recommended the same.

- Rationale: a field nobody placed is a fact with no meaning, and a closed shape catches a lift that writes something
  unplaced.
- Reverse: project only pointed fields and open the shapes.

### 96. Whether the thread's grant states its scope (2026-11-22)

A question the carried-through reports raised under decision 40. I chose yes: the thread's `Grant` carries
`grantScope`, and `GrantScopeKindScheme` ships with the one concept organization; other scopes are added by the slice
that needs them. The agent recommended the same.

- Rationale: the lifted grant says what decision 40 said, and adding scopes later changes no existing grant.
- Reverse: drop `grantScope` from the thread; when scopes arrive every existing grant is given the organization scope.

### 97. A class with no gist parent (2026-11-22)

A question the second review raised: `Role` ships in the thread with no gist parent (decisions 13 and 41), and the
term model let only a category class be parentless, so gate 4 would have rejected it. I chose a stated exception: a
class may have no gist parent when it gives its reason, in a short committed list the gate compares against, each
entry ratified by me. `Role`'s reason: its individuals are the concepts of `MemberRoleScheme`, and `gist:Permission`
fits once `permits` exists. The agent recommended the same.

- Rationale: nothing false is asserted meanwhile, and the exceptions are few and in one visible place.
- Reverse: admit `gist:Permission` and put `Role` under it; the list loses the entry.

### 98. Which fields of the audit record get terms in the thread (2026-11-22)

A question the second review raised under decision 22: the `Activity` record's fields had no properties in the thread.
I chose four: `recordedActor` (to the `Member`), `action`, `recordedAt` and `inTenant`. The copied actor name and the
detail sentence are `noTerm`, reason screen. The agent field waits for `AgentRun` in the party slice and is marked
`noTerm` with a sixth reason, deferred, which names the slice that will place it; this adds one value to decision 21's
closed list. The agent recommended the same.

- Rationale: the thread's sentence, who did what, when and in which tenant, is then wholly in the graph.
- Reverse: mark `action` and the time `noTerm`, reason deferred; the two links stay.

### 99. How records are enrolled for gates 5 and 7 (2026-11-22)

A question the second review raised under decision 95: the enrolled folders also hold records whose terms are not in
the thread. I chose enrolment by record: a named list, which for the thread is the kernel's `Member`, `Role` and
`Activity` and the access contract's records that are views of them; each later slice adds its records. This replaces
decision 95's "the access contract and the four kernel records". The agent recommended the same.

- Rationale: no record carries a placeholder mark for a term that does not exist yet.
- Reverse: enrol whole folders and mark every unplaced schema `noTerm`, reason deferred.

### 24. The version scheme (2026-11-22)

I chose a semantic version string written in the module, never taken from the clock. Before publication it stays
`0.y`: any change advances `y`, and a change after which data or an answer that held before no longer holds is
recorded as breaking in the release notes. `1.0` is the first published namespace, when decision 7's placeholder is
replaced. The agent recommended the same.

- Rationale: the byte-compare forbids the clock, and the package version moves with code that leaves the terms alone.
- Reverse: write a date string in the same header field.

### 100. The People page's record in the thread (2026-11-22)

A question report 14 raised under decision 99: the People page's `Person` record is a view of a membership and is
enrolled, but its `email` and `joinedAt` fields have terms only in the party slice. I chose `noTerm`, reason deferred,
naming the party slice, for both. The agent recommended the same.

- Rationale: the record's role and member fields are checked from the first day, and the email is the sign-in
  identity, not a copy for the screen, so it must not be marked as never getting a term.
- Reverse: take the record off the thread's list; the party slice enrols it.

### 101. Whether each concept needs its own ratification (2026-11-22)

A question report 14 raised under decision 32. I chose that the ruling on a scheme covers the concepts listed in the
proposal I see; a concept added later to a ratified scheme is a proposal of its own. The thread therefore needs 18
rulings: seven classes, nine properties and two schemes. The agent recommended the same.

- Rationale: viewer, editor and admin are the record's three existing codes; ruling on each would ask one thing
  three times.
- Reverse: write a `rat-` record per concept; the terms do not change.


### 102. What warrants Grant in the thread (2026-11-22)

The auditor's adversary failed Grant, `grantedTo`, `grantsRole`, `grantScope`, `GrantScopeKindScheme` and Organization
because CQ-P06 can be answered with a role written on the member. I chose to add one competency question that cannot
be answered without a grant: at which scope does each member hold which role. Decision 40 stands. The agent
recommended the same.

- Rationale: a term is warranted by a question that fails without it; the scope is what a grant has and a role on a
  member has not.
- Reverse: drop Grant, its three properties and the scope scheme from the thread and write the role on Member; the
  thread shrinks to 13 terms.

### 103. What makes an organization the same organization (2026-11-22)

The identity question the project profile kept for me. I chose the legal entity: the same organization is the same
legal entity. A successor company is a new Organization even when it keeps the workspace, and the Tenant role then
passes to the new one. A body with no registration is told apart by its founding. The agent recommended the same.

- Rationale: it can be checked, and it decides the case the adversary raised (a dissolved company and its successor
  under one workspace are two).
- Reverse: read identity as continuity of the body through renames and successions; every stored link to an
  organization that changed legal entity is then re-read as one organization.

### 104. What makes a person the same person (2026-11-22)

I chose the human being: one human is one Person for life and after death. Two records of the same human denote one
Person, and merging them is a matter of data quality, not of two people. An account or a member id never identifies a
person. The agent recommended the same.

- Rationale: decision 34 made Person the human, not the record of one.
- Reverse: one Person per stored record until linked; Person then becomes an information record and decision 34 is
  reopened.

### 105. The parked observations of the thread's audit run (2026-11-22)

The auditor's gate refuses a run in which more than half of the observations that matter are parked as unresolved.
In the thread's run 37 of 57 are (65%): each is an Effect Schema call expression the observation adapter 1.0.0 cannot
describe, beside a declaration it did read. I chose to waive the limit for this run, with that reason in the run
manifest. The 37 rows stay listed and the next run must re-open them. The agent recommended the same.

- Rationale: the alternative is more parser code than I approved, and a new adapter version changes every
  observation id.
- Reverse: write adapter 1.1.0 that describes those expressions, re-prove it and re-observe.

### 106. What CQ-P10 asks in the thread (2026-11-22)

The auditor's adversary failed AuditEntry and `recordedActor` because CQ-P10 asked who did each recorded act, and an
audit entry is a record about a change, not the change, and cannot prove who made it. I chose to reword the question
to ask about the entries: what does each audit entry say was done, which member does it name, and when was it
written. The terms stay as decision 98 set them. The change itself stays a parked candidate. The agent recommended
the same.

- Rationale: the stored rows can answer what an entry says; they cannot answer what happened.
- Reverse: keep the first wording and add a term for the change the entry is about, after deciding how fine-grained
  one change is.

### 107. What the foundational audit of the thread counts for (2026-11-22)

The auditor ran twice on the thread's terms and its adversary failed every proposal both times (18, then 15). In the
second run 13 of 15 failed on one point: no quoted fact shows a term is more than a well-commented stored row, and
nothing in this application's code or documents can show otherwise. I chose to treat the audit as advisory: both runs
are kept as findings ([report 15](research/15-audit-findings.md)), no third run is made, and the thread's 18 terms
are settled by my rulings in this file, not by the auditor's `rat-` records. This amends decisions 32 and 101 for the
thread: a thread term names the decision of this file that accepted it. The agent recommended the same.

- Rationale: the thread's terms are commitments I made about what the application means, not discoveries from its
  code; the audit cannot certify that kind of term, and its other findings are still worth having.
- Reverse: take the adversary's cuts (no Grant class, no Organization class) and rerun, or run a third round on the
  merged branch; either reopens decisions 34, 40 and 102.

### 108. How Person is defined (2026-11-22)

A design point the audit's adversary raised (report 15, section 5). Person read "A human being that a tenant deals
with, as a member of its workspace or as a contact at another organization", which stops being true of someone removed
from every workspace. I chose the definition "A human being." What a tenant has to do with a person is said by Member
and by the party slice's contact terms. The agent recommended the same.

- Rationale: decision 104 makes a person the human for life; a definition that ends when a tenant stops dealing with
  them describes a role.
- Reverse: restore the longer wording; Person then reads as a role and its parent `gist:Person` no longer fits.

### 109. What a role is when what it permits changes (2026-11-22)

A design point the audit's adversary raised. I chose the named level: a role is the named level of access (viewer,
editor, admin), and it is the same role when what it permits changes. Decision 41's criterion, the scheme and the
notation, stands. What a role permits is not a term in the thread; if permissions ever need a history, that is a term
of its own then. The agent recommended the same.

- Rationale: the application stores a role's code and no policy version, and no thread question asks what a role
  permitted in the past.
- Reverse: identify a role by its level and one policy version; every stored role then needs a version it does not
  have.

### 110. Whether Organization stays in the thread (2026-11-22)

A design point the audit's adversary raised: no thread question needs the Organization class, since Tenant answers
them all. I chose to keep it in the thread. The agent recommended the same.

- Rationale: Tenant is a role an organization plays (decision 38) and takes its identity from Organization
  (decision 103); without it Tenant has no identity of its own until the party slice.
- Reverse: move Organization to the party slice and put Tenant directly under `gist:Organization`; the thread drops
  to 17 terms.

### 111. The thread's 18 terms are accepted (2026-11-22)

With the audit advisory (decision 107) the thread's terms are settled by my ruling. I chose to accept them as a set:
the seven classes, nine properties and two schemes of report 14, section 2, as that section states them with
decisions 103, 104, 108 and 109 applied, and the four concepts the two schemes list (decision 101). Grant stays as
decisions 40 and 102 set it. Each of these terms names this decision in the vocabulary module; the exception entry
for `Role` names decision 97. The agent recommended the same.

- Rationale: I decided each term's shape in decisions 8 to 110; ruling on each again would ask the same things
  eighteen times.
- Reverse: walk the 18 one by one; a term I then refuse leaves the module and report 14.

### 112. The ROBOT release for the reasoner (2026-11-23)

The download decision 25 left owed. I approved ROBOT v1.9.11: the file `robot.jar`, 82,708,624 bytes, published
2026-10-01, sha256 `53cd275c8e4c0dad1fc2c1c34174876795cd7d6b6926e1444adcbb0cb3c7ab26`, from
`https://github.com/ontodev/robot/releases/download/v1.9.11/robot.jar`, and I chose to have it fetched once and tried
that day. The agent recommended the same. It was tried on 2026-11-23, outside the repository: the bytes hashed to the
value above; under Java 17.0.2 `validate-profile --profile DL` passed a seven-line test ontology and
`reason --reasoner hermit` found it consistent (exit 0); with its one person also typed as a tenant, HermiT reported
"The ontology is inconsistent" and exited 1. The gate 9 script fetches this file, checks this hash and keeps the jar
outside the repository.

- Rationale: the architecture seed pinned the same release, and no report had checked that it starts here.
- Reverse: pin another release; I approve its file, source, hash and size the same way first.

### 113. Which Java the reasoner pin names (2026-11-23)

I chose Java 17, pinned by its major version. The agent recommended the same.

- Rationale: ROBOT 1.9.11 is compiled for Java 11 and its own CI tests 11, 15 and 17; 17.0.2 is already installed on
  my machine, so nothing is fetched there, and my machine and CI differ in patch level.
- Reverse: pin 21 or 25; neither is in ROBOT's tests, and 21 is a second download to approve.

### 114. Whether CI runs the reasoner (2026-11-23)

The question decision 25's approval carried. I chose a CI job of its own: it sets up Java 17, restores the jar from a
cache keyed by its sha256, fetches it only when the cache has none, checks the hash and runs gate 9. The agent
recommended the same.

- Rationale: a change that makes the vocabulary inconsistent then fails its pull request, not only a `check:full` on
  a machine that has Java and the jar.
- Reverse: run gate 9 in `check:full` only, or nightly; CI then fetches nothing and an inconsistency can reach main.

### 115. Where the blinded seat's notes land (2026-11-23)

Report 15, section 5, point 5. I chose all three outside the thread, and the 18 terms stay as decision 111 accepted
them. `Member.id` needs no change: report 14 already makes it the identity of a membership, not of a person. A grant
scope that records only its kind is enough while organization is the only kind, since the member's tenant says what
is covered; how a grant names the location or field it covers is open decision 116. Account, Session, the agent named
on an audit entry and the rule that an organization keeps an admin stay out, as report 14 section 1.3 and decision 98
say. The agent recommended the same.

- Rationale: none of the three changes an answer to a thread question.
- Reverse: add a property from a grant to the thing it covers now; a nineteenth term, accepted like the 18.

### 117. Whether the thread carries a list of forbidden conclusions (2026-11-23)

An idea of the adhd pass, not adopted until now. I chose yes, sized to the thread: three to five bans over the
thread's own terms, in my words, in the goal's SPEC, each with one fixture that must be refused and one near miss
that must pass, each routed to the reasoner or to a must-fail query. The agent drafts the list and I rule on each
ban. The agent recommended the same.

- Rationale: the audit found no quoted fact that makes a term more than a stored row; a ban is something a term says
  that a row does not.
- Reverse: ship the thread with gate 9's one negative and write the list with slice 1.

### 118. Whether competency answers are locked (2026-11-23)

The other adhd idea. I chose the expected rows as the lock: no new file and no update flag. A commit that changes an
expected-rows file says so, and the release notes name the question with its old and its new answer. The agent
recommended the same.

- Rationale: gate 8 already compares each question's rows to a committed file; a rule about changing it shows a
  changed meaning that unchanged Turtle bytes hide.
- Reverse: a lock file a run writes and an update flag, as the catalog model's rule lock has.

### 119. The brief matches (2026-11-23)

The packet scheme's fourth condition for graduating. I said the brief matches: `BRIEF.md`, with the thin thread of
report 14 as the first deliverable and decisions 1 to 118 as recorded, is what I want built. The exploration
graduates to the goal `erp-vocabulary`. The agent recommended the same.

- Rationale: the brief has its five parts, the thread waits on no open decision, the Map names the goal and its first
  slice, and nothing is owed from me for the thread.
- Reverse: set the exploration back to `shape` and the goal to `dropped`; no code exists to undo.

### 120. Whether the thread runs CQ-P11 (2026-11-23)

Decision 102 added CQ-P11 as the question that warrants Grant, and report 14's done line ran CQ-P06 only. I chose to
run both in the thread's gate 8, on the same two-tenant fixture: CQ-P11's expected rows are the two grants at
organization scope, and its must-fail case removes the two `grantScope` triples and expects no row. No term is added.
The agent recommended the same.

- Rationale: without it the thread ships a grant's scope that no question is run against.
- Reverse: gate 8 runs CQ-P06 only, and CQ-P11 is first run by the slice that brings a second scope kind.

### 121. The thread's five forbidden conclusions (2026-11-23)

The list decision 117 asked for. The agent drafted five and I signed each, one question a ban:

1. A person is never an organization, so never a tenant. The reasoner refuses the fixture's person typed as a tenant;
   the same person as a member of two tenants passes.
2. An audit entry is never the person or the organization it is about. The reasoner refuses a node typed both audit
   entry and person, and one typed both audit entry and tenant; an entry that names a member of that person in that
   tenant passes. It does not say "never the member it names": gist states no disjointness that would show it, and
   the thread adds no local pair.
3. A role held in one tenant is never a role in another. The question asked through the person instead of the member
   is refused (must-fail case M5); the real question passes.
4. A role is never read off a member directly; it is held only through a grant. A graph with the role written on the
   member answers nothing (must-fail case M3); the lifted graph passes. If decision 40 is reversed this ban goes with
   it.
5. Sharing a member, a person or a name never makes two tenants one organization. Gate 3 refuses a vocabulary file
   that states sameness; Tenant stated as a kind of Organization passes. It shows the vocabulary gives a reasoner no
   way to merge two tenants, not that a reasoner refuses data that says they are one. The review of the goal
   added two refused files beside that one: `membershipOf` made inverse functional, and a key on `Tenant`.

The agent recommended signing each.

- Rationale: decision 117's; four of the five were already planted mistakes or must-fail cases of report 14, and the
  list says in my words what each one protects.
- Reverse: take a ban off the list; its test stays as the planted mistake or must-fail case it was. Ban 2's two
  refused fixtures and its near miss are new and would go.

### 122. The IRI the OWL file names as gist's version (2026-11-23)

Report 14 section 8 writes `dcterms:source <the version IRI gist 14.1.0 states for itself>` and says the constant is
copied from the pinned gist file. That file, `ontologies/gistCore.ttl` at tag `v14.1.0`, states the template
placeholder `https://w3id.org/semanticarts/ontology/gistCoreX.x.x`, which gist's release build replaces.

I chose `https://w3id.org/semanticarts/ontology/gistCore14.1.0`; the agent recommended the same. It is held in the
vocabulary's `gist` part as `versionIri`.

- Rationale: it says which release was projected, in the form gist's releases use. The placeholder names no version,
  and the unversioned ontology IRI would leave the release number out of the generated file.
- Not verified from a file: the agent read only the tagged source, which holds the placeholder. The value follows
  gist's naming. The first step that opens a released gist file checks it.
- Reverse: change the one field; the OWL file's one triple changes and gate 1 shows it.

### 123. Whether Sutton's API names may be written here (2026-11-26)

Sutton's GraphQL schema is behind a token, and this repository is public. Decision 29 (a) cites a Sutton term by "a
public document", which the API is not.

I chose names only; the agent asked and recommended nothing. Sutton's type, field and enum names, and a short quote
of a description, may be written in the packet. The schema file stays outside the repository, and no record of the
demo organization is written here.

- Rationale: an alignment row is worth nothing without the name it aligns to.
- Reverse: take the names out of report 16 and cite the public help pages only, as report 11 did.

### 124. Whether Sutton is modelled whole (2026-11-26)

The brief's Non-goals ruled out modelling Sutton whole: a Sutton-only term entered only when a competency question of
rank must or should needed it.

I chose to model it all; the agent had not recommended either way. I have the schema through a demo key and API
access.

- What it changes: the brief's rule is taken back, and with it the brief's limit of slice 1 to the Sutton-only party
  terms a must or should question needs. Decision 1 stands: the model of record is this repository's, and Sutton is
  still a mapping onto it. Decision 87's ranking of the questions stands. The records report 16 section 3 lists are
  in scope.
- What "all" covers was decided after: decision 128. Which slice takes which records is
  [report 17](research/17-sutton-whole-model-plan.md)'s plan and is not ruled on.
- Reverse: restore the brief's rule; terms already added for Sutton alone stay or go one by one.

### 128. What "all" of Sutton includes (2026-11-26)

Decision 124 chose to model Sutton whole and left open what that covers.
[Report 17](research/17-sutton-whole-model-plan.md) counts 200 record types: 122 that describe business things, 11
settings that hold a tenant's rules, and 64 layouts, generated documents, navigation and helper types (its question
P20).

I chose the business things; the agent recommended the same. The 122 get terms or are parts and views of a term,
with `RutterConnection` and the integration links. The settings and the layouts get no term. A setting that is a
business rule is written down as a rule of the term it governs.

- Rationale: a term for a packing-slip section or a sidebar layout answers no question the packet asks.
- What it gives up: a tenant's rules (an approval threshold, whether over-receiving is refused, how lot numbers are
  made) cannot be queried as data.
- Reverse: give the 11 settings types terms, in the slices that hold what they govern (4, 6 and 7).

### 36. What data proves the party model (2026-11-26)

The messy sample stores items only, and my Sutton workspace is an empty trial: no company, no contact and no item, two members and one address (read on 2026-11-26).

I chose named `test_` fixtures in the packet; the agent recommended the same.

- Rationale: nothing is written to Sutton and nothing is added to the app, and the must questions are not blocked.
- What it gives up: no party answer is checked against a record a person entered.
- Reverse: add a party sample file to `public/samples/`, or read records once the workspace has some; the fixtures stay as the must-fail cases.

### 37. Which context owns the party records (2026-11-26)

I chose a new party context; the agent recommended the same. Organizations, contacts, addresses, identifiers and identity decisions get their contract there when their first record is built. Access keeps members, grants, agents and the audit trail. Every other term with no record gets its context when its first record is built.

- Rationale: party records are neither permissions nor items, and catalog and the later orders both point at them.
- Reverse: move the contract into the access context; the term pointers move with the schemas and no term changes.

### 12. Whether a class may have more than one parent, and whether Party is a class (2026-11-26)

I chose one identity-bearing parent (a gist class or a local class) plus any number of local category parents, with `Party` a category over `Person` and `Organization`, which keep their gist parents. The agent recommended the same.

- Rationale: one parent guards against inheriting two identity criteria, and a category supplies none. A Sutton `Company` of kind `individual` is a person, so the customer of an order needs a range that takes either.
- What it does not decide: the item kinds' parent, which is decision 92.
- Reverse: drop `Party` and declare no range on the properties that used it; each record's SHACL then says which class it takes.

### 87. How the competency questions are ranked (2026-11-26)

I chose to keep the ranking after decision 124: must is what the repository records today and the party model; should is stock, locations and traceability; could is commitments; will-not is telemetry, FSMA and planning. The agent recommended the same.

- Rationale: decision 1 stands. Sutton is modelled whole (decisions 124 and 128), but a question only Sutton's data can answer does not block a slice.
- Reverse: rank Sutton's areas must; slices 6 to 8 then need fixtures and passing queries for them before they are done.

### 125. What a Sutton `Company` of kind `individual` is (2026-11-26)

Put to me on a fixture: a `Company` named "test_Ana Ruiz", `kind: individual`, `type: [customer]`.

I chose a `Person` with the tenant's `SourceRecord`: `recordOf` points at a person when `kind` is `individual` and at an organization when it is `company`. The agent recommended the same.

- Rationale: Sutton says an individual is "a person modelled as a company — a sole trader or a retail customer", and decision 34 already names `Person` for the human. Typing a retail customer an organization would make "people who are customers" return nothing.
- What changes: decision 3's "a person cannot be an Account" is struck; decision 34's "the Sutton Account is the organization" is narrowed to `kind: company`; the alignment row for Sutton's company is split by `kind`.
- Reverse: type every `Company` an `Organization`; the flags and the source record stay where they are.

### 126. Where billing or shipping purpose sits for a Sutton record (2026-11-26)

Put to me on a fixture: company "test_Northwind Foods" with addresses "HQ" typed `billing` and "Dock 4" typed `shipping`, and one contact "test_Lee Park" (type `vendor`) with no address of their own.

I chose the address: purpose is read from `Address.type` and its default flags, and no `ContactAssignment` is made up. Where a contact has a typed address of their own, that one is read as the contact's. The agent recommended the same.

- Rationale: Sutton never says which contact is the billing contact; deriving one for each contact at each address states pairs nobody recorded.
- What changes: one alignment row, purpose to `AddressType`, and a property for an address's purpose. Decisions 39 and 43 stand for sources that record a contact's purpose, and are not used for Sutton records.
- Reverse: derive assignments at import; the address's purpose stays.

### P1. Whether a Sutton `Organization` is the Tenant (2026-11-26)

A question of report 17 (P1), put to me on my own workspace: an `Organization` with `accountType: trial`; the other account types are `customer`, `internal`, `sandbox` and `unassigned`.

I chose a record of the body: a Sutton `Organization` is a `SourceRecord` whose `recordOf` is the tenant's organization, and `inTenant` stays this repository's tenant. A trial or sandbox workspace of the same company is a second record of one body, never a second Tenant. The agent recommended the same.

- Rationale: decision 103 makes an organization the legal entity, and no thread term changes.
- What it does not decide: the schema links no two workspaces, so that two of them are one body is a person's identity decision, never inferred. That one company has several workspaces is read from the account types, not seen.
- Reverse: mint one Tenant per Sutton `Organization`.

### 35. Whether every role flag and classified field is always stated (2026-11-26)

Put to me on a fixture: Sutton company "test_Kessler Steel" with `type: [vendor]` only.

I chose closed in every stored record: each flag is true or false and each classified field holds a concept, so the fixture stores `isVendor` true and `isCustomer` false. A source that says nothing about a flag leaves the record waiting as Needs a decision, so an unmapped field is never stored as false. The agent recommended the same.

- Rationale: CQ-P02 and "which organizations are not vendors" need a declared closure, and one reading of a field is kept whatever the record's source.
- What changes: the flags' record schema (`sh:minCount 1`) on the tenant's `SourceRecord` (decision 34); report 12's closure contracts.
- Reverse: store only true flags and drop the questions that read a missing flag as false.

### P2. Whether an invited or revoked Sutton member is a Member (2026-11-26)

A question of report 17 (P2), put to me on a fixture: member "test_Sam Ortiz", status pending, role `MANAGER`, `assignedLocations` ["test_Plant 1"].

I chose yes, with a stage: a Member exists from the invitation, its stage a concept of a membership status scheme (pending, active, revoked), and the role and locations Sutton states for an invitee are kept. The agent recommended the same.

- Rationale: Sutton gives a pending member an id, a role and locations, and its role counts include invited members; dropping them loses grants the source states.
- What changes: the thread's Member definition, "lets the person act in the tenant's workspace", is widened to cover the invited and revoked stages. That is a breaking change to an accepted term under decision 24 and is recorded as one when the vocabulary changes.
- Reverse: import a member only once active and restore the definition.

### 89. Whether carrier and contract manufacturer are role flags (2026-11-26)

Put to me on fixtures: "test_Rapid Freight", named as the carrier on a shipment, and "test_Coastal Co-Pack", which runs an outsourced job.

I chose two flags only, `isCustomer` and `isVendor`; the agent recommended the same. A carrier is known from the shipment that names it. The other two flags are added when a source or a competency question of rank must or should needs them.

- Rationale: decision 3 names customer and vendor only, and Sutton's company `type` has only those two. With decision 35 closed, four flags would leave every Sutton company waiting on two flags its source never states.
- What changes: report 06's `isCarrier` and `isContractManufacturer` stay held back as notes; report 01 and the project profile, which list four, are corrected when next touched.
- Reverse: add the two flags on the tenant's `SourceRecord`, where decision 34 put the two there are.

### 44. Who the actor of a portal request is (2026-11-26)

Put to me on a fixture: "test_Northwind Foods" opens its customer portal link and approves a quote.

I chose the account organization, through its `PortalAccess`; the agent recommended the same.

- Rationale: Sutton's portal has no sign-in, so all that is known is that someone holding the company's link acted. Naming a contact would state more than that.
- What changes: `recordedActor`'s range takes a portal access; an audit entry, which today always names a member, must be able to name one when portals are built.
- Reverse: add portal sign-in and name the contact.

### 33. How a deprecated term is written, and whether a retired code still decodes (2026-11-26)

Put to me on a fixture: unit concept "test_PCS" retired and replaced by "EA", with 40 stored items still saying PCS.

I chose: `owl:deprecated true`, `dcterms:isReplacedBy` naming the successor at that retirement (not a pointer kept at today's last term), the version as `skos:historyNote`, and the logical axioms dropped. A retired concept's notation stays in the record's `Literals`, so a stored row still decodes and lifts, and an edit that leaves the value alone keeps it. Screens offer only live concepts, and a command that assigns the value anew refuses a retired one. The agent recommended the same.

- Rationale: both properties are already in `CoreVocab`; a row a person can no longer open is worse than an old code on screen.
- Not built: the refusal of a new assignment. Reads and commands share one `Literals` schema today, so hiding a choice does not narrow a command.
- What changes: the deprecation triples; report 05's V12 and V14, which must not fail an earlier replacement when its successor retires; the command schemas that assign a classified value.
- Reverse: drop a retired notation from `Literals` after every stored row has been changed.

### 29. How a term of a standard with no RDF namespace is cited (2026-11-26)

I chose a named external term: the standard, the term's name as written (Sutton's "Company"), and a public document. It is emitted only as a row of the generated SSSOM file and a header note, never as a `skos:*Match` triple. The agent recommended the same.

- Rationale: decision 7 forbids minting under Sutton's name, and a local IRI per external term is that under another host; a documentation URL makes a web page stand for a concept. Sutton's API documentation is behind a sign-in, so a Sutton row's document is a public page where one exists and the schema's type name where none does (decision 123: names only).
- What changes: report 05's `NamedExternalTerm`; 44 rows of report 11 and every Sutton row of the whole model.
- Reverse: mint local IRIs for external terms and emit the triples.

### 28. How the alignment triples sit beside the OWL the reasoner reads (2026-11-26)

I chose a separate generated alignment file that declares the five `skos:*Match` predicates annotation properties and is never in the reasoner's closure, which holds the OWL file and each fixture only. The agent recommended the same.

- Rationale: no target's meaning reaches the reasoner, and an alignment change never touches the file the reasoner gate reads.
- What changes: report 12's four files and gate 9's inputs; report 11's rule text.
- Reverse: move the declarations into the OWL file.

### 27. How a competency question reaches an inferred type (2026-11-26)

I chose that each query walks `rdf:type/rdfs:subClassOf*` itself and runs in `check` with no reasoner; the reasoner stays its own gate. The agent recommended the same.

- Rationale: decision 6 runs the reasoner in `check:full` only, and this keeps the suite in the fast loop. With decision 12 a question about parties finds a `Person` through the category parent.
- What it gives up: a fact only a reasoner could derive is not found by a question.
- What changes: every drafted query; report 12's gates 8 and 10, where gate 10 has no question to run.
- Reverse: run the suite over a reasoned copy merged with each fixture.

### 45. Whether a software agent is a class of its own (2026-11-26)

I chose not yet: an agent run carries the agent's name. The agent recommended the same.

- Rationale: the repository names agents inside the app only, by name, acting for a signed-in person and capped by that person's role; a class would have no record behind it.
- Reverse: add a `SoftwareAgent` class once an outside agent calls the API with its own credential; `agentName` then becomes a pointer.

### 17. Whether concept schemes and concepts are also typed by gist (2026-11-26)

I chose SKOS only: no `gist:ControlledVocabulary` or `gist:Category` typing. The classification properties still sit under `gist:isCategorizedBy` (decision 16), and a concept that is also a unit or a dimension is typed by its class (decision 61). The agent recommended the same.

- Rationale: report 05 projects a scheme to `skos:ConceptScheme` only and report 11 takes neither gist class; the typing answers no question and would put every concept under gist's `Category` disjointness.
- What changes: the gist parent column of report 10's scheme rows.
- Reverse: add the two typings in the projector; no term changes.

### 18. Which values the kind tag takes (2026-11-26)

I chose nine values, on classes only: kind, subkind, role, phase, relator, event, information, category, value. The agent recommended the same.

- Rationale: customer and vendor are flags on the tenant's `SourceRecord` (decisions 3 and 34), so nothing bears a role mixin yet; `Party` takes category (decision 12); a property's category is its domain and range.
- What changes: report 05's `KindTag`, V16 and V17.
- Reverse: add a role mixin value when a role that people and organizations both play becomes a class.

### 19. Whether the metamodel's facts reach the Turtle (2026-11-26)

I chose no: the kind tag, identity criterion, scope and ratification stay in the module, gate 4 reads them there, and no metamodel IRI is minted. The agent recommended the same.

- Rationale: nothing outside the repository reads them, and gate 4 checks tags against axioms in TypeScript.
- What changes: report 12's `termCategory` row is not minted.
- Reverse: publish the tag as `inv:termCategory` with a `TermCategoryScheme`, a minor version.

### 31. What an alignment's confidence is (2026-11-26)

I chose a number from 0 to 1, as SSSOM writes it; the agent recommended the same.

- Rationale: the generated SSSOM needs a number, and the architecture seed asks for confidence with the evidence.
- What it gives up: a number can look more exact than the judgement behind it; the evidence beside it says what it rests on.
- What changes: report 05's `Confidence`.
- Reverse: three words turned into numbers by a fixed table.

### 30. Which schema.org namespace (2026-11-26)

I chose `https://schema.org/`; the agent recommended the same.

- Rationale: the release file report 11 read uses https, and the vendored `CoreVocab` already writes https and may not be edited.
- What changes: the skills' `namespaces.json`, which said http, now says https; 23 rows of report 11 stand as written.
- Reverse: rewrite the rows and the entry to http.

### 129. How the party slice's terms are accepted (2026-11-26)

I chose one design report and one accepting decision, and a term whose parent changes keeps the decision it names; the agent recommended the same.

- Rationale: decision 107 amends 32 and 101 for the thread only, and gate 4 reads a ratification as a whole number, so P1, P2 and "39 and 43" cannot be named. Decisions 12 and 17 already rule the new links of `Person`, `Organization` and `grantScope`.
- What changes: report 18 gives each new term's label, definition, tag, parents, identity criterion and gist names, `Member`'s widened definition, `Party`'s exception entry and the ranges of decision 145. I accept it as one decision and each new term names that number. `Person`, `Organization` and `grantScope` keep 111; the accepting decision lists their new links, and the header of `Terms.vocab.ts` says so.
- Reverse: have each changed term name the accepting decision, or write a `rat-` record per term.

### 130. Which terms the module takes beyond the brief's list (2026-11-26)

I chose the brief's list with the stage scheme and `membershipStatus` (P2), the address terms (126) and a term for each field of report 17's slice-1 types that points at no later slice and is no setting; the agent recommended the same.

- Rationale: decision 124 lifts the brief's limit, and a field left without a term is a gap the Sutton mapping meets later.
- What changes: a property no enrolled record marks and no question reads is stated on a named fixture of its own, read by guard 3 and gate 9: `model-call.ttl` for `callPurpose`, `calledFor` and `calledAt`, `sutton-party.ttl` for the coverage table's, `accountStatus` on the tenant's `SourceRecord` with `AccountStatusScheme` among them. Fixtures hold `test_` records only.
- Reverse: take out each property no record or question reads, with its fixture line.

### 131. Whether report 17's slice-1 row is the goal's Sutton scope (2026-11-26)

I chose yes, with a Sutton member's role left for slice 4; the agent recommended the same.

- Rationale: Sutton's roles (`FULL_ACCESS_USER`, `MANAGER`, `SHOP_FLOOR_OPERATOR` and a tenant's own) are not viewer, editor and admin, and nothing says which is which.
- What changes: `Company`, `Contact`, `Address`, `Organization`, `OrganizationMember`, `UserProfile` and `User` are placed by the goal's coverage table; `CurrentUser` and `CurrentUserOrganization` are covered as views of the same records; a Sutton member is given no grant in this slice.
- Reverse: map `UserProfile.role` to a grant at organization scope, with a rule for each Sutton role.

### 145. What recordOf and decidesOn range over (2026-11-26)

I chose `recordOf` over `Party` and `decidesOn` over `SourceRecord`; the agent recommended the same.

- Rationale: an identity decision is about the records that were compared, as reports 06 and 13 and CQ-P04's fixture have it; the metamodel requires a range, and `Party` is every referent this slice has.
- What changes: both ranges are written in report 18. `recordOf` is widened when a later slice has a record of something that is no party (report 04's CQ-I10). The brief's sketch, which drew `decidesOn` over `Party`, is corrected at the goal's close.
- Reverse: make an object property's range optional in the metamodel and declare none for `recordOf`.

### 134. How a membership reaches its sign-in account and email (2026-11-26)

I chose a new property from `Member` to its `SignInAccount`, which carries `accountEmail`; the agent recommended the same, against the brief.

- Rationale: the `member` table's `userId` and Sutton's `OrganizationMember.user` both link a membership to an account, no record holds a person's id to walk through, and the lift writes one node step.
- What changes: `Person.email` is placed as a path of one node step from the member. The brief's and report 06's route through the person (`membershipOf`, `accountOf`, `accountEmail`) is not built; the brief is corrected at the goal's close.
- Reverse: widen the lift and gate 5 to two node steps and route the email through the person.

### 133. Which node a path through the person names (2026-11-26)

I chose that the lift writes no person node, and that `Organization.members` gets no path of its own; the agent recommended the same.

- Rationale: decision 104 says an account or a member id never identifies a person, and a person minted per membership would make one person in two tenants two (decision 94).
- What changes: a path through the person is checked by gates 5 and 7, and a person's name is stated on fixtures by hand, as `Person.role` was in the thread. Each member a Sutton `Organization.members` lists is a `Member` whose `membershipIn` is the record's tenant, the fact placed once from the member's side.
- Reverse: mint a person node from an id a record holds, once one does.

### 132. Which property carries a name (2026-11-26)

I chose `inv:name` as a sub-property of `gist:name`; the agent recommended the same.

- Rationale: report 13 keeps `name` only as a stored sub-property, and a property of our own has a definition, a domain and marks our gates can check.
- What changes: `inv:name` enters with the access terms. Its link to `gist:name` is written once that property's domain and range are read from the pinned gist file and rule C9 passes; until then the link waits and the property stands without it.
- Reverse: drop the gist link, or use `gist:name` directly.

### 135. How an audit entry's agent is placed (2026-11-26)

I chose a new property from `AuditEntry` to `AgentRun` with `agentName` on the run, and a lift that refuses to write a run's node; the agent recommended the same.

- Rationale: decision 45 puts the agent's name on the run; `AgentRun` stores no id, and an id minted from the audit entry would say every entry is its own run, which nobody decided.
- What changes: gate 5's P4 lets a record whose class stores no id name it on the record alone. `Activity.agent` is placed; fixtures state a run by hand.
- Reverse: have the lift mint the run's node from the audit entry's id.

### 138. Where addresses and contact points hang, and what holds an address's purpose (2026-11-26)

I chose `PostalAddress` keyed by its id within the tenant and reached from the tenant's `SourceRecord`, with its purpose a property over `ContactPurposeScheme` widened to ship_from, manufacturing and other; the agent recommended the same.

- Rationale: an address carries the tenant's own terms and default flags for that company, which decision 34's reason puts on the tenant's record; on the `Party`, two tenants' addresses would merge and one tenant's default would show for the other. A second scheme would hold billing and shipping twice.
- What changes: decision 126's property for an address's purpose ranges over the one scheme; `defaultFor` holds the default flags; contact points hang the same way. `countryCode` is stated only once a person accepts the code read from Sutton's free text.
- Reverse: split the address purposes into a scheme of their own.

### 139. A Sutton contact's company, type, owners and the primary contact (2026-11-26)

I chose a term for each of the four; the agent recommended the same.

- Rationale: without the link nothing says whose contact a contact is, and decision 126 forbids only a made-up assignment with a purpose.
- What changes: a property from the contact's record to the company's record, carrying no purpose; a `ContactTypeScheme` of Sutton's four values; a property from the contact's record to a `Member` for an owner; `primaryContact` between the two records. Each is stated on the fixture `sutton-party.ttl`.
- Reverse: take the four out with their fixture lines.

### 137. Whether the stage scheme takes suspended (2026-11-26)

I chose yes, a fourth stage; the agent recommended the same. This amends decision P2, which named three.

- Rationale: Sutton's `MemberStatus` has active, pending, revoked and suspended, and a suspended member can come back, which revoked would lose. Decision 101 makes a concept added to a ratified scheme a proposal of its own; this is it.
- What changes: the stage scheme has pending, active, suspended and revoked.
- Reverse: retire the concept with revoked as its replacement (decision 33).

### 136. What CQ-P07 counts as an admin who is not removed (2026-11-26)

I chose a member whose stage is active; the agent recommended the same.

- Rationale: a pending invitee cannot yet act (report 17), so counting one could show an organization with an admin nobody can sign in as.
- What changes: CQ-P07's fixtures state the stage, since the repository's members store none. No `removedAt` term while no enrolled record holds one. Sutton's `startDate` and `endDate` get no term until something reads them; whether they are employment dates was not checked.
- Reverse: count every stage but revoked.

### 146. How much of report 05's term model the party slice builds (2026-11-26)

I chose what its terms and the answered decisions need, plus V18's refusal of an identity criterion that rests on a name or an email; the agent recommended the same.

- Rationale: this slice writes new criteria, and report 04's CQ-I08, a must question, fails `Organization`'s criterion written on `name`. A part with nothing in the module to check has only planted tests.
- What changes: the metamodel gains what V18 needs to read a criterion's basis. V16's disjoint groups, the alignment rows and the rest come back with the slice that needs them, each named in the goal's closing note. C11 stands where report 05's V17 differs.
- Reverse: build the remaining checks of V1 to V26.

### 140. What CQ-P03 reads under decision 126 (2026-11-26)

I chose each `ContactAssignment`, as the brief writes it; the agent recommended the same.

- Rationale: decisions 39 and 43 stand for sources that record a contact's purpose, and reading addresses too would mix who to call for billing with where to send the bill.
- What changes: CQ-P03 runs on fixtures of a source that records a contact's purpose; decision 126's `test_Northwind Foods` gives no row. Under decision 87 that blocks no slice.
- Reverse: rewrite the question to read purposes from addresses as well.

### 142. Whether the Sutton fields under "No term" get none (2026-11-26)

I chose no term; the agent recommended the same.

- Rationale: they are settings, sign-up bookkeeping or display data no question reads (logo, notes, website, `isOrgCreator`, `heardAboutUs`, `firstLogin`, `isDigitAdmin`, `clerkOrganizationId` and the others the goal's coverage table lists).
- What changes: the column of `goals/party-slice/SPEC.md` stands as written.
- Reverse: add one property for a field, with its fixture line.

### 147. Whether the party slice is a goal of its own (2026-11-26)

I chose yes, `goals/party-slice`; the agent recommended the same.

- Rationale: one goal per slice, as report 17 section 7 proposes; `goals/erp-vocabulary` is done and stays closed.
- What changes: the brief's Map, whose goal column names `erp-vocabulary` for every slice-1 row, is corrected at this goal's close.
- Reverse: move the goal's two files into `goals/erp-vocabulary` as a second part.

### 151. Whether a retired concept keeps its class assertion (2026-11-26)

I chose that it loses it, as step 2 built; the agent recommended the same.

- Rationale: decision 33 has a retired term drop every logical axiom, and in OWL 2 a class assertion is one; kept, a query listing a class's values would return retired ones.
- What changes: nothing. A retired concept stays an `owl:NamedIndividual` with its labels and its replacement, and a stored row that holds its notation still decodes.
- Reverse: have the projector keep the `rdf:type` and change its test.

### 152. Whether a scheme's retirement covers its live concepts (2026-11-26)

I chose no: each concept is retired by its own entry, as step 3 built; the agent recommended the same.

- Rationale: decision 33 speaks of a term's own retirement, and in a vocabulary gate 4 passes the case cannot arise alone, since C15 refuses a live relation whose range is a retired scheme.
- What changes: nothing. Gate 5's P14 refuses a pointer only at a concept retired itself; the near miss in `Pointers.test.ts` holds this.
- Reverse: have `retiredConcept` read the scheme's retirement too.

### 141. Whether the party slice takes Permission and permits (2026-11-26)

I chose no: they come with slice 4; the agent recommended the same.

- Rationale: no repository record and no slice-1 question reads a permission, and report 17 puts `Permission` with roles and sites.
- What changes: nothing in this slice; decision 41's question is settled for it.
- Reverse: add the two terms on a fixture.

### 150. Whether a gist property's own gist parent is copied now (2026-11-26)

I chose not yet; the agent recommended the same.

- Rationale: no slice-1 property sits under a gist property whose own parent the module would state, so the field would be tested on planted copies only.
- What changes: nothing. Decision 16's first clause is met when the first term needs it: one optional field, one projected triple and gate 3's allowlist. Until then gate 3 refuses such a triple.
- Reverse: build the field now.

### 144. How often the version moves while a goal is built (2026-11-26)

I chose once for the goal, to `0.2.0`, with one release line; the agent recommended the same.

- Rationale: decision 24 says any change advances the version and is silent on a branch's commits; nothing reads the version before a merge.
- What changes: the version moves in the step that adds the first party terms, and the release line is marked breaking when `Member`'s definition widens.
- Reverse: move the version at every commit that changes a generated file.

### 148. Where the questions' hand-written fixtures live (2026-11-26)

I chose the packet for new fixtures, `explorations/erp-ontology/assets/requirements/cq/`, with the thread's CQ-P06 fixture left in `packages/ontology/fixtures/cq/`; the agent recommended the same.

- Rationale: decision 36 says "in the packet"; moving the thread's fixture changes no answer and touches every test that reads it.
- What changes: nothing; step 5 built it so.
- Reverse: move the files and change the `?raw` paths and one `turbo.json` input.

### 143. Whether the party slice builds the alignment schemas (2026-11-26)

I chose no: `AlignmentRow`, `NamedExternalTerm` and `Confidence` come with the alignment file; the agent recommended the same.

- Rationale: decisions 29 and 31 already fix what they are, and a metamodel part comes back with the slice that needs it.
- What changes: nothing in this slice.
- Reverse: build the three schemas, unused.

### 149. How the lift learns the tenant of the People page's Person (2026-11-26)

I chose that the caller gives it beside the rows, as step 4 built; the agent recommended the same.

- Rationale: the People page lists one organization's members and its record has no tenant field; adding one changes a contract schema and the API's payload for a value the caller already holds.
- What changes: nothing.
- Reverse: add the field and drop the lift's parameter.

### 153. Whether gist's rangeIncludes note binds a sub-property (2026-11-26)

I chose no: the note is a hint; the agent recommended the same.

- Rationale: gist 14.1.0's `gistCore.ttl` (sha256 as the project profile pins it, read 2026-11-26) gives `gist:isCategorizedBy` no `rdfs:domain` and no `rdfs:range`, only `gist:rangeIncludes gist:Category`, an annotation with no logical force; `gist:name` has neither a domain nor a range. Decision 16's test compares declared domains and ranges, and there are none.
- What changes: `grantScope` and the other classification properties go under `gist:isCategorizedBy` (decision 17) and `inv:name` under `gist:name` (decision 132); rule C9 reads both gist properties as declaring no domain and no range. Concepts stay SKOS only.
- Reverse: have C9 read `gist:rangeIncludes` as a range, which refuses a property over a SKOS scheme under `gist:isCategorizedBy`.

### 154. How a Sutton membership is told from one of this app's (2026-11-26)

I chose that `Member` names the workspace it lets its person act in; the agent recommended the same (report 18, question 11).

- Rationale: placed as a `Member` whose `membershipIn` is our tenant and nothing more, an active Sutton member reads as able to act in this app's workspace, which nobody granted, and CQ-P06 would list Sutton's members as ours.
- What changes: one object property from `Member` to the Sutton `Organization`'s `SourceRecord`, stated on every Sutton membership and on none of this app's. `Member`'s definition reads "lets the person act in the tenant's workspace or, where it names one, in that source's workspace". CQ-P06 and CQ-P07 leave out a membership that names a workspace. P1, P2 and decision 133 stand.
- Reverse: reword `Member` to cover both with no link, or hold a Sutton membership as a source record until a person decides it.

### 155. What the lift writes for a path that ends in an attribute (2026-11-26)

I chose nothing, with the record still lifted; the agent recommended the same (report 18, question 2).

- Rationale: minting a node per record makes a person per membership, a run per audit entry and an account per membership, against decisions 94, 133 and 135; refusing the record stops `Member`, `Person` and `Activity` from lifting.
- What changes: for a field whose path ends in an attribute the lift states nothing, an absent value included; the rule reads the last step's property kind only. The values (a member's name, the sign-in email, an agent's name) are written on fixtures by hand. `Grant`'s path, which ends in a relation, is lifted as today. No account node is written until a record holds the account's id.
- Reverse: have the lift write the literal on a minted node.

### 156. What a source record holds when it is read again (2026-11-26)

I chose the latest read; the agent recommended the same (report 18, question 16).

- Rationale: decision 34 makes a second read the same `SourceRecord`, so it must say which read it states; the record should say what its source says now.
- What changes: `capturedAt` holds one value, the latest read's. A flag that differs from what is stored is a change the person confirms before it is written; nothing is replaced silently.
- Reverse: keep the first read, or one `capturedAt` per read.

### 157. Whether a name is the record's or the party's (2026-11-26)

I chose the record's wherever a tenant's record states it; the agent recommended the same (report 18, question 14).

- Rationale: on the party, two tenants' spellings of one body merge on the shared node (decision 138's reason); decisions 93 and 133 already place this app's own names.
- What changes: a Sutton company's, contact's and workspace's names sit on the tenant's `SourceRecord`; this app's member and tenant names, which no source record holds, go through the person and the tenant. A question that asks a name reads both routes.
- Reverse: move every name to the party, or every name to the record (amending 93 and 133).

### 158. How the accepted criteria handle a source's ids (2026-11-26)

I chose that the criteria accepted now hold this app's ids only; the agent recommended the same (report 18, question 12).

- Rationale: no Sutton record is lifted in this slice, and reading an absent issuing system as "ours" is a default the metamodel does not state.
- What changes: `Member`'s criterion is a `MemberId` within its tenant, `SignInAccount`'s a `UserId`, `ContactAssignment`'s its id within its tenant. The Sutton halves are unbuilt until Sutton records are lifted and their IRIs decided; `Member`'s is the workspace link of decision 154.
- Reverse: add the issuing system to each basis, or put it in every record's IRI.

### 159. What identifies a contact point (2026-11-26)

I chose the record that gives it and the field it is read from; the agent recommended the same (report 18, question 13).

- Rationale: no slice-1 source gives a contact point an id of its own, and by its value two parties with one email would share a point, which report 06 rejects and rule C16 refuses.
- What changes: `ContactPoint` stores an id made from that record and field, as the lift makes a `Grant`'s node; a contact's email is one point and its phone another.
- Reverse: mark it as storing no id and state each point by hand.

### 160. Whether a criterion must state its basis (2026-11-26)

I chose optional for this slice; the agent recommended the same (report 18, question 5).

- Rationale: every criterion of report 18 says its own id in the sentence, and a basis entry for a class's own stored id does not exist yet.
- What changes: `restsOn` may be left empty, and rule C16 then has nothing to refuse: a criterion written on a name with no basis stated passes. `AgentRun`'s criterion is restated as "the request it runs in; never the agent's name, which many runs share". The question is put again when a record first stores a criterion's whole basis.
- Reverse: make the basis required, with an own-id entry or an empty basis with a reason, the thread's seven terms gaining one.

### 161. Person stores no id, and the tenant's name is lifted (2026-11-26)

I chose both; the agent recommended the same (report 18, questions 3 and 10).

- Rationale: decision 133 has the lift write no person node, and the member's record already names its tenant through `organizationId`, so the organization's name has a node the record identifies (decision 93).
- What changes: `Person` takes `storesId: false` and keeps decision 111; the accepting decision lists it with the category parent. A path whose node step's property is one another marked field of the same record fills takes that field's object as its node, and the lift writes the literal there; gate 5 accepts the reuse.
- Reverse: leave `Person` at the default; write the organization's name by hand.

### 162. Where a member's own contact points hang (2026-11-26)

I chose a property of its own from `Member` to `ContactPoint`; the agent recommended the same (report 18, question 7).

- Rationale: decision 138 hangs contact points from the tenant's record of a party and a member has none; on the person, one tenant's number would show for another.
- What changes: one object property, stated on `sutton-party.ttl`, for `UserProfile.personalEmail`, `phoneNumber`, `phoneNumberExt` and `personalPhoneNumber`. Decision 138 stands.
- Reverse: let `hasContactPoint` declare no domain.

### 163. UserProfile.image and about (2026-11-26)

I chose a property each; the agent recommended the same (report 18, question 8).

- Rationale: decision 130 gives a term to each field that points at no later slice and is no setting, and decision 142's list does not name these two.
- What changes: two datatype properties on the `Member`, stated on `sutton-party.ttl`.
- Reverse: no term, as `logo` and `notes`.

### 164. UserProfile.id and UserProfile.email wait (2026-11-26)

I chose that both wait; the agent recommended the same (report 18, questions 9 and 15).

- Rationale: whether `UserProfile.id` equals `OrganizationMember.id` was seen on one empty trial workspace only, and one account with two memberships may hold two different `UserProfile.email` values, so it may not be the sign-in email.
- What changes: neither field is placed; report 18 lists both as unplaced with the reason. `accountEmail` is given by `CurrentUser.email` meanwhile. Each is placed once a person has checked it on Sutton records.
- Reverse: place the id as the `Member`'s and the email as the account's.

### 165. Whether V18 refuses a criterion that rests on a SKU (2026-11-26)

I chose not in this slice: it comes with the catalog slice; the agent recommended the same.

- Rationale: decision 146 names a name and an email, and no party term has a SKU; a word match over criterion sentences wrongly lists `Person` and `Role` today.
- What changes: nothing now. The SKU case of CQ-I08 and the review list of V18's sentence part are named in the goal's closing note for the catalog slice.
- Reverse: add a third designation and its planted tests now.

### 166. Which gist super-properties the party slice's properties take (2026-11-26)

I chose all four; the agent recommended the same (report 18, question 6).

- Rationale: read from the pinned `gistCore.ttl` on 2026-11-26, `gist:isAbout` has domain `gist:Content` and no range, `gist:hasAddress` range `gist:Address` and no domain, `gist:atDateTime` range `xsd:dateTime` and no domain; each of our properties falls under them, which is decision 16's test.
- What changes: `recordOf` goes under `gist:isAbout`, `hasPostalAddress` and `hasContactPoint` under `gist:hasAddress`, `eventTime` under `gist:atDateTime`; the module's gist list copies those domains and ranges and rule C9 checks each. gist defines `isAbout` as the subject matter of a document, a looser fit for a record of a party, which I accept.
- Reverse: drop a link; the property stands without it.

### 167. Three readings step 7 built (2026-11-26)

I confirmed all three as built; the agent recommended the same.

- Rationale: none is spelled out by decisions 135 or 146, and each is the stricter reading.
- What changes: nothing. A record of a class that stores no id must name the class on the record alone, so an id field naming it is a P4 finding. Rule C16 also refuses a basis key that is no property of the vocabulary. The metamodel's three new fields are `restsOn`, `designation` and `storesId`.
- Reverse: let such a record carry an id field and have the lift refuse it.

### 168. Which source records state the customer and vendor flags (2026-11-26)

I chose only a record of a trading account; the agent recommended the same (report 18, question 6 of its second list).

- Rationale: a Sutton `Contact` and a Sutton `Organization` are source records too, and their source never states a trading role; under decision 35's closure each would wait as Needs a decision for good, the harm decision 89 refused.
- What changes: `isCustomer` and `isVendor` are stated, true or false, on a record whose source has a trading-role field (a Sutton `Company`), and their definitions say so. A contact's or a workspace's record carries neither. Decision 35 stands for the records it covers.
- Reverse: state both on every source record, false by a rule for contacts and workspaces.

### 169. membershipIn's text beside decision 154 (2026-11-26)

I chose to reword it; the agent recommended the same (report 18, question 2 of its second list).

- Rationale: decision 111's text, "the tenant it lets its person act in", is wrong for a Sutton membership, which lets its person act in the source's workspace.
- What changes: `membershipIn` reads "Links a membership to the tenant it belongs to, in whose workspace, or in a source's workspace it names, it lets its person act." Its text changed, so it names the accepting decision, as `Member` does, and the release line marks it breaking.
- Reverse: restore decision 111's text.

### 170. Party stores no id (2026-11-26)

I chose `storesId: false` for `Party`; the agent recommended the same (report 18, question 10 of its second list).

- Rationale: a category has no id of its own, and the lift reads only the range class itself, so a link to `Party` would mint a node typed only `Party`.
- What changes: the lift refuses to write a `Party` node; a record's party is stated on fixtures as a `Person` or an `Organization`.
- Reverse: keep the default and have the lift refuse a link whose range is a category.

### 171. Guard 1 compares subject and property (2026-11-26)

I chose that guard 1 compares the subject and the property, not the property alone; the agent recommended the same (report 18, question 9 of its second list).

- Rationale: once the lift writes a tenant's name (decision 161), guard 1 as built would refuse a person's name written by hand on CQ-P06's fixture (decision 133), both being `name`.
- What changes: one guard and its test, in step 11. A fixture may state by hand a property the lift writes on other subjects.
- Reverse: keep guard 1 and put the person's name in a fixture of its own.

### 172. Where a Sutton UserProfile's names and job title sit (2026-11-26)

I chose on the `Member`; the agent recommended the same (report 18, question 3 of its second list).

- Rationale: a Sutton member has no source record, and decision 163 already places its image and text on the membership; through the person, two workspaces' spellings would sit on one node.
- What changes: `UserProfile.fullName`, `firstName`, `middleName`, `lastName` and `jobTitle` are stated on the `Member`, per tenant. This app's own member names stay through the person (decision 133).
- Reverse: state them on the person by hand.

### 173. PostalAddress's criterion beside decision 158 (2026-11-26)

I chose that decision 158's rule applies to it; the agent recommended the same (report 18, question 4 of its second list).

- Rationale: its only source is Sutton's `Address.id`, and a source's id beside another system's of the same text in one tenant would read as one address.
- What changes: the criterion is decision 138's with "an id a source issued waits until that source's records are lifted". Fixtures state `test_` addresses by name.
- Reverse: keep decision 138's words unqualified.

### 174. Gist links of memberContactPoint and defaultFor (2026-11-26)

I chose `memberContactPoint` under `gist:hasAddress` and no gist parent for `defaultFor`; the agent recommended the same (report 18, questions 5 and 8 of its second list).

- Rationale: a member's contact point is an address like any other, and rule C9 passes it; `defaultFor` ranges over a scheme but says which purpose an address is the default for, not what kind of thing it is, so decision 17 does not cover it.
- What changes: decision 17 is read as covering the properties that classify a thing. One more link under `gist:hasAddress`.
- Reverse: put `defaultFor` under `gist:isCategorizedBy`.

### 175. How a lift would write a contact point (2026-11-26)

I chose that contact points are written by hand in this slice and the rule is asked later; the agent recommended the same (report 18, question 7 of its second list).

- Rationale: decision 159 gives a contact point an id from its record and field while decision 155 has the lift state nothing for a path that ends in an attribute; no step of this goal lifts one.
- What changes: nothing is built. The question is put when Sutton records are first lifted, on a real record.
- Reverse: a second exception to decision 155 that mints the node from record and field.

### 176. The party slice's terms accepted (2026-11-26)

I accepted report 18 (`research/18-party-slice-terms.md`, as committed at `8363bfb1`) as the text of the party slice's terms; the agent recommended a new heading for it, and I chose the same.

- Rationale: decision 129 has one report and one accepting decision; a number of its own names the text accepted and not the method chosen before it was written.
- What changes: each new term's label, definition, tag, parents, identity criterion, basis and gist names are the report's, and each names 176: 10 classes, 27 object and 26 datatype properties, 7 schemes with 24 concepts. `Member` and `membershipIn`, whose text changed, name 176, as does `Party`'s entry in the no-gist-parent exceptions. `Person`, `Organization` and `grantScope` keep 111; their new links are `Party` as category parent of `Person` and `Organization`, `storesId: false` on `Person`, and `grantScope` under `gist:isCategorizedBy`. The choices the report lists in its section 11 are accepted with it. Terms enter the module in steps 9 to 12 of `goals/party-slice`.
- Reverse: a term is changed or retired by a decision of its own (decisions 24 and 33).

### 177. Whether CQ-P06 lists a member whose person has no stated name (2026-11-26)

I chose that the member stays listed; the agent recommended the same.

- Rationale: the question asks who is in the organization, and a missing name should not lose a member.
- What changes: the person's name is optional in CQ-P06, as the sign-in email is; a member with no stated name is listed with no name. One query and its test.
- Reverse: require the name and say in the release line that a member without one is not listed.

### 178. The lift's two edge cases under decision 161 (2026-11-26)

I chose that the lift states nothing for the field and the record still lifts; the agent recommended the same.

- Rationale: decision 155 has the record still lift, and one ambiguous field should not stop what the rest of the record says. No record reaches either case today.
- What changes: where two fields of one record fill the node step's relation, or the reused step fixes a concept, the lift writes nothing for that field instead of refusing the record. The planted tests keep both cases.
- Reverse: refuse the record, naming the field.

### 179. CQ-P04's shared-name case states the name (2026-11-26)

I chose to add the name; the agent recommended the same.

- Rationale: the case "two records that share only a name are not thereby the same party" held only because neither record stated one; `name` did not exist when step 10 was built.
- What changes: `test_AcmeC` and `test_AcmeD` state `inv:name "Acme Industrial"` in CQ-P04's fixture; the test reads that they share it and give no pair, and CQ-P05's ASK stays false.
- Reverse: take the two lines out and reword the goal's acceptance line.
