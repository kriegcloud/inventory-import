---
type: Research
title: "ci-speed, the audit"
description: What a CI run costs today, measured from GitHub Actions on 2026-11-26, where the time goes, what turbo.json and the tests do that costs time, and what using beep-effect's turbo cache would take and return.
---

# The audit

Read on 2026-11-26 from `gh run view` logs of `kriegcloud/inventory-import` and of beep-effect, from
`turbo run ... --dry=json`, and from both repositories' files. Five auditors each took one part (turbo.json, the
workflows, the remote cache, the tests, the other checks); a second reader then re-derived every finding from a run
it chose itself. What the second reader corrected is written here as corrected; what it refuted is under
"Looked at and set aside". Turbo is 2.11.13 in both repositories. Nothing was run in full locally, and no change was
tried on CI: every saving below is an estimate from measured task times, never an observed run.

## The comparison with beep-effect

beep-effect is not faster from push to green. It is wider.

| | inventory-import | beep-effect (`check.yml`) |
| --- | --- | --- |
| Median run, pull request | 673 s (13 green runs) | 2,445 s |
| Median run, push to main | 713 s (15 green runs) | 4,880 s |
| Jobs per run | 3 | about 40 on a PR, 71 on a push |
| Longest single job | the whole run (478 to 766 s) | 561 s (run 45889311794, 64 jobs) |
| Turbo results replayed in the check | 0 of 109, every run | 333 of 2,847 tasks in run 45889311794 |

beep-effect's times include queueing for its own runners. What feels faster there is that each job is short and the
first failure arrives early: lint, unit and integration tests are separate shards. Its remote cache replayed about an
eighth of the tasks in the run sampled, so the cache is not what makes it quick. The lesson to take is the split;
the cache comes second.

## Where a run's time goes

A run lasts as long as its longer job: `max(check, proofs)`. Every saving in one job is capped by the other.

| Part | Measured | Source |
| --- | --- | --- |
| Check job, start to end | 478 to 766 s | runs 45894974766, 45892954369, 45884807702, 45894896558 |
| `bun run check:ci` step | 426 to 682 s, "0 cached, 107/109 total" in all 9 logs read | the same and five more |
| Checkout, node, bun, install | 10 to 17 s (`bun install` 5 to 7 s) | step times |
| `@inventory/catalog-web:test` | 190 to 449 s | vitest Duration lines |
| of which `Draft.machine.test.ts` alone | 216 to 388 s (80 to 84 tests) | the file's line in each log |
| `@inventory/app:test:slow` (`cache: false`) | 191 to 311 s; `WriteLimits.slow.test.ts` 72 to 113 s | the same |
| `@beep/repo-cli:test` | 81 to 127 s | 45894974766, 45894896558 |
| `@inventory/catalog-model:test` | 55 to 101 s | the same |
| The 29 root `//#` tasks | 25 to 41 s of wall time at the start | group timestamps |
| "Type on the data grid", after the turbo step | 39 to 53 s | step times |
| The ledgers again, pushes only | 13 to 20 s | step times |
| Proofs job, nothing replayed | 489 to 703 s (prove 234 to 326 s, verify 234 to 326 s, fold 173 to 359 s, mutants:sample 46 to 59 s) | 45884807702, 45868780002, 45768732893 |
| Proofs job, everything replayed | 15 to 24 s | 45771224808 and four more |
| Proofs job longer than the check job | 666 against 534 s, 703 against 639 s | 45884807702, 45868780002 |
| Check job's time limit | 900 s (`ci.yml:24`); the slowest run read used 766 s | 45894896558 |

The same 109 uncached tasks took 426 s in one run and 682 s in another: runners differ by 1.6 to 1.8 times. Read
every estimate here as a range of about 40% either way.

