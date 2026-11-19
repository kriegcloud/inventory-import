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
| 4 | `@inventory/review`; the app switched; proof with a draft from before the move | todo |
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
