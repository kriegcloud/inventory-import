---
type: Plan
title: "Alchemy uptake, plan"
description: The steps of the Alchemy uptake goal, their status, the current blocker, what each step must prove first, and what Benjamin does by hand.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`, `closed` (tried, did
not hold up, with the reason). Nothing is built yet: this packet was written on 2026-11-26.

Each step begins with its proof, because the report read every item from source and ran none. A proof that fails
closes the step with what was seen; it does not get worked around.

| # | Step | Needs first | Status |
| --- | --- | --- | --- |
| 1 | CLI inspection: `docs/operations.md` with plan, drift, logs and state for a stage; `alchemy plan` before each deploy in `deploy.yml` | nothing | todo |
| 2 | Limits and placement: measure a sign-in and a confirm of a large file, then declare them | a deployed stage to measure on: his | todo |
| 3 | D1 export: `beep infra export --dry-run` and the procedure in `docs/operations.md` | "Dumps" answered | todo |
| 4 | Stack tests: the harness in `scratchpad/` first (does it deploy this stack locally, where does its state go), then one test in `check:full` | his re-pin adding `@alchemy.run/test` | todo |
| 5 | `alchemy dev` trial: `bun run dev:alchemy` beside `bun run dev`, compared and written up here | nothing | todo |
| 6 | Rate limiter: the binding in the stack and locally, the check in front of sign-in and the model | "The limiter's rule" answered | todo |
| 7 | Access on previews: the policy in `planFor` for `pr-<number>`, the smoke check's way through | "Who may open a preview" answered | todo |
| 8 | Telemetry export: a destination per stage that names a collector | "Where telemetry goes" answered | todo |

The order is smallest and least blocked first: 1 and 5 need nothing from him; 4 needs one command of his; 2, 3, 6,
7 and 8 each wait for one answer or one measurement.

## Current blocker

None for steps 1 and 5. Step 4 waits for `bun run alchemy:repin` with `@alchemy.run/test` added to the kept
packages. The four open decisions in [SPEC](SPEC.md) each block one step.

## What each proof must show

- **Step 1.** `alchemy plan --stage pr-1` cannot be run by an agent against a real account, so the workflow change
  is proved by a test that reads `deploy.yml` (none exists yet: the step writes it) and a dry run. Whether `drift` reads
  every resource of this stack is unknown: the report says it skips a provider that has no read.
- **Step 2.** The local write-limit test proves SQL bounds, not Cloudflare's CPU. The number comes from a deployed
  stage or the step stays `todo`. Placement can slow the routes that do not touch D1: measure both.
- **Step 3.** `D1/ExportDatabase.ts` is not in Alchemy's documents and polls with no bound. The command wraps it
  with a limit of its own. It is a dump, never called a backup.
- **Step 4.** The harness defaults to `localState()`. The proof is a run in `scratchpad/` that deploys this stack
  locally with the state store given, then a search of every file it wrote for the sign-in secret. If the local
  providers cannot serve `Website.Vite` with its bindings, the step closes.
- **Step 5.** The trial must open signed in as Dana Whitfield with no key and no `.dev.vars` made by hand, and say
  where its minted secret is kept. The Vite config's Cloudflare plugin must be guarded against the one Alchemy adds.
  `scripts/dev-https.mjs` stays either way.
- **Step 6.** The binding's counters are approximate and per Cloudflare location. A test shows one refusal and one
  pass through the Worker's own `fetch`; what the local emulator does with the binding is unknown until tried.
- **Step 7.** Whether `Website.Vite` passes `access` through is read from source (`Workers/Worker.ts`), not run.
  The policy and the service token are made in a real account: his.
- **Step 8.** `ObservabilityDestination` needs a collector that answers a preflight POST over HTTPS. Joining
  Effect's spans to Cloudflare's (`Cloudflare.Telemetry()`) needs the Worker as an Effect and is out of this goal.

## What Benjamin does by hand

Filled in as each step is built. Known now: the re-pin for step 4; a deployed stage to measure for step 2; the
Access application and its service token for step 7; a collector's address for step 8; running an export for
step 3.

## Choices made

None yet.
