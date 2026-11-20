---
type: Reference
title: Verify
description: The @alchemy.run/domain/Verify module (main only), one test call that proves a model's rules with a solver, searches every short sequence of commands for one that breaks the rest, and replays what it found on the real model; this app would use it to prove its item, import and allowance rules.
tags: [alchemy-domain, checking]
---

# Verify

`Verify` checks rules, where a [story](./story.md) checks one example. It reads the TypeScript of a model's
`decide`, `evolve` and rules, proves with the Z3 solver what can be proved for every state and every input, searches
every sequence of a few commands (with events delivered twice and reactions reordered) for one that breaks the
rest, samples longer random sequences, and, given a story runner, replays every sequence it found on the real model
in memory. The docs: "A story checks one example: this history, this command, these events. Verification checks a
rule." [https://alchemy.run/domain/verifying-models (main only; 404 on the live site)]. It is two tools in one call,
[Prove](./prove.md) and [Explore](./explore.md).

## When to reach for it

- Once the rules are written down as [invariants and transitions](./invariants-and-transitions.md),
  [relations](./relation.md), model `invariants` or `eventually`. With no rules it still runs every sequence and
  replays it, but it has nothing to prove.
- One `Verify.aggregate` test per aggregate, written first: the fastest check. One `Verify.model` test per model.
- When a story suite passes but you cannot list every interleaving: double delivery, reordered reactions, a saga
  step run twice, an external system's every answer, a late schedule. Verify tries each.

## How it is declared

```ts
// Run in a trial on 2026-11-19 on main@dbfd0ddb, in this shape; the trial's tests also caught the failure and
// wrote the rendered report to a file (see "How to check it").
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { ImportDraft } from "./ImportDraft.aggregate.ts"
import { Inventory, InventoryApi } from "./Inventory.model.ts"

it.effect("verify: the model", () =>
  Verify.model(Inventory, { apis: [InventoryApi], story: Story.make(Inventory) }).pipe(
    Effect.provide(NodeServices.layer),
  ), 900_000)

it.effect("verify: ImportDraft", () =>
  Verify.aggregate(ImportDraft).pipe(Effect.provide(NodeServices.layer)), 300_000)
```

The model has no policies or external systems, so `Story.make(Inventory)` needs no `layer` and no `stub`. A model
with them passes both, as the bank does: `Story.make(Bank, { layer, stub: [FraudCheck, Payments] })`. Pin the rules
that must stay proved with `require: { proved: ["ImportDraft.OutcomesAddUpToTheRows", ...] }`; the trial did not use
`require`.

Every export of `packages/domain/src/Verify.ts` on `main@dbfd0ddb`:

| Export | Shape | Line |
| --- | --- | --- |
| `model(target, options)` | `Effect<Report, VerifyError \| NotVerified, FileSystem \| Path>`; fails unless `verified` | 444-454 |
| `report(model, options)` | the same run, `Effect<Report, VerifyError, ...>`; never fails on a broken rule | 347-411 |
| `verified(report)` | `true` when no rule is `broken`, every run agreed, and `undone` is empty | 414-417 |
| `aggregate(target, options = {})` | `Effect<AggregateReport, VerifyError \| AggregateNotVerified, ...>` | 574-626 |
| `render(report)` | the text report, for a `Report` or an `AggregateReport` | 632-784 |
| `Options` | `apis`, `source?`, `story?`, `depth?`, `budget?`, `instances?`, `faults?`, `walks?`, `allow?`, `require?` | 35-81 |
| `AggregateOptions` | `source?`, `depth?`, `budget?`, `allow?` (`truncated` only), `require?` | 456-479 |
| `Require` | `{ proved?: ReadonlyArray<string> }` | 84-87 |
| `Rule` | `{ name, kind, standing, seen, story, unproved? }` | 115-133 |
| `Run` | `{ of, story, failure }`, one sequence replayed on the real model | 136-142 |
| `Report` | `{ model, rules, explored, runs, walked, unrun, undone, assumptions }` | 144-158 |
| `AggregateReport`, `Unproved` | `{ aggregate, rules, proof, explored, undone }`; `{ command, verdict }` | 482-504 |
| `VerifyError` | tag `VerifyError`: a file did not load, or the solver is missing | 106 |
| `NotVerified` | tag `NotVerified`, `{ message, report }`; `message` is the rendered report | 109-112 |
| `AggregateNotVerified` | also tag `NotVerified` (same tag string), with an `AggregateReport` | 507-510 |

