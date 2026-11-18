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
| 1 | Workspace: bun workspaces, `turbo.json`, app moved to `apps/inventory`, CI through turbo | done |
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
- Step 1 names the app package `@inventory/app` (the `@inventory/*` scope decision) and the workspace root
  `inventory`. `bunfig.toml` sets bun's hoisted linker, as beep-effect does, so `effect-tsgo patch` keeps patching
  the one TypeScript and oxlint at the root; `.bun-version` pins bun for CI.
- Step 1 sets Turborepo's `envMode` to `loose`: the slow tests start workerd and wrangler, which read variables no
  list would keep complete, and no variable changes a cached result. `//#docs:check` hashes only the three bundles,
  its script and the validator; `//#format:check` hashes the repository.
- Step 1 keeps the app's `tsconfig.base.json` inside `apps/inventory` for now, because its Effect plugin's override
  globs (`src/web/**`) are relative to the app; step 2 puts beep-effect's profile in a root `tsconfig.base.json`.
- Step 1 replaced the scripts' `../node_modules/...` paths with a lookup for the nearest `node_modules`, so they work
  with the hoisted root.
- `.session/` is ignored again: a checkout made before step 0 still runs the old activity-log hook, which writes
  there, and that file must never be committed or hashed into the root tasks.

## Evidence

- Step 0: `bun run check:full` passed (44 test files, 256 tests; docs, explorations and goals conform), and
  `bun run build` passed. Browser, dev server on port 5196: "Use items_messy.csv" read 200 rows (All 200, Ready 155,
  Needs a decision 24, Cannot import 21); "Import 155 items" confirmed; the result read Imported 155, Not imported
  45, All 200; Items read "155 items"; `wrangler d1 execute DB --local` counted 155 rows in `item` for `org_prairie`.
- Step 1: `bun run check` then `bun run check` again: the second run read "Tasks: 5 successful, 5 total / Cached:
  5 cached, 5 total / FULL TURBO". `bun run check:full` passed (7 of 7 tasks; 34 fast files, 213 tests; 10 slow
  files, 43 tests; build and production identity check). CSS: `auto-rows-min` appears in `src/web` only in
  `components/ui/card.tsx`, and `grep -o '\.auto-rows-min{[^}]*}' apps/inventory/dist/client/assets/*.css` prints
  `.auto-rows-min{grid-auto-rows:min-content}`. Browser, after `bun run db:reset`, `bun run dev -- --port 5196
  --strictPort` from the root: 200 rows read (Ready 155, Needs a decision 24, Cannot import 21, All 200); "Import 155
  items" confirmed; the result read Not imported 45, Imported 155, Already there 0, All 200; Items read "155 items";
  D1 counted 155 rows in `item`.
