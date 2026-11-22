---
type: Brief
title: "Brief: the app on @alchemy.run/domain"
description: How inventory-import uses all of @alchemy.run/domain and the extras Benjamin asked for. The saving of review decisions is modelled first, in the shape the app would host, with the app's fifteen fields, and Verify proves 93 of its rules and checks the other three; then one table of every concept with its worked instance, its move and a check that fails without it; then the decisions that are his, one decision each, most consequential first, with what one large import costs under the recommended answers. Written only; nothing is built until he signs and the atoms goal is merged.
---

# Brief: the app on `@alchemy.run/domain`

Benjamin, on 2026-11-19: "Not borrow use.", and "if possible find a way to make use of ever single thing". Of the
pull request that adds `Verify`: "I'm particularly excited about this". That reverses the 2026-11-18 decision "core";
his words are in [CAPTURE.md](CAPTURE.md). Five rounds of trials stand behind this brief, with their sources and
reports on [the trial page](research/07-review-decisions-trial.md).

Three rules shape every recommendation here:

- **A recommended option does not give up what Verify proves.** Where a shape exists under which a rule is proved,
  that shape is recommended and what it costs is stated as a cost. Where none exists, the question says so, with the
  exact limit in the way.
- **A recommended option never drops something he asked for or answered.** No option leaves out the library or an
  extra he asked for without saying what is in the way and what removes it.
- **An option that goes against a dated answer of his says so**, with the answer and its date.

Nothing here is built. **The build starts after Benjamin says the brief matches, and after the atoms goal is merged
into main.** That goal's work is in main now ([its plan](../../goals/atoms/PLAN.md)), and "today" in this brief is the
code on main.

## Problem

No file in the repository imports `@alchemy.run/domain`. Each rule that matters is held by a guarded D1 batch behind a
port, and checked by tests that sample it.

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

All on the library's `main@dbfd0dd`, from its preview builds, beside Effect 4.1.4, outside the repository. Nothing
was deployed.

- **The review in the shape it would be hosted is proved: 93 rules, 1 relation checked** (trial 13). That model has
  the app's fifteen fields; its own number for every change; a confirm, a take-back, a reopen and a remove that each
  name the last change their screen received; a confirm whose plan is of that change and does what the button said; a
  group act, and the undo of one, whose rows are counted; the answer "no change"; matches, groups, acts and undos that
  name what they were made on and in which opening; events that each say whose they are; and undo exact at every depth.
  Two rules across every import and row are checked over every sequence of 3 commands.
- **Three models before it were proved too, and let through what Benjamin ruled out.** In the third round's, a screen
  that had received one row of an ended group could confirm all of it, and an undo could carry a text of its sender's as
  another person's. On the fourth round's first, 36 stories of such orderings passed (a take-back hit someone else's
  later confirm, a column match was replaced unseen); on its second, 33 (a confirm fell between two rows of a group's
  undo, a match made before a confirm was taken after a reopen). The final model refuses each that a model can hold; what
  it cannot hold is listed under the table, or asked. A proved rule is a promise about what it says, and about nothing
  beside it. The final model has had no such attempt of its own.
- **What un-proves a decision, exactly**: past 4,096 paths nothing of it is proved. The prover tries each member of a
  union in a state or a command as its own path, and takes both sides of every `&&`, `||` and `?:` it cannot settle, in
  the code and in every rule of every aggregate the decision reads. Unions for "none yet" and fifteen accepts compared
  one by one passed the limit (nothing proved, 716 s). The fourth round's models passed it twice more: with rules written
  as chains of `&&`, and when the undo of a group was added (4,097 paths, nothing proved). With one comparison a rule, a
  group counted by a number instead of cleared by a branch, and no rule weaker, `Deciding` has 332 paths and `Undoing`
  2,652. It also cannot write a text's length into a text, nor read a loop, so it reads no hash.
- **A group of rows decided as one unit is proved too** (trials 15 to 17, a model beside the final one, for decision
  7): 123 rules, the four decisions with 42 to 292 paths; one act for 6,000 rows a median of 214 ms in local workerd;
  and the reading of a row's decision through its groups equals today's `act` over 50,000 generated sequences, when a
  group's rows are split by what each got.
- **No rule holds that an act is taken.** A `decide` that records nothing for every act proves every rule of the final
  model (trial 15): the prover checks a decision's rules on what an act records. The stories hold that acts are taken.
  His answer of 2026-11-22: tests hold it, said plainly. The proofs cover what must never happen; the stories cover that
  each valid act is taken; the documents and any page that shows the proofs say exactly that split.
- **The hosted model on the domain's Durable Object host, in local workerd** (trial 14, the final model): 600 acts one
  after another, each the first act on a row of its own, in two runs: 131 and 151 ms an act on the mean, 79 to 98 ms in
  the middle, the slowest 12.4 s, at load averages of 27 to 46. A later act on a row was not timed. Counting the
  Worker's call to the import object, 4 requests an act (3 of them between objects), 5 on a row's first (its entry in
  the domain's directory), 4 for one that changes nothing, 3 for a refused one; 1 for a match, a skipped row, a confirm
  or a take-back, the Worker's call to the one object they touch. Of three pairs raced on one row one was taken and one
  refused each time; of three on two rows both were taken. A deployed object was not tried.
- **One value in a Durable Object may be about 8 MiB** through the domain host in local workerd (8.3 MB stored, 8.5 MB
  refused with `SQLITE_TOOBIG`). The 2 MiB in the library is a guard of its cluster package.
- **An item held as text proves its ten rules**, replace and restore in turn included (3.6 s). With its tags and
  vendors as lists, all eleven are only checked (788 s).
- **The allowance by the UTC day proves its seven rules** with no reset command and no cron, the day held as a day
  number. Today's rolling 24 hours, held as a list of times, is only checked.
- **Members as their own instances prove 19 rules**, an admin changed only by an admin in the record among them; that
  the counts equal the members is checked.
- **One instance per import proves nothing**, by the prover's design (a list is tried with at most 2 items more than
  its schema asks for); its state passes 8 MiB at about 42,800 decided rows (the
  length of its JSON, for one mix of decisions).
- **What the prover reads**: handlers written `Effect.fn("name")(…)`; an id or a value schema from another package; not
  a request context imported from another package; `new Event(…)`, not `Event.make(…)`.

## Sketch

### The review, in the shape Verify proves

| Block | What it holds | What it decides |
| --- | --- | --- |
| `Import`, one instance per import | Its status (open, imported, taken back, removed) and organization; the number of its last change and of the last confirm that stands; how many times it was confirmed; its count of column matches and every field's column as one text; the last group act, whose it is and how many of its rows are not answered; its rows in number, the items in force, the items it replaced and the confirms standing. No rows | Stage, match a column, begin a group, skip a row of it, stop it, record a suggestion, confirm, take back, open again, remove |
| `Row`, one instance per decided row | The row's decision as text, the change that recorded it, who made it, in which step, the matching it was made on, its label; the decision under it in full; everything below that sealed into one text | Nothing alone |
| `Deciding`, `Undoing`: decisions across one import and one row | Nothing | One act of the review, read from both instances and recorded on both or on neither |

In the trials the import is `ImportLife` and the row `RowUnit` (the trial page, "The fourth round"). **The import numbers
every change**, one higher each time, so no check rests on an id a sender makes. A step is only the label of one press:
the rows of a group share it, and it is compared only with the group being sent: a group's row is taken only under that
group's step, and a row of a step still being sent is not undone.

- **An act names the decision it saw on its row**, by the change that recorded it, the matching it was made on, whatever
  it decides, and how many times the import had been confirmed (its opening). Otherwise `DecidedSince { by, change }`,
  `NoLongerThere`, `MatchedSince` or `ConfirmedSince`. A match, a group and an undo name the opening too. The queue sends
  one act at a time and fills in a person's own earlier act from its receipt.
