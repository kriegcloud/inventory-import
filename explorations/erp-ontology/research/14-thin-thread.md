---
type: Research
title: The thin thread
description: The one specification of decision 8's thin thread as it now stands: its terms, the marks on the real records, the one lift, the one question, gates 1 to 9 with a planted mistake each, the package map, and where each second-review finding is settled.
---

# The thin thread

Design only: nothing here is built. No vocabulary module, no pointer helper, no projector, no generated file, no gate
exists today. TypeScript, Turtle and SPARQL in this document are sketches, not code, and none was compiled or run.
This report is the one specification of the thin thread (decision 8 as amended by decisions 38, 40, 41, 46 and
93 to 115, 117 and 118, as this report uses them). Where reports 04 to 13 or the brief say something else about the
thread, this report is the one to follow; what they say about later slices is untouched.

Two decisions made after this report was last edited change the thread and are not written into the sections
below: decision 120 (gate 8 runs CQ-P11 beside CQ-P06) and decision 121 (five forbidden conclusions, of which the
second adds two reasoner fixtures and a near miss). The goal's [SPEC](../../../goals/erp-vocabulary/SPEC.md) states
both under "Where the goal differs from report 14".

Built on 2026-11-23, on branch `docs/erp-ontology-packet`. The sections below stay the design as last edited, and
"nothing here is built" above is no longer so. The goal's [PLAN](../../../goals/erp-vocabulary/PLAN.md) records what
was built, each choice that differs from a sketch here, and the walk of section 6.11 made on the code. Where the
code differs from the text below:

- Gate 8 runs CQ-P11 too, from `packages/ontology/fixtures/cq/CQ-P11.rq`. This replaces done line item 4, the
  Questions count of section 1.2, section 5.5's "until it is added", and gate 8's row in the gate table.
- Gate 9 makes five runs, two that must be consistent and three that must not, over four files in
  `fixtures/reason/`. This replaces section 1.3's "the only data", section 6.9's two runs, section 6.10's "the
  negative fixture" and row 9 as the only reasoner row of section 6.11. Section 6.8's "none is drafted yet" is
  replaced by the five bans signed in the goal's SPEC.
- `fixtures/negative/` holds seven files: gate 2's one, five gate 3 refuses, and `gate3-subclass.ttl`, the near
  miss of ban 5 that gate 3 passes. Ban 5 added `gate3-hasKey.ttl` and `gate3-inverseFunctional.ttl`.
- The helpers' module is `Pointer.mark.ts`, exported as `@beep/vocabulary/Pointer`, and files are named by role
  (`Terms.vocab.ts`, `Terms.pointer.ts`, `Pointers.rules.ts`). The vocabulary's own test is
  `packages/ontology/test/Terms.test.ts`: gate 7's rule 7 lets only that package load the vocabulary as a value.
- `n3` is a dependency of the ontology package, not a test dependency: `src/Turtle.ts` reads with it.
- Gate 9's workflow, which section 6.10 leaves undesigned, is the job `reason` in `.github/workflows/ci.yml`.

Inputs: the answered decisions in `DECISIONS.md` (8 to 11, 13 to 16, 20 to 26, 32, 34, 38 to 41, 46, 93 to 115, 117,
118), the kernel and access contract files named in section 3 as they stand today, `laws boundaries` as written, the root
`turbo.json`, the vendored `@beep/identity`, the advisory audit in report 15, and Effect 4.1.5 as installed. Every
statement about a file was made with the file open; every Effect API named was read in `node_modules/effect/src`. Section 10 lists what was not checked.

Sixty-three decisions are open (12, 17 to 19, 27 to 31, 33, 35 to 37, 42, 44, 45, 47 to 92 and 116). The thread is designed so
that it rests on none of them. Section 1 says how, for each open decision it comes near.

## 1. Scope

### 1.1 The done line

The thread is done when all of the following hold on a clean checkout:

1. `bun run ontology:write` writes three files and a second run changes no byte:
   `packages/ontology/generated/inventory.owl.ttl`, `packages/ontology/generated/inventory.skos.ttl` and
   `packages/ontology/generated/fixtures/CQ-P06.graph.ttl`.
2. The seven classes, nine properties, two schemes and four concepts of section 2 are in the vocabulary module, each
   naming decision 111, which accepted the 18 terms as a set and the four concepts under their schemes
   (decision 101 as amended by decision 107; section 1.6).
3. The five enrolled records of section 3 carry their marks, every field of each is placed, and each field's mark is
   the one section 3 gives it. Gate 5's rule P13 compares the marks read from the records with those placements,
   field by field, so `Activity` with its actor and tenant pointers the wrong way round fails it (6.5).
4. The one question, CQ-P06, returns the two expected rows of section 5 over a graph in which the role triples come
   from the lift of two decoded `Member` values, read through the `aboutPath` mark on `Member.role`, and from nowhere
   else. Must-fail cases M6 and M7 change that mark and nothing else, and the answer changes with it (5.4); the
   second guard of section 4.4 holds the graph equal to what `lift` returns.
5. Gates 1 to 8 run in `bun run check` and pass. Gate 9 runs in `bun run check:full`, and in a CI job of its own
   (decision 114), and passes, on a run that started the reasoner: its task is never replayed from a cache, and it
   fails when Java is missing or is not Java 17, or when the jar cannot be fetched or does not hash to the approved value
   (6.9, 6.10).
6. Each of the nine gates has one committed test that plants the mistake of section 6 and asserts that the gate
   reports it. That is what "shown failing once" means here: the failure is a permanent test, not a screenshot. The
   further negatives section 6 names for gates 2, 3, 4, 5 and 7 are committed tests too, and section 6.11 walks each
   planted mistake through all nine gates.

### 1.2 What is in

| Part | Count | Where specified |
| --- | --- | --- |
| Classes | 7: `Organization`, `Tenant`, `Person`, `Member`, `Role`, `Grant`, `AuditEntry` | 2.1 |
| Properties | 9: `membershipOf`, `membershipIn`, `grantedTo`, `grantsRole`, `grantScope`, `recordedActor`, `action`, `recordedAt`, `inTenant` | 2.2 |
| Schemes | 2: `MemberRoleScheme`, `GrantScopeKindScheme` | 2.3 |
| Concepts | 4: viewer, editor, admin; organization | 2.4 |
| gist names | 7 classes (5 parents and 2 ancestors), 3 disjoint pairs, no gist property | 2.5 |
| Enrolled records | 5: the kernel's `Member`, `Role`, `Activity`; the access contract's `Person` and `AuditTrail` | 3 |
| Lifts | 1: `Member.role` to a `Grant` | 4 |
| Questions | 1: CQ-P06 | 5 |
| Gates | 9 | 6 |
| New packages | 2: `@beep/vocabulary`, `@inventory/ontology`; two new entries in `@inventory/kernel` | 7 |

### 1.3 What is out

- Every term not in the table above. In particular `Party`, `SourceRecord`, `SignInAccount`, `AgentRun`, `Permission`,
  `PortalAccess`, and the properties `permits`, `name`, `accountEmail`, `joinedAt`, `removedAt`, `agentName`.
- SHACL (gate 11), alignments and SSSOM (gate 12), gate 10, and the `shacl-engine` package.
- Any stored row. No D1 read, no slow test, no migration. The only data is the fixture of section 5.
- The lift of `Activity`. Its fields are placed (decision 98) and checked by gates 4 and 5, but no question reads an
  audit entry, so the thread lifts none.
- The augmentation of `@alchemy.run/domain`'s `Annotations` (decision 20). No enrolled record is an Alchemy block, so
  the thread does not write it. The slice that enrols the first block does.
- Deprecation (open decision 33), a published namespace (decision 7 stands: `example.org`), and release notes beyond
  the first line "0.1.0: the thin thread".
- Any change to the app, a screen, an endpoint or a stored value. Adding an annotation to a schema changes no decoded
  value and no wire format.

### 1.4 Open decisions the thread comes near, and how it stays clear of each

| Open decision | How the thread does not depend on it |
| --- | --- |
| 12, more than one parent and `Party` | No class in the thread has a second parent and `Party` is not a term. The class model has one `parent` field and no category parents. |
| 17, gist typing of schemes | Schemes and concepts are written as SKOS only. Either answer adds triples and removes none. |
| 18, the kind tag's values | The thread uses four values (kind, role, relator, information), which every option of 18 contains. The tag is not written to Turtle. |
| 19, metamodel facts in Turtle | None is written. Tag, identity criterion and ratification stay in the module, where gate 4 reads them. |
| 27, how a question reaches an inferred type | CQ-P06 reads only types the lift and the fixture assert (`inv:Member`, `inv:Grant`). It walks no `rdfs:subClassOf` and needs no reasoned copy. |
| 28, alignments beside the OWL | There is no alignment. The reasoner reads the OWL file and the fixture graph. The SKOS file is not in its input, and the role individuals it needs are typed in the OWL file (2.4). |
| 33, deprecation | No term is deprecated. |
| 36, what data proves the party model | The fixture is decision 8's and 94's, for one question. It proves nothing about parties. |
| 44, the actor of a portal request | `recordedActor` ranges over `Member`, as decision 98 says for the thread. `PortalAccess` is not a term. |
| 45, a software agent class | `Activity.agent` is `noTerm`, reason deferred, naming the party slice (decision 98). |
| 116, how a grant names the location or field it covers | The thread's one scope kind is organization, and the member's tenant says what is covered (decision 115). Each option adds a property or concepts and removes none. |

### 1.5 What is owed from Benjamin before code

Nothing is owed. The reasoner download decision 25 left owed is approved by decision 112: ROBOT v1.9.11, the file
`robot.jar` from `https://github.com/ontodev/robot/releases/download/v1.9.11/robot.jar`, 82,708,624 bytes, sha256
`53cd275c8e4c0dad1fc2c1c34174876795cd7d6b6926e1444adcbb0cb3c7ab26`. It was tried on 2026-11-23 outside the
repository under Java 17.0.2: the OWL 2 DL profile check passed, HermiT found the test ontology consistent, and an
inconsistent one was reported with exit 1. Decision 113 pins Java 17 by its major version. Decision 114 runs gate 9 in
a CI job of its own as well, with the jar restored from a cache keyed by its sha256. Gates 1 to 9 can all be built.

Decision 117 puts three to five forbidden conclusions in the goal's SPEC. The agent drafts them there and Benjamin
rules on each ban then; none is drafted yet, and no gate of this report waits on them (6.8).

The two smaller questions this report raised are answered by decision 100, and by decision 101 as amended by
decisions 107 and 111 (section 9.2).

### 1.6 Decisions 107 to 111: what replaces the `rat-` chain in the thread

The foundational auditor ran twice on the terms of section 2 and its adversary failed every proposal
([report 15](15-audit-findings.md)). Decision 107 makes that audit advisory and amends decisions 32 and 101 for the
thread. Decisions 108 and 109 settle Person's definition and Role's identity; decision 110 keeps Organization.
Decision 111 accepts the 18 terms as a set (7 classes, 9 properties, 2 schemes), plus the four concepts under their
schemes. Each of these 22 terms names decision 111; Role's exception entry names decision 97.

The terms are Benjamin's commitments about what the application means. The audit cannot certify them from code.
Their `ratification` is `{ decision: <n> }`. C12 checks only that the number has a `### <n>. ` heading in
`DECISIONS.md`, read as text. That file is the out-of-package input named in 6.10. Nothing is owed (1.5).

Section 2 as it stands is what decision 111 accepted. A change to a term's text (its label, definition, parent or
identity criterion, in section 2 or in the module) needs a decision, and no gate detects a change made without one.
Decision 101's other clause stands: a concept added later to a scheme needs a decision of its own. C12 cannot see one
that wrongly names 111 (section 10).

The definitions and identity criteria of section 2 carry decisions 103, 104, 108 and 109. A later slice may still
use the auditor and its `rat-` records; that is decided with the slice.

## 2. The terms

Notation used below. `inv:` is `https://example.org/inventory-import/ontology/` (decision 10). `gist:` is
`https://w3id.org/semanticarts/ns/ontology/gist/` (gist 14.1.0, `gist-categories.md`). A key is the local name: the IRI
of class `Member` is `inv:Member`. Labels are `skos:prefLabel` and definitions `skos:definition`, in English, written
with the language tag `en` (decision 11). The kind tag and the identity criterion live in the module only (1.4).

### 2.1 Classes

