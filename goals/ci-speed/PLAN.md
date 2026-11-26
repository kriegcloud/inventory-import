---
type: Plan
title: "ci-speed, plan"
description: The steps of the ci-speed goal in order, what each waits on, what Benjamin does by hand for the cache Worker, and the baseline measured before any change.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance; [AUDIT](AUDIT.md) holds the measurements each step rests on.
Status is one of `todo`, `doing`, `done`. Nothing is built yet. The decisions were answered on 2026-11-26 and are in
the exploration's [DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md), three entries titled "CI speed".

| # | Step | Returns (estimate, of the run) | Waits on | Status |
| --- | --- | --- | --- | --- |
| 1 | Upload `.turbo/runs/*.json` from both jobs; record ten runs as the baseline | nothing; turns every estimate into a number | nothing | todo |
| 2 | Start the proofs' three long tasks at once: jobs for prove, verify, and fold with mutants:sample; "Proofs and search of the model" stays as the job that waits for them | 1 to 2 min on a full miss alone; about 4 min with step 3 | nothing | todo |
| 3 | Split the check: `catalog-web:test`; `app:test:slow` with the grid test; everything else; "Check, test and build" stays as the job that waits for them | 3 to 5 min | nothing | todo |
| 4 | Recover the 8 seeds' failing orderings against the code before each fix, pin them, remove the seed loop; time `catalog-web:test` alone with 2, 3 and 4 Vitest workers and split `Draft.machine.test.ts` by group if workers then share it | 2 to 4 min of the longest task | step 3 for the timing | todo |
| 5 | Name the vendored kit in the inputs of prove, verify, mutants and mutants:sample; then move `@beep/repo-cli` from the root's devDependencies to the six packages whose `check` runs it, and the CLI's source out of the generic `check.inputs`; the hash experiment both ways | the proofs replay on the 12 of 20 merges that touch only the CLI | nothing | todo |
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

## Choices made along the way

- 2026-11-26: main's forced run covers the check job's tasks and not the proofs. His answer named tests, slow tests
  and the build; type-check and lint are forced with them because they are seconds. Forcing the proofs on every
  push would put 8 to 11 minutes back on main, and the nightly already forces them.
