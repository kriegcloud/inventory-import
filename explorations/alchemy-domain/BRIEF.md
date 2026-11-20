---
type: Brief
title: "Brief: the app on @alchemy.run/domain"
description: How inventory-import uses all of @alchemy.run/domain and the extras Benjamin asked for. The saving of review decisions is modelled first, from a trial under Verify; then what every other part of the app becomes, what changes in the HTTP contract, the atoms and the ports, and sixteen decisions that are his. Written only; nothing is built until he signs and the atoms goal is merged.
---

# Brief: the app on `@alchemy.run/domain`

Benjamin, on 2026-11-19: "Not borrow use.", and "if possible find a way to make use of ever single thing". That
reverses the 2026-11-18 decision "core" (the model-first shape over D1 tables, with the library's ideas borrowed); his
words are in [CAPTURE.md](CAPTURE.md), and the reversal is recorded in
[ideal-architecture's decisions](../ideal-architecture/DECISIONS.md).

This brief is built on the packet's reading: [the map](research/00-map.md) of every concept, the
[trial](research/04-trial.md) that proved 19 of the app's rules, and a second
[trial on saving review decisions](research/07-review-decisions-trial.md). The question is no longer whether the app
uses the library. Every decision below is about how.

Nothing here is built. **The build starts after Benjamin says the brief matches, and after the atoms goal is merged
into main.** The order of moves is written against main as it will be then: the screens on atoms, TanStack Query
gone. File names of the web packages are those of the atoms branch at `1171834`.

## Problem

No file in the repository imports `@alchemy.run/domain`. Each rule that matters is held by a guarded D1 batch behind a
port, and checked by tests that sample it. Three things follow.

- **Review decisions can be lost without a word.** The browser sends the difference between two whole pictures of an
  import's decisions as rows to set and rows to clear. When either picture is stale, the difference clears or
  overwrites decisions nobody touched. Two reviews of the atoms goal found ten orderings that do it. The request does
  not say which picture it was worked out from, so no check on the server can stop it. The atoms branch now closes
  those orderings in the browser; the contract still lets any caller send them.
- **The rules are sampled, never proved.** "An organization always keeps an admin", "a second confirm writes
  nothing", "a take-back keeps a changed item" each rest on one SQL statement and the cases its test thought of.
- **The library he set out to explore is not in the app**, so the app teaches nothing about it before beep-effect is
  ported to it.

## What the trials established

- On the library's `main`, `Verify` proved 19 of the app's rules for every state and every input, and checked one
  across 5,173 sequences of commands ([04](research/04-trial.md)).
- Today's set-and-clear shape, put into an aggregate unchanged, **breaks** "no command clears a decision its sender
  did not make". Verify gives the three commands that do it ([07](research/07-review-decisions-trial.md), section 1).
- With commands that say what the person did, a row's eight rules are **proved**, as one instance per row and as
  shared pure functions (sections 3 and 4).
- One instance per import that applies those functions to the rows an act names holds its six rules in every
  sequence of up to 3 commands. They are **checked, not proved**: the prover stops at its limit of 4,096 paths on the
  command that decides rows (sections 2 and 5). A search one command deeper stopped at its budget of 100,000
  sequences with no rule broken.
- The library publishes a build of each `main` commit to its own preview registry. The build of `dbfd0dd` installs
  from it with bun beside the app's Effect 4.1.4, and `Verify` runs from it under Vitest on Node
  ([07](research/07-review-decisions-trial.md), "How it was run").
- Written with `effect/Array`, as the type-check asks of a model package, the same draft gives the same report.
- A draft's state is one stored value of at most 8 MB, written again at every accepted command. With every one of
  50,000 rows decided it measures 10 MB as JSON with ids written out, and 3.3 to 4.2 MB in a compact form.

## The case modelled first: saving review decisions

### The import's draft as an aggregate

One instance per import, `Import`. While it is open it holds each decided row's decision, who made it, in which
step, how many times the row has changed, and the one decision under the current one. It decides one command at a
time, so every act on the import and the confirm have one order.

A command says what the person did. It never says what the whole picture should become.

| Command | What the person did | Recorded | Refused with |
| --- | --- | --- | --- |
| `DecideRows { importId, step, rows: [{ row, decision, seen }] }` | One act of the review, on one row or on a group: accept a fix, keep a row, leave rows out, type a value, choose what happens to a stored item. `step` is the act's id, made once at the press. `seen` is how many changes of that row the screen had been told | `RowsDecided { by, step, rows }`, naming only the rows it changed | `ImportNotOpen`, `NotPermitted` |
| `UndoStep { importId, step }` | Take back my step | `StepUndone { by, step, rows }` | `ImportNotOpen`, `NotPermitted`, `NotYourStep` |
| `ConfirmImport { importId, reviewedAt, … }` | Confirm what I was shown, at the version I was told | `ImportConfirmed { … }` | `ImportNotOpen`, `NotPermitted`, `ReviewMovedOn { current }` |

Each command's reply says which rows it changed and which it left, with the reason for each row it left. An act that
changes nothing records nothing, and the version does not move.

```typescript
// SKETCH: not compiled. The shape the second trial ran as `DraftOfCellsHouse`, in the app's words, with `seen`
// added (the trial ran `seen` on the row only). Names not declared here sit beside it in the same folder.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../Actor.context.ts"
import { RowDecisionFlags } from "./Decision.value.ts"
import { Cell, decided, isOwnStep, undone } from "./Cell.rules.ts"

const Held = S.Struct({ row: S.String, cell: Cell })

export class RowsDecided extends Domain.Event("RowsDecided", {
  by: S.String,
  step: S.String,
  rows: S.Array(S.Struct({ row: S.String, decision: RowDecisionFlags })),
}) {}

export class DecideRows extends Domain.Command("DecideRows", {
  middleware: [Session],
  input: {
    importId: ImportId,
    step: S.String,
    rows: S.Array(S.Struct({ row: S.String, decision: RowDecisionFlags, seen: S.Int })),
  },
  events: [RowsDecided],
  rejects: [ImportNotOpen, NotPermitted],
}) {}

export class Import extends Domain.Aggregate("Import", {
  id: ImportId,
  state: ImportState, // Staged | Open { organizationId, cells: Array<Held> } | Imported | TakenBack
  initial: { _tag: "Staged" },
  transitions: {
    // No command clears a decision its sender did not make.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag !== "Open" || after._tag === "Staged") return true
      const actor = yield* CurrentActor
      return A.every(
        before.cells,
        (was) =>
          was.cell._tag !== "Decided" ||
          was.cell.by === actor.memberId ||
          A.some(after.cells, (now) => now.row === was.row && now.cell._tag === "Decided"),
      )
    }),
    // … AnActTouchesOnlyTheRowsItNames, AnUndoTakesBackOnlyItsOwnStep, AConfirmedImportKeepsItsDecisions,
    //   OnlyItsOwnOrganizationChangesAnImport, AViewerChangesNothing: as in the trial.
  },
  commands: [DecideRows, UndoStep, ConfirmImport],
  keyOf: (cmd) => cmd.importId,
  decide: {
    DecideRows: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new ImportNotOpen({ status: s._tag })
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      // Decision 2 settles what happens to a row whose `seen` is behind. Here it is left as it is.
      const rows = A.map(
        A.filter(cmd.rows, (one) => one.seen === changesOf(s.cells, one.row)),
        (one) => ({ row: one.row, decision: one.decision }),
      )
      return A.isArrayEmpty(rows) ? [] : [new RowsDecided({ by: actor.memberId, step: cmd.step, rows })]
    }),
    // UndoStep, ConfirmImport: as in the trial.
  },
  evolve: {
    // Each named row through the proved function `decided`; every other row as it was.
  },
}) {}
```

**The invariants, and where each is held.**

| Rule | Held by |
| --- | --- |
| No command clears a decision its sender did not make | The row's functions, proved; the draft's transition, checked |
| Two people's decisions on different rows both survive any ordering | `AnActTouchesOnlyTheRowsItNames`, checked; the instance gives the two acts one order whichever arrives first |
| A decision is made on what its sender saw | `seen` against the row's count of changes; proved on the row, not yet run on a draft |
| An undo takes back only its sender's own step, and puts back what was under it | `isOwnStep` and `undone`, proved on the row |
| Nothing changes after the confirm | The draft's transition, checked |
| What a screen shows is never ahead of what it has been told | Not the aggregate's: the client fold below, checked by a property test |

Proved means for every state and every input, after any number of commands. Checked means in every sequence of up to
3 commands on a new instance: the opening and two more. The build pins both in `Verify.aggregate`'s `require`, runs
the draft through `Verify.model` with its random longer walks (12 commands by default), and keeps the property test
below. The trial ran none of the last two.

### What the screen sends, and what it follows

**It sends one command per act.** The act's id (`step`) and its command id are made once, at the press, and stay
with it until the server has answered. A resend with the same command id answers the first receipt and decides
nothing again. Acts go in order, one at a time. A typed rejection ends that act and says why (`NotYourStep`, the rows
decided since, the import no longer open). A failure that may pass keeps the act waiting, with "Save again", as
today.

**It follows a view of the import that the server pushes.** `ImportReview`, keyed by the import, holds what the
Review step shows of the draft: each decided row, who decided it, and the version. The screen reads it once, then
receives each act as it commits. Each entry carries the command id that caused it, so the screen knows its own acts
from another person's without guessing.

What the screen shows is the view at the version it has been told, with the person's own acts that are not in that
view yet applied over it, through the same `Cell.rules.ts` functions the aggregate uses. The screen never works out a
version. It holds the version of the last entry it applied, and nothing else.

That removes, by construction:

- the difference of two pictures (`deltaOf`, `changesBetween`): an act is sent, not a difference;
- the revision arithmetic (`revision === held.revision + 1` meaning "nobody else saved"): the view is pushed, and
  each entry says who caused it;
- the read after a jump (`Ask`), the "known" revision and the "alone" guess;
- the flag that a match made here is on its way (`matching`): the entry's command id says so.

### What becomes of `Draft.machine.ts`

`packages/catalog/web/src/Draft.machine.ts` (atoms branch, commit `dd3e3e9`) is one pure transition,
`step(draft, event) -> { draft, effects }`, with a property test over random orderings. It is the right shape and it
stays, smaller.

| Part of the machine today | Under the domain model |
| --- | --- |
| `held`: the server's picture the screen follows | Stays: the pushed view at the version told |
| `flight`, `unsent`, `stalled`: the person's rows on their way, waiting, or failed | Stay, as one ordered list of the person's acts, each with its command id |
| `landed`: rows the server confirmed at a revision the picture has not reached | Folds into that list: an act leaves it when the view has reached its receipt's version |
| `shown(draft)`, `epoch`, `Restart`, `onScreen`, leaving and returning | Stay. `shown` is the fold the rule "never ahead of what it has been told" is checked against |
| `Send { delta }`, `deltaOf`, `changesBetween`, `over` with a clear | Go: the aggregate takes acts |
| `SaveAnswered`'s three cases on the revision, `Put`, `Ask` | Go: an answer carries its version and the view is pushed |
| `SaveRefused`, one case for every refusal | Becomes one case per typed rejection |
| `matching`, `MatchStarted`, `MatchEnded` | Go: entries carry the command id |
| `typed` and the re-ask for typed SKUs | Stays as a query, `SkusAlreadyThere` |
| The test's hand-written server (`World.server`, `serverTakes`, `mayLack`) | Goes: the test drives the real `Import` aggregate on `Domain.InMemory` |

The property test keeps its rules and gains a real server: the screen never claims a version the aggregate has not
reached; what it holds at a version is what the aggregate held at that version; the person's own acts stay on screen
until the view has them; it sends only the person's acts, each id once; when everything has landed it shows what the
aggregate holds. The ten orderings become ten named cases of it.

### What the undo history becomes

Today an undo step is the earlier decisions of its rows, kept in the browser beside the draft and saved to the
browser's storage. Under the model:

- **Undo is a command.** `UndoStep { step }` is accepted for the sender's own step, on each row where that step is
  still the row's current decision. It puts back what was under it. Decision 3 settles what it does to a row someone
  else changed since.
- **The history is the person's own steps, read from the import's events**: `MySteps`, a read keyed by import and
  member, newest first, each with its label ("12 fixes accepted") and whether it is still in force. It is the same
  after a refresh and on another device, and a restart of the region no longer drops it.
- **Redo is the undone step sent again as a new step.** The read keeps an undone step's rows, so redo also survives a
  refresh.
- **One level is proved; deeper is open.** The row keeps one decision under the current one, which is what the trial
  proved. A row decided three times and undone three times must come back to its first decision, and one level does
  not carry that. Either the row keeps every earlier decision (a list in the state, which the prover checks for short
  lists only), or the undo's handler reads what was there from the import's events and the command carries it, which
  the aggregate cannot check. The build settles it with a test of three undos on one row before the screen moves.
- The browser's saved progress keeps what is not the server's: the chosen file and the place in the list.

### Today's two interim questions, under the model

Two questions on today's contract are with Benjamin now. This brief decides neither. It says what the model does with
each answer.

- **What Confirm writes when the screen is behind the server's draft.** `ConfirmImport` names `reviewedAt`, the
  version the screen had been told, and the aggregate knows its own. "Refuse" is the rejection
  `ReviewMovedOn { current }`: the screen shows what changed and the person confirms what they now see (the trial's
  `DraftOfCells` does this; the first trial showed the same refusal on the published release). "Write what the server
  holds" is the same command accepted, with the receipt's version saying which draft was confirmed. Either answer is
  one line of `decide`. The model makes the two cases different on the wire, which today's contract cannot.
- **Whether a save's answer says that it changed nothing.** A command that changes nothing records no event and the
  version stays. Its reply names the rows it changed and the rows it left, so the answer says so by itself, and the
  case the machine's test calls `mayLack` (an answer naming another person's revision as the sender's own) cannot
  occur.

## What every other part of the app becomes

Two models, as the app has two contexts. [The map](research/00-map.md) has the verdict and the page for each concept;
this is where each lands.

| Concept | In the app |
| --- | --- |
| Model | `Catalog` and `Access`, each checked by `Domain.verify` |
| Aggregate, command, event, rejection | `Import` (above, with match, take-back, reopen, remove), `Upload`, `Organization`, `MemberEmail`; `Item` under decision 5's third option. The existing tagged errors serve as rejections |
| Invariants and transitions | The rules of each aggregate, as in the two trials |
| Decision, relation (main) | `Membership`: adding a person by email, over `Organization` and a `MemberEmail` claim; `AClaimedEmailBelongsToAMember` |
| Unique values | The email an admin adds a person by; a SKU per organization if items become instances |
| Deadlines | `ExpireUpload`, one hour after an upload begins, in place of the sweep |
| View, view security | `ImportReview`, `ImportResult`; every view and stream checks the organization and the role |
| Stream | `ImportHistory`, `OrgActivity` (the audit trail) |
| Projection | `ItemsFromImports`: items, outcomes, changes and the audit line in D1, one batch per confirm and per take-back, each guarded by an `applied` marker |
| Query, reads and consistency | `ItemsPage`, `ItemFacets`, `OpenImports`, `PastImports`, `Changes`, `SkusAlreadyThere`, over the D1 rows; the Result step reads with the confirm's receipt |
| Policy | Ask for suggestions when a file is staged; mail and the team's channel after a confirm; the invitation after a person is added |
| Saga, workflows | `SuggestionPass`: the model pass over an import, one recorded step per piece, each taking one call from the allowance |
| External system | `Suggester`, `Decider` (confidence scores), `Mailer` (Resend), `TeamChannel` (Discord), `CatalogueHistory` (Alchemy Git) |
| Api, sessions, Better Auth | `MemberApi` for the screens and `AdminApi` for People; one `Session` middleware that turns the Better Auth session into `CurrentActor` |
| HTTP and OpenAPI, CLI, agent tools and MCP | An operator's surface over `AdminApi`: `toCli`, and `toHttpApi` with a short list. The table assistant's read-only tools from `toToolkit`. An MCP server from `toMcp` with reads only |
| Local-first | Command ids on every act; `Import.predict` so the Confirm button says "already confirmed" before anything is sent |
| Foldkit | One standalone page for an admin, "Model calls today", live. The React screens stay on atoms with the Api's typed client |
| Hosts | Tests on `Domain.InMemory`; `Catalog` on Durable Objects; `Access` as decision 13 says |
| Backfill | A projection's version bump replays its events. How much it can rebuild depends on decision 5 |
| Observability | The model's spans and metrics beside the request tracing that exists |
| Story, Verify, Prove, Explore | One story per import rule; `Verify.aggregate` per aggregate and `Verify.model` per model, with every proved rule pinned |

**The extras he ticked.**

| Extra | In the app |
| --- | --- |
| Cluster | A host for the `Access` model on Effect Cluster's Durable Object pool (decision 13) |
| Workflows | `SuggestionPass`, as an Effect workflow on the Durable Object engine |
| Singletons and crons | **Cannot yet.** The pool's Worker cannot bind D1 (it is declared with three string settings and no option for bindings, on the release and on main), and with uploads on deadlines no scheduled work is left that lives in entities. What removes it: a pool option for bindings upstream, or scheduled work that lives in entities. Until then a Worker Cron Trigger does any sweep of D1 rows |
| Drizzle v1 on Durable Objects | The model-call allowance: `modelCall` moves into one object per organization, behind the existing `AllowanceStore` port, where a take is a real transaction |
| GraphQL | Decision 14. Serving the app's data over GraphQL **cannot yet**: `effect/graphql` is a client and nothing in Effect serves a schema. What removes it: a server module in Effect, or his choice of another server |
| Confidence scores | Decision 15 |
| Resend | `Mailer`, with a "mail off" Layer on every stage without a key (decision 16) |
| Discord sign-in | Better Auth's own Discord provider behind two settings and a flag. Its four small choices are on [the page](research/concepts/discord-sign-in.md) and are asked when that move starts |
| Distilled clients | Discord for the team's channel; GitHub through Alchemy's provider as today; `@alchemy.run/1password` from main to put a stage's secrets on a deploy; Grafana and 1Password's events client in an operator's scripts |
| Alchemy Git | A history of each organization's confirmed imports as a repository, and a mirror on a stage. CI on it **cannot yet**: the package has no runner; only one the project builds would change that. It needs an R2 bucket for git objects. That is not the presigned uploads, which stay out |

Also **cannot yet**: hosting on Rivet (no Rivet control plane or pool runs on Cloudflare, and a node has no D1
binding; a control plane the Worker can reach and a model that needs no D1 binding would remove it), and declaring
the workflow files from the GitHub provider (nothing in it writes repository contents).

## What changes in the HTTP contract, the atoms and the ports

**The contract.** Two doors while the moves happen: `/api/v1`, and the model's Api as typed calls. A group leaves
`/api/v1` when its screen moves.

| Today (`packages/catalog/contract/src/Catalog.contract.ts`) | After |
| --- | --- |
| `PUT /imports/:id/decisions`, a `DecisionDelta`, answering a revision | Gone. `DecideRows` and `UndoStep` |
| `POST /imports/:id/commit`, a `DecisionDelta`, answering the import | `ConfirmImport { reviewedAt }`; the result is read from `ImportResult` with the receipt |
| `GET /imports/:id` | `ImportReview`, read once and then followed. `GET /imports/:id/table` stays HTTP: 50,000 rows are not a view's state |
| `POST /imports/:id/mapping`, `/take-back`, `/reopen`, `DELETE /imports/:id` | `MatchColumns`, `TakeBackImport`, `ReopenImport`, `RemoveImport` |
| `POST /imports/:id/suggest` | `AskForSuggestions`; the suggestions arrive on `ImportReview` |
| The four upload endpoints | Stay HTTP for the pieces. `Upload` records begun, finished and expired |
| `GET /imports/open`, `/past`, `/changes`; `GET /items/page`, `/facets` | Queries with the same answers |
| `PUT /items/:id` | Stays under decision 5's first two options; `EditItem` under its third |
| People and the audit trail (`packages/access/contract`) | `AddPerson`, `ChangeRole`, `RemoveMember` on `AdminApi`; `OrgActivity` |
| `/api/auth/*`, `GET /identity/session`, `GET /system/status`, `POST /assistant/view` | Unchanged |

`DecisionDelta` and the draft's `revision` leave the contract. `RowDecision` stays as the value a command carries.

**The atoms.** `packages/client/src/Api.atoms.ts` gains the model's client beside the HTTP one: commands through the
existing runtime's functions, one-shot reads as today's read atoms, and a small helper for a live read. In
`packages/catalog/web/src`, `Draft.machine.ts` becomes the fold above, `ReviewDraft.atoms.ts` sends acts and follows
`ImportReview`, and `Imports.atoms.ts` loses the writes that put a view back by hand. The review region
(`packages/review`) is unchanged: it already hands its decisions to its caller's atom, one action at a time.

**The ports.** In `packages/catalog/model/src`: `ImportStore`'s writes (`decide`, `commit`, `takeBack`, `reopen`,
`remove`) go to the aggregate; a new port `ImportWrites` holds the two D1 batches the projection runs; its reads stay
behind the queries. `ItemStore` stays. `Answerer` becomes the external system `Suggester`. `AllowanceStore` keeps its
shape and changes adapter. The in-memory twins of what the model covers are retired for stories on `Domain.InMemory`.

## Decisions for Benjamin

The first option of each is the recommendation, with what it rests on. No option leaves the library or a ticked extra
out; where a thing cannot be used yet, the option says what is in the way.

### 1. Where do review decisions live?

- **One instance per import holds every row's decision (Recommended).** One act is one command, one commit and one
  undo step, whatever number of rows it names; the confirm is the same instance's next command.
  *At Confirm:* the confirm covers exactly the decisions made before it. One made after the screen's version is the
  case of the interim question above, and the instance can tell.
  *Two people, one row:* the instance orders the two acts, and the second is handled as decision 2 says.
  *Rests on:* accepting a fix for a group is the review's main act, and here it is one command (575 KB for an act
  naming 50,000 rows). The row's rules are proved; the draft's are checked to 3 commands.
  *Costs:* the state is one value, 3.3 to 4.2 MB at 50,000 decided rows in a compact form against a limit of 8 MB,
  written again at every act. Not measured on an object.
