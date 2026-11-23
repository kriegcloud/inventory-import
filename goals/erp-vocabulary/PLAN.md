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
| 1 | `@beep/vocabulary` (7.1): the metamodel schemas, with `ratification` as `{ decision }` (2.6); gate 4's rules as a pure function; the generic pointer makers and the reader of marks from an AST; the RDF registry (7.3) | The package type-checks under the full profile; the metamodel decodes a two-term literal | done |
| 2 | The vocabulary value and the five bound helpers in the kernel (`Terms.vocab.ts`, `Terms.pointer.ts`; 2, 3.2) | The literal satisfies the encoded side; `TermsPointer.types.ts` (6.6) | done |
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
| Whether report 05's metamodel sketch compiles once `ratification` is `{ decision }`; `annoteSchema`'s extras, `nullAsNone`, `S.Opaque` `fields`, `mergeVocab`'s literal types, `rdf:type` in `CoreVocab` | 1 | Compiles under the full profile once cut to what the thread uses. `annoteSchema` keeps string-keyed extras beside `description`; `S.Opaque` exposes `fields`; `mergeVocab` keeps literal types (`"xsd:integer"` is a type error); `rdf:type` was already in `CoreVocab`. `nullAsNone` is the kernel's: its parameter type takes only `description` and `messageMissingKey`, so the spread of a mark that report 14 section 3.6 writes for `Person.email` and `joinedAt` does not type-check, and a mark put on the inner schema is not read. Step 5 widens the parameter to a key's annotations; its body already passes the whole object on |
| The literal's `satisfies`, and `InvConceptCurie` and the three registries derived from it. The brief says to try this in the scratchpad first | 2 | Holds, tried in the kernel directly: the literal passes `satisfies` and decodes strictly, the namespace built from the base stays a literal type, each registry gives the exact union of CURIEs, and a misspelt class, property or notation is a type error |
| How gate 4 reads `DECISIONS.md`, and gate 5 `enrolment.json`, from outside the test's package: a `?raw` import or `node:fs`, and what `laws boundaries` says of it | 3, 4, 5 | |
| Whether a package's `turbo.json` may declare the uncached `reason` task and name an out-of-package input, and whether an edit or a deletion of that input invalidates the cache | 3, 10 | |
| Whether `config-sync` accepts the new package and the new root task (section 10, "Turbo and the sync commands"); the inputs the existing source-law tasks declare | 3, 9 | |
| The marks on a `Model.Class` and `fieldEvolve`'s types (3.5); whether the spread in the compile-only file keeps literal types; P12's element field name | 5 | Partly, in step 1 on a local `Model.Class`: the class pointer is read, `fieldEvolve` with a hoisted mark compiles, the marks reach every variant. The equality file on the real `Activity` is step 5's |
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

- **A class's gist parent is a name, not a CURIE** (`{ kind: "gist", name: "TemporalRelation" }`), as report 14
  section 2.6 writes it and not as report 05 did. Rule C3 checks the name against the vocabulary's gist list.
- **A term's label field is `prefLabel`**, after decision 11 and report 05; report 14 section 2.6's sketch wrote
  `label`.
- **The metamodel holds only what the thread uses.** `KindTag` has four values (decision 18 is open on the rest), an
  identity criterion is stated or inherited, and a term has no `source`, `scope`, `deprecation` or `subPropertyOf`.
  A literal that carries one is refused; each comes back with the slice that needs it. Rule C9 (sub-properties) is
  therefore not built, and C2 is held by decoding.
- **The exception list names a class by its key** (`"class": "Role"`), where report 14 section 6.4 wrote
  `"inv:Role"`. The module names classes by key everywhere else, and the foundation package knows no prefix of this
  repository. The agent chose it; it is Benjamin's to reverse, and reversing it is one schema line.
- **Gate 4's planted reason is twelve characters or more.** A `none` parent's reason is held to a definition's
  length, so report 14's `reason: "planted"` would be refused by decoding before rule C4 ran. Step 4 plants a longer
  one.
- **Gate 4 also refuses a cycle in the gist list and a disjoint pair that names one class twice.** Report 14 does not
  list either; the review of step 1 showed the first would loop a later walk and the second would make a class
  unsatisfiable for a reason no planted mistake names.
- **A mark is read only where it is the last step that builds a field's node.** A mark written before a `decodeTo`,
  or inside `S.optional`, `S.NullOr` or `S.Array`, is not found, and gate 5 will report the field as unplaced. None
  of the thread's five records does this; step 5 confirms it on the real files.
- **A record is told from other declarations by Effect's own class annotation** (`"~constructor"`), so
  `S.Option(SomeRecord)` is not read as a record. The key is internal to Effect; if a later version renames it the
  reader's class tests fail, they do not pass silently.
- **The literal carries section 2's text without its table notes.** A definition cell's trailing note of where the
  text came from ("(decision 108)", "(new)", "(new wording; decision 96)") is left out, and so is the last sentence
  of `Grant`'s identity cell, "See the note below.", which points at the report's own prose. No other word differs:
  a second provider compared all 22 terms and the gist names with report 14 and found none.
- **Two things section 2 says have no field and are comments in the module.** `Tenant`'s identity is `inherited`,
  which holds no text, so "In the repository it is told apart by `OrganizationId` (decision 38)" is a comment beside
  it. `GrantScopeKindScheme` is `closed: false`; why (decision 96) is not stated in the value. A concept's identity
  criterion is its scheme and notation, which is its key.
- **A class's named ancestors are not on the class.** They follow from the gist list's parent links.
- **The base IRI has no trailing slash** (`https://example.org/inventory-import`); report 14 section 5.2's Turtle
  `@base` adds it, as section 4.1's `<base>/...` reads.
- **`noTerm` in the kernel turns one diagnostic off for its line** (`missingPipeableSignature`): it builds a mark
  and has nothing to pipe.
- **Mark types are type aliases.** An interface is refused by `annotateKey`, whose annotation types carry an index
  signature.

## Closing note

Written when the goal is done.
