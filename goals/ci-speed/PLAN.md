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
| 1 | Upload `.turbo/runs/*.json` from both jobs; record ten runs as the baseline | nothing; turns every estimate into a number | nothing | built; the ten runs wait on a push |
| 2 | Start the proofs' three long tasks at once: jobs for prove, verify, and fold with mutants:sample; "Proofs and search of the model" stays as the job that waits for them | 1 to 2 min on a full miss alone; about 4 min with step 3 | nothing | built |
| 3 | Split the check: `catalog-web:test`; `app:test:slow` with the grid test; everything else; "Check, test and build" stays as the job that waits for them | 3 to 5 min | nothing | built |
| 4 | Recover the 8 seeds' failing orderings against the code before each fix, pin them, remove the seed loop; time `catalog-web:test` alone with 2, 3 and 4 Vitest workers and split `Draft.machine.test.ts` by group if workers then share it | 2 to 4 min of the longest task | step 3 for the timing | todo |
| 5 | Bring the vendored kit into the hash of prove, verify, mutants and mutants:sample; then take `@beep/repo-cli` out of the root's devDependencies, and bring the CLI's source to the tasks that run it through its own `transit`; the hash experiment both ways | the proofs replay on the 12 of 20 merges that touch only the CLI | nothing | done ("Step 5, the experiment" below) |
| 6 | `envMode` strict: each task's `env`, the pass-through list found by running `check:full` until it passes, locally and on a branch's CI | nothing; a condition of step 9 | nothing | todo |
| 7 | `.dev.vars` out of `build`'s outputs and a check that fails when a build artifact holds one; Node pinned exactly and among the global inputs | nothing; a condition of step 9 | nothing | todo |
| 8 | Move `Pwned.slow.test.ts` to a task of its own, never cached; give `test:slow` inputs so the rest can replay | 3 to 5 min where the app's closure is unchanged (22 of the last 40 commits) | step 6 | todo |
| 9 | The Worker: the team's settings declared in `GitHub.stack.ts`; `TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` and `TURBO_CACHE` in both jobs (read on a pull request, write on a push to main through the main-only environment, nothing for a fork); `--force` on the check job's tasks on a push to main; the `actions/cache` steps and the key step out of the proofs job; the workstation's lines in `.env.example` | a pull request whose commit passed `bun run check` locally replays those tasks and the proofs; otherwise 2 to 5 min where `bun.lock` is untouched | steps 5 to 8; "By hand" below | todo |
| 10 | One variable for property run counts in `vitest.shared.ts`, in each task's `env`; 500 for `WaitedRows.property` on a pull request, today's counts in the nightly | about 30 s | step 6 | todo |
| 11 | Drop `tsc -b` from the app's build if `check` covers it; the CLI's at-scale tests to its slow project; `docs/standards/engineering.md` and CLAUDE.md say what CI now carries; ten runs after, beside the baseline | under a minute together | the rest | todo |

Steps 1 to 7 wait on nothing of Benjamin's. Every estimate is capped by the other job: steps 2 and 3 reach their
figures together, not apart.

## Blocker

None until step 9, which needs the team to exist on the Worker and the stack deployed.

## By hand, Benjamin's

No agent deploys either stack. In order:

1. In beep-effect, `packages/tooling/infra/turbo-cache/src/Worker.ts`: a team `inventory` in `cachePolicy` with three
   principals, main's CI (write), pull requests (read) and the workstation (write). An agent may write that change
   as a pull request there; the merge and the deploy through `deploy-turbo-cache.yml` are his.
2. The three tokens, from beep-effect's token command with `--team inventory`, into 1Password. Never in a chat, a
   log or a file in either repository.
3. Here, after step 9's change to `GitHub.stack.ts` is merged: deploy the GitHub stack, which makes the variables,
   the secrets and the environment limited to main.
4. On the workstation: `TURBO_API`, `TURBO_TEAM` and `TURBO_TOKEN` as a 1Password reference in the untracked `.env`,
   as `.env.example` will show.

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
