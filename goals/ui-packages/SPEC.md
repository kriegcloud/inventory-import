---
type: Goal
title: "UI packages"
description: The vendored components, their hooks, the theme and the shared screen pieces become @inventory/ui, and the review region with its saved progress becomes @inventory/review, with the app switched over after each one and a draft saved before the move still restored after it.
status: active
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

- [ ] The four ui → app imports turned around (move 1): `rg '@/lib' apps/inventory/src/web/components/ui apps/inventory/src/web/hooks` finds none.
- [ ] `@inventory/ui` exists with exact exports, checked by `check-exports.mjs` in its `check`.
- [ ] `lint:shadcn` runs and passes in the app, `packages/ui` and `packages/review`.
- [ ] The production CSS holds a class used only in a vendored component a screen loads, and no class of `tour.tsx`.
- [ ] `@inventory/review` exists; `ReviewDecision.property.test.ts` and `SavedProgress.property.test.ts` pass; a draft captured before the move decodes and encodes back to the same bytes.
- [ ] `RowCards.tsx` is deleted.
- [ ] `bun run check:full` and the build pass on the last commit; the ceilings' sum is at most 678.
- [ ] Browser, after each package: the messy sample through Confirm with the three numbers agreeing on 155.
- [ ] Browser, after `@inventory/review`: a draft made on the build before the move restored, undo and redo, a refresh mid-review losing nothing, the same at phone width.

## Decisions

[DECISIONS.md, "ui-packages brief"](../../explorations/ideal-architecture/DECISIONS.md).
