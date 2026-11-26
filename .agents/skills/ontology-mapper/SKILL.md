---
name: ontology-mapper
description: >
  Proposes alignments between this repository's ERP ontology terms and an
  external ontology (gist, IOF, ISA-95, Sutton, schema.org) as SSSOM
  candidate rows for Benjamin to review, and checks an SSSOM file with the
  sssom tool. Use when asked to align or match ontology terms across
  ontologies, or to validate an SSSOM file. Not for the import's Match step,
  matching file columns to fields, item records, or tests.
---

# Ontology Mapper

## Role Statement

You are responsible for the integration phase — creating, validating, and
maintaining cross-ontology mappings using the SSSOM standard. You generate
mapping candidates via lexical matching, triage by confidence, apply LLM
verification for uncertain pairs, and validate the final mapping set. You
produce SSSOM TSV files and quality reports. You do NOT modify the source
or target ontologies — that is the architect's or curator's job.

## In this repository

Read `../_shared/project-profile.md` first; it wins over this file. The vocabulary module is
`packages/kernel/src/Terms.vocab.ts` (7 classes, 9 properties, 2 schemes, 4 concepts). Alignment rows in that
module are not built. SSSOM is only the candidate and review format here.

| Upstream step or output | Here |
| --- | --- |
| Source ontology | The terms in `packages/kernel/src/Terms.vocab.ts`. Alignment rows are not built: match a thread term from the module by hand, or say "not built" |
| Target ontology | A local file of the external ontology (for gist, the pinned 14.1.0 `gistCore.ttl`, profile "What exists"), never a `sqlite:obo:` adapter. oaklib finds no `skos:prefLabel` labels: a zero-row lexmatch is "not run", not "no candidates"; derive candidates by hand or with an rdflib query over `skos:prefLabel` |
| Step 1-3 candidate files | `explorations/erp-ontology/assets/mappings/{source}-to-{target}-proposed.sssom.tsv` |
| Steward ratification | Benjamin's answer, scribed as a `rat-` file under `assets/audit/<name>/governance/ratifications/` and mirrored in `DECISIONS.md` |
| Step 4 predicates | `skos:exactMatch`, `closeMatch`, `broadMatch`, `narrowMatch`, `relatedMatch` only. A gist parent is `subClassOf` in the vocabulary, not a mapping |
| Accepted row | A proposed alignment row for the vocabulary module, as a diff or TypeScript sketch in a research report |
| Step 6 quality report | A section of a research report, `explorations/erp-ontology/research/NN-title.md` |
| Bridge ontology, `sssom convert -O owl` | Does not apply |
| `owl:sameAs`, `owl:equivalentClass` | Never proposed here |

A published SSSOM file, if one is ever wanted, is generated from the
vocabulary's rows; no hand-kept mapping file is a second home. Run
`bun run docs:check` after adding a report.

## When to Activate

- User mentions ontology mapping, ontology alignment, cross-references
  between ontologies, or SSSOM
- User wants to connect two ontologies
- User wants to validate or update existing mappings
- Pipeline B

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory)
before beginning work:

- `../_shared/project-profile.md` — this repository's decisions; read it first, it wins
- `../_shared/methodology-backbone.md` — lifecycle phase context (Phase 5: Integration)
- `../_shared/namespaces.json` — canonical prefixes including sssom and semapv
  (take `gist`, `inv` (example only), `iof-core` and the alignment prefixes from it; ISA-95 and Sutton have no
  namespace (its notes): ask Benjamin how a Sutton term is cited, never mint one)
- `../_shared/gist-categories.md` — the gist terms and their 14.1.0 parents, for gist targets
- `../_shared/naming-conventions.md` — to understand label standards for matching

## Core Workflow

### Step 1: Candidate Generation (Lexical Matching)

> Here: run on local files only; write output under `explorations/erp-ontology/assets/mappings/`, not `ontologies/{name}/mappings/`. The source terms are the vocabulary module. Alignment rows are not built: say "not built", or match a thread term from the module by hand. On gist the rules below match nothing (labels are `skos:prefLabel`): a zero-row result is "not run".

