# Project profile: inventory-import

This file is this repository's own and is not in beep-effect. Every ontology skill reads it first. Where it and a
skill or another `_shared` file disagree, this file wins. Where it and `CLAUDE.md` or the packet's `DECISIONS.md`
disagree, they win and this file is out of date: say so.

The ontology work lives in the exploration packet `explorations/erp-ontology/`. Its `DECISIONS.md` holds the decisions
below with their reasons; its `research/` reports hold the evidence. `explorations/erp-ontology/research/14-thin-thread.md`
is the one specification of the first deliverable, the thin thread. It is a design, not an implementation.

## What is decided

| # | Decision | What it changes in a skill |
| --- | --- | --- |
| 1 | The ontology is the model of record for this repository's contexts (catalog, access, and those to come); Sutton is a mapping | Scope and competency questions come from this repository's records and rules, not from a published domain ontology |
| 2 | One hand-written TypeScript vocabulary module owns every term fact: IRI, label, definition, parent, disjointness, kind or role tag, SKOS scheme, alignment. Record schemas (Effect Schema) carry a typed pointer to a term and own their record rules. All Turtle (OWL, SKOS, SHACL) is generated | No skill edits a `.ttl`, `.owl` or SHACL file, and none proposes ROBOT templates, KGCL, rdflib, OWLAPY or LinkML as the way to change a term. A change to a term is a proposed change to the vocabulary module; a change to a required field, datatype, pattern or allowed value is a proposed change to a record schema |
| 3 | A Sutton Account is an `Organization`, not a relationship class. Its customer and vendor flags belong to the tenant's `SourceRecord` (decision 34). Carrier and contract manufacturer were listed here as decided; they are not (the recorded answer names customer and vendor only): packet decision 89 asks | Do not propose a trading-relationship relator or role classes for accounts unless Benjamin reopens this |
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
| 16 | Copy a taken gist property's named `rdfs:subPropertyOf` links, never its domain or range | Put a local property under it only if the local domain and range fall under its own |
| 20 | `aboutClass`, `aboutProperty` and `aboutScheme` write `term`; `aboutPath` writes `path` | Use helpers typed by term kind. Augment Alchemy's `Annotations` when a slice enrols its first block |
| 21, 98 | `noTerm` takes one of six reasons: transport, request, screen, error, bookkeeping, deferred | For deferred, name the slice that will place the field |
| 22 | Every field of a pointed record has a pointer or a `noTerm` reason | Generate closed SHACL shapes when the SHACL slice comes |
| 23 | A record stores the notation; the projector lifts it to the scheme concept's IRI | Every allowed code must belong to the scheme. List only the field's own concept IRIs in `sh:in` |
| 24 | Write the semantic version in the module, never from the clock. The thread starts at `0.1.0` | Before publication advance `y` in `0.y.0` for every change and note breaks in the release notes. `1.0` is the first published namespace |
| 25 | ROBOT with HermiT checks the OWL 2 DL profile and consistency in `check:full` | Before fetching anything, ask Benjamin to approve the Java pin and jar with its release, source, hash and size; `check:ci` inclusion is still open |
| 26 | Vitest uses N3.js to re-parse Turtle and Oxigraph for SPARQL | Add shacl-engine for SHACL Core only with the SHACL slice |
| 32, 101 | The module admits only terms backed by Benjamin's `rat-` record. A scheme ruling covers the concepts listed in its proposal; a later concept needs its own ruling | The thread needs 18 rulings: seven classes, nine properties and two schemes covering four concepts |
| 34 | `Person` is the human and `Organization` the real body. The tenant's `SourceRecord` links to the party by `recordOf` | Reidentify the record by tenant, source system, source type and exact source id. Join possible matches only by an `IdentityDecision` |
| 38 | `Tenant` is a role class under `Organization`, keyed by `OrganizationId` | `membershipIn` ranges over `Tenant`, not any organization |
| 39, 43 | A `ContactAssignment` links one person to one account | Put the purpose and contact point on that assignment |
| 40, 96 | A `Grant` links a member, a role and a scope. Lift `Member.role` to one grant at organization scope | Set `grantScope` to the organization concept of `GrantScopeKindScheme`; other scopes wait |
| 41, 97 | Viewer, editor and admin are `MemberRoleScheme` concepts and `Role` individuals under the same IRIs | `Role` has no gist parent until `permits` exists. Gate 4 checks every parentless class and its reason against a committed list of exceptions ratified by Benjamin |
| 46 | The audit record's term is `AuditEntry`, with alternative label Activity | Leave the page and record names alone |
| 93, 94 | The fixture links two memberships to one `Person`, admin in one tenant and viewer in the other | Mark `Member.name` and `Member.organizationName` as `noTerm` for the screen; the kernel's `Member` has no email or person id |
| 95, 99 | Build gates 1 to 8 in `check` and gate 9 in `check:full`, each with a test that plants a mistake | Enrol by record for gates 5 and 7: kernel `Member`, `Role`, `Activity`; access contract `Person`, `AuditTrail`. No stored rows in the thread |
| 98 | Mark `Activity` with `recordedActor` (to the member), `action`, `recordedAt` and `inTenant` | The copied actor name and detail are for the screen; defer the agent to the party slice. The thread does not lift audit entries |
| 100 | The People page's `Person` describes a membership, not the human | Keep it enrolled as `Member` and defer `email` and `joinedAt` to the party slice |