`Verify.model` options, with the defaults the source applies:

- `apis` (required): the [Apis](./api.md) whose commands make up a sequence (`Verify.ts:37`).
- `source`: the model's file. Left out, it is found from the calling test: the call stack is read when `model` or
  `report` is called, and the files the test imports (relative imports, followed transitively, at most 400 files)
  are read as text, never loaded, until one matches `Model("<name>"` (`Verify.ts:162-214`, `:352`). Pass `source`
  when the test does not import the model's file, directly or not.
- `story`: a runner from `Story.make(Model, { layer, stub })`. Every external system the model calls must be in
  `stub` so the replay gives it the answers the solver picked (`Verify.ts:44-50`).
- `depth` 2: the most commands callers send; what policies, sagas and schedules send in reaction does not count
  (`Verify.ts:51-55`; `Explore.ts:240`).
- `budget` 100,000 sequences, `instances` 2 per aggregate (`Verify.ts:56-65`; `Explore.ts:248-249`).
- `faults`: `{ redeliver, reorder, rerun }`, each `true` unless set `false` (`Explore.ts:83-105`, `:250-254`).
- `walks`: `{ count, length?, seed? }`; Verify runs 200 unless told (`Verify.ts:362`), each up to 12 commands, seed 1
  (`Explore.ts:255-259`). `{ count: 0 }` runs none.
- `allow`: `{ truncated?: boolean, skipped?: ReadonlyArray<string> }`, what a pass may leave undone
  (`Explore.ts:125-130`).
- `require`: `{ proved: [...] }`, names as the report prints them. A named rule that is only checked, not looked at,
  or missing fails the run (`Verify.ts:90-103`).

`Verify.aggregate` runs `Prove.report` then `Explore.report` on one aggregate: `depth` 3, no walks, no faults, no
story runner (`Verify.ts:574-626`; `Explore.ts:284`). Its rule names are bare (`NeverOverdrawn`), so `require`
names them bare too (`Verify.ts:596`).

Checked in: not at `v2.0.0-beta.87`. Read at `main@dbfd0ddb`: `packages/domain/src/Verify.ts:1-784`, and the public
parts of `packages/domain/src/Explore.ts:37-445` and `packages/domain/src/Prove.ts:29-180`, `:280-352`, `:470-594`.

### What main changes

All new on main:

- Pull request 3260 (merge commit `e4adb720c`, 2026-11-19) adds `Verify.ts` (784 lines), `Prove.ts` (594),
  `Explore.ts` (788) and their internals, the dependencies `z3-solver` 5.3.3 and `oxc-parser` 0.141.0
  (`packages/domain/package.json:75-78`, `pnpm-workspace.yaml:211`, `:260`), and blocks the internals as subpaths
  (`package.json:59-60`).
- Pull request 3503 (commit `d123c318d`) makes the prover read `effect/Match` (`value`, `type`, `when`, `tag`,
  `tags`, `orElse`, `exhaustive` and more); before it a `Match` call was code it could not read.
- Pull request 3504 (commit `852675fdd`) adds the docs page `verifiable-code.mdx` (what the prover reads) and
  verifies the tutorial's bank; it does not change `Verify.ts`.

## Rules, and the mistakes to avoid

**The report, in the library's terms** (`Verify.ts:632-784`; `website/src/content/docs/domain/verifying-models.mdx:229-286`):

- **Proved**: "for every state and every input, after any number of commands". The solver read `decide`, `evolve`
  and the rule and found no state the rules allow and no input that breaks it. Only these can be proved: an
  aggregate's invariants and transitions, a decision's transitions, and relations.
