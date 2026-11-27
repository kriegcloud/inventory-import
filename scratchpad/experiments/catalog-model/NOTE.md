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
| `model/` | the same model, 3 aggregates and 4 decisions, written to the taxonomy: 54 files, and 13 trial files |
| `CatalogModel.test.ts` | Verify on each, against its own copy of the package's lock; it sets `CI` itself and compares each copy with the package's lock |
| `model/Trial.model.ts`, `TrialBlocks.test.ts` | one trial block of each read and reaction kind, and a story for each |

`bun run scratch:test catalog-model` runs both (about five minutes). One alone:
`bunx vitest run experiments/catalog-model/CatalogModel.test.ts -t "every block in a file"` from `scratchpad/`.

## The shape

One block to a file, the file named `<Tag>.<kind>.ts`. An event's or a command's file is read as a namespace named
for its stem, and a state's as `<Stem>State`, since `<Stem>` is its aggregate's class. A rejection, a rule, a union
and a helper that a rule's text calls bare are named imports.

| File | Exports | Read as |
| --- | --- | --- |
| `<Tag>.event.ts` | `Event`, `evolve` | `ImportStaged.Event`, `ImportStaged.evolve` |
| `<Tag>.command.ts` | `Command`, `decide`, the rejections only it returns; `DecideRow`'s also `changesNothing` (below) | `StageImport.Command`, `DecideRow.decide` |
| `<Noun>.state.ts` | each case by name, `State`, `guards`, `cases`, `isAnyOf`, the invariants, a field record its event shares, what is worked out of a state (`inForce`, `sawIt`) | `RowState.Decided`, `RowState.guards.Decided` |
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
- **A field can say more than the package's does and the lock holds.** The lock keeps a rule's text and no field's
  schema, so an import's change numbers are `Change`, an event's `importId`, `row` and `label` are `ImportKey`,
  `RowKey` and `Label` as every command that writes them already is, and a decided group and its event spread one
  record of fields (`GroupState.act`). Verified, the lock unchanged.
- **A default shared between cases needs a call for each field.** `S.withConstructorDefault(...)` kept in a `const`
  and piped into fields of two types gives `unknown`; each count pipes its own.
- **The diagnostics are clean**: `bun run scratch:check` passes with every Effect diagnostic as an error.

## What was left as it was, and why

- **`Imported` and `TakenBack` take no default.** Their counts are carried from the state before; a default there
  would turn a forgotten field into a silent zero.
- **`Level` and `Undone` take no default**, and `noLevel`, `letGo` and `noUndo` stay written out. Their fields say who
  made a decision and when (provenance), and the prover refuses a default that is a struct.
- **`status` stays the discriminator** and every rule's text is as the lock holds it.
- **The helpers of `Catalog.model.ts` that read across instances stay in it** (`noTwoHold`, `everyDecidedGroup`,
  `everyGroupOfItsImport` and the rest): they have no one schema to sit with. `inForce`, which reads one group, is
  in `Group.state.ts`.
- **`changesNothing` stays exported from `DecideRow.command.ts`.** It reads what only the command says (`covered`,
  `asItReads`), and fourteen locked rules of `Deciding.transition.ts` call it by that name.
- **A row's decision texts, `ActCounted.flags` and `GroupCounted.rows` keep their wider schemas.** An undo's `next`
  level is the sender's word and the empty levels hold empty steps, so `by`, `step`, `flags` and `label` of a row
  stay plain texts; `rows` as `Size` would make `Import/` import `Group/`.
- **The member and organization ids of about twenty fields stay plain texts.** Narrowing them is a pass of its own
  under Verify, and the same check of who may act is written in ten `decide`s the mutants name by line.
- **`Review/Change.schema.ts` holds words every module uses** (`ImportKey`, `Change`, `Label`), so `Import/`, `Row/`
  and `Group/` import `Review/` and `Review/` imports each of them. No file imports in a circle; where the shared
  words go is for the move.
- **Every export carries `@category` and `@since 0.0.0`**, which `docs/building.md` says not to write. They were
  asked for with this experiment; the move decides which rule governs.
- **The rules carry no example in their JSDoc.** A rule is held by its proof and its mutants; an example would be a
  second, unproved statement of it.

## The blocks to come, tried

One trial block of each kind the model does not have yet, each in the home the exploration's decision 9 gives it,
listed in `CatalogTrial` beside the same aggregates and decisions. Trial blocks only: none is copied into a package.