`{source}` and `{target}` are ontology files (`.obo`, `.owl`, `.ttl`) or OAK
selectors such as `sqlite:obo:hp`. `--add` is an option of `runoak` itself,
so it goes before the `lexmatch` subcommand.

```bash
# Using oaklib lexmatch
uvx --from oaklib runoak -i {source} --add {target} lexmatch \
  --exclude-self-matches \
  -o ontologies/{name}/mappings/{source}-to-{target}-proposed.sssom.tsv
```

With custom match rules (oaklib's mapping-rules model: each rule has
`preconditions` and `postconditions`; example in oaklib's
`tests/input/matcher_rules.yaml`):

```yaml
# lexmatch-rules.yaml
rules:
  - description: label matches label
    preconditions:
      subject_match_field_one_of: [rdfs:label]
      object_match_field_one_of: [rdfs:label]
    postconditions:
      predicate_id: skos:exactMatch
      weight: 2.0
  - description: exact synonym matches label or exact synonym
    preconditions:
      subject_match_field_one_of: [oio:hasExactSynonym]
      object_match_field_one_of: [rdfs:label, oio:hasExactSynonym]
    postconditions:
      predicate_id: skos:exactMatch
      weight: 1.0
```

```bash
uvx --from oaklib runoak -i {source} --add {target} lexmatch \
  --exclude-self-matches \
  -R lexmatch-rules.yaml \
  -o ontologies/{name}/mappings/{source}-to-{target}-proposed.sssom.tsv
```

`weight` is not a confidence: it is added to a log-odds score, and lexmatch
turns the total into the `confidence` column. With no rules file a label
match comes out as `skos:closeMatch` at confidence 0.5; with the rules above,
a label match scored 0.8 and a synonym match 0.67. Set the tier thresholds in
Step 2 against the rules file in use.

### Step 2: Confidence Triage

> Here: every row, at any tier, is a proposal until Benjamin answers and his answer is scribed in a `rat-` record (mirrored in `DECISIONS.md`).

**Practitioner warning**: Lexical matching at the 0.7-0.95 confidence level
produces 40-60% false positives in practice. Labels match but meanings differ
(homonyms across domains). The LLM verification step is not optional — it is
essential for this tier.

Sort candidates into three tiers:

| Tier | Confidence | Action |
|------|-----------|--------|
| Propose-accept | ≥ 0.98 AND exact label match AND compatible parent classes | PROPOSE with `semapv:LexicalMatching` justification — equivalence-class mappings remain proposals until the named human steward ratifies (`../_shared/stage-authority-matrix.yaml` forbids autonomous equivalence; confidence is never truth) |
| LLM-verify | 0.7 – 0.98 | Present to LLM for semantic evaluation |
| Human queue | < 0.7 | Flag for manual expert review |

### Step 3: LLM Verification (for uncertain mappings)

> Here: keep every candidate in `explorations/erp-ontology/assets/`; a reviewed row becomes a proposed vocabulary alignment row, not a line in a hand-kept mapping file.

For each uncertain pair, evaluate:

```
Subject: {id} "{label}" — {definition} [parents: {parents}]
Object:  {id} "{label}" — {definition} [parents: {parents}]

Determine:
- predicate: exactMatch / closeMatch / broadMatch / narrowMatch /
             relatedMatch / no_match
- confidence: 0.0 – 1.0
- justification: reasoning for the decision
```

SSSOM has no status column (an undeclared column such as `mapping_status`
is dropped on load), so a proposal is told apart by the file it is in:
write every candidate to
`ontologies/{name}/mappings/{source}-to-{target}-proposed.sssom.tsv`. Keep the
justification of the method that produced the row (`semapv:LexicalMatching`
for lexmatch output) and put the model's verdict and reason in `comment`.
The model's review is not `semapv:SemanticSimilarityThresholdMatching`,
which means a similarity score above a threshold.

