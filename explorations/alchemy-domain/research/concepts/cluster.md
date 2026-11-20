---
type: Reference
title: Effect Cluster
description: Effect Cluster entities (one addressable, single-threaded instance per id) deployed by @alchemy.run/effect-cluster, and the arrangement that runs one next to inventory-import's Worker and D1 database, starting with the organization's model-call allowance.
tags: [alchemy-domain, extra]
---

# Effect Cluster

Effect Cluster is Effect's library for stateful programs spread over many processes. Its unit is the **entity**: a
type with a set of RPC messages, and one **instance** per id that handles its messages one at a time, so it can keep
state in memory without locks. Each id hashes to one of 300 **shards** per shard group, and each shard belongs to one
**runner** (a process); runners agree on who owns which shard through a shared **database**, where they register,
hold shard locks, and store messages marked `Persisted`. A persisted message is delivered at least once and answered
once per primary key; its handler can still run twice, so it must tolerate that. The docs put the entity this way: "a
small, long-lived program with an id and its own state, like one chat room"
[https://alchemy.run/cluster/what-is-effect-cluster]. `@alchemy.run/effect-cluster` deploys all of it from an Alchemy
Stack: a **pool** of runners on a cloud, the Postgres they share, and an HTTP **gateway** that callers outside the
cluster reach entities through. On Cloudflare it does something different: there are no runners and no database,
every instance is its own Durable Object, and Alchemy's own runtime replaces Effect's sharding and message storage.

## When to reach for it

- Several people act on the same thing at once and the actions must be applied in order: one organization's daily
  model-call allowance, one import being reviewed by two editors. An entity per id turns races into a queue.
- A message must survive a restart and be answered once: mark the RPC `Persisted` with a primary key.
- A process that waits for hours or days (a long model pass, a reminder): that is a workflow, see
  [cluster-workflows.md](./cluster-workflows.md). One fiber for the whole app, or a timed job: see
  [cluster-singletons.md](./cluster-singletons.md).
- Hosting an `@alchemy.run/domain` model on entities is a separate Layer, covered in
  [host-effect-cluster.md](./host-effect-cluster.md). This page is about Effect Cluster itself.

Do not reach for it to make a single D1 write atomic: the app already does that with one D1 batch.

## How it is declared

Three pieces: a pool (and, off Cloudflare, a database), an entity declared from its RPCs, and its implementation as a
Layer with the pool provided to it. In this app's terms, the allowance per organization, keeping the app's rolling
24-hour window (rule 9):

```ts
// SKETCH: not compiled
// Allowance.entity.ts: what callers import (no implementation, no pool)
import * as Cluster from "@alchemy.run/effect-cluster"
import * as ClusterSchema from "effect/cluster/ClusterSchema"
import * as Rpc from "effect/rpc/Rpc"
import * as S from "effect/Schema"

export class AllowanceUsedUp extends S.TaggedError<AllowanceUsedUp>()("AllowanceUsedUp", { limit: S.Int }) {}

export class Allowance extends Cluster.Entity<Allowance>()("Allowance", [
  Rpc.make("Take", {
    // The Reservation's id: the same on every retry of one call.
    payload: { callId: S.String },
    success: S.Int,
    error: AllowanceUsedUp,
    primaryKey: ({ callId }) => callId
  }).annotate(ClusterSchema.Persisted, true)
]) {}

// Cluster.ts: the pool, in its own module
import * as ClusterCloudflare from "@alchemy.run/effect-cluster/Cloudflare"

export const Default = ClusterCloudflare.DurableObjectPool("Default")

// AllowanceLive.ts: the implementation; its default export is what the pool imports
import { InstanceStorage } from "@alchemy.run/effect-cluster/Host"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"

const limit = 40
const day = 24 * 60 * 60 * 1000

// One counted call. Plain data: the object's storage keeps structured-cloneable values.
interface Counted {
  readonly callId: string
  readonly at: number
}

export default Allowance.make(
  // disableFatalDefects: a defect fails that one call instead of restarting the instance for ever.
  { main: import.meta.url, maxIdleTime: "15 seconds", disableFatalDefects: true },
  Effect.gen(function* () {
    // outer phase: once per pool isolate
    return Effect.gen(function* () {
      // inner phase: once per organization, on its first message. The storage is the object's own; the type of the
      // inner phase does not list it, so it is read as an option.
      const storage = yield* Effect.serviceOption(InstanceStorage)
      return Allowance.of({
        Take: Effect.fnUntraced(function* ({ payload }) {
          if (O.isNone(storage)) return yield* Effect.die("the allowance needs a Durable Object pool")
          const now = DateTime.toEpochMillis(yield* DateTime.now)
          const stored = O.getOrElse(
            O.fromNullishOr(yield* storage.value.get<ReadonlyArray<Counted>>("calls")),
            () => []
          )
          const kept = A.filter(stored, (call) => call.at >= now - day)
          // A Take replayed after a restart, whose reply was never stored, is not counted twice.
          if (A.some(kept, (call) => call.callId === payload.callId)) return limit - kept.length
          if (kept.length >= limit) return yield* AllowanceUsedUp.make({ limit })
          yield* storage.value.put("calls", A.append(kept, { callId: payload.callId, at: now }))
          return limit - kept.length - 1
        })
      })
    })
  }).pipe(Effect.provide(Default))
)
```

Two things in that sketch are load-bearing. `disableFatalDefects: true`: without it, a handler defect (here, a
missing `InstanceStorage`) restarts the instance and runs its messages again, backing off from 500 ms by 1.5 times to
at most 10 seconds and never stopping, so the caller never gets an answer (`effect` 4.1.4 `src/cluster/Entity.ts:151-165`,
`src/cluster/internal/entityManager.ts:999-1002`); Alchemy's Durable Object runtime does the same and passes
`disableFatalDefects` on to the instance's server (`internal/EntityRuntime.ts:17-18`, `:472`). And the `callId` check:
the cluster stores a persisted message before it runs and its reply after, and `InstanceStorage.put` is a third,
separate write; if the object stops between the `put` and the stored reply, the alarm runs the message again 30
seconds later (`REPLAY_AFTER`, `internal/EntityRuntime.ts:74`, `:306`, `:330-358`).

A caller that runs in an Alchemy Effect-native runtime writes `const orgs = yield* Allowance`, then
`const org = yield* orgs.getByName(reservation.organization)` and `yield* org.Take({ callId: reservation.id })`.

Checked in (all at `v2.0.0-beta.87`, `packages/effect-cluster/src/`; identical on `main@dbfd0ddb` unless "What main
changes" says otherwise):

- The package's entry exports `Database` (as a namespace), `Entity`, `providers`, `Pool`, `Workflow`, `Singleton`,
  `Cron`: `index.ts:5-11`. Each cloud is its own entry point: `package.json:30-41` (`./AWS`, `./Cloudflare`,
  `./Docker`, `./Fly`, `./GCP`, `./Hetzner`, `./Kubernetes`, and `./*` for modules such as `./Host`); the internal
  modules are closed (`./internal/*`, `./AWS/internal/*`, `./Cloudflare/internal/*` map to `null`,
  `package.json:92-94`). The cloud provider packages are optional peers, `package.json:124-157`. The runner depends on
  `@effect/platform-node` and `@effect/sql-pg`: `package.json:109-112`.
- `Cluster.Entity` has four forms (external program; from an Effect entity with its implementation; bare from type
  and RPCs; bare from an Effect entity): `EntityClass`, `Entity.ts:224-257`, dispatch at `Entity.ts:470-488`.
  `.make(props, impl)` returns a Layer: `Entity.ts:179-182`. The implementation is two nested Effects: `EntityImpl`,
  `Entity.ts:146-150`. The inner phase may require only `InstanceServices` (`RuntimeContext`, `Scope`,
  `CurrentAddress`, `CurrentRunnerAddress`): `Entity.ts:130-134`. That is why the sketch reads `InstanceStorage`
  with `Effect.serviceOption`, as the domain library's own Cluster host does (`packages/domain/src/EffectCluster/index.ts`
  line 610 on main).
- `EntityProps`: `main` (`Entity.ts:46`), `handler` default `"default"` (`:51`), `maxIdleTime` default 1 minute
  (`:57`), `concurrency` default 1 (`:63`), `mailboxCapacity` default 4096 (`:70`), `disableFatalDefects` default
  false (`:77`). Effect's own `Entity.toLayer` also takes `mailboxMetrics`, `defectRetryPolicy` and `spanAttributes`
  (`effect` 4.1.4 `src/cluster/Entity.ts:141-165`); `Cluster.Entity` passes on only the four props above
  (`Entity.ts:279`, `:299`), so a custom restart backoff is not reachable through it.
- A caller's errors beyond the RPC's own: `GatewayError` = `RpcClientError | MailboxFull | AlreadyProcessingMessage |
  PersistenceError | EntityNotAssignedToRunner`, `Entity.ts:107-112`.
- `yield* Entity` with no Alchemy `RuntimeContext` in context returns a namespace whose `getByName` dies with
  `Cluster.EntityCalledOutsideRuntime`: the check at `Entity.ts:567-568`, the namespace at `:591-598`, the error class
  at `:260-261`. In a runtime it binds `CLUSTER_<type>_GATEWAY`, `_SHARD_GROUP` and `_TOKEN` as environment values
  (`Entity.ts:570-580`) and, while deploying a Worker, a service binding `CLUSTER_<type>_SERVICE` to the pool's Worker
  (`:582-583`).
- Missing RPC middleware fails the deploy with `Cluster.EntityMiddlewareMissing`: `Entity.ts:303-324`.
- A pool collects the classes given it and their environment (`Pool.ts:76-104`) and refuses to mix an external
  program with anything else (`Cluster.PoolProgramConflict`, `Pool.ts:72-74`, check at `:89-96`). Node pools bundle
  every class into one Node program and image (`internal/PoolHost.ts:1-8`, `RUNNER_DOCKERFILE` at `:110`) and give
  each pool its own shard group `alchemy:<id>` (`:164-167`).
- The database contract: `DatabaseShape { url, network?, shardGroups }`, `Database.ts:62-79`; `Cluster.Database.fromUrl`
  at `Database.ts:100-113`. The runner connects with `PgClient` only: `internal/Bootstrap.ts:165-170` and `:301-312`.
- The gateway: RPCs served at `/rpc` (`internal/Gateway.ts:48`), gateway port 34500 and runner port 34431 (`:51`,
  `:54`), bearer token compared as a plain string on every request except `/health` (`authorized`, `:329-341`).
  Inside a runner, calls skip the gateway and go through `Sharding` (`makeNamespace`, `:205`, the check at `:217`). A
  Worker caller fetches through its service binding, otherwise the global `fetch` (`gatewayFetch`, `:110-116`).
- The Cloudflare pool: `DurableObjectPool(id, options)`, with `DurableObjectPoolOptions = { name? }` only:
  `Cloudflare/DurableObjectPool.ts:43-49`, `:107-198`.
- `InstanceStorage` (key-value storage of the instance's own object: `get`, `put`, `delete`, `list`, `transaction`;
  values structured-cloneable), present only on the Durable Object pool, and there only for entity objects:
  `Host.ts:49-68`; provided per object at `Cloudflare/internal/Objects.ts:86-96` (`:96-100` on main).
- Effect side (`effect` 4.1.4, `src/cluster/`): `Entity.make` at `Entity.ts:516`, `Entity.keepAlive` at
  `Entity.ts:787`, `Entity.makeTestClient` at `Entity.ts:675`; `ClusterSchema.Persisted` at `ClusterSchema.ts:47`,
  `WithTransaction` at `:85`, `ShardGroup` at `:187`; `ShardingConfig.defaults` at `ShardingConfig.ts:238-263`;
  `Sharding.layer` at `Sharding.ts:2232`; `SingleRunner.layer` at `SingleRunner.ts:61`; `TestRunner.layer` at
  `TestRunner.ts:31`. `Rpc.make`'s `primaryKey` option: `src/rpc/Rpc.ts:988`.

What each `ClusterSchema` annotation does (all `Context.Reference`s with a default, `effect` 4.1.4
`src/cluster/ClusterSchema.ts`), and whether the Durable Object pool reads it:

| Annotation | Default | What it does | Durable Object pool |
| --- | --- | --- | --- |
| `Persisted` | `false` (`:47`) | Stored before it runs, reply stored after; sent to a runner with no message storage, it dies (`internal/entityManager.ts:769-773`) | read (`internal/EntityRuntime.ts:666`) |
| `WithTransaction` | `false` (`:85`) | The handler runs inside the storage's transaction; a failed commit runs it again (`:55-80`) | not read |
| `Uninterruptible` | `false` (`:104`) | `true`, `"client"` or `"server"`; on the server an interrupted request runs again instead of answering | server side read (`EntityRuntime.ts:841`) |
| `InterruptOnTermination` | `false` (`:125`) | Interrupt at shutdown instead of waiting `entityTerminationTimeout` (15 s) | not read |
| `ShardGroup` | `"default"` (`:187`) | Shard group per entity id | not read (no shard groups) |

`ClientTracingEnabled` (`:204`), `Dynamic` (`:225`) and the internal `Abandon` (`:25`) complete the module.

How long things take. A Node pool runs Effect's `Sharding` with `ShardingConfig.defaults` (`effect` 4.1.4
`src/cluster/ShardingConfig.ts:238-263`; each settable from the environment, `layerFromEnv`, `:459`). The Durable
Object pool does not read `ShardingConfig`; it has its own constants:

| Durable Object pool (`internal/EntityRuntime.ts`, `Cloudflare/internal/Objects.ts`) | Node pool (`ShardingConfig.defaults`) |
| --- | --- |
| `maxIdleTime` 1 minute and `mailboxCapacity` 4096 unless set (`EntityRuntime.ts:255-257`) | `entityMaxIdleTime` 1 minute, `entityMailboxCapacity` 4096, `maxResidentEntities` 10,000 per runner |
| Alarm every 5 s while an instance runs or is held (`KEEP_AWAKE`, `:71`) | `shardsPerGroup` 300; lock refresh 10 s, lock expiry 35 s |
| A stored message cut short runs again after 30 s (`REPLAY_AFTER`, `:74`) | Storage poll 10 s; a claimed, unfinished message is offered again after 10 minutes (`SqlMessageStorage.ts:429-434`) |
| A reply without a primary key kept 1 hour, one with a key kept for good (`KEEP_REPLIES`, `:77`; pruning `:983-988`) | Reply poll 200 ms; retry of a send that met `EntityNotAssignedToRunner` every 100 ms |
| A persisted value at most 2 MB (`Objects.ts:45`; `:49` on main) | `entityTerminationTimeout` 15 s |

What a cluster asks of its storage. Effect's runners need a `MessageStorage` (requests saved by primary key, a second
save answered `Duplicate`, replies, claims), a `RunnerStorage` (registration and shard locks) and a `RunnerHealth`
(`effect` 4.1.4 `src/cluster/MessageStorage.ts`, `RunnerStorage.ts`, `RunnerHealth.ts`). Effect ships SQL ones
(`SqlMessageStorage`, `SqlRunnerStorage`) and in-memory ones for one process (`layerMemory`); Alchemy's Node pools use
the SQL ones on Postgres. The Durable Object pool uses none of them: it keeps its own mailbox in each object's SQLite.

