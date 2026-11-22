---
type: Guide
title: Break a rule and watch Verify catch it
description: The review of an import is a model whose rules Verify proves from the code that decides. What is proved and what tests hold, three rules to break with a one-line edit, the command to run, and what it prints.
tags: [verify, model, review, effect]
---

# Break a rule and watch Verify catch it

The review of an import is written twice. The screens and the server run it on D1, as before. It is also a model of
`@alchemy.run/domain` that runs in memory (`packages/catalog/model`):

- `Import`, the import's lifecycle, which numbers every change;
- `Row`, one instance for each decided row;
- `Group`, one instance for each act on a group of rows, whatever the number of rows;
- four decisions, each recorded on the import and on one row or one group, or on neither: `Deciding` and `Undoing` for
  a row, `DecidingGroup` and `UndoingGroup` for a group.

Nothing a person sees uses the model yet, and nothing is stored through it.

## What is proved, and what tests hold

Three kinds of rule, and one thing no rule says. Each is named in `packages/catalog/model/test/rules.ts`.

| | Rules | How far each is known to hold |
| --- | --- | --- |
| The import's own (`Import`) | 37 | Proved for every state and every input, for each of its seven commands and for all four decisions |
| The row's own (`Row`) | 6 | Proved, for both decisions that record on a row |
| An act on a group's own (`Group`) | 9 | Proved, for both decisions that record on a group |
| An act on a row (`DecideRow`) | 26 | Proved |
| Its undo (`UndoRowStep`) | 21 | Proved |
| An act on a group (`DecideGroup`) | 21 | Proved |
| Its undo (`UndoGroup`) | 13 | Proved |
| Between an import and one row, or one group | 2 | Proved: every decision that records on both keeps it |
| Over every import, row and group at once | 7 | Searched: every sequence of up to three commands, and 200 longer walks. Never proved |
| That each command can be taken | 11 | Reached: one sequence of commands was found that gets there. Not a proof, and it says nothing of any other sequence |

**A proved rule says what never happens.** It is proved from the code of `decide` and `evolve`, for every state the
schemas and the invariants allow and every input, not sampled by a test.

**No rule says that a valid act is taken.** A `decide` that refused everything would keep all 135. That an act is
recorded, with the events it should record, is held by tests: the stories (`test/Review.story.test.ts` and
`test/Group.story.test.ts`, 45 of them, one at least for each of the eleven commands), and the property that drives
the model with the review region's own presses (`packages/catalog/web/test/ReviewModelFold.test.ts`). The eleven "can be taken" rules close part of the gap inside
Verify: a command no sequence reaches fails the search. They are a search three commands deep.

**Nothing evaluates a rule while the app runs.** What refuses a state is the code of `decide`. A proved rule means
that code cannot break it.

## Run them

```bash
bun run --cwd packages/catalog/model prove
```

Five files: the import over its own commands, and the four decisions. About half a minute together on a busy machine
(the longest, `Undoing`, about twenty seconds). `bun run check` runs them as the `prove` task.

```bash
bun run --cwd packages/catalog/model verify
```

The whole model: every proof again, then the search. About two minutes. `bun run check:full` runs it as the `verify`
task. Turbo replays both until something a result depends on changes: a rule file, a decision, the kernel files they
import, the pinned library, or the version of Effect or of the solver that `bun.lock` resolves.

One file alone:

```bash
bun run --cwd packages/catalog/model prove test/Import.prove.test.ts
```

In CI the two have a job of their own (`proofs` in `.github/workflows/ci.yml`), which restores turbo's results from
the last run on `main` and so proves nothing unless one of those changed, and they run again every night with
nothing replayed (`.github/workflows/proofs-nightly.yml`). `bun run check:ci` is `check:full` without the two, for
CI's main job.

## Three rules to break

Each is one line. Make the edit, run the command, read what it prints, and put the file back with
`git checkout packages/catalog/model/src`.

### 1. Nothing is confirmed that was not on screen

A confirm names the last change its sender's screen received, and is refused when the import has moved on
(`AConfirmNamesEveryChange`). In `packages/catalog/model/src/Import/Import.aggregate.ts`, in the `decide` of
`ConfirmImport`, delete this line:

```ts
if (cmd.seen !== s.changes) return yield* new ReviewMovedOn({ last: s.changes })
```

