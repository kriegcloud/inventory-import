---
type: Standard
title: Every step can be undone
description: Every decision can be undone until Confirm, Confirm says what it will do, and a confirmed import can be taken back while its records are unchanged.
tags: [import, review]
status: draft
---

A mis-click never makes the person repeat work. Undo is the boundary of trust: up to Confirm everything can be
taken back; after it, the import can be taken back for as long as that is still true, and the screen says when it
stops being true.

- **Every decision can be undone until Confirm**, one step at a time, in the order it was made, also after a switch
  between views and after a refresh. The review region's "Undo last step" does this, and `useSavedProgress` keeps
  its history across a refresh. Check: make three decisions, switch views, press Ctrl+Shift+R, press Undo three
  times; the screen is as it was.
- **Confirm says what it will do** ("Import 149 items, skip 12"; `CLAUDE.md` "Rules for an import"). Check: read
  the button; its numbers match the counts on screen.
- **A confirmed import can be taken back while its records are unchanged**, in one step that leaves the stored records
  as they were before it. Once someone has changed one of them, the screen says so and why it can no longer be taken
  back ("2 of these records were edited after the import"). The take-back is one atomic write, recorded with who did it;
  a second press changes nothing; a viewer cannot do it and another organization cannot see it. The import's take-back
  is the worked example (`takeBack` in `src/server/Imports.ts`, the Result step). Check: import the sample, edit one
  record on the Records page, take the import back from its result: the others go, the edited one stays and is named,
  and the history's take-back line is read back from what is stored; import a file of one row, edit that record, and the
  result says the import can no longer be taken back.
- **No action that loses work goes without undo or a sentence first**: one that cannot be undone says what will be
  lost before it happens. Check: every button that removes or replaces something either has an undo or says what
  it removes.
