---
type: Plan
title: "UI packages, plan"
description: The steps of the ui-packages goal, their status, the current blocker and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`.

| # | Step | Status |
| --- | --- | --- |
| 1 | Decisions recorded; SPEC and PLAN | done |
| 2 | The four ui → app imports turned around | done |
| 3 | `@inventory/ui`; the app switched; proof | done |
| 4 | `@inventory/review`; the app switched; proof with a draft from before the move | done |
| 5 | Closing note | todo |

## Current blocker

None.

## Choices made

- **Move 1 put the five modules in `src/web/ui-kit/`** (`2d4ff1b`), the folder that became the package's `src/` in
  move 2; `lib/route.ts` keeps only `importAddress`. Two files the test project compiles without the `@` alias
  (`pages/import/cellDrafts.ts`, `itemText.ts`) import `ui-kit/Json.codec.ts` by relative path until it moved.
- **`@inventory/ui` owns the Tailwind entry.** `theme.css` starts with `@import "tailwindcss" source(none)`, so the
  design lint (which looks for a stylesheet importing Tailwind through `components.json`) reads the tokens from the
  package; the app's `index.css` is `@import "@inventory/ui/theme.css"` and its `@source` lines.
- **The production CSS walk follows package exports.** `reachableSources` takes `packages` (name to folder) and
  resolves an exact export to its file; `usedSourcesOnly` drops the packages' whole-folder `@source` lines. Built CSS
  before and after: 124,359 bytes both; the entry chunk 260,985 → 261,059 bytes. `.pe-6`, used only by `tour.tsx`, is
  absent; `data-sticky` (`table.tsx`) is present.
- **One lint config per kind, at the root.** `.oxlintrc.web.json` (the app's rules, extended by the app's and the ui
  package's `.oxlintrc.json`, the latter ignoring the vendored files) and `.oxlintrc.shadcn.json` (`ui` is
  `@inventory/ui/components`; the vendored relaxations match `packages/ui/src/components/**`). Proved by planting
  `text-red-500` in `Code.component.tsx` and in `SignIn.tsx` (both refused) and a raw `<button>` in a screen (refused).
- **`scripts/check-strict.mjs` moved to the root** and reads the package's `strict-ceiling.json` (`project`, `own`,
  `vendored`, `rules`, `ceiling`); `scripts/check-ceilings.mjs` (`//#ceilings:check`) keeps the sum at most 678.
  After move 2: app 608, ui 52, sum 660 (the six hooks' 14 left by exemption; the moved own pieces counted 52, not 57).
- **`scripts/check-exports.mjs`**: 133 exact entries in `@inventory/ui`.
- **Proof of move 2**: check:full 35/35 tasks; browser on port 5200: the messy sample, "Import 155, skip 45", the
  confirm dialog "Import 155 items", result "Imported 155 · Not imported 45 · All 200", Items "155 items", D1 `item`
  155 rows.
- **Two subpaths for saved progress.** An exact export names one file, so the schemas are `./SavedProgress`
  (`SavedProgress.schema.ts`) and the hook `./SavedProgressHook` (`SavedProgress.hook.ts`); the brief had both under
  `./SavedProgress`. `useSavedProgress(scope, runtime)` takes the app's `browserRuntime`.
- **`RowKey` and `ColumnKey` are bounded text, not brands**: the region keys its maps and props by the ids the
  screen hands it, and a brand would make every one a cast.
- **`ReviewDecision` is the region's decision** (`RowPlace`: open, kept, left out remembering a keep); every
  reducer branch builds one with `ReviewDecision.make`. `ReviewDecisionFromFlags` stores it as the old flags; an
  empty list is left out on write, as the screen always wrote it. The import screen's adapter converts between the
  region's union and the server's flags (`toRegionDecisions`, `toServerDecisions`) until the server's `RowDecision`
  becomes the same union in the goal contexts.
- **`StoredFile.size` is a `ByteSize`**, whose generated values include sizes the stored number cannot hold; the
  round-trip property is asked of sizes a `File` can have (an `Arbitrary.filter`), recorded here as the one gap in
  SF-7.
- **The gallery fixtures** (`fabrication.ts`, `jobs.ts`) are in `packages/review/test/fixtures`, counted in the
  package's ceiling (stage C extends to them); the app's development gallery and two app tests import them, and the
  region's internal `sizing.ts`, by path, so the app's stage C override also names those paths.
- **The captured draft** is `test/fixtures/draft-before-the-move.txt`: the exact `localStorage` text the build
  before the move wrote (two fixes accepted, two rows left out and undone), `.txt` so the formatter leaves its bytes.
- **Ceilings after move 3**: app 332, review 283, ui 52, sum 667 of 678. The review's count is above the brief's 234
  because the gallery fixtures came with it.
- **Proof of move 3**: check:full 38/38 tasks (review 74 tests, app 158 fast and 45 slow). Browser on port 5200, the
  same browser profile as the draft made before the move: the review of that import opened with "Undo: 2 fixes
  accepted" and "Redo: 2 rows left out"; Redo, then a hard refresh: "Undo: 2 rows left out", "Left out 2"; Undo, and
  at 375 px the queue shows "Undo: 2 fixes accepted" and "Redo: 2 rows left out". Not re-checked here: Confirm
  clearing a draft (the import holding this draft has no ready rows left).
