---
type: Brief
title: "Brief: the app on @alchemy.run/domain"
description: How inventory-import uses all of @alchemy.run/domain and the extras Benjamin asked for. The saving of review decisions is modelled first, in the shape the app would host, with the app's fifteen fields, and Verify proves its rules; then one table of every concept with its worked instance, its move and a check that fails without it; then the decisions that are his, one decision each, most consequential first, with what one large import costs under the recommended answers. Written only; nothing is built until he signs and the atoms goal is merged.
---

# Brief: the app on `@alchemy.run/domain`

Benjamin, on 2026-11-19: "Not borrow use.", and "if possible find a way to make use of ever single thing". Of the
pull request that adds `Verify`: "I'm particularly excited about this". That reverses the 2026-11-18 decision "core";
his words are in [CAPTURE.md](CAPTURE.md). Three rounds of trials stand behind this brief, with every source and
report on [the trial page](research/07-review-decisions-trial.md).

Three rules shape every recommendation here:

- **A recommended option does not give up what Verify proves.** Where a shape exists under which a rule is proved,
  that shape is recommended and what it costs is stated as a cost. Where none exists, the question says so, with the
  exact limit in the way.
- **A recommended option never drops something he asked for or answered.** No option leaves out the library or an
  extra he asked for without saying what is in the way and what removes it.
- **An option that goes against a dated answer of his says so**, with the answer and its date.

Nothing here is built. **The build starts after Benjamin says the brief matches, and after the atoms goal is merged
into main.** "Today" in this brief is the atoms branch at `d7594bd`, the commit the build starts from; its final
commit is named when the atoms goal lands.

## Problem

No file in the repository imports `@alchemy.run/domain`. Each rule that matters is held by a guarded D1 batch behind a
port, and checked by tests that sample it.

- **A save can still overwrite a decision its sender never saw.** Today a save names the draft revision it was made
  on (`madeOn`) and answers whether it changed anything and which accepts it did not apply; a confirm names the
  revision the screen shows, carries the person's unsent rows, and is refused with `DraftMoved` or
  `AcceptsTakenBack`. What is still open there: a save's rows to set and to clear are not checked against `madeOn`,
  so the last save wins over a newer decision by someone else, and any caller of the contract can send a stale clear
  (the atoms head, `Imports.handler.ts` and `ImportStore.adapter.ts`; the screen avoids the orderings it knows).
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

- **The review in the shape it would be hosted is proved: 32 rules, 1 relation checked**, by `Verify.model` in 82 s.
  That model has the app's fifteen fields, a confirm that names the last change its screen received and the change its
  plan was built at, a group act being sent, the answer "no change", accepts named by the import's matching, and undo
  checked by step at every depth. `Prove.decision` proves each of its two decisions alone in 12 s and 4 s.
- **What un-proves it, exactly**: the prover tries each member of a union in a state or a command as its own path, and
  takes both sides of every `&&`, `||` and `?:` whose condition it cannot settle. Written with unions for "none yet"
  and the fifteen accepts compared one by one, the same model passed 4,096 paths in both decisions,
  and `Verify.model` proved nothing (716 s, search cut at 2 commands). Written with the empty text for "none yet" and
  one number for the accepts' matching, it proved every rule but the relation, which is checked. The two causes were not run apart.
- **One act across two objects, on the domain's Durable Object host in local workerd**: an accepted act made 4
  requests between objects and took about 110 ms; a refused one made 3 and changed neither object; of two acts raced
  on one row, one was recorded on both and the other refused. A deployed object was not tried.
- **One value in a Durable Object may be about 8 MiB** through the domain host in local workerd (8.3 MB stored, 8.5 MB
  refused with `SQLITE_TOOBIG`). The 2 MiB in the library is a guard of its cluster package.
- **An item held as text proves its ten rules**, replace and restore in turn included (3.6 s). With its tags and
  vendors as lists, all eleven are only checked (788 s).
- **The allowance by the UTC day proves its seven rules** with no reset command and no cron, the day held as a day
  number. Today's rolling 24 hours, held as a list of times, is only checked.
- **Members as their own instances prove 19 rules**, an admin changed only by an admin in the record among them; that
  the counts equal the members is checked.
- **One instance per import proves nothing**, by the prover's design (a list is tried with at most 2 items more than
  its schema asks for); its state passes 8 MiB at about 42,800 decided rows.
- **What the prover reads**: handlers written `Effect.fn("name")(…)`; an id or a value schema from another package;
  not a request context imported from another package; `new Event(…)`, not `Event.make(…)`.

## Sketch

### The review, in the shape Verify proves

| Block | What it holds | What it decides |
| --- | --- | --- |
| `Import`, one instance per import | Its status (open, imported, taken back, removed), its organization, its count of column matches and each field's last match, the step of its last change, which screen made the changes since anyone else's last one, the group act being sent, the items in force and the confirms standing. No rows | Stage, match a column, begin and end a group act, record a suggestion, confirm, take back, open again, remove |
| `Row`, one instance per decided row | The row's decision as text, the matching its accepts were made on, who made it, in which step, its label; the decision under it in full and the step that one replaced | Nothing alone |
| `Deciding`, `Undoing`: decisions across one import and one row | Nothing | One act of the review, read from both instances and recorded on both or on neither |

In the trial the import is `ImportLife` and the row `RowUnit` (the trial page, "The third round"). A step is the id
the screen gives one act at the press; the empty text names no change. Five things are said by naming a step or a
matching, never by counting:

- **An act names the decision it saw on its row.** It is recorded only if that is still the row's decision.
  Otherwise it is refused with `DecidedSince { by, step }`. A person's second act on a row names their own first,
  which the screen made the id of, so it works while the first is still on its way.
- **An act that would leave the row as it is records nothing.** Its receipt has no events, and the answer says
  "no change": his answer of 2026-11-19.
- **An act's accepts name the import's matching they were made on.** Any column matched since and the act is refused
  with `MatchedSince { matching }`; the screen sends it again without the accepts whose field was matched since and
  says which were taken back. A match changes no row: it raises the import's matching and marks its own field.
- **A confirm names two changes**: the last change its screen received (`seen`), and the change its plan was built
  at (`planAt`). It is taken only when every change after `seen` came from the same screen, `planAt` is the last
  change, and no group act is being sent. Otherwise `ReviewMovedOn`, `PlanBehind` or `GroupUnderWay`.
- **An undo names the step it takes back and what goes under the decision it puts back**, checked by the step that
  decision replaced. Otherwise `NotYourStep` or `HistoryBehind`.

The decision a row holds is text: the text the `importDecision` table holds today, read through the contract's
`RowDecision` schema by the screen and by the server's `review`. No rule reads inside it. That encoding is what lets
the rules be proved, so it is part of the design.

**Every rule, what it is proved of, and what holds the rest** (`Verify.model(Review)`, 82 s):

