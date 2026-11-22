---
type: Reference
title: Sign in with Discord
description: Discord as a Better Auth sign-in provider for inventory-import: the settings, the callback address, the scopes, how a Discord person becomes a member, what a deployed stage needs, and what the sign-in screen shows.
tags: [alchemy-domain, people-and-clients]
---

# Sign in with Discord

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

Discord sign-in is Better Auth's built-in `discord` social provider: the browser is sent to Discord, the person
approves, Discord sends them back to `/api/auth/callback/discord` with a code, and Better Auth exchanges it, reads the
person's Discord profile, creates or finds a `user`, stores an `account` row (`providerId` `discord`, `accountId` the
Discord user id) and sets the same session cookie a password sign-in sets. Nothing in `@alchemy.run/better-auth` or
`@alchemy.run/domain` is specific to Discord, and the Alchemy docs have no Discord page; their provider pages give the
rules that carry over, and the custom OAuth page is the nearest. That page's rule for any provider id: "do not rename
it or point it at an unrelated issuer once accounts exist." [https://alchemy.run/better-auth/sign-in-providers/custom-oauth]

This is signing in with Discord. The distilled `discord` package is a client for Discord's own API (commands,
messages, guilds) and has nothing to do with sign-in; see [distilled-clients](./distilled-clients.md).

## When to reach for it

When the people who import files already have Discord accounts and the owner wants them to skip a password. It adds a
way to prove who you are; it does not add anyone to an organization. Membership stays the People page's job
(`packages/access/host/src/PeopleStore.adapter.ts`), and the session reaches `CurrentActor` exactly as today
(see [better-auth](./better-auth.md) and [sessions](./sessions.md)).

## How it is declared

Better Auth 1.7.22 (the version the app pins and has installed) declares the provider in the package
`@better-auth/core`, file `src/social-providers/discord.ts`:

- `discord(options)` with `clientId`, `clientSecret`, optional `prompt` (`"none"` or `"consent"`), `permissions` (only
  used with the `bot` scope), `scope`, `disableDefaultScope`, `mapProfileToUser`, `getUserInfo`
  (`src/social-providers/discord.ts` 80-84, with `ProviderOptions`).
- Id `discord`; the account subject is the profile's `id`, Discord's numeric user id (a snowflake), never the email
  (`discord.ts` 89-91).
- Scopes: `identify` and `email` unless `disableDefaultScope` (`discord.ts` 93-95). Authorization at
  `https://discord.com/api/oauth2/authorize`, token at `https://discord.com/api/oauth2/token`, profile from
  `https://discord.com/api/users/@me`.
- `prompt` defaults to `"none"` (`discord.ts` 104): a person who approved the app before is not asked again.
- The user it makes: `name` is `global_name`, else `username`; `email` is the profile's `email`, which may be absent or
  `null`; `emailVerified` is the profile's `verified`; `image` is a `cdn.discordapp.com` address
  (`discord.ts` 46-48, 134-170).
- Every endpoint is fixed in the file: authorization (line 100), token (line 87, used at 118) and profile (line 139).
  No option points them elsewhere; only `getUserInfo` can replace the profile read.
- From the shared `ProviderOptions` (`@better-auth/core`, `src/oauth2/oauth-provider.ts` 307-441) a provider also takes
  `disableSignUp` (never create a user through it, line 394), `disableImplicitSignUp` (create one only when the
  sign-in asks for it, line 390) and `requireEmailVerification` (line 440, default false: when the provider says the
  email is unverified, the user and account are still created but no session is issued, and the callback redirects
  with `error=email_not_verified`; `better-auth/dist/oauth2/link-account.mjs` 354-362).

In this app it is one more key in the options object, beside `emailAndPassword`:

```ts
// SKETCH: not compiled
// packages/access/host/src/internal/authOptions.ts: two new inputs, one new key
  readonly discord?: { readonly clientId: string; readonly clientSecret: string } | undefined
// ...
    ...(input.discord === undefined ? {} : { socialProviders: { discord: input.discord } }),
    account: { accountLinking: { disableImplicitLinking: true } },
```

```ts
// SKETCH: not compiled
// packages/access/host/src/Config.ts: both or neither
    discord: Config.all({
      clientId: Config.String("DISCORD_CLIENT_ID"),
      clientSecret: Config.Redacted("DISCORD_CLIENT_SECRET")
    }).pipe(Config.option),
```

