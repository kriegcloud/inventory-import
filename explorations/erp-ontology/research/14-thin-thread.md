---
type: Research
title: The thin thread
description: The one specification of decision 8's thin thread as it now stands: its terms, the marks on the real records, the one lift, the one question, gates 1 to 9 with a planted mistake each, the package map, and where each second-review finding is settled.
---

# The thin thread

Design only: nothing here is built. No vocabulary module, no pointer helper, no projector, no generated file, no gate
and no `rat-` record exists today. TypeScript, Turtle and SPARQL in this document are sketches, not code, and none was
compiled or run. This report is the one specification of the thin thread (decision 8 as amended by decisions 38, 40,
41, 46 and 93 to 101). Where reports 04 to 13 or the brief say something else about the thread, this report is the one
to follow; what they say about later slices is untouched.

Inputs: the answered decisions in `DECISIONS.md` (8 to 11, 13 to 16, 20 to 26, 32, 34, 38 to 41, 46, 93 to 101), the
kernel and access contract files named in section 3 as they stand today, `laws boundaries` as written, the root
`turbo.json`, the vendored `@beep/identity`, and Effect 4.1.5 as installed. Every statement about a file was made with
the file open; every Effect API named was read in `node_modules/effect/src`. Section 10 lists what was not checked.

Sixty-two decisions are open (12, 17 to 19, 27 to 31, 33, 35 to 37, 42, 44, 45, 47 to 92). The thread is designed so
that it rests on none of them. Section 1 says how, for each open decision it comes near.

## 1. Scope

### 1.1 The done line

The thread is done when all of the following hold on a clean checkout:

1. `bun run ontology:write` writes three files and a second run changes no byte:
   `packages/ontology/generated/inventory.owl.ttl`, `packages/ontology/generated/inventory.skos.ttl` and
   `packages/ontology/generated/fixtures/CQ-P06.graph.ttl`.
