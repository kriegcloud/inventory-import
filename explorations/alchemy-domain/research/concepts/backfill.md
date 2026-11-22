---
type: Reference
title: Backfill
description: How a deploy hands a new or rebuilt view or projection the events recorded before it, and how inventory-import could rebuild its item table from import events at deploy instead of shipping a new SQL migration.
tags: [alchemy-domain, host]
---

# Backfill

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

A backfill is the work that gives a consumer added after its sources recorded events (a new view or
[projection](./projection.md), or one whose `version` was bumped) the history it missed, in the order the events
were recorded. Nobody runs a script: the deploy declares one run per consumer generation, the run walks a directory
of every source instance, and each key of the consumer reads or is pushed its part of the history, then switches to
live delivery. On Cloudflare the deploy waits for it; on Rivet and Effect Cluster the first call after the deploy
starts it. The docs say it in one line: "the new consumer receives the history recorded before it"
[https://alchemy.run/domain/backfill].

## When to reach for it

You never call it. You reach for the things that trigger it:

- Adding a [view](./view.md) or a [projection](./projection.md) to a model that already has events.
- Bumping a view's `version` (on its declaration) after changing what it computes, or a projection's `version` (on
  its Layer options) after its store was lost or its handler writes a new shape.
- Removing a consumer, which deletes its run along with its classes.

Policies never trigger it. A [policy](./policy.md) acts on new events only, so adding one never replays the past
(`packages/domain/src/CatchUp.ts:7-8`, and `:49`, where live routing always lets a policy's delivery through).

## How it is declared

There is nothing to declare by hand. The Cloudflare host declares a `Cloudflare.Domain.Backfill` resource (logical id
`DomainBackfillRun`, prefixed by the model name) beside the Worker, with every consumer's target id and plan, and a
Workflow (`DomainBackfill`) that starts each run and polls it. The one knob you set is how long a deploy waits:

```ts
// SKETCH: not compiled
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare"
import * as Layer from "effect/Layer"
import { Catalog, CatalogHandlers } from "./Catalog.model.ts"

export const CatalogLive = Catalog.layer(CatalogHandlers).pipe(
  Layer.provide(DomainCloudflare.layerDurableObjects({ backfillTimeout: "1 hour" }))
)
```

`backfillTimeout` is a `Duration.Input`, default "30 minutes"; the resource's own `timeoutSeconds` defaults to 1800.

What each piece is, read from the source:

- **The directory.** A tree of Durable Objects with one subtree per source (an aggregate or a view). A node's path is
  the source, a colon and a prefix of the instance's hash (FNV-1a over `source/id`, with murmur3's finalizer mixed in;
  `Import:a3`); instances register at depth 2 (`DEPTH`, 256 leaves per source), and a node that lists more than 256
  (`leafSize`) splits into 16 children by the next hex digit. It is only an index; runs read it.
- **A run**, one per consumer generation, held by one object. `begin(target, plan)` starts it once; a later `begin`
  with the same plan finds it `started` or `complete`, and one with a different plan answers `changed`. The deploy's
  Workflow then dies with `PlanChanged` (tag `BackfillPlanChanged`), and the deploy reports it as a `BackfillFailed`
  whose message is the sentence "<target> now reads X, but its backfill was started reading Y. Bump its version to
  rebuild it from every source's history."
- **Phases.** `unknown`, `discover`, `ready`, `complete`. A consumer keyed by its one source (`singleSource`) needs
  one pass: each key reads its own source's log. Any other needs two passes with a barrier: `discover` pushes every
  source's history to the keys (through a **scanner** per source instance), and only then `ready` tells each key to
  apply its buffer in `(at, stream, seq)` order (`orderKey`).
- **Relays.** The run's root lists the directory until it has at least 512 subtrees (`FRONTIER_SIZE`), then hands
  them to relays that each call at most 6 at once (`RELAY_FANOUT`, Cloudflare's limit on outgoing calls per
  invocation); a pass takes about log6 of the instances levels of calls, which the docs put at about eight levels for
  a million instances.
- **Pacing.** The root keeps up to `window` subtrees out at once, starting at 16 (`RUN_WINDOW`), in at most 6 calls
  (`RUN_CALLS`). The window grows while calls go through and halves (once per window) when Cloudflare refuses calls
  for the account's load (`overloaded` matches "too much load", "too many concurrent", "overloaded", "try again
  later", "exceeded its memory limit"). A relay gives an item back to the root after 3 refusals (`RELAY_REFUSALS`).
- **Sources** serve their stored rows on any code (old or new), and `handoff` switches a consumer to live delivery
  once a reader has read up to the source's version (`"live"`, `"more"` if rows were added since, `"stale"` on code
  without the target). Until then a commit withholds the consumer's deliveries (`routeCommit`), and the first such
  commit asks for a reader through a durable outbox, which catches an instance that no run listed.
