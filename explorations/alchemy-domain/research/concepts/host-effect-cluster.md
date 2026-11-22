---
type: Reference
title: Host on Effect Cluster
description: The Layer that runs a domain model as entity ids of one Effect Cluster entity, with its state in the cluster's Postgres (or in Durable Objects on the Cloudflare pool), and what inventory-import would need to use it.
tags: [alchemy-domain, host]
---

# Host on Effect Cluster

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

`DomainCluster.layerEntities` is a [platform](./platform-contract.md) Layer: provide it to the model's Layer and the
model runs on [Effect Cluster](./cluster.md). Every object of the model (an aggregate instance, a view key, a policy,
a projection key, a stream key) is an entity id of ONE entity type that you name, and sagas run on the pool's
workflow engine: Effect Cluster's own on a Node pool, Alchemy's Durable Object engine on
`ClusterCloudflare.DurableObjectPool`. Entities run on the runners of a pool you give it. On a pool that shares a
database (Docker, AWS, GCP, Fly, Hetzner, Kubernetes) each instance's data is rows of one Postgres table; on
`ClusterCloudflare.DurableObjectPool` each instance runs in its own Durable Object and keeps its data there, with no
database and no runners. The docs: "every aggregate instance, view key and policy is an entity id of one entity"
[https://alchemy.run/domain/effect-cluster].

## When to reach for it

- When the model should live on Postgres and long-running runners, beside other Effect Cluster entities, workflows
  and singletons.
- When the owner's wider architecture already standardises on Effect Cluster (see "The owner's other repository"
  below).
- On Cloudflare, as a second way to put the model on Durable Objects, through Effect Cluster's own pool.

## How it is declared

```ts
// SKETCH: not compiled
import * as ClusterDocker from "@alchemy.run/effect-cluster/Docker"
import * as DomainCluster from "@alchemy.run/domain/EffectCluster"
import * as Layer from "effect/Layer"
import { Catalog, CatalogHandlers } from "@inventory/catalog-model/Catalog.model"

export const Database = ClusterDocker.Database("Inventory")
const Runners = ClusterDocker.SwarmPool("Runners", { replicas: 2 }).pipe(Layer.provide(Database))

// The runners import this module's default export to host the model.
export default Catalog.layer(CatalogHandlers).pipe(
  Layer.provide(DomainCluster.layerEntities({ name: "Catalog", main: import.meta.url, pool: Runners }))
)
```

`EntitiesOptions<PoolReq>`: `name` (the entity type that hosts the model), `main` (the module the runners load),
`handler` (its export, default `"default"`), `pool` (a `PoolLayer<PoolReq>`). The Layer provides `Platform`,
`WorkflowEngine` and `SecureRandom` (Web Crypto), and requires the pool's requirements and Effect Cluster's
`Providers`.

What it does, read from the source:

- **One entity, three RPCs.** `Call` (a method and JSON arguments, as text), `Wake` (persisted, delivered at its
  `DeliverAt`: the instance's alarm), and `Live` (a stream of frames for a live read). The entity's concurrency is
  `"unbounded"`; each instance has its own input gate, so commands to one instance still run one at a time.
- **Ids.** `Catalog.ImportAggregate/imp-42` is the entity id of the aggregate instance `imp-42`; a saga's runs are
  reached through `~workflows/<workflow name>`.
- **Storage.** If the pool provides `InstanceStorage` (the Durable Object pool does), the instance uses its Durable
  Object's storage. Otherwise it uses the table `alchemy_domain_objects (object, key, value)` with
  `PRIMARY KEY (object, key)` and keys collated `"C"`, values as JSON text, in the Postgres named by
  `CLUSTER_DATABASE_URL` (one `PgClient` per runner, opened on the first instance, which also creates the table). A
  transaction is `sql.withTransaction` held inside the instance's gate.
- **Caller or runner.** On a runner (`RunnerHost` present) it hosts the entity and holds saga registrations until the
  runner has joined, then registers them with the `WorkflowEngine` the runner was launched with
  (`EffectCluster/index.ts:760-768` on main): Effect's `ClusterWorkflowEngine.layer` on a Node pool
  (`effect-cluster/src/internal/Bootstrap.ts:359-361` at beta.87, `:351-353` on main), Alchemy's Durable Object engine,
  one `ClusterWorkflow` object per execution, on the Durable Object pool (`Cloudflare/PoolWorker.ts:94-99`).
  In a caller it deploys the entity to the pool and reaches it through the pool's gateway; a saga's `execute`,
  `poll`, `interrupt`, `resume` and signals go through the
  `~workflows` entity, while steps, waits and sleeps die with `DomainEngineNotStarted` outside the cluster.
- **Live reads.** The caller holds the WebSocket; the owning entity pushes frames to it over the streamed `Live`
  call. The entity holds no socket. Over `Domain.protocolHttp` a live read is a streamed response that polls.
- **Shard group.** The entity and the sagas' workflows take `CLUSTER_SHARD_GROUPS` from the environment (default
  `"default"`).

