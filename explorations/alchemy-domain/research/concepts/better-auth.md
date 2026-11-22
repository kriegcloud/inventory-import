---
type: Reference
title: Better Auth with Alchemy
description: The @alchemy.run/better-auth package (a Better Auth instance as an Effect value, its database Layers, secret and deploy-time migrations) and the domain recipe that turns a session into a command's request context; for this app, how the session it already reads would reach CurrentActor inside a domain command.
tags: [alchemy-domain, people-and-clients]
---

# Better Auth with Alchemy

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

Two different things share this name, and they are kept apart on this page. The first is the package
`@alchemy.run/better-auth`: one function, `BetterAuth(options)`, that builds a Better Auth server as an Effect
value, takes its database from a Layer (`CloudflareD1` and others), mints a signing secret at deploy and applies
Better Auth's schema at deploy. The second is a recipe in the domain docs: an `RpcMiddleware` that reads the session
cookie and provides the signed-in user as a `Domain.RequestContext`, so a command's `decide` and a view's `validate`
know who is asking. The recipe needs a session lookup and nothing else, so it works with the package or with the
app's own Better Auth driver. The domain page puts it as: "A Domain Api reads that session in middleware, so every
command and view knows who is asking." [https://alchemy.run/domain/better-auth]

## When to reach for it

- **The recipe**: as soon as a command or view of a [domain Api](./api.md) must know the actor. In this app every
  write checks a role (`requireRole`) and is scoped to an organization, so any domain command that replaces a port
  (a confirm, a take-back, a role change) needs the recipe first. See [sessions](./sessions.md) for middleware in
  general.
- **The package**: when the Worker becomes an Alchemy `Cloudflare.Worker` (the host a domain Api on Durable Objects
  runs in, see [host-cloudflare](./host-cloudflare.md)) and you want Alchemy to own the instance's lifecycle, the
  secret and the D1 binding. Not before: it needs Alchemy's runtime (below).
- Not for Better Auth options themselves. Every option and plugin is Better Auth's own; the package only takes away
  `database`, `secondaryStorage` and `secret` and puts Layers in their place.

## How it is declared

### (1) The package

```ts
// SKETCH: not compiled
import { BetterAuth } from "@alchemy.run/better-auth"
import { CloudflareD1 } from "@alchemy.run/better-auth/CloudflareD1"
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"

const Database = Cloudflare.D1.Database("Database")

const makeAuth = Effect.gen(function* () {
  const secret = yield* Config.Redacted("BETTER_AUTH_SECRET")
  return yield* BetterAuth({
    id: "BetterAuth",
    basePath: "/api/auth",
    migrate: false,
    secret,
    emailAndPassword: { enabled: true, minPasswordLength: 12 }
  })
}).pipe(Effect.provide(CloudflareD1(Database)))
```

What the source says, piece by piece:

- **`BetterAuth(options)`** returns `Effect<BetterAuthInstance<O>, never, Database>`: the only requirement the caller
  owns is the `Database` service. The deploy-time needs (the `Random` provider, `RuntimeContext`, `Stack`) are erased
  from the type and supplied by stack evaluation at deploy and by Alchemy's bridge at run time
  (`BetterAuth.ts` 141-143, 250-259).
- **`BetterAuthProps`** is `BetterAuthOptions` minus `database`, `secondaryStorage`, `secret`, plus `id`
  (default `"BetterAuth"`, suffixes the secret and migration ids), `migrate` and a widened `secret`
  (`BetterAuth.ts` 28-64).
- **The instance** has `auth` (the raw Better Auth object, an escape hatch), `api` (every `auth.api.*` endpoint as an
  Effect failing with `BetterAuthApiError`), `fetch` (an `HttpEffect` that hands the request to `auth.handler` and
  returns its response unchanged), `getSession()` (reads the ambient `HttpServerRequest`) or `getSession(headers)`,
  resolving `null` for an anonymous request, and `Infer` (types only) (`BetterAuth.ts` 79-121, 218-241).
