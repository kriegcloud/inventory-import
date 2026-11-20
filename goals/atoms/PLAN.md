---
type: Plan
title: "Atoms, plan"
description: The steps of the atoms goal, their status, the hook count before and after, the hand-written discriminators to turn into tagged enums or tagged unions, and the choices made along the way.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. The steps are the brief's
"Order of moves"; each ends with `bun run check:full` and a browser pass on a fresh database, and leaves the app working.

| # | Step | Status |
| --- | --- | --- |
| 1 | `@effect/atom-react` 4.1.4; a `RegistryProvider` at the root beside the query client; the lint written; the test of two writes in flight | done |
| 2 | `@inventory/client`: the runtime, the API atoms with typed failures, the optimistic write as an atom, `member` | done |
| 3 | `@inventory/access-web`: the session (`actor`), sign-in, People, the audit events | done |
| 4 | The app's shell: the content width, the development sign-in, the Activity page | done |
| 5 | `@inventory/ui`'s own pieces: the theme, the table search, content width, the run log | done |
| 6 | `@inventory/catalog-web`: the upload, the Items page and its editor, the assistant, the import's steps | done |
| 7 | `@inventory/review`: the region's state with undo, saved progress, the grid, the queue; the A6 remodel | done |
| 8 | TanStack Query removed (A2); the lint everywhere; the documents the move made false | done |

## The hook count

Counted with one pattern per hook (a call, with or without `React.`), as the brief's inventory. "ui-own" is
`packages/ui/src` without `components/` and `hooks/`. The table below is the brief's, whose pattern missed a call
written with a type argument (`useState<T>(`); the lines after it for steps 6 and 7 count those too
(`\buseX\s*[<(]`), which is why their starting numbers are a little higher than the table's.

