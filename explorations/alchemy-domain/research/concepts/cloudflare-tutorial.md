---
type: Reference
title: The Cloudflare tutorial, parts 3 to 5
description: What parts 3 (testing), 4 (local dev) and 5 (CI/CD) of Alchemy's Cloudflare tutorial build, the Alchemy pieces each introduces, and what the same step is in inventory-import, which already has its own form of part 5.
tags: [alchemy-domain, learning]
---

# The Cloudflare tutorial, parts 3 to 5

Alchemy's Cloudflare tutorial builds one small app in six parts: a Stack with an R2 Bucket (part 1), a Worker that
reads and writes it (part 2), tests that deploy the Stack and call the Worker over HTTP (part 3), `alchemy dev` for
local work (part 4), GitHub Actions with previews per pull request and credentials minted as code (part 5), and
traces and logs in Axiom (part 6). Parts 3 to 5 are the ones that decide how a
[Cloudflare-hosted model](./host-cloudflare.md) is tested, run locally and shipped. Part 3 opens by promising tests
that "deploy the stack, hit the live Worker over HTTP, and verify it works"
[https://alchemy.run/cloudflare/tutorial/part-3]. None of the three parts mentions `@alchemy.run/domain`; they are the
plumbing a Domain Worker sits on.

## When to reach for it

- Before hosting a model on Cloudflare: part 3 and part 4 are how a Durable Object host is tested at all, since the
  app's current tests (Vitest on Node, a local D1) never start Alchemy's Workers.
- When changing how the app deploys: compare part 5 with what the app already has.
- Not for the model itself: the domain tutorial is [tutorial.md](./tutorial.md).

## How it is declared

**Part 3, Testing.** Introduces `@alchemy.run/test`: `Test.make({ providers, state })` (from
`@alchemy.run/test/Bun` in the tutorial) returns `test`, `beforeAll`, `afterAll`, `deploy` and `destroy`.
`beforeAll(deploy(Stack))` plans and applies the Stack once and returns an accessor; `yield* stack` gives the Stack's
outputs inside each test; each test is an Effect, and `HttpClient` is provided. It also introduces `forceDestroy: true`
on an R2 Bucket (destroy empties it first) and `afterAll.skipIf(!process.env.CI)(destroy(Stack))`: the Stack stays up
locally for fast reruns and is torn down on CI.

**Part 4, Local dev.** Introduces `alchemy dev`: the same `alchemy.run.ts`, Workers running in local workerd with
reload on change, served at `http://localhost:1337` by default, with `dev: { port }` on a Worker to change it. The page
says resources such as the Bucket are created on Cloudflare while the Workers run locally, and also that local Bucket
data persists across restarts; which of the two holds for D1 is not verified here. The test harness takes `dev: true`
(or `ALCHEMY_DEV=1` when the flag is left out) to boot the Workers locally inside the test process, so one test file
runs locally on a laptop and against the cloud on CI.

**Part 5, CI/CD.** Introduces a second Stack, `stacks/github.ts`, deployed once from a laptop under an `admin`
profile: `Cloudflare.CloudflareEnvironment` (read with a double `yield*`) for the account id,
`Cloudflare.ApiToken.AccountApiToken` to mint a scoped token, and `GitHub.Secret` to store it and the account id in the
repository. A workflow then runs `alchemy deploy --stage <stage> --yes` (`pr-<n>` for a pull request, `prod` for
`main`), destroys `pr-<n>` when the pull request closes (refusing `prod`), and `GitHub.Comment` with a fixed logical
id posts the preview's address once and updates it on each push. State must be shared: `Cloudflare.state()`, which
part 1 set up (a Worker backed by a Durable Object with SQLite). An optional section mints one token per account, for
separate preview and production accounts.

Checked in (at `v2.0.0-beta.87`): `website/src/content/docs/cloudflare/tutorial/part-3.mdx` lines 13-67 (`Test.make`,
`beforeAll(deploy(Stack))`), 112-168 (HTTP assertions), 170-194 (`forceDestroy`), 196-231 (`afterAll.skipIf`);
`part-4.mdx` lines 14-40 (`alchemy dev`), 42-58 (`dev.port`), 60-101 (`dev: true`, `ALCHEMY_DEV`); `part-5.mdx` lines
21-47 (remote state), 49-87 (`admin` profile), 89-230 (the GitHub stack, `AccountApiToken`, `GitHub.Secret`), 232-306
(the workflow and stages), 308-366 (`GitHub.Comment`), 390-466 (two accounts). The Vitest form of the harness is
`packages/alchemy-test/src/Vitest.ts` (`make`, line 106); its `dev?: boolean` option is declared in
`packages/alchemy-test/src/Core.ts` line 88, which says it matches the CLI's `alchemy dev` flag.

### What main changes

Nothing. The six tutorial pages are the same on `main@dbfd0ddb`.

## Rules, and the mistakes to avoid

- A test that deploys a real stage creates real resources. Leave `destroy` to CI, as part 3 does, and give test stages
  their own names.
- `forceDestroy` deletes data on destroy. Use it only on resources that hold test data.
- Use `dev: true` or `ALCHEMY_DEV=1` locally, and the cloud on CI, from the same test file; do not hardcode `dev: true`.
- Keep the credential that mints tokens out of everyday deploys (part 5's `admin` profile). The token CI uses should
  have only the permission groups the app needs.
- `Cloudflare.state()` is needed for CI: a local state folder is invisible to a runner.
- Right after a deploy, the first requests can reach a placeholder script; a readiness probe should retry
  (see [host-cloudflare.md](./host-cloudflare.md)).
- In this repository a deploy is the owner's to run (the repository's `CLAUDE.md` and `goals/infra/PLAN.md` say no one else runs
  `alchemy deploy`, `plan` or `destroy`). A part 3 test that deploys a real stage is therefore his to start; the same
  file with `ALCHEMY_DEV=1` runs the Workers locally.

## In this app

| Tutorial step | What it builds there | What inventory-import has, or would do |
| --- | --- | --- |
| Part 3: tests that deploy the Stack | `Test.make` + `deploy(Stack)` + `HttpClient` against the live Worker | Today the slow tests start a local D1 with the real migrations (`D1Test` in `apps/inventory/test/server/support/app.ts`) and call the app's `fetch` in process; nothing deploys. Once a model is hosted on Durable Objects, add one file that deploys the app's Stack (`packages/infra/src/Inventory.stack.ts`) with `@alchemy.run/test/Vitest`'s `make`, so it runs under the app's Vitest, and checks one import end to end: the sample's 200 rows in, the result's counts, 155 items stored. |
| Part 3: `forceDestroy` | an R2 Bucket emptied on destroy | No bucket. The D1 `Database` of a test stage is the equivalent decision. |
| Part 4: `alchemy dev` | Workers in local workerd, reload on change, port 1337 | Today `bun run dev` is `vite` with the Cloudflare Vite plugin reading `apps/inventory/wrangler.jsonc`, on port 5173 (`apps/inventory/vite.config.ts` lines 143, 150). It cannot run a Domain Worker's Durable Objects; `alchemy dev` from the repository root (`alchemy.run.ts` re-exports the app's Stack) would, with the website's Vite server in front. |
| Part 4: `dev: true` in tests | the harness boots Workers locally | The file above with `dev: true` locally and the cloud on CI, by `ALCHEMY_DEV`. |
| Part 5: a GitHub stack minting tokens | `AccountApiToken` + `GitHub.Secret` | Already built, in a stricter form: `packages/infra/src/GitHub.stack.ts` mints a preview token and a production token, each in its own account (the tutorial's optional section), stores them in GitHub environments, sets variables and a branch ruleset, and is deployed only from a workstation. |
| Part 5: the deploy workflow | `pr-<n>` previews, `prod` on `main`, cleanup on close | Already built: `.github/workflows/deploy.yml` deploys `pr-<n>` previews (none for forks), destroys only a `pr-<n>` stage, and deploys `prod` after the production environment's approval. |
| Part 5: `GitHub.Comment` | the preview's address on the pull request | Not used. The Stack returns `url` among its outputs; a comment would be one resource keyed per pull request. |

Example, in this app's terms: a Domain-hosted import tested against a locally deployed stage.

```ts
// SKETCH: not compiled. apps/inventory/test/server/ImportOnDurableObjects.slow.test.ts
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare"
import * as Test from "@alchemy.run/test/Vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import Stack from "../../../../packages/infra/src/Inventory.stack.ts"

const { test, beforeAll, deploy } = Test.make({
  providers: Layer.mergeAll(Cloudflare.providers(), DomainCloudflare.providers()),
  state: Cloudflare.state()
  // no `dev` flag: ALCHEMY_DEV=1 runs it in local workerd, CI runs it on Cloudflare
})

const stage = beforeAll(deploy(Stack))

test(
  "the sample import: 200 rows, the result's counts, 155 items stored",
  Effect.gen(function* () {
    const { url } = yield* stage
    // sign in as a test account, upload the sample, confirm, read the result with the receipt as `atLeast`,
    // then page the items: the three numbers must agree
  })
)
```

- **Used today:** part 5, yes, in its own form (`packages/infra/src/GitHub.stack.ts`, `.github/workflows/deploy.yml`);
  parts 3 and 4, no (the app tests with `D1Test` and develops with `vite`).
- **Where it goes:** a slow test file under `apps/inventory/test/server/` that deploys
  `packages/infra/src/Inventory.stack.ts`; an `alchemy dev` script beside `dev` in `apps/inventory/package.json` or at
  the repository root.
- **What the person gets:** nothing they can see; the import they use is checked on the real host before it ships.

## How to check it

- Part 3's test, adapted: deploy the stage, run the sample import, and compare the three numbers.
- Part 4: the same test with `ALCHEMY_DEV=1` must pass without Cloudflare credentials for the Workers (they run
  locally). Not verified with this app's Stack, whose `InfraStage` layer reads the stage's plan.
- Part 5: the deploy workflow's preview job already proves a stage deploys; it does not yet run a test against it.
- Nothing of parts 3 to 5 was run in the trial on 2026-11-19: it deployed nothing and ran no Worker; it ran a model on
  the in-memory host only (see [host-in-memory.md](./host-in-memory.md)).

## What it needs

`alchemy` and `@alchemy.run/cloudflare` at `2.0.0-beta.87` (already in `packages/infra/package.json`), and
`@alchemy.run/test` at the same version for parts 3 and 4 (published on npm; its peers are `alchemy`
`2.0.0-beta.87`, `effect` `^4.1.4`, `vitest` `^5.0.4` and `@effect/vitest` `^4.1.4`, which the app's Vitest 5.1 and
`@effect/vitest` 4.1.4 meet). Any host; the tutorial itself uses no Domain host.

## Verdict

**Use:** take part 3 (with the Vitest harness) and part 4 when the model moves to Durable Objects; part 5 is already
done, more strictly, and only part 5's pull-request comment is missing.

## Where this was read

- https://alchemy.run/cloudflare/tutorial/part-3 , https://alchemy.run/cloudflare/tutorial/part-4 ,
  https://alchemy.run/cloudflare/tutorial/part-5 (the live site documents beta.87)
- `website/src/content/docs/cloudflare/tutorial/part-3.mdx`, `part-4.mdx`, `part-5.mdx` at `v2.0.0-beta.87`, read in
  full; `part-1.mdx`, `part-2.mdx`, `part-6.mdx` skimmed for their place; on `main@dbfd0ddb`: all six same
- `packages/alchemy-test/src/Vitest.ts` (line 106) and `packages/alchemy-test/src/Core.ts` (the `dev` option, line 88)
  at `v2.0.0-beta.87`; on `main@dbfd0ddb`: `Vitest.ts` same
- npm: `@alchemy.run/test@2.0.0-beta.87` (version and peer dependencies)
- the app: `apps/inventory/package.json`, `apps/inventory/vite.config.ts`, `apps/inventory/vitest.config.ts`,
  `apps/inventory/test/server/support/app.ts`, `packages/infra/src/Inventory.stack.ts`,
  `packages/infra/src/GitHub.stack.ts`, `.github/workflows/deploy.yml`, `alchemy.run.ts`
