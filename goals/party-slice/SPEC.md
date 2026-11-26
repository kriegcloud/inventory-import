---
type: Goal
title: "party-slice"
description: Slice 1 of the ERP vocabulary. The party and access terms join the vocabulary module, the projector and gates 1 to 9 grow to them, the access records that wait for them are enrolled, the party questions are answered on named test_ fixtures, and Sutton's party records are covered by name.
status: active
from: explorations/erp-ontology
---

# `party-slice`

The second deliverable of [the erp-ontology exploration](../../explorations/erp-ontology/README.md), after the thin
thread ([erp-vocabulary](../erp-vocabulary/SPEC.md), done). What slice 1 holds is
[BRIEF.md](../../explorations/erp-ontology/BRIEF.md), "Slice 1, the party slice", and its Map; what done means for a
slice is [report 17](../../explorations/erp-ontology/research/17-sutton-whole-model-plan.md) section 3. Benjamin
answered the slice's decisions on 2026-11-26. This file says what done means and where the goal differs from the
brief and the reports. It copies neither.

## Objective

Answer the party questions from the vocabulary, end to end: which organizations a tenant both buys from and sells to,
which hold no trading role there, who is a contact where and for what, which two records a person decided are one
party, whether every tenant keeps an admin, and whether a party record belongs to exactly one tenant. The vocabulary
module grows by the party and access terms those questions and the access records need, closed over each included
property's domain and range: `Party` as a category over `Person` and `Organization` (decision 12), the tenant's
`SourceRecord` with `recordOf` and the two flags (decisions 34, 35, 89 and 125), the identity decision with what
CQ-P04 reads (`IdentityEvidence`, `decidesOn`, `identityOutcome`, `decidedBy`, `eventTime`, `citesEvidence`,
`evidenceText`, `IdentityOutcomeScheme`: report 04, the brief), the agent run, the model call with
`ModelCallPurposeScheme` (view, check, suggest), the sign-in account (O6), the contact terms, the membership stage
(decision P2) and `joinedAt`. A property enters only in the step that brings a mark of an enrolled record naming it or
a named `test_` fixture stating it (gate 5's P11, guard 3); the model call's properties and the Sutton coverage's,
which no record marks and no question reads, enter on fixtures of their own only under O2's recommendation. The
metamodel and the projector grow by what those terms and the answered decisions need (O18). The access records that
wait for these terms are enrolled and marked, the thread's deferred fields get their terms or paths, and the
questions run in gate 8 on named `test_` fixtures (decision 36), each with a must-fail case. Gates 1 to 9 pass on the
larger module, and no new gate is built.

Sutton's party record types are covered by name (decisions 123, 124 and 128): each gets the term it maps to, and each
of its fields is placed in this slice, left for a later slice, or given no term.

## Non-goals

- Any change to the app: no screen, endpoint, table, stored row, decoded value or wire format (the brief's no-go). A
  mark is an annotation on a schema.
- A party context package or any stored party record. Decision 37 gives the party context its contract "when their
  first record is built"; no document has slice 1 build one, and decision 36 proves the model on fixtures so that
  "nothing is added to the app". A property no repository record fills carries `evidence: "fixture"` (the metamodel
  has `evidence` on properties only; a class no record holds needs none).
- Any record of the demo workspace written here (decision 123). That this goal also reads no Sutton data is its own
  choice (PLAN, "Choices made"), not decision 123's: decision 36 proves the model on fixtures, and its Reverse allows
  reading records once the workspace has some.
- The alignment file, its SSSOM table and gate 12. The brief puts them out of slice 1 and gives them a Map row of their
  own, which now waits on no open decision but still on a ratified row naming its `rat-` record (decision 32, which
  107 amends for the thread only). The rows decisions 125 and 126 change wait for that part, and report 17's "one
  alignment row for every Sutton type the slice covers" applies "once the alignment file exists", so it is not part
  of this done.
- SHACL, shacl-engine and gate 11, with decision 35's `sh:minCount 1` (the brief: slice 2). Gate 10 (decision 27).
- The catalog, import, stock and commitment terms, the catalog lifts, and law rule 2.
- `PortalAccess` and a `recordedActor` that takes one: decision 44 applies "when portals are built".
- A `PartyRole` scheme. Decision 47 is a deferred row of the Open table and offers no choice: the slice builds the two
  flags on the tenant's `SourceRecord` with their labels and no scheme (decisions 3, 34 and 89), and nothing waits on
  47.
- The refusal of a newly assigned retired code, which decision 33 leaves unbuilt because it changes command schemas.
- A disjointness pair gist does not state (decision 15), and hand-written Turtle that states a term fact.
- While O3, O13 and O15 hold their recommendations: a grant for a Sutton member, `Permission` with `permits`, and
  report 05's `AlignmentRow`, `NamedExternalTerm` and `Confidence`.

## Constraints

- The app keeps working at every commit: `items_messy.csv` (200 rows) imports to 155 stored, and `bun run check`
  passes before each commit.
- Schema, then service contract, then implementation; Effect 4.1 with every module imported whole from its own path
  ([effect-imports](../../docs/standards/effect-imports.md)); [schema-first](../../docs/standards/schema-first.md);
  the full strictness profile, no exception.
- The module is the only source of a term, and every `.ttl` under `generated/` comes from the projector (decisions 2
  and 5). A new term enters, and an accepted term's label, definition, parent, tag or identity criterion changes,
  only with a decision first (O1); no gate detects one made without it. Nothing is built on an open row below.
- The ontology's tasks in `bun run check` need no Java, Python or network; only gate 9 needs Java 17 and the pinned
  ROBOT v1.9.11 jar (decisions 112 and 113).
- IRIs under `example.org` (decision 7); every fixture individual is named `test_`. Where a decision's fixture name
  has a space, such as "test_Ana Ruiz", the name stays as text and the IRI drops the space: the agent's choice (PLAN,
  "Choices made"), put to Benjamin with the open rows.
- The expected rows are the lock on an answer (decision 118). A commit that changes a question's rows says so, and the
  release notes name the question with its old and new answer.
- The version (decision 24): `0.y`, any change advances `y`, and a change after which data or an answer that held no
  longer holds is marked breaking. Widening `Member`'s definition is such a change and is recorded as one (decision
  P2). With O16's recommendation the goal moves the module from `0.1.0` to `0.2.0` once, in the first commit that
  changes a generated file (PLAN step 9), and `packages/ontology/RELEASES.md` gains one line for it: "0.2.0: the
  party slice". The commit that widens `Member` (step 11) marks the line breaking and names `Member` and decision P2;
  a commit that changes a question's rows adds that question to it. The line never records a change not yet made.
