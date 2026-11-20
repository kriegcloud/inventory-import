---
type: Brief
title: "Brief: the app on @alchemy.run/domain"
description: How inventory-import uses all of @alchemy.run/domain and the extras Benjamin asked for, rewritten after a review of its first version and a second round of trials. The saving of review decisions is modelled first, in the shape under which Verify proves its rules; then one table of every concept with its worked instance, its move and its check; then the decisions that are his, in the order they must be asked. Written only; nothing is built until he signs and the atoms goal is merged.
---

# Brief: the app on `@alchemy.run/domain`

Benjamin, on 2026-11-19: "Not borrow use.", and "if possible find a way to make use of ever single thing". Of the
pull request that adds `Verify`: "I'm particularly excited about this". That reverses the 2026-11-18 decision "core";
his words are in [CAPTURE.md](CAPTURE.md).

This is the second version of the brief. A review of the first found that its recommended answers left almost none
of the app's rules proved without saying so, that two of its mechanisms could not work as written, and that its
definition of done held only the review and the confirm. Six trials were run before this version was written
([the trial page](research/07-review-decisions-trial.md), "The second round"). Where the first version said
something this one does not, the trials are why.

Two rules shape every recommendation here:

- **A recommended option does not give up what Verify proves.** Where a shape exists under which a rule is proved,
  that shape is recommended and what it costs is stated as a cost. Where none exists, the question says so, with the
  exact limit in the way.
- **No option leaves out the library or an extra he asked for.** Where a thing cannot be used yet, the option says
  what is in the way and what removes it.

Nothing here is built. **The build starts after Benjamin says the brief matches, and after the atoms goal is merged
into main.** File names of the web packages are those of the atoms branch at `1171834`.

## Problem

No file in the repository imports `@alchemy.run/domain`. Each rule that matters is held by a guarded D1 batch behind a
port, and checked by tests that sample it.

- **Review decisions can be lost without a word.** The browser sends the difference between two whole pictures of an
  import's decisions as rows to set and rows to clear. When either picture is stale, the difference clears or
  overwrites decisions nobody touched. The request does not say what its sender saw, so no check on the server can
  tell a meant change from a stale one. The atoms branch closes the orderings found so far in the browser; the
  contract still lets any caller send them.
- **The rules are sampled, never proved.** "An organization always keeps an admin", "a second confirm writes
  nothing", "a take-back keeps a changed item" each rest on one SQL statement and the cases its test thought of.
- **The library he set out to explore is not in the app**, so the app teaches nothing about it before beep-effect is
  ported to it.

## Appetite

**In.** Every write of the app as a command of a model whose rules Verify reads; every concept of the library and
every extra he named with one worked instance in this app, a move it lands in, and a check that shows it used
("Every single thing", below).

**Out.** A change to any rule of an import, to what a count means, or to a sentence the person reads, unless a
decision below names it and he chooses it. R2 presigned uploads. A second review function. Anything a model writes
without the person's confirm.

**Done when** every row of the table "Every single thing" passes its check, the proofs under "Proof" pass, and
`bun run check:full` passes. A row that cannot be used yet is done when its blocker is written down with what removes
it and he has accepted it by answering its question.

## What the trials established

All on the library's `main@dbfd0dd`, outside the repository. The first three are from the first round.

- `Verify` proved 19 of the app's rules on a first model of counts, and checked one across 5,173 sequences
  ([04](research/04-trial.md)).
- A command of rows to set and rows to clear cannot hold "no command clears a decision its sender did not make":
  it cannot say whether its sender saw what it clears.
- The library publishes a build of each `main` commit to its own preview registry. It installs with bun beside
  Effect 4.1.4; `Verify` runs from it; `alchemy dev` runs a model on Durable Objects in local workerd from it, with
  no login.

From the second round ([07](research/07-review-decisions-trial.md)):

- **One value in a Durable Object may be about 8 MiB**, measured through the domain host in local workerd: an
  aggregate's state grew to 8.3 MB and the next command failed with `string or blob too big: SQLITE_TOOBIG`. The
  2 MiB in the library is a guard of its cluster package, and governs what is hosted on Effect Cluster's pool. A
  deployed object was not tried.
- **The app's real decision shape cannot be proved**: six keys that may each be left out and a record put both
  commands past the prover's 4,096 paths. With the decision held as text, the text the database holds today, the
  row's nine rules are proved.
- **An act that names the decision it saw, by its step, is proved**, and works for a person's own acts on the way.
  The count of changes the first version used does not.
- **The review's rules are proved in one shape**: the import's lifecycle as its own instance with no list, one
  instance per decided row, and every act a decision across the two. Verify verified that model: **27 rules proved,
  1 checked.** A match, a reopen, a confirm that names the last change it saw, and an accept that names the matching
  it saw are all in it.
- **One instance per import proves nothing**, by the prover's design: a list from the state or a command is tried
  with at most 2 items more than its schema asks for, a rule that passes that way is checked and never proved, and a
  rule is proved only when every command of its aggregate is. With everything above in one instance, the search
  stopped at its budget after sequences of 2 commands. Its state passes 8 MiB at about 42,800 decided rows.
- **A decision and a relation are proved** on the app's people rules; a model invariant and an `eventually` rule
  are checked, never proved; a broken rule comes back as a story that can be kept as a test.
- **Three things about what the prover reads**: handlers written `Effect.fn("name")(…)` are read; an id or a value
  schema imported from another package is read; a request context imported from another package is not.

## Sketch

### The review, in the shape Verify proves

Three kinds of thing, each small:

| Block | What it holds | What it decides |
| --- | --- | --- |
| `Import`, one instance per import | Its status (open, imported, taken back, removed), its organization, how many times each field's column has been matched, and the step of the last change. No rows | Stage, match a column, record a suggestion, confirm, take back, open again, remove |
| `Row`, one instance per decided row | The row's decision as text, who made it, in which step, and the one decision under it | Nothing alone |
| `Deciding`, `Undoing`: decisions across one import and one row | Nothing | One act of the review. They read both instances and record on both or on neither |

A step is the id the screen gives one act at the press. Three things are said by naming a step, never by counting:

- **An act names the decision it saw on its row.** It is recorded only if that is still the row's decision.
  Otherwise it is refused with `DecidedSince { by, step }`: whose decision is there. A person's second act on a row
  names their own first, which the screen made the id of, so it works while the first is still on its way.
- **A confirm names the last change to the import it saw**, a match included. Otherwise it is refused with
  `ReviewMovedOn { last }`.
- **An accept names the matching of its field it saw.** Otherwise it is refused with `MatchedSince { matching }`. A
  match changes no row: it raises its field's matching, and an accept made before it is out of force by its number.

The decision a row holds is text: the same text the `importDecision` table holds today, read through the contract's
`RowDecision` schema by the screen and by the server's `review`. No rule reads inside it. That encoding is what lets
the rules be proved, so it is part of the design.

**The rules, and their standing in the run** (`Verify.model(Review)`, 109 s; in the trial the lifecycle is
`ImportLife` and the row `RowUnit`):