| File | Kind | Live |
| --- | --- | --- |
| `Import/ImportStatus.view.ts` | view, guarded | same file: its `validate` |
| `Import/ForgetMember.rewrite.ts` | rewrite | none: it is pure |
| `Draft/RowHolds.view.ts` | view, read by the projection only | none: no Api serves it |
| `Draft/ImportActs.stream.ts` | stream, guarded, with its one entry event | same file: its `validate` |
| `Draft/DraftRows.projection.ts` | projection | same file, through `DraftStore` |
| `Draft/DraftStore.port.ts`, `DraftStore.memory.ts` | port and its in-memory twin | |
| `Draft/ImportReview.query.ts` | query, paged | same file, through `DraftStore` |
| `Suggestion/Suggester.external.ts` | external system | declaration only; its adapter is the host's |
| `Suggestion/SuggesterUnavailable.rejection.ts` | the suggester's and the pass's rejection | |
| `Suggestion/SuggestionPass.saga.ts` | saga | same file |
| `Suggestion/SuggestOnAsk.policy.ts` | policy | same file |

What it found:

- **The decided layout holds every kind.** Each block type-checks with every Effect diagnostic as an error, takes a
  trailing `{ description }`, and is held by `TrialBlocks.test.ts` (14 tests): the status view folded across an
  import's life; two asks starting two passes of the saga, each calling the external system, and a refused call
  ending its pass `Rejected`; the projection keeping one row for each decided row through a second decision and an
  undo, the stream logging every act, the query paging by keyset and giving another organization an empty page; the
  two guarded reads through an Api; the rewrite seen through the view, another member's event kept; and the
  in-memory store alone.
- **The lock does not see them.** On a copy, not kept, with a view, policy, projection, stream, saga and query
  listed in `Catalog` itself: nothing relocked, the lock byte for byte the same, the search as before (19,862
  sequences three commands deep).
- **Verify does, twice.** The same run was not verified. It reports the saga and the policy as not followed unless
  the test says `allow: { skipped: [...] }`, and 90 of the 185 sequences it replays as stories end with the stubbed
  external system's call unanswered. A model with a saga that calls out needs its Verify given an adapter that
  answers, or the reaction skipped by name. This was one run on a copy since deleted; no kept test repeats it.
- **A guarded read needs a Live.** A view or a stream that a client reads declares `middleware` and `rejects`, has a
  `validate` in its file (the library refuses the model without one), and needs the organization in what `validate`
  is given: the view's state, the stream's latest entry.
- **A read is judged before it waits for the caller's own writes** (the library's `judgedRead`). A `validate` that
  refuses a key with no state also refuses a person's read straight after their own command, so both guards refuse
  only what belongs to another organization. Another organization can tell an import id in use from one that is
  not, and nothing more. The query has no such gap: its store is read by organization first.
- **A story cannot reach a read's `validate`, nor deliver an event twice.** `Story.view` and `Story.streamed` read
  the hosts directly. The guards are tested through a test-local Api with the in-process client, and a replay at the
  store.
- **The in-process client's read after its own commands gave nothing** until the command's receipt was passed as
  `atLeast`, against what the Api's own documentation says. Seen twice; not traced.
- **A saga's key is its idempotency key.** Keyed by the import, only the first ask ever ran a pass. `SuggestionPass`
  is keyed by `<importId>:<seq>` of the ask's event, the import its input.
- **A projection gets an aggregate's event and not its state.** `StepUndone` carries neither the decision it puts
  back nor its import, so `DraftRows` reads `RowHolds`, a view of the row that reuses the row's own `evolve`s. A
  stream's writer is keyed like the stream, so it is keyed by the import the row's state names.
- **An append that type-checks can die.** `acts.append({ key }, entry)` is accepted by the types and refused at run
  time ("Only the projection that lists ImportActs in `writes` may append to it, with the input it is handling"): it
  takes the handler's own input object.
- **A port's key follows its file's path** (the `deterministicKeys` diagnostic), so it changes when the file moves
  into a package.
- **A rewrite needs a read that shows what it rewrites.** `ImportStatus` carries `askedBy` for that; a projection
  that reads the rewritten aggregate would need a `rewrite` handler of its own.
- **The library's own types put `null` and `undefined` at four edges**, each converted once: a view's key function
  answers `undefined` for no key, a page request's `after` is `undefined` for the first page, a page's `cursor` is
  `null` at the end, and a `validate` is given `null` for no state.

What was awkward in the layout:

- **A schema only its block uses sits in that block's file**: `Status` in the view's, `DraftRow` in the port's (as
  the library's own ledger example does), `PassKey` in the saga's. The other choice is a `.schema.ts` for each.
- **A read module reaches into `Import/` for a rejection**: `ImportActs.stream.ts` imports `NotPermitted`.
- **`RowHolds` repeats the row's state as a view** only so that a projection can see it.

Not tried here: a compaction and a sealed field (each changes an aggregate the lock holds), the Vault, and a host
(`.host.ts`, the HTTP, CLI and MCP surfaces, and the cluster host, whose package is not installed). Those parts of
decisions 9d, 10 and 11 are on paper.

Not tried: the package's stories and mutants against this shape (the 192 mutants name files and lines that move),
`laws block-files` on the new kinds (`.state.ts`, `.event.ts`, `.transition.ts`, `.union.ts`), and moving the shape
into `packages/catalog/model`.
