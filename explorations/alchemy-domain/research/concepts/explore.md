---
type: Reference
title: Explore
description: The bounded search under Verify, which runs every sequence of commands up to a depth on the real code with values a solver picks, under redelivery, reordering and saga reruns, then random walks; this app would use it to check the rules that span many items, imports and members.
tags: [alchemy-domain, checking]
---

# Explore

`Explore` searches instead of proving. It runs every sequence of commands, up to a depth, on a new aggregate instance
or on a whole model with nothing in it, and after each command lets the policies, sagas and views react. It does not
pick values from a list: it reads `decide`, `evolve`, the policies and the rules with the same interpreter as
[prove](./prove.md), keeps each command's fields unknown along the whole sequence, and asks the Z3 solver for values
that take the sequence down each path or break a rule. Each story it reports was then run on the real code. The docs
put the difference from proving this way: Checked "means no sequence that was run breaks the rule"
[website/src/content/docs/domain/verifying-models.mdx on main@dbfd0ddb; not on the live site].

## When to reach for it

- A rule over every instance of a model, which cannot be proved: a model `invariant` (looked at whenever nothing is
  left to react) or `eventually` (looked at when a sequence has run its course). See
  [invariants-and-transitions](./invariants-and-transitions.md) and [relation](./relation.md).
- To find the shortest sequence that breaks a rule, with the values that break it, written as a [story](./story.md).
- To see which events, rejections, saga endings and states a model can reach at all in a few commands.
- To check what [policies](./policy.md) and [sagas](./saga.md) do when an event is delivered twice, when reactions
  run in another order, or when a saga's step runs again.
- Usually through [verify](./verify.md), which runs `Explore` after `Prove` and labels each rule Checked or Sampled.

## How it is declared

Nothing is declared. `Explore` is imported from `@alchemy.run/domain/Explore` and takes either one aggregate or a
model with the [Apis](./api.md) whose commands make up a sequence.

```ts
// SKETCH: not compiled
import * as Explore from "@alchemy.run/domain/Explore"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { ImportDraft } from "../src/Import/ImportDraft.aggregate.ts"

it.effect("no three commands break an import", () =>
  Explore.check(ImportDraft, {
    source: new URL("../src/Import/ImportDraft.aggregate.ts", import.meta.url),
    depth: 3
  }).pipe(Effect.provide(NodeServices.layer)), 60_000)
```

Exports of `packages/domain/src/Explore.ts` on main:

| Export | Shape | Line |
| --- | --- | --- |
| `Options` | for one aggregate: `{ source, depth?, budget?, allow?: { truncated? } }` | 37-55 |
| `ModelOptions` | for a model: `{ source, apis, depth?, budget?, instances?, faults?, walks?, allow?: { truncated?, skipped? } }` | 57-131 |
| `report(aggregate, Options)`, `report(model, ModelOptions)` | `Effect<Report \| ModelReport, ExploreError, FileSystem \| Path>` | 179-208 |
| `check(...)` | `report`, then fails with `InvariantBroken` or `Incomplete` | 315-371 |
| `undone(report, allow)` | the reasons a pass would say less than it seems | 374-445 |
| `render(report)` | the report as text | 720-788 |
| `describe(story, indent?)` | one model story as text | 702-703 |
| `script(story)` | one model story as the code of a `Story` test | 717 |
| `ExploreError` | a file did not load, the model's file does not import what it lists, an invariant is written outside its definition, or the solver is missing | 134, 232-239 |
| `InvariantBroken` | `{ message, report }` | 137-140 |
| `Incomplete` | `{ message, reasons, report }` | 146-150 |
| `Report`, `ModelReport` | `Found` plus `aggregate` or `model`, `apis`, and `depth` | 152-161 |
| types `Move`, `Outcome`, `Story`, `Asked`, `Ending`, `Skipped`, `Step` | from `Explore/internal/{Search,ModelSearch}.ts` | 34-35 |

Every option with its default:

| Option | Applies to | Default | Where the default is set |
| --- | --- | --- | --- |
| `source` | both | required: the file that declares the aggregate or model | |
| `depth` | aggregate | 3 commands | `Explore.ts:284` |
| `depth` | model | 2 commands sent by callers; what policies, sagas and schedules send does not count | `Explore.ts:240` |
| `budget` | both | 100,000 sequences | `Explore.ts:248`, `287` |
| `apis` | model | required | |
| `instances` | model | 2 instances of one aggregate addressed by callers in a sequence | `Explore.ts:249` |
| `faults.redeliver` | model | `true` | `Explore.ts:251` |
| `faults.reorder` | model | `true` | `Explore.ts:252` |
| `faults.rerun` | model | `true` | `Explore.ts:253` |
| `walks.count` | model | 0 in `Explore` (`Verify.model` passes 200, `Verify.ts:362`) | `Explore.ts:256` |
| `walks.length` | model | 12 commands | `Explore.ts:257` |
| `walks.seed` | model | 1 | `Explore.ts:258` |
| `allow.truncated` | both | not allowed: stopping at the budget fails `check` | `Explore.ts:397-400` |
| `allow.skipped` | model | none: a policy or saga left out fails `check` | `Explore.ts:405-412` |

Fixed limits inside the search: at most 96 reactions followed after one caller's command, after which the sequence
counts as unsettled (`ModelSearch.ts:629`, `2595-2598`); at most 8 schedules run one after another to bring a
sequence to its end (`ModelSearch.ts:626`, `3573-3576`); a walk tries at most four times its length in moves
(`ModelSearch.ts:3669-3681`). The solver and interpreter limits are those of [prove](./prove.md): 4,096 paths per
command in the proofs it runs first, input lists of up to 2 items past the minimum, the same Z3 work limit.

**The defaults as a trial printed them.** A trial on 2026-11-19 ran `Verify.model(Inventory, { apis:
[InventoryApi], story })` on a model of this app at `main@dbfd0ddb`, with no option changed. Each number in its report
is a default above:

| Printed | Default it comes from |
| --- | --- |
| "in every sequence of up to 2 commands through InventoryApi" | model `depth` 2 (`Explore.ts:240`) |
| "with each event delivered twice, each reaction also run behind the others that wait" | `faults.redeliver` and `faults.reorder` on (`Explore.ts:251-252`); `rerun` is on too, but its words are printed only for a model with a saga (`Verify.ts:660-662`) |
| "5,173 sequences, 2,433 states" | every sequence was run: far under the `budget` of 100,000 (`Explore.ts:248`), so not truncated |
| "Sampled: 200 longer sequences, of up to 12 commands picked at random (seed 1)" | `Verify.model`'s 200 walks (`Verify.ts:362`), `walks.length` 12 and `walks.seed` 1 (`Explore.ts:257-258`) |
| "42 sequences the explorer found and 200 walks of commands picked at random, as stories" | every found sequence and every walk replayed with the `story` runner, each distinct sequence once (`Verify.ts:370-392`) |

`instances` (2 per aggregate) is not printed. On a deliberately broken copy, `Verify.aggregate` ran the aggregate
search at its own default depth of 3 (`Explore.ts:284`) and gave the shortest breaking sequence, two commands long.

Checked in: none of it exists at `v2.0.0-beta.87`.

**Internal modules.** Every file under `packages/domain/src/Explore/internal/` is internal: `package.json:59` maps
`./Explore/internal/*` to `null`, so none can be imported from the package. `Explore.ts` re-exports the types `Move`,
`Outcome`, `Story`, `Asked`, `Ending`, `Skipped` and `Step` (`Explore.ts:34-35`).