```bash
bun run --cwd packages/catalog/model prove test/Import.prove.test.ts
```

In about three seconds:

```text
 FAIL  |prove| test/Import.prove.test.ts > Import > each of its commands keeps every rule, for every state and every input
AssertionError: Import: 14 invariants, 23 transitions, 7 commands
✗ AConfirmNamesEveryChange
    ✓ proved for StageImport, MatchColumn, RecordSuggestion, TakeBackImport, ReopenImport, RemoveImport
    ✗ ConfirmImport: violated
        state         { status: "Open", organizationId: "", rows: 0, confirms: 0, matching: 0, columns: "", changes: 1, confirmedAt: 0, inForce: 0, replaced: 0, standing: 0, lastGroup: 0, topGroup: 0, suggestions: 0 }
        command       ConfirmImport { importId: "A", seen: 0, planAt: 1, shown: "", plan: "", created: 0, updated: 0, already: 0, notImported: 0 }
        CurrentActor  { organizationId: "", memberId: "", role: "editor" }
        now           1970-01-01T00:00:00.000Z
        events        ImportConfirmed { change: 2, created: 0, updated: 0, already: 0, notImported: 0, by: "" }
        after         { status: "Imported", organizationId: "", rows: 0, confirms: 1, matching: 0, columns: "", changes: 2, confirmedAt: 2, inForce: 0, replaced: 0, standing: 1, lastGroup: 0, topGroup: 0, created: 0, updated: 0, already: 0, notImported: 0 }

- Expected
+ Received

- []
+ [
+   "violated  AConfirmNamesEveryChange  ConfirmImport",
+ ]
```

The command says its screen received change 0 (`seen: 0`); the import's last change was 1 (`changes: 1`); the confirm
was taken anyway. The other six commands still keep the rule. The numbers the solver picks can differ from one build
of the library to the next: the rule, the command and the verdict do not.

### 2. The outcomes add up to the rows in the file

A confirm states four counts, created, updated, already there and not imported, and they add up to the rows
(`OutcomesAddUpToTheRows`). In the same `decide`, change `!==` to `>` in this line, as a slip would:

```ts
if (cmd.created + cmd.updated + cmd.already + cmd.notImported !== s.rows) {
```

```bash
bun run --cwd packages/catalog/model prove test/Import.prove.test.ts
```

```text
AssertionError: Import: 14 invariants, 23 transitions, 7 commands
✗ OutcomesAddUpToTheRows
    ✓ holds on the initial state
    ✓ proved for StageImport, MatchColumn, RecordSuggestion, TakeBackImport, ReopenImport, RemoveImport
    ✗ ConfirmImport: violated
        state         { status: "Open", organizationId: "", rows: 1, confirms: 0, matching: 0, columns: "", changes: 0, confirmedAt: 0, inForce: 0, replaced: 0, standing: 0, lastGroup: 0, topGroup: 0, suggestions: 0 }
        command       ConfirmImport { importId: "A", seen: 0, planAt: 0, shown: "", plan: "", created: 0, updated: 0, already: 0, notImported: 0 }
        CurrentActor  { organizationId: "", memberId: "", role: "editor" }
        now           1970-01-01T00:00:00.000Z
        events        ImportConfirmed { change: 1, created: 0, updated: 0, already: 0, notImported: 0, by: "" }
        after         { status: "Imported", organizationId: "", rows: 1, confirms: 1, matching: 0, columns: "", changes: 1, confirmedAt: 1, inForce: 0, replaced: 0, standing: 1, lastGroup: 0, topGroup: 0, created: 0, updated: 0, already: 0, notImported: 0 }

- Expected
+ Received

- []
+ [
+   "violated  OutcomesAddUpToTheRows  ConfirmImport",
+ ]
```

A file of one row, confirmed as nothing created, nothing updated, nothing already there and nothing left out: the
smallest import whose result would not add up.

### 3. An act on a group is taken only from a screen that has every change

An act on a group names the rows it fits, so it is taken only from a screen that has received every change of the
import (`AGroupIsMadeOnEveryChange`). This one is a decision across two instances, the import and the group. In
`packages/catalog/model/src/Review/DecidingGroup.decision.ts`, delete this line:

