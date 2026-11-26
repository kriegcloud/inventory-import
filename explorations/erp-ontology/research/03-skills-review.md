---
type: Research
title: A review of the ontology skills before they are used here
description: What is wrong in beep-effect's nine ontology skills and their shared folder, each finding checked by a second reader, split into what to fix upstream and what to adapt for this repository's decisions.
---

# A review of the ontology skills before they are used here

Benjamin asked for the ontology skills in beep-effect's `.agents/skills` to be reviewed and fixed before they are
brought over, since earlier models wrote them. Method: five reviewers, one per group of skills, each followed by a
sceptic who opened every cited line and checked tool facts against the tools' documentation (2026-11-22, beep-effect
at commit 47f7696c). Nothing was edited. Every finding with its evidence, fix and the sceptic's check is in
[assets/03-skills-review.json](../assets/03-skills-review.json).

## What was found

- The nine skill folders are already in this repository's `.agents/skills`, byte for byte the same as beep-effect's.
  The `_shared` folder they read first (19 files) was never copied, so every `_shared/...` reference here dangles,
  and the auditor's validator cannot start.
- 121 findings: 104 confirmed, 17 confirmed in part, none refuted. The sceptics added 25 the reviewers missed.
- `robot` and `runoak` are not installed on this machine. Whether the corrected commands run was checked against
  documentation, not by running them.

| Group | High | Medium | Low | Soundness in one line |
| --- | --- | --- | --- | --- |
| scout-requirements-conceptualizer | 8 | 13 | 4 | The scout, requirements and conceptualizer skills are a reasonable outline of a METHONTOLOGY/NeOn pipeline: CQ elicitation, reuse search, then conceptual modelling behind the auditor's ratification gate. |
| architect-validator | 5 | 13 | 7 | ontology-architect and ontology-validator describe an OBO/ROBOT workflow where Turtle is edited in place (ROBOT template, KGCL, rdflib), then reasoned over, reported on and verified. |
| mapper-curator-sparql | 9 | 11 | 5 | The mapper builds SSSOM mapping sets with oaklib lexmatch plus model checks. |
| shared | 5 | 14 | 5 | _shared holds the ontology skill family's common references: the lifecycle, BFO decision trees, axiom patterns, anti-patterns, naming, tool tree, quality checklist, namespaces, OntoClean rules, the stage-authority matrix and eight record schemas. |
| foundational-auditor | 4 | 11 | 7 | ontology-foundational-auditor is a strict gate between mining code and making ontology terms. |

## The defects that are wrong for everyone (fix in beep-effect)

| Defect | Where | What happens |
| --- | --- | --- |
| `robot verify` used backwards | scout, validator, quality-checklist | verify fails when a query returns rows; the skills use it to prove a competency question has answers, so a passing ontology fails and an empty one passes |
| `robot validate` as a syntax check | scout, validator | no such check exists in ROBOT |
| KGCL statements that do not parse | architect, curator, tool-decision-tree | `create class EX:0001 'x'`, `move ... from ... to ...`, `create definition ... for ...` are not KGCL; `runoak apply` is shown with no output, so nothing is saved |
| `uv run <tool>` with no project | every skill that calls Python | fails outside a project that declares oaklib, sssom, pyshacl or rdflib |
| `runoak` flags and adapters | scout, mapper, sparql-expert | `-l` is not a limit, `lexmatch --add` is misplaced, SPARQL is sent to a SQLite adapter |
| A template run that overwrites the ontology | architect | `robot template --input ontology.ttl --output ontology.ttl` with a wrong claim that merge is the default |
| ELK as the consistency gate, and as the answer to a timeout | scout, validator, checklist | ELK ignores axioms outside OWL 2 EL, so the gate goes green on exactly the axioms it skipped |
| The role pattern asserts the opposite | anti-patterns | `Person bearerOf some StudentRole` says every person is a student |
| BFO and RO facts | bfo-categories | a wrong RO id for has quality, function placed beside disposition, concretization reversed |
| Broken shared SPARQL | anti-patterns | the missing-disjointness query has no `rdf:` prefix and ignores `owl:disjointUnionOf` |
| The authority matrix forbids the conceptualizer's job | stage-authority-matrix | `llm_allowed: false` on the conceptual model the conceptualizer is told to write |
| "If a CQ test fails after intentional changes, update the test" | quality-checklist | contradicts the matrix's rule never to weaken a failing test |
| A syntax check that checks a fixed sample | sparql-expert, requirements | always prints valid; the drafted query is never parsed |
| The auditor's rerun writes inside the folder it scans | foundational-auditor | the idempotence check pollutes its own input; shell variables in the recipe are never set |

## What does not fit this repository's decisions (adapt on the way in)

| The skills assume | Decided here | Change |
| --- | --- | --- |
| BFO as the upper ontology, required | a small gist projection (decision 4) | the upper ontology becomes a project input; a gist guide replaces the BFO one; namespaces gain gist |
| Turtle edited by ROBOT, KGCL, rdflib; LinkML as a second source | a TypeScript vocabulary is the only source, Turtle generated (decisions 2, 5) | the conceptualizer and architect output a proposed change to the vocabulary module; the curator's release steps become "run the projector" |
| Working files in `docs/` and `ontologies/{name}/` | `docs/` is a checked knowledge bundle | outputs move into the exploration packet with frontmatter |
| Inverse properties, `owl:sameAs`, SSSOM as a lasting file | none of the first two; alignments are rows in the vocabulary | drop them; SSSOM becomes an export |
| Triggers on "import", "model", "requirements" | import is this app's main feature | narrow each description to ontology work |
| The auditor's sha256 over exact YAML bytes | the formatter rewrites YAML outside `explorations/` | keep its records under the packet, or exclude them from the formatter |
| `codex exec` seats hard-coded in the auditor, 12,000 lines of validator using Node built-ins | this repository's delegation rules and Effect rules | decide whether the auditor's machinery comes over at all, or only its prompts and failure-mode table |