- **One instance per row.** All eight rules proved outright.
  *At Confirm:* no instance orders the rows and the confirm together. Either every act becomes a `Domain.Decision`
  over the import and the row (main only, about four calls an act), or a decision made in the same moment as the
  confirm is accepted by its row and missing from what was confirmed.
  *Two people, one row:* the row orders them; proved.
  *Costs:* an act on many rows is one command a row. A fix accepted for 6,000 rows is 6,000 requests, can stop
  partway with the fix on some rows, and its undo is 6,000 more. Every decided row is an object kept for ever.
- **Both: the import's instance, and one instance per 1,000 rows**, every act a `Domain.Decision` over the import and
  the pages it touches (main only).
  *At Confirm:* as the first option, because every act reads the import.
  *Two people, one row:* the page orders them. Two people on different rows of one page at the same moment: one of
  them retries, which can be felt as a slow save.
  *Costs:* each act is a two-phase commit, about 4 calls for one row and about 151 for an act across all 50 pages of
  the largest file. States stay small at any size. Not run in any trial.

### 2. What does a person see when someone else decided the row they are deciding?

- **Theirs is not applied to that row; the row shows the other person's decision and name, and they decide again if
  they still disagree (Recommended).** For an act on a group, the other rows are decided and the reply names the rows
  left ("3 rows were decided by Dana meanwhile"). *Rests on:* nothing is ever written over a decision its sender had
  not seen, the app's rule "never change a value silently", and the rule is proved on the row.
