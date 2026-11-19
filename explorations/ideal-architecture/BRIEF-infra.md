---
type: Brief
title: "Brief: infra"
description: The goal infra, step 9 of the order of work. @beep/infra at packages/infra declares the app's Cloudflare resources and the repository's GitHub settings with Alchemy, and the app is deployed for the first time to inventory.beep-effect.com. Written only; nothing is built, deployed or signed up for, and it waits for "the brief matches".
---

# Brief: `infra`

Step 9 of the order of work in [README.md](README.md), the last. It rests on
[research/02-alchemy-infra.md](research/02-alchemy-infra.md) (cited below as "the report") and on the README's table
"Where the research disagrees with the request". It turns round four of [DECISIONS.md](DECISIONS.md) (18 to 24) into
questions, and round three (13, 15, 16) only where a deploy needs them.

Benjamin answered I1 to I9 with the recommended option of each and said "The brief matches (Recommended)"
([DECISIONS.md](DECISIONS.md), 2026-11-19). The goal is opened only after the Effect-imports migration is merged to
main, and is then built and checked on this machine only, stopping before the first step that touches anything
outside it. The reference `op://BEEP_SECRETS/BEEP_SECRETS/TYPESAFE_AI_API_KEY` is reserved for a later
confidence-score goal: no stage gets it.

Nothing here is built. No account was opened, no login command run, no DNS record, GitHub setting or secret read or
changed, and nothing was deployed. No goal is open.

## Problem

The app has never been deployed. What exists is a wrangler setup with no production identity:

- `apps/inventory/wrangler.jsonc` names a Worker `inventory` and a D1 database `inventory` whose id is a row of
  zeros. `bun run --cwd apps/inventory deploy` would run `wrangler d1 migrations apply` and `wrangler deploy` with
  whatever login the machine has; `deploy:setup` creates the database and rewrites that id by hand.
- `.github/workflows/ci.yml` checks and builds. It holds no secret and deploys nothing.
- `apps/inventory/migrations/0001_init.sql` inserts two organizations and five members, all marked "(test)". Any
  database it is applied to receives them, a production one included.
- Sign-up is open: Better Auth takes an email and a password, sends no email and verifies no address
  (`docs/auth.md`). On a public address anyone can make an account and an organization.
- Nothing says which resources exist, per stage, in a form that can be read, reviewed or torn down.

## Appetite

Scope, not time. In:

- One package, `packages/infra` (`@beep/infra`), holding two Alchemy stacks: the app (a D1 database, the Worker
  with its assets, its settings and secrets, its hostname) and the repository's GitHub settings (environments,
  secrets, variables and, by decision I7, a ruleset).
- A stage plan as a decoded schema value: which hostname, database, seed and secrets each stage gets.
- The seed rows moved out of the migration, so a production database starts empty.
- A hand-written deploy workflow beside the existing CI one.
- The first deploy of production to `inventory.beep-effect.com`, done by Benjamin's hand or on his word, step by step.

Out: everything under No-gos.

## What was checked, and what could not be

The report was written against Alchemy `2.0.0-beta.87` and distilled `1.0.0-rc.20`. The reference checkouts are at
those same versions (alchemy commit `33c10dd55f`, tag `v2.0.0-beta.87`; distilled packages at `1.0.0-rc.20`), so its
quotations still stand. Neither is installed in this repository: `node_modules` has no `alchemy` and no
`@alchemy.run/*`, so nothing below was compiled or run. Installed here and relevant: `wrangler` ^4.161,
`@cloudflare/vite-plugin` ^1.69.1, `vite` ^8.3.6, `effect` 4.1.4, Better Auth 1.7.22.

Read again in the alchemy checkout for this brief:

