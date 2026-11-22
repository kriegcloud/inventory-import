---
type: Reference
title: Workflows (Effect workflows and their engines)
description: A durable function made of recorded activities, with durable sleeps, signals and compensation, run by an engine that resumes it after a crash; for this app, the model pass over an import, asked in pieces that each take one call from the allowance.
tags: [alchemy-domain, extra]
---

# Workflows (Effect workflows and their engines)

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

A workflow is a function whose steps survive the process that runs them. Each step is an **activity**: a named
Effect whose result (success or typed failure) is written to a journal the first time it finishes. A run that stops,
because its Worker was evicted or a deploy replaced it, is started again from the top, and every activity already in
the journal returns its stored result instead of running again; the first unfinished one runs. A run can wait on a
durable clock or on a signal (a `DurableDeferred`) without holding any process, and can undo earlier steps with
compensations when it fails later. The docs say: "A workflow is a durable function. Each step, an **activity**, is
persisted when it finishes" [https://alchemy.run/cluster/workflows].

The workflow itself is Effect's (`effect/workflow`). What stores the journal and wakes the run is an **engine**, a
`WorkflowEngine` service. Four engines can run the same workflow code: Effect Cluster's, Alchemy's Durable Object
engine, Alchemy's bridge to Cloudflare's own Workflows product, and in memory. A Domain [saga](./saga.md) is one of
these workflows with a key.

## When to reach for it

- Work that outlives one request: a model pass over every open row of a 2,000-row import, which may meet a
  provider's rate limit and need to wait minutes.
- Steps with side effects that must not repeat after a crash: taking a call from the daily allowance, storing
  suggestions.
