---
type: Reference
title: Platform contract
description: The interface every host of an @alchemy.run/domain model implements, what the kernel does for it, and what a host of our own on D1 would have to build.
tags: [alchemy-domain, host]
---

# Platform contract

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

`Platform` is the one Effect service a model needs in order to run. A model's Layer asks it for a `ModelHost`, then
asks that host for one store per entity: an `AggregateStore` per aggregate, a `ViewStore` per view, a `PolicyStore`
per policy, a `ProjectionStore` per projection, a `StreamStore` per stream and, on main only, a `DecisionStore` per
decision. With each request it hands over a "kit": the kernel's pure code for that entity (decide, evolve, reply,
route, apply, codecs). The kernel owns the meaning; the host owns storage, locking, atomic commits, delivery and
timers, and moves only JSON. The source states the swap in one line:
"Swap the platform Layer to move a Domain between infrastructures" [`packages/domain/src/Platform.ts`, beta.87, line 673].
Hosts that exist: [in memory](./host-in-memory.md), [Durable Objects](./host-cloudflare.md),
[Rivet](./host-rivet.md), [Effect Cluster](./host-effect-cluster.md), and one written outside Alchemy, beep-effect's
`@beep/alchemy-postgres`.

## When to reach for it

- When you pick a host: this page says what each host must guarantee, so you can tell what you give up.
- When you consider a host of your own (for this app, one on D1): this page lists every method you would write.
- When a test on one host passes and fails on another: the difference is almost always one of the guarantees below.

You do not call these interfaces from application code. Application code talks to the clients that `Model.layer`
builds on top of the stores.

## How it is declared

The service, at beta.87:

```ts
// SKETCH: not compiled (shape copied from the source, names unchanged)
class Platform extends Context.Service<Platform, {
  readonly model: (model: HostedModel) => Effect.Effect<ModelHost, never, Scope>
}>()("alchemy/Domain/Platform") {}

interface HostedModel {
  readonly modelName: string
  readonly id: object            // same for every Layer of one model, different for another model with the same name
  readonly sagas: ReadonlyArray<string>
  readonly legacyData: boolean
}

interface ModelHost {
  readonly aggregate: (aggregate: Aggregate.Any, kit: AggregateKit) => Effect.Effect<AggregateStore>
  readonly view: (view: View.Any, kit: ViewKit) => Effect.Effect<ViewStore>
  readonly policy: (policy: Policy.Any, kit: PolicyKit) => Effect.Effect<PolicyStore>
  readonly projection: (projection: Projection.Any, kit: ProjectionKit) => Effect.Effect<ProjectionStore>
  readonly stream: (stream: DomainStream.Any, kit: StreamKit) => Effect.Effect<StreamStore>
  readonly start?: (targets, planOf, backfill) => Effect.Effect<void>
  readonly history?: (target: string) => Effect.Effect<{ readonly complete: boolean }>
}
```

What `Model.layer` does with it (`packages/domain/src/Model.ts`, beta.87): calls `Platform.model` once per model
(line 447), builds the kernel with `Kernel.make` (line 453), defines one `deliver` function that routes a `Delivery` to
the target view, policy or projection store by `delivery.target.kind` (lines 465-473), then asks the host for each
aggregate store (479), view store (509), stream store (522), projection store (641) and policy store (676), and last
calls `start` if the host has it (684). Sagas are not a store: they run on the `WorkflowEngine` service, which the
host Layer must also provide (lines 581-595); `HostedModel.sagas` only tells the host their names.

### Every store and kit, method by method (beta.87)

**Aggregate.** `AggregateKit` (Platform.ts 190-210) gives the host:

| Kit member | Meaning |
| --- | --- |
| `name` | The aggregate's name. Every kit (view, policy, projection, stream, and decision on main) carries one too. |
| `handle(input)` | Decide, evolve, reply and route, purely, from `{ id, state, version, command, commandId, context, now, correlationId?, trace?, link? }`. Returns `Rejected { rejection }` or `Accepted { state, version, events, reply, deliveries }`. Throws only on a bug. |
| `seed(input)` | Fold already-decided events into state and route them as history, without `decide` (story `given`). |
| `deliver(delivery)` | Send one delivery to its target's store (the `deliver` closure from `Model.ts`). |
| `targets` | The views and projections that consume this aggregate, by `CatchUp.targetId`. |
| `consumerSingleSource(target)` | Whether each key of that consumer hears only from the instance with its own id. |
| `replay(input)` | Route stored events to consumers that lag behind them (catch-up). |

