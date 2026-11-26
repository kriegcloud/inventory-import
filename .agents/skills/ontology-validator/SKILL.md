---
name: ontology-validator
description: >
  Reports on this repository's ontology gates, each as passed, failed or
  not built: the generated Turtle (OWL, SKOS, SHACL projected from the
  TypeScript vocabulary module) byte-compared and re-parsed, the OWL
  reasoner, SHACL over the stored rows of the messy sample, the
  competency-question SPARQL suite, and label and definition coverage.
  Also validates an SSSOM mapping file. Use when asked to validate,
  reason over or quality-check the ontology or its vocabulary, or before
  an ontology release. Not for checking a spreadsheet, imported rows,
  item records, Effect Schemas, column matching or the app's own tests.
---

# Ontology Validator

## Role Statement

You are responsible for the evaluation phase — comprehensive validation
across logical, structural, and documentation dimensions. You run the
full quality checklist, report results, and flag issues for upstream
skills to fix. You do NOT edit the ontology, its shapes or its tests, not
even to add a missing label — you report and hand back to the appropriate
skill.

## In this repository

Read `../_shared/project-profile.md` first; it wins over this file. Terms live in one TypeScript vocabulary module,
record rules in Effect Schemas, and every Turtle file is generated. The thin thread is built: the module
`packages/kernel/src/Terms.vocab.ts`, the projector in `packages/ontology`, the generated Turtle, CQ-P06 and CQ-P11,
the law `bun run beep laws ontology-terms`, and the reasoner step. SHACL over the stored rows, alignments and any term
beyond the thread's 22 are not built. Report a gate as run only when its command ran. Report the rest as "not built",
never as run or passed. ROBOT is not on the PATH; do not download it without asking. The reasoner script fetches its jar.

| Upstream step or output | Here |
| --- | --- |
| Byte-compare and re-parse of the Turtle (not upstream) | Built, in `bun run check` (decision 6). `bun run ontology:write` writes the three files under `packages/ontology/generated/` |
| Step 1 reasoner | Built. Task `reason` of `@inventory/ontology`: `packages/ontology/scripts/reason.ts`, ROBOT v1.9.11 with HermiT under Java 17, pinned in `packages/ontology/robot.lock.json`. Part of `bun run check:full` and of the CI job `reason` (decisions 112, 113, 114). Report it only when that task ran |
| Step 2 ROBOT report | No ROBOT report gate. Read `skos:prefLabel` and `skos:definition` (decision 11) on the generated Turtle with rdflib. Do not download ROBOT to run `robot report` |
| Step 3 SHACL over the ontology | The generated shapes over the 155 stored rows of the messy sample plus must-fail fixtures, a slow test. Not built. The sample stores items only: a party term has no stored row. CQ-P06 and CQ-P11 answer over a hand-written two-organization fixture and the lift of two member rows, not over those stored rows. Which data proves the party model is Benjamin's |
| Step 4 CQ suite | Built for CQ-P06 and CQ-P11 in `packages/ontology/test/Questions.test.ts` (Oxigraph), queries in `packages/ontology/fixtures/cq/`. Report them only when that test ran. Any other question is not built |
| Step 5 metrics, Step 6 dimensions | Apply, from whatever gates exist; a gate not built is not a 0% or a PASS |
| Step 7 diff | `git diff` of `packages/ontology/generated` |
| Also check | No `owl:inverseOf`, no `owl:sameAs`, every IRI under the `example.org` placeholder. The law is `bun run beep laws ontology-terms` (root script `ontology-terms:check`, part of `bun run check`). Report it only when that command ran |
| SSSOM validation | Applies: `uvx --from sssom sssom validate` on a file under `explorations/erp-ontology/assets/mappings/`. Every row is a candidate until Benjamin's `rat-` record for it exists, whatever its confidence |
| Validation report | A section of `explorations/erp-ontology/research/NN-title.md` (frontmatter `type`, `title`, `description`); then `bun run docs:check` |
| A fix | Never an edit to Turtle. A proposed change to the vocabulary module or a record schema, for Benjamin; a missing or wrong shape is a projector bug |

## When to Activate

- The user asks to validate, reason over, or quality-check an ontology,
  its SHACL shapes, its competency-question tests, or its SSSOM mappings
- After another ontology skill changed an ontology file
- Before an ontology release
- Pipeline A Step 5, Pipeline B Step 3, Pipeline C Step 2

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory)
before beginning work:

- `../_shared/project-profile.md`: this repository's decisions; read it first, it wins
- `../_shared/gist-categories.md`: the gist projection the orphan and parent checks read
- `../_shared/methodology-backbone.md` — lifecycle phase context (Phase 6: Evaluation)
- `../_shared/quality-checklist.md` — the full validation checklist
- `../_shared/anti-patterns.md` — anti-pattern detection queries
- `../_shared/naming-conventions.md` — naming compliance checks

## Consistency vs. Validity (OWA vs. CWA)

Use both OWL reasoning and SHACL; they answer different questions.

- **OWL reasoning (Open World Assumption)** checks logical consistency.
  Missing facts are treated as unknown, not false.
- **SHACL validation (Closed World Assumption for the validated data)** checks
  structural validity. Missing required data is a violation.

| Check Type | Catches | Misses |
|-----------|---------|--------|
| OWL reasoner | Unsatisfiable classes, logical contradictions | Missing required annotations/data |
| SHACL | Missing properties, cardinality/datatype violations | Logical inconsistency across axioms |

A model can be logically consistent and still fail SHACL completeness checks.
It can also pass SHACL and still be logically inconsistent.

## Core Workflow

### Step 1: Logical Validation (Level 1)

> Here: the reasoner step is built. It is task `reason` in `bun run check:full` and the CI job `reason`: `packages/ontology/scripts/reason.ts`, ROBOT v1.9.11 with HermiT under Java 17, pinned in `packages/ontology/robot.lock.json` (decisions 112 to 114). The script fetches the jar into the cache. Report the gate only when that task ran. A skill does not download the jar. ELK is complete only for EL constructs; this step uses HermiT.

```bash
mkdir -p results

# Does the ontology stay within OWL 2 EL? (an error when it does not)
robot validate-profile --profile EL --input ontology.ttl \
  --output results/el-profile.txt

# EL ontology only: consistency check with ELK (fast)
robot reason --reasoner ELK --input ontology.ttl

# Any ontology outside EL: consistency check with HermiT (full OWL 2 DL)
robot reason --reasoner HermiT --input ontology.ttl

# Unsatisfiable classes: reason fails on them and writes a debug module
robot reason --reasoner HermiT --input ontology.ttl \
  --dump-unsatisfiable results/unsatisfiable.owl
```

ELK reasons over OWL 2 EL only and ignores every other axiom. It is the
consistency gate only when `validate-profile --profile EL` passes; for any
other ontology a green ELK run checks nothing outside EL.
ROBOT's reasoners are `ELK` (the default), `hermit`, `jfact`, `whelk`, `emr` and `structural`; Openllet runs through its own CLI.

If inconsistent:
1. Parse the reasoner explanation
2. Identify the conflicting axioms
3. Report the root cause
4. Suggest a minimal fix
5. Hand back to architect for resolution

### Step 2: Quality Report (Level 2)

> Here: ROBOT is not on the PATH, and a skill does not download it. There is no `robot report` gate: say "not built" for that check. Read `skos:prefLabel` and `skos:definition` (decision 11) on the generated Turtle with rdflib, and report that query only when you ran it.

```bash
robot report --input ontology.ttl \
  --fail-on ERROR \
  --output report.tsv
```

Checks: missing labels, missing definitions (see below), multiple labels in same
language, deprecated term references, annotation whitespace issues.

In ROBOT's default profile a missing label is an ERROR but a missing
definition is only a WARN, and `missing_definition` reads only
`obo:IAO_0000115` (or the `IAO_0000600` elucidation), never
`skos:definition`. So `--fail-on ERROR` never fails on definitions. Use
the one definition property the project records, and gate it: for
`skos:definition`, copy ROBOT's default `report_profile.txt`, add a tab-
separated line `ERROR	file:./missing-skos-definition.rq`, and pass
`--profile` (a profile runs only the queries it names). A custom report
query returns exactly `?entity ?property ?value`:

```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?entity ?property ?value WHERE {
  ?entity a owl:Class .
  FILTER(isIRI(?entity))
  FILTER NOT EXISTS { ?entity owl:deprecated true }
  FILTER NOT EXISTS { ?entity skos:definition ?d }
  BIND(skos:definition AS ?property)
  BIND("" AS ?value)
}
```

### Step 3: SHACL Validation (Level 3)

