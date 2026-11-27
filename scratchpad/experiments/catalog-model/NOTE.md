---
status: open
started: 2026-11-27
template: verify
libraries: 
---

# catalog-model

Does the whole catalog model verify against the package's lock when every block is written to the module taxonomy, with defaults on its schemas?

Asked by [explorations/module-taxonomy](../../../explorations/module-taxonomy/README.md). It replaces `command-file`
and `import-module`, dropped on 2026-11-27 (`scratchpad/LOG.md`; their files are in history at `ba3ac17f`).

## What is here

| Path | What it is |
| --- | --- |
| `baseline/` | the package's twelve files (`packages/catalog/model/src` at `a184783d`), copied unchanged: the control |
| `model/` | the same model, 3 aggregates and 4 decisions, written to the taxonomy: 53 files, and 11 trial files |
| `CatalogModel.test.ts` | Verify on each, against its own copy of the package's lock, run with `CI=true` |
| `model/Trial.model.ts`, `TrialBlocks.test.ts` | one trial block of each read and reaction kind, and a story for each |

`bun run scratch:test catalog-model` runs both (about five minutes). One alone:
`CI=true bunx vitest run experiments/catalog-model/CatalogModel.test.ts -t "every block in a file"` from `scratchpad/`.

## The shape

One block to a file, the file named `<Tag>.<kind>.ts` and read as a namespace named for its stem.

| File | Exports | Read as |
| --- | --- | --- |
| `<Tag>.event.ts` | `Event`, `evolve` | `ImportStaged.Event`, `ImportStaged.evolve` |
| `<Tag>.command.ts` | `Command`, `decide`, the rejections only it returns | `StageImport.Command`, `DecideRow.decide` |
| `<Noun>.state.ts` | each case by name, `State`, `guards`, `cases`, `isAnyOf`, the invariants, what is worked out of a state | `RowState.Decided`, `RowState.guards.Decided` |
| `<Noun>.transition.ts` | every rule of a step, each under its own name | named imports, listed in the aggregate or the decision |
| `<Union>.union.ts` | one tagged union, the file named for it (`ImportEvent.union.ts`, `RowEvent.union.ts`) | `ImportEvent.guards.ActCounted` |
| `<Noun>.rejection.ts` | the rejections more than one command returns | named imports |
| `<Noun>.schema.ts` | a value several blocks share, with what is worked out of it | `Level`, `seal` |
| `<Noun>.aggregate.ts`, `<Noun>.decision.ts` | the class, and nothing but a listing | `Import`, `Deciding` |

