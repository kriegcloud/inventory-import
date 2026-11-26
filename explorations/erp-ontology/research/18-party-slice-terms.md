---
type: Research
title: The party slice's terms
description: The design of slice 1's terms for one accepting decision (129), revised to decisions 154 to 167 and after its second review - every new and changed class, property, scheme and concept with its text, tag, parents, identity criterion, basis and gist names, the evidence each property enters on and the PLAN step that adds it, the gist facts read from the pinned file, the Sutton coverage as answered, the questions each term serves, the choices this report makes, and the ten questions still open.
---

# The party slice's terms

This is step 8 of [goals/party-slice](../../../goals/party-slice/PLAN.md): the text of every term slice 1 adds to the
vocabulary module, or changes in it, written so that Benjamin can accept it as one decision (decision 129). Nothing
here is built. `packages/kernel/src/Terms.vocab.ts` and every file under `packages/ontology/generated/` are unchanged
by this report; steps 9 to 12 write the terms, each with the marks or the named fixtures that show its properties in
use. The decisions this report applies are 129 to 167 with the earlier ones they cite: 129 to 153 answered the goal's
open rows, and 154 to 167 answered the first draft's questions 2 to 16 and step 7's open points (section 13.2). Where
a source left a name or a wording open, this report chooses, and section 11 lists the choice so that the accepting
decision covers it. Section 11 also lists the modelling choices no decision rules but that a decision's words or the
metamodel leave to this report, such as `maxRole` entering as a term or `IdentityEvidence`'s basis, so that accepting
the report accepts them knowingly. Where no decision rules a point that a term rests on and the choice is a term-model
call, the point is a question in section 13.1 and nothing that depends on it is built.

## 1. What this rests on, and what was read

- The goal's [SPEC](../../../goals/party-slice/SPEC.md) and [PLAN](../../../goals/party-slice/PLAN.md), steps 1 to 7
  as built, and the answered decisions 129 to 167 in [DECISIONS.md](../DECISIONS.md), with 12, 16 to 18, 33 to 37,
  45, 89, 93, 94, 100, 101, 104, 124 to 126, 128, P1 and P2.