- **Acts merge by field.** Two people's acts on different fields of one row both stand; on the same field the later
  is left out as above. Truer to "what the person did". It needs one command per kind of act and a rule by field that
  no trial has run.
- **The later act wins.** The earlier decision goes under it, and its maker sees the row change with the other's
  name. Simplest; a person's decision can be replaced by someone who never saw it.

### 3. What does an undo do to a row someone else changed since?

- **It takes back the rows that are still as the step left them, leaves the changed rows, and says which
  (Recommended).** "Undone for 11 rows. Row 14 was changed by Dana and stays." *Rests on:* the first rule (no command
  clears a decision its sender did not make) and on an undo doing as much as it safely can.
- **It is refused whole while any row of the step was changed since**, naming the rows. Nothing is half undone; one
  changed row blocks an undo of thousands.

Putting the earlier decision back over the other person's is not offered: it breaks the first rule.

### 4. How does the app take what exists only on the library's `main`?

`Decision`, `Relation`, invariants, transitions, `Verify`, and commands without `target` are not on npm. The published
release and `main` cannot share one model's source: a command has `target` on one and the aggregate has `keyOf` on
the other.

- **Pin the preview build of one `main` commit, for every Alchemy package together (Recommended).** The library
  publishes each `main` commit to its own registry. Verified in the second trial: it installs with bun beside Effect
  4.1.4 and `Verify` runs. `alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/github` must come from the same
  commit, because the preview's peers are that commit's builds and every build still says `2.0.0-beta.87`.
  *Costs:* six commits since the release break code written for it, so the two infra stacks are checked against the
  pinned commit first. Not verified: that they type-check there; how long the registry keeps a commit.
