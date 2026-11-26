> In this repository read `project-profile.md` first; where it and this file disagree, it wins.

# gist Categories: Decision Procedure

How to place a class of this repository's ERP ontology under the gist projection (decision 4 in
`project-profile.md`). This file takes the place of `bfo-categories.md`, which is not used here.

## What was read

- gist release 14.1.0 (tag `v14.1.0`, released 2026-04-17), file `ontologies/gistCore.ttl` from
  https://github.com/semanticarts/gist at that tag, 3,421 lines, sha256
  `0d8230f3a4df9aa7782ec79bfa83def34a13a066f60d5f5ef0f00b9cecce08b1`, read 2026-11-22.
- Namespace: `https://w3id.org/semanticarts/ns/ontology/gist/` (prefix `gist:`). gist is CC BY 4.0.
- Every class and property named below was found in that file as an `owl:Class`, `owl:ObjectProperty` or
  `owl:DatatypeProperty` with that exact local name. The definitions below are paraphrases, not quotes.
- To re-check a name against a newer release, ask before fetching that tag's `gistCore.ttl` into a scratch folder
  outside the repository (`project-profile.md`, "What exists"), then look for
  the subject line (`grep -c '^gist:Offer$' gistCore.ttl` prints 1 when it exists). Never name a gist term from
  memory.

## What the projection takes, and what it leaves

A gist class enters when a term needs it (decision 13). Its named gist ancestors come with it as names and subclass
links only (decision 14). Our terms use `skos:prefLabel` and `skos:definition` in English (`@en`, decision 11). The list of projected terms lives in the vocabulary module, which is not built yet; until then a proposed
list is a TypeScript sketch in a research report.

gist often states a parent inside an `owl:equivalentClass` intersection rather than as `rdfs:subClassOf`
(`gist:Agreement` is defined as `gist:Intention` and some restrictions). The projection writes that named operand
as a plain `rdfs:subClassOf`. The "gist parent" column below gives it as found in 14.1.0.

gist also uses axioms the project does not copy:

- `owl:equivalentClass` definitions and the restrictions inside them (`gist:Offer` requires planned start and end
  datetimes, a giver, something offered and something asked in return);
- `owl:inverseOf` (18 uses in 14.1.0, all inside restrictions); this repository uses no `owl:inverseOf`;
- functional, transitive and symmetric property characteristics.

The projection copies exactly the `owl:disjointWith` pairs gist states between classes it takes (decision 15).
The thin thread has three: `gist:Organization` and `gist:Content`, `gist:Organization` and
`gist:PhysicalIdentifiableItem`, and `gist:PhysicalIdentifiableItem` and `gist:Content`.

## The classes this ERP needs

Decision 13 admits the seven gist classes in bold for the thin thread (report 14, section 2.5).

