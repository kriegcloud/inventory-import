---
type: Research
title: The library at e1c3e6d
description: Every block of @alchemy.run/domain as it is installed in this repository on 2026-11-26 (commit e1c3e6d, 2.0.0-beta.87), with its signature and options copied from the source, its limits and guarantees, the source lines, what moved since the concept pages, and every export with where it is covered.
---

# The library at e1c3e6d

Eight readings of the installed source, made on 2026-11-26 for the sweep of where a block replaces hand-written code.
The [concept pages](concepts/aggregate.md) and [the map](00-map.md) were written on earlier commits; this page is the
library as the repository now pins it (`vendor/alchemy/README.md`: `e1c3e6d`, pinned 2026-11-25). Every line is cited
as `node_modules/@alchemy.run/domain/src/<File>.ts:<line>`, shortened here to `<File>.ts:<line>`. The repository's two
patches (`docs/patches.md`) change the prover only; a signature here is the library's own.

A line marked "inferred" was read from the code's behaviour and not from a statement in it. Nothing here was run:
the trials are in [04](04-trial.md) and [07](07-review-decisions-trial.md).

## The package

Version 2.0.0-beta.87. Entry points: `.` (`index.ts`), `./AWS`, `./Cloudflare`, `./EffectCluster`, `./GCP`, `./Rivet`,
and `./*` for every file of `src` (`/Story`, `/Prove`, `/Verify`, `/Explore`, `/Http`, `/Cli`, `/Ai`, `/Foldkit`,
`/InMemory`, `/SqlKeyStore`, `/DefinitionError`). The internals are closed to imports (`./internal`, `./*/internal`,
and `internal/*` under `Explore`, `Prove` and `Verify` map to `null`): they are read here, never imported. It
depends on `oxc-parser` and `z3-solver`: the prover parses the source of a block and asks the solver, which runs under
Node and not under Bun.

## The write side

### Event and Rejection

`Domain.Event(tag, fields, annotations?)` (`Event.ts:74`) is a `Schema.TaggedClass`. `Domain.Rejection(tag, fields,
annotations?)` (`Rejection.ts:64`) is a `Schema.TaggedError` and takes `httpApiStatus` in its annotations. Any tagged
error class is valid in a command's `rejects`.

### Command

`Domain.Command(tag, { input?, middleware?, events?, rejects?, reply? }, annotations?)` (`Command.ts:275`). Served, its
payload is `{ commandId?, input, consistency? }`, its success `{ reply, stream, version, commits }` and its error the
union of its `rejects` and `ConsistencyTimeout`.

- `Domain.DefaultConsistency` is a `Context.Reference` whose default is `"eventual"` (`Command.ts:66`). `"strong"`
  waits for the views; after 10 s it fails `ConsistencyTimeout`, and the command is still committed.
- Middleware does not run when a policy, a saga or a story sends the command in process.

### Aggregate

`Domain.Aggregate(name, definition, annotations?)` (`Aggregate.ts:935`). The definition: `id` (a string schema),
`state`, `initial`, `invariants?` (`{ Name: (state) => boolean }`), `transitions?` (`{ Name: ({ before, after,
command, events }) => boolean | Effect<boolean> }`), `commands?`, `keyOf?` (required with commands), `events?` (events
it folds that a Decision records), `decide?` (`{ Tag: (state, command, ctx) => events[] | rejection | Effect }`, with
`ctx` = `{ id, commandId, stream, version, now }`), `evolve` (`{ Tag: (state, event, envelope) => state }`, total) and
`reply?`. An envelope is `{ id, stream, seq, at, commandId, correlationId }`.

The client:

| Call | Gives | Fails with |
| --- | --- | --- |
| `send(command, { commandId? })` | A receipt `{ stream, version, events, reply, commits }` | The command's rejections |
| `schedule(command, { commandId?, at \| after })` | `{ commandId, at }`; only for a command with no rejections | |
| `unschedule(target, commandId)` | | `AlreadyExecuted`, `AlreadyCancelled`, `NotScheduled` |
| `import(target, events, { commandId, expectedVersion? })` | Events recorded with no `decide` | `UnexpectedVersion`, `ImportOutOfOrder` |
| `get(target)` | The state | |
| `rewrite(target, rewrite, { rewriteId? })`, `rewritten(receipt, { timeout? })` | A rewrite's receipt | `InvariantBroken` |
| `compact(target, compaction)` | A compaction's receipt | `CompactionLossy` |

