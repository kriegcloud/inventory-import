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
| 8 | Gate 8: CQ-P06 and CQ-P11 in Oxigraph, their expected rows, M1 to M7, CQ-P11's must-fail case and the three guards of 4.4 (5, 6.8; decision 120); bans 3 and 4 named | `Questions.test.ts` | done |
| 9 | Gate 7, `laws ontology-terms`, in the repository CLI, with its test; its root task in `check`, `check:full` and `check:ci` (6.7) | `ontology-terms:check` | done |
| 10 | Gate 9: `robot.lock.json`, `scripts/reason.ts` with its four refusals, the two positive runs and the three negative ones (6.9, 6.10; decisions 112, 113, 121); bans 1 and 2 named in its output | `bun run check:full` on a run that started the reasoner | done |
| 11 | The CI job for gate 9 (decision 114), written and not pushed | The workflow file read by the closing review; `check:ci` does not gain `reason` || done |
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
| Whether N3.js and Oxigraph run under this repository's Vitest and Effect rules (decision 26) | 7, 8 | Both do. N3.js 2.13 parses under Vitest on Node with its typings one major behind; only `Parser` is used, behind `Effect.try`. Oxigraph 0.5.13 loads its WebAssembly at import with no setup, takes the graph as N-Triples and answers a SELECT as an array of maps; the one call that throws is behind `Effect.try` in `test/support/ask.ts`. Neither needed a diagnostic turned off |
| `import type` erasure, and how gate 7's rule 7 resolves `paths` and `imports` aliases from text, without the compiler | 9 | Checked in the law's test, on text: a whole-statement `import type` or `export type` passes; `import { type X }` is refused, because `verbatimModuleSyntax` keeps the statement and the module is loaded. A specifier is resolved to files through a relative path, a package's `exports`, the nearest `package.json`'s `imports` and each `tsconfig*.json`'s `paths` (with `baseUrl`, and through `extends` to a configuration of any name in the repository), each with a test; a `types` condition is not the file loaded, and a `?raw` suffix names the same file. A dynamic import is read where its module is a text, a constant, a sum or a template of those. Not resolved: a dynamic import whose module is worked out at run time, a plain `require()` call, and files ending `.mts`, `.cts` or `.js` (the repository has none in a workspace). A module that re-exports the vocabulary is refused where it re-exports, not where it is imported |
| gist itself: the parents of `LivingThing`, `TemporalRelation` and `Assignment`, the three disjoint pairs and that there is no other, and the version IRI. Report 11 read them; the pinned gist file was never opened. Bans 1 and 2 rest on them | 7, 10 | Step 7: the version IRI is `gistCore14.1.0` by decision 122, not read from a file. The rest waits for step 10 |
| ROBOT's flags, where the jar is kept, how the script reads Java's major version, and whether a merged file with undeclared fixture individuals passes the OWL 2 DL profile check (five fixtures now) | 10 | Tried on v1.9.11 under Java 17.0.21. ROBOT's own `merge --input a --input b` fails the profile check: it reads each file alone, a file of data alone declares no property, and its statements are read as annotations ("Cannot pun between properties"). Joined into one Turtle document, ontology first, all five pass the profile check with the fixture individuals undeclared. So the script joins the files; a test holds that the joined document states the triples the files state apart. The flags are `validate-profile --input f --profile DL --output report` and `reason --input f --reasoner hermit`, each run in a temporary folder. The jar is kept at `$XDG_CACHE_HOME` (or `~/.cache`) `/inventory-import/robot/v1.9.11/robot.jar`. Java's major version is read from the quoted text of `java -version` |
| Whether ROBOT reports ban 2's two fixtures inconsistent and its near miss consistent | 10 | Yes: `entry-is-person.ttl` and `entry-is-tenant.ttl` are each reported inconsistent (exit 1, "The ontology is inconsistent") and `entry-names-member.ttl` consistent. With gist's `owl:disjointWith` statements taken out of a copy of the ontology, all three refused files turn consistent, so each refusal rests on the disjointness its ban names (tried by hand, not a committed test) |
| The CI workflow for gate 9: its cache action, its key and its Java setup | 11 | The job `reason` in `.github/workflows/ci.yml`. `actions/cache/restore@v6` and `actions/cache/save@v6`, the versions the `proofs` job uses, on the folder the script keeps the jar in, under the key `robot-jar-<sha256>`; `actions/setup-java@v6` with Temurin, whose `JAVA_HOME` the script reads first. The release, the sha256 and Java's major version are read from `robot.lock.json` in the job's first step of its own. It has not run on GitHub: nothing is pushed. Its steps were run on this machine with an empty jar folder (the jar fetched) and with the jar kept |
| That the stored `userId` links an account and not the human | not met: no stored row is read in the thread | |
| Whether a term may name a combined heading such as `### 39 and 43.` | not met: the thread names 111 and 97 only | |
| Decision 117's bans, undrafted when the report was last edited | settled: SPEC's table, decision 121 | |

