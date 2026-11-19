---
type: Brief
title: "Brief: kernel-drivers"
description: The goal kernel-drivers, step 5 of the order of work. The shared language moves into @inventory/kernel, and the three engines the server talks to move behind product-neutral drivers, @beep/d1, @beep/better-auth and an AI driver on @effect/ai-openrouter that replaces the Vercel AI SDK, with the app switched over after each one.
---

# Brief: `kernel-drivers`

Step 5 of the order of work in [README.md](README.md). It rests on the answered decisions "core", "packages", "file
naming", "strictness", "schema form" and "client state" in [DECISIONS.md](DECISIONS.md), on sections 1, 2, 4 and 8 of
[research/04-beep-direction.md](research/04-beep-direction.md), sections 2.1, 2.2, 2.7 and 4 of
[research/03-effect-modules.md](research/03-effect-modules.md) and section 5 of
[research/02-alchemy-infra.md](research/02-alchemy-infra.md). Where this brief and a report differ, this brief is the
later word and says why ("Where the research was wrong", at the end of the Sketch).

## Problem

The language every part of the app shares, and the three engines the server talks to, live inside `apps/inventory`
beside product code. That blocks step 7 (the contexts) and fails the schema rules in ways the move is the moment to fix.

1. **No home for the shared language.** Ids, roles, the member, the audit line, the agent run and the sign-in
   middleware are spread over `src/domain/Identity.ts`, `Activity.ts`, `Agent.ts`, `Described.ts`,
   `src/api/v1/Identity.ts`, `Security.ts`, `src/server/Agent.ts` and `src/server/Identity.ts`. Every context will
   import them, and a context package cannot import the app.
2. **The shared types break the schema rules.** Ids are `S.String.pipe(S.brand(...))` with no bound (SF-7); `Role` is
   a hand-written literal union ranked through a `Record` (SF-6, SF-8); `Member`, `AgentRun` and the errors are
   `S.Class` with `.annotate` on the class and on keys in mixed ways (SF-1, SF-9); `Activity.agent` is
   `S.NullOr` behind `S.optionalKey` (SF-4); the sentence fields are unbounded strings.
3. **The D1 helper is a module of loose functions.** `src/server/Sql.ts` exports `statement`, `run`, `batchOn` and a
   `Query` interface; `batchOn` ends in an `as unknown as` cast; the error channel leaks `SqlError | SchemaError` to
   every service, and nearly every caller ends in `Effect.orDie`. The test database harness (`TestD1`,
   `TestDatabase`, `runSqlFile`) lives in the app's `test/server/support/app.ts` and reads files with `node:fs`.
4. **The Better Auth wrapper mixes the engine with the product.** `src/server/Auth.ts` holds the generic part (build
   Better Auth once, handle `/api/auth/*`, look a session up, the secret policy) beside product rules that belong to
   the app (`authOptions.ts`: three roles, the member-name hook, disabled paths, the cookie prefix). A Better Auth
   failure is `Effect.promise`, so it reaches the app as an untyped defect; the secret is chosen through a `let`.
5. **The model path is the Vercel AI SDK inside `Effect.tryPromise`.** `src/server/Ai.ts` classifies failures by
   reading SDK error names (`AI_NoObjectGeneratedError`) and status codes through `Predicate.hasProperty`, bridges the
   Effect Schema to the SDK through `toAiSchema` (which wraps a decode failure in `new Error(String(cause))`), casts
   provider metadata to read the cost, and keeps a second provider (the Vercel AI Gateway) that has no Effect provider.
   `ai` and `@openrouter/ai-sdk-provider` duplicate what `effect/ai` and `@effect/ai-openrouter` 4.1.4 ship.

## Appetite

Scope, not time. In:

- Four packages, in this order, each with the app switched over and green before the next starts:
  `@inventory/kernel` (`packages/kernel`), `@beep/d1` (`packages/drivers/d1`), `@beep/better-auth`
  (`packages/drivers/better-auth`) and `@beep/openrouter` (`packages/drivers/openrouter`).
- Each new package meets the full strict profile with no overrides; code that moves is fixed to it as it moves.
- The test database harness moves into `@beep/d1` as its test layer.
- The Vercel AI SDK is replaced by `@effect/ai-openrouter` over `effect/ai`, with the house rules kept: the app is
  complete without a key, one retry policy, a bad structured answer is never retried, and every call takes from the
  daily allowance first, which stays in the app.

Out: everything in No-gos. The goal is done when the app runs on the four packages, the old files are gone, and the
messy sample imports through Confirm with the three numbers agreeing, after each package.

## Sketch

Schemas first, then the service contracts, then the files, then what moves, for each package, under
[docs/standards/schema-first.md](../../docs/standards/schema-first.md) (SF-1 to SF-9). Every Effect name below was
checked in effect 4.1.4's source (`node_modules/effect/src`, and Effect's repository at
`packages/ai/openrouter/src` for the provider). A schema marked **tried** was written out, type-checked under the full
profile and run: it decodes as stated, and `Arbitrary.schema` generates only values `S.is` accepts. Everything in
the AI driver is read from source and **not compiled**, because `@effect/ai-openrouter` is not installed yet.

Conventions for every schema below, not repeated: plain data is
`class X extends S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema("X", {...}))) {}`;
every field, element and member takes `S.annotateKey` first in its pipe; a non-class schema ends with
`$I.annoteSchema` and exports `type X = typeof X.Type`; a field with one canonical starting value has
`S.withConstructorDefault(...)` and `S.withDecodingDefaultTypeKey(...)`; every finite set of cases is a `LiteralKit`
mapped to member schemas and closed with `S.toTaggedUnion(...)`; errors are
`S.TaggedError<X, { readonly brand: unique symbol }>($I\`X\`)(..., $I.annoteError<X>(...))`, with `httpApiStatus` in
the annotation where the error crosses HTTP (tried); `$I` is the package's composer `.create("<File>")`.

### 1. `@inventory/kernel` (`packages/kernel`)

Language only, as beep-effect's shared kernel: ids, roles, the member, the agent run, the audit line, the sign-in and
cross-site middleware declarations and the role check. No Layer, no SQL, no Better Auth, no HTTP group.

#### Schemas