A row moves to the mapping file only after a person reviews it: set
`reviewer_id` (for example an ORCID CURIE) and
`mapping_justification: semapv:MappingReview`. A row a person made by hand
takes `semapv:ManualMappingCuration`.

### Step 4: Mapping Predicate Selection

> Here: use only the `skos:*Match` predicates; never propose `owl:equivalentClass` or `owl:sameAs` (the law `bun run beep laws ontology-terms` refuses `owl:sameAs`). Two records that may be one party are an identity decision for Benjamin.

Apply the predicate decision guide. The guide SELECTS the predicate to
PROPOSE — every equivalence-class candidate (`owl:equivalentClass`,
`skos:exactMatch`) stays in the proposals file and routes
through `ontology-foundational-auditor` as a REUSE proposal
(`reuse.exact_reuse_found: true` + mappings with compatibility
justification): the auditor's identity/compatibility analysis and the
steward's ratification of that `otp:` id — the shared `rat-` schema binds to
proposal ids, and mappings are proposals like everything else — are what move
the SSSOM row into the mapping file as reviewed. Confidence is never truth
and no autonomous path asserts equivalence:

```
Logically equivalent with formal proof? → propose owl:equivalentClass
High-confidence equivalence?            → propose skos:exactMatch
Subject more specific than object?      → skos:broadMatch (the object is broader)
Subject more general than object?       → skos:narrowMatch (the object is narrower)
Similar but not fully interchangeable?  → skos:closeMatch
Merely associated?                      → skos:relatedMatch
```

**Critical**: `skos:exactMatch` is TRANSITIVE. Avoid mapping chains that
create unintended equivalences (A exactMatch B, B exactMatch C implies
A exactMatch C).

**Critical**: `owl:sameAs` is not a class-mapping predicate. It states that
two individuals are the same thing; between classes it only works through
punning. It is outside this guide: use it, if at all, for individuals whose
identity is proven, since one wrong `owl:sameAs` merges everything said about
both across every graph that loads it.

### Step 5: Validate

> Here: validate the candidate file under `explorations/erp-ontology/assets/`. "Entity existence" for a thread term is a check against `packages/kernel/src/Terms.vocab.ts`. A term beyond those 22, or an alignment row, is not built.

```bash
# Validate SSSOM schema conformance
uvx --from sssom sssom validate ontologies/{name}/mappings/{source}-to-{target}.sssom.tsv
```

Check:
- Schema conformance (valid SSSOM TSV)
- CURIE resolution (all prefixes in curie_map)
- Entity existence (subjects/objects exist in source/target)
- Predicate consistency (no contradictory predicates for same pair)
- No self-mappings (subject ≠ object)
- No duplicate mappings

### Step 5.5: Clique Analysis (mandatory for exactMatch)

> Here: set `M=explorations/erp-ontology/assets/mappings/{source}-to-{target}`; the candidate file is the only one until Benjamin ratifies rows.

After validation, compute the transitive closure of `skos:exactMatch` and
flag any clique larger than 3 terms for human review. One bad exactMatch
link contaminates an entire clique.

`sssom cliquesummary` groups terms into cliques, reading each row in both
directions. It also joins `skos:closeMatch` and `owl:equivalentClass` rows,
so filter to `skos:exactMatch` first. Run it on the proposals merged with the
mapping file, before review: a proposed link that joins accepted links into
a large clique is caught while the reviewer is still deciding on it. The
summary fails (`max() iterable argument is empty`) on a clique with no
`confidence` value in any row, so keep the confidence lexmatch wrote. Before
the first review there is no mapping file yet: pass only the proposals file
to `sssom merge`.