`AggregateStore` (Platform.ts 237-292) is what the host returns:

| Store method | What the host must do |
| --- | --- |
| `send(id, command, meta)` | Handle a command on one instance: one writer per id, dedupe by `meta.commandId`, persist events, state, receipt and deliveries atomically, then deliver at least once, in order (doc comment, lines 238-242). Returns `Rejected` or `Accepted { receipt: { stream, version, events, reply } }`. |
| `schedule(id, name, command, meta, due)` | Send a command to one instance when due (`{ at }` or `{ afterMillis }`), durably and at least once. Scheduling under a `name` replaces its command unless it has the same `meta.commandId` (the same arming again: nothing changes). Returns the due time in epoch milliseconds (lines 244-261). |
| `unschedule(id, commandId)` | Cancel the pending command under that name, durably; fails `AlreadyExecuted`, `AlreadyCancelled` or `NotScheduled` (lines 262-276). |
| `state(id)` | The stored `{ state, version }`. |
| `events?(id)` | The committed events (optional; tests and diagnostics). |
| `changes(id)` | The stored state and version, then every new one (a `Stream`). |
| `tail(id, after)` | Committed events with `seq > after`, then live ones (a `Stream`). |
| `seed?(id, events)` | Append events without deciding; they reach views as history and never trigger policies (optional). |