| Rule, in words | Name | Standing | Proved of | What holds the rest |
| --- | --- | --- | --- | --- |
| A decision is replaced only by an act whose sender saw it | `DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt` | proved | The step the act names and the row's step | |
| No command clears a decision its sender did not make | `RowUnit.NobodyClearsAnotherPersonsDecision` | proved | The row's maker and the actor | |
| An act that changes nothing records nothing | `DecideRow.AnActThatChangesNothingRecordsNothing` | proved | The row's text and accepts' matching | |
| Any other act is recorded as said and is the import's last change | `DecideRow.TheActIsRecordedAndCounted` | proved | The row and the import's last step | |
| An act's accepts are made on the matching now | `DecideRow.AnActsAcceptsAreMadeOnTheMatchingNow` | proved | One number the act states for all its accepts | Which fields the text accepts, and whether each is still in force: `acceptInForce`, which every reader calls; a test |
| A match marks only its own field | `ImportLife.AMatchMarksOnlyItsOwnField` | proved | The import's matching and each field's last match | |
| A row is decided only on an open import | `DecideRow.ARowIsDecidedOnlyOnAnOpenImport` | proved | The import's status | |
| A confirm is taken only when every change after the one its screen names came from that screen | `ImportLife.AConfirmIsOfWhatItsScreenHadReceived` | proved | The steps and the screen id the confirm states | That the screen names what it received and sends Confirm only after its own acts came back recorded: the fold's property test |
| What a confirm writes was worked out at the import's last change | `ImportLife.APlanIsOfTheLastChange` | proved | The step the plan names | That the plan was built from rows written up to that step: the handler waits for the projection; a slow test |
| No confirm while a group act is being sent; a group is ended only by who began it | `ImportLife.NoConfirmWhileAGroupIsSent`, `.AGroupIsEndedOnlyByItsSender` | proved | The import's group | That the saga ends its group: a story, once the saga runs |
| An undo takes back only its sender's own step, puts back exactly what was under it, and under that the decision it replaced | `UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep`, `.AnUndoPutsBackWhatWasThere`, `.UnderWhatIsPutBackIsWhatItReplaced` | proved | The first level in full; deeper levels by step | The text of the levels below the first: read from the projection's history; a test |
| A row has no decision again only when nothing was under it | `RowUnit.ARowIsUndecidedOnlyWhenNothingWasUnder` | proved | The row | |
| Outcomes add up to the rows; no count is negative | `ImportLife.OutcomesAddUpToTheRows`, `.NoCountIsNegative` | proved | The counts the confirm and the take-back state | That they are what is stored: the Result step's query reads them back |
| The status becomes Imported only by a confirm; a confirm of a closed import leaves its status | `ImportLife.NothingIsWrittenBeforeConfirm`, `.AConfirmOfAClosedImportWritesNothing` | proved | The status | That a batch never writes twice: the marker and its test (Proof 4) |
| Only an imported file is taken back; the kept count recorded is the one stated | `ImportLife.OnlyAnImportedFileIsTakenBack`, `.ATakeBackKeepsWhatWasChanged` | proved | The status and the count the take-back states | That a changed item is kept: the item's own rule under decision 8's first option, SQL under its second |
| A suggestion writes nothing | `ImportLife.ASuggestionWritesNothing` | proved | The matching, last change and confirms | |
| Nothing of a closed import's review changes; it opens only by Reopen | `ImportLife.OnlyAnOpenImportIsReviewed`, `.AnImportIsOpenedAgainOnlyByReopen` | proved | The status | |
| A removed import stays removed; only an open one with nothing in force and every confirm taken back is removed | `ImportLife.ARemovedImportStaysRemoved`, `.OnlyAnImportWithNothingInForceIsRemoved` | proved | The counts the confirms and take-backs stated | That no item of it is in D1: the handler asks D1 first, as today |
| Tenancy and viewers: an import and a row never change organization; only their own organization changes them; a viewer changes nothing | `ImportLife.AnImportNeverChangesOrganization`, `.OnlyItsOwnOrganizationChangesAnImport`, `.AViewerChangesNothing`; `RowUnit.ARowNeverChangesImportOrOrganization`, `.OnlyItsOwnOrganizationChangesARow`, `.AViewerChangesNothing` | proved | The actor the request context holds | That the session fills it truly: an Api test in process (Proof 5) |
| A decided row belongs to the organization of its import | `Review.ARowBelongsToItsImportsOrganization` | checked, 2 commands deep and 200 walks | | |
| What a screen shows is never ahead of what it has been told | The client fold | a property test, not Verify | | |

