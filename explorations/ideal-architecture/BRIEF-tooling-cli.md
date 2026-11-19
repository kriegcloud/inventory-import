---
type: Brief
title: "Brief: tooling-cli"
description: The goal tooling-cli. A repository CLI package at packages/tooling/tool/cli, as beep-effect has, and the ten scripts under scripts/ ported to typed Effect commands on it with their behaviour and failure sentences unchanged.
---

# Brief: `tooling-cli`

Benjamin's words: "Also we should create a packages/tooling/tool/cli just like beep-effect. Then we can port [the
scripts] to actual typescript with effect/cli", naming `scripts/check-boundaries.mjs`, `check-ceilings.mjs`,
`check-exports.mjs`, `check-screens.mjs`, `check-strict.mjs`, `docs-check.sh`, `keys-check.sh`, `vendor-beep.mjs` and
`vendor-check.mjs`. A tenth, `scripts/check-effect-imports.mjs`, arrived after he wrote that; whether it is ported
is question T6.

Nothing here is built. No package was created, no dependency added and no script changed. No goal is open. Every
number below was measured on this repository at the commit this brief is written on; every beep-effect fact was read
in its checkout, read only.

## Problem

The repository's own rules are held by ten scripts, 1,536 lines, that none of the repository's rules apply to:

- They are plain JavaScript (`.mjs`) and shell. Nothing type-checks them, the Effect diagnostics do not read them,
  and `oxlint` does not lint them. A `JSON.parse` of a `package.json` that changed shape fails at run time, in a
  check, with a stack trace instead of a sentence.
- Each reads the tree its own way: five have their own copy of a directory walk, seven work out the repository
  root for themselves, and the four that take arguments each read `process.argv` by hand.
- None has a test. Each was proved once by hand, on a planted violation, in the session that wrote it.
- beep-effect, whose architecture this repository follows, has no such folder: its rules are commands of one CLI
  package, and its `scripts/` holds one bootstrap file.

## Appetite

Scope, not time. In:

- One package at `packages/tooling/tool/cli`, with a `bin`, run from the root as one command.
- The ten scripts as commands, one at a time, each proved equal to the script it replaces before that script is
  deleted.
- The root `package.json` scripts, the six package `check` scripts that call a script, `turbo.json`'s inputs, and
  the documents that name a script, moved to the commands.
- A `tooling` row in the boundaries check, and the workspace glob for the new folder.

Out:

- Any new check, and any change to what a check accepts or says.
- The app's own scripts under `apps/inventory/scripts/` (migrations, deploy set-up, telemetry): they belong to the
  app and are not in the list.
- The fifty other command groups beep-effect's CLI has. See "What beep-effect does that does not fit here".

## How beep-effect does it

Read in its checkout; paths are relative to its root.