| Key | IRI | Label | Definition | Tag | Parent | Named ancestors | Identity criterion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Organization` | `inv:Organization` | Organization | An organized body of people or of other organizations formed for a purpose, such as a company the tenant buys from, sells to, ships with or has goods made by, or the tenant itself. | kind | `gist:Organization` | none | Stated: the organized body itself (decision 34), the same organization being the same legal entity; a body with no registration is told apart by its founding (decision 103). No thread record holds it. |
| `Tenant` | `inv:Tenant` | Tenant | An organization for which this application keeps a workspace, whose records are scoped to it and hidden from every other organization. | role | `inv:Organization` (local) | `gist:Organization` | Inherited from `Organization`. In the repository it is told apart by `OrganizationId` (decision 38). |
| `Person` | `inv:Person` | Person | A human being. (decision 108) | kind | `gist:Person` | `gist:LivingThing`, `gist:PhysicalIdentifiableItem` | Stated: the human being, one for life and after death, whatever records name them (decisions 34 and 104). No thread record holds it; the fixture names one. |
| `Member` | `inv:Member` | Member | A relationship between one person and one tenant that lets the person act in the tenant's workspace from the day it is made until it is removed. | relator | `gist:TemporalRelation` | none | Stated, one criterion: the `MemberId` within its tenant, kept after removal. It rests on `Member.id` and `Member.organizationId`. |
| `Role` | `inv:Role` | Role | A named level of access a grant gives a member, such as viewer, editor or admin. | information | none, on the exception list (decision 97) | none | Stated, one criterion: the concept's scheme and notation (decision 41); the named level, the same role when what it permits changes (decision 109). |
| `Grant` | `inv:Grant` | Grant | An assignment of one role to one member at one scope (the whole tenant, one site or one field), made by a member allowed to make it. | relator | `gist:Assignment` | `gist:TemporalRelation` | Stated, one criterion: the member it is granted to and the record field it is read from. In the thread that field is `role`, so a member has exactly one grant. See the note below. |
| `AuditEntry` | `inv:AuditEntry` | Audit entry (altLabel: Activity, decision 46) | A record of one change to a tenant's data, written in the same batch as the change, naming who made it, the agent that acted for them if any, and what was done. | information | `gist:Content` | none | Stated: the tenant and the entry's id. It rests on `Activity.organizationId` and `Activity.id`. |

**`Grant`'s one criterion.** Report 06 gave `Grant` two (an id of its own, and a derivation from the role field). No
grant row and no grant id exist: decision 40 reads `member.role` as one grant, and decision 10 names a lifted node by
its parent's IRI and the field path. So the thread states the second only. The node's IRI is the criterion written
down: `<member IRI>/role` (section 4). When a grant becomes a stored row with an id of its own, the criterion changes
to that id; that is a change after which an answer that held no longer holds, so decision 24 records it as breaking.

**`Role` has no gist parent.** Decision 97 allows it with a stated reason on a committed list that gate 4 compares
against. The list has one entry (section 6, gate 4): class `inv:Role`, reason "Its individuals are the concepts of
MemberRoleScheme; gist:Permission fits once permits exists." `Role` ships without `permits`, and `Permission` is not a
term (decision 41).

**Disjointness.** The projection copies the `owl:disjointWith` pairs gist states between the classes it takes, and no
others (decision 15). For the thread's seven gist classes report 11 found three:

| Pair | What it keeps apart in the thread |
| --- | --- |
| `gist:Organization`, `gist:Content` | An audit entry is never an organization. |
| `gist:Organization`, `gist:PhysicalIdentifiableItem` | A person is never an organization, through `gist:Person`, `gist:LivingThing`, `gist:PhysicalIdentifiableItem`. |
| `gist:PhysicalIdentifiableItem`, `gist:Content` | A person is never an audit entry. |

No pair is stated between `inv:` classes. Report 06's plan of a local `Person` and `Organization` pair, and of pairs
among `Role`, `Grant` and `Member`, is not in the thread: a local pair would make gate 9's planted mistake fail for a
reason other than the copied gist axiom (finding 05-ontology.astra#5).

### 2.2 Properties

Domain and range are the property's own (decision 16 copies none from gist). No gist property is taken in the thread,
so no property has a super-property. Labels are written here; definitions are report 06's except where marked new.

| Key | IRI | Kind | Label | Definition | Domain | Range | Super-property | Filled by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `membershipOf` | `inv:membershipOf` | object | membership of | Links a membership to the human who holds it, independently of any account. | `Member` | `Person` | none | The fixture only. No record holds a human's id (`evidence: "fixture"`, section 6, gate 5 rule 11). |
| `membershipIn` | `inv:membershipIn` | object | membership in | Links a membership to the tenant it lets its person act in. | `Member` | `Tenant` | none | `Member.organizationId` |
| `grantedTo` | `inv:grantedTo` | object | granted to | Links a grant to the member who holds it. | `Grant` | `Member` | none | The lift of `Member.role`, first step |
| `grantsRole` | `inv:grantsRole` | object | grants role | Links a grant to the role it gives. | `Grant` | `Role` | none | The lift of `Member.role`, last step |
| `grantScope` | `inv:grantScope` | object | grant scope | Links a grant to the kind of scope it applies to. (new wording; decision 96) | `Grant` | a concept of `GrantScopeKindScheme` | none | The lift of `Member.role`, a fixed value |
| `recordedActor` | `inv:recordedActor` | object | recorded actor | Links an audit entry to the member it names as having made the change (decision 106). | `AuditEntry` | `Member` (decision 98) | none | `Activity.actorId` |
| `action` | `inv:action` | datatype | action | What was done in the change an audit entry records, in a few words a person reads. (new) | `AuditEntry` | `xsd:string` | none | `Activity.action` |
| `recordedAt` | `inv:recordedAt` | datatype | recorded at | The instant at which an audit entry was written. (new) | `AuditEntry` | `xsd:dateTime` | none | `Activity.createdAt` |
| `inTenant` | `inv:inTenant` | object | in tenant | The tenant whose workspace holds this record, not the owner of the body it describes. | none declared | `Tenant` | none | `Activity.organizationId` |

How each is written to OWL: an object property gets `rdfs:domain` and `rdfs:range` where the cell names a class.
`inTenant` gets no `rdfs:domain`. `grantScope` gets no `rdfs:range`: its range is "a concept of a scheme", which the
module holds and gate 5 checks, and which becomes `sh:in` when the SHACL slice comes. Writing a class there would rest
on open decision 17.

### 2.3 Schemes

| Key | IRI | Label | Definition | Closed | Pointed at by |
| --- | --- | --- | --- | --- | --- |
| `MemberRoleScheme` | `inv:MemberRoleScheme` | Member role | A controlled vocabulary of the access levels a member holds in an organization, ranked by what each may do. | yes | The kernel's `Role` schema |
| `GrantScopeKindScheme` | `inv:GrantScopeKindScheme` | Grant scope kind | A controlled vocabulary of the extents a grant of access covers: a whole organization, one location, or one field. | no: other scopes come with the slice that needs them (decision 96) | No record. Its one concept is the fixed value of the lift |

A scheme has no kind tag, no gist parent and no identity criterion of its own. Its key ends in `Scheme` (decision 10).
The rank of the roles is the rule of `hasRole` in `packages/kernel/src/Role.schema.ts`; it is not written as
`skos:broader`.

### 2.4 Concepts

A concept's IRI is `<namespace><SchemeKey>-<notation>` (decision 10). Its identity criterion is its scheme and its
notation.

| Scheme | Notation | IRI | Label | altLabel | Definition | Also an individual of |
| --- | --- | --- | --- | --- | --- | --- |
| `MemberRoleScheme` | `viewer` | `inv:MemberRoleScheme-viewer` | Viewer | Read only | A member role whose holder may read the organization's records and write none. | `inv:Role` |
| `MemberRoleScheme` | `editor` | `inv:MemberRoleScheme-editor` | Editor | none | A member role whose holder may read and write the organization's records but not manage its people. | `inv:Role` |
| `MemberRoleScheme` | `admin` | `inv:MemberRoleScheme-admin` | Admin | Administrator | A member role whose holder may read and write the organization's records and add, change and remove its people. | `inv:Role` |
| `GrantScopeKindScheme` | `organization` | `inv:GrantScopeKindScheme-organization` | Whole organization | Tenant | A grant scope kind in which the grant covers every record of one organization. | none |

Each role concept is, under the same IRI, an individual of `Role` (decision 41). The two typings are written in two
files, so the reasoner's input holds no punned IRI:

- `inventory.skos.ttl`: `inv:MemberRoleScheme-admin a skos:Concept ; skos:inScheme inv:MemberRoleScheme ;
  skos:topConceptOf inv:MemberRoleScheme ; skos:notation "admin" ; skos:prefLabel "Admin"@en ; ...`
- `inventory.owl.ttl`: `inv:MemberRoleScheme-admin a owl:NamedIndividual, inv:Role .` The scope concept is declared
  there as `owl:NamedIndividual` with no class, because the fixture graph uses it as the object of `inv:grantScope`.

### 2.5 The gist names the thread admits

| gist class | Its gist parent | Why it is taken | In `gist-categories.md` today |
| --- | --- | --- | --- |
| `gist:Organization` | none | Parent of `Organization` | yes |
| `gist:Person` | `gist:LivingThing` | Parent of `Person` | yes |
| `gist:LivingThing` | `gist:PhysicalIdentifiableItem` | Ancestor (decision 14) | yes |
| `gist:PhysicalIdentifiableItem` | none | Ancestor (decision 14) | yes |
| `gist:Content` | none | Parent of `AuditEntry` | yes |
| `gist:TemporalRelation` | none | Parent of `Member` | yes |
| `gist:Assignment` | `gist:TemporalRelation` | Parent of `Grant` | yes |

Each is written as `owl:Class` with its `rdfs:subClassOf` link and nothing else: no label, no definition, no other
axiom (decision 14, "as names and links only"). Where gist states a parent inside an `owl:equivalentClass`
intersection, the projection writes the named operand as a plain `rdfs:subClassOf` (report 11). Decision 13 asks that
a name be added to `gist-categories.md` when it is admitted. That file already has a row for each of the seven, in
bold, with the parents of this table, and states the three pairs of section 2.1 as decision 15's answer, so the
thread changes nothing there. These seven parents and three pairs are report 11's reading of the pinned gist file,
which is kept outside the repository and was not opened for this report (section 10).

### 2.6 The module's shape

A sketch of what the vocabulary value holds, enough to implement from. The metamodel schemas are `@beep/vocabulary`'s;
the value is the kernel's.

```ts
// packages/kernel/src/Terms.vocab.ts (sketch, not code). Public entry: @inventory/kernel/Terms
import type * as S from "effect/Schema"
import type { Vocabulary } from "@beep/vocabulary/Model"

const base = "https://example.org/inventory-import" // the one literal; every other IRI is derived from it

export const vocabulary = {
  base,
  namespace: `${base}/ontology/`,
  version: "0.1.0",
  gist: {
    version: "14.1.0",
    namespace: "https://w3id.org/semanticarts/ns/ontology/gist/",
    classes: {
      Organization: {}, Person: { parent: "LivingThing" }, LivingThing: { parent: "PhysicalIdentifiableItem" },
      PhysicalIdentifiableItem: {}, Content: {}, TemporalRelation: {}, Assignment: { parent: "TemporalRelation" }
    },
    disjointPairs: [["Organization", "Content"], ["Organization", "PhysicalIdentifiableItem"],
                    ["PhysicalIdentifiableItem", "Content"]]
  },
  classes: {
    Member: {
      label: "Member", definition: "A relationship between one person and one tenant ...",
      tag: "relator", parent: { kind: "gist", name: "TemporalRelation" },
      identity: { kind: "stated", criterion: "The MemberId within its tenant, kept after removal." },
      ratification: { decision: 111 }
    },
    Role: { /* ... */ parent: { kind: "none", reason: "Its individuals are the concepts of MemberRoleScheme; gist:Permission fits once permits exists." } },
    Tenant: { /* ... */ tag: "role", parent: { kind: "local", key: "Organization" }, identity: { kind: "inherited" } }
    // Organization, Person, Grant, AuditEntry
  },
  objectProperties: {
    membershipOf: { /* ... */ domain: "Member", range: { kind: "class", key: "Person" }, evidence: "fixture" },
    grantScope: { /* ... */ domain: "Grant", range: { kind: "scheme", key: "GrantScopeKindScheme" } },
    inTenant: { /* ... */ range: { kind: "class", key: "Tenant" } } // no domain
    // membershipIn, grantedTo, grantsRole, recordedActor
  },
  datatypeProperties: {
    action: { /* ... */ domain: "AuditEntry", datatype: "xsd:string" },
    recordedAt: { /* ... */ domain: "AuditEntry", datatype: "xsd:dateTime" }
  },
  schemes: {
    MemberRoleScheme: {
      /* ... */ closed: true,
      concepts: {
        viewer: { /* label, altLabel, definition */ ratification: { decision: 111 }, alsoInstanceOf: "Role" },
        editor: { ratification: { decision: 111 }, alsoInstanceOf: "Role" },
        admin: { ratification: { decision: 111 }, alsoInstanceOf: "Role" }
      }
    },
    GrantScopeKindScheme: { /* ... */ closed: false, concepts: { organization: { ratification: { decision: 111 } } } }
  }
} as const satisfies S.Codec.Encoded<typeof Vocabulary>
```

Every class, property, scheme and concept has `ratification: { decision: 111 }`, including the entries whose
fields the sketch omits. Decision 111 accepts the 18 terms as a set and the four concepts under their schemes
(decision 101 as amended by decision 107). Role's term names 111; only its exception entry names 97 (6.4).

The value is a literal kept `as const` and checked with `satisfies` against the encoded side of the metamodel's
`Vocabulary`, as report 05 section 4.7 writes it, with one change. Report 05's `Ratification` is a string that names
a `rat-` record. In the thread it is `{ decision: <a whole number> }` on every class, property, scheme, concept and
exception entry (decisions 107 and 111), so a number with no heading decodes and compiles, and only C12 refuses it
(6.4). Report 05 is not rewritten. It is not built with `Vocabulary.make`. `make` returns the schema's
declared `Type`, never the type of its argument (`Schema.ts` 240), and the metamodel declares the term tables as
`S.Record` (report 05 section 4.6), so the keys of a made value are `string`: `keyof typeof vocabulary.schemes` would
be `string`, and every name type below would accept any text. Both imports in the sketch are type-only, so the file
still holds the value and nothing else.

Every registry type and name type below is derived from this literal and from nothing else. Gate 4's test and the
projector decode the same literal through `Vocabulary`, strictly (`onExcessProperty: "error"`, every error
reported, report 05 section 4.6), and work on the decoded value; no type is derived from the decoded value.

Three rules of this shape settle review findings:

- **One literal for the base.** The namespace, the two document IRIs, the data layer and the fixture layer are derived
  from `base` (finding 10-evolution.astra#5). Gate 7's rule 5 allows that literal in this one file.
- **Concepts are keyed by notation.** The type of a concept's name is derived from the keys, so a misspelt notation
  does not compile (finding 10-evolution.astra#4):

  ```ts
  type Schemes = typeof vocabulary.schemes
  export type InvConceptCurie = {
    [K in keyof Schemes & string]: `inv:${K}-${keyof Schemes[K]["concepts"] & string}`
  }[keyof Schemes & string]
  // "inv:MemberRoleScheme-viewer" | "inv:MemberRoleScheme-editor" | "inv:MemberRoleScheme-admin"
  //   | "inv:GrantScopeKindScheme-organization"
  ```

- **The kinds are separate registries.** `InvClassVocab`, `InvPropertyVocab` and `InvSchemeVocab` are each a
  `VocabShape` of `@beep/identity/Vocab` (`{ inv: { iri, terms } }`), derived from the keys of `classes`, of the two
  property records and of `schemes`. `Curie<InvClassVocab>` is then the union `"inv:Organization" | ...`, and a helper
  typed with it refuses a property's name.

## 3. The records and their marks

### 3.1 The three annotation keys and the six positions

Decision 20 as corrected: `aboutClass`, `aboutProperty` and `aboutScheme` write one annotation key, `term`.
`aboutPath` writes `path`. `noTerm` writes `noTerm`. A position holds exactly one of the three keys.

Effect keeps two separate annotation stores on a schema, and the design uses both:

- **Schema annotations**, written by `S.annotate` (and by `$I.annoteSchema`, which calls `self.annotate`,
  `packages/foundation/modeling/identity/src/Id.ts` 1910 to 1917). They sit on the AST node, or on its last check when
  it has checks (`SchemaAST.ts` 4424 to 4430), and are read with `S.resolveAnnotations` (`Schema.ts` 19218 to 19222;
  `internal/schema/annotations.ts` 6 to 8).
- **Key annotations**, written by `S.annotateKey` on a schema used as a struct field. They sit in
  `ast.context.annotations`, a later call merging into an earlier one (`SchemaAST.ts` 4546 to 4556), and are read with
  `S.resolveAnnotationsKey`, which returns `schema.ast.context?.annotations` and nothing else (`Schema.ts` 19232 to
  19234).

| Position | Store | Helper | Meaning |
| --- | --- | --- | --- |
| A record | schema | `aboutClass("inv:X")` | A value of this record describes one instance of class X. |
| A record or schema that stands for no term | schema | `noTerm(reason)` | Decision 21. Not used at record level in the thread. |
| A `Literals` schema | schema | `aboutScheme("inv:XScheme")` | Each literal is the notation of a concept of the scheme (decision 23). |
| A field, the subject's id | key | `aboutClass("inv:X")`, X the record's own class | The field's value is the `<id>` part of the node's IRI. No triple is written for it. |
| A field, one property | key | `aboutProperty("inv:p")` | One triple: subject, `inv:p`, the value. |
| A field, a path | key | `aboutPath([...])` | The lift of section 4. |
| A field with no term | key | `noTerm(reason)` or `noTerm("deferred", slice)` | Decisions 21 and 98. |

Two findings are settled by this table:

- **A top-level `Literals` schema has a slot** (01-gates.fable#6, 05-ontology.astra#3). `Role` is not a field, so it
  has no key store; its scheme pointer goes in its schema annotations. When `Role` is then used as a field
  (`role: Role.pipe(S.annotateKey(...))`), the field's AST is the same union node with a context added, so the field
  shows two things in two stores: the scheme in `annotations.term`, and the field's own mark in
  `context.annotations`. Neither overwrites the other.
- **Id fields are placed** (06-testing.fable#8, 03-schema.grok#2). A subject's id is not a property and not
  bookkeeping: `Member`'s identity criterion is the `MemberId`. It takes the fourth position. Gate 5 requires exactly
  one such field in a record that points at a class. The finding's condition that an id is recognised by `isUUID` is
  wrong for this repository: `MemberId` and `OrganizationId` are `IdText`, the pattern `^[A-Za-z0-9_-]{1,64}$`, and
  only `ActivityId` and `RequestId` are UUIDs (`packages/kernel/src/Ids.id.ts`). The rule here reads a mark, never the
  shape of the value.

Gate 5 reads a field's mark from the key store only. A field whose schema is itself an enrolled record
(`actor: Member`) would otherwise look pointed by that record's own class pointer.

The six `noTerm` reasons are transport, request, screen, error, bookkeeping (decision 21) and deferred (decision 98).
Deferred takes the name of the slice that will place the field; the thread writes one slice name, `party`.

### 3.2 The helpers

```ts
// packages/foundation/modeling/vocabulary/src/Pointer.ts (sketch). Entry: @beep/vocabulary/Pointer
import type { Curie, VocabShape } from "@beep/identity/Vocab"