```bash
M=ontologies/{name}/mappings/{source}-to-{target}
uvx --from sssom sssom merge $M.sssom.tsv $M-proposed.sssom.tsv \
  -o $M-all.sssom.tsv
uvx --from sssom --with pansql sssom filter --predicate_id skos:exactMatch \
  $M-all.sssom.tsv -o $M-exact.sssom.tsv
uvx --from sssom --with networkx sssom cliquesummary \
  $M-exact.sssom.tsv -o $M-cliques.tsv
# Cliques with more than 3 members (column 4 is num_members)
awk -F'\t' 'NR==1 || $4>3' $M-cliques.tsv
```

For cross-domain mappings (source and target are in different domains),
default to `skos:relatedMatch` or `skos:closeMatch`, not `skos:exactMatch`.

### Step 6: Quality Report

> Here: write it as a section of a research report in `explorations/erp-ontology/research/`, with counts, not as `ontologies/{name}/mappings/*-qa.md`.

Generate a quality assessment:

- Predicate distribution (how many of each type)
- Confidence distribution (histogram)
- Source coverage (% of source terms mapped)
- Target coverage (% of target terms mapped)
- Potential conflicts (same subject mapped to multiple objects with
  exactMatch)
- Clique analysis (transitive closure of exactMatch — flag cliques > 3)

## Tool Commands

### SSSOM operations

> Here: paths are under `explorations/erp-ontology/assets/mappings/`; `sssom validate`, `merge` and `dedupe` run today; the bridge `convert -O owl` does not apply.

```bash
# Validate
uvx --from sssom sssom validate ontologies/{name}/mappings/file.sssom.tsv

# Merge mapping sets
uvx --from sssom sssom merge \
  set1.sssom.tsv set2.sssom.tsv \
  -o merged.sssom.tsv

# Deduplicate (keeps the higher-confidence row of a duplicate)
uvx --from sssom sssom dedupe merged.sssom.tsv -o final.sssom.tsv

# Convert to OWL: does not apply here (alignments are projected from the vocabulary)
# Convert to OWL (bridge ontology, written in Turtle syntax)
uvx --from sssom sssom convert ontologies/{name}/mappings/file.sssom.tsv -O owl -o bridge.owl
```

Before publishing bridge ontologies, review any generated identity axioms:
- Confirm whether conversion introduced `owl:sameAs` assertions.
- Downgrade uncertain links to SKOS predicates before release.

### Updating mappings for new ontology version

> Here: check the external target for obsoleted terms the same way; the change lands as a proposed edit to the vocabulary's alignment rows, and the retired and proposed files go in `explorations/erp-ontology/assets/`.

Mapping rows are SSSOM data, not ontology axioms, so they are changed with
`sssom` commands, not KGCL (KGCL has no mapping change).

```bash
# Find obsoleted terms in target, with their replacements
# (IAO:0100001 term replaced by, oio:consider)
uvx --from oaklib runoak -i {target} obsoletes --show-migration-relationships
```

For each row whose object is obsolete, write the row into
`{source}-to-{target}-retired.sssom.tsv` and, where a replacement exists, a
row to the replacement into `{source}-to-{target}-proposed.sssom.tsv` (it is a
new proposal and goes through Step 3 and review). Show both files to the
person; only after they approve, apply the removal:

```bash
M=ontologies/{name}/mappings/{source}-to-{target}
uvx --from sssom sssom remove $M.sssom.tsv \
  --remove-map $M-retired.sssom.tsv -o $M-updated.sssom.tsv
```

Read `$M-updated.sssom.tsv`, then move it over `$M.sssom.tsv`.

## Outputs

