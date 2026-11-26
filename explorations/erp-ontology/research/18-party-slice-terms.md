---
type: Research
title: The party slice's terms
description: The design of slice 1's terms for one accepting decision (129) - every new and changed class, property, scheme and concept with its text, tag, parents, identity criterion and gist names, the evidence each property enters on and the PLAN step that adds it, the Sutton coverage as answered, the questions each term serves, the choices this report makes, and the questions no decision rules.
---

# The party slice's terms

This is step 8 of [goals/party-slice](../../../goals/party-slice/PLAN.md): the text of every term slice 1 adds to the
vocabulary module, or changes in it, written so that Benjamin can accept it as one decision (decision 129). Nothing
here is built. `packages/kernel/src/Terms.vocab.ts` and every file under `packages/ontology/generated/` are unchanged
by this report; steps 9 to 12 write the terms, each with the marks or the named fixtures that show its properties in
use. The decisions this report applies are 129 to 153 with the earlier ones they cite. Where a source left a name or a
wording open, this report chooses, and the choice is listed in section 11 so that the accepting decision covers it.
Where no decision rules a point that a term rests on, the point is a question in section 13 and nothing that depends
on it is built.

## 1. What this rests on, and what was read

- The goal's [SPEC](../../../goals/party-slice/SPEC.md) and [PLAN](../../../goals/party-slice/PLAN.md), steps 1 to 7
  as built, and the answered decisions 129 to 153 in [DECISIONS.md](../DECISIONS.md), with 12, 16 to 18, 33 to 37,
  45, 89, 94, 100, 101, 104, 124 to 126, 128, P1 and P2.
