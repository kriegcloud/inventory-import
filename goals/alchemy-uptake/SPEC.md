---
type: Goal
title: "Alchemy uptake"
description: "Eight things Alchemy already offers that the repository does by hand or not at all: stack-level tests on the local emulator, a plan before every deploy and the CLI's inspection commands, a trial of alchemy dev beside bun run dev, the Worker's limits and placement, a coarse rate limiter, an Access gate on previews, platform telemetry export, and a D1 export procedure."
status: active
from: explorations/ideal-architecture
---

# Alchemy uptake

From the sweep in
[research 05](../../explorations/ideal-architecture/research/05-alchemy-unused.md): Alchemy at commit `e1c3e6d`,
the commit `vendor/alchemy` holds, read against what this repository does by hand. Benjamin asked for a goal that
makes use of all of it (2026-11-26) and answered the four questions that decided its edges.

## Objective

Each of the eight items in the report's "Top eight" is either in use, with a check that holds it, or closed with the
reason it did not hold up when tried. Every one was read from source and none was run, so each step starts by
proving the capability here before anything depends on it.

1. **Stack tests**: the whole stack (the built screens, the Worker, its bindings, the migrations and seeds) deployed
   to Alchemy's local providers by `@alchemy.run/test` and called over HTTP, in `bun run check:full`.
2. **A plan before a deploy, and the CLI's inspection**: `deploy.yml` runs `alchemy plan` and shows it before every
   `deploy --yes`; `docs/` says how to read drift, logs and state for a stage.
3. **`alchemy dev`, as a trial**: a second command beside `bun run dev`, compared with it and written up.
4. **The Worker's limits and placement**: declared in `Inventory.stack.ts`, from a measurement.
5. **A coarse rate limiter**: Cloudflare's rate-limit binding in front of sign-in and the model's endpoints.
6. **An Access gate on previews**: `pr-<number>` stages open only to the people named.
7. **Platform telemetry export**: Cloudflare's own traces and logs sent where the app's telemetry goes.
8. **A D1 export procedure**: a command and a document for taking a dump of a stage's database and restoring it.

## Non-goals

- **The Worker as an Alchemy Effect.** `Cloudflare.Website.Vite` stays (infra I1). The host change belongs to move 2
  of [alchemy-domain](../../explorations/alchemy-domain/README.md), where `@alchemy.run/better-auth` waits too.
- **Replacing `bun run dev`.** The infra brief's no-go stands; item 3 is a trial he decides from.
- **A gate on anything but previews.** Production, staging and `test_<user>` stages are as they are; Better Auth
  still signs people in behind the gate.
- **Replacing what is exact with what is approximate.** Better Auth's rate limits in D1 and the model's daily
  allowance stay; the binding is in front of them, never in place of them.
- Everything under "Considered, not worth it now" in the report: queues, workflows, AI Gateway, Analytics Engine,
  Logpush, KV, R2, Turnstile, Secrets Store, D1 replicas, gradual deploys, crons, email.
- No change to what a person importing a file sees, or to any import rule or count.

## Constraints

- **Nothing outside this machine by an agent.** No deploy, plan against a real account, login, token or Access
  setting. The stack tests run on the local emulator only (his answer); what needs a real account is written into
  "What Benjamin does by hand" in [PLAN](PLAN.md).
- **No plaintext local state.** `Alchemy.localState()` writes secrets unencrypted (research 02, section 9). The
  test harness defaults to it, so its state store is given explicitly, and step 1 stops if a secret reaches a file.
- **A re-pin is his.** `@alchemy.run/test` is not among the packages kept in `vendor/alchemy`; adding it is
  `bun run alchemy:repin`, which he asks for.
- The app keeps working at every commit: `items_messy.csv` imports to 155 stored, and development opens signed in
  as the first test account with no key and no secret made by hand.
- The repository's laws as they stand: Effect 4, the schema standard, no Promise, the boundary table, every
  `@alchemy.run/*` package at one exact version.

## Acceptance

- [ ] `bun run check:full` runs a stack test that deploys the stack locally, signs in as a test account over HTTP
      with its cookie, imports `items_clean.csv` and reads 25 items back; the run leaves no secret in a file
      (a test reads the state folder).
- [ ] `deploy.yml` shows `alchemy plan` for the stage before each `alchemy deploy --yes`, and a plan that destroys
      the database stops the job; a workflow test or a dry run shows both.
- [ ] `docs/operations.md` exists and says, for a stage: how to read its plan, its drift, its logs and its state,
      each with the exact command; listed in `docs/index.md`; `bun run docs:check` passes.
- [ ] The `alchemy dev` trial is written up in PLAN: what started, whether it opened signed in as Dana Whitfield
      with no key, where its secrets were kept, what of `scripts/` it would delete, and what it could not do.
- [ ] `Inventory.stack.ts` declares the Worker's CPU limit and placement, with the measurement that chose them in
      PLAN; `StagePlan` holds them if they differ by stage, with a test.
- [ ] The rate-limit binding is declared, checked before `/api/auth/sign-in/*`, `/api/auth/sign-up/*` and the
      model's endpoints, refuses with the app's own 429 sentence, and a test shows a refusal and a pass. Built only
      after "the limiter's rule" below is answered.
- [ ] A `pr-<number>` stage's plan carries an Access policy and no other stage's does (`planFor`'s test); the
      deploy workflow's smoke check passes through it. Built only after "who may open a preview" is answered.
- [ ] The stack declares where Cloudflare's telemetry is sent for a stage that names a collector, and none
      otherwise; `planFor`'s test holds it. Built only after "where telemetry goes" is answered.
- [ ] `bun run beep infra export --stage <name> --dry-run` prints the steps of a dump; `docs/operations.md` says
      how to take one and how to restore it into a new stage. The command itself is his to run.
- [ ] PLAN lists what was proved on this machine, what waits for a real account, and what Benjamin does by hand.

## Decisions

In [the exploration's DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "Alchemy uptake: the
goal's edges" (2026-11-26), and "infra I1", "infra I4", "infra I8", "infra I9".

Open, and his; each blocks only its own step:

- **The limiter's rule**: what it counts by (the visitor's address, the account, both), how many in which period
  (the binding offers 10 or 60 seconds only), and what happens when the binding itself fails.
- **Who may open a preview**: the emails or the domain the Access policy names.
- **Where telemetry goes**: the collector's address for a deployed stage, and which stages send.
- **Dumps**: where a database dump is kept, for how long, and who may take one.