- **Wait for the release that has them.** Build now, on beta.87, everything beta.87 has (commands with `target`,
  stories, hosting). `Verify`, `Decision`, `Relation` and the rules arrive with that release, and the breaking
  changes are taken then. *In the way:* no published version contains pull request 3260 or `Decision`; the next
  release that does removes it. Until then the review rules are tested, not proved.
- **Vendor a build of one commit into the repository**, as the beep-effect kit is vendored, with its commit and file
  hashes checked. Nothing depends on a registry; 64 source files to keep, and the solver and the parser the prover
  needs.

### 5. What do Confirm and a take-back become, and what does the person see if one stops halfway?

An aggregate's commit and a D1 batch cannot be one transaction. In every option the import's confirm is one fact in
the event log, and the items are written after it.

- **The event names a plan staged in D1; one projection writes the items in one batch (Recommended).** The handler
  reads the draft at a version, runs the same pure `review`, stores the plan under the confirm's id, and sends one
  `ConfirmImport` naming that version. A take-back is one command and one batch.
  *Halfway:* there is no half. Before the command nothing is confirmed, and an unused plan is swept. After it the
  import is confirmed and the batch is retried until it lands; the Result step says "Writing your items" until it
  can count from what is stored, and "still being written, nothing is lost" if that takes long.
  *Rests on:* 4 Durable Object requests for a file of any size; the items of one confirm land all together or not at
  all, as today. *Costs:* the rows are in D1, not in the events, so a replay rebuilds only from plans that are kept;
  the item edit stays a guarded D1 write outside the model. *In the way of `Item` as an aggregate:* an edit and a
  take-back must be decided against the same store in one step, and here both are in D1.