export const pointerFor = <const V extends VocabShape>() =>
  <const C extends Curie<V>>(term: C): { readonly term: C } => ({ term })

export interface FixedConcept<P extends string, K extends string> { readonly property: P; readonly concept: K }
export interface NodeStep<C extends string, P extends string, K extends string> {
  readonly property: P
  readonly reverse?: true          // the new node is the subject of the triple, the parent its object
  readonly node: C                 // the class of the new node
  readonly fixed?: ReadonlyArray<FixedConcept<P, K>>
}
export interface ValueStep<P extends string> { readonly property: P }
export type LiftPath<C extends string, P extends string, K extends string> =
  readonly [...ReadonlyArray<NodeStep<C, P, K>>, ValueStep<P>]

export const pathFor = <C extends string, P extends string, K extends string>() =>
  <const Path extends LiftPath<C, P, K>>(path: Path): { readonly path: Path } => ({ path })

export type NoTermReason = "transport" | "request" | "screen" | "error" | "bookkeeping"
export const noTermFor = <Slice extends string>(): {
  (reason: NoTermReason): { readonly noTerm: { readonly reason: NoTermReason } }
  (reason: "deferred", slice: Slice): { readonly noTerm: { readonly reason: "deferred"; readonly slice: Slice } }
} => /* ... */
```

```ts
// packages/kernel/src/Terms.pointer.ts (sketch). Entry: @inventory/kernel/TermsPointer
import { noTermFor, pathFor, pointerFor } from "@beep/vocabulary/Pointer"
import type { Curie } from "@beep/identity/Vocab"
import type { InvClassVocab, InvConceptCurie, InvPropertyVocab, InvSchemeVocab } from "./Terms.vocab.ts"

export const aboutClass = pointerFor<InvClassVocab>()
export const aboutProperty = pointerFor<InvPropertyVocab>()
export const aboutScheme = pointerFor<InvSchemeVocab>()
export const aboutPath = pathFor<Curie<InvClassVocab>, Curie<InvPropertyVocab>, InvConceptCurie>()
export const noTerm = noTermFor<"party">()
```

The foundation package knows no term of this repository: `pathFor` takes the three name types as parameters and the
kernel supplies them. That is the whole answer to finding 02-architecture.astra#1 (section 7.2). The kernel's import
of `Terms.vocab.ts` is `import type`, so the vocabulary value is erased from every file that marks a record, as
decision 9 requires.

Effect's `Annotations` interfaces carry an index signature (`readonly [x: string]: unknown`, `Schema.ts` 19314), so
the three keys need no augmentation of `effect/Schema`.

### 3.3 `Member` (`packages/kernel/src/Member.schema.ts`)

`Member` is an `S.Opaque` class over `S.Struct({...}).pipe($I.annoteSchema("Member", { description }))` with exactly
five fields. It has no email field and no person id (findings 02-architecture.astra#3, 03-schema.grok#2,
04-effect.grok#1, 05-ontology.astra#4, 07-provenance.astra#2, 08-docs.fable#4, 09-reuse.grok#1: all true of the
earlier reports, and decision 93 already records the correction). Each field is already
`X.pipe(S.annotateKey({ description }))`; the mark joins that object.

| Field | Schema today | Mark | Decision |
| --- | --- | --- | --- |
| (the record) | `S.Struct` annotated by `$I.annoteSchema("Member", ...)` | `...aboutClass("inv:Member")` in the `annoteSchema` extras | 8 |
| `id` | `MemberId` | `...aboutClass("inv:Member")`: the subject's id | 3.1 |
| `name` | `DisplayName` | `...noTerm("screen")` | 93 |
| `role` | `Role` | `...aboutPath([...])`, the lift of section 4 | 40, 96 |
| `organizationId` | `OrganizationId` | `...aboutProperty("inv:membershipIn")` | 38 |
| `organizationName` | `DisplayName` | `...noTerm("screen")` | 93 |

```ts
// sketch of the changed lines
role: Role.pipe(S.annotateKey({
  description: "What this member may do in this organization",
  ...aboutPath([
    { property: "inv:grantedTo", reverse: true, node: "inv:Grant",
      fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-organization" }] },
    { property: "inv:grantsRole" }
  ])
})),
organizationId: OrganizationId.pipe(S.annotateKey({ description: "...", ...aboutProperty("inv:membershipIn") }))
```

`membershipOf` has no field. The human who holds a membership is in no record: `Member` holds no person id, and the
`userId` of the stored member row links a sign-in account, not the human (report 06). The property is fixture
evidence only, and the rule that every property be used by a record has that one stated exception (findings
03-schema.grok#2 and 07-provenance.astra#4; section 6, gate 5 rule 11).

### 3.4 `Role` (`packages/kernel/src/Role.schema.ts`)

`Role` is `LiteralKit(["viewer", "editor", "admin"]).pipe($I.annoteSchema("Role", { description, examples }))`.
`LiteralKit` builds on `S.Literals` (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts` 387),
whose AST is a union of literal nodes with no checks (`Schema.ts` 5092 to 5094), so the annotation lands on the union
node.

| Position | Mark |
| --- | --- |
| The schema | `...aboutScheme("inv:MemberRoleScheme")` in the `annoteSchema` extras |

Gate 5 then checks that each of the three literals is a notation of `MemberRoleScheme` (decision 23: a schema may
allow fewer codes than its scheme has, never one the scheme lacks).

### 3.5 `Activity` (`packages/kernel/src/Activity.schema.ts`): marks on a `Model.Class`

`Activity` is `Model.Class<Activity>("Activity")(fields, { description })` with eight fields. What follows was read in
`node_modules/effect/src/schema/Model.ts` and `VariantSchema.ts` (both marked unstable in 4.1.5).

**How a `Model.Class` is built.**

- `Model.Class` is `VariantSchema`'s `Class` with six variants, `select`, `insert`, `update`, `json`, `jsonCreate` and
  `jsonUpdate`, and `select` as the default.
- The second argument, the annotations, goes to `Schema.Class` only (`VariantSchema.ts` 527 to 537). `Schema.Class`
  spreads it into the annotations of its declaration node (`Schema.ts` 17697), so `S.resolveAnnotations(Activity)`
  returns it. **The class pointer goes there.**
- The class's own fields are the `select` variant's (`VariantSchema.ts`, `makeClass`).
- Each variant is `extract(struct, variant).annotate({ id: "Activity.<variant>", title })` (`VariantSchema.ts` 554 to
  560). So `Activity.json` carries an id and a title and **none of the class's annotations**: report 06's sentence
  that each element of `AuditTrail` "retains Activity's pointer" is false.
- `extract` (`VariantSchema.ts` 234 to 279) puts a plain schema, as it is, into every variant. A plain field's key
  annotations are therefore the same object in all six variants. A `Field` contributes `field.schemas[variant]` only
  to the variants it has.

**Which of `Activity`'s fields are which.**

| Field | Declared as | Kind | Variants it has |
| --- | --- | --- | --- |
| `id` | `Model.UuidV4Insert(ActivityId)` | `Field` | select, insert, update, json (`Model.ts` 871 to 879) |
| `organizationId` | `OrganizationId` | plain, no key annotation today | all six |
| `actorId` | `MemberId` | plain, no key annotation today | all six |
| `actorName` | `DisplayName.pipe(S.annotateKey(...))` | plain | all six |
| `action` | `S.String.check(...).pipe(S.annotateKey(...))` | plain | all six |
| `detail` | `S.String.check(...).pipe(S.annotateKey(...))` | plain | all six |
| `agent` | `Model.FieldOption(DisplayName.pipe(S.annotateKey(...)))` | `Field` | all six (`Model.ts` 387 to 404) |
| `createdAt` | `Model.DateTimeInsert` | `Field`, a shared constant | select, insert, json (`Model.ts` 543 to 547) |

**The placement rule.**

1. A plain field takes its mark as the last `S.annotateKey` in its pipe. It shows in every variant.
2. A `Field` takes its mark on each variant schema, after the `Field` is built, with `Model.fieldEvolve`
   (`VariantSchema.ts` 587 to 598: it maps each named variant's schema through a function and returns a new `Field`,
   so the shared `Model.DateTimeInsert` is not changed). Each function is written in place as
   `(s) => s.annotateKey(mark)`, the schema's own method; the mark is hoisted as an annotation object, never as an
   `S.annotateKey(...)` callback (below).
3. A mark written inside the argument of `Model.FieldOption(...)` is not found. `FieldOption` wraps its argument in
   `Schema.OptionFromNullOr` or in `optionalOption` (`Model.ts` 341 to 350), each a `decodeTo`. `decodeTo` returns the
   target node with the source hung on it as an encoding link (`SchemaAST.ts` 4510 to 4519), so the key context of the
   inner schema is not on the outer node, which is the node a struct field holds. The description `agent` carries
   today is in that position; `packages/kernel/src/Wire.schema.ts` shows the working order, re-applying
   `S.annotateKey` after `S.decodeTo`.

| Field | Mark | How it is written | Decision |
| --- | --- | --- | --- |
| (the record) | `...aboutClass("inv:AuditEntry")` | In the second argument of `Model.Class`, beside `description` | 46 |
| `id` | `aboutClass("inv:AuditEntry")`: the subject's id | `fieldEvolve` on select, insert, update, json | 3.1 |
| `organizationId` | `aboutProperty("inv:inTenant")` | A new `S.annotateKey` with a description | 98 |
| `actorId` | `aboutProperty("inv:recordedActor")` | A new `S.annotateKey` with a description | 98 |
| `actorName` | `noTerm("screen")` | Joins the existing `S.annotateKey` | 98 |
| `action` | `aboutProperty("inv:action")` | Joins the existing `S.annotateKey` | 98 |
| `detail` | `noTerm("screen")` | Joins the existing `S.annotateKey` | 98 |
| `agent` | `noTerm("deferred", "party")` | `fieldEvolve` on all six variants; the description moves there too | 98 |
| `createdAt` | `aboutProperty("inv:recordedAt")` | `fieldEvolve` on select, insert, json | 98 |

```ts
// sketch of the three Field values. The three marks are annotation objects, module-level constants of this file
const subjectMark = aboutClass("inv:AuditEntry")
const deferredMark = {
  description: "The agent that did this for the actor. None: the person did it themselves.",
  ...noTerm("deferred", "party")
}
const atMark = aboutProperty("inv:recordedAt")

id: Model.fieldEvolve(Model.UuidV4Insert(ActivityId), {
  select: (s) => s.annotateKey(subjectMark), insert: (s) => s.annotateKey(subjectMark),
  update: (s) => s.annotateKey(subjectMark), json: (s) => s.annotateKey(subjectMark)
}),
agent: Model.fieldEvolve(Model.FieldOption(DisplayName), {
  select: (s) => s.annotateKey(deferredMark), insert: (s) => s.annotateKey(deferredMark),
  update: (s) => s.annotateKey(deferredMark), json: (s) => s.annotateKey(deferredMark),
  jsonCreate: (s) => s.annotateKey(deferredMark), jsonUpdate: (s) => s.annotateKey(deferredMark)
}),
createdAt: Model.fieldEvolve(Model.DateTimeInsert, {
  select: (s) => s.annotateKey(atMark), insert: (s) => s.annotateKey(atMark), json: (s) => s.annotateKey(atMark)
})
```

**Why the callback is not hoisted.** `S.annotateKey<S extends Top>(annotations)` fixes `S` at the outer call and
returns `(self: S) => S["Rebuild"]` (`Schema.ts` 753 to 757). A constant such as
`const subject = S.annotateKey({...})` has no schema to infer `S` from, so `S` is `Top` and the callback is
`(self: Top) => Top`. `fieldEvolve` types each replaced variant as the `ReturnType` of its function
(`VariantSchema.ts` 462 to 492), so every variant the constant touched would become `Top`: the insert variant of `id`
would lose `withConstructorDefault<brand<String, "ActivityId">>` (`Model.ts` 843 to 850), and with it the decoded,
encoded and constructor types of a kernel record. The mark would still be on the AST. Written in place, each
function's parameter is typed by the variant it maps, and the method `annotateKey` returns `this["Rebuild"]`
(`Schema.ts` 212), which for `brand` and for `withConstructorDefault` is the schema's own type (`Schema.ts` 5324 to
5334 and 5952 to 5962).

**The types are held by a compile-only file.** `packages/kernel/test/ActivityMarks.types.ts` builds the three fields
unmarked (`Model.UuidV4Insert(ActivityId)`, `Model.FieldOption(DisplayName)`, `Model.DateTimeInsert`) and asserts, for
each variant each has, that the decoded type, the encoded type and the constructor-input type (`Type`, `Encoded`,
`~type.make.in`) of `Activity`'s variant schema equal the unmarked one's, each way round. The insert variant of `id`
is among them, so `Activity.insert.make` still takes a value with no `id`. The file is part of gate 6 (6.6).

