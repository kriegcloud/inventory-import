---
type: Standard
title: The phone gets its own design
description: Below 768 px the review is an approval flow, one decision at a time, not a squeezed table.
tags: [ui, review]
status: draft
---

On a phone I want an approval flow, not a table to read.

- **Below 768 px, one item at a time**: a card with the row's name, the problem or the proposed change (before and
  after), its reason, Accept and Reject in thumb reach, and a count ("3 of 7"). It opens on what needs attention.
- **Same decisions, same rules**: the same review function and saved progress as the desktop; only the layout
  differs.
- Check: at 390 × 844 the QA screenshot shows a card, not a table;
  `document.documentElement.scrollWidth <= innerWidth` is `true`; every flagged row can be decided by tapping.

## Also

- **The decision is the filled button**; Import stays outlined while a decision is open. Check: the filled-button
  one-liner at 390 returns the decision.
- **The card lists every row it covers**, each with old → new, not "and 7 more". Check: the rows listed match the
  card's count.
- **One counter**: "Decision 3 of 14" on top, the number of rows on the card. Check: the numbers add up.
- **Tap targets are at least 44 px high.** Check: each card button's `getBoundingClientRect().height >= 44`.
- **Nothing reaches past the screen's edge, measured element by element.** A card clipped by its parent passes the
  page-level check above. Check: the edges one-liner returns `[]`.