`SignIn.route.ts` passes `O.getOrUndefined(O.map(settings.discord, ({ clientId, clientSecret }) => ({ clientId,
clientSecret: Redacted.value(clientSecret) })))` to `authOptions`, the same way it passes the other settings.

**The callback address** is the app's origin plus `/api/auth/callback/discord` (Better Auth's `basePath` is
`/api/auth`). Register each one in the Discord Developer Portal under the application's OAuth2 redirects, exactly:
`http://localhost:5173/api/auth/callback/discord` for `bun run dev`, and each deployed stage's address. Discord
returns with a GET, which the app's cross-site guard on `/api/auth/*` lets through (reading methods are always
allowed: `packages/kernel/src/SameOrigin.middleware.ts` 68-76).

Checked in: Better Auth 1.7.22 as installed in the app: `@better-auth/core/src/social-providers/discord.ts` 1-174,
`@better-auth/core/src/oauth2/oauth-provider.ts` 307-441, `better-auth/dist/api/routes/callback.mjs` 75-173,
`better-auth/dist/oauth2/link-account.mjs` 60-75, 160-175, 300-362. Alchemy has no Discord code at either ref.

### What main changes

Nothing. Neither ref has a Discord provider page or Discord code in `packages/better-auth`; the sign-in provider pages
are the same on both.

## Rules, and the mistakes to avoid

From Better Auth's source, as the app is configured:

- **A Discord person with no email cannot sign in.** The callback refuses a profile without an email
  (`EMAIL_NOT_FOUND`, `callback.mjs` 127-129) and sends the browser to the error address.
- **A new Discord person is a new `user`, and `SIGN_UP` still applies.** The app's `user.create.before` hook
  (`authOptions.ts`, `databaseHooks.user.create`) runs for every way an account is made, so on a deployed stage
  (sign-up closed) a Discord person whose email is not named is refused. Read from source, not run: the hook rejects
  with `new APIError("FORBIDDEN", { message })` and no `code` (`authOptions.ts:137`); the user creation rethrows an
  `APIError` (`link-account.mjs` 339-340); the callback redirects to the error address only for an `APIError` with
  `body.code` and otherwise rethrows it (`callback.mjs` 152-154). So the person is left on
  `/api/auth/callback/discord` with Better Auth's 403 answer, not the error page. Giving that `APIError` a `code`
  (for example `SIGN_UP_CLOSED`) would send them to the error address with it.
- **An existing password account is not joined to Discord by email.** Better Auth links on email only when the
  provider says the email is verified and the local user's email is verified too (`requireLocalEmailVerified`
  defaults to true, `link-account.mjs` 168-173). This app sends no email, so no password user is verified, and a
  Discord sign-in with the same address ends in "account not linked". Set `disableImplicitLinking: true` (as the
  Alchemy GitHub and custom OAuth pages do) to make that explicit; a signed-in person adds Discord to their own account
  with Better Auth's `linkSocial` instead. Never turn on `trustedProviders` or switch off `requireLocalEmailVerified` to
  make the merge happen.
- **Matching to a member is by the `user` row, then the People page.** An admin adds a person by the email they signed
  up with (`PeopleStore.accountByEmail` matches `lower(email)` on `user`), so a Discord person is added by the email
  Discord gave. Discord's email may be unverified (`emailVerified` false). Someone could then create a user with a
  colleague's address and be added in the colleague's place. Refusing an unverified Discord email is a decision for
  the owner (below), not a default. `requireEmailVerification: true` on the provider is the built-in way, but it still
  creates the `user` row, and since this app sends no email that user could never verify; refusing in the
  `user.create.before` hook when `emailVerified` is false creates nothing (not run).
- **The provider id is permanent.** `discord` is both the callback path and the stored `providerId`.
- **Keep secrets server-side.** `DISCORD_CLIENT_SECRET` is read with `Config.Redacted`, never put in a `VITE_*`
  variable, the browser bundle or a log (Alchemy sign-in providers overview).
- **Two redirects.** The provider's redirect is `/api/auth/callback/discord`; the browser's `callbackURL` (`/`) is the
  page after success. Better Auth handles state, PKCE where the provider supports it, and the code exchange.
- **No extra scopes.** `identify email` is all sign-in needs; `guilds` or `bot` are for a different feature.
- The session hook that opens a new session in the person's earliest organization runs for a Discord session too; a
  person in no organization sees the "Create your organization" screen when sign-up allowed them in.