```ts
if (cmd.seen !== life.state.changes) return yield* new ReviewMovedOn({ last: life.state.changes })
```

```bash
bun run --cwd packages/catalog/model prove test/DecidingGroup.prove.test.ts
```

In about two seconds:

```text
AssertionError: DecideGroup: reads life (Import), group (Group); 67 rules, 40 paths
✗ AGroupIsMadeOnEveryChange: violated
    state         { life: { status: "Open", organizationId: "", rows: 0, confirms: 0, matching: 0, columns: "", changes: 0, confirmedAt: 0, inForce: 0, replaced: 0, standing: 0, lastGroup: 0, topGroup: 0, suggestions: 0 }, group: { status: "Untouched" } }
    command       DecideGroup { importId: "A", step: "B", opening: 0, seen: -1, madeOn: 0, patch: "", rows: "C", count: 1, label: "" }
    CurrentActor  { organizationId: "", memberId: "", role: "editor" }
    now           1970-01-01T00:00:00.000Z
    events        GroupDecided { importId: "A", organizationId: "", change: 1, by: "", step: "B", patch: "", rows: "C", count: 1, madeOn: 0, label: "", under: 0 }, GroupCounted { change: 1, step: "B", rows: 1, label: "", by: "", top: 1 }
    after         { life: { status: "Open", organizationId: "", rows: 0, confirms: 0, matching: 0, columns: "", changes: 1, confirmedAt: 0, inForce: 0, replaced: 0, standing: 0, lastGroup: 1, topGroup: 1, suggestions: 0 }, group: { status: "Decided", importId: "A", organizationId: "", change: 1, by: "", step: "B", patch: "", rows: "C", count: 1, madeOn: 0, label: "", undoneAt: 0, under: 0 } }

- Expected
+ Received

- []
+ [
+   "violated  AGroupIsMadeOnEveryChange",
+ ]
```

The screen had seen up to change -1, the import was at 0, and the group was recorded on both instances.

## Reading what it prints

- **`violated`** comes with the state before, the command, who was asking, the events recorded and the state after.
  The solver found them, and the real code was then run on them and broke the rule.
- **The state can be one no sequence of commands reaches** (`seen: -1`, an empty organization). A proof starts from
  any state the schema and the invariants allow, which is why "no count is negative" is written as rules of its own.
- **`not proved`** means the solver found inputs, and the real code kept the rule on them or refused them. It is not a
  pass: the test fails on it by name, as on `violated`. One case of it is built into this model. A row's instance is
  named `importId/row` and a group's `importId/step`, and the prover does not tie an instance's id to a name built
  from two fields. So a broken rule whose counterexample needs a row or a group that was already decided comes back
  as `not proved`, with the sentence "the real code rejects it with NotYourStep". Deleting the line of
  `UndoingGroup` that refuses to take back a group while a later one is in force does that for
  `OnlyTheLastGroupInForceIsTakenBack`. The rule still fails by name; what is missing is the counterexample.
- **`checked`** is a rule over every instance at once: it held in every sequence the search ran. **`reached`** is a
  rule that a command can be taken: one sequence got there, and the report prints it.

## The lock file

`packages/catalog/model/test/Catalog.lock.json` is written by Verify, not by hand. It keeps every rule's text. A rule
that is taken out or renamed, or whose text changed, fails `verify` by name; an aggregate's invariant is also compared
for what it says, and one made to allow more fails with the state that now passes. It does not keep how a rule
stands: that a rule is proved, and not only searched, is what the lists in `test/rules.ts` hold.

- Outside CI, a new rule is added to the file when `verify` runs: commit the file with the rule.
- In CI (`CI=true`) nothing is written, and a rule the file does not list fails.
- To change a rule on purpose, run `verify` once with `UPDATE_VERIFY_LOCK=1`, read what it says it relocked, and
  commit the file. Never set it to make a failing run pass, and never edit the file.

## Before changing the model

`CLAUDE.md`, "The model's blocks: what Verify reads", has the rules the code is written to: where `new` is allowed,
how a case is told and a state built so that the prover reads them, why a rule is one comparison, why the rules about
who may change a row or a group are stated on each decision, and the 4,096 paths past which nothing is proved. The
library itself is pinned to one commit and kept as files (`vendor/alchemy/`).
