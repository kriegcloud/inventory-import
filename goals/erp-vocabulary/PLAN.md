---
type: Plan
title: "erp-vocabulary, plan"
description: The steps of the erp-vocabulary goal, their status, what the design left unchecked, the current blocker and the choices made along the way.
from: explorations/erp-ontology
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. Section numbers are
[report 14](../../explorations/erp-ontology/research/14-thin-thread.md)'s. Each step ends with `bun run check`
passing and a commit; the app is never broken between steps.

| # | Step | Proves | Status |
| --- | --- | --- | --- |
| 1 | `@beep/vocabulary` (7.1): the metamodel schemas, with `ratification` as `{ decision }` (2.6); gate 4's rules as a pure function; the generic pointer makers and the reader of marks from an AST; the RDF registry (7.3) | The package type-checks under the full profile; the metamodel decodes a two-term literal | todo |
| 2 | The vocabulary value and the five bound helpers in the kernel (`Terms.vocab.ts`, `Terms.pointer.ts`; 2, 3.2) | The literal satisfies the encoded side; `TermsPointer.types.ts` (6.6) | todo |
| 3 | `@inventory/ontology`, empty but wired: the package, its `turbo.json`, the two `laws boundaries` rows (7.2), `enrolment.json`, the exception list | `boundaries:check`, `config-sync:check` | todo |
| 4 | Gate 4, vocabulary coherence, with its planted mistake, the C12 negative and the test that the 22 terms name 111 and the exception entry 97 (6.4) | `Coherence.test.ts` | todo |
| 5 | The marks on the five enrolled records (3.3 to 3.7), then gate 5 with P13 and its negatives (6.5) | `Pointers.test.ts`; `ActivityMarks.types.ts` (6.6); the app's own tests unchanged | todo |
| 6 | The lift, `graphOf` and `threadGraph` (4), in memory | The seventeen triples of 4.4, asserted on the value `threadGraph()` returns | todo |
| 7 | The projector and the writer; `bun run ontology:write` writes the three files; `RELEASES.md`; gates 1, 2 and 3 with their fixtures, ban 5's two included (6.1 to 6.3, 8) | `Generated.test.ts`; a second write changes no byte | todo |
| 8 | Gate 8: CQ-P06 and CQ-P11 in Oxigraph, their expected rows, M1 to M7, CQ-P11's must-fail case and the three guards of 4.4 (5, 6.8; decision 120); bans 3 and 4 named | `Questions.test.ts` | todo |
| 9 | Gate 7, `laws ontology-terms`, in the repository CLI, with its test; its root task in `check`, `check:full` and `check:ci` (6.7) | `ontology-terms:check` | todo |
| 10 | Gate 9: `robot.lock.json`, `scripts/reason.ts` with its four refusals, the two positive runs and the three negative ones (6.9, 6.10; decisions 112, 113, 121); bans 1 and 2 named in its output | `bun run check:full` on a run that started the reasoner | todo |
| 11 | The CI job for gate 9 (decision 114), written and not pushed | The workflow file read by the closing review; `check:ci` does not gain `reason` | todo |
| 12 | The walk of each planted mistake through all nine gates (6.11), with the new fixtures of bans 2 and 5 added to it | Each row of SPEC's ban table names a test or a run that exists | todo |
| 13 | Close: `/quality-review-fix-loop`, the documents the build made false (report 14's sections SPEC names as replaced), the closing note | Reviewers' findings at zero required | todo |

Steps 4 to 9 need no Java. Step 10 is the first that does.

## What the design left unchecked

Report 14 section 10 lists what no one tried. Each is settled by the step that meets it, and its outcome is written
here when it is.

| Left unchecked | Met in step | Outcome |
| --- | --- | --- |
| Whether report 05's metamodel sketch compiles once `ratification` is `{ decision }`; `annoteSchema`'s extras, `nullAsNone`, `S.Opaque` `fields`, `mergeVocab`'s literal types, `rdf:type` in `CoreVocab` | 1 | |
| The literal's `satisfies`, and `InvConceptCurie` and the three registries derived from it. The brief says to try this in the scratchpad first | 2 | |
| How gate 4 reads `DECISIONS.md`, and gate 5 `enrolment.json`, from outside the test's package: a `?raw` import or `node:fs`, and what `laws boundaries` says of it | 3, 4, 5 | |
| Whether a package's `turbo.json` may declare the uncached `reason` task and name an out-of-package input, and whether an edit or a deletion of that input invalidates the cache | 3, 10 | |
| Whether `config-sync` accepts the new package and the new root task (section 10, "Turbo and the sync commands"); the inputs the existing source-law tasks declare | 3, 9 | |
| The marks on a `Model.Class` and `fieldEvolve`'s types (3.5); whether the spread in the compile-only file keeps literal types; P12's element field name | 5 | |
| Whether N3.js and Oxigraph run under this repository's Vitest and Effect rules (decision 26) | 7, 8 | |
| `import type` erasure, and how gate 7's rule 7 resolves `paths` and `imports` aliases from text, without the compiler | 9 | |
| gist itself: the parents of `LivingThing`, `TemporalRelation` and `Assignment`, the three disjoint pairs and that there is no other, and the version IRI. Report 11 read them; the pinned gist file was never opened. Bans 1 and 2 rest on them | 7, 10 | |
| ROBOT's flags, where the jar is kept, how the script reads Java's major version, and whether a merged file with undeclared fixture individuals passes the OWL 2 DL profile check (five fixtures now) | 10 | |
| Whether ROBOT reports ban 2's two fixtures inconsistent and its near miss consistent | 10 | |
| The CI workflow for gate 9: its cache action, its key and its Java setup | 11 | |
| That the stored `userId` links an account and not the human | not met: no stored row is read in the thread | |
| Whether a term may name a combined heading such as `### 39 and 43.` | not met: the thread names 111 and 97 only | |
| Decision 117's bans, undrafted when the report was last edited | settled: SPEC's table, decision 121 | |

## Current blocker

None. Step 1 can start on Benjamin's word: it is the first code of this goal.

## Choices made

Where the design left a choice open, or the code showed it could not be followed as written.

- None yet.

## Closing note

Written when the goal is done.
