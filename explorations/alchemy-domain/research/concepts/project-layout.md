---
type: Reference
title: Project layout
description: Upstream's convention for where each building block lives (domain, server and web packages; one block per file named <Noun>.<kind>.ts), set beside inventory-import's contract/model/host/web packages and its own file suffixes.
tags: [alchemy-domain, layout]
---

# Project layout

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

Upstream lays out a project so a file's name says what it holds and the model never depends on how it is hosted. Each
file holds one building block and is named after the block's noun and its kind (`Account.aggregate.ts`), folders are
subdomains, and the work splits into three packages: a pure domain package, a server package that hosts it and
implements what it only declares, and a foldkit web package. The docs put the goal as "a file's name tells you what it
holds before you open it" [https://alchemy.run/domain/project-layout]. This app already splits each bounded context
into four packages with its own file suffixes, and several of its suffixes reuse upstream's words with another
meaning; this page maps one onto the other.

## When to reach for it

- Before the first `@alchemy.run/domain` file lands in the app: decide the package and the file name of each kind of
  block once.
- When a new block is added: the table under "In this app" says where it goes.
- When reading upstream examples (`examples/cloudflare-domain`): translate their paths into the app's.

## How it is declared

This is a convention, not an API. Upstream's version, from the docs page, the skill (`SKILL.md` "Conventions") and
its `references/layout.md`:

```text
packages/
  domain/   the model, its Apis and its stories      imports @alchemy.run/domain and effect only
    src/
      Account/   Account.aggregate.ts  Account.id.ts  WithdrawMoney.command.ts  NotOpen.rejection.ts
                 AccountSummary.view.ts  Statement.view.ts
      Transfer/  Transfer.aggregate.ts  ExecuteTransfer.saga.ts  TransferExecution.policy.ts
      Fraud/     FraudCheck.external.ts  FraudReview.policy.ts
      Ledger/    Ledger.projection.ts  AccountLedger.query.ts  LedgerStore.ts (the port + a memory implementation)
      Session.middleware.ts  CurrentActor.context.ts  CustomerApi.api.ts  Bank.model.ts
    test/Bank.story.test.ts
  server/   hosts the model: the Worker, *Live middleware, external system adapters, port implementations (D1)
  web/      the foldkit app and its Worker
alchemy.run.ts   one stack deploys the server and the web app
```

The rules that go with it:

- **One block per file, `<Noun>.<kind>.ts`.** Kinds at beta.87: `.aggregate`, `.command`, `.view`, `.policy`,
  `.saga`, `.projection`, `.stream`, `.query`, `.external`, `.api`, `.model`, plus `.middleware`, `.context` and
  `.rejection`. An aggregate's id is `<Aggregate>.id.ts` beside it. Plain values (`Money.ts`) and helpers keep plain
  names.
- **A command file holds the command, the events it records and the rejections only it returns.** A rejection or
  event several commands share gets its own file (upstream names `<Name>.rejection.ts`; it gives no kind for a shared
  event file).
- **A block's implementation sits in its file** (`TransferExecutionLive` in `TransferExecution.policy.ts`), unless it
  touches infrastructure; then it lives in the server package.
- **Folders are subdomains.** The model, Apis, middleware and request context sit at the package root.
- **The domain package imports only `@alchemy.run/domain` and `effect`**, so its stories run the whole model in memory.
- **One domain package per model.** A second bounded context is a second domain package; one server can host both.
- **Packages export source by path** (`"exports": { "./*": "./src/*.ts" }`). Inside a package, files import each
  other by relative path with the `.ts` extension (`./Account.id.ts`); other packages import without the extension
  (`@acme/domain/Account/Account.id`). There are no barrel files, and `tsc -b` type-checks a solution
  `tsconfig.json` (`references/layout.md:91`, `:97-111`).
- **Split a file that mixes the two sides**: `Session.middleware.ts` declares (domain), `Session.ts` implements
  (server).

Checked in, at `v2.0.0-beta.87`: `website/src/content/docs/domain/project-layout.mdx:6-114`,
`packages/domain/skills/alchemy-domain/SKILL.md:45-54`, `packages/domain/skills/alchemy-domain/references/layout.md:1-151`.

