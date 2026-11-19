---
type: Plan
title: "tooling-cli, plan"
description: The steps of the tooling-cli goal, their status, each port's proof, the current blocker and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`.

| # | Step | Status |
| --- | --- | --- |
| 1 | `@effect/platform-bun` 4.1.4 installed and run; the package's frame; `quality ceilings` and `laws exports` | done |
| 2 | `laws boundaries`, `laws screens`, `laws keys` | done |
| 3 | `vendor check`, `docs check` | done |
| 4 | `quality strict` | done |
| 5 | `vendor sync` | done |
| 6 | `laws effect-imports` | done |
| 7 | The start-up budget test, the check's time before and after, the documents | done |

## Proofs

"Same tree" is the unchanged repository; each planted case is one kind of failure the script prints. Every row was
compared on standard output, standard error and exit code.

| Command | Same tree | Planted, old and new the same |
| --- | --- | --- |
| `quality ceilings` | the same (7 lines, exit 0) | the sum above the cap (exit 1) |
| `laws exports` | the same in `@inventory/ui` (exit 0) | a wildcard entry, an entry naming no file, an entry with no target, a component with no entry (exit 1) |
| `laws boundaries` | the same (exit 0) | an undeclared import, a dynamic import of an undeclared package, a path into `apps/`; a declared package the row refuses and its import (exit 1) |
| `laws screens` | the same (exit 0) | a package with screens missing from the `@source` lines and from `screenPackages`, an entry naming no package, a source naming no folder; no `screenPackages` block at all (exit 1) |
| `laws keys` | the same (exit 0) | a key-shaped string and a private-key header in a new, untracked file (exit 1) |
| `vendor check` | the same, and with `--source` against a beep-effect checkout (exit 0) | a changed file, a lost provenance line, a missing file, a stray file, changed exports; in the record, a patch with no reason on a file equal to upstream and a source hash that differs; with `--source`, a recorded source hash that is not upstream's (exit 1) |
| `docs check` | the same, and with `--verbose` (exit 0) | a document with no frontmatter (exit 1). A bundle with no markdown, a validator that scanned nothing, and a missing validator are tested against a stand-in validator, not compared: planting them means moving a whole bundle or the vendored skill |
| `quality strict` | the same in all six packages that run it, and with `--all` (exit 0), the elapsed seconds in its last line set aside | a ceiling above the count, a ceiling below it, plugin options that differ from the root's (exit 1) |
| `vendor sync` | run at the recorded commit, it prints the same five lines and changes no file (the script did the same) | no failure sentences to plant. Run at beep-effect's current commit instead: the script and the command each changed the same 98 files to the same bytes, and the kit was restored. A commit that does not exist stops before anything is written |
| `laws effect-imports` | the same (exit 0) | one file with every kind (root barrel, a function from the root, the barrel whole, a nested barrel, an `@effect` package root, a wrong name, `N` for `effect/Number`, a value picked by name, an unknown path, a name a barrel does not hold, a barrel re-export, a dynamic import of a barrel), an example in a comment, an import in a document; the same file named on the command line (exit 1). `--write`: the script and the command each repaired the 211 pre-migration source files to the same bytes and printed the same lines |

## Time

Measured on one 64-thread machine; each command is the average of ten runs, the check the wall-clock time turbo
prints.

| What | Before, the script | After, the command |
| --- | --- | --- |
| A command that does nothing (`--version`) | not applicable | 110 ms |
| ceilings | 27 ms | 150 ms |
| boundaries | 58 ms | 194 ms |
| screens | 30 ms | 142 ms |
| keys | 38 ms | 169 ms |
| vendor check | 36 ms | 184 ms |
| exports (in `@inventory/ui`) | 42 ms | 130 ms |
| effect-imports | 503 ms | 545 ms |
| docs check | 821 ms | 1,001 ms |
| strict (in `@inventory/ui`; the type-checker run) | 1,569 ms | 1,585 ms |
| `bun run check`, nothing cached | 8.2 s (68 tasks, one run) | 7.5 s, 7.5 s, 7.6 s (71 tasks, three runs) |
| `bun run check`, everything cached | 38 ms | 42 ms |

