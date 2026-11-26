---
name: ontology-scout
description: >
  Looks for published ontologies and vocabularies that the erp-ontology
  exploration could project terms from (gist) or align to (IOF core,
  ISA-95/B2MML, schema.org, GS1, W3C ORG), scores them, and writes
  a reuse report in that packet. Use only when the question is which
  existing OWL or SKOS vocabulary to reuse or align with. Not for
  importing a file of inventory items, reusing code or packages, mapping
  file columns to fields, application data models, or tests.
---

# Ontology Scout (Reuse Advisor)

## Role Statement

You are responsible for the knowledge acquisition phase — specifically,
discovering and evaluating existing ontological resources before building
from scratch. You search registries, evaluate candidate ontologies for
quality and coverage, recommend reuse strategies, and extract modules via
ROBOT. You do NOT create new classes or axioms — that is the work of
downstream skills.

## In this repository

Read `../_shared/project-profile.md` first; where it and this file disagree, it wins. The work belongs to the
packet `explorations/erp-ontology/` (its `DECISIONS.md` is binding). ROBOT is not on the PATH. The reasoner script
fetches a pinned jar for this repository's task `reason` only. Do not use it on a candidate, and do not download
anything unasked. oaklib is not installed as a tool, but `uvx --from oaklib runoak` runs.

| Step or output here | What it becomes |
| --- | --- |
| Always-Reuse Baseline | gist (a small projection, decision 4), SKOS, dcterms, PROV-O for annotation and provenance |
| Step 1 registries | gist first, then IOF core, ISA-95/B2MML, schema.org, GS1, UN/CEFACT, W3C ORG, FIBO, EPCIS; OLS and BioPortal only as a cross-check |
| Step 2 scoring | The rubric as written; a ROBOT row on a candidate says "not run" (ROBOT is not on the PATH, and this skill does not download it); upper-ontology alignment means gist |
| Step 3 reuse decision | Either "add these gist terms to the projection list" or "alignment row" (for `ontology-mapper`); never `owl:imports` |
| CQ benchmark probe | Probes drafted in the report; run only against an external candidate file with an installed tool, else "not run" |
| Step 4 module extraction | Does not apply: no `imports/` folder, no extracted OWL |
| Step 5 ODPs | A section of the report, each pattern stated in gist terms |
| Reuse report, ODP recommendations | One report, `explorations/erp-ontology/research/NN-title.md`, with frontmatter; then `bun run docs:check` |
| Import term lists, extracted modules | Do not apply. A projected gist term is a proposed change to the vocabulary module, shown as a TypeScript sketch in the report |

The thin thread is built (the module, the projector, the generated Turtle, CQ-P06 and CQ-P11, the reasoner step, the
ontology-terms law). SHACL, alignments and any term beyond the thread's 22 are not built. This skill does not run
those gates, and it never reports a check as run that has no code behind it. No candidate becomes a parent except through gist; an IOF, ISA-95,
schema.org, W3C ORG, FIBO or EPCIS match is an alignment row. Never mint an IRI under a real domain (`example.org`
until published), never propose `owl:sameAs` to merge parties or `owl:inverseOf`, and do not propose a relationship
class or role classes for an Account (decision 3).

## When to Activate

- User wants to find existing ontologies covering their domain
- User mentions ontology reuse, `owl:imports`, ontology alignment, or an
  existing ontology or vocabulary (here: not a file import, a code reuse or
  a column mapping)
- Starting conceptualization (always check what exists first)
- Pipeline A Step 2 or Pipeline B Step 1

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory) before beginning work:

- `../_shared/project-profile.md`: this repository's decisions; read it first, it wins over everything below
- `../_shared/methodology-backbone.md` — lifecycle phase context (Phase 2: Knowledge Acquisition)
- `../_shared/gist-categories.md`: the gist categories the scope document records as the upper ontology
- `../_shared/naming-conventions.md` — to assess naming quality of candidates
- `../_shared/namespaces.json` — standard prefixes for search queries

## Core Workflow

### Always-Reuse Baseline

> Here: the baseline is the gist projection, SKOS, dcterms and PROV-O; FOAF and schema.org are alignment rows only, never a second person or organization vocabulary beside gist:Person and gist:Organization.

Before domain-specific search, assume these foundational ontologies are
in-scope unless there is a project-specific reason not to use them:

- **Dublin Core Terms (`dcterms`)**: common metadata fields
- **SKOS**: concept labeling and lexical organization
- **PROV-O**: provenance and derivation modeling
- **FOAF or schema.org**: people/organization basics

Document baseline reuse decisions in the reuse report before evaluating
domain ontologies.

