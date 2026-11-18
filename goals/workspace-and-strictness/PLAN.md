---
type: Plan
title: Workspace and strictness, plan
description: The steps of the workspace-and-strictness goal, their status, the current blocker and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`.

| # | Step | Status |
| --- | --- | --- |
| P | Packets: this goal, `explorations/README.md`, `goals/README.md`, `docs:check` over both roots | done |
| 0 | Clear the ground: timed-build tooling out, placeholder names renamed to `inventory`, bun only | todo |
| 1 | Workspace: bun workspaces, `turbo.json`, app moved to `apps/inventory`, CI through turbo | todo |
| 2 | Toolchain: beep-effect flags and severities, staged overrides, ceiling check | todo |

## Current blocker

None.

## Choices made

Recommendations taken where the answered decisions leave a choice open.

- `explorations/` and `goals/` stay at the repository root and `docs:check` validates them (open decision 26,
  research 04 decision 11, recommendation taken). The OKF validator accepts any folder, so `scripts/docs-check.sh`
  runs it once per root. Files in `explorations/ideal-architecture/` that had no frontmatter (`DECISIONS.md` and the
  four research reports) gained a `type`/`title`/`description` block so they pass; their text is unchanged.
- The validator warns that `status: active` is not one of OKF's own `draft|stable|deprecated`. The packet scheme's
  statuses are kept on purpose; the warning is printed and does not fail the check.