| Named below | Where it is | Found |
| --- | --- | --- |
| `Alchemy.Stack(name, { providers, state }, effect)`, `state` required | `packages/alchemy/src/Stack.ts` | as the report says; a missing `state` is reported with "`state: Cloudflare.state(), // <-- required`" |
| `Cloudflare.state(options)` | `packages/cloudflare/src/StateStore/State.ts`, `Deploy.ts` | a Worker named `alchemy-state-store` by default; an auth token and an encryption key kept in the account's Secrets Store, created when absent |
| `Alchemy.localState()` | `packages/alchemy/src/State/LocalState.ts` | exists; no encryption in it |
| `Cloudflare.D1.Database` props | `packages/cloudflare/src/D1/Database.ts` | `name`, `primaryLocationHint`, `readReplication`, `jurisdiction`, `migrations`, `importFiles`, `clone`; a change of location hint or jurisdiction deletes the database and its data before the new one is made |
| `Cloudflare.Worker` props | `packages/cloudflare/src/Workers/Worker.ts` | `main`, `assets`, `compatibility`, `env`, `crons`, `domain`, `routes`, `workersDev`, `access`, `observability`; `Worker.URL` exists; `nodejs_compat` is added only for dates before `2026-08-04` |
| `Cloudflare.Website.Vite` | `packages/cloudflare/src/Website/Vite.ts` | takes the Worker's props without `vite`, `main`, `assets` and `rules`, plus its own options, of which `main` is public and documented ("Custom Worker Entry") |
| `Alchemy.Random` | `packages/alchemy/src/Random.ts` | a resource |
| `Cloudflare.Zone.Zone.lookup` | `packages/cloudflare/src/Zone/Zone.ts` | "reads a zone Alchemy doesn't manage" |
| `AccountApiToken`, `UserApiToken` | `packages/cloudflare/src/ApiToken/` | both exist, with a `PermissionGroups.ts` beside them |
| GitHub resources | `packages/github/src/` | `Environment`, `Secret`, `Secrets`, `Variable`, `Variables`, `Ruleset`, `BranchProtection`, `Comment`, `Env` |
| CLI | `packages/alchemy/src/Cli/` | `deploy`, `destroy`, `plan`, `dev`, `drift`, `logs`, `state list/read/delete/bootstrap/teardown/migrate/logs`; a stage defaults to `live_$USER` for deploy and `dev_$USER` for dev |

Could not be verified, and the goal must prove each before production relies on it:

- That any proposed code compiles. None was compiled.
- Whether `Website.Vite` can live with this app's own `vite.config.ts`. The report quotes the docs page saying it
  is "not compatible" with `@cloudflare/vite-plugin`, which must be removed; the source's own comment says `Vite`
  "uses the Cloudflare Vite plugin". Both cannot be the whole truth.
- Whether Alchemy's D1 applier splits `0001_init.sql` correctly: its three triggers hold semicolons inside their
  bodies.
- Whether production D1 has the FTS5 `trigram remove_diacritics 1` tokenizer the Items search needs. It has only
  ever run in the local runtime.
- Whether a sign-in fits the Workers Free plan. Better Auth hashes passwords with scrypt; the Free plan allows "10
  ms of CPU time per invocation" (Cloudflare's Workers pricing page). Not measured.
- Whether a 50,000-row confirm fits a Worker's CPU limit and D1's batch limits on the real service.
- Whether `Random(...).text` is accepted in a Worker's `env` and bound as a secret.
- Whether the state store's encryption at rest is as documented. Its `Deploy.ts` makes the key; the code that
  encrypts with it was not read to the end.
- Which Cloudflare permission groups a token needs to attach a hostname on `beep-effect.com`.
- Whether "Always Use HTTPS" is on for the `beep-effect.com` zone, which `src/server/security.ts` assumes.
- Whether `beep-effect.com` is a zone in the Cloudflare account that will hold the Worker. Alchemy requires it:
  "The zone must already exist in the account".
- Whether `@alchemy.run/test` runs under Vitest on Node, which this repository's rule requires.
- Whether a GitHub Actions job's required-check name is its `name`, today "Check, test and build".
- What `op://BEEP_SECRETS/BEEP_SECRETS/TYPESAFE_AI_API_KEY` is for. It is the one reference named for this work. No
  setting of the app is called that: the Worker reads `OPENROUTER_API_KEY` and `AI_GATEWAY_API_KEY`
  (`apps/inventory/src/server/Settings.ts`). No agent resolved it, and none may.

## Sketch

Schema first, then the one service, then the stacks. The report's section 4 has the proposed code; where this brief
differs it says so under "Where the research was wrong". The package follows the rules of every new package:
[docs/standards/schema-first.md](../../docs/standards/schema-first.md), a role suffix in every filename, exact
exports, `internal/` never exported, the full strictness profile.

