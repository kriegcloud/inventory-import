---
type: Plan
title: Defaults close-out, plan
description: The steps that bring the rest of the defaults sweep to main, one pull request each, with where each stands.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. A step is done when its
pull request is merged, not when it is opened.

| # | Step | Pull request | Status |
| --- | --- | --- | --- |
| 1 | The five rulings, and this packet | 17 | done: merged 2026-11-26 |
| 2 | The draft machine's failing property | 19 | done: merged 2026-11-26. The machine was wrong in both orderings, not the property (below) |
| 3 | A test of the facet filter on a table with rows | 18 | done: merged 2026-11-26 |
| 4, 5 | `packages/review` src and tests: 110 places to 64 | 21 | done: merged 2026-11-26 |
| 6, 7 | Outside the review package: 48 places to 36 | 20 | done: merged 2026-11-26 |
| 7b | What was left, 104 places in 30 files, by Benjamin's rulings of 2026-11-26 (below): the baseline names no file | 22 | doing: open, `bun run check` 107 of 107, seen on screen (below) |
| 8 | Close: both goals' closing notes and `status: done`; `bun run check:full` on main; the merged worktrees and branches removed | | todo: after 22 is merged |

## The failing property (step 2)

Both seeds failed one check: a row only this tab wrote was shown as "decided since by someone else or another tab".
The machine was wrong twice over, and the test's world was right. After somebody else's confirm the waiting rows
were let go together with what their sends might already have stored; and a line compared a remembered decision
exactly, though a match may leave only part of it. Both seeds are replayed in the suite.

## Rulings of 2026-11-26 on what is left (step 7b)

- A React component checking its own optional prop in its body (`props.line === undefined`): the law stops counting
  it. `??` in a body stays refused. 34 places.
- The tests' stand-in for the browser's storage (`kept[key] ?? null`): one shared file, on the exemptions list. 10
  places in 8 files.
- Another library handing back nothing (the table, the virtual list, an atom's first read of itself, a portal
  target, the Web Locks default): each behind a small adapter file of ours, and only those files exempted. About 17
  places in 5 files.
- The three public APIs that run `Effect.runSync` (`stringify`, the one Reactivity, the workbook writer): their three
  files on the exemptions list. 3 places.
- `TotalCells.text` returns an Option, and the screen decides at its last step. 1 place.
- The four starting values the lane kept (`CountStart`, `FacetStart`, and in test support `TabIdentity` and
  `WriterStart`): ratified as they were.
- A lane may lower a strict ceiling: the earlier lanes put seven good moves back because they were told not to.

## Seen on screen

2026-11-26, on the branch of pull request 21 (main with the review lane), a fresh database, port 5174, signed in as
Dana Whitfield.

- Pressed "Use items_messy.csv". The page reloaded once (the dev server's first build of the reader) and showed
  "Stopped before it was saved"; pressed Continue. Review read: "200 rows read · 20 values fixed for you", Needs a
  decision 24, Cannot import 21, Ready 155, All 200.
- Pressed "Import 155, skip 45", then "Import 155 items". Result read: Not imported 45, Imported 155, Already there
  0, All 200. The Items page read "155 items".
- Items, "Edit Brass Washer M6": cleared Qty on hand (it read 2455), pressed Save. The dialog stayed open, the box
  was marked, and it read "Quantity on hand is empty. Write it as digits, for example 120, or 0 when there is
  none." Closed it: the row still read 2,455 BX.
- "Fix 45 not imported": Review read Needs a decision 24, Cannot import 21, Ready 0, Already there 155, All 200.
  Pressed "Accept for the 2 ticked" (SKU, rows 148 and 195): the undo button read "Undo: 2 fixes accepted" and both
  rows still waited, as decided for them. Pressed "Leave out 3": Needs a decision 21, Left out 3. Undo twice:
  Needs a decision 24 again.
- Not seen on screen: "Not recorded" and a suggestion with no confidence. A fresh import records an author and a
  confidence for every decision, so neither can be reached without a row edited by hand.

2026-11-26, on the branch of pull request 22 (the adapters and the Option reader), a fresh database, port 5174,
signed in as Dana Whitfield. No error in the browser's console.

- Pressed "Use items_messy.csv". It read "Stopped before it was saved" again, as on the first look; pressed
  Continue. The steps sat in the top bar beside the breadcrumb. Review read: "200 rows read · 20 values fixed for
  you", Needs a decision 24, Cannot import 21, Ready 155, All 200.
- Pressed "All 200": row 2 read "Fiberglass Crate, XRR-0266, Ready", row 4 "Oak Cutting Oil, YDR-8742, SKU clash
  row 10". Pressed the Category filter: Component 1, components 38, Finished Good 2, finished-goods 29, Misc 2,
  packaging 34, raw-materials 44, supplies 50, which add to 200. Picked "Misc 2": two rows, 40 Steel Planter and
  116 Rubber Sheet 4x8.
- Pressed "Import 155, skip 45", then "Import 155 items". Result read: Not imported 45, Imported 155, Already there
  0, All 200. The Items page read "155 items", 20 rows, "Page 1 of 8".
- Activity read Decisions 20, Events 2, Imports 1. People read "3 people", and its Role filter Admin 1, Editor 1,
  Viewer 1.
- Not seen on screen: a column a row does not hold, the case the reader's None is for. No file reaches it.

## Blocker

None.

## Choices made along the way

- 2026-11-26. "Use items_messy.csv" on a dev server just started read "Stopped before it was saved" on both looks,
  and Continue went on. Not diagnosed: it may be the dev server's first build of the reader, or a defect in the
  sample's first press. Somebody should press it on a production build before this is called nothing.

- 2026-11-26. The stored change's `confidence` and a left-out row's `name` became optional on the wire, so absence
  is carried as absence. Stored columns are unchanged.
- 2026-11-26. A stored left-out row whose name cannot be read used to show as "nobody settled it". It now shows as
  left out by a person, name not recorded: the ruling's own consequence, noted because old rows read differently.