## Worth keeping as it stands

- Requirements' use-case to CQ to term to test traceability chain, and its rule that the pre-glossary category column is a lexical guess with no authority (requirements lines 163-187, 240-244)
- The conceptualizer's INPUT RULE and edge rule: work only from ratified proposals, and treat an unratified parent or a subClassOf edge as a new candidate for the auditor (lines 43-47, 64-80)
- The domain/range decision procedure: SHACL to constrain, broad OWL domain/range only to infer, local restrictions per class. It matches decision 5 (SHACL over stored rows) and anti-pattern #10's NurseJane example
- The OWA vs CWA section in ontology-validator (what a reasoner catches versus what SHACL catches)
- The validator's Error Handling rule that missing prerequisites are NOT RUN blockers, never passing checks
- The validator carries dispositions.index.yaml forward so unresolved questions stay visible (no false green)
- Mapper rule that equivalence-class mappings stay proposals until a person approves them, and that confidence is never truth (reword the approval to fit inventory-import's DECISIONS.md).
- Mapper predicate guide for the SKOS family (broad/narrow/close/related) and the default to closeMatch or relatedMatch for cross-domain pairs.
- Mapper statement that skos:exactMatch is transitive, with the warning about chains; correct per SKOS.
- foundational-analysis.md: the six laws, the governing principle, the category cheat-sheet that treats software analogues as priors to test, and the full software-domain failure-mode table (enum-is-taxonomy, identifier-is-identity, domain/range-as-validation, vacuous green, OWA/CWA collapse) fit an ERP model built from code
- stage-authority-matrix.yaml: the forbidden_autonomous_decisions list matches the rule that product decisions are Benjamin's, and the rule that only the human steward ratifies
- schemas/denotation-hypothesis: the required null hypothesis with an observation-backed discriminator, and confidence marked use_for_acceptance: false
- The four-stage chain SourceObservation -> DenotationHypothesis -> FoundationalAnalysis+IdentityCard -> OntologyTermProposal, with a required null hypothesis and a discriminator that would be false if the null held
- Abstention outcomes ('no domain referent', 'insufficient evidence', 'multiple models remain viable') counted as success
- The software failure-mode table in _shared/foundational-analysis.md (enum-is-taxonomy -> controlled vocabulary/sh:in, domain/range-as-validation -> SHACL, OWA/CWA collapse, vacuous green, sameAs overreach). It fits decisions 3 and 5 directly

## Not checked

- No corrected command was run: ROBOT and oaklib are not installed here.
- The 25 findings the sceptics added were not themselves checked by a second reader.
- The auditor's `REVIEW-HISTORY.md` was read by one reviewer only; which of its earlier fixes landed is in the JSON.

## Upstream fixes made (2026-11-22)

Benjamin chose to fix upstream first, then adapt. The fixes are in a worktree of beep-effect on the branch
`fix/ontology-skills-review`, not committed: 31 files under `.claude/skills` (the tracked copy; `.agents/skills` there
is generated), 1,863 lines added and 900 removed.

- Method: one owner per skill folder, a checker and a repair pass each; then one editor closed the requests the owners
  left for each other, a sceptic read the whole diff and found 11 more problems, and all 11 were repaired.
- Run, not only read: every `runoak`, `sssom`, `pyshacl` and rdflib command kept in the skills ran against a test
  ontology; the validator's self-test passes and its test file passes (9 tests) after the last edit; beep-effect's
  `skills update --check` reports current, and every `SKILL.md` is under 500 lines.
- Not run: any ROBOT command. ROBOT is not installed and was not downloaded; each was checked against its
  documentation.
- Left open upstream, each needing a decision: renaming `gufo_alignment` to `upper_alignment`; narrowing which shared
  files the run manifest's digest covers (every earlier manifest is stale after this change set either way); a
  ratifiable record for property and axiom commitments; and a fault found in the validator's `expect_err` test helper,
  which hands its label to the function under test.

## Adapted for this repository (2026-11-22)

The upstream fixes are beep-effect pull request 3480 (commit `3933c9da187`). The fixed skills and `_shared` were
copied here from that commit and adapted; nothing here is committed.

- How: each `SKILL.md` has a description written for this repository and an "In this repository" section; a step that
  does not apply opens with a `> Here:` line and its upstream body is kept, so the copies stay comparable.
  `_shared/project-profile.md` holds this packet's decisions and wins over skill text.
- New: `_shared/gist-categories.md`, every one of its 82 gist names checked against gist 14.1.0's `gistCore.ttl` by
  the writer and again by a second reader; `_shared/namespaces.json` gained gist and the alignment vocabularies.
- Checked two ways: a sceptic read the whole set, and a second agent followed seven of the skills on a real task
  (terms for Organization with role flags and for IdentityDecision). Together they found 43 problems; 37 were fixed
  and 6 set aside with a reason. The auditor's validator self-test passes here; every `SKILL.md` is under 500 lines;
  `bun run check` passes.
- Not done: the auditor has no adapter for prose sources, so it stops at its first step and asks; whether
  `bun run check` accepts an adapter script under `explorations/` was not tried.
- Open for Benjamin, listed in the profile: which properties carry a label and a definition, which gist terms make up
  the projection, the placeholder namespace's exact path and prefix, the form of a SKOS concept's IRI, where generated
  Turtle lives, and which engine runs the competency questions.