| Subject | What it has |
| --- | --- |
| Folder | `packages/tooling/tool/cli`, exactly as Benjamin wrote. Its sibling is `packages/tooling/tool/docgen`; `packages/tooling/` also holds `library/`, `policy-pack/`, `test-kit/` and `infra/` |
| Package | `@beep/repo-cli`, private, `"beep": { "family": "tooling", "kind": "tool" }` |
| Bin | `"bin": { "beep-cli": "./src/bin.ts" }`, a TypeScript file with `#!/usr/bin/env bun`. Package scripts call `beep-cli <group> <command>` |
| Root command | `"beep": "bun run packages/tooling/tool/cli/src/bin.ts --"` in the root `package.json`, so `bun run beep laws effect-imports --check`. Named root scripts wrap it: `"lint:effect-imports": "bun run beep laws effect-imports --check"` |
| Entry files | `src/bin.ts` is a small file that handles two hot paths itself with dynamic imports and otherwise imports `src/bin-main.ts`, which builds the layers (`BunServices.layer`, an HTTP client, crypto, its Git service) and runs the root command. Its own comment gives the reason: about 0.1 s for the probe alone against about 1 s for the full CLI. `src/bin-ci.ts` is a third, slim entry compiled to a binary for CI jobs that run before `bun install` |
| Commands | `src/commands/Root.ts` imports one command per group; a group is a folder `src/commands/<Group>/` with `index.ts`, `<Group>.command.ts` (flags and wiring only), one file per rule (`EffectImports.ts`), `<Rule>.model.ts` for its schemas, `<Group>.errors.ts`, and `internal/` |
| Effect CLI | `import * as Command from "effect/cli/Command"`, `import * as Flag from "effect/cli/Flag"`. `Command.make(name, flags, Effect.fn(function* (flags) { ... }))`, `Command.withDescription`, `Command.withSubcommands`; flags are `Flag.String("include").pipe(Flag.withDescription(...), Flag.withDefault("*"))`; a rule's options are a schema class the flags are decoded into |
| Runtime | bun, with `@effect/platform-bun` (`BunRuntime.runMain`, `BunServices.layer`) |
| Tests | `test/<name>.test.ts`, about one per rule. A rule is a function over the `FileSystem` and `Path` services, so its test writes a small tree (its `@beep/memfs` in-memory file system), runs the rule, and reads the summary and the lines captured by `effect/testing/TestConsole`. Test-only exports are `src/test/*.test-kit.ts`, exported as `./test/*` |
| Turbo | Repository-wide rules are root tasks (`//#lint:effect-imports`) with their source globs as `inputs`, each depending on a fingerprint task of the CLI so a change to the rule's code misses the cache |
| CI | Workflows call `bun run beep <group> <command>` after install, and the compiled binary before it |
| Its own port | It retired its `scripts/` folder the same way (`goals/scripts-to-beep-cli`): each script became a command "with identical behaviour", and a law now rejects a new tracked shell file |

## What is installed here

Checked in this repository's `node_modules`, effect 4.1.4.

- **The CLI module is a folder, `effect/cli`, and by the import standard it is never imported as one.** Its modules
  are `effect/cli/Command`, `Flag`, `Argument`, `Prompt`, `CliConfig`, `CliError`, `CliOutput`, `GlobalFlag`,
  `HelpDoc`, `Completions`, `Param`, `Primitive`, `CommandSpec`, `TerminalCapabilities`. So "effect/cli" in Benjamin's
  sentence is `import * as Command from "effect/cli/Command"` and `import * as Flag from "effect/cli/Flag"`. Every
  one is marked `@stability unstable`.
- **Two names differ from what a model writes from memory**, found by running a probe:
  - flag constructors are capitalised: `Flag.Boolean`, `Flag.String`, `Flag.Choice`, `Flag.Directory`, `Flag.File`.
    `Flag.boolean` does not exist;
  - a `Flag.Boolean` with no default is a required flag: the probe answered "Missing required flag: --all". Every
    switch is `Flag.Boolean("all").pipe(Flag.withDefault(false))`.
- **The probe**: a root command with one subcommand that reads `package.json` through `FileSystem`, run by
  `Command.run(root, { version }).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain)`. It printed its
  line and exited 0; a failing handler exited 1; an unknown subcommand printed the usage and exited 1. `--help`,
  `--version`, `--completions` and `--log-level` come with it.
- **Platform packages.** `@effect/platform-node` 4.1.4 is installed (a dependency of `@beep/d1` only) and has
  `NodeRuntime`, `NodeServices`, `NodeChildProcessSpawner` and `NodeCrypto`. `@effect/platform-bun` is not installed;
  4.1.4 is published. The services the commands need all exist: `effect/FileSystem`, `effect/Path`,
  `effect/process/ChildProcess`, `effect/crypto/Digest`, `effect/testing/TestConsole`.
- **CI** (`.github/workflows/ci.yml`) runs `bun install --frozen-lockfile` and then `bun run check:full`. Nothing
  runs before the install, so a compiled binary has no use here.

