---
type: Standard
title: The app shows it is working
description: Nothing blocks the screen, every press shows its result or its progress at once, a large file never freezes the page, and data already fetched shows without a wait.
tags: [ui]
status: draft
---

The person should never wonder whether the app heard them. Every state change is shown as it happens, in words they
can follow.

- **Every press answers at once**: the change itself when it can be shown before the server answers (an optimistic
  update, rolled back with a sentence if the server refuses), otherwise a spinner on the button pressed and a
  skeleton where a view is loading. Nothing waits behind a blank screen or a frozen page. Check: in the headless
  browser with the network throttled to Slow 4G, every press changes the screen within the same second.
- **A write of a value the person chose is optimistic; a write whose outcome the server decides shows its progress.**
  Optimistic, through `useOptimisticWrite` (`@/lib/optimistic`): the cache changes at once (`changes`, with an `undo`
  that takes out only this write's change, so a later write's stays), the request is retried only for a failure that may
  pass (`callWrite`), a refusal puts back what it changed and says why in a toast (`failed`, then the reason), with the
  person's words offered again (`retry`: "Edit again"), and the keys it touched are fetched again once the last write of
  its kind has answered. Copy the record editor (`src/web/pages/ItemEditor.tsx`: a record's values changed at once) or
  the People page's role change. Progress instead, on the button pressed: a take-back ("Taking back": only the server
  knows which records are still unchanged), an import's confirm (which rows it writes and which were already there).
  Showing a guess there first would show something false. Check: with the network throttled, saving an edit puts the new
  values in the Records table within the same second; an edit refused by the server (another person saved first) puts
  the row back and says why, with "Edit again".
- **A large file never freezes the page.** The file chooser closes as soon as a file is picked; the screen then says
  what is happening while the file is read and sent, with a progress bar, the counts ("Reading rows: 12,000 of 50,000")
  and a way to cancel. Choose the file on the Upload step (`src/web/pages/import/UploadStep.tsx`, `useUpload` from
  `@/lib/upload`): the file is read in a worker and sent in pieces, the screen shows its progress and Cancel, and
  nothing calls `readSpreadsheet` on the page's thread. Check: on Import, a 50,000-row file, scrolling and typing go on
  while it reads and saves.
- **A long step is shown step by step**, never one long wait with no word: reading, checking, saving, each with its
  count. Check: the result of each step appears as it finishes, not all at the end.
- **Data already fetched shows at once.** `queryClient` and `queryKeys` from `@/lib/queries`: data is fresh for 30 s,
  the session is fetched once (`sessionQuery`), a write invalidates the keys of what it changed, and its button is
  disabled while it is pending (the record editor's Save, `src/web/pages/ItemEditor.tsx`). Check: switch views twice;
  the network panel shows no second request for data that did not change.
- **Pressing twice does nothing twice.** A button is disabled while its request is pending, and the write names
  what it acts on (an upload's key, an edit's revision, an import still open), so the server writes a repeat once;
  a new write with nothing of its own sends one `requestId` per press (`newRequestId()` from `@/lib/api`). Check:
  double-click Confirm on the review; one confirm is stored and the second answers "already imported".
