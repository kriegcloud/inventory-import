---
type: Reference
title: Distilled clients
description: What every @distilled.cloud client has in common, and for Discord, Grafana, GitHub, Docker and 1Password what each is a client for, how big it is, and the one honest use inventory-import has for it (at run time, at deploy time, or none).
tags: [alchemy-domain, extra]
---

# Distilled clients

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

The distilled repository publishes one Effect SDK per provider (`@distilled.cloud/<name>`), each generated from the
provider's published API description and patched against live answers. Every operation is a function that returns an
`Effect` whose error channel lists the tagged errors it can fail with, whose requirements are that client's
`Credentials` service and an `HttpClient`, and which retries throttling and transient failures by itself. The
repository says: "Every SDK is generated from the provider's own published API description"
[https://github.com/alchemy-run/distilled]. Alchemy's own providers are built on these clients and call them at deploy
time; nothing stops a Worker from calling one at run time, because they speak through `effect/http/HttpClient`. This
page covers five of them; the mail client has its own page, [resend](./resend.md).

## When to reach for it

- At run time, from the domain model, only as the adapter behind an [external system](./external-system.md) a
  [policy](./policy.md) calls: the model names the call in its words, the client is in the Layer.
- At deploy time, inside a custom Alchemy provider, when Alchemy has no resource for the thing (Alchemy's own
  providers already wrap the clients they need).
- In an operator's script, for a one-off read or a setup step outside any stack.
- Not when an Alchemy resource already exists for the job (GitHub), and not for secrets on a deploy (1Password, below).

## How it is declared

What every client shares (read in `packages/core` by outline and in each client's hand-written files in full):

```ts
// SKETCH: not compiled
import * as Discord from "@distilled.cloud/discord"
import * as Messages from "@distilled.cloud/discord/discord"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"

// 1. Credentials: a Layer holding an Effect that resolves the config on every request.
const DiscordLive = Effect.gen(function* () {
  const token = yield* Config.Redacted("DISCORD_BOT_TOKEN")
  return Discord.credentials({ token })
}).pipe(Layer.unwrap, Layer.merge(FetchHttpClient.layer))

// 2. A call is an Effect; its errors are tagged; retries are on by default.
const announce = Messages.createMessage({ channel_id: "1203", content: "Import confirmed: 149 created" }).pipe(
  Effect.catchTag("UnknownDiscordError", () => Effect.void)
)
```

- **Operations.** `API.OperationMethod<I, O, E, R>` is both `(input) => Effect<O, E, R>` and an `Effect` that yields a
  requirement-free function (`packages/core/src/api.ts:172-190`); paginated ones are `PaginatedOperationMethod` and
  also stream their pages (`:779-785`).
- **Credentials.** Each client defines `Credentials` as `Context.Service<Credentials, Effect<Config, ConfigError>>`,
  resolved per request on the calling fiber, with a value constructor (`fromApiKey`, `credentials`, ...) and a
  `CredentialsFromEnv`. Some `CredentialsFromEnv` read through `@distilled.cloud/core/config`, which takes a provided
  `ConfigProvider` first (`packages/core/src/config.ts:1-25`): Discord, GitHub, 1Password. Others read `process.env`
  directly: Grafana, Docker, Resend. In this app's Worker, whose settings arrive as a `ConfigProvider` built from `env`
  (`apps/inventory/src/server/worker.ts:16`), always build credentials from a `Config.Redacted` with the value
  constructor. Core itself reads one setting, `DISTILLED_SERVER_RETRY_HINT_CAP_MS` (the longest wait a server may ask
  for that it honours, 60 s by default): from a provided `ConfigProvider` first, and from `process.env` only when none
  is in context, guarded for runtimes without `process` (`packages/core/src/retry.ts:228-310`). In the Worker, whose
  `ConfigProvider` is provided, nothing is read from `process.env`.
- **Protocol.** Each client's protocol is one `makeRestProtocol` call from core (bearer header, base URL, the
  provider's error body read into a tag); core builds it once per process from the operation's config
  (`packages/core/src/api.ts:218-240`, `packages/core/src/protocol-rest.ts:1-60`). Requests go through
  `effect/http/HttpClient` (`protocol-rest.ts:3`, `:641`), so `FetchHttpClient.layer` runs them on workerd's `fetch`.
- **Errors.** Core's HTTP-status classes (`Unauthorized`, `Forbidden`, `NotFound`, `TooManyRequests`, ...;
  `packages/core/src/errors.ts:44-165`), each client's `Unknown<Name>Error` and `<Name>ParseError`, plus `ConfigError`,
  `HttpClientError`, `InvalidInput`, `SdkError`. Categories (`AuthError`, `ThrottlingError`, ...) are attached to
  classes (`packages/core/src/category.ts:29-166`).
- **Retries.** A per-client `Retry` service. Without one, core's default retries at most twice (full jitter from
  50 ms, 1 s for a 429, capped at 20 s, the server's hint honoured, one retry budget per host shared by every distilled
  client in the isolate; `packages/core/src/retry.ts:117-159`, `:343-355`) what `isTransientError` accepts: an error
  marked retryable, a 429, and an `HttpClientError` whose reason is `TransportError`, which includes a response cut
  off mid-way, so the provider may already have acted (`packages/core/src/category.ts:246-278`). A 5xx is not
  retried. A write the provider cannot de-duplicate is therefore not safe under the default: give it the provider's
  key (Resend's `idempotencyKey`) or wrap it in `<Client>.Retry.none` (`{ while: () => false }`).
  `<Client>.Retry.throttling` and `<Client>.Retry.transient` retry without any limit (`packages/core/src/retry.ts:409-423`;
  `packages/{grafana,docker,onepassword,resend}/src/retry.ts:41-50`, `packages/discord/src/retry.ts:39-70`).
- **Answers are not checked.** Core reads a 2xx body in `lenient` mode unless a `ResponseValidation.additionalProperties`
  or `ResponseValidation.strict` Layer from `@distilled.cloud/core` is provided
  (`packages/core/src/response-validation.ts:1-60`); an empty body is read as `{}` (`protocol-rest.ts:579-600`). The
  output type is a claim, not a decode: an adapter decodes what it keeps with its own Schema.
- **Version.** All five are `1.0.0-rc.20` on npm today, peer `effect ^4.1.2`; the distilled `README.md` warns that a
  release candidate may still change a public type. The package's `worker` export
  condition points at its TypeScript sources.

Checked in (distilled repository at `51ba3a2c6`, 2026-11-18): the files above; per client, below.

### What main changes

Nothing for the clients: they are not in the Alchemy repository and have one version. At Alchemy `main@dbfd0ddb`, 29
packages depend on a distilled client (`packages/*/package.json`), against 28 at `v2.0.0-beta.87` (main adds
`packages/digitalocean`, commits `c6703f2cd` #2034 and `cbea844ae` #3229; the beta.87 count was taken from the tag's `packages/*/package.json` with `gh`); none of them
on Discord, Grafana, Docker, 1Password or Resend. One new main-only package matters here: `@alchemy.run/1password`
(`packages/1password/`, commit `3ff34b94f`, #2749), which resolves `op://` references through the official `@1password/sdk`; it is not on npm
(`bun pm view @alchemy.run/1password` answered "404 Not Found" on 2026-11-19), and the live site's
secret-providers page names only dotenv, Doppler and Infisical (main's docs add
`website/src/content/docs/environments/1password.mdx`; https://alchemy.run/environments/1password answers 404). See
1Password below.

How Alchemy uses a client, at both refs: inside a provider's reconcile, at deploy time. `packages/domain/src/Cloudflare/Backfill.ts:2`
imports `@distilled.cloud/cloudflare/workflows` and calls `workflows.getInstance` and friends from the provider
(`:248-382` on main; main adds a retry for an instance not yet visible, `:154-165`, `:296-306`, commit `2d57c6bc3`,
#3379). The domain package
lists `@distilled.cloud/cloudflare` as an optional peer (`packages/domain/package.json`). The Cloudflare runtime
package also uses the Cloudflare client for local bindings (`packages/cloudflare-runtime/src/core/bindings/queue/Queue.ts:1`).
No Alchemy package calls a distilled client from inside a deployed Worker's request path; that use is possible, but
it is this app's choice, not a pattern Alchemy shows.

## Rules, and the mistakes to avoid

- Import operations from the right path. Grafana and Docker re-export their operations at the package root; Discord
  does not (`packages/discord/src/index.ts:13` exports only `Services`), so its operations come from
  `@distilled.cloud/discord/discord`; GitHub's come from per-area paths (`@distilled.cloud/github/repos`). Some READMEs
  show names that do not exist (Docker's README, and the example in its own `src/index.ts:12`, call `containerList`;
  the operation is `listContainer`). From Discord's root, operations are reachable only as
  `Discord.Services.discord.<op>` (`packages/discord/src/services/index.ts:2`).
- Never let a client into the model. A domain model declares the call; the client is in the adapter Layer.
- Never build credentials from `process.env` in the Worker; never print a token. Every token is `Redacted`.
- A client call at run time spends the provider's rate limit on the person's request: put it behind a policy (after
  the commit, retried by the platform), not inside a command.
- Release candidates: pin the exact version.

## In this app

### Discord

- **What it is.** A client for Discord's HTTP API v10: 250 operations in one module (`packages/discord/src/services/discord.ts`),
  none paginated. Credentials: `token` (Redacted), `tokenType` `"Bot"` (the default) or `"Bearer"` (an OAuth user
  token), `apiBaseUrl` default `https://discord.com/api/v10` (`packages/discord/src/credentials.ts:27-89`);
  `CredentialsFromEnv` reads `DISCORD_BOT_TOKEN`, else `DISCORD_TOKEN`, `DISCORD_TOKEN_TYPE` (anything but `bearer`,
  in any case, means `Bot`) and `DISCORD_API_URL` (for a proxy) through core config (`credentials.ts:43-74`).
  The README says "Sent as `Authorization: Bearer`"; the protocol sends `<tokenType> <token>`, so `Bot` by default
  (`packages/discord/src/protocol.ts:86-94`). Errors: Discord's numeric JSON code is kept on `UnknownDiscordError.code`
  (`packages/discord/src/errors.ts:38-44`); 429 arrives as `TooManyRequests` with `Retry-After` honoured.
- **The use.** A message to a team channel when an import is confirmed or a take-back runs: a policy
  `AnnounceImport` on `[ImportConfirmed, ImportTakenBack]` calls an external system `TeamChannel.post({ text })`, whose
  adapter calls `createMessage({ channel_id, content })` (`discord.ts:3858-3873`, `:7829-7842`) with a bot token.
  With no token on a stage, the "off" adapter posts nothing; a preview never gets one. `createMessage` also takes
  `nonce` and `enforce_nonce` (`:3870-3871`, binding `:18451-18452`); Discord documents `enforce_nonce` as refusing a
  second message with the same nonce for a short time, which would make a retried post a no-op. That is Discord's
  behaviour, and its limits on a nonce are not in the source: not verified. If used, build the nonce from the event's
  stream and sequence number.
- **A webhook needs no bot, but not through this client.** Settled from source: every Discord operation requires
  `Credentials | HttpClient` (`DiscordOpContext`, `packages/discord/src/protocol.ts:45`), and the protocol puts
  `Authorization: <tokenType> <token>` on every request (`protocol.ts:86-94`; core applies the protocol's headers to
  every request it builds, `packages/core/src/protocol-rest.ts:456-463`). So `executeWebhook({ webhook_id,
  webhook_token, wait, body: { content, username } })` (`discord.ts:4365-4378`, `:4403-4410`, `:8566-8579`) cannot run
  without a `Credentials` Layer holding some token, and its `webhook_token` is a plain `string` path segment, not
  `Redacted` (binding `:20380-20390`). Without `wait: true` Discord answers with no body, which the lenient reading
  returns as `{}` typed as a message. The plain way is one POST to the webhook's address with `effect/http/HttpClient`
  and no distilled client; the address carries its own token, so no `Authorization` header goes with it (Discord's
  documented behaviour, not run here). Keep the whole address as one `Config.Redacted` setting, unwrapped only in
  the adapter:

  ```ts
  // SKETCH: not compiled
  import * as Effect from "effect/Effect"
  import * as HttpClient from "effect/http/HttpClient"
  import * as HttpClientRequest from "effect/http/HttpClientRequest"
  import * as HttpClientResponse from "effect/http/HttpClientResponse"
  import * as Redacted from "effect/Redacted"

  // webhookUrl: the address Discord gives for the channel's webhook, read in Settings.ts as Config.Redacted.
  const postToChannel = Effect.fn(function* (webhookUrl: Redacted.Redacted<string>, content: string) {
    const request = yield* HttpClientRequest.post(Redacted.value(webhookUrl)).pipe(
      HttpClientRequest.setUrlParam("wait", "true"),
      HttpClientRequest.bodyJson({ content })
    )
    const response = yield* HttpClient.execute(request)
    return yield* HttpClientResponse.filterStatusOk(response)
  })
  ```

  The `effect` 4.1.4 names are `HttpClientRequest.post`, `setUrlParam`, `bodyJson` (`src/http/HttpClientRequest.ts:211`,
  `:909`, `:1360`), `HttpClient.execute` (`src/http/HttpClient.ts:186`) and `HttpClientResponse.filterStatusOk`
  (`src/http/HttpClientResponse.ts:338`). A plain POST has no retry of its own: a failed post fails the policy, which
  runs it again; a cut-off response can then post twice, which a channel notice can bear.
- **Not sign-in.** Signing in with Discord is Better Auth's social provider, a separate matter: see
  [Discord sign-in](./discord-sign-in.md). The client cannot create the OAuth application or set its redirect URIs
  (research 02 §3.16).
- **Verdict.** **Use:** run time, behind `TeamChannel` and a policy, once the owner wants a channel told: with a bot
  token, `createMessage` and credentials from `Config.Redacted("DISCORD_BOT_TOKEN")` via `Discord.credentials`; with
  only a channel webhook, the plain `HttpClient` POST above and no distilled client.

### Grafana

- **What it is.** A client for a Grafana instance's HTTP API: 250 operations (`packages/grafana/src/services/grafana.ts`),
  including data sources, annotations, `importDashboard`, public dashboards, snapshots, folder permissions, service
  accounts and searches. There is no `postDashboard`/create-dashboard and no create-folder operation; dashboards go in
  through `importDashboard` (`POST /api/dashboards/import`, input `{ dashboard, folderUid?, overwrite?, inputs? }`,
  errors `BadRequest | UnprocessableEntity`; `grafana.ts:1989-1998`, `:5761-5776`, `:8793`). Credentials: a service
  account `token`, `apiBaseUrl` default `http://localhost:3000` (the protocol appends `/api`), optional `orgId` sent
  as `X-Grafana-Org-Id` (`packages/grafana/src/credentials.ts:23-49`, `protocol.ts:49-68`). `CredentialsFromEnv`
  reads `GRAFANA_TOKEN`, `GRAFANA_URL`, `GRAFANA_ORG_ID` from `process.env` (`credentials.ts:55-72`); the README calls
  `GRAFANA_ORG_ID` required, the code does not.
- **The use.** Not at run time. The app's Grafana is the optional local stack (`apps/inventory/telemetry/compose.yaml`:
  `grafana/otel-lgtm` with Grafana on `127.0.0.1:3000`, OTLP on 4317/4318, nothing kept after `telemetry:down`). An
  operator script, run after `bun run telemetry`, imports a dashboard declared as code for the domain's spans and
  metrics ([observability](./observability.md): `domain.commands` by `domain.outcome`, `domain.command.duration`,
  `domain.lag` by `domain.consumer`, `domain.external.calls` by `domain.system`), with `overwrite: true` so a second
  run replaces it. Because the stack forgets everything on stop, the script runs every time it starts. Production
  telemetry is Workers Logs, not this Grafana (research 02 §8). How the otel-lgtm image's Grafana is signed into (a
  service account token, or anonymous admin) is not verified.
- **Verdict.** **Use:** an operator's script (not the Worker, not a stack) that calls `Grafana.importDashboard` with
  `Grafana.fromApiKey({ apiKey, apiBaseUrl: "http://localhost:3000" })` against the local stack.

### GitHub

- **What it is.** A client for GitHub's REST API: 1,235 operations (997 plain, 238 paginated) in 46 area modules
  (`packages/github/src/services/*.ts`; `webhooks.ts` holds webhook payload types and no operation), plus a GraphQL
  client at `@distilled.cloud/github/GraphQL` (the `GitHub` roots and the `GraphQLLive` transport, which uses the same
  `Credentials`; `src/graphql-index.ts:21-33`). Credentials: `token`, `apiBaseUrl` default `https://api.github.com`,
  `userAgent` (GitHub refuses requests without one), optional `issuedAt` (`packages/github/src/credentials.ts:22-96`);
  `GITHUB_TOKEN` then `GH_TOKEN`, plus `GITHUB_API_URL` and `GITHUB_USER_AGENT` (`credentials.ts:51-64`). GitHub App credentials (`App.appCredentials`, `App.installationCredentials`, minting
  and refreshing tokens with WebCrypto; `src/app.ts:1-40`, `:264-310`) and the OAuth web-flow exchange
  (`OAuth.exchangeWebFlowCode`, `src/oauth.ts:207-231`). The protocol pins `X-GitHub-Api-Version: 2022-11-28`, maps a
  rate-limited 403/429 to `TooManyRequests`, re-sends a 401 within five seconds of a fresh token, and can space writes
  (`paceWrites`) (`src/protocol.ts:14-34`, `:51`, `:102`, `:174`).
- **The provider against the raw client.** The app already declares its repository's environments, secrets,
  variables and ruleset with Alchemy's GitHub provider (`packages/infra/src/GitHub.stack.ts:75-179`: `GitHub.Environment`,
  `GitHub.Secret`, `GitHub.Variable`, `GitHub.Ruleset`). That provider is built on this client
  (`@distilled.cloud/github` in `packages/github/package.json` at both refs) and adds what the raw client lacks:
  state, diff, destroy. See [github](./github.md). Calling the raw client for the same things would be imperative
  writes with no record of what the stack owns.
- **The use.** None at run time: no screen or rule of the app talks to GitHub. An operator's read Alchemy has no
  resource for (for example the deploy workflow's latest run) is the raw client's honest place.
- **Verdict.** **Use:** through Alchemy's GitHub provider, as the app already does; the raw client only for operator
  reads the provider lacks. No run-time use.

### Docker

- **What it is.** A client for the Docker Engine API: 106 operations (`packages/docker/src/services/docker.ts`:
  containers, images, networks, volumes, swarm services, secrets, plugins, exec). Credentials: an optional bearer
  `apiKey`, `apiBaseUrl` default `http://localhost/v1.56` (`packages/docker/src/credentials.ts:16-53`);
  `CredentialsFromEnv` reads `DOCKER_API_KEY` and `DOCKER_API_BASE_URL` from `process.env`. The Engine usually listens
  on a Unix socket; `FetchHttpClient` cannot reach one, so the daemon must be exposed over TCP or the program must
  provide a socket-capable `HttpClient` (not verified which works).
- **The use.** None at run time, and none needed at deploy time: the local telemetry stack is started by
  `apps/inventory/scripts/telemetry.mjs`, which runs `docker compose up -d` on `telemetry/compose.yaml`. Alchemy has
  its own `@alchemy.run/docker` (`packages/docker/` at main, with `Container.ts`), which drives the Docker CLI rather
  than this client (the package is at both refs). If the stack were declared as code, that is the resource to use, not
  raw Engine calls.
- **Verdict.** **Use:** in an operator's script at most, and the evidence is against even that: the compose file
  already starts and stops the stack. The one honest task is a status check after `bun run telemetry`:
  `Docker.listContainer({ all: true, filters: '{"name":["inventory-telemetry"]}' })` (`docker.ts:2750-2759`,
  `:5452`; the name is `container_name` in `apps/inventory/telemetry/compose.yaml`, line 11) to say whether the stack
  is up, with `Docker.fromApiKey({ apiBaseUrl })` (`credentials.ts:28-39`, the key optional) pointed at a daemon
  reachable over TCP. Whether `FetchHttpClient` can reach the local daemon at all is not verified.

### 1Password

- **What it is.** Five clients in one package, each with its own credentials and protocol: Connect (15 operations
  against a self-hosted Connect server, default `http://localhost:8080/v1`, `OP_CONNECT_TOKEN`), Events (7, audit
  events and sign-in attempts), Users (4, suspend and reactivate; an OAuth client-credentials token minted and cached
  for you), OAuth (3) and Partnership (4) (`packages/onepassword/README.md`, `src/credentials.ts:1-434`,
  `src/protocol.ts:87-181`, `src/services/*.ts`). It reads through core config, so a provided `ConfigProvider` works.
- **What it cannot do.** It has no `op://` reference resolver and no service-account path: nothing in `src/` or the
  README mentions either. A vault item's `Field.value` is a plain `string`, not `Redacted`
  (`src/services/connect.ts:225-238`). Reading a secret needs a running Connect server.
- **Checking the earlier finding.** The exploration's README says the package "wraps the Connect REST API and cannot
  resolve `op://` references" (`explorations/ideal-architecture/README.md:48`). The second half holds. The first half
  is narrow: it wraps five APIs, and Connect is the only one that reads vault items. The research note's fuller
  sentence (`research/02-alchemy-infra.md:27`, and §3.17) is accurate. Its other claim, that Alchemy has no 1Password
  provider (§3.17), holds for what is published, and no longer for `main`: `@alchemy.run/1password` there offers
  `SecretReferences({ references: { NAME: "op://..." } })` and `Environment(...)` as stack secret providers, read by
  `@1password/sdk` (the references in one batch, an Environment's variables in one read;
  `packages/1password/src/internal/sdk.ts:91-113`). It is not published.
- **What `@alchemy.run/1password` does** (`main@dbfd0ddb`, commit `3ff34b94f`, #2749).
  - **What it resolves.** `SecretReferences` resolves `op://vault/item/[section/]field` references, optionally with
    `?attribute=otp` (or `totp`) or `?ssh-format=openssh`, each under the config key it is mapped to; `Environment`
    loads every variable of one 1Password Environment by `environmentId`, and a value there that contains `op://`
    stays literal (`packages/1password/src/SecretsProvider.ts:62-162`).
  - **With what credential**, in this order: the setting `OP_SERVICE_ACCOUNT_TOKEN`, read from the real process
    environment only, never from an earlier `secrets` entry; then the `account` option (the desktop app's account
    name, sign-in address or UUID), refused when `CI` is true; then the selected Alchemy profile
    (`alchemy profile edit --add 1Password`, method `desktop` with an account or `service-account` with a stored
    token). A rejected token never falls back to the desktop app (`src/AuthProvider.ts:93-123`, `:187-202`;
    `packages/alchemy/src/Secrets/Provider.ts:56-75`).
  - **Deploy time only.** Each entry is a `ConfigProvider.layerAdd(..., { asPrimary: true })` in the stack's
    `secrets`, fetched once when the stack loads, read in the stack with `Config.Redacted`, and never written to
    `process.env` or disk (`SecretsProvider.ts:46-60`, `README.md:41-44`). A value reaches the Worker only if the
    stack binds it into the Worker's `env`; the Worker never talks to 1Password. The SDK is imported only when secrets
    are read, so Alchemy's offline discovery of a stack fetches nothing (`src/internal/sdk.ts:31-35`,
    `SecretsProvider.ts:53`).
  - **Failure is whole and named.** One unresolvable reference fails the load with `OnePasswordReferenceError` naming
    its config key, and nothing partial is loaded (`sdk.ts:95-103`, `src/Errors.ts:83`); a rate limit is
    `OnePasswordRateLimitError` and is not retried; a call times out after 30 s, 60 s while the desktop app waits for
    approval (`sdk.ts:66-75`); the others are `OnePasswordAuthExpiredError`, `OnePasswordDesktopSessionExpiredError`,
    `OnePasswordAccountNotFoundError`, `OnePasswordTimeoutError`, `OnePasswordSdkError` (`src/Errors.ts:12-91`).
  - **Not on npm.** `@alchemy.run/1password` answers 404 on the registry (checked 2026-11-19), although its
    `package.json` says version `2.0.0-beta.87`, peer `alchemy` `workspace:*`, dependency `@1password/sdk` (`0.5.0` in
    main's `pnpm-workspace.yaml:52`).
- **Secrets on a deploy.** Today the app keeps `op://` references in `packages/infra/env/op.env` and deploys under
  `op run`, so values exist only in the deploying process and in Alchemy's state (research 02 §4e, where the
  distilled Connect route is the rejected row). That
  stays right on beta.87. Once `@alchemy.run/1password` is taken, `SecretReferences` could replace `op run` for
  the stacks, listed in the stack's `secrets`; that is a stack change, not a run-time one. Keeping `op run` for the
  same names alongside it does not work as meant: the process environment is the implicit last `secrets` entry and
  overrides every earlier one (`website/src/content/docs/environments/secret-providers.mdx:32-41` on main), so values
  `op run` exported would win. Drop `op run` for those names, or list `Alchemy.Secrets.ProcessEnv()` first.
- **The use.** None at run time (the Worker gets its secrets from the stack's `env`), and none at deploy time for
  this client: the evidence is against it as a way to put secrets on a deploy, since it cannot resolve `op://`
  references and returns field values as plain strings. Its honest use is an operator's audit read with the Events
  client: `getItemUsagesV2` (or `getAuditEventsV2`) with `eventsCredentials({ token, apiBaseUrl })` and an Events API
  token (`OP_EVENTS_API_TOKEN`, default host `https://events.1password.com`; `src/credentials.ts:93-130`,
  `src/services/events.ts`), to see which deploys read the production model key. The Events API is a 1Password
  Business feature; whether the owner's account has it is not verified.
- **Verdict.** **Use:** the Events client in an operator's script, as above. For `op://` references on a deploy:
  **Use, from main:** `@alchemy.run/1password`'s `SecretReferences({ references: { OPENROUTER_API_KEY: "op://…" } })`
  passed in the stack's `secrets`, read in the stack with `Config.Redacted`, authorized by `OP_SERVICE_ACCOUNT_TOKEN`
  in CI or the desktop app locally. Taking it means copying its six source files (`src/{AuthProvider,Contributions,
  Errors,index,SecretsProvider}.ts`, `src/internal/sdk.ts`) or building the package from main, and adding
  `@1password/sdk`. Every `alchemy` module and name it imports (`Auth/AuthProvider`, `Auth/Env`, `Auth/Resolve`,
  `Auth/StoredAuthProvider`, `Auth/Profile`, `Interaction`, `Secrets/Provider`, `Secrets/Log`, `Contributions`,
  `UserFacingError`) exists in the `alchemy` `2.0.0-beta.87` the app pins (`packages/infra/package.json`, lines
  23-27), checked by name, not compiled or run. Until it is taken, `op run` stays.

- **Used today:** no distilled client is a direct dependency of the app (`package.json` files); `@distilled.cloud/core`,
  `cloudflare` and `github` arrive inside Alchemy's providers. GitHub is used through `GitHub.stack.ts`.
- **Where it goes:** Discord behind a `TeamChannel` external system in a new driver beside `packages/drivers/openrouter/`;
  the Grafana dashboard script beside `apps/inventory/scripts/telemetry.mjs`; nothing for Docker or 1Password.
- **What the person gets:** a team channel told when an import is confirmed or taken back (Discord); the rest is for
  the operator, nothing they can see.

## How to check it

- For a run-time client behind an external system: a [story](./story.md) answers the declared call
  (`Story.call(TeamChannel.post, ...)`, `Story.succeed(...)`), and an adapter test with a fake `HttpClient` proves the
  client's error mapping (a Discord 403 becomes the declared refusal or a failure, never a silent success).
- For the Grafana script: run it twice against a fresh `bun run telemetry`; the second run must report the same
  dashboard uid (`overwrite: true`) and no `UnprocessableEntity`.
- For any client: `bun run typecheck` catches a wrong import path or an operation name the README got wrong.

## What it needs

No domain host for the deploy-time and operator uses. A policy and an external system for the Discord use: any host
that runs policies ([in memory](./host-in-memory.md) for stories, [Cloudflare](./host-cloudflare.md) Durable Objects
here), on `v2.0.0-beta.87`. Each client at `1.0.0-rc.20` from npm, `effect` 4.1.x, `FetchHttpClient`, and the
provider's token (or, for Discord, the webhook address) as a stage setting (never on a preview).

## Verdict

**Use:** Discord at run time behind a policy and an external system (the client with a bot token, or a plain
`HttpClient` POST to a channel webhook, which the client cannot make without a token); Grafana in an operator's script against the local
telemetry stack; GitHub through Alchemy's provider as today; Docker, if at all, as an operator's status check (the
compose file already does its job); 1Password's Events client for an operator's audit read.

**Use, from main:** `@alchemy.run/1password` (not the distilled client, which cannot resolve `op://` references) to put
the stacks' secrets on a deploy from `op://` references, authorized by `OP_SERVICE_ACCOUNT_TOKEN`; taking it needs
main's six source files (not on npm) and `@1password/sdk`, against the app's `alchemy` `2.0.0-beta.87`, whose names it
imports all exist (not compiled).

## Where this was read

- https://github.com/alchemy-run/distilled (the repository's `README.md`, at `51ba3a2c6`)
- distilled `packages/{discord,grafana,github,docker,onepassword}`: `README.md`, `package.json`, hand-written `src/*.ts`
  in full (GitHub's `graphql*.ts` included), generated `src/services/*.ts` by outline (`createMessage`,
  `executeWebhook`, `importDashboard` in full); `packages/core/src/{retry,category}.ts` in full, the rest of
  `packages/core/src` by outline
- `packages/domain/src/Cloudflare/Backfill.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (retry added)
- `packages/*/package.json` at both refs (beta.87 through `gh api repos/alchemy-run/alchemy/contents/...`);
  `packages/1password/{README.md,package.json,src/*.ts,src/internal/sdk.ts}` on `main@dbfd0ddb`: new, in full;
  `website/src/content/docs/environments/secret-providers.mdx` on `main@dbfd0ddb`: changed (one line);
  `packages/alchemy/src/Secrets/Provider.ts` on `main@dbfd0ddb`; `packages/docker/src` at both refs
- the app's installed `alchemy` `2.0.0-beta.87` (`node_modules/alchemy/src`), checked by name for the modules
  `@alchemy.run/1password` imports
- https://alchemy.run/environments/secret-providers (listed in the site's index; names dotenv, Doppler, Infisical)
- the app: `apps/inventory/telemetry/compose.yaml`, `apps/inventory/scripts/telemetry.mjs`,
  `packages/infra/src/GitHub.stack.ts`, `explorations/ideal-architecture/README.md`,
  `explorations/ideal-architecture/research/02-alchemy-infra.md`