- **One Better Auth per execution.** The instance is built with `makeExecutionMemo` once per Worker event, Durable
  Object call or Lambda invoke, because a pg or mysql pool is pinned to the event on workerd (`BetterAuth.ts`
  175-214). Background work defaults to promises awaited by a finalizer on the execution scope; an
  `advanced.backgroundTasks` you pass wins (`BetterAuth.ts` 204-211).
- **The secret.** Omitted, the package creates `Random("${id}Secret")` once and keeps it stable across deploys in
  Alchemy's state. A string, a `Redacted`, or an Effect resolving to a `Redacted` (a resource output) is used as given
  (`BetterAuth.ts` 154-165). The package does not check the secret's length (no such check in the file).
- **Database Layers** each provide the `BetterAuth.Database` service (`Database.ts` 96): `provider` (`sqlite`,
  `postgres`, `mysql`), `runtime` (the Better Auth `database` input, built per execution) and optional `migrate`
  (`identity` plus a two-stage `connect`) (`Database.ts` 30-80). The barrel exports only `Memory`; the others are
  imported by path: `@alchemy.run/better-auth/CloudflareD1`, `/CloudflareHyperdrive`, `/Neon`, `/AuroraDataApi`,
  `/Postgres`, `/MySQL`, `/SQLite`, `/Drizzle` (`index.ts` 25-35, through the `"./*"` export of `package.json`). The
  barrel also exports the `Database` and `SecondaryStorage` services, the three errors, and `isAPIErrorLike` and
  `mergeAPIErrorHeaders` (`index.ts` 1-24).
- **`CloudflareD1(database)`** takes the `Cloudflare.D1.Database` resource or an Effect of it. At run time it reads the
  Worker's native binding (`Layer.provide(Cloudflare.D1.QueryDatabaseBinding)`); at deploy it adds migration support
  over the D1 HTTP API (which also reaches the local simulator under `alchemy dev`), identified by `databaseId`
  (`CloudflareD1.ts` 68-116).
- **`SecondaryStorage`** is an optional service, read with `Effect.serviceOption`, so it never shows in
  `BetterAuth`'s requirements. Five operations, TTLs in seconds; `increment` creates a key at 1 and never extends its
  TTL; `getAndDelete` is atomic (`SecondaryStorage.ts` 13-55). The package ships the contract only; the guide's Redis
  adapter is user code. The source and the guide both say Cloudflare KV does not fit (eventually consistent).