2. The seven classes, nine properties, two schemes and four concepts of section 2 are in the vocabulary module, each
   naming its `rat-` record (a concept names its scheme's, decision 101).
3. The five enrolled records of section 3 carry their marks, and every field of each is placed.
4. The one question, CQ-P06, returns the two expected rows of section 5 over a graph in which the role triples come
   from the lift of two decoded `Member` values and from nowhere else.
5. Gates 1 to 8 run in `bun run check` and pass. Gate 9 runs in `bun run check:full` and passes.
6. Each of the nine gates has one committed test that plants the mistake of section 6 and asserts that the gate
   reports it. That is what "shown failing once" means here: the failure is a permanent test, not a screenshot.

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

### 1.5 What is owed from Benjamin before code

Two things, both already recorded as his:

1. **The reasoner download (decision 25).** ROBOT with HermiT is chosen; the Java pin and the jar are not approved.
   Before anything is fetched the builder names the release, its URL, its sha256 and its size to Benjamin. This report
   did not look them up. Gate 9 cannot be built until then; gates 1 to 8 can. Whether `check:ci` also runs the
   reasoner belongs to the same approval, since CI would fetch the same jar.
2. **The `rat-` records (decisions 32 and 101).** Every term names the `rat-` record that holds Benjamin's answer, and
   none is written. A record ratifies one term proposal. The thread has 22 terms (7 classes, 9 properties, 2 schemes, 4
   concepts). The ruling on a scheme covers the concepts its proposal lists (decision 101), so the thread needs 18
   records: seven classes, nine properties and two schemes. The labels, definitions, parents, tags and identity criteria in section 2 are the proposals: they are
   reports 06 and 10's text where a term exists there under the same key, and written here where it does not (marked
   "new"). A record lives at `explorations/erp-ontology/assets/audit/<audit>/governance/ratifications/rat-<nnn>.yaml`
   (the project profile and the foundational auditor's outputs table), with the fields `id`, `proposal_ref`,
   `decision`, `steward`, `decided_at`, `verbatim_decision` and `rationale`
   (`.agents/skills/_shared/schemas/ratification.schema.yaml`). The exception entry for `Role` (decision 97) is
   ratified too.

The two smaller questions this report raised are answered by decisions 100 and 101 (section 9.2).

## 2. The terms

Notation used below. `inv:` is `https://example.org/inventory-import/ontology/` (decision 10). `gist:` is
`https://w3id.org/semanticarts/ns/ontology/gist/` (gist 14.1.0, `gist-categories.md`). A key is the local name: the IRI
of class `Member` is `inv:Member`. Labels are `skos:prefLabel` and definitions `skos:definition`, in English, written
with the language tag `en` (decision 11). The kind tag and the identity criterion live in the module only (1.4).

### 2.1 Classes

| Key | IRI | Label | Definition | Tag | Parent | Named ancestors | Identity criterion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Organization` | `inv:Organization` | Organization | An organized body of people or of other organizations formed for a purpose, such as a company the tenant buys from, sells to, ships with or has goods made by, or the tenant itself. | kind | `gist:Organization` | none | Stated: the organized body itself (decision 34). No thread record holds it. |
| `Tenant` | `inv:Tenant` | Tenant | An organization for which this application keeps a workspace, whose records are scoped to it and hidden from every other organization. | role | `inv:Organization` (local) | `gist:Organization` | Inherited from `Organization`. In the repository it is told apart by `OrganizationId` (decision 38). |
| `Person` | `inv:Person` | Person | A human being that a tenant deals with, as a member of its workspace or as a contact at another organization. | kind | `gist:Person` | `gist:LivingThing`, `gist:PhysicalIdentifiableItem` | Stated: the human being (decision 34). No thread record holds it; the fixture names one. |
| `Member` | `inv:Member` | Member | A relationship between one person and one tenant that lets the person act in the tenant's workspace from the day it is made until it is removed. | relator | `gist:TemporalRelation` | none | Stated, one criterion: the `MemberId` within its tenant, kept after removal. It rests on `Member.id` and `Member.organizationId`. |
| `Role` | `inv:Role` | Role | A named level of access a grant gives a member, such as viewer, editor or admin. | information | none, on the exception list (decision 97) | none | Stated, one criterion: the concept's scheme and notation (decision 41). |
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
| `recordedActor` | `inv:recordedActor` | object | recorded actor | Links an audit entry to the member who made the change. | `AuditEntry` | `Member` (decision 98) | none | `Activity.actorId` |
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
| `gist:LivingThing` | `gist:PhysicalIdentifiableItem` | Ancestor (decision 14) | no row of its own |
| `gist:PhysicalIdentifiableItem` | none | Ancestor (decision 14) | yes |
| `gist:Content` | none | Parent of `AuditEntry` | yes |
| `gist:TemporalRelation` | none | Parent of `Member` | no |
| `gist:Assignment` | `gist:TemporalRelation` | Parent of `Grant` | no |

Each is written as `owl:Class` with its `rdfs:subClassOf` link and nothing else: no label, no definition, no other
axiom (decision 14, "as names and links only"). Where gist states a parent inside an `owl:equivalentClass`
intersection, the projection writes the named operand as a plain `rdfs:subClassOf` (report 11). Decision 13 asks that
a name be added to `gist-categories.md` when it is admitted: the thread's change adds the three missing rows and
replaces that file's sentence that disjointness copying is open with decision 15's answer. These seven parents and
three pairs are report 11's reading of the pinned gist file, which is kept outside the repository and was not opened
for this report (section 10).

### 2.6 The module's shape

A sketch of what the vocabulary value holds, enough to implement from. The metamodel schemas are `@beep/vocabulary`'s;
the value is the kernel's.

```ts
// packages/kernel/src/Terms.vocab.ts (sketch, not code). Public entry: @inventory/kernel/Terms
const base = "https://example.org/inventory-import" // the one literal; every other IRI is derived from it

export const vocabulary = Vocabulary.make({
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
      ratification: { record: "<audit>/rat-<nnn>", proposal: "otp:..." }
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
        viewer: { /* label, altLabel, definition, ratification */ alsoInstanceOf: "Role" },
        editor: { alsoInstanceOf: "Role" }, admin: { alsoInstanceOf: "Role" }
      }
    },
    GrantScopeKindScheme: { /* ... */ closed: false, concepts: { organization: {} } }
  }
})
```

Three rules of this shape settle review findings:

- **One literal for the base.** The namespace, the two document IRIs, the data layer and the fixture layer are derived
  from `base` (finding 10-evolution.astra#5). Gate 7's rule 5 allows that literal in this one file.
- **Concepts are keyed by notation.** The type of a concept's name is derived from the keys, so a misspelt notation
  does not compile (finding 10-evolution.astra#4):

  ```ts
  type Schemes = typeof vocabulary.schemes
  export type InvConceptCurie = {
    [S in keyof Schemes & string]: `inv:${S}-${keyof Schemes[S]["concepts"] & string}`
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
   so the shared `Model.DateTimeInsert` is not changed).
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
// sketch of the three Field values
const subject = S.annotateKey({ ...aboutClass("inv:AuditEntry") })
const deferred = S.annotateKey({
  description: "The agent that did this for the actor. None: the person did it themselves.",
  ...noTerm("deferred", "party")
})
const at = S.annotateKey({ ...aboutProperty("inv:recordedAt") })