- Term text: [report 06](06-party-and-access-terms.md) (classes, properties, the axiom plan), [report
  04](04-requirements.md) (`SourceRecord`, its four properties, CQ-P01 to CQ-P11 and the drafted queries),
  [report 10](10-taxonomies.md) (sections 4.8, 4.9 and 4.29, the schemes and concepts), [report
  13](13-term-index.md) (the reconciled keys), [report 14](14-thin-thread.md) (the thread's terms and form) and
  [report 17](17-sutton-whole-model-plan.md) with `assets/sutton/readings.json` (Sutton's types, fields and enums,
  names only, decision 123). A Sutton enum value is written here only where report 16, report 17, `readings.json` or
  a decision names it.
- The metamodel as steps 1 and 7 built it: `packages/foundation/modeling/vocabulary/src/Model.schema.ts` (the nine kind
  tags, `categoryParents`, `storesId`, a stated criterion's `restsOn`, a property's `subPropertyOf`, `evidence` and
  `designation`, and the limits on keys, labels and definitions), gate 4's rules C1 to C16 in `Rules.rules.ts`, and
  gate 5's rules P1 to P15 in `packages/ontology/src/Pointers.rules.ts`.
- **gist facts are read from the pinned gist file**, release 14.1.0's `gistCore.ttl`, kept outside the repository,
  its sha256 equal to the project profile's (`0d8230f3…08b1`), read on 2026-11-26 with rdflib: each class's
  `rdfs:subClassOf` and `owl:equivalentClass` (a named parent inside an intersection counts as its parent), every
  `owl:disjointWith` stated on or at each class section 8 names, the file's `owl:AllDisjointClasses` and
  `owl:disjointUnionOf` (none touches those classes), and each gist property's type, `rdfs:domain`, `rdfs:range`,
  `rdfs:subPropertyOf` and sub-properties. Section 8 holds what was read. The first draft took these facts from
  `.agents/skills/_shared/gist-categories.md` and report 11; where the file says more, section 8 says so.
- No Sutton data was read (the goal's choice, PLAN "Choices made"). The pinned gist file is the one file outside the
  repository that was opened.

Notation as in report 14 section 2: `inv:` is `https://example.org/inventory-import/ontology/`, `gist:` is
`https://w3id.org/semanticarts/ns/ontology/gist/`, a key is the local name, labels and definitions are English. The
kind tag, the identity criterion and its basis, `storesId`, `designation` and `evidence` live in the module only and
reach no Turtle (decision 19).

## 2. The accepted set in one view

| | New | Changed |
| --- | --- | --- |
| Classes | 10: `Party`, `SourceRecord`, `IdentityDecision`, `IdentityEvidence`, `AgentRun`, `ModelCall`, `SignInAccount`, `PostalAddress`, `ContactPoint`, `ContactAssignment` | 3: `Member` (definition, criterion and basis: P2, 137, 154, 158), `Person` (category parent `Party`, decision 12, and `storesId: false`, decision 161), `Organization` (category parent `Party`, decision 12) |
| Object properties | 27 | 1: `grantScope` (under `gist:isCategorizedBy`, decision 17) |
| Datatype properties | 26 | none |
| Schemes | 7: `IdentityOutcomeScheme`, `MembershipStatusScheme`, `ModelCallPurposeScheme`, `ContactPurposeScheme`, `ContactPointKindScheme`, `ContactTypeScheme`, `AccountStatusScheme` | none |
| Concepts | 24 | none |
| gist list | 5 classes (`Event`, `Determination`, `Address`, `PhysicalAddress`, `ElectronicAddress`), 1 disjoint pair, 5 properties (`isCategorizedBy`, `isAbout`, `atDateTime`, `name`, `hasAddress`) | none |
| Exception list | 1 entry: `Party` | none |

After step 12 the module holds 17 classes, 62 properties (34 object, 28 datatype), 9 schemes and 28 concepts, against
the thread's 7, 9 (7 object, 2 datatype), 2 and 4. Its gist list holds 12 classes, 4 disjoint pairs and 5 properties,
against the thread's 7, 3 and none; 7 properties carry a designation, against none; the exception list holds 2
entries, `Role` and `Party`. Section 13.1's questions add or remove no term, so none of these counts moves: question 2
rewords one thread property, questions 5 and 8 may each add one gist link, questions 3 and 4 change placements and a
criterion's wording, question 6 narrows two definitions, question 10 may change `Party`'s `storesId`, and questions 7
and 9 change how the lift and guard 1 read terms already listed.

| Step | Classes | Object properties | Datatype properties | Schemes (concepts) | gist names |
| --- | --- | --- | --- | --- | --- |
| 9 | `Party`, `SourceRecord`; `Person` and `Organization` gain `Party`, `Person` `storesId: false` | `recordOf`; `grantScope`'s gist link | `sourceSystem`, `sourceType`, `sourceId`, `capturedAt`, `isCustomer`, `isVendor` | none | `isCategorizedBy`, `isAbout` |
| 10 | `IdentityDecision`, `IdentityEvidence` | `decidesOn`, `identityOutcome`, `decidedBy`, `citesEvidence` | `eventTime`, `evidenceText` | `IdentityOutcomeScheme` (2) | `Event`, `Determination`, `atDateTime` |
| 11 | `AgentRun`, `ModelCall`, `SignInAccount`; `Member` changed | `membershipStatus`, `memberAccount`, `recordedAgentRun`, `maxRole`, `callPurpose`, `calledFor` | `joinedAt`, `accountEmail`, `name`, `agentName`, `calledAt` | `MembershipStatusScheme` (4), `ModelCallPurposeScheme` (3) | `name` |
| 12 | `PostalAddress`, `ContactPoint`, `ContactAssignment` | `hasPostalAddress`, `addressPurpose`, `defaultFor`, `hasContactPoint`, `contactPointKind`, `contactPerson`, `contactAccount`, `assignmentPoint`, `servesPurpose`, `contactAt`, `contactType`, `contactOwner`, `primaryContact`, `accountStatus`, `membershipWorkspace`, `memberContactPoint` | `addressLines`, `locality`, `region`, `postalCode`, `countryCode`, `contactValue`, `extension`, `givenName`, `middleName`, `familyName`, `jobTitle`, `profileImage`, `profileText` | `ContactPurposeScheme` (7), `ContactPointKindScheme` (2), `ContactTypeScheme` (4), `AccountStatusScheme` (2) | `Address`, `PhysicalAddress`, `ElectronicAddress`, their pair, `hasAddress` |
| Sum | 10 new, 3 changed | 27 new, 1 changed | 26 new | 7 (24) | 5 classes, 1 pair, 5 properties |

A placement marked **(waits: question n)** rests on question n of section 13.1: it is written as this report proposes
it, and nothing that depends on it is built until that question is answered.

**Which decision each term names** (decision 129). Each new term, `Member` and `Party`'s exception entry name the
decision that accepts this report. `Person`, `Organization` and `grantScope` keep decision 111: their text does not
change, and the accepting decision lists their new links and `Person`'s `storesId: false` (section 3.3, decision
161). Whether the accepting decision is decision 129 itself or a new heading, `### 168.`, is question 1; this report
calls it "the accepting decision".

## 3. Classes

### 3.1 New classes

Every criterion below is stated with its basis (`restsOn`): the properties of the vocabulary it reads. A class's own
stored id is said in its sentence and is not a key of `restsOn`, which holds property keys only; a basis may be left
empty (decision 160). Section 6 checks each against rule C16 as step 7 built it. Every criterion that does not name
the system that issued its id holds this app's ids only: for `Member`, `SignInAccount` and `ContactAssignment`, which
decision 158 names, an id a source such as Sutton issued waits until that source's records are lifted and their IRIs
are decided (section 12). `SourceRecord`'s criterion names its system and is keyed by the source's own opaque id by
design (decision 34). `PostalAddress`'s is keyed by its id within the tenant, which in this slice only a Sutton
`Address` gives; whether 158's rule covers it is question 4.

| Key | Label | Definition | Tag | Parent | Category parents | Named gist ancestors | Identity criterion | Basis (`restsOn`) | `storesId` | Step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Party` | Party | An agent that is either a human being or an organized body, named so that the properties persons and organizations share have one range. | category | none, on the exception list (section 3.4) | none | none | none: a category supplies no criterion (decision 12, rule C7) | none | true, the default (waits: question 10) | 9 |
| `SourceRecord` | Source record | Content an external system or the tenant holds about one thing, named by its system, its record type and its opaque id, so that a later read of the same record is the same source record; the tenant's assertions about that thing, such as its customer and vendor flags, sit on it. | information | `gist:Content` | none | none | Stated: the tenant, the source system, the record's type and its opaque id, each kept as written (case, leading zeros, punctuation); equal ids in two systems or two tenants are two records (decision 34). | `inTenant`, `sourceSystem`, `sourceType`, `sourceId` | true | 9 |
| `IdentityDecision` | Identity decision | A determination by a member that two source records the tenant holds describe the same party, or different parties, resting on the evidence it cites. | event | `gist:Determination` | none | `gist:Event` | Stated: the tenant and the decision's own id. | `inTenant` | true | 10 |
| `IdentityEvidence` | Identity evidence | A statement of one observed likeness or difference between two source records the tenant holds, such as a shared tax number or names one letter apart, cited by an identity decision. | information | `gist:Content` | none | none | Stated: the tenant and the evidence's own id; one piece of evidence may be cited by more than one decision. | `inTenant` | true | 10 |
| `AgentRun` | Agent run | An event in which a software agent acts for one signed-in member, never above that member's role nor above its own role cap. | event | `gist:Event` | none | none | Stated: the request it runs in; never the agent's name, which many runs share (decision 160). | none | false (decision 135) | 11 |
| `ModelCall` | Model call | An event in which the app asks a language model one question for a tenant, taken from that tenant's daily allowance before it is asked. | event | `gist:Event` | none | none | Stated: the tenant and the call's id, the `modelCall` table's key. | `inTenant` | true | 11 |
| `SignInAccount` | Sign-in account | A credential record that lets one person sign in to an application, this one or a source such as Sutton, before any organization is chosen. | information | `gist:Content` | none | none | Stated: the UserId this application gives the account, never its email, which can change (decision 104); an account another system issued, such as a Sutton User, waits until that system's records are lifted (decision 158). | none | true | 11 |
| `PostalAddress` | Postal address | A physical address, written as lines, locality, region, postal code and country, that a tenant's record of a party gives for receiving or sending goods, documents or invoices. | information | `gist:PhysicalAddress` | none | `gist:Address`, `gist:Content` | Stated: its own record id within the tenant; equal text on two records is two addresses (decision 138). (waits: question 4) | `inTenant` | true | 12 |
| `ContactPoint` | Contact point | An electronic address, an email address or a telephone number, at which a party is reached. | information | `gist:ElectronicAddress` | none | `gist:Address`, `gist:Content` | Stated: the record that gives it and the field it is read from, so a contact's email is one point and its phone another, never its value alone (decision 159). | none | true: its IRI is made from that record and field, as the lift makes a `Grant`'s node (decision 159); how a lift of a path that ends in `contactValue` reaches that node is question 7, which no slice-1 step waits on | 12 |
| `ContactAssignment` | Contact assignment | A relationship naming one person to reach at one account for a stated purpose using a particular contact point. | relator | `gist:Assignment` | none | `gist:TemporalRelation` | Stated: the tenant and the assignment's own id within its tenant, never the person or the contact point alone (decisions 39 and 43); an id a source issued waits until that source's records are lifted (decision 158). | `inTenant` | true | 12 |

`Party` is never typed directly: a property whose range is `Party` takes a `Person` or an `Organization` (decision
12), found by the questions through `rdfs:subClassOf*` (decision 27). `ContactPoint`'s basis is empty because the
record that gives the point reaches it by `hasContactPoint` or `memberContactPoint`, which point from that record at
the point, and its field is no property; decision 160 lets the basis be empty, and the sentence says what identifies
the point. A `ContactAssignment` gives no point: `assignmentPoint` names one a record already gives, so two
assignments can name one point. In CQ-P03's fixture the giving record is the tenant's `SourceRecord` of the person,
`recordOf` that `Person`, stating `hasContactPoint` to the point both of its assignments name (section 10).

### 3.2 `Member`, changed (decisions P2, 137, 154 and 158)

| Field | Thread text (decision 111) | Text accepted here |
| --- | --- | --- |
| Definition | A relationship between one person and one tenant that lets the person act in the tenant's workspace from the day it is made until it is removed. | A relationship between one person and one tenant, made when the person is invited or added and kept after it is removed or revoked, that lets the person act in the tenant's workspace or, where it names one, in that source's workspace, until it is removed and, where it states a stage, while that stage is active. |
| Identity criterion | the MemberId within its tenant, kept after removal. It rests on Member.id and Member.organizationId. | the MemberId within its tenant, kept at every stage and after removal, revoked included; a membership that names a source's workspace is told apart by that link, and its own id in that source waits until the source's records are lifted (decision 158). |
| Basis (`restsOn`) | none stated | `membershipIn` |
| Tag, parent, `storesId` | relator, `gist:TemporalRelation`, true | unchanged |
| Ratification | 111 | the accepting decision |

The widening is breaking under decision 24: a pending invitee was not a member and now is, and a membership may now
let its person act in a source's workspace rather than this app's. Step 11's commit marks the release line "0.2.0:
the party slice" breaking and names `Member` and decision P2 (SPEC, Constraints), and decision 154, whose clause the
widened definition also carries. The definition enters whole in step 11; its clause "where it names one" has no
instance until step 12 brings `membershipWorkspace` and the first Sutton membership, on `sutton-party.ttl`. The thread's "until it is removed" and "kept after removal" are kept
beside the stages, not equated with `revoked`: this app's removal (`member.removedAt`) ends a membership that states no
stage, and whether it is the stage `revoked` is not decided (section 12). "Invited or added": this app makes a
membership when an admin adds a person by the email they signed up with, and invites nobody to a membership (the
access code's one `invited` is a value of `SignUpOffer`, who may make an account); Sutton makes one at the invitation
(P2). "Where it names one": a Sutton membership names its workspace by `membershipWorkspace` (section 4.1), and none
of this app's does (decision 154); CQ-P06 and CQ-P07 leave out a membership that names one. Whether the thread's
`membershipIn` keeps its text beside this definition is question 2. The new terms this report writes about acting
under a membership, `memberAccount` and the concepts `pending`, `active` and `suspended`, already say the workspace
the membership lets its person act in, not the tenant's, so question 2 does not reach them.

### 3.3 `Person`, `Organization` and `grantScope`: new links, decision 111 kept

| Term | New link or fact | Ruled by |
| --- | --- | --- |
| `Person` | category parent `Party`, beside its gist parent `gist:Person` | decision 12 |
| `Person` | `storesId: false`: no record holds a human's id, so the lift writes no person node, and a later path through the person that ends in a relation is refused | decisions 133 and 161 |
| `Organization` | category parent `Party`, beside its gist parent `gist:Organization` | decision 12 |
| `grantScope` | `rdfs:subPropertyOf gist:isCategorizedBy` | decisions 16, 17 and 153 |

No label, definition, tag, parent or criterion of the three changes. Step 9 rewrites the header of `Terms.vocab.ts`,
which says every term is decision 111's text, to say that the thread's terms keep 111 with these links and `Person`'s
`storesId`, and that the party slice's terms name the accepting decision.

### 3.4 `Party`'s exception entry

`packages/ontology/exceptions/no-gist-parent.json` gains one entry beside `Role`'s, in step 9:

| `class` | `reason` | `ratification` |
| --- | --- | --- |
| `Party` | gist 14.1.0 has no party class; Party gathers Person and Organization, which keep their gist parents, and supplies no identity. | the accepting decision |

The class's own `parent` is `{ kind: "none", reason }` with the same sentence, which rule C4 compares with the entry.
Decision 97 has each entry ratified by Benjamin; accepting this report ratifies it. Report 11 table F found no gist
class over `gist:Person` and `gist:Organization`, and the pinned file agrees: `gist:Organization` has no named parent,
and `gist:Person`'s chain is `gist:LivingThing`, then `gist:PhysicalIdentifiableItem` (section 8).

## 4. Properties

Columns: domain and range are the property's own (decision 16 copies none from gist). "Super" is the gist property
it sits under. "Evidence" is what shows it in use: a mark of an enrolled record, which needs no `evidence` field, or
`evidence: "fixture"` and the named `test_` fixture that states it (decision 130). A fixture named by its question
lives in `explorations/erp-ontology/assets/requirements/cq/` (decision 148); `model-call.ttl` and `sutton-party.ttl`
are the two fixtures of decision 130, read by guard 3 and gate 9 and by no question. Guard 3 reads a fixture only once
it is listed in `handWrittenFixtures` (`packages/ontology/test/support/fixtures.ts`), so each new fixture (CQ-P01,
CQ-P02, CQ-P09's, CQ-P04, CQ-P05's, `model-call.ttl`, CQ-P07's, CQ-P03, `sutton-party.ttl`) is added to that list in
the commit that brings it. One of guard 3's tests in `Questions.test.ts` reads CQ-P06's text alone and expects no
property unshown; from step 9 it would fail on the first property stated only in a packet fixture, so step 9 points
that test at `handWrittenFixtures` and keeps its plant (without CQ-P06's text, `membershipOf` is unshown).

### 4.1 Object properties

| Key | Label | Definition | Domain | Range | Super | Evidence | Step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `recordOf` | record of | Links a source record to the party it was captured about: a person, or an organization (decision 125). | `SourceRecord` | `Party` (decision 145) | `gist:isAbout` (decision 166) | fixture: CQ-P01, CQ-P02, CQ-P09 | 9 |
| `decidesOn` | decides on | Links an identity decision to one of the two source records it compares. | `IdentityDecision` | `SourceRecord` (decision 145) | none | fixture: CQ-P04 | 10 |
| `identityOutcome` | identity outcome | Links an identity decision to what it found: the two records denote one party, or two. | `IdentityDecision` | `IdentityOutcomeScheme` | `gist:isCategorizedBy` | fixture: CQ-P04 | 10 |
| `decidedBy` | decided by | Links an identity decision to the member who made it. | `IdentityDecision` | `Member` | none | fixture: CQ-P04 | 10 |
| `citesEvidence` | cites evidence | Links a decision to a piece of evidence it rests on. | none declared (kept broad, report 06) | `IdentityEvidence` | none | fixture: CQ-P04 | 10 |
| `membershipStatus` | membership status | Links a membership to the stage it stands at: pending, active, suspended or revoked (decisions P2 and 137). | `Member` | `MembershipStatusScheme` | `gist:isCategorizedBy` | fixture: CQ-P07 (decision 136); `sutton-party.ttl` (`UserProfile.status`) | 11 |
| `memberAccount` | member account | Links a membership to the sign-in account its person signs in with to act under that membership (decision 134). | `Member` | `SignInAccount` | none | mark: `Person.email`'s path, its node step | 11 |
| `recordedAgentRun` | recorded agent run | Links an audit entry to the agent run that made the change for the member it names, when an agent did (decision 135). | `AuditEntry` | `AgentRun` | none | mark: `Activity.agent`'s path, its node step | 11 |
| `maxRole` | max role | Links an agent run to the highest role it may act with, whatever the role of the member it acts for. | `AgentRun` | `Role` | none | mark: `AgentRun.maxRole` | 11 |
| `callPurpose` | call purpose | Links a model call to what it is for: reading a table request, checking the key, or suggesting fixes for an import. | `ModelCall` | `ModelCallPurposeScheme` | `gist:isCategorizedBy` | fixture: `model-call.ttl` | 11 |
| `calledFor` | called for | Links a model call to the member whose action asked for it. | `ModelCall` | `Member` | none | fixture: `model-call.ttl` | 11 |
| `hasPostalAddress` | has postal address | Links the tenant's record of a party to a postal address that record gives (decision 138). | `SourceRecord` | `PostalAddress` | `gist:hasAddress` (decision 166) | fixture: `sutton-party.ttl` | 12 |
| `addressPurpose` | address purpose | Links a postal address to a purpose its record types it for, such as billing, shipping or ship from; one address may have several (decision 126). | `PostalAddress` | `ContactPurposeScheme` | `gist:isCategorizedBy` | fixture: `sutton-party.ttl` | 12 |
| `defaultFor` | default for | Links a postal address to a purpose for which it is the one used when an order names no other. | `PostalAddress` | `ContactPurposeScheme` | none (waits: question 8) | fixture: `sutton-party.ttl` | 12 |
| `hasContactPoint` | has contact point | Links the tenant's record of a party to an email address or telephone number that record gives (decision 138). | `SourceRecord` | `ContactPoint` | `gist:hasAddress` (decision 166) | fixture: CQ-P03 (the person's record gives the point); `sutton-party.ttl` | 12 |
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
| `membershipWorkspace` | membership workspace | Links a membership to the source's record of the workspace it lets its person act in, stated only where that workspace is another system's, such as a Sutton organization's (decision 154). | `Member` | `SourceRecord` | none | fixture: `sutton-party.ttl`; CQ-P06's and CQ-P07's must-fail memberships (section 10) | 12 |
| `memberContactPoint` | member contact point | Links a membership to an email address or telephone number that its profile in the tenant gives for its person, such as a personal email or phone (decision 162). | `Member` | `ContactPoint` | none (waits: question 5) | fixture: `sutton-party.ttl` | 12 |

Every property whose range is a scheme but `defaultFor` sits under `gist:isCategorizedBy` (decision 17); whether
`defaultFor` is a classification property in decision 17's sense is question 8. C9 passes each, since
`gist:isCategorizedBy` declares no domain and no range (decision 153). The three other gist links pass C9 as the pinned
file states their gist properties (section 8, decision 166): `gist:isAbout` declares the domain `gist:Content`, which
`SourceRecord` reaches through its gist parent, and no range; `gist:hasAddress` declares no domain and the range
`gist:Address`, which `PostalAddress` reaches through `gist:PhysicalAddress` and `ContactPoint` through
`gist:ElectronicAddress`. As in the thread, the OWL file writes no `rdfs:range` for a scheme range.

### 4.2 Datatype properties

| Key | Label | Definition | Domain | Datatype | Super | Designation | Evidence | Step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sourceSystem` | source system | The external system a source record was read from, as written. | `SourceRecord` | `xsd:string` | none | none | fixture: CQ-P01 | 9 |
| `sourceType` | source type | The record type the external system gives a source record, as written. | `SourceRecord` | `xsd:string` | none | none | fixture: CQ-P01 | 9 |
| `sourceId` | source id | The opaque id the external system gives a source record, kept exactly as written. | `SourceRecord` | `xsd:string` | none | none | fixture: CQ-P01 | 9 |
| `capturedAt` | captured at | The instant a source record was last read from its system: one value, which each later read of the same record replaces (decision 156). | `SourceRecord` | `xsd:dateTime` | none | none | fixture: CQ-P01 | 9 |
| `isCustomer` | is customer (altLabels Customer, Client, Buyer) | Whether the tenant's record of a party states that the party buys from the tenant, true or false on every stored record of a trading account, such as a Sutton company's (decisions 34 and 35). (waits: question 6) | `SourceRecord` | `xsd:boolean` | none | none | fixture: CQ-P01, CQ-P02 | 9 |
| `isVendor` | is vendor (altLabels Vendor, Supplier) | Whether the tenant's record of a party states that the party sells to the tenant, true or false on every stored record of a trading account, such as a Sutton company's (decisions 34 and 35). (waits: question 6) | `SourceRecord` | `xsd:boolean` | none | none | fixture: CQ-P01, CQ-P02 | 9 |
| `eventTime` | event time | The instant at which an event occurred, as its record states it. | none declared | `xsd:dateTime` | `gist:atDateTime` (decision 166) | none | fixture: CQ-P04 | 10 |
| `evidenceText` | evidence text | The evidence in a sentence a person reads, naming the two values compared. | `IdentityEvidence` | `xsd:string` | none | none | fixture: CQ-P04 | 10 |
| `joinedAt` | joined at | When the person could first act in the membership, as its record states it: for this app's members the moment an admin added them, for an invitee the moment the invitation was accepted. | `Member` | `xsd:dateTime` | none | none | mark: `Person.joinedAt` | 11 |
| `accountEmail` | account email | The email a sign-in account signs in with, compared whatever its case. | `SignInAccount` | `xsd:string` | none | email | mark: `Person.email`'s path, its value step | 11 |
| `name` | name | The name people read for a party, a record or a place, which is never unique and never decides identity or permission. | none declared | `xsd:string` | `gist:name` (decisions 132 and 153) | name | marks: `Member.name` and `Member.organizationName` (each a path's value step), `OrganizationChoice.name`, `Person.name` (section 7) | 11 |
| `agentName` | agent name | The agent's name as people read it in the activity list, such as "Assistant". | `AgentRun` | `xsd:string` | none | name | marks: `AgentRun.agent`; `Activity.agent`'s path, its value step | 11 |
| `calledAt` | called at | When a model call was taken from the tenant's daily allowance. | `ModelCall` | `xsd:dateTime` | none | none | fixture: `model-call.ttl` | 11 |
| `addressLines` | address lines | The street lines of a postal address, in order and as written, one line break between two lines. | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `locality` | locality | The town or city of a postal address, as written. | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `region` | region | The state, province or other region of a postal address, as written. | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `postalCode` | postal code | The postal code of a postal address, kept as text so leading zeros survive. | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `countryCode` | country code | The country of a postal address as a two-letter ISO 3166 code, stated only once a person accepts the code read from the source's own text (decision 138). | `PostalAddress` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `contactValue` | contact value | The text of an email address or telephone number, as written in the source. | `ContactPoint` | `xsd:string` | none | email | fixture: CQ-P03; `sutton-party.ttl` | 12 |
| `extension` | extension | The extension to dial after a telephone number, as written in the source. | `ContactPoint` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `givenName` | given name | A person's given name as a record writes it. | none declared | `xsd:string` | none | name | fixture: `sutton-party.ttl` | 12 |
| `middleName` | middle name | A person's middle name as a record writes it. | none declared | `xsd:string` | none | name | fixture: `sutton-party.ttl` | 12 |
| `familyName` | family name | A person's family name as a record writes it. | none declared | `xsd:string` | none | name | fixture: `sutton-party.ttl` | 12 |
| `jobTitle` | job title | The title of a person's job at the organization a record names, as written. | none declared | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `profileImage` | profile image | The picture the profile of a membership shows for its person, as the source gives it, such as a link to an image file (decision 163). | `Member` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |
| `profileText` | profile text (altLabel About) | The text a person writes about themselves on the profile of one membership, as written in the source (decision 163). | `Member` | `xsd:string` | none | none | fixture: `sutton-party.ttl` | 12 |

Two datatype properties sit under a gist property. `name` passes C9, since `gist:name` declares no domain and no
range (decision 153); `eventTime` passes it, since `gist:atDateTime` declares no domain and the range `xsd:dateTime`,
which is `eventTime`'s datatype (section 8, decision 166).

### 4.3 What is not a term of this slice

`accountOf` and the route `membershipOf/^accountOf/accountEmail` (decision 134); `hasMember` (`^membershipIn`, decision
133); `removedAt` (decision 136); `actsFor`, which no enrolled record fills (`AgentRun` holds `agent` and `maxRole`
only) and no slice-1 question reads; `Permission`, `permits` and `includesRole` (decision 141; the brief);
`PartyIdentifier`, `citesIdentifier`, `SuspectedDuplicate`, `suspects`, `resolves`, `evidenceKind` and
`EvidenceKindScheme`, `PortalAccess` and its properties (decision 44), `isCarrier` and `isContractManufacturer`
(decision 89), a `PartyRole` scheme (decisions 3, 34 and 47), report 05's alignment schemas (decision 143), and a
designation for a SKU (decision 165). Report 06's `supersedes` is left out too: it is "not yet placed", its domain
needs a class over both kinds of record it links (an identity decision, a later slice's cost observation), and no
decision rules that a later identity decision replaces an earlier one. CQ-P04 reads the decision in force as the
latest of the tenant's about a pair by `eventTime`, as report 04's sketch does (section 10), and states nothing about
the earlier one.

## 5. Schemes and concepts

A concept's IRI is `inv:<SchemeKey>-<notation>` (decision 10), and its notation is the literal a record stores
(report 10 rule 2). No scheme or concept is typed by gist (decision 17). Each scheme and concept names the accepting
decision.

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
| `MembershipStatusScheme` | `pending` | Pending | Invited | A membership status in which the person was invited and has not yet accepted, and cannot yet act under the membership. |
| `MembershipStatusScheme` | `active` | Active | none | A membership status in which the person may act in the workspace the membership lets them act in. |
| `MembershipStatusScheme` | `suspended` | Suspended | none | A membership status in which the person may not act in the workspace the membership lets them act in, the history kept, and from which the membership can be made active again. |
| `MembershipStatusScheme` | `revoked` | Revoked | none | A membership status in which the membership no longer lets, or will never let, the person act and is not made active again, its row kept so the audit trail still names it. |
| `ModelCallPurposeScheme` | `view` | Table request | none | A model call purpose in which the table assistant reads a request in words. |
| `ModelCallPurposeScheme` | `check` | Key check | none | A model call purpose in which the app checks that the model key works. |
| `ModelCallPurposeScheme` | `suggest` | Import suggestions | none | A model call purpose in which the app asks for proposals for the rows of an import. |
| `ContactPurposeScheme` | `billing` | Billing | Bill-to | A contact purpose for which invoices and payment questions are sent to the contact point or the address. |
| `ContactPurposeScheme` | `shipping` | Shipping | Ship-to | A contact purpose for which goods sent to the party are delivered to the address, or arranged with the person reached for it. |
| `ContactPurposeScheme` | `receiving` | Receiving | Receiving dock | A contact purpose for goods arriving at the party's site: the address where they are taken in, or the person who takes them in. |
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
`ModelCallPurposeScheme`'s notations are the three values of the `ModelCallPurpose` literal
(`packages/access/contract/src/Allowance/ModelAllowance.gateway.ts`), which P8 compares when step 11 marks it.
The definitions of `marketing`, `sales`, `manufacturing` and `other` are readings of the value names: Sutton's own
descriptions of them are not in the repository and were not checked. So is the definition of `revoked`:
`readings.json` notes that Sutton's `revoked` "may be a withdrawn invitation rather than removed (not checked)", so
the definition is worded to hold for both, a membership that no longer lets the person act and an invitation that
never will; report 10's `removed`, a different value, is not followed. `suspended` names what the stage withholds,
acting in the membership's workspace, not sign-in, which belongs to the `SignInAccount`. `pending`, `active` and
`suspended` say the workspace the membership lets its person act in, as `Member`'s definition does under decision 154,
since a Sutton membership's tenant is this repository's while its workspace is Sutton's. `shipping` and `receiving` name
an address or a person, since a contact point is an email address or a telephone number where no goods arrive
(report 10 section 4.9: these are categories of a contact assignment or an address, not of a contact point). Whether
each Sutton value is written in the case shown is what `readings.json` and the decisions write; Sutton's schema was
not re-read.

## 6. The terms against gates 4 and 5

### 6.1 Identity criteria against rule C16

C16, as step 7 built it, reads only a criterion's `restsOn`: each key must be a property of the vocabulary, and none
may carry a `designation`. A criterion that states no basis passes (decision 160). The table holds every criterion of
the module after step 12.

| Class | `restsOn` | Each a property of the vocabulary | Any with a designation |
| --- | --- | --- | --- |
| `SourceRecord` | `inTenant`, `sourceSystem`, `sourceType`, `sourceId` | yes | no |
| `Member` | `membershipIn` | yes | no |
| `IdentityDecision`, `IdentityEvidence`, `ModelCall`, `PostalAddress`, `ContactAssignment` | `inTenant` | yes | no |
| `ContactPoint`, `AgentRun`, `SignInAccount` | none | not applicable | no |
| `Organization`, `Person`, `Role`, `Grant`, `AuditEntry` (the thread's) | none, unchanged | not applicable | no |
| `Tenant` | inherited | not applicable | no |
| `Party` | none: a category | not applicable | no |

The rule applied: a basis is written for the criteria this report writes, the new classes' and `Member`'s, and the
thread's criteria keep decision 111's text and no basis, since their entries do not change (decision 129). So
`AuditEntry`, whose sentence is "the tenant and the entry's id", and `Grant`, whose sentence reads `grantedTo`, state
none, though a new class with the same sentence states `inTenant`; the CQ-I08 near miss in `Coherence.test.ts` writes
both, which is a plant, not their entries.

The seven designated properties are `name`, `givenName`, `middleName`, `familyName` and `agentName` (name) and
`accountEmail` and `contactValue` (email). No basis names one, and no criterion's sentence rests on one: `AgentRun`'s
first draft named "the agent that acts", whom only `agentName` states, and decision 160 restates it as the request it
runs in, "never the agent's name". Report 04's CQ-I08 plant, `Organization`'s criterion written on `name`, now fails
on the real `name` once step 11 brings it. `contactValue` is designated email because its values include email
addresses, which decision 146 has C16 refuse as a basis (report 06: "the email text alone is not its identity");
the designation also refuses a criterion on a telephone number, which nothing asks for. A C16 finding on
`contactValue` says its values are "an email address" (the message in `Rules.rules.ts`), which misnames the telephone
half; the metamodel has only the two values, and the choice is kept (section 11). No designation names a SKU
in this slice (decision 165).

### 6.2 The other rules of gate 4, read against the terms

Checked by reading the terms of sections 3 to 5 and 8 against `Rules.rules.ts` as built; nothing was decoded or run
(section 14).

| Rule | What it asks | After step 12 |
| --- | --- | --- |
| C1 | a key names one term across classes, properties and schemes | holds: the 17 class keys, 62 property keys and 9 scheme keys are distinct (a script over this report's tables and the thread's literal) |
| C3 | a gist parent is on the gist list, a local and a category parent are classes, no cycle | holds: the gist parents (`Content`, `Determination`, `Event`, `PhysicalAddress`, `ElectronicAddress`, `Assignment`, `TemporalRelation`, `Person`, `Organization`) are on the list; `Party` is a class; no chain returns |
| C4 | the parentless classes are the exception list's, with the same reason | holds: `Role` and `Party`, each with its entry (section 3.4) |
| C5 | the gist list is closed upward | holds: `Determination` under `Event`, `Address` under `Content`, the two address classes under `Address`, all on the list (section 8) |
| C6 | each pair names two classes on the list, no pair twice | holds: four pairs, the new one `PhysicalAddress` with `ElectronicAddress` |
| C7 | criterion agrees with tag | holds: `Party` (category) states none; the information, event and relator classes each state one |
| C8 | domains and ranges are terms of the vocabulary | holds: every domain is a class, every class range a class and every scheme range a scheme of sections 3 and 5 or the thread |
| C9 | a property's domain and range fall under its gist property's | holds for all fourteen gist links (nine under `gist:isCategorizedBy`, two under `gist:hasAddress`, one each under `gist:isAbout`, `gist:atDateTime` and `gist:name`; one more under question 5's (a) and one more under question 8's (b)) (sections 4.1 and 4.2); each gist property's declared domain or class range, `gist:Content` and `gist:Address`, is on the list in the step that brings the property |
| C10 | each scheme has a concept; `alsoInstanceOf` names a class | holds: every scheme has one to seven concepts (the thread's `GrantScopeKindScheme` one, decision 96; each new scheme two to seven); none is also an individual |
| C11 | a `role` class has a local parent | holds: no new class is tagged role |
| C12 | every term and exception entry names a decision with a heading | holds once the accepting decision's heading exists (question 1); concepts name it too |
| C13 | the version is `0.y.0` | holds at `0.2.0` (decision 144) |
| C14 | a category parent is tagged category; a category is no class's one parent | holds: `Party` is tagged category and is the one parent of nothing |
| C15 | retirements | not reached: nothing is retired |
| C16 | basis keys are undesignated properties | holds (section 6.1) |

Label and definition lengths were measured by a script over this report's tables (2026-11-26, again after the second
review's rewording): every label is 1 to 80 characters and every definition, criterion and reason 12 to 400 (`Label` and
`Definition` in `Model.schema.ts`); the longest is `Member`'s new definition, 312 characters. Every class key fits
`ClassKey`, every property key `PropertyKey`, every scheme key `SchemeKey` and every notation `Notation` (`ship_from`
included: the pattern admits an underscore).

### 6.3 Gate 5 on step 11's marks, as built

| Rule | Mark | Reading |
| --- | --- | --- |
| P2 | `AgentRun`, `OrganizationChoice`, `ModelCallPurpose`, `Membership` | each names its class, its scheme or `noTerm` on its own annotations (section 7) |
| P4 | `AgentRun` (`storesId: false`) | the record names its class on its own annotations and no field names it (decisions 135 and 167) |
| P7 | the five paths | one node step each; the node side of each step is exactly its node's class (`membershipOf`'s range `Person`, `membershipIn`'s `Tenant`, `memberAccount`'s `SignInAccount`, `recordedAgentRun`'s `AgentRun`) and the parent side the record's class (`Member`, or `AuditEntry` for `Activity`); each value step's domain is the node's class or undeclared (`name`). P7 does not refuse a node of a class that stores no id; the lift's rule is decision 155's |
| P8 | `ModelCallPurpose` | its three literals are the scheme's three notations |
| P11 | every new property | a mark (section 7) or `evidence: "fixture"` with the fixture of section 4 |
| P15 | `Membership` | `noTerm`, reason `screen`, and no field carries a mark |

That gate 5 accepts `AgentRun.maxRole`, a field of role literals, on a property whose range is the class `Role`, as
the end of `Member.role`'s path does with `grantsRole`, is checked in step 11. So is the reuse decision 161 has gate 5
accept (section 7).

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

After step 11 no field defers to the party slice. Each path is one node step and one value step, which gate 5 takes,
and all five end in an attribute (`name`, `accountEmail`, `agentName`). What the lift writes for them is decided, and
step 11 builds it:

- **`Member.name`, `Person.name`, `Person.email` and `Activity.agent`: nothing** (decision 155). For a field whose
  path ends in an attribute the lift states nothing, an absent value included, and the record still lifts; the rule
  reads only the last step's property kind in the vocabulary, so no class needs a new fact for it. The values are
  written on fixtures by hand: a member's name on its person (decision 133), the sign-in email on its account
  (decision 134), an agent's name on its run (decision 135). No person, account or run node is minted: the record
  holds no human's id (133), no account id, and `AgentRun` stores no id (135). No account node is written until a
  record holds the account's id (155, the first draft's question 4). This also settles step 7's "an absent agent" and
  "refuse or state nothing" for these marks.
- **`Member.organizationName`: the tenant's name, on the tenant's node** (decision 161). The kernel `Member`'s
  `organizationId` is marked `aboutProperty("inv:membershipIn")`, the property of this path's node step, so the path
  takes that field's object, the tenant's IRI, as its node, and the lift writes `name` there: the same value from every
  member record of that tenant. Gate 5 accepts the reuse. The lift writes no `rdf:type` on a node it reuses: it types
  the subject and each node a path creates, and the tenant's type stays the fixture's to state (the header of
  `packages/ontology/src/Lift.ts`), so the thread's hand-written `inv:Tenant` types stay its own. This is the one path
  of slice 1's marks that decision 155's rule does not cover, as the first draft's question 2 recommended it, "with the
  tenant's path as question 10 settles" (the first draft's question 10, which 161 answers). A second case, a contact
  point's path that ends in `contactValue`, is question 7; no slice-1 record reaches it.
- **Guard 1 against decisions 155 and 161** (waits: question 9). Once step 11 lifts the thread's rows, which carry
  `organizationName`, the lifted part holds `inv:name` on each tenant's node, and guard 1 (`overreach` in
  `packages/ontology/src/Fixture.rules.ts`) flags every hand-written triple whose predicate is a lifted triple's,
  whatever its subject. The person's name that decision 155 has CQ-P06's fixture state by hand is such a triple, and
  guard 1's test in `Questions.test.ts` expects none.
- **`Grant`'s path**, which ends in a relation, is lifted as today, its node `<subject>/<field>`.
- **The lift's refusals of step 7 stay.** The refusal of a record whose class stores no id is reached by `AgentRun`'s
  enrolment in step 11, as decision 135 intends ("a lift that refuses to write a run's node"): the lift refuses an
  `AgentRun` record, and a run's values are stated on fixtures by hand. The refusals of such a class as the node of a
  path that ends in a relation, or as a link's object, are reached by no slice-1 mark; `Person`'s `storesId: false`
  (161) makes a later path through the person that ends in a relation one of them. A link whose range is `Party` is
  refused only if `Party` itself stores no id, since the lift reads the range class alone: question 10.

`OrganizationChoice.name` is no path: the record is the tenant's own, and its name is a field's own property, lifted
as one.

## 8. The gist names

Read from the pinned file (section 1). "Parent" is the named class the file puts each class under, by
`rdfs:subClassOf` or inside the intersection of its `owl:equivalentClass`; "Disjoint with" is every class the file
states `owl:disjointWith` on, or at, that class; the file's `owl:AllDisjointClasses` and `owl:disjointUnionOf` touch
none of them.

| gist class | Parent in the pinned file | Disjoint with, in the pinned file | Taken for | In `gist-categories.md` today | Step |
| --- | --- | --- | --- | --- | --- |
| `gist:Event` | none | `Aspect`, `Category`, `Language`, `Magnitude`, `TimeInterval`, `UnitOfMeasure` | `AgentRun`, `ModelCall`; ancestor of `gist:Determination` | yes, a row | 10 |
| `gist:Determination` | `gist:Event` (`rdfs:subClassOf`) | none of its own | `IdentityDecision` | yes, a row | 10 |
| `gist:Content` | none | `GeoPoint`, `GeoRegion`, `Organization`, `PhysicalIdentifiableItem`, `PhysicalSubstance`, `UnitOfMeasure` | `SourceRecord`, `IdentityEvidence`, `SignInAccount`; ancestor of `gist:Address`; the thread's `AuditEntry` | yes (the thread's) | thread |
| `gist:Address` | `gist:Content` (`rdfs:subClassOf`) | none of its own | ancestor of the two address classes (decision 14) | named as their parent, no row of its own | 12 |
| `gist:PhysicalAddress` | `gist:Address` (`rdfs:subClassOf`; also equivalent to an address that `gist:refersTo` some `gist:GeoLocation`) | `ElectronicAddress` | `PostalAddress` | yes, in the Address row | 12 |
| `gist:ElectronicAddress` | `gist:Address` (`rdfs:subClassOf`) | `PhysicalAddress` | `ContactPoint` | yes, in the Address row | 12 |
| `gist:Organization` | none | `Content`, `GeoPoint`, `GeoRegion`, `IntellectualProperty`, `Intention`, `Language`, `Magnitude`, `PhysicalIdentifiableItem`, `PhysicalSubstance`, `SchemaMetaData`, `UnitOfMeasure` | `Organization` (the thread's) | yes | thread |
| `gist:Person` | `gist:LivingThing` (in its equivalent class) | none of its own | `Person` (the thread's) | yes | thread |
| `gist:LivingThing` | `gist:PhysicalIdentifiableItem` (in its equivalent class) | none of its own | ancestor of `gist:Person` | yes | thread |
| `gist:PhysicalIdentifiableItem` | none | `Content`, `GeoPoint`, `GeoRegion`, `IntellectualProperty`, `Intention`, `Language`, `Magnitude`, `Organization`, `SchemaMetaData`, `UnitOfMeasure` | ancestor of `gist:Person` | yes | thread |
| `gist:TemporalRelation` | none (restrictions only) | none | `Member`; ancestor of `gist:Assignment` | yes | thread |
| `gist:Assignment` | `gist:TemporalRelation` (in its equivalent class) | none | `Grant`, `ContactAssignment` | yes | thread |

| gist property | Kind in the pinned file | Domain | Range | Its own gist parent | Taken for | Step |
| --- | --- | --- | --- | --- | --- | --- |
| `gist:isCategorizedBy` | `owl:ObjectProperty` | none | none (only `gist:rangeIncludes gist:Category`, a hint, decision 153) | none | every scheme-ranged property but `defaultFor` (question 8), `grantScope` first | 9 |
| `gist:isAbout` | `owl:ObjectProperty` | `gist:Content` | none | none | `recordOf` | 9 |
| `gist:atDateTime` | `owl:DatatypeProperty` | none | `xsd:dateTime` | none (it has three sub-properties: `endDateTime`, `isRecordedAt`, `startDateTime`) | `eventTime` | 10 |
| `gist:name` | `owl:DatatypeProperty` | none | none | none | `name` | 11 |
| `gist:hasAddress` | `owl:ObjectProperty` | none | `gist:Address` | none | `hasPostalAddress`, `hasContactPoint` | 12 |

The module's gist list states each gist property as the table does, its domain and range held for C9 alone and never
projected (decision 16); none of the five has a gist parent of its own in the file, so decision 150's deferral costs
this slice nothing. `gist:Content` is on the list before `gist:isAbout` enters (step 9), and `gist:Address` enters
with `gist:hasAddress` (step 12), so C9's check that a gist property's declared class is on the list passes at each
step. Each step adds its names to `gist-categories.md` where the file lacks a row (PLAN step 9), so step 12 gives
`gist:Address` a row of its own, and step 9 adds `gist:isAbout`, step 10 `gist:atDateTime` to its properties list
where they are missing.

**Disjoint pairs** (decision 15). Of the pairs the file states, those with both sides on the module's list after step
12 are four: the thread's three (`Organization` with `Content`, `Organization` with `PhysicalIdentifiableItem`,
`PhysicalIdentifiableItem` with `Content`) and one new, `gist:PhysicalAddress` with `gist:ElectronicAddress`, added in
step 12. It keeps a postal address from being a contact point. The thread's three keep doing new work:
`gist:Organization` with `gist:Content` refuses a `SourceRecord`, an address, a contact point, a sign-in account or a
piece of evidence typed an organization, which is gate 9's planted fixture of step 13 (decision 34's reason);
`gist:PhysicalIdentifiableItem` with `gist:Content` refuses the same typed a person. What no pair catches:
`gist:Event` is disjoint with none of the admitted classes, so an identity decision, an agent run or a model call
typed a record or an organization passes, and no pair between `inv:` classes is stated (decision 15).

