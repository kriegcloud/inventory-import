---
type: Goal
title: Defaults close-out
description: Everything the defaults sweep left open reaches main, the five rulings of 2026-11-26, the failing draft property, a test of the facet filter on a real table and the last 162 places of the baseline, each through its own pull request.
status: active
from: explorations/ideal-architecture
---

# Defaults close-out

[Defaults at boundaries](../defaults-at-boundaries/SPEC.md) merged with work left over. This goal is that work, and
it is done when all of it is on `main`.

## Objective

1. **The five rulings of 2026-11-26 are on main and seen on screen.** An empty Quantity on hand box is refused; a
   decision nobody is recorded for reads "Not recorded"; a proposal with no confidence states none; every kind of
   problem says whether it can be fixed here; the import lists take one named query. Each is in the root
   `DECISIONS.md`.
2. **The draft machine's failing property passes for the right reason.** `Draft.machine.test.ts` fails on `main`
   with replay seed `-876652368938065`; a second seed, `-5255366521312007`, is unchecked. The defect is found from a
   reproduction, and the fix is to the machine or to the property, whichever is wrong.
3. **The facet filter is tested on a real table.** `ad798804` fixed the facet control losing its table; no test
   covers it.
4. **The defaults baseline names only edges.** 162 places in 34 files on 2026-11-26: `packages/review` 110 (98 in
   src, 12 in tests), `packages/catalog/web` 21, `packages/ui/src` 16, `apps/inventory` 8, the codecs under
   `packages/foundation/modeling` 5, `packages/client` 2. Every place moves onto a schema, or is an edge the law
   names in `exemptions` with Benjamin's word.

## Non-goals

- The bans' ledgers for the registry components (readonly, assertions, dual) and the strict ceilings. They fall on
  their own goals.
- The vendored kit, `packages/ui/src/components`, `packages/ui/src/hooks`, `vendor/alchemy`.
- Any stored data. A D1 column and a JSON column keep the form they are written in.

## Constraints

- Every rule of [the parent goal](../defaults-at-boundaries/SPEC.md) holds: an Option is unwrapped only at a screen's
  last step; a wire shape may change and stored data may not; the law fails only on a rise; an undecided fallback
  keeps its value on a schema and is put to Benjamin; a React component's own optional prop stays `?:`.
- Adding a file to `exemptions` is Benjamin's decision, put to him by dialog.
- The Verify lock is never updated to make a run pass. If a locked rule's text would change, stop and ask.
- One pull request per step of the plan. The agent pushes, opens it and sees it to mergeable: checks green, no
  unresolved comment. Benjamin merges.
- A change a person sees is looked at in the running app before its step is called done.

## Acceptance

- [ ] The rulings' pull request is merged, and each of the three screen changes was seen on screen: what was typed
      and what was read is in [PLAN](PLAN.md).
- [ ] `bun run --cwd packages/catalog/web test` passes with `Draft.machine.test.ts` replayed on both seeds, and PLAN
      says which of the machine and the property was wrong.
- [ ] A test in `packages/review/test` draws the facet control on a table with rows and fails on the commit before
      `ad798804`.
- [ ] `bun run beep laws defaults` passes and `defaults-baseline.json` holds no file, or only files `exemptions`
      names.
- [ ] `bun run check:full` passes on `main` after the last merge.
- [ ] The parent goal's `status` is `done`, with its closing note, and so is this one's.

## Decisions

Recorded in the root `DECISIONS.md` (product) and in
[the exploration's](../../explorations/ideal-architecture/DECISIONS.md) (architecture). Open on 2026-11-26:

- A fix with no confidence in the review region is offered as a one-press answer today. The ruling on stored
  proposals says "asked, never applied". Whether the region follows it is Benjamin's; the import always records a
  confidence, so no row reaches that path now.