- Waiting for something outside: a person's answer, a timer, another run finishing.
- Not for work that fits in a request and can simply be retried by the person (today's `suggest`, one model call).
- Not for a fixed schedule with no per-run state: that is a cron (see [singletons and crons](./cluster-singletons.md)).
- Not for one instance's own timeout: that is a [deadline](./deadlines.md).

## How it is declared

A workflow is declared once, with schemas, and implemented as a Layer that registers a handler with an engine:

```ts
// SKETCH: not compiled
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import * as DurableClock from "effect/workflow/DurableClock"
import * as Workflow from "effect/workflow/Workflow"
import * as Workflows from "alchemy/Workflows"

export const ImportPass = Workflow.make("ImportPass", {
  payload: { importId: S.String, press: S.String },
  idempotencyKey: ({ importId, press }) => `${importId}/${press}`,
  success: S.Int
})

export const ImportPassLive = Workflows.layer(
  ImportPass,
  Effect.fn(function* ({ importId }) {
    const pieces = yield* Activity.make({ name: "plan", success: S.Int, execute: Effect.succeed(3) })
    yield* DurableClock.sleep({ name: "cool-off", duration: "2 minutes" })
    return pieces
  })
)
```

The parts, from the source:

- `Workflow.make(tag, { payload, idempotencyKey, success?, error?, suspendedRetrySchedule?, annotations? })`.
  `payload` is struct fields or a struct schema; `success` defaults to `Schema.Void` and `error` to `Schema.Never`.
  The execution id is the first 32 hex characters of SHA-256 over `` `${tag.length}:${tag}:${idempotencyKey(payload)}` ``,
  so two starts with the same key are one run, and a caller can compute the id from the payload with
  `workflow.executionId(payload)` without storing it.
- The workflow value carries `execute(payload, { discard?, detached? })`, `poll(executionId)`, `interrupt`, `resume`,
  `toLayer(handler)`, `executionId(payload)` and `withCompensation`.
- `Activity.make({ name, success?, error?, execute, interruptRetryPolicy?, annotations? })` is itself an Effect. Its
  result is encoded through `Schema.toCodecJson` of its schemas, so every value it returns must be JSON-encodable
  through a schema. The engines key an activity by `name` and attempt (`${name}/${attempt}`), so **two activities in
  one run must never share a name**, and a name built in a loop must be the same on every replay.
- `Activity.retry(options)` reruns an activity as a new attempt (a new key) and sets `Activity.CurrentAttempt`;
  `Activity.idempotencyKey(name, { includeAttempt? })` gives a stable hash for an outside system's idempotency key.
- `DurableClock.sleep({ name, duration, inMemoryThreshold? })`: a zero duration does nothing; a duration at or
  below the threshold (default 60 seconds, `DurableClock.InMemoryThreshold`) runs as an in-memory activity; a longer
  one asks the engine to schedule a clock and suspends the run until it fires.
- `DurableDeferred.make(name, { success?, error? })`, then `DurableDeferred.await(d)` inside the run (suspends when
  no value is recorded) and, from outside, `DurableDeferred.succeed/fail/done(d, { token, ... })` with a token from
  `DurableDeferred.tokenFromExecutionId` or `tokenFromPayload`. Alchemy's `Run.signal(d, value)` does the same by
  execution id.
- `Workflow.withCompensation(effect, (value, cause) => undo)`, or `MyWorkflow.withCompensation(...)`: registers a
  finalizer that runs only if the whole run ends in failure; compensations run newest first. It works only on
  top-level effects of the handler, not inside a nested activity.
- `Workflow.CaptureDefects` (default true) and `Workflow.SuspendOnFailure` (default false) are annotations;
  with `SuspendOnFailure` a failing run suspends and waits for `resume`.

Alchemy adds the engine-neutral part (`alchemy/Workflows`): `Workflows.layer(workflow, handler | Effect<handler>)`
registers the handler and marks the workflow `Implemented`; `Workflows.RunWorkflow(workflow)` gives a client with
`start(payload)` (returns at once with a `Run`) and `get(executionId)`. A `Run` has `executionId`, `status`
(`NotStarted`, `Running`, `Completed`, `Failed`, `Interrupted`, `Died`), `result` (waits; for tests and scripts),
`signal(deferred, value)` and `interrupt`. `RunWorkflow` requires `Implemented<Name>`, so starting a workflow nothing
implements is a type error.

Every Effect module here is marked `@stability unstable` in Effect 4.1.4 (each file's header and every export).

Checked in:

- `effect` 4.1.4 (the app's installed copy) `src/workflow/Workflow.ts`: `Workflow` interface 47-208, execution id
  344-345, `make` 462-494, `intoResult` 708-780, `addFinalizer` 931-946, `withCompensation` 968-987, `suspend`
  1037-1042, `CaptureDefects` 1055-1060, `SuspendOnFailure` 1073-1078.
- `src/workflow/Activity.ts`: `make` 135-191 (memoization gotcha 124-129), interrupt retry policy
  193-217, `retry` 227-253, `CurrentAttempt` 263-266, `idempotencyKey` 276-292, `raceAll` 302-326.
- `src/workflow/DurableClock.ts`: `make` 45-53, `InMemoryThreshold` 80-83 (since 4.1.3), `sleep`
  93-138.
- `src/workflow/DurableDeferred.ts`: `make` 89-119, `await` 156-195, `into` 220-266, `raceAll`
  431-456, tokens 583-718, `done`/`succeed`/`fail`/`failCause` 719-926.
- `src/workflow/DurableQueue.ts`: `make` 130-158, `process` 192-256, `worker` 358-379 (needs a
  `PersistedQueueFactory`).
- `src/workflow/WorkflowEngine.ts`: service 41-224, `WorkflowInstance` 245-339, `makeUnsafe`
  514-703, `layerMemory` 732-1011.
- `src/workflow/WorkflowProxy.ts` (`toRpcGroup` 57-94, `toHttpApiGroup` 146-185) and `WorkflowProxyServer.ts`
  (`layerHttpApi` 32-98, `layerRpcHandlers` 99-147): derive an RPC group or an `HttpApiGroup` (execute, discard, resume
  per workflow) and serve it.
- `src/workflow/internal/crypto.ts` 14-20 (32 hex characters of SHA-256).
- `packages/alchemy/src/Workflows.ts` at `v2.0.0-beta.87` (read from the published beta.87 package; the beta export
  of the repository holds only `packages/{domain,effect-cluster,...}`): `StorageName` 19-21, `Implemented` 30-47,
  `layer` 119-166, `Status` 175-181, `Run` 184-201, `WorkflowClient` 204-209, `RunWorkflow` 249-271, `makeRun`
  278-317.

Types and helpers:

| Name | What it is | Where |
| --- | --- | --- |
| `StorageName` | Annotation: the name a workflow's runs are stored under (the Domain sets it per saga) | `alchemy/src/Workflows.ts:19-21` |
| `Implemented`, `implemented` | The marker `RunWorkflow` requires, and the Layer that provides it for a list of names | `Workflows.ts:30-47` |
| `Execute` | The handler type `Workflows.layer` takes | `Workflows.ts:52` |
| `makeRun` | Builds a `Run` from an engine, a workflow and an execution id | `Workflows.ts:278-317` |
| `encodeExit`, `decodeExit`, `payloadCodec`, `encodeResult`, `decodeResult`, `WorkflowSchemas`, `CurrentActivity`, `makeCurrentActivity` | Internal: how the engines store exits, payloads and results as JSON | `alchemy/src/WorkflowEncoding.ts:20-107` |
| `makeDurableObjectEngine`, `DurableObjectEngineHost`, `Namespace`, `ObjectImpl` | The host-neutral Durable Object engine every Cloudflare and Rivet engine is built from | `alchemy/src/Workers/DurableObjectEngine.ts:29`, `:65`; `Namespace` and `ObjectImpl` `:589`, `:594` at beta.87, `:586`, `:605` on main |
| `Cloudflare.Workflows.layerDurableObjectEngine`, `DurableObjectEngineOptions` | That engine on an Effect-native Worker's Durable Objects; `jurisdiction?` | `cloudflare/src/Workflows/DurableObjectEngine.ts:86-110` (main) |
| `Cloudflare.Workflows.NativeEngine`, `ActivityStepConfig`, `withStepConfig` | Effect workflows on Cloudflare Workflows; a `step.do` config per activity | `cloudflare/src/Workflows/NativeEngine.ts:65`, `:98`, `:278` (main) |
| `Cloudflare.Workflows.makeWorkflowBridge` | Internal: the `WorkflowEntrypoint` bridge the generated entry exports | `cloudflare/src/Workflows/index.ts` |
| `Cluster.Workflow`, `WorkflowProps`, `WorkflowAttributes`, `ClusterWorkflow`, `WorkflowTag`, `WorkflowInline`, `WorkflowClass`, `WorkflowHandler` | A workflow deployed on a cluster pool: declared like `Workflow.make` plus `{ main }`, inline or bare with `.make(props, impl)`; `yield*` gives a client with `start` | `effect-cluster/src/Workflow.ts:41-330` |
| `Cluster.WorkflowEngine(...workflows)` | A `WorkflowEngine` that reaches each `Cluster.Workflow` through its pool's gateway, for `Workflows.RunWorkflow` | `effect-cluster/src/Workflow.ts:505-535` |
| `WorkflowEngineOutsideRuntime`, `WorkflowNotHosted` | Errors: a run started outside any runtime; a workflow no `Cluster.Workflow` in the Stack hosts | `effect-cluster/src/Workflow.ts:471-480` |
| `HostedWorkflow`, `WorkflowRuntimeContext`, `WorkflowResource`, `WorkflowProvider`, `WorkflowTypeId` | Internal plumbing for the pool | `effect-cluster/src/Workflow.ts:41-107`, `:537` |

### What main changes

- `packages/alchemy/src/Workflows.ts` on main@dbfd0ddb: types only (commit `615d87516`, #3222). `ErasedWorkflow`
  (171-187) erases the schemas' services so `RunWorkflow` (269) and `makeRun` (298) are typed `Run<A, E>` without
  casts. No behaviour change.
- `packages/alchemy/src/Workers/DurableObjectEngine.ts` on main (the Callbacks service, `97ff09fca`, #3215): the
  engine's two durable callbacks are registered without a retry option (`makeCallback(RUN, () => run)` at 379,
  `makeCallback("clock", ...)` at 401); beta.87 passed `{ retry: { delay: "5 seconds" } }`. Callbacks became a
  service: main's `alchemy/src/Callback.ts` has `makeCallback` requiring `Callbacks` (156), and the engine object is
  given one by the new `provideCallbacks` (595). On beta.87 `makeCallback` (`Callback.ts:171`) takes `retry` options
  and reads `RuntimeContext.makeCallback`.
- `packages/cloudflare/src/Workflows/DurableObjectEngine.ts` on main (same commit): declares each engine object with
  `provideCallbacks(impl, DurableObjectCallbacks)` (137); `layerDurableObjectEngine` itself is unchanged (86-94).
- `packages/cloudflare/src/Workflows/NativeEngine.ts` on main (`615d87516`, #3222): binding defects carried through
  retries as a tagged `BindingDefect` (139-158); same outcome.
- `packages/cloudflare/src/Workflows/Workflow.ts` on main (`615d87516`): `task`'s rollback gets its own error type
  `RollbackErr` (90-94, 165).
- `packages/cloudflare/src/Workflows/WorkflowName.ts` on main (`615d87516`): tests for an Effect with `isEffectOf`
  instead of `Effect.isEffect` (line 15); same outcome.
- `packages/effect-cluster/src/Cloudflare/internal/Objects.ts` on main (`97ff09fca`): the workflow object is given
  `DurableObjectCallbacks` too (144-146).
- `packages/domain/src/Cloudflare/index.ts` on main: the saga engine passes its objects through `provideCallbacks` as
  well (560-570).
- The docs pages are byte-identical at beta.87 and main.

## The engines, and what each stores and needs

| Engine | Layer | Where a run's journal lives | What it needs |
| --- | --- | --- | --- |
| Effect Cluster | `ClusterWorkflowEngine.layer` (Effect); Alchemy's `Cluster.Workflow` on a Node pool | Persisted cluster messages in `MessageStorage`: one entity `Workflow/<name>` per execution with `run`, `activity`, `deferred`, `resume` messages; clocks as `Workflow/-/DurableClock` messages with `DeliverAt` | `Sharding` and `MessageStorage` (`ClusterWorkflowEngine.ts:1115-1121`); runners; on Alchemy, a Postgres `Cluster.Database` |
| Alchemy Durable Object engine | `Cloudflare.Workflows.layerDurableObjectEngine({ jurisdiction? })`; also the Domain's Cloudflare host and `Cluster.Workflow` on the Durable Object pool, each from the same core | One Durable Object per execution (class `<Workflow>Workflow`), its SQLite tables `workflow_execution`, `workflow_activity`, `workflow_deferred`, `workflow_clock`, `workflow_progress`, `workflow_ran` | An Effect-native `Cloudflare.Worker` in context (the Layer requires `Worker`) |
| Effect workflows on Cloudflare Workflows | `Cloudflare.Workflows.NativeEngine` | One Cloudflare Workflow instance per execution; activities are `step.do`, sleeps `step.sleep`, signals `waitForEvent` | An Effect-native `Cloudflare.Worker`; Cloudflare's limits (steps per instance, step result size, waits up to 365 days) |
| In memory | `WorkflowEngine.layerMemory` (Effect); `InMemoryWorkflows.make(host)` (Domain) | Maps in the process | Nothing; not durable |

Details from the source:

- **Effect Cluster.** Every run, activity, deferred completion and clock is a persisted message; the reply to `run`
  is the run's result (`effect` 4.1.4 `src/cluster/ClusterWorkflowEngine.ts:1025-1048`, clocks 1059-1098). Each
  execution is one instance of the entity `Workflow/<name>` keyed by its execution id, with exactly one stored `run`
  (primary key `""`); an activity is stored under `<name>/<attempt>` (1057); the first completion of a deferred wins
  (838-843); a clock's wake-up time is computed once, so a retried save keeps it (890-907). A finished or suspended
  execution leaves memory after 10 seconds idle and is rebuilt from storage (1019-1023). The engine needs exactly
  `Sharding | MessageStorage` and registers the clock entity with it (1115-1121).
  A storage failure inside a run (an activity, a clock, a deferred, a child run) is retried and never becomes a
  result (`retryPersistence`, 914-926). Starting a top-level run is not retried: a storage failure there reaches the
  caller as a defect, so the caller is not blocked during an outage (`parent ? retryPersistence : Effect.orDie`,
  708-710).
  An activity can run its body and the write of its reply in one SQL transaction when annotated
  `ClusterSchema.WithTransaction` (790, 948-969; `ClusterSchema.ts:55-88`, transactional only if the `MessageStorage`
  implements it); `SqlMessageStorage` implements it as `sql.withTransaction`, a SQL error becoming a defect
  (`SqlMessageStorage.ts:1008-1011`), and opens interactive transactions elsewhere too (424, 667, 731).
  Stored replies are how a run knows which steps ran, so `MessageRetention` must never be put on workflow entities
  (`MessageRetention.ts:50-51`): a workflow's storage grows with every execution unless it is cleared another way.
  Alchemy's cluster coordinates through Postgres only (`effect-cluster/src/Database.ts:62-72`, `fromUrl` 100-113).
- **Alchemy Durable Object engine.** `makeDurableObjectEngine` (`alchemy/src/Workers/DurableObjectEngine.ts:65-246`
  at beta.87): `register` declares one Durable Object class per workflow on the host Worker (87-101), named
  `StorageName` or the tag with other characters replaced by `_` (604-609); `execute` calls the instance named by
  the execution id (103-122); an activity's exit is stored under `` `${name}/${attempt}` `` after it completes, and a
  stored one is replayed (149-190); a clock keeps its first due time across replays (222-241). Inside the object
  (339-540) every wake-up (start, completed deferred, fired clock, interrupt) schedules one durable callback `run`,
  so runs of one execution never overlap, and a failed run is retried (376-383); the run replays the handler from
  the top (430-472). Only a run that dies backs off: each journal entry that wakes the run advances a progress
  counter (`workflow_progress`) in the same transaction, so the wake-up after a successful step runs at once
  (362-372). A finished child resumes its parent (471, 543-547). A second `start` with the same id keeps the first
  payload (478-506). Starting, signalling, polling and interrupting are calls to the execution's object, retried 35
  times from 100 ms, at most 2 seconds apart, about a minute in all (564-582); `Workflows.RunWorkflow`'s `start`
  passes `discard: true`, so it returns once the execution row is written, before the run (`Workflows.ts:262-266`;
  281-289 on main). `interrupt` replays with the instance marked interrupted, which fails the run where it waits and
  runs its compensations (521-526); `interruptUnsafe` stops without them (528-537). The docs add that each workflow
  gets its own Durable Object class on the Worker, named after it, and that `alchemy dev` runs it in local workerd
  (`effect-workflows.mdx` 90-96, 264-274).
- **Cloudflare Workflows through `NativeEngine`.** One Workflow class, `NativeEngine`, runs every workflow the
  Worker implements (`cloudflare/src/Workflows/NativeEngine.ts:269-315`). Instance id: workflow name and execution
  id, at most 100 characters (108-114). Each activity attempt is one `step.do` named `` `${name}/${attempt}` ``
  (405-492), with Cloudflare's default 10-minute timeout and 5 retries unless `withStepConfig` says otherwise
  (58-102). `Activity.raceAll` and `DurableDeferred.raceAll` die on this engine (499-505). A signal waits at most
  365 days (132). The docs list these limits (`effect-workflows.mdx` 149-163). On main (the same code at beta.87): a
  second `start` with the same key creates nothing, since the engine reads the instance's status first and a create
  that fails while the instance now exists counts as started (336-359); a child run is awaited by polling its status
  in a `step.do`, sleeping 5 seconds between checks (366-382); an activity suspended on a failure waits for a resume
  event or an interrupt (476-500). `NativeEngine` is itself a Cloudflare Workflow, so its Worker's bundle must export
  a `WorkflowBridge` class for it, which only the generated entry of an Effect-native Worker does
  (`cloudflare/src/Workers/Sources/Rolldown.ts:238-245`).
- **Cloudflare Workflows directly**, without Effect workflows: `Cloudflare.Workflow<Self>()(name, props?, impl)` with
  `Cloudflare.Workflows.task(name, effect, { retries?, timeout?, rollback? })`, `sleep`, `sleepUntil`,
  `waitForEvent`, and `create`/`get`/`status` on the handle (`cloudflare/src/Workflows/Workflow.ts:164-224`,
  462-538, 1058-1170). An async Worker binds one in `env` with `Cloudflare.Workflow(name, { className })` and exports
  its own `WorkflowEntrypoint` (`Workflow.ts:286-340`, 862-917; `workflows.mdx` 365-385). On main (the same at
  beta.87): a Workflow is an account-wide resource; without `workflowName` its name is the host script and the
  class, lower-cased, with an 8-character hash, at most 64 characters (`WorkflowName.ts:27-36`). `jurisdiction` is
  fixed at creation: changing or removing it replaces the Workflow and deletes its instances (`Workflow.ts:331-340`,
  1344-1352). `create` returns at once; `id` pins a deterministic instance id, `retention` keeps finished instances
  for a set time, and `deleteBatch` removes up to 100 (462-491). A `task` failure crosses replays as serialized
  data, at most 16 KiB and 64 levels deep; `Effect.die` and `Effect.orDie` stop retries (137-164). An instance
  waiting in `waitForEvent` reports `running`, not `waiting` (`workflows.mdx` 184-185). `schedules` count against an
  account limit of 100 cron expressions (361-371).
- **In memory.** Effect's `layerMemory` keeps executions, activity exits, deferreds and clocks in maps, and a clock
  is an `Effect.delay`, so `TestClock` moves it (`WorkflowEngine.ts:732-1011`). The Domain's own engine
  (`packages/domain/src/InMemoryWorkflows.ts:57-252`) replays like the Durable Object engine and runs on a story's
  clock and queue (`Host`, 16-33), so a [story](./story.md) can drain sagas and fire their sleeps. For a test on
  Effect Cluster's engine with no database, `TestRunner.layer` gives `Sharding` and an in-memory `MessageStorage`
  (`effect` 4.1.4 `src/cluster/TestRunner.ts:30-38`).
- **`Cluster.Workflow` on a pool.** Declared like `Workflow.make` with `{ main }` props (only `main`: the pool imports
  the module's default export, `effect-cluster/src/Workflow.ts:44-50`) and an implementation that returns the handler
  (197-330). On a Node pool each run is Effect Cluster's workflow entity in Postgres (`ClusterWorkflowEngine.layer`,
  `internal/Bootstrap.ts:351-353` on main, 359-361 at beta.87). On `ClusterCloudflare.DurableObjectPool` each
  execution is the Durable Object `<class>:<executionId>` of `ClusterWorkflow`, running the same
  `makeDurableObjectEngine` (`Cloudflare/PoolWorker.ts:94-99`; `Cloudflare/internal/Objects.ts:149-160` at beta.87,
  155-166 on main; `internal/ObjectSharding.ts:102-107`; `cluster/cloudflare.mdx` "Workflows, singletons and crons").
  There Effect's `ClusterWorkflowEngine` cannot be used: the pool's `Sharding` refuses `registerEntity`, `send` and
  the rest (`ObjectSharding.ts:305-333`). A handler runs with the services its construction had plus the pool's
  `Sharding` (557-569), so it can call entities on the same pool. Its activities run in the pool's Worker, which has
  no D1 binding and cannot be given one (see [cluster](./cluster.md), "Rules"): such a workflow can call entities on
  the same pool and the outside network, not the app's data.

**What a caller can do through the pool's gateway.** A caller (another Worker, a script) reaches a `Cluster.Workflow`
through four RPCs on the pool's gateway: `Workflow.Start`, `Workflow.Poll`, `Workflow.Interrupt`, `Workflow.Signal`
(`effect-cluster/src/internal/WorkflowGateway.ts:31-42`, the same at both refs). Payloads, results and signal values
cross as JSON through the workflow's own schemas (60-71, 87-93).

| The caller does | What happens |
| --- | --- |
| `start(payload)` | Sends `Start` with `discard: true` and returns a `Run` at once (`Workflow.ts:441-447`) |
| `execute` without `discard` | Starts, polls once, and answers `Suspended` if the run has not finished (`WorkflowGateway.ts:146-162`) |
| `poll`, `run.status` | Reads the run's stored result (131-141) |
| `interrupt`, `interruptUnsafe` | Both send `Interrupt`: the run is interrupted on the pool, with its compensations (164-171, 83-84) |
| `run.signal(deferred, value)` | Sends `Signal`, which completes the deferred on the pool (175-185, 87-93) |
| `resume` | Nothing (172): a run suspended by `Workflow.SuspendOnFailure` cannot be resumed from a caller |
| an activity, a durable clock, a deferred read | Dies with `Cluster.RunsOnPool`: steps run only on the pool (98-103, 173-186) |

A gateway call that fails is a defect, with no retry (`Effect.orDie`, 129). A caller is bound
`CLUSTER_WORKFLOW_<name>_GATEWAY`, `_TOKEN` and, in a Worker, the service binding `_SERVICE`, each with every character
other than a letter or digit turned into `_` (`Workflow.ts:404-415`; `sanitizeKey`,
`packages/alchemy/src/RuntimeContext.ts:95`); the workflow's resource id is `<name>Workflow` (`Workflow.ts:110`).
Started outside any runtime, a run dies with `Cluster.WorkflowEngineOutsideRuntime`; a workflow no `Cluster.Workflow`
in the Stack declares dies with `Cluster.WorkflowNotHosted` (388-397, 423-430).

### How a saga is a workflow

`Domain.Saga(name, { key, input?, result?, rejects? })` builds exactly one `Workflow.make` whose payload is the key,
the input and a hidden `__cause` field, whose idempotency key is the key, whose success is the result struct and
whose error is the union of the rejections (`packages/domain/src/Saga.ts:269-291`). `Saga.toLayer` is
`workflow.toLayer` plus an `Implementation` marker (306-322). Its client starts runs with the key itself as the
execution id, not the hash (455-488), and `engineFor` renames each saga's workflow `<model>/<saga>` with storage name
`<Model>.<Saga>`, so two models never share runs (411-452). Everything on this page (activities, clocks, deferreds,
compensations, engines) applies to a saga unchanged; [saga](./saga.md) covers what the Domain adds.

**Which engine a saga runs on.** Not one the app chooses. Each Domain host brings its own engine with the platform
Layer: on Cloudflare, `layerDurableObjects` provides `Platform | WorkflowEngine` and requires `Worker`
(`packages/domain/src/Cloudflare/index.ts:505-512` at beta.87, `:511-518` on main); its engine, `sagaEngine`, is built
from the same `makeDurableObjectEngine` core that `Cloudflare.Workflows.layerDurableObjectEngine()` uses, with each
saga's class named after its model (beta.87 `:550-563`, main `:556-570`); it does not call `layerDurableObjectEngine()`.
On Rivet it is the same core (`packages/domain/src/Rivet/index.ts:225` at beta.87, `:226` on main). On the Effect
Cluster host it is the pool's engine, which the runner hands the host
(`packages/domain/src/EffectCluster/index.ts:760-768` on main): Effect's cluster workflow engine on a Node pool
(`effect-cluster/src/internal/Bootstrap.ts:351-353`), Alchemy's Durable Object engine on the Durable Object pool
(`Cloudflare/PoolWorker.ts:94-99`). In memory it is `InMemoryWorkflows`. So adopting a Domain saga on the Cloudflare
host brings Alchemy's Durable Object workflow engine with it, on the same Effect-native Worker the model is hosted on. A
plain `effect/workflow` beside it on that Worker would add `layerDurableObjectEngine()` as a second engine; whether two
engines on one Worker conflict was not checked.

## Rules, and the mistakes to avoid

- **Everything outside an activity runs again on every replay.** Reading the clock, generating an id, reading D1,
  calling a model: put each in an activity, or it repeats and may differ.
- **Activity names are the journal's keys.** Two activities with the same name in one run return the first one's
  stored result. In a loop, build the name from the loop's index and attempt (`piece-3-try-2`).
- **A recorded failure stays recorded.** The engines store an activity's exit whether it succeeded or failed with
  its typed error, and replay it (`DurableObjectEngine.ts:182-188`, `WorkflowEngine.ts:953-959`). To try again, use
  a new name or `Activity.retry`; a retry policy inside `execute` retries before anything is recorded.
- **An activity's side effect and its journal entry are not one write.** On the Durable Object and Cloudflare
  engines the exit is written after the body finishes. A crash between them runs the body again, so every side
  effect must be idempotent: a deterministic id, `ON CONFLICT DO NOTHING`. Only the cluster engine offers
  `WithTransaction`, and only for SQL in its own `MessageStorage` database. Even there the transaction does not cover
  everything: a failed commit runs the activity again unless a stored success is found, and stream chunks and
  `Deferred` replies are saved outside it (`ClusterSchema.ts:55-80`), so the side effect stays idempotent.
- **An activity that suspends is not memoized**: if it awaits a clock or a child run, its body runs again on replay
  (`Activity.ts:124-129`).
- **Sleeps of a minute or less are not durable** unless `inMemoryThreshold: 0` is passed (`DurableClock.ts:80-83`,
  119-128). Effect's own comment says the Cloudflare Durable Object engine provides a zero threshold
  (`DurableClock.ts:72-75`); Alchemy's engine does not set `InMemoryThreshold` at beta.87 or at main (searched: no
  reference), so the docs are right that the default is one minute (`effect-workflows.mdx` 174-175).
- **Compensations attach only to top-level steps** of the handler (`Workflow.ts:181`, 960-962).
- **Payload and results are stored as JSON through their schemas.** Use `S.Int`, strings and tagged unions; an
  `Option` must go through its schema.
- **A run has no signed-in person.** The handler runs from an alarm or a Workflows instance, not inside the request
  that started it. Anything that needs `CurrentActor` must rebuild it from the payload, and should read the member
  again (the person may have lost the role since).
- **Do not wait for `run.result` in a request.** It polls until the run finishes (`Workflows.ts:298-307`); return
  the execution id and let the screen read the status.
- **A start can hold the caller, or fail it.** On the Durable Object engine a start is a call to the run's object,
  retried for about a minute while the object is unreachable (a deploy, a reset), then a defect
  (`DurableObjectEngine.ts:564-582` at beta.87). On the cluster engine a storage failure while starting a top-level
  run is a defect at once, not retried (`ClusterWorkflowEngine.ts:708-710`), while the same failure inside a run is
  retried. Either way a start is safe to repeat with the same key, so the person can press again after a failed
  start.
- **A run suspended on a failure waits for an explicit `resume`.** With `Workflow.SuspendOnFailure`, the cluster
  engine's automatic wakes (a deferred, a child, a clock) skip it (`ClusterWorkflowEngine.ts:313`) and only `resume`
  starts it again (756); a caller through a cluster pool's gateway cannot resume at all (see above).
- **Give every workflow its own name.** On the cluster engine a second definition under the same tag only logs a
  warning and is registered too, so both share runs (`ClusterWorkflowEngine.ts:681-688`).
- **`raceAll` does not run on `NativeEngine`.** Use the Durable Object engine if a run must race.

## In this app

Today the model pass is one request: `POST /imports/:id/suggest` (`packages/catalog/model/src/Import/Imports.handler.ts:771-787`)
calls `suggest` (`packages/catalog/model/src/Suggestion/Suggestions.handler.ts:139-182`), which digests every open
row into one question, takes one call from the allowance only when a model is on (`propose`, 75-132), asks once
through `Answerer` (`packages/catalog/host/src/Answerer.adapter.ts:36-55`, 61-81), runs the guard and stores the
suggestions and one audit line in one batch. A provider's rate limit arrives as `AiUnavailable` with trouble `busy`
and `retryable: true` (`packages/drivers/openrouter/src/OpenRouter.schema.ts:171-193`), and the rules answer at once.

As a workflow, the pass asks in pieces. Each piece is an activity that checks the import is still open, then takes
one call from the allowance, then asks, then stores what passed the guard. A `busy` answer is recorded as data, the
run sleeps durably, and the next attempt is a new activity. When the allowance is used up, the rules answer for the
rest. The model proposes and never writes: the pass stores proposals for the person to accept or reject, and never
writes an item or a row decision (rule 8).

```ts
// SKETCH: not compiled
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import * as DurableClock from "effect/workflow/DurableClock"
import * as Workflow from "effect/workflow/Workflow"
import * as Workflows from "alchemy/Workflows"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { SuggestPass } from "./SuggestPass.port.ts"

/** What one piece came to. Recorded in the journal, so a replay never asks the model again for it. */
export const PieceOutcome = S.TaggedUnion({
  Stored: { suggestions: S.Int },
  Busy: {},
  UsedUp: { reason: S.String },
  Closed: {}
})

/** One model pass over an open import, started by one press of "Ask for suggestions". */
export const SuggestForImport = Workflow.make("SuggestForImport", {
  payload: { organizationId: OrganizationId, importId: ImportId, askedBy: MemberId, press: S.String },
  idempotencyKey: ({ importId, press }) => `${importId}/${press}`,
  success: S.Struct({ stored: S.Int, ended: S.Literals(["done", "usedUp", "closed"]) })
})

export const SuggestForImportLive = Workflows.layer(
  SuggestForImport,
  Effect.gen(function* () {
    // A port over the stores, the allowance and the answerer. Each method rebuilds the actor from the payload,
    // refuses if the member is no longer an editor, and acts as the `Suggestions` agent.
    const pass = yield* SuggestPass
    const ask = (run: typeof SuggestForImport.payloadSchema.Type, piece: number, attempt: number) =>
      Activity.make({ name: `piece-${piece}-try-${attempt}`, success: PieceOutcome, execute: pass.piece(run, piece) })

    return Effect.fn(function* (run) {
      const pieces = yield* Activity.make({ name: "plan", success: S.Int, execute: pass.plan(run) })
      let stored = 0
      for (let piece = 0; piece < pieces; piece++) {
        let outcome = yield* ask(run, piece, 1)
        for (let attempt = 2; outcome._tag === "Busy" && attempt <= 3; attempt++) {
          yield* DurableClock.sleep({ name: `piece-${piece}-wait-${attempt}`, duration: "2 minutes" })
          outcome = yield* ask(run, piece, attempt)
        }
        if (outcome._tag === "Closed") return { stored, ended: "closed" as const }
        if (outcome._tag === "UsedUp" || outcome._tag === "Busy") {
          const byRules = yield* Activity.make({ name: `rules-from-${piece}`, success: S.Int, execute: pass.byRules(run, piece) })
          return { stored: stored + byRules, ended: outcome._tag === "UsedUp" ? ("usedUp" as const) : ("done" as const) }
        }
        stored += outcome.suggestions
      }
      return { stored, ended: "done" as const }
    })
  })
)
```

What `pass.piece` does, in order, so the app's rules hold:

1. Reads the import; if it is not `open`, answers `Closed` before taking any call (rule 10: a closed import gets
   nothing more).
2. Takes one call with `ModelAllowance.take("suggest")`; on `usedUp` answers `UsedUp` (rule 9: counted before the
   call). The reservation id must be deterministic for the piece and attempt (for example a UUID derived from
   `Activity.idempotencyKey`), and the `modelCall` insert must ignore a second copy, or a crash between the call and
   the journal write counts the call twice. Today `Reservation.id` is a fresh UUID
   (`packages/access/model/src/Allowance/Allowance.handler.ts:30`) and the insert has no `ON CONFLICT`
   (`packages/access/host/src/AllowanceStore.adapter.ts:36-40`).
3. Asks through `Answerer`; a `busy` answer becomes `Busy`, any other failure falls to the rules for that piece.
4. Runs the guard (`Suggest.rules.ts`) and stores with `SuggestionStore.store`, which keeps a row's first suggestion
   (`Suggestions.handler.ts:135-138`), so a re-run stores nothing twice; one audit line per piece. No item, no
   decision (rule 8).

Compensation is not needed: nothing the pass writes has to be undone when it fails. A confirm or a remove of the
import does not need to interrupt the run, because the next piece sees `Closed`; `run.interrupt` is there if the
person presses "Stop asking".

**What the person sees while it runs.** The press answers at once with the run's execution id, which the server can
also recompute from the payload (`SuggestForImport.executionId`). The Review step says "Asking for suggestions" and
reads the import again every few seconds: each stored piece adds its proposals to the rows, waiting for the person
like today's. A wait on the provider reads "The model is busy; trying again in two minutes"; a used-up allowance
reads the allowance's own sentence and "the rules answered the rest". When the run is `Completed`, the step shows
who answered and how many were stored. This changes what the Suggest endpoint answers (a run, not the suggestions),
which is a decision for the app's owner.

- **Used today:** no. The pass is one model call inside one request (`Suggestions.handler.ts:139-182`), started by
  `imports.suggest` (`Imports.handler.ts:771-787`).
- **Where it goes:** a `SuggestForImport` workflow and a `SuggestPass` port in `packages/catalog/model/src/Suggestion/`,
  its D1 implementation in `packages/catalog/host/src/`, the engine Layer and `SuggestForImportLive` on the second,
  Effect-native Worker declared in `packages/infra/src/Inventory.stack.ts` (see "What it needs"), a changed `suggest`
  endpoint in `packages/catalog/contract/src/Catalog.contract.ts`, and the Review step's polling in the web package.
- **What the person gets:** suggestions for a large file arrive piece by piece and survive a provider's rate limit,
  instead of the whole pass falling to the rules on the first `busy`.

## How to check it

- A fast test on `WorkflowEngine.layerMemory` with `Workflows.layer`, the in-memory ports
  (`packages/catalog/model/src/Catalog.memory.ts`) and a scripted `Answerer` that answers `busy` once, then an
  answer: start a run, move `TestClock` two minutes, read `run.result`; check the stored suggestions, that the
  allowance counted two calls for the piece, and that no item exists.
- The same test with 39 calls already taken: one piece asks, the rest are the rules', and `ended` is `usedUp`.
- Close the import (confirm it) between pieces: the run ends `closed` and takes no further call.
- A test that runs the activity body twice for the same piece and attempt (as a crash would): one `modelCall` row,
  one set of suggestions.
- For the Domain variant (a saga), a story drains the run on `InMemoryWorkflows` ([story](./story.md)).
- On the real engine, `alchemy dev` runs the Durable Object engine in local workerd (`effect-workflows.mdx` 273-274).
  Not verified for this app.
- Nothing on this page was run: the trials of 2026-11-19 ran no workflow, saga or engine.

## What it needs

Today the app runs no workflow and has no engine: the model pass is one request. The app deploys one Worker,
`Cloudflare.Website.Vite` over `apps/inventory/src/server/worker.ts`, a plain module that exports `{ fetch }`
(`packages/infra/src/Inventory.stack.ts:102-130`; `worker.ts:39`), with one D1 database. `Website.Vite` takes no
Effect implementation (`cloudflare/src/Website/Vite.ts:251-307`), so the app's Worker is not an Effect-native
`Cloudflare.Worker`. Each engine, against that:

| Engine | Can it run this app's model pass? | What it needs | The blocker, exactly |
| --- | --- | --- | --- |
| Effect Cluster's (`ClusterWorkflowEngine.layer`; `Cluster.Workflow` on a Node pool) | No | `Sharding` and `MessageStorage` (`ClusterWorkflowEngine.ts:1115-1121`); on SQL, `SqlMessageStorage`, which opens interactive transactions; Alchemy's runners on Postgres | D1 has no interactive transactions (`@effect/sql-d1` `src/D1Client.ts:340` dies on one; `packages/drivers/d1/src/D1.service.ts:5` in the app). The one-process `SingleRunner.layer` does not help: it always uses `SqlMessageStorage` and needs a `SqlClient` and a `Digest` (`effect` 4.1.4 `src/cluster/SingleRunner.ts:27-79`). Removed only by a second, transactional database (Postgres) and runners |
| Alchemy's Durable Object engine (`Cloudflare.Workflows.layerDurableObjectEngine({ jurisdiction? })`) | Yes, on a second Worker | An Effect-native `Cloudflare.Worker` in context: the Layer requires `Worker` (`cloudflare/src/Workflows/DurableObjectEngine.ts:86-88` on main, 84-86 at beta.87). One Durable Object per run holds its journal in its own SQLite and replays the handler on each wake | The app's own Worker is not Effect-native. Add a second, Effect-native Worker with the app's D1 database and the model key in its `env` (a D1 database is a resource reference the `env` prop binds, `Workers/Worker.ts:855-884` in the installed beta.87 package), reached from the app's Worker by a service binding; its activities write D1 like any request. It is the same Worker [cluster](./cluster.md) adds as the cluster's caller |
| A Domain [saga](./saga.md) on `DomainCloudflare.layerDurableObjects()` | Yes, with the model on an Effect-native Worker | Nothing more: the host builds its own copy of the Durable Object engine from the same core (`sagaEngine`), so adopting a saga brings the engine with it | The same as the row above: the model's Worker is Effect-native, so it is not today's `Website.Vite` Worker |
| Effect workflows on Cloudflare Workflows (`Cloudflare.Workflows.NativeEngine`) | Yes, on a second Worker | An Effect-native `Cloudflare.Worker` (`NativeEngine.ts:278` on main, 269 at beta.87) whose generated entry exports the `WorkflowBridge` class (`Workers/Sources/Rolldown.ts:238-245`) | As for the Durable Object engine; and `raceAll` dies on it |
| `Cluster.Workflow` on `ClusterCloudflare.DurableObjectPool` | Only for steps that need nothing from D1 | The pool (see [cluster](./cluster.md)); each run is one `ClusterWorkflow` object on the Durable Object engine | The pool's Worker has no D1 binding and cannot be given one. The model pass reads and writes D1, so it cannot run there |
| Cloudflare Workflows, plain form | Yes, from the app's Worker as it is | A `WorkflowEntrypoint` class exported from `worker.ts` and bound in the `Website.Vite` `env` with `Cloudflare.Workflow(name, { className })` (`cloudflare/src/Workflows/Workflow.ts:286-306`, 862-917 on main; `workflows.mdx` "Async Workers"). `Website.Vite` documents a custom `main` for a Worker that must export more than the framework's fetch handler (`Website/Vite.ts:93-110`), and the app already sets `main: "src/server/worker.ts"` | None found. It is not `effect/workflow`: steps are Cloudflare's `step.do` and `step.sleep`, written without this page's activities, clocks and deferreds. Not built or deployed here |
| In memory (`WorkflowEngine.layerMemory`; the Domain's `InMemoryWorkflows`) | Tests only | Nothing | Not durable |

beta.87 has everything used above; main changes nothing the sketch relies on.

## Verdict

**Use:** write the model pass as an `effect/workflow` (`SuggestForImport` above), test it on
`WorkflowEngine.layerMemory`, and run it in production on `Cloudflare.Workflows.layerDurableObjectEngine()` on a
second, Effect-native `Cloudflare.Worker` that has the app's D1 database and model key in its `env` and is reached from
the app's `Website.Vite` Worker by a service binding. This works on beta.87. If a second Worker is not wanted, the same
pass runs as a plain Cloudflare Workflow from the app's own Worker (a `WorkflowEntrypoint` exported from `worker.ts`,
one `step.do` per piece and a `step.sleep` on `busy`), without `effect/workflow`. A Domain saga brings the Durable
Object engine itself on the Domain's Cloudflare host. The Effect Cluster engine is not for this app: it needs a
transactional database and runners, and D1 is neither.

## Where this was read

- https://alchemy.run/cluster/workflows (the live site documents beta.87)
- https://alchemy.run/cloudflare/compute/effect-workflows
- https://alchemy.run/cloudflare/compute/workflows
- https://alchemy.run/cloudflare/compute/add-a-workflow
- `website/src/content/docs/cluster/workflows.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/cloudflare/compute/effect-workflows.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/cloudflare/compute/workflows.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/cloudflare/compute/add-a-workflow.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/cluster/cloudflare.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/alchemy/src/Workflows.ts` at `v2.0.0-beta.87` (published package); on `main@dbfd0ddb`: changed (types)
- `packages/alchemy/src/WorkflowEncoding.ts` at `v2.0.0-beta.87` (published package); on `main@dbfd0ddb`: same
- `packages/alchemy/src/Workers/DurableObjectEngine.ts` at `v2.0.0-beta.87` (published package); on `main@dbfd0ddb`: changed
- `packages/cloudflare/src/Workflows/{index,DurableObjectEngine,NativeEngine,WorkflowBridge,WorkflowName,WorkflowRuntime,Workflow}.ts`
  at `v2.0.0-beta.87` (published package); on `main@dbfd0ddb`: `index`, `WorkflowBridge`, `WorkflowRuntime` same;
  the others changed
- `packages/effect-cluster/src/Workflow.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/effect-cluster/src/Database.ts`, `Cloudflare/internal/Objects.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`:
  same, changed
- `packages/domain/src/Saga.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (doc example only)
- `packages/domain/src/InMemoryWorkflows.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `effect` 4.1.4 (the app's installed copy): `src/workflow/*.ts` and `internal/crypto.ts`; `src/cluster/ClusterWorkflowEngine.ts`,
  `ClusterSchema.ts`, `MessageRetention.ts`, `SqlMessageStorage.ts`, `SingleRunner.ts`, `TestRunner.ts`
- `@effect/sql-d1` as the app installs it: `src/D1Client.ts`
- `packages/effect-cluster/src/internal/WorkflowGateway.ts`, `internal/ObjectSharding.ts`, `internal/Bootstrap.ts`,
  `Cloudflare/PoolWorker.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same, same, changed, same
- `packages/cloudflare/src/Workers/Sources/Rolldown.ts` at `v2.0.0-beta.87` (published package); on `main@dbfd0ddb`: same lines cited