**No placement falls under two disjoint gist classes.** Each class's gist ancestors, from the tables: `SourceRecord`,
`IdentityEvidence`, `SignInAccount` and `AuditEntry` reach `Content`; `PostalAddress` reaches `PhysicalAddress`,
`Address` and `Content`; `ContactPoint` reaches `ElectronicAddress`, `Address` and `Content`; `IdentityDecision`
reaches `Determination` and `Event`; `AgentRun` and `ModelCall` reach `Event`; `Member` reaches `TemporalRelation`;
`Grant` and `ContactAssignment` reach `Assignment` and `TemporalRelation`; `Person` reaches `Person`, `LivingThing` and
`PhysicalIdentifiableItem`; `Organization` and `Tenant` reach `Organization`. No set holds both sides of a pair the
file states. `Party` is over `Person` and `Organization`, which are disjoint, but it is their category, not their
subclass, and no class is under it with a gist parent of its own. The gist domains and ranges agree too, were gist's
axioms read beside ours: `recordOf`'s subjects are records, which are content, and `hasPostalAddress`'s and
`hasContactPoint`'s objects are addresses.

**What the first draft had wrong.** It read `gist:Event`'s pairs from report 11 as four (`Aspect`, `Category`,
`Magnitude`, `UnitOfMeasure`); the file states six, adding `Language` (deprecated in 14.1.0, `gist-categories.md`) and
`TimeInterval`. Neither is on the list, so no pair of the module changes. It said `gist:isAbout`'s range was unknown
and the other three gist properties' domains and ranges were not in the repository; they are as the table gives them.