Setup is not the problem (no gain from caching bun's packages), the Deploy workflow is not (a preview is a minute
beside CI), and neither are the root laws (the CLI starts in 0.12 to 0.15 s; turbo's graph and hashing cost 0.46 s).

## Findings, by what they return

### 1. One job carries everything, two tasks at a time, and starts its longest task late

`ci.yml` runs all of `check:ci` in one job at `--concurrency=2` with one Vitest worker. Turbo does not start the
longest task first: in run 45894896558 `catalog-web:test` (441 s) began about 217 s into the step, and
`app:test:slow` (300 s) began at about 382 s, after `app:build`, `app:check` and `app:test` had run one after another
in the other slot. The step's 682 s is roughly the late start plus the long test.

Split into parallel jobs, each with the runner to itself: `catalog-web:test`; `app:test:slow` with the grid test;
everything else. The check then lasts about as long as its longest job plus 15 s of setup: about 300 s on the fast
run (from 478), about 455 s on the slow one (from 766). A job that has the runner to itself may also take more than
one Vitest worker, which `docs/standards/engineering.md` ("The check on CI") measured against four cores shared by
two tasks; that needs measuring again, not assuming.

Two things a split must respect. The ruleset `main` requires the contexts "Check, test and build" and "Proofs and
search of the model" by name (`packages/infra/src/GitHub.stack.ts:76`): either one job under each name stays and
waits for the parts, or the stack changes, and deploying the stack is Benjamin's. And `repo-cli:test` (up to 127 s)
and `catalog-model:test` (up to 101 s) are the third and fourth longest tasks: they decide how long "everything
else" is.

### 2. The proofs job runs its longest task last

At `--concurrency=2` prove and verify take both slots; fold (up to 359 s) starts only after verify and
mutants:sample finish. Run 45884807702: fold started 4 m 54 s into the step, which took 10 m 51 s. Three jobs
(prove; verify; fold with mutants:sample), each restoring the same cache, bring a full miss from about 11 minutes to
about 6.5 to 7. On its own this saves only what the proofs job exceeded the check job by (64 and 132 s in the two
runs measured); with finding 1 it is the difference between an 11 minute run and a 7 minute one. Nothing in
`docs/verify.md` changes: the same tasks, inputs and lock, and the nightly keeps `--force`. The cache is still
saved from main only.

### 3. One test file is most of the check job's longest task

`packages/catalog/web/test/Draft.machine.test.ts` is 88% of `catalog-web:test`. It holds 4 unseeded properties and a
loop of 8 recorded seeds, each at `runs = 1000` (line 66; the loop at line 1757). The 8 seeds took 253 s of the
file's 388 s in run 45894896558 (27.6 to 33.9 s each).

Two levers, different in kind:

- Splitting the file by group, so several workers run it. No search is lost. It needs finding 1 first, since CI
  gives one worker today.
- Running each recorded seed once instead of a thousand times. This is a decision about search depth and it is not
  mechanical: the seeds were recorded as seeds, with no failing index, so `seed` with `runs: 1` would play only the
  seed's first case and not the ordering that failed. Each counterexample would have to be recovered against the
  code before its fix and pinned beside the "orderings the properties met, pinned" block (line 872). `replay` in
  `effect/Arbitrary` promises nothing across releases.

After finding 1 the first lever is worth about a minute (the next longest job then sets the run); the second is
worth more and is Benjamin's.

### 4. The check job keeps no turbo results between runs

No `actions/cache`, no `TURBO_*`: "Remote caching disabled" and "0 cached" in every log. The proofs job already
shows the working pattern in this repository (restore `.turbo/cache` by prefix, save from a passing push to main).

What it would return, from comparing task hashes of real PR runs with the main run each was based on: PR #18
matched main on 76 tasks, #17 on 62, #14 on 90, #15 (which changed `bun.lock`) on 0 of 97. 4 of 17 merged PRs
touched `bun.lock` and replay nothing. For the rest about 120 to 290 s of the check step replays, capped by the
proofs job. On a push to main it returns little, because GitHub never lets main read a cache a PR saved, and letting
PRs write is what beep-effect refuses for good reason.

Twelve tasks can never replay: the seven ledger laws, `defaults:check`, `alchemy:check`, `patches:check`,
`patches:installed` and both `test:slow`. The ledger laws are refused on purpose (main is no file turbo can hash) and
stay that way.

Conditions before any cache is shared:

- **`build` would store a workstation's `.dev.vars`.** `@cloudflare/vite-plugin` 1.70.2 emits `.dev.vars` into
  `dist/inventory` when one exists locally, and `build` declares `outputs: ["dist/**"]`. 89 of the 172 local build
  artifacts since 2026-11-10 in the local turbo cache hold one (names listed only, nothing read). CI writes no
  `.dev.vars`, so the rule is: `"outputs": ["dist/**", "!dist/**/.dev.vars"]`, and only main's CI ever writes to a
  shared cache.
- **No environment is hashed** (`envMode: "loose"`, and the dry run shows an empty list for every task in
  `check:ci`). `build` reads `CLOUDFLARE_ENV`, `BUNDLE_REPORT` and `ALCHEMY_CLOUDFLARE_VITE_INJECTED`; any new
  variable that changes a test's result (a run count, finding 8) must be named in that task's `env`.
- **Node floats**: CI asks for `node-version: 22` and turbo hashes the string `>=22`, not the version that ran.
- **CI stops being the backstop.** Today an input a task forgot to declare is caught on CI because CI replays
  nothing. Once it replays, the `inputs` lists are the only guard.
- **The cache grows**: turbo never evicts, and restore-then-save carries every old entry forward (the proofs entries
  have grown from about 50 KB to 104 KB). With the 4.6 MB build artifact in it the check's entry would grow by that
  much per push to main, so it needs a prune or a key per merge base.

### 5. A CLI edit invalidates every task, the proofs included

The root `package.json` has `"@beep/repo-cli": "workspace:*"` in `devDependencies`, which puts the CLI's source into
turbo's hash of the root's internal dependencies, and every task's hash starts from that. Measured on an archived
copy: one appended line in a CLI source file changed 57 of 57 task hashes, prove, verify and fold among them. 12 of
the last 20 merges touched `packages/tooling/tool/cli/`, so the proofs job misses on most merges for a reason that
has nothing to do with the model.

The fix has a trap the second reader found by experiment. `packages/catalog/model/turbo.json` relies on that same
root dependency to cover the vendored kit: prove, verify and the mutants name the kernel's sources and have no
`^transit` edge. With the root dependency removed, an appended line in `@beep/schema` left the hashes of
`catalog-model#prove`, `#verify` and `#mutants:sample` unchanged: an old proof would replay. So the order is fixed:
first name the kit's sources (or the kernel's workspace dependencies) in those tasks' inputs, then remove the root
dependency, then repeat both experiments. The six packages whose `check` runs `beep-cli` (the app, client,
catalog-web, ui, review, access-web) take the CLI as their own dev dependency, and the CLI's source leaves the
generic `check.inputs`. Not measured: whether `beep-cli` still resolves in those six after the move.