| Rule, in words | Name | Standing |
| --- | --- | --- |
| A decision is replaced only by an act whose sender saw it | `DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt` | proved |
| No command clears a decision its sender did not make | `RowUnit.NobodyClearsAnotherPersonsDecision` | proved |
| An undo takes back only its sender's own step, and puts back what was under it | `UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep`, `.AnUndoPutsBackWhatWasThere` | proved |
| A row is decided only on an open import | `DecideRow.ARowIsDecidedOnlyOnAnOpenImport` | proved |
| An accept is made on the matching its sender saw | `DecideRow.AnAcceptIsMadeOnTheMatchingItsSenderSaw` | proved |
| Nothing is confirmed that its sender had not seen | `ImportLife.AConfirmIsOfWhatItsSenderSaw` | proved |
| A match raises only its own field's matching; while an import is not open nothing of its review changes; it is opened again only by Reopen | `ImportLife.AMatchRaisesOnlyItsOwnField`, `.OnlyAnOpenImportIsReviewed`, `.AnImportIsOpenedAgainOnlyByReopen` | proved |
| The ten rules of the first trial's import (outcomes add up, nothing written before Confirm, a closed import's confirm writes nothing, take-back, tenancy, viewer) | the same ten names, on `ImportLife` | proved |
| A row belongs to one import of one organization; only its own organization changes it; a viewer changes nothing | `RowUnit.ARowNeverChangesImportOrOrganization`, `.OnlyItsOwnOrganizationChangesARow`, `.AViewerChangesNothing` | proved |
| Two people's decisions on different rows both survive any ordering | By construction: each act reaches one row's instance | not a rule of its own |
| A decided row belongs to the organization of its import (a relation across instances) | `Review.ARowBelongsToItsImportsOrganization` | checked, to 2 commands and 200 walks |
| What a screen shows is never ahead of what it has been told | The client fold, below | a property test, not Verify |

Three things to hold beside that table:

- **Nothing evaluates a rule when the app runs.** Invariants, transitions, relations and `eventually` rules are read
  by Verify. What refuses a state in the running app is the code of `decide`. A proved rule means that code cannot
  break it; a checked rule means no short sequence did.
- **Proved is for the decision as text.** With the contract's shape in the state nothing is proved.
- **The trial's `Remove` is narrower than today's.** It removes only an import that was never confirmed; today an
  import whose confirm was taken back with nothing kept can be removed too. The first move widens it and proves it
  again.

### What the screen sends, and what it follows

**It sends one act at a time, in order, each with its step and a command id made at the press.** A resend with the
same command id answers the first receipt. A rejection ends that act and says why, with whose decision is there. A
failure that may pass keeps the act waiting, with "Save again".

**Acts that wait are kept.** The person's acts that the server has not answered are kept in the saved progress, each
with its step and command id. After a reload they come back marked not saved yet and are sent again; the browser
asks before the page is left while any wait. This is his answer of 2026-11-20: a decision the person made is either
on the server or still waiting, never neither.