- **The events carry the rows, in parts of 1,000; the projection holds them and writes once at the close.** A saga
  sends the parts, each under an id made from the confirm's id and the part's number.
  *Halfway:* the import says "Importing, part 23 of 51" and takes no other change; the saga finishes it or abandons
  it and reopens the import with every decision in place. The batch is all-or-none as above.
  *Costs:* 104 to 204 requests and about 60 MB kept for ever for a 50,000-row file; 6 to 8 requests and 240 KB for
  the sample. *Gives:* the event log is the whole truth, so a projection's version bump can rebuild what it wrote.
- **Every item is its own instance.** A policy sends one command per ready row; a take-back sends one per item, and
  an item that was edited refuses it. `EditItem` becomes a command, and the `Item` rules the first trial proved are
  in force.
  *Halfway:* items arrive one by one; the Result step counts up, and the Items page can show part of an import.
  Nothing is lost, and nothing is all-or-none.
  *Costs:* 5 to 7 requests an item: 775 to 1,085 for the sample, 193,750 to at least 271,250 for 38,750 items. It
  changes the product rule that a take-back is one atomic write.

All figures are arithmetic from the source and Cloudflare's documentation, not measurements
([host on Cloudflare](research/concepts/host-cloudflare.md)).

### 6. Where do an aggregate's blocks live?