## Current blocker

Steps 1 to 11 are done; step 12 starts on Benjamin's word.

`origin/main` was merged into this branch on 2026-11-23 (commit `91e1b413`), and six laws that came with it
refused code this goal wrote: `diagnostics:check` (15 `@effect-diagnostics` directives), `defaults:check` (25
places), `promises:check` (7), `readonly:check` (4), `dual:check` (1) and `assertions:check` (1). Commit
`e624f985` meets each in the code, with no directive and no ledger line: the helpers are dual, the two scripts run
on Effect's `FileSystem`, `Path`, `ChildProcess` and `Digest` through `BunRuntime.runMain`, and absence is an
`Option` matched where it is used. `bun run check` passes again; `ontology:write` rewrites the generated files byte
for byte, and `reason` passes with the cached jar and with an empty cache.

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
- **`oxigraph` is a development dependency** (0.5.13): only the tests ask a question. The runner is
  `test/support/ask.ts`, not a file of `src`; a later slice that asks questions outside a test moves it.
- **A question's rows are compared as IRIs in the query's own order.** `ask` returns, for each solution, the value
  of each variable asked for; the expected rows of both questions are in `Questions.test.ts`, built from the
  vocabulary, and are the lock decision 118 names.
- **M5 is a query file of its own** (`fixtures/cq/CQ-P06.M5.rq`), marked as a mutant in its first line, so the three
  queries are read the same way and the mutant is not a string in a test.
- **The guards of section 4.4 are two functions and one comparison.** `overreach` and `unshown`
  (`src/Fixture.rules.ts`) are guards 1 and 3; each has a test where it reports something, so neither passes by
  finding nothing to look at. What the lift states is read from the lifted triples, not from a list of four
  predicates. Guard 2 is a comparison in the test.
- **M3 and M7 are asked of CQ-P11 too**: a role on the member, or a grant with no scope, answers neither question.
- **Step 8 was built by the orchestrator and read once by Grok 4.7**; Opus, Cursor's Opus seat and Codex were out
  of quota. Its five findings were fixed: a test that the questions ask for a node's type (the query passed with
  both type patterns deleted), the hand-written part held to section 5.2's five triples, M5's file sorted as the
  question is and its rows compared whatever their order, and two assertions that could not fail replaced or
  removed. Step 13's reviewers read the step again.
- **Gate 7 is `bun run beep laws ontology-terms`** (`Laws/OntologyTerms.rules.ts`, its reader of the syntax tree in
  `Laws/internal/ontologyTermsCode.ts`), the root task `ontology-terms:check` in the three checks. It reads every
  code file git would commit except `.agents`, the scratchpad and its own source and test, which hold the texts it
  refuses. Rules 1b and 3 read a workspace's `src` only: a test builds marks no generated file is made from.