## 9. Sutton's slice-1 records, as answered

Decisions 130, 131, 133, 134, 136, 138, 139, 142 and 154 to 164 answer SPEC's coverage table; this is the table with
those answers. "Later" names report 17's slice. "Unplaced" is a field a decision holds back with its reason; a row
marked "(waits: question n)" waits on section 13.1 and gets nothing built. A placement on a property is stated on
`sutton-party.ttl` in step 12 unless a question's fixture states it.

| Sutton type | Field | Placed as |
| --- | --- | --- |
| `Company` | the record | the tenant's `SourceRecord`, `recordOf` a `Person` when `kind` is `individual` and an `Organization` when it is `company` (125) |
| `Company` | `id` | `sourceId` |
| `Company` | `kind` | chooses the class of `recordOf`'s object; no property |
| `Company` | `type` | `isCustomer` and `isVendor`, each true or false (34, 35, 89) |
| `Company` | `name` | `name`, on the record (157) |
| `Company` | `status` | `accountStatus` (130) |
| `Company` | `addresses` | `hasPostalAddress` (138) |
| `Company` | `contacts` | no property: each listed contact's record states `contactAt` this record, the fact placed once from the contact's side |
| `Company` | `primaryContact` | `primaryContact` (139) |
| `Company` | `customFields`, `files` | later: slice 8 |
| `Company` | `logo`, `notes`, `website` | no term (142) |
| `Contact` | the record | the tenant's `SourceRecord`, `recordOf` a `Person`; whether it states the two flags is question 6 |
| `Contact` | `id` | `sourceId` |
| `Contact` | `fullName` | `name`, on the record (157) |
| `Contact` | `firstName`, `lastName` | `givenName`, `familyName`, on the record (157) |
| `Contact` | `jobTitle` | `jobTitle`, on the record (section 11) |
| `Contact` | `email`, `phone` | `hasContactPoint` to a `ContactPoint` each, with `contactValue` and `contactPointKind` `email` or `phone`; each point is the contact's record and that field (159) |
| `Contact` | `phoneExt` | `extension` on the phone's `ContactPoint` (159) |
| `Contact` | `addresses` | `hasPostalAddress` on the contact's record, read as the contact's (126) |
| `Contact` | `company` | `contactAt` (139) |
| `Contact` | `type` | `contactType` (139) |
| `Contact` | `owners` | `contactOwner`, one per owner (139) |
| `Contact` | `customFields` | later: slice 8 |
| `Contact` | `notes`, `dateCreated` | no term (142) |
| `Address` | the record | `PostalAddress`, reached by `hasPostalAddress` from its company's or contact's record (138) |
| `Address` | `id` | the address's own id within the tenant (its criterion) (waits: question 4) |
| `Address` | `title` | `name`, on the `PostalAddress` (130; `readings.json`: "title is a name"; section 11) |
| `Address` | `addressLineOne`, `addressLineTwo` | `addressLines`, in that order |
| `Address` | `city`, `state`, `zip` | `locality`, `region`, `postalCode` |
| `Address` | `country` | `countryCode`, once a person accepts the code read from the free text; until then nothing (138) |
| `Address` | `type` | `addressPurpose`, one per value (126) |
| `Address` | the four `is*Default` flags | `defaultFor`, one per flag that is true |
| `Address` | `customerPaymentTerm`, `vendorPaymentTerm` | later: slice 2 |
| `Address` | `customFields` | later: slice 8 |
| `Organization` | the record | a `SourceRecord` whose `recordOf` is the tenant's `Organization`, `inTenant` this repository's tenant (P1); whether it states the two flags is question 6 |
| `Organization` | `id` | `sourceId` |
| `Organization` | `name` | `name`, on the record (157) |
| `Organization` | `members` | no path: each listed member is a `Member` whose `membershipIn` is the record's tenant and whose `membershipWorkspace` is this record (133, 154) |
| `Organization` | `defaultCurrency`, `defaultUom` | later: slice 2 |
| `Organization` | `addresses` | later: slice 4, as sites |
| `Organization` | `activeAccountingIntegration`, `hasAccountingIntegration`, `hasActiveAccountingIntegration`, `customFields`, `files` | later: slice 8 |
| `Organization` | `features`, `sidebarNavigationLayouts`, `accountType`, `billingStatus`, `status`, `portalCount`, `whitelabel`, `clerkOrganizationId`, `accessExpiresDate`, `domain`, `logo`, `replyToEmail`; `moduleSettings`, the prefixes, the alert and portal settings, `orderRequestInstructions`, `shippingPreventOverPicking` | no term (142; the second group written later as rules of the terms they govern, 128) |
| `OrganizationMember` | the record | `Member`, from the invitation (P2), its `membershipIn` this repository's tenant and its `membershipWorkspace` the Sutton `Organization`'s record (154) |
| `OrganizationMember` | `id` | unplaced: `Member`'s criterion holds this app's `MemberId` only, and a Sutton membership's own id waits until Sutton records are lifted and their IRIs decided (158) |
| `OrganizationMember` | `user` | `memberAccount` (134) |
| `OrganizationMember` | `profile` | part of the `Member` (below) |
| `OrganizationMember` | `customFields` | later: slice 8 |
| `OrganizationMember` | `isOrgCreator`, `settings` | no term (142) |
| `UserProfile` | `status` | `membershipStatus` (P2, 137) |
| `UserProfile` | `user` | `memberAccount`, the link `OrganizationMember.user` states, stated once (134); that the two name one `User` was not checked |
| `UserProfile` | `email` | unplaced: one account with two memberships may hold two different values, so it may not be the sign-in email; placed once a person has checked it on Sutton records (164) |
| `UserProfile` | `fullName` | `name`, on the `Member` (waits: question 3) |
| `UserProfile` | `firstName`, `middleName`, `lastName` | `givenName`, `middleName`, `familyName`, on the `Member` (waits: question 3) |
| `UserProfile` | `jobTitle` | `jobTitle`, on the `Member`, since it is said per membership (waits: question 3) |
| `UserProfile` | `personalEmail`, `phoneNumber`, `personalPhoneNumber` | `memberContactPoint` to a `ContactPoint` each, with `contactValue` and `contactPointKind` `email` or `phone`; each point is the membership and that field (159, 162) |
| `UserProfile` | `phoneNumberExt` | `extension` on `phoneNumber`'s `ContactPoint` (162) |
| `UserProfile` | `image`, `about` | `profileImage`, `profileText`, on the `Member` (163) |
| `UserProfile` | `role`, `assignedLocations`, `includesUnassignedLocations` | later: slice 4 (131) |
| `UserProfile` | `startDate`, `endDate` | no term until something reads them (136) |
| `UserProfile` | `heardAboutUs`, `firstLogin` | no term (142) |
| `UserProfile` | `id` | unplaced: whether it equals `OrganizationMember.id` was seen on one empty trial workspace only; placed once a person has checked it on Sutton records (164) |
| `User` | the record | `SignInAccount` (134) |
| `User` | `id` | unplaced: `SignInAccount`'s criterion holds this app's `UserId` only, and a Sutton account's id waits until Sutton records are lifted (158) |
| `User` | `isDigitAdmin`, `username` | no term (142) |
| `CurrentUser`, `CurrentUserOrganization` | the records | views of the `SignInAccount` and the `Member`, no term of their own (131) |
| `CurrentUser` | `id` | as `User.id`: unplaced (158) |
| `CurrentUser` | `email` | `accountEmail` of the `SignInAccount`, which gives it while `UserProfile.email` waits (164) |
| `CurrentUser` | `organizations` | the memberships, each a `Member` with `memberAccount` this account and `membershipWorkspace` its workspace's record (154) |
| `CurrentUser` | `canManageRoles`, `impersonatedBy`, `isDigitAdmin`, `username` | no term (142) |
| `CurrentUserOrganization` | `name` | as `Organization.name`: `name` on its record (157) |
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
27, step 5). The must-fail cases are the SPEC's (its Acceptance section), drawn from the BRIEF and report 04; where
report 04 asks more, the row says what is left out and why.