### What is declared

```
packages/infra/                      @beep/infra, family "infra"
  src/Stage.schema.ts                StageName, Hostname, SecretReference (an op:// reference, never a value),
                                     StageKind (personal, test, preview, production) and StagePlan
  src/StagePlan.rules.ts             planFor(stage): the table below as a pure function; an unknown stage is refused
  src/InfraStage.context.ts          the one Context.Service: the decoded plan of the stage being deployed
  src/Inventory.stack.ts             the app's stack
  src/GitHub.stack.ts                the repository's stack, deployed from a workstation only
  env/op.env                         NAME=op://vault/item/field lines only; no value is ever written here
  test/StagePlan.test.ts             every stage name maps to its plan; production never seeds; live_* is refused
alchemy.run.ts                       at the repository root: re-exports the app's stack, so the CLI finds it
.github/workflows/deploy.yml         hand-written: preview on a pull request, production on a push to main
apps/inventory/seeds/                the two organizations and the test accounts, out of the migration
```

### Stages

| Stage | Named | Started by | Address | Database | Seed | Model key | Sign-in secret |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Personal | `dev_<user>` | `bun run dev`, unchanged | localhost | local, as today | organizations and test accounts | optional, as today | written to `.dev.vars`, as today |
| Test | `test_<user>` | the deploy test | a `workers.dev` address | its own D1 | organizations and test accounts | none: the rules answer | minted |
| Preview | `pr-<n>` | CI on a pull request; destroyed when it closes | by decision I4 | its own D1, destroyed with the stage | organizations and test accounts, with the one password every preview shares; no sign-up (answered after the brief: "Nobody; test accounts only", "One preview password in 1Password") | by decision I5 | minted |
| Production | `prod` | CI on a push to `main`, after approval | `https://inventory.beep-effect.com` | its own D1, never seeded, never destroyed by a workflow | none | by decision I5 | by decision I3 |

`bun run dev` stays what it is. Whether `alchemy dev` replaces it is not part of this goal: the dev server, the
test accounts, HTTPS and the telemetry stack all hang off the current one.

### Production's resources

One D1 database with `migrations` pointing at `apps/inventory/migrations`. One deploy unit (decision I1) with
`compatibility: { date: "2026-11-01", flags: ["nodejs_compat"] }`, written out because Alchemy no longer adds the
flag for that date and Better Auth's password hashing needs it; `assets` with `notFoundHandling:
"single-page-application"` and `runWorkerFirst: ["/api/*"]`, as `wrangler.jsonc` has them; `domain: { name:
"inventory.beep-effect.com", zoneName: "beep-effect.com" }` and `workersDev: false`. `BETTER_AUTH_URL` comes from
`Cloudflare.Worker.URL`, so each stage trusts its own address and no address is kept by hand. The zone is looked up
and never managed: no `Zone` resource, no `adopt`, so nothing else on `beep-effect.com` can be touched.

### What it costs to leave running

From Cloudflare's own pricing pages, read on 2026-11-19. Nothing here is an estimate of this app's usage.

| Thing | Free plan | Paid plan |
| --- | --- | --- |
| Workers | 100,000 requests a day, 10 ms of CPU an invocation | $5 a month for the account, with 10 million requests and 30 million CPU ms; then $0.30 a million requests and $0.02 a million CPU ms |
| Static assets | "Requests to static assets are free and unlimited" | the same |
| D1 | 5 million rows read and 100,000 written a day, 5 GB, 10 databases; at a daily limit queries fail until 00:00 UTC | 25 billion rows read and 50 million written a month, 5 GB, then $0.001 and $1.00 a million rows and $0.75 a GB-month |
| The state store (decision I2): a Worker and a Durable Object | Durable Objects: 100,000 requests a day, SQLite-backed only | 1 million requests a month, then $0.15 a million |
| Workers Logs (`observability` is on) | 200,000 events a day, kept 3 days | 20 million a month, then $0.60 a million, kept 7 days |
| Secrets Store, which the state store uses | unknown: its page says "open beta" and states no price | unknown |
| The hostname and its certificate | unknown: not stated on the pages read | unknown |
| GitHub Actions for a public repository | unknown: not read | unknown |
| OpenRouter, if production has a key | not Cloudflare's: the model's own price per call, at most 40 calls a day for each organization | the same |

An idle Worker and an idle database cost nothing beyond the plan: "D1 uses scale-to-zero billing". Each preview is
another database, and the Free plan holds ten.

### Secrets

No agent and no CI job resolves an `op://` reference. A reference is kept as a reference:

