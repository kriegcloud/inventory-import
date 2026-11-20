---
type: Reference
title: Host on Cloudflare Durable Objects
description: The Domain host that runs every aggregate instance, view key, policy, projection key and stream key as its own Cloudflare Durable Object; what it stores, what it costs an import, and what inventory-import must change to use it.
tags: [alchemy-domain, host]
---

# Host on Cloudflare Durable Objects

`DomainCloudflare.layerDurableObjects()` is the Layer that hosts a [model](./model.md) on Cloudflare. While the
model's Layer is built inside an Alchemy `Cloudflare.Worker`, it declares one Durable Object class per
[aggregate](./aggregate.md), [view](./view.md), [policy](./policy.md), [projection](./projection.md) and
[stream](./stream.md), named after the model, and one object of that class per instance or key. Each object keeps its
own state in its own SQLite-backed storage, through Cloudflare's key-value calls, and commits a command's events,
state, receipt and outbox in one storage transaction. The docs put it as "every aggregate instance, view key and
policy gets its own Durable Object" [https://alchemy.run/domain/cloudflare]. For inventory-import this is the
production host the app would use if it moved imports (and perhaps items) into a model; today it hosts nothing.

## When to reach for it

- When the model must run deployed, on the same Cloudflare account and D1 database the app already uses, with one
  writer per import (no two confirms of one import interleave) and durable, ordered deliveries to the projection that
  writes items into D1.
- When the screens should get live reads pushed over WebSockets (an import's review counts, a result screen) instead
  of polling.
- Not for tests: tests use [the in-memory host](./host-in-memory.md); the same model runs there unchanged.
- Not when the model must run outside Cloudflare: see [Rivet](./host-rivet.md) and
  [Effect Cluster](./host-effect-cluster.md). The contract every host meets is in
  [platform-contract.md](./platform-contract.md).

## How it is declared

Three pieces: the host Layer under the model's Layer, an Effect-native `Cloudflare.Worker` class that provides them,
and `DomainCloudflare.providers()` in the Stack.

```ts
// SKETCH: not compiled. Module and model names are this app's, invented for the example.
// apps/inventory/src/server/CatalogDomainWorker.ts
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Catalog, CatalogHandlers } from "@inventory/catalog-model/Catalog.model"
import { CatalogApi } from "@inventory/catalog-model/Catalog.api"
import { D1ItemRows } from "@inventory/catalog-host/ItemRows.adapter"

const CatalogLive = Catalog.layer(CatalogHandlers).pipe(
  Layer.provideMerge(D1ItemRows),
  Layer.provide(
    Layer.mergeAll(
      DomainCloudflare.layerDurableObjects({ locationHint: "enam" }),
      Cloudflare.D1.QueryDatabaseBinding
    )
  )
)

/** The model's Worker: every import (and its projection) lives in Durable Objects of this script. */
export default class CatalogDomainWorker extends Cloudflare.Worker<CatalogDomainWorker>()(
  "CatalogDomain",
  { main: import.meta.url },
  Effect.gen(function* () {
    const api = yield* CatalogApi
    return { fetch: api.fetch }
  }).pipe(Effect.provide(CatalogLive))
) {}

// packages/infra/src/Inventory.stack.ts (the parts that change)
// providers: Layer.mergeAll(Cloudflare.providers(), DomainCloudflare.providers())
// const domain = yield* CatalogDomainWorker
// const website = yield* Cloudflare.Website.Vite("Website", { ...as today, env: { ...as today, DOMAIN: domain } })
```

The shape follows the upstream example's `BankWorker` (`examples/cloudflare-domain/packages/server/src/BankWorker.ts`
lines 26-77, the same at both refs). If the model's commands, events and rejections live in a separate file, keep
them reachable from the aggregate's file by relative imports, or the prover on main cannot read them (see
[prove.md](./prove.md)).

**`layerDurableObjects(options)`.** It returns `Layer<Platform | WorkflowEngine, never, Worker | SecureRandom |
Providers>`: it provides Domain's `Platform` and Effect's `WorkflowEngine` (sagas run on it), and it needs Alchemy's
`Worker` service, `SecureRandom`, and the `Providers` tag that `DomainCloudflare.providers()` registers. The same
options return the same Layer (a cache keyed by the three options), so several models share one platform and one
engine. Options, all optional:

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `jurisdiction` | `DurableObjectJurisdiction` (e.g. `"eu"`) | none | Every object of the model (saga runs too) is created and stored only inside it. An object in a jurisdiction is a different object from the same name outside it, so adding it later starts the model empty and leaves the old objects where they were. Not emulated in `alchemy dev`. |
| `locationHint` | `DurableObjectLocationHint` (`wnam`, `enam`, `sam`, `weur`, `eeur`, `apac`, `oc`, `afr`, `me`) | none | New objects are created near the hint instead of near the first caller. Existing objects never move. Best-effort. Not emulated in `alchemy dev`. |
| `backfillTimeout` | `Duration.Input` | `"30 minutes"` | How long a deploy waits for the [backfill](./backfill.md) of views and projections it adds or rebuilds. Past it the deploy fails with `BackfillStillRunning` and the backfill keeps running; a run that ends badly fails the deploy with `BackfillFailed`. |

There are no other options. Per-model settings sit on the model's `layer`: `legacyData: false` (below) and
`telemetry` (see [observability.md](./observability.md)).

**Why the model needs an Effect-native `Cloudflare.Worker`, and why `Cloudflare.Website.Vite` cannot be it.** Checked
in Alchemy's Cloudflare package (`packages/cloudflare/src`, as published at `2.0.0-beta.87` and on `main@dbfd0ddb`):