Checked in: `packages/domain/src/EffectCluster/index.ts:70-85` (`Wake`), `:134-161` (`connectTo`), `:163-188`
(RPCs, entity), `:196-268` (`TABLE`, storage, `migrate`), `:270-279` (errors), `:289-386` (`WORKFLOWS`, `remote`,
`remoteEngine`, the three refusals at `:382-384`), `:464-480` (`EntitiesOptions`), `:545-841` (`layerEntities`;
shard group `:556-559`, Postgres `:574-584`, `InstanceStorage` `:609-616`, concurrency `:740`, runner `:745-821`,
caller `:823-836`), at `v2.0.0-beta.87`. Exported as `@alchemy.run/domain/EffectCluster`
(`packages/domain/package.json:32`), with `@alchemy.run/effect-cluster` and `@effect/sql-pg` optional peers
(`:100`, `:109`). `InstanceStorage`: `packages/effect-cluster/src/Host.ts:49-68`;
`ClusterCloudflare.DurableObjectPool`: `packages/effect-cluster/src/Cloudflare/DurableObjectPool.ts:88-107`.

### Types and helpers

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `layerEntities` | The platform Layer | `EffectCluster/index.ts:545-841` |
| `EntitiesOptions` | `name`, `main`, `handler`, `pool` | `EffectCluster/index.ts:464-480` |
| `DomainClassNotHosted` | Defect, tag `Cluster.DomainClassNotHosted`, when an entity id names a class the model did not declare | `EffectCluster/index.ts:271-273` |
| `DomainEngineNotStarted` | Defect, tag `Cluster.DomainEngineNotStarted`, when a saga's step, wait or sleep runs outside the cluster | `EffectCluster/index.ts:276-278` |

### What main changes