| Question | What it asks | Terms it reads | Fixture | Step |
| --- | --- | --- | --- | --- |
| CQ-P01 | Which organizations does our tenant both buy from and sell to? | `SourceRecord`, `inTenant`, `recordOf`, `isCustomer`, `isVendor`, `Organization` (and `Party`, the range it walks from) | `test_ExampleWorks`, `test_SecondOrg` and their records, each stating its source keys and one `capturedAt`, its latest read (156) | 9 |
| CQ-P02 | Which of our organizations hold no trading role at all? | `SourceRecord`, `inTenant`, `recordOf`, `Organization`, `isCustomer` and `isVendor` stated false | CQ-P01's tenants with records whose flags are false, and the open-reading record | 9 |
| CQ-P09, party half | Does any party record belong to no tenant, or to two? | `SourceRecord`, `inTenant` | records with no `inTenant` and with two | 9 |
| CQ-P04 | Which two source records a tenant holds were decided to be about one party, by whom, when, and on what evidence? | `IdentityDecision`, `inTenant`, `decidesOn`, `SourceRecord`, `identityOutcome`, `IdentityOutcomeScheme` (`sameParty`), `decidedBy`, `Member`, `eventTime`, `citesEvidence`, `IdentityEvidence`, `evidenceText` | report 04's `test_AcmeA` to `test_AcmeF`, `test_Decision1` to `test_Decision5`, `test_Dana`, `test_Kim`, each piece of evidence stating its `inTenant`. The decision in force about a pair is the tenant's latest by `eventTime`, as report 04's sketch reads it, so a reversed decision gives no row; no term states that one decision replaces another (section 4.3) | 10 |
| CQ-P05 | Does any party, item or record stand in `owl:sameAs` with another? | no term: `owl:sameAs` itself, an ASK | CQ-P04's, and a fixture `.ttl` with the `owl:sameAs` triple | 10 |
| CQ-P06 | Who are the members of this organization and which role does each hold, with the person's name and the sign-in email? | the thread's (`Member`, `membershipIn`, `membershipOf`, `Grant`, `grantedTo`, `grantScope`, `grantsRole`) and `Person`, `name`, `memberAccount`, `SignInAccount`, `accountEmail`; from step 12 `membershipWorkspace`, whose memberships it leaves out (154) | the thread's, with the person's name and the sign-in email written by hand (155; the name's line waits: question 9, since guard 1 flags it beside the lifted tenant names); from step 12, a membership that names a workspace, which gives no row | 11; the exclusion in 12 |
| CQ-P07 | Does every tenant keep at least one admin who is not removed? | `Tenant`, `Member`, `membershipIn`, `membershipStatus`, `MembershipStatusScheme` (`active`, decision 136), `Grant`, `grantedTo`, `grantsRole`, `MemberRoleScheme` (`admin`); from step 12 `membershipWorkspace` (154) | a tenant whose only admin is not active, a tenant with no members, and `test_FlourMill`, each member's stage stated; from step 12, a tenant whose only active admin is a membership that names a workspace, which counts no admin (a plant: decision 131 gives a Sutton member no grant) | 11; the exclusion in 12 |
| CQ-P11 | At which scope does each member hold which role? | `Grant`, `grantedTo`, `grantsRole`, `grantScope` | the thread's; rows unchanged | already built |
| CQ-P03 | Which people are contacts at an organization, for which purpose? | `ContactAssignment`, `contactPerson`, `Person`, `contactAccount`, `Party`, `servesPurpose`, `ContactPurposeScheme`, `assignmentPoint`, `ContactPoint`, `contactValue`, `inTenant` | a source that records a contact's purpose (decision 140): one person billing contact at one account and receiving contact at another, both assignments naming one contact point, which the tenant's `SourceRecord` of the person (`recordOf` that `Person`) gives by `hasContactPoint` (decision 159; the query reads neither the record nor the link), and an assignment with no purpose. Report 04's variant, one point for billing at A and receiving at B, is this fixture: the point is the record's and the field's, not an assignment's, so the two assignments share it. Report 04's other half, "is a person who is a contact at two organizations one person?", and its two must-fails on the source keys (a second `recordOf` person on one source record gives one violation; the same id "001" in another system gives zero) are left out: the SPEC's acceptance for CQ-P03 names the purpose cases only, `contactPerson` points at the `Person`, not at a source record, so the terms state no record to count, "at most one `recordOf`" is a cardinality for SHACL (section 12), and that two records are one person is CQ-P04's decision | 12 |

CQ-I08 is answered by gate 4 over the module (C16, section 6.1), not by SPARQL. CQ-P08 and CQ-P10 are not this
slice's (the brief). No question reads `capturedAt`, `joinedAt`, `maxRole`, `recordedAgentRun`, `agentName`, the model
call's three properties or the coverage's properties: each is shown by its mark or by its named fixture (section 4).
`membershipWorkspace` is read by CQ-P06 and CQ-P07 only to leave its memberships out.

## 11. Choices in this report

The accepting decision covers each. Each is reversible by changing the entry before step 9 to 12 writes it.

- **Keys no source fixes**: `memberAccount` (decision 134's "a new property from `Member`"), `recordedAgentRun`
  (decision 135's "a new property from `AuditEntry`"), `addressPurpose` (decision 126's "a property for an address's
  purpose"), `contactAt` and `contactOwner` (decision 139's link and owner property; `readings.json` suggested
  `contactOwner`), `membershipWorkspace` (decision 154's "one object property from `Member`"), `memberContactPoint`
  (decision 162's "a property of its own"), `profileImage` and `profileText` (decision 163's "two datatype
  properties"), and `extension`, `givenName`, `middleName`, `familyName` and `jobTitle` for Sutton fields decision 130
  gives a term. `primaryContact`, `contactType`, `ContactTypeScheme`, `accountStatus` and the rest are the decisions'
  or report 06's keys.
- **Labels and definitions** are report 06's and report 10's where those exist, with these edits: the flags say "the
  tenant's record of a party" (decision 125) and "true or false on every stored record of a trading account" (decision
  35, narrowed as question 6 recommends); `IdentityEvidence` and `citesEvidence` drop the suspicion, which is not a term
  of this slice; `SignInAccount` and `PostalAddress` are widened to Sutton's records; `SourceRecord`'s definition adds
  where the tenant's assertions sit (decision 34); `AccountStatusScheme` says "party" (decision 125); `agentName`'s
  example is the kernel schema's, "Assistant"; `memberAccount` and the stages `pending`, `active` and `suspended` say
  the membership's workspace, not the tenant's (decision 154's reason, section 5). The flags' prefLabels are report 06's
  ("is customer", "is vendor"), with report 10 section 4.8's words as altLabels. `Member`'s definition joins P2's
  widening to decision 154's quoted clause, and `capturedAt`'s states decision 156; `AgentRun`'s criterion is decision
  160's words.
- **`hasPostalAddress` and `hasContactPoint` keep report 06's keys** with the domain decision 138 gives,
  `SourceRecord`, not `Party`.
- **`contactAccount` ranges over `Party`**, not report 06's `Organization`, since an account of kind `individual` is a
  person (decisions 12 and 125).
- **`eventTime` declares no domain**: report 13 gives `gist:Event`, which the metamodel cannot name as a domain (a
  domain is a class of the vocabulary), and report 09 uses it on every event. `gist:atDateTime` declares none either,
  so C9 passes it.
- **`capturedAt` comes with the three source keys** (the brief's "its four properties"), stated on CQ-P01's fixture.
- **`maxRole` is a term**, range `Role` as report 06 has it, because enrolling `AgentRun` needs a mark on each of its
  fields and the field states a fact of the run (section 6.3).
- **`Member`'s basis is `membershipIn` alone**: decision 158 has the accepted criterion hold this app's `MemberId`,
  which reads the tenant; `membershipWorkspace`, stated on no membership of this app's, tells a Sutton membership apart
  and is named in the sentence, not in the basis. The quoted "criterion for a Sutton member's id" the first draft
  answered is the wording of SPEC O1's option (a), which decision 129 chose, not decision 129's own text.
- **A criterion's basis holds the properties it reads, and its own stored id only in its sentence** (decision 160):
  no `restsOn` names an id, since C16 refuses a key that is no property (decision 167). The thread's criteria keep no
  basis (section 6.1).
- **`IdentityEvidence` rests on `inTenant` and its own id**, as every other tenant-held class does, not on
  `citesEvidence`: that property points from the decision to the evidence and is not single-valued, so "the decision
  that cites it" is undefined when two decisions cite one piece. CQ-P09's party half reads source records only, not
  evidence; CQ-P04's fixture states each piece's `inTenant`.
- **`citesEvidence` declares no domain**, as report 06 has it ("kept broad"), though its other subject there,
  `SuspectedDuplicate`, is left out of this slice (section 4.3): a later slice's suspicion cites evidence too, and
  declaring `IdentityDecision` now would make that a domain change. The reverse is the domain `IdentityDecision`,
  widened when the suspicion enters.
- **Designations**: `name`, `givenName`, `middleName`, `familyName` and `agentName` are names, `accountEmail` and
  `contactValue` emails (PLAN step 7 left them to this report). `contactValue` holds email addresses and telephone
  numbers; the metamodel has two values, and email keeps decision 146's refusal for the email half, at the cost of a
  C16 message that calls a phone "an email address" (section 6.1). The reverse is two properties, an email value and a
  phone value, chosen by `contactPointKind`.
  `profileImage` and `profileText` carry none: neither is a name a criterion could be tempted to rest on.
- **`calledAt` is kept beside `eventTime`**: decision 130 names it for `model-call.ttl`, and the thread's `AuditEntry`
  has its own `recordedAt` the same way. A question over `eventTime` therefore finds no model call; no slice-1
  question asks one. Neither `calledAt` nor `joinedAt` nor `capturedAt` is put under `gist:atDateTime`: decision 166
  takes `eventTime` only.
- **`joinedAt` is when the person could first act**: this app's `Person.joinedAt` is the `member` row's `createdAt`,
  the moment an admin added the person; for an invitee that is the acceptance, not the invitation. No Sutton field
  fills it in this slice (`startDate`, decision 136).
- **`Contact.jobTitle` sits on the contact's record**, as decision 157 places the contact's names: one tenant's
  record says it, and on the person two tenants' titles would merge. 157 rules names, and a job title is no name, so
  this is a choice; `UserProfile.jobTitle`, held per membership, waits on question 3 with the profile's names.
- **`Address.title` is `name` on the `PostalAddress`**: decision 130 gives the field a term, `readings.json` says
  "title is a name", and decision 157, which names companies, contacts and workspaces, does not reach an address.
- **`name` declares no domain**: its subjects are persons, tenants, source records and postal addresses, and no class
  of the vocabulary covers them all. So decision 132's reason, "a property of our own has a definition, a domain and
  marks our gates can check", is met for the definition and the marks but not for the domain; `givenName`,
  `middleName`, `familyName` and `jobTitle` declare none for the same reason. The reverse is a domain over parties and
  records once a category over them exists.
- **`UserProfile.user` is `memberAccount`**, the link `OrganizationMember.user` already states, stated once. That the
  two name one `User` is a reading (section 14).
- **`addressLines` is one literal**, the lines in order with one line break between, since two values of one property
  keep no order.
- **A contact point states its kind and extension**: `contactPointKind` with report 10's `ContactPointKindScheme`,
  which the brief had kept out and decision 130's "a term for each field" brings back, so `email` and `phone` stay
  apart; `extension` holds `phoneExt` and `phoneNumberExt`, the latter on `phoneNumber`'s point, by the field names.
- **`Company.contacts` gets no property of its own**: the contact's `contactAt` states the fact once, as decision 133
  places `Organization.members` from the member's side.
- **`Person.name` (the People page's) takes the path `Member.name` takes**: the brief names the kernel `Member`'s two
  names only, and the People page's copied name is the same fact.
- **Steps.** `Member`'s definition enters whole in step 11, its clause "where it names one" with no instance until step
  12 brings `membershipWorkspace`; the release line names P2 and 154. `Person`'s `storesId: false` enters in step 9 with
  its category parent, since the accepting decision lists the two together and step 9 rewrites the header; no record of
  step 9 links to a person. `membershipWorkspace` enters in step 12 with `sutton-party.ttl`, its fixture, and CQ-P06 and
  CQ-P07 gain the clause that leaves its memberships out in the same step, with a must-fail membership each; until step
  12 no fixture holds a Sutton membership. `memberContactPoint`, `profileImage` and `profileText` enter in step 12 for
  the same fixture.
- **Decision 155's rule is read with decision 161 as its one exception among slice 1's marks** (section 7): the first
  draft's question 2, which decision 155 answers, recommended its option "with the tenant's path as question 10
  settles", and 161 settles that question, the first draft's tenth. A contact point's path, which decision 159 has
  minted, is question 7.
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
- SHACL: the flags' `sh:minCount 1` (decision 35), closures, cardinalities such as "two records per identity decision",
  "at most one default address per purpose" and "at most one `capturedAt`" (decision 156 says one value; report 06's
  axiom plan holds such counts for SHACL), and which concepts a field admits (`sh:in`).
- Any disjointness gist does not state (decision 15), including report 06's pairs between `inv:` classes.
- How a Sutton record's IRI is made when Sutton data is lifted, and what `sourceSystem` holds for Sutton: no Sutton
  record is lifted in this slice, and the fixtures name their records. The Sutton halves of the criteria of `Member`,
  `SignInAccount` and `ContactAssignment` wait for it (decision 158), and the reading of an absent issuing system as
  this app's is not made.
- How a second read of a Sutton record shows a changed flag to the person before it is written (decision 156): a
  screen, not a term.
- Whether this repository's removal (`member.removedAt`) is the stage `revoked`: the kernel's `Member` stores no stage,
  and CQ-P07's fixtures state it (decision 136). `Member`'s definition and criterion name removal and the stages side
  by side, so neither reading is written into them (section 3.2).
- The flow by which a person accepts a country code (decision 138), and Sutton's roles, locations and grants (131).
- When the party context's contract package is made: decision 37 places party records there, members, grants, agents
  and the audit trail staying in access, and leaves its creation to the first record built.
- The review list of V18's sentence part and a criterion on a SKU (decision 165: with the catalog slice, named in the
  goal's closing note).
- A gist property's own gist parent (decision 150): none of the five gist properties this slice takes has one.

## 13. Questions for Benjamin

### 13.1 Still open

Each question gives its options with this report's recommendation, and names what waits on it. Question 1 is the
first draft's; questions 2 to 5 come from applying decisions 154 to 166 and reading the pinned file, and questions 6
to 10 from the report's second review. A row that waits on one is marked "(waits: question n)".

1. **Which decision number accepts this report?** Decision 129 says the terms name "that number". (a) A new heading,
   `### 168.`, the next free number in `DECISIONS.md`, written when you accept, each new term, `Member` and `Party`'s
   entry naming 168; (b) decision 129 itself, whose heading exists. Recommended: (a), so the number names the text
   accepted and not the method chosen before it was written. Step 9 waits on it, and with it every step after.
2. **`membershipIn`'s text beside decision 154.** The thread's `membershipIn` (decision 111) "links a membership to
   the tenant it lets its person act in". Under decision 154 a Sutton membership's `membershipIn` is this repository's
   tenant (133) while the membership lets its person act in Sutton's workspace, which `Member`'s new definition says
   and `membershipIn`'s does not. (a) Reword it: "Links a membership to the tenant it belongs to, in whose workspace,
   or in a source's workspace it names, it lets its person act.", naming the accepting decision; breaking under
   decision 24, in the release line that already names `Member` (reverse: 111's text); (b) keep 111's text, reading
   "act in the tenant" as acting for that organization in any of its workspaces, the workspace being `Member`'s to
   name. Recommended: (a), for the reason decision 154 gave for `Member`: the definition then holds for every
   instance the slice places. It adds no term. Under (a) `membershipIn` names the accepting decision, so the SPEC's
   acceptance line and its `Coherence.test.ts` assertion read "111 for all but `Member` and `membershipIn`" instead of
   "111 for all but `Member`". The new terms with the same flaw, `memberAccount` and the stages `pending`, `active` and
   `suspended`, are this report's own and already say the membership's workspace (section 5), so they do not wait on
   it. Step 12, which brings the first Sutton membership, waits on it.
3. **Where a Sutton `UserProfile`'s names sit under decision 157.** Decision 157 puts a name on the record "wherever a
   tenant's record states it", names the Sutton company's, contact's and workspace's, and keeps this app's member and
   tenant names on the person and the tenant. A `UserProfile`'s `fullName`, `firstName`, `middleName` and `lastName` are
   a Sutton record's, held per membership, and the membership is a `Member`, not a `SourceRecord`; its `jobTitle` asks
   the same question, which the SPEC groups with the names (O4, O5) and decision 157, which rules names only, does not
   reach. (a) On the `Member`, the tenant's record of that membership, as decision 163 places `image` and `about`: one
   tenant's spelling of a person or of their title stays off another's; (b) through the person, written on fixtures by
   hand, as decision 133 has for this app's members and the first draft had: on the shared person node, where two
   tenants' spellings merge (157's reason against it). Recommended: (a). It changes no term (the five properties declare
   no domain). The three section 9 rows of the names and `jobTitle`, and their `sutton-party.ttl` lines, wait on it.
4. **`PostalAddress`'s criterion beside decision 158.** Decision 138 keys an address "by its id within the tenant",
   and the only slice-1 source of addresses is Sutton's `Address`, so the id is a source's: two systems' equal ids in
   one tenant would read as one address, the case decision 158 settles for `Member`, `SignInAccount` and
   `ContactAssignment` and does not name here. (a) Apply 158: the criterion reads "its own record id within the
   tenant; equal text on two records is two addresses (decision 138), and an id a source issued waits until that
   source's records are lifted (decision 158)", so no address is identified in this slice beyond the fixtures, which
   name theirs; (b) keep decision 138's words unqualified, the two-systems case left to section 12's IRI question.
   Recommended: (a), so every criterion this report writes follows one rule. Basis, `storesId` and every other field
   stay as written. `PostalAddress`'s criterion and the row `Address.id` wait on it.
5. **Whether `memberContactPoint` sits under `gist:hasAddress`.** Decision 166 put the four properties report 11
   named under gist; `memberContactPoint` came later (162). `gist:hasAddress` declares no domain and the range
   `gist:Address`, which `ContactPoint` reaches through `gist:ElectronicAddress`, so C9 passes it as it passes
   `hasContactPoint`. (a) Under `gist:hasAddress`, as `hasContactPoint`: a gist query for an address finds a member's
   points too; (b) under none in this slice, the property standing without it (reverse: add the link). Recommended:
   (a), the same test decision 16 asks and the same answer decision 166 gave. It adds no term and no gist name. Step
   12's entry for the property waits on it.
6. **Which source records decision 35's closure covers.** `isCustomer` and `isVendor` have the domain `SourceRecord`,
   and decision 35 has each "true or false" in every stored record, a record whose source is silent waiting as Needs a
   decision. Section 9 also makes a Sutton `Contact` and a Sutton `Organization` workspace tenant `SourceRecord`s, and
   neither source states a trading role, so read literally every contact and workspace record would wait on two flags
   forever, the harm decision 89 gave for refusing two more flags. No decision says which records the closure covers.
   (a) Only the records of a trading account, whose source has a trading-role field (a Sutton `Company`): the two
   definitions say "true or false on every stored record of a trading account, such as a Sutton company's", and a
   contact or workspace record states neither flag (reverse: widen the definitions); (b) every source record, with
   contacts and workspaces stated false by a rule that reads their record type, so CQ-P02 lists the tenant's own
   organization, through its workspace record, as one holding no trading role. Recommended: (a): a flag the source never states is not the
   tenant's assertion, and (b) has a rule say "not a customer" for every contact, which decision 35's reason, one
   reading of a field, does not ask. It adds no term. The two definitions (written as (a) has them), step 9, which
   brings them, and the flag lines of `sutton-party.ttl`'s contact and workspace records wait on it.
7. **How a lift would write a contact point.** Decision 159 has `ContactPoint` store an id "made from that record and
   field, as the lift makes a `Grant`'s node". But a contact point's path, `hasContactPoint` (node `ContactPoint`) then
   `contactValue`, ends in an attribute, and decision 155's rule has the lift state nothing for such a path, reading
   only the last step's property kind; `Grant`'s path ends in a relation. Read together, a lift could never write a
   contact point. (a) A path whose node class stores an id made from record and field mints that node and writes the
   literal there, a second exception to 155 beside decision 161's tenant path, built when a Sutton record is first
   lifted; (b) contact points are stated by hand, as `sutton-party.ttl` and CQ-P03's fixture state them, until Sutton
   records are lifted, and the lift's rule for them is put to you then. Recommended: (b): no slice-1 record is lifted
   with such a path, so (a) would build a rule no record uses, and 159's IRI shape stands either way. It adds and
   changes no term, and no slice-1 step waits on it; section 7 names it beside 161.
8. **Whether `defaultFor` sits under `gist:isCategorizedBy`.** `defaultFor` ranges over `ContactPurposeScheme` and holds
   a concept, as decision 23 has a classification property hold one, and decision 17 puts "the classification
   properties" under `gist:isCategorizedBy`; the first draft left it out on its own argument, listed as a choice. (a)
   Under no gist property, decision 17 read as covering the properties that say what kind a thing is: a default flag
   says which address is used for a purpose when an order names no other, so under `gist:isCategorizedBy` a gist query
   reads "default for billing" as "categorized billing" (reverse: add the link); (b) under `gist:isCategorizedBy`, as
   every other property whose range is a scheme, C9 passing it since that property declares no domain and no range
   (decision 153). Recommended: (a), because `addressPurpose` already says that an address is for billing, and
   `defaultFor` under the same gist property would say it twice. It adds no term and no gist name. Step 12's entry for
   `defaultFor` waits on it.
9. **Guard 1 beside decisions 155 and 161.** Guard 1 (`overreach`, `packages/ontology/src/Fixture.rules.ts`) flags a
   hand-written triple whose predicate is the predicate of any lifted triple, whatever its subject. From step 11 the
   thread's rows, which carry `organizationName`, lift `inv:name` on each tenant's node (161), while decision 155 has
   CQ-P06's fixture state the person's `inv:name` by hand; guard 1's test in `Questions.test.ts` expects no overreach,
   so it fails. (a) Guard 1 compares the subject with the predicate: a hand-written triple is overreach when the lift
   states that predicate of that subject, so the person's name passes and a hand-written tenant name is still caught,
   as are the planted grant, tenant link and member type of its second test; (b) keep guard 1, and state the person's
   name in a packet fixture under `assets/requirements/cq/` that CQ-P06 reads and guard 1 does not compare with the
   thread's lift; (c) reverse decision 161 for the thread, writing each tenant's name by hand and lifting none.
   Recommended: (a): the person and the tenant are different nodes, and the guard's purpose, catching a hand-written
   copy of what the lift states, is kept. It adds no term. The lift writes no `rdf:type` on a node it reuses, under
   every option (section 7). Step 11's CQ-P06 name line, and under (a) the change to guard 1 and its test, wait on it.
10. **`Party`'s `storesId`.** `Party` takes the default, `storesId: true`, and two object properties range over it,
    `recordOf` and `contactAccount`. The lift refuses a link only when its range class itself stores no id
    (`storesNoId` in `packages/ontology/src/Lift.ts` reads the range alone), so a later lift of such a link would mint
    `.../data/<org>/Party/<id>`: a person reached through the category, around `Person`'s `storesId: false` (decisions
    133 and 161), and a party id no record holds (decision 34). No decision rules a category's `storesId`. (a) `Party`
    takes `storesId: false`, so the lift never mints a node from a link to it, as decision 34 says no record holds a
    party's id (reverse: the default); (b) keep true, and have the lift refuse a link whose range is a category; (c)
    keep true, and record the gap for the slice that first lifts a source record. Recommended: (a): it is one fact on
    the term, needs no new rule, and matches what the criteria already say. It adds no term. `Party`'s row and step 9,
    which brings it, wait on it.

### 13.2 Answered since the first draft

| First draft | Decision | What it settled |
| --- | --- | --- |
| Question 2, what the lift writes for step 11's five paths | 155 | nothing for a path ending in an attribute, the record still lifted; values on fixtures by hand (section 7) |
| Question 3, `Person` with `storesId: false` | 161 | `Person` takes it and keeps 111, listed with its category parent (section 3.3) |
| Question 4, the account node | 155 | folded into 155: no account node until a record holds the account's id |
| Question 5, a criterion's basis | 160 | `restsOn` optional; `AgentRun`'s criterion restated (section 3.1) |
| Question 6, the gist super-properties | 166 | all four, the gist properties read from the pinned file (sections 4 and 8) |
| Question 7, a member's own contact points | 162 | `memberContactPoint`, from `Member` to `ContactPoint` (section 4.1) |
| Question 8, `UserProfile.image` and `about` | 163 | `profileImage` and `profileText` on the `Member` (section 4.2) |
| Question 9, `UserProfile.id` | 164 | unplaced until a person checks it on Sutton records (section 9) |
| Question 10, the tenant's node behind `Member.organizationName` | 161 | the tenant's name lifted on the node `organizationId` names (section 7) |
| Question 11, whether a Sutton member is a `Member` of this tenant | 154 | yes, naming its workspace by `membershipWorkspace`; CQ-P06 and CQ-P07 leave such memberships out (sections 3.2 and 10) |
| Question 12, how a criterion tells this app's ids from a source's | 158 | the accepted criteria hold this app's ids only (section 3.1). Its quote, "criterion for a Sutton member's id", is SPEC O1's option (a), which decision 129 chose |
| Question 13, what identifies a contact point | 159 | the record that gives it and the field, `storesId` true (section 3.1) |
| Question 14, a name the record's or the party's | 157 | the record's where a tenant's record states it (section 9; question 3 above for `UserProfile`) |
| Question 15, `UserProfile.email` | 164 | unplaced; `CurrentUser.email` gives `accountEmail` meanwhile (section 9) |
| Question 16, `capturedAt` on a second read | 156 | the latest read, one value (section 4.2) |
| Step 7's open points | 155, 160, 161, 165, 167 | an absent agent and "refuse or state nothing" (155); a basis optional, the own id in the sentence (160); `Person`'s `storesId` (161); no SKU designation or sentence review list this slice (165); the fields' names and the stricter readings of P4 and C16 (167) |

## 14. Not checked

- The pinned gist file was read for the facts of section 8 only, by a script outside the repository; nothing of gist's
  but names and links enters the module (decision 16). Whether gist's own axioms, read beside the generated file,
  leave the fixtures consistent is gate 9's question (step 13), not this report's.
- No term here was decoded with `Vocabulary`, run through gate 4 or gate 5 or projected: the counts of section 2, the
  rule tables of section 6 and the key patterns were checked by reading, and the lengths of labels and definitions
  and the distinctness of keys by a script over this report's tables (2026-11-26). Steps 9 to 12 decode each.
- Sutton's schema was not re-read; its field and enum names are the SPEC's, report 16's, report 17's and
  `readings.json`'s, and the definitions of `marketing`, `sales`, `manufacturing` and `other` are readings. So is
  `revoked`'s: whether Sutton's `revoked` is a removed member or a withdrawn invitation was not checked, and the
  definition is worded to hold for both (section 5). Whether `UserProfile.image` holds a link or a file's id, and
  which phone `phoneNumberExt` extends, were not checked.
- What section 4 says of guard 3, section 7 of guard 1 and of the lift's refusals, and question 10 of a link to
  `Party` were read from `Fixture.rules.ts`, `Lift.ts`, `Questions.test.ts` and `test/support/fixtures.ts` as they
  stand; no test was run on a changed vocabulary.
- That `UserProfile.user` and `OrganizationMember.user` name one `User` was not checked; section 9 states the link
  once on that reading.
- Nothing here was put to the foundational auditor (decision 107 made the audit advisory for the thread; no decision
  asks it of this slice).
