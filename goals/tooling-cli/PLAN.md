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
| 6 | `laws effect-imports` | todo |
| 7 | The start-up budget test, the check's time before and after, the documents | todo |

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

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **A rule hands back its lines, not a union of findings.** The brief asked for each rule's findings as a tagged
  union with one case per failure sentence, rendered in one place. Each rule here returns a `Report`: the lines it
  would print, in order, each for standard output or standard error, and whether it failed; the command prints it. A
  test reads those lines, which is what the parity proof compares. A union per rule would add some forty cases whose
  only use is to be turned back into the same sentences. Open to change if the findings are ever wanted as data.
- **One row is new in `laws boundaries`**: nothing may depend on a `tooling` package, an app included. The script
  had no such row because there was no such package. It has its own test, and is outside the parity proof.
- **`quality strict` exits 1 on two refusals where the script exited 0.** When no tsconfig had the plugin, or no
  ceiling file was named, the script printed its FAIL sentence and returned before it set the exit code, so the
  check passed. The command fails. The second sentence now names the command instead of the script's path.
- **`vendor sync` writes the kit's words as the script wrote them.** The provenance line of every vendored file, each
  kit README and the comment in each `vendor.json` name `scripts/vendor-beep.mjs` and `scripts/vendor-check.mjs`,
  which no longer exist. The command still writes those exact words, so a run at the recorded commit changes no
  file and the kit is untouched by this goal. Rewording them changes the first line of 90 vendored files, four
  READMEs and four records: a decision for Benjamin, not taken here.
- **`vendor sync` has no test of its own.** Its proof is the two runs above; a test would need a small beep-effect
  repository with the four packages and their closure as a fixture.
- **A missing argument exits 1, not 2.** `vendor-beep.mjs` exited 2 when `--from` was missing; a command's missing
  flag is reported by the CLI module, which prints its usage and exits 1.
- **The root scripts call the bin directly** (`bun packages/tooling/tool/cli/src/bin.ts quality ceilings`), not
  `bun run beep ...`, so a check starts one bun and not two. `bun run beep <group> <command>` is for a person.
- **Tests run on node** (Vitest always does here), so they provide `@effect/platform-node`'s services, a
  devDependency; the bin provides `@effect/platform-bun`'s.
