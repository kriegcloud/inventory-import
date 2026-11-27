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

Three kinds of rule, and one thing no rule says. Which rules there are is kept by the lock file (below); the counts
in this table are the lock's, by whose rule it is, and a test reads this table and fails on a row that differs from
the lock (`test/Proving.test.ts`).

| | Rules | How far each is known to hold |
| --- | --- | --- |
| The import's own (`Import`) | 27 | Proved for every state and every input, for each of its seven commands and for all four decisions |
| The row's own (`Row`) | 6 | Proved, for both decisions that record on a row |
| An act on a group's own (`Group`) | 9 | Proved, for both decisions that record on a group |
| An act on a row (`DecideRow`) | 26 | Proved |
| Its undo (`UndoRowStep`) | 29 | Proved |
| An act on a group (`DecideGroup`) | 20 | Proved |
| Its undo (`UndoGroup`) | 15 | Proved |
| Between an import and one row, or one group | 2 | Proved: every decision that records on both keeps it |
| Over every import, row and group at once | 9 | Searched: every sequence of up to three commands, and 200 longer walks; every night 5,000 more on a new seed. Never proved |
| That each command can be taken | 11 | Reached: one sequence of commands was found that gets there. Not a proof, and it says nothing of any other sequence |

**A proved rule says what never happens.** It is proved from the code of `decide` and `evolve`, for every state the
schemas and the invariants allow and every input, not sampled by a test.

**No rule says that a valid act is taken.** A `decide` that refused everything would keep all 134. That an act is
recorded, with the events it should record, is held by tests: the stories (`test/Review.story.test.ts` and
`test/Group.story.test.ts`, 66 of them, one at least for each of the eleven commands), and the property that drives
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