1. The host requires Alchemy's `Worker` service. `cloudflareHost` is typed `Layer<Platform, never, Worker |
   SecureRandom>` (`packages/domain/src/Cloudflare/index.ts` lines 235-244 at beta.87, 241-250 on main), its
   `declare` is Alchemy's inline `Cloudflare.DurableObject(name, props, impl)` re-typed as needing `Worker` (lines
   91-95), and its `claimKey` is the `Worker` service itself (line 300 at beta.87, 306 on main), so two different
   models with one name in one Worker fail.
2. An inline Effect Durable Object registers its binding with `yield* Worker` and asks that Worker to export its class
   (`Workers/DurableObject.ts`, `exportDurableObjectClass(yield* Worker, className, …)`, line 1565 at beta.87, 1543 on
   main). The Worker's `exports` prop that collects these classes is "for Effect-native Workers only"
   (`Workers/Worker.ts` line 850 at beta.87, 853 on main).
3. Only the Rolldown bundle path writes the generated entry that exports those classes: `virtualEntry` returns
   `makeEffectVirtualEntry(exports, stack)` when the entry kind is `"effect"` (`Workers/Sources/Rolldown.ts` lines
   172-175 and 190-248, the same lines at both refs). That entry exports a `DurableObjectBridge` class for every
   collected name; a name that is not a JavaScript identifier, as every Domain class name is
   (`Catalog.ImportAggregate`), is exported by alias (`exportClass`, lines 181-188).
4. `Cloudflare.Website.Vite(id, props)` takes no implementation. It calls the props-only `Worker(id, props)` with
   `main` cleared and `vite: { main, rootDir, memo, viteEnvironments }` set (`Website/Vite.ts` lines 295-306 at
   beta.87, 295-306 on main). A Worker with `vite` set gets its source from `makeViteSource`
   (`Workers/Source.ts` line 400 at beta.87, 433-439 on main), not from Rolldown, so no generated entry is written.
   Its docs allow a custom `main` that re-exports Durable Object classes (`Website/Vite.ts` lines 93-110 on main), but
   those are classes written by hand in that module; nothing hands the module the classes the Domain host declares at
   runtime. A Worker declared without an implementation is marked `isExternal` (`packages/alchemy/src/Platform.ts`
   lines 356-371 on main), so its source context carries `entry: { kind: "external" }` (`Workers/Source.ts` lines
   471-473 on main), and `makeViteSource` never reads the entry or the Worker's `exports` (`Workers/Sources/Vite.ts`
   lines 329-435 on main, 392 onward at beta.87). The `vite` prop itself is marked `@internal` (`Workers/Worker.ts`
   lines 697-698, both refs), so giving it to an Effect-native Worker is not a supported path.

So the app's `Website.Vite` Worker, whose `main` is a plain `export default { fetch }` module
(`apps/inventory/src/server/worker.ts` line 39), cannot host the model's classes.

**The smallest arrangement that works**, as the upstream example does it (`examples/cloudflare-domain`, identical at
both refs except one Stripe file): an Effect-native `BankWorker` hosts the model on `layerDurableObjects()` and serves
the Apis (`packages/server/src/BankWorker.ts` lines 26-77); the Stack deploys it, then a Vite-built website Worker
(`Cloudflare.Website.Foldkit("BankApp", { main: "src/worker.ts", env: { BANK: bank }, assets: { runWorkerFirst:
["/api", "/api/*"] } })`, `alchemy.run.ts` lines 25-30) whose plain module forwards every `/api` path to
`env.BANK.fetch(request)` over the service binding and serves the build otherwise
(`packages/web/src/worker.ts` lines 10-15). One origin for both, so the session cookie is first-party. The service
binding is the yielded Worker itself in the website's `env`: any Worker resource is a binding value
(`Workers/Worker.ts` lines 155-157 on main).

**One Worker is also possible, without Vite.** An Effect-native `Cloudflare.Worker` takes the same `assets` prop as
any Worker: a directory, `{ directory, runWorkerFirst, notFoundHandling, … }`, or `{ directory, hash }` from a build
(`Workers/Worker.ts` lines 673-696, both refs). Plans hash the directory, so a changed build redeploys; requests are
served assets-first unless `runWorkerFirst` sends them to the Worker. Its `main` is bundled by Rolldown, which writes
the generated entry with the model's classes. `Website.StaticSite` shows how to feed it: a `Command.Build("Build", {
command, cwd, memo, outdir, env })` whose `outdir` and `hash.output` become `assets: { directory, hash }`
(`Website/StaticSite.ts` lines 289-371 on main). A class's props may be an Effect (`Workers/Worker.ts` lines
2951-2962 on main), which is where such a build would be yielded; not tried. Both arrangements are laid out for this
app under "In this app".

**`DomainCloudflare.providers()`.** A Layer that registers the `Cloudflare.Domain.Backfill` resource provider. A
deploy that adds a view or projection waits through it. Without it the deploy fails: no provider handles
`Cloudflare.Domain.Backfill`.

**The classes a model becomes.** Every name is `<Model>.<Class>`, with any character outside `A-Za-z0-9_.`
replaced by `_` (`className`). For a model named `Catalog`:

| Model part | Class | One object per |
| --- | --- | --- |
| aggregate `Import` | `Catalog.ImportAggregate` | instance id (`imp_…`) |
| view `ImportSummary` | `Catalog.ImportSummaryView` (and `…ViewV<n>` after a rebuild), plus `Catalog.ImportSummaryViewRun` | view key; the run class holds the backfill's root (`~run`), relays and scanners |
| projection `ItemRows` | `Catalog.ItemRowsProjection` (`…V<n>`), plus `Catalog.ItemRowsProjectionRun` | projection key, holding that key's input log |
| policy `CreateItems` | `Catalog.CreateItemsPolicy` | policy key (by default per source instance) |
| stream `ImportFeed` | `Catalog.ImportFeedStream` | stream key |
| the backfill directory | `Catalog.DomainDirectory` | directory node (`node:<path>`) |
| saga `ReturnStock` | `Catalog.ReturnStockWorkflow`, a class of the workflow engine | saga run |
| the deploy's backfill | a Cloudflare Workflow `Catalog.DomainBackfill` and an Alchemy resource `Catalog.DomainBackfillRun` | deploy |

A [query](./query.md) has no key and no object: it runs in the Worker, where D1 is bound.

**`renamedFrom` and `legacyData`.** Domain version 0 (`DOMAIN_VERSION = 0`) is the layout that names classes after
the model. A Worker deployed before it named a class after the definition alone (`ImportAggregate`); the next deploy
gives each model's class `renamedFrom: "<old name>"`, so Cloudflare's rename keeps every object. When two models in
one Worker shared an old class, only one can take it over: the deploy fails with `DurableObjectRenameConflict` until
the others pass `legacyData: false` to their `layer`. Nothing of this app was ever deployed under the old layout, so
both are inert here.

**What one aggregate instance stores**, all through `state.storage.get/put/delete/list/transaction` (the key-value
calls; Domain issues no SQL of its own). Sequence numbers in keys are padded to 12 digits so they list in order.

| Key | Holds | Written | Deleted |
| --- | --- | --- | --- |
| `event:<seq>` | one stored event and its envelope | each accepted command, one key per event, all in one multi-key `put` | never |
| `meta` | `{ state, version }` | each accepted command | never (overwritten) |
| `receipt:<commandId>` | the command's result: `{ stream, version, events, reply }`, so `events` is a second copy of every event the command recorded | each accepted command | never |
| `routed` | per consumer, the version sent live | each accepted command | never (overwritten) |
| `outbox:<n>` | one delivery (event, envelope, target, key) waiting to be sent | staged in the commit's transaction, one per event per consumer key, in one multi-key `put` | each row after its delivery succeeds |
| `outbox-seq` | the outbox counter | each commit that stages rows | never |
| `outbox-lease` | the drain lease (expiry time) | each drain | at the end of each drain |
| `armed:<name>` | a [scheduled command](./deadlines.md)'s latest arming: command id and due time | on schedule | never |
| `scheduled:<name>` | the job token of the arming that may run, or `cancelled` | on schedule, set to `cancelled` on unschedule | after the scheduled command commits |
| `registered`, `bf:id` | that the instance is listed in the backfill directory, and under which id | beta.87: before the first command is decided, accepted or not; main: `bf:id` in the first commit, `registered` after the listing job | never |
| `bf:job:<id>`, `bf:tick`, `bf:tick-progress` and other `bf:` keys | backfill jobs and the alarm tick that runs them; a source's read state when a consumer is added later | backfill work (and on main the listing job) | each job when done |

A rejected command writes no event, state or receipt, so a rejected command id is decided again if it is sent again
(on beta.87 the instance's very first command still lists it in the directory). Events, receipts, `routed`,
`outbox-seq`, `armed:` and the directory listing are never deleted. Durable callbacks (the outbox backstop,
schedules, the backfill tick) are kept by Alchemy's scheduler in the object's own SQLite tables
(`alchemy_alarm_callbacks`, in the `alchemy` package's `src/Workers/Workerd/DurableObjectAlarmStorage.ts` lines
40-58 at `2.0.0-beta.87`). Other objects keep: views `snapshot`, `entry:<seq>`, an `in:<n>` log of every delivery
applied and `in-seq`; projections `meta` (accepted, processed, per-source intake and checkpoints), an `in:<n>` log of
every delivery accepted, `drain-progress` and `drain-lease`; policies `seen:<source>:<seq>` per delivery and an
`inbox:` queue (with `inbox-seq` and `inbox-lease`); streams `meta` and `entry:<seq>`. The `in:` logs and `seen:` keys
are never deleted, except when a rebuilt generation clears an older one.

**Deliveries, retries and leases.** The values, all in `packages/domain/src/DurableObjects.ts` unless named; the same
values on main:

| Name | Value | Used for |
| --- | --- | --- |
| `TRANSIT_RETRY` | `min(exponential 100 ms, spaced 2 s)`, 35 retries: about a minute | every call between objects, and the Worker's forward of a live read's upgrade; rides out a deploy's rollout |
| `LEASE_MS` | 60,000 ms | the outbox/inbox drain lease and the projection's `drain-lease` |
| queue backstop | `"10 seconds"` | a durable callback scheduled with every staged batch of rows, so the drain runs even if the object dies before its `kick` |
| `PROJECTION_RETRY_MS` | 10,000 ms | how long a failed projection run waits; also the minimum backstop after an input (`max(batch.waitMillis, 10,000)`) |
| projection batch | `batch.size` default 1, `batch.waitMillis` default 0 | how many inputs one handler run receives |
| `POLL` | 300 ms | streamed (non-WebSocket) live reads and aggregate `changes`, by polling |
| `REGISTER_RETRY_MS` | 2,000 ms | retry of a key that could not list itself in the directory |
| `RELAY_ROOT_WAIT_MS` | 5 minutes | how long a backfill root works in one alarm |
| `TICK_RUNS`, `TICK_MILLIS` | 64 jobs, 5,000 ms | backfill jobs per alarm tick |
| `REACH_RETRIES` (`Cloudflare/index.ts`) | 3 tries, 1 s apart (constant) | each step of the deploy's backfill Workflow |
| check sleep (`Cloudflare/index.ts`) | `min(5,000, round(500 × 1.25^n))` ms | the deploy's backfill polling its runs |
| callback retry (`alchemy` package `src/Callback.ts` lines 148-151, beta.87) | from 30 s doubling; after 8 attempts without progress, hourly | a durable callback whose handler fails, on beta.87 |
| callback retry (main, `packages/cloudflare/src/Workers/AlarmCallback.ts` lines 67-75) | from 2 s doubling, then hourly, never dropped; up to 100 due jobs per alarm | the same on main, through `DurableObjectCallbacks` |

A commit stages one outbox row per delivery inside its transaction, then kicks a drain in the background. One drain
holds the lease, sends rows in order and deletes each after it succeeds, so delivery is at least once and in order
per source; a receiver drops duplicates by checkpoint (views, projections) or by `seen:` (policies). Every object
method is idempotent, which is why a failed call is retried. Calls between objects return failures as data and the
caller re-raises them as defects, because Workers RPC loses thrown errors. Commands to one instance run inside
`blockConcurrencyWhile`, one at a time.

**Live reads.** With `Domain.protocolWebSocket`, the Worker forwards each `watch` or `events` read's upgrade to the
object that owns the key, with an `x-domain-subscription` header it sets itself (overwriting any the client sent),
retrying until the object answers 101. View and stream objects accept the socket as a hibernatable WebSocket, keep
`{ key, subscription }` as its attachment, push the first value at once and every later commit as it lands, and
hibernate in between. Messages from the client are ignored. Aggregate state has no socket: its `changes` poll every
300 ms. See [reads-and-consistency.md](./reads-and-consistency.md) and [api.md](./api.md).

**A fresh deploy.** The Worker upload exports every class (SQLite-backed, Alchemy's default for a new class). A deploy
that adds a view or projection, or bumps its version, starts the `DomainBackfill` Workflow and waits until each new
consumer has read the history before it (see [backfill.md](./backfill.md)); a model with no history has nothing to
read. Not verified: whether the very first deploy of a model starts a run at all. After a deploy, an object can start
on Alchemy's placeholder script, which resets itself; a stub retries that case only, exponential from 200 ms capped at
2 s, 20 times, about 35 seconds (`Workers/Rpc.ts` lines 73-85, both refs). An object that stays busy is another case:
by default Cloudflare lets it keep running the previous code for up to 5 minutes (`codeUpdateStrategy`, default
`{ mode: "deferred", maxDelay: "5 minutes" }`, `Workers/Worker.ts` lines 107-131 and 836-850 on main, 847 at
beta.87); an object idle for about 10 seconds starts on the new code at its next call. Until then a call to a method
only the new code has fails with `RpcCallError` ("The RPC receiver does not implement the method"), and nothing
retries it (`Workers/DurableObject.ts` lines 725-736, both refs). `codeUpdateStrategy: { mode: "immediate" }` on the
model's Worker moves every object at once. Domain retries its own calls (`TRANSIT_RETRY`); a test's first request
should retry too.

Checked in (at `v2.0.0-beta.87`):
- `packages/domain/src/Cloudflare/index.ts` lines 63-74 (namespace), 91-95 (`declare`), 98-124 (placement), 127-152
  (object state: `storage`, `blockConcurrencyWhile`, `waitUntil`, sockets), 169-205 (`connectTo`), 220
  (`REACH_RETRIES`), 227-232 (`renamedFrom`), 235-244 (`cloudflareHost`, `Layer<Platform, never, Worker |
  SecureRandom>`), 258-259 (class names), 284-298 (saga classes), 300 (`claimKey: CloudflareWorker`), 303-398 (deploy
  backfill: `DomainBackfill` Workflow 305-306, `DomainBackfillRun` 385, check sleep 373-377), 505-543
  (`layerDurableObjects`, requirements at 509-513, shared Layer at 518), 550-561 (saga engine), 597-641
  (`DurableObjectsOptions`, default `"30 minutes"` at 638).
- `packages/domain/src/Cloudflare/Providers.ts` lines 7, 9, 40-45; `packages/domain/src/Cloudflare/Version.ts` lines
  10, 19-21; `packages/domain/src/Cloudflare/Backfill.ts` lines 106-115 (`BackfillStillRunning`, `BackfillFailed`).
- `packages/domain/src/DurableObjects.ts` lines 74-102 (`ListOptions`, `ObjectStorage`), 205 (`pad`), 227-263
  (`reportDefects`, `TRANSIT_RETRY`, `unwrapDefects`), 286-295 (`consumerClass`, `runClass`), 319 (`CANCELLED`), 328
  (`LEASE_MS`), 337-387 (`queue`, backstop at 380), 392-491 (live reads), 496-506 (`clearPrefixes`, pages of 128 at
  501), 515-516, 705-749 (`RELAY_ROOT_WAIT_MS`, `RUN_ROOT`, `REGISTER_RETRY_MS`, `ensureRegistered`), 751-950 (aggregate
  object: commit 802-854, receipt with its `events` 820-828 and 838, events 831-833, outbox stage 849, schedules
  873-937), 952-1202 (view object, `in:` log 1010-1017), 1204-1227 (policy, `seen:` 1216-1217), 1230-1458 (projection:
  `PROJECTION_RETRY_MS` 1253, batch 1280-1282, `drain-progress` 1293-1299, drain 1302-1346, intake 1355-1388), 1460-1544
  (stream), 1547 (`POLL`), 1789 (`DomainDirectory`), 1823, 1896, 1907, 2018-2030, 2047, 2116 (class names), 2152-2153
  (`className`).
- `packages/domain/src/Backfill.ts` lines 387 (`DEPTH = 2`), 398 (`leafSize: 256`), 416-417 (`leafOf`), 450
  (`parentOf`), 1401-1440 (a projection key's first delivery), 1597-1615 (`register`: `i:<ref>` and `count`, a leaf
  splits into 16 past 256 rows).

### Types and helpers

`packages/domain/src/DurableObjects.ts` (importable as `@alchemy.run/domain/DurableObjects`) is shared by the
Cloudflare, Rivet and Effect Cluster hosts. None of its exports is marked `@internal`, but all are host plumbing:
application code never calls them.

| Name | What it is | Where (beta.87; main) |
| --- | --- | --- |
| `ListOptions` | options of `ObjectStorage.list`: `prefix`, `start`, `startAfter`, `end`, `limit`, `reverse` | 74-87; 80 |
| `ObjectStorage` | an object's key-value storage: `get`, `put` (one or many), `delete` (one or many), `list`, `transaction` | 94-102; 100 |
| `ObjectSocket` | a live read's WebSocket held by an object: `send`, `close`, `serializeAttachment`, `deserializeAttachment` | 105-111; 111 |
| `ObjectStateShape` | what an instance runs against: `storage`, `exclusive`, `waitUntil`, optional `sockets` (`accept`, `all`) | 114-136; 120 |
| `ObjectState` | the service tag for `ObjectStateShape`, `"alchemy/Domain/ObjectState"` | 139-141; 145 |
| `Stub` | one object: every method a call returning an Effect | 144-146; 150 |
| `Namespace` | every object of one class, by name (`getByName`) | 149-151; 155 |
| `InstanceServices` | what an instance runs with: `ObjectState`, `RuntimeContext`, `Scope`; main adds `Callbacks` | 154; 160 |
| `ObjectImpl` | an object's implementation: built once per instance, returns its methods | 162; 168 |
| `Host` | what a runtime supplies: `declare`, optional `lookup`, `hosted`, `connect`, `backfill`, and `claimKey` | 169-203; 175 |
| `TRANSIT_RETRY`, `unwrapDefects` | the retry above, and calling an object with it (a reported defect dies on the caller) | 241-263; 247, 259 |
| `consumerClass`, `runClass`, `generationOfTarget`, `runClassOfTarget` | class names of a view or projection generation (`DepositsViewV1`), its run class (`…Run`), the generation in a target id (`view:Name#2` is 2), and a target's run class | 286-306; 292-310 |
| `Attachment`, `SUBSCRIPTION_HEADER` | the schema `{ key, subscription }` a live read's socket carries, and the header `"x-domain-subscription"` that brings it | 392-401; 398-407 |
| `PlanOf`, `plansOf` | a consumer's backfill plan by target, and the plans of several targets | 658-668; 670-673 |
| `RUN_ROOT` | `"~run"`, the object at the root of a consumer's backfill run | 708; 720 |
| `makePlatform` | builds the `Platform` from a `Host`: every object kind, the directory and the deploy's backfill | 1620; 2081 |
| `multiplexedName`, `parseMultiplexedName` | `Bank.AccountAggregate/a-1`, the name of an object in hosts that keep a model in one class (Rivet, Effect Cluster), and its inverse | 2148-2161; 2666-2677 |
| `className` | `Model.Name` with characters outside `A-Za-z0-9_.` replaced by `_` | 2152-2153; 2670-2671 |
| `Alarm`, `alarmCallbacks` | one alarm per instance (`set`, `get`), and durable callbacks built on it for hosts without their own (Rivet, Effect Cluster) | 2164-2167, 2202; 2682-2685, 2719 |

