---
type: Goal
title: "UI packages"
description: The vendored components, their hooks, the theme and the shared screen pieces become @inventory/ui, and the review region with its saved progress becomes @inventory/review, with the app switched over after each one and a draft saved before the move still restored after it.
status: done
from: explorations/ideal-architecture
---

# UI packages

Step 6 of the order of work in [the ideal-architecture exploration](../../explorations/ideal-architecture/README.md).
The design is [BRIEF-ui-packages.md](../../explorations/ideal-architecture/BRIEF-ui-packages.md); its Sketch is the
specification. The schema rules are [docs/standards/schema-first.md](../../docs/standards/schema-first.md).

## Objective

`@inventory/ui` (`packages/ui`) holds the vendored components and hooks, the theme, the route, content-width,
text-width and JSON helpers and the shared screen pieces; `@inventory/review` (`packages/review`) holds the review
region and its saved progress, with `RowPlace` replacing the `out`/`kept` flags and the stored draft keeping its
bytes. Nothing in `apps/inventory/src/web/components/ui`, `components/review`, `hooks` or `lib/saved-progress` is left.

## Non-goals

From the brief's No-gos: no context packages, no `@inventory/client`; no change to what a screen shows; no new
`localStorage` version; no schema work on the region's props, rows, columns or words; the vendored kit untouched.

## Constraints

- The app keeps working at every commit: `items_messy.csv` (200 rows) imports to 155 stored, with the result screen,
  the Items table and the stored rows agreeing.
- Effect 4.1.4 only, every API checked in source; Effect collections only.
- The stage C ceilings of the app and the two packages add up to at most 678 and only fall.

## Acceptance

- [x] The four ui → app imports turned around (move 1, `2d4ff1b`): both folders are gone; `rg '@/lib' packages/ui/src` finds none.
- [x] `@inventory/ui` exists with exact exports, checked by `check-exports.mjs` in its `check` (133 entries, `18ef69e`).
- [x] The design lint runs and passes in the app, `packages/ui` and `packages/review` (each `lint`); a planted `text-red-500` is refused in the app and in the ui package, a raw `<button>` in a screen.
- [x] The production CSS holds `data-sticky` (`table.tsx`) and not `.pe-6` (only `tour.tsx`); 124,359 bytes before and after move 2.
- [x] `@inventory/review` exists (`ddfb75b`); `ReviewDecision.property.test.ts` covers the decision and saved-progress schemas (one file, not two); `DraftFormat.test.ts` decodes the captured draft and encodes it back to the same bytes.
- [x] `RowCards.tsx` is deleted.
- [x] `bun run check:full` and the build pass on the last commit; the ceilings are app 332, review 283, ui 52: 667.
- [x] Browser, after each package: the messy sample through Confirm, 200 rows read, result "Imported 155 · Not imported 45 · All 200", Items "155 items", D1 155 (PLAN).
- [x] Browser, after `@inventory/review`: the draft made before the move restored with its undo and redo, a refresh mid-review lost nothing, the same at 375 px (PLAN). Confirm clearing a draft was not re-checked.

## Decisions

[DECISIONS.md, "ui-packages brief"](../../explorations/ideal-architecture/DECISIONS.md).
