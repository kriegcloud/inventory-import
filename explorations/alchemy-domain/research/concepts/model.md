---
type: Reference
title: Domain.Model
description: One bounded context declared as a list of building blocks, checked by Domain.verify (by building its Layer at the pin) and hosted by Model.layer; inventory-import would declare one for the catalog and one for access.
tags: [alchemy-domain, declaration]
---

# Domain.Model

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

A `Domain.Model` is the list of building blocks that run together as one bounded context: its aggregates, views,
policies, projections, streams, sagas and queries (and, on main only, decisions, relations, invariants and `eventually`
rules). The declaration runs nothing. `Model.layer(handlers, options)` turns it into an Effect `Layer` that hosts every
block on whatever `Domain.Platform` you provide, and `Domain.verify(Model)` checks the declaration without hosting it
(at beta.87 and `dbfd0dd`; at the pin it is removed, and building the Layer makes that check). The docs define it as
"one bounded context running as a whole" [https://alchemy.run/domain/model]. Commands and events are not listed: they
come with the aggregates that declare them.

## When to reach for it

- Once per bounded context. In this app that is two: the catalog (items, imports, row decisions, suggestions) and
  access (people, roles, activity, the model-call allowance). Each would be its own model.
- As soon as there is one [aggregate](./aggregate.md): a model can start with a single aggregate and grow.
- Whenever a test, a host or an [Api](./api.md) needs the blocks together: `Story.make(Model, ...)` (see
  [story](./story.md)), `Domain.Api(..., { model })` and every host take the model, not loose blocks.
- Never to join two contexts. One model calls another through its Api, never by sending to the other's aggregates.

## The two docs pages this page also covers

**Introduction** (`/domain`). The package models a business in its own words: commands ask for changes, aggregates
decide them, events record what happened, and views, projections and policies answer questions, feed stores you own
and apply standing rules. The same model runs in memory for tests and on Cloudflare, Rivet or Effect Cluster, with one
ordered partition per key. It shows a command, its `decide` branch and a story, then explains how to install the
`alchemy-domain` agent skill (with `skills-npm`, from GitHub, or as a Claude Code plugin) and where to start reading.
On main the introduction adds decisions, and its sample command carries the account id in `input` instead of a
`target`.

**What is Domain-Driven Design?** (`/domain/what-is-ddd`). A plain-language tour of the ideas the package is built
on, using a bank: the domain and its model; the shared (ubiquitous) language; commands as requests that can be
refused; events as facts; aggregates as consistency boundaries that protect invariants with `decide` and `evolve`;
event sourcing (state is the fold of the events); CQRS (the command side records events, the query side builds read
models from them); views and projections; queries across many records; policies as standing rules that act after an
event; sagas for multi-step processes; given/when/then testing; and bounded contexts. It ends by naming each idea's
building block and listing a model. On main it adds a "Decisions" section: a command that spans several aggregates is
decided once, by a [decision](./decision.md) that reads them all and records on each or on none.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"

export class Catalog extends Domain.Model(
  "Catalog",                                  // the model's name: its storage is its own
  {
    aggregates: [Import, Item],               // required
    views: [ImportResult],                    // optional, as are all below
    policies: [],
    projections: [],
    streams: [],
    sagas: [],
    queries: []
  },
  { description: "Items of an organization and the files brought in to make them." } // annotations, optional
) {}
```

What the class carries (beta.87): `kind` (`"Model"`), `annotations`, `modelName`, `aggregates`, `commands` (every
command of every aggregate, each once, in order), `views`, `streams`, `queries`, `definitions` (the raw lists, read by
hosts and `verify`), `sagas`, and the static `layer`. On main it also carries `decisions`, `invariants`,
`eventually` and `relations` (main `Model.ts:221-238`, set at `:509-517`).

On main the members gain four model-level entries beside the blocks. Their shapes (main `Model.ts:117-202`):

```typescript
// SKETCH: not compiled (main@dbfd0ddb shapes)
export class Catalog extends Domain.Model("Catalog", {
  aggregates: [ImportDraft, Item],
  // ReadonlyArray of Domain.Decision; a decision whose command an aggregate already implements is a type error
  decisions: [],
  // { readonly [name: string]: Domain.Relation }: proved by Verify.model
  relations: {},
  // { readonly [name: string]: (model: Instances & Keys & Fed) => boolean }: true while the rule holds
  invariants: {
    EveryConfirmedFileAddsUp: (catalog) =>
      catalog.ImportDraft.every((draft) =>
        draft.state._tag !== "Imported" ||
        draft.state.ready + draft.state.waiting + draft.state.left === draft.state.rows
      )
  },
  // same shape as invariants: what holds once every policy, saga and scheduled command has run its course
  eventually: {}
}) {}
```

The function a model invariant or an `eventually` rule takes is given one record keyed by block name: every aggregate
instance as `{ id, state, events }` (`Instances`, main `Model.ts:195-202`), every view key that has a state as
`{ id, state }` (`Keys`, `:186-192`), and what each projection was given as `{ id, event }`, oldest first (`Fed`,
`:177-183`). An invariant must hold whenever nothing is left to react (every policy has handled its events, every saga
has finished or waits); an `eventually` rule must hold at the end of every sequence once every scheduled command has
come due (doc comments at `:141-169`). Upstream's bank declares both (main
`examples/cloudflare-domain/packages/domain/src/Bank.model.ts:74-110`: three invariants such as
`TransfersLoseNoMoney`, and `eventually.EveryTransferEnds`). `Explore.check` and `Verify.model` read them
(`Verify.ts:233-277`); they search for a breaking sequence, they do not prove these rules (see
[invariants-and-transitions](./invariants-and-transitions.md), [explore](./explore.md), [verify](./verify.md)).

`Model.layer(handlers, options?)`:

- `handlers` is one `Layer` that provides every implementation the model needs: each policy's handler, each
  projection's handler, each saga's implementation, each query's handler, and the `validate` Layer of every view or
  stream that declares middleware or rejections. With none of those, pass `Layer.empty`. The type of `handlers` is
  computed from the members, so a missing implementation is a type error.
- The handlers are built after the aggregates, views and streams are hosted, so a handler may `yield*` an aggregate
  or view client while it is constructed.
- The result provides every aggregate, view and stream as a service, each saga's client, each projection's
  `Progress`, and an internal `Internals` service. It requires `Domain.Platform`, `SecureRandom`, and whatever the
  handlers need that the model does not provide itself. `Domain.InMemory` provides `Platform`, a `WorkflowEngine` and
  `SecureRandom`.

`options` (`Model.LayerOptions`), every field:

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `telemetry` | `{ views?: boolean }` | `{ views: true }` | `views: false` stops tracing each view applying an event, the busiest span. See [observability](./observability.md). |
| `legacyData` | `boolean` | `true` | For a Worker deployed before Domain version 0, where models listing the same block shared one Durable Object class. The first deploy renames the shared class to the model's, keeping its data; set `false` on every other model that shared it, which then start empty. |
| `lazy` | view names | `[]` | Views that fill lazily when added: no backfill at deploy, each key reads its own history when first read or when its source next changes. Only for a view that reads one aggregate and is keyed by it; anything else makes the Layer die with `LazyViewNeedsOneSource`. |

### The commit path, checked against source

The docs describe what happens to every command. Each step below names where the source does it (beta.87).

1. **Routed to one instance.** The aggregate client turns the target into an id and calls the platform store's
   `send(id, command, meta)`. The platform contract requires a single writer per id; the in-memory platform holds a
   one-permit lock per aggregate type while it commits.
2. **Decided.** The kernel decodes the command and the state, runs `decide` (an effectful `decide` runs with the
   request context the command was sent with), and judges the result against the command's declaration. A command
   the aggregate does not list dies with `UnhandledCommand`. An event or rejection the command does not declare dies
   with `UndeclaredDecision`. A rejection ends the command: nothing is stored and the caller fails with it.
3. **Evolved.** Each event gets an envelope (`seq` = version + its index + 1, `at`, `commandId`, `correlationId`),
   is applied with `evolve`, and is fanned out to a delivery for every view, policy and projection that consumes it.
   An event the aggregate does not declare dies with `UndeclaredEvent`. The reply is computed from the new state.
4. **Committed at once.** The platform stores the events, the new state and version, the receipt and the deliveries
   in one atomic write (this is the `AggregateStore.send` contract every platform implements).
5. **Answered, once.** The caller gets a receipt: `stream` (for example `Item/org_prairie:BOLT-M8`), `version`,
   `events`, `reply`. The receipt is stored under the command id; the same command id sent again returns the stored
   receipt without deciding again. Then the deliveries are sent, at least once and in order per source. In the
   in-memory platform only accepted commands are stored as receipts, so a retried rejected command is decided again.

Checked in (all at `v2.0.0-beta.87`):

- `packages/domain/src/Model.ts:85-102` (`Members`), `:111-146` (`ModelClass`, `layer`), `:151-170` (`Any`,
  `Servable`), `:200-222` (`LayerOptions`), `:300-363` (`make`; commands deduplicated at `:334-336`), `:386-387`
  (`verify`), `:435-730` (`build`: lazy check `:483-488`, saga engine check `:582-590`, handlers built `:597-598`,
  validators `:600-624`), `:773-796` (`send`).
- `packages/domain/src/Telemetry.ts:12-19` (`Options.views`); `packages/domain/src/InMemory.ts:1369-1371`
  (`InMemory` provides `Platform | WorkflowEngine | SecureRandom`).
- Commit path: `packages/domain/src/Platform.ts:237-243` (the store contract), `packages/domain/src/Kernel.ts:1080-1180`
  (`handle`: decide, judge, reply), `:947-1015` (`commit`: envelope, evolve, deliveries),
  `packages/domain/src/InMemory.ts:646-694` (lock, duplicate receipt, store, enqueue),
  `packages/domain/src/Aggregate.ts:69-78` (`Receipt`).

### Types and helpers

| Name | What it is | Where |
| --- | --- | --- |
| `Members` | the second argument of `Domain.Model`: the lists of blocks (and on main `decisions`, `relations`, `invariants`, `eventually`) | `Model.ts:85-102`; main `:117-170` |
| `ModelClass` | the class type `Domain.Model` returns, with `layer` | `Model.ts:111-146`; main `:211-254` |
| `Any` | what every model class satisfies (`kind`, `annotations`, `modelName`, `definitions`, plus `Servable`) | `Model.ts:151-156`; main `:259-264` |
| `Servable` | what an Api over a model may serve: `aggregates`, `commands`, `views`, `streams`, `queries` (main adds `decisions`) | `Model.ts:163-170`; main `:271-279` |
| `ServableBy` | the exact `Servable` type of one model, computed from its lists; `commands` is the union of its aggregates' commands (main: and its decisions' commands) | `Model.ts:173-184`; main `:327-342` |
| `LayerOptions` | the options of `layer` (table above); exported at the root as `Domain.Model.LayerOptions` | `Model.ts:200-222`; main `:360-382` |
| `make`, `verify` | `Domain.Model` and `Domain.verify` | `Model.ts:300-363`, `:386-387`; main `:473-550`, `:573-574` |
| `Internals` | internal: the built model's kernel and stores, read by the story runner and the surfaces | `Model.ts:62-80`; main `:72-112` |
| `Instances`, `Keys`, `Fed` | main only: what a model invariant or `eventually` rule is given | main `Model.ts:177-202` |
| `ImplementedOnce` | main only: the type of `decisions`, which turns a second implementation of a command into a type error | main `Model.ts:304-318` |
| `DefinitionError` | the error `verify` returns and the Layer build dies with; `reason` holds one tagged reason, `message` is the reason's | `DefinitionError.ts:419-425`; main `:463-469` |
| `Reason` | the union of every reason class (the table in "Domain.verify") | `DefinitionError.ts:376-412`; main `:416-456` |
| `internal.ts` exports | internal: `inputSchema`, `rejectionTag`, `settle`, `Settled`, `judge` (raises `UndeclaredDecision`), `Judged`, `targetId`, `LocalViewInput`, `evolveView`, and a re-export of `DefinitionError`; main adds `internalError`, `redactCause` and `sendPayload` | `internal.ts:8-207`; main `:9-271`. Not importable from the published package (`"./internal": null`). |
| `globals.d.ts` | a type-only file that pulls in `alchemy/Phase` to declare `globalThis.__ALCHEMY_RUNTIME__`; not a module to import | `globals.d.ts:1-2`, same on main |

### What main changes

All paths are `packages/domain/src/` on `main@dbfd0ddb`.

- **`decisions`** (new member, `Model.ts:133`; commit `dbda8cc16`, #3420): a list of `Domain.Decision`s, each
  implementing one command across several aggregates. Its type, `ImplementedOnce` (`Model.ts:304-318`), turns an entry
  into a type error message when an aggregate or another decision already implements its command, or when it reads an
  aggregate the model does not list. The class gains a static `decisions`, and `commands` now includes each decision's
  command (`Model.ts:518-523`). Each decision is also provided as a service (`ProvidedBy`, `Model.ts:344-357`).
- **`relations`** (`Model.ts:158`): `{ readonly [name: string]: Relation.Any }`, each made with `Domain.Relation`,
  which `Verify.model` tries to prove (upstream's bank declares two, `AClaimedNameBelongsToItsCustomer` and
  `ARegisteredCustomerHoldsTheirName`). See [relation](./relation.md) and [verify](./verify.md). Commit not known.
- **`invariants`** and **`eventually`** (`Model.ts:149-151`, `:167-169`): each
  `{ readonly [name: string]: (model: Instances<A> & Keys<V> & Fed<J>) => boolean }`, over every instance, every view
  key and what each projection was given (`Model.ts:177-202`). The class keeps them as statics (`:233-236`,
  `:509-514`). `Explore.check` and `Verify.model` search for a sequence of commands that breaks them; they are checked,
  not proved. See the declaration above, [explore](./explore.md) and
  [invariants-and-transitions](./invariants-and-transitions.md). Commit not known.
- `Servable` gains `decisions` (`Model.ts:271-279`); `Kernel.Definitions` gains `decisions` (`Kernel.ts:79`).
- `build` hosts decisions after the aggregates and dies with `DecisionsUnsupported` when the platform has no decision
  host (`Model.ts:668-685`). `Internals` gains `caughtUp` (`Model.ts:97`; `caughtUp` waits for projections fed by a
  view, commit `ca7535707`, #3380) and `applied` (`:107-110`; a command can wait for its views, commit `bc0024faf`,
  #3469).
- Commands no longer take a `target`: `accounts.send(command)` replaces `accounts.send(id, command)` and the aggregate
  reads the id with `keyOf` (docs `model.mdx` "Call it from your code"). See [command](./command.md). Commit not known.
- `Model.layer`, `LayerOptions` and `verify` keep the same shape (`Model.ts:246-253`, `:360-382`, `:573-574`).
- The docs page adds a paragraph on `decisions`, "a command implemented twice" in the list `verify` finds, and a link
  to a page on verifying models; a command sent through an Api can wait for its views.

## Domain.verify

Removed at the pin `734c27a` (commit `60fea533`): there, building the model's Layer checks for every problem below
and dies with all of them at once, so a test that builds the Layer on `InMemory` takes its place (under "How it is
declared" and "How to check it").

`Domain.verify(Model)` returns every definition problem as a `ReadonlyArray<DefinitionError>`, in definition order,
each once; an empty array means the declaration is sound. It builds the kernel and collects problems instead of dying
on the first (`Kernel.ts:256-283` at beta.87). Each `DefinitionError` has a `reason`, a tagged error whose fields name
the blocks involved and whose message names the fix; the error's own `message` is the reason's
(`DefinitionError.ts:419-425`). Its doc comment says to match the reason with `Effect.catchReason`. The reason classes
are exported from `@alchemy.run/domain/DefinitionError`; the root exports only `DefinitionError` (re-exported through
`Kernel.ts:97`).

Not every tag below is found by `verify`. The column "Found by" says which: **verify** (and the Layer build dies on
the first of them), **layer** (only when a Layer is built: the model's `Model.layer` or the platform hosting it, or,
for `ReservedOperation`, the external system's own Layer), **run** (when a handler returns something its declaration
does not allow, or a message arrives), or **surface** (when the Layer or command of an Api, a toolkit, a CLI or an
HttpApi is built or run). The docs say `verify` finds "all of them"; the source shows the layer-only ones are not in
its list.

| Tag | Found by | Raised in (beta.87) | The mistake that causes it |
| --- | --- | --- | --- |
| `DefinitionError` | (the wrapper) | `DefinitionError.ts:419` | Not a mistake of its own: every reason below reaches you inside one, as its `reason`. |
| `DuplicateEventTag` | verify | `Kernel.ts:299` | Two different event classes use the same tag, for example two `ItemCreated` classes in two files. |
| `DuplicateName` | verify | `Kernel.ts:379`, `:408`, `:693` | Two aggregates, views or streams share a name, or a query's name equals another call's name (a command, view, stream). |
| `DuplicateDefinition` | verify | `Kernel.ts:332`, `:615`, `:635`, `:689` | The same aggregate, policy, projection or query is listed twice. |
| `InvalidInitial` | verify | `Kernel.ts:357` | An aggregate's `initial` cannot be encoded by its `state` schema. |
| `MissingInitial` | verify | `Kernel.ts:547` | A view declares `state` but no `initial`. |
| `UnknownSource` | verify | `Kernel.ts:397` | A view, policy or projection reads from a block the model does not list. |
| `ConsumesItself` | verify | `Kernel.ts:438` | A view reads its own output through other views. |
| `MissingKeyOf` | verify | `Kernel.ts:534` | A consumer keyed differently from its source has no `keyOf` for one of the events it reads. |
| `UnmatchedRoute` | verify | `Kernel.ts:557` | A routed `evolve` or `emit` handler names a route that `keyOf` never produces. |
| `NoEmitter` | verify | `Kernel.ts:607` | A consumer subscribes to an event none of its sources records. |
| `UnknownStream` | verify | `Kernel.ts:646` | A projection `writes` a stream the model does not list. |
| `TwoWriters` | verify | `Kernel.ts:652` | Two projections write the same stream. |
| `WriterKeyMismatch` | verify | `Kernel.ts:662` | A projection writes a stream keyed differently from the projection. |
| `PagedWithoutSuccess` | verify | `Kernel.ts:695` | A query is `paged` but declares no `success` schema. |
| `UnknownWait` | verify | `Kernel.ts:703` | A query `waitsFor` a projection, view or stream the model does not list. |
| `ImplementedTwice` (main) | verify | main `Kernel.ts:414`, `:425` | Two aggregates, or an aggregate and a decision, implement one command, or one decision is listed twice. At beta.87 nothing checks this: the later aggregate silently takes the command (`Model.ts:539`). |
| `UnknownRead` (main) | verify | main `Kernel.ts:437` | A decision reads an aggregate the model does not list. |
| `LazyViewNeedsOneSource` | layer | `Model.ts:486` | A view in `lazy` does not read exactly one aggregate keyed by it. |
| `MissingWorkflowEngine` | layer | `Model.ts:587` | The model has sagas but the platform provides no `WorkflowEngine`. |
| `UnvalidatedRead` | layer | `Model.ts:611` | A view or stream declares middleware or rejections, and `handlers` does not include its `toLayer(validate)`. |
| `ModelHostedTwice` | layer | `Platform.ts:707` | Two different models with the same name are hosted on one platform. |
| `DecisionsUnsupported` (main) | layer | main `Model.ts:677`, `DurableObjects.ts:2394` | The model lists decisions and the platform cannot commit them. |
| `UnhandledCommand` | run | `Kernel.ts:1096`, `:1114`, `:1605`; `Aggregate.ts:495` | An aggregate receives a command it does not list, or has no `decide` branch for it. |
| `UndeclaredDecision` | run | `internal.ts:92`, `:108` | `decide` returns an event or rejection its command does not declare. |
| `UndeclaredEvent` | run | `Kernel.ts:975` | An aggregate commits an event it does not declare. |
| `UndeclaredEmit` | run | `Kernel.ts:1374` | A view's `emit` returns an event not in its `events`. |
| `UnknownEvent` | run | `Kernel.ts:310` | A stored event's tag matches no event in the model (an event class was removed or renamed). |
| `NewerGeneration` | run | `Kernel.ts:1333` | A consumer receives a delivery for a newer view version than the code it runs: an old instance during a deploy. |
| `ForeignAppend` | run | `Model.ts:1096` | Something other than the stream's one writer, handling its own input, appends to a stream. |
| `UnknownRequestContext` | run | `RequestContext.ts:112` | A command carries a request-context value nothing registered. |
| `UnreadRecord` (main) | run | main `Kernel.ts:1447` | A decision returns an event not recorded through a read instance's `record`. |
| `UnroutedCommand` | surface | `Api.ts:585` | An Api serves a command no aggregate in the model handles. |
| `NotInModel` | surface | `Api.ts:609`, `:1247` | An Api names a block its model does not hold. |
| `ReservedOperation` | layer | `ExternalSystem.ts:355` | An external system's `toLayer` is given an operation named like a static of its class (`name`, `key`, `annotations`, ...); its Layer dies when built. |
| `ToolNameTooLong` | surface | `Ai.ts:260` | An Api call makes an AI tool name longer than providers accept. |
| `DuplicateTool` | surface | `Ai.ts:266` | Two calls of an Api make the same tool name. |
| `ReservedFlag` | surface | `Cli.ts:189` | A payload field would be a CLI flag the CLI reserves. |
| `DuplicateFlag` | surface | `Cli.ts:190` | Two payload fields would be the same CLI flag. |
| `DuplicateCommand` | surface | `Cli.ts:511` | Two calls of an Api would be the same CLI command. |
| `MissingGroup` | surface | `Http.ts:437` | An Api's HttpApi group is served from an HttpApi that does not hold it. |

That is every `Data.TaggedError` class in `DefinitionError.ts`: 37 at beta.87 (36 reasons and `DefinitionError`)
and 41 on main, which adds `ImplementedTwice`, `UnknownRead`, `UnreadRecord` and `DecisionsUnsupported` (main
`DefinitionError.ts:165-204`). On main the raising lines move (for example `DuplicateEventTag` at `Kernel.ts:328`,
`UnknownEvent` at `:339`, `LazyViewNeedsOneSource` at `Model.ts:694`, `UnvalidatedRead` at `:843`, `ModelHostedTwice`
at `Platform.ts:848`); which column each tag is in does not change. Where "Found by" says layer, run or surface, the
error reaches you as a defect (`Effect.die`), not as a typed failure.

## The package's public surface

### Root exports (`@alchemy.run/domain`)

Every export of `packages/domain/src/index.ts`, with the page that covers it. "both" means beta.87 and main.

| Export | Kind | Where | Page |
| --- | --- | --- | --- |
| `Event` | const + type namespace (`Any`, `Instance`) | both | [event](./event.md) |
| `Command` | const + type namespace (`Any`, `Instance`, `ContextOf`) | both | [command](./command.md) |
| `DefaultConsistency` | const (a `Context.Reference`, default `"eventual"`) | main only (`index.ts:64`, `Command.ts:66-69`) | [reads-and-consistency](./reads-and-consistency.md) |
| `Rejection` | const + type namespace (`Any`, `Instance`) | both | [rejection](./rejection.md) |
| `Aggregate` | const + type namespace (`Any`, `IdOf`, `StateOf`, `EventOf`, `CommandOf`, `Ref`, `Receipt`, `ScheduleReceipt`, `Envelope`, `SendOptions`, `ScheduleOptions`, `InstanceOf`, `PredictOptions`, `Prediction`) | both (main drops the `Id` parameter of `PredictOptions`) | [aggregate](./aggregate.md) |
| `AlreadyExecuted`, `AlreadyCancelled`, `NotScheduled` | const + type (errors of `unschedule`) | both | [deadlines](./deadlines.md) |
| `Decision` | const + type namespace (`Any`, `Read`, `Recorded`, `Receipt`, `Commit`) | main only (`index.ts:117-130`) | [decision](./decision.md) |
| `Key` | type namespace only (`Any`, `Schema`, `RefOf`, `IdOf`) | both | [view](./view.md) |
| `View` | const + type namespace (`Any`, `StateOf`, `EventOf`, `KeyOf`, `Entry`, `Page`, `LocalInput`, `History`) | both | [view](./view.md) |
| `WaitTimeout`, `ConsistencyTimeout` | const + type (errors of reads that wait) | both | [reads-and-consistency](./reads-and-consistency.md) |
| `Policy` | const + type namespace (`Any`, `Trigger`) | both | [policy](./policy.md) |
| `Saga` | const + type namespace (`Any`, `Status`, `Client`) | both | [saga](./saga.md) |
| `Projection` | const + type namespace (`Any`, `Input`, `Options`) | both | [projection](./projection.md) |
| `Query` | const + type namespace (`Any`, `InputOf`, `ResultOf`, `Page`, `PageRequest`, `LayerOptions`) | both | [query](./query.md) |
| `Relation` | const + type namespace (`Any`, `Instance`) | main only (`index.ts:213-220`) | [relation](./relation.md) |
| `Stream` | const + type namespace (`Any`, `EventOf`, `KeyOf`, `Entry`) | both | [stream](./stream.md) |
| `ExternalSystem` | const + type namespace (`Any`, `Op`) | both | [external-system](./external-system.md) |
| `Api` | const + type namespace (`Servable`, `Options`, `CommandName`, `ViewName`, `StreamName`, `QueryName`, `Client`, `ClientKey`, `CommandClient`, `CommandOptions`, `ViewClient`, `StreamClient`, `QueryClient`, `PagedQueryClient`, `QueryOptions`, `QueryError`, `ReadError`, `Any`, `CommandsOf`, `RejectionsOf`, `ClientOf`) | both | [api](./api.md) |
| `protocolHttp`, `protocolWebSocket`, `protocolInProcess` | const | both | [api](./api.md) |
| `Model` | const + type namespace (`Any`, `LayerOptions`) | both | this page |
| `verify` | const | both | this page |
| `Annotations` | type (an augmentable interface) | both | [annotations](./annotations.md) |
| `DefinitionError` | class (re-exported from `Kernel.ts`) | both | this page |
| `RequestContext` | const only (no type namespace) | both | [sessions](./sessions.md) |
| `Filter`, `OrderBy` | type | both | [view](./view.md) |
| `InMemory` | Layer | both | [host-in-memory](./host-in-memory.md) |
| `Middleware` | type-only namespace (`export type * as`) | both | [sessions](./sessions.md) |
| `Platform` | class (service key) | both | [platform-contract](./platform-contract.md) |
| `Read` | namespace (values and types) | both | [view-security](./view-security.md) |
| `Telemetry` | namespace (values and types) | both | [observability](./observability.md) |

That is every export of the file at both refs and nothing else: main adds exactly `DefaultConsistency`, `Decision`
and `Relation`, and changes `Aggregate.PredictOptions` from `<Id, R>` to `<R>`. Checked in:
`packages/domain/src/index.ts:37-299` at beta.87 and `:39-327` on main.

### Subpath exports (`packages/domain/package.json`)

| Subpath | Resolves to (published) | Holds | Page |
| --- | --- | --- | --- |
| `.` | `lib/index.js` | the root exports above | this page |
| `./Cloudflare` | `lib/Cloudflare/index.js` | `layerDurableObjects`, `DurableObjectsOptions`, `Backfill`, `BackfillFailed`, `BackfillStillRunning`, `providers`, `Providers`, `ProviderRequirements` | [host-cloudflare](./host-cloudflare.md), [backfill](./backfill.md) |
| `./EffectCluster` | `lib/EffectCluster/index.js` | `layerEntities`, `EntitiesOptions`, `DomainClassNotHosted`, `DomainEngineNotStarted` | [host-effect-cluster](./host-effect-cluster.md) |
| `./Rivet` | `lib/Rivet/index.js` | `layerDurableObjects`, `DurableObjectsOptions`, `DomainShape`, `DomainClassNotHosted` | [host-rivet](./host-rivet.md) |
| `./internal` | nothing (`null`) | blocked for consumers | none |
| `./*` | `lib/<Name>.js` with `lib/<Name>.d.ts` | one module per top-level source file | see below |
| `./package.json` | the manifest | | none |

Under bun the `bun` condition points every entry at `src/` instead of `lib/`. Inside the Alchemy repository the
plain `exports` field maps the same subpaths straight to `src/` and does not block `./internal`.

What `./*` reaches at beta.87 (each `src/<Name>.ts`): `/Story` ([story](./story.md)), `/Http`
([http-api](./http-api.md)), `/Ai` ([ai-and-mcp](./ai-and-mcp.md)), `/Cli` ([cli](./cli.md)), `/Foldkit`
([foldkit](./foldkit.md)), `/Platform` and `/DurableObjects` and `/Kernel`
([platform-contract](./platform-contract.md)), `/InMemory` and `/InMemoryWorkflows`
([host-in-memory](./host-in-memory.md)), `/Backfill` and `/CatchUp` ([backfill](./backfill.md)), `/DefinitionError`
(this page), `/Annotations` ([annotations](./annotations.md)), `/Telemetry` ([observability](./observability.md)),
`/Read` ([view-security](./view-security.md)), `/ReadRpcs` ([api](./api.md)), `/Watch`
([reads-and-consistency](./reads-and-consistency.md)), `/Middleware` and `/RequestContext`
([sessions](./sessions.md)), `/Filter` and `/Key` ([view](./view.md)), and one per building block (`/Aggregate`,
`/Command`, `/Event`, `/Rejection`, `/View`, `/Policy`, `/Projection`, `/Query`, `/Saga`, `/Stream`,
`/ExternalSystem`, `/Api`, `/Model`), each covered by that block's page. `/index` reaches the root again.
`globals.d.ts` is a type declaration (it pulls in `alchemy/Phase` for `globalThis.__ALCHEMY_RUNTIME__`), not a module
to import.

Main adds, through `./*`: `/Decision` and `/TwoPhase` ([decision](./decision.md)), `/Relation`
([relation](./relation.md)), `/Verify` ([verify](./verify.md)), `/Prove` ([prove](./prove.md)), `/Explore`
([explore](./explore.md)). It blocks `./Explore/internal/*` and `./Prove/internal/*` (`package.json:59-60`) and adds
two runtime dependencies, `oxc-parser` and `z3-solver`, used by `Explore.ts`, `Prove.ts`, `Verify.ts` and
`Prove/internal/{Source,Smt}.ts`.

Peers (both refs): `effect` and `alchemy` required; `@alchemy.run/cloudflare`, `@alchemy.run/effect-cluster`,
`@alchemy.run/rivet`, `@distilled.cloud/cloudflare`, `@effect/sql-pg` and `foldkit` optional. Beta.87 has no
`dependencies` field. Checked in: `packages/domain/package.json:29-115` at beta.87; main `:29-122`. In the
repository the peers read `workspace:*` and `catalog:`; as published, a trial on 2026-11-19 installed
`@alchemy.run/domain@2.0.0-beta.87` beside `effect@4.1.4` and saw `effect ^4.1.4` and `alchemy 2.0.0-beta.87` as the
required peers (the installer added `alchemy`), the rest optional, no peer warning, 18 packages. Main's version field
is still `2.0.0-beta.87`: main is not on npm.

## Rules, and the mistakes to avoid

- One model per bounded context, each with its own name. Two models may list the same aggregate class and still get
  separate instances and events; two different models with the same name on one platform die with
  `ModelHostedTwice`.
- Keep the declaration's check in a unit test: `Domain.verify(Model)` at beta.87 and `dbfd0dd`, building the model's
  Layer on `InMemory` at the pin. It is cheap and finds 15 kinds of mistake (17 on main) before any host runs. It does
  not find the run-time ones in the table above.
- At beta.87 a command listed by two aggregates is not refused: the later one takes it. Give each command exactly one
  aggregate.
- Provide `handlers` once, as one Layer built with `Layer.mergeAll`. A view with middleware or rejections needs its
  `toLayer(validate)` in that Layer, or the Layer build dies with `UnvalidatedRead`.
- Only put a view in `lazy` when it reads one aggregate and is keyed by it.
- A definition mistake found at Layer build or at run time is a defect, not a typed error. Do not try to recover from
  it; fix the declaration.
- The commit path guarantees at-least-once delivery after the commit, so views lag the aggregate. Pass the receipt as
  `atLeast` when a screen reads its own write.
- On main, a model-level invariant is searched, not proved: a rule that must hold for one aggregate for every input
  belongs in that aggregate's own invariants, which `Verify.aggregate` proves (see
  [invariants-and-transitions](./invariants-and-transitions.md)). Keep the model-level ones for rules across instances.
- Do not name the model file `Model.ts` in this app: that name is taken by the language model
  (`apps/inventory/src/server/Model.ts`). See [project-layout](./project-layout.md).

## In this app

The catalog as a model, at beta.87. The `Import` aggregate holds one import's status (`open`, `imported`,
`takenBack`) and decides `ConfirmImport` and `TakeBackImport`; the `Item` aggregate holds one item, keyed by the
organization and its SKU key, and decides `EditItem` against the revision the person saw. `ImportResult` is a view
keyed by the import that counts created, updated, already there and not imported.

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Layer from "effect/Layer"
import { Import } from "./Import/Import.aggregate.ts"
import { ImportResult } from "./Import/ImportResult.view.ts"
import { Item } from "./Item/Item.aggregate.ts"

export class Catalog extends Domain.Model(
  "Catalog",
  { aggregates: [Import, Item], views: [ImportResult] },
  { description: "An organization's items, and the files brought in through a review to make them." }
) {}

// No policies or projections yet, so the handlers Layer is empty.
export const CatalogInMemory = Catalog.layer(Layer.empty, { lazy: ["ImportResult"] }).pipe(
  Layer.provide(Domain.InMemory)
)
```

```typescript
// SKETCH: not compiled. At the pin `734c27a`, where `Domain.verify` is removed: building the Layer checks the
// declaration and dies with every problem it finds. At beta.87 and `dbfd0dd`:
// expect(Domain.verify(Catalog)).toEqual([])
import { InMemory } from "@alchemy.run/domain/InMemory"
import { it } from "@effect/vitest"
import * as Layer from "effect/Layer"
import { Catalog } from "../src/Catalog.model.ts"
import { CatalogHandlers } from "../src/Catalog.handlers.ts"

it.effect("the catalog model is well defined", () =>
  Layer.build(Catalog.layer(CatalogHandlers).pipe(Layer.provide(InMemory)))
)
```

Access would be a second model (`Access`: people and roles, activity, the allowance). The catalog would not send to
access's aggregates; it would call access's Api, as it calls the `ModelAllowance` port today.

A trial on 2026-11-19 ran the nearest thing to this on beta.87: one `Import` aggregate (`StageImport`,
`ConfirmImport`) in a model hosted with `layer(Layer.empty).pipe(Layer.provide(Domain.InMemory))`, under Bun and
Node; `Domain.verify` answered `[]`. The blocks above were not compiled. On main the same trial declared one model of
this app (`ImportDraft`, `Item`, `Allowance`, `Organization`) with a model invariant named
`EveryConfirmedFileAddsUp` over every `ImportDraft` instance, the shape of the main sketch under "How it is declared".

- **Used today:** no. The app's nearest equivalents are the per-context handler registries
  `packages/catalog/model/src/Catalog.handlers.ts` and `packages/access/model/src/Access.handlers.ts`, the ports in
  `Catalog.ports.ts` and `Access.ports.ts`, and the composition in `apps/inventory/src/server/App.ts`.
- **Where it goes:** `packages/catalog/model/src/Catalog.model.ts` and `packages/access/model/src/Access.model.ts`,
  with a test of its declaration (its Layer built, at the pin) beside the existing
  `packages/catalog/model/test/Ports.test.ts`; hosted from
  `packages/catalog/host/src/Host.ts` (see [project-layout](./project-layout.md)).
- **What the person gets:** nothing they can see directly; the confirm, the take-back and the item edit would each
  commit in one decided step with a stored receipt, so a second press returns the first answer (rule 10).

## How to check it

- `expect(Domain.verify(Catalog)).toEqual([])` in the model package's tests catches every "verify" row above at
  beta.87 and `dbfd0dd`; at the pin `734c27a`, a test that builds the Layer, below, catches them.
- Building `Catalog.layer(...)` on `Domain.InMemory` in one test catches the "layer" rows (`UnvalidatedRead`,
  `LazyViewNeedsOneSource`, `MissingWorkflowEngine`).
- Stories ([story](./story.md)) catch the "run" rows: a `decide` that returns an undeclared event fails the story.
- To check the model's rules rather than its declaration: on main only, [verify](./verify.md),
  [prove](./prove.md) and [explore](./explore.md). In the trial on main, `Verify.model(Inventory, { apis, story })`
  answered in about 36 seconds: the 19 aggregate rules proved, and the model invariant "checked" in every sequence of
  up to 2 commands (5,173 sequences, 2,433 states) with 200 longer sequences sampled. That is the strength a model
  invariant gets: checked over sequences, not proved.

## What it needs

Any host: `Domain.InMemory` for tests, or [Cloudflare](./host-cloudflare.md), [Rivet](./host-rivet.md),
[Effect Cluster](./host-effect-cluster.md) in production. Published on beta.87. `decisions`, `relations`,
`invariants` and `eventually` need main; `decisions` also need a platform that hosts decisions. The published package
needs `effect ^4.1.4` and `alchemy 2.0.0-beta.87` as peers. In the beta.87 trial, one aggregate's declarations added
about 133 kB (43 kB gzip) to a minified browser bundle, and about 205 kB (67 kB gzip) with the in-memory host.

## Verdict

**Use:** declare `Catalog` and `Access` as two models on beta.87, test each with a test that builds its Layer
on `Domain.InMemory` (`Domain.verify` at beta.87, removed at the pin) and stories on `Domain.InMemory`, and keep the
handlers in one merged Layer per model. The model-level `decisions`, `relations`,
`invariants` and `eventually` exist only on `main@dbfd0ddb`; taking them is the same decision as taking main for the
rest of the library.

## Where this was read

- https://alchemy.run/domain, https://alchemy.run/domain/what-is-ddd, https://alchemy.run/domain/model (the live
  site documents beta.87)
- `website/src/content/docs/domain/index.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `website/src/content/docs/domain/what-is-ddd.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `website/src/content/docs/domain/model.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Model.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/DefinitionError.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (4 reasons added)
- `packages/domain/src/index.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/internal.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/globals.d.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Annotations.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (doc comment only)
- `examples/cloudflare-domain/packages/domain/src/Bank.model.ts` on `main@dbfd0ddb`; `packages/domain/src/Verify.ts`
  on `main@dbfd0ddb` (the part cited)
- `packages/domain/package.json` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/README.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Kernel.ts`, `Platform.ts`, `InMemory.ts`, `Aggregate.ts`, `Telemetry.ts` (the parts cited) at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
