---
type: Goal
title: "Atoms"
description: The front end's state moves from React's hooks and TanStack Query onto effect/reactivity and @effect/atom-react, package by package, with useEffect gone from our code with no exception and TanStack Query gone from the repository at the end.
status: active
from: explorations/ideal-architecture
---

# Atoms

The design is [BRIEF-atoms.md](../../explorations/ideal-architecture/BRIEF-atoms.md), signed "The brief matches
(Recommended)"; its tables of hooks and effects are the specification. The decisions are A1 to A6 in
[DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md). Benjamin's rule, in his words: "Also no react hooks
where effect/reactivity + @effect/react-atom should can be used." and "useEffect banned with no exceptions." (the
package is `@effect/atom-react`).

## Objective

Every web package holds its state in atoms: server state in query atoms from one runtime, writes in function atoms with
reactivity keys, an optimistic write as `Atom.optimistic` with `Atom.optimisticFn`, the address in one atom over the
app's own `navigate` (A5), stored state in `Atom.kvs`. Our code calls no `useEffect`, `useLayoutEffect` or
`useInsertionEffect`, and none of `useState`, `useReducer`, `useMemo`, `useCallback`, `useContext`,
`useSyncExternalStore`, `useImperativeHandle` or a TanStack Query hook (A1). What stays: the hooks of
`@effect/atom-react`, `useRef` for a DOM node only, `useId`, `useDeferredValue`, `useTransition`. The review's state is
remodelled in the same pass as its move (A6).

## Non-goals

From the brief's No-gos: no change to what a person sees or to any rule, count or sentence; no server-side rendering, hydration or `AtomRpc`; no new state
library beside atoms. TanStack Table, TanStack Virtual and react-hook-form stay (A4).

The brief's no-go "no edit to the vendored kit" ended on 2026-11-22 (decision "atoms A1, the kit too"): the kit
(`packages/ui/src/components`, `packages/ui/src/hooks`) moves to atoms under the same rule as our code, the data
table first. A changed file is no longer as published: it is marked as changed here, and a later update of it from
its registry is merged by hand. PLAN.md, "The kit on atoms", has the batches.

## Constraints

- Order (A3): `client`, `access-web`, the app's shell, `ui`'s own pieces, `catalog-web`, then `review`. The app works
  after every commit.
- `effect` and `@effect/atom-react` are pinned to one exact version together (4.1.4): every reactivity export is
  marked unstable.
- Every API atom keeps its failures typed; a defect is not a sentence for a person.
- The strict ceilings only fall; their sum stays at most 657.
- The schema rules ([schema-first.md](../../docs/standards/schema-first.md)) and the Effect imports
  ([effect-imports.md](../../docs/standards/effect-imports.md)) bind every file touched.

## Acceptance

- [ ] The lint (`.oxlintrc.atoms.json`) refuses the effect hooks and the state hooks in our code, held by
  `bun run check`, on in every package by the end.
- [ ] `git grep "@tanstack/react-query"` finds nothing (A2), and the lint refuses it.
- [ ] Tests of the three rebuilds: the previous page's rows stay while the next loads; two edits in flight end with the
  newer value and one refresh; undo and redo on the region's atom.
- [ ] The existing tests pass, moved to a registry.
- [ ] After each package: `bun run check:full` and a browser pass on a fresh database (PLAN, "Proof").
- [ ] At the end, on a fresh database: `items_messy.csv` through Confirm with the three numbers read (200 rows, 155
  imported, 155 stored); undo, redo and a refresh mid-review; the Items table paged, sorted, searched, an edit with a
  failed save rolled back; the assistant; a take-back; People; Activity; sign-in and sign-out; phone width; dark theme;
  a 50,000-row file scrolled in the review region; the console read for errors.
- [ ] `Action` is a `Data.taggedEnum` with an exhaustive `$match` in `act`; `Outcome`, `UndoStep` and `RowDecision` use
  `Option` for absence, no `except?:` arrays, `revert.how` a named literal domain (A6).
- [ ] The hook count of the brief's inventory, before and after, in PLAN.

## Decisions

[DECISIONS.md](../../explorations/ideal-architecture/DECISIONS.md): "client state, reversed", "atoms A1" to "atoms A5",
"atoms brief" and "atoms A6".