> Here: the shapes are generated from the record schemas and run over the 155 stored rows of the messy sample plus must-fail fixtures, as a slow test. T-Box lint (labels, definitions, orphans) belongs to Step 2; a label shape reads `skos:prefLabel` (decision 11). Not built: report "not built".

```bash
uvx pyshacl -s shapes/ontology-shapes.ttl -i none ontology.ttl -f human
```

Validate without inference (`-i none`). With `-i rdfs`, pyshacl first adds
what RDFS entails: `rdfs:domain` and `rdfs:range` give every subject and
object the very type a shape checks, so a domain or range shape passes by
construction. `rdfs:domain` and `rdfs:range` are inference rules, not
constraints; a required type is stated in the shapes as `sh:class` or
`sh:datatype` on a property shape. pyshacl exits 1 when the data does not
conform.

Standard shapes:
- Every class has `rdfs:label` (minCount 1)
- Every class has the project's definition property (minCount 1)
- No orphan classes (every class has a parent)
- Subjects and objects of each property have the class or datatype the
  shapes require (`sh:class`, `sh:datatype`)

### Step 4: CQ Test Suite (Level 4)

> Here: CQ-P06 and CQ-P11 run in `packages/ontology/test/Questions.test.ts` (Oxigraph), over a hand-written two-organization fixture and the lift of two member rows, not over the stored rows of the messy sample. Report them only when that test ran. Any other question is "not built".

`tests/cq-test-manifest.yaml`, written by `ontology-requirements`, names
each CQ's query, fixture graph, expected result (`tests/expected/`),
must-fail case and reasoning step. Every query runs against the ontology
merged with its CQ's fixture, never against the ontology alone, and
every output goes to a scratch path.

```bash
mkdir -p test-results/merged test-results/verify test-results/query

# One merged copy per CQ
robot merge --input ontology.ttl --input tests/fixtures/cq-001.ttl \
  --output test-results/merged/cq-001.ttl

# When the manifest records a reasoning step: reason the merged copy
robot merge --input ontology.ttl --input tests/fixtures/cq-001.ttl \
  reason --reasoner <one that covers the ontology's profile> \
  --axiom-generators "SubClass ClassAssertion" --include-indirect true \
  --output test-results/merged/cq-001.ttl

# SELECT and ASK CQs: one result file per query, named after it
robot query --input test-results/merged/cq-001.ttl \
  --queries tests/cq-001.sparql --output-dir test-results/query/

# Constraint CQs: robot verify fails when the query returns any row
robot verify --input test-results/merged/cq-002.ttl \
  --queries tests/cq-002.sparql --output-dir test-results/verify/
```

A CQ passes by the rule `ontology-requirements` set for its type:

| CQ type | Passes when |
|---------|-------------|
| Enumerative, relational, temporal (SELECT) | Result rows equal the expected-rows CSV, order ignored |
| Quantitative (SELECT with COUNT/SUM) | The single row equals the expected value |
| Boolean (ASK) | `robot query` writes `true` or `false`; it equals the expected answer |
| Constraint (SELECT of violations) | Zero rows, AND its companion antecedent query, run with `robot query` on the same merged copy, returns rows |

A constraint whose antecedent query returns nothing passes vacuously and
counts as a FAIL. A result that only parses, or is only non-empty, is not
a pass. Compare rows without the header and in sorted order:

```bash
diff <(tail -n +2 test-results/query/cq-001.csv | tr -d '\r' | sort) \
     <(tail -n +2 tests/expected/cq-001.csv | tr -d '\r' | sort)
```

Then run each test on its must-fail case (the ontology or fixture with
the needed axiom or value removed, written to a scratch file). The test
must report FAIL there; a test that still passes certifies nothing and
goes back to `ontology-requirements`.

Without ROBOT, rdflib prints the rows as CSV, or the ASK answer, for a
query over the ontology and its fixture. It does no OWL reasoning, so it
stands in only for a CQ with no reasoning step:

```bash
uv run --with rdflib python -c 'import sys,rdflib; g=rdflib.Graph(); [g.parse(f) for f in sys.argv[2:]]; r=g.query(open(sys.argv[1]).read()); print(str(r.askAnswer).lower()) if r.type=="ASK" else sys.stdout.write(r.serialize(format="csv").decode())' tests/cq-001.sparql ontology.ttl tests/fixtures/cq-001.ttl
```

A failing CQ test is never edited to pass. The ontology is fixed by its
owning skill, or the requirement is changed with the person's sign-off
and the change recorded by `ontology-requirements`.