- **Migrations.** Unless running inside a deployed runtime (`globalThis.__ALCHEMY_RUNTIME__`), `BetterAuth` registers
  an Alchemy `Action` named `BetterAuth.Migrate` with id `${id}Migrate` (`BetterAuth.ts` 170-173, `Migrate.ts`
  91-109). It re-runs only when the schema fingerprint (tables, fields, indexes, from Better Auth's `getSchema`), the
  database identity or the dialect changes (`Migrate.ts` 98-102, 192-228). It runs Better Auth's own
  `getMigrations(...).runMigrations()`, which adds missing tables, columns and indexes and never drops; an unsafe
  change (a required column on a table with rows) fails as `BetterAuthMigrationError` (`Migrate.ts` 129-184).
  `migrate: false` skips it; `migrate: true` on a Layer without migration support (Memory, Drizzle, and Hyperdrive,
  Postgres, MySQL or Neon given no deploy-time `migrate` source) dies at deploy; outside a stack evaluation (a unit
  test) it is skipped silently (`Migrate.ts` 62-85; `Postgres.ts` 22-32, 87-95; `CloudflareHyperdrive.ts` 106-114).
  The result is bound into the host's environment as `${id}Migration`, which gives the host a dependency on the
  migration, so the new host deploys after it (`Migrate.ts` 110-116); old instances keep serving meanwhile
  (upgrade guide, "Deployment does not pause existing traffic").
- **The order against the D1 database's own migrations, on a new stage.** The Action's input and its connection's
  init half both read the database's `databaseId` output (`CloudflareD1.ts` 90-98), so the Action waits for the
  `Cloudflare.D1.Database` resource. That resource's reconcile creates the database, applies its `migrations`
  directory, then its `importFiles`, and only then returns `databaseId` (`@alchemy.run/cloudflare`
  `src/D1/Database.ts` 586-634; the published 2.0.0-beta.87 package, as installed in the app, has the same lines as
  `main@dbfd0ddb`; the local `alchemy dev` provider likewise, 719-757). So the database's own SQL migrations and seeds run
  first, then Better Auth's planner compares against what they made. Read from source, not run.
- **Errors** (`Errors.ts`): `BetterAuthApiError` (`status` is Better Auth's string key such as `"UNAUTHORIZED"`,
  `statusCode` the number, `body`, `headers` with `set-cookie` kept, `toResponse()`), `BetterAuthMigrationError`,
  `BetterAuthStorageError`. A throw that is not an `APIError` becomes a defect (`ApiProxy.ts` 48-63). `APIError` is
  recognised by shape (`name === "APIError"` and a numeric `statusCode`), not `instanceof`, so a second copy of
  Better Auth in the bundle still maps (`Errors.ts` 18-23). Log `statusCode` and `body.code`, never the whole error:
  its headers and cause can carry credentials (middleware guide 139).
- **Background work.** The package passes `advanced.backgroundTasks` only when the options have none; its own
  handler collects the promises and a finalizer on the execution scope awaits them (`BetterAuth.ts` 184-211).

**The HTTP middleware guide's rule (401 against 503).** In an Effect `HttpApiMiddleware`, only a `null` session
becomes `Unauthorized` (401). A typed lookup failure and a lookup defect both become `AuthenticationUnavailable`
(503), and the catch wraps the session lookup only, never the handler, so it cannot hide the handler's own failures
(guide `better-auth/guides/http-api-middleware.mdx` 59-83, 137).

### (2) The domain recipe

```ts
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"

export class CurrentUser extends Domain.RequestContext<CurrentUser>()(
  "Inventory/CurrentUser",
  S.Struct({ userId: S.String, name: S.String })
) {}

export class Unauthorized extends S.TaggedError<Unauthorized>()("Unauthorized", {}) {}

export class Session extends RpcMiddleware.Service<Session, { provides: CurrentUser }>()(
  "Inventory/Session",
  { error: Unauthorized }
) {}
```

A command or a view lists `middleware: [Session]`; the Api runs it before each call. Its Layer reads
`auth.getSession(new Headers(Object.entries(headers)))` from the RPC call's headers, fails `Unauthorized` on `null`
and otherwise runs the call with `Effect.provideService(CurrentUser, ...)`, all under
`Effect.provide(RuntimeContext.phantom)` (example `src/Session.ts` 10-28). Because `CurrentUser` is a
`RequestContext`, it has a schema: it is encoded with every command and decoded again where `decide` runs, which may
be a Durable Object (`packages/domain/src/RequestContext.ts` 30-86, 93-116). `decide` then reads it with
`yield* CurrentUser` and refuses with a rejection (`NotYours` in the example).

**On a lookup failure** the recipe pipes `auth.getSession(...)` through `Effect.orDie` (example `src/Session.ts`
16-18): a database or Better Auth failure becomes a defect, not a typed error. **That disagrees with the guide**,
which maps the same failure to a declared 503. Follow the guide's rule in a domain middleware too: declare
`error: S.Union([NotSignedIn, AuthenticationUnavailable])` (an `RpcMiddleware` takes one schema as `error`, where an
`HttpApiMiddleware` takes a list; effect `rpc/RpcMiddleware.ts` 278-336 at effect@4.1.4) and map the lookup failure,
typed or defect, to the second.

Checked in (beta.87): `packages/better-auth/src/BetterAuth.ts` 28-259; `Database.ts` 8-96; `CloudflareD1.ts` 68-116;
`Migrate.ts` 55-228; `SecondaryStorage.ts` 13-72; `Errors.ts` 63-117; `ApiProxy.ts` 1-74; `Memory.ts` 34-56;
`index.ts` 1-35; `packages/domain/src/RequestContext.ts` 30-116; `examples/cloudflare-domain-better-auth/src/`
`Session.ts`, `Session.middleware.ts`, `CurrentUser.context.ts`, `Auth.ts`, `NotesWorker.ts`.

### What main changes

- `CloudflareD1`, `CloudflareHyperdrive` and `AuroraDataApi` take a type parameter `R` for the requirement of the
  Effect you may pass instead of the resource, in place of `any` (main `packages/better-auth/src/CloudflareD1.ts`
  68-76, `CloudflareHyperdrive.ts` 88-99, `AuroraDataApi.ts` 241-250). Beyond one lint comment (`AuroraDataApi.ts`
  327), nothing else in `packages/better-auth/src`, `test`, `README.md` or `package.json` differs.
- The domain recipe's command loses `target`: `WriteNote` carries `userId` in `input`, the aggregate gains
  `keyOf: (cmd) => cmd.userId`, and the client call becomes `notes.WriteNote({ userId, text })` (main
  `examples/cloudflare-domain-better-auth/src/WriteNote.command.ts` 13-18, `src/Notebook.aggregate.ts` 15,
  `src/web/Notes.ts` 70, `website/src/content/docs/domain/better-auth.mdx` 85-90, 113). Commands without `target`
  are not published. See [command](./command.md).
- The example adds `@alchemy.run/frontend-frameworks` as a dev dependency (main example `package.json` 29).
- `examples/cloudflare-better-auth` (the tutorial's companion: email and password, an `HttpApiMiddleware` with the
  401/503 rule, opt-in GitHub) exists on main only; its middleware passes `session.user` whole to `CurrentUser`
  (main `examples/cloudflare-better-auth/src/middleware.ts` 21-45, line 38).
- The docs under `website/src/content/docs/better-auth/` are the same at both refs.

## Rules, and the mistakes to avoid

- **Read `Config` while the Layer is built, not inside a request.** Alchemy discovers and binds what the
  construction reads; a read inside a handler comes too late (configuration guide, tutorial part 5).
- **Keep the signing identity.** Omitting `secret` mints a new `${id}Secret`. Changing `id`, the stage or losing state
  mints another, and every session ends. An app with a secret already in use passes it in.
- **`migrate` defaults on.** It is additive and is not a rename or data-conversion tool. Turn it off when another
  process owns the schema; then that process must create every table, column and index first.
- **Two ids are two migrations and two secrets, not two sets of tables.** Distinct `id`s share tables unless the
  databases or model names differ (migrations guide).
- **Mount `auth.fetch` before your own API** so its status, redirects and `set-cookie` (including cookies written
  while refreshing a session) reach the browser unchanged.
- **401 is "no session"; 503 is "could not look".** Never turn a failed lookup into anonymous, and never catch around
  the handler.
- **Never take identity from a payload.** The middleware reads the cookie; the request context is the only source of
  the actor.
- **Authentication is not authorization.** `decide` and `validate` still check ownership or role.
- **`SecondaryStorage` must be present when `BetterAuth` is built** and strongly consistent; KV is not. Providing it
  moves more than sessions: the rate limiter then defaults to it (`SecondaryStorage.ts` 41-43), and sessions are read
  from it even with `storeSessionInDatabase: true`, so losing keys signs people out (secondary-storage guide 118-120).
  An explicit `rateLimit.storage` wins over that default.
- **Rate limits** are Better Auth's own option, untouched by the package. Without secondary storage they need a
  `storage` that survives isolates: `"database"` keeps the counters in the `rateLimit` table. They guard Better Auth's
  routes only, not the app's own endpoints (secondary-storage guide 122).
- **The session cookie cache** is Better Auth's `session.cookieCache`; the package neither sets nor changes it. The
  middleware guide points to Better Auth's session docs for its trade-off (guide 182).
- **The 1.6 to 1.7 upgrade** (the docs require 1.7.5 or later): the core account schema is unchanged, no `issuer`
  column or identity backfill; keep the same secret. What changed for code: a `genericOAuth` provider signs in with
  `signIn.social` and calls back at `/api/auth/callback/<id>` (was `/oauth2/callback/<id>`); token and profile calls
  name a local account row (`accountId`) or `useAccountCookie`; `experimental.joins` moved to
  `advanced.database.joins`; custom secondary storage must offer atomic `increment` (TTL in seconds, never extended)
  and `getAndDelete`; custom rate-limit storage uses one atomic consume. Microsoft, custom OAuth or SSO subjects,
  legacy OIDC or MCP clients, SCIM and device codes need manual steps. A database that ran 1.7.0 to 1.7.2 needs
  Better Auth's issuer cleanup first (upgrade guide 9-44, 94-136).
- **D1 has no interactive transactions.** A plugin that needs them (SCIM in 1.7) needs another database.
- **Drizzle and Memory do not migrate.** Drizzle's schema comes from `auth generate` and Drizzle's own tooling.

## In this app

The app already runs Better Auth 1.7.22 (pinned in `packages/drivers/better-auth/package.json`,
`packages/access/host/package.json`, `packages/access/web/package.json`, `apps/inventory/package.json`) through its own
driver `@beep/better-auth` (`packages/drivers/better-auth/src/BetterAuth.service.ts`): one instance per isolate, a
handler, and `session(headers)` that decodes Better Auth's answer to `AuthSession { userId, email,
activeOrganizationId }`. The options are `packages/access/host/src/internal/authOptions.ts`: the organization plugin
with the roles `admin` (owner permissions), `editor` and `viewer`, `creatorRole: "admin"`, a hook that opens a new
session in the person's earliest organization, a hook that refuses an account `SIGN_UP` does not allow, Have I Been
Pwned (on when `PWNED_PASSWORD_CHECK` is), rate limits in D1, `update-user`, member removal, leaving and deleting an
organization disabled (`authOptions.ts:71`), and the `member.name` additional field. The tables
are hand-written in `apps/inventory/migrations/0001_init.sql` part 1 (Better Auth's) and part 2 (`organization`,
`member` shared with the plugin), kept in step by `bun run auth:schema` and `apps/inventory/test/server/
AuthSchema.slow.test.ts`. The HTTP middleware `Identity` (`packages/access/host/src/SessionIdentity.adapter.ts:48-76`)
turns the session into `CurrentActor` through `accessHandlers.actorOf`, which asks `MemberDirectory.actorFor`. Today a
failed lookup there is `Effect.orDie` (`SessionIdentity.adapter.ts:56-57`): a 500, as in the Alchemy example, not the
guide's 503.

**A worked example: a confirm sent as a domain command.** The person presses Confirm on import 42. The browser sends
`ConfirmImport` over the domain Api with the session cookie. The `Session` middleware asks the driver for the session,
finds `userId` and `activeOrganizationId`, looks up the member there, and provides it as `CurrentActor`. `decide` on
the import refuses a viewer and an import of another organization, and the activity line names the member's id.

```ts
// SKETCH: not compiled
import { BetterAuth } from "@beep/better-auth/BetterAuth"
import { accessHandlers } from "@inventory/access-model/Handlers"
import { MemberDirectory } from "@inventory/access-model/MemberDirectory"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { Member } from "@inventory/kernel/Member"
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"