- **Limits.** `defaultLimits`: 1,000 history rows per read (`page`), 25 instances per node step (`nodePage`), 5 calls
  at once (`concurrency`), 200 buffered rows applied per step (`apply`), retries after 30 s for a stale source, 1 s
  before the first retry, 5 s between polls, `leafSize` 256, `depth` 2. Any one call is bounded at 20 seconds.
- **Progress.** While it waits the deploy notes each run as "reading history" or "applying history", a percentage of
  subtrees done, instances done and calls refused (`describeProgress`).

Checked in: `packages/domain/src/Backfill.ts:12-40` (roles), `:85-92` (`Plan`), `:276-323` (`RunRpc`, `Begin`,
`samePlan`, `planChanged`, `PlanChanged`), `:326-343` (`Progress`), `:356-400` (`Limits`, `DEPTH`, `defaultLimits`),
`:416-447` (paths and hash), `:454-455` (`orderKey`), `:492-497` (`overloaded`), `:538` (the 20 second bound),
`:662-747` (`makeSource`), `:792-1010` (`makeScanner`), `:1064-1535` (`makeConsumer`), `:1545-1665` (`makeNode`),
`:1675-1944` (`makeRelay`, `RELAY_FANOUT`, `FRONTIER_SIZE`, `RELAY_REFUSALS`), `:1961-2175` (`makeRun`, `RUN_WINDOW`,
`RUN_CALLS`), `:2186-2202` (`routeCommit`); `packages/domain/src/Cloudflare/Backfill.ts:13-37` (`BackfillProps`,
`timeoutSeconds` default 1800), `:106-115` (`BackfillStillRunning`, `BackfillFailed`), `:127-132` (poll every second,
`MAX_RESTARTS` 30), `:204-212` (`describeProgress`), `:230-350` (reconcile), `:372-390` (`BackfillLocal`);
`packages/domain/src/Cloudflare/index.ts:303-397` (the `DomainBackfill` Workflow and `DomainBackfillRun`),
`:505-536` and `:632-639` (`backfillTimeout`, default "30 minutes"); `packages/domain/src/DurableObjects.ts:191-200`
(`Host.backfill`), `:2080-2110` (`history`, the deploy-time wait, else the first call starts each run); all at
`v2.0.0-beta.87`.

### Types and helpers