- An instance's callbacks are provided as a `Callbacks` service instead of overriding `RuntimeContext.makeCallback`
  (`packages/domain/src/EffectCluster/index.ts:21`, `:191-195`, `:656-660` on `main@dbfd0ddb`), commit `97ff09fca`
  (#3215). Internal; options and storage are the same.
- The docs add that a [decision](./decision.md) has no entity id of its own: the first instance it reads runs its
  commit (`website/src/content/docs/domain/effect-cluster.mdx:106`, `:118-119` on main). Decisions are unpublished.
- The `examples/cluster-domain` model on main uses commands without `target` (the id moves into the input with
  `keyOf`); the source of its server package, which holds the host wiring, is the same; its tests
  (`packages/domain/test/Bank.story.test.ts`, `packages/server/test/BankHttp.test.ts`, `test/integ.test.ts`) changed.

## Rules, and the mistakes to avoid

- **Backfill waits for no deploy.** The host supplies no `Host.backfill`, so the first Domain call after a deploy
  starts the runs of new or rebuilt consumers (`packages/domain/src/DurableObjects.ts:2101-2108`;
  `effect-cluster.mdx:126-128`). See [backfill](./backfill.md).
- **The database is the state.** Every instance's events, state and outbox, and Effect Cluster's own runners, shard
  locks, persisted messages and workflow runs, live in that Postgres; losing it loses them. The Docker, GCP, Fly and
  Hetzner databases are one Postgres on one disk (Docker's own doc comment says for development and tests,
  `Docker/Database.ts:38`; Fly's, for development and small clusters, `Fly/Database.ts:47`); Kubernetes's has no
  volume, keeps its data in the pod
  and loses it when the pod is replaced (`Kubernetes/Database.ts:33-35`); AWS is RDS, single zone unless `multiAZ`
  (`AWS/Database.ts:32`, `:113`). For more, the docs suggest a managed Postgres through `Cluster.Database.fromUrl`
  (`website/src/content/docs/cluster/databases.mdx:62-69`), which works with a Node pool only on main: at beta.87
  every Node pool dies at deploy with `Cluster.DatabaseNetworkMismatch` for a database on no network
  (`effect-cluster/src/internal/PoolHost.ts:153-159`; main `:160-175`, with each pool's `network` or `cluster` option).
- **Callers never get `CLUSTER_DATABASE_URL`;** only runners do. A caller reaches the cluster through the gateway
  (`databases.mdx:53`).
- **The gateway is plain HTTP except on Fly.** AWS (a load balancer, port 80), GCP (a static address, port 34500) and
  Hetzner (a load balancer, port 80) carry the bearer token unencrypted from a Worker to the pool
  (`AWS/internal/Gateway.ts:77`, `GCP/ComputeEnginePool.ts:124`, `Hetzner/ServerPool.ts:86`); Fly's is
  `https://{name}.fly.dev` (`Fly/MachinePool.ts:64`). The Durable Object pool's is its Worker's public `workers.dev`
  address. Same at both refs.
- **A whole model is one entity type.** Two models with the same `name` collide (`claimKey`).
- **Same guarantees as the other hosts:** one command at a time per instance; events, state and reply in one Postgres
  transaction; deliveries at least once and in order per source, across a runner restart; scheduled commands are
  persisted messages delivered on whichever runner owns the instance when they are due (`effect-cluster.mdx:114-118`).
- **Nothing on the domain page calls this host experimental;** it is part of the `2.0.0-beta.87` prerelease. The
  owner's other repository records that its own stronger guarantees need library fixes not yet released (below).

## In this app

The app deploys one Cloudflare Worker with D1. Two ways it could host its model here:

1. **On `ClusterCloudflare.DurableObjectPool`.** The `examples/cluster-domain` server does exactly this
   (`packages/server/src/Cloudflare/Bank.ts`): the pool is a second Worker whose Durable Objects are the entity
   instances, each keeping its data in its own storage; the Api Worker reaches it through a service binding
   (`packages/server/src/Cloudflare/BankApi.ts`). No Postgres and no runners. The app would add that pool Worker to
   `packages/infra/src/Inventory.stack.ts` beside its own. One Worker cannot be both: the pool declares its own
   Worker, `<id>Pool`, with an entry it writes itself and fixed props, and its only option is `name`
   (`effect-cluster/src/Cloudflare/DurableObjectPool.ts:43-49`, `:61-86`, `:127`, `:141-157`). The model's Layer is
   built inside that Worker (`Cloudflare/PoolWorker.ts:94-99`), whose environment holds only three string values and
   the pool's Durable Object namespaces, so nothing the model's handlers, policies or sagas need from D1 (the app's
   stores and the Items table's search today) can be bound there. The pool's gateway is its Worker's public
   `workers.dev` address, guarded only by the bearer token (see [cluster](./cluster.md), "Rules"). It gains little
   over [host-cloudflare](./host-cloudflare.md), which needs no second Worker and waits for backfills at deploy.
2. **On Postgres.** It would need a Postgres database (`ClusterDocker.Database` locally, `ClusterAWS.Database` or a
   managed one through `Cluster.Database.fromUrl`, main only; see the rule above), a pool of runners where that
   database is reachable (ECS, Compute Engine, Fly, Hetzner, Kubernetes, or Docker locally; not Cloud Run, which
   cannot host runners because runners take connections from each other, `GCP/ComputeEnginePool.ts:96`), and handlers
   that do not need D1 on a runner: today
   `ImportStore`, `ItemStore` and the access stores are D1 adapters (`packages/catalog/host`, `packages/access/host`).
   The Worker could keep serving the screens and the Api and call the cluster through the gateway. None of this runs
   inside a Cloudflare Worker.

Worked example: a confirm sent from the Worker becomes a `Call` to the entity id `Catalog.ImportAggregate/<importId>`;
its events and state commit as rows of `alchemy_domain_objects` in one transaction (or in the instance's Durable
Object on the Cloudflare pool); the `ItemsTable` projection key for the organization is another entity id and receives
the events at least once, in order.

The trial on 2026-11-19 ran the app's `Import` aggregate in memory only, on beta.87 and on main; no Effect Cluster
host was run.

### The owner's other repository

The owner's beep-effect repository (read at its commit `9104da1490f`, 2026-11-19) says this about the host:

- `standards/ARCHITECTURE.md`, section "The Host" (`:557-594`), opens: Effect Cluster on Postgres is the first host
  (its decision D5). A pool hosts a model-first context when it meets four guarantees, each with a bound: no
  acknowledged write is overwritten (the commit re-reads the version and refuses when it moved); a runner that lost
  its shard cannot commit (the commit is fenced on shard ownership, through a connection pool named for the runner);
  after a runner dies every reaction happens exactly once within one lease plus wake latency (80 seconds on present
  constants); and a write sent to a frozen runner completes or fails within the caller's retry budget, is never
  stored twice, and a retry under the same id gets its receipt. Its conformance suite proves the first three on the
  cluster; two cases are proven in process only. It states that Effect Cluster meets them only with library fixes
  that no Alchemy release carries yet, to be carried as root patches until a release includes them, and that
  `@beep/alchemy-postgres` remains until then (`:588-593`). `Domain.InMemory` hosts stories and tests.
- One slice uses `@alchemy.run/domain` in production code today: `documents` vault-sync, on its own Postgres platform
  (`packages/drivers/alchemy-postgres`, "Postgres Platform and workflow-engine driver for @alchemy.run/domain"),
  wired in `packages/documents/server/src/Layer.ts:133-138` (`VaultSyncPassModel.layer(...)` with
  `AlchemyPostgres.layer(platformConfig)`). It is not on Effect Cluster, and `documents` is in the legacy seven-package
  shape (`domain`, `server`, `tables`, `use-cases`).
- No package under `packages/` has the four-package model-first shape (`contract`, `model`, `host`, `web`;
  `standards/ARCHITECTURE.md:361-372`). That shape exists only in `scratchpad/model-first-slices` (`authority`,
  `party`, `runs`), whose `party/host` depends on `@alchemy.run/effect-cluster` 2.0.0-beta.87 with a patch
  (`scratchpad/model-first-slices/package.json:57`).

So the owner's chosen host for model-first contexts is Effect Cluster on Postgres, and the library alone, as
released, does not yet meet that repository's guarantees.

- **Used today:** no. The app writes D1 directly from one Worker.
- **Where it goes:** a pool (and, for option 2, a database) in `packages/infra/src/Inventory.stack.ts`; the model's
  Layer in `apps/inventory/src/server/App.ts`.
- **What the person gets:** nothing they can see.

## How to check it

- The model's stories run in memory unchanged (`Domain.InMemory`); the trial on 2026-11-19 did that for the `Import`
  aggregate. `examples/cluster-domain` tests its model and its Http Api that way, and its `test/integ.test.ts` deploys
  the stack and drives the Api end to end (`BANK_TARGET` picks `docker`, `aws` or `cloudflare`).
- On Postgres, `SELECT object, count(*) FROM alchemy_domain_objects GROUP BY object` lists the instances that hold
  data.
- For a new view, read `history.complete` after the first call.

## What it needs

`@alchemy.run/effect-cluster` (published at `2.0.0-beta.87`), a pool, and either a Postgres database or the Durable
Object pool; `Cluster.providers()` (and `Cloudflare.providers()` for the Durable Object pool) in the Stack. Works on
beta.87, except `Cluster.Database.fromUrl` with a Node pool, which needs main (`internal/PoolHost.ts:160-175` and each
Node pool's new `network` or `cluster` option); the options are the same on main.

## Verdict

**Use:** to explore the owner's preferred host inside this app's Cloudflare deployment, run the model on
`ClusterCloudflare.DurableObjectPool` as a second Worker in the Stack, as `examples/cluster-domain` does (beta.87; not
run in the trial). Postgres runners are the part this deployment cannot run: they need a database and long-running
runners outside Cloudflare, and stores that are not D1. On the Durable Object pool the model's handlers, policies
and sagas cannot reach D1 (the pool's Worker has no D1 binding and no option for one), so only a model whose state
lives wholly in its instances belongs there. For the one Worker the app has today, the nearest thing that
works is the model on `DomainCloudflare.layerDurableObjects()` (see [host-cloudflare](./host-cloudflare.md)), with
`Domain.InMemory` for stories.

## Where this was read

- https://alchemy.run/domain/effect-cluster (the live site documents beta.87)
- `website/src/content/docs/domain/effect-cluster.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/EffectCluster/index.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/effect-cluster/src/Host.ts`, `packages/effect-cluster/src/Cloudflare/DurableObjectPool.ts`,
  `packages/effect-cluster/src/Cloudflare/internal/Objects.ts` (parts) at `v2.0.0-beta.87`
- `website/src/content/docs/cluster/databases.mdx`, `cluster/cloudflare.mdx` (parts) at `v2.0.0-beta.87`
- `examples/cluster-domain` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (domain model and tests)
- beep-effect: `standards/ARCHITECTURE.md` ("The Host", "Model-First Slice Topology"),
  `packages/drivers/alchemy-postgres` (package and README), `packages/documents/server/src/Layer.ts`,
  `scratchpad/model-first-slices` (folders and `package.json`)
