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
| 1 | CLI inspection: `docs/operations.md` with plan, drift, logs and state for a stage; the plan and its guard before each deploy in `deploy.yml` | nothing | done |
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

None for step 5. Step 4 waits for `bun run alchemy:repin` with `@alchemy.run/test` added to the kept
packages. The four open decisions in [SPEC](SPEC.md) each block one step.

## What each proof must show

- **Step 1.** `alchemy plan --stage pr-1` cannot be run by an agent against a real account, so the workflow change
  is proved by the test that already reads `deploy.yml` step by step (`packages/tooling/tool/cli/test/DeployWorkflow.test.ts`: the packet first said none existed, having looked only in `packages/infra`) and a run of the guard on printed plans. Whether `drift` reads
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

## What was proved on this machine

- **Step 1** (2026-11-26). `DeployWorkflow.test.ts` holds the two new steps in each of the three deploy jobs word
  for word, in order, with staging's waiting for "only main's head", and runs the plan step's script against a
  stand-in for the tool: what it printed is in the log and in the file, and the step ends as the tool did (0 and 1).
  `PlanCheck.test.ts` holds the guard on plans printed by Alchemy's own `formatPlanLines` at the pinned commit
  (run once in Node, plain and coloured, and copied): a database made, changed in place or left alone passes;
  `replace`, `delete` and `orphaned` are refused; another resource's deletion is not the database's; an empty text,
  a failed command's text and a plan that names no resource are refused. Typed at a terminal:
  `bun run beep infra plan-check` on a file reading `[Database] replace` printed "REFUSED the plan would replace
  the database" and ended with 1; on `[Database] noop` it printed "OK" and ended with 0.
  **Not seen:** a plan of a real stage, in a workflow or anywhere. Whether the dry run builds the screens a second
  time in a job (and so nears its 20 minutes) is unknown until the first pull request after this lands.

## What waits for a real account

- **Step 1.** The first pull request's "Deploy" run after this lands: its "Show the plan" step should print a `Plan:`
  line and one line for each of `Database`, `SignInSecret` and `Website`, and "Stop a plan that loses the database"
  should print OK. If the guard says the text is not a plan, the tool prints something else in a workflow than its
  formatter does here, and the guard's pattern is what changes.

## Choices made

- **`deploy --dry-run --yes`, not `plan`, in the workflow** (step 1). `alchemy plan` has no `--yes`, and without it
  a job stops when the state store is missing or a version behind (`State/Provisioning.ts`: "Run 'alchemy state
  bootstrap' first, or pass --yes"). Every deploy job passes `--yes` today and brings the store up to date without
  asking (`goals/infra/PLAN.md`, "What Benjamin does by hand", 3); `plan` in front would have stopped the first
  deploy after a re-pin. The two commands are one code path (`planCommand`: "the same as deploy with dryRun always
  set to true"). Reverse by writing `bunx alchemy plan --stage <name>` in the three steps and bootstrapping by hand
  after a re-pin.
- **The guard reads the printed plan, in the repository's CLI** (step 1). The plan has no machine-readable form on
  standard output (`--log-format json` prints log records, and the plan's lines are not among them), so the guard
  reads the plain lines and refuses what it cannot read. It names the database as the stack does, and its test reads
  the stack.
- **`orphaned` is a loss too** (step 1). A database dropped from the state is still in the account, but the next
  deploy makes a new empty one and binds the Worker to it.
- **Never `--detailed` in a workflow** (step 1): its log is public, and the plain plan names resources only.