- **An act that would leave the row as it is records nothing**; its receipt has no events, and the answer says
  "no change": his answer of 2026-11-19.
- **A match says every field's column after it**, the headings' own choices and "none, on purpose" included, because
  giving a column to one field can move what another reads. It names the last match its sender saw, and is refused on
  another. The same columns again, by heading or by hand, record nothing and take nothing back. The import's events hold
  the columns at every match, so a reader can say, for any part of a decision, whether a field it rests on has moved since
  it was made (an accept, an undone fix, a keep of one of two, an answer about the stored item), and whether that changes
  the row. A part carried into a later act keeps its own number.
- **A confirm names the last change its screen received with none before it missing (`seen`), the change its plan was
  built at (`planAt`), and what its button said (`shown`)**, as one digest of what every row becomes. It is taken only
  when both numbers are the import's last, the plan does what was shown, and no group is being sent. Otherwise
  `ReviewMovedOn`, `PlanBehind`, `NotWhatWasShown` or `GroupUnderWay`. The digest covers what each row becomes, the stored
  item and revision it replaces, and what "already there" was compared with. A take-back, a reopen and a remove name
  `seen` too.
- **A group says how many rows it has.** Each is answered, as a decision or as a skipped row with its reason, each with a
  number of its own, and the group is over when the last one is. Its sender or an admin may stop it, which records how
  many rows were not sent. A row of a group that is not being sent is refused. The undo of several rows is a group as well.
- **A take-back is of everything in force**, from the result or while the import is open again, as today: the items its
  confirms created, removed or kept, and the items they replaced, put back or kept. It waits for a group being sent.
- **An undo names the change it takes back and brings what goes under the decision it puts back**; the row takes it only
  when it seals to exactly the text the row holds. It waits while its step's rows are still being sent, and does not
  reach past a confirm that stands. Otherwise `NotYourStep`, `NotWhatWasUnder`, `GroupUnderWay`, `NotThisGroup`,
  `ConfirmedSince`, `DecidedBeforeTheConfirm` or, where a very long history was let go, `HistoryEnds`.
- **Every event of the import says whose it is**, and an act's event who acted and whose decision the row then holds,
  so the history, the audit line and a notice are written from the import's events alone.

The decision a row holds is text: the text the `importDecision` table holds today, read through the contract's
`RowDecision` schema by the screen and by the server's `review`, with a matching beside each part as above. No rule reads
inside it. That encoding is what lets the rules be proved, so it is part of the design.

**Every rule, what it is proved of, and what holds the rest** (trial 13: `Verify.model(Review)`, verified in 461 s at a
load average of 33 rising to 56). Where a name ends in "…", the rule is written as several, one comparison each:

| Rule, in words | Name | Standing | Proved of | What holds the rest |
| --- | --- | --- | --- | --- |
| Nothing is confirmed that was not on screen: the confirm names every change, its plan is of every change, and the plan does what the button said | `ImportLife.AConfirmNamesEveryChange`, `.APlanIsOfEveryChange`, `.APlanDoesWhatWasShown` | proved | The numbers and the digests the command states | That the screen names the last change before the first it misses, and digests what it draws: tests (the first ran, as a property on a copy of the rule written in the test, not on the screen's code); that the handler plans from rows written up to that number: a slow test. Both digests come from the same `review` |
| Every event of the import says whose it is, and an act's event who acted | `ImportLife.EveryEventSaysWhose`; `TheImportsEventSaysWhoActed`, on both decisions | proved | The actor the request context holds | |
| A take-back, a reopen and a remove name the last change too | `ImportLife.TheRestNameEveryChangeToo` | proved | The number the command states | |
| Every change has a number of its own | `ImportLife.EveryChangeHasItsOwnNumber`; `DecideRow.AndGetsTheNextNumber`, `.OnTheRowToo`; `UndoRowStep.AnUndoIsNumbered` | proved | The import's number | No two rows hold one change: checked over 3 commands |
| A decision is replaced only by an act whose sender saw it | `DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt` | proved | The change the act names and the row's | |
| No undo clears a decision its sender did not make | `RowUnit.NobodyClearsAnotherPersonsDecision` | proved | The row's maker and the actor | An act that puts a row back to nothing is recorded as its sender's, over what they saw |
| An act is made on the matching now, and in this opening of the import | `DecideRow.AnActIsMadeOnTheMatchingNow`, `.AnActIsOfThisOpening` | proved | The numbers the act states | Which part of a text is still in force: a reader over the columns at each match, and a test, not run. That a carried part keeps its number: a test of the client's merge, not run |
| An act that changes nothing records nothing | `DecideRow.AnActThatChangesNothing…` | proved | The row's text | That one encoder writes the text, so the same decision is the same text: a test, not run |
| An act that is recorded is recorded as its sender said and as theirs | `DecideRow.AnyOtherActIsRecorded`, `.WithItsText`, `.OnItsMatching`, `.UnderItsStep`, `.AsItsSenders` | proved | The row | That an act is taken at all: no rule holds it. A `decide` that records nothing for every act proves every rule too, `AnyOtherActIsRecorded` included (run on this model: proved, 344 paths). The stories hold it |
| What an act replaces is kept under it (its number, maker, text and matching), and what was below that stays below | `DecideRow.AnActKeepsWhichDecisionItReplaces`, `.AndWhose`, `.AndItsText`, `.AndItsMatching`, `.AndWhatWasBelowStaysBelow` | proved | The row and the sealed text | That the step and the label kept under it are the replaced decision's: no rule |
| An undo takes back only its sender's own decision, puts back the decision that was under it (its number, maker, text, matching and step), and leaves under that exactly what was recorded | `UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep`, `.AnUndoLeavesADecisionWhenOneWasUnder`, `.AndNoneWhenNoneWas`, `.AnUndoPutsBackTheDecisionThatWasThere`, `.AsTheirsWhoMadeIt`, `.WithItsTextAsItWas`, `.OnItsMatchingAsItWas`, `.UnderItsStepAsItWas`, `.NothingIsBelowWhatWasTheLastKept`, `.WhatLiesUnderIsWhatWasRecorded`; `RowUnit.TheSizeOf…`, four | proved, every depth | The seal of what is brought against the seal the row holds, and the sizes of its texts | That two levels never share a seal: `unseal` reads one back, a property over 2,000 random single levels, each sealed over a random text. That the label put back is the one under it: the evolve copies it (`StepUndone`), and no rule checks it |
| An undo is of this opening, waits for its group, is counted as a row of one while that group is sent, and does not reach past a confirm that stands | `UndoRowStep.AnUndoIsOfThisOpening`, `.AnUndoWaitsForItsGroup`, `.AnUndoOfAGroupIsTakenOnlyWhileItIsSent`, `.AnUndoDoesNotReachPastAConfirm` | proved | The import's group and the confirm's number | |
| The import's event says what the row now holds and whose it is | `TheImportsEventSays…`, on both decisions | proved | The event and the row after it | That `DraftRows` writes it: a slow test |
| A row is decided only on an open import; a group's row only while it is being sent | `DecideRow.ARowIsDecidedOnlyOnAnOpenImport`, `.AGroupsRowIsTakenOnlyWhileItIsSent` | proved | The import | |
| A group's rows are answered one at a time, each by a change of its own, unless it is stopped; no group begins over another; only its sender or an admin stops one | `ImportLife.AGroupIsAnsweredRowByRow`, `.OneGroupAtATime`, `.AGroupIsStoppedByItsSenderOrAnAdmin` | proved | The import's count of rows not answered | That the saga answers each row once (a row answered twice would end the group with another unsent) and names the refused ones: a story, once the saga runs |
| Nothing ends a review while a group is being sent | `ImportLife.NothingEndsAReviewWhileAGroupIsSent` | proved | The import's group | |
| A match is made on the last one, is the next one, and holds the columns it says; a match and a group are of this opening | `ImportLife.AMatchIsMadeOnTheLastOne`, `.AMatchIsTheNextOne`, `.AMatchHoldsTheColumnsItSays`, `.AMatchAndAGroupAreOfThisOpening` | proved | The numbers and the text the match states | That the text says every field the match moved: one encoder over `matchColumns`, a test, not run |
| A confirm's four outcomes add up to the rows; no count is negative; no more is in force than the file has rows | `ImportLife.OutcomesAddUpToTheRows`, `.NoMoreInForceThanRows`, the eleven `…NotNegative` | proved | The counts the confirm and the take-back state | That they are what is stored: the Result step's query reads them back |
| The status becomes Imported only by a confirm; a confirm of a closed import leaves its status | `ImportLife.NothingIsWrittenBeforeConfirm`, `.AConfirmOfAClosedImportWritesNothing` | proved | The status | That a batch never writes twice: the marker and its test (Proof 4) |
| A take-back needs a confirm that stands, is of everything created and everything replaced, and nothing stands after it | `ImportLife.OnlyAnImportWithAConfirmStandingIsTakenBack`, `.ATakeBackIsOfEverythingInForce`, `.AndOfEverythingReplaced`, `.NothingStandsThatWasTakenBack`, `.WhatIsInForceThenIsWhatWasKept` | proved | The counts | That a changed item is kept: the item's own rule under decision 17's first option, SQL under its second |
| A suggestion writes nothing; a closed import's matching does not change; it opens only by Reopen; a removed import stays removed and had nothing in force | `ImportLife.ASuggestionWritesNothing`, `.OnlyAnOpenImportIsReviewed`, `.AnImportIsOpenedAgainOnlyByReopen`, `.ARemovedImportStaysRemoved`, `.OnlyAnImportWithNothingInForceIsRemoved` | proved | The status and the counts | |
| A row has no decision again only when nothing was under it | `RowUnit.ARowIsUndecidedOnlyWhenNothingWasUnder` | proved | The row | |
| Tenancy and viewers: an import and a row never change organization; only their own organization changes them; a viewer changes nothing | `ImportLife.AnImportNeverChangesOrganization`, `.OnlyItsOwnOrganizationChangesAnImport`, `.AViewerChangesNothing`; `RowUnit.ARowNeverChangesImportOrOrganization`, `.OnlyItsOwnOrganizationChangesARow`, `.AViewerChangesNothing` | proved | The actor the request context holds | That the session fills it truly: an Api test in process (Proof 5) |
| A decided row belongs to the organization of its import | `Review.ARowBelongsToItsImportsOrganization` | checked, 2 commands deep and 200 walks | | |
| No two rows of an import hold the same change; a row's change is one its import gave | `ReviewInvariants.NoTwoRowsHoldTheSameChange`, `.ARowsChangeIsOneItsImportGave` | checked, 3 commands deep | | |

**What no rule of the model holds**, each with where it is held or asked:

- What a decision contains (a typed value, which proposal, which of two rows is kept): `review` and its tests. A text no
  reader can read, or a row the file does not have: the command's schema bounds both; `DraftRows` and the handler name
  and skip what they cannot read (a test, not run).
- A person who decides a row as someone else already did has no decision of their own there: decision 3. A decision
  its maker took back while another's lay over it comes back when that one is undone: decision 11.
- A keep of one of two rows is an act on several rows today, and can be taken in part: decision 14.
- Which parts of a decision a match put out of force, and whether it changes the row (his answers of 2026-11-20 and
  2026-11-21): the reader over the columns at each match, with `review`, and their tests, not run.
- A row whose item a take-back kept can have its decision undone, since no confirm stands; `review` counts a row whose
  item this import has in force as already there, whatever its decision (a test, not run).
- Which rows a stopped group did not send: the import records how many, the saga which (a story, not run). A stopped
  group's rest is a new group.
- The undo of a decision made before a confirm is refused on the rows that confirm did not import, too: decision 12.
- A refused act that is sent again under its own command id is decided again, as the library does, so the queue gives an
  act sent again after a refusal a new id.
- `DraftRows` rebuilds an undo's level with the model's own `seal` and its rule of what is let go, or an undo past the
  limit is refused (a test, not run).
- A change to the stored items between the plan and its write: the write's own statements, as today.
- A screen that claims to have received what it has not; no server can know.
- What a projection writes and what a stream or a query gives ("not checked", in Verify's report), and that a decision's
  events commit on both objects or on neither, which Verify assumes and the local workerd run showed for an accepted
  and a refused act (for the raced acts it read back only the import's count of changes, not the rows); an abort after
  a prepare never happened there.

**Nothing evaluates a rule when the app runs.** What refuses a state in the running app is the code of `decide`. A
proved rule means that code cannot break it; a checked rule means no short sequence did.

### What the screen sends, and what it follows

**It sends one act at a time, in order, each with its step, the matching and opening it was made in, and a command id
made at the press.** A resend with the same command id answers the first receipt. **A rejection ends nothing by itself**
(his answers of 2026-11-20 and 2026-11-21): an act refused because someone decided the row since is held, with both
decisions and whose is whose, until the person picks one; an act refused for another reason stays, marked not saved with
the reason, until they decide the row again or dismiss it; a person who is signed out counts as waiting. `GroupUnderWay`
waits and is sent again when the group is over. Other rows' acts go on. A failure that may pass keeps the act waiting,
with "Save again". An act behind the person's own match is sent only if that match was the one taken (its receipt's
number is the next one); otherwise it is held.

**Acts that wait are kept.** The person's acts the server has not answered are kept in the saved progress. After a
reload they come back marked not saved yet and are sent again; the browser asks before the page is left while any wait.
Each tab keeps and sends its own; a tab opened later takes up the queue of a tab that is gone, and the tab whose acts
were taken up says so if it loads again; an act already recorded answers its first receipt, and one beside the open
tab's for the same row is held for the person to pick. His answer of 2026-11-20: a decision the person made is either on
the server or still waiting, never neither.

**It follows a stream of changes.** A projection, `DraftRows`, is given the import's events, which hold every change of
the import in one order, with what each row then holds. In one D1 batch it writes the row's decision to
`importDecision`, the act to the row's history, the columns to the import's choices with what each match took back, the
group's skips and stops, and the import's place in that order, so a person who comes later reads them too (his answer of
2026-11-21: shown to everyone until each dismisses it); it appends the change to a stream, `ImportActs`, keyed by the
import. The screen reads the rows once, with their place, then receives each change as it is appended, and knows by the
numbers when one is missing.

**What the screen shows** is the rows as last read, the changes received since, and the person's own acts not among
them yet, folded with the app's review rules.

**The confirm, both halves.** The screen sends Confirm only after its own acts have come back recorded and none is held or
marked not saved (his answers of 2026-11-21: one press settles many); it names the last
change before the first one it has not received, and a digest of what it shows every row will become. The handler waits
until `DraftRows` has written up to the import's last change (the projection's `caughtUp` on that change's receipt),
reads the rows and the place in one D1 read, runs the same pure `review`, stores the plan with that place, and sends
`ConfirmImport` with both numbers and both digests. The import's half is proved. Of the screen's half, only the rule
for the number it names ran, as a property on a copy of the rule written in the test; the rest of the screen's half
and the handler's are tests to write (Proof 3 and Proof 4).

**The group act.** `BeginGroup` says how many rows; the saga sends one act per row under the group's step, and
`SkipGroupRow` with the reason for each that was refused or already so. The group is over when every row is answered.
Until then no confirm, remove, take-back or match is taken, from anyone, and no second group begins (decision 8). The
person's later acts wait in their queue, because an act on a row the saga has not reached would name a decision that is
not there yet. If the person loses the editor's role or leaves, an admin stops the group and the number of rows not sent
is on the import for everyone to see.

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

- **Undo is an act**: `UndoRowStep`, for each row of the step. It is taken only for the sender's own step while that
  step is the row's decision, and puts back what was under it.
- **The history is the person's steps, read from the database**: `MySteps`, a query over the rows `DraftRows` writes
  (the step, who, the label, the rows it named, and what each row held before). It is the same after a refresh and on
  another device. A step is in force on the rows that still hold it.
- **A deeper undo brings the level it uncovers**, rebuilt from the row's history in the same rows; the row takes it only
  when it seals to the text it holds, so a history read behind, or made up, is refused.
- **Redo is the undone step sent again as a new step.**

### His answers, carried into the model

His answers given by dialog on saving the review, built in today's code, each with what the model holds and what
stays tested. The options he rejected are in [DECISIONS.md](DECISIONS.md).

| Answer (date) | In the model | Proved | Tested |
| --- | --- | --- | --- |
| "Answer says 'no change'" (2026-11-19), rows somebody else had just decided the same way among its cases | An act that leaves the row as it is records nothing, whoever made what is there; its receipt has no events. What that means for the second person is decision 3 | `AnActThatChangesNothing…` | That the screen reads an empty receipt as "no change" |
| "Refuse, show, confirm again" (2026-11-19): nothing is confirmed that was not on screen | The confirm names every change its screen received, the change its plan was built at, and what its button said | `AConfirmNamesEveryChange`, `APlanIsOfEveryChange`, `APlanDoesWhatWasShown`, `NothingEndsAReviewWhileAGroupIsSent` | The screen's and the handler's halves |
| "Keep them and send them" (2026-11-20) | The queue of acts, with command ids, kept through a reload; a group's refused rows recorded on the import | `AGroupIsAnsweredRowByRow` | The fold's property test: every act is in the events or in the queue |
| "Name the rows, then drop them" (2026-11-20) | Nothing is decided on a closed import, nor after a reopen by an act made before the confirm (decision 13) | `ARowIsDecidedOnlyOnAnOpenImport`, `AnActIsOfThisOpening` | The Result step names the left-over acts |
| "Server refuses, screen says so" (2026-11-20) | Every act names the matching it was made on; a match holds every field's column; each part of a text keeps its own number | `AnActIsMadeOnTheMatchingNow`, `AMatchIsMadeOnTheLastOne`, `AMatchHoldsTheColumnsItSays` | Which parts are out of force, for every reader; the screen says which were taken back |
| "SKU rematch", "Twin rematch", "Undone fix" (2026-11-20): server refuses, says so | A Replace, a Keep-stored, a keep of one of two and an undone fix are parts of the text with their own number; the reader puts them out of force as an accept | | The reader's test, each kind; not run |
| "Other rematch" (2026-11-20): refuse if it changes the row | The reader compares the row with the stored item on the columns at the part's match and now, with `review` | | The same |
| "Only when it changes" (2026-11-21); a field displaced by another's match counts as moved | The same columns again are no match; the columns are of every field, so a displaced one is moved | `AMatchHoldsTheColumnsItSays`; a story | |
| "Hold it, show both, ask" (2026-11-20), for a row that waited | `DecidedSince` and `NoLongerThere` refuse the act; the queue holds it with both. A row that did not wait is decision 2 | `ADecisionIsReplacedOnlyByAnActThatSawIt` | That the queue holds it and Confirm waits |
| "Keep them, say why" (2026-11-20) | A refused act stays in the queue with its reason; signed out counts as waiting | | The queue's test |
| "Each tab keeps its own" (2026-11-20); a discarded tab counts as gone and says so; "Keep both, she picks" for a refused row beside a closed tab's (2026-11-21) | One queue a tab, taken up only from a tab that is gone; a command id answers its first receipt whichever tab sends it | | The queue's test with two tabs |
| "Wait until she picks", "Wait, like a held row" (2026-11-21) | Confirm is sent only when no act is held or marked not saved | | The screen's half of the confirm |
| "Take it back, say so" for a Replace on an import matched before moves were kept (2026-11-21) | Adoption (decision 37) carries the moves that were kept; where none were, the part is out of force and named | | Adoption's test; not run |
| "Yes, everyone" (2026-11-21): what a match took back is shown to newcomers until each dismisses it | `DraftRows` writes it with the match, in rows the first read returns | | A slow test; not run |

### Every single thing

One row for every page of [the map](research/00-map.md) and every extra he named: its worked instance, the move it
lands in, and the check that fails when it is missing. "Not run" marks an instance no trial has run; every other row
ran in a trial named on the trial page.

| Concept | Worked instance | Move | Fails when missing |
| --- | --- | --- | --- |
| Model | `Catalog`, `Access`, `Usage` | 1, 6, 2 | `Verify.model` of each, every rule's standing asserted by name. The trials ran `Review` and `Access`; `Usage` not run |
| Command, event, rejection | `DecideRow`, `RowDecided`, `DecidedSince`; `ConfirmImport`, `ImportConfirmed`, `ReviewMovedOn` | 1 | The twenty-five stories of the fourth round |
| Aggregate | `Import`, `Row`, `Item`, `Allowance`, `Organization`, `Member` | 1, 4, 2, 6 | Their Verify tests |
| Annotations | A description on every served command, view, stream and query, and on each Api | 1 on | A test that fails on a served declaration with none. Not run |
| Decision | `Deciding`, `Undoing`; `AddMember`, `ChangeRole`, `RemoveMember` | 1; 6 | `Prove.decision` of each in `bun run check` |
| Relation | `ARowBelongsToItsImportsOrganization`; `AMemberWhoIsInIsCounted` | 1; 6 | Asserted "checked" by name |
| Invariants and transitions | Aggregate invariant `NoMoreInForceThanRows`; aggregate transition `AConfirmNamesEveryChange`; decision transition `ADecisionIsReplacedOnlyByAnActThatSawIt`; model invariants `NoTwoRowsHoldTheSameChange` and `ARowsChangeIsOneItsImportGave`, across `Import` and `Row`; model `eventually` `EveryUploadEnds` | 1, 5 | The standing table; the model invariants and `eventually` asserted "checked" |
| Unique values | The email an admin adds a person by (`MemberEmail`); a SKU per organization under decision 17's first option | 6; 4 | A story: two admins add one email, one is refused. The SKU not run |
| Deadlines | `ExpireUpload`, scheduled when an upload begins | 5 | A story with the clock moved past the deadline; the `eventually` rule |
| Project layout | Blocks in each context's `model` package (decision 32) | 1 | A block Verify cannot read fails its test as "not read" |
| View | `ImportStatus`, `AllowanceToday` | 3; 2 | An Api test in process reads each. Not run |
| View security | Every view and stream checks the organization and the role, and the member record on each push (decision 22) | 2 on | An Api test in process: a member of the second organization and a viewer against every command, view and stream. Not run |
| Stream | `ImportActs`; `ImportHistory` | 3; 5 | The fold's property test reads it after a cursor. Not run |
| Query | `ImportReview`, `MySteps`, `ImportResultCounts`; `ItemsPage`, `ItemFacets`; `OpenImports`, `PastImports` | 3; 4; 5 | Slow tests on D1; a story on the memory store. Not run |
| Reads and consistency | The confirm's handler waits for `DraftRows`; the Result step reads with the confirm's receipt | 3 | A slow test: Confirm sent while `DraftRows` is one act behind. Not run |
| Projection | `DraftRows`; `ItemRows` (decision 17); `MemberRows` | 3; 4; 6 | Each batch run twice with the same input writes once. Not run |
| Policy | `UploadDeadline`; `SuggestOnAsk`; `MailOnConfirm`; `TellTheChannel`; `EndReadsOnRemoval` | 5; 5; 8; 8; 6 | `Verify.model` runs each behind the others; a story. Not run |
| Saga | `GroupAct` (decision 7); `CreateItems` (decision 17); `SuggestionPass` | 3; 4; 5 | A story on the memory host. Not run |
| External system | `Suggester`, `Decider`, `Mailer`, `TeamChannel`, `CatalogueHistory` | 5, 8, 8, 8, 10 | Stubbed in stories; each adapter's own test. Not run |
| Api | `MemberApi` (what a browser may send), `ServerApi` (`ConfirmImport`, `Adopt…`, what a saga sends), `AdminApi` | 2, 3, 6 | A test that `MemberApi` lists none of the server's commands. Not run |
| HTTP and OpenAPI | The operator's document over `AdminApi` | 9 | The document lists exactly those calls. Not run |
| CLI | The operator's command line, `toCli` | 9 | A test runs `--help`. Not run |
| Agent tools and MCP | The assistant's read tools, `toToolkit`; an MCP server, `toMcp` (decisions 50, 51) | 9 | A test that neither exposes a command that confirms, takes back, edits or changes a role. Not run |
| Sessions | `CurrentActor` declared in each model's own package, filled by one session lookup | 2 | An Api test in process: no session is refused, a viewer gets `NotPermitted`. Not run |
| Better Auth with Alchemy | The model's Worker resolves the actor from the session cookie with `@alchemy.run/better-auth` | 2 | A test on the library's harness with `dev: true`. Not run |
| Discord sign-in | Better Auth's Discord provider behind two settings and a flag (decisions 23, 60 to 62) | 8 | A test that the sign-in page offers Discord only when both settings are present; the browser pass on a stage. Not run |
| Local-first | The queue of acts kept through a reload; `Import.predict` on `ImportStatus` | 3 | The queue's test; a property test that `predict` agrees with the memory host. Not run |
| Foldkit | One admin page, "Model calls today", watching `AllowanceToday` | 7 | A test that mounts it against the memory host and sees the number fall. Not run |
| Platform contract | `Usage` unchanged in memory, on Durable Objects and on the Cluster pool | 2, 7 | Its stories on each host's harness. Not run |
| Host in memory | Under every model test and story | 1 | Every story; removing it fails them |
| Host on Durable Objects | `Usage` at 2, `Catalog` at 3, `Access` at 6 | 2, 3, 6 | The harness test; the local workerd run of the third round |
| Host on Effect Cluster | `Usage`, on the Durable Object pool (decision 27) | 7 | The pool's harness test and one call through it. Not run |
| Host on Rivet | **Cannot yet**: no Rivet control plane or pool runs on Cloudflare (decision 57) | | Its question answered |
| Backfill | `ImportHistory` added in move 5, after imports exist | 5 | An import confirmed before that deploy is in the history after it, on the preview stage. Not run |
| Observability | `Alchemy.Telemetry.layerOtlp` in the model's Worker | 2 | A test with an in-memory exporter sees a command's span and a `domain.*` metric. Not run |
| Story | Twenty-five on the review, five on the item, six on the allowance, three on members | 1 on | They run in `bun run check` |
| Test tooling | Api tests in process; the library's harness with `dev: true` | 2 | The harness test fails without a model's binding. Not run |
| Verify, Prove, Explore | `Prove.decision` per decision and the lifecycle's report, with the two decisions passed in `decisions`, in `bun run check`; `Verify.model` per model in `check:full`; a rule Verify breaks kept as a story | 1 | Each asserts every standing by name (decision 34) |
| The tutorial | Move 1 follows its parts 1 to 3 on this app's nouns | 1 | Its parts' tests are the stories and Verify tests above. Not run as the tutorial |
| The Cloudflare tutorial | Part 3 is the harness test, part 4 is `alchemy dev`, part 5's pull-request comment is the GitHub provider's `Comment` | 2, 9 | The harness test; the comment on a preview's pull request. Part 4 ran; the others not run |
| Effect Cluster | The pool that hosts `Usage`, its cron and its singleton (decision 28) | 7 | The pool's harness test. Not run |
| Workflows | The sagas above; an Effect workflow on the Worker that has D1 (decision 56) | 3, 4 | A story of each saga; the workflow's own test. Not run |
| Singletons and crons | Decision 28 | 7 | A cron fired with the clock moved; the singleton's test. Not run |
| Drizzle on Durable Objects | One import's suggestions in the import's own object (Drizzle's), behind `SuggestionStore` | 8 | The port's tests against the object. Not run |
| GraphQL | Decision 54 | 9 | A test of the analytics driver on its test layer. Not run |
| Confidence scores | Decisions 45 to 47 | 8 | A scored answer through the `Decider` adapter, and the rules answering with the key off. Not run |
| Resend | `@distilled.cloud/resend` as the `Mailer` adapter (decisions 48, 49) | 8 | A test that the mailer is the distilled client; a mail through the "mail off" Layer. Not run |
| Distilled clients | `@distilled.cloud/resend` for mail; Discord for the team's channel (decisions 52, 53); GitHub through Alchemy's provider; Grafana and 1Password's events client in the operator's scripts; Docker for the operator's check that the telemetry stack is up | 8, 9 | Each script's own test of its client. Not run |
| `@alchemy.run/1password` | The stacks' secrets written from `op://` references at a deploy. His to run; no agent resolves a reference | 9 | A deploy whose Worker reads a secret it was given. Not run |
| Alchemy Git | Decision 55. CI on it **cannot yet** (decision 58) | 10 | A commit read back from the Git Worker in its test. Not run |
| GitHub provider | Today's environments, secrets and ruleset; the `Repository` resource and a preview's `Comment`. Workflow files **cannot yet** (decision 59) | today; 9 | `GitHub.stack.ts` type-checks against the pinned provider |

### Where each read and refusal is answered from

| Read or refusal | Today | Under the model |
| --- | --- | --- |
| The decisions the Review step shows | `GET /imports/:id`, from `importDecision` | `ImportReview`, a query over the same rows, which `DraftRows` writes |
| "N of M rows need a decision" in the list of open imports | `review` over the saved decisions | The same, over the same rows |
| Whether an accept, an undone fix, a keep or an answer about the stored item is in force | `withoutStaleDecisions` (`Rematch.rules.ts`) against `MappingChoice.at` and the import's column moves | A reader over the columns at each match, each part against the fields it rests on |
| The numbers on the Result step | Read back in the confirm's own batch | `ImportResultCounts`, a query that waits for the projection |
| What a take-back would do now | D1 | D1: the handler reads which items changed, then sends `TakeBackImport` with how many of the created and of the replaced are kept |
| Remove refused while an item is in force | D1 | The import refuses on its own counts; the handler asks D1 first |
| Whether a SKU is already there | The unique index | The item's instance under decision 17's first option; the index under its second |

### The contract and the ports

| Today (`packages/catalog/contract/src/Catalog.contract.ts`) | Under the model |
| --- | --- |
| `PUT /imports/:id/decisions`: `SaveRequest { madeOn, over, set, clear }`, answers `{ revision, changed, notApplied, decidedSince }` | Gone. `DecideRow` and `UndoRowStep`; `madeOn` becomes the matching the act was made on, `changed` an empty receipt, `notApplied` the screen's reading of `MatchedSince` |
| `POST /imports/:id/commit`: `ConfirmRequest { revision, madeOn, set, clear }`, refused with `DraftMoved`, `AcceptsTakenBack`, `RevisionAhead` or `DraftBusy` | Names the last change the screen received and what it shows; carries no rows. Its handler builds the plan and sends `ConfirmImport` through `ServerApi`. `DraftMoved` becomes `ReviewMovedOn`, `PlanBehind` and `NotWhatWasShown`; `AcceptsTakenBack` cannot happen at Confirm, since the match that took an accept back is a numbered change, which the confirm must have received |
| `GET /imports/:id` | `ImportReview`, then `ImportActs`. `GET /imports/:id/table` stays HTTP |
| `POST /imports/:id/mapping`, `/take-back`, `/reopen`, `DELETE /imports/:id` | `MatchColumn`, `TakeBackImport`, `ReopenImport`, `RemoveImport` |
| The four upload endpoints | Stay HTTP for the pieces; `Upload` records begun, finished and expired |
| `POST /assistant/view` | The same call, answered in the model's Worker if its tools come from `toToolkit` |
| `/api/auth/*`, `GET /identity/session`, `GET /system/status` | Unchanged |

`DecisionDelta`, the draft's `revision` and `MappingChoice.at` leave. `RowDecision` stays as the schema of the text an
act carries.

**Two guards go with the writes.** Every write on `/api/v1` passes `SameOrigin` before identity. The model's Api has
no origin check of its own, so the site's Worker applies `SameOrigin` before it forwards a call or an upgrade, with a
test. A browser reaches only `MemberApi`; the service binding is the only way to `ServerApi`.

**The ports.** `ImportStore`'s writes go to the model; a new port holds the D1 batches the projections run; its reads
stay behind the queries. `ItemStore` follows decision 17. `Answerer` becomes `Suggester`. `AllowanceStore` follows
decision 26. In `packages/access`, `PeopleStore`, `MemberDirectory` and `AuditTrailStore` follow decisions 20 and 36.
The in-memory twins of what a model covers are retired for stories.

### What each table becomes

| Table | Under the model | Move |
| --- | --- | --- |
| `importDecision` and a new `importDecisionHistory` | Written by `DraftRows`, read as today and by `MySteps` | 3 |
| `importDraft` | Its status and its place in the acts' order written by `DraftRows`; `revision` goes | 3 |
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

## What one large import costs, under the recommended answers

One file of 50,000 rows, with the sample's share of ready rows (38,750 items), reviewed and confirmed, under the
recommended answers taken together (4, 7, 17 and 18 in particular). Two reviews: an act on every row, and an act on one
row in five. **Measured** on the final model in local workerd: 4 requests to objects an act (1 from the Worker, 3
between objects), and one more on a row's first act (its entry in the domain's directory); 131 to 151 ms an act on the
mean, one after another, timed on rows' first acts only. **Worked out, not measured:** every other number here. The
delivery to `DraftRows`, the stream's append and up to three backstop alarms are arithmetic from the host's source, so 7
to 10 requests a row's first act; rows written, about 25 an act, and everything for the items are arithmetic on the host
page (beta.87's source); the times below are the measured act multiplied. Nothing was deployed; duration (GB-s) is not
estimated.

| One 50,000-row file (worked out) | An act on every row | An act on one row in five |
| --- | --- | --- |
| Requests: the review's acts | 350,000 to 500,000 | 70,000 to 100,000 |
| Requests: 38,750 items created by the saga (decision 17) | 193,750 to at least 271,250 | the same |
| Requests: the confirm, with the six consumers this brief names | about 14 to 20 | the same |
| **Requests in all** | **about 544,000 to 771,000** | **about 264,000 to 371,000** |
| Rows written | about 2.1 million | about 1.1 million |
| Files a month in Workers Paid's included 1 million requests and 50 million rows | 1.3 to 1.8 by requests; 23 by rows | 2.7 to 3.8 by requests; 45 by rows |
| Past the included requests | $0.15 a million: about $0.08 to $0.12 a file, until rows written bind | about $0.04 to $0.06 a file |
| Objects kept for ever | 50,000 rows + 38,750 items + 38,750 item projection keys + 1 import + about 274 directory objects | 10,000 rows + the same |
| Time for the acts, one after another through the import | 109 to 126 minutes | 22 to 25 minutes |
| Time for the items to be created | not worked out (one command to one aggregate took 15 to 16 ms locally) | the same |
| D1 rows of the plan | 50,000 | 50,000 |

Under decision 17's second option the items' line goes and the files a month by requests become 2.0 to 2.9 and 10 to 14.
Under decision 4's second option an act is one request, the acts of different rows do not queue behind each other,
and the person's wait is not that of one import.

## Decisions for Benjamin

The first option of each is the recommendation, with what it rests on. One decision each, most consequential first.
Each says which earlier answers remove or change its options. Decisions 1 to 40 shape the first moves. Decisions 41
to 62 can wait until the move that needs them. Of decisions 1 to 40, all but 9 and 24 are answered
(2026-11-22), each with its first option; 7 was answered after the trial he asked for, and 8 with it; 9 and 41 fell away
with that answer; 24 stands on his earlier infra answer and was not asked again. Of 41 to 62, 57 to 59 are accepted as "cannot yet" and the others wait
for their move. "Proved" in a question is of the model named beside it, as it ran.

### 1. How does the app take what exists only on the library's `main`?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

`Decision`, `Relation`, invariants, transitions, `Verify`, and commands without `target` are not on npm. The library's
registry keeps a commit's preview build one week after `main` moves past it, then deletes it (its own `policy.ttl`
and `keepLatest: ["main"]`, `packages/pkg`), and `main` took 45 commits in a week. A lockfile pins the bytes, not
their availability.

- **Pin one commit's preview build, with its tarballs kept in the repository as the files the lockfile points at
  (Recommended).** Install, Verify and `alchemy dev` all ran from those builds. A clean copy installs without the
  registry. *Costs:* the Alchemy packages one local install took, about 60 MB unpacked (smaller as tarballs, not measured),
  in the repository; every move to a newer commit is a new set of files; six commits since the release break code
  written for it. Not verified: that the two infra stacks type-check on the pinned commit.
- **Vendor the built source of one commit**, with its commit and file hashes checked, as the beep-effect kit is. The
  same independence; 64 source files to keep, and the solver and parser the prover needs.
- **Follow the head of `main`, re-pinned at least weekly**, every trial run again at each move. Nothing kept in the
  repository; a clean install fails once a week has passed since the last re-pin.
- **Wait for the release that has them.** Until then nothing is proved, and decision 4's first two options cannot be
  built.

### 2. Two people decide the same row in the same moment. What does the second one see?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*The same options under every answer to decision 4.* His answer of 2026-11-20, "Hold it, show both, ask", is for a row
that waited, after a failed save or a reload. This asks it for a row that did not: today such a save lets the later one
win, over a decision its sender never saw (a row not named in a save's `over` is not checked, `Waited.rules.ts`).

- **The same: theirs is held, the row shows both with whose is whose, they pick one, and Confirm waits until they do
  (Recommended).** *Rests on:* that answer, "never change a value silently", and his rule of 2026-11-19 that nobody's
  decision is overwritten at Confirm; `ADecisionIsReplacedOnlyByAnActThatSawIt` is proved (trial 13) and a story shows it.
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

### 4. Where do review decisions live?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Changes with decision 1:* its fourth answer leaves no option proved. *With decision 2:* its third answer takes one
rule out of every option.

- **The import's lifecycle as one instance, one instance per decided row, and every act a decision across both
  (Recommended).** *Proved:* 93 rules of the model as it would be hosted (trial 13), by name in the table under
  "Sketch". *Checked:* one relation, and two rules across every import and row. *At Confirm:* "nothing is confirmed that
  was not on screen" is held by three proved rules and two halves left to tests, of which one property ran, as the table
  says. *Two people, one row:* decision 2. *An undo over a row someone changed:* it takes back the rows that still hold
  the step and says which ("Undone for 11 rows. Row 14 was changed by Dana and stays"); each row's undo is its own act.
  *Costs:* 4 requests to objects an act (1 from the Worker, 3 between objects), 5 on a row's first, and 131 to 151 ms an
  act on the mean in local workerd, timed on rows' first acts (the final model, trial 14); every act goes through the
  import one after another, so a group of 6,000 rows is 13 to 15 minutes, worked out from that, and two people acting in
  the same moment make one of them retry (the library retries for about 20 seconds); the whole of one large import is
  under "What one large import costs". *Kept for ever:* one object for each decided row, with its acts' events and
  receipts.
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

### 7. How is an act on a group of rows carried?

**Answered 2026-11-22: the first option**, the group as one unit ([DECISIONS.md](DECISIONS.md), "Answered"). Asked
first on the same day, he chose to have that design run as a trial before deciding; it ran (trials 15 to 17, the fifth
round), the recommendation changed to it, and he took it. The others are kept below as what was rejected. Decision 8 is
answered with it; decisions 9 and 41 fall away.

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
  whole group it does not. *By a story, not by a rule:* an act with the same text on a row a group covers is a change.
  *What the person sees:* the group is saved at once; Confirm does not wait for it; another person's act on any row,
  made before the group reached their screen, is refused and shown again, whether or not the group names that row; a
  group pressed on a screen that is one change behind is refused and pressed again. *Not run:* the screen that computes a
  group's rows, the screen and the projection that read a row through the groups, what a match does to a group in force,
  and the projection's write of 6,000 rows after the one event. *It asks one more thing:* which group may be taken back
  (decision 8).
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

### 8. While one person's group is being sent, what can the others do?

**Answered 2026-11-22: the first option**, only the import's last group act ([DECISIONS.md](DECISIONS.md), "Answered").

*Under decision 7's first answer, the group as one unit, this question is another: which group may be taken back?*
Ana accepts a fix on 2,340 rows; Dana then accepts another on 900, some of them the same rows; Ana undoes hers.

- **Only the import's last group act; an earlier one is refused and says which came after (Recommended).** *Proved*
  (trial 15, `review12last`): `OnlyTheLastGroupActIsTakenBack`, 84 paths. The undo is then exact: today's `act` undoes
  only the last step too. Ana takes hers back after Dana takes back hers, or decides the rows again.
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

A person begins a group and then loses the editor's role, leaves, or their saga dies. Until the group is over nobody can
confirm, match a column or remove the import.

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

### 11. A decision its maker took back lies under another's. When that one is undone, does it come back?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Ana leaves 12 rows out as one act. Dana, seeing that, types a quantity on one of them, row 14, instead. Ana undoes the act:
11 rows are undone, and row 14, which is Dana's now, stays. Dana undoes the quantity. Is row 14 left out again, as
Ana's, who took that back?

- **Yes: an undo puts back exactly what was under it, whose it was, and the screen says so ("Row 14 is left out again, as
  Ana had it") (Recommended).** *Rests on:* undo today is exact. *Proved:* `AnUndoPutsBackTheDecisionThatWasThere`,
  `AsTheirsWhoMadeIt` (trial 13). Ana sees the change and can undo it.
- **No: what its maker took back while it lay under is passed over.** The row would have to mark a level as taken back,
  inside a text it only compares, so its seal would have to be brought for that too. Not run.

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

### 13. An act made before a confirm arrives after the import was opened again. Is it taken?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Ana's "leave out" waits while she is offline. Dana confirms, and opens the import again. His answer of 2026-11-20 for a
closed import was "Name the rows, then drop them"; it did not speak of one opened again. The same for an undo, a match
or a group made before the confirm.

- **No: it is refused and the screen names the row, as for a closed import (Recommended).** *Proved:*
  `AnActIsOfThisOpening`, `AnUndoIsOfThisOpening`, `AMatchAndAGroupAreOfThisOpening` (trial 13).
- **Yes: it is recorded on the row**, whose item may already be in the system.

### 14. What is a keep of one of two rows, when someone decides the other row meanwhile?

**Answered 2026-11-22: the first option**, one act on the kept row ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected. It was put to him as not run, and it is in no model: every model here decides
one row an act. The likely shape is a unit of two parts, the kept row and the rows left out, as decision 7's group is a
unit of parts; the reading of a keep through such a unit equalled today's `act` in trial 16, and it was not run as a
decision.

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

### 16. Is Remove refused when its sender has not seen the import's last change?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Today Remove names nothing it saw, and deletes every decision on the import.

- **Yes, and while a group is being sent (Recommended).** *Proved:* `TheRestNameEveryChangeToo`,
  `NothingEndsAReviewWhileAGroupIsSent` (trial 13).
- **As today.**

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

### 21. Are Better Auth's own writes to `member` closed?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

*Asked under decision 20's first or third option.*

- **Closed: the People page's commands are the only way to change a member, and Better Auth's organization endpoints
  that write are turned off (Recommended).**
- **Sent through commands by a hook on Better Auth's writes.** Better Auth's screens keep working; the hook is ours to
  keep working across its changes.

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

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Measured on the final model (trial 13), each with the machine's load average beside it: `Prove.decision` proves
`Deciding` in 25 s (load 26 to 33) and `Undoing` in 284 s (load 48 to 26); `Verify.aggregate` of the lifecycle alone
ends `NotVerified` in 5 s (load 49 to 48), because the lifecycle folds `ActCounted`, which only a decision records, so
its report must pass the two decisions in `decisions`; `Verify.model` verified in 461 s at a load average of 33 rising
to 56. A quiet machine was not at hand. Two decisions declared in one file and passed to one report fail with a
`ProveError` (the library loads the file before it adopts the second decision; one decision a file avoids it).
`bun run check` goes through turbo, which replays a package's result until something it reads changes.

- **The decisions' and aggregates' proofs in `bun run check`, each model's search in `check:full` and CI
  (Recommended).** About 5 minutes more, worked out as the sum of the three, before a commit that changes the review's
  model, and nothing before any other. Every test asserts each rule's standing by name; a rule that slips from proved to
  checked fails before the commit, and only the relations and model rules wait for `check:full`.
- **All of it in `check:full` and CI only.** `bun run check` stays as fast as today; a broken rule is seen later.
- **All of it in `bun run check`.**

### 35. How does a stored state or event change shape?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

- **By rule (Recommended):** a new field is an optional key; a new meaning is a new event; a state whose shape must
  change is a union of the old and the new; until the first production deploy, a preview stage and local objects are
  wiped instead.
- **Always wipe.** Fine only while nothing real is stored.

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

Nothing is deployed today; the rows that exist are in development databases.

- **Adopt at first touch (Recommended).** The first command that reaches an instance with rows in D1 and no events is
  preceded by an `Adopt…` command built from those rows, under an id that makes a second send do nothing: imports in
  move 3, items in move 4 under decision 17's first answer (at an item's first edit or take-back), organizations and
  members in move 6, the allowance's count in move 2.
- **Adopt everything at a deploy**, by the operator's command line.
- **Start empty.** Open drafts are confirmed or removed before the move; stored imports become history that cannot be
  taken back.

### 38. What does Remove do once decisions are events?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

Today Remove deletes an open import's decisions and staged rows. The library never deletes an instance's events.

- **The import is marked removed and its rows in D1 are deleted; the events stay in the objects (Recommended).** The
  person sees what they see today.
- **The app also deletes the objects' storage**, through a route of its own on the model's Worker. Removed means
  removed; the route is ours to keep working.

### 39. What is kept for ever?

**Answered 2026-11-22: the first option**, the one recommended ([DECISIONS.md](DECISIONS.md), "Answered"). The
others are kept below as what was rejected.

What the library keeps, beyond Remove: one object for each decided row and each item, with their events; one
projection key per item; a removed member's email in the events that added them.

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
2026-11-22** with his answer to decision 7, under which every group is a unit. It was for decision 7's third answer. In local workerd 13 to 15 minutes for 6,000 rows row by row, worked
out from trial 14, and a median of 214 ms as a unit (trial 17). Options: 1 minute; 5 minutes (Recommended, as a first number to
measure against on the preview stage); no limit.

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

Under decision 30's second answer, every move's browser pass also needs a preview stage he deploys.

## Rabbit holes

- **One path too many.** A union in a state or a command is a path per member; so is each side of an `&&`, `||` or `?:`
  the prover cannot settle, in the code and in every rule of every aggregate a decision reads. The hosted review passed
  4,096 paths twice on the way and proved nothing then; `Deciding` has 332 and `Undoing` 2,652 now. Every field, rule
  or check added to a row or the import is run through `Prove.decision` before it is merged, and a rule is one comparison.
- **A proved rule with a name that promises more.** Three models of this review were proved and wrong. Each rule's test
  has a mutant beside it that removes its check and must break that rule (sixteen ran), and stories of what a person
  would call wrong are written against each model before its rules are asserted. The final model has not had that pass.
- **The time of a group act.** 131 to 151 ms an act on the mean in local workerd; decision 41 sets the limit.
- **Checked is not proved.** The review's relation stands on a search 2 commands deep and 200 walks of up to 7; its
  two model invariants on a search 3 commands deep and 200 walks of up to 7; the members' relation and model invariant
  on a search 4 commands deep; `EveryUploadEnds` on a search 2 commands deep, where it holds at the end of the 116
  sequences that ran their course, and 200 walks of up to 4.
- **The confirm's handler.** It waits for the projection before it builds the plan. A projection that keeps failing
  holds every confirm of that import behind it, and the screen says "still saving".
- **A sender that is not an Api** (a policy, a saga, a scheduled command) must itself provide the actor a command's
  middleware would.
- **The first read and the stream must meet.** The query returns the rows with their place in the acts' order, and
  the stream is followed from that place. No read ran in any trial.
- **A deployed object.** 8 MiB is local workerd's limit; the widest row the contract allows, 15 fields of 32,767
  characters over another such decision, is at most about 3 MB in UTF-8 (arithmetic), under it.
- **`main` moves.** One commit is pinned; every trial is run again when it changes.
- **Never rename a model**, and a deploy that adds an object class goes out whole.

## No-gos

- No change to a rule of an import, to what a count means, or to a sentence the person reads, except where a decision
  names the change and he chooses it. The decisions whose options name one: 2 to 20,
  22 to 25, 31, 37, 38, 42, 43, 45, 47, 48, 49, 52 and 62.
- `review` stays one pure function, run by the screen and by the server at the confirm. It does not move into
  `decide`.
- A model still proposes and never writes.
- No R2 presigned uploads.
- No deploy, login, state command or key by an agent. No `op://` reference resolved by an agent.
- Nothing built before he signs and the atoms goal is merged.

## Proof (the definition of done)

1. Every row of "Every single thing" passes the check in its last column.
2. Every Verify and Prove test asserts the standing of every rule of its table by name. Under the recommended answers:
   the review's 93 proved, its relation and its two model invariants checked; the item's 10, the allowance's 7 and the
   members' 19 proved; their relation and model invariant checked; `EveryUploadEnds` checked. Beside each rule of the
   review, the mutant that breaks it.
3. The property test of the client fold against the real model on the memory host, with the orderings as named cases
   (another person's act before the screen's own waiting act; a second tab; a group under way; a reload with acts
   waiting; a match beside a waiting accept), and the rule: every act the person made is in the model's events or in
   the queue.
4. Each projection batch run twice with the same input writes once; a confirm sent while `DraftRows` is one act behind
   waits and builds its plan at the last change.
5. Through the model's Api in process: a member of the second organization and a viewer against every command, view
   and stream, each ending in its rejection; a call from another origin refused before identity.
6. In two browsers, as two people on one import, on a fresh database and on the runtime decision 30 names: different
   rows decided in both; the same row decided in both; an undo after the other changed the row; a confirm while the
   other decides; a confirm with acts waiting while the other decides; a reload with an act waiting; a match beside
   the other's accept; a group act while the other confirms. Then `items_messy.csv` through Confirm with the three
   numbers read (200 rows, 155 imported, 155 stored), at phone width and in both themes.
7. On a preview stage he deploys: the requests and rows written by one act, one group act of the sample's largest
   group, one confirm and one item, read from Cloudflare's analytics, each within twice the numbers under "What one
   large import costs"; and the time of a group act of 6,000 rows; a confirm of 38,750 items
   to its end, before the Items page reads them.
8. `bun run check:full`.

## Map

Four goals, each opened from this brief when the one before it is done. Under the recommended answers:

| Goal | Moves | First slice | Existing code it changes | Net new |
| --- | --- | --- | --- | --- |
| `domain-core` | 0 to 2 | The day's model calls counted by the `Allowance` aggregate and seen on the status line | `packages/infra/src/Inventory.stack.ts`, `packages/access/model` (the allowance's port), `apps/inventory/package.json` (`dev`) | The review's model and its tests in `packages/catalog/model/src/Import/`; the model's Worker; `Usage` |
| `domain-import` | 3 to 5 | One act of the review saved through the model, in two browsers | `packages/catalog` (all four packages), `packages/review`, `apps/inventory/migrations`, `docs/standards/undo.md`, `CLAUDE.md` | `DraftRows`, `ImportActs`, the markers, `Item`, `Upload`, the sagas |
| `domain-access` | 6 | A person added by email through `AddMember` | `packages/access` (all four packages), the sign-in options | `Organization`, `Member`, `MemberEmail`, `MemberRows`, `AdminApi` |
| `domain-extras` | 7 to 10 | `Usage` on the Cluster pool with its cron | `packages/infra`, `packages/drivers` | The pool, mail, the channel, scores, the operator's surface, the history |

## Order of moves

After he signs and the atoms goal is merged. Each move ends with `check:full` and the browser pass, leaves the app
working, and rewrites the parts of `CLAUDE.md`, `README.md` and `docs/standards/` that it makes untrue (the feature
recipe of port, D1 adapter and `/api/v1` endpoint; "one atomic write"; "Storage is Cloudflare D1"), as part of its
proof. It is written for the recommended answers; decision 40 reorders 2, 3 and 6.

0. **The library**, as decision 1 says, and the two infra stacks checked against it.
1. **The review's model, in memory.** The import, the row, the two decisions, their stories, their Verify and Prove
   tests with every standing asserted, and the fold's property test against the model. Nothing the person sees;
   nothing stored.
2. **The host and the first slice.** The model's Worker, `bun run dev` as decision 30 says, the session, the two
   guards, the Api tests in process, the harness test, telemetry. The first slice is the allowance: its aggregate, its
   view, and each model call's take going through it, with today's count adopted. His deploy to a preview stage.
   *Interim:* every import still runs on D1 as today.
3. **The import's write side, in one move.** Stage, acts, group acts, match, suggestions recorded, confirm, take-back,
   reopen, remove; `DraftRows` and the batches with their markers; under decision 17's first answer, `Item`, its saga
   and `ItemRows` in the same move, so the confirm's items are written once in their final shape; adoption at first
   touch; the Review step's fold, queue and stream; the review region's change; his deploy, and the group act and the
   confirm measured. `PUT /imports/:id/decisions` and `SaveRequest` leave. *Interim:* the lists, the staged table and
   the suggestions' handler still read D1, which `DraftRows` keeps written.
4. **The Items page** as queries; `EditItem` as a command; items stored before move 3 adopted at first touch.
5. **The rest of the import**: `Upload` with its deadline, suggestions as a saga, the lists as queries,
   `ImportHistory` and its backfill.
6. **People**: `Organization`, `Member`, `MemberEmail`, the three decisions, `MemberRows`, `AdminApi`, adoption of the
   organizations that exist; reads end on removal.
7. **Cluster**: `Usage` moved to the pool with each day's count adopted, its cron and singleton, the admin's live
   page.
8. **Mail, the channel, Discord sign-in, scores, the suggestions' object.**
9. **The operator's surface**: the command line, its HTTP document, the assistant's tools, the MCP server, the
   analytics driver and panel, the operator's scripts, secrets at a deploy, the repository resource.
10. **The history and the mirror.**