The prover follows relative imports only.

- **In the context's `model` package, one folder per aggregate (Recommended)**: its commands, events, rejections,
  rules and the value schemas their fields use, reached by relative paths. `contract` keeps ids and what `/api/v1`
  still serves; `host` and `web` import commands from `model`, which the boundary law already allows. A
  `Domain.Command` takes the `.command.ts` suffix, as upstream; a payload file that remains in `contract` is renamed
  `.payload.ts` when its endpoint moves. *Rests on:* it is upstream's layout and needs no change to the law.
  Not tried: whether the prover reads an id schema imported by package name.
- **In `contract`**, which every layer may import. The aggregates and their rules move out of `model`, and `contract`
  stops being only the wire.
- **Leave the blocks split as today and wait for the prover to follow package imports.** *In the way:* its loader
  resolves relative paths only, on main; a change upstream removes it. Until then nothing split that way is proved.

### 7. Are domain blocks built with `new`?

The house rule is `.make`. The prover reads `new Event(...)` in `decide` and does not read `Event.make(...)`.

- **`new` in files that hold a `decide`, with the diagnostic switched off for that file by its first line
  (Recommended)**; `.make` everywhere else. Ran in the first trial on the published release with the app's flags.
- **`new` for every domain class, wherever it is built.** One spelling for commands, events and rejections; more
  files carry the exception.
