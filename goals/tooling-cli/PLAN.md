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
| 1 | `@effect/platform-bun` 4.1.4 installed and run; the package's frame; `quality ceilings` and `laws exports` | doing |
| 2 | `laws boundaries`, `laws screens`, `laws keys` | todo |
| 3 | `vendor check`, `docs check` | todo |
| 4 | `quality strict` | todo |
| 5 | `vendor sync` | todo |
| 6 | `laws effect-imports` | todo |
| 7 | The start-up budget test, the check's time before and after, the documents | todo |

## Proofs

"Same tree" is the unchanged repository; each planted case is one kind of failure the script prints. Every row was
compared on standard output, standard error and exit code.

| Command | Same tree | Planted, old and new the same |
| --- | --- | --- |
| `quality ceilings` | the same (7 lines, exit 0) | the sum above the cap (exit 1) |
| `laws exports` | the same in `@inventory/ui` (exit 0) | a wildcard entry, an entry naming no file, an entry with no target, a component with no entry (exit 1) |

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **A rule hands back its lines, not a union of findings.** The brief asked for each rule's findings as a tagged
  union with one case per failure sentence, rendered in one place. Each rule here returns a `Report`: the lines it
  would print, in order, each for standard output or standard error, and whether it failed; the command prints it. A
  test reads those lines, which is what the parity proof compares. A union per rule would add some forty cases whose
  only use is to be turned back into the same sentences. Open to change if the findings are ever wanted as data.
- **A missing argument exits 1, not 2.** `vendor-beep.mjs` exited 2 when `--from` was missing; a command's missing
  flag is reported by the CLI module, which prints its usage and exits 1.
- **The root scripts call the bin directly** (`bun packages/tooling/tool/cli/src/bin.ts quality ceilings`), not
  `bun run beep ...`, so a check starts one bun and not two. `bun run beep <group> <command>` is for a person.
- **Tests run on node** (Vitest always does here), so they provide `@effect/platform-node`'s services, a
  devDependency; the bin provides `@effect/platform-bun`'s.