- The thread's five forbidden conclusions keep their refused files and near misses, and still pass.
- bun only. Nothing pushed, and no deploy.

## Where the goal differs from the brief and the reports

The decisions of 2026-11-26 came after the brief's slice-1 text. Where they and the brief or a report disagree, they
win.

- **The membership stage is in.** The brief keeps `MembershipStatusScheme` out of the module; decision P2 gives a
  Member a stage from the invitation, "a concept of a membership status scheme (pending, active, revoked)". Its
  concepts are P2's, not report 10's (invited, active, suspended, removed); `suspended` is O9.
- **The Sutton-only limit is gone.** Decision 124 takes back the brief's limit of slice 1 to the Sutton-only party
  terms a must or should question needs, so the brief's "stay not proposed" list (`PostalAddress`, `PartyIdentifier`,
  `PortalAccess`, `SuspectedDuplicate`) no longer bounds the slice. What enters instead is O2.
- **A Sutton record's purpose is on the address** (decision 126). The brief's `ContactAssignment` stays for sources
  that record a contact's purpose (decisions 39 and 43); no assignment is made for a Sutton record. CQ-P03 is O12.
- **What `recordOf` points at** (decision 125): a person when a Sutton `Company`'s `kind` is `individual`, an
  organization when it is `company`. No decision states `recordOf`'s declared range: report 13 gives it none, report
  04 "a party in slice 1 (pending decision 12); CQ-I10 later needs other referents too", and decision 12's Reverse
  speaks of properties that would use `Party`. The brief's sketch names `Party` as the range of `decidesOn`; reports
  06 and 13 and report 04's CQ-P04 give `SourceRecord`, and the brief's "once the fixture calls `test_AcmeA` and
  `test_AcmeB` parties" meets report 04's fixture, where they are records "not organizations". Both ranges are O17.
- **The email's route** (O6). The brief and report 06 reach the email through the person,
  `membershipOf/^accountOf/accountEmail`: two node steps, which the lift and gate 5 refuse, through a person node O5
  does not mint. O6 recommends a property from `Member` to `SignInAccount` instead, one node step.
- **The flags are closed** (decision 35): each flag is true or false and each classified field holds a concept. The
  brief's "pending Q35" is stale. CQ-P02's open-reading fixture stays its must-fail although the import would never
  store such a record, and the closure's SHACL still waits for slice 2.
- **Every query walks `rdf:type/rdfs:subClassOf*`** (decision 27), CQ-P06 and CQ-P11 included, so gate 8 loads the
  generated OWL file beside each fixture.
- **The fixtures' home** is the packet (decision 36). The brief's Map names `explorations/erp-ontology/assets/requirements/`
  and leaves the home to this goal; the `cq/` folder under it is this goal's choice. The folder is named among the
  inputs of the ontology package's `test` task. The `reason` task is never cached (`packages/ontology/turbo.json`),
  so the Map's "must miss both caches" applies to `test` alone; `reason` reads its fixtures through the imports of
  `src/Reason.ts`. Report 14 section 6.10's "no question file under `explorations/`" was the thread's; its fixture
  stays in `packages/ontology/fixtures/cq/`.