- **`.make` everywhere.** *In the way:* the prover; a change upstream removes it. Until then no rule of a `decide`
  written that way is proved.

### 8. Does an engine-run handler keep a named `Effect.fn`?

- **No: `decide`, `evolve` and the handlers the engine runs take `Effect.fn(function* …)` without a name
  (Recommended).** The engine opens and names the span, and this is the form both trials ran through the prover. The
  named form stays the rule everywhere else.
- **Yes, named everywhere.** One rule with no exception; a second span inside the engine's. Not tried: whether the
  prover reads the named form.

### 9. Where does the model run?

The Durable Object host needs an Effect-native Worker; the app's Worker is a plain module built with the screens.

- **A second, Effect-native Worker beside the site's, reached by a service binding (Recommended).** The site's
  Worker, `bun run dev` and the build stay as they are; the model's Worker is also where the workflow engine and the
  allowance's object live. *Rests on:* every move leaves the app working. Not verified: that a forwarded request and
  a forwarded WebSocket keep the session cookie.
- **One Effect-native Worker that hosts the model, serves the API and serves the screens as assets.** One origin and
  one deploy. It replaces the Worker's build, `bun run dev` and four uses of Vite's `import.meta.env`, in one move.

### 10. What answers the Items page?

- **A query that answers today's page (Recommended)**: rows, total and page count, with the paging in its input. No
  change on screen; search stays in the D1 adapter. The library adds the typed client, the session check, and a wait
  on the projection after a confirm.
- **A paged query by cursor, and a second query for the total.** Pages never repeat or skip a row while others
  import. Page numbers become Next and Previous, which is a change to the screen and his to make.

### 11. How do rows already stored arrive in the model?

Nothing is deployed today; the first deploy is his.

- **Adopt at first touch (Recommended).** The first command that reaches an import, an organization or an allowance
  that has rows in D1 and no events is preceded by an `Adopt…` command built from those rows, under an id that makes
  a second send do nothing. It works whether or not anything has been deployed by then, and no person loses an open
  draft or a take-back.
- **Adopt everything at a deploy**, by an operator's command built with `toCli`. One moment at which it all moves;
  the deploy waits for it.
- **Start empty.** Open drafts are confirmed or removed before the move, and stored imports become history that
  cannot be taken back. Nothing to build; harmless only while nothing real is stored.

### 12. In what order do the moves happen?

- **The review's decisions first (Recommended)**: the order under "Order of moves". It is where the defects are and
  where the library removes a class of them.
- **People first.** `Organization`, `MemberEmail` and `Membership` are the smallest model, and the first deploy with
  objects is learnt on one page. The review's defects wait.
- **The confirm first.** The hardest write moves while nothing else has; the draft's decisions stay in D1 behind
  today's contract until the next move.

### 13. Which model runs on which host?

- **`Catalog` on Durable Objects; `Access` on Effect Cluster's Durable Object pool, a Worker of its own
  (Recommended).** Both hosts are used, and Cluster is the host beep-effect is moving to. Not run in any trial.
- **Both on Durable Objects; Cluster runs one entity, the allowance**, in place of the Drizzle object. One host to
  learn first; Drizzle on Durable Objects then needs another table to hold.
- **Both on Cluster's pool.** The closest to beep-effect; the published examples and measurements are of the Durable
  Object host.

### 14. What is GraphQL used for?

- **As a client of Cloudflare's analytics, in the operator's command line (Recommended)**: it reads the requests and
  rows written that this brief only computes, so the proof can measure them. Serving waits on what is in the way.
- **Serve the app's data over GraphQL with a server outside Effect, beside `/api/v1`**, and call it with
  `effect/graphql` from one screen. A server library the repository does not have, and a second contract to keep.

### 15. What do confidence scores decide?

`TypeSafe` does not score another model's answer. It answers a closed question with a calibrated probability.

- **It decides the closed questions itself (Recommended)**: a row's category, a field's column, behind a new
  `Decider` port, the probability turned into the review's existing "medium" or "low" word and its number into the
  basis sentence. The rules answer when there is no key. One call from the allowance each. To verify with one call:
  whether the existing OpenRouter key reaches it; if not, it needs the key he has reserved, which no agent resolves.