**It follows a stream of acts, not a state.** A projection, `DraftRows`, is given the import's events, which hold
every act of the import in one order. (The act's row and text travel on the import's event as well as on the row's;
the trial's event carried the step alone.) In one D1 batch it writes the row's decision to `importDecision` (the table today's readers already read) and
moves the import's place in that order; and it appends the act to a stream, `ImportActs`, keyed by the import. The
screen reads the decisions once, with their place, by a query over those rows, and then receives each act as it is
appended. A stream's entry holds the act alone. (A view that holds every decided row would store its whole state
again with every act, and push it; no read of the library follows a stateful view without its state.)

What the screen shows is the rows as last read, the acts it has received since, and the person's own acts that are
not among them yet, folded with the app's own review rules. It never works out a number: it names steps.

**What the person sees, for the three cases he answered on 2026-11-20:**

- *A save failed and they reload:* the waiting acts are there, marked, and are sent again.
- *Someone else confirms while their acts wait:* nothing is sent to the closed import. The result screen names the
  rows they had decided that were not part of the confirm, with what they had decided, and then drops them. An act
  already on its way is refused with `NotOpen` and ends the same way.
- *The column of a waiting accept is matched again:* the accept is refused with `MatchedSince`. The row shows the
  new proposal as open, and the screen says which accepts were taken back.

### What becomes of `Draft.machine.ts`

`packages/catalog/web/src/Draft.machine.ts` (atoms branch, `dd3e3e9`) is one pure transition,
`step(draft, event) -> { draft, effects }`, with a property test over random orderings. It stays, smaller.

| Part of the machine today | Under the model |
| --- | --- |
| `held`: the server's picture the screen follows | Stays: the rows as last read and the acts received since |
| `flight`, `unsent`, `stalled`, `landed` | One ordered list of the person's acts, each with its step and command id, kept through a reload. An act leaves it when it arrives on the stream or is refused |
| `shown(draft)`, `epoch`, `Restart`, `onScreen`, leaving and returning | Stay. `shown` is the fold "never ahead of what it has been told" is checked against |
| `Send { delta }`, `deltaOf`, `over` with a clear | Go: an act is sent |
| `changesBetween` | Goes with the change to the review region below. If the region kept handing over its whole state, it would stay |
| `SaveAnswered`'s cases on the revision, `Put`, `Ask`, and the "no change" answer being added now | Go: an act is recorded or refused, and the stream brings everything else |
| `SaveRefused`, one case for every refusal | One case per rejection |
| `matching`, `MatchStarted`, `MatchEnded` | Go: an entry carries the command id that caused it |
| The test's hand-written server | Goes: the test drives the real model on `Domain.InMemory` |

**The review region changes too.** `packages/review` keeps its own undo and redo stacks today and hands its whole
state to its caller after every action. Under the model each action carries a step and names its rows; Undo and Redo
are handed to the caller as acts; the stacks are filled from the person's steps on the server; and it can show a
step undone in part.

### The undo history

- **Undo is an act**: `UndoRowStep`, for each row of the step. It is taken only for the sender's own step while that
  step is the row's decision, and puts back what was under it.
- **The history is the person's steps, read from the database**: a query, `MySteps`, over rows `DraftRows` writes
  (the step, who, the label the review region gave the act, the rows it named, and what each row held before). The
  trial's act carries no label yet. It is the same after a refresh and on
  another device. A step is "in force" on the rows that still hold it.
- **Redo is the undone step sent again as a new step.**
- How deep an undo reaches on one row is decision 6.

### His answers on today's contract, carried into the model

Five answers given by dialog, all being built on the atoms branch. The first two are of 2026-11-19, the others of
2026-11-20 and described above.

- **A confirm when the screen is behind the draft: "Refuse, show, confirm again".** His rule: nothing is confirmed
  that was not on screen, and nobody's decision is overwritten at Confirm. In the model the confirm names the last
  change it saw and the import refuses any other; it is a proved rule. A confirm carries no acts: the screen sends
  the acts it holds first, and the confirm names the step of its own last act. If one of them was refused, or
  someone else's change landed between, the last change is not the one named.
- **A save that changes nothing: "Answer says 'no change'".** In the model an act is recorded or refused. A refusal
  says whose decision is there, so the screen shows it without asking for the picture. (A command's reply could not
  carry this: a reply is computed from the state after and the events recorded, and is given neither the command
  nor the state before.)

### Every single thing

One row for every page of [the map](research/00-map.md) and every extra he named: its worked instance in this app,
the move it lands in, and the test, check or screen that shows it used. The moves are under "Order of moves". "Not
run" marks an instance no trial has run.

| Concept | Worked instance | Move | Shown by |
| --- | --- | --- | --- |
| Model | `Catalog`, `Access`, `Usage` | 1, 6, 2 | `Domain.verify` of each answers no error, in its test |
| Command, event, rejection | `DecideRow`, `RowDecided`, `DecidedSince`; `ConfirmImport`, `ImportConfirmed`, `ReviewMovedOn` | 1 | The six stories of the second round |
| Aggregate | `Import`, `Row` | 1 | The standing table of `Verify.model(Review)` |
| Annotations | A description on every served command, view, stream and query, and on each Api | 1 on | A test that fails on a served declaration with none; the command line's help prints them (move 9) |
| Decision | `Deciding`, `Undoing`; `Membership` (adding a person by email) | 1; 6 | Their rules stand "proved" in the table |
| Relation | `ARowBelongsToItsImportsOrganization`; `AClaimedEmailBelongsToAMember` | 1; 6 | The first checked, the second proved, both pinned in the table |
| Invariants and transitions | One of each kind the pull request adds: aggregate invariant `OutcomesAddUpToTheRows`; aggregate transition `AConfirmIsOfWhatItsSenderSaw`; decision transition `ADecisionIsReplacedOnlyByAnActThatSawIt`; model invariant `EveryConfirmedFileAddsUp`; model `eventually` `EveryUploadEnds`; model relation, above | 1, 5 | The standing table. Two more model rules, not run: the acts stream is given every act the import counted; every confirm reaches the projection |
| Unique values | The email an admin adds a person by (`MemberEmail`); a SKU per organization, under decision 10's first option | 6; 4 | A story: two admins add one email, one is refused |
| Deadlines | `ExpireUpload`, scheduled when an upload begins | 5 | A story with the clock moved past the deadline; the `eventually` rule |
| Project layout | Blocks in each context's `model` package, named `<Noun>.<kind>.ts` (decision 15) | 1 | Verify reads every block; one it cannot read fails its test as "not read" |
| View | `ImportStatus` (the lifecycle as the screens may see it), `AllowanceToday` | 3; 2 | An Api test in process reads each |
| View security | Every view and stream checks the organization and the role | 2 on | An Api test in process: a member of the second organization and a viewer against every command, view and stream, each ending in its rejection. Not run |
| Stream | `ImportActs`; `ImportHistory` | 3; 5 | The fold's property test reads it after a cursor |
| Query | `ImportReview` (the first read), `MySteps`, `ImportResultCounts`; `ItemsPage`, `ItemFacets`; `OpenImports`, `PastImports` by cursor | 3; 4; 5 | Slow tests on D1; a story with the memory store |
| Reads and consistency | The Result step reads its counts with the confirm's receipt and says "Writing your items" until they are stored | 3 | A story, and the browser pass |
| Projection | `DraftRows`; `ItemsFromImports` or `ItemRows` (decision 10); `MemberRows` | 3; 3 or 4; 6 | Each batch run twice with the same input writes once (a slow test that reads `revision`) |
| Policy | `UploadDeadline`; `CreateItems` (decision 10); `SuggestOnAsk`; `MailOnConfirm`; `TellTheChannel` | 5; 4; 5; 8; 8 | `Verify.model` runs each behind the others; a story |
| Saga | `SuggestionPass`; `GroupAct` (decision 3) | 5; 3 | A story on the memory host. Not run |
| External system | `Suggester`, `Decider`, `Mailer`, `TeamChannel`, `CatalogueHistory` | 5, 8, 8, 8, 10 | Stubbed in stories; each adapter's own test |
| Api | `MemberApi` (what a browser may send), `ServerApi` (what only the server sends: `ConfirmImport`, `Adopt…`, what a saga sends), `AdminApi` | 2, 3, 6 | A test that `MemberApi` lists none of the server's commands |
| HTTP and OpenAPI | The operator's document over `AdminApi`, `toHttpApi` with a short list | 9 | The document lists exactly those calls |
| CLI | The operator's command line, `toCli` | 9 | A test runs `--help` |
| Agent tools and MCP | The table assistant's read tools, `toToolkit`; an MCP server, `toMcp` (decision 32) | 9 | A test that neither exposes a command that confirms, takes back, edits or changes a role |
| Sessions | `CurrentActor` declared in each model's own package (the prover does not read one from another package), filled by one session lookup | 2 | An Api test in process: no session is refused, a viewer gets `NotPermitted` |
| Better Auth with Alchemy | The model's Worker resolves the actor from the session cookie with `@alchemy.run/better-auth` over the same D1 | 2 | A test on the library's harness with `dev: true`. Not run |
| Discord sign-in | Better Auth's Discord provider behind two settings and a flag | 8 | The browser pass on a stage that has them |
| Local-first | The queue of acts kept through a reload; `Import.predict` on `ImportStatus`, so the Confirm button says "already confirmed" before anything is sent | 3 | The queue's test; a property test that `predict` agrees with the memory host |
| Foldkit | One page for an admin, "Model calls today", watching `AllowanceToday` | 7 | The number goes down live in the browser pass |
| Platform contract | `Usage` runs unchanged in memory, on Durable Objects and on Effect Cluster's pool | 2, 7 | Its stories on the memory host; the harness test on each host. We write no host, so the library's conformance suite has nothing of ours to run |
| Host in memory | Under every model test | 1 | |
| Host on Durable Objects | `Catalog`, `Access` | 2 | The harness test; his deploy to a preview stage |
| Host on Effect Cluster | `Usage`, on the Durable Object pool (decision 13) | 7 | The harness test. Not run |
| Host on Rivet | **Cannot yet.** No Rivet control plane or pool runs on Cloudflare. What removes it is a cost: a control plane the Worker can reach and a pool outside Cloudflare, for a model that needs no D1 (`Usage` is one) | | Say if it is wanted; it is then an option of decision 13 |
| Backfill | `ImportHistory` and its writer are added in move 5, after imports exist: the deploy hands them the events already recorded | 5 | On the preview stage an import confirmed before that deploy is in the history after it. It is not used to rebuild `item` under decision 10's second option |
| Observability | `Alchemy.Telemetry.layerOtlp` in the model's Worker | 2 | With `bun run telemetry` up, a command's span and the `domain.*` metrics are in Grafana |
| Story | One per rule of an import, starting with the six of the second round | 1 | |
| Test tooling | Api tests in process; the library's harness with `dev: true` | 2 | |
| Verify, Prove, Explore | `Verify.model` per model with the standing of every rule asserted; `Prove.decision(Deciding)` as its own quick test; Explore's faults left on and its walks; a rule Verify breaks kept as a story | 1 | Decision 17 says where they run |
| The tutorial | Move 1 follows its parts 1 to 3 on this app's nouns | 1 | No check of its own |
| The Cloudflare tutorial | Part 3 is the harness test, part 4 is `alchemy dev`, part 5's comment on a pull request is the GitHub provider's `Comment` | 2, 9 | |
| Effect Cluster | The pool that hosts `Usage` | 7 | |
| Workflows | `SuggestionPass` and `GroupAct`: a saga is an Effect workflow run by the host's engine. A `Cluster.Workflow` on the pool has no work here, because nothing on the pool reaches D1 | 5, 3 | |
| Singletons and crons | Decision 14 | 7 | |
| Drizzle on Durable Objects | Decision 11's third option; under its first, one import's suggestions in that import's own object, behind the `SuggestionStore` port | 8 | The port's tests against the object. Not run |
| GraphQL | Decision 34 | 9 | |
| Confidence scores | Decisions 26 to 28 | 8 | |
| Resend | Decisions 29 to 31 | 8 | A mail sent through the "mail off" Layer in a test, and through Resend on a stage |
| Distilled clients | Discord for the team's channel (decision 33); GitHub through Alchemy's provider as today; Grafana and 1Password's events client in the operator's scripts; Docker for the operator's check that the telemetry stack is up | 8, 9 | Each script's own run |
| `@alchemy.run/1password` | The stacks' secrets written from `op://` references at a deploy. His to run; no agent resolves a reference | 9 | His deploy |
| Alchemy Git | Decision 35. CI on it **cannot yet**: the package has no runner; one the project builds would remove that | 10 | |
| GitHub provider | Today's environments, secrets and ruleset; the `Repository` resource and a preview's `Comment`. Workflow files **cannot yet**: nothing in the provider writes repository contents; a resource over the contents API would remove that | today; 9 | `GitHub.stack.ts` |

### Where each read and refusal is answered from

| Read or refusal | Today | Under the model |
| --- | --- | --- |
| The decisions the Review step shows | `GET /imports/:id`, from `importDecision` | `ImportReview`, a query over the same rows, which `DraftRows` writes |
| "N of M rows need a decision" in the list of open imports | `review` over the saved decisions | The same, over the same rows |
| The numbers on the Result step | Read back in the confirm's own batch | `ImportResultCounts`, a query that waits for the projection. `ImportStatus` says only what the events say |
| What a take-back would do now, and what it kept | D1 | D1: the handler reads which items changed and sends `TakeBackImport { kept }` |
| Remove refused while an item is in force | D1 | The handler asks D1 first; the import also refuses on what it knows itself |
| Whether a SKU is already there | The unique index | The unique index, under decision 10's second option; the item's own instance under its first |

### The contract, the atoms, the ports

**The contract.** Decision 8 settles whether the screens call the model's Api or stay on `/api/v1`. Either way:

| Today (`packages/catalog/contract/src/Catalog.contract.ts`) | After |
| --- | --- |
| `PUT /imports/:id/decisions`, a `DecisionDelta` | Gone. `DecideRow` and `UndoRowStep` |
| `POST /imports/:id/commit`, a `DecisionDelta` | Names the last change the screen saw. Its handler runs `review`, stages the plan, and sends `ConfirmImport` through `ServerApi` as the person |
| `GET /imports/:id` | `ImportReview`, then `ImportActs`. `GET /imports/:id/table` stays HTTP |
| `POST /imports/:id/mapping`, `/take-back`, `/reopen`, `DELETE /imports/:id` | `MatchColumn`, `TakeBackImport`, `ReopenImport`, `RemoveImport` |
| The four upload endpoints | Stay HTTP for the pieces; `Upload` records begun, finished and expired |
| `POST /assistant/view` | The same call, answered in the model's Worker if its tools come from `toToolkit` |
| `/api/auth/*`, `GET /identity/session`, `GET /system/status` | Unchanged |

`DecisionDelta` and the draft's `revision` leave. `RowDecision` stays as the schema of the text an act carries.

**Two guards go with the writes.** Every write on `/api/v1` passes `SameOrigin` before identity. The model's Api has
no origin check of its own, so the site's Worker applies `SameOrigin` before it forwards a call or an upgrade, with
a test. And a browser reaches only `MemberApi`: the service binding is the only way to `ServerApi`.

**The atoms.** `packages/client/src/Api.atoms.ts` gains the model's client. In `packages/catalog/web/src`,
`Draft.machine.ts` becomes the fold above, `ReviewDraft.atoms.ts` sends acts and follows the stream, and
`Imports.atoms.ts` loses the writes that put a view back by hand.

**The ports.** `ImportStore`'s writes go to the model; a new port holds the D1 batches the projections run; its reads
stay behind the queries. `ItemStore` stays or goes with decision 10. `Answerer` becomes `Suggester`. `AllowanceStore`
follows decision 11. In `packages/access`, `PeopleStore`, `MemberDirectory` and `AuditTrailStore` follow decisions 12
and 19. The in-memory twins of what a model covers are retired for stories.

### What each table becomes

| Table | Under the model | Move |
| --- | --- | --- |
| `importDecision` | Written by `DraftRows`, read as today | 3 |
| `importDraft` | Its status and its place in the acts' order written by `DraftRows`; `revision` goes | 3 |
| `importBatch`, `importOutcome`, `importChange`, `importReplaced`, `item` | Written by the confirm's and the take-back's batches, with their markers; under decision 10's first option `item` is written item by item | 3, 4 |
| `importUpload`, `importUploadChunk`, `importChunk` | Unchanged; `Upload` records what happened to them | 5 |
| `importSuggestion` | Unchanged until move 8; then one import's suggestions in its own object, under decision 11's first option | 8 |
| `member`, `organization` | Written by `MemberRows` under decision 12's first option; unchanged under its second | 6 |
| `activity` | As decision 19 says | 3, 6 |
| `modelCall` | Goes under decision 11's first option, with today's count adopted; behind its port otherwise | 2 |

### How a stored shape changes

A host keeps an aggregate's state as one stored value and decodes it against the current schema at every command. A
state that no longer decodes makes every command to that instance fail; an event whose class is gone fails the same
way. Decision 18 sets the rule. Whatever it is, the shapes that are still open (how deep an undo reaches, decision 6)
are settled in move 1, before anything is stored.

## Decisions for Benjamin

The first option of each is the recommendation, with what it rests on. They are in the order they must be asked;
each says which earlier answer changes its options. Decisions 1 to 22 shape the first moves. Decisions 23 to 35 can
wait until the move that needs them.

### The rules by name, under each answer

What Verify holds of the first trial's 19 rules and the first round's 8 row rules depends on decisions 2, 10, 11
and 12. This table is the reference for those four.

| Rules | Stay proved under | Drop to checked under | Leave the model under |
| --- | --- | --- | --- |
| The import's ten: `OutcomesAddUpToTheRows`, `NoCountIsNegative`, `NothingIsWrittenBeforeConfirm`, `AConfirmOfAClosedImportWritesNothing`, `OnlyAnImportedFileIsTakenBack`, `ATakeBackKeepsWhatWasChanged`, `ASuggestionWritesNothing`, `AnImportNeverChangesOrganization`, `OnlyItsOwnOrganizationChangesAnImport`, `AViewerChangesNothing` | Decision 2's first and second options | Decision 2's third option: they share an instance with the list of rows | |
| The row's: `NobodyClearsAnotherPersonsDecision`, `AnUndoPutsBackWhatWasThere`, `ARowNeverChangesOrganization`, `OnlyItsOwnOrganizationChangesARow`, `AViewerChangesNothing` | Decision 2's first and second options | Decision 2's third option | |
| The row's `ADecisionIsMadeOnWhatItsSenderSaw` | Restated as `ADecisionIsReplacedOnlyByAnActThatSawIt`, proved under decision 2's first and second options | Decision 2's third option | |
| The row's `EveryChangeIsCounted`, `TheCountOnlyGoesUp` | | | Every option: the count of changes is gone from the design |
| The item's five: `ARevisionStartsAtOne`, `ASecondCreateChangesNothing`, `EveryEditWasMadeOnTheCurrentRevision`, `ATakeBackKeepsAChangedItem`, `ARevisionOnlyGoesUp` | Decision 10's first option | | Decision 10's second option: SQL and its tests hold them |
| The allowance's `NeverMoreThanTheDaysAllowance` | Decision 11's first option | | Decision 11's second and third options |
| The organization's three: `AlwaysKeepsAnAdmin`, `NobodyIsCountedBelowZero`, `AFoundedOrganizationStaysFounded` | Decision 12's first and third options, on counts that trust the role a command states | | Decision 12's second option |

### 1. How does the app take what exists only on the library's `main`?

`Decision`, `Relation`, invariants, transitions, `Verify`, and commands without `target` are not on npm. The published
release and `main` cannot share one model's source.

- **Pin the preview build of one `main` commit, for every Alchemy package together (Recommended).** Verified: it
  installs with bun beside Effect 4.1.4, `Verify` runs from it, and `alchemy dev` runs a model on Durable Objects
  locally from it. Every preview build still says `2.0.0-beta.87`, and its peers are that commit's builds, so
  `alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/github` move with it. *Costs:* six commits since the
  release break code written for it. Not verified: that the two infra stacks type-check on the pinned commit; how
  long the registry keeps a commit.
- **Wait for the release that has them**, and build on beta.87 what beta.87 has. *In the way:* no published version
  has pull request 3260 or `Decision`; the next release that does removes it. Until then nothing is proved, and
  decision 2's first option cannot be built.
- **Vendor a build of one commit into the repository**, with its commit and file hashes checked, as the beep-effect
  kit is. Nothing depends on a registry; 64 source files to keep, and the solver and the parser the prover needs.

### 2. Where do review decisions live?

*Changes with decision 1:* its second answer leaves only the second and third options here.

- **The import's lifecycle as one instance, one instance per decided row, and every act a decision across both
  (Recommended).** *Proved:* 27 rules, by name in the table under "Sketch". *Checked:* one relation. *At Confirm:*
  the import orders every act and the confirm, and "nothing is confirmed that its sender had not seen" is a proved
  rule. *Two people, one row:* the second is refused with whose decision is there. *Costs:* about 4 requests an act
  where one instance takes 1; every act writes the import, so two people who act in the same moment make one of them
  retry; an act on a group of rows is decision 3; `Decision` exists only on `main`. *Kept for ever:* one object
  for each decided row, with its acts' events and receipts.
- **The same instances, with a row taking its own commands and no decision across.** One request an act. *Proved:*
  the row's nine rules and the lifecycle's sixteen. *Not held by Verify:* that a row is decided only on an open
  import, that an accept is on the current matching, and the order of a confirm among the rows' acts; a row cannot
  see its import. Those are then done by the projection's order and by `review` leaving out what was decided on an
  older matching or after the confirm, and tested. *At Confirm:* a decision made in the same moment is recorded on
  its row and named on the result screen as not part of the confirm.
- **One instance per import.** One command an act, a group included, recorded or not as a whole. *Proved:* nothing,
  and the prover's design is why: a list from the state or a command is tried with at most 2 items more than its
  schema asks for, a rule that passes that way is checked, and one such command un-proves every rule of its
  aggregate, the import's ten among them. *Checked:* eight rules in every sequence of up to 2 commands; the search
  stopped at its budget before the third. *Costs:* the state is one value that passes 8 MiB at about 42,800 decided
  rows, under the app's 50,000-row maximum, with nothing kept under a decision for undo; an act naming 50,000 rows
  took 2.5 to 5.7 s to fold in Node. *Kept for ever:* every act's event and its receipt, which holds the event
  again, in the import's one object. What removes the limit on proof: a prover that proves over lists, which is not
  on `main`.

### 3. How is an act on a group of rows carried?

*Asked only under decision 2's first or second option.* Accepting a fix for a group is the review's main act. The
sample's groups have up to 9 rows; a large file's can have thousands.

- **One act per row, under one step, sent by a saga (Recommended).** It is the shape the trial ran, and every rule
  stays proved. *What the person sees:* their own screen shows the whole group at once, as its own acts, with
  "saving 2,340 of 6,000". Other people see the rows change a few at a time. A confirm is refused until it ends. *If
  it stops:* the saga sends the rest when it runs again; until then some rows hold the decision and some do not.
  *Costs for 6,000 rows:* about 24,000 requests for the decisions and 12,000 to 18,000 more for deliveries and
  alarms, one after another through the import. The time is not measured; it is measured on the preview stage in
  move 3, before the screen moves. The saga was not run.
- **The group is decided as one unit**: one instance per decided group, the same aggregate as a row under another
  key, and the review's fold gives each row its decision from its own unit and its groups'. One act, about 4
  requests, recorded or not as a whole; its undo is one act. *Proved:* the same rules, since the aggregate is the
  same. *In the way:* the review's fold has to be rewritten to merge the two, and shown to give what today's `act`
  gives for every sequence of actions; and a row's act has to name the group decision it saw as well. Neither was
  run.

### 4. What does a person see when someone else decided the row they are deciding?

*The same options under every answer to decision 2.*

- **Theirs is refused for that row, the row shows the other person's decision and name, and they decide again if
  they still disagree (Recommended).** *Rests on:* "never change a value silently"; the rule is proved, and two
  stories of the second round show it, for a first act and for one queued behind it.
- **Acts merge by field.** Two people's acts on different fields of one row both stand. It needs one command per kind
  of act and a row that holds its decision in parts, which is the shape the prover could not prove. Not run.
- **The later act wins**, and the earlier person sees the row change with the other's name. The act names nothing it
  saw. `ADecisionIsReplacedOnlyByAnActThatSawIt` leaves the model.

### 5. What does an undo do to a row someone else changed since?

- **It takes back the rows that still hold the step, leaves the others, and says which (Recommended).** "Undone for
  11 rows. Row 14 was changed by Dana and stays." *Rests on:* each row's undo is its own act, refused with
  `NotYourStep` where the step is no longer the row's decision; proved.
- **It is refused whole while any row of the step was changed since.** Under decision 2's first two options this
  cannot be one act: the screen would ask every row first and another change can land between. It is whole only
  under decision 2's third option.

### 6. How deep does an undo reach on one row?

*Asked under decision 2's first or second option.*

The app's standard today is every step, one at a time, in the order it was made. The trial's row keeps one decision
under the current one.

- **Every step, with one level proved (Recommended).** The row keeps the decision under the current one in full, and
  for the ones before it only the step each replaced. An undo two or more deep puts back text the server reads from
  the row's own events. *Proved:* that an undo is of the sender's own current step, and the first level exactly.
  *Tested:* three undos on one row end at its first decision. The aggregate cannot check the text put back at the
  deeper levels.
- **Every step, held in the row's state as a list.** Exact at every level. The row's rules drop to checked, because
  the state has a list.
- **One level.** A second undo on the same row leaves it with no decision, and says so. All proved. It changes the
  app's standard.

### 7. Where does the model run, and what does `bun run dev` start?

The Durable Object host needs an Effect-native Worker; the app's Worker is a plain module built with the screens.
Plain `vite` runs no model, under either of the first two options.

- **A second, Effect-native Worker beside the site's, reached by a service binding; locally `bun run dev` starts
  `alchemy dev` for both Workers and the screens' server beside it (Recommended).** *Rests on:* `alchemy dev` ran a
  model on Durable Objects in local workerd from the preview builds with no login, ready in about 5 seconds.
  *Costs:* `bun install && bun run dev` stays one command only if the script starts
  both; not verified: two Workers and Vite side by side, that `alchemy dev` applies the D1 migrations `predev`
  applies today, that its objects survive a restart, and that a forwarded request and upgrade keep the session
  cookie. The browser pass of every move is
  then run on local workerd.
- **The same two Workers when deployed; locally the site's Worker hosts the model in memory under `vite`.** Nothing
  changes in how the app is started. *Costs:* nothing is durable locally, so a restart loses decisions while D1 keeps
  the import, and "a refresh loses nothing" or two people on one import cannot be looked at locally; the browser
  pass would need a preview stage, which only he can deploy.
- **One Effect-native Worker that hosts the model, serves the API and serves the screens as assets.** One origin and
  one deploy. It replaces the Worker's build, `bun run dev` and the uses of Vite's `import.meta.env` in four server
  files, in one move.

### 8. Do the screens call the model's Api, or stay on `/api/v1`?

*Changes with decision 7:* under its third option there is one origin, and the two guards are that Worker's own.

- **They call the model's Api: typed calls for commands, the stream for what is pushed (Recommended).** A group
  leaves `/api/v1` when its screen moves; uploads, the staged table, sign-in and the status stay there. *Rests on:*
  the Review step needs the pushed stream either way, and it is the fuller use of the library's client. *Costs:* two
  doors while the moves happen; the two guards above.
- **They stay on `/api/v1`, every endpoint a thin handler that sends the command as the person.** One public
  contract and one OpenAPI document, as the packet's Api page first had it. The pushed stream then needs its own
  route beside the contract, or the screen polls. The library's client is used by the server only.

### 9. What do Confirm and a take-back become, and what does the person see if one stops halfway?

An aggregate's commit and a D1 batch cannot be one transaction. In both options the confirm is one fact in the
import's events, and what it wrote is written after.

- **The event names a plan staged in D1 (Recommended).** The handler runs the same pure `review` on the rows as
  `DraftRows` wrote them, stores the plan under the confirm's id, and sends one `ConfirmImport` naming the last
  change. *Halfway:* before the command nothing is confirmed, and an unused plan is swept. After it, there is no
  half while the batch can land: the Result step says "Writing your items" until it can count from what is stored.
  If the batch keeps failing, the import is confirmed with no items and cannot be taken back until the cause is
  fixed, because the take-back waits behind it; the screen says "still being written, nothing is lost" and an alert
  fires on the projection's retry log. *Rests on:* a handful of requests for a file of any size (one command, one
  delivery to each consumer, an alarm for each object that queued work; about 14 to 20 with the consumers this
  brief names), against 104 to 204 and more under the second option. *Costs:* the rows are in D1, not in the events.
