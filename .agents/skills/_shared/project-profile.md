# Project profile: inventory-import

This file is this repository's own and is not in beep-effect. Every ontology skill reads it first. Where it and a
skill or another `_shared` file disagree, this file wins. Where it and `CLAUDE.md` or the packet's `DECISIONS.md`
disagree, they win and this file is out of date: say so.

The ontology work lives in the exploration packet `explorations/erp-ontology/`. Its `DECISIONS.md` holds the decisions
below with their reasons; its `research/` reports hold the evidence. `explorations/erp-ontology/research/14-thin-thread.md`
is the specification of the first deliverable, the thin thread. The thread is built (`goals/erp-vocabulary`), and so is
slice 1, the party slice (`goals/party-slice`), whose terms are report 18's text (`research/18-party-slice-terms.md`)
as decision 176 accepted it. Each goal's `PLAN.md` records what was built.

## What is decided

| # | Decision | What it changes in a skill |
| --- | --- | --- |
| 1 | The ontology is the model of record for this repository's contexts (catalog, access, and those to come); Sutton is a mapping | Scope and competency questions come from this repository's records and rules, not from a published domain ontology |
| 2 | One hand-written TypeScript vocabulary module owns every term fact: IRI, label, definition, parent, disjointness, kind or role tag, SKOS scheme, alignment. Record schemas (Effect Schema) carry a typed pointer to a term and own their record rules. All Turtle (OWL, SKOS, SHACL) is generated | No skill edits a `.ttl`, `.owl` or SHACL file, and none proposes ROBOT templates, KGCL, rdflib, OWLAPY or LinkML as the way to change a term. A change to a term is a proposed change to the vocabulary module; a change to a required field, datatype, pattern or allowed value is a proposed change to a record schema |
| 3, 34, 89, 125 | A Sutton Account (`Company`) is an `Organization` when its kind is `company` and a `Person` when it is `individual` (decision 125), not a relationship class. Its customer and vendor flags belong to the tenant's `SourceRecord` (decision 34), stated only on a record of a trading account (decision 168). They are the only two: carrier and contract manufacturer are not flags (decision 89) | Do not propose a trading-relationship relator or role classes for accounts unless Benjamin reopens this |
| 4 | The upper ontology is a small projection of gist (Semantic Arts). IOF and ISA-95 are alignments only | The scope document records gist. Use `gist-categories.md`, never `bfo-categories.md`. An IOF or ISA-95 match is an alignment row, never an import or a parent |
| 5 | A small local projector writes the Turtle from the vocabulary and the Schema AST | Generated files are read-only inputs to checks |
| 6 | Checks: generated Turtle byte-compared and re-parsed in `bun run check`; an OWL reasoner in `bun run check:full`; SHACL over the stored rows of the messy sample as a later slow test | The validator reports against these gates; decision 25 names the reasoner |
| 7 | The namespace is an `example.org` placeholder until something is published | Never mint an IRI under Sutton's name or any real domain. Never use a customer's subdomain |
| 8 | The thin thread comes before the party slice | Answer CQ-P06 through the lift of `Member.role`, with generated OWL and SKOS. Follow report 14, not the earlier sketches |
| 9 | `@beep/vocabulary` owns the metamodel and reusable rules; `@inventory/kernel/Terms` owns the terms; `@inventory/ontology` owns the projector and generated files | Records use `@inventory/kernel/TermsPointer`, which imports the registry as types only. Production code outside the projector package never imports it |
| 10 | Classes, properties and schemes sit under `https://example.org/inventory-import/ontology/`; scheme keys end in `Scheme` | Name a concept `<SchemeKey>-<notation>` there. Keep documents, shapes, data and fixtures under the same base by layer; name a node created by a lift from its parent's IRI and field path |
| 11 | Use `skos:prefLabel` and `skos:definition` in English | Write both with `@en` |
| 13 | Admit a gist name when a term in the slice needs it | Add the name to `gist-categories.md` then |
| 14 | Include each admitted class's named gist ancestors | Copy their names and subclass links |
| 15 | Copy the `owl:disjointWith` pairs gist states between admitted classes | Do not add other gist pairs |
| 16, 150 | Copy a taken gist property's named `rdfs:subPropertyOf` links, never its domain or range. None of the five the module takes has one, and the module's field for one comes with the first term that needs it (decision 150) | Put a local property under it only if the local domain and range fall under its own |
| 20 | `aboutClass`, `aboutProperty` and `aboutScheme` write `term`; `aboutPath` writes `path` | Use helpers typed by term kind. Augment Alchemy's `Annotations` when a slice enrols its first block |
| 21, 98 | `noTerm` takes one of six reasons: transport, request, screen, error, bookkeeping, deferred | For deferred, name the slice that will place the field |
| 22 | Every field of a pointed record has a pointer or a `noTerm` reason | Generate closed SHACL shapes when the SHACL slice comes |
| 23 | A record stores the notation; the projector lifts it to the scheme concept's IRI | Every allowed code must belong to the scheme. List only the field's own concept IRIs in `sh:in` |
| 24, 144 | Write the semantic version in the module, never from the clock. The thread started at `0.1.0`; the party slice moved it once, to `0.2.0` (decision 144) | Before publication advance `y` in `0.y.0` for every change and note breaks in the release notes. `1.0` is the first published namespace |
| 25 | ROBOT with HermiT checks the OWL 2 DL profile and consistency in `check:full` | The jar, the Java pin and CI are settled by decisions 112 to 114. Any other release is approved first with its file, source, hash and size |
| 26 | Vitest uses N3.js to re-parse Turtle and Oxigraph for SPARQL | Add shacl-engine for SHACL Core only with the SHACL slice |
| 32, 101 | The module admits only terms backed by Benjamin's `rat-` record. A scheme ruling covers the concepts listed in its proposal; a later concept needs its own ruling | Decision 107 amends both for the thin thread, and decision 129 for the party slice (next two rows). A concept added later to a scheme still needs a decision of its own |
| 107, 111 | For the thin thread the foundational audit is advisory (two runs, every proposal failed; report 15). Its 18 terms are accepted as a set and name decision 111 in the module, not a `rat-` record | A thread term's `ratification` is `{ decision: <n> }`, a decision of the packet's `DECISIONS.md`. A later slice may still use the auditor and `rat-` records; that is decided with the slice |
| 129, 176 | The party slice's terms are report 18's text, accepted as one set by decision 176; each new term, `Member`, `membershipIn` and `Party`'s exception entry name 176, and `Person`, `Organization` and `grantScope` keep 111 with their new links | A party-slice term's `ratification` is `{ decision: 176 }`; a change to one is a decision of its own (decisions 24 and 33) |
| 112 | ROBOT v1.9.11 is approved: `robot.jar`, 82,708,624 bytes, sha256 `53cd275c…ab26`, from the release's GitHub URL; tried under Java 17.0.2 | Gate 9 fetches that file, checks that hash and keeps the jar outside the repository. Report 14, 6.9, has the full hash and URL |
| 113 | The reasoner pin names Java 17 by its major version | Compare the major version only; patch levels may differ between machines |
| 114 | Gate 9 also runs in a CI job of its own, the jar restored from a cache keyed by its sha256 | The job fetches the jar only when the cache has none, checks the hash, then runs gate 9 |
| 117 | The thread carries three to five forbidden conclusions, in the goal's SPEC, each with a fixture to refuse and a near miss to pass | The five are signed in `goals/erp-vocabulary/SPEC.md` (decision 121) |
| 118 | The expected rows are the lock on competency answers: no lock file, no update flag | A commit that changes an expected-rows file says so; the release notes name the question with its old and new answer |
| 34 | `Person` is the human and `Organization` the real body. The tenant's `SourceRecord` links to the party by `recordOf` | Reidentify the record by tenant, source system, source type and exact source id. Join possible matches only by an `IdentityDecision` |
| 38 | `Tenant` is a role class under `Organization`, keyed by `OrganizationId` | `membershipIn` ranges over `Tenant`, not any organization |
| 39, 43, 126 | A `ContactAssignment` links one person to one account, for a source that records a contact's purpose. A Sutton record's purpose is on its address (decision 126) | Put the purpose and contact point on that assignment; never make one up for a Sutton record |
| 40, 96 | A `Grant` links a member, a role and a scope. Lift `Member.role` to one grant at organization scope | Set `grantScope` to the organization concept of `GrantScopeKindScheme`; other scopes wait |
| 41, 97 | Viewer, editor and admin are `MemberRoleScheme` concepts and `Role` individuals under the same IRIs | `Role` has no gist parent until `permits` exists. Gate 4 checks every parentless class and its reason against a committed list of exceptions ratified by Benjamin |
| 46 | The audit record's term is `AuditEntry`, with alternative label Activity | Leave the page and record names alone |
| 93, 94 | The fixture links two memberships to one `Person`, admin in one tenant and viewer in the other | The thread marked `Member.name` and `Member.organizationName` `noTerm` for the screen; the party slice gives them paths, the person's name through the person and the organization's name through the tenant (decisions 133 and 161). The kernel's `Member` has no email or person id |
| 95, 99 | Build gates 1 to 8 in `check` and gate 9 in `check:full` and in a CI job of its own (114), each with a test that plants a mistake | Enrol by record for gates 5 and 7 (`packages/ontology/enrolment.json`): kernel `Member`, `Role`, `Activity`, and since the party slice `AgentRun`; access contract `Person`, `AuditTrail`, and since the party slice `OrganizationChoice`, `ModelCallPurpose` and `Membership` (`noTerm`). No stored rows |
| 98 | Mark `Activity` with `recordedActor` (to the member), `action`, `recordedAt` and `inTenant` | The copied actor name and detail are for the screen. The party slice places the agent through `recordedAgentRun` to the run's `agentName` (decision 135). The thread does not lift audit entries |
| 100 | The People page's `Person` describes a membership, not the human | Keep it enrolled as `Member`. The party slice places `joinedAt`, and `email` through `memberAccount` to the account's `accountEmail` (decision 134) |
| 12, 18 | A class has one identity-bearing parent and any number of local category parents; `Party` is a category over `Person` and `Organization`. The kind tag takes nine values, on classes only: kind, subkind, role, phase, relator, event, information, category, value | Tag each class with one of the nine; a category carries no identity criterion |
| 27 | Each competency query walks `rdf:type/rdfs:subClassOf*` itself and runs in `check`, with no reasoner | Write every query with that walk; the reasoner stays gate 9 |
| 29 | A term of a standard with no RDF namespace (Sutton's "Company") is a named external term: the standard, the name as written and a public document, emitted only as a row of the generated SSSOM file | Never mint a local IRI for it, and never write it as a `skos:*Match` triple |
| 33 | A retired term is `owl:deprecated true`, with `dcterms:isReplacedBy` its successor at that retirement and the version as `skos:historyNote`; its logical axioms are dropped, and a retired notation still decodes in a stored row | Write a retirement this way; screens offer only live concepts |
| 35 | Every role flag and classified field of a stored record is stated: true or false, or a concept | A question may read a stated false; a source that says nothing leaves the record waiting as Needs a decision |
| 36, 148 | Named `test_` fixtures in the packet prove the party model: `explorations/erp-ontology/assets/requirements/cq/` | Say which fixture a party question runs on |
| 37 | A new party context owns organizations, contacts, addresses, identifiers and identity decisions, its contract made when their first record is built; access keeps members, grants, agents and the audit trail | Name that context for a party record; none is stored yet |

Decision 4 names only IOF and ISA-95. Treating schema.org, W3C ORG, FIBO, EPCIS, GS1, UN/CEFACT and GoodRelations as
alignment-only too follows from it (gist is the only parent) and was not decided by name.

Rules from the reports, not numbered decisions (state them as the report's, and put a challenge to Benjamin):

- No `owl:sameAs` for deduplication: two records that may be one party are settled by a recorded identity decision
  (report 01, `IdentityDecision`).
- No `owl:inverseOf`: a reverse relation is a SPARQL `^p` path (report 02). The repository law is `bun run beep laws ontology-terms` (root script `ontology-terms:check`, part of `bun run check`).
- On an identity card, put the `SourceRecord` key from decision 34 in `reidentification_key`, never a name or SKU.
  One company known to two tenants is one party with two records.
- An inventory measure (Available, Committed, Reserved) is not one enum because they overlap (report 01).

## Not decided, and asked of Benjamin when a skill needs it

- No place-of-business class: gist 14.1.0 has no Place class and deprecates `gist:Building` and `gist:Landmark`.
- Which annotation vocabularies the module may emit beyond those report 14 uses, and whether license metadata is wanted.

The skills write alignment rows with the `skos:*Match` predicates only (report 02 shows `closeMatch`; no decision
names the set); a gist parent is `subClassOf` in the vocabulary, never a mapping.

Beware: `gist:Account` is an agreement with a balance, not the Sutton Account (decision 3).

## What exists today, and what does not

- Exists: the packet, including the brief, the decision register and research reports 01 to 18. Read the Answered
  section before treating a report's "(pending Qn)" as open. A fact from an untracked file cannot be pinned to a
  commit until Benjamin commits it.
- Built, the thin thread and the party slice:
  - The vocabulary module `packages/kernel/src/Terms.vocab.ts` (17 classes, 62 properties, 9 schemes, 28 concepts:
    the thread's 22 terms and the party slice's) and
    its helpers `packages/kernel/src/Terms.pointer.ts`. `@beep/vocabulary` is `packages/foundation/modeling/vocabulary`.
  - The projector and the gates are `packages/ontology` (`@inventory/ontology`). `bun run ontology:write` writes
    `packages/ontology/generated/inventory.owl.ttl`, `inventory.skos.ttl` and `generated/fixtures/CQ-P06.graph.ttl`.
  - CQ-P06 and CQ-P11 run in `packages/ontology/test/Questions.test.ts` (Oxigraph). Their queries are in
    `packages/ontology/fixtures/cq/`. They answer over a hand-written two-organization fixture and the lift of two
    member rows, not over the stored rows of the messy sample. The party questions (CQ-P01 to CQ-P05, CQ-P07 and
    CQ-P09's party half) run in the same file, their queries and `test_` fixtures in
    `explorations/erp-ontology/assets/requirements/cq/` (decision 148), beside `model-call.ttl` and
    `sutton-party.ttl`, which state properties no question reads.
  - The repository law is `bun run beep laws ontology-terms` (root script `ontology-terms:check`, part of `bun run check`).
  - The reasoner step is ROBOT v1.9.11 with HermiT under Java 17, pinned in `packages/ontology/robot.lock.json`,
    run by `packages/ontology/scripts/reason.ts`. That file is the turbo task `reason` of `@inventory/ontology`, part
    of `bun run check:full` and of the CI job `reason` (decisions 112, 113, 114). The script fetches the jar into
    the user's cache folder. ROBOT is not on the PATH.
- Not built: SHACL over the stored rows of the messy sample, alignments (SSSOM rows), any term beyond the module's,
  and every slice after the party slice. A skill says "not built" for those, and never reports a check as run that has no code behind it.
- ROBOT and oaklib are not installed on Benjamin's machine. ROBOT v1.9.11 is the approved release (decision 112): the
  gate 9 script, not a skill, fetches it into the cache. `uvx` is, so `uvx --from oaklib runoak`,
  `uvx --from sssom sssom` and `uvx pyshacl` run. `uv run --no-project --with rdflib` may read and query an external
  or generated file. None of them writes this repository's terms. On gist (labels in `skos:prefLabel` only) a
  `runoak lexmatch` wrote 0 rows and exited 0, with or without a `skos:prefLabel` rule, and `runoak info` printed no
  label (2026-11-22): an empty oaklib result is "not run", never "no match". Do not
  download ROBOT or any other file without asking (name the file, its source and its size).
- The gist reference copy: release 14.1.0, `ontologies/gistCore.ttl` at tag `v14.1.0` of
  https://github.com/semanticarts/gist, sha256 `0d8230f3a4df9aa7782ec79bfa83def34a13a066f60d5f5ef0f00b9cecce08b1`.
  Kept outside the repository, in a scratch folder; fetched only after asking, and checked against that sha256.

## Where a skill writes

- Working files go in the packet, never in `docs/` (a checked knowledge bundle) and never in `ontologies/{name}/`:
  a report is `explorations/erp-ontology/research/NN-title.md` with frontmatter (`type`, `title`, `description`);
  data beside it goes in `explorations/erp-ontology/assets/`. Every `.md` under `explorations/` needs that
  frontmatter. Run `bun run docs:check` after adding one.
- Fixed paths, so one skill's output is the next one's input:
  - Scope and competency questions: `explorations/erp-ontology/assets/requirements/scope.md` and
    `explorations/erp-ontology/assets/requirements/competency-questions.yaml`, written by `ontology-requirements`.
    The auditor's manifest names them (`scope_doc.path`, `cq_suite.path`); nobody copies them.
  - The auditor's tree: `explorations/erp-ontology/assets/audit/<name>/` (`$ONT`), with `work/` and
    `governance/ratifications/`. `.oxfmtrc.json` ignores `explorations/**`, so its digests hold.
  - Mapping candidates: `explorations/erp-ontology/assets/mappings/*.sssom.tsv`. SSSOM is a review format here; a
    published SSSOM, if ever wanted, is generated from the vocabulary's alignment rows.
- For the thin thread and the party slice, a term names the decision of the packet's `DECISIONS.md` that accepted it
  (decisions 107 and 111, 129 and 176); there is no `rat-` file. For a later slice, a ratification may be Benjamin's answer scribed in a `rat-` file
  under `$ONT/governance/ratifications/`, the record the conceptualizer, architect, mapper and curator read, with a
  one-line mirror in `DECISIONS.md`; that is decided with the slice.
- Hand-written fixture Turtle (instance data for a competency question, never a term fact) may sit under
  `explorations/erp-ontology/assets/`. No skill writes a `.ttl` that states a term.
- A proposal for terms is written as a diff or a typed TypeScript sketch in a research report, for Benjamin to argue
  with. It becomes code only through this repository's order: schema, then service contract, then implementation.
- Where a skill names another output file (`glossary.csv`, `conceptual-model.yaml`, `property-design.yaml`,
  `axiom-plan.yaml`, `upper-alignment.md`), the content is the same but it is a section of a research report or a
  file under `assets/`, and it is never a second hand-written home for a term fact. The vocabulary module is the home
  and the file is a review note.

## How decisions are made

A product or modelling decision is Benjamin's: he is the steward the skills name. Put it to him as a question with
options, the recommended one first with its reason, through `AskUserQuestion`. A subagent or workflow child without
that tool hands the questions back in its "Needs the person" line and writes no `rat-` record. Write his answer in the
packet's `DECISIONS.md` at once, in his voice, with how to reverse it. Build nothing his answer would change. Start
everything no open decision blocks before asking.

## Commands

The package manager is bun (`bun run <script>`, `bunx`). Tests are Vitest on Node (`bun run test`), never `bun test`.
No agent reads or prints `.dev.vars`. Nothing is committed, pushed or deployed unless Benjamin asks in that message.
An agent seat (a fresh, independent context) is launched as the session's routing rules allow; `CLAUDE.md`
"Sub-agents" names no ontology seat.
