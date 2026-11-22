---
type: Research
title: Pull request 3260, Verify proves and searches a model's rules
description: What alchemy-run/alchemy pull request 3260 (merged to main 2026-11-19, not in 2.0.0-beta.87) and its follow-ups 3503 and 3504 add to @alchemy.run/domain, what a trial of it on a model of inventory-import showed, and the standing of each of the app's ten rules.
tags: [alchemy-domain, checking, research]
---

# Pull request 3260: Verify proves and searches a model's rules

Pull request 3260 in `alchemy-run/alchemy`, by sam-goodwin, merged to `main` on 2026-11-19 (merge commit
`e4adb720c`): 27 commits, 112 files, 19,139 lines added and 18 removed. Most of the size is the prover and the
explorer. It is on `main@dbfd0ddb` and not in the published `2.0.0-beta.87` (the `version` field on main still reads
`2.0.0-beta.87`: `packages/domain/package.json:3`). The live site does not have its pages yet: both
`https://alchemy.run/domain/verifying-models` and `https://alchemy.run/domain/verifiable-code` answered 404 when
checked on 2026-11-19.

The idea in one line: write down what must always be true on the declarations, and one test proves it with a solver
or finds the shortest sequence of commands that breaks it, without anyone writing a value to try.

It runs on this app's rules today, from main: a trial on 2026-11-19 wrote a model of inventory-import beside the
upstream example on `main@dbfd0ddb` and proved 19 of its rules with it (the trial and its source:
[the trial](04-trial.md); the rules: [this app's rules under Verify](03-this-apps-rules-under-verify.md)).

Concept pages: [invariants and transitions](concepts/invariants-and-transitions.md),
[relation](concepts/relation.md), [verify](concepts/verify.md); the internals are in
[prove](concepts/prove.md) and [explore](concepts/explore.md).

## 1. New declarations

All read at `main@dbfd0ddb`.

| Where | Field | Given | Proved or searched |
| --- | --- | --- | --- |
| Aggregate | `invariants: { [name]: (state) => boolean }` | the state | proved per command (`Aggregate.ts:157`) |
| Aggregate | `transitions: { [name]: (step) => boolean \| Effect<boolean> }` | `{ before, after, command, events }`; may yield the request context | proved per command (`Aggregate.ts:120-129`, `:167-171`) |
| Decision | `transitions` | the same four, `before`/`after` keyed by the names in `reads` | proved per step (`Decision.ts:79-88`, `:150-155`) |
| Model | `invariants` | every aggregate instance `{ id, state, events }`, every view key `{ id, state }`, what each projection was given `{ id, event }` | searched, at rest (`Model.ts:149-151`, `:177-203`) |
| Model | `eventually` | the same | searched, at the end of sequences that run their course (`Model.ts:167-169`) |
| Model | `relations: { [name]: Domain.Relation({ over, holds }) }` | `{ id, state }` for one instance per name | proved across commands and decisions, else searched (`Model.ts:158`, `Relation.ts:77-79`) |

A rule's name is how the report and `require` refer to it: `Aggregate.Rule`, `CommandTag.Rule` for a decision's own
transition, `Model.Rule` for a model's rules and relations (`packages/domain/src/Verify.ts:232-267`). Nothing
reads these fields at run time: no host checks them on commit (search of `packages/domain/src` on main finds them
only in `Prove`, `Explore` and `Verify`).

The example bank uses each: `Account` gets two invariants and three transitions, one an `Effect.fn` reading
`CurrentActor` (`examples/cloudflare-domain/packages/domain/src/Account/Account.aggregate.ts:85-104`);
`UsernameClaim` a transition (`Customer/UsernameClaim.aggregate.ts:11-16`); `Registration` two decision transitions
(`Customer/Registration.decision.ts:35-44`); `Bank` two relations, three model invariants and one `eventually`
(`Bank.model.ts:56-110`). To make the account rules provable the pull request also changed every money-moving
command's `amount` from `Cents` (any whole number) to a new `Amount = Cents.check(Schema.isGreaterThan(0))`
(`Money.ts:6-7`, seven command files): a run-time change, since a non-positive amount is now refused at decode.

## 2. New modules

| Module | Lines | Public surface |
| --- | --- | --- |
| `packages/domain/src/Verify.ts` | 784 | `model`, `report`, `verified`, `aggregate`, `render`; `Options`, `AggregateOptions`, `Require`, `Rule`, `Run`, `Report`, `AggregateReport`, `Unproved`; `VerifyError`, `NotVerified`, `AggregateNotVerified` |
| `packages/domain/src/Prove.ts` | 594 | `report`, `proved`, `invariants`, `render`, `decisionReport`, `decisionProved`, `decision`, `renderDecision`, `ATOMIC`; `ProveError`, `InvariantsNotProved`, `DecisionNotProved`; `Verdict` tags `Proved`, `Bounded`, `Violated`, `Unconfirmed`, `NotTranslated`, `Unknown` |
| `packages/domain/src/Explore.ts` | 788 | `report`, `check`, `undone`, `describe`, `script`, `render`; `ExploreError`, `InvariantBroken`, `Incomplete` |
| `packages/domain/src/Relation.ts` | 79 | `make` (exported as `Domain.Relation`), `Instance`, `Instances`, `Definition`, `Relation`, `Any` |
| `src/Prove/internal/*` | 6,754 on `main@dbfd0ddb`, after 3503 grew `Library` (+329) | `Interpreter` 1,400, `Paths` 1,046, `Library` 1,052, `Relations` 600, `Symbolic` 596, `Check` 569, `Induction` 417, `Smt` 330, `Value` 328, `Source` 246, `Decide` 170 (all internal: the package maps `./Prove/internal/*` to `null`) |
| `src/Explore/internal/*` | 4,532 | `ModelSearch` 3,786, `Search` 572, `Script` 174 (internal, likewise) |

Changed: `Aggregate.ts` (+34), `Decision.ts` (+54), `Model.ts` (+75), `index.ts` (+10, the `Relation` export and
type namespace). The internals are blocked as import paths (`packages/domain/package.json:59-60`). The modules are
imported by subpath (`@alchemy.run/domain/Verify`, `/Prove`, `/Explore`), not from the root.

## 3. The report's three parts

From `Verify.render` (`Verify.ts:632-784`):

1. **Proved**, "for every state and every input, after any number of commands": an aggregate's invariants and
   transitions, a decision's transitions and relations, where the solver shows no state the rules allow and no input
   breaks them. A rule of an aggregate counts only when every command of its own and every decision that records on
   it keeps it.
2. **Checked**, "in every sequence of up to N commands through <Apis>", then the faults that applied: each event
   delivered twice, each reaction also run behind the others that wait, each saga step run twice (only with a saga),
   every answer an external system can give (only with one) (`Verify.ts:657-672`); it prints the numbers of
   sequences and states. Model invariants and `eventually` never get further than this, and a rule the solver could
   not prove drops here with the reason printed under it.
3. **Sampled**, 200 seeded walks of up to 12 commands by default, for rules that take more commands to break than
   the search depth.

As the trial printed them for the model of this app: "Proved: for every state and every input, after any number of
commands" over 19 rules; "Checked: in every sequence of up to 2 commands through InventoryApi, with each event
delivered twice, each reaction also run behind the others that wait", 5,173 sequences and 2,433 states, over the
model invariant `EveryConfirmedFileAddsUp`; "Sampled: 200 longer sequences, of up to 12 commands picked at random
(seed 1)"; 42 sequences the explorer found and 200 walks run on the real model as stories. The "Assumed" list
included "whole numbers are exact" within 2^53, "middleware lets every caller in: who sends a command is anyone its
request context allows", and "what a projection writes, and what a stream or a query gives, is not checked: only
what a projection is given". `Verify.aggregate` answered in under two seconds per aggregate; `Verify.model` in about
36 seconds.

Then, as present: run on the real model (with a `Story` runner), not done, external calls repeated on a second
delivery, schema checks not proved kept, parts left out (views, projections, streams, queries no rule needs), rules
not looked at, and what is assumed. A pass means no rule broken, every replay agreed, and nothing left undone;
`require: { proved: [...] }` makes a rule that slipped to checked fail.

## 4. How a broken rule comes back

- From the search (`Verify.model`, `Explore.check`): the shortest sequence, step by step, with each policy's
  question to an external system and the answer the solver picked, each reaction and whether it handled its event
  again; then either "As a story, to keep as a test:" and `Story.when` / `Story.call` / `Story.succeed` /
  `Story.then` lines to paste, or a note that it needs a platform fault a story does not do (`Verify.ts:705-728`).
  The error is `NotVerified` with the report attached.
- From the proof (`Prove.invariants`, `Prove.decision`, inside `Verify.aggregate`): the counterexample as `state`,
  `command`, any request context, `now`, `events` and `after`, run on the real `decide` and `evolve`
  (`Prove.ts:319-341`).
- As the trial saw it: a copy whose `evolve` of `RowLeftOut` forgot to lower `ready` failed `Verify.aggregate` with
  `NotVerified`; the report named the rule (`OutcomesAddUpToTheRows`), the command (`LeaveRowOut`), the state before
  (`{ _tag: "Open", rows: 1, ready: 1, waiting: 0, left: 0 }`, among other fields), the events (`RowLeftOut`), the
  state after (`left: 1`), and the shortest sequence: `StageImport { rows: 1, ready: 1 }`, then `LeaveRowOut`.
- From a replay: when the real model does something other than what the explorer read, "the model does something
  else in N", with the story and the failure (`Verify.ts:738-760`).

## 5. Tests and fixtures added

All under `examples/cloudflare-domain/packages/domain/test/`, new on main.

| Test | What it shows |
| --- | --- |
| `Bank.verify.test.ts` | The whole bank: 10 rules proved (account, username claim, registration, both relations), 4 checked; every found sequence and over 50 walks replayed; nothing undone; `Verify.aggregate(Account)` passes. Timeout 300 s. |
| `Bank.prove.test.ts` | `Prove.invariants(Account)` and `Prove.decision(Registration)` pass. |
| `Bank.explore.test.ts` | Three commands on an account reach every outcome; two through the Apis reach the policy-opened account, the decision's two-instance record, the 24-hour expiry and the saga's endings; the `Careless` fixture's rules are broken by real sequences (a deposit of 1,001 found by the solver). |
| `Verify.test.ts` | `eventually` checked and replayed (`Chore`); a broken rule fails with a pasteable story and the solver's risk score (`Shop`); a handler that differs from the source fails the replay; `Escrow` true-but-unproved until `Covered` adds the missing invariant. |
| `Relation.test.ts` | Two relations proved together (`Club`); a weaker one checked, with the unreachable states it fails from (`Vague`); a decision that frees a seat breaks one (`Careless`); an aggregate's own command breaks one (`Park`). |
| `Transitions.test.ts` | `Counter`: a transition proved for one command and violated by another; one reading the request context violated by a non-admin; the explorer finds `Count` then `Clear`. |
| `Decision.test.ts` | `Purse` decisions: proved, overdrawing, skimming a cent, the same purse named twice, a list of purses (`Bounded`); an aggregate only decisions write to is proved only with them; `Till` models a decision as one step in every sequence. |
| `Guards.test.ts` | A pass means the check was whole: a command that leaves the schema, unread code (`Math.sign`), a command never accepted, invariants written outside the definition (refused), a policy left out, a budget hit, rounded arithmetic. |
| `Eventually.test.ts` | A rule false along the way holds at the end (`Chores`), and one never reached at the end fails (`Lingering`). |
| `Faults.test.ts` | Reordered reactions break `Tally`; a redelivered event breaks `Tickets` through an external number; a rerun saga step breaks `Booking`. |
| `Consumer.test.ts` | Runs `Verify.aggregate(Account)` and `Explore.report(Bank)` as a consumer; also copied out of the workspace by `scripts/test-domain-consumer.ts` (137 lines) and run from the published tarballs in the `pkg.yml` workflow. |
| `Nodes.test.ts`, `Syntax.test.ts`, `Walks.test.ts` | Read only by their test names: views, view-of-view and projections followed; the syntax the prover reads; walks find a five-command break and repeat by seed. |

Fixtures (29 files under `test/fixtures/`): `Aside`, `Basket`, `Counter`, `Deny`, `Drift`, `Escrow`, `Gap`, `Label`,
`Parity`, `Quota`, `Shadow`, `Sheet`, `Stack`, `Stride`, `Vault`, `Wallet`, `Window` aggregates; `Booking`,
`Careless`, `Chore`, `Club`, `Ladder`, `Mall`, `Outlet`, `Shop`, `Tally`, `Ticket`, `Till` models; `Purse`
decisions. Pull request 3503 added `Locker.aggregate.ts`.

## 6. Docs pages

- New: `website/src/content/docs/domain/verifying-models.mdx` (679 lines added), listed in the sidebar and
  `llms.txt`.
- Changed: `aggregate.mdx` (+10, an invariant on the account and a link), `decision.mdx` (+16, "Say what it must
  keep"), `model.mdx` (+2, `Domain.verify` checks the declaration, not the behaviour), `story.mdx` (one sentence).
- The skill: `packages/domain/skills/alchemy-domain/references/testing.md` gains "Rules: verify the model" (+67),
  `SKILL.md` step 4 and `building-blocks.md` mention decision transitions.
- Also a Remotion video project under `demos/domain-verify/` (not part of the package).

## 7. Dependencies

`packages/domain/package.json` gains runtime `dependencies` `z3-solver` (catalog `5.3.3`) and `oxc-parser` (catalog
`0.141.0`) (`pnpm-workspace.yaml:211`, `:260`). Both load lazily, only when a check runs (`Prove/internal/Smt.ts:215-222`,
`Prove/internal/Source.ts:109-114`). Z3 is WebAssembly and starts under Node, not Bun. The example adds
`@effect/platform-node` as a dev dependency for `NodeServices.layer`.

## 8. The follow-ups

- **3503, "Verify reads effect/Match"** (merged 2026-11-19, +516 / -4): the prover reads `Match.value`, `type`, `when`,
  `not`, `whenOr`, `whenAnd`, `tag`, `tags`, `tagsExhaustive`, `discriminator(s)`, `discriminatorsExhaustive`,
  `valueTags`, `typeTags`, `withReturnType`, `orElse`, `orElseAbsurd`, `exhaustive`, `option` and the `any` and
  `defined` patterns (`Library.ts` +329). Still not read: `result`, `tagStartsWith`, `discriminatorStartsWith`,
  `literals`, and type patterns such as `Match.string`. Adds the `Locker` fixture and a section of `Syntax.test.ts`.
- **3504, "verify the bank in the tutorial, and list what the prover reads"** (merged 2026-11-19, +364 / -15): the
  tutorial's part 1 adds and proves an account invariant (its first run fails on a negative deposit, fixed by an
  `Amount` above zero), part 4 verifies the whole bank; new page `verifiable-code.mdx` (121 lines) lists the
  statements, expressions, numbers, strings, lists, schemas, checks and library functions the prover reads.

## 9. Said to be not done, or limited

From the pull request's description and the docs page (`verifying-models.mdx:630-690`):

- Not read: a loop whose number of turns depends on an input, a property read by a key from an input, a record
  whose keys the schema leaves open, code that changes a value it was given, `async`, string methods, regular
  expressions. Each fails with file, line and reason.
- Not proved: arithmetic on numbers that may not be whole (refused, not treated as exact); a loop over a list from
  the state or a command (tried with up to 2 extra items, so checked); a model's invariants and `eventually` (only
  searched and sampled).
- Not checked: what a projection writes, what a stream or query returns; middleware (every actor the context's
  schema allows); how a platform commits a decision (assumed all or nothing).
- A pass is bounded: a longer sequence no walk took could still break a model rule.
- Cost: the bank's default run is about 45 seconds; depth 3 with every fault is "more than a test should wait for".

## What the trial showed about the prover

Run on `main@dbfd0ddb`, each case in its own test file (details in [prove](concepts/prove.md)):

- `import * as S from "effect/Schema"`, no semicolons and two-space indent: read.
- An event built with `Event.make({...})` in `decide`: not read ("decide for StageImport returns something that is not
  an event"). Built with `new`: read. The app's lint rule `newSchemaClass` needs an exception for domain block files;
  the first-line form `// @effect-diagnostics newSchemaClass:off` was run on beta.87 with a clean type-check.
- Commands, events and rejections imported by package name: not read ("constructs a class, which is not an event, a
  rejection or a command"); a helper imported by package name: "calls <package>.isFirstRevision, which the prover has
  no model for". The loader resolves only specifiers that start with `.` (`Prove/internal/Source.ts:229`).
- `Effect.fn` decides and transitions that read a `Domain.RequestContext` (`CurrentActor`), a decide context's
  `version` compared with a command field, and whole-number arithmetic and comparisons over a union of tagged
  structs: read and proved.
- Two aggregates of one name in one test file: one file read for both, "the real code disagrees with what the
  explorer read".

Not run: a `Domain.Decision`, a `Domain.Relation`, views, projections, policies, sagas, queries, and Bun.

## What this app would use

The ten rules of the app primer, as the trial found them. Rules marked proved were proved "for every state and every
input, after any number of commands" in the trial's model (aggregates `ImportDraft`, `Item`, `Allowance`,
`Organization`); what Verify cannot hold stays in a story or a slow test on a real D1.

| # | Rule | Proved in the trial | Needs a story or a slow test because Verify cannot hold it |
| --- | --- | --- | --- |
| 1 | Outcomes add up to the rows in the file | `ImportDraft.OutcomesAddUpToTheRows`, `ImportDraft.NoCountIsNegative` (invariants); the model invariant `Inventory.EveryConfirmedFileAddsUp` was checked, not proved | `review` itself (string methods, `HashMap`) stays a pure function under `it.prop`; its counts reach the model as command fields. The three numbers read back from D1 stay a slow test |
| 2 | Nothing is written as an item before Confirm | `ImportDraft.NothingIsWrittenBeforeConfirm` (transition) | That no `item` row exists in D1 before the confirm's batch is SQL: a slow test |
| 3 | A second import of the same file adds nothing | `Item.ASecondCreateChangesNothing` (transition; the item is keyed by organization and SKU key) | The unique `(organizationId, skuKey)` key and `ON CONFLICT DO NOTHING` in D1, and the "Already there" count read from stored rows: slow tests |
| 4 | A take-back removes only items at revision 1 and keeps a changed one | `Item.ATakeBackKeepsAChangedItem`; `ImportDraft.ATakeBackKeepsWhatWasChanged`, `ImportDraft.OnlyAnImportedFileIsTakenBack` | The revision checks written in SQL today (`ImportStore.adapter.ts`, `takeBack`): a slow test until the take-back is a decision |
| 5 | An edit on an old revision is refused | `Item.EveryEditWasMadeOnTheCurrentRevision`, with `Item.ARevisionStartsAtOne` and `Item.ARevisionOnlyGoesUp` | `ItemStore.edit`'s SQL guard: a slow test |
| 6 | Every row belongs to one organization | `ImportDraft.AnImportNeverChangesOrganization`, `ImportDraft.OnlyItsOwnOrganizationChangesAnImport` (an `Effect.fn` transition reading `CurrentActor`) | The SQL rows in D1: tenancy keys `(organizationId, id)` and every query's filter (`apps/inventory/test/server/Tenancy.slow.test.ts`) |
| 7 | An organization always keeps an admin | `Organization.AlwaysKeepsAnAdmin`, `NobodyIsCountedBelowZero`, `AFoundedOrganizationStaysFounded` (counts of admins and others; `ChangeRole` and `RemoveMember` reject `LastAdmin`) | Better Auth's `member` rows in D1: a slow test |
| 8 | A model proposes, a person confirms | `ImportDraft.ASuggestionWritesNothing`, `ImportDraft.AViewerChangesNothing` | Middleware is not run, so these hold for every actor the context allows; that the session's middleware sets the right actor is a story or an Api test |
| 9 | At most 40 model calls a day, counted before the call | `Allowance.NeverMoreThanTheDaysAllowance` | "Before the call" is the order against the model service, outside the model: a story; the `modelCall` rows in D1: a slow test |
| 10 | A confirm of a closed import, or a second take-back, writes nothing | `ImportDraft.AConfirmOfAClosedImportWritesNothing`; a second take-back is refused because only an `Imported` import is taken back (`OnlyAnImportedFileIsTakenBack`) | The confirm's own row written only while the import is open, in D1: a slow test |

Never held by Verify, whatever the model: the search index (`itemSearch`, FTS5 with its triggers), and what a
projection writes (the report assumes it). Across all ten, the app's one-batch D1 writes are what Verify would call a
decision's commit and assume atomic; it does not check them.

**Use, from main:** one `Verify.aggregate` test per aggregate and one `Verify.model` test, under Vitest on Node,
with the blocks written as the prover reads them (`new` in `decide`, relative imports). It is not on npm: the app
takes it from `main@dbfd0ddb`, which is a decision in the brief.
