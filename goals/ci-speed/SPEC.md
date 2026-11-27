---
type: Goal
title: "ci-speed"
description: A CI run that answers in about half the time it takes today, by splitting its two jobs, keeping turbo's results between runs and fixing what makes every task miss, with nothing checked less than it is now.
status: active
from: explorations/ideal-architecture
---

# `ci-speed`

Outside the nine steps of [the ideal-architecture exploration](../../explorations/ideal-architecture/README.md), and
not graduated from a brief: Benjamin asked on 2026-11-26 for an audit of `turbo.json`, the tests and the checks, and
whether beep-effect's turbo cache can be used here, written up as a goal. The measurements and every finding are in
[AUDIT.md](AUDIT.md). Its decisions were answered the same day (below).

## Objective

A pull request's run takes about 11 minutes today (median 673 s; 713 s on a push to main) and has reached 766 s of
the check job's 900 s limit. The same checks, tests and proofs answer in about 6 to 7 minutes when nothing replays
and sooner when something does, and a slow runner no longer brings the check job near its limit.

Three things carry it, in this order of return:

1. The work is split across jobs, so a run lasts as long as its longest task and not as long as their sum on two
   slots.
2. The longest tasks are made shorter where that loses nothing.
3. Turbo's results survive between runs and between the workstation and CI, on beep-effect's cache Worker, once
   the configuration is safe to replay from.

## Non-goals

- No check, law, test or proof removed, loosened or moved off the pull request, unless Benjamin decides it in a
  decision below.
- No change to what a ledger law compares with, and no caching of the laws that read git.
- No prebuilt CLI binary, no single process for the laws, no job that skips checks for documentation-only changes
  (AUDIT, "Looked at and set aside").
- No pull request's CI ever writes to the cache: main's CI and the workstation write, pull requests read, a fork
  gets nothing.
- No use of beep-effect's own team or its tokens.
- No deploy by an agent: of this repository's GitHub stack, or of beep-effect's cache Worker.

## Constraints

- A run is `max(check, proofs)`: a step is counted by what it takes off the run, not off its own job.
- The ruleset `main` requires "Check, test and build" and "Proofs and search of the model" by name
  (`packages/infra/src/GitHub.stack.ts`). A split keeps a job under each name that waits for its parts, unless
  Benjamin changes the stack and deploys it.
- Before the root's dependency on `@beep/repo-cli` goes, the proofs name the vendored kit in their own inputs:
  `packages/catalog/model/turbo.json` leans on that dependency today, and without it an edit to `@beep/schema`
  replays an old proof (AUDIT, finding 5). Each such change is proved by the hash experiment, both ways: an edit that
  must change a task's hash does, and one that must not does not.
- Before the workstation holds a write token: `build` leaves `.dev.vars` out of its outputs and a check fails when
  a build artifact holds one; `envMode` is strict; Node is pinned exactly; and the push to main forces the check
  job's tasks. The workstation writes, so each of these is a condition, not a nicety (AUDIT, finding 4).
- What CI may carry on four cores is measured, not assumed: `docs/standards/engineering.md`, "The check on CI",
  holds the last measurement, and a job given more workers is timed over several runs before it stays.
- `docs/verify.md` holds what the proofs must keep: the same tasks, inputs and lock; the nightly keeps `--force`.
- Every step is compared on real runs, several of each, since the same tasks vary by 1.6 to 1.8 times between
  runners.

## Acceptance

- [ ] CI uploads turbo's own per-task times (`.turbo/runs/*.json`), and PLAN holds a baseline of ten runs from them.
- [ ] The check's work runs in parallel jobs with the two required names still reported: a pull request's run shows
      the jobs side by side, and the ruleset still blocks a merge when any part is red (a red part on a test branch).
- [ ] The proofs' three long tasks start at once: a run with nothing replayed finishes the proofs in at most 7.5
      minutes, read from the run.
- [ ] `Draft.machine.test.ts` no longer sets the run's length: `catalog-web:test` under 200 s on CI over five runs.
- [ ] An edit to one CLI source file changes the hash of no proof task, and an edit to `@beep/schema` changes the
      hash of every one: both shown with `turbo run ... --dry=json` and written in PLAN.
- [ ] `turbo run build` with a `.dev.vars` present stores no `.dev.vars`: the artifact's file list in PLAN.
- [ ] `envMode` is strict and `bun run check:full` passes locally and on CI: a variable set in the shell and not
      listed (tried with `AI_ENABLED=false`) changes neither a task's hash nor what the task sees.
- [ ] This repository reads and writes its own team on the Worker and no other: a request with this team's token
      for team `beep` is refused (403), shown once with `curl`.
- [ ] A pull request that touches only documents replays every cacheable task of the check, and one whose commit
      passed `bun run check` locally replays those tasks and the proofs: "N cached" in its log.
- [ ] A push to main shows "0 cached" for the check job's tasks, and its results are what the next pull request
      replays.
- [ ] No `actions/cache` step for turbo's results is left in `ci.yml`.
- [ ] `test:slow` replays when the app's closure is unchanged, and the one live suite still runs every time.
- [ ] The 8 seeds' orderings are pinned and each fails against the code before its fix: the commits and the
      failing output in PLAN.
- [ ] Median run on pull requests at most 420 s over ten runs after the last step, against 673 s before, with the
      before and after in PLAN.
- [ ] `bun run check:full` passes at every commit, and `docs/standards/engineering.md` says what CI now carries.

## Decisions

Answered on 2026-11-26, in [DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "CI speed: the split,
the seeds, the cache and the run counts", "CI speed: who writes to the cache, where its settings live, main's runs
and the largest save" and "CI speed: what a shared cache asks, now that the workstation writes". In short:

1. The two required names stay, as jobs that wait for their parts.
2. The 8 recorded seeds of `Draft.machine.test.ts` are pinned as their counterexamples and run once.
3. Results are kept on beep-effect's cache Worker from the start, this repository as a team of its own; the proofs'
   results too. No `actions/cache` step for turbo remains.
4. The workstation writes to that team as well as main's CI; pull requests read.
5. A pull request replays anything; the push to main runs the check job's tasks with `--force`. The nightly forces
   the proofs, as now.
6. `envMode` is strict, with a pass-through list.
7. The team's settings are declared in `packages/infra/src/GitHub.stack.ts`; Benjamin deploys it.
8. Fewer property runs on a pull request, today's counts nightly, the variable hashed.
9. Main's runs are not cancelled. `WriteLimits.slow.test.ts` stays on every pull request at 50,000 rows.
