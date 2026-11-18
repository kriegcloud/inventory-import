---
type: Standard
title: Leaving is safe
description: A hard refresh, a closed tab or a mis-click never makes the person repeat work, and they resume where they stopped.
tags: [ui, import, review]
status: stable
---

- **A hard refresh does not lose work.** The step is in the URL (`?step=`) and each decision is saved when it is
  made, not on Confirm. `useSavedProgress(scope)` from `@/lib/saved-progress` keeps the chosen file until the
  server has it and the review's undo history beside the decisions the server keeps, for the acting member and
  organization ([the kit](../kit.md), "Saved progress"); `progress.clear()` on Import. Check: on Import, the sample
  file, three decisions in Review, Ctrl+Shift+R, the three are there and Undo takes back the last.
- **Coming back resumes**: reopening the app offers to continue ("2 of 7 decided") or to start again. In the starter
  the Upload step lists the open imports, each with Continue and Remove, and a file that stopped before the server
  had it offers Continue; the "2 of 7 decided" count is not built. Check: close the tab and reopen the URL.
- **Saved progress is a draft**: nothing reaches the imported records before Confirm. Check: after the refresh test,
  the record count has not changed.
- **Nothing is lost to a mistake either**: a mis-click is undone, not repeated ([undo](undo.md)), and a refused save
  keeps what the person typed. Check: make a save fail (stop the dev server); the typed value is still there.