id: Model.fieldEvolve(Model.UuidV4Insert(ActivityId), { select: subject, insert: subject, update: subject, json: subject }),
agent: Model.fieldEvolve(Model.FieldOption(DisplayName), {
  select: deferred, insert: deferred, update: deferred, json: deferred, jsonCreate: deferred, jsonUpdate: deferred
}),
createdAt: Model.fieldEvolve(Model.DateTimeInsert, { select: at, insert: at, json: at })
```

**What the gates read.** Gate 5 reads the class pointer from `S.resolveAnnotations(Activity)` and the field marks from
`Activity.fields`. It then reads the fields of each of the six variants and requires that every field a variant has
carries the same mark as the class's field of that name. A `Field` marked on `select` only fails there. Gate 7's source
rule recognises `class X extends Model.Class<X>("X")({...}, { ...aboutClass("...") })` and looks for the helper in the
second argument (findings 01-gates.fable#1, 04-effect.grok#2, 06-testing.fable#2).

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
gate 5 uses, and returns triples. For the decoded value
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

One function, `threadGraph()`, in `packages/ontology/src`, takes the hand-written text and the member rows and returns
the seventeen triples. `bun run ontology:write` writes them to
`packages/ontology/generated/fixtures/CQ-P06.graph.ttl` with the projector's own writer, gate 1 byte-compares that
file, gate 8 queries the in-memory result and gate 9 reasons over the file. Two guards keep the split honest: a test
asserts that the hand-written file holds no triple with any of the four lifted predicates and no `inv:Member` or
`inv:Grant` type, and the must-fail cases of section 5.4 show the answer changing when the lift or the record changes.

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

### 5.4 The must-fail cases

Each is a committed test that changes one thing and asserts that the result no longer equals the expected rows.

| Case | The one change | Result | What it shows |
| --- | --- | --- | --- |
| M1 | The lifted part is left out | 0 rows | The hand-written fixture cannot answer alone. |
| M2 | The two `grantsRole` triples are removed from the lifted part | 0 rows | The role is read through the grant. This is gate 8's planted mistake. |
| M3 | Each grant's four triples are replaced by `<member> inv:grantsRole <role>` | 0 rows | A role put on the member directly is not an answer (decision 40). |
| M4 | `test_RaviWorks`'s `role` is `editor` in the member row | Row 1 has `inv:MemberRoleScheme-editor` | The answer comes from the record's value. |
| M5 | A mutant query reaches the grant through the person: `?member inv:membershipOf ?person . ?other inv:membershipOf ?person . ?grant inv:grantedTo ?other` | 4 rows | The fixture tells a query that forgets the tenant from one that does not: it would report Ravi as admin of the second organization. |

## 6. The gates

Decision 95 builds gates 1 to 9. Gates 5 and 7 read the enrolment list of section 3.7 (decision 99). The table says
where each runs and what it reads; the subsections give each gate's rules and its one planted mistake.

| Gate | Name | Runs in | Where the test is | Reads |
| --- | --- | --- | --- | --- |
| 1 | Byte-compare | `check` (`test`) | `packages/ontology/test/Generated.test.ts` | The projector's output in memory; the three committed files under `generated/` |
| 2 | Re-parse | `check` (`test`) | the same file | The three files' text, parsed with N3.js; the triples the writer was given |
| 3 | Forbidden constructs and the namespace guard | `check` (`test`) | the same file | The parsed triples of the three files |
| 4 | Vocabulary coherence | `check` (`test`) | `packages/ontology/test/Coherence.test.ts` | The vocabulary value; `packages/ontology/exceptions/no-gist-parent.json`; the `rat-` records |
| 5 | Record pointers on the AST | `check` (`test`) | `packages/ontology/test/Pointers.test.ts` | `enrolment.json`; `Enrolled.ts`; each enrolled schema's AST; the vocabulary value |
| 6 | The type-check | `check` (`check`) | Every package's type-check; `packages/kernel/test/TermsPointer.types.test.ts` | Source |
| 7 | `laws ontology-terms` | `check` (root task `//#ontology-terms:check`) | `packages/tooling/tool/cli`; its test `test/OntologyTerms.test.ts` | Source text of every workspace's `src` and `test` code files; `enrolment.json` |
| 8 | The question suite | `check` (`test`) | `packages/ontology/test/Questions.test.ts` | `threadGraph()` in memory, loaded into Oxigraph; `CQ-P06.rq` |
| 9 | The reasoner | `check:full` (`reason`, a task of `@inventory/ontology`) | `packages/ontology/scripts/reason.ts` | `generated/inventory.owl.ttl`, `generated/fixtures/CQ-P06.graph.ttl`, `fixtures/reason/*.ttl` |

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
  carries only `rdf:type owl:Class`, `rdfs:subClassOf` and `owl:disjointWith`. A `skos:` subject carries only
  `rdf:type owl:AnnotationProperty`.