`covered: false` is the sender's word too. The press that leaves the row's own instance as it is (the same text, made
on the same matching), with no group over it, is no change when its sender has seen what the row holds, or when no
group was made since the row's own decision:
then the row cannot read through a group the sender has not seen it under. From a screen that is behind after a group
(the row's later decision was undone, and the group covers the row again) the same press would put the row's own
decision over the group, so it is refused with what is there and held (Benjamin, 2026-11-22: "Hold it when behind";
the story "a press that matches what the row holds is held when its screen is behind a group").

What follows was settled by one rule and not asked (the decision log lists each, for Benjamin to overrule): a press
from a screen that is behind is never dropped without a word and never applied; it is held and shown.

One of them is a row's undo from under a later group: Dana's decision is under Ana's group in force, so Dana's undo
is refused naming that group (`GroupedAfter`), nothing is recorded, and once the group is taken back the same undo is
taken. Today's `act` differs there: it takes the step back at once and puts the row back to what it held before it,
so the group's effect goes from that row while its other rows keep it. The fold's test "a row's undo under a later
group is refused naming the group, and taken once the group is taken back" shows it.

- The same text made again on a newer matching is a change, and is recorded on the matching now. Whatever it decides,
  a press made on an older matching is refused.
- A row's decision is not taken back from under a later group in force that covers the row: `UndoRowStep` says
  `covered`, from a screen that has every group act, and is refused `GroupedAfter` as a group's undo under a later
  group is. Once the group is taken back, the undo is taken.
- A refusal says what happened: `DecidedSince` when someone decided the row since, `PutBackSince` when what the sender
  saw was taken back and an older decision is there again, `NoLongerThere` when nothing is.
- A covered press sent twice is written once: the row holds that very act (the sender's, under the same step, with the
  same text), and the second is answered with nothing new recorded.
- An undo sent twice is written once too. A row keeps the last undo it took (the change taken back, the step it was
  pressed in, who pressed), whatever is decided there afterwards, and the same undo sent again is answered with
  nothing new recorded, not `NotYourStep`: also when an act on a group, or a confirm and a reopening, landed between
  the two sendings, which the copy cannot have seen. Three rules of `Undoing` say the row keeps each as the act said
  it. The limit: a row keeps its last undo only, so a copy that arrives after another undo on the same row is
  refused `NotYourStep`, with nothing wrong stored. Keeping every undo is past what the prover reads: a text of them
  looked into with `includes` leaves every rule "not read", and a list in the state is proved for short lists only.
- A press drawn before an undo on the row is refused `UndoneSince`, naming who took the undo and of which change.
  After an undo the row holds exactly what it held before the decision taken back, so a late copy of the very press
  that was taken back, or a press from a screen that has the older decision and not the undo, names what the row
  holds. `DecideRow` therefore says the last undo its screen has of the row (`sawUndone`), and a press that does not
  have it records nothing.
- The same press sent again after a match landed is answered as the first time on a row no group covers too: the row
  holds that very act, and the copy is not told it was made on an older matching. So is the same press sent again
  after an act on a group, or a confirm and a reopening, landed between the two sendings, as an undo's copy is: it
  is known by the row holding it (this step, from this person, with this text on the matching it was made on).
- A row's undo is made on the matching now, as a row's act is: it puts another person's decision back on the row,
  and from a screen that has not received a match it is refused `MatchedSince` and held.
- `GroupedAfter` carries the import's last group in force, the one to take back first. For a row's undo that is the
  group over the row or one made after it: the model keeps no reading of a group's rows and cannot say which.
- A row's undo of a decision the row holds again, from a screen that has not received the undo that put it back, is
  refused `UndoneSince`, naming who took that undo and of which change. Dana keeps row 12, Ana leaves it out and
  takes that back: the row holds Dana's keep again, as her screen shows it, though her screen has neither of Ana's
  acts. `UndoRowStep` therefore says the last undo its screen has of the row (`sawUndone`), as `DecideRow` does; her
  undo is held, and taken once her screen has Ana's undo. A rule of `Undoing` and a story hold it. `UndoneSince` is
  the answer only there: the check comes after those of the opening, the last act on a group and the row's own
  decision, and before those of the matching and of a group over the row. If the row holds another decision
  by then (Ana left it out again), the undo is refused `NotYourStep`; after an act on a group it is refused
  `GroupedSince`, after a confirm and a reopening `ConfirmedSince`; and a copy of an undo the row already took is
  answered with nothing recorded.
- A group's undo that would otherwise be taken, from a screen that has not received every change of the import, is
  refused `ReviewMovedOn`, naming the import's last change, as a group's act is. Ana's group covers row 14, Dana types 8 on it, and Ana, whose screen
  has not received the 8, takes her group back: before, the undo was taken, and Ana learned only afterwards that
  row 14 stays as Dana decided it. Now `UndoGroup` says every change its screen has (`seen`); her undo is held, and
  taken once her screen has the 8. Taken, it still touches no row: a row decided since keeps that person's whole
  decision ("Row 14 stays whole"), and the screen names such rows from the rows it holds; the answer carries the
  group's undo and its number, not the rows. The check is of the whole import, not of the group's rows: the model
  keeps no reading of a group's rows, so a change on any row that the screen lacks holds the undo. A rule of
  `UndoingGroup` and a story hold it. `ReviewMovedOn` is the answer only there: the check is the last one before
  the undo is recorded. From such a screen the undo is refused `ConfirmedSince` after a confirm and a reopening,
  `NotYourStep` when the group is not its sender's or was taken back already (a second sending of the same undo
  too), `DecidedBeforeTheConfirm` when a standing confirm was made after the group, and `GroupedAfter` under a later
  group in force, each before what the screen has is asked.

With these, no press from a screen that is behind on what its command names is taken.

**Nothing evaluates a rule while the app runs.** What refuses a state is the code of `decide`. A proved rule means
that code cannot break it.

## Run them

```bash
bun run --cwd packages/catalog/model prove
```

Seven files: the import over its own commands, the group under the two decisions that record on it, the row's
starting state, and the four decisions. About half a minute together on a busy machine (the longest, `Undoing`, about
twenty seconds; the group's and the row's a second or less). `bun run check` runs them as the `prove` task. The row is
not proved under its two decisions in its own file, as the group is: that report takes about three minutes and proves
no rule the decisions' own files do not.

```bash
bun run --cwd packages/catalog/model verify
```

The whole model: every proof again, then the search. About two minutes. `bun run check:full` runs it as the `verify`
task. Turbo replays both until something a result depends on changes: a rule file, a decision, the kernel files they
import, the pinned library, a patch to it (`packages/patches`), or the version of Effect or of the solver that
`bun.lock` resolves.

One file alone:

```bash
bun run --cwd packages/catalog/model prove test/Import.prove.test.ts
```

Two more tasks hold the model, both in `bun run check:full`:

