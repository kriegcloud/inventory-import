---
type: Plan
title: "Kernel and drivers, plan"
description: The steps of the kernel-drivers goal, their status, the current blocker and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`.

| # | Step | Status |
| --- | --- | --- |
| 1 | Decisions recorded; SPEC and PLAN | done |
| 2 | `@inventory/kernel`; the app switched; proof | done |
| 3 | `@beep/d1` with `D1Test`; the app switched; proof | done |
| 4 | `@beep/better-auth`; the app switched; proof with sign-out and sign-in | done |
| 5 | `@beep/openrouter`; the AI SDK removed; proof with and without a model | doing |
| 6 | Closing note | todo |

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **`Role` is `S.Literals`, not a `LiteralKit`.** The vendored `LiteralKit` imports the `@beep/utils` root, which
  names Node types; the Worker's type-check then needs `"node"` types, and Node's `URL` type clashes with the Workers
  one in `@beep/utils/NodeUrl` (tried). A plain union of three scalars is allowed by SF-6, and the kernel depends on
  `@beep/identity` and `effect` only.
- **`Described.ts` stays in the app.** `instant()`, `personName()` and `reasonForPerson` describe contract fields that
  move with their context (decision "rules reach"); the kernel's own fields use `DisplayName` and `Sentence`.
- **OpenAPI component names.** Effect names a schema with an identity identifier by its whole path
  (`_beep_inventory_kernel_AccessError_ForbiddenEncoded`); `src/api/v1/Document.ts` now takes the last part when it is
  free, so the document still says `Forbidden`, `NotSignedIn`, `CrossSiteRequest`, `Member`.
- **Test ids.** `ActivityId` is a UUID, as every stored line's id is; the in-memory audit lines and the tenancy test's
  foreign line now use UUIDs instead of `act_0`.
- **The test identity decodes its header.** `MemberId` checks its text, so `IdentityLive` decodes the `x-acting-as`
  header and answers `NotSignedIn` for one that is not an id, instead of throwing in `MemberId.make`.
- **Kernel proof** (commit of step 2): check:full 23/23 tasks (kernel 26 tests, app 217 fast + 45 slow); build in
  check:full. Browser on port 5199, fresh database: review "200 rows read", "Import 155, skip 45"; confirm dialog
  "Import 155 items"; result "Imported 155 · Not imported 45 · All 200"; Items "155 items"; D1 `item` 155 rows;
  Activity lists the import's lines.
- **`D1Error` replaces `SqlError | SchemaError`** in every statement's error channel, with the stage (`encode`,
  `execute`, `decode`) and the statement's place in its batch. No service named either old error, so the switch
  changed only imports and the `d1.batch`/`d1.run` calls.
- **One assertion stays in `D1.batch`.** The decoded answers are named as the batch's `Answers` tuple once
  (`as unknown as`); the type system cannot follow a mapped tuple through `forEach`. The brief said "without the cast";
  the cast moved from the whole Effect to the one value.
- **`D1Test` ships its own wrangler file** (`wrangler.d1-test.jsonc` in the package) instead of a compatibility-date
  option; the app's `test/server/support/wrangler.test.jsonc` is gone. Seeds are layers (`D1Test.seed(url)`), because
  the strict profile refuses `Effect.provide` with a Layer outside an entry point; the brief's `runSqlFile` became it.
- **`TestDatabase` is one value** (`D1Test.layer(...)`), so the SQL client, Better Auth's raw binding (`D1Binding`) and
  the seeds share the database one layer build opens, as `TestD1.layer` did.
- **Drizzle out** (decision "D1 driver"): `drizzle-orm` and `drizzle-kit` left `apps/inventory/package.json`; the
  `drizzle` server left `.mcp.json`; `.grok/config.toml`, whose only entry it was, is deleted. `bun.lock` still names
  `drizzle-orm`/`drizzle-kit` only as optional peers of `better-auth` itself. `.agents/skills/drizzle` and its
  `.claude`/`.codex` links stay.
- **Docs the move made false**: `CLAUDE.md` (the service step), `docs/patterns.md` (pattern 1's last sentence) and
  `.claude/agents/backend.md` now name `D1.statement` from `@beep/d1/D1` instead of `src/server/Sql.ts`.
- **D1 proof**: check:full 26/26 tasks (d1 8 tests; app 217 fast + 45 slow on `D1Test`). Browser on a fresh database:
  "200 rows read", "Import 155, skip 45", result "Imported 155 · Not imported 45 · All 200", Items "155 items", D1
  `item` 155 rows.
- **`src/server/SignIn.ts` composes the driver.** The brief had `worker.ts` compose `BetterAuth.layer` and its route;
  the Worker and the tests both need the same composition (settings read through `authSettings`, `authOptions`, the
  cross-site guard), so it is one module, `signIn(...)` and `SignInRoute`, which replaces `src/server/Auth.ts`.
- **The route's guard is an Effect** returning `Option<HttpServerResponse>`, so the refusal is logged inside its span.
- **No `LiteralKit` in the drivers.** For the same Node-types reason as the kernel's `Role`, `AuthSecret` is
  `S.Union([...]).pipe(S.toTaggedUnion("kind"))` (allowed by SF-6's check) and the error fields are `S.Literals`.
  `AuthSecret`'s policy is the exported `resolveAuthSecret` beside it; `AuthEndpoint`'s is `authEndpointOf`.
- **Better Auth failures are typed** (`BetterAuthError`); the identity middleware and the session answer end them with
  `Effect.orDie`, so a person still sees a 500, as before. `BetterAuthConfigError` is the layer's typed failure; the
  Auth slow test ("a production build refuses to start, and says how to set one") passes unchanged.
- **Spans renamed** `Auth.handler`/`Auth.session` to `BetterAuth.handle`/`BetterAuth.session` (`authOptions.ts`'s
  comment and `docs/auth.md` say so); no test asserted the old names.
- **`minimumSecretLength`** left `Settings.ts`: the driver owns the 32-character rule.
- **Better Auth proof**: check:full 29/29 tasks (better-auth 12 tests; app 217 fast + 45 slow, sign-in end to end on
  `D1Test` with the seeded accounts). Browser on a fresh database: "200 rows read", "Import 155, skip 45", result
  "Imported 155 · Not imported 45 · All 200", Items "155 items", D1 `item` 155 rows. Then the user menu's "Sign out":
  the sign-in page with "Test accounts"; "Sign in as Dana Whitfield": the Import page, and
  `/api/v1/identity/session` answers `ready`, Dana Whitfield, admin, Example Works (test).