- **The events carry the rows, in parts of 1,000, and a saga sends the parts.** *Halfway:* "Importing, part 23 of
  51"; the saga finishes it or abandons it and opens the import again with every decision in place. *Gives:* the
  events are the whole truth. *Costs:* about 60 MB kept for ever for a 50,000-row file.

A browser cannot send `ConfirmImport`: only the server's Api lists it. If one is ever recorded with no plan, the
batch fails and is retried, and the alert fires.

Under either option Backfill is used where it is safe: for a stream, a view or a projection added after imports
exist (`ImportHistory`, in move 5). A version bump that rebuilds what a confirm wrote is safe only with decision
10's first option, where the item's edits are events too.

In both, each batch carries a marker: one row keyed by the event it was given, inserted as the last statement of the
same batch, with every other statement conditional on its absence. Today's guard would not serve: it is true again
on a second run.

### 10. Is an item an aggregate whose rules Verify holds?

*Changes with decision 9:* the policy below reads the plan under its first option and the parts under its second.

- **Yes: every item is its own instance (Recommended, by the first rule of this brief).** A policy sends one command
  per ready row; a take-back sends one per item, and an item that was edited refuses it. `EditItem` is a command.
  *Proved:* the item's five rules, as in the first trial; and the SKU as a unique value, the item's relation to its
  import, and a version bump that rebuilds the item rows all become usable. *What the person sees:* items arrive one
  by one, the Result step counts up, and the Items page can show part of an import; a take-back goes item by item.
  *Costs:* 5 to 7 requests an item: about 1,000 for the sample's 155, 193,750 to at least 271,250 for 38,750. On the
  plan he chose the month's allowance covers about three such files, and each one after costs about $1.15. **It
  changes a
  product rule: a confirm and a take-back are no longer one atomic write.** What they keep is proved item by item.
