# Project profile: inventory-import

This file is this repository's own and is not in beep-effect. Every ontology skill reads it first. Where it and a
skill or another `_shared` file disagree, this file wins. Where it and `CLAUDE.md` or the packet's `DECISIONS.md`
disagree, they win and this file is out of date: say so.

The ontology work lives in the exploration packet `explorations/erp-ontology/`. Its `DECISIONS.md` holds the decisions
below with their reasons; its `research/` reports hold the evidence.

## What is decided

| # | Decision | What it changes in a skill |
| --- | --- | --- |
| 1 | The ontology is the model of record for this repository's contexts (catalog, access, and those to come); Sutton is a mapping | Scope and competency questions come from this repository's records and rules, not from a published domain ontology |
| 2 | One hand-written TypeScript vocabulary module owns every term fact: IRI, label, definition, parent, disjointness, kind or role tag, SKOS scheme, alignment. Record schemas (Effect Schema) carry a typed pointer to a term and own their record rules. All Turtle (OWL, SKOS, SHACL) is generated | No skill edits a `.ttl`, `.owl` or SHACL file, and none proposes ROBOT templates, KGCL, rdflib, OWLAPY or LinkML as the way to change a term. A change to a term is a proposed change to the vocabulary module; a change to a required field, datatype, pattern or allowed value is a proposed change to a record schema |
| 3 | A Sutton Account is an `Organization` with role flags (customer, vendor, carrier, contract manufacturer), not a relationship class | Do not propose a trading-relationship relator or role classes for accounts unless Benjamin reopens this |
| 4 | The upper ontology is a small projection of gist (Semantic Arts). IOF and ISA-95 are alignments only | The scope document records gist. Use `gist-categories.md`, never `bfo-categories.md`. An IOF or ISA-95 match is an alignment row, never an import or a parent |
| 5 | A small local projector writes the Turtle from the vocabulary and the Schema AST | Generated files are read-only inputs to checks |
| 6 | Checks: generated Turtle byte-compared and re-parsed in `bun run check`; an OWL reasoner in `bun run check:full`; SHACL over the stored rows of the messy sample as a slow test. Owed: which reasoner, and how it runs, is not chosen | The validator skill reports against these gates. The reasoner and its route (a ROBOT jar, a standalone HermiT or Openllet, a JavaScript reasoner) are a question for Benjamin |
| 7 | The namespace is an `example.org` placeholder until something is published | Never mint an IRI under Sutton's name or any real domain. Never use a customer's subdomain |

Decision 4 names only IOF and ISA-95. Treating schema.org, W3C ORG, FIBO, EPCIS, GS1, UN/CEFACT and GoodRelations as
alignment-only too follows from it (gist is the only parent) and was not decided by name.

Rules from the reports, not numbered decisions (state them as the report's, and put a challenge to Benjamin):

- No `owl:sameAs` for deduplication: two records that may be one party are settled by a recorded identity decision
  (report 01, `IdentityDecision`).
- No `owl:inverseOf`: a reverse relation is a SPARQL `^p` path (report 02, the planned `laws ontology-terms` rule).
- Identity: report 01 says a party's identity is "tenant and a source id, never a name", and never a SKU. That is the
  reidentification key of a tenant's record of a party (`reidentification_key` on an identity card), not yet the
  identity criterion of the company itself: one company known to two tenants is two records. Which it is is open, for
  Benjamin; until he answers, an identity card records it as `unresolved` with that question.
- An inventory measure (Available, Committed, Reserved) is not one enum because they overlap (report 01).

## Not decided, and asked of Benjamin when a skill needs it

- The label and definition properties. Report 02's sketch writes `prefLabel` and `definition`; its table writes
  `rdfs:label, skos:definition`. gist 14.1.0 has 226 `skos:prefLabel`, 227 `skos:definition` and no `rdfs:label`.
  Until he answers, a check or a query reads `skos:prefLabel` and `skos:definition`, and says the label property is
  open.
- What the projection copies from gist: "names and subclass links only" (`gist-categories.md`) is a proposal. Whether
  gist's `owl:disjointWith` axioms are copied is open.
- Where the vocabulary module lives (`packages/kernel/src/ontology/Terms.vocab.ts` is report 02's sketch), where the
  generated Turtle goes, the `term` annotation's type (`Curie<V>` is proposed), the kind-or-role tag's values, the
  exact `inv:` IRI, a SKOS concept's IRI form, how a deprecated term is written, the version scheme, and where the
  header's version comes from (never the clock: decision 6's byte-compare).
- Which context's contract package owns a party record (decision 1 names catalog and access; no party record exists).
- The data that proves the party model: the messy sample stores items only (vendors are names inside `item.vendors`),
  so a party competency question uses named `test_` fixtures, said in its entry.
- Whether a role flag is always stated true or false (closed) or may be absent (unknown).
- Where the competency-question suite runs (Vitest with N3 or comunica, or Python), and whether it reads the stored
  rows as its A-box.
- No place-of-business class: gist 14.1.0 has no Place class and deprecates `gist:Building` and `gist:Landmark`.
- How a Sutton term is cited: Sutton publishes no namespace, and decision 7 forbids minting under its name.
- Which annotation vocabularies the module may emit beyond SKOS (PROV-O, dcterms), what a "release" is while the
  namespace is a placeholder, and whether license metadata is wanted.

The skills write alignment rows with the `skos:*Match` predicates only (report 02 shows `closeMatch`; no decision
names the set); a gist parent is `subClassOf` in the vocabulary, never a mapping.

Beware: `gist:Account` is an agreement with a balance, not the Sutton Account (decision 3).

## What exists today, and what does not

- Exists: the packet, its decisions and three research reports, all untracked (`git ls-files explorations/erp-ontology`
  lists 0 files), and these skills with `_shared/`, also uncommitted. Nothing in the packet can be pinned to a commit
  until Benjamin commits it.
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
