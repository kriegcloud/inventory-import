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
| 2 | Toolchain: beep-effect flags and severities, staged overrides, ceiling check | done |

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
- Step 0 kept the key-shaped-secret scan that used to read its pattern from the pack script. After step 2 it became
  the root task `//#keys:check` (`scripts/keys-check.sh`, run by `bun run check`): as a test inside the app it read
  the whole repository while turbo hashed only the app's files, so a new file outside the app (the restored skills,
  for one) replayed a cached pass without being scanned. A root task's hash is the whole repository. The history scan
  the pack also did is gone.
- Step 0 removed the process skills written for the timed build (`intake`, `lead`, `next`, `ship`, `decisions`, `qa`,
  `verify`, `references`) and the `uploader` agent; the `qa`, `reviewer` and `verifier` agents stay, rewritten without
  frozen copies.
- The 21 skills that `main` took from beep-effect (commit `cbeaa4c`, made after this branch was cut from `840a358`)
  were added after step 2, each folder and its `.claude/skills` and `.codex/skills` links byte-identical to `main`,
  with the "From beep-effect" section of `.agents/skills/README.md`. That replaced this branch's older `grilling`,
  `unslop` and `quality-review-fix-loop` with `main`'s copies, so step 0's edit of `quality-review-fix-loop` (pointing
  it at a goal's SPEC instead of the brief) is gone; its beep-effect text names beep-effect's paths, and CLAUDE.md says
  this file wins where they disagree. None of them needed an exclusion: `.agents/` is outside the format check, and
  lint and the type-check cover only `apps/inventory`.
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
- Step 2 copies beep-effect's `tsconfig.base.json` (commit 820f870dc411, main at 2a783b3fea45) into the root
  `tsconfig.base.json` verbatim, with its plugin block and every severity, but without the keys that only matter when
  emitting (outDir, rootDir, tsBuildInfoFile, incremental, composite, declaration, declarationMap, sourceMap,
  rewriteRelativeImportExtensions, stripInternal); `noEmit` is added. The app's configs take its ES2025 target and
  `ESNext` lib (plus `DOM` for the browser) and keep `bundler` resolution with `vite/client` types, as research 04
  section 5 found necessary.
- `compilerOptions.plugins` replaces an inherited plugin list whole, so the app's `tsconfig.base.json` repeats the
  root's plugin block to add its two overrides. `check:strict` fails when the two blocks differ anywhere but
  `overrides`, so they cannot drift apart silently. Override globs (`src/web/**`) resolve from the app's folder:
  measured, the vendored components' findings disappear with the stage D override in place.
- The stage C count is measured by `check:strict` with the stage C override taken out of the plugin options and
  only those four rules counted, in `src/web` outside `components/ui`. It must equal the ceiling in
  `apps/inventory/scripts/strict-ceiling.json`: above fails, and below fails until the ceiling is lowered, so the
  recorded number stays true and only falls. It runs inside the app's `check` task, so turbo caches it.
- `@effect/tsgo` 0.70.0 and `tsrs` 0.25.0-ts7.1.0-beta are pinned exactly; `prepare` patches `tsrs` too and the app's
  `check` calls `tsrs` directly, as research 04 section 5 says.
- Service keys became `@inventory/app/...`: the `deterministicKeys` rule derives them from the package name and the
  path under `src/`. This answers research 04's open question for an unscoped path; for a scoped name it prefixes the
  scope as written.
- `missingConcurrencyOption`: every flagged `Effect.forEach` and `Effect.all` got `{ concurrency: 1 }`, the
  diagnostic's own suggestion, which keeps today's sequential behaviour (the D1 batch order and the decode order do
  not change).
- `fileProblemTitle` became a `dual` with a required noun, like `hasRole`; its one caller already passed both.
- The web fixes outside the four ledgered rules were done in a separate lane (Codex `gpt-6.1-sol`, medium) limited
  to `src/web` outside `components/ui`, then reviewed and checked here.

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
- Step 2, measured before fixing: the app on the root profile with no override had 2,973 unique findings, 2,220 of
  them in `components/ui`; own code had web 683, server 26, test 26, api 12, `vite.config.ts` 5, domain 1. With the
  stage C and D overrides, 140 remained (70 back end and tests, 70 web) and all 140 were fixed. `tsrs -b` now prints
  nothing.
- Step 2 ceiling: `check:strict` counts **610** stage C findings in own web code (preferEffectArray 432,
  preferEffectString 109, missingPipeableSignature 39, preferEffectRecord 30), recorded in
  `apps/inventory/scripts/strict-ceiling.json`. Proof that it bites: one native `.map` added to `src/web/lib/early.ts`
  made it print "Total: 611, ceiling 610" and "check:strict FAIL 1 new finding(s) above the ceiling" (the line was
  then removed).
- Step 2: `bun run check:full` passed (7 of 7 tasks; 34 fast files, 213 tests; 10 slow files, 43 tests; build with
  the patched `tsc -b`; "Total: 610, ceiling 610"). Browser, after `bun run db:reset`: the Items page asked
  `items/page` and `items/facets` once each, no console warning; "Use items_messy.csv" read 200 rows (Needs a
  decision 24, Cannot import 21, Ready 155, All 200); "Import 155 items" confirmed; the result read Not imported 45,
  Imported 155, Already there 0, All 200; Items read "155 items"; D1 counted 155 rows in `item`. Then the same file
  again: "Leave out 2" on a SKU group, a reload, and the review still read "Left out 2" and "Already there 155", so the
  rewritten decision saver saves and the second load created nothing.
- Merge of `main` (this branch was cut from `840a358`; `main` had 20 more commits: the beep-effect skills, the
  known-flaw fixes and the exploration). Merged rather than rebased: step 1 moves every file, so a rebase would have
  met the same conflicts in each of five commits, while a merge let rename detection carry each fix into
  `apps/inventory` once (four new files placed there too). Afterwards every file the fixes touched is identical to
  `main`'s or differs only by this goal's own edits (keys, `concurrency`, the Effect boundaries). The skills commit
  already matched `main`, so nothing of it was dropped.
- After the merge, `main`'s code had 10 findings under the full profile (one `JSON.parse` in the new
  `cellDrafts.ts`, nine in `TakeBack.slow.test.ts` and `reviewParity.test.ts`), all fixed. Its new web code (the
  Activity and People data tables, "Why flagged?", past imports) raised the stage C count from 610 to **688**
  (preferEffectArray 478, preferEffectString 131, missingPipeableSignature 42, preferEffectRecord 37), recorded as the
  new ceiling: the ceiling is a count of code that exists, and this code arrived with the merge.