### 6. `test:slow` is uncached for one suite of one second

`turbo.json` sets `"test:slow": { "cache": false }` because "one suite calls a live service". The suite is
`apps/inventory/test/server/Pwned.slow.test.ts` (the real Have I Been Pwned service; 0.9 to 1.2 s). The other 23
files, 191 to 311 s, are uncached with it, and so is `repo-cli:test:slow`, which shares the definition. Moving the
one suite to a task of its own lets the rest replay when the app's closure is unchanged: 22 of the last 40 commits on
main left it alone. It returns nothing without finding 4.

### 7. Pushes to main queue behind each other

`cancel-in-progress` is on for pull requests only. Run 45757987531 waited 727 s for the run before it and took
1,461 s from push to end; run 45894918313 was replaced while waiting, so its commit was never checked. Cancelling a
run in progress on main would give the newest commit its result sooner, at a cost: a cancelled run saves no proofs
results, and a commit in the middle of a burst is checked only as part of the next. Whether main's every commit must
be checked on its own is Benjamin's.

### 8. Smaller things, each measured or marked

| What | Where | Return |
| --- | --- | --- |
| The grid test runs after the whole turbo step and needs nothing from it (it starts its own dev server, `scripts/grid-keys.mjs:137`) | `ci.yml:113` | 35 to 40 s as its own job; inside finding 1 |
| The build type-checks again (`tsc -b && vite build && ...`) beside `check` (`tsrs -b --fast`) | `apps/inventory/package.json:10` | app:build took 31 s where vite's builds took under 3 s, in the slot that delays `test:slow`; the share of `tsc -b` not measured |
| `WaitedRows.property.test.ts` runs 2,000 runs in the fast tests | line 309; 44 to 86 s | about 30 s at 500 runs on PRs with today's count nightly; a decision on search depth |
| The CLI's tests of very large inputs (`Steps.test.ts` 56 s, a million characters 15 s, `Release.test.ts` 18 s) | `packages/tooling/tool/cli/test` | 10 to 15 s if the at-scale cases move to the CLI's slow project |
| Slow suites build workerd and D1 once per test (`WaitedRows` 22 layers for 24 tests, `Rematch` 15 for 15) | `D1.test-layer.ts:90` | not measured; at most 15 to 25 s |
| The fold's inputs include every test file of catalog-web | `turbo.json`, `fold` | none in the merges read; narrowing risks a stale fold |
| Turbo's per-task times are written to `.turbo/runs` and thrown away | `--summarize` in `ci.yml:96` | no time; uploading them replaces every estimate here with a measurement |
| `futureFlags.affectedUsingTaskInputs` exists in the installed turbo and is not set | `turbo.json:3` | not tried; the cache is exact where `--affected` is a selection, so the cache comes first |