- `packages/infra/env/op.env` is committed and holds only lines of the form `NAME=op://vault/item/field`.
- A deploy that needs a third-party key runs as `op run --env-file packages/infra/env/op.env -- bunx alchemy deploy
  --stage prod`, by Benjamin, on his workstation. 1Password fills the variables for that one process.
- The GitHub stack, deployed the same way, writes the keys production needs into the `production` environment's
  secrets, and the deploy job reads them from there. A preview job has no key to leak.
- Whatever route a value takes, it ends in Alchemy's state: `encodeState` persists the inner string of every
  redacted value (the report, section 1). With `localState()` that is plain text on disk, which is why decision I2
  matters.

### Rolling back and tearing down

- **A bad deploy of code.** Revert the commit and let the workflow deploy `main` again. Cloudflare also keeps
  earlier versions of a Worker; rolling back there by hand leaves Alchemy's state behind the truth, so the next
  deploy must come from the reverted commit either way.
- **A bad migration.** Migrations are forward-only and hash-checked: an applied file that is edited fails the next
  deploy. A wrong migration is undone by a new numbered file. D1's Time Travel restores a database to a moment in
  the last 30 days on a paid plan; it is Cloudflare's own tool, Alchemy has no wrapper for it, and using it has not
  been tried.
- **A preview.** The workflow's cleanup job destroys the stage when the pull request closes, and refuses any stage
  name that is not `pr-<number>`.
- **Production.** `bunx alchemy destroy --stage prod`, by hand, removes the Worker, its hostname and its database
  with every item in it. No workflow can run it. The GitHub stack's secrets are deleted on destroy and its ruleset is
  kept. The state store has its own `alchemy state teardown`.
- **Losing the state store** loses a minted sign-in secret, which signs every person out on the next deploy, and
  leaves resources Alchemy no longer knows it made.

### Test accounts and the sign-in page in production

A production build shows the sign-in page and offers no test account: `TEST_ACCOUNTS` is off there and
`import.meta.env.DEV` is false (`docs/auth.md`). `bun run build` already fails if the test identity or a driver's
test layer is in the Worker bundle (`scripts/check-production-identity.mjs`). What is not yet true is that a
production database is empty of test people: the migration seeds them. This goal moves the two organizations and
five members into `apps/inventory/seeds/organizations.sql` and `scripts/dev-accounts.sql` into
`seeds/accounts.sql`, applies them only where the stage plan says, and gives the slow tests the organizations seed
they now need. Who may make an account on the public address is decision I8.

### Proof (the definition of done)

1. `StagePlan.test.ts`: every stage name maps to its plan; `prod` has no seed and no `workers.dev` address; a name
   outside the four kinds is refused.
2. `Tenancy.slow.test.ts` and the rest of the slow tests pass with the seed moved out of the migration.
3. `bunx alchemy plan --stage prod` shows only the resources this brief names, read by Benjamin before anything is
   applied.
4. A test stage on the real service: the migration applies, with its triggers; a sign-in works; `items_messy.csv`
   imports to 155 items; the search finds an item with a wrong letter. This is where four of the unverified points
   are settled.
5. Production: the address answers over HTTPS with the security headers; the sign-in page shows and offers no test
   account; `/api/v1/system/status` says whether a model is on; the three numbers of an import agree.
6. `bun run check:full`; the override sum no higher.

## Where the research was wrong

