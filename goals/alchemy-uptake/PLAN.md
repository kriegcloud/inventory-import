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
| 3 | D1 export: `beep infra export --dry-run` and the procedure in `docs/operations.md` | answered 2026-11-26: his workstation, by hand | todo |
| 4 | Stack tests: the harness in `scratchpad/` first (does it deploy this stack locally, where does its state go), then one test in `check:full` | his re-pin adding `@alchemy.run/test` | todo |
| 5 | `alchemy dev` trial: `bun run dev:alchemy` beside `bun run dev`, compared and written up here | nothing | done: it runs; my recommendation is that the no-go stands ("The `alchemy dev` trial", below). His to decide |
| 6 | Rate limiter: the binding in the stack and locally, the check in front of sign-in and the model | answered 2026-11-26: by address, 30 a minute, a failed binding lets the request on | todo |
| 7 | Access on previews: the policy in `planFor` for `pr-<number>` | answered 2026-11-26: the emails in the preview environment's secret `PREVIEW_ACCESS` | todo |
| 8 | Telemetry export: a destination per stage that names a collector | answered 2026-11-26: staging and prod read a collector from their environment; none is named yet | todo |

The order is smallest and least blocked first: 1 and 5 need nothing from him; 4 needs one command of his; 2, 3, 6,
7 and 8 each wait for one answer or one measurement.

## Current blocker

Step 4 waits for `bun run alchemy:repin` with `@alchemy.run/test` added to the kept packages. Step 2 waits for a
deployed stage to measure on. The four decisions were answered on 2026-11-26 (the exploration's DECISIONS.md,
"Alchemy uptake: the four open decisions"), so steps 3, 6, 7 and 8 can be built.

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

- **Step 5** (2026-11-26). The trial above. `InfraStage.test.ts` holds the local stack's guard: under `alchemy dev`
  a `dev_<user>` stage gets the personal plan; a deploy, plan or destroy of it, and every deployed stage's name, is
  stopped (`NotOnThisMachine`), because its state is in memory. The move of the stack's program into `inventory` is
  a move only (`git diff -w` shows the wrapper and nothing inside it).
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

## The `alchemy dev` trial

Run on 2026-11-26, on this machine, with no Cloudflare account, profile or token. `bun run dev:alchemy` is
`alchemy dev` on `packages/infra/src/InventoryDev.stack.ts`: the app's own stack program (`inventory` in
`Inventory.stack.ts`, the same database, minted secret and Worker a deploy declares) given the personal stage's
plan, with its state in memory.

**What started.** Stage `dev_<user>`; a plan of `3 to create`, each marked `(local)`; ready in 3.5 to 5 seconds at
`http://localhost:1337` (Alchemy's port, the next free one when taken; not 5173). The local providers applied the
eight migrations and both seed files, minted the sign-in secret and started Vite with Alchemy's own Cloudflare
plugin; ours stands down (`servedByAlchemy` in `vite.config.ts`). Three processes: the CLI's supervisor (on Bun when
it finds one), Vite on Node, and workerd. Ctrl+C ended all three within about eight seconds.

**Seen on screen** (headless browser). On `bun run dev:alchemy`: the page opened signed in as Dana Whitfield, Admin
of Example Works (test), with the Upload step and both sample buttons; `/api/v1/system/status` read `"database":
{"ok":true}` and "AI suggestions are off: no AI key is set". On the probe that came before it (the same three
resources written out by hand): pressed "Use items_messy.csv", Review read "Import 155, skip 45", the dialog
"Import 155 items?", then the Result step read Imported 155, Not imported 45, Already there 0, All 200, and the
Items page read "155 items". The full import was not repeated on the committed entry.

**Where its secrets were kept.**

| State | The minted secret | After a restart |
| --- | --- | --- |
| In memory (what `dev:alchemy` uses) | In no file: the run log, the runtime's registry file and its cache were searched for 64 hexadecimal characters, none found | A new, empty database and a new secret: the Items page read "0 items" after 155 were stored, and every session ended |
| A local file, encrypted with a passphrase (`passphraseEncryption`, a throwaway passphrase) | `SignInSecret.json` and the Worker's `props.env` were sealed, but `Website.json` held it as 64 plain characters at `bindings[].data.bindings[].text` | `[Database] noop`, the 25 items of `items_clean.csv` were still there and no new sign-in was asked |
| A local file, plain (`localState()`) | Not tried: the goal forbids it | |

So keeping what was imported across a restart needs a state file, and a state file holds the sign-in secret in
plain text at this commit even when encrypted. `bun run dev` keeps its secret in `.dev.vars` in plain text too
(git-ignored, readable by the owner only), so this is no worse than today; it is also no better, and the passphrase
would itself need a file or a prompt.

**What of `scripts/` it would delete.** Only `migrate-local.mjs` (74 lines: local migrations, the two seeds, the
secret written to `.dev.vars`), and only if `bun run dev` were replaced. `dev-accounts.mjs` still writes the seed
the stack imports; `dev-https.mjs`, `telemetry.mjs` and the rest are untouched. `wrangler.jsonc` stays while the
build and the tests read it.

**What it could not do.**

- Keep imported items, or a session, across a restart without the state file above.
- Read `.dev.vars` or `wrangler.jsonc`: Alchemy's plugin leaves both out on purpose (`cloudflare-runtime`'s
  `vite/PARITY.md`). A developer's own model key, `AI_ENABLED=false` and `OTEL_EXPORTER_OTLP_ENDPOINT` reach the
  Worker only if the stack declares them, so "Running with AI turned off" and `bun run telemetry` have no
  counterpart yet.
- Serve on 5173: every document, `dev:portless`, `dev:https` and the second-server convention name that port.
- Stay inside the repository: it wrote `~/.local/state/alchemy/registry/*.json` (the runtime's registry) beside
  `.alchemy/` here. `ALCHEMY_TELEMETRY_DISABLED=1` in the script keeps its telemetry off; the CLI still asks npm
  once a day whether a newer version exists.
- One thing seen once: on the first start, pressing "Use items_messy.csv" was followed by Vite reloading the page
  ("dependency optimized: effect/MutableList"), and the Upload step read "Stopped before it was saved. Continue
  reads it again from this browser"; Continue went on to Review. It did not happen on later starts. Both commands
  share `node_modules/.vite`, and switching between them re-optimizes it. Not checked whether a cold `bun run dev`
  loses a first file the same way: `effect/MutableList` is not in `readerModules`.

Not tried: HTTPS, hot reload of a screen or of the Worker, a second checkout at once, and anything with a model key.

**Recommendation** (the decision is Benjamin's): the infra brief's no-go stands. `bun run dev` keeps what was
imported across restarts and reads `.dev.vars`; `alchemy dev` does neither without a state file that holds the
secret in the clear. It is worth another look when Alchemy seals a Worker's binding records in local state.
`bun run dev:alchemy` stays as the way to try it; removing it is the script, `InventoryDev.stack.ts`,
`InfraStage.personal` and the one setting in `vite.config.ts`.

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
- **The trial's state is in memory** (step 5). The only store that puts the sign-in secret in no file. The other
  two were measured or forbidden (the table in "The `alchemy dev` trial").
- **The trial reuses the deployed stack's program** (step 5), so it tries the stack and not a copy of it; the
  entry that runs it refuses everything but `alchemy dev` for a `dev_<user>` stage.
- **`node node_modules/alchemy/bin/cli.js`, not `bunx alchemy`, in the script** (step 5): the repository runs its
  dev server on Node. The CLI still starts its own supervisor on Bun when one is on the path; Vite and workerd run
  as they do under `bun run dev`.
