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

Three kinds of rule, and one thing no rule says. Which rules there are is kept by the lock file (below).

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
`test/Group.story.test.ts`, 50 of them, one at least for each of the eleven commands), and the property that drives
the model with the review region's own presses (`packages/catalog/web/test/ReviewModelFold.fold.test.ts`). The eleven
"can be taken" rules close part of the gap inside Verify: a command no sequence reaches fails the search. They are a
search three commands deep.

**A press over a group, and the group's undo.** A press on a row a group in force covers either changes how the row
reads or it does not. When it does not, it is no change: nothing is recorded, and when the group is taken back the
row gives up the group's effect with the rest (Benjamin, 2026-11-22: "No change, Ana's undo applies"; the story
"a press that leaves a row reading as it reads is no change"). When it does, the row keeps that person's whole
decision, the group's effect included, after the group is taken back, and the screen names it ("Row 14 stays
whole"). There the model and the review region's `act` of today differ on purpose: `act` puts back what the row held
before the group and loses the later decision. The model is what was chosen; `act` changes at the move that puts the
review on the model. The fold's property compares the two only where one shared history has an answer, and its test
"row 14 stays whole" shows that case on its own.

Which of the two a press is, the model cannot tell: it keeps no reading of a row through its groups. The sender says
it, in `DecideRow`'s `covered` (a group in force covers the row since its own decision) and `asItReads` (the press
leaves the row reading as it reads). Both are the sender's word, as `saw` is not: the screen must work them out from
what it has received, as the fold's property does.

Because they are the sender's word, the covered "no change" is answered only after the checks of what the sender saw
and of the matching pass. A screen that is behind reads the row through a group as it read before another person's
act, and its press would otherwise be lost as "no change" over a decision it never saw; refused instead, it is held
and shown beside that decision (2026-11-22: "Same: hold, show both"; the story "a press from a screen that is behind
is held, not lost as no change"; the matching half has its own, "a covered press made on an older matching is held
too").

`covered: false` is the sender's word too. The press that leaves the row's own instance as it is, with no group over
it, is no change when its sender has seen what the row holds, or when no group was made since the row's own decision:
then the row cannot read through a group the sender has not seen it under. From a screen that is behind after a group
(the row's later decision was undone, and the group covers the row again) the same press would put the row's own
decision over the group, so it is refused with what is there and held (Benjamin, 2026-11-22: "Hold it when behind";
the story "a press that matches what the row holds is held when its screen is behind a group").

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

Two more tasks hold the model, both in `bun run check:full`:

- `bun run --cwd packages/catalog/web fold`: the property that the model, fed the review region's presses, holds
  what the region decides (`test/ReviewModelFold.fold.test.ts`), a minute and a half.
- `bun run --cwd packages/catalog/model mutants:sample`: a few of the model's mutants. A mutant is one change to a
  `decide` (a check removed, an event's field given a wrong value, an act made to record nothing), which a proof or a
  story must notice; `packages/catalog/model/mutants/README.md` has them all, what each class means and what they
  cost. All of them run every night (`mutants`).

In CI these four have a job of their own (`proofs` in `.github/workflows/ci.yml`, `bun run proofs`), which restores
turbo's results from the last run on `main` and so runs nothing unless one of those changed, and they run again every
night with nothing replayed and every mutant (`bun run proofs:nightly`, `.github/workflows/proofs-nightly.yml`).
`bun run check:ci` is `check:full` without them, for CI's main job.

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
that is taken out or renamed fails `verify` by name, and so does one whose text changed, with one exception: an
aggregate's invariant is compared for what it says, so one made to allow more fails with the state that now passes,
and one that still says at least as much is locked again as written. It does not keep how a rule
stands. Shown on this model: with the line of `UndoingGroup` that refuses an undo while a later group is in force
deleted, `OnlyTheLastGroupInForceIsTakenBack` is only `checked`, nothing is left undone, the report is verified,
and the lock, whose text of the rule has not changed, is silent. So the test also gives Verify the library's list of
rules that must stay proved (`require: { proved }`, Benjamin, 2026-11-22: "Lock plus the library's proved list"):
the names the lock keeps of the kinds a proof covers, 135 of them. The same deletion then fails by name:

```text
Not done
  ✗ UndoGroup.OnlyTheLastGroupInForceIsTakenBack is required to be proved, and is only checked
```

and a rule taken out fails twice, once for each:

```text
  ✗ DecideRow.AViewerChangesNoRow is required to be proved, and the model has no rule of that name
  ✗ DecideRow.AViewerChangesNoRow is locked in Catalog.lock.json, and is no longer a rule of Catalog
```

Neither runs in a proof file: `Prove.report` and `Prove.decisionReport` take no lock and no `require`. So each proof
test has a check of ours, that every rule its report names is proved. And each decision's proof has a second one the
library has no counterpart for (`missingRules`, `test/proving.ts`): a decision that records on a row or a group states
the three rules about who may change it. A row and a group have no command and so no middleware: without those rules
nothing says whose act the decision records, and the lock and `require` would take a decision without them as it is
written. Whoever adds one writes the three, as `CLAUDE.md` says, and calls `missingRules` in its
proof as the four do: the check runs only where a proof calls it. It stays, named as ours (Benjamin, 2026-11-22: "Keep
it, named as ours"): "no hand-written assertions" means no hand-written list of rule names or of how each stands.

- Outside CI, a new rule is added to the file when `verify` runs: commit the file with the rule.
- In CI (`CI=true`) nothing is written, and a rule the file does not list fails.
- To change a rule on purpose, run `verify` once with `UPDATE_VERIFY_LOCK=1`, read what it says it relocked, and
  commit the file. Never set it to make a failing run pass, and never edit the file.

## Before changing the model

`CLAUDE.md`, "The model's blocks: what Verify reads", has the rules the code is written to: where `new` is allowed,
how a case is told and a state built so that the prover reads them, why a rule is one comparison, why the rules about
who may change a row or a group are stated on each decision, and the 4,096 paths past which nothing is proved. The
library itself is pinned to one commit and kept as files (`vendor/alchemy/`).
