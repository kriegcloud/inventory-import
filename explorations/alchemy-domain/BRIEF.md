---
type: Brief
title: "Brief: the app on @alchemy.run/domain"
description: How inventory-import uses all of @alchemy.run/domain and the extras Benjamin asked for. The saving of review decisions is modelled first, in the shape he chose, an import, its rows and its groups as three aggregates with four decisions and eleven commands over the app's fifteen fields, and on the library's dbfd0dd Verify proves its 135 rules and checks seven more across instances, the proofs covering what must never happen and 43 stories that each valid act is taken; then one table of every concept with its worked instance, its move and a check that fails without it; then the decisions that are his, one decision each, most consequential first, with what one large import costs under his answers. The review's model is built in the repository, on the library pinned at 734c27a, on a branch of its own that goes into main beside this brief (by its own report 135 rules proved, 7 searched, 11 reached and 45 stories); nothing else of the build is done until he signs.
---

# Brief: the app on `@alchemy.run/domain`

Benjamin, on 2026-11-19: "Not borrow use.", and "if possible find a way to make use of ever single thing". Of the
pull request that adds `Verify`: "I'm particularly excited about this". That reverses the 2026-11-18 decision "core";
his words are in [CAPTURE.md](CAPTURE.md). Seven rounds of trials stand behind this brief, with their sources and
reports on [the trial page](research/07-review-decisions-trial.md).

Three rules shape every recommendation here:

- **A recommended option does not give up what Verify proves.** Where a shape exists under which a rule is proved,
  that shape is recommended and what it costs is stated as a cost. Where none exists, the question says so, with the
  exact limit in the way.
- **A recommended option never drops something he asked for or answered.** No option leaves out the library or an
  extra he asked for without saying what is in the way and what removes it.
- **An option that goes against a dated answer of his says so**, with the answer and its date.

Two parts of the build exist. Decision 1's pin is on main (commit `ea95cd0`: the library's `main@734c27a`, its 17
packages kept as files). The review's model of move 1 is built on that pin on the branch
`claude/alchemy-review-model-f206c6`, which goes into main beside this brief; the per-row model, kept as the fallback,
is on the branch `claude/alchemy-review-model-parked`. **The build starts after Benjamin says the brief matches, and
after the atoms goal is merged into main.** That goal's work is in main now ([its plan](../../goals/atoms/PLAN.md)), and
"today" in this brief is the code on main.

## Problem

Nothing the app runs imports `@alchemy.run/domain`: on main only the pinned build and a template of the repository's own
command line name it, and the review's model on its branch. Each rule that matters is held by a guarded D1 batch behind
a port, and checked by tests that sample it.

- **A save can still overwrite a decision its sender never saw.** Today a save names, for each row, the draft revision
  it was decided on (`madeOn`), and for a row that waited the decisions it may be written over (`over`); it answers
  whether it changed anything, which parts it did not apply, and which rows that waited were decided otherwise since
  and not written (`decidedSince`); a confirm names the revision the screen shows, carries the person's unsent rows,
  and is refused with `DraftMoved` or `AcceptsTakenBack`. What is still open there: a row not named in `over` is a live
  press and is not checked, so the last save wins over a newer decision by someone else, and any caller of the contract
  can send a stale clear by leaving `over` out (`packages/catalog/contract/src/Import/Decision.command.ts`,
  `packages/catalog/model/src/Import/Waited.rules.ts`, `Imports.handler.ts` and `ImportStore.adapter.ts`; the screen
  avoids the orderings it knows).
- **The rules are sampled, never proved.** "An organization always keeps an admin", "a decision is replaced only by
  someone who saw it", "nothing is confirmed that was not on screen" each rest on code and the cases its test thought
  of. Under the model the review's rules, the item's, the allowance's and the organization's become rules Verify
  proves of the code that decides; what stays held by SQL or by a test is named rule by rule below.
- **The library he set out to explore is not in the app**, so the app teaches nothing about it before beep-effect is
  ported to it.

## Appetite

**Size.** Four goals, eleven moves (0 to 10), each move a working app; the first goal is moves 0 to 2. No time is set
for the whole; each goal states its own when it is opened.

**In.** Every write that decides something becomes a command or a decision of a model whose rules Verify reads: the
review's acts, match, confirm, take-back, reopen, remove, the items, the allowance, membership. Every concept of the
library and every extra he named, with one worked instance, a move, and a check that fails when it is missing
("Every single thing"). **Writes that stay D1 writes:** the upload's pieces, the confirm's plan, the projections'
batches (which are written from events), `importSuggestion` until move 8, and Better Auth's own tables for accounts
and sessions.

**Out.** A change to any rule of an import, to what a count means, or to a sentence the person reads, unless a
decision below names it and he chooses it. R2 presigned uploads. A second review function. Anything a model writes
without the person's confirm.

**Done when** every row of "Every single thing" passes its check, the proofs under "Proof" pass, and
`bun run check:full` passes. A row that cannot be used yet is done when its blocker is written down with what removes
it and he has accepted it by answering its question.

## What the trials established

Every trial on the trial page ran on the library's `main@dbfd0dd`, from its preview builds, beside Effect 4.1.4, outside
the repository; none ran on `734c27a`, and nothing was deployed. Those builds are deleted by the library's registry a
week after `main` moves past the commit (decision 1); the builds the trials installed were kept outside the repository
and are not part of it, so once they are deleted no reader can install them from the registry and run the trials again.
The repository pins `main@734c27a` (his answer of 2026-11-22). On that pin, with Effect 4.1.5, the model he chose is
built on the branch `claude/alchemy-review-model-f206c6`, which goes into main beside this brief: by its own report 135
rules proved, 7 searched, 11 "can be taken" rules reached and 45 stories. The per-row fallback is on
`claude/alchemy-review-model-parked`: 96 rules proved and 3 searched, on the same pin.

- **The model he chose is proved: 135 rules** (`review14`, the trial page's sixth round). Three aggregates (an import, a
  row, a group), four decisions (a row's act and its undo, a group's act and its undo) and eleven commands, with the
  app's fifteen fields. `Verify.model` proves every rule of the three aggregates, of the four decisions and of the two
  relations, and checks seven rules across every import, row and group over every sequence of up to 3 commands. Each
  decision is proved alone: a row's act with 152 paths, a row's undo 298, a group's act 42, a group's undo 84. A group
  act is one change, recorded on the import and the group or on neither, whatever its size; only the last group still in
  force is taken back, so undo walks back; a row's act and a row's undo each name the import's last group act. The model
  he did not choose, trial 13's one act per row sent by a saga with the import counting its rows (`review11`, 93 rules
  proved and 1 relation checked, on `dbfd0dd`), stays on the branch `claude/alchemy-review-model-parked` as the fallback
  (his answer "Chosen design, parked one as fallback"). There, on `734c27a`, it gives 96 rules proved and 3 searched:
  the same rules, with its three on who may change a row stated on each of its two decisions instead of on the row
  (three fewer on the row, six more on the decisions), and the relation and the two rules across every import and row
  as its 3 searched.
- **Earlier models were proved too, and let through what Benjamin ruled out.** In the third round's, a screen that had
  received one row of an ended group could confirm all of it, and an undo could carry a text of its sender's as another
  person's. On the fourth round's first, 36 stories of such orderings passed (a take-back hit someone else's later
  confirm, a column match was replaced unseen); on its second, 33 (a confirm fell between two rows of a group's undo, a
  match made before a confirm was taken after a reopen); those two counts are of runs whose output was not kept, and the
  kept runs show 12 stories on the first and 21 on the second. Trial 13's model refused each that a model can hold, and
  `review14`'s 43 stories (35 on the review, 8 on groups) are written for the same orderings; what a model cannot hold
  is listed under the table, or asked. A proved rule is a promise about what it says, and about nothing beside it.
  `review14` has had no such attempt of its own. Its 148 mutants (each check removed, each event's field given a wrong
  value, each kind of act recording nothing) were run against its rules and its stories: 111 leave a rule of their
  decision or aggregate not proved, 32 of them only as "unconfirmed" (the solver found a counterexample it did not
  replay), and one of those (`undo-own`) on a state the prover could not read; the other 37 fail a story; none passes
  both.
- **What un-proves a decision, exactly**: past 4,096 paths nothing of it is proved. The prover tries each member of a
  union in a state or a command as its own path, and takes both sides of every `&&`, `||` and `?:` it cannot settle, in
  the code and in every rule of every aggregate the decision reads. Unions for "none yet" and fifteen accepts compared
  one by one passed the limit (nothing proved, 716 s). The fourth round's models passed it twice more: with rules
  written as chains of `&&`, and when the undo of a group was added (4,097 paths, nothing proved). With one comparison a
  rule, a group counted by a number instead of cleared by a branch, and no rule weaker, trial 13's `Deciding` had 332
  paths and `Undoing` 2,652; `review14`'s four decisions have 152, 298, 42 and 84. The prover also cannot write a text's
  length into a text, nor read a loop, so it reads no hash.
- **The group as one unit, before the last-group rule** (trials 15 to 17, for decision 7, on `review12`): 123 rules
  proved, the four decisions with 42 to 292 paths; one act for 6,000 rows a median of 214 ms in local workerd, each time
  the first group act on a fresh import; and the reading of a row's decision through its groups equals today's `act` for
  one person over 50,000 generated sequences, when a group's rows are split by what each got. The same reading was then
  run for one person and for two against main's `act`, with `review14`'s walk-back undo (under "The reading of a row
  through its groups").
- **No rule holds that an act is taken.** A `decide` that records nothing for every act proved every rule of trial 13's
  model (run in trial 15): the prover checks a decision's rules on what an act records. On `review14` each of the four
  such mutants ends `NotProved`, as never accepted: that holds only that some act can be recorded, not that each valid
  one is. The same four fail 5, 5, 4 and 2 of the 43 stories. The stories hold that acts are taken. His answer of
  2026-11-22: tests hold it, said plainly. The proofs cover what must never happen; the stories cover that each valid
  act is taken; the documents and any page that shows the proofs say exactly that split.
- **The row-by-row model on the domain's Durable Object host, in local workerd** (trial 14, `review11`): 600 acts one
  after another, each the first act on a row of its own, in two runs: 131 and 151 ms an act on the mean, 79 to 98 ms in
  the middle, the slowest 12.4 s, at load averages of 27 to 46. A later act on a row was not timed. Counting the
  Worker's call to the import object, 4 requests an act (3 of them between objects), 5 on a row's first (its entry in
  the domain's directory), 4 for one that changes nothing, 3 for a refused one; 1 for a match, a skipped row, a confirm
  or a take-back, the Worker's call to the one object they touch. Of three pairs raced on one row one was taken and one
  refused each time; of three on two rows both were taken. A deployed object was not tried.
- **The group as one unit on the same host** (trial 17, `review12`): one group act a median of 189, 137, 214 and 95 ms
  at 9, 600, 6,000 and 50,000 rows, and its undo 110, 86, 191 and 64 ms, 20 runs a size, each an import's first group
  act; 5 or 6 requests to objects a group act (1 from the Worker, 3 between objects, and 1 or 2 for the group's entry in
  the domain's directory, since every group act is its group's first) and 4 for its undo; a row's act right after a
  group, each the first on its row, a mean of 250 ms and a median of 127 ms; load averages of 36 to 60. It ran before
  the last-group rule, the walk-back and the undo's `sawGroup` were added, and was not run again. `review14` was not
  hosted.
- **One value in a Durable Object may be about 8 MiB** through the domain host in local workerd (8.3 MB stored, 8.5 MB
  refused with `SQLITE_TOOBIG`). The 2 MiB in the library is a guard of its cluster package.
- **An item held as text proves its ten rules**, replace and restore in turn included (3.6 s). With its tags and vendors
  as lists, all eleven are only checked (788 s).
- **The allowance by the UTC day proves its seven rules** with no reset command and no cron, the day held as a day
  number. Today's rolling 24 hours, held as a list of times, is only checked.
- **Members as their own instances prove 19 rules** (trial 10: four decisions, `FoundOrganization` among them, a person
  added by member id, no email claim), an admin changed only by an admin in the record among them; that the counts equal
  the members is checked.
- **One instance per import proves nothing**, by the prover's design (a list is tried with at most 2 items more than its
  schema asks for); its state passes 8 MiB at about 42,800 decided rows (the length of its JSON, for one mix of
  decisions).
- **What the prover reads**: handlers written `Effect.fn("name")(…)` (whose parameters are typed `any` unless `keyOf`'s
  parameter is annotated); an id or a value schema from another package; not a request context imported from another
  package; `new Event(…)`, not `Event.make(…)`.

## Sketch

### The review, in the shape Verify proves

Three aggregates, four decisions and eleven commands: the import's seven (`StageImport`, `MatchColumn`,
`RecordSuggestion`, `ConfirmImport`, `TakeBackImport`, `ReopenImport`, `RemoveImport`) and one for each decision
(`DecideRow`, `UndoRowStep`, `DecideGroup`, `UndoGroup`).

| Block | What it holds | What it decides |
| --- | --- | --- |
| `Import`, one instance per import | Its status (open, imported, taken back, removed) and organization; the number of its last change and of the last confirm that stands; how many times it was confirmed; its count of column matches and every field's column as one text; its rows in number, the items in force, the items it replaced and the confirms standing; the number of its last group act, an undo included (`lastGroup`), and of the last group still in force (`topGroup`). No rows and no groups | Stage, match a column, record a suggestion, confirm, take back, open again, remove |
| `Row`, one instance per decided row | The row's own decision as text, the change that recorded it, who made it, in which step, the matching it was made on, its label; the decision under it in full; everything below that sealed into one text | Nothing alone |
| `Group`, one instance per group act | Its rows and what it does to them, as two texts; how many rows; who made it, in which step, on which matching, with which label; the change that recorded it; the change that took it back, 0 while it is in force; the last group in force when it was decided (`under`) | Nothing alone |
| `Deciding`, `Undoing`: decisions across one import and one row | Nothing | A row's act and a row's undo, read from both instances and recorded on both or on neither |
| `DecidingGroup`, `UndoingGroup`: decisions across one import and one group | Nothing | A group's act and its undo, the same way, whatever the number of rows |

The names are proposed for the build and open until the first deploy he keeps (his answer of 2026-11-22). In the trials
(`review14`, the trial page's sixth round) `Import` is `ImportLife`, `Row` is `RowUnit`, `Group` is `GroupUnit`, the
model `Catalog` is `Review` (its seven rules across instances on `ReviewInvariants`) and `CatalogApi` is `ReviewApi`;
the rest of this brief gives every rule under the build's name.

**The import numbers every change**, one higher each time, so no check rests on an id a sender makes. A step is only the
label of one press; a group act is one change under its step, and a step decides at most one group (`StepTaken`). The
rules that read who is acting are stated on the decisions, not on the row and the group, because the library types an
aggregate's rule with the context its own commands provide and those two have none. So every decision that records on a
row or a group, the adopting decision of move 3 (decision 37) included, states that aggregate's three rules on who may
change it itself, and its proof asserts them by name: without them nothing checks who that decision acts as. On the
build's branch `Catalog.verify.test.ts` fails, naming the decision, when one does not. `review14` has no error under a
strict type-check, with no cast. Under the repository's profile as it was then (effect-tsgo 0.70.0, Effect 4.1.4; not
run again under main's 0.73.2 and Effect 4.1.5) it had 133 Effect diagnostics and no type error: 73 `newSchemaClass`
(decision 33's answer keeps `new` in the files that hold a `decide`), 32 `effectFnOpportunity`, 26 `preferEffectArray`,
1 `missingPipeableSignature` and 1 `schemaClassMissingBrand`. Its functions are written `(p) => Effect.gen(...)`,
because written `Effect.fn(function* (p) ...)` their parameters were typed `any`. The build's branch writes the import
and the four decisions with `Effect.fn`, and its counts above are of that form on `734c27a`.

- **A row's act names the decision it saw on its row**, by the change that recorded it, the matching it was made on,
  whatever it decides, how many times the import had been confirmed (its opening), and the import's last group act as
  its screen has it (`sawGroup`). Otherwise `DecidedSince { by, change }`, `NoLongerThere`, `MatchedSince`,
  `ConfirmedSince` or `GroupedSince`. `GroupedSince` hands back no number: the screen learns the last group act only by
  receiving it. The act also says whether a group in force on the row was decided after the row's own decision
  (`covered`): the row then reads otherwise than its own instance holds, and the same text is a change. The queue sends
  one act at a time and fills in a person's own earlier act from its receipt.
- **An act that would leave the row as it is records nothing**; its receipt has no events, and the answer says "no
  change": his answer of 2026-11-19. That holds only when the sender says the row is not covered by a group. No rule
  checks `covered`: with it set, an act that repeats what the row holds is recorded as the sender's. A press over a
  group that leaves the row reading as it reads now changes nothing and is recorded as nobody's (his answer of
  2026-11-22, "No change, Ana's undo applies"): the act carries what its sender says of the reading (`asItReads`), as it
  carries `covered`, and with it set records nothing. The trial model `review15` makes that change; `review14` does not
  have it. No rule checks what the sender says. The repository's model has the same exit to change: on the build's
  branch `Deciding.decision.ts` answers "no change" only when the row is not covered.
- **A match says every field's column after it**, the headings' own choices and "none, on purpose" included, because
  giving a column to one field can move what another reads. It names the last match its sender saw, and is refused on
  another. The same columns again, by heading or by hand, record nothing and take nothing back. The import's events hold
  the columns at every match, so a reader can say, for any part of a decision, whether a field it rests on has moved
  since it was made (an accept, an undone fix, a keep of one of two, an answer about the stored item), and whether that
  changes the row. A part carried into a later act keeps its own number. A match names the last match, not the last
  change, so it is taken over a group act its screen has not received; what a match does to a group in force is not run.
- **A confirm names the last change its screen received with none before it missing (`seen`), the change its plan was
  built at (`planAt`), and what its button said (`shown`)**, as one digest of what every row becomes. It is taken only
  when both numbers are the import's last and the plan does what was shown. Otherwise `ReviewMovedOn`, `PlanBehind` or
  `NotWhatWasShown`. A group act is a numbered change like any other, so a confirm whose screen has not received one is
  refused, and Confirm never waits for a group. The digest covers what each row becomes, the stored item and revision it
  replaces, and what "already there" was compared with. A take-back, a reopen and a remove name `seen` too.
- **A group act names every change (`seen`)**, its opening and the matching now, and carries its rows and what it does
  to them as two texts, with how many rows. It is recorded on the import and the group or on neither: the import's event
  (`GroupCounted`) carries the count, the group's (`GroupDecided`) the rows and what it does. Otherwise `ReviewMovedOn`,
  `ConfirmedSince`, `MatchedSince` or `StepTaken`. Verify cannot check that the rows a group names are the ones the fix
  fits: the screen computes them, not run.
- **A group is taken back only by its maker, once, and only while it is the last group still in force** (decision 8, as
  answered); then the group under it is the last in force, so undo walks back. Otherwise `NotYourStep`, `GroupedAfter {
  last }`, `DecidedBeforeTheConfirm` or `ConfirmedSince`. A group its maker took back is out of force: the reading lays
  its patch on no row (his answer of 2026-11-22). A row someone changed over the group is the exception: that decision
  was written whole, with what the group gave it, so the row keeps the group's effect until that decision is undone
  (under "The reading of a row through its groups"). He chose that (2026-11-22, "Row 14 stays whole"): the screen names
  the row ("Row 14 was changed by Dana and stays"). A press over the group that left the row reading as it read changed
  nothing and is recorded as nobody's, so the group's undo leaves that row undecided like the group's other rows (his
  answer of 2026-11-22, "No change, Ana's undo applies"). Today's `act` strips the group's part from such a row, and
  changes at the move that puts the review on the model. A group's undo names no `seen` and no `sawGroup`: only a later
  group in force refuses it, not a row's act made since. So Ana's undo is taken from a screen that may not have received
  Dana's act on row 14, and the screen can say "Row 14 was changed by Dana and stays" only once the undo has landed and
  the act is received, counting the rows that changed; the import's event for the undo (`GroupCounted`) counts the
  group's rows, row 14 among them. Whether the screen also warns before the undo, when it already holds a later decision
  on one of the group's rows, is open (DECISIONS.md, "Open"). Not run.