| Need | gist class | gist parent (14.1.0) | What it is in gist | Example here |
| --- | --- | --- | --- | --- |
| Person | **`gist:Person`** | `gist:LivingThing` | A human being, living or dead | A signed-in member, a contact at a vendor |
| Living thing | **`gist:LivingThing`** | `gist:PhysicalIdentifiableItem` | An organism | Ancestor of `gist:Person` |
| Organization | **`gist:Organization`** | none | A structured body formed for goals; may have no members | A Sutton Account, with role flags (decision 3) |
| Membership | **`gist:TemporalRelation`** | none | A relationship that holds for a time | `Member` links a person to a tenant |
| Grant | **`gist:Assignment`** | `gist:TemporalRelation` | A relationship made by assigning something | `Grant` assigns a role to a member at a scope |
| Agreement | `gist:Agreement` | `gist:Intention` | An arrangement where two or more parties commit to each other | A signed supply agreement |
| Contract | `gist:Contract` | `gist:Agreement` | An agreement enforceable by law | A purchase contract |
| Commitment | `gist:Commitment` | `gist:Intention` | A promise by one party to others | A promised delivery date |
| Contingent obligation | `gist:ContingentObligation` | `gist:Commitment` | A commitment that becomes firm only when some event happens | A conditional rebate |
| Offer | `gist:Offer` | `gist:ContingentObligation` | A contingent commitment to exchange goods, services or money, valid for a period | A quote, a price-list line |
| Specification | `gist:Specification` | `gist:Intention` | What it means to be a type of thing, precise enough to test conformance | A material spec |
| Catalog item | `gist:CatalogItem` | `gist:Specification` | A description of a product or service precise enough to tell whether delivery discharged the obligation | An item a buyer pays for |
| Product specification | `gist:ProductSpecification` | `gist:CatalogItem` | A description of something that can be warehoused or stored and delivered | The item master record |
| Service specification | `gist:ServiceSpecification` | `gist:CatalogItem` | A description of something done for a person or organization | Freight, a repair |
| Physical thing (countable) | **`gist:PhysicalIdentifiableItem`** | none | A discrete physical object; count nouns | A serialized unit, a pallet |
| Physical amount (mass) | `gist:PhysicalSubstance` | none | An undifferentiated amount of material; mass nouns | 250 kg of flour in a bin |
| Equipment | `gist:Equipment` | `gist:PhysicalIdentifiableItem` | Human-made tangible property used to do a task, other than land or buildings | A forklift, a filler |
| Place on earth | `gist:GeoLocation`, `gist:GeoRegion`, `gist:GeoPoint` | `gist:GeoLocation`: none; `gist:GeoRegion` and `gist:GeoPoint`: `gist:GeoLocation` | A location with the earth as frame; a bounded region; a point by latitude and longitude | A site's area, a dock's coordinates |
| Address | `gist:PhysicalAddress`, `gist:ElectronicAddress` | `gist:Address` (itself under `gist:Content`) | A reference that a routing method can locate, where things or messages are sent | A ship-to address, an email address |
| Event | `gist:Event` | none | Something that occurs over time | A receipt, a count |
| Transaction | `gist:Transaction` | `gist:Event` | An exchange or transfer of goods, services or funds | A shipment received, a sale |
| Determination | `gist:Determination` | `gist:Event` | An event that establishes a value or outcome | A cycle count |
| Scheduled event | `gist:ScheduledEvent` | `gist:Event` | An event with a planned start | A planned production run |
| Magnitude | `gist:Magnitude` | none | The amount of a measurable characteristic | 250 kg on hand |
| Reference value | `gist:ReferenceValue` | `gist:Magnitude` | A magnitude set by fiat, not measured or estimated | A reorder point |
| Unit of measure | `gist:UnitOfMeasure` | none | A standard amount used to measure | kg, each, case |
| Aspect | `gist:Aspect` | none | A measurable characteristic | Mass, count, volume |
| Unit group | `gist:UnitGroup` | `gist:Collection` | Units that measure the same aspects | Mass units |
| Category | `gist:Category` | none | A label that sorts things, with no formal semantics | A free-text item group |
| Product category | `gist:ProductCategory` | `gist:Category` | A way of categorizing products | A product family |
| Tag | `gist:Tag` | `gist:Category` | A user-made folksonomy term | A label a person typed |
| Controlled vocabulary | `gist:ControlledVocabulary` | `gist:Collection` | A managed collection of terms | A code list kept by a team |
| Identifier | `gist:ID` | `gist:Content` | Content that uniquely identifies something | A SKU, a vendor's account number |
| Information | **`gist:Content`**, `gist:Text` | none; `gist:ContentExpression` | Information in a medium; written characters | An imported file, a note |

The "example here" column is a placement to test, not a decision: a parent for a term of this repository is
proposed in a research report and decided by Benjamin.

Properties gist offers for these classes (all exist in 14.1.0 as named): `gist:hasParty`, `gist:hasGiver`,
`gist:hasRecipient`, `gist:hasParticipant`, `gist:offersToProvide`, `gist:offersToReceive`, `gist:conformsTo`,
`gist:owns`, `gist:isMemberOf`, `gist:isPartOf`, `gist:hasAddress`, `gist:hasPhysicalLocation`, `gist:occursIn`,
`gist:hasMagnitude`, `gist:numericValue`, `gist:hasUnitOfMeasure`, `gist:hasAspect`, `gist:isCategorizedBy`,
`gist:isAbout`, `gist:hasBroader`, `gist:isIdentifiedBy`, `gist:idText`, `gist:uniqueText`, `gist:isAllocatedBy`,
`gist:name`, `gist:plannedStartDateTime`, `gist:actualStartDateTime`. Use one direction of each; gist itself defines
no `gist:hasPart`, and none is added here. The thin thread takes no gist property; the party slice takes
`gist:isCategorizedBy` and `gist:isAbout` first (report 18 section 8, decision 176). When a slice takes one, copy its
named `rdfs:subPropertyOf` links, never its domain or range. Put an `inv:` property under it only if the local property's
domain and range fall under the gist property's (decision 16).

## Decision procedure

Ask in order; the first yes places the class. Each answer is a proposal until Benjamin decides it.

1. **Does it happen over time?** `gist:Event`. An exchange of goods, services or money is `gist:Transaction`; an
   event that settles a value (a count) is `gist:Determination`; one with a planned start is `gist:ScheduledEvent`.
2. **Is it a promise?** Made by one party: `gist:Commitment` (`gist:ContingentObligation` if not yet firm,
   `gist:Offer` if it offers an exchange for a period). Binding two or more parties: `gist:Agreement`
   (`gist:Contract` if enforceable by law). Whether an order is an offer, a commitment or an agreement at each
   stage is a question for Benjamin.
