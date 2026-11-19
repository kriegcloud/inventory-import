---
type: Goal
title: "Kernel and drivers"
description: The shared language moves into @inventory/kernel, and D1, Better Auth and the model move behind @beep/d1, @beep/better-auth and @beep/openrouter, which replaces the Vercel AI SDK; the app is switched over after each package.
status: done
from: explorations/ideal-architecture
---

# Kernel and drivers

Step 5 of the order of work in [the ideal-architecture exploration](../../explorations/ideal-architecture/README.md).
The design is [BRIEF-kernel-drivers.md](../../explorations/ideal-architecture/BRIEF-kernel-drivers.md) (its Sketch is
the specification of the four packages); the rules it follows are
[docs/standards/schema-first.md](../../docs/standards/schema-first.md).

## Objective

The app runs on four packages of this repository: `@inventory/kernel` (ids, roles, the member, the agent run, the
audit line, the sign-in and cross-site middleware declarations, the role check), `@beep/d1` (statements through
Schemas, atomic batches, the test database), `@beep/better-auth` (Better Auth built once, its route, the session
lookup) and `@beep/openrouter` (structured answers through `effect/ai` and `@effect/ai-openrouter`, one retry policy,
a failure a product can word). The old files are gone, and the Vercel AI SDK with them.

## Non-goals

From the brief's No-gos: no context packages; no SQL, migration or seed change; no `SqlModel.makeRepository` or
`withTransaction`; no second model vendor, scores or `DecisionModel`; no streaming or tool-calling model API; no
change to what `authOptions.ts` configures; the vendored kit untouched; the contract's `instant()` fields stay strings
(decision "rules reach").

## Constraints

- The app keeps working at every commit: `items_messy.csv` (200 rows) imports to 155 stored, with the result screen,
  the Items table and the stored rows agreeing.
- Effect 4.1.4 only, every API checked in source; `Effect.fn`/`Effect.fnUntraced`; Effect collections only.
- New packages pass the full type-check profile with no override; moved code is fixed to it as it moves; the
  schema-first standard applies to every schema written.
- `effect` and every `@effect/*` package pinned exactly at 4.1.4 (decision "model route and retries").
- The app is complete without a key; a bad structured answer is never retried; every model call takes from the daily
  allowance first, in the app.
- bun only; nothing pushed, deployed or published.

## Acceptance

- [x] `packages/kernel` (`@inventory/kernel`) has exactly the brief's subpaths and role-suffixed files; every exported
      schema generates only valid values; `hasRole`, `requireRole` and `RequestSource.allows` keep today's behaviour
      (kernel tests: 26, `Kernel.property.test.ts` over 14 schemas and `Kernel.test.ts` with today's agent and
      cross-site tables; `package.json` exports the 11 subpaths and `.`, no `./internal/*`).
- [x] `src/domain/Identity.ts`, `Activity.ts`, `Agent.ts`, `src/api/v1/Security.ts` and `src/server/Agent.ts` are gone;
      the app imports the kernel (commit `d4233ec`; `AddPersonProblem` moved into `src/api/v1/People.ts`).
- [x] `packages/drivers/d1` (`@beep/d1`) has `D1`, `D1Error`, `D1Test`; a failed statement in a batch leaves the
      batch unwritten; a write that answers rows fails `NoRows` (d1 tests: 8); `src/server/Sql.ts` is gone and the app's
      slow tests run on `D1Test` (45 pass; commit `03b1a8b`).
- [x] `packages/drivers/better-auth` (`@beep/better-auth`) has `BetterAuth`, its route, settings, errors and test
      layer; the secret policy and the session decoding are tested (12 tests); `src/server/Auth.ts` is gone (commit
      `f076416`; the app composes it in `src/server/SignIn.ts`).
- [x] `packages/drivers/openrouter` (`@beep/openrouter`) answers through `@effect/ai-openrouter`; a bad answer is
      attempted once; busy is retried; 402 is `refused`; off makes no request (openrouter tests: 26, the timeouts under
      `TestClock`, 402/401/429 through OpenRouter's real client); `src/server/Ai.ts`, `ai` and
      `@openrouter/ai-sdk-provider` are gone, and `AI_GATEWAY_API_KEY` with them (commit `3395a1f`; `bun.lock` names
      neither package).
- [x] `drizzle-orm` and `drizzle-kit` are gone from `apps/inventory/package.json` and `bun.lock` as packages (the lock
      still lists them only as optional peers declared by `better-auth` itself); the Drizzle MCP entries are gone from
      `.mcp.json` and `.grok/config.toml` (deleted: it held only that entry); `.agents/skills/drizzle` stays.
- [x] `bun run check:full` and `bun run build` pass after each package and on the last commit (check:full runs the
      build; 23, 26, 29 and 32 of 32 tasks after the four packages; see PLAN).
- [x] Browser, after each package: `items_messy.csv` imported through Confirm, the three numbers agreeing (200 rows,
      155 stored): four fresh databases on port 5199, each "200 rows read", "Import 155, skip 45", result "Imported
      155 · Not imported 45 · All 200", Items "155 items", D1 `item` 155.
- [x] Browser, after `@beep/better-auth`: sign out, then sign in again ("Sign out" showed the sign-in page; "Sign in as
      Dana Whitfield" opened the Import page and the session answered `ready`, admin of Example Works (test)).
- [x] Browser, after `@beep/openrouter`: one model feature with the key, naming the model that answered, and once with
      `AI_ENABLED=false`, saying the rules answered (the table assistant: "Answered by anthropic/claude-haiku-5.5", then
      "Answered by Rules" under "AI suggestions are off: AI_ENABLED is set to false."; how `AI_ENABLED` was set is in
      PLAN).

## Decisions

In [the exploration's DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "kernel-drivers brief", "D1
driver", "AI driver name", "rules reach", "CurrentActor", "kernel identity", "model route and retries", "model status
types"; and "file naming", "shared kit", "strictness", "schema form".