- **Checked**: "in every sequence of up to N commands through <Apis>, with each event delivered twice, each
  reaction also run behind the others that wait, each step of a saga run twice, every answer <system> can give",
  with the count of sequences and states. No sequence run breaks the rule. Model `invariants` and `eventually` are
  never better than this (`Verify.ts:246-266`); `eventually` is looked at only at the end of sequences that ran their
  course.
- **Sampled**: "N longer sequences, of up to 12 commands picked at random (seed S)". This is not a standing of its
  own: it adds the walks to the search, and the line reads "none breaks a rule" when none did. A rule a walk breaks
  is reported broken, with the walk (not the shortest sequence).
- Then, when present: **Run on the real model** (each found sequence and walk replayed as a story; those that need
  a redelivery, a step run twice or a late schedule cannot be a story and are counted, not run), **Not done**,
  **Called again when an event is delivered again** (external calls that must be safe to repeat), **Schema checks
  not proved kept**, **Left out, and no rule depends on it** (views, projections, streams and queries the
  sequences ran without), **Not looked at: no sequence reached it**, and **Assumed**.

A rule's `standing` is one of `proved`, `checked`, `broken`, `unseen` (`Verify.ts:123`). A pass needs no `broken`,
no failed replay, and nothing in `undone`; an `unseen` rule puts a line in `undone`, so it fails
(`packages/domain/src/Explore.ts:421-441`).

**How a broken rule comes back.** `Verify.model` fails with `NotVerified`; its `message` is the rendered report and
`report.rules[i].story` holds the sequence. The text shows the shortest sequence step by step (commands, what each
policy asked an external system and was answered, what it sent, marked when it handled its event again), then
either "As a story, to keep as a test:" with `Story.when`, `Story.call`, `Story.succeed`, `Story.then` lines to
paste, or, when the sequence needs a platform fault, a sentence saying a story cannot run it (`Verify.ts:705-728`;
`test/Verify.test.ts:47-80`). From `Prove` (inside `Verify.aggregate` or `Prove.decision`) a violated rule shows
`state`, `command`, any request context, `now`, `events` and `after` (`packages/domain/src/Prove.ts:319-341`).

What the trial on 2026-11-19 printed, on a model of this app:

- `Verify.model` passing: the heading "Proved: for every state and every input, after any number of commands" over
  19 rules; "Checked: in every sequence of up to 2 commands through InventoryApi, with each event delivered twice,
  each reaction also run behind the others that wait", 5,173 sequences and 2,433 states, over the model invariant
  `Inventory.EveryConfirmedFileAddsUp`; "Sampled: 200 longer sequences, of up to 12 commands picked at random (seed
  1)"; 42 sequences the explorer found and 200 walks run on the real model as stories. The model has no saga and no
  external system, so the checked line names only the two delivery faults (`Verify.ts:657-666`).
- The "Assumed" list included "whole numbers are exact" within 2^53, "middleware lets every caller in: who sends a
  command is anyone its request context allows", and "what a projection writes, and what a stream or a query gives,
  is not checked: only what a projection is given" (`Verify.ts:222-228`).
- `Verify.aggregate` on a deliberately broken copy (the `evolve` of `RowLeftOut` forgot to lower `ready`) failed
  with `NotVerified`. The report named the rule (`OutcomesAddUpToTheRows`), the command (`LeaveRowOut`), the state
  before (`{ _tag: "Open", rows: 1, ready: 1, waiting: 0, left: 0 }`, among other fields), the events (`RowLeftOut`),
  the state after (`left: 1`), and the shortest sequence that reaches it: `StageImport { rows: 1, ready: 1 }`, then
  `LeaveRowOut`.

**What makes a rule fall from proved to checked** (the report says why under the rule):

- the proof fails from a state no sequence reaches ("not proved: X breaks it from ..., a state the rules allow");
  write the invariant or relation that rules that state out (`test/Verify.test.ts:129-157`);
- a loop over a list from the state or a command: tried with up to 2 items more than its schema asks for, verdict
  `Bounded` ("proved for short lists only") (`Prove.ts:345`; `Prove/internal/Induction.ts:63-71`;
  `Prove/internal/Symbolic.ts:230`);
- code the prover does not read (`NotTranslated`): string methods, regular expressions, `try`, `async`, arithmetic on
  numbers that may not be whole, a key that comes from an input (`verifiable-code.mdx`);
