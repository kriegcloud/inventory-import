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
| 3 | `@inventory/ontology`, empty but wired: the package, its `turbo.json`, the two `laws boundaries` rows (7.2), `enrolment.json`, the exception list | `boundaries:check`, `config-sync:check` | done |
| 4 | Gate 4, vocabulary coherence, with its planted mistake, the C12 negative and the test that the 22 terms name 111 and the exception entry 97 (6.4) | `Coherence.test.ts` | done |
| 5 | The marks on the five enrolled records (3.3 to 3.7), then gate 5 with P13 and its negatives (6.5) | `Pointers.test.ts`; `ActivityMarks.types.ts` (6.6); the app's own tests unchanged || done |
| 6 | The lift, `graphOf` and `threadGraph` (4), in memory | The seventeen triples of 4.4, asserted on the value `threadGraph()` returns || done |
| 7 | The projector and the writer; `bun run ontology:write` writes the three files; `RELEASES.md`; gates 1, 2 and 3 with their fixtures, ban 5's two included (6.1 to 6.3, 8) | `Generated.test.ts`; a second write changes no byte | done |
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
| How gate 4 reads `DECISIONS.md`, and gate 5 `enrolment.json`, from outside the test's package: a `?raw` import or `node:fs`, and what `laws boundaries` says of it | 3, 4, 5 | Gate 4 reads the log with a `?raw` import and a `test/raw.d.ts` declaration, as `packages/catalog/model` reads `docs/verify.md`; the type-check and Vitest accept it, and `laws boundaries` says nothing of a relative path that names no app and no scratchpad. `node:fs` was not tried. The exception list is a JSON import decoded strictly. Gate 5's read of `enrolment.json` is step 5's |
| Whether a package's `turbo.json` may declare the uncached `reason` task and name an out-of-package input, and whether an edit or a deletion of that input invalidates the cache | 3, 10 | The out-of-package input is accepted (`$TURBO_ROOT$/explorations/erp-ontology/DECISIONS.md` in the package's `test` inputs): one added space, a broken heading and the file's removal each gave a cache miss, and restoring the bytes gave the first hash back as a hit. An edit to the exception list misses too. The `reason` task is not declared yet: step 10's |
| Whether `config-sync` accepts the new package and the new root task (section 10, "Turbo and the sync commands"); the inputs the existing source-law tasks declare | 3, 9 | The package is accepted: `config-sync` wrote its three scripts and the reference in the root `tsconfig.json`, and `config-sync:check` agrees. It has no `src` yet, so no `tsconfig.json`; step 5 adds both. The new root task is step 9's |
| The marks on a `Model.Class` and `fieldEvolve`'s types (3.5); whether the spread in the compile-only file keeps literal types; P12's element field name | 5 | Partly, in step 1 on a local `Model.Class`: the class pointer is read, `fieldEvolve` with a hoisted mark compiles, the marks reach every variant. Step 5: they hold on the real `Activity` (`packages/kernel/test/ActivityMarks.types.ts` compiles, the spread keeps the literal types); `nullAsNone` now takes a key's annotations with its description, body unchanged; P12's element is the array node's one `rest` member, compared by identity with the variant's node |
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

None. Steps 1 to 7 are done; step 8 starts on Benjamin's word.

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
- **A finding names a term by its key too** (`Grant`, not `inv:Grant` as section 6.4 writes the planted mistake's
  report): the rules compare keys, which is what the vocabulary stores.
- **`laws boundaries` reads a package's `src` and `test` only.** The ontology package's `scripts/write.ts` (step 7)
  and `scripts/reason.ts` (step 10) would be outside the law, so each step keeps what its script imports in `src`,
  or widens the law to `scripts/`; the step says which.
  Step 7 keeps it in `src`: `scripts/write.ts` imports `src/Generated.ts`, `effect` and `node:fs`, and nothing else.
- **The ontology package declares only what a built step uses.** Section 7.1's `@beep/identity`,
  `@inventory/access-contract`, `n3` and `oxigraph` come with steps 5, 7 and 8.
- **Gate 5's rules are in the ontology package** (`packages/ontology/src/Pointers.rules.ts`), a pure function over
  the vocabulary, the enrolment list, the schemas `Enrolled.ts` maps it to and P13's table. They read a record's
  fields through the reader's own `fieldsOf`, which `@beep/vocabulary/Pointer` now exports, so the gate and the
  reader cannot disagree on what a record's fields are.
- **Three marks carry no description**, where section 3.5 gives one: `Activity.organizationId`, `Activity.actorId`
  and `Person.role`. A description there would change the API's OpenAPI document, and step 5 leaves it as it was.
  `Activity.agent` keeps its description beside its mark; the JSON Schema of `Activity.json` gives `agent` no
  description before the change or after it (measured on both shapes).
- **P10 cannot be skipped by leaving a table out.** A record with a `Model.Class`'s six variants must have its
  table in `Enrolled.ts`, holding exactly the six, each the class's own; a table for a schema with no variants, or
  for an entry that is no record, is a finding too. Section 6.5 states only that the variants carry the same marks.
- **A node step's properties name the node's class exactly.** P7 holds section 4.3 as written: the side of the
  linking property that is the created node, and each fixed property's domain, must be declared and be that class;
  an absent domain passes only for P5 and for the value step.
- **A mark that does not decode is reported under the rule of its key**: a `term` under P5, a `path` under P7, a
  `noTerm` under P9. P3 says only that a field has exactly one of the three keys.