- **No: items stay rows that one projection writes in one batch.** A confirm and a take-back stay all-or-none. The
  item's five rules leave the model, held by SQL and its tests; the item edit stays a guarded write outside it; a
  version bump is not used to rebuild items, since it would undo every edit. *In the way of both at once:* an edit
  and a take-back must be decided against one store in one step. Nothing in the library does that across an instance
  and D1.

### 11. Where does the model-call allowance live?

The packet gave three homes a "use" verdict, and they exclude one another.

- **An aggregate that counts by day (Recommended).** *Proved:* `NeverMoreThanTheDaysAllowance`. Its view feeds the
  admin's live page. **It changes what the person is told:** the 40 calls come back at 00:00 UTC, where today each
  comes back 24 hours after it was used. The same aggregate with today's rolling window holds a list of times, and
  its rule is then checked, not proved.
- **An entity on Effect Cluster's pool**, with the rolling window as today. The rule leaves the model.
- **A Drizzle table in one object per organization, behind the `AllowanceStore` port**, with the rolling window as
  today and a take that is a real transaction. The rule leaves the model.

Under the first option Drizzle on Durable Objects holds one import's suggestions instead, and Cluster hosts the
model (decision 13). Under the second and third the allowance has no view, so the admin's live page watches an
import's status instead.