### What main changes

- A new kind, `.decision` (`Registration.decision.ts`), for a [decision](./decision.md): docs `project-layout.mdx:15`
  and `:64`, `SKILL.md:48`. The `Customer/` folder example lists `Registration.decision.ts` where beta.87 listed
  `UsernameReservation.policy.ts`.
- The skill's checklist step 2 says a command's input carries the id field its aggregate's `keyOf` reads
  (`SKILL.md:78`), because commands lose `target` on main.
- `references/layout.md` is the same. `references/modeling.md` replaces "reserve, then commit" with a decision as the
  first answer to a rule that spans instances (`modeling.md:19-28`).
- The layout gains a constraint that is not written in the docs: the prover behind `Verify` and `Prove` reads an
  aggregate's source and follows relative imports only (`packages/domain/src/Prove/internal/Source.ts:228-230`: a
  specifier is resolved only when it starts with `.`). Upstream's example already satisfies it, because every block
  of the bank sits in the one domain package and is imported relatively
  (`examples/cloudflare-domain/packages/domain/src/Account/Account.aggregate.ts:6-24`). See "Where the blocks may
  live" under "In this app".
- Commit not known.

## Rules, and the mistakes to avoid

- Do not let a model file import a host: no D1, no Better Auth, no OpenRouter in a file that declares blocks.
- A port and its in-memory twin belong with the model; its D1 adapter belongs with the host. The app already does this
  (`*.store.ts` in `model`, `*.adapter.ts` in `host`).
- Watch the words the app and upstream share with different meanings (table below). The worst is `.command.ts`: in
  the app's `contract` packages it names request payload schemas, not `Domain.Command`s.
- `Model.ts` already exists in the app (`apps/inventory/src/server/Model.ts`) and means the language model. Name the
  domain model `Catalog.model.ts`, never `Model.ts`.
- On main, `Decision` is a building block. The app's `Decision.command.ts` and "row decision" mean what the person
  decided for a row. Keep a `Domain.Decision` in a `.decision.ts` file and never call a row decision one.
- On main, if an aggregate is to be proved, its commands, events and rejections, and every helper its `decide`,
  `evolve`, invariants or transitions call, must be reachable from the aggregate's file by relative imports. A trial
  on 2026-11-19 showed what happens otherwise: blocks imported by package name were not read (the report said the
  aggregate builds a class that is not an event, a rejection or a command), and a helper imported by package name was
  reported as a call the prover has no model for. Blocks imported from another file of the same package by a relative path were read.
- Inside `decide`, build events and rejections with `new` (`new ImportConfirmed({ ... })`): the prover on main does
  not read `Event.make(...)`, and on beta.87 `Rejection.make()` does not type-check. The app's Effect diagnostic
  `newSchemaClass` is an error (`tsconfig.base.json:190`), so the files that hold domain blocks need an exception to
  it (a per-line `// @effect-diagnostics-next-line newSchemaClass:off` passed the type-check in the trial on beta.87).
- Put one aggregate name in each prover test file. In the trial, two aggregates with the same name imported into one
  test file made the prover read one file for both, and the report said the real code disagreed with what the explorer had
  read.

## In this app

### Two layouts side by side

| Upstream | This app | Notes |
| --- | --- | --- |
| `packages/domain` (one per model) | `packages/<context>/contract` + `packages/<context>/model`, for `catalog` and `access` | `contract` holds wire schemas, ids, reads, rejections and the `HttpApi` contract; it may import only `@inventory/kernel` among workspace packages. `model` holds rules, ports, handlers and in-memory twins; it may import its own `contract` and `kernel`. |
| `packages/server` | `packages/<context>/host` + `apps/inventory/src/server` | `host` holds D1 adapters (`*.adapter.ts`), the HTTP wiring (`*.http.ts`) and `Host.ts`; the app composes everything in `App.ts` and `worker.ts`. |
| `packages/web` (foldkit) | `packages/<context>/web` + `apps/inventory/src/web` | React screens (`*.screen.tsx`), controllers, atoms, machines. Not foldkit. |
| shared middleware and context at the domain package root | `packages/kernel` for `/api/v1`; each model's own package for the model | `Identity.middleware.ts`, `SameOrigin.middleware.ts`, `Actor.context.ts`, `Agent.context.ts`, `Ids.id.ts` stay in the kernel for `/api/v1`. The model's request context and its middleware are declared again in each model's package, because the prover reads no rule through a context imported by package name (the `.id` row below); one session lookup fills both. |
| `alchemy.run.ts` | `alchemy.run.ts` re-exporting `packages/infra/src/Inventory.stack.ts` | Already an Alchemy stack (`Cloudflare.Website.Vite`). |
| `"exports": { "./*": "./src/*.ts" }` | one named entry per file (`"./Review": "./src/Review/Review.rules.ts"`) | The app lists exports exactly, no wildcard. |
| domain package imports only domain + effect | `model` also imports `@beep/schema` and `@inventory/kernel` | A `@alchemy.run/domain` dependency is outside the boundary law's reach: it checks workspace packages only. |