## The scripts, and the command each becomes

Command names follow the recommendation of T3. "Run from" is the working directory the script expects. Every script
prints one line `<name> OK ...` on success and `<name> FAIL ...` with one line per problem on failure.

| Script | What it holds | Inputs | Exit | Called by | Becomes |
| --- | --- | --- | --- | --- | --- |
| `check-boundaries.mjs` (119 lines) | Which package may import which: every workspace's `beep.family`, `context` and `layer`, and every import specifier under its `src` and `test`. Fails on an undeclared workspace import, a row the table does not allow, a path into `apps/` | none; reads from the repository root | 1 on a problem | root `boundaries:check`, turbo `//#boundaries:check` | `laws boundaries` |
| `check-ceilings.mjs` (29) | The `ceiling` of every `strict-ceiling.json` adds up to at most 678 | none | 1 | root `ceilings:check`, turbo `//#ceilings:check` | `quality ceilings` |
| `check-exports.mjs` (37) | A design-system package's exports are exact: no wildcard, every entry names a file, every file under `src/components` and `src/hooks` has one entry | none; run from the package | 1 | `@inventory/ui`'s `check` | `laws exports` |
| `check-screens.mjs` (87) | Every package with a `.tsx` under `src` that the app declares is in both lists Tailwind reads: the `@source` lines of the app's `index.css` and `screenPackages` in its `vite.config.ts` | none | 1 | root `screens:check`, turbo `//#screens:check` | `laws screens` |
| `check-strict.mjs` (145) | A package's Effect plugin options equal the root's outside `overrides`; and the four style rules turned off for its own code, counted by running the type-checker with that override removed, equal its recorded `ceiling` exactly | a ceiling file; `--all` for every finding; run from the package | 1 | the `check` of the app, `@inventory/ui`, `@inventory/review`, `@inventory/client`, `@inventory/access-web`, `@inventory/catalog-web`; the app's `check:strict` | `quality strict` |
| `docs-check.sh` (46) | `docs/`, `explorations/` and `goals/` are each an OKF v0.2 bundle, by the validator the OKF skill ships; fails if a tool the validator needs is missing, or if the validator scanned nothing and still said "conformant" | `--verbose` | 1 | root `docs:check`, turbo `//#docs:check` | `docs check` |
| `keys-check.sh` (14) | No key-shaped string (two vendors' key prefixes, a PEM private key) in any file git would commit; names the file and line, never the string | none | 1 | root `keys:check`, turbo `//#keys:check` | `laws keys` |
| `vendor-check.mjs` (117) | Every file a `vendor.json` lists exists, starts with its provenance line and hashes to the recorded SHA-256; nothing unlisted sits beside them; the package's exports are the recorded ones | `--source <beep-effect checkout>` also proves each recorded source hash against that commit | 1 | root `vendor:check`, turbo `//#vendor:check` | `vendor check` |
| `vendor-beep.mjs` (408) | Copies the used subset of four kit packages from one beep-effect commit: the import closure of its entry list, byte for byte under a provenance line, with the recorded test rewrites and source patches, and writes each `vendor.json` | `--from <checkout>` (required), `--commit <sha>` | 2 on a missing argument | nobody; run by hand to refresh | `vendor sync` |
| `check-effect-imports.mjs` (534) | Every Effect import from its own path under its one name (`docs/standards/effect-imports.md`); `--write` repairs code | `--write`; file paths | 1 | root `imports:check` and `imports:fix`, turbo `//#imports:check` | `laws effect-imports --check`, `--write` (T6) |

The root script names (`boundaries:check`, `vendor:check`, `docs:check` and the rest) stay, each now calling the
command, so `bun run check`, `turbo.json`'s task names, CI and every document that says `bun run keys:check` are
untouched. Only the right-hand side of each script line changes.

### What stays a shell call inside a command

- **The OKF validator** (`.agents/skills/okf-open-knowledge-format/scripts/validate.sh`). It is the OKF skill's own
  file, vendored unchanged, 270 lines of bash over `find`, `sort -z`, `awk` and `sed`. Porting it means
  writing a second validator for someone else's format and answering for every difference from the published one.
  `docs check` spawns it through `effect/process/ChildProcess` and keeps, in TypeScript, the three things
  `docs-check.sh` adds: the tools-present guard, the three bundles, and the refusal to pass when nothing was scanned.
  The wrapper is ported; the validator is not.
- **`git grep`** in `laws keys`, and **`git ls-files`** in `laws effect-imports` and `vendor sync`. "Every file git
  would commit" is git's answer to give: tracked files plus new files `.gitignore` does not exclude. Re-deriving
  that from `.gitignore` files by hand would be a third thing to get wrong.
- **The type-checker** in `quality strict` (`tsrs`), which is the measurement itself.

Each is spawned through the `ChildProcessSpawner` service, so a test can put a scripted one in its place.

### How each port is proved

One script at a time, in this order: the two smallest first (`quality ceilings`, `laws exports`) to settle the
package's shape, then the rest, `vendor sync` and `laws effect-imports` last. For each:

1. **Same tree.** Old and new run on the unchanged repository; their standard output, standard error and exit code
   are compared byte for byte. A difference is a defect in the port, not a new sentence.
2. **Planted violation.** For every kind of failure the script can print, one is planted (the list is written from
   the script's own `problems.push` lines before the port starts), and old and new are compared again. The plants
   become the command's tests.
3. **`vendor sync`** has no failure sentences to compare: it is proved by running old and new against the recorded
   beep-effect commit and reading `git status`. Both must leave the tree unchanged.
4. Only then the script is deleted, in the same commit that moves its callers, with `bun run check:full` green.

The comparison is itself a test file in the package while both exist, and is deleted with the last script.

## The package, by the house rules

- **Strictness.** The root's full Effect profile with no override and no `strict-ceiling.json`: this is new code. So
  no Node built-in import (`FileSystem`, `Path`, `ChildProcess`, `Digest` in their place), no `JSON.parse` (a
  `package.json`, a `vendor.json`, a `strict-ceiling.json` and a `tsconfig` are each decoded through a schema), no
  `process.argv`, `process.exit` or `console` (the CLI module and `Console`), no `Map` or `Set`.
- **Schema first** (`docs/standards/schema-first.md`). Each rule's design order is its schemas (the file shapes it
  reads, its options, its findings as a tagged union with one case per failure sentence), then the function over
  services, then the command. A finding is data; the sentence is rendered from it in one place, which is what lets
  the parity test compare sentences.
- **Imports** (`docs/standards/effect-imports.md`): `effect/cli/Command`, never `effect/cli`.
- **Filenames carry a role**: `Boundaries.rules.ts` (the pure rule), `Boundaries.schema.ts`, `Laws.command.ts`,
  `Laws.errors.ts`, `Workspaces.service.ts`, `bin.ts`. beep-effect's CLI uses `.command.ts`, `.model.ts` and
  `.errors.ts`; this repository's word for a schema file is `.schema.ts`, and the house word wins.
- **Exact exports**: the bin, the root command and one entry per command group; no wildcard.
- **Typed errors**: a rule that finds problems succeeds with its findings; the command turns a non-empty list into
  exit code 1 after printing. What fails as an error is what the script could not do at all (a file that cannot be
  read, a tool that is not installed, a `vendor.json` that does not decode), each a `S.TaggedError` with the path.
- **Shared once**: the workspace list (every `package.json` under `apps` and `packages`, decoded) and the repository
  root are one service, replacing five directory walks.
- **Tests** for every rule, from the planted violations above.
- **Boundaries.** The package's family is `tooling`. The boundaries rule gets one row: `tooling` may depend on
  `foundation`, and nothing but the root may depend on `tooling`. The root workspace list gets
  `packages/tooling/*/*`.

## The loop's speed

Measured here (a 64-thread machine; averages of five or ten runs):

| What | Time |
| --- | --- |
| `bun run check`, everything cached | 38 ms |
| The same tasks with the cache off (68 tasks) | 8.2 s |
| `node` starting and exiting | 20 ms |
| `bun` starting and exiting | 11 ms |
| `node scripts/check-ceilings.mjs` | 27 ms |
| `node scripts/check-boundaries.mjs` | 58 ms |
| `node scripts/check-screens.mjs` | 30 ms |
| `node scripts/vendor-check.mjs` | 36 ms |
| `bash scripts/keys-check.sh` | 38 ms |
| `node scripts/check-exports.mjs` (in `@inventory/ui`) | 42 ms |
| `node scripts/check-effect-imports.mjs` | 503 ms |
| `bash scripts/docs-check.sh` | 821 ms |
| `node scripts/check-strict.mjs` (in `@inventory/ui`; the type-checker run) | 1,569 ms |
| The probe: a TypeScript Effect CLI with one subcommand that reads a file, under bun | 84 ms |
| The same probe under node 26 | 157 ms |

So a bun-run TypeScript command costs about 60 ms more than a small script does today, and a node-run one about
130 ms. An uncached `bun run check` makes fourteen such calls (seven root checks, six `quality strict`, one `laws
exports`): about 0.8 s of processor time under bun, spent in parallel, against an 8.2 s run whose long poles are the
type-checker and the tests. A cached run makes none.

The probe is the floor, not the forecast. It imports one command; the real CLI imports ten, with their schemas and
the kit. beep-effect's full CLI takes about 1 s to start, by its own comment, which is why its `bin.ts` answers its
hottest call without loading the rest. That is question T7. Whatever is chosen, the goal ends with these numbers
measured again for the real commands, in the same table.

`turbo.json` changes with the port: a task whose `inputs` name `scripts/check-screens.mjs` names the command's
source folder instead, so a change to a rule still misses the cache.

## What beep-effect does that does not fit here

- **The compiled CI binary** (`bin-ci.ts`): for jobs that run before `bun install`. This repository has none.
- **`publishConfig`, `dist/` and a build**: its CLI can be published. This one is private and run from source, like
  every other package here.
- **Its support packages**: `@beep/repo-cli-kit`, `@beep/cli-kit`, `@beep/git`, `@beep/repo-utils`,
  `@beep/repo-workspaces`, `@beep/memfs`, `@beep/test-runner` and some sixty more dependencies. None is vendored
  here, and the ten commands need a workspace list, a root, and a way to print findings: small enough to write.
- **Docgen and the JSDoc gates**, and **Biome**: this repository has neither.
- **Generated package scripts** (its `check` scripts are written by a command and begin with a probe): six package
  scripts are edited by hand here.
- **Fifty command groups.** This CLI starts with four.

## Questions for Benjamin

Each is his. The first option is the recommendation, with its reason.

**T1. The package's name and place.**

- `packages/tooling/tool/cli`, named `@beep/repo-cli`, bin `beep-cli` (Recommended): exactly beep-effect's, so a
  command, a path or a habit learned there is the same here. The name says "beep" in a repository whose own packages
  are `@inventory/*`; the kit packages written here (`@beep/csv`, `@beep/xlsx`, `@beep/d1`) already do.
- The same folder, named `@inventory/repo-cli`, bin `inventory-cli`: the name says whose repository the rules are;
  the folder still matches. Commands read differently from beep-effect's.
- `packages/tooling/cli`, one level less: shorter, and no `tool/` folder with one child; no longer "just like
  beep-effect", and a second tool (a docgen) would have to move it.

**T2. What runs it.**

- bun, with `@effect/platform-bun` (Recommended): beep-effect's choice, the faster start (84 ms against 157 ms), and
  bun is already required to run any script here. One new dependency, pinned to 4.1.4. Not verified: that it
  installs and runs here; the probe used the node layers.
- bun, with the `@effect/platform-node` layers already installed: no new dependency, and the probe ran this way
  under bun at 84 ms. Differs from beep-effect in one import.
- node: the scripts run on node today, so nothing changes for a machine without bun on its path; about 70 ms slower
  per call, and node must be 22.18 or newer to run a `.ts` file (the root says `>=22`).

**T3. How the commands are grouped.**

- beep-effect's groups (Recommended): `laws boundaries`, `laws exports`, `laws screens`, `laws keys`, `laws
  effect-imports`; `quality strict`, `quality ceilings`; `docs check`; `vendor check`, `vendor sync`. `laws
  effect-imports --check` is then the same command in both repositories. The split between `laws` and `quality` is
  beep-effect's and has to be learned.
- One group: `check boundaries`, `check ceilings`, `check strict` and so on, with `vendor sync` beside it. Nothing to
  learn, and it matches the script names; no command shares a name with beep-effect's.

**T4. Where the vendoring commands live.**

- In the CLI, `vendor check` and `vendor sync` (Recommended): one place for everything the repository runs on
  itself; `vendor sync` is ported last and proved by re-vendoring the recorded commit with no change to the tree.
- `vendor check` in the CLI, `vendor-beep.mjs` left as a script: the check that runs on every commit is typed and
  tested; the 408-line tool run by hand a few times a year stays as it is, and `scripts/` keeps one file.
- A second package, `packages/tooling/tool/vendor`: the copying tool has its own entry and is not loaded by a
  check; two packages to keep where one would do.

**T5. When the old scripts are deleted.**

- In this goal, each in the commit that proves its command equal (Recommended): no period with two sources of one
  rule, and the goal ends with `scripts/` empty or gone.
- All at the end, in one commit, after every command is proved: one deletion to review; until then each rule exists
  twice and a fix must be made twice.
- In a later goal: both run in `bun run check` for a while and a difference fails it. The safest, and the loop pays
  for every rule twice.

**T6. The Effect imports check.**

- Port it in this goal, last (Recommended): it is the largest and the newest, its `--write` mode makes it the one
  most worth typing and testing, its parser dependency moves from the root to the package, and beep-effect's command
  of the same name is the model.
- Leave it a script until it has been on main for a while: nothing about it moves while it is new; `scripts/` keeps
  one file and one rule stays untyped.

**T7. The calls every package makes.** `quality strict` runs in six packages and `laws exports` in one.

- One entry, and a budget (Recommended): the bin loads the whole CLI; a test fails if a no-op command takes more
  than a stated time (the number is set from the first real measurement). A fast path is added only if the budget
  fails. Nothing is built for a cost not yet seen.
- beep-effect's fast path from the start: `bin.ts` answers `quality strict` and `laws exports` itself, loading only
  that rule. The package calls stay near the probe's 84 ms whatever the CLI grows to; two ways into the same rule to
  keep in step.
- Move them to the root: one `quality strict` over all six packages and one `laws exports`, as root tasks. Seven
  calls become two; a package's own `check` no longer says its ceiling is wrong, the root's does.

**T8. What the tests stand on.**

- `@effect/vitest`, a real temporary folder (`FileSystem.makeTempDirectoryScoped`) and `TestConsole` (Recommended):
  everything is installed, and the rule reads real files as it does in the repository.
- Vendor beep-effect's `@beep/memfs`: its tests' own way, faster and with no disk; a fifth vendored package and its
  closure to keep in step.

## Not verified

- `@effect/platform-bun` 4.1.4 was not installed or run here; only that it is published.
- The probe proves the module's path, its entry and its exit codes. It does not prove a prompt, completions, or a
  spawned process through `ChildProcessSpawner` on this machine.
- The start-up of the real CLI: only the one-command probe was measured.
- beep-effect's CLI was read, not run.