**What the gates read.** Gate 5 reads the class pointer from `S.resolveAnnotations(Activity)` and the field marks from
`Activity.fields`. It then reads the fields of each of the six variants and requires that every field a variant has
carries the same mark as the class's field of that name. A `Field` marked on `select` only fails there. Agreement
between variants shows that one mark reached all six, not that it is the right mark: rule P13 compares each field's
mark with the table above (6.5). Gate 7's source rule recognises
`class X extends Model.Class<X>("X")({...}, { ...aboutClass("...") })` and looks for the helper in the second
argument (findings 01-gates.fable#1, 04-effect.grok#2, 06-testing.fable#2). Its rule 1b reads the three constants as
part of `Activity`'s declaration, because that declaration references them (6.7).

Report 06's property `recordTime`, with a domain of `gist:Event`, is not in the thread; `recordedAt` has the domain
`AuditEntry`, so the rule that a field's record class falls under its property's domain holds
(finding 06-testing.fable#1).

### 3.6 The access contract (`packages/access/contract/src`)

Decision 99 enrols "the access contract's records that are views of" `Member`, `Role` and `Activity`. This report
applies one test: **a contract export is a view of a kernel record when one value of it describes one instance that
the kernel record describes, and it either holds that instance's id or is built from the kernel record's own schema.**
A value with no id cannot name a `Member`, whose identity is its `MemberId`.

| File | Export | What it is | Enrolled | Reason |
| --- | --- | --- | --- | --- |
| `People/Person.read.ts` | `Person` | One membership as the People page shows it: `memberId`, `name`, `email`, `role`, `joinedAt` | yes, as a record of `inv:Member` | It holds the `MemberId`. It points at `Member`, never at `inv:Person`. |
| `Activity/AuditTrail.read.ts` | `AuditTrail` | `S.Array(Activity.json)`, at most 500 | yes, as a collection | Built from `Activity`'s own `json` variant. |
| `Session/SessionState.read.ts` | `Membership` | `{ organizationName, role }` of a test account | no | No member id: it cannot name a membership. It is words for the sign-in page. |
| | `OrganizationChoice` | `{ id: OrganizationId, name }` | no | A view of the tenant, not of `Member`, `Role` or `Activity`. No kernel record of the organization is enrolled. |
| | `Ready` | A session answer holding `actor: Member` | no | It describes a session. Its member is the kernel record itself, which is enrolled. Its own comment says a key annotation on `actor` would unwrap the class. |
| | `NoOrganization`, `SignedOut`, `SessionState`, `SessionStatus` | Session answers | no | Not views of the three records. |
| | `AccountEmail`, `TestAccount`, `TestAccountsOffer`, `SignUpOffer`, `SignInFeatures` | Sign-in data | no | Their term, `SignInAccount`, is the party slice's. |
| | `actorOfSession` | A function | no | Not a schema. |
| `People/People.command.ts` | `AddPerson`, `ChangeRole` | Requests that carry a `Role` value | no | Requests, not views: they describe an act, not a membership. |
| | `EmailToFind`, `AddPersonProblemKind`, `AddPersonProblem`, `AddPersonOutcome` | A request field, and the answer to adding a person | no | `AddPersonOutcome` contains a `Person`, which is enrolled itself. |
| `People/People.rejection.ts` | `PersonNotFound`, `LastAdmin` | Errors | no | Errors. |
| `Allowance/ModelAllowance.gateway.ts` | `dailyModelCalls`, `ModelCallPurpose`, `AllowanceAnswerKind`, `AllowanceAnswer`, `taken`, `usedUp`, `usedUpWords`, `ModelCallsUsedUp`, `ModelAllowanceGateway` | The model allowance | no | No relation to the three records. |
| `Access.contract.ts` | `actingAsHeader`, `pageMemberHeader`, `IdentityApi`, `PeopleApi`, `ActivityApi` | Headers and API groups | no | Not records. The inline `S.Array(Member)` and `S.Array(Person)` payloads are unnamed arrays of enrolled records. |

An export that is not enrolled carries no mark at all. That is decision 99's point: no record carries a placeholder
for a term that does not exist yet. The later slice that owns its term enrols it.

**`Person`'s marks.**

| Field | Schema today | Mark | Decision |
| --- | --- | --- | --- |
| (the record) | `S.Opaque` over a struct | `aboutClass("inv:Member")` | 99 |
| `memberId` | `MemberId.pipe(S.annotateKey(...))` | `aboutClass("inv:Member")`: the subject's id | 3.1 |
| `name` | `DisplayName.pipe(S.annotateKey(...))` | `noTerm("screen")`: the same copied name as `Member.name` | 93 |
| `role` | `Role`, no key annotation today | The same `aboutPath([...])` as `Member.role` | 40, 96 |
| `email` | `AccountEmail.pipe(nullAsNone({...}))` | `noTerm("deferred", "party")` | 100 |
| `joinedAt` | `Instant.pipe(nullAsNone({...}))` | `noTerm("deferred", "party")` | 100 |

`email` and `joinedAt` have terms in the party slice (`accountEmail` on `SignInAccount`, `joinedAt` on `Member`,
report 06) and none in the thread. Decision 100 marks both `noTerm`, reason deferred, naming the party slice: the
email is the sign-in identity, not a copy for the screen, so it is not marked as never getting a term. For both fields
the mark joins the object passed to `nullAsNone`, which is the `S.annotateKey` applied after its `S.decodeTo`
(`packages/kernel/src/Wire.schema.ts`).

`Person` has no tenant field: its tenant is the caller's. It is enrolled for gates 5 and 7; the thread's lift runs on
the kernel `Member` only (section 4).

**`AuditTrail`.** A collection is not a record, so it carries no mark of its own. Its enrolment entry says what it is
a collection of, and gate 5 checks that the array's element is `Activity.json` itself and that `Activity.json`'s
fields carry `Activity`'s marks (3.5).

### 3.7 The enrolment list

One committed file is the list, so the law (which may not import a package) and the tests read the same thing:

```json
// packages/ontology/enrolment.json (sketch)
[
  { "file": "packages/kernel/src/Member.schema.ts", "export": "Member", "as": "record" },
  { "file": "packages/kernel/src/Role.schema.ts", "export": "Role", "as": "scheme" },
  { "file": "packages/kernel/src/Activity.schema.ts", "export": "Activity", "as": "record" },
  { "file": "packages/access/contract/src/People/Person.read.ts", "export": "Person", "as": "record" },
  { "file": "packages/access/contract/src/Activity/AuditTrail.read.ts", "export": "AuditTrail", "as": "collection",
    "of": "packages/kernel/src/Activity.schema.ts#Activity.json" }
]
```

`packages/ontology/src/Enrolled.ts` maps each `file#export` to the imported schema value. Gate 5's first check is that
the two name the same set. Each later slice adds its records to both.

## 4. The lift

### 4.1 IRIs of data

All derived from the one base, with the layer in the path (decision 10):

| What | IRI | Thread example |
| --- | --- | --- |
| A node lifted from a record | `<base>/data/<organizationId>/<ClassKey>/<id>` | `<base>/data/test_ExampleWorks/Member/test_RaviWorks` |
| The object of a link to another record | The same rule, with the class key of the property's range and the field's value as the id | `<base>/data/test_ExampleWorks/Tenant/test_ExampleWorks` |
| A node a path creates | `<parent IRI>/<field name>` | `<base>/data/test_ExampleWorks/Member/test_RaviWorks/role` |
| An individual only the fixture names | `<base>/fixture/<ClassKey>/<name>` | `<base>/fixture/Person/test_Ravi` |
| A concept | `<namespace><SchemeKey>-<notation>` | `inv:MemberRoleScheme-admin` |

`<organizationId>` is the value of the record's tenant field: the one field whose mark is a property with range
`inv:Tenant` (`membershipIn` on `Member`, `inTenant` on `Activity`). Gate 5 allows at most one such field in a record.
A record with none (`Person`) is lifted only when the caller supplies the tenant; the thread does not lift it.
`IdText` admits letters, digits, `_` and `-` only, so an id needs no escaping in a path segment. A person is under
`fixture/`, not under a tenant: decision 34 makes the person the human, who belongs to no tenant.

### 4.2 What the lift does with one `Member`

`lift(record, value)` in `packages/ontology/src/Lift.ts` reads the marks from the record's AST with the same reader
gate 5 uses, and returns triples. It names no record, class, property or concept of its own: every one it writes
comes from a mark on the record it is given, and must-fail cases M6 and M7 hold it to that (5.4). For the decoded
value
`{ id: "test_RaviWorks", name: "Ravi Example", role: "admin", organizationId: "test_ExampleWorks",
organizationName: "Example Works (test)" }` it returns six:

```turtle
@base <https://example.org/inventory-import/> .
@prefix inv: <https://example.org/inventory-import/ontology/> .

<data/test_ExampleWorks/Member/test_RaviWorks> a inv:Member ;
    inv:membershipIn <data/test_ExampleWorks/Tenant/test_ExampleWorks> .

<data/test_ExampleWorks/Member/test_RaviWorks/role> a inv:Grant ;
    inv:grantScope inv:GrantScopeKindScheme-organization ;
    inv:grantedTo <data/test_ExampleWorks/Member/test_RaviWorks> ;
    inv:grantsRole inv:MemberRoleScheme-admin .
```

Field by field:

| Field | Mark | Triples |
| --- | --- | --- |
| the record | `aboutClass("inv:Member")` | `<member> a inv:Member` |
| `id` | subject id | none: it is in the IRI |
| `name`, `organizationName` | `noTerm("screen")` | none |
| `organizationId` | `aboutProperty("inv:membershipIn")` | `<member> inv:membershipIn <tenant>` |
| `role` | the path | the four `Grant` triples |

The lift asserts `rdf:type` on the subject and on each node a path creates, and on nothing else. It does not type the
tenant; the fixture does.

### 4.3 The path rule

A path is zero or more node steps followed by one value step (3.2). The thread's path has one node step.

**A node step** `{ property, reverse, node, fixed }` creates a node of class `node`, named `<parent IRI>/<field
name>`, and links it to its parent with `property`: `<parent> property <node>`, or with `reverse: true`
`<node> property <parent>`. Each `fixed` entry adds `<node> fixed.property fixed.concept`. Gate 5 checks that the
property's domain and range fit the direction (with `reverse`, the property's domain is the node's class and its range
the parent's class or an ancestor of it: `grantedTo`, `Grant` to `Member`), and that each fixed property's domain is
the node's class and its range the scheme the concept belongs to.

A path with more than one node step is refused by the projector in the thread: the naming of a second created node is
not designed, and no thread field needs one.

**The value step** `{ property }` writes `<last node> property <object>`. Its object is decided by the property's
range and the field's schema, in three cases:

| Case | The property's range | The field's schema | The object |
| --- | --- | --- | --- |
| (a) a literal | a datatype | not a `Literals` schema | The value as a literal of that datatype |
| (b) a classification | a scheme | a `Literals` schema pointing at that scheme | The concept's IRI for the field's literal (decision 23) |
| (c) a classification by a class | a class C | a `Literals` schema pointing at a scheme S, where the concept of S for every literal the schema allows states `alsoInstanceOf: C` | The concept's IRI for the field's literal |

Case (c) is the only lift in the thread: `grantsRole` ranges over the class `Role`, `Member.role`'s schema is `Role`,
which points at `MemberRoleScheme`, and each of viewer, editor and admin is also an individual of `Role`. Report 12's
table of path rules lists (a) and (b) only, and its text would refuse a class-ranged last step fed by a code; the
projector's rule must admit (c) as written here (findings 05-ontology.astra#2, 07-provenance.astra#5). The value step
names no scheme: the scheme is read from the field's own schema, so it has one home.

### 4.4 How the fixture graph is produced

Report 12 said that no access row is lifted in the thread and that the lift runs in the slow test only; under that
plan CQ-P06 could pass on hand-written `Grant` triples with the lift never run (findings 06-testing.fable#3,
07-provenance.astra#3). Here the lift is a thread deliverable and the question's graph cannot exist without it:

| Part of the graph | Source | Holds |
| --- | --- | --- |
| Hand-written | `packages/ontology/fixtures/cq/CQ-P06.fixture.ttl` | What no record holds: the person, the two tenants' types, the two `membershipOf` links. Five triples. |
| Lifted | `packages/ontology/fixtures/cq/CQ-P06.members.json`, two encoded `Member` records, decoded through the kernel's `Member` schema and passed to `lift` | Twelve triples: every `inv:Member` and `inv:Grant` type and every `membershipIn`, `grantedTo`, `grantsRole` and `grantScope` triple. |

One function, `graphOf(record, rows, handWritten)`, in `packages/ontology/src`, decodes each row through `record`,
passes each decoded value to `lift(record, value)`, and returns the lifted triples with the hand-written ones.
`threadGraph()` is `graphOf` given the kernel's `Member`, the two committed rows and the committed hand-written text:
the seventeen triples. `bun run ontology:write` writes them to
`packages/ontology/generated/fixtures/CQ-P06.graph.ttl` with the projector's own writer, gate 1 byte-compares that
file, gate 8 queries the in-memory result and gate 9 reasons over the file.

Three guards keep the split honest, each a test gate 8 runs (6.8):

1. The hand-written file holds no triple with any of the four lifted predicates and no `inv:Member` or `inv:Grant`
   type.
2. `threadGraph()` less the hand-written triples equals, triple for triple, the union of `lift(Member, row)` over the
   two decoded rows. Nothing is added to the graph between the lift and the question, so a `threadGraph` that wrote
   the grant itself fails here.
3. Every property that states `evidence: "fixture"` (in the thread, `membershipOf`) is the predicate of at least one
   triple of the hand-written file. Gate 5's rule P11 leans on this guard: without it the exception could hide a
   property nothing uses.

Beside them, the must-fail cases of section 5.4 show the answer changing when the lifted triples, the record's value
or the mark on the record changes. M6 and M7 call `graphOf` with a copy of `Member` whose `role` mark is changed, so a
`lift` that wrote a grant for every member, whatever the mark said, fails them.

## 5. The question

### 5.1 CQ-P06

"Who are the members of this organization and which role does each hold?" (report 04; decision 8). No query was
drafted for it in any report (findings 06-testing.fable#7, 09-reuse.grok#4). This is it:

```sparql
# packages/ontology/fixtures/cq/CQ-P06.rq
PREFIX inv: <https://example.org/inventory-import/ontology/>

SELECT ?tenant ?person ?member ?role
WHERE {
  ?member a inv:Member ;
          inv:membershipIn ?tenant ;
          inv:membershipOf ?person .
  ?grant a inv:Grant ;
         inv:grantedTo ?member ;
         inv:grantScope inv:GrantScopeKindScheme-organization ;
         inv:grantsRole ?role .
}
ORDER BY ?tenant ?member
```

It reads the role through the grant and in no other way. It asks only for types that are asserted, so it needs no
reasoner and no property path over `rdfs:subClassOf` (open decision 27 is not touched). "This organization" is a value
of `?tenant`: the suite compares the whole result, and the answer for one organization is the rows with that tenant.
Report 04's companion wording about "non-removed" members needs `removedAt`, which is not a thread term; it is dropped.

### 5.2 The fixture

Two tenants, one person, two memberships (decisions 8 and 94). Every individual is named `test_`.

The member rows (`CQ-P06.members.json`), as the kernel's `Member` encodes them:

| `id` | `name` | `role` | `organizationId` | `organizationName` |
| --- | --- | --- | --- | --- |
| `test_RaviWorks` | Ravi Example | `admin` | `test_ExampleWorks` | Example Works (test) |
| `test_RaviSecond` | Ravi Example | `viewer` | `test_SecondOrg` | Second Org (test) |

The hand-written part (`CQ-P06.fixture.ttl`):

```turtle
@base <https://example.org/inventory-import/> .
@prefix inv: <https://example.org/inventory-import/ontology/> .

<fixture/Person/test_Ravi> a inv:Person .
<data/test_ExampleWorks/Tenant/test_ExampleWorks> a inv:Tenant .
<data/test_SecondOrg/Tenant/test_SecondOrg> a inv:Tenant .
<data/test_ExampleWorks/Member/test_RaviWorks> inv:membershipOf <fixture/Person/test_Ravi> .
<data/test_SecondOrg/Member/test_RaviSecond> inv:membershipOf <fixture/Person/test_Ravi> .
```

The lifted part is section 4.2's six triples for `test_RaviWorks` and the same six for `test_RaviSecond` with
`test_SecondOrg` and `inv:MemberRoleScheme-viewer`.

### 5.3 The expected rows

IRIs relative to `<base>/`:

| `?tenant` | `?person` | `?member` | `?role` |
| --- | --- | --- | --- |
| `data/test_ExampleWorks/Tenant/test_ExampleWorks` | `fixture/Person/test_Ravi` | `data/test_ExampleWorks/Member/test_RaviWorks` | `inv:MemberRoleScheme-admin` |
| `data/test_SecondOrg/Tenant/test_SecondOrg` | `fixture/Person/test_Ravi` | `data/test_SecondOrg/Member/test_RaviSecond` | `inv:MemberRoleScheme-viewer` |

Exactly these two rows, in this order. One person appears twice with two roles, which is the point of the fixture.
The test builds the expected IRIs from the module's `base` and namespace, never from the literal, which gate 7's rule
5 allows in one file only.

These rows are the lock on the question's answer (decision 118): there is no lock file and no update flag. A commit
that changes them says so in its message, and the release notes name the question with its old and its new answer
(section 8).

### 5.4 The must-fail cases

Each is a committed test that changes one thing and asserts that the result no longer equals the expected rows. M1 to
M3 change the graph after the lift, M4 the record's value, M5 the query, and M6 and M7 the mark on the record.

| Case | The one change | Result | What it shows |
| --- | --- | --- | --- |
| M1 | The lifted part is left out | 0 rows | The hand-written fixture cannot answer alone. |
| M2 | The two `grantsRole` triples are removed from the lifted part | 0 rows | The role is read through the grant. This is gate 8's planted mistake. |
| M3 | Each grant's four triples are replaced by `<member> inv:grantsRole <role>` | 0 rows | A role put on the member directly is not an answer (decision 40). |
| M4 | `test_RaviWorks`'s `role` is `editor` in the member row | Row 1 has `inv:MemberRoleScheme-editor` | The answer comes from the record's value. |
| M5 | A mutant query reaches the grant through the person: `?member inv:membershipOf ?person . ?other inv:membershipOf ?person . ?grant inv:grantedTo ?other` | 4 rows | The fixture tells a query that forgets the tenant from one that does not: it would report Ravi as admin of the second organization. |
| M6 | `graphOf` is given, in place of `Member`, a copy whose `role` field carries `noTerm("screen")` and no path; the rows and the hand-written text are the committed ones | 0 rows. The graph holds no `inv:Grant` type and no `grantedTo`, `grantsRole` or `grantScope` triple; its lifted part is the two members' types and their `membershipIn` links | The grant comes from the mark on the record, not from the lift's code. |
| M7 | `graphOf` is given a copy of `Member` whose `role` path is the real one without its `fixed` entry | 0 rows. The lifted part equals the real one less the two `inv:grantScope` triples | The lift writes what the path says and no more: the scope triple is the path's, not the lift's. |

The copies of M6 and M7 are `S.Struct({ ...Member.fields, role: ... })` with `Member`'s class pointer, both marks
written with the helpers in the test. The `role` field is built from `Role` afresh: a second `S.annotateKey` on
`Member.fields.role` would merge with the path already there and leave two keys on the field (3.1). M7 removes the
`fixed` entry because the thread has no second concept of `GrantScopeKindScheme` and no second property that ranges
over `Role` to swap in; a path with no fixed entry is a legal path (3.2), so the copy type-checks. Each case asserts
its result twice: on the rows the query returns over `graphOf`'s graph, and on the triples `lift(copy, value)`
returns when called directly, so neither function can answer for the other. Neither copy is enrolled, so gates 5
and 7 do not read it.

### 5.5 CQ-P11, added by the auditor's first run (decision 102)

The foundational auditor's adversary showed that CQ-P06 is answerable with a role written on the member, so it does
not warrant `Grant`. Decision 102 adds CQ-P11, "At which scope does each member hold which role?", which has no answer
without a grant: `assets/requirements/competency-questions.yaml` holds its query, its sample answer on the same
fixture (both of Ravi's grants at `inv:GrantScopeKindScheme-organization`) and its must-fail case (the two `grantScope`
triples removed: zero rows). It is drafted and not built, and gate 8 does not run it until it is added to the suite
with a fixture file of its own. Decision 106 rewords CQ-P10 to ask what each audit entry says; the thread still does
not run it.

## 6. The gates

Decision 95 builds gates 1 to 9. Gates 5 and 7 read the enrolment list of section 3.7 (decision 99). The table says
where each runs and what it reads; the subsections give each gate's rules and its one planted mistake, and section
6.11 walks each planted mistake through all nine gates.

| Gate | Name | Runs in | Where the test is | Reads |
| --- | --- | --- | --- | --- |
| 1 | Byte-compare | `check` (`test`) | `packages/ontology/test/Generated.test.ts` | The projector's output in memory; the three committed files under `generated/` |
| 2 | Re-parse | `check` (`test`) | the same file | The three files' text, parsed with N3.js; the triples the writer was given |
| 3 | Forbidden constructs and the namespace guard | `check` (`test`) | the same file | The parsed triples of the three files |
| 4 | Vocabulary coherence | `check` (`test`) | `packages/ontology/test/Coherence.test.ts` | The vocabulary literal, decoded; `packages/ontology/exceptions/no-gist-parent.json`; `explorations/erp-ontology/DECISIONS.md` as text |
| 5 | Record pointers on the AST | `check` (`test`) | `packages/ontology/test/Pointers.test.ts` | `enrolment.json`; `Enrolled.ts`; each enrolled schema's AST; the vocabulary value; the placements of section 3, stated in the test |
| 6 | The type-check | `check` (`check`) | Every package's type-check; the compile-only files `packages/kernel/test/TermsPointer.types.ts` and `ActivityMarks.types.ts` | Source |
| 7 | `laws ontology-terms` | `check` (root task `//#ontology-terms:check`) | `packages/tooling/tool/cli`; its test `test/OntologyTerms.test.ts` | Source text of every workspace's `src` and `test` code files, the law's own source and test left out; `enrolment.json`; for rule 7, each workspace's `package.json` and tsconfig, to resolve an import to a file |
| 8 | The question suite | `check` (`test`) | `packages/ontology/test/Questions.test.ts` | `threadGraph()` in memory, loaded into Oxigraph; `CQ-P06.rq` |
| 9 | The reasoner | `check:full` (`reason`, a task of `@inventory/ontology`, never cached), and a CI job of its own (decision 114) | `packages/ontology/scripts/reason.ts` | `generated/inventory.owl.ttl`, `generated/fixtures/CQ-P06.graph.ttl`, `fixtures/reason/*.ttl`; `robot.lock.json`, and the installed Java and jar it pins |

Gates 1, 2 and 3 work on three files; gates 4 and 5 are split so that a mistake in the terms and a mistake in a mark
are reported by different gates: gate 4 never reads a record, and gate 5 reports nothing about a term that no mark
names.

### 6.1 Gate 1, byte-compare

The test projects in memory and compares each result with the committed file, byte for byte, naming the first line
that differs and saying "run `bun run ontology:write`". The committed text is read with a `?raw` import inside the
package.

The writer is the package's own, so that the bytes are its to fix. Its rules: UTF-8, LF, one final newline; the header
of section 8; only the prefixes the file uses, sorted; subjects in a fixed section order (the document, annotation
properties, gist classes, `inv:` classes, object properties, datatype properties, individuals; in the SKOS file the
document, schemes, concepts), sorted by IRI code point within a section; predicates in the fixed order of the file's
table (6.3), `rdf:type` first; objects sorted by code point; a disjoint pair written once, from the IRI that sorts
first; no blank node; every label and definition a literal with `@en`; `"`, `\`, newline, carriage return and tab
escaped; no date, host, path outside the repository, or commit anywhere.

**Planted mistake.** The test takes the committed OWL text in memory and replaces `"Member"@en` with `"Members"@en`,
then compares. Gate 1 reports the line. No other gate sees it: the changed text is never written, and it is still
valid Turtle with allowed predicates.

### 6.2 Gate 2, re-parse

Each file's text is parsed with N3.js, and the set of parsed triples must equal the set the writer was given. A
positive test projects a variant vocabulary whose one definition holds a quote, a backslash and a newline, and
requires the round trip to hold.

**Planted mistake.** `packages/ontology/fixtures/negative/gate2-unescaped.ttl` holds three lines, the last
`inv:Member skos:definition "A "relationship" between two things."@en .` The gate reports a parse error with the line.
Gate 1 does not read the file; gate 3 works on parsed triples and is never given it.

**A second negative.** The planted mistake shows the parser refusing; it does not show the comparison of the two
sets, and a gate that only parsed would pass it. So a second test, in memory: the OWL text is written from the real
triples less one, and the gate is given that text with the full list. No parse error is involved, and the gate
reports the one triple the writer was given and the text does not hold.

### 6.3 Gate 3, forbidden constructs and the namespace guard

Gate 3 works on parsed triples, never on text. Per file it holds two lists, and anything outside them is a finding.
Report 12 checked `rdf:type` objects against a predicate table (finding 10-evolution.astra#2); here the type list is
its own.

| File | Allowed predicates | Allowed objects of `rdf:type` |
| --- | --- | --- |
| `inventory.owl.ttl` | `rdf:type`, `rdfs:subClassOf`, `rdfs:subPropertyOf`, `rdfs:domain`, `rdfs:range`, `owl:disjointWith`, `owl:versionIRI`, `owl:versionInfo`, `dcterms:source`, `skos:prefLabel`, `skos:altLabel`, `skos:definition` | `owl:Ontology`, `owl:Class`, `owl:ObjectProperty`, `owl:DatatypeProperty`, `owl:AnnotationProperty`, `owl:NamedIndividual`, and each class a concept names in `alsoInstanceOf` (in the thread, `inv:Role`) |
| `inventory.skos.ttl` | `rdf:type`, `owl:versionIRI`, `owl:versionInfo`, `skos:prefLabel`, `skos:altLabel`, `skos:definition`, `skos:notation`, `skos:inScheme`, `skos:topConceptOf` | `owl:Ontology`, `skos:ConceptScheme`, `skos:Concept` |
| `fixtures/CQ-P06.graph.ttl` | `rdf:type` and the vocabulary's own properties | The vocabulary's own classes |

The namespace guard, on every IRI of every file:

- An `inv:` subject is a term the vocabulary holds. A `gist:` subject is on the projection list of section 2.5 and
  carries only `rdf:type owl:Class`, `rdfs:subClassOf` and `owl:disjointWith`. A `skos:` or `dcterms:` subject
  carries only `rdf:type owl:AnnotationProperty`: the OWL file declares the four annotation properties it uses
  (section 8), `dcterms:source` among them, since it is not one of OWL 2's built-in annotation properties and the
  OWL 2 DL profile asks for a declaration of every other one.
- Every other subject is one of the two document IRIs, or under `<base>/data/` or `<base>/fixture/` in the graph
  file.
- Every IRI is under `<base>`, the gist namespace, or the `rdf`, `rdfs`, `owl`, `skos`, `dcterms` or `xsd` namespace,
  except the one object of `dcterms:source`. No IRI is under a real organisation's host (decision 7).
- No blank node.

**Planted mistake.** `packages/ontology/fixtures/negative/gate3-sameAs.ttl` holds the two prefixes and the one triple
`inv:Tenant owl:sameAs inv:Organization .` The test parses it and gives the triples to gate 3 as an OWL file; the gate
reports the predicate. It is planted in a Turtle fixture, not in a `.ts` file, because gate 7's rule 4 scans code
files for that text and does not scan `fixtures/` (6.7). For the same reason the test never writes the predicate as
a CURIE or as a full IRI: it names what the gate reported as `RdfVocab`'s `owl` namespace followed by the local name
`"sameAs"`, so rule 4 is silent on `Generated.test.ts`. So the stray `owl:sameAs` of decision 95's rationale fails in
gate 3 alone (findings 01-gates.fable#5, 06-testing.fable#6).

**Two further negatives.** The planted mistake trips the predicate list only. The type list and the namespace guard
each get a Turtle fixture of their own in the same folder and the same test:

- `gate3-type.ttl` holds `inv:Member a owl:Restriction .` The predicate is allowed and the subject is a term; the
  type list reports the object.
- `gate3-host.ttl` holds one triple whose subject is under `https://example.com/`, typed `owl:Class`. The predicate
  and the type are allowed; the namespace guard reports the subject.

The files under `packages/ontology/fixtures/negative/` are hand-written Turtle that states something about a term.
They are the exception the brief's no-go on hand-written Turtle names: each exists to be refused by one test, and
no projector, question or reasoner reads it. Gate 3's run over the three generated files never takes that folder as
input, and neither does the `reason` task (6.9).

### 6.4 Gate 4, vocabulary coherence

A pure function over the decoded vocabulary, the exception list and the text of `DECISIONS.md`.
The test decodes the kernel's literal strictly first (2.6); a literal that does not decode fails the gate before any
rule runs. Its rules for the thread:

| Rule | What must hold | Thread instance |
| --- | --- | --- |
| C1 | Keys are unique across classes, properties and schemes; a scheme's key ends in `Scheme`; notations are unique in a scheme | 18 keys, 4 notations |
| C2 | Every class, property, scheme and concept has a non-empty label and definition | 22 terms |
| C3 | A `gist` parent is on the module's gist list; a `local` parent is a class of the vocabulary; no cycle | `Tenant` under `Organization` |
| C4 | The classes whose parent is `none` are exactly the entries of the exception list, with the same reason text (decision 97) | `Role` |
| C5 | The gist list is closed upward: each gist class's parent is on the list (decision 14) | `Person`, `LivingThing`, `PhysicalIdentifiableItem` |
| C6 | Each disjoint pair names two classes on the gist list (decision 15) | 3 pairs |
| C7 | Every class has one identity criterion: `stated` with its text, or `inherited`, which needs a local parent | `Tenant` inherits |
| C8 | A property's domain is a class of the vocabulary or absent; an object property's range is a class or a scheme of the vocabulary; a datatype property's datatype is in the datatype registry | `inTenant` has no domain |
| C9 | A sub-property link names a property on the gist list whose domain and range the property falls under (decision 16) | none in the thread |
| C10 | A scheme has at least one concept; `alsoInstanceOf` names a class of the vocabulary | the three roles |
| C11 | The tag is one of kind, role, relator, information; a `role` class has a local parent | `Tenant` |
| C12 | Every term and every exception entry has `ratification: { decision: <n> }`, naming a decision number for which `DECISIONS.md` has a heading `### <n>. ` (decisions 107 and 111) | 22 terms name 111; 1 exception entry names 97 |
| C13 | The version is three numbers, and `0.y.0` before publication (decision 24) | `0.1.0` |

Decision 97 settles the conflict four findings name (03-schema.grok#1, 05-ontology.astra#1, 07-provenance.astra#1,
09-reuse.grok#2, 10-evolution.astra#1): report 05's rule V25 let only a category class be parentless, and its rule
V17 excepted `Role` on identity only. C4 replaces V25 for the thread. Category classes are open decision 12's, so C4
admits no other case.

The exception list is `packages/ontology/exceptions/no-gist-parent.json`: an array of
`{ "class": "inv:Role", "reason": "...", "ratification": { "decision": 97 } }`. It is a file apart
from the module on purpose: the module says `none`, the list says who allowed it, and the gate compares the two.

The test reads `explorations/erp-ontology/DECISIONS.md` as text and hands it to the pure function. C12 checks
that each term and exception entry names a decision number and that a line begins `### <n>. ` for that number.
An open decision has no heading: it is a row of the table under `## Open`. So a heading means the decision is
answered. A combined heading such as `### 39 and 43.` is not matched for either number; whether a term may name a
combined entry is undecided (section 10). C12 reads that one file and checks nothing else about it. It does not read
whether the decision's text accepts the term. That limit is this report's design; decision 107 says only that a term
names the decision that accepted it.

**Planted mistake.** In the test, a copy of the kernel's literal is made in which `Grant`'s parent is
`{ kind: "none", reason: "planted" }`; it is decoded, and the gate is run with the real exception list. It reports C4
naming `inv:Grant`. This is expressible in the term model as designed: `none` is a legal parent, so the copy
type-checks and decodes and gate 6 is silent; it is a value in a test, so gates 1, 5 and 7 never see it. The earlier
planted mistake, a class under two disjoint parents, cannot be written: a class has one `parent` field (findings
01-gates.fable#4, 03-schema.grok#5, 06-testing.fable#5, 08-docs.fable#3). Disjointness is gate 9's to show.

**One further negative, for C12.** In the test, a copy of the kernel's literal gives `Member` the decision number
999, which has no entry in `DECISIONS.md`, and is decoded, as the planted mistake's copy is. The gate is run on it
with the unchanged decision text. C12 reports `Member` by its key. No committed input changes.

### 6.5 Gate 5, record pointers on the AST

For each entry of the enrolment list the gate reads the schema value and reports:

| Rule | What must hold |
| --- | --- |
| P1 | `enrolment.json` and `Enrolled.ts` name the same exports |
| P2 | A `record` entry's schema annotations hold `term`, naming a class of the vocabulary. A `scheme` entry's hold `term`, naming a scheme, and the schema is a union of literals |
| P3 | Every field of a record has exactly one of `term`, `path`, `noTerm` in its key annotations (decision 22) |
| P4 | Exactly one field's `term` is the record's own class: the subject's id |
| P5 | Any other `term` on a field names a property whose domain is the record's class, an ancestor of it, or absent |
| P6 | At most one field's property has the range `inv:Tenant` |
| P7 | A `path` obeys section 4.3: one node step at most; each property, class and concept exists; directions, domains and ranges fit; the value step is case (a), (b) or (c) |
| P8 | A field or schema that points at a scheme allows only literals that are notations of it (decision 23) |
| P9 | A `noTerm` reason is one of the six; `deferred` names a slice |
| P10 | For a `Model.Class`, every field of each of the six variants carries the same mark as the class's field of that name (3.5) |
| P11 | Every property of the vocabulary is named by a mark of some enrolled record, or states `evidence: "fixture"` |
| P12 | A `collection` entry's schema is an array whose element is the named variant itself |
| P13 | Every field of every `record` entry carries the mark section 3 gives it (3.3, 3.5, 3.6). The test states the placements as a table of record, field and mark, eighteen rows, each mark built with the helper that writes it so that no key is written by hand, and compares it with the key annotations read from each record; it names every field that differs |

P11's exception is `membershipOf` (3.3). The third guard of section 4.4, which gate 8 runs, requires that each
fixture-only property does occur in the hand-written fixture, so the exception cannot hide an unused term.

P13 is the one rule that says a mark is the right mark. P1 to P12 hold that every mark is well formed, and a well
formed mark can still be the wrong one. Give `Activity.organizationId` the `recordedActor` mark and `Activity.actorId`
the `inTenant` mark: both are real properties whose domains fit `AuditEntry`, exactly one field still has the tenant
range, all six variants agree, both properties still count as used, and the thread lifts no audit entry and asks no
question of one. Nothing but a comparison with decision 98's placements sees it. So for `Activity` P13 asserts,
on the key annotations the record really carries, that `organizationId` names `inTenant`, `actorId` names
`recordedActor`, `action` names `action`, `createdAt` names `recordedAt`, `id` is the subject's id, `actorName` and
`detail` are `noTerm` with the reason screen, and `agent` is deferred to the party slice. `Person`, which the thread
does not lift either, is held the same way, and `Member` too, though gate 8 would also see a wrong mark there. A
slice that enrols a record adds its rows to the table.

**Planted mistake.** The test builds `S.Struct({ ...Member.fields, name: DisplayName })`, gives it `Member`'s class
pointer with `aboutClass("inv:Member")`, and hands it to the gate in place of `Member`. It reports P3 naming the
field `name` (P13 names the same field). The struct is a value in a test: it compiles (gate 6); it is not an enrolled
export, its helper call is in a test file, which rule 1b does not read, and no annotation key is written by hand
(gate 7); and gate 4 reads no record.

**A second negative, for P13.** The test builds a struct from `Activity.fields` with the class pointer of
`AuditEntry`, in which `organizationId` is `OrganizationId` marked `aboutProperty("inv:recordedActor")` and `actorId`
is `MemberId` marked `aboutProperty("inv:inTenant")`, and hands it to the gate in place of `Activity`. P13 names both
fields, and P1 to P12 report nothing.

### 6.6 Gate 6, the type-check

Nothing new runs: it is the repository's type-check. What makes it a gate is that the helpers are typed by the
registries, so these do not compile:

```ts
// packages/kernel/test/TermsPointer.types.ts (sketch). Compile-only: not a *.test.ts file
const node = { property: "inv:grantedTo", reverse: true, node: "inv:Grant" } as const
const scope = { property: "inv:grantScope" } as const
const value = { property: "inv:grantsRole" } as const

// @ts-expect-error a property where a class is wanted
aboutClass("inv:membershipIn")
// @ts-expect-error a class where a property is wanted
aboutProperty("inv:Member")
// @ts-expect-error a misspelt class
aboutClass("inv:Organisation")
// @ts-expect-error a misspelt notation
aboutPath([{ ...node, fixed: [{ ...scope, concept: "inv:GrantScopeKindScheme-organizaton" }] }, value])
// the same call spelt right compiles, so the directive above answers to the notation alone
aboutPath([{ ...node, fixed: [{ ...scope, concept: "inv:GrantScopeKindScheme-organization" }] }, value])
```

Three things about the file's form, each from the repository as it stands:

- **Its name.** The kernel's Vitest collects `test/**/*.test.ts` (`packages/kernel/vitest.config.ts`), and a file of
  that name with no test in it is an empty suite, which fails the run, and its calls would be executed for nothing.
  `tsconfig.test.json` includes the whole `test` folder and the package's `check` script compiles it, so
  `TermsPointer.types.ts` is type-checked and never collected. The same holds for `ActivityMarks.types.ts` (3.5),
  which holds no error line: its equalities must compile.
- **One line a case.** A `@ts-expect-error` covers the line below it and no other, so each refused call is one line
  directly under its directive. The path call is kept to one line, under the formatter's 120 columns, by hoisting
  its valid parts into three constants; the misspelt concept stays in the call.
- **Spread arguments.** A helper call here is not made of literals alone. Gate 7's rules 1b and 3 read `src` files
  only (6.7), so they are silent on it.

**Planted mistake.** `aboutProperty("inv:Member")`: a real term of the wrong kind. Each `@ts-expect-error` line is the
planted mistake kept in the tree: if a helper ever accepted it, the unused directive would fail the type-check. Gate 7
passes the file: rules 1b and 3 do not read test files, and it holds none of the texts rules 4 to 6 refuse. Gate 5
never sees it: no test imports it.

### 6.7 Gate 7, `laws ontology-terms`

A source law in `@beep/repo-cli`, run as `bun run beep laws ontology-terms` and as the root task
`//#ontology-terms:check` in all three checks. It reads source text; it imports no package of the repository. The
five helpers are `aboutClass`, `aboutProperty`, `aboutScheme`, `aboutPath` and `noTerm`, as imported from
`@inventory/kernel/TermsPointer`. The rules that run in the thread:

| Rule | What it refuses | Runs in the thread |
| --- | --- | --- |
| 1 | An export on the enrolment list whose declaration carries no helper call. Recognised forms: an `S.` or `Schema.` chain, `LiteralKit(...)`, a class extending `S.Opaque` or `S.Class` over one, and `class X extends Model.Class<X>("X")(fields, annotations)` with the helper in the second argument. A `collection` entry is exempt | yes |
| 1b | In a file under a workspace's `src`, a helper call that is neither inside the declaration of an enrolled export nor inside a module-level `const` of the same file that such a declaration references by name: a mark no gate checks. Every `src` file is read, the kernel's unenrolled records included. Test files are not read: a mark built in a test reaches no generated file | yes |
| 2 | An Alchemy block without a pointer | no: no block is enrolled |
| 3 | In a file under a workspace's `src`, a helper whose argument is not the literal form its position takes. `aboutClass`, `aboutProperty`, `aboutScheme`: one string literal. `aboutPath`: one array literal of object literals whose values are string literals, the literal `true` for `reverse`, and for `fixed` an array literal of object literals of string literals. `noTerm`: one string literal, or two when the first is `"deferred"`. No identifier, spread, call or computed key anywhere in the argument | yes |
| 4 | The text of `owl:inverseOf`, `owl:sameAs`, `owl:equivalentClass`, `owl:imports`, `owl:hasKey`, `skos:narrower` or `skos:hasTopConcept`, as a CURIE or as a full IRI, in any `.ts`, `.tsx` or `.mjs` file git would commit, outside the law's own source and test | yes |
| 5 | The literal `https://example.org/inventory-import` in any code file but `packages/kernel/src/Terms.vocab.ts` | yes |
| 6 | The annotation keys `term`, `path` or `noTerm` written by hand in an annotation object, anywhere but `packages/foundation/modeling/vocabulary/src/Pointer.ts` | yes |
| 7 | A value import, a value re-export or a dynamic import whose specifier resolves to the file `packages/kernel/src/Terms.vocab.ts`, in any file outside `packages/ontology`. The rule is on the file an import resolves to, not on how the specifier is spelt: a relative path, the entry `@inventory/kernel/Terms` through the kernel's `exports`, a tsconfig `paths` alias and a `package.json` `imports` alias are each resolved. `import type` and `export type` are allowed anywhere | yes |

**What the rules take as written, and why.** Rules 1b and 3 are about the marks on records, which live in `src`. The
thread's own sketches are legal under them. `Activity`'s three hoisted marks (3.5) are module-level constants its
declaration references, so 1b counts them as part of it; each is a helper call of literals, so rule 3 holds.
`Member.role`'s path (3.3) is an array of object literals with one `reverse: true` and one `fixed` array, which is
the form rule 3 gives `aboutPath`. The tests of gates 5, 6 and 8 build marked structs and call the helpers in test
files, which neither rule reads. An unenrolled kernel record that gained a mark would be in `src`, and 1b refuses
it.

**The law does not read itself.** No rule reads the law's own source
(`packages/tooling/tool/cli/src/commands/Laws/OntologyTerms*`) or its test and the fixture texts the test holds
(`packages/tooling/tool/cli/test/OntologyTerms*`). The source must write the texts rules 4 and 5 search for, the
base literal among them, since the law imports no package to take it from; the test must plant a hand-written `term`
key for rule 6, a computed argument for rule 3 and a forbidden import for rule 7.

Rule 4 scans code files only. Generated Turtle is gate 3's, on parsed triples, and the Turtle and SPARQL files under
`packages/ontology/fixtures/` are not code files. Gate 3's test, which is a code file, names the predicate it expects
by namespace and local name and never as a CURIE or a full IRI (6.3). So the two gates do not overlap and neither's
planted mistake trips the other.

Rule 7 is the proof that no browser bundle carries the vocabulary (decision 9). The app's
`scripts/bundle-report.mjs` cannot be that proof: it prints, per chunk over 2 kB, the eight largest owners, and names
a workspace file by its path from `src/` without the package (finding 02-architecture.astra#5 is right about it). The
law proves it from the imports instead, and from where they lead. A rule on two spellings of the specifier would not
be that proof: `laws boundaries` refuses a relative path only when it leads into `apps` or the scratchpad
(`Boundaries.rules.ts`, the branches before `packageOf`), and lets any other relative path into another package's
`src` through, so a web module could import the kernel's file by path and pass both laws. On resolved targets the
value has one way out of its file, an import from inside `packages/ontology`, and nothing imports that package
(7.2). The kernel's own `index.ts` and `Terms.pointer.ts` are outside `packages/ontology` like every other file, so
neither may import or re-export the value.

**Planted mistake.** In the law's own test, a fixture source text declares an enrolled record with
`S.annotate({ term: "inv:Member" })` written by hand. Rule 6 reports it. The CURIE is spelt right, so gate 5 would
accept the AST and gate 6 the types; only the source shows that the typed helper was bypassed. The law's run over
the repository does not read its own test, so the planted text fails nothing but the assertion made about it.

**A second negative, for rule 7.** In the same test, a fixture tree holds a web source,
`apps/inventory/src/web/Leak.ts`, with
`import { vocabulary } from "../../../../packages/kernel/src/Terms.vocab.ts"`. Rule 7 reports it. The same line as
`import type` passes, and the same value imported through an alias the fixture's tsconfig declares is reported.

### 6.8 Gate 8, the question suite

The test loads `threadGraph()` into Oxigraph, runs `CQ-P06.rq`, and compares the rows with section 5.3. It then runs
the seven must-fail cases of section 5.4 and the three guards of section 4.4. A change to the expected rows of 5.3 is
said in its commit and in the release notes (decision 118).

Decision 117 adds three to five forbidden conclusions over the thread's own terms, in the goal's SPEC, each with one
fixture that must be refused and one near miss that must pass, each routed to the reasoner or to a must-fail query.
None is drafted yet, so neither this gate nor gate 9 names one here.

**Planted mistake.** M2: the two `grantsRole` triples removed from the lifted part. The suite reports both expected
rows missing. Gate 5 is silent (the marks are unchanged), and gate 1 is silent (the committed graph file is
unchanged; the removal is in memory).

### 6.9 Gate 9, the reasoner

`reason` is a task of `@inventory/ontology`, never a root task, named in the root `check:full` (decision 25). A CI job
of its own runs it too (decision 114). It is never cached (6.10), so every `check:full` starts the script.

The pin, `robot.lock.json`, holds what decisions 112 and 113 approved: ROBOT v1.9.11, `robot.jar` from
`https://github.com/ontodev/robot/releases/download/v1.9.11/robot.jar`, 82,708,624 bytes, sha256
`53cd275c8e4c0dad1fc2c1c34174876795cd7d6b6926e1444adcbb0cb3c7ab26`, and Java 17 by its major version. The release was
tried on 2026-11-23 outside the repository under Java 17.0.2: the DL profile check passed, HermiT found the test
ontology consistent, and with an inconsistent one it reported the inconsistency and exited 1.

The script first reads the pin and compares it with what is installed: the major version of the installed Java, and
the sha256 of the jar's bytes. When the jar is missing it fetches it from the pinned URL and keeps it outside the
repository (decision 112). It fails, never skips, when Java is missing or its major version is not 17, when the fetch
fails, and when the jar's bytes do not hash to the pin. Only then does it run ROBOT with HermiT, twice:

1. **Positive.** `inventory.owl.ttl` merged with `fixtures/CQ-P06.graph.ttl`: the OWL 2 DL profile check passes and
   the merged ontology is consistent.
2. **Negative.** The same two files merged with `packages/ontology/fixtures/reason/person-is-tenant.ttl`, which holds
   the one triple `<fixture/Person/test_Ravi> a inv:Tenant .` The reasoner must report an inconsistency; the task
   fails if it does not.

**Planted mistake.** The negative run. `test_Ravi` is an `inv:Person`, so a `gist:PhysicalIdentifiableItem` through
`gist:Person` and `gist:LivingThing`; an `inv:Tenant` is a `gist:Organization`; gist states the two disjoint. Neither
`Person` nor `LivingThing` is an end of a copied pair, so this shows decision 14's ancestors doing their work, and it
is not a "copied `Person` and `Organization` pair", as the brief words it (finding 07-provenance.astra#8). Gates 1 to
8 do not read `fixtures/reason/`, and the triple is legal Turtle with an allowed type.

The SKOS file is not in the reasoner's input, and no alignment exists (1.4).

### 6.10 Turbo inputs

The root `test` task hashes the package's own files (`$TURBO_DEFAULT$`), two root Vitest files, and, through
`transit`, the source of the packages it depends on. It hashes nothing else outside the package. So the kernel's
module and records, `@beep/vocabulary` and the access contract are covered by the dependency edges, and the exception
list, the enrolment list, `fixtures/` and `generated/` by `$TURBO_DEFAULT$`. The input that is neither a dependency
edge nor a default is `explorations/erp-ontology/DECISIONS.md` (decisions 107 and 111). It must be named explicitly:
without it, removing a heading could replay gate 4's last pass. An edit or deletion of the decision file must change
the hash (findings 01-gates.fable#7, 02-architecture.astra#4, 07-provenance.astra#6).

```json
// packages/ontology/turbo.json (sketch), after the pattern of packages/catalog/model/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "test": {
      "inputs": [
        "$TURBO_DEFAULT$",
        "$TURBO_ROOT$/vitest.shared.ts",
        "$TURBO_ROOT$/vitest.retries.ts",
        "$TURBO_ROOT$/explorations/erp-ontology/DECISIONS.md"
      ]
    },
    "reason": { "dependsOn": ["transit"], "cache": false }
  }
}
```

`reason` is not cached, as the root's `test:slow` is not. Its pass depends on two things no input can stand for:
the Java that is installed and the jar on the machine. A hash over committed files, the pin included, stays the same
when either is removed, and Turbo would then replay the last pass without starting the script, so the script's own
check of Java and the jar would never run. The root file says the same of `//#patches:check`, which reads
`node_modules` and so runs every time. With `"cache": false` every `check:full` starts `scripts/reason.ts`, which
verifies Java and the jar against `robot.lock.json` before its two runs (6.9).

What the script reads is still committed files only, beside the two tools: the two generated files (which gate 1
holds equal to the projector's output), the negative fixture under `fixtures/reason/`, and `robot.lock.json`, the pin
of the jar and of Java that Benjamin approved (decisions 112 and 113: release, URL, sha256, size, and Java 17 by its
major version). The thread keeps no question file under `explorations/`: the query and fixture are in the package.

Decision 114 also runs gate 9 in a CI job of its own. The job sets up Java 17, restores the jar from a cache keyed by
its sha256, fetches it only when the cache has none, checks the hash and runs the script. That cache holds the jar,
never a result: the job starts the script every time. This report does not design the workflow file.

So no cached task replays a pass over something that is gone. Java or the jar: `reason` is never replayed.
`DECISIONS.md`: it is an input of `test`, so its removal changes the hash and gate 4 cannot read its required input.
Removing a named heading makes C12 fail on the key that names it.

The root task `//#ontology-terms:check` takes the inputs the other source laws take, plus
`packages/ontology/enrolment.json` and, for rule 7's resolution, every workspace's `package.json` and tsconfig files.

### 6.11 Each planted mistake, walked through the nine gates

A planted mistake must fail its own gate and no other. Each row is one planted mistake; each cell says what that
gate does with it. "Reports" is the planted failure the test asserts. Every other cell is silent, with the reason.
The walk was made on this design as it now stands, after the changes of the third review; nothing was run.

| Planted mistake, and where it lives | Gate 1 | Gate 2 | Gate 3 | Gate 4 | Gate 5 | Gate 6 | Gate 7 | Gate 8 | Gate 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. A label changed in a copy of the committed OWL text, in memory, in `Generated.test.ts` | Reports the line | The changed text is not given to it, and would parse | Not given to it; every predicate is still allowed | Reads no generated text | Reads no generated text | The test compiles | The test holds no refused text: two labels are not a CURIE of rule 4, the base or an annotation key | Reads `threadGraph()` | Reads the committed files, unchanged |
| 2. `fixtures/negative/gate2-unescaped.ttl` | Not one of the three files | Reports the parse error | Never given it: there are no triples to give | Reads no fixture | Reads no fixture | Not a code file; the test reads it as text and compiles | Not a code file | Does not read the folder | Reads `generated/` and `fixtures/reason/` only |
| 3. `fixtures/negative/gate3-sameAs.ttl` | Not one of the three files | Not one of the three files, and it parses | Reports the predicate | Reads no fixture | Reads no fixture | Not a code file; the test compiles | Not a code file, and the test names the predicate by namespace and local name, so rule 4 is silent | Does not read the folder | Reads `generated/` and `fixtures/reason/` only |
| 4. A copy of the literal with `Grant`'s parent `none`, in memory, in `Coherence.test.ts` | The projector is not run on the copy | No text is written from it | No triples are made from it | Reports C4 | Reads the real vocabulary | `none` is a legal parent: the copy type-checks | The test calls no helper and holds no refused text | Reads `threadGraph()` | Reads the committed files |
| 5. A struct of `Member`'s fields with `name` unmarked, in `Pointers.test.ts` | No generated file changes | The same | The same | Reads no record | Reports P3 (and P13) on `name` | The struct compiles | Not an enrolled export (rule 1); its helper call is in a test file (rules 1b and 3); no key written by hand (rule 6) | Reads the real `Member` | Reads the committed files |
| 6. `aboutProperty("inv:Member")` under a `@ts-expect-error`, in `packages/kernel/test/TermsPointer.types.ts` | Not read | Not read | Not read | Not read | No test imports the file | Reports: the call is the error the directive expects, and the type-check fails if it ever compiles | Rules 1b and 3 do not read test files; none of the texts of rules 4 to 6 is in it | Not read | Not read |
| 7. A fixture source text with a hand-written `term` key, in the law's own test | Not read | Not read | Not read | Not read | A text, not a schema | A string: it compiles | Rule 6 reports it in the test's assertion; the law's run over the repository does not read its own test | Not read | Not read |
| 8. M2, the two `grantsRole` triples removed from the lifted part, in memory, in `Questions.test.ts` | The committed graph file is unchanged | Not given to it | Not given to it | Reads no graph | The marks are unchanged | The test compiles | The test holds no refused text; it builds its IRIs from the module's base | Reports both expected rows missing | Reads the committed graph file |
| 9. `fixtures/reason/person-is-tenant.ttl` | Not one of the three files | Not one of the three files | Not one of the three files | Reads no fixture | Reads no fixture | Not a code file | Not a code file | Does not read the folder | Reports the inconsistency in the negative run, which the task requires |

The further negatives of sections 6.2 to 6.7 and the must-fail cases of 5.4 are of the same three kinds: a value in
a test's memory, a file under `fixtures/negative/`, or a fixture text in the law's own test. The same reasons hold
for each. Two were checked with care because they call helpers in a test: the copies of M6 and M7 and the swapped
`Activity` of 6.5 are not enrolled, so gate 5 reads none of them on its real run, and they sit in test files, which
gate 7's rules 1b and 3 do not read. C12's negative of 6.4 is a copy in memory too: only gate 4 reads the
changed decision number, and it reports the term's key. The number is legal in the model, so it decodes and compiles.

Three changes of this review keep rows that would otherwise fail a second gate. Row 3: the test once had to write
the forbidden predicate, and rule 4 would have reported the test file. Rows 5 and 6: rule 1b once refused every
helper call outside an enrolled declaration, tests included. Row 7: rule 6 once read the law's own test.

## 7. The package map and the boundaries

### 7.1 Three homes (decision 9)

| Package | Path | `beep.family` | Holds | Entries |
| --- | --- | --- | --- | --- |
| `@beep/vocabulary` (new) | `packages/foundation/modeling/vocabulary` | `foundation` | The metamodel schemas (`Vocabulary`, the class, property, scheme and concept terms), gate 4's rules as a pure function, the pointer helpers' generic makers and the reader of marks from an AST, and the RDF registry of 7.3 | `./Model`, `./Rules`, `./Pointer`, `./Rdf` |
| `@inventory/kernel` (two new entries) | `packages/kernel` | `kernel` | `src/Terms.vocab.ts`: the vocabulary value and the registries' types. `src/Terms.pointer.ts`: the five bound helpers | `./Terms`, `./TermsPointer` |
| `@inventory/ontology` (new) | `packages/ontology` | `ontology` (new) | `src`: the projector, the writer, the lift, `graphOf` and `threadGraph`, `Enrolled.ts`. `generated/`, `fixtures/`, `exceptions/`, `enrolment.json`, `robot.lock.json`, `scripts/write.ts`, `scripts/reason.ts`, `test/` | none: nothing imports it |

`@beep/vocabulary` is this repository's own package, like `@beep/csv` and `@beep/xlsx` beside it: it has no
`vendor.json`, and `vendor:check` does not read it. Dependencies: the kernel adds `@beep/vocabulary`. The ontology
package declares `effect`, `@beep/vocabulary`, `@beep/identity`, `@inventory/kernel` and `@inventory/access-contract`,
and for its tests `n3` and `oxigraph` (decision 26), which `laws boundaries` requires to be declared. Neither engine
is installed today.

### 7.2 The rows in `laws boundaries`

`allowed` in `packages/tooling/tool/cli/src/commands/Laws/Boundaries.rules.ts` decides by family. As written, a
foundation package may import only foundation, the kernel only foundation, and a family the function does not name
may import only foundation. The law reads every import form, so `import type` does not escape it.

| Edge | Today's rule | Change |
| --- | --- | --- |
| kernel to `@beep/vocabulary` | Allowed: `b.family === "foundation"` | none |
| `@beep/vocabulary` to `@beep/identity`, `@beep/schema` | Allowed | none |
| `@beep/vocabulary` to the kernel | Refused, and it stays refused | none: the design needs no such import |
| ontology to foundation | Allowed | none |
| ontology to the kernel and to a context's contract package | Refused: the family is unknown | A new row |
| anything to ontology | The app is allowed everything; others are refused by the last line | A new row, placed before the app's |

```ts
// sketch of the two added lines in `allowed`
if (b.family === "tooling" || b.family === "infra") return false
if (b.family === "ontology") return false                          // new: nothing imports the projector
if (a.family === "app") return true
// ...
if (a.family === "ontology")                                       // new
  return b.family === "kernel" || (b.family === "context" && b.layer === "contract")
```

**The first boundary finding, resolved by design** (02-architecture.astra#1). Report 05's `aboutPath` took a path
typed with this repository's term names, and the path's type lived in the foundation package, so the foundation
package needed the kernel's registry type: a foundation to kernel import, which the law refuses even as a type. In
this design the foundation package exports `pathFor<C, P, K>()`, generic in the three name types, and the kernel
binds it (3.2). The kernel imports the foundation package; nothing points the other way. This stays inside decisions
2, 5 and 9: one module owns the terms, the projector is local, and the three homes are as decided.

**What the new row does not yet allow.** Decision 9 says the app, the kernel, the contexts and tooling do not import
`@inventory/ontology` "in production code". `allowed` has no notion of code against test: it is applied to every
declared dependency, `devDependencies` included. The row above therefore refuses test imports too. That is right for
the thread, whose tests all live inside the ontology package. The slice that adds the SHACL slow test over stored rows
will need the app's test to reach the lift, and must then either put that test in the ontology package or teach the
law a test-only row. It is not the thread's to settle.

### 7.3 The vendored vocabulary, resolved by design

`packages/foundation/modeling/identity/src/Vocab.ts` is vendored from beep-effect, its first line says not to edit it,
and `vendor.json` holds its hash. Its `owl` terms have no `disjointWith` and no `versionIRI`, and `CoreVocab` has no
`xsd` and no `gist` prefix. The thread needs all four. Report 05 said the missing terms "are added to the one vendored
term list", which `vendor:check` would fail (findings 02-architecture.astra#2, 04-effect.grok#3).

The file is not edited. `mergeVocab(base, extension)` in the same file is an object spread in which an extension's
entry replaces the base's entry of the same prefix, so a registry this repository owns is built from the vendored one:

```ts
// packages/foundation/modeling/vocabulary/src/Rdf.ts (sketch). Entry: @beep/vocabulary/Rdf
import { CoreVocab, mergeVocab } from "@beep/identity/Vocab"

export const RdfVocab = mergeVocab(CoreVocab, {
  owl: { iri: CoreVocab.owl.iri, terms: [...CoreVocab.owl.terms, "disjointWith", "versionIRI"] },
  xsd: { iri: "http://www.w3.org/2001/XMLSchema#", terms: ["string", "dateTime"] }
} as const)
```

The `owl` entry spreads the vendored terms because the merge replaces a whole prefix. The writer takes its predicates
and types from `RdfVocab` only, so gate 3's lists and the writer's cannot name a term the registry lacks. The gist
names are this repository's choice (decision 13) and sit in the kernel's module as the `gist` part of the vocabulary
value (2.6), not in a W3C registry. `owl:AllDisjointClasses` and `owl:members` are not added: gist 14.1.0 states
pairs, and so does the projection.

Everything else the thread writes is already in `CoreVocab`: `owl:Ontology`, `owl:Class`, `owl:ObjectProperty`,
`owl:DatatypeProperty`, `owl:AnnotationProperty`, `owl:NamedIndividual`, `owl:versionInfo`; `rdfs:subClassOf`,
`rdfs:subPropertyOf`, `rdfs:domain`, `rdfs:range`; the SKOS terms of 6.3; `dcterms:source`.

The other route, adding the two terms upstream in beep-effect and taking them with `bun run beep vendor sync`, also
works and would shrink the extension to `xsd`. It is Benjamin's repository and his to choose; the thread does not wait
for it.

## 8. The version header and the generated files

Decision 24 is answered: the version is a semantic version string written in the module, never taken from the clock.
Before publication it stays `0.y`; any change advances `y`; a change after which data or an answer that held no longer
holds is recorded as breaking in the release notes; `1.0` is the first published namespace. The thread's headers
therefore wait on nothing (findings 08-docs.fable#5 and 10-evolution.astra#3 were true when written).

The thread's version is `"0.1.0"`, the `version` field of the vocabulary value (2.6). The third number stays 0 before
publication, since any change advances the second. Gate 4's rule C13 checks the form.

| File | What it holds | Document IRI | `owl:versionIRI` |
| --- | --- | --- | --- |
| `packages/ontology/generated/inventory.owl.ttl` | The gist classes and pairs, the seven classes, the nine properties, the declarations of the four annotation properties it uses (`skos:prefLabel`, `skos:altLabel`, `skos:definition` and `dcterms:source`, each `a owl:AnnotationProperty`), the four individuals | `<base>/ontology` | `<base>/ontology/0.1.0` |
| `packages/ontology/generated/inventory.skos.ttl` | The two schemes and four concepts | `<base>/taxonomy` | `<base>/taxonomy/0.1.0` |
| `packages/ontology/generated/fixtures/CQ-P06.graph.ttl` | The seventeen triples of section 4.4 | none | none |

Each file opens with two comment lines and no others:

```turtle
# GENERATED by bun run ontology:write from packages/kernel/src/Terms.vocab.ts. Do not edit.
# inventory-import ontology 0.1.0
```

The graph file's first line names its two sources instead (`packages/ontology/fixtures/cq/CQ-P06.fixture.ttl` and
`CQ-P06.members.json`). The paths are relative to the repository. No date, host, home path or commit appears.

The OWL file's document node:

```turtle
<https://example.org/inventory-import/ontology> a owl:Ontology ;
    owl:versionIRI <https://example.org/inventory-import/ontology/0.1.0> ;
    owl:versionInfo "0.1.0" ;
    dcterms:source <the version IRI gist 14.1.0 states for itself> .
```

`dcterms:source` is declared in the file like the three SKOS properties: it is not a built-in annotation property of
OWL 2, so the OWL 2 DL profile check of gate 9 needs the declaration, and gate 3's guard lets a `dcterms:` subject
carry that one triple (6.3). Report 12's mapping rules declare the same four.

There is no `owl:imports`: gist is projected into the file, not imported. The gist version IRI is a constant in the
module's `gist` part, copied from the pinned gist file, which this report did not open. The SKOS file's document node
has the first three lines with `taxonomy` in place of `ontology`. The version IRI of the OWL document begins with the
term namespace; it appears only as the object of `owl:versionIRI`, and a term's key begins with a letter, so it cannot
be mistaken for a term.

`bun run ontology:write` is a root script that runs `packages/ontology/scripts/write.ts`. The release notes are
`packages/ontology/RELEASES.md`, one line per version; the thread writes "0.1.0: the thin thread". Nothing in the
thread checks that a change did advance `y`: a gate would need the previous version's files, which decision 33's
slice brings. Until then it is a step of the change, and gate 1 at least makes every change to the generated bytes
visible in the diff.

A change to a question's expected rows (5.3) is named in the release notes with the question and its old and its new
answer, and its commit says so (decision 118). The first line changes no answer. Nothing checks that the notes name
it: like the version, it is a step of the change.

## 9. Second-review findings and where this report settles them

### 9.1 The findings

"Settled" means this report's design answers it; the section is named. "Outside" means the finding is about another
file or a later slice. Sixty-four findings, ten reviews.

| Finding | Verdict | Where, or why |
| --- | --- | --- |
| 01-gates.fable#1 | Settled | 3.5: how a pointer and field marks sit on a `Model.Class`, its three `Field` values and its variants; 6.7 rule 1 recognises the class form |
| 01-gates.fable#2 | Settled | Decision 98 gives the fields their terms; 2.2 and 3.5 place all eight |
| 01-gates.fable#3 | Settled | Decision 99 replaces "four kernel records"; 3.6 and 3.7 name the five enrolled records; `Member` has no email (3.3) |
| 01-gates.fable#4 | Settled | 6.4 and 6.9: one planted mistake per gate, each writable; the two-parent case is dropped |
| 01-gates.fable#5 | Settled | 6.3 and 6.7: gate 3 reads parsed triples, rule 4 reads code files, the planted `owl:sameAs` is a Turtle fixture; 6.7 lists which rules run |
| 01-gates.fable#6 | Settled | 3.1 and 3.4: the scheme pointer is a schema annotation, a field's mark a key annotation |
| 01-gates.fable#7 | Settled | Decisions 107 and 111 replaced the earlier plan (1.6); 6.4 and 6.10 use `DECISIONS.md` |
| 02-architecture.astra#1 | Settled | 3.2 and 7.2: `pathFor` is generic, the kernel binds it; no foundation to kernel import |
| 02-architecture.astra#2 | Settled | 7.3: a registry of this repository's own extends the vendored one; `Vocab.ts` is not edited |
| 02-architecture.astra#3 | Settled | 3.3: the five real fields; decision 93 records the correction |
| 02-architecture.astra#4 | Settled | Decisions 107 and 111 replaced the earlier plan (1.6); 6.4 and 6.10 use `DECISIONS.md` |
| 02-architecture.astra#5 | Settled | 6.7 rule 7: the proof is a source law on imports; the bundle report is not used as proof |
| 03-schema.grok#1 | Settled | Decision 97; 6.4 rule C4 and the exception list |
| 03-schema.grok#2 | Settled | 3.3 (fields), 3.1 (the subject's id), 6.5 rule P11 (`membershipOf` is fixture evidence) |
| 03-schema.grok#3 | Settled | 3.6 and 3.7: every enrolled record is placed; nothing else is enrolled |
| 03-schema.grok#4 | Settled | 2.1: `Grant` has one criterion, the member and the field it is read from |
| 03-schema.grok#5 | Settled | 6.4: the planted mistake is a parentless class not on the list |
| 04-effect.grok#1 | Settled | 3.3 |
| 04-effect.grok#2 | Settled | 3.5 |
| 04-effect.grok#3 | Settled | 7.3 |
| 04-effect.grok#4 | Settled | Decision 20's correction: `aboutPath` writes `path`; 3.1 lists the three keys |
| 04-effect.grok#5 | Settled | 3.6: `Person` and `AuditTrail` are enrolled and marked, the rest carry no mark by decision 99; `Person.email` and `Person.joinedAt` are deferred to the party slice by decision 100 |
| 05-ontology.astra#1 | Settled | 6.4 rule C4 |
| 05-ontology.astra#2 | Settled | 4.3 case (c) |
| 05-ontology.astra#3 | Settled | 3.1 and 3.4 |
| 05-ontology.astra#4 | Settled | 3.3 |
| 05-ontology.astra#5 | Settled | 2.1: no local disjoint pair is in the thread, so gate 9 fails for the copied gist axiom only |
| 05-ontology.astra#6 | Outside | `decidesOn`'s range is the party slice's, in the brief |
| 05-ontology.astra#7 | Settled | Decision 98 admits `recordedActor` to the `Member` for the thread; decision 44 stays open and is not relied on (1.4) |
| 05-ontology.astra#8 | Outside | Report 09's inventory of the thread is that file's; this report replaces it for the thread (9.3) |
| 06-testing.fable#1 | Settled | 3.5 and 2.2: every field has a property or a `noTerm` reason; `recordedAt`'s domain is `AuditEntry` |
| 06-testing.fable#2 | Settled | 3.5 |
| 06-testing.fable#3 | Settled | 4.4: the question's graph is built by the lift |
| 06-testing.fable#4 | Settled | 3.6 and 3.7 |
| 06-testing.fable#5 | Settled | 6.4 |
| 06-testing.fable#6 | Settled | 6.3 |
| 06-testing.fable#7 | Settled | 5: one query, one fixture, one set of must-fail cases; `removedAt` is dropped |
| 06-testing.fable#8 | Settled; one condition false | 3.1 places id fields by a mark. The condition that an id is told by `isUUID` is false: `MemberId` and `OrganizationId` are `IdText` (`packages/kernel/src/Ids.id.ts`) |
| 07-provenance.astra#1 | Settled | 6.4 rule C4 |
| 07-provenance.astra#2 | Settled | 3.3 |
| 07-provenance.astra#3 | Settled | 4.4 and the guards of 6.8 |
| 07-provenance.astra#4 | Settled | 3.3 and 6.5 rule P11 |
| 07-provenance.astra#5 | Settled | 4.3 case (c) |
| 07-provenance.astra#6 | Settled; the path it names is false | Decisions 107 and 111 replaced the earlier plan (1.6); 6.4 and 6.10 use `DECISIONS.md` |
| 07-provenance.astra#7 | Settled | Decision 98, as 05-ontology.astra#7 |
| 07-provenance.astra#8 | Settled | 6.9: the pair is inferred through `gist:PhysicalIdentifiableItem`, and the three copied pairs are named in 2.1. The brief's wording is that file's |
| 08-docs.fable#1 | Settled | 3.5 |
| 08-docs.fable#2 | Settled | 3.6 |
| 08-docs.fable#3 | Settled | 6: one planted mistake per gate, stated once |
| 08-docs.fable#4 | Settled | 3.3; `removedAt` is not a thread term (1.3), so the brief's example of it has no field to sit on |
| 08-docs.fable#5 | Settled | Decision 24 is answered; 8 |
| 08-docs.fable#6 | Settled | Decisions 107 and 111 replaced the earlier plan (1.6); 1.5 owes nothing, since decisions 112 to 114 settle the reasoner download |
| 08-docs.fable#7 | Outside | The words of decisions 8 and 93 are `DECISIONS.md`'s, which keeps an answer as given and amends it by later entries; 1.2 holds the counts as they stand |
| 08-docs.fable#8 | Outside | Decision 47 is not a thread matter |
| 09-reuse.grok#1 | Settled | 3.3 |
| 09-reuse.grok#2 | Settled | 6.4 rule C4 |
| 09-reuse.grok#3 | Settled | 3.5, 3.6 |
| 09-reuse.grok#4 | Settled | 5: the query is written, the expected rows name `test_Ravi`, gate 8's planted mistake is M2 |
| 09-reuse.grok#5 | Outside | Report 13's "Sutton only" mark is that file's; here `Organization` is a thread class under `gist:Organization` (2.1) |
| 10-evolution.astra#1 | Settled | 6.4 rule C4 |
| 10-evolution.astra#2 | Settled | 6.3: a list of allowed `rdf:type` objects per file, apart from the predicate list |
| 10-evolution.astra#3 | Settled | Decision 24; 8 |
| 10-evolution.astra#4 | Settled | 2.6: the concept name type is derived from the notation keys; 6.6 has the failing case |
| 10-evolution.astra#5 | Settled | 2.6: one `base` literal; 6.7 rule 5 holds it |

### 9.2 Questions for Benjamin

None is open. The former question 1, the reasoner download approval, is answered: decision 112 approves ROBOT
v1.9.11 with its URL, size and sha256, decision 113 pins Java 17, and decision 114 runs gate 9 in a CI job of its own
as well as in `check:full` (1.5, 6.9, 6.10). Gate 9 waits on nothing.

The former question 2, where a scheme's proposal lists its concepts, no longer applies to the thread. Decisions 107
and 111 replace the proposal and `rat-` record chain (1.6). C12 reads decision headings only. No records are owed.

Two questions this report raised are decided:

- **The People page's `Person` record (decision 100).** Its `email` and `joinedAt` fields, whose terms are the party
  slice's, are both `noTerm`, reason deferred, naming the party slice (3.6). The record stays on the thread's list.
- **A concept's ratification (decision 101).** Its "listed in the proposal" condition no longer applies to the
  thread. Decision 107 replaces that chain, and decision 111 accepts the 18 terms as a set (seven classes, nine
  properties and two schemes), plus the four concepts under their schemes. All 22 terms name decision 111. Its other
  clause stands: a concept added later to a scheme needs a decision of its own. C12 cannot see one that wrongly
  names 111 (section 10).

Role's exception entry names decision 97. Nothing remains owed (1.5).

### 9.3 What other files say that this report replaces, for the thread only

When this report was first written, the brief and reports 04, 05, 06, 12 and 13 still described an earlier thread,
and `gist-categories.md` and `project-profile.md` were behind the decisions. They have since been edited: the brief
and those reports name this report wherever they touch the thread, `gist-categories.md` has a row for each of the
seven gist classes and states the three pairs (2.5), and `project-profile.md` lists decisions 8 to 11, 13 to 16, 20
to 26, 93 to 101, 107, 111 to 114, 117 and 118 as decided. Reports 05, 06 and 11 were searched for the claims this section once listed and
for their mentions of this report, not read whole.

Nothing remains: reports 04, 12 and 13, opened again at the places the rows named, now say what this report holds,
and the other rows already found no difference.

One difference stays on purpose. The ontology skills still describe the `rat-` record chain as the record of an
accepted term. Decision 107 replaces that chain for the thread only, and `project-profile.md`, which every ontology
skill reads first and which wins over a skill, says so: the thread's terms name a decision of `DECISIONS.md`, and a
later slice may use `rat-` records.

### 9.4 Third-review findings

Nineteen findings, three reviews. Each was checked against the files it cites before anything here changed; all
nineteen were true. "Settled" and "Outside" mean what they mean in 9.1.

| Finding | Verdict | Where, or why |
| --- | --- | --- |
| code.astra#1 | Settled | Decisions 107 and 111 replaced the earlier plan (1.6); 6.4 and 6.10 use `DECISIONS.md`. The ruling is now bound to the approved text by decision 111's words, "as that section states them", and that binding is not checked: no gate detects a change to a term's text (1.6, section 10) |
| code.astra#2 | Settled | 2.6: the value is a literal `as const satisfies` the encoded side, never `Vocabulary.make`; types come from the literal, gate 4 and the projector decode it |
| code.astra#3 | Settled | 3.5: the marks are hoisted as annotation objects and applied with `s.annotateKey(mark)` in place; a compile-only file holds the types equal to the unmarked fields' |
| code.astra#4 | Settled | 6.7: rule 3 has a literal form for each helper; rule 1b reads every `src` file and counts a referenced module-level constant as part of its declaration; tests are not read by either. Report 12's sentence is that file's (9.3) |
| code.astra#5 | Settled | 6.5 rule P13 and its negative; 1.1 item 3 |
| code.astra#6 | Settled | 6.9 and 6.10: `reason` is not cached, and the script verifies Java and the jar against the pin before it runs |
| code.astra#7 | Settled | 6.7 rule 7 is on the file an import resolves to, with a web-source negative |
| code.astra#8 | Settled | 6.6: `TermsPointer.types.ts`, one line a case |
| code.astra#9 | Outside | The two cells are report 13's. 2.3 already says a scheme has no kind tag; 9.3 lists the difference |
| gates.fable#1 | Settled | 5.4 M6 and M7; 4.4 second guard; 1.1 item 4. M7 removes the path's `fixed` entry, since the thread has no second legal concept or value-step property to swap in |
| gates.fable#2 | Settled | 6.7 rule 1b; 3.5; 6.5; 6.6 |
| gates.fable#3 | Settled | 6.7: no rule reads the law's own source and test; 6.3: the test names the predicate by namespace and local name |
| gates.fable#4 | Settled | 6.2 and 6.3: one more negative for gate 2 and two for gate 3 |
| gates.fable#5 | Settled | 4.4 third guard; 6.5; 6.8 |
| gates.fable#6 | Settled | 6.3 says what the negative fixtures are and who never reads them. The brief's no-go already carries the exception |
| gates.fable#7 | Settled | 9.3 describes the other files as they are now |
| ontology.grok#1 | Settled | 6.3: a `dcterms:` subject may carry the declaration; 8: four annotation properties are declared |
| ontology.grok#2 | Outside | Report 04's opening of section 4 already gives 4.1's two patterns; the CQ-P01 line is that file's. 9.3 lists it |
| ontology.grok#3 | Settled | 2.5 and 9.3 |

## 10. What was not checked

- **Nothing was compiled or run.** No tool here runs a command, so no sketch was type-checked, no Turtle parsed, no
  query executed, and `bun run docs:check` was not run on this file.
- **gist itself.** The pinned `gistCore.ttl` is kept outside the repository and was not opened. The parents of
  `gist:LivingThing`, `gist:TemporalRelation` and `gist:Assignment`, the three disjoint pairs, the absence of any other
  stated pair among the seven classes, and gist's version IRI rest on report 11 and `gist-categories.md`.
- **The types of the `Model.Class` sketch.** That `(s) => s.annotateKey(mark)` inside `Model.fieldEvolve` leaves each
  variant's type, and so the class's field types and constructor default, as they are was read from signatures
  (`Schema.ts` 212, 5324 to 5334 and 5952 to 5962; `VariantSchema.ts` 462 to 492), not compiled: the equalities of
  `ActivityMarks.types.ts` are what a compile would show. That each function's parameter is typed from the variant
  it maps, in the data-first call, was not compiled either. That `S.resolveAnnotations(Activity)` returns the class
  annotations follows from `Schema.ts` 17660 to 17701 and was not run. `effect/schema/Model` and `VariantSchema` are
  marked unstable.
- **The literal and the types derived from it.** That the kernel's literal passes `satisfies` against
  `S.Codec.Encoded<typeof Vocabulary>` while keeping its keys, and that the three registries and `InvConceptCurie`
  derive from it as 2.6 writes them, was not compiled; the metamodel it is checked against is report 05's sketch.
  The brief already asks for this to be tried in the scratchpad before the thread relies on it.
- **Small type facts.** That `$I.annoteSchema`'s extras and `nullAsNone`'s argument accept the helpers' spread keys;
  that an `S.Opaque` class exposes `fields` as the copies of 5.4 and 6.5 use it, and that a struct built from
  `Activity.fields` keeps the marks of the select variant; the name of the array node's element field that rule P12
  reads; that `mergeVocab` keeps the literal types of an extended `owl` entry; whether `CoreVocab`'s `rdf` terms
  include `type`.
- **The compile-only file of 6.6.** That a spread of an `as const` object into the argument of `aboutPath` keeps the
  literal types its const type parameter needs, so that the call spelt right compiles and the misspelt one does not;
  and that the formatter leaves a line of 103 columns on one line. The width, 120, was read in `.oxfmtrc.json`.
- **Erasure and rule 7.** That `import type` of `Terms.vocab.ts` keeps the value out of every bundle is the
  compiler's and the bundler's behaviour; rule 7 of the law holds the import structure and was designed, not run.
  How the law resolves a tsconfig `paths` alias and a `package.json` `imports` alias from text, without the
  compiler, was not designed further than "it resolves them". The root tsconfig's module settings were not opened
  for this.
- **Reading files outside the package in a test.** Gate 4 reads `explorations/erp-ontology/DECISIONS.md` as text.
  Whether that is a `?raw` import or `node:fs` under the documented `nodeBuiltinImport:off` comment, and whether
  `laws boundaries` accepts an import that leaves the package, was not tried. The same for importing
  `enrolment.json`.
- **What a decision accepts.** C12 checks the number and the heading only. Nothing reads whether the decision's
  text really accepts the term or the exception entry. That limit is this report's design; decision 107 says only
  that a term names the decision that accepted it. Decision 111 accepts the thread's 18 terms and four concepts, and
  decision 97 accepts Role's exception. Three limits follow. A change to a term's text in section 2 or the module
  needs a decision, and no gate detects one made without it. A concept added later to a scheme needs a decision of
  its own (decision 101), and C12 cannot see one that wrongly names 111. Whether a term may name a combined entry such
  as `### 39 and 43.` is undecided; C12 as designed does not match it.
- **ROBOT.** Decision 112 records the release, its URL, size and sha256, and a trial on 2026-11-23 outside the
  repository under Java 17.0.2: the DL profile check passed, HermiT found a seven-line test ontology consistent, and
  an inconsistent one was reported with exit 1. This report ran none of it and downloaded nothing. Not checked: the
  other commands and flags the script uses, where the jar is kept on a machine, how the script reads the installed
  Java's major version, and whether the merged file of 6.9 passes the OWL 2 DL profile check as designed (undeclared
  fixture individuals, the four annotation property declarations).
- **The CI job of decision 114.** Its workflow file, its cache step and how it sets up Java 17 are not designed here.
- **Decision 117's forbidden conclusions.** The three to five bans are not drafted; which gate runs each is known only
  as "the reasoner or a must-fail query".
- **N3.js and Oxigraph.** Neither is installed; their APIs were not read.
- **Turbo and the sync commands.** Whether a package's `turbo.json` may declare a task the root file does not name
  (`reason`) and mark it `"cache": false` there, that naming `DECISIONS.md` as an input changes the task's hash
  when the file is edited or deleted, how `config-sync` writes the task lists of the three root checks and a new package's scripts, exports and
  tsconfig references, and the exact inputs the existing source-law root tasks declare.
- **The stored tables.** No migration was opened. That the stored member row's `userId` links a sign-in account and
  not the human is report 06's statement.
- **Other reports.** Reports 07, 08 and 09 were not reopened; the verdicts on findings about them rest on the
  findings' own text. Report 06's property labels were not copied: the labels in 2.2 are written here.