Before, at `9b6418f` (the same numbers as the brief's table):

| Hook | app | catalog-web | access-web | client | review | ui-own |
| --- | --- | --- | --- | --- | --- | --- |
| `useEffect` | 1 | 6 | 0 | 0 | 9 | 4 |
| `useLayoutEffect` | 1 | 0 | 0 | 0 | 2 | 0 |
| `useState` | 7 | 23 | 9 | 0 | 22 | 4 |
| `useMemo` | 3 | 10 | 0 | 1 | 27 | 4 |
| `useCallback` | 2 | 8 | 0 | 0 | 11 | 0 |
| `useRef` | 0 | 10 | 0 | 0 | 24 | 2 |
| `useContext` | 0 | 1 | 0 | 2 | 1 | 1 |
| `useSyncExternalStore` | 0 | 1 | 0 | 0 | 0 | 3 |
| `useImperativeHandle` | 0 | 0 | 0 | 0 | 1 | 0 |
| `useQuery`, `useMutation`, `useQueryClient` | 0 | 20 | 8 | 2 | 0 | 0 |

`@tanstack/react-query` is imported in 16 files.

After each package, the same count:

- **After step 2 (`client`)**: unchanged in every column. The client gains its atoms; its React and TanStack Query
  forms stay until their callers move ("Legacy in the client"). The two `useAtomValue` hits in `client` are examples
  in the new files' comments.
- **After step 3 (`access-web`)**: `access-web` holds no banned hook: `useState` 9 → 0, `useQuery` 3 → 0,
  `useMutation` 3 → 0, `useQueryClient` 2 → 0, `useApi` 1 → 0; it keeps `useId` (4) and calls the atom hooks
  (`useAtomValue` 8, `useAtom` 10, `useAtomSet` 7, `useAtomRefresh` 3). `client`: `useMemo` 1 → 0 and `useContext`
  2 → 1 (`useApi` and its context went). `@tanstack/react-query` is imported in 12 files (16 before). The access-web
  strict ceiling fell from 17 to 14 (sum 654).
- **After step 4 (the app's shell)**: the app's `src/web` holds no banned hook: `useEffect` 1 → 0, `useLayoutEffect`
  1 → 0, `useState` 7 → 0, `useMemo` 3 → 0, `useCallback` 2 → 0, `useActor` 6 → 0 (the galleries' state included).
  It calls `useAtomValue` 11, `useAtom` 8, `useAtomSet` 2, `useAtomMount` 1, `useAtomRefresh` 2, and still `ui`'s own
  `useContentBelow`, `useIsNarrow`, `useTheme` and `useLocation` (step 5) and the catalog's query hooks (step 6). The
  app's strict ceiling fell from 38 to 37 (sum 653); access-web's two stand-in hooks went.
- **After step 5 (`ui`'s own pieces)**: `useEffect` 4 → 0, `useState` 4 → 0, `useMemo` 4 → 0, `useContext` 1 → 0,
  `useSyncExternalStore` 3 → 0, `useRef` 2 → 1 (the search field's element, for the caret after the cross); `useId` 1
  (each search box's own atom). The app's `src/web` now reads the ui atoms directly (`useAtomValue` 11 → 17). The ui
  strict ceiling fell from 52 to 51 (sum 652). The run log (`AgentRun`) held no hook.
- **After step 6 (`catalog-web`)**: `catalog-web` holds no banned hook: `useEffect` 6 → 0, `useState` 24 → 0,
  `useMemo` 10 → 0, `useCallback` 8 → 0, `useContext` 1 → 0, `useSyncExternalStore` 1 → 0, and TanStack Query's
  20 → 0. `useRef` 11 → 2, both DOM nodes (the assistant's prompt field, the upload's picker). It keeps `useId` (14:
  11 field ids in the item editor, 2 that key a cell form's atom, 1 in the sheet chooser) and `useDeferredValue` (1:
  the Review step draws its skeleton first, then the region) and calls `useAtomValue` 34, `useAtom` 8, `useAtomSet` 14,
  `useAtomRefresh` 4, `useAtomMount` 1. `client` now holds no React hook at all (`useContext` 1 → 0: `useMember` went),
  and the app's `src/web` none either. `@tanstack/react-query` is imported in 2 files (the app's `main.tsx` and the
  client's `QueryClient.runtime.ts`), both for step 8. Strict ceilings: `catalog-web` 245 → 240, `client` 22 → 20
  (sum 645).
- **After step 7 (`review`)**: `review` holds no banned hook: `useEffect` 9 → 0, `useLayoutEffect` 2 → 0, `useState`
  27 → 0, `useMemo` 28 → 0, `useCallback` 11 → 0, `useContext` 1 → 0, `useImperativeHandle` 1 → 0. `useRef` 25 → 4,
  each a DOM node (the import button and the activity button for focus to return to, an overlay's trigger, the grid's
  scrolling frame, which the virtual list reads). It keeps `useId` (7: each region, grid, queue, strip, overlay, cut
  text and edit form has its own atom), the vendored `useDataTable` and TanStack Virtual's `useVirtualizer` (A4), and
  calls `useAtomValue` 5, `useAtom` 7, `useAtomSet` 2, `useAtomMount` 1. Every web package and the app's `src/web`
  now hold no banned hook; `@tanstack/react-query` is still imported in 2 files, for step 8. The review's strict
  ceiling fell from 283 to 282 (sum 644).
- **After the rework and its two reviews** (counted at `a9d9b63`): `review` keeps `useId` 3 (the region's section
  and its title, an overlay), `useRef` 4 (each a DOM node), the vendored `useDataTable` and `useVirtualizer`, and
  calls `useAtomValue` 69, `useAtom` 4, `useAtomSet` 2, `useAtomMount` 2, `useAtomSubscribe` 5. `ui`'s own pieces:
  `useId` 1 (the search field's id), no `useRef`, `useAtomValue` 17, `useAtomSet` 1, `useAtomMount` 3.
  `catalog-web`: `useId` 14, `useRef` 2, `useDeferredValue` 1, `useAtomValue` 39, `useAtom` 9, `useAtomSet` 14,
  `useAtomMount` 2, `useAtomSubscribe` 1, `useAtomRefresh` 3. Strict ceilings now: `review` 259, `catalog-web` 228,
  `ui` 50, `client` 20, `access-web` 14, the app 37 (sum 608). They were 281, 230 and 633 for `review`, `catalog-web`
  and the sum before that rework; after the batch of 2026-11-20 (below) they are `review` 251, `catalog-web` 226 and
  the sum 598.
- **After step 8**: `@tanstack/react-query` is imported in no file, declared by no package and absent from the
  lockfile. `git grep "@tanstack/react-query"` outside `goals/` and `explorations/` finds two lines, both the atoms
  lint's own refusal of it (`.oxlintrc.atoms.json`). The hook count is the one above: step 8 held no hook.

## Proof

**Step 2, `client`.** `bun run check` (74 tasks) and `bun run check:full` (76 tasks) pass. The client's tests: two
optimistic edits in flight (both shown at once, both kept, one refresh), one refused beside one saved (the server's
word, one refresh), both refused (back to the start, no refresh), and the previous page's rows kept, waiting, until
the next page has come. The lint refuses, on a planted file in `packages/client/src`, `import { useEffect } from
"react"`, `import * as React from "react"`, `import React from "react"`, a renamed `useState` and
`@tanstack/react-query`.

Browser, on a fresh database (`bun run db:reset`), the dev server on port 5220, the headless browser:

- Signed in by itself as Dana Whitfield, Example Works (test); the Upload step drawn, the console empty.
- "Use items_messy.csv": Review reads "200 rows read · 20 values fixed for you", Needs a decision 24, Cannot import
  21, Ready 155, All 200, the button "Import 155, skip 45".
- Pressed "Accept for the 2 ticked" on the SKU group: Undo appeared; pressed Undo: the accept button came back and
  Redo read "2 fixes accepted"; pressed Redo: Undo read "2 fixes accepted". Refreshed the page: still "Undo: 2 fixes
  accepted".
- Confirm: the dialog read "Import 155 items?" with Needs a decision 24 and Cannot import 21 not imported; pressed
  "Import 155 items". The result read "Not imported 45 · Imported 155 · Already there 0 · All 200". D1 holds 155 items
  for `org_prairie`. The three numbers: 200, 155, 155.
- Items: "155 items"; next page: `?page=2`, its first row Steel Storage Bin; typed "oak": "23 of 155 items, best
  matches first", every name an Oak; refreshed on `?search=oak&page=2`: the same line, three rows.
- Edited Brass Washer M6 twice in a row: Qty on hand 2455 to 2456, saved, the row read "2,456 BX"; Unit cost 26.99
  to 27.50, saved, the row read "$27.50" and "2,456 BX". The two saves were one after the other, not both in flight:
  that case is the test's.
- Dark theme: the page's background rgb(9, 9, 11), a cell's text rgb(250, 250, 250). At 375 px wide in dark: the
  Items list as cards, "155 items", the edited row's values, no sideways scroll (the page 375 px wide).
- Signed in as Elena Sokolova from the menu: Sample Supply Co. (test), its Items page "0 items". Signed out: the
  sign-in page. Signed in as Dana Whitfield from its test accounts: back in Example Works (test).
- The console over the whole session: 32 messages, no error and no warning.

Not seen: nothing on screen reads an atom yet, so this pass shows that the registry at the root and the shared
runtime broke nothing, not that an atom draws anything. Not tried in this step: the assistant, a take-back, People,
Activity, a 50,000-row file.

Seen in passing: the search "oak" lists Oak Washer M6 and Oak Pellets on page 1 and again on page 2. Not a defect: D1
holds two of each name with different SKUs (page 2's are UHR-5946 and WDA-5965).

**Step 3, `access-web`.** `bun run check` (74 tasks) and `bun run check:full` (76 tasks) pass. New client tests: a
switch of organization shows nothing of the previous one's answer, then the new one's; a key said to have changed from
outside the atoms makes a read registered under it ask again, and an unrelated key does not.

Browser, on a fresh database, the dev server on port 5220, the headless browser:

- The sign-in page (this tab had signed out before): typed Dana's email and a wrong password, pressed Enter: "Invalid
  email or password" under the form. Typed the right one: People, "Example Works (test) · 3 people".
- Changed Marcus Oyelaran from Editor to Viewer: Viewer at once, still Viewer after the answer; D1 holds `viewer`.
- Changed Dana Whitfield (the only admin) to Viewer: put back to Admin, with the toast "That did not work / Dana
  Whitfield's role was not changed. Dana Whitfield is the only admin of Example Works (test). Make someone else an
  admin first."
- Add a person, "  Nobody@Example.test ": "Not added: Nobody has signed up with nobody@example.test yet. Ask them to
  create an account, then add them here." Then `elena@sample-supply.test`: the toast "Elena Sokolova added as
  editor", the dialog closed, "4 people". Opened again: empty. Removed Elena: "3 people" at once and after.
- Activity, Events: 3 lines, newest first: Removed a person, Added a person, Changed a role.
- Through the sidebar's links (one page load the whole time): Import, `items_messy.csv`, Import 155 items, then
  Activity about five seconds after leaving it: Events 3 → 5 (the upload and the import), Decisions 20, Imports 1.
  The audit trail was still kept (within 30 s), so the new lines came from the catalog screens' invalidation reaching
  the atom, not from a fresh read.
- Switched to Sample Supply Co. (test) on People: "Sample Supply Co. (test) · 3 people" (Dana Whitfield, Elena
  Sokolova, Tom Becker), as a Viewer: no Add, no role menus, no Remove; Items "0 items". Switched back: Example Works
  (test), Admin; Activity Decisions 20, Events 5, Imports 1. The moment between was too short to see at a 100 ms
  sampling; the test above holds it.
- People at 375 px in dark: cards, Marcus Viewer, no sideways scroll. Signed out: the sign-in page; "Sign in as
  Marcus Oyelaran" there: signed in as him, Example Works (test), Viewer.
- The console over the session: 50 messages; the only errors are the two refusals tried on purpose (the 401 of the
  wrong password, the 409 of the last admin).

Not seen in this step: the development sign-in on a fresh tab (it moves with the app's shell, step 4), creating an
account or an organization, a role change shown as saving (the answer came too fast to see it).

**Benjamin's two answers, in the client** (after step 3). Client tests: a refused edit beside another in flight is
taken back at once and the other keeps showing; a return to a screen shows its rows at once, marked waiting, then the
fresh ones. Browser, fresh database: People, then Items, then People again through the sidebar, sampled every 10 ms.
After 3 s away: the 3 rows at 62 ms with the search box's spinner "Updating", the fresh rows at 92 ms, no skeleton.
After 45 s away: the rows and "Updating" at 131 ms, fresh at 665 ms, no skeleton. The first try at 35 s showed the
skeleton: `Atom.family` held the per-member reads weakly, so after a garbage collection a return made a new, empty
read; they are now held in a `MutableHashMap`, and the 45 s look above is after that change. Dana (the only admin) to
Viewer: Admin again with the toast (the refusal came back within 50 ms, too fast to see Viewer); Priya to Editor held.
The garbage collection is not reproduced by a test (a test cannot force one); the browser look is the proof.

**Step 4, the app's shell.** `bun run check` (74 tasks) and `bun run check:full` (76 tasks) pass. The app's lint
refuses a planted `useState`; `main.tsx` alone is excepted (below).

Browser, on a fresh database, a new browser context (never signed out), the dev server on port 5220:

- Opened `/`: signed in by itself as Dana Whitfield, Example Works (test), Admin; the requests were one session read,
  one sign-in, one session read; no console error or warning.
- At 1000 px wide on People: the sidebar open, the page 744 px wide and drawn as cards; folded, 952 px and a table of
  3 rows, the cookie `sidebar_state=false`; reloaded: still folded, still the table; opened again: cards.
- At 1440 px: the messy sample; the import's steps drawn in the bar's slot ("3 Review 4"); "200 rows read"; Import
  155 items; the result "Not imported 45 · Imported 155 · Already there 0 · All 200"; D1 155. The three numbers:
  200, 155, 155.
- Activity: opened on Decisions 20; Events 2 (the import and the upload); Imports 1 (items_messy.csv, 155, 45, 200).
- Switched to Sample Supply Co. (test): Viewer, the breadcrumb "Sample Supply Co. (test) / Activity", Decisions 0,
  Events 0, Imports 0, the "Switching to" toast gone; switched back: Decisions 20.
- Dark at 375 px: Activity as cards, no sideways scroll, the sidebar a closed drawer; opened it: the drawer over the
  page (375 px), with the organization, the four pages and the person. Signed out from it: the sign-in page, and no
  sign-in sent after the reload (this tab signed out). Console: 12 messages, no error or warning.
- The development galleries: `/gallery/review?state=stored`: Needs a decision 59, Ready 119, Already there 3, All
  181; chose "Records with a parent" from its menu: the address `?state=parent`, Jobs 24, Questions 9; "Leave job
  J-2042 out" from a question's other answers: Questions 8. The gallery logs a warning that the preloaded session
  answer was not used (the gallery never asks for it; not checked whether main logs the same).

Not seen: the development sign-in failing; creating an organization.

**The reset, in the client** (after step 4). Client tests: 17 pass, the two new ones above among them. Browser, fresh
database, a new browser context: People, then Items for 45 s, then People again: the 3 rows and "Updating" at 101 ms,
fresh at 365 ms, no skeleton (the keep now being the client's hold). Signed out, then "Sign in as Marcus Oyelaran" on
the same tab, then People sampled every 10 ms: nothing, the page's skeleton (its 24 placeholder rows), then his own
view (3 people, no role menus, no Add: he is an Editor); no admin control of Dana's at any sample. Console: no error
or warning. The sign-out reloads the page, so in the browser `forgetReads` and the reload drop the same things; the
test holds `forgetReads` without the reload.

**Step 5, `ui`'s own pieces.** `bun run check` (74 tasks) and `bun run check:full` (76 tasks) pass; the ui lint
refuses a planted `useEffect`.

Browser, on a fresh database, a new browser context, the dev server on port 5220:

- Theme: the bar's button turned the page dark, `localStorage` "theme" = `dark` (the bare word the pre-paint script
  reads), the bar colour `#09090b`; reloaded: still dark. Chose System with the device light: no `dark` class, stored
  `system`; the device switched to dark: the `dark` class and `#09090b`, with no reload.
- The address: the messy sample through Confirm ("Not imported 45 · Imported 155 · Already there 0 · All 200"); Back
  from the result: `step=review` in the address, the page still on the result ("Imported items_messy.csv": a confirmed
  import shows its result whatever the step, `ImportPage.screen.tsx`); Items, then Back: the import page, its crumbs
  "Example Works (test) / Import / items_messy.csv".
- The Items search box: "/" put the caret in it; typed "oak ": `?search=oak`, "23 of 155 items, best matches first",
  the box still "oak " (its own echo kept the space); Reset: the box empty, the address clear, "155 items"; typed
  "bolt": `?search=bolt`, "2 of 155"; the cross: empty, "155 items", the caret still in the box; Escape emptied it;
  Ctrl+K put the caret back. One letter set from the page: "Searching" and `aria-busy` within 50 ms, `?search=hinge`
  after the pause, the spinner gone.
- The content width at 1000 px on People: open 744 px and cards; folded 952 px and a table; reloaded still folded;
  opened again cards. People's own search "priya": one row, Priya Raman. Resized to 375 px: 375 px, cards, no sideways
  scroll; back to 1440 px: the sidebar open, the page 1184 px, the table. Console: no error or warning.

Caught on screen and fixed before the commit: the first version of the search box kept "oak " after Reset, because
the search went back to the very value it had been typed over. Typed text now counts only while the search is the last
one the box asked for.

**Step 6, `catalog-web`.** `bun run check` (74 tasks) and `bun run check:full` (76 tasks) pass; the catalog lint
(`packages/catalog/web/.oxlintrc.json`) is on with no file excepted. New client tests (`Seed.atoms.test.ts`): a read
given an answer shows it with no request and asks only on a refresh; a read kept for the page is not asked again when a
screen returns to it.

Browser, on a fresh database, a new browser context, the dev server on port 5220:

- Upload: a file dragged over the page showed "Drop the file to load it"; dropped beside the box, it started ("Saving 0
  of 200 rows · Cancel") and arrived at Review with no request for the import or its rows (the upload's answer is
  given to both reads). That drop was sent from a script, which runs both listeners back to back; a drop the browser
  itself sends did not work, and is fixed and checked under "Fixes after the review of step 6", group 5.
- Review: "Needs a decision 24 · Cannot import 21 · Ready 155 · All 200". Accepting a fix saved once and asked for the
  import once. "Use finished-goods for the 2 ticked": 24 → 22, 155 → 157, "Import 157, skip 43"; Undo: 24 and 155;
  Redo: 22 and 157; Undo and Redo still offered after each save ("Undo: 2 fixes accepted"). Reloaded mid-review:
  22, 21, 157, 200, Undo still there.
- Two tabs on one import: tab 2 undid, then accepted the SKU fix (revision 9). Tab 1 took each new revision when its
  window came back into view ("Updated with what changed on another screen", "Import 155, skip 45", the accepted fix's
  button gone). In the headless browser both tabs always report `visible`, so switching tabs sends no
  `visibilitychange`; the event was sent by hand each time, as a browser sends it on a real switch.
- Confirm: the dialog "Import 155 items? 45 items won't be imported (Needs a decision 24, Cannot import 21)"; Import
  155 items. Result: "Not imported 45 · Imported 155 · Already there 0 · All 200"; stored in D1 for the organization:
  155. The three numbers agree (200 in the file, 155 on screen, 155 stored). "Imported" showed imported rows; "Already
  there" kept the table with "No rows here. Show all 200".
- Take back: "Take back 155 items" → "Took back items_messy.csv", "Taken back 155". Review again: "Import 155, skip
  45", the decisions kept; confirmed again; View items: "155 items".
- Items: 20 a page, next page `?page=2`, last page `?page=8` with 15 rows. Search "hinje oak": both Oak Hinges
  (ALY-5698, QCZ-5391); cleared: the address clear. Unit cost, Desc: `sort=unitCost.desc,sku.asc`, $862.53 first.
- Editor on JCQ-8999: Qty on hand 12, Save: the row read "12 EA" 60 ms later, then "Saved JCQ-8999". Saved 13 and at
  once reopened (it showed 13) and saved 14: the row read 14, two "Saved". A refused edit: the editor open on 99 in
  tab 1 while tab 2 saved 50; tab 1's Save showed 99 at once, then 50 with "Changed by someone else … Their values are
  showing. Edit again" (the server's 409).
- Assistant, with no AI key: "only packaging, cheapest first" → "Answered by Rules", the rules could not read
  "cheapest first", and why. "only packaging and sort by unit cost" → "Filtered: Category is packaging · Sorted by
  Unit cost, low to high", `?sort=unitCost.asc&category=packaging`, $0.20 first. Reloaded: the conversation still
  there; Undo put the view back.
- An open import removed: items_clean.csv loaded ("Import 25 items"), left open; on Upload, Remove → "Remove
  items_clean.csv? This deletes the 25 rows it loaded …" → gone from the list 80 ms after the press, "Removed
  items_clean.csv". Loaded and removed once more after the two tagged enums below.
- Activity: "Decisions 40 · Events 11 · Imports 1"; the events list "Removed an import" and "Uploaded a file" for
  items_clean.csv, with who and when.
- At 390 px: no sideways scroll on the Result, Items or Review. Dark from the bar's button: `localStorage` "theme" =
  `dark`, the page `rgb(9, 9, 11)`, still dark after a reload; the Result read well, and named the item changed after
  the import ("JCQ-8999 Kraft Storage Bin, changed by Dana Whitfield"), which a take-back keeps.
- Console over the whole pass: one error, the browser's own line for the expected 409 of the refused edit.

Not seen on screen in this step: the sheet chooser (no sample workbook has two sheets), a refused file (the readers'
tests cover it), a 50,000-row file (the final proof).

Caught on screen and fixed before the commit: the Review step's first version took a save's own answer for someone
else's change, and drew the region again, which emptied Undo. The step that follows the import's revision is now an
atom that reads the review's state as it is, not as it was when the screen last drew.

**Step 7, `review`.** `bun run check` and `bun run check:full -- --force` pass (76 tasks, none from cache); the review
lint (`packages/review/.oxlintrc.json`) is on with no file excepted. Three commits: the A6 remodel of the rules, the
other discriminators, then the hooks.

Measured before and after the hooks moved, as the brief's rabbit hole asks: a 50,000-row file (the messy sample
repeated with its SKUs made unique, 5.5 MB) on the dev server in a headless browser, two runs each.

| | Before (hooks) | After (atoms) |
| --- | --- | --- |
| Reload to the region drawn | 10.7 s, 9.4 s | 8.2 s, 8.4 s |
| One accept (500 rows), press to counts | 1.67 s, 1.47 s | 1.31 s, 1.31 s |
| Ctrl+Z, press to counts | 1.79 s, 1.42 s | 1.19 s, 1.14 s |
| All 50,000 scrolled top to bottom in 40 jumps | 4.6 s, 4.75 s | 3.6 s, 3.6 s |
| Frames over 50 ms during the scroll (worst) | 33, 37 (717 ms, 633 ms) | 21, 24 (300 ms, 317 ms) |

No measure is slower, so the state stays one atom per region and is not split by row. The counts read "Needs a
decision 3,250 · Cannot import 3,250 · Ready 43,500 · All 50,000"; the last row drawn after the scroll was row 50,001.

Browser, on a fresh database, a new browser context, the dev server on port 5220:

- The messy sample: "Needs a decision 24 · Cannot import 21 · Ready 155 · All 200", "Import 155, skip 45", the work
  list "SKU 2 · Category 3 · Cost 2 · Number 2 · Vendors 2 · True or false 1 · Date 3 · Discontinued 2 · SKU clash 7".
- SKU picked on the work list, "Accept for the 2 ticked": SKU ticked off, "SKU clash 9" (the two rows now clash, so
  the tab counts stay), the table on Category with focus on "Use finished-goods for the 2 ticked" 50 ms after the
  press. That button: 24 → 22, 155 → 157, focus on "Use components for the 1 ticked".
- Ctrl+Z, Ctrl+Shift+Z and the Undo button: each took back or brought back one step ("Undo: 2 fixes accepted", "Redo:
  2 fixes accepted"); reloaded mid-review: Redo still offered. `j`, `j`, `k`: focus moved row by row, then down the
  work list to the next kind.
- "Type another SKU for Oak Cutting Oil": the box held YDR-8742; typed ZZZ-0001, Save: 24 → 22, 155 → 157, "Undo: Value
  changed". "Leave out Aluminum Bracket": "Left out 1", focus on the next row's first action; Put back: "Left out 0".
- All: "all, 200 items"; searched "hinge": 4 rows; Category, packaging ticked: "all, 34 items"; unticked: 200. Row
  height on a 1900 px window: 36 px compact, 44 px comfortable, the choice stored. A row opened to its detail stayed
  open after the table was scrolled away and back, and closed again. Category hidden and shown from View; SKU sorted
  descending. A cut-off value (VUR-1717) showed whole in its card on keyboard focus.
- "Why flagged?": the 43 flagged rows with their reasons. Activity: the steps of the run; Escape put focus back on its
  button.
- At 390 px: the queue, "Decision 1 of 17", "Accept for 2": 19 → 17, the next card with focus on "Use 1200 for 2";
  Undo: the card back; "Why?" as a drawer; "Review 2 one by one": 18 decisions; Import: the drawer "Import 160
  items? 40 items won't be imported (Needs a decision 19, Cannot import 21)", "Keep reviewing" put focus back on the
  import button. No sideways scroll.
- At 1150 px the work list is a row of chips; at 1030 px it overflows: "More problems" scrolled it and "Earlier
  problems" appeared, then back.
- Confirm at 1440 px: "Import 160 items"; the result "Not imported 40 · Imported 160 · Already there 0 · All 200";
  stored in D1: 160. The three numbers agree (200 in the file, 160 on screen, 160 stored).
- The gallery (`/gallery/review`): ready, a column to match ("Match Unit to import"), records with a parent, loading,
  error and empty all drew. "Accept 17 safe fixes": 59 → 42, the toast's Undo: 59. Under Questions, "Other answers"
  offered "Leave row 8 out" and "Leave job J-2042 out"; the first: Questions 9 → 8, "Left out 1".
- The 50,000-row import's auto-fixed view, looked at after an applied mark's fix became an `Option`: "4,250
  auto-fixed", each row's "Why? First received was fixed for …", the group's "Undo 500 fixes" and its reason.
- Console over the pass: two "change in the order of Hooks" errors for the catalog's `ReviewBody`, each at the moment
  the review's sources were swapped under the running page (below) and gone after the page load that followed; no
  other error.

Not seen on screen in this step: a refresh in the middle of an upload ("Continue" from the saved file), dark theme
(nothing in this step touches colour; it is in the final proof).

Caught on screen and fixed before the commit: the first version of the saved progress wrote nothing, so "Use
items_messy.csv" said the sample could not be loaded. `useAtomSet` calls a function it is given as "from the value
now to the next", so an atom whose write itself took a function never received it; the write takes the next value
now.

Two things seen that were already so before this step, checked by putting the old review sources back under the
running page and looking again, then restoring the new ones (identical to the saved copy): finishing a kind while
no kind has been picked on the work list goes to the kind after next (SKU done lands on Cost, skipping Category;
Category done lands on Number, skipping Cost); and closing "Why flagged?" leaves focus on the page's body, not on its
button. Neither is changed here; both are reported.

## Fixes after the review of step 6

A review of step 6 (`6d30446`) found seven serious defects and twelve smaller ones; each is fixed on top of step 7,
one commit per defect where the code allows. For six of the seven serious ones a test was written first and seen to
fail on the rule as it was; group 5 (the dropped file) has no test, and was looked at in the browser only. `bun run check:full -- --force` passes with none from cache. What was looked at is on the dev
server (port 5220), in a headless browser, with requests slowed where the defect needs a slow answer.

| # | Defect | Change | Test | Seen on screen |
| --- | --- | --- | --- | --- |
| 1 | An item's save was cut off when its row left the screen | A press of an optimistic write cannot be interrupted (`Optimistic.atoms.ts`) | client `Optimistic.atoms.test.ts`: the holder is let go while the save is out; it ends saved, not waiting, read again once; a later edit settles too. Failed first: the item stayed "Bolt" | Save held 3 s, Qty 777, straight to Activity; back on Items the row reads "777 BX", nothing marked updating; D1 holds 777, revision 2 |
| 2 | Answers put into the import's view were built from the view at the press | `changeView` changes the view as held when the answer arrives; `suggestFixes` takes the id; a saved decision changes only decisions and revision (`ReviewDraft.atoms.ts`, `Imports.atoms.ts`) | catalog-web `ImportViewAnswers.test.ts`, `ReviewDraft.test.ts`. Failed first: the view went back to revision 10; the suggestions were wiped | Suggestions held 4 s while a row was decided (20 → 18); they arrived ("Suggested 2 names from the description"); to Match and back: still 18, Undo offered |
| 3 | A Review drawn while the import was being asked again never restarted | `follow` takes the first view seen as the one drawn from, even while waiting, and restarts on a newer one | `ReviewDraft.test.ts`. Failed first: epoch 0 at revision 25 | Two tabs: A on Match, B accepts two costs; A's refresh held 3 s, Review opened before it answered (22, Cost 2), then 20, Ready 2 and "Updated with what changed on another screen" |
| 4 | Coming back to Review while a save was out reset the saver | `reset` is refused while a save is out or a change unsent; the screen shows what the saver is sending, with its undo | `DecisionSaver.test.ts`, `ReviewDraft.test.ts`. Failed first: a second request, the clear | Save held 4 s, "Use finished-goods" (24 → 22), to Match and back while it was out: 22, "Undo: 2 fixes accepted"; one request, clearing nothing; reloaded: 22 |
| 5 | A file dropped beside the box was opened by the browser | One `drop` listener for as long as the step is on screen cancels the drop, hands the files over, then lowers the flag | None (needs a browser's own drop) | Reproduced with a drop the browser sends (CDP `Input.dispatchDragEvent` with a file): before, `defaultPrevented` false and nothing loaded; after, true, "Review items_clean.csv", "Import 25 items" |
| 6 | The Items columns were rebuilt on every read of the filters' values | Built from the answer alone (`answerOf`), the same object while the server answers the same | client `Answer.atoms.test.ts`: built once per answer; built on the read itself, built again for every refresh | A's save held 2.5 s, B's editor open, typing in Reorder point through A's "Saved" and the re-read: the caret stayed ("2301234"), Name untouched |
| 7 | Until the first decision the whole review was worked out again on every refresh | `shownDecisions` keeps its object while the decisions are the same | `ReviewDraft.test.ts`. Failed first: a new object each time | 50,000 rows, a tab return that answers the same: longest tasks 175 ms and 236 ms, no second review (one is about 1.2 s) |
| 8 | A refused remove never read the open list again | `readAgainAfterRefusal` on the write; an import already gone counts as removed | client `Optimistic.atoms.test.ts`; catalog-web `RemoveImport.test.ts` | Not seen (a refusal needs a second person); the tests hold it |
| 9 | An upload's answer was taken as fresh whenever first opened | A given answer carries when it was given: older than a second, it is shown and asked again behind. An upload that lands after a switch of organization is not put in place or opened | client `Seed.atoms.test.ts` | Not seen |
| 10 | An assistant answer that arrived after leaving Items was applied | Applied only while the person is still on the table's page; otherwise the conversation says so | None | Answer held 3 s, to Activity meanwhile: the address stayed `/activity`; back on Items the conversation reads "The answer came after you left Items, so nothing was changed. Ask again." |
| 11 | The assistant's conversation jumped to the bottom on every draw | One ref callback for the page's life | None | Conversation 976 px tall in 518, scrolled to the top, typed "abc": still at the top |
| 12 | Removing one import disabled Remove on every card | One write per import | `RemoveImport.test.ts` | Remove of items_clean.csv held 3.5 s: the other two cards' Remove stayed enabled; "Removed items_clean.csv" 452 ms after the press |
| 13 | Each card mounted its import's read | Continue puts the card's view in place through one write | None | The first screen asked for `/imports/open` and `/imports/past` only; Continue asked only for the staged rows |
| 14 | Given answers were kept for the page's life | The given answer is a plain value the read takes once, and goes with the read; `forgetReads` drops it with the read | `Seed.atoms.test.ts`, `SignOut.atoms.test.ts` | Not something a screen shows |
| 15 | Each item's editor atoms were kept forever | Held weakly (`Atom.family`) | None | Not something a screen shows |
| 16 | A removed import kept its view and rows | `letGo` on a read; the remove lets both go | `Seed.atoms.test.ts`, `RemoveImport.test.ts` | Not something a screen shows |
| 17 | `Sniffed` was branched by hand | `formatOf`, one exhaustive `$match` | The readers' tests | Nothing to see |
| 18 | The skeleton-first wait was not measured | Measured, below | | |
| 19 | Counts and comments this step left false | The step 6 and 7 hook counts above; the legacy table; `UploadStep`'s doc block; `preload.ts`'s comment; the session's two `resetQueries` calls removed | | |
| 20 | Two older races in the review's saving | A save that finds someone else saved in between leaves the revision it knows, so the view it asks for restarts the region from everything the server holds; a view of an earlier revision never replaces a later one (`putView`) | `ReviewDraft.test.ts`, `ImportViewAnswers.test.ts`. Failed first: the others' decisions hidden at revision 13; revision 11 over 12 | Not seen on screen: 3's two tabs did not produce either race |
| 21 | The atoms lint could be passed by a hook not from `react` | `use`, `useOptimistic`, `useActionState`; `useFormStatus`; the kit's three effect and ref hooks, by package path and by a relative one; `radix-ui/internal`; the query client | A planted file per spelling, refused by the lint, then deleted | |

**Group 18, measured.** The 50,000-row file, the dev server, a headless browser; a frame counts as painted with the
skeleton when an animation frame ran after the skeleton was in the page and before the task that works out the
review began.

| | Skeleton in the page | Frames painted with it before the review task | The review task | Region drawn |
| --- | --- | --- | --- | --- |
| Continue from the first screen (rows fetched) | 94 ms | 75 | 1.38 s, from 1.5 s | 3.5 s |
| Match to Review, rows held, three runs | 105, 114, 115 ms | 1, 2, 3 | 1.33, 1.23, 1.22 s, from 124 to 135 ms | 1.99, 1.79, 1.79 s |

So the skeleton does paint first, by one to three frames when the rows are already held. That is a narrow margin,
and it is React's to keep (`useDeferredValue`), not a timer's.

**Found while looking, and fixed in the same commits:** the review's undo history was lost when the screen came back
during a save (group 4), and "Removed <file>" waited for the open list to be read again, which takes seconds while
a 50,000-row import is open (group 12); it is said when the server answers.

**Left as they were, older than step 6:** a retried item save that the server answers "changed meanwhile" for the
person's own save still says "Changed by someone else" (group 8's older part).

## The rework after Benjamin's answers (2026-11-19), and the review of step 7

Benjamin answered the five choices step 7 had put to him: ref callbacks follow the brief, what the region works out
is derived atoms, state of one component is a `ScopedAtom`, `viewRows` reads an `Option` (measured), and the theme
stays in plain `localStorage`. "Choices made" below says what each became. The review of step 7 came back while the
rework was under way; its groups are answered in the same commits.

| Group | What was wrong | What changed | Test | Seen on screen |
| --- | --- | --- | --- | --- |
| 1 | A region that had gone still acted: a bulk toast's Undo, and its keys for up to 600 ms, told the caller the old region's decisions | The region's actions, its stepping and its keys return while its section is off the page (`present`, set by the section's ref callback); the keys atom has no idle time | `ReviewRegion.atoms.test.ts`: the toast's Undo pressed after the region left, and a region not yet on the page. Each fails with the guard taken out | Imported items_messy.csv, then Ctrl+Z on the Result: nothing was sent |
| 2 | Until the first decision the region worked its state out again on every draw of its caller | The decisions are the caller's atom; the Review step's start is one derived atom, read once | catalog-web `ReviewDraft.test.ts`: the decisions stay the same object while the screen's other state changes, and nothing is told | Not measured apart: the 50,000-row reload below includes it |
| 3 | No test of undo and redo on the region's atom | The region's atoms and actions are in a file a test can read (`ReviewRegion.atoms.ts`) | `ReviewRegion.atoms.test.ts`, through a registry. The table those first six tests used was made with the store's own reactivity, not as the screen's hook makes one, so the second search and sort were held by none of them; the review of the rework (below) put that right | |
| 4 | A change that changed nothing redrew the region | `change` keeps what it holds when every value is the same | The same file. Fails with the check taken out | |
| 5 | The review package did not declare `@effect/atom-react` | `@tanstack/store` (the facets) and `@tanstack/table-core` (the test's table) were declared then; `@effect/atom-react` was not until the review of the rework (below), though this row said so. No law holds a third-party dependency: the boundaries law reads the workspace's own packages only | None | |
| 6, 7, 8 | Observers rebuilt on every draw; the grid's handle left behind; records changed in place inside atoms | Every ref callback is the same function across draws; there is no handle (the region asks for a row through an atom); what was changed in place is atom state written through the registry | Groups 6 and 7: `laws ref-callbacks` and its test. Group 8 has no check: no law refuses a field assignment on a value read from an atom | On the gallery: "Why?" opened by a click and closed by Escape; by a resting mouse after the delay, without taking the focus, and closed when the mouse left; a click while it was open by hover kept it open. The work list as chips at 1250 px. Not seen: a strip too long for its line (its edge buttons), and a cut text's card (no text was cut) |
| 9 | The phone drawers' code was fetched inside a draw, behind a module-level flag | Fetched where the layout is derived to be narrow; no flag | | On the gallery at 390 px: Import opened the confirm drawer at the first press |
| 10 | Only `Action` was matched by its enum | A tag in the review package is compared through the enum's own guard, made once per file; the stops of "Next problem" are an exhaustive `Entry.$match`; a row's place is read through `RowPlace.guards`. What was still an if-chain or a flag after this pass (the grid's lines, the queue's card, `OtherAnswer`, `Primary`, `Wanted`, `Stop`, two `Option` tags) is closed in the review of the rework (below) | `laws tags` (`tags:check`, part of `bun run check`) since the rework review's last pass: it refuses a `_tag` compared by hand, or switched over, in the packages with screens, their tests included. Until then nothing held this: `bun run check` passed a hand-written comparison | |
| 11 | The column plan was not kept across draws | The plan, the widths, the lines and each row's headings are derived atoms | The same file (the rows are worked out once per change) | 50,000 rows below |
| 12 | Comments and documents named what was gone | `docs/review-table.md`, the props' comments and this plan say atoms | None: `docs:check` reads a document's form (its frontmatter, its links), not what it says | |
| 13 | The inventory of a hook's job done with no hook and no atom | Each item is one of the house forms; what is not is listed under "Choices made" (the list was not complete until the review of the rework: the debounce, the reveal subscription, three caches and the props taken once were missing from it) | | |
| 14 | The lint read imports only | `laws ref-callbacks` (`refs:check`, part of `bun run check`) refuses a ref callback made on each draw. As first written it read lines with a pattern and passed several forms; it reads the syntax tree since the review of the rework (below) | `RefCallbacks.test.ts`, with planted files; on the seven files as they stood before the rework it names all eight | |
| 16 | After Confirm the bulk toast's Undo still acted on the Result | The same guard; and a region that goes takes its own toasts down (`toasts`, dismissed by the section's ref callback when its node goes) | `ReviewRegion.atoms.test.ts`: the toast is dismissed when the region leaves, and its Undo, pressed all the same, reaches nobody | Accepted a group (toast "2 fixes accepted" with Undo), Import, Confirm: on the Result no toast was left, Ctrl+Z sent nothing, no "not saved" message, and no saved progress for the import was in the browser's storage |
| 17 | The pass left out items the brief's proof names, without saying so | Walked below; what was not is on the "Not seen" line by name | | |

The same pass asked about two things, and both are put back as they were before step 7: the edit form keeps the value
it opened with until something is typed (it had come to follow a later value from outside), and the row height is
read from the browser's storage once, when the region is made (it had come to be read on every draw until picked).
`docs/review-table.md` was brought up to the region's props in this batch; its older shapes in the examples
(`match: { state: "unmatched" }`, `confidence?`) are on step 8's list of documents the move made false.

Found while looking, and fixed:

- A second search in the review did not reach the rows (the first did): the atom that reads the table's order gave
  the table its rows through `setOptions`, which also publishes the table's state outside a draw. The rows are given as
  the table's own hook gives them. Seen: bolt 5 items, nut 0, cleared 200; before the fix 5, 5 and 5.
- Scrolling 50,000 rows was four times slower after the first pass of the rework (15 s for the script's 40 jumps):
  each drawn row walked back up the whole list for its headings, the enums' guards were made anew at every
  comparison, and the table's order was worked out five times per decision. Fixed in `c48f932`.

**50,000 rows** (`items_50000.csv`, dev server, headless Chromium, the same script as step 7). The machine was busier
than when step 7 was measured, so the code before the rework (`ef53dbd`) was measured again in the same sitting:

| | Reload to the region drawn | One accept of 500 | Ctrl+Z | 40 scroll jumps | Frames over 50 ms | Worst frame |
| --- | --- | --- | --- | --- | --- | --- |
| Step 7 as first measured | 8.2 s, 8.4 s | 1.31 s, 1.31 s | 1.19 s, 1.14 s | 3.6 s, 3.6 s | 21, 24 | 300 ms, 317 ms |
| Before the rework, measured again | 8.6 s, 8.4 s | 1.47 s, 1.67 s | 1.20 s, 1.50 s | 3.6 s, 4.6 s | 28, 38 | 183 ms, 217 ms |
| After the rework (four runs) | 7.3 s, 9.7 s, 7.4 s, 12.2 s | 1.54 s, 1.91 s, 1.42 s, 1.72 s | 1.32 s, 1.54 s, 1.18 s, 1.35 s | 3.9 s, 4.0 s, 4.4 s, 3.5 s | 29, 32, 36, 29 | 217 ms, 300 ms, 333 ms, 217 ms |

That table set two runs before against four after, was measured before `1531c32`, and its worst frame after is above
both old runs in two of four: "not slower" was more than it shows. Measured again on 2026-11-20 at `b8b6700`, four
runs a side in one sitting, the code before the rework (`ef53dbd`) checked out in place:

| 50,000 rows | Reload to the region drawn | One accept of 500 | Ctrl+Z | 40 scroll jumps | Frames over 50 ms | Worst frame |
| --- | --- | --- | --- | --- | --- | --- |
| Before the rework (`ef53dbd`) | 13.7 s, 7.5 s, 7.5 s, 7.9 s | 1.29 s, 1.50 s, 1.45 s, 1.62 s | 1.36 s, 1.32 s, 1.30 s, 1.50 s | 3.7 s, 3.8 s, 3.7 s, 3.6 s | 31, 31, 31, 30 | 183, 200, 183, 167 ms |
| Head (`b8b6700`) | 10.5 s, 7.9 s, 7.2 s, 7.2 s | 1.33 s, 1.22 s, 1.37 s, 1.34 s | 1.10 s, 1.13 s, 1.25 s, 1.07 s | 3.4 s, 4.4 s, 3.6 s, 3.9 s | 25, 28, 26, 29 | 183, 333, 217, 400 ms |

The first reload of each side followed the dev server compiling the files. Reload: the same from the second run on.
An accept and Ctrl+Z: shorter at the head in every run but one accept. The scroll: fewer frames over 50 ms at the
head in every run, the 40 jumps longer in two runs of four, and the worst frame longer in three runs of four (333 ms
and 400 ms against 200 ms at most before).

And on a page with a kind marked `fixable: false` (the gallery's `?state=elsewhere`, 181 rows), one accept and one
key in Search, four runs a side:

| 181 rows, one kind that cannot be fixed | One accept | One key in Search, to the rows shown |
| --- | --- | --- |
| Before the rework (`ef53dbd`) | 144, 144, 129, 158 ms | 63, 60, 57, 62 ms |
| Head (`b8b6700`) | 162, 162, 159, 162 ms | 88, 79, 80, 92 ms |

On that small page the head is slower in both: an accept by about 18 ms, a key in Search by about 25 ms.

**On screen**, a fresh database, 1440 px unless said: items_messy.csv, Continue to the review (200 rows: Needs a
decision 24, Cannot import 21, Ready 155). Accepted the SKU group of 2: the work list said "SKU: done", "SKU clash: 9
left" (the two trimmed SKUs now clash), focus went to the Cost group's accept, a toast "2 fixes accepted" with Undo;
Ctrl+Z and Ctrl+Shift+Z put it back and forth, one PUT each. Accepted the Cost group: Needs a decision 22, Ready 157.
J, J, K moved the focus down the rows and back. "Leave out Oak Tape 2in": Needs a decision 20, Left out 1, focus on the
next row. All, typed bolt: 5 items; nut: 0; cleared: 200. Sorted descending: the first row changed. Ticked Category
"Component": 1 item; unticked: 200. Reloaded: the same counts and "Undo: 1 row left out". At 390 px: the first card
took no focus; "Use 1200 for 2" moved to card 2 with focus on its first button; Skip and Undo moved between cards;
Ready and back to Needs a decision left the focus on the tab. Import: the confirm said "Import 158 items? 42 items
won't be imported"; the Result said Not imported 42, Imported 158, All 200. Activity: 22 decisions, "/" put the caret
in the search, "unit" left 7, Escape 22; Imports 1. People: 3 rows, a role changed to Viewer and back to Editor.
items_clean.csv dropped on the page beside the box: uploaded, Review 25 Ready. 

A second pass on a fresh database, for what the review's last pass named:

- Two tabs on one import. Tab A accepted the SKU group of 2 (toast with Undo); tab B left row 2 out (its own PUT, one
  row). In A the toast's Undo, pressed while A's region was still the one on screen, sent `clear` for A's two rows
  only: B's row was not in it. A's save came back one revision further than A knew, so A read the import again, said
  "Updated with what changed on another screen" and was drawn again with Left out 2. Ctrl+Z then sent nothing and the
  Undo button said "Undo" with nothing to undo: the new region has its own history.
- Another account. Dana left a row out of items_clean.csv ("Undo: 1 row left out"). As Marcus Oyelaran (the user
  menu), the same import showed Left out 1 and "Undo" with nothing to undo: the history is Dana's. Marcus put the row
  back ("Undo: Row put back"); the browser then held one saved progress for him and one for Dana. Back as Dana: Ready
  25, nothing to undo (her kept history no longer ends at what the server holds). Sign out: the sign-in page; "Sign in
  as Dana Whitfield" there signed in again.
- Items: 153 items, page 1 of 8; the next page (`?page=2`, opened by its address too); "/" put the caret in the
  search, "bolt" left 2 rows (`?search=bolt`); a refresh kept the 2 rows and "bolt" in the box.
- An item edited twice about a third of a second apart (Steel Storage Bin, its name to "... X" then "... Y"): two
  PUTs, both answered 200, "Saved CJL-7383" twice, the row said Y, and still did after a refresh.
- The edit form: "Type a cost" opened empty, 12.50 and Enter made the row Ready (Needs a decision 59 to 58). Row
  height: Comfortable, a reload, still comfortable; back to Compact.

Not seen on screen, by name: a region drawn again from a newer draft while its bulk toast is still up (the tab's
return did not ask for the import again in the headless browser, so the region was started again only after its own
save; the test holds the toast's Undo and the dismissal); a refused save; a file over the limit; a refresh in the
middle of an upload; a strip too long for its line; a cut text's card; the dark theme in this batch.

## The check of the step 6 fixes: the review's draft, rebuilt

A second check of the twelve fix commits found that the Review draft's saving still lost or hid decisions in four
orderings, two of them caused by the fixes. They were not fixed one ordering at a time.

**What is sent is what the person did.** A save used to send the difference between two whole pictures (the server's
as last held, the screen's); whenever either was behind, the difference took back rows nobody had touched. Now the
region's write gives the rows its action changed, they are kept per row until the server confirms them, and the
server's picture is something the screen follows, never the base a clear is worked out from. The contract already
allowed it (`DecisionDelta` is rows to set and rows to clear).

**One pure transition** (`packages/catalog/web/src/Draft.machine.ts`): a draft and an event give the next draft and
what to send or ask. The draft is the picture held (`held`), and over it the person's rows the server confirmed but no
picture read yet holds (`landed`), the save that is out (`flight`) and what changed since (`unsent`). Events: the step
opened or left, decided, a save answered, failed, sent again or refused, a view arrived, a match started or ended, the
import confirmed or removed. `ReviewDraft.atoms.ts` runs it: one atom takes every event, steps the machine and does
what it asks. The saver (`Draft.controller.ts`, its `follow` and `reset`, and `DecisionSaver.test.ts`) is gone: rows
3, 4 and 20 of the table under "Fixes after the review of step 6" name it as it was then, and each of their rules is
the machine's now.

**The property test** (`Draft.machine.test.ts`, `it.prop`) plays random orderings of: the person decides a row,
somebody else decides a row, the server takes the save, its answer arrives, the save fails, is refused, "Save again",
a return to the tab, the server takes the read, the read arrives, another request's answer is sent and arrives (a
match, a card's Continue), leaving and coming back. After every step it holds:

1. A save carries only rows the person changed on this screen that the server has not confirmed, and for each the
   value they last chose. One save is out at a time.
2. The revision the screen claims is never ahead of the server's, and while the step is drawn it is the revision of
   the view the tab holds.
3. The picture held is what the server held at that revision (except after a save the server counted as no change,
   until the next read: see below).
4. The person's own decision stays on screen while it waits to be saved and once the server has it, until somebody
   else decides that row.
5. A view put in place never lowers the revision held, and a put while a read is out is followed by a new ask.
6. Once everything on its way has landed, the screen shows what the server holds, and nothing of the person's waits.

What was true of that property, said late: it played ten commands at most (the runner bounds a collection by its
`size`, ten unless told, ramped from none over the runs; about a third of its runs played none), nine of its fourteen
kinds did nothing from an opened review, rule 3 was waived exactly where it failed, rule 6 was checked only after a
read the test itself forced, and nothing in it noticed a Restart. "Tested over every ordering" in dd3e3e9's message
was not so. The property that replaced it is described under "The draft review and Benjamin's answers of
2026-11-20", below.

200,000 orderings were run once; the suite runs 5,000. It found one failure, in the test's own bookkeeping (a row
somebody else decided after the server took the person's save but before its answer), not in the machine. It fails
when a save is built the old way (the difference from the picture held), when a failed save's rows are dropped, when
an answered save is always taken for the next revision, when the person's saved rows are forgotten on a jump, and
when a refusal keeps the person's rows. It cannot run on `ef53dbd`, which has no transition to drive; the four
orderings from the check are named tests beside it.

Left as it is, and why: a save the server counts as no change (the same decision somebody else just made) is answered
with their revision, which reads as the person's own next one, so their other rows are not shown until the next read
of the import (a return to the tab, or any later jump). The machine takes the server's word at the same revision when
that read arrives. Closing it needs the server to say whether the save changed anything.

| Entry | What became of it | Test |
| --- | --- | --- |
| 1, 5, 26, 32 `continue-gives-older-view` | `giveView` goes through `putView`: never an older revision over a newer one. It looks without asking (`peek`), so Continue still starts no request | `ReviewDraft.test.ts` "a view put in place from a card's Continue"; client `Seed.atoms.test.ts` (peek) |
| 2 `start-else-known-ahead` | Gone with the design: the screen shows the picture held with the person's rows over it, so the revision it claims is the revision of what it shows | property 2, 3; "back on Review with a decision unsaved" |
| 3 `stale-start-on-quick-return` | No stored start: the region starts from what is shown; the next decision sends its own row | "a quick return after the region was started again" |
| 4 `typed-sku-check-cancelled` | A put no longer ends a request that was out: the server is asked again behind it (`Api.atoms.ts`) | `ReviewDraft.test.ts` "that typed a SKU" (fails with the re-ask taken out); `Seed.atoms.test.ts` |
| 5 `late-match-answer-cancels-reread` | The same, and the person's saved rows stay over an older picture (`landed`) | "an answer from another request that lands after a later save" |
| 6, 33 `items-columns-rebuilt-when-facets-change` | Every cell, heading and the pencil is made once and is the same function whatever the filters answer, so React keeps what they drew and an open editor stays open. The filters' values are not read live from an atom: the data table copies a column's meta when it takes the columns (`applyColumnConfig`), so a control would never see a later answer; they reach the controls as copies of the same columns with another meta. Tried first: meta whose values were read on access; the Category filter then listed nothing | `ItemColumns.test.ts`: the cells and headings are the same functions after a differing answer, the filter's values are the new ones. Seen: an item moved from components to raw-materials, the next row's editor opened at once with text typed stayed open with its text, and the Category filter then said components 28, raw-materials 36 |
| 7, 8, 30 a read let go while on screen | The screen asks the server at once; what was let go is not kept again when the screen leaves; a card removed while the address names it leaves the address first | `Seed.atoms.test.ts` "a read let go while a screen still shows it" |
| 9, 23 the saver and the workbook outlive a remove | The draft is emptied by the machine when the step has left and the server has everything, and by a remove or a confirm; a remove forgets the workbook | `ReviewDraft.test.ts` "keeps nothing of the draft once the server has everything" |
| 10 an answer given and never taken | Said as it is (the choice above): kept until the read is let go or the person signs out | |
| 12 `refused-decision-shown-again-on-return` | The machine drops the refused rows, here and for the next visit | "a decision the server refused" (machine and wiring) |
| 15, 22 | The comment names who calls `invalidate`; the doubled doc block is one | |
| 16, 17, 18 the lint | `lib/queries.ts` is gone; the hooks under the hoisted package names the lint lists (`@radix-ui/react-use-*`, `@radix-ui/react-compose-refs`, `use-sync-external-store`), the query client's core and its file by a relative path, and react-dom's default import are refused; a hoisted name it does not list (`use-callback-ref`, `@tanstack/react-store`) was not, until `laws boundaries` refused every undeclared third-party import (2026-11-20). Planted: four refusals in a review file, one in the client | |
| 19, 20, 21, 34 false statements | Corrected above: the test-first sentence, group 20's "seen", the files excepted; the `viewRows` choice says `Option` | |
| 24 `unsent-decision-freezes-follower` | A save waiting for "Save again" does not stop a newer draft from being followed | "a save waiting for Save again" |
| 25 `own-save-told-as-someone-elses` | The draft outlives the step while a save is out: its answer is the person's own | "a save answered after the person left" (machine and wiring) |
| 27 `region-pass-every-render` | Fixed by the rework (the decisions are one atom) | `ReviewDraft.test.ts` "start once" |
| 28 `must-still-ask-untested` | The typed SKU, the jump and the refusal each have a test that fails when the ask stops | `ReviewDraft.test.ts` |
| 31 an upload that lands after a switch of organization | Says so where the person is, with no Open | Not tested, not seen |
| 11, 13, 14, 29 | Not done in that batch, and done in the next ("The review of the rework, and four entries of the check of the step 6 fixes"): a row that comes back while its save is out offers Edit again; a write that answers after a switch of organization reads the left organization's read again; "Edit again" after the row left opens nothing; an assistant answer applied after a return or a switch | |

A confirm now carries, beside the decisions shown, the rows the person took back that the server has not heard of.

**Seen on screen** (dev server, the database of the pass before, 1440 px): items_messy.csv uploaded again (152 rows
Already there). A group of 2 accepted: `PUT {"set":{"row-148":…,"row-195":…},"clear":[]}`; Ctrl+Z: `PUT
{"set":{},"clear":["row-148","row-195"]}`. Two tabs on the import: tab B left row 3 out; tab A, still on the older
picture, left row 7 out: its save was `{"set":{"row-7":{"out":true}},"clear":[]}`, then "Updated with what changed on
another screen" and Left out 3 in both tabs. "Type the SKU" with CJL-7383 (an item in stock) and another row left out a
quarter of a second later: two saves of one row each and one read of the import; row 49 then said "SKU CJL-7383 is
already there: an item your organization has uses it". Not seen: a save refused by the server, a save that fails and
waits for "Save again", a match's answer arriving after a later save, Continue over a newer view, an import removed
while its review is open, an upload landing after a switch of organization. The tests hold each of those.

## The review of the rework, and four entries of the check of the step 6 fixes

A review of the rework (`ef53dbd..1531c32`) came back with 19 groups, none refuted. Each is answered here; the four
entries of the check of the step 6 fixes that were left (11, 13, 14, 29) are answered in the same commits
(`46e95c0`, `a9d9b63`).

| Group | What was wrong | What changed | Test | Seen on screen |
| --- | --- | --- | --- | --- |
| 1 | The lead group in view was told by switching a ref on and off: an effect on the condition under another name | The lead is derived: the grid holds what the virtual list says is in view (`seen`), and `lead` is the first group there the person can take in one press. The conditional ref and `markLead` are gone, and the law refuses a ref chosen by a condition | `ReviewRegion.atoms.test.ts`, with a real virtual list on a frame the test scrolls: the lead before the list has a frame, scrolled away and back, after an accept that makes the lines fewer without the list being drawn again, with the confirm open, read-only, on another tab. Fails when the list is not given the lines' number first | Gallery: "Use pcs for the 9 ticked" filled at the top; scrolled 3,000 px, "Use kg for the 8 ticked"; back at the top, the first again; Import outline throughout |
| 2 | The search box's pause was the kit's debounce hook (a layout effect after every draw) | The typed text is an atom of the box's scope and the pause is `Atom.debounce`. The box is given the table: it reads the table's search as an atom and asks the table itself, so no function goes through a draw. The atoms lint refuses `**/hooks/use-debounced-callback*` | None of its own | Items: "bolt" typed at 60 ms a key gave one request ("2 of 153 items, best matches first") and the field read b, bo, bol, bolt with no step back; " m8" and Enter asked at once; Escape emptied it and kept the caret; "/" put the caret in it. Activity: "quantity" said nothing matches, "cost rule" found 3 rows, Escape 20 again |
| 3 | The grid's "bring this row into view" subscription was made again after every draw | `grid.bring`: one function for the grid's life | The same file: a row asked for is scrolled to, the same row asked again is a new ask, a row not among the lines is not | |
| 4 | Caches kept by hand | `histories` is gone: `saved` gives the plain decisions, a draft is made from the whole state (`toDraft(state)`, `fromDraft(draft)`, `storedReview(state)`, `restoredReview(stored)`). `ListTable`'s `searchText` is gone, not replaced: the held lists are short (at most 5,000 rows from the server, 500 for the audit trail) and the table keeps each cell's value itself. `untouched` stays ("Choices made") | `Review.test.ts`, `SavedProgress.test.ts`, `DraftFormat.test.ts` | |
| 5 | Props taken once when the region was first drawn | `problemKinds`, `ruleFixes`, `words`, `rowAction` and `readOnly` are atoms from the caller, as the rows are. The two the review did not place (`rowAction`, `readOnly`) are atoms because the grid's atoms work from both (the width of the answers). What stays a plain value (`cellEditor`, `explain`, `onImport`, the title and the rest) is read when it is drawn and kept in no atom | The lead's test sets `readOnly` on the caller's atom and the region follows | Gallery: read-only (no Import, no Undo, the answers' column 120 px, Ctrl+Z nothing), the months (a row's own answer under "Other answers", the column 278 px), the jobs page |
| 6 | `@tanstack/store` in the review package's own code | Not changed: a question for Benjamin ("Open, for Benjamin" below) | | |
| 7 | `laws ref-callbacks` read lines with a pattern | It reads each screen's syntax tree (the parser the imports law uses) and judges a name by where the file binds it; a prop handed to a ref is followed to every place that hands it; the function given to `useAtomSubscribe` is held to the same; it fails when git cannot list the files; its findings are built with the union's constructors | `RefCallbacks.test.ts`: nineteen planted lines, one per form (a typed arrow, a generic arrow, a declaration broken after `=`, a declared function, `var`, a function returned from a call, a property of an object made in the component, a name taken out of a call, a renamed one, an inline arrow and function, a call, `.bind`, a choice by a condition and by `&&`, a ref over several lines, two subscriptions); a prop handed down through two files; git failing | |
| 8 | Nothing tested the second search or sort | The test's table is made and drawn as the screen's hook does it (render-phase reactivity, options staged in a draw, state published after it, the hook's copy handed to the region) | Search A, search B, cleared, sorted up, down, cleared, through `regionTable.ordered`. With `86f8efe`'s two lines put back the second search gives the first one's rows and the test fails | Gallery, All: "bolt" 16 items, "tube" 11, cleared 178; Item sorted ascending |
| 9 | Two gone-region tests did not hold what their names said | The key test mounts the keys and raises Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y and J on the page: taken while the region is there, left alone once it has gone; the listener goes with the change at hand, in a registry that keeps atoms 400 ms. The other test never attaches | Fails with the guard moved below `preventDefault`, and with the keys' idle time put back | |
| 10 | The kept undo history rule was held by no test | `ReviewHistory.test.ts`, with a member and a browser storage: written with every decision and back after a refresh; not used when the server's decisions changed on another screen; not another member's | Each fails with its half of the rule taken out | |
| 11 | The review package did not declare `@effect/atom-react` | Declared, 4.1.4 exact, as the others | None: no law reads a package's third-party imports against its manifest | |
| 12 | Every drawn row was drawn again on every decision | The measured widths, the plan and its three parts are kept while they say the same | `ReviewRegion.atoms.test.ts`: `parts` and `plan` are the same objects after a decision and its undo. Fails with nothing kept | 50,000 rows below |
| 13 | Guards in if-chains, flags for a union, two `Option` tags compared by hand | `$match` where a branch covers every member (the grid's lines, heights and headings, the queue's card and its key, `OtherAnswer` twice, the draft's effects); `Primary`, `Wanted` and `Stop` are tagged enums built with their constructors; `O.isSome` and `O.isNone` in `SavedProgress.schema.ts` and `Conversation.machine.ts` | `bun run check`; the tests build `Primary` and `Wanted` with the constructors | |
| 14 | `fixable` was made twice | Once, as an atom of the region | An unfixable kind: the view of every row a decision did not touch is the same object after it. Fails with the test made twice | |
| 15 | A region about to be replaced worked every row out again first | It stood. Each epoch's region is given atoms that follow the draft while that epoch is the draft's and keep their last value after (`whileCurrent`, `reviewStateAt`); the draft and what it changes in this tab are one batch | `ReviewDraft.test.ts`: the replaced region's decisions and rows are the same objects, nothing is told, its late write reaches nobody. Fails without the keeping | 50,000 rows below. messy sample, two tabs: tab B "Leave out 2" sent one save of rows 148 and 195; tab A on return made one read, said "Updated with what changed on another screen" and showed Needs a decision 22, Ready 2, Left out 6; after B's undo, 26 and 4 again |
| 16 | A key in Search and a sort drew the region twice, each draw building and encoding the not-imported CSV and filtering the flagged rows | The CSV is written out when the download is pressed (`saveCsv`, shared with the Result step); the flagged rows are a derived atom. The two draws themselves are still two | None | Gallery: the download saved `not-imported.csv`, a header and 59 rows |
| 17 | The Result's rows were built from the read, not its answer | From `answerOf(importView(id))` | `ResultRows.test.ts`: asked again twice, the same rows, nothing worked out. Fails built from the read | |
| 18 | Finishing the kind the table chose by itself skipped the next kind | The wanted move carries the kind that was on screen, read before the decision is written | `ReviewRegion.atoms.test.ts`. Fails with the kind read when the move is settled | Gallery, nothing picked: "Unknown unit" finished in six presses, the table went to "No cost" (9), focus on its first row's "Type a cost" |
| 19 | Statements that were not true | Corrected where they stand: rows 3, 5, 10, 13 and 14 of the table above, the hook count, the ceilings, the ui paragraph, `docs/review-table.md` (`rowAction`, the draft's functions), `docs/kit.md` (the search box), a test's title, two headers with an import above them | `bun run docs:check` | |

**Of `7bbedac`.** Its message says Benjamin's edits are "as he wrote them". Two things differ, and the message does
not say so: one constructor call (`Refused.make({})` where his line read `Refused.make({ _tag: "Refused" })`, the tag
dropped as the constructor gives it), and the two `import * as React from "react"` lines of his patch, which were not
taken (the atoms lint refuses a namespace import of React).

**The four entries of the check of the step 6 fixes.**

| Entry | What was wrong | What changed | Test | Seen on screen |
| --- | --- | --- | --- | --- |
| 11 | A row that came back while its save was out offered Edit again | That a save of an item is out is kept for the page's life (`saveOut`), not with the row | `ItemEditor.test.ts`: the write's own atom, read anew, knows of no press; the save is still read as out. | A save held for the test: the pencil was disabled, still disabled after Activity and back, free after "Saved AAT-7076" |
| 13 | A write that answered after a switch of organization asked the left organization's read again with the new session | The write notes who pressed; answered for somebody who has left, it only takes its change off (a failure is still said) | `Optimistic.atoms.test.ts`, two tests. Fails on the old write: a third read | Not seen |
| 14 | "Edit again" after the row had left opened nothing, and what was typed was gone | An open editor is kept for the page's life; the press carries the typed form; when the item's row is not on screen the person is taken to it (the Items table, searched for its SKU) | `ItemEditor.test.ts`: refused after the row left, and "changed by someone else" with the row drawn | A save refused while on Activity: the toast offered "Edit again", which went to `/items?search=AAT-7076` with the dialog open on "Brass Washer M6 typed again" |
| 29 | An assistant's answer was applied through the table the person had left | Applied only on the drawing of the assistant that asked, for the same member; "Working" is kept while a request is out | `TableAssistant.test.ts`, four cases | The rules answered at once, so neither a late answer nor "Working" was on screen: not seen |

**50,000 rows** (`items_50000.csv`, the dev server, headless Chromium, the script of step 7), at `a9d9b63`: reload
6.8 s and 7.2 s, an accept of 500 1.22 s and 1.27 s, Ctrl+Z 1.07 s and 1.23 s, 40 jumps top to bottom 3.5 s and
3.3 s with 26 and 20 frames over 50 ms, the worst 183 ms both times; the last row drawn was row 50,001. A restart
from another tab's change, the long tasks in the tab that is told: before (`1171834`) two each time, 85 + 1,427,
331 + 1,319, 59 + 1,831 and 62 + 1,427 ms; after, one each time, 1,308, 1,334, 1,487 and 1,337 ms. The counts
changed 4.6 s to 5.6 s after the tab was told in both, most of it the server's read of the import.

**Not seen on screen, by name:** a search changed from elsewhere while the box's pause is running; a write
answering after a switch of organization; an assistant's answer arriving after the person left, and its "Working"
on a return; "Changed by someone else" with its "Edit again"; a ref-callbacks refusal in the editor (it is a check,
seen in the terminal); the dark theme; the strip too long for its line; a cut text's card.

**Open, for Benjamin** (not built): `@tanstack/store` in the review package's own code, against the brief's "No new
state library beside atoms" (the table's column filters are its controlled state, which only its own store atom can
hold from outside); what Confirm sends when the screen is behind; whether a save's answer says that it changed
nothing.

**Found sound by the review, and kept:** the one-frame wait before a move is settled, and the order atom giving the
table its rows.

**Older, seen in passing and left:** the catalog's own tagged unions still switched on by hand (`Upload.machine.ts`,
`UploadStep.screen.tsx`, an import's events in `ResultStep.screen.tsx`, `changedMeanwhile` in the item editor).

## The draft review and Benjamin's answers of 2026-11-20

The review of the rebuilt draft came back with 19 groups, and Benjamin answered three more questions. Head of this
section: `fa83274` and what follows it.

**The property, as it is now** (`Draft.machine.test.ts`). Each run draws 30 to 60 picks (`size: 60` is given to
the runner, with a minimum length), each drawn from the kinds enabled in the world as it stands. The runner grows
the size over the runs, so about the first half play 30 picks; a run ends early when nothing is enabled, and a few
enabled commands can change nothing, so a run is up to that many things that happened. What must hold is checked after every command, those of `quiet` included. Four
properties, 1,000 runs each: saves and reads; with the person confirming; with the page loaded again at any moment;
with somebody else confirming the import. A failure is thrown under its shortest ordering (each command left out that
it still fails without) with the rule that broke, in words. The world gained: the region's own state (reset by a
Restart, kept by a return inside the idle time); `told`, the latest revision the tab was told of; the rows the
browser keeps; the rows a closed import leaves over. The rules, beside the six above (rule 3 with no exception):

- whenever what the screen shows differs after an event that was not the person's decision, a Restart is among the
  effects, and what the region shows is what the draft shows;
- with nothing on its way and nothing waiting to be sent: no saved row waits for a picture nobody asked for, the
  picture held is not behind a revision the tab was told of, and when that revision is the server's latest what is
  shown is what the server holds (before any forced look);
- a confirm the server makes writes what its screen showed, carries only the person's own rows, and goes beside no
  save;
- a decision the person made is on the server, or still waiting on the screen and in the browser, never neither;
- once the step knows the import is closed, the draft has ended, nothing is sent from it, and the rows left over are
  exactly the person's rows the server never took.

What it found before any fix, each under its shortest ordering as it printed it (every ordering ends with everything
on its way landing):

- "what the screen shows changed without the person (SaveAnswered), and the region was not told to start again":
  Decide a kept, ServerTakesSave, SomeoneElse a out, OtherAnswerSent, OtherAnswerArrives. Group 1's first ordering.
- "the region shows another thing than the draft": Decide b kept, ServerTakesSave, SaveAnswers, SomeoneElse a out,
  OtherAnswerSent, Leave, OtherAnswerArrives, ComeBackQuickly. Group 1's second ordering.
- "the person's own save moved the view back": Decide c out, ServerTakesSave, Leave, SomeoneElse a kept,
  OtherAnswerSent, OtherAnswerArrives, SaveAnswers. Away from the step the draft does not follow the tab's view, so
  its own picture is behind it; the runner already keeps the later one. The rule is held to the step that is drawn. With every `Ask` taken out of the machine it prints
"nothing is on its way, and a saved row still waits for a picture nobody asked for" on two commands. What it cannot
reach: a read ended by a later save's answer (group 8; `put` re-issues the read, as the runner does today).

| Group | What became of it | Test |
| --- | --- | --- |
| 1 a save answered after a newer view; a return inside the idle time | Every transition is held to one rule after it has run (`told`): a change of what is shown that the person did not make restarts the region, and so does a draft let go while nobody looked. A draft let go keeps its epoch going | The property; `DraftRegion.test.ts` (the region reads the other person's row after it arrives). The wiring test of a quick return now fails without the let-go restart (`f8ef35e`): the old one gave the new view before the step's leaving was taken in, so the restart for a changed view covered it |
| 2 the no-change save | Closed by "Answer says 'no change'" (`7b09ee4`); the ten commands are a named test | Named test |
| 3 Confirm | Closed by "Refuse, show, confirm again" (`42c8303`); the confirm's `clear` has its test | Named tests, `ConfirmDraft.test.ts`, `ConfirmRevision.slow.test.ts` |
| 4 a SKU typed while a save is out | `typed` is worked out from what the server is known to hold, so the read goes out once the server has the SKU | Named test: the first answer sends the SKU and asks nothing, the second asks |
| 5 a save that failed waits on nothing | Rows that wait are sent again when a picture arrives; a line above the review stays while they wait, with Save again; the failed-save words never say "reload the page". What a reload does and what a confirm elsewhere does are Benjamin's answers, below | Named tests; `DraftRegion.test.ts` (the wired failure and Save again); seen on screen |
| 6 a waiting accept survives a match | Benjamin's answer "Server refuses, screen says so", below; atomic with the match since `4b06d1a` | below; `MatchAtomic.slow.test.ts` |
| 7 toasts outside the machine | Saying it is an effect (`Say`), returned only when a save was out; `SaveRefused` has the flight guard | Named test: a stray answer says nothing and changes nothing |
| 8 the read that is out is ended by a later save | `14d737e`, three faults of it fixed in `d1e31bf`: below | `Seed.atoms.test.ts`, `ReviewDraft.test.ts` |
| 9 Continue over a confirmed view | Closed by the confirm raising the revision (`42c8303`) | `ConfirmRevision.slow.test.ts` asserts the revision goes up |
| 11 the Items columns | `e7ca8df`: below | `ItemColumns.test.ts` through `applyColumnConfig`; seen on screen |
| 12 tags by hand | `laws tags` and the 65 places (`3c4515a`) | `Tags.test.ts` |
| 13 state outside atoms | The upload under way and the chosen workbook are atoms (`632fef8`). The given answer in `Api.atoms.ts` is an atom beside the request (`14d737e`) | The upload was seen on screen; the given answer's tests in `Seed.atoms.test.ts` |
| 14 hooks under other hoisted names | `laws boundaries` refuses a third-party package the importer does not declare, read from the syntax tree. No per-file exception to the atoms lint is left to restate: step 8 removed them | `Boundaries.test.ts`, with planted files |
| 15, 16, 17 | The property above; `DraftRegion.test.ts` for Restart and `announce`; `Dropped` is gone (nothing sent it) | as said |
| 18 | The no-change test sends such a save; the wired failure has its test. A remove that empties the draft and forgets the workbook has its test (`RemoveImport.test.ts`; it fails with the two lines taken out). `Api.atoms.ts` "not kept again when the screen leaves" and leaving the address of a removed import have their tests (`834ad53`) | as said |
| 19 | The statements in this file: the deleted saver, the ceilings, what the lint refuses, what the property held. 5efcd1b's message says "each filter control reads its values when it is drawn" for a commit whose list filters were empty: a commit message is not rewritten, so it is said here |  |

**Benjamin's answers of 2026-11-19 and 2026-11-20**, each in `DECISIONS.md` and the exploration's log:

| Answer | Built | Seen on screen |
| --- | --- | --- |
| "Effect atoms only" | `bc789bf`: the facets filter the rows in a derived atom | at the time |
| "Answer says 'no change'" | `7b09ee4`, repaired by `a15fce7` (the first went in with a test file that did not parse: committed before the check had passed) | at the time |
| "Refuse, show, confirm again" | `42c8303` | Two tabs on items_clean.csv: row 3 left out in one; "Import 25 items" in the other: commit 409, "Nothing was imported yet. 1 row was decided on another screen while you were reviewing…", 24 ready, 1 left out; pressed again: 24 imported |
| "Keep them and send them" | `fa83274`: waiting rows kept through `Atom.kvs`, back after a reload, sent again; the browser asks before leaving | Network down, row 130 left out: "1 decision is not saved yet"; the browser asked before the reload; after it the row was on screen with the line and "Undo: 1 row left out"; network back, Save again: `PUT` 200 with `madeOn: 4`, the line gone |
| "Name the rows, then drop them" | `fa83274`: the status reaches the machine; the result names the rows | Rows 55 and 191 left out and waiting; the import confirmed in another browser; Save again: 409, the result with "2 decisions of yours were not part of this import … Row 55: you left out, Row 191: you left out"; nothing kept after leaving the result |
| "Server refuses, screen says so" | `fa83274`: `madeOn` in, `notApplied` out, `AcceptsTakenBack` at the confirm | Unit cost matched again by a request from outside the tab (the Match step's own controls were not driven), then "Accept for the 2 ticked": answered `notApplied` for rows 55 and 191, "2 accepts were taken back", both rows still open |

**The rework review's groups 20 to 22**: `laws tags` and the table of step 7's checks (`3c4515a`); the review guide's
condition for the decisions atom (`edffca6`); the row height and the saved progress through `Atom.kvs` (`3285206`).

## The merge of main, and the groups that were not built (2026-11-20)

Main's "no `switch`" commit (`476d179`) came in as a merge (`ec6de4a`); its paragraph is under "Hand-written
discriminators" below. Then the groups the draft review's table above left open:

- **Group 8 and group 13's last part** (`14d737e`). An answer a screen gives a read (a save's view, a staged file's
  view) is an atom beside the request (`beside`), not a variable the read's atom empties inside its own read. A
  request that is out is never ended by it: it lands, and when something was given or learned while it was out it
  is asked once more (once, however many saves answered), the given answer staying on screen until then. The
  review's `Ask` calls `askAgain` with the time the last save or confirm was sent: a read that left after it is let
  land with nothing more asked. Test: three saves 2 ms apart behind a read of 30 ms.
- **Three faults of that build**, found by an independent review and fixed in `d1e31bf`: a given answer hid every
  later failure of the read (a removed import's review went on showing the saved view); a late landing of a read
  already let go released the hold of the read made since for the same member; the once more refreshed over a
  request that had left in the gap, ending it. A test for each, each failing with its fix taken out.
- **Counted from the answer** (`6b53d73`, the lead's ruling). The rule as first built (a read that left after the
  save was *sent* includes it) lost an `Ask` in two orderings: a read served before the save's write committed, and
  a save `callWrite` sent again after a failure, counted from its first try. A read must now have left after the
  server *answered* the write; one out before that lands and is asked once more. A test for each ordering, each
  failing with the old rule; the second goes through the app's own `callWrite` (the test registry can now).
- **The match is atomic with the stale-accept check** (`4b06d1a`). The match was three writes (a stamp from the
  handler's read, the field's accepts taken out by rewriting rows from an earlier read, then the choices), and a save
  checked the choices and wrote unguarded: in the windows, an accept made before the match was applied with
  `notApplied` empty, and a save landing mid-match was overwritten whole. Now `matchColumn` is one batch (the choice
  stamped in SQL with the revision that statement writes; the field's accepts taken out in SQL by name from the rows
  as they are; the audit line), and every write of a save holds only while the draft's choices are those it was
  checked against: otherwise `rematched`, and the handler checks it again on the new choices. The twin does the
  same. Slow tests (`MatchAtomic.slow.test.ts`) put the other person's write at the one place it can fall, through a
  stand-in around the real D1 store: a save between the match's read and write (fails with the stamp one revision
  earlier), a match between a save's check and write (fails without the guard), and a save just before the match's
  write (its leave-out stands).
- **A kept waiting row sent again over a decision somebody else saved since:** Benjamin answered ("Hold it, show both,
  ask"); built in the round below.
- **Group 11** (`e7ca8df`). Category and UoM in the toolbar are the kit's `DataTableFacetedFilter`, fed from
  `quickFilterOptions`; the toolbar is given `quick={[]}`. Only the Filter menu's values travel on the columns'
  meta. Every cell and heading is a named component at module level, and the editor's and viewer's columns are made
  once. The test puts the columns through `applyColumnConfig` with the page's config.
- **Group 18's two tests** (`834ad53`). A read let go within the idle time after its screen left keeps nothing but
  what lives for the page. Leaving the address of a removed import moved from the button's click into
  `removeImport`, where a test reaches it.
- **The twin's own check of the confirm's revision, and the quick return** (`f8ef35e`): above.

## The second review's groups, and group 3 decided (2026-11-20)

The review of `1171834..cf6ac58` confirmed 49 findings in groups; Benjamin then answered group 3's seven questions
(the exploration's `DECISIONS.md`, entries of 2026-11-20).

- **Groups 1 and 2** (`b784320`): a confirm never sends its rows to a closed import or drops rows decided while it was
  out; each row names its own revision (`madeOn` per row); the kept rows, the leave question and their tests.
- **Group 4** (`46b2c07`): the item editor saves on the revision its last save answered with.
- **Group 5** (`f922f9f`, `00f3f2d`): the review's virtual list and table get their options outside draws; refs,
  tags and boundaries laws refuse the forms that slipped past them, and every hand tag is a constructor.
- **Groups 6 and 7** (`7ab5b31`, `58d6f80`): the tests whose names said more than they held, and the documents.
- **Group 3** (`25e631a` the answers; `59d8c91` the contract's `kind`; `0bd8bc7` the server; `cb73739`, `59690da`,
  `1456964`, `e263a88` the screen): a re-match takes back a keep-or-replace, a keep-one-of-two and an undone fix
  that rested on the column, in the match's batch, the save and the confirm, each named by kind; a refused save holds
  its rows with the reason; a waiting row decided elsewhere since is held with both decisions; each tab keeps its own
  waiting rows and takes up only a gone tab's.
- **From the review of `b784320`** (`cb73739`, `1456964`): a held-back confirm records the revision it waits for and
  frees its button once the screen holds it; rows apart are counted from what was shown at the press; a closed
  picture outdated by a reopen no longer ends the draft; a refused or lost confirm offers no Save again, and the first
  picture after it that is not the step's own redraw answers it; the leave question is asked after a reload.

## The third review (2026-11-20): group 3 checked, 45 findings

The review of `cf6ac58..2fb8dbb` confirmed 45 findings (1 blocker, 14 major, 30 minor). Built in three lanes (server,
laws, screen), each checked by an independent reader, then three more passes on what each check found, and a last
read of the whole range by four readers:

- **G2 on every path** (`0844c01`, `d390d8d`, `de8ce87`, `8c00d3c`): a waiting row (stalled, sent before, kept across
  a reload, taken up from a gone tab) is never sent before a fresh picture at least as new as the one held has
  checked it; the picture a redraw gives again is not fresh; the values a row is known to have had are those sent;
  holds follow later pictures; a gone tab's decision beside this tab's is held ("From your other tab"); a held row
  holds the confirm, and the screen says why; Use mine and a row decided again keep their revision; a row the strip
  of a stale accept leaves empty is not sent, and a row the person put back is never dropped.
- **What a match took back is named** (`674a93b` the contract, `6c12973`): kept with the import by field and kind
  (`ImportView.takenBack`, migration 0003), in the match's guarded batch, counted in the audit line, named on every
  screen of the import until dismissed. G6 counts a row that stops reading as changed; one limit of tries in both
  stores, refused as `DraftBusy`; the save's and the confirm's writes are guarded on the stored items, created rows
  and suggestions their judgement read; a match's earlier answers hold only while the columns are the same.
- **Tabs and the session** (`0844c01`, `d390d8d`, `de8ce87`): one tab id for the tab's life (an atom, held from the
  app's start, the sign-in page included); an orphan is taken up under a lock; rows of a confirmed import taken up
  are named; sends and confirms go only for the rows' member, and wait while the session is asked again; another
  member's press only redraws; thisTab, keptKeys and lastAnswered are atoms; the item editor's saved items go with
  the sign-out.
- **Laws** (`9ca70b5`, `d390d8d`, `de8ce87`, `0636e39`): AnsweredBy and every finding of the laws are constructors read
  with match; the tags law reads every src and test folder, follows a tag through helpers, joins, lists, records and
  reassignment, and refuses P.isTagged with a string; no count-only exemption; the refs and boundaries laws close the
  listed holes, and the refs law's alias walk is bounded.
- **Departure, the lead's to accept:** the vendored `useDataTable` still sets the table's options in a draw (the
  comment says so); avoiding it means replacing the kit's hook.
- **On HOLD (Benjamin):** a Replace on a draft matched before migration 0002, where "changed" cannot be known; whether
  a tab the browser discarded or has not loaded yet counts as gone.

## Step 8: TanStack Query removed, the lint everywhere, the documents

**What went** (`1aa2788`): `packages/client/src/QueryClient.runtime.ts` and its test, the client's `./QueryClient`
export, `@tanstack/react-query` from the client's and the app's dependencies, the `QueryClientProvider` at the app's
root, the two lint exceptions that let them stand, and three helpers nothing called any more (the app's `call`,
`callWrite`, `fork` and `runExit`, the catalog's `call`). The atoms lint refuses `@tanstack/react-query` and
`@tanstack/query-core` by every path, so a read cannot come back as a query.

**The documents the move made false**, each brought to what the code is: `CLAUDE.md` ("Adding a feature" step 5; a
"State is atoms" line under UI; the upload, the session and the layout atoms where hooks were named), `docs/kit.md`
(reading and writing, the paged table's example, the search box, the upload), `docs/patterns.md` (a read by key, the
upload), `docs/standards/working.md` and `security.md`, `docs/auth.md`, `docs/review-table.md` (the props that are
atoms, the draft's functions, the column match and a fix's confidence as they are typed) and the README. Not touched:
`.claude/agents/frontend.md`, which still names TanStack Query and paths from before the packages; it is an agent's
own instructions, not on the brief's list.

**The final proof**, the dev server on a fresh database (`bun run db:reset`), headless Chromium, 1440 px unless said:

- The app opened signed in as Dana Whitfield. "Use items_messy.csv": the Review read "200 rows read · 20 values
  fixed for you", Needs a decision 24, Cannot import 21, Ready 155, All 200, and the button "Import 155, skip 45".
- A group accepted, Ctrl+Z, Ctrl+Shift+Z: three saves, each of the same two rows (set, clear, set). A refresh: the
  decision was there and the toolbar said "Undo: 2 fixes accepted"; Ctrl+Z took it back.
- Confirm: "Import 155 items? 45 items won't be imported (Needs a decision 24, Cannot import 21)". The Result: Not
  imported 45, Imported 155, Already there 0, All 200. Items: "155 items", 20 rows a page, "Page 2 of 8"; sorted by
  cost from the address, $862.53, $814.49, $807.76; "washer" typed, "7 of 155 items".
- An edit whose save was refused (the request answered 403 by the test): the row read "Brass Washer M6 changed" at
  once, then "Brass Washer M6" again, with the toast and "Edit again", which opened on what was typed; saved for
  real, "Saved AAT-7076".
- The assistant with no key: "Only components" gave `/items?category=components`, "29 of 155 items", "Answered by
  Rules · Filtered: Category is components"; its Undo, 155 again. A longer sentence: "The rules could not read … No
  AI key is set, so the rules answered."
- The take-back: "This removes the 154 items … It keeps the item someone changed since: AAT-7076 Brass Washer M6
  changed"; then "Took back 154 items from items_messy.csv, kept 1", Items "1 item", Activity "Decisions 20, Events
  4, Imports 1".
- People: three people, each with a role. From the user menu, Priya Raman (a viewer): the Import page said
  "Importing needs an editor", Items showed no pencil. Sign out: the sign-in page with its test accounts; "Sign in as
  Dana Whitfield" signed in.
- The dark theme from the menu: the page's class `dark`, kept as `dark`, light text on a near-black page, the lead
  button dark on green.
- 390 px: "Review again" on the taken-back import, the queue read Needs a decision 24, Cannot import 21, Ready 154,
  Already there 1, All 200, "Decision 1 of 20", "Import 154, skip 46", nothing scrolled sideways; an accept gave
  "Decision 2 of 20" with the focus on the next card's button; Undo, back.
- `items_50000.csv`: at Review after 12.9 s, drawn after 15.1 s, Needs a decision 3,250, Cannot import 3,250, Ready
  43,500, All 50,000; 40 jumps top to bottom in 3.5 s, 26 frames over 50 ms, the worst 183 ms, the last row drawn
  row 50,001.
- The console, read after each part: no error but the 403 the test made.

Not seen in this pass: the Match step (the sample's headings all match), a model's answer (no key), a second
organization's rows.

## Legacy in the client

None is left. The client's lint and the app's extend `.oxlintrc.atoms.json` with no exception: the two files the
client excepted by name (`QueryClient.runtime.ts` and its test) are deleted, and the app's `main.tsx` no longer
provides a query cache. The only exception to the atoms rule in the repository is the vendored kit
(`packages/ui/src/components`, `packages/ui/src/hooks`), by decision A1.

| File | What called it | Went at step |
| --- | --- | --- |
| `CurrentMember.controller.ts` (`useMember`) | the catalog screens | 6, with `Rollback.rules.ts` |
| `Optimistic.controller.ts` (`useOptimisticWriteVia`, `makeOptimisticWrite`, `cacheChange`) | the catalog screens | 6, with its test |
| `QueryClient.runtime.ts` | the app's `main.tsx`, and its own test | 8 |

## Hand-written discriminators in the web packages

A6's standing preference: a hand-written `type` or `kind` discriminator is a tagged enum (in memory) or a schema tagged
union (anything decoded). Found with `rg` over the six web areas, the vendored kit left out. Each is changed when its
package moves.

| Where | Union | Told apart by | Lives | Becomes | Step |
| --- | --- | --- | --- | --- | --- |
| `review/src/ReviewDraft.rules.ts` | `Action` (12 members) | `type` | in memory | `Data.taggedEnum`, `$match` in `act` (A6) (done: 11 members, `Undo` and `Redo` among them; `act` is one `$match`) | 7 |
| `review/src/ReviewDraft.rules.ts` | `OtherAnswer` | `type` | in memory | `Data.taggedEnum` (done: `Type`, `LeaveOut`, `Extra`) | 7 |
| `review/src/ReviewRegion.types.ts` | `ColumnMatch` | `state` | in memory (built from a staged file's headings) | `Data.taggedEnum` (done: `Matched`, `Unmatched`) | 7 |
| `review/src/ReviewRegion.types.ts` | `CellMark` | `state` | in memory | `Data.taggedEnum`, with `Option` for `fix` and `accepted` (done: `Proposed`, `Applied`; an applied mark's `fix` is an `Option` and `accepted` a boolean) | 7 |
| `review/src/ReviewRegion.types.ts` | `Entry`, `QueueEntry` | `type` | in memory | `Data.taggedEnum` (done: `Kind`, `Group`, `Rest`, `Row`) | 7 |
| `review/src/internal/ReviewGrid.tsx` | `Line` | `type` | in memory | `Data.taggedEnum` (done: `Entry` or the opened row's `Detail`) | 7 |
| `review/src/ReviewDecision.schema.ts` | `place` of a row's history | `kind` | stored in the saved draft | already a schema; a `S.toTaggedUnion("kind")` member set, encoded bytes unchanged | 7 |
| `catalog-web/src/internal/spreadsheet/read.ts` | what a chosen file is | `kind` | in memory | `Data.taggedEnum` (done: `Sniffed`, `Csv`, `Xlsx`, `Archive`, `Refuse`) | 6 |
| `catalog-web/src/Upload.controller.ts` | `UploadEnd`, `Failure` | `_tag`, by hand | in memory | `Data.taggedEnum` (done: `UploadEnd`, `$match` where the Upload step hears how it ended; `Upload.machine.ts`'s `UploadState` is already a schema union) | 6 |
| `access-web/src/SignIn.screen.tsx` | `Attempt` | `mode` | in memory | `Data.taggedEnum` (done: `SignIn`, `SignUp`, `$match` in the submit atom) | 3 |

Not discriminators, and not changed: string-literal domains with no data of their own (`RowStatus`, `FilterId`,
`ColumnSize`, `AgentRun`'s `status`), which are `LiteralKit`s where a schema needs them.

**After the merge of main (Benjamin's "no `switch`" commit of 2026-11-20).** His commit made the review package's
types schemas, and four of the unions above are now his forms, not this table's: `Action` is a literal kit's tagged
union on `type` (`{ type: "keep", rowId }`, read with `Action.match` or `matchOrElse`), `ColumnMatch` and `CellMark` are
`S.toTaggedUnion("state")` (`{ state: "unmatched", candidates }`, `ColumnMatch.guards.unmatched`), and `Entry` is
`S.toTaggedUnion("type")` (`kind`, `group`, `rest`, `row`). The branch's code that built or read them the enum's way
was converted to his. What the branch added to their fields stays: a fix's `confidence`, an applied mark's `fix` and an
undo step's `focus` are an `Option`, and `accepted` and `redo` are always there. `OtherAnswer`, `Sniffed`,
`UploadEnd` and `Attempt`, which his commit did not turn into schemas, stay tagged enums, and a grid `Line` is his
`Entry` or the opened row's `Detail`.

## Choices made

- **The review region is made in its own provider** (`RegionScope`, a `ScopedAtom`, in
  `packages/review/src/ReviewRegion.atoms.ts`; Benjamin's answer "ScopedAtom", 2026-11-19). Its parts read its atoms
  from the provider, not from props handed down. The same holds for everything that keeps state of its own while it is
  on screen: the grid, the phone's queue, the work list's strip, an overlay, a cut text, an edit form, and outside the
  review the search box, the list table and the two cell forms. No state is looked up by `useId`.
- **What the region works out is derived atoms** (Benjamin's answer "Derived atoms", 2026-11-19): the rows as they
  stand, the counts, the work list, the list on screen, the facets, the lines drawn, the stops of "Next problem", the
  column plan. The caller passes the rows, the columns, the re-check and the decisions with their undo as atoms; the
  region writes the decisions with every action and whoever keeps them reads them there, so `savedDecisions` and
  `onDecisionsChange` are gone, and so is `internal/remember.ts`. The Review step's decisions are one atom per import
  (`reviewState` in `ReviewDraft.atoms.ts`): a write shows them, sends them and keeps them with their undo.
- **The table's order is an atom that listens to the table** (`ordered` in `TableScope`). The sort and the search are
  TanStack Table's own state, a store outside React; the atom hears those two and cleans up with `get.addFinalizer`,
  as any atom over something outside does. The table is given its rows by a subscription on the rows the region gives
  it, in the change that works them out (`f922f9f`), never by a read: `ordered` only reads, and keeps its last order
  while the table does not hold the current rows yet.
- **The facets filter the rows before the table has them** (`shown`, after Benjamin's "Effect atoms only",
  `bc789bf`): a facet is not the table's column filter (`enableColumnFilter: false`), so nothing of the facets lives
  in the table's store. `@tanstack/store` is only a devDependency of the review package, for its test's table.
- **The virtual list is the grid's atom's** (`f922f9f`): the grid's atom holds the Virtualizer core (no
  `useVirtualizer` in our code), sets its count in the change that works the lines out, and no draw writes it.
- **After a decision the wanted move is an atom, followed with `useAtomSubscribe`** (the brief's row, and Benjamin's
  answer "No, follow the brief", 2026-11-19): `nav` holds where focus goes next, `moves` changes when the lines or the
  move do, and the region subscribes to it. The atoms change before the rows are drawn, so the subscription settles
  the move one animation frame later, when they are on screen; the move itself is read from the atoms then.
- **Every ref callback is the same function across draws**, and only sets up its own node: the region's section (says
  the region is on the page, and takes its toasts down when it goes), the strip (its scroll, its size, its wheel), a
  cut text (its size) and the shell's bar slot. `bun run check` refuses any other form (`laws ref-callbacks`, which
  reads each screen's syntax tree). No ref is chosen by a condition, and none sits on an element whose `key` is what
  makes it run: the phone's card and the assistant's newest line, which were such, follow an atom with
  `useAtomSubscribe` and put the focus, or the scroll, there one frame later.
- **Whether a rule group's accept leads is derived** (the brief's row: "the lead is derived state the parent reads").
  The grid's atoms are made above the region's body (`GridScope`), so the footer reads `grid.leadInView`. What is in
  view is the virtual list's own state (where the frame is scrolled to, how tall each line was measured): the grid
  listens to it as an atom listens to anything outside (`watch`, `told`), and `seen` is the lines in view. The list
  says nothing of a range that changes because the number of lines did (it learns the new number when it is next
  drawn), so `seen` gives the list that number before it reads the range, as `ordered` gives the table its rows.
- **The grid measures again and goes back to the top from `useAtomSubscribe`** (the brief's row): the lines the grid
  draws are a derived atom, and two derived signals say when their shape changed and when the list is another list.
  Bringing a row into view is the same: the region's ask is an atom, and the grid's `bring` is one function for the
  grid's life.
- **One cache is kept by hand, in a pure rule**: `untouched` in `ReviewDraft.rules.ts`, a `WeakMap` from a row to its
  view while nobody has decided on it. It predates this goal, is no hook's job, and is what keeps 50,000 undecided
  rows from being built again at every decision.
- **The rows not imported are written out at the press**, not kept in a link: the download is a button.
- **The region's actions are made once per region and read the atoms when they are pressed**, so the drawn rows keep
  their memo and no action reads a draw. A region whose section has left the page does nothing: its actions, its keys
  and a toast's Undo return at once, and its key listener is let go with it (no idle time).
- **The layout is one atom, and its context went** (`regionLayout` in `parts.tsx`): the context only passed down what
  ui's content width already says.
- **Saved progress is an atom per key over the browser's storage** (`SavedProgress.hook.ts`): the storage is the
  record, every write goes to it before the atom shows it, and an atom let go reads it again. `useSavedProgress` keeps
  its name and its shape, built from the atom hooks only.
- **`viewRows` reads a row's decision as an `Option`** (A6; Benjamin's answer "Option there too, measured",
  2026-11-19). Measured on 50,000 rows before and after that one change: an accept of 500 took 1.51 s and 1.28 s
  before, 1.16 s to 1.35 s after (four runs); Ctrl+Z 1.42 s and 1.27 s before, 1.06 s to 1.21 s after. Not slower.
- **`Fix.confidence` is an `Option` the caller always gives** (A6), so the catalog writes `O.some(proposal.confidence)`
  and the result's changes carry `O.none()` for a typed value.
- **The review's draft is a module with no screen in it** (`ReviewDraft.atoms.ts`): what the Review step holds
  for one import, the decisions it shows, how it follows the draft while it is open, and what a decision does. What
  the draft becomes is one pure transition (`Draft.machine.ts`); there is no saver.
- **A press of an optimistic write cannot be interrupted.** The registry lets a write's atom go 400 ms after its row
  or screen has left and interrupts what it started; a save must still land and clear up after itself.
- **An answer given to a read is a value the read takes once**, with the time it was given; it is not an atom. One
  that is taken is not kept past the read; one given to a read nobody ever opens stays until the read is let go
  (`letGo`) or the person signs out. A read can be let go for whoever is signed in, and a screen that still shows it
  then asks the server at once. Taking a given answer never ends a request that was out without a word: the server is
  asked again behind it.
- **What is built from a read's data is built from its answer** (`answerOf`), never from the read.
- **The theme is kept in plain `localStorage`, against the brief's wording.** Benjamin accepted it (2026-11-19).
  The brief names `Atom.kvs` for it. `Atom.kvs` stores the value as JSON (`"dark"` with its quotes), and
  `public/theme-init.js`, which sets the theme before the first paint so the page never flashes the wrong one, reads
  the bare word; every choice already stored would also be lost. `theme` is a writable atom over `localStorage`
  instead (`@inventory/ui`'s `Theme.provider.tsx`), with the same stored value as before.
- **The catalog's reads are atoms, and an answer the screen already has is given to them** (step 6). Each read is a
  `catalogApi.query` in `Imports.atoms.ts` or beside its screen, kept per import with `perKey` (a family that holds
  its members: `Atom.family`'s weak references lost an import's read after a garbage collection). A read can be given
  an answer (`registry.set(read, answer)`): the upload's answer, a save's, a match's, a confirm's and a take-back's
  are given to the import's read and its rows, so the screen moves on with no request; anything the answer may have
  changed elsewhere is asked again through its keys (`invalidate`). The staged rows are kept for as long as the page
  is open (`keep: "page"`), as TanStack Query kept them.
- **Writes whose outcome only the server knows do not retry** (`catalogApi.ask`): a match, a reopen, a take-back, a
  confirm, the fix suggestions and the assistant. They were plain calls before and never retried; `send` retries, as
  the optimistic edits did. The item editor and removing an open import are optimistic writes (`optimisticWrite`).
- **The Review step follows the import's revision from an atom** (`followDraft`, mounted by the step): when a newer
  revision arrives from another screen it puts the region back to it with the toast, and its own saves never count as
  someone else's. The skeleton-first wait is `useDeferredValue`, not a timer in an effect, with the first paint
  measured on 50,000 rows ("Fixes after the review of step 6", group 18).
- **ui's own pieces are atoms** (`ContentWidth.atoms.ts`, `Route.atoms.ts`, `Theme.provider.tsx`, the search box).
  The sidebar's state, the window's width and the room the page has are atoms in `@inventory/ui/ContentWidth`, so the
  step-4 bridge in the app is gone; the address is one atom over the app's own `navigate` and the back button (A5);
  each search box keeps what was typed in an atom of its own scope (`BoxScope`, a `ScopedAtom`), is given the table it
  searches, reads the search that table holds as an atom over the table's own state, asks for the typed text through
  `Atom.debounce`, and hears "/" and Ctrl+K from an atom mounted while the box is. The theme is a writable atom over
  `localStorage`, not `Atom.kvs`: `Atom.kvs` stores JSON (`"dark"` in quotes), which `public/theme-init.js` does not
  read before the first paint, and every choice already stored would be lost. `ListTable` works its config and its
  columns out as derived atoms of its own scope (`ListScope`), and keeps nothing by hand: the text a search tests a
  row by is put together when it is asked for (these lists are short: the server sends at most 5,000 rows, and the
  table keeps each cell's value itself).
- **Four readers of ui atoms stay as hooks for good**: `useLocation`, `useIsNarrow`, `useContentWidth` and `useTheme`.
  The vendored data table and toaster were edited at vendoring to call them, and the kit is not ours to change (A1).
  Each only reads an atom (`useAtomValue`), which the A1 line allows. Our own screens read the atoms; `catalog-web` and
  `review` move at their steps.
- **`ShellSlots` is one atom now** (`@inventory/ui/ShellSlots`, `barSlot`): the shell sets it by a ref callback and the
  import page portals its steps into it. Its second context, for the step's own actions, was never read by any screen
  and went (step 6).

- **The shell's state was in `apps/inventory/src/web/lib/shell.ts`** (gone at step 6: its last piece, the bar's slot,
  is `barSlot` in `@inventory/ui`). The sidebar is controlled from an atom
  (`sidebarExpanded`; it still writes its own cookie), whether it is a drawer is a media-query atom (the vendored
  sidebar's 768 px breakpoint), and the room it takes is derived from the two. Until the content-width store in
  `@inventory/ui` is an atom (step 5), one atom mounted by the shell passes that room on to it by subscription, never
  from a render. The bar's slot for a page's navigation is an atom set by a ref callback.
- **The development sign-in is an atom that signs in when read** (`SignedIn.tsx`), as the brief says: it reads the
  session, and only when nobody is signed in, the server offers test accounts and nobody signed out in this tab does it
  sign in and ask the session again; a failure is logged and the sign-in page drawn.
- **`main.tsx` kept the query cache's provider until step 8**, the one file of the app the atoms lint excepted by
  name. It provides the atoms' registry, the theme and the tooltips now, and the lint excepts nothing in the app.
- **A sign-out lets every read go at once; a switch keeps the person's reads** (Benjamin: "Keyed reads, and drop them
  on sign-out (Recommended)"). The five-minute keep is now a hold the client has on the read (`keepFor`: a mount and a
  timer), not the registry's own idle time, because the registry has no public way to let one atom go before its idle
  time: `forgetReads` releases every hold and forgets the per-member reads, and the registry lets them go after its
  400 ms. It runs when the session answers that nobody is signed in, and when sign-out or sign-in-as is about to
  reload the page (which drops everything anyway). A switch of organization does not call it: the person's reads for
  the organization they left stay kept for five minutes, and switching back shows them at once, marked updating.
  Tested: after a sign-out no read is held for anyone, in the held map or the registry, and the next person sees the
  skeleton, then their own rows, never the first one's; a switch and back shows the first organization's rows at
  once.

- **A read belongs to the member who asked; no new registry on a switch** (Benjamin since: "Keyed reads, and drop
  them on sign-out", above). The brief's
  rabbit holes say a sign-in or a switch of organization is "a new registry, through `RegistryProvider`'s React
  `key`". That key would have to change from something outside the registry it resets: a second registry holding the
  session, or a hook the rule now bans. Built instead, and kept in one place (`makeApiAtoms`'s `query` in
  `@inventory/client/Api`): every read is kept per `memberKey` ("member/organization"), so another member or
  organization starts from nothing (its skeleton, never the previous organization's rows marked waiting), and its
  previous reads are let go when nobody reads them. Atoms that are not reads of the API keep their state across a
  switch, as React state did when TanStack Query's cache was emptied. Sign-out and signing in as another account
  reload the page, as before.
- **The atoms and TanStack Query share what changed.** The client holds one Reactivity instance for the tab, not one
  per registry, so `invalidate(keys)` works from code that is not an atom; the query client (`BridgedQueryClient`)
  passed on every key a catalog screen invalidated, so the audit trail, an atom by then, asked again when an import was
  confirmed. The bridge went with TanStack Query at step 8; `invalidate(keys)` is what a write says now.
- **Two stand-in hooks until the app's shell moves (step 4):** `useSession` and `useAuditEvents` in `access-web` keep
  the fields the shell and the Activity page read, built only from the atom hooks; the shell then reads `session`,
  `actor` and `auditEvents` itself and they go.
- **A refused change is taken back at once** (Benjamin: "Take it back at once (Recommended)"). `Atom.optimistic`
  could not do it, so `@inventory/client/OptimisticAtoms` holds its own list of changes on their way over the read:
  the screen shows the read with each applied in order, a refused one leaves the list the moment it is refused, saved
  ones stay until the one refresh after the last answer has come. Tested: the refused name reads "Bolt" again while
  the other edit's "box" still shows, waiting; then the server's word after one refresh.
- **A page opened again shows what it had, then the fresh rows** (Benjamin: "Old rows at once, refreshed behind
  (Recommended)"). An unread answer is kept five minutes (`keepUnwatched`); every read is wrapped in `Atom.swr`, so a
  return shows the held rows at once and asks again on the next tick, the rows marked waiting until the answer. On
  screen the mark is the search box's spinner, labelled "Updating" (`ListTable`'s `updating`, on People and on
  Activity's events); the rows stay. After five minutes unread, a return starts from the skeleton. An answer under a
  second old counts as fresh: without that, a read answered before its first look was asked for twice (measured).
  Tested: a return shows the old rows at once, marked waiting a moment later, then the new ones.

- **The client's atoms** (`@inventory/client/Api`, `OptimisticAtoms`, `MemberAtoms`, files `*.atoms.ts`, the suffix
  beep-effect gives its atom files). One runtime, `apiRuntime`, whose layer the app gives the registry at the root
  (`provideApi`), so a web package makes its atoms at module level against the tag it declares (`makeApiAtoms(tag)`:
  `query`, `write`, `send`); the layer is the app's `ManagedRuntime`'s own services (`Layer.effectContext` of its
  `contextEffect`), so the atoms and the screens still on TanStack Query share one API client, one DevTools connection
  and one telemetry. A read keeps TanStack Query's rules: asked again once for a failure that may pass, never for a
  refusal; kept for `freshFor` (30 s) after nobody reads it (`Atom.setIdleTTL`), so a screen opened again shows it
  without asking; an answer equal to the one held keeps the held object (`keepWhenEqual`, what `sameWhenEqual` did).
  One difference: TanStack Query kept an unread answer five minutes and showed it while asking again; an atom drops it
  after 30 s and the screen shows its skeleton. A write retries as `callWrite` did. Failures stay the endpoint's own
  typed errors in the `AsyncResult`.
- **`member` is read through `memberSource`**, an atom the app points at its session at the root (`provideMember`),
  because the session is the access screens' (`access-web`), which `catalog-web` may not import; `actor` itself is
  the session atom, built in step 3.
- **The lint refuses the default import of `react` as well.** The brief tried the named and the namespace imports; a
  default import (`import React from "react"`, then `React.useEffect`) was not refused by them (tried on a planted
  file), so `default` is in the list. No file of ours had one.

- **The two writes in flight, measured before the optimistic write was built** (the brief's one unverified point).
  `Atom.optimistic` over a query atom, with one `Atom.optimisticFn` per press inside a concurrent `Atom.fn`: two edits
  of different fields, the second answered first, end with both values and **one** refresh of the source (two fetches
  in all: the first load and the refresh); the first failing and the second succeeding ends at the server's word after
  one refresh; both failing ends at the source as it was, with no refresh. One `optimisticFn` shared by every press is
  wrong: over a plain `Atom.fn` the second press interrupts the first write, so the first edit never reaches the
  server; over a concurrent one, the first write failing while the second was still on its way put the screen back to
  before both and never refreshed, so it showed the old value although the server held the second edit. So every
  press makes its own. One difference from TanStack Query, which put back a failed write's own change at once: here the failed change
  stays on screen until the last write in flight has answered, then the refresh shows the server's word. The toast
  says so at the moment of the failure. Recorded as tests (`packages/client/test/Optimistic.atoms.test.ts`, with the real `optimisticWrite`), beside the
  paging test (`Paging.atoms.test.ts`: the previous page's rows, marked waiting, until the next page has come).