A kind with more than five files in its module has a folder named for its plural, its union beside the files it
joins: `Import/commands/` (seven and `ImportCommand.union.ts`) and `Import/events/` (nine and `ImportEvent.union.ts`).
`Row/`, `Group/` and `Review/` stay flat, and no file is named `index.ts` (the exploration's decision 8).

A decision's command file holds its `decide` too, typed by `Domain.Decision.Read<typeof Import>`, so a decision's file
is a listing as an aggregate's is: `decide: DecideRow.decide`.

## What was tried

`model/` was made from `baseline/` by scripts (not kept), then changed by hand:

- every event of `Import`, `Row` and `Group` to a file with its `evolve`; every command to a file with its `decide`,
  the four decisions' commands included;
- every state to a `.state.ts` whose cases are branded `S.Opaque` classes with each field described by
  `S.annotateKey` (the comments that sat on the fields before), the union under the name `State`;
- all 124 transitions (23 of `Import`, 2 of `Row`, 9 of `Group`, 26, 29, 20 and 15 of the four decisions) to
  `.transition.ts` files, each `export const Name: Rule = <the rule's text, unchanged>`, listed by name;
- starting values on the schemas: the ten counts of an open import start at zero, a decided group's `undoneAt`
  starts at 0, and no `make` of a state writes its `status`. `ImportStaged`'s `evolve` is
  `ImportState.Open.make({ organizationId, rows, columns })`;
- a state changed within its case is `Case.make({ ...s, field })`, since a branded case is not a bare object.

Two patches to the library made this possible, both in `packages/patches` with their own tests
(`docs/patches.md`): `04-a-rule-by-its-name` (the lock keeps the text of the rule a name is declared as) and
`05-a-structs-defaults` (the prover reads a constructor default that is a number, a text, a truth or `null`).

## What was found

- **The whole model verifies against the package's lock, unchanged.** Nothing undone, nothing relocked, the 134 rules
  the lock requires proved, the search three commands deep, in 129 seconds; the lock's copy is the package's byte for
  byte afterwards. The package's own `verify` passes with the two patches installed (172 seconds).
- **A wrong change in a moved place is caught.** On a copy, not kept, with three changes at once: a decision's rule
  weakened in its `.transition.ts` (`===` made `>=`) was refused by the lock by name ("DecideRow.AndGetsTheNextNumber
  changed from the rule locked"); a group's `undoneAt` defaulting to 1 broke `DecideGroup.InForce` and three of the
  model's invariants; and the check for a step already taken, deleted from `DecideGroup.command.ts`, broke
  `DecideGroup.AStepDecidesOneGroup`.
- **The prover reads a state case written as a branded `S.Opaque` class**, its `make` with defaults, and a spread of
  the same case inside `make`.
- **A field whose schema is an `S.Opaque` class loses its brand under `S.annotateKey`**: `under: Level` and
  `undone: Undone` are left bare, and the class's own description stands for them.
- **A default shared between cases needs a call for each field.** `S.withConstructorDefault(...)` kept in a `const`
  and piped into fields of two types gives `unknown`; each count pipes its own.
- **The diagnostics are clean**: `bun run scratch:check` passes with every Effect diagnostic as an error.

## What was left as it was, and why

- **`Imported` and `TakenBack` take no default.** Their counts are carried from the state before; a default there
  would turn a forgotten field into a silent zero.
- **`Level` and `Undone` take no default**, and `noLevel`, `letGo` and `noUndo` stay written out. Their fields say who
  made a decision and when (provenance), and the prover refuses a default that is a struct.
- **`status` stays the discriminator** and every rule's text is as the lock holds it.
- **`inForce` and the other helpers of `Catalog.model.ts` stay in it**: only the model's invariants call them.
- **The rules carry no example in their JSDoc.** A rule is held by its proof and its mutants; an example would be a
  second, unproved statement of it.

## The blocks to come, tried

One trial block of each kind the model does not have yet, each in the home the exploration's decision 9 gives it,
listed in `CatalogTrial` beside the same aggregates and decisions. Trial blocks only: none is copied into a package.

| File | Kind | Live |
| --- | --- | --- |
| `Import/ImportStatus.view.ts` | view | none: it declares no middleware and no rejection |
| `Import/ForgetMember.rewrite.ts` | rewrite | none: it is pure |
| `Draft/ImportActs.stream.ts` | stream, with its one entry event | none |
| `Draft/DraftRows.projection.ts` | projection | same file, through `DraftStore` |
| `Draft/DraftStore.port.ts`, `DraftStore.memory.ts` | port and its in-memory twin | |
| `Draft/ImportReview.query.ts` | query, paged | same file, through `DraftStore` |
| `Suggestion/Suggester.external.ts` | external system | declaration only; its adapter is the host's |
| `Suggestion/SuggestionPass.saga.ts` | saga | same file |
| `Suggestion/SuggestOnAsk.policy.ts` | policy | same file |

What it found:

- **The decided layout holds every kind.** Each block type-checks with every Effect diagnostic as an error, takes a
  trailing `{ description }`, and has a story that passes: the view after a command, the policy starting the saga and
  the saga calling the external system, the projection writing the store and the stream and the query reading it
  back and refusing another organization, and the rewrite seen through the view.
- **The lock does not see them.** On a copy, not kept, with the view, policy, projection, stream, saga and query
  listed in `Catalog` itself: nothing relocked, the lock byte for byte the same, the search as before (19,862
  sequences three commands deep).
- **Verify does, twice.** The same run was not verified. It reports the saga and the policy as not followed unless
  the test says `allow: { skipped: [...] }`, and 90 of the 185 sequences it replays as stories end with the stubbed
  external system's call unanswered. A model with a saga that calls out needs its Verify given an adapter that
  answers, or the reaction skipped by name.
- **A stream's writer is keyed like the stream**, so `DraftRows` reads `Row` and is keyed by the import, with a
  `keyOf`. `RowDecided.importId` is a plain text and `ImportKey` is branded, so `keyOf` goes through
  `ImportKey.makeOption`.
- **An append that type-checks can die.** `acts.append({ key }, entry)` is accepted by the types and refused at run
  time ("Only the projection that lists ImportActs in `writes` may append to it, with the input it is handling"): it
  takes the handler's own input object.
- **A port's key follows its file's path** (the `deterministicKeys` diagnostic), so it changes when the file moves
  into a package.
- **A rewrite needs a read that shows what it rewrites.** `ImportStatus` carries `askedBy` for that; a projection
  that reads the rewritten aggregate would need a `rewrite` handler of its own.

What was awkward in the layout:

- **A port's row schema has no home of its own.** `DraftRow` sits in `DraftStore.port.ts`, as the library's own
  ledger example does. The other choice is `Draft/DraftRow.schema.ts`.
- **A read module reaches into `Import/` for a rejection**: `ImportReview.query.ts` imports `NotPermitted`.
- **The view repeats the state's five status tags**, since `Import.state.ts` exports no schema of the status alone.
- **A rewrite has no category of its own** in the JSDoc list; it carries `behavior`.

Not tried here: a compaction and a sealed field (each changes an aggregate the lock holds), the Vault, and a host
(`.host.ts`, the HTTP, CLI and MCP surfaces, and the cluster host, whose package is not installed). Those parts of
decisions 9d, 10 and 11 are on paper.

Not tried: the package's stories and mutants against this shape (the 192 mutants name files and lines that move),
`laws block-files` on the new kinds (`.state.ts`, `.event.ts`, `.transition.ts`, `.union.ts`), and moving the shape
into `packages/catalog/model`.