| Schema (file) | Definition | Behaviour beside it |
| --- | --- | --- |
| `IdText` (internal, `Ids.id.ts`) (tried) | `S.String.check(S.isPattern(/^[A-Za-z0-9_-]{1,64}$/))`: the seeded ids (`org_prairie`, `mem_dana`) and Better Auth's generated ids | |
| `OrganizationId`, `MemberId`, `UserId` (`Ids.id.ts`) (tried) | `IdText.pipe(S.brand(...))`. `UserId` is new: Better Auth's account id, a plain `string` today | |
| `ActivityId`, `RequestId` (`Ids.id.ts`) (tried) | `S.String.check(S.isUUID()).pipe(S.brand(...))` | |
| `Role` (`Role.schema.ts`) (tried) | `LiteralKit(["viewer", "editor", "admin"])`, least to most access | `hasRole` (dual, data-first and pipeable) over `Role.match` for the rank, replacing the `Record` rank |
| `DisplayName` (`Text.schema.ts`) (tried) | `S.String.check(S.isMinLength(1), S.isMaxLength(200), S.isPattern(/\S/))`: a name for the screen, never compared for a permission | |
| `Sentence` (`Text.schema.ts`) | `S.String.check(S.isMinLength(1), S.isMaxLength(1000), S.isPattern(/\S/))`: a sentence for the person (today's `reasonForPerson`) | |
| `Instant` (`Text.schema.ts`) | `S.DateTimeUtcFromString`, annotated: a moment the server recorded. For contract fields as they move (decision (c)) | |
| `Member` (`Member.schema.ts`) (tried) | `{ id: MemberId, name: DisplayName, role: Role, organizationId: OrganizationId, organizationName: DisplayName }` | `Member.allows(member, minimum)`: `hasRole(member.role, minimum)` |
| `AgentRun` (`AgentRun.schema.ts`) | `{ agent: DisplayName, maxRole: Role }` | `AgentRun.allows(run, minimum)` |
| `Activity` (`Activity.schema.ts`) (tried) | `Model.Class<Activity>("Activity")`: `id: Model.UuidV4Insert(ActivityId)`, `organizationId`, `actorId: MemberId`, `actorName: DisplayName`, `action` (1 to 120 characters), `detail` (0 to 2000), `agent: Model.FieldOption(DisplayName)`, `createdAt: Model.DateTimeInsert` | none: the insert statement stays with the service that writes it |
| `RequestSource` (`SameOrigin.middleware.ts`) | `{ method: S.String (1 to 16), fetchSite: Option<string> (OptionFromOptionalKey), origin: Option<string>, own: S.Array(S.String) }` | `RequestSource.allows(source)`: today's `allowsRequest`, the cross-site rule both the HttpApi and `/api/auth/*` apply |

`Activity.agent` changes from `string | null` (optional key) to `Option<DisplayName>`: `FieldOption` stores SQL
`NULL` and reads JSON `null` or a missing key as `None` (tried). Nothing in `src/web` reads `agent` today.

#### Errors (`AccessError.errors.ts`)

| Error | Fields | Status |
| --- | --- | --- |
| `NotSignedIn` (tried) | `reason: Sentence` | 401 |
| `Forbidden` | `reason: Sentence`, `required: Role` | 403 |
| `CrossSiteRequest` | `reason: Sentence` | 403 |

#### Contexts and middleware

```ts
// Actor.context.ts
export class CurrentActor extends Context.Service<CurrentActor, Member>()($I`CurrentActor`) {}
export const requireRole: (minimum: Role) => Effect.Effect<Member, Forbidden, CurrentActor>
//   Effect.fn("requireRole"); reads CurrentAgent with Effect.serviceOption; same sentences as today

// Agent.context.ts
export class CurrentAgent extends Context.Service<CurrentAgent, AgentRun>()($I`CurrentAgent`) {}
export const asAgent: (run: AgentRun) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>

// Identity.middleware.ts (tried as a declaration)
export class Identity extends HttpApiMiddleware.Service<Identity, { provides: CurrentActor; requires: never }>()(
  $I`Identity`, { error: NotSignedIn }) {}

// SameOrigin.middleware.ts
export class SameOrigin extends HttpApiMiddleware.Service<SameOrigin>()($I`SameOrigin`, { error: CrossSiteRequest }) {}
```

The implementations stay in the app: `SessionIdentityLive` (the session cookie), `IdentityLive` (the tests' header
identity, kept out of the Worker bundle by `scripts/check-production-identity.mjs`) and `SameOriginLive`. The kernel
holds no Layer, so a context host and the app choose.

#### Files and exports

| Subpath | File | Exports |
| --- | --- | --- |
| `@inventory/kernel` | `src/index.ts` | documented barrel of the subpaths below |
| `./Ids` | `src/Ids.id.ts` | `OrganizationId`, `MemberId`, `UserId`, `ActivityId`, `RequestId` |
| `./Role` | `src/Role.schema.ts` | `Role`, `hasRole` |
| `./Text` | `src/Text.schema.ts` | `DisplayName`, `Sentence`, `Instant` |
| `./Member` | `src/Member.schema.ts` | `Member` |
| `./AgentRun` | `src/AgentRun.schema.ts` | `AgentRun` |
| `./Activity` | `src/Activity.schema.ts` | `Activity` |
| `./AccessError` | `src/AccessError.errors.ts` | `NotSignedIn`, `Forbidden`, `CrossSiteRequest` |
| `./Actor` | `src/Actor.context.ts` | `CurrentActor`, `requireRole` |
| `./Agent` | `src/Agent.context.ts` | `CurrentAgent`, `asAgent` |
| `./Identity` | `src/Identity.middleware.ts` | `Identity` |
| `./SameOrigin` | `src/SameOrigin.middleware.ts` | `SameOrigin`, `RequestSource` |
| (none) | `src/internal/identity.ts` | `$KernelId` (decision (e1)) |

`package.json`: `"beep": { "family": "kernel" }`, dependencies `effect`, `@beep/identity`, `@beep/schema`; tests with
`@effect/vitest`.

#### What moves, what stays, and the app's imports afterwards

| Today | After |
| --- | --- |
| `src/domain/Identity.ts` (`OrganizationId`, `MemberId`, `Role`, `hasRole`, `Member`) | kernel; `AddPersonProblem` moves into `src/api/v1/People.ts`, the only contract that uses it |
| `src/domain/Activity.ts`, `src/domain/Agent.ts` | kernel |
| `src/domain/Described.ts` | `reasonForPerson` becomes kernel `Sentence`, `personName` kernel `DisplayName`; the string `instant()` helper stays in the app (`src/api/v1/Described.ts`) until its fields move (decision (c)) |
| `src/api/v1/Identity.ts` | `CurrentActor`, `NotSignedIn`, `Forbidden`, `Identity` to kernel; `SessionState`, `SignInFeatures`, `TestAccount`, `OrganizationChoice`, `IdentityApi` and `actingAsHeader` stay (access contract, step 7) |
| `src/api/v1/Security.ts` | kernel (`SameOrigin`, `CrossSiteRequest`); file deleted |
| `src/server/Agent.ts`; `requireRole` from `src/server/Identity.ts` | kernel; `src/server/Agent.ts` deleted, `src/server/Identity.ts` keeps `IdentityLive` only |
| `allowsRequest` in `src/server/SameOrigin.ts` | kernel `RequestSource.allows`; `SameOriginLive` stays |

No re-export shims: every import is rewritten in the same commit (about forty files under `src` and `test`).

```ts
import { Member } from "@inventory/kernel/Member"
import { hasRole, Role } from "@inventory/kernel/Role"
import { CurrentActor, requireRole } from "@inventory/kernel/Actor"
import { Identity } from "@inventory/kernel/Identity"
```

### 2. `@beep/d1` (`packages/drivers/d1`)

The statement discipline of `Sql.ts` as one service, and the test database as its test layer. Product-neutral: it
knows D1, Effect SQL and Schema, nothing about items or organizations. The shape below is the raw-SQL option of
decision (a); the Drizzle options change only what a statement is built from.

#### Schemas

| Schema (file) | Definition | Behaviour beside it |
| --- | --- | --- |
| `NoRows` (`D1.service.ts`) | `S.Tuple([])`: what a write without `RETURNING` answers | decoding a write's answer through it turns "returns nothing" into a check |
| `D1Stage` (`D1.errors.ts`) | `LiteralKit(["encode", "execute", "decode"])` | |
| `D1TestOptions` (`D1.test-layer.ts`) | `{ migrations: S.URL (a folder; files applied in name order), seeds: S.Array(S.URL) (default []), compatibilityDate: S.String (default "2026-11-01") }` | |

`D1Query<A>` (one statement, its bound values already encoded, and how its rows decode) holds functions, so it stays
a readonly interface, as Effect's own `Statement` is.

#### Errors (`D1.errors.ts`)

```ts
export class D1Error extends S.TaggedError<D1Error, { readonly brand: unique symbol }>($I`D1Error`)("D1Error", {
  stage: D1Stage.pipe(S.annotateKey({ description: "Encoding a request, running SQL, or decoding its rows" })),
  statement: S.Int.check(S.isBetween({ minimum: 0, maximum: 999 })).pipe(S.annotateKey({ description: "Index in its batch" })),
  cause: S.Defect.pipe(S.annotateKey({ description: "The SqlError or SchemaError underneath" }))
}, $I.annoteError<D1Error>("D1Error", { description: "One statement could not be encoded, run or decoded" })) {}
```

One error replaces `SqlError | SchemaError` in every signature; a service maps it to its own error or dies, as today.

#### Service

```ts
export class D1Binding extends Context.Service<D1Binding, D1Database>()($I`D1Binding`) {}

export class D1 extends Context.Service<D1, {
  readonly run: <A, E, R>(query: Pending<A, E, R>) => Effect.Effect<A, E | D1Error, R>
  readonly batch: <const Q extends ReadonlyArray<Pending<unknown, unknown, unknown>>>(queries: Q) =>
    Effect.Effect<Answers<Q>, ErrorOf<Q[number]> | D1Error, ServicesOf<Q[number]>>
}>()($I`D1`) {
  /** A statement with a request Schema (encoded before `execute` builds the SQL) and a result Schema. Pure. */
  static readonly statement: <Req extends S.Constraint, Res extends S.Constraint>(options: {
    readonly Request: Req; readonly Result: Res; readonly execute: (request: Req["Encoded"]) => Statement.Statement<unknown>
  }) => (request: Req["Type"]) => Pending<Res["Type"], never, Req["EncodingServices"] | Res["DecodingServices"]>
  /** D1, `D1Client`, `SqlClient` and `D1Binding` on a Worker binding. */
  static readonly layer: (options: { readonly db: D1Database }) => Layer.Layer<D1 | D1Client.D1Client | SqlClient.SqlClient | D1Binding>
  /** D1 over an already provided `D1Client`. */
  static readonly layerFromClient: Layer.Layer<D1, never, D1Client.D1Client>
}
```

Reads stay `SqlSchema.findAll`/`findOneOption` on the `SqlClient` the same layer provides. `batch` is `D1Client.batch`
with each answer decoded by its own result Schema, typed without the cast (`Effect.all` over a mapped tuple).

#### Test layer (`D1.test-layer.ts`, subpath `@beep/d1/D1Test`)

```ts
export class D1Test {
  /** A fresh in-memory D1 in local workerd (wrangler's getPlatformProxy, nothing persisted), every migration and seed
   *  applied in order, statement by statement through wrangler's splitter, as one batch per file. */
  static readonly layer: (options: D1TestOptions) =>
    Layer.Layer<D1 | D1Client.D1Client | SqlClient.SqlClient | D1Binding, D1Error>
  static readonly runSqlFile: (file: URL) => Effect.Effect<void, D1Error, D1Binding | FileSystem.FileSystem>
}
```

Files are read through `effect/FileSystem` with `@effect/platform-node`'s `NodeFileSystem.layer`, so the harness passes
the full profile with no `nodeBuiltinImport` override. `wrangler` and `@effect/platform-node` are dev and peer
dependencies, imported only by this subpath, which the Worker never imports.

#### Files and exports

| Subpath | File | Exports |
| --- | --- | --- |
| `@beep/d1` | `src/index.ts` | barrel of `./D1` and `./D1Error` (not the test layer) |
| `./D1` | `src/D1.service.ts` | `D1`, `D1Binding`, `D1Query`, `Pending`, `Answers`, `NoRows` |
| `./D1Error` | `src/D1.errors.ts` | `D1Error`, `D1Stage` |
| `./D1Test` | `src/D1.test-layer.ts` | `D1Test`, `D1TestOptions` |
| (none) | `src/internal/identity.ts`, `src/internal/migrations.ts` | `$D1Id` (`$I.compose("d1").$D1Id`, tried: `@beep/d1/...`); the ordering and splitting of SQL files |

#### What moves

`src/server/Sql.ts` is deleted. About sixty `statement({...})` sites in `Imports.ts`, `Items.ts`, `People.ts`,
`ModelCalls.ts`, `Suggestions.ts` and `TableAssistant.ts` become `D1.statement({...})`; `const batch = batchOn(d1)`
becomes `const d1 = yield* D1` and `d1.batch([...])`. `worker.ts` builds `D1.layer({ db: env.DB })`. In
`test/server/support/app.ts`, `TestD1`, `TestDatabase` and `runSqlFile` are replaced by
`D1Test.layer({ migrations: <app>/migrations, seeds: [] })`, and `SeededAccounts` by a `seeds` entry for
`scripts/dev-accounts.sql`. `TestAuth` reads `D1Binding`.

### 3. `@beep/better-auth` (`packages/drivers/better-auth`)

Builds Better Auth once from options the app gives, answers `/api/auth/*`, looks a session up. What Better Auth is
configured to do (roles, hooks, disabled paths, cookie prefix, rate limits) stays in the app's `authOptions.ts`.

#### Schemas (`BetterAuth.schema.ts`, `BetterAuth.config.ts`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `AuthUserId`, `AuthOrganizationId` | Better Auth's id text (1 to 64 of `[A-Za-z0-9_-]`), branded; the app decodes them into kernel `UserId`/`OrganizationId` (a driver never imports the kernel) | |
| `AuthEmail` | `S.String.check(S.isMaxLength(254), S.isPattern(/^[^\s@]+@[^\s@]+$/))` | |
| `AuthSession` (tried for its option field) | `{ userId: AuthUserId, email: AuthEmail, activeOrganizationId: Option<AuthOrganizationId> }`, decoded from Better Auth's answer with `S.OptionFromOptionalNullOr` (a missing key and `null` both read `None`, tried) | |
| `AuthEndpoint` | the path under the base path (`/sign-in/email`), 1 to 200 characters: the one request detail a span carries | `AuthEndpoint.of(url, basePath)` |
| `AuthSecret` | by `kind`: `configured { secret: S.Redacted(S.String) }` (at least 32 characters, checked inside the redaction) or `ephemeral {}` (development only: 32 random bytes, sessions end on restart) | `AuthSecret.resolve(settings)`: the policy below |
| `BetterAuthSettings` (`.config.ts`) | `{ secret: Option<Redacted<string>>, publicUrl: Option<URL>, production: S.Boolean }` | |

`AuthSecret.resolve`: a configured secret of 32 or more characters is used; none, or a short one, in production
fails with `BetterAuthConfigError`; in development it is `ephemeral` with a logged warning (today's rule, without the
`let`).

#### Errors (`BetterAuth.errors.ts`)

| Error | Fields |
| --- | --- |
| `BetterAuthError` | `operation: LiteralKit(["handle", "session"])`, `cause: S.Defect` |
| `BetterAuthConfigError` | `problem: LiteralKit(["missingSecret", "shortSecret"])`; its `message` names the fix (`wrangler secret put BETTER_AUTH_SECRET`) |

A Better Auth rejection becomes a typed `BetterAuthError` instead of a defect; the app's identity middleware still
ends it as a 500, so nothing a person sees changes.

#### Service

```ts
export class BetterAuth extends Context.Service<BetterAuth, {
  readonly handle: (request: Request) => Effect.Effect<Response, BetterAuthError>      // span "BetterAuth.handle"
  readonly session: (headers: Headers) => Effect.Effect<Option.Option<AuthSession>, BetterAuthError>
  readonly publicOrigin: Option.Option<string>
}>()($I`BetterAuth`) {
  /** Better Auth from the settings and the app's options, built once per isolate. */
  static readonly layer: (settings: BetterAuthSettings,
    options: (resolved: { readonly secret: string; readonly baseURL: Option.Option<string> }) => BetterAuthOptions)
    => Layer.Layer<BetterAuth, BetterAuthConfigError>
  /** Mounts `handle` at `basePath` on the HttpRouter; `guard` runs first and may answer instead (the cross-site rule). */
  static readonly route: (options: { readonly basePath: `/${string}`;
    readonly guard: (request: HttpServerRequest.HttpServerRequest, publicOrigin: Option.Option<string>) => Option.Option<HttpServerResponse.HttpServerResponse> })
    => Layer.Layer<never, never, HttpRouter.HttpRouter | BetterAuth>
}
```

The Fetch `Request`, `Headers` and `Response` are Better Auth's own surface; the driver is where that unsafe shape
is faced (F5).

#### Test layer (`BetterAuth.test-layer.ts`, subpath `@beep/better-auth/BetterAuthTest`)

`BetterAuthTest.signedOut` (nobody signed in, `/api/auth/*` answers 404: today's `SignedOutAuth`) and
`BetterAuthTest.signedIn(session: AuthSession)`. Real sign-in on a test database is the app's composition of
`BetterAuth.layer` with `D1Test`'s `D1Binding`, because only the app has `authOptions`.

#### Files and exports

| Subpath | File | Exports |
| --- | --- | --- |
| `@beep/better-auth` | `src/index.ts` | barrel of the three below |
| `./BetterAuth` | `src/BetterAuth.service.ts` | `BetterAuth` |
| `./BetterAuthSession` | `src/BetterAuth.schema.ts` | `AuthUserId`, `AuthOrganizationId`, `AuthEmail`, `AuthSession`, `AuthEndpoint`, `AuthSecret` |
| `./BetterAuthConfig` | `src/BetterAuth.config.ts` | `BetterAuthSettings` |
| `./BetterAuthError` | `src/BetterAuth.errors.ts` | `BetterAuthError`, `BetterAuthConfigError` |
| `./BetterAuthTest` | `src/BetterAuth.test-layer.ts` | `BetterAuthTest` |
| (none) | `src/internal/identity.ts` | `$BetterAuthId` (tried: `@beep/better-auth/...`) |

Dependencies: `effect`, `better-auth` 1.7.22 (exact, as today), `@beep/identity`, `@beep/schema`.

#### What moves

`src/server/Auth.ts` is deleted. `authOptions.ts`, `authSettings` in `Settings.ts` (it builds `BetterAuthSettings`),
`SessionIdentity.ts`, `TestAccounts.ts` and `scripts/auth-schema.mjs` stay in the app. `worker.ts` composes
`BetterAuth.layer(settings, authOptionsFor(env.DB, waitUntil))` and `BetterAuth.route({ basePath: "/api/auth", guard })`
with the guard built on the kernel's `RequestSource.allows`. `SessionIdentity.ts` decodes `AuthSession` ids into
kernel ids before `Members.findByUser`.

### 4. `@beep/openrouter` (`packages/drivers/openrouter`)

One structured answer from OpenRouter through `effect/ai`, with one retry policy and a failure a product can word.
Product-neutral: no allowance, no sentences, no `AnsweredBy` wire format. The allowance (`ModelCalls.take` before
every call) stays in the app's features, where it is today (`TableAssistant.ts`, `Suggestions.ts`, the `checkAi`
handler).

#### Schemas (`OpenRouter.schema.ts`, `OpenRouter.config.ts`)

| Schema | Definition | Behaviour beside it |
| --- | --- | --- |
| `ModelId` | `S.String.check(S.isMaxLength(200), S.isPattern(/^[a-z0-9._-]+\/[A-Za-z0-9._:-]+$/))`, branded: a vendor/model id (`anthropic/claude-haiku-5.5`) | |
| `ModelPolicy` (`.config.ts`) | `attemptTimeout: S.Duration` (default 15 s), `retries: S.Int` 0 to 5 (default 2), `backoff: S.Duration` (default 500 ms, exponential, jittered), `deadline: S.Duration` (default 40 s): today's `aiPolicy` as data | `ModelPolicy.default = ModelPolicy.make({})`; `ModelPolicy.schedule(policy)` |
| `OpenRouterSettings` (`.config.ts`) | `{ enabled: S.Boolean (default true), model: ModelId, fallbackModels: S.Array(ModelId) (at most 3, default []), apiKey: Option<Redacted<string>> }`; a blank key is `None` (`SchemaGetter.trim` before the option) | `ModelAccess.fromSettings` |
| `ModelAccess` | by `kind`: `on { apiKey, model, fallbackModels }` or `off { why: LiteralKit(["noKey", "disabled"]), model }` | `ModelAccess.status(access)`: the same union without the key, as `ModelStatus` |
| `ModelStatus` | by `kind`: `on { model, fallbackModels }` or `off { why, model }` (tried as a two-member union over `LiteralKit`) | |
| `ModelTrouble` | `LiteralKit(["noKey", "refused", "busy", "badAnswer", "down"])` | `ModelTrouble.retryable` (`busy`, `down`); `ModelTrouble.of(error: AiError)`: the mapping below |
| `ModelPrompt` | `{ name: S.String (identifier, 1 to 64), system: Option<string> (default none), prompt: S.String (1 to 100,000), maxOutputTokens: Option<Int 1 to 32,000> (default none) }` | |
| `ModelUsage` | `{ inputTokens: S.Int ≥ 0, outputTokens: S.Int ≥ 0, costMicroUsd: Option<Int ≥ 0> }` | |
| `ModelAnswered` | `{ model: ModelId, fallback: S.Boolean, usage: ModelUsage }`: which model answered, read from the response's model name | |

`ModelTrouble.of` is an exhaustive `.match` on `AiError.reason._tag` (19 reasons in 4.1.4): `AuthenticationError` and
`QuotaExhaustedError` are `refused`; `RateLimitError` is `busy`; `StructuredOutputError`, `InvalidOutputError`,
`InvalidResponseError` and `UnsupportedSchemaError` are `badAnswer`; `UnknownError` is `refused` when
`reason.http.response.status` is 402 (OpenRouter's out-of-credit answer, mapped by its `internal/errors.ts` to
`UnknownError`; the field path read in `AiError.ts`), else `down`; everything else is `down`.

#### Errors (`OpenRouter.errors.ts`)

`ModelUnavailable { trouble: ModelTrouble }`, with `retryable` derived from the trouble. The provider's own text goes
to the log inside the driver, once per failed attempt, never into the error.

#### Service

```ts
type AnswerSchema = S.Codec<unknown, Record<string, unknown>> & { readonly DecodingServices: never }
export type ModelAnswer<A> = { readonly value: A; readonly answered: ModelAnswered }

export class OpenRouter extends Context.Service<OpenRouter, {
  readonly status: ModelStatus
  readonly generateObject: <Sc extends AnswerSchema>(prompt: ModelPrompt, schema: Sc) =>
    Effect.Effect<ModelAnswer<Sc["Type"]>, ModelUnavailable>
}>()($I`OpenRouter`) {
  /** The service from settings: `on` builds OpenRouterClient.layer({ apiKey }); `off` makes no client and every call
   *  fails with `noKey` without a request. */
  static readonly layer: (settings: OpenRouterSettings, policy?: ModelPolicy) => Layer.Layer<OpenRouter, never, HttpClient.HttpClient>
  /** `layer` over `FetchHttpClient.layer`: what the Worker uses. */
  static readonly layerFetch: (settings: OpenRouterSettings, policy?: ModelPolicy) => Layer.Layer<OpenRouter>
}
```

`generateObject`, as `Effect.fn("OpenRouter.generateObject")`:

1. `off`: fail `noKey` at once.
2. `LanguageModel.generateObject({ prompt: Prompt.make(...)` with `Prompt.setSystem` when `system` is `Some`,
   `schema, objectName: name })`, then `OpenRouterLanguageModel.withConfigOverride({ max_tokens })` when set.
3. `Effect.timeoutOrElse` per attempt (`attemptTimeout`), inside
4. `Effect.withExecutionPlan` of **one** step: `provide: OpenRouterLanguageModel.model(model, { models: [model,
   ...fallbackModels] })` (OpenRouter's own in-call fallback list), `attempts: retries + 1`, `schedule:
   ModelPolicy.schedule(policy)`, `while: transient` (`RateLimitError`, `InternalProviderError`, or `NetworkError`
   with reason `TransportError`). `AiError.isRetryable` is not used: it is `true` for `StructuredOutputError`.
5. `Effect.timeoutOrElse` for the whole call (`deadline`), then failures mapped through `ModelTrouble.of`.

One step is a rule, not a convenience: in `internal/executionPlan.ts` a step whose `while` answers false hands over to
the **next** step, so a second step would ask another model after a bad answer, which is a retry in all but name.

#### Test layer (`OpenRouter.test-layer.ts`, subpath `@beep/openrouter/OpenRouterTest`)

`OpenRouterTest.off(why)`; `OpenRouterTest.scripted(steps)`, a `LanguageModel.make` whose `generateText` plays a
list of replies and `AiError`s in order (the shape of Effect's own `test/ai/utils.ts`), wrapped by the real
`generateObject` path so retries, the deadline and the mapping are the driver's own; and
`OpenRouterTest.overHttp(handler)`, the real `OpenRouterClient.layer` over a scripted `HttpClient`, for the request
body and the 402 mapping.

#### Files and exports

| Subpath | File | Exports |
| --- | --- | --- |
| `@beep/openrouter` | `src/index.ts` | barrel of all but the test layer |
| `./OpenRouter` | `src/OpenRouter.service.ts` | `OpenRouter`, `ModelAnswer` |
| `./OpenRouterModel` | `src/OpenRouter.schema.ts` | `ModelId`, `ModelAccess`, `ModelStatus`, `ModelTrouble`, `ModelPrompt`, `ModelUsage`, `ModelAnswered` |
| `./OpenRouterConfig` | `src/OpenRouter.config.ts` | `OpenRouterSettings`, `ModelPolicy` |
| `./OpenRouterError` | `src/OpenRouter.errors.ts` | `ModelUnavailable` |
| `./OpenRouterTest` | `src/OpenRouter.test-layer.ts` | `OpenRouterTest` |
| (none) | `src/internal/identity.ts`, `src/internal/plan.ts` | `$OpenrouterId` (tried: the composer `compose` makes is spelled so); the plan and `transient` |

Dependencies: `effect` and `@effect/ai-openrouter`, both exactly 4.1.4, `@beep/identity`, `@beep/schema`.

#### What the swap changes in the app

| Today | After |
| --- | --- |
| `src/server/Ai.ts` (`Ai`, `aiPolicy`, `retryModelCall`, `ModelRoute`, `describeModelFailure`, `routesFrom`, `toAiSchema`, `languageModel`) | deleted. `answeredByRules` moves to `src/server/Answered.ts` and wraps `ModelUnavailable` into the contract's `AnsweredBy` |
| `ai`, `@openrouter/ai-sdk-provider` | removed; `@effect/ai-openrouter` 4.1.4 added to the driver only |
| `aiSettings` in `Settings.ts` | builds `OpenRouterSettings`; `AI_GATEWAY_API_KEY` leaves `Settings.ts`, `env.d.ts` and `.dev.vars.example` (decision (e2)) |
| `AiProvider` `"openrouter" \| "gateway"`, `AiRoute`, `AiStatus.routes` in `Api.ts` | `"openrouter"` only; `AiStatus` built from `ModelStatus`; `src/web/lib/errors.ts` loses the gateway sentence |
| `AiTrouble`, `AiUnavailable`, `modelSentences` | stay in the contract; `AiUnavailable` is made from `ModelUnavailable.trouble` with the same sentences (decision (e3)) |
| `ai.generateObject({ name, prompt, system, schema, maxOutputTokens })` in three callers | `openRouter.generateObject(ModelPrompt.make({...}), schema)` |
| `costMicroUsd` from a cast of provider metadata | `Option` from the finish part's `metadata.openrouter.usage.cost` (typed `ChatUsage.cost`); stored as `0` when `None`, as today |

The model-feature schemas: `SuggestAnswer` (`src/domain/Suggest.ts`), `ViewCommand` (`src/domain/TableView.ts`) and
the check's `{ greeting }` are root objects with no optional key and no recursion, so they pass the OpenRouter codec
(`OpenAiStructuredOutput.ts` refuses only a non-object root or a root `anyOf`; `ViewChange`'s union is nested and
becomes a nested `anyOf`). Bounds the provider's JSON Schema cannot carry (`maxChanges`, `Text(300)`) are dropped from
what is sent but still checked on decode, so a reply over them is `badAnswer`, as today. None of the three changes.

The tests: `test/server/Ai.test.ts` moves into the driver as `OpenRouter.test.ts` over `OpenRouterTest.scripted` and
`OpenRouterTest.overHttp`; `Suggestions.test.ts`, `Assistant.slow.test.ts` and every other `Ai.layerFor(...)`
(ten test files in all) take `OpenRouterTest.off("noKey")` or `OpenRouterTest.scripted([...])` instead of
`MockLanguageModelV4` from `ai/test`.

### Proof

The definition of done, per package, written before the code.

| Package | Proof |
| --- | --- |
| kernel | `Kernel.property.test.ts`: every exported schema "generates only valid values"; `hasRole` is a total order consistent with `Role`'s order; `Activity` and `Activity.json` round-trip, `agent` `None` encodes to SQL `NULL`; `RequestSource.allows` keeps today's `SameOrigin.test.ts` table. `requireRole` with and without an agent (today's `Agent.test.ts`). |
| `@beep/d1` | on `D1Test`: a statement's request is encoded before binding and its rows decoded; a write answering rows fails `NoRows` as `D1Error` stage `decode`; a batch whose second statement fails leaves the first unwritten (atomicity); migrations apply in name order and seeds after them. The app's `Tenancy`, `Imports`, `TakeBack`, `People` and `Suggestions` slow tests pass on `D1Test`. |
| `@beep/better-auth` | `AuthSecret.resolve`: missing or short in production fails `BetterAuthConfigError`, short in development is `ephemeral`; `AuthSession` decodes Better Auth's answer with the key missing, `null` and set; a span from `handle` carries the endpoint and status and never an email. The app's `Auth.slow`, `Pwned` and `AuthSchema.slow` tests pass. |
| AI driver | scripted: an answer is decoded; busy then an answer succeeds on the second attempt; a bad answer is attempted once, never twice; three `busy` fail `busy` after `retries + 1` attempts; the attempt timeout and the deadline under `TestClock`; `off` makes no request. Over HTTP: the body has `models` and `max_tokens`; 402 is `refused`; 429 is `busy`. The app's `Suggestions` and `Assistant` tests pass with the allowance taken before the call (a used-up allowance makes no request). |
| the app, after each package | `bun run check:full` through turbo and the production build pass; `bun run dev` on port 5199 (`--strictPort`); `items_messy.csv` imported in a real browser through Confirm: 200 rows in the file, the result screen and the Items table and the stored rows agree on 155. After `@beep/better-auth`: sign out and sign in again. After the AI driver: the table assistant with the key (the screen names the model that answered) and with `AI_ENABLED=false` (the screen says the rules answered). |

### How this brief obeys the schema rules

| Rule | Where it shows |
| --- | --- |
| SF-1 keys annotated as keys | every field above takes `S.annotateKey` first; whole schemas take `$I.annoteSchema`, errors `$I.annoteError` |
| SF-2 Effect's own values | `Activity.createdAt` and kernel `Instant` are `DateTime.Utc`; `ModelPolicy` durations are `Duration`; API keys and the auth secret are `Redacted`; `publicUrl` and test migration folders are `URL` |
| SF-3 normalised in the schema | a blank API key is trimmed to `None` by a getter on `OpenRouterSettings`, not by `Str.trim` in code (today's `present`) |
| SF-4 absence is `Option` | `Activity.agent`, `AuthSession.activeOrganizationId`, `RequestSource.fetchSite`/`origin`, `OpenRouterSettings.apiKey`, `ModelPrompt.system`/`maxOutputTokens`, `ModelUsage.costMicroUsd` |
| SF-5 defaults on the schema | `ModelPolicy` (all four), `OpenRouterSettings.enabled`/`fallbackModels`, `ModelPrompt.system`/`maxOutputTokens`, `D1TestOptions.seeds`/`compatibilityDate`; none on an id, a role or a secret |
| SF-6 tagged unions | `ModelAccess`, `ModelStatus`, `AuthSecret`; plain modes are `LiteralKit`s (`Role`, `ModelTrouble`, `D1Stage`, the error `operation`/`problem` fields) with `.match` behaviour |
| SF-7 generates only valid values | every id is bounded by pattern, every text and count by checks; each package has a `*.property.test.ts` over every exported schema |
| SF-8 behaviour beside its data | `hasRole`, `Member.allows`, `AgentRun.allows`, `RequestSource.allows`, `AuthEndpoint.of`, `AuthSecret.resolve`, `ModelAccess.fromSettings`/`status`, `ModelTrouble.of`/`retryable`, `ModelPolicy.schedule`, `D1.statement` |
| SF-9 schema forms | plain data is branded `S.Opaque`; errors are `S.TaggedError`; `Activity` is `Model.Class` because it is a stored entity with variants (deviation 1) |

### Deviations from the exemplars, and why

1. **`Activity` carries no brand.** `Model.Class` takes one type argument (tried: a second is TS2558), so SF-9's
   brand cannot be written on it. Its id is branded, and nothing else is a `Model.Class`.
2. **Kernel identifiers read `@beep/inventory/kernel/...`.** The vendored `Id.make` refuses an `@inventory/...` base
   (tried: "Schema validation failed"), and the kit is never edited. Decision (e1).
3. **Two roles beyond research 04's list.** The kernel's `.id.ts`, `.context.ts` and `.middleware.ts` gain
   `.schema.ts` and `.errors.ts` for `Role`, `Member`, `Activity` and the errors; drivers gain `.schema.ts` for data
   that is neither settings nor errors (`AuthSession`, `ModelTrouble`).
4. **`requireRole` is a function in the kernel.** beep-effect's kernel holds declarations only; the role check is an
   `Effect` over `CurrentActor` and `CurrentAgent`, with no Layer and no driver, and every context host needs the same
   one.
5. **The AI driver's retry predicate is explicit.** beep-effect's `@beep/anthropic` uses `isRetryable` as its plan's
   `while`, which retries bad answers; this driver does not copy it.

### Where the research was wrong

1. **Drizzle.** Research 02 §5 and the exploration's README treat Drizzle as a second schema language that helps
   nowhere. `drizzle-orm` 1.0.0-rc.5, which is installed, ships `drizzle-orm/effect-d1` (an Effect 4 session over
   `@effect/sql-d1`'s `D1Client`) and `drizzle-orm/effect-schema` (`createSelectSchema`, `createInsertSchema`,
   `createUpdateSchema` producing Effect Schemas from tables). So row schemas would not be a second language. What
   still holds: `effect-d1` has no batch, and its `transaction` calls `SqlClient.withTransaction`, which `D1Client`
   refuses, so every atomic write still needs `D1Client.batch` (decision (a)).
2. **`ExecutionPlan`'s `while`.** Research 03 §4.7 left open whether a step's `while` returning false stops the plan.
   It does not: the loop in `internal/executionPlan.ts` moves to the next step. Research 03 §4.8 sketched a second
   step; with it, a bad answer would be asked of another model.
3. **The 402 field path**, left unverified in 03 §4.6, is `reason.http.response.status` on `UnknownError`
   (`AiError.ts`: `HttpContext.response.status`).
4. **The kernel's package identity.** Research 04 §4 named `@inventory/kernel` without checking that the vendored
   identity kit can compose an `@inventory` root; it cannot (deviation 2).
5. **The driver's name.** Research 04 named it `@beep/ai-sdk` for "routes and fallbacks" around the Vercel AI SDK;
   after the swap there is no AI SDK and one route.
6. **`AiStatus`, `AiTrouble` and `AiUnavailable` moving into the driver** (research 04 §4) would put the app's
   sentences ("Everything else works without it") into a product-neutral package. The driver keeps the technical
   vocabulary (`ModelStatus`, `ModelTrouble`, `ModelUnavailable`); the wire types stay in the app (decision (e3)).
7. Not wrong, but missing: Effect 4.1.4 also ships `@effect/ai-cloudflare`, a Workers AI provider for
   `DecisionModel` only (no `LanguageModel`), so it is no route for this goal.

## Decisions for Benjamin

Answered 2026-11-18, each as recommended (recorded in [DECISIONS.md](DECISIONS.md)): (a) "Raw SQL, Model.Class
rows", with `drizzle-orm`, `drizzle-kit` and the Drizzle MCP entries removed and the Drizzle skill kept; (b)
"@beep/openrouter"; (c) "Kernel now, contract with contexts"; (d) "Keep it, names unchanged"; (e1)
"@beep/inventory/kernel/..."; (e2) "Drop it", which also confirms (e4); (e3) "In the app's contract". The options
below are kept as they were put.

**(a) What does `@beep/d1` build statements from?**

| Option | What it changes |
| --- | --- |
| **Raw SQL with Schema request and result, `Model.Class` for stored rows (recommended)** | Today's discipline, made a service; `0001_init.sql` stays the one history; FTS5 trigram, its three triggers, composite keys and `COLLATE NOCASE` stay as written. `drizzle-orm` and `drizzle-kit` are unused and leave `apps/inventory/package.json` (with the Drizzle skill and MCP entry kept or removed as you say). |
| Drizzle v1 rc for reads and table definitions, raw batches for writes | `@beep/d1` gains `./Drizzle` over `drizzle-orm/effect-d1`; tables in TypeScript with `effect-schema` row schemas; writes still go through `D1.batch` (Drizzle has none on D1), compiled with `.toSQL()`; FTS5 and triggers stay raw in a custom migration; drizzle-kit takes over the migrations folder, a new history; Better Auth's tables need declaring too or keep two owners; an rc pinned exactly. |
| Drizzle everywhere | Not possible on D1 without giving up atomic confirm and take-back (no batch, transactions refused). |

Reason for the recommendation: every write that matters is an atomic batch Drizzle cannot express on D1, and the hard
SQL stays raw either way, so Drizzle would be a second way to write half the statements.

**(b) The AI driver's package name.**

| Option | What it changes |
| --- | --- |
| **`@beep/openrouter` at `packages/drivers/openrouter` (recommended)** | Named after the engine, as beep-effect's `@beep/anthropic` and `@beep/openai`; no collision in beep-effect's drivers or identity list; composer `$OpenrouterId`. |
| `@beep/ai` | Names the capability; a later second provider joins it; beep-effect may want the name for its own. |
| `@beep/ai-sdk` (research 04) | Misleading once the Vercel AI SDK is gone. |

**(c) How far do the deeper schema rules reach into the HTTP contract in this goal?**

| Option | What it changes |
| --- | --- |
| **Kernel types fully now, contract fields when their context moves (recommended)** | Ids branded and bounded now: the wire is unchanged, but an id over 64 characters or with other characters is a 400 problem document instead of a 404. `Activity.agent` is `Option` now (no screen reads it). `Member` and the errors become `S.Opaque`/branded errors with bounded sentences; the wire is unchanged. The string `instant()` fields (`ImportResult.importedAt` and the six others in the import and item contract) become `DateTime` in the catalog step, where the screens that read them move too. |
| Everything now | `instant()` fields become `DateTime` now; the web's dates code and the review read `DateTime` in this goal, which makes it as large as the catalog move. |
| Move as is, rules later | The kernel ships today's types unchanged; the contexts goal rewrites them; the kernel fails SF-1, 4, 7 and 9 until then. |

**(d) Is `CurrentActor` kept as the kernel's sign-in middleware?** (research 04, decision 15)

| Option | What it changes |
| --- | --- |
| **Keep `CurrentActor` and `Identity`, names unchanged (recommended)** | `requireRole` keeps guarding every write; no `authority` context and no `Invocation`. A recorded exception to beep-effect's doctrine, which retires `CurrentActor`. |
| Keep it, renamed to beep-effect's kernel words (`Session` middleware) | The same behaviour; every `.middleware(Identity)` and import changes name. |
| Build an `authority` context now | Grants, delegation and `Invocation` before the contexts exist; out of this goal's appetite. |

**(e1) The kernel's identity root.**

| Option | What it changes |
| --- | --- |
| **`@beep/inventory/kernel/...` from the vendored kit (recommended)** | Service keys and schema identifiers read `@beep/inventory/kernel/Actor/CurrentActor`; the kit stays byte-identical. |
| A small own composer for `@inventory` in the kernel | Identifiers match the package name; one more identity mechanism beside the kit's. |

**(e2) Drop the Vercel AI Gateway route?** (research 03, decision 7, not yet in DECISIONS.md)

| Option | What it changes |
| --- | --- |
| **Drop it (recommended)** | `AI_GATEWAY_API_KEY` and `"gateway"` leave the settings and the contract; OpenRouter's own `models` list and the rules are the fallbacks. |
| Keep it through `@effect/ai-openai-compat` | Unverified that it can target the gateway; a second plan step needs a guard so a bad answer is not asked again. |

**(e3) Where do the model-status wire types live?**

| Option | What it changes |
| --- | --- |
| **In the app's contract until the contexts goal (recommended)** | `AiStatus`, `AnsweredBy`, `AiTrouble`, `AiUnavailable` and `modelSentences` stay in `src/api/v1`; the driver stays free of product sentences. |
| In the kernel | Shared by the `system` group and catalog now; the kernel gains product sentences. |
| In the driver (research 04) | The driver carries the app's sentences and wire format. |

**(e4) Two open decisions this goal builds on.** It builds on "never" for retrying a bad structured answer (decision
14) and on exact pins for `effect` and `@effect/*` at one version (decision 17). Confirm both, or say otherwise.

## Rabbit holes

- **The first page's weight.** `src/web/lib/session.ts` and the sign-in page import the kernel's types; the kernel's
  subpaths pull `@beep/identity` and `@beep/schema/LiteralKit` into the first download. `bun run build:report` before
  and after the kernel step; if the first chunk grows, the first page imports `import type` only.
- **Better Auth's id alphabet.** `IdText` assumes Better Auth's generated ids fit `[A-Za-z0-9_-]{1,64}`; unverified
  against `better-auth` 1.7.22's generator. Checked in the Better Auth step by signing up in the browser.
- **`usage.include`.** Today's request asks OpenRouter to report cost; `OpenRouterLanguageModel`'s `Config` has no
  such field (its `ChatRequest` has none). Whether `cost` arrives without it is unverified; `costMicroUsd` is an
  `Option` and stored as 0 when absent, as today.
- **The answered model's name.** Whether a fallback is recognisable from the response's model name, as today's
  prefix check does, is checked against a real call once.
- **Spans.** `Spans.test.ts` asserts span names of the services it runs, and the telemetry tests build the app with
  `Ai.layerFor`; a span renamed by the move (`Ai.generateObject` to `OpenRouter.generateObject`, `Auth.session` to
  `BetterAuth.session`) is written down in PLAN and every assertion that names it moves with it.
- **The Worker bundle.** A driver's test layer must never reach the Worker; `check-production-identity.mjs` is
  extended to refuse `wrangler`, `getPlatformProxy` and `MockLanguageModel` in the bundle.

## No-gos

- No context packages (`access`, `catalog`): step 7. `SessionState`, `IdentityApi`, `PeopleApi`, the import and item
  contracts stay in `src/api/v1`.
- No SQL changes, no new migration, no seed split (research 02 §5's seed move belongs to `@beep/infra`).
- No `SqlModel.makeRepository`; no `withTransaction`.
- No second model vendor, no confidence scores, no TypeSafe, no `DecisionModel` (decision 13).
- No streaming or tool-calling model API in the driver: nothing calls one today.
- No change to `authOptions.ts`'s behaviour: roles, hooks, rate limits, cookies and disabled paths as they are.
- No edit to the vendored kit, no `CLAUDE.md` change beyond what the moved paths make false.

## Map

| Part | Goal | Cites |
| --- | --- | --- |
| `@inventory/kernel`: ids, `Role`, text, `Member`, `AgentRun`, `Activity`, errors, contexts, middleware declarations | `kernel-drivers`, slice 1 | `apps/inventory/src/domain/Identity.ts`, `Activity.ts`, `Agent.ts`, `Described.ts`; `src/api/v1/Identity.ts`, `Security.ts`; `src/server/Agent.ts`, `Identity.ts` (`requireRole`), `SameOrigin.ts` (`allowsRequest`); beep-effect `standards/ARCHITECTURE.md` (The Shared Kernel In A Model-First Slice) |
| `@beep/d1` with `D1Test` | `kernel-drivers`, slice 2 | `apps/inventory/src/server/Sql.ts`, `test/server/support/app.ts` (`TestD1`, `TestDatabase`, `runSqlFile`); beep-effect `packages/drivers/sqlite` (service, errors, test layer) |
| `@beep/better-auth` | `kernel-drivers`, slice 3 | `apps/inventory/src/server/Auth.ts`; `SignedOutAuth` in `test/server/support/app.ts` |
| AI driver on `@effect/ai-openrouter` | `kernel-drivers`, slice 4 | NET-NEW over Effect's `packages/ai/openrouter/src` and `packages/effect/src/ai`; replaces `apps/inventory/src/server/Ai.ts`; beep-effect `packages/drivers/anthropic` (shape only, not its retry predicate) |
| Contract fields onto `Instant`/`DateTime` | later, when the catalog context moves (decision (c)) | `src/api/v1/Api.ts` `instant()` fields |
| Model-status wire types into a context | later, when the contexts are cut (decision (e3)) | `src/api/v1/Api.ts`, `ModelTrouble.ts` |
| `@inventory` identity root | later, when `@beep/identity` gains a second root in beep-effect (decision (e1)) | vendored `packages/foundation/modeling/identity/src/Id.ts` |

The first vertical slice is the kernel with the app switched to it: the smallest step that makes the contexts
possible, and the one every later package imports.
