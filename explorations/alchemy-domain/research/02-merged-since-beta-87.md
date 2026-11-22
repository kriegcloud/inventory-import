---
type: Research
title: Merged to Alchemy main since 2.0.0-beta.87
description: Every pull request merged to the Alchemy repository's main between the beta.87 release and main@dbfd0ddb, what each one changes for someone using @alchemy.run/domain and the pieces it plugs into, and which ones break code written for beta.87.
tags: [alchemy-domain, report]
---

# Merged to Alchemy main since 2.0.0-beta.87

The release commit of beta.87 is `33c10dd55` ("chore(release): 2.0.0-beta.87", committed 2026-11-12), tagged
`v2.0.0-beta.87`. The head of main read here is `dbfd0ddb9cdedb38a3f7618829ab08c381d404bb` (2026-11-19). GitHub's
compare of the two says main is 45 commits ahead and 0 behind, so every one of the 45 is absent from beta.87. They
were merged between 2026-11-13 and 2026-11-19. Forty-four first lines end with their pull request number; one
(`b50f3f514`, "feat(alchemy): update retry policies to optimize for deployment") does not, and GitHub links it to pull
request #3354. npm's dist-tags for `@alchemy.run/domain` show `latest: 2.0.0-beta.87`, published
2026-11-12T22:27:38Z, and no later version; the domain package's own `package.json` on main still says
`2.0.0-beta.87`. Nothing below is published: a project that installs `@alchemy.run/domain` today gets none of it.

Of the 45 commits, 34 touch the domain package or a piece it plugs into (listed in the main table); 11 do not (the
second table).

## The main table

Oldest first. "Breaking" names what stops compiling or changes behaviour for code written against beta.87.