Statics: `ref(id)`, which throws on an id its schema refuses, and `predict(state, command, { now, version?,
commandId?, correlationId?, context? })` (`Aggregate.ts:658`), which answers `Accepted { events, envelopes, state }`,
`Rejected { rejection }` or `Unpredictable { cause }`.

Guarantees and limits:

- One command at a time for each instance. A `decide` that returns an event or a rejection its command does not
  declare dies with `UndeclaredDecision`; an event the aggregate does not declare with `UndeclaredEvent`; a command the
  aggregate does not list with `UnhandledCommand` (`DefinitionError.ts:167-175`, `:226-247`). All three are raised when
  the command runs, not when the Layer is built.
- A rejection records nothing and stores no receipt: the same `commandId` sent again is decided again.
- A command id is the caller's, else the saga step's, else for a policy `${source}:${seq}:${policy}[:route]:n`, else a
  uuid.
- The stream is `<Name>/<id>`, global to the model: the organization goes in the id or the state.
- In an effectful `decide` the clock is pinned to `ctx.now` (`internal.ts:145-161`).
- Policies and sagas never react to imported events.

### Decision

`Domain.Decision(command, { reads: { name: Aggregate }, keyOf: (cmd) => ({ name: id | id[] }), decide: (reads, cmd, {
commandId, now }) => [read.record(event), ...] | [] | rejection | Effect, transitions?, reply? }, annotations?)`
(`Decision.ts:393`). A read is `{ id, stream, state, version, record }`; the receipt `{ commits, events, reply }`; the
client has `send` only: no `schedule`, `predict` or `get`.

- Definition errors: `UnreadRecord`, `ImplementedTwice`, `UnknownRead`, `DecisionsUnsupported`. `UnreadRecord` is
  raised when the decision runs, not when the Layer is built (`Kernel.ts:1866-1878`).
- In memory it locks each aggregate type it reads, in name order, not each instance.
- On Durable Objects it is a two-phase commit driven by the first instance read, with no time limit on a hold
  (`TwoPhase.ts:21`). A command sent to an instance a decision holds waits about 13 s (60 tries) and then dies
  (`DurableObjects.ts:1266-1270`, `:2157-2158`). A decision that meets a held or changed instance aborts and is tried
  again for about 20 s (90 tries, 10 to 250 ms), then dies (`TwoPhase.ts:255-261`, `:362-368`). The strategy is the
  reference `DecisionCommit`, default `twoPhase`.

### Relation, and the model's own rules

`Domain.Relation({ over: { name: Aggregate }, holds: (on) => boolean })` (`Relation.ts:77`), with no annotations,
listed in a model's `relations`. `Verify.model` proves it where one decision writes both sides. Nothing checks it at
run time. A model's `invariants` are searched, `eventually` checked on the search's histories, and `sometimes` says
only that one sequence reaches it.

### Model

`Domain.Model(name, members, annotations?)` (`Model.ts:576`). Members: `aggregates` (required), `decisions?`,
`views?`, `policies?`, `projections?`, `streams?`, `sagas?`, `queries?`, `rewrites?`, `compactions?`, `invariants?`,
`relations?`, `eventually?`, `sometimes?`. `Model.layer(handlers, { telemetry?, legacyData?, lazy? })` gives a Layer
that needs `Platform | SecureRandom`. A command, aggregate or view named after a static of the model's class (`layer`,
`commands`, `views`, `name`, ...) makes `Domain.Model(...)` throw a `DefinitionError` (`ReservedMember`) where the
class is declared (`Model.ts:661-692`): each of them becomes a static of the model, its Mention. Sealed fields are
sealed as a command arrives (`Model.ts:754-757`).

### DefinitionError, Key, Annotations, Filter