### 12. Which record of who is a member, with which role, is the record?

Today it is Better Auth's `member` table in D1, which every request reads to build the actor, and which Better Auth
itself also writes.

- **The `Organization` aggregate is the record, and a projection writes the `member` rows (Recommended).**
  *Proved:* the organization's three rules, the decision that adds a person by email and its relation, as the second
  round ran them. The session keeps reading D1. *What the person sees:* a role change shows on People at once; the
  person changed carries the old role until the row lands, and a removed member keeps access for that moment, where
  today it ends at once. Better Auth's own writes to `member` are closed or sent through commands. *Limit:* the
  trial's organization holds two counts and trusts the role a command states; with members held by id the rules are
  checked for short lists only.
- **Better Auth's table stays the record.** People's writes stay guarded statements with their audit line in the same
  batch. The three rules leave the model; the model has no access context beyond the email claim.
- **The aggregate is the record and the session reads the role from a view of it.** No moment of lag. Every request
  reads one object, and Better Auth's own screens that read `member` still need the rows written.

### 13. Which model runs on which host?

*Changes with decisions 11 and 12.* Nothing hosted on Effect Cluster's Durable Object pool can reach D1: the pool's
Worker is declared with a name and three string settings, with no option for bindings. Its gateway is a public
`workers.dev` address behind one token, with no option to turn it off; the app's stack says production never answers
on `workers.dev`.

- **`Catalog` and `Access` on Durable Objects; `Usage`, the allowance and its view, on Effect Cluster's pool
  (Recommended).** Both hosts are used; `Usage` keeps its whole state in its instances and needs no D1; the same
  model runs on three hosts. *Costs:* the gateway above, which he would have to accept for production; a value an
  entity persists there is limited to 2 MiB. Not run in any trial. *Needs decision 11's first option.*
