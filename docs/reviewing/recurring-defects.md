---
type: Lesson
title: Recurring defects on a review screen
description: Defects a review screen tends to have, each with the check that catches it.
tags: [ui, review, qa]
status: draft
---

Look here before calling a screen done.

| Defect | The check that catches it |
| --- | --- |
| A header or a name cut off ("C…" for Cost) beside a column with nothing in it | 1440 screenshot: no "…" in a header or name while any column is empty; hide the empty column |
| The same proposal stated three times: group heading, every row, the reason popover | Its sentence appears once; the popover adds evidence, not the same words |
| An accept button in the same tint as the proposed value, so it reads as a value | Only an accepted value is in the success tint; no button shares a value's tint |
| A proposal that looks accepted: green values and ticked rows before anyone chose | Before any click, no value is in the success tint and no guess row is ticked |
| The strongest button is the last step: Import filled while decisions are open | The filled-button one-liner returns the decision |
| A busy toolbar: many controls in mixed styles | Facts ("10 columns matched") are text, not buttons; one control height |
| Counts that do not reconcile ("Decision 1 of 32" beside "Needs you 42") | Add every count on the screenshot; one word per set |
| A reason popover that covers the rows it explains and has no actions | Open it: its rows stay visible and it ends with the choices |
| Empty space where the evidence should be (half the phone blank, "and 7 more") | Every row a decision covers is listed, old → new |
| Bare verbs ("Edit", "Keep") and an unexplained icon (a sparkle) | Every button names its outcome; a guess says "Guess" |
| A sideways scrollbar inside the table at 1440 | The table one-liner is `true` |
| A phone card wider than the screen while the page-level check passed | The edges one-liner at 390 returns `[]` |

## Ideas that do not work, and why

- **Invented values** ("-8 → 0", "last price from the supplier", "a name from the SKU"): the app never invents a value;
  it offers choices, a field to type in, or leaving the row out.
- **A sparkle alone to mark a model's value**: people cannot tell what it means; it always comes with the word "Guess".
- **A dashed box for a proposed value**: it reads as an empty input; use an outlined chip beside the struck old
  value.
