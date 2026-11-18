---
type: Standard
title: The app proposes, the person decides
description: No value changes silently; changes and agent actions are shown first, and the person accepts them.
tags: [import, review, ai]
status: draft
---

- **The app never changes a value silently.** A change to a value from the file (a unit, a date, a match) shows
  before and after and is imported only once the person accepts it, row by row or for all similar rows
  (`CLAUDE.md` "Rules for an import"). Check: a test that an imported value equals the file's value unless an
  accepted decision changed it.
- **Show what an agent would do before it does it**: on the real cells (`ProposedValue`) and in one bar with
  Accept, Step through and Dismiss. Accepting can be undone. Check: a screenshot shows a pending proposal and who
  made it.
- **One decision for a whole column.** Where one reading explains a column or the file (a date format, a unit
  spelling), the app proposes it once with counts from the file, before any question row by row, and lists the rows
  it does not explain. Check: the question appears once, with its counts, and every row it does not explain is shown
  for a look, none loaded silently.
- **Ask about the selection, not in a chat box.** Questions start from selected rows ("Why flagged?", "What would
  you do?") and the answer names them. Check: select two rows and ask; the answer names both.

## Also

- **A proposal is stated once**, as the heading directly above the rows it covers (that heading is the bar). Check:
  its sentence appears once on screen.
- **A button names its outcome** ("Use pcs for 9", "Import 136, skip 42"), never a bare Accept, Edit or Keep. Check:
  read every button.
- **Proposed, included and accepted look different**: an outlined chip with no colour, a tick that only includes a
  row in a fix, and the success tint only once the person has accepted. Check: before any click, no value or chip is
  in the success tint. (The filled button is the brand's forest green; it is a button, never a value's tint.)
- **Each kind of problem gets honest choices**: take the fix, pick another value, type one, or leave the rows out.
  Check: each kind offers at least two.
- **A pick with no default may still carry a suggestion**, said in words with its reason from the file ("40 L, as 6
  of 7 lines say (suggested)"), and never preselected: nothing is chosen until I choose. Check: before any click,
  no choice is selected, and each suggested one says "suggested" and why.
- **A clash is not a duplicate**: two different items sharing a SKU are called a clash. Check: the tag matches the
  rows.
- **Before import I can check what is left behind**: the confirm lists the held rows by reason, opens and downloads
  them, and says whether items are created or updated. Check: open it with rows held.
- **The app never invents a value**; a value the person picks from offered choices is not invented. (My coding
  agent's decision; I have not objected.) Check: every changed value comes from the file, a rule or the person.
- **Not decided by me yet**: whether a rule's fix of a known spelling may arrive applied (shown, counted, undoable).
  My coding agent's default is that it waits like any other proposal.