Which package may import which is enforced by `packages/tooling/tool/cli/src/commands/Laws/Boundaries.rules.ts:94-131`
(`contextMay`, `allowed`): `web` may import its own `model`, so a web package could import an Api declared in `model`,
as upstream's web imports the domain package.

### The app's suffixes, and the upstream word each one collides with

| App suffix | What it holds in the app | Example | Upstream meaning of the same word |
| --- | --- | --- | --- |
| `.command.ts` | request payload schemas | `catalog/contract/src/Staging/Upload.command.ts`, `Import/Decision.command.ts` | a `Domain.Command` with its events and rejections |
| `.rejection.ts` | `S.TaggedError` failures of the HTTP contract | `catalog/contract/src/Import/Import.rejection.ts` | a shared `Domain.Rejection`. Any tagged error class works in `rejects` (`Rejection.ts:33` at beta.87), so these may be reused. |
| `.external.ts` | a `Context.Service` port to the language model | `catalog/model/src/Answer/Answerer.external.ts` | a `Domain.ExternalSystem` declaration: the same role |
| `.context.ts` | a `Context.Reference` or service | `kernel/src/Actor.context.ts`, `catalog/model/src/Review/ItemsOfRow.context.ts` | a `Domain.RequestContext` (`CurrentActor.context.ts`): `Actor.context.ts` is the direct analogue |
| `.middleware.ts` | an `HttpApiMiddleware` | `kernel/src/Identity.middleware.ts` | a middleware declaration (the skill says an RpcMiddleware declaration) |
| `.id.ts` | branded id schemas | `catalog/contract/src/Catalog.id.ts` | the aggregate's id: the same role |
| `.store.ts` | a storage port (`Context.Service`) | `catalog/model/src/Import/ImportStore.store.ts` | no kind; upstream's port is a plain name (`LedgerStore.ts`) |
| `.adapter.ts` | a D1 implementation of a port | `catalog/host/src/ImportStore.adapter.ts` | no kind; upstream puts it in the server package (`Ledger/D1LedgerStore.ts`) |
| `.rules.ts` | pure functions (`review`, `confirmPlan`) | `catalog/model/src/Review/Review.rules.ts` | no kind; upstream helpers keep plain names |
| `.handler.ts`, `.handlers.ts` | HTTP endpoint handlers and their registry | `catalog/model/src/Import/Imports.handler.ts`, `Catalog.handlers.ts` | no kind; a block's implementation sits in the block's own file |
| `.read.ts` | decoded read shapes on the wire | `catalog/contract/src/Item/Item.read.ts` | no kind; reads are `.view.ts` and `.query.ts` |
| `.memory.ts`, `.ports.ts`, `.contract.ts`, `.http.ts` | in-memory twins, the port list, the `HttpApi`, its wiring | `Catalog.memory.ts`, `Catalog.ports.ts`, `Catalog.contract.ts`, `Catalog.http.ts` | no kind |

### Where each kind of block would live here

A sketch, for the owner to confirm. It puts every `Domain.*` declaration in the context's `model` package (the
closest thing to upstream's pure domain package, and importable by `host` and `web`), keeps value schemas and ids in
`contract`, and keeps implementations that touch D1 or a provider in `host`.

