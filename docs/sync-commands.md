---
type: Tooling Guide
title: Versions and configuration kept in step
description: The three commands that move dependencies, hold every repeated version to its one source and write the configuration that follows from the workspaces; what each covers, what it leaves alone, and the dependencies held back with their reasons.
tags: [tooling, dependencies, configuration]
---

# Versions and configuration kept in step

A version written in two places is wrong in one of them sooner or later, and so is a list of packages kept by hand.
Three commands of the repository's own CLI (`packages/tooling/tool/cli`) hold both. Each one first plans (it reads the
tree and changes nothing) and only then writes, so a check, a dry run and a write agree on what differs.

| Command | What it does | In `bun run check` |
| --- | --- | --- |
| `bun run deps:update` | Moves every dependency of every package to the registry's newest version, except the ones held back; installs; then runs `version-sync --write`. `-- --dry-run` lists the same and writes nothing | no: it asks the registry |
| `bun run version-sync` | Names every place where a version or a date differs from its one source, and fails. `-- --write` rewrites them, `-- --dry-run` lists what would be written | yes |
| `bun run config-sync` | Writes the lists and paths that follow from the workspaces. `-- --dry-run` lists what would be written | as `config-sync:check` |
| `bun run config-sync:check` | Names what `config-sync` would write, and fails | yes |
| `bun run deps:lint` | syncpack: one version of a dependency across the packages, Effect's pinned exactly | no |
| `bun run deps:outdated` | syncpack: what has a newer version, the held dependencies left out | no: it asks the registry |

What a command cannot repair it says as a problem, in a sentence naming the file, and fails in every mode: two
packages at different versions of `effect`, a package no `workspaces` pattern covers, a path that names nothing.

## Moving dependencies: `deps:update`

- **Every package.** The root's `package.json` and every workspace's under `apps` and `packages`, 25 files today.
  The scratchpad's is not one of them: what it shares with the packages follows through `version-sync`, and a
  library an experiment added is the experiment's. A dependency keeps the way it is
  written: an exact version stays exact, `^1.2.3` stays a caret range.
- **Effect moves together.** `effect` and every `@effect/*` package released with it are at one exact version. When
  the registry's newest version is the same for all of them, all move; when one was published later than the rest,
  none moves and the command says which is behind.
- **Held dependencies stay**, and each is named at every run with the registry's newest version, and its group
  with why it is held and what moves it by hand. So one run says everything an update needs: what moved, and for
  what did not, the command or the steps. The list is `updateGroups` in `.syncpackrc.json`: a group's `label` is its
  reason, and what follows ` To move: ` in it is how it moves. `deps:outdated` leaves the same ones out.
- **After the move** `bun install` runs, then `version-sync --write`, and the command says what moved from which
  version to which. Run `bun run check:full` before committing: a new formatter or type-checker can find new things.

### What is held, and why