- **The term model widens by answered decisions**: nine kind tags (18), category parents (12), deprecation (33), and
  the classification properties under `gist:isCategorizedBy` (16 and 17, which report 10 section 6 had left
  unwritten pending 17). Metamodel facts stay out of the Turtle (19). The brief's Map puts "the rest of the term
  model", V1 to V26, in slice 1; this goal builds the parts its terms and the answered decisions need, and which of
  the rest comes now is O18.
- **The goal's name.** The Map names every slice-1 row's goal "`erp-vocabulary`, slice 1"; that goal is done. This
  goal is slice 1 as a goal of its own, the shape report 17 section 7 proposes and leaves to Benjamin: O19.

## Sutton's party records

Report 17's slice-1 row, with its forward-pointer rule: a field that points at a record of a later slice is placed
when that slice lands (O3). Names only (decision 123). Every term named here enters with O1's accepted text. The whole
table is the agent's proposal until O3 and O14 are answered.

| Sutton type | Term | Placed in this slice | Left for a later slice | No term (O14) | Waits on |
| --- | --- | --- | --- | --- | --- |
| `Company` | the tenant's `SourceRecord`, whose `recordOf` is a `Person` when `kind` is `individual` and an `Organization` when it is `company` (125) | `id` (`sourceId`); `kind` (chooses the class, no property); `type` (`isCustomer`, `isVendor`, each true or false: 34, 35, 89) | `customFields`, `files` (8) | `logo`, `notes`, `website` | `name` (O4); `status` (O2); `addresses` (O10); `contacts`, `primaryContact` (O11) |
| `Contact` | the tenant's `SourceRecord`, whose `recordOf` is a `Person` | `id` | `customFields` (8) | `notes`, `dateCreated` | `fullName`, `firstName`, `lastName`, `jobTitle` (O4, O5: they describe the person); `email`, `phone`, `phoneExt`, `addresses` (O10); `company`, `type`, `owners` (O11) |
| `Address`, on a company or contact | the address term of O10 | none before O10 | `customerPaymentTerm`, `vendorPaymentTerm` (2); `customFields` (8) | none | every other field (O10) |
| `Organization` | a `SourceRecord` whose `recordOf` is the tenant's `Organization`, `inTenant` this repository's tenant (P1) | `id` | `defaultCurrency`, `defaultUom` (2); `addresses`, as sites (4); `activeAccountingIntegration`, `hasAccountingIntegration`, `hasActiveAccountingIntegration`, `customFields`, `files` (8, with the integration links of 128) | `features`, `sidebarNavigationLayouts` (settings and layouts: 128); `accountType`, `billingStatus`, `status`, `portalCount`, `whitelabel`, `clerkOrganizationId`, `accessExpiresDate`, `domain`, `logo`, `replyToEmail`; and, as rules of the terms they govern (128), `moduleSettings`, the prefixes, the alert and portal settings, `orderRequestInstructions` and `shippingPreventOverPicking` | `name` (O4); `members`: a path from the record through `recordOf` to the tenant and back along `membershipIn` to each `Member`, two node steps, which the lift and gate 5 refuse today (O5) |
| `OrganizationMember` | `Member`, in the access context (37), from the invitation (P2) | `profile` (its part, below) | `customFields` (8) | `isOrgCreator`, `settings` | `id` (O1); `user` (O6) |
| `UserProfile` | part of the `Member` (report 17 Appendix A, disputed in its section 5) | `status` (`membershipStatus`, P2; its `suspended` value is O9) | `role`, `assignedLocations`, `includesUnassignedLocations` (4) | `heardAboutUs`, `firstLogin` | `id` (O1, with `OrganizationMember.id`: that the two are equal was seen on one empty trial workspace only, report 17 section 8); `fullName`, `firstName`, `middleName`, `lastName`, `jobTitle`, `image`, `about` (O4, O5: the readers say they describe the person); `email`, `user` (O6); `personalEmail`, `phoneNumber`, `phoneNumberExt`, `personalPhoneNumber` (O10); `startDate`, `endDate` (O8) |
| `User` | the sign-in account (O6) | none before O6 | none | `isDigitAdmin`, `username` | `id` (O6) |
| `CurrentUser`, `CurrentUserOrganization` | views of the sign-in account and the `Member`, no term of their own (report 17 Appendix A) | none of their own: a field takes the placement of the field it views | none | `canManageRoles` (derived from the admin role), `impersonatedBy`, `isDigitAdmin` (Sutton's support mechanics), `username` (as `User`'s), `clerkOrganizationId` (the sign-in provider's key) | `id`, `email` as the sign-in account's (O6); `organizations` and `memberStatus` as the memberships' and `UserProfile.status`'s; `name` and `status` as `Organization`'s; the two types are in no slice row of report 17 (O3) |

Enums: `CompanyKind` chooses a class and is no scheme; `CompanyType` is the two flags; `MemberStatus` is P2's stage
(O9); `CompanyStatus` (O2), `ContactType` (O11) and `AddressType` (O10) wait; `OrganizationAccountType`,
`OrganizationBillingStatus`, `OrganizationStatus` and `MslAlertFrequency` belong to fields with no term.

Some field names in the table (`activeAccountingIntegration`, `hasActiveAccountingIntegration`,
`sidebarNavigationLayouts`, `accessExpiresDate`, `replyToEmail`, `orderRequestInstructions`,
`shippingPreventOverPicking`, `phoneExt`, `phoneNumberExt`, `personalEmail`, `personalPhoneNumber`, `dateCreated`) are
in no report and not in `readings.json`. They were read from Sutton's API schema on 2026-11-26, which decision 123
keeps outside the repository, so the packet cannot check them.

## Open, Benjamin's

No decision answers these. Each recommendation is the agent's and nothing is built on it. They go to Benjamin at most
four a round, most consequential first. A question no open decision asks is moved into the exploration's Open table
when the slice that needs it is specified (report 17 section 6), and a goal links to the exploration's
decisions: before they are put, each row is entered there under a whole number of its own, and this table then
links to those rows (PLAN step 6).

| # | Question | Options | Recommended | Evidence | Waits on it |
| --- | --- | --- | --- | --- | --- |
| O1 | How are slice 1's terms accepted, and with what text? And does a thread term whose parent or tag changes, but not its text (`Person` and `Organization` under `Party`, 12; `grantScope` under `gist:isCategorizedBy`, 16 and 17), name the accepting decision? | (a) A design report gives each new term's label, definition, tag, parents, identity criterion and gist names, the changed `Member` (P2's widened definition, and its criterion for a Sutton member's id), `Party`'s exception entry and the ranges O17 answers; one decision accepts them as a set and each names it, as 111 did; (b) each term names the decision that shaped it (34, 12, 125); (c) the auditor's `rat-` records (32). For a changed parent: (d) the term keeps 111, and the accepting decision lists the new links, which 12 and 17 already rule; (e) the term names the accepting decision, as `Member` does | (a) and (d) | Decision 107 amends 32 and 101 "for the thread" only. Gate 4's C12 reads `### <n>. ` headings and a ratification is a whole number, so P1, P2 and `### 39 and 43.` cannot be named (`Rules.rules.ts`, `Model.schema.ts` of `@beep/vocabulary`). No report holds the text with 103, 104, 108, 125, 126 and P2 applied. Decision 97 has each exception entry ratified by Benjamin. The constraints ask a decision before a parent changes; 12 and 17 are those decisions, and `Terms.vocab.ts`'s header says every parent is 111's text, so either answer changes that header | PLAN steps 8 to 14 |
| O2 | Which terms does the module take beyond the brief's list, and how does a property enter that no enrolled record marks and no question reads? | (a) The brief's list; the stage scheme and `membershipStatus` (P2); the address terms of O10 (126); and a term for each field of report 17's slice-1 types that points at no later slice and is no setting, `accountStatus` on the tenant's `SourceRecord` with `AccountStatusScheme` among them (124, 128); each such property stated on a named fixture of its own, read by guard 3 and gate 9 and by no question: `model-call.ttl` for `callPurpose`, `calledFor` and `calledAt`, `sutton-party.ttl` for the coverage's; (b) the brief's list with P2's and 126's terms only; (c) report 06 whole; (d) as (a), each such property left out until a record or a question reads it | (a) | Decision 124 lifts the brief's limit; `CompanyStatus` matches `AccountStatusScheme` (readings.json); report 10 section 4.29 puts status on the tenant's record, report 06 on the organization (report 17 section 4). P11 refuses a property no mark names that states no evidence (`Pointers.rules.ts`), guard 3 one with `evidence: "fixture"` that no hand-written triple states (`Fixture.rules.ts`). `ModelCallPurpose` is a literal (`ModelAllowance.gateway.ts`); the record that holds a call's `purpose`, `actor` and `at` is the access model's `Reservation` (`AllowanceStore.store.ts`), and the boundaries law lets the ontology package read kernel and contract packages only | Steps 8, 9 to 12, 14; the coverage table |
| O3 | Is report 17's slice-1 row, with its forward-pointer rule, this goal's Sutton scope? | (a) Yes, with `CurrentUser` and `CurrentUserOrganization` covered as views and Sutton members given no grant until slice 4; (b) the brief's records only; (c) map `UserProfile.role` now, as a grant at organization scope | (a) | Decision 124: report 17's slicing "is not ruled on". P2 keeps an invitee's role and locations; report 17 maps them in slice 4, where roles and sites get terms. Sutton's roles are `FULL_ACCESS_USER`, `MANAGER`, `SHOP_FLOOR_OPERATOR` and a tenant's custom ones (report 16 finding I); `MemberRoleScheme`'s notations are viewer, editor and admin (`Terms.vocab.ts`) | Step 14; the coverage table |
| O4 | Which property carries a name? | (a) `inv:name` as a sub-property of `gist:name`, written through the gist super-property field that decision 17 already needs (rule C9); (b) `gist:name` used directly (report 06); (c) `inv:name` with no gist link | (a) | Report 13 keeps `name` "only as a stored sub-property" of `gist:name`; decision 16 allows the link where domain and range fall under the gist property's, and `gist:name`'s are not in the repository (PLAN, "What the design left unchecked"). Not open: decision 17 keeps the classification properties under `gist:isCategorizedBy` (decision 16), so the metamodel's field, rule C9 and the projector's `rdfs:subPropertyOf` are built in steps 1 and 2 whatever this answer is | Step 7 (the name's link); 11 (names) |
| O5 | Which node does a path through the person name? And how is `Organization.members` placed, two node steps through `recordOf` and back along `membershipIn`? | (a) The lift writes no person node: the path is checked by gates 5 and 7 and the name is stated on fixtures by hand, as `Person.role` was in the thread; (b) a node minted from the member's IRI; (c) one minted from the sign-in account's id. For `members`: (d) no path of its own: each listed member is a `Member` whose `membershipIn` is the record's tenant, the fact placed once from the member's side; (e) the lift and gate 5 take two node steps, which also opens O6 (b); (f) left for slice 4 with the members' roles | (a) and (d) | No record holds the human's id (report 14 section 3.3). Decision 104: "An account or a member id never identifies a person"; (b) gives one person per membership, against the thread's one person in two tenants (decision 94). `Lift.ts` refuses "a path is at most one node step and then one value step", `Pointers.rules.ts` "a path takes one node step at most"; report 06 leaves `hasMember` out, its reverse being `^membershipIn` | Step 11 (CQ-P06 with the name); the coverage table's person fields and `Organization.members` |
| O6 | How does a membership reach its sign-in account and email? | (a) `SignInAccount` with `accountEmail` and a new property from `Member` to it, read from the member's account; `Person.email` its path, one node step; (b) `membershipOf` / reverse `accountOf` / `accountEmail`, two node steps through the person | (a), against the brief (above, "The email's route") | The brief and report 06 give (b): the email is `accountEmail`'s, whose domain is `SignInAccount`, "and the person is reached by `accountOf`"; report 06 writes `membershipOf/^accountOf/accountEmail`. The `member` table's `userId` and Sutton's `OrganizationMember.user` both link a membership to an account; report 06 has no such property. The lift refuses a path of two node steps (`Lift.ts`), and (b) meets O5. Keeping `Person.email` deferred is no option: decision 100 has this slice place it, and `noTerm` defers to `party` only (`Terms.pointer.ts`, P9) | Step 11 (CQ-P06 with the email) |
| O7 | How is `Activity`'s agent placed, and how is `AgentRun` enrolled with no id? | (a) A new property from `AuditEntry` to `AgentRun`, then `agentName` on the run (decision 45); gate 5's P4 lets a record whose class stores no id name it on the record alone, and the lift refuses it; (b) as (a), with the lift minting the run's node from the audit entry's id instead of refusing it | (a) | Report 06 gives `AgentRun` no stored id and no link from an entry; rule P4 asks exactly one field to name the class (`Pointers.rules.ts`); `AgentRun.schema.ts` has `agent` and `maxRole` only. Decision 45 puts the agent's name on the agent run, so `agentName` on `AuditEntry` is no option, and decision 98 has this slice place the field, so keeping it deferred is none either | Steps 7, 11 |
| O8 | What does CQ-P07 count as "an admin who is not removed", and do `startDate` and `endDate` give `joinedAt`? | (a) A member whose stage is active; no `removedAt` term while no enrolled record holds it; the repository's members state no stage, so fixtures state it; `startDate` and `endDate` get no term until read; (b) any stage but revoked; (c) `removedAt` absent | (a) | P2 rules the stage, not P07's reading; report 17: a pending invitee "cannot yet act". The kernel's `Member` has no status or `removedAt` field (report 10 section 4.29). Whether Sutton's dates are employment dates was not checked | Step 11 (CQ-P07) |
| O9 | Does P2's stage scheme take a fourth concept, `suspended`? | (a) Yes, a proposal amending P2: decision 101 makes a concept added later to a ratified scheme a proposal of its own; (b) read as revoked; (c) a Sutton member in it waits. (b) and (c) keep P2 as answered | (a) | `MemberStatus` has active, pending, revoked and suspended; `RoleDetails.memberCount` counts "invited and suspended members"; P2 names three | Steps 8, 11 |
| O10 | Where do a party's addresses and contact points hang, and what holds an address's purpose? | (a) `PostalAddress` keyed by its id within the tenant, reached from the tenant's `SourceRecord`; a new property for its purpose over `ContactPurposeScheme` widened to ship_from, manufacturing and other; `defaultFor` for the default flags; contact points likewise; `countryCode` only once a person accepts the code read from Sutton's free text; (b) as (a) with a new address purpose scheme; (c) on the `Party`, as report 06 has it | (a) | Decision 126 adds "a property for an address's purpose". Report 17 section 4: an address carries the tenant's own terms and defaults, which decision 34's reason puts on the tenant's record. `AddressType` holds billing, manufacturing, other, ship_from, shipping; report 10's scheme speaks of a contact assignment | Steps 8, 12 |
| O11 | How does a Sutton contact link to its company, and what are its `type`, `owners` and the company's `primaryContact`? | (a) A property from the contact's record to the company's, with no purpose; a `ContactTypeScheme` of Sutton's four values; a property from the contact's record to a `Member`; `primaryContact` a property between the two records; (b) no term for the four | (a) | Decision 126 forbids a made-up assignment and says nothing of these; readings.json proposes the scheme and the owner property; decision 37 puts contacts and members in two contexts | Steps 8, 12 |
| O12 | What does CQ-P03 read under decision 126? | (a) Each `ContactAssignment`, as the brief writes it, on fixtures of a source that records a contact's purpose; decision 126's `test_Northwind Foods` gives no row; (b) rewritten to read purposes from addresses too | (a) | Decisions 39 and 43 "stand for sources that record a contact's purpose"; under decision 87 a question only Sutton's data can answer blocks no slice | Step 12 (CQ-P03) |
| O13 | Does slice 1 take `Permission` and `permits`? | (a) No: with roles in slice 4; (b) yes | (a) | Decision 41 left `Permission` to this slice and the brief "settled when it is specified"; no repository record or slice-1 question reads one; report 17 puts `Permission` in slice 4 | Non-goals |
| O14 | Do the Sutton fields listed under "No term" get none? | (a) No term, listed here, each reversible by adding one property; (b) a property each | (a) | Decision 128 rules on types: settings and layouts get none. Report 17's readers give logo, notes, website, `isOrgCreator`, `heardAboutUs`, `firstLogin`, `isDigitAdmin` and `clerkOrganizationId` none; where they were silent the table proposes (PLAN, "Choices made"); decision 22 covers repository records only | Step 14 |
| O15 | Does slice 1 build report 05's alignment schemas (`AlignmentRow`, `NamedExternalTerm`, `Confidence`)? | (a) No: with the alignment file; (b) yes, unused, as the Map's term-model row lists | (a) | Decisions 29 and 31 already fix what `NamedExternalTerm` and `Confidence` are; this row asks only when they are built. The thread's rule: a metamodel part "comes back with the slice that needs it" (erp-vocabulary PLAN); the brief puts the alignment file out of slice 1 | Non-goals |
| O16 | How often does the version move? | (a) Once for the goal, to `0.2.0`, with one release line; (b) at every commit that changes a generated file | (a) | Decision 24 says "any change advances `y`" and is silent on a branch's commits; nothing reads the version before a merge | Step 9 |
| O17 | What do `recordOf` and `decidesOn` range over? | (a) `recordOf` over `Party`, widened when a later slice gives it other referents; `decidesOn` over `SourceRecord`; (b) `recordOf` with no declared range, as decision 91 (a) recommends for `performedBy`, each record saying which class it takes; `decidesOn` over `SourceRecord`; (c) both over `Party`, as the brief's sketch has `decidesOn` | (a) | Decision 125 says what `recordOf` points at, not its range; report 13 declares none; report 04: "CQ-I10 later needs other referents too". The metamodel requires an object property's range (`ObjectPropertyTerm.range`, C8), so (b) changes the metamodel. Reports 06 and 13 and report 04's CQ-P04 fixture give `decidesOn` `SourceRecord` | Steps 7, 8, 9, 10 |
| O18 | How much of report 05's term model does slice 1 build? | (a) What its terms and the answered decisions need, plus V18's refusal of an identity criterion resting on a name or an email, since CQ-I08 is a must question and slice 1 writes new criteria; the rest (V16's disjoint groups, which the metamodel does not have, and the alignment rows of O15 among them) comes back with the slice that needs it, each named in the closing note; (b) all of V1 to V26 now, as the Map's term-model row lists; (c) what the terms need, CQ-I08 left for the catalog slice | (a) | Map: "`ClassTerm` ... `DisjointGroup`, `AlignmentRow`, `Vocabulary` ... with `violations` (V1 to V26 ...)", goal slice 1. Gate 4 runs C1 and C3 to C15, with C9, C14 and C15 built in step 1; C2 is held by decoding (`Rules.rules.ts`); the thread built only what its terms used. Report 04's CQ-I08 (must) fails `Organization`'s criterion written on `name` (05's V18); the metamodel's criterion is a sentence, with no `restsOn` field. V17 as report 05 writes it gives a role with no local parent `notApplicable`, where C11 refuses such a role; C11 stands | Step 7 |
| O19 | Is slice 1 a goal of its own? | (a) Yes, `goals/party-slice`, one goal per slice as report 17 section 7 proposes; (b) slice 1 as a second part of `goals/erp-vocabulary`, as the Map's goal column has it | (a) | Report 17 section 7: "Not built, and Benjamin's to accept or refuse", then "One goal per slice". No decision records his acceptance; his "Yes, spec slice 1" asked for the specification, not for its home. `erp-vocabulary` is done | This file's home; step 15's Map correction |

## Acceptance

Each line names what proves it; one marked "waits" holds only once those rows are answered.

- [ ] The metamodel takes decision 18's nine kind tags with the tag and identity agreement the metamodel can hold
      (stated or inherited, none on a category; C11 stands); local category parents beside one identity-bearing
      parent with no identity criterion on a category, and C3's cycle walk following category parents (12); a
      deprecation whose replacement rules (report 05's V14) do not fail an earlier replacement when its successor
      retires (33); the gist super-property field for a property, gist properties on the gist list with the domain
      and range C9 compares, and rule C9, on gist lists planted in the tests (16, 17); and `xsd:boolean` in the RDF
      registry. Each refused on a planted mistake in `@beep/vocabulary`'s tests, in `bun run check`; the module's
      own gist list gains no property in this step. Which other parts of report 05 come now waits on O18.
- [ ] Gate 5 takes the same constructs: `lineage` and `domainFits` follow category parents, so a `Person` record
      filling a property whose domain is `Party` passes; P8 passes a retired notation kept in a record's `Literals`
      (V12, 33); a term pointer at a deprecated term is refused (V14): `Pointers.test.ts`, on in-memory vocabularies,
      each with a planted mistake.
- [ ] On in-memory copies of the vocabulary, the projector writes one `rdfs:subClassOf` per category parent, the three
      deprecation triples with no logical axiom on the retired term, `rdfs:subPropertyOf` to a gist property with
      that property's declaration, and boolean and date-time literals; gate 3 refuses each new predicate, and a gist
      subject typed a property, while its list lacks it: `Generated.test.ts`. No kind tag, identity criterion, scope
      or ratification reaches the Turtle (19), nor a gist property's domain or range (16).
- [ ] The lift writes a literal for a datatype property, none for an absent `Option` and one for a present one, a
      date-time in its encoded ISO form, and a boolean on a planted struct; it lifts `Person.role` to its `Grant` with
      the tenant given beside the rows (PLAN, "Choices made"): `Lift.test.ts`.
- [ ] Every query walks `rdf:type/rdfs:subClassOf*`; CQ-P06, its mutant M5 (still differing from the question by its
      join alone) and CQ-P11 return their rows unchanged over their fixture and the OWL file, and a planted query
      written `a inv:Organization` misses a node typed only `inv:Tenant`; an ASK runs through a boolean runner with
      its own refusal test; guard 3 reads every hand-written fixture, not CQ-P06's alone: `Questions.test.ts`, in
      `bun run check`.
- [ ] The party fixtures and queries are under `explorations/erp-ontology/assets/requirements/cq/`, named in the
      `test` inputs of `packages/ontology/turbo.json`; an edit to a fixture alone changes the `test` task's hash
      (`bunx turbo run test --filter=@inventory/ontology --dry=json`, said in PLAN); `bun run docs:check` passes with
      them there.
- [ ] O1 to O19 are rows of the exploration's Open table, each answer is under a `### <n>. ` heading in its
      `DECISIONS.md`, and report 18 is in its `research/` (PLAN steps 6 and 8): `bun run docs:check`, and C12
      reading the accepting decision's heading (the module's line below).
- [ ] Waits on O4, O7, O17 and O18. What the answers ask of the metamodel and gate 5 (PLAN step 7), each refused on a
      planted mistake in `@beep/vocabulary`'s tests and `Pointers.test.ts`; no generated byte changes.
- [ ] Waits on O1, O2. The module holds the accepted terms and gate 4 passes; `Coherence.test.ts` asserts that each new
      term and `Party`'s exception entry name the accepting decision, and that each thread term names what O1's
      second part says: 111 for all but `Member` under (d).
- [ ] Waits on O1 and O16. `Member`'s definition is the accepted wording; the version is `0.2.0` (`Terms.test.ts`);
      `packages/ontology/RELEASES.md` holds the release line the constraints describe
      (`rg -n '^- 0\.2\.0: the party slice' packages/ontology/RELEASES.md`), marked breaking only from step 11;
      `bun run ontology:write` rewrites the generated files and a second run changes no byte:
      `git diff --exit-code packages/ontology/generated`.
- [ ] Waits on O1 and O2. Every property of the module is named by a mark of an enrolled record or stated by a named
      fixture: gate 5's P11 and guard 3 pass, and under O2 (a) guard 3 and gate 9 read `model-call.ttl` and
      `sutton-party.ttl`.
- [ ] Waits on O1. `AgentRun`, `OrganizationChoice`, `ModelCallPurpose` and `Membership` (`noTerm`, reason screen) are
      enrolled; no field still defers to the party slice; `Pointers.test.ts` (P13 rows) and
      `bun run beep laws ontology-terms` pass; the app's own tests pass unchanged, and the JSON Schema of each record a
      mark changes is the same before and after its step (measured as the thread measured `Activity.json`). The
      placement of `Member.name`, `Member.organizationName` and `OrganizationChoice.name` waits on O4 and O5,
      `Person.email` on O6, and `Activity.agent` and `AgentRun` on O7.
- [ ] Waits on O1. A pointer at a party term that does not exist, and one of the wrong kind, fail the type-check:
      `packages/kernel/test/TermsPointer.types.ts`, under `@ts-expect-error`.
- [ ] Waits on O1. In `Questions.test.ts`, each with its expected rows and the must-fail cases of the BRIEF's "Slice 1
      is done" paragraphs and report 04 sections 3.1 and 4, which this list names and does not replace: CQ-P01
      (`isCustomer` removed from `test_CoPacker`'s record loses the row; `test_SharedCo` is listed for neither tenant;
      an `individual` record is never listed as an organization); CQ-P02 (only flags stated false; the open-reading
      fixture is not listed); CQ-P04, whose expected row is (`test_AcmeA`, `test_AcmeB`, `test_Dana`,
      `2026-11-01T09:00:00Z`, "same tax id") read through `decidedBy`, `eventTime` and
      `citesEvidence/evidenceText`, and the CQ-P05 ASK (two records that share only a name, `test_AcmeC` and
      `test_AcmeD`, give no pair, and on the base fixture the ASK answers false; a reversed decision and the second
      tenant's decisions give no row; `owl:sameAs` added, from a fixture file and never as text in code, and the
      decision removed: no row, and the ASK answers true); the party half of CQ-P09 (a party record with no
      `inTenant`, and one with two: one violation each).
- [ ] Waits on O1 and O12: CQ-P03, one person billing contact at one account and receiving contact at another, each
      purpose at its own account only, and an assignment with no purpose under no purpose. Waits on O1 and O8:
      CQ-P07, one violation when the only admin is removed and one for a tenant with no members, none for
      `test_FlourMill`. Waits on O4 to O6: CQ-P06 with the person's name and the sign-in email, its changed rows
      named in `RELEASES.md`. Each in `Questions.test.ts`.
- [ ] Waits on O1. Gate 9 passes in `bun run check:full` on a run that started the reasoner: each slice-1 fixture is DL-valid and
      consistent, and a fixture whose `SourceRecord` is also typed `inv:Organization` is reported inconsistent (the
      reason decision 34 gives, on the pair the gist projection states).
- [ ] Waits on O3. Each type of the coverage table has its term in the module and each field is placed as the table
      says: a `Coherence.test.ts` assertion that every term the table names is a term of the module.
- [ ] Each new planted mistake fails its own gate and no other (PLAN step 14).
- [ ] PLAN step 15: nothing imports `@inventory/ontology`: `bun run beep laws boundaries`. No package is added:
      `git diff --diff-filter=A --name-only main -- '**/package.json'` prints nothing.
- [ ] PLAN's table of what the design left unchecked has an outcome in every row: `rg -n '\| \|$' goals/party-slice/PLAN.md`
      prints nothing.

## Decisions

In [the exploration's DECISIONS.md](../../explorations/erp-ontology/DECISIONS.md): 8 and 119 (the order, the brief);
1, 3, 34, 103, 104, 125 and P1 (what a party, an account and a workspace are); 35 and 89 (the flags), with 47, a
deferred row of the Open table and no `### 47.` heading; 12, 16 to 19, 27 and 33 (the term model, its queries and
deprecation); 2, 5, 7, 9 to 11, 13 to 15, 20 to 24, 97 and 122 (the stations, gist and marks); 36, 37 and 87
(fixtures, contexts, ranking); 38, 40, 41, "39 and 43" (one heading), 46, 93 to 96, 98 to 101 and 107 to 111 (the
thread's terms, gates, records and acceptance); 115 and 120 (what the audit kept out of the thread, and CQ-P11's rows and must-fail);
44, 45, 126 and P2 (portals, agents, purpose, the stage); 6, 25, 26, 112 to 114, 117, 118 and 121 (the checks, the
reasoner, the RDF engines, the bans, the answer lock); 123, 124 and 128 (Sutton's names and its whole). Decisions 28
to 31 are the alignment file's, with 32's ratified rows; 28 also fixes gate 9's closure as "the OWL file and each
fixture only". Forty-seven are open and this goal waits on none of them; it waits on the nineteen rows above, which
no decision answers.