Outside every rule: what a decision contains (a typed value, which proposal, which of two rows is kept), held by
`review` and its tests; anything a projection writes, a query or a stream gives (Verify's report: "what a projection
writes, and what a stream or a query gives, is not checked"); and that a decision's events commit on both objects or
on neither, which Verify assumes and the local workerd run showed.

**Nothing evaluates a rule when the app runs.** What refuses a state in the running app is the code of `decide`. A
proved rule means that code cannot break it; a checked rule means no short sequence did.

### What the screen sends, and what it follows

**It sends one act at a time, in order, each with its step, the screen's id and a command id made at the press.** A
resend with the same command id answers the first receipt. A rejection ends that act and says why. A failure that may
pass keeps the act waiting, with "Save again".

**Acts that wait are kept.** The person's acts the server has not answered are kept in the saved progress. After a
reload they come back marked not saved yet and are sent again; the browser asks before the page is left while any
wait. His answer of 2026-11-20: a decision the person made is either on the server or still waiting, never neither.

**It follows a stream of acts.** A projection, `DraftRows`, is given the import's events, which hold every act of the
import in one order and name its row. In one D1 batch it writes the row's decision to `importDecision` and the act to
the row's history, and moves the import's place in that order; it appends the act to a stream, `ImportActs`, keyed by
the import. The screen reads the decisions once, with their place, by a query over those rows, then receives each act
as it is appended. A stream's entry holds the act alone.

**What the screen shows** is the rows as last read, the acts received since, and the person's own acts not among
them yet, folded with the app's review rules. It names steps; it never works out a number.

**The confirm, both halves.** The screen sends Confirm only after its own acts have come back recorded; it names the
last change it received and its own id. The handler waits until `DraftRows` has written up to the import's last
change (the projection's `caughtUp` on that change's receipt), reads the rows and the place in one D1 read, runs the
same pure `review`, stores the plan with that place, and sends `ConfirmImport` naming it. A change by anyone else that
the screen had not received refuses it (`ReviewMovedOn`); so does a change after the plan (`PlanBehind`). The
import's half is proved; the screen's and the handler's are tested (Proof 3 and Proof 4).

**The group act.** `BeginGroup` marks the import; the saga sends one act per row under the group's step; `EndGroup`
clears the mark. Until then no confirm is taken, from anyone. The person's later acts wait in their queue until the
group ends, because an act on a row the saga has not reached would name a decision that is not there yet.

### What becomes of `Draft.machine.ts` and the atoms

`packages/catalog/web/src/Draft.machine.ts` at the atoms head is one pure transition, `step(draft, event) -> { draft,
effects }`, with a property test over random orderings. It stays, smaller. The parts that hold his five answers move
as follows.

| Part today (atoms head) | Holds | Under the model |
| --- | --- | --- |
| `held`, `shown(draft)`, `epoch`, `Restart`, `onScreen` | The server's picture and what is drawn | Stay: the rows as last read and the acts received since; `shown` is the fold the property test checks |
| `flight`, `unsent`, `stalled`, `landed` | Saves on their way | One ordered queue of the person's acts, each with step and command id |
| `Opened { kept }`, `waitingKept` in `ReviewDraft.atoms.ts` | "Keep them and send them" | Stay: the queue is what is kept, and it is sent again after a reload |
| `ViewArrived { open }`, `closing`, `leftOver`, `LeftOverNamed` | "Name the rows, then drop them" | Stay: the stream says the import is confirmed; the queue sends nothing more; the Result step names the left-over acts |
| `ConfirmPressed`, `ConfirmMoved`, `ConfirmStale` | "Refuse, show, confirm again" | Stay, on new causes: Confirm waits for the queue to empty; `ReviewMovedOn` and `PlanBehind` are `ConfirmMoved`, and the screen draws again from the stream |
| `madeOn`, `notApplied`, `withoutStaleAccepts`, `MappingChoice.at` | "Server refuses, screen says so" | `madeOn` becomes the act's `acceptedOn`; `MappingChoice.at` becomes each field's last match on the import; `notApplied` becomes the screen's reading of `MatchedSince` |
| `changed` in `SaveAnswered` | "Answer says 'no change'" | A receipt with no events |
| `Send { delta }`, `deltaOf`, `over` with a clear, `SaveAnswered`'s revision cases, `Put`, `Ask`, `matching`, `MatchStarted`, `MatchEnded` | The difference between two pictures | Go: an act is sent, and the stream brings the rest |
| The test's hand-written server | | Goes: the test drives the real model on `Domain.InMemory` |

**The review region changes too.** `packages/review` keeps its own undo and redo stacks and hands its whole state to
its caller after every action. Under the model each action carries a step and names its rows; Undo and Redo are
handed to the caller as acts; the stacks are filled from the person's steps on the server. His answer A6 (2026-11-19)
keeps `Action` a `Data.TaggedEnum` until an action is stored or sent; under the model an act is sent as a command
whose text is the row's decision and whose label is stored, so `Action` itself is neither, and A6 stands.

### The undo history

- **Undo is an act**: `UndoRowStep`, for each row of the step. It is taken only for the sender's own step while that
  step is the row's decision, and puts back what was under it.
- **The history is the person's steps, read from the database**: `MySteps`, a query over the rows `DraftRows` writes
  (the step, who, the label, the rows it named, and what each row held before). It is the same after a refresh and on
  another device. A step is in force on the rows that still hold it.
- **A deeper undo reads the row's history** from the same rows, after the projection has caught up, and names the
  decision that goes under the one it puts back; the row checks it by step.
- **Redo is the undone step sent again as a new step.**

### His answers, carried into the model

His five answers given by dialog, built on the atoms branch, each with what the model holds and what stays tested.

| Answer (date) | In the model | Proved | Tested |
| --- | --- | --- | --- |
| "Answer says 'no change'" (2026-11-19) | An act that leaves the row as it is records nothing; its receipt has no events | `AnActThatChangesNothingRecordsNothing` | That the screen reads an empty receipt as "no change" |
| "Refuse, show, confirm again" (2026-11-19) | The confirm names the last change its screen received and the change its plan was built at | `AConfirmIsOfWhatItsScreenHadReceived`, `APlanIsOfTheLastChange`, `NoConfirmWhileAGroupIsSent` | The screen's and the handler's halves |
| "Keep them and send them" (2026-11-20) | The queue of acts, with command ids, kept through a reload | | The fold's property test: every act is in the events or in the queue |
| "Name the rows, then drop them" (2026-11-20) | Nothing is decided on a closed import | `ARowIsDecidedOnlyOnAnOpenImport` | The Result step names the left-over acts |
| "Server refuses, screen says so" (2026-11-20) | An act's accepts name the import's matching; a match marks its field | `AnActsAcceptsAreMadeOnTheMatchingNow`, `AMatchMarksOnlyItsOwnField` | `acceptInForce` for every reader; the screen says which were taken back |

### Every single thing

One row for every page of [the map](research/00-map.md) and every extra he named: its worked instance, the move it
lands in, and the check that fails when it is missing. "Not run" marks an instance no trial has run; every other row
ran in a trial named on the trial page.

| Concept | Worked instance | Move | Fails when missing |
| --- | --- | --- | --- |
| Model | `Catalog`, `Access`, `Usage` | 1, 6, 2 | `Verify.model` of each, every rule's standing asserted by name. The trials ran `Review` and `Access`; `Usage` not run |
| Command, event, rejection | `DecideRow`, `RowDecided`, `DecidedSince`; `ConfirmImport`, `ImportConfirmed`, `ReviewMovedOn` | 1 | The eight stories of the third round |
| Aggregate | `Import`, `Row`, `Item`, `Allowance`, `Organization`, `Member` | 1, 4, 2, 6 | Their Verify tests |
| Annotations | A description on every served command, view, stream and query, and on each Api | 1 on | A test that fails on a served declaration with none. Not run |
| Decision | `Deciding`, `Undoing`; `AddMember`, `ChangeRole`, `RemoveMember` | 1; 6 | `Prove.decision` of each in `bun run check` |
| Relation | `ARowBelongsToItsImportsOrganization`; `AMemberWhoIsInIsCounted` | 1; 6 | Asserted "checked" by name |
| Invariants and transitions | Aggregate invariant `OutcomesAddUpToTheRows`; aggregate transition `AConfirmIsOfWhatItsScreenHadReceived`; decision transition `ADecisionIsReplacedOnlyByAnActThatSawIt`; model invariant `NoRowIsDecidedOnARemovedImport` across `Import` and `Row` (not run; the one that ran, `EveryConfirmedFileAddsUp`, read one aggregate); model `eventually` `EveryUploadEnds` | 1, 5 | The standing table; the model invariant and `eventually` asserted "checked" |
| Unique values | The email an admin adds a person by (`MemberEmail`); a SKU per organization under decision 8's first option | 6; 4 | A story: two admins add one email, one is refused. The SKU not run |
| Deadlines | `ExpireUpload`, scheduled when an upload begins | 5 | A story with the clock moved past the deadline; the `eventually` rule |
| Project layout | Blocks in each context's `model` package (decision 23) | 1 | A block Verify cannot read fails its test as "not read" |
| View | `ImportStatus`, `AllowanceToday` | 3; 2 | An Api test in process reads each. Not run |
| View security | Every view and stream checks the organization and the role, and the member record on each push (decision 13) | 2 on | An Api test in process: a member of the second organization and a viewer against every command, view and stream. Not run |
| Stream | `ImportActs`; `ImportHistory` | 3; 5 | The fold's property test reads it after a cursor. Not run |
| Query | `ImportReview`, `MySteps`, `ImportResultCounts`; `ItemsPage`, `ItemFacets`; `OpenImports`, `PastImports` | 3; 4; 5 | Slow tests on D1; a story on the memory store. Not run |
| Reads and consistency | The confirm's handler waits for `DraftRows`; the Result step reads with the confirm's receipt | 3 | A slow test: Confirm sent while `DraftRows` is one act behind. Not run |
| Projection | `DraftRows`; `ItemRows` (decision 8); `MemberRows` | 3; 4; 6 | Each batch run twice with the same input writes once. Not run |
| Policy | `UploadDeadline`; `SuggestOnAsk`; `MailOnConfirm`; `TellTheChannel`; `EndReadsOnRemoval` | 5; 5; 8; 8; 6 | `Verify.model` runs each behind the others; a story. Not run |
| Saga | `GroupAct` (decision 5); `CreateItems` (decision 8); `SuggestionPass` | 3; 4; 5 | A story on the memory host. Not run |
| External system | `Suggester`, `Decider`, `Mailer`, `TeamChannel`, `CatalogueHistory` | 5, 8, 8, 8, 10 | Stubbed in stories; each adapter's own test. Not run |
| Api | `MemberApi` (what a browser may send), `ServerApi` (`ConfirmImport`, `Adopt…`, what a saga sends), `AdminApi` | 2, 3, 6 | A test that `MemberApi` lists none of the server's commands. Not run |
| HTTP and OpenAPI | The operator's document over `AdminApi` | 9 | The document lists exactly those calls. Not run |
| CLI | The operator's command line, `toCli` | 9 | A test runs `--help`. Not run |
| Agent tools and MCP | The assistant's read tools, `toToolkit`; an MCP server, `toMcp` (decisions 41, 42) | 9 | A test that neither exposes a command that confirms, takes back, edits or changes a role. Not run |
| Sessions | `CurrentActor` declared in each model's own package, filled by one session lookup | 2 | An Api test in process: no session is refused, a viewer gets `NotPermitted`. Not run |
| Better Auth with Alchemy | The model's Worker resolves the actor from the session cookie with `@alchemy.run/better-auth` | 2 | A test on the library's harness with `dev: true`. Not run |
| Discord sign-in | Better Auth's Discord provider behind two settings and a flag (decisions 14, 51 to 53) | 8 | A test that the sign-in page offers Discord only when both settings are present; the browser pass on a stage. Not run |
| Local-first | The queue of acts kept through a reload; `Import.predict` on `ImportStatus` | 3 | The queue's test; a property test that `predict` agrees with the memory host. Not run |
| Foldkit | One admin page, "Model calls today", watching `AllowanceToday` | 7 | A test that mounts it against the memory host and sees the number fall. Not run |
| Platform contract | `Usage` unchanged in memory, on Durable Objects and on the Cluster pool | 2, 7 | Its stories on each host's harness. Not run |
| Host in memory | Under every model test and story | 1 | Every story; removing it fails them |
| Host on Durable Objects | `Usage` at 2, `Catalog` at 3, `Access` at 6 | 2, 3, 6 | The harness test; the local workerd run of the third round |
| Host on Effect Cluster | `Usage`, on the Durable Object pool (decision 18) | 7 | The pool's harness test and one call through it. Not run |
| Host on Rivet | **Cannot yet**: no Rivet control plane or pool runs on Cloudflare (decision 48) | | Its question answered |
| Backfill | `ImportHistory` added in move 5, after imports exist | 5 | An import confirmed before that deploy is in the history after it, on the preview stage. Not run |
| Observability | `Alchemy.Telemetry.layerOtlp` in the model's Worker | 2 | A test with an in-memory exporter sees a command's span and a `domain.*` metric. Not run |
| Story | Eight on the review, five on the item, six on the allowance, three on members | 1 on | They run in `bun run check` |
| Test tooling | Api tests in process; the library's harness with `dev: true` | 2 | The harness test fails without a model's binding. Not run |
| Verify, Prove, Explore | `Prove.decision` per decision and the lifecycle's report in `bun run check`; `Verify.model` per model in `check:full`; a rule Verify breaks kept as a story | 1 | Each asserts every standing by name (decision 25) |
| The tutorial | Move 1 follows its parts 1 to 3 on this app's nouns | 1 | Its parts' tests are the stories and Verify tests above. Not run as the tutorial |
| The Cloudflare tutorial | Part 3 is the harness test, part 4 is `alchemy dev`, part 5's pull-request comment is the GitHub provider's `Comment` | 2, 9 | The harness test; the comment on a preview's pull request. Part 4 ran; the others not run |
| Effect Cluster | The pool that hosts `Usage`, its cron and its singleton (decision 19) | 7 | The pool's harness test. Not run |
| Workflows | The sagas above; an Effect workflow on the Worker that has D1 (decision 47) | 3, 4 | A story of each saga; the workflow's own test. Not run |
| Singletons and crons | Decision 19 | 7 | A cron fired with the clock moved; the singleton's test. Not run |
| Drizzle on Durable Objects | One import's suggestions in the import's own object (Drizzle's), behind `SuggestionStore` | 8 | The port's tests against the object. Not run |
| GraphQL | Decision 45 | 9 | A test of the analytics driver on its test layer. Not run |
| Confidence scores | Decisions 36 to 38 | 8 | A scored answer through the `Decider` adapter, and the rules answering with the key off. Not run |
| Resend | `@distilled.cloud/resend` as the `Mailer` adapter (decisions 39, 40) | 8 | A test that the mailer is the distilled client; a mail through the "mail off" Layer. Not run |
| Distilled clients | `@distilled.cloud/resend` for mail; Discord for the team's channel (decisions 43, 44); GitHub through Alchemy's provider; Grafana and 1Password's events client in the operator's scripts; Docker for the operator's check that the telemetry stack is up | 8, 9 | Each script's own test of its client. Not run |
| `@alchemy.run/1password` | The stacks' secrets written from `op://` references at a deploy. His to run; no agent resolves a reference | 9 | A deploy whose Worker reads a secret it was given. Not run |
| Alchemy Git | Decision 46. CI on it **cannot yet** (decision 49) | 10 | A commit read back from the Git Worker in its test. Not run |
| GitHub provider | Today's environments, secrets and ruleset; the `Repository` resource and a preview's `Comment`. Workflow files **cannot yet** (decision 50) | today; 9 | `GitHub.stack.ts` type-checks against the pinned provider |

### Where each read and refusal is answered from

| Read or refusal | Today | Under the model |
| --- | --- | --- |
| The decisions the Review step shows | `GET /imports/:id`, from `importDecision` | `ImportReview`, a query over the same rows, which `DraftRows` writes |
| "N of M rows need a decision" in the list of open imports | `review` over the saved decisions | The same, over the same rows |
| Whether an accept is in force | `withoutStaleAccepts` against `MappingChoice.at` | `acceptInForce` against each field's last match |
| The numbers on the Result step | Read back in the confirm's own batch | `ImportResultCounts`, a query that waits for the projection |
| What a take-back would do now | D1 | D1: the handler reads which items changed, then sends `TakeBackImport { kept }` |
| Remove refused while an item is in force | D1 | The import refuses on its own counts; the handler asks D1 first |
| Whether a SKU is already there | The unique index | The item's instance under decision 8's first option; the index under its second |

### The contract and the ports

| Today, at the atoms head (`Catalog.contract.ts`) | Under the model |
| --- | --- |
| `PUT /imports/:id/decisions`: `SaveRequest { madeOn, set, clear }`, answers `{ revision, changed, notApplied }` | Gone. `DecideRow` and `UndoRowStep`; `madeOn` becomes `acceptedOn`, `changed` an empty receipt, `notApplied` the screen's reading of `MatchedSince` |
| `POST /imports/:id/commit`: `ConfirmRequest { revision, madeOn, set, clear }`, refused with `DraftMoved` or `AcceptsTakenBack` | Names the screen, the last change it received; carries no rows. Its handler builds the plan and sends `ConfirmImport` through `ServerApi`. `DraftMoved` becomes `ReviewMovedOn` and `PlanBehind`; `AcceptsTakenBack` cannot happen at Confirm, since every accept was checked when its act was recorded |
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
stay behind the queries. `ItemStore` follows decision 8. `Answerer` becomes `Suggester`. `AllowanceStore` follows
decision 17. In `packages/access`, `PeopleStore`, `MemberDirectory` and `AuditTrailStore` follow decisions 11 and 27.
The in-memory twins of what a model covers are retired for stories.

### What each table becomes

| Table | Under the model | Move |
| --- | --- | --- |
| `importDecision` and a new `importDecisionHistory` | Written by `DraftRows`, read as today and by `MySteps` | 3 |
| `importDraft` | Its status and its place in the acts' order written by `DraftRows`; `revision` goes | 3 |
| `importBatch`, `importOutcome`, `importChange` | Written by the confirm's and the take-back's batches, each with its marker | 3 |
| `importReplaced`, `item` | Under decision 8's first option, written by `ItemRows` from each item's events, from move 3; under its second, by the confirm's batch | 3 |
| `importUpload`, `importUploadChunk`, `importChunk` | Unchanged; `Upload` records what happened to them | 5 |
| `importSuggestion` | Unchanged until move 8; then one import's suggestions in its own Drizzle object, with the suggestions of open imports copied in at that deploy | 8 |
| `member`, `organization` | Written by `MemberRows` under decision 11's first option; unchanged under its second | 6 |
| `activity` | As decision 27 says | 3, 6 |
| `modelCall` | Goes under decision 17's first option, with today's count adopted | 2 |

### How a stored shape changes

A host keeps an aggregate's state as one stored value and decodes it against the current schema at every command. A
state that no longer decodes makes every command to that instance fail; an event whose class is gone fails the same
way. Decision 26 sets the rule. The shapes still open (undo's depth, decision 6) are settled in move 1, before
anything is stored.

## What one large import costs, under the recommended answers

One file of 50,000 rows, with the sample's share of ready rows (38,750 items), reviewed and confirmed, under the
recommended answers taken together (3, 5, 8 and 9 in particular). Two reviews: an act on every row, and an act on one
row in five. Per act, 4 requests between objects were counted in local workerd; the delivery to `DraftRows`, the
stream's append and up to three backstop alarms are arithmetic from the host's source, so 6 to 9 requests an act.
Rows written per act, about 25, and everything for the items are arithmetic on the host page (beta.87's source).
Nothing was deployed; duration (GB-s) is not estimated.

| One 50,000-row file | An act on every row | An act on one row in five |
| --- | --- | --- |
| Requests: the review's acts | 300,000 to 450,000 | 60,000 to 90,000 |
| Requests: 38,750 items created by the saga (decision 8) | 193,750 to at least 271,250 | the same |
| Requests: the confirm, with the six consumers this brief names | about 14 to 20 | the same |
| **Requests in all** | **about 494,000 to 721,000** | **about 254,000 to 361,000** |
| Rows written | about 2.1 million | about 1.1 million |
| Files a month in Workers Paid's included 1 million requests and 50 million rows | 1.4 to 2.0 by requests; 23 by rows | 2.8 to 3.9 by requests; 45 by rows |
| Past the included requests | $0.15 a million: about $0.08 to $0.11 a file, until rows written bind | about $0.04 to $0.06 a file |
| Objects kept for ever | 50,000 rows + 38,750 items + 38,750 item projection keys + 1 import + about 274 directory objects | 10,000 rows + the same |
| Time the person waits for the acts, one after another through the import, at about 110 ms an act as measured locally | about 92 minutes | about 18 minutes |
| Time for the items to be created | not measured (one command to one aggregate took 15 to 16 ms locally) | the same |
| D1 rows of the plan | 50,000 | 50,000 |

Under decision 8's second option the items' line goes and the files a month by requests become 2 to 3 and 11 to 16.
Under decision 3's second option an act is one request, the acts of different rows do not queue behind each other,
and the person's wait is not that of one import.

## Decisions for Benjamin

The first option of each is the recommendation, with what it rests on. One decision each, most consequential first.
Each says which earlier answers remove or change its options. Decisions 1 to 31 shape the first moves. Decisions 32
to 53 can wait until the move that needs them.

### 1. How does the app take what exists only on the library's `main`?

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
- **Wait for the release that has them.** Until then nothing is proved, and decision 3's first two options cannot be
  built.

### 2. What does a person see when someone else decided the row they are deciding?

*The same options under every answer to decision 3.* Today's save lets the later save win, over a decision its
sender never saw (the atoms head).

- **Theirs is refused for that row; the row shows the other person's decision and name, and they decide again if they
  still disagree (Recommended).** *Rests on:* "never change a value silently", and his rule of 2026-11-19 that nobody's
  decision is overwritten at Confirm; `ADecisionIsReplacedOnlyByAnActThatSawIt` is proved and two stories show it.
- **Acts merge by field.** Two people's acts on different fields of one row both stand. It needs the row to hold its
  decision in parts, the shape that passed 4,096 paths in the second round. Not run as a design.
- **The later act wins**, as today's save does, and the earlier person sees the row change with the other's name.
  `ADecisionIsReplacedOnlyByAnActThatSawIt` leaves the model.

### 3. Where do review decisions live?

*Changes with decision 1:* its fourth answer leaves no option proved. *With decision 2:* its third answer takes one
rule out of every option.

- **The import's lifecycle as one instance, one instance per decided row, and every act a decision across both
  (Recommended).** *Proved:* 32 rules in the shape it would be hosted, by name in the table under "Sketch".
  *Checked:* one relation. *At Confirm:* "nothing is confirmed that was not on screen" is held by two proved rules and
  two tested halves, as the table says. *Two people, one row:* decision 2. *An undo over a row someone changed:* it
  takes back the rows that still hold the step and says which ("Undone for 11 rows. Row 14 was changed by Dana and
  stays"); each row's undo is its own act. *Costs:* 4 requests between objects an act, about 110 ms an act in local
  workerd; every act goes through the import one after another, so a group of 6,000 rows takes about 11 minutes
  locally and two people acting in the same moment make one of them retry (the library retries for about 20 seconds);
  the whole of one large import is under "What one large import costs". *Kept for ever:* one object for each decided
  row, with its acts' events and receipts.
- **The same instances, with a row taking its own commands and no decision across.** One request an act, rows in
  parallel. *Proved:* the row's rules and the lifecycle's. *Not held by Verify:* that a row is decided only on an open
  import, that an act's accepts are on the matching now, and where a confirm falls among the rows' acts; a row cannot
  see its import. His "Refuse, show, confirm again" then rests on the projection's order and a check in the handler,
  with a window between an act and its projection; it is tested, not proved. *Kept for ever:* one object for each
  decided row.
- **One instance per import.** One command an act, a group included, recorded or not as a whole. *Proved:* nothing,
  by the prover's design (a list is tried with at most 2 items more than its schema asks for, and one such command
  un-proves every rule of its aggregate). *Checked:* eight rules to 2 commands; the search stopped at its budget.
  *Costs:* the state passes 8 MiB at about 42,800 decided rows, under the app's 50,000-row maximum, with nothing kept
  under a decision for undo; an undo over a row someone changed can then be refused whole. *Kept for ever:* every
  act's event and its receipt in the import's one object.

### 4. Do a confirm and a take-back stay one write?

Today each is one atomic D1 batch, a written rule of the app (`docs/standards/undo.md`; "one atomic write" in
`CLAUDE.md`). An object's commit and a D1 batch cannot share a transaction. *Changes with decision 3:* under every
option there, a confirm the import records is a fact first and its writes after.

- **The confirm and the take-back become facts on the import, and their writes land after (Recommended).** *Rests
  on:* it is the only way the import can order the confirm among the acts, which is what proves "nothing is confirmed
  that was not on screen". *What the person sees:* before the command, nothing is confirmed and an unused plan is
  swept; after it, the Result step says "Writing your items" until it can count from what is stored; a take-back
  waits behind a confirm whose write has not landed. It reverses the written rule, and `undo.md` and `CLAUDE.md` are
  rewritten in move 3.
- **Each stays one D1 write; the import does not record the confirm.** The confirm's batch checks D1's place in the
  acts' order against what the screen names. The six confirm and take-back rules of the import leave the model, and
  his confirm rule is tested, not proved, with the projection's lag as its window.

### 5. How is an act on a group of rows carried?

*Asked under decision 3's first option; under its second, each row's act is one request and they go in parallel;
under its third, a group is one command.* Accepting a fix for a group is the review's main act. The sample's groups
have up to 9 rows; a large file's can have thousands.

- **One act per row under the group's step, sent by a saga, with the import marked while it is sent (Recommended).**
  *Proved:* no confirm is taken while a group is being sent, by anyone, and only its sender ends it; every rule of the
  table stays proved. *What the person sees:* their own screen shows the whole group at once, as its own acts, with
  "saving 2,340 of 6,000"; others see the rows change a few at a time; Confirm waits; their own later acts wait in
  their queue until the group ends. *Costs:* about 110 ms an act locally, about 11 minutes for 6,000 rows; undoing
  the group is as many acts again. *If it stops:* the saga sends the rest when it runs again; until then the import
  stays marked and no confirm is taken. The saga was not run.
- **The group is decided as one unit**: one instance per decided group, and the review's fold gives each row its
  decision from its own unit and its groups'. One act, recorded or not as a whole; its undo is one act. *In the way:*
  the fold has to be rewritten and shown to give what today's `act` gives for every sequence, and a row's act has to
  name the group decision it saw as well, which changes `Deciding`. Not run; its rules' standing is not known.

### 6. How deep does an undo reach on one row?

*Asked under decision 3's first or second option.* The app's standard today is every step, one at a time, in the
order it was made.

- **Every step: the first level exactly, each deeper level checked by its step (Recommended).** The row keeps the
  decision under the current one in full and the step that one replaced. A deeper undo names the decision to keep
  under the one it puts back, read from the row's history after the projection has caught up; the row refuses it with
  `HistoryBehind` unless its step is the one replaced. *Proved:* `AnUndoPutsBackWhatWasThere` and
  `UnderWhatIsPutBackIsWhatItReplaced`. *Tested:* the text of the deeper levels, as the history holds it. *Story:*
  three undos end at the row's first decision, and an undo that puts back another person's decision stops there.
- **Every step, held in the row's state as a list.** Exact at every level. Every rule of the review drops to checked,
  the lifecycle's included, because a decision whose path meets a list is checked for every rule of every aggregate it
  reads. Not run.
- **One level.** A second undo on the same row leaves it with no decision, and says so. All proved. It changes the
  app's standard.

### 7. Is a kept one of two rows with the same SKU still kept after the SKU column is matched again?

A rule about one kind of row: a row the person kept as the one of two that share a SKU. In the sample 6 SKUs appear
twice, 12 rows; lines 4 and 10 both say `YDR-8742`, "Oak Cutting Oil" and "Nylon Label Roll". When the SKU column is
matched again, which rows share a SKU can change. Today a match takes back accepts and leaves a keep as it was.

- **A keep is an accept of the SKU field: made on a matching, and out of force once the SKU column is matched again
  (Recommended).** The two rows show as a question again, and the screen says the keep was taken back. *Rests on:* his
  answer "Server refuses, screen says so" for accepts; in the model it is the same check and the same `acceptInForce`.
- **The keep stands while the two rows still share a SKU, and goes when they no longer do.** `review` works out the
  pairs again after a match; tested.
- **As today: the keep stands whatever the match.**

### 8. Is an item an aggregate whose rules Verify holds?

*Changes with decision 4:* under its second answer, only the second option here.

- **Yes: every item is its own instance, its record held as text (Recommended, by the first rule of this brief).**
  *Proved:* ten rules, replace and restore included: a second create changes nothing; a replace, an edit, a restore
  and a removal each only on the version they name; a restore puts back exactly the text and version replaced, so
  take-backs in turn walk back through up to ten replaces. A saga keyed by the confirm creates, replaces, restores and
  removes items in pieces, since one invocation cannot send 38,750 commands (10,000 subrequests by default; whether a
  call to another object counts as one is not verified). *What the person sees:* items arrive over minutes, the Result
  step counts up, the Items page can show part of an import, a take-back goes item by item and names what it kept.
  *Costs:* 5 to at least 7 requests an item (arithmetic, beta.87); for 38,750 items 193,750 to at least 271,250
  requests and about 852,500 rows written. *Kept for ever:* one object per item and one projection key per item.
  *Lists:* with tags and vendors as lists the rules drop to checked; they stay inside the text.
- **No: items stay rows that one batch writes per confirm.** A confirm's items land together; the item's rules stay
  held by SQL and its tests; the item edit stays a guarded write. *In the way of both at once:* an edit and a
  take-back must be decided against one store in one step; nothing in the library does that across an instance and
  D1.

### 9. What does a confirm write, and from what?

*Changes with decision 8:* under its first answer the plan is what the item saga reads.

- **A plan staged in D1, built at the import's last change (Recommended).** The handler waits for `DraftRows` to reach
  the last change, runs `review` on those rows, stores the plan with that change, and sends one `ConfirmImport` naming
  it; the import refuses a plan of another change (`APlanIsOfTheLastChange`, proved). *Rests on:* one command and one
  event whatever the size; about 14 to 20 requests with the six consumers this brief names (4 for the command, its
  first delivery and two alarms, on the host page; 2 to 3 more for each further consumer). *Costs:* the rows are in
  D1, not in the events.
- **The events carry the rows, in parts of 1,000, sent by a saga.** *Gives:* the events are the whole truth.
  *Costs:* 104 to 204 requests and about 60 MB kept for ever for a 50,000-row file; "Importing, part 23 of 51".

Each batch carries a marker: one row keyed by the event it was given, inserted as the last statement of the same
batch, with every other statement conditional on its absence.

### 10. What happens when a confirm's write keeps failing?

- **The import stays confirmed and the write keeps being retried; the Result step says "still being written, nothing
  is lost", an alert fires on the projection's retry log, and a take-back waits (Recommended).** Nothing the person
  decided is lost; an operator fixes the cause.
- **After it has failed for a set time, the server opens the import again with every decision in place**, takes back
  any item already written, and the person reads "Nothing was imported; confirm again". The import never stays
  confirmed with nothing in it; the set time is a number he gives.

### 11. Which record of who is a member, with which role, is the record?

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

### 12. Are Better Auth's own writes to `member` closed?

*Asked under decision 11's first or third option.*

- **Closed: the People page's commands are the only way to change a member, and Better Auth's organization endpoints
  that write are turned off (Recommended).**
- **Sent through commands by a hook on Better Auth's writes.** Better Auth's screens keep working; the hook is ours to
  keep working across its changes.

### 13. What does a removed person's open page receive?

A live read keeps the actor it connected with.

- **Nothing more: every pushed change is checked against the member record, so it stops at the next change
  (Recommended).** Not run.
- **What is pushed until the socket drops.**

### 14. Is a Discord sign-in with an unverified email accepted?

*Before move 6, since an admin adds a person by the email they signed up with.* Someone could create an account with
a colleague's address and be added in the colleague's place.

- **Refused: the account is not created (Recommended).**
- **Accepted as the account's address.**

### 15. Can a person with no account be invited?

His answer infra I8 (2026-11-19) was "Close sign-up; I add accounts". It stands unless he says otherwise.

- **No (Recommended).** Only a person who has an account is added.
- **Yes**, by opening sign-up to invited addresses. It reverses infra I8.

### 16. When do the 40 model calls come back?

Today a call comes back 24 hours after it was used (`ModelAllowanceGateway`: "in any 24 hours"); no answer of his set
that window.

- **At 00:00 UTC each day (Recommended).** *Proved:* seven rules, with no reset command and no cron: the first call of
  a new day starts the count at 1, held as a day number. *What the person is told changes:* "back at midnight UTC",
  and up to 80 calls fit in the two minutes across midnight.
- **24 hours after each was used, as today.** The rule is checked, not proved, because the times of the day's calls
  are a list in the state.

### 17. Where does the model-call allowance live?

*Changes with decision 16:* the first option is proved only under its first answer.

- **An aggregate per organization (Recommended).** Its view feeds the admin's live page.
- **An entity on Effect Cluster's pool.** The rule leaves the model.
- **A Drizzle table in one object per organization, behind `AllowanceStore`**, with a take that is a real
  transaction. The rule leaves the model.

### 18. Which model runs on which host?

*Changes with decisions 11 and 17.* Nothing hosted on Effect Cluster's Durable Object pool can reach D1. Its gateway is
a public `workers.dev` address behind one token, with no option to turn it off.

- **`Catalog` and `Access` on Durable Objects; `Usage`, the allowance and its view, on the Cluster pool
  (Recommended).** Both hosts are used and the same model runs on three. *Costs:* the gateway, which he would accept
  for production; 2 MiB a persisted value there. *Needs* decision 17's first answer. `Usage` is first hosted on
  Durable Objects in move 2 and moves in move 7 with an `AdoptDay` per organization carrying the day's count; the
  classes left on the model's Worker are kept, never renamed or dropped. Not run.
- **Everything on Durable Objects.** Cluster then hosts nothing, and decision 19 has no use.
- **`Access` on the pool.** *In the way:* its projection cannot write the `member` rows; it needs decision 11's third
  answer and mail sent from another Worker.
- **Effect Cluster on Postgres runners. Cannot yet:** no Postgres and no runner pool in this deployment.

### 19. What runs on the Cluster pool as a cron or a singleton?

*Asked under decision 18's first answer.* The allowance by day needs no reset, so the pool's scheduled work has to be
work of its own. Work that needs D1 cannot run there.

- **A cron that closes each organization's day of model calls into a history the admin's page shows, and a
  singleton that keeps the operator's live total across organizations (Recommended).** Each organization's first
  call of a day registers it with one registry entity on the pool, which is the list both read. Not run.
- **The cron only.**
- **Neither: "cannot yet" written down**, with the limit (nothing the app schedules lives only on the pool). He ticked
  singletons; this leaves them unused.

### 20. What is deployed: one Worker or two?

The Durable Object host needs an Effect-native Worker; the app's Worker is a plain module built with the screens.

- **A second, Effect-native Worker beside the site's, reached by a service binding (Recommended).** The site stays
  `Cloudflare.Website.Vite`, his answer infra I1 (2026-11-19).
- **One Effect-native Worker that hosts the model, serves the API and serves the screens as assets.** One origin and
  one deploy. It reverses infra I1, which rejected "`Cloudflare.Worker` with assets".

### 21. What does `bun run dev` start?

- **`alchemy dev` for both Workers and the screens' server beside it (Recommended).** `alchemy dev` ran a model on
  Durable Objects in local workerd with no login, ready in about 5 seconds, and ran the decision across two objects.
  Not verified: two Workers and Vite side by side, that it applies the D1 migrations `predev` applies today, that
  objects survive a restart, that a forwarded request keeps the session cookie.
- **The model in memory under `vite`.** Nothing changes in how the app is started; a restart loses decisions while D1
  keeps the import, and two people on one import cannot be looked at locally.

### 22. Do the screens call the model's Api, or stay on `/api/v1`?

*Changes with decision 20:* under its second answer there is one origin.

- **They call the model's Api: typed calls for commands, the stream for what is pushed (Recommended).** A group leaves
  `/api/v1` when its screen moves; uploads, the staged table, sign-in and the status stay. *Rests on:* the Review step
  needs the pushed stream either way. *What the person sees if it fails:* the same sentences, from `sayError`.
- **They stay on `/api/v1`, every endpoint a thin handler that sends the command as the person.** One public contract
  and OpenAPI document. The pushed stream then needs its own route beside the contract; polling would show another
  person's act up to a poll late.

### 23. Where do an aggregate's blocks live?

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

### 24. Are domain blocks built with `new`?

The house rule is `.make`. The prover reads `new Event(…)` in `decide` and not `Event.make(…)`.

- **`new` in files that hold a `decide`, with that one diagnostic off by the file's first line (Recommended)**: files
  named `*.aggregate.ts` and `*.decision.ts`.
- **`new` for every domain class.**
- **`.make` everywhere.** Until the prover changes, no rule of a `decide` written that way is proved.

### 25. Where does Verify run, and what fails the build?

Measured: `Prove.decision` proves `Deciding` in 12.2 s (509 paths) and `Undoing` in 3.8 s (181 paths) on the hosted
shape; the lifecycle's own
report with one decision at a time took 23 s and 5 s on the 27-rule model; `Verify.model` takes 82 s. Two decisions
declared in one file and passed to one report fail with a `ProveError` (the library loads the file before it adopts
the second decision; one decision a file avoids it).

- **The decisions' and aggregates' proofs in `bun run check`, each model's search in `check:full` and CI
  (Recommended).** About 45 s more before every commit for the review (the sum of the parts measured). Every test asserts each rule's standing by
  name; a rule that slips from proved to checked fails before the commit, and only the relations and model rules wait
  for `check:full`.
- **All of it in `check:full` and CI only.** `bun run check` stays as fast as today; a broken rule is seen later.
- **All of it in `bun run check`.** About two minutes more before every commit.

### 26. How does a stored state or event change shape?

- **By rule (Recommended):** a new field is an optional key; a new meaning is a new event; a state whose shape must
  change is a union of the old and the new; until the first production deploy, a preview stage and local objects are
  wiped instead.
- **Always wipe.** Fine only while nothing real is stored.

### 27. Who writes each audit line, and what answers the Activity page?

Today every change and its line land in one D1 batch.

- **The `activity` table stays the trail (Recommended).** Where a projection writes the change to D1, it writes the
  line in the same batch. For a command that changes no D1 row, a projection writes the line, a delivery after the
  change: the line is then no longer in the same write as its change.
- **A stream per model, and the Activity page merges them with the table's lines.**

### 28. How do rows already stored arrive in the model?

Nothing is deployed today; the rows that exist are in development databases.

- **Adopt at first touch (Recommended).** The first command that reaches an instance with rows in D1 and no events is
  preceded by an `Adopt…` command built from those rows, under an id that makes a second send do nothing: imports in
  move 3, items in move 4 under decision 8's first answer (at an item's first edit or take-back), organizations and
  members in move 6, the allowance's count in move 2.
- **Adopt everything at a deploy**, by the operator's command line.
- **Start empty.** Open drafts are confirmed or removed before the move; stored imports become history that cannot be
  taken back.

### 29. What does Remove do once decisions are events?

Today Remove deletes an open import's decisions and staged rows. The library never deletes an instance's events.

- **The import is marked removed and its rows in D1 are deleted; the events stay in the objects (Recommended).** The
  person sees what they see today.
- **The app also deletes the objects' storage**, through a route of its own on the model's Worker. Removed means
  removed; the route is ours to keep working.

### 30. What is kept for ever?

What the library keeps, beyond Remove: one object for each decided row and each item, with their events; one
projection key per item; a removed member's email in the events that added them.

- **Kept, as the library keeps it; an operator's command deletes an organization's objects when the organization
  leaves (Recommended).**
- **The app deletes a member's email from their objects' storage when they are removed**, and an import's objects
  when it is removed or a year after its confirm.

### 31. In what order do the moves happen?

- **The review's model in memory, then the host with the smallest slice, then the import's write side as one move
  (Recommended)**: the order under "Order of moves".
- **People first on the host.**
- **The import's write side first on the host.**

### Decisions that can wait for their move

**32. How long may a group act take before the group is decided as one unit?** (move 3) Locally about 11 minutes for
6,000 rows. Options: 1 minute; 5 minutes (Recommended, as a first number to measure against on the preview stage);
no limit.

**33. What answers the Items page?** (move 4) A query that answers today's page (Recommended), rows, total and page
count; or a query by cursor and a second for the total, page numbers becoming Next and Previous.

**34. Do suggestions start by the person's press, or by themselves when a file is staged?** (move 5) By the press, as
today (Recommended); or by themselves, which can use the day's allowance before anyone has looked.

**35. How many calls may one pass take from the 40 a day?** (move 5) One, as today (Recommended); or one per piece of
the file up to a number he sets.

**36. What do confidence scores decide?** (move 8) The guard's word stands and the probability is shown beside it
(Recommended); the probability sets the word, which reverses a written rule; or a second call checks the other
model's answer.

**37. Which route do scores take?** (move 8) The `@effect/ai-typesafe` package with the key he reserved (Recommended:
the thing he named). It reverses infra I5 (2026-11-19), "Production only, one vendor", and its "Not deployed for now"
for that key; no agent resolves the key. Or OpenRouter's route with the key the app has.

**38. Does a scoring call count against the 40 a day?** (move 8) Yes (Recommended); or its own allowance.

**39. Which mails does the app send?** (move 8) Every option reverses infra I6 (2026-11-19), "Not now". Reset, a notice
to a person added, and "your import is in" and "taken back" to the person who did it (Recommended); the first two
only; or all four, the import notices to every admin as well.

**40. Is confirming the address turned on?** (move 8) Off, as today (Recommended); or on, in production only, once the
key is there.

**41. What may the assistant's tools and an MCP server read?** (move 9) The older packet's open question 16 recommended
reads and proposal-only writes. Reads only, of what the signed-in person's role may read (Recommended); reads and
writes that land as proposals a person approves; or the assistant keeps today's inputs.

**42. Who may call the MCP server?** (move 9) Admins (Recommended); every member, within their role.

**43. What does a notice to the team's channel contain?** (move 8) Counts and the person's name, no file name
(Recommended); or the file name as well.

**44. Which channel gets notices?** (move 8) One channel per organization, set by its admin (Recommended); or the
operator's one channel, across organizations.

**45. What is GraphQL used for?** (move 9) `effect/graphql` is a client; serving the app's data over GraphQL **cannot
yet**. A driver in the Worker that reads Cloudflare's analytics, an admin-only panel of the day's requests and rows
written, and the command line reading through it (Recommended; it measures what this brief computes, and needs an API
token from him); the command line's read only; or a server outside Effect called from one screen.

**46. What does Alchemy Git hold?** (move 10) A mirror of this repository, and a history of each
organization's confirmed imports as files, readable by that organization's admins and kept after a take-back or
Remove (Recommended; a fourth Worker, an R2 bucket for git objects, `@alchemy.run/aws`); or the mirror only, with no
customer data.

**47. Are workflows only the sagas, or also an Effect workflow on the Worker that has D1?** (moves 3 to 5) Also a
workflow: the plan's sweep of unused plans, which needs D1 (Recommended); only the sagas.

**48. Is "Rivet cannot yet" accepted?** No Rivet control plane or pool runs on Cloudflare; a control plane the Worker
can reach and a pool outside Cloudflare would remove it. Accepted (Recommended); or wanted, which adds an option to
decision 18.

**49. Is "CI on Alchemy Git cannot yet" accepted?** The package has no runner; one the project builds would remove it.
Accepted (Recommended); or a runner is built.

**50. Is "workflow files through the GitHub provider cannot yet" accepted?** Nothing in the provider writes repository
contents; a resource over the contents API would remove it. Accepted (Recommended); or the resource is built.

**51. May a person link Discord to their account?** (move 8) From a signed-in session only (Recommended); or not at
all.

**52. Which stages offer Discord?** (move 8) Production and previews, each with its address registered and its own
Discord application for production (Recommended); or production only.

**53. What does a person read when a Discord sign-in fails?** (move 8) The app's own sentence (Recommended); or Better
Auth's error page.

## What each move needs from Benjamin, by hand

| Move | What |
| --- | --- |
| 2 | His Cloudflare login, `alchemy state bootstrap` and a deploy to a preview stage, as the infra goal lists them |
| 3 | A deploy of the move to the preview stage, before the Review step moves: the group act and one confirm are measured there |
| 5 | A deploy with imports already on the stage, to show `ImportHistory`'s backfill |
| 7 | To accept the pool's public gateway and its token for the stage it runs on; a deploy |
| 8 | A Resend key and a verified sending domain; a Discord application and a channel webhook or bot; the TypeSafe key, if decision 37 takes it |
| 9 | A Cloudflare API token that reads analytics; a 1Password service-account token for a deploy that writes secrets |
| 10 | A deploy: the stack makes the bucket and the Worker |

Under decision 21's second answer, every move's browser pass also needs a preview stage he deploys.

## Rabbit holes

- **One union too many.** A union in a state or a command is a path per member, and every decision that reads it pays
  for it; so does a test of many fields one by one. The hosted review passed 4,096 paths with seven such unions and
  proved nothing; written without them it proved 32 rules. Every field added to a row or the import is run through
  `Prove.decision` before it is merged.
- **The time of a group act.** About 110 ms an act locally; decision 32 sets the limit.
- **Checked is not proved.** The relations, the model invariant and the `eventually` rule stand on a search 2
  commands deep and 200 walks.
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
  names the change and he chooses it. The decisions whose options name one: 2 to 11, 13 to 16, 22, 29, 33, 34, 36,
  39, 40, 43 and 53.
- `review` stays one pure function, run by the screen and by the server at the confirm. It does not move into
  `decide`.
- A model still proposes and never writes.
- No R2 presigned uploads.
- No deploy, login, state command or key by an agent. No `op://` reference resolved by an agent.
- Nothing built before he signs and the atoms goal is merged.

## Proof (the definition of done)

1. Every row of "Every single thing" passes the check in its last column.
2. Every Verify and Prove test asserts the standing of every rule of its table by name. Under the recommended answers:
   the review's 32 proved and its relation checked; the item's 10, the allowance's 7 and the members' 19 proved; their
   relation and model invariant checked; the model invariant across `Import` and `Row` and `EveryUploadEnds` checked.
3. The property test of the client fold against the real model on the memory host, with the orderings as named cases
   (another person's act before the screen's own waiting act; a second tab; a group under way; a reload with acts
   waiting; a match beside a waiting accept), and the rule: every act the person made is in the model's events or in
   the queue.
4. Each projection batch run twice with the same input writes once; a confirm sent while `DraftRows` is one act behind
   waits and builds its plan at the last change.
5. Through the model's Api in process: a member of the second organization and a viewer against every command, view
   and stream, each ending in its rejection; a call from another origin refused before identity.
6. In two browsers, as two people on one import, on a fresh database and on the runtime decision 21 names: different
   rows decided in both; the same row decided in both; an undo after the other changed the row; a confirm while the
   other decides; a confirm with acts waiting while the other decides; a reload with an act waiting; a match beside
   the other's accept; a group act while the other confirms. Then `items_messy.csv` through Confirm with the three
   numbers read (200 rows, 155 imported, 155 stored), at phone width and in both themes.
7. On a preview stage he deploys: the requests and rows written by one act, one group act of the sample's largest
   group, one confirm and one item, read from Cloudflare's analytics, each within twice the arithmetic under "What one
   large import costs"; and the time of a group act of 6,000 rows.
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
proof. It is written for the recommended answers; decision 31 reorders 2, 3 and 6.

0. **The library**, as decision 1 says, and the two infra stacks checked against it.
1. **The review's model, in memory.** The import, the row, the two decisions, their stories, their Verify and Prove
   tests with every standing asserted, and the fold's property test against the model. Nothing the person sees;
   nothing stored.
2. **The host and the first slice.** The model's Worker, `bun run dev` as decision 21 says, the session, the two
   guards, the Api tests in process, the harness test, telemetry. The first slice is the allowance: its aggregate, its
   view, and each model call's take going through it, with today's count adopted. His deploy to a preview stage.
   *Interim:* every import still runs on D1 as today.
3. **The import's write side, in one move.** Stage, acts, group acts, match, suggestions recorded, confirm, take-back,
   reopen, remove; `DraftRows` and the batches with their markers; under decision 8's first answer, `Item`, its saga
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