| Kind | Package | File name in this app |
| --- | --- | --- |
| `.model` | `packages/catalog/model`, `packages/access/model` | `src/Catalog.model.ts`, `src/Access.model.ts` (with the handlers Layer) |
| `.aggregate` | `model` | `src/Import/Import.aggregate.ts`, `src/Item/Item.aggregate.ts`, `src/People/Organization.aggregate.ts` |
| `.id` | `contract` (already there) | `src/Catalog.id.ts`; `packages/kernel/src/Ids.id.ts`. Tried on 2026-11-20 ([the trial](../07-review-decisions-trial.md), trial 3): an id and a value schema imported by package name are read; a request context imported that way is not. Upstream imports ids relatively. |
| `.command` (`Domain.Command` + its events + its rejections) | `model` | `src/Import/ConfirmImport.command.ts`, `src/Item/EditItem.command.ts`. Either accept two meanings of `.command.ts` (payloads in `contract`, `Domain.Command`s in `model`), or rename one side: a choice for the owner. |
| `.rejection` (shared) | `model`, or reuse `contract`'s tagged errors | `src/Import/ImportNotOpen.rejection.ts`. A rejection imported from `contract` by package name runs, but the prover on main does not read it (next section). |
| `.decision` (main only) | `model` | `src/Import/Confirm.decision.ts` |
| `.view` | `model` | `src/Import/ImportResult.view.ts` |
| `.query` | `model`; its store port beside it, its adapter in `host` | `src/Item/ItemsPage.query.ts` + `src/Item/ItemStore.store.ts`; `host/src/ItemStore.adapter.ts` |
| `.projection` | `model`; adapter in `host` | `src/Item/ItemSearch.projection.ts`; `host/src/ItemSearch.adapter.ts` |
| `.stream` | `model` | `src/Activity/ActivityLog.stream.ts` (access) |
| `.policy` | `model` (with its `Live` when it touches no infrastructure) | `src/Import/ReviewOnUpload.policy.ts` |
| `.saga` | `model` | `src/Import/BringInFile.saga.ts` |
| `.external` | `model` (declaration, as today); adapter in `host` | `src/Answer/Answerer.external.ts`; `host/src/Answerer.adapter.ts` |
| `.api` | `model` | `src/Catalog.api.ts`; its HTTP surface stays in `host/src/Catalog.http.ts` |
| `.middleware` | each model's package (declaration, reached by a relative path); `access/host` (implementation) | `catalog/model/src/Session.middleware.ts`; `access/host/src/SessionIdentity.adapter.ts`. The kernel's `Identity.middleware.ts` stays for `/api/v1` |
| `.context` | each model's package, reached by a relative path | `catalog/model/src/Actor.context.ts`, `access/model/src/Actor.context.ts`; the kernel's `Actor.context.ts` stays for `/api/v1` |
| stories and the declaration's test (its Layer built, at the pin) | `model/test` | `test/Catalog.story.test.ts`, `test/Catalog.model.test.ts` |
| hosting (the Worker) | `host` + the app | `catalog/host/src/Host.ts`, `apps/inventory/src/server/App.ts`, `worker.ts` |

### Where the blocks may live: what the prover on main needs

The table above is enough to run a model, on beta.87 or on main: nothing at run time reads source files. Proving an
aggregate on main adds one constraint. The prover follows relative imports only, so the aggregate's file must reach,
by relative paths inside one package: its commands, events and rejections, and every helper its `decide`, `evolve`,
invariants and transitions call. In this app's split that rules out one arrangement that looks natural: commands,
events and rejections in `contract` (beside today's payload schemas), imported into `model` as
`@inventory/catalog-contract/...`. It also catches today's rules: `review` in
`packages/catalog/model/src/Review/Review.rules.ts` calls helpers it imports from `@inventory/catalog-contract` by
package name (`suggestionFits`, `matchedColumn`, `typedChange`; lines 21-63), so an aggregate whose `decide` called
`review` would not be fully read. Whether the prover can model `review` at all was not tried.

The choices, none picked here (the owner decides):

1. **The aggregate with its commands, events, rejections and helpers in one package that both the server and the
   browser import, as upstream does.** Under today's boundary law (`contextMay`,
   `packages/tooling/tool/cli/src/commands/Laws/Boundaries.rules.ts:94-106`) that package can be either:
   - the context's `model`, which `host` and `web` may already import (both list `@inventory/catalog-model` today).
     Touches `packages/<context>/model` (gains the blocks and the helpers they call, moved or copied out of
     `contract`), `packages/<context>/web` and `packages/<context>/host` (import the commands from `model`), and
     `packages/<context>/contract` (keeps only what the `HttpApi` contract still needs);
   - or the context's `contract`, which every layer may import. Touches `packages/<context>/contract` (gains the
     aggregates, their rules and helpers, which live in `model` today) and `packages/<context>/model` (loses them).
     `contract` may import only `@inventory/kernel` among workspace packages, and a kernel helper imported by package
     name would not be read either.
