---
type: Plan
title: "Infra, plan"
description: The steps of the infra goal, their status, the choices made, what was proved without a cloud, what waits for the first apply, and what Benjamin does by hand.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. The steps are the
brief's "Order of moves" up to the first one that touches anything outside this machine, with closed sign-up (I8)
as a step of its own.

| # | Step | Status |
| --- | --- | --- |
| 1 | The seed rows out of the migration into `seeds/`; the local script and the tests apply them | done |
| 2 | Sign-up closed, with a first-admin path (I8) | done |
| 3 | `packages/infra`: the stage schema, `planFor` and its test | done |
| 4 | Alchemy at one exact version; the two stacks; `deploy.yml`, not merged to `main` | done |
| 5 | Browser pass, the documents the moves made false, and the hand-over list | done |

**Not done by this goal, and Benjamin's:** step 5 of the brief (his Cloudflare login and `alchemy state bootstrap`)
and everything after it.

## Current blocker

The next step is Benjamin's Cloudflare login and `alchemy state bootstrap`. Nothing more can be built or learned on
this machine alone; "What Benjamin does by hand" below is the list, in order.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **The seeds are idempotent** (`INSERT OR IGNORE`), since the local script applies them on every start. A local
  database made before this goal already holds the rows from the old migration and needs no reset.
- **Closed sign-up is a setting with a list, `SIGN_UP`** (I8: "Close sign-up; I add accounts"). The brief left the
  first-admin path to be designed. `SIGN_UP` is `open`, `closed`, or the emails that may make an account; it is
  closed by default in a production build and open in development, so `bun run dev` and the tests are as before. The
  refusal is where Better Auth creates a user, so no route makes an account the setting does not allow. Benjamin
  makes the first admin of an organization by naming that person's email in `SIGN_UP` for the stage; they sign up on
  the page and create their organization, as sign-up always worked. Adding a later person means adding their email
  and deploying again, then the People page's "add by email". Rejected while building: a first-run rule (the first
  account ever made is allowed), because whoever reaches a new deployment first would own it; and a secret invite
  code, because it is one more secret to keep. That choice, and the two new sentences on the sign-in page, are his
  to change.

- **A stage's differences are data, decided in one function.** `planFor(stage)` gives the plan (address, seeds,
  where the model key and the sign-up list come from, whether it is deployed at all) and the stacks only read it.
  The brief's `SecretReference` type was not built: no code holds a reference, `env/op.env` does, and the stack
  asks 1Password for the ones its stage needs through Alchemy's provider (since 2026-11-22; before that `op run`
  filled a variable for one process), so the plan names a variable, never a reference.
- **An unknown stage stops both stacks.** The stage service refuses any name but `prod`, `pr-<number>` and
  `test_<user>`, so a deploy typed without `--stage` (Alchemy names it `live_<user>`) makes nothing. It stops as a
  defect with a sentence saying what to type, because a stack's only typed failure is a missing setting.
- **Nobody signs up on a preview or a test stage** (Benjamin: "Nobody; test accounts only"). Both are seeded with
  the two test organizations and the five test accounts, name no sign-up source, and so run closed; no real email is
  stored outside production. Only production's GitHub environment holds `SIGN_UP`.
- **A deployed stage's test accounts take a password minted for that stage** (Benjamin: "Password minted per
  stage"). The seeded rows keep the hash of the repository's password, so nothing is generated at deploy but one
  random value: the stack mints `TEST_ACCOUNT_PASSWORD` and the Worker decides which password is held against a
  stored hash (`packages/access/model/src/Session/StagePassword.rules.ts`). With the setting, the stage's password
  opens a seeded account, the repository's is refused for every account, and the page offers no account in one
  click. Rejected while building: writing a second seed file with new hashes at deploy time, because a stack's
  resources are declared before the minted value exists.
- **A test stage's minted password is shown only to a person deploying from their own machine**, as the stack's
  output `testAccountPassword`; in a workflow (`CI=true`) the output would say it was minted and not show it.
