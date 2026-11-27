---
type: Standard
title: One screen, few words
description: A review screen fits 1440 x 900 with no page scroll, at most 40 words outside the table, one filled button.
tags: [ui, review]
status: draft
---

I count scrolling and long text as defects: one makes the person remember, the other makes them slow.

- **At most 40 words outside the table** on a review screen. The title, grey line, bars, banners, and button and filter
  labels count; an open tour or expanded run log does not. Check: count them in the 1440 × 900 screenshot.
- **The page itself does not scroll at 1440 × 900.** The table scrolls in its own region with its header in view;
  totals and the confirm button stay on screen. Check: `document.documentElement.scrollHeight <= innerHeight` is
  `true`.
- **One filled primary button per screen** (`docs/ui.md` "UI"). Check:
  `document.querySelectorAll('[data-slot="button"][data-variant="default"]').length` is `1`.

## Also

Each is measured by script; the one-liners are in the `qa` agent.

- **Words** are everything visible outside the table and its dialogs, key hints and placeholders included; a bare
  number is not a word. **At most one sentence.** Check: the words one-liner.
- **At least 12 data rows in view** at 1440 × 900 when the review opens. Check: the rows one-liner.
- **The floor holds when each row is a parent** (an order, a recipe) with a reason. The levers: 36 px rows
  (`sticky-table`), the reason on one line with the whole sentence on hover or when the row opens, totals on one line
  beside the import button, the filters on the tab row. Check: the rows one-liner, with `data-row-id` on each row.
- **The table does not scroll sideways at 1440.** Check: the table one-liner.
- **While a decision is open, the filled button is that decision**; Import is outlined and names its outcome.
  Check: the filled-button one-liner.
- **The counts add up**: Needs you + Ready (+ Left out) = All; at the confirm, importing + not importing = rows in
  the file. Check: add them on the screenshot.
- **Counts mean what they sit on**: a tab's count is the number of rows its list shows, quantities of different
  items or units are never added into one total, and a number shown in two places is the same in both. Check: open
  each tab and count its rows; read every total for unlike items.
