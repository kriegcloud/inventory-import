---
type: Reference
title: Host on Rivet
description: The Layer that runs a domain model on Rivet Durable Objects (actors with their own SQLite) on a pool of nodes in any cloud, and what inventory-import would have to add to use it.
tags: [alchemy-domain, host]
---

# Host on Rivet

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

`DomainRivet.layerDurableObjects` is a [platform](./platform-contract.md) Layer, like
`DomainCloudflare.layerDurableObjects()` or `Domain.InMemory`: provide it to the model's Layer and the model runs on
Rivet. Every object of the model (an aggregate instance, a view key, a policy, a projection key, a stream key, a saga
run) becomes an actor of ONE Rivet Durable Object class that you name, and each actor keeps its data in its own
SQLite. The actors run on nodes in a pool you choose (AWS, GCP, Fly, Hetzner, Kubernetes, Railway, a Docker swarm or
Rivet Cloud), behind a Rivet control plane. The code that serves the Api can run anywhere that reaches the control
plane's address; from a Cloudflare Worker, that means a control plane with a public HTTPS address. The docs: "every
aggregate instance, view key and policy runs as a Rivet actor with its own SQLite" [https://alchemy.run/domain/rivet].

## When to reach for it

- When the model must run outside Cloudflare (another cloud, your own machines) but keep the Durable Object shape:
  one actor per instance, one command at a time, its own storage, alarms.
- When you already run a Rivet control plane and pool for other actors.
- Not for this app as it stands: it deploys one Cloudflare Worker, and Cloudflare's own Durable Objects host the same
  model with no pool to run (see [host-cloudflare](./host-cloudflare.md)).

## How it is declared

```ts
// SKETCH: not compiled
import * as RivetCloud from "@alchemy.run/rivet/Cloud"
import * as DomainRivet from "@alchemy.run/domain/Rivet"
import * as Layer from "effect/Layer"
import { Catalog, CatalogHandlers } from "@inventory/catalog-model/Catalog.model"

const ControlPlane = RivetCloud.ControlPlane("Rivet") // a public https://<slug>-api.onrivet.dev
const Default = RivetCloud.Pool("Default").pipe(Layer.provide(ControlPlane))

// The nodes import this module's default export to run the model.
export default Catalog.layer(CatalogHandlers).pipe(
  Layer.provide(DomainRivet.layerDurableObjects({ name: "Catalog", main: import.meta.url, pool: Default }))
)
```

`DurableObjectsOptions<PoolReq>`:

- `name`: the Rivet Durable Object class that hosts the whole model; its actors' name.
- `main`: the module whose export holds the model's Layer (usually `import.meta.url`); the pool's nodes load it.
- `handler`: which export of `main` (default `"default"`).
- `pool`: a `Layer<PoolHost, never, PoolReq>`, such as `RivetCloud.Pool("Default")` or `RivetAWS.EcsPool("Default")`.

The Layer provides `Platform`, `WorkflowEngine` and `SecureRandom` (Web Crypto), and requires the pool's
requirements and Rivet's `Providers`. It behaves two ways:

- **In a caller** (a Worker, a Lambda, a container serving the Api): it deploys the class to the pool and reaches it
  through the control plane's gateway. The caller needs no RivetKit and no route to the nodes, only to the control
  plane's `clientEndpoint` (`packages/rivet/src/internal/PoolHost.ts:201-206`).
- **On a node** (when `NodeHost` is present): it hosts the class, and calls between the model's objects also go
  through the control plane, because the object they reach may run on another node. It reads `RIVET_ENDPOINT`,
  `RIVET_TOKEN`, `RIVET_NAMESPACE` and `RIVET_POOL` (each defaults to empty).