From `@alchemy.run/domain/Cloudflare`: `layerDurableObjects`, `DurableObjectsOptions`, `providers`, `Providers`
(the provider collection tag `"Domain.Cloudflare"`), `ProviderRequirements` (the services `providers()` needs),
`Backfill` (the deploy's backfill resource), `BackfillStillRunning`, `BackfillFailed`. From `Cloudflare/Version.ts`:
`DOMAIN_VERSION` (0) and `DeployVersion`, a `Context.Reference` defaulting to it (internal: tests set `undefined` to
deploy the old layout).

### What main changes

- **Callbacks come from a Layer** (commit `97ff09fca`, #3215). On main the host provides `DurableObjectCallbacks` to
  every object and to the saga engine (`packages/domain/src/Cloudflare/index.ts` lines 1-4, 160-166, 560-567).
  Instance services gain `Callbacks` (`packages/domain/src/DurableObjects.ts` line 160). A dying callback is
  redelivered from 2 seconds doubling, then hourly, and never dropped (`packages/cloudflare/src/Workers/AlarmCallback.ts`
  lines 67-75). At beta.87 Alchemy's built-in callbacks ran them, from 30 seconds doubling, hourly after eight
  attempts. The docs say Domain models need no change.
- **Directory listing after the commit.** At beta.87 an instance lists itself in the directory before its first
  commit, so a new instance's first command waits on that call. On main the commit stores `bf:id` and a `bf-register`
  job, and the call happens after the reply, retried every 2 s until it succeeds (`DurableObjects.ts` lines 752,
  758-799, 976; views at 1604). Commit not known.
- **Decisions** (commit `dbda8cc16`, #3420). Main adds [decisions](./decision.md): no object of their own; the first
  aggregate instance a decision reads runs a two-phase commit across the instances it reads. New aggregate keys:
  `intent`, `decided:<id>`, `tx:<txId>`, and `meta.held`. New methods `txDecide`, `txOutcome`, `txRead`, `txPrepare`,
  `txCommit`, `txAbort` (lines 1330-1390). New constants `RESUME_AFTER_MS` (2,000 ms, line 828), `HELD` (exponential
  10 ms capped at 250 ms, 60 times, about 13 s, line 838), `PEER_RETRY` (exponential 50 ms, 4 times, line 855). A
  command that finds its instance held waits (`whenFree`, line 1204), and dies with `InstanceHeld` if it stays held.
  The docs table on main adds the decision row and a guarantee.
- **The Rivet/Cluster alarm scheduler** (`alarmCallbacks`) lost its retry options; it now redelivers from 2 seconds
  doubling up to an hour (lines 2708-2838). It does not run on Cloudflare.
- Nothing else in `Cloudflare/index.ts`, `Providers.ts` or `Version.ts` differs; the storage keys and constants above
  are the same.

## Rules, and the mistakes to avoid

- Host the model in an Effect-native `Cloudflare.Worker` class. Providing `layerDurableObjects()` inside a plain
  `export default { fetch }` module, or inside `Cloudflare.Website.Vite`, does not give it the `Worker` service, and
  even with it the Vite bundle would not export the classes.
- Register `DomainCloudflare.providers()` next to `Cloudflare.providers()` in the Stack that deploys that Worker.
- Never rename the model. Classes are named after it, so a renamed model starts empty under new classes. The same for
  adding `jurisdiction` after data exists.
- Keep one command's events small. Cloudflare's documentation (read 2026-11-19) gives 8 MB for a key and value combined
  on the SQLite backend (https://developers.cloudflare.com/durable-objects/platform/limits/). Measured on
  2026-11-20 through this host in local workerd: an aggregate's state of 8.3 MB was stored and the command that
  would take it to 8.5 MB failed with `string or blob too big: SQLITE_TOOBIG`
  ([the trial](../07-review-decisions-trial.md), trial 1). The 2 MiB in the library's cluster package is that
  package's own guard, not this host's. A deployed object was not tried. Each event is one value,
  and the command's receipt is one value that holds every event of the command again. So the sum of one command's
  events must stay under 8 MB: a confirm of 50,000 rows at about 400 bytes a row (about 20 MB) cannot be one command,
  however it is split into events. Carry the rows in chunks of several commands, or keep them out of the events
  altogether ((a2) and (a1) under "In this app").
- Keep the number of events in one command, and of deliveries in one commit, at 128 or fewer. A commit writes all its
  events in one multi-key `put`, and stages all its deliveries (events × consumer keys) in another; Cloudflare's SQLite
  storage API documentation says a multi-key `put` takes up to 128 pairs
  (https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). Not tried: what a larger commit does.
- Do not send one command per item from one object in one invocation: Cloudflare's documentation gives 10,000
  subrequests per invocation by default on Workers Paid and 50 on Free
  (https://developers.cloudflare.com/workers/platform/limits/). Not verified: that each call to another Durable Object
  counts as one subrequest.
- Do not key a projection so that tens of thousands of objects deliver to one key at once: Cloudflare documents a
  soft limit of 1,000 requests per second per object.
- Nothing is ever deleted from an aggregate's `event:` and `receipt:` keys or a projection's `in:` log. Budget
  storage for it: about three copies of every event's payload (event, receipt, projection log). Cloudflare documents
  10 GB per object on Workers Paid and 1 GB on Free.
- Do not count on `alchemy dev` for jurisdictions or location hints; it runs everything on one machine.
- Keep object methods compatible across a deploy. A busy object runs the previous code for up to 5 minutes (above):
  add a method, ship its callers in a later deploy, remove the old one last. A deploy that creates, renames or deletes
  a Durable Object class (a new view or projection, a version bump) must go out at 100 %: a gradual rollout
  (`version.traffic` below 100) cannot carry it (`Workers/Worker.ts` lines 411-416 on main).
- Nothing disposable in the model Worker's constructor Effect. It is built once per isolate and its scope is never
  closed, so a finalizer added there never runs; each fetch, RPC call or alarm gets its own scope, closed after the
  answer through `waitUntil` (`Workers/Worker.ts` lines 2601-2627 on main).
- To serve an Effect `HttpApi` from the model's Worker, provide `Http.Platform` from `alchemy/Http`: it gives the
  `HttpPlatform`, `Etag`, `Path` and a no-op `FileSystem` that `HttpApiBuilder.layer` needs. A file response dies
  there and compression never engages (`packages/alchemy/src/Http.ts` lines 233-265, both refs); a handler's defect
  becomes an empty 500 and is logged (`safeHttpEffect`, from line 76).

## In this app

**What a confirm becomes, counted.** "The import is one aggregate and items stay rows in D1" has more than one form,
and so has "every item is its own aggregate". [projection.md](./projection.md) names the same options under the same
labels and says what each means for a confirm being all-or-none, for what the person sees and for a replay; this page
counts what each costs. Which to build is the app owner's decision.

Everything below is arithmetic from the source above and Cloudflare's documentation as read on 2026-11-19
(https://developers.cloudflare.com/durable-objects/platform/pricing/ ,
https://developers.cloudflare.com/durable-objects/platform/limits/ ,
https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ ,
https://developers.cloudflare.com/d1/platform/limits/ , https://developers.cloudflare.com/workers/platform/limits/ ),
not a measurement. Nothing here was deployed or run.

Inputs from Cloudflare's pricing page: requests include RPC sessions and alarm invocations, and every RPC method call
on a stub is one request (a call between objects is one native RPC call per method, `Workers/Rpc.ts` lines 34-92);
key-value calls (`put`, `delete`) are billed as rows written, deletes included; each `setAlarm` is one row written;
Workers Paid includes 1 million requests and 50 million rows written a month, then $0.15 per million requests and
$1.00 per million rows, with billable usage rounded up to the next million; Free gives 100,000 requests and 100,000
rows written a day; stored data is 5 GB-month included, then $0.20 per GB-month.

Assumptions (not from source or documentation): each key put or deleted is one row written; scheduling a durable
callback writes one row; a row of the file is about 400 bytes as JSON; a small event (ids, counts, a digest) and its
envelope are about 1 KB; a 50,000-row file has the sample's share of ready rows (155 of 200), so 38,750 items; every
consumer is caught up (no backfill running); the projection's batch size is the default 1, and each delivery gets its
own drain. The D1 writes a confirm makes today (items, outcomes, changes, the search index) are the same in every
option and are not counted; D1 rows an option adds (a plan, a holding table) are counted but not priced.

Two counts used throughout (arithmetic). Per command with one event and one consumer key, aggregate rows = event 1 +
meta 1 + receipt 1 + routed 1 + outbox row 1 + `outbox-seq` 1 + backstop callback 1 + lease put 1 + outbox row
delete 1 + lease delete 1 = 10. Per delivery to the projection: `bf:id` 1 + `in:` 1 + meta 1 + `drain-progress` 1 +
backstop callback 1 + lease put 1 + meta after the run 1 + lease delete 1 = 8. Backstop alarms: each object's backstop
is one callback, rescheduled with every staging, so at least one alarm fires per object and at most one per staging.
The first delivery to a new projection key also does a one-time backfill check (a call to the run's root, or for a
key keyed by its own source a read of that source), not counted.

**(a1) The event names a plan staged in D1.** The confirm handler runs `review` on the stored rows as today, writes
the planned rows (with their item ids and the audit line's id) to a D1 table keyed by the confirm's id, then sends
ONE command; the `Import` aggregate records ONE small event (the confirm's id, the counts, a digest); a projection
keyed by the import writes the items, outcomes, changes and audit line in one D1 batch. One command and one small
event whatever the file's size, so the Durable Object figures do not grow with the file.

| At the confirm, (a1) (arithmetic) | Sample: 200 rows, 155 items | 50,000 rows, 38,750 items |
| --- | --- | --- |
| commands, events | 1, 1 | 1, 1 |
| largest Durable Object value | the event and its receipt, about 1 KB each | the same |
| aggregate + projection rows written | 10 + 8 = 18 | 18 |
| Durable Object requests: command + delivery + backstop alarms | 1 + 1 + 2 = 4 | 4 |
| objects touched | 2 | 2 |
| kept for ever in objects: event + receipt + projection log | 3 × 1 KB = 3 KB | 3 KB |
| D1 plan rows written | 200 | 50,000 |
| D1 plan bytes, kept as long as their events if a replay is wanted | 200 × 400 B = 80 KB | 50,000 × 400 B = 20 MB |
| D1 batches | the plan's, then the projection's: 2 | 2 (the plan in statements of at most 500 rows, `chunkRows`: at least 100) |

Cost (arithmetic): 4 requests and 18 rows written per import of any size; on Free, 100,000 / 18 = about 5,555 imports
a day by rows written and 100,000 / 4 = 25,000 by requests. Stored data in objects: 5 GB / 3 KB = 5,000,000 KB / 3 KB,
about 1.6 million imports in the included 5 GB-month. The plan's bytes sit in D1, under D1's own limits and pricing
(not priced here), and a plan that is never confirmed needs sweeping.

**(a2) The events carry the rows, in chunks.** One `ConfirmRows` command per chunk of rows (each recording one
`RowsConfirmed` event with each row's outcome and the item values of ready rows), then one closing `CloseImport`
(recording `ImportConfirmed`). Each command has its own command id, so a stopped confirm is resumed by sending the same
commands again. Two limits set the chunk size:

- One stored value is at most 8 MB (Cloudflare's limits page above, key and value combined on the SQLite backend). A
  chunk's event is one value and the command's receipt, which repeats the command's events, is another; each holds
  the chunk's rows. So rows per chunk ≤ 8 MB / bytes per row: at 400 B, 8,000,000 / 400 = 20,000; at the 600
  characters per item the adapter counts at least (`textOf`, `packages/catalog/host/src/ImportStore.adapter.ts`
  61-68), 8,000,000 / 600 = about 13,333. A chunk of 1,000 rows is 400 KB, a twentieth of the limit.
- One multi-key `put` takes at most 128 pairs (Cloudflare's SQLite storage API page above). A commit puts all its
  events in one `put` and stages all its deliveries (events × consumer keys) in another
  (`packages/domain/src/DurableObjects.ts` lines 829-849 at beta.87). With one event per chunk and one consumer key
  this does not bind; it would cap a chunk at 128 rows if each row were its own event, and fewer with more consumers.

The projection then either writes each chunk as it arrives (one D1 batch per chunk) or holds the chunks and writes once
on the closing event. A projection keeps nothing between runs but its store, so "holds" means it writes each chunk to
a holding table in D1 (idempotent by the event's `stream:seq`) and, on `ImportConfirmed`, writes everything in one
batch from it.

| At the confirm, (a2) with chunks of 1,000 (arithmetic) | Sample: 200 rows, 155 items | 50,000 rows, 38,750 items |
| --- | --- | --- |
| commands, events | 1 chunk + 1 close = 2, 2 | 50 chunks + 1 close = 51, 51 |
| largest Durable Object value | the chunk event and its receipt, 200 × 400 B = 80 KB each | 1,000 × 400 B = 400 KB each |
| aggregate rows written | 2 × 10 = 20 | 51 × 10 = 510 |
| projection rows written | 2 × 8 = 16 | 51 × 8 = 408 |
| Durable Object requests: commands + deliveries + backstop alarms | 2 + 2 + (2 to 4) = 6 to 8 | 51 + 51 + (2 to 102) = 104 to 204 |
| objects touched | 2 | 2 |
| kept for ever in objects: events + receipts + projection log | 3 × 80 KB = 240 KB | 3 × 50 × 400 KB = 60 MB |
| D1, writing each chunk | 2 batches | 51 batches, each of up to 1,000 rows |
| D1, holding the chunks | 200 holding rows, then 1 batch | 50,000 holding rows, then 1 batch |

Cost (arithmetic): a 50,000-row import is at most about 204 requests and 918 rows written, against 1 million requests
and 50 million rows written a month on Workers Paid, and 100,000 of each a day on Free (about 108 such imports a day
by rows written: 100,000 / 918). Storage is the cost that grows: 60 MB per 50,000-row import kept for ever, so about
83 such imports fill the 5 GB-month included (5,000 MB / 60 MB), and each one after that costs 0.06 GB × $0.20 =
$0.012 a month.

**(a3) Re-run `review` inside the projection.** Set aside: `review` reads the stored items, which differ at replay
time, so a replay would not write what the confirm wrote. Not counted.

**(b) Every item is its own aggregate.** An `Item` aggregate keyed by organization and `skuKey`, fed by a policy
`CreateItems` that turns a confirm into one `CreateItem` command per ready row (from the chunk events under (a2), or
by reading the plan from D1 under (a1); a projection never sends commands), and `ItemRows` keyed by item (so 38,750
objects do not all deliver to one key). Its figures add to those of the (a1) or (a2) it sits on. Per item (arithmetic,
beta.87): item object rows = `registered` + `bf:id` 2 + the 10 of a one-event command = 12; directory leaf rows =
`i:<ref>` + `count` = 2; projection key rows = 8; total 22. Requests per item = the policy's command 1 + the item's
directory listing 1 + its delivery 1 + the item's backstop alarm 1 + the projection key's backstop alarm 1 = 5. Not
counted: each item's projection key is new, and its first delivery takes the backfill's follow path (for a key keyed
by its own item: a buffered copy, a job, an alarm, and a read of the item's log), so at least 2 more requests and
several more rows per item. The figures are lower bounds.

| Per import, (b) (arithmetic) | Sample: 155 items | 50,000 rows: 38,750 items |
| --- | --- | --- |
| Durable Object requests, counted (5 per item) | 775 | 193,750 |
| with the first-delivery setup (at least 7 per item) | at least 1,085 | at least 271,250 |
| rows written, counted (22 per item) | 3,410 | 852,500 |
| item objects created, kept for ever | 155 | 38,750 |
| projection objects | 155 | 38,750 |
| directory leaves hit (256 × (1 − (255/256)^n)) | about 116 of 256 | 256, 38,750 / 256 = about 151 rows a leaf, under the 256 that splits one |
| directory objects (root, `Item:`, 16 one-digit nodes, the leaves) | about 1 + 1 + 16 + 116 = 134 | 1 + 1 + 16 + 256 = 274 |

Cost of the 50,000-row file (arithmetic): within Workers Paid's month, the requests allowance covers at most 3 such
imports (1,000,000 / 271,250 = 3.7) and rows written at most 58 (50,000,000 / 852,500 = 58.7). Past the allowance, one
such import rounds up to one more million of each: $0.15 + $1.00. On Free one such import does not fit in a day,
neither by requests nor by rows written (100,000 each). Duration (GB-s) is not estimated for any option: it depends on
how long each object stays active, which only a measurement shows. Limits that bite in (b) and not in (a1) or (a2): a
policy keyed by its source (the default) is one object per import that drains its inbox in one invocation, so it would
send all 38,750 commands from one invocation, past the 10,000-subrequest default if each counts; key the policy per
chunk instead (a `key` declared as a string Schema and a `keyOf` that names the chunk, `packages/domain/src/Policy.ts`
lines 98-104). Item edits become commands to the item's object; the Items page, paging and search still need the D1
rows the projection writes. Under (a1) and (a2), rule 3 (the SKU key is unique per organization) and rule 4 (take-back
only of items at revision 1) stay where they are enforced today, in D1.

**Where the model runs: two arrangements.** Today one `Cloudflare.Website.Vite("Website", { main:
"src/server/worker.ts" })` serves the screens, Better Auth and the API (`packages/infra/src/Inventory.stack.ts` lines
102-130; `apps/inventory/src/server/worker.ts` line 39). Either arrangement needs, in the stack, `providers:
Layer.mergeAll(Cloudflare.providers(), DomainCloudflare.providers())` (line 59 today has only the first), and the one
`Cloudflare.D1.Database("Database")` bound where the model runs: the model's Worker yields
`Cloudflare.D1.QueryDatabase(yield* Database)` with `Cloudflare.D1.QueryDatabaseBinding` provided, as the bank example
does (`examples/cloudflare-domain/packages/server/src/Ledger/D1LedgerStore.ts` line 16, `BankWorker.ts` line 40). The
database is declared inside the stack's Effect today, with stage-dependent `importFiles` (`Inventory.stack.ts` lines
65-68); an Effect-native Worker class lives in its own module, so the declaration moves to a module the stack and the
class both import. In both, the model's Worker resolves the actor itself from the session cookie, with the same Better
Auth on the same D1, so no organization or member id ever arrives in a header.

| What changes | (1) Two Workers: the site's Worker as it is, and an Effect-native Worker that hosts the model, reached by a service binding | (2) One Effect-native Worker that hosts the model, serves the API and serves the built screens as assets |
| --- | --- | --- |
| `packages/infra/src/Inventory.stack.ts` | Yield the model's Worker class (the sketch above), then keep `Website.Vite` and add `DOMAIN: domain` to its `env`; give the model's Worker `workersDev: false` (a real prop at both refs: `false` is no `workers.dev` URL at all, `Workers/Worker.ts` lines 626-638) and no domain | `Website.Vite` goes. The Effect-native Worker takes its props (`compatibility`, `observability`, `workersDev` or `domain`, the `env` built from the stage plan) and `assets: { directory, hash, notFoundHandling: "single-page-application", runWorkerFirst: ["/api/*"] }` from a `Command.Build` of the screens, as `StaticSite` does; the stage plan's settings move into the class's props Effect |
| `apps/inventory/src/server/worker.ts` | Unchanged for the screens, Better Auth and today's API; it forwards the model's paths to `env.DOMAIN.fetch(request)`, as the example's web Worker forwards `/api` | Replaced by the class's Effect `fetch`, built with Rolldown. `import.meta.env.PROD` and `DEV` are Vite's (used in `worker.ts`, `App.ts`, `security.ts`, `RequestTelemetry.ts`) and need another source. `WorkerEnvironment` and `WorkerExecutionContext` (whose `raw` is the native context, `Workers/WorkerRuntime.ts` lines 120-176) give the raw `env` and `ctx` Better Auth and `waitUntil` take today |
| `apps/inventory/vite.config.ts` | Unchanged | Builds the screens only: `cloudflare()` (line 143) leaves the build; `screenPackages` and the client build stay |
| `apps/inventory/wrangler.jsonc` | Unchanged; it describes only the site's Worker, which is all `@cloudflare/vite-plugin` runs | No longer describes what is deployed; kept only if `bun run dev` keeps the Vite plugin |
| Local development, `bun run dev` (`predev` migrations, then `vite`, `apps/inventory/package.json` lines 8-9) | `vite` alone runs the plain module with no `DOMAIN` binding and no model classes. Either `alchemy dev` runs both Workers and their objects in local workerd, or the plain Worker hosts the model on `Domain.InMemory` for screen work, with nothing durable | `bun run dev` stops being one Vite process: the Worker runs under `alchemy dev` (Rolldown, local workerd), and the screens' dev server runs beside it with `/api` sent to the Worker |
| Slow tests (`apps/inventory/test/server/support/app.ts`: `makeApp` on a local D1 from wrangler's platform proxy, called through `toFetch`, never through `worker.ts`) | Unchanged for today's API; the model joins `makeApp` on `Domain.InMemory` with its projection's D1 adapter on the test D1 | The same, provided `makeApp` stays a Layer the tests compose rather than moving inside the Worker class |
| Behaviour only Durable Objects have (outbox, retries, live reads) | `@alchemy.run/test/Vitest`'s `make` (`packages/alchemy-test/src/Vitest.ts` line 106 at beta.87) with `dev: true`: the [Cloudflare tutorial](./cloudflare-tutorial.md)'s parts 3 and 4, [test-tooling.md](./test-tooling.md) | The same |
| Not verified | That the forwarded request keeps the session cookie and Better Auth resolves the same actor in the model's Worker; that `Website.Vite`'s `env` takes an Effect-native Worker class as it takes one in `Website.Foldkit`; what Alchemy does if the database ends up declared twice with different props; that `alchemy dev` applies the D1 migrations `predev` applies today | That the app's server modules bundle under Rolldown unchanged; that `Command.Build` can feed an Effect-native Worker's props; that a raw-`env` handler can delegate to today's plain handler; how `alchemy dev` and Vite's dev server run side by side for this app |

In (2) one Worker holds everything, so a deploy that adds a view or projection class carries the screens with it, at
100 % (Rules above).

**Where everything sits.**

| Thing | Where |
| --- | --- |
| Better Auth's tables (`user`, `session`, `account`, `verification`, `invitation`, `rateLimit`), `organization`, `member` | D1, unchanged; read by Better Auth on the D1 binding in whichever Worker resolves the actor |
| `item`, `itemSearch`, `importOutcome`, `importChange`, `activity`, `modelCall`, upload staging | D1, unchanged; under (a1) and (a2) `item`, outcomes, changes and the audit line are written by the `ItemRows` projection instead of the confirm's batch |
| the confirm's plan (a1), or the projection's holding table ((a2), holding) | D1, a new table keyed by the confirm |
| an import's events, receipts, outbox, schedules | the `Catalog.ImportAggregate` object for that import |
| the projection's input log and checkpoints | `Catalog.ItemRowsProjection` objects |
| the built screens | the site Worker's assets in (1); the one Worker's assets in (2); no Durable Object sees them |

- **Used today:** no. Every write is a guarded D1 batch behind a port (`packages/catalog/host/src/ImportStore.adapter.ts`,
  `commit`).
- **Where it goes:** an Effect-native Worker registered in `packages/infra/src/Inventory.stack.ts`, either beside the
  site's Worker (`apps/inventory/src/server/worker.ts`) or in its place; the `ImportStore` port's D1 adapter is
  replaced for the confirm and take-back by the model.
- **What the person gets:** the result and review counts pushed to the screen as they change, and a confirm that
  cannot run twice; otherwise nothing they can see.

## How to check it

- The model's [stories](./story.md) run on the in-memory host; the same model then needs no change on this host. A
  trial on 2026-11-19 ran a model of this app's import on the in-memory host only (beta.87 and main); it deployed
  nothing and did not run this host.
- A deploy whose Stack lacks `DomainCloudflare.providers()` fails with no provider for `Cloudflare.Domain.Backfill`;
  one that adds a consumer and outlives `backfillTimeout` fails with `BackfillStillRunning`.
- An integration test against the locally deployed stack (`dev: true`): confirm the sample import, then read the
  result with the receipt as `atLeast`; the three numbers must agree (200 rows in the file, the result's counts,
  155 items stored in D1). Confirm again with the same command ids: the receipts come back and nothing more is stored.
- `alchemy dev` does not show jurisdiction or placement; check those only deployed.

## What it needs

Cloudflare Workers with Durable Objects (SQLite backend, which the Free plan also has), an Effect-native Alchemy
`Cloudflare.Worker` to host it, `DomainCloudflare.providers()` in the Stack, and `@alchemy.run/domain` with
`@alchemy.run/cloudflare` at `2.0.0-beta.87` (the app's infra already pins `@alchemy.run/cloudflare` and `alchemy` at
that version; `@alchemy.run/domain` lists both as peers at that exact version). Decisions need main.

## Verdict

**Use:** host the model in an Effect-native `Cloudflare.Worker` on `DomainCloudflare.layerDurableObjects()`, with
`DomainCloudflare.providers()` in the Stack, `alchemy dev` for local work with objects and the in-memory host for
tests. Whether that Worker sits beside the site's `Website.Vite` Worker behind a service binding (1) or replaces it and
serves the screens as assets (2), and which of (a1), (a2) or (b) a confirm becomes, are the app owner's decisions;
"In this app" gives what each changes and costs.

## Where this was read

- https://alchemy.run/domain/cloudflare (the live site documents beta.87)
- `website/src/content/docs/domain/cloudflare.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed (the
  decision row and guarantee)
- `website/src/content/docs/cloudflare/compute/durable-objects.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
  (callbacks from `DurableObjectCallbacks`)
- `website/src/content/docs/cloudflare/compute/effect-workflows.mdx`, `workflows.mdx`, `add-a-workflow.mdx`,
  `cross-worker-durable-object.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/DurableObjects.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Cloudflare/index.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Cloudflare/Providers.ts`, `packages/domain/src/Cloudflare/Version.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: same
- `packages/domain/src/Backfill.ts`, `packages/domain/src/Policy.ts` at `v2.0.0-beta.87` (directory depth and leaf
  size, a key's first delivery, a policy's `key`)
- `packages/domain/skills/alchemy-domain/references/hosting.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
  (command payloads, consistency note)
- `examples/cloudflare-domain/alchemy.run.ts`, `examples/cloudflare-domain/packages/server/src/*`,
  `examples/cloudflare-domain/packages/web/src/worker.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same except
  `Settlement/StripeSettlements.ts`
- `packages/cloudflare/src/Workers/{Worker,DurableObject,Source}.ts`, `packages/cloudflare/src/Workers/Sources/{Rolldown,Vite}.ts`,
  `packages/cloudflare/src/Workers/Rpc.ts`, `packages/cloudflare/src/Website/{Vite,StaticSite}.ts` at `2.0.0-beta.87`
  (as published on npm) and on `main@dbfd0ddb`;
  `packages/cloudflare/src/Workers/{DurableObjectState,WebSocket,WorkerRuntime,AlarmCallback}.ts`,
  `packages/cloudflare/src/Workflows/Workflow.ts` on `main@dbfd0ddb` (outline)
- the `alchemy` package at `2.0.0-beta.87` (as published on npm) and on `main@dbfd0ddb`: `src/Callback.ts`,
  `src/Http.ts`, `src/Platform.ts`, `src/Workers/Workerd/DurableObjectAlarmStorage.ts`
- Cloudflare's documentation, read 2026-11-19: Durable Objects pricing, limits and SQLite storage API; Workers limits;
  D1 limits (addresses above)
- the app: `apps/inventory/src/server/worker.ts`, `apps/inventory/wrangler.jsonc`, `apps/inventory/vite.config.ts`,
  `apps/inventory/package.json`, `apps/inventory/vitest.config.ts`, `apps/inventory/test/server/support/app.ts`,
  `apps/inventory/src/server/{App,security,RequestTelemetry}.ts` (`import.meta.env`),
  `packages/drivers/d1/src/D1.test-layer.ts`, `packages/catalog/contract/src/Staging/{Upload.command,Staged.read}.ts`,
  `packages/infra/src/Inventory.stack.ts`
