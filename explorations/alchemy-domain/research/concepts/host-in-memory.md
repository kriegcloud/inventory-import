---
type: Reference
title: Host in memory
description: Domain.InMemory, the host that runs a whole model inside one process; this app would use it under the model's tests in place of hand-written in-memory twins.
tags: [alchemy-domain, host]
---

# Host in memory

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

`Domain.InMemory` is a Layer that provides a [`Platform`](./platform-contract.md), a `WorkflowEngine` for sagas, and
`SecureRandom`, all held in plain JavaScript memory. Give it to a model's Layer and every aggregate, view, policy,
projection and stream runs for real in the current process: commands decide and commit, policies react, views catch
up just after each command. The docs describe it as running "your whole model in the current process"
[https://alchemy.run/domain/in-memory]. It is the reference host: beep-effect runs its platform conformance suite
against it first, and Alchemy's story runner builds one of its own for every story.

## When to reach for it

- Tests of a model's behaviour through its clients or its Api (`clientInProcess`), with nothing deployed.
- A test that needs control of time and of the order reactions run in: use `InMemory.make({ now })` and its `Control`.
- A single long-lived process (a CLI, a script, a local tool) where losing everything on exit is acceptable.
- Not a [story](./story.md): stories build their own in-memory platform (`InMemory.make({ manual: true, ... })`,
  `packages/domain/src/Story.ts` line 1051), so you do not provide `Domain.InMemory` to them.
- Not a Cloudflare Worker. See "Rules" below.

## How it is declared

```ts
// SKETCH: not compiled (shapes copied from the source)
// packages/domain/src/InMemory.ts, beta.87
export const InMemory: Layer.Layer<Platform | WorkflowEngine.WorkflowEngine | SecureRandom.SecureRandom> =
  Layer.suspend(() => make().layer)

export const make = (options: Options = {}) => ({ layer, control })  // layer: same three services

interface Options {
  readonly manual?: boolean            // queue deliveries until control.drain; default false (background)
  readonly now?: () => number          // the clock that stamps commands and decides when timers are due; default Date.now
  readonly choose?: (ready: ReadonlyArray<string>) => number  // manual: which ready writer runs next
  readonly ran?: (label: string, wrote: ReadonlyArray<string>) => void  // manual: after each queued item ran
}

interface Control {
  readonly drain: Effect.Effect<void>   // fire due timers, then deliver until the queue is empty
  readonly idle: Effect.Effect<boolean> // nothing queued, and every running reaction is suspended
  readonly suspended: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  readonly failures: ReadonlyArray<unknown>  // defects from policy and projection runs
  readonly deaths: ReadonlyArray<{ saga: string; executionId: string; defect: unknown }>
  readonly commits: ReadonlyArray<{ aggregate: string; id: string; index: number }>
}
```

`Domain.InMemory` is exported from the package root (`packages/domain/src/index.ts` line 294); `make`, `Options` and
`Control` come from the subpath `@alchemy.run/domain/InMemory` (the package exports `./*`).

What each piece does (all in `InMemory.ts` at beta.87):

- **Aggregates** (lines 567-792): one `Semaphore` per aggregate type, not per instance, guards `send`, `schedule`,
  `unschedule` and `seed`. An instance keeps `state`, `version`, a `receipts` map by command id, its `scheduled`
  armings, its `events` array and its catch-up cursors. `send` returns a kept receipt for a repeated command id
  (649-650), calls `kit.handle`, and on acceptance updates state, appends events, records the receipt, announces the
  new version to `changes`/`tail` subscribers, and queues the deliveries (646-692).
- **Timers** (296-318): `schedule` stores the arming and calls `timer`. In manual mode the timer waits for `drain`. In
  background mode it forks a sleep and then fires what is due.
- **Views** (794-1017): per key, a snapshot and entries held in `SubscriptionRef`s, an input log, and one lock per
  view. `connect` serves a live read over a WebSocket (`serveSocket`, 976-993), so live reads work in memory.
- **Projections** (1019-1162): per key, an input log processed in order in batches, the batch timer forked.
- **Streams** (1164-1278), **policies** (1280-1304, one lock per policy key, run forked, failures collected).
- **Catch-up**: the upstream `Backfill` roles over in-memory storage (373-562), `start` and `history` (1307-1332).
- **Workflow engine**: `InMemoryWorkflows.make` (320-353); sagas' journals live in memory.
- **Models**: storage is memoized by model name for the life of one `make()` result, so a model Layer built again on
  the same platform (a "redeploy" inside a test) keeps its data; `hostedModels({ release: true })` (1335) makes a
  different model with the same name die.

What it keeps, and what it loses: everything lives as long as the object `make()` returned. `Domain.InMemory` calls
`make()` each time the Layer is built, so each test that builds it starts empty, as the docs
say of their own example (in-memory.mdx line 56). Nothing is written anywhere. Receipts, events and entries are never
trimmed.

Checked in: `packages/domain/src/InMemory.ts` lines 36-93 (options and control), 129-1348 (`make`), 1369-1371
(`InMemory`); `packages/domain/src/index.ts` 294 (322 on main); `website/src/content/docs/domain/in-memory.mdx` (all
64 lines).

**Run in a trial on 2026-11-19, beta.87.** In an empty folder with `@alchemy.run/domain@2.0.0-beta.87` and
`effect@4.1.4` (the installer added the required peer `alchemy@2.0.0-beta.87`; no peer warning), one aggregate
`Import` (`StageImport`, `ConfirmImport`; `ImportStaged`, `ImportConfirmed`; `NotOpen`, `StaleReview`) was hosted with
`Inventory.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory))` under Bun 1.4.5 and Node 24.22.1. `send` of
`StageImport` answered a receipt at version 1; a `ConfirmImport` whose `reviewedAt` was not the decide context's
`version` was rejected with `StaleReview { current: 1 }`; the right one answered version 2 with its reply; the same
`commandId` sent again answered the same receipt; a second confirm was rejected with `NotOpen`; `get(Import.ref(id))`
answered the `Imported` state; `Domain.verify(Inventory)` answered `[]`. Bundled for a browser (minified), the
in-memory host and one aggregate's declarations added about 205 kB (67 kB gzip) over a file using only Effect and its
Schema, of which the declarations alone were about 133 kB (43 kB gzip); of the `alchemy` package only `Workflows` and
`WorkflowEncoding` were pulled in. Not run: background timers, views, projections, policies, sagas, queries.

### Types and helpers

| Name | What it is | Where (beta.87; main) |
| --- | --- | --- |
| `InMemory` | the Layer: `Platform`, `WorkflowEngine` and `SecureRandom`, a fresh `make()` each time it is built | 1369-1371; exported from the package root |
| `make` | builds a platform and its `Control`; `@alchemy.run/domain/InMemory` | 129-1348 |
| `Options`, `Control` | the options and the control surface above | 36-56, 61-93 |
| `isAfter` | whether a stream write's `origin` is after the last one applied (internal) | 1374-1377 |
| `mergeCheckpoints` | the later of two sets of per-source checkpoints (internal; the Durable Object host uses it too) | 1380-1387 |

### The early-waking timer, and the fix

At beta.87, a background timer is `Effect.sleep(Math.max(0, at - now()))` followed by `fireDue` (lines 315-317).
`fireDue` fires only timers whose `at <= now()` (195-198). If the sleep ends before `now()` reaches `at` (Node rounds
and merges timers, and `now` can be a different clock from Effect's), the timer is not due, is skipped, and nothing
arms it again: the scheduled command runs only when some later `drain` or another timer happens to call `fireDue`.

- beep-effect carries a patch on beta.87 (`patches/@alchemy.run%2Fdomain@2.0.0-beta.87.patch`, applied through
  `patchedDependencies` in its root `package.json`). It changes both `lib/InMemory.js` and `src/InMemory.ts` to
  repeat the sleep until `now() >= at`, then call `fireDue`. Its hold ledger (hold
  `alchemy-domain-aggregate-read-optional`) describes the defect as a timer that
  fires before it is due; the source above shows a skipped fire instead, and the patch fixes both readings.
- main fixes it differently (`packages/domain/src/InMemory.ts` on main, lines 379-388): each wake checks that the
  timer is still the armed one under its key (not cancelled, replaced or fired), and sleeps again for what is left, or
  calls `fireDue` when nothing is left. The commit is `538fd9a46` (#3376).
- The difference: the patch keeps sleeping for a cancelled or replaced timer until its old due time (harmless, since
  firing checks that the timer is still armed, line 307); main stops at the first wake.

### What main changes

- **Decisions** (commit `dbda8cc16`, #3420; `InMemory.ts` on main, lines 909-960): `decision(_, kit)` returns a store whose `send` reads every
  instance the command names, takes the lock of every aggregate type involved in name order (so two decisions never
  deadlock), decides, records each write through `kit.record` on its instance, and keeps a receipt per command id.
  The docs add one sentence for it (in-memory.mdx on main, line 30). See [decision](./decision.md).
- **Run accounting**: forked runs are `tracked`, a run's waits count once (`CurrentRun`, line 128), and a manual
  platform provides `RunWait` so a run that polls for another run's work (a read `atLeast` a write) lets the queue go
  on. `idle` no longer counts a polling run as idle.
- **The timer fix** above (379-388).
- Source roles get `targets: () => kit.targets`.
- The docs example on main calls the Api with one argument object (`sam.DepositMoney({ accountId, amount: 100 })`)
  instead of `(accountId, { amount: 100 })`, because commands on main may have no `target`.
- **Run on main in a trial on 2026-11-19**, through stories only (a story builds its own manual in-memory platform,
  `Story.ts` line 1081 on main): with Node 24.22.1, Vitest 5.0.4 and `effect` 4.1.4, a model of this app's import
  (`ImportDraft`, `Item`, `Allowance`, `Organization`) passed its stories in main's shape (`Story.when(command)`,
  `Story.provide(CurrentActor, value)`), and `Verify.model` ran 42 explored sequences and 200 random walks on the real
  model as stories. `Domain.InMemory` itself was not provided to a Layer on main, and Bun was not used there. See
  [story.md](./story.md) and [verify.md](./verify.md).

## Rules, and the mistakes to avoid

- **Not for a Worker.** A Worker's isolate keeps memory only by chance: requests are spread over isolates, and an
  isolate can be evicted at any time. Each isolate would hold its own items and imports, and lose them without
  warning. Background work (deliveries, timers, projection batches) is forked and detached, and a Worker does not wait
  for detached work after it answers. The doc comment on `InMemory` says it is for tests and single-process apps
  (lines 1350-1353).
- **Pick one clock.** The default `now` is `Date.now`, while background timers sleep on Effect's `Clock`. Under
  `it.effect` (a test clock) a scheduled command never fires on its own. Either use `it.live`, as the docs do, or build
  with `InMemory.make({ now: () => fixed })`, move `fixed` yourself, and call `control.drain`, as beep-effect's
  conformance test does (`packages/drivers/alchemy-postgres/test/conformance/inmemory.test.ts`).
- **On beta.87, do not rely on background timers to the millisecond.** Drain them yourself, or carry the patch.
- **Wait for reactions before you assert on them.** In background mode, deliveries run in a forked `drain`; a view can
  lag the command by a moment. Call `control.drain` (needs `make`), read with a consistency option, or poll.
- **Concurrency is coarser than a real host.** Commands on any instance of one aggregate type take one lock, so a test
  here cannot show two imports committing in parallel; it can only show that they do not corrupt each other.
- **Check `control.failures` and `control.deaths`.** A policy or projection that dies is logged and collected, not
  raised to the test.
- **Share a platform on purpose.** Two Layers built from one `make()` share storage by model name; two builds of
  `Domain.InMemory` do not.

## In this app

Today the model's tests run handlers on hand-written twins: `packages/catalog/model/src/Catalog.memory.ts` (about
1,600 lines; `ImportStoreMemory` at line 804, `ItemStoreMemory` 1470, `catalogMemory` 1618) and
`packages/access/model/src/Access.memory.ts`. The twin's own header sets its rule: it must answer what the D1 adapter
answers, checking each guard (the import is still open, this confirm is in force, the item is at revision 1) in the
same order. Every guard the adapter adds has to be written twice.

If the catalog were an Alchemy model (an `Import` aggregate with `Confirm` and `TakeBack`, an `Item` aggregate with
`Edit`), its tests would host it on `Domain.InMemory` and the kernel would enforce the guards in both places, because
it is the same code:

```ts
// SKETCH: not compiled. Catalog, CatalogHandlers and the client calls are hypothetical (beta.87's shape: a command
// names its target first); see aggregate.md. The trial ran a smaller model on Domain.InMemory, not this test.
import * as InMemory from "@alchemy.run/domain/InMemory"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { expect, it } from "@effect/vitest"

let clock = 1_767_225_600_000 // 2026-01-01, moved by hand
const host = InMemory.make({ now: () => clock })
const CatalogInMemory = Catalog.layer(CatalogHandlers).pipe(Layer.provide(host.layer))

it.effect("a second take-back of a confirm writes nothing", () =>
  Effect.gen(function* () {
    const imports = yield* Catalog.Import
    yield* imports.Confirm(importId, { rows: readyRows })
    const first = yield* imports.TakeBack(importId, { confirm: confirmId })
    const second = yield* imports.TakeBack(importId, { confirm: confirmId })
    yield* host.control.drain
    expect(second.reply.removed).toBe(0)
    expect(first.reply.removed).toBe(readyRows.length)
    expect(host.control.failures).toEqual([])
  }).pipe(Effect.provide(CatalogInMemory))
)
```

What stays outside the model keeps a twin: `SuggestionStore`, `AssistantLog`, `Answerer` and the model-call
allowance (`ModelAllowance.memory`) are services the model would call as [external systems](./external-system.md) or
read beside it. The two things the twin header says it does not imitate (stored value sizes and the search's
one-wrong-letter forgiveness) stay tests on a real local D1 either way.

- **Used today:** no. The twins in `packages/catalog/model/src/Catalog.memory.ts` and the access twins play this
  role: `catalogMemory()` is used by `packages/catalog/model/test/Endpoints.test.ts` and
  `packages/catalog/host/src/CatalogTest.test-layer.ts`, and `apps/inventory/test/server/support/app.ts` takes
  `ImportStoreMemory`, `ItemStoreMemory` and the other twins directly from `@inventory/catalog-model/Memory`.
- **Where it goes:** the model package's tests (`packages/catalog/model/test`), in place of `ImportStoreMemory` and
  `ItemStoreMemory`; the other twins stay.
- **What the person gets:** nothing they can see; the confirm and take-back rules are tested in the same code that
  runs them.

## How to check it

- The app's rules 3, 4, 5 and 10 (a second import adds nothing, take-back keeps a changed item, an edit on an old
  revision is refused, a second confirm or take-back writes nothing) as tests against the model on `Domain.InMemory`.
- After each test, `control.failures` and `control.deaths` are empty.
- beep-effect's conformance suite (`test/conformance/scenarios.ts`, `consumers.ts`) shows what a full check of the host
  itself looks like; for this app the host is Alchemy's, so the model's rules are what to test.

## What it needs

Nothing beyond `@alchemy.run/domain` and `effect`. beta.87 (with the timer caveat, or beep-effect's patch); main adds
decisions and the timer fix. Not a production host for this app, which runs on Workers.

## Verdict

**Use:** provide `Domain.InMemory` (or `InMemory.make({ now })` with `control.drain` when time or order matters) to
the model's Layer in its tests, and retire the import and item twins once the model exists; keep it out of the Worker.

## Where this was read

- https://alchemy.run/domain/in-memory (the live site documents beta.87)
- `website/src/content/docs/domain/in-memory.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/InMemory.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: `packages/domain/src/InMemory.ts` changed
- `packages/domain/src/Platform.ts`, `packages/domain/src/Kernel.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Story.ts` line 1051 and `packages/domain/src/index.ts` line 294 at `v2.0.0-beta.87`; on
  `main@dbfd0ddb` lines 1081 and 322
- beep-effect: `patches/@alchemy.run%2Fdomain@2.0.0-beta.87.patch`, root `package.json` (`patchedDependencies`),
  `hold-ledger/claims.jsonl` (the hold for this patch), `packages/drivers/alchemy-postgres/test/conformance/inmemory.test.ts`
- The app: `packages/catalog/model/src/Catalog.memory.ts`, `packages/catalog/model/src/Answer/ModelAllowance.external.ts`,
  `apps/inventory/test/server/support/app.ts`