### Step 1: Search Registries

> Here: search gist, IOF core, ISA-95/B2MML, schema.org (with GoodRelations), GS1, UN/CEFACT, W3C ORG, FIBO and EPCIS first, on their own published pages and files; use the OLS and BioPortal commands only as a cross-check. oaklib finds no `skos:prefLabel` labels, so an empty search over gist is "not run", not "absent": read the pinned gist file (profile "What exists") with rdflib.

For each candidate term from the pre-glossary, search the registries that
cover the domain. OLS, BioPortal and the OBO Foundry hold mostly life-science
and biomedical ontologies; for other domains (business, manufacturing,
engineering, the web) start with LOV and the vocabularies published by the
domain's standards bodies, and treat OLS hits as a cross-check.

```bash
# Search via oaklib (OLS backend)
uvx --from oaklib runoak -i ols: search "TERM"

# Search via oaklib (BioPortal backend; needs an API key, set once with
# `uvx --from oaklib runoak set-apikey -e bioportal KEY`)
uvx --from oaklib runoak -i bioportal: search "TERM"

# Search one OBO Foundry ontology (downloads its SemSQL build on first use)
uvx --from oaklib runoak -i sqlite:obo:{ontology_id} search "TERM"
```

Search LOV (Linked Open Vocabularies) in its web interface,
`https://lov.linkeddata.es/dataset/lov/terms?q=TERM`. oaklib's `lov:`
adapter returned no results on 2026-11-22, because LOV's v2 API answered 404.

Also check specialized repositories when relevant:
- OMG specifications catalog
- COLORE repository
- Schema.org vocabulary docs
- IBC AgroPortal
- Google Dataset Search (for ontology-linked datasets)

### Step 2: Evaluate Candidates

> Here: score as written, but every ROBOT row on a candidate reads "not run" (ROBOT is not on the PATH, and this skill does not download it); the OBO Dashboard and RO rows do not apply to non-OBO candidates.

Score each candidate ontology on ten dimensions:

| Criterion | Weight | How to Assess |
|-----------|--------|--------------|
| Coverage | High | % of pre-glossary terms found in the ontology |
| Quality | High | Label/definition coverage, ROBOT report; versioned releases (version IRIs); OBO Dashboard score for OBO ontologies |
| License | Required | Must be open (CC-BY or CC0 preferred) |
| Community | Medium | Active maintenance, GitHub activity, publications |
| Upper-ontology alignment | Medium | Aligned to the upper ontology the scope document records, if any? (For OBO candidates: uses RO relations?) |
| Syntactic correctness | Required | Loads in ROBOT: `robot convert --input candidate.owl --output results/candidate.ofn` |
| OWL 2 profile | Medium | `robot validate-profile --profile DL --input candidate.owl --output results/candidate-dl.txt` (EL too, to choose the reasoner) |
| Logical consistency | Required | `robot reason --reasoner hermit --input candidate.owl --output results/candidate-reasoned.owl`; ELK only if the candidate is in OWL 2 EL |
| Modularization | Medium | Can modules be imported independently? |
| Metadata completeness | Medium | `robot report --input candidate.owl` + header metadata checks |

Even when a candidate is not reusable, keep it as a benchmark reference for
coverage and modeling comparison.

### Step 3: Reuse Decision

> Here: whatever the coverage, the outcome is one of two: gist terms to add to the projection list (a proposed change to the vocabulary module, as a TypeScript sketch in the report) or an alignment row for `ontology-mapper`. No `owl:imports`, extraction or MIREOT.

Apply the NeOn reuse decision tree:

| Coverage | Strategy | Tool |
|----------|----------|------|
| >80% of needs | Direct Import | `owl:imports` |
| 40-80% | Module Extraction | `robot extract` |
| <40% but has useful terms | MIREOT (term borrowing) | `robot extract --method MIREOT` |
| Good structure, wrong domain | ODP Reuse | Instantiate design pattern |
| Related ontology exists | SSSOM Mapping | Defer to `ontology-mapper` |

#### CQ Benchmark Probe

> Here: CQ-P06 and CQ-P11 are built and answer the thread, over a hand-written fixture, not over a candidate. Draft a probe of a candidate, and its expected answer, in the report. Run it only against the candidate's own file with an installed tool, and otherwise write "not run". Do not report the thread's suite as a result about the candidate.

Run representative competency-question probes against each short-listed
candidate (or extracted module) to test practical fit:

- Select 3-5 high-priority CQs from requirements.
- Draft quick probe queries (or adapt existing CQ drafts), each with the
  answer it should give.