| The report | What was found |
| --- | --- |
| Decision 1: `Website.Vite` "relies on a prop marked `@internal`" (`vite: { main }`) | That prop is the Worker's. `Website.Vite` has its own public `main`, documented in its source under "Custom Worker Entry". The risk it named is gone; whether the app's Vite config and that resource agree is the open point |
| `@cloudflare/vite-plugin` "must be removed" | The docs page says so; the resource's own comment says it uses that plugin. Unsettled until it is tried |
| File names `src/schema/Stage.ts`, `src/stacks/inventory.ts` | No role suffix. Decision "file naming" gives `Stage.schema.ts`, `Inventory.stack.ts`, `GitHub.stack.ts` |
| `Schema.TaggedUnion`, `Schema.Literals` in the stage schema | The schema standard has `LiteralKit` with `S.toTaggedUnion`, as `@beep/csv` and `@beep/xlsx` use it |
| Section 2's paths (`src/server/Imports.ts`, `src/domain/Upload.ts`, `packageManager` npm, two lockfiles) | The repository has moved: the contexts are packages, bun is the only package manager, `bun.lock` is the only lockfile |
| The placeholder name must be renamed before a deploy | Already done in step 0: the Worker, the database and the cookie prefix are `inventory` |
| Costs | The report gave none. The table above is from Cloudflare's pages |
| The Free plan's CPU limit | Not mentioned. It may decide the plan (decision I9) |

## Decisions for Benjamin

Each is his. The first option is the recommendation with its reason. Under each option: what it means for a person
using the deployed app, and for him as the one who pays for and runs it.

### I1. What is the deploy unit? (round four, 18)

- **`Cloudflare.Website.Vite` with its own `main`, at an exact version (Recommended).** One resource builds the
  browser's files and the Worker and deploys both. Its entry option is public, so the reason the report hesitated is
  gone. A person sees no difference. He keeps one thing to deploy; the price is proving it against this app's Vite
  config, and a beta whose README says "Expect breaking changes".
- **`Cloudflare.Worker` with `assets.directory`, the build left to Turborepo.** Only long-standing props, and the
  build stays exactly the one `check:full` already runs. A person sees no difference. He keeps two steps, build then
  deploy, that must not drift apart.
- **Keep wrangler for the Worker and use Alchemy for GitHub only.** The least new; a person sees no difference. He
  keeps `wrangler.jsonc`, a database id written by hand and no declared stages, which is the problem this goal
  exists to remove.

### I2. Where is Alchemy's state kept? (19)

- **`Cloudflare.state()` (Recommended).** A small Worker and Durable Object in his account hold the state,
  encrypted, shared by his workstation and CI. A person is unaffected. He gets one more thing running in the account
  and a dependency on Secrets Store, a beta whose price its page does not state.
- **A Postgres database (`postgresState`).** The state lives outside Cloudflare, so losing the account does not lose
  it. He pays for and runs a database only for this.
- **Local files (`localState`).** Nothing to run. Every secret a deploy touches is then plain text under
  `.alchemy/` on his disk, and CI cannot share it, so every deploy is from his workstation.

### I3. Who owns the sign-in tables and the sign-in secret? (20)

- **The hand-written migration, and a secret minted for each stage (Recommended).** The sign-in tables stay in the
  one migration with the tenancy tables, checked by the existing drift test; no person ever sees the secret. If the
  state store is lost, everyone is signed out once. He stores nothing in 1Password for it.
- **The hand-written migration, and the secret in 1Password.** The secret survives a lost state store, so nobody is
  signed out. He creates and keeps one item for each lasting stage, and a person's session depends on it being
  right.
- **`@alchemy.run/better-auth` owns the schema and the secret.** It applies the sign-in schema at deploy. Two
  owners then write one database, and the migration's history and the drift test both change. A person sees no
  difference until the two disagree.

### I4. Where do previews live, and at what address? (21)

- **A separate Cloudflare account for previews and tests, on `workers.dev` addresses (Recommended).** A token that
  can deploy a preview cannot reach production's Worker or data. A person using production is never affected by a
  pull request. He opens and keeps a second account and gives it nothing but previews.
- **The same account, on `workers.dev` addresses.** Nothing new to open. A preview's token can overwrite the
  production Worker, since Workers permissions are for the whole account; GitHub's environments narrow who can use
  the token, not what it can do.
- **The same account, on `inventory-pr-<n>.beep-effect.com`.** Addresses that read well. The same exposure as the
  option above, and each preview adds a record and a certificate on his zone.
- **No previews: production only.** The least to run and to pay for. A change is first seen deployed when it is
  already live.

### I5. Which stages get a model key? (22, and 13 where it touches a deploy)

