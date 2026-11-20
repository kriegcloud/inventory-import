---
type: Reference
title: Observability
description: The spans, span attributes and metrics a hosted domain model records by itself, the correlation id that ties a flow together, and how inventory-import would send them beside the request tracing it already has.
tags: [alchemy-domain, host]
---

# Observability

A hosted model records its own work into whatever Effect tracer and metric exporters the runtime provides. Every
command sent, every decide and commit, and every view, policy, projection, saga, external call, query and validate
gets a span named after the building block, with structural attributes (`domain.*`) and never a payload value unless
your handler annotates it. Reactions continue the trace of the commit that caused them, and work that starts later
(a saga run, a projection batch, a scheduled command) starts its own trace and links back. One attribute,
`domain.correlation_id`, joins a whole business flow across traces. The docs: "A model records what it does as it
does it." [https://alchemy.run/domain/observability].

## When to reach for it

- To see an import's confirm as one trace: the request, the command, the commit, and each consumer that reacted.
- To follow a flow that spans traces (a confirm, then the [projection](./projection.md) batch that wrote `item` rows,
  then a [policy](./policy.md)) by one id.
- To watch lag: `domain.lag` says whether projections and policies keep up with commits.
- To turn off the busiest spans (views) when they cost more than they tell.

## How it is declared