## beep-effect's turbo cache

It is a Cloudflare Worker (`packages/tooling/infra/turbo-cache` in beep-effect) at
`beep-turbo-cache.beep-effect.workers.dev`, with R2 behind it.

- **It can hold a second repository as it is built, and does not today.** `CachePolicy.ts` takes a list of teams;
  `Protocol.ts` answers 403 unless the request's `slug` is the token's team, stores under `<team>/<hash>` and lets
  only a write token upload. `Worker.ts:70-80` names one team, `beep`. A team `inventory` is a few lines there, a
  merge to beep-effect's main and its `deploy-turbo-cache.yml`. Using the `beep` tokens would let this repository
  write into beep-effect's results: never.
- **Who writes.** beep-effect gives pull requests a read token and main a write token through an environment
  (`setup-monorepo-ci/action.yml:89-96`). Here the write environment must be keyed to `refs/heads/main`, not to
  every push; a fork gets nothing.
- **What it does not have**: artifact signing is off in both repositories; one bucket, one 30 day expiry and one
  alert serve every team; no size limit.
- **What this repository would hold** (names only): variables `TURBO_CACHE_API` and `TURBO_CACHE_TEAM`, secrets
  `TURBO_CACHE_READ_TOKEN` and `TURBO_CACHE_WRITE_TOKEN`, an environment `turbo-cache-write` limited to main.
  `packages/infra/src/GitHub.stack.ts` is where environments and secrets are declared here, but the token values
  come out of beep-effect's Alchemy state, so how they cross is a decision.

Against `actions/cache`: on a pull request the two replay about the same tasks, and `actions/cache` needs no tenant,
no token and no deploy. What the Worker adds is reads from a workstation, results that outlast GitHub's seven days,
no growing archive to prune, and a hit for a PR whose base is older than main's newest save. What neither gives
is a hit on the push to main for what its PR already ran, short of letting PRs write.

So: `actions/cache` first, because it is this repository's own proven pattern and returns the same on a PR; the
Worker when workstation reads are wanted, as its own step with its conditions.

## Looked at and set aside

- **Narrowing each law's inputs to its own rule files** so a CLI edit replays the others: refuted. Those tasks take
  5 to 11 s beside two tests of 300 s and more; replaying them changes nothing a person waits for.
- **Restoring Vitest's module cache**: refuted. Transform is 1 to 3% of the long suites, and the fast and slow
  projects keep separate cache paths on purpose.
- **A prebuilt CLI binary, as beep-effect has**: about 2 s. Every job here installs anyway.
- **One process for all the laws**: about 5 s, and it would cost each law its own cached result.
- **A job that passes documentation-only changes without running**: `docs:check`, the format check, the key scan and
  `private-paths:check` read exactly those files. The cache gives the same saving and skips nothing.
- **Dropping the seven ledger laws from the first pass on a push**: 7 to 14 s, and it changes what is checked. The
  first pass compares with the commit before, the second with the last passing push; a number lowered and raised
  again in between would pass. The second pass is also skipped when no base qualifies.

## Not measured

- Any run with a change applied. Every saving is arithmetic on measured task times.
- The runner's core count (taken as four from GitHub's documentation and `ci.yml:91`).
- The cost of one workerd and D1 layer, the share of `tsc -b` in the build, `promises:check` alone.
- How long a replayed task takes to download from either cache.
- Whether a `bun.lock` change in one workspace's section changes every hash by itself.
