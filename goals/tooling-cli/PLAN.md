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

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.
