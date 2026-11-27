---
type: Reference
title: "Commands"
description: "Which runner, where commands run, every root and app command and what it does, adding a dependency, a second dev server, and running with AI turned off."
---

# Commands

Moved here from `CLAUDE.md` word for word on 2026-11-26 (goals/focus-and-friction, step 4); `CLAUDE.md` keeps a line that links each section.

## Commands

**Which runner.** bun is the only package manager: run scripts with `bun run <script>`, install with `bun install`,
and one-off tools with `bunx`. Vitest, the dev server and Wrangler always run on Node, never under Bun's runtime: no `bunx --bun`, and never
`bun test`, Bun's own runner (`bun run test` runs Vitest on Node, where the sign-in, database and Worker tests pass).

**Where commands run.** The repository is a bun workspace driven by Turborepo. Root scripts (below, first group) run
from the repository root; `check`, `check:full`, `build`, `lint` and `test` go through `turbo`, which caches each
package's task and replays it when nothing it reads has changed. The app's own scripts (second group) run with
`bun run --cwd apps/inventory <script>`, or plain `bun run <script>` inside `apps/inventory`.

| Root command | What it does |
| --- | --- |
| `bun run dev` | Applies local migrations and the test accounts, then serves the app and API on http://localhost:5173, signed in by itself as the first test account |
| `bun run dev:alchemy` | A trial, beside `bun run dev` and never in place of it: the app's own stack on Alchemy's local providers (`alchemy dev`), on http://localhost:1337, signed in the same way. It reaches no account and keeps its state in memory, so every start has an empty database; it reads neither `.dev.vars` nor `wrangler.jsonc`. What it showed is in `goals/alchemy-uptake/PLAN.md` |
| `bun run check` | The loop check through turbo: type-check with Effect diagnostics, lint (with the two design lints), the fast tests, the proofs of the review's model (`prove`: half a minute when they run, replayed by turbo until the model's own files or the pinned library change), the format check, `docs:check`, the key scan (`keys:check`), the vendored-kit hash check (`vendor:check`), the Alchemy packages kept as files against their recorded hashes (`alchemy:check`; needs python3), which package may import which (`boundaries:check`), every mark on a record made by the vocabulary's typed helpers where a gate reads it, and only the ontology package loading the vocabulary (`ontology-terms:check`), the two stylesheet lists (`screens:check`), every `ref` a DOM ref or a callback that stays the same across draws (`refs:check`), no `_tag` compared or built by hand in any src or test folder (`tags:check`), no file holding more fallbacks (including zero-argument synchronous onNone expression arrows returning numbers, empty strings, empty arrays, empty objects, null or undefined in contract/model/host, and Result.getOrThrow or Effect.runSync member calls in src outside tests), absence checks (including Option/Result/Exit if or ternary guards in tests and unwrapped S.optionalKey in contract/model/host), Option unwraps or clean-ups outside a schema than its baseline allows, the baseline compared with main's so its numbers only fall, unless the law itself counts more than when main's was written, which the baseline's `reads` says (`defaults:check`), no type assertion and no `x!` (`assertions:check`), no Promise (`promises:check`), no `@effect-diagnostics` comment (`diagnostics:check`), every helper that names the value it acts on taking it first and `dual` (`dual:check`), every property `readonly` (`readonly:check`), every file of screens exporting components only (`fast-refresh:check`), each of those six with a ledger of today's files whose numbers only fall, compared with the ledger at the branch's base: where it left main, or on a push the last push whose run passed (`packages/tooling/tool/cli/ledgers/`), no deprecated API used, read from every file's types (`deprecated:check`; `docs/standards/deprecated-apis.md`), the root's own configuration files type-check (`configs:check`) and the Effect imports (`imports:check`; `imports:fix` repairs code), every version written in more than one place equal to its one source (`version-sync`) and the configuration that follows from the workspaces (`config-sync:check`), `bun.lock` holding what every package.json asks for (`lockfile:check`), no home path or private folder in the scratchpad (`private-paths:check`), and every patch to a dependency with its header and a test of its own, for what is installed, and needed: its test fails with that one patch left out (`patches:check`, `patches:prove`), with every task that runs code waiting until what is installed holds the patches (`patches:installed`; `docs/patches.md`). Before every commit |
| `bun run beep <group> <command>` | One of the repository's own rules by hand: `bun run beep laws boundaries`, `bun run beep quality ceilings`, `bun run beep vendor check`; `--help` on any of them lists its flags. `bun run check` runs them all under their root script names (`boundaries:check`, `vendor:check` and the rest) |
| `bun run check:full` | `check` plus Verify's search of the whole model (`verify`: two minutes when it runs), the property that holds the model against the review region (`fold`: a minute and a half), a sample of the model's mutants (`mutants:sample`: under a minute), the slow tests (`*.slow.test.ts`: workerd, D1, sign-in, and the stack test, which deploys the app's own stack on Alchemy's local providers and imports `items_clean.csv` over HTTP), the one test that calls a real service on the network (`*.live.test.ts`, the task `test:live`, never replayed), the reasoner on the vocabulary (`reason`, a task of `@inventory/ontology` that is never replayed: it needs Java 17 on the machine, and fetches the pinned ROBOT jar into the user's cache folder the first time) and the production build. The model's tasks are replayed by turbo until what they read changes |
| `bun run check:ci` | What CI's check runs on one runner: `check:full` without the slow tests, the model's proofs, search, fold and mutants, and without the reasoner (`reason`: it needs Java and a jar no install brings, so CI runs it in the job `reason` of `ci.yml`). CI's check is three jobs that start at once (`rest`, which is this script without the catalog's screens; `web`, that package's check, lint and tests; `slow`, the slow tests and the data grid), and the job named "Check, test and build" waits for them. CI runs the model's four in three jobs of their own (`model` in `ci.yml`: the proofs, the search, and the fold beside the sample of mutants, the tasks of `bun run proofs`, turbo's results replayed from the shared cache that `main` and the workstation write (`goals/ci-speed`, step 9); the job named "Proofs and search of the model" waits for them), and every night with nothing replayed and every mutant (`.github/workflows/proofs-nightly.yml`; `bun run proofs:nightly` runs the same four tasks by hand with nothing replayed, with two differences: turbo starts the four at once on one machine, so the first mutants share it with the proofs, Verify's search and the fold, where the nightly runs those three in one job and the mutants on runners of their own; and every mutant runs in one task, two at a time, with `row-open` given 50 minutes beside another mutant where the nightly runs it alone with 100: `docs/verify.md`) |
| `bun run build` | The production build through turbo |
| `bun run test` | Every test: fast, the proofs, the search, slow and live (Vitest, Node). Not the fold or the mutants: `bun run proofs` |
| `bun run format` | oxfmt, writes files: `bun run format -- <files>` for only yours, since a bare run rewrites every file. `format:check` only reports |
| `bun run deps:update` | Moves every dependency of every package to its newest version, except the ones `.syncpackrc.json` holds back (each is named with its reason and how to move it), runs `version-sync -- --write`, then `bun install` once, and says what moved from which version to which; a failed install puts every file back. `-- --dry-run` lists the moves and writes nothing. `deps:lint` and `deps:outdated` (syncpack) read the same packages and the same held list |
| `bun run version-sync` | Names every place where a version or a date differs from its one source (`.bun-version`, `engines.node`, the `effect` the packages state, the app's `wrangler.jsonc` and the rest) and fails. `-- --write` rewrites them, `-- --dry-run` lists what would be written. `docs/sync-commands.md` has every source and what is left alone |
| `bun run config-sync` | Writes what follows from the workspaces: syncpack's sources and its list of the catalog's names, tsconfig references, each package's scripts, the paths that depend on a package's depth, the root tasks the three checks (`check`, `check:full`, `check:ci`) run; installs when it wrote a package.json. `config-sync:check` only compares, `-- --dry-run` lists what would be written |
| `bun run scratch:new <name> --template <probe\|service\|screen\|verify>` | Starts an experiment in `scratchpad/experiments/<name>` from a template whose test already passes. `scratch:test [name]` runs the experiments' tests, or one experiment's folder only (Vitest, Node); `scratch:check` holds the scratchpad's own rules (no install inside an experiment, a note for each) and runs the type-checker with the Effect diagnostics; `scratch:list` shows what is open with its age; `scratch:serve experiments/<name>` serves a screen on the first free port from 5273; `scratch:graduate <name> --to <path> --learned "<line>"` or `scratch:drop <name> --learned "<line>"` ends one. `bun run check`, the build and CI never read the scratchpad (`docs/scratchpad.md`) |
| `bun run ontology:write` | Writes the three files under `packages/ontology/generated/` (the OWL and SKOS Turtle and the thread's graph) from the vocabulary module. They are committed: after a change to the vocabulary, run it and commit what it wrote, or `bun run check` fails and names the first line that differs. A second run changes nothing |
| `bun run docs:check` | Checks that `docs/`, `explorations/` and `goals/` are Open Knowledge Format bundles (the OKF skill's validator). Needs bash |
| `bun run db:reset` | Deletes the local database and re-applies migrations. **Restart `bun run dev` afterwards.** |
| `bun run preview` | Builds and serves the production build on http://localhost:4173, with security headers, compressed (brotli, else gzip) as Cloudflare serves it; `PREVIEW_COMPRESSION=off` for the raw bytes |
| `bun run telemetry` | Optional, Benjamin's to start (needs Docker): Grafana's LGTM stack, then `OTEL_EXPORTER_OTLP_ENDPOINT` in `apps/inventory/.dev.vars` sends the Worker's and the browser's traces, metrics and logs to it. Never part of `bun run dev`; `telemetry:down` stops it |
| `bun run release <major\|minor\|patch>` | Benjamin asks for it. Cuts a release: `major` or `minor` makes `release/<major>.<minor>` from `main`, `patch` tags the next patch on the release branch it is run on; it sets the app's version, writes the notes, runs `check:full`, commits and makes an annotated tag. It pushes nothing and prints the one push that sends branch and tag together (`docs/releasing.md`). `bun run beep release verify <tag>` says whether a tag may deploy |
| `bun run beep infra setup --test-stage` | Benjamin's to run at his own terminal, never an agent's: what a first deploy needs (the Cloudflare account, an Alchemy profile, the state store), then a plan he reads and a deploy on his yes. `--staging` sets up what GitHub must hold, `--production` deploys production. An agent may run it only with `--dry-run`, which prints the steps and starts nothing (`goals/infra/PLAN.md`) |
| `bun run beep infra export --stage <name>` | Benjamin's to run at his own terminal, never an agent's: a dump of one stage's rows into `~/inventory-dumps`, readable by him alone, which he deletes when it has served. An agent may run it only with `--dry-run` (`docs/operations.md`, "A dump of a stage's database") |
| `bun run alchemy:repin -- <commit>` | Moves the Alchemy packages kept as files in `vendor/alchemy` to another commit of the library's `main`: the files, the root `overrides`, the lockfile's hashes, the repository's patches to them carried to the new files (it stops on one that no longer applies, or is no longer needed), an install that is refused the library's registry, then `check:full` with nothing replayed from the cache (`vendor/alchemy/README.md`). Benjamin asks for it; it commits nothing. `bun run alchemy:check` checks the pin as it stands. Needs python3 |

| App command (`apps/inventory`) | What it does |
| --- | --- |
| `check` | Type-check with tsrs plus the Effect diagnostics (`typecheck` is the same) |
| `lint`, `lint:shadcn` | oxlint and the design-system lint; `lint:shadcn` alone. Fixes: `docs/kit.md` "The two design lints" |
| `test`, `test:slow`, `test:live`, `test:all` | The fast tests, the slow ones, the one that calls a real service, all three |
| `check:strict` | The stage C ceiling and the plugin-parity check (part of `check`); `-- --all` lists every ledgered finding |
| `dev:https` | Optional. The dev server over HTTPS with a local certificate (mkcert), so an `https:` origin, Secure cookies and HSTS behave as deployed |
| `build:report` | The browser's build, then each chunk's makeup by package, largest first (`-- index` for one chunk); the treemap is `.scratch/bundle/client.html` |
| `lighthouse` | Lighthouse on the production build, mobile and desktop. `-- /path` for another page. Prints the scores and every audit that scored below 100 |
| `auth:schema` | After a change to Better Auth's options, prints the migration it still needs |
| `grid:keys` | Types on every data grid editor in Chromium and reads what is stored (needs `CHROME_PATH`); by hand, after a change to the grid |

Hosting is Benjamin's alone. `bunx alchemy deploy --stage <name>` from the root runs the stack in `packages/infra`, and
`bun run beep infra setup` does what comes before a first deploy and then deploys on his yes. No agent runs either
for real, whatever it was asked to get done; an agent may run `bun run beep infra setup --dry-run`, which prints the
steps and starts no tool. None runs `bun run release` unless he asks for a release in that message
(`goals/infra/PLAN.md`, "What Benjamin does by hand"; `docs/releasing.md`).

If you add or remove a dependency, do it with `bun add` or `bun remove` in the workspace that uses it
(`bun add --cwd apps/inventory <name>`); `bun.lock` at the root is the only lockfile of the workspaces, and `bunfig.toml` keeps one
hoisted `node_modules`. A dependency more than one package uses has its version once, in the `catalog` of the root's
package.json, and each package.json says `"catalog:"` (`docs/sync-commands.md`, "One place for a shared version");
`bun run deps:lint` refuses one written as a version. The one other lockfile is the scratchpad's (`scratchpad/bun.lock`, committed), for the
libraries an experiment added: the scratchpad is no workspace, and a library the root already has never goes there.

**A second dev server.** Benjamin usually runs the dev server in his own terminal on port 5173; ask before starting
another. Start one with `bun run dev -- --port 5174 --strictPort & echo $! > .dev.pid`, stop it with
`kill "$(cat .dev.pid)"`, and wait the 8 to 10 seconds it takes to answer:
`until curl -s -o /dev/null localhost:5174/api/v1/system/status; do sleep 1; done` (any answer counts, a 401 too).
Never `pkill -f` or `pgrep -f` a string that is also in the command you are typing (`pkill -f vite`): it matches your
shell. After a change to `migrations/0001_init.sql`, a copy that has run the dev server needs `bun run db:reset` once.

**Running with AI turned off**, without opening `apps/inventory/.dev.vars`: back it up, append the override (a later line
wins), run, and put the backup back. From `apps/inventory`:
`cp .dev.vars .dev.vars.backup && printf '\nAI_ENABLED=false\n' >> .dev.vars`, then
`bun run dev -- --port 5174 --strictPort`, and afterwards `mv -f .dev.vars.backup .dev.vars`. `/api/v1/system/status`
then reports `"available": false` and "AI_ENABLED is set to false". The shell does not reach the Worker while
`.dev.vars` exists: wrangler reads `CLOUDFLARE_INCLUDE_PROCESS_ENV` only when it falls back to `.env` files
(`getVarsForDev` in wrangler 4.161), so `CLOUDFLARE_INCLUDE_PROCESS_ENV=true AI_ENABLED=false` changes nothing here.
