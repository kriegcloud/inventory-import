---
type: Reference
title: Singletons and crons (Effect Cluster)
description: One copy of a long-lived effect across a whole cluster, and a job run once per scheduled time across it, with what each is on each host and the nearest thing on Cloudflare without a cluster; for this app, the hourly sweep of unfinished uploads and the allowance's window.
tags: [alchemy-domain, extra]
---

# Singletons and crons (Effect Cluster)

A **singleton** is one fiber that runs on one runner of a cluster: the runner that holds the lock on the shard of the
singleton's name. When that runner stops cleanly, it stops the fiber before it releases the shard; a runner that
crashes leaves its lock to lapse after 35 seconds. Another runner then takes the shard and starts the fiber again. Two
copies run at once only if a runner is paused past its lock's expiry, until its next lock refresh. A **cluster cron** is
a job run once per scheduled time across the whole cluster: Effect builds it from a singleton that schedules the first
run and a persisted message per run, delivered at its time, so a run that falls due while its runner restarts still
happens. The docs say: "A singleton is one fiber that runs on exactly one runner" [https://alchemy.run/cluster/singletons].

On Cloudflare, Alchemy's Durable Object pool runs each singleton and each cron in a Durable Object of its own, with
no runners and no database. Without a cluster, a Worker's Cron Trigger, a Durable Object's alarm, or a Domain
[deadline](./deadlines.md) does the same jobs.

## When to reach for it

- A singleton: a loop that must not run twice at once and keeps running (a poller, a queue consumer, a leader's
  loop).
- A cron: a job on a calendar ("at minute 17 of every hour", "at 03:00 UTC"), once per time, however many runners.
- Not for something one record's own life decides (an upload unfinished an hour after it began): that is a
  [deadline](./deadlines.md) on that record.
- Not for a rolling count (the model-call allowance): a count over the last 24 hours needs no job at all.
- Not when the app already has a cron-capable Worker and no cluster: a Cron Trigger is the same job with less.

## How it is declared

In Effect, a singleton is a Layer that registers an effect with `Sharding`; a cron is a Layer built from a
`Cron.Cron`:

```ts
// SKETCH: not compiled
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Cron from "effect/Cron"
import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Singleton from "effect/cluster/Singleton"

const SweepLoop = Singleton.make("UploadSweepLoop", Effect.logInfo("sweeping").pipe(Effect.forever))

const HourlySweep = ClusterCron.make({
  name: "UploadSweep",
  cron: Cron.parseUnsafe("17 * * * *"),
  skipIfOlderThan: "1 hour",
  execute: Effect.gen(function* () {
    const due = yield* ClusterCron.CurrentScheduledTime
    yield* Effect.logInfo(`sweep for ${due.epochMilliseconds}`)
  })
})

export const Jobs = Layer.mergeAll(SweepLoop, HourlySweep) // both still require Sharding
```

(`effect/Cron` has `parse(expression, timeZone?)`, returning a `Result`, at `Cron.ts:614`, and `parseUnsafe` at 686.)

From the source (`effect` 4.1.4, `src/cluster/`):

- `Singleton.make(name, run, { shardGroup? })` returns `Layer<never, never, Sharding | R>`. Registering the same name
  in the same shard group twice dies; a `run` that completes is kept alive until ownership moves or the Layer closes;
  failures from `run` become defects, so handle expected failures inside it. The name picks the shard
  (`Sharding.ts:1900-1906`), and the runner starts the fiber only on a shard whose lock it holds (`:1952-1973`).
- `ClusterCron.make({ name, cron, execute, shardGroup?, calculateNextRunFromPrevious?, skipIfOlderThan? })`.
  `skipIfOlderThan` defaults to one day; a run older than it is skipped without calling `execute`, and the next run is
  still scheduled. It is a `Singleton` named `ClusterCron/<name>` that schedules the first run, plus an entity
  `ClusterCron/<name>` whose `run` message is `Persisted` and `Uninterruptible` and carries its time through
  `DeliverAt`. Without `calculateNextRunFromPrevious`, each run is its own instance, named by the run's time, so a run
  scheduled twice for one time is stored once, and the next time is computed from the clock when the run ends. With
  it, every run goes to one instance, runs never overlap, missed runs are caught up in order, and a failing run blocks
  later ones. `execute` reads the time it was scheduled for from `ClusterCron.CurrentScheduledTime`, not when it
  started.
- `DeliverAt` is the protocol a persisted message uses to say when to deliver it: a method at
  `DeliverAt.symbol` returning a `DateTime`.

Alchemy's `@alchemy.run/effect-cluster` wraps both as deployable classes, inline or bare plus `.make`:

```ts
// SKETCH: not compiled
import * as Cluster from "@alchemy.run/effect-cluster"
import * as Effect from "effect/Effect"
import { Default } from "./Cluster.ts"

export default class UploadSweep extends Cluster.Cron<UploadSweep>()(
  "UploadSweep",
  { main: import.meta.url, cron: "17 * * * *", skipIfOlderThan: "1 hour" },
  Effect.gen(function* () {
    return Effect.logInfo("sweep")
  }).pipe(Effect.provide(Default))
) {}
```

- `Cluster.Singleton<Self>()(name, props, impl)` or `Cluster.Singleton<Self>()(name)` then `.make(props, impl)`; the
  impl is an Effect that resolves bindings once per runner and returns the fiber.
- `Cluster.Cron<Self>()(name, props, impl)` with `CronProps`: `cron` (five fields, or six with a leading seconds
  field), `timeZone` (default UTC), `calculateNextRunFromPrevious`, `skipIfOlderThan`. A cron that does not parse
  fails the deploy with `Cluster.InvalidCron`.
- Beyond the cron fields, both take only `main`: the pool imports that module's default export (`HostedProps`,
  `internal/HostedPlatform.ts:19-25`). Their resource's only attribute is the shard group of the pool that hosts it
  (`:27-30`).
