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
- [x] `access-contract`, `access-model`, `access-host`, `access-web`, each with its proof from the brief. Proof:
  commits `1136292`, `c9a4c67`, `f2ce1e3`, `c31b00a`; 16, 11 and 3 tests in the first three; `check:full` 53 of 53
  tasks after the last; PLAN's "Choices made" has what was read on screen after each.
- [ ] `catalog-contract`, `catalog-model`, `catalog-host`, `catalog-web`, each with its proof from the brief.
  **Partly.** The four packages exist and the app runs on them (commits `f73b665`, `673618e`, `4e15f64`, `01954e9`;
  40 and 25 tests in the first two; `check:full` 64 of 64 tasks). Not built: the ports' in-memory twins and the
  tests over them (decision (C6)), `ConfirmPlan`, the `Answerer` and `ModelAllowance` ports, and the rest of
  PLAN's closing note, "What is owed".
- [x] Every wire change in the brief's two tables made, and no other. Proof: PLAN's "Choices made" has one entry
  per row of the catalog's table (timestamps, `Option`, `Stocking`, `RowOutcome`, `ColumnMatch`, `Suggestion`,
  `Change`, `RowDecision`'s flags unchanged, `ViewAnswer`, `UploadDiscard`, the 204, the 400 for `ItemInvalid`,
  `unitCost`, ids in paths, `createdIds`) with what was read on screen or on the wire. One thing beside the table:
  a sentence on the import page for an address that names no import (PLAN, "the ids are branded").
- [x] The existing slow tests (`Tenancy`, `Imports`, `TakeBack`, `People`, `Suggestions`, `Assistant`, `Auth`) pass.
  Proof: `check:full` on the last commit runs `test:slow`; the app's 155 tests pass, 31 files.
- [x] `bun run check:full` and the build pass on the last commit. Proof: 64 of 64 tasks, the build among them.
- [x] Browser after `access`: People (add, change role, last-admin refusal, remove) and Activity. Proof: on a fresh
  database, an unknown email read "Nobody has signed up with nobody@example.test yet."; Sam Okafor was added as
  editor and changed to viewer; Dana's demotion was refused ("Dana Whitfield is the only admin of Example Works
  (test). Make someone else an admin first.") and the select went back to admin; Sam was removed (204); Activity,
  Events listed "Removed a person", "Changed a role", "Added a person" above "Imported items" and "Uploaded a file".
- [ ] Browser after `catalog`: the full import with a decision made, undone and redone, a refresh mid-review, Confirm, result, take-back, Items (search, filter, editor), the table assistant with the model and by rules, the same at phone width.
  **Partly.** At desk width all of it was read (PLAN, "`catalog-web`"). At phone width: the import through Confirm,
  Items as cards, and the assistant by rules. Not seen at phone width: a decision undone and redone, the editor, a
  take-back, the assistant with the model.

## Decisions

[DECISIONS.md, "contexts brief", decisions 11 and 12](../../explorations/ideal-architecture/DECISIONS.md).