- **Every preview takes one given password** (Benjamin: "One preview password in 1Password"). A preview mints
  none: the repository's stack asks 1Password for `PREVIEW_TEST_ACCOUNT_PASSWORD` and writes it to the `preview`
  environment as a secret, the workflow's preview job hands it to the deploy, and the stack gives it to the Worker.
  It is never printed: the stack's output says only "the one every preview shares; never shown". A preview deploy
  with none stops with a sentence naming the reference, and so does the repository's stack, since without it no
  preview could be signed in to. The cleanup job is not given it: a destroy plans from state.
- **A production deploy with no model key stops** (Benjamin: "Fail the production deploy"), with a sentence naming
  the variable, where its reference is written, and the flag `DEPLOY_WITHOUT_MODEL_KEY=true` that deploys without a
  model on purpose. The repository's stack stops the same way, and writes the flag to the production environment as
  `true` or `false` so the workflow's deploy agrees with it. A blank value counts as none: a workflow gives a
  missing secret an empty text.
- **The model's name is in two places**: `apps/inventory/wrangler.jsonc` (local) and `Inventory.stack.ts`
  (deployed). Alchemy's Vite build was not shown to read `wrangler.jsonc`'s `vars`, so the stack states them.
- **The GitHub stack takes three names from the environment**, since none is in the repository and none is a
  secret: `PRODUCTION_CLOUDFLARE_ACCOUNT_ID`, `PREVIEW_CLOUDFLARE_ACCOUNT_ID` and `PRODUCTION_APPROVER` (the GitHub
  login that approves a production deploy). `SIGN_UP` defaults to `closed`; `OPENROUTER_API_KEY` is required unless
  the flag is set.
- **The rule on `main`** (I7): a pull request, the check named "Check, test and build" (the job in `ci.yml`), no
  deletion and no force push, and the repository's admin role may bypass it always. No approving review is
  required, since one person works here.
- **`deploy`, `deploy:setup` and `scripts/deploy-setup.mjs` are removed**, as the brief's Map says. No script was
  added anywhere: a deploy is `bunx alchemy deploy --stage <name>`, and the workflow calls the same.
- **Each stack provides its one layer where it is declared**, with the `strictEffectProvide` diagnostic turned off
  on that one line in each: a stack file is the entry point the CLI runs.

## Seen in the browser: sign-up

Port 5200, fresh database. The dev server was restarted with `SIGN_UP` (and `TEST_ACCOUNTS=false`) appended to
`.dev.vars` by the project's own override recipe, which was put back afterwards; the file was never read.

- **Development, no setting**: opened `/` with no cookie; the Upload step showed, signed in as "Dana Whitfield
  dana@example-works.test", "Example Works (test) · Admin". The user menu listed "Sign in as a test account" with
  Marcus, Priya, Elena and Tom. Signed out: the sign-in page showed "Create an account" and the five test accounts.
- **`SIGN_UP=closed`**: the page read "Sign in", "Use your email and password. New accounts are added by the person
  who runs this app.", Email, Password, "Sign in", and no "Create an account". A sign-up posted from that page
  anyway answered 403 with "New accounts are not open here. Ask the person who runs this app to add your email, then
  try again." Typed that email and password into Sign in: "Invalid email or password", so no account was made.
- **`SIGN_UP=owner@example.test`**: pressed "Create an account"; it read "For an email that has been invited. You
  will be the admin of a new organization." Typed Sam Stranger, stranger@example.test, a password, Stranger Co and
  pressed "Create account": the form read "New accounts are not open here. Ask the person who runs this app to add
  your email, then try again." Typed Olive Owner, Owner@Example.test (other capitals), Owner Works: the app opened,
  signed in as "Olive Owner owner@example.test", "Owner Works · Admin"; the People page listed one person, "Olive
  Owner (you) owner@example.test", with Admin chosen.

## Seen in the browser: the production build

`bun run preview` on port 5200 (the production build, served by the same Worker code), on a fresh database, after
the last code commit. `SIGN_UP` was set by the same override recipe and put back.

- **No setting**: opened `/`; it read "Sign in", "Use your email and password. New accounts are added by the person
  who runs this app.", Email, Password, "Sign in". No "Create an account" and no test accounts. A sign-up posted
  from that page answered 403 with "New accounts are not open here. Ask the person who runs this app to add your
  email, then try again." Typed stranger@example.test and a password into Sign in: "Invalid email or password".