- **Production only, one vendor (Recommended).** Production's assistant and suggestions are answered by a model,
  up to 40 calls a day for each organization; previews and tests are answered by the rules, which is a complete
  path. He pays one vendor, and a pull request's code never holds a key. No second vendor's key is deployed
  anywhere, which is round three's 13 as far as a deploy goes.
- **No key anywhere at first.** Every feature works and says "answered by rules". He pays for no model. A person
  gets the rules' answers only, until a key is added by a later deploy.
- **Production and previews.** A reviewer sees the model's answers in a preview. A key is then within reach of
  code from a pull request.

Whichever is chosen, the brief needs to know from him which service
`op://BEEP_SECRETS/BEEP_SECRETS/TYPESAFE_AI_API_KEY` belongs to, since the app reads no setting of that name.

### I6. Does the app send email now? (23)

- **Not now (Recommended).** Sign-in sends nothing today, by design. A person cannot reset a forgotten password
  themself or be invited by email; an admin adds a person by the email they signed up with. He has no sending
  domain, no records and no deliverability to look after.
- **Resend, for password reset only.** A person who forgets their password can get back in. He adds a sending
  subdomain, its DNS records on `beep-effect.com`, a Resend account and a key, and a custom provider the report
  could not verify.
- **Resend, for reset, verification and invitations.** The full set, and with it an answer to who may sign up
  (I8). The same cost as above and three flows to build and test.

### I7. Are the repository's rules declared as code? (24)

- **Yes, in the workstation-only stack, with an admin bypass (Recommended).** The required check's name sits beside
  the workflow that produces it. A person is unaffected. He can no longer merge to `main` without the check,
  unless he uses the bypass; renaming the CI job without redeploying the ruleset blocks every merge, which is what
  the bypass is for.
- **Environments, secrets and variables as code; rules in GitHub's own settings.** He keeps the rules by hand, and
  nothing in the repository says what they are.
- **Nothing declared: all by hand.** No GitHub token with administration rights is ever needed. The deploy's
  secrets are then typed into GitHub by him.

### I8. Who may make an account on the public address?

Not in the open rounds; a deploy raises it. Today anyone who reaches the address can sign up and make an
organization, with no email check.

- **Close sign-up; he adds the first accounts (Recommended).** Only people he lets in can sign in. A person asks
  him for an account. He needs a way to make the first admin of an organization, which is a small piece of this
  goal to design, and nobody he does not know can put data in his database.
- **Leave sign-up open.** Anyone can try the app. Anyone can also fill a database he pays for; the limits are five
  sign-ups a minute from one address and the breached-password check.
- **Put production behind Cloudflare Access.** The whole address asks for a login he controls before the app is
  seen. A person signs in twice. The Worker has an `access` prop for it; it was not tried.

### I9. Which Workers plan?

- **Workers Paid, $5 a month (Recommended).** A sign-in hashes a password and a confirm writes up to 50,000 rows;
  neither is likely to fit 10 ms of CPU, though neither was measured. A person gets an app that does not fail at
  the plan's edge. He pays $5 a month for the account whatever the use, and has room that this app will not fill.
- **Workers Free, and measure first.** Nothing to pay. If a sign-in or a large import passes the CPU limit, that
  request fails for the person until the plan changes; at 100,000 rows written in a day, every write fails until
  midnight UTC.

Round three's 15 (do model-preselected values count as Ready) and 16 (MCP for agents) change nothing a deploy
declares. They stay open and are not asked here.

## What the deploy needs from Benjamin, by hand

None of this can be done by an agent, and none was started.

1. A Cloudflare account that holds the zone `beep-effect.com`, on the plan I9 names. If the zone is elsewhere, it
   must be in this account or the hostname cannot be attached.
2. If I4 says so, a second Cloudflare account for previews.
3. A Cloudflare login on his workstation (`alchemy profile`, or a token he makes), with rights over Workers, D1,
   Secrets Store and the zone's records. The exact permission groups are unverified.
4. `gh auth login` on his workstation with rights to the repository's settings, for the GitHub stack.
5. The 1Password items the references in `env/op.env` point at, and his answer to what the one named reference is
   for.