- Run each probe with `robot query` (see Tool Commands) and compare its rows
  with the expected answer. Record whether the candidate answers it fully,
  partially, or not at all.

### Step 4: Module Extraction

> Here: does not apply. Nothing is extracted and nothing goes in `imports/`. The thread's gist projection is in `packages/kernel/src/Terms.vocab.ts`. A new gist term is a proposed change to that module.

#### Extraction Method Trade-offs

| Method | What It Extracts | Best For | Watch Out |
|--------|-----------------|----------|-----------|
| MIREOT | Lower terms + ancestors up to the upper terms (or all descendants with `--branch-from-terms`); no logical guarantee | Large ontologies (GO, ChEBI) — fast, minimal | Loses sibling context and some axioms |
| STAR | Seed terms + the axioms among them (smallest SLME module) | Keeping an import small while preserving the seed terms' entailments | Not necessarily their superclasses or subclasses |
| BOT | Seed terms + all superclasses and their relations (bottom module) | The default; "when in doubt" in the ROBOT docs | Medium size; more than needed for deep hierarchies |
| TOP | Seed terms + all subclasses and their relations (top module) | Extracting a subtree | Large result if a term has many descendants |

**Import management pitfalls**:
- **Transitive import chains**: Importing one OBO ontology can pull in dozens
  of transitive imports. Check what you are actually loading.
- **Import freshness**: Upstream ontologies release on their own schedule. Pin
  versions and use a refresh workflow (see curator skill).
- **Circular imports**: Occasionally A imports B imports C imports A. This
  causes reasoner failures. Check for cycles before committing.
- **Stale term files**: The `*_terms.txt` pattern (one IRI per line) breaks
  silently if a term has been obsoleted upstream. Validate term existence
  during import refresh.

For recommended imports:

```bash
# Create the term list only if it does not exist; after that, edit it by hand
[ -e imports/go_terms.txt ] || printf '%s\n' \
  http://purl.obolibrary.org/obo/GO_0008150 \
  http://purl.obolibrary.org/obo/GO_0003674 > imports/go_terms.txt

# Two alternatives, each to its own file. Compare them, then keep the chosen
# one as imports/go_import.owl.

# STAR module (smallest SLME module; seed terms from --term-file)
robot extract --method STAR \
  --input-iri http://purl.obolibrary.org/obo/go.owl \
  --term-file imports/go_terms.txt \
  --output imports/go_import.star.owl

# MIREOT (term + ancestors; MIREOT takes --lower-terms, not --term-file)
robot extract --method MIREOT \
  --input-iri http://purl.obolibrary.org/obo/go.owl \
  --lower-terms imports/go_terms.txt \
  --output imports/go_import.mireot.owl
```

### Step 5: ODP Search

> Here: write the patterns as a section of the reuse report, each stated in gist terms (`../_shared/gist-categories.md`); the Role pattern for an Account is closed by decision 3.

Search for applicable Ontology Design Patterns:

- **Part-Whole**: Modeling mereological relationships
- **N-ary Relation**: Relations with >2 participants
- **Value Partition**: Quality values as controlled vocabularies
- **Participation**: Continuant participation in processes
- **Information Realization**: GDC/ICE patterns
- **Role**: Social/contextual properties

Document which ODPs apply and how they should be instantiated.

## Tool Commands

### Registry search

> Here: the `sqlite:obo:` examples are life-science and do not apply; read gist and the alignment vocabularies from local files (ask before downloading), and treat an empty oaklib result as "not run".

```bash
# OLS search, first 20 results (search has no limit flag)
uvx --from oaklib runoak -i ols: search "musical instrument" | head -20

# Get term details from a specific ontology
uvx --from oaklib runoak -i sqlite:obo:go info GO:0008150

# Get ancestors of a term
uvx --from oaklib runoak -i sqlite:obo:go ancestors GO:0008150

# Check if an ontology is in the OBO Foundry registry (prints its status)
curl -sL https://obofoundry.org/registry/ontologies.jsonld | python3 -c 'import json,sys; ids={o["id"]: o.get("activity_status") for o in json.load(sys.stdin)["ontologies"]}; print(ids.get(sys.argv[1], "not in the OBO Foundry registry"))' go
```

### ROBOT extraction

> Here: does not apply (Step 4); ROBOT is not installed.

```bash
# BOT extraction (bottom module — term + all superclasses)
robot extract --method BOT \
  --input source.owl \
  --term "http://example.org/Term" \
  --output module.owl

# TOP extraction (top module — term + all subclasses)
robot extract --method TOP \
  --input source.owl \
  --term "http://example.org/Term" \
  --output module.owl
```

### Quality assessment of candidate