| File | What it does (internal) | Exported names |
| --- | --- | --- |
| `Search.ts` | The search on one aggregate: every sequence up to `depth` on a new instance, the shortest story per outcome and per broken rule, replayed with `Aggregate.predict` | `Move`, `Story`, `Outcome`, `Found`, `tagOf` (the `_tag` of an interpreter value), `lift` (a real value, such as the initial state, as an interpreter value), `stateTags`, `Options`, `search` |
| `ModelSearch.ts` | The search on a model: moves through the Apis, policies, sagas, views, projections, external systems, faults, walks and the replay | `Step`, `Asked`, `Story`, `Outcome`, `Ending`, `Skipped`, `Aside`, `Found`, `Options`, `ModelLike` (the parts of a model the explorer reads), `whole`, `locate`, `Located` (what `locate` finds: the model's parts in its source), `search` |
| `Script.ts` | A found story as data, as text, and as the steps of a `Story` test | `Op`, `ops`, `redelivers`, `script` |

### What main changes

Everything is new on main: `packages/domain/src/Explore.ts` and `packages/domain/src/Explore/internal/{ModelSearch,
Script,Search}.ts` arrived with pull request 3260 (commit `e4adb720c`, merged 2026-11-19). The package hides
`./Explore/internal/*` from its published exports (`packages/domain/package.json:59`), and depends on `oxc-parser` and
`z3-solver`, as [prove](./prove.md) says.

## What "checked" means here

### The shape of the search

For one aggregate (`Explore/internal/Search.ts:159-572`):

1. Before searching, the explorer runs the induction proofs of [prove](./prove.md) (`Search.ts:211-224`). An invariant
   a command is proved to keep is not asked about after that command, and an invariant every command keeps is
   reported `proved`. The proofs count only when the initial state is in the schema and every command keeps the
   state in its schema.
2. The search is breadth first: every sequence of length 1, then of length 2, up to `depth` (`Search.ts:535-547`).
   Each sequence is one path: for each command, every path through its code is a separate sequence, and the run at
   the end of a sequence is forked for the next command, so a command is read once however many sequences go on from
   it (`Search.ts:468-533`, `Value.ts:241-254`).
3. Every command of the sequence goes to the instance the first command named (`Search.ts:491`). Time never runs
   backwards: each command's `now` is at least the one before (`Search.ts:480-482`).
4. After each command the explorer asks Z3 whether the sequence can happen at all; a sequence that cannot is not
   extended (`Search.ts:385-404`). It asks again for values that make an outcome happen (an event recorded, a
   rejection, a state reached) when no shorter story for it exists yet, and for values that break any invariant or
   transition not yet broken by a shorter story (`Search.ts:406-446`).
5. Every set of values Z3 finds is replayed on the real code: the real commands are built and run through
   `Aggregate.predict` one after another (`Search.ts:233-318`). If the real code rejects where the interpreter
   recorded events, or the reverse, the sequence goes to `disagreements` instead of being reported.

For a model (`Explore/internal/ModelSearch.ts:1060-3786`) the same, with more parts:

- **Moves.** A move is a command a caller can send through the Apis (to each existing instance of its aggregate, or
  to a fresh one while fewer than `instances` exist), a decision a caller can send, or a scheduled command that comes
  due (`ModelSearch.ts:3600-3631`). Breadth first again (`3641-3651`).
- **Reactions.** After each move, every policy subscribed to an event runs on a queue until nothing is left to react
  (`drain`, `2591-2686`). Views and projections a rule reads, or a policy reacts to, are folded along the way; the
  others are put aside and listed under "Left out" (`1004-1038`). A policy's handler is found from its
  `Policy.toLayer(...)` call in a file the model's file imports (`754-777`).
- **External systems.** A call to an external system's operation is an input: Z3 picks any answer its `success`
  schema allows, and each declared `error` is a path of its own (`1607-1647`). A call made again on a second delivery
  is listed in `repeated`.
- **Rules.** Each aggregate's invariants and transitions are checked after each step that changed an instance; the
  model's `invariants` and unproved relations when nothing is left to react; `eventually` when nothing is left to
  react and nothing is scheduled. When a move leaves schedules behind, they are run one after another until none is
  left, so `eventually` can be looked at (`3559-3595`).
- **Proofs first.** Decisions, aggregate rules and relations are proved before the search (`1082-1182`). A rule
  proved for every command and decision that can change it is reported `proved` and not searched.
- **Replay.** Every story is replayed on the real aggregates, decisions, views and rules (`replay`, `2689-3108`),
  including checking that each real view emits what the interpreter read (`3057-3064`).

### What it cannot follow

| Construct | What happens |
| --- | --- |
| Code the interpreter cannot read in `decide`, `evolve` or a rule | Those sequences are not run. The line is in `unread`, and `check` fails `Incomplete` (`ModelSearch.ts:3436-3447`, `Explore.ts:379-384`) |
| Unreadable code in a policy's or saga's own handler | The policy or saga is left out and the whole search starts again without it (`ModelSearch.ts:3767-3785`); it is in `skipped`, and `check` fails unless `allow.skipped` names it |
| A policy reading an instance's state (`yield* orders.get(source)`) | Not followed: "reads the state of X, which the explorer does not follow yet" (`2195-2198`; fixture `Outlet`) |
| A saga's `status`, `result` or `interrupt` | Not followed (`2261-2272`) |
| Streams and queries | Put aside: "what a stream gives is not checked", "what a query answers is not checked" (`1025-1038`) |
| What a projection writes | Not checked; only what it is given |
| A schedule whose delay is not a literal number or duration string | Not followed (`2108-2128`) |
| An event an aggregate folds that only a decision records (aggregate search) | Listed in `outside`; `check` fails: explore the model that hosts both (`Explore.ts:401-404`) |

### Faults injected

All three are on by default for a model; none applies to a single aggregate.

| Fault | What is tried | When | Where |
| --- | --- | --- | --- |
| `redeliver` | The same event is delivered to the same policy a second time, after the other waiting reactions | Only when the first delivery called an external system or had a command refused; otherwise the second delivery sends the same commands under the same ids and changes nothing | `ModelSearch.ts:2673-2682` |
| `reorder` | One waiting reaction is moved behind the others | At most one per sequence, and only when it could write an aggregate another waiting reaction writes | `2605-2629` |
| `rerun` | A saga's step (an `Activity`) runs again, as when the saga stops after the step and before its result is kept | At most once per sequence, and only when the step called an external system or had a command refused | `2395-2411` |

Commands a policy or saga sends get ids from the delivery or the step, so an instance that took one gives the same
answer again and does nothing more (`send`, `2057-2088`). Scheduled commands can also run late: a step is flagged
`late` when a schedule was due before it ran (`2906-2911`), and timers come due as separate moves in any order.

### Picking commands and inputs

Nobody lists values. A command's fields, an external system's answers, request contexts, ids of new instances and
the time of each step are all inputs (`Paths.ts:198-214`, `ModelSearch.ts:3609-3622`). The solver picks one set of
values for the whole sequence at once, so a later command can need something an earlier one recorded. When it finds
values, it asks again for a nicer set where the sequence allows it: no time passing between commands, no empty
strings, and each schedule running as soon as it is due (`ModelSearch.ts:3115-3153`; for one aggregate, only the time
wish, `Search.ts:325-344`). A time in a story therefore means the story needs it.

### How a failure becomes the shortest story

There is no separate shrinking pass. Shortness comes from the order of the search: every sequence of length n is
run before any of length n+1, so the first story found for a rule or an outcome is one of the shortest, and a story
is only replaced by a strictly shorter one (`Search.ts:230`, `ModelSearch.ts:1283-1288`). For a model, "shorter"
counts the moves a caller makes (commands sent and schedules come due), not the reactions. A story is cut at the step
where what it shows happened (`cut`, `ModelSearch.ts:584-600`); `whole` gives the rest of the sequence back for
`script`. Stories found by walks are not shortest.

`render` writes each story one command a line, with `↳` for what a policy or saga sent and what an external system
answered (`Explore.ts:500-527`). `script(story)` writes it as the code of a `Story` test (`Script.ts:150-174`); a story
that needs an event delivered twice, a step run twice or a late schedule cannot be a `Story`, and the script carries
a comment saying so (`Script.ts:76-89`, `119-120`).

### Sampled: the walks

Walks reach past `depth`. After the full search, `walks.count` walks of up to `walks.length` moves are run, each move
and each choice inside it (which branch, which union member, how many list items) picked by a seeded pseudo-random
generator (`mulberry`, `ModelSearch.ts:615-623`, `3653-3693`). Values are still solved, not sampled: at the end of
each walk Z3 picks values for everything left open and the walk is replayed on the real code (`3682-3689`). The same
seed gives the same walks on every machine (`Walks.test.ts:39-50`). `Verify` labels what walks find as "Sampled".
`Explore`'s own default is no walks; `Verify.model` runs 200.

### What the report holds

`Found` (`Search.ts:51-92`; model version `ModelSearch.ts:118-241`): `sequences`, `states`, `truncated`, `complete`
(the longest length for which every sequence ran), `invariants` (each with `broken` story, `proved`, and how many
states it was looked at in), and for models `rules`, `eventually`, `decisions`, `followed`, `idle`, `views`,
`projections`, `systems`, `faults`, `walks` (with each walk's story), `repeated`, `sagas`, `unstarted`, `endings`,
`skipped`, `aside`, `unkept`, `failures` (a policy whose handler fails with a rejection it does not handle),
`unsettled`, `unread`, `disagreements`, `undecided` (Z3 gave up), `dead` (commands no state accepts), `outcomes` and
`reached`, each with its shortest story.

### When `check` fails

`check` fails with `InvariantBroken` when any invariant, model rule or `eventually` rule has a broken story
(`Explore.ts:351-356`). Otherwise it fails with `Incomplete` when `undone` finds any of: code not read, a
disagreement between the real code and the interpreter, a question Z3 gave up on, a command never accepted, a search
stopped at its budget (unless allowed), an `outside` event, a policy or saga left out (unless allowed), unsettled
sequences, no state reached at all, or an invariant or model rule that no sequence looked at (`Explore.ts:374-445`).

## Rules, and the mistakes to avoid

- A green `check` says "no sequence of up to `depth` caller commands breaks it". A rule that needs more commands
  is out of reach without walks (fixture `Ladder` needs five).
- Every fault multiplies the sequences. The docs report the example bank at two commands with all faults as about
  45 seconds, and three commands with all faults as more than a test should wait for. Go deeper with faults off, or
  rely on walks.
- A policy that reads an instance's state is left out. Pass what it needs on the event instead.
- Ids from outside (an external system's number) break idempotency under redelivery; derive the target id from the
  event (fixtures `Ticket`, `Booking`).
- The model's file must import, by relative paths, every file that declares what it lists; otherwise `ExploreError`
  "does not import the file that declares ..." (`Explore.ts:232-235`).
- Every limit of the interpreter in [prove](./prove.md) applies: unread code is not sampled instead, it is skipped
  and makes the check fail.

## In this app

The import's lifecycle is the natural search: rule 10 ("a confirm of an import that is no longer open writes nothing;
a second press of take-back writes nothing") and rule 1 ("outcomes add up to the rows") on one import, with the
review's counts handed in as command fields because `review` itself is not readable:

```ts
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

const Outcomes = { rows: Count, created: Count, notImported: Count }

export class ImportConfirmed extends Domain.Event("ImportConfirmed", Outcomes) {}
export class ImportTakenBack extends Domain.Event("ImportTakenBack", {}) {}
export class NotOpen extends Domain.Rejection("NotOpen", {}) {}
export class NotImported extends Domain.Rejection("NotImported", {}) {}
export class CountsDisagree extends Domain.Rejection("CountsDisagree", {}) {}

export class ConfirmImport extends Domain.Command("ConfirmImport", {
  input: { importId: S.String, rows: Count, created: Count, notImported: Count },
  events: [ImportConfirmed],
  rejects: [NotOpen, CountsDisagree]
}) {}
export class TakeBackImport extends Domain.Command("TakeBackImport", {
  input: { importId: S.String },
  events: [ImportTakenBack],
  rejects: [NotImported]
}) {}

export class ImportDraft extends Domain.Aggregate("ImportDraft", {
  id: S.String,
  state: S.Union([
    S.TaggedStruct("Open", {}),
    S.TaggedStruct("Imported", Outcomes),
    S.TaggedStruct("TakenBack", {})
  ]),
  initial: { _tag: "Open" },
  invariants: {
    OutcomesAddUp: (draft) => draft._tag !== "Imported" || draft.created + draft.notImported === draft.rows
  },
  transitions: {
    ATakenBackImportStaysTakenBack: ({ before, after }) => before._tag !== "TakenBack" || after._tag === "TakenBack"
  },
  commands: [ConfirmImport, TakeBackImport],
  keyOf: (command) => command.importId,
  decide: {
    ConfirmImport: (draft, command) =>
      draft._tag !== "Open"
        ? new NotOpen({})
        : command.created + command.notImported !== command.rows
          ? new CountsDisagree({})
          : [new ImportConfirmed({ rows: command.rows, created: command.created, notImported: command.notImported })],
    TakeBackImport: (draft) => (draft._tag === "Imported" ? [new ImportTakenBack({})] : new NotImported({}))
  },
  evolve: {
    ImportConfirmed: (_, event) => ({
      _tag: "Imported" as const,
      rows: event.rows,
      created: event.created,
      notImported: event.notImported
    }),
    ImportTakenBack: () => ({ _tag: "TakenBack" as const })
  }
}) {}
```

`Explore.check(ImportDraft, { source, depth: 3 })` would run every sequence of up to three commands on one import. Its
outcomes would include `ConfirmImport ✗ NotOpen` (a second confirm, two commands), `ConfirmImport ✗ CountsDisagree`
and `TakeBackImport ✗ NotImported` (one command each), each with values Z3 picked; a second take-back is in the
three-command sequences and is rejected the same way. This sketch was not run. The two rules here are also provable,
so `Explore` reports them `proved` and searches only what is left.

What was run (source in the appendix of [the trial](../04-trial.md)): a trial on 2026-11-19 explored a fuller
model of this app on `main@dbfd0ddb` (the `ImportDraft`,
`Item`, `Allowance` and `Organization` aggregates in [prove](./prove.md), and the model invariant
`EveryConfirmedFileAddsUp` over every `ImportDraft` instance), through `Verify.model` with its defaults. The search
checked the model invariant "in every sequence of up to 2 commands through InventoryApi, with each event delivered
twice, each reaction also run behind the others that wait" (5,173 sequences, 2,433 states), sampled 200 longer
sequences (seed 1) with none breaking a rule, and replayed 42 found sequences and the 200 walks on the real model as
stories, all agreeing. On a broken copy, the aggregate search found the shortest sequence that breaks
`OutcomesAddUpToTheRows`: `StageImport { rows: 1, ready: 1 }`, then `LeaveRowOut`.

The model level is where the explorer adds most in this app, because no proof exists there: a model invariant such
as `EveryConfirmedFileAddsUp`, or "every item belongs to one organization" across items and imports, run through the
app's Apis with two instances each.

Against the app's rule files: `LastAdmin.rules.ts` (`keepsAnAdmin`) is readable, so a `decide` that calls it would be
explored; `Allowance.rules.ts` (`DateTime.subtract`), `Confirm.rules.ts` (`A.join`, `R.get` with an input key,
package helpers), `ItemEdit.rules.ts` (`Str.trim`, `BigDecimal`, `Intl.NumberFormat`) and `Review.rules.ts` (regular
expressions, `Str`, `HashMap`, package imports) are not, and a `decide` that calls them would leave every sequence
through it unrun and fail `check` with `Incomplete`. `review` is reached by neither search nor walks as long as it runs
before the command is sent: the explorer only sees the counts as inputs. The house rules have the same effect here as
in [prove](./prove.md): namespace imports (the `S` alias was run), `Effect.fn` (run), `O.match` and `A.filter` are
read; `HashMap`, `HashSet`, `effect/String`, `Data.taggedEnum`, `.make` on events (run: "not read") and imports
from other workspace packages (run: "not read") are not. Events and rejections are built with `new` in `decide`,
which needs an exception to the app's lint rule `newSchemaClass` for domain block files (a first-line
`// @effect-diagnostics newSchemaClass:off`, run in the trial on beta.87). Keep one aggregate name per
test file: in the trial, two aggregates of one name in one test file failed with "the real code disagrees with what
the explorer read".

- **Used today:** no. The app checks these rules with example tests (`packages/*/*/test`, `apps/inventory/test`) on a real local D1.
- **Where it goes:** `packages/catalog/model/test/ImportDraft.explore.test.ts`, and a model-level test through the catalog and access Apis.
- **What the person gets:** nothing they can see; a confirm or take-back pressed twice is checked against every short sequence, not one example.

## How to check it

`Explore.check(...)` in a Vitest test on Node. It succeeds with the report, fails with `InvariantBroken` (its
`message` is `render(report)` with the shortest breaking story) or with `Incomplete` (its `reasons` list what was not
done, each naming the `allow` that would pass it when one exists). Paste `Explore.script(story)` into a `Story` test
to keep a found sequence as a regression test. Under `it.effect` the console is Effect's test console (`@effect/vitest`
4.1.4, the version the app installs, `src/internal/internal.ts:68`, `:490`), so `Explore.render(report)` printed with `Console` does not
reach Vitest's output; the trial wrote the rendered report to a file, and an assertion on the report's fields needs
neither.

## What it needs

- `@alchemy.run/domain` from main (pull request 3260, commit `e4adb720c`); not in `2.0.0-beta.87`, not on npm.
- Node, `FileSystem` and `Path`, `z3-solver` and `oxc-parser`, as for [prove](./prove.md). The trial ran under Node
  24.22.1 and Vitest 5.0.4; the whole model, search and replay included, took about 36 seconds.
- No host: sequences run in the interpreter and are replayed with `Aggregate.predict` and the model's real rules in
  memory. `Verify`'s `story` option replays them through the in-memory [host](./host-in-memory.md) as well.

## Verdict

**Use, from main:** through `Verify.model` (or `Explore.check` alone), for the model-level rules (every confirmed
file adds up, tenancy across items and imports), with `faults` left on at depth 2 and walks for longer histories. It
runs on this app's model today: a trial on `main@dbfd0ddb` checked 5,173 sequences and sampled 200 walks. Taking it
needs the library from main (not on npm), and the blocks written as [prove](./prove.md) says.

## Where this was read

- The live site has no page for this (it documents beta.87; `https://alchemy.run/domain/verifying-models` returns 404).
- `packages/domain/src/Explore.ts` at `v2.0.0-beta.87`: absent; on `main@dbfd0ddb`: new
- `packages/domain/src/Explore/internal/{ModelSearch,Script,Search}.ts`: new on `main@dbfd0ddb`
- `packages/domain/src/Prove/internal/*`: new on `main@dbfd0ddb` (shared with [prove](./prove.md))
- `packages/domain/src/Verify.ts`: new on `main@dbfd0ddb` (walk default, read in outline)
- `website/src/content/docs/domain/verifying-models.mdx`: new on `main@dbfd0ddb`
- `examples/cloudflare-domain/packages/domain/test/{Guards,Walks,Nodes,Faults,Eventually,Consumer,Transitions,Relation,Bank.explore}.test.ts` and their fixtures: new on `main@dbfd0ddb`
- Pull request 3260 in `alchemy-run/alchemy`
- `@effect/vitest` 4.1.4 (the app's installed copy): `src/internal/internal.ts` (the test console under `it.effect`)
- A trial on 2026-11-19: a model of this app run with `Verify.aggregate` and `Verify.model` on `main@dbfd0ddb`