`packages/domain/src/Backfill.ts` is marked `@internal` (`:39`); it is reachable as `@alchemy.run/domain/Backfill`
only through the package's `./*` export. Nothing in it is meant to be called by an app. The Cloudflare file's
`Backfill`, `BackfillFailed` and `BackfillStillRunning` are re-exported from `@alchemy.run/domain/Cloudflare`
(`Cloudflare/index.ts:60`).

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `SourceRef` | An instance in the directory: `source`, `id`, and a rebuilt view key's `generation` | `Backfill.ts:71-79` |
| `withGeneration` | A `SourceRef` with its source's generation from the plan (internal) | `Backfill.ts:95-98` |
| `NodeRpc` | A directory node's calls: `register`, `child`, `list` (internal) | `Backfill.ts:100-108` |
| `Listing` | A page of a node's listing: `rows`, `children`, `next` (internal) | `Backfill.ts:111-116` |
| `SourceRpc` | A source's calls: `read`, `cursor`, `log`, `handoff` (internal) | `Backfill.ts:118-157` |
| `Handoff` | `"live" \| "more" \| "stale"`, what a source answers to `handoff` (internal) | `Backfill.ts:160` |
| `Pulled` | A page a key read from its source: `deliveries`, `live`, `through`, `end` (internal) | `Backfill.ts:172-186` |
| `ConsumerRpc` | A consumer key's calls: `push`, `ready`, `start` (internal) | `Backfill.ts:188-215` |
| `ScannerRpc` | A scanner's calls: `scan`, `ready`, `kick` (internal) | `Backfill.ts:222-229` |
| `RelayItem` | A directory node (`{ path }`) or a source instance (`{ ref }`) for a relay (internal) | `Backfill.ts:232` |
| `RelayRun` | One pass for one consumer: `target`, `plan`, `phase`, `deadline` (internal) | `Backfill.ts:235-247` |
| `RelayRpc` | A relay's one call, `run(name, run, items)` (internal) | `Backfill.ts:250-260` |
| `RelayResult` | What a relay answers: `done`, `refused`, `instances`, `failure` (internal) | `Backfill.ts:263-270` |
| `Network` | How the roles reach each other: `node`, `source`, `consumer`, `scanner`, `relay`, `run` (internal) | `Backfill.ts:346-353` |
| `sourceOfPath` | The source a node's path lists, or `undefined` for the root (internal) | `Backfill.ts:423-426` |
| `ScannerHost` | What a host gives a scanner: `route` (internal) | `Backfill.ts:754-763` |
| `Scanner` | The type `makeScanner` returns (internal) | `Backfill.ts:1012` |
| `ConsumerHost` | What a host gives a consumer key: `key`, `target`, `singleSource`, `history`, `sources`, `apply`, `after` (internal) | `Backfill.ts:1028-1057` |
| `Relay` | The type `makeRelay` returns (internal) | `Backfill.ts:1946` |
| `routeRows` | Route stored rows to one target only, as history (internal) | `Backfill.ts:2205-2225` |
| `consumerOf` | A consumer's kind and name from its target id (`view:Name#2` is the view `Name`) (internal) | `Backfill.ts:2227-2230` |
| `BackfillAttrs` | The resource's output: `accountId`, `workflowName`, `instanceId`, `targets`, `status` | `Cloudflare/Backfill.ts:39-47` |
| `progressOf` | Each run's progress from the latest `check-` step of the wait's Workflow instance (internal) | `Cloudflare/Backfill.ts:155-165` |
| `describeProgress` | One run's progress as the deploy notes it (internal) | `Cloudflare/Backfill.ts:205-212` |
| `BackfillProvider` | The resource's provider: `BackfillLocal` under `alchemy dev`, `BackfillLive` deployed; registered by `Cloudflare/Providers.ts:42` (internal) | `Cloudflare/Backfill.ts:392-396` |

On the Durable Object host each role is reached through RPC methods on the objects: `bfRunBegin`, `bfRunPhase`,
`bfRunProgress`, `bfRelayRun`, `bfScannerScan`, `bfScannerReady`, `bfScannerKick`, `bfConsumerReady` (internal;
`DurableObjects.ts:693-730`, `:1184`).

### What main changes