Types and helpers (beta.87 and main):

| Name | What it is | Where |
| --- | --- | --- |
| `EntityTypeId`, `Entity` (the resource), `EntityAttributes`, `EntityBindingContract` | The entity as an Alchemy resource: type, pool, gateway, token | `Entity.ts:38-105` |
| `EntityNamespace` | What `yield* Allowance` gives: `getByName(id)` | `Entity.ts:119-128` |
| `InstanceServices`, `EntityServices` | What the inner and outer phases may use without providing it | `Entity.ts:130-137` |
| `EntityTag`, `EntityInline`, `EntityClass`, `ExternalEntityProps` | The class surfaces of the four forms | `Entity.ts:157-257` |
| `HostedEntity`, `EntityRuntimeContext`, `EntityResource`, `PlatformDeclaration`, `EntityDefinition`, `EntityProvider`, `shardGroupKey` | Internal plumbing between the class, the pool and the provider | `Entity.ts:272-337`, `:493`, `:600` |
| `RunnerHost` | The runner a Layer is being built on; used by platforms such as the domain's Cluster host | `Host.ts:24-33` |
| `InstanceStorageListOptions` | `prefix`, `start`, `startAfter`, `end`, `limit` for `InstanceStorage.list` | `Host.ts:36-47` |
| `makeNamespace`, `GatewayTarget` | Build a caller's namespace from a gateway URL, token and service-binding key | `Host.ts:13`, `internal/Gateway.ts:57-66`, `:205` |
| `HasNoPool` | The deploy error when an implementation was given no pool | `Host.ts:14`, `internal/HostedRuntime.ts:49-51` |
| `Pool`, `PoolLayer`, `PoolEntity`, `PoolProps`, `PoolAttributes`, `PoolBindingContract`, `PoolProvider` | The pool resource and what it holds | `Pool.ts:13-104` |
| `Database` (service), `DatabaseShape`, `ClusterNetwork`, `DatabaseProps`, `clusterShardGroups` | What every database Layer provides; the database's network; `fromUrl`'s props; the shard-groups resource | `Database.ts:15`, `:62-81`, `:116` |
| `ShardGroups` and its provider | Every shard group in one database (internal) | `ShardGroups.ts:7-34` |
| `Providers`, `providers()`, `ProviderRequirements` | The cluster's resource providers for the Stack | `Providers.ts:12-25` |
| `ExternalProgramOnWorkers` | The deploy error for an external program on Cloudflare | `Cloudflare/DurableObjectPool.ts:52-54` |
| `DatabaseNetworkMismatch`, `PoolSettings` | Deploy defect when a Node pool cannot join its database's network; the settings every Node pool shares (`name`, `shardGroups`) | `internal/PoolHost.ts:59-77` |
| `NotHosted` | Internal defect `Cluster.NotHosted`: the Durable Object pool was asked for a class it does not host, or for a `Sharding` operation it does not support | `internal/ObjectSharding.ts:85-87`, `:305-306` |
| `RunsOnPool`, `UnknownWorkflow`, `ExternalProgramExited` | Internal defects: a workflow step outside the pool; a gateway call for a workflow the pool does not host; an external program's process stopped | `internal/WorkflowGateway.ts:44-46`, `:98-103`; `internal/Bootstrap.ts:181-183` (main) |
| Effect: `Entity.fromRpcGroup`, `client`, `toLayer`, `toLayerQueue`, `of`, `CurrentAddress`, `KeepAliveHandler` | Declaring an entity, its client (needs `Sharding`), its handler Layer, what a handler reads; `KeepAliveHandler` (since 4.1.3) is how Alchemy's Durable Object runtime supplies `keepAlive` | `effect` 4.1.4 `src/cluster/Entity.ts:74-886` |
| Effect: `EntityAddress`, `EntityId`, `EntityType`, `Envelope`, `ClusterError`, `ClusterMetrics` | Shard, type and id (ids only branded, never checked); what travels between client, runner and storage; the typed errors; runner-local gauges | `src/cluster/` |
| Effect: `EntityProxy`, `EntityProxyServer`, `EntityResource` | Derive an RPC or HTTP API group from an entity and serve it through `Sharding` (Alchemy's gateway plays this part); a resource held across instance restarts | `src/cluster/EntityProxy.ts`, `EntityProxyServer.ts`, `EntityResource.ts` |
| Effect: `MessageRetention.make({ entity, retention, interval?, shardGroup? })` | A singleton that deletes an entity's answered requests older than `retention` (since 4.1.3); works through Effect's `MessageStorage`, so not on the Durable Object pool | `src/cluster/MessageRetention.ts:82` |

### What main changes

- **A database you already run works with every Node pool** (commit `d28269ca4`, #3446). At beta.87
  `Cluster.Database.fromUrl` gives no `network` (`Database.ts:100-113`) and every Node pool dies at deploy with
  `Cluster.DatabaseNetworkMismatch` when the database has none (`internal/PoolHost.ts:153-159`: each pool's `network`
  function returns `undefined` for a database on no network, for example `Docker/SwarmPool.ts:57`). So at beta.87 the
  documented `fromUrl` path (`setup.mdx`, `databases.mdx`) fails with any Node pool; the docs and the source disagree,
  and the source wins. On main a pool may declare an `ownNetwork` (`internal/PoolHost.ts:120-134`, used at `:160-175`):
  `SwarmPool` makes its own overlay network or takes `network` (`Docker/SwarmPool.ts:31`, `:108`), `MachinePool` joins
  a network for the stack and stage or takes `network` (`Fly/MachinePool.ts:28`, `:59-62`), `EcsPool`,
  `ComputeEnginePool` and `ServerPool` take `network` (`AWS/EcsPool.ts:46`, `:89`; `GCP/ComputeEnginePool.ts:38`,
  `:116`; `Hetzner/ServerPool.ts:23`, `:56`), `DeploymentPool` takes `cluster` and `namespace`
  (`Kubernetes/DeploymentPool.ts:31-40`, `:70`). Without one of these the deploy still stops, now with the message
  "pass the pool a `network`" (`internal/PoolHost.ts:166-173`). The docs page `databases.mdx` gains the matching
  paragraph (main lines 51-71).
- `SwarmPool` also takes `context` (a remote Docker engine) and `dockerfile` on main: `Docker/SwarmPool.ts:37`, `:44`
  (same commit).
- The Cloudflare workflow object is built through `provideCallbacks(impl, Cloudflare.DurableObjectCallbacks)`:
  `Cloudflare/internal/Objects.ts:13-17`, `:144-146` (the Callbacks service, `97ff09fca`, #3215).
- The runner's config provider is `RuntimeConfigProviderLive` instead of a hand-built one:
  `internal/Bootstrap.ts:15`, `:209` (`dbfd0ddb`, #3518).
- The examples: main has `examples/effect-cluster-rooms` (the tutorial's finished code, Docker); `examples/cluster-domain`
  exists at both refs, with model-file changes that belong to the domain pages.
- Nothing about the Durable Object pool's options, its Worker, its entity runtime or its environment changes:
  `DurableObjectPool.ts`, `PoolWorker.ts`, `Entity.ts`, `Host.ts`, `internal/EntityRuntime.ts`,
  `internal/ObjectSharding.ts` and `internal/HostedRuntime.ts` are identical at both refs.

## Rules, and the mistakes to avoid

- **Treat the whole stack as beta.** Every module and export under Effect's `effect/cluster` is `@stability unstable`
  in Effect 4.1.4, none `@experimental` (`effect` 4.1.4 `src/cluster/index.ts`); so is the D1 client the app already
  uses (`@effect/sql-d1` 4.1.4 `src/D1Client.ts:11`). Alchemy's package has no experimental marker in source or
  README at either ref, and npm `latest` is `2.0.0-beta.87`. Alchemy's Durable Object runtime imports
  `Entity.KeepAliveHandler`, new in Effect 4.1.3 (`internal/EntityRuntime.ts:38`), so it needs Effect 4.1.3 or later.
- **An instance's memory is not storage.** It is dropped after `maxIdleTime`, on every deploy, and when its shard
  moves (`entities.mdx`, "How long an instance lives"). Keep what must last in a database, or, on Cloudflare only,
  in `InstanceStorage`.
- **`InstanceStorage` is read with `Effect.serviceOption`.** `yield* InstanceStorage` in the inner phase does not
  type-check, because the inner phase may require only `InstanceServices` (`Entity.ts:130-134`); at run time the
  Durable Object pool adds the service to an entity object's context (`Cloudflare/internal/Objects.ts:92-96`). On a
  Node pool, and for singletons and crons, it is absent.
- **A defect restarts the instance for ever unless `disableFatalDefects` is set.** The backoff is 500 ms, times 1.5,
  capped at 10 s, with no end; a defect while the inner phase builds the handlers is retried the same way (`effect`
  4.1.4 `src/cluster/internal/entityManager.ts:351-356`). Turn expected failures into the RPC's typed error, and set
  `disableFatalDefects: true` where a wiring defect must reach the caller.
- **`main` must be the module whose default export is the class or the Layer**: the pool imports it by that name
  (`Entity.ts:42-51`; Cloudflare entry generation, `Cloudflare/DurableObjectPool.ts:61-86`).
- **Callers import the bare declaration**, not the class with its implementation, or they bundle the pool and the
  handlers (`entities.mdx`, "Keep its code out of its callers").
- **Persisted messages need a primary key to be answered once.** Without one, a retry is a new message. The key is
  scoped to one instance and one RPC (Effect stores `<type>/<id>/<rpc tag>/<key>`, `effect` 4.1.4
  `src/cluster/Envelope.ts:487-494`; the Durable Object pool stores `<rpc tag>/<key>` in the instance's own object,
  `internal/EntityRuntime.ts:675`), so a `callId` need only be unique within one organization's `Take`s.
- **Answered once is not run once.** A duplicate gets the stored reply, or waits for the running one
  (`internal/EntityRuntime.ts:677-699`; `effect` 4.1.4 `src/cluster/Runners.ts:230-259`). But a run cut short before
  its reply is stored runs again: on the Durable Object pool 30 s later from the alarm, on a Node pool when a runner
  that lost the shard leaves the request to the new owner (`internal/entityManager.ts:416-435`). Every handler that
  writes must recognise a run it already did, as `Take` does with its `callId`.
- **On the Durable Object pool, keyed replies are kept for good.** A reply to a message with a primary key is never
  pruned; one without a key is deleted after an hour (`internal/EntityRuntime.ts:77`, `:983-988`). Each
  organization's object keeps one `cluster_mailbox` row per `Take` for as long as the object exists. Effect's
  `MessageRetention` does not apply there.
- **On the Durable Object pool a duplicate waits, it does not fail.** It never answers `AlreadyProcessingMessage`; it
  refuses only with `MailboxFull` (an unpersisted call to a full instance) or `PersistenceError`
  (`internal/EntityRuntime.ts:670`, `:719-734`). A persisted call is sent again up to 3 times from 100 ms while workerd
  marks the failure retryable and not overloaded, then fails with `PersistenceError` (`internal/ObjectSharding.ts:229-240`;
  `Cloudflare/internal/Objects.ts:37-46`). A call to an entity type the pool does not host dies with
  `Cluster.NotHosted` (`internal/ObjectSharding.ts:201-207`).
- **A changed RPC drops what was waiting.** A stored message that no longer decodes after a deploy changed its RPC is
  deleted with a logged error, not run (`internal/EntityRuntime.ts:781-806`). Change a payload only in ways old
  payloads still decode.
- **An id is routed exactly as written.** Ids are only branded, never checked or normalised (`effect` 4.1.4
  `src/cluster/EntityId.ts:42-54`); the shard is a hash of the exact string (`internal/hash.ts:21-27`), and on the
  Durable Object pool the object's name is built from it. Key by a stored id (`organizationId`), never by text a
  person typed.
- **Provide RPC middleware with the pool** (`Default.pipe(Layer.provide(AuthLive))`); otherwise the deploy stops with
  `Cluster.EntityMiddlewareMissing`.
- **`yield* Entity` only works in an Alchemy Effect-native runtime.** A plain `export default { fetch }` Worker has no
  `RuntimeContext`, so its `getByName` dies with `Cluster.EntityCalledOutsideRuntime` (`Entity.ts:567-568`, `:591-598`).
- **The gateway token reaches every class on the pool.** Anyone holding it can call all of them (`calling.mdx`, "The
  gateway token"). Do identity with RPC middleware (`middleware.mdx`), never with the token.
- **The Durable Object pool's gateway is public.** The pool declares its Worker with only `main`, `compatibility` and
  `env` (`Cloudflare/DurableObjectPool.ts:141-157`), so it keeps Cloudflare's default `workers.dev` address
  (`workersDev` is on by default: the `Worker` doc comment, `packages/cloudflare/src/Workers/Worker.ts:2204` on main),
  and that address is the `gateway` bound into every caller (`:161-165`). The bearer token is all that guards it, and
  `DurableObjectPoolOptions` has no option to turn the address off (`:43-49`).
- **Build the implementation before the caller, or the caller gets no service binding.** The pool records which Worker
  serves a class when the class is deployed (`routeType`, `Cloudflare/DurableObjectPool.ts:159`); a caller Worker binds
  `CLUSTER_<type>_SERVICE` only if that record is there when it yields the class (`bindRoute`, `internal/Gateway.ts:98-104`;
  `Entity.ts:582-583`), and only if it is an Effect-native `Cloudflare.Worker` (`Cloudflare/DurableObjectPool.ts:25-41`).
  Without it the call falls back to the global `fetch` of the pool's `workers.dev` address (`internal/Gateway.ts:110-116`),
  which Cloudflare refuses between Workers on one account (`cluster/cloudflare.mdx`, "Call it from a Worker").
- **A class on the Durable Object pool reaches nothing but its own object, other classes on the pool, and the
  network. It cannot bind D1.** The pool's Worker is deployed with three string values (`CLUSTER_ENV`, `CLUSTER_POOL`,
  `CLUSTER_GATEWAY_TOKEN`, `Cloudflare/DurableObjectPool.ts:141-157`) and the three Durable Object namespaces and the
  Cron Trigger its own implementation declares (`Cloudflare/PoolWorker.ts:53-59`). A class's outer phase can hand the
  pool only `Config` values: they are collected while it runs (`internal/HostedRuntime.ts:113-114`), merged into the
  pool's environment (`Pool.ts:82-85`), packed into `CLUSTER_ENV` as one JSON secret and unpacked into `process.env`
  when the pool starts (`Cloudflare/PoolWorker.ts:89-91`). Cloudflare's D1 binding (`QueryDatabaseBinding`) needs the
  `Worker` being deployed and its `WorkerEnvironment` (`packages/cloudflare/src/D1/QueryDatabaseBinding.ts:11-24` on main, the same in the installed beta.87 package);
  a class's outer phase is given only `EntityServices` and Alchemy's `PlatformServices` (`Entity.ts:137-139`;
  `packages/alchemy/src/Platform.ts:126-137` on main), neither of which holds a `Worker`, so a D1 binding there is an unmet
  requirement of the class's Layer. At run time the classes are built inside the pool's Worker
  (`Cloudflare/PoolWorker.ts:94-99`), whose environment has no D1.
- **On Cloudflare there are no shard groups and no external programs**: an external `Cluster.Entity` dies with
  `Cluster.ExternalProgramOnWorkers` (`Cloudflare/DurableObjectPool.ts:51-54`, `:188-195`). Effect's own
  `Entity.client`, `Singleton.make` and `ClusterCron.make` cannot run there: the pool's `Sharding` is a shim that
  refuses `registerEntity`, `registerSingleton` and `send` with `Cluster.NotHosted` (`internal/ObjectSharding.ts:305-333`).
- **On a Node pool, calls during a deploy can fail with `EntityNotAssignedToRunner`** and are safe to retry
  (`pools.mdx`, "What happens on a deploy"). `MailboxFull` there means the instance holds `mailboxCapacity` requests
  or the runner holds `maxResidentEntities` instances; `AlreadyProcessingMessage` means the same request id is already
  running or done on that runner (`effect` 4.1.4 `src/cluster/internal/entityManager.ts:254-258`, `:758-766`, `:804-806`).
  Only persisted requests survive a lost runner (`Runners.ts:698-709`). Inside a cluster, a send is retried every
  `sendRetryInterval` with no limit (`Sharding.ts:1361-1409`).

## In this app

The organization's model-call allowance is the first entity, and today the only clean one. Today
`AllowanceStore.take(reservation)` counts the organization's `modelCall` rows since `reservation.since` and inserts
one in a single `INSERT ... WHERE (SELECT COUNT(*) ...) < limit ... RETURNING id`
(`packages/access/host/src/AllowanceStore.adapter.ts:33-48`; the port and `Reservation`,
`packages/access/model/src/Allowance/AllowanceStore.store.ts:27-51`; `windowStart`,
`packages/access/model/src/Allowance/Allowance.rules.ts:16`). As an `Allowance` entity keyed by `organizationId`, two
editors asking for suggestions at the same moment reach the same instance, which answers `Take` one at a time from the
calls it keeps in its own object: the 41st call in 24 hours fails with `AllowanceUsedUp`, and a `Take` sent again with
the same `callId` (the reservation's `id`, already a UUID) is answered once and counted once. The adapter maps the
answer back to the port's `boolean`. The `modelCall` table then stops being the counter; it can stay as the audit of
calls, written after each call, or be dropped (a decision for the app's owner).

**One decision, two routes.** [drizzle-durable-objects.md](./drizzle-durable-objects.md) proposes the same move (the
allowance into one Durable Object per organization, behind `AllowanceStore`) through an object the app declares
itself, with a Drizzle table and a SQL transaction. Both put the count in a per-organization Durable Object's
storage, and both need an Effect-native Worker beside the app's. They differ in what comes with them: the entity brings
the cluster's pool Worker (on a public `workers.dev` address behind a token), a Cron Trigger every minute and an alarm
every 5 seconds while an instance is live, and keeps the count as key-value data; the Drizzle object brings a SQL
table, migrations and a typed query, and no cluster. The allowance goes on one of them, not both.

Other candidates, and what stops each:

- **An import under review**, keyed by import id, would queue `decide`, `suggest`, `commit` and `takeBack` instead of
  refusing a stale revision. The import's rows, decisions and items live in D1, and an entity on the Durable Object
  pool cannot reach D1 (see the rules). Keep imports on the D1 batch they use now (rules 2, 3, 10 already hold there).
- **A long model pass** over a file is a workflow, not an entity: see [cluster-workflows.md](./cluster-workflows.md).

**Why a second Worker.** The app deploys one Worker with `Cloudflare.Website.Vite`
(`packages/infra/src/Inventory.stack.ts:102-130`), whose entry is a plain module, `apps/inventory/src/server/worker.ts`
(`export default { fetch }`). `Website.Vite` cannot take an Effect implementation: it calls `Worker(id, props)` with two
arguments and sets `vite` (`packages/cloudflare/src/Website/Vite.ts:251-307` on main, the same at beta.87), and a Worker
with `vite` is built by the Vite source (`Workers/Source.ts:433-441`), which bundles `vite.main` as it is
(`Workers/Sources/Vite.ts:329-387`). The generated entry that runs an Effect-native Worker, its Durable Object bridges
and its workflow bridges is written only by the Rolldown source (`makeEffectVirtualEntry`,
`Workers/Sources/Rolldown.ts:174-176`, `:191-240`). So the app's Worker cannot `yield* Allowance`, and the caller must
be a second, Effect-native `Cloudflare.Worker`. Doing it in one Worker means replacing `Website.Vite` with an
Effect-native `Cloudflare.Worker(id, { main: import.meta.url, assets }, impl)` whose screens are built by a separate step
(`assets` takes a directory or a build's `{ path, hash }`, `Workers/Worker.ts:674-696` on main): a rewrite of the
entry and of how the screens are built, not verified for this app. Either way, the Durable Object pool deploys its own
Worker too, and that Worker cannot be the app's.

### The arrangement to build

1. **The pool.** `Cluster.ts` exports `Default = ClusterCloudflare.DurableObjectPool("Default")`. At deploy it adds a
   Worker `DefaultPool` (`Cloudflare/DurableObjectPool.ts:127`, `:141-157`, with `nodejs_compat`) exporting three
   Durable Object classes: `ClusterEntity` (one object per `(type, id)`), `ClusterScheduled` (one per singleton or
   cron) and `ClusterWorkflow` (one per workflow execution) (`Cloudflare/internal/Objects.ts:80`, `:105`, `:126`). What
   the cluster keeps is in each object's own SQLite: tables `cluster_mailbox`, `cluster_chunks`, `cluster_entity`
   (`internal/EntityRuntime.ts:208-225`), written through workerd's synchronous `transactionSync`
   (`Cloudflare/internal/Objects.ts:66-77`); `InstanceStorage` is the same object's key-value storage. No database, no
   container, no Postgres; D1 is not used. Effect's `Sharding` is replaced by an object-addressing shim whose shard is
   the host itself (`internal/ObjectSharding.ts:309-333`).
2. **What runs on its own.** An entity object's alarm wakes it every 5 seconds while an instance runs or is held, and
   the pool Worker has a Cron Trigger every minute that wakes singletons and crons, even when there are none
   (`Cloudflare/PoolWorker.ts:57-59`). A persisted call over 2 MB is refused with `PersistenceError`, a persisted reply
   over it is replaced by a defect (`internal/EntityRuntime.ts:336-344`, `:719-722`).
3. **The gateway and its token.** The pool Worker serves every hosted class at `/rpc` on its `workers.dev` address,
   behind a bearer token, a 32-byte `Random` named `DefaultGatewayToken` kept in the Stack's state
   (`Cloudflare/DurableObjectPool.ts:137-139`, `Cloudflare/PoolWorker.ts:101-123`). Callers never handle the token:
   Alchemy binds it into each caller as `CLUSTER_Allowance_TOKEN` (`Entity.ts:579`). Keep the token in the Stack's
   state only; whoever has it reaches the pool from the internet.
4. **The Effect-native caller.** One `Cloudflare.Worker` with `main: import.meta.url` and an implementation that
   `yield* Allowance` in its init phase. Deploying it gives it a service binding to the pool Worker
   (`Cloudflare/DurableObjectPool.ts:25-41`, `internal/Gateway.ts:98-104`), provided the implementation was built first
   (step 5). Its `fetch` answers the app's Worker: take a call for the organization id and call id it is given. Give it
   no public address (`workersDev: false`, no `domain`) so only the service binding reaches it, and let the app's
   Worker resolve the actor and its organization before it calls.
5. **The stack** (`packages/infra/src/Inventory.stack.ts`): providers become
   `Layer.mergeAll(Cloudflare.providers(), Cluster.providers())` (line 59, as `cluster/cloudflare.mdx` shows); the
   stack's Effect gets `AllowanceLive` provided beside `InfraStage.layer` (line 150), so the class is deployed before
   the caller; it `yield*`s the caller Worker and passes it in the `Website.Vite` `env` (for example
   `ALLOWANCE: caller`), which becomes a service binding (`Workers/Worker.ts:855-884` in the installed
   `@alchemy.run/cloudflare@2.0.0-beta.87`).
6. **The app.** A new `AllowanceStore` adapter in `packages/access/host/src/` calls `env.ALLOWANCE.fetch(...)` with the
   reservation's organization and id, through the existing port, so `takeModelCall` and every feature that asks it are
   unchanged. It replaces `AllowanceStoreD1` as the port's Layer in production.

New things to pay for and run: two more Workers and Durable Objects with SQLite storage on the same Cloudflare
account, a Cron Trigger firing every minute, and alarms every 5 seconds per live instance. No server. Prices not
verified here. The same Effect-native caller Worker is where the workflow engine and a Drizzle object go if those are
built ([cluster-workflows.md](./cluster-workflows.md), [drizzle-durable-objects.md](./drizzle-durable-objects.md)), so
the app gains one Worker of its own, not three.

### The other hosts

- **Node runners elsewhere with Postgres.** A Node pool (`ClusterDocker.SwarmPool`, `ClusterFly.MachinePool`,
  `ClusterAWS.EcsPool`, `ClusterGCP.ComputeEnginePool`, `ClusterHetzner.ServerPool`, `ClusterKubernetes.DeploymentPool`)
  runs Effect's real sharding on `NodeClusterHttp` with `storage: "sql"` on Postgres (`internal/Bootstrap.ts:165-170`).
  A runner is a long-lived server: it registers a host and port, holds and refreshes shard locks, serves the runner
  protocol that other runners dial over HTTP, and keeps background loops running (`effect` 4.1.4
  `src/cluster/HttpRunner.ts:62-69`, `Runners.ts:409-458`). A Worker has no address another process can dial and no
  scope that outlives a request, so Workers cannot be runners; they call the gateway. Warning: only Fly's gateway is
  HTTPS (`https://{name}.fly.dev`, `Fly/MachinePool.ts:64`); on AWS, GCP and Hetzner it is plain HTTP on a public
  address (`AWS/internal/Gateway.ts:77`, `GCP/ComputeEnginePool.ts:124`, `Hetzner/ServerPool.ts:86`), so the bearer
  token crosses the internet unencrypted, and no pool option adds TLS. At beta.87 the database must be the same cloud's
  `Database` Layer (for example `ClusterFly.Database`), because `fromUrl` fails with every Node pool; on main,
  `fromUrl` with a managed Postgres works. It costs a second cloud account, an always-on runner, a Postgres with a
  disk, and the gateway's load balancer where the cloud uses one. The runners could reach the app's data only through
  the app's own API.
- **D1 as the cluster's database: does not work**, for three separate reasons:
  1. Alchemy's runners connect with `PgClient` only (`internal/Bootstrap.ts:170`, `:312`); the `Database` contract is a
     Postgres URL (`Database.ts:62-67`).
  2. Effect's D1 client dies on a transaction, and Effect's SQL storage uses one at start-up and on every poll on
     SQLite. The D1 client's `transactionAcquirer` is `Effect.die("transactions are not supported in D1")`
     (`@effect/sql-d1` 4.1.4 `src/D1Client.ts:340`), and `withTransaction` acquires its connection through it (`effect`
     4.1.4 `src/sql/SqlClient.ts:343`, `:355`); its `batch` runs on the binding and cannot join a transaction
     (`D1Client.ts:184`). D1 compiles as SQLite (`D1Client.ts:219`), so the storage takes its SQLite branches: the
     migrations run in a transaction on every dialect but ClickHouse (`effect` 4.1.4 `src/sql/Migrator.ts:260-263`,
     `:352`), and the poll that claims unprocessed messages, saving a message, acks and every reply are each a
     transaction on SQLite (`src/cluster/SqlMessageStorage.ts:420-427`, `:638-668`, `:731`, `:779`). `SqlRunnerStorage`
     takes shard locks in a transaction on SQLite and MSSQL (`SqlRunnerStorage.ts:418-454`); on PostgreSQL and MySQL it
     holds advisory locks on a reserved connection instead (`:107-167`). Skipping the migrations does not help. The
     failure is a defect, not a typed error.
  3. D1 is reachable only through a Worker binding, and Workers cannot be runners.
- **`SingleRunner`, a cluster in one process**, has the same wall: `SingleRunner.layer` always uses
  `SqlMessageStorage`, so it needs a SQL client with interactive transactions, and it keeps background loops running
  for the life of the process (`effect` 4.1.4 `src/cluster/SingleRunner.ts:61-79`). Whether it could run inside one
  Durable Object on that object's own SQLite was not verified: no Durable Object SQL driver for Effect is installed in
  the app.

- **Used today:** no. The allowance is `AllowanceStore.take` on the `modelCall` table
  (`packages/access/model/src/Allowance/AllowanceStore.store.ts`, D1 adapter
  `packages/access/host/src/AllowanceStore.adapter.ts`); imports are guarded D1 batches
  (`packages/catalog/host/src/ImportStore.adapter.ts`).
- **Where it goes:** an `Allowance` entity and its Layer beside the access model's ports; the pool, the caller Worker
  and the providers in `packages/infra/src/Inventory.stack.ts`; a new `AllowanceStore` adapter that calls the caller
  Worker through a service binding, in place of `AllowanceStoreD1`; the `modelCall` table
  (`apps/inventory/migrations/0001_init.sql:410-420`) kept as an audit or dropped.
- **What the person gets:** nothing they can see; the 40-calls rule holds as before, now enforced in one place per
  organization.

## How to check it

- Before any deploy, test the handler without a cluster: Effect's `Entity.makeTestClient(entity, layer)` (`effect`
  4.1.4 `src/cluster/Entity.ts:675`) runs an entity's handlers in a test (`Allowance.entity` is the Effect entity,
  `Entity.ts:169`). It needs a `Scope` and a `ShardingConfig` (`ShardingConfig.layerDefaults`), and the layer must
  register the entity through Effect's `Entity.toLayer`, or the client dies with "was not registered by layer"
  (`Entity.ts:715-719`). Provide an in-memory `InstanceStorage` in the test (only the Durable Object pool provides
  one). The rule to prove is rule 9: forty `Take`s for one organization succeed, the forty-first fails with
  `AllowanceUsedUp`, a call 24 hours after the first succeeds again (move the clock with `TestClock`), and a `Take`
  run twice with the same `callId` counts once. The test client passes messages in memory with no storage, so it does
  not check the pool's replay or its stored replies; that is checked after a deploy.
- For an entity on a Node pool, `TestRunner.layer` is a whole cluster in memory (`effect` 4.1.4
  `src/cluster/TestRunner.ts:31-38`), with `MessageStorage.layerMemory` answering a second save with `Duplicate`.
  This checks Effect's storage, not the Durable Object pool's own mailbox. Not run.
- After a deploy, `/health` on the gateway answers without the token (`internal/Gateway.ts:335-337`); a call without
  the token gets 401 (`:338-340`).
- The deploy itself checks wiring: `Cluster.HasNoPool` when an implementation has no pool
  (`internal/HostedRuntime.ts:101-108`), `Cluster.EntityMiddlewareMissing`, `Cluster.PoolProgramConflict`,
  `Cluster.DatabaseNetworkMismatch`.
- Nothing here was run: the trials of 2026-11-19 ran the domain library in memory only, never a cluster or a deploy.

## What it needs

- Host: Effect Cluster itself. For this app, `@alchemy.run/effect-cluster/Cloudflare` with `@alchemy.run/cloudflare`
  (Durable Objects, no database). Elsewhere, a Node pool plus Postgres on Docker, AWS, GCP, Kubernetes, Fly or Hetzner.
- `@alchemy.run/effect-cluster@2.0.0-beta.87` (npm `latest`) for the Durable Object pool, with Effect 4.1.3 or later
  (the app has 4.1.4); `fromUrl` with a Node pool needs main.
- An Effect-native Alchemy runtime for every caller: one `Cloudflare.Worker` with an implementation beside the app's
  `Website.Vite` Worker, reached by service binding.
- For a domain model on entities: [host-effect-cluster.md](./host-effect-cluster.md).

## Verdict

**Use:** run the model-call allowance as an `Allowance` entity on `ClusterCloudflare.DurableObjectPool`, its counted
calls (id and time) in `InstanceStorage`, with `disableFatalDefects: true`, called from one Effect-native
`Cloudflare.Worker` that the app's `Website.Vite` Worker reaches by service binding; the `AllowanceStore` port stays
and its D1 adapter is replaced. This works on beta.87. It is the same decision as the Drizzle object for the allowance
([drizzle-durable-objects.md](./drizzle-durable-objects.md)): pick one.

What it cannot do: an entity cannot read or write D1 on the Durable Object pool, at beta.87 or main, because the
pool's Worker is declared by the pool with three string values and its own Durable Object namespaces,
`DurableObjectPoolOptions` has only `name`, and a class's outer phase has no `Worker` for a D1 binding to attach to
(`Cloudflare/DurableObjectPool.ts:43-49`, `:141-157`; `Entity.ts:137-139`). What would remove it: a pool option for
extra bindings. The nearest that works: keep the D1 work in the Effect-native caller Worker, which can bind D1, and keep
in entities only what lives in their own objects. D1 as the cluster's storage cannot work at all (Postgres-only runner;
Effect's D1 client dies on the transactions the SQL storage needs); `fromUrl` with a Node pool needs main.

## Where this was read

- https://alchemy.run/cluster/what-is-effect-cluster and https://alchemy.run/cluster/cloudflare (the live site
  documents beta.87)
- `website/src/content/docs/cluster/{index,what-is-effect-cluster,setup,entities,calling,middleware,pools,databases,existing-programs,cloudflare,aws,docker,fly,gcp,hetzner,kubernetes}.mdx`
  and `tutorial/part-1..4.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same, except `databases.mdx` changed
- `packages/effect-cluster/package.json` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/effect-cluster/src/{index,Entity,Pool,Host,Database,Providers,ShardGroups}.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: same
- `packages/effect-cluster/src/Cloudflare/{index,DurableObjectPool,PoolWorker}.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: same; `Cloudflare/internal/Objects.ts`: changed
- `packages/effect-cluster/src/internal/{Gateway,ObjectSharding,EntityRuntime,HostedRuntime,PoolHostService,Naming,WorkflowGateway}.ts`
  at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same; `internal/{PoolHost,Bootstrap}.ts`: changed
- `packages/effect-cluster/src/{AWS,Docker,Fly,GCP,Hetzner,Kubernetes}/*` at `v2.0.0-beta.87`; on `main@dbfd0ddb`:
  every pool file changed, database files same
- `packages/cloudflare/src/Website/Vite.ts`, `Workers/{Worker,Source}.ts`, `Workers/Sources/{Vite,Rolldown}.ts`,
  `D1/QueryDatabaseBinding.ts`, `packages/alchemy/src/Platform.ts` on `main@dbfd0ddb`; `Website/Vite.ts`,
  `Workers/Worker.ts` and `D1/QueryDatabaseBinding.ts` also in the installed `@alchemy.run/cloudflare@2.0.0-beta.87`
- `packages/domain/src/EffectCluster/index.ts` on `main@dbfd0ddb` (how it reads `InstanceStorage`)
- `examples/cluster-domain` (both refs, outline) and `examples/effect-cluster-rooms` (main only, outline)
- `effect` 4.1.4 (the app's installed copy): `src/cluster/` (every file, `internal/` included), `src/sql/SqlClient.ts`,
  `src/sql/Migrator.ts`, `src/rpc/Rpc.ts`; `@effect/sql-d1` 4.1.4 `src/D1Client.ts`
- The app: `packages/infra/src/Inventory.stack.ts`, `apps/inventory/src/server/worker.ts`,
  `packages/access/model/src/Allowance/*`, `packages/access/host/src/AllowanceStore.adapter.ts`,
  `apps/inventory/migrations/0001_init.sql`