Decision 4 names only IOF and ISA-95. Treating schema.org, W3C ORG, FIBO, EPCIS, GS1, UN/CEFACT and GoodRelations as
alignment-only too follows from it (gist is the only parent) and was not decided by name.

Rules from the reports, not numbered decisions (state them as the report's, and put a challenge to Benjamin):

- No `owl:sameAs` for deduplication: two records that may be one party are settled by a recorded identity decision
  (report 01, `IdentityDecision`).
- No `owl:inverseOf`: a reverse relation is a SPARQL `^p` path (report 02, the planned `laws ontology-terms` rule).
- On an identity card, put the `SourceRecord` key from decision 34 in `reidentification_key`, never a name or SKU.
  One company known to two tenants is one party with two records.
- An inventory measure (Available, Committed, Reserved) is not one enum because they overlap (report 01).

## Not decided, and asked of Benjamin when a skill needs it

- The full set of kind-or-role tags (decision 18) and how a deprecated term is written (decision 33).
- Which context's contract package owns a party record (decision 1 names catalog and access; no party record exists).
- The data that proves the party model: the messy sample stores items only (vendors are names inside `item.vendors`),
  so a party competency question uses named `test_` fixtures, said in its entry.
- Whether a role flag is always stated true or false (closed) or may be absent (unknown).
- How a later question reads inferred types (decision 27). CQ-P06 needs only asserted types in the fixture.
- No place-of-business class: gist 14.1.0 has no Place class and deprecates `gist:Building` and `gist:Landmark`.
- How a Sutton term is cited: Sutton publishes no namespace, and decision 7 forbids minting under its name.
- Which annotation vocabularies the module may emit beyond those report 14 uses, and whether license metadata is wanted.

The skills write alignment rows with the `skos:*Match` predicates only (report 02 shows `closeMatch`; no decision
names the set); a gist parent is `subClassOf` in the vocabulary, never a mapping.

Beware: `gist:Account` is an agreement with a balance, not the Sutton Account (decision 3).

## What exists today, and what does not

- Exists: the packet, including the brief, the decision register and research reports 01 to 14. Read the Answered
  section before treating a report's "(pending Qn)" as open. A fact from an untracked file cannot be pinned to a
  commit until Benjamin commits it.
- Does not exist yet: the vocabulary module, the projector, any generated Turtle, any SHACL, any competency-question
  suite, the reasoner step. A skill never reports a check as run that has no code behind it; it says "not built".
- ROBOT and oaklib are not installed on Benjamin's machine. `uvx` is, so `uvx --from oaklib runoak`,
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
- A ratification is Benjamin's answer, scribed in a `rat-` file under `$ONT/governance/ratifications/`: that file is
  the record the conceptualizer, architect, mapper and curator read. The packet's `DECISIONS.md` holds a one-line
  mirror of each. Decisions 1 to 7 ratify no term by name, so `Organization` still goes through the auditor.
- Hand-written fixture Turtle (instance data for a competency question, never a term fact) may sit under
  `explorations/erp-ontology/assets/`. No skill writes a `.ttl` that states a term.
- A proposal for terms is written as a diff or a typed TypeScript sketch in a research report, for Benjamin to argue
  with. It becomes code only through this repository's order: schema, then service contract, then implementation.
- Where a skill names another output file (`glossary.csv`, `conceptual-model.yaml`, `property-design.yaml`,
  `axiom-plan.yaml`, `upper-alignment.md`), the content is the same but it is a section of a research report or a
  file under `assets/`, and it is never a second hand-written home for a term fact: once the vocabulary module
  exists, the module is the home and the file is a review note.

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