A small command costs about 100 to 140 ms more than its script did: the CLI's start. Fourteen of them run in an
uncached check, in parallel, and the check's wall-clock time did not rise by an amount this measurement can see. The
budget test (`test/Startup.test.ts`) holds the fastest of five starts of a command that does nothing under 400 ms; set
to 40 ms it fails, so it does measure.

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **A rule hands back typed findings** (decision "tooling CLI: what a rule returns"). The first build returned the
  lines each rule prints. Each rule now returns values of its own tagged union (`CeilingsFinding`, `StrictFinding`,
  `ExportsFinding`, `KeysFinding`, `BoundariesFinding`, `ScreensFinding`, `VendorCheckFinding`, `VendorSyncFinding`,
  `OkfFinding`, and for the imports rule `EffectImportsFinding` over `ImportFault` and `RepairLeft`), each with its
  `sentence`, and one renderer (`render` and `emit` in `Report.schema.ts`) prints them; a rule failed when a finding
  goes to standard error. Proved unchanged: all 37 cases of the proofs above (every command on the unchanged tree and
  on every plant) were captured before and after, and standard output, standard error and exit code are the same
  byte for byte, but for the file count in the imports rule's own line, which rose by one for the new schema file.
  A sentence that was one print of several lines (`check-exports FAIL` and its problems, and the same in
  `laws boundaries` and `laws keys`) is now one finding per line; three tests' expectations were split to match.
  Every member of every union has its own test (`test/Findings.test.ts`), keyed by the union's tags so that a new
  member without one does not compile.
- **`quality strict` exits 1 on two refusals where the script exited 0.** When no tsconfig had the plugin, or no
  ceiling file was named, the script printed its FAIL sentence and returned before it set the exit code, so the
  check passed. The command fails. The second sentence now names the command instead of the script's path.
- **The kit's words name the commands** (decision "the words in the vendored kit"). The first build wrote the
  provenance lines, READMEs and `vendor.json` comments exactly as the script had, naming the two deleted scripts, so
  the kit stayed byte for byte. `vendor sync` now writes `bun run beep vendor sync` and `bun run beep vendor check`,
  and the kit was synced again at its recorded commit: the first line of the 90 vendored files and the comment line
  of the four `vendor.json` files changed (one line each), and three lines in each of the four READMEs. No other line
  of the kit changed, and `vendor check` passes, with and without `--source`.
- **`vendor sync` has no test of its own.** Its proof is the two runs above; a test would need a small beep-effect
  repository with the four packages and their closure as a fixture.
- **`laws effect-imports --write` keeps one limit of the script**: a renamed module used as a shorthand property
  (`{ Option }`) is reported as "overlapping edits: repair this file by hand" and left. The script did the same;
  none of the 211 migrated files had one.
- **A missing argument exits 1, not 2.** `vendor-beep.mjs` exited 2 when `--from` was missing; a command's missing
  flag is reported by the CLI module, which prints its usage and exits 1.
- **The root scripts call the bin directly** (`bun packages/tooling/tool/cli/src/bin.ts quality ceilings`), not
  `bun run beep ...`, so a check starts one bun and not two. `bun run beep <group> <command>` is for a person.
- **Tests run on node** (Vitest always does here), so they provide `@effect/platform-node`'s services, a
  devDependency; the bin provides `@effect/platform-bun`'s.

## Closing note

`scripts/` is gone: the ten rules are commands of `@beep/repo-cli`, type-checked under the full profile with no
override, with 106 tests. `bun run check` and `bun run check:full` run them under the same root script names and
turbo task names. What was learned:

- Two rules read source text by pattern (`laws boundaries`, and the comment and document half of `laws
  effect-imports`), and as scripts they never read themselves. As code under `packages/`, their own fixtures and data
  are now inside what they read: an import statement written as one string in a test or in the vendoring patches is
  taken for an import of that file. Such text is put together from two halves, with a comment saying why.
- The strict profile found nothing wrong in the ported logic, but it did change its shape: no loops over mutable
  maps, every file through a schema, every tool through one service.
- The installed CLI module's names differ from what is remembered: `Flag.Boolean`, not `Flag.boolean`, and a boolean
  flag is required unless it has a default.