Nothing is declared: the engine opens its spans. What you choose is the exporter (a Layer on the Worker), whether
views are traced (an option of the model's `layer`), and what your handlers add.

```ts
// SKETCH: not compiled
import * as Effect from "effect/Effect"

// The model's Layer, with view spans off.
export const CatalogLive = Catalog.layer(CatalogHandlers, { telemetry: { views: false } })

// Inside a decide: annotate the span the engine already opened. A plain Effect.fn, not a named one.
const confirm = Effect.fn(function* (draft: Draft, cmd: ConfirmImport) {
  yield* Effect.annotateCurrentSpan("inventory.rows", cmd.rows)
  // ...
})
```

The spans, at beta.87 (name, kind, where):

| Span | Kind | Opened by | Notes |
| --- | --- | --- | --- |
| `Domain.send <Aggregate>.<Command>` | client | the caller (the Worker) | `domain.aggregate`, `domain.id`; sets `domain.command_id`, `domain.correlation_id`, then `domain.outcome` |
| `Domain.schedule <Aggregate>.<Command>` | client | the caller | the command runs later and its decide links back |
| `Domain.unschedule <Aggregate>` | client | the caller | `domain.command_id` |
| `Domain.decide <Aggregate>.<Command>` | server | the instance | child of the send, or linked if scheduled; one span event per committed event (`domain.seq`); `domain.outcome`, `domain.events`, `domain.version` |
| `Domain.view <View>` | consumer | the view key | child of the commit's span for one delivery, else linked to each; skipped when `views: false`, and when every delivery is history (a backfill) |
| `Domain.policy <Policy>` | consumer | the policy | child of the commit's span |
| `Domain.projection <Projection>` | consumer | the projection key | a root span linked to every commit in the batch; `domain.correlation_id` only when the batch's inputs share one |
| `Domain.saga <Saga>` | consumer | the run | a root span per run, linked to the cause |
| `Domain.external <System>.<op>` | client | the external system's implementation | `domain.system`, `domain.operation` |
| `Domain.query <Query>` | (default) | the Api | `domain.query`, `domain.outcome`, `domain.query.rows` when paged |
| `Domain.caughtUp <Projection or View>` | (default) | a query waiting on `atLeast` | `domain.stream`, `domain.version` |
| `Domain.validate <View or Stream>` | (default) | a guarded read | `domain.read`, `domain.mode` |
| `Domain.read <tag>` | server | a live read over the Api | continues the client's trace; `domain.read`, `domain.key` |

Common attributes: `domain.aggregate`, `domain.command`, `domain.id`, `domain.stream`, `domain.command_id`,
`domain.correlation_id`; on reactions `domain.source`, `domain.seq`, `domain.event`, `domain.key`, `domain.batch`,
and the consumer's own name (`domain.view`, `domain.policy`, `domain.projection`, `domain.saga`).

The metrics (`packages/domain/src/Telemetry.ts`), all with `domain.*` attributes:

| Metric | Type | Attributes |
| --- | --- | --- |
| `domain.commands` | counter | `domain.aggregate`, `domain.command`, `domain.outcome` |
| `domain.command.duration` | histogram, ms, 22 doubling buckets from 1 | `domain.aggregate`, `domain.command` |
| `domain.events` | counter | `domain.aggregate`, `domain.event` |
| `domain.lag` | histogram, ms, the same buckets, commit to handling | `domain.kind`, `domain.consumer` (recorded for policies and projections only) |
| `domain.runs` | counter | `domain.kind` (view, policy, projection, saga), `domain.consumer`, `domain.outcome` |
| `domain.projection.batch_size` | histogram, 12 doubling buckets from 1 | `domain.consumer` |
| `domain.queries` | counter | `domain.query`, `domain.outcome` |
| `domain.external.calls` | counter | `domain.system`, `domain.operation`, `domain.outcome` |

`domain.outcome` is `accepted` or the rejection's tag (else `rejected`) on commands; `ok` or `failed` on views,
policies, projections and external calls; `ok`, the failure's tag or `defect` on sagas and queries (`outcomeOf`). A
rejection is an answer: its span ends cleanly; only a defect marks a span failed.

`domain.correlation_id` is the id of the first command in a chain. `correlationFor` returns the id in the
`Correlation` service if one is provided (policies and sagas provide it), else the new command's own id; every
delivery carries it in its envelope.

Checked in: `packages/domain/src/Telemetry.ts:12-29` (`Options`, `views` default `true`), `:60-66` (`Correlation`,
`correlationFor`), `:70-111` (metrics), `:121-126` (`outcomeOf`); `packages/domain/src/Model.ts:202` and `:351`
(`LayerOptions.telemetry`), `:396-431` (projection span and metrics), `:619-621` (validate), `:745-829` (send,
schedule, unschedule); `packages/domain/src/Kernel.ts:139-145` (delivery attributes), `:1083-1090`, `:1158-1205`
(decide span, span events, command metrics), `:1288-1313` (view span), `:1437-1477` (policy span);
`packages/domain/src/Saga.ts:30-62`; `packages/domain/src/ExternalSystem.ts:28-41`;
`packages/domain/src/Query.ts:455-492`; `packages/domain/src/Api.ts:851`, `:886-900`; all at `v2.0.0-beta.87`.

### Types and helpers

`Telemetry.ts` is exported as `Domain.Telemetry` (`packages/domain/src/index.ts:299`). The metrics are public, so an
app can read or re-export them; the rest is marked `@internal`.

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `Options` | The Layer's telemetry option: `views` (default `true`) | `Telemetry.ts:12-19` |
| `Resolved`, `resolve` | The options with defaults filled in (internal) | `Telemetry.ts:22-29` |
| `TraceJson` | A span's `traceId`, `spanId`, `sampled`, as a Schema struct stored with what it caused (internal) | `Telemetry.ts:32-37` |
| `currentTrace`, `spanOf` | The current span as `TraceJson`; a stored one as an external span to continue or link to (internal) | `Telemetry.ts:40-51` |
| `Correlation`, `correlationFor` | The flow's id as a service, and the id for a new command (internal) | `Telemetry.ts:60-66` |
| `commands` | Counter `domain.commands` | `Telemetry.ts:73-76` |
| `commandDuration` | Histogram `domain.command.duration`, ms | `Telemetry.ts:78-81` |
| `events` | Counter `domain.events` | `Telemetry.ts:83-86` |
| `lag` | Histogram `domain.lag`, ms | `Telemetry.ts:88-91` |
| `runs` | Counter `domain.runs` | `Telemetry.ts:93-96` |
| `batchSize` | Histogram `domain.projection.batch_size` | `Telemetry.ts:98-101` |
| `queries` | Counter `domain.queries` | `Telemetry.ts:103-106` |
| `externalCalls` | Counter `domain.external.calls` | `Telemetry.ts:108-111` |
| `record` | Update a metric with attributes (internal) | `Telemetry.ts:114-118` |
| `outcomeOf` | `ok`, the failure's tag, or `defect` (internal) | `Telemetry.ts:121-126` |

### What main changes

- `Telemetry.ts` and `observability.mdx` are unchanged (same text at both refs). Every metric name above is the same
  on main.
- New spans for decisions (unpublished on beta.87; see [decision](./decision.md)), commit `dbda8cc16` (#3420):
  `Domain.send <Decision>`, kind client, with `domain.decision` (`packages/domain/src/Model.ts:1129-1131` on
  `main@dbfd0ddb`), and `Domain.decide <Decision>`, kind server (`packages/domain/src/Kernel.ts:1542`). A decision
  records `domain.commands` and `domain.command.duration` with its own name as `domain.aggregate`
  (`Kernel.ts:1555-1561`).
- A new `Domain.applied` span with `domain.stream`, around a command's wait for its views to apply its commits
  (`packages/domain/src/Model.ts:1794`), commit `bc0024faf` (#3469).
- The other spans only moved lines: `Model.ts:608` (projection), `:851` (validate), `:1050` (send), `:1078`
  (schedule), `:1085` (unschedule); `Kernel.ts:1296` (decide), `:1656` (view), `:1841` (policy); `Query.ts:462`,
  `:499`; `Api.ts:1062`; `Saga.ts:56` and `ExternalSystem.ts:37` unchanged.
- Alchemy's runtime telemetry docs add: a Durable Object gets its own trace and log exporters, built once, flushed at
  the end of each event; do not call `provideProcessTelemetry` inside one
  (`website/src/content/docs/infrastructure-as-effects/telemetry.mdx:153-162` on main). `layerOtlp`'s `serviceName`
  now takes precedence over `OTEL_SERVICE_NAME` (`packages/alchemy/src/Telemetry.ts:150-151`, `:303-305`).

## Rules, and the mistakes to avoid

- **Nothing from a payload is recorded unless you annotate it.** Annotate only what you need; never a secret. Make a
  secret field `Schema.Redacted(...)` (`observability.mdx:100`).
- **Inside a handler the engine has already opened the span.** A `decide`, a query's handler, a view's `validate`,
  a policy, a saga step, a projection and an external operation all run inside it. Annotate with
  `Effect.annotateCurrentSpan`. The docs say to use a plain `Effect.fn`: a named `Effect.fn("Name")` adds a second
  span nested under the engine's (`observability.mdx:96`).
- **Without an exporter nothing leaves the runtime.** Effect's default tracer is the native one: it makes spans in
  memory and sends them nowhere (`effect` `packages/effect/src/Tracer.ts:638-641`).
- **`Cloudflare.Telemetry()`** puts spans in Cloudflare's dashboard, but Cloudflare starts a new trace for every Worker
  and Durable Object event, so a flow that crosses objects is several traces joined only by `domain.correlation_id`,
  and browser spans cannot be added (`observability.mdx:20`). Use an OTLP destination
  (`Alchemy.Telemetry.layerOtlp`, or a vendor layer such as `Axiom.Telemetry`) for one connected trace.
- **Views are the busiest spans.** `{ telemetry: { views: false } }` on the model's `layer` turns them off, and with
  them the view's `domain.runs` count (`Kernel.ts:1289`). It is the only telemetry option at beta.87 and on main.
- **History applied by a backfill is not traced** as view spans (`Kernel.ts:1289`).
- **Logs from a handler** carry the span's trace and its `domain.*` attributes (`Effect.annotateLogs` with the same
  attributes; `Kernel.ts:1184`, `:1470`, `Saga.ts:55`).

## In this app

Today the Worker traces each HTTP request: `HttpTracing` names the server span `METHOD /api/v1/<group>`,
`RequestMetrics` counts `http_requests` and `http_duration_ms`, and the identity middleware stamps the actor and
organization ids on every span and log line. Exporters are built per request and flushed under `waitUntil`
(`apps/inventory/src/server/RequestTelemetry.ts`), because an exporter built once per isolate stopped delivering
after the first request (measured, as that file says). They go to an OTLP collector when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set (`apps/inventory/src/server/Telemetry.ts`; `apps/inventory/telemetry/compose.yaml`
runs Grafana's LGTM stack locally), and the browser's batches come in through `/api/otlp` (`OtlpProxyRoute`).
Cloudflare Workers Logs is on (`apps/inventory/wrangler.jsonc`, `observability`).

With the model in place, a confirm reads as one trace: `POST /api/v1/imports` (the app's span), then
`Domain.send Import.ConfirmImport`, then `Domain.decide Import.ConfirmImport` in the import's object with one span
event per committed event, then `Domain.view` for the import's result view; the `Domain.projection ItemsTable` batch
that writes `item` rows is its own trace, linked back, and found by `domain.correlation_id`.

**A decision for the owner.** The app's rule is a named span on every service call: `Effect.fn("Service.method")`
(`docs/standards/config-and-logs.md:44`, `docs/patterns.md:289`). The domain docs say the opposite for the code
the engine runs: a `decide`, a query's handler, a `validate`, a policy, a saga step, a projection and an external
operation should be a plain `Effect.fn`, because a name adds a second span nested under the engine's
(`website/src/content/docs/domain/observability.mdx:96`). The two options:

- keep the app's rule everywhere, and accept one extra nested span per handler (the prover on main reads
  `Effect.fn("name")(body)` the same as `Effect.fn(body)`, `packages/domain/src/Prove/internal/Library.ts:129-134`,
  so a name costs only the span);
- or except domain handlers from the rule (unnamed `Effect.fn`, or `Effect.fnUntraced`, annotating the engine's span)
  and keep the named form for the app's own services and adapters.

Until the owner decides, the sketches in these pages use the unnamed form inside domain handlers.

Two open questions for this app, not verified: whether the per-request exporters in `RequestTelemetry.ts` see the
spans a Durable Object records (they run in another object's event, so they would need Alchemy's own per-object
exporters, `Alchemy.Telemetry.layerOtlp`); and whether to send them to the same collector. The trial on 2026-11-19
attached no tracer or exporter, so nothing on this page was observed running.

- **Used today:** no. In its place: per-request OTLP export of HTTP spans and metrics
  (`apps/inventory/src/server/Telemetry.ts`, `RequestTelemetry.ts`, `Observability.ts`).
- **Where it goes:** `apps/inventory/src/server/worker.ts` (the Worker's exporter layer); the model's
  `layer(..., { telemetry })` call in the composition (`apps/inventory/src/server/App.ts`); dashboards for
  `domain.lag` and `domain.commands` in the local Grafana.
- **What the person gets:** nothing they can see; the owner gets one trace per confirm and a lag number per projection.

## How to check it

- Run the app with the local stack (`bun run telemetry`), confirm an import, and find `Domain.decide` and
  `Domain.projection` spans sharing one `domain.correlation_id` in Grafana's Tempo.
- In a test, provide a tracer that collects spans and assert the span names and `domain.outcome` for an accepted and
  a rejected confirm. The spans are opened by the kernel and the model's client, which the in-memory host runs too;
  not run.
- Check that no span carries a cell value from the file: search the exported spans for a SKU from the sample.

## What it needs

Any host: the spans come from the kernel and model, which every host runs. An exporter on the Worker (and, on
Cloudflare, on each Durable Object event, which Alchemy's runtime telemetry layers handle). beta.87.

## Verdict

**Use:** keep the app's request tracing, add `Alchemy.Telemetry.layerOtlp` (or the existing collector) so the
model's spans and `domain.*` metrics reach the same backend, and settle with the owner whether handlers the engine
runs keep the app's named `Effect.fn` or take the docs' unnamed one. It works on beta.87.

## Where this was read

- https://alchemy.run/domain/observability (the live site documents beta.87)
- https://alchemy.run/infrastructure-as-effects/telemetry
- `website/src/content/docs/domain/observability.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/infrastructure-as-effects/telemetry.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Telemetry.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Kernel.ts`, `Model.ts`, `Saga.ts`, `ExternalSystem.ts`, `Query.ts`, `Api.ts` (span sites) at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Prove/internal/Library.ts` on `main@dbfd0ddb` (how `Effect.fn` is read)
- `packages/alchemy/src/Telemetry.ts` on `main@dbfd0ddb` (outline); the published `alchemy@2.0.0-beta.87` copy differs
  only in the `serviceName` key
- `packages/effect/src/Tracer.ts` in `effect@4.1.4`
- `docs/standards/config-and-logs.md`, `docs/patterns.md`, `apps/inventory/src/server/{Telemetry,RequestTelemetry,Observability}.ts`
  in inventory-import
