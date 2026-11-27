---
type: Standard
title: Engineering targets
description: How the code is designed, tested, documented and measured, the server's rules for data, and how close development stays to production.
tags: [effect, cloudflare]
status: stable
---

My engineering rules are in `CLAUDE.md` and [patterns](../patterns.md). This page adds what they leave out.

## Working

- **It runs from the README with one command and no key**: `bun install && bun run dev`, and nothing to sign up for,
  set up or pay for. Check: on a fresh clone with no `.dev.vars`, that command reaches the first screen.
- **Look before building**: this project, a module it does not have yet, then a reference repository I named
  (`CLAUDE.md` "Use what exists before building"). Check: the write-up's reuse table names what was used.
- **Design in this order**: Schema, then the `Context.Service` contract, then the Layer, the handler and the screen.
  Commit the contract before splitting work between agents. Check: `git log` shows the contract committed before
  the first screen.
- **Commit at each working step with `bun run check` green**; never leave the app broken between commits. Check:
  CI passes on every commit pushed.
- **Check every Effect API against the Effect 4 source** (`node_modules/effect/src`) before using it; never write
  Effect 3 from memory. Check: `bun run typecheck` passes, and no import names `@effect/platform`.
- **Effect's collections, never `Map` or `Set`**, in `src` and `test`: `HashMap` and `HashSet` for a value handed on
  (React state included), `MutableHashMap` and `MutableHashSet` for one a function fills and reads. `WeakMap` and
  `WeakSet` stay where an entry must go with its key; Effect has no weak collection. A module whose download must
  hold no Effect code may keep a listener list as an array; none here does, since `main.tsx` loads Effect for the
  API client. The vendored components in `packages/ui/src/components` (`@inventory/ui`) are as published. Check: `bun run check`
  (oxlint's `no-restricted-globals` refuses `new Map(` and `new Set(`).
- **No deprecated API is used**, a library's or our own ([deprecated APIs](deprecated-apis.md)). Check: `bun run
  check` (`deprecated:check`).
- **No `try` statement**, in any code file or a doc comment's example: `Effect.try` or `Effect.tryPromise` with a
  typed `catch` inside an Effect, `Result.try` or `Option.liftThrowable` outside one, `Effect.ensuring` or
  `Effect.acquireUseRelease` for a `finally` ([no try statement](no-try.md)). `apps/inventory/public/theme-init.js`
  is the one file allowed one. Check: `bun run check` (`try:check`).
- **`bun` is the only package manager** (`bun run`, `bun install`, `bunx`). Check: `packageManager` in
  `package.json` names bun, and `bun.lock` is the only lockfile.
- **Migrations before features**, and **deployable at every commit**, deployed only when I ask. Check: `bun run
  db:reset` applies a feature's tables before its screen exists, and `bun run build` passes.

## The server

- **The API is versioned**: the HttpApi sits behind `v1`, in its folder (`src/api/v1/`) and in its path
  (`/api/v1`). Sign-in's own routes (`/api/auth/*`) are never versioned. Check: every contract path starts with it.
- **Every query and mutation has its inputs and outputs decoded by an Effect Schema** (`SqlSchema`, `Model`), never
  a type cast on a raw row. Check: no `sql<...>` result is used without a Schema.
- **Errors are values**: a failure a caller can act on is a `Schema.TaggedError` in the function's type, everything
  else a defect. Check: no `throw` and no class extending `Error` in a context's contract, model or host package, `src/api` or `src/server`.
- **Writes that must land together are one batch, and running a write twice adds nothing** (`D1Client.batch`,
  `INSERT ... ON CONFLICT ... DO NOTHING`). Check: a test sends the same write twice and finds one row.
- **Every string in a payload is bounded and every number is finite or an integer** (`Schema.isMaxLength`,
  `Schema.Finite`, `Schema.Int`). Check: no unbounded `Schema.String` in a payload.
- **Nothing the person sees is faked**: a real SQLite database (D1) with real tables, and indexes that fit the
  queries. Check: each list query's `EXPLAIN QUERY PLAN` uses an index.

## Tests

- **`@effect/vitest`**: `it.effect` with `layer(...)` for services, test layers for integration tests (the real HTTP
  contract against a test Layer), never `Effect.provide` inside the test. Check: `bun run check:full` passes.
- **Property tests from Schemas** (`it.prop` or `it.effect.prop`, which take Schemas as arbitraries) for rules that
  hold for every input: cents read from digits, a key normalised twice equals once, outcome counts add up to the
  rows. Check: at least one property test for the import's main rule.
- **Anything timed is tested on `TestClock`**, never with a real wait. Check: no `sleep` or timer in a test. Not held
  today: 28 test files wait in real time (`Effect.sleep("20 millis")`, then look), most in `packages/client/test` and
  `packages/catalog/web/test`. A wait that runs long on a busy machine lets the code's next timer fire first, so they
  fail now and then on code that is right: on two pinned cores the client package's tests failed in 1 run of 8. Until
  they run on `TestClock`, those four test runs try a failed test again, three times at most (`realTime` in
  `vitest.shared.ts`), and never a property that was falsified; without it the check pinned to four cores was red in
  two runs of three.
- **A test's limit is a guard against a hang, sized for the slowest machine that runs the check**, and is one
  decision: `vitest.shared.ts` at the root (30 s for a test, 60 s for a hook, 120 s for a `*.slow.test.ts`), which
  every package's `vitest.config.ts` spreads in. A test never asserts how long something took on the clock; a budget
  is held in processor time (`packages/tooling/tool/cli/test/Startup.test.ts`).
- **The check on CI runs two tasks at a time, with one test worker each** (`--concurrency=2`,
  `VITEST_MAX_WORKERS=1` in `.github/workflows/ci.yml`), and `--continue`, so a red run lists everything that is
  wrong. It is three jobs that start at once, each on a runner of its own under that same rule: the catalog's
  screens (`web`), the slow tests with the live one and the data grid (`slow`) and everything else (`rest`); the job the rule on
  main requires waits for the three, and each job keeps turbo's own time for every task with the run
  (`goals/ci-speed`). On a pull request the longest properties run fewer times (`PROPERTY_RUNS=short`, read in
  `vitest.shared.ts` and hashed by the `test` task); a push to main and the nightly leave it unset and run today's
  counts. A job given more than that is timed over several runs first. The runner has four cores; turbo's own ten tasks at once, each test run with a worker per core, made tests
  several times slower than they are (ten at once on four pinned cores: 117 s, and red on three tests' limits).
  To see what the runner sees:
  `VITEST_MAX_WORKERS=1 taskset -c 0-3 bun run check:full -- --force --continue --concurrency=2` (green three times
  in a row on four pinned cores, 168 to 192 s, and once on two, 342 s; the table is in the exploration's
  `DECISIONS.md`, 2026-11-22).
- **No test re-asserts what the types or another test already prove.** Check: each test names the rule it protects.

## Documentation

- **JSDoc on every export in a context's contract, model or host package, `src/api` and `src/server`**: what it is for and the rule it protects;
  `@example` on pure helpers whose use is not obvious. Check: read the exports of a changed file.
- **`.annotate({ description })` on every exported schema**, and `annotateKey` (with `messageMissingKey` where a
  person can see it) on API payload fields a person can leave out and on fields whose name is unclear. The
  descriptions reach the OpenAPI document and the model's JSON Schema. Check: the OpenAPI document has a description
  on each schema.
- **Required on every new schema**: everything the starter brought already has them. Docgen-grade JSDoc (categories, versions, examples that compile) is what production would add.
- **The API reference works**: the HttpApi's Scalar page (`HttpApiScalar`) in development, the OpenAPI document in
  production. Check: in `bun run dev`, `/api/v1/docs` lists every endpoint; under `bun run preview` it answers 404
  and `/api/v1/openapi.json` answers.

## Measured

- **Lighthouse Accessibility, Best Practices and SEO at 100**; Performance measured and reported with its cause.
  Check: `bun run lighthouse` prints all four categories, and the write-up gives each one.
- **Logs, traces and metrics** as far as the platform allows ([settings, logs and traces](config-and-logs.md)).
  Check: the write-up names what did not work, and why.

## Development close to production

- **Development runs as production does as far as it can**: the Worker in workerd, a local D1, the API's headers.
  Check: `bun run dev` serves the API with its production headers.
- **`bun run preview` is the parity check for headers**: the production build, served with every header
  ([security](security.md)). Check: `curl -sI localhost:4173` under `bun run preview`.
- **`bun run dev:https` is optional**: local certificates, so secure cookies and HSTS behave as deployed. The README
  says how, marked optional. Check: the README's section exists and says "optional".