Layout: an object of class `Catalog.ImportAggregate` named `imp-42` is the actor `Catalog.ImportAggregate/imp-42`
(`multiplexed`). Storage is the actor's key-value storage over its SQLite (tables `_alchemy_kv` and `_alchemy_meta`,
`packages/rivet/src/DurableObjectState.ts:152-153`); the control plane keeps the durable copy in its own object
storage (S3, GCS, a Tigris bucket, or one engine's disk). Alarms are the actor's alarm, retried 6 times from 2 s,
doubling (`DurableObjectState.ts:168-171`); a storage transaction dies with `Rivet.TransactionTimedOut` after 30 s by
default (`:64-77`, `:173`); a call back into an instance from its own transaction fails with HTTP 508
(`Rivet.DurableObjectDeadlock`, `internal/Calls.ts:21-32`). Sagas run on Alchemy's Durable Object workflow engine,
each execution an actor `<Workflow>/<executionId>` with its journal in that actor's SQLite. A Rivet actor runs its
calls in parallel (`packages/rivet/src/DurableObject.ts:340-343`), so the host gives each instance Cloudflare's input
gate (`InputGate`) to keep one command at a time. Live reads: over `Domain.protocolWebSocket` the actor accepts the
WebSocket the gateway carries to it and pushes every commit; over `Domain.protocolHttp` a live read is a streamed
response that polls the actor.

Checked in: `packages/domain/src/Rivet/index.ts:54-59` (`InstanceBuild`), `:61-97` (storage), `:99-140` (engine
state), `:142-156` (object state, sockets), `:163-178` (`connectTo`), `:204-239` (`multiplexed`), `:241-258`
(`DurableObjectsOptions`), `:265-294` (`hostClassPhase`, the input gate at `:267-269`), `:296-402`
(`layerDurableObjects` and its doc), at `v2.0.0-beta.87`. Exported as `@alchemy.run/domain/Rivet`
(`packages/domain/package.json:33`, `:54-57`), with `@alchemy.run/rivet` an optional peer (`:103-104`).

### Types and helpers

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `layerDurableObjects` | The platform Layer | `Rivet/index.ts:356-402` |
| `DurableObjectsOptions` | `name`, `main`, `handler`, `pool` | `Rivet/index.ts:242-258` |
| `DomainShape` | What a host class's instance returns: `alarm` and its methods (internal plumbing, exported) | `Rivet/index.ts:181-184` |
| `DomainClassNotHosted` | Defect, tag `Rivet.DomainClassNotHosted`, when an actor's name names a class this model did not declare on the node | `Rivet/index.ts:187-189`, raised at `:274-279` |

### What main changes

- An instance's callbacks are provided as a `Callbacks` service instead of overriding `RuntimeContext.makeCallback`
  (`packages/domain/src/Rivet/index.ts:15`, `:55-60`, `:287-291` on `main@dbfd0ddb`), commit `97ff09fca` (#3215).
  Internal; the options are the same.
- The docs add that a [decision](./decision.md) has no actor of its own: the first instance it reads runs its commit
  across the others (`website/src/content/docs/domain/rivet.mdx:99`, `:112` on main). Decisions are unpublished.
- `packages/rivet` differs in one file: a node reads `Config` through `RuntimeConfigProviderLive`
  (`packages/rivet/src/internal/Bootstrap.ts:8`, `:38` on main), so an environment string that looks like JSON
  (`"false"`, `"1.0"`) reads unchanged and `ALCHEMY_PHASE` always reads `"runtime"`
  (`packages/alchemy/src/Runtime.ts:36-76`), commit `dbfd0ddb` (#3518).

## Rules, and the mistakes to avoid

- **A Worker cannot reach a Docker control plane.** `RivetDocker.SwarmControlPlane` gives callers
  `http://rivet-engine:6420`, an alias on the swarm's overlay network (`packages/rivet/src/Docker/SwarmControlPlane.ts:100-108`),
  and is meant only for development and tests (`:41-43`); `SwarmPool` joins only a Docker network
  (`Docker/SwarmPool.ts:59`). The domain package's own doc example pairs a Worker with it; that works only on the
  swarm network.
- **Backfill waits for no deploy.** The Rivet host has no `Host.backfill`, so a deploy that adds or rebuilds a view
  or projection returns at once and the first Domain call after it starts the runs
  (`packages/domain/src/DurableObjects.ts:191-200`, `:2101-2108`; `rivet.mdx:121`). Check `history` before trusting a
  new view. See [backfill](./backfill.md).
- **One class per model,** named by `name`. Two models on the same class collide (`claimKey`, `Rivet/index.ts:220`).
- **Actors with open live reads stay awake.** Rivet 3 does not hibernate WebSockets yet
  (`website/src/content/docs/rivet/durable-objects.mdx:164`), so every open `watch` keeps its actor in memory.
- **No Cloudflare binding on a node.** Nodes run the model bundled for `platform: "node"` in a Bun process
  (`oven/bun:1` with `rivetkit@3.0.0`), or in Node on Fly and GCP Compute Engine (`internal/PoolHost.ts:36-42`,
  `:363`; `internal/Bootstrap.ts:34`; `GCP/ComputeEnginePool.ts:21`). It never runs in workerd, so a model whose
  Layer needs D1 cannot run there.
- **Same guarantees as Cloudflare:** one command at a time per instance; events, state and reply commit together in
  the actor's SQLite or not at all; deliveries at least once and in order per source, across a node restart;
  scheduled commands on the actor's alarm (`rivet.mdx:107-111`).
- **Limits stated outright.** Nothing in `packages/rivet` is marked experimental. Rivet Cloud runs one runner pool
  per cluster for now, so one stage at a time can host nodes there; its free plan allows `e2-micro` or `e2-small`
  and one node; and it bakes the nodes' environment, secrets included, into the image Rivet stores
  (`Cloud/Pool.ts:22-49`). Deploying a Docker or Rivet Cloud pool builds images with the local `docker` CLI.
  `@rivetkit/effect`, which this host does not use, is in beta (`rivet/actors.mdx:79`).

## In this app

The app is one Cloudflare Worker with D1 (`packages/infra/src/Inventory.stack.ts`, `apps/inventory/wrangler.jsonc`).
To host its model on Rivet it would also need:

- a Rivet control plane the Worker can reach over HTTPS: `RivetCloud.ControlPlane` (Rivet runs it), or one the Stack
  runs on AWS, GCP, Fly or Hetzner (table below);
- a pool of nodes somewhere that is not Cloudflare (no pool in `packages/rivet/src` runs on Cloudflare);
- the model's handlers rewritten so nothing on a node needs D1: today `ImportStore`, `ItemStore` and the access
  stores are D1 adapters (`packages/catalog/host`, `packages/access/host`). Events and state would live in the
  actors' SQLite. The Worker keeps its D1 binding, so its own Api handlers can still write D1 after a command
  returns; a [projection](./projection.md) or policy on a node cannot. The only routes from a node are Cloudflare's
  D1 HTTP API with an account token held on the nodes, or a call back into the Worker; neither is in this library,
  and neither was verified.
- the control plane's endpoint, namespace, pool and **admin token** in the Worker, bound at deploy as
  `RIVET_Catalog_ENDPOINT`, `_TOKEN`, `_NAMESPACE`, `_POOL` (`DurableObject.ts:545-558`). That token can do anything
  on the control plane in every namespace (`website/src/content/docs/rivet/tokens-and-networks.mdx:20`).

Worked example: the Worker keeps serving `/api/v1/imports`, provides the Rivet-hosted `CatalogLive`, and a confirm
becomes a call through the gateway to the actor `Catalog.ImportAggregate/<importId>` on a node. Behind an AWS control
plane, CloudFront ends a call that has not answered in 60 s with a 504 (`AWS/internal/ControlPlane.ts:373-375`).

The trial on 2026-11-19 ran the app's `Import` aggregate in memory only, on beta.87 and on main; no Rivet host was
run.

- **Used today:** no. The app writes D1 directly from one Worker.
- **Where it goes:** a new pool and control plane in `packages/infra/src/Inventory.stack.ts`; the model's Layer in
  `apps/inventory/src/server/App.ts`.
- **What the person gets:** nothing they can see; the app would cost a server pool to run.

## How to check it

- The same stories run in memory for the model, unchanged (`Domain.InMemory`); the trial on 2026-11-19 did that for
  the `Import` aggregate.
- After a deploy, send a command through the Worker and read it back; the actor's id in the Rivet dashboard follows
  `<Model>.<Class>/<key>`. A class with no pool fails the deploy with `Rivet.DurableObjectHasNoPool`
  (`DurableObject.ts:237`, `:301`).
- For a new view, read its `history.complete` after the first call.

## What it needs

`@alchemy.run/rivet` (published at `2.0.0-beta.87`), `Rivet.providers()` in the Stack, a control plane and a pool,
and Docker on the deploying machine for Docker and Rivet Cloud pools. The host works on beta.87 and is unchanged in
its options on main. Where each runs (files under `packages/rivet/src`):

| Control plane / pool | Address a caller gets | Reachable from a Worker |
| --- | --- | --- |
| `RivetCloud.ControlPlane` / `Pool` (`Cloud/`) | `https://<slug>-api.onrivet.dev` (`Cloud/Cluster.ts:24`) | yes |
| `RivetAWS.Ec2ControlPlane`, `EcsControlPlane` / `EcsPool`, `Ec2Pool` (`AWS/`) | a CloudFront `https://` address | yes |
| `RivetGCP.ComputeEngineControlPlane` / `CloudRunPool`, `ComputeEnginePool` (`GCP/`) | a Cloud Run `https://….run.app` proxy | yes |
| `RivetFly.MachineControlPlane` / `MachinePool` (`Fly/`) | `https://{app}.fly.dev` | yes |
| `RivetHetzner.ServerControlPlane` / `ServerPool` (`Hetzner/`) | a Caddy edge at `https://….sslip.io` | yes |
| `RivetKubernetes.StatefulSetControlPlane` / `DeploymentPool` (`Kubernetes/`) | a LoadBalancer on port 6420, plain HTTP by default | not verified |
| `RivetDocker.SwarmControlPlane` / `SwarmPool` (`Docker/`) | `http://rivet-engine:6420`, overlay network only | no |
| `RivetRailway.ServicePool` (`Railway/`) | a pool only, no control plane | with another control plane |
| `Rivet.ControlPlane` (`Cluster.ts:110-126`) | one you already run, by `endpoint` and admin `token` | if it is public |

The `ServicesPool` of each cloud hosts Rivet Services (Durable Streams), not Durable Objects, so it cannot host the
model (`Services.ts`, `internal/ServicesHost.ts`).

## Verdict

**Cannot yet:** this app deploys one Cloudflare Worker with D1. No Rivet control plane or pool runs on Cloudflare, and
code on a node is a Bun or Node process with no D1 binding. Two things would remove the blocker: a control plane the
Worker can reach over HTTPS (Rivet Cloud, AWS, GCP, Fly or Hetzner) with a pool on one of those, Railway or
Kubernetes; and a model whose handlers, projections and policies need no D1 binding. The nearest thing that works for
this deployment: the same model on `DomainCloudflare.layerDurableObjects()` inside the app's Worker (beta.87; see
[host-cloudflare](./host-cloudflare.md)), and `Domain.InMemory` for stories (run in the trial on 2026-11-19).

## Where this was read

- https://alchemy.run/domain/rivet (the live site documents beta.87)
- `website/src/content/docs/domain/rivet.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Rivet/index.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/DurableObjects.ts` (`Host`, deploy and first-call backfill) at `v2.0.0-beta.87`
- `packages/rivet/src` (all files) and its `package.json` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
  (`internal/Bootstrap.ts` only)
- `website/src/content/docs/rivet/{actors,durable-objects,pools,calling,tokens-and-networks,rivet-cloud}.mdx` at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/alchemy/src/Runtime.ts` on `main@dbfd0ddb`