- **`SIGN_UP=owner@example.test`**: the page offered "Create an account"; it read "For an email that has been
  invited. You will be the admin of a new organization." Typed Sam Stranger, stranger@example.test, a password,
  Stranger Co and pressed "Create account": the form read the same refusal. Typed Olive Owner, Owner@Example.test,
  Owner Works: the app opened on the Upload step as "Olive Owner owner@example.test", "Owner Works", "Admin"; the
  People page read "Owner Works · 1 person" and listed "Olive Owner (you) owner@example.test".
- **Development afterwards** (`bun run dev`, fresh database, a tab with no cookie and no saved state): the Upload
  step, signed in as "Dana Whitfield dana@example-works.test", "Example Works (test)", "Admin"; the user menu listed
  "Sign in as a test account" with Marcus Oyelaran, Priya Raman, Elena Sokolova and Tom Becker. A tab that had
  signed out earlier showed the sign-in page with the test accounts, as it is meant to.

Not seen: phone width and the dark theme for the two new sentences, and a second named person joining an existing
organization.

## Seen in the browser: a production build with a preview stage's settings

`bun run preview` on port 5200, fresh database with both seeds (what a preview's database holds), and
`TEST_ACCOUNT_PASSWORD` set to a value generated on the spot by the override recipe, which was put back.

- Opened `/`: "Sign in", "Use your email and password. New accounts are added by the person who runs this app.",
  Email, Password, "Sign in". No "Create an account" and no test account offered.
- A sign-up posted from that page answered 403 with "New accounts are not open here. Ask the person who runs this
  app to add your email, then try again."
- Typed dana@example-works.test and local-test-password, pressed "Sign in": "Invalid email or password".
- Typed dana@example-works.test and the generated password, pressed "Sign in": the Upload step opened as "Dana
  Whitfield dana@example-works.test", "Example Works (test)", "Admin".

Not seen: the stack minting the value and handing it to the Worker; that needs an apply.

## Proved without a cloud

- `bun run check:full` passes on each commit: the two stacks type-check against Alchemy 2.0.0-beta.87 under the
  full strictness profile, with `effect` still 4.1.4 for the whole repository.
- `packages/infra/test/StagePlan.test.ts`: each of the four stage kinds maps to its plan; production has no seed,
  the real host name and no `workers.dev`; a preview and a test stage have the test accounts and no sign-up;
  `live_<user>` and other names are refused; a test stage mints its test accounts' password and a preview takes
  the one it is given, stopping with its sentence when there is none; a production deploy with no model key stops
  with its sentence, and the flag lets it through.
- `packages/infra/test/InfraStage.test.ts`: the service hands a stack the plan of `pr-42`; a deploy named
  `live_ben` or `dev_ben` stops before any resource; both stack modules load on Node from the repository alone.
- `packages/access/model/test/StagePassword.test.ts` and `apps/inventory/test/server/StagePassword.slow.test.ts`:
  on a production build with a stage password, a test account signs in with it and not with the repository's,
  nobody can sign up, and the page is told to offer no account; with no stage password the repository's works.
- `apps/inventory/test/server/SignUp.slow.test.ts`: a production build refuses a sign-up with 403 and the sentence;
  a named email becomes the admin of the organization it creates. Seen in the browser on the production build, above.
- `packages/tooling/tool/cli/test/Boundaries.test.ts`: nothing may depend on an `infra` package, not even an app,
  and it may use only the foundation.
- The migration creates no organization and no member; development and the tests get theirs from `seeds/`.
- The cleanup job's guard was read, not run: its `case` accepts `pr-` followed by one to six digits, the first not
  zero, and nothing else.

Not proved here: that any Alchemy command runs. None was run, by design: `plan` and `deploy` need an account.
The slow tests failed once with hook timeouts in suites this work does not touch (the table assistant, the
take-back), straight after a preview server was stopped, and passed on three runs after.

## What cannot be known until the first apply

1. Whether `Cloudflare.Website.Vite` builds this app with its own `vite.config.ts`, which already loads
   `@cloudflare/vite-plugin` and reads `wrangler.jsonc`; and whether the Worker then gets the stack's `env` and not
   the file's zero database id.
2. Whether D1's migration applier takes `0001_init.sql` whole: the triggers' bodies hold semicolons, and the search
   index uses the FTS5 trigram tokenizer. Both have only ever run locally.
3. Whether the seeds import through D1's import API (`importFiles`), including the password hashes in
   `accounts.sql`.
4. Whether `Alchemy.Random(...).text` arrives as a secret binding the Worker reads as `BETTER_AUTH_SECRET`, and
   `Cloudflare.Worker.URL` as an `https:` `BETTER_AUTH_URL` that sign-in accepts as its one origin.
5. The CPU a sign-in (password hashing) and a 155-item confirm take against the plan's limit (I9).
6. Whether the deploy tokens' permission groups are enough, for the state store and for attaching the host name;
   a missing one shows as a refused call that names it.
7. Whether the zone `beep-effect.com` is in the production account, and "Always Use HTTPS" is on.
8. How the ruleset treats the required check before it has ever run on a pull request, and whether GitHub's id of
   the admin role is 5 for this repository.
9. Whether the state store encrypts what it keeps, as its documentation says; a minted secret and the model key
   both end there.
10. Whether a pull request's `closed` event still reaches the `preview` environment's secrets, which the cleanup
    job needs.
11. Whether a test stage's minted `TEST_ACCOUNT_PASSWORD` reaches the Worker as a secret and shows in a
    workstation deploy's output as text and not as a redacted mark; and whether a preview's given one reaches the
    Worker from the environment's secret with GitHub masking it in the log.
12. Whether a stack that stops on a missing model key or a missing preview password prints its sentence whole, or
    wraps it in a stack trace.
13. Whether the sign-in's second look at a password on a stage (two comparisons, one hash) changes the CPU of a
    sign-in in any way that matters.
14. Whether `alchemy destroy` for a closed pull request runs without the preview's password, as its planning from
    state suggests; if it does not, the cleanup job needs the secret too.

## What Benjamin does by hand, in order

Nothing below was started. Every command names its stage.

### One command for steps 2 to 6, 8, 9 and the first part of 12

`bun run beep infra setup` does those steps in order, on Benjamin's workstation. It is his to run: with no terminal,
or with `CI` set, it stops before its first tool, so no agent and no CI job runs it. `--dry-run` prints every step
and every command a run would start, and starts nothing. It can be run again: a step whose work is there says so and
does nothing. It comes in three sizes, smallest first, and several can be given at once:

| Flag | Steps below | What it does |
| --- | --- | --- |
| `--test-stage` | 2, 3, 4 | Finds the Cloudflare account with `cf`, makes and connects the Alchemy profile `inventory-preview`, makes sure of the state store, then plans, asks and deploys `test_<user>`: a live address on workers.dev. Needs one account and nothing from 1Password |
| `--staging` | 5, 6, 8, 12 | Makes the previews' password in 1Password and writes its reference, does the same for production's account (profile `inventory-production`, connected to Cloudflare and GitHub), then plans, asks and deploys the repository's stack. Staging itself then deploys on the next push to `main` that passes CI |
| `--production` | 9 | Plans, asks and deploys production from the workstation; needs `--sign-up` |

What each step does, and with which tool:

- **1Password**, through `op-human` (the plain CLI; `op` on this machine is the agents' shim): if
  `packages/infra/env/op.env` names no `PREVIEW_TEST_ACCOUNT_PASSWORD`, it looks for the item "inventory-import
  PREVIEW_TEST_ACCOUNT_PASSWORD" in the vault (`--vault`, or asked when there are several), has 1Password make it with
  a generated password when it is not there, and writes `op://<vault id>/<item id>/password` to that file. The
  command never sees the password: the output of the one call that makes it is thrown away unread, the item is found
  again by its title in a list of which only ids and titles are kept, and no line of `op.env` is ever printed. The model key's line
  stays his to fill in; while it is empty the two production-facing deploys are given `DEPLOY_WITHOUT_MODEL_KEY=true`
  and the command says so before the plan.
- **Cloudflare**, through `cf`: `cf auth whoami` names the accounts, so no id is typed; when `cf` is not logged in
  it starts `cf auth login` and waits. One account is used for a test stage only after he says yes; with several he
  picks (`--preview-account`, `--production-account`, by name or id, skip the question). The two ids go to the
  repository's stack as `PRODUCTION_CLOUDFLARE_ACCOUNT_ID` and `PREVIEW_CLOUDFLARE_ACCOUNT_ID`.
- **Alchemy profiles and state**: `bunx alchemy profile create`, `profile edit --profile <name> --add Cloudflare`
  (and `--add GitHub` for production's), then, after a yes, `bunx alchemy state bootstrap --profile <name>`.
- **GitHub**, through `gh`: his login is the production approver (`--approver` names another); `gh auth login` is
  started when `gh` is not logged in.
- **Each deploy** is `plan` on his terminal, then "Deploy ... as that plan says?", then `deploy --yes` only after a
  yes. A plan that fails, or a no, deploys nothing. No deploy is wrapped in `op run`: the stacks
  ask 1Password for their secrets themselves (below), so the 1Password app asks him to authorize once for the plan
  and once for the deploy. `--yes` is there because the question was asked by this command, about the plan just
  shown; with it Alchemy also repairs drift and upgrades an older state store without asking.
- **Secrets through Alchemy's 1Password provider** (Benjamin, 2026-11-22: "use alchemy's built in 1password"). The
  references stay where they were, in `packages/infra/env/op.env`, and no code holds one. Each stack lists one
  `secrets` entry (`packages/infra/src/OpReferences.secrets.ts`) that reads that file, keeps the lines that are
  references for the variables its stage's plan reads as secrets (production: the model key; a preview or staging:
  the previews' password; the repository's stack: both; a test stage: none), and hands them to
  `@alchemy.run/1password`, which resolves them in one batch into the stack's configuration, never into the
  process's environment or a file. In a workflow (`CI` set) the entry does nothing and 1Password is not contacted:
  a job's secrets come from its GitHub environment. For this, production's profile is also connected to 1Password
  (`alchemy profile edit --add 1Password`: the desktop app and his account), and in the 1Password app, Settings,
  Developer, "Integrate with other apps" must be on. A variable already set in his shell still wins over the
  provider, as Alchemy ranks the process's environment last.

**Still his, while it runs**: approving each login in the browser (Cloudflare for `cf`, then once for each Alchemy
profile; in Alchemy's own question, picking the account the command names and `gh-cli` for GitHub), unlocking
1Password when it asks, reading each plan, and answering each question. A test stage's address and its
`testAccountPassword` are printed by Alchemy to his terminal only; the command reads neither. Removing a test stage
is his too: `bunx alchemy destroy --stage test_<user> --profile inventory-preview`. Steps 1, 7, 10 and 11 below are
not in the command (accounts and Workers Paid, who may sign up, the zone's HTTPS setting, the push), and approving a
production deploy on GitHub stays as `docs/releasing.md` says.

**Two accounts, and which is which.** The command works the roles out from what `cf` can read: the account that
holds the zone `beep-effect.com` is production's, the other is the previews'. It says both and asks before anything
is made; when `cf` cannot tell, or there are more than two, he picks. A test stage put into the account that holds
the zone is told so in the question. `--staging` and `--production` stop when both roles would be one account
(decision I4).

**The second account must be reachable by the same login** (seen 2026-11-22: `cf`'s login sees one account, the
one holding the zone; the second account Benjamin added is under another login). The repository's stack makes both
deploy tokens (`AccountApiToken`, one in each account) with the single credential of the profile it is deployed
with, so that credential has to reach both accounts. An API key of the second account's own login reaches only
that account: Alchemy's profile takes one (`alchemy profile edit --add Cloudflare --method stored`, with `apiKey`
and `email`, or `apiToken`, and the account's id), and it would serve a test stage and the state store there, but
not the stack. What makes everything above work unchanged: in the second account's dashboard, Manage Account,
Members, invite the first login as Super Administrator, and accept. `cf` then lists both accounts and one browser
login serves both profiles. The other way is a change to the stack so each token is made with its own account's
credential; it is not built.

**The second account by its own token.** Benjamin made an account-owned API token for the second account and keeps
it, with the account's id, in 1Password. He writes the two references himself into `packages/infra/env/op.env.local`,
a file git ignores, so the names of his vault and item stay out of the repository (a name with a space takes
quotes):

```
PREVIEW_CLOUDFLARE_API_TOKEN="op://<vault>/<item>/<field>"
PREVIEW_CLOUDFLARE_ACCOUNT_ID="op://<vault>/<item>/<field>"
```

With both lines there, the previews' account is that one and needs no browser login: `--test-stage` asks `cf`
nothing, checks the token under `op-human run --env-file` that file (`cf accounts tokens verify`, then `get` for
what it allows, against the five permissions the repository's stack gives a deploy token), says what is missing and
asks before going on, and connects the profile with `alchemy profile edit --add Cloudflare --method stored --set
apiToken=env:... --set accountId=env:...`, the values filled by 1Password for that one command. Alchemy then keeps
the token in its profile store on his machine. The command never reads either reference or prints a line of the
file. A token's write permissions are only read, never tried: a permission whose name differs in the dashboard
shows as missing and he may go on. `--staging` stops at once when that file names a token, for the reason above:
the stack does not use it. The other references he keeps in that item (a global API key, and three for R2's S3
API) are used by nothing here; no stack makes anything in R2.

**Never run for real.** The command was tested with stand-ins for every tool (`test/InfraSetup.test.ts` in
`packages/tooling/tool/cli`: what is started, in which order, with which arguments, and that each guard stops it)
and with `--dry-run`. No agent ran `op-human`, `alchemy` or a login. Read from the tools' own help and source, and
not tried: that `op-human item create --generate-password` and `item list` behave as their help says; that
`alchemy profile list`, read through a pipe, prints one line a profile as its source does; that `alchemy profile
edit --add Cloudflare --add GitHub` asks for both in one run; and, for the provider, that the desktop app authorizes a run started this way, that `alchemy profile edit --add
1Password` is asked in the same run as the other two, and that a stack whose `secrets` lists `Secrets.DotEnv()`
first reads a root `.env` as it did before. The provider itself was never called: the tests stop at the references
that would be handed to it. Likewise not tried, for the second account's token: that `op run` fills a quoted reference whose item name has a
space; that `cf` uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment over its own login;
that `cf accounts tokens verify` and `get` answer the fields read here; and that `--method stored` takes an
account-owned token. `cf auth whoami` and `cf zones list` were run, to read the shape of their answers.

### The same steps, by hand

1. **Cloudflare accounts.** One that holds the zone `beep-effect.com`, on Workers Paid (I9); a second for previews
   and test stages (I4).
2. **Log in on the workstation** to each account (`bunx alchemy profile create`, one profile for each).
3. **`bunx alchemy state bootstrap`** in the preview account. This is the first thing that exists outside this
   machine: the state store's Worker. On the build of Alchemy kept in `vendor/alchemy` the Cloudflare state
   store is version 9, so a store an older build made (version 8) is upgraded by the first thing on this build that
   reaches it, one way, and a checkout on an older build is refused by it from then on: `alchemy state bootstrap` and
   a deploy with `--yes` (every job in `deploy.yml`) upgrade it without asking, and a `plan` or `deploy` from the
   workstation without `--yes` asks first.
4. **A test stage in the preview account**: `bunx alchemy plan --stage test_<user>`, read it, then `bunx alchemy
   deploy --stage test_<user>`. Its output gives the address and `testAccountPassword`, minted for that stage. Open the address; sign in
   as dana@example-works.test with that password, and see local-test-password refused; load `items_messy.csv`
   through Confirm and read 155 stored; search the Items page. Points 1 to 5 and 11 above are settled here. Then
   `bunx alchemy destroy --stage test_<user>`.
5. **`bunx alchemy state bootstrap`** in the production account.
6. **Two 1Password items and their references** in `packages/infra/env/op.env`, each a commented line there whose
   vault path he fills in and whose `# ` he removes:
   - `OPENROUTER_API_KEY=op://<vault>/<item>/<field>`: production's model key. Without it steps 8 and 9 stop and
     say so; to go on without a model on purpose, add `DEPLOY_WITHOUT_MODEL_KEY=true` to both commands.
   - `PREVIEW_TEST_ACCOUNT_PASSWORD=op://<vault>/<item>/<field>`: a new item, a password he generates in
     1Password, which every preview's test accounts take. Without it step 8 stops and says so. He signs in to a
     preview as dana@example-works.test (or any test account) with it.
7. **Decide who may open an account in production**: the emails for `SIGN_UP`, his own first. Previews and test
   stages take none.
8. **`gh auth login`** with rights over the repository's settings, then the repository's stack, from the
   production account's profile:
   `PRODUCTION_CLOUDFLARE_ACCOUNT_ID=... PREVIEW_CLOUDFLARE_ACCOUNT_ID=... PRODUCTION_APPROVER=<his GitHub login>
   SIGN_UP=<emails> bunx alchemy deploy packages/infra/src/GitHub.stack.ts --stage prod --profile <production's>`,
   after the same line with `plan`; the profile is connected to 1Password, which the stack asks for its two secrets. Points 6 and 8 are settled here.
9. **Production**: `SIGN_UP=<emails> bunx alchemy plan --stage prod --profile <production's>`, read it, then the same with `deploy`. Open `https://inventory.beep-effect.com`: the sign-in page offers no
   sign-up to a stranger; his email signs up, creates the organization and is its admin.
10. **On the zone**: "Always Use HTTPS" confirmed on.
11. **Push `main`** (the branch is merged into it locally), so `deploy.yml` reaches GitHub. From then a pull request
    gets a preview and a push to `main` that passes CI deploys `staging`; production deploys only from a tagged release
    branch that passed CI (`docs/releasing.md`).
12. **Releases and staging** (decision "releases and deploys", 2026-11-22). Nothing new goes in
    `packages/infra/env/op.env`: staging takes the previews' token, account and password, which step 8 already
    gives. What he does:
    - **Deploy the repository's stack again** (step 8, the same line, `plan` first). The plan should show the new
      `staging` environment and its three values (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
      `PREVIEW_TEST_ACCOUNT_PASSWORD`), the `production` environment unchanged (his approval, and only `main`:
      if an earlier deploy of this step removed the `main`-only rule, the plan shows it coming back), and two
      rulesets: "release tags" (`refs/tags/v*`: only an admin creates, moves or deletes one) and "release
      branches" (`refs/heads/release/*`: no force-push, no deletion). Nothing is clicked in GitHub's settings. If
      he wants it, the setting itself is at Settings, Environments, `production`: "Required reviewers" names him,
      and "Deployment branches and tags" lists `main` (the stack sets both).
    - **The first staging deploy** happens by itself on the next push to `main` that passes CI. Until the
      stack above is deployed, each such push is followed by a failed "Deploy" run whose `staging` job says
      `MissingPreviewPassword` (seen 2026-11-22); it deploys nothing and is expected. Before that, a look
      from the workstation: `bunx alchemy plan --stage staging` from the previews' account profile, connected to
      1Password too so the stack can ask it for `PREVIEW_TEST_ACCOUNT_PASSWORD`.
    - **The first release**: on `main`, `bun run release minor`, read what it printed, then the one push it
      prints, `git push --atomic origin release/<major>.<minor> v<version>`. CI runs on the branch; when it passes,
      the run named "Deploy" starts, "Check the release" prints the tag, and `production` waits for his approval.
      **This is the first time the flow runs on GitHub**: that a workflow started by CI's end runs `main`'s copy
      as `main`, that the environment's `main`-only rule lets it through, and that a waiting release is not
      cancelled are documented behaviour, not verified. If "Deploy" does not start or the environment refuses the
      run, nothing was deployed; the branch and tag stay as they are.
    - **Benjamin's three answers of 2026-11-22**, each the recommended one, recorded in
      `explorations/ideal-architecture/DECISIONS.md` and built:
      1. *Where production's gate lives*: after CI on the release branch. Production starts when CI passes on a
         push to `release/**` whose head carries its tag, from `main`'s copy of the workflow and of the tag check;
         the environment keeps its `main`-only rule; branch and tag go in one atomic push; a tag pushed alone
         starts nothing.
      2. *Staging's Cloudflare credentials*: keep sharing the previews' token and account, said plainly: anyone
         who can push a branch can reach staging.
      3. *A fix that needed edits when it was cherry-picked*: accepted when its `cherry-pick -x` line names a
         commit on `origin/main`, and named under "Picked with changes" in the output, the notes and the tag. No
         flag.
13. **Adding a person to production later**: add their email to `SIGN_UP` (step 8 again), deploy, and they sign
    up; or they sign up and an admin adds them on the People page.