- the solver gave up within its fixed work limit (`Unknown`), or a counterexample needs a value an unread schema
  check refuses (`Unconfirmed`);
- some command or decision leaves the aggregate's state outside its schema, or a decision that records on it does
  not fit, so no proof of that aggregate counts (`Explore/internal/ModelSearch.ts:1097-1112`);
- for a relation, any aggregate it touches has an invariant that is not proved (`ModelSearch.ts:1155-1182`).

A drop is silent unless the rule is in `require.proved`. Pin the rules that must stay proved.

**Other rules:**

- Call `Verify.model` / `Verify.aggregate` from the test file itself, so the call stack names the test (`Verify.ts:351-352`),
  or pass `source`.
- One aggregate name per test file. The file is found by the text `Model("<name>"` or `Aggregate("<name>"` among the
  test's relative imports (`Verify.ts:182-214`). In the trial, two aggregates with the same name imported into one
  test file made the prover read one file for both, and the run failed with "the real code disagrees with what the
  explorer read".
- Write the domain blocks the way the prover reads them ([prove](./prove.md)): events and rejections built with `new`
  in `decide` (an event built with `.make` was "not read" in the trial), and commands, events, rejections and rule
  helpers imported by relative paths (imported by package name, they were "not read"). The app's lint rule
  `newSchemaClass` needs an exception for domain block files: a first line
  `// @effect-diagnostics newSchemaClass:off`, which the trial ran on beta.87 with a clean type-check.
- Never widen `allow` to get a pass: each entry is something no longer verified (skill reference
  `packages/domain/skills/alchemy-domain/references/testing.md:231`).
- An aggregate a decision records on cannot be verified alone; verify the model (`test/Decision.test.ts:204-216`).
- Middleware is not run: a rule is checked against every actor the request context's schema allows.
- Not checked at all: what a projection writes, what a stream or query returns, and how a platform commits a
  decision (assumed atomic) (`Verify.ts:222-228`, `:407`; `Prove.ts:160-161`).
- Do not confuse with `Domain.verify(Model)`, which checks the declaration only (`model.mdx:332`).

## In this app

