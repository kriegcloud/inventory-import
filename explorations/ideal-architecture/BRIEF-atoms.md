---
type: Brief
title: "Brief: atoms"
description: The goal atoms. The front end's state moves from React hooks and TanStack Query onto effect/reactivity and @effect/atom-react, and useEffect leaves our code with no exception. Written only; nothing is built, and it starts after the Effect-imports migration is merged and Benjamin says "the brief matches".
---

# Brief: `atoms`

Benjamin's rule, in two messages: "Also no react hooks where effect/reactivity + @effect/react-atom should can be
used." and then "useEffect banned with no exceptions." The package he named is published as `@effect/atom-react`;
there is no `@effect/react-atom`. This brief uses the real name.

The rule reverses the answered decision "client state" (TanStack Query for the rebuild, atoms later), recorded as
"client state, reversed" in [DECISIONS.md](DECISIONS.md). It rests on section 2.3 and 2.4 of
[research/03-effect-modules.md](research/03-effect-modules.md), which said three things "must be rebuilt by hand";
this brief says how each is rebuilt.

Nothing here is built. **This goal starts after the "Effect imports as in beep-effect" migration is merged to
main.** That work rewrites the Effect imports of every file this goal would touch, so the two must not run together.

## Problem

The web packages hold their state three ways: React's own hooks, TanStack Query for what the server knows, and a
handful of house hooks over both. Effects run when React decides, outside every typed channel: a `useEffect` that
subscribes, measures, focuses or syncs cannot fail in a way a type sees, cannot be tested without a DOM, and is where
one bug of this rebuild came from (the editor that reopened nothing, because a refetched query's new object rebuilt
the table's columns and remounted it).

## The inventory

Counted in the worktree at `4bf0939` with one pattern per hook (a call, with or without `React.`). A hook's own
definition counts as one. "ui (own)" is `packages/ui/src` without `components/` and `hooks/`, which are the vendored
kit.

| Hook | app `src/web` | catalog-web | access-web | client | review | ui (own) | vendored components | vendored hooks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `useEffect` | 1 | 6 | 0 | 0 | 9 | 4 | 41 | 3 |
| `useLayoutEffect` | 1 | 0 | 0 | 0 | 2 | 0 | 22 | 2 |
| `useState` | 7 | 23 | 9 | 0 | 22 | 4 | 35 | 4 |
| `useReducer` | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| `useMemo` | 3 | 10 | 0 | 1 | 27 | 4 | 55 | 7 |
| `useCallback` | 2 | 8 | 0 | 0 | 11 | 0 | 194 | 0 |
| `useRef` | 0 | 10 | 0 | 0 | 24 | 2 | 58 | 5 |
| `useContext` | 0 | 1 | 0 | 2 | 1 | 1 | 33 | 0 |
| `useSyncExternalStore` | 0 | 1 | 0 | 0 | 0 | 3 | 8 | 0 |
| `useId` | 0 | 14 | 4 | 0 | 2 | 0 | 23 | 0 |
| `useImperativeHandle` | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| `useQuery` | 0 | 7 | 3 | 0 | 0 | 0 | 0 | 0 |
| `useMutation` | 0 | 7 | 3 | 1 | 0 | 0 | 0 | 0 |
| `useQueryClient` | 0 | 6 | 2 | 1 | 0 | 0 | 0 | 0 |
| `useUpload` | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| `useSavedProgress` | 0 | 2 | 0 | 0 | 1 | 0 | 0 | 0 |
| `useOptimisticWrite` | 0 | 2 | 0 | 1 | 0 | 0 | 0 | 0 |
| `useActor` | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `useMember` | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| `useApi` | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| `useIsNarrow`, `useContentBelow` | 2 | 3 | 0 | 0 | 2 | 7 | 1 | 0 |
| `useDecisionSaver`, `useImportCache`, `useDevelopmentSignIn` | 2 | 7 | 0 | 0 | 0 | 0 | 0 | 0 |

In our own code that is 20 `useEffect`, 3 `useLayoutEffect`, 65 `useState`, 45 `useMemo`, 21 `useCallback`, 36
`useRef` and 30 TanStack Query hook calls. The vendored kit holds 44 `useEffect` and 24 `useLayoutEffect` of its own.
`@tanstack/react-query` is imported in 16 files. `@tanstack/react-table`, `@tanstack/react-virtual` and
`react-hook-form` are also dependencies; they are not React's hooks, and whether they stay is decision A4.

The undo of the review region is not a hook of its own: it is `useState` over a pure state with `undo` and `redo`
transitions in `packages/review/src`.

### Every effect in our code, and what replaces it

There are no exceptions, so each has a named replacement. The kinds first:

| Kind | Replacement |
| --- | --- |
| A subscription to something outside React (a media query, a key press, a drag, another tab) | an atom that subscribes in its body and cleans up with `get.addFinalizer`, as Effect's own `Atom.windowFocusSignal` does; the component reads it with `useAtomValue`, or mounts it with `useAtomMount` when only the side effect is wanted |
| Measuring the DOM (a width, whether text is cut) | a ref callback on the element (React 19 runs its returned cleanup) that starts a `ResizeObserver` and writes an atom |
| Moving focus or scrolling after a change | a ref callback where a node appears; where a value changes, `useAtomSubscribe(atom, f)`, which runs `f` on each new value |
| A timer (paint, a pause in typing) | `Atom.debounce`, or an Effect with `Effect.sleep` in an atom from the runtime |
| Syncing to storage | `Atom.kvs({ runtime, key, schema, defaultValue })` |
| Syncing to the address | `Atom.searchParam`, or an atom over the app's own `navigate` (decision A5) |
| Fetching code ahead of need | the event that makes it needed (a state transition), not a render |
| Telling a parent that state changed | no effect at all: the parent reads the same atom |

The twenty-three, one by one:

| Where | What it does today | Replacement |
| --- | --- | --- |
| app `AppShell.tsx` (layout effect) | writes how much room the sidebar takes into the content-width store | the sidebar's state and the content inset are one derived atom; nothing is written from a render |
| app `SignedIn.tsx` | in development, signs in as the first test account once | an atom from the runtime that runs the sign-in effect when read, as an `AsyncResult`; the component reads it |
| catalog-web `ReviewStep` `usePainted` | waits a frame and a timeout so a heavy table is drawn after first paint | `useDeferredValue`, or an atom with `Effect.yieldNow`; decided when built, with the measured first paint |
| catalog-web `ReviewStep` (revision) | another tab or person moved the draft: resets decisions, bumps a key, shows a toast | the decisions atom is derived from the server's view and the local edits; `useAtomSubscribe` on the revision shows the toast |
| catalog-web `UploadStep` (drag) | window listeners for a file dragged over the page | a subscription atom: "a file is over the page" |
| catalog-web `UploadStep` (preload) | fetches the Review step's code while rows are saving | done in the upload machine's transition to Saving |
| catalog-web `TableAssistant` | scrolls the newest line of the conversation into view | a ref callback on the last line |
| catalog-web `ItemsPage` | corrects a page size or page number the address holds but the data cannot have | the address atom's schema decodes to a valid page; the clamp is in the derived query atom, so nothing is corrected after a render |
| review `ReviewRegion` (drawer preload) | fetches the phone drawers' code once narrow | done where `narrow` is derived, or on the first open |
| review `ReviewRegion` (two: keeps the parent's callback, tells the parent of each change) | calls `onDecisionsChange` after state changes | the decisions are an atom the parent passes in or reads; the callback and both effects go |
| review `ReviewRegion` (facets) | pushes filter values from saved state into the table | the table's filter state is derived from the atom and given to the table as controlled state |
| review `ReviewRegion` (after a decision) | moves focus or advances to the next row once the list has changed | `useAtomSubscribe` on the list, with the wanted move held in an atom |
| review `ReviewRegion` (keys) | undo, redo and navigation keys on the window | a subscription atom, mounted while the region is |
| review `ReviewGrid` (two: re-measure and scroll to top on a new list; tell the parent a lead row exists) | virtualizer upkeep and a callback | `useAtomSubscribe` on the list for the scroll; the lead is derived state the parent reads |
| review `ReviewQueue` | focuses the first action when the row changes | a ref callback keyed by the row |
| review `WorkList` | measures overflow and turns a vertical wheel sideways | a ref callback with a `ResizeObserver` and a wheel listener |
| review `parts.tsx` (layout effect) | measures whether a cell's text is cut, to offer the full text | a ref callback with a `ResizeObserver` writing a scoped atom |
| ui `Theme.provider` (two) | follows the system's dark setting; writes the `dark` class and the theme colour | a subscription atom for the system setting; the class is written by the atom that derives the resolved theme, mounted once at the root |
| ui `TableSearch` (two) | resets the draft when the value changes from outside; `/` and Ctrl-K focus the box | the draft is an atom derived from the value with `Atom.debounce` for the pause; a subscription atom for the keys |

## How beep-effect does it

Read in beep-effect's `.agents/skills/atom-reactivity-specialist/SKILL.md` and its packages:

- Its laws ban `useState`, `useEffect`, `useCallback`, `useMemo`, `useContext` and `useRef` for mutable state in new
  front-end code, with one stated exception: "`React.useRef` for DOM element refs (not state) is permitted".
- State is `Atom.make`, `Atom.readable`, `Atom.writable`, `runtime.atom(effect)` for what the server knows and
  `runtime.fn<Arg>()(effect, { reactivityKeys })` for a write; address state is `Atom.searchParam`, stored state
  `Atom.kvs`, component-scoped state `ScopedAtom.make`. Services are `Context.Service` classes given to
  `Atom.runtime(layer)`. No `Effect.run*` in a component.
- It checks the law with `rg`, not with a lint rule.
- It is not at zero itself: seven of its own `.tsx` files outside `components/ui` still call `useEffect`, beside
  393 uses of the atom hooks. Benjamin's rule here is stricter than his own repository is today.

## What is installed, and what was verified

`effect` 4.1.4 is installed and ships `effect/reactivity`: `Atom`, `AtomRegistry`, `AsyncResult`, `AtomHttpApi`,
`AtomRef`, `AtomRpc`, `Reactivity`, `Hydration`. Every export of them is marked `@stability unstable` (245 marks).
`@effect/atom-react` is **not** installed; its source was read in the Effect checkout at the same version, 4.1.4:
`useAtomValue`, `useAtom`, `useAtomSet`, `useAtomMount`, `useAtomRefresh`, `useAtomSuspense`, `useAtomSubscribe`,
`useAtomInitialValues`, `useAtomRef`, `useAtomRefProp`, `useAtomRefPropValue`, `RegistryProvider`, `ScopedAtom`. Its
peers are `react` 19 and `scheduler`. Its own implementation uses React's hooks (28 uses, `useSyncExternalStore`
among them), which is where hooks belong.

The three things research 03 said must be rebuilt by hand:

| What | How it is rebuilt | Verified |
| --- | --- | --- |
| **Keep-previous-data paging** (the Items table keeps its rows while the next page loads) | One query atom reads the page's parameters from another atom with `get`, not one atom per page from `Atom.family`. When the parameters change the atom runs again and its value is the previous result with `waiting: true` | In `Atom.ts`: a re-run returns `AsyncResult.waitingFrom(previous)`, and a finished run is `fromExitWithPrevious(exit, previous)`; `AsyncResult` carries `waiting` and `previousSuccess`. Not run |
| **Invalidate after the last write** (`useOptimisticWrite` today: several edits in flight refetch once, when the last one lands, so an older answer never overwrites a newer edit) | `Atom.optimistic(source)` over the query atom and `Atom.optimisticFn({ reducer, fn })` for the write: the reducer shows the value at once; "when successful transitions finish, the source atom is refreshed, and failures roll the value back to the latest source value" | The quoted sentence is `Atom.optimistic`'s own documentation, and its body refreshes the source from a `needsRefresh` flag as transitions finish. Whether two transitions in flight cause one refresh or two was not established by reading; it needs a test with two writes, which this goal writes first |
| **Undo per change** (the review region: every decision can be undone and redone, Ctrl-Z) | Not a library feature and does not need one. The region's state is already a pure value with `undo` and `redo` transitions; it moves from `useState` into one `ScopedAtom`, and each transition is a write | The transitions are in `packages/review/src` and tested there. `ScopedAtom.make` exists in `@effect/atom-react`; not run here |

Also read, and worth knowing before building:

- Invalidation is by key hash inside one registry: a write names `reactivityKeys`, and reads registered under those
  keys run again. `AtomHttpApi`'s `query` and `mutation` take `reactivityKeys`; a mutation invalidates only when its
  argument carries them, and not when it fails (research 03, 2.3).
- `AtomHttpApi` turns a schema error or a transport error into a defect. Today `sayError` gives words for those; the
  client must keep typed failures typed, so the API atoms are built on the existing `@inventory/client` calls, not
  on `AtomHttpApi` as it stands, unless that is changed upstream.
- `Atom.searchParam` writes with `pushState` and listens to `popstate`. The app's own `navigate`
  (`@inventory/ui/Route`) would not be heard by it (decision A5).
- `RegistryProvider` does not default `defaultIdleTTL`; pass it.
- A component that only writes must call `useAtomSet`, which mounts the atom, or its run can be disposed mid-flight.

Not verified: anything at run time. No atom was created, no component rendered, and `@effect/atom-react` was not
installed. Whether the review region's 50,000-row table keeps its speed when its state is an atom is unknown and is
measured before that package is moved.

## The line: what stays a hook

"Where it can be used" needs an exact line, since some hooks have no atom form. Proposed, and his to change (A1):

- **Banned in our code, with no exception:** `useEffect`, `useLayoutEffect`, `useInsertionEffect`.
- **Banned in our code:** `useState`, `useReducer`, `useMemo`, `useCallback`, `useContext`, `useSyncExternalStore`,
  `useImperativeHandle`, and every TanStack Query hook. Each has an atom form above.
- **Stays:** the hooks of `@effect/atom-react` (they only read, write or mount an atom); `useRef` for a DOM node
  only, as beep-effect has it; `useId` (an accessibility id has no state); `useDeferredValue` and `useTransition`
  (scheduling, not state).
- **Not ours:** `packages/ui/src/components` and `packages/ui/src/hooks`, the vendored kit, "as published, one exact
  export each". It holds 44 `useEffect`. Our code may call `useSidebar`, `useReactTable` and the like; it may not
  write a hook over React's state itself.
- **House hooks** become atoms with the same names without `use`: `actor`, `member`, `upload`, `savedProgress`,
  `contentWidth`. A screen calls `useAtomValue(actor)`.

## The lint

Tried with the installed oxlint 1.93 on a scratch file:

```json
{ "no-restricted-imports": ["error", { "paths": [
  { "name": "react", "importNames": ["useEffect", "useLayoutEffect", "useInsertionEffect"],
    "message": "No effects: an atom subscribes, a ref callback measures (BRIEF-atoms)." }
] }] }
```

It reports `import { useEffect } from "react"`, and it reports `import * as React from "react"` as well ("* import
is invalid because 'useEffect, useLayoutEffect' from 'react' is restricted"), so `React.useEffect` cannot be reached
through a namespace. A default import (`import React from "react"`) was not tried. The same rule with the second
list of names flags the other hooks; while packages are still being moved it is on only for the packages already
moved, and at the end it is on everywhere but `packages/ui/src/components` and `packages/ui/src/hooks`. A second
entry restricts `@tanstack/react-query` once the last package leaves it. `bun run check` runs it, as it runs the
`Map` and `Set` rule today.

## Decisions for Benjamin

The first option of each is the recommendation, with its reason.

### A1. Where is the line?

- **The line above (Recommended).** Effects with no exception; state hooks banned; `useRef` for a DOM node, `useId`,
  `useDeferredValue`, `useTransition` and the atom hooks stay; the vendored kit is not ours. It is beep-effect's own
  law plus his "no exceptions", and every banned hook has a replacement named in this brief.
- **Stricter: no `useRef` either.** Every DOM node is reached by a ref callback writing an atom. Uniform, and every
  virtualizer and focus call in the review region gets a layer it does not need.
- **The same line, and the vendored kit too.** His rule would hold in every file. The kit stops being "as
  published": 68 effects in components we did not write would be rewritten and then maintained by us against every
  upstream change.

### A2. Does TanStack Query leave the repository?

- **Yes, at the end of this goal (Recommended).** Two caches for server state is how a screen shows stale data; the
  rule already says atoms where they can be used, and they can. It leaves when the last package stops importing it,
  and the lint keeps it out.
- **It stays under the atoms.** A query atom wraps a TanStack query. Less to rebuild now; two machines to reason
  about for ever, and `useQuery` one import away.
- **It stays for the Items table only.** The one screen with paging keeps what works. An exception to a rule he
  wrote without exceptions.

### A3. In what order do the packages move?

- **Smallest first: `client`, `access-web`, the app's shell, `ui`'s own pieces, `catalog-web`, then `review`
  (Recommended).** `client` first because every screen's server state goes through it; `review` last because it has
  the most state (22 `useState`, 9 effects, the 50,000-row table) and by then every pattern has been used once.
- **`review` first.** The hardest is proved before anything depends on the approach. The first thing built is then
  the one most likely to be rebuilt.
- **All at once.** No package is ever half moved. The app is broken between commits, which the house rule forbids.

### A4. Do TanStack Table, TanStack Virtual and react-hook-form stay?

- **They stay (Recommended).** They are not React's state hooks, the vendored tables are built on them, and their
  state can be controlled from an atom. Replacing a virtualizer is its own goal with its own measurements.
- **They leave too.** One state machine everywhere. A table engine, a virtualizer and a form library to write, in a
  goal about hooks.

### A5. What holds the address?

- **An atom over the app's own `navigate` (Recommended).** The import's id and step, and the Items table's page and
  filters, are already in the address through `@inventory/ui/Route`; one atom reads and writes it there, so links,
  the back button and a refresh behave as they do now.
- **`Atom.searchParam`.** Effect's own. It does not hear the app's `navigate`, so every navigation in the app would
  move to it in the same change.

## Rabbit holes

- **The review region's speed.** Its table stays fast because edits touch one row's state. Measure before and after
  with the 50,000-row file; if one atom for the whole state redraws the table, the state splits by row with
  `Atom.family`.
- **Two writes in flight.** The one unverified point of the three rebuilds. A test with two edits and a slow first
  answer is written before `useOptimisticWrite` is replaced.
- **Typed failures.** A defect is not a sentence for a person. Every API atom keeps `sayError`'s typed failures.
- **Sign-in, switching organization and sign-out drop every cached query today.** With atoms that is a new registry,
  through `RegistryProvider`'s React `key`.
- **Unstable modules.** Every reactivity export may change in a patch release. `effect` and `@effect/atom-react` are
  pinned to one exact version together.
- **Tests.** Today's screen tests render with a query client. They get a registry, and a test layer through
  `Atom.initialValue(runtime.layer, TestLayer)`.
- **The strict ceilings.** Each moved package's count must fall or hold, never rise.

## No-gos

- No change to what a person sees or to any rule, count or sentence.
- No edit to the vendored kit, unless A1 says so.
- No server-side rendering, hydration or `AtomRpc`.
- No new state library beside atoms.
- Nothing started before the Effect-imports migration is merged.

## Proof (the definition of done)

1. The lint: no `useEffect`, `useLayoutEffect` or `useInsertionEffect` import in our code, and none of the banned
   state hooks, held by `bun run check`.
2. `git grep "@tanstack/react-query"` finds nothing, if A2 says so.
3. Tests of the three rebuilds: the previous page's rows stay while the next loads; two edits in flight end with the
   newer value and one refresh; undo and redo on the region's atom.
4. The existing tests pass, moved to a registry.
5. After each package, `bun run check:full` and a browser pass on a fresh database: `items_messy.csv` through
   Confirm with the three numbers read (200 rows, 155 imported, 155 stored), an item edited twice quickly, undo and
   redo in the review, the Items table paged and filtered with a refresh, sign-out and sign-in as another account,
   phone width, both themes.
6. The override sum no higher.

## Order of moves

After the Effect-imports migration is merged. Each step ends with `check:full` and the browser pass, and leaves the
app working.

1. `@effect/atom-react` added at 4.1.4; a `RegistryProvider` at the root beside the query client; the lint rule
   written and on for no package yet. The test of two writes in flight.
2. `@inventory/client`: the runtime, the API atoms with typed failures, the optimistic write as an atom, `actor` and
   `member`.
3. `@inventory/access-web`: sign-in, People, the audit events.
4. The app's shell: the content width, the development sign-in, the Activity page.
5. `@inventory/ui`'s own pieces: the theme, the table search, content width, the run log.
6. `@inventory/catalog-web`: the upload, the Items page and its editor, the assistant, the import's steps.
7. `@inventory/review`: the region's state with undo, saved progress, the grid, the queue.
8. TanStack Query removed (A2); the lint on everywhere; the documents the move made false (`CLAUDE.md` "Adding a
   feature" step 5 and "UI", `docs/patterns.md`).