6. On the zone: "Always Use HTTPS" confirmed on.
7. His eye on `alchemy plan` before each first apply, and his approval in GitHub's `production` environment for
   each production deploy after it.

## Rabbit holes

- **The migration on real D1.** The triggers and the FTS5 tokenizer are the two things that have only ever run
  locally. Prove both on a test stage before a production database exists; a database that applied a file cannot
  have it edited.
- **A beta's breaking changes.** Pin every `@alchemy.run/*` package to one exact version. An upgrade is its own
  change, proved by the plan showing no difference.
- **The first deploy defaults to `live_<user>`.** Every command in this goal names its stage.
- **Secrets in state.** With anything but an encrypted store, a deploy writes keys to disk. `.alchemy/` is
  git-ignored either way and never a Turborepo output.
- **Location and jurisdiction of the database.** Changing either later deletes the database first. Choose at the
  first deploy and never again without an export.
- **Every GitHub-stack deploy re-uploads every secret.** A mistyped reference silently replaces a good secret.
- **A required check that has never run.** How a ruleset treats it is unverified; the admin bypass is the way out.
- **The deploy test's runner.** If `@alchemy.run/test` does not run under Vitest on Node, that one file runs under
  bun's own runner, and the repository's rule against it gets one recorded exception, which is his to grant.

## No-gos

- No Effect Cluster, workflows or singletons, no Drizzle, no Durable Objects of the app's own, no R2, no queues.
- No change to what a person sees, to any import rule or count, or to the sign-in design, beyond what I8 answers.
- No email unless I6 says so.
- No `Zone` resource and nothing that manages `beep-effect.com` beyond one hostname.
- No secret value in the repository, in a brief, in a log or in a chat; no agent resolves a reference.
- No `alchemy dev` in place of `bun run dev`.
- No deploy, plan against a real account, login or sign-up by an agent without Benjamin saying so in that message.
- No edit to the vendored kit.

## Map

| Today | After |
| --- | --- |
| `apps/inventory/wrangler.jsonc` with a zero database id | kept for local development and the tests; production's identity is the stack's |
| `deploy`, `deploy:setup` in `apps/inventory/package.json`, `scripts/deploy-setup.mjs` | removed: the stack creates the database and the workflow deploys |
| Seed rows in `migrations/0001_init.sql`, `scripts/dev-accounts.sql` | `apps/inventory/seeds/organizations.sql` and `accounts.sql`; `scripts/migrate-local.mjs` and the slow tests apply them |
| `.github/workflows/ci.yml` | unchanged; `deploy.yml` beside it |
| nothing | `packages/infra`, `alchemy.run.ts`, `.alchemy/` git-ignored |
| `docs/` and `CLAUDE.md` "Commands": `deploy:setup`, `deploy` | rewritten for the stack where the move makes them false |
| `packages/tooling/tool/cli/src/commands/Laws/Boundaries.rules.ts` (`bun run beep laws boundaries`) | a family `infra` that nothing in the app may import |

## Order of moves

Each step leaves the check green. Steps 1 to 4 touch nothing outside this machine.

1. The seed rows out of the migration into `seeds/`, with the local script and the slow tests applying them. The
   app behaves as before.
2. `packages/infra`: the stage schema, `planFor` and its test. No Alchemy dependency yet.
3. The Alchemy packages added at one exact version; the two stacks written; `deploy.yml` written and not yet
   merged to `main`. Type-checked only.
4. The questions above answered and recorded, if any is still open.

**5. The first step that touches anything outside this machine: Benjamin logs in to Cloudflare on his workstation
and runs `alchemy state bootstrap`, which creates the state store's Worker in his account.** Everything from here on
is his hand or his word, one step at a time.

6. `alchemy plan` then `alchemy deploy` for a test stage. The unverified points are settled here: the migration and
   its triggers, the search, a sign-in, a 155-item import, the CPU a confirm takes.
7. The GitHub stack, from his workstation under `op run`: environments, secrets, variables and, by I7, the ruleset.
8. `alchemy plan --stage prod`, read by him; then the first production deploy, and the proof's fifth point at
   `https://inventory.beep-effect.com`.
9. The deploy workflow merged, so the next push to `main` deploys by itself after his approval.
10. The documents the move made false, and the goal's closing note with what the real service showed.