- Term text: [report 06](06-party-and-access-terms.md) (classes, properties, the axiom plan), [report
  04](04-requirements.md) (`SourceRecord`, its four properties, CQ-P01 to CQ-P11 and the drafted queries),
  [report 10](10-taxonomies.md) (sections 4.8, 4.9 and 4.29, the schemes and concepts), [report
  13](13-term-index.md) (the reconciled keys), [report 14](14-thin-thread.md) (the thread's terms and form) and
  [report 17](17-sutton-whole-model-plan.md) with `assets/sutton/readings.json` (Sutton's types, fields and enums,
  names only, decision 123). A Sutton enum value is written here only where report 16, report 17, `readings.json` or
  a decision names it.
- The metamodel as steps 1 and 7 built it: `packages/foundation/modeling/vocabulary/src/Model.schema.ts` (the nine kind
  tags, `categoryParents`, `storesId`, a stated criterion's `restsOn`, a property's `subPropertyOf`, `evidence` and
  `designation`) and gate 4's rules C1 to C16 in `Rules.rules.ts`.
- **gist names, parents and disjoint pairs** are read from `.agents/skills/_shared/gist-categories.md` and report 11
  (tables A, B and D), not from the pinned gist file, which is kept outside the repository and was not opened for
  this report. The domains and ranges of `gist:isCategorizedBy` and `gist:name` are decision 153's reading of that
  file: neither declares a domain or a range. That `gist:isCategorizedBy` is a relation and `gist:name` an attribute
  is how step 7's tests write them (`gistAsPinned` in `packages/foundation/modeling/vocabulary/test/Rules.test.ts`).
- No Sutton data was read (the goal's choice, PLAN "Choices made"), and no file outside the repository was opened.

Notation as in report 14 section 2: `inv:` is `https://example.org/inventory-import/ontology/`, `gist:` is
`https://w3id.org/semanticarts/ns/ontology/gist/`, a key is the local name, labels and definitions are English. The
kind tag, the identity criterion and its basis, `storesId`, `designation` and `evidence` live in the module only and
reach no Turtle (decision 19).

## 2. The accepted set in one view

| | New | Changed |
| --- | --- | --- |
| Classes | 10: `Party`, `SourceRecord`, `IdentityDecision`, `IdentityEvidence`, `AgentRun`, `ModelCall`, `SignInAccount`, `PostalAddress`, `ContactPoint`, `ContactAssignment` | 3: `Member` (definition and criterion, P2), `Person` and `Organization` (category parent `Party`, decision 12) |
| Object properties | 25 | 1: `grantScope` (under `gist:isCategorizedBy`, decision 17) |
| Datatype properties | 24 | none |
| Schemes | 7: `IdentityOutcomeScheme`, `MembershipStatusScheme`, `ModelCallPurposeScheme`, `ContactPurposeScheme`, `ContactPointKindScheme`, `ContactTypeScheme`, `AccountStatusScheme` | none |
| Concepts | 24 | none |
| gist list | 5 classes (`Event`, `Determination`, `Address`, `PhysicalAddress`, `ElectronicAddress`), 1 disjoint pair, 2 properties (`isCategorizedBy`, `name`) | none |
| Exception list | 1 entry: `Party` | none |

After step 12 the module holds 17 classes, 58 properties (33 object, 26 datatype), 9 schemes and 28 concepts, against
the thread's 7, 9, 2 and 4.

**Which decision each term names** (decision 129). Each new term, `Member` and `Party`'s exception entry name the
decision that accepts this report. `Person`, `Organization` and `grantScope` keep decision 111: their text does not
change, and the accepting decision lists their new links (section 3.3). Whether the accepting decision is decision
129 itself or a new heading is question 1 (section 13); this report calls it "the accepting decision".

## 3. Classes

### 3.1 New classes

Every criterion below is stated with its basis (`restsOn`): the properties of the vocabulary it reads. Section 6
shows each passes rule C16 as step 7 built it. A class's own stored id is said in its sentence and is not a key of
`restsOn`, which holds property keys only (question 5).

| Key | Label | Definition | Tag | Parent | Category parents | Named gist ancestors | Identity criterion | Basis (`restsOn`) | Step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Party` | Party | An agent that is either a human being or an organized body, named so that the properties persons and organizations share have one range. | category | none, on the exception list (section 3.4) | none | none | none: a category supplies no criterion (decision 12, rule C7) | none | 9 |
| `SourceRecord` | Source record | Content an external system or the tenant holds about one thing as captured at one time, named by its system, its record type and its opaque id; the tenant's assertions about that thing, such as its customer and vendor flags, sit on it. | information | `gist:Content` | none | none | Stated: the tenant, the source system, the record's type and its opaque id, each kept as written (case, leading zeros, punctuation); equal ids in two systems or two tenants are two records (decision 34). | `inTenant`, `sourceSystem`, `sourceType`, `sourceId` | 9 |
| `IdentityDecision` | Identity decision | A determination by a member that two source records the tenant holds describe the same party, or different parties, resting on the evidence it cites. | event | `gist:Determination` | none | `gist:Event` | Stated: the tenant and the decision's own id; a later decision about the same two records supersedes it and never edits it. | `inTenant` | 10 |
| `IdentityEvidence` | Identity evidence | A statement of one observed likeness or difference between two source records the tenant holds, such as a shared tax number or names one letter apart, cited by an identity decision. | information | `gist:Content` | none | none | Stated: its own id within the decision that cites it. | `citesEvidence` | 10 |
| `AgentRun` | Agent run | An event in which a software agent acts for one signed-in member, never above that member's role nor above its own role cap. | event | `gist:Event` | none | none | Stated: the request it runs in and the agent that acts; no record stores an id for a run, so `storesId` is false (decision 135). | none | 11 |
| `ModelCall` | Model call | An event in which the app asks a language model one question for a tenant, taken from that tenant's daily allowance before it is asked. | event | `gist:Event` | none | none | Stated: the tenant and the call's id, the `modelCall` table's key. | `inTenant` | 11 |
| `SignInAccount` | Sign-in account | A credential record that lets one person sign in to an application, this one or a source such as Sutton, before any organization is chosen. | information | `gist:Content` | none | none | Stated: the account's id in the system that issued it (this app's `UserId`, a Sutton `User.id`), never its email, which can change (decision 104). | none | 11 |
| `PostalAddress` | Postal address | A physical address, written as lines, locality, region, postal code and country, that a tenant's record of a party gives for receiving or sending goods, documents or invoices. | information | `gist:PhysicalAddress` | none | `gist:Address`, `gist:Content` | Stated: its own record id within the tenant; equal text on two records is two addresses (decision 138). | `inTenant` | 12 |
| `ContactPoint` | Contact point | An electronic address, an email address or a telephone number, at which a party is reached. | information | `gist:ElectronicAddress` | none | `gist:Address`, `gist:Content` | Stated: its own record id within the tenant; two parties with one email have two contact points. | `inTenant` | 12 |
| `ContactAssignment` | Contact assignment | A relationship naming one person to reach at one account for a stated purpose using a particular contact point. | relator | `gist:Assignment` | none | `gist:TemporalRelation` | Stated: the tenant and the assignment's own id in its source, never the person or the contact point alone (decisions 39 and 43). | `inTenant` | 12 |

Every new class but `AgentRun` keeps `storesId` at its default, true. `Party` is never typed directly: a property
whose range is `Party` takes a `Person` or an `Organization` (decision 12), found by the questions through
`rdfs:subClassOf*` (decision 27).

### 3.2 `Member`, changed (decision P2, amended by 137)

| Field | Thread text (decision 111) | Text accepted here |
| --- | --- | --- |
| Definition | A relationship between one person and one tenant that lets the person act in the tenant's workspace from the day it is made until it is removed. | A relationship between one person and one tenant, made when the person is invited and kept after it is revoked, that lets the person act in the tenant's workspace while it is active. |
| Identity criterion | the MemberId within its tenant, kept after removal. It rests on Member.id and Member.organizationId. | the membership's id within its tenant as its source gives it, this app's MemberId or a Sutton OrganizationMember.id, kept at every stage, revoked included. It rests on Member.id and Member.organizationId. |
| Basis (`restsOn`) | none stated | `membershipIn` |
| Tag, parent | relator, `gist:TemporalRelation` | unchanged |
| Ratification | 111 | the accepting decision |

The widening is breaking under decision 24: a pending invitee was not a member and now is. Step 11's commit marks the
release line "0.2.0: the party slice" breaking and names `Member` and decision P2 (SPEC, Constraints).

### 3.3 `Person`, `Organization` and `grantScope`: new links, decision 111 kept

| Term | New link | Ruled by |
| --- | --- | --- |
| `Person` | category parent `Party`, beside its gist parent `gist:Person` | decision 12 |
| `Organization` | category parent `Party`, beside its gist parent `gist:Organization` | decision 12 |
| `grantScope` | `rdfs:subPropertyOf gist:isCategorizedBy` | decisions 16, 17 and 153 |

No label, definition, tag, parent or criterion of the three changes. Step 9 rewrites the header of `Terms.vocab.ts`,
which says every term is decision 111's text, to say that the thread's terms keep 111 with these links and that the
party slice's terms name the accepting decision. Whether `Person` also takes `storesId: false` (decision 133) is
question 2.

### 3.4 `Party`'s exception entry

`packages/ontology/exceptions/no-gist-parent.json` gains one entry beside `Role`'s, in step 9:

| `class` | `reason` | `ratification` |
| --- | --- | --- |
| `Party` | gist 14.1.0 has no party class; Party gathers Person and Organization, which keep their gist parents, and supplies no identity. | the accepting decision |

The class's own `parent` is `{ kind: "none", reason }` with the same sentence, which rule C4 compares with the entry.
Decision 97 has each entry ratified by Benjamin; accepting this report ratifies it. Report 11 table F found no gist
class over `gist:Person` and `gist:Organization`.

## 4. Properties

Columns: domain and range are the property's own (decision 16 copies none from gist). "Super" is the gist property
it sits under. "Evidence" is what shows it in use: a mark of an enrolled record, which needs no `evidence` field, or
`evidence: "fixture"` and the named `test_` fixture that states it (decision 130). A fixture named by its question
lives in `explorations/erp-ontology/assets/requirements/cq/` (decision 148); `model-call.ttl` and `sutton-party.ttl`
are the two fixtures of decision 130, read by guard 3 and gate 9 and by no question.

### 4.1 Object properties

| Key | Label | Definition | Domain | Range | Super | Evidence | Step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `recordOf` | record of | Links a source record to the party it was captured about: a person, or an organization (decision 125). | `SourceRecord` | `Party` (decision 145) | none (question 6) | fixture: CQ-P01, CQ-P02, CQ-P09 | 9 |
| `decidesOn` | decides on | Links an identity decision to one of the two source records it compares. | `IdentityDecision` | `SourceRecord` (decision 145) | none | fixture: CQ-P04 | 10 |
| `identityOutcome` | identity outcome | Links an identity decision to what it found: the two records denote one party, or two. | `IdentityDecision` | `IdentityOutcomeScheme` | `gist:isCategorizedBy` | fixture: CQ-P04 | 10 |
| `decidedBy` | decided by | Links an identity decision to the member who made it. | `IdentityDecision` | `Member` | none | fixture: CQ-P04 | 10 |
| `citesEvidence` | cites evidence | Links a decision to a piece of evidence it rests on. | none declared (kept broad, report 06) | `IdentityEvidence` | none | fixture: CQ-P04 | 10 |
| `membershipStatus` | membership status | Links a membership to the stage it stands at: pending, active, suspended or revoked (decisions P2 and 137). | `Member` | `MembershipStatusScheme` | `gist:isCategorizedBy` | fixture: CQ-P07 (decision 136); `sutton-party.ttl` (`UserProfile.status`) | 11 |
| `memberAccount` | member account | Links a membership to the sign-in account its person signs in with to act in that tenant (decision 134). | `Member` | `SignInAccount` | none | mark: `Person.email`'s path, its node step | 11 |
| `recordedAgentRun` | recorded agent run | Links an audit entry to the agent run that made the change for the member it names, when an agent did (decision 135). | `AuditEntry` | `AgentRun` | none | mark: `Activity.agent`'s path, its node step | 11 |
| `maxRole` | max role | Links an agent run to the highest role it may act with, whatever the role of the member it acts for. | `AgentRun` | `Role` | none | mark: `AgentRun.maxRole` | 11 |
| `callPurpose` | call purpose | Links a model call to what it is for: reading a table request, checking the key, or suggesting fixes for an import. | `ModelCall` | `ModelCallPurposeScheme` | `gist:isCategorizedBy` | fixture: `model-call.ttl` | 11 |
| `calledFor` | called for | Links a model call to the member whose action asked for it. | `ModelCall` | `Member` | none | fixture: `model-call.ttl` | 11 |
| `hasPostalAddress` | has postal address | Links the tenant's record of a party to a postal address that record gives (decision 138). | `SourceRecord` | `PostalAddress` | none (question 6) | fixture: `sutton-party.ttl` | 12 |
| `addressPurpose` | address purpose | Links a postal address to a purpose its record types it for, such as billing, shipping or ship from; one address may have several (decision 126). | `PostalAddress` | `ContactPurposeScheme` | `gist:isCategorizedBy` | fixture: `sutton-party.ttl` | 12 |
| `defaultFor` | default for | Links a postal address to a purpose for which it is the one used when an order names no other. | `PostalAddress` | `ContactPurposeScheme` | `gist:isCategorizedBy` | fixture: `sutton-party.ttl` | 12 |
| `hasContactPoint` | has contact point | Links the tenant's record of a party to an email address or telephone number that record gives (decision 138). | `SourceRecord` | `ContactPoint` | none (question 6) | fixture: `sutton-party.ttl` | 12 |
| `contactPointKind` | contact point kind | Links a contact point to what kind of electronic address it is: an email address or a telephone number. | `ContactPoint` | `ContactPointKindScheme` | `gist:isCategorizedBy` | fixture: `sutton-party.ttl` | 12 |
| `contactPerson` | contact person | Links a contact assignment to the person to reach on it. | `ContactAssignment` | `Person` | none | fixture: CQ-P03 | 12 |
| `contactAccount` | contact account | Links a contact assignment to the account at which its person serves its purpose, an organization or a person (decision 125). | `ContactAssignment` | `Party` | none | fixture: CQ-P03 | 12 |
| `assignmentPoint` | assignment point | Links a contact assignment to the contact point to use for it. | `ContactAssignment` | `ContactPoint` | none | fixture: CQ-P03 | 12 |
| `servesPurpose` | serves purpose | Links a contact assignment to the business exchange for which to reach its person at its account using its point. | `ContactAssignment` | `ContactPurposeScheme` | `gist:isCategorizedBy` | fixture: CQ-P03 | 12 |
| `contactAt` | contact at | Links the tenant's record of a contact to the tenant's record of the company the contact belongs to, stating no purpose (decision 139). | `SourceRecord` | `SourceRecord` | none | fixture: `sutton-party.ttl` | 12 |
| `contactType` | contact type | Links the tenant's record of a contact to the kind the tenant files the contact under (decision 139). | `SourceRecord` | `ContactTypeScheme` | `gist:isCategorizedBy` | fixture: `sutton-party.ttl` | 12 |
| `contactOwner` | contact owner | Links the tenant's record of a contact to a member of the tenant who owns the contact (decision 139). | `SourceRecord` | `Member` | none | fixture: `sutton-party.ttl` | 12 |
| `primaryContact` | primary contact | Links the tenant's record of a company to the tenant's record of the contact it names first (decision 139). | `SourceRecord` | `SourceRecord` | none | fixture: `sutton-party.ttl` | 12 |
| `accountStatus` | account status | Links the tenant's record of a party to whether the tenant still trades with the party or has archived the record (decision 130). | `SourceRecord` | `AccountStatusScheme` | `gist:isCategorizedBy` | fixture: `sutton-party.ttl` | 12 |

Every property whose range is a scheme sits under `gist:isCategorizedBy` (decision 17), and C9 passes each, since
`gist:isCategorizedBy` declares no domain and no range (decision 153). As in the thread, the OWL file writes no
`rdfs:range` for a scheme range.

### 4.2 Datatype properties

| Key | Label | Definition | Domain | Datatype | Super | Designation | Evidence | Step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sourceSystem` | source system | The external system a source record was read from, as written. | `SourceRecord` | `xsd:string` | none | none | fixture: CQ-P01 | 9 |
| `sourceType` | source type | The record type the external system gives a source record, as written. | `SourceRecord` | `xsd:string` | none | none | fixture: CQ-P01 | 9 |
| `sourceId` | source id | The opaque id the external system gives a source record, kept exactly as written. | `SourceRecord` | `xsd:string` | none | none | fixture: CQ-P01 | 9 |
| `capturedAt` | captured at | The instant a source record was read from its system. | `SourceRecord` | `xsd:dateTime` | none | none | fixture: CQ-P01 | 9 |
| `isCustomer` | is customer (altLabels Customer, Client, Buyer) | Whether the tenant's record of a party states that the party buys from the tenant, true or false on every stored record (decisions 34 and 35). | `SourceRecord` | `xsd:boolean` | none | none | fixture: CQ-P01, CQ-P02 | 9 |
| `isVendor` | is vendor (altLabels Vendor, Supplier) | Whether the tenant's record of a party states that the party sells to the tenant, true or false on every stored record (decisions 34 and 35). | `SourceRecord` | `xsd:boolean` | none | none | fixture: CQ-P01, CQ-P02 | 9 |
| `eventTime` | event time | The instant at which an event occurred, as its record states it. | none declared | `xsd:dateTime` | none (question 6) | none | fixture: CQ-P04 | 10 |
| `evidenceText` | evidence text | The evidence in a sentence a person reads, naming the two values compared. | `IdentityEvidence` | `xsd:string` | none | none | fixture: CQ-P04 | 10 |
| `joinedAt` | joined at | When the membership began, as its record states it. | `Member` | `xsd:dateTime` | none | none | mark: `Person.joinedAt` | 11 |
| `accountEmail` | account email | The email a sign-in account signs in with, compared whatever its case. | `SignInAccount` | `xsd:string` | none | email | mark: `Person.email`'s path, its value step | 11 |
| `name` | name | The name people read for a party, a record or a place, which is never unique and never decides identity or permission. | none declared | `xsd:string` | `gist:name` (decisions 132 and 153) | name | marks: `Member.name` and `Member.organizationName` (each a path's value step), `OrganizationChoice.name`, `Person.name` (section 7) | 11 |
| `agentName` | agent name | The agent's name as people read it in the activity list, such as "Assistant". | `AgentRun` | `xsd:string` | none | name | marks: `AgentRun.agent`; `Activity.agent`'s path, its value step | 11 |
| `calledAt` | called at | When a model call was taken from the tenant's daily allowance. | `ModelCall` | `xsd:dateTime` | none | none | fixture: `model-call.ttl` | 11 |
| `addressLines` | address lines | The street lines of a postal address, in order and as written, one line break between two lines. | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `locality` | locality | The town or city of a postal address, as written. | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `region` | region | The state, province or other region of a postal address, as written. | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `postalCode` | postal code | The postal code of a postal address, kept as text so leading zeros survive. | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `countryCode` | country code | The country of a postal address as a two-letter ISO 3166 code, stated only once a person accepts the code read from the source's own text (decision 138). | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `contactValue` | contact value | The text of an email address or telephone number, as written in the source. | `ContactPoint` | `xsd:string` | none | none | fixture: CQ-P03; `sutton-party.ttl` | 12 |
| `extension` | extension | The extension to dial after a telephone number, as written in the source. | `ContactPoint` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `givenName` | given name | A person's given name as a record writes it. | none declared | `xsd:string` | none | name | fixture: `sutton-party.ttl` | 12 |
| `middleName` | middle name | A person's middle name as a record writes it. | none declared | `xsd:string` | none | name | fixture: `sutton-party.ttl` | 12 |
| `familyName` | family name | A person's family name as a record writes it. | none declared | `xsd:string` | none | name | fixture: `sutton-party.ttl` | 12 |
| `jobTitle` | job title | The title of a person's job at the organization a record names, as written. | none declared | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |

`name` is the one property with a gist super-property among the datatype properties; C9 passes it, since `gist:name`
declares no domain and no range (decision 153).

### 4.3 What is not a term of this slice

`accountOf` and the route `membershipOf/^accountOf/accountEmail` (decision 134); `hasMember` (`^membershipIn`, decision
133); `removedAt` (decision 136); `actsFor`, which no enrolled record fills (`AgentRun` holds `agent` and `maxRole`
only) and no slice-1 question reads; `Permission`, `permits` and `includesRole` (decision 141; the brief);
`PartyIdentifier`, `citesIdentifier`, `SuspectedDuplicate`, `suspects`, `resolves`, `evidenceKind` and
`EvidenceKindScheme`, `PortalAccess` and its properties (decision 44), `isCarrier` and `isContractManufacturer`
(decision 89), a `PartyRole` scheme (decisions 3, 34 and 47), and report 05's alignment schemas (decision 143).

## 5. Schemes and concepts

A concept's IRI is `inv:<SchemeKey>-<notation>` (decision 10), and its notation is the literal a record stores
(report 10 rule 2). No scheme or concept is typed by gist (decision 17).

| Scheme | Label | Definition | Closed | Pointed at by | Step |
| --- | --- | --- | --- | --- | --- |
| `IdentityOutcomeScheme` | Identity outcome | A controlled vocabulary of what an identity decision finds about two source records a tenant holds that may be one party (decision 34). | yes | `identityOutcome` | 10 |
| `MembershipStatusScheme` | Membership status | A controlled vocabulary of the stages a person's membership of a tenant passes through, from invited to revoked. | yes | `membershipStatus` | 11 |
| `ModelCallPurposeScheme` | Model call purpose | A controlled vocabulary of what a call to a language model is made for, each call drawn from the day's allowance. | yes | `callPurpose`; the `ModelCallPurpose` literal (`aboutScheme`) | 11 |
| `ContactPurposeScheme` | Contact purpose | A controlled vocabulary of the purposes for which a party is reached or served: on a contact assignment, the purpose of one person at one account (decisions 39 and 43); on a postal address, a use its record types it for (decision 126). | no | `servesPurpose`, `addressPurpose`, `defaultFor` | 12 |
| `ContactPointKindScheme` | Contact point kind | A controlled vocabulary of the kinds of electronic address at which a party is reached. | no | `contactPointKind` | 12 |
| `ContactTypeScheme` | Contact type | A controlled vocabulary of the kinds a tenant files its contacts under, one per contact, apart from any purpose a contact is reached for. | no | `contactType` | 12 |
| `AccountStatusScheme` | Account status | A controlled vocabulary of whether the tenant still trades with a party it holds a record of or has set that record aside. | no | `accountStatus` | 12 |

| Scheme | Notation | Label | altLabels | Definition |
| --- | --- | --- | --- | --- |
| `IdentityOutcomeScheme` | `sameParty` | Same party | Merge | An identity outcome in which two source records a tenant holds are found to be records of one party. |
| `IdentityOutcomeScheme` | `differentParties` | Different parties | Not a duplicate | An identity outcome in which two source records a tenant holds are found to be records of two parties. |
| `MembershipStatusScheme` | `pending` | Pending | Invited | A membership status in which a person was invited to join a tenant and has not yet accepted, and cannot yet act. |
| `MembershipStatusScheme` | `active` | Active | none | A membership status in which the person may act in the tenant's workspace. |
| `MembershipStatusScheme` | `suspended` | Suspended | none | A membership status in which sign-in is blocked and the history kept, and from which the membership can be made active again. |
| `MembershipStatusScheme` | `revoked` | Revoked | none | A membership status in which the membership no longer lets the person act and is not made active again, its row kept so the audit trail still names it. |
| `ModelCallPurposeScheme` | `view` | Table request | none | A model call purpose in which the table assistant reads a request in words. |
| `ModelCallPurposeScheme` | `check` | Key check | none | A model call purpose in which the app checks that the model key works. |
| `ModelCallPurposeScheme` | `suggest` | Import suggestions | none | A model call purpose in which the app asks for proposals for the rows of an import. |
| `ContactPurposeScheme` | `billing` | Billing | Bill-to | A contact purpose for which invoices and payment questions are sent to the contact point or the address. |
| `ContactPurposeScheme` | `shipping` | Shipping | Ship-to | A contact purpose for which goods sent to the party are delivered to the contact point or the address. |
| `ContactPurposeScheme` | `receiving` | Receiving | Receiving dock | A contact purpose for which the contact point is where goods arriving at the party's site are taken in. |
| `ContactPurposeScheme` | `ordering` | Ordering | Purchase orders | A contact purpose for which purchase orders and order questions are sent to the contact point. |
| `ContactPurposeScheme` | `ship_from` | Ship from | none | A contact purpose for which an address is where goods the party sends leave from. |
| `ContactPurposeScheme` | `manufacturing` | Manufacturing | none | A contact purpose for which an address is where the party has goods made, as its record types it. |
| `ContactPurposeScheme` | `other` | Other | none | A contact purpose for an address its record types as none of the others. |
| `ContactPointKindScheme` | `email` | Email address | Email | A contact point kind for an address that electronic mail is sent to. |
| `ContactPointKindScheme` | `phone` | Telephone number | Phone | A contact point kind for a number that a call or a text message reaches. |
| `ContactTypeScheme` | `customer` | Customer | none | A contact type by which the tenant files a contact as someone at a customer. |
| `ContactTypeScheme` | `marketing` | Marketing | none | A contact type by which the tenant files a contact as someone it reaches for marketing. |
| `ContactTypeScheme` | `sales` | Sales | none | A contact type by which the tenant files a contact as someone it deals with on sales. |
| `ContactTypeScheme` | `vendor` | Vendor | none | A contact type by which the tenant files a contact as someone at a vendor. |
| `AccountStatusScheme` | `active` | Active | none | An account status in which the tenant still trades with the party. |
| `AccountStatusScheme` | `archived` | Archived | none | An account status in which the tenant has set the party's record aside and keeps it only for past records. |

Where they come from: `IdentityOutcomeScheme`, `ModelCallPurposeScheme`, `ContactPointKindScheme` and
`AccountStatusScheme` are report 10 section 4.29's (`AccountStatusScheme`'s two definitions say "party" for
"organization", since a record's party may be a person, decision 125). `ContactPurposeScheme`'s four first concepts
are section 4.9's, `billing` and `shipping` widened to an address; `ship_from`, `manufacturing` and `other` are
decision 138's, the values of Sutton's `AddressType`. `MembershipStatusScheme`'s four stages are decisions P2 and 137
in their order, with the notations of Sutton's `MemberStatus` (report 10's `invited` is the altLabel of `pending`, and
its `removed` is not a concept). `ContactTypeScheme` holds the four values of Sutton's `ContactType` (decision 139).
The definitions of `marketing`, `sales`, `manufacturing` and `other` are readings of the value names: Sutton's own
descriptions of them are not in the repository and were not checked. Whether each Sutton value is written in the
case shown is what `readings.json` and the decisions write; Sutton's schema was not re-read.

## 6. Identity criteria against rule C16

C16, as step 7 built it, reads only a criterion's `restsOn`: each key must be a property of the vocabulary, and none
may carry a `designation`. The table holds every criterion of the module after step 12.

| Class | `restsOn` | Each a property of the vocabulary | Any with a designation |
| --- | --- | --- | --- |
| `SourceRecord` | `inTenant`, `sourceSystem`, `sourceType`, `sourceId` | yes | no |
| `Member` | `membershipIn` | yes | no |
| `IdentityDecision`, `ModelCall`, `PostalAddress`, `ContactPoint`, `ContactAssignment` | `inTenant` | yes | no |
| `IdentityEvidence` | `citesEvidence` | yes | no |
| `AgentRun`, `SignInAccount` | none | not applicable | no |
| `Organization`, `Person`, `Role`, `Grant`, `AuditEntry` (the thread's) | none, unchanged | not applicable | no |
| `Tenant` | inherited | not applicable | no |
| `Party` | none: a category | not applicable | no |

The six designated properties are `name`, `givenName`, `middleName`, `familyName` and `agentName` (name) and
`accountEmail` (email); no criterion names one. Report 04's CQ-I08 plant, `Organization`'s criterion written on
`name`, now fails on the real `name` once step 11 brings it. `contactValue` carries no designation: the metamodel's two
values are name and email, and a telephone number is neither (section 11).

## 7. The records the slice enrols and marks

| Record or field | Mark | Step |
| --- | --- | --- |
| `AgentRun` (`packages/kernel/src/AgentRun.schema.ts`) | enrolled as a record, `aboutClass("inv:AgentRun")` on its own annotations and no field naming the class (P4, decision 135) | 11 |
| `AgentRun.agent` | `aboutProperty("inv:agentName")` | 11 |
| `AgentRun.maxRole` | `aboutProperty("inv:maxRole")` | 11 |
| `Activity.agent` (`packages/kernel/src/Activity.schema.ts`), today `noTerm("deferred", "party")` | the path `recordedAgentRun` (node `AgentRun`), then `agentName` (decisions 98 and 135) | 11 |
| `Person.email` (`packages/access/contract/src/People/Person.read.ts`), today deferred | the path `memberAccount` (node `SignInAccount`), then `accountEmail` (decision 134) | 11 |
| `Person.joinedAt`, today deferred | `aboutProperty("inv:joinedAt")` (decision 100) | 11 |
| `Person.name`, today `noTerm("screen")` | the path `membershipOf` (node `Person`), then `name`, as `Member.name` (section 11) | 11 |
| `Member.name` (`packages/kernel/src/Member.schema.ts`), today `noTerm("screen")` | the path `membershipOf` (node `Person`), then `name` (decisions 93 and 133) | 11 |
| `Member.organizationName`, today `noTerm("screen")` | the path `membershipIn` (node `Tenant`), then `name` (decision 93) | 11 |
| `OrganizationChoice` (`packages/access/contract/src/Session/SessionState.read.ts`) | enrolled as a record of `inv:Tenant`; `id` names the class; `name` is `aboutProperty("inv:name")` | 11 |
| `ModelCallPurpose` (`packages/access/contract/src/Allowance/ModelAllowance.gateway.ts`) | enrolled as a scheme, `aboutScheme("inv:ModelCallPurposeScheme")` | 11 |
| `Membership` (`SessionState.read.ts`) | enrolled as `noTerm`, reason `screen` (decision 21, step 7) | 11 |

After step 11 no field defers to the party slice. Each path is one node step and one value step, which gate 5 and
the lift take. What the lift writes for the three paths whose node the record does not identify (through `Person`,
`Tenant` and `AgentRun`) and for `Person.email`'s account node is question 2; step 11's lifts wait on it, and gates 5
and 7 check the marks whatever the answer.

## 8. The gist names

| gist name | Kind | Its gist parent | Taken for | In `gist-categories.md` today | Step |
| --- | --- | --- | --- | --- | --- |
| `gist:Event` | class | none | `AgentRun`, `ModelCall`; ancestor of `gist:Determination` | yes, a row | 10 |
| `gist:Determination` | class | `gist:Event` | `IdentityDecision` | yes, a row | 10 |
| `gist:Address` | class | `gist:Content` | ancestor of the two address classes (decision 14) | named as their parent, no row of its own | 12 |
| `gist:PhysicalAddress` | class | `gist:Address` | `PostalAddress` | yes, in the Address row | 12 |
| `gist:ElectronicAddress` | class | `gist:Address` | `ContactPoint` | yes, in the Address row | 12 |
| `gist:isCategorizedBy` | relation, no domain, no range (decision 153) | none copied (decision 150) | every scheme-ranged property, `grantScope` first | yes, in the properties list | 9 |
| `gist:name` | attribute, no domain, no range (decision 153) | none copied (decision 150) | `name` | yes, in the properties list | 11 |

`SourceRecord`, `IdentityEvidence` and `SignInAccount` sit under `gist:Content`, and `ContactAssignment` under
`gist:Assignment`, both already on the list. Each step adds its names to `gist-categories.md` where the file lacks a
row (PLAN step 9), so step 12 gives `gist:Address` a row of its own.

**Disjoint pairs** (decision 15). Report 11 table D lists the pairs gist states between the classes the whole design
takes, table B's included. Of those, one pair has both sides among the names above and the thread's:
`gist:PhysicalAddress` with `gist:ElectronicAddress`, added in step 12. It keeps a postal address from being a contact
point. The thread's three pairs keep doing new work: `gist:Organization` with `gist:Content` refuses a `SourceRecord`,
an address, a contact point, a sign-in account or a piece of evidence typed an organization, which is gate 9's planted
fixture of step 13 (decision 34's reason); `gist:PhysicalIdentifiableItem` with `gist:Content` refuses the same typed
a person. What no pair catches: `gist:Event` is disjoint with none of the admitted classes (its pairs are with
`gist:Aspect`, `gist:Category`, `gist:Magnitude` and `gist:UnitOfMeasure`), so an identity decision, an agent run or a
model call typed a record or an organization passes; no pair between `inv:` classes is stated (decision 15). Whether
the pinned file states a pair report 11 does not list was not checked (the PLAN's row of what the design left
unchecked).

## 9. Sutton's slice-1 records, as answered

Decisions 130, 131, 133, 134, 136, 138, 139 and 142 answer SPEC's coverage table; this is the table with those
answers. "Later" names report 17's slice. A field the table puts under a question waits for it and gets nothing built.
A placement on a property is stated on `sutton-party.ttl` in step 12 unless a question's fixture states it.

| Sutton type | Field | Placed as |
| --- | --- | --- |
| `Company` | the record | the tenant's `SourceRecord`, `recordOf` a `Person` when `kind` is `individual` and an `Organization` when it is `company` (125) |
| `Company` | `id` | `sourceId` |
| `Company` | `kind` | chooses the class of `recordOf`'s object; no property |
| `Company` | `type` | `isCustomer` and `isVendor`, each true or false (34, 35, 89) |
| `Company` | `name` | `name`, on the record |
| `Company` | `status` | `accountStatus` (130) |
| `Company` | `addresses` | `hasPostalAddress` (138) |
| `Company` | `contacts` | no property: each listed contact's record states `contactAt` this record, the fact placed once from the contact's side |
| `Company` | `primaryContact` | `primaryContact` (139) |
| `Company` | `customFields`, `files` | later: slice 8 |
| `Company` | `logo`, `notes`, `website` | no term (142) |
| `Contact` | the record | the tenant's `SourceRecord`, `recordOf` a `Person` |
| `Contact` | `id` | `sourceId` |
| `Contact` | `fullName` | `name`, on the record |
| `Contact` | `firstName`, `lastName` | `givenName`, `familyName`, on the record |
| `Contact` | `jobTitle` | `jobTitle`, on the record |
| `Contact` | `email`, `phone` | `hasContactPoint` to a `ContactPoint` with `contactValue` and `contactPointKind` `email` or `phone` |
| `Contact` | `phoneExt` | `extension` on the phone's `ContactPoint` |
| `Contact` | `addresses` | `hasPostalAddress` on the contact's record, read as the contact's (126) |
| `Contact` | `company` | `contactAt` (139) |
| `Contact` | `type` | `contactType` (139) |
| `Contact` | `owners` | `contactOwner`, one per owner (139) |
| `Contact` | `customFields` | later: slice 8 |
| `Contact` | `notes`, `dateCreated` | no term (142) |
| `Address` | the record | `PostalAddress`, reached by `hasPostalAddress` from its company's or contact's record (138) |
| `Address` | `id` | the address's own id within the tenant (its criterion) |
| `Address` | `title` | `name` |
| `Address` | `addressLineOne`, `addressLineTwo` | `addressLines`, in that order |
| `Address` | `city`, `state`, `zip` | `locality`, `region`, `postalCode` |
| `Address` | `country` | `countryCode`, once a person accepts the code read from the free text; until then nothing (138) |
| `Address` | `type` | `addressPurpose`, one per value (126) |
| `Address` | the four `is*Default` flags | `defaultFor`, one per flag that is true |
| `Address` | `customerPaymentTerm`, `vendorPaymentTerm` | later: slice 2 |
| `Address` | `customFields` | later: slice 8 |
| `Organization` | the record | a `SourceRecord` whose `recordOf` is the tenant's `Organization`, `inTenant` this repository's tenant (P1) |
| `Organization` | `id` | `sourceId` |
| `Organization` | `name` | `name`, on the record |
| `Organization` | `members` | no path: each listed member is a `Member` whose `membershipIn` is the record's tenant (133) |
| `Organization` | `defaultCurrency`, `defaultUom` | later: slice 2 |
| `Organization` | `addresses` | later: slice 4, as sites |
| `Organization` | `activeAccountingIntegration`, `hasAccountingIntegration`, `hasActiveAccountingIntegration`, `customFields`, `files` | later: slice 8 |
| `Organization` | `features`, `sidebarNavigationLayouts`, `accountType`, `billingStatus`, `status`, `portalCount`, `whitelabel`, `clerkOrganizationId`, `accessExpiresDate`, `domain`, `logo`, `replyToEmail`; `moduleSettings`, the prefixes, the alert and portal settings, `orderRequestInstructions`, `shippingPreventOverPicking` | no term (142; the second group written later as rules of the terms they govern, 128) |
| `OrganizationMember` | the record | `Member`, from the invitation (P2) |
| `OrganizationMember` | `id` | the membership's id within its tenant (`Member`'s criterion, section 3.2) |
| `OrganizationMember` | `user` | `memberAccount` (134) |
| `OrganizationMember` | `profile` | part of the `Member` (below) |
| `OrganizationMember` | `customFields` | later: slice 8 |
| `OrganizationMember` | `isOrgCreator`, `settings` | no term (142) |
| `UserProfile` | `status` | `membershipStatus` (P2, 137) |
| `UserProfile` | `email` | the path `memberAccount`, then `accountEmail` (134) |
| `UserProfile` | `fullName` | the path `membershipOf`, then `name`, stated on fixtures by hand (133) |
| `UserProfile` | `firstName`, `middleName`, `lastName` | the path `membershipOf`, then `givenName`, `middleName`, `familyName`, by hand (133) |
| `UserProfile` | `jobTitle` | `jobTitle`, on the `Member` |
| `UserProfile` | `role`, `assignedLocations`, `includesUnassignedLocations` | later: slice 4 (131) |
| `UserProfile` | `startDate`, `endDate` | no term until something reads them (136) |
| `UserProfile` | `customFields` | later: slice 8 |
| `UserProfile` | `heardAboutUs`, `firstLogin` | no term (142) |
| `UserProfile` | `id` | waits: question 9 |
| `UserProfile` | `personalEmail`, `phoneNumber`, `phoneNumberExt`, `personalPhoneNumber` | waits: question 7 |
| `UserProfile` | `image`, `about` | waits: question 8 |
| `User` | the record | `SignInAccount` (134) |
| `User` | `id` | the account's id (its criterion) |
| `User` | `isDigitAdmin`, `username` | no term (142) |
| `CurrentUser`, `CurrentUserOrganization` | the records | views of the `SignInAccount` and the `Member`, no term of their own (131) |
| `CurrentUser` | `id`, `email` | the `SignInAccount`'s id and `accountEmail` |
| `CurrentUser` | `organizations` | the memberships, each a `Member` with `memberAccount` this account |
| `CurrentUser` | `canManageRoles`, `impersonatedBy`, `isDigitAdmin`, `username` | no term (142) |
| `CurrentUserOrganization` | `name` | as `Organization.name`: `name` on its record |
| `CurrentUserOrganization` | `status` | as `Organization.status`: no term |
| `CurrentUserOrganization` | `memberStatus` | as `UserProfile.status`: `membershipStatus` |
| `CurrentUserOrganization` | `id` | as `Organization.id`: `sourceId` |
| `CurrentUserOrganization` | `clerkOrganizationId` | no term (142) |

Enums: `CompanyKind` chooses a class and is no scheme; `CompanyType` is the two flags; `CompanyStatus` is
`AccountStatusScheme`; `ContactType` is `ContactTypeScheme`; `AddressType` is the widened `ContactPurposeScheme`;
`MemberStatus` is `MembershipStatusScheme`; `OrganizationAccountType`, `OrganizationBillingStatus`,
`OrganizationStatus` and `MslAlertFrequency` belong to fields with no term. The names of the four default flags and
`CurrentUserOrganization.id` are not in the repository (the SPEC's note on names read from Sutton's schema): the table
gives the flags by `readings.json`'s pattern and takes the view's `id` to be the workspace's, which was not checked.

## 10. The competency questions of the slice

Every query walks `rdf:type/rdfs:subClassOf*` and is asked with the generated OWL file beside its fixture (decision
27, step 5). Must-fail cases are the BRIEF's and report 04's; the SPEC's acceptance lists them.

| Question | What it asks | Terms it reads | Fixture | Step |
| --- | --- | --- | --- | --- |
| CQ-P01 | Which organizations does our tenant both buy from and sell to? | `SourceRecord`, `inTenant`, `recordOf`, `isCustomer`, `isVendor`, `Organization` (and `Party`, the range it walks from) | `test_ExampleWorks`, `test_SecondOrg` and their records, each stating its source keys | 9 |
| CQ-P02 | Which of our organizations hold no trading role at all? | `SourceRecord`, `inTenant`, `recordOf`, `Organization`, `isCustomer` and `isVendor` stated false | CQ-P01's tenants with records whose flags are false, and the open-reading record | 9 |
| CQ-P09, party half | Does any party record belong to no tenant, or to two? | `SourceRecord`, `inTenant` | records with no `inTenant` and with two | 9 |
| CQ-P04 | Which two source records a tenant holds were decided to be about one party, by whom, when, and on what evidence? | `IdentityDecision`, `inTenant`, `decidesOn`, `SourceRecord`, `identityOutcome`, `IdentityOutcomeScheme` (`sameParty`), `decidedBy`, `Member`, `eventTime`, `citesEvidence`, `IdentityEvidence`, `evidenceText` | report 04's `test_AcmeA` to `test_AcmeF`, `test_Decision1` to `test_Decision5`, `test_Dana`, `test_Kim` | 10 |
| CQ-P05 | Does any party, item or record stand in `owl:sameAs` with another? | no term: `owl:sameAs` itself, an ASK | CQ-P04's, and a fixture `.ttl` with the `owl:sameAs` triple | 10 |
| CQ-P06 | Who are the members of this organization and which role does each hold, with the person's name and the sign-in email? | the thread's (`Member`, `membershipIn`, `membershipOf`, `Grant`, `grantedTo`, `grantScope`, `grantsRole`) and `Person`, `name`, `memberAccount`, `SignInAccount`, `accountEmail` | the thread's, with the name and the email (question 2 says which are lifted and which written by hand) | 11 |
| CQ-P07 | Does every tenant keep at least one admin who is not removed? | `Tenant`, `Member`, `membershipIn`, `membershipStatus`, `MembershipStatusScheme` (`active`, decision 136), `Grant`, `grantedTo`, `grantsRole`, `MemberRoleScheme` (`admin`) | a tenant whose only admin is not active, a tenant with no members, and `test_FlourMill`, each member's stage stated | 11 |
| CQ-P11 | At which scope does each member hold which role? | `Grant`, `grantedTo`, `grantsRole`, `grantScope` | the thread's; rows unchanged | already built |
| CQ-P03 | Which people are contacts at an organization, for which purpose? | `ContactAssignment`, `contactPerson`, `Person`, `contactAccount`, `Party`, `servesPurpose`, `ContactPurposeScheme`, `assignmentPoint`, `ContactPoint`, `contactValue`, `inTenant` | a source that records a contact's purpose (decision 140): one person billing contact at one account and receiving contact at another, and an assignment with no purpose | 12 |

CQ-I08 is answered by gate 4 over the module (C16, section 6), not by SPARQL. CQ-P08 and CQ-P10 are not this slice's
(the brief). No question reads `capturedAt`, `joinedAt`, `maxRole`, `recordedAgentRun`, `agentName`, the model call's
three properties or the coverage's properties: each is shown by its mark or by its named fixture (section 4).

## 11. Choices in this report

The accepting decision covers each. Each is reversible by changing the entry before step 9 to 12 writes it.

- **Keys no source fixes**: `memberAccount` (decision 134's "a new property from `Member`"), `recordedAgentRun`
  (decision 135's "a new property from `AuditEntry`"), `addressPurpose` (decision 126's "a property for an address's
  purpose"), `contactAt` and `contactOwner` (decision 139's link and owner property; `readings.json` suggested
  `contactOwner`), and `extension`, `givenName`, `middleName`, `familyName` and `jobTitle` for Sutton fields decision
  130 gives a term. `primaryContact`, `contactType`, `ContactTypeScheme`, `accountStatus` and the rest are the
  decisions' or report 06's keys.
- **Labels and definitions** are report 06's and report 10's where those exist, with these edits: the flags say "the
  tenant's record of a party" and "true or false on every stored record" (decisions 35 and 125);
  `IdentityEvidence` and `citesEvidence` drop the suspicion, which is not a term of this slice; `SignInAccount` and
  `PostalAddress` are widened to Sutton's records; `SourceRecord`'s definition adds where the tenant's assertions sit
  (decision 34); `AccountStatusScheme` says "party" (decision 125); `agentName`'s example is the kernel schema's,
  "Assistant". The flags' prefLabels are report 06's ("is customer", "is vendor"), with report 10 section 4.8's words
  as altLabels.
- **`hasPostalAddress` and `hasContactPoint` keep report 06's keys** with the domain decision 138 gives,
  `SourceRecord`, not `Party`.
- **`contactAccount` ranges over `Party`**, not report 06's `Organization`, since an account of kind `individual` is a
  person (decisions 12 and 125).
- **`eventTime` declares no domain**: report 13 gives `gist:Event`, which the metamodel cannot name as a domain (a
  domain is a class of the vocabulary), and report 09 uses it on every event.
- **`capturedAt` comes with the three source keys** (the brief's "its four properties"), stated on CQ-P01's fixture.
- **`maxRole` is a term**, range `Role` as report 06 has it, because enrolling `AgentRun` needs a mark on each of its
  fields and the field states a fact of the run. That gate 5 accepts a field of role literals on a property whose
  range is the class `Role`, as the end of `Member.role`'s path does with `grantsRole`, is checked in step 11.
- **`Member`'s criterion for a Sutton member**: the membership's id as its source gives it, the two id spaces
  never compared, so a Sutton `OrganizationMember.id` is a membership id of its own (P2, decision 129's "its criterion
  for a Sutton member's id").
- **A criterion's basis holds the properties it reads, and its own stored id only in its sentence**: no
  `restsOn` names an id, since C16 refuses a key that is no property (question 5).
- **Designations**: `name`, `givenName`, `middleName`, `familyName` and `agentName` are names, `accountEmail` an email
  (PLAN step 7 left them to this report); `contactValue`, whose values are emails or telephone numbers, has none.
- **Names sit where the record states them**: a Sutton company's, contact's, workspace's and address's name, given
  and family names and job title on the tenant's record of it, as the flags are (decision 34); a member's name through
  the person (decision 133), and a member's job title on the `Member`, since it is said per organization.
- **`addressLines` is one literal**, the lines in order with one line break between, since two values of one property
  keep no order.
- **A contact point states its kind and extension**: `contactPointKind` with report 10's `ContactPointKindScheme`,
  which the brief had kept out and decision 130's "a term for each field" brings back, so `email` and `phone` stay
  apart; `extension` holds `phoneExt`.
- **`Company.contacts` gets no property of its own**: the contact's `contactAt` states the fact once, as decision 133
  places `Organization.members` from the member's side.
- **`Person.name` (the People page's) takes the path `Member.name` takes**: the brief names the kernel `Member`'s two
  names only, and the People page's copied name is the same fact.
- **Closed or open**: `MembershipStatusScheme` closed (P2 and 137 name every stage), `IdentityOutcomeScheme` and
  `ModelCallPurposeScheme` closed (report 10), `ContactPurposeScheme`, `ContactPointKindScheme` and
  `AccountStatusScheme` open (report 10), `ContactTypeScheme` open (a source other than Sutton may file contacts
  otherwise).
- **`MembershipStatusScheme`'s notations are Sutton's** (`pending`, not report 10's `invited`, which is its altLabel),
  and the scheme keeps report 10's key; the definitions of the concepts decisions 137 and 139 add are readings of the
  value names (section 5).

## 12. What this report does not decide

- The alignment rows, SSSOM and gate 12, including decision 126's purpose-to-`AddressType` row and the rows split by
  decision 125 (SPEC, Non-goals).
- SHACL: the flags' `sh:minCount 1` (decision 35), closures, cardinalities such as "two records per identity decision"
  and "at most one default address per purpose" (report 06's axiom plan), and which concepts a field admits (`sh:in`).
- Any disjointness gist does not state (decision 15), including report 06's pairs between `inv:` classes.
- How a Sutton record's IRI is made when Sutton data is lifted, how a Sutton member's id is kept apart from this app's
  `MemberId` in one tenant, and what `sourceSystem` holds for Sutton: no Sutton record is lifted in this slice, and the
  fixtures name their records.
- Whether this repository's removal (`member.removedAt`) is the stage `revoked`: the kernel's `Member` stores no stage,
  and CQ-P07's fixtures state it (decision 136).
- The flow by which a person accepts a country code (decision 138), and Sutton's roles, locations and grants (131).
- Which context's contract package holds a party record (decision 37: when the first record is built).

## 13. Questions for Benjamin

1. **Which decision number accepts this report?** Decision 129 says the terms name "that number". (a) A new heading,
   `### 154.`, written when you accept, each new term, `Member` and `Party`'s entry naming 154; (b) decision 129
   itself, whose heading exists. Recommended: (a), so the number names the text accepted and not the method chosen
   before it was written. Step 9 waits on it.
2. **What the lift writes for a path whose node the record does not identify.** Four marks of step 11 have one:
   `Member.name` and `Person.name` through `Person` (no record holds a human's id, decision 133), `Activity.agent`
   through `AgentRun` (stores no id, decision 135), `Member.organizationName` through `Tenant`, and `Person.email`
   through `SignInAccount` (the record holds no account id). As built, the lift names a path's node
   `<subject>/<field>`, which is right for `Grant` (its criterion is the member and the field) and wrong for the four:
   it would mint a person per membership (against decisions 94 and 133), a second tenant node, and an account per
   membership; and for a class that stores no id it refuses the whole record, so every `Activity` with an agent would
   fail to lift. (a) `Person` takes `storesId: false`, and the lift states nothing for a field whose path's node class
   stores no id or is not identified by the record, the record still lifting; the name and the email are written on
   CQ-P06's fixture by hand, as decision 133 has for the name; (b) as built: the lift refuses such a record; (c) the
   lift mints `<subject>/<field>` for every path. Recommended: (a). It also answers step 7's "an absent agent" and
   "refuse or state nothing". Step 11's lifts and CQ-P06's rows wait on it.
3. **`Person` with `storesId: false`** is a fact of an accepted term beyond its link. (a) It keeps 111 and the
   accepting decision lists it with the category parent; (b) `Person` names the accepting decision. Recommended: (a),
   as decision 129 treats a changed link. Only under question 2 (a).
4. **The account node under question 2 (c) or a later lift**: if the lift ever writes `Person.email`'s node, it is
   named after the membership, so one account in two tenants is two nodes, against `SignInAccount`'s criterion.
   Recommended: no account node until a record holds the account's id (question 2 (a)). Waits with question 2.
5. **A criterion's basis** (step 7, open). (a) `restsOn` stays optional and a criterion that states none passes C16,
   and a class's own id is said in the sentence only, as this report writes every criterion; (b) `restsOn` becomes
   required, with an explicit entry for the class's own stored id, valid only where `storesId` is true. Recommended:
   (a) for this slice, with (b) put again when a record first stores a criterion's whole basis. Every criterion of
   section 6 is written to pass under both, except that under (b) the classes whose basis is their own id need the
   new entry.
6. **The gist super-properties this report leaves out.** Report 11 puts `recordOf` under `gist:isAbout`,
   `hasPostalAddress` and `hasContactPoint` under `gist:hasAddress`, and `eventTime` under `gist:atDateTime`.
   Decision 16 allows each only where the property's domain and range fall under the gist property's, and those
   domains and ranges are not in the repository (report 11 says `gist:isAbout`'s domain is `gist:Content`, nothing of
   its range). (a) Leave the four with no gist super-property in this slice, and read the four gist properties from
   the pinned file before the slice that next touches them; (b) allow the download of the pinned file now (as step 6
   did) and add each link that C9 passes in its step. Recommended: (a); nothing in this slice reads a gist property.
7. **Where a member's own contact points hang** (`UserProfile.personalEmail`, `phoneNumber`, `phoneNumberExt`,
   `personalPhoneNumber`). Decision 138 hangs contact points from the tenant's record of a party, and a member has
   none. (a) `hasContactPoint` declares no domain, so a `Member` may hold one too; (b) a path through the person,
   written by hand as the name is; (c) later, with the members' roles in slice 4. Recommended: (a). Nothing is built
   for these four fields until it is answered.
8. **`UserProfile.image` and `about`.** Decision 130 gives each field a term; decision 142's list does not name these
   two. (a) No term, as `logo` and `notes` (142's reason: display data no question reads); (b) a property each.
   Recommended: (a).
9. **`UserProfile.id`.** Whether it equals `OrganizationMember.id` was seen on one empty trial workspace only (report
   17 section 8), and this goal reads no Sutton data. (a) It waits, unplaced, until a person checks it on Sutton
   records; (b) it is placed as the `Member`'s id now. Recommended: (a).

## 14. Not checked

- The pinned gist file was not opened: every gist name, parent and pair here is report 11's and `gist-categories.md`'s
  reading of it, and the kinds of `gist:isCategorizedBy` and `gist:name` are step 7's tests' (section 1).
- No term here was decoded with `Vocabulary`, run through gate 4 or projected: the counts of section 2, the C16 table
  of section 6 and the fit of each key to the metamodel's patterns (`ClassKey`, `PropertyKey`, `Notation`, a label of
  at most 80 characters, a definition of 12 to 400) were checked by reading. Steps 9 to 12 decode each.
- Sutton's schema was not re-read; its field and enum names are the SPEC's, report 16's, report 17's and
  `readings.json`'s, and the definitions of `marketing`, `sales`, `manufacturing` and `other` are readings.
- Nothing here was put to the foundational auditor (decision 107 made the audit advisory for the thread; no decision
  asks it of this slice).