- `bun run --cwd packages/catalog/web fold`: the property that the model, fed the review region's presses, holds
  what the region decides (`test/ReviewModelFold.fold.test.ts`), two minutes. Each of its 25 runs presses 60 to 90
  numbers on the messy sample, for one person or two. Three presses in ten send every row `act` wrote, the rest only
  the rows a press changed. With two people, two numbers in five that press on one row press on a row the other
  person's last press wrote, so presses meet on the same rows; and four in ten are first sent from a screen that has
  not received the other person's last act, or any of their acts since its own: the model refuses them
  (`GroupedSince`, `DecidedSince`, `PutBackSince`, `NoLongerThere`, `UndoneSince`, `ReviewMovedOn`, `NotYourStep`) or
  answers "no change", nothing is recorded, and the screen catches up and sends them again. Such a press says what
  that screen saw, and for a row's act whether a group covers the row and whether the press leaves it reading as it
  reads, from what that screen holds. A row's undo is sent from one behind a group act, or behind another
  person's decision made over the sender's on that row. Behind an undo on the row the seed sends none; a test of its
  own in that file sends it, and the undo is refused `UndoneSince` and taken once the screen has the undo. A
  group's undo from such a screen is refused `ReviewMovedOn`, and taken once the screen has every change. Its
  tallies say how often the seed reached each case, a covered row's "no change" (`asItReads`) and a group taken
  back behind a later row act on its rows included.
- `bun run --cwd packages/catalog/model mutants:sample`: a few of the model's mutants. A mutant is one change to a
  `decide` (a check removed, an event's field given a wrong value, an act made to record nothing), which a proof or a
  story must notice; `packages/catalog/model/mutants/README.md` has them all, what each class means and what they
  cost. All of them run every night: all but the slowest in one job, and that one (`row-open`) alone in a job of its
  own, where its proof is given 100 minutes.
- `bun run --cwd packages/usage/model mutants:sample`: six of the usage model's 39 mutants (the allowance's `decide`
  and `evolve`, the view `AllowanceToday`'s fold and `validate`, `leftOn` and `dayOf`), by the same runner;
  `packages/usage/model/mutants/README.md` has them all. `mutants` there runs every one, in seconds, and the nightly
  runs them in a job of their own (`usage-mutants`). `turbo run mutants:sample` with no filter, as CI's `model` job and
  `bun run proofs` call it, runs both packages' samples.

In CI these four have a job of their own (`proofs` in `.github/workflows/ci.yml`, which runs the tasks of
`bun run proofs` through turbo itself), which restores turbo's results from the last run on `main` and so runs
nothing unless one of those changed. They run again every night with nothing replayed and every mutant
(`.github/workflows/proofs-nightly.yml`, which also calls turbo itself), and a fifth task with them: `explore`
(`test/Catalog.explore.test.ts`, `bun run --cwd packages/catalog/model explore`), which searches the rules over every
import, row and group at once again at three commands deep and then on 5,000 walks, from a seed taken from the day
and printed, so a failing night is run again with `EXPLORE_SEED=<that number>`. A rule a walk breaks fails it with the
sequence as a story's steps, to paste into a story file as the regression (its `new X(...)` written `X.make(...)`).
It is still a search: more short orderings each night, never a proof, and no deeper than three commands for an act a
random input rarely gets accepted (a walk here is five commands on average). It took 364 s on the workstation, and is
never replayed. `bun run proofs:nightly` is the same five
tasks by hand, with `--force`, so it replays nothing either, with two differences. By hand turbo starts the five
tasks at once on the one machine, so the first mutants share it with the proofs, Verify's search, the fold and the
walks; the nightly runs the first three in one job, and the walks and the mutants on runners of their own. And by hand every mutant runs in the
one task, two at a time, and `row-open` keeps the proof's own 50 minutes beside another mutant, where the nightly
runs it alone with 100. It took 1,544 s on the workstation; on a slower machine run it as the nightly does
(`packages/catalog/model/mutants/README.md`). `bun run check:ci` is `check:full` without them and
without the slow tests, for CI's check. In `ci.yml` the four run as three jobs that start at once (the proofs, the
search, and the fold beside the sample), and the job named "Proofs and search of the model" waits for them. The
rule on `main` names that job and the check's as required (`packages/infra/src/GitHub.stack.ts`); it holds once
the repository's stack is deployed again (`goals/infra/PLAN.md`, step 14), and until then a red proofs job stops no
merge.

## Three rules to break

Each is one line. Make the edit, run the command, read what it prints, and put the file back with
`git checkout packages/catalog/model/src`.

### 1. Nothing is confirmed that was not on screen

A confirm names the last change its sender's screen received, and is refused when the import has moved on
(`AConfirmNamesEveryChange`). In `packages/catalog/model/src/Import/commands/ConfirmImport.command.ts`, in its
`decide`, delete this line:

```ts
if (cmd.seen !== s.changes) return yield* ReviewMovedOn.make({ last: s.changes })
```

```bash
bun run --cwd packages/catalog/model prove test/Import.prove.test.ts
```