- **Everything on Durable Objects; Cluster runs the allowance as a plain entity** (decision 11's second option).
- **`Access` on the pool.** *In the way:* its projection cannot write the `member` rows and its mail policy has no
  place for a key. It works only with decision 12's third option and mail sent from another Worker.
- **Effect Cluster on Postgres runners**, the host beep-effect names. **Cannot yet:** this deployment has no Postgres
  and no runner pool. Adding both removes that. What carries from the Durable Object pool to that host is the model
  and its entity code, not the storage.

### 14. What scheduled work runs as a Cluster cron or singleton?

The library runs both on the pool. Work that needs D1 cannot run there, for the reason in decision 13; sweeping
unused plans stays a Worker Cron Trigger.

- **A cron that starts each organization's day of model calls (Recommended).** *Needs decisions 11 and 13 as
  recommended.*
- **A cron that prunes old takes from the allowance entity** (with decision 11's second option).
- **A cron that lets go of an email claim nobody took up** (with decision 13's third option).

### 15. Where do an aggregate's blocks live?

What the prover reads, from the second round: a block built with `new`, a function called, or a request context
yielded must be reached by a relative path. An id or a value schema used as a field's type may come from another
package.

- **Commands, events, rejections, rules and the request context in the context's `model` package, one folder per
  aggregate; ids and value schemas stay in `contract` (Recommended).** Each model's package declares its own
  `CurrentActor`, filled by the one session lookup. A rejection a `decide` builds is a `Domain.Rejection` in the
  aggregate's folder; the tagged errors of today stay for what `/api/v1` still serves. A `Domain.Command` takes the
  `.command.ts` suffix; a payload file that stays in `contract` becomes `.payload.ts`. No change to the boundary
  law.
- **Everything in `contract`.** The aggregates and their rules leave `model`, and `contract` stops being only the
  wire.
- **Leave the blocks split and wait for the prover to follow package imports.** *In the way:* its loader resolves
  relative paths only. Until it changes, nothing split that way is proved.

### 16. Are domain blocks built with `new`?

The house rule is `.make`. The prover reads `new Event(...)` in `decide` and does not read `Event.make(...)`. It is
the one exception the model needs to the strict profile, which today has two recorded exceptions "and nothing else
may".

- **`new` in files that hold a `decide`, with that one diagnostic switched off by the file's first line
  (Recommended)**: files named `*.aggregate.ts` and `*.decision.ts`, and no others. Ran in the first trial with the
  app's flags.
- **`new` for every domain class, wherever it is built.** One spelling; more files carry the exception.
- **`.make` everywhere.** *In the way:* the prover. Until it changes, no rule of a `decide` written that way is
  proved.

Two things the first version asked that need no exception: a handler named `Effect.fn("name")(…)` is read by the
prover, so the house rule holds in domain blocks, at the cost of a second span inside the engine's; and `evolve` and
`reply` are plain functions, not effects. What the prover does not read (string methods, `HashMap`, a record,
`Data.taggedEnum`) is kept out of `decide`, `evolve` and the rules, and done before the command is sent. That is a
limit on what those functions do, not a switched-off rule.

### 17. Where does Verify run, and what fails the build?

`Verify.aggregate` on a row took 2 seconds, `Verify.model(Review)` 109. `require` pins only rules that are proved.

- **Each aggregate's and each decision's proof in `bun run check`; each model's search in `check:full` and CI
  (Recommended).** Every Verify test asserts the standing of every rule by name, "proved" or "checked", as the
  library's own example does. A rule that slips from proved to checked fails; a search cut short at its budget
  fails.
- **All of it in `check:full` and CI only.** `bun run check` stays as fast as today; a broken rule is seen later.
- **All of it in `bun run check`.** About two minutes more before every commit.

### 18. How does a stored state or event change shape?

- **By rule (Recommended):** a new field is an optional key; a new meaning is a new event; a state whose shape must
  change is a union of the old and the new, decoded from either; and until the first production deploy, a preview
  stage and local objects are wiped instead.
- **Always wipe.** No rule to keep; fine only while nothing real is stored.

### 19. Who writes each audit line, and what answers the Activity page?

Today every change and its line land in one D1 batch, or neither does.

- **The `activity` table stays the trail (Recommended).** Where a projection writes the change to D1, it writes the
  line in the same batch. Where a D1 write remains, it keeps its line. For a command that changes no D1 row, a
  projection writes the line, a delivery after the change. The Activity page reads the table.
- **A stream per model, and the Activity page merges them with the table's lines.** The trail is the events' own;
  three sources to merge and page.

### 20. How do rows already stored arrive in the model?

Nothing is deployed today; the rows that exist are in development databases.

- **Adopt at first touch (Recommended).** The first command that reaches an import or an organization that has rows
  in D1 and no events is preceded by an `Adopt…` command built from those rows, sent through `ServerApi` under an id
  that makes a second send do nothing. It lands in the move that first touches each (3 for imports, 6 for
  organizations). It is built for the port as much as for this app.
- **Adopt everything at a deploy**, by the operator's command line.
- **Start empty.** Open drafts are confirmed or removed before the move; stored imports become history that cannot be
  taken back.

### 21. What does Remove mean once decisions are events?

Today Remove deletes an open import's decisions and staged rows. An instance's events are never deleted by the
library, and it has no call that deletes an instance.

- **The import is marked removed and its rows in D1 are deleted; the events stay in the objects (Recommended).** The
  person sees what they see today. Every value they typed stays in storage.
- **The app deletes the objects' storage itself**, through a route of its own on the model's Worker. Removed means
  removed. The library does not offer it, so it is ours to keep working across its changes.

### 22. In what order do the moves happen?

- **The review's model in memory, then the host with the smallest slice, then the import's write side as one move
  (Recommended)**: the order under "Order of moves". The review is where the defects are; the first deploy with
  objects is learnt on the allowance; and the import's writes move together, because each reads what the others
  write.
- **People first on the host.** The first deploy is learnt on one page, with decision 12 answered first.
- **The import's write side first on the host.** The hardest move carries the first deploy with it.

### Decisions that can wait for their move

**23. What answers the Items page?** (move 4)

- **A query that answers today's page (Recommended)**: rows, total and page count. No change on screen. The
  library's query by cursor is used for `PastImports` instead.
- **A query by cursor and a second for the total.** Page numbers become Next and Previous.

**24. Do suggestions start by the person's press, or by themselves when a file is staged?** (move 5)

- **By the press, as today (Recommended).** The button sends a command; a policy starts the saga.
- **By themselves.** Suggestions wait on the Review step. A large file can use the day's allowance before anyone has
  looked.

**25. How many calls may one pass take from the 40 a day?** (move 5)

- **One, as today (Recommended).**
- **One per piece of the file, up to a number he sets**, with the person told how many pieces were not asked.

**26. What do confidence scores decide?** (move 8) Today the review's "medium" or "low" is set by a guard from the
file's rows, "never by the model".

- **The guard's word stands, and the probability is shown beside it in the basis sentence (Recommended).** No rule
  changes.
- **The probability sets the word.** A written rule is reversed.
- **A second call checks the other model's answer.**

**27. Which route do scores take?** (move 8)

- **The `@effect/ai-typesafe` package with the key he reserved (Recommended)**: it is the thing he named. No agent
  resolves the key's reference.
- **OpenRouter's route with the key the app has.** Nothing new to install, and the package he named is never
  imported. To verify with one call: whether that key reaches it.

**28. Does a scoring call count against the 40 a day?** (move 8)

- **Yes (Recommended)**: one allowance for every model feature, as the app's rule says.
- **It has its own allowance.**

**29. Which mails does the app send?** (move 8)

- **Reset the password, a notice to a person who was added, and "your import is in" and "taken back" to the person
  who did it (Recommended).**
- **The first two only.**
- **All four, with the import notices to every admin as well.**

**30. Is confirming the address turned on?** (move 8) It is off today. Turned on without a mail key, every new
account is locked out.

- **Off, as today (Recommended).**
- **On, in production only, once the key is there.**

**31. Can a person with no account be invited?** (move 8) His answer infra I8 was "Close sign-up; I add accounts".

- **No (Recommended).** Only a person who has an account is added.
- **Yes**, by opening sign-up to invited addresses. It reverses infra I8.

**32. What may the table assistant's tools and an MCP server read, and who may call them?** (move 9) The older
packet's open question 16 recommended "reads plus proposal-only writes that need approval".

- **Reads only, of what the signed-in person's role may read; the MCP server for admins (Recommended).**
- **Reads, and writes that land as proposals a person approves.**
- **The assistant keeps today's inputs and gets no tool that reads stored data; the MCP server offers the same
  reads.**

**33. What does a notice to the team's channel contain?** (move 8)

- **Counts and the person's name; no file name (Recommended).**
- **The file name as well.**

**34. What is GraphQL used for?** (move 9) `effect/graphql` is a client. Serving the app's data over GraphQL
**cannot yet**: nothing in Effect serves a schema.

- **A driver in the Worker that reads Cloudflare's analytics, an admin-only panel of the day's requests and rows
  written, and the operator's command line reading through the same driver (Recommended).** It uses the client, a
  middleware for the token and the test layer, and it measures what this brief only computes. It needs an API token
  from him.
- **The command line's read only.**
- **Serve the app's data with a server outside Effect**, called with `effect/graphql` from one screen.

**35. What does Alchemy Git hold?** (move 10) This was part of the packet's first question 9 and was lost when the
questions were renumbered.

- **A mirror of this repository on a stage, and a history of each organization's confirmed imports: the result of
  each confirm and take-back as files (Recommended).** *Costs:* a fourth Worker, an R2 bucket for git objects (not
  the presigned uploads, which stay out), `@alchemy.run/aws` installed, and a route that builds git objects with the
  package's internal encoders, since it has no call that commits files.
- **The mirror only.** No customer data in a repository.

Also for its move: the four small choices of Discord sign-in, on [its page](research/concepts/discord-sign-in.md).

## What each move needs from Benjamin, by hand

| Move | What |
| --- | --- |
| 2 | His Cloudflare login, `alchemy state bootstrap` and a deploy to a preview stage, as the infra goal lists them |
| 7 | To accept the pool's public gateway and its token for the stage it runs on |
| 8 | A Resend key and a verified sending domain; a Discord application and a channel webhook or bot; the TypeSafe key, if decision 27 takes it |
| 9 | A Cloudflare API token that reads analytics; a 1Password service-account token for a deploy that writes secrets |
| 10 | Nothing beyond the deploy: the stack makes the bucket and the Worker |

## Rabbit holes

- **The time of a group act.** Not measured. If a group of thousands takes longer than a person should wait for
  Confirm, decision 3's second option is the next thing to run.
- **Checked is not proved.** One relation, the model rules and the `eventually` rules stand on a search 2 commands
  deep and 200 walks.
- **One wide rule un-proves the rest.** A relation is read on every path of every command of both its aggregates. In
  the second round one relation too many left nothing proved. The standing table catches it.
- **The organization on counts.** Its rules are proved for two counts that trust the role a command states. The
  build tries a decision across the organization and one member's own instance before decision 12 is relied on.
- **A live read keeps the actor it connected with.** A person removed from an organization keeps receiving what is
  pushed until the socket drops, unless the model ends it.
- **A batch that keeps failing.** The confirm stays committed, the items never appear, and the take-back waits
  behind it.
- **A deployed object's limit.** 8 MiB is local workerd's. No state in the recommended shape comes near it: the
  widest row the contract allows is under 1 MB.
- **A sender that is not an Api** (a policy, a saga, a scheduled command) must itself provide the actor a command's
  middleware would.
- **The first read and the stream must meet.** The query returns the rows with their place in the acts' order, and
  the stream is followed from that place. No read ran in any trial.
- **`main` moves.** One commit is pinned, and every trial is run again when it changes.
- **Never rename a model**, and a deploy that adds an object class goes out whole.

## No-gos

- No change to a rule of an import, to what a count means, or to a sentence the person reads, except where a
  decision above names the change and he chooses it. The changes named are in decisions 10, 11, 12, 26 and 31.
- `review` stays one pure function, run by the screen and by the server at the confirm. It does not move into
  `decide`.
- A model still proposes and never writes.
- No R2 presigned uploads.
- No deploy, login, state command or key by an agent. No `op://` reference resolved by an agent.
- Nothing built before he signs and the atoms goal is merged.

## Proof (the definition of done)

1. Every row of "Every single thing" passes the check in its last column.
2. Every Verify test asserts the standing of every rule by name. Under the recommended answers that is the 27 of the
   review proved and its relation checked; the item's five, the allowance's one and the organization's three proved;
   `Membership`'s rule and its relation proved; `EveryConfirmedFileAddsUp` and `EveryUploadEnds` checked.
3. The property test of the client fold against the real model on the memory host, with the ten orderings as named
   cases, a reload in the middle, and the rule: every act the person made is in the model's events or in the queue.
4. Each projection batch run twice with the same input writes once.
5. Through the model's Api in process: a member of the second organization and a viewer against every command, view
   and stream, each ending in its rejection; and a call from another origin refused before identity.
6. In two browsers, as two people on one import, on a fresh database and on the runtime decision 7 names: different
   rows decided in both; the same row decided in both; an undo after the other changed the row; a confirm while the
   other decides; a reload with an act waiting; a match beside the other's accept. Then `items_messy.csv` through
   Confirm with the three numbers read (200 rows, 155 imported, 155 stored), at phone width and in both themes.
7. On a preview stage he deploys: the requests and rows written by one act, one group act of the sample's largest
   group and one confirm, read from Cloudflare's analytics, each within twice this brief's arithmetic; and the time
   of a group act of 6,000 rows.
8. `bun run check:full`.

## Map

Four goals, each opened from this brief when the one before it is done. Under the recommended answers:

| Goal | Moves | First slice | Existing code it changes | Net new |
| --- | --- | --- | --- | --- |
| `domain-core` | 0 to 2 | The day's model calls counted by the `Allowance` aggregate and seen on the status line | `packages/infra/src/Inventory.stack.ts`, `packages/access/model` (the allowance's port), `apps/inventory/package.json` (`dev`) | The review's model and its tests in `packages/catalog/model/src/Import/`; the model's Worker; `Usage` |
| `domain-import` | 3 to 5 | One act of the review saved through the model, in two browsers | `packages/catalog` (all four packages), `packages/review`, `apps/inventory/migrations` | `DraftRows`, `ImportActs`, the markers, `Upload`, `SuggestionPass` |
| `domain-access` | 6 | A person added by email through `Membership` | `packages/access` (all four packages), the sign-in options | `Organization`, `MemberEmail`, `MemberRows`, `AdminApi` |
| `domain-extras` | 7 to 10 | `Usage` on the Cluster pool with its cron | `packages/infra`, `packages/drivers` | The pool, mail, the channel, scores, the operator's surface, the history |

Later, when `domain-import` is done: decision 3's second option, if the measured time of a group act calls for it.

## Order of moves

After he signs and the atoms goal is merged. Each move ends with `check:full` and the browser pass, and leaves the
app working. It is written for the recommended answers; decision 22 reorders 2, 3 and 6.

0. **The library**, as decision 1 says, and the two infra stacks checked against it.
1. **The review's model, in memory.** The lifecycle, the row, the two decisions, their stories, their Verify tests
   with every standing asserted, and the fold's property test against the model. Undo's depth settled. Nothing the
   person sees; nothing stored.
2. **The host and the first slice.** The model's Worker, `bun run dev` as decision 7 says, the session, the two
   guards, the Api tests in process, the harness test, telemetry. The first slice is the allowance: its aggregate,
   its view, and each model call's take going through it. His deploy to a preview stage; the first measurements.
   *Interim:* every import still runs on D1 as today.
3. **The import's write side, in one move.** Stage, acts, match, suggestions recorded, confirm, take-back, reopen,
   remove; `DraftRows` and the batches with their markers; adoption at first touch; the Review step's fold, queue
   and stream; the review region's change; the group act measured. `PUT /imports/:id/decisions` and `DecisionDelta`
   leave. *Interim:* the lists, the staged table, `review` at the confirm and the suggestions' handler still read
   D1, which `DraftRows` keeps written, so no reader is left on a table nobody writes.
4. **Items**, as decision 10 says, and the Items page's reads as queries.
5. **The rest of the import**: `Upload` with its deadline, suggestions as a saga, the lists as queries,
   `ImportHistory` and its backfill.
6. **People**: `Organization`, `MemberEmail`, `Membership`, `MemberRows`, `AdminApi`, adoption of the organizations
   that exist.
7. **Cluster**: `Usage` on the pool, its cron, the admin's live page.
8. **Mail, the channel, Discord sign-in, scores, the suggestions' object.**
9. **The operator's surface**: the command line, its HTTP document, the assistant's tools, the MCP server, the
   analytics driver and panel, the operator's scripts, secrets at a deploy, the repository resource.
10. **The history and the mirror.**