- **Rule 1 is "the enrolled declaration carries a helper's call"**, in the declaration itself or in a constant of
  the same file it reads (a mark hoisted as `Activity`'s are). An enrolled name the file does not declare, a file
  git does not list and a list that cannot be read are each refused; the last stops the law, since with no list
  rule 1 would pass every record.
- **Rule 6 is narrower than "any object key named `term`, `path` or `noTerm`"**, which refused rule tables, error
  fields named `path` and the vendored identity kit. It refuses the three keys in the argument of a call whose
  name begins `annot`, in the annotations a class takes when the value has a mark's shape, and anywhere an object
  has the helper's own shape (a `term` with a colon, a `path` of steps, a `noTerm` with a reason). A constant
  named or spread in an annotation is read as the annotation's own object, and a key between square brackets as
  the text it reads as. Not read for it: the module that returns a mark (`Pointer.mark.ts`; section 6.7 names it
  `Pointer.ts`), that package's tests, which hand its reader marks no helper would make, and each vendored kit
  package. Not found: a class's annotations whose value under one of the three keys is no string, list or
  object written out, since a field there is a schema under the same shape.
- **A helper is one imported from the module that makes the five** (`packages/kernel/src/Terms.pointer.ts`, found
  by resolving the import as rule 7 does), so a function named `noTerm` from elsewhere neither marks a record nor
  is refused. Rule 3 also refuses a helper taken out of its namespace, read by a quoted name or re-exported under
  another name, and a second maker (`pointerFor`, `pathFor`, `noTermFor`) outside that module: section 6.7 does
  not name makers, and without it a second set of helpers would take any argument.
- **Rule 7 moved the kernel's `Terms.test.ts` into the ontology package**: the test reads the vocabulary's value,
  and only `packages/ontology` may import it. The kernel's own files are held to the rule too.
- **Two comments in `Project.ts` no longer write the base IRI** (rule 5 reads comments as well as code).
- **The task's inputs are every `.json`**, not only the configurations by name: the law reads `vendor.json` and
  whatever a `tsconfig` extends.
- **Step 9 was built by the orchestrator and read twice by Grok 4.7**, each time asked to write a tree the law
  passes and should not; Opus, Cursor's Opus seat and Codex were out of quota. The first reading found ten things
  and the second eight, all fixed with a test each: a key between square brackets, a mark built in a constant,
  in brackets, under `satisfies` or in a function, a helper reached by destructuring or a quoted name, dynamic
  imports that are not one string, a `?raw` suffix, `extends`, a `types` condition taken for the file loaded, an
  exemption wider than the one module, `typeof` a helper refused, a `vendor.json` above the packages, an
  unrelated function of a helper's name, and data handed to a curried function refused. The second reading's
  fixes were not read a third time. Step 13's reviewers read the step again.
- **Gate 9 is `packages/ontology`'s `reason` task** (`bun scripts/reason.ts`), never cached, named in the root
  `check:full` only. What a run must come to is in `src/Reason.ts`, behind a port for the machine (`Machine`: the
  Javas, the jar, the fetch, ROBOT), so the four refusals and the judgments are tested in `bun run check` with no
  Java (`Reason.test.ts`); the script supplies the real machine. Its output names the ban each run stands for.
- **The five runs**: the thread's graph alone (ban 1's near miss, one person a member of two tenants) and with
  `entry-names-member.ttl` (ban 2's near miss) must be in the DL profile and consistent; with
  `person-is-tenant.ttl`, `entry-is-person.ttl` and `entry-is-tenant.ttl` each must be in the DL profile and
  reported inconsistent. A refused file that fails the profile check, or a reasoner that stops for another reason
  than an inconsistency, fails the gate: a crash is no refusal.
- **The script looks for Java 17 in three places**, in order: `JAVA_HOME`, `java` on the PATH, then each folder of
  `/usr/lib/jvm`. This machine's default Java is 27, and without the third place `check:full` would fail here
  until `JAVA_HOME` was set by hand. With no Java 17 in any of them it fails and names each place and what
  answered there.
- **A jar that is there and is not the approved file is refused, not replaced**: the script says to delete it.
  The fetch writes beside the jar's place and moves the file there whole. The pin's test holds
  `robot.lock.json` to the values of decisions 112 and 113, so a changed pin fails `bun run check`.
- **`noTerm("deferred", slice)` is now one tuple in the helper's type** (`NoTermMaker` in `@beep/vocabulary`),
  with the same call. Step 4 had switched an Effect diagnostic off on the kernel's `noTerm`, and the CLI's slow
  test refuses that in any file the scratchpad can reach; `check:full` showed it at this step, the first since
  step 4 to run the slow tests.
- **Step 10 was built by the orchestrator and read by Grok 4.7**; Opus, Cursor's Opus seat and Codex were out of
  quota. Its first reading ran out of time with no report. Its second read the source and found no way for the
  gate to pass when it should fail; it named the CI job as missing, which is step 11, and that a run that hangs
  would wait for ever, now stopped after five minutes and counted failed. Its sandbox did not let it start ROBOT,
  so what the reasoner itself says was tried by the orchestrator alone: the five runs, the three refused files
  turning consistent without gist's disjointness, a jar that is not the approved file, a cache that cannot be
  written, and a real fetch into an empty cache. Step 13's reviewers read the step again.
- **Step 11's job reads the pin from `robot.lock.json`**, not from numbers written again in the workflow: the
  release, the sha256 and Java's major version, each refused unless it is letters, digits and dots. The jar is
  kept only after the gate passed and only when none was brought back, so only a jar the script hashed to the pin
  is ever in the cache. The job runs one turbo task, `reason` of `@inventory/ontology`; `check:ci` is unchanged.
- **Step 11 was built by the orchestrator and read by Grok 4.7**, the other routes being out of quota. It read
  the job against decision 114, the script and turbo's configuration and reported no finding. It could not
  run the workflow, and neither has anyone: what GitHub does with it (the Java action, the cache's save and
  restore) is unseen until a push. One case stays as the script has it: a kept jar that later reads back
  damaged is refused by the hash on every run, and is cleared by deleting that cache entry by hand.

## Closing note

Written when the goal is done.