In about three seconds:

```text
 FAIL  |prove| test/Import.prove.test.ts > Import > each of its commands keeps every rule, for every state and every input
AssertionError: Import: 4 invariants, 23 transitions, 7 commands
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
AssertionError: Import: 4 invariants, 23 transitions, 7 commands
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
if (cmd.seen !== life.state.changes) return yield* ReviewMovedOn.make({ last: life.state.changes })
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
  any state the schema and the invariants allow, which is why "no count is negative" is said by the state's schema
  (`S.Natural`): the solver starts only from states the schema allows, and "The state stays in its schema" proves
  that each command leaves one ("A check on a field of the state", below).
- **`not proved`** means the solver found inputs, and the real code kept the rule on them or refused them. It is not a
  pass: the test fails on it by name, as on `violated`.
- **A row or a group that was already decided has its counterexample because of a patch.** A row's instance is
  named `importId/row` and a group's `importId/step`. The library as published replays the solver's answer under
  an empty id for a name built from two fields, so a broken rule whose counterexample needs such an instance came
  back as `not proved`, with nothing to look at. The repository patches that
  (`packages/patches/alchemy-domain/01-computed-instance-id.patch`, [Patching a dependency](patches.md)). With the
  patch, deleting the line of `UndoingGroup` that refuses to take back a group while a later one is in force gives
  `OnlyTheLastGroupInForceIsTakenBack: violated`, with the state and the command.
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
the names the lock keeps of the kinds a proof covers, 134 of them (the Verify test states the number, so it cannot drift from this page unseen). The same deletion then fails by name:

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
the rules about who may change it. They are asked by the event recorded, so that a rule is asked only where it can
fail: an act on a row or a group states that only its own organization changes it and that a viewer changes none,
and an undo states those two and that nobody takes back another person's ("nobody clears another person's decision"
could not fail in a decision that always leaves one there, and is not stated in it). A row and a group have no
command and so no middleware: without those rules nothing says whose act the decision records, and the lock and
`require` would take a decision without them as it is written. Whoever adds one writes them, as `CLAUDE.md` says,
and calls `missingRules` in its proof with the decision itself, as the four do: the check runs only where a proof
calls it. Which events it asks about is read from the decision's command and from the aggregates it reads (an event
recorded on an aggregate that has no command), and an event of that kind with no rules listed for it is reported
too, so nothing is typed where the check is called. It stays, named as ours (Benjamin, 2026-11-22: "Keep
it, named as ours"): "no hand-written assertions" means no hand-written list of rule names or of how each stands.

- Outside CI, a new rule is added to the file when `verify` runs: commit the file with the rule.
- In CI (`CI=true`) nothing is written, and a rule the file does not list fails.
- To change a rule on purpose, run `verify` once with `UPDATE_VERIFY_LOCK=1`, read what it says it relocked, and
  commit the file. Never set it to make a failing run pass, and never edit the file.

## Before changing the model

`docs/building.md`, "The model's blocks: what Verify reads", has the rules the code is written to: that a block is built with `.make`,
how a case is told and a state built so that the prover reads them, why a rule is one comparison, why the rules about
who may change a row or a group are stated on each decision, and the 4,096 paths past which nothing is proved. The
library itself is pinned to one commit and kept as files (`vendor/alchemy/`), with the repository's patches to it
applied at every install (`packages/patches`, [Patching a dependency](patches.md)).

### A check on a field of the state

What a state's schema says of a field is proved or not by the kind of check, seen on a small aggregate on 2026-11-23:

- **A length or a bound** (`isMinLength`, `isMaxLength`, `isBetween`, `isGreaterThanOrEqualTo`, `isInt`,
  `isMultipleOf`) is read. It is assumed of the state a command starts from and **proved** of the state the command
  leaves: the prover's own rule "The state stays in its schema" comes back violated, with the command that does it,
  when a `decide` can write a value the check refuses. So such a check on the state is a rule like any other, not an
  assumption. The import's counts (`rows`, `inForce`, `created` and the rest: `S.Natural`) and a group's count (at
  least one) are held this way and have no invariant of their own: a rule that only restates a bound of the schema is
  the same proof under a second name.
- **A pattern** (`isPattern`) and a filter written by hand are not read, with or without the repository's patches.
  On a field of the state it proves nothing ("the prover does not read that check, so it is not proved kept"), and it
  costs the other rules too: the solver may start from a state the pattern refuses, and every rule of that command
  then comes back "not proved: the solver's state is not one the state's schema allows". A pattern stays off the
  model's state and off what its commands take until the prover reads regular expressions.