- **A P13 row for an entry that is no enrolled record is a finding**, as a row for a field the record lacks is.
- **Step 5's fixes after its review were finished without a second review.** Two providers read the first build and
  found six things; five were changed and one (`Activity.agent`) measured and left. The Opus lane that made the
  changes ran out of quota before it handed back, so what it left was read and run by the orchestrator, not by
  another provider. Step 13's reviewers read it again.

- **`lift` and `graphOf` take what they read as their first argument**: `lift(context, record, value)`, where
  report 14 section 4.2 writes `lift(record, value)`. The context is the decoded vocabulary, the prefix the marks
  carry and the class whose instances are tenants; `packages/ontology/src/Thread.ts` is the one file that says they
  are the kernel's vocabulary, `inv` and `Tenant`, so `Lift.ts` names no term of its own.
- **A graph in memory is the package's own `Triple` schema** (`Graph.schema.ts`): IRIs, and a literal with its
  datatype. No blank node and no language tag; a Turtle text that holds one is refused when read. Two graphs are
  compared as the sorted lines of their distinct triples.
- **`n3` came with step 6, not step 7.** The hand-written part of the fixture is Turtle and `graphOf` must read it.
  `n3` is 2.13.12; `@types/n3` is 1.26.6, the newest there is, one major behind the library. Only `Parser` is used.
- **The lift writes no literal yet.** Section 4.3's case (a) is refused with a reason: no record the thread lifts
  has a datatype property, and the lift of `Activity` is outside SPEC. Cases (b) and (c) and the link to another
  record are built; (c) and the link are what `Member` uses, and (b) has no test.
- **A value that goes into an IRI is held to the kernel's id pattern** (letters, digits, `_`, `-`, 64 at most), so
  the lift never escapes a path segment; any other value is refused.
- **`Thread.ts` reads the hand-written fixture with a `?raw` import**, which Vite resolves and bun alone does not.
  Step 7's `ontology:write` runs where Vite resolves it, or changes that one import; the step says which.
  Measured in step 7: bun does resolve `?raw` on a `.ttl` to its text, so `bun packages/ontology/scripts/write.ts`
  runs the same import Vitest does and nothing changed. Vite does not parse `with { type: "text" }`, the other way.
- **What gate 5 and the lift both read is in one file** (`packages/ontology/src/internal/terms.ts`): a CURIE's local
  name, the class, scheme or property it is, the term a schema points at.
- **Step 6 was built by the orchestrator and read by no second provider**: the Opus quota is spent until 28 November
  and Codex's was until 24 November. Step 13's reviewers read it.
- **gist's version IRI is a field of the vocabulary** (`GistProjection.versionIri`, decision 122): the OWL file's
  `dcterms:source` reads it from the kernel's literal. The IRI is `gistCore14.1.0`, not verified from a file: the
  tagged source holds the placeholder `gistCoreX.x.x`.
- **A label or a definition is a third kind of object** (`TextNode`: words and a language tag), beside an IRI and a
  literal with a datatype. Step 6's graph had no language tag and refused one when read; the two generated
  vocabulary files need them.
- **The writer's order is section 6.3's table**: a file's predicates are written in the order its row of the table
  lists them, `rdf:type` first as `a`; subjects by code point inside each section; a predicate the order does not
  hold is refused, not written last.
- **Gate 3 has its own lists** (`Constructs.rules.ts`), written from section 6.3 and not read from the projector's
  order, so a predicate added to the projector by mistake is refused by the gate. It reads the text with blank
  nodes kept (`parseTurtle`); every other reader refuses them (`readTurtle`).
- **`gate3-subclass.ttl` is ban 5's near miss as a file**, beside the six negatives the report and SPEC name.
- **`ontology:write` is a root script that runs a file with bun** (`packages/ontology/scripts/write.ts`), not a
  command of the repository's CLI. The script is in the package's test project (`tsconfig.test.json`), because
  `deprecated:check` refuses a code file in no tsconfig, so it is written under the Effect rules; it alone in the
  package reads `node:fs`, with the diagnostic off in its first line.
- **Gate 1 compares in memory.** The test imports each committed file as text and compares it with what
  `generatedFiles()` returns; nothing is written during a test.
- **Gate 3 refuses a W3C term as an object except as a type or as an `xsd:` datatype a property ranges over.**
  Section 6.3's lists are of predicates and types, and a text passed them with `inv:membershipIn rdfs:subPropertyOf`
  the sameness property, or a class under the restriction class: ban 5 by another road. The guard is stricter than
  the report's table: `rdfs:subClassOf owl:Thing` and `rdfs:range rdfs:Literal` are refused too. The projector
  writes neither; a slice that needs one widens the guard.
- **`dcterms:source` takes one object**, gist's version IRI from the vocabulary; any other host there is refused.
- **The writer refuses what it cannot write as Turtle**: a header line with a line break, a prefix that is not a
  letter then letters and digits, a value that is not NFC. An IRI holds no control character and a language tag is
  lower case, in the schema, because a reader lowers the tag and the round trip would differ.
- **Step 7 was built by the orchestrator and read twice by Grok 4.7**, once against the report and once to break the
  writer and the gates; Opus (direct and through Cursor) and Codex were out of quota. Seven of its nine findings
  were fixed with a test each: the object guard, the source exception, the IRI pattern, the language tag, the header,
  the prefix, the escapes the round-trip test did not assert, and the code-point order no test held. One finding was
  kept as it is, the stricter guard above. Step 13's reviewers read the step again.

## Closing note

Written when the goal is done.
