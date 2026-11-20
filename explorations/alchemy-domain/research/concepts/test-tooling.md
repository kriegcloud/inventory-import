---
type: Reference
title: Test tooling
description: What Alchemy gives for testing beyond stories (the @alchemy.run/test harness for deployed stacks and providers, the domain's Api tests, Verify, the platform conformance suite), which parts run under Vitest on Node, and the four layers of test this app would have.
tags: [alchemy-domain, checking]
---

# Test tooling

Alchemy has three kinds of test tooling around a domain model. The first is `@alchemy.run/test` (folder
`packages/alchemy-test`), a harness that deploys a real Alchemy stack once per test file, hands the tests its outputs
(a URL, ids), and destroys it after; it also tests a provider's create / update / replace / delete on a scratch
stack. Its docs put it this way: "Alchemy tests run against real clouds by default — no mocks."
[https://alchemy.run/testing] The second is the domain's own Api tests: the model hosted in memory and called through
an [Api](./api.md)'s typed client, in process, over HTTP or against a deployment. The third is the conformance suite
on main, the cases every [host](./platform-contract.md) runs to show it hosts a model correctly. Under all three sit
[stories](./story.md), which check the model's rules by example, and, on main, [Verify](./verify.md), which proves
them for every state.

## When to reach for it

- **Stories** for the model's rules: one example per rule, in memory, in milliseconds. See [story.md](./story.md).
- **Verify** (main) for the same rules proved for every state and input. See [verify.md](./verify.md).
- **Api tests in memory** for what a client may do and see: sign-in middleware, roles, refusals, live reads.
- **`@alchemy.run/test`** for one end-to-end flow against the deployed stack (or its local `dev: true` copy), and
  for testing a custom provider.
- **The conformance suite** only when building or changing a host. An app does not run it.
- **None of them** for SQL behaviour: unique indexes, full-text search, foreign keys, query plans. Those stay in the
  app's own slow tests on a real D1.

## How it is declared

`@alchemy.run/test`, one adapter per runner, the same API on each:

```ts
// SKETCH: not compiled
import * as Test from "@alchemy.run/test/Vitest" // or "@alchemy.run/test/Bun", "@alchemy.run/test/Alchemy"
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Effect from "effect/Effect"
import { expect } from "@effect/vitest"
import Stack from "../alchemy.run.ts"

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers: Cloudflare.providers(),
  dev: true // workerd and local D1 instead of the cloud
})

const stack = beforeAll(deploy(Stack)) // runs once; `yield* stack` in a test reads its outputs
afterAll(destroy(Stack))

test("the Worker answers", Effect.gen(function* () {
  const { url } = yield* stack
  const response = yield* Test.getWhenReady(`${url}/api/v1/system/status`)
  expect(response.status).toBe(200)
}), { timeout: 60_000 })
```

What the package holds at beta.87 (every file of `packages/alchemy-test` is the same on main):

- **Name and entry points.** Published as `@alchemy.run/test`, version `2.0.0-beta.87`, with a bin `alchemy-test`
  (`packages/alchemy-test/package.json` 2-3, 24-26). The root export is the registration API (`describe`, `it`,
  `test`, hooks, `layer`) and a dependency-free `expect` (`src/index.ts` 9-58). The adapters are subpaths through
  `"./*"`: `/Alchemy`, `/Bun`, `/Vitest`. Published, each subpath resolves to `src/*.ts` under the `bun` condition and
  to compiled `lib/*.js` otherwise, so Node loads JavaScript (`package.json` 52-71).
- **What runs under Vitest on Node, and what needs Bun.** The package declares `"engines": { "bun": ">=1.3" }` and a
  dependency on `@effect/platform-bun` (`package.json` 73-75, 106-108), but only some of it uses Bun:

  | Part | Under Vitest on Node | Why |
  | --- | --- | --- |
  | `/Vitest` and what it imports (`Core.ts`, `Http.ts`) | Runs | Names no Bun API |
  | `dev: true` and its sidecar | Runs | The sidecar child runs on `process.execPath` under Node (alchemy 2.0.0-beta.87 `src/Local/RpcSpawner.ts` 124-130) |
  | Root `expect`, `assert` | Runs | No dependency on the registry (`src/Expect.ts` 683-763) |
  | Root `describe`, `it`, `test`, hooks, `layer` | Throws | Each throws unless the `alchemy-test` runner collects the file (`src/Registry.ts` 60-69); a Vitest file takes them from `vitest` or `@effect/vitest` |
  | `/Bun` | Needs Bun | Imports `bun:test` (`src/Bun.ts` 1) |
  | `/DevCli` | Needs Bun | `Bun.sleep`, and spawns `bun <alchemy.js> dev` (`src/DevCli.ts` 31, 61, 184) |
  | The `alchemy-test` binary (its reporters, TUI, worktree stage, durable scratch state) | Needs Bun | `#!/usr/bin/env bun` (`bin/alchemy-test.ts` 1), `BunRuntime` (`src/cli.ts` 23-24), `Bun.spawn`, `Bun.inspect` (`src/StrayOutput.ts` 132, 228-267; `src/Tui.ts` 365) |

  Peers: `effect` is required; `vitest`, `@effect/vitest` and `alchemy` are optional (`package.json` 85-105), but
  `Core.ts` imports `alchemy/*` modules throughout (`src/Core.ts` 2-34), so `alchemy` must be installed. This app
  already has `alchemy` 2.0.0-beta.87, `@effect/platform-node`, `vitest` 5.1.0 and `@effect/vitest` 4.1.4.
- **`Test.make(options)`** returns `{ test, beforeAll, beforeEach, afterAll, afterEach, deploy, destroy }`
  (`src/Vitest.ts` 86-97, 106). Options (`src/Core.ts` 51-127): `providers` (required), `state` (default
  `localState()`), `profile`, `limit` (a counted lock shared across files), `stage`, `adopt` (default `false`), `dev`,
  `sidecar` (default: the resolved `dev`), `dotAlchemy` (where `.alchemy` goes: logs, local state). The docs list seven
  of these; `limit` and `dotAlchemy` are only in the source.
- **What `deploy` does.** The harness bundles nothing itself. `deploy(Stack, options?)` calls alchemy's own deploy
  with the stack, the stage, `dev`, the file's shared scope, and `force`, `include` and `exclude` (`src/Core.ts`
  694-707), so the Worker is built by the stack's own providers, as `alchemy deploy` builds it. It answers the stack's
  outputs (`DeployResult`, `Core.ts` 659-663); a filtered deploy (`include` or `exclude`) answers nothing
  (`Core.ts` 671). `destroy(Stack)` takes no `include` or `exclude` (`Core.ts` 724-736). The `providers` option is not
  used by `deploy`; it serves only `test.provider` (`Core.ts` 615-642, 845, 862, 890).
- **What a test has in scope.** A plain `test` gets the config provider, the state store, the credential stores, the
  platform services and a fetch `HttpClient` (`Core.ts` 450-456, 558-600). It does not get the `providers` layer,
  although the docs' table says it does (`website/src/content/docs/testing/test-harness.mdx` 27): calls to a
  provider's SDK belong in `test.provider`, which provides it (`Core.ts` 615-642).
- **Stage.** `ALCHEMY_TEST_STAGE`, else `test_$USER` (`Core.ts` 188-189). A stage passed to `make` or to one `deploy`
  wins.
- **Local mode.** `dev` resolves as `ALCHEMY_TEST_DEV`, then the option, then `ALCHEMY_DEV` (`Core.ts` 166-171). With
  `dev` on, `sidecar` defaults to on: local providers run in one child process forked on the first local deploy and
  shared by every file of the process, as under `alchemy dev` (`Core.ts` 89-119, 173-175, 205-216).
  `sidecar: { omitEnv: ["CLOUDFLARE_"] }` withholds variables from the child. `sidecar: false` runs local providers in
  the test process; the source warns that this hides bugs such as D1's local migrations failing only under
  `alchemy dev` (`Core.ts` 96-103). `ALCHEMY_TEST_DEV=1` also loads every provider's emulators and sets
  `NODE_TLS_REJECT_UNAUTHORIZED=0` for the whole process (`Core.ts` 378-448).
- **Hooks and timeouts.** `beforeAll` runs once and returns a lazy accessor. On Vitest only `beforeAll` and `afterAll`
  default to 120 s (`Vitest.ts` 99, 179, 189, 193); `beforeEach`, `afterEach` and every `test` get Vitest's
  configured timeout unless given one as a number or `{ timeout }` (`Vitest.ts` 33-36, 120, 185, 197), so a test that
  does real work needs its own. `afterAll.skipIf(predicate)` registers nothing when the predicate is true
  (`Vitest.ts` 191-194). On Vitest every `test` is an `@effect/vitest` `it.live` (`Vitest.ts` 119-121), so it runs on
  the real clock.
- **`test.provider(name, (stack) => effect)`** gives a scratch stack with its own state: in memory on Vitest and Bun,
  durable under `.alchemy/state` on the `alchemy-test` runner (`Core.ts` 757-826). On Vitest and on the runner the
  body always ends with `stack.destroy()`, even on failure (`Vitest.ts` 154-156, `Alchemy.ts` 220-223); on Bun it
  does not (`Bun.ts` 162-174).
- **HTTP helpers.** `getWhenReady(url)` and `executeWhenReady(request)` retry only 404 and 5xx, 20 times by default,
  with a delay that starts at 500 ms and doubles with no cap, failing with `WorkerNotReady` (`src/Http.ts` 27, 35,
  48-77; `Schedule.max` waits the longer of its schedules, `effect` 4.1.4 `src/Schedule.ts` 764). Twenty doublings
  outlast any test, so the test's timeout is the real bound. `guardContentType`, `guardedFetchLayer` and
  `rpcClientLayer` turn an edge HTML page into a typed error and retry it, 5 times with the delay capped at 3 s
  (`Http.ts` 94-97, 116-201). Each adapter re-exports these, so `Test.getWhenReady` works from `/Vitest`
  (`Vitest.ts` 16-25).

**Modules of `@alchemy.run/test`** (all of `packages/alchemy-test/src` at beta.87, the same on main). The adapters are
what a test file imports; the rest serve the `alchemy-test` binary or are internal to it.

| File | What it is | Exported names |
| --- | --- | --- |
| `index.ts` | The root entry: registration API and `expect`, safe to bundle (`src/index.ts` 9-58). Only `expect` and `assert` work outside the `alchemy-test` runner | re-exports most of `Api.ts` and `Expect.ts`, `currentFile` from `Registry.ts`, and the types of `Tags.ts` and `Model.ts` |
| `Vitest.ts`, `Bun.ts`, `Alchemy.ts` | The adapters, one per runner, the same shape | `MakeOptions`, `ScratchStack`, `TestEffect`, `TestApi`, `make`, `defaultStage`, `resolveStage` (Alchemy also `ALCHEMY_TEST_DEV`, `resolveDev`, `captureResourceLog`; on Vitest `captureResourceLog` is reachable as `@alchemy.run/test/Core`) |
| `Core.ts` | What the adapters share: options, stage, dev and sidecar, deploy and destroy, scratch stacks | `MakeOptions`, `SidecarOptions`, `sidecarProxy`, `ALCHEMY_TEST_DEV`, `alchemyTestDevOverride`, `resolveDev`, `resolveSidecar`, `defaultStage`, `resolveStage`, `SidecarHandle`, `sidecarDiagnostics`, `makeSidecarHandle`, `TestEffect`, `captureResourceLog` (what one resource logs, from before its deploy), `toEffect`, `run`, `withProviders`, `DeployCallOptions`, `DeployResult`, `FilteredDeployCallOptions`, `Deploy`, `deploy`, `makeDeploy`, `destroy`, `ScratchStack`, `scratchStack` |
| `Http.ts` | Retrying the first requests to a fresh deployment | `WorkerNotReady`, `WhenReadyOptions`, `executeWhenReady`, `getWhenReady`, `EdgeGuardOptions`, `guardContentType`, `guardedFetchLayer`, `rpcClientLayer` |
| `DevCli.ts` | Driving the `alchemy dev` command from a test (its own export `./DevCli`; needs Bun) | `PollOptions`, `pollUntil`, `fetchOk`, `DevCliOptions`, `parseOutputUrl`, `parseOutputValue`, `DevCli`, `forwardSignals` |
| `Api.ts` | The vitest-like registration API, re-exported by `index.ts` | `TestOptions`, `timeoutOf`, `retryOf`, `exclusiveOf`, `tagsOf`, `optInTagsOf`, `DescribeOptions`, `DescribeFn`, `describe`, `RegisterTestOptions`, `registerTest`, `TestContext`, `EffectTestFunction`, `Tester`, `makeTester`, `TestFn`, `it`, `test`, `HookKind`, `registerFileCleanup`, `registerHook`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`, `LayerMethods`, `layer` |
| `Expect.ts` | A dependency-free `expect` with vitest's matchers | `AssertionError`, `stringify`, `equals`, `Matchers`, `PromiseMatchers`, `Expect`, `expect`, `Assert`, `assert` |
| `Model.ts`, `Registry.ts`, `Tags.ts`, `TestState.ts` (internal, apart from the types and `currentFile` the root re-exports) | The tree of suites and tests a file registers, per-file collection, tags and filters, run state | `Mode`, `LogEntry`, `TestBody`, `HookBody`, `Limit`, `Exclusive`, `Hook`, `TestCase`, `Suite`, `FileSuite`, `makeSuite`, `makeFileSuite`, `titlePath`, `fullTitle`, `forEachTest`, `containsOnly`; `collect`, `currentSuite`, `currentFileSuite`, `currentFile`, `withSuite`; `TestTags`, `TestTag`, `Tags`, `mergeTags`, `TagsFilter`, `compileTagsFilter`; `state`, `defaultState` |
| `Runner.ts`, `cli.ts`, `Plan.ts` (internal) | The `alchemy-test` binary: discover files, run them in one process, a plan preview | `RunOptions`, `discover`, `CollectedFile`, `run`; (`cli.ts` exports nothing); `TestPlan`, `parsePlan`, `formatPlanPreview` |
| `Reporter.ts`, `PlainReporter.ts`, `Tui.ts`, `FileLog.ts`, `Capture.ts`, `StrayOutput.ts` (internal) | Reporting: events, a line reporter for CI, a terminal UI, one log per run at `.alchemy/log/test/<timestamp>-pid<pid>.log` (logs older than seven days are deleted; `cli.ts` 245-252, `FileLog.ts` 92-122), output capture | `TestStatus`, `TestMeta`, `TestResult`, `RunSummary`, `TestEvent`, `RunController`, `ReporterService`, `Reporter`; `printSummary`, `PlainReporterLive`; `TuiReporter`; `formatEvent`, `FileLog`, `makeFileLog`; `makeCapture`; `writeDirect`, `captureStrayOutput` |
| `WorktreeStage.ts` (internal) | The stage name for a linked git worktree | `worktreeName`, `worktreeStage` |

The domain's own Api tests (docs page "Testing an Api") use only `@alchemy.run/domain` and Effect:

```ts
// SKETCH: not compiled. In process: the model on the in-memory platform, called through the Api's real middleware.
const World = Catalog.layer(CatalogHandlers).pipe(Layer.provide(Layer.mergeAll(Ports, Domain.InMemory)))
const asMarcus = CatalogApi.clientInProcess.pipe(Effect.provide(signedInAs(marcus)))
```

- `Api.clientInProcess` and `Api.layerClientInProcess` serve the Api in the caller's process through the middleware
  of everything it serves (`packages/domain/src/Api.ts` 434-445, 1118-1119, doc 1189-1201). `Api.client` takes a
  protocol: `Domain.protocolHttp`, `Domain.protocolWebSocket` or the in-process one (`Api.ts` 389-397, 1272, 1331).
- Over HTTP, the docs serve the Api's `fetch` on `NodeHttpServer.layerTest` and call it with
  `Domain.protocolHttp("")` (`website/src/content/docs/domain/testing-apis.mdx` 131-191).
- Against a deployment, the example deploys with `@alchemy.run/test/Bun` and signs in through its own route
  (`testing-apis.mdx` 193-240; `examples/cloudflare-domain/test/integ.test.ts`).

The conformance suite (main only) is a function, `conformance({ test, url, kind, within? })`, that registers the same
cases against a front serving a fixed model over HTTP (`packages/integration-tests/test/Domain/conformance/conformance.ts`
23-31, 88). The model has an aggregate that rejects, a view, a projection fed by the view, a policy that starts a saga,
a saga that writes to another aggregate, a policy that schedules and cancels a command, a decision across two
instances, a view that refuses every reader and a command that dies (`conformance/model.ts` 1-8). The cases
(`conformance.ts` 101-430): a command commits and replies; a live read is pushed over a WebSocket; a refused read looks
the same with and without history; a refused live read carries nothing of the key's state; a defect reaches the client
as a generic error; a rejected command commits nothing; a command sent twice under one id commits once; a view lists a
page at a time in either order; commands to one instance run one at a time; a decision commits to every instance it
reads, commits nothing when rejected, commits once when sent twice, runs one at a time with decisions that share
instances, and is served by an Api with no target; a view applies every event once, in order; `caughtUp` waits for a
projection fed by a view; a policy starts a saga and its step commits; a scheduled command runs when due; a cancelled
command never runs. Callers on main: Cloudflare live and local (`test/Cloudflare/Domain/Conformance.test.ts`,
`Conformance.local.test.ts`), Cloudflare workflow engines, Rivet (`test/Rivet/Domain.test.ts`), Effect Cluster
(`test/Cluster/Domain.test.ts`) and an AWS Lambda workflow function. The Cloudflare files deploy the front with
`@alchemy.run/test`'s `deploy`; how the others start their front is not verified.

Checked in: the files above at beta.87; `packages/domain/src/index.ts` 284-285 (`Domain.verify`), 294 (`InMemory`).

### What main changes

- `packages/alchemy-test/src` and its `package.json` are the same on main (no file differs).
- The testing docs under `website/src/content/docs/testing/` are the same on main.
- `testing-apis.mdx` on main: a command's client call takes one input object that names its instance
  (`support.ChangeOwner({ accountId, customerId })` in place of `support.ChangeOwner(accountId, { customerId })`),
  lines 119 and 181. The example's server tests change the same way, and a receipt gains `commits`
  (`examples/cloudflare-domain/packages/server/test/CustomerApi.test.ts` on main, around 50-56).
- The conformance suite exists only on main: `packages/integration-tests/test/Domain/conformance/` (`conformance.ts`,
  `model.ts`, `app.ts`, `latency*.ts`). The beta.87 export has no `integration-tests` package.
- The skill's `references/testing.md` on main adds `Verify` rules ([verify.md](./verify.md)).
- The one-input-object call shape and `commits` on a receipt came with pull request 3420 (commit `dbda8cc16`), which
  removed a command's `target`. The conformance suite's own commit is not known; its `caughtUp` case for a projection
  fed by a view came with pull request 3380 (commit `ca7535707`).
- `Verify`, `Prove` and `Explore` (pull request 3260, commit `e4adb720c`) add a fourth kind of test: rules proved or
  searched in a Vitest test on Node ([verify.md](./verify.md)).

## Rules, and the mistakes to avoid

- **Runner.** The example's own integration test says that deploying a Worker from Vitest does not yet produce a
  correct bundle, because the Worker's Effect entry point is not detected under Vite's transform, and runs under
  `bun test` (`examples/cloudflare-domain/test/integ.test.ts` 8-9 at both refs). The harness has no part in that: the
  bundle comes from the stack's providers. This app's Worker is deployed with `Cloudflare.Website.Vite`
  (`packages/infra/src/Inventory.stack.ts` 102), a Vite build, not the example's Effect entry point; whether it
  bundles correctly when the deploy runs inside Vitest is not verified. This app runs every test in Vitest on Node
  and never `bun test` (`CLAUDE.md` "Commands").
- **One flow, not the rules.** The skill keeps the deployed test to one end-to-end flow; stories carry behaviour
  (`packages/domain/skills/alchemy-domain/references/testing.md` 199-203).
- **Retry only the cold start.** Use `getWhenReady` for the first request to a fresh URL; it does not retry 400, 401
  or 403, so refusals are seen at once. Poll asynchronous work with a bounded `Effect.repeat`, never a deadline loop
  (`website/src/content/docs/testing/testing-a-stack.mdx` 112-158).
- **Durable Objects after a deploy.** A Durable Object can answer with the placeholder script right after a deploy,
  and one kept busy through a redeploy can serve the old code for up to five minutes. The domain example retries its
  first read while the error is `RpcClientError` (`examples/cloudflare-domain/test/integ.test.ts` 93-101 on main); the
  docs advise `codeUpdateStrategy: { mode: "immediate" }` on test stages (`testing-a-stack.mdx` 140).
- **State and teardown on Vitest.** Every hook and test of a file shares one scope; `destroy(Stack)` closes it, and a
  cleanup hook closes it anyway after the last `afterAll`, in either `sequence.hooks` order (`Vitest.ts` 106-117,
  200-237). The default state is `localState()` on disk, so a stack kept with `afterAll.skipIf(...)` is reused on the
  next run; the domain example starts clean with `beforeAll(destroy(Stack).pipe(Effect.andThen(deploy(Stack))))`
  (`integ.test.ts` 38 on main). `test.provider` on Vitest keeps its scratch state in memory, so a run killed during a
  destroy orphans what it was deleting; only the runner keeps it on disk to resume (`Core.ts` 757-826).
- **The worktree stage is the runner's, not Vitest's.** In a linked git worktree the `alchemy-test` binary picks
  `test_$USER_<worktree>` (`cli.ts` 226-236, `WorktreeStage.ts` 31-45). Under Vitest the default stays `test_$USER`,
  so two worktrees of this repository share one stage unless `ALCHEMY_TEST_STAGE` or `stage` is set.
- **Bun does not guarantee teardown, Vitest does not interrupt early.** Only the Bun adapter interrupts a test 5 s
  before its timeout, so the deploy's state records what it created before `afterAll` destroys it (`Bun.ts` 97-112);
  on Vitest set timeouts generous enough that a deploy finishes.
- **The docs and the source disagree twice.** `Http.ts` 81-83 says to pass `Test.make({ http: { ... } })`;
  `MakeOptions` has no `http` field (`Core.ts` 51-127), so pass the options per call site. And the providers layer is
  not in a plain `test`'s scope (above).
- **A fake must not drift.** Run one set of tests against every adapter of a port, the vendor's and the in-memory one
  (`website/src/content/docs/domain/testing-models.mdx` 183-216). This app already does it for imports:
  `apps/inventory/test/server/ImportsTwin.test.ts` holds the twins to the numbers D1 gives.
- **Conformance is the host's test, not the app's.** It needs a front serving `app.ts` over the conformance model;
  an app cannot point it at its own model.

## In this app

The four layers of test, and where each would live:

| Layer | What it proves | Runs on | Where |
| --- | --- | --- | --- |
| 1. Stories of the model | The rules of one import, one item edit, one person change: what is recorded or refused | `Story.make`, its own in-memory platform, Vitest on Node | `packages/catalog/model/test/*.story.test.ts`, beside `Endpoints.test.ts` |
| 2. Api tests through the typed client | Who may do what: a viewer cannot confirm, another organization sees nothing, a refusal's words | `CatalogApi.clientInProcess` over `Domain.InMemory`, with the real identity middleware | `apps/inventory/test/server/*.test.ts` (fast) |
| 3. Slow tests | The D1 adapters and the Worker: SQL, batches, indexes, sign-in | A real local D1 (`@beep/d1/D1Test`, wrangler's platform proxy) and the Worker's own `fetch` | `apps/inventory/test/server/*.slow.test.ts` |
| 4. Verify (main) | Each aggregate's invariants and transitions for every state and input; model rules in every short sequence | `Verify.aggregate`, `Verify.model` in an `it.effect` with `NodeServices.layer`, Vitest on Node | `packages/catalog/model/test/*.verify.test.ts` |

Layer 4 runs today from main, under Vitest on Node: in a trial on 2026-11-19 a model of this app was proved that way
(19 rules). It takes `@alchemy.run/domain` from main, `z3-solver` and `oxc-parser`, blocks built with `new` inside
`decide`, and an aggregate's blocks reachable by relative imports ([verify.md](./verify.md)).

A layer-2 test in this app's terms, once the catalog is served as a Domain Api:

```ts
// SKETCH: not compiled. beta.87 call shape (`target` first); on main the call takes one input object,
// `ConfirmImport({ importId, reviewed: 2 })`. CatalogApi, Catalog and CatalogHandlers do not exist yet.
it.live("a viewer cannot confirm, and another organization sees no items", () =>
  Effect.gen(function* () {
    const priyaApi = yield* CatalogApi.clientInProcess.pipe(Effect.provide(actingAs(priya)))
    const elenaApi = yield* CatalogApi.clientInProcess.pipe(Effect.provide(actingAs(elena)))
    const refused = yield* priyaApi.ConfirmImport(importId, { reviewed: 2 }).pipe(Effect.flip)
    expect(refused._tag).toBe("Forbidden")
    expect(yield* elenaApi.ItemsPage.get(org)).toBeNull()
  }).pipe(Effect.scoped, Effect.provide(World)))
```

The docs serve the Api over HTTP with `NodeHttpServer`. This app does not use `node:http`; its HTTP tests already
call the Worker's own `fetch` (`send`, `apps/inventory/test/server/support/app.ts`), and that stays the way to test
the wire.

What none of the upstream tools can prove, because the in-memory host runs no SQL and a story never touches D1:

- the unique index `(organizationId, skuKey)` and `ON CONFLICT DO NOTHING` that make a second load add nothing
  (`apps/inventory/migrations/0001_init.sql` 258-297);
- the FTS5 trigram `itemSearch` index and the triggers that keep it (migration 445-458), which the Items page search
  depends on;
- the tenancy keys `(organizationId, id)` that refuse a cross-organization row
  (`apps/inventory/test/server/Tenancy.slow.test.ts`);
- the take-back's revision checks written in SQL today (`packages/catalog/host/src/ImportStore.adapter.ts` 1124-1196);
- query plans (`apps/inventory/test/server/QueryPlans.test.ts`) and D1's limits (100 bound parameters, no
  interactive transactions).

What a deploy test of a Worker that hosts a domain model can reach: only what the outside can. `yield* stack` gives
the stack's outputs (a URL, ids), never a binding (`Core.ts` 659-663), so a test cannot read D1 or call a Durable
Object directly. It can call the Worker with the harness's `HttpClient`, or build the Api's typed client against the
deployed URL: `Domain.protocolHttp` for commands and reads, `Domain.protocolWebSocket` for live reads. The domain
example builds it with `Domain.protocolWebSocket(`${url}/api`)`, `FetchHttpClient.layer` and a `WebSocket`
constructor that sends an `Authorization` header, which its comment says Bun's `WebSocket` accepts
(`examples/cloudflare-domain/test/integ.test.ts` 52-74 on main). Whether Node's `WebSocket` can carry such a header
is not verified, and this app signs in with a session cookie (`packages/access/host/src/internal/authOptions.ts`).

- **Used today:** no. The app uses `@effect/vitest` with its own twins (`packages/catalog/model/test/support.ts`,
  `@inventory/catalog-model/Memory`) and a real local D1 (`@beep/d1/D1Test`). `packages/infra` depends on
  `alchemy` beta.87 and `@alchemy.run/cloudflare` but not on `@alchemy.run/test`.
- **Where it goes:** stories and Verify in `packages/catalog/model/test/`; Api tests in `apps/inventory/test/server/`;
  a single deploy test of the `packages/infra` stack with `dev: true` in `packages/infra/test/`, once a deploy of
  `Cloudflare.Website.Vite` from inside Vitest is shown to bundle the Worker.
- **What the person gets:** nothing they can see.

## How to check it

- Layer 1: the story itself, with one `then` removed to see it fail ([story.md](./story.md)). Run in a trial on
  2026-11-19: stories of a model of this app passed on beta.87 (`Story.when(ref, command)`) and on main
  (`Story.when(command)` with `Story.provide(CurrentActor, value)`), and a story that left an event unasserted failed
  with "committed events no step asserts".
- Layer 2: a refusal test per role, and one test that a second organization sees nothing.
- Layer 3: the existing `Imports.slow.test.ts`, `TakeBack.slow.test.ts` and `Tenancy.slow.test.ts` keep running;
  `ImportsTwin.test.ts` keeps the twins honest. A deploy test, if added, asserts one flow with `getWhenReady` first
  and its own timeout.
- Layer 4, on main: `Verify.aggregate` per aggregate and `Verify.model` per model. In the same trial they proved 19
  of this app's rules, and a deliberately broken `evolve` failed with `NotVerified` naming the rule, the command and
  the shortest sequence ([verify.md](./verify.md), [prove.md](./prove.md)).
- Under `it.effect` the console is Effect's test console (`@effect/vitest` 4.1.4, the version the app installs,
  `src/internal/internal.ts:68`, `:490`), so a report a test prints with Effect's `Console` does not show in Vitest's
  output; `it.live`, which `@alchemy.run/test/Vitest` uses for every `test`, does not swap it (`:491`).
- `Domain.verify(Catalog)` returning `[]` checks the declaration (`packages/domain/src/index.ts` 284-285). Run in the
  trial on beta.87: `Domain.verify(Inventory)` answered `[]` for a one-aggregate model.

## What it needs

- Stories and in-process Api tests: `@alchemy.run/domain` (beta.87 or main), `effect` 4.1.4, Vitest and
  `@effect/vitest`. The in-memory host only. Stories were run on both (Vitest 5.1 on beta.87, 5.0.4 on main); the
  in-process Api tests were not run.
- Verify: main only, Node (not Bun), `z3-solver` and `oxc-parser`, as [verify.md](./verify.md) says.
- A deploy test: `@alchemy.run/test` beta.87 as a dev dependency, used through `/Vitest` only (the root registration
  API, `/Bun`, `/DevCli` and the binary need Bun); the `packages/infra` stack; Cloudflare providers; and either
  `dev: true` (workerd and local D1 in a sidecar on Node) or a cloud account and a stage per run.
- The conformance suite: main only, and only for someone building a host.

## Verdict

**Use:** stories and in-process Api tests as the fast layers, `Verify` from main as the fourth (it runs under Vitest
on Node today), and the app's D1 slow tests for everything SQL decides. `@alchemy.run/test/Vitest` for at most one
deploy test of the infra stack, after checking that a deploy of `Cloudflare.Website.Vite` from inside Vitest bundles
this app's Worker (the upstream example says its Effect entry point does not yet, and this app cannot use `bun test`).

## Where this was read

- https://alchemy.run/testing, https://alchemy.run/testing/test-harness, https://alchemy.run/testing/testing-a-stack,
  https://alchemy.run/testing/testing-providers, https://alchemy.run/domain/testing-apis (the live site documents beta.87)
- `website/src/content/docs/testing/{index,test-harness,testing-a-stack,testing-providers,observability}.mdx` at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/domain/testing-apis.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/alchemy-test/package.json`, `bin/alchemy-test.ts` and every file of `src` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: same
- `packages/domain/src/Api.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `examples/cloudflare-domain/packages/server/test/*`, `packages/web/test/*`, `test/integ.test.ts` at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (the command calls take one input object)
- `packages/integration-tests/test/Domain/conformance/*` on `main@dbfd0ddb`: new
- `alchemy` 2.0.0-beta.87 (the app's installed copy): `src/Local/RpcSpawner.ts`
- `@effect/vitest` 4.1.4 and `effect` 4.1.4 (the app's installed copies): `src/internal/internal.ts`, `src/Schedule.ts`
- A trial on 2026-11-19: stories on beta.87 and main, and `Verify` on main