- Nothing calls either, so the Stack deploys one by `yield*`-ing it, or by providing the `.make` Layer.

Every module and export here is `@stability unstable` in Effect 4.1.4, none `@experimental` (`ClusterCron.ts:15-16`,
`DeliverAt.ts:7-8`).

Checked in:

- `effect` 4.1.4 `src/cluster/Singleton.ts` (the app's installed copy): `make` 48-58, gotchas 33-40.
- `effect` 4.1.4 `src/cluster/ClusterCron.ts`: `CurrentScheduledTime` 50-53, `make` 68-197 (options 68-107,
  `calculateNextRunFromPrevious` 78-92, entity 111-120, a run per instance or `executor` 123-127, initial singleton
  131-144, default `skipIfOlderThan` 146-149, the skip 151-157, the next run 172-179, retries 201-212), `CronPayload`
  with `DeliverAt` 214-225.
- `effect` 4.1.4 `src/cluster/DeliverAt.ts`: `symbol` 25, `DeliverAt` 36-38, `isDeliverAt` 48, `toMillis` 58-63.
- `packages/effect-cluster/src/Singleton.ts` at `v2.0.0-beta.87`: `SingletonTag.make` 59-72, `SingletonClass` 86-102,
  `Singleton` 151-153.
- `packages/effect-cluster/src/Cron.ts` at `v2.0.0-beta.87`: `CronProps` 27-43, `HostedCron` 52-59, `InvalidCron`
  62-64, parse checked at deploy 86-94, `CronClass` 128-148, `Cron` 200-202.
- `website/src/content/docs/cluster/singletons.mdx` 8-9, 50-76; `cluster/crons.mdx` 8, 52-62.

Types and helpers (beta.87 and main):

| Name | What it is | Where |
| --- | --- | --- |
| `SingletonTypeId`, `SingletonProps`, `ClusterSingleton`, `SingletonTag`, `SingletonInline`, `SingletonClass` | The singleton as a resource and its class surfaces | `effect-cluster/src/Singleton.ts:18-102` |
| `HostedSingleton`, `SingletonResource`, `SingletonProvider` | Internal: what a runner or the pool runs, and the provider | `Singleton.ts:30-35`, `:55-56` |
| `CronTypeId`, `CronProps`, `ClusterCronResource`, `CronTag`, `CronInline`, `CronClass` | The cron as a resource and its class surfaces | `effect-cluster/src/Cron.ts:23-148` |
| `HostedCron`, `CronResource`, `CronProvider` | Internal: what a runner or the pool runs, and the provider | `Cron.ts:52-59`, `:97-98` |
| `InvalidCron` | The deploy error for an expression that does not parse | `Cron.ts:62-64` |
| `HostedProps`, `HostedAttributes` | `main`; the hosting pool's shard group | `internal/HostedPlatform.ts:19-30` |
| Effect: `SingletonAddress` | `{ shardId, name }`: where a singleton runs | `effect` 4.1.4 `src/cluster/SingletonAddress.ts` |

### What main changes

Nothing. `packages/effect-cluster/src/{Singleton,Cron}.ts`, `internal/{HostedPlatform,ObjectSharding}.ts`,
`Cloudflare/PoolWorker.ts` and `Cloudflare/DurableObjectPool.ts`, and the `singletons`, `crons` and Cloudflare `cron`
docs pages are identical at beta.87 and main@dbfd0ddb. Workflow objects get `DurableObjectCallbacks` on main
(`effect-cluster/src/Cloudflare/internal/Objects.ts` 144-146; the Callbacks service, `97ff09fca`, #3215), which does
not touch singletons or crons. `internal/Bootstrap.ts` changed (lines below are given for both refs). Separately,
`Cloudflare.Workers.cron` gains a typed error parameter `E` on main (`cloudflare/src/Workers/CronEventSource.ts:203-211`);
a failure is still ignored. The commit for that change was not checked.

### What each is, on each host

| Arrangement | Needs | What a singleton and a cron are |
| --- | --- | --- |
| Effect `Singleton` / `ClusterCron` on its own | `Sharding.layer`, which requires `ShardingConfig`, `Runners`, `MessageStorage`, `RunnerStorage` and `RunnerHealth` (`Sharding.ts:2232-2238`) | A fiber on the shard's lock holder; a cron's runs are persisted messages with `DeliverAt` |
| Alchemy `Cluster.Singleton` / `Cluster.Cron` on a Node pool (Docker, ECS, Fly, Hetzner, GCP, Kubernetes) | A pool and a Postgres `Cluster.Database` the runners coordinate through | Exactly Effect's `Singleton.make` and `ClusterCron.make`, in the pool's shard group (`internal/Bootstrap.ts:309-315` on main, `:318-324` at beta.87): Effect's semantics apply |
| Alchemy on `ClusterCloudflare.DurableObjectPool` | The pool Worker Alchemy generates and deploys; no database | One Durable Object of the shared class `ClusterScheduled` per singleton or cron, named by kind and name (`Cloudflare/internal/Objects.ts:104-118`), run by Alchemy's own code, not Effect's |

A singleton's "one copy" is as wide as its `RunnerStorage`: SQL runner storage shares the locks across processes;
in-memory storage keeps them in one process. The smallest real setups are `SingleRunner.layer` (one process, SQL
message storage, so a SQL client with transactions, which D1 is not: see [cluster.md](./cluster.md)) and, for tests,
`TestRunner.layer` (all in memory, `TestRunner.ts:31-38`).

On the Durable Object pool, from the source (identical at both refs):

- **Effect's own `Singleton.make` and `ClusterCron.make` cannot be used.** The pool's `Sharding` is a shim that refuses
  `registerSingleton`, `registerEntity` and `send` with `Cluster.NotHosted` (`internal/ObjectSharding.ts:305-333`).
  Use `Cluster.Singleton` and `Cluster.Cron` only.
- **A singleton** is its object running the fiber, with an alarm every 10 seconds that restarts the fiber if it ended
  or the object restarted (`internal/ObjectSharding.ts:385`, `:410-426`). A failed fiber is logged and started again
  at the next heartbeat. One object is one copy.
- **A cron** is its object storing its next time in `cluster_schedule` and waking at it (`:429-468`). A run is not a
  persisted message: the next time is written after the run, so a run cut short by a restart runs again on the next
  alarm (at least once). A run that fails is logged and not retried; the object writes the next time and waits
  (`:448-459`). Unset `skipIfOlderThan` means never skip, not one day (`:444-447`): set it. With
  `calculateNextRunFromPrevious`, missed times after an outage run one by one, each on the next alarm; without it,
  they collapse into one run (`:457-459`). A cron object's first wake only stores its next time (`:442`, `:463-468`).
- **What wakes them.** The pool Worker carries a Cron Trigger `* * * * *` that wakes every singleton and cron in case
  an alarm was lost, and the first call an isolate serves wakes them too (`Cloudflare/PoolWorker.ts:57-59`, 106-115).
- **No `InstanceStorage`.** Only entity objects are given it (`Cloudflare/internal/Objects.ts:92-96`, `:96-100` on
  main); singleton and cron objects get their Construction phase's services, the pool's `Sharding` and the object's
  runtime only (`internal/ObjectSharding.ts:405-408`). A job that must remember something keeps it in an entity it
  calls.
- **No D1.** A singleton or cron there runs inside the pool's Worker, which is deployed with three string settings,
  `CLUSTER_ENV` (the classes' own `Config` values packed as one secret), `CLUSTER_POOL` and `CLUSTER_GATEWAY_TOKEN`
  (`Cloudflare/DurableObjectPool.ts:141-157`), plus the Durable Object namespaces and Cron Trigger its own
  implementation declares (`Cloudflare/PoolWorker.ts:53-59`). The pool has no option for bindings
  (`DurableObjectPoolOptions = { name? }`, `Cloudflare/DurableObjectPool.ts:43-49`). Cloudflare's D1 binding needs the
  `Worker` being deployed and its `WorkerEnvironment` (`packages/cloudflare/src/D1/QueryDatabaseBinding.ts:11-24` on main, the same in the installed beta.87 package), and
  a hosted class's Construction phase has neither (`packages/alchemy/src/Platform.ts:126-137` on main), so a D1 binding would
  be an unmet requirement of the class's Layer. [cluster](./cluster.md) "Rules" has the detail.

### The nearest thing on Cloudflare with no cluster

- **A Worker's Cron Trigger.** In an Effect-native Worker, `Cloudflare.Workers.cron(expression, handler)` attaches
  the expression at deploy and registers the `scheduled` listener; it needs `CronEventSourceLive`
  (`cloudflare/src/Workers/CronEventSource.ts:203-247` at beta.87). A failing handler is ignored
  (`Effect.ignoreCause`, line 246), not logged, so Cloudflare never retries it: retry and log inside with
  `Effect.retry` and `Effect.logError` (the module's note, 33-41). In an async Worker the opposite holds: a `scheduled`
  handler that throws marks the run failed and Cloudflare may retry it. An async Worker sets `crons: [...]` on the
  Worker's props (which `Website.Vite`'s props include: `ViteProps` extends `WorkerProps`,
  `cloudflare/src/Website/Vite.ts:15-22`; `crons` at `Workers/Worker.ts:885-897`) and exports its own `scheduled`
  handler. `controller.scheduledTime` is the time it was scheduled for. Cloudflare's guide:
  https://alchemy.run/cloudflare/messaging/cron.
- **A Cloudflare Workflow with `schedules`.** A Workflow can carry cron expressions that each create an instance
  (`Cloudflare.Workflow(name, { schedules: ["0 * * * *"] })`, `cloudflare/src/Workflows/Workflow.ts:317-329`,
  360-370; account limit 100 expressions). Worth it only when the job is itself a multi-step workflow
  ([workflows](./cluster-workflows.md)).
- **A named Durable Object with an alarm.** One object (`getByName("upload-sweeper")`) is already one copy in one
  place: what a singleton gives. It sets its own alarm for the next hour and runs the job when it fires. An async
  Worker binds one in its `env` with `Cloudflare.DurableObject(className, props)` and exports the class
  (`cloudflare/src/Workers/DurableObject.ts:360-390`). In an Effect-native Durable Object, `makeCallback(name, handler)`
  schedules durable jobs on the object's alarm, retried with backoff (`alchemy/src/Callback.ts` at beta.87, 140-183;
  on main it reads a `Callbacks` service, `Cloudflare.DurableObjectCallbacks`).
- **A Domain deadline.** A command scheduled for one aggregate instance later, which that instance accepts or
  ignores ([deadlines](./deadlines.md)). It replaces a sweep with one timer per record, and needs a Domain host.

## Rules, and the mistakes to avoid

- **A singleton's fiber is a loop.** If `run` returns, it is kept alive doing nothing (`Singleton.ts:37-38`; the
  Cloudflare pool does the same, `ObjectSharding.ts:415`). Repeat inside it (`Effect.repeat(Schedule.spaced(...))`).
- **A singleton can move, and can briefly run twice.** While shards settle after a deploy it may stop and start once
  or twice (`singletons.mdx` 76). A runner learns it lost a lock only at its next refresh, every 10 seconds at most
  (`effect` 4.1.4 `src/cluster/Sharding.ts:737-765`), so a runner paused past the 35-second lock expiry can overlap
  the new owner until then. Each pass must be safe to cut short, to run again, and to run beside itself.
- **A cron run is at least once.** A run interrupted by a restart runs again; make it idempotent (a `DELETE ... WHERE
  createdAt < ?` is).
- **On a Node pool a failing cron run is retried, not dropped.** `execute`'s failures become defects
  (`ClusterCron.ts:151-157`), and a defect restarts the cron's entity instance and runs the message again, backing
  off from 500 ms to at most 10 seconds (`effect` 4.1.4 `src/cluster/internal/entityManager.ts:999-1002`), until the
  run is older than `skipIfOlderThan`. Catch expected failures inside `execute` and log them. On the Durable Object
  pool, a failed run is logged and skipped instead.
- **A Node pool cron needs real message storage.** Its `run` and `start` messages are `Persisted`
  (`ClusterCron.ts:111-117`), and a runner with no `MessageStorage` dies on a persisted message
  (`internal/entityManager.ts:769-773`). Scheduling the next run retries for ever, from 200 ms up to one minute apart
  (`ClusterCron.ts:201-212`): a storage outage delays runs, it does not stop the chain. Do not point Effect's
  `MessageRetention` at a cron's entity: it relies on stored replies to know what already ran
  (`MessageRetention.ts:44-56`).
- **Read the scheduled time, not the clock**, for "older than an hour": `CurrentScheduledTime` or
  `controller.scheduledTime`, so a late run sweeps what was due at its time.
- **A job has no actor.** It runs for no person. In this app every statement on customer data still filters on
  `organizationId`: a sweep lists organizations and sweeps each, never one unscoped `DELETE`.
- **On a Worker Cron Trigger, an Effect handler's failure is swallowed** without a log (`CronEventSource.ts:246`).
  Log it and retry inside.

## In this app

**The hourly sweep of unfinished uploads.** Today nothing runs on a schedule. `beginUpload` deletes the
organization's uploads begun more than `abandonedAfterMinutes` (60) ago, and their chunks, in the same D1 batch that
stores the new upload (`packages/catalog/host/src/ImportStore.adapter.ts:344-355`, 374-397;
`packages/catalog/model/src/Staging/Upload.rules.ts:20`). So an organization nobody uploads to again keeps its last
unfinished upload's rows indefinitely, and the person who comes back later sees "This upload is no longer on the
server" only if someone else uploaded in between (`Imports.handler.ts:207-210`).

As a Cron Trigger on the app's Worker as it is:

```ts
// SKETCH: not compiled
// packages/infra/src/Inventory.stack.ts: the Website.Vite props gain
//   crons: ["17 * * * *"]
//
// apps/inventory/src/server/worker.ts
const sweep = (scheduledTime: number) =>
  Effect.gen(function* () {
    const uploads = yield* UploadSweep
    const due = DateTime.makeUnsafe(scheduledTime)
    yield* uploads.sweepAbandoned(DateTime.subtract(due, { minutes: abandonedAfterMinutes }))
  }).pipe(Effect.provide(sweepLayer))

export default {
  fetch,
  scheduled: (controller, _env, ctx) => ctx.waitUntil(Effect.runPromise(sweep(controller.scheduledTime)))
} satisfies ExportedHandler<Env>
```

`UploadSweep.sweepAbandoned(before)` would read the organization ids, then run, per organization, one batch of the
two statements `beginUpload` already has (`dropAbandonedChunks`, `dropAbandonedUploads`), so every statement keeps
its `organizationId` filter. Keep the sweep in `beginUpload` too: it costs one statement pair and covers the hour
between two cron runs.

As a `Cluster.Cron("UploadSweep", { cron: "17 * * * *", skipIfOlderThan: "1 hour" }, ...)`: on
`DurableObjectPool` it runs in its own object inside the pool's Worker, which cannot bind the app's D1 database, so it
cannot delete uploads. A `Cluster.Singleton` loop (`Effect.repeat(Schedule.spaced("1 hour"))`) meets the same wall,
and costs an alarm every 10 seconds besides. On a Node pool it would need Postgres and runners, and it would still
reach D1 only through the app's own API.

As a [deadline](./deadlines.md), each upload carries its own one-hour timer and nothing sweeps. That page covers it.

**The daily reset of the allowance window.** There is no reset to schedule. The window rolls: a call counts if it was
taken in the 24 hours before now (`windowStart`, `packages/access/model/src/Allowance/Allowance.rules.ts:16`), and
the count and the take are one `INSERT ... WHERE (SELECT COUNT(*) ...) < limit`
(`packages/access/host/src/AllowanceStore.adapter.ts:33-41`). Calls come back one by one, a day after each was taken.
If the allowance moves to an entity ([cluster](./cluster.md)), the entity drops calls older than a day on every
`Take`, so it needs no job either. A scheduled job could only prune `modelCall` rows older than a day, which nothing
deletes today (`apps/inventory/migrations/0001_init.sql:410-420`); the index on `(organizationId, createdAt DESC)` keeps
the count cheap regardless, so pruning is housekeeping, not correctness. Turning the rolling window into a
calendar-day reset (at midnight UTC, say) would change what the person is told ("They come back over the next day",
`Allowance.rules.ts:23`), and is the app's owner's decision, not a default.

- **Used today:** no. The sweep runs inside `beginUpload` (`ImportStore.adapter.ts:374-397`); the allowance has no
  scheduled part.
- **Where it goes:** `crons` on the `Website.Vite` props in `packages/infra/src/Inventory.stack.ts`, a `scheduled`
  export in `apps/inventory/src/server/worker.ts`, a `sweepAbandoned` method on the import store port
  (`packages/catalog/model/src/Import/ImportStore.store.ts`) with its D1 statements in
  `packages/catalog/host/src/ImportStore.adapter.ts`.
- **What the person gets:** nothing they can see, except that an upload left unfinished is gone within the hour
  after the next run, whether or not anyone uploads again.

## How to check it

- A slow test on a real local D1 (`apps/inventory/test/*.slow.test.ts`): stage two uploads in two organizations, one
  begun 61 minutes before the scheduled time and one 59; run `sweepAbandoned` for that time; only the first and its
  chunks are gone, and the other organization's rows are untouched (rule 6).
- Run it twice: the second run deletes nothing (at least once is safe).
- A fast test that the job reads `controller.scheduledTime`, not the clock: a run fired late sweeps only what was due
  at its scheduled time.
- For an Effect `Singleton` or `ClusterCron`, `TestRunner.layer` runs one in memory; a registration publishes
  `SingletonRegistered` on `Sharding.getRegistrationEvents` (`Sharding.ts:1928`), which a test can wait on.
- For a `Cluster.Cron`, a deploy with an expression that does not parse fails with `Cluster.InvalidCron`
  (`crons.mdx` 58-62).
- Locally, Cloudflare's guide shows a bounded polling test that proves a Cron Trigger fires
  (https://alchemy.run/cloudflare/messaging/cron). Not verified for this app.

## What it needs

- **Cron Trigger:** the app's Worker as it is (`Website.Vite` accepts `crons`); beta.87.
- **Durable Object alarm:** an async Durable Object class exported from `worker.ts` and bound in `env`; beta.87.
- **Effect Cluster singleton or cron:** a cluster. On runners: a pool and a Postgres `Cluster.Database`
  (`effect-cluster/src/Database.ts:62-113`). On Cloudflare: `ClusterCloudflare.DurableObjectPool` and its Worker, only
  for a job that needs nothing from D1. beta.87 and main are the same.
- **Deadline:** a Domain host with scheduled commands ([deadlines](./deadlines.md)).
- Nothing on this page was run: the trials of 2026-11-19 ran no cluster, Cron Trigger or deploy.

## Verdict

**Open: decision 19 of the brief**, which puts two uses on the pool to Benjamin: a cron that closes each
organization's day of model calls into a history, and a singleton that keeps the operator's live total, both over a
registry entity on the pool. This page's own reading, below, is of the work the app schedules today.

**Cannot yet:** a `Cluster.Singleton` or `Cluster.Cron` that does this app's scheduled work. The one job the app has,
the sweep of unfinished uploads, deletes D1 rows, and a singleton or cron on `ClusterCloudflare.DurableObjectPool`
runs in the pool's Worker, which cannot bind D1 at beta.87 or main (the pool declares that Worker with three string
settings and its own Durable Object namespaces, has no option for bindings, and a hosted class has no `Worker` for a D1
binding to attach to). On runners it would need Postgres and a runner pool, which this deployment does not have. What
would remove it: a `DurableObjectPool` option for extra bindings. The allowance gives a cluster cron nothing to reset
either: as a rolling window, or by the UTC day (the brief's decision 16), the count starts again from the time a call
is decided. The nearest thing that works, on beta.87: a Worker Cron Trigger, `crons: ["17 * * * *"]`
on the `Website.Vite` props and a `scheduled` export in `worker.ts` that sweeps each organization's uploads begun an
hour before `scheduledTime`; or `Cloudflare.Workers.cron` on the second, Effect-native Worker that
[cluster](./cluster.md) adds, if that Worker is built. Once the pool exists, a `Cluster.Singleton` or `Cluster.Cron`
on it can run work that lives in entities (none today).

## Where this was read

- https://alchemy.run/cluster/singletons (the live site documents beta.87)
- https://alchemy.run/cluster/crons
- https://alchemy.run/cluster/cloudflare
- https://alchemy.run/cloudflare/messaging/cron
- `website/src/content/docs/cluster/singletons.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/cluster/crons.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/cluster/cloudflare.mdx`, `cluster/databases.mdx`, `cloudflare/messaging/cron.mdx` at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/effect-cluster/src/Singleton.ts`, `Cron.ts`, `Database.ts`, `internal/HostedPlatform.ts` at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/effect-cluster/src/internal/ObjectSharding.ts`, `Cloudflare/PoolWorker.ts`, `Cloudflare/DurableObjectPool.ts`
  at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/effect-cluster/src/Cloudflare/internal/Objects.ts`, `internal/Bootstrap.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: changed
- `packages/cloudflare/src/Workers/CronEventSource.ts`, `Website/Vite.ts`, `Workers/Worker.ts`,
  `Workers/DurableObject.ts`, `D1/QueryDatabaseBinding.ts`, `packages/alchemy/src/Callback.ts` at `v2.0.0-beta.87`
  (published package); on `main@dbfd0ddb`: `CronEventSource.ts` not compared, `Callback.ts` changed;
  `packages/alchemy/src/Platform.ts` on `main@dbfd0ddb`
- `effect` 4.1.4 (the app's installed copy): `src/cluster/{Singleton,SingletonAddress,ClusterCron,DeliverAt,Sharding,ShardingConfig,MessageRetention,SingleRunner,TestRunner}.ts`,
  `src/cluster/internal/entityManager.ts`
