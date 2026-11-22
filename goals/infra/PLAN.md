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
  The brief's `SecretReference` type was not built: no code holds a reference, `env/op.env` does, and 1Password
  fills a variable for one process, so the plan names a variable, never a reference.
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
  none: the repository's stack reads `PREVIEW_TEST_ACCOUNT_PASSWORD` under `op run` and writes it to the `preview`
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
   SIGN_UP=<emails> op run --env-file packages/infra/env/op.env -- bunx alchemy deploy
   packages/infra/src/GitHub.stack.ts --stage prod`, after the same line with `plan`. Points 6 and 8 are settled here.
9. **Production**: `SIGN_UP=<emails> op run --env-file packages/infra/env/op.env -- bunx alchemy plan --stage
   prod`, read it, then the same with `deploy`. Open `https://inventory.beep-effect.com`: the sign-in page offers no
   sign-up to a stranger; his email signs up, creates the organization and is its admin.
10. **On the zone**: "Always Use HTTPS" confirmed on.
11. **Push `main`** (the branch is merged into it locally), so `deploy.yml` reaches GitHub. From then a pull request
    gets a preview and a push to `main` that passes CI deploys `staging`; production deploys only from a release tag
    (`docs/releasing.md`).
12. **Releases and staging** (decision "releases and deploys", 2026-11-22). Nothing new goes in
    `packages/infra/env/op.env`: staging takes the previews' token, account and password, which step 8 already
    gives. What he does:
    - **Deploy the repository's stack again** (step 8, the same line, `plan` first). The plan should show the new
      `staging` environment and its three values (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
      `PREVIEW_TEST_ACCOUNT_PASSWORD`), the `production` environment losing its `main`-only rule while keeping
      him as its required reviewer, and two rulesets: "release tags" (`refs/tags/v*`: only an admin creates, moves
      or deletes one) and "release branches" (`refs/heads/release/*`: no force-push, no deletion). Nothing is
      clicked in GitHub's settings. If he wants it, the setting itself is at Settings, Environments, `production`:
      "Required reviewers" names him, and "Deployment branches and tags" is "No restriction" (the stack sets both).
    - **The first staging deploy** happens by itself on the next push to `main` that passes CI. Before that, a look
      from the workstation: `op run --env-file packages/infra/env/op.env -- bunx alchemy plan --stage staging` from
      the previews' account profile, with `PREVIEW_TEST_ACCOUNT_PASSWORD` filled by `op run`.
    - **The first release**: on `main`, `bun run release minor`, read what it printed, push the branch, wait for
      CI on it, push the tag, approve the deploy in the Actions run.
    - **Three decisions are open** (asked 2026-11-22, after the review of this step); until they are answered the
      build is as described above and `docs/releasing.md` says what GitHub does and does not hold.
      1. *Where production's gate lives.* Today the `production` environment names no ref, so the tag rule is in
         the workflow file the tagged commit brings. Options: (a, recommended) production starts when CI passes on a
         push to `release/**` whose head carries its tag, through `workflow_run`, which always runs `main`'s copy of
         the workflow and of `release verify`; the environment takes back its `main`-only rule; he pushes branch
         and tag together, `git push --atomic origin release/0.7 v0.7.0`. (b) production starts on a push to
         `release/**` whose head carries the tag, the environment takes a `release/*` rule, and only admins may
         push those branches. (c) as it is, with the approval as the only gate.
      2. *Staging's Cloudflare credentials.* It shares the previews' token, and a token covers a whole account.
         Options: (a, recommended) keep sharing, said plainly; (b) a third account for staging, with two new
         `op://` references; (c) a required reviewer on `preview`. Staging on production's account is not offered:
         an unapproved job would hold a token that can change production.
      3. *A fix that needed edits when it was cherry-picked.* It is refused, by the command and by the deploy guard,
         so today it cannot be released. Options: (a, recommended) it counts when its `cherry-pick -x` line names a
         commit on `origin/main`, and the release names it under "Picked with changes"; (b) always refused; (c) as
         (a), behind a flag he types.
13. **Adding a person to production later**: add their email to `SIGN_UP` (step 8 again), deploy, and they sign
    up; or they sign up and an admin adds them on the People page.