2. **The blocks live with the aggregate in `model`, and `contract` re-exports them** for the wire and the browser.
   Touches `packages/<context>/contract`, `packages/<context>/model` and the boundary law: `contextMay` lets
   `contract` import only `kernel`, and `model` imports `contract` today (`packages/catalog/model/package.json:47`),
   so a re-export from `model` would also be a package cycle until `model` stops importing `contract`.
3. **Upstream changes the prover to follow package imports** (`Prove/internal/Source.ts:228-230` on main). Touches no
   package of the app: blocks could stay in `contract` and the aggregate in `model`. It is not on main today.

- **Used today:** partly. The four-package split, kind-suffixed file names, ports in `model` with adapters in `host`,
  and an Alchemy stack (`packages/infra/src/Inventory.stack.ts`) already exist; no `Domain.*` block does.
- **Where it goes:** the tables above; the first file would be `packages/catalog/model/src/Catalog.model.ts`.
- **What the person gets:** nothing they can see.

## How to check it

- `bun run boundaries:check` (the app's boundary law) refuses a `model` file that imports a `host` or a driver.
- A test in `packages/catalog/model/test` that builds `Catalog`'s Layer on `InMemory` (at the pin `734c27a`;
  `Domain.verify(Catalog)` at `dbfd0dd`) shows the model package holds a complete model without a host (see
  [model](./model.md)).
- A story test that runs on `Domain.InMemory` with no D1 proves the model package needs no infrastructure (see
  [story](./story.md)).
- On main, `Verify.aggregate(X)` for each aggregate, one aggregate name per test file, proves the blocks are where the
  prover can read them: a block or helper it cannot reach makes the report say what it could not read (see
  [verify](./verify.md)). In the trial on 2026-11-19, blocks imported relatively from other files of
  the same package were read and every rule proved; the same blocks imported by package name were not read.

## What it needs

Nothing to install. Applies to beta.87 and main alike; `.decision` and the prover's relative-import constraint are
main's. A change to the app's boundary law is needed only for choice 2 above.

## Verdict

**Use:** name every `Domain.*` file `<Noun>.<kind>.ts`, keep port adapters in `host`, and settle the `.command.ts`
collision before the first command is written. Where an aggregate's commands, events, rejections and helpers live
(choice 1, 2 or 3 above) is the owner's decision; on main, any aggregate that is to be proved needs them reachable
from its file by relative imports.

## Where this was read

- https://alchemy.run/domain/project-layout (the live site documents beta.87)
- `website/src/content/docs/domain/project-layout.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/skills/alchemy-domain/SKILL.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/skills/alchemy-domain/references/layout.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/skills/alchemy-domain/references/modeling.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Rejection.ts:33` at `v2.0.0-beta.87`
- `packages/domain/src/Prove/internal/Source.ts` on `main@dbfd0ddb`: new (the part cited)
- `examples/cloudflare-domain/packages/domain/src/Account/Account.aggregate.ts` on `main@dbfd0ddb` (its imports)
- The app: `packages/*/*/package.json`, `packages/tooling/tool/cli/src/commands/Laws/Boundaries.rules.ts`, the file
  names under `packages/*/*/src` and `packages/kernel/src`, the imports of
  `packages/catalog/model/src/Review/Review.rules.ts`, `tsconfig.base.json`, `apps/inventory/src/server`,
  `alchemy.run.ts`