- Every other subject is one of the two document IRIs, or under `<base>/data/` or `<base>/fixture/` in the graph
  file.
- Every IRI is under `<base>`, the gist namespace, or the `rdf`, `rdfs`, `owl`, `skos`, `dcterms` or `xsd` namespace,
  except the one object of `dcterms:source`. No IRI is under a real organisation's host (decision 7).
- No blank node.

**Planted mistake.** `packages/ontology/fixtures/negative/gate3-sameAs.ttl` holds the two prefixes and the one triple
`inv:Tenant owl:sameAs inv:Organization .` The test parses it and gives the triples to gate 3 as an OWL file; the gate
reports the predicate. It is planted in a Turtle fixture, not in a `.ts` file, because gate 7's rule 4 scans code
files for that text and does not scan `fixtures/` (6.7). So the stray `owl:sameAs` of decision 95's rationale fails in
gate 3 alone (findings 01-gates.fable#5, 06-testing.fable#6).

### 6.4 Gate 4, vocabulary coherence

A pure function over the vocabulary value, the exception list and the `rat-` records. Its rules for the thread:

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
| C12 | Every term and every exception entry names a `rat-` record that exists and reads `decision: accept`, and whose `proposal_ref` equals the proposal the term names; no two of the classes, properties and schemes name the same record | 22 terms, 1 entry |
| C13 | The version is three numbers, and `0.y.0` before publication (decision 24) | `0.1.0` |

Decision 97 settles the conflict four findings name (03-schema.grok#1, 05-ontology.astra#1, 07-provenance.astra#1,
09-reuse.grok#2, 10-evolution.astra#1): report 05's rule V25 let only a category class be parentless, and its rule
V17 excepted `Role` on identity only. C4 replaces V25 for the thread. Category classes are open decision 12's, so C4
admits no other case.

The exception list is `packages/ontology/exceptions/no-gist-parent.json`: an array of
`{ "class": "inv:Role", "reason": "...", "ratification": { "record": "...", "proposal": "..." } }`. It is a file apart
from the module on purpose: the module says `none`, the list says who allowed it, and the gate compares the two.

The `rat-` records are read as text from
`explorations/erp-ontology/assets/audit/*/governance/ratifications/rat-*.yaml`. The gate needs three top-level scalars
of each (`id`, `proposal_ref`, `decision`), which it reads by line; no YAML library is added. A concept listed in
its scheme's ratified proposal names the scheme's record; a concept added later names its own (decision 101).

**Planted mistake.** In the test, a copy of the real vocabulary value is made in which `Grant`'s parent is
`{ kind: "none", reason: "planted" }`, and the gate is run with the real exception list. It reports C4 naming
`inv:Grant`. This is expressible in the term model as designed: `none` is a legal parent, so the copy type-checks and
gate 6 is silent; it is a value in a test, so gates 1, 5 and 7 never see it. The earlier planted mistake, a class
under two disjoint parents, cannot be written: a class has one `parent` field (findings 01-gates.fable#4,
03-schema.grok#5, 06-testing.fable#5, 08-docs.fable#3). Disjointness is gate 9's to show.

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

P11's exception is `membershipOf` (3.3). Gate 8's guard requires that each fixture-only property does occur in the
hand-written fixture, so the exception cannot hide an unused term.

**Planted mistake.** The test builds `S.Struct({ ...Member.fields, name: DisplayName })` with `Member`'s class pointer
and gives it to the gate in place of `Member`. It reports P3 naming the field `name`. The struct is a value in a test:
it compiles (gate 6), it is not an enrolled export (gate 7), and gate 4 reads no record.

### 6.6 Gate 6, the type-check

Nothing new runs: it is the repository's type-check. What makes it a gate is that the helpers are typed by the
registries, so these do not compile:

```ts
// packages/kernel/test/TermsPointer.types.test.ts (sketch)
// @ts-expect-error a property where a class is wanted
aboutClass("inv:membershipIn")
// @ts-expect-error a class where a property is wanted
aboutProperty("inv:Member")
// @ts-expect-error a misspelt class
aboutClass("inv:Organisation")
// @ts-expect-error a misspelt notation
aboutPath([{ property: "inv:grantedTo", reverse: true, node: "inv:Grant",
  fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-organizaton" }] },
  { property: "inv:grantsRole" }])
```

**Planted mistake.** `aboutProperty("inv:Member")`: a real term of the wrong kind. Each `@ts-expect-error` line is the
planted mistake kept in the tree: if a helper ever accepted it, the unused directive would fail the type-check. Gate 7
passes the line (a helper called with a string literal) and gate 5 never sees a file that does not compile.

### 6.7 Gate 7, `laws ontology-terms`

A source law in `@beep/repo-cli`, run as `bun run beep laws ontology-terms` and as the root task
`//#ontology-terms:check` in all three checks. It reads source text; it imports no package of the repository. The
rules that run in the thread:

| Rule | What it refuses | Runs in the thread |
| --- | --- | --- |
| 1 | An export on the enrolment list whose declaration carries no helper call. Recognised forms: an `S.` or `Schema.` chain, `LiteralKit(...)`, a class extending `S.Opaque` or `S.Class` over one, and `class X extends Model.Class<X>("X")(fields, annotations)` with the helper in the second argument. A `collection` entry is exempt | yes |
| 1b | A helper call in a declaration that is not on the enrolment list: a mark no gate checks | yes |
| 2 | An Alchemy block without a pointer | no: no block is enrolled |
| 3 | A helper called with anything but string literals | yes |
| 4 | The text of `owl:inverseOf`, `owl:sameAs`, `owl:equivalentClass`, `owl:imports`, `owl:hasKey`, `skos:narrower` or `skos:hasTopConcept`, as a CURIE or as a full IRI, in any `.ts`, `.tsx` or `.mjs` file git would commit, outside the law's own source and test | yes |
| 5 | The literal `https://example.org/inventory-import` in any code file but `packages/kernel/src/Terms.vocab.ts` | yes |
| 6 | The annotation keys `term`, `path` or `noTerm` written by hand in an annotation object, anywhere but `packages/foundation/modeling/vocabulary/src/Pointer.ts` | yes |
| 7 | In `packages/kernel/src`, an import of `Terms.vocab.ts` that is not `import type`, from any file but the `./Terms` entry; and an import of `@inventory/kernel/Terms` from any package but `@inventory/ontology` | yes |

Rule 4 scans code files only. Generated Turtle is gate 3's, on parsed triples, and the Turtle and SPARQL files under
`packages/ontology/fixtures/` are not code files. So the two gates do not overlap and neither's planted mistake trips
the other.

Rule 7 is the proof that no browser bundle carries the vocabulary (decision 9). The app's
`scripts/bundle-report.mjs` cannot be that proof: it prints, per chunk over 2 kB, the eight largest owners, and names
a workspace file by its path from `src/` without the package (finding 02-architecture.astra#5 is right about it). The
law proves it from the imports instead: the value is reachable only through `./Terms`, and only the projector's
package imports that.

**Planted mistake.** In the law's own test, a fixture source text declares an enrolled record with
`S.annotate({ term: "inv:Member" })` written by hand. Rule 6 reports it. The CURIE is spelt right, so gate 5 would
accept the AST and gate 6 the types; only the source shows that the typed helper was bypassed.

### 6.8 Gate 8, the question suite

The test loads `threadGraph()` into Oxigraph, runs `CQ-P06.rq`, and compares the rows with section 5.3. It then runs
the five must-fail cases of section 5.4 and the two guards of section 4.4.

**Planted mistake.** M2: the two `grantsRole` triples removed from the lifted part. The suite reports both expected
rows missing. Gate 5 is silent (the marks are unchanged), and gate 1 is silent (the committed graph file is
unchanged; the removal is in memory).

### 6.9 Gate 9, the reasoner

`reason` is a task of `@inventory/ontology`, never a root task, named in the root `check:full` (decision 25). It runs
ROBOT with HermiT twice and fails, never skips, when Java or the jar is missing:

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
list, the enrolment list, `fixtures/` and `generated/` by `$TURBO_DEFAULT$`. The one input that is neither is the
`rat-` records: without it, deleting a record would replay gate 4's last pass (findings 01-gates.fable#7,
02-architecture.astra#4, 07-provenance.astra#6; the last names a path, `explorations/erp-ontology/governance/`, that
is not where the profile puts them).

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
        "$TURBO_ROOT$/explorations/erp-ontology/assets/audit/*/governance/ratifications/**"
      ]
    },
    "reason": {
      "dependsOn": ["transit"],
      "inputs": [
        "generated/**",
        "fixtures/reason/**",
        "scripts/reason.ts",
        "robot.lock.json"
      ]
    }
  }
}
```

`reason` reads only committed files: the two generated ones (which gate 1 holds equal to the projector's output), the
negative fixture, its own script, and `robot.lock.json`, the pin of the jar and of Java that Benjamin approves
(release, URL, sha256, size). The thread keeps no question file under `explorations/`: the query and fixture are in
the package, so `assets/requirements/**` is not an input.

The root task `//#ontology-terms:check` takes the inputs the other source laws take, plus
`packages/ontology/enrolment.json`.

## 7. The package map and the boundaries

### 7.1 Three homes (decision 9)

| Package | Path | `beep.family` | Holds | Entries |
| --- | --- | --- | --- | --- |
| `@beep/vocabulary` (new) | `packages/foundation/modeling/vocabulary` | `foundation` | The metamodel schemas (`Vocabulary`, the class, property, scheme and concept terms), gate 4's rules as a pure function, the pointer helpers' generic makers and the reader of marks from an AST, and the RDF registry of 7.3 | `./Model`, `./Rules`, `./Pointer`, `./Rdf` |
| `@inventory/kernel` (two new entries) | `packages/kernel` | `kernel` | `src/Terms.vocab.ts`: the vocabulary value and the registries' types. `src/Terms.pointer.ts`: the five bound helpers | `./Terms`, `./TermsPointer` |
| `@inventory/ontology` (new) | `packages/ontology` | `ontology` (new) | `src`: the projector, the writer, the lift, `threadGraph`, `Enrolled.ts`. `generated/`, `fixtures/`, `exceptions/`, `enrolment.json`, `scripts/write.ts`, `scripts/reason.ts`, `test/` | none: nothing imports it |

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
| `packages/ontology/generated/inventory.owl.ttl` | The gist classes and pairs, the seven classes, the nine properties, the declarations of the three annotation properties, the four individuals | `<base>/ontology` | `<base>/ontology/0.1.0` |
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
| 01-gates.fable#7 | Settled | 6.10: one input list for `test` and one for `reason`, with the `rat-` records |
| 02-architecture.astra#1 | Settled | 3.2 and 7.2: `pathFor` is generic, the kernel binds it; no foundation to kernel import |
| 02-architecture.astra#2 | Settled | 7.3: a registry of this repository's own extends the vendored one; `Vocab.ts` is not edited |
| 02-architecture.astra#3 | Settled | 3.3: the five real fields; decision 93 records the correction |
| 02-architecture.astra#4 | Settled | 6.10: the ratifications folder is a `test` input |
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
| 07-provenance.astra#6 | Settled; the path it names is false | 6.10. The records are under `assets/audit/<audit>/governance/ratifications/` (`project-profile.md`), not `explorations/erp-ontology/governance/` |
| 07-provenance.astra#7 | Settled | Decision 98, as 05-ontology.astra#7 |
| 07-provenance.astra#8 | Settled | 6.9: the pair is inferred through `gist:PhysicalIdentifiableItem`, and the three copied pairs are named in 2.1. The brief's wording is that file's |
| 08-docs.fable#1 | Settled | 3.5 |
| 08-docs.fable#2 | Settled | 3.6 |
| 08-docs.fable#3 | Settled | 6: one planted mistake per gate, stated once |
| 08-docs.fable#4 | Settled | 3.3; `removedAt` is not a thread term (1.3), so the brief's example of it has no field to sit on |
| 08-docs.fable#5 | Settled | Decision 24 is answered; 8 |
| 08-docs.fable#6 | Settled | 1.5 names both things owed |
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

One is open. It is not answered here, and the design does not rest on its answer except where the row says what
waits.

| # | Question | Options | What waits |
| --- | --- | --- | --- |
| 1 | The reasoner (decision 25): do you approve the ROBOT jar and the Java pin once the builder has named the release, its source, its hash and its size, and does `check:ci` run the reasoner too? | (a) approve, `check:full` only; (b) approve, `check:full` and `check:ci`; (c) not yet | Gate 9. Gates 1 to 8 do not wait |

Two questions this report raised are decided:

- **The People page's `Person` record (decision 100).** Its `email` and `joinedAt` fields, whose terms are the party
  slice's, are both `noTerm`, reason deferred, naming the party slice (3.6). The record stays on the thread's list.
- **A concept's ratification (decision 101).** The ruling on a scheme covers the concepts listed in the proposal
  Benjamin sees; a concept added later to a ratified scheme is a proposal of its own. The thread needs 18 rulings:
  seven classes, nine properties and two schemes.

Beyond these, section 1.5's second item stands: the 18 records themselves are owed, one per term proposal, and
section 2 is the text they would ratify, including the wording marked new (`action`, `recordedAt`, `grantScope`),
`Grant`'s one criterion and the exception entry for `Role`.

### 9.3 What other files say that this report replaces, for the thread only

For the later edit that makes them defer to this report. None was changed here.

| File | What it says | What holds |
| --- | --- | --- |
| `BRIEF.md` | Five thread properties; enrolment of "the access contract and the four kernel records"; an email on `Member`; gate 4's planted mistake a class under two disjoint parents; 63 open decisions including 24; a copied `Person` and `Organization` pair | 2.2; 3.7; 3.3; 6.4; 62 open, 24 answered; 6.9 |
| Report 05 | The `Member` sketch with `personName` and `email`; missing OWL terms added to the vendored list; `aboutPath` typed in the foundation package; V25; V15's binding for the link to the person; a hardcoded namespace; a loose concept name type | 3.3; 7.3; 3.2; 6.4 C4; 6.5 P11; 2.6 |
| Report 06 | `Grant`'s two criteria; local disjoint pairs; `auditAction`, `recordTime` and the other audit keys; `AuditTrail` keeping `Activity`'s pointer; `Membership` and `OrganizationChoice` pointed in the thread | 2.1; 2.1; decision 98 and 2.2; 3.5; 3.6 |
| Report 12 | No access row lifted in the thread; path rules without case (c); `rdf:type` objects checked against the predicate table; rule 4 scanning generated files; `assets/**` as a `test` input | 4.4; 4.3; 6.3; 6.7; 6.10 |
| Report 13 | The thread's `Member` marks naming a sign-in email; enrolment by folder; 63 open | 3.3; 3.7; 62 |
| Report 04 | CQ-P06's must-fail text and the "non-removed" companion; fixture individuals under the ontology namespace | 5.4; 4.1 |
| `gist-categories.md` | No rows for `gist:LivingThing`, `gist:TemporalRelation`, `gist:Assignment`; disjointness copying "open" | 2.5 |
| `project-profile.md` | Lists as undecided what decisions 9 to 11, 15, 20 and 24 answered | Those decisions |

## 10. What was not checked

- **Nothing was compiled or run.** No tool here runs a command, so no sketch was type-checked, no Turtle parsed, no
  query executed, and `bun run docs:check` was not run on this file.
- **gist itself.** The pinned `gistCore.ttl` is kept outside the repository and was not opened. The parents of
  `gist:LivingThing`, `gist:TemporalRelation` and `gist:Assignment`, the three disjoint pairs, the absence of any other
  stated pair among the seven classes, and gist's version IRI rest on report 11 and `gist-categories.md`.
- **The types of the `Model.Class` sketch.** That `Model.fieldEvolve` with `S.annotateKey` leaves each variant's type,
  and so the class's field types and constructor default, as they are was read from signatures, not compiled. That
  `S.resolveAnnotations(Activity)` returns the class annotations follows from `Schema.ts` 17660 to 17701 and was not
  run. `effect/schema/Model` and `VariantSchema` are marked unstable.
- **Small type facts.** That `$I.annoteSchema`'s extras and `nullAsNone`'s argument accept the helpers' spread keys;
  that an `S.Opaque` class exposes `fields` as gate 5's planted mistake uses it; the name of the array node's element
  field that rule P12 reads; that `mergeVocab` keeps the literal types of an extended `owl` entry; whether
  `CoreVocab`'s `rdf` terms include `type`.
- **Erasure.** That `import type` of `Terms.vocab.ts` keeps the value out of every bundle is the compiler's and the
  bundler's behaviour; rule 7 of the law holds the import structure and was designed, not run. The root tsconfig's
  module settings were not opened for this.
- **Reading files outside the package in a test.** Gate 4 reads the `rat-` records under `explorations/`. Whether that
  is a `?raw` glob import or `node:fs` under the documented `nodeBuiltinImport:off` comment, and whether `laws
  boundaries` accepts a relative glob that leaves the package, was not tried. The same for importing
  `enrolment.json`.
- **The `rat-` chain beyond the record.** The ratification schema's fields were read. The proposal file a
  `proposal_ref` points at (`otp:`) was not, so rule C12 checks the record and the reference, not that the proposal's
  text is the term's.
- **ROBOT.** Its commands and flags, the Java version it needs, the jar's release, size and hash, and whether the
  merged file passes the OWL 2 DL profile check as designed (undeclared fixture individuals, the three annotation
  property declarations). ROBOT is not installed and nothing was downloaded.
- **N3.js and Oxigraph.** Neither is installed; their APIs were not read.
- **Turbo and the sync commands.** Whether a package's `turbo.json` may declare a task the root file does not name
  (`reason`), how `config-sync` writes the task lists of the three root checks and a new package's scripts, exports and
  tsconfig references, and the exact inputs the existing source-law root tasks declare.
- **The stored tables.** No migration was opened. That the stored member row's `userId` links a sign-in account and
  not the human is report 06's statement.
- **Other reports.** Reports 07, 08 and 09 were not reopened; the verdicts on findings about them rest on the
  findings' own text. Report 06's property labels were not copied: the labels in 2.2 are written here.