**View.** `ViewKit` (lines 331-402): `apply(key, snapshot, deliveries)` evolves a key and returns
`{ snapshot, changed, entries, downstream }` (it drops duplicates by checkpoint); `deliver`; `targets`;
`consumerSingleSource`; `generation` and `classGeneration` (a key built by an older generation is reset);
`target`; `catchUp?` (set for a view keyed by its one aggregate: read the key's history before its first answer);
`singleSource`; `history(...)` and `replay(...)` for catch-up; `observe(key, deliveries)` to trace an apply; and
`push(key, subscription, snapshot, entries)`, which says what a live subscriber receives. `ViewStore` (lines 433-449):
`receive(key, deliveries)` (one writer per key, then forward `downstream`), `read(key)`, `changes(key)`,
`list(key, range?)` (entries by `seq`, `order`, `after`, `limit`), `tail(key, after)`, and optional
`connect(key, subscription)`, which accepts a WebSocket upgrade and pushes on every commit. Without `connect`, live
reads are streamed responses over `changes` and `tail` (lines 443-448).

**Policy.** `PolicyKit` (454-458) has one `run(delivery)`; it ignores a delivery marked `history`
(`Kernel.ts` 1430). `PolicyStore.receive(delivery)` (463-466) must run deliveries at least once, in order per key.

**Projection.** `ProjectionKit` (490-519): `options.batch` (`{ size, waitMillis }`), `generation`, `singleSource`,
`history`, and `run(key, batch)`, which runs the handler for a run of the key's input log and succeeds only when every
write it made succeeded. `ProjectionStore` (524-532): `receive(delivery)` accepts a delivery into its key's input log
once (by source and `seq`), then processes the log in order, in batches; `checkpoints(key)` answers the last processed
`seq` per source.

**Stream.** `StreamKit` (575-588) has only `push`. `StreamStore` (593-613): `append(key, write)` (one writer per
key; a write whose `origin` is not after the last applied one is a repeat and is dropped), `advance(key,
checkpoints)`, `read`, `changes`, `list`, `tail`, optional `connect`. The projection that writes a stream calls
`append`; nothing routes deliveries into a stream.

**Catch-up.** `start(targets, planOf, backfill)` (638-647) is called once every store is built: a host that keeps
events across deploys starts catching up the consumers that are new to it. `history(target)` (653) says how much of
the history recorded before a consumer has reached it; the doc comment adds that a host without it keeps nothing across deploys. The
machinery itself (`Backfill.makeSource`, `makeConsumer`, `makeScanner`, `makeRun`, `makeNode`, `makeRelay`,
`routeCommit`) is exported from `packages/domain/src/Backfill.ts`; a host supplies it a `Backfill.Storage` (get, put,
delete, list, and `exclusive`, which runs an effect with every other call on that object held back, lines 46-58) and
`Backfill.Jobs` (durable, at-least-once, lines 61-68).

Helpers a host uses: `captureContext` (line 25), `emptySnapshot` (316), `inRange` (418), `emptyStreamMeta` (556) and
`hostedModels({ release })` (690, marked `@internal`), which makes hosting two different models with one name die with
`ModelHostedTwice`. Every host built on Durable Objects (Cloudflare, Rivet, Effect Cluster) goes one level lower:
it supplies a `Host` to `makePlatform` in `packages/domain/src/DurableObjects.ts`, which implements every store above
over per-object key-value storage (see [host-cloudflare.md](./host-cloudflare.md), "Types and helpers").

### What the kernel does, and what the host must do

The kernel (`Kernel.make(definitions, telemetry)`, `Kernel.ts` 256) validates the definitions and dies on the first
problem (`Kernel.verify`, line 269, lists them all). It owns: every JSON codec; `decide` (including an effectful
decide, run with the request context restored, lines 1118-1131); the evolve fold and event envelopes (`seq =
version + index + 1`, line 985); the fan-out from an event to every subscribed view, policy and projection key
(`fanOut`, 770-789); duplicate dropping in a view key by per-source checkpoint (1337); generations and rebuilds; and
the history routing for catch-up. It does no I/O.

The host must give six guarantees. Each is named in a doc comment of `Platform.ts`:

1. **One writer per instance or key.** `send` per aggregate id, `receive` per view key, `append` per stream key.
2. **An atomic commit** of events, state, receipt and the outgoing deliveries (`AggregateStore.send`, 238-242), and of
   a view key's snapshot with its entries before downstream deliveries are sent (`ViewKit.apply`, 334-336).
3. **At-least-once, ordered delivery.** Deliveries go in order per `(source, target)` (`Delivery` doc, 63-66).
   Targets drop duplicates by `(source, seq)`, so at-least-once is safe.
4. **Command-id receipts.** A second `send` with the same `commandId` returns the first receipt and commits nothing.
5. **Scheduled commands** that survive restarts and fire at least once, with the replace and cancel rules above.
6. **Catch-up for a consumer added later**, through `start` and `history` (optional; without them a view added after
   events exist never sees those events, unless the host keeps nothing across deploys, as in memory).

### Types and helpers

The JSON shapes a host stores and moves, all in `packages/domain/src/Platform.ts` (importable as
`@alchemy.run/domain/Platform`). Line numbers are beta.87; main.

| Name | What it is | Where |
| --- | --- | --- |
| `Json` | `unknown`: everything a host persists or sends is plain JSON; the kernel owns the schemas | 39; 40 |
| `EnvelopeJson` | schema of an event envelope in JSON: the `Aggregate.Envelope` fields plus `at` (epoch ms), optional `correlationId` and `trace` | 44-52; 45-53 |
| `StoredEvent` | `{ event, envelope }`, one committed event as an aggregate stores it | 57-60; 58-61 |
| `Delivery` | one routed event: `target { kind, name, generation?, inPlace? }`, `key`, `routes?`, `source`, `seq`, `origin`, `tag`, `event`, `envelope`, `state?` (from a view), `history?` | 68-97; 69-98 |
| `Subscription`, `Push` | a live read in JSON (`requestId`, `mode`, `where?`, `context`, `cursor`, `refused?`, `caughtUpSent?`), and what to send it (`messages`, `subscription`, `done`) | 105-132; 106-133 |
| `HandleInput`, `HandleResult` | input to `AggregateKit.handle`, and its result (`Rejected { rejection }` or `Accepted { state, version, events, reply, deliveries }`) | 137-168; 138-169 |
| `ReceiptJson`, `SendResult` | an accepted command's receipt `{ stream, version, events, reply }`, and `AggregateStore.send`'s result (`Rejected` or `Accepted { receipt }`) | 173-185; 174-186 |
| `SeedInput`, `SeedResult` | input and result of `AggregateKit.seed` (main's `record` returns a `SeedResult` too) | 215-232; 221-238 |
| `HistoryJson` | `{ complete }`, how much history has reached a consumer | 295-297; 402-404 |
| `ViewSnapshot`, `ViewEntry` | a view key's stored state (`state`, `version`, `checkpoints`, `seq`, `generation?`; main adds `emitted?`) and one emitted entry (`seq`, `event`, `envelope`, `state`) | 302-326; 409-462 |
| `ListRange` | which entries a `list` reads: `order` (`"asc"` default or `"desc"`), `after`, `limit` | 408-415; 544-551 |
| `Accepted` | one delivery in a consumer key's input log: `position` (from 1), `delivery`, `at` | 471-477; 607-613 |
| `ProjectionOptions` | a projection Layer's tuning: `batch?: { size, waitMillis }` | 482-485; 618-621 |
| `StreamEntry`, `StreamMeta`, `StreamWrite` | one appended entry (`seq`, `event`, `envelope`); a stream key's progress (`seq`, `checkpoints`, `origin`); one append (`origin`, `source`, `sourceSeq`, `at`, `commandId`, `events`) | 537-570; 673-706 |
| `HostedModel` | what a host is told of a model: `modelName`, `id`, `sagas`, `legacyData` | 657-665; 798-806 |
| `RecordInput`, `DecisionRead`, `DecisionState`, `DecisionWrite`, `DecisionReceiptJson`, `DecideInput`, `DecideResult`, `DecisionResult`, `DecisionKit`, `DecisionStore` | main only: the decision contract below | main 241-339 |
| `EmittedRange` | main only: `{ commandId, sourceSeq, after, through }`, the entries a key emitted for one command | main 440-449 |
| `hostedModels` | name-collision guard for hosts (internal) | 690-722; 831-863 |
| `RunWait`, `runDirectly` | main only, internal: how a manual host counts a run that polls for another run's work | main 875-881 |

### What main changes

- **Decisions** (commit `dbda8cc16`, #3420). `ModelHost.decision?(decision, kit)` (Platform.ts 766 on main) returns a `DecisionStore` whose
  `send(command, meta)` (331-339) must commit every write or none, commit nothing unless each instance still has the
  version it was read at, and return the first receipt for a command id already committed. `DecisionKit` (320-326) has
  `reads(command)` (the instances, each once, ordered by stream) and `decide(input)` (pure, against the states read;
  returns `Rejected` or `Accepted { writes, receipt, correlationId, trace? }`, each write carrying the `version` it was
  read at). `AggregateKit.record(input)` (207) folds the events a decision recorded on one instance and routes them,
  without `decide`. A host without `decision` cannot host a model that has decisions: `Model.ts` on main dies with
  `DecisionsUnsupported` (lines 670-689). The kernel side is `decisionKit` (`Kernel.ts` on main, interface line 173,
  implementation from about line 1322). See [decision](./decision.md).
- **`ViewSnapshot.emitted`** (434) and `EmittedRange` (440): per source, which entries the last command's deliveries
  produced, so a reader finds a command's emissions without scanning. The doc on `checkpoints` (414-422) now also
  says a host that serves reads from replicas reports a `seq` only once every replica has it, because
  `consistency: "strong"` and `atLeast` rely on it. Both belong to the change that lets a command wait for its views
  (commit `bc0024faf`, #3469).
- **`RunWait`** and `runDirectly` (875-881, both `@internal`), a reference a manual host provides so a run that polls
  for another run's work counts as waiting. Commit not known.
- `Kernel.projectionKeys` and `viewKeys` take any source (a view key too), with an optional encoded `state`
  (`Kernel.ts` on main, lines 190-206 and 1923-1940). Commit not known.

## Rules, and the mistakes to avoid

- **The kit is pure; the store is not.** Never put I/O in a kit, and never decide outside `kit.handle`. A host that
  re-implements routing or folding will drift from the kernel.
- **Commit, then deliver.** Deliveries are part of the atomic commit (an outbox), and are sent after it lands. A host
  that sends first and commits second can deliver an event that never happened.
- **Order per `(source, target)`, not globally.** beep-effect's `@beep/alchemy-postgres` claims only the oldest pending
  outbox row of each `(source, target)`, where the target is the consumer's kind and name, not its key
  (`packages/drivers/alchemy-postgres/src/internal/host.ts`, lines 523-548).
- **A rejection writes nothing.** Not even a receipt: the Postgres host fails the transaction with a private
  `RejectedCommand` error so it rolls back, then turns it back into a `Rejected` result outside it
  (`internal/aggregate.ts`, lines 25-28, 302 and 331-334).
- **Receipts are per instance.** InMemory keeps them in the instance's `receipts` map; Postgres keys them by
  `(model, aggregate, id, command_id)`.
- **Optional is not free.** Leaving out `start`/`history` is honest only for a host that keeps nothing across
  deploys. Leaving out `connect` is fine: reads fall back to streaming over `changes` and `tail`.
- **Name collisions die.** Use `hostedModels` so a second, different model with the same name fails instead of
  sharing storage.

## In this app

Today no part of the app is a Platform. Every write is one guarded D1 batch behind a port. The confirm
(`packages/catalog/host/src/ImportStore.adapter.ts`, `commit`, lines 1024-1099) is the pattern a D1 host would reuse:
the first statement inserts the confirm's own `importBatch` row only while the import is open (`insertBatch`, 873-880,
`RETURNING id`); every later statement carries `WHERE EXISTS (SELECT 1 FROM importBatch WHERE ... id = <this
confirm>)` (`thisConfirm`, 881-882); and the caller reads the first statement's answer to know whether this batch won
(line 1098). D1's `batch` is atomic: every statement lands or none does (`packages/drivers/d1/src/D1.service.ts`, lines
108-111).

**A host of our own on D1.** Nobody has built this. The design below follows the contract and the confirm's pattern.
D1 has no interactive transaction, so a commit is: read state and version, decide in the Worker, write one batch
whose statements are all guarded by a marker that only exists if the version was still the one read, and retry on a
lost race.

```ts
// SKETCH: not compiled. A design nobody has built; table and statement names are invented here.
import * as Effect from "effect/Effect"
import * as O from "effect/Option"

const send = Effect.fn("D1Host.send")(function* (id: string, command: Json, meta: Aggregate.SendMeta) {
  const kept = yield* d1.run(findReceipt({ aggregate: kit.name, id, commandId: meta.commandId }))
  if (O.isSome(kept)) return kept.value
  const row = yield* d1.run(readInstance({ aggregate: kit.name, id }))   // { state, version }, version 0 if none
  const result = yield* kit.handle({ id, ...row, command, commandId: meta.commandId, context: meta.context,
    now: yield* nowMillis })
  if (result._tag === "Rejected") return result                          // writes nothing
  const attempt = yield* newAttemptId
  const [won] = yield* d1.batch([
    claimVersion({ id, from: row.version, to: result.version, attempt }), // marker row, only while version = from
    insertEvents({ id, attempt, events: result.events }),                  // each: WHERE EXISTS (marker)
    saveState({ id, attempt, state: result.state }),
    insertReceipt({ id, attempt, commandId: meta.commandId, receipt: receiptOf(result) }),
    insertOutbox({ attempt, deliveries: result.deliveries })
  ])
  return won.length > 0 ? acceptedOf(result) : yield* new VersionMoved()  // caller re-reads, then retries
})
```

Method by method:

| Contract part | On D1 | Fits? | What beep-effect's Postgres host does |
| --- | --- | --- | --- |
| `send`, one writer per id | Optimistic: guarded batch, retry on `VersionMoved`. Two Workers may both decide; one commits. | Yes, with retries; an effectful decide runs again on a retry. | Pessimistic: `pg_advisory_xact_lock` plus `SELECT ... FOR UPDATE` in one transaction (`internal/aggregate.ts` 211-220, 319-337). |
| Atomic commit with receipt and outbox | One batch, every statement guarded by the marker. Rows travel as one JSON value read with `json_each`, as the confirm does, because of D1's 100 bound parameters. | Yes. | One SQL transaction; the outbox is a `delivery` table written in it (`host.ts` 509-521). |
| Command-id receipts | Read first; also make the receipt's key unique so a racing duplicate loses the batch. | Yes. | `aggregateReceipt` keyed by `(model, aggregate, id, command_id)`, read under the lock. |
| `state`, `events` | Plain reads. | Yes. | Plain reads. |
| `changes`, `tail`, view and stream live reads | Polling D1 inside one request, or a push from something long-lived. | Partly. A poll costs a D1 read each time and lives only as long as the request. | Polls at `pollMillis` (`Stream.fromEffectSchedule`, `aggregate.ts` 475-483; `pollTail`, `host.ts` 428-443). It has no `connect`. |
| Delivery after commit, at least once, ordered | Try at once after the batch (in the request, kept alive with the Worker's `waitUntil`), and sweep pending outbox rows on a schedule. | Not well. A Worker has no long-lived process to run a delivery loop, and a sweep only runs when something wakes it (a cron trigger, a queue consumer or a Durable Object alarm). Ordering per `(source, target)` needs a claim with a lease, done as a guarded `UPDATE ... RETURNING`. | Forked workers per model: a delivery worker woken after each commit and every `pollMillis`, claiming heads with `FOR UPDATE SKIP LOCKED` under a lease, with backoff on failure capped at a minute; a backfill-job worker; and per-store workers (`host.ts` 509-569, 649-664). |
| `schedule`, `unschedule` | A schedule table, guarded like a commit; something must wake at the due time. | Not well, for the same reason. A cron's finest step is a minute; a Durable Object alarm can wake on time. | A schedule table and a polling worker that fires due rows under the instance lock (`aggregate.ts` 341-438). |
| Views and projections (`receive`) | Per key, the same read-decide-guarded-batch loop, keyed by the key's snapshot `version`. | Yes, for the write. Processing a projection's log in the background has the same problem of who wakes it. | Advisory-lock transaction per key (`view.ts` 71-130); a projection key's log processed under the key's lock (`projection.ts` 88, 97-141) in fibers forked into the model's scope (line 93). |
| Streams (`append`) | Guarded by the stored `origin`. | Yes. | Advisory lock per key, dropping a write whose `origin` is not after the last (`stream.ts` 59-83). |
| Catch-up (`start`, `history`, `Backfill`) | Needs `Backfill.Storage.exclusive`, which holds other callers back while an effect of several reads and writes runs. D1 has no lock. A lease row can stand in, but whether the Backfill roles are safe under a lease that can expire mid-run is not verified. | Not without a lock. | Runs the upstream Backfill roles unchanged over a KV table; `exclusive` is a transaction holding `pg_advisory_xact_lock` (`host.ts` 162-230), and jobs are a due-job table drained by a worker. |
| Sagas | Need a durable `WorkflowEngine`. | Not on plain D1. | `ClusterWorkflowEngine` over one SQL-backed runner (`src/AlchemyPostgresWorkflows.ts`). |
| Decisions (main) | Read every instance, decide, then one batch guarded by every version read. | Yes; it is the same pattern with several markers. | Not implemented: its header says it follows beta.85's `Platform` contract (`src/AlchemyPostgresPlatform.ts` line 8), though beep-effect's root `package.json` now pins `@alchemy.run/domain` at `2.0.0-beta.87` with a patch. |

What is known from source: every row of the "Postgres" column, and the D1 confirm pattern. What is design nobody has
built: every row of the "On D1" column. The parts that fit D1 well are the commits. The parts that do not fit are
everything that must happen later without a request: deliveries, timers, projection batches and catch-up jobs. On
Cloudflare those want a Durable Object, which is what Alchemy's own Cloudflare host uses
(see [host-cloudflare.md](./host-cloudflare.md)).

Why beep-effect built a host of its own, from its own decision log (`explorations/alchemy-domain-adoption/DECISIONS.md`,
2026-11-03). D1: Alchemy shipped only the in-memory and Durable Object hosts, and beep-effect runs Postgres, so it
chose to write a Postgres implementation of the `Platform` contract as a repository-level driver, with the in-memory
host for tests and stories. It rejected Durable Objects because they would move its product data off Postgres onto
Cloudflare, and rejected starting in memory with the host deferred because hosting, local-first and HTTP would not be
proven against real storage. D2: event streams are its system of record; existing tables become views and projections
rebuilt from the streams. It rejected keeping its CRUD rows authoritative with Alchemy as a decision layer only,
because that works against the kernel. D6 adds that sagas run on Effect's `ClusterWorkflowEngine` over the same
Postgres. This app's position differs: its data already lives on Cloudflare (D1), so the reason beep-effect gave
against Durable Objects does not apply here.

- **Used today:** no. The app's ports (`packages/catalog/model/src/Catalog.ports.ts`,
  `packages/access/model/src/Access.ports.ts`) with D1 adapters in the `host` packages play this role.
- **Where it goes:** a new driver beside `packages/drivers/d1`, providing `Platform` to the model's Layer in
  `apps/inventory/src/server/App.ts`.
- **What the person gets:** nothing they can see; the same confirm and take-back, written by the kernel instead of by
  hand.

## How to check it

beep-effect runs one conformance suite against every host: `test/conformance/scenarios.ts` (aggregate guarantees:
commit, duplicate `commandId`, rejection writes nothing, concurrent sends serialize, policy reaction, schedule and
unschedule, model name clash, seeded events never trigger policies, `changes` and `tail`) and
`test/conformance/consumers.ts` (views, projections, streams, catch-up, rebuilds), run first against `Domain.InMemory`
(`test/conformance/inmemory.test.ts`) as the reference, then against PGlite and Postgres. A D1 host would copy that
idea: the same scenarios against InMemory and against a local D1. The scenario that matters most for D1 is the one
where concurrent sends to one id serialize without gaps, because it is the one optimistic concurrency can get wrong.

The reference host's side of guarantee 4 and of the rejection rule was run in a trial on 2026-11-19, on beta.87 with
`Domain.InMemory`: the same `commandId` sent again answered the same receipt, and a rejected confirm answered its
rejection. No other host was run (see [host-in-memory.md](./host-in-memory.md)).

## What it needs

Any host. The contract is beta.87; `decision` and `emitted` are main only. A host of our own also needs a way to wake
up without a request (Durable Object alarm, cron trigger or queue) for deliveries and timers, and a lock for
catch-up.

## Verdict

**Use:** host the model on an existing host ([in memory](./host-in-memory.md) for tests,
[Durable Objects](./host-cloudflare.md) on Cloudflare). Treat a D1 host as a design study: its commits fit D1's guarded
batch, but deliveries, timers and catch-up need something long-lived that D1 alone does not give.

## Where this was read

- https://alchemy.run/domain/in-memory (the live site documents beta.87)
- `packages/domain/src/Platform.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: `packages/domain/src/Platform.ts` changed
- `packages/domain/src/Kernel.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: `packages/domain/src/Kernel.ts` changed
- `packages/domain/src/InMemory.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: `packages/domain/src/InMemory.ts` changed
- `packages/domain/src/Model.ts` at `v2.0.0-beta.87` (lines 440-690, 1122); on `main@dbfd0ddb`: changed (decision hosting, 670-689)
- `packages/domain/src/Backfill.ts` at `v2.0.0-beta.87` (`Storage`, `Jobs`, `routeCommit`)
- beep-effect's `@beep/alchemy-postgres`: `packages/drivers/alchemy-postgres/README.md`, `src/AlchemyPostgresPlatform.ts`,
  `src/AlchemyPostgres.layer.ts`, `src/AlchemyPostgresWorkflows.ts`, `src/internal/{aggregate,host,view,projection,stream}.ts`,
  `src/AlchemyPostgres.schema.ts` (outline), `test/conformance/*` (outline); `explorations/alchemy-domain-adoption/DECISIONS.md`
  (D1, D2, D6, D11); root `package.json` (all paths relative to the beep-effect repository)
- `packages/domain/src/DurableObjects.ts` at `v2.0.0-beta.87` (`Host`, `makePlatform`)
- The app: `packages/catalog/host/src/ImportStore.adapter.ts`, `packages/drivers/d1/src/D1.service.ts`
