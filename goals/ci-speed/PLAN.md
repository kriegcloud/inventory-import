---
type: Plan
title: "ci-speed, plan"
description: The steps of the ci-speed goal in order, what each waits on, what Benjamin does by hand for the cache Worker, and the baseline measured before any change.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance; [AUDIT](AUDIT.md) holds the measurements each step rests on.
Status is one of `todo`, `doing`, `done`; `built` is written and passing `bun run check` here, and not yet seen on a
run of CI, which needs a push that is Benjamin's to ask for. The work is on the branch `ci/speed`. The decisions were answered on 2026-11-26 and are in
the exploration's [DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md), three entries titled "CI speed".

| # | Step | Returns (estimate, of the run) | Waits on | Status |
| --- | --- | --- | --- | --- |
| 1 | Upload `.turbo/runs/*.json` from both jobs; record ten runs as the baseline | nothing; turns every estimate into a number | nothing | done ("Ten runs after" below) |
| 2 | Start the proofs' three long tasks at once: jobs for prove, verify, and fold with mutants:sample; "Proofs and search of the model" stays as the job that waits for them | 1 to 2 min on a full miss alone; about 4 min with step 3 | nothing | built |
| 3 | Split the check: `catalog-web:test`; `app:test:slow` with the grid test; everything else; "Check, test and build" stays as the job that waits for them | 3 to 5 min | nothing | built |
| 4 | Recover the 8 seeds' failing orderings against the code before each fix, pin them, remove the seed loop; time `catalog-web:test` alone with 2, 3 and 4 Vitest workers and split `Draft.machine.test.ts` by group if workers then share it | 2 to 4 min of the longest task | step 3 for the timing | done; no split: `catalog-web:test` 117 to 160 s on CI ("Ten runs after") |
| 5 | Bring the vendored kit into the hash of prove, verify, mutants and mutants:sample; then take `@beep/repo-cli` out of the root's devDependencies, and bring the CLI's source to the tasks that run it through its own `transit`; the hash experiment both ways | the proofs replay on the 12 of 20 merges that touch only the CLI | nothing | done ("Step 5, the experiment" below) |
| 6 | `envMode` strict: each task's `env`, the pass-through list found by running `check:full` until it passes, locally and on a branch's CI | nothing; a condition of step 9 | nothing | built; CI's run waits on a push ("Step 6" below) |
| 7 | `.dev.vars` out of `build`'s outputs and a check that fails when a build artifact holds one; Node pinned exactly and among the global inputs | nothing; a condition of step 9 | nothing | done ("Step 7" below) |
| 8 | Move `Pwned.slow.test.ts` to a task of its own, never cached; give `test:slow` inputs so the rest can replay | 3 to 5 min where the app's closure is unchanged (22 of the last 40 commits) | step 6 | built ("Step 8" below) |
| 9 | The Worker: the team's settings declared in `GitHub.stack.ts`; `TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` and `TURBO_CACHE` in both jobs (read on a pull request, write on a push to main through the main-only environment, nothing for a fork); `--force` on the check job's tasks on a push to main; the `actions/cache` steps and the key step out of the proofs job; the workstation's lines in `.env.example` | a pull request whose commit passed `bun run check` locally replays those tasks and the proofs; otherwise 2 to 5 min where `bun.lock` is untouched | steps 5 to 8; "By hand" below | built on `ci/remote-cache`; what it shows on CI waits on "By hand" ("Step 9" below) |
| 10 | One variable for property run counts in `vitest.shared.ts`, in each task's `env`; 500 for `WaitedRows.property` on a pull request, today's counts in the nightly | about 30 s | step 6 | done, seen on CI ("Step 10" below) |
| 11 | Drop `tsc -b` from the app's build if `check` covers it; the CLI's at-scale tests to its slow project; `docs/standards/engineering.md` and CLAUDE.md say what CI now carries; ten runs after, beside the baseline | under a minute together | the rest | done; median 361 s over ten runs ("Ten runs after") |

Steps 1 to 8 and 10 wait on nothing of Benjamin's. Every estimate is capped by the other job: steps 2 and 3 reach their
figures together, not apart.

## Blocker

Step 9 is built and cannot be seen working until the team exists on the Worker, its tokens are in 1Password and the
GitHub stack is deployed: "By hand" below, each step Benjamin's.

## By hand, Benjamin's

No agent deploys either stack. In order:

1. In beep-effect, `packages/tooling/infra/turbo-cache/src/Worker.ts`: a team `inventory` in `cachePolicy` with three
   principals, main's CI (write), pull requests (read) and the workstation (write). Written as
   [beep-effect#3611](https://github.com/beep-effect/beep-effect/pull/3611); the merge and the deploy through
   `deploy-turbo-cache.yml` are his.
2. The three tokens, from beep-effect's token command with `--team inventory` (`ci-pr`, `ci-main`, `dankstation`),
   into 1Password. Never in a chat, a log or a file in either repository. Their references go in
   `packages/infra/env/op.env.local` as `TURBO_CACHE_READ_TOKEN` and `TURBO_CACHE_WRITE_TOKEN` (the lines in
   `op.env` show the form), and the Worker's address, which the command prints, in the root's `.env` as
   `TURBO_CACHE_API`.
3. Here, after step 9's change to `GitHub.stack.ts` is merged: deploy the GitHub stack, which makes the variables,
   the secrets and the environment limited to main.
4. On the workstation: `TURBO_API`, `TURBO_TEAM` and `TURBO_TOKEN` (the `dankstation` token, as a reference) in the
   untracked `.env`, as `.env.example` shows; then `op run --env-file=.env -- bun run check` reads and writes the
   Worker.

## What the workstation's write token rests on

He chose against the recommendation here, so the conditions are written down. A result made on his machine is
replayed by a pull request's CI. What keeps that honest:

- Strict `envMode` (step 6): a variable in his shell that no task lists is not seen by the task.
- `.dev.vars` never in an artifact, held by a check (step 7).
- Main's push forces the check job's tasks (step 9), so a machine difference is red at the merge.
- The nightly forces the proofs and runs every mutant.
- What is not covered: a file a task reads and does not declare in `inputs`. CI used to catch that by replaying
  nothing; after step 9 only main's forced run does, and only for the check job's tasks. A proof's undeclared
  input is caught the next night.

To take the choice back: make the workstation's principal read-only in beep-effect's policy and rotate its token.

## Baseline

Before any change, from GitHub Actions on 2026-11-26. Step 1 replaces it with turbo's own times.

| | Value |
| --- | --- |
| Median run, pull request | 673 s (13 green runs) |
| Median run, push to main | 713 s (15 green runs) |
| Check job | 478 to 766 s; limit 900 s |
| `check:ci` step | 426 to 682 s; 0 of 107 to 109 tasks replayed in every run |
| Proofs job, nothing replayed | 489 to 703 s |
| Proofs job, all replayed | 15 to 24 s |
| `catalog-web:test` | 190 to 449 s |
| `app:test:slow` | 191 to 311 s |

## The first run on CI

PR #27, run 45918212383, 2026-11-27, the first with the split jobs, strict `envMode` and `PROPERTY_RUNS=short`.
Every job started within a second of 00:41:40 UTC. Times from GitHub's start and end of each job:

| Job | Result | Time |
| --- | --- | --- |
| The reasoner on the vocabulary | passed | 62 s |
| The search of the model | passed | 146 s |
| Check and test the catalog's screens (`web`) | passed | 182 s, against 190 to 449 s for `catalog-web:test` alone before |
| The model against the review region, and a sample of its mutants | passed | 192 s |
| Check, test and build, all but the two longest (`rest`) | passed | 194 s |
| Slow tests and the data grid (`slow`) | passed | 381 s: the longest job, against 191 to 311 s for `app:test:slow` alone before; nothing replayed, as no cache is shared yet |
| The model's proofs | passed, with nothing restored: the cache keys are new | 346 s, against 489 to 703 s for the whole proofs job before with nothing replayed |

The two required gates passed: "Proofs and search of the model" at 00:47:32, "Check, test and build" at 00:48:07.
The whole run took 390 s from its start to the last gate, against a median of 673 s on pull requests before.
The slow job now sets the run's length. One run is not the ten SPEC asks for; the ten after are the next section.

## Ten runs after

PR #27 at 4198294, 2026-11-27: run 45918212383, then run 45919308058 and its attempts 2 to 9 (`gh run rerun`), all
ten green, nothing replayed in any of them (no shared cache yet; the proofs' `actions/cache` keys were new). A run's
length is from its first job's start to its last job's end, from GitHub's job times:

| | Before (13 runs) | After (10 runs) |
| --- | --- | --- |
| Median run, pull request | 673 s | 361 s |
| Range | 478 to 766 s for the check job alone | 306 to 426 s for the whole run |

The ten, in order: 390, 306, 344, 419, 355, 426, 346, 367, 324 and 374 s. Two of them pass 420 s; the median does not.

Each job over the nine attempts, median (lowest to highest):

| Job | Median |
| --- | --- |
| Slow tests and the data grid | 331 s (272 to 358) |
| The model's proofs | 318 s (227 to 367) |
| The model against the review region, and a sample of its mutants | 288 s (190 to 417) |
| Check, test and build, all but the two longest | 276 s (195 to 292) |
| The search of the model | 199 s (146 to 251) |
| Check and test the catalog's screens | 173 s (138 to 177) |
| The reasoner on the vocabulary | 58 s (49 to 63) |

Turbo's own task times over the ten (`.turbo/runs/*.json`, the artifacts step 1 uploads), the ten longest:

| Task | Median | Range |
| --- | --- | --- |
| `catalog-model#prove` | 311 s | 207 to 344 |
| `catalog-web#fold` | 269 s | 172 to 398 |
| `app#test:slow` | 246 s | 198 to 290 |
| `catalog-model#verify` | 178 s | 126 to 229 |
| `catalog-web#test` | 153 s | 117 to 160 |
| `repo-cli#test` | 91 s | 60 to 100 |
| `catalog-model#mutants:sample` | 49 s | 38 to 63 |
| `app#test` | 40 s | 27 to 53 |
| `catalog-model#test` | 36 s | 24 to 48 |
| `repo-cli#test:slow` | 35 s | 27 to 43 |

What they settle:

- SPEC's median, at most 420 s over ten runs: 361 s, with nothing replayed. Step 9's cache only shortens it.
- `catalog-web:test` under 200 s over five runs: 117 to 160 s over ten, so `Draft.machine.test.ts` is not split
  (step 4).
- The proofs with nothing replayed in at most 7.5 minutes: the slowest of the three proof jobs took 417 s, and the
  proofs gate never waited longer.
- The baseline was measured before step 1's upload existed, so its numbers are GitHub's; turbo's own times start
  with these ten.
- What would come next, were it wanted: the fold (172 to 398 s) and the slow job set the longest runs.

## Step 9, the shared cache

Built on the branch `ci/remote-cache`, stacked on `ci/speed`, so `ci/speed` can merge first: the proofs' `actions/cache`
replay is gone here, and until the stack is deployed a pull request on this branch runs the proofs with nothing
replayed, as the ten runs above did (361 s median).

- `packages/infra/src/TurboCache.rules.ts`: the team, the variable names and `cacheSettingsOf`, which takes the
  Worker's address and the two tokens all three or none; a part stops the stack and names what is missing
  (`packages/infra/test/TurboCache.test.ts`).
- `GitHub.stack.ts`, once given the three: `TURBO_CACHE_API` and `TURBO_CACHE_TEAM` as repository variables,
  `TURBO_CACHE_READ_TOKEN` as a repository secret (GitHub gives a fork's run none), and the environment
  `turbo-cache-write`, limited to main, holding `TURBO_CACHE_WRITE_TOKEN`. Given none, it writes none, and the stack
  still deploys the rest.
- `ci.yml`: the four jobs that run turbo (`rest`, `web`, `slow`, `model`) start with "The shared cache", which sets
  `TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` and `TURBO_CACHE` for the job only when the variables and a token are
  there: `local:rw,remote:rw` with the write token on a push to main, `local:rw,remote:r` with the read token
  otherwise. A push to main takes the `turbo-cache-write` environment, and only once `TURBO_CACHE_API` is set, so no
  run makes that environment before the stack does. `rest`, `web` and `slow` run with `--force` on a push to main.
  The proofs' key step and its two `actions/cache` steps are gone; the reasoner's, which keep its jar, stay.
- `.env.example` at the root: the workstation's three lines and the stack's address line.
- Checked here: the infra package's type-check, lint and the new test; `bun run check`; the workflow parses and
  each of the four jobs has the step. Not checked: any of it on CI with the cache, which needs "By hand" 1 to 3.

What the acceptance needs once the cache exists, each read from a run:

1. A token of `inventory` asking for team `beep` is refused: `curl -H "Authorization: Bearer $TOKEN"
   "$TURBO_CACHE_API/v8/artifacts/status?slug=beep"` answers 403 (run by Benjamin, with the token from `op read`).
2. A pull request that touches only documents: "N cached" in the log of each of the check's jobs.
3. A pull request whose commit passed `bun run check` with the workstation's token: its tasks and the proofs replay.
   Not the search (`verify`): its hash holds `CI`, which a runner sets and the workstation does not, so it replays
   only what a push to main wrote, or a workstation's `CI=true bun run proofs`.
4. The push to main that merges it: "0 cached" in the check's three jobs, and the next pull request replays what it
   wrote.

## Step 4, the seeds' orderings

There were ten seeds, not the eight the audit counted: 9b6ac36d added two after it. Each was played at 1,000 runs
against the code before its fix, in a scratch worktree (removed after): at the fix commit with its `src` taken from
the commit before where the fix was in the machine, with its world taken from the commit before where the fix was
in the property world, and at the commit itself where the seed failed an older machine. Each failed, and printed
its shortest ordering. Run on 2026-11-26:

| Seed | Played against | Falsified after | What did not hold | Pinned |
| --- | --- | --- | --- | --- |
| -876652368938065 | 9b6ac36d, `src` before | 92 runs | row c: the line says it was decided since by someone else, and only this tab wrote it | already, word for word |
| -5255366521312007 | 9b6ac36d, `src` before | 870 runs | row b: the same | already |
| 369148268449177 | 5ae91943, before the rewrite (518babdb) | 651 runs | after everything landed, a row of the person's still waits | new, below |
| -2416120108841983 | 5ae91943 | 762 runs | the same | new, below |
| 5903557278919753 | 518babdb | 526 runs | row a's value is not on the server, waiting, on a line or named | already |
| -7675454253259129 | b7d94590, `src` before | 499 runs | row b: she picked one value, and the server holds another with no line | already |
| 7065129212828743 | b7d94590, `src` before | 374 runs | row c: the line says it was decided since by someone else, and only this tab wrote it | already |
| -5469710740912195 | b7d94590, `src` before | 6 runs | row a is sent as the server refused it | already |
| 1376949052012291 | 1a8ecfc1, world before | 237 runs | row a waited and goes as a live press | already |
| 22 | 4ee66ba0, world before | 907 runs | row a is sent as the server refused it | already, the test at "her own decision on its way, its answer lost with a reload" |

"Already" means the ordering the seed printed is a run of commands in "orderings the properties met, pinned",
command for command: each fix commit had pinned its shortest ordering beside its seed. The two from before the
rewrite were written in that day's commands, when the world kept one save out at a time; they are pinned as one new
test with each save as the one the draft waits for (`which: "last"`), and both hold on today's code. They cannot
be played against the old machine in today's world, whose commands changed with the rewrite; the table's line is
the old world's own failure. The seed loop is gone. The four unseeded properties keep 1,000 runs.

`Draft.machine.test.ts` alone, one worker: 75 tests in 50.6 s. `catalog-web:test` alone on four pinned cores
(`taskset -c 0-3`, the runner's stand-in), two rounds, on a workstation busy with other work (load 9 to 22):

| Workers | Round 1 | Round 2 |
| --- | --- | --- |
| 1 | 81 s | 87 s |
| 2 | 57 s | 47 s |
| 3 | 87 s | 53 s |
| 4 | 66 s | 48 s |

Past two workers nothing is gained: the draft file, about 50 s in one worker, is the floor. Not done yet: the web
job still gives one worker, and the file is not split. Both wait on the job timed on CI over several runs at one
and at two workers, as the standard asks before a job is given more; if two holds, splitting the file by group is
what lets a third or fourth worker help.

## Step 11, the build's type-check and the CLI's tests at scale

`tsc -b` stays in the app's build: `check` does not cover it. The build's `tsc` is effect-tsgo 7.0.2, the pinned
compiler; `check` runs `tsrs` 7.1.0-beta with `--fast`, which its own help says "may differ from pinned TypeScript
behavior", and nothing else runs the pinned one (`typecheck:tsc` is in no task). It took 2.7 s on the workstation
against 0.6 s for `tsrs -b --fast`, so keeping it costs seconds.

The CLI's two tests at scale moved to `test/Steps.slow.test.ts`, in its slow project, which turbo now replays (step
8): names given the one before from a hundred to ten thousand, and the five heaviest shapes at about a million
characters. The shapes and `within` moved unchanged to `test/support/shapes.ts`, apart from five helpers made dual,
as an exported helper with two arguments must be. 143 tests in `Steps.test.ts` and 4 in the slow file, against 147
before; the fast file took 12.1 s alone where it took 24.3 s. `Release.test.ts` stays: its time is spread over
tests of real git repositories, none of them at scale (the slowest 1.9 s).

`docs/standards/engineering.md` ("The check on CI") and CLAUDE.md say what each job carries, the live test, the
replayed slow tests and the run counts (steps 3, 8 and 10). Not done: the ten runs after, beside the baseline, which
need the branch pushed.

## Step 5, the experiment

`turbo run check lint test prove verify fold mutants:sample mutants test:slow build --dry=json`, 87 tasks, one line
appended to one file, the hashes compared before and after. Run on 2026-11-26.

| Edit | Before the change | After |
| --- | --- | --- |
| A CLI source file (`packages/tooling/tool/cli/src/bin.ts`) | 87 of 87 hashes change, every proof task among them | 31 of 87: every package's `check` and the CLI's own four tasks. No `prove`, `verify`, `fold`, `mutants`, no other test, no build |
| `@beep/schema` (a file under its `src`) | 87 of 87 | 57 of 87, with `catalog-model#prove`, `#verify`, `#mutants:sample`, `#mutants` and `catalog-web#fold` |
| `@beep/types`, which the kernel reaches only through the kit | 87 of 87 | 60 of 87, with the same five |
| The kernel (`packages/kernel/src/Role.schema.ts`) | not run | 31 of 87, with the same five |
| A handler of the model's package, which no proof reads | not run | 12 of 87; of the five only the fold |

The root tasks, the same way (19 of them are cached): a CLI edit changes 18, all but `lockfile:check`, which runs
bun and not the CLI; an edit to `@beep/types` changes the same 18.

How: `prove`, `verify` and the two mutants tasks depend on `@inventory/kernel#transit` (the mutants on the
contract's too), which folds the kernel's dependencies into their hash; a package's `check` and the seven root
tasks whose inputs did not reach the kit depend on `@beep/repo-cli#transit`. `beep-cli` still resolves with no
package depending on the CLI: bun links a workspace's command whether or not anything asks for it (seen after an
install from nothing).

Found on the way, and not this goal's: a new file git does not yet track in a kit package changed no proof's hash
before this change, since the root's dependency hashed tracked files only. It does now.

## Step 6, what a task sees

`envMode` is `strict`. A task sees its own `env`, which turbo hashes, the pass-through list, which it does not, and
the few turbo always lets through (PATH, HOME, the terminal's). The list, with the reason for each, is in
`turbo.json`: `CI`, `GITHUB_ACTIONS`, `VITEST_MAX_WORKERS`, `LEDGER_BASE`, `JAVA_HOME`, `XDG_CACHE_HOME` and
`MISE_*`. `build` names `CLOUDFLARE_ENV`, `BUNDLE_REPORT` and `ALCHEMY_CLOUDFLARE_VITE_INJECTED` in its `env`;
`verify` already named `CI`. Run on 2026-11-26:

| Trial | Result |
| --- | --- |
| `bun run check:full -- --force --continue` under strict | 114 of 114 tasks passed, none replayed, 3 min 39 s |
| The 87 tasks' hashes with `AI_ENABLED=false` and a made-up `OPENROUTER_API_KEY` in the shell, against none | 0 of 87 change |
| `@beep/types#test` with its script swapped for one that prints what it sees, under `AI_ENABLED=false VITEST_MAX_WORKERS=1` (put back after) | it saw `VITEST_MAX_WORKERS=1` and no `AI_ENABLED` |

Not yet seen: a run of CI under strict. The workflows set only listed variables and the ones a step names for its
own command, so none is expected to fail; a variable a task needs and the list lacks shows as that task failing.

## Step 7, what the build stores and which Node runs

`turbo run build --filter=@inventory/app --force` into an empty cache folder, with a file `apps/inventory/.dev.vars`
holding one marker line (made for the experiment in a checkout that had none; no real one was read). Run on
2026-11-26.

| | Files in the stored result | `.dev.vars` or `.env` among them | On disk in `dist` after the build |
| --- | --- | --- | --- |
| Before | 115 | `apps/inventory/dist/inventory/.dev.vars` | `dist/inventory/.dev.vars` |
| After | 114 | none | `dist/inventory/.dev.vars`, so `vite preview` still has it |
| After, with a `.env.local` and a `.dev.vars.staging` beside it too | 114 | none | `dist/inventory/.dev.vars` |

`build`'s outputs leave out `.dev.vars`, `.dev.vars.*`, `.env` and `.env.*` anywhere under `dist`, and
`packages/tooling/tool/cli/test/TurboCache.test.ts` fails when a task that stores files under `dist` does not. The
same file holds that the root depends on no workspace (step 5) and that the pinned Node is in every hash.

Node is `22.23.4`, in `.tool-versions`: every workflow sets it up from that file (`node-version-file`), turbo hashes
the file into every task, and `version-sync` holds its major to `engines.node`. On the workstation mise reads the
same file, so inside this repository `node` is 22.23.4 where it was 24.22.1: that is the point of the pin, and it is
the one thing here that changes what his machine runs. Not checked at run time: a machine with no version manager
runs whatever Node it has under the pin's hash.

## Step 8, the slow tests replayed and the live one run

The breach check against the real service is `apps/inventory/test/server/Pwned.live.test.ts`, in a third Vitest
project of the app, `live` (`*.live.test.ts`), run by the package task `test:live`, which is never cached.
`test:slow` now has the fast tests' inputs and is replayed; the CLI's two slow files share the definition and are
replayed with it. `check:full`, `bun run test` and CI's `slow` job run both. Run on 2026-11-26:

| Trial | Result |
| --- | --- |
| `turbo run test:slow test:live`, twice | First: 4 tasks run, 73 s. Second: both `test:slow` replayed, `test:live` run again, 2.8 s |
| A line added to `packages/catalog/model/src/Item/ItemSearch.rules.ts` | the app's `test:slow` hash changes |
| To `apps/inventory/src/server/App.ts` | the app's changes; the CLI's does not |
| To `packages/tooling/tool/cli/src/bin.ts` | the CLI's changes; the app's does not |
| To `packages/ontology/src/Constructs.rules.ts`, which the app does not import | neither changes |

Nothing in the app's slow tests reads a file outside its own folder or a package it imports (its migrations, seeds
and `wrangler.jsonc` are in the folder), so the default inputs hold what they read. Not yet seen: a run of CI.

## Step 10, fewer property runs on a pull request

`PROPERTY_RUNS` is read once, in `vitest.shared.ts`, through Effect's `Config` (`full` or `short`; unset is `full`;
any other value stops the test run at its start and names what it expected), and handed to every test through
Vitest's `provide`. A test reads it with `runsOf({ full, short })` (`packages/catalog/model/test/support.ts`);
`WaitedRows.property` asks for 2,000 and 500. The `test` task names it in its `env`, so it is in the hash and strict
mode lets it through.

CI sets `short` on a pull request only, and only while no cache is shared (`vars.TURBO_CACHE_API` is empty), in a
step of `rest` and `web` that writes it to the job's environment: the cache's writers leave it unset, so a pull
request that set it could replay no `test` task (found by the review of step 9; decision "property run counts once
the cache is shared"). A push leaves it unset, as a workstation does: turbo hashes unset, empty and `full` as three different values (seen
below), so only unset lets a push and a workstation share a result made at today's counts once the cache is shared
(step 9). The nightly's proofs job runs the model's tests again with nothing replayed and the variable unset. Run on
2026-11-26:

| Trial | Result |
| --- | --- |
| `WaitedRows.property.test.ts` alone, unset | 37.6 s |
| The same, `short` | 6.4 s |
| The same, `sohrt` | stopped at start: `Expected "full" \| "short" at ["PROPERTY_RUNS"]` |
| `@inventory/catalog-model#test` hash: unset, `short`, `full`, empty | four different hashes |
| The model's whole `test` task under turbo, `short` | 21 files passed, 6.2 s |

Only the one property moved; the three others at 2,000 (`ItemFields.arbitrary`, `Row.property`, the xlsx oracle)
take a few seconds each and keep their counts, as the decision named only this one.

## Choices made along the way

- 2026-11-26: the CLI is not made a dependency of the six packages whose `check` runs it, as the audit proposed.
  The boundaries law says nothing depends on tooling, and changing a law to save the other packages' type-checks on
  a CLI-only merge is not worth it: those are seconds, in the job that is not the longest. Every package's `check`
  still reruns on a CLI edit, as before; no test, proof or build does.
- 2026-11-26: `check:ci` no longer runs the slow tests. The law on the three check scripts lets a job's command be
  one of them with a filter, not a fourth list of root tasks kept by hand; so `rest` is `check:ci` without the
  catalog's screens, and `slow` runs `turbo run test:slow` itself.

- 2026-11-26: main's forced run covers the check job's tasks and not the proofs. His answer named tests, slow tests
  and the build; type-check and lint are forced with them because they are seconds. Forcing the proofs on every
  push would put 8 to 11 minutes back on main, and the nightly already forces them.