| Held | Why |
| --- | --- |
| `@effect/tsgo` | A new Effect language service adds diagnostics the profile in `tsconfig.base.json` must name (every diagnostic is an error there), and it patches only the typescript, tsrs and oxlint versions it lists. It moves by hand, with them |
| `typescript`, `tsrs`, `oxlint`, `oxlint-tsgolint` | `@effect/tsgo` patches them at install (the root's `prepare` script) and stops on a version it does not list. They move only with it |
| `alchemy`, `@alchemy.run/*`, `@distilled.cloud/*` | A beta pinned as one set to one commit of its library and kept as files (`vendor/alchemy`). `bun run alchemy:repin -- main` moves the pin (a commit in place of `main` for that commit), and `deps:update` prints that command beside them |
| `@types/node` | Held at the Node that CI runs and `engines.node` names (22), so a type for an API the runner does not have fails the type-check. `version-sync` names an `@types/node` of another major, and the workflows |
| `better-auth` | Its tables are a migration written by hand ([Sign-in](auth.md)), and a new version can want a table or a column they do not make. `bun run check` fails then (`apps/inventory/test/server/AuthSchema.test.ts`); `bun run auth:schema` prints the migration to add |
| `xlsx` | SheetJS publishes at its own address, and the registry's `xlsx` stopped at 0.18.5. It is written as an address and moved by hand |

To hold another dependency, add a group to `updateGroups` with its reason as the `label`, ending ` To move: ` and
what moves it; to release one, remove the group.

## One source for each version: `version-sync`

| What | Its one source | The places that follow it |
| --- | --- | --- |
| bun | `.bun-version` | `packageManager` in the root's `package.json`; a `bun-version:` in a workflow; "Bun 1.4.4" in the standing documents |
| Node | `engines.node` in the root's `package.json` (its major) | `node-version:` in every workflow; "Node 22 or newer" in the documents; the major of every `@types/node` (named, not written: the newest of a major is the registry's to say) |
| Effect | the `effect` every `package.json` states (the root's `catalog`, when there is one) | every `@effect/*` package released with it; "Effect 4.1" and "effect 4.1.5" in the documents; the versions `vendor sync` writes into a vendored package |
| `@effect/tsgo`, TypeScript, Better Auth | the one version the `package.json` files state | their name followed by a version in the documents |
| Alchemy | `alchemy` in the `package.json` files; `vendor/alchemy/sources.json` once the packages are kept as files | every `@alchemy.run/*` dependency; with kept files, each dependency's `<version>-<commit>` and each override's file |
| The Cloudflare compatibility date | `apps/inventory/wrangler.jsonc` | every other `wrangler*.jsonc`; `compatibility: { date }` in a package that declares `alchemy` |
| A GitHub action's version | `.github/workflows/ci.yml` | the same action in every other workflow |
| The CLI's version | its `package.json` | `version` in its `src/bin.ts` |
| The Effect language service's schema | the installed `@effect/tsgo` | a tsconfig's `$schema` that names the library's repository instead |
| What the scratchpad runs on | the version the `package.json` files state for each dependency | the same dependency in `scratchpad/package.json`; a library only an experiment uses is left alone |

The standing documents are `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/` and `.claude/agents`. A version is read in
a sentence only after its own name ("Effect 4.1", "`effect` 4.1.5's source"), and as precisely as the sentence
states it: "Effect 4.1" stays two numbers. After a name written small only a whole version is read, so "no effect
1.5 s later" is left alone.

**A sentence that records a check is moved with the rest.** A document that says its names were checked in one
version of Effect's source says the next version after a move, though nobody checked again. `--write` prints every
line it changes: read them, and re-check or reword a sentence that claims a check. The examples on this page are
real versions for the same reason: the command keeps them true.

### What it leaves alone

- `explorations/`, `goals/`, the root's `DECISIONS.md`, `docs/qa` and `docs/session`: records of what was true when
  they were written.
- A version with no name before it ("no such schema in 4.1.4"): nothing says whose it is.
- "Node 22.18 or newer" (what one script needs, not the repository's floor) and "wrangler 4.161" in `CLAUDE.md` (the
  version a fact was read in).
- A `$schema` or an `extends` written as a path: it names the installed file, so only its depth can be wrong, and
  that is `config-sync`'s.
- Pairs that the registry and `deps:lint` already hold together (`react` and `react-dom`, `tailwindcss` and its Vite
  plugin), and values that are not versions: the model's name, ports, the ceilings' sum.

To add a place, add its pattern beside its source in `VersionSync.rules.ts` and its file to the task's `inputs` in
`turbo.json`.

## Configuration that follows from the workspaces: `config-sync`

A package is added in one place: a folder with a `package.json` under a `workspaces` pattern of the root. What
depends on where it is and what it holds is written from that.

| Rule | What is derived | From |
| --- | --- | --- |
| sources | `source` in `.syncpackrc.json` | the root's `workspaces` patterns |
| coverage | every package fits a `workspaces` pattern, and every pattern names a package (a problem, not repaired) | the folders with a `package.json` under `apps` and `packages` |
| paths | a `$schema`, an `extends` and a path in a script that names nothing where it is, and would from the root | the depth of the folder it is in |
| references | a solution file (`"files": []`) references every project beside it, the root's also each package's projects other than its `tsconfig.json`; a reference that names nothing is removed; a project that has `references` lists the workspace packages its `package.json` declares | the `tsconfig*.json` files on disk, and each package's dependencies |
| scripts | `check` type-checks each of the package's projects and counts against its ceiling file; `test` exists beside a `vitest.config.ts`; `lint` exists unless the package is vendored | what the package holds |
| tasks | `check`, `check:full` and `check:ci` (CI's main job) run every root task `turbo.json` defines and no other; each has a root script (a problem when it has none) | the `//#name` tasks of `turbo.json` |
| vendored | the formatter's `ignorePatterns` name every vendored package | the packages with a `vendor.json` |
| scratchpad | the scratchpad's `dependencies` name every package, as `workspace:*` ([the scratchpad](scratchpad.md)); syncpack's sources leave the scratchpad out | the packages under `packages/` |

A reference a person added by hand to a solution file is kept while it names something. No package has project
references today (each is type-checked from source by `tsrs -p`); the rule for them is there for the day one does.

The rest of what repeats the workspaces is held elsewhere: the two stylesheet lists by `bun run beep laws screens`,
which package may import which by `bun run beep laws boundaries`.