- **A take-back is of everything in force**, from the result or while the import is open again, as today: the items its
  confirms created, removed or kept, and the items they replaced, put back or kept.
- **A row's undo names the change it takes back, the import's last group act (`sawGroup`), and brings what goes under
  the decision it puts back**; the row takes it only when it seals to exactly the text the row holds. It does not reach
  past a confirm that stands. Otherwise `NotYourStep`, `NotWhatWasUnder`, `GroupedSince`, `ConfirmedSince`,
  `DecidedBeforeTheConfirm` or, where a very long history was let go, `HistoryEnds`. It is checked against the row's own
  instance only: it takes back the row's own decision, whatever a group in force does to the row.
- **Every event of the import says whose it is**, and a row act's event who acted and whose decision the row's own
  instance then holds. A group act's rows and what it does are on the group's event, not the import's, so the history,
  the audit line and a notice are written from the import's events and the groups' events together.

The decision a row holds is text: the text the `importDecision` table holds today, read through the contract's
`RowDecision` schema by the screen and by the server's `review`, with a matching beside each part as above. No rule
reads inside it. That encoding is what lets the rules be proved, so it is part of the design.

**The reading of a row through its groups.** A row's decision is its own instance's decision with the patch of every
group in force that names it and has a number above the row's own laid over it, in order. No instance holds that
reading; the screen and `DraftRows` compute it, and no rule of the model holds it. A property ran it against main's
`act` (the app's review reducer), on a copy of the model's rules written in the test, not on the model's code: for one
person, and for two people on screens that hold every change and on screens that hold only what they had at that
person's last press or refresh, up to 60 presses of all eleven actions over 1 to 8 rows, 25,000 generated sequences a
seed. With a redo sent as the undone unit's own rows and patches, and a row counted as touched by any step that named
it, the reading equals the reference after every press that the model accepts and the reference has an answer for, in
every run. Where the reference has no answer and the model accepts (11,966 presses on live screens and 6,479 on stale
ones at that seed), the reference takes the model's result and goes on from it, so each comparison is of one step of
`act` from the last such press, not of a whole history against `act`. On live screens the reference is `act` over the
shared decisions (206,169 comparisons at one seed). On stale screens it is each screen's own result for the rows it
changed, laid over the shared decisions, as today's draft sends them (154,416 comparisons); against `act` run over the
shared decisions the stale run fails, because 224 accepted stale presses read differently there, a fault of that
reference. It does not hold with a redo sent as the same press again (that press reaches rows another person put back),
nor with a row counted as touched only by a step that changed it (in that model a press that changed nothing on a
covered row keeps the group's effect after the group is taken back; under his answer of 2026-11-22, "No change, Ana's
undo applies", such a press is recorded as nobody's, a change the trial model `review15` makes and this property has not
run on). Where the reference has no answer the model still gives one: a group taken back behind later decisions on its
rows leaves each such row with the whole decision its maker made over the group, and with what the group had done to it.
For a row someone changed, that is the reading he chose (2026-11-22, "Row 14 stays whole"); a press that left the row
reading as it read is nobody's decision, and the group's undo leaves that row undecided. Of the refusals at that seed,
some lost nothing that `act` would have kept: on live screens 1,254 of 4,790 `GroupedAfter`; on stale screens 785 of
2,715 `GroupedAfter`, 2,568 of 6,294 `GroupedSince`, 3,400 of 11,401 `ReviewMovedOn`, 79 of 2,864 `DecidedSince` and 3
of 296 `NoLongerThere`; none of the `NotYourStep`. Each costs the person a refresh, and a `GroupedAfter` can keep their
undo blocked until the other takes their group back. What it does not show: the copy's row undo has no `sawGroup` check,
so on stale screens it takes undos the model refuses; confirm, reopen, matching, the cut history, viewers, roles and
organizations were not generated; nor three people, two tabs of one person, or today's draft machine with its saves in
flight; the values come from small alphabets; and it says nothing of the model's proofs.

On the build's branch the same reading runs on the model's own code
(`packages/catalog/web/test/ReviewModelFold.fold.test.ts`, the `fold` task in `check:full`): the review region's presses
sent to `Catalog` in memory, for one person and for two on live screens, with a row's undo naming the last group act
(`sawGroup`), and the case "row 14 stays whole"; stale screens, the queue and a second tab are not in it.

**Every rule, what it is proved of, and what holds the rest** (`Verify.model` of the trial's `Review` on `review14`: 135
rules proved, in 110 s at a load average of about 28, and in 128 s at about 31 in a first run of the same model; the
seven rules across instances by `Verify.model` of its `ReviewInvariants`). The names are the build's, which a test
asserts by name: the rules are the same on both, and the build's branch gives the same 135 proved and 7 searched on
`734c27a`. Where a name starts with ".", it is of the block named before it in the same cell:

| Rule, in words | Name | Standing | Proved of | What holds the rest |
| --- | --- | --- | --- | --- |
| Nothing is confirmed that was not on screen: the confirm names every change, its plan is of every change, and the plan does what the button said | `Import.AConfirmNamesEveryChange`, `.APlanIsOfEveryChange`, `.APlanDoesWhatWasShown` | proved | The numbers and the digests the command states | That the screen names the last change before the first it misses, and digests what it draws: tests (the first ran on trial 13's model and on `review14`, as a property on a copy of the rule written in the test, not on the screen's code); that the handler plans from rows written up to that number, a group's rows included: a slow test, not run. Both digests come from the same `review` |
| A take-back, a reopen and a remove name the last change too | `Import.TheRestNameEveryChangeToo` | proved | The number the command states | |
| Every change has a number of its own, the same on the import and on the row or group it records | `Import.EveryChangeHasItsOwnNumber`; `DecideRow.AndGetsTheNextNumber`, `.OnTheRowToo`; `UndoRowStep.AnUndoIsNumbered`; `DecideGroup.AGroupIsOneChange`, `.OnTheGroupToo`; `UndoGroup.AGroupsUndoIsOneChange`, `.AndTheGroupSaysWhen` | proved | The import's number | That no two rows, no row and group and no two groups hold one change: checked, below |
| Every event of the import says whose it is, and a row act's event who acted | `Import.EveryEventSaysWhose`; `DecideRow.TheImportsEventSaysWhoActed`; `UndoRowStep.TheImportsEventSaysWhoActed` | proved | The actor the request context holds | |
| The import's event for a row says what the row's own instance now holds, whose it is and its text | `DecideRow.TheImportsEventSaysWhichDecisionTheRowHolds`, `.TheImportsEventSaysWhose`, `.TheImportsEventSaysItsText`; `UndoRowStep.TheImportsEventSaysWhichDecisionTheRowHolds`, `.TheImportsEventSaysWhose`, `.TheImportsEventSaysItsText` | proved | The event and the row after it | That `DraftRows` writes it, folded with the groups in force: a slow test, not run |
| The import's event for a group act says how many rows | `DecideGroup.TheImportsEventSaysHowManyRows`; `UndoGroup.TheImportsEventSaysHowManyRows` | proved | The event and the group | The rows and what was done to them are on the group's own event; nothing orders the two for a reader. Not run |
| A decision is replaced only by an act whose sender saw it | `DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt` | proved | The change the act names and the row's own | Of the row's own instance only: over a row a group covers, the sender's `covered` says the row reads otherwise, and no rule checks `covered` |
| A row's act and a row's undo are made on a screen that has the import's last group act | `DecideRow.ARowsActSawTheLastGroupAct`; `UndoRowStep.ARowsUndoSawTheLastGroupAct` | proved | The number `sawGroup` states | That a refused act on a row the group does not name is sent again by itself: the queue's test, not run |
| Nobody clears a decision they did not make; only its organization changes a row; a viewer changes none | `DecideRow.NobodyClearsAnotherPersonsDecision`, `.OnlyItsOwnOrganizationChangesTheRow`, `.AViewerChangesNoRow`; `UndoRowStep.NobodyClearsAnotherPersonsDecision`, `.OnlyItsOwnOrganizationChangesTheRow`, `.AViewerChangesNoRow` | proved | The row's maker and the actor | An act that puts a row back to nothing is recorded as its sender's, over what they saw |
| An act, an undo, a group and a group's undo are of this opening; an act and a group are made on the matching now | `DecideRow.AnActIsMadeOnTheMatchingNow`, `.AnActIsOfThisOpening`; `UndoRowStep.AnUndoIsOfThisOpening`; `DecideGroup.AGroupIsMadeOnTheMatchingNow`, `.AGroupIsOfThisOpening`; `UndoGroup.AGroupsUndoIsOfThisOpening` | proved | The numbers the command states | Which part of a text is still in force: a reader over the columns at each match, and a test, not run. That a carried part keeps its number: a test of the client's merge, not run. What a match does to a group in force: not run |
| An act that changes nothing records nothing | `DecideRow.AnActThatChangesNothingLeavesTheImport`, `.AnActThatChangesNothingLeavesTheRow` | proved | The row's text, when the sender says the row is not covered | With `covered` set the same text is recorded as the sender's. Under his later answer ("No change, Ana's undo applies") an act whose sender says it leaves the row reading as it reads (`asItReads`) records nothing too: made in the trial model `review15`, not in `review14`; no rule checks what the sender says. That one encoder writes the text, so the same decision is the same text: a test, not run |
| An act that is recorded is recorded as its sender said and as theirs; so is a group, whole, in force | `DecideRow.AnyOtherActIsRecorded`, `.WithItsText`, `.OnItsMatching`, `.UnderItsStep`, `.AsItsSenders`; `DecideGroup.AGroupIsRecorded`, `.WithEveryRowItNames`, `.WithWhatItDoes`, `.WithItsCount`, `.OnItsMatching`, `.InForce`, `.AsItsSenders` | proved | The row or the group after the act | That an act is taken at all: no rule holds it. The stories hold it |
| What a row's act replaces is kept under it (its number, maker, text and matching), and what was below that stays below | `DecideRow.AnActKeepsWhichDecisionItReplaces`, `.AndWhose`, `.AndItsText`, `.AndItsMatching`, `.AndWhatWasBelowStaysBelow` | proved | The row and the sealed text | That the step and the label kept under it are the replaced decision's: no rule. What a group did to the row is not kept in the row |
| A row's undo takes back only its sender's own decision, puts back the decision that was under it (its number, maker, text, matching and step), and leaves under that exactly what was recorded | `UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep`, `.AnUndoLeavesADecisionWhenOneWasUnder`, `.AndNoneWhenNoneWas`, `.AnUndoPutsBackTheDecisionThatWasThere`, `.AsTheirsWhoMadeIt`, `.WithItsTextAsItWas`, `.OnItsMatchingAsItWas`, `.UnderItsStepAsItWas`, `.NothingIsBelowWhatWasTheLastKept`, `.WhatLiesUnderIsWhatWasRecorded`; `Row.TheSizeOfByIsTrue`, `.TheSizeOfStepIsTrue`, `.TheSizeOfFlagsIsTrue`, `.TheSizeOfLabelIsTrue` | proved, every depth, of the row's own levels | The seal of what is brought against the seal the row holds, and the sizes of its texts | That two levels never share a seal: `unseal` reads one back, a property over 2,000 random single levels, each sealed over a random text (trial 13, and again on `review14`). That the label put back is the one under it: the evolve copies it (`StepUndone`), and no rule checks it |
| Neither undo reaches past a confirm that stands | `UndoRowStep.AnUndoDoesNotReachPastAConfirm`; `UndoGroup.AGroupsUndoDoesNotReachPastAConfirm` | proved | The confirm's number | |
| A row and a group are decided only on an open import | `DecideRow.ARowIsDecidedOnlyOnAnOpenImport`; `DecideGroup.AGroupIsDecidedOnlyOnAnOpenImport` | proved | The import | |
| A group is taken only from a screen that has every change, and a step decides one group | `DecideGroup.AGroupIsMadeOnEveryChange`, `.AStepDecidesOneGroup` | proved | The number `seen` states and the group's instance | That the rows it names are the ones the fix fits: the screen, not run |
| A group decided is the import's last group act and the last in force, and keeps which one was before it; only the last in force is taken back, and then the one under it is | `DecideGroup.TheImportHoldsItAsItsLastGroupAct`, `.AGroupDecidedIsTheLastInForce`, `.AndKeepsWhichOneWasBeforeIt`; `UndoGroup.OnlyTheLastGroupInForceIsTakenBack`, `.ThenTheOneUnderItIsTheLastInForce`, `.TheImportHoldsItAsItsLastGroupAct` | proved | `lastGroup`, `topGroup` and the group's `under` | That the group the import holds as last in force is in force: checked, below |
| Only its maker takes a group back, once; only its organization changes a group; a viewer changes none | `UndoGroup.AGroupsUndoTakesBackOnlyItsSendersOwn`, `.AGroupIsTakenBackOnce`, `.NobodyUndoesAnotherPersonsGroup`, `.OnlyItsOwnOrganizationChangesTheGroup`, `.AViewerChangesNoGroup`; `DecideGroup.NobodyUndoesAnotherPersonsGroup`, `.OnlyItsOwnOrganizationChangesTheGroup`, `.AViewerChangesNoGroup` | proved | The group's maker and the actor | |
| A group never changes once decided, except to be taken back once | `Group.AGroupHasRows`, `.AGroupKeepsItsRows`, `.AGroupKeepsItsPatch`, `.AGroupKeepsItsNumber`, `.AGroupKeepsWhatWasUnderIt`, `.AGroupKeepsItsMaker`, `.ADecidedGroupStaysDecided`, `.AGroupTakenBackStaysTakenBack` | proved | The group's state | A redo of a group is a new group |
| A match is made on the last one, is the next one, holds the columns it says, and is of this opening | `Import.AMatchIsMadeOnTheLastOne`, `.AMatchIsTheNextOne`, `.AMatchHoldsTheColumnsItSays`, `.AMatchIsOfThisOpening` | proved | The numbers and the text the match states | That the text says every field the match moved: one encoder over `matchColumns`, a test, not run |
| A confirm's four outcomes add up to the rows; no count is negative; no more is in force than the file has rows | `Import.OutcomesAddUpToTheRows`, `.NoMoreInForceThanRows`, `.RowsAreNotNegative`, `.InForceIsNotNegative`, `.ReplacedIsNotNegative`, `.StandingIsNotNegative`, `.CreatedIsNotNegative`, `.UpdatedIsNotNegative`, `.AlreadyIsNotNegative`, `.NotImportedIsNotNegative`, `.RemovedIsNotNegative`, `.KeptIsNotNegative` | proved | The counts the confirm and the take-back state | That they are what is stored: the Result step's query reads them back; under decision 17's answer they are the numbers the handler stated |
| The status becomes Imported only by a confirm; a confirm of a closed import leaves its status | `Import.NothingIsWrittenBeforeConfirm`, `.AConfirmOfAClosedImportWritesNothing` | proved | The status | That a batch never writes twice: the marker and its test (Proof 4) |
| A take-back needs a confirm that stands, is of everything created and everything replaced, and nothing stands after it | `Import.OnlyAnImportWithAConfirmStandingIsTakenBack`, `.ATakeBackIsOfEverythingInForce`, `.AndOfEverythingReplaced`, `.NothingStandsThatWasTakenBack`, `.WhatIsInForceThenIsWhatWasKept` | proved | The counts | That a changed item is kept: the item's own rule under decision 17's first option. That a take-back waits for the confirm's items: no rule (decision 17) |
| A suggestion writes nothing; a closed import's matching does not change; it opens only by Reopen; a removed import stays removed and had nothing in force | `Import.ASuggestionWritesNothing`, `.OnlyAnOpenImportIsReviewed`, `.AnImportIsOpenedAgainOnlyByReopen`, `.ARemovedImportStaysRemoved`, `.OnlyAnImportWithNothingInForceIsRemoved` | proved | The status and the counts | |
| A row has no decision of its own again only when nothing was under it | `Row.ARowIsUndecidedOnlyWhenNothingWasUnder` | proved | The row | |
| Tenancy and viewers: an import, a row and a group never change organization; only its own organization changes an import; a viewer changes nothing | `Import.AnImportNeverChangesOrganization`, `.OnlyItsOwnOrganizationChangesAnImport`, `.AViewerChangesNothing`; `Row.ARowNeverChangesImportOrOrganization`; `Group.AGroupNeverChangesImportOrOrganization` | proved | The actor the request context holds | That the session fills it truly: an Api test in process (Proof 5) |
| A decided row and a group belong to the organization of their import | `Catalog.ARowBelongsToItsImportsOrganization`, `.AGroupBelongsToItsImportsOrganization` | proved | The import and the row or group | |
| No two rows, no row and group, and no two groups of an import hold the same change; a group's change is one its import gave, and its undo comes after it; the group the import holds as last in force is in force; no group act is later than the import's last | `Catalog.NoTwoRowsHoldTheSameChange`, `.NoRowAndGroupHoldTheSameChange`, `.NoTwoGroupsHoldTheSameChange`, `.AGroupsChangeIsOneItsImportGave`, `.AGroupsUndoComesAfterIt`, `.TheLastGroupInForceIsInForce`, `.NoGroupActIsLaterThanTheImportsLast` | checked, every sequence of up to 3 commands (16,629 sequences, 3,630 states, 52 s at a load average of 36 falling to 30; 44 s at 26 falling to 23 in a first run), and 200 sequences of up to 8 commands sampled | | At 2 commands, 9,401 sequences and 637 states (45 s, load 28 to 36; 41 s, load 30 to 26, in a first run). That a row's change is one its import gave: no rule of this model |

Each decision alone (`Prove.decision` on `review14`, at loads of 25 to 33): `Deciding` 152 paths in 9.1 s, `Undoing`
298 in 19.4 s, `DecidingGroup` 42 in 0.5 s, `UndoingGroup` 84 in 2.9 s; a first run, at loads of 31 to 37, took 5.6,
20.3, 0.5 and 3.2 s. The import and the group alone end `NotVerified`, because each folds events only a decision
records, so their reports must pass the decisions in `decisions`.

**What no rule of the model holds**, each with where it is held or asked:

- What a decision contains (a typed value, which proposal, which of two rows is kept): `review` and its tests. A text no
  reader can read, or a row the file does not have: the command's schema bounds both; `DraftRows` and the handler name
  and skip what they cannot read (a test, not run).
- `covered` and `asItReads`, which the sender states: with `covered` set and `asItReads` not, a repeat is recorded as
  the sender's. So "no change" (his answer of 2026-11-19), "it stays Dana's" (decision 3) and "No change, Ana's undo
  applies" (2026-11-22) hold only when the sender says them truly. That a group leaves out the rows that already hold
  what it gives, and that the screen sets `covered` and `asItReads` truly: the screen, not run.
- That the rows a group names are the ones the fix fits: the screen, not run.
- A person who decides a row as someone else already did has no decision of their own there: decision 3. A decision its
  maker took back while another's lay over it comes back when that one is undone, for single-row acts: decision 11; a
  group its maker took back lays its patch on no row, but a row someone changed over it keeps the group's effect in its
  own decision, as he chose (2026-11-22, "Row 14 stays whole"; the screen says "Row 14 was changed by Dana and stays");
  a press over it that changed nothing is nobody's, and that row is undecided once the group is taken back ("No change,
  Ana's undo applies"); today's `act` strips the group's part, and changes at the move that puts the review on the
  model.
- A keep of one of two rows is an act on several rows today, and can be taken in part: decision 14.
- Which parts of a decision a match put out of force, and whether it changes the row (his answers of 2026-11-20 and
  2026-11-21): the reader over the columns at each match, with `review`, and their tests, not run. What a match does to
  a group in force: not run.
- A row whose item a take-back kept can have its decision undone, since no confirm stands; `review` counts a row whose
  item this import has in force as already there, whatever its decision (a test, not run).
- The undo of a decision made before a confirm is refused on the rows that confirm did not import, too: decision 12.
- A refused act that is sent again under its own command id is decided again, as the library does, so the queue gives an
  act sent again after a refusal a new id.
- `DraftRows` rebuilds an undo's level with the model's own `seal` and its rule of what is let go, or an undo past the
  limit is refused (a test, not run).
- A group act's rows are on the group's event and its count on the import's, and nothing orders the two sources for
  `DraftRows`, the history or the confirm's plan; what the confirm's handler waits for when the last change is a group
  act is not written. After a row's undo over a group in force, the import's event says what the row's own instance
  holds, not what the row reads, so `DraftRows` folds it with the groups in force before it writes `importDecision`. Not
  run.
- A take-back is not held to wait for the confirm's items, the import's counts are the numbers the handler stated, and
  `ImportConfirmed` does not name the plan it confirmed: decision 17. A design for the wait, not run, is under
  decision 5.
- A change to the stored items between the plan and its write: the write's own statements, as today.
- A screen that claims to have received what it has not; no server can know.
- What a projection writes and what a stream or a query gives ("not checked", in Verify's report), and that a decision's
  events commit on both objects or on neither, which Verify assumes and the local workerd runs showed for an accepted
  and a refused act (for the raced acts the row-by-row run read back only the import's count of changes, not the rows);
  an abort after a prepare never happened there.

**Nothing evaluates a rule when the app runs.** What refuses a state in the running app is the code of `decide`. A
proved rule means that code cannot break it; a checked rule means no short sequence did.

### What the screen sends, and what it follows

**It sends one act at a time, in order, each with its step, the matching and opening it was made in, and a command id
made at the press.** A resend with the same command id answers the first receipt. What each act carries:

| Act | Command | What it names |
| --- | --- | --- |
| A row's act | `DecideRow` | The row, the step, the decision it saw there (`saw`), the import's last group act as the screen has it (`sawGroup`), whether a group in force covers the row (`covered`), whether the act leaves the row reading as it reads now through its groups (`asItReads`, his answer of 2026-11-22; in the trial model `review15`), the opening, the matching, the decision's text and its label |
| A row's undo | `UndoRowStep` | The row, the change it takes back, its step, `sawGroup`, the opening, and the level that goes under the decision it puts back, with the sealed text below that |
| A group's act | `DecideGroup` | The step, the opening, every change the screen has received (`seen`), the matching, the rows and what the act does to them as two texts, and how many rows |
| A group's undo | `UndoGroup` | The step and the change it takes back, and the opening |

A group act names every change, so it is sent once every earlier act in the person's queue has come back.

**A rejection ends nothing by itself** (his answers of 2026-11-20 and 2026-11-21). What each one means for the queue of
waiting acts:

- `DecidedSince` or `NoLongerThere`, someone decided the row since: the act is held, with both decisions and whose is
  whose, until the person picks one, and Confirm waits.
- `GroupedSince`, a group landed that the screen had not received (not run). When a colleague's group act lands, a
  waiting act on a row the group does not name is sent again by itself, naming the new last group act; one on a row the
  group names is held and shown with both, as his answers "Hold it, show both, ask" and "Keep them, say why"
  (2026-11-20) say, and as he chose again on 2026-11-22 ("Yes: resend untouched, hold touched"). Nobody decides again by
  hand what nothing touched. The refusal hands back no number: the screen learns the last group act only by receiving
  it, and sends again after that. The queue tells a touched row from an untouched one only by the group's rows, so a
  refused act is sent again or held only once the screen holds the rows of every group up to the new last group act.
  Those rows come only on each group's own event (`GroupDecided`, and `GroupUndone` for an undo); the import's event
  (`GroupCounted`) carries the count, and nothing in the model orders the two. So the screen, for each group change up
  to the new last group act, waits until it has both that change on the import's events and the group's own event; the
  projection that appends them to `ImportActs` and the queue wait for the same. The model gives no protection here: once
  a resend names the new last group act, `DecideRow` checks `saw` only against the row's own instance, which a group
  never moves, and `covered` is the sender's word, so a resend on a touched row sent from a screen with the number and
  not the rows is taken over the group's decision. Proving that order is move 3's work, not done (a case in Proof 3). A
  row's undo names the import's last group act too, and is refused the same way (his answer of 2026-11-22). A waiting
  undo on a row the group does not touch is sent again by itself, as a waiting act is (his answer of 2026-11-22, "Sent
  again by itself"); only one on a row the group touched is held and shown: the screen shows the group, and they press
  undo again if they still mean it.
- `ReviewMovedOn` on a group act, its screen one change behind: the screen draws the change, and the person presses
  again.
- `GroupedAfter { last }` on a group's undo: a later group is still in force; the screen names it, and the undo stays in
  the person's history until that group is taken back.
- `MatchedSince`: the screen sends the act again without the parts whose field was matched since, shows those proposals
  as open again and says which accepts were taken back (his answer of 2026-11-20, "Server refuses, screen says so"); an
  act left with nothing is not sent again.
- `ConfirmedSince` or `NotOpen`: the act was made before a confirm; nothing more is sent for it, and the screen names
  the row and what was decided, then drops it (his answers "Name the rows, then drop them", 2026-11-20, and to decision
  13, "No, name it and drop it").
- Any other (`NotYourStep`, `NotWhatWasUnder`, `DecidedBeforeTheConfirm`, `HistoryEnds`, `StepTaken`): the act stays,
  marked not saved with the reason, until they decide the row again or dismiss it; a person who is signed out counts as
  waiting.

Other rows' acts go on. A failure that may pass keeps the act waiting, with "Save again". An act behind the person's own
match is sent only if that match was the one taken (its receipt's number is the next one); otherwise it is held. None of
this ran.

**Acts that wait are kept.** The person's acts the server has not answered are kept in the saved progress. After a
reload they come back marked not saved yet and are sent again; the browser asks before the page is left while any wait.
Each tab keeps and sends its own; a tab opened later takes up the queue of a tab that is gone, and the tab whose acts
were taken up says so if it loads again; an act already recorded answers its first receipt, and one beside the open
tab's for the same row is held for the person to pick. His answer of 2026-11-20: a decision the person made is either on
the server or still waiting, never neither.

**It follows a stream of changes.** A projection, `DraftRows`, is given the import's events, which hold every change of
the import in one order, and the groups' events, which hold each group act's rows and what it does to them. In one D1
batch it writes each row's decision as read through its groups to `importDecision`, the act to the row's history, the
columns to the import's choices with what each match took back, and the import's place in that order, so a person who
comes later reads them too (his answer of 2026-11-21: shown to everyone until each dismisses it); it appends the change
to a stream, `ImportActs`, keyed by the import. The import's event for a group act carries only its count, and nothing
orders the import's events and a group's for the projection, so what it waits for before writing a group's rows is not
written. Not run. The screen reads the rows once, with their place, then receives each change as it is appended, and
knows by the numbers when one is missing.

**What the screen shows** is the rows as last read, the changes received since, and the person's own acts not among them
yet, folded with the app's review rules and read through the groups in force.

**The confirm, both halves.** The screen sends Confirm only after its own acts have come back recorded and none is held
or marked not saved (his answers of 2026-11-21: one press settles many); it names the last change before the first one
it has not received, and a digest of what it shows every row will become. Confirm never waits for a group: a group act
is one numbered change, and a confirm that has not received it is refused. The handler waits until `DraftRows` has
written up to the import's last change (the projection's `caughtUp` on that change's receipt), reads the rows and the
place in one D1 read, runs the same pure `review`, stores the plan with that place, and sends `ConfirmImport` with both
numbers and both digests. The import's half is proved. Of the screen's half, only the rule for the number it names ran,
on trial 13's model and on `review14`, as a property on a copy of the rule written in the test; the rest of the screen's
half and the handler's, a last change that is a group act included, are tests to write (Proof 3 and Proof 4).

**The group act.** One press on a group is one `DecideGroup`, whatever its size, saved at once: the person's own screen
shows the whole group as soon as it is recorded, and everyone else's when it receives that change. Another person's act
on any row, made before the group reached their screen, is refused with `GroupedSince`: on a row the group does not
touch it is sent again by itself, and on one it touches it is held and shown with both (his answer of 2026-11-22); a
waiting undo the same way ("Sent again by itself"). Not run. A group pressed on a screen one change behind is refused
and pressed again. The screen computes which rows a group names and what it does to each, which no rule checks; not
run. Its time on the host was measured on the model before the last-group rule (trial 17, under "What the trials
established").

### What becomes of `Draft.machine.ts` and the atoms

`packages/catalog/web/src/Draft.machine.ts` is one pure transition, `step(draft, event) -> { draft, effects }`, with
a property test over random orderings. It stays, smaller. The parts that hold his five answers move as follows.

| Part today | Holds | Under the model |
| --- | --- | --- |
| `held`, `shown(draft)`, `epoch`, `Restart`, `onScreen` | The server's picture and what is drawn | Stay: the rows as last read and the acts received since; `shown` is the fold the property test checks |
| `flight`, `unsent`, `stalled`, `landed` | Saves on their way | One ordered queue of the person's acts, each with step and command id |
| `Opened { kept }`, `keptWaiting` in `Draft.atoms.ts` | "Keep them and send them", "Each tab keeps its own" | Stay: the queue is what is kept, one per tab, and it is sent again after a reload |
| `ViewArrived { open }`, `closing`, `leftOver`, `LeftOverNamed` | "Name the rows, then drop them" | Stay: the stream says the import is confirmed; the queue sends nothing more; the Result step names the left-over acts |
| `ConfirmPressed`, `ConfirmMoved`, `ConfirmStale` | "Refuse, show, confirm again" | Stay, on new causes: Confirm waits for the queue to empty; `ReviewMovedOn`, `PlanBehind` and `NotWhatWasShown` are `ConfirmMoved`, and the screen draws again from the stream |
| `madeOn`, `notApplied`, `withoutStaleDecisions` (server), `MappingChoice.at` | "Server refuses, screen says so" | `madeOn` becomes the matching an act was made on; `MappingChoice.at` becomes the columns at each match, on the import's events; `notApplied` becomes the screen's reading of `MatchedSince` and of the parts the match put out of force |
| The held and the refused rows, `onHold` and `seen` | "Hold it, show both, ask"; "Keep them, say why"; "Wait until she picks" | Stay, on new causes: `DecidedSince` and `NoLongerThere` hold the act with both decisions; any other rejection marks it not saved; Confirm waits for both |
| `changed` in `SaveAnswered` | "Answer says 'no change'" | A receipt with no events |
| `Send { delta }`, `deltaOf`, `over` with a clear, `SaveAnswered`'s revision cases, `Put`, `Ask`, `matching`, `MatchStarted`, `MatchEnded` | The difference between two pictures | Go: an act is sent, and the stream brings the rest |
| The test's hand-written server | | Goes: the test drives the real model on `Domain.InMemory` |

**The review region changes too.** `packages/review` keeps its own undo and redo stacks and hands its whole state to
its caller after every action. Under the model each action carries a step and names its rows; Undo and Redo are
handed to the caller as acts; the stacks are filled from the person's steps on the server. His answer A6 (2026-11-19)
made `Action` a `Data.TaggedEnum` until an action is stored or sent; main's rule against `switch` has since made it a
literal kit's tagged union on `type` (`packages/review/src/ReviewDraft.rules.ts`). Under the model an act is sent as a
command whose text is the row's decision and whose label is stored, so `Action` itself is neither, and A6 stands.

### The undo history

- **Undo is an act**: `UndoRowStep` for a row's own step, `UndoGroup` for a group's. A row's undo is taken only for the
  sender's own step while that step is the row's own decision, and puts back what was under it. A row's undo names the
  import's last group act too, as a row's act does: it is refused when a group landed that the sender's screen has not
  received (his answer of 2026-11-22; `UndoRowStep.ARowsUndoSawTheLastGroupAct`, proved). On a row the group does not
  touch the waiting undo is sent again by itself; on one it touched, the screen shows the group, and they press undo
  again if they still mean it (his answer of 2026-11-22, "Sent again by itself"). Not run.
- **A group is taken back only while it is the last group still in force** (decision 8). An earlier one is refused with
  `GroupedAfter`, which names the later one; once that one is taken back, the earlier is the last again, so undo walks
  back. A group its maker took back is out of force, and its patch is laid on no row (his answer of 2026-11-22); a row
  someone changed over the group keeps that decision whole, with what the group had done to it when it was made, so the
  group's effect stays on that row until its decision is undone (the property under "The reading of a row through its
  groups"). He chose that (2026-11-22, "Row 14 stays whole"), and the screen names the row ("Row 14 was changed by Dana
  and stays"); a press over the group that left the row reading as it read changed nothing, is nobody's, and leaves the
  row undecided once the group is taken back ("No change, Ana's undo applies"). Today's `act` strips the group's part,
  and changes at the move that puts the review on the model.
- **The history is the person's steps, read from the database**: `MySteps`, a query over the rows `DraftRows` writes
  (the step, who, the label, the rows it named, and what each row held before; for a group act, the group). It is the
  same after a refresh and on another device. A row's step is in force on the rows whose own decision still holds it; a
  group's while it is in force.
- **A deeper undo brings the level it uncovers**, rebuilt from the row's history in the same rows; the row takes it only
  when it seals to the text it holds, so a history read behind, or made up, is refused.
- **Redo is the undone step sent again as a new step**, with the undone unit's own rows and what it did to each, not the
  press run again: run again, the same press reaches rows another person put back since (the property's first
  counterexample). A group redone is a new group.

### His answers, carried into the model

His answers given by dialog on saving the review, built in today's code, each with what the model holds and what stays
tested. "Proved" names rules, under the build's names, that `review14`'s report prints as proved and the build's branch
proves on `734c27a`; a blank means no rule of this model holds the answer. The options he rejected are in
[DECISIONS.md](DECISIONS.md).

| Answer (date) | In the model | Proved | Tested |
| --- | --- | --- | --- |
| "Answer says 'no change'" (2026-11-19), rows somebody else had just decided the same way among its cases | A row's act that leaves the row as it is records nothing, whoever made what is there; its receipt has no events. Only when the sender says the row is not covered by a group (`covered`), or that the act leaves the row reading as it reads through its groups (`asItReads`, his answer of 2026-11-22, "No change, Ana's undo applies"; in the trial model `review15`); no rule checks either; a group act is recorded whole. What that means for the second person is decision 3 | `DecideRow.AnActThatChangesNothingLeavesTheImport`, `.AnActThatChangesNothingLeavesTheRow` | That the screen reads an empty receipt as "no change"; that it sets `covered` and `asItReads` truly and leaves out of a group the rows that already hold what it gives: not run |
| "Refuse, show, confirm again" (2026-11-19): nothing is confirmed that was not on screen | The confirm names every change its screen received, the change its plan was built at, and what its button said. A group act is one numbered change, so no group is ever being sent and a confirm that has not received one is refused | `Import.AConfirmNamesEveryChange`, `.APlanIsOfEveryChange`, `.APlanDoesWhatWasShown` | The screen's and the handler's halves, a last change that is a group act included |
| "Keep them and send them" (2026-11-20) | The queue of acts, with command ids, kept through a reload | | The fold's property test: every act is in the events or in the queue. Not run on this model |
| "Name the rows, then drop them" (2026-11-20) | Nothing is decided on a closed import, nor after a reopen by an act, an undo, a group or a group's undo made before the confirm (decision 13) | `DecideRow.ARowIsDecidedOnlyOnAnOpenImport`, `.AnActIsOfThisOpening`; `UndoRowStep.AnUndoIsOfThisOpening`; `DecideGroup.AGroupIsDecidedOnlyOnAnOpenImport`, `.AGroupIsOfThisOpening`; `UndoGroup.AGroupsUndoIsOfThisOpening` | The Result step names the left-over acts |
| "Server refuses, screen says so" (2026-11-20) | Every row act and group act names the matching it was made on; a match holds every field's column; each part of a text keeps its own number | `DecideRow.AnActIsMadeOnTheMatchingNow`; `DecideGroup.AGroupIsMadeOnTheMatchingNow`; `Import.AMatchIsMadeOnTheLastOne`, `.AMatchHoldsTheColumnsItSays` | Which parts are out of force, for every reader; the screen says which were taken back. What a match does to a group in force: not run |
| "SKU rematch", "Twin rematch", "Undone fix" (2026-11-20): server refuses, says so | A Replace, a Keep-stored, a keep of one of two and an undone fix are parts of the text with their own number; the reader puts them out of force as an accept | | The reader's test, each kind; not run |
| "Other rematch" (2026-11-20): refuse if it changes the row | The reader compares the row with the stored item on the columns at the part's match and now, with `review` | | The same |
| "Only when it changes" (2026-11-21); a field displaced by another's match counts as moved | The same columns again are no match (no rule: removing that check breaks none, and a story catches it); the columns are of every field, so a displaced one is moved | `Import.AMatchHoldsTheColumnsItSays`, of the columns a match holds | A story on `review14` (the same columns, by heading or by hand, are no match) |
| "Hold it, show both, ask" (2026-11-20), for a row that waited | `DecidedSince` and `NoLongerThere` refuse the act; the queue holds it with both. An act made before a colleague's group reached the screen is refused with `GroupedSince`, held on a row the group names and sent again on one it does not. A row that did not wait is decision 2 | `DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt`, `.ARowsActSawTheLastGroupAct`; `UndoRowStep.ARowsUndoSawTheLastGroupAct` | That the queue holds it and Confirm waits; not run |
| "Keep them, say why" (2026-11-20) | A refused act stays in the queue with its reason; signed out counts as waiting | | The queue's test |
| "Each tab keeps its own" (2026-11-20); a discarded tab counts as gone and says so; "Keep both, she picks" for a refused row beside a closed tab's (2026-11-21) | One queue a tab, taken up only from a tab that is gone; a command id answers its first receipt whichever tab sends it | | The queue's test with two tabs |
| "Wait until she picks", "Wait, like a held row" (2026-11-21) | Confirm is sent only when no act is held or marked not saved | | The screen's half of the confirm |
| "Take it back, say so" for a Replace on an import matched before moves were kept (2026-11-21) | Such a decision that arrives after the re-match is out of force and named, by the reader | | The reader's test; not run |
| "Leave as made" (2026-11-22) for a Replace or Keep-stored already saved on such an import, its field not matched again | Adoption (decision 37) carries it as made; the next match of that same field takes it back and names it, a match of another field leaves it | | Adoption's test; not run. Adoption binds only from the first deploy he keeps |
| "Yes, everyone" (2026-11-21): what a match took back is shown to newcomers until each dismisses it | `DraftRows` writes it with the match, in rows the first read returns | | A slow test; not run |

### Every single thing

One row for every page of [the map](research/00-map.md) and every extra he named: its worked instance, the move it lands
in, and the check that fails when it is missing. "Not run" marks a row whose check no trial has run; every other row's
check ran in a trial named on the trial page.

| Concept | Worked instance | Move | Fails when missing |
| --- | --- | --- | --- |
| Model | `Catalog`, `Access`, `Usage` | 1, 6, 2 | `Verify.report` of each, the library's lock file keeping every rule's text and `require.proved` naming every rule that must be proved (his answer of 2026-11-22, "Lock plus the library's proved list"). The trials ran `Review` (`review14`) and `Access`; the build's branch `claude/alchemy-review-model-f206c6` runs `Catalog` on `734c27a` with the lock and not yet `require` (135 proved, 7 searched, 11 reached); `Usage` not run |
| Command, event, rejection | `DecideRow`, `RowDecided`, `GroupedSince`; `DecideGroup`, `GroupDecided`, `GroupedAfter`; `ConfirmImport`, `ImportConfirmed`, `ReviewMovedOn` | 1 | A story for each of the eleven commands accepted and for each refusal, each failing on a model whose `decide` records nothing for that command (on `review14` each mutant that records nothing fails stories); a "can happen" rule (`sometimes`) for each command, answered "reached": eleven reached on the build's branch (`Catalog.verify.test.ts`); not run on any trial model |
| Aggregate | `Import`, `Row`, `Group`, `Item`, `Allowance`, `Organization`, `Member` | 1, 4, 2, 6 | Each one's Verify test, with a mutant beside each check that must break its rule or fail a story. The mutants ran on the review's model only (`review14`, 148; the build's branch keeps the same 148, a sample in `check:full` and all nightly); for `Item`, `Allowance`, `Organization` and `Member`: not run |
| Annotations | A description on every served command, view, stream and query, and on each Api | 1 on | A test that fails on a served declaration with none. Not run |
| Decision | `Deciding`, `Undoing`, `DecidingGroup`, `UndoingGroup`; `FoundOrganization`, `AddMember`, `ChangeRole`, `RemoveMember` | 1; 6 | `Prove.decisionReport` of each in `bun run check`: every rule its report gives must be proved, and each decision must state its aggregates' rules on who may change them, `missingRules` (the build's four, on its branch); which rules exist is the lock's, in `check:full`. The members' four with `MemberEmail` not run |
| Relation | `ARowBelongsToItsImportsOrganization`, `AGroupBelongsToItsImportsOrganization` (proved on `review14`); `AMemberWhoIsInIsCounted` (checked, trial 10) | 1; 6 | Each asserted by name with its standing |
| Invariants and transitions | Aggregate invariant `NoMoreInForceThanRows`; aggregate transition `AConfirmNamesEveryChange`; decision transition `ADecisionIsReplacedOnlyByAnActThatSawIt`; the seven model invariants across `Import`, `Row` and `Group`, `TheLastGroupInForceIsInForce` among them; model `eventually` `EveryUploadEnds` | 1, 5 | `Prove.report(Import)` and `Prove.decisionReport(Deciding)` in `bun run check` fail when `NoMoreInForceThanRows`, `AConfirmNamesEveryChange` or `ADecisionIsReplacedOnlyByAnActThatSawIt` is not proved (neither call takes the lock or `require`); one that is absent fails `Verify.report` in `check:full`, whose lock holds each one's text; `Verify.report` in `check:full` names the proved ones in `require.proved` and asserts the seven model invariants (`Catalog.TheLastGroupInForceIsInForce` among them) and `EveryUploadEnds` "checked", the lock keeping each one's text. On the build's branch all but `require.proved` and `EveryUploadEnds` run |
| Unique values | The email an admin adds a person by (`MemberEmail`); a SKU per organization under decision 17's first option | 6; 4 | A story: two admins add one email, one is refused. Not run; the SKU not run |
| Deadlines | `ExpireUpload`, scheduled when an upload begins | 5 | A story with the clock moved past the deadline; the `eventually` rule. Not run |
| Project layout | Blocks in each context's `model` package (decision 32) | 1 | A block Verify cannot read fails its test as "not read". Not run |
| View | `ImportStatus`, `AllowanceToday` | 3; 2 | An Api test in process reads each. Not run |
| View security | Every view and stream checks the organization and the role, and the member record on each push (decision 22) | 2 on | An Api test in process: a member of the second organization and a viewer against every command, view and stream. Not run |
| Stream | `ImportActs`; `ImportHistory` | 3; 5 | The fold's property test reads it after a cursor. Not run |
| Query | `ImportReview`, `MySteps`, `ImportResultCounts`; `ItemsPage`, `ItemFacets`; `OpenImports`, `PastImports` | 3; 4; 5 | Slow tests on D1; a story on the memory store. Not run |
| Reads and consistency | The confirm's handler waits for `DraftRows`; the Result step reads with the confirm's receipt | 3 | A slow test: Confirm sent while `DraftRows` is one act behind, and while it has not written a group's rows. Not run |
| Projection | `DraftRows`, which reads each row through its groups; `ItemRows` (decision 17); `MemberRows` | 3; 4; 6 | Each batch run twice with the same input writes once; a row a group in force names is written with the group's decision. Not run |
| Policy | `UploadDeadline`; `SuggestOnAsk`; `MailOnConfirm`; `TellTheChannel`; `EndReadsOnRemoval` | 5; 5; 8; 8; 6 | `Verify.model` runs each behind the others; a story. Not run |
| Saga | `CreateItems` (decision 17); `SuggestionPass` | 4; 5 | A story on the memory host. Not run |
| External system | `Suggester`, `Decider`, `Mailer`, `TeamChannel`, `CatalogueHistory` | 5, 8, 8, 8, 10 | Stubbed in stories; each adapter's own test. Not run |
| Api | `MemberApi` (what a browser may send), `ServerApi` (`ConfirmImport`, `Adopt…`, what a saga sends), `AdminApi` | 2, 3, 6 | A test that `MemberApi` lists none of the server's commands. Not run |
| HTTP and OpenAPI | The operator's document over `AdminApi` | 9 | The document lists exactly those calls. Not run |
| CLI | The operator's command line, `toCli` | 9 | A test runs `--help`. Not run |
| Agent tools and MCP | The assistant's read tools, `toToolkit`; an MCP server, `toMcp` (decisions 50, 51) | 9 | A test that neither exposes a command that confirms, takes back, edits or changes a role. Not run |
| Sessions | `CurrentActor` declared in each model's own package, filled by one session lookup | 2 | An Api test in process: no session is refused, a viewer gets `NotPermitted`. Not run |
| Better Auth with Alchemy | The model's Worker resolves the actor from the session cookie with `@alchemy.run/better-auth` | 2 | A test on the library's harness with `dev: true`: a command sent with a session cookie is decided as that member, and one with no cookie is refused, with the actor resolved through `@alchemy.run/better-auth`'s Layer; it fails without that Layer. Not run |
| Discord sign-in | Better Auth's Discord provider behind two settings and a flag (decisions 23, 60 to 62) | 8 | A test that the sign-in page offers Discord only when both settings are present; the browser pass on a stage. Not run |
| Local-first | The queue of acts kept through a reload; `Import.predict` on `ImportStatus` | 3 | The queue's test; a property test that `predict` agrees with the memory host. Not run |
| Foldkit | One admin page, "Model calls today", watching `AllowanceToday` | 7 | A test that mounts the page as a Foldkit program built from `@alchemy.run/domain/Foldkit`'s Commands and Subscriptions against the memory host and sees the number fall; it fails when the page does not import the adapter. Not run |
| Platform contract | `Usage` unchanged in memory, on Durable Objects and on the Cluster pool | 2, 7 | Its stories on each host's harness. Not run |
| Host in memory | Under every model test and story | 1 | Every story; removing it fails them |
| Host on Durable Objects | `Usage` at 2, `Catalog` at 3, `Access` at 6 | 2, 3, 6 | The harness test: a command through each model's binding answers, and fails without the binding. Not run; the one-unit model ran in local workerd before the last-group rule (trial 17), and `review14` was not hosted |
| Host on Effect Cluster | `Usage`, on the Durable Object pool (decision 27) | 7 | The pool's harness test and one call through it. Not run |
| Host on Rivet | **Cannot yet**: no Rivet control plane or pool runs on Cloudflare (decision 57) | | Its question answered |
| Backfill | `ImportHistory` added in move 5, after imports exist | 5 | An import confirmed before that deploy is in the history after it, on the preview stage. Not run |
| Observability | `Alchemy.Telemetry.layerOtlp` in the model's Worker | 2 | A test with an in-memory exporter sees a command's span and a `domain.*` metric. Not run |
| Story | A story for each of the review's eleven commands and each refusal (43 written for `review14`, 45 on the build's branch), five on the item, six on the allowance, three on members | 1 on | A test that lists each model's commands and rejections and fails on one that no story names. Not run |
| Test tooling | Api tests in process; the library's harness with `dev: true` | 2 | The harness test fails without a model's binding. Not run |
| Verify, Prove, Explore | `Prove.decisionReport` per decision in `bun run check`; for the import's own rules, `Prove.report(Import)` in the same task, which proves its 37 rules for each of its seven commands and leaves `ActCounted` and `GroupCounted` to the decisions (on `review14` the per-rule section of `Verify.aggregate` over the import, `ImportLife` there, gave the same 37 proved, the report itself `NotVerified` because the import folds events only a decision records); `Verify.report` per model in `check:full` and in CI, in its own job and nightly, with no new infrastructure (34a); a rule Verify breaks kept as a story | 1 | The Prove tests fail on any rule not proved, and a decision's on leaving out its aggregates' rules on who may change them; since `Prove` takes no lock and no `require`, which rules there are is held by the lock of `Verify.report`; `Verify.report` keeps every rule's text in the lock file and names the rules that must be proved in `require.proved` (decision 34, his answer "Lock plus the library's proved list"). On the build's branch the lock runs and `require.proved` does not yet |
| The tutorial | Move 1 follows its parts 1 to 3 on this app's nouns | 1 | A test named for each part, which fails while that part's block is absent. Not run |
| The Cloudflare tutorial | Part 3 is the harness test, part 4 is `alchemy dev`, part 5's pull-request comment is the GitHub provider's `Comment` | 2, 9 | A test named for each part: the harness test, `alchemy dev` answering, the comment read back from a preview's pull request. Part 4 ran; the others not run |
| Effect Cluster | The pool that hosts `Usage`, its cron and its singleton (decision 28) | 7 | The pool's harness test. Not run |
| Workflows | The sagas above; an Effect workflow on the Worker that has D1 (decision 56) | 3, 4 | A story of each saga; the workflow's own test. Not run |
| Singletons and crons | Decision 28 | 7 | A cron fired with the clock moved; the singleton's test. Not run |
| Drizzle on Durable Objects | One import's suggestions in the import's own object (Drizzle's), behind `SuggestionStore` | 8 | The port's tests against the object. Not run |
| GraphQL | Decision 54 | 9 | A test of the analytics driver on its test layer, beside a repository test that fails when no driver imports `effect/graphql`. Not run |
| Confidence scores | Decisions 45 to 47 | 8 | A scored answer through the `Decider` adapter, and the rules answering with the key off. Not run |
| Resend | `@distilled.cloud/resend` as the `Mailer` adapter (decisions 48, 49) | 8 | A test that the mailer is the distilled client; a mail through the "mail off" Layer. Not run |
| Distilled clients | `@distilled.cloud/resend` for mail; Discord for the team's channel (decisions 52, 53); GitHub through Alchemy's provider; Grafana and 1Password's events client in the operator's scripts; Docker for the operator's check that the telemetry stack is up | 8, 9 | A repository test that lists the clients this row names (Resend, Discord, GitHub, Grafana, 1Password events, Docker) and fails when any has no adapter or script importing it and no test of its own. Not run |
| `@alchemy.run/1password` | The stacks' secrets written from `op://` references at a deploy. His to run; no agent resolves a reference | 9 | A deploy whose stack declares the secret only as an `op://` reference through `@alchemy.run/1password`, with no other source for it, and whose Worker reads that secret; it fails when the reference or the package is removed. Not run |
| Alchemy Git | Decision 55. CI on it **cannot yet** (decision 58) | 10 | A commit read back from the Git Worker in its test, beside a test that fails when the stack declares no Git Worker. Not run |
| GitHub provider | Today's environments, secrets and ruleset; the `Repository` resource and a preview's `Comment`. Workflow files **cannot yet** (decision 59) | today; 9 | A test that reads the stack's declared `Repository` and `Comment` and fails when either is absent. Not run; `GitHub.stack.ts` type-checks against the pinned provider today |

### Where each read and refusal is answered from

| Read or refusal | Today | Under the model |
| --- | --- | --- |
| The decisions the Review step shows | `GET /imports/:id`, from `importDecision` | `ImportReview`, a query over the same rows, which `DraftRows` writes |
| A row's decision when a group names it | There are no groups: a group act is saved as one decision a row | Read through its groups: the row's own decision with the patch of each group in force over it, laid on by `DraftRows` before it writes `importDecision`, and by the screen for the changes it receives. Not run |
| "N of M rows need a decision" in the list of open imports | `review` over the saved decisions | The same, over the same rows |
| Whether an accept, an undone fix, a keep or an answer about the stored item is in force | `withoutStaleDecisions` (`Rematch.rules.ts`) against `MappingChoice.at` and the import's column moves | A reader over the columns at each match, each part against the fields it rests on |
| Which group may be taken back | Nothing: an undo is of the person's own step | The import's last group still in force (`topGroup`); `GroupedAfter` names the later one |
| The numbers on the Result step | Read back in the confirm's own batch | `ImportResultCounts`, a query that waits for the projection |
| The values an import wrote that differ from its file (the Activity page) | `GET /imports/changes`, from `importChange` | A query over the same rows, which the confirm's batch writes |
| What a take-back would do now | D1 | D1: the handler reads which items changed, then sends `TakeBackImport` with how many of the created and of the replaced are kept |
| Remove refused while an item is in force | D1 | The import refuses on its own counts; the handler asks D1 first |
| Whether a SKU is already there | The unique index | The item's instance under decision 17's first option; the index under its second |

### The contract and the ports

| Today (`packages/catalog/contract/src/Catalog.contract.ts`) | Under the model |
| --- | --- |
| `PUT /imports/:id/decisions`: `SaveRequest { madeOn, over, set, clear }`, answers `{ revision, changed, notApplied, decidedSince }` | Gone. `DecideRow` and `UndoRowStep` for one row, `DecideGroup` and `UndoGroup` for an act on several; `madeOn` becomes the matching the act was made on, `changed` an empty receipt, `notApplied` the screen's reading of `MatchedSince` |
| `POST /imports/:id/commit`: `ConfirmRequest { revision, madeOn, set, clear }`, refused with `DraftMoved`, `AcceptsTakenBack`, `RevisionAhead` or `DraftBusy` | Names the last change the screen received and what it shows; carries no rows. Its handler builds the plan and sends `ConfirmImport` through `ServerApi`. `DraftMoved` becomes `ReviewMovedOn`, `PlanBehind` and `NotWhatWasShown`; `AcceptsTakenBack` cannot happen at Confirm, since the match that took an accept back is a numbered change, which the confirm must have received |
| `GET /imports/:id` | `ImportReview`, then `ImportActs`. `GET /imports/:id/table` stays HTTP |
| `POST /imports/:id/mapping`, `/take-back`, `/reopen`, `DELETE /imports/:id` | `MatchColumn`, `TakeBackImport`, `ReopenImport`, `RemoveImport` |
| `POST /imports/:id/suggest` | `RecordSuggestion`, with the suggestion pass as a saga (`SuggestOnAsk`, `SuggestionPass`; move 5) |
| `GET /imports/open`, `/imports/past` | `OpenImports`, `PastImports`, queries (move 5) |
| `GET /imports/changes`: every value the organization's imports wrote that differs from its file | A query over `importChange`, which the confirm's batch writes (move 5) |
| The four upload endpoints (`POST /imports/uploads`, `PUT /imports/uploads/:id/chunks`, `POST /imports/uploads/:id/finish`, `DELETE /imports/uploads/:id`) | Stay HTTP for the pieces; `Upload` records begun, finished and expired |
| `GET /items`, `/items/page`, `/items/facets` | Queries: every item by SKU, `ItemsPage`, `ItemFacets` (move 4) |
| `PUT /items/:id` | `EditItem` (move 4) |
| `POST /assistant/view` | The same call, answered in the model's Worker if its tools come from `toToolkit` |
| `/api/auth/*`, `GET /identity/session`, `GET /system/status` | Unchanged |

`DecisionDelta`, the draft's `revision` and `MappingChoice.at` leave. `RowDecision` stays as the schema of the text a
row's act carries; a group act carries its rows and what it does to them as two texts of their own.

**Two guards go with the writes.** Every write on `/api/v1` passes `SameOrigin` before identity. The model's Api has no
origin check of its own, so the site's Worker applies `SameOrigin` before it forwards a call or an upgrade, with a test.
A browser reaches only `MemberApi`; the service binding is the only way to `ServerApi`.

**The ports.** `ImportStore`'s writes go to the model; a new port holds the D1 batches the projections run; its reads
stay behind the queries. `ItemStore` follows decision 17. `Answerer` becomes `Suggester`. `AllowanceStore` follows
decision 26. In `packages/access`, `PeopleStore`, `MemberDirectory` and `AuditTrailStore` follow decisions 20 and 36.
The in-memory twins of what a model covers are retired for stories.

### What each table becomes

| Table | Under the model | Move |
| --- | --- | --- |
| `importDecision` and a new `importDecisionHistory` | Written by `DraftRows`, each row's decision read through its groups, and read as today and by `MySteps`; the history holds each row's acts and each group act. `savedRevision` goes: the change that recorded a decision takes its place | 3 |
| `importDraft` | Its status and its place in the acts' order written by `DraftRows`; `revision` goes; `choicesJson`, `movesJson` and `takenBackJson` are written from the columns at each match and what each took back, which the import's events hold | 3 |
| `importWriteList` | Stays for the batches that carry a long list (the confirm's plan, `DraftRows` writing a group's rows), each emptied before its batch ends, as today; no save uses it | 3 |
| `importBatch`, `importOutcome`, `importChange` | Written by the confirm's and the take-back's batches, each with its marker | 3 |
| `importReplaced`, `item` | Under decision 17's first option, written by `ItemRows` from each item's events, from move 3; under its second, by the confirm's batch | 3 |
| `importUpload`, `importUploadChunk`, `importChunk` | Unchanged; `Upload` records what happened to them | 5 |
| `importSuggestion` | Unchanged until move 8; then one import's suggestions in its own Drizzle object, with the suggestions of open imports copied in at that deploy | 8 |
| `member`, `organization` | Written by `MemberRows` under decision 20's first option; unchanged under its second | 6 |
| `activity` | As decision 36 says | 3, 6 |
| `modelCall` | Goes under decision 26's first option, with today's count adopted | 2 |

### How a stored shape changes

A host keeps an aggregate's state as one stored value and decodes it against the current schema at every command. A
state that no longer decodes makes every command to that instance fail; an event whose class is gone fails the same
way. Decision 35 sets the rule. The shapes still open (undo's depth, decision 10) are settled in move 1, before
anything is stored.

## What one large import costs, under the answered model

One file of 50,000 rows, with the sample's share of ready rows (38,750 items), reviewed and confirmed under his answers
(4, 7, 17 and 18 in particular): its rows decided by group acts and by acts on one row. Nothing was measured on
`review14`, and nothing was deployed. Each figure says what it was measured on, or that it is worked out; duration
(GB-s) is not estimated.

| One 50,000-row file | Figure | What it rests on |
| --- | --- | --- |
| One group act, any size up to 50,000 rows | 5 or 6 requests to objects: 4 (1 from the Worker, 3 between objects) and 1 or 2 for the group's entry in the domain's directory, since every group act is its group's first; a median of 95 to 214 ms | Measured in local workerd (trial 17), on the one-unit model before the last-group rule (`review12`), each an import's first group act, at loads of 36 to 60 |
| One group's undo | 4 requests to objects; a median of 64 to 191 ms | The same run |
| A row's act right after a group, the first on its row | A median of 6 requests counted in the Worker (at most 9), its directory entry included; a mean of 250 ms, a median of 127 ms, the slowest 6.2 s | The same run: 100 row acts, each the first on a row of its own, each right after one of 100 group acts of 9 rows on one import, at a load of about 45 |
| A row's act, the first on its row | 5 requests to objects, its directory entry included (a later act on a row 4); 131 and 151 ms on the mean in two runs | Measured in local workerd (trial 14), on the row-by-row model (`review11`), each act the first on a row of its own, at loads of 27 to 46 |
| Each act's delivery to `DraftRows`, the stream's append and up to three backstop alarms | 3 to 5 requests more, so 8 to 10 a row's first act, 7 to 9 a later one, and 8 to 11 a group act | Worked out from the host's source |
| Every row decided by an act of its own | 400,000 to 500,000 requests, each act the row's first; 109 to 126 minutes one after another through the import | Worked out from the two lines above |
| The same rows decided by group acts | 8 to 11 requests a group act whatever its size, so the requests follow the number of groups, not of rows | Worked out; how many groups a large file has is not known |
| 38,750 items created by the saga (decision 17) | 193,750 to at least 271,250 requests; at least 852,500 rows written | Worked out on the host page (beta.87's source) |
| The confirm, with the six consumers this brief names | About 14 to 20 requests | Worked out (decision 18) |
| Rows written by one act, by one group act, and by the projection's write of a group's rows | Not worked out | |
| Objects kept for ever | One for each decided row, one for each group act (taken back or not, each holding its rows as one text of up to 600,000 characters), one for each item and one item projection key, one for the import, and their directory objects: about 274 for the items alone; the rows' and the groups' not counted | Worked out for the items on the host page |
| D1 rows of the plan | 50,000 | |

**In all, worked out:** with every row decided by an act of its own, about 594,000 to at least 771,000 requests a file,
so at most 1.3 to 1.7 such files a month within Workers Paid's included 1 million requests, and past them $0.15 a
million, about $0.09 to $0.12 a file. With one row in five decided by an act of its own and the rest by groups, the row
acts are 80,000 to 100,000 requests, and the items' 193,750 to at least 271,250 then dominate. What the rows written
add, against the included 50 million a month, is not worked out. Under decision 17's second option the items' line goes
and a file of row acts alone is 2.0 to 2.5 files a month by requests.

**Not measured:** anything on `review14` (the last-group rule, the walk-back, the undo's `sawGroup`); a second group act
on the same import; a group's stored size; the projection's write after one group event, and the time before its rows
are read; a later act on a row already decided; the time for the items to be created (one command to one aggregate took
15 to 16 ms locally); a deployed object.

## Decisions for Benjamin

The first option of each is the recommendation, with what it rests on. One decision each, most consequential first. Each
says which earlier answers remove or change its options. Decisions 1 to 40 shape the first moves. Decisions 41 to 62 can
wait until the move that needs them. Of decisions 1 to 40, all but 9 and 24 are answered (2026-11-22), each with its
first option; 7 and 8 were answered with trials 15 to 17 before them; 9 and 41 fell away with that answer; 24 stands on
his earlier infra answer and was not asked again; 21a, a point under 21, is open, to be asked when move 6 opens. Of 41
to 62, 57 to 59 are accepted as "cannot yet" and the others wait for their move. "Proved" in a question is of the model
named beside it, as it ran.

### 1. How does the app take what exists only on the library's `main`?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected. The pin is `main@734c27a`, re-pinned only when needed (his answers of
2026-11-22), and is on main (`ea95cd0`). Every trial on the trial page ran on `dbfd0dd`. On `734c27a` the model he chose
is built on the branch `claude/alchemy-review-model-f206c6` (135 proved, 7 searched, 11 reached, by its own report), and
the per-row fallback is on `claude/alchemy-review-model-parked` (96 proved, 3 searched).

`Decision`, `Relation`, invariants, transitions, `Verify`, and commands without `target` are not on npm. The library's
registry keeps a commit's preview build one week after `main` moves past it, then deletes it (its own `policy.ttl`
and `keepLatest: ["main"]`, `packages/pkg`), and `main` took 45 commits in a week. A lockfile pins the bytes, not their
availability. So the `dbfd0dd` builds every trial installed are deleted a week after `main` moved past that commit; the
installed copies were kept outside the repository and are not part of it, and after that no reader can install them from
the registry to run the trials again. Only the `734c27a` pin is kept, as files.

- **Pin one commit's preview build, with its tarballs kept in the repository as the files the lockfile points at
  (Recommended).** Install, Verify and `alchemy dev` all ran from those builds. A clean copy installs without the
  registry. *Costs:* the Alchemy packages one local install took, about 60 MB unpacked; one pin's builds are 38.7 MB in
  the repository, measured; every move to a newer commit is a new set of files; six commits since the release break code
  written for it. Not verified: that the two infra stacks type-check on the pinned commit.
- **Vendor the built source of one commit**, with its commit and file hashes checked, as the beep-effect kit is. The
  same independence; 64 source files to keep, and the solver and parser the prover needs.
- **Follow the head of `main`, re-pinned at least weekly**, every trial run again at each move. Nothing kept in the
  repository; a clean install fails once a week has passed since the last re-pin.
- **Wait for the release that has them.** Until then nothing is proved, and decision 4's first two options cannot be
  built.

Beside the first option, not in it: no trial installed from files; every trial used the registry's addresses. The kept
builds' own manifests name their inner dependencies and peers by registry address (`alchemy` names
`@alchemy.run/node-utils` so; `@alchemy.run/domain` names `alchemy`, `@alchemy.run/cloudflare`,
`@alchemy.run/effect-cluster` and `@alchemy.run/rivet` as peers so), and bun fetches an address before it applies an
override. So the pin's 17 packages are kept as files, with each sibling address rewritten in the kept `package.json`
(fifteen files) as well as in the root `overrides`. A clean install of the build at `734c27a` (commit `ea95cd0`), with
an empty bun cache and through a proxy that refused the library's registry, installed from the kept files with no
request refused; `@alchemy.run/domain`, which no workspace there asks for, was installed the same way in a copy that
asks for it. Move 0 runs that install again in `bun run check:full`.

### 2. Two people decide the same row in the same moment. What does the second one see?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*The same options under every answer to decision 4.* His answer of 2026-11-20, "Hold it, show both, ask", is for a row
that waited, after a failed save or a reload. This asks it for a row that did not: today such a save lets the later one
win, over a decision its sender never saw (a row not named in a save's `over` is not checked, `Waited.rules.ts`).

- **The same: theirs is held, the row shows both with whose is whose, they pick one, and Confirm waits until they do
  (Recommended).** *Rests on:* that answer, "never change a value silently", and his rule of 2026-11-19 that nobody's
  decision is overwritten at Confirm; `ADecisionIsReplacedOnlyByAnActThatSawIt` is proved (trial 13) and a story shows it.
  On `review14` it is `DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt`, proved. Not proved: that the queue holds the
  act and Confirm waits (the queue's test, not run).
- **Acts merge by field.** Two people's acts on different fields of one row both stand. It needs the row to hold its
  decision in parts, the shape that passed 4,096 paths in the second round. Not run as a design.
- **The later act wins**, as today's save does, and the earlier person sees the row change with the other's name.
  `ADecisionIsReplacedOnlyByAnActThatSawIt` leaves the model.

### 3. A person saves, for a row, the decision someone else already made there. Is it theirs too?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Asked because of one case.* Dana leaves row 12 out. Ana, seeing that, leaves rows 3 and 12 out as one act. Row 12
answers "no change", so it stays Dana's alone. Dana undoes hers: row 12 is undecided, and nothing holds Ana's word for it.
His answer of 2026-11-19, "Answer says 'no change'", named "rows somebody else had just decided the same way" among the
saves that change nothing; today's store leaves the row and its author as they are.

- **No: it changes nothing, and the answer says so, naming whose it is (Recommended, as he answered).** The screen says
  whose when it has the row as it is ("row 12 was already left out by Dana"). When Dana takes hers back, the row asks
  again.
- **Yes: it is recorded over the other's as their own.** An undo by either uncovers the other's. It goes against his
  answer of 2026-11-19, and a save that repeats what is there makes its sender the one who decided it, which stops the
  first person's undo.

Beside the first option, not in it: under decision 7's answer Ana's act on rows 3 and 12 is a group, recorded whole, and
no rule answers "no change" for one of its rows. Row 12 stays Dana's only if the screen leaves it out of the group's
rows, since it already holds what the group gives; that is the screen's, not run. A row's own act answers "no change"
only when its sender says the row is not covered by a group (`covered`), which no rule checks; with `covered` set, a
repeat is recorded as the sender's, the second option's outcome. A press over a group that leaves the row reading as it
reads now is answered "no change" and is nobody's (his answer of 2026-11-22, "No change, Ana's undo applies"): the act
says so (`asItReads`), which no rule checks either; the trial model `review15` makes that change. That the screen says
whose the row is: not run.

### 4. Where do review decisions live?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Changes with decision 1:* its fourth answer leaves no option proved. *With decision 2:* its third answer takes one
rule out of every option.

- **The import's lifecycle as one instance, one instance per decided row, and every act a decision across both
  (Recommended).** *Proved:* 93 rules of the model as it would be hosted (trial 13, row by row, `review11`), listed on
  the trial page; the table under "Sketch" names the 135 of the model of his answers, `review14`. *Checked:* one
  relation, and two rules across every import and row. *At Confirm:* "nothing is confirmed that was not on screen" is
  held by three proved rules and two halves left to tests, of which one property ran, as the table says. *Two people,
  one row:* decision 2. *An undo over a row someone changed:* it takes back the rows that still hold the step and says
  which ("Undone for 11 rows. Row 14 was changed by Dana and stays"); each row's undo is its own act. *Costs:* 4
  requests to objects an act (1 from the Worker, 3 between objects), 5 on a row's first, and 131 to 151 ms an act on the
  mean in local workerd, timed on rows' first acts (trial 14, on `review11`); there every act goes through the import
  one after another, so a group of 6,000 rows is 13 to 15 minutes, worked out from that, and two people acting in the
  same moment make one of them retry (the library retries for about 20 seconds); the whole of one large import is under
  "What one large import costs". *Kept for ever:* one object for each decided row, with its acts' events and receipts.
- **The same instances, with a row taking its own commands and no decision across.** One request an act, rows in
  parallel. *Proved:* the row's rules and the lifecycle's. *Not held by Verify:* that a row is decided only on an open
  import, that an act is made on the matching now and in this opening, that a group's rows are counted, and where a
  confirm falls among the rows' acts; a row cannot see its import. His "Refuse, show, confirm again" then rests on the
  projection's order and a check in the handler, with a window between an act and its projection; it is tested, not
  proved. *Kept for ever:* one object for each decided row.
- **One instance per import.** One command an act, a group included, recorded or not as a whole. *Proved:* nothing, by
  the prover's design (a list is tried with at most 2 items more than its schema asks for, and one such command
  un-proves every rule of its aggregate). *Checked:* eight rules to 2 commands; the search stopped at its budget.
  *Costs:* the state passes 8 MiB at about 42,800 decided rows (its JSON's length, for one mix of decisions), under the
  app's 50,000-row maximum, with nothing kept under a decision for undo; an undo over a row someone changed can then be
  refused whole. *Kept for ever:* every act's event and its receipt in the import's one object.

Beside the first option, not in it: its counts and costs are of trial 13's row-by-row model. Under decision 7's answer a
group is one act, so the 13 to 15 minutes for 6,000 rows does not arise; the model of his answers, with a group instance
beside the import and the rows, is under "Sketch", and what one large import costs under it is under "What one large
import costs".

### 5. Do a confirm and a take-back stay one write?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Today each is one atomic D1 batch, a written rule of the app (`docs/standards/undo.md`; "one atomic write" in
`CLAUDE.md`). An object's commit and a D1 batch cannot share a transaction. *Changes with decision 4:* under every
option there, a confirm the import records is a fact first and its writes after.

- **The confirm and the take-back become facts on the import, and their writes land after (Recommended).** *Rests
  on:* it is the only way the import can order the confirm among the acts, which is what proves "nothing is confirmed
  that was not on screen". *What the person sees:* before the command, nothing is confirmed and an unused plan is
  swept; after it, the Result step says "Writing your items" until it can count from what is stored; a take-back
  waits behind a confirm whose write has not landed. It reverses the written rule, and `undo.md` and `CLAUDE.md` are
  rewritten in move 3.
- **Each stays one D1 write; the import does not record the confirm.** The confirm's batch checks D1's place in the
  acts' order against what the screen names. The confirm and take-back rules of the import leave the model, and
  his confirm rule is tested, not proved, with the projection's lag as its window.

Under decision 17's answer nothing yet makes a take-back wait for the confirm's items, so the first option's "a
take-back waits" has nothing behind it yet; decision 17 says what is not held. A design for the wait, not run: the item
saga, once every item of a confirm is answered, records an event on the import that names the confirm's plan
(`ItemsWritten`); `ImportConfirmed` names the plan's id, so that event says which confirm it closes; and
`TakeBackImport` is refused (`ItemsStillBeingWritten`) while the last confirm that stands has no such event, a rule of
the import over its own numbers. The names are proposed.

### 6. The stored items changed since the screen was drawn, so Confirm would do something else than its button says. What happens?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Two imports of the same file are open, each saying "Import 155 items". One is confirmed; the other's 155 are then already
there. Nothing of the second import changed. Today it is confirmed, with other outcomes than were shown.

- **It is refused, the screen shows the new counts, and the person confirms again (Recommended).** *Rests on:* his rule
  of 2026-11-19, "nothing is confirmed that was not on screen". *Proved:* `APlanDoesWhatWasShown` (trial 13), of two
  digests the command states. What they cover (a stored item edited since that a row replaces, included) is a test, not
  run. Between the plan and its write the write's own statements hold, as today.
- **As today: it is confirmed, and the result says what it did.**

Beside the first option, not in it: on `review14`, the model of his answers, `Import.APlanDoesWhatWasShown` is proved,
and on the build's branch at `734c27a`.

### 7. How is an act on a group of rows carried?

**Answered 2026-11-22: the first option**, the group as one unit ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected. Decision 8 is answered with it; decisions 9 and 41 fall away.

*Asked under decision 4's first option, as answered.* Accepting a fix for a group is the review's main act. The sample's
groups have up to 9 rows; a large file's can have thousands.

- **The group is decided as one unit (Recommended).** One instance for each decided group: its rows and what the act
  does to them as two texts, who made it and the number of its change. One act, recorded on the import and the group or
  on neither; its undo is one act. A row's decision is read from the row's own instance and the groups in force that
  name it. *Proved* (trial 15, of that model, `review12`): 123 rules, all four decisions, with 42, 82, 152 and 292
  paths; a group is taken only from a screen that names the import's last change, in this opening, on the matching now;
  only its maker takes it back, once, and not past a confirm that stands; a row's act names the import's last group act.
  *Checked*, 3 commands deep: six rules across every import, row and group. *Measured* in local workerd (trial 17): one
  act for 6,000 rows a median of 214 ms and its undo 191 ms, for 50,000 rows 95 and 64 ms, at loads of 36 to 60; no size
  refused. *By a property, not by a rule* (trial 16): the reading of a row's decision equals today's `act` after every
  action of 50,000 generated sequences, when the group's rows are split by exactly what each got; with one patch for the
  whole group it does not. That run was one person, on a fold written for the trial and not the model's code; its redo
  marked the undone group live again under the same number, and it took groups back at any depth. The run for two
  people, on a copy of `review14`'s rules, is under "The reading of a row through its groups". *By a story, not by a
  rule:* an act with the same text on a row a group covers is a change. *What the person sees:* the group is saved at
  once; Confirm does not wait for it; another person's act made before the group reached their screen is sent again by
  itself on a row the group does not touch, and held and shown with both on a row it touches (his later answer of
  2026-11-22), not run; a group pressed on a screen that is one change behind is refused and pressed again. *Not run:*
  the screen that computes a group's rows, the screen and the projection that read a row through the groups, what a
  match does to a group in force, and the projection's write of 6,000 rows after the one event. *It asks one more
  thing:* which group may be taken back (decision 8).
- **One act per row under the group's step, sent by a saga, with the import counting its rows.** *Proved* (trial 13): no
  confirm and no remove is taken while a group is being sent, by anyone; no second group begins; its rows are answered
  one at a time, a refused one included, or it is stopped; a row of a group that is not being sent is refused, of an undo
  of a group too. A confirm that names a change before the group's last is refused; that a screen names the last change
  truly is held by a property on a copy of the screen's rule and a story, not by a rule. *By a story and the code of
  `decide`, not by a rule:* no match and no take-back is taken meanwhile. *What the person sees:* their own screen shows
  the whole group at once, as its own acts, with "saving 2,340 of 6,000"; others see the rows change a few at a time;
  Confirm waits; their own later acts wait in their queue until the group ends. *Costs:* 131 to 151 ms an act on the
  mean in local workerd (trial 14), so 13 to 15 minutes for 6,000 rows, worked out; undoing the group is as many acts
  again. *If it stops:* the saga sends the rest when it runs again, or it is stopped (decision 9). The saga was not run.
- **Both: a group under some size row by row, a larger one as a unit.** *Proved* (trial 15, `review12mix`): the two
  together, with 44, 86, 476 and 2,652 paths; a unit is refused while a group is being sent. Two ways to save the same
  act, each with its own rules and its own undo, and decision 41 sets the size. Nothing else of it was run.

Beside the first option, not in it: the 123 rules and the six rules across instances are of `review12`; on `review14`,
the model of his answers, 135 rules are proved and seven checked 3 commands deep, and the build's branch gives 135
proved and 7 searched on `734c27a`.

The 214 ms and 95 ms were each the first group act on a fresh import, 20 runs a
size, on `review12`, before the last-group rule, and were not run again on the model with it; for 6,000 rows the mean
was 408 ms and the slowest 3.4 s. In that run every group's rows were one part with one patch for every row
(`{"flags":"out"}`), built by the trial's driver; a group whose rows got different patches was not timed. The time did
not grow with the rows: 50,000 rows took less than 9, at the run's highest load; the run does not show why. A later
group on the same import, a group's stored size and the projection's write were not measured. In the same run a row's
act right after a group, each the first on its row, took a mean of 250 ms (median 127 ms, slowest 6.2 s) and 6 to 9
calls counted in the Worker (median 6, 95th percentile 8; from the run's output, not printed on the trial page). *Kept
for ever:* one object for each group act, undone ones too, each holding its rows' text.

A group's rows and what it does to them are on the group's own events (`GroupDecided`, and `GroupUndone` for its undo);
the import's event for a group act (`GroupCounted`) carries only a count. So `DraftRows`, the history and the confirm's
plan read the group's events beside the import's, and nothing orders the two sources; what the confirm's handler waits
for when the last change is a group act is not written. Not run. A row's undo, like a row's act, names the import's last
group act and is refused when a group landed that the sender's screen had not received (his answer of 2026-11-22;
`UndoRowStep.ARowsUndoSawTheLastGroupAct`, proved on `review14`). A row's act answers "no change" only when its sender
says no group in force covers the row (`covered`), or that the act leaves the row reading as it reads through its groups
(`asItReads`, his answer of 2026-11-22, "No change, Ana's undo applies"; in the trial model `review15`), neither of
which a rule checks; a group act is recorded whole, so it answers "no change" for none of its rows; decision 3's answer
and "Answer says 'no change'" then rest on the screen leaving out of a group the rows that already hold what it gives.
Not run. Decision 11's example comes out otherwise under it: Ana's
act on 12 rows is a group, and once she has taken it back it gives no row anything, so when Dana undoes her quantity row
14 is undecided (his answer of 2026-11-22, "Undecided: Ana took it back"); decision 11's answer stands for single-row
acts.

### 8. Which group may be taken back?

**Answered 2026-11-22: the first option**, only the import's last group act ([DECISIONS.md](DECISIONS.md), "Answered").

As answered, it is read as the last group still in force (`topGroup`): an earlier group is refused with `GroupedAfter
{ last }`, and once the later one is taken back the earlier is the last in force again, so undo walks back. Proved on
`review14`: `UndoGroup.OnlyTheLastGroupInForceIsTakenBack` and `.ThenTheOneUnderItIsTheLastInForce` (`UndoingGroup`,
84 paths).

*Asked under decision 7's first answer, the group as one unit. Under its second answer the question was another, "While
one person's group is being sent, what can the others do?", kept below and not asked.*
Ana accepts a fix on 2,340 rows; Dana then accepts another on 900, some of them the same rows; Ana undoes hers.

- **Only the import's last group act; an earlier one is refused and says which came after (Recommended).** *Proved*
  (trial 15, `review12last`): `OnlyTheLastGroupActIsTakenBack`, 84 paths. On `review12last` a group's undo counted as
  the last group act too, so once Dana had taken hers back Ana's was refused for good. The walk-back above, as it was
  put to him, is `review14`'s: `UndoGroup.OnlyTheLastGroupInForceIsTakenBack` and `.ThenTheOneUnderItIsTheLastInForce`,
  84 paths, and story G7. The undo is then exact for one person, as today's `act` undoes only the last step too; with
  two, a row someone decided over the group keeps its effect after the undo (under "The reading of a row through its
  groups"). Ana takes hers back after Dana takes back hers, or decides the rows again.
- **Any group of one's own.** The rows that got a decision of their own since keep what the group did; the others lose
  it; later groups are applied again on what is left. Exact only where what a later act did does not rest on the group:
  an accept pressed because the group had made the proposal stays accepted (trial 16, two cases written by hand).

*Under decision 7's second answer, one act per row, which he did not take, and so not asked:* Ana accepts a fix on
2,340 rows; Dana matches a column, or begins
a group too, before it is over.

- **Decide and undo single rows; a match, a second group, a confirm, a take-back and a remove wait and are sent when it
  is over (Recommended).** *Proved:* `OneGroupAtATime`, `NothingEndsAReviewWhileAGroupIsSent` (trial 13); that a match
  and a take-back are refused with `GroupUnderWay`: stories and the code of `decide`. *What the person sees:* "Ana is
  saving 2,340 rows; yours goes next". *Rests on:* a match between two of its rows would refuse the rest of them.
- **Groups side by side.** The import holds a list of groups; a decision that meets a list is checked, not proved. Not
  run.

### 9. Who may stop a group act whose sender no longer can?

**Not asked: it fell away on 2026-11-22** with his answer to decision 7. Under the group as one unit there is nothing to
stop: a group is one act.

Under decision 7's second option, not taken: a person begins a group and then loses the editor's role, leaves, or their
saga dies, and until the group is over nobody can confirm, match a column or remove the import.

- **Its sender, or an admin; the rows not sent are counted on the import, where a confirm has to have received it
  (Recommended).** *Proved:* `AGroupIsStoppedByItsSenderOrAnAdmin`, `AGroupIsAnsweredRowByRow` (trial 13). Which rows
  were not sent is the saga's to keep.
- **Any editor.**
- **The import itself, after the time decision 41 sets**, as a deadline. Not run.

### 10. How deep does an undo reach on one row?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Asked under decision 4's first or second option.* The app's standard today is every step, one at a time, in the
order it was made.

- **Every step, exactly, with everything below the first level sealed into one text (Recommended).** The row keeps the
  decision under the current one in full and the rest as a sealed text. An undo brings the level it uncovers, and the
  row takes it only when it seals to the text it holds. No trust in who sends it. *Proved* (trial 13):
  `AnUndoPutsBackTheDecisionThatWasThere` and its parts, `WhatLiesUnderIsWhatWasRecorded`. *Tested:* that a seal can be
  read back, as a property over 2,000 random single levels, each sealed over a random text. *Limit:* past about
  1,000,000 characters of history on one row the next act keeps only the decision it replaces, and an undo stops after
  that one and says so. A hash in place of the text cannot be proved: the prover "loops a number of times that depends
  on an input".
- **Every step, with the undo sent by the server alone, which reads the deeper levels from the row's history.** Nothing
  is kept in the row past the first level. *Proved:* who sent it. *Not proved:* what it carries; the same rule, run on
  that model, is refuted. The content rests on the handler and the projection.
- **Every step, held in the row's state as a list.** Exact at every level. Every rule of the review drops to checked,
  the lifecycle's included, because a decision whose path meets a list is checked for every rule of every aggregate it
  reads. Not run.
- **One level.** A second undo on the same row leaves it with no decision, and says so. All proved. It changes the
  app's standard.

Beside the first option, not in it: on `review14`, the model of his answers,
`UndoRowStep.AnUndoPutsBackTheDecisionThatWasThere` and `.WhatLiesUnderIsWhatWasRecorded` are proved, and on the build's
branch at `734c27a`.

### 11. A decision its maker took back lies under another's. When that one is undone, does it come back?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

The answer stands for single-row acts. A group its maker took back lays its patch on no row (his answer of 2026-11-22);
a row decided over it keeps that decision whole, the group's effect included, until it is undone ("Row 14 stays whole"),
so in the example below, where Ana's act is a group, row 14 keeps the group's effect between Ana's undo and Dana's, and
ends undecided after Dana's; the "Proved (trial 13)" beside the first option is of a row's own levels.

Ana leaves 12 rows out as one act. Dana, seeing that, types a quantity on one of them, row 14, instead. Ana undoes the act:
11 rows are undone, and row 14, which is Dana's now, stays. Dana undoes the quantity. Is row 14 left out again, as
Ana's, who took that back?

- **Yes: an undo puts back exactly what was under it, whose it was, and the screen says so ("Row 14 is left out again, as
  Ana had it") (Recommended).** *Rests on:* undo today is exact. *Proved:* `AnUndoPutsBackTheDecisionThatWasThere`,
  `AsTheirsWhoMadeIt` (trial 13). Ana sees the change and can undo it.
- **No: what its maker took back while it lay under is passed over.** The row would have to mark a level as taken back,
  inside a text it only compares, so its seal would have to be brought for that too. Not run.

Beside the first option, not in it: on `review14`, the model of his answers,
`UndoRowStep.AnUndoPutsBackTheDecisionThatWasThere` and `.AsTheirsWhoMadeIt` are proved, of a row's own levels, and on
the build's branch at `734c27a`.

### 12. Can an undo reach past a confirm that stands?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

A person types a quantity on row 12; the import is confirmed and opened again to fix other rows; they undo the quantity.
The stored item has it, and a second confirm counts the row as already there. The same question for row 7, left out
before the confirm and not imported: after "Fix 45 not imported", the undo of that leave-out.

- **No, for both: it is refused as decided before the last confirm. The row can be decided again, the item edited, or
  the import taken back (Recommended).** *Proved:* `AnUndoDoesNotReachPastAConfirm` (trial 13).
- **No for a row the confirm imported, yes for one it did not.** The import holds no rows, so the row has to learn at the
  confirm that it was imported: one act more on each imported row. Not run.
- **Yes: the decision is taken back and the item keeps the value.**

Beside the first option, not in it: on `review14`, the model of his answers,
`UndoRowStep.AnUndoDoesNotReachPastAConfirm` and `UndoGroup.AGroupsUndoDoesNotReachPastAConfirm` are proved, and on the
build's branch at `734c27a`.

### 13. An act made before a confirm arrives after the import was opened again. Is it taken?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Ana's "leave out" waits while she is offline. Dana confirms, and opens the import again. His answer of 2026-11-20 for a
closed import was "Name the rows, then drop them"; it did not speak of one opened again. The same for an undo, a match
or a group made before the confirm.

- **No: it is refused and the screen names the row, as for a closed import (Recommended).** *Proved:*
  `AnActIsOfThisOpening`, `AnUndoIsOfThisOpening`, `AMatchAndAGroupAreOfThisOpening` (trial 13).
- **Yes: it is recorded on the row**, whose item may already be in the system.

Beside the first option, not in it: on `review14`, the model of his answers, `DecideRow.AnActIsOfThisOpening`,
`UndoRowStep.AnUndoIsOfThisOpening`, `Import.AMatchIsOfThisOpening`, `DecideGroup.AGroupIsOfThisOpening` and
`UndoGroup.AGroupsUndoIsOfThisOpening` are proved, and on the build's branch at `734c27a`; a story: "a match, a group and an undo made before a confirm are not
taken after the import is opened again either".

### 14. What is a keep of one of two rows, when someone decides the other row meanwhile?

**Answered 2026-11-22: the first option**, one act on the kept row ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected. It was put to him as not run.

The design is his answer: the keep is one act on the kept row, and nothing is written on its rivals. `review`, the pure
rule, leaves out each row that shares the kept row's SKU, with the reason, for as long as the keep is the kept row's
decision; when the keep is undone or replaced, each rival is read from its own decisions again. A decision someone makes
on a rival meanwhile is a decision on the rival's row, and `review` reads it with the keep: as the rule is written, the
rival stays left out with the reason naming the kept row, and its own decision stays on its row and counts again only
once the keep is gone. Three later answers of his (2026-11-22, [DECISIONS.md](DECISIONS.md), "Answered": 14a, 14b and
"As today, never overwrite a choice") change that. The rule for a rival, in three cases, with rows 4 and 10 sharing a
SKU and Ana keeping row 4:

- **(a) A rival with no decision, or whose decision is only accepted fixes, a person's or a group's: the keep leaves it
  out, as today.** Row 10 had only its unit fix accepted, by Dana or by a group; Ana's keep leaves row 10 out with the
  reason naming row 4. A rival already left out stays left out.
- **(b) A rival someone kept, or edited (typed a value into), before the keep: not overwritten.** Dana had typed 8 in
  row 10's Quantity before Ana kept row 4: row 10 keeps Dana's decision, the review shows the clash again as needing a
  decision, naming Ana and Dana, and neither row imports until it is settled ("As today, never overwrite a choice"). A
  rival someone decides after the keep takes that decision (14a, "Yes, and a clash is shown again"): a clash is shown
  only when that would import both rows with one SKU, so if Dana leaves row 10 out after the keep there is no clash and
  row 4 imports. Whether a decision after the keep that is only accepted fixes counts as one, or leaves the rival out as
  under (a), was not asked: open ([DECISIONS.md](DECISIONS.md), "Open").
- **(c) Two keeps of one SKU: a clash, naming both people.** Ana keeps row 4 and Dana keeps row 10, at once or one after
  the other: both keeps are recorded, the review shows the clash naming both, and neither row imports until it is
  settled ("Both kept, clash shown again").

No row is left out that nobody chose to leave out, and no choice someone made is overwritten. This changes the rule
`review` applies to rivals. Today's keep (the `keep` action in `packages/review/src/ReviewDraft.rules.ts`) writes a
leave-out onto each rival, as a row of the same act, unless the rival's decision is a person's (`decidedByPerson`: left
out, kept, or with a typed value), and skips such a rival without a word ("Row kept, 1 copy left out" counts only the
rivals it wrote). The new rule writes nothing on a rival: `review` leaves a rival of case (a) out by rule while the keep
is the kept row's decision, and reads it again from its own decisions once the keep is gone; a rival of case (b) or (c)
is no longer passed over in silence but shown as a clash with both names, and holds both rows back. It is in no model
and not run. An alternative, not chosen: a unit of two parts, the kept row and its rivals, which writes the leave-out on
the rivals.

Today "keep this row" also leaves its rivals out, as separate rows of one act. Sent row by row, it can be taken in part:
row 10 is left out, then Dana leaves row 4 out so that row 10 goes in, then Ana's keep of row 4 is refused. Both are left
out, which neither chose. It is on screen at Confirm, and both rows read as decided.

- **The keep is one act on the kept row, and `review` leaves its rivals out by rule, with the reason (Recommended).** It
  cannot be taken in part. It changes `review` and what a rival's row says. Not run.
- **One decision across the rows that share the SKU, taken whole or refused whole.** For two rows a decision reads three
  instances; for more it reads a list, which the prover tries with 2 items and does not prove. Not run.
- **As today, row by row**, with the refused row named to its sender.

### 15. Is a column match refused when its sender has not seen the last one?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

- **Yes: refused, the screen shows the column as it is now, and they choose again (Recommended).** *Rests on:* "never
  change a value silently". *Proved:* `AMatchIsMadeOnTheLastOne` (trial 13). The same column again changes nothing.
- **As today: the last match wins**, and the accepts of the one before it are taken back.

Beside the first option, not in it: on `review14`, the model of his answers, `Import.AMatchIsMadeOnTheLastOne` is
proved, and on the build's branch at `734c27a`.

Beside the second option, not in it: today a match also takes back a Replace, a Keep-stored, a keep of one of two and an
undone fix on its field, not only accepts.

### 16. Is Remove refused when its sender has not seen the import's last change?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Today Remove names nothing it saw, and deletes every decision on the import.

- **Yes, and while a group is being sent (Recommended).** *Proved:* `TheRestNameEveryChangeToo`,
  `NothingEndsAReviewWhileAGroupIsSent` (trial 13).
- **As today.**

Beside the first option, not in it: under decision 7's answer no group is ever being sent, and the model of his answers
has no `NothingEndsAReviewWhileAGroupIsSent`. A group act is a numbered change, so a remove whose screen has not
received one is refused by `Import.TheRestNameEveryChangeToo`, proved on `review14` and on the build's branch.

### 17. Is an item an aggregate whose rules Verify holds?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Changes with decision 5:* under its second answer, only the second option here.

- **Yes: every item is its own instance, its record held as text (Recommended, by the first rule of this brief).**
  *Proved:* ten rules, replace and restore included: a second create changes nothing; a replace, an edit, a restore and
  a removal each only on the version they name; a restore puts back exactly the text and version replaced, so take-backs
  in turn walk back through up to ten replaces. A saga keyed by the confirm creates, replaces, restores and removes
  items in pieces, since one invocation cannot send 38,750 commands (10,000 subrequests by default; whether a call to
  another object counts as one is not verified). *What the person sees:* items arrive over minutes, the Result step
  counts up, the Items page can show part of an import, a take-back goes item by item and names what it kept; a row
  whose item another import created in between changes nothing, and the Result step, which reads what is stored, counts
  it as already there. *Costs:* 5 to at least 7 requests an item (arithmetic, beta.87); for 38,750 items 193,750 to at
  least 271,250 requests and about 852,500 rows written. *Kept for ever:* one object per item and one projection key per
  item. *Lists:* with tags and vendors as lists the rules drop to checked; they stay inside the text.
- **No: items stay rows that one batch writes per confirm.** A confirm's items land together; the item's rules stay
  held by SQL and its tests; the item edit stays a guarded write. *In the way of both at once:* an edit and a
  take-back must be decided against one store in one step; nothing in the library does that across an instance and
  D1.

Beside the first option, not in it: the 852,500 rows written are at least that, since the host page's 22 rows an item
leave several more uncounted. With items as objects nothing in the model holds that a take-back waits for the confirm's
items, which decisions 5 and 19 say it does: `TakeBackImport` is taken whenever a confirm stands and its sender names
the last change, and the import records no event that says its items are written, while the saga creates them over
minutes. The import's counts (`ImportConfirmed`'s, what it holds in force, a take-back's removed and kept) are what the
handler stated, so the rules proved of them, `ATakeBackIsOfEverythingInForce` and `OutcomesAddUpToTheRows` among them,
are of stated numbers; once a row's item is created by another import in between, what is stored differs from them, and
no command corrects them. `ImportConfirmed` does not name the plan it confirmed. What makes a take-back wait, and which
number a notice or the history carries, are not written. Not run.

### 18. What does a confirm write, and from what?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Changes with decision 17:* under its first answer the plan is what the item saga reads.

- **A plan staged in D1, built at the import's last change (Recommended).** The handler waits for `DraftRows` to reach
  the last change, runs `review` on those rows, stores the plan with that change, and sends one `ConfirmImport` naming
  it; the import refuses a plan of another change (`APlanIsOfEveryChange`, proved, trial 13). *Rests on:* one command
  and one event whatever the size; about 14 to 20 requests, worked out, with the six consumers this brief names (4 for
  the command, its first delivery and two alarms, on the host page; 2 to 3 more for each further consumer). *Costs:* the
  rows are in D1, not in the events.
- **The events carry the rows, in parts of 1,000, sent by a saga.** *Gives:* the events are the whole truth.
  *Costs:* 104 to 204 requests and about 60 MB kept for ever for a 50,000-row file (worked out, not measured);
  "Importing, part 23 of 51".

Each batch carries a marker: one row keyed by the event it was given, inserted as the last statement of the same
batch, with every other statement conditional on its absence.

### 19. What happens when a confirm's write keeps failing?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

- **The import stays confirmed and the write keeps being retried; the Result step says "still being written, nothing
  is lost", an alert fires on the projection's retry log, and a take-back waits (Recommended).** Nothing the person
  decided is lost; an operator fixes the cause.
- **After it has failed for a set time, the server opens the import again with every decision in place**, takes back
  any item already written, and the person reads "Nothing was imported; confirm again". The import never stays
  confirmed with nothing in it; the set time is a number he gives.

Beside the first option, not in it: under decision 17's answer nothing yet makes a take-back wait, so its "a take-back
waits" has nothing behind it yet; the wait is designed under decision 5, not run.

### 20. Which record of who is a member, with which role, is the record?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Today it is Better Auth's `member` table in D1, which every request reads to build the actor.

- **An `Organization` aggregate and one `Member` instance per member are the record; adding, changing a role and
  removing are decisions across the organization, the member and the sender's own member record (Recommended).**
  *Proved:* 19 rules, among them that an organization always keeps an admin and that an admin is changed only by an
  admin in the record, so a demoted admin is refused at once. *Checked:* that the counts equal the members. A
  projection writes the `member` rows the session reads. *What the person sees:* the session's role lags the record
  until its row lands, so a person demoted from editor can still decide rows for that moment; an admin command
  checks the record and does not lag.
- **Better Auth's table stays the record.** People's writes stay guarded statements with their audit line in the same
  batch; the rules leave the model.
- **The record as in the first option, and the session reads the role from a view of it.** The lag is shorter (a
  view is updated after the commit too), and every request reads one object; Better Auth's own screens that read
  `member` still need the rows written.

The 19 proved rules are of trial 10's model: four decisions, `FoundOrganization` among them, a person added by member
id, and no email claim. The model this brief builds adds the `MemberEmail` claim to `AddMember`, proved only in trial 6,
on an earlier model; the two together were not run, nor whether removing a person frees their email. Move 6 proves the
model with the claim and the founding before any count is asserted.

### 21. Are Better Auth's own writes to `member` closed?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Asked under decision 20's first or third option.*

- **Closed: the People page's commands are the only way to change a member, and Better Auth's organization endpoints
  that write are turned off (Recommended).**
- **Sent through commands by a hook on Better Auth's writes.** Better Auth's screens keep working; the hook is ours to
  keep working across its changes.

Closing them ends today's only way to found an organization: the sign-up form and "Create your organization" both call
Better Auth's organization endpoint. Who founds one is open: 21a under "Open" in [DECISIONS.md](DECISIONS.md), asked
when move 6 opens. The design proposed for it, not his answer: a `FoundOrganization` command on `AdminApi`, sent by the
operator for an account that exists (his infra answer I8, 2026-11-19, "Close sign-up; I add accounts", closes sign-up),
which becomes its first admin. The trial's `FoundOrganization` is refused unless the session already says admin of that
organization, so who is its actor when no member row exists is written in move 6. Not run.

### 22. What does a removed person's open page receive?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected. It was put to him as not run.

A live read keeps the actor it connected with.

- **Nothing more: every pushed change is checked against the member record, so it stops at the next change
  (Recommended).** Not run.
- **What is pushed until the socket drops.**

### 23. Is a Discord sign-in with an unverified email accepted?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Before move 6, since an admin adds a person by the email they signed up with.* Someone could create an account with
a colleague's address and be added in the colleague's place.

- **Refused: the account is not created (Recommended).**
- **Accepted as the account's address.**

### 24. Can a person with no account be invited?

His answer infra I8 (2026-11-19) was "Close sign-up; I add accounts". It stands unless he says otherwise.

- **No (Recommended).** Only a person who has an account is added.
- **Yes**, by opening sign-up to invited addresses. It reverses infra I8.

### 25. When do the 40 model calls come back?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Today a call comes back 24 hours after it was used (`ModelAllowanceGateway`: "in any 24 hours"); no answer of his set
that window.

- **At 00:00 UTC each day (Recommended).** *Proved:* seven rules, with no reset command and no cron: the first call of
  a new day starts the count at 1, held as a day number. *What the person is told changes:* "back at midnight UTC",
  and up to 80 calls fit in the two minutes across midnight.
- **24 hours after each was used, as today.** The rule is checked, not proved, because the times of the day's calls
  are a list in the state.

The seven proved rules are of trial 9's aggregate, which has one command, `TakeCall`. The count adopted in move 2 and
the `AdoptDay` of move 7 set a day's count by a command, which breaks `ANewDayStartsAtOne` and
`WithinADayTheCountRisesByOne` as written; both are rewritten to except adoption and proved again with it, in the move
that adds it. Under this answer the count move 2 adopts is of the calls since 00:00 UTC that day. Not run.

### 26. Where does the model-call allowance live?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Changes with decision 25:* the first option is proved only under its first answer.

- **An aggregate per organization (Recommended).** Its view feeds the admin's live page.
- **An entity on Effect Cluster's pool.** The rule leaves the model.
- **A Drizzle table in one object per organization, behind `AllowanceStore`**, with a take that is a real
  transaction. The rule leaves the model.

### 27. Which model runs on which host?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Changes with decisions 20 and 26.* Nothing hosted on Effect Cluster's Durable Object pool can reach D1. Its gateway is
a public `workers.dev` address behind one token, with no option to turn it off.

- **`Catalog` and `Access` on Durable Objects; `Usage`, the allowance and its view, on the Cluster pool
  (Recommended).** Both hosts are used and the same model runs on three. *Costs:* the gateway, which he would accept
  for production; 2 MiB a persisted value there. *Needs* decision 26's first answer. `Usage` is first hosted on
  Durable Objects in move 2 and moves in move 7 with an `AdoptDay` per organization carrying the day's count; the
  classes left on the model's Worker are kept, never renamed or dropped. Not run.
- **Everything on Durable Objects.** Cluster then hosts nothing, and decision 28 has no use.
- **`Access` on the pool.** *In the way:* its projection cannot write the `member` rows; it needs decision 20's third
  answer and mail sent from another Worker.
- **Effect Cluster on Postgres runners. Cannot yet:** no Postgres and no runner pool in this deployment.

### 28. What runs on the Cluster pool as a cron or a singleton?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected. It was put to him as not run.

*Asked under decision 27's first answer.* The allowance by day needs no reset, so the pool's scheduled work has to be
work of its own. Work that needs D1 cannot run there.

- **A cron that closes each organization's day of model calls into a history the admin's page shows, and a
  singleton that keeps the operator's live total across organizations (Recommended).** Each organization's first
  call of a day registers it with one registry entity on the pool, which is the list both read. Not run.
- **The cron only.**
- **Neither: "cannot yet" written down**, with the limit (nothing the app schedules lives only on the pool). He ticked
  singletons; this leaves them unused.

### 29. What is deployed: one Worker or two?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

The Durable Object host needs an Effect-native Worker; the app's Worker is a plain module built with the screens.

- **A second, Effect-native Worker beside the site's, reached by a service binding (Recommended).** The site stays
  `Cloudflare.Website.Vite`, his answer infra I1 (2026-11-19).
- **One Effect-native Worker that hosts the model, serves the API and serves the screens as assets.** One origin and
  one deploy. It reverses infra I1, which rejected "`Cloudflare.Worker` with assets".

### 30. What does `bun run dev` start?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

- **`alchemy dev` for both Workers and the screens' server beside it (Recommended).** `alchemy dev` ran a model on
  Durable Objects in local workerd with no login, ready in about 5 seconds, and ran the decision across two objects.
  Not verified: two Workers and Vite side by side, that it applies the D1 migrations `predev` applies today, that
  objects survive a restart, that a forwarded request keeps the session cookie.
- **The model in memory under `vite`.** Nothing changes in how the app is started; a restart loses decisions while D1
  keeps the import, and two people on one import cannot be looked at locally.

### 31. Do the screens call the model's Api, or stay on `/api/v1`?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Changes with decision 29:* under its second answer there is one origin.

- **They call the model's Api: typed calls for commands, the stream for what is pushed (Recommended).** A group leaves
  `/api/v1` when its screen moves; uploads, the staged table, sign-in and the status stay. *Rests on:* the Review step
  needs the pushed stream either way. *What the person sees if it fails:* the same sentences, from `sayError`.
- **They stay on `/api/v1`, every endpoint a thin handler that sends the command as the person.** One public contract
  and OpenAPI document. The pushed stream then needs its own route beside the contract; polling would show another
  person's act up to a poll late.

### 32. Where do an aggregate's blocks live?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

The prover reads a block built with `new`, a function called, or a request context yielded only through a relative
path; an id or value schema may come from another package.

- **In the context's `model` package, one folder per aggregate, each model's package declaring its own
  `CurrentActor`; ids and value schemas stay in `contract` (Recommended).** The kernel's `CurrentActor` stays, under
  its name, for `/api/v1`; one session lookup fills both. His answer of 2026-11-18 ("Keep it, names unchanged":
  `CurrentActor` moves into the kernel as it is) stands for the kernel's; the model's is a second declaration of the
  same name. A `Domain.Command` takes `.command.ts`; a payload left in `contract` becomes `.payload.ts`.
- **Everything in `contract`.** The aggregates and their rules leave `model`.
- **Leave the blocks split and wait for the prover to follow package imports.** Until it changes, nothing split that
  way is proved.

### 33. Are domain blocks built with `new`?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

The house rule is `.make`. The prover reads `new Event(…)` in `decide` and not `Event.make(…)`.

- **`new` in files that hold a `decide`, with that one diagnostic off by the file's first line (Recommended)**: files
  named `*.aggregate.ts` and `*.decision.ts`.
- **`new` for every domain class.**
- **`.make` everywhere.** Until the prover changes, no rule of a `decide` written that way is proved.

### 34. Where does Verify run, and what fails the build?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The others
are kept below as what was rejected. Where in CI each model's search runs he answered later the same day (34a): "Own job
+ nightly, no new infrastructure".

What holds each rule's standing he answered first as "The library's lock file", then, told that at the pin the lock
keeps each rule's text and not its standing, as "Lock plus the library's proved list" (2026-11-22): the lock catches a
rule removed or reworded, and `require.proved` fails the build when a named rule is no longer proved. Both are options
of Verify's reports (`Verify.report`, `Verify.model`, `Verify.aggregate`); `Prove.report` and `Prove.decisionReport`
take neither. So in `bun run check`, on the build's branch `claude/alchemy-review-model-f206c6`, the `prove` task's five
tests (`Prove.report(Import)` and `Prove.decisionReport` of `Deciding`, `Undoing`, `DecidingGroup` and `UndoingGroup`)
fail on any rule their report does not give as proved, and a decision's test also fails when it leaves out a rule on who
may change a row or a group; which rules there are is the lock's: it acts in `check:full` and CI, where
`Catalog.verify.test.ts` runs `Verify.report` with `lock: "./Catalog.lock.json"`, so a rule taken out or renamed is not
caught in `bun run check`. That test passes no `require` yet: it asserts each rule's standing from its kind. Which call
asserts the import's own rules in `bun run check` the build settled as `Prove.report(Import)`, which proves its 37 rules
for each of its seven commands and leaves the two events only the decisions record to their tests.

Measured on trial 13's row-by-row model (`review11`, the fallback he parked), each with the machine's load average
beside it: `Prove.decision` proves
`Deciding` in 25 s (load 26 to 33) and `Undoing` in 284 s (load 48 to 26); `Verify.aggregate` of the lifecycle alone
ends `NotVerified` in 5 s (load 49 to 48), because the lifecycle folds `ActCounted`, which only a decision records, so
its report must pass the two decisions in `decisions`; `Verify.model` verified in 461 s at a load average of 33 rising
to 56. A quiet machine was not at hand. Two decisions declared in one file and passed to one report fail with a
`ProveError` (the library loads the file before it adopts the second decision); that one decision a file avoids it is a
reading of the source, not run.
`bun run check` goes through turbo, which replays a package's result until something it reads changes.

- **The decisions' and aggregates' proofs in `bun run check`, each model's search in `check:full` and CI
  (Recommended).** About 5 minutes more, worked out as the sum of the three, before a commit that changes the review's
  model, and nothing before any other. Every test asserts each rule's standing by name; a rule that slips from proved to
  checked fails before the commit, and only the relations and model rules wait for `check:full`.
- **All of it in `check:full` and CI only.** `bun run check` stays as fast as today; a broken rule is seen later.
- **All of it in `bun run check`.**

Beside the first option, not in it: the 5 minutes is of trial 13's model and adds a 5 s run that ended `NotVerified`. On
the model with a group as one unit (trial 15) no report with decisions passed was run: the lifecycle and the group alone
end `NotVerified`, and the row and the group have no commands of their own; its decisions took under 1 s to 22 s and
`Verify.model` 114 to 129 s, on a loaded machine. On `review14`, the model of his answers: 0.5, 2.9, 9.1 and 19.4 s for
its four decisions, at loads of 25 to 33, and `Verify.model` 110 s at a load of about 28 (in a first run of the same
model 0.5, 3.2, 5.6 and 20.3 s at loads of 31 to 37, and 128 s at about 31). Which call asserts the aggregates' own
rules in `bun run check` is settled in move 1: on the build's branch, `Prove.report(Import)` for the import (above),
and the row's and the group's rules in the tests of the decisions that record on them.

### 35. How does a stored state or event change shape?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

- **By rule (Recommended):** a new field is an optional key; a new meaning is a new event; a state whose shape must
  change is a union of the old and the new; until the first production deploy, a preview stage and local objects are
  wiped instead.
- **Always wipe.** Fine only while nothing real is stored.

Beside the first option, not in it: the prover tries an optional key present and absent, and each union member as a path
of its own, in every decision that reads the aggregate, so a shape change made by this rule can double a decision's
paths. On `review14`, the model of his answers, the largest decision (`Undoing`) has 298 paths; four such doublings
pass 4,096, and
then nothing of it is proved (read from the source, not run). Each change is run through `Prove.decision` before it is
merged; when the limit is near, the change is made another way (a new event, and a new field with a default that an
adopting command writes) or, before production, by a wipe, chosen in the move that meets it.

### 36. Who writes each audit line, and what answers the Activity page?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Today every change and its line land in one D1 batch.

- **The `activity` table stays the trail (Recommended).** Where a projection writes the change to D1, it writes the
  line in the same batch. For a command that changes no D1 row, a projection writes the line, a delivery after the
  change: the line is then no longer in the same write as its change.
- **A stream per model, and the Activity page merges them with the table's lines.**

### 37. How do rows already stored arrive in the model?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Nothing is deployed today; the rows that exist are in development databases. Adoption binds only from the first deploy
he keeps (his answer of 2026-11-22: "We can always tear down & redeploy from scratch").

- **Adopt at first touch (Recommended).** The first command that reaches an instance with rows in D1 and no events is
  preceded by an `Adopt…` command built from those rows, under an id that makes a second send do nothing: imports in
  move 3, items in move 4 under decision 17's first answer (at an item's first edit or take-back), organizations and
  members in move 6, the allowance's count in move 2.
- **Adopt everything at a deploy**, by the operator's command line.
- **Start empty.** Open drafts are confirmed or removed before the move; stored imports become history that cannot be
  taken back.

Beside the first option, not in it: no trial has an adopting command, and the model as proved cannot take one as it
stands. Adopting a confirmed import makes it Imported without `ConfirmImport`, which `NothingIsWrittenBeforeConfirm`
forbids as written; a row has no commands, and its number is one its import gave, so adopting a stored decision is a
decision across import and row with a numbered change. Adoption is therefore a change to the model in move 3, which
proves every rule again with it. Not written yet, and settled in move 3: what an adopted row's number is and how the
screen learns it, and what becomes of rows kept waiting in a browser, of today's holds, of dismissed take-back lines and
of the review region's undo history. A Replace or Keep-stored already saved on an import matched before moves were kept
is adopted as made: only the next match of that same field takes it back and names it, and a match of another field
leaves it (his answer of 2026-11-22, "Leave as made"). The adopting decision records on rows, so it states the row's
three rules on who may change it itself, and its proof asserts them by name (under "Sketch"); on the build's branch
`Catalog.verify.test.ts` fails, naming it, when it does not.

### 38. What does Remove do once decisions are events?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Today Remove deletes an open import's decisions and staged rows. The library never deletes an instance's events.

- **The import is marked removed and its rows in D1 are deleted; the events stay in the objects (Recommended).** The
  person sees what they see today.
- **The app also deletes the objects' storage**, through a route of its own on the model's Worker. Removed means
  removed; the route is ours to keep working.

### 39. What is kept for ever?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The others
are kept below as what was rejected. He was not told, when he answered, that each act on a group is an object kept for
ever, taken back or not, with its rows' text; he is to be told.

What the library keeps, beyond Remove: one object for each decided row and each item, with their events; one
projection key per item; a removed member's email in the events that added them. Under decision 7's answer, given after
this one, also one object for each group act, taken back or not, each holding its rows as one text of up to 600,000
characters; a redo of a group is a new one.

- **Kept, as the library keeps it; an operator's command deletes an organization's objects when the organization
  leaves (Recommended).**
- **The app deletes a member's email from their objects' storage when they are removed**, and an import's objects
  when it is removed or a year after its confirm.

### 40. In what order do the moves happen?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

- **The review's model in memory, then the host with the smallest slice, then the import's write side as one move
  (Recommended)**: the order under "Order of moves".
- **People first on the host.**
- **The import's write side first on the host.**

### Decisions that can wait for their move

On 2026-11-22 he chose to be asked each of decisions 41 to 56 and 60 to 62 when its move opens.

**41. How long may a group act take before the group is decided as one unit?** (move 3) **Not asked: it fell away on
2026-11-22** with his answer to decision 7, under which every group is a unit. It was for decision 7's third answer. In
local workerd 13 to 15 minutes for 6,000 rows row by row, worked out from trial 14, and a median of 214 ms as a unit, as
an import's first group act (trial 17). Options: 1 minute; 5 minutes (Recommended, as a first number to measure against
on the preview stage); no limit.

**42. What answers the Items page?** (move 4) A query that answers today's page (Recommended), rows, total and page
count; or a query by cursor and a second for the total, page numbers becoming Next and Previous.

**43. Do suggestions start by the person's press, or by themselves when a file is staged?** (move 5) By the press, as
today (Recommended); or by themselves, which can use the day's allowance before anyone has looked.

**44. How many calls may one pass take from the 40 a day?** (move 5) One, as today (Recommended); or one per piece of
the file up to a number he sets.

**45. What do confidence scores decide?** (move 8) The guard's word stands and the probability is shown beside it
(Recommended); the probability sets the word, which reverses a written rule; or a second call checks the other
model's answer.

**46. Which route do scores take?** (move 8) The `@effect/ai-typesafe` package with the key he reserved (Recommended:
the thing he named). It reverses infra I5 (2026-11-19), "Production only, one vendor", and its "Not deployed for now"
for that key; no agent resolves the key. Or OpenRouter's route with the key the app has.

**47. Does a scoring call count against the 40 a day?** (move 8) Yes (Recommended); or its own allowance.

**48. Which mails does the app send?** (move 8) Every option reverses infra I6 (2026-11-19), "Not now". Reset, a notice
to a person added, and "your import is in" and "taken back" to the person who did it (Recommended); the first two
only; or all four, the import notices to every admin as well.

**49. Is confirming the address turned on?** (move 8) Off, as today (Recommended); or on, in production only, once the
key is there.

**50. What may the assistant's tools and an MCP server read?** (move 9) The older packet's open question 16 recommended
reads and proposal-only writes. Reads only, of what the signed-in person's role may read (Recommended); reads and
writes that land as proposals a person approves; or the assistant keeps today's inputs.

**51. Who may call the MCP server?** (move 9) Admins (Recommended); every member, within their role.

**52. What does a notice to the team's channel contain?** (move 8) Counts and the person's name, no file name
(Recommended); or the file name as well.

**53. Which channel gets notices?** (move 8) One channel per organization, set by its admin (Recommended); or the
operator's one channel, across organizations.

**54. What is GraphQL used for?** (move 9) `effect/graphql` is a client; serving the app's data over GraphQL **cannot
yet**. A driver in the Worker that reads Cloudflare's analytics, an admin-only panel of the day's requests and rows
written, and the command line reading through it (Recommended; it measures what this brief computes, and needs an API
token from him); the command line's read only; or a server outside Effect called from one screen.

**55. What does Alchemy Git hold?** (move 10) A mirror of this repository, and a history of each
organization's confirmed imports as files, readable by that organization's admins and kept after a take-back or
Remove (Recommended; a fourth Worker, an R2 bucket for git objects, `@alchemy.run/aws`); or the mirror only, with no
customer data.

**56. Are workflows only the sagas, or also an Effect workflow on the Worker that has D1?** (moves 3 to 5) Also a
workflow: the plan's sweep of unused plans, which needs D1 (Recommended); only the sagas.

**57. Is "Rivet cannot yet" accepted?** No Rivet control plane or pool runs on Cloudflare; a control plane the Worker
can reach and a pool outside Cloudflare would remove it. Accepted (Recommended); or wanted, which adds an option to
decision 27. **Answered 2026-11-22: accepted as cannot yet.**

**58. Is "CI on Alchemy Git cannot yet" accepted?** The package has no runner; one the project builds would remove it.
Accepted (Recommended); or a runner is built. **Answered 2026-11-22: accepted as cannot yet.**

**59. Is "workflow files through the GitHub provider cannot yet" accepted?** Nothing in the provider writes repository
contents; a resource over the contents API would remove it. Accepted (Recommended); or the resource is built.
**Answered 2026-11-22: accepted as cannot yet.**

**60. May a person link Discord to their account?** (move 8) From a signed-in session only (Recommended); or not at
all.

**61. Which stages offer Discord?** (move 8) Production and previews, each with its address registered and its own
Discord application for production (Recommended); or production only.

**62. What does a person read when a Discord sign-in fails?** (move 8) The app's own sentence (Recommended); or Better
Auth's error page.

## What each move needs from Benjamin, by hand

| Move | What |
| --- | --- |
| 2 | His Cloudflare login, `alchemy state bootstrap` and a deploy to a preview stage, as the infra goal lists them |
| 3 | A deploy of the move to the preview stage, before the Review step moves: the group act and one confirm are measured there |
| 5 | A deploy with imports already on the stage, to show `ImportHistory`'s backfill |
| 7 | To accept the pool's public gateway and its token for the stage it runs on; a deploy |
| 8 | A Resend key and a verified sending domain; a Discord application and a channel webhook or bot; the TypeSafe key, if decision 46 takes it |
| 9 | A Cloudflare API token that reads analytics; a 1Password service-account token for a deploy that writes secrets |
| 10 | A deploy: the stack makes the bucket and the Worker |

Under decision 30's answer, the browser pass runs on `alchemy dev`; the moves above that name a deploy also need it.

## Rabbit holes

- **One path too many.** A union in a state or a command is a path per member; so is each side of an `&&`, `||` or `?:`
  the prover cannot settle, in the code and in every rule of every aggregate a decision reads. The hosted review passed
  4,096 paths twice on the way and proved nothing then; on `review14` `Deciding` has 152, `Undoing` 298, `DecidingGroup`
  42 and `UndoingGroup` 84. Every field, rule or check added to a row or the import is run through `Prove.decision`
  before it is merged, and a rule is one comparison. A shape change under decision 35 adds paths the same way: an
  optional key is tried present and absent.
- **A proved rule with a name that promises more.** Three models of this review were proved and wrong. Each rule's test
  has a mutant beside it that removes its check and must break that rule or fail a story, and stories of what a person
  would call wrong are written against each model before its rules are asserted. On `review14` 148 mutants ran against
  its rules and its 43 stories: 111 left a rule not proved, 32 of them only as "unconfirmed" (a counterexample the
  solver found and did not replay), the other 37 failed a story, and none passed both. The build's branch keeps the same
  148 as mutants of its own (`packages/catalog/model/mutants`: a sample in `check:full`, all of them nightly).
- **The time of a group act.** A median of 95 to 214 ms in local workerd, each an import's first group act, on the
  model before the last-group rule (trial 17); a later group on the same import, the projection's write of its rows and
  anything on `review14` were not measured.
- **Checked is not proved.** The review's two relations are proved on `review14`; its seven rules across instances stand
  on a search of every sequence of up to 3 commands (16,629 sequences) and 200 sampled sequences of up to 8; the
  members' relation and model invariant on a search 4 commands deep; `EveryUploadEnds` on a search 2 commands deep,
  where it holds at the end of the 116 sequences that ran their course, and 200 walks of up to 4.
- **The confirm's handler.** It waits for the projection before it builds the plan. A projection that keeps failing
  holds every confirm of that import behind it, and the screen says "still saving".
- **A sender that is not an Api** (a policy, a saga, a scheduled command) must itself provide the actor a command's
  middleware would.
- **The first read and the stream must meet.** The query returns the rows with their place in the acts' order, and
  the stream is followed from that place. No read ran in any trial.
- **A deployed object.** 8 MiB is local workerd's limit; the widest row the contract allows, 15 fields of 32,767
  characters over another such decision, is at most about 3 MB in UTF-8 (arithmetic), under it.
- **`main` moves.** One commit is pinned and moved only when needed (`bun run alchemy:repin -- <commit>`). At each move
  the repository's proofs, search, stories and mutants run again on the new pin; the trials on the trial page stay of
  `dbfd0dd` and are not rerun.
- **Never rename a model**, an aggregate or an event once the first deploy he keeps is out (his answer of 2026-11-22:
  until then the names are open), and a deploy that adds an object class goes out whole.

## No-gos

- No change to a rule of an import, to what a count means, or to a sentence the person reads, except where a decision
  names the change and he chooses it. The decisions whose options name one: 2 to 25, 31, 37, 38, 42, 43, 45, 47, 48, 49,
  52 and 62.
- `review` stays one pure function, run by the screen and by the server at the confirm. It does not move into
  `decide`.
- A model still proposes and never writes.
- No R2 presigned uploads.
- No deploy, login, state command or key by an agent. No `op://` reference resolved by an agent.
- Nothing built before he signs and the atoms goal is merged, apart from the pin on main and the review's model on the
  build's branch, which goes into main beside this brief.

## Proof (the definition of done)

The split he accepted on 2026-11-22: the proofs cover what must never happen; the stories cover that each valid act is
taken.

1. Every row of "Every single thing" passes the check in its last column.
2. Every Verify and Prove test asserts the standing of every rule of its table by name. Each Verify test keeps every
   rule's text in the library's lock file, which catches a rule removed or reworded, and names the rules that must be
   proved in `require.proved`, which fails the build when one is no longer proved (his answer of 2026-11-22, "Lock plus
   the library's proved list"). `Prove.report` and `Prove.decisionReport` take neither, so each Prove test in `bun run
   check` fails on any rule its report does not give as proved, and which rules there are is held by the lock in
   `Verify.report` (`check:full`, CI's `proofs` job, nightly), where a rule taken out or renamed fails, as the build's
   tests do; on the build's branch `Catalog.verify.test.ts` asserts each rule's standing by its kind, and
   `require.proved` is to write in place of that. The review's model, `Catalog`, proved again on the pinned `734c27a`:
   on `dbfd0dd` its trial, `review14`, has 135 rules proved, both relations among them, seven rules across instances
   checked 3 commands deep, and each of its four decisions proved with its paths; the build's branch
   `claude/alchemy-review-model-f206c6` gives 135 proved, 7 searched and 11 "can be taken" rules reached on `734c27a`,
   with the lock and not yet `require.proved`, and the per-row fallback on `claude/alchemy-review-model-parked` 96
   proved and 3 searched. The item's 10 (trial 8's model), the allowance's 7 (trial 9's, whose one command is
   `TakeCall`: the adopting commands of moves 2 and 7 contradict two of its rules as written, so the seven are proved
   again with adoption) and the members' 19 (trial 10's `Access`: four decisions with `FoundOrganization`, a person
   added by member id; with `MemberEmail` and adoption not run) proved again on the pin with what their moves add; their
   relation and model invariant checked; `EveryUploadEnds` checked. Beside each check of a decision or an aggregate, a
   mutant that removes it and must break its rule or fail a story. A story for each of the review's eleven commands
   accepted and for each of its refusals, each failing on a model whose `decide` records nothing for that command (45
   stories on the build's branch); a "can happen" rule (`sometimes`) for each command, answered "reached" (11 reached on
   the build's branch). Every decision that records on a row or a group, the adopting decision of move 3 included,
   states that aggregate's three rules on who may change it, asserted by name (on the build's branch
   `Catalog.verify.test.ts` fails, naming the decision, when one does not).

3. The property test of the client fold against the real model on the memory host, with the orderings as named cases
   (another person's act before the screen's own waiting act; a colleague's group landing before a waiting act, on a row
   it names and on one it does not; a row's undo pressed before a group reached the screen, on a row it names and on one
   it does not; a press over a group that leaves the row as it reads, then the group taken back; a group taken back
   behind a later one; a group taken back over a row a colleague changed since, that row keeping her whole decision and
   the screen naming it; a colleague's group whose change on the import's events reaches the screen before the group's
   own event, its rows: no waiting act on a row it names is sent again until both are there; a keep of one of two rows
   in decision 14's three cases: a rival with only accepted fixes, a rival kept or edited before the keep or decided
   after it, and two keeps of one SKU; a second tab; a reload with acts waiting; a match beside a waiting accept), and
   the rules: every act the person made is in the model's events or in the queue; a row read through its groups equals
   today's `act` wherever `act` has an answer, for two people, on the model's own code with a row's undo that names the
   last group act; and where `act` has no answer, the reading he chose (his answers of 2026-11-22, "Row 14 stays whole"
   and "No change, Ana's undo applies").
4. Each projection batch run twice with the same input writes once; a confirm sent while `DraftRows` is one act behind,
   or has not written a group's rows, waits and builds its plan at the last change.
5. Through the model's Api in process: a member of the second organization and a viewer against every command, view and
   stream, each ending in its rejection; a call from another origin refused before identity.
6. In two browsers, as two people on one import, on a fresh database and on the runtime decision 30 names: different
   rows decided in both; the same row decided in both; an undo after the other changed the row; a confirm while the
   other decides; a confirm with acts waiting while the other decides; a reload with an act waiting; a match beside the
   other's accept; a group act while the other confirms; a group act while the other has an act waiting; a group taken
   back behind the other's later group; the other's group taken back after one changed one of its rows, with "Row 14
   was changed by Dana and stays" read on both screens; a press over the other's group that changes nothing, then that
   group taken back;
   a keep of one row of a SKU while the other has accepted only fixes on its rival, has kept or edited the rival, or
   keeps the rival, each with the clash or the leave-out read on both screens. Then `items_messy.csv` through Confirm
   with the three numbers read (200 rows,
   155 imported, 155 stored), at phone width and in both themes.
7. On a preview stage he deploys: the requests of one row act, one group act of the sample's largest group, one confirm
   and one item, read from Cloudflare's analytics, each within twice the figures measured locally or worked out under
   "What one large import costs", and the rows each writes; and the time of a group act of 6,000 rows; a confirm of
   38,750 items to its end, before the Items page reads them.
8. `bun run check:full`.
9. Each of his answers of 2026-11-22 that the build must honour has a check that fails if it is built the other way.
   Stories and rules named are on the build's branch `claude/alchemy-review-model-f206c6` (stories by their title in
   `test/Review.story.test.ts` and `test/Group.story.test.ts`); "to write" where none exists there yet.

| His answer (2026-11-22) | What fails if it is built the other way |
| --- | --- |
| 2: theirs is held, both shown | `DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt`; the story "when someone else decided the row first, the act is refused with whose decision is there"; that the queue holds it and Confirm waits: to write (Proof 3) |
| 3: it changes nothing, naming whose | `DecideRow.AnActThatChangesNothingLeavesTheImport`, `.AnActThatChangesNothingLeavesTheRow`; the story "a save that leaves the row as it is records nothing, seen or not: the answer says no change"; that the screen names whose: to write |
| 4: an import, its rows and its groups as aggregates with decisions across | `Catalog.verify.test.ts`, whose lock holds every rule of the three aggregates and four decisions |
| 5: the confirm and the take-back are facts on the import | `Import.NothingIsWrittenBeforeConfirm`, `.OnlyAnImportWithAConfirmStandingIsTakenBack`; that a take-back waits for the confirm's items: to write (the design under decision 5) |
| 6: refused when the plan does other than was shown | `Import.APlanDoesWhatWasShown`; the story "a plan that would do something else than the button said is refused: the stored items changed" |
| 7: a group as one unit | `DecideGroup.AGroupIsOneChange`; the story "a group of 6,000 rows is one act and one change, and a confirm has to have received it" |
| 8: only the last group in force is taken back | `UndoGroup.OnlyTheLastGroupInForceIsTakenBack`, `.ThenTheOneUnderItIsTheLastInForce`; the story "walk-back: Ana decides a group, Dana decides a group; Ana's undo is refused naming Dana's; Dana undoes hers, then Ana hers" |
| 10: every step, the levels below sealed | `UndoRowStep.WhatLiesUnderIsWhatWasRecorded`; the story "undos go down every level exactly as it was, and end at none" |
| 11: an undo puts back exactly what was under, whose it was | `UndoRowStep.AnUndoPutsBackTheDecisionThatWasThere`, `.AsTheirsWhoMadeIt` |
| 12: no undo past a confirm that stands | `UndoRowStep.AnUndoDoesNotReachPastAConfirm`, `UndoGroup.AGroupsUndoDoesNotReachPastAConfirm`; the story "an undo does not reach past a confirm that stands" |
| 13: an act from before a confirm is refused after a reopen | `DecideRow.AnActIsOfThisOpening`; the story "a match, a group and an undo made before a confirm are not taken after the import is opened again either" |
| 14, with 14a, 14b and "As today, never overwrite a choice" | To write: a test of `review`'s rule for rivals in its three cases (Proof 3) |
| 15: a match on an unseen match is refused | `Import.AMatchIsMadeOnTheLastOne`; the story "a match made over one its sender never saw is refused, and the columns as they are, by heading or by hand, are no match" |
| 16: Remove names the last change | `Import.TheRestNameEveryChangeToo`; the story "a take-back, a reopen and a remove each name the last change, so a press on an old screen is refused" |
| 1, with "In the repo, re-pin only when needed": the pinned build kept as files | The clean install from `vendor/alchemy` with the library's registry refused, in `check:full` (move 0): to write |
| "Chosen design, parked one as fallback" | `claude/alchemy-review-model-parked` passes its own proofs on `734c27a` (96 proved, 3 searched), kept on the pinned build with nothing else, until the chosen model is merged by the evening of 2026-11-24 |
| 17: each item an object | `Item`'s Verify test, and a confirm whose items the Items page reads from their instances (moves 3 and 4): to write |
| 18: a plan staged in the database | A confirm that writes from the plan staged at the import's last change, and refuses one built at an earlier change (move 3): to write |
| 19: stay confirmed, keep retrying | A confirm whose write fails stays confirmed and its write is retried, never reopened (move 3): to write |
| 20, 21, 22: `Organization` and `Member` are the record; Better Auth's writes closed; a removed person's page gets nothing more | `Organization`'s and `Member`'s Verify tests; a call to Better Auth's organization endpoints that write is refused; a change pushed after a removal does not reach the removed person's page (move 6): to write |
| 23: a Discord sign-in with an unverified email refused | A Discord sign-in with an unverified email creates no account (move 8): to write |
| 25, 26: the allowance per organization, back at 00:00 UTC | `Allowance`'s Verify test, with the `TestClock` across midnight UTC (move 2): to write |
| 27, 28, 29, 30, 31: the hosts, two Workers, `alchemy dev`, the screens on the model's Api | Each move's rows of "Every single thing" (moves 2 and 7): to write, in that move |
| 32, 33: blocks in each model package; `new` only in decide files | Built on the build's branch (a folder per aggregate in `packages/catalog/model/src`, the decisions in `src/Review/`); each Prove test fails when its report has a check it did not read (`unread`) |
| 35, 36, 37, 38, 39: by rule; the activity table stays; adopt at first touch; mark removed, events stay; keep, delete when an org leaves | A stored event of an older shape read by its rule; each write of the model adding its `activity` line; a row stored before the move adopted at its first touch; Remove leaving the import's events and deleting its D1 rows; an operator's command deleting an organization's objects (moves 2 to 6): to write, in the move that builds each |
| 40: review in memory, then host | The order of moves itself |
| "Undecided: Ana took it back" | The story "a group taken back gives no row anything again: Ana's group of twelve rows, Dana types on row 14, both are taken back, and row 14 holds nothing" |
| "Yes, refuse and show" (an undo behind a group) | `UndoRowStep.ARowsUndoSawTheLastGroupAct`; the story "refuse and show: a row's undo or act sent before the last group act reached its screen is refused and records nothing, and is taken sent again with it" |
| "Row 14 stays whole" | The story "a group's undo touches no row: a row another person decided since keeps its decision, and a row's act made before the undo reached its screen is refused"; the sentence on screen: to write (Proof 6) |
| "No change, Ana's undo applies" | To write: a story of a press with `asItReads` that records nothing, and the group's undo then leaving the row undecided; the branch's story "the same text over a group in force is a change: covered, it records a decision; not covered, it records nothing" changes with it |
| "Yes: resend untouched, hold touched"; "Sent again by itself" | To write: the queue's test (Proof 3) |
| "Yes, tests hold it, said plainly" | The 45 stories; each of the 148 mutants on the branch, run in `check:full` by a sample and nightly in full |
| "Yes, one per command" | The 11 rules `Catalog.AnImportCanBeStaged` to `Catalog.AGroupCanBeUndone`, each answered "reached" in `Catalog.verify.test.ts` |
| "Lock plus the library's proved list" | The lock in `Catalog.verify.test.ts`; its `require.proved`: to write |
| 34 and 34a: proofs in `bun run check`, search in `check:full`, its own CI job and nightly | The `prove` and `verify` turbo tasks; the `proofs` job in `.github/workflows/ci.yml` and `.github/workflows/proofs-nightly.yml` |
| "Leave as made" | To write: adoption's test (move 3) |

## Map

Four goals, each opened from this brief when the one before it is done. Under his answers:

| Goal | Moves | First slice | Existing code it changes | Net new |
| --- | --- | --- | --- | --- |
| `domain-core` | 0 to 2 | The day's model calls counted by the `Allowance` aggregate and seen on the status line | `packages/infra/src/Inventory.stack.ts`, `packages/access/model` (the allowance's port), `apps/inventory/package.json` (`dev`) | The review's model, `Import`, `Row` and `Group` with the four decisions, and its tests, in `packages/catalog/model` (a folder for each aggregate, the decisions in `src/Review/`, as on the build's branch); the model's Worker; `Usage` |
| `domain-import` | 3 to 5 | One act of the review saved through the model, in two browsers | `packages/catalog` (all four packages), `packages/review`, `apps/inventory/migrations`, `docs/standards/undo.md`, `CLAUDE.md` | `DraftRows`, `ImportActs`, the markers, `Item`, `Upload`, the sagas |
| `domain-access` | 6 | A person added by email through `AddMember` | `packages/access` (all four packages), the sign-in options | `Organization`, `Member`, `MemberEmail`, `MemberRows`, `AdminApi` with `FoundOrganization` (under 21a) |
| `domain-extras` | 7 to 10 | `Usage` on the Cluster pool with its cron | `packages/infra`, `packages/drivers` | The pool, mail, the channel, scores, the operator's surface, the history |

## Order of moves

After he signs and the atoms goal is merged. Each move ends with `check:full` and the browser pass, leaves the app
working, and rewrites the parts of `CLAUDE.md`, `README.md` and `docs/standards/` that it makes untrue (the feature
recipe of port, D1 adapter and `/api/v1` endpoint; "one atomic write"; "Storage is Cloudflare D1"), as part of its
proof. It is written for his answers; decision 40's answer is this order.

0. **The library**, as decision 1 says: the pin is on main (`ea95cd0`); this move checks the two infra stacks against it
   and runs the clean install again in `check:full`.
1. **The review's model, in memory, on the pinned commit.** `Import`, `Row` and `Group`, the four decisions and the
   eleven commands, under the names proposed, which are open until the first deploy he keeps. Its rules proved again on
   `734c27a`, each standing asserted by name, each rule's text kept in the library's lock file and the rules that must
   be proved named in its `require.proved` (his answer of 2026-11-22, "Lock plus the library's proved list"; the build's
   branch passes the lock and not yet `require`); a story for each command accepted and
   for each refusal; a mutant for each check; a "can happen" rule for each command; the fold's property test against the
   model, the reading of a row through its groups among it. The proofs cover what must never happen and the stories that
   each valid act is taken, the split he accepted. The row-by-row model stays on its branch as the fallback. Nothing the
   person sees; nothing stored. Built on the branch `claude/alchemy-review-model-f206c6`, which goes into main beside
   this brief (its counts under Proof 2); what it does not yet have is in the table under Proof 9.
2. **The host and the first slice.** The model's Worker, `bun run dev` as decision 30 says, the session, the two
   guards, the Api tests in process, the harness test, telemetry. The first slice is the allowance: its aggregate, its
   view, and each model call's take going through it, with today's count adopted (the calls since 00:00 UTC; decision
   25 says what adoption changes in its proved rules). His deploy to a preview stage.
   *Interim:* every import still runs on D1 as today.
3. **The import's write side, in one move.** Stage, acts, group acts, match, suggestions recorded, confirm, take-back,
   reopen, remove; `DraftRows` and the batches with their markers; under decision 17's first answer, `Item`, its saga
   and `ItemRows` in the same move, so the confirm's items are written once in their final shape; adoption at first
   touch, once a deploy he keeps holds rows, with the model proved again with it (decision 37); the Review step's fold, queue and stream; the review
   region's change; his deploy, and the group act and the confirm measured. `PUT /imports/:id/decisions` and
   `SaveRequest` leave. *Interim:* the lists, the staged table and the suggestions' handler still read D1, which
   `DraftRows` keeps written.
4. **The Items page** as queries; `EditItem` as a command; items stored before move 3 adopted at first touch, once a deploy he keeps holds them.
5. **The rest of the import**: `Upload` with its deadline, suggestions as a saga, the lists as queries,
   `ImportHistory` and its backfill.
6. **People**: `Organization`, `Member`, `MemberEmail`, the four decisions (`FoundOrganization`, `AddMember`,
   `ChangeRole`, `RemoveMember`), `MemberRows`, `AdminApi` with `FoundOrganization`, by which the operator founds an
   organization (under 21a, open, asked when the move opens), adoption of the organizations that exist once a
   deploy he keeps holds them, and the model proved again with the email claim, the founding and
   adoption before any count is asserted; reads end on removal.
7. **Cluster**: `Usage` moved to the pool with each day's count adopted, its cron and singleton, the admin's live
   page.
8. **Mail, the channel, Discord sign-in, scores, the suggestions' object.**
9. **The operator's surface**: the command line, its HTTP document, the assistant's tools, the MCP server, the
   analytics driver and panel, the operator's scripts, secrets at a deploy, the repository resource.
10. **The history and the mirror.**