`Domain.DefinitionError` is what building a model's Layer dies with, every problem at once; the reasons (about 47) are
in `/DefinitionError`: among them `DuplicateEventTag`, `DuplicateName`, `InvalidInitial`, `NoJsonForm`,
`InitialNotJson`, `UnhandledCommand`, `UnroutedCommand`, `UnknownEvent`, `ModelHostedTwice`, `MissingInitial`,
`NoEmitter`, `UndeclaredEmit`, `TwoWriters`, `WriterKeyMismatch`, `UnknownStream`, `UnvalidatedRead`,
`LazyViewNeedsOneSource`, `PagedWithoutSuccess`, `UnknownWait`, `UnlistedRewrite`, `InvalidRewrite`,
`MissingRewriteHandler`, `UnknownAggregate`, `MissingKeyOf`. `Domain.Key` is types only: an aggregate or a string
schema keys a view, policy, projection or stream. `Annotations` is `{ description?, httpApiCacheControl? }`, the cache
header defaulting to `private, no-store`. `Filter<T>` (`Filter.ts:74`) is the `where` of a view's or stream's reads
(`get`, `snapshot`, `watch`, `events`, `list`, and `waitFor` on the server). `OrderBy<T>` (`Filter.ts:85`) is exported
as a type, but no call takes one: a `list` is ordered with `order: "asc" | "desc"`.

## The read side

### View

`Domain.View(name, { from, key, keyOf?, state?, initial?, evolve?, events?, emit?, computed?, version?, middleware?,
rejects? }, annotations?)` (`View.ts:517`). An `evolve` case that returns `null` deletes the key. `toLayer(build)`
gives its `validate(request, state)`, with `request` = `{ mode, key }`; it is required when `middleware` or `rejects`
is declared (`UnvalidatedRead`).

- On the server (`yield* MyView`): `get(key, { atLeast?, timeout? })` (an Option), `snapshot`, `waitFor`, `watch`,
  `watchEach`, `events`, `list` (batches of 128), `history`. The client: `get`, `snapshot`, `watch`, `events`, `list`.
  The static `evolve` applies an event locally, for an optimistic screen.
- `ConsistencyTimeout { view, key, stream, version }` and `WaitTimeout`.
- `validate` is not applied to a read made on the server (inferred). A filter never grants access.
- A live read closes with 1000, 4000 (judge me again) or 1011 (`Watch.ts`); a verdict lasts at least 1 s.

### Query

`Domain.Query(name, { input, success, paged?, waitsFor?, middleware?, rejects? }, annotations?)` (`Query.ts:300`).
`toLayer(build, { take: { default: 50, max: 500 } })`, where `build` gives `(input, page) => Effect` and `page` is `{
after, take }`. The payload is `{ input, atLeast?, after?, take? }`; a paged success is `{ entries, cursor }`.

- The handler does its own access check. It runs in the Worker, not in an object.
- No live query. No total and no page number.

### Projection

`Domain.Projection(name, { from, key, keyOf?, on, writes? }, annotations?)` (`Projection.ts:315`). `toLayer(build, {
batch: { size, wait? }, version })`, where `build` gives a handler of a batch, or `{ write, rewrite? }`. One input is
`{ key, route, source, event, envelope, state, position }`.

- At least once, in order per key. A write must be idempotent, keyed by `stream:seq`.
- `caughtUp(receipt)` waits for it. It has no read API and never sends a command.
- On Durable Objects a failed batch is retried every 10 s.

### Stream

`Domain.Stream(name, { key, entries, middleware?, rejects? }, annotations?)` (`Stream.ts:223`). It has exactly one
writer, a projection keyed the same that lists it in `writes` (`TwoWriters`, `WriterKeyMismatch`); one projection may
write several streams. On the server: `peek`, `watch`, `events`, `list`,
`append(origin, ...events)`, `rewrite`. An entry is appended exactly once for each input position. Its `validate`
judges the latest entry.

### Read, and what a read is served as

`Domain.Read` (`Read.ts`): `Mode`, `Snapshot`, `CaughtUp`, `isCaughtUp`, `isEvent`, `Request`, `Contract`, `Validate`.
`ReadRpcs.ts` names the calls (`<View>.get`, `.watch`, `.events`, `.list`, `.snapshot`; `<Stream>.peek`, `.watch`,
`.events`, `.list`). `CatchUp.ts` builds a new view generation beside the live one; policies are never replayed.