### Step 5: Coverage Metrics (Level 5)

> Here: report a metric only for a gate that exists; for the rest write "not built", never 0% or PASS. Label coverage counts `skos:prefLabel` (decision 11).

Calculate and report:

| Metric | Target | Method |
|--------|--------|--------|
| Consistency | PASS | `robot reason` |
| Label coverage | 100% | Count classes with `rdfs:label` |
| Definition coverage | 100%: definitions are required; a gap does not block a commit and blocks a release | Count classes with the project's definition property |
| CQ test pass rate | 100% (Must-Have), each failing on its must-fail case | `robot query` and `robot verify` on the ontology merged with each fixture |
| SHACL conformance | PASS | `pyshacl` |
| Unsatisfiable classes | 0 | `robot reason` |
| Orphan classes | 0 | SPARQL check |

### Step 6: Evaluation Dimensions (Level 6)

Document qualitative assessments in the validation report:

- **Semantic**: expressivity, complexity, granularity, epistemological adequacy
- **Functional**: relevance to CQs, rigor of evidence, automation support
- **Model-centric**: authoritativeness, structural coherence, formality level

These notes are not pass/fail automation checks; they are explicit review
judgments with rationale.

### Step 7: Diff Report (for PRs/releases)

> Here: `git diff` of `packages/ontology/generated`. `bun run ontology:write` writes `inventory.owl.ttl`, `inventory.skos.ttl` and `generated/fixtures/CQ-P06.graph.ttl`.

```bash
robot diff --left previous.ttl --right ontology.ttl \
  --format markdown --output diff.md
```

## Tool Commands

### Anti-pattern detection queries

> Here: run them on the generated Turtle with the rdflib command of Step 4 (`uv run --with rdflib python ...`), not `robot query`. Report a query only when you ran it.

Save the detection queries from `../_shared/anti-patterns.md` to files:
section 1 (singleton hierarchy) as `singleton-check.sparql`, section 4
(missing disjointness) as `disjoint-check.sparql`, section 8 (orphan
class) as `orphan-check.sparql`. `--query` takes a query file and an
output file:

```bash
robot query --input ontology.ttl \
  --query singleton-check.sparql results/singletons.csv \
  --query orphan-check.sparql results/orphans.csv \
  --query disjoint-check.sparql results/missing-disjoint.csv
```

### SSSOM validation (when applicable)

> Here: the mapping file sits under `explorations/erp-ontology/assets/`, not `ontologies/{name}/mappings/`.

```bash
uvx --from sssom sssom validate ontologies/{name}/mappings/source-to-target.sssom.tsv
```

### Naming convention compliance

> Here: names are set in the vocabulary module; a naming test there is not built. Over generated Turtle, run the query with rdflib, not ROBOT.

Classes whose local name is not CamelCase (`../_shared/naming-conventions.md`;
not for opaque numeric IDs), saved as `naming-check.sparql`:

```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?class WHERE {
  ?class a owl:Class .
  FILTER(isIRI(?class))
  BIND(REPLACE(STR(?class), "^.*[/#]", "") AS ?local)
  FILTER(!REGEX(?local, "^[A-Z][A-Za-z0-9]*$"))
}
```

```bash
robot query --input ontology.ttl --query naming-check.sparql results/naming-issues.csv
```

## Outputs

> Here: the report is a section of `explorations/erp-ontology/research/NN-title.md`; result files go to a scratch folder, never `docs/` or `ontologies/{name}/`.

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Validation report | `ontologies/{name}/docs/validation-report.md` | Markdown | Summary: pass/fail per check, metrics |
| ROBOT report | `{name}-report.tsv` | TSV | Detailed quality report |
| Test results | `test-results/` | Directory | Per-CQ test outputs |
| Diff report | `ontologies/{name}/docs/diff.md` | Markdown | Changes between versions |
| Unsatisfiable debug module | `results/unsatisfiable.owl` | OWL | Unsatisfiable classes and the axioms behind them (if any) |

## Handoff

> Here: the inputs are the generated Turtle, `packages/ontology/test/Questions.test.ts` and SSSOM files under `explorations/erp-ontology/assets/mappings/` (alignment rows are not built). A curator's or architect's proposal arrives as a research report with the module diff. Byte-compare, re-parse, CQ-P06 and CQ-P11, the ontology-terms law and the reasoner are built; SHACL over the stored rows is not built. Report a gate only as it ran. Fixes go back as a proposed change to the vocabulary module or a record schema. Each checklist item is passed, failed or not built; a not-built gate is never ticked as executed.