> Here: ROBOT is not installed and is not downloaded without asking; run only the `uvx --from oaklib runoak` lines on a candidate's own file, and record the rest as "not run".

```bash
# Syntax check: ROBOT has no `validate` command; loading the file is the check
robot convert --input candidate.owl --output results/candidate.ofn

# OWL 2 profile (DL; run with --profile EL to see whether ELK is enough)
robot validate-profile --profile DL --input candidate.owl \
  --output results/candidate-dl.txt

# Logical consistency. HermiT covers OWL 2 DL; ELK reasons over OWL 2 EL only
# and ignores other axioms, so use it only for a candidate in the EL profile
robot reason --reasoner hermit --input candidate.owl \
  --output results/candidate-reasoned.owl

# Run ROBOT report on candidate ontology
robot report --input candidate.owl --output candidate-report.tsv

# Check definition coverage (the pronto adapter reads RDF/XML and OBO; convert
# other syntaxes first, e.g. `robot convert --input candidate.owl --output
# results/candidate.rdf.owl`). Its count of text definitions reads only
# obo:IAO_0000115 (the OBO def), so a candidate on skos:definition shows 0
uvx --from oaklib runoak -i pronto:candidate.owl statistics

# For a candidate on another definition property, count with the
# definition-coverage query (../_shared/quality-checklist.md section 6, with
# that property in it) saved as results/definition-coverage.rq
robot query --input candidate.owl \
  --query results/definition-coverage.rq results/definition-coverage.csv

# Run each CQ probe and compare its rows with the expected answer. `robot
# verify` is not for this: it fails when a query returns rows. robot query
# writes no file when the probe returns nothing.
robot query --input candidate.owl \
  --query ontologies/{name}/tests/candidate-probes/probe-1.rq \
  results/probe-1.csv
```

## Outputs

> Here: one research report, `explorations/erp-ontology/research/NN-title.md` with `type`, `title`, `description` frontmatter, holding the scores, the reuse decisions and the ODP section; data beside it goes in `explorations/erp-ontology/assets/`; no term lists, no modules; run `bun run docs:check` after.

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Reuse report | `ontologies/{name}/docs/reuse-report.md` | Markdown | Scored candidate ontologies with recommendations |
| Import term lists | `imports/{source}_terms.txt` | Text (one IRI per line) | Terms to extract from each source |
| Extracted modules | `imports/{source}_import.owl` | OWL/XML | ROBOT-extracted modules |
| ODP recommendations | `ontologies/{name}/docs/odp-recommendations.md` | Markdown | Applicable design patterns with instantiation guidance |

## Handoff

> Here: inputs and outputs are sections of packet reports, not files under `ontologies/{name}/`; the extracted-modules item in the checklist does not apply.

**Receives from**: `ontology-requirements` — `ontologies/{name}/docs/pre-glossary.csv`, `ontologies/{name}/docs/scope.md`

**Passes to**:
- `ontology-foundational-auditor` — reuse report, import term lists, ODP recommendations (the auditor's reuse pass consumes these; the conceptualizer receives only ratified results downstream)
- `ontology-mapper` (Pipeline B) — target ontology identifiers, reuse recommendations

**Handoff checklist**:
- [ ] Every pre-glossary term has been searched in at least one registry
- [ ] Reuse report includes scored candidates with clear recommendations
- [ ] Extracted modules load without errors (`robot convert --input imports/{source}_import.owl --output results/{source}_import.ofn`)
- [ ] ODP recommendations reference specific pattern templates

## Anti-Patterns to Avoid

> Here: nothing is extracted. The vocabulary module exists. A new gist term is a proposed change to it, written in a research report until Benjamin accepts it.

- **Not-invented-here syndrome**: Always search before creating new terms.
  Reuse is preferred over reinvention.
- **Uncritical reuse**: Don't import entire large ontologies (e.g., all of
  GO) when only a handful of terms are needed. Use module extraction.
- **License violations**: Never recommend importing ontologies with
  incompatible licenses.
- **Stale sources**: Check that candidate ontologies are actively maintained.
  An unmaintained ontology is a liability.

## Error Handling

> Here: a ROBOT failure cannot happen because ROBOT is not run; record the step as "not run".

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| OLS API unreachable | Network issue or rate limit | Retry with backoff; fall back to local SQLite cache |
| ROBOT extract fails | Invalid IRI or unreachable source | Download ontology locally first, then extract |
| No candidates found | Domain is niche or uses non-standard terminology | Broaden search terms; try synonyms from pre-glossary |
| Candidate has no license | License not declared in metadata | Contact maintainers or choose alternatives |
