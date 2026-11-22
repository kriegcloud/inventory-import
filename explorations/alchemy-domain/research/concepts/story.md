---
type: Reference
title: Story
description: A given / when / then specification that runs the real domain model in memory; this app would use it to pin down the rules of one import (confirm once, refuse a stale or second confirm, take back while unchanged).
tags: [alchemy-domain, checking]
---

# Story

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

A story is a test written as one example of a rule: the history that already happened (`given`), the command
someone sends (`when`), and what the model records or refuses (`then`, `rejected`, `replied`). `Story.make` builds a
runner from a [model](./model.md); the runner hosts the whole model on a fresh in-memory platform, so the
[aggregate](./aggregate.md) decides, [views](./view.md) fold, [policies](./policy.md) and [sagas](./saga.md) react, and
calls to [external systems](./external-system.md) wait until the story answers them. The story is an Effect, so
`it.effect` from `@effect/vitest` runs it. Its strongest property is that it fails on any outcome it does not mention:
an event no `then` names, a rejection no `rejected` names, a call nobody answered. The docs describe it as "A
specification you can run. Given some history, when a command is sent, then these events are recorded."
[https://alchemy.run/domain/story]

## When to reach for it

- For every rule of the model that one example can show: each command's success, each rejection it declares, each
  policy that reacts to what it records, each deadline.
- When a rule involves time (`clock`, `advance`) or an outside system (`call` then `succeed`, `fail` or `die`).
- When two reactions can write the same stream concurrently: the story replays every order that matters.
- Not for SQL, HTTP, sign-in or the screen. A story runs the model on the in-memory host only; see
  [test-tooling.md](./test-tooling.md) for the layers above it.
- Not for "always true" claims across every sequence of commands: on main that is [verify.md](./verify.md).

## How it is declared

```ts
// SKETCH: not compiled
import { it } from "@effect/vitest"
import { Story } from "@alchemy.run/domain/Story" // the steps live on one object, not as module exports
import { Catalog } from "../src/Catalog.model.ts"

// make(model, options?): options are required only when the model has policies or projections
const story = Story.make(Catalog /* , { layer: CatalogHandlers, stub: [Answerer] } */)

it.effect("a rule, as a sentence the business agrees with", () =>
  story(
    Story.given(ref, ...events),            // history, seeded straight onto the stream
    Story.provide(CurrentActor, marcus),    // what the command's middleware would provide
    Story.when(ref, command),               // beta.87: the ref first; main: Story.when(command)
    Story.then(ref, ...events),             // the next events on that stream; none = nothing new
    Story.replied(reply)                    // or Story.rejected(rejection) right after the when
  )
)
```

Every export of `Story.ts` at beta.87, with its exact arguments:

| Step | Arguments at beta.87 | What it checks or does |
| --- | --- | --- |
| `make` | `(model, options?)`; options `{ layer?, stub? }`, `layer` required when the model has policies (type-level) | Returns `(...steps) => Effect<void, StoryFailure \| LE, R>` |
| `given` | `(ref, ...events)` | Seeds events on the stream (through the platform's `seed`), moves that stream's cursor past them, settles |
| `when` | `(ref, command, options?: { commandId? })` | Sends through the aggregate's client with the provided services; default `commandId` is `story:<step>`; settles |
| `then` | `(ref, ...expected)` where each is an event or an `anyOrder` / `inOrder` group | The next N events on the stream match, whole payload, encoded; with no events, nothing new |
| `anyOrder` | `(...items)` | A group whose events may commit in any order |
| `inOrder` | `(...items)` | A group in order; inside `anyOrder`, others may interleave |
| `rejected` | `(rejection)` | The last command (or query) was refused with exactly this rejection, compared encoded |
| `replied` | `(reply)` | The last command's reply, compared whole (not partial) |
| `state` | `(ref, partial \| (state) => void)` | Aggregate state, partial match or an assertion function |
| `view` | `(View, key, partial \| fn \| Story.none)` | A view key's state; `Story.none` says the key does not exist |
| `emitted` | `(View, key, partial[] \| (entries) => void)` | Every event the view key emitted, same length, each partial |
| `streamed` | `(Stream, key, ...events)` | The next entries a projection appended to a stream key; none = nothing new |
| `query` | `(Query, input, expected?, page?: { take?, after? })` | Runs the query as the provided context, through its wire schema; no `expected` means it must be rejected |
| `call` | `(op, partialArgs)` or `(tag, op, partialArgs)` | A call was made with these arguments; matches the earliest unmatched one; a tag names it |
| `succeed` | `(op, value)` or `(tag, op, value)` | Answers a stubbed call; untagged fails if several wait |
| `fail` | `(op, error)` or `(tag, op, error)` | Answers a stubbed call with one of its declared errors |
| `die` | `(op, defect)` or `(tag, op, defect)` | Answers a stubbed call with a defect |
| `returned` | `(op, value)` or `(tag, op, value)` | How a real (not stubbed) call ended: success |
| `failed` | `(op, error)` or `(tag, op, error)` | A real call failed with a declared error |
| `died` | `(op)` or `(tag, op)` | A real call died |
| `clock` | `(at: string \| number \| DateTime)` | Moves the story clock to a time; scheduled commands now due fire |
| `advance` | `(by: Duration.Input)` | Moves the clock forward by a duration |
| `provide` | `(service, value)` | Provides a service to later commands and queries; replaces an earlier value |
| `signal` | `(Saga, key, deferred, value)` | Completes a `DurableDeferred` a saga run waits on, then settles |
| `saga` | `(Saga, key, status \| { _tag: "Died" })` | Where a saga run is: `NotStarted`, `Running`, `Completed`, `Rejected`, `Interrupted`, `Died` |
| `none` | a marker value | Used with `view` for "this key does not exist" |

The module also exports types: `Step`, `StepOf`, `WhenStep`, `RejectedStep`, `RepliedStep`, `ProvideStep`,
`Checked`, `Order`, `Expected`, `StepReport`, and the error class `StoryFailure` (fields `step`, `message`, `reason`,
`steps`, `events`, `order`).

Checked in: `packages/domain/src/Story.ts` at beta.87: `StepReport` 28, `StoryFailure` 43-58, `Step` 81-169,
`Checked` 239-258, `given` 261-268, `when` 271-280, `then` 287-294, `anyOrder` 321, `inOrder` 329, `rejected` 419,
`replied` 425, `state` 428, `view` 434, `emitted` 444, `streamed` 456, `query` 481, `call` 495, `succeed` 517, `fail`
526, `die` 539, `returned` 556, `failed` 563, `died` 574, `clock` 583, `advance` 586, `signal` 595, `saga` 607,
`provide` 632, options 874-884, `maxOrders` 911, `make` 1027-1047, the `Story` object 1925-1954. `Saga.Status` in
`packages/domain/src/Saga.ts` 105-111. The import path `@alchemy.run/domain/Story` comes from the package's `"./*"`
export (`packages/domain/package.json`) and the index's own note (`packages/domain/src/index.ts` 18).

### What main changes

- `when` takes the command alone: `Story.when(command, options?)`. The command carries the instance it is for in its
  input (for example `importId`), and the story sends it to "whatever implements it in the model", an aggregate or a
  [decision](./decision.md). `packages/domain/src/Story.ts` 282-290 on main; the `When` step loses its `ref`
  (main 87-91). An unknown tag fails the step with "the model has no command X" (main 1291-1293).
- `Story.make` now needs the model class to expose `commands`, and `Checked` takes the model's command classes as a
  second type parameter, so `rejected` and `replied` are checked against the model's command with that tag
  (main 197-204, 242-265, 1053-1069).
- A `when` marks as touched every instance the command is for, including each instance a decision reads, so the
  failure report lists their events (`instancesOf`, main 1032-1046, used at 1237-1241).
- `given`, `then` and every other step keep their beta.87 arguments (`given` main 268, `then` main 296).
- Docs: `website/src/content/docs/domain/story.mdx` on main adds that a decision's command is sent through the decision
  and asserted per instance with `then`, and links to verifying a model. `testing-models.mdx` changes only the `when`
  calls. The skill's `references/testing.md` on main adds a section on `Verify` rules.
- The `when` change, `commands` on `Story.make` and `instancesOf` came with pull request 3420, which removed a
  command's `target` and added `Domain.Decision` (commit `dbda8cc16`). The docs line on verifying came with pull
  request 3260 (commit `e4adb720c`).
- Run in a trial on 2026-11-19 on both refs: `Story.when(ref, command)` on beta.87 and `Story.when(command)` with
  `Story.provide(CurrentActor, value)` on main (the stories are under "In this app").

## Rules, and the mistakes to avoid

- **Everything must be accounted for.** At the end the story fails on, in this order: a rejection no step asserted, a
  saga run that died and no `saga(..., { _tag: "Died" })` asserted, a real call with no `returned` / `failed` /
  `died`, a stubbed call still waiting, and any committed event past a stream's cursor ("committed events no step
  asserts (assert them with then)"). This covers events a policy or saga wrote on other instances. (beta.87 Story.ts
  1706-1758.)
- **`rejected` comes right after the step that was refused.** Any other step after an unasserted rejection fails the
  story at once (1201-1203). The same holds after a `query` with no expectation.
- **History reaches views, never policies.** `given` seeds events and settles, so views and projections fold them,
  but policies do not react to seeded history (skill `references/testing.md` line 47; main's suite has the case
  "history reaches views but never policies", `packages/integration-tests/test/Domain/Story.test.ts` 625).
- **`then` reads a window.** It compares the next N events after the stream's cursor, where N is the number of events
  named, then moves the cursor; events after them stay unasserted until another `then` or the end (1272-1325).
  Payloads are compared whole after encoding, so every field must match. `state`, `view`, `emitted` rows and `query`
  rows are partial matches; `replied` is a whole match (1362).
- **Orders it replays, and the limit.** Each policy delivery, saga run and saga step runs until it finishes or waits.
  When several are ready at once and two of them committed to the same stream, the story is replayed with the other
  one first, depth first, from a fresh platform each time; every run must pass. Writers on different streams are not
  reordered. Past 256 orders the story fails with "the story has more than 256 orders of concurrent work ... split it
  into smaller stories" (`explore`, 910-1020). A failure in a reordered run names the swap ("in another order of
  concurrent work: ...").
- **An ordered `then` over concurrent writers fails** in the order where it does not hold; the message suggests
  `Story.anyOrder` when the same events came in another order from different commands in one step (1303-1322).
- **The clock.** It starts at `2026-01-01T00:00:00.000Z` (1050). `clock` accepts an ISO string, epoch milliseconds or a
  `DateTime`; it may move back only while every earlier step is a `provide` (1206-1225). `advance` refuses a negative
  or non-finite duration (1226-1236). Commands are stamped with the story clock, and both steps settle, so due
  scheduled commands fire. The story clock is not Effect's `TestClock`: it is the in-memory platform's `now`.
- **Settling has a limit.** A model that keeps producing work for 10,000 rounds fails with "the domain did not settle
  (a policy or projection is looping?)"; a policy or projection that fails makes the step fail (1154-1181).
- **Type checks follow the last `when`.** `rejected` must be a rejection that command declares, `replied` its reply
  type, and a `when` needs a `provide` before it for each service its middleware provides; the type error names the
  missing `Story.provide(...)` (209-258). A helper typed as plain `Step` switches the checks off until the next
  `when`, so let helpers infer their type.
- **External calls.** Every call needs a `call` step before it is answered or asserted (1647-1651, 1683-1687). An
  untagged `succeed` with two calls waiting fails; tag them. Answers are checked against the operation's schemas, like
  an adapter (1082-1110).
- **Resending with the same `commandId`.** The in-memory host keeps the receipt of each accepted command by its
  `commandId` and returns it again without deciding twice (`packages/domain/src/InMemory.ts` 649-650, 688). A
  rejection is not kept, so a resend of a refused command decides again. Run on beta.87 in the trial, through the
  client's `send` rather than a story: the same `commandId` sent again answered the same receipt.

## In this app

The rules of one import, as stories. The stories below ran in a trial on 2026-11-19 (source in the appendix of
[the trial](../04-trial.md)), one set on each ref, against a
model of this app written outside the app (the app's own code has no aggregate yet). The names are the trial's, not
the app's code.

On beta.87 (a command names its `target`; `Story.when(ref, command)`), against an `Import` aggregate whose
`ConfirmImport` carries the `reviewedAt` version the person reviewed and is refused with `StaleReview` when it is not
the decide context's `version`:

Run in the trial with `@alchemy.run/domain` 2.0.0-beta.87, `effect` 4.1.4, Vitest 5.1 and `@effect/vitest` 4.1.4:
the first two pass; the third fails with "committed events no step asserts", as it should.

```ts
// @effect-diagnostics newSchemaClass:off
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import {
  ConfirmImport,
  Import,
  ImportConfirmed,
  ImportId,
  ImportStaged,
  Inventory,
  NotOpen,
  StaleReview
} from "../src/Import.aggregate.ts"

const story = Story.make(Inventory)
const draft = Import.ref(ImportId.make("org_prairie:imp_1"))
const staged = new ImportStaged({ fileName: "items_messy.csv", rowCount: 200 })

it.effect("a confirm of the review as read is recorded once, and a second is refused", () =>
  story(
    Story.given(draft, staged),
    Story.when(draft, new ConfirmImport({ confirmId: "c1", reviewedAt: 1, ready: 155 })),
    Story.then(draft, new ImportConfirmed({ confirmId: "c1", ready: 155 })),
    Story.replied({ confirmId: "c1" }),
    Story.when(draft, new ConfirmImport({ confirmId: "c2", reviewedAt: 2, ready: 155 })),
    Story.rejected(new NotOpen())
  )
)

it.effect("a confirm of a review that has moved on is refused with the version it is at", () =>
  story(
    Story.given(draft, staged),
    Story.when(draft, new ConfirmImport({ confirmId: "c1", reviewedAt: 0, ready: 155 })),
    Story.rejected(new StaleReview({ current: 1 }))
  )
)

it.effect("a story that leaves a recorded event unasserted fails", () =>
  story(
    Story.given(draft, staged),
    Story.when(draft, new ConfirmImport({ confirmId: "c1", reviewedAt: 1, ready: 155 }))
  )
)
```

The first line switches the app's `newSchemaClass` diagnostic off for the file; the trial ran both this file form
and the per-line form (`// @effect-diagnostics-next-line newSchemaClass:off`), and with every block built with `new`
the type-check with the app's flags passed. On beta.87 a rejection cannot be
built with `.make` (it does not type-check), and on main the prover reads only `new`, so domain blocks and their
stories need that exception.

On main (no `target`; `Story.when(command)`), against the trial's `ImportDraft`, whose commands go through a `Session`
middleware that provides `CurrentActor`:

```ts
// Run in a trial on 2026-11-19 on main@dbfd0ddb, Vitest 5.0.4 on Node: both pass.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import { CurrentActor } from "./Actor.context.ts"
import {
  ConfirmImport,
  ImportConfirmed,
  ImportDraft,
  ImportId,
  ImportStaged,
  NotPermitted,
  SettleRow,
} from "./ImportDraft.aggregate.ts"
import { Inventory } from "./Inventory.model.ts"

const story = Story.make(Inventory)
const id = ImportId.make("org_prairie:imp_1")
const draft = ImportDraft.ref(id)
const staged = new ImportStaged({ organizationId: "org_prairie", rows: 200, ready: 155, waiting: 45 })
const dana = { organizationId: "org_prairie", memberId: "m_dana", role: "admin" as const }
const outsider = { organizationId: "org_northline", memberId: "m_noor", role: "admin" as const }

it.effect("story: its own organization confirms an import", () =>
  story(
    Story.given(draft, staged),
    Story.provide(CurrentActor, dana),
    Story.when(new ConfirmImport({ importId: id, reviewedAt: 1 })),
    Story.then(draft, new ImportConfirmed({ created: 155, notImported: 45 })),
    Story.replied({ created: 155 }),
  ),
)

it.effect("story: another organization's admin is refused", () =>
  story(
    Story.given(draft, staged),
    Story.provide(CurrentActor, outsider),
    Story.when(new SettleRow({ importId: id })),
    Story.rejected(new NotPermitted({})),
  ),
)
```

The import id carries the organization (`org_prairie:imp_1`), and the command carries the instance in its input
(`importId`), which is all `Story.when` needs on main.

The take-back rules involve the items as well. On beta.87 an aggregate decides from its own state only, so one way
is a policy on `TakeBackStarted` that sends `TakeBackItem` to each item the import created; an `Item` still at
revision 1 records `ItemTakenBack`, an edited one records `ItemKept`. The story must then name every item's event,
because the policy's events on other instances count too:

```ts
// SKETCH: not compiled. beta.87 form. Needs Story.make(Catalog, { layer: CatalogPolicies }) once the model has a policy.
it.effect("a take-back removes the untouched items and keeps the changed one", () =>
  story(
    Story.given(five, staged, saved, confirmed),
    Story.given(oakCrate, created, edited), // revision 2: someone changed it
    Story.given(steelBolt, created),
    Story.given(nylonRope, created),
    asMarcus,
    Story.when(five, new Imp.TakeBack({ confirms: ["c-1"] })),
    Story.then(five, new Imp.TakeBackStarted({ confirms: ["c-1"] })),
    Story.then(steelBolt, new Item.ItemTakenBack({ importId: "imp-1" })),
    Story.then(nylonRope, new Item.ItemTakenBack({ importId: "imp-1" })),
    Story.then(oakCrate, new Item.ItemKept({ importId: "imp-1", revision: 2 })),
    Story.view(ImportResult, five, { removed: 2, kept: 1 })
  ))

it.effect("a second take-back records nothing", () =>
  story(
    Story.given(five, staged, saved, confirmed, new Imp.TakeBackStarted({ confirms: ["c-1"] })),
    asMarcus,
    Story.when(five, new Imp.TakeBack({ confirms: ["c-1"] })),
    Story.then(five)
  ))
```

On main the take-back could instead be one [decision](./decision.md) that reads the import and its items and commits
to all of them at once, which is closer to today's single D1 batch; the story keeps the same `then` lines and sends
`Story.when(new TakeBack({ importId: "imp-1", confirms: ["c-1"] }))` (a sketch; the trial ran no decision).

Where each story would sit next to today's tests:

| Story | Today's test | Beside or replace |
| --- | --- | --- |
| Confirm recorded once | `packages/catalog/model/test/Endpoints.test.ts` "a confirm writes the ready rows and says so; a second confirm is AlreadyImported and writes nothing" (over the in-memory twins) | Replaces the decision half; the twin test keeps the counts read back through `items.list` |
| Stale review refused | `apps/inventory/test/server/ConfirmRevision.slow.test.ts` "a confirm names the revision its screen showed". Today the confirm names that revision with its unsaved decisions (`ConfirmRequest`) and is refused with `DraftMoved` when the draft has moved on (`commit` in `packages/catalog/contract/src/Catalog.contract.ts`) | Beside it: the rule is built (his answer of 2026-11-19, "Refuse, show, confirm again"), and the slow test stays for D1 |
| Second confirm refused | Same `Endpoints.test.ts` case; `AlreadyImported` in `packages/catalog/contract/src/Import/Import.rejection.ts` | Replaces the twin assertion; `apps/inventory/test/server/Imports.slow.test.ts` stays for D1 |
| Take-back keeps a changed item | `Endpoints.test.ts` "a take-back removes the untouched items, keeps and names the edited one, and a second press writes nothing"; `apps/inventory/test/server/TakeBack.slow.test.ts` | Replaces the twin case; the slow test stays, since the revision checks live in SQL today (`packages/catalog/host/src/ImportStore.adapter.ts` 1407-1479) |
| Second take-back does nothing | Same twin case | Replaces it |

`packages/catalog/model/test/Confirm.test.ts` (the plan's statuses add up to the review's, an `it.prop`) is a test of
the pure `review` and `confirmPlan`, not of a command, and stays as it is.

- **Used today:** no. The app tests its handlers over in-memory twins of the ports
  (`packages/catalog/model/test/Endpoints.test.ts`, `support.ts`) and over a real local D1 (`apps/inventory/test/server/*.slow.test.ts`).
- **Where it goes:** a new `packages/catalog/model/test/Import.story.test.ts` beside `Endpoints.test.ts`, once an
  `Import` aggregate exists in `packages/catalog/model/src/Import/`.
- **What the person gets:** nothing they can see; the rules of Confirm and Take back are pinned as sentences that run.

## How to check it

- Run it with `bun run test -- --project fast` (Vitest on Node, `it.effect`). A story is fast: no database.
- Prove the story is not vacuous: delete one `then` line and watch it fail with "committed events no step asserts"
  (beta.87 `Story.ts:1755`); remove the `rejected` line and watch it fail with "was rejected with ..., which no step
  asserts" (`Story.ts:1186`). The first was run: in the trial on beta.87 (Effect 4.1.4, Vitest 5.1, `@effect/vitest`
  4.1.4) a story that left a recorded event unasserted failed with that message. The stories under "In this app"
  that are marked as run passed; the take-back stories are sketches.
- A failing story's `StoryFailure.message` lists every step (passed, failed, not run) and the events per stream so far.
  It is the test's failure, so Vitest shows it. A report the test prints itself is another matter: under `it.effect`
  the console is Effect's test console (`@effect/vitest` 4.1.4, the version the app installs, `src/internal/internal.ts:68`, `:490`), so text
  printed with Effect's `Console` does not appear in Vitest's output. The trial wrote its rendered `Verify` report to
  a file for that reason.

## What it needs

- The in-memory host only: `Story.make` builds its own `InMemory.make({ manual: true, ... })` platform per run
  (beta.87 Story.ts 1051). No Durable Objects, no D1.
- `@alchemy.run/domain` beta.87 (or main, with the `when` change), `effect` 4.1.4, `vitest` and `@effect/vitest`.
  Both were run: beta.87 under Vitest 5.1 (the installer added the required peer `alchemy` 2.0.0-beta.87), main under
  Vitest 5.0.4 on Node.
- A `layer` for the model's policies and projections, and Layers for any external system not in `stub`.

## Verdict

**Use:** write one story per import rule in `packages/catalog/model/test/Import.story.test.ts` as soon as the import
aggregate exists, starting with the confirm stories that ran in the trial (one aggregate, no policy), then the
take-back stories once items are aggregates. On beta.87 the step is `Story.when(ref, command)`; on main it is
`Story.when(command)`. Keep the D1 slow tests for what SQL decides.

## Where this was read

- https://alchemy.run/domain/story and https://alchemy.run/domain/testing-models (the live site documents beta.87)
- https://alchemy.run/providers/domain/story.md (the generated reference; same text as the JSDoc of `Story`)
- `website/src/content/docs/domain/story.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `website/src/content/docs/domain/testing-models.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Story.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/InMemory.ts`, `packages/domain/src/Saga.ts` at `v2.0.0-beta.87`
- `packages/domain/skills/alchemy-domain/references/testing.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `examples/cloudflare-domain/packages/domain/test/Bank.story.test.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/integration-tests/test/Domain/Story.test.ts` on `main@dbfd0ddb`: new (not in the beta.87 export)
- `@effect/vitest` 4.1.4 (the app's installed copy): `src/internal/internal.ts` (the test console under `it.effect`)
- A trial on 2026-11-19: the stories above, run on beta.87 and on `main@dbfd0ddb`
