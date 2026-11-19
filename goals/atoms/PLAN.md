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
| 6 | `@inventory/catalog-web`: the upload, the Items page and its editor, the assistant, the import's steps | todo |
| 7 | `@inventory/review`: the region's state with undo, saved progress, the grid, the queue; the A6 remodel | todo |
| 8 | TanStack Query removed (A2); the lint everywhere; the documents the move made false | todo |

## Current blocker

None. Before step 7: Benjamin has an uncommitted edit to `packages/review/src/ReviewDecision.schema.ts` in the main
checkout; step 7 waits until it is here.

## The hook count

Counted with one pattern per hook (a call, with or without `React.`), as the brief's inventory. "ui-own" is
`packages/ui/src` without `components/` and `hooks/`.

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

## Legacy in the client

The client's lint is on (`packages/client/.oxlintrc.json` extends `.oxlintrc.atoms.json`), with three files excepted by
name (four until step 3, when `useApi` and its context went with their last caller): the React and TanStack Query forms the screens still call. None may gain a caller; each goes when its last
caller has moved.

| File | What still calls it | Goes at step |
| --- | --- | --- |
| `CurrentMember.controller.ts` (`useMember`) | `catalog-web` (five screens), the app's `Workspace.tsx` | 6 |
| `Optimistic.controller.ts` (`useOptimisticWriteVia`, `makeOptimisticWrite`, `cacheChange`) | `access-web` (People), `catalog-web`, the app's `lib/api.ts` | 6 |
| `QueryClient.runtime.ts` | the app's `main.tsx` and `lib/queries.ts`, `Workspace.tsx`'s prefetch | 8 |

## Hand-written discriminators in the web packages

A6's standing preference: a hand-written `type` or `kind` discriminator is a tagged enum (in memory) or a schema tagged
union (anything decoded). Found with `rg` over the six web areas, the vendored kit left out. Each is changed when its
package moves.

| Where | Union | Told apart by | Lives | Becomes | Step |
| --- | --- | --- | --- | --- | --- |
| `review/src/ReviewDraft.rules.ts` | `Action` (12 members) | `type` | in memory | `Data.taggedEnum`, `$match` in `act` (A6) | 7 |
| `review/src/ReviewDraft.rules.ts` | `OtherAnswer` | `type` | in memory | `Data.taggedEnum` | 7 |
| `review/src/ReviewRegion.types.ts` | `ColumnMatch` | `state` | in memory (built from a staged file's headings) | `Data.taggedEnum` | 7 |
| `review/src/ReviewRegion.types.ts` | `CellMark` | `state` | in memory | `Data.taggedEnum`, with `Option` for `fix` and `accepted` | 7 |
| `review/src/ReviewRegion.types.ts` | `Entry`, `QueueEntry` | `type` | in memory | `Data.taggedEnum` | 7 |
| `review/src/internal/ReviewGrid.tsx` | `Line` | `type` | in memory | `Data.taggedEnum` | 7 |
| `review/src/ReviewDecision.schema.ts` | `place` of a row's history | `kind` | stored in the saved draft | already a schema; a `S.toTaggedUnion("kind")` member set, encoded bytes unchanged | 7 |
| `catalog-web/src/internal/spreadsheet/read.ts` | what a chosen file is | `kind` | in memory | `Data.taggedEnum` | 6 |
| `catalog-web/src/Upload.controller.ts` | `UploadEnd`, `Failure` | `_tag`, by hand | in memory | `Data.taggedEnum` (`Upload.machine.ts`'s `UploadState` is already a schema union) | 6 |
| `access-web/src/SignIn.screen.tsx` | `Attempt` | `mode` | in memory | `Data.taggedEnum` (done: `SignIn`, `SignUp`, `$match` in the submit atom) | 3 |

Not discriminators, and not changed: string-literal domains with no data of their own (`RowStatus`, `FilterId`,
`ColumnSize`, `AgentRun`'s `status`), which are `LiteralKit`s where a schema needs them.

## Choices made

- **ui's own pieces are atoms** (`ContentWidth.atoms.ts`, `Route.atoms.ts`, `Theme.provider.tsx`, the search box).
  The sidebar's state, the window's width and the room the page has are atoms in `@inventory/ui/ContentWidth`, so the
  step-4 bridge in the app is gone; the address is one atom over the app's own `navigate` and the back button (A5);
  each search box keeps what was typed in its own atom (by `useId`), the change from elsewhere worked out at draw time
  instead of in an effect, and "/" and Ctrl+K heard by a ref callback on the field. The theme is a writable atom over
  `localStorage`, not `Atom.kvs`: `Atom.kvs` stores JSON (`"dark"` in quotes), which `public/theme-init.js` does not
  read before the first paint, and every choice already stored would be lost. `ListTable` keeps its config by the
  columns' shape and its columns by the arrays they are made from (a `WeakMap`), with no hook.
- **Four readers of ui atoms stay as hooks for good**: `useLocation`, `useIsNarrow`, `useContentWidth` and `useTheme`.
  The vendored data table and toaster were edited at vendoring to call them, and the kit is not ours to change (A1).
  Each only reads an atom (`useAtomValue`), which the A1 line allows. Our own screens read the atoms; `catalog-web` and
  `review` move at their steps.
- **`ShellSlots` keeps its two React contexts until `catalog-web` moves**: `createContext` is not on the banned list,
  the app provides the bar's slot from its atom, and the import page that reads them is the catalog's (step 6).

- **The shell's state is in `apps/inventory/src/web/lib/shell.ts`.** The sidebar is controlled from an atom
  (`sidebarExpanded`; it still writes its own cookie), whether it is a drawer is a media-query atom (the vendored
  sidebar's 768 px breakpoint), and the room it takes is derived from the two. Until the content-width store in
  `@inventory/ui` is an atom (step 5), one atom mounted by the shell passes that room on to it by subscription, never
  from a render. The bar's slot for a page's navigation is an atom set by a ref callback.
- **The development sign-in is an atom that signs in when read** (`SignedIn.tsx`), as the brief says: it reads the
  session, and only when nobody is signed in, the server offers test accounts and nobody signed out in this tab does it
  sign in and ask the session again; a failure is logged and the sign-in page drawn.
- **`main.tsx` keeps the query cache's provider** until TanStack Query leaves (step 8): the one file of the app the
  atoms lint excepts, by name.
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

- **A read belongs to the member who asked; no new registry on a switch** (asked of Benjamin, not decided). The brief's
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
  passes on every key a catalog screen invalidates, so the audit trail, an atom now, asks again when an import is
  confirmed. It goes with TanStack Query (step 8).
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