- Tests after the merge: 216 fast and 45 slow run, 261 in all. `main` runs 306 fast and 73 slow, 379 in all (its
  listing shows 79 slow because it counts one entry per `layer()` block). The 118 gone are the timed-build tests,
  fast: `test/scripts/Checkpoint.test.ts` 44, `SessionRecord.test.ts` 39, `test/tooling/Images.test.ts` 5,
  `test/scripts/KeyScan.test.ts` 2 (its scan is now `bun run keys:check`); slow: `CheckpointBrief` 9,
  `CheckpointCopy` 7, `Clock` 7, `Pack` 3, `test/tooling/Profiles` 2.
- Merged branch evidence: `bun run check:full` passed (8 of 8 tasks; 216 fast, 45 slow; build; "Total: 688, ceiling
  688"; keys and docs OK). Browser, after `bun run db:reset`: 200 rows read (Needs a decision 24, Cannot import 21,
  Ready 155, All 200); "Why flagged?" opened with "The 2 flagged rows on screen, each with every reason", naming row
  148 (awp-1853) and row 195 (jlk-2867) with the SKU rule, its proposal and the SKU clash; "Import 155 items"
  confirmed; the result read Not imported 45, Imported 155, Already there 0, All 200; Items read "155 items"; D1
  counted 155; Activity showed the data table with headings Item, Row, Field, "Was, now", Proposed by, Decided by,
  Basis, File, When, a search box, the quick filters "Decisions 20", "Events 2", "Imports 1" and the View toggle.

## Closing note

What changed: the timed-build tooling is gone and every name says `inventory`; the app is `@inventory/app` in
`apps/inventory` of a bun + Turborepo workspace whose `check` replays from cache; the whole repository is on
beep-effect's profile, with two recorded exceptions in the app (stage C, ceiling 688, and stage D).

What was learned: Effect plugin override globs resolve from the app's folder, so per-package exceptions belong in the
package's own config; `plugins` does not merge through `extends`, hence the parity check; `deterministicKeys`
prefixes the scoped package name as written (`@inventory/app/server/...`); and the root tasks of a Turborepo hash the
whole root, so a stray tool-written file there defeats the cache.

Left for later goals: the vendored kit (`@beep/identity`, `@beep/schema`, `@beep/utils`), `@beep/csv`, the kernel and
drivers, the UI packages, the `access` and `catalog` contexts, `@beep/xlsx` and `@beep/infra`. The web lane's
fetch and JSON boundaries (`src/web/lib/http.ts`, `src/web/lib/json.ts`) are thin adapters that keep the old
Promise-shaped call sites; a later web package can call `HttpClient` and the Schema codecs directly and drop them.
