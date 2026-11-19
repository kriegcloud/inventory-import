---
type: Integration Guide
title: Sign-in
description: How sign-in, sessions, organizations and roles are wired (Better Auth on D1), how development opens signed in, the People page, its settings, how it stays fast, how to change the schema, and what is not done.
tags: [security, cloudflare]
status: draft
---

# Sign-in

Better Auth 1.7.22 (pinned) handles sign-up, sign-in, sign-out, sessions and organizations. Handlers do not know it
exists: they read `CurrentActor` and call `requireRole`, as before. The rules it meets, each with its check, are in
[the sign-in standard](standards/sign-in.md).

## How a request gets its actor

```
browser ── cookie inventory.session_token ──> Worker
  /api/auth/*  -> SignInRoute (@inventory/access-host/SignIn, on @beep/better-auth): our cross-site check, then Better Auth's handler
                  (sign-up, sign-in, sign-out, organizations). Never versioned: Better Auth's own contract.
  /api/v1/*    -> HttpApi: SameOrigin, then the Identity middleware
                  = SessionIdentityLive (@inventory/access-host/SessionIdentity)
                    Better Auth getSession(cookie) -> { userId, email, activeOrganizationId }
                    Members.findByUser(userId, activeOrganizationId) -> Member { id, name, role, organization }
                    no session or no membership -> NotSignedIn (401) with a sentence
  /api/v1/identity/session -> who is signed in, as whom, and what the sign-in page offers: always a 200
```

- **Identity is the id.** `CurrentActor.id` (the member: one user in one organization) and the session's user id
  are who someone is. Display names are never compared for permissions: a rule such as "nobody approves their own
  count" compares ids. Better Auth's `update-user` is off (`disabledPaths` in `packages/access/host/src/internal/authOptions.ts`), so
  nobody renames themselves through the API either.
- **Organizations and roles are the app's own.** Better Auth's organization plugin uses the existing `organization`
  and `member` tables, and its roles are `admin`, `editor` and `viewer` (`packages/access/host/src/internal/authOptions.ts`). `admin`
  holds the plugin's owner permissions (change roles, add members); `editor` and `viewer` hold none. What an editor
  may do and a viewer may not is `requireRole` in the handlers. `member.role` keeps its CHECK constraint, so no other
  role can be stored. Leaving and deleting an organization are off. Removing a member is the People page's own
  (`packages/access/host/src/PeopleStore.adapter.ts`): the row stays, with `userId` emptied and `removedAt` set, because the audit trail, the
  imports and the decisions they made point at it; every read of members skips a removed one.