- **It checks the other model's answer in a second call.** Closest to a score on today's suggestions; two calls from
  the allowance for each.

### 16. Which mails does the app send?

- **The three a person is stuck without, then the two notices (Recommended)**: confirm the address, reset the
  password, the invitation; then "your import is in" and "your import was taken back" to the person who did it.
- **The three only.**
- **All five, with the notices to every admin as well.**

## Rabbit holes

- **The draft's state at the largest file.** Fitting 50,000 decided rows rests on the compact form and on what a
  3 to 4 MB write at every act costs, which nothing has measured. The form measured keeps nothing under a row's
  current decision, so rows decided twice add to it. `ImportReview`'s own state is one value under the same limit. It
  is measured on a preview stage before the screen moves; if it does not hold, decision 1's third option is the
  fall-back.
- **Checked is not proved.** The draft's six rules stand on a search three commands deep; one command deeper it ran
  out of its budget. `Verify.model`'s walks and the property test are what cover longer histories; neither has run.
- **A live read through the site's Worker.** Not verified. If a forwarded WebSocket fails, the Api's HTTP protocol
  streams the same read by polling, or decision 9 takes its second option.
- **The first read and the pushed entries must meet.** A view's entry carries its whole state, which is too large to
  push at every act for a big file; the build reads once and then follows acts. No view ran in any trial.
- **`main` moves.** Six breaking commits in a week. One commit is pinned, and both trials are run again at each
  change of it.
- **A batch that keeps failing.** The confirm stays committed and the items never appear. It needs an alert on the
  projection's retry log and the Result step's third sentence.
- **Local development with objects.** `alchemy dev` runs them; plain `vite` does not. Screen work can run the model
  in memory, with nothing durable.
- **The prover's reach.** It does not read `Data.taggedEnum`, `HashMap`, `effect/String` or a schema record. Domain
  rules are written with what it reads; the house rules that ask for those apply outside domain blocks.
- **The browser bundle.** One aggregate's declarations add about 133 kB (43 kB compressed). The screen imports the
  row's functions and the commands, and `predict` only where it earns it.
- **Never rename a model**, and a deploy that adds an object class goes out whole.

## No-gos

- No change to a rule of an import, to what a count means, or to a sentence the person reads, beyond the sentences
  this brief names.
- `review` stays one pure function, run by the screen and by the server at the confirm. It does not move into
  `decide`.
- A model still proposes and never writes.
- No R2 presigned uploads.
- No deploy, login, state command or key by an agent. No `op://` reference resolved by an agent.
- Nothing built before he signs and the atoms goal is merged.

## Proof (the definition of done)

1. `Verify.aggregate` for every aggregate and `Verify.model` for both models, with `require` naming every rule the
   trials proved, and the draft's rules pinned as checked.
2. The property test of the client fold against the real `Import` on `Domain.InMemory`, with the ten orderings as
   named cases.
3. A story per import rule: confirm once, a confirm on a draft that moved on, a second confirm, a take-back while
   unchanged, a take-back that keeps a changed item.
4. Each projection batch run twice with the same id writes once.
5. In two browsers, as two people on one import, on a fresh database: different rows decided in both; the same row
   decided in both; an undo after the other changed the row; a confirm while the other decides. Then
   `items_messy.csv` through Confirm with the three numbers read (200 rows, 155 imported, 155 stored), at phone
   width and in both themes.
6. On a preview stage he deploys: the requests and rows written by one confirm, read from Cloudflare's analytics,
   beside this brief's arithmetic.
7. `bun run check:full`.

## Order of moves

After he signs and the atoms goal is merged. Each move ends with `check:full` and the browser pass, and leaves the
app working. It is written for the recommended options; another answer to decision 12 reorders 3 to 8.

1. The library, as decision 4 says, and the two infra stacks checked against it.
2. `packages/catalog/model`: `Cell.rules.ts`, the `Import` aggregate with the draft's commands, its stories and its
   `Verify` test. In memory only; nothing the person sees.
3. The model's Worker and its place in the stack (decision 9). His deploy to a preview stage; the state's size and
   the live read measured there.
4. The Review step on the model: `ImportReview`, the acts, the fold, the undo history. `PUT /imports/:id/decisions`
   and `DecisionDelta` leave.
5. Confirm and take-back (decision 5): the projection, its markers, the Result step's sentences.
6. The rest of the import: `Upload` with its deadline, match, suggestions as a saga, the lists as queries.
7. The Items page as queries (decision 10).
8. `Access`: `Organization`, `MemberEmail`, `Membership`, on its host (decision 13); People on `AdminApi`.
9. The allowance in its object; mail; Discord sign-in and the team's channel; confidence scores.
10. The operator's surface: the command line, its HTTP document, the agent tools, the status page, the analytics
    read.
11. The history of confirmed imports, and the mirror.
