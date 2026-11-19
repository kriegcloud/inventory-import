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
| 5 | `@beep/openrouter`; the AI SDK removed; proof with and without a model | done |
| 6 | Closing note | done |

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
- **`strictJsonSchema: true` on the model** (found in the browser). `@effect/ai-openrouter` sends Anthropic models the
  schema with `strict: null`; OpenRouter then does not enforce it, and `anthropic/claude-haiku-5.5` answered every
  request in a ```` ```json ```` fence, which `generateObject` refuses ("Expected a valid JSON string"), so every
  answer was `badAnswer` and the rules answered. With `strict: true` the answer is plain JSON. The driver's HTTP test
  now asserts `response_format.json_schema.strict: true`.
- **`src/server/Model.ts` meets the driver**, as `SignIn.ts` does Better Auth: `modelLayer` (settings to
  `OpenRouterSettings`, over a given `HttpClient`), `ModelLive` (over `fetch`), `aiStatusOf`, `answeredByModel`,
  `aiUnavailableOf`, `askModel(openRouter, …)` and `answeredByRules`. The brief named `src/server/Answered.ts` for
  `answeredByRules` alone; one module holds the whole meeting point. `askModel` takes the service as an argument, so
  no handler yields a service per request.
- **`ModelUnavailable` carries `retryable`** beside `trouble`, rather than deriving it from the trouble: an invalid
  request is `down` but not worth retrying, a deadline is `down` and is, as today's `AiUnavailable` says.
- **No `LanguageModel` escape hatch** (today's `languageModel`): nothing used it. The SDK's `retryModelCall` and
  `toAiSchema` are gone with it; `docs/patterns.md` patterns 3 to 5, `CLAUDE.md` (the model service, the retry rule)
  and `README.md` now describe `@beep/openrouter`.
- **The gateway is gone** (decision "model route and retries"): `AiProvider` is `"openrouter"` only (`AiStatus.provider`
  is `"openrouter" | "none"`), `AI_GATEWAY_API_KEY` left `Settings.ts`, `env.d.ts` and `.dev.vars.example`, and
  `src/web/lib/errors.ts` no longer names it.
- **`OpenRouterTest.scripted` repeats its last reply** past the end of the script, so an app test that asks many times
  (`Assistant.slow.test.ts`) scripts one answer.
- **The bundle check also refuses the drivers' test layers** in the Worker (`getPlatformProxy`,
  `wrangler.d1-test.jsonc`, the scripted model's sentence).
- **`CLOUDFLARE_INCLUDE_PROCESS_ENV=true AI_ENABLED=false` did not reach the Worker** while a `.dev.vars` existed
  (`/api/v1/system/status` still said AI was on). For the proof, the copied `.dev.vars` was set aside (renamed, never
  opened), the dev script generated a throwaway one, `AI_ENABLED=false` was appended to that, and the copy was moved
  back afterwards. Verified after the goal and corrected in `CLAUDE.md` (see "After the goal").
- **OpenRouter proof**: check:full 32/32 tasks (openrouter 26 tests; app 215 fast + 45 slow); `bun.lock` names neither
  `ai` nor `@openrouter/ai-sdk-provider`. Browser on a fresh database: "200 rows read", "Import 155, skip 45", result
  "Imported 155 · Not imported 45 · All 200", Items "155 items", D1 `item` 155. With the key: status "Answers come from
  OpenRouter (anthropic/claude-haiku-5.5, then google/gemini-3.8-flash); then the non-AI path."; the table assistant,
  asked "only kilograms, cheapest first", set `?sort=unitCost.asc&uom=KG` and said "Answered by
  anthropic/claude-haiku-5.5"; the audit line reads "Items: 2 changes to the view, answered by
  anthropic/claude-haiku-5.5", agent "Table assistant"; the allowance counted every attempt (6 `view` calls, three of
  them before the strict fix). With `AI_ENABLED=false`: status "AI suggestions are off: AI_ENABLED is set to false.";
  "sort by name descending" set `?sort=name.desc` and said "Answered by Rules".

## Closing note

The app now runs on four packages of its own beside the format packages: `@inventory/kernel` (`d4233ec`), `@beep/d1`
(`03b1a8b`), `@beep/better-auth` (`f076416`) and `@beep/openrouter` (`3395a1f`), each under the full strict profile
with no override, and the app was proved after each one by the full check, the build and the messy sample through
Confirm in a browser. Test counts on the last commit: kernel 26, d1 8, better-auth 12, openrouter 26, app 215 fast and
45 slow.

What was learned:

- The browser found what no test did: Claude through OpenRouter fences its JSON unless the schema is sent strict. A
  scripted model cannot show that; one live call per model change should stay part of the proof.
- The vendored `LiteralKit` pulls Node types into anything the Worker compiles; until `@beep/schema` imports
  `@beep/utils/Array` upstream, Worker-side packages use `S.Literals` and `S.toTaggedUnion` directly.
- `$I` identifiers name OpenAPI components by their whole path; `Document.ts` shortens them. Any context that moves
  schemas with identity annotations into the contract relies on that pass.

What the contexts goal (step 7) should know:

- Import `CurrentActor`, `requireRole`, `Identity`, `SameOrigin`, `Member`, ids and `Activity` from `@inventory/kernel`;
  the implementations (`SessionIdentityLive`, `IdentityLive`, `SameOriginLive`, `SignIn.ts`, `Model.ts`) are app
  composition and move to the hosts that own them.
- Host stores take `D1` from `@beep/d1/D1` (`D1.statement`, `run`, `batch`); slow tests take `D1Test` with the app's
  migrations folder, and seeds as `D1Test.seed(url)` layers.
- Still to move with their contexts (decision "rules reach"): the contract's `instant()` string fields onto kernel
  `Instant`, `SessionState`'s status and nullable actor (one struct with parts per case) onto a tagged union, the
  people contract's `memberId` path parameter onto `MemberId`, and the model-status wire types (`AiStatus`,
  `AnsweredBy`, `AiUnavailable`, `modelSentences`) into whichever context owns the model features.
- `Activity.agent` is an `Option` now; a screen that shows the agent reads `Option`.
- `TableAssistant` says "No AI key is set, so the rules answered." even when `AI_ENABLED=false` is the reason (it was
  so before this goal); its sentence could come from `aiStatusOf(...).reason`.

## After the goal

Two follow-ups Benjamin answered after the merge, and one check:

- **LiteralKit** ("Fix the import, then use LiteralKit"): the vendored `LiteralKit.schema.ts` and
  `internal/builders.ts` import `@beep/utils/Array` and `@beep/utils/Record` instead of the `@beep/utils` root, a
  deliberate patch against beep-effect `c5cebd5c9de7` (`SOURCE_PATCHES` in `scripts/vendor-beep.mjs`, `patches` in
  `packages/foundation/modeling/schema/vendor.json`, named in each file's first line, reported by `vendor:check`;
  re-vendoring from that commit reproduces the kit exactly). `Role`, `D1Stage`, the Better Auth error fields
  (`BetterAuthOperation`, `BetterAuthConfigProblem`), `AuthSecret`, `OffReason`, `ModelTrouble`, `ModelAccess` and
  `ModelStatus` are `LiteralKit`s again, with `.match` holding the behaviour (the role rank, the error sentences, the
  status words in `src/server/Model.ts`). The Worker and the web profile both type-check without Node types; the web
  profile's recorded `"node"` exception is removed. `@beep/csv` never avoided `LiteralKit`, so it is unchanged.
- **Drizzle skill** ("Remove it"): `.agents/skills/drizzle`, its `.claude`/`.codex` links and `skills-lock.json` are
  gone. The Better Auth skills still name Drizzle as one of Better Auth's adapters; that is their own content.
- **The AI-off recipe**: on the current code, with `.dev.vars` present,
  `CLOUDFLARE_INCLUDE_PROCESS_ENV=true AI_ENABLED=false` left AI on ("Answers come from OpenRouter …"), because wrangler
  includes the process environment only when it falls back to `.env` files (`getVarsForDev`). Appending
  `AI_ENABLED=false` to a backed-up `.dev.vars` works ("AI suggestions are off: AI_ENABLED is set to false.", with the
  key present); `CLAUDE.md` and `docs/patterns.md` now say so.

