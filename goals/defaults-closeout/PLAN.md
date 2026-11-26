---
type: Plan
title: Defaults close-out, plan
description: The steps that bring the rest of the defaults sweep to main, one pull request each, with where each stands.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. A step is done when its
pull request is merged, not when it is opened.

| # | Step | Branch | Status |
| --- | --- | --- | --- |
| 1 | The five rulings, and this packet | `fix/defaults-rulings` | doing: built and committed, `bun run check` 107 of 107; not seen on screen; pull request to open |
| 2 | The draft machine's failing property: reproduce on seed `-876652368938065`, then `-5255366521312007` | `fix/draft-property` | todo |
| 3 | A test of the facet filter on a table with rows | `test/facet-filter` | todo |
| 4 | `packages/review` src, 98 places in 7 files | `feat/defaults-review-src` | todo |
| 5 | `packages/review` tests, 12 places in 3 files | with step 4 | todo |
| 6 | `packages/catalog/web`, 21 places in 10 files | `feat/defaults-catalog-web` | todo |
| 7 | `packages/ui/src` 16, `apps/inventory` 8, the codecs 5, `packages/client` 2 | `feat/defaults-edges` | todo |
| 8 | Close: both goals' closing notes and `status: done`; the merged worktrees and branches removed | `docs/defaults-close` | todo |

Steps 2 and 3 need nothing from Benjamin and run first. Steps 4 to 7 put each undecided fallback and each exemption
candidate to him before the code that depends on it is written.

## Seen on screen

Nothing yet. Step 1's three screen changes wait on a second dev server (port 5174), which Benjamin allows each time.

## Blocker

None.

## Choices made along the way

- 2026-11-26. The stored change's `confidence` and a left-out row's `name` became optional on the wire, so absence
  is carried as absence. Stored columns are unchanged.
- 2026-11-26. A stored left-out row whose name cannot be read used to show as "nobody settled it". It now shows as
  left out by a person, name not recorded: the ruling's own consequence, noted because old rows read differently.