| PR | Title | Merged | Touches | What changes for a user | Breaking | In beta.87 |
| --- | --- | --- | --- | --- | --- | --- |
| [#3250](https://github.com/alchemy-run/alchemy/pull/3250) | refactor(frontend-frameworks): shared Cloudflare Worker source base | 2026-11-13 | `packages/cloudflare` Website and Workers sources, `alchemy/Util/Ignore` | The framework Website sources (Astro, Next.js, SvelteKit and others) share one build base; the ignore rules move to `@alchemy.run/node-utils` and `alchemy` re-exports them. `Website.Vite` keeps its shape; its env resolution moves to a shared helper. | no | no |
| [#3225](https://github.com/alchemy-run/alchemy/pull/3225) | fix(cloudflare/foldkit): serve deep links in dev | 2026-11-13 | `packages/cloudflare` `Website.Foldkit`, Vite source; the two domain examples' `package.json` | A client-only Foldkit site now serves its app shell for deep links in `alchemy dev`, as it already did when deployed. It needs `@alchemy.run/frontend-frameworks` as a dev dependency. | no (one new dev dependency for Foldkit sites) | no |
| [#3222](https://github.com/alchemy-run/alchemy/pull/3222) | fix: stop any/unknown from erasing typed Effect errors | 2026-11-13 | `packages/alchemy` (Workflows and others), `packages/cloudflare` Workflows, `packages/better-auth`, `packages/git`, `packages/github` | Typed errors that `any` used to swallow now reach the caller's error channel. Cloudflare `cron`, Workflow `task` and its rollback are generic over the handler's error; the better-auth D1, Hyperdrive and Aurora adapters pass their requirements through. A caller may see new error types it must handle. | type-level only: some error and requirement channels widen | no |
| [#3159](https://github.com/alchemy-run/alchemy/pull/3159) | fix(plan): keep binding edges between separate cycles so deletes stay ordered | 2026-11-13 | `packages/alchemy` `Plan.ts` | A destroy deletes resources that bind each other across two separate binding cycles in the right order, instead of leaving one deployed. | no | no |
| [#3354](https://github.com/alchemy-run/alchemy/pull/3354) | feat(alchemy): own deploy retry policy for distilled SDKs | 2026-11-14 | `packages/alchemy` `DeployRetry`, `packages/cloudflare` providers and D1 migrations, `packages/github` | Deploy-time retries keep their patient policy when the distilled clients change their default to a stricter runtime one. Nothing to change in a stack. | no | no |
| [#3412](https://github.com/alchemy-run/alchemy/pull/3412) | fix(plan): keep protection after a failed unprotect update | 2026-11-15 | `packages/alchemy` `Plan.ts`, `State/ResourceState.ts` | When an update that removes `RemovalPolicy.protect()` fails, the next plan still treats the resource as protected and refuses to replace or delete it. Deploy engine only. | no | no |
| [#3253](https://github.com/alchemy-run/alchemy/pull/3253) | fix(domain): a story no longer hangs on a run that waits on several things | 2026-11-15 | `packages/domain` `Story` | A `Story` no longer times out when a policy or saga waits on several stubbed calls at once, or reads a view `atLeast` a write it just made. | no | no |
| [#3379](https://github.com/alchemy-run/alchemy/pull/3379) | fix(domain): retry InstanceNotFound right after a backfill instance starts | 2026-11-15 | `packages/domain` backfill on Cloudflare | The first deploy after a destroy no longer fails at the backfill step with `InstanceNotFound`; the start waits up to a minute for the new Workflow instance to appear. | no | no |
| [#3377](https://github.com/alchemy-run/alchemy/pull/3377) | test(domain): type regressions for exactOptionalPropertyTypes and models without projections | 2026-11-15 | `packages/domain` type tests | Tests only. They pin two fixes already in beta.87: an aggregate without optional members type-checks under `exactOptionalPropertyTypes`, and a model with no projections keeps its layer's requirements. | no | no (the fixes it pins are in beta.87) |
| [#3357](https://github.com/alchemy-run/alchemy/pull/3357) | fix(domain): type Event and Rejection make as the class it is called on | 2026-11-15 | `packages/domain` `Event`, `Rejection` | `Event.make` and `Rejection.make` are typed as the subclass, so `decide` can return them and a rejection built with `make` can be yielded. On beta.87 a rejection must be built with `new`. | no | no |
| [#3376](https://github.com/alchemy-run/alchemy/pull/3376) | fix(domain): re-arm an InMemory timer that wakes before it is due | 2026-11-15 | `packages/domain` `InMemory` | With the in-memory host, a scheduled command or a saga's durable sleep always fires; before, a timer that woke a moment early could stall for good. | no | no |
| [#3373](https://github.com/alchemy-run/alchemy/pull/3373) | fix(domain): list a new instance in the directory after its first commit | 2026-11-15 | `packages/domain` Durable Object host, backfill directory | On Cloudflare, the first command to a new instance answers as soon as its events are stored instead of after 2 to 3 seconds; the directory listing runs afterwards on the instance's alarm and survives eviction. | no (each first commit now writes one extra job row and arms an alarm) | no |
| [#3413](https://github.com/alchemy-run/alchemy/pull/3413) | fix(domain)!: run middleware lists in declaration order | 2026-11-15 | `packages/domain` `Middleware`, docs | A command's, view's, query's or stream's `middleware` list runs first-to-last, as the docs always said. | yes: every list of two or more runs in the reverse of its beta.87 order | no |
| [#3415](https://github.com/alchemy-run/alchemy/pull/3415) | fix(domain): Rivet commits no longer deadlock on the backfill job | 2026-11-15 | `packages/domain` backfill runtime, Rivet host | Repairs a hang that #3373 introduced on Rivet (every command timed out after 30 seconds). A beta.87 user never had the hang. | no | no |
| [#3380](https://github.com/alchemy-run/alchemy/pull/3380) | fix(domain): caughtUp waits for projections fed by a view | 2026-11-15 | `packages/domain` `Projection`, `View`, `Query`, Effect Cluster and Rivet hosts | `Projection.caughtUp(receipt)` and a query's `waitsFor` now wait through a view (or a view over a view); before they returned at once. Effect Cluster and Rivet now deliver history to a consumer of a view instead of failing with `DomainClassNotHosted`. | no (view snapshots gain an `emitted` record, filled in on the next apply) | no |
| [#3414](https://github.com/alchemy-run/alchemy/pull/3414) | fix(domain): validate before disclosing reads, redact defects to Api clients | 2026-11-15 | `packages/domain` `Api`, reads, WebSocket protocol | A read that `validate` refuses fails at once and looks the same whether or not the key has history; a refused WebSocket read returns cursor `-1`. A defect or undeclared failure is logged on the server and the client receives one generic "Internal server error". | behaviour: clients no longer see defect messages or stacks | no |
| [#3328](https://github.com/alchemy-run/alchemy/pull/3328) | fix(core): ALCHEMY_DEV reads true in Test.make({ dev: true }) stacks | 2026-11-15 | `packages/alchemy` `Phase.ts` | Inside a stack, `Alchemy.ALCHEMY_DEV` follows the flag that picks local or live providers, so a test stack with `dev: true` reads `true`. | behaviour: a shell `ALCHEMY_DEV=1` with live providers now reads `false` in a stack | no |
| [#3420](https://github.com/alchemy-run/alchemy/pull/3420) | feat(domain)!: Decision, a command decided across several aggregates | 2026-11-17 | `packages/domain` (new `Decision`, `TwoPhase`; `Command`, `Aggregate`, `Model`, `Api`, `Http`, `Cli`, `Foldkit`, `Story`), docs, the domain examples | Adds `Domain.Decision`: one command decided against several aggregate instances, all events or none (a two-phase commit on Cloudflare, Rivet and Effect Cluster). A command loses `target`; the aggregate names the id field with `keyOf`. | yes: `target` is gone, every `send`, `schedule`, `Story.when`, Api, HTTP and CLI call changes shape | no |
| [#3446](https://github.com/alchemy-run/alchemy/pull/3446) | fix(effect-cluster): runner pools accept Database.fromUrl | 2026-11-17 | `packages/effect-cluster` pools | A runner pool given a database by URL picks a network itself instead of failing with `DatabaseNetworkMismatch`; several pools gain a `network` option. | no | no |
| [#3215](https://github.com/alchemy-run/alchemy/pull/3215) | feat(alchemy)!: Callbacks service with per-backend layers; AWS schedule writes bind their target | 2026-11-17 | `packages/alchemy` `Callback`, `RuntimeContext`, Durable Object engine; `packages/cloudflare` Durable Objects and Workflows; `packages/domain` host indexes; `packages/effect-cluster` | `Alchemy.makeCallback` needs a backend Layer (`Cloudflare.DurableObjectCallbacks`, `AWS.Scheduler.SchedulerCallbacks()`); its retry option and part of its status are gone; `RuntimeContext.makeCallback` is removed. The Domain hosts now provide the layer themselves. | yes, for code that calls `makeCallback` directly | no |
| [#3095](https://github.com/alchemy-run/alchemy/pull/3095) | fix(cloudflare): preserve undeclared container instance counts | 2026-11-17 | `packages/cloudflare` Containers | A Container that leaves out `instances` keeps the count Cloudflare runs; a scaling change no longer rolls out every instance. | no | no |
| [#3268](https://github.com/alchemy-run/alchemy/pull/3268) | fix(cloudflare): export telemetry from Durable Object fibers outside an event | 2026-11-17 | `packages/alchemy` `TelemetryRuntime`, Durable Object bridge | Spans and logs from a Durable Object fiber that outlives its event (a forked loop, a fan-out) are exported on the next event instead of being dropped. | no | no |
| [#3484](https://github.com/alchemy-run/alchemy/pull/3484) | fix(examples): reference alchemy-test so its types build first | 2026-11-17 | 136 examples' `tsconfig.json`, including `examples/cloudflare-domain/tsconfig.stack.json` | Build order in the repository only: projects that import `@alchemy.run/test` reference it so its declarations exist before they are checked. | no | no |
| [#3341](https://github.com/alchemy-run/alchemy/pull/3341) | feat(cloudflare-runtime): update workerd and sync with upstream miniflare | 2026-11-17 | `packages/cloudflare-runtime`, `packages/cloudflare` `EdgeSession`, Next.js | The local runtime moves to workerd `1.20261117.1` with upstream D1, R2 and asset fixes, and the default compatibility date becomes `2026-11-17`, which switches on six flags for Workers that set no date. | behaviour, for Workers without a pinned compatibility date | no |
| [#3493](https://github.com/alchemy-run/alchemy/pull/3493) | test(domain): count the ledger's own directory attempts | 2026-11-17 | `packages/integration-tests/test/Domain` | Test only: fixes a flaky count in the directory test. | no | no |
| [#3469](https://github.com/alchemy-run/alchemy/pull/3469) | feat(domain)!: a command can wait until its views have applied it | 2026-11-18 | `packages/domain` `Command`, `Api`, `View`, `Platform`, `Ai`, `Http`; docs | A command sent through an Api can take `consistency: "strong"` and answer only once every view it reaches has applied it; `Domain.DefaultConsistency` sets a client's default. A view's or stream's `atLeast` takes one receipt or several. | yes: every command's client error type gains `ConsistencyTimeout` | no |
| [#3326](https://github.com/alchemy-run/alchemy/pull/3326) | fix(cloudflare/containers)!: resolve a relative dockerfile against context | 2026-11-18 | `packages/cloudflare` Containers | A Container's relative `dockerfile` resolves against its `context`, as documented, instead of the directory `alchemy` runs in. | yes, for a Container whose `dockerfile` path was written relative to the run directory | no |
| [#3306](https://github.com/alchemy-run/alchemy/pull/3306) | feat(cloudflare/ai-gateway): add workersAiBillingMode | 2026-11-19 | `packages/cloudflare` AI Gateway | `Cloudflare.AI.Gateway` takes `workersAiBillingMode` (`"unified"` or `"postpaid"`); leaving it out keeps the gateway's current mode. | no | no |
| [#3260](https://github.com/alchemy-run/alchemy/pull/3260) | feat(domain): Verify proves and searches a model's rules | 2026-11-19 | `packages/domain` (new `Verify`, `Prove`, `Explore`, `Relation`; rules on `Aggregate`, `Decision`, `Model`), docs, `examples/cloudflare-domain` | Rules are written on the declarations (`invariants`, `transitions`, model `invariants`, `eventually`, `relations`), and one test, `Verify.model` or `Verify.aggregate`, proves each with a solver or searches for the shortest command sequence that breaks it. The package gains two runtime dependencies, `oxc-parser` and `z3-solver`. | no (additive; the new dependencies are heavy) | no |
| [#3416](https://github.com/alchemy-run/alchemy/pull/3416) | docs(website): integrate Alchemy Domain into the home page | 2026-11-19 | `website` home page only | The home page leads with Domain. No library change. | no | no |
| [#3503](https://github.com/alchemy-run/alchemy/pull/3503) | feat(domain): Verify reads effect/Match | 2026-11-19 | `packages/domain` `Prove` reader, docs | Handlers and rules written with `effect/Match` (`Match.value`, `Match.tag`, `Match.when`, `Match.exhaustive` and others) can be proved; before, any `Match` call made the rule unprovable. | no | no |
| [#3504](https://github.com/alchemy-run/alchemy/pull/3504) | docs(domain): verify the bank in the tutorial, and list what the prover reads | 2026-11-19 | `website/src/content/docs/domain` tutorial and two new pages, the domain skill's testing reference | The tutorial adds rules and a `Verify` test as it builds; a new page lists every statement and library function the prover can read. Docs only. | no | no |
| [#3501](https://github.com/alchemy-run/alchemy/pull/3501) | fix(railway): stop the context upload from following pnpm symlink cycles | 2026-11-19 | `packages/alchemy` (a test of the shared ignore walker), `packages/node-utils`, Docker, Railway | A Railway service whose build context is a pnpm workspace no longer runs out of memory during plan. Docker and Container contexts with a `dir/**` ignore rule get a new image tag once. | no | no |
| [#3518](https://github.com/alchemy-run/alchemy/pull/3518) | fix(runtime)!: read env strings that look like JSON unchanged in runtime Config | 2026-11-19 | `packages/alchemy` `Runtime`, `RuntimeContext`, `Telemetry`; `packages/cloudflare` Worker config provider; the Effect Cluster and Rivet bootstraps | A runtime `Config` read returns the env string exactly as set: `"false"` stays a string, `"1.0"` stays `"1.0"`, a long decimal is not rounded. Only Alchemy's own marker for bound config is decoded. | yes: quoted strings are no longer unquoted; `reifyBoundConfigProvider` is removed; `layerOtlp({ serviceName })` no longer sets `OTEL_SERVICE_NAME` | no |

## The breaking changes, in this app's terms

Each sketch shows the beta.87 shape first and the main shape second. None of them was compiled. Blocks are built
with `new` throughout: inside `decide` the prover on main reads only `new` (a trial on 2026-11-19), and the app's
`newSchemaClass` diagnostic, which asks for `.make`, needs an exception for domain blocks. On main, the
commands below would live on an `Item` aggregate whose id is the item's id; the app today has no such aggregate (see
[aggregate](concepts/aggregate.md) and [command](concepts/command.md)).

### #3420: a command has no `target`; the aggregate names it with `keyOf`

On beta.87 a command declares `target` (`packages/domain/src/Command.ts` line 25) and the client's `send` takes the
target first (`packages/domain/src/Aggregate.ts` line 304). On main the target field is gone, `Aggregate` takes an
optional `keyOf` from command to id (main `Aggregate.ts` line 182), and `send` takes only the command (main
`Aggregate.ts` line 360). `keyOf` is one function for every command of the aggregate, so the id field must have the
same name in each. `get(id)` and `unschedule(id, commandId)` keep their id argument.

```ts
// SKETCH: not compiled
// beta.87
class EditItem extends Domain.Command("EditItem", {
  target: ItemId,
  input: { name: S.String, seenRevision: S.Int },
  events: [ItemEdited],
  rejects: [StaleRevision],
}) {}

const items = yield* Item
yield* items.send(itemId, new EditItem({ name: "Hex bolt M8", seenRevision: 3 }))
yield* items.schedule(itemId, new MarkDiscontinued({}), { at: discontinueOn })
```

```ts
// SKETCH: not compiled
// main@dbfd0ddb
class EditItem extends Domain.Command("EditItem", {
  input: { itemId: ItemId, name: S.String, seenRevision: S.Int },
  events: [ItemEdited],
  rejects: [StaleRevision],
}) {}

class Item extends Domain.Aggregate("Item", {
  id: ItemId,
  // ... state, initial, evolve
  commands: [EditItem, MarkDiscontinued],
  keyOf: (cmd) => cmd.itemId,
  decide: { /* ... */ },
}) {}

const items = yield* Item
yield* items.send(new EditItem({ itemId, name: "Hex bolt M8", seenRevision: 3 }))
yield* items.schedule(new MarkDiscontinued({ itemId }), { at: discontinueOn })
```

The same change reaches every surface: `Story.when(item, cmd)` becomes `Story.when(cmd)`; an Api call
`catalog.EditItem(itemId, { ... })` becomes `catalog.EditItem({ itemId, ... })`; the HTTP body is
`{ commandId?, input }` with the id inside `input`; the CLI's `--target` flag becomes the input's own flag
(`--item-id`); `Item.predict(state, cmd, { id, now })` drops `id`. A command's Api receipt is
`{ reply, stream, version, commits }`.

### #3413: middleware lists run in declaration order

On beta.87 `packages/domain/src/Middleware.ts` applies the list with `reduce`, which the RPC server turns into
last-entry-outermost, so the last entry ran first although the comment said otherwise. Main applies it with
`reduceRight` (main `Middleware.ts` line 40), so the first entry runs first and what it provides reaches the rest. A
list with one entry is unaffected. To keep beta.87 behaviour after upgrading, reverse each list of two or more.

```ts
// SKETCH: not compiled
// beta.87: in practice OrgAdminCheck ran before SignedInMember had provided the actor,
// so code that worked had the list written backwards:
class SetRole extends Domain.Command("SetRole", {
  middleware: [OrgAdminCheck, SignedInMember],
  // ...
}) {}

// main@dbfd0ddb: the first entry authenticates and provides CurrentActor, then the admin check runs
class SetRole extends Domain.Command("SetRole", {
  middleware: [SignedInMember, OrgAdminCheck],
  // ...
}) {}
```

### #3469: a command can wait for its views; every command's client error includes `ConsistencyTimeout`

Main adds `Domain.DefaultConsistency`, a `Context.Reference` defaulting to `"eventual"` (main `Command.ts` line 66,
exported from `index.ts`), and a `consistency` option on a command sent through an Api. With `"strong"`, the Api's
command handler on the server waits until every view the events reach has applied them, for up to 10 seconds. If a
view is late the call fails with `ConsistencyTimeout`, though the command is committed; sending again with the same
`commandId` returns its receipt. The breaking part is the type: every command's client error union now contains
`ConsistencyTimeout`, so a command with no rejections no longer has error type `never`. Projections are not waited
for, and a command sent from inside the model (a policy or saga) still answers at the commit.

```ts
// SKETCH: not compiled
// beta.87: the screen passes the receipt to the read
const receipt = yield* catalog.EditItem(itemId, { name, seenRevision })
const row = yield* catalog.ItemRows.get(itemId, { atLeast: receipt })

// main@dbfd0ddb: the server waits; the read needs no receipt
yield* catalog.EditItem({ itemId, name, seenRevision }, { consistency: "strong" }).pipe(
  Effect.catchTag("StaleRevision", () => showRefusal),
  Effect.catchTag("ConsistencyTimeout", () => showSavedButListBehind), // committed; a view is behind
)
const row = yield* catalog.ItemRows.get(itemId)
```

A view read's `atLeast` on main also takes several receipts, and a receipt whose events never reach the key waits for
nothing instead of failing after 10 seconds.

### #3215: one `Callbacks` service with a Layer per backend

The `packages/alchemy` package is not in the beta.87 export read for this packet, so the beta side here rests on the
pull request's own migration notes and on main's source. On main, `packages/alchemy/src/Callback.ts` defines
`Callbacks` (line 76) and `makeCallback` (line 156); `RuntimeContext.makeCallback` is gone. A callback's handler must
have error type `never` (retry or handle inside it); the `retry` option is removed; `getStatus` returns
`{ scheduledAt, progress }` only. The Domain hosts on main provide the layer themselves
(`packages/domain/src/Cloudflare/index.ts` line 165 provides `DurableObjectCallbacks`), so a Domain model's own
schedules and saga sleeps need no change. Only code that calls `makeCallback` directly inside a Durable Object must
provide a backend.

```ts
// SKETCH: not compiled
// beta.87, inside a Durable Object that sends an import's left-out rows to an archive later
const onArchive = yield* Alchemy.makeCallback(
  "archiveLeftOut",
  Effect.fn(function* (payload: LeftOutRows) {
    yield* archive.put(payload.importId, payload.csv)
  }),
  { retry: { delay: "10 seconds" } },
)

// main@dbfd0ddb
const onArchive = yield* Alchemy.makeCallback(
  "archiveLeftOut",
  Effect.fn(function* (payload: LeftOutRows) {
    yield* archive.put(payload.importId, payload.csv).pipe(Effect.orDie)
  }),
)
// ... and the object's body ends with
//   .pipe(Effect.provide(Cloudflare.DurableObjectCallbacks))
```

### #3518: env strings that look like JSON are read unchanged

On main a runtime `Config` read returns the env string as set (`runtimeConfigProvider`, main
`packages/alchemy/src/Runtime.ts` line 57; `RuntimeConfigProviderLive`, line 84). Before, a Worker env value that
parsed as JSON was decoded: `"false"` became a boolean, so `Config.String` failed on it, and `"1.0"` became `"1"`.
For this app, a Worker setting such as `AI_ENABLED = "false"` read with `Config.String` fails on beta.87 and returns
`"false"` on main; read with `Config.Boolean` it is `false` on both. What breaks: a value written as a quoted string
(`"\"hello\""`) is no longer unquoted; a Cloudflare `json` binding read with `Config.String` during init now fails;
`reifyBoundConfigProvider` is removed (use `runtimeConfigProvider` or `RuntimeConfigProviderLive`);
`layerOtlp({ serviceName })` no longer overwrites `OTEL_SERVICE_NAME`.

```ts
// SKETCH: not compiled
// env: { AI_ENABLED: "false", BUILD_ID: "20261119.0130" }
const aiEnabled = yield* Config.String("AI_ENABLED")
// beta.87: fails (the value was decoded to a boolean)    main: "false"
const build = yield* Config.String("BUILD_ID")
// beta.87: "20261119.013" (decoded as a number)           main: "20261119.0130"
```

### The smaller breaks outside the domain package

- #3326: a Cloudflare Container's relative `dockerfile` now resolves against `context`. A stack that wrote it relative
  to the run directory must rewrite the path.
- #3341: Workers that set no compatibility date move to `2026-11-17` and gain six flags (among them
  `new_module_registry` and `enable_request_signal`). Pinning a date keeps the old set.
- #3328: inside a stack, `ALCHEMY_DEV` now follows the provider choice, not the shell variable.
- #3222: some Alchemy and better-auth signatures widen their error or requirement channels, so a caller may have to
  handle an error that `any` used to hide.

## What a user on beta.87 does not have

### New blocks

- **Decision** (#3420): `Domain.Decision(command, { reads, keyOf, decide })`, listed in a model's `decisions`. One
  command is decided against several aggregate instances and every event commits or none does. An aggregate that
  only takes part in decisions lists the `events` recorded on it and has no commands. A key can stand for several
  instances when `keyOf` returns an array. `Domain.verify` gains `UnknownRead` and `ImplementedTwice`. The commit
  strategy is the `TwoPhase.DecisionCommit` reference (main `packages/domain/src/TwoPhase.ts` line 401). A decision's
  command cannot be scheduled and has no `predict`. See [decision](concepts/decision.md).
- **Relation** (#3260): `Domain.Relation({ over, holds })` in a model's `relations`, a rule over a fixed few
  instances that the prover proves for every command and decision recording on them. See [relation](concepts/relation.md).
- **Invariants and transitions** (#3260): `invariants` and `transitions` on an aggregate (main `Aggregate.ts` lines
  157 and 167) and on a decision; `invariants` and `eventually` on a model (main `Model.ts` lines 149 and 167). A
  transition may be an Effect that reads `CurrentActor`. See [invariants-and-transitions](concepts/invariants-and-transitions.md).
- **Verify** (#3260): `Verify.model(model, { apis, story, require, allow })` (main `Verify.ts` line 444) and
  `Verify.aggregate(aggregate)` (line 574), imported from `@alchemy.run/domain/Verify`. One test proves what it can,
  searches the rest, runs every found sequence as a `Story` on the real model, and fails on anything it could not
  read unless `allow` names it. See [verify](concepts/verify.md).
- **Prove** (#3260, #3503): reads `decide`, `evolve` and the rules as logic and asks the Z3 solver for a breaking
  state and input; `Prove.decision(decision, { source })` (main `Prove.ts` line 556) proves a decision alone. It reads
  `effect/Array`, `effect/Record`, `effect/Struct`, `Option`, `bigint` and, after #3503, most of `effect/Match`. See
  [prove](concepts/prove.md).
- **Explore** (#3260): runs every short sequence of commands through the Apis with solver-picked values, following
  policies, sagas, schedules, views and external systems, with each event delivered twice and each saga step run
  twice by default, then 200 seeded random walks. See [explore](concepts/explore.md).
- **Strong commands** (#3469): `consistency: "strong"` on a command sent through an Api, and
  `Domain.DefaultConsistency` for a client's default. See [reads-and-consistency](concepts/reads-and-consistency.md).
- **Callbacks per backend** (#3215): `Alchemy.Callbacks` with `Cloudflare.DurableObjectCallbacks` and
  `AWS.Scheduler.SchedulerCallbacks()`.

### Changed shapes

- A command has no `target`; `send`, `schedule`, `Story.when`, Api calls, HTTP bodies, CLI flags and `predict` change
  with it (#3420).
- An aggregate gains `keyOf`, optional `events`, and may leave out `commands`, `keyOf` and `decide` (#3420).
- A model gains `decisions`, `invariants`, `relations` and `eventually` (#3420, #3260).
- Api command receipts are `{ reply, stream, version, commits }` for every command (#3420).
- Every command's client error union includes `ConsistencyTimeout` (#3469).
- A view's or stream's `atLeast` takes one receipt or several; a stream's `list` takes it too (#3469).
- A view key's snapshot records, per source, the last command that reached it and the range it emitted (#3380).
- `makeCallback` loses `retry`; `getStatus` loses `retryAt`, `attempts` and `parked` (#3215).
- `@alchemy.run/domain` depends on `oxc-parser` and `z3-solver` (#3260); beta.87 has no runtime dependencies of its own.

### Fixes, each with the wrong behaviour it removes

- `make` typed as the class it is called on (#3357): on beta.87, `Rejection.make(...)` is typed as plain data, so
  `decide` refuses it and it cannot be yielded, and `Event.make` loses the subclass's getters. Main types both as the
  subclass (main `packages/domain/src/Event.ts` lines 102 to 107).
- The in-memory timer that wakes early (#3376): on beta.87, `Domain.InMemory` sleeps once for the time left, and if
  the clock wakes the sleep a moment early nothing is due and nothing re-arms, so the schedule never fires. Main
  sleeps again for whatever is left (main `InMemory.ts` lines 385 to 386).
- Validation before a read is disclosed (#3414): on beta.87, a refused read of a key with history fails at once while
  a never-written key waits about 10 seconds for `ConsistencyTimeout`, which tells a client which keys exist; a
  WebSocket refusal returns the key's real cursor; a defect's message and stack reach the client. Main judges
  `validate` before waiting, answers both cases alike, and sends one generic defect.
- Middleware order (#3413): the last entry ran first on beta.87, contrary to the docs.
- A story that hangs (#3253): on beta.87 a `Story` times out with no error when one run waits on several stubbed calls
  or polls a view `atLeast` its own write.
- `caughtUp` through a view (#3380): on beta.87 `Projection.caughtUp` returns at once for a projection fed by a view,
  and Effect Cluster and Rivet fail to backfill a view's consumer with `DomainClassNotHosted`.
- First command to a new instance (#3373): on beta.87 on Cloudflare it waits 2 to 3 seconds for the backfill
  directory to list the instance.
- Backfill start after a destroy (#3379): on beta.87 the first deploy after `alchemy destroy` can fail with
  `InstanceNotFound` at the backfill step.
- Env strings in runtime `Config` (#3518): on beta.87 a value that parses as JSON is changed before you read it.
- Telemetry from Durable Object fibers (#3268): on beta.87 spans and logs from a fiber that outlives its event are
  dropped.
- Deploy ordering and protection (#3159, #3412): a destroy across two binding cycles can leave a resource deployed;
  a failed update that removes protection can let the next plan replace or delete a protected resource.
- `ALCHEMY_DEV` in test stacks (#3328): reads `false` under `Test.make({ dev: true })` on beta.87.
- Effect Cluster with a database by URL (#3446): every runner pool refuses `Cluster.Database.fromUrl` with
  `DatabaseNetworkMismatch` on beta.87.
- Typed errors erased by `any` (#3222): on beta.87 some Alchemy, Cloudflare and better-auth signatures lose typed
  errors in their error channel.

## The commits that touch none of these pieces

| Commit | PR | What it is |
| --- | --- | --- |
| `a05029404` | [#3325](https://github.com/alchemy-run/alchemy/pull/3325) | An install script builds only the distilled SDKs Alchemy uses. |
| `39de206fc` | [#3339](https://github.com/alchemy-run/alchemy/pull/3339) | Stripe provider: idempotency keys sent as input members. |
| `c6703f2cd` | [#2034](https://github.com/alchemy-run/alchemy/pull/2034) | DigitalOcean Droplet, SshKey and Firewall resources. |
| `cbea844ae` | [#3229](https://github.com/alchemy-run/alchemy/pull/3229) | The full DigitalOcean provider. |
| `1c2b7e83d` | [#3302](https://github.com/alchemy-run/alchemy/pull/3302) | Stripe provider: option gaps filled, four new resources. |
| `6787d1800` | [#3462](https://github.com/alchemy-run/alchemy/pull/3462) | `capnp-es` bumped in the workspace catalog, for faster local preview startup. |
| `73071a8b4` | [#3249](https://github.com/alchemy-run/alchemy/pull/3249) | AWS, GCP and Hetzner refuse to delete a resource with deletion protection on (breaking for those providers only). |
| `47f423b35` | [#3418](https://github.com/alchemy-run/alchemy/pull/3418) | Stripe: thin events and EventBridge delivery for `consumeEvents`. |
| `486897855` | [#3481](https://github.com/alchemy-run/alchemy/pull/3481) | `packages/sql` declares `@types/pg` as an optional peer dependency. |
| `3ff34b94f` | [#2749](https://github.com/alchemy-run/alchemy/pull/2749) | A 1Password secrets provider for stacks, `@alchemy.run/1password` (not on npm); see [distilled clients](concepts/distilled-clients.md). |
| `b784ba035` | [#3505](https://github.com/alchemy-run/alchemy/pull/3505) | Home page logo marquee gains the new providers. |

Thirty-four rows in the main table and eleven here: 45 in all.

## How to refresh this page

Replace the head with main's current commit and run both:
`gh api repos/alchemy-run/alchemy/compare/v2.0.0-beta.87...<new head> --jq '.commits[] | [.sha[0:9], .commit.committer.date[0:10], (.commit.message | split("\n")[0])] | @tsv'`
and, for each new commit, `gh api repos/alchemy-run/alchemy/commits/<sha> --jq '.files[].filename'`. When npm's
`latest` for `@alchemy.run/domain` moves past `2.0.0-beta.87`, compare from the new release tag instead.