- **The active organization** is on the session. A new session opens in the person's earliest membership; the
  organization picker at the top of the sidebar switches with the plugin's `set-active`, which checks membership
  on the server. A refused switch
  clears the active organization (Better Auth's behaviour); the person then acts in their earliest one.
- **The browser** (`@inventory/access-web/Session`, set up by the app's `src/web/lib/actor.ts`) asks once per page load: `GET /api/v1/identity/session` answers status,
  email, actor, organizations and the sign-in features, cached with `sessionQuery` (never refetched on its own). A
  signed-out visit logs no failed request. Signing in, creating an organization or switching drops every cached query
  and asks again; signing out reloads the page, so nothing the previous person saw stays in memory. `SignedIn` shows
  the sign-in screen, the "create your organization" screen, or the app.
- **Development opens signed in.** In a development build, when the session answer says nobody is signed in and
  offers test accounts, `useDevelopmentSignIn` (`src/web/components/app/SignedIn.tsx`) signs in as the first of them
  (Dana Whitfield) through Better Auth's `signIn.email` with the shared password: a real session cookie, no click.
  The user menu at the foot of the sidebar lists the others under "Sign in as a test account": a click signs out,
  signs in as that account and reloads. Signing out marks the tab (`sessionStorage`), so that tab then shows the
  sign-in page instead of signing in again. A production build has no such branch (`import.meta.env.DEV` is false
  there), and `TEST_ACCOUNTS` is off there, so it always shows the sign-in page.
- **Drawn at once, loaded when needed.** For a browser that was not signed in last time (a hint in local storage
  that grants nothing), the sign-in page is drawn with the first paint, before the session answer; the test accounts
  appear with the answer. Better Auth's browser client (`packages/access/web/src/internal/authClient.ts`, 14 kB gzip) is imported with
  `import()` only when a person signs in, switches or signs out, so the first page does not carry it. Measured with
  Lighthouse on a phone: mobile Performance 76 for a sign-in page drawn only after the answer, 97 drawn at once.
- **`HeaderIdentity`** in `@inventory/access-host/AccessTest` (a header names the member) is for tests only. It is marked pure, the Worker never
  provides it, and `bun run build` fails if it appears in the Worker bundle (`scripts/check-production-identity.mjs`).

## Settings

Read in `src/server/Settings.ts` (`authSettings`), from the same ConfigProvider as every other setting; valid values
are in `.dev.vars.example`.

| Variable | Default | What it does |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | none: `bun run dev` writes one into `.dev.vars` | Signs the session cookies (redacted; at least 32 characters, `openssl rand -base64 32`). A production build refuses to start without it; a development one makes a random one per start and says so |
| `BETTER_AUTH_URL` | unset: each request's origin | The deployed address. When set: the one trusted origin, the cross-site check's own origin behind a proxy, and Secure cookies exactly when it is `https:` |
| `PWNED_PASSWORD_CHECK` | on in production, off in development | Refuses a new password found in known breaches (Have I Been Pwned). Fails closed: a sign-up is refused while the service cannot be reached |
| `TEST_ACCOUNTS` | on in development, off in production | Offers the seeded test accounts in one click; only accounts the database holds are offered |
| `TEST_ACCOUNT_PASSWORD` | unset | Secret. A deployed test or preview stage's own password for its test accounts, minted by its stack. Set, it opens them, the password written in the repository is refused for every account, and no test account is offered in one click (`packages/access/model/src/Session/StagePassword.rules.ts`) |
| `SIGN_UP` | closed in production, open in development | Who may make an account: `open`, `closed`, or the emails that may, separated by commas. Closed, the sign-in page offers no sign-up and `POST /api/auth/sign-up/email` answers 403 for anyone not named. The person named signs up and is the admin of the organization they create (decision "infra I8"; `packages/access/model/src/Session/SignUp.rules.ts`) |

## Security settings

| Setting | Value | Evidence |
| --- | --- | --- |
| Password hashing | scrypt, Better Auth's default; in workerd it runs on `node:crypto` (`nodejs_compat`) | no hashing code of ours |
| Password length | 12 to 128 | test "refuses a short password" |
| Session cookie | `inventory.session_token`, HttpOnly, SameSite=Lax, Path=/, 7 days; production: `__Secure-` prefix and Secure | tests check HttpOnly and SameSite, and a production build's `__Secure-` and Secure; `curl -I` on `bun run preview` |
| Session expiry | 7 days, extended once a day while used; no cookie cache, so sign-out applies at once in every tab | test "signs out, and the session ends at once" |
| CSRF and origins | our cross-site check first (`RequestSource.allows` from `@inventory/kernel/SameOrigin`, as on the API), then Better Auth's origin, callback and Fetch Metadata checks, on even under test (`disableOriginCheck: false`); trusted origins from `BETTER_AUTH_URL` | test "refuses sign-in and sign-out sent from another site, and a foreign callback address" |
| Rate limits | stored in D1 (`rateLimit` table; Workers keep no memory between isolates), per address from `cf-connecting-ip`: sign-in 10 a minute, sign-up 5 a minute, the rest 100 a minute | test "limits sign-in attempts" (the 11th is 429) |
| Breached passwords | Have I Been Pwned at sign-up and password change, behind `PWNED_PASSWORD_CHECK`; only the first five characters of the SHA-1 hash leave the Worker | `test/server/Pwned.test.ts` (off: never called; on and unreachable: refused), `Pwned.slow.test.ts` (the real service) |
| Usage telemetry | off (`telemetry: { enabled: false }`): it reports to Better Auth's servers | `packages/access/host/src/internal/authOptions.ts` |
| Tracing | Better Auth's own instrumentation does nothing inside a Worker, so every call into it is an Effect span: `BetterAuth.handle` (endpoint and status) and `BetterAuth.session` | `@beep/better-auth` (`BetterAuth.service.ts`) |
| Changing one's own name or picture | off: `POST /api/auth/update-user` answers 404 (`disabledPaths`) | test "refuses a rename through Better Auth's update-user" |
| Headers | the API's security headers apply to `/api/auth/*` too | `curl -I` on `bun run preview` |

## Keeping it fast

Better Auth's performance guide, item by item:

- **Indexes**: every lookup it names is indexed (part 1 of `migrations/0001_init.sql`), and
  `test/server/AuthIndexes.test.ts`
  asks SQLite's planner that each one uses its index.
- **Background tasks**: `advanced.backgroundTasks` hands work after the answer (rate-limit updates, cleanup) to the
  Worker's `waitUntil` (`src/server/worker.ts`).
- **The session is fetched once** per page load and cached on the client (above).
- **The cookie cache is off**: every request reads the session row, so a revoked session ends at once. A cookie
  cache would save that one D1 read per request and keep a revoked session working until it expires;
  `{ enabled: true, maxAge: 60 }` accepts up to a minute of that. A production choice, written beside the setting.
- **`better-auth/minimal` is not used**: it cannot take a direct D1 connection and has no migration planner. The
  reason is beside the import in `@beep/better-auth` (`BetterAuth.service.ts`).

## Agents act for a person

An agent (a model's tool loop, or rules) runs on the server inside `asAgent(AgentRun.make({ agent, maxRole }))`
(`asAgent` and `AgentRun` in `@inventory/kernel`):

- It acts for the signed-in person: `CurrentActor` stays that person, so every query is scoped to their
  organization. Nothing in a payload can name another person or organization.
- It never exceeds them: `requireRole(minimum)` checks the person's role and the run's `maxRole`, and refuses with
  `Forbidden` (403) naming whichever is short, never the person. An agent meant only to propose runs with
  `maxRole: "viewer"`.
- It is named: every activity line written inside a run carries `agent` beside the person (`activity.agent` in
  `migrations/0001_init.sql`); the Activity page shows the agent beside the person's name.

The table assistant is the example (`packages/catalog/model/src/Assistant/Assistant.handler.ts`): it runs as "Table assistant", at most a viewer,
because it changes only the person's view; a model's answer writes one audit line, "Asked for a view", naming the
agent beside the person, and an answer from the rules writes nothing. Tests: `test/server/Agent.test.ts` (both caps)
and `test/server/Assistant.slow.test.ts`. An agent outside this Worker (a separate process calling the API with its own
credential) is not covered.

## Changing the schema (a plugin, a field)

Better Auth's command line cannot reach D1, so its tables are migrations like any other:

1. Change `packages/access/host/src/internal/authOptions.ts` (add the plugin, or a field under `additionalFields`).
2. `bun run auth:schema` applies `migrations/` to an in-memory SQLite database and prints what Better Auth still
   needs, as SQL. It needs Node 22.18 or newer.
3. Before any data has to be kept, put the output into `migrations/0001_init.sql` (part 1 holds Better Auth's
   tables, part 2 the shared `organization` and `member`), then `bun run db:reset`. Once a database holds rows that
   must stay, save it as the next `migrations/NNNN_*.sql` instead: a line marked UNSAFE is a required column on a
   table that already has rows, so add it nullable and fill existing rows in the same file.
4. `bun run check:full`: `test/server/AuthSchema.slow.test.ts` fails while anything is missing.

Better Auth's tables come first in `0001_init.sql`, because `member.userId` references `user`.

## Test accounts and a deployed database

The accounts are listed once, in `packages/access/host/src/internal/TestAccounts.ts`. `seeds/accounts.sql` (written by
`bun scripts/dev-accounts.mjs > seeds/accounts.sql`) adds a user and a password for each seeded person, and makes
Dana a viewer in Sample Supply so switching can be seen. `bun run dev` applies it after the migrations. It is not a
migration, so production's database has no accounts: the first person signs up and creates their organization, and an
admin adds others.

A deployed test or preview stage is seeded with the same accounts and gets a password of its own for them
(`TEST_ACCOUNT_PASSWORD`, minted by the stack). There the password above opens nothing, sign-up is closed, and the
sign-in page offers no account in one click: whoever deployed the stage has the password and types it.

## Checking it by hand

`curl -c jar -H 'origin: http://localhost:5173' -H 'content-type: application/json'
-d '{"email":"priya@example-works.test","password":"local-test-password"}' localhost:5173/api/auth/sign-in/email`, then
`curl -b jar localhost:5173/api/v1/identity/me`. A request without the cookie gets `{"_tag":"NotSignedIn",...}` (401),
whatever headers it sends.

## Not done

- No email: no verification, password reset or invitation links (each needs an email provider). An admin adds a
  person who has already signed up, by their email, on the People page (`@inventory/access-web/People`); someone with
  no account yet cannot be invited.
- No second factor, passkeys or social sign-in, and no list of sessions a person can see and end. The write-up's
  "To make this production-ready" says why, and what would come first.
- No way for a person to change their own name or picture (`update-user` is off). An admin can change it in the
  database.
- Agents outside this Worker: no tokens, grants or approval flow for an agent that calls the API from elsewhere.
- Better Auth's sign-in answer also carries the session token in its JSON body. The token alone is not accepted (the
  cookie is signed and no bearer plugin is installed), but it is visible to scripts on the page at that moment.
- The rate-limit counter reads, then writes (D1 has no interactive transactions), so a burst of parallel requests can
  pass the limit by a few.
- `member.name` is still stored (the plugin fills it from the user); reads use the user's current name.