## Reactions, processes and corrections

### Policy

`Domain.Policy(name, { from, key?, keyOf?, on }, annotations?)` (`Policy.ts:204`). `toLayer(build, { retry? })`, where
`build` gives `(trigger) => Effect<void, never, ...>` and a trigger is `{ key, route, source, event, envelope, state
}`.

- After commit, at least once, in order per key. Commands it sends get derived ids.
- Events from history, a rewrite or an import are skipped (`Kernel.ts:2430-2432`).
- It has no actor: the handler provides one.
- A call to an outside system is not deduplicated. On Durable Objects the mark that an event was seen ages out after
  7 days, a receipt after 30.
- A policy (or a view or projection) that listens for an event none of its `from` sources emits dies with `NoEmitter`
  when the model's Layer is built (`DefinitionError.ts:100-109`).

### ExternalSystem

`Domain.ExternalSystem(name, { op: { args?, success?, error? } }, annotations?)` (`ExternalSystem.ts:332`).
`toLayer(build, { validate?: boolean })`: every call is checked against the operation's schemas unless `validate:
false` (default true); an operation is `(args) => Effect<Success, Error, ...>`. A value that does not
match its schema is a defect, `ExternalSystemSchemaError`. Each call is a span `Domain.external <system>.<op>`. It is
not callable from a Decision.

### Saga

`Domain.Saga(name, { key, input?, result?, rejects? }, annotations?)` (`Saga.ts:270`). `toLayer(build)`, where `build`
gives `(payload) => Effect`, with `Activity.make`, `MySaga.withCompensation`, `DurableDeferred` and `DurableClock`.
The client: `start(key | { id }, input)` (the same key is the same run) and `get`. A run is `{ executionId, status,
result, signal, interrupt }`; a status is `NotStarted`, `Running`, `Completed`, `Rejected`, `Interrupted` or `Died`.

- It needs a workflow engine on the host (`MissingWorkflowEngine`). `InMemoryWorkflows.ts:62` is the one under
  stories, not durable.
- One command per step. A compensation must not reject. Runs are named `<model>/<saga>`.

### Deadlines

`client.schedule` and `client.unschedule` (above). A `decide` answers `[]` when the fact no longer applies. A
cancelled schedule is remembered 7 days. A Decision's command cannot be scheduled.

### Compaction

`Domain.Compaction(name, { of, rollup: (state, { id, version }) => events[] }, annotations?)` (`Compaction.ts:169`).
`toLayer(build, { after: { events: n } })`, where `build` gives a keeper of each batch `{ id, stream, events }` before
it is removed. Its receipt is `{ stream, version, compacted }`. A roll-up that does not fold back to the state fails
`CompactionLossy`.

### Rewrite

`Domain.Rewrite(name, { of, input?, events?: { Tag: (event, input, envelope) => event | null }, delete?: true },
annotations?)` (`Rewrite.ts:167`), itself a tagged class of its input. Its receipt is `{ stream, rewriteId, changed
}`. An event's `seq` never changes. A rewrite that breaks an invariant fails `InvariantBroken`. Policies, sagas and
outside systems are not reached; a projection needs a `rewrite` handler (`MissingRewriteHandler`). It is not an undo.

### Backfill

No declaration: a view's or a projection's `version` starts one (`Backfill.ts`, internal; on Cloudflare a resource of
the stack, `Cloudflare/Backfill.ts`). `backfillTimeout` defaults to 30 minutes; a deploy fails `BackfillStillRunning`
or `BackfillFailed`, and a changed plan asks for a new version. Off Cloudflare the first call starts it. Policies are
never backfilled.

## Surfaces

### Api

`Domain.Api(name, { model, commands?, views?, streams?, queries? }, annotations?)` (`Api.ts:1438`). A kind left out is
served whole; `[]` serves none; an aggregate is never served. It is Effect RPC over NDJSON; `yield* Api` gives `{ fetch
}`. It needs the model's internals and each middleware's Layer.

- Clients: `client`, `Client`, `layerClient`, and `clientHttp`, `clientWebSocket`, `clientInProcess` with their Layer
  forms. Protocols: `Domain.protocolHttp(url)`, `protocolWebSocket(url)` (8 reconnects, each after `min(5000, 100 *
  2^n)` ms, at once on 4000), `protocolInProcess(api)`.
- An error not declared reaches the client as "Internal server error".
- No upload and no multipart.

### HTTP, CLI, tools

- `toHttpApi(api, { expose? })` (`Http.ts:399`, `/Http`) gives `{ group, api, layer, layerFor }`: a command is a POST,
  a query a QUERY, a read a GET, a live read server-sent events. A rejection is 422 unless it has `httpApiStatus`.
  Nothing is exposed until named. A view's `list` takes no `where`.
- `toCli(api, { expose?, name?, description?, headers? })` (`Cli.ts:486`, `/Cli`); a refused call is `CallRejected`.
  No live reads.
- `toToolkit(api, { expose?, headers? })` (`Ai.ts:137`) and `toMcp` (`Ai.ts:224`), from `/Ai`. A rejection or a
  middleware's error is returned to the model as the tool's failure; any other error is a defect. Names are
  `<api>_<name>_<operation>` (`Mention.ts:44`), at most 64 characters (`Ai.ts:75`, else the Layer dies with a
  `DefinitionError`). A command, a query and a `get`, `peek`, `list` or `snapshot` can be tools; the live reads `watch`
  and `events` cannot. A command tool's parameters include an optional `commandId`, so nothing makes a repeated tool
  call idempotent here. Only a model's Mention, used by an `AI.Process` (`Mention.ts:296-303`), hides `commandId` and
  sends under `${conversationId}:${callId}`. Nothing filters or asks for approval per call.
- `/Foldkit`: `make(api)`, command ids and headers, and a failure told as `Rejected`, `Denied`, `Unknown` or
  `TimedOut`. Not used here ([DECISIONS](../DECISIONS.md), 2026-11-26).

### Middleware, RequestContext, Telemetry

A middleware is a plain `RpcMiddleware.Service`. `Domain.Middleware` is types only. The first one listed is the
outermost (`Middleware.ts:30-46`). `Domain.RequestContext<Self>()(key, schema)` (`RequestContext.ts:66`) must encode
to JSON; it is captured at send and restored in `decide` and in live reads. `Domain.setExpiry(at)`
(`RequestContext.ts:168`): the earliest wins, at least 1 s away, and a live read then closes with 4000.

`Domain.Telemetry`: spans `Domain.send`, `decide`, `view`, `policy`, `projection`, `saga`, `query`, `validate`,
`caughtUp`, `applied`, `external`, `read`, `import`, `schedule`, `unschedule`, `compaction` and `rewritten`, the
attribute `domain.correlation_id`, and metrics of commands, their duration, events, lag, runs, batch size, queries and
outside calls. A rejection is an outcome, not an error. `Model.layer(handlers, { telemetry: { views: false } })` turns
off the view span, the busiest; there is no other option (`Telemetry.ts:14-22`).

### Sessions and Better Auth

The library's session recipe is a `CurrentActor` request context, a session middleware with its client half, and
`setExpiry`. `@alchemy.run/better-auth` is a package of its own, not installed here: `BetterAuth(options)` as an
Effect that needs a database, drivers for D1 and others, and a deploy-time migration action, which does not fit this
repository's ordered `migrations/` folder as it stands.

## Hosts

- `Domain.Platform` (`Platform.ts:1604-1623`): `model(hosted)` gives the host of a model (`aggregate`, `decision?`,
  `view`, `policy`, `projection`, `stream`, `start?`, `history?`), and `keys`. Delivery is at least once, ordered for
  each pair of source and target, deduplicated by source and `seq` and by command id.
- `Domain.InMemory` (`InMemory.ts:2205`) and `InMemory.make({ manual?, now?, choose?, ran? })` (`InMemory.ts:174`,
  `/InMemory`), which gives `{ layer, control }` with `drain`, `idle`, `suspended`, `failures`, `deaths`, `commits`.
  It provides the platform, a workflow engine and `SecureRandom`. Nothing is kept. A handler's failure is logged, not
  rethrown.
- `DurableObjects.makePlatform(host, { retention? })` (`DurableObjects.ts:3578`), the kernel under the three object
  hosts. Receipts are kept 30 days, delivery marks 7, cancelled schedules 7; events, state and view entries are never
  deleted. Rows are written in chunks of 128.
- `layerDurableObjects({ jurisdiction?, locationHint?, backfillTimeout?, retention? })` from `/Cloudflare`
  (`Cloudflare/index.ts`): it needs an Effect-native `Cloudflare.Worker`, and `providers()` beside Cloudflare's in the
  stack. An object class is `Model.Name`: a model renamed starts empty. It re-exports `Backfill`, `BackfillFailed`,
  `BackfillStillRunning`, `D1KeyStore`, `SecretKeyWrap`.
- `layerEntities({ name, main, handler?, pool, retention? })` from `/EffectCluster` (`EffectCluster/index.ts:643`): a
  table `alchemy_domain_objects`, an advisory lock, an hourly sweep, and `sagaEngine`.
- `layerDurableObjects({ name, main, handler?, pool, retention? })` from `/Rivet` (`Rivet/index.ts:391`).

## Privacy

- `Domain.Sealed(valueSchema)` (`Vault.ts:78`): a codec of `{ subject, box }`. `.plain(subject, value)` is what a
  client sends. Stored, a box is `v1.<iv>.<ciphertext>`. A `decide` checks the `subject`.
- `Domain.Vault` (`Vault.ts:143-162`): `seal`, `open` (None once shredded) and `shred`. `Domain.VaultLive` needs a
  `KeyStore` and a `KeyWrap`; it is AES-256-GCM with the subject as additional data. `Domain.VaultTest`,
  `Domain.sealedInTest(schema, subject, value)` and `Story.shred(subject)` are for tests. `Domain.VaultError` is `{
  subject, reason }`; `VaultMissing` and `Unsealed` are defects, exported from `/Vault` only.
- Key stores (`get`, `create` where the first wins, `delete`): `Domain.MemoryKeyStore`, `Domain.HostKeyStore`,
  `SqlKeyStore({ table? })` (`/SqlKeyStore`, Postgres), `D1KeyStore(database, { table? })` (`/Cloudflare`),
  `DynamoKeyStore` (`/AWS`), `FirestoreKeyStore` (`/GCP`).
- Key wraps: `Domain.NoKeyWrap`, `Domain.RootKeyWrap(key)`, `SecretKeyWrap(secret)` (`/Cloudflare`), `KmsKeyWrap`
  (`/AWS`, `/GCP`).
- Shredding changes no event: views keep the box and `open` gives None. A plain copy, a reply already sent and a
  restored backup are not reached.

## Verification

- Limits: 4,096 paths through one `decide` (`Prove/internal/Induction.ts:96`), 256 compared paths, 10,000 turns of
  the interpreter; a list from the state or a command is tried up to 2 items past the least its schema asks for
  (`Prove/internal/Symbolic.ts:298-317`), and its rule is then Bounded, not Proved. Verdicts: Proved, Bounded,
  Violated, Unconfirmed, NotTranslated, Unknown, Misread.
- `Verify.model(model, options)` (`Verify.ts:812`), `Verify.report` (`Verify.ts:661`): `apis` (required), `source?`,
  `story?`, `depth?` (2), `budget?` (100,000), `instances?` (2), `faults?` (`redeliver`, `reorder`, `rerun`), `walks?`
  (`{ count: 200, length: 12, seed: 1 }`), `allow?` (`truncated`, `skipped`, `lossy`), `require?` (`{ proved }`),
  `histories?` (2,000), `lock?`, `opaque?`. `Verify.aggregate(aggregate, { source?, depth?, budget?, allow?, require?,
  lock?, opaque? })` (`Verify.ts:982`). A rule's standing is proved, checked, broken, unseen, reached or unreached.
  Middleware is not run; a projection's writes are not checked; queries and streams are left aside; views, policies
  and sagas are searched, not proved.
- `Prove.invariants(aggregate, { source, decisions?, suggest? })` (`Prove.ts:377`), `Prove.report` (`Prove.ts:228`),
  `Prove.decision` (`Prove.ts:668`), `Prove.decisionReport` (`Prove.ts:590`), `Prove.compaction`, `Prove.rewrite` and
  their reports. Not read: `Schema.Record`, a pattern, middleware. Read: `.make`, a tagged union's `guards`,
  `isAnyOf`, `match` and `matchOrElse` (the library's own; the repository's patch makes a guard exact and adds
  `Schema.is`), `HashMap`, `HashSet`.
- `Explore.check`, `report`, `undone`, `script`, `render`: the search alone.
- `Story.make(model, { layer?, stub? })` and the steps `given`, `when`, `then`, `anyOrder`, `inOrder`, `rejected`,
  `replied`, `state`, `view`, `emitted`, `streamed`, `query`, `call`, `succeed`, `fail`, `die`, `returned`, `failed`,
  `died`, `clock`, `advance`, `shred`, `rewrite`, `compact`, `start`, `signal`, `saga`, `provide`. A story fails on any
  event, rejection or call it did not assert. Its clock is manual and starts on 2026-01-01. It always uses
  `VaultTest`.
- The lock file is `{ version: 1, rules: { model: { rule: { kind, source } } } }`, rewritten with
  `UPDATE_VERIFY_LOCK=1`. Under CI a rule it does not list fails. An aggregate's invariant is compared by the solver
  (kept, weaker, unknown); every other rule as text.

`docs/verify.md` does not yet mention `faults`, `walks`, `instances`, `budget`, `depth`, `allow`, `histories`,
`opaque` or `suggest`, `Prove.compaction` and `Prove.rewrite`, `eventually`, `Explore.script`, or most of the story
steps above.

## Examples and conventions

The library's skill (`node_modules/@alchemy.run/domain/skills/alchemy-domain/`) and its examples name files
`<Noun>.<kind>.ts`: `.aggregate`, `.command`, `.decision`, `.view`, `.policy`, `.saga`, `.projection`, `.stream`,
`.query`, `.external`, `.api`, `.model`, `.middleware`, `.context`, `.rejection`, `<Aggregate>.id.ts`, and `.rewrite`
in the examples though not in the skill's list. A command's file holds the command, its events and the rejections
only it returns. This repository's `*.command.ts` in a contract package is a payload schema, another thing.

Its rules: `decide` is pure and `evolve` total; an event carries the outcome (`balanceAfter`); every rejection is
listed; a projection's store is served through a query; a client never reads an aggregate; reactions are idempotent;
a policy does not wait for a saga; dependencies are resolved once in `toLayer`; one handlers Layer, provided once. Its
port pattern is a `Context.Service` in the domain package with a memory twin and a D1 adapter keyed by `stream:seq`
(its twin uses a `Map`; here that is a `MutableHashMap`). Its audit is events that carry who acted; the examples have
no audit table.

## What moved since the concept pages

| Block | What moved |
| --- | --- |
| [Aggregate](concepts/aggregate.md) | The client gained `rewrite`, `rewritten` and `compact`. The clock is pinned to `ctx.now` in an effectful `decide` |
| [Command](concepts/command.md), middleware | Order is fixed: the first listed is the outermost (`Middleware.ts:30-46`). A list reversed to work around the old order is now wrong |
| [Decision](concepts/decision.md), [Relation](concepts/relation.md) | Both exported from the root |
| [Model](concepts/model.md) | Gained `rewrites`, `compactions`, `sometimes`, and the Layer options `lazy` and `legacyData` |
| [Prove](concepts/prove.md) | `.make` is read by the library itself (`Prove/internal/Interpreter.ts:992-1011`). The repository's patch adds `Schema.is` and makes a guard answer exactly or prove nothing; it does not touch `.make`. A block imported from another package is read: the interpreter resolves a package it has no model for through `node_modules` and its `exports` and reads the file like the model's own (`Prove/internal/Interpreter.ts:562-574`, `Source.ts:208-213`, `Resolve.ts:150`); `Source.ts:360-362` is only the eager pass over relative imports. Not re-run here: the trial's request context in another package should be tried again |
| [Verify](concepts/verify.md) | `Domain.verify` is gone (inferred): Verify is `/Verify` only |
| [View](concepts/view.md), [reads](concepts/reads-and-consistency.md) | The docs say a client remembers its own commands; the code does not: pass `atLeast: receipt` |
| [Query](concepts/query.md) | The library's own design note describes `validate`, `visible` and `attributes` on a query; none exists in the code |
| [Stream](concepts/stream.md) | The docs and the code differ on whether a read waits through views |
| Rewrite, Compaction | New since the pages: no concept page yet |
| Sealed, Vault, key stores, key wraps | New since the pages: no concept page yet. A tampered box reads as None, not `VaultError`; a root key has no re-wrap path |
| Hosts | `/AWS` and `/GCP` are new entry points (key stores and key wraps). [Rivet](concepts/host-rivet.md) and [Cluster](concepts/host-effect-cluster.md) take `{ name, main, handler?, pool, retention? }` |
| [Policy](concepts/policy.md) | Imported and rewritten events are skipped. A retry's count carries across attempts (inferred) |
| [Foldkit](concepts/foldkit.md) | Unchanged, and not used here |

## Every export, and where it is covered

The root, `index.ts`, in its own order:

| Export | Covered under |
| --- | --- |
| `Event`, `Rejection`, `Command`, `DefaultConsistency` | The write side |
| `Aggregate`, `AlreadyExecuted`, `AlreadyCancelled`, `NotScheduled`, `UnexpectedVersion`, `ImportOutOfOrder` | Aggregate, deadlines |
| `Decision`, `Relation`, `Model` | The write side |
| `Key` (types), `Annotations` (type), `DefinitionError`, `Filter`, `OrderBy` (types) | DefinitionError, Key, Annotations, Filter |
| `View`, `WaitTimeout`, `ConsistencyTimeout`, `Query`, `Projection`, `Stream`, `Read` | The read side |
| `Policy`, `Saga`, `ExternalSystem` | Reactions |
| `Rewrite`, `RewriteReceipt`, `InvariantBroken`, `Compaction`, `CompactionReceipt`, `CompactionLossy` | Corrections |
| `Api`, `protocolHttp`, `protocolWebSocket`, `protocolInProcess` | Surfaces |
| `RequestContext`, `setExpiry`, `Middleware` (types), `Telemetry` | Surfaces |
| `Sealed`, `Vault`, `KeyStore`, `KeyWrap`, `VaultLive`, `MemoryKeyStore`, `HostKeyStore`, `NoKeyWrap`, `RootKeyWrap`, `VaultTest`, `sealedInTest`, `VaultError` | Privacy |
| `InMemory`, `Platform` | Hosts |

The entry points beside it:

| Entry point | Covered under |
| --- | --- |
| `/Story`, `/Prove`, `/Verify`, `/Explore` | Verification |
| `/Http`, `/Cli`, `/Ai`, `/Foldkit` | Surfaces |
| `/InMemory`, `/Cloudflare`, `/EffectCluster`, `/Rivet` | Hosts |
| `/SqlKeyStore`, `/Vault`, `/AWS`, `/GCP` | Privacy: their key stores and key wraps only |
| `/DefinitionError` | The write side: the reasons named there, not all 47 |

**Patterns that are not exports**: unique values (a claim aggregate and a Decision), closing the books (the period in
the id), correcting mistakes (a reversing fact before a Rewrite), optimistic updates and offline intents (a queue of
`commandId`s settled from the server), erasing personal data (a saga of rewrites, or a sealed field shredded). They
are in the library's skill, `node_modules/@alchemy.run/domain/skills/alchemy-domain/references/modeling.md` and
`frontend.md`; the concept pages [unique values](concepts/unique-values.md) and [local-first](concepts/local-first.md)
cover two of them, and the others have no page here yet.

Read only where a line above cites them, and not as a whole: `Kernel.ts`, `internal.ts`, `CatchUp.ts`, `Watch.ts`,
`ReadRpcs.ts`, `TwoPhase.ts`, `Backfill.ts`, `Mention.ts`, `DurableObjects.ts`, and the folders `Prove/`, `Verify/`
and `Explore/`. **Unread**: `globals.d.ts`; anything `/AWS` and `/GCP` export beyond a key store and a key wrap; the
reasons of `DefinitionError` not named above. An API from one of those is checked in the source before it is used,
as every API is.
