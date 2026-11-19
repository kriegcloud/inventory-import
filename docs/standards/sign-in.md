---
type: Standard
title: Sign-in
description: Better Auth on D1 with organizations, one-click test accounts and a signed-in start in development, its security settings, and the settings that keep it fast.
tags: [security]
status: draft
---

Sign-in is installed: accounts, organizations, roles and sessions. In development the app opens already signed in
as the first test account, so it costs the person running it no step at all; a production build shows the sign-in
page, where nobody has an account yet. How it is wired is in [sign-in](../auth.md).

## What it is

- **Better Auth on D1 through its built-in D1 support**: the D1 binding is passed as the database. Its SQLite adapter
  page does not apply (that adapter cannot run inside a Worker), and `better-auth/minimal` is not used (it cannot
  take a direct D1 connection). Check: `packages/access/host/src/internal/authOptions.ts` passes the binding.
- **Organizations through its organization plugin** on the app's own organization and member tables: that is the
  tenancy ([security](security.md)). Check: a new account gets its own organization.
- **Email and password for now.** The write-up says why it is not what production should use (phishing, reuse,
  no second factor), and what would come next: a second factor or passkeys, and a log of sessions a person can see
  and end. Check: "To make this production-ready" has that paragraph.
- **A signed-in start in development, and one-click test accounts**, so nobody running the app has to sign up.
  Check: from a fresh `bun install && bun run dev`, the app opens on Import signed in as the first test account,
  through a real session cookie; the user menu signs in as another account in one click; after a sign-out the
  sign-in page offers each account in one click; `bun run preview` shows the sign-in page.

## Its security settings

- **Password hashing** is Better Auth's own (scrypt). Check: no hashing code of ours.
- **`BETTER_AUTH_SECRET`** is in the setup steps, and `.dev.vars.example` carries the `openssl` command that makes
  one. Check: the README and `.dev.vars.example` both name it.
- **Sessions**: expiry and refresh set on purpose; a revoked session ends at once. Check: sign out in one tab; the
  next request in another tab is refused.
- **Secure cookies** in production (`__Secure-` prefix, `Secure`, `HttpOnly`). Check: `Set-Cookie` under
  `bun run preview`.
- **Rate limits** on sign-in and sign-up, stored where every isolate sees them. Check: eleven bad sign-ins in a minute
  end in `429`.
- **CSRF protection and origin checks** on every mutation and sign-in endpoint, and **trusted origins** set from
  `BETTER_AUTH_URL` when it is set. Check: a cross-origin sign-in is refused, with its check turned on in the test.
- **Better Auth's own usage telemetry stays off.** Its instrumentation does nothing inside a Worker, so our Effect
  spans around each Better Auth call are what the telemetry sees. Check: `telemetry: { enabled: false }`.
- **The breached-password check** (Have I Been Pwned) is behind a setting: on in production. The README says how it
  behaves in development: it refuses a sign-up when it cannot reach the service. Check: with the setting on, a known
  breached password is refused at sign-up.

## Keeping it fast

- **The indexes Better Auth's performance guide recommends**: users `email`; accounts `userId`; sessions `userId`
  and `token`; verifications `identifier`; invitations `email` and `organizationId`; members `userId` and
  `organizationId`; organizations `slug`. Check: each is in the migration.
- **Background tasks run after the response**: `advanced.backgroundTasks` hands them to the Worker's `waitUntil`, so
  cleanup and rate-limit updates do not hold the answer. Check: the option is wired.
- **The session is fetched once and cached on the client**, not by every component. Check: one session request per
  page load in the network panel.
- **The cookie cache is off by default**, so a revoked session ends at once. A short `maxAge` is a production choice,
  written down with the lag it accepts. Check: `session.cookieCache` is off, or the write-up names its lag.