> Here: the table's files go under `explorations/erp-ontology/assets/` (candidates, review queue, retired rows) or in a research report (quality report, accepted rows as a vocabulary diff); there is no bridge ontology and no lasting mapping file.

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Mapping file | `ontologies/{name}/mappings/{source}-to-{target}.sssom.tsv` | SSSOM TSV | Reviewed mapping set with metadata |
| Proposals | `ontologies/{name}/mappings/{source}-to-{target}-proposed.sssom.tsv` | SSSOM TSV | Candidates not yet reviewed by a person |
| Quality report | `ontologies/{name}/mappings/{source}-to-{target}-qa.md` | Markdown | Quality assessment with statistics |
| Human review queue | `ontologies/{name}/mappings/{source}-to-{target}-review.tsv` | TSV | Low-confidence pairs for expert review |
| Retired rows | `ontologies/{name}/mappings/{source}-to-{target}-retired.sssom.tsv` | SSSOM TSV | Rows to obsolete targets, removed on a version update |
| Bridge ontology | `ontologies/{name}/mappings/{source}-to-{target}-bridge.owl` | OWL (Turtle syntax) | OWL axioms from mappings (optional) |

## Handoff

> Here: the scout's output is a research report in the packet. SSSOM validation runs today (`uvx --from sssom sssom validate`); the SHACL gate is not built. Hand over the candidate file and the report; a ratification is a `rat-` file under `assets/audit/<name>/governance/ratifications/`, mirrored in `DECISIONS.md`.

**Receives from**: `ontology-scout` — target ontology identifiers,
reuse recommendations

**Passes to**: `ontology-validator` — `ontologies/{name}/mappings/*.sssom.tsv`
(equivalence-class rows enter the mapping file only once the auditor-routed
reuse proposal they correspond to has its ratification record under
`ontologies/{name}/governance/ratifications/`; unratified equivalences stay in
`*-proposed.sssom.tsv` and the validator treats them as non-assertions)

**Handoff checklist**:
- [ ] SSSOM file passes `sssom validate`
- [ ] All CURIEs resolve via curie_map
- [ ] Every mapping has a `mapping_justification` (SEMAPV term)
- [ ] Confidence scores present for all automated mappings
- [ ] Every accepted equivalence row has a steward ratification record
- [ ] Quality report generated and reviewed

## SSSOM File Requirements

Every SSSOM file must include in its YAML header:

```yaml
curie_map:
  # All prefixes used in subject_id and object_id
mapping_set_id: https://example.org/mappings/{source}-to-{target}
license: https://creativecommons.org/licenses/by/4.0/
subject_source: {source ontology IRI}
object_source: {target ontology IRI}
```

Every mapping row must include:
- `subject_id`, `subject_label`
- `predicate_id`
- `object_id`, `object_label`
- `mapping_justification` (SEMAPV term)
- `confidence` (for automated mappings)

## Anti-Patterns to Avoid

> Here: never `owl:sameAs` or `owl:equivalentClass`; mapping files live in `explorations/erp-ontology/assets/mappings/`; an empty lexmatch on gist is "not run".

- **Mapping without context**: Don't match by label alone. Consider
  definitions, parent classes, and domain context.
- **exactMatch overuse**: Default to `closeMatch` when unsure. Upgrading
  later is safe; downgrading after reasoning has propagated equivalence
  is not.
- **sameAs for classes**: Never use `owl:sameAs` as a class mapping. It
  states identity of individuals; class mappings use the predicates in Step 4.
- **Ignoring transitivity**: `skos:exactMatch` is transitive. Check that
  chains don't create unintended equivalences.
- **Missing justification**: Every mapping needs a SEMAPV justification.
  `semapv:LexicalMatching`, `semapv:ManualMappingCuration`,
  `semapv:MappingReview`, `semapv:SemanticSimilarityThresholdMatching`
  (`sssom validate` lists the allowed values when one is wrong).
- **Stale mappings**: When source or target ontology is updated, mappings
  must be rechecked for obsoleted terms.

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| `sssom validate` fails | Missing required fields or invalid CURIEs | Fix curie_map, add missing justifications |
| Lexmatch produces no candidates | Vocabularies use different naming conventions | Try synonym matching, broaden match rules |
| Transitive closure creates false equivalences | Over-use of exactMatch | Downgrade to closeMatch for uncertain pairs |
| Target term is obsoleted | Target ontology was updated | Find the replacement with `runoak obsoletes --show-migration-relationships` (`IAO:0100001`) |