/** The member acting in a command: travels with the command to where decide runs. */
export class CurrentActor extends Domain.RequestContext<CurrentActor>()("Inventory/CurrentActor", Member) {}

/** The session could not be read: the database or Better Auth failed, not the request. */
export class AuthenticationUnavailable extends S.TaggedError<AuthenticationUnavailable>()(
  "AuthenticationUnavailable",
  {}
) {}

export class Session extends RpcMiddleware.Service<Session, { provides: CurrentActor }>()("Inventory/Session", {
  error: S.Union([NotSignedIn, AuthenticationUnavailable])
}) {}

export const SessionLive = Layer.effect(
  Session,
  Effect.gen(function* () {
    const auth = yield* BetterAuth
    const directory = yield* MemberDirectory
    return (effect, { headers }) =>
      Effect.gen(function* () {
        const session = yield* auth.session(new Headers(Object.entries(headers))).pipe(
          Effect.mapError(() => AuthenticationUnavailable.make({})),
          Effect.catchDefect(() => Effect.fail(AuthenticationUnavailable.make({})))
        )
        const member = yield* accessHandlers
          .actorOf(O.map(session, signedIn))
          .pipe(Effect.provideService(MemberDirectory, directory))
        return yield* effect.pipe(Effect.provideService(CurrentActor, member))
      })
  })
)
// `signedIn` is the same mapping SessionIdentity.adapter.ts uses (AuthSession -> SignedInUser).
```

Two seams then exist: the HTTP `Identity` middleware for the `HttpApi` endpoints that stay, and `Session` for domain
commands and views. Both run `actorOf`, so the rule (no session or no membership is `NotSignedIn`) is written once.
`CurrentActor` is today a plain `Context.Service<Member>` (`packages/kernel/src/Actor.context.ts` 24); as a
`RequestContext` it needs `Member` to encode to JSON. `Member` is an `S.Opaque` struct of five string fields (`id`,
`name`, `role`, `organizationId`, `organizationName`; `packages/kernel/src/Member.schema.ts` 28-38), so it has a JSON
form; not compiled as a request context.

**What adopting the package would change, and what must not be lost.**

- **It needs Alchemy's runtime.** `BetterAuth` requires `RuntimeContext` and an execution scope, and `CloudflareD1`
  reads the binding through `Cloudflare.D1.QueryDatabaseBinding`. Today's Worker is a plain module
  (`apps/inventory/src/server/worker.ts` reads `env` from `cloudflare:workers`) deployed by `Cloudflare.Website.Vite`
  (`packages/infra/src/Inventory.stack.ts` 102-130). The package fits only once the server is a
  `Cloudflare.Worker` class.
- **Set `migrate: false`.** The schema is owned by `0001_init.sql`, and it is not what Better Auth's planner would
  write: `member.userId` is nullable (a removed member keeps its row with `userId` emptied), `member` has
  `removedAt`, `UNIQUE (organizationId, id)` for composite foreign keys, a CHECK on `role`, and the unique index
  `(organizationId, userId)`. The planner adds missing tables, columns and indexes and never drops or changes one.
  The order is settled from source (above): on a fresh stage the `Database` resource applies `0001_init.sql` and the
  stage's seed files before the Action can run, so the planner meets the app's tables and does not create
  `organization` or `member` its own way. The reason left for `migrate: false` is ownership: with it on, a new plugin
  or field would reach D1 from the planner while `0001_init.sql` still lacks it, and `auth:schema` and
  `AuthSchema.slow.test.ts` would no longer describe the deployed database. Whether the planner finds nothing to add
  on today's schema is not verified (not run).
- **Pass the existing secret.** The stack already mints `Alchemy.Random("SignInSecret")` and binds it as
  `BETTER_AUTH_SECRET` (`Inventory.stack.ts` 71, 117). Letting the package mint `BetterAuthSecret` signs everyone out
  once. The 32-character floor and the production refusal live in `@beep/better-auth` (`BetterAuth.config.ts`,
  `BetterAuth.schema.ts`); the package has neither.
- **Keep the options file whole**: the role mapping (`organizationRoles`), `creatorRole`, the session hook that sets
  `activeOrganizationId`, the `user.create.before` hook that enforces `SIGN_UP` (closed on a deployed stage), the
  disabled paths, rate limits in D1 keyed by `cf-connecting-ip`, the cookie prefix and attributes,
  `disableOriginCheck: false`, telemetry off. Two of these interact with the package. Rate limits stay in D1 only
  because the options say `storage: "database"` (`authOptions.ts` 106-117): keep that line, since a
  `SecondaryStorage` Layer added later would otherwise take the counters. The session cookie cache stays off
  (`authOptions.ts` 96-105), so a sign-out ends at once in every tab; the package does not change that.
- **Drop the app's own `backgroundTasks` handler** (passed from `SignIn.route.ts` 34, 66) or keep it on purpose: when
  present it wins over the package's, which awaits the rate-limit writes on the execution scope (`BetterAuth.ts`
  204-211).
- **Keep the cross-site guard** in front of `/api/auth/*` (`SignIn.route.ts` 83-101). `auth.fetch` has none.
- **Keep the decoded session.** The package's `getSession` returns Better Auth's inferred object; the driver decodes it
  through `AuthSessionAnswer`, including `activeOrganizationId` as an `Option`.
- **Keep the spans** `BetterAuth.handle` and `BetterAuth.session` (the package adds none).
- **Cost**: one Better Auth construction per event instead of per isolate.

What the package would give: `api` as typed Effects, the secret's and migration's lifecycle in the stack, and the
D1 binding without passing `env.DB` by hand.

- **Used today:** no. The app has its own driver `@beep/better-auth` (`packages/drivers/better-auth/src/
  BetterAuth.service.ts`) and the HTTP `Identity` middleware (`packages/access/host/src/SessionIdentity.adapter.ts`).
- **Where it goes:** a `Session` `RpcMiddleware` beside `SessionIdentityLive` in `packages/access/host/src/`, with
  `CurrentActor` redeclared as a `Domain.RequestContext` in `packages/kernel/src/Actor.context.ts`; the package itself
  would replace `packages/drivers/better-auth/src/BetterAuth.service.ts` once the Worker is an Alchemy Worker.
- **What the person gets:** nothing they can see; the same sign-in, and the same "sign in first" answer when the
  session is missing.

## How to check it

- The example's `test/SignIn.test.ts` signs people in through a local OpenID Connect server (`oauth2-mock-server`,
  added with `genericOAuth`) and calls the Api over HTTP: no session is `Unauthorized`, another person's notebook is
  `NotYours`. The app's version: a domain command sent without the cookie fails `NotSignedIn`; a viewer's
  `ConfirmImport` is refused in `decide`; a member of `org_northline` cannot confirm an import of `org_prairie`.
- A test that makes the session lookup fail or die must see `AuthenticationUnavailable`, not a defect and not
  `NotSignedIn`.
- The middleware is the one thing a proof of the domain assumes: `Verify`'s report lists "middleware lets every
  caller in" (see [sessions](./sessions.md)), so these tests are where who-is-asking is checked.
- `apps/inventory/test/server/AuthSchema.slow.test.ts` stays the schema check while `migrate: false`.
- For the package, what its own tests prove: `test/SQLite.test.ts` idempotent migrations (a second run reports 0, 0,
  0), the unsafe-change error naming the column, a fingerprint that changes with one index, and a populated 1.6
  database upgraded with sessions, user ids and `account` rows unchanged and no `issuer` column (110-194);
  `test/BetterAuth.test.ts` `BetterAuthApiError`'s fields, the hidden `set-cookie` headers, plugin endpoints on `api`;
  `test/Cloudflare/D1.test.ts` (live) sign-up after the deploy's migration and a second deploy that does not
  re-migrate. **The organization plugin appears in one test only**: the fingerprint changes when `organization()` is
  added (`SQLite.test.ts` 244-252). No test migrates its tables or calls its endpoints, so for this app's
  `organization`, `member` and `invitation` tables the package proves nothing.

## What it needs

- The recipe: `@alchemy.run/domain` at beta.87 (`Domain.RequestContext` is published), Effect's `RpcMiddleware`, and any
  host the domain Api runs on ([host-in-memory](./host-in-memory.md) for tests,
  [host-cloudflare](./host-cloudflare.md) deployed). The session lookup can be the app's own driver.
- The package: `@alchemy.run/better-auth@2.0.0-beta.87`, whose published manifest asks for `alchemy` exactly
  `2.0.0-beta.87`, `better-auth` `^1.7.5` and `effect` `^4.1.4` (required), and, optional, `@alchemy.run/cloudflare`
  exactly `2.0.0-beta.87`, `kysely` `^0.29.4`, `drizzle-orm` `1.0.0-rc.5`, `pg` `^8.22.0`, `mysql2` `^3.24.2` and the
  rest; its one dependency is `@alchemy.run/sql` `2.0.0-beta.87` (read from the npm registry). The app's lockfile has
  `better-auth` 1.7.22, `effect` 4.1.5 and `kysely` 0.29.9, which satisfy it; its `alchemy` and
  `@alchemy.run/cloudflare` are the pin's files, `2.0.0-beta.87-734c27a` (`packages/infra/package.json`, the root
  `overrides`), which do not satisfy an exact `2.0.0-beta.87`, and the root `overrides` send `@alchemy.run/sql` to the
  pin's file too. So the published package does not fit the pin as it stands: the package built at the pin would be needed,
  and the pin does not hold it (`vendor/alchemy`; the brief, decision 1). Not run. Also the `nodejs_compat` flag and an
  Alchemy `Cloudflare.Worker` host.

## Verdict

**Use:** the recipe now, with the guide's 401/503 rule and the app's driver as its session lookup, as the `Session`
middleware every domain command and view lists. The package only after the server is an Alchemy `Cloudflare.Worker`,
with `migrate: false`, `secret` from `BETTER_AUTH_SECRET`, and `authOptions.ts` passed whole.

## Where this was read

- https://alchemy.run/domain/better-auth, https://alchemy.run/better-auth and its pages (the live site documents
  beta.87); https://alchemy.run/providers/betterauth/reference/d1/
- `website/src/content/docs/domain/better-auth.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `website/src/content/docs/better-auth/**` (29 pages) at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/better-auth/src/*.ts`, `package.json`, `README.md`, `test/**` at `v2.0.0-beta.87`; on `main@dbfd0ddb`:
  changed (`CloudflareD1.ts`, `CloudflareHyperdrive.ts`, `AuroraDataApi.ts`), the rest same
- `packages/cloudflare/src/D1/Database.ts` on `main@dbfd0ddb`, and the published `@alchemy.run/cloudflare`
  2.0.0-beta.87 as installed (same in the lines cited); the published `@alchemy.run/better-auth@2.0.0-beta.87`
  manifest from the npm registry
- `packages/domain/src/RequestContext.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `examples/cloudflare-domain-better-auth/**` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `examples/cloudflare-better-auth/**` on `main@dbfd0ddb`: new
- effect `packages/effect/src/rpc/RpcMiddleware.ts` at effect@4.1.4
- The app: `docs/auth.md`, `packages/access/host/src/internal/authOptions.ts`, `packages/access/host/src/SignIn.route.ts`,
  `SessionIdentity.adapter.ts`, `Config.ts`, `MemberDirectory.adapter.ts`, `packages/drivers/better-auth/src/`,
  `apps/inventory/migrations/0001_init.sql`, `apps/inventory/src/server/worker.ts`, `packages/infra/src/Inventory.stack.ts`
