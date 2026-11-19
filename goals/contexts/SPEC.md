---
type: Goal
title: "Contexts"
description: The app's product code is cut into the bounded contexts access and catalog, each as contract, model, host and web packages, with @inventory/client shared by the two web packages and the HTTP contract brought to the schema rules on the way.
status: active
from: explorations/ideal-architecture
---

# Contexts

Step 7 of the order of work in [the ideal-architecture exploration](../../explorations/ideal-architecture/README.md).
The design is [BRIEF-contexts.md](../../explorations/ideal-architecture/BRIEF-contexts.md); its Sketch is the
specification. Built after [ui-packages](../ui-packages/SPEC.md).

## Objective

`@inventory/access-{contract,model,host,web}` and `@inventory/catalog-{contract,model,host,web}` hold the product,
`@inventory/client` the browser's plumbing; the app holds only the assembly, the system group, the shell and its
wiring. The contract obeys SF-1 to SF-9 with the wire and storage changes the brief lists, and no stored row is
rewritten.

## Non-goals

From the brief's No-gos: no migration, no column change, no rewrite of stored JSON; no event sourcing; no atoms; no
change to the import's rules or counts; no third context; drivers and the vendored kit untouched.

## Constraints

- The app keeps working at every commit: `items_messy.csv` (200 rows) imports to 155 stored, with the result screen,
  the Items table and the stored rows agreeing.
- Shape changes are made in the app first, with the screens that read them, then moved.
- Effect 4.1.4 only; `LiteralKit` for every literal union; Effect collections only.

## Acceptance

- [x] `check-boundaries.mjs` in the root check, failing on a planted forbidden import. Proof: a planted
  `@inventory/review` import in `packages/ui` fails with "imports @inventory/review, which @inventory/ui does not
  declare"; removed, 13 workspaces pass.
- [x] `@inventory/client` with the app switched to it. Proof: `check:full` 42 of 42 tasks; on a fresh database
  the messy sample reads "Import 155, skip 45", then "Not imported 45 · Imported 155 · Already there 0 · All 200",
  and Items says "155 items".
- [ ] `access-contract`, `access-model`, `access-host`, `access-web`, each with its proof from the brief.
- [ ] `catalog-contract`, `catalog-model`, `catalog-host`, `catalog-web`, each with its proof from the brief.
- [ ] Every wire change in the brief's two tables made, and no other.
- [ ] The existing slow tests (`Tenancy`, `Imports`, `TakeBack`, `People`, `Suggestions`, `Assistant`, `Auth`) pass.
- [ ] `bun run check:full` and the build pass on the last commit.
- [ ] Browser after `access`: People (add, change role, last-admin refusal, remove) and Activity.
- [ ] Browser after `catalog`: the full import with a decision made, undone and redone, a refresh mid-review, Confirm, result, take-back, Items (search, filter, editor), the table assistant with the model and by rules, the same at phone width.

## Decisions

[DECISIONS.md, "contexts brief", decisions 11 and 12](../../explorations/ideal-architecture/DECISIONS.md).
