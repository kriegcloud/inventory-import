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
| 0 | Clear the ground: timed-build tooling out, placeholder names renamed to `inventory`, bun only | done |
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
- Step 0 kept the key-shaped-secret scan that used to read its pattern from the pack script: it is now
  `test/repo/KeyScan.test.ts` with the pattern inline, run by `bun run check`. The history scan the pack also did is
  gone with it.
- Step 0 removed the process skills (`intake`, `lead`, `next`, `ship`, `decisions`, `qa`, `verify`, `references`) and
  the `uploader` agent; the `qa`, `reviewer` and `verifier` agents stay, rewritten without frozen copies. The
  `quality-review-fix-loop` skill stays, pointed at a goal's SPEC instead of the brief. `in-your-own-words`,
  `grill-me`, `grilling` and `unslop` stay: nothing in them is about the timed build.
- `DECISIONS.md` (the product decisions of the original build) and `docs/qa/QA.md` (its browser passes) are kept as
  the record they are; they still name the old checkpoints and are not rewritten.
- `allowScripts` (npm only) became bun's `trustedDependencies` for `esbuild` and `workerd`.
- `beep.json` no longer lists the starter's `timebox` module.

## Evidence

- Step 0: `bun run check:full` passed (44 test files, 256 tests; docs, explorations and goals conform), and
  `bun run build` passed. Browser, dev server on port 5196: "Use items_messy.csv" read 200 rows (All 200, Ready 155,
  Needs a decision 24, Cannot import 21); "Import 155 items" confirmed; the result read Imported 155, Not imported
  45, All 200; Items read "155 items"; `wrangler d1 execute DB --local` counted 155 rows in `item` for `org_prairie`.