A trial on 2026-11-19 verified a model of this app on `main@dbfd0ddb` (its source is the appendix of
[the trial](../04-trial.md); each app rule's standing is on
[this app's rules under Verify](../03-this-apps-rules-under-verify.md)). The app's own code does not have it yet
(nothing in the app imports `@alchemy.run/domain`); the model was written beside the upstream example, in main's
shapes (commands without `target`, aggregates with `keyOf`):

- `ImportDraft` (state `Unstaged | Open | Imported | TakenBack`, counts of rows, the organization in the state;
  commands `StageImport`, `SettleRow`, `LeaveRowOut`, `RecordSuggestion`, `ConfirmImport`, `TakeBackImport`, each
  with `middleware: [Session]` and an `Effect.fn` decide that reads `CurrentActor`);
- `Item`, keyed by organization and SKU key; `Allowance` (40 calls a day); `Organization` (counts of admins and
  others);
- a model invariant `EveryConfirmedFileAddsUp` over every `ImportDraft` instance, and one Api, `InventoryApi`.

`Verify.aggregate` answered in under two seconds for each aggregate and proved every rule. `Verify.model(Inventory,
{ apis: [InventoryApi], story })` answered in about 36 seconds: the same 19 rules proved, the model invariant checked
in every sequence of up to 2 commands, 200 longer sequences sampled, and every sequence found replayed on the real
model as a story. The names of the 19 rules, and the app rule each holds, are in [prove](./prove.md). The pure
`review` function is not part of it: it uses string methods and `HashMap`
(`packages/catalog/model/src/Review/Review.rules.ts`), which the prover does not read, so it stays under property
tests, and its results reach the model as command fields.

Not held by Verify, so kept in the app's slow tests on a real D1: the SQL rows themselves (the unique
`(organizationId, skuKey)` key, the tenancy keys), the search index, and what a projection writes.

- **Used today:** no. The rules are held by guarded D1 batches and tested by `*.slow.test.ts` on a local D1
  (`packages/catalog/host`, `apps/inventory/test`).
- **Where it goes:** `packages/catalog/model/test/Catalog.verify.test.ts` (and one per aggregate) beside the story
  tests, under Vitest on Node.
- **What the person gets:** nothing they can see; a stale edit, a double confirm or a second take-back is proved
  never to write.

## How to check it

`Verify.model(...)` in an `it.effect` with `Effect.provide(NodeServices.layer)` is itself the check. To read the
report without failing, `const report = yield* Verify.report(Inventory, options)` and assert on
`report.rules.map((rule) => [rule.name, rule.standing])`, as
`examples/cloudflare-domain/packages/domain/test/Bank.verify.test.ts:46-66` does.

To read the text, render it with `Verify.render(report)`. Under `it.effect` the console is Effect's test console
(`@effect/vitest` 4.1.4, the version the app installs, `src/internal/internal.ts:68`, `:490`), so a report printed with
Effect's `Console` does not appear in Vitest's output. The trial caught the failure and wrote the rendered report to a
file; asserting on `report.rules` needs neither.

## What it needs

- `main@dbfd0ddb` (unpublished). The published `2.0.0-beta.87` has no `Verify`, `Prove` or `Explore`.
- Node, not Bun: the solver is Z3 compiled to WebAssembly, loaded with a dynamic `import("z3-solver")`, and its
  start-up error says it "runs under Node, not Bun" (`packages/domain/src/Prove/internal/Smt.ts:212-222`); the
  skill says to run these tests under Vitest on Node (`references/testing.md:203`). The parser is `oxc-parser`
  (`Prove/internal/Source.ts:109-116`). Both are loaded only when a verification runs, so a deployed model never
  loads them (`Verify.ts:17-18`). The trial ran under Node 24.22.1, Vitest 5.0.4, `effect` 4.1.4 and `z3-solver`
  5.3.3.
- `FileSystem` and `Path` services: `NodeServices.layer` from `@effect/platform-node`.
- Time: in the trial, under two seconds per aggregate and about 36 seconds for the whole model with its defaults. The
  docs measure the bank's default run at 19,641 sequences, 200 walks and 144 stories in about 45 seconds, and depth 3
  with no faults at 40,158 sequences in 75 seconds (`verifying-models.mdx:454`); the example's tests set timeouts of
  60 to 300 seconds.
- Results repeat: Z3 runs with fixed seeds and a fixed work limit (`rlimit` 40,000,000), with a 60-second timeout per
  question for one that hangs (`Smt.ts:202`, `226-232`).
- Host: none. It runs in a test, against the model in memory when a story runner is given.

## Verdict

**Use, from main:** one `Verify.aggregate` test per aggregate and one `Verify.model` test per model, with
`require.proved` naming every rule that must stay proved, under Vitest on Node. It runs on this app's rules today: a
trial on `main@dbfd0ddb` proved 19 of them and checked the model invariant. Taking it needs the library from main
(not on npm), the domain blocks written as the prover reads them (`new` in `decide`, relative imports, an exception
to `newSchemaClass`), and the slow D1 tests kept for what SQL decides.

## Where this was read

- https://alchemy.run/domain/verifying-models and https://alchemy.run/domain/verifiable-code (both 404 on the live
  site, which documents beta.87; read from the repository)
- `website/src/content/docs/domain/verifying-models.mdx`, `verifiable-code.mdx`: not at `v2.0.0-beta.87`; on
  `main@dbfd0ddb` new
- `packages/domain/src/Verify.ts`, `Prove.ts`, `Explore.ts`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new
- `packages/domain/package.json` at `v2.0.0-beta.87`; on `main@dbfd0ddb` changed
- `examples/cloudflare-domain/packages/domain/test/{Bank.verify,Verify,Relation,Decision,Consumer}.test.ts`: on
  `main@dbfd0ddb` new
- `@effect/vitest` 4.1.4 (the app's installed copy): `src/internal/internal.ts` (the test console under `it.effect`)
- A trial on 2026-11-19: a model of this app run with `Verify.aggregate` and `Verify.model` on `main@dbfd0ddb`