3. **Does it say what a kind of thing is, so that real things can conform to it?** `gist:Specification`; for what a
   buyer pays for, `gist:CatalogItem`; for goods, `gist:ProductSpecification`; for work done,
   `gist:ServiceSpecification`. Physical stock links to it with `gist:conformsTo`.
4. **Is it a person or an organization?** `gist:Person` or `gist:Organization`. Customer, vendor, carrier and
   contract manufacturer are flags on the organization, not classes (decision 3).
5. **Is it a physical thing?** Countable: `gist:PhysicalIdentifiableItem` (`gist:Equipment` for a machine or
   tool). An uncountable amount: `gist:PhysicalSubstance`.
6. **Is it a place, or a way to reach one?** A place on earth: `gist:GeoLocation`, `gist:GeoRegion` or
   `gist:GeoPoint`. A reference used to send things or messages: `gist:PhysicalAddress` or
   `gist:ElectronicAddress`, which gist files under `gist:Content`.
7. **Is it an amount of something measurable?** `gist:Magnitude` with `gist:numericValue`,
   `gist:hasUnitOfMeasure` and `gist:hasAspect`; a value set by fiat is `gist:ReferenceValue`. The unit itself is
   `gist:UnitOfMeasure`.
8. **Is it a label that sorts other things?** A code list (ItemRole: buy, make, sell) is a SKOS scheme in the
   vocabulary module (research/02). A loose grouping a team keeps is `gist:Category` (`gist:ProductCategory`,
   `gist:Tag`), linked by `gist:isCategorizedBy`. If the sorting has formal structure that reasoning needs, it is
   a class instead, as gist's own note on `gist:Category` advises.
9. **Is it a code or string that identifies something?** `gist:ID`, linked by `gist:isIdentifiedBy`. It never
   settles identity.
10. **Is it information held in a medium?** `gist:Content`, or `gist:Text` for written characters.

No answer fits: do not force a parent and do not add a gist class to the projection on your own. Write the term,
the candidates and why each fails, and put it to Benjamin as a question.

## Common mistakes

| Mistake | Why it is wrong | Instead |
| --- | --- | --- |
| A Sutton Account under `gist:Account` | `gist:Account` is an agreement that has a balance, a financial account | `gist:Organization` with role flags (decision 3) |
| The item master under `gist:PhysicalIdentifiableItem` | The item record describes a kind of good; it is not a unit on a shelf | `gist:ProductSpecification`; stock `gist:conformsTo` it |
| Customer or Vendor as a subclass of Organization | They are roles one organization holds at once | Role flags (decision 3); no role classes, no disjointness between them |
| An address placed under `gist:GeoLocation` | In gist an address is content that a routing method resolves, not the place | `gist:PhysicalAddress`; the place, if needed, is a `gist:GeoLocation` it refers to |
| A SKU treated as the item's identity, or two rows with one SKU merged | gist notes two IDs with the same text can refer to different things; identity here is report 01's "tenant and a source id" (`project-profile.md`) | `gist:ID` via `gist:isIdentifiedBy`; no `owl:sameAs` |
| A quantity as a bare number | The unit is part of the fact (250 kg, not 250) | `gist:Magnitude` with `gist:numericValue` and `gist:hasUnitOfMeasure` |
| Available, Committed and Reserved as one enum | They overlap (project-profile.md) | Separate measures; their gist placement is a question for Benjamin |
| A warehouse under `gist:Building` or `gist:Landmark` | Both are deprecated in 14.1.0 (as are `gist:Language`, `gist:SchemaMetaData` and `gist:prevents`) | Ask Benjamin; 14.1.0 has no place-of-business class |
| Naming `gist:Place`, `gist:Agent`, `gist:Party`, `gist:Product`, `gist:Obligation`, `gist:Location`, `gist:Identifier`, `gist:Quantity`, `gist:Unit` or `gist:hasPart` | None of them exists in 14.1.0 | The table above; check every name in the release file |
| Copying a gist `equivalentClass`, restriction or inverse into the vocabulary module | The projection copies named parent links, not gist's definitions or restrictions | A plain parent link |
| An IOF, ISA-95, schema.org, W3C ORG, FIBO or EPCIS class as a parent | Decision 4: they are alignments only | A `skos:closeMatch` or `skos:broadMatch` alignment row in the vocabulary module |
| A code list as subclasses | Enum-is-taxonomy (`foundational-analysis.md`) | A SKOS scheme in the vocabulary module |

## Alignments are rows, not parents

Every local top class has one parent, a projected gist class. A match in another standard (IOF core, ISA-95,
schema.org, W3C ORG, FIBO, EPCIS and CBV, QUDT for units) is an alignment row on the term in the vocabulary module,
projected as a SKOS mapping triple. Prefixes for all of them are in `namespaces.json`. No RDF namespace is recorded
for ISA-95; until one is chosen, its alignment rows cite the standard's term name.