- An instance now lists itself in the directory just after its first commit returns, not inside it. The commit
  records that the instance still has to be listed, and when it is listed it asks for the history of any consumer
  deployed in between: `SourceHost.targets` and `catchUp` are new (`packages/domain/src/Backfill.ts:643-644`,
  `:711-745` on `main@dbfd0ddb`); the docs page's "How the work spreads out" says the same
  (`website/src/content/docs/domain/backfill.mdx:23`). Commit `e596b3278` (#3373).
- The deploy's wait now retries `getInstance` for up to a minute (30 tries, 2 seconds apart, on `InstanceNotFound`
  or `WorkflowInternalError`) right after creating the Workflow instance, because a Workflow uploaded in the same
  deploy can read as missing (`retryJustStarted`, `packages/domain/src/Cloudflare/Backfill.ts:154-165`, `:296-306`
  on main). Commit `2d57c6bc3` (#3379).
- `backfillTimeout` moved lines only (`packages/domain/src/Cloudflare/index.ts:514`, `:521`, `:650` on main).
- Every constant on this page is unchanged on main (`Backfill.ts:387`, `:389-399`, `:1697`, `:1706`, `:1729`,
  `:1983`, `:1986` on main).

## Rules, and the mistakes to avoid

- **The deploy waits on Cloudflare only.** `Cloudflare/index.ts` supplies `Host.backfill`; Rivet and Effect Cluster
  do not (neither file mentions a backfill), so there the first Domain call in each isolate starts each run
  (`DurableObjects.ts:2101-2108`) and the deploy returns at once. Read the view's `history` (`{ complete }`) before
  trusting a new view there.
- **Past `backfillTimeout` the deploy fails with `BackfillStillRunning`** (`message`, `instanceId`) and the run keeps
  going. Deploy again and it waits on the same run from where it is. Ctrl-C is the same. Nothing is done twice: every
  step records its progress before it answers and is idempotent (`Backfill.ts:35-38`).
- **`BackfillFailed`** (`message`, `instanceId`, `status`) is the other failure. A terminated wait instance, or one
  that errored because it started on an edge without the new Worker, is started again, up to 30 times, 2 seconds
  apart; any other error, or the 31st, fails the deploy (`Cloudflare/Backfill.ts:313-337`). A plan change arrives
  this way too, with the plan-changed sentence as the whole message.
- **Changing what a consumer reads needs a version bump.** A run reads the sources its consumer read when it
  started; the deploy refuses a consumer that now reads other sources at the same version.
- **A rebuilt view keyed by the one aggregate it reads is rebuilt in place,** with no backfill (each key re-reads its
  instance's events when first touched; `Kernel.ts:740-748`). Every other rebuilt view, and every rebuilt
  projection, gets a new class and a new run; the same Worker upload deletes the previous generation, its data and
  its run.
- **A projection's own store is yours.** The engine replays the inputs; it does not empty your table. The source
  says to clear or migrate your store first if a replayed write would not overwrite the old row
  (`Projection.ts:51-57`). There is no hook for that in the projection's `Options` (only `batch` and `version`).
- **Writes are at least once.** Key each written row so a repeat overwrites or is ignored (`Projection.ts:32-35`).
- **One key's history is applied in order,** so its time grows with its own history. A single key every instance
  feeds (one total for an organization) is the slowest part; partition it.
- **Measured times** the docs give for a rebuild of a per-account view, 10 events per account: 10,000 accounts, 13
  seconds; 100,000, 58 seconds; 1,000,000, 8 minutes, at about 2,000 keys a second. Past about 100,000 instances the
  account's Durable Object rate cap sets the pace, not the tree (`backfill.mdx:67-77`).
- **The platform's limits** the docs list for a large Domain: one object handles about 1,000 requests a second and
  stores up to 10 GB; one request runs at most 6 calls at a time; an object lives where it was first created; a
  deploy rolls out over minutes, so code must stay compatible across one deploy (`backfill.mdx:91-105`).
- **Cost:** a backfill is billed as Durable Object work (requests, rows, duration). Each consumer added or rebuilt in
  one deploy is its own backfill.
- **`alchemy dev`** waits for nothing: `BackfillLocal` reports `complete` and the local Domain backfills on its first
  call.

## In this app

Today the `item` table is written directly: the confirm's D1 batch inserts and replaces rows
(`packages/catalog/host/src/ImportStore.adapter.ts`, `commit`), `ItemStore.edit`
(`packages/catalog/host/src/ItemStore.adapter.ts`) changes one row, and take-back removes or restores rows. A change
to `item`'s columns is an edit of `apps/inventory/migrations/0001_init.sql` followed by `bun run db:reset` locally
(the file's header says a later change is a new numbered file).

With the domain, `item` becomes a projection's store. The facts live as events: `ItemsImported` (one per confirm,
with each created or replaced row's values), `ItemsTakenBack`, `ItemEdited`. A change of what a row holds is then a
projection `version` bump: the deploy replays every organization's events into the table. Those are the events the
model itself recorded; rows stored before the model are not among them (decision 37, "Start empty").

```ts
// SKETCH: not compiled
import * as Effect from "effect/Effect"
import { ItemsTable } from "./ItemsTable.projection.ts"
import { ItemRows } from "./ItemRows.store.ts"

// version 2: the handler writes a row of a new shape; replay every import, take-back and edit into it.
export const ItemsTableLive = ItemsTable.toLayer(
  Effect.gen(function* () {
    const rows = yield* ItemRows
    return Effect.fn(function* (batch) {
      // Upsert by (organizationId, id) with the whole row, so a replayed input overwrites, never doubles.
      yield* rows.apply(batch)
    })
  }),
  { batch: { size: 100, wait: "1 second" }, version: 2 }
)
```

The store is resolved while the Layer is built; the handler itself may only need `RuntimeContext`
(`Projection.ts:32-40`).

For a replay to rebuild `item` exactly, every fact an item row holds must be reachable from events:

- every value a confirm wrote, including the person's row decisions already applied (the event carries the final
  values, not the file row);
- the item's `id`, `revision`, `createdById`/`createdBy`/`createdAt`, `updatedById`/`updatedBy`/`updatedAt`,
  `importId`, `batchId`, `sourceRow`, `sourcePart`;
- the rows `item` references: its foreign keys point at `importDraft`, `importBatch` and `member` by
  `(organizationId, id)`, so those rows must exist before the replayed insert, or be projected first;
- every hand edit (`ItemStore.edit`) as an `ItemEdited` event; an item edited only in SQL, or in any path that records
  no event, comes back at its last recorded values, and its `revision` drops back, which also changes what a later
  take-back may remove;
- every take-back, with which items it removed, restored or kept; and the `importReplaced` copies, or the replaced
  values carried on the import event, so a restore can be replayed;
- and the table must be emptied or written to a new name before the replay, because the engine does not do it.
  The `itemSearch` index follows from its three triggers.

The migration file still creates the table and its indexes; what changes is that a change of meaning no longer
needs a hand-written data migration.

- **Used today:** no. The app changes its schema by editing `apps/inventory/migrations/0001_init.sql` and running
  `bun run db:reset`.
- **Where it goes:** the `item` table in `apps/inventory/migrations/0001_init.sql` becomes a projection's store; the
  writes in `packages/catalog/host/src/ImportStore.adapter.ts` (`commit`, `takeBack`) and
  `packages/catalog/host/src/ItemStore.adapter.ts` (`edit`) become commands whose events the projection applies.
- **What the person gets:** nothing they can see, except that a deploy that reshapes the Items page does not lose
  or mis-migrate an item.

## How to check it

- In a story (in memory), add the projection after recording imports and edits, and assert its store holds the same
  rows as a fresh run. The in-memory host runs the same backfill protocol, each role an object in memory
  (`InMemory.ts:373-376`). Not run for this app's model: the trial on 2026-11-19 ran no projection on any ref.
- On Cloudflare, the deploy's own line is the check: `Backfilled <targets>` on success, `BackfillStillRunning` with
  each run's phase and percentage when it is not done, `BackfillFailed` with the plan-changed sentence when the
  sources changed without a bump.
- Compare three counts after a rebuild: items per organization before, items in the rebuilt table, and items the
  events imply (created minus taken back).

## What it needs

Cloudflare Durable Objects (`DomainCloudflare.layerDurableObjects`) for the deploy-time wait; Rivet and Effect
Cluster backfill on first call; the in-memory host backfills too. beta.87 has everything on this page except the
listing after the commit and the `getInstance` retry, which are main only.

## Verdict

**Use:** let projection `version` bumps replace data migrations for `item`, once the confirm, take-back and item
edit write events that carry every column; keep `0001_init.sql` for the table's shape, project or keep the rows
`item` references, and empty the table before a bump. It works on beta.87 with the Durable Objects host.

## Where this was read

- https://alchemy.run/domain/backfill (the live site documents beta.87)
- https://alchemy.run/domain/model (sections "Consumers added later receive the history", "Change a view: bump its
  version", "Fill a view lazily", "Know when the history has arrived")
- https://alchemy.run/domain/projection (sections "Make every write idempotent", "Batch it on its Layer")
- `website/src/content/docs/domain/backfill.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (line 23)
- `packages/domain/src/Backfill.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Cloudflare/Backfill.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/CatchUp.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Cloudflare/index.ts`, `packages/domain/src/Cloudflare/Providers.ts`,
  `packages/domain/src/DurableObjects.ts`, `packages/domain/src/InMemory.ts`, `packages/domain/src/Kernel.ts`,
  `packages/domain/src/Projection.ts`, `packages/domain/src/View.ts` (parts) at `v2.0.0-beta.87`
- `apps/inventory/migrations/0001_init.sql` (the `item` table and its triggers) in inventory-import