**Receives from**:
- `ontology-architect` — `ontologies/{name}/{name}.ttl`,
  `ontologies/{name}/shapes/{name}-shapes.ttl`, `ontologies/{name}/tests/*.sparql`,
  `ontologies/{name}/tests/cq-test-manifest.yaml`, plus the auditor's
  `work/dispositions.index.yaml` (evaluation must SEE the unresolved/deferred
  remainder — a green report over hidden open questions is a false green) (CQ tests originate from
  `ontology-requirements` and are forwarded through `ontology-architect`)
- `ontology-mapper` — `ontologies/{name}/mappings/*.sssom.tsv`
- `ontology-curator` — modified `ontology.ttl`, KGCL change log

**Passes to**: User (validation report) or back to upstream skill for fixes

**Handoff checklist**:
- [ ] All Level 1-6 checks have been executed
- [ ] Validation report is generated and accessible
- [ ] Any failures are clearly documented with root cause
- [ ] Recommendations for fixes reference the appropriate upstream skill

## Quality Report Format

> Here: the report opens with OKF frontmatter (`type`, `title`, `description`), and every level without code behind it reads "Status: not built"; Overall is PASS only when every gate ran, and otherwise reads "not built (N of M gates ran)" or FAIL.

```markdown
# Validation Report: {name}
Date: {date}

## Summary
- Overall: PASS / FAIL
- Blocking issues: {count}
- Warnings: {count}

## Level 1: Logical Consistency
- Status: PASS / FAIL
- Reasoner: {ELK/HermiT}
- Unsatisfiable classes: {count}

## Level 2: ROBOT Report
- Status: PASS / FAIL
- Errors: {count}
- Warnings: {count}

## Level 3: SHACL Validation
- Status: PASS / FAIL
- Violations: {count}

## Level 4: CQ Tests
- Total: {count}
- Passed: {count}
- Failed: {count}
- Failed tests: {list}

## Level 5: Metrics
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Label coverage | X% | 100% | PASS/FAIL |
| Definition coverage | X% | 100% | PASS/FAIL |
| Orphan classes | N | 0 | PASS/FAIL |

## Level 6: Evaluation Dimensions
- Semantic: {notes}
- Functional: {notes}
- Model-centric: {notes}

## Level 7: Diff Review
- Status: PASS / FAIL
- Summary: {high-level changes}
```

## Anti-Patterns to Avoid

> Here: "must be checked" means each level is reported as passed, failed or not built; a not-built level is never called checked.

- **Shallow validation**: Don't just run the reasoner and declare success.
  All six validation levels (plus diff review for releases/PRs) must be checked.
- **Ignoring warnings**: WARNINGs don't block commit but should be tracked
  and addressed.
- **Fixing in the wrong skill**: The validator reports; the architect or
  curator fixes. The validator never modifies the ontology, a missing
  label included.
- **Skipping CQ tests**: CQ tests are acceptance criteria. A passing
  reasoner with failing CQ tests means the ontology is logically consistent
  but functionally incomplete.

## Error Handling

> Here: a missing shapes file is the SHACL gate, which is not built, not a hand-back to the architect. CQ-P06 and CQ-P11 live in `Questions.test.ts`; a question with no test is "not built".

Missing validation prerequisites are blockers, not passing checks. The validator
reports them and requests the owning role's output; it does not author replacement
shapes or tests while acting as the evaluator.

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| Reasoner timeout | Ontology too large or complex for HermiT | Report the DL consistency check as NOT RUN and profile the ontology for complexity hotspots. An ELK run may be added only for an EL ontology; for any other, say which axioms ELK left unchecked, and never report it as the consistency result |
| SHACL shapes file missing | Architect did not supply the prerequisite shapes | Report the SHACL check as NOT RUN and hand back to the architect to supply shapes; rerun validation after delivery |
| CQ test files missing | Requirements skill output not available | Report CQ testing as NOT RUN and hand back to the requirements skill to supply tests from the competency questions; rerun after delivery |
| ROBOT report fails to parse | Corrupt or malformed Turtle | Load the file to find the syntax error: `robot convert --input ontology.ttl --format ttl --output results/parse-check.ttl`, or `uv run --with rdflib python -c 'import sys,rdflib; rdflib.Graph().parse(sys.argv[1], format="turtle")' ontology.ttl`. Report it and hand back to the owning skill |