## In this app

Priya is an editor of `org_prairie`. She signed up with email and password months ago. The owner turns on Discord.
Priya presses "Sign in with Discord", Discord shows her own address as verified, and Better Auth refuses with
"account not linked", because her password account's email was never verified. She signs in with her password, opens
her account menu, presses "Connect Discord" (`linkSocial`), and from then on either way signs her in as the same user,
the same member, with the same role. Marco is new: the owner has put his address in `SIGN_UP`; he signs in with
Discord, a `user` is created from Discord's name and email, he is in no organization, and the admin adds him on People
by that email as a viewer.

The screen (`packages/access/web/src/SignIn.screen.tsx`) today shows an email and password form, a sign-up switch when
`features.signUp` allows it, and the test accounts in development. It needs to know whether Discord is on:
`SignInFeatures` (`packages/access/contract/src/Session/SessionState.read.ts` 112-135) gains `discord: S.Boolean`, set
by `Sessions` in `SessionIdentity.adapter.ts` when both settings are present. The card then shows one outline button,
"Sign in with Discord", under the form (the form's submit stays the one filled button):

```ts
// SKETCH: not compiled
// authClient() is the screen's lazy import of ./internal/authClient.ts (SignIn.screen.tsx:26)
const signInWithDiscord = () =>
  authClient().then(({ authClient: client }) =>
    client.signIn.social({ provider: "discord", callbackURL: "/", errorCallbackURL: "/?signIn=failed" })
  )
```

`errorCallbackURL` is an option of Better Auth's sign-in route (`better-auth/dist/api/routes/sign-in.mjs` 37); without
it, a failure lands on Better Auth's own `/api/auth/error` page, which is what the Alchemy provider pages recommend.
The app's house rule is a sentence in its own words, so the sign-in page would read the query and say, for example,
"Discord did not give us an email address" or "This email already has an account. Sign in with your password, then
connect Discord". Which of the two the app does is the owner's call. The Discord avatar address is stored in
`user.image`; showing it would need `cdn.discordapp.com` allowed by the image policy in the security headers (not
checked).

**A deployed stage.** `packages/infra/src/Inventory.stack.ts` reads settings from the deploy's environment with
`Config` (`secretOf` for secrets, 41-45) and binds them into the Worker's `env` (113-129). Discord adds two:
`DISCORD_CLIENT_ID` as text and `DISCORD_CLIENT_SECRET` through `secretOf`, both bound only when the stage's plan
names Discord, like the model key. The values come from secret references the deploy resolves (a workflow's secrets,
or a reference resolved when the deploy runs); they are never written into the repository or the stack's output.
`BETTER_AUTH_URL` is already `Cloudflare.Worker.URL` (line 116), so each stage's callback is that address plus
`/api/auth/callback/discord`, and every stage's address must be registered with Discord before its first Discord
sign-in. Local development adds the two names to `apps/inventory/.dev.vars.example` (names only).

**Decisions for the owner** before building: (1) refuse an unverified Discord email, or accept it as the account's
address (recommend refuse); (2) linking only from a signed-in session, or no linking at all (recommend linking from a
session); (3) which stages offer Discord (each needs its address registered and its own Discord application for
production); (4) Better Auth's error page or the app's own sentence.

- **Used today:** no. The app offers email and password only (`docs/auth.md`, "Not done", lists social sign-in as
  not built).
- **Where it goes:** `packages/access/host/src/internal/authOptions.ts` (`socialProviders.discord`, `account`),
  `packages/access/host/src/Config.ts` (two settings), `packages/access/host/src/SignIn.route.ts` (pass them),
  `packages/access/contract/src/Session/SessionState.read.ts` and `SessionIdentity.adapter.ts` (`features.discord`),
  `packages/access/web/src/SignIn.screen.tsx` (the button), `packages/infra/src/Inventory.stack.ts` (two env
  entries), `apps/inventory/.dev.vars.example`, `docs/auth.md`.
- **What the person gets:** one button that signs them in with their Discord account, no password to remember.

## How to check it

- A slow test in the style of the Alchemy example's `test/SignIn.test.ts`: a local OAuth server stands in for
  Discord. The `discord` provider cannot be pointed at it (its token endpoint is fixed, `discord.ts` 87 and 118; only
  `getUserInfo` can be replaced), so the test uses `genericOAuth` against `oauth2-mock-server` with a Discord-shaped
  profile. The provider's own mapping (name, email, `verified`, avatar) sits inside its default `getUserInfo`, which
  fetches discord.com (`discord.ts` 134-171), so it is not testable offline; a `getUserInfo` override replaces it.
  How the stand-in behaves in 1.7: a `genericOAuth` provider is started with `signIn.social({ provider: <id> })` (a
  POST to `/api/auth/sign-in/social`) and calls back at `/api/auth/callback/<id>`, no longer
  `/oauth2/callback/<id>` (custom OAuth page 88; upgrade guide 96-112). The Alchemy example configures it with a
  discovery URL and `pkce: true` and feeds the profile through `beforeUserinfo` with `email_verified: true`
  (example `test/SignIn.test.ts` 26-38, 55-65). With discovery the account subject is the token's `sub`; with plain
  `authorizationUrl`/`tokenUrl`/`userInfoUrl` it is the raw profile's `id`, which matches Discord's shape (custom
  OAuth page 335, 343). Only the real `discord` provider reads Discord's `verified` field; which field
  `genericOAuth` reads for email verification by default is not verified, so the test sets it with
  `mapProfileToUser` (the page names that option for nonstandard fields). The example also proves, without any network, that a
  built-in provider's start answers with the provider's address, the right `client_id` and a `redirect_uri` ending
  `/api/auth/callback/<id>` (`SignIn.test.ts` 151-171): the same check works for `discord` and its fixed
  `https://discord.com/api/oauth2/authorize`.
  Cases: a verified new email named in `SIGN_UP` signs in and is in no
  organization; the same email when not named is refused and no `user` row exists; a profile with no email is refused;
  a Discord sign-in with an existing password user's email is refused and both rows are unchanged; after `linkSocial`
  the same `user.id` comes back from both sign-ins.
- The existing `apps/inventory/test/server/Auth.slow.test.ts` check that a foreign callback address is refused, run
  for `/sign-in/social` too.
- On screen: the button is absent when the two settings are not set, and present when they are.

## What it needs

Better Auth's `discord` provider (in `better-auth` 1.7.22, already installed); a Discord application with a client id,
a client secret and every callback address registered; the two settings in the Worker's `env`. No Alchemy package, no
domain host, no table change (`account` already has the token columns). Works with the app's own driver today and
with `@alchemy.run/better-auth` later, since both pass the same options to `betterAuth`.

## Verdict

**Use:** add `socialProviders.discord` to `authOptions.ts` behind the two settings, with `disableImplicitLinking: true`,
a `features.discord` flag and one outline button, once the owner has made the four decisions above.

## Where this was read

- https://alchemy.run/better-auth/sign-in-providers, `/github`, `/google`, `/microsoft`, `/custom-oauth`,
  `/email-password` (the live site documents beta.87)
- `website/src/content/docs/better-auth/sign-in-providers/{index,github,google,microsoft,custom-oauth,email-password}.mdx`
  at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same; also `upgrades/from-1-6-to-1-7.mdx` (same)
- `examples/cloudflare-domain-better-auth/test/SignIn.test.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (the
  `WriteNote` calls only)
- `website/src/content/docs/domain/better-auth.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (not in the
  parts about providers)
- Better Auth 1.7.22 as installed: `@better-auth/core/src/social-providers/discord.ts`,
  `@better-auth/core/src/oauth2/oauth-provider.ts`, `@better-auth/core/dist/error/index.mjs`,
  `better-auth/dist/api/routes/callback.mjs`, `better-auth/dist/oauth2/link-account.mjs`,
  `better-auth/dist/api/routes/sign-in.mjs`; `better-call/dist/error.mjs` 1.4.5
- The app: `packages/access/host/src/internal/authOptions.ts`, `Config.ts`, `SignIn.route.ts`,
  `SessionIdentity.adapter.ts`, `PeopleStore.adapter.ts`, `packages/access/web/src/SignIn.screen.tsx`,
  `packages/access/web/src/internal/authClient.ts`, `packages/access/contract/src/Session/SessionState.read.ts`,
  `packages/kernel/src/SameOrigin.middleware.ts`, `packages/infra/src/Inventory.stack.ts`, `docs/auth.md`
- The distilled `discord` package README (a Discord API client, not sign-in)
